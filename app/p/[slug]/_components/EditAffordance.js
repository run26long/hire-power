'use client'

import { useMemo } from 'react'
import { useProfileEdit, useFieldEditor, useCanEdit, useCanEditField, useShowUpgradeModal, useIsGated } from '../_lib/editContext'
import StrokeIcon, { ICON_EYE_OFF } from './StrokeIcon'

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
// Each of these names a field the document knows how to edit. Where there is
// nothing to open, nothing is drawn: a disabled control that says what it is
// waiting for is a promise about a later release, and the page does not make
// one.
// ============================================================================

const PencilIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
  </svg>
)

export const LockIcon = () => (
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
// ---------------------------------------------------------------------------
// THE TWO MARKS A LOCK IS MADE OF
//
// One lock glyph and one PRO pill, declared here and used everywhere, so a
// locked button, a locked tab, a locked row and a locked section are the same
// object in four places rather than four drawings of the same idea.
//
// Neither of these gates itself. A lock is a statement about one control, and
// only the control knows whether it is the gated one - Lock is drawn beside a
// button whose plan cannot press it, and the same button on a paid plan draws
// nothing. ProPill is the exception's exception: it is used in places that are
// gated for the whole section, so it asks.
// ---------------------------------------------------------------------------

// The glyph alone, before a label. The mark every gate on this page already
// wore; it is a component now only so no call site has to remember the span.
export function Lock() {
  return <span className="hp-ed-locked-mark"><LockIcon /></span>
}

// The glyph and the word. It is the left half of SectionHiddenChip below and
// nothing else now - a bare lock beside a sentence would read as decoration,
// and this is what names the plan instead.
//
// `gated` is still a prop rather than a question asked here, because the
// chip has already asked it: by the time this renders the answer is yes.
export function ProPill({ gated = true }) {
  if (!gated) return null
  return (
    <span className="hp-ed-pro-pill">
      <LockIcon />
      PRO
    </span>
  )
}

// ---------------------------------------------------------------------------
// THE SECTION THE PUBLIC PAGE WILL NOT SHOW
//
// One chip after the section's title, and the whole of what says so. It
// replaced a card and then a notice, both of which stood in the section's own
// layout and moved the composition below them - which meant a fact about the
// plan rearranged the thing the owner came to look at. This is beside the
// title, in the space a title already leaves, and nothing under it moves.
//
// TWO SEGMENTS, ONE BUTTON
// The left segment is the PRO pill, unchanged and still the brand gradient,
// because that mark means the same thing on this page as it does in the
// Upgrade modal it opens. The right segment is the sentence, and it is built
// from the profile's own accent tokens so it follows the palette and both
// modes. One <button> around both: there is one thing to press and one thing
// it does, so two controls would be two answers to one question.
//
// It never breaks inside - white-space: nowrap - and being inline-level it
// wraps whole onto the line under the heading when the heading leaves it no
// room. See .hp-ed-hidden-chip in editor.css.
//
// Edit mode only, and only on a plan the sections are hidden for.
// ---------------------------------------------------------------------------
export function SectionHiddenChip() {
  const gated = useIsGated()
  const showUpgrade = useShowUpgradeModal()
  if (!gated) return null

  return (
    <button
      type="button"
      className="hp-ed-hidden-chip"
      onClick={showUpgrade}
      // The whole chip read as one thing, rather than as a lock, the letters
      // P R O and a sentence read one after another.
      aria-label="Hidden from your public profile. Upgrade to Pro"
    >
      <ProPill />
      <span className="hp-ed-hidden-chip-say">
        <StrokeIcon paths={ICON_EYE_OFF} size={12} />
        Hidden from your public profile
      </span>
    </button>
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
  // Per field, not per profile: In My Own Words is writable on every plan.
  // See useCanEditField.
  const canEdit = useCanEditField(field)
  const showUpgrade = useShowUpgradeModal()
  if (!edit?.editing) return null

  // ---- THE CONTROL IS ALWAYS THERE ----
  // It used to return null here, and the section carried a sentence saying
  // why. That left a free account looking at a page with no controls on it
  // and a row of apologies instead - which describes the plan rather than
  // the profile. The pencil shows on every plan now and a gated one opens
  // the Pro modal, so the page reads the same and the offer is on the thing
  // it is about.
  //
  // Four of the five fields it guards are writable on free anyway now; this
  // is for the ones that are not.
  // Nothing to open. No pencil either: a disabled control over a field that
  // has no editor is a promise about a later release, and the page should
  // not be making one. Every call site names a field this document can edit,
  // so this is the guard rather than a state anything reaches.
  if (!field || !editor) return null

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
      onClick={canEdit ? editor.open : showUpgrade}
      aria-label={`Edit ${label}`}
      title={`Edit ${label}`}
    >
      <PencilIcon />
    </button>
  )
}

// The handle a card is dragged by, and it stays a span.
//
// The thing it sits on is itself a button, and a button inside a button is
// markup no keyboard and no screen reader can resolve. So this takes pointer
// handlers rather than becoming a control: it is the same decorative,
// aria-hidden span the Manage list's grip is, and the drag is a pointer
// gesture with no keyboard path through it either way. The keyboard route to
// reordering is the Manage panel, which is a real list of real controls.
//
// Passed nothing it is still inert, which is what it is anywhere reordering
// is not offered. Edit mode only, so Preview and the public page render no
// grip at all - that was already true and is the reason this returns null
// before it returns anything else.
export function EditGrip(props) {
  const edit = useProfileEdit()
  if (!edit?.editing) return null
  return (
    <span className="hp-ed-grip" aria-hidden="true" {...props}>
      <GripIcon />
    </span>
  )
}

// ---------------------------------------------------------------------------
// WHERE "EDIT IN RESUME WRITER" LANDS
//
// The account's core resume, open in the editor: the same page the hub opens
// when you click into it there. Sending somebody to a list to find the resume
// they were already looking at is a step they should not have to take.
//
// There is one core resume per account, so there is one answer. This used to
// resolve three: the direction's own core resume, then the primary direction's,
// then the account's priority core - because a direction could own a core of
// its own through profile_lenses.core_resume_id. Nothing binds one now, every
// direction reads the same resume, and the third fallback is the only one left
// standing.
//
// The hub when there is no core resume at all, which is an account that has
// not written one yet, and then a list is the honest answer.
// ---------------------------------------------------------------------------
const RESUME_HUB = '/resume-coach'

export function useResumeEditorHref() {
  const edit = useProfileEdit()
  // The account's core resume, resolved server side rather than guessed here:
  // it is what the manage route already read, the flagged one or the newest.
  const coreResumeId = edit?.primaryCoreResumeId || null

  return useMemo(
    () => (coreResumeId ? `/resume/${coreResumeId}` : RESUME_HUB),
    [coreResumeId]
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
// `field` where the field's name is not the feature's. Every current call
// site names them the same thing, so it defaults to the feature and the one
// that matters - imow - is right either way.
export function GuideAction({ label, feature, field, onAction }) {
  const canEdit = useCanEditField(field || feature)

  // ---- THE REAL CONTROL, ON EVERY PLAN ----
  // This was a lock and a line of plan copy in place of the button. The
  // button is here on every plan now and a gated press opens the Pro modal,
  // so a guided slot looks the same whoever is reading it.
  const showUpgrade = useShowUpgradeModal()

  return (
    <button type="button" className="hp-ed-action" data-primary="true" onClick={canEdit ? onAction : showUpgrade}>
      {canEdit ? null : <Lock />}{label}
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

  // The control shows on every plan; a gated press opens the Pro modal. It
  // used to be a lock and a sentence about the plan instead, which is a page
  // describing what it is not rather than what it does.
  const showUpgradeGhost = useShowUpgradeModal()

  return (
    <p className="hp-ed-ghost-note">
      <span className="hp-ed-ghost-say">{children}</span>
      {action && field && (editor || !canEdit) ? (
        <button type="button" className="hp-ed-action" data-primary="true" onClick={canEdit ? editor.open : showUpgradeGhost}>
          {canEdit ? null : <Lock />}{action}
        </button>
      ) : null}
    </p>
  )
}
