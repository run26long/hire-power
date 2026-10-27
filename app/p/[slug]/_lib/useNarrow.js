'use client'

import { useSyncExternalStore } from 'react'

// ============================================================================
// THE ONE BREAKPOINT TWO COMPONENTS BOTH PLAN FOR
//
// The Evidence preview decides how many tiles it has room for, and the manage
// panels decide whether three columns of toggles fit. Both are the same
// question about the same width, and both have to agree with the CSS that
// rearranges at that width - so the number is written once, here.
//
// Read rather than stored: a media query is external state, and subscribing
// to it is what useSyncExternalStore is for. The server assumes the wide
// layout and the client corrects it on the first paint, without a render
// spent on it.
// ============================================================================

const NARROW = '(max-width: 767px)'

const subscribe = (notify) => {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const query = window.matchMedia(NARROW)
  query.addEventListener('change', notify)
  return () => query.removeEventListener('change', notify)
}

const isNarrowNow = () =>
  typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(NARROW).matches : false

export default function useNarrow() {
  return useSyncExternalStore(subscribe, isNarrowNow, () => false)
}
