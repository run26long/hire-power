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
// THREE STATES, NOT TWO
// NULL and '' are different answers here and the difference is the whole
// feature. NULL means the owner has never touched this field, and the public
// page falls back to their account address so the Contact button is there by
// default. '' means they cleared the field on purpose, which is how the button
// is turned off. Collapsing '' to NULL - which this route used to do - made
// "never asked" and "no thank you" the same row, and there was then no way to
// honour the second without overriding the first.
//
// An address of only spaces is a cleared field, not an address.
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

    // Stored as typed, including the empty string: see THREE STATES above.
    const contactEmail = typeof body?.contact_email === 'string' ? body.contact_email.trim() : ''

    if (contactEmail !== '' && (contactEmail.length > MAX || !SHAPE.test(contactEmail))) {
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
      // The shape constraint predates the three states above and refuses the
      // empty string until scripts/allow-cleared-contact-email.sql has been
      // run. Everything else about the default still works without it, so the
      // one action that cannot is worth naming rather than answering with a
      // generic failure somebody would retry forever.
      if (contactEmail === '' && /contact_email_shape/.test(updateError.message || '')) {
        console.error('[career-profile] Clearing the contact address needs scripts/allow-cleared-contact-email.sql')
        return Response.json(
          { error: "We can't switch the Contact button off yet. Please try again later.", code: 'CLEAR_UNAVAILABLE' },
          { status: 503 }
        )
      }
      console.error('[career-profile] Contact email update failed:', updateError)
      return Response.json({ error: "We couldn't save that. Please try again." }, { status: 500 })
    }
    if (!updated) {
      return Response.json({ error: 'No profile to update.' }, { status: 404 })
    }

    // `?? null` and not `|| null`: '' is an answer and has to survive the
    // trip back, or the drawer would read a cleared field as never set.
    return Response.json({ contact_email: updated.contact_email ?? null })
  } catch (error) {
    console.error('[career-profile] Contact email route failed:', error)
    return Response.json({ error: "We couldn't save that. Please try again." }, { status: 500 })
  }
}
