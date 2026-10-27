'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import DirectionPicker, { PICKABLE } from './DirectionPicker'
import { useTestimonialDelete } from './ManagePanes'
import { useProfileEdit, useNotify } from '../_lib/editContext'

// ============================================================================
// REVIEWING ONE TESTIMONIAL
//
// Somebody wrote something about this person and nobody has decided about it
// yet. This is where that decision is made, and it is the only place it can
// be made: approving is the one act that puts a testimonial on the profile,
// so the Manage list, the Edit pane, Preview and the public page all end up
// reading the same thing afterwards rather than four nearly-agreeing things.
//
// WHY IT IS A PANEL AND NOT A PANE INSIDE MANAGE
// The Edit pane is for an answer already decided on - where it appears, who
// can see it, what it is filed as. This is a decision taken once, on arrival,
// and it opens on its own: from the link in the notification email, on the
// next visit to the editor, or from the row in the list. A pane reachable
// only by opening a panel and finding the row would be the approve control
// hidden behind the thing it is meant to interrupt.
//
// THE SHELL IS MANAGE PORTFOLIO'S
// Same box, same surface, same bar, same close. The resets that make a
// control keep its own border live on `.hp-pf-box[data-mode="manage"]`, so
// taking that markup takes them with it.
//
// WHAT IS TICKED WHEN IT OPENS
// Every active Career Direction, which is the default a new piece of
// portfolio or evidence gets. The owner narrows it before approving if they
// want to; the common case is that somebody's words belong everywhere.
// ============================================================================

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input', 'select', 'textarea',
  '[tabindex]:not([tabindex="-1"])'
].join(',')

export default function TestimonialReview({
  item,          // the testimonial being decided on
  position,      // 1-based, where this one sits in the queue
  total,         // how many are waiting, counting this one
  onClose,       // the X, and Escape: closes without deciding anything
  onDone         // decided - hand back the id so the queue can move on
}) {
  const edit = useProfileEdit()
  const notify = useNotify()
  const [busy, setBusy] = useState(false)

  const surfaceRef = useRef(null)
  const closeRef = useRef(null)
  const returnTo = useRef(null)

  // Every direction that is on the profile, ticked. Held rather than read, so
  // the owner can narrow it before approving and the picker has somewhere to
  // write to that is not the database - nothing here is saved until Approve.
  const actives = useMemo(
    () => (edit?.allLenses || []).filter(one => one?.status === 'active').map(one => one.id),
    [edit?.allLenses]
  )
  const [picked, setPicked] = useState(actives)
  // A different testimonial in the same panel is a fresh decision, so the
  // ticks start again rather than carrying over from the last one.
  const [pickedFor, setPickedFor] = useState(item?.id)
  if (pickedFor !== item?.id) {
    setPickedFor(item?.id)
    setPicked(actives)
  }

  // Declining is the delete, asked the way the Manage list and the Edit pane
  // ask it, with its own sentence: this one was never on the profile, and the
  // person who wrote it is not told either way.
  const del = useTestimonialDelete({ onDeleted: () => onDone?.(item?.id) })

  const answered = Boolean(item?.polished_text || item?.raw_text)
  // The route refuses to publish a row with no tidied version, so Approve
  // would come back as an error rather than as an approval.
  const ready = Boolean(item?.polished_text)

  const relationship = [item?.recipient_title, item?.relationship_type]
    .filter(Boolean)
    .join(' · ')

  // ---- The dialog's own manners, the same ones the manage panels have ----
  useEffect(() => {
    returnTo.current = document.activeElement
    const timer = window.setTimeout(() => closeRef.current?.focus(), 20)
    return () => {
      window.clearTimeout(timer)
      const back = returnTo.current
      returnTo.current = null
      if (back && document.contains(back) && typeof back.focus === 'function') back.focus()
    }
  }, [])

  useEffect(() => {
    const { body, documentElement } = document
    const gap = window.innerWidth - documentElement.clientWidth
    const overflow = body.style.overflow
    const padding = body.style.paddingRight
    body.style.overflow = 'hidden'
    if (gap > 0) body.style.paddingRight = `${gap}px`
    return () => {
      body.style.overflow = overflow
      body.style.paddingRight = padding
    }
  }, [])

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose?.()
        return
      }
      if (event.key !== 'Tab') return
      const surface = surfaceRef.current
      if (!surface) return
      const stops = [...surface.querySelectorAll(FOCUSABLE)]
        .filter(el => el.offsetParent !== null || el === closeRef.current)
      if (stops.length === 0) return
      const first = stops[0]
      const last = stops[stops.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const onBackdrop = useCallback((event) => {
    if (event.target === event.currentTarget) onClose?.()
  }, [onClose])

  // ---- APPROVING ----
  //
  // Where it appears, then that it appears. In that order, and in two calls
  // because they are two routes: a row that went live first would be on the
  // profile for the length of a round trip on whatever directions it happened
  // to carry, which for a brand new testimonial is all of them.
  const approve = useCallback(async () => {
    if (busy || !item) return
    setBusy(true)
    try {
      await edit?.onSetTestimonialDirections?.(item.id, 'selected', picked)
      await edit?.onPublishTestimonial?.(item.id, 'published')
      onDone?.(item.id)
    } catch (err) {
      notify({ type: 'error', message: err?.message || "We couldn't approve that. Please try again." })
    } finally {
      setBusy(false)
    }
  }, [busy, item, edit, picked, onDone, notify])

  if (!item || typeof document === 'undefined') return null

  const titleId = 'hp-tm-review-title'

  return createPortal(
    <div
      className="hp-pf-box hp-ed-portal"
      data-mode="manage"
      role="presentation"
      onMouseDown={onBackdrop}
    >
      <div
        className="hp-pf-box-surface"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-mode="manage"
        ref={surfaceRef}
      >
        <div className="hp-pf-box-bar">
          <div className="hp-pf-box-heading">
            <span className="hp-pf-box-eyebrow">Testimonial</span>
            <h2 className="hp-pf-box-heading-title" id={titleId}>
              Review
              {/* Only where there is a queue to be somewhere in. */}
              {total > 1
                ? <> <span className="hp-pf-box-count">({position} of {total})</span></>
                : null}
            </h2>
          </div>

          <button
            type="button"
            className="hp-pf-box-close"
            ref={closeRef}
            onClick={() => onClose?.()}
            aria-label="Close"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div className="hp-pf-box-gallery" data-manage="true">
          <div className="hp-manage">
            {/* Who wrote it, and what they were to this person. The same three
                facts the row in the list carries, said in full. */}
            <div className="hp-manage-pane-head">
              <p className="hp-manage-pane-title">{item.recipient_name || 'A referee'}</p>
              {relationship ? <p className="hp-manage-pane-note">{relationship}</p> : null}
            </div>

            {/* Their words, exactly as they will appear, and not editable
                here: this is a decision about somebody else's sentence, not
                an invitation to rewrite it. */}
            {answered ? (
              <div className="hp-ed-tm-final">
                <p className="hp-ed-field-label">Testimonial</p>
                <blockquote className="hp-ed-tm-quote">
                  {item.polished_text || item.raw_text}
                </blockquote>
              </div>
            ) : (
              <p className="hp-ed-proof-note">
                No response yet. The request link is still active.
              </p>
            )}

            {/* Where approving will put it. Every active direction to begin
                with, which is the default a new piece of work gets. */}
            <DirectionPicker
              lenses={edit?.allLenses || []}
              scope="selected"
              lensIds={picked}
              disabled={busy}
              idPrefix={`hp-tm-review-${item.id}`}
              onChange={(nextScope, nextIds) => {
                setPicked(nextScope === 'all'
                  ? (edit?.allLenses || [])
                      .filter(one => PICKABLE.has(one?.status))
                      .map(one => one.id)
                  : nextIds)
              }}
            />

            {!ready && answered ? (
              <p className="hp-ed-proof-note">
                This one has no tidied version yet, so it cannot go on your profile.
              </p>
            ) : null}

            {/* Decline alone on the left - the one irreversible control here.
                Approve on the right, which is the act this panel exists for. */}
            <div className="hp-ed-editor-bar">
              <span className="hp-ed-foot-left">
                {del.available ? (
                  <button
                    type="button"
                    className="hp-ed-action hp-ed-danger"
                    disabled={busy || Boolean(del.deletingId)}
                    onClick={() => del.ask({
                      id: item.id,
                      title: item.recipient_name,
                      answered: true,
                      decline: true
                    })}
                  >
                    {del.deletingId ? 'Declining…' : 'Decline'}
                  </button>
                ) : null}
              </span>

              <span className="hp-ed-foot-right">
                <button
                  type="button"
                  className="hp-ed-action"
                  data-primary="true"
                  disabled={busy || !ready}
                  onClick={approve}
                >
                  {busy ? 'Approving…' : 'Approve'}
                </button>
              </span>
            </div>
          </div>
        </div>
      </div>

      {del.modal}
    </div>,
    document.body
  )
}
