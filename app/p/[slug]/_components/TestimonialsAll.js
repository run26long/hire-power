'use client'

import { useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

// ============================================================================
// EVERY FIRSTHAND ACCOUNT, WHEN THERE ARE MORE THAN THE PAGE SHOWS
//
// The column shows three. The rest are here, in the same order, read only.
//
// WHY THIS SHELL
// It is Manage portfolio's box, markup for markup: hp-pf-box, the surface,
// the bar, the gallery, all with data-mode="manage". That is not a styling
// shortcut. Those classes carry the panel's measure, its header, its close
// control, the resets that let a control keep its own border, and the thin
// themed scrollbar the page uses everywhere else. A modal written from
// scratch here would be a second set of all of that, drifting from the first
// the moment either changed - and it would arrive with the grey system
// scrollbar, which is the one thing the shared one exists to avoid.
//
// WHAT IS DIFFERENT FROM THE REVIEW PANEL
// Nothing is decided here. There is no footer, because there is nothing to
// press: this is the whole list, and the way out is the way out.
// ============================================================================

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', '[tabindex]:not([tabindex="-1"])'
].join(',')

export default function TestimonialsAll({ items, onClose }) {
  const surfaceRef = useRef(null)
  const closeRef = useRef(null)
  const returnTo = useRef(null)

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

  const list = Array.isArray(items) ? items : []
  if (list.length === 0 || typeof document === 'undefined') return null

  const titleId = 'hp-voices-all-title'

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
            <span className="hp-pf-box-eyebrow">Testimonials</span>
            <h2 className="hp-pf-box-heading-title" id={titleId}>
              Firsthand Accounts <span className="hp-pf-box-count">({list.length})</span>
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

        <div className="hp-pf-box-gallery">
          {/* The page's own rows, in the page's own order. Every one of them
              open: the cap on the column is there because three quotes share
              a page with everything else, and nothing here is sharing. */}
          <ul className="hp-voices">
            {list.map((quote, at) => (
              <li className="hp-voice-item" key={quote.id || `quote-${at}`}>
                <blockquote className="hp-voice-quote" data-expanded="true">
                  {quote.polished_text}
                </blockquote>

                <div className="hp-voice-foot">
                  <p className="hp-voice-face">
                    <span className="hp-voice-name">{quote.recipient_name}</span>
                    {quote.recipient_title && (
                      <span className="hp-voice-role">{quote.recipient_title}</span>
                    )}
                  </p>
                  {quote.relationship && (
                    <p className="hp-voice-rel">{quote.relationship}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>,
    document.body
  )
}
