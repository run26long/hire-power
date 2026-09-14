'use client'

import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'

import Reveal from './Reveal'
import StrokeIcon from './StrokeIcon'
import EvidenceOverlay from './EvidenceOverlay'
import { glyphFor } from './EvidenceViewer'

// ============================================================================
// EVIDENCE
//
// The claims made further up the page, with the things themselves underneath
// them. Curated per direction: what a reader sees here is what this direction
// chose to show, in the order it chose.
//
// The profile shows a preview, never the whole archive. A public profile is
// read in one pass, and an evidence wall that grows with the collection turns
// the page into a filing cabinet - the section stops being "here is the proof"
// and becomes "here is everything". So the page shows the lead and a few
// alongside it, and the rest is one deliberate step away.
//
// Nothing here navigates. Every tile opens the overlay, because leaving the
// profile to look at the proof is how a reader stops reading the profile.
// ============================================================================

const FAMILY_LABEL = { work: 'Work', credentials: 'Credentials', recognition: 'Recognition' }

// What the page has room to say well. Five is a lead and the four that sit
// around it; three is a phone screen's worth before the reader is scrolling
// past evidence rather than reading it.
const PREVIEW_DESKTOP = 5
const PREVIEW_MOBILE = 3

// The same boundary the CSS arrangements switch on, so the count the page plans
// for and the shape it renders can never disagree.
const NARROW = '(max-width: 767px)'

const subscribe = (notify) => {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const query = window.matchMedia(NARROW)
  query.addEventListener('change', notify)
  return () => query.removeEventListener('change', notify)
}
const isNarrowNow = () =>
  typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(NARROW).matches : false

// Read rather than stored: a media query is external state, and subscribing to
// it is what useSyncExternalStore is for. The server assumes the wide layout and
// the client corrects it on the first paint, without a render spent on it.
function useNarrow() {
  return useSyncExternalStore(subscribe, isNarrowNow, () => false)
}

const typeLabel = (item) => item.evidence_type || FAMILY_LABEL[item.family] || 'Evidence'
const metaOf = (item) => [item.organization, item.date_label].filter(Boolean).join(' · ')

export default function EvidenceSection({ items, slug, lensId, animate, directionKey }) {
  // null | { mode: 'gallery' } | { mode: 'detail', item, fromGallery }
  const [overlay, setOverlay] = useState(null)

  // Counts openings, not renders. It keys the overlay, so each fresh opening
  // is a new component with no memory of the last one, while moving between
  // the gallery and an item inside a single visit keeps the same key and
  // therefore the same filter and scroll position.
  const [visit, setVisit] = useState(0)

  // A direction change replaces the whole collection. Whatever was open
  // belonged to the direction that is leaving, and so did every bit of state
  // the overlay was holding - which goes with it, because the overlay unmounts.
  const [shownFor, setShownFor] = useState(directionKey)
  if (shownFor !== directionKey) {
    setShownFor(directionKey)
    if (overlay) setOverlay(null)
  }

  const narrow = useNarrow()

  // The lead is the item this direction marked. Where it marked none, the first
  // in placement order leads - decided here, and never written back, because a
  // default is not a choice the owner made.
  const ordered = useMemo(() => {
    if (items.length === 0) return []
    const featured = items.find(one => one.featured)
    return featured ? [featured, ...items.filter(one => one !== featured)] : items
  }, [items])

  // The two ways in start a visit.
  const openDetail = useCallback((item) => {
    setVisit(n => n + 1)
    setOverlay({ mode: 'detail', item, fromGallery: false })
  }, [])
  const openGallery = useCallback(() => {
    setVisit(n => n + 1)
    setOverlay({ mode: 'gallery' })
  }, [])

  // ...and these two move around inside one.
  const fromGallery = useCallback((item) => setOverlay({ mode: 'detail', item, fromGallery: true }), [])
  const backToGallery = useCallback(() => setOverlay({ mode: 'gallery' }), [])
  const close = useCallback(() => setOverlay(null), [])

  if (items.length === 0) return null

  const limit = narrow ? PREVIEW_MOBILE : PREVIEW_DESKTOP
  const preview = ordered.slice(0, limit)
  const hasMore = ordered.length > limit
  const lead = ordered[0]

  const tile = (item, role) => (
    <button
      type="button"
      key={item.id}
      className="hp-ev-tile"
      data-family={item.family}
      data-media={item.media_class}
      data-role={role}
      onClick={() => openDetail(item)}
      aria-haspopup="dialog"
    >
      <span className="hp-ev-tile-mark" aria-hidden="true">
        <StrokeIcon paths={glyphFor(item.media_class)} size={role === 'lead' ? 22 : 18} />
      </span>

      <span className="hp-ev-tile-type">{typeLabel(item)}</span>
      <span className="hp-ev-tile-title">{item.title}</span>

      {/* Every tile carries what the owner wrote about the thing, not just the
          lead. A tile with a title and nothing under it reads as a file name,
          and a row of them reads as a directory listing. */}
      {item.description && <span className="hp-ev-tile-blurb">{item.description}</span>}

      {metaOf(item) && <span className="hp-ev-tile-meta">{metaOf(item)}</span>}
    </button>
  )

  return (
    <section className="hp-section hp-ev-section">
      <div className="hp-wrap">
        <Reveal enabled={animate} className="hp-ev-intro">
          <span className="hp-label">Evidence</span>
          <h2 className="hp-ev-headline">See the work for yourself.</h2>
        </Reveal>

        <Reveal enabled={animate}>
          <div className="hp-ev-grid" data-count={String(preview.length)}>
            {preview.map((item, index) => tile(item, index === 0 ? 'lead' : 'rest'))}
          </div>

          {hasMore && (
            <div className="hp-ev-more">
              <button type="button" className="hp-ev-all" onClick={openGallery} aria-haspopup="dialog">
                View all evidence ({ordered.length})
              </button>
            </div>
          )}
        </Reveal>
      </div>

      <EvidenceOverlay
        key={`${directionKey}:${visit}`}
        mode={overlay?.mode || null}
        item={overlay?.item || null}
        items={ordered}
        leadId={lead?.id}
        slug={slug}
        lensId={lensId}
        onOpenItem={fromGallery}
        onBack={overlay?.fromGallery ? backToGallery : null}
        onClose={close}
      />
    </section>
  )
}
