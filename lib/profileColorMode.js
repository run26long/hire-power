'use client'

import { useCallback, useEffect, useLayoutEffect, useState } from 'react'

// ============================================================================
// WHICH MODE THE CAREER PROFILE IS IN
//
// One stored value, `career_profiles.color_mode`, read by two pages that must
// agree: the owner's workspace at /career-profile and the public document at
// /p/[slug]. Both render the same component tree, so both resolve the mode the
// same way through here rather than each keeping its own copy of the rule.
//
// WHY THE ATTRIBUTE GOES ON <html>
// Four of the six scopes the palette dresses are portalled onto document.body
// - the evidence viewer, the recruiter surface, the portfolio overlay and the
// owner's dialogs. Nothing on .hp-profile can reach them by descent, so an
// attribute on the document itself is the only place all six can read. It is
// inert on its own: only Profile-scoped selectors mention it, and the
// application's own chrome is not one of them.
//
// WHY UNSET MEANS DARK
// Every profile that exists predates this setting and is dark. `null` has to
// keep meaning what it has always rendered, so the default is 'dark' and not
// 'system' - a person who never chose anything must not have their page
// change because of what their laptop happens to prefer.
//
// THE FLASH
// Both pages fetch their profile in the browser, so there is a moment before
// the stored mode is known. Painting that moment dark and then switching is
// the flash this avoids: the last resolved mode is cached per profile and
// applied synchronously on mount, before the first paint, so a returning
// reader never sees the wrong ground. The cache is a rendering hint and
// nothing else - the stored value overwrites it the moment it lands, and a
// browser that refuses storage simply gets the default.
// ============================================================================

export const COLOR_MODES = ['system', 'light', 'dark']

// What a profile with nothing stored renders as, and so what every profile
// that existed before this setting renders as.
export const DEFAULT_COLOR_MODE = 'dark'

const ATTR = 'data-hp-profile-mode'
const DARK_QUERY = '(prefers-color-scheme: dark)'
const CACHE_PREFIX = 'hp_profile_mode:'

export function normalizeColorMode(value) {
  return COLOR_MODES.includes(value) ? value : DEFAULT_COLOR_MODE
}

function systemResolved() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark'
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
}

// 'system' | 'light' | 'dark'  ->  'light' | 'dark'
export function resolveColorMode(mode) {
  const m = normalizeColorMode(mode)
  return m === 'system' ? systemResolved() : m
}

function readCache(key) {
  if (!key) return null
  try {
    const v = window.localStorage.getItem(CACHE_PREFIX + key)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    // Storage blocked. The default is a correct answer, just not a fast one.
    return null
  }
}

function writeCache(key, resolved) {
  if (!key) return
  try {
    window.localStorage.setItem(CACHE_PREFIX + key, resolved)
  } catch {
    // Non-blocking by design: this only ever made the first paint better.
  }
}

/**
 * Read the mode the Profile is currently in, from anywhere inside it.
 *
 * For the two or three things CSS cannot do, and in practice that means the
 * wordmark: it is a raster, a raster cannot be recoloured, and the white one
 * is invisible on a light ground. Everything else in this system is a token.
 *
 * Reads the attribute synchronously for the first render rather than settling
 * into it afterwards, so the header never paints the wrong mark and swaps.
 * Safe to do here because nothing that calls this is ever rendered on the
 * server - both pages fetch in the browser and render a load state until the
 * payload arrives.
 */
export function useResolvedProfileMode() {
  const read = () =>
    (typeof document !== 'undefined' &&
      document.documentElement.getAttribute(ATTR) === 'light')
      ? 'light'
      : 'dark'

  const [mode, setMode] = useState(read)

  useEffect(() => {
    const el = document.documentElement
    const sync = () => setMode(read())
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(el, { attributes: true, attributeFilter: [ATTR] })
    return () => observer.disconnect()
  }, [])

  return mode
}

/**
 * Put the Career Profile in a mode for as long as this component is mounted.
 *
 * @param {string|null|undefined} colorMode  the stored value. `undefined`
 *        means "not loaded yet", which is different from `null`: the first
 *        renders the cached guess and writes nothing, the second is a real
 *        stored answer of "never chosen" and resolves to dark.
 * @param {string} cacheKey  what to remember the last resolved mode against -
 *        the slug on the public page, the account on the owner's.
 *
 * Returns nothing. What the mode IS gets read from the attribute by
 * useResolvedProfileMode, which is reactive and has one caller; holding a
 * second copy of it in state here would be a second source of the same
 * answer, updated from an effect, for nobody.
 */
export function useProfileColorMode(colorMode, cacheKey) {
  const known = colorMode !== undefined

  const apply = useCallback((next) => {
    document.documentElement.setAttribute(ATTR, next)
  }, [])

  // Before paint, every time, so the document is never committed in one mode
  // and painted in the other.
  useLayoutEffect(() => {
    const next = known ? resolveColorMode(colorMode) : (readCache(cacheKey) || DEFAULT_COLOR_MODE)
    apply(next)
    if (known) writeCache(cacheKey, next)
  }, [known, colorMode, cacheKey, apply])

  // 'system' is a live answer, not a snapshot: a reader who flips their
  // machine to dark while the page is open should watch it follow.
  useEffect(() => {
    if (!known || normalizeColorMode(colorMode) !== 'system') return
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia(DARK_QUERY)
    const onChange = () => {
      const next = mq.matches ? 'dark' : 'light'
      apply(next)
      writeCache(cacheKey, next)
    }
    // Safari below 14 has addListener and not addEventListener.
    if (mq.addEventListener) mq.addEventListener('change', onChange)
    else mq.addListener(onChange)
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange)
      else mq.removeListener(onChange)
    }
  }, [known, colorMode, cacheKey, apply])

  // The Profile is the only thing this attribute is for, so it leaves with it.
  useEffect(() => () => {
    document.documentElement.removeAttribute(ATTR)
  }, [])
}
