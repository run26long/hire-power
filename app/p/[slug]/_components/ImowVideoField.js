'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useProfileEdit, useNotify } from '../_lib/editContext'

// ============================================================================
// THE VIDEO HALF OF IN MY OWN WORDS, IN THE EDITOR
//
// Choose a file, watch it upload, see it play back, replace it or take it down.
//
// SIXTEEN BY NINE IS CHECKED HERE AND NOWHERE ELSE
// There is no ffprobe on the server and sharp does not read video containers,
// so the only place a file's dimensions can be known without writing an MP4
// box parser is a <video> element in a browser. That is what this does: load
// the metadata locally, read videoWidth and videoHeight, and refuse a shape
// that is not landscape before spending an upload on it.
//
// It is a real check for a real person and it is not a security boundary. A
// crafted request skips it entirely, which is why the public frame is
// aspect-ratio 16/9 with object-fit contain: a portrait video that gets past
// this letterboxes inside the frame instead of breaking the column. The worst
// outcome is an ugly video, not a broken page.
//
// THE PREVIEW ASKS FOR A SIGNED LINK, LIKE EVERY OTHER READER
// Not the local file, and not a stored path. The owner watching their own
// video goes through the same signing route a recruiter does, so what they are
// checking is what will actually play.
// ============================================================================

const MAX_BYTES = 50 * 1024 * 1024
const ACCEPT = 'video/mp4,video/webm'

// A tolerance, because a 1920x1081 export is 16:9 and a 1080x1920 phone video
// is not. This separates landscape from portrait and square rather than
// policing the exact ratio.
const MIN_RATIO = 1.2

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
  const inputRef = useRef(null)

  const hasVideo = edit?.imowHasVideo === true

  // The same link a reader gets. Fetched here rather than held, so what the
  // owner is checking is what will actually play.
  const loadPreview = useCallback(async () => {
    if (!hasVideo || !edit?.slug) { setPreviewUrl(null); return }
    try {
      const res = await fetch(
        `/api/career-profile/${encodeURIComponent(edit.slug)}/imow-video`,
        { headers: edit.authHeaders || {} }
      )
      if (!res.ok) { setPreviewUrl(null); return }
      const payload = await res.json()
      setPreviewUrl(payload?.url || null)
    } catch {
      setPreviewUrl(null)
    }
  }, [hasVideo, edit?.slug, edit?.authHeaders])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => { if (!cancelled) loadPreview() })
    return () => { cancelled = true }
  }, [loadPreview])

  if (!edit?.editing) return null

  async function choose(file) {
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
    if (meta.width / meta.height < MIN_RATIO) {
      notify({ type: 'error', message: `That video is ${meta.width} by ${meta.height}, which is portrait or square. ` +
        'Record or export it landscape, sixteen by nine.' })
      return
    }

    setBusy('upload')
    setProgress(0)
    try {
      await edit.onUploadImowVideo(file, { onProgress: setProgress })
      await loadPreview()
      if (inputRef.current) inputRef.current.value = ''
    } catch (err) {
      notify({ type: 'error', message: err?.message || "We couldn't upload that. Please try again." })
    } finally {
      setBusy(null)
      setProgress(0)
    }
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
    } catch (err) {
      notify({ type: 'error', message: err?.message || "We couldn't remove that. Please try again." })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="hp-ed-vid">
      <p className="hp-ed-field-label">Video</p>

      {hasVideo && previewUrl ? (
        <video className="hp-ed-vid-preview" src={previewUrl} controls preload="metadata" playsInline />
      ) : hasVideo ? (
        <div className="hp-ed-vid-preview" data-waiting="true" aria-hidden="true" />
      ) : null}

      <div className="hp-ed-row">
        <label className="hp-ed-action" data-primary={hasVideo ? undefined : 'true'}>
          {busy === 'upload'
            ? `Uploading… ${progress}%`
            : hasVideo ? 'Replace video' : 'Upload a video'}
          <input
            ref={inputRef}
            type="file"
            className="hp-ed-file-input"
            accept={ACCEPT}
            disabled={Boolean(busy)}
            onChange={e => choose(e.target.files?.[0] || null)}
          />
        </label>

        {hasVideo ? (
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

      <p className="hp-ed-proof-note">
        MP4 or WebM, landscape sixteen by nine, up to 50MB. It plays on your profile above the
        text, and a reader can still read the words if they would rather not watch.
      </p>
    </div>
  )
}
