'use client'

import { EditPencil, SlotGuide, SlotGhost, GhostText, useEditSlot } from './EditAffordance'
import { ProseEditor } from './EditFields'
import ProofPointsManage from './ProofPointsManage'
import { useFieldEditor, useCanShowEmpty } from '../_lib/editContext'

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

// `endRef` marks where the cover's content stops, which is not where its box
// stops: the frame carries a min-height floor and the stage packs its rows to
// the top, so a few hundred pixels of the cover below the last row are field
// rather than content. The Career Directions bar takes hold at this line, so
// it is handed down from the document and parked on the stage's last grid
// row rather than after the section.
export default function IdentityAct({
  displayName,
  headline,
  proofPoints,
  directionKey,
  chrome,
  directions,
  glowKey,
  animate,
  endRef
}) {
  const hasProof = proofPoints.length > 0
  const [lead, ...supporting] = proofPoints
  const slot = useEditSlot()
  const canShowEmpty = useCanShowEmpty()
  const headlineEditor = useFieldEditor('headline')
  const proofEditor = useFieldEditor('proof_points')

  // The proof points have one control now, and the pencil is it. It opens
  // ProofPointsManage: picking, reordering, replacing and editing the three
  // figures across every Career Direction, with suggestions drawn from this
  // person's own career data.
  //
  // Opened through openField the way In My Own Words is, which is the house
  // pattern for a field whose editor is a dialog rather than an inline form.
  // Two things follow from that and both are deliberate. The pencil carries
  // `persists`, so it stays where it is instead of hiding under its own
  // dialog. And the composition below is no longer swapped out while the
  // editor is open: a dialog replaces nothing, so the cover stays exactly as
  // it is behind it, which is also what makes it a preview of itself.

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

        {/* The stage has two layouts: with figures, where the identity keeps
            the left half and the proof takes the right, and without, where the
            identity widens across the whole frame. Edit mode shows the proof
            band whenever it can show an empty section, so it has to ask for
            the proof layout too - otherwise the widened name runs straight
            over the figures beside it. `canShowEmpty` is false publicly, so
            the public page chooses exactly what it chose before. */}
        <div
          className="hp-act1-stage"
          data-proof={hasProof || canShowEmpty ? 'true' : 'false'}
        >
          {/* The selector comes first, in the DOM and on the page, because
              everything below it is what it changes. Choosing a direction and
              then meeting the identity written for it is the right order; the
              reverse asks the reader to re-read what they have just taken in. */}
          {/* data-tour marks two stops on the Career Profile's first-visit
              tour. They are inert attributes: the tour component is imported
              only by the management page, so nothing on the public page reads
              them and nothing about it changes. */}
          <div className="hp-act1-invite" data-tour="profile-directions">{directions}</div>

          <div className={`hp-act1-identity${slot}`} data-tour="profile-identity">
            <EditPencil field="headline" label="the headline for this Career Direction" />
            <span className="hp-act1-eyebrow">Career Profile</span>

            {/* The stop is part of the setting, not part of the name. */}
            <h1 className="hp-name">{displayName}.</h1>

            {/* The deck. It belongs to the chosen direction, so it refocuses
                with the rest and leads the ordered groups. */}
            {headlineEditor?.isOpen ? (
              <ProseEditor field="headline" label="Headline" value={headline} size="deck" rows={2} />
            ) : headline ? (
              <p className="hp-act1-deck hp-refocus" data-resolve="positioning">
                {headline}
              </p>
            ) : null}
          </div>

          {hasProof && (
            /* The featured figure and the two beneath it are one block. The
               band is what makes them one: below 1200 it is `display:
               contents` and both tiers are handed to the stage grid exactly as
               they were, and at desktop it becomes the grid item they share,
               so the space between the tiers is a row gap measured from the
               bottom of the featured block rather than whatever the row had
               left over. A description that runs to two lines therefore pushes
               the tier below it down instead of closing the gap. */
            <div className="hp-proof-band">
              {/* Keyed on the direction so the entrance replays when the
                  reader changes chapter: the node is a new node, so the CSS
                  animation on it starts again. Restarting it by toggling a
                  class would need the browser to be forced to reflow between
                  the two states, which is a trick; this is just how keys work.

                  The figures mount only after the swap, so what fades in is
                  always the direction being arrived at - the one being left
                  has already gone out with the rest of the refocus. */}
              <div
                className={`hp-proof-lead hp-refocus hp-proof-enter${slot}`}
                data-resolve="positioning"
                data-enter="0"
                key={`lead-${directionKey}`}
              >
                <EditPencil field="proof_points" label="the proof points" persists />
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
            </div>
          )}

          {/* The public proof composition, empty: the lead figure with its
              rotated caption and the two supporting figures beside it, in the
              same wrapper and the same classes, so the hero keeps the shape it
              has when the numbers are there. No invented figures - a ghost
              showing a percentage would be putting a claim on the cover. */}
          {/* `canShowEmpty` is the guard that keeps every one of these out of
              the public page and out of Preview. The branch it replaced was
              `{!hasProof && ...}` around an <EditEmpty>, which was safe only
              because EditEmpty returned null on its own when there was no edit
              context. Ghost markup has no such instinct, so the condition has
              to carry it: without this, a profile with no proof points would
              have shipped ghost figures to visitors. */}
          {!hasProof && canShowEmpty && (
            <div className="hp-proof-band hp-ed-ghost-proof">
              {/* The invitation takes the lead figure's own position, so the
                  hero keeps its real shape and the explanation sits where the
                  number will be. The two supporting positions stay numbered. */}
              <div className="hp-proof-lead">
                <span className="hp-proof-caption">Selected proof</span>
                <div className="hp-ed-guide-prose">
                  <SlotGuide
                    heading="Lead with the numbers."
                    action="Add proof points"
                    feature="identity"
                    onAction={() => proofEditor?.open()}
                  >
                    Three results that stand behind this Career Direction. They
                    lead the cover.
                  </SlotGuide>
                </div>
              </div>

              <div className="hp-proof-subs" aria-hidden="true">
                {['02', '03'].map((n, i) => (
                  <div className="hp-proof-sub" data-sub={i} key={n}>
                    <span className="hp-proof-num"><SlotGhost index={n} /></span>
                    <span className="hp-proof-label"><GhostText lines={2} /></span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* It portals onto the body, so where it sits in this tree decides
              nothing but whether it exists. The pencil opens it and closing it
              clears the field, so there is one open state rather than two that
              could disagree. It reads every direction's figures off the edit
              context, so nothing about them is passed down here. */}
          {proofEditor ? (
            <ProofPointsManage open={proofEditor.isOpen} onClose={proofEditor.close} />
          ) : null}

          {/* The foot of the composition, wherever the composition happens to
              end. Full width so auto-placement cannot tuck it into a gap
              beside the identity or the figures - spanning every column, the
              first row it can take is the one after the last occupied one,
              at both of the stage's arrangements. */}
          <span ref={endRef} className="hp-bar-sentinel" aria-hidden="true" />
        </div>
      </div>
    </section>
  )
}
