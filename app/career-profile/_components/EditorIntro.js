'use client'

import { useSyncExternalStore } from 'react'

// ============================================================================
// THE INTRODUCTION
//
// What this page is, said once, above the thing it is describing.
//
// Dismissable, and the dismissal is remembered. A sentence that explains the
// page earns its space the first time somebody arrives and is furniture on
// every visit after, so it goes away for good when they say so.
//
// WHERE THE DISMISSAL LIVES
// In this browser, and nowhere else. It is a preference about how one person
// likes to look at their own page, not a fact about the profile, so it does
// not belong in a column on career_profiles and does not need to survive a
// change of device. localStorage can throw outright - a private window,
// blocked site data - so every read and write is guarded and the failure mode
// is simply that the note keeps appearing.
//
// It is read through useSyncExternalStore rather than in an effect, because
// localStorage is exactly that: a store outside React. The server snapshot
// says "dismissed", so the note is absent from the prerender and appears only
// once the browser has actually been asked - rather than flashing on every
// load for the people who already dismissed it.
// ============================================================================

const STORAGE_KEY = 'hp.careerProfile.introDismissed'

// A dismissal in this tab has to re-render this component, and one in another
// tab should be honoured too, so both are subscribed to.
const listeners = new Set()

function subscribe(listener) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

// Where the answer lives when storage refuses to hold it - a private window,
// blocked site data. Closing still has to close; it just does not outlive the
// visit, which is the right way for this to degrade.
let dismissedThisVisit = false

function isDismissed() {
  if (dismissedThisVisit) return true
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

// Nothing on the server, so a dismissed note never renders and then vanishes.
const dismissedOnServer = () => true

export default function EditorIntro() {
  const dismissed = useSyncExternalStore(subscribe, isDismissed, dismissedOnServer)

  function dismiss() {
    dismissedThisVisit = true
    try {
      window.localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // Closed for this visit either way; it will be back on the next one.
    }
    listeners.forEach(listener => listener())
  }

  if (dismissed) return null

  return (
    <section className="hp-ed-intro" aria-label="About this page">
      <div className="hp-ed-intro-inner">
        <p className="hp-ed-intro-lead">Your career was never meant to fit on one page.</p>
        <p className="hp-ed-intro-body">
          Everything below was built from your coaching sessions. Edit anything, add
          evidence of your work, and request testimonials. When you&apos;re ready, publish
          and share the link.
        </p>
      </div>
      <button
        type="button"
        className="hp-ed-intro-close"
        onClick={dismiss}
        aria-label="Dismiss this note"
      >
        ×
      </button>
    </section>
  )
}
