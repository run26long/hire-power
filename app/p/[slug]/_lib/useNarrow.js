'use client'

import { useSyncExternalStore } from 'react'

// ============================================================================
// THE ONE BREAKPOINT EVERYTHING MOBILE PLANS FOR
//
// The Evidence preview decides how many tiles it has room for and where its
// "View all" sits, the manage panels decide whether three columns of toggles
// fit, and Skills decides between a planned mosaic and a swipeable card with
// a bottom sheet. They are all the same question, and they all have to agree
// with the CSS that rearranges at the same point - so the query is written
// once, here, and the stylesheets repeat this exact string.
//
// WHY IT IS NOT JUST A WIDTH
// A phone turned on its side is 844 points wide and is still a phone: a width
// test alone handed it the desktop layout, with a mosaic planned for a screen
// it does not have and a proof popover floating over a 390px-tall viewport.
// The second clause asks the two things that are true of a phone in landscape
// and of nothing else we want to catch - a coarse pointer, and a viewport too
// short to lay a page out down. A tablet in landscape is coarse but roughly
// 800 points tall, so it keeps the desktop layout; a desktop is neither.
//
// Read rather than stored: a media query is external state, and subscribing
// to it is what useSyncExternalStore is for. The server assumes the wide
// layout and the client corrects it on the first paint, without a render
// spent on it.
// ============================================================================

const NARROW = '(max-width: 767px), (pointer: coarse) and (max-height: 500px)'

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
