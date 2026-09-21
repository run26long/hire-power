// The plan names, as the database spells them.
//
// This file used to also carry a FEATURES map, a TIER_FEATURES table and a
// set of hasFeatureAccess / canDownloadPDF / getTier* helpers. None of them
// had a single call site anywhere in the app - every gate in the codebase had
// been written inline instead - so they were a second, imaginary description
// of what each plan could do, sitting next to the real ones and disagreeing
// with them. They are gone. What each plan may actually do is in lib/tiers.js.
//
// 'maintenance' is a fourth tier the database writes during a change of plan.
// It is deliberately not listed here, because nothing should branch on it by
// name: lib/tiers.js groups it with Vault, which is what it is.

export const TIERS = {
  FREE: 'free',
  PRO: 'pro',
  VAULT: 'vault'
};
