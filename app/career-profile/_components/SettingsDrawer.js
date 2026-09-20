'use client'

import { UPGRADE_HREF, UPGRADE_LABEL, upgradeCopyFor } from '@/lib/profileTier'
import { COLOR_MODES, normalizeColorMode } from '@/lib/profileColorMode'
import { ACCENTS, DEFAULT_ACCENT, accentFor } from '@/lib/profileAccent'
import { useCallback, useEffect, useRef, useState } from 'react'

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
// away is a different decision from un-hiding something they kept; it is
// offered back on the Resume Writer hub, which is where it was thrown away.
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
const COLOR_MODE_LABEL = { system: 'System', light: 'Light', dark: 'Dark' }

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
  notify,
  lenses,
  onLensVisibility,
  onLensReorder
}) {
  const closeRef = useRef(null)

  // Which row is mid-write, so one toggle disables itself without freezing the
  // rest of the list.
  const [lensBusy, setLensBusy] = useState(null)

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
  // account cannot customise its profile at all.
  const canReorder = Boolean(onLensReorder) && canCustomise && activeRows.length > 1

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

  function startDrag(event, id) {
    if (!canReorder) return
    setDragId(id)
    event.dataTransfer.effectAllowed = 'move'
    try {
      // Firefox will not start a drag without payload on the transfer.
      event.dataTransfer.setData('text/plain', id)
    } catch {
      // Some browsers refuse this outside a user gesture they recognise. The
      // drag still works from component state.
    }
  }

  function overRow(event, id) {
    if (!canReorder || !dragId) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    if (id !== dropId) setDropId(id)
  }

  function dropOn(event, id) {
    if (!canReorder || !dragId) return
    event.preventDefault()
    const ids = activeRows.map(r => r.lens.id)
    const from = ids.indexOf(dragId)
    const to = ids.indexOf(id)
    setDragId(null)
    setDropId(null)
    if (from === -1 || to === -1) return
    moveTo(from, to)
  }

  function endDrag() {
    setDragId(null)
    setDropId(null)
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
        message: err?.message || "We couldn't change that career direction. Please try again."
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
  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    function onKey(event) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

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
          <Group label="Template" note="More profile templates are coming soon.">
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
              {ACCENTS.map(palette => {
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
              they press a control that refuses. */}
          {directions.length > 0 && (
            <Group label={`Career Directions · ${activeCount} of ${MAX_ACTIVE} active`}>
              {/* Two groups, never mixed. Above the rule, the directions that
                  are on the profile or could be turned back on with a switch;
                  below it, the ones that have not been put on it yet and are
                  added rather than toggled. A switch and an Add button answer
                  different questions and a single list of both reads as one
                  control that changes its mind. */}
              <div className="hp-ed-lenses">
                {activeRows.map(({ lens, index }) => {
                  const busy = lensBusy === lens.id
                  const isPrimary = index === 0
                  return (
                    <div
                      className="hp-ed-lens-row"
                      key={lens.id}
                      data-state={isPrimary ? PRIMARY : SHOWING}
                      data-dragging={dragId === lens.id ? 'true' : undefined}
                      data-dropping={dropId === lens.id && dragId !== lens.id ? 'true' : undefined}
                      draggable={canReorder}
                      onDragStart={e => startDrag(e, lens.id)}
                      onDragOver={e => overRow(e, lens.id)}
                      onDrop={e => dropOn(e, lens.id)}
                      onDragEnd={endDrag}
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
                          ? `Your Career Profile shows ${MAX_ACTIVE_WORD} career directions at a time. Turn one off to add this one.`
                          : undefined}
                        data-on="false"
                      >
                        <span className="hp-ed-switch-knob" aria-hidden="true" />
                      </button>
                    </div>
                  )
                })}
              </div>

              {canReorder ? (
                <p className="hp-ed-soon">
                  Drag to reorder. The first career direction is your primary and loads first for visitors.
                </p>
              ) : null}

              {offeredRows.length > 0 && (
                <>
                  <hr className="hp-ed-lens-split" />
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
                                ? `Your Career Profile shows ${MAX_ACTIVE_WORD} career directions at a time. Turn one off to add this one.`
                                : undefined}
                            >
                              {busy ? 'Adding…' : 'Add to Career Profile'}
                            </button>
                          ) : (
                            <a className="hp-ed-lens-add" href={UPGRADE_HREF}>{UPGRADE_LABEL}</a>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              <p className="hp-ed-soon">
                {!canCustomise
                  ? upgradeCopyFor('lenses')
                  : slotsFull
                    ? `Your Career Profile shows ${MAX_ACTIVE_WORD} career directions at a time. Turn one off to add another. Everything written for it stays ready to restore.`
                    : 'Your primary career direction always shows. Turn another one off anytime. Everything written for it stays ready to restore.'}
              </p>
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
                <a className="hp-ed-upsell-link" href={UPGRADE_HREF}>{UPGRADE_LABEL}</a>
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
    </>
  )
}
