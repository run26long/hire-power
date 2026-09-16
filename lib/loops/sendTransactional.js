// ============================================================================
// SENDING ONE TRANSACTIONAL EMAIL
//
// The first transactional send in this codebase. Everything else that touches
// Loops calls contacts/update, which is a different endpoint with different
// failure modes, so this does not reuse it.
//
// HOW LOOPS TRANSACTIONAL ACTUALLY WORKS
// The design lives in Loops, not here. A template is built in their editor,
// given an id, and referenced by that id; the request carries the recipient
// and a flat map of data variables which the template interpolates. There is
// no way to POST your own HTML body to this endpoint.
//
// So the HTML in lib/loops/templates is the source those templates were built
// from, written with Loops' own {{variable}} syntax, kept in the repository so
// the design is reviewable and reproducible rather than living only inside a
// third-party editor. Changing an email means changing the file and pasting it
// into Loops. The file says so at the top.
//
// FAILURE IS RETURNED, NEVER THROWN PAST THE CALLER
// Each caller decides what an unsent email means. Failing to send the referee
// their request makes the whole request pointless, so that route fails loudly.
// Failing to send the candidate a notification about a testimonial that has
// already been saved does not undo the testimonial, so that one is logged and
// swallowed. Those are different decisions and this module does not make
// either of them.
// ============================================================================

const ENDPOINT = 'https://app.loops.so/api/v1/transactional'

// Long enough for a normal send, short enough that a hanging third party does
// not hold a request open behind it.
const TIMEOUT_MS = 10_000

export const TRANSACTIONAL = {
  // To the referee: here is who asked, and here is where to write.
  TESTIMONIAL_REQUEST: 'cmu4h9d9103ju0ju4pazwq52j',
  // To the referee, after polishing: here is what it became. No action needed.
  TESTIMONIAL_CONFIRMATION: 'cmu4heoff03wi0jyjnchn76bt',
  // To the candidate: somebody wrote about you, come and look.
  TESTIMONIAL_NOTIFICATION: 'cmu4hsriw04kr0jwum7g1wbm9'
}

export async function sendTransactional({ transactionalId, email, dataVariables }) {
  if (!process.env.LOOPS_API_KEY) {
    console.error('[loops] LOOPS_API_KEY missing; not sending', transactionalId)
    return { ok: false, reason: 'NOT_CONFIGURED' }
  }
  if (!transactionalId || !email) {
    return { ok: false, reason: 'MISSING_FIELDS' }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.LOOPS_API_KEY}`,
        'Content-Type': 'application/json'
      },
      // Loops interpolates only strings. A null or a number arriving here
      // renders as "null" or silently drops depending on the template, so
      // everything is stringified once, at the edge.
      body: JSON.stringify({
        transactionalId,
        email,
        dataVariables: Object.fromEntries(
          Object.entries(dataVariables || {}).map(([key, value]) => [key, String(value ?? '')])
        )
      }),
      signal: controller.signal
    })

    if (!response.ok) {
      let detail = ''
      try { detail = (await response.text()).slice(0, 300) } catch { /* status is enough */ }
      // The address is not logged. A recipient's email is not something this
      // product writes into its own logs to diagnose a third party with.
      console.error('[loops] Transactional send failed:', transactionalId, response.status, detail)
      return { ok: false, reason: 'SEND_FAILED', status: response.status }
    }

    return { ok: true }
  } catch (error) {
    const aborted = error?.name === 'AbortError'
    console.error('[loops] Transactional send errored:', transactionalId, aborted ? 'timeout' : error?.message)
    return { ok: false, reason: aborted ? 'TIMEOUT' : 'SEND_ERROR' }
  } finally {
    clearTimeout(timer)
  }
}
