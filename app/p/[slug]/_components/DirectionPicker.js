'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

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
// Unticking the last box leaves nothing ticked, and that is a state the owner
// can choose: an item on no direction is in their library and on none of
// their profiles, which the manage panels already list and already say. This
// used to bounce back to 'all', so the last untick turned every box on - the
// opposite of the press, and a disagreement with the toggles in the panels,
// which write exactly what they show.
//
// WHICH DIRECTIONS ARE LISTED
// Active and hidden. A hidden direction is one the owner has turned off and
// can turn back on, so placing something there now is reasonable. A dismissed
// one is in the bin, and offering it would be offering to file something
// somewhere nobody is going to look.
// ============================================================================

// Exported because the manage panels write the same membership through the
// same route, so they have to agree with this about which directions that
// membership is allowed to name. A toggle that rewrote the set from a
// different list would silently drop the item from everything this leaves out.
export const PICKABLE = new Set(['active', 'hidden'])

// How many get named before the rest become a count. Two is what fits beside
// Change on the narrowest surface this renders on, and the row must stay one
// line: a summary that wraps takes Change below the text, where it reads as a
// control belonging to whatever comes next.
const MAX_NAMED = 2

export default function DirectionPicker({
  lenses,
  scope,
  lensIds,
  onChange,
  disabled = false,
  idPrefix = 'hp-dirpick'
}) {
  const [open, setOpen] = useState(false)

  // The one control stands in two places - after the sentence while it is
  // closed, at the end of the chips while it is open - so it is two elements,
  // and focus has to follow it between them or a keyboard press lands back at
  // the top of the document. Skipped on the first render, which is a mount
  // rather than a press.
  const changeRef = useRef(null)
  const doneRef = useRef(null)
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return }
    if (open) doneRef.current?.focus()
    else changeRef.current?.focus()
  }, [open])

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
  // Past the first two the names stop earning their room, so the rest become
  // the count they were going to be anyway and the line stays one line.
  const summary = useMemo(() => {
    if (scope !== 'selected') return 'Showing on all Career Directions'
    const names = options.filter(lens => picked.has(lens.id)).map(lens => lens.name)
    if (names.length === 0) return 'Not shown on any Career Direction'
    // Every one of them ticked is the answer 'all' gives, and it is the
    // sentence somebody wants to read rather than the list they would have to
    // check off against the directions they know they have.
    if (names.length === options.length) return 'Showing on all Career Directions'
    if (names.length <= MAX_NAMED) return `Showing on ${names.join(', ')}`
    return `Showing on ${names.slice(0, MAX_NAMED).join(', ')} +${names.length - MAX_NAMED} more`
  }, [scope, options, picked])

  // Nothing to choose between. A profile with one direction has no question to
  // ask here, and a picker offering a single box is a decision that is not one.
  if (options.length < 2) return null

  function toggle(lensId, on) {
    const next = new Set(picked)
    if (on) next.add(lensId)
    else next.delete(lensId)

    // Exactly what the boxes now say, including none of them.
    onChange?.('selected', [...next])
  }

  return (
    <div className="hp-ed-dirpick">
      <div className="hp-ed-dirpick-top">
        <span className="hp-ed-dirpick-summary" data-empty={scope === 'selected' && picked.size === 0 ? 'true' : undefined}>
          {summary}
        </span>
        {/* Only while the panel is shut. Open, the way out of it is the last
            thing in the row of chips below, where it flows and wraps with
            them instead of sitting above the choices it closes. */}
        {open ? null : (
          <button
            type="button"
            className="hp-ed-dirpick-toggle"
            ref={changeRef}
            onClick={() => setOpen(true)}
            disabled={disabled}
            aria-expanded="false"
          >
            Change
          </button>
        )}
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
                        // Narrowing from everything: keep the others, even
                        // where there are none left to keep.
                        const rest = options.map(one => one.id).filter(one => one !== lens.id)
                        onChange?.('selected', rest)
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

          {/* In the chips' own row rather than above it: the chips wrap, and
              a control that closes them belongs at the end of what it closes
              rather than at the top where the eye has already been. */}
          <li className="hp-ed-dirpick-done">
            <button
              type="button"
              className="hp-ed-dirpick-toggle"
              ref={doneRef}
              onClick={() => setOpen(false)}
              disabled={disabled}
              aria-expanded="true"
            >
              Done
            </button>
          </li>
        </ul>
      ) : null}
    </div>
  )
}
