'use client'

import { useState, useEffect, useMemo, useRef } from 'react'

import { useProfileEdit, useNotify } from '../_lib/editContext'
import { EVIDENCE_TYPES, FAMILY_LABELS, familyForType } from '@/lib/evidenceTypes'
import { RELATIONSHIP_TYPES } from '@/lib/testimonialTypes'
import DirectionPicker from './DirectionPicker'
import BrandSelect from './BrandSelect'

// ============================================================================
// THE PANES BEHIND A MANAGE LIST
//
// Editing one item, and asking for a testimonial. Each takes the modal over
// from the list and gives it back, rather than opening a second dialog on top
// of the first - a dialog over a dialog is two Escape keys and two places
// focus can be, and neither is where anybody expects it.
//
// WHERE THIS CODE CAME FROM
// EvidenceManager and TestimonialManager, which were the inline tables the
// Manage button used to unfold under the section. The behaviour is theirs,
// moved rather than rewritten: the same fields, the same validation, the same
// reasons in the same comments. What changed is where it is shown and what
// surrounds it.
//
// WHAT DID NOT COME WITH IT
// Removing an item. The whole point of the placement model is that taking
// something off a direction is a switch rather than a deletion, and a Remove
// button inside the control that makes hiding easy is an invitation to use
// the wrong one. Nothing in these panes deletes anything.
// ============================================================================

const GROUPED = Object.entries(
  EVIDENCE_TYPES.reduce((acc, item) => {
    ;(acc[item.family] ||= []).push(item.type)
    return acc
  }, {})
)

// The way back is not here. It is a button in the action row at the foot of
// the pane, where the other decisions are, rather than a link above the thing
// being decided.
function PaneHead({ title, note }) {
  return (
    <div className="hp-manage-pane-head">
      <p className="hp-manage-pane-title">{title}</p>
      {note ? <p className="hp-manage-pane-note">{note}</p> : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// A DROPDOWN THAT BELONGS TO THE MODAL
//
// A native select took the dark surface and then drew the platform's own
// control over it: on some engines a second chevron beside the one CSS had
// drawn, and on every one of them a menu in the platform's colours with the
// platform's blue bar across the highlighted row. Neither the menu nor the bar
// is reachable from a stylesheet, so the menu has to be ours.
//
// The listbox pattern rather than a prettier select, because a button and a
// list can be painted and a native popup cannot. The keyboard does what a
// select's keyboard does - arrows to move, Enter or Space to take, Escape to
// leave, Home and End to the ends - and aria-activedescendant tells a screen
// reader which row is current without moving focus off the control.
//
// WHY THE MENU IS NOT WHERE THE FIELD IS
// The open list used to be an absolutely positioned child of the field, which
// put it inside the dialog's scrolling body. That body clips what overflows it
// and counts what does not, so a menu near the foot of a pane was cut off at
// the edge of the dialog and, on the way there, lengthened the thing it stood
// in - a second scrollbar appearing under the reader as they opened a five-row
// list. The menu is mounted beside the dialog instead and placed against the
// field's own box, so opening it moves nothing.
// ---------------------------------------------------------------------------

// Where the menu is mounted: the nearest thing above it that tokens.css
// declares the --profile-* names on. A menu dropped straight onto the body
// would be dressed by nothing, because the palette lives on these roots rather
// than on :root.

// ---------------------------------------------------------------------------
// ONE PIECE OF EVIDENCE
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// WHERE THIS APPEARS
//
// Shared by both panes, because it is the same question about two
// collections. The lead switch above it is about this direction; this is
// about the item, everywhere, which is why it reads from the record rather
// than from the direction's rows.
//
// The write is optimistic in one direction only: the control shows what was
// asked for while the request is in flight, and a failure reports through the
// page's own toast and re-reads. There is no local truth to drift.
// ---------------------------------------------------------------------------
function DirectionsRow({ item, onSave, busy, idPrefix, placements, itemKey }) {
  const edit = useProfileEdit()
  const notify = useNotify()
  const [pending, setPending] = useState(null)

  const lenses = edit?.allLenses || edit?.lenses || []
  const scope = pending ? pending.scope : (item.placement_scope === 'selected' ? 'selected' : 'all')

  // Which directions this item holds a row for.
  //
  // This used to read item.lens_ids, and that column no longer exists: the
  // placement migration moved membership into the placement tables and
  // dropped it. The read came back undefined every time, so a 'selected' item
  // reported being on nothing - including one correctly placed in two
  // directions a moment earlier. Nothing was ever written wrongly; the picker
  // was reading a field that had been deleted underneath it.
  const held = useMemo(
    () => (Array.isArray(placements) ? placements : [])
      .filter(row => row?.[itemKey] === item.id && row?.lens_id)
      .map(row => row.lens_id),
    [placements, itemKey, item.id]
  )
  const lensIds = pending ? pending.lensIds : held

  if (!onSave) return null

  return (
    <div className="hp-manage-pane-stack">
      <span className="hp-manage-pane-label">Where this appears</span>
      <DirectionPicker
        lenses={lenses}
        scope={scope}
        lensIds={lensIds}
        disabled={Boolean(busy)}
        idPrefix={idPrefix}
        onChange={async (nextScope, nextIds) => {
          setPending({ scope: nextScope, lensIds: nextIds })
          try {
            await onSave(item.id, nextScope, nextIds)
          } catch (err) {
            notify?.({
              type: 'error',
              message: err?.message || "We couldn't save where that appears. Please try again."
            })
          } finally {
            setPending(null)
          }
        }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// A BETTER VERSION OF THE SAME FILE
//
// Replacing rather than re-adding, because everything except the file belongs
// to the item: its title, its type, which directions it is on, where it sits
// in each of them, which skill it proves. Adding a new one and hiding the old
// means setting all of that again and losing the rest.
//
// Same kind for same kind. The route refuses anything else, and so does the
// picker's accept list - an item's media_class decides which section it lives
// in and which viewer opens it, so a PDF taking an image's place would move
// the item out from under the owner mid-edit.
// ---------------------------------------------------------------------------
const REPLACE_ACCEPT = {
  image: 'image/*',
  video: 'video/*',
  document: 'application/pdf,.pdf,.doc,.docx',
  audio: 'audio/*'
}

function ReplaceFile({ item, disabled }) {
  const edit = useProfileEdit()
  const notify = useNotify()
  const picker = useRef(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)

  if (!edit?.onReplaceEvidenceFile) return null

  async function take(event) {
    const picked = event.target.files?.[0]
    // Cleared straight away, so choosing the same file twice in a row still
    // fires a change event.
    event.target.value = ''
    if (!picked || busy) return

    setBusy(true)
    setProgress(0)
    try {
      await edit.onReplaceEvidenceFile(item.id, picked, {
        onProgress: setProgress,
        setUploading: () => {}
      })
      notify?.({ type: 'success', message: 'File replaced.' })
    } catch (err) {
      notify?.({
        type: 'error',
        message: err?.message || "We couldn't replace that file. Please try again."
      })
    } finally {
      setBusy(false)
      setProgress(0)
    }
  }

  return (
    <>
      <input
        ref={picker}
        type="file"
        className="hp-manage-replace-input"
        accept={REPLACE_ACCEPT[item.media_class] || undefined}
        onChange={take}
        tabIndex={-1}
        aria-hidden="true"
      />
      <button
        type="button"
        className="hp-ed-action"
        disabled={disabled || busy}
        onClick={() => picker.current?.click()}
      >
        {busy ? <span className="hp-ed-spin" aria-hidden="true" /> : null}
        {busy ? `Replacing… ${progress}%` : 'Replace file'}
      </button>
    </>
  )
}

export function EvidenceEditPane({ item, lensId, onBack }) {
  const edit = useProfileEdit()
  const notify = useNotify()
  const [busy, setBusy] = useState(null)
  const [draft, setDraft] = useState({
    title: item.title || '',
    description: item.description || '',
    evidence_type: item.evidence_type || '',
    organization: item.organization || '',
    date_label: item.date_label || '',
    url: item.url || '',
  })

  const isPrivate = item.privacy === 'private'
  const family = familyForType(draft.evidence_type)

  async function run(key, work) {
    if (busy) return
    setBusy(key)
    try {
      await work()
    } catch (err) {
      notify({ type: 'error', message: err?.message || "We couldn't save that. Please try again." })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="hp-manage-pane">
      <PaneHead title={item.title || 'Untitled'} />

      <DirectionsRow
        item={item}
        busy={busy}
        idPrefix={`hp-ev-dir-${item.id}`}
        placements={edit?.allPlacements}
        itemKey="evidence_id"
        onSave={edit?.onSetEvidenceDirections}
      />

      {/* Offered where it can be used. A free account cannot make an item
          private, and a button that always answered PRO_REQUIRED would be
          worse than no button - but an already-private item keeps the way
          back, so a lapsed account is never stuck. */}
      {edit?.canUseProfileTools || isPrivate ? (
        <div className="hp-manage-pane-row">
          <span className="hp-manage-pane-label">
            {isPrivate ? 'Private. Only you can see this.' : 'Public'}
          </span>
          <button
            type="button"
            className="hp-manage-linkish"
            disabled={Boolean(busy)}
            onClick={() => run('privacy',
              () => edit?.onEditEvidence?.(item.id, { privacy: isPrivate ? 'public' : 'private' }))}
          >
            {isPrivate ? 'Make public' : 'Make private'}
          </button>
        </div>
      ) : null}

      <label className="hp-ed-field-label" htmlFor={`t-${item.id}`}>Title</label>
      <input
        id={`t-${item.id}`} className="hp-ed-input hp-ed-block" type="text"
        value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
      />

      <label className="hp-ed-field-label" htmlFor={`d-${item.id}`}>Description</label>
      <textarea
        id={`d-${item.id}`} className="hp-ed-textarea" data-size="body" rows={3}
        value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
      />

      <div className="hp-ed-add-grid">
        <div>
          <label className="hp-ed-field-label" htmlFor={`y-${item.id}`}>Type</label>
          {/* Evidence written before this list existed carries types that
              are not on it. Dropping that value on the floor would mean the
              type had to be re-chosen before a title could be corrected, so it
              stays at the head of the list as what the item currently says. */}
          <BrandSelect
            id={`y-${item.id}`}
            value={draft.evidence_type}
            onChange={next => setDraft(d => ({ ...d, evidence_type: next }))}
            disabled={Boolean(busy)}
            groups={[
              ...(item.evidence_type && !familyForType(item.evidence_type)
                ? [{ label: 'Currently', options: [item.evidence_type] }]
                : []),
              ...GROUPED.map(([familyKey, types]) => ({
                label: FAMILY_LABELS[familyKey],
                options: types
              }))
            ]}
          />
          {/* The filing note is gone: the group headings in the list already
              say which family a type belongs to, and repeating it underneath
              told the owner about a taxonomy that is ours rather than theirs.
              What is left is the one case the list cannot show - a stored type
              that predates the list. */}
          {draft.evidence_type && !family ? (
            <p className="hp-ed-proof-note">
              {`Kept as "${draft.evidence_type}". Choosing from the list refiles it.`}
            </p>
          ) : null}
        </div>
        <div>
          <label className="hp-ed-field-label" htmlFor={`o-${item.id}`}>Organization</label>
          <input
            id={`o-${item.id}`} className="hp-ed-input hp-ed-block" type="text"
            value={draft.organization} placeholder="Optional"
            onChange={e => setDraft(d => ({ ...d, organization: e.target.value }))}
          />
        </div>
        <div>
          <label className="hp-ed-field-label" htmlFor={`a-${item.id}`}>Date</label>
          <input
            id={`a-${item.id}`} className="hp-ed-input hp-ed-block" type="text"
            value={draft.date_label} placeholder="Optional"
            onChange={e => setDraft(d => ({ ...d, date_label: e.target.value }))}
          />
        </div>
      </div>

      {/* ---- Where this lives on the web ----
          On an upload it is an extra: the file is what the item shows, and
          this is where the thing it shows can be found. Clearing it removes
          the link and leaves the file.

          On a link item it is the item. It can be corrected but not emptied,
          because an item with no file and no address is a title with nothing
          behind it. The route refuses the empty case as well; this only
          avoids offering it. */}
      <label className="hp-ed-field-label" htmlFor={`u-${item.id}`}>
        {item.source_type === 'upload' ? 'Link to the live page (optional)' : 'Link'}
      </label>
      <input
        id={`u-${item.id}`} className="hp-ed-input hp-ed-block" type="url"
        value={draft.url}
        placeholder={item.source_type === 'upload' ? 'https://' : undefined}
        spellCheck="false"
        disabled={Boolean(busy)}
        onChange={e => setDraft(d => ({ ...d, url: e.target.value }))}
      />

      {item.source_type === 'upload' ? null : (
        <p className="hp-ed-proof-note">
          This address is what the item opens. It can be corrected, but not emptied.
        </p>
      )}

      <div className="hp-ed-editor-bar">
        <button
          type="button" className="hp-ed-action" data-primary="true"
          disabled={
            !draft.title.trim() || Boolean(busy) ||
            // A link item with its address emptied has nothing left to open.
            // The route refuses it too; this is so the refusal is a button
            // that will not press rather than an error after the press.
            (item.source_type !== 'upload' && !draft.url.trim()) ||
            // An off-list type is fine as long as it is the one already
            // stored. Choosing a new one means choosing from the list.
            (draft.evidence_type !== item.evidence_type && !familyForType(draft.evidence_type))
          }
          onClick={() => run('save', async () => {
            const values = {
              title: draft.title.trim(),
              description: draft.description.trim() || null,
              organization: draft.organization.trim() || null,
              date_label: draft.date_label.trim() || null,
              url: draft.url.trim(),
            }
            // Sent only when it changed. The route refiles the family from
            // whatever type it is given, and it only accepts the list - so
            // re-sending an unchanged off-list type would turn an edit to the
            // title into a rejection.
            if (draft.evidence_type !== item.evidence_type) {
              values.evidence_type = draft.evidence_type
            }
            await edit?.onEditEvidence?.(item.id, values)
            onBack()
          })}
        >
          {busy === 'save' ? 'Saving…' : 'Save'}
        </button>
        {/* Beside Save, because swapping the file is the other thing this
            pane does to the item rather than a field of it. Same weight as
            Back to list: it opens a file picker, it does not commit the
            edit. */}
        {item.source_type === 'upload' ? (
          <ReplaceFile item={item} disabled={Boolean(busy)} />
        ) : null}
        <span className="hp-ed-editor-gap" />
        <button type="button" className="hp-ed-action" onClick={onBack} disabled={Boolean(busy)}>
          Back to list
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ONE TESTIMONIAL
// ---------------------------------------------------------------------------
export function TestimonialEditPane({ item, onBack }) {
  const edit = useProfileEdit()
  const notify = useNotify()
  const [busy, setBusy] = useState(null)
  // Permanent and unrecoverable, so it is asked for twice. The second press is
  // a different button in the same place rather than a dialog over the pane:
  // the thing being deleted is on screen behind it and should stay readable
  // while the owner decides.
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  // Deleting an answered testimonial is behind this rather than in the bar.
  const [moreOpen, setMoreOpen] = useState(false)

  const published = item.status === 'published'
  const ready = Boolean(item.polished_text)
  // Whether anything has come back at all. The status alone does not say:
  // a row carries the referee's words long before anybody decides about them,
  // which is how "No response yet" came to sit over a paragraph they had
  // already written.
  const answered = Boolean(item.polished_text || item.raw_text)

  async function run(key, work) {
    if (busy) return
    setBusy(key)
    try {
      await work()
    } catch (err) {
      notify({ type: 'error', message: err?.message || "We couldn't do that. Please try again." })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="hp-manage-pane">
      <PaneHead
        title={item.recipient_name || 'A referee'}
        note={[item.recipient_title, item.relationship].filter(Boolean).join(' · ') || null}
      />

      {/* Free text on the row, a category here: the 360 view counts kinds of
          relationship, and it can only count what has been named. Saved on
          change rather than behind a button - the list is five long, and a
          Save next to a select nobody opened by accident is a step for its
          own sake. */}
      <div className="hp-ed-tm-rel">
        <label className="hp-ed-field-label" htmlFor={`rel-${item.id}`}>
          How you worked together
        </label>
        <BrandSelect
          id={`rel-${item.id}`}
          value={item.relationship_type || ''}
          options={RELATIONSHIP_TYPES}
          placeholder="Not said"
          disabled={Boolean(busy)}
          onChange={next => run('rel', () => edit?.onCategoriseTestimonial?.(item.id, next || null))}
        />
        {busy === 'rel' ? <span className="hp-ed-hint">Saving…</span> : null}
        {published && !item.relationship_type ? (
          <span className="hp-ed-hint">Counts toward the 360 view once you say.</span>
        ) : null}
      </div>

      {/* ---- ONE VERSION, THE ONE THEY APPROVED ----
          The row keeps both what they typed and what came back from the
          tidying, and this used to print each under its own heading. That is
          the working of the thing rather than the thing: two texts saying
          nearly the same, and nothing on screen to say which of them is the
          one their profile would carry. It is the polished text, because that
          is what the referee read and agreed to and what the profile prints -
          and where the tidying never produced one, it is their own words,
          which is what the approve step copies across in that case. Both are
          still saved; only one is shown. */}
      {answered ? (
        <div className="hp-ed-tm-final">
          <p className="hp-ed-field-label">Testimonial</p>
          <blockquote className="hp-ed-tm-quote">{item.polished_text || item.raw_text}</blockquote>
        </div>
      ) : (
        <p className="hp-ed-proof-note">
          No response yet. The request link is still active.
        </p>
      )}

      {/* ---- SHOW ON PROFILE ----
          A switch rather than a button, because it is a state the owner can
          read at a glance and change in either direction as often as they
          like, not an action they perform once. Off is where a new answer
          arrives: nothing anybody wrote about them goes onto their profile
          until they say so. Off later keeps the row here in full - the words
          stay, and turning it back on puts them back. */}
      {answered ? (
        <div className="hp-ed-tm-show">
          <span className="hp-ed-tm-show-label">
            <span className="hp-ed-field-label">Show on profile</span>
            <span className="hp-ed-hint">
              {busy === 'pub'
                ? 'Saving…'
                : published
                ? 'Visible to anyone who opens your profile.'
                : ready
                ? 'Saved here. Nobody else can see it yet.'
                : 'Needs a tidied version before it can go on your profile.'}
            </span>
          </span>
          <button
            type="button"
            className="hp-manage-switch"
            role="switch"
            aria-checked={published}
            aria-label="Show this testimonial on my profile"
            data-on={published ? 'true' : 'false'}
            // A row with no polished text cannot be published: the route
            // refuses it, and a switch that flicks back is worse than one that
            // will not move.
            disabled={Boolean(busy) || !ready}
            onClick={() => run('pub',
              () => edit?.onPublishTestimonial?.(item.id, published ? 'polished' : 'published'))}
          >
            <span className="hp-manage-knob" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {/* Beside publishing, because they are the two halves of the same
          review: whether this goes on the profile, and which parts of it. */}
      <DirectionsRow
        item={item}
        busy={busy}
        idPrefix={`hp-te-dir-${item.id}`}
        placements={edit?.allTestimonialPlacements}
        itemKey="testimonial_id"
        onSave={edit?.onSetTestimonialDirections}
      />

      {/* ---- THE WAY OUT OF EACH ONE ----
          Two different acts wearing one word. Cancelling a request nobody has
          answered costs nothing and belongs in the open, so it stands in the
          bar. Deleting an answer destroys something a colleague wrote as a
          favour, and Show on profile already does what an owner almost always
          means - so it moves behind More, where it has to be asked for. Both
          are the same delete underneath: the row is the request, and the token
          lives on it, so a withdrawn one left in place would leave its referee
          a working link. */}
      {confirmingDelete ? (
        <div className="hp-ed-tm-danger">
          <p className="hp-ed-hint">
            {answered
              ? 'Delete this testimonial and their words for good? This cannot be undone.'
              : 'Cancel this request? Their link stops working.'}
          </p>
          <div className="hp-ed-tm-danger-acts">
            <button
              type="button"
              className="hp-ed-action"
              data-primary="true"
              disabled={Boolean(busy)}
              onClick={() => run('del', async () => {
                await edit?.onDeleteTestimonial?.(item.id)
                onBack()
              })}
            >
              {busy === 'del' ? 'Deleting…' : answered ? 'Delete for good' : 'Cancel the request'}
            </button>
            <button
              type="button"
              className="hp-ed-action"
              disabled={Boolean(busy)}
              onClick={() => setConfirmingDelete(false)}
            >
              Keep it
            </button>
          </div>
        </div>
      ) : null}

      <div className="hp-ed-editor-bar">
        {!confirmingDelete && !answered ? (
          <button
            type="button"
            className="hp-ed-action"
            disabled={Boolean(busy)}
            onClick={() => setConfirmingDelete(true)}
          >
            Cancel request
          </button>
        ) : null}

        {!confirmingDelete && answered ? (
          <>
            <button
              type="button"
              className="hp-ed-action"
              aria-expanded={moreOpen}
              disabled={Boolean(busy)}
              onClick={() => setMoreOpen(was => !was)}
            >
              More
            </button>
            {moreOpen ? (
              <button
                type="button"
                className="hp-ed-action"
                disabled={Boolean(busy)}
                onClick={() => { setMoreOpen(false); setConfirmingDelete(true) }}
              >
                Delete permanently
              </button>
            ) : null}
          </>
        ) : null}

        <span className="hp-ed-editor-gap" />
        <button type="button" className="hp-ed-action" onClick={onBack} disabled={Boolean(busy)}>
          Back to list
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ASKING FOR ONE
// ---------------------------------------------------------------------------
const EMPTY_REQUEST = {
  recipient_name: '',
  recipient_email: '',
  recipient_title: '',
  relationship_type: '',
}

export function TestimonialRequestPane({ onBack, onSent }) {
  const edit = useProfileEdit()
  const notify = useNotify()
  const [form, setForm] = useState(EMPTY_REQUEST)
  const [sending, setSending] = useState(false)

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))
  const canSend = Boolean(
    form.recipient_name.trim() && form.recipient_email.trim() && form.relationship_type
  ) && !sending

  async function send() {
    if (!canSend) return
    setSending(true)
    const askedName = form.recipient_name.trim()
    try {
      await edit?.onRequestTestimonial?.({
        recipient_name: askedName,
        recipient_email: form.recipient_email.trim(),
        recipient_title: form.recipient_title.trim() || null,
        relationship_type: form.relationship_type,
      })
      setForm(EMPTY_REQUEST)
      // Back to the list, which now holds the request, rather than to a blank
      // form that looks like the send did not happen. The name goes with it so
      // the list can say who was asked.
      if (typeof onSent === 'function') onSent(askedName)
      else onBack()
    } catch (err) {
      notify({ type: 'error', message: err?.message || "We couldn't send that request." })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="hp-manage-pane">
      <PaneHead title="Who should we ask?" />

      <div className="hp-ed-add-grid">
        <div>
          <label className="hp-ed-field-label" htmlFor="hp-tm-name">Name</label>
          <input
            id="hp-tm-name" className="hp-ed-input hp-ed-block" type="text"
            value={form.recipient_name} onChange={e => set('recipient_name', e.target.value)}
          />
        </div>
        <div>
          <label className="hp-ed-field-label" htmlFor="hp-tm-email">Email</label>
          <input
            id="hp-tm-email" className="hp-ed-input hp-ed-block" type="email" spellCheck="false"
            value={form.recipient_email} onChange={e => set('recipient_email', e.target.value)}
          />
        </div>
        <div>
          <label className="hp-ed-field-label" htmlFor="hp-tm-title">Title</label>
          <input
            id="hp-tm-title" className="hp-ed-input hp-ed-block" type="text"
            value={form.recipient_title} placeholder="Optional"
            onChange={e => set('recipient_title', e.target.value)}
          />
        </div>
        <div>
          <label className="hp-ed-field-label" htmlFor="hp-tm-rel">How you worked together</label>
          <BrandSelect
            id="hp-tm-rel"
            value={form.relationship_type}
            options={RELATIONSHIP_TYPES}
            onChange={next => set('relationship_type', next)}
          />
        </div>
      </div>

      <p className="hp-ed-proof-note">
        They&rsquo;ll get a private link to share what it was like to work with you, and you decide
        whether it appears on your profile.
      </p>

      <div className="hp-ed-editor-bar">
        <button type="button" className="hp-ed-action" data-primary="true" onClick={send} disabled={!canSend}>
          {sending ? 'Sending…' : 'Send the request'}
        </button>
        <span className="hp-ed-editor-gap" />
        <button type="button" className="hp-ed-action" onClick={onBack} disabled={sending}>
          Back to list
        </button>
      </div>
    </div>
  )
}
