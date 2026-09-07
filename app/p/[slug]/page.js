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
// 0.385s up + 0.22s held + 0.495s back. Must match the lensZoom keyframe.
const LENS_ZOOM_MS = 1100

// Rank at rest is size and colour: the chosen lens sits at 1.3, its neighbours
// at 1.0 and the rest at 0.85, and the transition on .cp-lens carries them
// between those. Scaling rather than restyling the font keeps the row's layout
// fixed, so the carousel can still measure it to centre itself, and the whole
// thing runs on the compositor. Selecting a lens also fires the one-shot
// lensZoom over the top, which lands on 1.3 so the handover is invisible.
function lensStyleForDistance(distance) {
  const abs = Math.abs(distance)
  if (abs === 0) {
    return {
      transform: 'scale(1.3)',
      color: '#fff',
      opacity: 1,
      textShadow: '0 0 30px rgba(120, 93, 202, 0.5)'
    }
  }
  if (abs === 1) {
    return { transform: 'scale(1)', color: 'var(--cp-text-faint)', opacity: 1 }
  }
  return { transform: 'scale(0.85)', color: 'var(--cp-border-accent)', opacity: 1 }
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

// Resume dates arrive in whatever shape the builder stored them: "2025-03",
// "2025-03-01", "March 2025", a bare year. A profile is the wrong place to show
// a recruiter something that reads like a database column, so each end is
// normalised to "Mar 2025", and anything unrecognised passes through untouched
// rather than mangled.
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_LOOKUP = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10,
  dec: 11, december: 11
}

function formatResumeDate(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  if (/^(present|current|now|ongoing|to date)$/i.test(text)) return 'Present'

  // 2025-03, 2025-03-01, 2025/03
  const yearFirst = text.match(/^(\d{4})[-/](\d{1,2})(?:[-/]\d{1,2})?$/)
  if (yearFirst) {
    const month = Number(yearFirst[2]) - 1
    if (month >= 0 && month <= 11) return `${MONTH_NAMES[month]} ${yearFirst[1]}`
  }

  // 03/2025, 3-2025
  const monthFirst = text.match(/^(\d{1,2})[-/](\d{4})$/)
  if (monthFirst) {
    const month = Number(monthFirst[1]) - 1
    if (month >= 0 && month <= 11) return `${MONTH_NAMES[month]} ${monthFirst[2]}`
  }

  // March 2025, Mar. 2025
  const named = text.match(/^([A-Za-z]+)\.?\s+(\d{4})$/)
  if (named) {
    const month = MONTH_LOOKUP[named[1].toLowerCase()]
    if (month !== undefined) return `${MONTH_NAMES[month]} ${named[2]}`
  }

  return text
}

// Experience rows keep their dates in two fields plus a `current` flag, and the
// field names have drifted over the life of the builder. Some rows carry the
// whole range as one written string instead, so that is split on its dash and
// each end formatted the same way. A role with no date at all reads better as
// an empty column than as a stray dash.
function dateRangeFor(job) {
  const start = formatResumeDate(job?.startDate || job?.start_date)
  const end = job?.current || job?.is_current
    ? 'Present'
    : formatResumeDate(job?.endDate || job?.end_date)
  if (start && end) return `${start} - ${end}`
  if (start || end) return start || end

  const combined = String(job?.dates || job?.date || job?.period || '').trim()
  if (!combined) return ''
  const parts = combined.split(/\s+(?:[-\u2013\u2014]|to)\s+/i).filter(Boolean)
  if (parts.length === 2) return `${formatResumeDate(parts[0])} - ${formatResumeDate(parts[1])}`
  return formatResumeDate(combined)
}

// A role's detail has been stored under two names over the life of the builder,
// and some roles carry a written summary instead of bullets. All of it ends up
// as one list so the card does not have to care which shape it was handed. The
// summary leads, because it is the line the role is actually about, and the
// card highlights whatever comes first.
function bulletsFor(job) {
  const raw = Array.isArray(job?.bullets)
    ? job.bullets
    : Array.isArray(job?.achievements)
    ? job.achievements
    : []
  const list = raw.map(b => (typeof b === 'string' ? b.trim() : '')).filter(Boolean)
  const summary = typeof job?.summary === 'string' ? job.summary.trim() : ''
  return summary ? [summary, ...list] : list
}

// Evidence is tinted and iconed by media_class. Anything unrecognised still
// gets a card, just the neutral one: a link holder should never see a gap where
// a piece of evidence is meant to be.
const EVIDENCE_VISUALS = {
  image: { tint: 'rgba(120, 93, 202, 0.14)', paths: ['M4 5h16v14H4z', 'M4 15l4-4 3 3 4-4 5 5'] },
  video: { tint: 'rgba(155, 133, 216, 0.16)', paths: ['M3 6h12v12H3z', 'M15 10l6-3v10l-6-3z'] },
  audio: { tint: 'rgba(92, 66, 168, 0.22)', paths: ['M9 17V5l10-2v12'] },
  document: { tint: 'rgba(120, 93, 202, 0.10)', paths: ['M6 3h8l4 4v14H6z', 'M14 3v4h4'] },
  link: {
    tint: 'rgba(155, 133, 216, 0.10)',
    paths: ['M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1', 'M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1']
  }
}
const EVIDENCE_FALLBACK = { tint: 'rgba(120, 93, 202, 0.10)', paths: ['M5 4h14v16H5z'] }

function evidenceVisual(item) {
  const key = String(item?.media_class || item?.kind || '').toLowerCase()
  return EVIDENCE_VISUALS[key] || EVIDENCE_FALLBACK
}

const CERT_ICON_PATHS = ['M12 15a6 6 0 100-12 6 6 0 000 12z', 'M8.2 14L7 22l5-3 5 3-1.2-8']
const CARET_ICON_PATHS = ['M9 6l6 6-6 6']
const ASK_ICON_PATHS = ['M12 4c4.42 0 8 2.91 8 6.5s-3.58 6.5-8 6.5c-.8 0-1.58-.1-2.3-.28L5 19l1.15-3.1C4.83 14.7 4 12.7 4 10.5 4 6.91 7.58 4 12 4z']
const EVALUATE_ICON_PATHS = [
  'M5 3h9l4 4v14H5z',
  'M10.4 12.6a2.8 2.8 0 105.6 0 2.8 2.8 0 00-5.6 0',
  'M15.7 16.5L18.2 19'
]

// One 24x24 stroke icon, drawn from whichever paths it is handed. Stroked
// rather than filled so every icon on the page carries the same weight.
function StrokeIcon({ paths, size = 18, color = 'var(--cp-accent-light)' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths.map((d, index) => <path key={index} d={d} />)}
    </svg>
  )
}

// What the owner sees where a section has nothing in it yet. A recruiter never
// sees it, so it is written as an invitation to fill the space rather than a
// notice that the space is empty: centred, given room, and carrying the action
// as a pill instead of a line of italics that reads like a warning.
function SectionPrompt({ text, action, hint }) {
  return (
    <div className="text-center" style={{ paddingTop: '40px', paddingBottom: '40px' }}>
      <span style={{ fontSize: '13px', lineHeight: 1.7, color: 'var(--cp-text-dim)' }}>{text}</span>
      <span className="cp-invite" title={hint}>{action}</span>
    </div>
  )
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

/* Large enough to read as the mark, held back so the name leads. */
.cp-logo {
  height: 40px;
  width: auto;
  opacity: 0.4;
  transition: opacity 0.3s ease;
}
.cp-logo:hover { opacity: 0.7; }

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

/* The header clips its own monogram, so the watermark cannot bleed into the
   row of directions below it. */
.cp-header { position: relative; overflow: hidden; }

/* The stage the carousel plays on. Clipped so the glow stays inside it. */
.cp-stage { position: relative; overflow: hidden; }

.cp-spotlight {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 500px;
  height: 320px;
  margin: -160px 0 0 -250px;
  background: radial-gradient(ellipse 50% 60% at 50% 30%, rgba(120, 93, 202, 0.12) 0%, rgba(120, 93, 202, 0.04) 35%, transparent 70%);
  pointer-events: none;
  z-index: 0;
}

/* The name and headline sit in their own relative box so the monogram behind
   them is positioned against the text, not against the section. */
.cp-namewrap { position: relative; display: inline-block; z-index: 1; }

/* The monogram is centred on this, not on the whole block, so it sits behind
   the name and never washes over the headline beneath it. */
.cp-nameline { position: relative; display: inline-block; padding: 4px 0; }

.cp-monogram {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 100px;
  font-weight: 500;
  letter-spacing: -6px;
  line-height: 1;
  white-space: nowrap;
  background: linear-gradient(180deg, rgba(120, 93, 202, 0.08) 0%, rgba(120, 93, 202, 0.05) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
  pointer-events: none;
  user-select: none;
  -webkit-user-select: none;
  z-index: 0;
}

.cp-name {
  position: relative;
  z-index: 1;
  font-weight: 500;
  letter-spacing: -0.3px;
  line-height: 1.15;
  color: #fff;
}

.cp-headline {
  position: relative;
  z-index: 1;
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* The track slides; the items sit in normal flow inside it, so no two names can
   ever overlap no matter how long they are. */
.cp-track {
  display: flex;
  align-items: center;
  white-space: nowrap;
  width: max-content;
  overflow: visible;
  transition: transform 0.4s cubic-bezier(0.25, 0.1, 0.25, 1);
}
.cp-lens {
  background: none;
  border: 0;
  cursor: pointer;
  white-space: nowrap;
  line-height: 1.2;
  font-size: 15px;
  font-weight: 500;
  letter-spacing: 0.01em;
  padding: 0 28px;
  position: relative;
  overflow: visible;
  max-width: none;
  transform-origin: center center;
  will-change: transform;
  transition: transform 0.8s cubic-bezier(0.25, 0.1, 0.25, 1),
              color 0.8s cubic-bezier(0.25, 0.1, 0.25, 1),
              text-shadow 0.8s cubic-bezier(0.25, 0.1, 0.25, 1),
              opacity 0.8s cubic-bezier(0.25, 0.1, 0.25, 1);
}

/* The focus pull: a lens swells past its resting size as it is chosen and
   settles onto it. Timed to LENS_ZOOM_MS - 0.33s out, 0.22s held, then 0.33s
   down to a slight undershoot and 0.22s easing back up onto the resting 1.3.
   The dip is what stops the landing reading as a snap. */
@keyframes lensZoom {
  0%   { transform: scale(1); }
  30%  { transform: scale(2); }
  50%  { transform: scale(2); }
  80%  { transform: scale(1.25); }
  100% { transform: scale(1.3); }
}
.cp-lens-zoom { animation: lensZoom 1100ms cubic-bezier(0.34, 1.56, 0.64, 1); }

/* The light that blooms behind the name as it is chosen. Centred on margins
   rather than a translate, the way .cp-spotlight is, so lensBurst owns the
   transform outright and the circle grows from its own centre. Invisible until
   the animation runs. */
.cp-burst {
  position: absolute;
  top: 50%;
  left: 50%;
  margin: -40px 0 0 -40px;
  display: block;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(120, 93, 202, 0.4) 0%, transparent 70%);
  opacity: 0;
  pointer-events: none;
  z-index: 0;
}
@keyframes lensBurst {
  0%   { transform: scale(0); opacity: 0; }
  30%  { transform: scale(1); opacity: 0.3; }
  60%  { transform: scale(2.5); opacity: 0.1; }
  100% { transform: scale(4); opacity: 0; }
}
.cp-lens-burst { animation: lensBurst 1100ms cubic-bezier(0.25, 0.1, 0.25, 1); }

/* The name rides above the burst. */
.cp-lens-label { position: relative; z-index: 1; }

.cp-fade { transition: opacity ${CROSSFADE_MS}ms ease; }

.cp-skill { transition: border-color 0.2s ease, background 0.2s ease, color 0.2s ease; }
.cp-skill:hover {
  border-color: var(--cp-accent) !important;
  background: rgba(120, 93, 202, 0.1);
  color: var(--cp-text-secondary);
}

/* A role card lifts its border so it reads as something that opens, and the
   caret turns as it does. */
.cp-role { transition: border-color 0.2s ease; }
.cp-role:hover { border-color: var(--cp-border-accent); }
.cp-caret { display: inline-flex; transition: transform 0.2s ease; }
.cp-caret-open { transform: rotate(90deg); }

.cp-ev { transition: transform 0.2s ease, border-color 0.2s ease; }
.cp-ev:hover { transform: translateY(-2px); border-color: var(--cp-accent); }

/* The question box and the job description box share one look. Neither is
   wired to anything yet, so the focus ring is the only thing that answers. */
.cp-field {
  display: block;
  width: 100%;
  background: var(--cp-surface-2);
  border: 1px solid var(--cp-border-accent);
  border-radius: 3px;
  color: var(--cp-text);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.cp-field:focus {
  outline: none;
  border-color: var(--cp-accent);
  box-shadow: 0 0 0 1px var(--cp-accent), 0 0 12px rgba(120, 93, 202, 0.15);
}

/* The action on an empty section. A pill rather than a link, so what the owner
   sees in a section they have not filled yet is an offer, not a fault. */
.cp-invite {
  display: inline-block;
  margin-left: 8px;
  padding: 4px 14px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  color: var(--cp-accent);
  background: rgba(120, 93, 202, 0.1);
  cursor: default;
  transition: background 0.2s ease;
}
.cp-invite:hover { background: rgba(120, 93, 202, 0.2); }
.cp-field::placeholder { color: var(--cp-text-faint); }
.cp-field:disabled { cursor: not-allowed; }

@media (prefers-reduced-motion: reduce) {
  .cp-shimmer { animation: none; }
  /* .cp-lens is deliberately absent: the zoom is how the carousel reads, so it's
     kept even here. */
  .cp-track, .cp-fade, .cp-skill, .cp-role, .cp-caret, .cp-ev, .cp-field, .cp-invite { transition: none; }
  .cp-ev:hover { transform: none; }
}
`

export default function CareerProfilePage() {
  const params = useParams()
  const slug = params?.slug

  const [data, setData] = useState(null)
  const [loadState, setLoadState] = useState('loading')
  const [activeIndex, setActiveIndex] = useState(0)
  const [animatingLensIndex, setAnimatingLensIndex] = useState(null)
  const [contentIndex, setContentIndex] = useState(0)
  const [fading, setFading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState(null)
  const [trackShift, setTrackShift] = useState(0)
  const [bioExpanded, setBioExpanded] = useState(false)
  const [expandedRole, setExpandedRole] = useState(null)

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

  useEffect(() => {
    if (animatingLensIndex === null) return
    const timer = setTimeout(() => setAnimatingLensIndex(null), LENS_ZOOM_MS)
    return () => clearTimeout(timer)
  }, [animatingLensIndex])

  // The carousel moves immediately; the content below it crosses over. Swapping
  // both at once makes the whole page jump, which reads as a reload rather than
  // a change of view.
  useEffect(() => {
    if (activeIndex === contentIndex) return
    setFading(true)
    const timer = setTimeout(() => {
      setContentIndex(activeIndex)
      setBioExpanded(false)
      setExpandedRole(null)
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

  function selectLens(index) {
    if (index === activeIndex) return
    setActiveIndex(index)
    setAnimatingLensIndex(index)
  }

  function moveBy(step) {
    const next = activeIndex + step
    if (next < 0 || next > lenses.length - 1) return
    selectLens(next)
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
  const hasOpenTo = readyTags.length > 0 || Boolean(selectedLens?.ready_for_next)
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

  // Experience, certifications and education follow the lens the page is
  // showing, and fall back to the priority core for a lens that has not been
  // built yet. The route resolved both, so this is only the pick between them.
  const lensSections = data?.resumeSections?.byLens?.[selectedLens?.id] || data?.resumeSections?.fallback || null
  const experience = Array.isArray(lensSections?.experience) ? lensSections.experience : []

  // Certifications have been written as bare strings as well as objects.
  const certifications = (Array.isArray(lensSections?.certifications) ? lensSections.certifications : [])
    .map(cert => (typeof cert === 'string' ? { name: cert } : cert))
    .filter(cert => cert && (cert.name || cert.title))

  // A testimonial with no text and a piece of evidence with neither a title nor
  // a link are not content, so they do not get to keep their sections open.
  const testimonials = (Array.isArray(data?.testimonials) ? data.testimonials : [])
    .filter(item => String(item?.polished_text || '').trim())
  const evidence = (Array.isArray(data?.evidence) ? data.evidence : [])
    .filter(item => item && (item.title || item.url))

  // The sample question reads better carrying the name the page is already
  // showing than a stranger's.
  const askName = String(data?.person?.displayName || data?.fallback?.name || '').trim().split(/\s+/)[0]
  const askPlaceholder = askName
    ? `Has ${askName} managed government contracts?`
    : 'Has this candidate managed government contracts?'

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

  const sectionLabel = { color: 'var(--cp-accent)', fontSize: '11px', fontWeight: 500, letterSpacing: '1.4px', textTransform: 'uppercase' }

  return (
    <div className="cp-root">
      <style>{PAGE_CSS}</style>
      <div className="cp-shimmer" />

      {/* ---- HEADER: the identity lives here now ---- */}
      <header className="cp-header w-full border-b" style={{ borderColor: 'var(--cp-border)' }}>
        <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-4" style={{ padding: '24px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/hire-power-logo-white-v2.png"
            alt="Hire Power"
            className="cp-logo flex-shrink-0"
          />

          <div className="min-w-0 flex-1 text-center">
            <div className="cp-namewrap">
              <div className="cp-nameline">
                <div className="cp-monogram" aria-hidden="true">{initialsFrom(displayName)}</div>
                <h1 className="cp-name text-[20px] md:text-[32px]">{displayName}</h1>
              </div>
              <p className="cp-fade cp-headline mt-1" style={{ opacity: fading ? 0 : 1 }}>
                {headline}
              </p>
            </div>
          </div>

          <div className="flex-shrink-0">
            <DownloadButton resume={activeResume} isOwner={data?.isOwner} />
          </div>
        </div>
      </header>

      {/* ---- THE CAROUSEL IS THE HERO ---- */}
      {lenses.length > 0 && (
        hasCarousel ? (
          <section className="cp-stage w-full" style={{ paddingTop: '48px', paddingBottom: '40px' }} aria-label="Career directions">
            <div className="cp-spotlight" aria-hidden="true" />
            <div
              ref={viewportRef}
              className="relative z-10 h-[100px] w-full select-none overflow-hidden"
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
                      className={index === animatingLensIndex ? 'cp-lens cp-lens-zoom' : 'cp-lens'}
                      aria-current={distance === 0 ? 'true' : undefined}
                      onClick={() => selectLens(index)}
                      style={lensStyleForDistance(distance)}
                    >
                      <span
                        className={index === animatingLensIndex ? 'cp-burst cp-lens-burst' : 'cp-burst'}
                        aria-hidden="true"
                      />
                      <span className="cp-lens-label">{lens.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="relative z-10 mt-6 flex justify-center gap-1.5">
              {lenses.map((lens, index) => (
                <button
                  key={`dot-${lens.id}`}
                  type="button"
                  aria-label={`Show ${lens.name}`}
                  onClick={() => selectLens(index)}
                  className="h-1.5 w-1.5 rounded-full transition-colors"
                  style={{ background: index === activeIndex ? 'var(--cp-accent-light)' : 'var(--cp-border-accent)' }}
                />
              ))}
            </div>
          </section>
        ) : (
          <section className="cp-stage w-full text-center" style={{ paddingTop: '48px', paddingBottom: '40px' }}>
            <div className="cp-spotlight" aria-hidden="true" />
            <span
              className="relative z-10"
              style={{ fontSize: '22px', color: '#fff', fontWeight: 500, textShadow: '0 0 24px rgba(155, 133, 216, 0.45)' }}
            >
              {lenses[0].name}
            </span>
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
                  className="px-3 py-7 text-center md:px-5"
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
              className="border-b px-5 py-7 md:border-b-0 md:border-r md:pl-6 md:pr-7"
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
                      style={{ fontSize: '11px', fontWeight: 500, color: 'var(--cp-accent)', letterSpacing: '0.4px' }}
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
              className="px-5 py-7 md:pl-7 md:pr-6"
              style={{ background: 'var(--cp-surface)', minHeight: '200px' }}
            >
              <div style={{ ...sectionLabel, marginBottom: '14px' }}>In my own words</div>
              {imowText ? (
                <p style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '17px', lineHeight: 1.7, color: 'var(--cp-text)' }}>
                  {`"${imowText}"`}
                </p>
              ) : data?.isOwner ? (
                <SectionPrompt
                  text="A line in your own voice sets the tone."
                  action="Add your personal statement"
                  hint="Personal statement editing is not wired up yet"
                />
              ) : null}
            </div>
          </div>
        </section>

        {/* ---- SKILLS ---- */}
        {skills.length > 0 && (
          <section className="mx-auto max-w-[1100px] border-b" style={{ borderColor: 'var(--cp-border)' }}>
            <div className="px-5 py-7 md:px-6">
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

        {/* ---- EXPERIENCE ---- */}
        {experience.length > 0 && (
          <section className="mx-auto max-w-[1100px] border-b" style={{ borderColor: 'var(--cp-border)' }}>
            <div style={{ padding: '26px 24px' }}>
              <div style={{ ...sectionLabel, marginBottom: '16px' }}>Experience</div>

              {experience.map((job, index) => {
                const bullets = bulletsFor(job)
                const isOpen = expandedRole === index
                return (
                  <div
                    key={`${job?.company || 'role'}-${index}`}
                    className="cp-role"
                    style={{
                      border: '1px solid var(--cp-border)',
                      background: 'var(--cp-surface)',
                      borderRadius: '3px',
                      marginBottom: '2px'
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedRole(isOpen ? null : index)}
                      aria-expanded={bullets.length > 0 ? isOpen : undefined}
                      disabled={bullets.length === 0}
                      className="grid w-full grid-cols-1 text-left md:grid-cols-[130px_1fr]"
                      style={{ cursor: bullets.length === 0 ? 'default' : 'pointer' }}
                    >
                      <div
                        className="border-b md:border-b-0 md:border-r"
                        style={{
                          background: 'var(--cp-surface)',
                          borderColor: 'var(--cp-border)',
                          padding: '12px 14px',
                          fontSize: '11px',
                          color: 'var(--cp-text-muted)'
                        }}
                      >
                        {dateRangeFor(job)}
                      </div>

                      <div className="flex items-center justify-between gap-3" style={{ padding: '12px 16px' }}>
                        <div className="min-w-0">
                          <div style={{ fontSize: '14px', fontWeight: 500, color: '#fff' }}>
                            {job?.title || 'Role'}
                          </div>
                          {job?.company && (
                            <div className="mt-0.5" style={{ fontSize: '11px', color: 'var(--cp-text-muted)' }}>
                              {job.company}
                            </div>
                          )}
                        </div>
                        {bullets.length > 0 && (
                          <span className={isOpen ? 'cp-caret cp-caret-open flex-shrink-0' : 'cp-caret flex-shrink-0'}>
                            <StrokeIcon paths={CARET_ICON_PATHS} size={14} color="var(--cp-text-faint)" />
                          </span>
                        )}
                      </div>
                    </button>

                    {isOpen && bullets.length > 0 && (
                      <div className="px-4 pb-4 md:pl-[146px] md:pr-6">
                        {/* The first line is the one the role is remembered for,
                            so it is lit rather than listed. */}
                        <div
                          style={{
                            borderLeft: '2px solid var(--cp-accent)',
                            background: 'rgba(120, 93, 202, 0.08)',
                            borderRadius: '0 3px 3px 0',
                            padding: '10px 14px',
                            fontSize: '12.5px',
                            lineHeight: 1.7,
                            color: 'var(--cp-text-secondary)'
                          }}
                        >
                          {bullets[0]}
                        </div>

                        {bullets.length > 1 && (
                          <ul className="mt-3 space-y-2">
                            {bullets.slice(1).map((bullet, bulletIndex) => (
                              <li
                                key={bulletIndex}
                                className="flex gap-2.5"
                                style={{ fontSize: '12px', lineHeight: 1.7, color: 'var(--cp-text-muted)' }}
                              >
                                <span style={{ color: 'var(--cp-accent)' }} aria-hidden="true">&middot;</span>
                                <span>{bullet}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ---- TESTIMONIALS + IMPACT ---- */}
        {(testimonials.length > 0 || data?.isOwner) && (
          <section className="mx-auto max-w-[1100px] border-b" style={{ borderColor: 'var(--cp-border)' }}>
            <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr]">
              <div
                className="border-b md:border-b-0 md:border-r"
                style={{ borderColor: 'var(--cp-border)', padding: '26px 24px' }}
              >
                <div style={{ ...sectionLabel, marginBottom: testimonials.length > 0 ? '18px' : '8px' }}>Testimonials</div>
                {testimonials.length === 0 && (
                  <SectionPrompt
                    text="Request testimonials to build social proof."
                    action="Request"
                    hint="Testimonial requests are not wired up yet"
                  />
                )}
                {testimonials.map((item, index) => {
                  const isLast = index === testimonials.length - 1
                  const attribution = [item?.recipient_name, item?.recipient_title].filter(Boolean).join(', ')
                  return (
                    <div
                      key={item?.id || index}
                      style={{
                        paddingTop: index === 0 ? 0 : '18px',
                        paddingBottom: isLast ? 0 : '18px',
                        borderBottom: isLast ? 'none' : '1px solid var(--cp-border)'
                      }}
                    >
                      <p style={{ fontStyle: 'italic', fontSize: '14px', lineHeight: 1.8, color: 'var(--cp-text-secondary)' }}>
                        {`"${item.polished_text}"`}
                      </p>
                      {attribution && (
                        <div className="mt-3" style={{ fontSize: '11px', color: 'var(--cp-accent)' }}>
                          {attribution}
                        </div>
                      )}
                      {item?.relationship && (
                        <div
                          className="mt-1"
                          style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--cp-text-dim)' }}
                        >
                          {item.relationship}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Held for the read across the testimonials that comes later. */}
              <div style={{ background: 'var(--cp-surface)', padding: '26px 24px' }}>
                <div style={{ ...sectionLabel, marginBottom: '14px' }}>Impact</div>
                <p style={{ fontStyle: 'italic', fontSize: '12px', lineHeight: 1.8, color: 'var(--cp-text-muted)' }}>
                  Impact insights will appear once enough testimonials are collected.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* ---- CERTIFICATIONS ---- */}
        {certifications.length > 0 && (
          <section className="mx-auto max-w-[1100px] border-b" style={{ borderColor: 'var(--cp-border)' }}>
            <div style={{ padding: '26px 24px' }}>
              <div style={{ ...sectionLabel, marginBottom: '16px' }}>Certifications</div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {certifications.map((cert, index) => {
                  const issuer = [cert.organization || cert.issuer, cert.date || cert.details].filter(Boolean).join(' · ')
                  return (
                    <div
                      key={`${cert.name || cert.title}-${index}`}
                      className="flex items-center gap-3"
                      style={{
                        border: '1px solid var(--cp-border)',
                        background: 'var(--cp-surface)',
                        borderRadius: '3px',
                        padding: '12px 14px'
                      }}
                    >
                      <span
                        className="flex flex-shrink-0 items-center justify-center"
                        style={{ width: '36px', height: '36px', borderRadius: '3px', background: 'rgba(120, 93, 202, 0.12)' }}
                      >
                        <StrokeIcon paths={CERT_ICON_PATHS} size={18} />
                      </span>
                      <div className="min-w-0">
                        <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--cp-text)' }}>
                          {cert.name || cert.title}
                        </div>
                        {issuer && (
                          <div className="mt-0.5" style={{ fontSize: '10px', color: 'var(--cp-text-muted)' }}>
                            {issuer}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
        )}

        {/* ---- EVIDENCE ---- */}
        {/* The owner keeps the section while it is empty, because an empty
            section is the only thing that tells them it exists. */}
        {(evidence.length > 0 || data?.isOwner) && (
          <section className="mx-auto max-w-[1100px] border-b" style={{ borderColor: 'var(--cp-border)' }}>
            <div style={{ padding: '26px 24px' }}>
              <div style={{ ...sectionLabel, marginBottom: evidence.length > 0 ? '14px' : '8px' }}>Evidence</div>

              {evidence.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {evidence.map((item, index) => {
                    const visual = evidenceVisual(item)
                    const cardStyle = {
                      display: 'block',
                      background: 'var(--cp-surface)',
                      border: '1px solid var(--cp-border)',
                      borderRadius: '3px',
                      padding: '10px'
                    }
                    const inner = (
                      <>
                        <span
                          className="flex items-center justify-center"
                          style={{ height: '64px', borderRadius: '3px', background: visual.tint }}
                        >
                          <StrokeIcon paths={visual.paths} size={20} />
                        </span>
                        <span className="mt-2 block" style={{ fontSize: '11px', fontWeight: 500, color: 'var(--cp-text)' }}>
                          {item.title || 'Untitled'}
                        </span>
                        {(item.kind || item.media_class) && (
                          <span
                            className="mt-1 block"
                            style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--cp-text-dim)' }}
                          >
                            {item.kind || item.media_class}
                          </span>
                        )}
                      </>
                    )
                    return item.url ? (
                      <a
                        key={item.id || index}
                        className="cp-ev"
                        style={cardStyle}
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {inner}
                      </a>
                    ) : (
                      <div key={item.id || index} className="cp-ev" style={cardStyle}>{inner}</div>
                    )
                  })}
                </div>
              ) : (
                <SectionPrompt
                  text="Upload documents, links, and work samples."
                  action="Add evidence"
                  hint="Evidence upload is not wired up yet"
                />
              )}
            </div>
          </section>
        )}

        {/* ---- RECRUITER TOOLS: the two things a recruiter does here, side by
             side, so neither reads as the page's conclusion ---- */}
        <section className="mx-auto max-w-[1100px] border-b" style={{ borderColor: 'var(--cp-border)' }}>
          <div style={{ background: 'var(--cp-surface)' }}>
            <div style={{ padding: '16px 24px 0' }}>
              <div
                style={{
                  fontSize: '9px',
                  textTransform: 'uppercase',
                  letterSpacing: '1.6px',
                  color: 'var(--cp-text-faint)'
                }}
              >
                Recruiter tools
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2">
              <div
                className="border-b md:border-b-0 md:border-r"
                style={{ borderColor: 'var(--cp-border)', padding: '14px 24px 24px' }}
              >
                <div className="flex items-center" style={{ gap: '8px' }}>
                  <StrokeIcon paths={ASK_ICON_PATHS} size={20} color="var(--cp-accent)" />
                  <span style={sectionLabel}>Ask my career</span>
                </div>
                <p className="mt-1.5" style={{ fontSize: '12px', lineHeight: 1.6, color: 'var(--cp-text-muted)' }}>
                  Get answers sourced from verified career history.
                </p>
                <input
                  type="text"
                  className="cp-field mt-3"
                  disabled
                  title="Ask my career is not wired up yet"
                  aria-label="Ask a question about this career"
                  placeholder={askPlaceholder}
                  style={{ fontSize: '12px', padding: '10px 12px' }}
                />
              </div>

              <div style={{ padding: '14px 24px 24px' }}>
                <div className="flex items-center" style={{ gap: '8px' }}>
                  <StrokeIcon paths={EVALUATE_ICON_PATHS} size={20} color="var(--cp-accent)" />
                  <span style={sectionLabel}>Evaluate for a role</span>
                </div>
                <p className="mt-1.5" style={{ fontSize: '12px', lineHeight: 1.6, color: 'var(--cp-text-muted)' }}>
                  Paste a job description. Get a sourced brief you can share with your hiring team.
                </p>
                <textarea
                  className="cp-field mt-3"
                  aria-label="Job description"
                  placeholder="Paste a job description here..."
                  style={{ minHeight: '80px', fontSize: '12px', lineHeight: 1.6, padding: '10px 12px', resize: 'vertical' }}
                />
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    disabled
                    title="Role evaluation is not wired up yet"
                    style={{
                      background: 'linear-gradient(to right, var(--cp-accent), var(--cp-accent-dark))',
                      color: '#fff',
                      fontSize: '11px',
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      letterSpacing: '0.8px',
                      padding: '9px 22px',
                      borderRadius: '3px',
                      opacity: 0.55,
                      cursor: 'not-allowed'
                    }}
                  >
                    Generate brief
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---- ACTIONS: what this person is open to, and the two ways to act
             on it, on one line ---- */}
        <section className="mx-auto max-w-[1100px] border-b" style={{ borderColor: 'var(--cp-border)' }}>
          <div
            className={`flex flex-col gap-4 md:flex-row md:items-center ${hasOpenTo ? 'md:justify-between' : 'md:justify-end'}`}
            style={{ padding: '20px 24px' }}
          >
            {hasOpenTo && (
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex-shrink-0" style={{ fontSize: '13px', fontWeight: 500, color: '#fff' }}>
                  Open to
                </span>
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
            )}

            <div className="flex flex-shrink-0 flex-wrap items-center" style={{ gap: '10px' }}>
              <DownloadButton resume={activeResume} isOwner={data?.isOwner} />
              <button
                type="button"
                disabled
                title="Contact is not wired up yet"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--cp-border-accent)',
                  color: 'var(--cp-text-muted)',
                  fontSize: '11px',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.8px',
                  padding: '7px 20px',
                  borderRadius: '3px',
                  opacity: 0.55,
                  cursor: 'not-allowed'
                }}
              >
                Contact
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* ---- FOOTER: outside the crossfade, because it does not change when
           the lens does ---- */}
      <footer className="text-center" style={{ paddingTop: '16px', paddingBottom: '24px' }}>
        <span
          style={{
            fontSize: '9px',
            textTransform: 'uppercase',
            letterSpacing: '1.5px',
            color: 'var(--cp-border-accent)'
          }}
        >
          Powered by Hire Power
        </span>
      </footer>
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
