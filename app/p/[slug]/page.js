'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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

// Size and weight by distance from the spotlight. Font size is deliberately not
// transitioned: it changes layout, and the carousel measures that layout to
// centre itself. Animating it would mean measuring a width that is still moving.
function lensStyleForDistance(distance) {
  const abs = Math.abs(distance)
  if (abs === 0) {
    return {
      fontSize: '22px',
      fontWeight: 500,
      color: '#fff',
      opacity: 1,
      padding: '0 20px',
      textShadow: '0 0 24px rgba(155, 133, 216, 0.45)',
      letterSpacing: '0.01em'
    }
  }
  if (abs === 1) {
    return { fontSize: '13px', fontWeight: 400, color: 'var(--cp-text-faint)', opacity: 1, padding: '0 16px', letterSpacing: '0.04em' }
  }
  return { fontSize: '11px', fontWeight: 400, color: 'var(--cp-border-accent)', opacity: 1, padding: '0 14px', letterSpacing: '0.04em' }
}

function initialsFrom(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '·'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

// skillsCategories is { [category]: string[] }. The profile shows one flat set
// rather than the resume's grouping, so a recruiter scans capability, not the
// way the resume happens to file it.
function flattenSkills(resumeData) {
  const categories = resumeData?.skillsCategories
  if (!categories || typeof categories !== 'object') return []
  const seen = new Set()
  const flat = []
  for (const value of Object.values(categories)) {
    const list = Array.isArray(value) ? value : [value]
    for (const skill of list) {
      const text = typeof skill === 'string' ? skill.trim() : ''
      const key = text.toLowerCase()
      if (!text || seen.has(key)) continue
      seen.add(key)
      flat.push(text)
    }
  }
  return flat
}

// A display cap only. The generation prompt asks for four sentences; anything
// written before that tightened still needs to fit the column without burying
// the sections under it. Cuts on a sentence, never mid thought, and returns
// null when there is no sentence break to cut on so nothing is ever mangled.
const BIO_COLLAPSE_AT = 600

function truncateAtSentence(text, limit) {
  const full = String(text || '')
  if (full.length <= limit) return null
  const window = full.slice(0, limit)
  const cut = Math.max(window.lastIndexOf('.'), window.lastIndexOf('!'), window.lastIndexOf('?'))
  if (cut === -1) return null
  return full.slice(0, cut + 1)
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

  background: var(--cp-bg);
  color: var(--cp-text);
  font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  min-height: 100vh;
  width: 100%;
  position: relative;
  overflow-x: hidden;
}

.cp-shimmer {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--cp-accent), transparent);
  animation: cp-pulse 3s ease-in-out infinite;
  z-index: 3;
}
@keyframes cp-pulse {
  0%, 100% { opacity: 0.35; }
  50%      { opacity: 1; }
}

/* Drifting glow behind the hero. Pointer-events off so it never eats a tap. */
.cp-orb {
  position: absolute;
  top: -60px;
  left: 50%;
  width: 240px;
  height: 240px;
  margin-left: -120px;
  border-radius: 9999px;
  background: radial-gradient(circle, rgba(120, 93, 202, 0.12) 0%, rgba(120, 93, 202, 0.04) 50%, transparent 70%);
  animation: cp-drift 22s ease-in-out infinite;
  pointer-events: none;
  z-index: 0;
}
@keyframes cp-drift {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33%      { transform: translate(46px, 22px) scale(1.08); }
  66%      { transform: translate(-36px, 12px) scale(0.96); }
}

/* The track slides; the items sit in normal flow inside it, so no two names can
   ever overlap no matter how long they are. */
.cp-track {
  display: flex;
  align-items: center;
  white-space: nowrap;
  width: max-content;
  transition: transform 0.4s cubic-bezier(0.25, 0.1, 0.25, 1);
}
.cp-lens {
  background: none;
  border: 0;
  cursor: pointer;
  white-space: nowrap;
  line-height: 1.2;
  transition: color 0.4s cubic-bezier(0.25, 0.1, 0.25, 1),
              opacity 0.4s cubic-bezier(0.25, 0.1, 0.25, 1),
              text-shadow 0.4s cubic-bezier(0.25, 0.1, 0.25, 1);
}

.cp-fade { transition: opacity ${CROSSFADE_MS}ms ease; }

.cp-skill { transition: border-color 0.2s ease, background 0.2s ease, color 0.2s ease; }
.cp-skill:hover {
  border-color: var(--cp-accent) !important;
  background: rgba(120, 93, 202, 0.1);
  color: var(--cp-text-secondary);
}

@media (prefers-reduced-motion: reduce) {
  .cp-shimmer, .cp-orb { animation: none; }
  .cp-track, .cp-lens, .cp-fade, .cp-skill { transition: none; }
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
  const [trackShift, setTrackShift] = useState(0)
  const [bioExpanded, setBioExpanded] = useState(false)

  const dragRef = useRef({ startX: null, dragging: false })
  const viewportRef = useRef(null)
  const itemRefs = useRef([])

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
      setBioExpanded(false)
      setFading(false)
    }, CROSSFADE_MS)
    return () => clearTimeout(timer)
  }, [activeIndex, contentIndex])

  // Centre the active name by measuring where it actually landed, rather than
  // guessing an offset. A long direction name and a short one then behave the
  // same, and nothing is ever clipped at either end of the row.
  useLayoutEffect(() => {
    function centre() {
      const viewport = viewportRef.current
      const item = itemRefs.current[activeIndex]
      if (!viewport || !item) return
      setTrackShift(viewport.offsetWidth / 2 - (item.offsetLeft + item.offsetWidth / 2))
    }
    centre()
    window.addEventListener('resize', centre)
    return () => window.removeEventListener('resize', centre)
  }, [activeIndex, lenses.length, loadState])

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

  const selectedLens = lenses[contentIndex] || null
  const proofPoints = Array.isArray(selectedLens?.proof_points) ? selectedLens.proof_points : []
  const readyTags = Array.isArray(selectedLens?.ready_tags) ? selectedLens.ready_tags : []
  const hasGeneratedContent = Boolean(selectedLens?.headline || selectedLens?.bio || proofPoints.length > 0)

  const displayName = data?.person?.displayName || data?.fallback?.name || 'Career Profile'
  // The generated headline is written for this direction, so it wins. Target
  // roles are only the stand-in for a lens that has not been generated yet.
  const fallbackHeadline = data?.careerContext?.target_roles?.length
    ? data.careerContext.target_roles.join(' · ')
    : data?.careerContext?.current_lens_name || ''
  const headline = selectedLens?.headline || fallbackHeadline

  // The lens has its own core resume once it is built. Until then the priority
  // core is the right source: same career, just not yet recut for this lens.
  const lensResume = data?.lensResumes?.[selectedLens?.core_resume_id] || null
  const activeResume = lensResume || data?.coreResume || null
  const skills = useMemo(() => flattenSkills(activeResume?.resume_data), [activeResume])

  const fullBio = selectedLens?.bio || ''
  const collapsedBio = useMemo(() => truncateAtSentence(fullBio, BIO_COLLAPSE_AT), [fullBio])
  const bioToShow = collapsedBio && !bioExpanded ? collapsedBio : fullBio

  const imowText = data?.profile?.imow_text || null

  async function handleGenerate() {
    if (!selectedLens || generating) return
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
        body: JSON.stringify({ lensId: selectedLens.id })
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

  // ---- LOADING / ERROR ----
  if (loadState === 'loading') {
    return (
      <div className="cp-root flex items-center justify-center">
        <style>{PAGE_CSS}</style>
        <div
          className="h-6 w-6 animate-spin rounded-full border-2 border-solid"
          style={{ borderColor: 'var(--cp-border-accent)', borderRightColor: 'transparent' }}
        />
      </div>
    )
  }

  if (loadState === 'notfound' || loadState === 'error') {
    return (
      <div className="cp-root flex items-center justify-center px-6 text-center">
        <style>{PAGE_CSS}</style>
        <p style={{ color: 'var(--cp-text-secondary)', fontSize: '14px' }}>
          {loadState === 'notfound' ? 'Profile not found' : "We couldn't load this profile."}
        </p>
      </div>
    )
  }

  const sectionLabel = { color: 'var(--cp-accent)', fontSize: '11px', fontWeight: 500, letterSpacing: '1.4px' }

  return (
    <div className="cp-root">
      <style>{PAGE_CSS}</style>
      <div className="cp-shimmer" />

      {/* ---- HEADER BAR ---- */}
      <header className="w-full border-b" style={{ borderColor: 'var(--cp-border)' }}>
        <div className="mx-auto flex max-w-[1100px] items-center justify-between px-5 py-[14px] md:px-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/hp-logo-white.png" alt="Hire Power" style={{ height: '40px', width: 'auto' }} />
          <DownloadButton resume={activeResume} isOwner={data?.isOwner} />
        </div>
      </header>

      {/* ---- HERO ---- */}
      <section className="relative mx-auto max-w-[1100px] px-5 pb-8 pt-11 md:px-6">
        <div className="cp-orb" aria-hidden="true" />

        <div className="relative z-10 flex items-center gap-4">
          <div
            className="flex h-14 w-14 flex-shrink-0 items-center justify-center text-base font-semibold"
            style={{
              borderRadius: '8px',
              background: 'linear-gradient(to bottom right, var(--cp-accent), var(--cp-accent-dark))',
              color: '#fff'
            }}
            aria-hidden="true"
          >
            {initialsFrom(displayName)}
          </div>

          <div className="min-w-0">
            <h1
              className="truncate text-[28px] md:text-[38px]"
              style={{ color: '#fff', fontWeight: 500, lineHeight: 1.12, letterSpacing: '-0.5px' }}
            >
              {displayName}
            </h1>
            <p
              className="cp-fade mt-1.5"
              style={{ fontSize: '14px', color: 'var(--cp-text-muted)', opacity: fading ? 0 : 1 }}
            >
              {headline}
            </p>
          </div>
        </div>
      </section>

      {/* ---- LENS CAROUSEL ----
          Full bleed rather than boxed with the hero, so the row of directions
          reads as spanning the page. */}
      {lenses.length > 0 && (
        hasCarousel ? (
          <section className="relative w-full pb-9" aria-label="Career directions">
            <div
              ref={viewportRef}
              className="relative h-[64px] w-full select-none overflow-hidden"
              onTouchStart={(e) => onDragStart(e.touches[0].clientX)}
              onTouchEnd={(e) => onDragEnd(e.changedTouches[0]?.clientX ?? null)}
              onMouseDown={(e) => onDragStart(e.clientX)}
              onMouseUp={(e) => onDragEnd(e.clientX)}
              onMouseLeave={() => { dragRef.current = { startX: null, dragging: false } }}
            >
              <div className="cp-track h-full" style={{ transform: `translateX(${trackShift}px)` }}>
                {lenses.map((lens, index) => {
                  const distance = index - activeIndex
                  return (
                    <button
                      key={lens.id}
                      ref={(el) => { itemRefs.current[index] = el }}
                      type="button"
                      className="cp-lens"
                      aria-current={distance === 0 ? 'true' : undefined}
                      onClick={() => setActiveIndex(index)}
                      style={lensStyleForDistance(distance)}
                    >
                      {lens.name}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex justify-center">
              <div
                className="h-[2px] w-[54px] rounded-full"
                style={{ background: 'linear-gradient(90deg, transparent, var(--cp-accent-light), transparent)' }}
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
          <section className="w-full pb-9 text-center">
            <span style={{ fontSize: '22px', color: '#fff', fontWeight: 500, textShadow: '0 0 24px rgba(155, 133, 216, 0.45)' }}>
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

      <div className="cp-fade" style={{ opacity: fading ? 0 : 1 }}>

        {/* ---- PROOF POINTS ---- */}
        {proofPoints.length > 0 && (
          <section className="mx-auto max-w-[1100px] border-y" style={{ borderColor: 'var(--cp-border)' }}>
            <div className="grid grid-cols-3">
              {proofPoints.map((point, index) => (
                <div
                  key={`${point?.num || 'point'}-${index}`}
                  className="px-3 py-9 text-center md:px-5"
                  style={index > 0 ? { borderLeft: '1px solid var(--cp-border)' } : undefined}
                >
                  <div style={{ fontSize: '32px', fontWeight: 500, color: '#fff', lineHeight: 1.1 }}>
                    {point?.num}
                  </div>
                  <div
                    className="mt-2"
                    style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.7px', color: 'var(--cp-text-dim)' }}
                  >
                    {point?.label}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ---- BIO + IN MY OWN WORDS ---- */}
        <section className="mx-auto max-w-[1100px] border-b" style={{ borderColor: 'var(--cp-border)' }}>
          <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr]">
            <div
              className="border-b px-5 py-10 md:border-b-0 md:border-r md:pl-6 md:pr-7"
              style={{ borderColor: 'var(--cp-border)' }}
            >
              {/* Deliberately larger than every other section label, so the
                  written bio reads as the primary voice and the quote beside it
                  as the aside. */}
              <div style={{ ...sectionLabel, fontSize: '18px', marginBottom: '14px' }}>Bio</div>

              {selectedLens?.bio ? (
                <div className="space-y-4">
                  {bioToShow.split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => (
                    <p key={index} style={{ fontSize: '13px', lineHeight: 1.85, color: 'var(--cp-text-secondary)' }}>
                      {paragraph}
                    </p>
                  ))}
                  {collapsedBio && (
                    <button
                      type="button"
                      onClick={() => setBioExpanded(value => !value)}
                      style={{ fontSize: '11px', fontWeight: 500, color: 'var(--cp-accent-light)', letterSpacing: '0.4px' }}
                    >
                      {bioExpanded ? 'Read less' : 'Read more'}
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: '13px', lineHeight: 1.85, color: 'var(--cp-text-muted)' }}>
                    {hasGeneratedContent ? 'No bio yet for this direction.' : 'This profile is being built.'}
                  </p>
                  {data?.isOwner && selectedLens && (
                    <>
                      <button
                        type="button"
                        onClick={handleGenerate}
                        disabled={generating}
                        className="mt-5 transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
                        style={{
                          background: 'linear-gradient(to right, var(--cp-accent), var(--cp-accent-dark))',
                          color: '#fff',
                          fontSize: '11px',
                          padding: '7px 20px',
                          borderRadius: '3px'
                        }}
                      >
                        {generating ? 'Generating…' : `Generate ${selectedLens.name}`}
                      </button>
                      {generateError && (
                        <p className="mt-3" style={{ fontSize: '11px', color: '#e57373' }}>{generateError}</p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Sized for a 16:9 clip that will live here later, so adding video
                does not change the shape of the page. */}
            <div
              className="px-5 py-9 md:pl-7 md:pr-6"
              style={{ background: 'var(--cp-surface)', minHeight: '200px' }}
            >
              <div style={{ ...sectionLabel, marginBottom: '14px' }}>In my own words</div>
              {imowText ? (
                <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '17px', lineHeight: 1.7, color: 'var(--cp-text)' }}>
                  {`"${imowText}"`}
                </p>
              ) : data?.isOwner ? (
                <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '17px', lineHeight: 1.7, color: 'var(--cp-text-faint)' }}>
                  Add your personal statement.
                </p>
              ) : null}
            </div>
          </div>
        </section>

        {/* ---- OPEN TO ---- */}
        {(readyTags.length > 0 || selectedLens?.ready_for_next) && (
          <section className="mx-auto max-w-[1100px] border-b" style={{ borderColor: 'var(--cp-border)' }}>
            <div className="flex flex-wrap items-center gap-4 px-5 py-7 md:px-6">
              <span style={{ fontSize: '13px', fontWeight: 500, color: '#fff' }}>Open to</span>
              <span className="hidden md:block" style={{ width: '1px', height: '20px', background: 'var(--cp-border-accent)' }} />
              {readyTags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {readyTags.map((tag, index) => (
                    <span
                      key={`${tag}-${index}`}
                      style={{
                        fontSize: '11px',
                        padding: '4px 12px',
                        border: '1px solid var(--cp-border-accent)',
                        borderRadius: '3px',
                        color: 'var(--cp-accent-light)'
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : (
                <span style={{ fontSize: '12px', color: 'var(--cp-text-muted)' }}>{selectedLens.ready_for_next}</span>
              )}
            </div>
          </section>
        )}

        {/* ---- SKILLS ---- */}
        {skills.length > 0 && (
          <section className="mx-auto max-w-[1100px] border-b" style={{ borderColor: 'var(--cp-border)' }}>
            <div className="px-5 py-10 md:px-6">
              <div style={{ ...sectionLabel, marginBottom: '16px' }}>Skills</div>
              <div className="flex flex-wrap gap-2">
                {skills.map((skill, index) => (
                  <span
                    key={`${skill}-${index}`}
                    className="cp-skill"
                    style={{
                      fontSize: '11px',
                      fontWeight: 500,
                      padding: '5px 14px',
                      border: '1px solid var(--cp-border)',
                      borderRadius: '3px',
                      color: 'var(--cp-text-muted)'
                    }}
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

// The public download endpoint does not exist yet, so this is deliberately
// inert for a recruiter and explains itself on hover rather than failing on
// click. Part 2 gives it a route.
function DownloadButton({ resume, isOwner }) {
  return (
    <button
      type="button"
      disabled
      title={
        isOwner
          ? 'Public resume download is not wired up yet'
          : resume
          ? 'Resume download is coming soon'
          : 'No resume published yet'
      }
      style={{
        background: 'linear-gradient(to right, var(--cp-accent), var(--cp-accent-dark))',
        color: '#fff',
        fontSize: '11px',
        padding: '7px 20px',
        borderRadius: '3px',
        opacity: 0.55,
        cursor: 'not-allowed'
      }}
    >
      Download resume
    </button>
  )
}
