'use client'

import { useProfileEdit, useFieldEditor } from '../_lib/editContext'

// ============================================================================
// EDIT AFFORDANCES
//
// The controls the owner sees laid over their own profile, and nothing else.
//
// Every one of these returns null when there is no edit context, which is the
// case on /p/[slug] for everybody including the owner. So a section can carry
// its affordance unconditionally and the public render is unchanged - there is
// no `isOwner &&` to get backwards, and no way for one of these to reach a
// recruiter.
//
// Some of these write and some do not yet. The ones that do are the ones that
// name a field the document knows how to edit; the rest stay drawn, disabled,
// and saying what they are waiting for, because a section that quietly lost
// its affordance would look finished.
// ============================================================================

const PencilIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
  </svg>
)

const GripIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
    <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
    <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
  </svg>
)

// The region an affordance is positioned against.
//
// Returned as a class to append to an element the section already renders,
// rather than as a wrapper component. A wrapper would introduce a new box into
// layouts that are grid and flex and `display: contents`, and would move
// things in edit mode that stay still in preview - which would make preview
// stop being a preview of the same page. Appending a class adds a positioning
// context and nothing else, and it is an empty string when not editing, so
// the public render is character-for-character what it was.
export function useEditSlot() {
  const edit = useProfileEdit()
  return edit?.editing ? ' hp-ed-slot' : ''
}

// Live where it names a field this document knows how to edit, and inert
// where it does not - the sections that still have no editor keep the pencil
// they were drawn with, disabled and saying so, rather than losing it and
// looking finished.
export function EditPencil({ field, label }) {
  const edit = useProfileEdit()
  const editor = useFieldEditor(field)
  if (!edit?.editing) return null

  if (!field || !editor) {
    return (
      <button
        type="button"
        className="hp-ed-pencil"
        disabled
        aria-label={`Edit ${label} — not available yet`}
        title={`Editing ${label} is coming in a later pass`}
      >
        <PencilIcon />
      </button>
    )
  }

  // While an editor is open the field it belongs to is being edited, so its
  // own pencil has nothing left to offer.
  if (editor.isOpen) return null

  return (
    <button
      type="button"
      className="hp-ed-pencil"
      data-live="true"
      onClick={editor.open}
      aria-label={`Edit ${label}`}
      title={`Edit ${label}`}
    >
      <PencilIcon />
    </button>
  )
}

// A mark rather than a control, and deliberately so.
//
// The thing it sits on - an evidence tile - is itself a button, and a button
// inside a button is markup no keyboard and no screen reader can resolve. So
// while this is inert it is a decorative span, hidden from assistive
// technology, showing where the handle will be. When reordering becomes real
// the tile has to stop being a single button anyway, and the handle becomes a
// real control in the same change. What it must not do is ship as a fake
// control that breaks the tile it is advertising.
export function EditGrip() {
  const edit = useProfileEdit()
  if (!edit?.editing) return null
  return (
    <span className="hp-ed-grip" aria-hidden="true">
      <GripIcon />
    </span>
  )
}

// For content that is real but is not this page's to change: the resume behind
// Experience and Skills, and the generated syntheses. A pencil here would
// promise an edit that has to happen somewhere else.
export function EditElsewhere({ children, href }) {
  const edit = useProfileEdit()
  if (!edit?.editing) return null
  if (!href) return <span className="hp-ed-elsewhere">{children}</span>
  return <a className="hp-ed-elsewhere" href={href}>{children}</a>
}

// The one thing the public page will not do: show a section that has nothing
// in it. This renders only in edit mode - never in preview - which is what
// keeps preview an honest preview.
export function EditEmpty({ title, note, field }) {
  const edit = useProfileEdit()
  const editor = useFieldEditor(field)
  if (!edit?.editing) return null

  // An empty section whose field has an editor is the way into it. One that
  // does not is still drawn, so the absence is visible, and still says so.
  const live = Boolean(field && editor)
  if (live && editor.isOpen) return null

  return (
    <button
      type="button"
      className="hp-ed-empty"
      data-live={live ? 'true' : undefined}
      disabled={!live}
      onClick={live ? editor.open : undefined}
      title={live ? title : 'Coming in a later pass'}
    >
      <span className="hp-ed-empty-title">{title}</span>
      {note ? <span className="hp-ed-empty-note">{note}</span> : null}
    </button>
  )
}
