import { normalizeSkillCategories } from '@/lib/resumeText'

// ============================================================================
// Career Profile - pure data helpers.
//
// Everything here was already doing its job on the old page and is carried over
// unchanged in behaviour. It lives outside the components now so the acts stay
// presentational and the tolerances for the resume's shape are in one place.
//
// The only additions are the two at the bottom, which the Signature identity
// act needs to set a name without letting it stack into three lines.
// ============================================================================

// The profile shows one flat set rather than the resume's grouping, so a
// recruiter scans capability, not the way the resume happens to file it. The
// normaliser is what reconciles the shapes resume_data can be in; this only
// flattens what it returns.
export function flattenSkills(resumeData) {
  const seen = new Set()
  const flat = []
  for (const group of normalizeSkillCategories(resumeData)) {
    for (const skill of group.skills) {
      const text = typeof skill === 'string' ? skill.trim() : ''
      const key = text.toLowerCase()
      if (!text || seen.has(key)) continue
      seen.add(key)
      flat.push(text)
    }
  }
  return flat
}

// ---------------------------------------------------------------------------
// Skills, grouped for the split composition.
//
// The resume already files skills under named categories, so that is real
// grouping and it is used when it is there. More than four categories are
// folded into the last cluster rather than shown as a dozen headings.
//
// With no category metadata there is nothing to group by and nothing is
// invented: the flat list is tiered by the order it already has, which is the
// order the resume put it in. Either way a cluster's index is what decides its
// prominence, so no cluster is ever labelled something the data did not say.
// ---------------------------------------------------------------------------
const MAX_SKILL_CLUSTERS = 6

export function groupSkills(resumeData) {
  const categories = resumeData?.skillsCategories
  const seen = new Set()

  const take = (value) => {
    const list = Array.isArray(value) ? value : [value]
    const out = []
    for (const skill of list) {
      const text = typeof skill === 'string' ? skill.trim() : ''
      const key = text.toLowerCase()
      if (!text || seen.has(key)) continue
      seen.add(key)
      out.push(text)
    }
    return out
  }

  // The normaliser owns every shape resume_data can hold, and an array arrives
  // in the order it is stored in, which is the order it was written in.
  const named = normalizeSkillCategories(resumeData)
    .map(group => ({ name: String(group.name || '').trim(), skills: take(group.skills) }))
    .filter(group => group.skills.length > 0)

  if (categories) {
    // An object row has no order of its own: jsonb sorted its keys by length, so
    // whichever name happened to be shortest would otherwise open the section.
    // Leading with the broadest capability is the better accident. An array is
    // already in the order it asked for and is never re-sorted here.
    if (!Array.isArray(categories)) {
      named.sort((a, b) => b.skills.length - a.skills.length)
    }

    if (named.length > 0) {
      if (named.length <= MAX_SKILL_CLUSTERS) return named
      const kept = named.slice(0, MAX_SKILL_CLUSTERS - 1)
      const rest = named.slice(MAX_SKILL_CLUSTERS - 1)
      return [...kept, { name: rest[0].name, skills: rest.flatMap(group => group.skills) }]
    }
  }

  // No categories. Tier by existing order, unnamed, in three.
  const flat = flattenSkills(resumeData)
  if (flat.length === 0) return []
  if (flat.length <= 6) return [{ name: null, skills: flat }]
  const size = Math.ceil(flat.length / 3)
  return [
    { name: null, skills: flat.slice(0, size) },
    { name: null, skills: flat.slice(size, size * 2) },
    { name: null, skills: flat.slice(size * 2) }
  ].filter(group => group.skills.length > 0)
}

// ---------------------------------------------------------------------------
// Skill proof, resolved.
//
// What is stored against a skill is references, never copies, so this is where
// they become something to render. Everything is resolved against what the page
// was actually given: the public evidence and the published testimonials it
// already holds, and the resume it is already showing.
//
// That is the whole point of storing references. A piece of evidence the owner
// has since deleted or made private is not in the payload, so it resolves to
// nothing and quietly disappears from the proof. A bullet that moved when the
// resume was recoached no longer matches the text recorded beside its path, so
// it disappears too rather than pointing confidently at the wrong sentence.
// Proof either still stands up or it is not shown.
//
// Returns a Map keyed by the lowercased skill label, which is how a rendered
// tile finds its own proof.
// ---------------------------------------------------------------------------
function bulletAt(resumeData, path) {
  const match = /^experience\[(\d+)\]\.bullets\[(\d+)\]$/.exec(String(path || ''))
  if (!match) return null
  const role = resumeData?.experience?.[Number(match[1])]
  const bullet = role?.bullets?.[Number(match[2])]
  return typeof bullet === 'string' ? { text: bullet, company: role?.company || '' } : null
}

export function resolveSkillProof(skillProofs, { evidence, testimonials, resumeData } = {}) {
  const byLabel = new Map()
  if (!Array.isArray(skillProofs) || skillProofs.length === 0) return byLabel

  const evidenceById = new Map((evidence || []).map(item => [item.id, item]))
  const testimonialById = new Map((testimonials || []).map(item => [item.id, item]))

  for (const row of skillProofs) {
    const label = typeof row?.skill_label === 'string' ? row.skill_label.trim() : ''
    if (!label) continue

    const resolved = []
    for (const ref of Array.isArray(row?.proofs) ? row.proofs : []) {
      if (ref?.source === 'evidence') {
        const item = evidenceById.get(ref.id)
        if (item) resolved.push({ source: 'evidence', id: item.id, title: item.title, detail: item.description, url: item.url, kind: item.kind })
      } else if (ref?.source === 'testimonial') {
        const item = testimonialById.get(ref.id)
        if (item) resolved.push({ source: 'testimonial', id: item.id, title: item.recipient_name, detail: item.polished_text, role: item.recipient_title })
      } else if (ref?.source === 'bullet') {
        const found = bulletAt(resumeData, ref.path)
        // The text recorded beside the path is what proves the path still
        // points where it did. A mismatch means the resume moved underneath it.
        if (found && found.text.trim() === String(ref.text || '').trim()) {
          resolved.push({ source: 'bullet', id: ref.path, title: found.company, detail: found.text })
        }
      }
    }

    if (resolved.length > 0) byLabel.set(label.toLowerCase(), resolved)
  }

  return byLabel
}

// Which testimonials a three-position wheel is showing, given how far it has
// been turned. Pure, and here rather than in the section, so the wrap can be
// checked on its own without a database or a browser.
// ---------------------------------------------------------------------------
// A direction's reading order for the shared testimonials.
//
// The testimonials are the canonical records and are never duplicated, so a
// direction can only say which of them to read first. That claim is checked
// rather than trusted: an id is kept only if it names one of the testimonials
// actually handed to this page, which have already been filtered to the
// profile's own published ones. An id that is unknown, withdrawn, unpublished
// or from another profile therefore resolves to nothing and is dropped.
//
// Whatever the order does not mention keeps its existing stable order behind
// the ranked ones, so a testimonial added since the direction was written
// still appears - just not ahead of the ranking. No order at all means the
// shared order, unchanged.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// WHAT THE OWNER CHOSE, WHERE THEY CHOSE ANYTHING
//
// A direction's testimonial placements are a curation: which of them this
// direction shows and in what order. Unlike the generated ranking above it
// both selects and orders, so a testimonial the owner hid is not here at all
// rather than sorted to the back.
//
// Returns null when there is no curation to apply, which is how the caller
// knows to fall back to the generated ranking rather than to an empty page.
// An empty array of placements means the same thing as none: a database that
// has not had the placement migration run has no rows, and a profile that
// reads as having hidden everything everywhere is far likelier to be that
// than to be somebody's intent.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// WHAT THIS DIRECTION HAS PLACED, SHOWN AND HIDDEN TOGETHER
//
// The management list's source: every placement this direction holds, in its
// own order. There is no fallback to look through any more - what a direction
// shows is decided by onDirection below, and this says only where the rows it
// does have want things to sit.
//
// Hidden rows are kept. They are the whole reason the list exists: an item
// off this direction is a switch to turn back on, and it can only be turned
// back on if it is in front of somebody.
// ---------------------------------------------------------------------------
export function directionPlacements(placements, lensId) {
  const rows = Array.isArray(placements) ? placements : []
  if (!lensId) return []
  return rows
    .filter(r => r?.lens_id === lensId)
    .sort((x, y) => (x?.sort_order ?? 0) - (y?.sort_order ?? 0))
}

// ---------------------------------------------------------------------------
// THE ROWS ONE DIRECTION HOLDS, BY ITEM
//
// Every reader asks the same two questions of the same rows - is this item on
// this direction, and where does it sit - so the lookup is built once and
// handed to both rather than each caller filtering the whole list again.
// ---------------------------------------------------------------------------
export function rowsForDirection(placements, lensId, itemKey) {
  const map = new Map()
  if (!lensId) return map
  for (const row of Array.isArray(placements) ? placements : []) {
    if (!row || row.lens_id !== lensId) continue
    map.set(row[itemKey], row)
  }
  return map
}

// ---------------------------------------------------------------------------
// IS THIS ITEM ON THIS DIRECTION
//
// The one rule, in one place, so the public page, the manage panes and the
// route that signs a file URL cannot answer it differently.
//
//   on(L) = (scope 'all' OR a row for L exists) AND NOT (that row is hidden)
//
// An item that says 'all' needs no row to be here - that is the whole point of
// the flag, and it is what keeps a direction created tomorrow showing it. A
// row still matters for such an item: it carries where it sits and whether it
// leads, and a hidden row is how one direction takes an all-directions item
// off without the item ceasing to be one.
//
// An item that says 'selected' is here only if it holds a row. With no rows
// at all it is on no direction, which is where deleting a direction leaves
// something that was only on that one.
// ---------------------------------------------------------------------------
// Membership on its own, with no view on whether the direction is currently
// showing it. This is the half the manage panels want, and they want it
// without the hidden test: an item turned off here is precisely the one whose
// switch has to stay in front of the owner, and it still holds a position in
// this direction to drag. It is also the question the route asks before it
// materialises, so a panel that derives from this cannot offer a control over
// a row the route would refuse to find.
export function placedOnDirection(item, rowsForLens) {
  return item?.placement_scope === 'all' || Boolean(rowsForLens?.get?.(item?.id))
}

// ---------------------------------------------------------------------------
// WHICH DIRECTIONS EACH ITEM IS ON
//
// The manage panels ask this of every item at once, so it is built as one
// lookup rather than asked again per switch.
//
// `pickable` is the set of directions the answer is allowed to name: the ones
// the direction picker offers. The panels write the whole membership back
// through the route the picker uses, so an answer naming anything else would
// either drop the item from a direction nobody touched or pin it to one no
// control on the page can see.
//
// An item on 'all' is on every one of them without a row to say so, which is
// the whole point of the flag - so it answers with the full set rather than
// with the rows it happens to hold.
// ---------------------------------------------------------------------------
export function directionsByItem(items, placements, itemKey, pickable) {
  const allowed = pickable instanceof Set ? pickable : new Set(pickable || [])
  const rowed = new Map()
  for (const row of Array.isArray(placements) ? placements : []) {
    if (!row || !allowed.has(row.lens_id)) continue
    const held = rowed.get(row[itemKey])
    if (held) held.push(row.lens_id)
    else rowed.set(row[itemKey], [row.lens_id])
  }

  const every = [...allowed]
  const out = new Map()
  for (const item of Array.isArray(items) ? items : []) {
    out.set(item?.id, item?.placement_scope === 'all' ? every : (rowed.get(item?.id) || []))
  }
  return out
}

export function onDirection(item, rowsForLens) {
  if (rowsForLens?.get?.(item?.id)?.hidden === true) return false
  return placedOnDirection(item, rowsForLens)
}

// ---------------------------------------------------------------------------
// WHAT A DIRECTION SHOWS, IN ORDER
//
// Two groups, never interleaved, because their positions are not on the same
// scale. Items with a row for this direction sit where the row says. Items
// here only by being 'all', with no row yet, follow behind in the order they
// arrived - which for evidence is the collection's own sort_order and for
// testimonials is the generated ranking passed as `order`.
//
// A direction nobody has arranged has no rows at all, so the first group is
// empty and the whole section reads in that default order. The first reorder,
// hide or star materialises rows for everything then on screen, after which
// the first group is the section and the second is whatever has been added
// since. That is why a new 'all' item appends at the end rather than landing
// in the middle of an order somebody chose.
// ---------------------------------------------------------------------------
// `includeHidden` is the owner's reading rather than a reader's. Hiding is a
// switch, and a switch has to be in front of somebody to be turned back on, so
// the manage panes ask for the items this direction has hidden as well as the
// ones it shows. The public page never passes it.
export function selectForDirection(items, rowsForLens, { order = null, includeHidden = false } = {}) {
  const here = (Array.isArray(items) ? items : []).filter(item =>
    includeHidden ? placedOnDirection(item, rowsForLens) : onDirection(item, rowsForLens)
  )
  const rowed = []
  const loose = []
  for (const item of here) {
    if (rowsForLens?.get?.(item.id)) rowed.push(item)
    else loose.push(item)
  }
  rowed.sort((a, b) =>
    (rowsForLens.get(a.id)?.sort_order ?? 0) - (rowsForLens.get(b.id)?.sort_order ?? 0)
  )
  return [...rowed, ...rankByIds(loose, order)]
}

// ---------------------------------------------------------------------------
// A ranking by id, with everything it does not mention kept behind in the
// order it already had. Shared by the testimonial ordering below and by the
// tail of selectForDirection, which want the same thing of different lists.
// ---------------------------------------------------------------------------
function rankByIds(items, order) {
  const list = Array.isArray(items) ? items : []
  const ranking = Array.isArray(order) ? order : []
  if (list.length === 0 || ranking.length === 0) return list

  const byId = new Map(list.map(item => [item?.id, item]))
  const ranked = []
  const placed = new Set()
  for (const id of ranking) {
    if (placed.has(id)) continue
    const item = byId.get(id)
    if (!item) continue
    ranked.push(item)
    placed.add(id)
  }
  return [...ranked, ...list.filter(item => !placed.has(item?.id))]
}

export function orderTestimonials(testimonials, order) {
  return rankByIds(testimonials, order)
}

// The bio arrives as one block at one volume. Its first sentence is the thesis
// and what follows is the evidence for it, so the two are set apart rather than
// rewritten: this decides only where the stored text divides, never what it
// says, and lead plus rest is always the whole of what came in. A bio of one
// sentence returns an empty rest and the detail block simply does not render.
//
// The lookahead is what keeps "$1.5M" and "Jan. 2006" from reading as sentence
// ends. A real one is terminal punctuation, then a space, then the start of
// something new.
export function splitLeadSentence(text) {
  const full = String(text || '').trim()
  if (!full) return { lead: '', rest: '' }
  const match = full.match(/[.!?]["')\]]?\s+(?=[A-Z("'[])/)
  if (!match) return { lead: full, rest: '' }
  const cut = match.index + match[0].length
  return { lead: full.slice(0, cut).trim(), rest: full.slice(cut).trim() }
}

// A display cap only. The generation prompt asks for four sentences; anything
// written before that tightened still needs to fit the column without burying
// the sections under it. Cuts on a sentence, never mid thought, and returns
// null when there is no sentence break to cut on so nothing is ever mangled.
export const BIO_COLLAPSE_AT = 600

// How many directions the rail holds. The public route caps what it sends to
// the same number, so this is not the thing enforcing it - what it decides is
// how many positions are left for the ghost tabs that offer a direction the
// owner has not turned on yet.
export const LENS_RAIL_SLOTS = 3

export function truncateAtSentence(text, limit) {
  const full = String(text || '')
  if (full.length <= limit) return null
  const window = full.slice(0, limit)
  const cut = Math.max(window.lastIndexOf('.'), window.lastIndexOf('!'), window.lastIndexOf('?'))
  if (cut === -1) return null
  return full.slice(0, cut + 1)
}

// Resume dates arrive in whatever shape the builder stored them: "2025-03",
// "2025-03-01", "March 2025", a bare year. A profile is the wrong place to show
// a recruiter something that reads like a database column, so each end is
// normalised to "Mar 2025", and anything unrecognised passes through untouched
// rather than mangled.
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_LOOKUP = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10,
  dec: 11, december: 11
}

export function formatResumeDate(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  if (/^(present|current|now|ongoing|to date)$/i.test(text)) return 'Present'

  // 2025-03, 2025-03-01, 2025/03
  const yearFirst = text.match(/^(\d{4})[-/](\d{1,2})(?:[-/]\d{1,2})?$/)
  if (yearFirst) {
    const month = Number(yearFirst[2]) - 1
    if (month >= 0 && month <= 11) return `${MONTH_NAMES[month]} ${yearFirst[1]}`
  }

  // 03/2025, 3-2025
  const monthFirst = text.match(/^(\d{1,2})[-/](\d{4})$/)
  if (monthFirst) {
    const month = Number(monthFirst[1]) - 1
    if (month >= 0 && month <= 11) return `${MONTH_NAMES[month]} ${monthFirst[2]}`
  }

  // March 2025, Mar. 2025
  const named = text.match(/^([A-Za-z]+)\.?\s+(\d{4})$/)
  if (named) {
    const month = MONTH_LOOKUP[named[1].toLowerCase()]
    if (month !== undefined) return `${MONTH_NAMES[month]} ${named[2]}`
  }

  return text
}

// Experience rows keep their dates in two fields plus a `current` flag, and the
// field names have drifted over the life of the builder. Some rows carry the
// whole range as one written string instead, so that is split on its dash and
// each end formatted the same way. A role with no date at all reads better as
// an empty column than as a stray dash.
export function dateRangeFor(job) {
  const start = formatResumeDate(job?.startDate || job?.start_date)
  const end = job?.current || job?.is_current
    ? 'Present'
    : formatResumeDate(job?.endDate || job?.end_date)
  if (start && end) return `${start} - ${end}`
  if (start || end) return start || end

  const combined = String(job?.dates || job?.date || job?.period || '').trim()
  if (!combined) return ''
  const parts = combined.split(/\s+(?:[-\u2013\u2014]|to)\s+/i).filter(Boolean)
  if (parts.length === 2) return `${formatResumeDate(parts[0])} - ${formatResumeDate(parts[1])}`
  return formatResumeDate(combined)
}

// A role's detail has been stored under two names over the life of the builder,
// and some roles carry a written summary instead of bullets. All of it ends up
// as one list so the card does not have to care which shape it was handed. The
// summary leads, because it is the line the role is actually about, and the
// evidence act shows whatever comes first.
export function bulletsFor(job) {
  const raw = Array.isArray(job?.bullets)
    ? job.bullets
    : Array.isArray(job?.achievements)
    ? job.achievements
    : []
  const list = raw.map(b => (typeof b === 'string' ? b.trim() : '')).filter(Boolean)
  const summary = typeof job?.summary === 'string' ? job.summary.trim() : ''
  return summary ? [summary, ...list] : list
}

// Evidence is tinted and iconed by what the thing is. Anything unrecognised
// still gets a tile, just the neutral one: a link holder should never see a gap
// where a piece of evidence is meant to be. The tint itself lives in the
// stylesheet against this key, so a palette change carries it.
const KNOWN_MEDIA = new Set(['image', 'video', 'audio', 'document', 'link'])

export function mediaClassOf(item) {
  const key = String(item?.media_class || item?.kind || '').toLowerCase()
  return KNOWN_MEDIA.has(key) ? key : 'default'
}

// ---------------------------------------------------------------------------
// The name, set large.
//
// Signature wants the name to own the first screen, which only works if the
// wrap is decided rather than left to the box. One word stays on one line; two
// break after the first; anything longer keeps the first name alone and lets
// the rest run together, so "Mary Jane Watson" is two lines and never three.
// ---------------------------------------------------------------------------
export function splitDisplayName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return []
  if (parts.length === 1) return [parts[0]]
  return [parts[0], parts.slice(1).join(' ')]
}

// The longest line decides the size, so a long surname steps the whole name
// down a notch instead of overflowing or wrapping again underneath itself.
export function nameScaleFor(lines) {
  const longest = lines.reduce((max, line) => Math.max(max, line.length), 0)
  if (longest <= 6) return 'xl'
  if (longest <= 10) return 'lg'
  if (longest <= 14) return 'md'
  return 'sm'
}

// ---------------------------------------------------------------------------
// ON NO DIRECTION AT ALL
//
// Items pinned to particular directions that now hold none. Deleting the last
// direction one was on is how this happens: the rows go with the direction,
// the item stays in the library, and nothing shows it.
//
// They are listed in every direction's manage view rather than none, because
// the only thing to do with one is put it somewhere, and the place that
// offers to do that is the manage view of wherever the owner happens to be.
// ---------------------------------------------------------------------------
export function unplacedItems(items, placements, itemKey) {
  const held = new Set(
    (Array.isArray(placements) ? placements : []).map(row => row?.[itemKey]).filter(Boolean)
  )
  return (Array.isArray(items) ? items : []).filter(
    item => item?.placement_scope === 'selected' && !held.has(item?.id)
  )
}
