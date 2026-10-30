'use client'

import { useCallback, useMemo, useState } from 'react'

import Reveal from './Reveal'
import EvidenceOverlay from './EvidenceOverlay'
import EvidenceThumb from './EvidenceThumb'
import { useViewerAuthHeaders } from '../_lib/viewerAuth'
import { EditGrip, SlotGuide, SlotGhost, UpgradeNote, useEditSlot } from './EditAffordance'
import AddEvidence from './AddEvidence'
import { isEvidenceItem } from '@/lib/portfolio'
import ManageList from './ManageList'
import { usePaneGuard } from './ManageShell'
import { EvidenceEditPane, useEvidenceDelete } from './ManagePanes'
import { useCanShowEmpty, useCanEdit, useProfileEdit } from '../_lib/editContext'
import { directionsByItem, rowsForDirection, selectForDirection } from '../_lib/profileData'
import { PICKABLE } from './DirectionPicker'
import { useGridDrag } from '../_lib/gridDrag'
import useNarrow from '../_lib/useNarrow'

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

const typeLabel = (item) => item.evidence_type || FAMILY_LABEL[item.family] || 'Evidence'
const metaOf = (item) => [item.organization, item.date_label].filter(Boolean).join(' · ')

export default function EvidenceSection({ items, slug, lensId, animate, directionKey }) {
  // null | { mode: 'gallery' } | { mode: 'detail', item, fromGallery }
  const [overlay, setOverlay] = useState(null)

  // Passed down to every thumbnail rather than asked for inside each one, so
  // a grid of tiles shares one stable identity and nothing re-signs because
  // something unrelated rendered.
  const viewerHeaders = useViewerAuthHeaders()

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

  // ---- THE ARRANGEMENT AS THE OWNER JUST LEFT IT ----
  //
  // The order moves on the drop and the write follows it, so a slow save is
  // not a card that refuses to budge. A failure puts the order back and says
  // why. Same bargain as the Career Directions reorder in the Settings
  // drawer, and held only until the reload brings the real order back.
  const [draftOrder, setDraftOrder] = useState(null)
  const arrange = useCallback((list) => {
    if (!draftOrder) return list
    const rank = new Map(draftOrder.map((id, at) => [id, at]))
    // Stable, so anything the draft does not name keeps the order it had and
    // stays behind what it does.
    return [...list].sort(
      (a, b) =>
        (rank.has(a.id) ? rank.get(a.id) : Infinity) -
        (rank.has(b.id) ? rank.get(b.id) : Infinity)
    )
  }, [draftOrder])

  // Placement order, and nothing but. The lead is whatever this direction put
  // first, so there is one answer to "what leads this section" and it is the
  // same answer the Manage list is showing.
  const ordered = arrange(items)

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

  // ---- THE EDIT PANE'S UNSAVED WORK, HELD HERE ----
  //
  // The pane is the body of a modal whose X, Escape and backdrop belong to
  // this component, so this is where the guard has to live: the pane reports
  // what it has typed and how to save it, and renders the bar from the same
  // guard. See usePaneGuard in ./ManageShell.
  //
  // It is false until a pane says otherwise, so with no pane open - or nothing
  // typed into one - every way out closes immediately, exactly as before.
  const paneGuard = usePaneGuard({ onClose: close })

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

  // A column for each direction that is on the profile, and no more: three
  // is the most the plan allows at once and the panel is built for three.
  const columns = useMemo(
    () => (edit?.allLenses || [])
      .filter(one => one?.status === 'active')
      .map(one => ({ id: one.id, name: one.name })),
    [edit?.allLenses]
  )

  // Wider than the columns. The picker offers hidden directions too, and a
  // toggle writes the whole membership back, so a direction with no column
  // still has to be in the set or the write would take the item off it.
  const pickable = useMemo(
    () => new Set(
      (edit?.allLenses || []).filter(one => PICKABLE.has(one?.status)).map(one => one.id)
    ),
    [edit?.allLenses]
  )

  // EVERY piece of evidence the owner has, whichever direction is open. The
  // list is answering "where does this appear", and the items it would once
  // have left out are exactly the ones whose answer is "not here".
  //
  // In two groups, never interleaved. The open direction's own order first,
  // because that is the order this panel's drag rearranges; then everything
  // it does not hold, in the collection's order, which is the order the
  // payload arrives in.
  const manageItems = useMemo(() => {
    const rows = rowsForDirection(edit?.allPlacements, lensId, 'evidence_id')
    // Portfolio takes the visual uploads; this section is everything else,
    // and the management list has to agree with what it renders.
    const mine = (edit?.allEvidence || []).filter(isEvidenceItem)
    const on = directionsByItem(mine, edit?.allPlacements, 'evidence_id', pickable)

    const here = arrange(selectForDirection(mine, rows, { includeHidden: true }))
    const held = new Set(here.map(one => one.id))
    const rest = mine.filter(one => !held.has(one.id))

    const row = (item, placed) => ({
      id: item.id,
      title: item.title || typeLabel(item),
      meta: metaOf(item) || typeLabel(item),
      // The record itself, for the square at the head of the row. The list
      // draws the column; what goes in it is this collection's business, and
      // only the record knows whether there is a picture to sign.
      item,
      on: on.get(item.id) || [],
      // On the open direction, so it has a position in it to drag. Asked
      // rather than asserted: the same question the route asks before it
      // materialises, so the list this panel offers controls over and the
      // list the route resolves them against cannot drift apart.
      placed
    })

    return [...here.map(one => row(one, true)), ...rest.map(one => row(one, false))]
  }, [edit?.allEvidence, edit?.allPlacements, lensId, arrange, pickable])

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

  // One switch moves one direction, but the route takes the whole set: scope
  // and rows are one decision, and sending them apart has an intermediate
  // state where the item is on nothing. This is the call the direction picker
  // makes, with the set the switch just changed.
  const setDirection = useCallback(
    (row, directionId, next) => {
      const now = new Set(row.on || [])
      if (next) now.add(directionId)
      else now.delete(directionId)
      return run(row.id, () => edit?.onSetEvidenceDirections?.(row.id, 'selected', [...now]))
    },
    [run, edit]
  )
  // The item whose fields are showing, resolved from the record rather than
  // held in state: an edit that lands changes the record, and the pane has
  // to be looking at what was actually saved.
  const editingItem = useMemo(
    () => (editingId ? (edit?.allEvidence || []).find(one => one.id === editingId) || null : null),
    [editingId, edit?.allEvidence]
  )

  // Deleting for good, from a row in the list. Same hook, same dialog and
  // same call as the Delete in the Edit pane, so the two cannot drift.
  const del = useEvidenceDelete()

  // A drop says where the item goes, by naming the row it was dropped on, and
  // the route resolves the position. The panel must not count the rows between
  // them: this list is the non-visual half of a collection that shares one
  // placement list with Portfolio, so the rows in between here are not all the
  // rows in between there.
  const dropItem = useCallback((fromId, toId) => {
    if (!fromId || !toId || fromId === toId) return
    const ids = manageItems.filter(one => one.placed).map(one => one.id)
    const from = ids.indexOf(fromId)
    const to = ids.indexOf(toId)
    if (from === -1 || to === -1) return

    // The same splice the route performs, so what the owner sees the instant
    // they let go is what the table will hold a moment later.
    const next = ids.slice()
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)

    const previous = draftOrder
    setDraftOrder(next)
    return run(fromId, async () => {
      try {
        await edit?.onMoveEvidence?.(fromId, lensId, toId)
        setDraftOrder(null)
      } catch (err) {
        setDraftOrder(previous)
        throw err
      }
    })
  }, [manageItems, run, edit, lensId, draftOrder])

  // ---- DRAGGING A CARD ON THE PAGE ----
  //
  // Owner, in Edit mode, and nowhere else: the grip renders only when
  // editing, so Preview and the public page have nothing to drag by. The drop
  // sends the same two ids to the same op the panel sends them to.
  //
  // The ids are read from the whole collection rather than from the cards on
  // screen, because how many are on screen depends on the width here and the
  // list has to mean the same thing at both.
  const dragIds = useMemo(() => ordered.map(one => one.id), [ordered])
  const drag = useGridDrag({
    ids: dragIds,
    enabled: canEdit && Boolean(edit?.editing),
    onDrop: dropItem
  })

  // Empty, this section is not on the public page at all. The owner has to
  // see it to put anything in it.
  if (items.length === 0 && !canShowEmpty) return null

  const limit = narrow ? PREVIEW_MOBILE : PREVIEW_DESKTOP
  const preview = ordered.slice(0, limit)
  const hasMore = ordered.length > limit
  const lead = ordered[0]

  // ---- SOMEWHERE TO ADD, IN THE COMPOSITION ITSELF ----
  //
  // Edit mode only, and at every count: one piece of evidence filled the whole
  // row and left the owner with no add spot on the page at all, with the only
  // way in behind the Manage control in the heading.
  //
  // Portfolio's next free mat carries the invitation and the mats after it stay
  // numbered, so a portfolio of two reads as two of six. This is the same tile
  // in the same place: where the preview has a slot left, the add tile is that
  // slot and the rest are future positions, and the grid is told the full count
  // so the arrangement is the finished one rather than one card and a gap -
  // which is exactly what this section already does while it is empty.
  //
  // Where the preview is full there is no slot to take, and taking one would
  // drop a real card the owner placed. Nothing is added to the grid then: the
  // section's own add control comes back beside Manage instead, which is the
  // row the owner's controls for this section already stand in.
  const freeSlots = Math.max(0, limit - preview.length)
  const addTile = canShowEmpty && freeSlots > 0
  // Always the full preview in Edit mode, whether the slots hold items, the
  // guide or ghosts: the arrangement is fixed and only what stands in it
  // changes.
  const gridCount = addTile ? limit : preview.length

  const tile = (item, role) => (
    <button
      type="button"
      key={item.id}
      className={`hp-ev-tile${slot}`}
      data-family={item.family}
      data-media={item.media_class}
      data-role={role}
      data-drag-id={item.id}
      data-dragging={drag.dragId === item.id ? 'true' : undefined}
      data-drop={drag.dropSide(item.id)}
      onClick={() => openDetail(item)}
      aria-haspopup="dialog"
    >
      <EditGrip {...drag.gripProps(item.id)} />

      {/* The same slot whether it holds a picture or a mark. What changes is
          the shape the stylesheet gives it: a band across the top of the lead,
          a larger square on a supporting tile, and the badge it always was for
          an item with no picture of its own. */}
      <EvidenceThumb
        item={item}
        slug={slug}
        lensId={lensId}
        headers={viewerHeaders}
        className="hp-ev-tile-mark"
        markSize={role === 'lead' ? 22 : 18}
      />

      <span className="hp-ev-tile-type">{typeLabel(item)}</span>
      <span className="hp-ev-tile-title">{item.title}</span>

      {/* Every tile carries what the owner wrote about the thing, not just the
          lead. A tile with a title and nothing under it reads as a file name,
          and a row of them reads as a directory listing. */}
      {item.description && <span className="hp-ev-tile-blurb">{item.description}</span>}

      {metaOf(item) && <span className="hp-ev-tile-meta">{metaOf(item)}</span>}
    </button>
  )

  // One control, written once and placed by the breakpoint: on the lead
  // card's corner from tablet up, at the foot of the grid on a phone.
  const viewAll = (
    <button type="button" className="hp-ev-all" onClick={openGallery} aria-haspopup="dialog">
      View all evidence ({ordered.length})
      <span className="hp-ev-all-arrow" aria-hidden="true">→</span>
    </button>
  )

  // Same tile, same guidance, same action the empty section's featured slot
  // offers - so there is one way to add evidence from the page and it looks the
  // same whether the section holds nothing or holds nine. `index` is the slot
  // it stands in.
  const addGuide = (index) => (
    <span className="hp-ev-tile hp-ed-guide-tile" data-role="rest">
      <SlotGuide
        index={index}
        heading="Add another."
        action="Add evidence"
        feature="evidence"
        onAction={() => setOpenAdd(n => n + 1)}
      >
        A few appear here, and a reader can open any of them in full.
      </SlotGuide>
    </span>
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
            {/* Beside Manage rather than under it, and only where the grid
                has no slot left to ask in: below that count the next slot
                carries the invitation, and a second control saying the same
                thing would be the owner asked the same question twice. The
                row renders only for an owner in Edit mode, so neither Preview
                nor the public page has either control. */}
            {freeSlots === 0 ? (
              <button
                type="button"
                className="hp-ed-action"
                data-primary="true"
                onClick={() => setOpenAdd(n => n + 1)}
              >
                + Add evidence
              </button>
            ) : null}

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
            <div className="hp-ev-grid" ref={drag.fieldRef} data-count={String(gridCount)}>
              <div className="hp-ev-lead-slot" data-more={hasMore ? 'true' : 'false'}>
                {lead && tile(lead, 'lead')}

                {/* Straight after the card it belongs to, which is where the
                    keyboard reaches it and where the corner it hangs off is.
                    Stacked on a phone the slot is the first thing in the
                    column, so that position would put the way into the rest
                    of the collection above most of the collection - it goes
                    at the foot of the grid there instead. */}
                {hasMore && !narrow && viewAll}
              </div>

              {preview.slice(1).map(item => tile(item, 'rest'))}

              {/* Part way through the preview: the next slot asks for the next
                  piece, and the slots after it stay numbered. */}
              {addTile && addGuide(String(preview.length + 1).padStart(2, '0'))}

              {addTile && Array.from(
                { length: freeSlots - 1 },
                (_, i) => String(preview.length + i + 2).padStart(2, '0')
              ).map(n => (
                <span className="hp-ev-tile hp-ed-ghost-tile" data-role="rest" key={n}>
                  <SlotGhost index={n} />
                </span>
              ))}

              {/* Last in the grid rather than after it, so it stays inside
                  the rule that closes the section. */}
              {hasMore && narrow && viewAll}
            </div>
          </div>
        </Reveal>
        )}

        {/* The add flow itself, with no trigger of its own: the control in
            the Manage row opens it, the same way the slot guide does. */}
        {canEdit
          ? <AddEvidence openSignal={openAdd} trigger={false} />
          : items.length > 0 ? <UpgradeNote feature="evidence" /> : null}

      <EvidenceOverlay
        key={`${directionKey}:${visit}`}
        mode={overlay?.mode || null}
        item={overlay?.item || null}
        items={ordered}
        slug={slug}
        lensId={lensId}
        onOpenItem={fromGallery}
        onBack={overlay?.fromGallery ? backToGallery : null}
        // Guarded, so a half-typed edit is never lost to the X, Escape or a
        // press on the backdrop. See the note beside paneGuard.
        onClose={paneGuard.requestClose}
        // The same gate the section's own Manage control stands behind, so
        // the gallery can never offer a way into a panel this account does
        // not get. Absent outside Edit mode, which is how Preview and the
        // public page end up with no button at all.
        onManage={canEdit ? openManage : undefined}
        manageTitle={editingItem ? 'Edit evidence' : 'Manage evidence'}
        manageCount={editingItem ? undefined : manageItems.length}
        manageBody={editingItem ? (
          <EvidenceEditPane
            item={editingItem}
            lensId={lensId}
            onBack={() => setEditingId(null)}
            guard={paneGuard}
          />
        ) : (
          <ManageList
            items={manageItems}
            busyId={busyId}
            onDrop={dropItem}
            onEdit={setEditingId}
            // As the owner, not as a reader. This list carries the private
            // items and the ones no direction is showing, and both are rows
            // the public media route exists to refuse.
            thumb={row => (
              <EvidenceThumb
                key={row.id}
                item={row.item}
                owner
                headers={viewerHeaders}
                className="hp-manage-thumb"
                markSize={16}
              />
            )}
            onDelete={del.available ? del.ask : undefined}
            deletingId={del.deletingId}
            directions={columns}
            activeLensId={lensId}
            onSetDirection={setDirection}
            onAdd={() => { close(); setOpenAdd(n => n + 1) }}
            addLabel="Add evidence"
            onDone={close}
            emptyNote="Nothing here yet. Add evidence to start."
          />
        )}
      />

      {/* The same question the Edit pane's Delete asks, asked by the same
          hook. It portals onto the body, so it stands over the panel the row
          was pressed in. */}
      {del.modal}
    </div>
  )
}
