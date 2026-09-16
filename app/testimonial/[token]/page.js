'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

import './_styles/referee.css'

// ============================================================================
// /testimonial/[token] — the referee's page
//
// Somebody who has never used this product, arriving from an email, doing a
// favour for a colleague, and probably never coming back. So they do not meet
// the application: no nav, no account, no sign-in, nothing to dismiss, and
// nothing asking them to build a profile until after they have done the thing
// they came for.
//
// ONE VISIT, START TO FINISH
// They write, it is polished while they wait, and they read the result on the
// same screen. If it is not right they say so and the form comes back with
// their own words still in it. Nothing about this needs a second email or a
// second visit, and the confirmation that does arrive says no action is
// required, because none is.
//
// WHAT THIS PAGE KNOWS
// The candidate's display name, the referee's own name, and this one
// testimonial. That is all the route will tell it. It has no profile id, no
// slug, no idea whether there are other testimonials, and no way to ask.
// ============================================================================

const MIN = 40
const MAX = 4000

export default function TestimonialPage() {
  const params = useParams()
  const token = params?.token

  const [state, setState] = useState('loading')   // loading | notfound | error | ready
  const [record, setRecord] = useState(null)

  // 'write' while the form is up, 'done' once they have seen the result. Held
  // apart from the record's own status so "request changes" can put the form
  // back without pretending the stored status changed.
  const [view, setView] = useState('write')
  const [text, setText] = useState('')
  const [consent, setConsent] = useState(false)
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/testimonial/${encodeURIComponent(token)}`)
      if (res.status === 404) { setState('notfound'); return }
      if (!res.ok) { setState('error'); return }
      const payload = await res.json()
      setRecord(payload)
      setText(payload.raw_text || '')
      setConsent(payload.reference_consent === true)
      setPhone(payload.reference_phone || '')
      // Somebody returning to a finished testimonial sees what it became
      // rather than an empty box.
      setView(payload.polished_text ? 'done' : 'write')
      setState('ready')
    } catch {
      setState('error')
    }
  }, [token])

  useEffect(() => {
    if (!token) { setState('notfound'); return }
    let cancelled = false
    queueMicrotask(() => { if (!cancelled) load() })
    return () => { cancelled = true }
  }, [token, load])

  async function submit() {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/testimonial/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_text: text,
          reference_consent: consent,
          reference_phone: consent ? phone : null
        })
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload?.error || "We couldn't save that. Please try again.")
      setRecord(payload)
      setView('done')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError(err?.message || "We couldn't save that. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const shell = (children) => (
    <div className="hp-tm">
      {children}
      <p className="hp-tm-foot">
        <a href="https://hirepowerai.com">Hire Power</a> · The operating system for your career
      </p>
    </div>
  )

  if (state === 'loading') {
    return shell(<div className="hp-tm-state"><div className="hp-tm-spinner" role="status" aria-label="Loading" /></div>)
  }

  // A bad token and a withdrawn request get the same answer, so a stranger
  // cannot learn which by trying.
  if (state === 'notfound') {
    return shell(
      <div className="hp-tm-state">
        <p className="hp-tm-lead">This link is no longer active.</p>
        <p className="hp-tm-sub" style={{ marginBottom: 0 }}>
          It may have already been used and withdrawn, or the address may be incomplete.
          If somebody asked you for a testimonial, ask them to send the link again.
        </p>
      </div>
    )
  }

  if (state === 'error') {
    return shell(
      <div className="hp-tm-state">
        <p className="hp-tm-lead">Something went wrong.</p>
        <p className="hp-tm-sub" style={{ marginBottom: 20 }}>Please try that link again in a moment.</p>
        <button type="button" className="hp-tm-btn" onClick={() => { setState('loading'); load() }}>
          Try again
        </button>
      </div>
    )
  }

  const candidate = record?.candidate_name || 'them'
  const trimmed = text.trim()
  const canSubmit = trimmed.length >= MIN && !saving && (record?.submissions_left ?? 0) > 0

  return shell(
    <div className="hp-tm-card">
      <div className="hp-tm-head">
        <span className="hp-tm-mark">Hire Power</span>
        <span className="hp-tm-tag">The operating system for your career</span>
      </div>

      <div className="hp-tm-body">
        {view === 'done' ? (
          <>
            <p className="hp-tm-lead">Thank you{record?.referee_name ? `, ${record.referee_name.split(' ')[0]}` : ''}.</p>

            {record?.polished_text ? (
              <>
                <p className="hp-tm-sub">
                  Here is your testimonial for {candidate}, tidied into a couple of sentences.
                  We have emailed you a copy.
                </p>
                <blockquote className="hp-tm-quote">{record.polished_text}</blockquote>
                <p className="hp-tm-note">
                  {candidate} decides whether it appears on their profile. It is not public until they publish it.
                </p>
              </>
            ) : (
              // Polishing failed but their words are saved. Said plainly,
              // because "thank you" over a silent failure is worse than the
              // failure.
              <>
                <p className="hp-tm-sub">
                  Your words are saved and {candidate} has been told. We could not tidy them into a short
                  version just now, so {candidate} will see exactly what you wrote.
                </p>
                <blockquote className="hp-tm-quote">{record?.raw_text}</blockquote>
              </>
            )}

            <div className="hp-tm-actions">
              <button
                type="button"
                className="hp-tm-btn"
                data-quiet="true"
                onClick={() => { setView('write'); setError(null) }}
                disabled={(record?.submissions_left ?? 0) <= 0}
              >
                {record?.polished_text ? 'Change it' : 'Try again'}
              </button>
            </div>

            {(record?.submissions_left ?? 0) <= 0 ? (
              <p className="hp-tm-hint">
                You have made a few versions today. You can come back tomorrow to change it again.
              </p>
            ) : null}

            {/* Only here, and only now. Asking somebody to sign up before they
                have done the favour is the wrong order. */}
            <div className="hp-tm-plug">
              <p className="hp-tm-plug-lead">Your career is bigger than one page too.</p>
              <p className="hp-tm-plug-body">
                Build yours at <a href="https://hirepowerai.com">hirepowerai.com</a>
              </p>
            </div>
          </>
        ) : (
          <>
            <p className="hp-tm-lead">Tell us about your experience working with {candidate}.</p>
            <p className="hp-tm-sub">
              Write it however it comes out. A few sentences is plenty, and we will tidy it into a short
              version and show you the result before you go. {candidate} decides whether it appears on
              their profile.
            </p>

            <label className="hp-tm-label" htmlFor="hp-tm-text">In your own words</label>
            <textarea
              id="hp-tm-text"
              className="hp-tm-textarea"
              value={text}
              maxLength={MAX}
              onChange={e => setText(e.target.value)}
              placeholder={`What was it like working with ${candidate}? What did they do well?`}
              spellCheck="true"
            />
            <p className="hp-tm-count">
              {trimmed.length < MIN
                ? `${MIN - trimmed.length} more characters before you can send it.`
                : `${trimmed.length} characters.`}
            </p>

            <div className="hp-tm-consent">
              <label className="hp-tm-check">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={e => setConsent(e.target.checked)}
                />
                <span>I&apos;m also willing to serve as a reference for {candidate}</span>
              </label>

              {consent ? (
                <>
                  <input
                    className="hp-tm-phone"
                    type="tel"
                    value={phone}
                    placeholder="Phone number (optional)"
                    onChange={e => setPhone(e.target.value)}
                    aria-label="Your phone number, optional"
                  />
                  <p className="hp-tm-hint">
                    Shared only with {candidate}, for a reference sheet they can give an employer.
                    It is never shown on their public profile.
                  </p>
                </>
              ) : null}
            </div>

            <div className="hp-tm-actions">
              <button type="button" className="hp-tm-btn" onClick={submit} disabled={!canSubmit}>
                {saving ? 'Saving…' : 'Send it'}
              </button>
              {record?.polished_text ? (
                <button
                  type="button"
                  className="hp-tm-btn"
                  data-quiet="true"
                  onClick={() => { setView('done'); setError(null) }}
                  disabled={saving}
                >
                  Cancel
                </button>
              ) : null}
            </div>

            {error ? <p className="hp-tm-error">{error}</p> : null}
          </>
        )}
      </div>
    </div>
  )
}
