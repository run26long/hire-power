// ============================================================================
// READING lib/evidenceTypes.js FROM A CJS SCRIPT
//
// That file is the only thing that decides what an evidence type may be and
// which family it belongs to. Its own header says a second copy of the list
// would be a second answer to that question, and it is right, so this does not
// make one.
//
// It cannot simply be required: it is ESM (`export const`) in a package with no
// "type": "module", so Node parses it as CJS and throws on the first export. So
// the list is read out of the file as text and the entries are extracted. If
// the shape it is written in ever changes, the regex matches nothing and this
// throws immediately rather than silently falling back to a stale copy.
// ============================================================================

const fs = require('fs')
const path = require('path')

const SOURCE = path.join(__dirname, '..', '..', 'lib', 'evidenceTypes.js')

function loadTypes() {
  const src = fs.readFileSync(SOURCE, 'utf8')

  // { type: 'Case study', family: FAMILIES.WORK }
  const entry = /\{\s*type:\s*'([^']+)',\s*family:\s*FAMILIES\.([A-Z_]+)\s*\}/g
  const families = { WORK: 'work', CREDENTIALS: 'credentials', RECOGNITION: 'recognition' }

  const out = new Map()
  let m
  while ((m = entry.exec(src)) !== null) {
    const family = families[m[2]]
    if (!family) throw new Error('Unknown family constant in evidenceTypes.js: ' + m[2])
    out.set(m[1].toLowerCase(), { type: m[1], family })
  }

  if (out.size === 0) {
    throw new Error(
      'Could not read EVIDENCE_TYPES out of ' + SOURCE + '. '
      + 'The file has been rewritten in a shape this script does not recognise; '
      + 'fix the pattern here rather than hardcoding the list.'
    )
  }
  return out
}

const BY_TYPE = loadTypes()

const familyForType = (type) =>
  typeof type === 'string' ? (BY_TYPE.get(type.trim().toLowerCase())?.family ?? null) : null

const canonicalType = (type) =>
  typeof type === 'string' ? (BY_TYPE.get(type.trim().toLowerCase())?.type ?? null) : null

module.exports = { familyForType, canonicalType, BY_TYPE }
