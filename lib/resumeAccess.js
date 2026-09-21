import { canAccessBuiltWork } from './tiers'

// ============================================================================
// WHICH RESUME MAY THIS ACCOUNT OPEN
//
// A free account keeps one core resume. Not "a core resume" - one specific
// one, because an account that was on Pro and lapsed may hold three, and
// which of the three it keeps has to be the same answer everywhere or the
// hub, the editor and the PDF route will each pick a different resume and
// disagree about what is locked.
//
// The answer is the one the hub already opens on: the flagged priority core,
// and the newest core otherwise. That rule was written inline in
// /api/resume-coach/data and in the resume page's breadcrumb loader; this is
// the same rule, in one place, so the gates can share it.
//
// Everything else a free account holds - additional cores, every
// job-specific resume - is visible and locked. Visible because it is theirs
// and deleting it for them would be worse; locked because building it is
// what the plan is for.
//
// Pure functions over rows, deliberately: the server hands them database
// rows and the client hands them the same rows out of its own state, and
// neither needs a Supabase client to ask the question.
// ============================================================================

// The hub's ordering: flagged first, newest next. Written as a comparator
// rather than relying on the caller having sorted, because two of the three
// call sites receive rows in whatever order their query returned.
const byPriorityThenNewest = (a, b) =>
  (b?.is_priority_core === true) - (a?.is_priority_core === true) ||
  String(b?.created_at || '').localeCompare(String(a?.created_at || ''))

export function freeCoreId(resumes = []) {
  const cores = (resumes || []).filter(
    r => r && r.resume_type === 'core' && r.is_active !== false
  )
  if (cores.length === 0) return null
  return [...cores].sort(byPriorityThenNewest)[0].id
}

// `resumes` is every resume row the account holds, or at least every core;
// without the cores there is no way to know which one is the kept one, so a
// caller that cannot supply them gets a refusal rather than a guess.
export function canOpenResume(tier, resume, resumes = []) {
  if (!resume) return false
  if (canAccessBuiltWork(tier)) return true
  if (resume.resume_type !== 'core') return false
  return resume.id === freeCoreId(resumes)
}

// What the lock says. One sentence per reason, because "upgrade" under a
// greyed-out resume does not tell anybody what they would get.
export const LOCK_COPY = {
  extra_core: 'Your other core resumes are part of Vault and Pro.',
  job_specific: 'Job-specific resumes are part of Vault and Pro.',
  default: 'This resume is part of Vault and Pro.'
}

export const lockReason = (resume) =>
  !resume ? 'default' : resume.resume_type === 'job_specific' ? 'job_specific' : 'extra_core'
