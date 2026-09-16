'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

import './_styles/tokens.css'
import './_styles/profile.css'
import './_styles/sections.css'
import './_styles/recruiter.css'

import { usePrefersReducedMotion } from './_lib/motion'
import {
  BIO_COLLAPSE_AT,
  groupSkills,
  orderTestimonials,
  resolveSkillProof,
  truncateAtSentence
} from './_lib/profileData'

import ProfileHeader, { ProfileActionButtons } from './_components/ProfileHeader'
import IdentityAct from './_components/IdentityAct'
import { LensStage, LensBar } from './_components/LensNav'
import ProfileSpread from './_components/ProfileSpread'
import SelectedExperience from './_components/SelectedExperience'
import SkillsSection from './_components/SkillsSection'
import EvidenceSection from './_components/EvidenceSection'
import RecruiterTools from './_components/RecruiterTools'
import CollectiveImpact from './_components/CollectiveImpact'
import ProfileResolution from './_components/ProfileResolution'

// ============================================================================
// /p/[slug]: the public Career Profile.
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

  // Experience follows the direction the page is showing, and falls back to the
  // priority core for one that has not been built yet. The route resolved both,
  // so this is only the pick between them.
  //
  // The resume's certifications are still resolved by the route and still sit
  // in the record; the page simply no longer reads them, because a credential
  // reaches the public profile as curated evidence or not at all.
  const lensSections = data?.resumeSections?.byLens?.[selectedLens?.id] || data?.resumeSections?.fallback || null
  const experience = Array.isArray(lensSections?.experience) ? lensSections.experience : []

  // A testimonial with no text and a piece of evidence with neither a title nor
  // a link are not content, so they do not get to keep their sections open.
  const testimonials = (Array.isArray(data?.testimonials) ? data.testimonials : [])
    .filter(item => String(item?.polished_text || '').trim())
  const evidence = (Array.isArray(data?.evidence) ? data.evidence : [])
    .filter(item => item && (item.title || item.url))

  // What this direction puts in Evidence, and in what order.
  //
  // Placements are references, so the items themselves are read out of the one
  // canonical list the route sent. A direction with no placements of its own
  // falls back to the shared layer - it does not borrow another direction's,
  // and the two are never merged: a reader would have no way to tell which of
  // the things in front of them this direction had actually chosen.
  const directionEvidence = useMemo(() => {
    const places = data?.evidencePlacements?.[selectedLens?.id] ?? data?.evidenceShared ?? []
    const byId = new Map(evidence.map(item => [item.id, item]))
    return places
      .map(place => {
        const item = byId.get(place.evidence_id)
        return item ? { ...item, featured: place.featured === true } : null
      })
      .filter(Boolean)
  }, [data?.evidencePlacements, data?.evidenceShared, selectedLens?.id, evidence])

  // Collective Impact is written per direction. A direction that has not been
  // regenerated yet falls back to the shared synthesis, and a profile that
  // never had one falls back to the priority direction's - so the section is
  // never blank merely because this profile predates the direction scope.
  const impact = useMemo(() => {
    const byLens = data?.collectiveImpacts || {}
    return byLens[selectedLens?.id] || data?.collectiveImpact || byLens[lenses[0]?.id] || null
  }, [data?.collectiveImpacts, data?.collectiveImpact, selectedLens?.id, lenses])

  // One shared, privacy-filtered collection, read in this direction's order.
  // The canonical list is what proof resolves against, so reordering here
  // changes what Firsthand shows first and nothing else.
  const orderedTestimonials = useMemo(
    () => orderTestimonials(testimonials, impact?.testimonialOrder),
    [testimonials, impact]
  )

  // References become renderable proof here, against the evidence and
  // testimonials this page was already given and the resume it is showing.
  //
  // Proof is direction-specific, so only the active direction's rows are ever
  // read. Switching direction changes the key and rebuilds the map from
  // nothing: there is no merge and no fallback, so a skill that two directions
  // share never carries the other one's evidence.
  const skillProof = useMemo(
    () => resolveSkillProof(data?.skillProofs?.[selectedLens?.id], {
      evidence,
      testimonials,
      resumeData: activeResume?.resume_data
    }),
    [data?.skillProofs, selectedLens?.id, evidence, testimonials, activeResume]
  )

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
        directionKey={contentIndex}
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
          impact={impact}
          testimonials={orderedTestimonials}
          animate={animate}
          reducedMotion={reducedMotion}
          directionKey={contentIndex}
        />

        <SkillsSection
          clusters={skillClusters}
          featuredSkills={selectedLens?.skill_emphasis}
          skillProof={skillProof}
          animate={animate}
          reducedMotion={reducedMotion}
          directionKey={contentIndex}
        />

        {/* The things themselves, after the claims they stand behind.

            Credentials used to have a section of their own below this one,
            reading straight off the resume. It is gone: a certification is a
            piece of evidence, and evidence belongs in one collection the
            owner curates per direction, not in a second list that appears
            because the resume happens to carry a line. Nothing was deleted -
            the resume still holds what it held, and an owner-facing workflow
            can promote any of it into real evidence with a real source. */}
        <EvidenceSection
          items={directionEvidence}
          slug={slug}
          lensId={selectedLens?.id}
          animate={animate}
          directionKey={contentIndex}
        />

        {/* The last section, and the only one the reader operates. It is
            deliberately not given directionKey: both tools read the whole
            career, and a result somebody is part way through reading is not
            something a change of chapter should take away from them.

            It renders nothing at all when the profile does not carry the
            tools - no teaser, no lock, no badge. */}
        <RecruiterTools
          enabled={data?.recruiterToolsEnabled === true}
          slug={slug}
          candidateName={displayName}
          animate={animate}
          reducedMotion={reducedMotion}
        />

      </main>

      {/* The close lives outside <main>: it is one composition under one
          hairline, and the only part of the page that does not cross over
          when the reader changes direction. */}
      <ProfileResolution
        readyTags={readyTags}
        location={location}
        resume={activeResume}
        isOwner={data?.isOwner}
        animate={animate}
      />
    </div>
  )
}
