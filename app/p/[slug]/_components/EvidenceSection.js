'use client'

import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'

import Reveal from './Reveal'
import StrokeIcon from './StrokeIcon'
import EvidenceOverlay from './EvidenceOverlay'
import { glyphFor } from './EvidenceViewer'
import { EditGrip, SlotGuide, SlotGhost, UpgradeNote, useEditSlot } from './EditAffordance'
import AddEvidence from './AddEvidence'
import { isEvidenceItem } from '@/lib/portfolio'
import ManageList from './ManageList'
import { EvidenceEditPane } from './ManagePanes'
import { useCanShowEmpty, useCanEdit, useProfileEdit } from '../_lib/editContext'
import { directionPlacements } from '../_lib/profileData'

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
  // Opened from the guidance tile, and from the heading control.
  const [openAdd, setOpenAdd] = useState(0)
  // Which row has a write in flight, so one switch can go quiet without
  // freezing the list around it.
  const [busyId, setBusyId] = useState(null)
  // Which item's fields have taken the modal over, if any. null is the list.
  const [editingId, setEditingId] = useState(null)

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
  const canShowEmpty = useCanShowEmpty()
  const canEdit = useCanEdit()
  const slot = useEditSlot()
  const backToGallery = useCallback(() => setOverlay({ mode: 'gallery' }), [])
  const close = useCallback(() => setOverlay(null), [])

  // ---- MANAGING WHAT THIS DIRECTION SHOWS ----
  //
  // The list is this direction's placements, shown and hidden together, and
  // never the whole collection: an item nobody has placed anywhere is not
  // something to un-hide, it is something to add.
  const edit = useProfileEdit()
  const openManage = useCallback(() => {
    setVisit(n => n + 1)
    setEditingId(null)
    setOverlay({ mode: 'manage' })
  }, [])

  const manageItems = useMemo(() => {
    const byId = new Map((edit?.allEvidence || []).map(one => [one.id, one]))
    return directionPlacements(edit?.allPlacements, lensId)
      .map(place => {
        const item = byId.get(place.evidence_id)
        // Portfolio takes the visual uploads; this section is everything
        // else, and the management list has to agree with what it renders.
        if (!item || !isEvidenceItem(item)) return null
        return {
          id: item.id,
          title: item.title || typeLabel(item),
          meta: metaOf(item) || typeLabel(item),
          hidden: place.hidden === true
        }
      })
      .filter(Boolean)
  }, [edit?.allEvidence, edit?.allPlacements, lensId])

  // Every write reports through the page's own toast, the way the rest of
  // the owner's controls do, and leaves the row it was on unlocked either
  // way.
  const run = useCallback(async (id, work) => {
    if (busyId) return
    setBusyId(id)
    try {
      await work()
    } catch (err) {
      edit?.notify?.({ type: 'error', message: err?.message || "We couldn't save that. Please try again." })
    } finally {
      setBusyId(null)
    }
  }, [busyId, edit])

  const toggleItem = useCallback(
    (id, nextHidden) => run(id, () => edit?.onHideEvidence?.(id, lensId, nextHidden)),
    [run, edit, lensId]
  )
  // A drop is however many single steps it takes to get there, sent one at a
  // time: the route moves an item by one place, and a drag is not a different
  // kind of move, only a longer one.
  // The item whose fields are showing, resolved from the record rather than
  // held in state: an edit that lands changes the record, and the pane has
  // to be looking at what was actually saved.
  const editingItem = useMemo(
    () => (editingId ? (edit?.allEvidence || []).find(one => one.id === editingId) || null : null),
    [editingId, edit?.allEvidence]
  )

  // Which item leads this direction, for the switch inside the pane.
  const featuredId = useMemo(() => {
    const here = directionPlacements(edit?.allPlacements, lensId)
    return here.find(place => place.featured)?.evidence_id || null
  }, [edit?.allPlacements, lensId])

  const dropItem = useCallback((fromId, toId) => {
    const ids = manageItems.map(one => one.id)
    const from = ids.indexOf(fromId)
    const to = ids.indexOf(toId)
    if (from === -1 || to === -1 || from === to) return
    const by = to > from ? 1 : -1
    return run(fromId, async () => {
      for (let at = from; at !== to; at += by) {
        await edit?.onReorderEvidence?.(fromId, lensId, by)
      }
    })
  }, [manageItems, run, edit, lensId])

  // Empty, this section is not on the public page at all. The owner has to
  // see it to put anything in it.
  if (items.length === 0 && !canShowEmpty) return null

  const limit = narrow ? PREVIEW_MOBILE : PREVIEW_DESKTOP
  const preview = ordered.slice(0, limit)
  const hasMore = ordered.length > limit
  const lead = ordered[0]

  const tile = (item, role) => (
    <button
      type="button"
      key={item.id}
      className={`hp-ev-tile${slot}`}
      data-family={item.family}
      data-media={item.media_class}
      data-role={role}
      onClick={() => openDetail(item)}
      aria-haspopup="dialog"
    >
      <EditGrip />

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
    <div className="hp-practice-part hp-ev-section">
        <Reveal enabled={animate} className="hp-ev-intro">
          <h3 className="hp-practice-sub">Evidence</h3>
          <p className="hp-practice-line">Credentials, recognition, and documents that back it up.</p>
        </Reveal>

        {/* One control for the whole section, at the top right, and it opens
            the modal the section already had. Adding is in there too: a second
            button out here was the owner being asked the same question in two
            places. */}
        {canEdit ? (
          <div className="hp-ed-manage-row">
            <button type="button" className="hp-ed-manage" onClick={openManage} aria-haspopup="dialog">
              Manage evidence
            </button>
          </div>
        ) : null}

        {items.length === 0 ? (
          // The public Evidence composition, empty: the same field, the same
          // grid, the same lead slot and the same number of tiles the section
          // shows when it is full, so the featured artifact keeps its real
          // scale beside the smaller ones and the arrangement is the real one.
          // The public Evidence composition with the guidance in its featured
          // slot. Same field, same grid, same lead slot, same tile count, so
          // the large artifact keeps its real scale beside the smaller ones and
          // the arrangement is the section's own rather than a drawing of it.
          <div className="hp-ev-field">
            <div className="hp-ev-grid" data-count={String(narrow ? PREVIEW_MOBILE : PREVIEW_DESKTOP)}>
              <div className="hp-ev-lead-slot" data-more="false">
                <span className="hp-ev-tile hp-ed-guide-tile hp-ed-incomplete" data-role="lead">
                  <span className="hp-ed-pill">Add your proof</span>
                  <SlotGuide
                    index="01"
                    heading="Back up the story."
                    action="Add evidence"
                    feature="evidence"
                    onAction={() => setOpenAdd(n => n + 1)}
                  >
                    A résumé asks recruiters to take your word for it. Your Career
                    Profile lets you show them the proof. Add credentials,
                    recognition, reports, presentations, or other documents that
                    demonstrate you’ve done the work.
                  </SlotGuide>
                </span>
              </div>

              {Array.from(
                { length: (narrow ? PREVIEW_MOBILE : PREVIEW_DESKTOP) - 1 },
                (_, i) => String(i + 2).padStart(2, '0')
              ).map(n => (
                <span className="hp-ev-tile hp-ed-ghost-tile" data-role="rest" key={n}>
                  <SlotGhost index={n} />
                </span>
              ))}
            </div>
          </div>
        ) : (
        <Reveal enabled={animate}>
          {/* The featured card and the way into the rest of the collection are
              one presentation, so they share a cell: the slot is what the grid
              places, and the two sit inside it as siblings.

              Siblings, not parent and child. The card is a button and so is the
              action; nesting them would be markup no keyboard and no screen
              reader can resolve, whatever it looked like. */}
          <div className="hp-ev-field">
            <div className="hp-ev-grid" data-count={String(preview.length)}>
              <div className="hp-ev-lead-slot" data-more={hasMore ? 'true' : 'false'}>
                {lead && tile(lead, 'lead')}

                {/* Straight after the card it belongs to, which is where the
                    keyboard reaches it and where a phone shows it. */}
                {hasMore && (
                  <button type="button" className="hp-ev-all" onClick={openGallery} aria-haspopup="dialog">
                    View all evidence ({ordered.length})
                    <span className="hp-ev-all-arrow" aria-hidden="true">→</span>
                  </button>
                )}
              </div>

              {preview.slice(1).map(item => tile(item, 'rest'))}
            </div>
          </div>
        </Reveal>
        )}

        {/* The add flow itself, with no trigger of its own: Manage opens it. */}
        {canEdit
          ? <AddEvidence openSignal={openAdd} trigger={false} />
          : items.length > 0 ? <UpgradeNote feature="evidence" /> : null}

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
        manageTitle={editingItem ? 'Edit evidence' : 'Manage evidence'}
        manageCount={editingItem ? undefined : manageItems.length}
        manageBody={editingItem ? (
          <EvidenceEditPane
            item={editingItem}
            lensId={lensId}
            isFeatured={featuredId === editingItem.id}
            onBack={() => setEditingId(null)}
          />
        ) : (
          <ManageList
            items={manageItems}
            busyId={busyId}
            onToggle={toggleItem}
            onDrop={dropItem}
            onEdit={setEditingId}
            onAdd={() => { close(); setOpenAdd(n => n + 1) }}
            addLabel="Add evidence"
            onDone={close}
            emptyNote="Nothing is placed on this career direction yet. Add evidence to start."
          />
        )}
      />
    </div>
  )
}
