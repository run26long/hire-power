'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

// ============================================================================
// /p/[slug] — the public Career Profile.
//
// No auth to view, and deliberately no MainNav: nothing on this page belongs to
// the logged-in product. It carries its own dark theme in CSS custom properties
// rather than the app's Tailwind palette, so the two never drift into each
// other. Tailwind still does layout and spacing.
// ============================================================================

const CROSSFADE_MS = 300
const SWIPE_THRESHOLD_PX = 40

// Where a lens sits relative to the one in the spotlight. The first step out is
// the largest so the active name gets room; every step after that is tighter,
// which is what makes the row read as depth rather than a list.
function offsetForDistance(distance) {
  if (distance === 0) return 0
  const magnitude = 110 + (Math.abs(distance) - 1) * 70
  return Math.sign(distance) * magnitude
}

function lensStyleForDistance(distance) {
  const abs = Math.abs(distance)
  if (abs === 0) {
    return {
      fontSize: '21px',
      fontWeight: 500,
      color: 'var(--cp-text)',
      opacity: 1,
      textShadow: '0 0 24px rgba(155, 133, 216, 0.45)',
      letterSpacing: '0.01em'
    }
  }
  if (abs === 1) {
    return { fontSize: '12px', fontWeight: 400, color: 'var(--cp-text-faint)', opacity: 1, letterSpacing: '0.04em' }
  }
  if (abs === 2) {
    return { fontSize: '10px', fontWeight: 400, color: 'var(--cp-border-accent)', opacity: 1, letterSpacing: '0.04em' }
  }
  return { fontSize: '10px', fontWeight: 400, color: 'var(--cp-border-accent)', opacity: 0, letterSpacing: '0.04em' }
}

function initialsFrom(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '·'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

const PAGE_CSS = `
.cp-root {
  --cp-bg: #0c0a14;
  --cp-surface: #0f0d18;
  --cp-surface-2: #121020;
  --cp-border: #1e1a2e;
  --cp-border-accent: #2a2440;
  --cp-text: #e8e6f0;
  --cp-text-secondary: #c4c0d4;
  --cp-text-muted: #8b85a8;
  --cp-text-dim: #6b6488;
  --cp-text-faint: #4d4868;
  --cp-accent: #785dca;
  --cp-accent-light: #9b85d8;
  --cp-accent-dark: #5c42a8;
  --cp-accent-glow: rgba(120, 93, 202, 0.08);

  background: var(--cp-bg);
  color: var(--cp-text);
  font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  min-height: 100vh;
  position: relative;
  overflow-x: hidden;
}

/* The 2px line across the very top. Slow enough to register as ambient rather
   than as a loading bar. */
.cp-shimmer {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent 0%, var(--cp-accent-dark) 20%, var(--cp-accent-light) 50%, var(--cp-accent-dark) 80%, transparent 100%);
  background-size: 200% 100%;
  animation: cp-shimmer 9s ease-in-out infinite;
  z-index: 3;
}
@keyframes cp-shimmer {
  0%   { background-position: 100% 0; opacity: 0.5; }
  50%  { background-position: 0 0;    opacity: 1; }
  100% { background-position: -100% 0; opacity: 0.5; }
}

/* Drifting glow behind the header. Pointer-events off so it never eats a tap. */
.cp-orb {
  position: absolute;
  top: -140px;
  left: 50%;
  width: 520px;
  height: 520px;
  margin-left: -260px;
  border-radius: 9999px;
  background: radial-gradient(circle, rgba(120, 93, 202, 0.18) 0%, rgba(120, 93, 202, 0.06) 45%, transparent 70%);
  filter: blur(18px);
  animation: cp-drift 22s ease-in-out infinite;
  pointer-events: none;
  z-index: 0;
}
@keyframes cp-drift {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33%      { transform: translate(48px, 26px) scale(1.08); }
  66%      { transform: translate(-38px, 14px) scale(0.96); }
}

.cp-carousel-item {
  position: absolute;
  top: 50%;
  left: 50%;
  white-space: nowrap;
  cursor: pointer;
  background: none;
  border: 0;
  padding: 0;
  transition: transform 0.4s cubic-bezier(0.25, 0.1, 0.25, 1),
              font-size 0.4s cubic-bezier(0.25, 0.1, 0.25, 1),
              color 0.4s cubic-bezier(0.25, 0.1, 0.25, 1),
              opacity 0.4s cubic-bezier(0.25, 0.1, 0.25, 1),
              text-shadow 0.4s cubic-bezier(0.25, 0.1, 0.25, 1);
}

.cp-underline {
  transition: width 0.4s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.4s cubic-bezier(0.25, 0.1, 0.25, 1);
}

.cp-fade { transition: opacity ${CROSSFADE_MS}ms ease; }

@media (prefers-reduced-motion: reduce) {
  .cp-shimmer, .cp-orb { animation: none; }
  .cp-carousel-item, .cp-underline, .cp-fade { transition: none; }
}
`

export default function CareerProfilePage() {
  const params = useParams()
  const slug = params?.slug

  const [data, setData] = useState(null)
  const [loadState, setLoadState] = useState('loading')
  const [activeIndex, setActiveIndex] = useState(0)
  const [contentIndex, setContentIndex] = useState(0)
  const [fading, setFading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState(null)

  const dragRef = useRef({ startX: null, dragging: false })

  useEffect(() => {
    if (!slug) return
    let cancelled = false

    async function load() {
      try {
        // The token is optional and only ever used to decide whether to show
        // owner controls. A viewer without one gets the identical page.
        let headers = {}
        try {
          const supabase = createClient()
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.access_token) headers = { Authorization: `Bearer ${session.access_token}` }
        } catch {
          // Not signed in, or no client available. Neither is a problem here.
        }

        const res = await fetch(`/api/career-profile/${encodeURIComponent(slug)}`, { headers })
        if (cancelled) return
        if (res.status === 404) { setLoadState('notfound'); return }
        if (!res.ok) { setLoadState('error'); return }

        const json = await res.json()
        if (cancelled) return
        setData(json)
        setLoadState('ready')
      } catch (err) {
        console.error('Career profile load failed:', err)
        if (!cancelled) setLoadState('error')
      }
    }

    load()
    return () => { cancelled = true }
  }, [slug])

  const lenses = useMemo(() => data?.lenses || [], [data])
  const hasCarousel = lenses.length > 1

  // The carousel moves immediately; the content below it crosses over. Swapping
  // both at once makes the whole page jump, which reads as a reload rather than
  // a change of view.
  useEffect(() => {
    if (activeIndex === contentIndex) return
    setFading(true)
    const timer = setTimeout(() => {
      setContentIndex(activeIndex)
      setFading(false)
    }, CROSSFADE_MS)
    return () => clearTimeout(timer)
  }, [activeIndex, contentIndex])

  function moveBy(step) {
    setActiveIndex(prev => {
      const next = prev + step
      if (next < 0 || next > lenses.length - 1) return prev
      return next
    })
  }

  function onDragStart(clientX) {
    dragRef.current = { startX: clientX, dragging: true }
  }

  function onDragEnd(clientX) {
    const { startX, dragging } = dragRef.current
    dragRef.current = { startX: null, dragging: false }
    if (!dragging || startX === null || clientX === null) return
    const dx = clientX - startX
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return
    // Dragging left pulls the next lens into the spotlight.
    moveBy(dx < 0 ? 1 : -1)
  }

  const activeLens = lenses[contentIndex] || null
  const proofPoints = Array.isArray(activeLens?.proof_points) ? activeLens.proof_points : []
  const hasGeneratedContent = Boolean(activeLens?.headline || activeLens?.bio || proofPoints.length > 0)

  const displayName = data?.person?.displayName || 'Career Profile'
  const fallbackHeadline = data?.careerContext?.target_roles?.length
    ? data.careerContext.target_roles.join(' · ')
    : data?.careerContext?.current_lens_name || ''
  const headline = activeLens?.headline || fallbackHeadline

  async function handleGenerate() {
    if (!activeLens || generating) return
    setGenerating(true)
    setGenerateError(null)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/career-profile/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify({ lensId: activeLens.id })
      })
      if (!res.ok) throw new Error('Generation failed')
      const { lens } = await res.json()
      setData(prev => prev ? {
        ...prev,
        lenses: prev.lenses.map(l => (l.id === lens.id ? { ...l, ...lens } : l))
      } : prev)
    } catch (err) {
      console.error('Profile generation failed:', err)
      setGenerateError("We couldn't build this profile just now. Please try again.")
    } finally {
      setGenerating(false)
    }
  }

  // ---- SHELLS ----
  if (loadState === 'loading') {
    return (
      <div className="cp-root flex items-center justify-center">
        <style>{PAGE_CSS}</style>
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-solid" style={{ borderColor: 'var(--cp-border-accent)', borderRightColor: 'transparent' }} />
      </div>
    )
  }

  if (loadState === 'notfound' || loadState === 'error') {
    return (
      <div className="cp-root flex items-center justify-center px-6 text-center">
        <style>{PAGE_CSS}</style>
        <div>
          <p className="text-base md:text-sm" style={{ color: 'var(--cp-text-secondary)' }}>
            {loadState === 'notfound' ? 'This profile is not available.' : "We couldn't load this profile."}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="cp-root">
      <style>{PAGE_CSS}</style>
      <div className="cp-shimmer" />

      {/* ---- BRANDED HEADER BAR ---- */}
      <header
        className="relative z-10 w-full border-b"
        style={{ borderColor: 'var(--cp-border)', background: 'rgba(15, 13, 24, 0.72)', backdropFilter: 'blur(8px)' }}
      >
        <div className="mx-auto flex max-w-[800px] items-center justify-between px-5 py-3 md:px-8">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="var(--cp-accent-light)" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span
              className="text-[11px] font-bold uppercase md:text-[10px]"
              style={{ color: 'var(--cp-text)', letterSpacing: '0.16em' }}
            >
              Hire Power
            </span>
          </div>

          <DownloadButton
            resume={data?.lensResumes?.[activeLens?.core_resume_id] || data?.coreResume || null}
            isOwner={data?.isOwner}
          />
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-[800px] px-5 pb-20 md:px-8">
        <div className="cp-orb" aria-hidden="true" />

        {/* ---- PROFILE HEADER ---- */}
        <section className="relative z-10 flex items-center gap-4 pt-10 md:pt-12">
          <div
            className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full text-base font-semibold md:text-sm"
            style={{
              background: 'linear-gradient(to bottom right, var(--cp-accent), var(--cp-accent-dark))',
              color: '#fff',
              boxShadow: '0 0 28px rgba(120, 93, 202, 0.28)'
            }}
            aria-hidden="true"
          >
            {initialsFrom(displayName)}
          </div>

          <div className="min-w-0">
            <h1
              className="truncate text-[28px] leading-tight md:text-[28px]"
              style={{ color: '#fff', fontWeight: 500, letterSpacing: '-0.01em' }}
            >
              {displayName}
            </h1>
            <p
              className="cp-fade mt-1 text-[11px] uppercase md:text-[10px]"
              style={{ color: 'var(--cp-text-muted)', letterSpacing: '0.14em', opacity: fading ? 0 : 1 }}
            >
              {headline}
            </p>
          </div>
        </section>

        {/* ---- LENS SELECTOR ---- */}
        {lenses.length > 0 && (
          hasCarousel ? (
            <section className="relative z-10 mt-10 md:mt-12" aria-label="Career directions">
              <div
                className="relative h-[68px] w-full select-none overflow-hidden"
                onTouchStart={(e) => onDragStart(e.touches[0].clientX)}
                onTouchEnd={(e) => onDragEnd(e.changedTouches[0]?.clientX ?? null)}
                onMouseDown={(e) => onDragStart(e.clientX)}
                onMouseUp={(e) => onDragEnd(e.clientX)}
                onMouseLeave={() => { dragRef.current = { startX: null, dragging: false } }}
              >
                {lenses.map((lens, index) => {
                  const distance = index - activeIndex
                  const style = lensStyleForDistance(distance)
                  return (
                    <button
                      key={lens.id}
                      type="button"
                      className="cp-carousel-item"
                      aria-current={distance === 0 ? 'true' : undefined}
                      onClick={() => setActiveIndex(index)}
                      style={{
                        ...style,
                        transform: `translate(calc(-50% + ${offsetForDistance(distance)}px), -50%)`,
                        pointerEvents: Math.abs(distance) > 2 ? 'none' : 'auto'
                      }}
                    >
                      {lens.name}
                    </button>
                  )
                })}
              </div>

              <div className="flex justify-center">
                <div
                  className="cp-underline h-[2px] rounded-full"
                  style={{ width: '54px', background: 'linear-gradient(90deg, transparent, var(--cp-accent-light), transparent)' }}
                />
              </div>

              <div className="mt-4 flex justify-center gap-1.5">
                {lenses.map((lens, index) => (
                  <button
                    key={`dot-${lens.id}`}
                    type="button"
                    aria-label={`Show ${lens.name}`}
                    onClick={() => setActiveIndex(index)}
                    className="h-1.5 w-1.5 rounded-full transition-colors"
                    style={{ background: index === activeIndex ? 'var(--cp-accent-light)' : 'var(--cp-border-accent)' }}
                  />
                ))}
              </div>
            </section>
          ) : (
            <section className="relative z-10 mt-10 text-center md:mt-12">
              <span
                className="text-[21px]"
                style={{ color: 'var(--cp-text)', fontWeight: 500, textShadow: '0 0 24px rgba(155, 133, 216, 0.45)' }}
              >
                {lenses[0].name}
              </span>
              <div className="mt-3 flex justify-center">
                <div
                  className="h-[2px] w-[54px] rounded-full"
                  style={{ background: 'linear-gradient(90deg, transparent, var(--cp-accent-light), transparent)' }}
                />
              </div>
            </section>
          )
        )}

        {/* ---- CONTENT ---- */}
        <div className="cp-fade relative z-10" style={{ opacity: fading ? 0 : 1 }}>
          {!activeLens ? (
            <p className="mt-14 text-center text-sm md:text-xs" style={{ color: 'var(--cp-text-muted)' }}>
              This profile has no published directions yet.
            </p>
          ) : !hasGeneratedContent ? (
            <div className="mt-14 text-center">
              <p className="text-base md:text-sm" style={{ color: 'var(--cp-text-secondary)' }}>
                This profile is being built.
              </p>
              {data?.isOwner && (
                <>
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={generating}
                    className="mt-5 rounded-full px-5 py-2 text-[13px] font-medium transition-opacity disabled:cursor-not-allowed disabled:opacity-50 md:text-xs"
                    style={{ background: 'linear-gradient(to right, var(--cp-accent), var(--cp-accent-dark))', color: '#fff' }}
                  >
                    {generating ? 'Generating…' : `Generate ${activeLens.name}`}
                  </button>
                  {generateError && (
                    <p className="mt-3 text-[12px] md:text-[11px]" style={{ color: '#e57373' }}>{generateError}</p>
                  )}
                </>
              )}
            </div>
          ) : (
            <>
              {/* ---- PROOF POINTS ---- */}
              {proofPoints.length > 0 && (
                <section className="mt-12 grid grid-cols-1 gap-3 md:mt-14 md:grid-cols-3">
                  {proofPoints.map((point, index) => (
                    <div
                      key={`${point?.num || 'point'}-${index}`}
                      className="rounded-xl border px-4 py-4 text-center"
                      style={{ borderColor: 'var(--cp-border-accent)', background: 'var(--cp-accent-glow)' }}
                    >
                      <div className="text-[22px] font-bold leading-none md:text-[20px]" style={{ color: '#fff' }}>
                        {point?.num}
                      </div>
                      <div
                        className="mt-2 text-[10px] uppercase md:text-[9px]"
                        style={{ color: 'var(--cp-text-muted)', letterSpacing: '0.12em' }}
                      >
                        {point?.label}
                      </div>
                    </div>
                  ))}
                </section>
              )}

              {/* ---- BIO ---- */}
              {activeLens.bio && (
                <section className="mt-12 md:mt-14">
                  <h2
                    className="text-[10px] uppercase md:text-[9px]"
                    style={{ color: 'var(--cp-accent-light)', letterSpacing: '0.2em' }}
                  >
                    About
                  </h2>
                  <div className="mt-3 space-y-4">
                    {String(activeLens.bio).split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => (
                      <p
                        key={index}
                        className="text-[15px] md:text-[14px]"
                        style={{ color: 'var(--cp-text-secondary)', lineHeight: 1.75 }}
                      >
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}

// The public download endpoint does not exist yet, so this is deliberately
// inert for a recruiter and explains itself on hover rather than failing on
// click. Part 2 gives it a route.
function DownloadButton({ resume, isOwner }) {
  const enabled = false
  return (
    <button
      type="button"
      disabled={!enabled}
      title={
        isOwner
          ? 'Public resume download is not wired up yet'
          : resume
          ? 'Resume download is coming soon'
          : 'No resume published yet'
      }
      className="rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-opacity md:text-[11px]"
      style={{
        borderColor: 'var(--cp-border-accent)',
        background: 'linear-gradient(to right, rgba(120, 93, 202, 0.22), rgba(92, 66, 168, 0.22))',
        color: 'var(--cp-text-secondary)',
        opacity: 0.6,
        cursor: 'not-allowed'
      }}
    >
      Download Resume
    </button>
  )
}
