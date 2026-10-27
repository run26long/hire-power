'use client'

import { useCallback, useRef, useState } from 'react'

// ============================================================================
// DRAGGING A CARD ON THE PAGE ITSELF
//
// The same gesture the Manage list is built on, over a grid instead of a
// column. Pointer events, from the grip only, with the grip holding the
// pointer for the whole gesture - so the reasons are the ones written up in
// ManageList and are not repeated here. What is different is the geometry and
// the fact that the thing being dragged is also a button.
//
// WHY THE GRIP IS A SPAN AND NOT A BUTTON
// A card is a button: pressing it opens the item. A button inside a button is
// markup no keyboard and no screen reader can resolve, so the grip stays the
// decorative span it already was and takes pointer handlers instead. That is
// exactly what the Manage list's grip is. The drag is a pointer gesture with
// no keyboard path through it either way, and the keyboard route to reordering
// is the Manage panel, which is a real list of real controls.
//
// WHAT STOPS THE CARD OPENING
// A press that lands on the grip is never a press on the card. The grip stops
// the pointerdown and the click from reaching it, so a drag that ends where it
// started closes nothing and opens nothing.
//
// WHERE THE LINE GOES, IN A GRID
// Not above or below: in a grid a horizontal rule between two cells says
// nothing about which cell is meant. The line is vertical and on the edge the
// card will arrive at - the target's trailing edge when travelling forward
// through the order, its leading edge when travelling back - which is the same
// rule the Manage list draws with, turned ninety degrees.
// ============================================================================

export function useGridDrag({ ids, enabled, onDrop }) {
  const [dragId, setDragId] = useState(null)
  const [overId, setOverId] = useState(null)
  const fieldRef = useRef(null)
  // The gesture in progress, off React state, for the reason ManageList gives:
  // pointermove reads it tens of times a second and the release has to see
  // whatever the last move saw.
  const gesture = useRef(null)

  const order = Array.isArray(ids) ? ids : []
  const canDrag = Boolean(enabled) && order.length > 1
  const known = new Set(canDrag ? order : [])

  const sideFor = useCallback((fromId, toId) => {
    const from = order.indexOf(fromId)
    const to = order.indexOf(toId)
    if (from === -1 || to === -1 || from === to) return null
    return to > from ? 'after' : 'before'
  }, [order])

  const clearDrag = useCallback(() => {
    gesture.current = null
    setDragId(null)
    setOverId(null)
  }, [])

  // The card under the pointer, read from the document rather than from
  // crossing events: the grip is holding the pointer and no other card is
  // receiving any.
  const cardUnder = useCallback((clientX, clientY) => {
    if (typeof document === 'undefined') return null
    const at = document.elementFromPoint(clientX, clientY)
    const card = at?.closest?.('[data-drag-id]')
    if (!card || !fieldRef.current?.contains(card)) return null
    return card.getAttribute('data-drag-id') || null
  }, [])

  const gripProps = useCallback((id) => {
    if (!canDrag || !known.has(id)) return { 'data-drag': 'false' }
    return {
      'data-drag': 'true',
      onPointerDown: (event) => {
        if (typeof event.button === 'number' && event.button !== 0) return
        // The card underneath must not treat this as a press on itself.
        event.stopPropagation()
        event.preventDefault()
        gesture.current = { id, pointerId: event.pointerId, overId: null }
        setDragId(id)
        setOverId(null)
        try {
          event.currentTarget.setPointerCapture(event.pointerId)
        } catch {
          // No capture available: the drag still tracks, it just ends early
          // if the pointer leaves the grip.
        }
      },
      onPointerMove: (event) => {
        const drag = gesture.current
        if (!drag || event.pointerId !== drag.pointerId) return
        const over = cardUnder(event.clientX, event.clientY)
        // Off the field, or over the card being dragged: the last good target
        // stands, so a wobble on the way across does not drop it back where
        // it started.
        if (!over || over === drag.id || !known.has(over)) return
        if (over !== drag.overId) {
          drag.overId = over
          setOverId(over)
        }
      },
      onPointerUp: (event) => {
        const drag = gesture.current
        if (!drag || event.pointerId !== drag.pointerId) return
        const { id: moved, overId: target } = drag
        // Cleared before the write, so a slow save cannot leave a card
        // looking picked up.
        clearDrag()
        if (target && target !== moved) onDrop?.(moved, target)
      },
      onPointerCancel: clearDrag,
      // Belt and braces with the stopped pointerdown: whatever the browser
      // decides to synthesise, a press that began on the grip does not reach
      // the card.
      onClick: (event) => { event.stopPropagation(); event.preventDefault() }
    }
  }, [canDrag, known, cardUnder, clearDrag, onDrop])

  const dropSide = useCallback(
    (id) => (overId === id ? sideFor(dragId, id) || undefined : undefined),
    [overId, dragId, sideFor]
  )

  return { fieldRef, dragId, overId, canDrag, gripProps, dropSide }
}
