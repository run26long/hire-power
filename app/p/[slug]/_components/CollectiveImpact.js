'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Reveal from './Reveal'
import { wheelWindow } from '../_lib/profileData'

// ============================================================================
// COLLECTIVE IMPACT + FIRSTHAND
//
// Experience has just shown the work. This act asks whether the people around
// it felt the difference, and answers it twice: once as the synthesis across
// everything they wrote, and once in their own words.
//
// The synthesis is read, never made here. It is generated and stored by its own
// authenticated route; the public page only ever displays what is already in
// the table. Nothing on this page can start a generation.
//
// Every testimonial is rendered exactly as stored. Collapsing a long one is a
// display cap and nothing else: the full text is always in the DOM, and the
// control only appears when the text is genuinely taller than the cap.
// ============================================================================

// Three at a time. A fourth testimonial is what turns the list into a wheel.
const WINDOW = 3

const pad = (n) => String(n).padStart(2, '0')

export default function CollectiveImpact({
  impact,
  testimonials,
  animate = true,
  reducedMotion = false,
  directionKey
}) {
  const [offset, setOffset] = useState(0)
  const [expanded, setExpanded] = useState(() => new Set())
  const [overflowing, setOverflowing] = useState(() => new Set())
  const [shownFor, setShownFor] = useState(directionKey)

  const bodyRefs = useRef(new Map())
  const touchStart = useRef(null)

  const quotes = (Array.isArray(testimonials) ? testimonials : []).filter(
    (t) => String(t?.polished_text || '').trim()
  )
  const summary = String(impact?.summary || '').trim()
  const themes = Array.isArray(impact?.themes) ? impact.themes.filter((t) => t?.label && t?.statement) : []

  const hasImpact = Boolean(summary)
  const hasQuotes = quotes.length > 0
  const isWheel = quotes.length > WINDOW

  // A new direction starts the act again. Adjusted during render rather than
  // from an effect, which is the supported way to reset state when a prop
  // changes: it settles before paint.
  if (shownFor !== directionKey) {
    setShownFor(directionKey)
    setOffset(0)
    setExpanded(new Set())
  }

  const visible = wheelWindow(quotes.length, offset)

  // Which quotes are actually taller than the cap. Measured rather than
  // guessed from a character count, so the control never appears on a quote
  // that already fits.
  useEffect(() => {
    const measure = () => {
      const tall = new Set()
      for (const [id, node] of bodyRefs.current) {
        if (!node) continue
        // Only meaningful while the cap is on; an expanded one is not clamped.
        if (node.dataset.expanded === 'true') {
          if (overflowing.has(id)) tall.add(id)
          continue
        }
        if (node.scrollHeight > node.clientHeight + 1) tall.add(id)
      }
      setOverflowing(tall)
    }

    measure()
    if (typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(measure)
    for (const node of bodyRefs.current.values()) if (node) observer.observe(node)
    return () => observer.disconnect()
    // `overflowing` is deliberately not a dependency: it is what this writes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotes.length, offset, expanded])

  const turn = useCallback(
    (delta) => {
      if (!isWheel) return
      setOffset((current) => {
        const total = quotes.length
        return ((current + delta) % total + total) % total
      })
      // A quote that was opened for reading should not travel with the wheel.
      setExpanded(new Set())
    },
    [isWheel, quotes.length]
  )

  const onTouchStart = (event) => {
    if (!isWheel) return
    touchStart.current = event.touches?.[0]?.clientY ?? null
  }

  const onTouchEnd = (event) => {
    if (!isWheel || touchStart.current === null) return
    const end = event.changedTouches?.[0]?.clientY ?? null
    const delta = end === null ? 0 : touchStart.current - end
    touchStart.current = null
    // Enough to be a deliberate flick rather than a tap that drifted.
    if (Math.abs(delta) < 40) return
    turn(delta > 0 ? 1 : -1)
  }

  const toggle = (id) => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (!hasImpact && !hasQuotes) return null

  return (
    <section className="hp-impact">
      <div className="hp-wrap">
        <div className="hp-impact-grid" data-synthesis={hasImpact ? 'true' : 'false'} data-voices={hasQuotes ? 'true' : 'false'}>
          {hasImpact && (
            <Reveal enabled={animate} className="hp-impact-synthesis">
              <span className="hp-label">Collective impact</span>
              <p className="hp-impact-summary">{summary}</p>

              {/* The stored `label` is internal. It stays in the row so the
                  schema does not have to change and a future editor has
                  something to key on, but it is not shown: the numeral and the
                  statement are the whole of what a reader gets. */}
              {themes.length > 0 && (
                <ol className="hp-themes">
                  {themes.map((theme, i) => (
                    <li className="hp-theme" key={theme.label || i}>
                      <span className="hp-theme-index" aria-hidden="true">{pad(i + 1)}</span>
                      <span className="hp-theme-statement">{theme.statement}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Reveal>
          )}

          {hasQuotes && (
            <Reveal enabled={animate} delay={110} className="hp-impact-voices">
              <span className="hp-label">Firsthand</span>

              <ul
                className="hp-voices"
                data-wheel={isWheel ? 'true' : 'false'}
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
              >
                {visible.map((i) => {
                  const quote = quotes[i]
                  const id = quote.id || `quote-${i}`
                  const isOpen = expanded.has(id)
                  const canExpand = overflowing.has(id)

                  return (
                    <li className="hp-voice-item" key={id}>
                      <blockquote
                        className="hp-voice-quote"
                        data-expanded={isOpen ? 'true' : 'false'}
                        ref={(el) => {
                          if (el) bodyRefs.current.set(id, el)
                          else bodyRefs.current.delete(id)
                        }}
                      >
                        {quote.polished_text}
                      </blockquote>

                      {canExpand && (
                        <button
                          type="button"
                          className="hp-voice-more"
                          aria-expanded={isOpen}
                          onClick={() => toggle(id)}
                        >
                          {isOpen ? 'Show less' : 'Read full quote'}
                        </button>
                      )}

                      {/* Name, title and company always. The relationship is
                          the one line that waits: collapsed, three of these are
                          stacked and it is the detail that can be read once the
                          quote it belongs to has been opened. */}
                      <p className="hp-voice-face">
                        <span className="hp-voice-name">{quote.recipient_name}</span>
                        {quote.recipient_title && (
                          <span className="hp-voice-role">{quote.recipient_title}</span>
                        )}
                        {quote.relationship && isOpen && (
                          <span className="hp-voice-rel">{quote.relationship}</span>
                        )}
                      </p>
                    </li>
                  )
                })}
              </ul>

              {isWheel && (
                <div className="hp-voices-foot">
                  <span className="hp-voices-count" aria-live="polite">
                    {pad(visible[0] + 1)}
                    <span className="hp-voices-of" aria-hidden="true"> / </span>
                    <span className="hp-voices-total">{pad(quotes.length)}</span>
                  </span>

                  <div className="hp-voices-steps">
                    <button
                      type="button"
                      className="hp-voices-step"
                      data-step="up"
                      aria-label="Previous testimonials"
                      onClick={() => turn(-1)}
                    >
                      <span className="hp-voices-chevron" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="hp-voices-step"
                      data-step="down"
                      aria-label="Next testimonials"
                      onClick={() => turn(1)}
                    >
                      <span className="hp-voices-chevron" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}
            </Reveal>
          )}
        </div>
      </div>
    </section>
  )
}
