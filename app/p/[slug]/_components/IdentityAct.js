'use client'

import { EditPencil, EditEmpty, useEditSlot } from './EditAffordance'

// ============================================================================
// ACT I - the cover.
//
// One stage carrying the header, the identity, the proof and the direction
// invitation. Source order is the phone's reading order: identity, lead proof,
// the two supporting figures, invitation. At 768 and up the same elements are
// placed on a twelve column grid and allowed to cross each other, so the lead
// figure lands inside the band the name and deck make rather than sitting in a
// column beside them.
//
// The three proof figures are the ones already in the data. With none on file
// the identity simply runs on and nothing is held open for them.
//
// Nothing about availability, location or what this person is open to appears
// here. All of that remains a bottom-of-Profile concern.
// ============================================================================
// ---------------------------------------------------------------------------
// Proof values arrive in whatever shape the generation produced. Most are one
// compact token the display scale was designed for: "100%", "150", "$30M".
// Some are a metric followed by a written unit, which the generation prompt
// asks for by name whenever a direction has no numeric proof: "8 leaders",
// "75 days", "10+ years". Setting a whole phrase like that at 130px is what
// broke the composition.
//
// So a value is split only when it genuinely begins with a number or a currency
// figure and the rest starts with a letter. Anything else is left exactly as it
// arrived: "$400K-$1.6M" has no space to split on, and a value that opens with
// a word is not a metric and is passed through untouched.
// ---------------------------------------------------------------------------
const COMPOUND_VALUE = /^\s*([$£€¥]?\d[\d.,]*(?:\s*[–—-]\s*[$£€¥]?[\d.,]+)?\+?[%kKmMbBxX×]?)\s+([A-Za-z][\s\S]*?)\s*$/

function splitProofValue(value) {
  const text = String(value ?? '')
  const match = text.match(COMPOUND_VALUE)
  if (!match) return { core: text, unit: null }
  return { core: match[1].trim(), unit: match[2] }
}

// A guard for the rare value that is neither compound nor compact, such as a
// written range. It is not a global shrink: every value currently in the data
// is four characters or fewer at its core and keeps the approved scale.
function coreLength(core) {
  return core.length >= 8 ? 'long' : 'compact'
}

// One proof value, set as a lockup: the metric at the display scale it was
// designed for, the written unit beside it as a smaller companion. The space
// between them is a real text node, so the value still reads as one string to
// a screen reader.
function ProofValue({ value, className }) {
  const { core, unit } = splitProofValue(value)

  return (
    <span className={className} data-len={coreLength(core)}>
      <span className="hp-proof-core">{core}</span>
      {unit && (
        <>
          {' '}
          <span className="hp-proof-unit">{unit}</span>
        </>
      )}
    </span>
  )
}

export default function IdentityAct({
  displayName,
  headline,
  proofPoints,
  directionKey,
  chrome,
  directions,
  glowKey,
  animate
}) {
  const hasProof = proofPoints.length > 0
  const [lead, ...supporting] = proofPoints
  const slot = useEditSlot()

  return (
    <section className="hp-act1">
      <span className="hp-act1-atmosphere" aria-hidden="true" />

      {/* Keyed on the selection so React replaces the node and the one pass
          replays. It exists only for the length of a direction change. */}
      {animate && glowKey > 0 && (
        <span key={glowKey} className="hp-act1-beam" aria-hidden="true" />
      )}

      <div className="hp-frame hp-act1-frame">
        {chrome}

        <div className="hp-act1-stage" data-proof={hasProof ? 'true' : 'false'}>
          {/* The selector comes first, in the DOM and on the page, because
              everything below it is what it changes. Choosing a direction and
              then meeting the identity written for it is the right order; the
              reverse asks the reader to re-read what they have just taken in. */}
          <div className="hp-act1-invite">{directions}</div>

          <div className={`hp-act1-identity${slot}`}>
            <EditPencil label="the headline for this direction" />
            <span className="hp-act1-eyebrow">Career Profile</span>

            {/* The stop is part of the setting, not part of the name. */}
            <h1 className="hp-name">{displayName}.</h1>

            {/* The deck. It belongs to the chosen direction, so it refocuses
                with the rest and leads the ordered groups. */}
            {headline && (
              <p className="hp-act1-deck hp-refocus" data-resolve="positioning">
                {headline}
              </p>
            )}
          </div>

          {hasProof && (
            <>
              {/* Keyed on the direction so the entrance replays when the
                  reader changes chapter: the node is a new node, so the CSS
                  animation on it starts again. Restarting it by toggling a
                  class would need the browser to be forced to reflow between
                  the two states, which is a trick; this is just how keys work.

                  The figures mount only after the swap, so what fades in is
                  always the direction being arrived at - the one being left
                  has already gone out with the rest of the refocus. */}
              <div
                className="hp-proof-lead hp-refocus hp-proof-enter"
                data-resolve="positioning"
                data-enter="0"
                key={`lead-${directionKey}`}
              >
                <span className="hp-proof-caption">Selected proof</span>
                <ProofValue className="hp-proof-lead-num" value={lead?.num} />
                <span className="hp-proof-lead-label">{lead?.label}</span>
              </div>

              {/* The refocus sits on each figure rather than on the wrapper:
                  the wrapper is `display: contents` at desktop so it grows no
                  box, and an opacity or filter on it would do nothing. */}
              {supporting.length > 0 && (
                <div className="hp-proof-subs">
                  {supporting.map((point, index) => (
                    <div
                      className="hp-proof-sub hp-refocus hp-proof-enter"
                      data-resolve="positioning"
                      data-sub={index}
                      data-enter={index + 1}
                      key={`sub-${index}-${directionKey}`}
                    >
                      <ProofValue className="hp-proof-num" value={point?.num} />
                      <span className="hp-proof-label">{point?.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* The public page closes this region when a direction has no
              figures. In edit mode it stays open, because an absence the
              owner cannot see is an absence they cannot fill. */}
          {!hasProof && (
            <EditEmpty
              title="Add proof points"
              note="Two or three numbers that stand behind this direction. They lead the cover."
            />
          )}
        </div>
      </div>
    </section>
  )
}
