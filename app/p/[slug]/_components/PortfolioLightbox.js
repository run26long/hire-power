'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import StrokeIcon, { ICON_MEDIA, ICON_ARROW_LEFT, ICON_ARROW_RIGHT } from './StrokeIcon'
import PortfolioMat from './PortfolioMat'
import { formatDuration } from '@/lib/portfolio'

// ============================================================================
// THE PORTFOLIO OVERLAY
//
// One surface over the page holding two views: the whole portfolio as a grid,
// and one piece of work at the shape it actually is. A reader moves between
// them inside the same surface, the way the evidence overlay already does -
// opening an item from the grid is a change of view, not a second dialog over
// the first. Nested modals are two focus traps arguing, and the reader loses.
//
// It used to be the item view alone, and "view full gallery" expanded the grid
// on the page underneath instead. That made the section grow without bound the
// moment somebody had a real portfolio, which is the filing-cabinet failure
// the six-item selection exists to prevent.
//
// NATURAL RATIO IN THE ITEM VIEW, NOT THE MAT'S
// The grids square everything so they read as grids. Here the work is the only
// thing on screen, so it is shown as it was made: a tall photograph stays tall
// and a widescreen still stays wide, both bounded by the viewport. Nothing is
// cropped and no source file is touched, in either view.
//
// EVERY FILE IS ASKED FOR BY ID
// The full file, not the thumbnail, signed for this direction at the moment it
// is needed. Moving to the next item signs the next one; nothing is held,
// because a link that outlives its signature is worse than no link.
//
// AND NOTHING KEEPS PLAYING
// The player is keyed on the item, so moving to the next one mounts a new
// element rather than pointing the old one at a different file - a <video>
// handed a new src keeps the position and play state of the one before it.
// Going back to the grid unmounts it outright. Either way a video that leaves
// the screen stops, rather than carrying on somewhere the reader cannot see.
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

export default function PortfolioLightbox({
  mode,          // 'grid' | 'item' | null
  items,
  startIndex,
  slug,
  lensId,
  onOpenItem,    // grid -> item, by index
  onBack,        // item -> grid, only when the reader came that way
  onClose
}) {
  const [index, setIndex] = useState(startIndex || 0)

  const surfaceRef = useRef(null)
  const closeRef = useRef(null)
  const scrollerRef = useRef(null)
  const returnTo = useRef(null)
  const touch = useRef(null)

  // Where the grid was when the reader opened something, and which mat it was,
  // so coming back puts both the scroll position and the focus where they were.
  const gridScroll = useRef(0)
  const cameFrom = useRef(null)

  // No mount guard: this is closed on the server and on the first client
  // render, so the portal below is only ever reached from a reader's event.
  const open = Boolean(mode)

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
    if (!open) return
    returnTo.current = document.activeElement
    const timer = window.setTimeout(() => closeRef.current?.focus(), 20)
    return () => {
      window.clearTimeout(timer)
      const back = returnTo.current
      returnTo.current = null
      if (back && document.contains(back) && typeof back.focus === 'function') back.focus()
    }
  }, [open])

  // The page behind does not scroll under an open dialog, and does not jump
  // sideways as its scrollbar goes: the width is handed back as padding.
  useEffect(() => {
    if (!open) return
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
  }, [open])

  // Escape steps back one view where there is a view to step back to, and
  // closes otherwise. The arrows move between items. Tab cycles inside: a
  // dialog the keyboard can walk out of while it is still over the page is a
  // dialog in name only.
  useEffect(() => {
    if (!open) return
    function onKey(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        if (mode === 'item' && onBack) onBack()
        else onClose?.()
        return
      }
      if (mode === 'item') {
        if (event.key === 'ArrowRight') { event.preventDefault(); go(1); return }
        if (event.key === 'ArrowLeft') { event.preventDefault(); go(-1); return }
      }
      if (event.key !== 'Tab') return

      const surface = surfaceRef.current
      if (!surface) return
      const reachable = [...surface.querySelectorAll(FOCUSABLE)]
        .filter(el => el.offsetParent !== null || el === closeRef.current)
      if (reachable.length === 0) return
      const first = reachable[0]
      const last = reachable[reachable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open, mode, go, onBack, onClose])

  // Coming back from an item: the grid is where it was, and so is focus.
  useEffect(() => {
    if (mode !== 'grid') return
    const node = scrollerRef.current
    if (node && gridScroll.current) node.scrollTop = gridScroll.current
    const id = cameFrom.current
    if (!id) return
    cameFrom.current = null
    const mat = surfaceRef.current?.querySelector(`[data-portfolio-id="${id}"]`)
    if (mat) mat.focus()
  }, [mode])

  const openFromGrid = useCallback((one, at) => {
    gridScroll.current = scrollerRef.current?.scrollTop || 0
    cameFrom.current = one.id
    setIndex(at)
    onOpenItem?.(at)
  }, [onOpenItem])

  if (!open || (mode === 'item' && !item)) return null

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

  const titleId = 'hp-pf-overlay-title'

  return createPortal(
    <div
      className="hp-pf-box"
      data-mode={mode}
      role="presentation"
      onMouseDown={event => { if (event.target === event.currentTarget) onClose?.() }}
    >
      <div
        className="hp-pf-box-surface"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-mode={mode}
        ref={surfaceRef}
        onTouchStart={mode === 'item' ? onTouchStart : undefined}
        onTouchEnd={mode === 'item' ? onTouchEnd : undefined}
      >
        <div className="hp-pf-box-bar">
          <div className="hp-pf-box-heading">
            {mode === 'item' && onBack && (
              <button type="button" className="hp-pf-back" onClick={onBack}>
                <span className="hp-pf-back-arrow" aria-hidden="true">←</span>
                Back to the portfolio
              </button>
            )}

            {mode === 'grid' ? (
              <>
                <span className="hp-pf-box-eyebrow">Portfolio</span>
                <h2 className="hp-pf-box-heading-title" id={titleId}>
                  All work <span className="hp-pf-box-count">({count})</span>
                </h2>
              </>
            ) : (
              <span className="hp-pf-box-count" id={titleId}>
                {count > 1 ? `${index + 1} of ${count}` : (item?.title || 'Portfolio')}
              </span>
            )}
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

        {mode === 'grid' ? (
          <div className="hp-pf-box-gallery" ref={scrollerRef}>
            <ul className="hp-pf-box-grid">
              {items.map((one, at) => (
                <li className="hp-pf-cell" key={one.id}>
                  <PortfolioMat
                    item={one}
                    slug={slug}
                    lensId={lensId}
                    onOpen={() => openFromGrid(one, at)}
                  />
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            <div className="hp-pf-box-stage">
              {count > 1 && (
                <button
                  type="button"
                  className="hp-pf-step"
                  data-step="prev"
                  onClick={() => go(-1)}
                  aria-label="Previous"
                >
                  <StrokeIcon paths={ICON_ARROW_LEFT} size={20} strokeWidth={1.6} />
                </button>
              )}

              {/* Keyed on the item so moving to the next one mounts a new
                  player rather than pointing the old one at a different file. */}
              <PortfolioMedia key={item.id} item={item} slug={slug} lensId={lensId} />

              {count > 1 && (
                <button
                  type="button"
                  className="hp-pf-step"
                  data-step="next"
                  onClick={() => go(1)}
                  aria-label="Next"
                >
                  <StrokeIcon paths={ICON_ARROW_RIGHT} size={20} strokeWidth={1.6} />
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
          </>
        )}
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
