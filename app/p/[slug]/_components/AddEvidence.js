'use client'

import { useCallback, useRef, useState } from 'react'
import DirectionPicker from './DirectionPicker'
import BrandSelect from './BrandSelect'
import { useProfileEdit, useNotify } from '../_lib/editContext'
import { EVIDENCE_TYPES, FAMILY_LABELS, familyForType } from '@/lib/evidenceTypes'
import { titleFromFileName } from '@/lib/fileTitles'
import {
  ACCEPT_ATTRIBUTE, VISUAL_ACCEPT_ATTRIBUTE, MAX_UPLOAD_BYTES, humanSize, uploadTypeFor
} from '@/lib/evidenceUploads'
import VideoFramePicker from './VideoFramePicker'
import ProfileModal from './ProfileModal'

// ============================================================================
// ADDING EVIDENCE
//
// Two ways in, three steps, and all of them in one dialog over the page.
//
// WHY THIS IS A DIALOG AND NOT A PANEL
// It used to open inline underneath the section, which meant the act of
// starting made the page taller and pushed everything below it down, and each
// step after that changed the height again. Adding a piece of work is a short
// errand with an end: it belongs on its own surface, over a page that stays
// exactly where it was, and the page is unchanged again the moment it closes.
//
// The surface is the one the Career Q&A answer established and is reached
// through ProfileModal, which owns the portal, the focus trap, Escape, the
// scroll lock and where focus goes afterwards. Nothing about how a dialog
// behaves is decided in this file.
//
// WHY THE LOOKUP IS OPTIONAL AND NEVER BLOCKING
// A pasted link is read server-side for the title and description the page
// advertises about itself, which saves retyping. But plenty of pages carry no
// OG tags, some refuse to be read at all, and none of that should stop
// somebody adding their own work. So a failed lookup moves straight on to the
// form with the fields empty and says what happened, rather than standing in
// the way with an error.
//
// EVERYTHING IT FINDS IS A SUGGESTION
// The values arrive in fields the owner can see and change before anything is
// stored. Text from a stranger's page is not a fact about this person's
// career, and a preview that wrote itself in would let somebody else's server
// author a line on somebody's profile.
//
// THE IMAGE IS SHOWN, AND KEPT ONLY IF IT IS ASKED FOR
// og:image is rendered as a small preview so the owner can tell they pasted
// the right link. The address itself is never stored and a profile never
// points at it: a remote image on a public page is a hotlink to a server that
// can swap it for anything later.
//
// What the switch under it decides is whether we take our own copy. On - which
// is the default, because a link that shows what it is beats a link that shows
// a grey icon - the route fetches that image once through the same guard the
// preview went through, decodes it to prove it is a picture, re-encodes it and
// stores it in our bucket. What a reader is served is an object this server
// made, and it cannot change afterwards.
//
// Off, or no image, or a fetch that fails, all end the same way: the item
// saves and draws its icon. None of them stops the save, and the switch in the
// item's edit pane can try again later.
// ============================================================================

const EMPTY = {
  url: '',
  title: '',
  description: '',
  evidence_type: '',
  organization: '',
  date_label: ''
}

// Grouped the way the list is ordered, so the dropdown reads as three kinds of
// thing rather than thirteen options.
const GROUPED = Object.entries(
  EVIDENCE_TYPES.reduce((acc, item) => {
    ;(acc[item.family] ||= []).push(item.type)
    return acc
  }, {})
)

// `only="visual"` is the Portfolio's copy of this form: the same three steps
// and the same save, with the picker narrowed to images and video and the link
// route absent, because a link is not a portfolio piece. One component rather
// than two, so a change to how evidence is added cannot reach one section and
// miss the other.
// `openSignal` is a counter the section increments when something outside this
// component asks it to open: the guidance inside the first empty slot, which is
// where the owner is actually looking when they decide to add something. A
// counter rather than a boolean, so asking twice works and this component keeps
// sole ownership of which step it is on.
export default function AddEvidence({ only = null, openSignal = 0, trigger = true }) {
  const visualOnly = only === 'visual'
  const edit = useProfileEdit()
  const notify = useNotify()

  // 'closed' | 'choose' | 'link' | 'form' | 'done'
  const [step, setStep] = useState('closed')

  // Opened from outside. Compared rather than watched with an effect, so the
  // step changes during the same render that carries the new signal.
  const [sawSignal, setSawSignal] = useState(openSignal)
  if (sawSignal !== openSignal) {
    setSawSignal(openSignal)
    if (openSignal > 0 && step === 'closed') setStep('choose')
  }
  const [saved, setSaved] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [lensIds, setLensIds] = useState([])
  const [scope, setScope] = useState('all')
  const [preview, setPreview] = useState(null)
  // Whether the page's own image becomes this item's thumbnail. On by default:
  // the owner is looking at the picture while they decide, and a tile that
  // shows the thing beats a tile that shows a grey mark. Only ever consulted
  // where there is an image to use.
  const [useThumb, setUseThumb] = useState(true)
  const [looking, setLooking] = useState(false)
  const [note, setNote] = useState(null)
  const [saving, setSaving] = useState(false)
  // The chosen file, and how far its upload has got. A file being set is what
  // makes this an upload rather than a link: the form below is the same either
  // way, and only the save differs.
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  // The chosen video frame and how long the video runs. Both are produced by
  // the browser because nothing on the server can read either one, and both
  // are held in refs: they change while the owner scrubs, and re-rendering the
  // whole form on every seek would fight the player they are scrubbing.
  const poster = useRef(null)
  const duration = useRef(null)
  const onFrame = useCallback((frame) => { poster.current = frame }, [])
  const onDuration = useCallback((seconds) => { duration.current = seconds }, [])

  if (!edit?.editing) return null

  // Every direction the owner could place this on, which is more than the
  // ones on the public page: a direction turned off is one they can turn back
  // on, and filing something there now is reasonable.
  const lenses = edit.allLenses || edit.lenses || []
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))

  function reset() {
    setStep('closed')
    setSaved(null)
    setForm(EMPTY)
    setLensIds([])
    setPreview(null)
    setUseThumb(true)
    setNote(null)    setFile(null)
    setProgress(0)
    poster.current = null
    duration.current = null
  }

  async function lookUp() {
    const url = form.url.trim()
    if (!url || looking) return
    setLooking(true)
    setNote(null)    try {
      const result = await edit.onPreviewUrl(url)
      if (result?.ok && result.preview) {
        setPreview(result.preview)
        setForm(f => ({
          ...f,
          // The URL the fetch actually ended on, so a shortener stores its
          // destination rather than a redirect that may stop redirecting.
          url: result.preview.url || f.url,
          title: f.title || result.preview.title || '',
          description: f.description || result.preview.description || ''
        }))
      } else {
        setNote(result?.reason || "We couldn't read that page. Fill in the details yourself.")
      }
    } catch {
      setNote("We couldn't read that page. Fill in the details yourself.")
    } finally {
      setLooking(false)
      setStep('form')
    }
  }

  // The file is chosen here and sent here, straight to storage. It does not
  // pass through the app on the way in, which is what keeps a 50MB video out
  // of a request body; the server's part is deciding where it may go and, once
  // it is there, what the record says about it.
  function chooseFile(picked) {    // A new file means the frame and the duration belonging to the last one
    // are gone, whether or not the new one produces its own.
    poster.current = null
    duration.current = null
    if (!picked) { setFile(null); return }
    const kind = uploadTypeFor(picked.type)
    if (!kind) {
      setFile(null)
      notify({ type: 'error', message: 'That kind of file cannot be added yet. Images, PDF, Word documents and video.' })
      return
    }
    // The picker's accept attribute already says this, and an accept attribute
    // is a suggestion: a file can still arrive by drag or by a picker that
    // ignores it.
    if (visualOnly && kind.media_class !== 'image' && kind.media_class !== 'video') {
      setFile(null)
      notify({ type: 'error', message: 'The portfolio shows images and video. Other files belong in Evidence.' })
      return
    }
    if (picked.size > MAX_UPLOAD_BYTES) {
      setFile(null)
      notify({ type: 'error', message: `That file is ${humanSize(picked.size)}. The limit is 50MB.` })
      return
    }
    setFile(picked)
    // A filename is the best guess at a title anybody has - for a file
    // somebody named. For one the camera named it is worse than nothing, and
    // IMG_4312 in the Title field is an answer the owner has to delete before
    // they can write theirs. titleFromFileName returns '' for those, which
    // leaves the placeholder to do its job; everything else arrives with its
    // extension removed, as before, and is edited like any other field. The
    // rule is written out in lib/fileTitles.
    setForm(f => ({ ...f, title: f.title || titleFromFileName(picked.name) }))
    setStep('form')
  }

  async function save() {
    if (saving) return
    setSaving(true)    try {
      const details = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        evidence_type: form.evidence_type,
        organization: form.organization.trim() || null,
        date_label: form.date_label.trim() || null,
        placement_scope: scope,
        lens_ids: lensIds
      }
      const created = file
        // The link rides with the rest of the detail, so the finish call that
        // writes the row writes it too. Empty stays empty rather than becoming
        // an empty string the column would have to interpret.
        ? await edit.onUploadEvidence(file, { ...details, url: form.url.trim() || null }, {
            onProgress: setProgress,
            setUploading,
            // Both null for anything that is not a video, and both optional
            // for one: a video whose frame could not be captured still saves,
            // and shows the play mark the way every video did before.
            poster: poster.current,
            durationSeconds: duration.current
          })
        // The address the preview showed, and whether to keep a copy of it.
        // Both are absent on a page that advertised no image, so the route
        // has nothing to fetch and the question never arises.
        : await edit.onCreateEvidence({
            ...details,
            url: form.url.trim(),
            thumbnail_url: preview?.image || null,
            use_thumbnail: Boolean(preview?.image) && useThumb
          })
      // Not closed on success. A new item goes to the end of the collection,
      // and the section shows the first few - so on a profile with a dozen
      // pieces the tile is real, placed, and off the bottom of the preview.
      // Saying so is better than a panel that closes onto a page that looks
      // unchanged.
      setSaved({
        title: form.title.trim(),
        warning: created?.warning || null,
        where: scope === 'all'
          ? null
          : lenses.filter(l => lensIds.includes(l.id)).map(l => l.name)
      })
      setForm(EMPTY)
      setScope('all')
      setLensIds([])
      setPreview(null)
      setUseThumb(true)
      setNote(null)
      setFile(null)
      setProgress(0)
      setStep('done')
    } catch (err) {
      notify({ type: 'error', message: err?.message || "We couldn't save that. Please try again." })
    } finally {
      setSaving(false)
      setUploading(false)
    }
  }

  // ---- the way in ----
  //
  // The trigger stays in the document while the dialog is over it, so there is
  // something for focus to come back to when it closes, and so the section
  // behind does not reflow as the flow opens and shuts. While a section is
  // empty its own guidance slot carries the action instead and `trigger` is
  // false; focus then returns to that slot's own button, which is where the
  // owner pressed.
  const family = familyForType(form.evidence_type)
  // A link needs its address; an upload needs its file. Both need a title and
  // a type, and the rest of the form is identical.
  const hasSource = file ? true : Boolean(form.url.trim())
  const canSave = Boolean(hasSource && form.title.trim() && family) && !saving

  // The dialog's own heading, which names the thing being added. The submit
  // below says Save for every kind: the button carries out the form, and what
  // kind of thing is being saved is already the heading above it.
  const title = visualOnly ? 'Add a photo or video' : 'Add evidence'

  // ---- WHERE THIS STEP GOES BACK TO ----
  //
  // The form was reached either from the chooser, by picking a file, or from
  // the link step, by giving an address; it goes back to whichever of the two
  // it came from. The link step came from the chooser. The chooser is the
  // first screen and the finished screen is the last, so neither has a Back.
  const backTo = step === 'form'
    ? (file ? 'choose' : 'link')
    : step === 'link' ? 'choose' : null

  // ---- THE FOOTER ----
  //
  // Back at the far left, then the ways out and the way on grouped at the
  // right with the primary furthest right. It is the house row, and the house
  // row is what every other footer on this profile now carries: the edit
  // panes, the Manage panels, the field editors.
  //
  // Back stood in that right-hand group until now, on the reasoning that it
  // was one of three ways out of the step rather than a separate decision.
  // That reasoning does not survive the comparison: going back keeps
  // everything typed so far and Cancel throws the whole flow away, which makes
  // them opposites, and putting opposites side by side is how somebody loses
  // four fields to the wrong press. The far left is where this profile puts
  // the control that costs something - Delete in the edit panes, Decline in
  // the review - and it is where Back belongs for the same reason: far from
  // the thumb heading for the primary.
  //
  // The buttons are the Manage panels' own, .hp-manage-secondary and
  // .hp-manage-done, rather than .hp-ed-action's near-identical pair. The two
  // groups are .hp-ed-foot-left and .hp-ed-foot-right, which is the split the
  // dialog footer already lays out; the footer itself is pinned by the dialog,
  // so on the long form the way out is still on screen at the bottom of a
  // scroll.
  const foot = (
    <>
      {backTo ? (
        <span className="hp-ed-foot-left">
          <button
            type="button"
            className="hp-manage-secondary"
            onClick={() => setStep(backTo)}
            disabled={saving}
          >
            Back
          </button>
        </span>
      ) : null}

      <span className="hp-ed-foot-right">
        {/* Once something has been added, the way on is the secondary act and
            finishing is the primary one, so Add another stands to the left of
            Done rather than taking the weight off it. */}
        {step === 'done' ? (
          <button
            type="button"
            className="hp-manage-secondary"
            onClick={() => { setSaved(null); setStep('choose') }}
          >
            Add another
          </button>
        ) : null}

        {/* The one button that is here on every step. On the finished screen
            it is the primary, because leaving with what you came for is what
            that screen is for; everywhere else it is the way out of a step
            that has a primary of its own. */}
        <button
          type="button"
          className={step === 'done' ? 'hp-manage-done' : 'hp-manage-secondary'}
          onClick={reset}
          disabled={saving}
        >
          {step === 'done' ? 'Done' : 'Cancel'}
        </button>

        {step === 'link' ? (
          <button
            type="button"
            className="hp-manage-done"
            onClick={lookUp}
            disabled={!form.url.trim() || looking}
          >
            {looking ? <span className="hp-ed-spin" aria-hidden="true" /> : null}
            {looking ? 'Reading…' : 'Continue'}
          </button>
        ) : null}

        {step === 'form' ? (
          <button
            type="button"
            className="hp-manage-done"
            onClick={save}
            disabled={!canSave}
          >
            {uploading || saving ? <span className="hp-ed-spin" aria-hidden="true" /> : null}
            {uploading ? `Uploading… ${progress}%` : saving ? 'Saving…' : 'Save'}
          </button>
        ) : null}
      </span>
    </>
  )

  return (
    <>
      {trigger ? (
        <div className="hp-ed-add-row">
          <button type="button" className="hp-ed-action" data-primary="true" onClick={() => setStep('choose')}>
            {visualOnly ? '+ Add to portfolio' : '+ Add evidence'}
          </button>
        </div>
      ) : null}

      {/* The portfolio's first screen is one card and two lines. At the form
          width it was mostly empty dialog, which reads as something failing to
          load rather than as a short question. The form that follows a chosen
          file keeps the full width, because it is a form; so does the evidence
          chooser, because two cards side by side need it. */}
      <ProfileModal
        open={step !== 'closed'}
        size={visualOnly && step === 'choose' ? 'compact' : null}
        title={title}
        titleId={`hp-ed-add-title${visualOnly ? '-visual' : ''}`}
        portalClass="hp-ed-portal"
        onClose={reset}
        foot={foot}
      >
        {step === 'choose' && (
          <div className="hp-ed-add-choices">
            {/* No link route in the portfolio. A link to a picture on somebody
                else's site is not something this page can put in a mat, and
                offering it would promise a tile that never appears. */}
            {!visualOnly && (
              <button type="button" className="hp-ed-add-choice" onClick={() => setStep('link')}>
                <span className="hp-ed-add-choice-title">Add a link</span>
                <span className="hp-ed-add-choice-note">
                  An article, a case study, a video, anything with a web address.
                </span>
              </button>
            )}
            {/* A label rather than a button, so the picker opens from the
                same click the choice is made with instead of needing a second
                one on a control that then has to be found. */}
            <label className="hp-ed-add-choice" htmlFor={`hp-ed-ev-file${visualOnly ? '-visual' : ''}`}>
              <span className="hp-ed-add-choice-title">
                {visualOnly ? 'Choose a file' : 'Upload a file'}
              </span>
              <span className="hp-ed-add-choice-note">
                {visualOnly
                  ? 'Upload a photo or video that shows the work, the process, or the result. Up to 50MB.'
                  : 'Images, PDF, Word documents and video from your own machine. Up to 50MB.'}
              </span>
              <input
                id={`hp-ed-ev-file${visualOnly ? '-visual' : ''}`}
                type="file"
                className="hp-ed-file-input"
                accept={visualOnly ? VISUAL_ACCEPT_ATTRIBUTE : ACCEPT_ATTRIBUTE}
                onChange={e => chooseFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>
        )}

        {step === 'link' && (
          <>
            <label className="hp-ed-field-label" htmlFor="hp-ed-ev-paste">Paste the link</label>
            <input
              id="hp-ed-ev-paste"
              className="hp-ed-input hp-ed-block"
              type="url"
              value={form.url}
              placeholder="https://"
              autoFocus
              spellCheck="false"
              onChange={e => set('url', e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); lookUp() } }}
              aria-label="The link to add"
            />
            <p className="hp-ed-proof-note">
              We&apos;ll read the title and description off the page if it publishes them.
              You can change anything before it is saved.
            </p>
          </>
        )}

        {step === 'form' && (
          <>
            {note ? <p className="hp-ed-add-note">{note}</p> : null}

            {preview?.image ? (
              <div className="hp-ed-add-preview">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview.image} alt="" className="hp-ed-add-preview-img" />

                {/* The switch stands beside the picture it decides about,
                    with the sentence saying what each position means under
                    it. On by default. */}
                <span className="hp-ed-add-preview-body">
                  <span className="hp-ed-switch-row">
                    <button
                      type="button"
                      className="hp-ed-switch"
                      role="switch"
                      aria-checked={useThumb}
                      aria-label="Use the page's image as this item's thumbnail"
                      data-on={useThumb ? 'true' : 'false'}
                      disabled={saving}
                      onClick={() => setUseThumb(on => !on)}
                    >
                      <span className="hp-ed-switch-knob" aria-hidden="true" />
                    </button>
                    <span className="hp-ed-switch-label">Use as thumbnail</span>
                  </span>

                  <span className="hp-ed-add-preview-note">
                    {useThumb
                      ? 'We’ll keep our own copy of this picture and show it on the tile. '
                        + 'If it can’t be saved, the item still saves and shows its icon.'
                      : 'Shown so you can check the link. It won’t be saved.'}
                  </span>
                </span>
              </div>
            ) : null}

            {file ? (
              <>
                <p className="hp-ed-field-label">File</p>
                <p className="hp-ed-file-chosen">
                  <span className="hp-ed-file-name">{file.name}</span>
                  <span className="hp-ed-file-meta">
                    {uploadTypeFor(file.type)?.label}
                    {humanSize(file.size) ? ` · ${humanSize(file.size)}` : ''}
                  </span>
                  <button
                    type="button"
                    className="hp-ed-tag-drop"
                    onClick={() => { setFile(null); setStep('choose') }}
                    aria-label="Choose a different file"
                    disabled={saving}
                  >
                    ×
                  </button>
                </p>
                {/* A video needs a picture and there is nothing on the server
                    that can make one, so the frame is chosen here. It captures
                    one on its own as soon as the file is readable; scrubbing and
                    pressing the button replaces it. */}
                {uploadTypeFor(file.type)?.media_class === 'video' ? (
                  <VideoFramePicker file={file} onFrame={onFrame} onDuration={onDuration} />
                ) : null}

                {uploading ? (
                  <p className="hp-ed-proof-note" role="status">
                    Uploading… {progress}%
                  </p>
                ) : null}

                {/* ---- The same work, where it actually lives ----
                    A screenshot of a page is better evidence when the page is
                    one click away, and the two used to be alternatives: the
                    form offered this field only when no file had been chosen,
                    so picking one took the link away. They are not
                    alternatives. The file is what the item shows; this is
                    where the thing it shows can be found. */}
                <label className="hp-ed-field-label" htmlFor="hp-ed-ev-file-url">
                  Link to the live page (optional)
                </label>
                <input
                  id="hp-ed-ev-file-url"
                  className="hp-ed-input hp-ed-block"
                  type="url"
                  value={form.url}
                  placeholder="https://"
                  spellCheck="false"
                  disabled={saving}
                  onChange={e => set('url', e.target.value)}
                />
              </>
            ) : (
              <>
                <label className="hp-ed-field-label" htmlFor="hp-ed-ev-url">Link</label>
                <input
                  id="hp-ed-ev-url"
                  className="hp-ed-input hp-ed-block"
                  type="url"
                  value={form.url}
                  spellCheck="false"
                  onChange={e => set('url', e.target.value)}
                />
              </>
            )}

            <label className="hp-ed-field-label" htmlFor="hp-ed-ev-title">Title</label>
            <input
              id="hp-ed-ev-title"
              className="hp-ed-input hp-ed-block"
              type="text"
              value={form.title}
              placeholder="What is this?"
              onChange={e => set('title', e.target.value)}
            />

            <label className="hp-ed-field-label" htmlFor="hp-ed-ev-desc">Description</label>
            <textarea
              id="hp-ed-ev-desc"
              className="hp-ed-textarea"
              data-size="body"
              rows={3}
              value={form.description}
              placeholder="A sentence on what it shows."
              onChange={e => set('description', e.target.value)}
            />

            {/* The three short ones share a row on a wide dialog and stack on a
                narrow one, which is what the grid already does. Title, link and
                description stay full width above: they are the fields somebody
                actually writes in. */}
            <div className="hp-ed-add-grid">
              <div>
                <label className="hp-ed-field-label" htmlFor="hp-ed-ev-type">Type</label>
                <BrandSelect
                  id="hp-ed-ev-type"
                  value={form.evidence_type}
                  onChange={next => set('evidence_type', next)}
                  disabled={saving}
                  groups={GROUPED.map(([familyKey, types]) => ({
                    label: FAMILY_LABELS[familyKey],
                    options: types
                  }))}
                />
              </div>

              <div>
                <label className="hp-ed-field-label" htmlFor="hp-ed-ev-org">Organization</label>
                <input
                  id="hp-ed-ev-org"
                  className="hp-ed-input hp-ed-block"
                  type="text"
                  value={form.organization}
                  placeholder="Optional"
                  onChange={e => set('organization', e.target.value)}
                />
              </div>

              <div>
                <label className="hp-ed-field-label" htmlFor="hp-ed-ev-date">Date</label>
                <input
                  id="hp-ed-ev-date"
                  className="hp-ed-input hp-ed-block"
                  type="text"
                  value={form.date_label}
                  placeholder="Optional, e.g. 2023"
                  onChange={e => set('date_label', e.target.value)}
                />
              </div>
            </div>

            {lenses.length > 0 && (
              <>
                <p className="hp-ed-field-label">Show it in</p>
                <DirectionPicker
                  lenses={lenses}
                  scope={scope}
                  lensIds={lensIds}
                  idPrefix="hp-add-evidence"
                  onChange={(nextScope, nextIds) => {
                    setScope(nextScope)
                    setLensIds(nextIds)
                  }}
                />
              </>
            )}
          </>
        )}

        {step === 'done' && saved && (
          <>
            <p className="hp-ed-add-title">Added.</p>
            <p className="hp-ed-add-saved">
              <strong>{saved.title}</strong>
              {saved.where === null
                ? ' is now showing on all Career Directions.'
                : saved.where.length > 0
                  ? ` is now in ${saved.where.join(' and ')}.`
                  : ' is saved.'}
            </p>
            {saved.warning ? <p className="hp-ed-add-note">{saved.warning}</p> : null}
          </>
        )}
      </ProfileModal>
    </>
  )
}
