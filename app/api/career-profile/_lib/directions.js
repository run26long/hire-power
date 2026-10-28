import { canShowAllDirections } from '@/lib/profileTier'

// ============================================================================
// WHICH CAREER DIRECTIONS A PROFILE SHOWS
//
// The page's own answer, written once so that the routes which serve a single
// direction's content cannot drift from the route that serves the page.
//
// There are three of those: the document route, which renders the page; the
// resume download, which takes a direction and hands back its core resume as
// a PDF; and the evidence media route, which takes a direction and signs a URL
// for a file inside it. Each of the last two is handed a direction id by the
// caller, and before this module each answered the question its own way - so
// a direction the page had stopped showing could still hand over its resume
// and its files to anybody who had kept the id.
//
// THE ORDER IS THE ANSWER
// Status first and sort_order second, which is the order the hub gave them.
// The first of that list is the primary: it is the one the page opens on, the
// one the settings drawer marks "Always on", and on free it is the only one
// shown. Taken by position rather than by testing for the primary's own shape
// (`source` 'user' at sort_order 0), because a profile whose first direction
// came from the coaching rather than from its owner answers that test with
// nothing, and a profile with no directions at all is a worse answer than a
// profile with its first one.
// ============================================================================

// What the page has room for. The same number lens visibility refuses past.
export const LENS_DISPLAY_LIMIT = 3

// Everything reaching the callers is active now, so the status rank ranks
// nothing in practice and is kept as a floor: a row arriving in some other
// state through a path this does not know about sorts last rather than first.
const orderRank = (lens) => (lens?.status === 'active' ? 0 : 1)
const sortWeight = (lens) => (Number.isFinite(lens?.sort_order) ? lens.sort_order : Number.MAX_SAFE_INTEGER)

export function orderLenses(rows) {
  return (rows || [])
    .slice()
    .sort((a, b) => {
      const byStatus = orderRank(a) - orderRank(b)
      if (byStatus !== 0) return byStatus
      const byOrder = sortWeight(a) - sortWeight(b)
      if (byOrder !== 0) return byOrder
      return String(a.created_at || '').localeCompare(String(b.created_at || ''))
    })
}

// From rows already read: the ones this plan renders. Free is the primary and
// nothing else, and nothing is removed from the record to make that true - see
// canShowAllDirections.
export function lensesShownBy(rows, tier) {
  const ordered = orderLenses(rows).slice(0, LENS_DISPLAY_LIMIT)
  return canShowAllDirections(tier) ? ordered : ordered.slice(0, 1)
}

// The same answer for a route holding nothing but an id. Active rows only,
// which is what the document route reads, so the primary is the same row on
// both sides of the question.
//
// Null when the profile has no directions, which is a real state: the page
// renders the priority core on its own, and a caller naming a direction on
// such a profile is naming one that is not there.
export async function primaryLensId(supabase, profileId) {
  const { data, error } = await supabase
    .from('profile_lenses')
    .select('id, status, sort_order, created_at')
    .eq('profile_id', profileId)
    .eq('status', 'active')

  if (error) {
    console.error('[career-profile] Primary direction lookup failed:', error)
    return { error }
  }
  return { id: orderLenses(data).at(0)?.id || null }
}

// The owner's tier, for the two routes that are read by strangers and so have
// no session to take it from.
export async function profileShowsAllDirections(supabase, ownerId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', ownerId)
    .maybeSingle()

  if (error) {
    console.error('[career-profile] Tier lookup failed:', error)
    return { error }
  }
  return { showsAll: canShowAllDirections(data?.subscription_tier) }
}
