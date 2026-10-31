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

// ============================================================================
// ONE FULL COACHING SESSION, EVER
//
// Outside Pro, the core resume gets coached once. Not once per resume - once
// per account, for good.
//
// WHY ARCHIVED ROWS COUNT
// Archiving a core and starting another one is the obvious way round a
// per-resume limit, and it costs nothing: the hub's own delete button archives
// rather than deletes. So the question is asked of every core row the account
// has ever had, whatever its is_active, and the answer does not come back.
//
// WHY coaching_complete AND NOT isRealCore
// These are the two different questions this file is about. isRealCore asks
// whether a row is a resume somebody has; this asks whether a coaching
// conversation was finished. An upload sitting at 'review' is a real core that
// has used no coaching, and a chat attempt that was coached to the end has
// used it even though it was abandoned afterwards.
// ============================================================================

/**
 * Has this account already finished a core coaching session?
 *
 * A failed lookup answers false, for the reason hasRealCore does: the cost of
 * guessing wrong in this direction is a session somebody was not strictly
 * owed, which is recoverable; the cost of guessing the other way is telling
 * somebody they have used something they have not, with no way past it.
 *
 * @param {object} supabase a client that can read this user's resumes
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
export async function hasUsedCoreCoaching(supabase, userId) {
  if (!supabase || !userId) return false
  const { count, error } = await supabase
    .from('resumes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('resume_type', 'core')
    .eq('coaching_complete', true)

  if (error) {
    console.error('Core coaching check failed:', error)
    return false
  }
  return (count ?? 0) > 0
}

// Pro is what lifts it, not Vault: this is a new thing being made rather than
// an old thing being kept, which is the line Vault sits on the other side of.
export const CORE_COACHING_USED_MESSAGE =
  "You've used your core resume coaching. Upgrade to Pro to coach again."

// What the refusal above does NOT take away, said in both places that
// refusal appears - under the Assess step's button and under the Coach
// step's lock panel. One constant for the same reason the sentence above is
// one: two copies of a reassurance are two things that can drift.
//
// It is worth saying at all because the lock is on the step rail, which
// reads as the page being closed: the toolbar is untouched, the editor still
// writes, and Download still works. Somebody who cannot coach again can
// still do everything else this page does.
export const CORE_COACHING_STILL_CAN =
  'You can still edit, save, and download your resume on this page.'
