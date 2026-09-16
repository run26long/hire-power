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
// WHAT IT CANNOT DO YET
// Write anything. Every affordance on this page is disabled and says so. This
// pass exists to prove auth, the shared-document extraction, the layout and
// the stacking order before a single write route is built.
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
  const [copied, setCopied] = useState(false)

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
        edit={editing ? { editing: true } : null}
      />

      <SettingsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        profile={profile}
        publicUrl={publicUrl}
      />
    </div>
  )
}
