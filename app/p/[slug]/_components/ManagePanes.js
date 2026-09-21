'use client'

import { useState } from 'react'

import { useProfileEdit, useNotify } from '../_lib/editContext'
import { EVIDENCE_TYPES, FAMILY_LABELS, familyForType } from '@/lib/evidenceTypes'
import { RELATIONSHIP_TYPES } from '@/lib/testimonialTypes'

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
// ONE PIECE OF EVIDENCE
// ---------------------------------------------------------------------------
export function EvidenceEditPane({ item, lensId, isFeatured, onBack }) {
  const edit = useProfileEdit()
  const notify = useNotify()
  const [busy, setBusy] = useState(null)
  const [draft, setDraft] = useState({
    title: item.title || '',
    description: item.description || '',
    evidence_type: item.evidence_type || '',
    organization: item.organization || '',
    date_label: item.date_label || '',
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

      {/* The lead is a property of this direction rather than of the item, so
          it sits with the direction's own controls rather than in the fields
          below, which belong to the record wherever it appears. */}
      <div className="hp-manage-pane-row">
        <span className="hp-manage-pane-label">Leads this career direction</span>
        <button
          type="button"
          className="hp-manage-switch"
          role="switch"
          aria-checked={isFeatured}
          aria-label={`Make ${item.title} the lead item for this career direction`}
          data-on={isFeatured ? 'true' : 'false'}
          disabled={Boolean(busy)}
          onClick={() => run('star', () => edit?.onFeatureEvidence?.(isFeatured ? null : item.id, lensId))}
        >
          <span className="hp-manage-knob" aria-hidden="true" />
        </button>
      </div>

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
          <select
            id={`y-${item.id}`} className="hp-ed-input hp-ed-block"
            value={draft.evidence_type}
            onChange={e => setDraft(d => ({ ...d, evidence_type: e.target.value }))}
          >
            <option value="">Choose one…</option>
            {/* Evidence written before this list existed carries types that
                are not on it. Dropping that value on the floor would mean the
                type had to be re-chosen before a title could be corrected, so
                it stays here as what the item currently says. */}
            {item.evidence_type && !familyForType(item.evidence_type) ? (
              <optgroup label="Currently">
                <option value={item.evidence_type}>{item.evidence_type}</option>
              </optgroup>
            ) : null}
            {GROUPED.map(([familyKey, types]) => (
              <optgroup key={familyKey} label={FAMILY_LABELS[familyKey]}>
                {types.map(t => <option key={t} value={t}>{t}</option>)}
              </optgroup>
            ))}
          </select>
          <p className="hp-ed-proof-note">
            {family
              ? `Filed under ${FAMILY_LABELS[family]}.`
              : draft.evidence_type
                ? `Kept as "${draft.evidence_type}". Choosing from the list refiles it.`
                : 'Choose a type to file this.'}
          </p>
        </div>
        <div>
          <label className="hp-ed-field-label" htmlFor={`o-${item.id}`}>Organisation</label>
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

      {/* The source is not here on purpose. A link's address and an upload's
          file are what the item is; changing either under an existing title
          would leave a tile that describes one thing and opens another. */}
      <p className="hp-ed-proof-note">
        {item.source_type === 'upload'
          ? 'The file itself cannot be swapped. Add the new one and hide this.'
          : 'The link cannot be changed here. Add the new one and hide this.'}
      </p>

      <div className="hp-ed-editor-bar">
        <button
          type="button" className="hp-ed-action" data-primary="true"
          disabled={
            !draft.title.trim() || Boolean(busy) ||
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

  const published = item.status === 'published'
  const ready = Boolean(item.polished_text)

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
        <select
          id={`rel-${item.id}`}
          className="hp-ed-input"
          value={item.relationship_type || ''}
          disabled={Boolean(busy)}
          onChange={e => run('rel', () => edit?.onCategoriseTestimonial?.(item.id, e.target.value || null))}
        >
          <option value="">Not said</option>
          {RELATIONSHIP_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        {busy === 'rel' ? <span className="hp-ed-hint">Saving…</span> : null}
        {published && !item.relationship_type ? (
          <span className="hp-ed-hint">Counts toward the 360 view once you say.</span>
        ) : null}
      </div>

      {ready ? (
        <blockquote className="hp-ed-tm-quote">{item.polished_text}</blockquote>
      ) : (
        <p className="hp-ed-proof-note">
          {item.status === 'requested'
            ? 'No response yet. The request link is still active.'
            : 'Received, but we could not shorten it. Their own words are below.'}
        </p>
      )}

      {item.raw_text ? (
        <div className="hp-ed-mrow-edit">
          <p className="hp-ed-field-label">In their own words</p>
          <p className="hp-ed-tm-raw">{item.raw_text}</p>
        </div>
      ) : null}

      <div className="hp-ed-editor-bar">
        {ready ? (
          <button
            type="button"
            className="hp-ed-action"
            data-primary={published ? undefined : 'true'}
            disabled={Boolean(busy)}
            onClick={() => run('pub',
              () => edit?.onPublishTestimonial?.(item.id, published ? 'polished' : 'published'))}
          >
            {busy === 'pub' ? 'Saving…' : published ? 'Take it down' : 'Put it on my profile'}
          </button>
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

export function TestimonialRequestPane({ onBack }) {
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
    try {
      await edit?.onRequestTestimonial?.({
        recipient_name: form.recipient_name.trim(),
        recipient_email: form.recipient_email.trim(),
        recipient_title: form.recipient_title.trim() || null,
        relationship_type: form.relationship_type,
      })
      setForm(EMPTY_REQUEST)
      onBack()
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
          <label className="hp-ed-field-label" htmlFor="hp-tm-name">Their name</label>
          <input
            id="hp-tm-name" className="hp-ed-input hp-ed-block" type="text"
            value={form.recipient_name} onChange={e => set('recipient_name', e.target.value)}
          />
        </div>
        <div>
          <label className="hp-ed-field-label" htmlFor="hp-tm-email">Their email</label>
          <input
            id="hp-tm-email" className="hp-ed-input hp-ed-block" type="email" spellCheck="false"
            value={form.recipient_email} onChange={e => set('recipient_email', e.target.value)}
          />
        </div>
        <div>
          <label className="hp-ed-field-label" htmlFor="hp-tm-title">Their title</label>
          <input
            id="hp-tm-title" className="hp-ed-input hp-ed-block" type="text"
            value={form.recipient_title} placeholder="Optional"
            onChange={e => set('recipient_title', e.target.value)}
          />
        </div>
        <div>
          <label className="hp-ed-field-label" htmlFor="hp-tm-rel">How you worked together</label>
          <select
            id="hp-tm-rel" className="hp-ed-input hp-ed-block"
            value={form.relationship_type} onChange={e => set('relationship_type', e.target.value)}
          >
            <option value="">Choose one…</option>
            {RELATIONSHIP_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      <p className="hp-ed-proof-note">
        They get one email with a link. They write a few sentences, see a tidied version straight
        away, and you decide whether it goes on your profile.
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
