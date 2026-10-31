'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { DeleteSessionModal } from '@/app/components/interview/PracticeLeftPanel'
import { useProfileEdit, useNotify } from '../_lib/editContext'
import VideoFramePicker from './VideoFramePicker'

// ============================================================================
// THE VIDEO HALF OF IN MY OWN WORDS, IN THE EDITOR
//
// Choose a file, pick the frame it shows, watch it upload, see it play back,
// replace it or delete it.
//
// A HOOK AND A BODY, BECAUSE THE CONTROLS ARE NOT IN THE BODY ANY MORE
// This was one component that rendered the preview, the picker and its own row
// of buttons. The buttons now belong to the dialog's pinned footer, which is a
// sibling of the dialog's body and therefore nowhere this component could
// reach. So the state moved up: useImowVideo owns everything, ImowVideoBody
// renders the part that scrolls, and Tell your story places the controls
// itself. There is still exactly one copy of each piece of behaviour.
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
//
// DELETING IS ASKED IN THE PROFILE'S OWN DIALOG
// It used to be window.confirm, which blocks the tab, cannot be styled, reads
// as a browser warning rather than as part of this product, and on some
// platforms puts the destructive choice where the safe one usually goes. It is
// now DeleteSessionModal - the same confirmation evidence and testimonials
// ask in - portalled into the same raised layer they use, because a dialog
// rendered inside this one would be measured inside it and could not stand
// over the thing that asked the question.
// ============================================================================

const MAX_BYTES = 50 * 1024 * 1024
const ACCEPT = 'video/mp4,video/webm'

// Said on the Video tab, under the middle of the dialog - the place the
// written tab puts its character count. Both are the same kind of line: the
// one fact about the thing in the frame above that the owner needs while they
// are deciding what to put there.
export const VIDEO_HELP = 'Landscape or portrait, MP4 or WebM, up to 50MB.'

// And what that line says while the frame picker is in the middle, which is
// the one state where the owner has something to do inside the box rather
// than a decision to make about it. The specs stay: the file is still not
// uploaded and still has to satisfy them.
//
// This is where the picker's own help sentence went. It used to be a third
// line inside the picker, under the button, and the picker is the dialog's
// middle now - a box with one fixed height and no room for a paragraph in it.
// So it moved out to the line that was already there, which is also where
// somebody looking at the box would read it. See the `compact` prop on
// VideoFramePicker.
export const FRAME_HELP =
  'Drag the slider to the frame you want as your thumbnail, then click Use this frame.'

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

/**
 * Everything the video half does, with nothing rendered.
 *
 * `active` is whether the dialog holding it is open. It gates the one thing
 * here that costs anything: asking the signing route for a playable link. The
 * hook is called from the editor's top level, which is mounted for the life of
 * the section, so without this every profile in Edit mode would sign a video
 * URL on load for a dialog nobody had opened.
 *
 * `onUploaded` is called after a video has landed and the records have been
 * re-read, so the dialog can decide what happens next - which is not this
 * hook's business: uploading is the same act whether the dialog then closes
 * or stays open.
 */
export function useImowVideo({ active = true, onUploaded } = {}) {
  const edit = useProfileEdit()
  const notify = useNotify()

  const [busy, setBusy] = useState(null)      // 'upload' | 'delete' | null
  const [progress, setProgress] = useState(0)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewPoster, setPreviewPoster] = useState(null)
  // The file waiting to be uploaded, and the shape read off it. Held so the
  // frame picker has something to work on before anything leaves the browser.
  const [pending, setPending] = useState(null)
  // Whether the delete question is up. Not a boolean about "something": there
  // is only ever one video, so there is nothing to name.
  const [asking, setAsking] = useState(false)

  // Which round of choosing this is. It keys the file input, so a file that
  // has been dealt with - uploaded, or put back - leaves a fresh input behind
  // it. Without that, a browser still holding the same selection fires no
  // change event when the owner picks that same file again.
  //
  // A counter rather than a ref to the input. The control that holds the
  // input is rendered from this hook's return value, and a ref travelling in
  // that object is a ref the compiler has to assume is read during render.
  const [round, setRound] = useState(0)

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
    if (!active || !hasVideo || !edit?.slug) { setPreviewUrl(null); setPreviewPoster(null); return }
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
  }, [active, hasVideo, edit?.slug, authFor])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => { if (!cancelled) loadPreview() })
    return () => { cancelled = true }
  }, [loadPreview])

  // Everything a browser can refuse without spending an upload. The shape is
  // read here too, and is no longer a reason to refuse anything.
  const choose = useCallback(async (file) => {
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
  }, [notify])

  // Returns whether it worked, because the caller may be in the middle of
  // leaving and a failed upload is a reason to stay.
  const upload = useCallback(async () => {
    if (!pending || busy) return false
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
      setRound(n => n + 1)
      onUploaded?.()
      return true
    } catch (err) {
      notify({ type: 'error', message: err?.message || "We couldn't upload that. Please try again." })
      return false
    } finally {
      setBusy(null)
      setProgress(0)
    }
  }, [pending, busy, edit, loadPreview, notify, onUploaded])

  const cancelPending = useCallback(() => {
    setPending(null)
    poster.current = null
    setRound(n => n + 1)
  }, [])


  // ---- CHANGING THE THUMBNAIL OF A VIDEO THAT IS ALREADY STORED ----
  //
  // The upload flow holds a captured frame in `poster` and sends it with the
  // file. There is no file here and nothing to wait for, so pressing "Use this
  // frame" on a stored video is the save: the frame goes up on its own and the
  // row is repointed at it.
  //
  // That is why this is a different callback and not the same `onFrame`. The
  // picker is the same picker and the button says the same thing; what a
  // captured frame MEANS differs by what is holding it, and only the holder
  // knows.
  //
  // NOTHING IS RELOADED AFTERWARDS, AND THAT IS THE POINT
  //
  // This used to call loadPreview() on the way out, to put the new poster URL
  // on the player behind the picker. The cost of that was the whole of what
  // the owner saw: loadPreview signs a fresh URL, previewUrl is the picker's
  // `src`, and a changed src is a changed `source` - which trips the reset in
  // VideoFramePicker and re-assigns video.src. So the film jumped back to its
  // first frame, the scrubber went to zero and the time readout emptied, one
  // beat after a line saying the frame had been kept. It read as a save that
  // had not taken.
  //
  // There was nothing to gain by it either. The picker is what is on screen
  // here and it never reads previewPoster - it is a player on the video
  // itself, and the still is not part of what it shows. The profile card is
  // what needs the new poster, and it gets there on its own: the save
  // re-reads the document, imow_poster_version changes, and the card
  // re-signs. See posterVersion in ./ImowVideo.
  //
  // Reopening the dialog signs everything again anyway, through the effect on
  // `active`, so previewPoster is never stale for longer than this one
  // dialog session - and for that session it is not read.
  //
  // What the owner is left with is the element untouched: paused where they
  // left it, on the frame they chose, with the scrubber and the time where
  // they put them.
  //
  // A failure leaves the stored poster exactly as it was - the route says so
  // and so does the toast. Nothing here clears anything on the way.
  const [savingPoster, setSavingPoster] = useState(false)
  const [posterSaved, setPosterSaved] = useState(false)

  const saveStoredFrame = useCallback(async (frame) => {
    if (!frame?.blob || !edit?.onSaveImowPoster || savingPoster) return
    setSavingPoster(true)
    setPosterSaved(false)
    try {
      await edit.onSaveImowPoster(frame)
      setPosterSaved(true)
    } catch (err) {
      notify({
        type: 'error',
        message: err?.message || "We couldn't save that frame. Your current thumbnail is unchanged."
      })
    } finally {
      setSavingPoster(false)
    }
  }, [edit, savingPoster, notify])

  const askDelete = useCallback(() => setAsking(true), [])
  const cancelDelete = useCallback(() => { if (busy !== 'delete') setAsking(false) }, [busy])

  const confirmDelete = useCallback(async () => {
    if (busy) return
    setBusy('delete')
    try {
      await edit.onRemoveImowVideo()
      setAsking(false)
      setPreviewUrl(null)
      setPreviewPoster(null)
    } catch (err) {
      // The question has been answered either way. The failure is reported by
      // the toast, which stands above this layer.
      setAsking(false)
      notify({ type: 'error', message: err?.message || "We couldn't delete that. Please try again." })
    } finally {
      setBusy(null)
    }
  }, [busy, edit, notify])

  // The profile's own confirmation, in the layer that clears this dialog. The
  // body is the sentence this control has always carried, because what happens
  // to the section when the file goes is the thing somebody needs to know
  // before they answer.
  const deleteModal = asking && typeof document !== 'undefined'
    ? createPortal(
        <div className="hp-ed-modal-layer-raised">
          <DeleteSessionModal
            deleting={busy === 'delete'}
            onCancel={cancelDelete}
            onConfirm={confirmDelete}
            title="Delete this video?"
            body={
              'The file is deleted. If you have written text it takes the place of the video; ' +
              "if not, the section comes off your profile. This can't be undone."
            }
            confirmLabel="Delete"
          />
        </div>,
        document.body
      )
    : null

  return {
    hasVideo,
    pending: Boolean(pending),
    pendingFile: pending?.file || null,
    busy,
    progress,
    previewUrl,
    previewPoster,
    // Where the stored poster was captured, or null for one taken before
    // the offset was recorded. The picker opens there.
    posterAt: edit?.imowPosterAt ?? null,
    // The stored half of the frame picker: whether this account can change a
    // thumbnail at all, the action, and the two flags the picker row reads.
    canSavePoster: Boolean(edit?.onSaveImowPoster),
    saveStoredFrame,
    savingPoster,
    posterSaved,
    round,
    accept: ACCEPT,
    onFrame,
    choose,
    upload,
    cancelPending,
    askDelete,
    // Whether the question is up, and the way to put it away. The dialog above
    // needs both: ProfileModal's Escape is a capture listener on the document
    // and fires before this confirmation's own, so without somewhere to send
    // that key, Escape would close the editor and leave the question standing
    // over the page on its own.
    asking,
    cancelDelete,
    deleteModal,
    // Whether this account has the delete at all. Taking a video down is
    // never gated - an account that lapses must still be able to - so this is
    // only about the op existing on the context.
    canDelete: Boolean(edit?.onRemoveImowVideo)
  }
}

/**
 * The video tab's middle: whatever belongs in the space the written tab gives
 * its box of text, at the same width. One of three things, never two - a
 * player and a picker side by side would be two films asking to be judged.
 *
 *   nothing uploaded yet   the area that opens the file picker
 *   a file chosen          the frame picker, on the file in the browser
 *   a video stored         that video, in the picker, so the thumbnail can
 *                          be changed at any time
 *
 * The last two are the same picker component. What differs is where the
 * frame goes when it is captured: into the pending upload, or straight to
 * the row. See saveStoredFrame in the hook.
 *
 * Its controls are the dialog's footer and are not here. The specs line under
 * it is the dialog's, for the same reason the character count is: it is one
 * line about the frame above, in the same place on both tabs.
 */
export function ImowVideoBody({ video }) {
  if (video.pending) {
    // The gallery's own picker, unchanged. It takes a frame a second in by
    // itself, so leaving it alone is a real poster rather than nothing. Use
    // this frame belongs to it.
    return (
      <div className="hp-ed-vid hp-ed-imow-middle">
        <VideoFramePicker file={video.pendingFile} onFrame={video.onFrame} compact />
      </div>
    )
  }

  if (video.hasVideo) {
    // ---- THE STORED VIDEO, AND THE SAME PICKER OVER IT ----
    //
    // The picker replaces the plain player rather than standing under it. It
    // IS a player - the same stage, the same controls - plus a scrubber, Use
    // this frame and the time, so keeping both would be the film twice in a
    // box sized for one.
    //
    // It is fed the signed URL the player was already using, so nothing extra
    // is fetched and there is no second request to go wrong. Until that URL
    // arrives the waiting mat stands where it always did, which is also what
    // the picker's own "neither" guard would have produced.
    //
    // Only where this account can actually save one. Free never reaches here
    // at all - the locked tab is drawn in ImowEditor - but canSavePoster is
    // about the op existing on the context, and a picker whose button could
    // not store anything would be a control that lies.
    if (video.canSavePoster && video.previewUrl) {
      return (
        <div className="hp-ed-vid hp-ed-imow-middle">
          <VideoFramePicker
            src={video.previewUrl}
            onFrame={video.saveStoredFrame}
            // Nothing is captured until the owner presses the button. See
            // autoCapture in VideoFramePicker: the frame this hands back is
            // saved, so an automatic one would replace their poster on open.
            autoCapture={false}
            // Opens on the frame behind the stored poster. Null opens at the
            // start, which is every video from before the offset was kept.
            startAt={video.posterAt}
            compact
          />
        </div>
      )
    }

    return (
      <div className="hp-ed-vid hp-ed-imow-middle">
        {video.previewUrl ? (
          <video
            className="hp-ed-vid-preview"
            src={video.previewUrl}
            poster={video.previewPoster || undefined}
            controls
            preload="metadata"
            playsInline
          />
        ) : (
          <div className="hp-ed-vid-preview" data-waiting="true" aria-hidden="true" />
        )}
      </div>
    )
  }

  // Nothing yet. The area is the picker, in the space the box of text
  // occupies on the other tab, so the frame does not change size when the
  // owner moves between them. The footer's Upload a video opens the same
  // dialog; two ways in, one input each, neither standing for the other.
  return (
    <label className="hp-ed-add-choice hp-ed-imow-middle hp-ed-imow-drop">
      <span className="hp-ed-add-choice-title">Upload a video</span>
      <span className="hp-ed-add-choice-note">
        Speak directly to an employer and let them hear what sets you apart.
      </span>
      <input
        key={video.round}
        type="file"
        className="hp-ed-file-input"
        accept={video.accept}
        disabled={Boolean(video.busy)}
        onChange={e => video.choose(e.target.files?.[0] || null)}
      />
    </label>
  )
}

/**
 * Choosing a file: a real <input type="file"> inside the button, so the press
 * that says "upload" is the press that opens the picker. Taken out of sight
 * rather than display:none, because a hidden input is not focusable.
 *
 * It wears the Manage panels' buttons like everything else in this footer,
 * which is why it is a <label> with one of their classes rather than
 * .hp-ed-action.
 */
export function ImowVideoChoose({ video, label, primary = false }) {
  return (
    <label className={primary ? 'hp-manage-done' : 'hp-manage-secondary'} data-file="true">
      {label}
      <input
        key={video.round}
        type="file"
        className="hp-ed-file-input"
        accept={video.accept}
        disabled={Boolean(video.busy)}
        onChange={e => video.choose(e.target.files?.[0] || null)}
      />
    </label>
  )
}
