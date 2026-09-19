// ============================================================================
// WHAT TO CALL A CORE RESUME
//
// "Core Resume" says what the row is to the system and nothing at all to the
// person reading it. Somebody with a Technical Writing direction should see
// "Technical Writing Resume", because that is what the document is.
//
// Read at render, never stored. The name follows the direction: rename the
// lens and every screen showing this resume renames with it, and a user who
// has not named a direction yet simply keeps "Core Resume" until they do.
//
// WHY A RESUME IS ONLY NAMED BY A LENS THAT POINTS AT IT
//
// A direction belongs to a person; a core resume is one document. Twelve
// accounts hold more than one active core, the largest holding seven, and the
// primary direction cannot be true of all seven. Labelling them all
// "Technical Writing Resume" would not be vague, it would be wrong about six
// documents, which is worse than the generic name it replaced.
//
// So a lens names a resume when it is bound to that resume, through
// profile_lenses.core_resume_id. The one exception is an account holding a
// single core, where there is nothing to confuse it with and the direction can
// only mean that document.
//
// WHAT IS SAFE TO REPLACE
//
// Nothing in the product renames a resume, so a core's display_name is always
// one the system wrote: 'Core Resume' from the six places that create one, or
// '<Lens> Core Resume' from build-core. Both are replaced. Anything else is
// left exactly as it is, so that if renaming is ever added, a name somebody
// typed is never silently overwritten by a direction.
// ============================================================================

const GENERIC = 'core resume'

// build-core writes '<Lens> Core Resume'. That is a direction already, just in
// the older wording, so the lens name is read back out of it rather than
// treated as something a person chose.
const LENS_NAMED = /^(.+?)\s+core\s+resume$/i

function storedName(resume) {
  return typeof resume?.display_name === 'string' ? resume.display_name.trim() : ''
}

// True when the stored name is one the system wrote and may be replaced.
function isSystemNamed(name) {
  if (!name) return true
  if (name.toLowerCase() === GENERIC) return true
  return LENS_NAMED.test(name)
}

// The direction the account is heading in, as its own lens row records it.
// source 'user' with sort_order 0 is the pair ensurePrimaryLens uses as the
// primary's identity, so this asks the same question the writer answers.
export function primaryLens(lenses) {
  if (!Array.isArray(lenses)) return null
  return lenses.find(
    lens => lens?.source === 'user' && lens?.sort_order === 0 && lens?.status === 'active'
  ) || null
}

/**
 * The name to show for one core resume.
 *
 * @param {object}  resume           the resume row, needing at least id and display_name
 * @param {array}   lenses           that user's profile_lenses rows
 * @param {string}  currentLensName  career_context.current_lens_name, the fallback
 *                                   for an account with no profile yet
 * @param {number}  coreCount        how many active cores the account holds. Anything
 *                                   other than exactly 1 is treated as ambiguous, so
 *                                   an unknown count never invents a name.
 * @returns {string}
 */
export function coreResumeLabel({ resume, lenses = [], currentLensName = null, coreCount = null } = {}) {
  const stored = storedName(resume)

  // A name the system did not write is a name somebody chose. Leave it.
  if (!isSystemNamed(stored)) return stored

  // "Core Resume - Technical Writing" rather than "Technical Writing Resume".
  // The kind of document leads and the direction qualifies it, so a list of
  // somebody's cores reads down a common stem instead of down whatever their
  // directions happen to be called. With no direction the stem stands alone:
  // no dash, no trailing space.
  const direction = resolveDirection({ resume, lenses, currentLensName, coreCount, stored })
  return direction ? `Core Resume - ${direction}` : 'Core Resume'
}

function resolveDirection({ resume, lenses, currentLensName, coreCount, stored }) {
  const list = Array.isArray(lenses) ? lenses : []

  // 1. A lens bound to this exact resume. The strongest signal there is: it
  //    names this document rather than the account.
  const bound = resume?.id
    ? list.find(lens => lens?.core_resume_id && lens.core_resume_id === resume.id)
    : null
  if (bound?.name) return String(bound.name).trim()

  // 2. The direction already inside the stored name, from build-core. Kept
  //    ahead of the primary because it is about this document, where the
  //    primary is about the account.
  const fromStored = stored.match(LENS_NAMED)
  if (fromStored?.[1]) return fromStored[1].trim()

  // 3. One core and nothing to confuse it with, so the account's direction can
  //    only mean this document. With more than one core, or an unknown number,
  //    there is no way to tell which one it is about, and a wrong name is worse
  //    than a plain one.
  if (coreCount === 1) {
    const primary = primaryLens(list)
    if (primary?.name) return String(primary.name).trim()
    const contextName = typeof currentLensName === 'string' ? currentLensName.trim() : ''
    if (contextName) return contextName
  }

  return null
}
