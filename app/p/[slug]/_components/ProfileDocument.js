'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

import '../_styles/tokens.css'
import '../_styles/profile.css'
import '../_styles/sections.css'
import '../_styles/recruiter.css'

import { usePrefersReducedMotion } from '../_lib/motion'
import { ProfileEditProvider } from '../_lib/editContext'
import {
  BIO_COLLAPSE_AT,
  groupSkills,
  orderTestimonials,
  resolveSkillProof,
  truncateAtSentence
} from '../_lib/profileData'
import { splitCollection } from '@/lib/portfolio'

import ProfileHeader, { ProfileActionButtons } from './ProfileHeader'
import IdentityAct from './IdentityAct'
import { LensStage, LensBar } from './LensNav'
import ProfileSpread from './ProfileSpread'
import SelectedExperience from './SelectedExperience'
import SkillsSection from './SkillsSection'
import InPractice from './InPractice'
import RecruiterTools from './RecruiterTools'
import CollectiveImpact from './CollectiveImpact'
import ProfileResolution from './ProfileResolution'

// ============================================================================
// THE PROFILE DOCUMENT
//
// Every mark the Career Profile makes, and none of the deciding about who is
// allowed to see it. This is the page itself - the direction mechanics, the
// derivations off the record, the two actions, and the composition from the
// opening act down to the closing hairline.
//
// WHY IT IS NOT JUST THE ROUTE
// Two places render this: /p/[slug], where a recruiter reads it, and the
// owner's management page, where the same document is shown with edit
// affordances laid over it. Those have to be the same pixels. A management
// page that rebuilt the layout from its own components would drift from the
// public one within a month, and the owner's preview would become a lookalike
// rather than a preview - which is the one thing a preview must not be.
//
// So the composition lives here, once, and the routes differ only in where
// the record comes from and what is allowed to sit on top of it.
//
// WHAT IT DOES NOT DO
// It does not fetch, and it does not decide whether this profile may be
// displayed at all. It is handed a record that a route has already decided to
// show, and it draws it. Publication, ownership and the 404 stay in the route
// and in the API behind it, where a mistake is visible instead of buried in a
// component.
// ============================================================================

// ---- The refocus ----
// The standing content softens and steps back over OUT_MS. The swap happens
// behind that, and the new content resolves in ordered groups: the CSS holds
// the per-group delays, and RESOLVE_MS is the longest of them plus the resolve
// itself, which is what says when the page is settled again.
const OUT_MS = 180
const RESOLVE_MS = 670

export default function ProfileDocument({ data, slug, onLensUpdated, edit = null }) {
  const reducedMotion = usePrefersReducedMotion()

  const [activeIndex, setActiveIndex] = useState(0)
  const [contentIndex, setContentIndex] = useState(0)
  // 'idle' while settled, 'out' while the standing content recedes, 'in' while
  // the new content resolves.
  const [phase, setPhase] = useState('idle')
  const [glowKey, setGlowKey] = useState(0)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState(null)
  const [downloadingResume, setDownloadingResume] = useState(false)
  const [resumeError, setResumeError] = useState(null)
  const [bioExpanded, setBioExpanded] = useState(false)
  const [expandedRole, setExpandedRole] = useState(null)

  // Which field has its editor open, and what the last write did. Held here
  // rather than by the route, because it belongs to the document being shown:
  // changing direction has to close whatever was open, and this is the only
  // place that knows a direction changed.
  const [openField, setOpenField] = useState(null)
  const [busy, setBusy] = useState(null)
  // Which kind of work the busy field is doing: 'save' or 'draft'. One flag
  // was not enough. Save read `busy` and called itself "Saving…" while the
  // thing actually running was Show me another version, so a button nobody had
  // pressed claimed to be writing to the database.
  const [busyKind, setBusyKind] = useState(null)
  const [writeError, setWriteError] = useState(null)
  const [errorField, setErrorField] = useState(null)

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
      // An editor open on the direction being left would be writing the new
      // direction's field with the old one's text.
      setOpenField(null)
      setWriteError(null)
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
  const imowType = data?.profile?.imow_type || null
  // Whether a video exists, never where it is. The path stays server-side and
  // the player asks the signing route for a link when it is about to play.
  const imowHasVideo = data?.profile?.imow_has_video === true

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

  // One collection, two sections. The rule lives in lib/portfolio and is
  // applied once, here, so Evidence is exactly what Portfolio did not take -
  // never a second list of conditions that could drift into showing an item
  // twice or losing it between them. Both halves keep the direction's own
  // placement order, because both were sorted before they were split.
  const { portfolio: directionPortfolio, evidence: directionDocuments } = useMemo(
    () => splitCollection(directionEvidence),
    [directionEvidence]
  )

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
      onLensUpdated?.(lens)
    } catch (err) {
      console.error('Profile generation failed:', err)
      setGenerateError("We couldn't build this profile just now. Please try again.")
    } finally {
      setGenerating(false)
    }
  }

  // Where a download failure is said. In the editor it goes to the page's one
  // toast, which is where every other owner-facing failure already goes; on the
  // public page there is no toast host, so the line under the button stands.
  function reportResumeError(message) {
    if (editNotify) editNotify({ type: 'error', message })
    else setResumeError(message)
  }

  // The resume the button hands over is the one the reader is looking at: the
  // direction's own where it has built one, the priority core otherwise. Which
  // is not decided here - the direction id is sent and the server resolves it,
  // because a resume id from this side would be a resume id anybody could send.
  // `lensId` is the direction the reader picked from the download menu, when
  // the profile offered one. Anything else - no menu, or a handler wired
  // straight to a click - falls back to the direction on screen, which is what
  // this has always sent. Guarded by type rather than truthiness so a click
  // event arriving here could never be mistaken for an id.
  async function handleDownloadResume(lensId) {
    if (!activeResume || downloadingResume) return
    const wanted = typeof lensId === 'string' ? lensId : (selectedLens?.id || null)
    setDownloadingResume(true)
    setResumeError(null)
    try {
      // A reader sends nothing and gets the published profile's resume. The
      // owner sends their session, which is the only thing that lets the route
      // hand back a draft profile's - the same component renders both, and on
      // the public page there is no session to send.
      const auth = edit?.getAuthHeaders ? await edit.getAuthHeaders() : {}
      const res = await fetch('/api/career-profile/download-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({ slug, lens_id: wanted })
      })

      if (!res.ok) {
        let payload = {}
        try { payload = await res.json() } catch { /* status is enough */ }
        reportResumeError(payload?.error || "That didn't download. Please try again.")
        return
      }

      // The server names the file; it knows whose resume this is and has
      // already made the name safe for a header.
      const disposition = res.headers.get('content-disposition') || ''
      const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)
      const plain = disposition.match(/filename="([^"]+)"/i)
      const name = encoded ? decodeURIComponent(encoded[1]) : (plain ? plain[1] : 'Resume.pdf')

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = name
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 4000)
    } catch (err) {
      reportResumeError(err?.message || "That didn't reach us. Check your connection and try again.")
    } finally {
      setDownloadingResume(false)
    }
  }

  // ---- WHAT THE EDITORS ARE GIVEN ----
  //
  // The route supplies the credentials and the way to fold a result back into
  // the record; this supplies the direction that is actually on screen. A
  // section never has to know which lens it is looking at, and no editor can
  // name a direction the reader is not currently reading.
  const editLensId = selectedLens?.id || null
  const editSave = edit?.onSaveLens
  const editSaveImow = edit?.onSaveImow
  const editRegenerate = edit?.onRegenerateLens
  // Read off the context once for the same reason the handlers above are:
  // depending on `edit` itself would rebuild these on every keystroke.
  const editNotify = edit?.notify

  const runWrite = useCallback(async (field, work) => {
    if (!work || !editLensId) return false
    setBusy(field)
    setBusyKind('save')
    setWriteError(null)
    setErrorField(null)
    try {
      const lens = await work()
      if (lens) onLensUpdated?.(lens)
      setOpenField(null)
      return true
    } catch (err) {
      // The editor stays open with what was typed still in it. Losing the
      // text because the save failed would be the worse failure.
      setWriteError(err?.message || "We couldn't save that. Please try again.")
      setErrorField(field)
      return false
    } finally {
      setBusy(null)
      setBusyKind(null)
    }
  }, [editLensId, onLensUpdated])

  // ---- ASKING FOR WORDS, WHICH IS NOT SAVING THEM ----
  //
  // The sibling of runWrite, and the difference is the whole point of it:
  // nothing is stored, nothing is folded back into the record, and the editor
  // does not close. What comes back is handed to the field that asked for it,
  // which puts it in its own draft where the owner can read it, change it, or
  // walk away from it. Failures go to the page's toast, which is where the
  // rest of this editor's failures already go, rather than to the inline line
  // - the editor is still open and still holds the text it had.
  const runDraft = useCallback(async (field, work) => {
    if (!work || !editLensId) return null
    setBusy(field)
    setBusyKind('draft')
    setWriteError(null)
    setErrorField(null)
    try {
      return await work()
    } catch (err) {
      const message = err?.message || "We couldn't rewrite that just now. Please try again."
      if (editNotify) editNotify({ type: 'error', message })
      else { setWriteError(message); setErrorField(field) }
      return null
    } finally {
      setBusy(null)
      setBusyKind(null)
    }
  }, [editLensId, editNotify])

  const editValue = useMemo(() => {
    if (!edit?.editing) return null
    return {
      editing: true,
      lensId: editLensId,
      isPro: edit.isPro === true,
      // Whether this account may put its own words and files in at all. A
      // different question from isPro, and the gates read this one.
      canCustomise: edit.canCustomise === true,
      notify: edit.notify,
      // Every direction, not just the one on screen: adding a piece of
      // evidence is where an owner decides which chapters it belongs to.
      lenses,
      onPreviewUrl: edit.onPreviewUrl,
      onCreateEvidence: edit.onCreateEvidence,
      onUploadEvidence: edit.onUploadEvidence,
      allEvidence: edit.allEvidence,
      allPlacements: edit.allPlacements,
      onAssignEvidence: edit.onAssignEvidence,
      onFeatureEvidence: edit.onFeatureEvidence,
      onReorderEvidence: edit.onReorderEvidence,
      onEditEvidence: edit.onEditEvidence,
      onDeleteEvidence: edit.onDeleteEvidence,
      onGenerateImow: edit.onGenerateImow,
      onStrengthenImow: edit.onStrengthenImow,
      testimonials: edit.testimonials,
      earned360: edit.earned360,
      onRequestTestimonial: edit.onRequestTestimonial,
      onPublishTestimonial: edit.onPublishTestimonial,
      onDeleteTestimonial: edit.onDeleteTestimonial,
      onCategoriseTestimonial: edit.onCategoriseTestimonial,
      getAuthHeaders: edit.getAuthHeaders,
      slug,
      imowHasVideo,
      onUploadImowVideo: edit.onUploadImowVideo,
      onRemoveImowVideo: edit.onRemoveImowVideo,
      onDownloadReferenceSheet: edit.onDownloadReferenceSheet,
      openField,
      busy,
      busyKind,
      busyField: busy,
      error: writeError,
      errorField,
      open: (field) => { setWriteError(null); setErrorField(null); setOpenField(field) },
      close: () => { setWriteError(null); setErrorField(null); setOpenField(null) },
      // In My Own Words belongs to the profile, not to a direction, so it is
      // the one field whose save does not go to the lens route. Dispatched
      // here rather than in the editor, so every field still opens, closes,
      // reports busy and reports failure through the same path.
      save: (values, field) => runWrite(field, () => (field === 'imow'
        ? editSaveImow(values.imow_text)
        : editSave(editLensId, values))),
      regenerate: (field) => runDraft(field, () => editRegenerate(editLensId, field))
    }
  }, [
    edit?.editing, edit?.isPro, edit?.canCustomise, edit?.notify,
    edit?.onPreviewUrl, edit?.onCreateEvidence, edit?.onUploadEvidence,
    edit?.allEvidence, edit?.allPlacements, edit?.onAssignEvidence, edit?.onFeatureEvidence,
    edit?.onReorderEvidence, edit?.onEditEvidence, edit?.onDeleteEvidence,
    lenses, editLensId, openField, busy, busyKind, writeError, errorField,
    runWrite, runDraft, editSave, editSaveImow, editRegenerate,
    edit?.onGenerateImow, edit?.onStrengthenImow,
    edit?.testimonials, edit?.earned360, edit?.onRequestTestimonial,
    edit?.onPublishTestimonial, edit?.onDeleteTestimonial, edit?.onDownloadReferenceSheet,
    edit?.onCategoriseTestimonial, edit?.getAuthHeaders, slug, imowHasVideo,
    edit?.onUploadImowVideo, edit?.onRemoveImowVideo
  ])

  const actionButtons = (
    <ProfileActionButtons
      resume={activeResume}
      contactEmail={data?.profile?.contact_email || null}
      downloading={downloadingResume}
      downloadError={resumeError}
      onDownload={handleDownloadResume}
      lenses={lenses}
      selectedLensId={selectedLens?.id || null}
    />
  )

  // ---- READY ----
  const animate = !reducedMotion
  const showGenerate = Boolean(data?.isOwner && selectedLens && !selectedLens.bio)

  return (
    <ProfileEditProvider value={editValue}>
    <div className="hp-profile" data-phase={phase} data-mode={editValue ? 'edit' : undefined}>
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
            actions={actionButtons}
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
        actions={actionButtons}
      />

      <ProfileSpread
        bio={selectedLens?.bio}
        bioToShow={bioToShow}
        isCollapsible={Boolean(collapsedBio)}
        bioExpanded={bioExpanded}
        onToggleBio={() => setBioExpanded(value => !value)}
        imowText={imowText}
        imowType={imowType}
        imowHasVideo={imowHasVideo}
        slug={slug}
        getAuthHeaders={edit?.getAuthHeaders || null}
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
        {/* The artefacts, after the claims they stand behind. One act with two
            lanes inside it: what the work looks like, then what backs it up.
            Either earlier on the page would be showing a reader pictures and
            documents before they know what they are looking at.

            The two lanes used to be two sections with two display headlines,
            which read as two openings for one idea. The wrapper says it once
            and owns the collapse rule for both. */}
        <InPractice
          portfolio={directionPortfolio}
          evidence={directionDocuments}
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
        actions={actionButtons}
        animate={animate}
      />
    </div>
    </ProfileEditProvider>
  )
}

// The two states a route can be in before there is a document to draw. They
// live here because they wear the Profile's own styling, and the stylesheets
// are imported by this module - a route that shows a spinner in the Profile's
// visual system should not have to import 200KB of CSS to do it.
export function ProfileState({ state }) {
  return (
    <div className="hp-profile">
      <div className="hp-state">
        {state === 'loading' ? (
          <div className="hp-spinner" role="status" aria-label="Loading profile" />
        ) : (
          <p className="hp-state-text">
            {state === 'notfound' ? 'Profile not found' : "We couldn't load this profile."}
          </p>
        )}
      </div>
    </div>
  )
}
