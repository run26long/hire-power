// ============================================================================
// WHO MAY CUSTOMISE A CAREER PROFILE
//
// A free account gets the profile its coaching sessions produced, and can read
// it, preview it, share its link and download the resume behind it. What it
// cannot do is put its own words or files into it.
//
// WHY THIS IS NOT isEntitledTier
// That predicate is Pro only, and says so on purpose: Vault is a separate tier
// rather than a smaller Pro, so it is deliberately not swept into the Pro
// tools. Customising a profile is a different question with a different
// answer - Vault pays to keep a career on file, and a career on file that
// cannot be edited is a filing cabinet. So there are two questions here, and
// this is the second one. Reusing the first would have locked every Vault
// account out of its own profile.
//
// maintenance is included for the same reason the nav treats it as a Vault
// tier: it is what a Vault subscription is called after a change of plan, and
// somebody mid-transition has not agreed to lose the ability to edit.
//
// ANYTHING UNRECOGNISED IS FREE
// Including null, undefined and a tier this build has never heard of. The
// failure mode of guessing generously is a free account editing a paid
// feature; the failure mode of guessing strictly is a paying account seeing an
// upgrade prompt, which is visible, reportable and fixable. Strict wins.
// ============================================================================

const CUSTOMISING_TIERS = new Set(['pro', 'vault', 'maintenance'])

export const canCustomiseProfile = (tier) => CUSTOMISING_TIERS.has(tier)

// What the inline prompts say and where they point. One place, because six
// sections show this and six slightly different sentences would read as six
// different rules.
//
// It is a link to a real page rather than a modal: the management page is the
// profile itself with controls over it, and a dialog over a document the owner
// is reading is the wrong shape for "there is more available".
export const UPGRADE_HREF = '/profile?plan=vault'
export const UPGRADE_LABEL = 'Upgrade to Vault'

// The sentence each gate uses. Written per feature rather than shared, because
// "upgrade to customise your profile" under a testimonial list does not tell
// anybody what they would be able to do.
export const UPGRADE_COPY = {
  bio: 'Upgrade to Vault to write your own bio.',
  headline: 'Upgrade to Vault to write your own headline.',
  proof_points: 'Upgrade to Vault to choose your own proof points.',
  // Act I carries two editable fields in one composition, so it gets one line
  // rather than two stacked under the same figure.
  identity: 'Upgrade to Vault to edit your headline and proof points.',
  imow: 'Upgrade to Vault to say this in your own words.',
  ready_tags: 'Upgrade to Vault to set what you are open to.',
  evidence: 'Upgrade to Vault to add evidence of your work.',
  portfolio: 'Upgrade to Vault to add your visual work.',
  testimonial: 'Upgrade to Vault to request testimonials.',
  contact: 'Upgrade to Vault to add a contact address.',
  // Adding a direction is customising; taking one off never is, so this says
  // what is unavailable rather than implying the whole section is.
  lenses: 'Your primary career direction shows on your Career Profile. Upgrade to Vault to add another.',
  default: 'Upgrade to Vault to customize your profile.'
}

export const upgradeCopyFor = (key) => UPGRADE_COPY[key] || UPGRADE_COPY.default
