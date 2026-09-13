'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Reveal from './Reveal'
import { skillSlides } from '../_lib/profileData'

// ============================================================================
// SKILLS IN THIS DIRECTION - the capabilities behind the results.
//
// Experience showed the work and Collective Impact showed what the people
// around it felt. This is the toolkit underneath both, and it is the one place
// on the page that moves sideways: the testimonials turn on a vertical wheel,
// so the deck travels horizontally and is dragged by a horizontal slider. The
// two controls never read as the same control.
//
// Nothing here is invented and nothing is named. The section renders whatever
// ordered categories it is handed, in the order it is handed them, and knows
// nothing about what any of them contain.
//
// The rows are not left to flex-wrap. A wrapped field gives whatever number of
// lines the labels happen to produce, and the desktop frame wants four, so the
// section measures a rendered tile and hands the real widths to the packer. A
// category splits only when its skills genuinely do not fit the card in front
// of the reader, at the width they are actually being set at.
//
// Native scroll is the source of truth. The arrows and the slider scroll the
// track, and the position reads the track back, so a swipe, a trackpad, a drag
// and a button press all arrive at the same state and none of them can
// disagree with what is on screen.
// ============================================================================

const pad = (n) => String(n).padStart(2, '0')

// What a slide actually holds, for a reader who cannot see it. Built from the
// blocks that landed here, so a category carried over from the slide before is
// announced as a continuation rather than as something new.
function slideLabel(slide) {
  const names = slide.blocks
    .filter(block => block.name)
    .map(block => (block.continued ? `${block.name}, continued` : block.name))
  return names.length > 0 ? names.join('; ') : undefined
}

// A field of identical tiles reads as output from a loop. Sizing each label to
// its own length gives the composition its variation without touching what the
// labels say or the order they arrive in. Size only: colour, weight and border
// are the same on every tile, because a brighter tile would read as a skill
// that does something, and none of them do yet.
function tileScale(label) {
  const length = String(label || '').length
  if (length <= 14) return 'lg'
  if (length <= 30) return 'md'
  return 'sm'
}

export default function SkillsSection({
  clusters,
  animate = true,
  reducedMotion = false,
  directionKey
}) {
  // Derived, not stored, for the same reason Reveal derives its own: with no
  // observer or with motion turned down there is nothing to wait for, and the
  // tiles must never be stranded mid-settle behind a feature that never runs.
  const canSettle = animate && !reducedMotion && typeof IntersectionObserver !== 'undefined'

  // A float, because the slider drags the deck continuously and the thumb has
  // to sit where the deck actually is rather than at the nearest slide.
  const [position, setPosition] = useState(0)
  const [metrics, setMetrics] = useState(null)
  const [entered, setEntered] = useState(false)
  const [shownFor, setShownFor] = useState(directionKey)

  const settled = entered || !canSettle

  const trackRef = useRef(null)
  const frame = useRef(0)
  const dragging = useRef(false)

  // The first paint, on the server and before anything has been measured, uses
  // the packer's own estimate. The first measurement replaces it.
  const slides = useMemo(
    () =>
      skillSlides(
        clusters,
        metrics
          ? {
              rowWidth: metrics.rowWidth,
              gap: metrics.gap,
              widths: metrics.widths
            }
          : undefined
      ),
    [clusters, metrics]
  )

  const total = slides.length
  const isDeck = total > 1
  const index = Math.min(total - 1, Math.max(0, Math.round(position)))

  // A new direction is different skills, so the deck starts again rather than
  // leaving the reader on slide four of something they are no longer looking
  // at. Adjusted during render, which settles before paint; the scroll itself
  // is a DOM effect and happens below.
  if (shownFor !== directionKey) {
    setShownFor(directionKey)
    setPosition(0)
    setEntered(false)
  }

  // ---- Measuring ----
  // Everything the packer needs, read off the rendered deck: how wide a row
  // actually is, what the gap between tiles actually is, and how wide each
  // label actually sets. A tile is sized by its own content, so these widths do
  // not depend on which row the tile ended up in - which is what stops the
  // measurement from chasing its own result around.
  //
  // The work happens in the observer's callback rather than in the effect body,
  // so this subscribes to the browser rather than kicking off a render pass of
  // its own, and the guard below means a change in the deck's height cannot
  // start a loop.
  useEffect(() => {
    const track = trackRef.current
    if (!track || typeof ResizeObserver === 'undefined') return

    const read = () => {
      const field = track.querySelector('.hp-slide-field')
      const row = track.querySelector('.hp-slide-row')
      if (!field || !row) return

      const rowWidth = Math.floor(field.clientWidth)
      if (rowWidth <= 0) return

      const styles = window.getComputedStyle(row)
      const gap = parseFloat(styles.columnGap) || 0

      const widths = new Map()
      let sum = 0
      for (const tile of track.querySelectorAll('.hp-tile')) {
        const label = tile.dataset.skill
        if (!label || widths.has(label)) continue
        const width = tile.getBoundingClientRect().width
        widths.set(label, width)
        sum += width
      }
      if (widths.size === 0) return

      // Only the width of things matters here. Re-packing changes the deck's
      // height, which fires this again; a signature that ignores height means
      // the second pass finds nothing new and stops.
      const signature = `${rowWidth}:${gap}:${widths.size}:${Math.round(sum)}`
      setMetrics(current => (current && current.signature === signature ? current : { rowWidth, gap, widths, signature }))
    }

    const observer = new ResizeObserver(read)
    observer.observe(track)
    return () => observer.disconnect()
  }, [clusters])

  // ---- The settle ----
  // One pass as the section arrives, and once more if the content is swapped
  // underneath it. Never on scroll, never on a loop.
  useEffect(() => {
    if (!canSettle) return
    const track = trackRef.current
    if (!track) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          setEntered(true)
          observer.disconnect()
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.08 }
    )
    observer.observe(track)
    return () => observer.disconnect()
  }, [canSettle, directionKey])

  // Back to the first slide when the direction changes. Instant rather than
  // smooth: this is a content swap, not a move the reader asked for.
  useEffect(() => {
    const track = trackRef.current
    if (track) track.scrollLeft = 0
  }, [directionKey])

  // Slide plus gap. Measured rather than assumed, so the breakpoints can change
  // the widths without this needing to know about them.
  const strideOf = (track) => {
    const first = track.firstElementChild
    if (!first) return 0
    const second = first.nextElementSibling
    return second
      ? second.getBoundingClientRect().left - first.getBoundingClientRect().left
      : first.getBoundingClientRect().width
  }

  // ---- Native scroll drives the thumb ----
  const onScroll = useCallback(() => {
    const track = trackRef.current
    if (!track) return
    if (frame.current) cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      const stride = strideOf(track)
      if (stride <= 0) return
      // The last slide is usually shorter than a full stride, so the track runs
      // out of room before scrollLeft reaches the last multiple of one. Read the
      // end of the track as the last slide rather than as most of the way to it,
      // or the thumb stops short of the end while the deck is already there.
      const furthest = track.scrollWidth - track.clientWidth
      const atEnd = furthest > 0 && furthest - track.scrollLeft <= 1
      setPosition(atEnd ? total - 1 : Math.max(0, Math.min(total - 1, track.scrollLeft / stride)))
    })
  }, [total])

  useEffect(() => () => { if (frame.current) cancelAnimationFrame(frame.current) }, [])

  const goTo = useCallback(
    (next, smooth = true) => {
      const track = trackRef.current
      if (!track) return
      const target = Math.max(0, Math.min(total - 1, next))
      setPosition(target)
      const stride = strideOf(track)
      track.scrollTo({ left: target * stride, behavior: smooth && !reducedMotion ? 'smooth' : 'auto' })
    },
    [total, reducedMotion]
  )

  // ---- Dragging ----
  // While the thumb is held the deck follows it continuously, so the track's
  // snapping is suspended for the length of the drag and the nearest slide is
  // taken on release. The flag is written straight to the DOM as well as held
  // in a ref: the first move can arrive before a re-render would have landed.
  const startDrag = () => {
    dragging.current = true
    if (trackRef.current) trackRef.current.dataset.dragging = 'true'
  }

  const endDrag = () => {
    if (!dragging.current) return
    dragging.current = false
    const track = trackRef.current
    if (!track) return
    delete track.dataset.dragging
    const stride = strideOf(track)
    if (stride > 0) goTo(Math.round(track.scrollLeft / stride))
  }

  const onScrub = (event) => {
    const track = trackRef.current
    if (!track) return
    const value = Number(event.target.value)
    setPosition(value)
    // Direct, not smooth: the deck is being dragged, not sent somewhere.
    track.scrollLeft = value * strideOf(track)
  }

  // A continuous slider moves by hundredths under the arrow keys, which is no
  // use to anyone. Keyboard moves by whole slides.
  const onSliderKey = (event) => {
    const keys = {
      ArrowLeft: index - 1,
      ArrowDown: index - 1,
      ArrowRight: index + 1,
      ArrowUp: index + 1,
      Home: 0,
      End: total - 1,
      PageDown: index - 1,
      PageUp: index + 1
    }
    if (!(event.key in keys)) return
    event.preventDefault()
    goTo(keys[event.key])
  }

  // No categories, or every category empty. The section does not appear at all
  // rather than appearing as a heading over nothing.
  if (total === 0) return null

  const atStart = index === 0
  const atEnd = index === total - 1

  return (
    <section className="hp-section hp-skills">
      <div className="hp-wrap">
        <Reveal enabled={animate} className="hp-skills-intro">
          <span className="hp-label">Skills in this direction</span>
          <h2 className="hp-skills-headline">The capabilities behind the results.</h2>
        </Reveal>

        <div className="hp-deck" data-static={isDeck ? 'false' : 'true'}>
          {/* One stage around the whole field. The slides inside it are not
              cards: they are how far the field has been scrolled, so they carry
              no frame of their own and the outline belongs to the viewport. */}
          <div className="hp-deck-stage">
            <div
              className="hp-deck-track"
              ref={trackRef}
              onScroll={isDeck ? onScroll : undefined}
              data-settled={settled ? 'true' : 'false'}
              // A scrollable region is reachable and operable from the keyboard.
              // The tiles inside it are not controls and are not focusable.
              {...(isDeck
                ? { tabIndex: 0, role: 'group', 'aria-label': 'Skills, scroll sideways to see more' }
                : {})}
            >
              {slides.map((slide, slideIndex) => {
                // One running count across the slide so the settle cascades
                // through the whole field rather than restarting each block.
                let tile = 0
                return (
                  <article
                    className="hp-slide"
                    key={`slide-${slideIndex}`}
                    aria-label={slideLabel(slide)}
                  >
                    {slide.blocks.map((block, blockIndex) => (
                      <div
                        className="hp-block"
                        data-continued={block.continued ? 'true' : 'false'}
                        key={`block-${block.group}-${blockIndex}`}
                      >
                        {/* A heading never appears without rows under it: a
                            block exists because rows landed here. */}
                        {block.name && (
                          <p className="hp-block-head">
                            <span className="hp-slide-name">{block.name}</span>
                          </p>
                        )}

                        <div className="hp-slide-field">
                          {block.rows.map((row, rowIndex) => (
                            <div className="hp-slide-row" key={`row-${rowIndex}`}>
                              {row.map((skill, i) => (
                                <span
                                  className="hp-tile"
                                  data-skill={skill}
                                  data-scale={tileScale(skill)}
                                  style={{ '--tile': tile++ }}
                                  key={`${skill}-${i}`}
                                >
                                  {skill}
                                </span>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </article>
                )
              })}
            </div>
          </div>

          {/* Previous at one end, next at the other, and one plain drag control
              between them. Not a second set of buttons: it is held and pulled,
              the deck follows it, and it lands on a slide when it is let go. */}
          {isDeck && (
            <div className="hp-deck-nav">
              <button
                type="button"
                className="hp-deck-step"
                data-step="prev"
                aria-label="Previous skill group"
                disabled={atStart}
                onClick={() => goTo(index - 1)}
              >
                <span className="hp-deck-chevron" aria-hidden="true" />
              </button>

              <div className="hp-deck-rail">
                <input
                  type="range"
                  className="hp-deck-slider"
                  min={0}
                  max={total - 1}
                  step="any"
                  value={position}
                  aria-label="Skill group"
                  aria-valuetext={`Slide ${index + 1} of ${total}`}
                  onChange={onScrub}
                  onPointerDown={startDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  onLostPointerCapture={endDrag}
                  onKeyDown={onSliderKey}
                />

                {/* The slider already announces the position, so this is the
                    readable copy of it and nothing more. */}
                <span className="hp-deck-count" aria-hidden="true">
                  {pad(index + 1)}
                  <span className="hp-deck-of"> / </span>
                  <span className="hp-deck-total">{pad(total)}</span>
                </span>
              </div>

              <button
                type="button"
                className="hp-deck-step"
                data-step="next"
                aria-label="Next skill group"
                disabled={atEnd}
                onClick={() => goTo(index + 1)}
              >
                <span className="hp-deck-chevron" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
