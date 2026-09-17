import crypto from 'node:crypto'

// ============================================================================
// THE UPLOAD TICKET
//
// Says: this server issued this path, to this user, recently.
//
// It exists because the storage paths carry no identifiers. A Supabase signed
// URL embeds the object path, and those URLs are handed to anonymous readers,
// so a path beginning with somebody's auth user id would publish their account
// identity to every recruiter who opened one of their files. The paths are two
// random uuids and an extension instead - which means the finalise step cannot
// prove ownership by looking at one, and this is what proves it instead.
//
// Signed rather than stored, because the alternative is a table of pending
// uploads that needs rows written, read, and swept up after the ones nobody
// finishes. The TTL is short: an upload happens in the minutes after it is
// started or it does not happen, and an expired ticket leaves an orphan object
// and no row, which is the same state a closed tab produces.
//
// Shared by the evidence upload and the In My Own Words video. Two copies of
// an HMAC helper is exactly the kind of thing that drifts, and the half that
// drifts is the half that stops checking.
// ============================================================================

const TICKET_TTL_MS = 60 * 60 * 1000

const key = () =>
  process.env.RECRUITER_BRIEF_SECRET
  || process.env.RECRUITER_HASH_SECRET
  || process.env.SUPABASE_SERVICE_ROLE_KEY
  || 'hire-power'

const b64url = (buf) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

function sign(body) {
  return b64url(crypto.createHmac('sha256', key()).update(body).digest())
}

export function issueTicket(path, userId) {
  const body = b64url(JSON.stringify({ p: path, u: userId, iat: Date.now() }))
  return `${body}.${sign(body)}`
}

// True only for a ticket this server signed, for this exact path, for this
// user, within the window. Compared in constant time, so a near-miss and a
// wild guess take the same time to refuse.
export function ticketValid(ticket, path, userId) {
  if (typeof ticket !== 'string' || ticket.length > 4096) return false
  const dot = ticket.lastIndexOf('.')
  if (dot <= 0) return false

  const body = ticket.slice(0, dot)
  const given = Buffer.from(ticket.slice(dot + 1))
  const wanted = Buffer.from(sign(body))
  if (given.length !== wanted.length || !crypto.timingSafeEqual(given, wanted)) return false

  let payload
  try {
    payload = JSON.parse(Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString())
  } catch {
    return false
  }
  if (payload?.p !== path || payload?.u !== userId) return false
  return Number.isFinite(payload.iat) && Date.now() - payload.iat < TICKET_TTL_MS
}
