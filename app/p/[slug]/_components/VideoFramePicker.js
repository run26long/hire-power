'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ============================================================================
// CHOOSING THE FRAME A VIDEO SHOWS
//
// A video in the gallery needs a picture, and there is nothing on the server
// that can produce one: no ffmpeg, and sharp does not open video containers.
// The only thing in the system capable of decoding an MP4 is the browser that
// is about to play it, so this is where a poster frame comes from.
//
// IT ALWAYS PRODUCES ONE
// A frame is captured a second in as soon as the file is readable, before the
// owner has done anything. Scrubbing and pressing the button replaces it. So
// the default is a real frame rather than a blank mat, and picking a better
// one is an improvement on something that already works rather than a step
// somebody has to know to take.
//
// A second in, not zero: the first frame of a video is very often black, a
// fade, or a slate, and a gallery of black squares is the exact problem this
// is here to avoid. A video shorter than two seconds is sampled at its middle
// instead, because a second in may be past the end.
//
// WHAT IT HANDS BACK IS A PICTURE, NOT A PROMISE
// The frame is drawn to a canvas and exported as a real image blob, which is
// uploaded as its own object. The server re-encodes whatever arrives through
// the same pipeline an uploaded photograph goes through, so nothing here is
// trusted - this end is responsible for the frame being a good one, not for
// it being safe.
//
// The duration is read here for the same reason the frame is: it is on the
// metadata the browser has already parsed, and there is no second source.
// ============================================================================

// The default sample point, and the shortest video that gets it.
const DEFAULT_AT_SECONDS = 1
const MIN_FOR_DEFAULT = 2

// Exports are capped rather than sent at the video's own resolution: the
// server resizes to 800 regardless, and a 4K still costs the owner an upload
// of several megabytes to produce a thumbnail that is thrown away.
const MAX_EXPORT_WIDTH = 1280

// webp where it can be written, jpeg where it cannot. Both are accepted by the
// route; neither is trusted by it.
const PREFERRED_TYPE = 'image/webp'
const FALLBACK_TYPE = 'image/jpeg'
const QUALITY = 0.82

const clock = (seconds) => {
  const total = Math.max(0, Math.round(Number(seconds) || 0))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function VideoFramePicker({ file, onFrame, onDuration }) {
  const videoRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [duration, setDuration] = useState(null)
  const [at, setAt] = useState(0)
  const [poster, setPoster] = useState(null)   // { url, at }
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  // The file the automatic frame has already been taken for, so it happens
  // once per file and never fights a frame the owner chose. State rather than
  // a ref because it is set while deciding what to do about a file, and a ref
  // written during render is a value React has not been told about.
  const [autoFor, setAutoFor] = useState(null)

  // The player is fed the file directly rather than through a src in state.
  // An object URL is an external resource with a lifetime, which is what an
  // effect is for; putting it in state would mean setting state from an effect
  // and re-rendering the form every time a file is picked, to arrive at markup
  // that only differs by a string the DOM already has.
  useEffect(() => {
    const video = videoRef.current
    if (!file || !video) return
    const url = URL.createObjectURL(file)
    video.src = url
    return () => {
      URL.revokeObjectURL(url)
      video.removeAttribute('src')
      // Without this the element keeps decoding the file it can no longer
      // reach, which on a long video is a download that outlives its purpose.
      video.load()
    }
  }, [file])

  // The captured frame's preview URL, revoked when it is replaced and when
  // this unmounts. Cleanup only - it sets nothing.
  useEffect(() => () => { if (poster?.url) URL.revokeObjectURL(poster.url) }, [poster])

  // A new file starts everything again. Adjusted during render rather than in
  // an effect, which is the pattern the sections use for a direction change:
  // the reset is part of deciding what to show for this file, not a reaction
  // to having shown the last one.
  const [shownFile, setShownFile] = useState(file)
  if (shownFile !== file) {
    setShownFile(file)
    setReady(false)
    setDuration(null)
    setAt(0)
    setPoster(null)
    setFailed(false)
  }

  const capture = useCallback((mark) => {
    const video = videoRef.current
    if (!video || !video.videoWidth || !video.videoHeight) return
    setBusy(true)
    try {
      const scale = Math.min(1, MAX_EXPORT_WIDTH / video.videoWidth)
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      canvas.toBlob(
        (blob) => {
          setBusy(false)
          if (!blob) { setFailed(true); return }
          // A browser that cannot write webp returns a png from toBlob
          // regardless of what was asked for, so the blob's own type is what
          // gets declared rather than what was requested.
          const type = blob.type || FALLBACK_TYPE
          // Revoking the one being replaced is left entirely to the effect
          // below. Doing it inside the updater would free the new URL instead
          // of the old one the moment React calls the updater twice.
          setPoster({ url: URL.createObjectURL(blob), at: mark })
          onFrame?.({ blob, contentType: type })
        },
        PREFERRED_TYPE,
        QUALITY
      )
    } catch {
      setBusy(false)
      setFailed(true)
    }
  }, [onFrame])

  // Metadata is where the duration lives, and where the automatic frame is set
  // in motion: seeking is what produces a decoded frame to draw.
  function onLoaded() {
    const video = videoRef.current
    if (!video) return
    const length = Number.isFinite(video.duration) ? video.duration : null
    setDuration(length)
    setReady(true)
    onDuration?.(length)

    if (autoFor === file) return
    setAutoFor(file)
    const mark = !length || length < MIN_FOR_DEFAULT
      ? (length ? length / 2 : 0)
      : DEFAULT_AT_SECONDS
    // Seeking triggers onSeeked below, which is where the draw happens: a
    // canvas drawn before the seek lands is a picture of the wrong moment.
    try { video.currentTime = mark } catch { capture(0) }
  }

  function onSeeked() {
    const video = videoRef.current
    if (!video) return
    setAt(video.currentTime)
    // Only the automatic one draws on its own. After that a frame is taken
    // when the owner says so, or scrubbing would replace their choice every
    // time the playhead moved.
    if (autoFor === file && !poster) capture(video.currentTime)
  }

  if (!file) return null

  return (
    <div className="hp-ed-frame">
      <p className="hp-ed-field-label">Thumbnail frame</p>

      <div className="hp-ed-frame-stage">
        {/* The owner's own file, played locally. Nothing is uploaded until
            they save, so scrubbing costs nothing and reaches nothing. */}
        <video
          ref={videoRef}
          className="hp-ed-frame-video"
          controls
          playsInline
          preload="metadata"
          muted
          onLoadedMetadata={onLoaded}
          onSeeked={onSeeked}
          onTimeUpdate={() => setAt(videoRef.current?.currentTime ?? 0)}
          onError={() => setFailed(true)}
        />

        {/* What the gallery will show, beside what it was taken from. A
            thumbnail somebody cannot see is a thumbnail they cannot judge. */}
        <div className="hp-ed-frame-chosen">
          <span className="hp-ed-frame-chosen-label">Gallery shows</span>
          {poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="hp-ed-frame-thumb" src={poster.url} alt="" />
          ) : (
            <span className="hp-ed-frame-thumb" data-waiting="true" aria-hidden="true" />
          )}
          {poster && <span className="hp-ed-frame-at">at {clock(poster.at)}</span>}
        </div>
      </div>

      <div className="hp-ed-row">
        <button
          type="button"
          className="hp-ed-action"
          onClick={() => capture(videoRef.current?.currentTime ?? 0)}
          disabled={!ready || busy || failed}
        >
          {busy ? 'Capturing…' : 'Use this frame'}
        </button>
        <span className="hp-ed-frame-time">
          {ready && duration ? `${clock(at)} of ${clock(duration)}` : ''}
        </span>
      </div>

      <p className="hp-ed-proof-note">
        {failed
          ? "We couldn't read a frame from this video. It will use the play mark instead, and still plays normally."
          : 'Scrub to the moment you want and press the button. If you leave it, the gallery uses the frame a second in.'}
      </p>
    </div>
  )
}
