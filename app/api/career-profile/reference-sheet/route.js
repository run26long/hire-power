import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@supabase/supabase-js'
import ReferenceSheetPDF from '@/app/templates/pdf/ReferenceSheetPDF'

// ============================================================================
// GET /api/career-profile/reference-sheet
//
// The list of people who said they would take the call, as a PDF the candidate
// can hand to an employer.
//
// WHO IS ON IT
// Only referees who ticked the box on their own page. Not everyone who wrote a
// testimonial, and not everyone whose testimonial was published: agreeing that
// your words can appear on somebody's profile is not agreeing to be telephoned
// about them, and conflating the two would be using one consent for a purpose
// it was not given for.
//
// The status filter is deliberately wide. A testimonial the candidate has not
// published still came from somebody who offered to be a reference, and that
// offer stands whether or not the quote made it onto the profile.
//
// WHY THIS IS OWNER-ONLY AND NEVER LINKED PUBLICLY
// It is a page of other people's phone numbers. It is authenticated, it is
// no-store, and there is no token, no slug and no public route that reaches
// it. The candidate downloads it and decides who sees it.
// ============================================================================

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    const { data: { user }, error: authError } =
      await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('career_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!profile) return Response.json({ error: 'No profile.' }, { status: 404 })

    const { data: account } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .maybeSingle()

    const { data: rows, error: rowsError } = await supabase
      .from('profile_testimonials')
      .select('recipient_name, recipient_title, recipient_email, reference_phone, relationship, polished_text, raw_text, created_at')
      .eq('profile_id', profile.id)
      .eq('reference_consent', true)
      .order('created_at', { ascending: true })

    if (rowsError) {
      console.error('[career-profile] Reference sheet lookup failed:', rowsError)
      return Response.json({ error: "We couldn't build that just now." }, { status: 500 })
    }

    const candidateName = account?.display_name || 'Career Profile'

    const references = (rows || []).map(row => ({
      name: row.recipient_name,
      // Their title and how they worked together, on one line, whichever of
      // the two exist.
      role: [row.recipient_title, row.relationship].filter(Boolean).join(' · ') || null,
      email: row.recipient_email || null,
      phone: row.reference_phone || null,
      // The polished line where there is one, and their own words where there
      // is not. An employer reading this wants a sentence about the candidate,
      // and an unpolished one is better than a blank.
      quote: row.polished_text || row.raw_text || null
    }))

    const issuedOn = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    })

    const buffer = await renderToBuffer(
      React.createElement(ReferenceSheetPDF, { candidateName, issuedOn, references })
    )

    const safeName = candidateName.replace(/[^\p{L}\p{N} .-]/gu, '').trim().replace(/\s+/g, '-') || 'Career-Profile'
    const filename = `${safeName}-References.pdf`

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        // Somebody else's contact details. Not in a shared cache, not on disk.
        'Cache-Control': 'private, no-store'
      }
    })
  } catch (error) {
    console.error('[career-profile] Reference sheet failed:', error)
    return Response.json({ error: "We couldn't build that just now." }, { status: 500 })
  }
}
