'use client'

import { useLayoutEffect } from 'react'

// ============================================================================
// A BOX THE SIZE OF WHAT IS IN IT
//
// Every textarea in the owner's editors takes the height of its own content up
// to a ceiling and scrolls after that. None of them can be dragged: the handle
// is gone, because the box is already the right height and dragging it only
// makes it the wrong one.
//
// Layout effect rather than effect: this runs between React writing the DOM
// and the browser painting it, so a box is never briefly the wrong height on
// screen. The measurement itself has to be done here and not in CSS - nothing
// in a stylesheet can measure text.
// ============================================================================

// `shrinkable` is for a box inside a container that may take space back from
// it. The height written below is then a preference rather than a fact, and
// the box has to be able to scroll at whatever height it actually ends up
// with - `hidden` would clip the text instead of letting the owner reach it.
export default function useAutoGrow(ref, value, minRows, maxRows, active = true, shrinkable = false) {
  useLayoutEffect(() => {
    const node = ref.current
    if (!node || !active) return

    const cs = getComputedStyle(node)
    const line = parseFloat(cs.lineHeight) || 20
    const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)
    const border = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth)
    const min = Math.round(line * minRows + pad + border)
    const max = Math.round(line * maxRows + pad + border)

    // Collapsed first, because scrollHeight on an element already taller than
    // its content reports the height it was given rather than the height it
    // needs, and the box would then never shrink again.
    node.style.height = 'auto'
    const needed = node.scrollHeight + border
    node.style.height = `${Math.min(Math.max(needed, min), max)}px`
    node.style.overflowY = shrinkable || needed > max ? 'auto' : 'hidden'
  }, [ref, value, minRows, maxRows, active, shrinkable])
}
