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
export function orderTestimonials(testimonials, order) {
  const list = Array.isArray(testimonials) ? testimonials : []
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
