'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ============================================================================
// HIRING BRIEF
//
// A job description in, a Hiring Brief out, measured against the whole career
// rather than the chapter currently on screen.
//
// Two ways in, one at a time. Stacking a dropzone above a textarea asks the
// recruiter to work out which one the page wants; a two-option switch asks them
// which one they have. Upload leads because that is how a job description
// usually arrives, as a file somebody was sent.
//
// Every brief made in this visit is kept, and they are kept as a list. Three
// roles against one candidate is a comparison, and a comparison wants all of it
// visible at once - a carousel would hide two thirds of the answer behind an
// arrow and make the reader remember the rest. Each row holds its own signed
// token, so each opens its own report and its own PDF. Opening one is looking,
// not asking: no request is made and no quota is spent.
//
// Nothing here parses anything. The file goes to the route as a file; the
// server owns reading it, and this side owns saying clearly what happened when
// it could not.
// ============================================================================

const ACCEPT = '.pdf,.docx,.txt'
const FORMATS = 'PDF, DOCX, or TXT'
const MAX_BYTES = 10 * 1024 * 1024
const MIN_PASTE = 100
const MAX_PASTE = 10000

// One message per outcome the route actually reports. Specific, because "an
// error occurred" tells a recruiter nothing about whether to try a different
// file or give up.
const MESSAGES = {
  NO_FILE: 'Choose a file, or paste the description instead.',
  UNSUPPORTED_FILE_TYPE: `That format can't be read. Use ${FORMATS}.`,
  FILE_TOO_LARGE: 'That file is over 10MB. Try a smaller copy.',
  EMPTY_FILE: 'That file is empty.',
  UNREADABLE_FILE: "That file couldn't be opened. It may be corrupted or password-protected.",
  SCANNED_PDF: 'That PDF looks like a scan, so there is no text in it to read. Try a text-based PDF, or paste the description.',
  BAD_JOB_DESCRIPTION: 'That description is too short or too long to work with.',
  RATE_LIMITED: "That's today's hiring briefs for this profile. The limit resets tomorrow.",
  INCOMPLETE: 'That brief came back incomplete. Try running it again.',
  UNAVAILABLE: 'This is briefly unavailable. Try again in a moment.',
  TIER_REQUIRED: 'This tool is not available on this profile.',
  NOT_FOUND: 'This profile could not be found.',
  NETWORK: "That didn't reach us. Check your connection and try again."
}

// Four labelled sources, drawn as a map rather than a progress bar. It says
// what is being searched, which is true, and claims nothing about how far
// through it is, which would not be: the route reports no stages.
const SOURCES = ['Experience', 'Knowledge', 'Evidence', 'Testimonials']

const STAGES = [
  'Reading the role requirements',
  'Searching the full career record',
  'Checking experience, evidence, and testimonials',
  'Building the hiring brief'
]

function IntelligenceMap({ reducedMotion }) {
  const [stage, setStage] = useState(0)

  useEffect(() => {
    // The messages rotate on a timer because they describe what the tool is
    // doing, not what it has finished. Nothing here is driven by a progress
    // event, because there is no progress event to drive it.
    const id = window.setInterval(() => setStage(s => (s + 1) % STAGES.length), 4200)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="hp-rt-map" data-still={reducedMotion ? 'true' : 'false'}>
      <div className="hp-rt-map-field" aria-hidden="true">
        <svg className="hp-rt-map-lines" viewBox="0 0 320 180" preserveAspectRatio="none" focusable="false">
          <line className="hp-rt-line" x1="44" y1="30" x2="160" y2="90" />
          <line className="hp-rt-line" x1="276" y1="30" x2="160" y2="90" />
          <line className="hp-rt-line" x1="44" y1="150" x2="160" y2="90" />
          <line className="hp-rt-line" x1="276" y1="150" x2="160" y2="90" />
        </svg>

        <span className="hp-rt-map-core" />

        {SOURCES.map((name, i) => (
          <span className="hp-rt-map-node" data-node={i} key={name}>
            <span className="hp-rt-map-dot" />
            <span className="hp-rt-map-name">{name}</span>
          </span>
        ))}
      </div>

      <p className="hp-rt-map-stage" role="status" aria-live="polite">{STAGES[stage]}</p>
      <p className="hp-rt-map-note">This usually takes about 20 seconds.</p>
    </div>
  )
}

// "Candidate for X at Y" rather than "X at Y", which reads as the job they
// already hold. Either half may be missing, because the evaluation returns null
// rather than guessing at one.
export function candidateLine(roleTitle, company) {
  if (!roleTitle) return null
  return company ? `Candidate for ${roleTitle} at ${company}` : `Candidate for ${roleTitle}`
}

export default function RoleMeetCareer({ slug, state, setState, reducedMotion, onOpenBrief }) {
  const { mode, file, pasted, pending, briefs, composing, error, limitReached } = state
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)
  const dragDepth = useRef(0)

  const set = useCallback((patch) => setState(prev => ({ ...prev, ...patch })), [setState])

  // Checked here only to spare the recruiter a round trip on the two things a
  // browser can already see. Everything else is the server's call, and the
  // server checks these again regardless.
  const vet = (candidate) => {
    const name = candidate?.name || ''
    const dot = name.lastIndexOf('.')
    const ext = dot >= 0 ? name.slice(dot).toLowerCase() : ''
    if (!['.pdf', '.docx', '.txt'].includes(ext)) return MESSAGES.UNSUPPORTED_FILE_TYPE
    if (candidate.size > MAX_BYTES) return MESSAGES.FILE_TOO_LARGE
    if (candidate.size === 0) return MESSAGES.EMPTY_FILE
    return null
  }

  const take = (candidate) => {
    if (!candidate) return
    const complaint = vet(candidate)
    if (complaint) { set({ error: complaint }); return }
    set({ file: candidate, error: null })
  }

  const onDrop = (event) => {
    event.preventDefault()
    dragDepth.current = 0
    setDragging(false)
    take(event.dataTransfer?.files?.[0])
  }

  const submit = useCallback(async () => {
    if (pending || limitReached) return
    const text = pasted.trim()
    const sendingFile = mode === 'upload' && file
    if (!sendingFile && text.length < MIN_PASTE) {
      set({ error: mode === 'upload' ? MESSAGES.NO_FILE : MESSAGES.BAD_JOB_DESCRIPTION })
      return
    }

    set({ pending: true, error: null })

    let res
    try {
      if (sendingFile) {
        const form = new FormData()
        form.append('slug', slug)
        form.append('file', file)
        res = await fetch('/api/career-profile/evaluate', { method: 'POST', body: form })
      } else {
        res = await fetch('/api/career-profile/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug, job_description: text })
        })
      }
    } catch {
      // The file and the pasted text both survive: whatever went wrong, it was
      // not the recruiter's input.
      set({ pending: false, error: MESSAGES.NETWORK })
      return
    }

    let body = {}
    try { body = await res.json() } catch { /* handled by status below */ }

    if (!res.ok) {
      // The limit only ever goes one way in a visit. A later failure of some
      // other kind must not clear it and offer an evaluation that cannot run.
      // The count itself is never guessed here: only the evaluate route's own
      // `remaining` ever sets it, and a failed call reports none.
      setState(prev => ({
        ...prev,
        pending: false,
        error: MESSAGES[body?.code] || body?.error || 'Something went wrong. Try again.',
        limitReached: prev.limitReached || res.status === 429
      }))
      return
    }

    // Appended, never replacing, and the new one is the report that opens.
    // Its position is read from the list this render saw rather than assigned
    // inside the updater, which React is free to run more than once.
    const landed = briefs.length
    setState(prev => {
      const next = [...prev.briefs, body]
      return {
        ...prev,
        pending: false,
        error: null,
        briefs: next,
        index: next.length - 1,
        composing: false,
        file: null,
        pasted: '',
        remaining: typeof body.remaining === 'number' ? body.remaining : null,
        limitReached: body.remaining === 0
      }
    })
    onOpenBrief(landed)
  }, [slug, mode, file, pasted, pending, limitReached, briefs.length, set, setState, onOpenBrief])

  const ready = mode === 'upload' ? Boolean(file) : pasted.trim().length >= MIN_PASTE

  // The wait takes over the workspace. Showing a form underneath a twenty
  // second search invites a second submission of the same thing.
  if (pending) {
    return (
      <div className="hp-rt-tool" data-tool="role">
        <IntelligenceMap reducedMotion={reducedMotion} />
      </div>
    )
  }

  // The list is what a finished tool shows. The form comes back only when the
  // recruiter asks for it, and the list is still underneath it when they do.
  const showList = briefs.length > 0 && !composing

  return (
    <div className="hp-rt-tool" data-tool="role">
      {showList ? (
        <>
          <ul className="hp-rt-results" role="list">
            {briefs.map((brief, i) => (
              <li className="hp-rt-result" key={i}>
                <div className="hp-rt-result-text">
                  <p className="hp-rt-result-role">{brief.role_title || 'Job description'}</p>
                  {brief.company ? <p className="hp-rt-result-co">{brief.company}</p> : null}
                </div>

                <button
                  type="button"
                  className="hp-rt-open"
                  aria-label={`Open brief for ${brief.role_title || 'this job description'}`}
                  onClick={() => onOpenBrief(i)}
                >
                  Open brief
                </button>
              </li>
            ))}
          </ul>

          {/* One line about the collection, and one action for it. Neither
              belongs to any single brief above. */}
          <div className="hp-rt-results-foot">
            {/* The count is the server's, not a subtraction done here. When it
                did not send one, the sentence stops at what is known rather
                than inventing the half it is missing. */}
            <p className="hp-rt-results-count">
              {briefs.length} brief{briefs.length === 1 ? '' : 's'} created
              {limitReached
                ? ' · Daily brief limit reached'
                : typeof state.remaining === 'number'
                  ? ` · ${state.remaining} remaining today`
                  : ''}
            </p>

            {limitReached ? null : (
              <button
                type="button"
                className="hp-rt-again"
                onClick={() => set({ composing: true, file: null, pasted: '', error: null })}
              >
                Try another role
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Started another role and changed their mind: the finished work is
              one control away, not lost behind a submission. */}
          {briefs.length > 0 ? (
            <button
              type="button"
              className="hp-rt-backlist"
              onClick={() => set({ composing: false, error: null })}
            >
              <span className="hp-rt-collapse-arrow" aria-hidden="true">←</span>
              Back to briefs
            </button>
          ) : null}

          {/* One question first: which do you have? Then one input. */}
          <div className="hp-rt-modes" role="group" aria-label="How to provide the job description">
            <button
              type="button"
              className="hp-rt-mode"
              aria-pressed={mode === 'upload'}
              onClick={() => set({ mode: 'upload', error: null })}
            >
              Upload a file
            </button>
            <button
              type="button"
              className="hp-rt-mode"
              aria-pressed={mode === 'paste'}
              onClick={() => set({ mode: 'paste', error: null })}
            >
              Paste text
            </button>
          </div>

          {mode === 'upload' ? (
            <div
              className="hp-rt-drop"
              data-dragging={dragging ? 'true' : 'false'}
              onDragEnter={(e) => { e.preventDefault(); dragDepth.current += 1; setDragging(true) }}
              onDragOver={(e) => e.preventDefault()}
              onDragLeave={(e) => {
                e.preventDefault()
                dragDepth.current -= 1
                if (dragDepth.current <= 0) { dragDepth.current = 0; setDragging(false) }
              }}
              onDrop={onDrop}
            >
              <input
                ref={inputRef}
                type="file"
                className="hp-rt-file"
                accept={ACCEPT}
                onChange={(e) => { take(e.target.files?.[0]); e.target.value = '' }}
              />

              {file ? (
                <div className="hp-rt-chipfile">
                  <span className="hp-rt-chipfile-name">{file.name}</span>
                  <span className="hp-rt-chipfile-size">{Math.max(1, Math.round(file.size / 1024))} KB</span>
                  <button
                    type="button"
                    className="hp-rt-chipfile-x"
                    aria-label={`Remove ${file.name}`}
                    onClick={() => set({ file: null, error: null })}
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </div>
              ) : (
                <>
                  <h4 className="hp-rt-drop-title">Drop a job description here</h4>
                  <p className="hp-rt-drop-formats">{FORMATS}</p>
                  <button type="button" className="hp-rt-browse" onClick={() => inputRef.current?.click()}>
                    Choose a file
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="hp-rt-paste">
              <label className="hp-rt-sr" htmlFor="hp-rt-jd">Job description</label>
              {/* Deep enough to read a paragraph of the role back, and no
                  deeper: a field that fills the workspace pushes the button
                  that uses it off the bottom of the screen. The rest scrolls. */}
              <textarea
                id="hp-rt-jd"
                className="hp-rt-input"
                rows={5}
                maxLength={MAX_PASTE}
                placeholder="Paste the job description…"
                value={pasted}
                onChange={(e) => set({ pasted: e.target.value, error: null })}
              />
              <p className="hp-rt-hint">
                {pasted.trim().length < MIN_PASTE
                  ? `${MIN_PASTE - pasted.trim().length} more characters needed`
                  : `${pasted.trim().length.toLocaleString()} characters`}
              </p>
            </div>
          )}

          {error ? <p className="hp-rt-error" role="alert">{error}</p> : null}

          <div className="hp-rt-ask-foot" data-align="end">
            <button type="button" className="hp-rt-go" disabled={!ready || limitReached} onClick={submit}>
              Build the hiring brief
            </button>
          </div>

          {limitReached && briefs.length > 0 ? (
            <p className="hp-rt-limit">That&apos;s today&apos;s three briefs. The limit resets tomorrow.</p>
          ) : null}

          {typeof state.remaining === 'number' ? (
            <p className="hp-rt-remaining">
              {state.remaining} hiring brief{state.remaining === 1 ? '' : 's'} left today
            </p>
          ) : null}
        </>
      )}
    </div>
  )
}
