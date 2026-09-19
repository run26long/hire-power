// ============================================================================
// WHICH CORE RESUMES ARE REAL
//
// A row in `resumes` with resume_type 'core' is not necessarily a core resume
// anybody has. Starting the chat flow and walking away writes one, and thirty
// of the eighty-five active core rows are exactly that: created_via
// 'resume_chat', never finished, unnamed, no direction attached. The hub has
// never shown them and cannot switch to them.
//
// So the test is: anything that did not come from the chat flow, plus the chat
// ones that were finished. It is the test /api/resume-coach/data already
// applied inline when picking the core to open with, lifted out here so the
// build limit counts the same resumes the page displays.
//
// WHY NOT coaching_complete ALONE
// Because it answers a different question - whether the coaching step was
// finished, not whether the resume is real. Most people's main core is an
// upload sitting at 'review' or 'assess' and has never been coached; the test
// profile's own priority core has coaching_complete false. Counting on that
// flag alone found one core for an account that plainly has two, which is how
// a limit of three let a fourth through.
// ============================================================================

export function isRealCore(resume) {
  if (!resume) return false
  return resume.created_via !== 'resume_chat' || resume.coaching_complete === true
}

// The ceiling on cores, and on the directions that can hold them: the hub has
// three tiles and every one of them can be a resume.
export const MAX_CORES = 3
