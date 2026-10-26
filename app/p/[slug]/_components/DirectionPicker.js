'use client'

import { useMemo, useState } from 'react'

// ============================================================================
// WHICH DIRECTIONS THIS APPEARS ON
//
// One control, three places: adding a piece of evidence, editing one later,
// and reviewing a testimonial. They are the same question and they should not
// be three slightly different answers to it.
//
// COLLAPSED BY DEFAULT, because the default answer is almost always right.
// Most things belong on the whole profile, and asking somebody to tick every
// direction to say "all of them" gets the opposite answer by accident: an
// empty list reads as caution and means invisibility.
//
// So the summary states the answer in words and offers to change it. Opening
// it is a decision; leaving it alone is also a decision, and the one most
// people want.
//
// THE TWO SHAPES IT CAN SEND BACK
//   ('all', [])            on every direction, including ones made later
//   ('selected', [ids])    on exactly these
//
// Unticking the last box returns to 'all' rather than leaving nothing ticked,
// because "none" is not a thing anybody picks on purpose here. It is a thing
// that HAPPENS, when the only direction an item was on gets deleted, and that
// state is shown plainly rather than offered.
//
// WHICH DIRECTIONS ARE LISTED
// Active and hidden. A hidden direction is one the owner has turned off and
// can turn back on, so placing something there now is reasonable. A dismissed
// one is in the bin, and offering it would be offering to file something
// somewhere nobody is going to look.
// ============================================================================

const PICKABLE = new Set(['active', 'hidden'])

export default function DirectionPicker({
  lenses,
  scope,
  lensIds,
  onChange,
  disabled = false,
  idPrefix = 'hp-dirpick'
}) {
  const [open, setOpen] = useState(false)

  const options = useMemo(
    () => (Array.isArray(lenses) ? lenses : []).filter(lens => PICKABLE.has(lens?.status)),
    [lenses]
  )

  const picked = useMemo(
    () => new Set(Array.isArray(lensIds) ? lensIds : []),
    [lensIds]
  )

  // Named rather than counted. "2 directions" makes somebody open the panel to
  // find out which two, which is the work the summary was supposed to save.
  const summary = useMemo(() => {
    if (scope !== 'selected') return 'Showing on all directions'
    const names = options.filter(lens => picked.has(lens.id)).map(lens => lens.name)
    if (names.length === 0) return 'Not shown on any direction'
    if (names.length === 1) return `Showing on ${names[0]}`
    return `Showing on ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  }, [scope, options, picked])

  // Nothing to choose between. A profile with one direction has no question to
  // ask here, and a picker offering a single box is a decision that is not one.
  if (options.length < 2) return null

  function toggle(lensId, on) {
    const next = new Set(picked)
    if (on) next.add(lensId)
    else next.delete(lensId)

    // Back to all directions, rather than to nothing. See the note above.
    if (next.size === 0) onChange?.('all', [])
    else onChange?.('selected', [...next])
  }

  return (
    <div className="hp-ed-dirpick">
      <div className="hp-ed-dirpick-top">
        <span className="hp-ed-dirpick-summary" data-empty={scope === 'selected' && picked.size === 0 ? 'true' : undefined}>
          {summary}
        </span>
        <button
          type="button"
          className="hp-ed-dirpick-toggle"
          onClick={() => setOpen(value => !value)}
          disabled={disabled}
          aria-expanded={open}
        >
          {open ? 'Done' : 'Change'}
        </button>
      </div>

      {open ? (
        <ul className="hp-ed-lens-picks hp-ed-dirpick-list">
          {options.map(lens => {
            const id = `${idPrefix}-${lens.id}`
            // 'all' ticks every box, because that is what it means. Ticking is
            // also how somebody narrows it: unticking one of them from 'all'
            // leaves the rest selected, which is the move they were making.
            const on = scope === 'all' ? true : picked.has(lens.id)
            return (
              <li key={lens.id}>
                <label className="hp-ed-lens-pick" htmlFor={id}>
                  <input
                    id={id}
                    type="checkbox"
                    checked={on}
                    disabled={disabled}
                    onChange={event => {
                      if (scope === 'all' && !event.target.checked) {
                        // Narrowing from everything: keep the others.
                        const rest = options.map(one => one.id).filter(one => one !== lens.id)
                        if (rest.length === 0) onChange?.('all', [])
                        else onChange?.('selected', rest)
                        return
                      }
                      toggle(lens.id, event.target.checked)
                    }}
                  />
                  <span>{lens.name}</span>
                </label>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
