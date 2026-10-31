'use client'

import { useCallback, useMemo, useState } from 'react'

import Reveal from './Reveal'
import PortfolioLightbox from './PortfolioLightbox'
import PortfolioMat from './PortfolioMat'
import EvidenceThumb from './EvidenceThumb'
import AddEvidence from './AddEvidence'
import { useViewerAuthHeaders } from '../_lib/viewerAuth'
import { SlotGuide, SlotGhost, SectionHiddenChip, Lock, useEditSlot } from './EditAffordance'
import { useCanShowEmpty, useCanEdit, useProfileEdit, useShowUpgradeModal } from '../_lib/editContext'
import { directionsByItem, rowsForDirection, selectForDirection } from '../_lib/profileData'
import { PICKABLE } from './DirectionPicker'
import { PORTFOLIO_PREVIEW_DESKTOP, isPortfolioItem } from '@/lib/portfolio'
import ManageList from './ManageList'
import { usePaneGuard } from './ManageShell'
import { EvidenceEditPane, useEvidenceDelete } from './ManagePanes'
import { useGridDrag } from '../_lib/gridDrag'

// ============================================================================
// PORTFOLIO
//
// The visual work, shown as work rather than as a list of files. Evidence
// answers "what backs this up"; this answers "what does it look like", and the
// two are the same table read through different questions - the split is one
// rule in lib/portfolio, so an item can never be in both or in neither.
//
// SQUARE MATS, CONTAINED PICTURES
// The grid is square because a grid of mixed aspect ratios is a ransom note.
// The pictures inside are not: `object-fit: contain` puts a portrait photo and
// a landscape still on the same mat without cropping either, and a crop is an
// edit nobody asked this page to make to somebody's work.
//
// THE THUMBNAIL IS ASKED FOR, NEVER CARRIED
// The payload says a preview exists; it never says where. Each mat asks the
// evidence media route for a signed thumbnail by id, and that route checks
// this direction may show this item before it signs anything. A signed URL
// lives ten minutes, so one that expires under a reader who left the page open
// is re-signed once on error rather than left as a broken square.
//
// THE SECTION IS THE SELECTION
// Six on the page and the rest one step away, for the reason the Evidence
// preview gives: a wall that grows with the collection turns a profile into a
// filing cabinet. Which six is the direction's own placement order, so the
// same portfolio can lead with different work under different directions.
// ============================================================================

export default function PortfolioSection({ items, slug, lensId, animate, directionKey }) {
  // null | { mode: 'grid' } | { mode: 'item', index, fromGrid }
  const [overlay, setOverlay] = useState(null)

  // One identity for the squares in the Manage panel, so a long list shares
  // the signing work the mats above already share.
  const viewerHeaders = useViewerAuthHeaders()

  const [visit, setVisit] = useState(0)
  // Bumped by the guidance mat to open the add panel that lives below.
  const [openAdd, setOpenAdd] = useState(0)
  // Which row has a write in flight, so one switch can go quiet without
  // freezing the list around it.
  const [busyId, setBusyId] = useState(null)
  // Which item's fields have taken the modal over, if any. null is the list.
  const [editingId, setEditingId] = useState(null)

  // A direction change replaces the collection. Anything open belonged to the
  // direction that is leaving.
  const [shownFor, setShownFor] = useState(directionKey)
  if (shownFor !== directionKey) {
    setShownFor(directionKey)
    if (overlay) setOverlay(null)
  }

  const canShowEmpty = useCanShowEmpty()
  const canEdit = useCanEdit()
  const showUpgrade = useShowUpgradeModal()
  const slot = useEditSlot()

  // ---- THE ARRANGEMENT AS THE OWNER JUST LEFT IT ----
  //
  // A drop used to wait for the server before anything moved, which on a slow
  // connection is a card that does not budge and a page with no sign that
  // anything is happening. The order moves first and the write follows it; a
  // failure puts the order back and says why, which is the same bargain the
  // Career Directions reorder in the Settings drawer makes.
  //
  // Held only until the reload brings the real order back from the table.
  // Left in place after that it would out-rank the table on the next render.
  const [draftOrder, setDraftOrder] = useState(null)
  const arrange = useCallback((list) => {
    if (!draftOrder) return list
    const rank = new Map(draftOrder.map((id, at) => [id, at]))
    // Stable, so anything the draft does not name - an item added in another
    // tab, an orphan - keeps the order it had and stays behind what it does.
    return [...list].sort(
      (a, b) =>
        (rank.has(a.id) ? rank.get(a.id) : Infinity) -
        (rank.has(b.id) ? rank.get(b.id) : Infinity)
    )
  }, [draftOrder])

  // Placement order, and nothing but. The lead is whatever this direction
  // put first, so there is one answer to "what leads this section" and it is
  // the same answer the Manage list is showing.
  const ordered = arrange(items || [])

  // The two ways in each start a visit, so the overlay mounts fresh. Moving
  // between the grid and one item inside a single visit keeps the key, and
  // therefore the scroll position the grid was left at.
  const openAt = useCallback((index) => {
    setVisit(n => n + 1)
    setOverlay({ mode: 'item', index, fromGrid: false })
  }, [])
  const openGrid = useCallback(() => {
    setVisit(n => n + 1)
    setOverlay({ mode: 'grid' })
  }, [])

  // ...and these two move around inside one.
  const fromGrid = useCallback((index) => setOverlay({ mode: 'item', index, fromGrid: true }), [])
  const backToGrid = useCallback(() => setOverlay({ mode: 'grid' }), [])
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
  // This direction's placements, shown and hidden together, and never the
  // whole collection: work nobody has placed anywhere is not something to
  // un-hide, it is something to add.
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

  // EVERY piece of work the owner has, whichever direction is open, in two
  // groups: the open direction's own order first, because that is what this
  // panel's drag rearranges, then everything it does not hold in the
  // collection's order.
  const manageItems = useMemo(() => {
    const rows = rowsForDirection(edit?.allPlacements, lensId, 'evidence_id')
    // Portfolio is the visual half of the same collection, so the list is
    // filtered to what this section actually renders.
    const mine = (edit?.allEvidence || []).filter(isPortfolioItem)
    const on = directionsByItem(mine, edit?.allPlacements, 'evidence_id', pickable)

    const here = arrange(selectForDirection(mine, rows, { includeHidden: true }))
    const held = new Set(here.map(one => one.id))
    const rest = mine.filter(one => !held.has(one.id))

    const row = (item, placed) => ({
      id: item.id,
      title: item.title || 'Untitled',
      meta: [item.organization, item.date_label].filter(Boolean).join(' · '),
      // The record itself, for the square at the head of the row. The same
      // picture the mat above is showing, asked for the same way.
      item,
      on: on.get(item.id) || [],
      // On the open direction, so it has a position in it to drag. The same
      // question the route asks before it materialises, so the list this
      // panel offers controls over and the list the route resolves them
      // against cannot drift apart.
      placed
    })

    return [...here.map(one => row(one, true)), ...rest.map(one => row(one, false))]
  }, [edit?.allEvidence, edit?.allPlacements, lensId, arrange, pickable])

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
  // Resolved from the record rather than held in state: an edit that lands
  // changes the record, and the pane has to be looking at what was saved.
  const editingItem = useMemo(
    () => (editingId ? (edit?.allEvidence || []).find(one => one.id === editingId) || null : null),
    [editingId, edit?.allEvidence]
  )

  // Deleting for good, from a row in the list. Same hook, same dialog and
  // same call as the Delete in the Edit pane, so the two cannot drift.
  const del = useEvidenceDelete()

  // A drop says where the item goes, by naming the row it was dropped on, and
  // the route resolves the position. The panel must not count the rows between
  // them: this list is the visual half of a collection that shares one
  // placement list with Evidence, so the rows in between here are not all the
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
  // Owner, in Edit mode, and nowhere else: the grip itself renders only when
  // editing, so Preview and the public page have nothing to drag by. The drop
  // sends the same two ids to the same op the panel sends them to, which is
  // why the two orders cannot come apart.
  const shownIds = useMemo(
    () => ordered.slice(0, PORTFOLIO_PREVIEW_DESKTOP).map(one => one.id),
    [ordered]
  )
  const drag = useGridDrag({
    ids: shownIds,
    enabled: canEdit && Boolean(edit?.editing),
    onDrop: dropItem
  })

  // Empty, this section is not on the public page at all - the same rule every
  // other section follows. The owner still sees it, because an absence they
  // cannot see is an absence they cannot fill.
  if (ordered.length === 0 && !canShowEmpty) return null

  // Always the selection, never the archive: six, in the order the owner put
  // them in.
  const shown = ordered.slice(0, PORTFOLIO_PREVIEW_DESKTOP)
  const hidden = ordered.length - shown.length

  return (
    <div className="hp-practice-part hp-pf-section">
        <Reveal enabled={animate} className="hp-pf-intro">
          <h3 className="hp-practice-sub">Portfolio<SectionHiddenChip /></h3>
          <p className="hp-practice-line">The work, in frame and in motion.</p>
        </Reveal>

        {/* One control for the whole section, at the top right, and it opens
            the gallery the section already had. Adding is in there too: a
            second button out here was the owner being asked the same question
            in two places. */}
        {canShowEmpty ? (
          <div className="hp-ed-manage-row">
            {/* Beside Manage rather than under it, and only where the grid
                has no slot left to ask in: below that count the next mat
                carries the invitation, and a second control saying the same
                thing would be the owner asked the same question twice. The
                row renders for an owner in Edit mode on every plan, and a
                gated press opens the Pro modal rather than the panel. */}
            {shown.length >= PORTFOLIO_PREVIEW_DESKTOP ? (
              <button
                type="button"
                className="hp-ed-action"
                data-primary="true"
                onClick={canEdit ? () => setOpenAdd(n => n + 1) : showUpgrade}
              >
                {canEdit ? null : <Lock />}+ Add to portfolio
              </button>
            ) : null}

            <button type="button" className="hp-ed-manage" onClick={canEdit ? openManage : showUpgrade} aria-haspopup="dialog">
              {canEdit ? null : <Lock />}Manage portfolio
            </button>
          </div>
        ) : null}

        {ordered.length === 0 && canShowEmpty ? (
          // The public grid, with the guidance living in the first mat.
          //
          // Same ul, same class, same six cells at the same sizes and gaps the
          // section uses when it is full, so this is the finished composition
          // with its first square explaining itself rather than a drawing of
          // one. Three across and two down here, two across and three down on
          // a phone, because that is what .hp-pf-grid already does and nothing
          // here re-states it.
          <ul className="hp-pf-grid" data-count="6">
            <li className="hp-pf-cell">
              <span className="hp-pf-mat hp-ed-guide-mat hp-ed-incomplete">
                <span className="hp-ed-pill">Show your work</span>
                <span className="hp-pf-mat-frame">
                  <SlotGuide
                    index="01"
                    heading="Show the work itself."
                    action="Add to portfolio"
                    feature="portfolio"
                    onAction={() => setOpenAdd(n => n + 1)}
                  >
                    A resume can only describe the work. Your Career Profile lets
                    people see it. Add photos or video of what you built, led,
                    improved, or delivered.
                  </SlotGuide>
                </span>
              </span>
            </li>

            {['02', '03', '04', '05', '06'].map(n => (
              <li className="hp-pf-cell" key={n}>
                <span className="hp-pf-mat hp-ed-ghost-mat">
                  <span className="hp-pf-mat-frame"><SlotGhost index={n} /></span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Reveal enabled={animate}>
            {/* The grid and the way into the rest are one composition, so they
                share a positioned box: the control sits on the grid's
                lower-right corner and overhangs it, the way the Evidence
                section's does on its lead card. The field is what the control
                is positioned against; the grid keeps its own geometry. */}
            <div className="hp-pf-field" data-more={hidden > 0 ? 'true' : 'false'}>
            <ul className="hp-pf-grid" ref={drag.fieldRef} data-count={String(shown.length)}>
              {shown.map((item, index) => (
                <li
                  className="hp-pf-cell"
                  key={item.id}
                  data-drag-id={item.id}
                  data-dragging={drag.dragId === item.id ? 'true' : undefined}
                  data-drop={drag.dropSide(item.id)}
                >
                  <PortfolioMat
                    item={item}
                    slug={slug}
                    lensId={lensId}
                    slot={slot}
                    onOpen={() => openAt(index)}
                    gripProps={drag.gripProps(item.id)}
                  />
                </li>
              ))}

              {/* Part way through. The next real mat carries the invitation and
                  the rest stay numbered, so a portfolio of two reads as two of
                  six rather than as two and a gap. */}
              {canShowEmpty && shown.length < PORTFOLIO_PREVIEW_DESKTOP && (
                <li className="hp-pf-cell">
                  <span className="hp-pf-mat hp-ed-guide-mat">
                    <span className="hp-pf-mat-frame">
                      <SlotGuide
                        index={String(shown.length + 1).padStart(2, '0')}
                        heading="Add another."
                        action="Add to portfolio"
                        feature="portfolio"
                        onAction={() => setOpenAdd(n => n + 1)}
                      >
                        Six appear here, and a reader can open any of them full size.
                      </SlotGuide>
                    </span>
                  </span>
                </li>
              )}

              {canShowEmpty && Array.from(
                { length: Math.max(0, PORTFOLIO_PREVIEW_DESKTOP - shown.length - 1) },
                (_, i) => String(shown.length + i + 2).padStart(2, '0')
              ).map(n => (
                <li className="hp-pf-cell" key={n}>
                  <span className="hp-pf-mat hp-ed-ghost-mat">
                    <span className="hp-pf-mat-frame"><SlotGhost index={n} /></span>
                  </span>
                </li>
              ))}
            </ul>

            {/* Offered only when there is something the six did not show.
                Six or fewer and the grid is the whole portfolio, so an action
                promising more would open a gallery the reader has already
                read. The count is the whole collection, not the remainder:
                "(8)" is what the reader will find on the other side of it. */}
            {hidden > 0 && (
              <button
                type="button"
                className="hp-pf-all"
                onClick={openGrid}
                aria-haspopup="dialog"
              >
                View full portfolio ({ordered.length})
                <span className="hp-pf-all-arrow" aria-hidden="true">→</span>
              </button>
            )}
            </div>
          </Reveal>
        )}

        {/* The add flow itself, with no trigger of its own: the control in
            the Manage row opens it, the same way the guidance mat does. */}
        {canEdit
          ? <AddEvidence only="visual" openSignal={openAdd} trigger={false} />
          : null}

      <PortfolioLightbox
        key={`${directionKey}:${visit}`}
        mode={overlay?.mode || null}
        items={ordered}
        startIndex={overlay?.index ?? 0}
        slug={slug}
        lensId={lensId}
        onOpenItem={fromGrid}
        onBack={overlay?.fromGrid ? backToGrid : null}
        // Guarded, so a half-typed edit is never lost to the X, Escape or a
        // press on the backdrop. See the note beside paneGuard.
        onClose={paneGuard.requestClose}
        // The same gate the section's own Manage control stands behind, so
        // the grid can never offer a way into a panel this account does not
        // get. Absent outside Edit mode, which is how Preview and the public
        // page end up with no button at all.
        onManage={canShowEmpty ? (canEdit ? openManage : showUpgrade) : undefined}
        manageTitle={editingItem ? 'Edit work' : 'Manage portfolio'}
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
            // As the owner, for the reason the evidence panel does it: this
            // list carries the private items and the ones no direction is
            // showing, which the public media route refuses by design.
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
            addLabel="Add to portfolio"
            onDone={close}
            emptyNote="Nothing here yet. Add work to start."
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
