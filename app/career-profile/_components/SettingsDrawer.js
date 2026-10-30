'use client'

import { PRO_UPGRADE_HREF, PRO_UPGRADE_LABEL, upgradeCopyFor } from '@/lib/profileTier'
import { lensRefusalNote, rewriteOfferNote, REWRITE_OFFER } from '@/lib/lensRefusal'
import { COLOR_MODES, normalizeColorMode } from '@/lib/profileColorMode'
import { ACCENTS, DEFAULT_ACCENT, OFFERED_ACCENTS, accentFor } from '@/lib/profileAccent'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DeleteSessionModal } from '@/app/components/interview/PracticeLeftPanel'

// ============================================================================
// SETTINGS
//
// The things that belong to the profile as a whole rather than to any one
// direction: the switch that makes it readable, the address it lives at, and
// the address a reader answers to.
//
// A drawer rather than a sidebar, because none of this is part of the page.
// The profile is the page; this is the handful of decisions standing behind
// it, and it should be reachable in one click and gone again in one.
//
// EACH CONTROL SAVES ITSELF
// There is no Save button over the whole drawer. Publication is a switch and
// takes effect when it is thrown; the two text fields save on their own and
// say so. A single Save would make three unrelated decisions one transaction,
// and a failure in any of them would leave the other two in an unclear state.
//
// THE OWNER IS TOLD BEFORE THE IRREVERSIBLE PART
// Changing the address breaks every link already shared, and there is no
// redirect from the old one. The field says that before it saves rather than
// after, and it asks again if the current profile is published - which is the
// only case where links are actually out in the world.
//
// The three routes it talks to each derive the row from the caller's token.
// Nothing here sends a profile id, and there is nothing it could send: the
// drawer has never been given one.
// ============================================================================

// Long enough that somebody typing is not interrupted, short enough that the
// answer arrives before they have finished deciding.
const CHECK_DEBOUNCE_MS = 450

function humanize(value) {
  if (!value || typeof value !== 'string') return null
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function Group({ label, children, note }) {
  return (
    <div className="hp-ed-group">
      <p className="hp-ed-label">{label}</p>
      {children}
      {note ? <p className="hp-ed-soon">{note}</p> : null}
    </div>
  )
}

function Value({ children, empty }) {
  if (empty) return <p className="hp-ed-value" data-empty="true">{empty}</p>
  return <p className="hp-ed-value">{children}</p>
}

// ---------------------------------------------------------------------------
// WHAT A DIRECTION IS DOING ON THE CAREER PROFILE
//
// Four states, and only one of them has no control. A dismissed direction is
// not offered back here, because putting something back that somebody threw
// away is a different decision from un-hiding something they kept.
//
// It used to be offered back on the Resume Writer hub, which was where it was
// thrown away. The hub no longer shows directions at all, and nothing can
// dismiss one any more, so no new dismissed rows appear - but the two rows
// already carrying that status now have nowhere to be restored from, and the
// visibility route still refuses them with "Restore it from your suggestions
// first", pointing at a control that is gone. Whoever adds a way back should
// add it here.
//
// PRIMARY is the only row without a switch, and it is first in the ladder
// because it is the only fact about a row that the owner cannot change from
// anywhere.
//
// There used to be a fifth, LOCKED: a direction with a core resume behind it,
// shown with no switch and a note pointing at the Resume Writer. Having built
// a resume for a direction is not the same as wanting it on the page this
// month, and the page is the owner's. It has an ordinary switch now, and
// hiding it leaves the resume exactly where it was.
// ---------------------------------------------------------------------------
const PRIMARY = 'primary'
const SHOWING = 'showing'
const HIDDEN_STATE = 'hidden'
const OFFERED = 'offered'

// What the public page renders. The visibility route enforces the same number
// and is the one that actually decides; this is here so the drawer can say
// which controls will work before anybody presses one.
const MAX_ACTIVE = 3

// The same number as a word, because the sentences below read it rather than
// count with it. Kept beside the number so the two cannot say different things.
const MAX_ACTIVE_WORD = 'three'

function lensState(lens) {
  if (lens?.source === 'user' && lens?.sort_order === 0) return PRIMARY
  if (lens?.status === 'active') return SHOWING
  if (lens?.status === 'hidden') return HIDDEN_STATE
  if (lens?.status === 'suggested') return OFFERED
  return null
}

// The three words, in the order the control shows them. System first because
// it is the one that defers rather than decides, and the two that decide read
// naturally as the pair after it.
const COLOR_MODE_LABEL = { light: 'Light', dark: 'Dark' }

// Three bars, drawn rather than typed for the reason the lock was: a glyph
// renders at a different weight on every platform and this one sits beside
// 13px text.
function GripIcon() {
  return (
    <svg className="hp-ed-grip-mark" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="3" y="4" width="10" height="1.4" rx="0.7" />
      <rect x="3" y="7.3" width="10" height="1.4" rx="0.7" />
      <rect x="3" y="10.6" width="10" height="1.4" rx="0.7" />
    </svg>
  )
}

export default function SettingsDrawer({
  open,
  onClose,
  profile,
  publicUrl,
  accountEmail,
  getAuthHeaders,
  onProfileChanged,
  canCustomise,
  isPro,
  // Whether the profile renders more than its primary Career Direction.
  // Defaults to false for the reason lib/profileTier gives for the tiers it
  // does not recognise: the failure mode of guessing generously is a free
  // account offered a control that the server will refuse, and the failure
  // mode of guessing strictly is a paying account seeing a Pro label for the
  // moment before the management record lands.
  showsAllDirections = false,
  notify,
  lenses,
  onLensVisibility,
  onLensReorder,
  onLensCreate,
  onLensRename,
  onLensRewrite,
  onLensDelete,
  onLensDeletePreview
}) {
  const closeRef = useRef(null)

  // Which row is mid-write, so one toggle disables itself without freezing the
  // rest of the list.
  const [lensBusy, setLensBusy] = useState(null)

  // ---- DELETING A DIRECTION THE OWNER NAMED ----
  //
  // Held as the row being deleted rather than a boolean, so the dialog can
  // name it and the list underneath stays exactly where it was. `pending` is
  // what the deletion would leave on no direction, fetched while the dialog
  // opens: it arrives a moment after the dialog does, which is the right way
  // round - the question is answerable without it, and waiting on a request
  // before showing anything would make the trash button feel broken.
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteCost, setDeleteCost] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const askDelete = useCallback(async (lens) => {
    setDeleteTarget(lens)
    setDeleteCost(null)
    if (!onLensDeletePreview) return
    const cost = await onLensDeletePreview(lens.id)
    // Still the same dialog. A second trash button pressed while the first
    // request was in flight would otherwise label this one with that one's
    // cost.
    setDeleteTarget(current => {
      if (current?.id === lens.id) setDeleteCost(cost)
      return current
    })
  }, [onLensDeletePreview])

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget || deleteBusy || !onLensDelete) return
    setDeleteBusy(true)
    try {
      await onLensDelete(deleteTarget.id)
      setDeleteTarget(null)
      setDeleteCost(null)
    } catch (err) {
      // The drawer's own toast, like every other failure here. The dialog
      // stays open so the control that failed is still where they left it.
      notify?.({
        type: 'error',
        message: err?.message || "We couldn't delete that Career Direction. Please try again."
      })
    } finally {
      setDeleteBusy(false)
    }
  }, [deleteTarget, deleteBusy, onLensDelete, notify])

  // A direction the owner names themselves. The refusal lives here rather than
  // in a toast: being told the career data does not reach is information about
  // their own material, and it has to stay on screen next to the box they
  // typed into while they think about what else to try.
  const [customName, setCustomName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createNote, setCreateNote] = useState(null)
  const [renaming, setRenaming] = useState(false)
  const [rewriting, setRewriting] = useState(false)

  // The offer made after a rename lands, where the direction already had
  // prose written for the name it used to have. Running it replaces the
  // headline, bio and proof points, which is why it is a question rather
  // than something that happened.
  async function acceptRewrite(offer) {
    if (!offer?.lensId || rewriting || !onLensRewrite) return
    setRewriting(true)
    try {
      await onLensRewrite(offer.lensId)
      setCreateNote(null)
    } catch (err) {
      // The note stays. The rename already succeeded and is not in question;
      // what failed is the offer, and the offer should still be there.
      notify?.({
        type: 'error',
        message: err?.message || "We couldn't rewrite that Career Direction. Please try again."
      })
    } finally {
      setRewriting(false)
    }
  }

  // The offer under a duplicate refusal: call the direction they already have
  // by the name they just typed. The typed name is still in the box - the
  // refusal path deliberately does not clear it - so this is what they asked
  // for twice rather than a guess.
  async function acceptRename(offer) {
    const wanted = customName.trim()
    if (!offer?.lensId || !wanted || renaming || !onLensRename) return
    setRenaming(true)
    try {
      const result = await onLensRename(offer.lensId, wanted)
      // Refused again, for the same reason in a different place: the name is
      // taken by a third direction. Same note, same shape.
      if (result?.ok === false) {
        setCreateNote(lensRefusalNote(result, wanted))
        return
      }
      setCustomName('')
      // Renamed, and the prose underneath still describes the old name. The
      // offer takes the place of the refusal that was here, in the same spot.
      setCreateNote(
        result?.hasContent && result?.previousName
          ? rewriteOfferNote({
              newName: result.lens?.name || wanted,
              oldName: result.previousName,
              lensId: offer.lensId
            })
          : null
      )
    } catch (err) {
      notify?.({
        type: 'error',
        message: err?.message || "We couldn't rename that Career Direction. Please try again."
      })
    } finally {
      setRenaming(false)
    }
  }

  async function createCustomLens() {
    const name = customName.trim()
    if (!name || creating || !onLensCreate) return
    setCreating(true)
    setCreateNote(null)
    try {
      const result = await onLensCreate(name)
      // An answer of "no" comes back as an ordinary result, not a throw: the
      // request worked, the career data did not reach.
      if (result?.ok === false) {
        // Two refusals, two answers. "Not enough data" tells somebody their
        // career does not reach a direction yet; "you already have it" tells
        // them it does and they are looking at it. Showing the first for the
        // second would send them off to build evidence they already have.
        //
        // The words are in lib/lensRefusal rather than inline: the Resume
        // Writer hub used to ask this same route and the two answers had
        // drifted apart. See that file.
        setCreateNote(lensRefusalNote(result, name))
        return
      }
      setCustomName('')
    } catch (err) {
      setCreateNote({ title: null, body: err?.message || "We couldn't create that Career Direction. Please try again." })
    } finally {
      setCreating(false)
    }
  }

  const directions = (Array.isArray(lenses) ? lenses : [])
    .map(lens => ({ lens, state: lensState(lens) }))
    .filter(row => row.state !== null)

  // How many of the three the page is showing, and so whether there is
  // anywhere to put another. Counted from status rather than from the states
  // above, because that is what the route will count when it decides.
  //
  // A locked direction whose status is not active is possible and is counted
  // honestly: building a core while the profile was already full sets the core
  // without promoting the row, so it is locked, buildable, and waiting.
  const activeCount = (Array.isArray(lenses) ? lenses : [])
    .filter(l => l?.status === 'active').length
  const slotsFull = activeCount >= MAX_ACTIVE

  // ---- THE ORDER, AND DRAGGING IT ----
  //
  // Three groups out of one list. On the profile and arrangeable, off the
  // profile and not, and not on it yet. The first group is the only one with
  // an order, because it is the only one a visitor sees: a direction that is
  // hidden has no position to hold and a direction that has never been added
  // has nothing to hold a position in.
  //
  // Primary is read from the first row of that group rather than from the
  // stored source/sort_order pair. The two agree once a write has landed;
  // between the drop and the reload only the position is true, and the label
  // has to follow the thing the owner just did rather than the thing the
  // database has not been told yet.
  const [dragId, setDragId] = useState(null)
  const [dropId, setDropId] = useState(null)
  const lensListRef = useRef(null)
  // The gesture in progress, off React state: pointermove reads it tens of
  // times a second and the release reads whatever the last move saw, neither
  // of which can wait for a render.
  const lensGesture = useRef(null)
  const [reordering, setReordering] = useState(false)
  // The arrangement as the owner left it, held only until the reload brings
  // it back from the table. Cleared on failure, which is what puts the rows
  // back where they were.
  const [draftOrder, setDraftOrder] = useState(null)

  const rows = Array.isArray(lenses) ? lenses : []
  const activeRows = (() => {
    const live = rows.filter(l => l?.status === 'active')
    if (!draftOrder) return live.map((lens, index) => ({ lens, index }))
    const byId = new Map(live.map(l => [l.id, l]))
    const arranged = draftOrder.map(id => byId.get(id)).filter(Boolean)
    // Anything that appeared since the drag - another tab, a toggle - goes on
    // the end rather than vanishing from the list.
    for (const l of live) if (!draftOrder.includes(l.id)) arranged.push(l)
    return arranged.map((lens, index) => ({ lens, index }))
  })()
  const hiddenRows = rows.filter(l => l?.status === 'hidden').map(lens => ({ lens }))
  const offeredRows = rows.filter(l => l?.status === 'suggested').map(lens => ({ lens }))

  // Nothing to arrange with one row, and nothing to arrange with if the
  // account cannot customise its profile at all - or if the profile is only
  // showing one of these, which is an order with nothing in it to change.
  const canReorder =
    Boolean(onLensReorder) && canCustomise && showsAllDirections && activeRows.length > 1

  async function commitOrder(ids) {
    if (!onLensReorder || reordering) return
    const previous = draftOrder
    setDraftOrder(ids)
    setReordering(true)
    try {
      await onLensReorder(ids)
      // The reload has the stored order now, so the draft stops speaking for
      // it. Left in place it would out-rank the table on the next render.
      setDraftOrder(null)
    } catch (err) {
      setDraftOrder(previous)
      notify?.({
        type: 'error',
        message: err?.message || "We couldn't save that order. Please try again."
      })
    } finally {
      setReordering(false)
    }
  }

  function moveTo(fromIndex, toIndex) {
    const ids = activeRows.map(r => r.lens.id)
    if (toIndex < 0 || toIndex >= ids.length || fromIndex === toIndex) return
    const next = ids.slice()
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    commitOrder(next)
  }

  // ---- ARRANGING BY POINTER ----
  //
  // Pointer events from the handle, the same way the profile's manage lists
  // do it. This row used to carry `draggable` with dragstart/dragover/drop,
  // and HTML5 drag and drop does not exist on touch: no mobile browser
  // synthesises dragstart from a finger, so on a phone or a touch laptop the
  // handle was decoration and dragging it scrolled the drawer. One pointer
  // implementation covers mouse, touch and pen.
  //
  // What a drop means and what it saves are unchanged. The drop still resolves
  // to two indexes in `activeRows` and still goes through moveTo, so the
  // optimistic draft order, the single reorder call and the primary label
  // following position zero all behave exactly as before.
  //
  // The handle stays a button and keeps its arrow keys. pointerdown is
  // deliberately not prevented here, because preventing it on a button also
  // suppresses the focus that the keyboard path needs; `touch-action: none`
  // on the handle stops the scroll instead, and a button starts no text
  // selection to cancel.

  // Which edge of the target the line goes on: the edge the row will arrive at
  // once it has taken the target's place.
  const lensDropSide = (fromId, toId) => {
    const ids = activeRows.map(r => r.lens.id)
    const from = ids.indexOf(fromId)
    const to = ids.indexOf(toId)
    if (from === -1 || to === -1 || from === to) return null
    return to > from ? 'below' : 'above'
  }

  function clearDrag() {
    lensGesture.current = null
    setDragId(null)
    setDropId(null)
  }

  function startDrag(event, id) {
    if (!canReorder || reordering) return
    // A right-click or a middle-click is not a drag, and the context menu
    // should still open.
    if (typeof event.button === 'number' && event.button !== 0) return

    lensGesture.current = { id, pointerId: event.pointerId, overId: null }
    setDragId(id)
    setDropId(null)

    // The handle keeps the pointer for the whole gesture, so moves and the
    // release land here even once the finger has travelled over other rows,
    // and the browser stops reading the gesture as a scroll.
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // No capture available: the drag still tracks, it just ends early if
      // the pointer leaves the handle.
    }
  }

  // The row under the pointer, read from the document rather than from
  // crossing events, because the handle is holding the pointer and no other
  // row is receiving any.
  function rowUnder(clientX, clientY) {
    if (typeof document === 'undefined') return null
    const at = document.elementFromPoint(clientX, clientY)
    const row = at?.closest?.('[data-lens-row]')
    if (!row || !lensListRef.current?.contains(row)) return null
    return row.getAttribute('data-lens-row') || null
  }

  function moveDrag(event) {
    const drag = lensGesture.current
    if (!drag || event.pointerId !== drag.pointerId) return
    const over = rowUnder(event.clientX, event.clientY)
    const ids = activeRows.map(r => r.lens.id)
    // Off the list, or over a direction that has no position in this group -
    // a hidden one, or one only offered: the last good target stands, so a
    // wobble on the way to the edge does not drop the row back where it
    // started.
    if (!over || over === drag.id || !ids.includes(over)) return
    if (over !== drag.overId) {
      drag.overId = over
      setDropId(over)
    }
  }

  function endDrag(event) {
    const drag = lensGesture.current
    if (!drag || event.pointerId !== drag.pointerId) return
    const { id, overId: target } = drag
    const ids = activeRows.map(r => r.lens.id)
    const from = ids.indexOf(id)
    const to = target ? ids.indexOf(target) : -1
    // Cleared before the write, so a slow save cannot leave a row looking
    // picked up.
    clearDrag()
    if (from === -1 || to === -1) return
    moveTo(from, to)
  }

  function nudge(event, index) {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    event.preventDefault()
    moveTo(index, index + (event.key === 'ArrowUp' ? -1 : 1))
  }

  async function setLensVisible(lens, visible) {
    if (!onLensVisibility || lensBusy) return
    setLensBusy(lens.id)
    try {
      await onLensVisibility(lens.id, visible)
    } catch (err) {
      // Every other control in this drawer reports through the same toast, and
      // this one is no different: the row snaps back to what it was, and the
      // message says why rather than leaving a switch that did not move.
      notify?.({
        type: 'error',
        message: err?.message || "We couldn't change that Career Direction. Please try again."
      })
    } finally {
      setLensBusy(null)
    }
  }

  const published = profile?.is_published === true
  const currentSlug = profile?.slug || ''

  // The field shows the address the Contact button will actually open, which
  // when nothing has been set is the account address. Showing a blank box
  // there would have been a lie in both directions: it would suggest no button
  // exists, and it would leave no way to say "not this one" - you cannot clear
  // a field that is already empty, and clearing is how the button is switched
  // off. A stored '' is a cleared field and stays blank.
  const currentEmail = profile?.contact_email == null
    ? (accountEmail || '')
    : profile.contact_email

  const [publishing, setPublishing] = useState(false)
  const [colorModeSaving, setColorModeSaving] = useState(false)
  const [accentSaving, setAccentSaving] = useState(false)

  const [slug, setSlug] = useState(currentSlug)
  const [slugCheck, setSlugCheck] = useState(null)   // { available, reason, current }
  const [slugChecking, setSlugChecking] = useState(false)
  const [slugSaving, setSlugSaving] = useState(false)
  const [slugError, setSlugError] = useState(null)
  const [slugSaved, setSlugSaved] = useState(false)

  const [email, setEmail] = useState(currentEmail)
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailError, setEmailError] = useState(null)
  const [emailSaved, setEmailSaved] = useState(false)

  // The drawer is mounted for the life of the page and renders null when
  // closed, so nothing here is torn down on the way out: state set while it
  // was open is still set when it opens again. Every other field is restored
  // from the record below, but a half-finished confirmation has no record to
  // restore from - it simply has to go, or closing the drawer and opening it
  // again brings back a dialog about a decision nobody is making any more.
  useEffect(() => {
    if (open) return
    setDeleteTarget(null)
    setDeleteCost(null)
    setDeleteBusy(false)
  }, [open])

  // Reopening shows what is actually stored, not what was half-typed and
  // abandoned last time.
  useEffect(() => {
    if (!open) return
    setSlug(currentSlug)
    setEmail(currentEmail)
    setSlugCheck(null)
    setSlugError(null)
    setSlugSaved(false)
    setEmailError(null)
    setEmailSaved(false)
  }, [open, currentSlug, currentEmail])

  // Escape closes, and focus moves into the drawer so a keyboard is not left
  // behind the scrim with nothing to act on.
  //
  // Not while the delete confirmation is up. This listener is on the window,
  // so it hears every Escape in the document including the ones meant for a
  // dialog in front of the drawer - and the dialog has a listener of its own.
  // Both firing closed both, which is one more thing than anybody asked for.
  // The innermost thing open owns the key.
  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    function onKey(event) {
      if (event.key !== 'Escape') return
      if (deleteTarget) return
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, deleteTarget])

  // Availability, asked of the route that will do the saving, so the answer
  // here and the answer there cannot disagree.
  const candidate = slug.trim().toLowerCase()
  useEffect(() => {
    if (!open) return
    if (!candidate || candidate === currentSlug) { setSlugCheck(null); return }

    let cancelled = false
    const timer = window.setTimeout(async () => {
      setSlugChecking(true)
      try {
        const res = await fetch('/api/career-profile/slug', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
          body: JSON.stringify({ slug: candidate })
        })
        const payload = await res.json().catch(() => ({}))
        if (cancelled) return
        setSlugCheck(res.ok ? payload : { available: false, reason: payload?.error || 'Could not check that.' })
      } catch {
        if (!cancelled) setSlugCheck({ available: false, reason: "We couldn't check that just now." })
      } finally {
        if (!cancelled) setSlugChecking(false)
      }
    }, CHECK_DEBOUNCE_MS)

    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [candidate, currentSlug, open, getAuthHeaders])

  const togglePublish = useCallback(async () => {
    if (publishing) return
    setPublishing(true)

    try {
      const res = await fetch('/api/career-profile/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
        body: JSON.stringify({ is_published: !published })
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload?.error || "We couldn't save that.")
      onProfileChanged({ is_published: payload.is_published === true })
    } catch (err) {
      notify?.({ type: 'error', message: err.message || "We couldn't save that." })
    } finally {
      setPublishing(false)
    }
  }, [publishing, published, getAuthHeaders, onProfileChanged, notify])

  async function saveSlug() {
    if (slugSaving || !candidate || candidate === currentSlug) return

    // Asked once, before anything is written, and only when there are links to
    // break. An unpublished profile has never been readable by anyone, so
    // there is nothing to warn about.
    if (published) {
      const ok = window.confirm(
        `Change your link to /p/${candidate}?\n\n` +
        'Every link you have already shared will stop working. There is no redirect from the old address.'
      )
      if (!ok) return
    }

    setSlugSaving(true)
    setSlugError(null)
    setSlugSaved(false)
    try {
      const res = await fetch('/api/career-profile/slug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
        body: JSON.stringify({ slug: candidate })
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload?.error || "We couldn't save that.")
      onProfileChanged({ slug: payload.slug })
      setSlug(payload.slug)
      setSlugCheck(null)
      setSlugSaved(true)
    } catch (err) {
      setSlugError(err.message || "We couldn't save that.")
    } finally {
      setSlugSaving(false)
    }
  }

  async function saveEmail() {
    if (emailSaving) return
    setEmailSaving(true)
    setEmailError(null)
    setEmailSaved(false)
    try {
      const res = await fetch('/api/career-profile/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
        body: JSON.stringify({ contact_email: email })
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload?.error || "We couldn't save that.")
      onProfileChanged({ contact_email: payload.contact_email ?? null })
      setEmail(payload.contact_email ?? '')
      setEmailSaved(true)
    } catch (err) {
      setEmailError(err.message || "We couldn't save that.")
    } finally {
      setEmailSaving(false)
    }
  }

  // ---- COLOUR MODE ----
  //
  // Previewed before it is saved and saved without being asked. The mode is
  // the one setting in this drawer whose result is the drawer itself, so the
  // page behind the control answers the question "what would that look like"
  // faster than any confirmation could, and a Save button would only stand
  // between somebody and the thing they are trying to see.
  //
  // The preview is not a separate code path: patching the record is what the
  // page reads to decide the mode, so showing it and storing it are the same
  // state written at two different times. A failed write puts the old value
  // back the same way, which is why there is no local copy of the selection
  // to fall out of step with the record.
  async function chooseColorMode(next) {
    if (colorModeSaving) return
    if (next === normalizeColorMode(profile?.color_mode)) return

    const previous = profile?.color_mode ?? null
    setColorModeSaving(true)
    onProfileChanged({ color_mode: next })

    try {
      const res = await fetch('/api/career-profile/appearance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
        body: JSON.stringify({ color_mode: next })
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload?.error || "We couldn't save that.")
      // The stored value rather than the requested one, so what the page shows
      // next is what the database holds.
      onProfileChanged({ color_mode: payload?.profile?.color_mode ?? next })
    } catch (err) {
      onProfileChanged({ color_mode: previous })
      notify?.({
        type: 'error',
        message: err?.message || "We couldn't change the color mode. Please try again."
      })
    } finally {
      setColorModeSaving(false)
    }
  }

  // Chosen, previewed and stored the way a colour mode is: the record is
  // patched first so the page repaints under the open drawer, and the write
  // only confirms it. A refusal puts the old palette back.
  async function chooseAccent(next) {
    if (accentSaving) return
    if (next === accentFor(profile?.accent).stored) return

    const previous = profile?.accent ?? null
    setAccentSaving(true)
    onProfileChanged({ accent: next })

    try {
      const res = await fetch('/api/career-profile/appearance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
        body: JSON.stringify({ accent: next })
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload?.error || "We couldn't save that.")
      onProfileChanged({ accent: payload?.profile?.accent ?? next })
    } catch (err) {
      onProfileChanged({ accent: previous })
      notify?.({
        type: 'error',
        message: err?.message || "We couldn't change the accent. Please try again."
      })
    } finally {
      setAccentSaving(false)
    }
  }

  if (!open) return null

  // What the picker shows as chosen. A profile that has never chosen one is
  // on the default palette and says so, rather than showing nine unselected
  // swatches and no answer to "what is this page painted in".
  const accent = accentFor(profile?.accent).stored
  const colorMode = normalizeColorMode(profile?.color_mode)
  const slugDirty = candidate !== currentSlug && candidate.length > 0
  const slugUsable = slugDirty && slugCheck?.available === true && !slugChecking
  const emailDirty = email.trim() !== currentEmail

  return (
    <>
      <button type="button" className="hp-ed-scrim" aria-label="Close settings" onClick={onClose} />

      <aside className="hp-ed-drawer" role="dialog" aria-modal="true" aria-label="Career Profile settings">
        <div className="hp-ed-drawer-head">
          <p className="hp-ed-drawer-title">Settings</p>
          <button type="button" ref={closeRef} className="hp-ed-action" onClick={onClose}>Done</button>
        </div>

        <div className="hp-ed-drawer-body">

          {/* ---- Publication ---- */}
          <Group label="Publication">
            <div className="hp-ed-switch-row">
              <button
                type="button"
                className="hp-ed-switch"
                role="switch"
                aria-checked={published}
                aria-label="Publish this Career Profile"
                onClick={togglePublish}
                disabled={publishing}
                data-on={published ? 'true' : 'false'}
              >
                <span className="hp-ed-switch-knob" aria-hidden="true" />
              </button>
              <span className="hp-ed-switch-label">
                {publishing ? 'Saving…' : published ? 'Published' : 'Draft'}
              </span>
            </div>
            <p className="hp-ed-soon">
              {published
                ? 'Anyone with your link can read this Career Profile.'
                : 'Only you can open this Career Profile. The link returns nothing for everybody else.'}
            </p>
          </Group>

          {/* ---- Appearance: still read-only ---- */}
          <Group label="Template">
            {humanize(profile?.template)
              ? <Value>{humanize(profile.template)}</Value>
              : <Value empty="Default." />}
          </Group>

          <Group label="Color mode">
            {/* aria-pressed on plain buttons rather than a radiogroup, which
                is what the Edit/Preview control in the toolbar already does.
                A radiogroup owes the keyboard arrow-key navigation and a
                single tab stop; three buttons that each say whether they are
                pressed owe nothing and behave the way the rest of this page
                already behaves. */}
            <div className="hp-ed-seg" role="group" aria-label="Color mode">
              {COLOR_MODES.map(mode => (
                <button
                  key={mode}
                  type="button"
                  className="hp-ed-seg-opt"
                  aria-pressed={colorMode === mode}
                  data-on={colorMode === mode ? 'true' : 'false'}
                  disabled={colorModeSaving}
                  onClick={() => chooseColorMode(mode)}
                >
                  {COLOR_MODE_LABEL[mode]}
                </button>
              ))}
            </div>
          </Group>

          {/* Nine palettes, three across, each one a labelled colour. The
              swatch shown is the stored value rather than either of the two
              the page actually paints, because the pair is the palette and
              the middle value is the one that names it.

              Buttons that say whether they are pressed, like the colour mode
              control above, rather than a radiogroup. The tick is inside the
              swatch so the answer is on the colour itself, and the outline
              repeats it for anybody who cannot see which square went dark. */}
          <Group label="Color palette">
            <div className="hp-ed-accents" role="group" aria-label="Color palette">
              {/* The palettes on offer, and - if this profile is painted in
                  one that has been withdrawn - the one it is actually using,
                  so the picker never shows nine squares with none of them
                  chosen. */}
              {(OFFERED_ACCENTS.some(p => p.stored === accent)
                ? OFFERED_ACCENTS
                : ACCENTS.filter(p => !p.hidden || p.stored === accent)
              ).map(palette => {
                const on = accent === palette.stored
                return (
                  <button
                    key={palette.id}
                    type="button"
                    className="hp-ed-accent"
                    aria-pressed={on}
                    data-on={on ? 'true' : 'false'}
                    disabled={accentSaving}
                    onClick={() => chooseAccent(palette.stored)}
                  >
                    <span
                      className="hp-ed-accent-chip"
                      style={{ background: palette.stored }}
                      aria-hidden="true"
                    >
                      {on ? (
                        <svg viewBox="0 0 16 16" className="hp-ed-accent-tick" aria-hidden="true">
                          <path
                            d="M3.5 8.5l3 3 6-6.5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : null}
                    </span>
                    <span className="hp-ed-accent-name">{palette.label}</span>
                  </button>
                )
              })}
            </div>
          </Group>

          {/* ---- Directions ----
              What the Career Profile shows, rather than what exists. Hiding one
              keeps everything written for it, so the switch is reversible in
              both directions and nothing has to be generated again to come
              back.

              The count in the label is the point of the section as much as the
              rows are: three is the whole allowance, and an owner deciding
              whether to turn something on needs to know what it costs before
              they press a control that refuses.

              On a plan with nothing to spend there is no allowance to report.
              Free shows one direction and lists the rest as locked, and "3 of
              3 active" beside that would be counting a budget this account
              does not have - or, read the other way, claiming three are on a
              page that is showing one. The label is just the heading there. */}
          {directions.length > 0 && (
            <Group
              label={
                showsAllDirections
                  ? `Career Directions · ${activeCount} of ${MAX_ACTIVE} active`
                  : 'Career Directions'
              }
            >
              {/* Two groups, never mixed. Above the rule, the directions that
                  are on the profile or could be turned back on with a switch;
                  below it, the ones that have not been put on it yet and are
                  added rather than toggled. A switch and an Add button answer
                  different questions and a single list of both reads as one
                  control that changes its mind. */}
              <div className="hp-ed-lenses" ref={lensListRef} data-dragging={dragId ? 'true' : undefined}>
                {activeRows.map(({ lens, index }) => {
                  const busy = lensBusy === lens.id
                  const isPrimary = index === 0
                  return (
                    <div
                      className="hp-ed-lens-row"
                      key={lens.id}
                      data-lens-row={lens.id}
                      data-state={isPrimary ? PRIMARY : SHOWING}
                      data-dragging={dragId === lens.id ? 'true' : undefined}
                      data-drop={dropId === lens.id ? lensDropSide(dragId, lens.id) || undefined : undefined}
                    >
                      {canReorder ? (
                        // The handle is a button so a keyboard has the same
                        // move a pointer does: the arrows walk the direction
                        // up and down the list. A drag with no keyboard
                        // equivalent is a control half the people who need it
                        // cannot reach.
                        <button
                          type="button"
                          className="hp-ed-lens-grip"
                          aria-label={`Reorder ${lens.name}. Position ${index + 1} of ${activeRows.length}. Use the up and down arrow keys to move it.`}
                          disabled={reordering}
                          onKeyDown={e => nudge(e, index)}
                          onPointerDown={e => startDrag(e, lens.id)}
                          onPointerMove={moveDrag}
                          onPointerUp={endDrag}
                          onPointerCancel={clearDrag}
                        >
                          <GripIcon />
                        </button>
                      ) : null}

                      <span className="hp-ed-lens-label">
                        <span className="hp-ed-lens-name">{lens.name}</span>
                      </span>

                      {isPrimary ? (
                        // No switch at all. A disabled one would say this is
                        // yours to change and that it is currently refused,
                        // and only the second of those is true.
                        <span className="hp-ed-lens-fixed">Always on</span>
                      ) : !showsAllDirections ? (
                        // Same argument, the other way round: on this plan
                        // the profile shows the primary direction and this
                        // one is not on the page, so a switch reading "on"
                        // would be describing something that is not true.
                        // It is listed rather than hidden because it still
                        // exists, everything written for it is still here,
                        // and it comes back with the plan. The line under
                        // the list says so.
                        <span className="hp-ed-lens-fixed" data-locked="true">Pro</span>
                      ) : (
                        <button
                          type="button"
                          className="hp-ed-switch"
                          role="switch"
                          aria-checked="true"
                          aria-label={`Show ${lens.name} on your Career Profile`}
                          onClick={() => setLensVisible(lens, false)}
                          // Turning one off is never gated and never blocked. A
                          // lapsed account must always be able to take
                          // something down, and taking one down is what frees
                          // the slot the other rows are waiting for.
                          disabled={busy || reordering}
                          data-on="true"
                        >
                          <span className="hp-ed-switch-knob" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  )
                })}

                {/* Off the profile, so it has no position on it and no handle.
                    It keeps its switch: turning it back on puts it at the end
                    of the order, where the owner can drag it wherever they
                    meant it to go. */}
                {hiddenRows.map(({ lens }) => {
                  const busy = lensBusy === lens.id
                  const blocked = slotsFull
                  return (
                    <div className="hp-ed-lens-row" key={lens.id} data-state={HIDDEN_STATE}>
                      {canReorder ? <span className="hp-ed-lens-grip-gap" aria-hidden="true" /> : null}
                      <span className="hp-ed-lens-label">
                        <span className="hp-ed-lens-name">{lens.name}</span>
                      </span>
                      {/* ---- Only a direction they named, and only off the
                          profile. The route enforces both again; this is about
                          not offering something that would be refused. There
                          was a third condition - no core resume behind it -
                          and a direction owns no resume now.

                          Before the switch, so that the switch is the last
                          thing in every row and the toggles read down one
                          column. After it, this row's switch sat a trash
                          button's width left of all the others.

                          Deliberately always visible rather than appearing on
                          hover: on a phone there is no hover, and this drawer
                          is full width there. */}
                      {onLensDelete
                        && lens.source === 'user_created' ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); askDelete(lens); }}
                          className="w-7 h-7 rounded-full bg-[#fdecea] hover:bg-[#e57373] flex items-center justify-center text-[#e57373] hover:text-white transition-all flex-shrink-0"
                          title={`Delete ${lens.name}`}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      ) : null}

                      {!showsAllDirections ? (
                        <span className="hp-ed-lens-fixed" data-locked="true">Pro</span>
                      ) : (
                      <button
                        type="button"
                        className="hp-ed-switch"
                        role="switch"
                        aria-checked="false"
                        aria-label={`Show ${lens.name} on your Career Profile`}
                        onClick={() => setLensVisible(lens, true)}
                        disabled={busy || reordering || !canCustomise || blocked}
                        data-blocked={blocked && !busy ? 'true' : undefined}
                        title={blocked
                          ? `Your Career Profile shows ${MAX_ACTIVE_WORD} Career Directions at a time. Turn one off to add this one.`
                          : undefined}
                        data-on="false"
                      >
                        <span className="hp-ed-switch-knob" aria-hidden="true" />
                      </button>
                      )}
                    </div>
                  )
                })}
              </div>

              {canReorder ? (
                <p className="hp-ed-soon">
                  Drag to reorder. Your first Career Direction is primary, always stays on, and loads first for visitors. Turn any other Career Direction off anytime. Everything written for it stays ready to restore.
                </p>
              ) : null}

              {offeredRows.length > 0 && (
                <>
                  <hr className="hp-ed-lens-split" />
                  <p className="hp-ed-lens-make-label">Add a Career Direction identified from career data</p>
                  <div className="hp-ed-lenses">
                    {offeredRows.map(({ lens }) => {
                      const busy = lensBusy === lens.id
                      const blocked = slotsFull
                      return (
                        <div className="hp-ed-lens-row" key={lens.id} data-state={OFFERED}>
                          <span className="hp-ed-lens-label">
                            <span className="hp-ed-lens-name">{lens.name}</span>
                            {blocked && canCustomise && (
                              <span className="hp-ed-lens-note">
                                {MAX_ACTIVE} of {MAX_ACTIVE} active
                              </span>
                            )}
                          </span>

                          {canCustomise ? (
                            <button
                              type="button"
                              className="hp-ed-lens-add"
                              onClick={() => setLensVisible(lens, true)}
                              disabled={busy || blocked || reordering}
                              data-blocked={blocked && !busy ? 'true' : undefined}
                              title={blocked
                                ? `Your Career Profile shows ${MAX_ACTIVE_WORD} Career Directions at a time. Turn one off to add this one.`
                                : undefined}
                            >
                              {busy ? 'Adding…' : 'Add to Career Profile'}
                            </button>
                          ) : (
                            <a className="hp-ed-lens-add" href={PRO_UPGRADE_HREF}>{PRO_UPGRADE_LABEL}</a>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              {/* ---- A direction of their own ----
                  Under the suggestions, because it is the answer to having
                  read them and not found the one they wanted. Pro only, and
                  disabled rather than hidden when the slots are full: the
                  reason is already written under it, and a control that
                  vanishes explains nothing. */}
              <hr className="hp-ed-lens-split" />
              <div className="hp-ed-lens-make">
                <label className="hp-ed-lens-make-label" htmlFor="hp-custom-lens">
                  Add your own Career Direction
                </label>
                <div className="hp-ed-lens-make-row">
                  <input
                    id="hp-custom-lens"
                    type="text"
                    className="hp-ed-input hp-ed-block"
                    placeholder="Type a Career Direction name..."
                    value={customName}
                    maxLength={60}
                    disabled={!canCustomise || !isPro || creating || slotsFull}
                    onChange={e => { setCustomName(e.target.value); setCreateNote(null) }}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); createCustomLens() } }}
                  />
                  {canCustomise && isPro ? (
                    <button
                      type="button"
                      className="hp-ed-lens-add"
                      data-working={creating ? 'true' : undefined}
                      onClick={createCustomLens}
                      disabled={creating || slotsFull || !customName.trim()}
                    >
                      {creating ? <span className="hp-ed-spin" aria-hidden="true" /> : null}
                      {creating ? 'Building…' : 'Create'}
                    </button>
                  ) : (
                    <a className="hp-ed-lens-add" href={PRO_UPGRADE_HREF}>{PRO_UPGRADE_LABEL}</a>
                  )}
                </div>
                {creating && (
                  <p className="hp-ed-lens-make-building">
                    Building this Career Direction from your career data...
                  </p>
                )}
                {createNote && !creating && (
                  <div className="hp-ed-lens-make-note" role="status">
                    <button
                      type="button"
                      className="hp-ed-lens-make-note-x"
                      onClick={() => { setCreateNote(null); setCustomName('') }}
                      aria-label="Dismiss message"
                    >
                      ×
                    </button>
                    {createNote.title ? (
                      <p className="hp-ed-lens-make-note-title">{createNote.title}</p>
                    ) : null}
                    <p className="hp-ed-lens-make-note-body">{createNote.body}</p>
                    {createNote.rename ? (
                      <button
                        type="button"
                        className="hp-ed-lens-make-note-action"
                        onClick={() => acceptRename(createNote.rename)}
                        disabled={renaming}
                      >
                        {renaming ? 'Renaming…' : createNote.rename.label}
                      </button>
                    ) : null}
                    {createNote.rewrite ? (
                      <span className="hp-ed-lens-make-note-actions">
                        <button
                          type="button"
                          className="hp-ed-lens-make-note-action"
                          onClick={() => acceptRewrite(createNote.rewrite)}
                          disabled={rewriting}
                        >
                          {rewriting ? (
                            <span className="hp-ed-spin" aria-hidden="true" />
                          ) : null}
                          {rewriting ? 'Rewriting…' : REWRITE_OFFER.confirmLabel}
                        </button>
                        <button
                          type="button"
                          className="hp-ed-lens-make-note-quiet"
                          onClick={() => setCreateNote(null)}
                          disabled={rewriting}
                        >
                          {REWRITE_OFFER.dismissLabel}
                        </button>
                      </span>
                    ) : null}
                  </div>
                )}
              </div>

              {/* Two answers, because there are two situations the copy beside
                  the rows cannot cover. A free account is told what the section
                  is and what adds to it; a Vault account is told that what it
                  built stays and that adding is Pro, which is what the
                  visibility route enforces.

                  A Pro account is told nothing here, full or not. The help text
                  under the direction list already explains what the slots cost
                  and that turning one off keeps everything written for it, and
                  saying it twice on one screen read as two different rules. */}
              {(!canCustomise || !isPro) ? (
                <p className="hp-ed-soon">
                  {!canCustomise
                    ? upgradeCopyFor('lenses')
                    : upgradeCopyFor('lenses_vault')}
                </p>
              ) : null}
            </Group>
          )}

          {/* ---- Link ---- */}
          <Group label="Link">
            <div className="hp-ed-field">
              <span className="hp-ed-prefix">/p/</span>
              <input
                id="hp-ed-slug"
                className="hp-ed-input"
                type="text"
                value={slug}
                spellCheck="false"
                autoComplete="off"
                onChange={e => { setSlug(e.target.value); setSlugSaved(false); setSlugError(null) }}
                aria-label="Your Career Profile link"
                aria-describedby="hp-ed-slug-note"
              />
            </div>

            <div className="hp-ed-row">
              <button
                type="button"
                className="hp-ed-action"
                data-primary="true"
                onClick={saveSlug}
                disabled={!slugUsable || slugSaving}
              >
                {slugSaving ? 'Saving…' : 'Save link'}
              </button>
              {slugDirty && slugChecking ? <span className="hp-ed-hint">Checking…</span> : null}
              {slugDirty && !slugChecking && slugCheck?.available === true
                ? <span className="hp-ed-hint" data-ok="true">Available</span> : null}
              {slugDirty && !slugChecking && slugCheck?.available === false
                ? <span className="hp-ed-hint" data-bad="true">{slugCheck.reason}</span> : null}
              {!slugDirty && slugSaved ? <span className="hp-ed-hint" data-ok="true">Saved</span> : null}
            </div>

            <p className="hp-ed-soon" id="hp-ed-slug-note">
              {publicUrl ? <span className="hp-ed-url">{publicUrl}</span> : null}
              {published
                ? 'Changing this breaks every link you have already shared.'
                : 'Lowercase letters, numbers and hyphens.'}
            </p>
            {slugError ? <p className="hp-ed-error">{slugError}</p> : null}
          </Group>

          {/* ---- Contact ----
              The whole group goes on a plan that cannot set one. Publication
              and the link above stay: a free account still publishes, still
              has an address, and still shares it. What it does not get is a
              second way for somebody to reach it. */}
          {!canCustomise ? (
            <Group label="Contact address">
              <p className="hp-ed-upsell">
                <span className="hp-ed-upsell-text">{upgradeCopyFor('contact')}</span>
                <a className="hp-ed-upsell-link" href={PRO_UPGRADE_HREF}>{PRO_UPGRADE_LABEL}</a>
              </p>
            </Group>
          ) : (
          <Group label="Contact address">
            <input
              id="hp-ed-email"
              className="hp-ed-input"
              type="email"
              value={email}
              spellCheck="false"
              autoComplete="off"
              placeholder="you@example.com"
              onChange={e => { setEmail(e.target.value); setEmailSaved(false); setEmailError(null) }}
              aria-label="Contact address"
              aria-describedby="hp-ed-email-note"
            />
            <div className="hp-ed-row">
              <button
                type="button"
                className="hp-ed-action"
                data-primary="true"
                onClick={saveEmail}
                disabled={!emailDirty || emailSaving}
              >
                {emailSaving ? 'Saving…' : 'Save address'}
              </button>
              {emailSaved ? <span className="hp-ed-hint" data-ok="true">Saved</span> : null}
            </div>
            <p className="hp-ed-soon" id="hp-ed-email-note">
              Opens the Contact button on your Career Profile. Defaults to your account
              email. Set a different address here, or leave it empty to hide the button.
            </p>
            {emailError ? <p className="hp-ed-error">{emailError}</p> : null}
          </Group>
          )}
        </div>
      </aside>

      {/* ---- The confirmation, above the drawer and its scrim ----
          A portal alone was not enough. It moved the dialog out of the
          drawer, but into the same stacking context the drawer and its scrim
          are in - and at z-index 50 it landed under both of them. The scrim
          is a full-viewport button at 54 with a half-opaque background, so it
          painted over the dialog, which is what made it look dimmed, and it
          took every click aimed at it, which is why Cancel closed the drawer.
          The dialog was never reached at all.

          The layer below is a stacking context of its own, above both. The
          dialog keeps its own z-index, which is now measured inside this
          layer rather than against the drawer, so nothing about
          DeleteSessionModal changes and Interview Practice is untouched. */}
      {deleteTarget && typeof document !== 'undefined'
        ? createPortal(
            <div className="hp-ed-modal-layer">
            <DeleteSessionModal
              deleting={deleteBusy}
              onCancel={() => { if (!deleteBusy) { setDeleteTarget(null); setDeleteCost(null) } }}
              onConfirm={confirmDelete}
              title="Delete this Career Direction?"
              body={`Everything written for ${deleteTarget.name} will be removed from your Career Profile. This can't be undone.`}
              secondary={orphanSentence(deleteCost)}
              confirmLabel="Delete"
            />
            </div>,
            document.body
          )
        : null}
    </>
  )
}

// ---------------------------------------------------------------------------
// WHAT ELSE GOES WITH IT
//
// Named, not counted. "2 items" sends somebody to go and look, which is the
// work the sentence was supposed to save them - and the decision they are
// making turns on which items, not how many.
//
// Nothing at all returns null, and the dialog renders no second paragraph
// rather than an empty one.
// ---------------------------------------------------------------------------
function orphanSentence(cost) {
  const names = [...(cost?.evidence || []), ...(cost?.testimonials || [])]
  if (names.length === 0) return null
  const list = names.length === 1
    ? names[0]
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  const verb = names.length === 1 ? 'appears' : 'appear'
  return `${list} only ${verb} on this Career Direction. They'll stay in your library, but won't show on your profile until you add them to another Career Direction.`
}
