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

// The sentences the Settings drawer still says in a box of its own, per
// feature rather than shared: "upgrade to customise your profile" beside the
// Career Directions list does not tell anybody what they would be able to do.
export const UPGRADE_COPY = {
  // ---- WHAT IS LEFT, AND WHY THE REST WENT ----
  //
  // There used to be a line here per gated field: the bio, the headline,
  // the proof points, the Open to tags, evidence, the portfolio,
  // testimonials and both halves of In My Own Words. None of them is a
  // sentence the profile needs any more.
  //
  // Half of those fields are not gated at all now - a free account writes
  // its own headline, About, proof points, Open to tags and In My Own
  // Words. The other half is gated on the control rather than beside it:
  // every pencil, Manage, Add and Request shows on every plan and a gated
  // press opens the upgrade modal, so the offer is on the thing it is
  // about instead of in a box under it. What the sections the plan hides
  // say is one chip beside the title, identical in all three, and it is a
  // statement rather than an offer - see SectionHiddenChip in the profile's
  // affordances.
  //
  // Two left, and both are in the same place: the Settings drawer's Career
  // Directions block, where adding one is still Pro. The Contact line went
  // with its box - every plan sets a contact address now, and the switch
  // beside it is how the button is turned off.
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
