'use client'

// ============================================================================
// ONE SIGNED LINK PER FILE, FOR AS LONG AS THE SIGNATURE LASTS
//
// WHY THIS EXISTS
// The media route hands back a Supabase signed URL, and the page puts that
// URL straight into an <img src>. That part is right: the bytes come from
// storage with no Authorization header on them, so the browser is free to
// cache them.
//
// What stopped it caching was the URL. `createSignedUrl` mints a fresh token
// on every call - the signature carries its own expiry, so two calls a second
// apart return two different strings - and a browser caches a picture under
// the URL it was fetched from. A different URL is a different picture as far
// as the cache is concerned. So every mount re-signed, and every re-sign
// re-downloaded the whole file.
//
// Three components did that independently, and the lightbox remounts its
// media on every step, so opening item one, stepping to item two and stepping
// back downloaded item one twice.
//
// So the signed link is asked for once and held until it is nearly expired.
// The same URL string comes back, the browser recognises it, and a picture
// already looked at appears immediately.
//
// WHAT THIS DOES NOT CHANGE
// Nothing about who may see what. The route still decides that, from scratch,
// on every call it receives: the profile, the row, the direction and the
// bearer token are all re-checked there and nothing here is sent in their
// place. This only stops the page asking the same question four times a
// minute and throwing the answer away in between.
//
// Held in memory, in one tab, for ten minutes at the outside. It is not
// written anywhere, it does not outlive the page, and it grants nothing the
// reader did not already have: the URL in it is the one they were handed, and
// it stops working when its signature does.
//
// THE EXPIRY IS DELIBERATELY EARLY
// A link handed out with two seconds left is a download that fails halfway.
// The entry is dropped a minute before the signature dies, so anything still
// in use has time to finish.
// ============================================================================

// Dropped this long before the signature actually expires.
const EARLY_MS = 60_000

// What the route promises when it does not say otherwise.
const DEFAULT_TTL_MS = 600_000

const cache = new Map()
const inflight = new Map()

const keyFor = ({ slug, id, variant, lensId }) =>
  `${slug || ''}|${id || ''}|${variant || 'file'}|${lensId || ''}`

/**
 * The answer for one file, from memory where it is still good and from the
 * route where it is not. Concurrent callers for the same file share one
 * request: a grid of twenty mats asking at once is twenty renders, not twenty
 * round trips.
 *
 * `headers` is the async function from useViewerAuthHeaders.
 * Resolves to { url, mime, mediaClass }, or throws the way fetch does.
 */
export async function mediaUrl({ slug, id, variant = null, lensId = null, headers }) {
  if (!slug || !id) throw new Error('mediaUrl needs a slug and an id')
  const key = keyFor({ slug, id, variant, lensId })

  const held = cache.get(key)
  if (held && held.expiresAt > Date.now()) return held.body

  const running = inflight.get(key)
  if (running) return running

  const run = (async () => {
    const query = new URLSearchParams()
    if (variant) query.set('variant', variant)
    if (lensId) query.set('lens', lensId)
    const tail = query.toString()

    const res = await fetch(
      `/api/career-profile/${encodeURIComponent(slug)}/evidence/${encodeURIComponent(id)}`
      + (tail ? `?${tail}` : ''),
      { headers: (headers ? await headers() : {}) || {} }
    )
    if (!res.ok) throw new Error(String(res.status))
    const payload = await res.json()

    const body = {
      url: payload?.url || null,
      mime: payload?.mime_type || null,
      mediaClass: payload?.media_class || null
    }

    if (body.url) {
      const seconds = Number(payload?.expires_in)
      const life = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : DEFAULT_TTL_MS
      cache.set(key, { body, expiresAt: Date.now() + Math.max(0, life - EARLY_MS) })
    }
    return body
  })()

  // Cleared either way: a failure must not leave the next caller waiting on a
  // promise that has already rejected.
  run.finally(() => { if (inflight.get(key) === run) inflight.delete(key) })
  inflight.set(key, run)
  return run
}

/**
 * Drop one entry. For the single retry a component makes when a picture fails
 * to load: without this the retry would be handed the same dead link out of
 * the cache and fail again for the same reason.
 */
export function forgetMediaUrl(spec) {
  cache.delete(keyFor(spec))
}

/**
 * Ask for a file's link and let the browser fetch the picture behind it, so
 * that stepping onto it later is a cache hit rather than a download.
 *
 * Pictures only. A video is megabytes nobody has asked to watch yet, and
 * `preload="metadata"` on the element already covers the part that matters.
 * Failures are ignored: this is work done ahead of a request nobody has made,
 * and it must never surface as an error for something the reader can still
 * see perfectly well.
 */
export function preloadMedia(spec) {
  if (typeof window === 'undefined') return
  mediaUrl(spec)
    .then(body => {
      if (!body?.url) return
      if (spec?.mediaClass && spec.mediaClass !== 'image') return
      const warm = new window.Image()
      warm.decoding = 'async'
      warm.src = body.url
    })
    .catch(() => {})
}
