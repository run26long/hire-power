'use client'

import { useState } from 'react'
import { useProfileEdit } from '../_lib/editContext'
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
  requested: 'Waiting on them',
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

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null)
  const [expanded, setExpanded] = useState(null)

  if (!edit?.editing) return null

  const items = edit.testimonials || []
  const badge = edit.earned360 || { count: 0, earned: false, kinds: [] }
  const consenting = items.filter(t => t.reference_consent).length
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))

  async function run(key, work) {
    if (busy) return
    setBusy(key)
    setError(null)
    try { await work() } catch (err) {
      setError(err?.message || "We couldn't do that. Please try again.")
    } finally { setBusy(null) }
  }

  async function send() {
    if (sending) return
    setSending(true)
    setError(null)
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
      setError(err?.message || "We couldn't send that request.")
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

      {sent ? (
        <p className="hp-ed-add-note">
          Asked {sent}. They will get an email with a link, and you will hear when they reply.
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
                    {t.relationship_type ? <span className="hp-ed-mrow-badge">{t.relationship_type}</span> : null}
                    <span className="hp-ed-mrow-badge" data-tone={published ? 'live' : 'quiet'}>
                      {STATUS_LABEL[t.status] || t.status}
                    </span>
                    {t.reference_consent ? <span className="hp-ed-mrow-badge" data-tone="quiet">Reference</span> : null}
                  </span>
                </div>

                {ready ? (
                  <blockquote className="hp-ed-tm-quote">{t.polished_text}</blockquote>
                ) : (
                  <p className="hp-ed-proof-note">
                    {t.status === 'requested'
                      ? 'No reply yet. The link in their email still works.'
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
                      if (ok) run(`del:${t.id}`, () => edit.onDeleteTestimonial(t.id))
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

      <div className="hp-ed-mrow-actions" style={{ marginTop: 14 }}>
        {!open ? (
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

      {open ? (
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
            <button type="button" className="hp-ed-action" onClick={() => { setOpen(false); setError(null) }} disabled={sending}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className="hp-ed-editor-error">{error}</p> : null}
    </div>
  )
}
