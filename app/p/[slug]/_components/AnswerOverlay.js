'use client'

import { useEffect, useRef, useState } from 'react'

import AnswerPills from './AnswerPills'
import ProfileModal from './ProfileModal'

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
// The surface and everything a dialog has to do - the portal, the focus trap,
// Escape, the backdrop, the scroll lock, where focus goes afterwards - are
// ProfileModal's, and this file is what stands in it. That split arrived when
// the owner's own add-work flows needed the same dialog: two copies of six
// pieces of behaviour is six chances for one copy to be subtly wrong.
//
// The numbered row at the foot is the same one on the card behind this, so
// moving between answers never means closing anything. Beside it is the way
// onward: asking again puts the reader back in the form with everything they
// have already been told still here.
// ============================================================================

export default function AnswerOverlay({
  open, entry, pills, index, remaining, limitReached, onSelect, onAskAnother, onClose
}) {
  const bodyRef = useRef(null)
  const [openSources, setOpenSources] = useState(() => new Set())

  // The body scrolls; a new answer starts at its own beginning rather than
  // wherever the reader had scrolled the previous one to.
  useEffect(() => { bodyRef.current?.scrollTo?.(0, 0) }, [index])

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

  return (
    <ProfileModal
      open={open}
      eyebrow="Career Q&A"
      title={question}
      titleId={titleId}
      onClose={onClose}
      bodyRef={bodyRef}
      foot={
        /* Everything asked so far, and the way to ask one more. Outside the
           scrolling body so a long answer never pushes it off the surface. */
        <>
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
        </>
      }
    >
      <>
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
      </>
    </ProfileModal>
  )
}
