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
// Desktop only, like the tour it opens. It takes its colour from whatever it
// sits in rather than naming one, so the same component reads correctly on the
// hubs' white cards and on the Career Profile's dark bar.
// ---------------------------------------------------------------------------
export function TourReplayButton({ storageKey, onReplay, label = 'Replay the tour', className = '', style }) {
  return (
    <button
      type="button"
      onClick={() => { resetTour(storageKey); onReplay() }}
      aria-label={label}
      title={label}
      className={`hidden md:inline-flex items-center justify-center flex-shrink-0 rounded-full border border-current opacity-40 hover:opacity-80 transition-opacity ${className}`}
      style={{ width: 18, height: 18, fontSize: 11, fontWeight: 700, lineHeight: 1, background: 'none', cursor: 'pointer', padding: 0, ...style }}
    >
      ?
    </button>
  )
}
