'use client'

import { useCallback, useMemo, useState } from 'react'

import Reveal from './Reveal'
import AskTheCareer from './AskTheCareer'
import AnswerPills from './AnswerPills'
import AnswerOverlay from './AnswerOverlay'
import RoleMeetCareer from './RoleMeetCareer'
import RoleBriefOverlay from './RoleBriefOverlay'

// ============================================================================
// RECRUITER TOOLS
//
// Where the page stops being something to read and becomes something to
// interrogate. Everything above this is the candidate's own composition; this
// is the reader's, and it is the one part of the page that answers back.
//
// NOT SCOPED TO A DIRECTION
// The chapters above reorganise one career for one kind of role. A recruiter's
// question rarely respects that boundary, so neither do these: both tools read
// the whole record, nothing here is keyed on the selected direction, and
// changing direction never re-runs or discards a result somebody is reading.
//
// ABSENT RATHER THAN LOCKED
// When the profile does not carry these tools, this renders nothing at all. No
// teaser, no lock, no badge, no mention of what tier anything is. A public page
// has no business telling a visitor what its owner did or did not buy, and a
// disabled control is an advertisement pointed at the wrong person.
//
// THREE SHAPES, ONE SET OF STATE
// Equal, one expanded, the other expanded. The tools themselves are mounted
// once and stay mounted through every one of those: a half-typed question, an
// attached file and a finished brief all survive expanding, switching and
// collapsing, because none of it is unmounted to change the layout.
//
// THE HISTORY LIVES HERE
// Both overlays are opened from this level rather than from inside a tool, so
// an answer can be reopened from the narrow card, or from the pair, without
// first expanding anything. A tool that is not on screen cannot hold the door
// open for its own result.
// ============================================================================

// The copy speaks about a person, so it needs their name rather than a label.
// A display name is whatever they typed - one word, three words, initials - so
// the first token is taken and anything unusable falls back to a phrase that
// still reads as English in every sentence below.
function nameParts(displayName) {
  const first = String(displayName || '').trim().split(/\s+/)[0] || ''
  // A single letter, a punctuation mark, or nothing at all is not a name worth
  // putting in a sentence.
  const usable = first.replace(/[^\p{L}\p{N}'-]/gu, '')
  if (usable.length < 2) return { first: 'the candidate', possessive: "the candidate's" }

  // A name already ending in s takes the bare apostrophe. "James' results"
  // rather than "James's results" - both are defensible, and this is the one
  // that reads as speech.
  return {
    first: usable,
    possessive: /s$/i.test(usable) ? `${usable}'` : `${usable}'s`
  }
}

// answers holds every completed question and its reply, oldest first, and
// index says which one the surface is showing. Session only, by design:
// nothing a recruiter asked is written down anywhere, and a refresh starts
// clean. An error never lands here - a question that failed was not answered.
const freshAsk = {
  question: '', pending: false, answers: [], index: 0, open: false,
  error: null, remaining: null, limitReached: false, focusAt: 0
}

// The same shape for briefs, plus composing: true while the recruiter is
// filling in another role, which is a state the finished list has to survive
// rather than be replaced by.
const freshRole = {
  mode: 'upload', file: null, pasted: '',
  pending: false, briefs: [], index: 0, composing: false,
  error: null, remaining: null, limitReached: false
}

export default function RecruiterTools({ enabled, slug, candidateName, animate, reducedMotion }) {
  const [openTool, setOpenTool] = useState(null)
  const [ask, setAsk] = useState(freshAsk)
  const [role, setRole] = useState(freshRole)
  const [briefOpen, setBriefOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState(null)

  const who = useMemo(() => nameParts(candidateName), [candidateName])

  const tools = useMemo(() => ([
    {
      id: 'ask',
      title: 'Career Q&A',
      blurb: `Ask about ${who.possessive} results, leadership, experience, or anything else.`,
      cta: 'Ask away'
    },
    {
      id: 'role',
      title: 'Hiring Brief',
      blurb: `Upload a job description to see where ${who.possessive} background aligns, and where it doesn't.`,
      cta: 'Evaluate the fit'
    }
  ]), [who])

  // One shape for both rows of numbers. A question is already a sentence; a
  // brief is a role and the company that posted it, which is the pair a
  // recruiter recognises it by.
  const askPills = useMemo(
    () => ask.answers.map(a => ({ label: a.question })),
    [ask.answers]
  )
  const briefPills = useMemo(
    () => role.briefs.map(b => ({
      label: [b.role_title || 'Job description', b.company].filter(Boolean).join(' at ')
    })),
    [role.briefs]
  )
  // Once either card has something to show, both hold the row.
  const anyHistory = askPills.length > 0 || briefPills.length > 0

  // Opening a specific brief, by position. The index travels with the request
  // so the report that opens is the row that was clicked, never whichever one
  // happened to be last.
  const openBrief = useCallback((index) => {
    setDownloadError(null)
    setRole(prev => ({ ...prev, index }))
    setBriefOpen(true)
  }, [])

  const openAnswer = useCallback((index) => {
    setAsk(prev => ({ ...prev, index, open: true }))
  }, [])

  // From the answer surface back to the form: the overlay closes, the tool
  // opens if it was not already, and the cursor lands in the box. Nothing is
  // sent, and nothing already answered is disturbed.
  const askAnother = useCallback(() => {
    setOpenTool('ask')
    setAsk(prev => ({ ...prev, open: false, focusAt: prev.focusAt + 1 }))
  }, [])

  // The PDF is built from the token the evaluation returned, which the server
  // signed. Nothing is re-run and nothing is re-counted: this is a different
  // rendering of an answer already given.
  const download = useCallback(async () => {
    const current = role.briefs[role.index]
    if (downloading || !current?.brief_token) return
    setDownloading(true)
    setDownloadError(null)

    try {
      const res = await fetch('/api/career-profile/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, brief_token: current.brief_token })
      })

      if (!res.ok) {
        let body = {}
        try { body = await res.json() } catch { /* status is enough */ }
        setDownloadError(
          body?.code === 'BAD_TOKEN'
            ? 'That brief has expired. Run the role again to rebuild it.'
            : body?.error || "The PDF couldn't be built. Try again."
        )
        return
      }

      // The server names the file. It knows the candidate, and it has already
      // made the name safe.
      const disposition = res.headers.get('content-disposition') || ''
      const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)
      const plain = disposition.match(/filename="([^"]+)"/i)
      const name = encoded ? decodeURIComponent(encoded[1]) : (plain ? plain[1] : 'Hiring-Brief.pdf')

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = name
      document.body.appendChild(a)
      a.click()
      a.remove()
      // Revoked on the next turn, so the download has started before the URL
      // it points at is taken away.
      window.setTimeout(() => URL.revokeObjectURL(url), 4000)
    } catch {
      setDownloadError("The PDF couldn't be downloaded. Check your connection and try again.")
    } finally {
      setDownloading(false)
    }
  }, [downloading, role.briefs, role.index, slug])

  if (!enabled) return null

  return (
    <section className="hp-section hp-rt-section">
      <div className="hp-wrap">
        <Reveal enabled={animate} className="hp-rt-intro">
          <span className="hp-label">Recruiter tools</span>
          <h2 className="hp-rt-headline">Dig deeper.</h2>
          <p className="hp-rt-sub">
            Go beyond the profile, or see how {who.first} lines up with a specific role.
          </p>
        </Reveal>

        <Reveal enabled={animate}>
          {/* One rail, three shapes. The columns carry the change: equal until a
              tool is chosen, then roughly four fifths to the one in use and the
              rest to the one waiting. Nothing is added or removed to get there,
              which is what keeps the movement continuous and the state intact. */}
          <div className="hp-rt-field">
            <div className="hp-rt-rail" data-expanded={openTool || 'none'}>
            {tools.map(tool => {
              const state = !openTool ? 'equal' : openTool === tool.id ? 'expanded' : 'narrow'
              const isOpen = state === 'expanded'

              return (
                <section className="hp-rt-cell" data-state={state} data-tool={tool.id} key={tool.id}>
                  {isOpen ? (
                    <header className="hp-rt-head">
                      <div className="hp-rt-head-text">
                        <h3 className="hp-rt-cell-title">{tool.title}</h3>
                        <p className="hp-rt-cell-blurb">{tool.blurb}</p>
                      </div>
                      {/* Back to the pair, not back to nothing: the way out of a
                          tool is the view the reader started from. */}
                      <button type="button" className="hp-rt-collapse" onClick={() => setOpenTool(null)}>
                        <span className="hp-rt-collapse-arrow" aria-hidden="true">←</span>
                        Back to tools
                      </button>
                    </header>
                  ) : (
                    <button
                      type="button"
                      className="hp-rt-face"
                      aria-expanded={false}
                      onClick={() => setOpenTool(tool.id)}
                    >
                      <span className="hp-rt-cell-mark" aria-hidden="true" data-tool={tool.id} />
                      <span className="hp-rt-cell-title">{tool.title}</span>
                      <span className="hp-rt-cell-blurb">{tool.blurb}</span>
                      <span className="hp-rt-cell-cta" aria-hidden="true">{tool.cta}</span>
                    </button>
                  )}

                  {/* The history, on the card itself. A sibling of the face
                      rather than a child of it, because a button inside a
                      button is not a thing, and because these open a result
                      instead of opening the tool.

                      Both cards carry the row, and the one with nothing in it
                      yet keeps its height, so the two calls to action stay on
                      the same line whichever tool has been used. */}
                  {!isOpen ? (
                    <AnswerPills
                      items={tool.id === 'ask' ? askPills : briefPills}
                      index={tool.id === 'ask' ? ask.index : role.index}
                      onSelect={tool.id === 'ask' ? openAnswer : openBrief}
                      noun={tool.id === 'ask' ? 'Answer' : 'Brief'}
                      label={tool.id === 'ask' ? 'Answers' : 'Briefs'}
                      variant="card"
                      reserve={anyHistory}
                    />
                  ) : null}

                  {/* Mounted from the first opening onward and never unmounted
                      again, so switching tools or collapsing to the pair costs
                      nobody their typing, their file, or their finished brief.
                      The one not in use is out of the layout and out of the tab
                      order rather than destroyed. */}
                  {openTool ? (
                    <div className="hp-rt-body" data-show={isOpen} inert={!isOpen}>
                      {tool.id === 'ask' ? (
                        <AskTheCareer
                          slug={slug}
                          state={ask}
                          setState={setAsk}
                          pills={askPills}
                          onSelectAnswer={openAnswer}
                          onAskAnother={askAnother}
                        />
                      ) : (
                        <RoleMeetCareer
                          slug={slug}
                          state={role}
                          setState={setRole}
                          reducedMotion={reducedMotion}
                          onOpenBrief={openBrief}
                        />
                      )}
                    </div>
                  ) : null}
                </section>
              )
            })}
            </div>
          </div>
        </Reveal>
      </div>

      <AnswerOverlay
        open={Boolean(ask.open && ask.answers[ask.index])}
        entry={ask.answers[ask.index] || null}
        pills={askPills}
        index={ask.index}
        remaining={ask.remaining}
        limitReached={ask.limitReached}
        onSelect={openAnswer}
        onAskAnother={askAnother}
        onClose={() => setAsk(prev => ({ ...prev, open: false }))}
      />

      <RoleBriefOverlay
        open={briefOpen}
        evaluation={role.briefs[role.index] || null}
        candidateName={candidateName}
        onClose={() => setBriefOpen(false)}
        onDownload={download}
        downloading={downloading}
        downloadError={downloadError}
      />
    </section>
  )
}
