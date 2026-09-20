'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

// ============================================================================
// CAREER PROFILE FIRST-VISIT TOUR
//
// Desktop only. Runs once, the first time an owner opens the workspace with a
// profile already built. Each stop dims the page, cuts a hole around a real
// element, and parks a tooltip beside it.
//
// WHY THIS IS A COPY
// The Resume Writer and Interview Practice hubs each carry their own copy of
// this engine, identical below the step list. This is a third, and it is a copy
// on purpose: those two are working and shipped, and folding three pages into
// one shared component would mean editing both of them to find out whether the
// third was right. The refactor is worth doing and is not this change.
//
// What is genuinely different here is the theme. The other two sit on white
// pages and are painted in fixed hex; this one sits on the profile's dark
// ground, so every surface, rule and text colour reads from the same tokens the
// rest of the workspace uses. The component must therefore render inside
// `.hp-ed`, which is where those tokens are defined - a fixed-position element
// still inherits custom properties down the DOM, so position does not matter
// but ancestry does.
//
// There are no hex fallbacks on those reads any more, and no rgb triple held
// in this file. A fallback that spells out the dark value is a second copy of
// the palette living where nobody looks for it, and it is the copy that would
// still be lavender on the day the page is not.
//
// Geometry, navigation, filtering, persistence and the 300ms entry are the
// other two engines' behaviour unchanged.
// ============================================================================

const TOUR_KEY = 'hp_profile_tour_complete'
const TIP_WIDTH = 320
const SPOT_PAD = 8
const TIP_GAP = 16
const VIEWPORT_MARGIN = 16

const TOUR_STEPS = [
  {
    id: 'profile-identity',
    targets: ['profile-identity'],
    placement: 'right',
    title: 'Meet the résumé’s much more interesting sibling.',
    body: 'Your Career Profile brings the fuller story together: your work, results, proof, recommendations, and the parts of you that never fit on one page.'
  },
  {
    id: 'profile-directions',
    targets: ['profile-directions'],
    placement: 'bottom',
    title: 'One career can tell more than one story.',
    body: 'Career directions reshape your profile around the opportunities you want. Choose one to show employers the experience that matters most for that path.'
  },
  {
    id: 'profile-mode',
    targets: ['profile-mode'],
    placement: 'bottom',
    title: 'Edit here. Preview like an employer.',
    body: 'Edit shows your controls. Preview hides them, so you can see exactly what someone opening your link will see.'
  },
  {
    id: 'profile-about',
    targets: ['profile-about'],
    placement: 'right',
    title: 'We gave you a head start.',
    body: 'Hire Power has already built the foundation from what it knows about you. Use the pencils to refine the story and add evidence, portfolio work, testimonials, or your own words. No blank-page staring contest required.'
  },
  {
    id: 'profile-settings',
    targets: ['profile-settings'],
    placement: 'bottom',
    title: 'Nothing goes public until you say so.',
    body: 'Use Settings to choose what appears. Then preview, publish, and share your link when you’re ready. Your career story, your call.'
  }
]

export function profileTourAlreadySeen() {
  try {
    return !!window.localStorage.getItem(TOUR_KEY)
  } catch (e) {
    // Storage blocked (private mode) — treat it as unseen rather than crashing.
    return false
  }
}

function markProfileTourComplete() {
  try {
    window.localStorage.setItem(TOUR_KEY, 'true')
  } catch (e) {
    console.error('Could not persist profile tour completion (non-blocking):', e)
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

// CSS-triangle arrow, drawn twice so it picks up the card's 1px edge. On the
// light pages that edge is grey and the fill is white; here both come from the
// card's own palette, so the arrow reads as part of the card rather than a
// white notch on a dark one.
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

export default function ProfileTour({ onStepChange, onClose }) {
  // Lock the stop list at mount so the dots match what is actually on screen.
  // Preview mode has no edit pencils, so the About stop simply is not offered
  // to somebody who opened the workspace in Preview - the same way the hub
  // drops the Job Tracker stop for a tier that has no Job Tracker link.
  const [steps] = useState(() =>
    TOUR_STEPS.filter(s => document.querySelector(`[data-tour="${s.targets[0]}"]`))
  )
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState(null)
  const [tip, setTip] = useState(null)
  const tipRef = useRef(null)

  const step = steps[index] || null
  const isLast = index === steps.length - 1

  const finish = useCallback(() => {
    markProfileTourComplete()
    onClose()
  }, [onClose])

  const measure = useCallback(() => {
    if (!step) return
    const rects = step.targets
      .map(t => document.querySelector(`[data-tour="${t}"]`))
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

  const CARD_BG = 'var(--ed-raised)'
  const CARD_EDGE = 'var(--ed-accent-edge)'
  const arrow = tip ? arrowStyles(tip.placement, tip.arrow, CARD_EDGE, CARD_BG) : null

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
            border: '2px solid var(--profile-tour-ring)',
            // The veil's own strength lives with the rest of the palette now:
            // the page underneath is already dark, so it is heavier than the
            // light pages' 0.5, and that is a fact about this mode rather than
            // about this component.
            boxShadow: '0 0 0 4px var(--profile-tour-ring-inner), 0 0 30px var(--profile-tour-ring-glow), 0 0 0 9999px var(--profile-tour-veil)',
            pointerEvents: 'none',
            zIndex: 9999,
            transition: 'top 0.3s ease, left 0.3s ease, width 0.3s ease, height 0.3s ease'
          }}
        />
      ) : (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--profile-tour-veil)', pointerEvents: 'none', zIndex: 9999 }} />
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
          background: CARD_BG,
          border: `1px solid ${CARD_EDGE}`,
          borderRadius: 12,
          boxShadow: 'var(--profile-tour-card-shadow)',
          opacity: tip ? 1 : 0,
          transition: 'top 0.3s ease, left 0.3s ease, opacity 0.2s ease'
        }}
      >
        {/* Accent edge. The light pages run the brand gradient down it; here it
            is the profile's own lavender, which is the colour every other
            highlight in this workspace is drawn in. */}
        <div
          style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
            background: 'var(--ed-accent)',
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
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--ed-accent)', marginBottom: 6 }}>
            Step {index + 1} of {steps.length}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ed-ink)', marginBottom: 6 }}>
            {step.title}
          </div>
          <div style={{ fontSize: 13, color: 'var(--ed-muted)', lineHeight: 1.6 }}>
            {step.body}
          </div>
        </div>

        <div
          style={{
            borderTop: '1px solid var(--ed-line)',
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
                  background: i === index
                    ? 'var(--ed-accent)'
                    : i < index ? 'var(--profile-tour-dot-past)' : 'var(--ed-line-strong)'
                }}
              />
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={finish}
              style={{ fontSize: 12, color: 'var(--ed-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              Skip tour
            </button>
            <button
              onClick={() => { if (isLast) finish(); else setIndex(index + 1) }}
              style={{
                fontSize: 13, fontWeight: 600, color: 'var(--profile-on-action)',
                // The app's own indigo-to-purple brand gradient until now, which
                // is the one thing on this card that belonged to Hire Power
                // rather than to the profile underneath it. It is the Profile's
                // primary action now, the same sweep every other button on this
                // page is painted in.
                background: 'linear-gradient(to right, var(--profile-action-lift), var(--profile-action-deep))',
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
