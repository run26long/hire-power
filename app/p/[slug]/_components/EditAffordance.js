'use client'

import { useProfileEdit, useFieldEditor, useCanEdit, useShowUpgrade } from '../_lib/editContext'
import { UPGRADE_HREF, UPGRADE_LABEL, upgradeCopyFor } from '@/lib/profileTier'

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

const LockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="10" width="16" height="10" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
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
// A line where a control would have been, saying what the plan would add and
// linking somewhere it can be added. Deliberately a sentence and a link rather
// than a dialog: the management page is the profile itself with controls over
// it, and throwing a modal over a document somebody is reading to tell them
// about a feature is an interruption, not an offer.
//
// It renders only in edit mode, so the public page and preview never see it.
export function UpgradeNote({ feature }) {
  const show = useShowUpgrade()
  if (!show) return null
  return (
    <p className="hp-ed-upsell">
      <span className="hp-ed-upsell-text">{upgradeCopyFor(feature)}</span>
      <a className="hp-ed-upsell-link" href={UPGRADE_HREF}>{UPGRADE_LABEL}</a>
    </p>
  )
}

export function EditPencil({ field, label }) {
  const edit = useProfileEdit()
  const editor = useFieldEditor(field)
  const canEdit = useCanEdit()
  if (!edit?.editing) return null

  // A free account keeps everything the coaching wrote and loses the pencil
  // over it. No disabled control in its place: a pencil that cannot be pressed
  // still says "this is yours to change", and the whole point is that on this
  // plan it is not. The section carries the line that says why.
  if (!canEdit) return null

  if (!field || !editor) {
    return (
      <button
        type="button"
        className="hp-ed-pencil"
        disabled
        aria-label={`Edit ${label}, not available yet`}
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
export function EditEmpty({ title, note, field, feature, shape }) {
  const edit = useProfileEdit()
  const editor = useFieldEditor(field)
  const canEdit = useCanEdit()
  if (!edit?.editing) return null

  // An empty section on a plan that cannot fill it.
  //
  // It used to be the upgrade line on its own, which told a free account what
  // it could not have and nothing about what the section is. Now it is the
  // same shape the paid ghost draws, quieter, with the one line underneath:
  // the owner can see what the section would become, which is the argument for
  // the plan and is more honest than a sentence about money.
  //
  // No pencil and no add control, because neither would do anything. Nothing
  // stored is exposed either: this branch draws outlines, never content.
  if (!canEdit) {
    return (
      <div className="hp-ed-locked">
        {shape ? (
          <span className="hp-ed-empty-shape" data-shape={shape} aria-hidden="true">
            <span className="hp-ed-empty-cell" />
            <span className="hp-ed-empty-cell" />
            <span className="hp-ed-empty-cell" />
          </span>
        ) : null}
        {/* The sentence is the action. Every line in the copy map already
            opens with "Upgrade to Vault to", so a separate link reading
            "Upgrade to Vault" beside it said the same words twice in the same
            breath. One sentence, one destination, no stutter. */}
        <p className="hp-ed-locked-note">
          <span className="hp-ed-locked-mark"><LockIcon /></span>
          <a className="hp-ed-locked-link" href={UPGRADE_HREF}>
            {upgradeCopyFor(feature || field)}
          </a>
        </p>
      </div>
    )
  }

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
      {/* The shape of the thing that is missing, drawn faintly behind the
          invitation: the portfolio ghost is the same three-up grid of squares
          the section will hold, so the owner can see what they are being
          offered rather than read about it.

          Empty outlines and never fake content. A ghost filled with plausible
          sample work would be a lie about the state of the profile, and one
          the owner would have to go and delete. Nothing here is a record and
          nothing here is written anywhere. Hidden from assistive technology
          because it says nothing the copy underneath does not. */}
      {shape ? (
        <span className="hp-ed-empty-shape" data-shape={shape} aria-hidden="true">
          <span className="hp-ed-empty-cell" />
          <span className="hp-ed-empty-cell" />
          <span className="hp-ed-empty-cell" />
        </span>
      ) : null}

      <span className="hp-ed-empty-title">{title}</span>
      {note ? <span className="hp-ed-empty-note">{note}</span> : null}
    </button>
  )
}
