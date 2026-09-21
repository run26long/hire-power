'use client'

import { useEffect, useLayoutEffect } from 'react'
import { ACCENTS, ACCENT_VALUES, DEFAULT_ACCENT, OFFERED_ACCENTS, accentFor, normalizeAccent } from './profileAppearance'

// ============================================================================
// WHICH ACCENT THIS PROFILE IS PAINTED IN
//
// The same shape as profileColorMode: the values live in profileAppearance,
// which has no React in it and is therefore safe for a route handler to
// import, and the hook that puts them on the document lives here. A server
// route that reached into this file would get a client-reference proxy
// instead of the array, which is the failure that once made saving a colour
// mode answer 500.
//
// WHY AN ATTRIBUTE ON THE DOCUMENT ELEMENT
// The evidence viewer, the portfolio lightbox and the drawer's modals are
// portalled onto the body. They are outside .hp-profile in the document even
// though they belong to the Profile in every other sense, so a class on the
// document would not reach them and a class on the profile would not either.
// The mode already solved this the same way, and an accent that stopped at
// the edge of the page would be a modal painted in last year's purple.
//
// PREVIEW AND STORAGE ARE THE SAME READ
// The drawer patches the record optimistically before the write lands, so
// this hook paints the chosen palette the moment it is chosen and the save
// only confirms it. Nothing here talks to the network.
// ============================================================================

export { ACCENTS, ACCENT_VALUES, DEFAULT_ACCENT, OFFERED_ACCENTS, accentFor, normalizeAccent }

const ATTR = 'data-hp-profile-accent'

/**
 * Paint the Profile in the palette its record names.
 *
 * @param {string|null|undefined} accent  the stored hex, null for a profile
 *        that has never chosen one, undefined while the record is still in
 *        flight - which paints the default rather than committing to a guess
 *        that would have to flip.
 */
export function useProfileAccent(accent) {
  const known = accent !== undefined

  // Before paint, so the document is never committed in one palette and
  // painted in another.
  useLayoutEffect(() => {
    document.documentElement.setAttribute(
      ATTR,
      accentFor(known ? accent : DEFAULT_ACCENT).id
    )
  }, [known, accent])

  // The Profile is the only thing this attribute is for, so it leaves with it.
  useEffect(() => () => {
    document.documentElement.removeAttribute(ATTR)
  }, [])
}
