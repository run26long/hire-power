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
// TWO COLUMNS, ONE QUESTION EACH
// contact_enabled is whether the Contact button is on the profile, and
// contact_email is which address it opens - the owner's own, or empty for
// the account address. They were one column with three states, and the
// middle one did both jobs: '' meant "no button" AND "no custom address",
// so switching the button off threw away the address somebody had typed
// and switching it back on meant typing it again.
//
// Both are optional in the body and each is written only if it was sent, so
// the switch and the address are two independent saves from one form.
//
// EVERY PLAN
// This was behind requireCustomise, which made a contact address a Pro
// feature. It is not one any more: a free profile publishes, has a link,
// and is a page somebody is meant to answer. What it had instead was the
// worst of both - no way to set an address and no way to switch the button
// off, while the public route fell back to the account's sign-in address
// and published it to every visitor.
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

    // ---- WHAT WAS SENT, AND ONLY WHAT WAS SENT ----
    //
    // The drawer saves the switch and the address separately, so a body
    // carrying one must not blank the other. hasOwnProperty rather than a
    // truthiness test, because the meaningful values here are the empty
    // string and false.
    const sentEmail = Object.prototype.hasOwnProperty.call(body, 'contact_email')
    const sentEnabled = Object.prototype.hasOwnProperty.call(body, 'contact_enabled')
    if (!sentEmail && !sentEnabled) {
      return Response.json({ error: 'Nothing to save.', code: 'EMPTY' }, { status: 400 })
    }

    // An address of only spaces is no address, not an address.
    const contactEmail = typeof body?.contact_email === 'string' ? body.contact_email.trim() : ''

    if (sentEmail && contactEmail !== '' && (contactEmail.length > MAX || !SHAPE.test(contactEmail))) {
      return Response.json(
        { error: "That doesn't look like an email address.", code: 'BAD_EMAIL' },
        { status: 400 }
      )
    }

    const { data: updated, error: updateError } = await supabase
      .from('career_profiles')
      .update({
        ...(sentEmail ? { contact_email: contactEmail } : {}),
        ...(sentEnabled ? { contact_enabled: body.contact_enabled === true } : {})
      })
      .eq('user_id', user.id)
      .select('contact_email, contact_enabled')
      .maybeSingle()

    if (updateError) {
      // The shape constraint predates the three states above and refuses the
      // empty string until scripts/allow-cleared-contact-email.sql has been
      // run. Everything else about the default still works without it, so the
      // one action that cannot is worth naming rather than answering with a
      // generic failure somebody would retry forever.
      if (sentEmail && contactEmail === '' && /contact_email_shape/.test(updateError.message || '')) {
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
    return Response.json({
      contact_email: updated.contact_email ?? null,
      // `!== false`, so a build whose column is not there yet reads as on
      // rather than as off. The failure direction matters: a profile that
      // loses its Contact button silently is worse than one that keeps it.
      contact_enabled: updated.contact_enabled !== false
    })
  } catch (error) {
    console.error('[career-profile] Contact email route failed:', error)
    return Response.json({ error: "We couldn't save that. Please try again." }, { status: 500 })
  }
}
