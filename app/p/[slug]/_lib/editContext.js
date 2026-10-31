'use client'

import { createContext, useContext, useMemo } from 'react'

// ============================================================================
// EDIT MODE
//
// The seam between the document and the people allowed to change it.
//
// ProfileDocument draws the same composition for a recruiter and for its owner.
// What differs is whether edit affordances are laid over it, and that is a
// property of the surrounding route rather than of the document: the public
// route never provides this context, so `useProfileEdit()` returns null there
// and every affordance is compiled out of the render by a falsy check.
//
// WHY NULL RATHER THAN `{ editing: false }`
// Because a default object is a thing that can be got wrong. A missing
// provider and a provider that says "not editing" would look identical at the
// call site, and the failure mode of getting it backwards is edit controls on
// somebody's public profile. Null cannot be mistaken for permission.
//
// THE RULE THIS CARRIES
// A section with no content is not rendered on the public page - to anybody,
// owner included. Edit mode is the sole exception: an empty section has to be
// visible to be filled. So `editing` is the only thing that may open an empty
// section, and it is false in preview, which is why preview is a true preview.
//
// WHAT THE VALUE HOLDS
//   editing      true while the owner is editing rather than previewing
//   lensId       the direction currently on screen; every save names it
//   openField    which field has its editor open, or null. One at a time:
//                two open editors on one direction can disagree about what
//                the stored record says, and the second save wins silently
//   open/close   to change that
//   save         (fields) => Promise, resolving false when it failed
//   regenerate   () => Promise, resolving to newly written text for the field
//                or null when it failed. It writes nothing: the editor stays
//                open and the text arrives as a draft the owner can keep,
//                change, or walk away from
//   busy         the field currently doing work, or null
//   busyKind     what that work is: 'save' or 'draft'. The two look the same
//                to the field and read very differently on a button
//   error        the last failure, as a sentence, or null
//   isPro        the account's tier, which is one half of whether
//                regeneration is offered; the other half is how many
//                directions there are
// ============================================================================

const ProfileEditContext = createContext(null)

export function ProfileEditProvider({ value, children }) {
  // The consumers are section components that re-render on every direction
  // change; an identity-stable value keeps that from cascading further.
  const memoed = useMemo(() => value, [value])
  return (
    <ProfileEditContext.Provider value={memoed}>
      {children}
    </ProfileEditContext.Provider>
  )
}

// Null outside an editor. Call sites read it as `edit?.editing`, so the public
// page needs no knowledge that edit mode exists at all.
export function useProfileEdit() {
  return useContext(ProfileEditContext)
}

// The question nearly every section actually asks: may I show something that
// has no content yet? Never on the public page, never in preview.
export function useCanShowEmpty() {
  return useContext(ProfileEditContext)?.editing === true
}

// May this account put its own words and files into the profile?
//
// Two questions live here, and they are deliberately separate. `editing` is
// "is this the management page" - false on the public page and in preview, so
// no gate below has to remember to check it. `canCustomise` is "does this
// account's plan include changing what the coaching produced".
//
// A free account still sees everything its sessions generated, and still
// reaches preview, the public link and the resume. What it loses is the
// controls that would write something new, and in their place it gets a line
// saying what the plan would add. Returns null when there is no provider at
// all, so a missing context can never be read as permission.
export function useCanEdit() {
  const edit = useContext(ProfileEditContext)
  if (!edit || edit.editing !== true) return false
  return edit.canCustomise === true
}

// ---------------------------------------------------------------------------
// THE SAME QUESTION, ASKED ABOUT ONE FIELD
//
// useCanEdit above is the plan's answer for the profile as a whole, and it is
// still the right question for almost everything: the headline, the bio, the
// proof points, the evidence and the testimonials all arrive written or
// collected, and refining them is what the plan is for.
//
// In My Own Words is the exception, and it is an exception about the content
// rather than about the price. It is the only part of the profile that arrives
// empty, because it is the only part only the person can supply - so a free
// profile without it is not a profile with a feature locked, it is a profile
// missing the paragraph a recruiter would have read in their voice. The server
// agrees: PATCH /api/career-profile/imow is the one write route on this
// profile with no requireCustomise in front of it.
//
// What free still does not get is the writing done for it. The AI controls in
// that dialog are gated on canUseProfileTools, and ./generate and ./strengthen
// both refuse free outright. Video is Pro and Vault, as it was.
//
// A set rather than a flag on each call site, so there is one list and anybody
// reading it can see how short it is.
// ---------------------------------------------------------------------------
// Everything the owner writes themselves. A free account types its own
// headline, its own About, its own proof points, its own Open to tags and
// its own In My Own Words - the profile is theirs and the words in it are
// not what the plan is for. What the plan is for is having them written:
// every AI control in these editors is still gated, and the routes behind
// those controls still refuse free outright.
//
// ready_for_next is deliberately absent. It is written by the same route as
// the four above and is not one of them, so that route checks per field.
const FREE_WRITABLE = new Set(['imow', 'headline', 'bio', 'proof_points', 'ready_tags'])

export function useCanEditField(field) {
  const edit = useContext(ProfileEditContext)
  if (!edit || edit.editing !== true) return false
  if (edit.canCustomise === true) return true
  return FREE_WRITABLE.has(field)
}

// The way a gated control asks for the upgrade modal. One channel, so every
// locked pencil, Manage, Add and Request on this page opens the same modal
// as the settings drawer, and no section has to know how to build one.
//
// A no-op when nothing is wired, for the same reason notify is: a control
// that cannot explain itself must still not throw when pressed.
export function useShowUpgradeModal() {
  const edit = useContext(ProfileEditContext)
  return edit?.onShowUpgrade || (() => {})
}

// True where a control exists but this plan cannot use it. The control is
// still rendered on every plan, so this decides what pressing it does, not
// whether it is there.
export function useIsGated() {
  const edit = useContext(ProfileEditContext)
  return Boolean(edit?.editing === true && edit.canCustomise !== true)
}

// How anything on this page reports that something failed. One channel, so a
// failure looks the same wherever it happened, and so no component has to own
// a corner of the screen to say so. A missing provider is a no-op rather than
// a crash: reporting an error must never be the thing that throws.
export function useNotify() {
  const edit = useContext(ProfileEditContext)
  return edit?.notify || (() => {})
}

// Everything one field's editor needs, without each of them reaching into the
// context and reimplementing the same four checks. Returns null when there is
// no editor, so a section can call it unconditionally and render nothing.
export function useFieldEditor(field) {
  const edit = useProfileEdit()
  if (!edit?.editing) return null
  return {
    isOpen: edit.openField === field,
    open: () => edit.open(field),
    close: edit.close,
    save: (values) => edit.save(values, field),
    regenerate: () => edit.regenerate(field),
    busy: edit.busy === field,
    // The two halves of busy, so a control can say what is actually happening
    // rather than that something is. Save calling itself "Saving…" because a
    // regeneration was running was a button lying about a database write.
    saving: edit.busy === field && edit.busyKind === 'save',
    working: edit.busy === field && edit.busyKind === 'draft',
    // A failure belongs to the field that caused it, not to whichever editor
    // happens to be open when it is read.
    error: edit.busyField === field || edit.errorField === field ? edit.error : null,
    // The same rule the generate route enforces, rather than a stricter guess
    // at it: a paid plan, or a free account with only its one entitled
    // direction. A free account with one direction can generate, so hiding the
    // button from them was hiding a feature they have. The payload's lenses are
    // already filtered to the statuses that route counts.
    // An AI control looks the same on every plan - a control that is simply
    // absent cannot say what it would have done. Free always sees it and
    // pressing it opens the modal; the two paid branches are exactly what
    // they were, so Vault keeps the behaviour it has.
    canRegenerate: edit.canUseProfileTools === true
      || (edit.lenses?.length ?? 0) <= 1
      || edit.canCustomise !== true
  }
}
