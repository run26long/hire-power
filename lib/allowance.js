// ============================================================================
// THE SHARED LIFETIME ALLOWANCE
//
// Free and Vault get three job match scores and three cover letters between
// them, counted once and never reset. Pro has no ceiling, so nothing it makes
// counts against anything.
//
// WHY THE PLANS ARE NAMED HERE AND NOT ASKED OF lib/tiers
// canCreateResumes already answers "is this Pro", and the allowance is "not
// Pro", so the two are the same question from opposite sides. They are kept
// apart because this one is also a set of strings compared against a stored
// column: `created_tier` holds the plan a row was made on, and asking whether
// that plan is in the allowance is not the same as asking what the account may
// do right now. One is about a row's history, the other about a session's
// permissions, and collapsing them is how a Pro-made resume ends up counting
// against a free account's three.
//
// 'maintenance' is in the set for the reason it is in every set beside Vault:
// it is what a Vault subscription is called mid-change-of-plan, and nobody
// agreed to a different allowance by changing how they pay.
// ============================================================================

export const ALLOWANCE_TIERS = new Set(['free', 'vault', 'maintenance'])

// Was this row made on the shared allowance, and does it therefore belong in
// the Job Match Scores and Cover Letters panels?
//
// A row with no `created_tier` at all answers false, which puts it on the
// "made on Pro" side. That is deliberate: the stamp is written by a database
// trigger on insert and backfilled on every existing row, so a null means
// something wrote a row by a path the trigger does not cover, and the generous
// reading - treat it as Pro-made, leave the allowance alone, show it behind
// the "Looking for..." link - costs the owner nothing. The strict reading
// would silently eat one of their three.
export const madeOnAllowance = (row) => ALLOWANCE_TIERS.has(row?.created_tier)

// The same question asked for access rather than for counting, and it answers
// differently in one case: a row with no stamp at all.
//
// For the panels, an unstamped row is treated as Pro-made - it costs the owner
// nothing to be shown their work behind a link. For opening one, the same
// reading would lock somebody out of their own resume over a missing column,
// so here a null opens. The trigger stamps every insert and the backfill
// stamped every existing row, so a null means a path neither covers.
export const openableOnAllowance = (row) => {
  const stamp = row?.created_tier || null
  return stamp === null || ALLOWANCE_TIERS.has(stamp)
}

// How many of the three slots are spent, given what is still there and what
// the counter recorded. See the note on allowanceSlots in the hub for why this
// is floored.
export const ALLOWANCE_LIMIT = 3
