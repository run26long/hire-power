'use client'

import { useEffect, useRef, useState } from 'react'
import Reveal from './Reveal'

// ============================================================================
// COLLECTIVE IMPACT + FIRSTHAND ACCOUNTS
//
// Experience has just shown the work. This act asks whether the people around
// it felt the difference, and answers it twice: once as the synthesis across
// everything they wrote, and once in their own words.
//
// The synthesis is read, never made here. It is generated and stored by its own
// authenticated route; the public page only ever displays what is already in
// the table. Nothing on this page can start a generation.
//
// The accounts are a scroll region rather than a wheel. Every published one is
// in the list, in the order this direction ranked them, and the browser does
// the scrolling: there is no offset to hold, no window to compute, and the
// wheel, the trackpad, touch and the keyboard all work without anything being
// written for them.
//
// Every testimonial is rendered exactly as stored. Collapsing a long one is a
// display cap and nothing else: the full text is always in the DOM, and the
// control only appears when the text is genuinely taller than the cap.
// ============================================================================

const pad = (n) => String(n).padStart(2, '0')

export default function CollectiveImpact({
  impact,
  testimonials,
  animate = true,
  reducedMotion = false,
  directionKey
}) {
  const [expanded, setExpanded] = useState(() => new Set())
  const [overflowing, setOverflowing] = useState(() => new Set())
  const [shownFor, setShownFor] = useState(directionKey)

  const bodyRefs = useRef(new Map())
  const scrollRef = useRef(null)

  const quotes = (Array.isArray(testimonials) ? testimonials : []).filter(
    (t) => String(t?.polished_text || '').trim()
  )
  const summary = String(impact?.summary || '').trim()
  const themes = Array.isArray(impact?.themes) ? impact.themes.filter((t) => t?.label && t?.statement) : []

  const hasImpact = Boolean(summary)
  const hasQuotes = quotes.length > 0

  // A new direction starts the act again. Adjusted during render rather than
  // from an effect, which is the supported way to reset state when a prop
  // changes: it settles before paint.
  if (shownFor !== directionKey) {
    setShownFor(directionKey)
    setExpanded(new Set())
  }

  // The scroll position belongs to the browser rather than to React, so it is
  // put back by hand. Each direction ranks these accounts for itself, and the
  // reader has to arrive at the top of that ranking rather than wherever the
  // previous direction happened to be left.
  useEffect(() => {
    const node = scrollRef.current
    if (node) node.scrollTop = 0
  }, [directionKey])

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
  }, [quotes.length, expanded, directionKey])

  const toggle = (id) => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Collective Impact is drawn from these accounts and from nothing else, so
  // a stored synthesis must not outlive them: if every account has been
  // withdrawn, unpublished or emptied, the whole act goes rather than a
  // conclusion standing on evidence a reader can no longer see. Nothing is
  // deleted by this - the row is still there for the day new testimony
  // arrives. `quotes` is the collection the page was handed, already filtered
  // to what may be served publicly.
  if (!hasQuotes) return null

  return (
    <section className="hp-impact">
      <div className="hp-wrap">
        {/* One heading over both columns, because the synthesis on the left and
            the accounts on the right are two readings of the same thing. What
            each column is then says so inside the column itself. */}
        <Reveal enabled={animate} className="hp-impact-intro">
          <h2 className="hp-impact-headline">What others see.</h2>
        </Reveal>

        {/* Which sides are actually there, so one missing side widens the
            other rather than leaving an empty column beside it. */}
        <div
          className="hp-impact-flow"
          data-synthesis={hasImpact ? 'true' : 'false'}
          data-voices={hasQuotes ? 'true' : 'false'}
        >
          {hasImpact && (
            <Reveal enabled={animate} className="hp-impact-synthesis">
              {/* Names the card, the way Firsthand Accounts names the column
                  opposite. It sits inside the surface rather than above it, so
                  the display heading keeps the whole section and this keeps
                  only the card. */}
              <span className="hp-label hp-impact-eyebrow">Collective Impact</span>
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
              <div className="hp-voices-head">
                <h3 className="hp-voices-title">Firsthand Accounts</h3>
                <p className="hp-voices-note">In the words of people who saw the work up close.</p>
              </div>

              {/* The scroll region. Focusable so the keyboard can reach it and
                  move it, and labelled so what is being scrolled is announced.
                  A single account fits inside it and simply never scrolls. */}
              <div
                className="hp-voices-scroll"
                ref={scrollRef}
                tabIndex={0}
                role="region"
                aria-label="Firsthand accounts"
              >
                <ul className="hp-voices">
                  {quotes.map((quote, i) => {
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

                        {/* The footer: who said it, and - quietly, off to the
                            right - the way back into the whole of it. Name,
                            title and company always. The relationship is the
                            one line that waits: it is the detail that can be
                            read once the quote it belongs to is open. */}
                        <div className="hp-voice-foot">
                          <p className="hp-voice-face">
                            <span className="hp-voice-name">{quote.recipient_name}</span>
                            {quote.recipient_title && (
                              <span className="hp-voice-role">{quote.recipient_title}</span>
                            )}
                            {quote.relationship && isOpen && (
                              <span className="hp-voice-rel">{quote.relationship}</span>
                            )}
                          </p>

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
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </Reveal>
          )}
        </div>
      </div>
    </section>
  )
}
