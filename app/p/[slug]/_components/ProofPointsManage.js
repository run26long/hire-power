'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import ProfileModal from './ProfileModal'
import { UnsavedBar, useUnsavedGuard } from './ManageShell'
import { useProfileEdit } from '../_lib/editContext'

// ============================================================================
// MANAGING THE PROOF POINTS
//
// The one control over the cover's figures: choosing which three, in what
// order, for every Career Direction on the profile, from what the career
// already contains. The pencil opens this; there is nothing else.
//
// IT IS THE SAME PANEL AS THE OTHER THREE
// The shell is ProfileModal with the editor's portal class, the body is
// `.hp-manage`, the rows are `.hp-manage-row`, the handle is the same grip
// with the same pointer gesture on it, the break between the two halves is
// `.hp-manage-split`, and the footer is `.hp-manage-foot` with the filled
// button furthest right. Evidence, Portfolio and Testimonials all look like
// this because they are all answering "which of these, and in what order",
// and so is this.
//
// WHY IT DOES NOT SIMPLY USE ManageList
// That component's row is a title, a set of direction switches and an Edit
// button. A proof point has no record behind it to open and no placement to
// switch: it is two short strings, and the only sensible place to change them
// is in the row. So the row here carries two inputs where that one carries a
// label, and the parts that are genuinely the same - the grip, the gesture,
// the divider, the buttons - are the same classes and the same code.
//
// ONE PANEL, EVERY DIRECTION
// A tab per direction the profile shows, in the profile's order, opening on
// the one that was on screen. Each tab holds its own unsaved draft, so moving
// between them to compare is not a way to lose work, and each loads its own
// suggestions the first time it is opened - a direction's suggestions are
// written for that direction, and fetching all of them up front would spend
// three model calls to show one.
//
// A profile showing one direction gets no tabs at all. A row of one is a
// label pretending to be a choice.
//
// EXACTLY THREE, ALWAYS
// Not a preference. The cover's stylesheet places a lead figure and two
// supporting ones and has no fourth cell, so the lens route refuses anything
// but three and this panel is built to the same number: three slots, always
// present, never added to and never taken away. Remove empties a slot rather
// than deleting a row, which is why Add from the suggestions always has
// somewhere to land - and when every slot is full, Add asks which one it is
// replacing instead of silently choosing.
//
// AND NOTHING IS LOST BY LEAVING
// This is the one panel on the profile that holds work: the other three write
// each change as it is made, so their Done is a way of saying "finished
// looking" and closing them can cost nothing. Here a drag, a typed figure and
// three tabs' worth of drafts all live in this component until Save, so every
// way out - the X, Escape, the backdrop and Cancel - goes through one guard
// and asks before throwing them away. The question is a bar inside the panel
// rather than a dialog over it, so the changes being asked about are still on
// screen while it is answered. See ./ManageShell.
//
// NOTHING IS WRITTEN UNTIL SAVE, AND THEN ALL OF IT IS
// Save sends one PATCH per direction that actually changed, each carrying
// proof_points and nothing else, through the same route and the same
// validation the rest of the editor uses. It checks every changed direction
// first: if one of them is short of three filled slots, nothing is sent at
// all, that tab is marked, and the panel moves to it. A save that wrote two
// directions and then stopped on the third would leave the owner guessing
// which of the three landed.
// ============================================================================

const PROOF_POINT_COUNT = 3

// The ceilings the lens route enforces. Restated so the panel can say why Save
// is off before the route says it.
const NUM_MAX = 24
const LABEL_MAX = 120

// The slots, as objects with their own identity, so a row keeps its key when
// it is dragged, edited or replaced. Three of them whatever is stored: a
// direction that somehow holds fewer still opens on three editable slots, and
// one that somehow holds more is trimmed to what the cover can place.
const slotsFrom = (value) => {
  const stored = Array.isArray(value) ? value : []
  return Array.from({ length: PROOF_POINT_COUNT }, (_, i) => ({
    id: `proof-${i}`,
    num: typeof stored[i]?.num === 'string' ? stored[i].num : '',
    label: typeof stored[i]?.label === 'string' ? stored[i].label : ''
  }))
}

const trimmed = (slots) => slots.map(one => ({ num: one.num.trim(), label: one.label.trim() }))
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const keyOf = (point) => `${String(point?.num || '').trim().toLowerCase()}|${String(point?.label || '').trim().toLowerCase()}`

// Why a direction cannot be saved, or null when it can. One function, so the
// line under the rows and the check Save makes across every tab are the same
// sentence about the same rule.
function faultIn(draft) {
  if (draft.some(one => one.num.length > NUM_MAX || one.label.length > LABEL_MAX)) {
    return `A figure is at most ${NUM_MAX} characters and a label at most ${LABEL_MAX}.`
  }
  if (draft.some(one => (one.num && !one.label) || (!one.num && one.label))) {
    return 'Each proof point needs both a figure and a label.'
  }
  if (draft.filter(one => one.num && one.label).length < PROOF_POINT_COUNT) {
    return `A Career Direction shows exactly ${PROOF_POINT_COUNT} proof points. Fill the empty slot, or add one from the suggestions below.`
  }
  return null
}

// The Manage list's handle, copied with its markup so the two panels cannot
// drift apart on the one control they share.
function GripIcon() {
  return (
    <svg className="hp-manage-grip-mark" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="3" y="4" width="10" height="1.4" rx="0.7" />
      <rect x="3" y="7.3" width="10" height="1.4" rx="0.7" />
      <rect x="3" y="10.6" width="10" height="1.4" rx="0.7" />
    </svg>
  )
}

export default function ProofPointsManage({ open, onClose }) {
  const edit = useProfileEdit()

  // The directions the profile shows, in the profile's order. The document's
  // own list, which is already cut to what this plan renders - so a free
  // account sees one tab, which is to say none.
  const lenses = Array.isArray(edit?.lenses) ? edit.lenses : []
  const openLensId = edit?.lensId || null
  const getAuthHeaders = edit?.getAuthHeaders
  const saveLensFields = edit?.saveLensFields

  const [tabId, setTabId] = useState(openLensId)
  // One draft per direction, keyed by lens id, created the first time that tab
  // is opened and kept until the panel closes.
  const [drafts, setDrafts] = useState({})
  // Suggestions and their load state, per direction, for the same reason.
  const [suggestions, setSuggestions] = useState({})
  const [offered, setOffered] = useState({})
  const [loading, setLoading] = useState({})
  const [suggestError, setSuggestError] = useState({})
  // The suggestion waiting to be told which slot it takes, per direction. Set
  // only when every slot is full, which is the only time the question arises.
  const [replacing, setReplacing] = useState({})
  // Tabs whose direction failed the check the last time Save was pressed.
  const [faulted, setFaulted] = useState({})

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  const [dragId, setDragId] = useState(null)
  const [overId, setOverId] = useState(null)
  const listRef = useRef(null)
  const gesture = useRef(null)

  const lensById = (id) => lenses.find(one => one?.id === id) || null
  const storedFor = (id) => trimmed(slotsFrom(lensById(id)?.proof_points))

  const slots = drafts[tabId] || slotsFrom(lensById(tabId)?.proof_points)
  const draft = trimmed(slots)

  // ---- WHAT THERE IS TO LOSE ----
  //
  // Every direction holding a draft that differs from what is stored. Save
  // works from this same list, so the question asked on the way out and the
  // writes made on the way through can never disagree about whether anything
  // has changed.
  //
  // Declared up here rather than beside Save, because the guard it feeds has
  // to exist before the open effect below, which clears a question left
  // standing from the last visit.
  const changedLenses = lenses.filter(lens => {
    const held = drafts[lens.id]
    return held && !same(trimmed(held), storedFor(lens.id))
  })

  // Save and close, on the bar, is this panel's own save() and not a second
  // path to the same writes - held in a ref because save() is declared below
  // where the guard has to be, and a fresh closure passed in each render would
  // give the hook a new dependency on every keystroke.
  const saveRef = useRef(null)
  const runSave = useCallback(() => saveRef.current?.(), [])

  // Every way out of this panel goes through it: the shell's X, its Escape,
  // its backdrop and the Cancel below. See ./ManageShell.
  const guard = useUnsavedGuard({
    dirty: changedLenses.length > 0,
    onClose,
    onSave: runSave
  })

  const setSlots = useCallback((next) => {
    setDrafts(current => ({
      ...current,
      [tabId]: typeof next === 'function'
        ? next(current[tabId] || slotsFrom(lensById(tabId)?.proof_points))
        : next
    }))
    // Typing is an answer to whatever the mark was complaining about.
    setFaulted(current => (current[tabId] ? { ...current, [tabId]: false } : current))
    setSaveError(null)
    // lensById reads `lenses`, which is a render value rather than state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId, lenses])

  // ---- SUGGESTIONS ----
  //
  // Per direction, on the first visit to its tab and on request, never on a
  // keystroke. `seen` is everything that direction has already been shown this
  // visit, sent so More does not offer the same three again; the route adds
  // whatever the direction currently stores to it.
  const fetchSuggestions = useCallback(async (lensId, seen) => {
    if (!lensId || !getAuthHeaders) return
    setLoading(current => ({ ...current, [lensId]: true }))
    setSuggestError(current => ({ ...current, [lensId]: null }))
    try {
      const res = await fetch('/api/career-profile/proof-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
        body: JSON.stringify({ lensId, exclude: seen })
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload?.error || "We couldn't read your career data just now.")
      const next = Array.isArray(payload?.suggestions) ? payload.suggestions : []
      setSuggestions(current => ({ ...current, [lensId]: next }))
      setOffered(current => ({ ...current, [lensId]: [...(current[lensId] || []), ...next] }))
    } catch (err) {
      setSuggestions(current => ({ ...current, [lensId]: [] }))
      setSuggestError(current => ({
        ...current,
        [lensId]: err?.message || "We couldn't reach your career data. Please try again."
      }))
    } finally {
      setLoading(current => ({ ...current, [lensId]: false }))
    }
  }, [getAuthHeaders])

  // Opening is a reset. Every draft, every suggestion and every mark is
  // discarded, which is what Cancel and the close button mean, and the tab
  // returns to the direction the page is showing.
  useEffect(() => {
    if (!open) return
    setTabId(openLensId)
    setDrafts({})
    setSuggestions({})
    setOffered({})
    setLoading({})
    setSuggestError({})
    setReplacing({})
    setFaulted({})
    setSaveError(null)
    // A question left standing from the last visit is not a question about
    // this one. The drafts it was about have just been cleared above.
    guard.reset()
    // reset is stable across renders; listing it would say otherwise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, openLensId])

  // The first visit to a tab fetches its suggestions. Keyed on the absence of
  // an entry rather than on a flag, so a direction that genuinely has nothing
  // to suggest is not asked again every time the tab is reopened.
  useEffect(() => {
    if (!open || !tabId) return
    if (suggestions[tabId] !== undefined || loading[tabId]) return
    fetchSuggestions(tabId, [])
  }, [open, tabId, suggestions, loading, fetchSuggestions])

  // ---- THE GESTURE ----
  // Lifted from ManageList, which explains it at length: pointer events from
  // the grip only, so it works on touch and so the row's text is still
  // selectable, with the pointer captured for the length of the drag.
  const clearDrag = useCallback(() => {
    gesture.current = null
    setDragId(null)
    setOverId(null)
  }, [])

  const canDrag = slots.length > 1 && !replacing[tabId] && !saving

  function startDrag(event, id) {
    if (!canDrag) return
    if (typeof event.button === 'number' && event.button !== 0) return
    gesture.current = { id, pointerId: event.pointerId, overId: null }
    setDragId(id)
    setOverId(null)
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // No capture available: the drag still tracks, it just ends early if the
      // pointer leaves the grip.
    }
    event.preventDefault()
  }

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
    if (!over || over === drag.id) return
    if (over !== drag.overId) {
      drag.overId = over
      setOverId(over)
    }
  }

  function endDrag(event) {
    const drag = gesture.current
    if (!drag || event.pointerId !== drag.pointerId) return
    const { id, overId: target } = drag
    clearDrag()
    if (target && target !== id) dropRow(id, target)
  }

  // The dragged row takes the target's place, which is what the Manage list's
  // drop does with two ids and what the line drawn on the target's edge
  // promises.
  function dropRow(fromId, toId) {
    setSlots(current => {
      const next = [...current]
      const from = next.findIndex(one => one.id === fromId)
      const to = next.findIndex(one => one.id === toId)
      if (from === -1 || to === -1 || from === to) return current
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  const sideFor = (fromId, toId) => {
    const from = slots.findIndex(one => one.id === fromId)
    const to = slots.findIndex(one => one.id === toId)
    if (from === -1 || to === -1 || from === to) return null
    return to > from ? 'below' : 'above'
  }

  // ---- EDITING A SLOT ----
  const set = (id, key, value) =>
    setSlots(current => current.map(one => (one.id === id ? { ...one, [key]: value } : one)))

  // Emptied, not deleted. There are three cells on the cover and there is no
  // version of a direction with two, so what Remove means here is "this slot
  // is open" - and the panel then refuses to save until it is filled.
  const clearSlot = (id) =>
    setSlots(current => current.map(one => (one.id === id ? { ...one, num: '', label: '' } : one)))

  const isEmpty = (one) => !one.num.trim() && !one.label.trim()

  const dropSuggestion = (suggestion) =>
    setSuggestions(current => ({
      ...current,
      [tabId]: (current[tabId] || []).filter(one => keyOf(one) !== keyOf(suggestion))
    }))

  // Add lands in the first open slot. With none open it has to ask, because
  // choosing one on somebody's behalf would quietly drop a figure they wrote.
  function addSuggestion(suggestion) {
    const openSlot = slots.find(isEmpty)
    if (openSlot) {
      setSlots(current => current.map(one =>
        (one.id === openSlot.id ? { ...one, num: suggestion.num, label: suggestion.label } : one)
      ))
      dropSuggestion(suggestion)
      return
    }
    setReplacing(current => ({ ...current, [tabId]: suggestion }))
  }

  function replaceSlot(id) {
    const taken = replacing[tabId]
    if (!taken) return
    setSlots(current => current.map(one =>
      (one.id === id ? { ...one, num: taken.num, label: taken.label } : one)
    ))
    dropSuggestion(taken)
    setReplacing(current => ({ ...current, [tabId]: null }))
  }

  // ---- SAVING EVERY DIRECTION THAT CHANGED ----
  //
  // Checked across all of them before anything is sent. A run that wrote two
  // and stopped on the third would leave the owner with two directions changed
  // and no way to tell which. changedLenses is built further up, beside the
  // guard that asks about it.
  const fault = faultIn(draft)
  const canSave = changedLenses.length > 0 && !saving

  async function save() {
    if (!canSave || !saveLensFields) return

    const bad = changedLenses.find(lens => faultIn(trimmed(drafts[lens.id])))
    if (bad) {
      setFaulted(current => ({ ...current, [bad.id]: true }))
      setTabId(bad.id)
      setSaveError(null)
      return
    }

    setSaving(true)
    setSaveError(null)
    try {
      for (const lens of changedLenses) {
        await saveLensFields(lens.id, { proof_points: trimmed(drafts[lens.id]) })
      }
      onClose?.()
    } catch (err) {
      setSaveError(err?.message || "We couldn't save that. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  // What Save and close calls. Assigned on every render so the bar is never
  // holding last render's drafts.
  saveRef.current = save

  if (!edit?.editing) return null

  const tabSuggestions = suggestions[tabId]
  const tabLoading = loading[tabId] === true
  const tabError = suggestError[tabId] || null
  const tabReplacing = replacing[tabId] || null

  return (
    <ProfileModal
      open={open}
      eyebrow="Proof points"
      title="Manage proof points"
      titleId="hp-manage-proof-points"
      portalClass="hp-ed-portal"
      // The X, Escape and the backdrop all arrive here, so all three are
      // guarded by guarding this one.
      onClose={guard.requestClose}
    >
      <div className="hp-manage">
        {/* Everything above the footer, and the only part that scrolls. */}
        <div className="hp-manage-scroll">
        {/* The directions bar's own tabs, in the panel. One per direction the
            profile shows; a profile showing one gets none, because a row of
            one is a label pretending to be a choice. */}
        {lenses.length > 1 ? (
          <div className="hp-pp-tabs" role="group" aria-label="Career Directions">
            {lenses.map(lens => (
              <button
                key={lens.id}
                type="button"
                className="hp-bar-item"
                data-active={lens.id === tabId ? 'true' : 'false'}
                data-fault={faulted[lens.id] ? 'true' : undefined}
                // `role="group"` and `aria-current`, not a tablist. The
                // directions bar on the page is marked up exactly this way,
                // and a tablist is a promise of arrow-key navigation that
                // neither of these implements.
                aria-current={lens.id === tabId ? 'true' : undefined}
                disabled={saving}
                onClick={() => setTabId(lens.id)}
              >
                <span className="hp-bar-label" data-label={lens.name}>{lens.name}</span>
                <span className="hp-bar-mark" aria-hidden="true" />
              </button>
            ))}
          </div>
        ) : null}

        <p className="hp-manage-note">
          Drag a row to reorder. The first figure leads the cover. A Career Direction
          shows exactly {PROOF_POINT_COUNT}, so adding one replaces another.
        </p>

        {tabReplacing ? (
          <p className="hp-manage-notice" role="status">
            Which one does {tabReplacing.num} {tabReplacing.label} replace?
          </p>
        ) : null}

        <p className="hp-manage-pane-title">On your profile</p>

        <ul
          className="hp-manage-rows"
          ref={listRef}
          data-dragging={dragId ? 'true' : undefined}
        >
          {slots.map((slot, index) => (
            <li
              key={slot.id}
              className="hp-manage-row"
              data-manage-row={slot.id}
              data-dragging={dragId === slot.id ? 'true' : undefined}
              data-drop={overId === slot.id ? sideFor(dragId, slot.id) || undefined : undefined}
            >
              {/* Decorative to a screen reader, which is what it is: the drag
                  is a pointer gesture with no keyboard path through it. */}
              <span
                className="hp-manage-grip"
                aria-hidden="true"
                data-drag={canDrag ? 'true' : 'false'}
                onPointerDown={canDrag ? (e => startDrag(e, slot.id)) : undefined}
                onPointerMove={canDrag ? moveDrag : undefined}
                onPointerUp={canDrag ? endDrag : undefined}
                onPointerCancel={canDrag ? clearDrag : undefined}
              >
                <GripIcon />
              </span>

              <span className="hp-ed-proof-rank" aria-hidden="true">
                {index === 0 ? 'Lead' : index + 1}
              </span>

              <span className="hp-pp-fields">
                <input
                  className="hp-ed-input hp-pp-num"
                  type="text"
                  value={slot.num}
                  placeholder="100%"
                  maxLength={NUM_MAX}
                  disabled={saving}
                  onChange={e => set(slot.id, 'num', e.target.value)}
                  aria-label={`Proof point ${index + 1} figure`}
                />
                <input
                  className="hp-ed-input hp-pp-label"
                  type="text"
                  value={slot.label}
                  placeholder="on-time delivery within 50 days"
                  maxLength={LABEL_MAX}
                  disabled={saving}
                  onChange={e => set(slot.id, 'label', e.target.value)}
                  aria-label={`Proof point ${index + 1} label`}
                />
              </span>

              <span className="hp-manage-acts">
                {tabReplacing ? (
                  <button
                    type="button"
                    className="hp-manage-edit"
                    data-primary="true"
                    onClick={() => replaceSlot(slot.id)}
                  >
                    Replace
                  </button>
                ) : (
                  <button
                    type="button"
                    className="hp-manage-edit"
                    disabled={saving || isEmpty(slot)}
                    onClick={() => clearSlot(slot.id)}
                  >
                    Remove
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>

        {tabReplacing ? (
          <div className="hp-pp-more">
            <button
              type="button"
              className="hp-manage-secondary"
              onClick={() => setReplacing(current => ({ ...current, [tabId]: null }))}
            >
              Cancel replace
            </button>
          </div>
        ) : null}

        <div className="hp-manage-split" role="presentation" />

        <p className="hp-manage-pane-title">Suggestions</p>
        <p className="hp-manage-note">
          From your own career knowledge and your resume, written for this Career
          Direction. Every figure here appears in that material; nothing is
          calculated or rounded.
        </p>

        {tabLoading ? (
          <p className="hp-manage-empty">Reading your career data…</p>
        ) : tabError ? (
          <p className="hp-manage-empty">{tabError}</p>
        ) : !tabSuggestions || tabSuggestions.length === 0 ? (
          <p className="hp-manage-empty">
            Nothing further to suggest from your material right now.
          </p>
        ) : (
          <ul className="hp-manage-rows">
            {tabSuggestions.map(suggestion => (
              <li className="hp-manage-row" key={keyOf(suggestion)}>
                <span className="hp-manage-label">
                  <span className="hp-manage-title">{suggestion.num}</span>
                  <span className="hp-manage-meta">{suggestion.label}</span>
                </span>
                <span className="hp-manage-acts">
                  <button
                    type="button"
                    className="hp-manage-edit"
                    disabled={saving || Boolean(tabReplacing)}
                    onClick={() => addSuggestion(suggestion)}
                  >
                    Add
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="hp-pp-more">
          <button
            type="button"
            className="hp-manage-secondary"
            disabled={tabLoading || saving}
            onClick={() => fetchSuggestions(tabId, offered[tabId] || [])}
          >
            {tabLoading ? 'Looking…' : 'More suggestions'}
          </button>
        </div>

        {fault ? <p className="hp-manage-note hp-pp-why" role="status">{fault}</p> : null}
        {saveError ? <p className="hp-manage-note hp-pp-why" role="alert">{saveError}</p> : null}
        </div>

        {/* One row of buttons at any moment. While the question is up it IS
            the row - the footer gives way to it rather than stacking under it,
            so Save and Discard are never two separate offers on screen at
            once. Both are pinned: neither scrolls with the rows above, at any
            screen height. Built once in ./ManageShell. */}
        {guard.asking ? (
          <UnsavedBar
            onKeep={guard.keepEditing}
            onDiscard={guard.discard}
            onSave={guard.saveAndClose}
          />
        ) : (
          /* One group, on the right, with the filled button furthest right and
             the way out beside it - the same footer the other three panels
             carry, with Save where Done stands in them. */
          <div className="hp-manage-foot">
            <button
              type="button"
              className="hp-manage-secondary"
              disabled={saving}
              onClick={guard.requestClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="hp-manage-done"
              disabled={!canSave}
              onClick={save}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </div>
    </ProfileModal>
  )
}
