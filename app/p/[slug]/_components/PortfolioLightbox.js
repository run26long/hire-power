'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import StrokeIcon, { ICON_MEDIA } from './StrokeIcon'
import { formatDuration } from '@/lib/portfolio'

// ============================================================================
// THE PORTFOLIO LIGHTBOX
//
// One piece of visual work, at the shape it actually is, with the rest of the
// collection a swipe or an arrow key away.
//
// WHY NOT THE EVIDENCE OVERLAY
// That surface holds two views and a family filter, and moves between a
// gallery and one item. This one holds a single moving sequence: there is no
// gallery view to go back to, because the page behind it is the gallery. They
// are different things wearing the same word, and folding one into the other
// would mean a filter and a back button that a portfolio never uses, and a
// next/previous that evidence has no order for. What is duplicated is the
// dialog behaviour, which is written the same way here deliberately: the
// portal, the focus trap, Escape, the scroll lock, and where focus returns.
//
// NATURAL RATIO, NOT THE MAT'S
// The grid squares everything so the grid reads as a grid. Here the work is
// the only thing on screen, so it is shown as it was made - a tall photograph
// stays tall and a widescreen still stays wide, both bounded by the viewport.
//
// EVERY IMAGE IS ASKED FOR BY ID
// The full file, not the thumbnail, and signed for this direction at the
// moment it is needed. Moving to the next item signs the next one; nothing is
// held, because a link that outlives its signature is worse than no link.
// ============================================================================

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input', 'select', 'textarea',
  'video[controls]', 'audio[controls]', '[tabindex]:not([tabindex="-1"])'
].join(',')

// Far enough that a vertical scroll or a stray touch is not a page turn.
const SWIPE_MIN_PX = 48
// A swipe is horizontal. Past this it is somebody scrolling, and the gesture
// is abandoned rather than interpreted.
const SWIPE_MAX_DRIFT = 0.8

export default function PortfolioLightbox({ items, startIndex, active, slug, lensId, onClose }) {
  const [index, setIndex] = useState(startIndex || 0)

  const surfaceRef = useRef(null)
  const closeRef = useRef(null)
  const returnTo = useRef(null)
  const touch = useRef(null)

  // No mount guard, for the reason the evidence overlay needs none: this is
  // closed on the server and on the first client render, so the portal below
  // is only ever reached from an event the reader caused.

  // The opening index is the one the section clicked, and it is the initial
  // state above rather than something synchronised afterwards: the section
  // keys this component on the visit, so every opening is a new component
  // that starts where it was opened. Moving between items inside one opening
  // is this state's own business and nothing upstream changes it.

  const count = items?.length || 0
  const item = count > 0 ? items[Math.min(index, count - 1)] : null

  const go = useCallback((step) => {
    if (count < 2) return
    setIndex(current => (current + step + count) % count)
  }, [count])

  // Whatever had focus when this opened is where focus goes back to. Taken
  // before the dialog moves it, restored only if that element is still on the
  // page - a direction change can take it away while this is open.
  useEffect(() => {
    if (!active) return
    returnTo.current = document.activeElement
    const timer = window.setTimeout(() => closeRef.current?.focus(), 20)
    return () => {
      window.clearTimeout(timer)
      const back = returnTo.current
      if (back && document.contains(back) && typeof back.focus === 'function') back.focus()
    }
  }, [active])

  // The page behind does not scroll under an open dialog.
  useEffect(() => {
    if (!active) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [active])

  // Escape closes, the arrows move, and Tab cycles inside: a dialog the
  // keyboard can walk out of while it is still over the page is a dialog in
  // name only.
  useEffect(() => {
    if (!active) return
    function onKey(event) {
      if (event.key === 'Escape') { event.preventDefault(); onClose?.(); return }
      if (event.key === 'ArrowRight') { event.preventDefault(); go(1); return }
      if (event.key === 'ArrowLeft') { event.preventDefault(); go(-1); return }
      if (event.key !== 'Tab') return

      const surface = surfaceRef.current
      if (!surface) return
      const reachable = [...surface.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null)
      if (reachable.length === 0) return
      const first = reachable[0]
      const last = reachable[reachable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [active, go, onClose])

  if (!active || !item) return null

  // A swipe is decided when the finger lifts, from where it started and where
  // it ended. Nothing is moved while the finger is down: dragging the picture
  // under the finger would mean deciding what happens when the drag is
  // abandoned half way, and a page turn is not a drag.
  const onTouchStart = (event) => {
    const point = event.touches?.[0]
    touch.current = point ? { x: point.clientX, y: point.clientY } : null
  }
  const onTouchEnd = (event) => {
    const start = touch.current
    touch.current = null
    const point = event.changedTouches?.[0]
    if (!start || !point) return
    const dx = point.clientX - start.x
    const dy = point.clientY - start.y
    if (Math.abs(dx) < SWIPE_MIN_PX) return
    if (Math.abs(dy) > Math.abs(dx) * SWIPE_MAX_DRIFT) return
    go(dx < 0 ? 1 : -1)
  }

  return createPortal(
    <div className="hp-pf-box" role="presentation" onClick={() => onClose?.()}>
      <div
        className="hp-pf-box-surface"
        role="dialog"
        aria-modal="true"
        aria-label={item.title || 'Portfolio'}
        ref={surfaceRef}
        onClick={event => event.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="hp-pf-box-bar">
          <span className="hp-pf-box-count">
            {count > 1 ? `${index + 1} of ${count}` : ''}
          </span>
          <button
            type="button"
            className="hp-pf-box-close"
            ref={closeRef}
            onClick={() => onClose?.()}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="hp-pf-box-stage">
          {count > 1 && (
            <button
              type="button"
              className="hp-pf-step"
              data-step="prev"
              onClick={() => go(-1)}
              aria-label="Previous"
            >
              ‹
            </button>
          )}

          {/* Keyed on the item so moving to the next one mounts a new player
              rather than pointing the old one at a different file: a <video>
              handed a new src keeps the position and the play state of the
              one before it. */}
          <PortfolioMedia key={item.id} item={item} slug={slug} lensId={lensId} />

          {count > 1 && (
            <button
              type="button"
              className="hp-pf-step"
              data-step="next"
              onClick={() => go(1)}
              aria-label="Next"
            >
              ›
            </button>
          )}
        </div>

        <div className="hp-pf-box-foot">
          <p className="hp-pf-box-title">{item.title}</p>
          {item.description && <p className="hp-pf-box-note">{item.description}</p>}
          <p className="hp-pf-box-meta">
            {[item.evidence_type, item.organization, item.date_label]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ---------------------------------------------------------------------------
// The file itself, signed for this direction at the moment it is shown.
// ---------------------------------------------------------------------------
function PortfolioMedia({ item, slug, lensId }) {
  const [state, setState] = useState({ status: 'loading', url: null })

  useEffect(() => {
    if (!item?.id) return
    const suffix = lensId ? `?lens=${encodeURIComponent(lensId)}` : ''
    let live = true
    fetch(`/api/career-profile/${encodeURIComponent(slug)}/evidence/${encodeURIComponent(item.id)}${suffix}`)
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then(body => { if (live) setState({ status: 'ready', url: body.url || null }) })
      .catch(() => { if (live) setState({ status: 'failed', url: null }) })
    return () => { live = false }
  }, [slug, lensId, item?.id])

  if (state.status === 'loading') {
    return <div className="hp-pf-box-wait" aria-label="Opening" />
  }

  if (state.status === 'failed' || !state.url) {
    return (
      <div className="hp-pf-box-gone">
        <span className="hp-pf-box-gone-mark" aria-hidden="true">
          <StrokeIcon paths={ICON_MEDIA[item.media_class] || ICON_MEDIA.default} size={34} strokeWidth={1.2} />
        </span>
        <p className="hp-pf-box-gone-note">This could not be opened right now.</p>
      </div>
    )
  }

  if (item.media_class === 'video') {
    const length = formatDuration(item.duration_seconds)
    return (
      <video
        className="hp-pf-box-video"
        src={state.url}
        controls
        playsInline
        preload="metadata"
        aria-label={length ? `${item.title}, ${length}` : item.title}
      />
    )
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img className="hp-pf-box-img" src={state.url} alt={item.title || ''} />
}
