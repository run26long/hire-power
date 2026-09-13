'use client'

import { useSyncExternalStore } from 'react'

// ============================================================================
// Reduced motion, read once and shared.
//
// The old implementation made an exception for the lens zoom and kept it
// running even here, on the grounds that the zoom was how the carousel read.
// Signature does not carry that exception over: the lens change still has to be
// unmistakable, but it arrives rather than performs.
//
// Read through useSyncExternalStore because that is what the media query is: an
// external store that changes underneath React. It also gives the right answer
// on the very first render rather than reporting "motion is fine" and
// correcting itself afterwards.
// ============================================================================

const QUERY = '(prefers-reduced-motion: reduce)'

let cached = null

function mediaQuery() {
  if (!cached) cached = window.matchMedia(QUERY)
  return cached
}

function subscribe(onChange) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const query = mediaQuery()
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function getSnapshot() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return mediaQuery().matches
}

// On the server there is nobody to ask, and assuming motion is acceptable is
// the same assumption the browser default makes.
function getServerSnapshot() {
  return false
}

export function usePrefersReducedMotion() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
