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

/**
 * `compact` is for a picker inside a frame that has already said what it is.
 *
 * The default is the evidence gallery's, and everything it carries is right
 * there: the picker stands in a long form among other fields, so it needs a
 * label to say which field it is, a preview of the square the gallery will
 * actually crop to, and a sentence saying what happens if the owner leaves it
 * alone. Nothing about that behaviour changes - this prop only hides, and the
 * gallery never passes it.
 *
 * In Tell your story the picker IS the dialog's middle, under a tab that says
 * Video, in a box with one fixed height. The label repeats the tab, the square
 * preview is about a gallery mat that has nothing to do with this section, and
 * the help sentence is a third line in a box sized for a film. What is left is
 * the video, its scrubber, the button and the time - which is the picker.
 *
 * The failure sentence is NOT hidden. It is not help; it is the one thing in
 * here that reports something went wrong, and a frame that would not read is
 * worth a line wherever this is used.
 */
/**
 * TWO WAYS TO BE GIVEN A VIDEO, AND THEY ARE THE SAME PICKER
 *
 * `file` is a File in the browser that has not been uploaded. `src` is a URL
 * for one that has - a signed link from the profile's own signing route. The
 * second exists so the owner can change the thumbnail of a video they stored
 * weeks ago, which is the same act on the same control and so is not a second
 * component.
 *
 * Exactly one is expected. `file` wins if both arrive, because a file in hand
 * is the newer intent.
 *
 * WHY src NEEDS crossOrigin
 * Drawing a video to a canvas taints the canvas when the frames came from
 * another origin, and a tainted canvas makes toBlob throw SecurityError - so
 * the capture would fail on exactly the videos this mode exists for. Supabase
 * storage answers a signed URL with access-control-allow-origin: *, so
 * crossOrigin="anonymous" makes the response usable rather than opaque and the
 * canvas stays clean. It is set for both modes: an object URL is same-origin
 * and the attribute changes nothing there.
 *
 * startAt IS WHERE TO OPEN, IN SECONDS
 * A poster is a picture and a picture does not say what second it is, so a
 * picker handed a stored video has no way to find the frame behind it. The
 * offset is recorded when the frame is saved and handed back here, so the
 * player opens where the owner left it rather than at the start.
 *
 * Null means the start, which is what every video uploaded before the offset
 * was recorded reads as. It is honoured once per video: a seek the owner
 * performs afterwards is theirs, and this never pulls the playhead back.
 *
 * autoCapture IS THE ONE THING THE TWO MODES DO NOT SHARE
 * A frame is taken a second in, by itself, as soon as the file is readable.
 * On a file waiting to be uploaded that guarantees a real poster instead of a
 * blank mat. On a stored video the captured frame is SAVED by the caller, so
 * taking one automatically would overwrite the poster the owner already chose
 * the moment they opened the editor. The stored flow passes false; everything
 * else passes nothing and is unchanged.
 *
 * WHAT THE OWNER SEES IS IDENTICAL EITHER WAY
 * Same stage, same scrubber, same "Use this frame", same time, same wording.
 * What differs is what the caller does with the frame, which is the caller's
 * business: the upload flow holds it and sends it with the file, and the
 * stored flow saves it on its own. The button says what it does in both.
 */
export default function VideoFramePicker({
  file,
  src = null,
  onFrame,
  onDuration,
  compact = false,
  autoCapture = true,
  startAt = null
}) {
  // The one video this render is about, whichever way it arrived. Every
  // reset below keys off it, so a new file and a new URL are the same event
  // as far as this component is concerned.
  const source = file || src || null
  const videoRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [duration, setDuration] = useState(null)
  const [at, setAt] = useState(0)
  const [poster, setPoster] = useState(null)   // { url, at }
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  // The video the automatic frame has already been taken for, so it happens
  // once per video and never fights a frame the owner chose. State rather
  // than a ref because it is set while deciding what to do about a source,
  // and a ref written during render is a value React has not been told about.
  const [autoFor, setAutoFor] = useState(null)

  // The player is fed its source directly rather than through a src in state:
  // putting it there would mean setting state from an effect and re-rendering
  // on every pick, to arrive at markup that differs by a string the DOM
  // already has.
  // A File becomes an object URL with a lifetime, which is what an effect is
  // for. A URL that was handed in has no lifetime to manage, so it is only
  // assigned - and the teardown is shared, because an element left decoding
  // a file it can no longer reach is a download that outlives its purpose
  // either way.
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (!file && !src) return
    const url = file ? URL.createObjectURL(file) : src
    video.src = url
    return () => {
      if (file) URL.revokeObjectURL(url)
      video.removeAttribute('src')
      video.load()
    }
  }, [file, src])

  // The captured frame's preview URL, revoked when it is replaced and when
  // this unmounts. Cleanup only - it sets nothing.
  useEffect(() => () => { if (poster?.url) URL.revokeObjectURL(poster.url) }, [poster])

  // A new file starts everything again. Adjusted during render rather than in
  // an effect, which is the pattern the sections use for a direction change:
  // the reset is part of deciding what to show for this file, not a reaction
  // to having shown the last one.
  const [shownFile, setShownFile] = useState(source)
  if (shownFile !== source) {
    setShownFile(source)
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
          // The offset travels with the picture. It is what the thumbnail
          // IS - the picture is just how it looks - and without it nothing
          // downstream can reopen on this moment. A caller that does not
          // want it simply does not read it.
          onFrame?.({ blob, contentType: type, at: mark })
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

    // ---- ONCE PER VIDEO, WHATEVER HAPPENS NEXT ----
    // onLoadedMetadata fires again whenever the element reloads - the error
    // retry in ImowVideo calls load() for exactly that reason - and neither
    // branch below should pull the playhead back from wherever the owner has
    // since put it.
    if (autoFor === source) return
    setAutoFor(source)

    // ---- A STORED VIDEO OPENS ON ITS OWN THUMBNAIL ----
    //
    // Seek, and nothing else. autoCapture decides whether a frame is TAKEN;
    // this decides only where the player sits, so a stored video opens on the
    // frame behind its poster without that poster being re-saved. onSeeked
    // tests autoCapture first, so the landing draws nothing.
    //
    // No offset recorded, or a zero one, and it stays where it loaded - which
    // is the start, and is what every video from before the offset was
    // recorded reads as.
    if (!autoCapture) {
      const open = Number(startAt)
      if (!Number.isFinite(open) || open <= 0) return
      setAt(open)
      try { video.currentTime = open } catch { /* a seek the file will not take */ }
      return
    }

    // ---- A FILE WAITING TO BE UPLOADED TAKES ONE BY ITSELF ----
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
    if (autoCapture && autoFor === source && !poster) capture(video.currentTime)
  }

  // Neither, and there is nothing to pick a frame from. The upload flow
  // reaches this before a file is chosen; the stored flow reaches it while
  // the signing route is still answering.
  if (!source) return null

  return (
    <div className="hp-ed-frame" data-compact={compact ? 'true' : undefined}>
      {compact ? null : <p className="hp-ed-field-label">Thumbnail frame</p>}

      <div className="hp-ed-frame-stage">
        {/* The owner's own file, played locally. Nothing is uploaded until
            they save, so scrubbing costs nothing and reaches nothing. */}
        <video
          ref={videoRef}
          className="hp-ed-frame-video"
          crossOrigin="anonymous"
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
            thumbnail somebody cannot see is a thumbnail they cannot judge.

            Not where there is no gallery mat to preview: In My Own Words shows
            the still full width behind its own player, at the shape the film
            was recorded in, so a square crop of it would be a preview of
            something that never appears. */}
        {compact ? null : (
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
        )}
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

      {/* The failure wherever this is used; the help only where there is room
          for it. See the note on `compact`. */}
      {failed ? (
        <p className="hp-ed-proof-note">
          We couldn&rsquo;t read a frame from this video. It will use the play mark
          instead, and still plays normally.
        </p>
      ) : compact ? null : (
        <p className="hp-ed-proof-note">
          Scrub to the moment you want and press the button. If you leave it, the
          gallery uses the frame a second in.
        </p>
      )}
    </div>
  )
}
