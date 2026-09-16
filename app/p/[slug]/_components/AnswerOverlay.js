'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import AnswerPills from './AnswerPills'

// ============================================================================
// THE ANSWER
//
// A Career Q&A answer, lifted off the form and onto its own surface. Same
// visual language as the skill proof box above it: translucent, blurred, rimmed
// in a single hair of lavender, feathered outward rather than dropped onto the
// page. That component is approved and is not touched or imported by this one;
// what is shared is the look, expressed in its own rules.
//
// It grows with what it holds and stops at the viewport, after which the body
// scrolls quietly rather than the surface running off the screen.
//
// The numbered row at the foot is the same one on the card behind this, so
// moving between answers never means closing anything. Beside it is the way
// onward: asking again puts the reader back in the form with everything they
// have already been told still here.
// ============================================================================

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', '[tabindex]:not([tabindex="-1"])'
].join(',')

export default function AnswerOverlay({
  open, entry, pills, index, remaining, limitReached, onSelect, onAskAnother, onClose
}) {
  const surfaceRef = useRef(null)
  const closeRef = useRef(null)
  const returnTo = useRef(null)
  const bodyRef = useRef(null)
  const [openSources, setOpenSources] = useState(() => new Set())

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

  // The body scrolls; a new answer starts at its own beginning rather than
  // wherever the reader had scrolled the previous one to.
  useEffect(() => { bodyRef.current?.scrollTo?.(0, 0) }, [index])

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

  const onBackdrop = useCallback((event) => {
    if (event.target === event.currentTarget) onClose()
  }, [onClose])

  if (!open || !entry) return null

  const { question, result } = entry
  const titleId = 'hp-rt-answer-title'

  // Keyed by answer as well as by source, so a source unfolded on one answer
  // does not arrive already open on the next. No effect resets it: the key
  // changing is the reset.
  const sourceKey = (id) => `${index}:${id}`
  const toggle = (id) => setOpenSources(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  return createPortal(
    <div className="hp-rt-backdrop" data-variant="answer" onMouseDown={onBackdrop}>
      <div
        className="hp-rt-answer-surface"
        ref={surfaceRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="hp-rt-answer-head">
          <div className="hp-rt-answer-heading">
            <span className="hp-rt-answer-eyebrow">Career Q&amp;A</span>
            <h2 className="hp-rt-answer-q" id={titleId}>{question}</h2>
          </div>
          <button type="button" className="hp-rt-close" ref={closeRef} aria-label="Close" onClick={onClose}>
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="hp-rt-answer-body" ref={bodyRef}>
          {result.answered ? (
            <>
              <p className="hp-rt-answer-text">{result.answer}</p>

              {result.citations?.length > 0 ? (
                <div className="hp-rt-answer-sources">
                  <h3 className="hp-rt-answer-sources-h">
                    Grounded in {result.citations.length} source{result.citations.length === 1 ? '' : 's'}
                  </h3>

                  <ul className="hp-rt-cites">
                    {result.citations.map(c => {
                      const shown = openSources.has(sourceKey(c.id))
                      return (
                        <li className="hp-rt-cite" key={c.id} data-kind={c.kind}>
                          <div className="hp-rt-cite-head">
                            <span className="hp-rt-cite-kind">{c.kind}</span>
                            <span className="hp-rt-cite-label">{c.label}</span>
                          </div>

                          {shown && c.snippet ? <p className="hp-rt-cite-snippet">{c.snippet}</p> : null}

                          {c.snippet ? (
                            <div className="hp-rt-cite-actions">
                              <button
                                type="button"
                                className="hp-rt-cite-more"
                                aria-expanded={shown}
                                onClick={() => toggle(sourceKey(c.id))}
                              >
                                {shown ? 'Hide source' : 'Show source'}
                              </button>
                            </div>
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ) : null}
            </>
          ) : (
            // The honest outcome, and not dressed as a failure.
            <div className="hp-rt-noinfo">
              <p className="hp-rt-noinfo-text">{result.answer}</p>
              <p className="hp-rt-noinfo-note">
                This tool only answers from what the candidate has recorded. It will not guess,
                and it will not fill a gap with something that sounds close.
              </p>
            </div>
          )}

          {typeof remaining === 'number' ? (
            <p className="hp-rt-remaining">
              {remaining} question{remaining === 1 ? '' : 's'} left today
            </p>
          ) : null}
        </div>

        {/* Everything asked so far, and the way to ask one more. Outside the
            scrolling body so a long answer never pushes it off the surface. */}
        <footer className="hp-rt-answer-foot">
          <AnswerPills items={pills} index={index} onSelect={onSelect} variant="overlay" />

          {/* At the limit the box behind this is closed for the day, so the
              way onward would lead nowhere. Every answer already given is
              still one number away. */}
          {limitReached ? (
            <p className="hp-rt-limit">
              That&apos;s today&apos;s questions. Every answer stays here for this visit.
            </p>
          ) : (
            <button type="button" className="hp-rt-again" onClick={onAskAnother}>
              Ask another question
            </button>
          )}
        </footer>
      </div>
    </div>,
    document.body
  )
}
