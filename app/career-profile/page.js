'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { fetchJSON } from '@/lib/fetchJSON'
import { useProfileColorMode } from '@/lib/profileColorMode'
import { useProfileAccent } from '@/lib/profileAccent'

import MainNav from '../components/MainNav'
import ErrorToast from '../components/ErrorToast'
import SuccessToast from '../components/SuccessToast'
import ProfileDocument from '../p/[slug]/_components/ProfileDocument'
import SettingsDrawer from './_components/SettingsDrawer'
import EditorGuide from './_components/EditorGuide'
import ProfileTour, { profileTourAlreadySeen } from './_components/ProfileTour'

import './_styles/editor.css'

// ============================================================================
// /career-profile: the owner's view of their own Career Profile.
//
// THE SHAPE OF THIS PAGE
// It is the profile. Not a form that writes to the profile, and not a hub of
// cards describing it - the actual document, rendered by the same component
// /p/[slug] renders, with the owner's controls laid over it. Somebody editing
// their profile should be looking at their profile.
//
// So there is no sidebar and no column layout here. The chrome is a bar across
// the top and a drawer that comes in from the side, and everything between
// them is the page a recruiter will see.
//
// EDIT AND PREVIEW
// Preview is not an approximation. It renders the same document from the same
// public payload with the edit context switched off, which means every
// affordance disappears by construction rather than by a stylesheet, and an
// empty section closes again exactly as it does for a reader.
//
// WHY THE DOCUMENT SCROLLS THE PAGE
// The Profile's sticky direction bar is driven by an IntersectionObserver on a
// viewport-rooted sentinel. Put the document inside a scrolling container and
// the bar sticks to the container while the observer reports against the
// viewport, and the two come apart. Nothing here introduces an overflow
// container; the document scrolls the document.
//
// WHAT WRITES AND WHAT DOES NOT
// The settings drawer writes: publication, the public address, and the contact
// address, each through its own route and each deriving the row from the
// caller's token rather than from anything this page sends.
//
// Everything laid over the document itself is still inert. Those affordances
// are drawn so their placement can be judged against the real layout, and each
// one is disabled and says what it is waiting for. They become real one
// section at a time, after this.
// ============================================================================

const MODES = { EDIT: 'edit', PREVIEW: 'preview' }

export default function CareerProfileEditorPage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())

  const [loadState, setLoadState] = useState('loading')
  const [loadError, setLoadError] = useState(null)
  const [manage, setManage] = useState(null)
  const [document_, setDocument] = useState(null)
  const [mode, setMode] = useState(MODES.EDIT)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // First-visit tour. The step id is held here rather than inside the tour
  // because one stop points at the About pencil, which is invisible until its
  // slot is hovered - the page stamps the running step on its root and one CSS
  // rule holds that pencil up for exactly as long as the tour is on it.
  const [showTour, setShowTour] = useState(false)
  const [tourStepId, setTourStepId] = useState(null)
  const closeTour = useCallback(() => {
    setShowTour(false)
    setTourStepId(null)
  }, [])

  // One notification channel for the whole page.
  //
  // Everything under here is the profile document with controls over it, and
  // the controls are scattered through six sections the owner scrolls between.
  // A failure reported next to the control that caused it is a line somebody
  // has already scrolled past by the time it appears; a toast is in the same
  // place every time and does not move the document to make room for itself.
  //
  // Two pieces of state rather than one object, because the two toasts are
  // separate components with their own timers, and a success arriving while an
  // error is still up should not cut the error short.
  const [toastError, setToastError] = useState(null)
  const [toastSuccess, setToastSuccess] = useState(null)

  const notify = useCallback(({ type, message }) => {
    if (!message) return
    if (type === 'success') setToastSuccess(String(message))
    else setToastError(String(message))
  }, [])
  const [copied, setCopied] = useState(false)

  // ---- THE SESSION, READ AT THE MOMENT OF THE CALL ----
  //
  // This used to be one captured object: `load` read the session once and
  // every write for the rest of the visit sent that same token. An access
  // token is good for about an hour and this is a page people leave open, so
  // a long editing session eventually reached the point where every write
  // failed at once with nothing on screen having changed to explain it.
  //
  // `getSession` hands back the cached token while it is still good and
  // refreshes it when it is not, so this is a local read in the ordinary case
  // and a refresh exactly when one is needed.
  const getAuthHeaders = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    const token = data?.session?.access_token
    if (!token) {
      router.push('/dashboard')
      throw new Error('Your session has ended. Please sign in again.')
    }
    return { Authorization: `Bearer ${token}` }
  }, [supabase, router])

  const load = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      setLoadError(null)
      const session = sessionData?.session
      if (!session) { router.push('/dashboard'); return }

      const headers = { Authorization: `Bearer ${session.access_token}` }

      // The management record first: it is the only thing that knows which
      // profile belongs to this session, and the slug comes out of it rather
      // than out of the URL. There is no slug in this route's path on purpose
      // - the owner does not address their own profile by guessing it.
      const managed = await fetchJSON('/api/career-profile/manage', { headers })
      setManage(managed)

      if (!managed?.profile?.slug) { setLoadState('none'); return }

      // The document itself, from the public endpoint, as the owner. Preview
      // has to be the recruiter's payload or it is not a preview; the owner
      // token is what lets an unpublished profile answer at all.
      const doc = await fetchJSON(
        `/api/career-profile/${encodeURIComponent(managed.profile.slug)}`,
        { headers }
      )
      setDocument(doc)
      setLoadState('ready')

      // Walk them through the workspace once. After the document, because
      // every stop points at something the document renders and the filter
      // that drops absent stops runs when the tour mounts.
      //
      // Desktop only, like the other two tours: the stops are placed for the
      // wide layout, and below 768 the spread the tour walks along is stacked
      // into one column.
      if (window.innerWidth >= 768 && !profileTourAlreadySeen()) {
        setTimeout(() => {
          setShowTour(true)
        }, 300) // 300ms delay
      }
    } catch (err) {
      console.error('Career Profile editor load failed:', err)
      setLoadError(err.message || "We couldn't load your Career Profile.")
      setLoadState('error')
    }
  }, [supabase, router])

  // Kicked off rather than performed here: every setState inside `load` is
  // behind an await, so nothing in it renders synchronously with this effect.
  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => { if (!cancelled) load() })
    return () => { cancelled = true }
  }, [load])

  // ---- HOW TALL THE CHROME ACTUALLY IS ----
  //
  // The toolbar's height was a constant in the stylesheet, and the Profile's
  // sticky lens bar was told to take hold below nav plus that constant. The
  // constant was right at desktop and wrong the moment the toolbar wrapped to
  // two rows on a phone: 56 assumed, 105 real, so the lens bar stuck 49px too
  // high and sat behind the toolbar.
  //
  // So it is measured instead of assumed. The two values are written onto the
  // shell as custom properties, and every offset that depends on them - the
  // lens bar's sticky top, scroll-padding, section scroll-margin - is already
  // expressed in terms of them, so they all follow from one measurement.
  useEffect(() => {
    if (loadState !== 'ready') return
    const shell = document.querySelector('.hp-ed')
    if (!shell) return

    const apply = () => {
      const bar = document.querySelector('.hp-ed-bar')
      const lens = document.querySelector('.hp-profile .hp-bar')
      // Deliberately not --ed-bar-h. That one is the bar's own min-height, so
      // writing a measurement back into it resizes the element being observed
      // and the observer never settles.
      if (bar) shell.style.setProperty('--ed-bar-real', `${Math.round(bar.getBoundingClientRect().height)}px`)
      if (lens) {
        const h = Math.round(lens.getBoundingClientRect().height)
        // The bar collapses to a sentinel before it is stuck; only a real
        // height is worth recording.
        if (h > 8) shell.style.setProperty('--ed-lens-h', `${h}px`)
      }

      // ---- Where the hero identity card has to stop ----
      //
      // Act I places the identity and the proof on one grid and lets their
      // boxes cross, so the identity runs on underneath the figures. The
      // editing surface must not: it stops 32px short of the vertical
      // SELECTED PROOF label.
      //
      // Measured rather than expressed as a percentage, because no single
      // percentage holds. Across 1200 to 1920 the inset that lands on 32px
      // ranges from 18.8 to 19.8 percent of the identity, so any fixed value
      // is either short of 32 at one end or well past it at the other.
      //
      // Below 1200 the proof sits underneath the identity rather than beside
      // it, so there is nothing to clear and the card keeps its normal 12px
      // overhang.
      const identity = document.querySelector('.hp-profile .hp-act1-identity')
      const caption = document.querySelector('.hp-profile .hp-proof-caption')
      if (identity) {
        const ir = identity.getBoundingClientRect()
        const cr = caption?.getBoundingClientRect()
        // Beside means beside: the label has to share vertical space with the
        // identity and sit to its right. Testing only horizontal position was
        // wrong between 768 and 1100, where the proof stacks underneath and
        // the label is still further right than the identity's left edge.
        const beside = Boolean(
          cr && cr.width > 0 &&
          cr.top < ir.bottom - 8 && cr.bottom > ir.top + 8 &&
          cr.left > ir.left
        )
        identity.style.setProperty(
          '--ed-card-right',
          beside ? `${Math.round(ir.right - (cr.left - 32))}px` : '-12px'
        )
      }
    }

    apply()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(apply)
    const bar = document.querySelector('.hp-ed-bar')
    const lens = document.querySelector('.hp-profile .hp-bar')
    const stage = document.querySelector('.hp-profile .hp-act1-stage')
    if (bar) observer.observe(bar)
    if (lens) observer.observe(lens)
    if (stage) observer.observe(stage)
    return () => observer.disconnect()
  }, [loadState, mode])

  const profile = manage?.profile || null

  // The workspace and the document it renders are painted the same way, and
  // both read it from here. `undefined` until the record lands is deliberate:
  // it tells the hook to paint its cached guess rather than commit to dark and
  // flip once the answer arrives. The drawer patches `manage` to preview a
  // change, so previewing and storing are the same read.
  useProfileColorMode(manage ? (profile?.color_mode ?? null) : undefined, 'owner')
  // The same read for the same reason: the drawer patches `manage` to
  // preview a palette, so choosing one and storing it paint identically.
  useProfileAccent(manage ? (profile?.accent ?? null) : undefined)
  const published = profile?.is_published === true
  const publicPath = profile?.slug ? `/p/${profile.slug}` : null

  const publicUrl = publicPath
    ? `${(process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/+$/, '')}${publicPath}`
    : null

  async function copyLink() {
    if (!publicUrl) return
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  // A settings write has landed. The management record is patched in place
  // rather than refetched: the route returned the stored value, so what is
  // on screen is what is in the database, and a round trip would only add a
  // flicker. A changed slug also changes the public address, so the link in
  // the bar and the drawer follow from the same state.
  const handleProfileChanged = useCallback((patch) => {
    setManage(prev => prev ? { ...prev, profile: { ...prev.profile, ...patch } } : prev)
  }, [])

  // ---- WRITING A DIRECTION ----
  //
  // Both of these throw on failure rather than returning a flag, because the
  // document has one place that catches and one place that decides what to do
  // about it. The lens that comes back is the stored row, so what the page
  // shows next is what the database holds rather than what was typed.
  const saveLens = useCallback(async (lensId, values) => {
    const res = await fetch(`/api/career-profile/lens/${encodeURIComponent(lensId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
      body: JSON.stringify(values)
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(payload?.error || "We couldn't save that.")
    return payload.lens
  }, [getAuthHeaders])

  // One field at a time, and nothing is written.
  //
  // The generator writes the whole direction from one prompt and always has;
  // `fields` narrows what comes back, so a Regenerate beside the bio cannot
  // return a headline over one somebody has just finished typing. `preview`
  // is what keeps it out of the database: the new wording arrives in the open
  // editor as a draft, and Save is the only thing that stores it.
  const regenerateLens = useCallback(async (lensId, field) => {
    const res = await fetch('/api/career-profile/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
      body: JSON.stringify({ lensId, fields: [field], preview: true })
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(
        payload?.error === 'PRO_REQUIRED'
          ? 'Regenerating a career direction is a Pro feature.'
          : "We couldn't rewrite that just now. Please try again."
      )
    }
    return payload?.draft?.[field] ?? null
  }, [getAuthHeaders])

  // ---- EVIDENCE ----
  //
  // The preview is a read and is allowed to fail softly: a page that will not
  // be read is not a reason somebody cannot add their own work, so this hands
  // back whatever the route said and the form carries on either way.
  const previewUrl = useCallback(async (url) => {
    const res = await fetch('/api/career-profile/preview-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
      body: JSON.stringify({ url })
    })
    return res.json().catch(() => ({ ok: false }))
  }, [getAuthHeaders])

  // The document is re-read rather than patched. The payload it renders is
  // assembled by the public route - eligibility filtered, placements grouped,
  // order applied - and rebuilding that here would be a second implementation
  // of it that could disagree. One request, and the tile appears; the page is
  // never reloaded and nothing else on screen moves.
  const reloadDocument = useCallback(async () => {
    const slug = profile?.slug
    if (!slug) return
    const doc = await fetchJSON(
      `/api/career-profile/${encodeURIComponent(slug)}`,
      { headers: await getAuthHeaders() }
    )
    setDocument(doc)
  }, [getAuthHeaders, profile?.slug])

  // Three steps, and the middle one does not come through this server.
  //
  // The route says where the file may go and issues a token for exactly that
  // path; the browser sends the bytes straight to storage; the route is then
  // told the upload landed and writes the record from what storage actually
  // holds. A 50MB video never enters a request body here, and the browser
  // never chooses a path.
  //
  // XMLHttpRequest rather than fetch, and only because fetch still cannot
  // report upload progress. A minute of silence on a large file reads as a
  // page that has stopped working.
  const uploadEvidence = useCallback(async (
    file,
    details,
    { onProgress, setUploading, poster = null, durationSeconds = null } = {}
  ) => {
    const startRes = await fetch('/api/career-profile/evidence/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
      body: JSON.stringify({
        content_type: file.type,
        size: file.size,
        // Asking for somewhere to put the chosen frame at the same time as the
        // video, so both objects exist before either is finalised and the row
        // is written once, with its picture already in place.
        poster_content_type: poster?.contentType || null
      })
    })
    const start = await startRes.json().catch(() => ({}))
    if (!startRes.ok) throw new Error(start?.error || "We couldn't start that upload.")

    setUploading?.(true)
    onProgress?.(0)
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', start.signed_url, true)
      xhr.setRequestHeader('Content-Type', start.content_type)
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100))
      }
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error('That upload did not finish. Please try again.')))
      xhr.onerror = () => reject(new Error("We couldn't reach storage. Check your connection."))
      xhr.onabort = () => reject(new Error('That upload was interrupted.'))
      xhr.send(file)
    })

    // The frame, after the video and before the row. It is small, so it gets
    // no progress of its own; the bar has already reached a hundred on the
    // thing that took the time.
    //
    // A frame that will not upload is not worth losing the video over: the
    // path is simply not claimed at the finish, and the item saves with the
    // play mark instead. That is the same outcome a video with no readable
    // frame already has.
    let posterClaim = null
    if (poster?.blob && start.poster_signed_url && start.poster_path) {
      try {
        const res = await fetch(start.poster_signed_url, {
          method: 'PUT',
          headers: { 'Content-Type': start.poster_content_type || poster.contentType },
          body: poster.blob
        })
        if (res.ok) posterClaim = { poster_path: start.poster_path, poster_ticket: start.poster_ticket }
      } catch {
        posterClaim = null
      }
    }
    setUploading?.(false)

    const finishRes = await fetch('/api/career-profile/evidence/upload', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
      body: JSON.stringify({
        ...details,
        path: start.path,
        ticket: start.ticket,
        ...(posterClaim || {}),
        duration_seconds: Number.isFinite(durationSeconds) ? durationSeconds : null
      })
    })
    const payload = await finishRes.json().catch(() => ({}))
    if (!finishRes.ok) throw new Error(payload?.error || "We couldn't save that.")
    await reloadDocument()
    return payload
  }, [getAuthHeaders, reloadDocument])

  // The management record, re-read the way the document is. It carries the
  // private and draft items the public payload cannot, so the manager's list
  // comes from here while the tiles above come from there.
  const reloadManage = useCallback(async () => {
    const managed = await fetchJSON('/api/career-profile/manage', { headers: await getAuthHeaders() })
    setManage(managed)
  }, [getAuthHeaders])

  // Every management write lands the same way: do it, then re-read both
  // records. Two requests rather than one, and worth it - the document decides
  // eligibility and ordering server-side, and the manager needs rows the
  // document is not allowed to carry. Reconstructing either here would be a
  // second implementation that could disagree with the first.
  const afterEvidenceChange = useCallback(async () => {
    await Promise.all([reloadDocument(), reloadManage()])
  }, [reloadDocument, reloadManage])

  const placementOp = useCallback(async (body) => {
    const res = await fetch('/api/career-profile/evidence/placements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
      body: JSON.stringify(body)
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(payload?.error || "We couldn't save that.")
    await afterEvidenceChange()
    return payload
  }, [getAuthHeaders, afterEvidenceChange])

  const assignEvidence = useCallback(
    (evidenceId, lensId, on) => placementOp({ op: 'assign', evidence_id: evidenceId, lens_id: lensId, on }),
    [placementOp]
  )
  const featureEvidence = useCallback(
    (evidenceId, lensId) => placementOp({ op: 'feature', evidence_id: evidenceId, lens_id: lensId }),
    [placementOp]
  )
  const reorderEvidence = useCallback(
    (evidenceId, lensId, by) => placementOp({ op: 'reorder', evidence_id: evidenceId, lens_id: lensId, by }),
    [placementOp]
  )

  // Off this direction, without being taken out of it. The placement keeps
  // its position and its lead status, so putting it back is the same control
  // again rather than a guess at where it used to sit.
  const hideEvidence = useCallback(
    (evidenceId, lensId, hidden) => placementOp({ op: 'hide', evidence_id: evidenceId, lens_id: lensId, hidden }),
    [placementOp]
  )

  // ---- TESTIMONIAL PLACEMENTS ----
  //
  // The same two operations over the other collection. Its own route because
  // it is its own table, and there is no assign and no delete on it: a
  // testimonial is somebody else's words, given once on request, and nothing
  // in this product removes one.
  const testimonialPlacementOp = useCallback(async (body) => {
    const res = await fetch('/api/career-profile/testimonials/placements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
      body: JSON.stringify(body)
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(payload?.error || "We couldn't save that.")
    await Promise.all([reloadDocument(), reloadManage()])
    return payload
  }, [getAuthHeaders, reloadDocument, reloadManage])

  const hideTestimonial = useCallback(
    (testimonialId, lensId, hidden) =>
      testimonialPlacementOp({ op: 'hide', testimonial_id: testimonialId, lens_id: lensId, hidden }),
    [testimonialPlacementOp]
  )
  const reorderTestimonial = useCallback(
    (testimonialId, lensId, by) =>
      testimonialPlacementOp({ op: 'reorder', testimonial_id: testimonialId, lens_id: lensId, by }),
    [testimonialPlacementOp]
  )

  const editEvidence = useCallback(async (evidenceId, values) => {
    const res = await fetch(`/api/career-profile/evidence/${encodeURIComponent(evidenceId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
      body: JSON.stringify(values)
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(payload?.error || "We couldn't save that.")
    await afterEvidenceChange()
    return payload
  }, [getAuthHeaders, afterEvidenceChange])

  const deleteEvidence = useCallback(async (evidenceId) => {
    const res = await fetch(`/api/career-profile/evidence/${encodeURIComponent(evidenceId)}`, {
      method: 'DELETE',
      headers: await getAuthHeaders()
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(payload?.error || "We couldn't remove that.")
    await afterEvidenceChange()
    return payload
  }, [getAuthHeaders, afterEvidenceChange])

  // ---- IN MY OWN WORDS ----
  //
  // The save writes; the draft does not. They are separate on purpose and the
  // route behind the second one has no write in it at all.
  const saveImow = useCallback(async (imowText) => {
    const res = await fetch('/api/career-profile/imow', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
      body: JSON.stringify({ imow_text: imowText })
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(payload?.error || "We couldn't save that.")
    await reloadDocument()
    return payload
  }, [getAuthHeaders, reloadDocument])

  const generateImow = useCallback(async () => {
    const res = await fetch('/api/career-profile/imow/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) }
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(
        payload?.error === 'PRO_REQUIRED'
          ? 'Writing a draft is a Pro feature.'
          : payload?.error || "We couldn't write a draft just now. Please try again."
      )
    }
    // Nothing is reloaded here, because nothing was written.
    return payload
  }, [getAuthHeaders])

  // The other half of the same bargain: ./generate has material and no text,
  // this has text and no material. It writes nothing either, and what it
  // returns is shown beside the original rather than instead of it.
  const strengthenImow = useCallback(async (imowText) => {
    const res = await fetch('/api/career-profile/imow/strengthen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
      body: JSON.stringify({ imow_text: imowText })
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(
        payload?.error === 'PRO_REQUIRED'
          ? 'Strengthening a draft is a Pro feature.'
          : payload?.error || "We couldn't do that just now. Please try again."
      )
    }
    return payload
  }, [getAuthHeaders])

  // ---- TESTIMONIALS ----
  //
  // Asking sends an email, so a failure here is loud: the route deletes the row
  // it just made rather than leave one saying "waiting on them" about somebody
  // who was never written to.
  const requestTestimonial = useCallback(async (values) => {
    const res = await fetch('/api/career-profile/testimonials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
      body: JSON.stringify(values)
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(payload?.error || "We couldn't send that request.")
    await reloadManage()
    return payload
  }, [getAuthHeaders, reloadManage])

  // Publishing changes what the public document holds, so both records are
  // re-read; the manager's list and the Firsthand section have to agree.
  const publishTestimonial = useCallback(async (id, status) => {
    const res = await fetch(`/api/career-profile/testimonials/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
      body: JSON.stringify({ status })
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(payload?.error || "We couldn't save that.")
    await Promise.all([reloadDocument(), reloadManage()])
    return payload
  }, [getAuthHeaders, reloadDocument, reloadManage])

  // The category the 360 count reads. Both records are re-read because the
  // badge is derived in the manage route, so the number on screen comes from
  // the same place the tag itself will.
  const categoriseTestimonial = useCallback(async (id, relationshipType) => {
    const res = await fetch(`/api/career-profile/testimonials/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
      body: JSON.stringify({ relationship_type: relationshipType })
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(payload?.error || "We couldn't save that.")
    await reloadManage()
    return payload
  }, [getAuthHeaders, reloadManage])

  const deleteTestimonial = useCallback(async (id) => {
    const res = await fetch(`/api/career-profile/testimonials/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: await getAuthHeaders()
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(payload?.error || "We couldn't remove that.")
    await Promise.all([reloadDocument(), reloadManage()])
    return payload
  }, [getAuthHeaders, reloadDocument, reloadManage])

  // A page of other people's phone numbers, so it is fetched with the session
  // rather than linked, and the blob is released straight after.
  const downloadReferenceSheet = useCallback(async () => {
    const res = await fetch('/api/career-profile/reference-sheet', { headers: await getAuthHeaders() })
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}))
      throw new Error(payload?.error || "We couldn't build that just now.")
    }
    const disposition = res.headers.get('content-disposition') || ''
    const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)
    const plain = disposition.match(/filename="([^"]+)"/i)
    const name = encoded ? decodeURIComponent(encoded[1]) : (plain ? plain[1] : 'References.pdf')

    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = window.document.createElement('a')
    a.href = url
    a.download = name
    window.document.body.appendChild(a)
    a.click()
    a.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 4000)
  }, [getAuthHeaders])

  // ---- IN MY OWN WORDS, TO CAMERA ----
  //
  // The same three steps as an evidence upload, for the same reason: the file
  // goes straight to storage and never through a request body here.
  const uploadImowVideo = useCallback(async (file, { onProgress } = {}) => {
    const startRes = await fetch('/api/career-profile/imow/video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
      body: JSON.stringify({ content_type: file.type, size: file.size })
    })
    const start = await startRes.json().catch(() => ({}))
    if (!startRes.ok) throw new Error(start?.error || "We couldn't start that upload.")

    onProgress?.(0)
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', start.signed_url, true)
      xhr.setRequestHeader('Content-Type', start.content_type)
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100))
      }
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error('That upload did not finish. Please try again.')))
      xhr.onerror = () => reject(new Error("We couldn't reach storage. Check your connection."))
      xhr.onabort = () => reject(new Error('That upload was interrupted.'))
      xhr.send(file)
    })

    const finishRes = await fetch('/api/career-profile/imow/video', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
      body: JSON.stringify({ path: start.path, ticket: start.ticket })
    })
    const payload = await finishRes.json().catch(() => ({}))
    if (!finishRes.ok) throw new Error(payload?.error || "We couldn't save that.")
    // Both: the document decides what renders, the management record decides
    // what the editor shows.
    await Promise.all([reloadDocument(), reloadManage()])
    return payload
  }, [getAuthHeaders, reloadDocument, reloadManage])

  const removeImowVideo = useCallback(async () => {
    const res = await fetch('/api/career-profile/imow/video', {
      method: 'DELETE',
      headers: await getAuthHeaders()
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(payload?.error || "We couldn't remove that.")
    await Promise.all([reloadDocument(), reloadManage()])
    return payload
  }, [getAuthHeaders, reloadDocument, reloadManage])

  const createEvidence = useCallback(async (values) => {
    const res = await fetch('/api/career-profile/evidence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
      body: JSON.stringify(values)
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(payload?.error || "We couldn't save that.")
    await reloadDocument()
    return payload
  }, [getAuthHeaders, reloadDocument])

  function handleLensUpdated(lens) {
    setDocument(prev => prev ? {
      ...prev,
      lenses: prev.lenses.map(l => (l.id === lens.id ? { ...l, ...lens } : l))
    } : prev)
  }

  // Whether a direction is on the public profile.
  //
  // Both records are re-read afterwards, which is the rule every management
  // write here follows. It matters more than usual for this one: the document
  // is the recruiter's payload and now carries only the directions that are
  // showing, so it is what proves the change landed - while the drawer's own
  // list comes from the management record, which is the only one holding the
  // hidden and the merely suggested rows, and the column saying which is
  // primary. Feeding the drawer from the document would have shown a switch
  // against the primary and no suggestions at all.
  const setLensVisibility = useCallback(async (lensId, visible) => {
    const res = await fetch(`/api/career-profile/lens/${lensId}/visibility`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
      body: JSON.stringify({ visible })
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(
        payload?.code === 'UPGRADE_REQUIRED'
          ? 'Adding another career direction is part of Vault and Pro.'
          : payload?.error || "We couldn't change that career direction. Please try again."
      )
    }
    await Promise.all([reloadDocument(), reloadManage()])
    return payload
  }, [getAuthHeaders, reloadDocument, reloadManage])

  // The order the directions are read in, and so which one a visitor lands
  // on. Sends the whole arrangement rather than a move: see the note on the
  // route. Reloads both halves, because the order is on the document as well
  // as in the drawer - the lens rail is drawn from it.
  const reorderLenses = useCallback(async (order) => {
    const res = await fetch('/api/career-profile/lens/reorder', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
      body: JSON.stringify({ order })
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(payload?.error || "We couldn't save that order. Please try again.")
    }
    await Promise.all([reloadDocument(), reloadManage()])
    return payload
  }, [getAuthHeaders, reloadDocument, reloadManage])

  // ---- states before there is a document ----
  if (loadState === 'loading') {
    return (
      <div className="hp-ed">
        <MainNav currentPage="career-profile" userProfile={manage?.userProfile || null} />
        <div className="hp-ed-state-screen">
          <div className="animate-spin h-8 w-8 border-4 border-purple-600 border-t-transparent rounded-full" />
        </div>
      </div>
    )
  }

  if (loadState === 'error') {
    return (
      <div className="hp-ed">
        <MainNav currentPage="career-profile" userProfile={manage?.userProfile || null} />
        <div className="hp-ed-state-screen">
          <div className="hp-ed-state-card">
            <p className="hp-ed-state-title">Unable to load your Career Profile</p>
            <p className="hp-ed-state-body">{loadError}</p>
            <button
              type="button"
              className="hp-ed-action"
              data-primary="true"
              onClick={() => { setLoadState('loading'); load() }}
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    )
  }

  // An account that has never generated one. Nothing here creates it: the
  // generator lives in Resume Coach, and a second way in would be a second
  // thing to keep true.
  if (loadState === 'none') {
    return (
      <div className="hp-ed">
        <MainNav currentPage="career-profile" userProfile={manage?.userProfile || null} />
        <div className="hp-ed-state-screen">
          <div className="hp-ed-state-card">
            <p className="hp-ed-state-title">You don&apos;t have a Career Profile yet</p>
            <p className="hp-ed-state-body">
              A Career Profile is built from your Core Resume. Start one in Resume Writer
              and it will appear here.
            </p>
            <button
              type="button"
              className="hp-ed-action"
              data-primary="true"
              onClick={() => router.push('/resume-coach')}
            >
              Go to Resume Writer
            </button>
          </div>
        </div>
      </div>
    )
  }

  const editing = mode === MODES.EDIT

  return (
    <div className="hp-ed" data-tour-step={tourStepId || undefined}>
      <MainNav currentPage="career-profile" userProfile={manage?.userProfile || null} />

      {/* Three groups, and they are actual groups: where you are, where it
          lives, and what you can do with it. The status sits with the mode
          control because it is a fact about what the address currently serves,
          not a badge; the address is quiet and central because it is a
          reference rather than an action. */}
      <div className="hp-ed-bar">
        <div className="hp-ed-bar-inner">
          <div className="hp-ed-where">
            <div className="hp-ed-modes" role="group" aria-label="View mode" data-tour="profile-mode">
              <button
                type="button"
                className="hp-ed-mode"
                aria-pressed={editing}
                onClick={() => setMode(MODES.EDIT)}
              >
                Edit
              </button>
              <button
                type="button"
                className="hp-ed-mode"
                aria-pressed={!editing}
                onClick={() => setMode(MODES.PREVIEW)}
              >
                Preview
              </button>
            </div>

            <span className="hp-ed-state" data-published={String(published)}>
              <span className="hp-ed-dot" aria-hidden="true" />
              {published ? 'Published' : 'Draft'}
            </span>
          </div>

          <span className="hp-ed-bar-gap" />

          {/* A draft has an address but not a working one, and offering to copy
              or open it is offering a link that answers nobody. So the address
              stays - it is what the owner is about to publish at, and seeing it
              is the point - but it goes quiet and says what would make it real.
              The actions come back with publication, and Open is named for what
              it does once there is something live to open. */}
          {publicUrl ? (
            <span className="hp-ed-link" data-live={String(published)}>{publicUrl}</span>
          ) : null}

          {publicUrl && !published ? (
            <span className="hp-ed-link-note">Publish to share</span>
          ) : null}

          <div className="hp-ed-does" data-tour="profile-settings">
            {published && publicUrl ? (
              <button type="button" className="hp-ed-action" onClick={copyLink}>
                {copied ? 'Copied' : 'Copy link'}
              </button>
            ) : null}

            {published && publicPath ? (
              <a className="hp-ed-action" href={publicPath} target="_blank" rel="noopener noreferrer">
                View live
              </a>
            ) : null}

            <button
              type="button"
              className="hp-ed-action"
              data-primary="true"
              onClick={() => setDrawerOpen(true)}
            >
              Settings
            </button>
          </div>
        </div>
      </div>

      {/* One short editorial spread, in Edit only, saying what this page is and
          where the owner is in it. Short on purpose: the profile itself starts
          on the same screen. */}
      {editing ? (
        <EditorGuide />
      ) : null}

      <ProfileDocument
        data={document_}
        slug={profile?.slug}
        onLensUpdated={handleLensUpdated}
        edit={editing ? {
          editing: true,
          isPro: manage?.isPro === true,
          // A second entitlement question, not a rename of the first. isPro
          // governs the Pro tools; this governs whether the owner may put
          // their own words and files into the profile at all, and Vault can.
          canCustomise: manage?.canCustomise === true,
          notify,
          onSaveLens: saveLens,
          onRegenerateLens: regenerateLens,
          onPreviewUrl: previewUrl,
          onCreateEvidence: createEvidence,
          onUploadEvidence: uploadEvidence,
          // The manager works from the management record, not the document:
          // a private item has no tile above and still has to be managed.
          allEvidence: manage?.evidence || [],
          allPlacements: manage?.placements || [],
          onAssignEvidence: assignEvidence,
          onFeatureEvidence: featureEvidence,
          onReorderEvidence: reorderEvidence,
          onHideEvidence: hideEvidence,
          allTestimonialPlacements: manage?.testimonialPlacements || [],
          onHideTestimonial: hideTestimonial,
          onReorderTestimonial: reorderTestimonial,
          onEditEvidence: editEvidence,
          onDeleteEvidence: deleteEvidence,
          onSaveImow: saveImow,
          onGenerateImow: generateImow,
          onStrengthenImow: strengthenImow,
          // The whole set, so the rail can offer a direction the profile is
          // not showing. The document's own `lenses` is the recruiter's list
          // and carries only what is active, which is the right list to render
          // and the wrong one to ask what else exists.
          allLenses: manage?.lenses || [],
          onLensVisibility: setLensVisibility,
          testimonials: manage?.testimonials || [],
          earned360: manage?.earned360 || null,
          onRequestTestimonial: requestTestimonial,
          onPublishTestimonial: publishTestimonial,
          onDeleteTestimonial: deleteTestimonial,
          onCategoriseTestimonial: categoriseTestimonial,
          // So the owner's own preview can sign a video on a profile nobody
          // else can see yet.
          getAuthHeaders,
          onUploadImowVideo: uploadImowVideo,
          onRemoveImowVideo: removeImowVideo,
          onDownloadReferenceSheet: downloadReferenceSheet
        } : null}
      />

      <SettingsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        profile={profile}
        publicUrl={publicUrl}
        accountEmail={manage?.accountEmail || null}
        getAuthHeaders={getAuthHeaders}
        onProfileChanged={handleProfileChanged}
        canCustomise={manage?.canCustomise === true}
        notify={notify}
        lenses={manage?.lenses || []}
        onLensVisibility={setLensVisibility}
        onLensReorder={reorderLenses}
      />

      {/* Inside .hp-ed, which is where the workspace's colour tokens live: the
          card reads them through the DOM, so being fixed-position does not
          matter but being a descendant does. */}
      {showTour && (
        <ProfileTour onStepChange={setTourStepId} onClose={closeTour} />
      )}

      {/* Last in the tree and fixed to the viewport, so nothing above has to
          leave room for them and neither can push the document around. */}
      <ErrorToast message={toastError} onClose={() => setToastError(null)} />
      <SuccessToast message={toastSuccess} onClose={() => setToastSuccess(null)} />
    </div>
  )
}
