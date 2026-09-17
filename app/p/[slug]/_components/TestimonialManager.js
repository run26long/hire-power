'use client'

import { useState } from 'react'
import { useProfileEdit, useCanEdit, useNotify } from '../_lib/editContext'
import { UpgradeNote } from './EditAffordance'
import { RELATIONSHIP_TYPES, EARNED_360_THRESHOLD } from '@/lib/testimonialTypes'

// ============================================================================
// ASKING, AND DECIDING
//
// The owner's half of testimonials: who has been asked, what came back, and
// whether it goes on the profile.
//
// NOTHING HERE EDITS THE WORDS
// Not the referee's, not the polished version. Somebody else wrote them about
// this person, and a profile where the subject can rewrite their own
// references is a profile whose references are worth nothing. The controls are
// publish, unpublish, and remove.
//
// BOTH VERSIONS ARE SHOWN
// The polished line is what would appear, and what the referee actually wrote
// is underneath it. Deciding whether to publish a sentence somebody else will
// read as a quotation means being able to check it against what was said.
//
// EARNED 360 IS COUNTED, NOT STORED
// Three different kinds of working relationship, published. Counted from the
// rows every time it is rendered, so an unpublish takes the tag away without
// anything having to remember to.
// ============================================================================

const STATUS_LABEL = {
  requested: 'Awaiting response',
  submitted: 'Received',
  polished: 'Ready to review',
  published: 'On your profile'
}

const EMPTY = {
  recipient_name: '',
  recipient_email: '',
  recipient_title: '',
  relationship_type: ''
}

export default function TestimonialManager() {
  const edit = useProfileEdit()
  const canEdit = useCanEdit()
  const notify = useNotify()

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(null)
  const [busy, setBusy] = useState(null)
  const [expanded, setExpanded] = useState(null)

  if (!edit?.editing) return null

  const items = edit.testimonials || []
  const badge = edit.earned360 || { count: 0, earned: false, kinds: [] }
  const consenting = items.filter(t => t.reference_consent).length
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))

  // Every row operation reports the same way. A failure here is about the
  // thing that was pressed, not about the form, so it goes to the page's one
  // notification channel rather than to a line at the bottom of this panel
  // that the owner may well have scrolled past.
  async function run(key, work) {
    if (busy) return
    setBusy(key)
    try { await work() } catch (err) {
      notify({ type: 'error', message: err?.message || "We couldn't do that. Please try again." })
    } finally { setBusy(null) }
  }

  async function send() {
    if (sending) return
    setSending(true)
    try {
      await edit.onRequestTestimonial({
        recipient_name: form.recipient_name.trim(),
        recipient_email: form.recipient_email.trim(),
        recipient_title: form.recipient_title.trim() || null,
        relationship_type: form.relationship_type
      })
      setSent(form.recipient_name.trim())
      setForm(EMPTY)
      setOpen(false)
    } catch (err) {
      notify({ type: 'error', message: err?.message || "We couldn't send that request." })
    } finally {
      setSending(false)
    }
  }

  const canSend = Boolean(
    form.recipient_name.trim() && form.recipient_email.trim() && form.relationship_type
  ) && !sending

  return (
    <div className="hp-ed-manager hp-ed-tm">
      <p className="hp-ed-add-title">
        Testimonials ({items.length})
      </p>

      {/* The tag, and what it would take. Said whether or not it is earned,
          because "one more kind of person" is more useful than silence. */}
      <div className="hp-ed-360" data-earned={badge.earned ? 'true' : 'false'}>
        <span className="hp-ed-360-mark">{badge.earned ? 'EARNED 360' : `${badge.count} of ${EARNED_360_THRESHOLD}`}</span>
        <span className="hp-ed-360-note">
          {badge.earned
            ? `Published testimonials from ${badge.count} kinds of working relationship: ${badge.kinds.join(', ')}.`
            : badge.count === 0
              ? `Publish testimonials from ${EARNED_360_THRESHOLD} different kinds of working relationship to earn the 360 view.`
              : `${badge.kinds.join(', ')}. ${badge.needed} more kind${badge.needed === 1 ? '' : 's'} of relationship earns the 360 view.`}
        </span>
      </div>

      {/* A success, so it is toned as one. The class is shared with the
          notes that report a failed link lookup, which stay amber; this is
          the one place that reads as confirmation rather than caution. */}
      {sent ? (
        <p className="hp-ed-add-note" data-tone="done">
          Request sent to {sent}. We’ll let you know when a response is ready to review.
        </p>
      ) : null}

      {items.length === 0 ? (
        <p className="hp-ed-proof-note">Nobody has been asked yet.</p>
      ) : (
        <ul className="hp-ed-mrows">
          {items.map(t => {
            const isOpen = expanded === t.id
            const published = t.status === 'published'
            const ready = Boolean(t.polished_text)
            return (
              <li className="hp-ed-mrow" key={t.id} data-open={isOpen ? 'true' : undefined}>
                <div className="hp-ed-mrow-head">
                  <span className="hp-ed-mrow-title">
                    {t.recipient_name}
                    {t.recipient_title ? <span className="hp-ed-tm-role"> · {t.recipient_title}</span> : null}
                  </span>
                  <span className="hp-ed-mrow-badges">
                    <span className="hp-ed-mrow-badge" data-tone={published ? 'live' : 'quiet'}>
                      {STATUS_LABEL[t.status] || t.status}
                    </span>
                    {t.reference_consent ? <span className="hp-ed-mrow-badge" data-tone="quiet">Reference</span> : null}
                  </span>
                </div>

                {/* A control rather than a badge, because the four testimonials
                    that predate this column have no category and would
                    otherwise never count toward the tag with no way to say what
                    they were. Saves on change: there is one value, the list is
                    five long, and a Save button next to a select nobody opened
                    by accident is a step for its own sake. */}
                <div className="hp-ed-tm-rel">
                  <label className="hp-ed-field-label" htmlFor={`rel-${t.id}`}>
                    How you worked together
                  </label>
                  <select
                    id={`rel-${t.id}`}
                    className="hp-ed-input"
                    value={t.relationship_type || ''}
                    disabled={Boolean(busy)}
                    onChange={e => run(`rel:${t.id}`,
                      () => edit.onCategoriseTestimonial(t.id, e.target.value || null))}
                  >
                    <option value="">Not said</option>
                    {RELATIONSHIP_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  {busy === `rel:${t.id}` ? <span className="hp-ed-hint">Saving…</span> : null}
                  {published && !t.relationship_type ? (
                    <span className="hp-ed-hint">Counts toward the 360 view once you say.</span>
                  ) : null}
                </div>

                {ready ? (
                  <blockquote className="hp-ed-tm-quote">{t.polished_text}</blockquote>
                ) : (
                  <p className="hp-ed-proof-note">
                    {t.status === 'requested'
                      ? 'No response yet. The request link is still active.'
                      : 'Received, but we could not shorten it. Their own words are below.'}
                  </p>
                )}

                <div className="hp-ed-mrow-actions">
                  {ready ? (
                    <button
                      type="button"
                      className="hp-ed-action"
                      data-primary={published ? undefined : 'true'}
                      disabled={Boolean(busy)}
                      onClick={() => run(`pub:${t.id}`,
                        () => edit.onPublishTestimonial(t.id, published ? 'polished' : 'published'))}
                    >
                      {busy === `pub:${t.id}`
                        ? 'Saving…'
                        : published ? 'Take it down' : 'Put it on my profile'}
                    </button>
                  ) : null}

                  {t.raw_text ? (
                    <button
                      type="button"
                      className="hp-ed-action"
                      onClick={() => setExpanded(isOpen ? null : t.id)}
                      disabled={Boolean(busy)}
                    >
                      {isOpen ? 'Hide what they wrote' : 'What they wrote'}
                    </button>
                  ) : null}

                  <button
                    type="button"
                    className="hp-ed-action hp-ed-danger"
                    disabled={Boolean(busy)}
                    onClick={() => {
                      const ok = window.confirm(
                        `Remove the testimonial from ${t.recipient_name}?\n\n` +
                        'Their link stops working and what they wrote is deleted. This cannot be undone.'
                      )
                      if (!ok) return
                      run(`del:${t.id}`, async () => {
                        await edit.onDeleteTestimonial(t.id)
                        // The confirmation above names a request. Once any
                        // request has been withdrawn it is describing a state
                        // that may no longer exist, and a banner saying a
                        // request is out when it has just been taken back is
                        // worse than no banner. Nothing else clears it - not a
                        // timer, not a reload of the list - so this is the
                        // only place it can go.
                        setSent(null)
                        notify({ type: 'success', message: `Removed the request to ${t.recipient_name}.` })
                      })
                    }}
                  >
                    Remove
                  </button>
                </div>

                {isOpen && t.raw_text ? (
                  <div className="hp-ed-mrow-edit">
                    <p className="hp-ed-field-label">In their own words</p>
                    <p className="hp-ed-tm-raw">{t.raw_text}</p>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      {/* Asking somebody for a testimonial is the one thing in this section
          that writes. The list above stays readable on every plan, because a
          testimonial somebody already gave is theirs to read. */}
      {!canEdit ? <UpgradeNote feature="testimonial" /> : null}

      <div className="hp-ed-mrow-actions" style={{ marginTop: 14 }}>
        {canEdit && !open ? (
          <button type="button" className="hp-ed-action" data-primary="true" onClick={() => { setOpen(true); setSent(null) }}>
            + Request a testimonial
          </button>
        ) : null}

        {consenting > 0 ? (
          <button
            type="button"
            className="hp-ed-action"
            disabled={Boolean(busy)}
            onClick={() => run('sheet', () => edit.onDownloadReferenceSheet())}
          >
            {busy === 'sheet' ? 'Building…' : `Reference sheet (${consenting})`}
          </button>
        ) : null}
      </div>

      {canEdit && open ? (
        <div className="hp-ed-editor" role="group" aria-label="Request a testimonial">
          <p className="hp-ed-add-title">Who should we ask?</p>

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
                id="hp-tm-title" className="hp-ed-input hp-ed-block" type="text" placeholder="Optional"
                value={form.recipient_title} onChange={e => set('recipient_title', e.target.value)}
              />
            </div>
            <div>
              <label className="hp-ed-field-label" htmlFor="hp-tm-rel">How you worked together</label>
              <select
                id="hp-tm-rel" className="hp-ed-input hp-ed-block"
                value={form.relationship_type} onChange={e => set('relationship_type', e.target.value)}
              >
                <option value="">Choose one…</option>
                {RELATIONSHIP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
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
            <button type="button" className="hp-ed-action" onClick={() => setOpen(false)} disabled={sending}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
