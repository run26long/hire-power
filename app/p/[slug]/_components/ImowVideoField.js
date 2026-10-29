'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useProfileEdit, useNotify } from '../_lib/editContext'
import VideoFramePicker from './VideoFramePicker'

// ============================================================================
// THE VIDEO HALF OF IN MY OWN WORDS, IN THE EDITOR
//
// Choose a file, pick the frame it shows, watch it upload, see it play back,
// replace it or take it down.
//
// ANY ORIENTATION, AND THE BROWSER IS WHAT KNOWS THE SHAPE
// This used to refuse anything that was not landscape, because the public
// frame was a fixed 16/9 box and a portrait file inside it was two black bands
// and a stripe. Most people record on a phone, in portrait, so the check was
// refusing the normal case. The frame takes the video's own shape now, and
// what makes that possible is this: there is no ffprobe on the server and
// sharp does not read video containers, so a <video> element here is the only
// thing in the system that can say how big the file is. It reads the metadata
// locally and sends the two numbers with the upload.
//
// What is still checked here is what a browser can refuse cheaply: the type,
// the size, and whether the file is readable at all. A file the browser cannot
// read is one it will not play back either, so there is no point uploading it
// to find out.
//
// None of it is a security boundary. A crafted request skips all of it, which
// is why the server bounds the dimensions it is told rather than trusting
// them, and why the public frame still lays out sensibly for a shape it was
// not expecting.
//
// THE POSTER IS THE EVIDENCE GALLERY'S OWN PICKER
// Not a second implementation of it. VideoFramePicker captures a frame a
// second in as soon as the file is readable, lets the owner scrub to a better
// one, and hands back a real image blob; the upload carries it, and the server
// re-encodes it through the same sharp pipeline every other picture on this
// profile goes through. A frame that fails costs the poster and nothing else.
//
// THE PREVIEW ASKS FOR A SIGNED LINK, LIKE EVERY OTHER READER
// Not the local file, and not a stored path. The owner watching their own
// video goes through the same signing route a recruiter does, so what they are
// checking is what will actually play - poster included.
// ============================================================================

const MAX_BYTES = 50 * 1024 * 1024
const ACCEPT = 'video/mp4,video/webm'

const humanSize = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return null
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Reads what the browser can tell us about the file without uploading it.
function inspect(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const probe = document.createElement('video')
    probe.preload = 'metadata'
    const done = (result) => {
      URL.revokeObjectURL(url)
      probe.removeAttribute('src')
      resolve(result)
    }
    probe.onloadedmetadata = () => done({
      width: probe.videoWidth,
      height: probe.videoHeight,
      duration: probe.duration
    })
    // A file the browser cannot read is one it will not play back either, so
    // there is no point uploading it to find out.
    probe.onerror = () => done(null)
    probe.src = url
  })
}

export default function ImowVideoField() {
  const edit = useProfileEdit()
  const notify = useNotify()

  const [busy, setBusy] = useState(null)      // 'upload' | 'remove' | null
  const [progress, setProgress] = useState(0)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewPoster, setPreviewPoster] = useState(null)
  // The file waiting to be uploaded, and the shape read off it. Held so the
  // frame picker has something to work on before anything leaves the browser.
  const [pending, setPending] = useState(null)
  const inputRef = useRef(null)

  // The captured still, in a ref rather than state: it changes on every scrub
  // and nothing renders it except the picker itself, which holds its own copy.
  const poster = useRef(null)
  const onFrame = useCallback((frame) => { poster.current = frame }, [])

  const hasVideo = edit?.imowHasVideo === true

  // Read off the context once rather than called through it, so this callback
  // depends on the function and not on the whole edit object - which changes
  // on every keystroke anywhere in the editor.
  const authFor = edit?.getAuthHeaders

  // The same link a reader gets. Fetched here rather than held, so what the
  // owner is checking is what will actually play.
  const loadPreview = useCallback(async () => {
    if (!hasVideo || !edit?.slug) { setPreviewUrl(null); setPreviewPoster(null); return }
    try {
      const res = await fetch(
        `/api/career-profile/${encodeURIComponent(edit.slug)}/imow-video`,
        { headers: authFor ? await authFor() : {} }
      )
      if (!res.ok) { setPreviewUrl(null); setPreviewPoster(null); return }
      const payload = await res.json()
      setPreviewUrl(payload?.url || null)
      setPreviewPoster(payload?.poster_url || null)
    } catch {
      setPreviewUrl(null)
      setPreviewPoster(null)
    }
  }, [hasVideo, edit?.slug, authFor])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => { if (!cancelled) loadPreview() })
    return () => { cancelled = true }
  }, [loadPreview])

  if (!edit?.editing) return null

  // Everything a browser can refuse without spending an upload. The shape is
  // read here too, and is no longer a reason to refuse anything.
  async function choose(file) {
    setPending(null)
    poster.current = null
    if (!file) return

    if (!/^video\/(mp4|webm)$/.test(file.type)) {
      notify({ type: 'error', message: 'Upload an MP4 or WebM video.' })
      return
    }
    if (file.size > MAX_BYTES) {
      notify({ type: 'error', message: `That video is ${humanSize(file.size)}. The limit is 50MB.` })
      return
    }

    const meta = await inspect(file)
    if (!meta || !meta.width || !meta.height) {
      notify({ type: 'error', message: "We couldn't read that video. Try exporting it as MP4." })
      return
    }

    // Held rather than uploaded. The picker needs the file to draw a frame
    // from, and the owner may want a different frame than the one it takes by
    // default, so the upload waits for them to say so.
    setPending({ file, width: meta.width, height: meta.height })
  }

  async function upload() {
    if (!pending || busy) return
    setBusy('upload')
    setProgress(0)
    try {
      await edit.onUploadImowVideo(pending.file, {
        onProgress: setProgress,
        poster: poster.current,
        width: pending.width,
        height: pending.height
      })
      setPending(null)
      poster.current = null
      await loadPreview()
      if (inputRef.current) inputRef.current.value = ''
    } catch (err) {
      notify({ type: 'error', message: err?.message || "We couldn't upload that. Please try again." })
    } finally {
      setBusy(null)
      setProgress(0)
    }
  }

  function cancelPending() {
    setPending(null)
    poster.current = null
    if (inputRef.current) inputRef.current.value = ''
  }

  async function remove() {
    const ok = window.confirm(
      'Remove your video?\n\n' +
      'The file is deleted. If you have written text it takes the place of the video; if not, the section comes off your profile.'
    )
    if (!ok) return
    setBusy('remove')
    try {
      await edit.onRemoveImowVideo()
      setPreviewUrl(null)
      setPreviewPoster(null)
    } catch (err) {
      notify({ type: 'error', message: err?.message || "We couldn't remove that. Please try again." })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="hp-ed-vid">
      {/* The help comes first now. Somebody deciding whether to record
          anything needs the reason and the limits before the button, not
          underneath it where it reads as small print about a thing they have
          already done. */}
      <p className="hp-ed-proof-note">
        Prefer to speak directly to an employer? Upload a short video and let them hear
        what sets you apart. Landscape or portrait, MP4 or WebM, up to 50MB.
      </p>

      {/* What is already on the profile, unless a new file is waiting - two
          players side by side would be two videos asking to be judged. */}
      {!pending && hasVideo && previewUrl ? (
        <video
          className="hp-ed-vid-preview"
          src={previewUrl}
          poster={previewPoster || undefined}
          controls
          preload="metadata"
          playsInline
        />
      ) : !pending && hasVideo ? (
        <div className="hp-ed-vid-preview" data-waiting="true" aria-hidden="true" />
      ) : null}

      {/* The gallery's own picker, unchanged, on the file not yet uploaded.
          It takes a frame a second in by itself, so leaving it alone is a
          real poster rather than nothing. */}
      {pending ? (
        <VideoFramePicker file={pending.file} onFrame={onFrame} />
      ) : null}

      <div className="hp-ed-row">
        {pending ? (
          <>
            <button
              type="button"
              className="hp-ed-action"
              data-primary="true"
              onClick={upload}
              disabled={Boolean(busy)}
            >
              {busy === 'upload' ? `Uploading… ${progress}%` : (hasVideo ? 'Replace video' : 'Use this video')}
            </button>
            <button
              type="button"
              className="hp-ed-action"
              onClick={cancelPending}
              disabled={Boolean(busy)}
            >
              Choose another
            </button>
          </>
        ) : (
          <label className="hp-ed-action" data-primary={hasVideo ? undefined : 'true'}>
            {hasVideo ? 'Replace video' : 'Upload a video'}
            <input
              ref={inputRef}
              type="file"
              className="hp-ed-file-input"
              accept={ACCEPT}
              disabled={Boolean(busy)}
              onChange={e => choose(e.target.files?.[0] || null)}
            />
          </label>
        )}

        {hasVideo && !pending ? (
          <button
            type="button"
            className="hp-ed-action hp-ed-danger"
            onClick={remove}
            disabled={Boolean(busy)}
          >
            {busy === 'remove' ? 'Removing…' : 'Remove'}
          </button>
        ) : null}
      </div>
    </div>
  )
}
