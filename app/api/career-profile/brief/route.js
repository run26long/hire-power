import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'

import { apiError } from '@/lib/apiError'
import RoleAlignmentBriefPDF from '../../../templates/pdf/RoleAlignmentBriefPDF'
import { openGate, readBriefToken, service } from '../_lib/recruiterContext'

// ============================================================================
// POST /api/career-profile/brief
// Body: { slug, brief_token }
//
// Turns a completed evaluation into a Hiring Brief PDF.
//
// WHAT IT WILL NOT DO
// It will not print what it is handed. The evaluation arrives as a token this
// service signed when it produced the evaluation, and the signature is checked
// over the exact bytes that came back. A recruiter who edits a strength, adds a
// role, or writes a different candidate's name into the payload invalidates it,
// and the request is refused. Without that, this endpoint is a machine for
// producing forged documents with our name across the top.
//
// The candidate's name is never taken from the request at all. It is read from
// the profile, so the name on the brief is always the name on the profile.
//
// It costs nothing. No call to claim_recruiter_use, so downloading a brief, and
// reopening one an hour later, spend none of the recruiter's evaluations. The
// limit is on asking the model a question; a PDF of an answer already given is
// not another question.
//
// The gate is checked again anyway. A profile that has been unpublished or has
// lapsed off Pro since the evaluation stops producing briefs, valid token or
// not - the token proves what the evaluation said, not that it may still be
// handed out.
// ============================================================================

const MAX_TOKEN = 200_000

// Enough to name the file usefully and not enough to upset anything that has to
// store it.
const NAME_CAP = 70

// ASCII and hyphenated, with the capitals kept: this becomes a filename a
// recruiter sees in a downloads folder beside other candidates, so it should
// read as a name rather than as a slug. Accents are folded rather than dropped
// so a name does not lose letters, and anything left that is not a letter or a
// digit becomes a separator.
function safeName(text, fallback) {
  const slug = String(text || '')
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, NAME_CAP)
    .replace(/-+$/g, '')
  return slug || fallback
}

export async function POST(request) {
  try {
    let body
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'Invalid request.', code: 'BAD_REQUEST' }, { status: 400 })
    }

    const slug = typeof body?.slug === 'string' ? body.slug : null
    const token = typeof body?.brief_token === 'string' ? body.brief_token : ''

    if (!token || token.length > MAX_TOKEN) {
      return Response.json(
        { error: 'That brief has expired. Run the evaluation again.', code: 'BAD_TOKEN' },
        { status: 400 }
      )
    }

    // ---- Is this ours, and is it intact? ----
    // Malformed, altered and expired all come back the same way: which of the
    // three it was is not something a caller probing this endpoint should be
    // told, and none of them is recoverable differently.
    const payload = readBriefToken(token)
    if (!payload?.evaluation || typeof payload.profile_id !== 'string') {
      return Response.json(
        { error: 'That brief has expired. Run the evaluation again.', code: 'BAD_TOKEN' },
        { status: 400 }
      )
    }

    const supabase = service()

    // ---- Still published, still entitled ----
    const gate = await openGate(supabase, slug)
    if (!gate.ok) {
      return Response.json(
        {
          error: gate.code === 'TIER_REQUIRED'
            ? 'This feature is not available on this profile.'
            : 'Profile not found.',
          code: gate.code
        },
        { status: gate.status }
      )
    }

    // The token was issued for one profile. A valid token and a different slug
    // is somebody trying to print one candidate's evaluation under another
    // candidate's name.
    if (payload.profile_id !== gate.profile.id) {
      return Response.json(
        { error: 'That brief does not belong to this profile.', code: 'TOKEN_MISMATCH' },
        { status: 403 }
      )
    }

    // ---- The name comes from the record, never from the request ----
    const { data: owner } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', gate.profile.user_id)
      .maybeSingle()

    let candidateName = owner?.display_name || null
    if (!candidateName) {
      const { data: resume } = await supabase
        .from('resumes')
        .select('resume_data')
        .eq('user_id', gate.profile.user_id)
        .eq('resume_type', 'core')
        .eq('is_active', true)
        .order('is_priority_core', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
      candidateName = resume?.[0]?.resume_data?.fullName || null
    }
    candidateName = candidateName || 'Career Profile'

    const evaluation = payload.evaluation
    const issuedOn = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    })

    // The site's own address, not the caller's. Origin is a request header and
    // therefore whatever the client chose to send, which would have let anyone
    // print a URL of their choosing into the footer of a document the
    // candidate then forwards to an employer. NEXT_PUBLIC_SITE_URL is the same
    // value the rest of the app builds absolute links from, and it is set per
    // environment, so this reads as production in production and localhost on
    // a developer's machine without either being able to tell the other.
    const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const profileUrl = `${site.replace(/\/+$/, '')}/p/${slug}`

    const pdf = await renderToBuffer(
      React.createElement(RoleAlignmentBriefPDF, {
        candidateName,
        roleTitle: evaluation.role_title || null,
        company: evaluation.company || null,
        issuedOn,
        evaluation,
        profileUrl
      })
    )

    const fileName = `${safeName(candidateName, 'Candidate')}-Hiring-Brief.pdf`

    return new Response(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        // Both forms: the ASCII one for anything that cannot read the other,
        // and the encoded one so a name with an accent in it survives.
        'Content-Disposition':
          `attachment; filename="Hiring-Brief.pdf"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        // A brief is about one named person and is not a shared cache's
        // business, at any hop.
        'Cache-Control': 'private, no-store'
      }
    })
  } catch (error) {
    return apiError(error, "We couldn't build that brief right now. Please try again.")
  }
}
