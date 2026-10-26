'use client'

import { useCallback, useRef, useState } from 'react'

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
// NOTHING HERE DELETES
// Hiding is a placement staying exactly where it is and not being rendered.
// The record, the file, the metadata, the Knowledge Base entry and every
// other direction's placements are untouched, and restoring puts the item
// back in the position it held rather than at the end.
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
  items,            // [{ id, title, meta, hidden }] in placement order
  busyId,           // the row with a write in flight
  onToggle,         // (id, nextHidden)
  onDrop,           // (fromId, toId)
  onEdit,           // (id) -> takes the modal over with that item's fields
  onAdd,            // optional; omitted where a collection has no add flow
  addLabel = 'Add',
  secondaryLabel,   // optional second footer action, beside the first
  onSecondary,
  onDone,
  emptyNote,
  notice,           // optional; a line confirming what just happened, above the rows
  // What this particular list is for. Defaulted to the drag-and-toggle
  // sentence the evidence and portfolio lists are described by, because that
  // is all those two do; testimonials pass their own, since that list also
  // carries requests nobody has answered and answers nobody has decided on.
  note = 'Drag to reorder. Toggle an item off to remove it from this career direction. It stays saved, and you can turn it back on anytime.',
}) {
  const [dragId, setDragId] = useState(null)
  const [overId, setOverId] = useState(null)
  const listRef = useRef(null)
  // The gesture in progress, off React state: pointermove has to read it tens
  // of times a second and the release has to read whatever the last move saw,
  // neither of which can wait for a render.
  const gesture = useRef(null)

  const list = Array.isArray(items) ? items : []
  const canDrag = list.length > 1
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
    <div className="hp-manage">
      <p className="hp-manage-note">{note}</p>

      {notice ? <p className="hp-manage-notice" role="status">{notice}</p> : null}

      {list.length === 0 ? (
        <p className="hp-manage-empty">{emptyNote}</p>
      ) : (
        <ul className="hp-manage-rows" ref={listRef} data-dragging={dragId ? 'true' : undefined}>
          {list.map(row => {
            const busy = busyId === row.id
            const hidden = row.hidden === true
            return (
              <li
                key={row.id}
                className="hp-manage-row"
                data-manage-row={row.id}
                data-hidden={hidden ? 'true' : undefined}
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
                  <GripIcon />
                </span>

                <span className="hp-manage-label">
                  <span className="hp-manage-title">
                    {row.title}
                    {/* What state this one is in, where a row has states. A
                        collection whose rows are simply on or off passes no
                        status and nothing is drawn. */}
                    {row.status ? (
                      <span className="hp-manage-status" data-tone={row.statusTone || 'wait'}>
                        {row.status}
                      </span>
                    ) : null}
                  </span>
                  {row.meta ? <span className="hp-manage-meta">{row.meta}</span> : null}
                </span>

                {onEdit ? (
                  <button
                    type="button"
                    className="hp-manage-edit"
                    disabled={busy}
                    onClick={() => onEdit(row.id)}
                  >
                    Edit
                  </button>
                ) : null}

                {/* aria-checked says what the switch means rather than what it
                    stores: on is "this direction shows it", which is the
                    opposite of the hidden flag behind it.

                    A row marked `placed: false` has nothing on this direction
                    to show or hide yet - a testimonial nobody has written, or
                    one waiting on the owner - so there is no switch to offer.
                    A switch that could not change anything would be a control
                    that lies about what it does. */}
                {row.placed === false ? null : (
                  <button
                    type="button"
                    className="hp-manage-switch"
                    role="switch"
                    aria-checked={!hidden}
                    aria-label={`Show ${row.title} on this career direction`}
                    data-on={hidden ? 'false' : 'true'}
                    disabled={busy}
                    onClick={() => onToggle?.(row.id, !hidden)}
                  >
                    <span className="hp-manage-knob" aria-hidden="true" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <div className="hp-manage-foot">
        <span className="hp-manage-foot-left">
          {onAdd ? (
            <button type="button" className="hp-manage-add" onClick={onAdd}>{addLabel}</button>
          ) : null}
          {onSecondary ? (
            <button type="button" className="hp-manage-secondary" onClick={onSecondary}>
              {secondaryLabel}
            </button>
          ) : null}
        </span>
        <button type="button" className="hp-manage-done" onClick={onDone}>Done</button>
      </div>
    </div>
  )
}
