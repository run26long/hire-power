'use client'

import { useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

// ============================================================================
// THE PROFILE'S DIALOG
//
// One surface over the page, and one implementation of what that means: the
// portal, the focus trap, Escape, the backdrop, the scroll lock on the page
// behind, and where focus goes when it closes. Every pop-out on this profile
// had its own copy of those six things, which is six chances for one of them
// to be slightly wrong in a way nobody notices until a keyboard walks out of a
// modal that is still over the page.
//
// It carries no look of its own. The classes are the ones the Career Q&A
// answer already established - the eggplant surface with a hair of lavender
// round it, the glow under it, the pinned head and foot with the body scrolling
// between them - and this component states none of them again. Reusing the
// shell means reusing the stylesheet, not writing a second one that resembles
// it.
//
// WHY THE PORTAL NEEDS TO BE NAMED
// It renders onto document.body, which is outside .hp-profile, so nothing
// scoped to the Profile reaches it by descent. profile.css already names
// .hp-rt-backdrop in the resets for exactly this reason. `portalClass` is how
// the owner's editor does the same thing: the management stylesheet scopes its
// controls to .hp-profile OR .hp-ed-portal, and a modal that carries the second
// class is dressed by the same rules that dress the document behind it.
// ============================================================================

// Anything a keyboard can land on. Deliberately narrow: the point is to know
// where the ends of the dialog are, not to enumerate the DOM.
const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',')

export default function ProfileModal({
  open,
  eyebrow = null,
  title,
  titleId = 'hp-modal-title',
  onClose,
  // Rendered under the head, in the part that scrolls.
  children,
  // Rendered below that and pinned, so the way out of a long form is still on
  // screen at the bottom of it.
  foot = null,
  portalClass = null,
  //'compact' for a step that is one short choice, absent for a form. It sets
  // an attribute and nothing else: the widths live in the stylesheet with the
  // rest of the shell.
  size = null,
  // The scrolling part, when the caller needs to reach it - an answer that
  // changes underneath the reader has to start at its own beginning.
  bodyRef = null,
  // Where focus goes when the dialog opens. Defaults to the close control,
  // which is the one thing every dialog here has.
  initialFocusRef = null,
  labelledBy = null
}) {
  const surfaceRef = useRef(null)
  const closeRef = useRef(null)
  const returnTo = useRef(null)

  // Whatever had focus when this opened is where focus goes back to, even if
  // that element has since left the document - which a direction change, or a
  // section re-rendering behind the dialog, would do.
  useEffect(() => {
    if (!open) return
    returnTo.current = document.activeElement
    const timer = window.setTimeout(() => {
      const first = initialFocusRef?.current || closeRef.current
      first?.focus?.()
    }, 20)
    return () => {
      window.clearTimeout(timer)
      const back = returnTo.current
      returnTo.current = null
      if (back && document.contains(back) && typeof back.focus === 'function') back.focus()
    }
  }, [open, initialFocusRef])

  // The page behind does not scroll while this is over it, and does not move
  // sideways as it stops: the scrollbar's width is given back as padding. Its
  // scroll position is untouched, so closing puts the owner back exactly where
  // they were rather than at the top of a long profile.
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

  // Escape closes. Tab cycles inside: a dialog the keyboard can walk out of
  // while it is still over the page is a dialog in name only.
  useEffect(() => {
    if (!open) return
    const onKey = (event) => {
      if (event.key === 'Escape') { event.stopPropagation(); onClose(); return }
      if (event.key !== 'Tab') return
      const surface = surfaceRef.current
      if (!surface) return
      const stops = [...surface.querySelectorAll(FOCUSABLE)]
        .filter(el => el.offsetParent !== null || el === closeRef.current)
      if (!stops.length) return
      const first = stops[0]
      const last = stops[stops.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open, onClose])

  // mousedown rather than click, and only on the backdrop itself: a drag that
  // starts inside the surface and ends outside it is a text selection, not a
  // decision to close.
  const onBackdrop = useCallback((event) => {
    if (event.target === event.currentTarget) onClose()
  }, [onClose])

  if (!open) return null

  return createPortal(
    <div
      className={portalClass ? `hp-rt-backdrop ${portalClass}` : 'hp-rt-backdrop'}
      data-variant="answer"
      onMouseDown={onBackdrop}
    >
      <div
        className="hp-rt-answer-surface"
        ref={surfaceRef}
        data-size={size || undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy || titleId}
      >
        <header className="hp-rt-answer-head">
          <div className="hp-rt-answer-heading">
            {eyebrow ? <span className="hp-rt-answer-eyebrow">{eyebrow}</span> : null}
            <h2 className="hp-rt-answer-q" id={titleId}>{title}</h2>
          </div>
          <button type="button" className="hp-rt-close" ref={closeRef} aria-label="Close" onClick={onClose}>
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="hp-rt-answer-body" ref={bodyRef}>
          {children}
        </div>

        {foot ? <footer className="hp-rt-answer-foot">{foot}</footer> : null}
      </div>
    </div>,
    document.body
  )
}
