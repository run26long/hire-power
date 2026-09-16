'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { fetchJSON } from '@/lib/fetchJSON'

import MainNav from '../components/MainNav'
import ProfileDocument from '../p/[slug]/_components/ProfileDocument'
import EditorIntro from './_components/EditorIntro'
import SettingsDrawer from './_components/SettingsDrawer'

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
  const [authHeaders, setAuthHeaders] = useState(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      setLoadError(null)
      const session = sessionData?.session
      if (!session) { router.push('/dashboard'); return }

      const headers = { Authorization: `Bearer ${session.access_token}` }
      setAuthHeaders(headers)

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

  const profile = manage?.profile || null
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
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(values)
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(payload?.error || "We couldn't save that.")
    return payload.lens
  }, [authHeaders])

  // One field at a time. The generator writes the whole direction from one
  // prompt and always has; `fields` narrows only what it stores, so a
  // Regenerate beside the bio cannot overwrite a headline somebody has just
  // finished typing.
  const regenerateLens = useCallback(async (lensId, field) => {
    const res = await fetch('/api/career-profile/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ lensId, fields: [field] })
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(
        payload?.error === 'PRO_REQUIRED'
          ? 'Regenerating a direction is a Pro feature.'
          : "We couldn't rewrite that just now. Please try again."
      )
    }
    return payload.lens
  }, [authHeaders])

  // ---- EVIDENCE ----
  //
  // The preview is a read and is allowed to fail softly: a page that will not
  // be read is not a reason somebody cannot add their own work, so this hands
  // back whatever the route said and the form carries on either way.
  const previewUrl = useCallback(async (url) => {
    const res = await fetch('/api/career-profile/preview-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ url })
    })
    return res.json().catch(() => ({ ok: false }))
  }, [authHeaders])

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
      { headers: authHeaders }
    )
    setDocument(doc)
  }, [authHeaders, profile?.slug])

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
  const uploadEvidence = useCallback(async (file, details, { onProgress, setUploading } = {}) => {
    const startRes = await fetch('/api/career-profile/evidence/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ content_type: file.type, size: file.size })
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
    setUploading?.(false)

    const finishRes = await fetch('/api/career-profile/evidence/upload', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ ...details, path: start.path, ticket: start.ticket })
    })
    const payload = await finishRes.json().catch(() => ({}))
    if (!finishRes.ok) throw new Error(payload?.error || "We couldn't save that.")
    await reloadDocument()
    return payload
  }, [authHeaders, reloadDocument])

  const createEvidence = useCallback(async (values) => {
    const res = await fetch('/api/career-profile/evidence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(values)
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(payload?.error || "We couldn't save that.")
    await reloadDocument()
    return payload
  }, [authHeaders, reloadDocument])

  function handleLensUpdated(lens) {
    setDocument(prev => prev ? {
      ...prev,
      lenses: prev.lenses.map(l => (l.id === lens.id ? { ...l, ...lens } : l))
    } : prev)
  }

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
              A Career Profile is built from your Core Resume. Start one in Resume Coach
              and it will appear here.
            </p>
            <button
              type="button"
              className="hp-ed-action"
              data-primary="true"
              onClick={() => router.push('/resume-coach')}
            >
              Go to Resume Coach
            </button>
          </div>
        </div>
      </div>
    )
  }

  const editing = mode === MODES.EDIT

  return (
    <div className="hp-ed">
      <MainNav currentPage="career-profile" userProfile={manage?.userProfile || null} />

      <div className="hp-ed-bar">
        <div className="hp-ed-modes" role="group" aria-label="View mode">
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

        <span className="hp-ed-bar-gap" />

        {publicUrl ? <span className="hp-ed-link">{publicUrl}</span> : null}

        {publicUrl ? (
          <button type="button" className="hp-ed-action" onClick={copyLink}>
            {copied ? 'Copied' : 'Copy link'}
          </button>
        ) : null}

        {publicPath ? (
          <a className="hp-ed-action" href={publicPath} target="_blank" rel="noopener noreferrer">
            Open
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

      {/* Inside the document's ground, above the profile itself, and only
          while editing: a recruiter's preview has nothing to explain. */}
      {editing ? <EditorIntro /> : null}

      <ProfileDocument
        data={document_}
        slug={profile?.slug}
        onLensUpdated={handleLensUpdated}
        edit={editing ? {
          editing: true,
          isPro: manage?.isPro === true,
          onSaveLens: saveLens,
          onRegenerateLens: regenerateLens,
          onPreviewUrl: previewUrl,
          onCreateEvidence: createEvidence,
          onUploadEvidence: uploadEvidence
        } : null}
      />

      <SettingsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        profile={profile}
        publicUrl={publicUrl}
        authHeaders={authHeaders}
        onProfileChanged={handleProfileChanged}
      />
    </div>
  )
}
