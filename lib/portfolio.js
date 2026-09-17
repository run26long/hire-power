// ============================================================================
// WHAT BELONGS IN THE PORTFOLIO
//
// Portfolio and Evidence draw from one table. This is the line between them,
// written once, because two places that each decide what a portfolio item is
// are two places that can come to disagree - and the failure mode of that
// disagreement is an item appearing in both sections or in neither.
//
// IT IS NOT "media_class IS IMAGE OR VIDEO"
// It is that, and a file we actually hold. A row can say image and be a link
// to a picture on somebody else's site: the evidence viewer has always
// refused to render remote media inline, and shows those as the preview card
// with a way out instead. A square mat with nothing in it is not a portfolio
// tile, so a linked image stays in Evidence, where it already reads correctly.
//
// The practical effect: a profile's visual work moves to the Portfolio when it
// is uploaded, and only then. Nothing that renders today stops rendering.
// ============================================================================

const VISUAL = new Set(['image', 'video'])

// The public payload says `has_file`; the management record says `source_type`.
// Both are answering the same question, so both are accepted here rather than
// making every caller remember which shape it is holding.
const isUpload = (item) => item?.has_file === true || item?.source_type === 'upload'

export const isVisualClass = (item) => VISUAL.has(item?.media_class)

export const isPortfolioItem = (item) => isVisualClass(item) && isUpload(item)

// Evidence is the complement, never its own list of conditions. Whatever the
// rule above admits, this one excludes, and it cannot drift.
export const isEvidenceItem = (item) => !isPortfolioItem(item)

export function splitCollection(items) {
  const portfolio = []
  const evidence = []
  for (const item of items || []) (isPortfolioItem(item) ? portfolio : evidence).push(item)
  return { portfolio, evidence }
}

// ---------------------------------------------------------------------------
// How many, and how many at once
// ---------------------------------------------------------------------------

// A free account gets one row of the desktop grid. Pro is unlimited. This is
// the first upload quota in the product, so it is counted in one place - the
// upload route - and everything else only reports it.
export const FREE_VISUAL_UPLOADS = 3

// Two rows of three. What the section shows before the reader has to ask for
// the rest, chosen so a full portfolio still reads as a selection rather than
// an archive - the same argument the Evidence preview is built on.
export const PORTFOLIO_PREVIEW_DESKTOP = 6

// Three rows of two, which is a phone screen's worth.
export const PORTFOLIO_PREVIEW_MOBILE = 6

// Seconds, formatted for the badge on a video mat. Null for anything that has
// no duration on file - the badge is absent rather than reading "0:00", which
// would be a claim about the video rather than the absence of one.
export function formatDuration(seconds) {
  const total = Math.round(Number(seconds))
  if (!Number.isFinite(total) || total <= 0) return null
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  const pad = (n) => String(n).padStart(2, '0')
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`
}
