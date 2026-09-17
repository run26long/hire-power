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
// the page was loaded.
//
// AND ASKED FOR AGAIN, ONCE, IF PLAYBACK BREAKS
// A signed URL has a life and a video is streamed across the whole of it. Two
// hours covers any real visit, but a tab left open overnight and then scrubbed
// would fail with nothing a reader could act on. One silent re-sign on error
// covers that. Once, and only once: a URL that fails twice is not an expiry,
// and a component that retried forever would hammer the route over a file that
// has been deleted.
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

export default function ImowVideo({ slug, authHeaders, onUnavailable }) {
  const [url, setUrl] = useState(null)
  const [state, setState] = useState('loading')   // loading | ready | gone
  const retried = useRef(false)
  const videoRef = useRef(null)

  const sign = useCallback(async () => {
    if (!slug) { setState('gone'); return null }
    try {
      const res = await fetch(
        `/api/career-profile/${encodeURIComponent(slug)}/imow-video`,
        { headers: authHeaders || {} }
      )
      if (!res.ok) { setState('gone'); return null }
      const payload = await res.json()
      if (!payload?.url) { setState('gone'); return null }
      setUrl(payload.url)
      setState('ready')
      return payload.url
    } catch {
      setState('gone')
      return null
    }
  }, [slug, authHeaders])

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

  return (
    <div className="hp-voice-video" data-state={state}>
      {url ? (
        <video
          ref={videoRef}
          className="hp-voice-video-el"
          src={url}
          controls
          preload="metadata"
          playsInline
          onError={onError}
        />
      ) : (
        // A frame of the right shape while the link is fetched, so the column
        // does not jump when it arrives.
        <div className="hp-voice-video-wait" aria-hidden="true" />
      )}
    </div>
  )
}
