'use client'

import { useCallback, useRef, useState } from 'react'
import { useProfileEdit } from '../_lib/editContext'
import { EVIDENCE_TYPES, FAMILY_LABELS, familyForType } from '@/lib/evidenceTypes'
import {
  ACCEPT_ATTRIBUTE, VISUAL_ACCEPT_ATTRIBUTE, MAX_UPLOAD_BYTES, humanSize, uploadTypeFor
} from '@/lib/evidenceUploads'
import VideoFramePicker from './VideoFramePicker'

// ============================================================================
// ADDING EVIDENCE
//
// Two ways in, three steps, and the whole thing renders inside the Evidence
// section so the owner is adding the work where the work will appear.
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
// THE IMAGE IS SHOWN AND NOT KEPT
// og:image is rendered as a small preview so the owner can tell they pasted
// the right link. It is not stored and not referenced after saving: a remote
// image on a public profile is a hotlink to a server that can swap it for
// anything later. Stored images come with the upload path.
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
export default function AddEvidence({ only = null }) {
  const visualOnly = only === 'visual'
  const edit = useProfileEdit()

  // 'closed' | 'choose' | 'link' | 'form' | 'done'
  const [step, setStep] = useState('closed')
  const [saved, setSaved] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [lensIds, setLensIds] = useState([])
  const [preview, setPreview] = useState(null)
  const [looking, setLooking] = useState(false)
  const [note, setNote] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

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

  const lenses = edit.lenses || []
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))

  function reset() {
    setStep('closed')
    setSaved(null)
    setForm(EMPTY)
    setLensIds([])
    setPreview(null)
    setNote(null)
    setError(null)
    setFile(null)
    setProgress(0)
    poster.current = null
    duration.current = null
  }

  async function lookUp() {
    const url = form.url.trim()
    if (!url || looking) return
    setLooking(true)
    setNote(null)
    setError(null)
    try {
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
  function chooseFile(picked) {
    setError(null)
    // A new file means the frame and the duration belonging to the last one
    // are gone, whether or not the new one produces its own.
    poster.current = null
    duration.current = null
    if (!picked) { setFile(null); return }
    const kind = uploadTypeFor(picked.type)
    if (!kind) {
      setFile(null)
      setError('That kind of file cannot be added yet. Images, PDF, Word documents and video.')
      return
    }
    // The picker's accept attribute already says this, and an accept attribute
    // is a suggestion: a file can still arrive by drag or by a picker that
    // ignores it.
    if (visualOnly && kind.media_class !== 'image' && kind.media_class !== 'video') {
      setFile(null)
      setError('The portfolio shows images and video. Other files belong in Evidence.')
      return
    }
    if (picked.size > MAX_UPLOAD_BYTES) {
      setFile(null)
      setError(`That file is ${humanSize(picked.size)}. The limit is 50MB.`)
      return
    }
    setFile(picked)
    // A filename is the best guess at a title anybody has, and it is only a
    // starting point: the extension goes, and the owner edits it like any
    // other field.
    setForm(f => ({ ...f, title: f.title || picked.name.replace(/\.[^.]+$/, '') }))
    setStep('form')
  }

  async function save() {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const details = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        evidence_type: form.evidence_type,
        organization: form.organization.trim() || null,
        date_label: form.date_label.trim() || null,
        lens_ids: lensIds
      }
      const created = file
        ? await edit.onUploadEvidence(file, details, {
            onProgress: setProgress,
            setUploading,
            // Both null for anything that is not a video, and both optional
            // for one: a video whose frame could not be captured still saves,
            // and shows the play mark the way every video did before.
            poster: poster.current,
            durationSeconds: duration.current
          })
        : await edit.onCreateEvidence({ ...details, url: form.url.trim() })
      // Not closed on success. A new item goes to the end of the collection,
      // and the section shows the first few - so on a profile with a dozen
      // pieces the tile is real, placed, and off the bottom of the preview.
      // Saying so is better than a panel that closes onto a page that looks
      // unchanged.
      setSaved({
        title: form.title.trim(),
        warning: created?.warning || null,
        where: lenses.filter(l => lensIds.includes(l.id)).map(l => l.name)
      })
      setForm(EMPTY)
      setLensIds([])
      setPreview(null)
      setNote(null)
      setFile(null)
      setProgress(0)
      setStep('done')
    } catch (err) {
      setError(err?.message || "We couldn't save that. Please try again.")
    } finally {
      setSaving(false)
      setUploading(false)
    }
  }

  // ---- the way in ----
  if (step === 'closed') {
    return (
      <div className="hp-ed-add-row">
        <button type="button" className="hp-ed-action" data-primary="true" onClick={() => setStep('choose')}>
          {visualOnly ? '+ Add to portfolio' : '+ Add evidence'}
        </button>
      </div>
    )
  }

  const family = familyForType(form.evidence_type)
  // A link needs its address; an upload needs its file. Both need a title and
  // a type, and the rest of the form is identical.
  const hasSource = file ? true : Boolean(form.url.trim())
  const canSave = Boolean(hasSource && form.title.trim() && family) && !saving

  return (
    <div className="hp-ed-editor hp-ed-add" role="group" aria-label="Add evidence">
      {step === 'choose' && (
        <>
          <p className="hp-ed-add-title">
            {visualOnly ? 'Add a photo or a video' : 'What are you adding?'}
          </p>
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
                  ? 'Photos and video from your own machine. Up to 50MB.'
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
        </>
      )}

      {step === 'link' && (
        <>
          <p className="hp-ed-add-title">Paste the link</p>
          <div className="hp-ed-tag-add">
            <input
              className="hp-ed-input"
              type="url"
              value={form.url}
              placeholder="https://"
              autoFocus
              spellCheck="false"
              onChange={e => set('url', e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); lookUp() } }}
              aria-label="The link to add"
            />
            <button
              type="button"
              className="hp-ed-action"
              data-primary="true"
              onClick={lookUp}
              disabled={!form.url.trim() || looking}
            >
              {looking ? 'Reading…' : 'Continue'}
            </button>
          </div>
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
              <span className="hp-ed-add-preview-note">
                The page&apos;s own image, shown so you can check the link. It is not saved.
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

          <div className="hp-ed-add-grid">
            <div>
              <label className="hp-ed-field-label" htmlFor="hp-ed-ev-type">Type</label>
              <select
                id="hp-ed-ev-type"
                className="hp-ed-input hp-ed-block"
                value={form.evidence_type}
                onChange={e => set('evidence_type', e.target.value)}
              >
                <option value="">Choose one…</option>
                {GROUPED.map(([familyKey, types]) => (
                  <optgroup key={familyKey} label={FAMILY_LABELS[familyKey]}>
                    {types.map(t => <option key={t} value={t}>{t}</option>)}
                  </optgroup>
                ))}
              </select>
              {/* Said rather than asked. The family follows from the type, and
                  making somebody choose both is making them guess at our
                  filing system. */}
              <p className="hp-ed-proof-note">
                {family ? `Filed under ${FAMILY_LABELS[family]}.` : 'Choose a type to file this.'}
              </p>
            </div>

            <div>
              <label className="hp-ed-field-label" htmlFor="hp-ed-ev-org">Organisation</label>
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
              <ul className="hp-ed-lens-picks">
                {lenses.map(lens => (
                  <li key={lens.id}>
                    <label className="hp-ed-lens-pick">
                      <input
                        type="checkbox"
                        checked={lensIds.includes(lens.id)}
                        onChange={e => setLensIds(ids =>
                          e.target.checked ? [...ids, lens.id] : ids.filter(id => id !== lens.id)
                        )}
                      />
                      <span>{lens.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
              {lensIds.length === 0 ? (
                <p className="hp-ed-proof-note">
                  Pick none and it is saved but shown nowhere. You can place it later.
                </p>
              ) : null}
            </>
          )}
        </>
      )}

      {step === 'done' && saved && (
        <>
          <p className="hp-ed-add-title">Added.</p>
          <p className="hp-ed-add-saved">
            <strong>{saved.title}</strong>
            {saved.where.length > 0
              ? ` is now in ${saved.where.join(' and ')}.`
              : ' is saved but not shown in any direction yet.'}
          </p>
          {/* Where it went, and why it may not be on screen. The collection
              is shown a few at a time and a new piece joins the end of it. */}
          <p className="hp-ed-proof-note">
            New evidence joins the end of the collection, so it may sit behind
            {' '}<em>View all evidence</em> rather than in the preview above.
            Ordering and featuring arrive in the next pass.
          </p>
          {saved.warning ? <p className="hp-ed-add-note">{saved.warning}</p> : null}
        </>
      )}

      <div className="hp-ed-editor-bar">
        {step === 'done' ? (
          <button type="button" className="hp-ed-action" data-primary="true" onClick={() => { setSaved(null); setStep('choose') }}>
            Add another
          </button>
        ) : null}
        {step === 'form' ? (
          <button
            type="button"
            className="hp-ed-action"
            data-primary="true"
            onClick={save}
            disabled={!canSave}
          >
            {uploading ? 'Uploading…' : saving ? 'Saving…' : 'Add evidence'}
          </button>
        ) : null}
        <button type="button" className="hp-ed-action" onClick={reset} disabled={saving}>
          {step === 'done' ? 'Done' : 'Cancel'}
        </button>
        {step === 'form' ? (
          <button type="button" className="hp-ed-action" onClick={() => setStep(file ? 'choose' : 'link')} disabled={saving}>
            Back
          </button>
        ) : null}
      </div>

      {error ? <p className="hp-ed-editor-error">{error}</p> : null}
    </div>
  )
}
