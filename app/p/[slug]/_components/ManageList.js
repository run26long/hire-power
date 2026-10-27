'use client'

import { Fragment, useCallback, useRef, useState } from 'react'

import useNarrow from '../_lib/useNarrow'

// ============================================================================
// MANAGING WHAT A DIRECTION SHOWS
//
// One list, three collections. Portfolio, Evidence and Testimonials all ask
// the owner the same two questions about the same kind of thing - is this
// direction showing it, and in what order - so they ask them with the same
// control rather than three that drift.
//
// WHAT IS IN THE LIST
// Exactly what this direction has placed, shown and hidden together. Not the
// whole Knowledge Base: an item nobody has ever put on the profile is not
// something to un-hide, it is something to add, and Add is its own flow with
// its own form. A management list that quietly enumerated everything the
// account owns would turn "which of these am I showing" into "which of these
// do I have", which is a different question and a much longer list.
//
// WHAT IS IN THE LIST, SECOND VERSION
// Everything the owner has, whichever direction is open on the page. A list
// narrowed to one direction could not answer the question it is now asked -
// where does this appear - because the items it left out are exactly the ones
// whose answer is "not here".
//
// ONE COLUMN PER DIRECTION, AND OFF IS THE ABSENCE OF A ROW
// Each row carries a switch for each active direction, under a header naming
// it, with the direction open on the page marked. On means the item appears
// there. Every one of them writes through the same route the direction picker
// uses: scope and the whole set of directions in one request, never a single
// row, because "on every direction including ones that do not exist yet" is
// not a set of rows and a per-row write cannot say it.
//
// Turning one off therefore deletes that direction's placement, and turning
// it back on appends the item to the end of that direction. That is the
// bargain the picker always made, and both controls now make it.
//
// ORDER IS PER DIRECTION
// The list reads in the order of the direction open on the page, and dragging
// reorders that direction alone. An item that is not on it has no position in
// it to drag, so it sits below a divider with no grip, in the collection's own
// order.
//
// DELETING IS NOT ANY OF THIS
// It takes the item off every direction at once and there is no way back, so
// it is a separate control with its own weight: a trash button, the same one
// the Settings drawer uses on a career direction, behind the same confirmation
// that names the item. A list given no `onDelete` draws no trash button at
// all, which is how Testimonials keeps the delete it already has in its pane.
//
// ONE WAY TO MOVE A ROW
// The grip. A pair of arrows beside it was a second control saying the same
// thing, and two controls for one job is what made the row look like a form.
//
// HOW THE DRAG IS BUILT, AND WHY NOT WITH HTML5 DRAG AND DROP
// Pointer events, from the grip only. The row used to carry `draggable` with
// dragstart/dragover/drop on it, which has two problems.
//
// The first is that HTML5 drag and drop does not exist on touch. No mobile
// browser synthesises dragstart from a finger, so on a phone or a touch
// laptop the grip was decoration: dragging it scrolled the list. Pointer
// events are one API over mouse, touch and pen, so there is one
// implementation here rather than a drag path and a touch path that can
// disagree.
//
// The second is that a draggable row is draggable by its text and its padding
// too, so the gesture that picks a row up is also the gesture that selects
// its title. The grip is the only handle now, which is what it was always
// drawn to look like.
//
// Scrolling still works everywhere else in the list. `touch-action: none` is
// set on the grip alone, so a finger anywhere but the grip scrolls the rows
// the way it always did, and pointer capture on the grip means the browser
// does not also try to scroll once a drag has started.
//
// WHERE A ROW LANDS
// On the row it was dropped on, taking its place, which is what the route's
// `move` op does with the two ids. So the line marking the drop is drawn on
// the edge the row will arrive at - under the target when it is travelling
// down the list, over it when travelling up - rather than always on top,
// which pointed at the wrong edge for half of all drags.
// ============================================================================

function TrashIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  )
}

function GripIcon() {
  return (
    <svg className="hp-manage-grip-mark" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="3" y="4" width="10" height="1.4" rx="0.7" />
      <rect x="3" y="7.3" width="10" height="1.4" rx="0.7" />
      <rect x="3" y="10.6" width="10" height="1.4" rx="0.7" />
    </svg>
  )
}

export default function ManageList({
  // [{ id, title, meta, on, placed }] in the open direction's reading order,
  // everything it does not hold behind it. `on` is the directions this item
  // appears on, or undefined for a row that cannot be placed yet - a
  // testimonial nobody has written, or one waiting on the owner - which shows
  // its status where the switches would be instead.
  items,
  busyId,           // the row with a write in flight
  onDrop,           // (fromId, toId)
  onEdit,           // (id) -> takes the modal over with that item's fields
  onDelete,         // optional; (row) -> asks to delete the item for good
  deletingId,       // the row whose delete is in flight, if any
  // ---- where each item appears ----
  directions = [],      // [{ id, name }], the active ones, at most three
  activeLensId = null,  // the one open on the page, marked in the header
  onSetDirection,       // (row, lensId, next) -> writes the whole membership
  onAdd,            // optional; omitted where a collection has no add flow
  addLabel = 'Add',
  secondaryLabel,   // optional second footer action, beside the first
  onSecondary,
  onDone,
  emptyNote,
  notice,           // optional; a line confirming what just happened, above the rows
  // What this particular list is for, in one line. The panel is a list of
  // rows with controls on them; a paragraph above it explaining the controls
  // is read once and then in the way for good.
  note = 'Drag any item in the current Career Direction to reorder. Use the toggles to choose which Career Direction(s) each item appears in.',
}) {
  const [dragId, setDragId] = useState(null)
  const [overId, setOverId] = useState(null)
  const listRef = useRef(null)

  // ---- THREE COLUMNS, OR ONE AND A WAY TO CHOOSE IT ----
  //
  // Three switches, a title, a trash and an Edit do not fit across a phone.
  // Below the breakpoint the panel shows one direction at a time and puts the
  // choice at the top, starting on the one open on the page - which is the
  // one somebody came here to arrange.
  const narrow = useNarrow()
  const [picked, setPicked] = useState(null)
  // A direction change on the page behind resets the choice to it, the same
  // way opening the panel would.
  const [shownFor, setShownFor] = useState(activeLensId)
  if (shownFor !== activeLensId) {
    setShownFor(activeLensId)
    setPicked(null)
  }
  const shownId = directions.some(one => one.id === picked)
    ? picked
    : (directions.some(one => one.id === activeLensId) ? activeLensId : directions[0]?.id || null)
  const columns = narrow ? directions.filter(one => one.id === shownId) : directions
  // The gesture in progress, off React state: pointermove has to read it tens
  // of times a second and the release has to read whatever the last move saw,
  // neither of which can wait for a render.
  const gesture = useRef(null)

  const list = Array.isArray(items) ? items : []
  // Dragging reorders the open direction, so it takes two rows in it - not
  // two rows in the list, most of which may be sitting below the divider.
  const canDrag = list.filter(row => row?.placed !== false).length > 1
  // A row with no placement on this direction has no position in it, so there
  // is nothing to drag and nothing to drop onto. Named once, because the grip,
  // the drop target and the drop itself all have to agree about it.
  const movable = (row) => canDrag && row?.placed !== false
  const movableIds = new Set(list.filter(movable).map(row => row.id))

  // Which edge of the target the line goes on: the edge the dragged row will
  // arrive at once it has taken the target's place.
  const sideFor = (fromId, toId) => {
    const from = list.findIndex(row => row.id === fromId)
    const to = list.findIndex(row => row.id === toId)
    if (from === -1 || to === -1 || from === to) return null
    return to > from ? 'below' : 'above'
  }

  const clearDrag = useCallback(() => {
    gesture.current = null
    setDragId(null)
    setOverId(null)
  }, [])

  function startDrag(event, id) {
    if (!movableIds.has(id)) return
    // A right-click or a middle-click on the grip is not a drag, and the
    // context menu should still open.
    if (typeof event.button === 'number' && event.button !== 0) return

    gesture.current = { id, pointerId: event.pointerId, overId: null }
    setDragId(id)
    setOverId(null)

    // The grip keeps the pointer for the whole gesture, so moves and the
    // release land here even when the finger has travelled over other rows,
    // and the browser stops reading the gesture as a scroll.
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // No capture available: the drag still tracks, it just ends early if
      // the pointer leaves the grip.
    }
    // Stops a mouse drag from selecting the row's text on the way past.
    event.preventDefault()
  }

  // The row under the pointer, read from the document rather than from
  // crossing events, because the grip is holding the pointer and no other row
  // is receiving any.
  function rowUnder(clientX, clientY) {
    if (typeof document === 'undefined') return null
    const at = document.elementFromPoint(clientX, clientY)
    const row = at?.closest?.('[data-manage-row]')
    if (!row || !listRef.current?.contains(row)) return null
    return row.getAttribute('data-manage-row') || null
  }

  function moveDrag(event) {
    const drag = gesture.current
    if (!drag || event.pointerId !== drag.pointerId) return
    const over = rowUnder(event.clientX, event.clientY)
    // Off the list, or over a row that has no position of its own: the last
    // good target stands, so a wobble on the way to the edge does not drop
    // the row back where it started.
    if (!over || over === drag.id || !movableIds.has(over)) return
    if (over !== drag.overId) {
      drag.overId = over
      setOverId(over)
    }
  }

  function endDrag(event) {
    const drag = gesture.current
    if (!drag || event.pointerId !== drag.pointerId) return
    const { id, overId: target } = drag
    // Cleared before the write, so a slow save cannot leave a row looking
    // picked up.
    clearDrag()
    if (target && target !== id) onDrop?.(id, target)
  }

  return (
    <div className="hp-manage" style={{ '--hp-manage-cols': columns.length || 1 }}>
      <p className="hp-manage-note">{note}</p>

      {notice ? <p className="hp-manage-notice" role="status">{notice}</p> : null}

      {/* One direction at a time, on a phone. The chips are the editor's own,
          and the one showing is the pressed one. */}
      {narrow && directions.length > 1 ? (
        <div className="hp-ed-lens-picks hp-manage-switcher" role="group" aria-label="Career Direction">
          {directions.map(one => (
            <button
              key={one.id}
              type="button"
              className="hp-ed-lens-chip"
              aria-pressed={one.id === shownId}
              onClick={() => setPicked(one.id)}
            >
              {one.name}
            </button>
          ))}
        </div>
      ) : null}

      {/* The names over the columns they belong to. Right-aligned past the
          width the trash and Edit take, so each name stands over its own
          switch without the rows and this header having to share a grid. */}
      {list.length > 0 && columns.length > 0 ? (
        <div className="hp-manage-head">
          <span className="hp-manage-dirs">
            {columns.map(one => (
              <span
                key={one.id}
                className="hp-manage-dir-name"
                data-open={one.id === activeLensId ? 'true' : undefined}
                title={one.name}
              >
                {one.name}
              </span>
            ))}
          </span>
        </div>
      ) : null}

      {list.length === 0 ? (
        <p className="hp-manage-empty">{emptyNote}</p>
      ) : (
        <ul className="hp-manage-rows" ref={listRef} data-dragging={dragId ? 'true' : undefined}>
          {list.map((row, at) => {
            const busy = busyId === row.id || deletingId === row.id
            const loose = row.placed === false
            // The first row the open direction does not hold. Everything from
            // here down is in the collection's order rather than in this
            // direction's, because this direction has given it none.
            const divider = loose && at > 0 && list[at - 1]?.placed !== false
            return (
              <Fragment key={row.id}>
              {divider ? <li className="hp-manage-split" role="presentation" /> : null}
              <li
                className="hp-manage-row"
                data-manage-row={row.id}
                data-loose={loose ? 'true' : undefined}
                data-dragging={dragId === row.id ? 'true' : undefined}
                data-drop={overId === row.id ? sideFor(dragId, row.id) || undefined : undefined}
              >
                {/* Decorative to a screen reader, which is what it is: the
                    drag is a pointer gesture and there is no keyboard or
                    assistive path through it, so announcing a handle here
                    would promise one. */}
                <span
                  className="hp-manage-grip"
                  aria-hidden="true"
                  data-drag={movable(row) ? 'true' : 'false'}
                  onPointerDown={movable(row) ? (e => startDrag(e, row.id)) : undefined}
                  onPointerMove={movable(row) ? moveDrag : undefined}
                  onPointerUp={movable(row) ? endDrag : undefined}
                  onPointerCancel={movable(row) ? clearDrag : undefined}
                >
                  {/* Always drawn, and hidden by the stylesheet where there
                      is no position in this direction to move. The mark is
                      what gives this element its width, so a row without one
                      would start its title left of every row above it. */}
                  <GripIcon />
                </span>

                <span className="hp-manage-label">
                  <span className="hp-manage-title">{row.title}</span>
                  {row.meta ? <span className="hp-manage-meta">{row.meta}</span> : null}
                </span>

                {/* One switch per column, under the name of the direction it
                    answers for. aria-checked says what it means rather than
                    what it stores: on is "this direction shows it".

                    A row with no `on` cannot be placed anywhere yet, so there
                    is nothing to switch and the reason stands in its place. A
                    switch that could not change anything would be a control
                    that lies about what it does. */}
                {columns.length > 0 ? (
                  <span className="hp-manage-dirs">
                    {row.on ? columns.map(one => {
                      const on = row.on.includes(one.id)
                      return (
                        <span
                          key={one.id}
                          className="hp-manage-dir"
                          data-open={one.id === activeLensId ? 'true' : undefined}
                        >
                          <button
                            type="button"
                            className="hp-manage-switch"
                            role="switch"
                            aria-checked={on}
                            aria-label={`Show ${row.title} on ${one.name}`}
                            data-on={on ? 'true' : 'false'}
                            disabled={busy}
                            onClick={() => onSetDirection?.(row, one.id, !on)}
                          >
                            <span className="hp-manage-knob" aria-hidden="true" />
                          </button>
                        </span>
                      )
                    }) : (
                      <span className="hp-manage-status" data-tone={row.statusTone || 'wait'}>
                        {row.status}
                      </span>
                    )}
                  </span>
                ) : null}

                {/* Held to one width, because the header above right-aligns
                    the direction names past exactly this much room. Trash
                    before Edit: the destructive one is never the one a thumb
                    reaches by missing the other. */}
                <span className="hp-manage-acts">
                  {onDelete ? (
                    <button
                      type="button"
                      className="w-7 h-7 rounded-full bg-[#fdecea] hover:bg-[#e57373] flex items-center justify-center text-[#e57373] hover:text-white transition-all flex-shrink-0 disabled:opacity-45"
                      disabled={busy}
                      onClick={() => onDelete(row)}
                      title={`Delete ${row.title}`}
                      aria-label={`Delete ${row.title}`}
                    >
                      <TrashIcon />
                    </button>
                  ) : null}

                  {/* A row nobody has decided on yet is not asking to be
                      edited, it is asking to be answered, so the same control
                      says so and takes the weight. */}
                  {onEdit ? (
                    <button
                      type="button"
                      className="hp-manage-edit"
                      data-primary={row.review ? 'true' : undefined}
                      disabled={busy}
                      onClick={() => onEdit(row.id)}
                    >
                      {row.review ? 'Review' : 'Edit'}
                    </button>
                  ) : null}
                </span>
              </li>
              </Fragment>
            )
          })}
        </ul>
      )}

      {/* One group, on the right, with the primary furthest right. Leaving is
          what this footer is for - adding opens another dialog over this one,
          and the reference sheet is a download - so Done takes the weight and
          the other two stand to its left in the order they are reached. */}
      <div className="hp-manage-foot">
        {onSecondary ? (
          <button type="button" className="hp-manage-secondary" onClick={onSecondary}>
            {secondaryLabel}
          </button>
        ) : null}
        {onAdd ? (
          <button type="button" className="hp-manage-add" onClick={onAdd}>{addLabel}</button>
        ) : null}
        <button type="button" className="hp-manage-done" onClick={onDone}>Done</button>
      </div>
    </div>
  )
}
