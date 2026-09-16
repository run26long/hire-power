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
