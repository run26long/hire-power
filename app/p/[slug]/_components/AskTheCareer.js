'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import AnswerPills from './AnswerPills'

// ============================================================================
// CAREER Q&A
//
// A recruiter's question, answered from the whole career record.
//
// The whole record, deliberately. The chapters above this section reorganise
// one career for one kind of role; the question a recruiter arrives with is
// rarely about the chapter they happen to be looking at. So nothing here is
// scoped to the selected direction, and changing direction does not re-run or
// discard anything.
//
// The answer opens on its own surface rather than unrolling under the form.
// An answer printed below the box it was typed in turns the workspace into a
// transcript; lifted onto a surface of its own it reads as a reply, and the
// form underneath stays where it was for the next question.
//
// Every answer is kept, up to the day's five, and the row of numbers at the
// bottom is how you get back to any of them. Getting back costs nothing: the
// answers are already here, and reopening one sends no request and spends no
// question.
//
// The one outcome this interface must not make look like a failure is the
// honest one. "I don't have information about that" is the correct answer to a
// question the record does not cover, and it is presented as an answer rather
// than as an error, because a tool that made refusing look broken would be a
// tool that taught its own model to reach. It is a completed answer, and it is
// kept in the history like any other.
// ============================================================================

const SUGGESTIONS = [
  'What experience demonstrates operational leadership?',
  'Has this candidate managed enterprise accounts?',
  'What do former colleagues say about the leadership style?'
]

const MAX_QUESTION = 500

// The route answers with a code; the copy belongs here, where the reader is.
const MESSAGES = {
  BAD_QUESTION: 'Ask a question of at least a few words.',
  RATE_LIMITED: "That's today's questions for this profile. The limit resets tomorrow.",
  INCOMPLETE: 'That answer came back incomplete. Try asking again.',
  UNAVAILABLE: 'This is briefly unavailable. Try again in a moment.',
  TIER_REQUIRED: 'This tool is not available on this profile.',
  NOT_FOUND: 'This profile could not be found.',
  NETWORK: "That didn't reach us. Check your connection and try again."
}

export default function AskTheCareer({ slug, state, setState, pills, onSelectAnswer, onAskAnother }) {
  const { question, pending, answers, index, open, error, limitReached, focusAt } = state
  const inputRef = useRef(null)
  const [announce, setAnnounce] = useState('')

  const set = useCallback((patch) => setState(prev => ({ ...prev, ...patch })), [setState])

  // "Ask another question" is decided on the answer surface and lands here.
  // A counter rather than a flag: two requests in a row are two focus moves,
  // and a flag would have to be cleared by the thing it just triggered.
  useEffect(() => {
    if (!focusAt) return
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30)
    return () => window.clearTimeout(timer)
  }, [focusAt])

  const submit = useCallback(async (event) => {
    event?.preventDefault()
    const text = question.trim()
    if (pending || limitReached || text.length < 5) return

    set({ pending: true, error: null })
    setAnnounce('Searching the career record')

    let res
    try {
      res = await fetch('/api/career-profile/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, question: text })
      })
    } catch {
      // The question is kept: retyping it is the last thing anybody wants to
      // do after a failed request.
      set({ pending: false, error: MESSAGES.NETWORK })
      setAnnounce('')
      return
    }

    let body = {}
    try { body = await res.json() } catch { /* handled by status below */ }

    if (!res.ok) {
      // Nothing is added to the history. A question that failed was not
      // answered, and a numbered pill that opened an error would be a lie
      // about what happened.
      // The limit only ever goes one way in a visit. A later failure of some
      // other kind must not clear it and offer a box that is closed.
      setState(prev => ({
        ...prev,
        pending: false,
        error: MESSAGES[body?.code] || body?.error || 'Something went wrong. Try again.',
        limitReached: prev.limitReached || res.status === 429,
        remaining: typeof body?.remaining === 'number' ? body.remaining : prev.remaining
      }))
      setAnnounce('')
      return
    }

    // Appended, never replacing, and the newest is the one that opens.
    setState(prev => {
      const next = [...prev.answers, { question: text, result: body }]
      return {
        ...prev,
        pending: false,
        error: null,
        answers: next,
        index: next.length - 1,
        open: true,
        question: '',
        remaining: typeof body.remaining === 'number' ? body.remaining : null,
        limitReached: body.remaining === 0
      }
    })
    setAnnounce(body.answered ? 'Answer ready' : 'No information found for that question')
  }, [slug, question, pending, limitReached, set, setState])

  const applySuggestion = (text) => {
    set({ question: text })
    // Populated for editing, never submitted for them: the recruiter's question
    // is theirs to finish.
    inputRef.current?.focus()
  }

  const tooShort = question.trim().length > 0 && question.trim().length < 5

  return (
    <div className="hp-rt-tool" data-tool="ask">
      <form className="hp-rt-ask-form" onSubmit={submit}>
        {/* The visible description is in the panel header. This stays a real
            label because the textarea needs one, and is read rather than seen. */}
        <label className="hp-rt-sr" htmlFor="hp-rt-question">
          Your question about this candidate
        </label>

        <textarea
          id="hp-rt-question"
          ref={inputRef}
          className="hp-rt-input"
          rows={3}
          maxLength={MAX_QUESTION}
          placeholder="What would you like to know about this candidate?"
          value={question}
          disabled={limitReached}
          onChange={(e) => set({ question: e.target.value })}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter makes a new line. A question long enough
            // to need paragraphs is not the shape this expects.
            if (e.key === 'Enter' && !e.shiftKey) submit(e)
          }}
        />

        <div className="hp-rt-ask-foot">
          <div className="hp-rt-chips">
            {SUGGESTIONS.map(text => (
              <button
                type="button"
                className="hp-rt-chip"
                key={text}
                disabled={limitReached}
                onClick={() => applySuggestion(text)}
              >
                {text}
              </button>
            ))}
          </div>

          <button
            type="submit"
            className="hp-rt-go"
            disabled={pending || limitReached || question.trim().length < 5}
            aria-busy={pending ? 'true' : undefined}
          >
            {pending ? 'Searching…' : 'Ask away'}
          </button>
        </div>

        {tooShort ? <p className="hp-rt-hint">A few more words and it can search properly.</p> : null}
      </form>

      <p className="hp-rt-sr" role="status" aria-live="polite">{announce}</p>

      {error ? <p className="hp-rt-error" role="alert">{error}</p> : null}

      {/* A restrained wait. It says the tool is working and claims nothing
          about how far along it is, because there is no progress to report. */}
      {pending ? (
        <div className="hp-rt-thinking" aria-hidden="true">
          <span className="hp-rt-thinking-line" />
          <span className="hp-rt-thinking-line" />
          <span className="hp-rt-thinking-line" />
        </div>
      ) : null}

      {/* Everything asked so far on the left, the way to ask again on the
          right, and both on screen at once. The same row the answer surface
          carries, so leaving the overlay does not mean losing the controls
          that were on it. */}
      {answers.length > 0 && !pending ? (
        <div className="hp-rt-history">
          <AnswerPills
            items={pills}
            index={index}
            onSelect={onSelectAnswer}
            variant="tool"
          />

          <div className="hp-rt-history-end">
            {typeof state.remaining === 'number' ? (
              <span className="hp-rt-remaining">
                {state.remaining} question{state.remaining === 1 ? '' : 's'} left today
              </span>
            ) : null}

            {/* Not offered once the day is spent: the box it would put the
                cursor in is closed until tomorrow. */}
            {limitReached ? null : (
              <button type="button" className="hp-rt-again" onClick={onAskAnother}>
                Ask another question
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
