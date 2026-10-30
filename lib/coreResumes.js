// ============================================================================
// WHICH CORE RESUMES ARE REAL
//
// A row in `resumes` with resume_type 'core' is not necessarily a core resume
// anybody has. Starting the chat flow and walking away writes one, and thirty
// of the eighty-five active core rows are exactly that: created_via
// 'resume_chat', never finished, unnamed. The hub has never shown them and
// cannot open them.
//
// So the test is: anything that did not come from the chat flow, plus the chat
// ones that were finished. It is the test /api/resume-coach/data already
// applied inline when picking the core to open with, lifted out here so every
// gate counts the same resumes the page displays.
//
// WHY NOT coaching_complete ALONE
// Because it answers a different question - whether the coaching step was
// finished, not whether the resume is real. Most people's main core is an
// upload sitting at 'review' or 'assess' and has never been coached; the test
// profile's own core has coaching_complete false. Counting on that flag alone
// found one core for an account that plainly has two.
//
// WHAT IT IS FOR NOW
// There is one core resume per account. This is what "already has one" means:
// an unfinished chat row is not a core somebody has, so an account holding
// nothing else is still an account with no resume, and the hub still offers to
// start one. Everything that creates a core asks hasRealCore first.
// ============================================================================

export function isRealCore(resume) {
  if (!resume) return false
  return resume.created_via !== 'resume_chat' || resume.coaching_complete === true
}

/**
 * Does this account already hold its one core resume?
 *
 * Rows rather than a head count, because the test is a disjunction and
 * expressing it as a filter invites the database's NULL semantics to differ
 * from the JavaScript. There are at most a handful of core rows per account.
 *
 * A failed lookup answers false. The failure mode of guessing "no" is a second
 * core row that the migration's own rule would archive; the failure mode of
 * guessing "yes" is somebody with no resume at all being told they already
 * have one, with no way forward from the empty state. The recoverable one
 * wins.
 *
 * @param {object} supabase a client that can read this user's resumes
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
export async function hasRealCore(supabase, userId) {
  if (!supabase || !userId) return false
  const { data, error } = await supabase
    .from('resumes')
    .select('id, created_via, coaching_complete')
    .eq('user_id', userId)
    .eq('resume_type', 'core')
    .eq('is_active', true)

  if (error) {
    console.error('Core resume check failed:', error)
    return false
  }
  return (data || []).some(isRealCore)
}

// What to say when somebody reaches a second one. One sentence, because
// "you already have a core resume" without the way out is a dead end.
export const ONE_CORE_MESSAGE =
  'You already have a Core Resume. Archive it first to start a new one.'
