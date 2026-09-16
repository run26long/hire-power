'use client'

import { useEffect, useRef } from 'react'

// ============================================================================
// SETTINGS
//
// The things that belong to the profile as a whole rather than to any one
// direction: the link, the address behind the Contact button, the switch that
// makes the page readable, and how it is set to look.
//
// A drawer rather than a sidebar, because none of this is part of the page.
// The profile is the page; this is the handful of decisions standing behind
// it, and it should be reachable in one click and gone again in one.
//
// READ-ONLY IN THIS PASS
// Every control shows its real value and is disabled. They are drawn now so
// the drawer has its true shape before anything can write, and each says what
// it is waiting for rather than going quiet under a click.
// ============================================================================

const HEX = /^#[0-9a-f]{3,8}$/i

function humanize(value) {
  if (!value || typeof value !== 'string') return null
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function Group({ label, children, soon }) {
  return (
    <div className="hp-ed-group">
      <p className="hp-ed-label">{label}</p>
      {children}
      {soon ? <p className="hp-ed-soon">{soon}</p> : null}
    </div>
  )
}

function Value({ children, empty }) {
  if (empty) return <p className="hp-ed-value" data-empty="true">{empty}</p>
  return <p className="hp-ed-value">{children}</p>
}

export default function SettingsDrawer({ open, onClose, profile, publicUrl }) {
  const closeRef = useRef(null)

  // Escape closes it, and focus moves into the drawer when it opens so a
  // keyboard is not left behind the scrim with nothing to act on.
  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    function onKey(event) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const published = profile?.is_published === true
  const accent = profile?.accent || null

  return (
    <>
      <button
        type="button"
        className="hp-ed-scrim"
        aria-label="Close settings"
        onClick={onClose}
      />
      <aside className="hp-ed-drawer" role="dialog" aria-modal="true" aria-label="Career Profile settings">
        <div className="hp-ed-drawer-head">
          <p className="hp-ed-drawer-title">Settings</p>
          <button
            type="button"
            ref={closeRef}
            className="hp-ed-action"
            onClick={onClose}
          >
            Done
          </button>
        </div>

        <div className="hp-ed-drawer-body">
          <Group
            label="Publication"
            soon="The publish switch arrives with the settings write route."
          >
            <Value>
              {published
                ? 'Published. Anyone with the link can read this profile.'
                : 'Draft. Only you can open this profile.'}
            </Value>
          </Group>

          <Group label="Link" soon="Choosing your own slug arrives in the same pass.">
            {publicUrl
              ? <Value>{publicUrl}</Value>
              : <Value empty="No link yet." />}
          </Group>

          <Group
            label="Contact address"
            soon="The Contact button appears on your profile once an address is set."
          >
            {profile?.contact_email
              ? <Value>{profile.contact_email}</Value>
              : <Value empty="No address set, so the Contact button does not appear." />}
          </Group>

          <Group label="Template" soon="Template and colour choices arrive with appearance settings.">
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
