'use client'

// ============================================================================
// HISTORY PILLS
//
// Everything produced in this visit, as a row of numbers. Answers on one card,
// hiring briefs on the other, drawn from one definition so the two rows are
// the same row in two places rather than two things that resemble each other.
//
// A recruiter asking five questions is building a picture, and the fourth
// answer does not replace the third. Numbers rather than titles because the
// questions are full sentences: five of those stacked would be a transcript,
// and the whole point of the overlay is that the workspace is not one.
//
// What the number stands for is not lost, only folded up. It is the pill's
// accessible name, so a screen reader announces it in full, and it is shown on
// hover and on keyboard focus for everybody else. The tooltip is marked hidden
// from assistive technology on purpose: the same words are already in the name,
// and announcing them twice is worse than not announcing them at all.
//
// `reserve` keeps the row's height when there is nothing in it yet. The two
// cards are one grid row and their calls to action sit at the foot of their
// faces, so a row of numbers on one card and nothing on the other would drop
// one call to action below the other. An empty row on the quiet card is what
// keeps the pair level until it has numbers of its own.
// ============================================================================

export default function AnswerPills({
  items, index, onSelect, variant = 'tool', label = 'Answers', noun = 'Answer', reserve = false
}) {
  const list = items || []
  if (!list.length && !reserve) return null

  return (
    <div className="hp-rt-pills" data-variant={variant} data-empty={list.length ? 'false' : 'true'}>
      {list.length ? <span className="hp-rt-pills-label" aria-hidden="true">{label}</span> : null}

      <ul className="hp-rt-pills-list" role="list">
        {list.map((entry, i) => {
          const active = i === index
          return (
            <li className="hp-rt-pill-item" key={i}>
              <button
                type="button"
                className="hp-rt-pill"
                data-active={active ? 'true' : 'false'}
                aria-label={`${noun} ${i + 1}: ${entry.label}`}
                aria-current={active ? 'true' : undefined}
                onClick={() => onSelect(i)}
              >
                <span aria-hidden="true">{i + 1}</span>
                {/* Hidden from assistive technology because the button's own
                    name already carries this in full. */}
                <span className="hp-rt-pill-tip" role="tooltip" aria-hidden="true">
                  {entry.label}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
