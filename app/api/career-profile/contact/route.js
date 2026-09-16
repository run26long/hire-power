import { createClient } from '@supabase/supabase-js'

// ============================================================================
// POST /api/career-profile/contact
//
// The owner setting, changing or clearing the address their Contact button
// opens.
//
// WHOSE PROFILE THIS WRITES TO
// The token's, never the body's. This takes no slug and no profile id: the
// service role sees every row, and a profile id from the browser would be the
// only thing standing between somebody's session and somebody else's Contact
// button. The row is found from the authenticated user and updated in place.
//
// CLEARING
// An empty string, or only spaces, means "none" and is stored as NULL rather
// than as ''. The public page treats a missing address as a button that does
// not render, and '' is a value, not a missing address - it would have left a
// control on the page pointing at nothing.
// ============================================================================

// Deliberately the same two rules the column's CHECK enforces, so a value the
// database would refuse is refused here first with a sentence somebody can
// act on rather than a 500. Nothing tries to decide whether the address is
// deliverable; that is not knowable here and rejecting a valid but unusual
// address is the worse failure.
const SHAPE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const MAX = 254

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const token = authHeader.replace('Bearer ', '')

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    let body
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'Invalid request.' }, { status: 400 })
    }

    const raw = typeof body?.contact_email === 'string' ? body.contact_email.trim() : ''
    const contactEmail = raw.length === 0 ? null : raw

    if (contactEmail !== null && (contactEmail.length > MAX || !SHAPE.test(contactEmail))) {
      return Response.json(
        { error: "That doesn't look like an email address.", code: 'BAD_EMAIL' },
        { status: 400 }
      )
    }

    const { data: updated, error: updateError } = await supabase
      .from('career_profiles')
      .update({ contact_email: contactEmail })
      .eq('user_id', user.id)
      .select('contact_email')
      .maybeSingle()

    if (updateError) {
      console.error('[career-profile] Contact email update failed:', updateError)
      return Response.json({ error: "We couldn't save that. Please try again." }, { status: 500 })
    }
    if (!updated) {
      return Response.json({ error: 'No profile to update.' }, { status: 404 })
    }

    return Response.json({ contact_email: updated.contact_email ?? null })
  } catch (error) {
    console.error('[career-profile] Contact email route failed:', error)
    return Response.json({ error: "We couldn't save that. Please try again." }, { status: 500 })
  }
}
