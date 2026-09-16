'use client'

import { useState } from 'react'

import { createClient } from '@/utils/supabase/client'

// ============================================================================
// THE ADDRESS BEHIND THE CONTACT BUTTON
//
// Owner only, and the only writable thing on the Career Profile besides the
// generate control. There is no settings screen for a profile anywhere in the
// app, so this sits under the button it fills: the owner sees the control and
// the result of the control in the same place, which is the shortest possible
// distance between changing it and knowing what changed.
//
// Empty means none. Clearing the box and saving stores NULL, and the Contact
// button stops rendering for everyone - that is the way to take it down, and
// it is why the field says so rather than leaving somebody guessing whether a
// blank save does nothing.
//
// The address is not validated for deliverability here or anywhere. The shape
// is checked so an obvious mistake is caught before it reaches the database
// constraint, and beyond that an unusual address is assumed to be right.
// ============================================================================

export default function ContactEmailField({ value, onSaved }) {
  const [draft, setDraft] = useState(value || '')
  const [saving, setSaving] = useState(false)
  const [state, setState] = useState(null)

  const current = value || ''
  const dirty = draft.trim() !== current

  async function save(event) {
    event?.preventDefault()
    if (saving || !dirty) return
    setSaving(true)
    setState(null)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/career-profile/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify({ contact_email: draft })
      })

      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setState({ tone: 'error', text: body?.error || "We couldn't save that. Please try again." })
        return
      }

      // The page holds the address, so it is told rather than left to refetch.
      onSaved?.(body.contact_email ?? null)
      setDraft(body.contact_email || '')
      setState({
        tone: 'ok',
        text: body.contact_email ? 'Saved. The Contact button is live.' : 'Cleared. The Contact button is hidden.'
      })
    } catch {
      setState({ tone: 'error', text: "That didn't reach us. Check your connection and try again." })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="hp-foot-contact" onSubmit={save}>
      <label className="hp-foot-contact-label" htmlFor="hp-contact-email">
        Contact email
      </label>

      <div className="hp-foot-contact-row">
        <input
          id="hp-contact-email"
          className="hp-foot-contact-input"
          type="email"
          inputMode="email"
          autoComplete="email"
          spellCheck="false"
          maxLength={254}
          placeholder="you@example.com"
          value={draft}
          disabled={saving}
          onChange={(e) => { setDraft(e.target.value); setState(null) }}
        />

        <button
          type="submit"
          className="hp-foot-contact-save"
          disabled={saving || !dirty}
          aria-busy={saving ? 'true' : undefined}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      <p className="hp-foot-contact-note" role={state ? 'status' : undefined}>
        {state
          ? state.text
          : 'Shown to anyone with the link as a Contact button. Leave it empty to hide the button.'}
      </p>
    </form>
  )
}
