'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import StrokeIcon from './StrokeIcon'
import { EvidenceStage, EvidenceFoot, glyphFor, metaLine } from './EvidenceViewer'

// ============================================================================
// THE EVIDENCE OVERLAY
//
// One surface over the page, holding two views: the whole collection for this
// direction, and one item in full. A reader moves between them inside the same
// surface - opening an item from the gallery is a change of view, not a second
// dialog over the first. Nested modals are two focus traps arguing, and the
// reader is the one who loses.
//
// Everything that makes this a dialog lives here and nowhere else: the portal,
// the focus trap, Escape, the backdrop, the scroll lock on the page behind, and
// where focus goes when it closes. The detail content itself is imported, so
// the item view is the same one a preview tile opens directly.
// ============================================================================

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input', 'select', 'textarea',
  'video[controls]', 'audio[controls]', 'iframe', '[tabindex]:not([tabindex="-1"])'
].join(',')

const FAMILY_LABEL = { work: 'Work', credentials: 'Credentials', recognition: 'Recognition' }
const FAMILY_ORDER = ['work', 'credentials', 'recognition']

export default function EvidenceOverlay({
  mode,          // 'gallery' | 'detail'
  item,          // the item, in detail mode
  items,         // everything this direction carries, in placement order
  leadId,        // which one leads, so the gallery can mark it quietly
  slug,
  lensId,
  onOpenItem,    // gallery -> detail
  onBack,        // detail -> gallery, only when the reader came that way
  onClose
}) {
  const [family, setFamily] = useState('all')

  const surfaceRef = useRef(null)
  const closeRef = useRef(null)
  const scrollerRef = useRef(null)
  const returnTo = useRef(null)

  // Where the gallery was when the reader opened something, and which tile it
  // was, so coming back puts both the page and the focus where they were.
  const galleryScroll = useRef(0)
  const cameFrom = useRef(null)

  // Every visit starts clean, because the section gives this component a new
  // key each time it is opened fresh. Going gallery -> item -> back keeps the
  // same key, so the filter and the scroll position survive that; closing, or
  // changing direction, does not. A filter left on from a collection the reader
  // has since navigated away from is not a preference, it is a leak.
  const open = Boolean(mode)

  // Whatever had focus when this opened is where focus goes back to - the
  // "View all evidence" control, or the preview tile - even if that element has
  // since left the document, which a direction change would do.
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

  // The page behind does not scroll while this is over it. The scrollbar's
  // width is given back as padding so the page does not jump sideways as it
  // goes.
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

  // Escape steps back one view rather than closing outright, when there is a
  // view to step back to. Tab cycles inside: a dialog the keyboard can walk out
  // of while it is still over the page is a dialog in name only.
  useEffect(() => {
    if (!open) return
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        if (mode === 'detail' && onBack) onBack()
        else onClose()
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
  }, [open, mode, onBack, onClose])

  // Coming back from an item: the gallery is where it was, and so is focus.
  useEffect(() => {
    if (mode !== 'gallery') return
    const node = scrollerRef.current
    if (node && galleryScroll.current) node.scrollTop = galleryScroll.current
    const id = cameFrom.current
    if (!id) return
    cameFrom.current = null
    const tile = surfaceRef.current?.querySelector(`[data-evidence-id="${id}"]`)
    if (tile) tile.focus()
  }, [mode])

  const onBackdrop = useCallback((event) => {
    if (event.target === event.currentTarget) onClose()
  }, [onClose])

  const openFromGallery = useCallback((evidence) => {
    galleryScroll.current = scrollerRef.current?.scrollTop || 0
    cameFrom.current = evidence.id
    onOpenItem(evidence)
  }, [onOpenItem])

  if (!open) return null

  const families = FAMILY_ORDER.filter(name => items.some(one => one.family === name))
  // A filter that no longer selects anything is read as "all" rather than
  // corrected afterwards, so an empty grid is never rendered at all.
  const activeFamily = families.includes(family) ? family : 'all'
  const shown = activeFamily === 'all' ? items : items.filter(one => one.family === activeFamily)

  const titleId = 'hp-ev-overlay-title'

  return createPortal(
    <div className="hp-ev-backdrop" onMouseDown={onBackdrop}>
      <div
        className="hp-ev-surface"
        ref={surfaceRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-mode={mode}
        data-media={mode === 'detail' ? item?.media_class : undefined}
      >
        {mode === 'gallery' ? (
          <div className="hp-ev-head">
            <div className="hp-ev-heading">
              <span className="hp-ev-family">Evidence</span>
              <h2 className="hp-ev-title" id={titleId}>
                All evidence <span className="hp-ev-count">({items.length})</span>
              </h2>
            </div>
            <button type="button" className="hp-ev-close" ref={closeRef} aria-label="Close" onClick={onClose}>
              <span aria-hidden="true">×</span>
            </button>
          </div>
        ) : (
          <div className="hp-ev-head">
            <div className="hp-ev-heading">
              {onBack && (
                <button type="button" className="hp-ev-back" onClick={onBack}>
                  <span className="hp-ev-back-arrow" aria-hidden="true">←</span>
                  Back to all evidence
                </button>
              )}
              <span className="hp-ev-family">{item?.family}</span>
              <h2 className="hp-ev-title" id={titleId}>{item?.title}</h2>
              {metaLine(item) && <p className="hp-ev-meta">{metaLine(item)}</p>}
            </div>
            <button type="button" className="hp-ev-close" ref={closeRef} aria-label="Close" onClick={onClose}>
              <span aria-hidden="true">×</span>
            </button>
          </div>
        )}

        {mode === 'gallery' ? (
          <>
            {/* Offered only where there is a boundary to draw. One family is
                not a choice, it is a label on everything. */}
            {families.length > 1 && (
              <div className="hp-ev-filter" role="group" aria-label="Filter evidence by kind">
                <button
                  type="button"
                  className="hp-ev-chip"
                  aria-pressed={activeFamily === 'all'}
                  onClick={() => setFamily('all')}
                >
                  All
                </button>
                {families.map(name => (
                  <button
                    key={name}
                    type="button"
                    className="hp-ev-chip"
                    data-family={name}
                    aria-pressed={activeFamily === name}
                    onClick={() => setFamily(name)}
                  >
                    {FAMILY_LABEL[name]}
                  </button>
                ))}
              </div>
            )}

            <div className="hp-ev-gallery" ref={scrollerRef}>
              <div className="hp-ev-gallery-grid">
                {shown.map(one => (
                  <button
                    type="button"
                    key={one.id}
                    className="hp-ev-card"
                    data-family={one.family}
                    data-evidence-id={one.id}
                    data-lead={one.id === leadId ? 'true' : undefined}
                    onClick={() => openFromGallery(one)}
                    aria-haspopup="dialog"
                  >
                    <span className="hp-ev-card-mark" aria-hidden="true">
                      <StrokeIcon paths={glyphFor(one.media_class)} size={16} />
                    </span>
                    <span className="hp-ev-card-type">
                      {one.evidence_type || FAMILY_LABEL[one.family]}
                      {one.id === leadId && <span className="hp-ev-card-lead">Featured</span>}
                    </span>
                    <span className="hp-ev-card-title">{one.title}</span>
                    {(one.organization || one.date_label) && (
                      <span className="hp-ev-card-meta">
                        {[one.organization, one.date_label].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="hp-ev-stage">
              <EvidenceStage item={item} slug={slug} lensId={lensId} />
            </div>
            <EvidenceFoot item={item} />
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
