// ============================================================================
// HOW OFTEN ONE ACCOUNT MAY SEND THIS SERVER AT THE INTERNET
//
// Per user, in this process, and counted in two tiers.
//
// A URL refused for its scheme, its port or its address never opens a socket.
// Charging those against the same budget as a real fetch means somebody who
// mistypes a few links is locked out of the feature for a minute, and it means
// the expensive thing and the free thing cost the same. So calls are capped
// generously and outbound requests tightly, and only the ones that actually
// reached the network count against the tighter cap.
//
// WHY IT MOVED OUT OF preview-url
// It was written there, for the one route that fetched a URL somebody else
// chose. Two more routes do that now: adding a link saves the page's own
// image, and the thumbnail switch fetches that page again. Three copies of a
// counter would be three budgets, and three budgets is no budget - an account
// held to twenty previews a minute could spend another twenty on each of the
// other two by doing the same thing through a different door.
//
// So the maps live here and the three routes share them. The tight tier is
// one per-account outbound allowance across every route that opens a socket,
// which is the only shape in which the number means anything.
//
// WHAT THIS IS NOT
// It is in-process memory, so it is per serverless instance and resets when
// one is recycled. That was true where it was written and is true here. It is
// a brake on one account hammering one instance, not a quota - a quota needs
// somewhere shared to count in, and nothing here needs one yet.
// ============================================================================

const WINDOW_MS = 60_000

// Every call to a route that might fetch, whether it ends up fetching or not.
export const CALL_LIMIT = 60

// Only the ones that actually reached the network.
export const FETCH_LIMIT = 20

const calls = new Map()
const fetches = new Map()

function recent(store, userId) {
  const now = Date.now()
  const times = (store.get(userId) || []).filter(t => now - t < WINDOW_MS)
  store.set(userId, times)
  if (store.size > 5000) {
    for (const [key, list] of store) {
      if (!list.some(t => now - t < WINDOW_MS)) store.delete(key)
    }
  }
  return times
}

function record(store, userId) {
  const times = recent(store, userId)
  times.push(Date.now())
  store.set(userId, times)
  return times.length
}

/**
 * Count this call, and say whether the account has made too many.
 *
 * The generous tier. Counting is the point - this is the one that charges for
 * arriving, so a caller cannot sit in a loop being refused for free.
 */
export const overCallLimit = (userId) => record(calls, userId) > CALL_LIMIT

/**
 * Whether the account has used up its outbound allowance for the minute.
 *
 * Asked before anything opens a socket, and it counts nothing: a caller that
 * is refused here has not made a request, and charging it would be charging
 * for the refusal.
 */
export const outboundExhausted = (userId) => recent(fetches, userId).length >= FETCH_LIMIT

/**
 * One request that actually reached the network. Called after the fact, by
 * whoever knows whether a socket was opened - safeFetch reports that as
 * `attempted`, and nothing else can tell.
 */
export const chargeOutbound = (userId) => { record(fetches, userId) }
