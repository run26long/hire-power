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

// ---------------------------------------------------------------------------
// HOW MANY CAREER DIRECTIONS A PROFILE SHOWS
//
// The same set of tiers, asked as a different question, and named separately
// because the two will not always be the same question: free shows the
// primary direction and nothing else, Vault and Pro show every active one.
//
// NOTHING IS TAKEN AWAY TO MAKE THAT TRUE
// The other directions, their headlines, bios, proof points, evidence and
// testimonial placements all stay exactly where they are. This is a question
// asked when a page is read, not a thing done to an account when its plan
// changes - so a profile answers it correctly the moment the tier moves, in
// either direction, with nothing to run and nothing to undo. An upgrade puts
// them all back by itself.
// ---------------------------------------------------------------------------
export const canShowAllDirections = (tier) => CUSTOMISING_TIERS.has(tier)

// ---------------------------------------------------------------------------
// WHERE AN UPGRADE PROMPT POINTS
//
// Two pairs, because two different things are being offered.
//
// The Vault pair is re-exported by lib/tiers.js and read by the Vault upsell
// modal and the resume page, which are selling Vault deliberately - to
// somebody who has lapsed from Pro and is being offered the cheap plan that
// keeps their work rather than the expensive one that builds more of it.
// Nothing on the Career Profile uses it.
//
// The Pro pair is what the Career Profile shows. Every gate on that page is
// an offer to build something new - a second direction, your own bio, your
// own evidence - and building is Pro. Offering Vault there was offering the
// plan that does not do the thing the prompt is standing next to.
//
// Both are links to a real page rather than modals: the management page is
// the profile itself with controls over it, and a dialog over a document the
// owner is reading is the wrong shape for "there is more available". The Pro
// one lands on /profile?upgrade=true, which that page already handles by
// opening the Pro checkout modal - the same modal its own "Upgrade to Pro"
// buttons open.
// ---------------------------------------------------------------------------
export const UPGRADE_HREF = '/profile?plan=vault'
export const UPGRADE_LABEL = 'Upgrade to Vault'

export const PRO_UPGRADE_HREF = '/profile?upgrade=true'
export const PRO_UPGRADE_LABEL = 'Upgrade to Pro'

// The sentence each gate uses. Written per feature rather than shared, because
// "upgrade to customise your profile" under a testimonial list does not tell
// anybody what they would be able to do.
export const UPGRADE_COPY = {
  bio: 'Upgrade to Pro to write your own bio.',
  headline: 'Upgrade to Pro to write your own headline.',
  proof_points: 'Upgrade to Pro to choose your own proof points.',
  // Act I carries two editable fields in one composition, so it gets one line
  // rather than two stacked under the same figure.
  identity: 'Upgrade to Pro to edit your headline and proof points.',
  // Saying it in their own words is no longer the gated part - a free
  // account writes this section itself. What is gated is having it written
  // for them, and the video, so this is what the lock beside the AI control
  // in Tell your story says.
  imow: 'Upgrade to Pro to have us draft and polish this for you.',
  // The other half of In My Own Words. Its own line rather than the one
  // above, because the two things still gated in that section are gated for
  // different reasons and stand in different places: the AI control is in the
  // footer of the written tab, this is under the locked tile on the video tab.
  imow_video: 'Upgrade to Pro to speak to employers on video.',
  ready_tags: 'Upgrade to Pro to set what you are open to.',
  evidence: 'Upgrade to Pro to add evidence of your work.',
  portfolio: 'Upgrade to Pro to add your visual work.',
  testimonial: 'Upgrade to Pro to request testimonials.',
  contact: 'Upgrade to Pro to add a contact address.',
  // Adding a direction is customising; taking one off never is, so this says
  // what is unavailable rather than implying the whole section is.
  // The one line here that does not point at Vault, because the thing it
  // describes is not a Vault feature. Turning on a direction that has never
  // been published is building, and building is Pro; Vault restores a
  // direction it took down, which is a different act with a different answer
  // and its own sentence below. This used to promise Vault an ability Vault
  // does not have.
  lenses: 'Your primary Career Direction shows on your Career Profile. Adding another is part of Pro.',
  // Shown to a Vault account, which may restore what it had and may not add
  // to it.
  lenses_vault: 'The Career Directions you built stay yours, and you can turn any of them back on. Adding a new one is part of Pro.',
  default: 'Upgrade to Pro to customize your profile.'
}

export const upgradeCopyFor = (key) => UPGRADE_COPY[key] || UPGRADE_COPY.default
