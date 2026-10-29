'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ============================================================================
// THE IN MY OWN WORDS VIDEO
//
// The person saying it to camera instead of writing it down.
//
// THE LINK IS ASKED FOR, NOT CARRIED
// The profile payload has no URL in it. This component asks the signing route
// when it mounts, which keeps a credential out of a response that is otherwise
// safe to hold, and keeps the signature fresh rather than as old as whenever
// the page was loaded. The poster comes back on the same request: it is needed
// at the same moment, by the same element.
//
// AND ASKED FOR AGAIN, ONCE, IF PLAYBACK BREAKS
// A signed URL has a life and a video is streamed across the whole of it. Two
// hours covers any real visit, but a tab left open overnight and then scrubbed
// would fail with nothing a reader could act on. One silent re-sign on error
// covers that. Once, and only once: a URL that fails twice is not an expiry,
// and a component that retried forever would hammer the route over a file that
// has been deleted.
//
// ---------------------------------------------------------------------------
// THE FRAME TAKES THE VIDEO'S OWN SHAPE
//
// This was a fixed 16/9 box, and the upload refused anything that was not
// landscape so that nothing would ever sit badly in it. Phones record in
// portrait, so the check was refusing the normal case.
//
// The shape arrives with the payload, read by the browser that uploaded the
// file and stored at that moment. It has to arrive that way: measuring the
// video after it loads would resize the card a second after the page settled,
// under a reader who had already started reading. A video from before the
// column existed has no stored shape and falls back to 16/9, which is what
// every one of them is, because nothing else was ever allowed in.
//
// WHAT A PORTRAIT VIDEO DOES WITH THE SPACE BESIDE IT
// Not black bars. The card is a measured width and a portrait video is
// narrower than it, so the difference is filled with the video's own poster,
// blown up, blurred and darkened behind it - the same still that is on the
// frame before anybody presses play. It reads as the room the video was shot
// in rather than as a letterbox, and it costs no extra request because the
// poster is already here.
//
// With no poster there is nothing to blur, so the frame is simply the width of
// the video and centred. That is the honest fallback: a tinted panel invented
// out of nothing would be a colour this profile never chose.
//
// THE HEIGHT IS CAPPED, AND THAT IS A LAYOUT DECISION
// A portrait video at the card's full width would be half as tall again as the
// About column beside it, and the spread would stop being a spread. The cap
// lives in the stylesheet with the rest of the card; what this component does
// is say which shape it is, so the stylesheet can tell the two apart.
// ---------------------------------------------------------------------------
//
// NOTHING AUTOPLAYS
// It is somebody talking about themselves on a page a stranger is reading. It
// starts when the reader asks for it, with controls, and it does not loop.
//
// WHAT HAPPENS WHEN IT WILL NOT PLAY
// Nothing visible. The section falls back to whatever text exists, and where
// there is none the section closes - which is what the public content rule
// says should happen to a section with nothing in it. A broken player frame
// telling a recruiter something went wrong is worse than a page that simply
// does not mention a video.
// ============================================================================

// Where landscape stops and the tall card starts. A hair under 1 rather than
// exactly 1, so a video that is square to the pixel is treated as square: the
// tall treatment is what a square wants too, and floating point on a stored
// integer division should not be what decides it.
const LANDSCAPE_FROM = 0.999

// What the frame falls back to with no stored shape. Every video uploaded
// before the shape column existed is landscape, because nothing else was
// accepted.
const DEFAULT_RATIO = 16 / 9

const sane = (value) => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 && n <= 16384 ? n : null
}

export default function ImowVideo({ slug, getAuthHeaders, onUnavailable, width, height, hasPoster }) {
  const [url, setUrl] = useState(null)
  const [posterUrl, setPosterUrl] = useState(null)
  const [state, setState] = useState('loading')   // loading | ready | gone
  const retried = useRef(false)
  const videoRef = useRef(null)

  const sign = useCallback(async () => {
    if (!slug) { setState('gone'); return null }
    try {
      const res = await fetch(
        `/api/career-profile/${encodeURIComponent(slug)}/imow-video`,
        { headers: getAuthHeaders ? await getAuthHeaders() : {} }
      )
      if (!res.ok) { setState('gone'); return null }
      const payload = await res.json()
      if (!payload?.url) { setState('gone'); return null }
      setUrl(payload.url)
      // Never required. A poster that will not sign is a frame the browser
      // fills itself, which is what it did before there were any posters.
      setPosterUrl(payload.poster_url || null)
      setState('ready')
      return payload.url
    } catch {
      setState('gone')
      return null
    }
  }, [slug, getAuthHeaders])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => { if (!cancelled) sign() })
    return () => { cancelled = true }
  }, [sign])

  // The section above needs to know, because a video that will not play and no
  // text means there is nothing here at all.
  useEffect(() => {
    if (state === 'gone') onUnavailable?.()
  }, [state, onUnavailable])

  async function onError() {
    if (retried.current) { setState('gone'); return }
    retried.current = true
    const fresh = await sign()
    if (fresh && videoRef.current) {
      // Assigning src alone does not restart a failed element; it has to be
      // told to reconsider what it has.
      videoRef.current.load()
    }
  }

  if (state === 'gone') return null

  const w = sane(width)
  const h = sane(height)
  const ratio = w && h ? w / h : DEFAULT_RATIO
  const shape = ratio >= LANDSCAPE_FROM ? 'landscape' : 'portrait'

  // Only where there is something to fill and something to fill it with. A
  // landscape video already spans the card, so there is no space beside it.
  const fill = shape === 'portrait' && hasPoster && posterUrl ? posterUrl : null

  return (
    <div className="hp-voice-video" data-state={state} data-shape={shape}>
      {/* Behind the video and inside the frame's own rounded clip: the poster
          at cover, blurred and darkened, so the space either side of a
          portrait film reads as depth rather than as a letterbox. Decorative
          by construction - it is the same picture the video is already
          showing - so it is hidden from assistive tech. */}
      {fill ? (
        <span
          className="hp-voice-video-fill"
          style={{ backgroundImage: `url("${fill}")` }}
          aria-hidden="true"
        />
      ) : null}

      {url ? (
        <video
          ref={videoRef}
          className="hp-voice-video-el"
          src={url}
          poster={posterUrl || undefined}
          style={{ aspectRatio: `${ratio}` }}
          controls
          preload="metadata"
          playsInline
          onError={onError}
        />
      ) : (
        // A frame of the right shape while the link is fetched, so the column
        // does not jump when it arrives. It already knows the shape: that came
        // with the payload, not with the file.
        <div
          className="hp-voice-video-wait"
          style={{ aspectRatio: `${ratio}` }}
          aria-hidden="true"
        />
      )}
    </div>
  )
}
