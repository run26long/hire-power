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

// `persists` is for the fields whose editor opens as a dialog over the page
// rather than in place of the content. The rule below is right for an inline
// editor and wrong for those: the pencil is what focus has to return to when
// the dialog closes, and a control that has unmounted cannot be returned to.
// `tourId` marks one pencil as a stop on the Career Profile's first-visit
// tour. Nothing but the tour reads it, and the tour never mounts on the public
// page or in Preview - as this component does not either, since it returns
// null without an editing context. A pencil with no tourId is unchanged.
export function EditPencil({ field, label, persists = false, tourId }) {
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

  // While an inline editor is open the field it belongs to has been replaced
  // by it, so its own pencil has nothing left to point at. A dialog replaces
  // nothing, and its pencil stays.
  if (editor.isOpen && !persists) return null

  return (
    <button
      type="button"
      className="hp-ed-pencil"
      data-live="true"
      data-tour={tourId}
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

// ---------------------------------------------------------------------------
// GHOSTING A REAL SECTION
//
// The method, and the thing the previous pass got wrong.
//
// A ghost is not a composition invented to stand in for a section. It is the
// section, rendered from its own public markup and its own public classes,
// with the content taken out. That is what makes an empty Portfolio six square
// mats at the real size in the real grid rather than three small rectangles
// gesturing at one, and What Others See two real columns rather than a stack
// of skeleton bars.
//
// So these two helpers deliberately supply no layout. `GhostText` is a muted
// rule occupying the line a sentence would have; `GhostNote` is the one
// instruction and the one action. Everything around them is the public
// component doing exactly what it does publicly.
//
// THE GUARD IS THE CALLER'S JOB
// These render whatever they are given. The old `EditEmpty` returned null on
// its own when there was no edit context, which quietly protected every call
// site; ghost markup has no such instinct, so every branch that renders one
// must test `canShowEmpty` itself. Getting that wrong ships ghost content to
// visitors, which it briefly did in the hero during this pass.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// THE INSTRUCTION IS THE GHOST CONTENT
//
// A missing section is not explained underneath itself. The public composition
// stays exactly as it is, and the guidance goes into the slot the real content
// will occupy: the first portfolio mat, the featured evidence tile, the About
// column, the first quote row. The owner reads the explanation in the place
// the thing being explained will appear, and the slots around it stay as
// numbered future positions so the finished shape is obvious.
//
// That is the whole difference from the previous pass, which put a sentence
// and a button in a row beneath each empty composition. A caption under a
// composition explains a picture; a caption inside the frame is the picture
// telling you what goes there.
// ---------------------------------------------------------------------------

// The one control a guided slot offers: the action on a plan that can use it,
// and the line saying why not on one that cannot. Shared so every guided slot
// makes the same offer and the primary style is declared in a single place.
export function GuideAction({ label, feature, onAction }) {
  const canEdit = useCanEdit()

  if (!canEdit) {
    return (
      <span className="hp-ed-guide-locked">
        <span className="hp-ed-locked-mark"><LockIcon /></span>
        <a className="hp-ed-locked-link" href={UPGRADE_HREF}>{upgradeCopyFor(feature)}</a>
      </span>
    )
  }

  return (
    <button type="button" className="hp-ed-action" data-primary="true" onClick={onAction}>
      {label}
    </button>
  )
}

// What goes in the slot that is next to be filled.
export function SlotGuide({ index, heading, children, action, onAction, feature }) {
  return (
    <span className="hp-ed-guide">
      {index ? <span className="hp-ed-guide-index" aria-hidden="true">{index}</span> : null}
      <span className="hp-ed-guide-head">{heading}</span>
      <span className="hp-ed-guide-body">{children}</span>

      {/* A free account sees the same composition and the same explanation.
          What changes is the one control, which GuideAction decides. */}
      <GuideAction label={action} feature={feature} onAction={onAction} />
    </span>
  )
}

// One future position. A number and nothing else: it says "another of these
// goes here" without pretending to hold anything.
export function SlotGhost({ index }) {
  return (
    <span className="hp-ed-slot-ghost" aria-hidden="true">
      <span className="hp-ed-guide-index">{index}</span>
    </span>
  )
}

// A line of nothing, at the height of a line of something. Never words: an
// invented sentence in a ghost is a claim about a profile that has none.
export function GhostText({ width = '100%', lines = 1 }) {
  return (
    <span className="hp-ed-ghost-text" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <span
          key={i}
          className="hp-ed-ghost-line"
          style={{ width: i === lines - 1 && lines > 1 ? '58%' : width }}
        />
      ))}
    </span>
  )
}

// The instruction and the action, under the ghosted section rather than inside
// it, so the composition above keeps its real proportions.
//
// `action` is the label of the one control this ghost offers, and is omitted
// where the section already carries its own trigger beside the heading, which
// is the case for Portfolio and Evidence: two buttons offering the same thing
// in one section is one button too many.
export function GhostNote({ children, feature, field, action }) {
  const canEdit = useCanEdit()
  const editor = useFieldEditor(field)

  // One line, one destination, and no active control: a free account pressing
  // "Add" would be pressing something that cannot do anything.
  if (!canEdit) {
    return (
      <p className="hp-ed-ghost-note" data-locked="true">
        <span className="hp-ed-locked-mark"><LockIcon /></span>
        <a className="hp-ed-locked-link" href={UPGRADE_HREF}>
          {upgradeCopyFor(feature || field)}
        </a>
      </p>
    )
  }

  return (
    <p className="hp-ed-ghost-note">
      <span className="hp-ed-ghost-say">{children}</span>
      {action && field && editor ? (
        <button type="button" className="hp-ed-action" data-primary="true" onClick={editor.open}>
          {action}
        </button>
      ) : null}
    </p>
  )
}
