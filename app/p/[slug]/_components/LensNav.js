'use client'

import { useEffect, useRef, useState } from 'react'

// ============================================================================
// Career directions.
//
// Two expressions of one control. `LensStage` is the invitation at the foot of
// Act I: the last sentence of the opening composition and the way into the
// Profile, rendered inside the act rather than as a section beneath it.
// `LensBar` is the persistent control that takes over once the act has
// scrolled away. Its mechanics are untouched.
//
// Both reserve the width of their heaviest state with a hidden pseudo element,
// so switching weight cannot push the neighbouring names sideways, and both
// carry the mark on transform and opacity rather than on width. No font size
// changes between states anywhere.
//
// The word "lens" does not appear in anything a visitor can read or hear,
// including the accessible names.
//
// Selection is not owned here. `activeIndex` and `onSelect` come from the
// page, which is what keeps the refocus intact.
// ============================================================================

const PROMPT = 'Explore my experience from a different perspective.'

// A step control is 34px, and one has to sit clear of the longest name at each
// end rather than on top of it. Below this much slack the rail does without
// them: a control covering the name it is meant to help with is worse than no
// control, and the rail still swipes and still fades.
const STEP_CLEARANCE = 76

// ----------------------------------------------------------------------------
// The rail.
//
// Both expressions of the control are one flex row that can outrun its width
// on a phone, so both get the same behaviour from here rather than each
// growing its own. Nothing in it assumes a number of directions: everything is
// derived from what the browser actually measured, so one direction is static,
// three scroll, and five scroll the same way.
//
// Three jobs. It keeps the chosen direction in view, it keeps a focused
// direction in view so tabbing can never land on something off screen, and it
// reports which edges still have content past them so the fade can be drawn on
// those edges only.
//
// It never selects anything. Scrolling the rail, by finger or by wheel, is
// looking rather than choosing, so the selection contract is untouched: the
// buttons still own it through onSelect.
// ----------------------------------------------------------------------------
// Measured from rectangles rather than offsetLeft. The track is not a
// positioned ancestor, so offsetLeft is counted from somewhere further up the
// tree and carries an offset that has nothing to do with the scroll position.
function railMetrics(track, item) {
  const trackRect = track.getBoundingClientRect()
  const itemRect = item.getBoundingClientRect()
  return {
    // Where the item starts in the track's own scroll coordinates.
    start: track.scrollLeft + (itemRect.left - trackRect.left),
    width: itemRect.width,
    max: track.scrollWidth - track.clientWidth
  }
}

// Where the rail has to sit for one direction to be readable. Normally that is
// centred. A name wider than the rail itself cannot be centred without hiding
// both of its ends, so it is aligned to its start instead: the name reads from
// its first word and the rest is a swipe away, which is the only honest answer
// when a single label is wider than the screen.
function railTarget(track, item) {
  const { start, width, max } = railMetrics(track, item)
  const overWide = width >= track.clientWidth
  const raw = overWide ? start - 8 : start - (track.clientWidth - width) / 2
  return Math.max(0, Math.min(raw, max))
}

function useDirectionRail({ trackRef, itemRefs, activeIndex, reducedMotion, enabled = true }) {
  const [edges, setEdges] = useState({ start: false, end: false, overflows: false, room: false })
  // The index the rail was last positioned for. Null until it has positioned
  // once. Deliberately not a "have we run yet" flag: a ref survives the double
  // mount React does in development, so a flag would report the first arrival
  // as a later one and animate it.
  const positionedFor = useRef(null)

  // Which edges have more rail past them. Read from the scroll position, so it
  // is right for any number of directions and at any width, and it resolves to
  // no fade at all the moment the row fits.
  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    const measure = () => {
      const max = track.scrollWidth - track.clientWidth
      // Sub-pixel widths mean scrollLeft rarely lands exactly on 0 or on max.
      const slack = 2
      const widest = itemRefs.current.reduce(
        (w, item) => (item ? Math.max(w, item.getBoundingClientRect().width) : w),
        0
      )
      const room = track.clientWidth - widest >= STEP_CLEARANCE

      setEdges(
        max <= slack
          ? { start: false, end: false, overflows: false, room }
          : {
              start: track.scrollLeft > slack,
              end: track.scrollLeft < max - slack,
              overflows: true,
              room
            }
      )
    }

    measure()
    track.addEventListener('scroll', measure, { passive: true })

    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    if (observer) {
      observer.observe(track)
      for (const item of itemRefs.current) if (item) observer.observe(item)
    } else if (typeof window !== 'undefined') {
      window.addEventListener('resize', measure)
    }

    return () => {
      track.removeEventListener('scroll', measure)
      if (observer) observer.disconnect()
      else if (typeof window !== 'undefined') window.removeEventListener('resize', measure)
    }
  }, [trackRef, itemRefs, activeIndex])

  // Centre the chosen direction when there is room to centre it, and settle for
  // the nearest edge when there is not, which is what makes the first and last
  // reachable in full. The first run lands without animation: arriving on a
  // page mid-slide is not an entrance.
  useEffect(() => {
    if (!enabled) return
    const track = trackRef.current
    const item = itemRefs.current[activeIndex]
    if (!track || !item) return
    if (track.scrollWidth <= track.clientWidth) return

    // Only a real change of direction is worth animating. Arriving, and any
    // re-run that lands on the direction already shown, is immediate.
    const immediate =
      reducedMotion ||
      positionedFor.current === null ||
      positionedFor.current === activeIndex
    positionedFor.current = activeIndex

    track.scrollTo({ left: railTarget(track, item), behavior: immediate ? 'auto' : 'smooth' })
  }, [activeIndex, enabled, reducedMotion, trackRef, itemRefs])

  // A direction reached by keyboard has to be brought in fully, ring and all,
  // or tabbing walks focus off the side of the rail.
  const onFocusCapture = (event) => {
    const track = trackRef.current
    const item = event.target.closest('button')
    if (!track || !item || !track.contains(item)) return
    if (track.scrollWidth <= track.clientWidth) return

    const { start, width } = railMetrics(track, item)
    const viewLeft = track.scrollLeft
    const viewRight = viewLeft + track.clientWidth
    // The ring is drawn outside the button, so the margin it needs is part of
    // what counts as "in view".
    const ring = 10
    if (start - ring >= viewLeft && start + width + ring <= viewRight) return

    track.scrollTo({ left: railTarget(track, item), behavior: reducedMotion ? 'auto' : 'smooth' })
  }

  // Arrow keys move focus along the rail. They deliberately do not select:
  // Enter and Space still do that, which is the contract the buttons already
  // had before this rail existed.
  const onKeyDown = (event) => {
    const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End']
    if (!keys.includes(event.key)) return
    const items = itemRefs.current.filter(Boolean)
    if (items.length < 2) return
    const current = items.indexOf(event.target.closest('button'))
    if (current === -1) return

    let next = current
    if (event.key === 'ArrowRight') next = Math.min(items.length - 1, current + 1)
    if (event.key === 'ArrowLeft') next = Math.max(0, current - 1)
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = items.length - 1
    if (next === current) return

    event.preventDefault()
    items[next].focus()
  }

  return {
    overflows: edges.overflows && edges.room,
    track: {
      'data-fade-start': edges.start ? 'true' : 'false',
      'data-fade-end': edges.end ? 'true' : 'false',
      onFocusCapture,
      onKeyDown
    }
  }
}

// ----------------------------------------------------------------------------
// The step controls.
//
// The rail is swipeable and always was, but on a phone only two of three names
// fit and nothing said the third existed. These say it.
//
// Which ones appear is read from the rail overflowing and from where the active
// direction sits in the list, so a list of two behaves like a list of five and
// a row that fits shows none at all. They select the neighbouring direction
// through the same onSelect every name uses, so the rail positions it with the
// behaviour it already had, and scrolling still selects nothing.
// ----------------------------------------------------------------------------
function RailSteps({ count, activeIndex, overflows, onSelect }) {
  if (!overflows || count < 2) return null

  return (
    <>
      {activeIndex > 0 && (
        <button
          type="button"
          className="hp-rail-step"
          data-step="prev"
          aria-label="Previous career direction"
          onClick={() => onSelect(activeIndex - 1)}
        >
          <span className="hp-rail-chevron" aria-hidden="true" />
        </button>
      )}

      {activeIndex < count - 1 && (
        <button
          type="button"
          className="hp-rail-step"
          data-step="next"
          aria-label="Next career direction"
          onClick={() => onSelect(activeIndex + 1)}
        >
          <span className="hp-rail-chevron" aria-hidden="true" />
        </button>
      )}
    </>
  )
}

export function LensStage({ lenses, activeIndex, onSelect, reducedMotion }) {
  const trackRef = useRef(null)
  const itemRefs = useRef([])

  // Called before either early return, because a hook cannot be conditional.
  // With no rail rendered the refs stay null and every branch inside is a no
  // op, which is also what gives the one direction case a static row with no
  // scrolling affordance and no fade.
  const rail = useDirectionRail({ trackRef, itemRefs, activeIndex, reducedMotion })

  if (lenses.length === 0) return null

  // One direction is a statement about this person, not a choice to make.
  if (lenses.length === 1) {
    return (
      <div className="hp-invite">
        <span className="hp-direction-single">
          <span className="hp-direction-label" data-label={lenses[0].name}>{lenses[0].name}</span>
          <span className="hp-direction-mark" aria-hidden="true" />
        </span>
      </div>
    )
  }

  return (
    <div className="hp-invite">
      <p className="hp-invite-prompt">{PROMPT}</p>

      <div className="hp-rail" data-steps={rail.overflows ? 'true' : 'false'}>
        <div className="hp-directions" role="group" aria-label="Career directions" ref={trackRef} {...rail.track}>
        {lenses.map((lens, index) => {
          const active = index === activeIndex
          return (
            <button
              key={lens.id}
              type="button"
              ref={(el) => { itemRefs.current[index] = el }}
              className="hp-direction"
              data-active={active ? 'true' : 'false'}
              aria-current={active ? 'true' : undefined}
              onClick={() => onSelect(index)}
            >
              <span className="hp-direction-label" data-label={lens.name}>{lens.name}</span>
              <span className="hp-direction-mark" aria-hidden="true" />
            </button>
          )
        })}
        </div>

        <RailSteps
          count={lenses.length}
          activeIndex={activeIndex}
          overflows={rail.overflows}
          onSelect={onSelect}
        />
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------------
// The persistent control.
//
// Sticky in normal flow rather than fixed, so it holds its own 68px whether or
// not it is stuck: there is no jump when it takes hold and nothing can scroll
// underneath it. It stays empty until it is actually stuck, so it does not
// restate the invitation sitting directly above it.
// ----------------------------------------------------------------------------
export function LensBar({ lenses, activeIndex, onSelect, reducedMotion, actions }) {
  const sentinelRef = useRef(null)
  const trackRef = useRef(null)
  const itemRefs = useRef([])
  const [stuck, setStuck] = useState(false)

  useEffect(() => {
    const node = sentinelRef.current
    if (!node || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0 }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  // The same rail the opening selector uses. Scrolling into view waits until
  // the bar is actually stuck, because until then it is hidden and there is
  // nothing to bring into view; the edge fades are measured either way, so the
  // bar is already correct the moment it takes hold.
  const rail = useDirectionRail({ trackRef, itemRefs, activeIndex, reducedMotion, enabled: stuck })

  if (lenses.length === 0) return null

  return (
    <>
      <div ref={sentinelRef} className="hp-bar-sentinel" aria-hidden="true" />
      <div className="hp-bar" data-stuck={stuck ? 'true' : 'false'}>
        <div className="hp-frame hp-bar-inner">
          {lenses.length === 1 ? (
            <span className="hp-bar-single">{lenses[0].name}</span>
          ) : (
            <div className="hp-rail" data-steps={rail.overflows ? 'true' : 'false'}>
              <div className="hp-bar-track" ref={trackRef} role="group" aria-label="Career directions" {...rail.track}>
              {lenses.map((lens, index) => {
                const active = index === activeIndex
                return (
                  <button
                    key={lens.id}
                    type="button"
                    ref={(el) => { itemRefs.current[index] = el }}
                    className="hp-bar-item"
                    data-active={active ? 'true' : 'false'}
                    aria-current={active ? 'true' : undefined}
                    onClick={() => onSelect(index)}
                  >
                    <span className="hp-bar-label" data-label={lens.name}>{lens.name}</span>
                    <span className="hp-bar-mark" aria-hidden="true" />
                  </button>
                )
              })}
              </div>

              <RailSteps
                count={lenses.length}
                activeIndex={activeIndex}
                overflows={rail.overflows}
                onSelect={onSelect}
              />
            </div>
          )}

          {/* The same two controls the masthead carries, from the same
              component, so their copy, titles and disabled state cannot
              drift. They live inside .hp-bar-inner, which is hidden until the
              bar is actually stuck, so they never appear while the opening
              selector is still on screen. */}
          {actions && <div className="hp-bar-actions">{actions}</div>}
        </div>
      </div>
    </>
  )
}
