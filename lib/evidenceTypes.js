// ============================================================================
// WHAT A PIECE OF EVIDENCE IS
//
// The list the owner chooses from, and the family each choice belongs to.
//
// WHY FAMILY IS DERIVED AND NOT ASKED
// Because "is a patent Recognition or Credentials?" is a question about this
// product's taxonomy, not about the owner's work, and making somebody answer it
// is making them guess at our filing system. They know what the thing is; the
// family follows from that. It also means the two can never disagree, which
// they would the moment a form offered both as separate dropdowns.
//
// WHY THE ROUTE AND THE FORM SHARE THIS FILE
// profile_evidence.family is constrained by the database to work, credentials
// or recognition - I confirmed it rejects anything else. evidence_type is not
// constrained at all and accepts any string. So this list is the only thing
// that decides what an evidence type may be, and a second copy of it in the
// form would be a second answer to that question.
//
// The strings are stored as written. They are what the profile prints under a
// tile, so they are set in the case a reader should see rather than as slugs
// that would need mapping back.
// ============================================================================

export const FAMILIES = {
  WORK: 'work',
  CREDENTIALS: 'credentials',
  RECOGNITION: 'recognition'
}

// Ordered as the dropdown shows them: grouped by family, most common first
// inside each group.
export const EVIDENCE_TYPES = [
  { type: 'Case study', family: FAMILIES.WORK },
  { type: 'Work sample', family: FAMILIES.WORK },
  { type: 'Project', family: FAMILIES.WORK },
  { type: 'Report', family: FAMILIES.WORK },
  { type: 'Presentation', family: FAMILIES.WORK },

  { type: 'Certification', family: FAMILIES.CREDENTIALS },
  { type: 'License', family: FAMILIES.CREDENTIALS },
  { type: 'Training certificate', family: FAMILIES.CREDENTIALS },

  { type: 'Award', family: FAMILIES.RECOGNITION },
  { type: 'Publication', family: FAMILIES.RECOGNITION },
  { type: 'Patent', family: FAMILIES.RECOGNITION },
  { type: 'Press coverage', family: FAMILIES.RECOGNITION },
  { type: 'Podcast/interview', family: FAMILIES.RECOGNITION }
]

const BY_TYPE = new Map(EVIDENCE_TYPES.map(t => [t.type.toLowerCase(), t]))

// Null for anything not on the list. The route treats that as a rejection
// rather than falling back to a family, because a piece of evidence filed
// under a family nobody chose is worse than one the owner is asked to re-file.
export function familyForType(type) {
  if (typeof type !== 'string') return null
  return BY_TYPE.get(type.trim().toLowerCase())?.family ?? null
}

// The stored spelling for a type the owner picked, so case and spacing from a
// hand-built request cannot produce two labels for one thing.
export function canonicalType(type) {
  if (typeof type !== 'string') return null
  return BY_TYPE.get(type.trim().toLowerCase())?.type ?? null
}

export const FAMILY_LABELS = {
  [FAMILIES.WORK]: 'Work',
  [FAMILIES.CREDENTIALS]: 'Credentials',
  [FAMILIES.RECOGNITION]: 'Recognition'
}

// ---------------------------------------------------------------------------
// How a link is classified.
//
// media_class is constrained by the database to image, video, audio, document,
// link, embed or other. A pasted URL is a link unless it is from a provider the
// profile can actually embed - and that set is the viewer's, not a new one:
// EvidenceViewer only ever renders an iframe for these two, so promoting
// anything else to 'embed' would produce a tile that says it can be played and
// then cannot be.
// ---------------------------------------------------------------------------
const EMBED_PROVIDERS = [
  { provider: 'youtube', hosts: ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'] },
  { provider: 'vimeo', hosts: ['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'] }
]

export function providerForUrl(url) {
  let host
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
  return EMBED_PROVIDERS.find(p => p.hosts.includes(host))?.provider ?? null
}
