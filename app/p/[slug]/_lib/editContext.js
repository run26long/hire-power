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
//   regenerate   (fields) => Promise, same
//   busy         the field currently being written, or null
//   error        the last failure, as a sentence, or null
//   isPro        whether regeneration is offered at all
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
    // A failure belongs to the field that caused it, not to whichever editor
    // happens to be open when it is read.
    error: edit.busyField === field || edit.errorField === field ? edit.error : null,
    canRegenerate: edit.isPro === true
  }
}
