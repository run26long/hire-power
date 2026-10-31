'use client'

import { useEffect, useRef, useState } from 'react'
import ProfileMark from './ProfileMark'
import Reveal from './Reveal'
import { EditPencil, useEditSlot } from './EditAffordance'
import { TagsEditor } from './EditFields'

// ============================================================================
// The resolution, and the page's footer.
//
// One closing composition under a single hairline: where this person is, what
// they are open to, the two actions, and the quiet mark under all of it - the
// three groups running along a single line, each label kept against the thing
// it names. There is no narrative line here and no call-to-action block;
// `ready_for_next` is deliberately not rendered anywhere on the Profile.
//
// The actions are the masthead's own pair, handed down rather than rebuilt, so
// the treatment, the copy and the busy state are the header's by definition
// and the two placements can never drift.
//
// Nothing here is editable, by anybody. The address behind the Contact button
// is set on the Career Profile management page: a published profile is a thing
// to be read, and a control for changing it does not belong on it even when
// the person reading it happens to own it.
//
// Location appears only when the resume actually carries one, and there is no
// remote-preference field in the data, so there is no remote line.
//
// This renders outside <main>, so it is the one part of the page that does not
// dissolve and re-enter when the reader changes direction.
// ============================================================================

// ---------------------------------------------------------------------------
// REACHING THE REST OF THE ROW
//
// The Open to pills are one line that scrolls. That is what keeps the row a
// row at every width, and it is also what put the pills past the edge out of
// reach of anything but a swipe - which a desktop with a mouse does not have.
//
// WHAT THIS BORROWS, AND WHAT IT DOES NOT
// The controls are the Career Directions rail's own: the same .hp-rail
// positioning context, the same .hp-rail-step target, the same
// .hp-rail-chevron glyph, and the same reading of the edges - scrollWidth
// against clientWidth with two pixels of slack, because sub-pixel widths mean
// scrollLeft rarely lands exactly on 0 or on the maximum. See
// useDirectionRail in ./LensNav, which this is the shape of.
//
// The ref is the caller's and is handed in rather than created here and
// returned, which is the shape useDirectionRail has for the same reason: a
// ref travelling out inside the returned object taints every value beside
// it, and the compiler then reads the whole object as touched during render.
//
// What it does not borrow is the action. There the control selects the
// neighbouring direction and lets the rail scroll itself to it; there is
// nothing to select in a row of pills, so these scroll by most of a view and
// let the scroll event re-measure the edges. One page less a little overlap,
// so the pill that was at the edge is still on screen after the press and the
// row reads as continuous rather than as a set of slides.
//
// Every tier, and Edit, Preview and the public page alike: nothing here is a
// control over the content, it is a way of reading it.
// ---------------------------------------------------------------------------
function useScrollRail(trackRef) {
  const [edges, setEdges] = useState({ start: false, end: false, overflows: false })

  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    const measure = () => {
      const max = track.scrollWidth - track.clientWidth
      const slack = 2
      setEdges(
        max <= slack
          ? { start: false, end: false, overflows: false }
          : {
              start: track.scrollLeft > slack,
              end: track.scrollLeft < max - slack,
              overflows: true
            }
      )
    }

    measure()
    track.addEventListener('scroll', measure, { passive: true })

    // The row's width and the pills' widths both move it, so both are watched.
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    if (observer) {
      observer.observe(track)
      for (const pill of track.children) observer.observe(pill)
    } else if (typeof window !== 'undefined') {
      window.addEventListener('resize', measure)
    }

    return () => {
      track.removeEventListener('scroll', measure)
      if (observer) observer.disconnect()
      else if (typeof window !== 'undefined') window.removeEventListener('resize', measure)
    }
  }, [trackRef])

  const step = (by) => {
    const track = trackRef.current
    if (!track) return
    track.scrollBy({ left: by * Math.max(96, track.clientWidth - 48), behavior: 'smooth' })
  }

  return { edges, step }
}

// The two controls, in the rail's own markup. Each one appears only when there
// is something past its edge, which is the rail's rule as well.
function RailScroll({ edges, onStep }) {
  if (!edges.overflows) return null
  return (
    <>
      {edges.start && (
        <button
          type="button"
          className="hp-rail-step"
          data-step="prev"
          aria-label="Scroll back"
          onClick={() => onStep(-1)}
        >
          <span className="hp-rail-chevron" aria-hidden="true" />
        </button>
      )}
      {edges.end && (
        <button
          type="button"
          className="hp-rail-step"
          data-step="next"
          aria-label="Scroll forward"
          onClick={() => onStep(1)}
        >
          <span className="hp-rail-chevron" aria-hidden="true" />
        </button>
      )}
    </>
  )
}


export default function ProfileResolution({ readyTags, location, actions, animate }) {
  const slot = useEditSlot()
  const tagsRef = useRef(null)
  const rail = useScrollRail(tagsRef)
  const hasTags = readyTags.length > 0
  const hasLocation = Boolean(location)

  return (
    <footer className="hp-foot">
      <div className="hp-wrap-tight">
        <Reveal enabled={animate}>
          <div className="hp-foot-inner">
            {/* Rendered unconditionally and null until it is open. As a dialog
                it puts nothing in the footer, so the closing line of the page
                does not rearrange itself the moment somebody presses a
                pencil. */}
            <TagsEditor value={readyTags} />

            {hasTags && (
              <p className={`hp-foot-open${slot}`}>
                {/* The pencil sits in the line itself, beside the label it
                    edits, rather than floating in a band above it. On a row
                    that reads like a statement about the person a hover-only
                    affordance goes unfound, so in Edit this one is standing
                    rather than waiting to be hovered. It opens the same dialog
                    it always did. */}
                <EditPencil field="ready_tags" label="the Open To tags" persists />
                <strong className="hp-foot-open-label">Open to</strong>
                {/* The scrolling box, inside the rail that holds its two
                    controls. It was `display: contents` above the phone
                    breakpoint once; it is the box at every width now, which
                    is what keeps the row one line. */}
                <span className="hp-rail" data-steps={rail.edges.overflows ? 'true' : 'false'}>
                  <span className="hp-open-tags" ref={tagsRef}>
                    {readyTags.map((tag, index) => (
                      <span className="hp-open-tag" key={`${tag}-${index}`}>{tag}</span>
                    ))}
                  </span>
                  <RailScroll edges={rail.edges} onStep={rail.step} />
                </span>
              </p>
            )}

            {hasLocation && (
              <p className="hp-foot-where">
                <span className="hp-status-dot" aria-hidden="true" />
                {location}
              </p>
            )}

            <span className="hp-foot-actions">{actions}</span>
          </div>
        </Reveal>

        {/* The words stay words and the name becomes the mark. One line, the
            same height it was: the logo is set to the cap height of the type
            beside it rather than to its own idea of a size. */}
        <p className="hp-foot-mark">
          <span className="hp-foot-mark-by">Powered by</span>
          { }
          <ProfileMark className="hp-foot-mark-logo" />
        </p>
      </div>
    </footer>
  )
}
