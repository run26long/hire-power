'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useProfileColorMode } from '@/lib/profileColorMode'

import ProfileDocument, { ProfileState } from './_components/ProfileDocument'

// ============================================================================
// /p/[slug]: the public Career Profile.
//
// TEMPLATE: Signature   MODE: dark   PALETTE: Signature default
//
// No auth to view, and deliberately no MainNav: nothing on this page belongs to
// the logged-in product.
//
// This file owns the fetch and the load states, and nothing else. The document
// itself - every mark on the page, the direction mechanics and the derivations
// off the record - lives in ProfileDocument, because the owner's management
// page renders the same composition and the two must never drift.
//
// THE PUBLIC CONTENT RULE
// A section with no content is not rendered, to anybody, owner included. There
// are no empty states, no owner prompts, and no invented backends. Download
// Resume and Contact are shown because they have always been part of this page,
// and they keep exactly the disabled state and explanation they already had.
// The owner's only extra is the generate action, which is the one working write
// the Profile has ever had.
// ============================================================================
export default function CareerProfilePage() {
  const params = useParams()
  const slug = params?.slug

  const [data, setData] = useState(null)
  const [loadState, setLoadState] = useState('loading')

  // The mode the owner chose, applied to the document and to everything it
  // portals onto the body. Keyed by slug, because a reader who opens two
  // profiles should get each one's own answer on its first paint rather than
  // whichever they looked at last.
  useProfileColorMode(data ? (data?.profile?.color_mode ?? null) : undefined, slug || 'p')

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

  // A direction the owner just generated, folded back into the record the
  // document is reading. The document reports it rather than writing it,
  // because the record is this route's to hold.
  function handleLensUpdated(lens) {
    setData(prev => prev ? {
      ...prev,
      lenses: prev.lenses.map(l => (l.id === lens.id ? { ...l, ...lens } : l))
    } : prev)
  }

  if (loadState !== 'ready') return <ProfileState state={loadState} />

  return <ProfileDocument data={data} slug={slug} onLensUpdated={handleLensUpdated} deepLinkLens />
}
