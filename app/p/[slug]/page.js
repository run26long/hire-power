'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

import './_styles/tokens.css'
import './_styles/profile.css'
import './_styles/sections.css'

import { usePrefersReducedMotion } from './_lib/motion'
import {
  BIO_COLLAPSE_AT,
  groupSkills,
  truncateAtSentence
} from './_lib/profileData'

import ProfileHeader, { ProfileActionButtons } from './_components/ProfileHeader'
import IdentityAct from './_components/IdentityAct'
import { LensStage, LensBar } from './_components/LensNav'
import ProfileSpread from './_components/ProfileSpread'
import SelectedExperience from './_components/SelectedExperience'
import SkillsSection from './_components/SkillsSection'
import CredentialsSection from './_components/CredentialsSection'
import CollectiveImpact from './_components/CollectiveImpact'
import ProfileResolution from './_components/ProfileResolution'

// ============================================================================
// /p/[slug] — the public Career Profile.
//
// TEMPLATE: Signature   MODE: dark   PALETTE: Signature default
//
// No auth to view, and deliberately no MainNav: nothing on this page belongs to
// the logged-in product. It carries its own visual system in _styles, keyed off
// semantic --profile-* tokens, so the app's palette and this one can never
// drift into each other.
//
// This file owns the fetch, the state and the direction mechanics, and nothing
// else. Every mark on the page is made by a component in _components.
//
// THE PUBLIC CONTENT RULE
// A section with no content is not rendered, to anybody, owner included. There
// are no empty states, no owner prompts, and no invented backends. Download
// Resume and Contact are shown because they have always been part of this page,
// and they keep exactly the disabled state and explanation they already had.
// The owner's only extra is the generate action, which is the one working write
// the Profile has ever had.
// ============================================================================

// ---- The refocus ----
// The standing content softens and steps back over OUT_MS. The swap happens
// behind that, and the new content resolves in ordered groups: the CSS holds
// the per-group delays, and RESOLVE_MS is the longest of them plus the resolve
// itself, which is what says when the page is settled again.
const OUT_MS = 180
const RESOLVE_MS = 670

export default function CareerProfilePage() {
  const params = useParams()
  const slug = params?.slug
  const reducedMotion = usePrefersReducedMotion()

  const [data, setData] = useState(null)
  const [loadState, setLoadState] = useState('loading')
  const [activeIndex, setActiveIndex] = useState(0)
  const [contentIndex, setContentIndex] = useState(0)
  // 'idle' while settled, 'out' while the standing content recedes, 'in' while
  // the new content resolves.
  const [phase, setPhase] = useState('idle')
  const [glowKey, setGlowKey] = useState(0)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState(null)
  const [bioExpanded, setBioExpanded] = useState(false)
  const [expandedRole, setExpandedRole] = useState(null)

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

  // The chosen direction brightens immediately; the Profile beneath it
  // reinterprets. Swapping both at once makes the page jump, which reads as a
  // reload rather than as the same person seen differently. The split between
  // activeIndex and contentIndex is what buys that, and it is why the two exist.
  useEffect(() => {
    if (activeIndex === contentIndex) return
    setPhase('out')
    const swap = setTimeout(() => {
      setContentIndex(activeIndex)
      setBioExpanded(false)
      setExpandedRole(null)
      setPhase('in')
    }, OUT_MS)
    return () => clearTimeout(swap)
  }, [activeIndex, contentIndex])

  // Back to settled once the last group has resolved, so the resolve animation
  // is not left sitting on the content afterwards.
  useEffect(() => {
    if (phase !== 'in') return
    const settle = setTimeout(() => setPhase('idle'), RESOLVE_MS)
    return () => clearTimeout(settle)
  }, [phase])

  function selectLens(index) {
    if (index === activeIndex) return
    setActiveIndex(index)
    // Replays the focus glow. Keyed rather than toggled so a second change
    // mid-transition restarts it cleanly.
    setGlowKey(key => key + 1)
  }

  const selectedLens = lenses[contentIndex] || null
  const proofPoints = Array.isArray(selectedLens?.proof_points) ? selectedLens.proof_points : []
  const readyTags = Array.isArray(selectedLens?.ready_tags) ? selectedLens.ready_tags : []

  const displayName = data?.person?.displayName || data?.fallback?.name || 'Career Profile'

  // The generated headline is written for this direction, so it wins. Target
  // roles are only the stand-in for a direction that has not been generated
  // yet; they are not shown in the hero in their own right.
  const targetRoles = Array.isArray(data?.careerContext?.target_roles)
    ? data.careerContext.target_roles.filter(Boolean)
    : []
  const fallbackHeadline = targetRoles.length
    ? targetRoles.join(' · ')
    : data?.careerContext?.current_lens_name || ''
  const headline = selectedLens?.headline || fallbackHeadline

  // The direction has its own core resume once it is built. Until then the
  // priority core is the right source: same career, just not yet recut.
  const lensResume = data?.lensResumes?.[selectedLens?.core_resume_id] || null
  const activeResume = lensResume || data?.coreResume || null
  const skillClusters = useMemo(() => groupSkills(activeResume?.resume_data), [activeResume])

  const fullBio = selectedLens?.bio || ''
  const collapsedBio = useMemo(() => truncateAtSentence(fullBio, BIO_COLLAPSE_AT), [fullBio])
  const bioToShow = collapsedBio && !bioExpanded ? collapsedBio : fullBio

  const imowText = data?.profile?.imow_text || null

  // Where the resume actually carries one. There is no location and no remote
  // field in the API contract, so nothing is inferred and nothing stands in
  // for a missing one.
  const location = data?.coreResume?.resume_data?.location || null

  // Experience, certifications and education follow the direction the page is
  // showing, and fall back to the priority core for one that has not been
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
      <div className="hp-profile">
        <div className="hp-state">
          <div className="hp-spinner" role="status" aria-label="Loading profile" />
        </div>
      </div>
    )
  }

  if (loadState === 'notfound' || loadState === 'error') {
    return (
      <div className="hp-profile">
        <div className="hp-state">
          <p className="hp-state-text">
            {loadState === 'notfound' ? 'Profile not found' : "We couldn't load this profile."}
          </p>
        </div>
      </div>
    )
  }

  // ---- READY ----
  const animate = !reducedMotion
  const showGenerate = Boolean(data?.isOwner && selectedLens && !selectedLens.bio)

  return (
    <div className="hp-profile" data-phase={phase}>
      {/* Act I: header, identity, proof and the direction invitation are one
          composition, so the header and the selector are passed into it rather
          than stacked around it. */}
      <IdentityAct
        displayName={displayName}
        headline={headline}
        proofPoints={proofPoints}
        glowKey={glowKey}
        animate={animate}
        chrome={
          <ProfileHeader
            resume={activeResume}
            isOwner={data?.isOwner}
            showGenerate={showGenerate}
            lensName={selectedLens?.name}
            generating={generating}
            generateError={generateError}
            onGenerate={handleGenerate}
          />
        }
        directions={
          <LensStage
            lenses={lenses}
            activeIndex={activeIndex}
            onSelect={selectLens}
            reducedMotion={reducedMotion}
          />
        }
      />

      {/* Takes the top edge once the act has been scrolled past. Sticky in
          normal flow, so it holds its own space and cannot overlap anything. */}
      <LensBar
        lenses={lenses}
        activeIndex={activeIndex}
        onSelect={selectLens}
        reducedMotion={reducedMotion}
        actions={<ProfileActionButtons resume={activeResume} isOwner={data?.isOwner} />}
      />

      <ProfileSpread
        bio={selectedLens?.bio}
        bioToShow={bioToShow}
        isCollapsible={Boolean(collapsedBio)}
        bioExpanded={bioExpanded}
        onToggleBio={() => setBioExpanded(value => !value)}
        imowText={imowText}
        animate={animate}
      />

      {/* The rest of the Profile is direction-dependent too, so it crosses over
          with the opening. It uses the opacity-only variant: blurring a page
          this long would rasterise the whole document for the length of every
          change, and nothing down here needs the focus pull to read. */}
      <main className="hp-refocus-soft">
        <SelectedExperience
          experience={experience}
          expandedRole={expandedRole}
          onToggleRole={(index) => setExpandedRole(current => (current === index ? null : index))}
          animate={animate}
        />

        {/* Between the work and the skills: the synthesis of what the people
            around it said, beside the people themselves. */}
        <CollectiveImpact
          impact={data?.collectiveImpact}
          testimonials={testimonials}
          animate={animate}
          reducedMotion={reducedMotion}
          directionKey={contentIndex}
        />

        <SkillsSection
          clusters={skillClusters}
          animate={animate}
          reducedMotion={reducedMotion}
          directionKey={contentIndex}
        />

        <CredentialsSection
          certifications={certifications}
          evidence={evidence}
          animate={animate}
        />

        <ProfileResolution
          readyTags={readyTags}
          location={location}
          resume={activeResume}
          isOwner={data?.isOwner}
          animate={animate}
        />
      </main>

      <footer className="hp-foot">
        <span className="hp-foot-mark">Powered by Hire Power</span>
      </footer>
    </div>
  )
}
