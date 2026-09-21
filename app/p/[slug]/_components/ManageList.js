'use client'

import { useState } from 'react'

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

  const list = Array.isArray(items) ? items : []
  const canDrag = list.length > 1

  function startDrag(event, id) {
    if (!canDrag) return
    setDragId(id)
    event.dataTransfer.effectAllowed = 'move'
    try {
      // Firefox will not start a drag without payload on the transfer.
      event.dataTransfer.setData('text/plain', id)
    } catch {
      // Refused outside a gesture it recognises; the drag still works from
      // component state.
    }
  }

  function overRow(event, id) {
    if (!canDrag || !dragId) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    if (id !== overId) setOverId(id)
  }

  function dropOn(event, id) {
    if (!canDrag || !dragId) return
    event.preventDefault()
    const from = dragId
    setDragId(null)
    setOverId(null)
    if (from !== id) onDrop?.(from, id)
  }

  function endDrag() {
    setDragId(null)
    setOverId(null)
  }

  return (
    <div className="hp-manage">
      <p className="hp-manage-note">{note}</p>

      {notice ? <p className="hp-manage-notice" role="status">{notice}</p> : null}

      {list.length === 0 ? (
        <p className="hp-manage-empty">{emptyNote}</p>
      ) : (
        <ul className="hp-manage-rows">
          {list.map(row => {
            const busy = busyId === row.id
            const hidden = row.hidden === true
            return (
              <li
                key={row.id}
                className="hp-manage-row"
                data-hidden={hidden ? 'true' : undefined}
                data-dragging={dragId === row.id ? 'true' : undefined}
                data-dropping={overId === row.id && dragId !== row.id ? 'true' : undefined}
                draggable={canDrag && row.placed !== false}
                onDragStart={e => startDrag(e, row.id)}
                onDragOver={e => overRow(e, row.id)}
                onDrop={e => dropOn(e, row.id)}
                onDragEnd={endDrag}
              >
                <span className="hp-manage-grip" aria-hidden="true"><GripIcon /></span>

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
