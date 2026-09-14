'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Reveal from './Reveal'

// ============================================================================
// SKILLS IN THIS DIRECTION - the capabilities behind the results.
//
// One card per category, travelling sideways on a single track. A card owns its
// heading and its own skills and nothing else: categories never share one, a
// heading never appears among another category's skills, and no category's
// skills continue into the next card.
//
// A card is sized by what is in it. Its skills are measured at their natural
// width, dealt into balanced rows by a partition that minimises the widest row,
// and the widest row becomes the card's content width. The rows beneath it then
// grow into that width in proportion to what each tile already needed, so long
// labels take more of the slack than short ones and the result reads as fitted
// pieces rather than a grid. A small category therefore makes a small card, and
// a card stops at its last row rather than being padded out to match a
// neighbour.
//
// Proof is a floating object over the field, sized by its own content: the
// resolved sources are laid out once in a hidden copy at the real width, its
// height is read off that, and the surface opens at that height - clamped to a
// floor, a ceiling, and the room between the sticky bar and the viewport edge.
// ============================================================================

const ARROW_STEP = 0.8

// The shape of a card's mosaic. Four rows is the ceiling and the only shape
// constant left: the column count follows from it and the number of skills, and
// the card's width follows from those. Nothing about it is negotiable any more,
// which is the point - a card that could buy itself a fifth row when it ran out
// of width is how a category became a list.
const MOSAIC_MAX_ROWS = 4
// How far a tile may be grown past its natural width to help close its row.
// Two limits, and the tighter one wins: a ratio, so a long label is not doubled,
// and an absolute, so a short one cannot become a banner. Past both, the row
// simply ends short - the partition and the card width are what should change.
const TILE_MAX_STRETCH = 2.2
const TILE_MAX_GROWTH = 200

// Three tones, cycled by a category's position in the payload.
const TONES = 3

// ---- The proof surface ----
const PROOF_GUTTER = 16
const PROOF_IDEAL_WIDTH = 512
// A floor, so a single short source does not open as an awkward strip, and a
// ceiling, past which the body scrolls inside a surface of fixed height.
const PROOF_MIN_HEIGHT = 240
const PROOF_MAX_HEIGHT = 520
// How far the surface reaches beyond the tile on every side, so the tile's own
// rectangle lands inside the body rather than against an edge.
const PROOF_CONTAIN_PAD = 24

// ---------------------------------------------------------------------------
// Row balancing.
//
// Split an ordered list of widths into `rows` contiguous groups so that the
// widest group is as narrow as it can be. Order is never disturbed - a row is
// always a run of consecutive skills - so the payload's sequence survives.
//
// Pure and generic: it sees numbers.
// ---------------------------------------------------------------------------
function partitionRows(widths, rows, gap) {
  const n = widths.length
  if (rows >= n) return widths.map((_, i) => [i, i])

  const prefix = [0]
  for (let i = 0; i < n; i += 1) prefix.push(prefix[i] + widths[i])
  const span = (i, j) => prefix[j + 1] - prefix[i] + gap * (j - i)

  // widest[r][i]: the narrowest possible widest-row, covering items i..n-1 in
  // r rows. Solved from the end back, so the walk forward reads the cuts off.
  const widest = Array.from({ length: rows + 1 }, () => new Array(n + 1).fill(Infinity))
  const cut = Array.from({ length: rows + 1 }, () => new Array(n + 1).fill(n - 1))
  for (let r = 0; r <= rows; r += 1) widest[r][n] = 0

  for (let r = 1; r <= rows; r += 1) {
    for (let i = n - 1; i >= 0; i -= 1) {
      for (let j = i; j < n; j += 1) {
        const rest = widest[r - 1][j + 1]
        if (rest === Infinity) continue
        const value = Math.max(span(i, j), rest)
        if (value < widest[r][i]) {
          widest[r][i] = value
          cut[r][i] = j
        }
      }
    }
  }

  const groups = []
  let i = 0
  for (let r = rows; r > 0 && i < n; r -= 1) {
    const j = cut[r][i]
    groups.push([i, j])
    i = j + 1
  }
  if (i < n) groups.push([i, n - 1])
  return groups
}

// Choose the shape of a category's mosaic: four rows at the outside, and as
// many columns as it takes to hold the skills in them.
//
// The row count is not a preference any more. A card that is allowed to answer
// "too wide" by taking a fifth and sixth row becomes a column of skills, and a
// strip of those reads as three lists rather than three categories. So the
// count of columns is derived from the count of skills - ceil(n / 4) - and the
// card takes whatever width those columns need. The track it sits in already
// scrolls; the page does not.
function planMosaic(widths, gap, limits) {
  const { minContent, maxRows } = limits
  const n = widths.length
  const rowWidth = (group) => {
    const [i, j] = group
    let total = gap * (j - i)
    for (let k = i; k <= j; k += 1) total += widths[k]
    return total
  }

  if (n === 0) return null

  // The whole calculation. Four skills or fewer make one column; every four
  // after that add another.
  const columns = Math.ceil(n / maxRows)
  const rows = Math.ceil(n / columns)

  // Balanced by width first, because rows of roughly equal length are what
  // makes the block read as a mosaic rather than a ragged list.
  let groups = partitionRows(widths, rows, gap)

  // ...but the column count is the contract, and a row of narrow labels can
  // beat the balance and take more than its share. Where that happens the
  // even division wins. Either way the order is untouched: every group is a
  // contiguous run, so a skill never moves past another one.
  if (groups.some(([i, j]) => j - i + 1 > columns)) {
    groups = []
    for (let i = 0; i < n; i += columns) groups.push([i, Math.min(i + columns, n) - 1])
  }

  return {
    columns,
    rows: groups.map(([i, j]) => {
      const row = []
      for (let k = i; k <= j; k += 1) row.push(k)
      return row
    }),
    // No ceiling. A card clamped narrower than its widest row makes every tile
    // in that row give width back and wrap its own label, which is the thing
    // the brief calls shrinking text to fit a narrower card.
    content: Math.max(minContent, Math.max(...groups.map(rowWidth)))
  }
}

export default function SkillsSection({
  clusters,
  featuredSkills,
  skillProof,
  animate = true,
  reducedMotion = false,
  directionKey
}) {
  const canSettle = animate && !reducedMotion && typeof IntersectionObserver !== 'undefined'

  const [progress, setProgress] = useState(0)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)
  const [entered, setEntered] = useState(false)
  const [open, setOpen] = useState(null)
  const [shownFor, setShownFor] = useState(directionKey)
  const [frameWidth, setFrameWidth] = useState(null)
  const [layout, setLayout] = useState(null)

  const settled = entered || !canSettle

  const fieldRef = useRef(null)
  const measureRef = useRef(null)
  const proofMeasureRef = useRef(null)
  const popoverRef = useRef(null)
  const proofBodyRef = useRef(null)
  const frame = useRef(0)
  const trigger = useRef(null)

  const groups = useMemo(
    () =>
      (Array.isArray(clusters) ? clusters : [])
        .map(cluster => ({
          name: cluster?.name || null,
          skills: Array.isArray(cluster?.skills) ? cluster.skills.filter(Boolean) : []
        }))
        .filter(group => group.skills.length > 0),
    [clusters]
  )

  const featured = useMemo(
    () => new Set(
      (Array.isArray(featuredSkills) ? featuredSkills : [])
        .map(skill => String(skill || '').trim().toLowerCase())
        .filter(Boolean)
    ),
    [featuredSkills]
  )

  const proofFor = useCallback(
    (skill) =>
      (skillProof instanceof Map ? skillProof.get(String(skill).trim().toLowerCase()) : null) || null,
    [skillProof]
  )

  // Every skill that has proof, in payload order. The hidden copies below are
  // built from this, and a click looks its tile up here by index.
  const proofSkills = useMemo(() => {
    const seen = new Map()
    for (const group of groups) {
      for (const skill of group.skills) {
        const key = String(skill).trim().toLowerCase()
        if (seen.has(key)) continue
        const proof = proofFor(skill)
        if (proof) seen.set(key, { skill, proof })
      }
    }
    return [...seen.values()]
  }, [groups, proofFor])

  const proofIndex = useMemo(() => {
    const index = new Map()
    proofSkills.forEach((entry, i) => index.set(String(entry.skill).trim().toLowerCase(), i))
    return index
  }, [proofSkills])

  if (shownFor !== directionKey) {
    setShownFor(directionKey)
    setOpen(null)
    setProgress(0)
    setAtStart(true)
    setAtEnd(false)
    setEntered(false)
  }

  const panelId = 'hp-skill-proof'
  const openProof = open ? proofFor(open.skill) : null

  // ---- The frame the cards are planned against ----
  // Subscribed to rather than read once, so a resize replans. The width is
  // rounded and compared before it is stored, which is what stops an observer
  // from re-firing on its own sub-pixel output.
  useEffect(() => {
    const field = fieldRef.current
    if (!field || typeof ResizeObserver === 'undefined') return
    const read = () => {
      const width = Math.round(field.clientWidth)
      if (width > 0) setFrameWidth(current => (current === width ? current : width))
    }
    const observer = new ResizeObserver(read)
    observer.observe(field)
    return () => observer.disconnect()
  }, [])

  // ---- Measure, then plan ----
  // The hidden layer holds the same tiles under the same constraint, so the
  // widths read back are the widths the browser would really produce - wrapping
  // included, where a label is longer than a card may be.
  useEffect(() => {
    const node = measureRef.current
    if (!node || !frameWidth) return

    // The tokens live on the card, so they are read from a real card. Reading
    // them off the layer above silently returns nothing, and the plan is then
    // built against numbers the stylesheet is not using.
    const sample = node.querySelector('.hp-card')
    if (!sample) return
    const tokens = getComputedStyle(sample)
    const gap = parseFloat(tokens.getPropertyValue('--mosaic-gap')) || 10
    const pad = parseFloat(tokens.getPropertyValue('--card-pad')) || 18
    // Border-box everywhere, so the card's frame is part of its stated width.
    const frame = pad * 2 +
      parseFloat(tokens.borderLeftWidth || '0') + parseFloat(tokens.borderRightWidth || '0')
    // The widest a card may be is read from the resolved max-width, not from
    // the custom property behind it: a custom property comes back as the text
    // that was written, so a viewport-relative one parses to nothing and the
    // plan plans a card far wider than the stylesheet will ever allow - which
    // the stylesheet then clamps, squeezing every tile in it.
    const minContent = (parseFloat(tokens.getPropertyValue('--card-min')) || 240) - frame
    const maxRows = parseFloat(tokens.getPropertyValue('--mosaic-max-rows')) || MOSAIC_MAX_ROWS

    const planned = []
    for (const [index, group] of groups.entries()) {
      const card = node.querySelector(`[data-measure-card="${index}"]`)
      if (!card) return
      const widths = [...card.querySelectorAll('.hp-tile')].map(tile =>
        Math.ceil(tile.getBoundingClientRect().width)
      )
      if (widths.length === 0) continue
      const plan = planMosaic(widths, gap, { minContent, maxRows })
      if (!plan) continue
      planned.push({
        rows: plan.rows,
        columns: plan.columns,
        width: Math.round(plan.content + frame),
        natural: widths
      })
    }

    if (planned.length !== groups.length) return
    const signature = JSON.stringify(planned)
    setLayout(current => (current && current.signature === signature ? current : { cards: planned, signature }))
    // The states are part of the reading, so a change in emphasis or proof
    // re-measures just as a change of category would.
  }, [groups, frameWidth, featured, proofFor])

  // ---- Reading the field back ----
  const readPosition = useCallback(() => {
    const field = fieldRef.current
    if (!field) return
    if (frame.current) cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      const furthest = field.scrollWidth - field.clientWidth
      const left = field.scrollLeft
      setProgress(furthest > 0 ? Math.min(1, Math.max(0, left / furthest)) : 0)
      setAtStart(left <= 1)
      setAtEnd(furthest <= 0 || left >= furthest - 1)
    })
  }, [])

  useEffect(() => () => { if (frame.current) cancelAnimationFrame(frame.current) }, [])

  useEffect(() => {
    const field = fieldRef.current
    if (field) field.scrollLeft = 0
    readPosition()
  }, [directionKey, layout, readPosition])

  // ---- The settle ----
  useEffect(() => {
    if (!canSettle) return
    const field = fieldRef.current
    if (!field) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          setEntered(true)
          observer.disconnect()
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.05 }
    )
    observer.observe(field)
    return () => observer.disconnect()
  }, [canSettle, directionKey])

  // ---- Proof ----
  // Which edges still have content beyond them. Written straight onto the node:
  // it is a presentational fact about scroll position, not state the render
  // depends on.
  const syncProofOverflow = useCallback(() => {
    const node = proofBodyRef.current
    if (!node) return
    node.dataset.back = node.scrollTop > 2 ? 'true' : 'false'
    node.dataset.more = node.scrollHeight - node.scrollTop - node.clientHeight > 2 ? 'true' : 'false'
  }, [])

  const close = useCallback((returnFocus = false) => {
    setOpen(null)
    if (returnFocus && trigger.current) trigger.current.focus()
    trigger.current = null
  }, [])

  // Over the tile rather than above or below it, and only as tall as it needs
  // to be. The natural height is read from a hidden copy laid out at the real
  // width before anything is shown, so there is nothing to see being resized.
  const placeFor = (tile, skill) => {
    const box = tile.getBoundingClientRect()
    const viewW = window.innerWidth
    const viewH = window.innerHeight

    // The sticky direction bar is the one thing that must never be covered. Its
    // own position is asked for rather than assumed.
    const bar = document.querySelector('.hp-bar[data-stuck="true"]')
    const ceiling = (bar ? bar.getBoundingClientRect().bottom : 0) + PROOF_GUTTER
    const floor = viewH - PROOF_GUTTER

    const roomX = Math.max(PROOF_IDEAL_WIDTH / 2, viewW - PROOF_GUTTER * 2)
    const width = Math.min(roomX, Math.max(PROOF_IDEAL_WIDTH, box.width + PROOF_CONTAIN_PAD * 2))

    // What the content actually comes to at that width.
    let natural = PROOF_MAX_HEIGHT
    const copy = proofMeasureRef.current?.querySelector(
      `[data-proof-index="${proofIndex.get(String(skill).trim().toLowerCase())}"]`
    )
    if (copy) {
      copy.style.width = `${width}px`
      natural = Math.ceil(copy.getBoundingClientRect().height)
    }

    // The room between the bar and the foot of the viewport is the real
    // ceiling; the constants only say what is comfortable within it.
    const roomY = Math.max(box.height + PROOF_CONTAIN_PAD * 2, floor - ceiling)
    const ceilingH = Math.min(PROOF_MAX_HEIGHT, roomY)
    const floorH = Math.min(PROOF_MIN_HEIGHT, ceilingH)
    const height = Math.max(floorH, Math.min(natural, ceilingH))

    let left = box.left + box.width / 2 - width / 2
    left = Math.max(PROOF_GUTTER, Math.min(left, viewW - width - PROOF_GUTTER))
    if (left > box.left) left = box.left
    if (left + width < box.right) left = box.right - width

    let top = box.top + box.height / 2 - height / 2
    top = Math.max(ceiling, Math.min(top, floor - height))
    if (top > box.top) top = box.top
    if (top + height < box.bottom) top = box.bottom - height

    return {
      left: Math.round(left),
      top: Math.round(top),
      width: Math.round(width),
      height: Math.round(height),
      natural,
      tile: { left: box.left, top: box.top, width: box.width, height: box.height }
    }
  }

  const toggle = (skill, event) => {
    if (open && open.skill === skill) {
      close()
      return
    }
    const tile = event.currentTarget
    trigger.current = tile
    setOpen({ skill, place: placeFor(tile, skill) })
  }

  useEffect(() => {
    if (!open) return
    syncProofOverflow()
  }, [open, syncProofOverflow])

  // The unfolding. The surface is laid out where it belongs, then played
  // backwards from the tile's exact bounds, so the growth starts on the thing
  // that was clicked rather than near it.
  useEffect(() => {
    if (!open || reducedMotion) return
    const node = popoverRef.current
    if (!node || typeof node.animate !== 'function') return

    const surface = node.getBoundingClientRect()
    const { tile } = open.place
    if (surface.width === 0 || surface.height === 0) return

    const scaleX = Math.max(0.05, tile.width / surface.width)
    const scaleY = Math.max(0.05, tile.height / surface.height)
    const shiftX = tile.left + tile.width / 2 - (surface.left + surface.width / 2)
    const shiftY = tile.top + tile.height / 2 - (surface.top + surface.height / 2)

    node.animate(
      [
        { transform: `translate(${shiftX}px, ${shiftY}px) scale(${scaleX}, ${scaleY})`, opacity: 0, borderRadius: '8px' },
        { transform: 'none', opacity: 1, borderRadius: '20px' }
      ],
      { duration: 260, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
    )
  }, [open, reducedMotion])

  useEffect(() => {
    if (!open) return
    const onKey = (event) => { if (event.key === 'Escape') close(true) }
    const onDown = (event) => {
      if (popoverRef.current?.contains(event.target)) return
      if (trigger.current?.contains(event.target)) return
      close()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [open, close])

  // Anchored to a tile it does not own: the moment that tile could have moved,
  // the anchor is stale and the surface goes.
  useEffect(() => {
    if (!open) return
    const field = fieldRef.current
    const dismiss = () => close()
    field?.addEventListener('scroll', dismiss, { passive: true })
    window.addEventListener('scroll', dismiss, { passive: true })
    window.addEventListener('resize', dismiss)
    return () => {
      field?.removeEventListener('scroll', dismiss)
      window.removeEventListener('scroll', dismiss)
      window.removeEventListener('resize', dismiss)
    }
  }, [open, close])

  // ---- Moving the field ----
  const scrollTo = useCallback(
    (left, smooth = true) => {
      const field = fieldRef.current
      if (!field) return
      field.scrollTo({ left, behavior: smooth && !reducedMotion ? 'smooth' : 'auto' })
    },
    [reducedMotion]
  )

  const nudge = useCallback(
    (direction) => {
      const field = fieldRef.current
      if (!field) return
      scrollTo(field.scrollLeft + direction * field.clientWidth * ARROW_STEP)
    },
    [scrollTo]
  )

  const onScrub = (event) => {
    const field = fieldRef.current
    if (!field) return
    const fraction = Number(event.target.value)
    setProgress(fraction)
    field.scrollLeft = fraction * (field.scrollWidth - field.clientWidth)
  }

  const onSliderKey = (event) => {
    const field = fieldRef.current
    if (!field) return
    const furthest = field.scrollWidth - field.clientWidth
    const moves = {
      ArrowLeft: () => nudge(-1),
      ArrowDown: () => nudge(-1),
      ArrowRight: () => nudge(1),
      ArrowUp: () => nudge(1),
      PageDown: () => nudge(-1),
      PageUp: () => nudge(1),
      Home: () => scrollTo(0),
      End: () => scrollTo(furthest)
    }
    if (!(event.key in moves)) return
    event.preventDefault()
    moves[event.key]()
  }

  if (groups.length === 0) return null

  // One running index across the whole field, so the settle follows reading
  // order rather than position within a card.
  let order = 0

  const tileFor = (skill, key, grow) => {
    const index = order++
    const isFeatured = featured.has(String(skill).trim().toLowerCase())
    const proof = proofFor(skill)
    const isOpen = open?.skill === skill && Boolean(proof)
    // A tile keeps at least the width its own label needed and may be grown to
    // help close its row, in proportion to that width - so the slack lands on
    // the long labels rather than being shared out evenly.
    const style = grow
      ? {
          '--tile': index,
          flexGrow: grow,
          flexShrink: 1,
          flexBasis: `${grow}px`,
          maxWidth: `${Math.round(Math.min(grow * TILE_MAX_STRETCH, grow + TILE_MAX_GROWTH))}px`
        }
      : { '--tile': index }

    if (!proof) {
      return (
        <span
          className="hp-tile"
          data-skill={skill}
          data-featured={isFeatured ? 'true' : undefined}
          style={style}
          key={key}
        >
          <span className="hp-tile-label">{skill}</span>
          <span className="hp-tile-mark" aria-hidden="true" />
        </span>
      )
    }

    return (
      <button
        type="button"
        className="hp-tile"
        data-skill={skill}
        data-featured={isFeatured ? 'true' : undefined}
        data-has-proof="true"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={(event) => toggle(skill, event)}
        style={style}
        key={key}
      >
        <span className="hp-tile-label">{skill}</span>
        <span className="hp-tile-mark" aria-hidden="true">{isOpen ? '−' : '+'}</span>
      </button>
    )
  }

  const proofBody = (items) => (
    <ul className="hp-proof-list">
      {items.map(item => (
        <li className="hp-proof-item" data-source={item.source} key={`${item.source}-${item.id}`}>
          {item.source === 'evidence' && (
            <>
              {item.kind && <span className="hp-proof-kind">{item.kind}</span>}
              {item.title && <span className="hp-proof-title">{item.title}</span>}
              {item.detail && <span className="hp-proof-detail">{item.detail}</span>}
              {item.url && (
                <a className="hp-proof-link" href={item.url} target="_blank" rel="noopener noreferrer">
                  View
                </a>
              )}
            </>
          )}

          {item.source === 'testimonial' && (
            <>
              {item.detail && <blockquote className="hp-proof-quote">{item.detail}</blockquote>}
              {item.title && <span className="hp-proof-name">{item.title}</span>}
              {item.role && <span className="hp-proof-role">{item.role}</span>}
            </>
          )}

          {item.source === 'bullet' && (
            <>
              {item.title && <span className="hp-proof-kind">{item.title}</span>}
              {item.detail && <span className="hp-proof-detail">{item.detail}</span>}
            </>
          )}
        </li>
      ))}
    </ul>
  )

  const place = open?.place

  return (
    <section className="hp-section hp-skills">
      <div className="hp-wrap">
        <Reveal enabled={animate} className="hp-skills-intro">
          <span className="hp-label">Skills in this direction</span>
          <h2 className="hp-skills-headline">The capabilities behind the results.</h2>
        </Reveal>

        <div className="hp-capability">
          <div
            className="hp-field"
            ref={fieldRef}
            onScroll={readPosition}
            data-settled={settled ? 'true' : 'false'}
            data-dimmed={open ? 'true' : 'false'}
            tabIndex={0}
            role="group"
            aria-label="Skills by category, scroll sideways to see more"
          >
            {/* The measuring layer. The same tiles in the same states under
                the same width constraint, hidden and out of flow, so what is
                read back is what the browser would really produce. The states
                matter to the reading: proof sets a heavier weight, and a tile
                measured at the lighter one is rendered a little too narrow for
                its own label and wraps. */}
            <div className="hp-measure" ref={measureRef} aria-hidden="true">
              {groups.map((group, index) => (
                <div className="hp-card" data-measure-card={index} key={`m-${index}`}>
                  <div className="hp-mosaic">
                    {group.skills.map((skill, i) => (
                      <span
                        className="hp-tile"
                        data-featured={featured.has(String(skill).trim().toLowerCase()) ? 'true' : undefined}
                        data-has-proof={proofFor(skill) ? 'true' : undefined}
                        key={`mt-${i}`}
                      >
                        <span className="hp-tile-label">{skill}</span>
                        <span className="hp-tile-mark" aria-hidden="true">+</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {groups.map((group, index) => {
              const plan = layout?.cards[index]
              return (
                <article
                  className="hp-card"
                  data-tone={index % TONES}
                  data-planned={plan ? 'true' : 'false'}
                  data-columns={plan ? plan.columns : undefined}
                  style={plan ? { width: `${plan.width}px` } : undefined}
                  key={`c-${index}`}
                >
                  {group.name && (
                    <header className="hp-card-head">
                      <h3 className="hp-card-name">{group.name}</h3>
                    </header>
                  )}

                  <div className="hp-mosaic">
                    {plan
                      ? plan.rows.map((row, rowIndex) => (
                          <div className="hp-mrow" key={`r-${rowIndex}`}>
                            {row.map(i => tileFor(group.skills[i], `${index}-${i}`, plan.natural[i]))}
                          </div>
                        ))
                      : group.skills.map((skill, i) => tileFor(skill, `${index}-${i}`, 0))}
                  </div>
                </article>
              )
            })}
          </div>

          <div className="hp-field-nav">
            <button
              type="button"
              className="hp-field-step"
              data-step="prev"
              aria-label="Scroll skills left"
              disabled={atStart}
              onClick={() => nudge(-1)}
            >
              <span className="hp-field-chevron" aria-hidden="true" />
            </button>

            <input
              type="range"
              className="hp-field-slider"
              min={0}
              max={1}
              step="any"
              value={progress}
              aria-label="Scroll through skills"
              onChange={onScrub}
              onKeyDown={onSliderKey}
            />

            <button
              type="button"
              className="hp-field-step"
              data-step="next"
              aria-label="Scroll skills right"
              disabled={atEnd}
              onClick={() => nudge(1)}
            >
              <span className="hp-field-chevron" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Hidden copies of every resolvable proof, so the surface's height is
          known before it is shown rather than corrected after. */}
      <div className="hp-proof-measures" ref={proofMeasureRef} aria-hidden="true">
        {proofSkills.map((entry, index) => (
          <div className="hp-proof hp-proof-measure" data-proof-index={index} key={`pm-${index}`}>
            <div className="hp-proof-head">
              <span className="hp-proof-skill">{entry.skill}</span>
              <span className="hp-proof-close"><span>×</span></span>
            </div>
            <div className="hp-proof-body">{proofBody(entry.proof)}</div>
          </div>
        ))}
      </div>

      {openProof && (
        <div
          className="hp-proof"
          id={panelId}
          ref={popoverRef}
          role="group"
          aria-label={`Proof for ${open.skill}`}
          style={{
            left: `${place.left}px`,
            top: `${place.top}px`,
            width: `${place.width}px`,
            height: `${place.height}px`
          }}
        >
          <div className="hp-proof-head">
            <span className="hp-proof-skill">{open.skill}</span>
            <button
              type="button"
              className="hp-proof-close"
              aria-label="Close proof"
              onClick={() => close(true)}
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>

          <div className="hp-proof-body" ref={proofBodyRef} onScroll={syncProofOverflow}>
            {proofBody(openProof)}
          </div>
        </div>
      )}
    </section>
  )
}
