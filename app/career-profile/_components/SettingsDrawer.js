'use client'

import { UPGRADE_HREF, UPGRADE_LABEL, upgradeCopyFor } from '@/lib/profileTier'
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

const HEX = /^#[0-9a-f]{3,8}$/i

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
// WHAT A DIRECTION IS DOING ON THE PROFILE
//
// Four states, and only three of them have a control. The primary is the one
// the page is written around and cannot be taken off it; a dismissed direction
// is not offered back here, because putting something back that somebody threw
// away is a different decision from un-hiding something they kept.
// ---------------------------------------------------------------------------
const PRIMARY = 'primary'
const SHOWING = 'showing'
const HIDDEN_STATE = 'hidden'
const OFFERED = 'offered'

function lensState(lens) {
  if (lens?.source === 'user' && lens?.sort_order === 0) return PRIMARY
  if (lens?.status === 'active') return SHOWING
  if (lens?.status === 'hidden') return HIDDEN_STATE
  if (lens?.status === 'suggested') return OFFERED
  return null
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
  onLensVisibility
}) {
  const closeRef = useRef(null)

  // Which row is mid-write, so one toggle disables itself without freezing the
  // rest of the list.
  const [lensBusy, setLensBusy] = useState(null)

  const directions = (Array.isArray(lenses) ? lenses : [])
    .map(lens => ({ lens, state: lensState(lens) }))
    .filter(row => row.state !== null)

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
        message: err?.message || "We couldn't change that direction. Please try again."
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

  if (!open) return null

  const accent = profile?.accent || null
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

          {/* ---- Directions ----
              What the profile shows, rather than what exists. Hiding one keeps
              everything written for it, so the switch is reversible in both
              directions and nothing has to be generated again to come back. */}
          {directions.length > 0 && (
            <Group label="Directions">
              <div className="hp-ed-lenses">
                {directions.map(({ lens, state }) => {
                  const busy = lensBusy === lens.id
                  const showing = state === PRIMARY || state === SHOWING
                  return (
                    <div className="hp-ed-lens-row" key={lens.id} data-state={state}>
                      <span className="hp-ed-lens-name">{lens.name}</span>

                      {state === PRIMARY ? (
                        // No switch at all. A disabled one would say this is
                        // yours to change and that it is currently refused,
                        // and only the second of those is true.
                        <span className="hp-ed-lens-fixed">Always on</span>
                      ) : state === OFFERED ? (
                        canCustomise ? (
                          <button
                            type="button"
                            className="hp-ed-lens-add"
                            onClick={() => setLensVisible(lens, true)}
                            disabled={busy}
                          >
                            {busy ? 'Adding…' : 'Add to profile'}
                          </button>
                        ) : (
                          <a className="hp-ed-lens-add" href={UPGRADE_HREF}>{UPGRADE_LABEL}</a>
                        )
                      ) : (
                        <button
                          type="button"
                          className="hp-ed-switch"
                          role="switch"
                          aria-checked={showing}
                          aria-label={`Show ${lens.name} on your profile`}
                          onClick={() => setLensVisible(lens, !showing)}
                          // Turning one off is never gated. A lapsed account
                          // must always be able to take something down.
                          disabled={busy || (!showing && !canCustomise)}
                          data-on={showing ? 'true' : 'false'}
                        >
                          <span className="hp-ed-switch-knob" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
              <p className="hp-ed-soon">
                {canCustomise
                  ? 'Your main direction always shows. Turning another one off keeps everything written for it, ready to put back.'
                  : upgradeCopyFor('lenses')}
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

          {/* ---- Appearance: still read-only ---- */}
          <Group label="Template" note="Template and colour choices arrive with appearance settings.">
            {humanize(profile?.template)
              ? <Value>{humanize(profile.template)}</Value>
              : <Value empty="Default." />}
          </Group>

          <Group label="Colour mode">
            {humanize(profile?.color_mode)
              ? <Value>{humanize(profile.color_mode)}</Value>
              : <Value empty="Default." />}
          </Group>

          <Group label="Accent">
            {accent ? (
              <p className="hp-ed-value">
                <span
                  className="hp-ed-swatch"
                  style={{ background: HEX.test(accent) ? accent : 'transparent' }}
                  aria-hidden="true"
                />
                {accent}
              </p>
            ) : <Value empty="Default." />}
          </Group>
        </div>
      </aside>
    </>
  )
}
