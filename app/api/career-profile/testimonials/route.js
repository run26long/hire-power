import { firstNameOf, firstWordOf } from '@/lib/firstName'
import { requireCustomise } from '../_lib/requireCustomise'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { noEmDash } from '../_lib/recruiterContext'
import { sendTransactional, TRANSACTIONAL } from '@/lib/loops/sendTransactional'
import { RELATIONSHIP_TYPES } from '@/lib/testimonialTypes'

// ============================================================================
// POST /api/career-profile/testimonials
//
// The owner asking somebody to write about them, and the email that asks.
//
// WHOSE PROFILE THIS WRITES TO
// The token's. No profile id from the body.
//
// THE ROW IS WRITTEN BEFORE THE EMAIL IS SENT, AND REMOVED IF IT FAILS
// The link in the email is addressed by a token that only exists once the row
// does, so the order is forced. But a request the referee was never told about
// is worse than no request: it sits in the owner's list saying "waiting on
// them" forever, and the person it names has no idea. So a failed send deletes
// the row and answers with an error, and the owner can try again.
//
// That is a small window where a row exists and no email has gone out. It is
// the right side to fail on: the alternative is sending first, which cannot be
// done, or leaving the row, which lies.
//
// THE TOKEN IS THE WHOLE ADDRESS OF THE REFEREE PAGE
// There is no session on that page and nothing else to go on, so the token has
// to be unguessable and unique. It is unique because I added the index: it was
// not before, and two rows sharing a token would let a referee write into
// somebody else's request.
// ============================================================================

const LIMITS = { name: 120, email: 254, title: 140, relationship: 200 }

const EMAIL_SHAPE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

const CONTROL = new RegExp(
  '[' +
  "\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F" +
  "\\u200B-\\u200F\\u2028\\u2029\\uFEFF" +
  ']', 'g'
)
const clean = (value) => noEmDash(String(value).replace(CONTROL, '').replace(/\s+/g, ' ').trim())

function text(value, max, label, { required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    return required ? { error: `${label} is required.` } : { value: null }
  }
  if (typeof value !== 'string') return { error: `${label} must be text.` }
  const trimmed = clean(value)
  if (!trimmed) return required ? { error: `${label} is required.` } : { value: null }
  if (trimmed.length > max) return { error: `${label} is too long (max ${max} characters).` }
  return { value: trimmed }
}

const RETURNED =
  'id, recipient_name, recipient_email, recipient_title, relationship, ' +
  'relationship_type, status, submitted_at, reference_consent, created_at'

export async function POST(request) {
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

    let body
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'Invalid request.' }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from('career_profiles')
      .select('id, slug')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!profile) return Response.json({ error: 'No profile to ask for.' }, { status: 404 })

    // Putting new content on a profile is the paid half. Reading it, and
    // taking something down, are not.
    const gate = await requireCustomise(user.id, supabase)
    if (gate) return gate

    const { data: account } = await supabase
      .from('profiles')
      .select('display_name, first_name')
      .eq('id', user.id)
      .maybeSingle()

    // ---- WHO IS BEING ASKED ----
    const name = text(body?.recipient_name, LIMITS.name, 'Their name', { required: true })
    if (name.error) {
      return Response.json({ error: name.error, code: 'INVALID', field: 'recipient_name' }, { status: 400 })
    }

    const email = text(body?.recipient_email, LIMITS.email, 'Their email', { required: true })
    if (email.error) {
      return Response.json({ error: email.error, code: 'INVALID', field: 'recipient_email' }, { status: 400 })
    }
    if (!EMAIL_SHAPE.test(email.value)) {
      return Response.json(
        { error: "That doesn't look like an email address.", code: 'INVALID', field: 'recipient_email' },
        { status: 400 }
      )
    }

    const title = text(body?.recipient_title, LIMITS.title, 'Their title')
    if (title.error) {
      return Response.json({ error: title.error, code: 'INVALID', field: 'recipient_title' }, { status: 400 })
    }

    // The category is constrained by the column too, so this is the second
    // lock rather than the first - here to answer with a sentence instead of
    // a 500, and because the count behind EARNED 360 is only meaningful if
    // every row holds one of these exact strings.
    const relationshipType = typeof body?.relationship_type === 'string'
      ? RELATIONSHIP_TYPES.find(t => t.toLowerCase() === body.relationship_type.trim().toLowerCase())
      : null
    if (!relationshipType) {
      return Response.json(
        { error: 'Choose how you worked together.', code: 'INVALID', field: 'relationship_type' },
        { status: 400 }
      )
    }

    const candidateName = account?.display_name || 'A Hire Power member'

    // ---- THE ROW ----
    // The column is uuid, and the existing rows hold uuids, so this is one
    // too. That is not a compromise: crypto.randomUUID is backed by a
    // cryptographic generator and a v4 uuid carries 122 bits of randomness,
    // which is more than most session tokens and far past guessable. I reached
    // for 32 random bytes first on the principle that a database key is not a
    // credential, and the principle is right about sequential or derived ids
    // and wrong about this one.
    const token = crypto.randomUUID()

    const { data: created, error: insertError } = await supabase
      .from('profile_testimonials')
      .insert({
        profile_id: profile.id,
        user_id: user.id,
        recipient_name: name.value,
        recipient_email: email.value,
        recipient_title: title.value,
        relationship_type: relationshipType,
        // The prose attribution the public profile prints. Seeded from the
        // category so a new testimonial has something to show under it; the
        // referee's own account of how they worked together can replace it
        // later without touching what is counted.
        relationship: relationshipType,
        status: 'requested',
        request_token: token
      })
      .select(RETURNED)
      .maybeSingle()

    if (insertError || !created) {
      console.error('[career-profile] Testimonial insert failed:', insertError)
      return Response.json({ error: "We couldn't send that request. Please try again." }, { status: 500 })
    }

    // ---- THE EMAIL ----
    const site = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '')
    const sent = await sendTransactional({
      transactionalId: TRANSACTIONAL.TESTIMONIAL_REQUEST,
      email: email.value,
      dataVariables: {
        candidateName,
        candidateFirstName: firstNameOf(account, candidateName),
        refereeName: name.value,
        // A referee has no account, so there is no stored first name to prefer.
        refereeFirstName: firstWordOf(name.value),
        testimonialUrl: `${site}/testimonial/${token}`,
        profileUrl: `${site}/career-profile`
      }
    })

    if (!sent.ok) {
      // A request nobody was told about is worse than no request: it would sit
      // in the owner's list saying "waiting on them" forever while the person
      // it names knows nothing about it.
      await supabase.from('profile_testimonials').delete().eq('id', created.id)
      return Response.json(
        { error: "We couldn't send that email. Check the address and try again.", code: 'SEND_FAILED' },
        { status: 502 }
      )
    }

    // request_token is deliberately not returned. The owner has no use for it,
    // and it is the credential that lets somebody write on their profile.
    return Response.json({ testimonial: created })
  } catch (error) {
    console.error('[career-profile] Testimonial request failed:', error)
    return Response.json({ error: "We couldn't send that request. Please try again." }, { status: 500 })
  }
}
