'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// ============================================================================
// THE SELECT THIS PAGE USES INSTEAD OF THE BROWSER'S
//
// A native <select> draws its list with the operating system, which means a
// light grey menu on a dark document and no way to change it. Everything else
// on the Career Profile is themed; the one control that opened a window into
// another application was the one that mattered most, because it is where the
// owner files what they have made.
//
// Lifted out of ManagePanes, where it was written, so the Add form can use the
// same one. Two implementations of a themed select is how two menus come to
// disagree about what Escape does.
//
// WHY THE MENU IS PORTALLED
// It is fixed to the field's box rather than laid out beneath it, which keeps
// it out of the dialog's scrolling. The host is the nearest palette root, so
// it inherits the colour tokens of whatever surface it was opened from.
//
// TWO SHAPES OF OPTION
//   options: ['Award', 'Patent']                      flat, value === label
//   groups:  [{ label: 'Work', options: [...] }]      headed sections
//
// A group header is a row that cannot be chosen: arrow keys step over it, a
// click on it does nothing, and it carries no option role, so a screen reader
// reads it as the presentational heading it is.
// ============================================================================

const PALETTE_ROOTS = '.hp-rt-backdrop, .hp-ev-backdrop, .hp-pf-box, .hp-profile, .hp-ed, .hp-tm'

// One flat list of rows, whichever shape the caller passed. Headers are kept
// in the list rather than nesting the rows, because every piece of behaviour
// here - the active index, the arrow keys, aria-activedescendant - is about a
// position in a list, and a nested shape would have to be flattened for each
// of them separately.
function rowsFor({ options, groups, placeholder }) {
  const rows = [{ value: '', label: placeholder }]
  if (Array.isArray(groups) && groups.length > 0) {
    for (const group of groups) {
      if (!group) continue
      const items = Array.isArray(group.options) ? group.options : []
      if (items.length === 0) continue
      if (group.label) rows.push({ heading: true, label: group.label })
      for (const one of items) {
        rows.push(typeof one === 'string' ? { value: one, label: one } : { value: one.value, label: one.label })
      }
    }
    return rows
  }
  for (const one of Array.isArray(options) ? options : []) rows.push({ value: one, label: one })
  return rows
}

export default function BrandSelect({
  id, value, options, groups, onChange, placeholder = 'Choose one…', disabled = false
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  // Where the menu is mounted and where it stands, in viewport coordinates.
  // Null until both have been worked out, so it is never painted anywhere but
  // under the field.
  const [box, setBox] = useState(null)
  const rootRef = useRef(null)
  const fieldRef = useRef(null)
  const menuRef = useRef(null)

  const rows = rowsFor({ options, groups, placeholder })
  const chosenAt = Math.max(0, rows.findIndex(row => !row.heading && row.value === (value || '')))
  const chosen = rows[chosenAt]

  // The next row in a direction that can actually be landed on, so a heading
  // is stepped over rather than selected.
  const step = (from, by) => {
    let at = from + by
    while (at >= 0 && at < rows.length && rows[at].heading) at += by
    return at >= 0 && at < rows.length ? at : from
  }
  const edge = (by) => (by > 0
    ? step(-1, 1)
    : step(rows.length, -1))

  // Opening starts on what is already chosen, so the first arrow press moves
  // from where the reader is rather than from the top of the list.
  useEffect(() => { if (open) setActive(chosenAt) }, [open, chosenAt])

  // A click anywhere else is a dismissal. Pointer-down rather than click, so
  // the menu is gone before whatever was clicked underneath reacts. The menu
  // is asked separately from the field: it no longer stands inside it, so the
  // field alone would read a click on a row as a click away.
  useEffect(() => {
    if (!open) return
    const away = (event) => {
      if (rootRef.current?.contains(event.target)) return
      if (menuRef.current?.contains(event.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [open])

  // The menu is fixed to the field's box rather than laid out beneath it, which
  // is what keeps it out of the dialog's scrolling. Measured before paint, and
  // again on anything that could move the field under it - the capture phase
  // because the scroll that matters is the dialog's own body, not the window's.
  //
  // Closing leaves the last measurement behind rather than clearing it: nothing
  // reads it while the menu is shut, and the next opening measures again before
  // the browser paints, so the stale numbers are never on screen.
  useLayoutEffect(() => {
    if (!open) return
    const host = rootRef.current?.closest(PALETTE_ROOTS) || document.body
    const place = () => {
      const rect = fieldRef.current?.getBoundingClientRect()
      if (rect) setBox({ host, top: rect.bottom + 4, left: rect.left, width: rect.width })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open])

  const take = (next) => {
    setOpen(false)
    fieldRef.current?.focus()
    if (next !== (value || '')) onChange(next)
  }

  function onKeyDown(event) {
    if (disabled) return
    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        setOpen(true)
      }
      return
    }
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false); fieldRef.current?.focus() }
    else if (event.key === 'ArrowDown') { event.preventDefault(); setActive(at => step(at, 1)) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(at => step(at, -1)) }
    else if (event.key === 'Home') { event.preventDefault(); setActive(edge(1)) }
    else if (event.key === 'End') { event.preventDefault(); setActive(edge(-1)) }
    else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      const row = rows[active]
      if (row && !row.heading) take(row.value ?? '')
    }
    else if (event.key === 'Tab') setOpen(false)
  }

  const menu = (
    <ul
      className="hp-ed-select-list"
      id={`${id}-list`}
      ref={menuRef}
      role="listbox"
      tabIndex={-1}
      style={box ? { top: `${box.top}px`, left: `${box.left}px`, width: `${box.width}px` } : undefined}
    >
      {rows.map((row, at) => (row.heading ? (
        <li
          key={`h-${at}`}
          className="hp-ed-select-heading"
          role="presentation"
        >
          {row.label}
        </li>
      ) : (
        <li
          key={row.value || '_none'}
          id={`${id}-opt-${at}`}
          role="option"
          aria-selected={row.value === chosen.value}
          className="hp-ed-select-option"
          data-active={at === active ? 'true' : undefined}
          data-chosen={row.value === chosen.value ? 'true' : undefined}
          data-empty={row.value ? undefined : 'true'}
          onMouseEnter={() => setActive(at)}
          // Keeps focus on the field, so the list never has to hand it back.
          onMouseDown={event => event.preventDefault()}
          onClick={() => take(row.value)}
        >
          {row.label}
        </li>
      )))}
    </ul>
  )

  return (
    <div className="hp-ed-select" ref={rootRef}>
      <button
        type="button"
        id={id}
        ref={fieldRef}
        className="hp-ed-select-field"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open ? `${id}-opt-${active}` : undefined}
        data-empty={chosen.value ? undefined : 'true'}
        disabled={disabled}
        onClick={() => setOpen(was => !was)}
        onKeyDown={onKeyDown}
      >
        <span className="hp-ed-select-value">{chosen.label}</span>
        <svg className="hp-ed-select-chevron" viewBox="0 0 12 8" aria-hidden="true">
          <path d="M1 1.5 6 6.5l5-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && box ? createPortal(menu, box.host) : null}
    </div>
  )
}
