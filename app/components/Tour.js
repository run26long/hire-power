'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

// ============================================================================
// THE FIRST-VISIT TOUR
//
// One engine for all three of them. Each stop dims the page, cuts a hole around
// a real element and parks a tooltip beside it. Desktop only - the callers test
// the width before they mount this, because the spotlight geometry assumes room
// beside the target that a phone does not have.
//
// WHERE IT CAME FROM
// Three copies: ProfileTour, and an identical pair inlined in the Resume Writer
// and Interview Practice hubs. The two hubs' copies were the same file twice,
// to the byte. ProfileTour differed in four things and only four: it had no
// tier-dependent copy, its arrow helper took its colours as arguments, it read
// a dark palette out of custom properties, and it carried no isPro prop.
// Everything else - the geometry, the fallback order, the measuring, the
// filtering, the escape key, the dots - was the same text three times.
//
// So the two variation points are named rather than forked:
//
//   theme   which palette the card and veil are painted in. 'light' is the
//           hubs' own values, 'dark' reads the Career Profile workspace's
//           tokens. A dark tour must therefore render inside .hp-ed, where
//           those properties are defined: a fixed-position element still
//           inherits custom properties down the DOM, so position does not
//           matter but ancestry does.
//
//   steps   resolved by the caller, not here. The hubs rewrite their own copy
//           for a free account; that is a question about tiers, and a tour
//           engine that knows what a tier is would be carrying vocabulary from
//           a part of the product it has no other business with. What stays
//           here is the one filter that is about this component: a stop whose
//           target is not on the page cannot be pointed at.
//
// Persistence is the caller's too. It owns the key, decides when a tour has
// been seen, and the helpers below are the only thing this module says about
// it - both wrapped, because storage throws in private mode and a tour is
// never worth a crash.
// ============================================================================

const TIP_WIDTH = 320
const SPOT_PAD = 8
const TIP_GAP = 16
const VIEWPORT_MARGIN = 16

export function tourSeen(key) {
  try {
    return !!window.localStorage.getItem(key)
  } catch (e) {
    // Storage blocked (private mode) — treat it as unseen rather than crashing.
    return false
  }
}

export function markTourSeen(key) {
  try {
    window.localStorage.setItem(key, 'true')
  } catch (e) {
    console.error('Could not persist tour completion (non-blocking):', e)
  }
}

export function resetTour(key) {
  try {
    window.localStorage.removeItem(key)
  } catch (e) {
    console.error('Could not reset tour (non-blocking):', e)
  }
}

// ---------------------------------------------------------------------------
// THE TWO PALETTES
//
// Every colour either expression used, and nothing else. The light one is the
// hubs' literals; the dark one reads the workspace's own properties, with no
// hex fallbacks - a fallback spelling out the dark value is a second copy of
// the palette living where nobody looks for it, and it is the copy that would
// still be lavender on the day the page is not.
// ---------------------------------------------------------------------------
const THEMES = {
  light: {
    ring: 'rgba(102, 126, 234, 0.4)',
    ringShadow: '0 0 0 4px rgba(102, 126, 234, 0.1), 0 0 30px rgba(102, 126, 234, 0.15), 0 0 0 9999px rgba(0, 0, 0, 0.5)',
    veil: 'rgba(0, 0, 0, 0.5)',
    cardBg: '#ffffff',
    cardEdge: '#e5e7eb',
    cardShadow: '0 20px 60px rgba(0, 0, 0, 0.15), 0 4px 16px rgba(0, 0, 0, 0.08)',
    accentEdge: 'linear-gradient(to bottom, #667eea, #764ba2)',
    eyebrow: '#667eea',
    title: '#1a1a1a',
    body: '#6b7280',
    footRule: '#f3f4f6',
    dotNow: 'linear-gradient(to bottom right, #667eea, #764ba2)',
    dotPast: '#667eea',
    dotAhead: '#e5e7eb',
    skip: '#9ca3af',
    nextFill: 'linear-gradient(to right, #667eea, #764ba2)',
    nextInk: '#ffffff'
  },
  dark: {
    ring: 'var(--profile-tour-ring)',
    ringShadow: '0 0 0 4px var(--profile-tour-ring-inner), 0 0 30px var(--profile-tour-ring-glow), 0 0 0 9999px var(--profile-tour-veil)',
    veil: 'var(--profile-tour-veil)',
    cardBg: 'var(--ed-raised)',
    cardEdge: 'var(--ed-accent-edge)',
    cardShadow: 'var(--profile-tour-card-shadow)',
    accentEdge: 'var(--ed-accent)',
    eyebrow: 'var(--ed-accent)',
    title: 'var(--ed-ink)',
    body: 'var(--ed-muted)',
    footRule: 'var(--ed-line)',
    dotNow: 'var(--ed-accent)',
    dotPast: 'var(--profile-tour-dot-past)',
    dotAhead: 'var(--ed-line-strong)',
    skip: 'var(--ed-muted)',
    nextFill: 'var(--profile-primary-fill)',
    nextInk: 'var(--profile-on-action)'
  }
}

// Park the tooltip beside the spotlight, preferring the side the step asks for
// and falling back through the others until one fits without overflowing.
function computeTipPosition(rect, tipW, tipH, preferred) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const M = VIEWPORT_MARGIN
  const GAP = TIP_GAP
  const clamp = (v, min, max) => Math.max(min, Math.min(v, Math.max(min, max)))

  if (!rect) {
    // No measurable target — centre the card and skip the spotlight/arrow.
    return { top: clamp(vh / 2 - tipH / 2, M, vh - tipH - M), left: clamp(vw / 2 - tipW / 2, M, vw - tipW - M), placement: 'none', arrow: 0 }
  }

  const top = rect.top - SPOT_PAD
  const left = rect.left - SPOT_PAD
  const bottom = rect.top + rect.height + SPOT_PAD
  const right = rect.left + rect.width + SPOT_PAD
  const cx = (left + right) / 2
  const cy = (top + bottom) / 2

  const isVertical = preferred === 'top' || preferred === 'bottom'
  const order = isVertical
    ? [preferred, preferred === 'bottom' ? 'top' : 'bottom', 'right', 'left']
    : [preferred, preferred === 'left' ? 'right' : 'left', 'bottom', 'top']

  for (const p of order) {
    if (p === 'bottom' && bottom + GAP + tipH <= vh - M) {
      const l = clamp(cx - tipW / 2, M, vw - tipW - M)
      return { top: bottom + GAP, left: l, placement: 'bottom', arrow: clamp(cx - l, 18, tipW - 18) }
    }
    if (p === 'top' && top - GAP - tipH >= M) {
      const l = clamp(cx - tipW / 2, M, vw - tipW - M)
      return { top: top - GAP - tipH, left: l, placement: 'top', arrow: clamp(cx - l, 18, tipW - 18) }
    }
    if (p === 'right' && right + GAP + tipW <= vw - M) {
      const t = clamp(cy - tipH / 2, M, vh - tipH - M)
      return { top: t, left: right + GAP, placement: 'right', arrow: clamp(cy - t, 18, tipH - 18) }
    }
    if (p === 'left' && left - GAP - tipW >= M) {
      const t = clamp(cy - tipH / 2, M, vh - tipH - M)
      return { top: t, left: left - GAP - tipW, placement: 'left', arrow: clamp(cy - t, 18, tipH - 18) }
    }
  }

  // Nothing fits cleanly — sit below the target and clamp into the viewport.
  const l = clamp(cx - tipW / 2, M, vw - tipW - M)
  const t = clamp(bottom + GAP, M, vh - tipH - M)
  return { top: t, left: l, placement: 'bottom', arrow: clamp(cx - l, 18, tipW - 18) }
}

// CSS-triangle arrow, drawn twice so it picks up the card's own 1px edge.
function arrowStyles(placement, offset, edge, fill) {
  const S = 8
  const O = S + 1
  if (placement === 'bottom') {
    return {
      outer: { top: -O, left: offset - O, borderLeft: `${O}px solid transparent`, borderRight: `${O}px solid transparent`, borderBottom: `${O}px solid ${edge}` },
      inner: { top: -S, left: offset - S, borderLeft: `${S}px solid transparent`, borderRight: `${S}px solid transparent`, borderBottom: `${S}px solid ${fill}` }
    }
  }
  if (placement === 'top') {
    return {
      outer: { bottom: -O, left: offset - O, borderLeft: `${O}px solid transparent`, borderRight: `${O}px solid transparent`, borderTop: `${O}px solid ${edge}` },
      inner: { bottom: -S, left: offset - S, borderLeft: `${S}px solid transparent`, borderRight: `${S}px solid transparent`, borderTop: `${S}px solid ${fill}` }
    }
  }
  if (placement === 'right') {
    return {
      outer: { left: -O, top: offset - O, borderTop: `${O}px solid transparent`, borderBottom: `${O}px solid transparent`, borderRight: `${O}px solid ${edge}` },
      inner: { left: -S, top: offset - S, borderTop: `${S}px solid transparent`, borderBottom: `${S}px solid transparent`, borderRight: `${S}px solid ${fill}` }
    }
  }
  if (placement === 'left') {
    return {
      outer: { right: -O, top: offset - O, borderTop: `${O}px solid transparent`, borderBottom: `${O}px solid transparent`, borderLeft: `${O}px solid ${edge}` },
      inner: { right: -S, top: offset - S, borderTop: `${S}px solid transparent`, borderBottom: `${S}px solid transparent`, borderLeft: `${S}px solid ${fill}` }
    }
  }
  return null
}

export default function Tour({ steps: given, storageKey, theme = 'light', onStepChange, onClose }) {
  const t = THEMES[theme] || THEMES.light

  // Lock the stop list at mount so the dots match what is actually on screen.
  // A stop whose target is not rendered - Preview mode has no edit pencils, a
  // Vault tier has no Job Tracker link - is not offered rather than pointed at
  // nothing.
  const [steps] = useState(() =>
    (given || []).filter(s => document.querySelector(`[data-tour="${s.targets[0]}"]`))
  )
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState(null)
  const [tip, setTip] = useState(null)
  const tipRef = useRef(null)

  const step = steps[index] || null
  const isLast = index === steps.length - 1

  const finish = useCallback(() => {
    if (storageKey) markTourSeen(storageKey)
    onClose()
  }, [storageKey, onClose])

  const measure = useCallback(() => {
    if (!step) return
    const rects = step.targets
      .map(target => document.querySelector(`[data-tour="${target}"]`))
      .filter(Boolean)
      .map(el => el.getBoundingClientRect())
      .filter(r => r.width > 0 && r.height > 0)
    if (!rects.length) {
      setRect(null)
      return
    }
    const top = Math.min(...rects.map(r => r.top))
    const left = Math.min(...rects.map(r => r.left))
    const height = Math.max(...rects.map(r => r.bottom)) - top
    const width = Math.max(...rects.map(r => r.right)) - left
    setRect(prev => {
      if (prev && Math.abs(prev.top - top) < 0.5 && Math.abs(prev.left - left) < 0.5
        && Math.abs(prev.width - width) < 0.5 && Math.abs(prev.height - height) < 0.5) return prev
      return { top, left, width, height }
    })
  }, [step])

  // Nothing to point at — don't strand the user behind a backdrop.
  useEffect(() => {
    if (!steps.length) finish()
  }, [steps.length, finish])

  useLayoutEffect(() => {
    if (!step) return
    const el = document.querySelector(`[data-tour="${step.targets[0]}"]`)
    if (el) el.scrollIntoView({ block: 'center', inline: 'nearest' })
    measure()
  }, [step, measure])

  useEffect(() => {
    onStepChange?.(step ? step.id : null)
  }, [step, onStepChange])

  useEffect(() => {
    const onChange = () => measure()
    window.addEventListener('resize', onChange)
    window.addEventListener('scroll', onChange, true)
    return () => {
      window.removeEventListener('resize', onChange)
      window.removeEventListener('scroll', onChange, true)
    }
  }, [measure])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') finish() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [finish])

  // Position once the card has rendered so we can use its real height.
  useLayoutEffect(() => {
    const h = tipRef.current?.offsetHeight || 180
    setTip(computeTipPosition(rect, TIP_WIDTH, h, step?.placement))
  }, [rect, step])

  if (!step) return null

  const arrow = tip ? arrowStyles(tip.placement, tip.arrow, t.cardEdge, t.cardBg) : null

  return (
    <>
      {/* Click blocker — the tour only closes via Skip, Got it, or Escape. */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} />

      {rect ? (
        <div
          style={{
            position: 'fixed',
            boxSizing: 'border-box',
            top: rect.top - SPOT_PAD,
            left: rect.left - SPOT_PAD,
            width: rect.width + SPOT_PAD * 2,
            height: rect.height + SPOT_PAD * 2,
            borderRadius: 12,
            border: `2px solid ${t.ring}`,
            boxShadow: t.ringShadow,
            pointerEvents: 'none',
            zIndex: 9999,
            transition: 'top 0.3s ease, left 0.3s ease, width 0.3s ease, height 0.3s ease'
          }}
        />
      ) : (
        <div style={{ position: 'fixed', inset: 0, background: t.veil, pointerEvents: 'none', zIndex: 9999 }} />
      )}

      <div
        ref={tipRef}
        role="dialog"
        aria-label={step.title}
        style={{
          position: 'fixed',
          top: tip ? tip.top : -9999,
          left: tip ? tip.left : -9999,
          width: TIP_WIDTH,
          zIndex: 10000,
          background: t.cardBg,
          border: `1px solid ${t.cardEdge}`,
          borderRadius: 12,
          boxShadow: t.cardShadow,
          opacity: tip ? 1 : 0,
          transition: 'top 0.3s ease, left 0.3s ease, opacity 0.2s ease'
        }}
      >
        {/* Accent edge. The light pages run the brand gradient down it; the
            dark one is the profile's own lavender, which is the colour every
            other highlight in that workspace is drawn in. */}
        <div
          style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
            background: t.accentEdge,
            borderTopLeftRadius: 12, borderBottomLeftRadius: 12
          }}
        />

        {arrow && (
          <>
            <div style={{ position: 'absolute', width: 0, height: 0, ...arrow.outer }} />
            <div style={{ position: 'absolute', width: 0, height: 0, ...arrow.inner }} />
          </>
        )}

        <div style={{ padding: '16px 18px 14px 20px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.5px', color: t.eyebrow, marginBottom: 6 }}>
            Step {index + 1} of {steps.length}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: t.title, marginBottom: 6 }}>
            {step.title}
          </div>
          <div style={{ fontSize: 13, color: t.body, lineHeight: 1.6 }}>
            {step.body}
          </div>
        </div>

        <div
          style={{
            borderTop: `1px solid ${t.footRule}`,
            padding: '10px 18px 12px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            {steps.map((s, i) => (
              <span
                key={s.id}
                style={{
                  width: 7, height: 7, borderRadius: '50%', display: 'block',
                  background: i === index ? t.dotNow : i < index ? t.dotPast : t.dotAhead
                }}
              />
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={finish}
              style={{ fontSize: 12, color: t.skip, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              Skip tour
            </button>
            <button
              onClick={() => { if (isLast) finish(); else setIndex(index + 1) }}
              style={{
                fontSize: 13, fontWeight: 600, color: t.nextInk,
                background: t.nextFill,
                border: 'none', borderRadius: 6, padding: '8px 20px', cursor: 'pointer', whiteSpace: 'nowrap'
              }}
            >
              {isLast ? 'Got it ✓' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// THE WAY BACK IN
//
// A tour that runs once and can never be run again is a tour nobody can check
// a detail against. This is the second door: it forgets that the tour was seen
// and starts it, which is the same path a first visit takes rather than a
// second one beside it.
//
// Desktop only, like the tour it opens. A named chip rather than a ringed
// glyph: a lone "?" beside a heading is a question about the heading, and this
// is an offer to be shown round. A pale violet chip, short enough at 28px to
// sit under the controls beside it rather than among them.
//
// One palette on every page, so there is nothing for a tone to vary.
//
// The states are a stylesheet rather than inline style, because hover and
// focus-visible cannot be expressed inline.
// ---------------------------------------------------------------------------
const REPLAY_CSS = `
.hp-tour-replay {
  position: relative;
  height: 28px;
  padding: 0 9px;
  /* Display is deliberately not set here. The element carries Tailwind's
     hidden / md:inline-flex pair, which is the desktop-only rule, and those
     are single classes - exactly as specific as this one. This stylesheet is
     rendered into the body and Tailwind's is linked in the head, so at equal
     specificity a display set here would win on document order and the
     control would appear on a phone, where the tour it opens cannot run. */
  align-items: center;
  gap: 3px;
  background: #F8F4FD;
  border: 1px solid #E2D7F2;
  border-radius: 999px;
  box-shadow: none;
  font-family: 'DM Sans', sans-serif;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: .01em;
  color: #6D45C6;
  white-space: nowrap;
  cursor: pointer;
  transition: background .15s ease, color .15s ease;
}
.hp-tour-replay:hover,
.hp-tour-replay:focus-visible { background: #F1E9FB; color: #5931B3; }
.hp-tour-replay:focus-visible { outline: 2px solid rgba(147, 51, 234, .40); outline-offset: 2px; }

/* Absolute, so showing it moves nothing. Centred on the control and parked
   on whichever side has the room. */
.hp-tour-replay-tip {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10001;
  font-family: 'DM Sans', sans-serif;
  font-size: 11px;
  font-weight: 600;
  color: #ffffff;
  background: #20242A;
  padding: 6px 8px;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, .18);
  white-space: nowrap;
  pointer-events: none;
}
.hp-tour-replay-tip[data-place="top"] { bottom: calc(100% + 8px); }
.hp-tour-replay-tip[data-place="bottom"] { top: calc(100% + 8px); }
`

// One small mark to the left of the word. A play triangle: this starts
// something, and the only other thing it could be is the question mark that
// was just taken out.
function ReplayIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 13 13" aria-hidden="true" focusable="false" style={{ flexShrink: 0 }}>
      <path
        d="M4.1 2.75v7.5a.6.6 0 0 0 .92.5l5.9-3.75a.6.6 0 0 0 0-1L5.02 2.25a.6.6 0 0 0-.92.5Z"
        fill="currentColor"
      />
    </svg>
  )
}

// The card is about 26px, and it sits 8px clear of the control.
const TIP_CLEARANCE = 34
// How close the card may come to the window's edge before it is nudged back.
const TIP_MARGIN = 8

export function TourReplayButton({ storageKey, onReplay, label = 'Replay guided tour', className = '', tipPlacement = 'top' }) {
  // Which side the tooltip sits on, and how far it has to be nudged sideways
  // to stay on screen. Both are decided when it is asked for rather than up
  // front, because the control sits mid-column on one page and in a bar at the
  // top of the window on another.
  const [place, setPlace] = useState(null)
  const ref = useRef(null)
  const tipRef = useRef(null)

  const show = () => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) { setPlace(tipPlacement); return }
    const above = rect.top >= TIP_CLEARANCE
    const below = window.innerHeight - rect.bottom >= TIP_CLEARANCE
    // The page's preference, unless that side has no room and the other does.
    setPlace(tipPlacement === 'bottom'
      ? (below || !above ? 'bottom' : 'top')
      : (above || !below ? 'top' : 'bottom'))
  }
  const hide = () => setPlace(null)

  // Centred on the control, then pushed back inside the window if that would
  // hang it off an edge. Written onto the node rather than held as state: the
  // measurement is of the card that has just been laid out, so turning it into
  // a render would be a second pass to reach the same pixels, and a state the
  // nudge fed back into would be a loop waiting to happen. Measured from the
  // control's centre and the card's own layout width, both of which the
  // transform does not move.
  useLayoutEffect(() => {
    const tip = tipRef.current
    if (!place || !tip) return
    const rect = ref.current?.getBoundingClientRect()
    const width = tip.offsetWidth
    if (!rect || !width) return
    const centre = rect.left + rect.width / 2
    let shift = 0
    if (centre - width / 2 < TIP_MARGIN) shift = TIP_MARGIN - (centre - width / 2)
    else if (centre + width / 2 > window.innerWidth - TIP_MARGIN) shift = (window.innerWidth - TIP_MARGIN) - (centre + width / 2)
    tip.style.transform = `translateX(calc(-50% + ${Math.round(shift)}px))`
  }, [place])

  return (
    <>
      <style>{REPLAY_CSS}</style>
      <button
        ref={ref}
        type="button"
        onClick={() => { resetTour(storageKey); onReplay() }}
        aria-label={label}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className={`hp-tour-replay hidden md:inline-flex flex-shrink-0 ${className}`}
      >
        <ReplayIcon />
        Tour
        {place && (
          <span
            ref={tipRef}
            className="hp-tour-replay-tip"
            data-place={place}
            aria-hidden="true"
          >
            {label}
          </span>
        )}
      </button>
    </>
  )
}
