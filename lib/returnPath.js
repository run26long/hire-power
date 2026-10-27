// ============================================================================
// WHERE SOMEBODY GOES BACK TO AFTER SIGNING IN
//
// A signed-out visitor following a link into the app lands on the sign-in
// page, and before this they landed on the dashboard afterwards - whatever
// they had been trying to reach was gone. The link in the testimonial
// notification email is the case that made it obvious: "review it here" put
// the owner on a dashboard with no mention of the thing they had come to
// review.
//
// So the intended address travels with them as `?next=`, and the sign-in
// sends them there instead.
//
// WHY THIS IS NOT JUST A STRING
// A redirect target taken from a query string is an open redirect unless it
// is checked, and an open redirect on a sign-in page is a phishing primitive:
// a link to this site's own domain that quietly lands somebody on another
// one, with the trust of the first address and the content of the second.
//
// The rule is therefore the narrowest one that still works: a path on this
// site, and nothing else. It must begin with a single "/" and go no further
// into URL syntax than that.
//
//   "/career-profile?review=abc"   a path on this site
//   "https://evil.example"         a scheme, rejected
//   "//evil.example"               protocol-relative, which a browser reads
//                                  as another origin, rejected
//   "/\evil.example"               the same trick with the slashes reversed,
//                                  which some parsers normalise, rejected
//   "/x\n//evil.example"           a control character hiding one of the
//                                  shapes above from a naive check, rejected
//
// Nothing is repaired. A value that is not plainly a path on this site is
// dropped and the visitor goes to the default, which is always safe.
// ============================================================================

export const DEFAULT_AFTER_SIGN_IN = '/dashboard'

/**
 * The value of `next` if it is a path on this site, otherwise null.
 * Takes the already-decoded value, which is what URLSearchParams.get gives.
 */
export function safeReturnPath(value) {
  const path = typeof value === 'string' ? value.trim() : ''
  if (!path) return null
  // Relative to this site, and only that.
  if (path[0] !== '/') return null
  // "//host" and "/\host" are both another origin to a browser.
  if (path[1] === '/' || path[1] === '\\') return null
  // A newline or a null can hide the shapes above from the checks above.
  if (/[\u0000-\u001F\u007F]/.test(path)) return null
  return path
}

/**
 * Where to send a signed-out visitor so they come back here afterwards.
 * `path` is the address they were trying to reach.
 */
export function signInUrl(path, base = DEFAULT_AFTER_SIGN_IN) {
  const next = safeReturnPath(path)
  return next ? `${base}?next=${encodeURIComponent(next)}` : base
}

/**
 * The address currently in the bar, path and query and fragment together, for
 * handing to signInUrl. Null on the server, where there is no such thing.
 */
export function currentPath() {
  if (typeof window === 'undefined') return null
  const { pathname, search, hash } = window.location
  return `${pathname}${search}${hash}`
}

/**
 * Where a successful sign-in should land, given the page's own search params.
 * Accepts a URLSearchParams, a query string, or null.
 */
export function afterSignIn(params, fallback = DEFAULT_AFTER_SIGN_IN) {
  let value = null
  try {
    const search = params instanceof URLSearchParams
      ? params
      : new URLSearchParams(
          typeof params === 'string'
            ? params
            : (typeof window !== 'undefined' ? window.location.search : '')
        )
    value = search.get('next')
  } catch {
    value = null
  }
  return safeReturnPath(value) || fallback
}
