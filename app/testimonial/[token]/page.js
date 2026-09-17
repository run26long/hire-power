'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

import '../../p/[slug]/_styles/tokens.css'
import './_styles/referee.css'

// ============================================================================
// /testimonial/[token]: the referee's page
//
// Somebody who has never used this product, arriving from an email, doing a
// favour for a colleague, and probably never coming back. So they do not meet
// the application: no nav, no account, no sign-in, nothing to dismiss, and
// nothing asking them to build a profile until after they have done the thing
// they came for.
//
// ONE VISIT, START TO FINISH, AND NOTHING SENT WITHOUT A YES
// They write, a draft comes back while they wait, and they read it on the
// same screen. If it is not right they say so and the form returns with their
// own words still in it. Only pressing send submits anything or tells the
// candidate: writing is not submitting, and a draft nobody approved is not a
// testimonial. Nothing about this needs a second email or a second visit.
//
// IT LOOKS LIKE WHERE THE WORDS ARE GOING
// The email that sends somebody here is dark and the Career Profile their
// sentence ends up on is dark, so the page in the middle is too. It reads the
// Profile's own tokens rather than holding a second palette, which is why
// tokens.css is imported here and names .hp-tm alongside .hp-profile.
//
// THE CANDIDATE IS NAMED, NEVER PRONOUNED
// Every sentence on this page says the person's name rather than "they" or
// "their". Two people are being talked about throughout - the person writing
// and the person being written about - and a "they" in that sentence belongs
// to whichever one the reader was last thinking of. The name costs a few
// characters and removes the question.
//
// WHAT THIS PAGE KNOWS
// The candidate's display name, the referee's own name, and this one
// testimonial. That is all the route will tell it. It has no profile id, no
// slug, no idea whether there are other testimonials, and no way to ask.
// ============================================================================

const MIN = 40
const MAX = 4000

const LOGO = '/images/hire-power-logo-white-v2.png'

export default function TestimonialPage() {
  const params = useParams()
  const token = params?.token

  const [state, setState] = useState('loading')   // loading | notfound | error | ready
  const [record, setRecord] = useState(null)

  // 'write' while the form is up, 'review' once there is a draft to read, and
  // 'done' once it has been sent. Held apart from the record's own status so
  // going back to change something can put the form up without pretending the
  // stored status changed.
  const [view, setView] = useState('write')
  const [text, setText] = useState('')
  const [consent, setConsent] = useState(false)
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // The polishing step came back with nothing. Not an error the referee caused
  // and not a finished submission either, so it is its own state: their words
  // are safe, nothing has been sent, and the only thing to do is try again.
  const [polishFailed, setPolishFailed] = useState(false)

  // Approving is a second request, and the only one that submits anything.
  const [approving, setApproving] = useState(false)

  // Which of the two versions is on screen, and therefore which one gets sent.
  // The rewrite leads because it is the thing they asked us to make; their own
  // wording is one click away and never overwritten, so choosing it costs
  // nothing and changing their mind costs nothing either.
  const [version, setVersion] = useState('polished')

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
      // Three places to land. Approved and sent, a draft waiting to be read,
      // or an empty box. The status is what says which: a row still at
      // `requested` has not been submitted however much text is on it.
      const approved = payload.status === 'polished' || payload.status === 'published'
      setView(approved ? 'done' : payload.polished_text ? 'review' : 'write')
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
      // A draft to read, or a step that did not work. Either way nothing has
      // been submitted and nobody has been told.
      setPolishFailed(payload?.polish_failed === true)
      setView('review')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError(err?.message || "We couldn't save that. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  // Yes, send it. The only request that submits the testimonial and tells the
  // candidate, and it exists so that neither can happen without this click.
  async function approve() {
    if (approving) return
    setApproving(true)
    setError(null)
    try {
      const res = await fetch(`/api/testimonial/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Whichever version is on screen is the one that goes.
        body: JSON.stringify({ action: 'approve', version })
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload?.error || "We couldn't send that. Please try again.")
      setRecord(payload)
      setView('done')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError(err?.message || "We couldn't send that. Please try again.")
    } finally {
      setApproving(false)
    }
  }

  // The mark and the content. Every state renders through here so the page is
  // the same page whichever one is showing.
  const shell = (children) => (
    <div className="hp-tm">
      <header className="hp-tm-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="hp-tm-logo" src={LOGO} alt="Hire Power" />
      </header>

      {children}
    </div>
  )

  if (state === 'loading') {
    return shell(
      <div className="hp-tm-state">
        <div className="hp-tm-spinner" role="status" aria-label="Loading" />
      </div>
    )
  }

  // A bad token and a withdrawn request get the same answer, so a stranger
  // cannot learn which by trying.
  if (state === 'notfound') {
    return shell(
      <div className="hp-tm-state">
        <p className="hp-tm-lead">This link is no longer active.</p>
        <p className="hp-tm-sub">
          It may have already been used and withdrawn, or the address may be incomplete.
          If you were asked for a testimonial, request a fresh link and try again.
        </p>
      </div>
    )
  }

  if (state === 'error') {
    return shell(
      <div className="hp-tm-state">
        <p className="hp-tm-lead">Something went wrong.</p>
        <p className="hp-tm-sub">Please try that link again in a moment.</p>
        <div className="hp-tm-actions">
          <button type="button" className="hp-tm-btn" onClick={() => { setState('loading'); load() }}>
            Try again
          </button>
        </div>
      </div>
    )
  }

  // Named, never pronouned. The fallback is a noun for the same reason: "them"
  // would have been the one pronoun on a page that avoids them.
  const candidate = record?.candidate_name || 'this person'

  // What the page calls the candidate when it is talking to the referee. A
  // colleague doing somebody a favour is on first-name terms with them, and
  // "working with James Long" in every sentence reads like a form. The full
  // name is still what the route identifies and validates against.
  const first = record?.candidate_first_name || candidate
  // Whether this testimonial has actually been submitted. The row carries
  // text long before it carries a decision, so the status is what says so.
  const alreadySent = record?.status === 'polished' || record?.status === 'published'
  const trimmed = text.trim()
  const remaining = MIN - trimmed.length
  const canSubmit = trimmed.length >= MIN && !saving && (record?.submissions_left ?? 0) > 0

  return shell(
    <main className="hp-tm-main">
      {view === 'review' ? (
        polishFailed ? (
          // Nothing was produced, so nothing was sent. Said plainly and
          // without a thank-you over the top of it: the favour is not done
          // yet, and the only thing on offer is another go.
          <>
            <span className="hp-tm-eyebrow">Not sent yet</span>
            <p className="hp-tm-lead">We could not prepare your draft.</p>
            <p className="hp-tm-sub">
              Nothing has been sent and {first} has not been told. Your words are safe,
              exactly as you wrote them, and they are below. Please try once more.
            </p>
            <blockquote className="hp-tm-quote">{record?.raw_text}</blockquote>

            <div className="hp-tm-actions">
              <button
                type="button"
                className="hp-tm-btn"
                onClick={() => { setView('write'); setError(null); setPolishFailed(false) }}
                disabled={(record?.submissions_left ?? 0) <= 0}
              >
                Try again
              </button>
            </div>

            {(record?.submissions_left ?? 0) <= 0 ? (
              <p className="hp-tm-hint">
                You have made a few versions today. You can come back tomorrow to try again.
              </p>
            ) : null}

            {error ? <p className="hp-tm-error" role="alert">{error}</p> : null}
          </>
        ) : (
          // The draft, and the decision. Nothing has been submitted and
          // nobody has been told until the button below is pressed.
          <>
            <span className="hp-tm-eyebrow">Review your response</span>
            <p className="hp-tm-lead">Here is your testimonial for {first}.</p>
            <p className="hp-tm-sub">
              We polished your response to make your perspective clear and compelling while
              keeping your meaning intact. Compare the Hire Power version with your original
              wording, then choose the version you want to send.
            </p>

            {/* Two versions, one on screen. A radiogroup rather than two
                buttons, so a keyboard moves between them with the arrow keys
                and a screen reader announces which of the two is chosen. */}
            <div className="hp-tm-seg" role="radiogroup" aria-label="Which version to send">
              <button
                type="button"
                role="radio"
                className="hp-tm-seg-btn"
                aria-checked={version === 'polished'}
                data-on={version === 'polished' ? 'true' : undefined}
                onClick={() => setVersion('polished')}
                disabled={approving}
              >
                Hire Power version
              </button>
              <button
                type="button"
                role="radio"
                className="hp-tm-seg-btn"
                aria-checked={version === 'original'}
                data-on={version === 'original' ? 'true' : undefined}
                onClick={() => setVersion('original')}
                disabled={approving}
              >
                Original wording
              </button>
            </div>

            <blockquote className="hp-tm-quote" data-version={version}>
              {version === 'original' ? record?.raw_text : record?.polished_text}
            </blockquote>

            <div className="hp-tm-actions">
              <button type="button" className="hp-tm-btn" onClick={approve} disabled={approving}>
                {approving ? 'Sending…' : 'Send it'}
              </button>
              <button
                type="button"
                className="hp-tm-btn"
                data-quiet="true"
                onClick={() => { setView('write'); setError(null) }}
                disabled={approving || (record?.submissions_left ?? 0) <= 0}
              >
                Change it
              </button>
            </div>

            {(record?.submissions_left ?? 0) <= 0 ? (
              <p className="hp-tm-hint">
                You have made a few versions today. You can still send this one, and come back
                tomorrow to change it again.
              </p>
            ) : null}

            {error ? <p className="hp-tm-error" role="alert">{error}</p> : null}
          </>
        )
      ) : view === 'done' ? (
        <>
          <span className="hp-tm-eyebrow">Sent</span>
          <p className="hp-tm-lead">
            Thank you{record?.referee_name ? `, ${record.referee_name.split(' ')[0]}` : ''}.
          </p>

          <p className="hp-tm-sub">
            Your testimonial has been sent to {first}.
          </p>
          <blockquote className="hp-tm-quote">{record?.polished_text}</blockquote>
          <p className="hp-tm-note">
            {first} decides whether this appears on the profile. It is not public until
            published.
          </p>

          {/* Nothing to press. The favour is done, so the screen stops offering
              ways to redo it and says so instead: an edit control here invites
              somebody to keep working on something they have finished, and a
              line about how many versions are left today is a limit on a thing
              nobody is being asked to do any more. */}
          <p className="hp-tm-note">You are all set. You can close this window.</p>

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
          <span className="hp-tm-eyebrow">Testimonial request</span>
          <h1 className="hp-tm-lead">Share your perspective on working with {first}.</h1>
          <p className="hp-tm-sub">
            Write naturally. A few honest sentences are all you need. Hire Power will shape
            your thoughts into a concise draft for you to review and change before anything
            is shared.
          </p>

          <label className="hp-tm-label" htmlFor="hp-tm-text">In your own words</label>
          <textarea
            id="hp-tm-text"
            className="hp-tm-textarea"
            value={text}
            maxLength={MAX}
            onChange={e => setText(e.target.value)}
            placeholder={`What stood out about working with ${first}? What should others know?`}
            spellCheck="true"
            aria-describedby="hp-tm-count"
          />
          <p className="hp-tm-count" id="hp-tm-count" data-short={remaining > 0 ? 'true' : undefined}>
            {remaining > 0
              ? `Write at least ${remaining} more characters.`
              : `${trimmed.length} characters.`}
          </p>

          <div className="hp-tm-consent">
            <label className="hp-tm-check">
              <input
                type="checkbox"
                checked={consent}
                onChange={e => setConsent(e.target.checked)}
              />
              <span>I’m willing to serve as an ongoing reference for {first}.</span>
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
                  Checking this box gives {first} permission to include your contact information
                  on reference sheets for future job applications. It will never appear on the
                  public Career Profile.
                </p>
              </>
            ) : null}
          </div>

          <div className="hp-tm-actions">
            <button type="button" className="hp-tm-btn" onClick={submit} disabled={!canSubmit}>
              {saving ? 'Saving…' : 'Review my response'}
            </button>
            {/* Back to whichever screen they left. A draft that has not been
                approved returns to the review, not to a thank-you for
                something that never happened. */}
            {record?.polished_text ? (
              <button
                type="button"
                className="hp-tm-btn"
                data-quiet="true"
                onClick={() => { setView(alreadySent ? 'done' : 'review'); setError(null) }}
                disabled={saving}
              >
                Cancel
              </button>
            ) : null}
          </div>

          {error ? <p className="hp-tm-error" role="alert">{error}</p> : null}
        </>
      )}
    </main>
  )
}
