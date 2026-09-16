'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// ============================================================================
// THE ROLE ALIGNMENT BRIEF
//
// The evaluation, opened over the profile. Same dialog discipline the evidence
// overlay uses, and for the same reasons: portalled onto the body so the page's
// refocus layer cannot stack the sticky direction bar on top of it, focus moved
// in and trapped, Escape and backdrop to leave, the page behind held still, and
// focus returned to whatever opened it.
//
// WHAT THIS REPORT IS NOT
// There is no score, no percentage, no gauge, no stars, no traffic light. A
// number invites a cutoff, and a cutoff applied to somebody's career by a
// document they never saw is not what this is for.
//
// And gaps are not failures. They are the things this person's record does not
// happen to demonstrate - which may mean they have never done it, or may only
// mean they never wrote it down. Nothing here is red, and nothing here is
// phrased as a deficiency.
// ============================================================================

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input', 'select', 'textarea',
  '[tabindex]:not([tabindex="-1"])'
].join(',')

// Which citation kinds have somewhere on this page to go. Career knowledge and
// a direction's own copy are grounding rather than destinations - there is no
// public section that shows them - so those get no link rather than a broken
// promise of one.
const DESTINATIONS = {
  experience: { selector: '.hp-section-exp', label: 'Experience' },
  testimonial: { selector: '.hp-impact', label: 'What others see' },
  evidence: { selector: '.hp-ev-section', label: 'Evidence' },
  profile: { selector: '.hp-about-section', label: 'About' }
}

function Citations({ items, onVisit }) {
  const [open, setOpen] = useState(() => new Set())
  if (!items?.length) return null

  return (
    <ul className="hp-rt-cites">
      {items.map(c => {
        const where = DESTINATIONS[c.kind]
        const isOpen = open.has(c.id)
        return (
          <li className="hp-rt-cite" key={c.id} data-kind={c.kind}>
            <div className="hp-rt-cite-head">
              <span className="hp-rt-cite-kind">{c.kind}</span>
              <span className="hp-rt-cite-label">{c.label}</span>
            </div>

            {isOpen && c.snippet ? <p className="hp-rt-cite-snippet">{c.snippet}</p> : null}

            <div className="hp-rt-cite-actions">
              {c.snippet ? (
                <button
                  type="button"
                  className="hp-rt-cite-more"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(prev => {
                    const next = new Set(prev)
                    if (next.has(c.id)) next.delete(c.id); else next.add(c.id)
                    return next
                  })}
                >
                  {isOpen ? 'Hide source' : 'Show source'}
                </button>
              ) : null}

              {where ? (
                <button type="button" className="hp-rt-cite-visit" onClick={() => onVisit(where.selector)}>
                  View in profile
                </button>
              ) : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export default function RoleBriefOverlay({
  open,
  evaluation,
  candidateName,
  onClose,
  onDownload,
  downloading,
  downloadError
}) {
  const surfaceRef = useRef(null)
  const closeRef = useRef(null)
  const returnTo = useRef(null)

  useEffect(() => {
    if (!open) return
    returnTo.current = document.activeElement
    const timer = window.setTimeout(() => closeRef.current?.focus(), 20)
    return () => {
      window.clearTimeout(timer)
      const back = returnTo.current
      returnTo.current = null
      if (back && document.contains(back) && typeof back.focus === 'function') back.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const { body, documentElement } = document
    const gap = window.innerWidth - documentElement.clientWidth
    const overflow = body.style.overflow
    const padding = body.style.paddingRight
    body.style.overflow = 'hidden'
    if (gap > 0) body.style.paddingRight = `${gap}px`
    return () => {
      body.style.overflow = overflow
      body.style.paddingRight = padding
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (event) => {
      if (event.key === 'Escape') { event.stopPropagation(); onClose(); return }
      if (event.key !== 'Tab') return
      const surface = surfaceRef.current
      if (!surface) return
      const stops = [...surface.querySelectorAll(FOCUSABLE)]
        .filter(el => el.offsetParent !== null || el === closeRef.current)
      if (!stops.length) return
      const first = stops[0]
      const last = stops[stops.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open, onClose])

  const onBackdrop = useCallback((event) => {
    if (event.target === event.currentTarget) onClose()
  }, [onClose])

  // Closing first, then scrolling: the section being pointed at is behind this
  // surface, and the page cannot move while the scroll lock is on anyway.
  const visit = useCallback((selector) => {
    onClose()
    window.setTimeout(() => {
      document.querySelector(selector)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 120)
  }, [onClose])

  if (!open || !evaluation) return null

  const {
    role_title: roleTitle,
    company,
    match_summary: summary,
    strengths = [],
    gaps = [],
    relevant_experience: experience = [],
    relevant_testimonials: testimonials = []
  } = evaluation

  // "Candidate for X at Y", not "X at Y". The second reads as the job this
  // person already holds, which is the opposite of what the brief is about.
  // Either half may be missing: the evaluation returns null rather than
  // guessing, and a candidate with no named role simply gets their name.
  const roleLine = roleTitle
    ? (company ? `Candidate for ${roleTitle} at ${company}` : `Candidate for ${roleTitle}`)
    : null
  const titleId = 'hp-rt-brief-title'

  // Every source named anywhere in the report, gathered once for the closing
  // section so a reader can see the whole basis in one place.
  const allCites = new Map()
  for (const s of strengths) for (const c of (s.citations || [])) if (!allCites.has(c.id)) allCites.set(c.id, c)

  return createPortal(
    <div className="hp-rt-backdrop" onMouseDown={onBackdrop}>
      <div
        className="hp-rt-surface"
        ref={surfaceRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="hp-rt-brief-head">
          <div className="hp-rt-brief-heading">
            <span className="hp-rt-brief-eyebrow">Recruiter tools</span>
            <h2 className="hp-rt-brief-title" id={titleId}>Hiring Brief</h2>
            <p className="hp-rt-brief-name">{candidateName}</p>
            {roleLine ? <p className="hp-rt-brief-sub">{roleLine}</p> : null}
          </div>

          <div className="hp-rt-brief-actions">
            <button
              type="button"
              className="hp-rt-download"
              onClick={onDownload}
              disabled={downloading}
              aria-busy={downloading ? 'true' : undefined}
            >
              {downloading ? 'Preparing…' : 'Download PDF'}
            </button>
            <button type="button" className="hp-rt-close" ref={closeRef} aria-label="Close" onClick={onClose}>
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </header>

        {/* An error here never closes the report: the reader still has the
            thing they came for, and the download can simply be tried again. */}
        {downloadError ? (
          <p className="hp-rt-brief-error" role="status">{downloadError}</p>
        ) : null}

        <div className="hp-rt-brief-body">
          {summary ? (
            <section className="hp-rt-brief-section">
              <p className="hp-rt-summary">{summary}</p>
            </section>
          ) : null}

          {strengths.length > 0 ? (
            <section className="hp-rt-brief-section">
              <h3 className="hp-rt-brief-h">Where the background aligns</h3>
              {strengths.map((s, i) => (
                <article className="hp-rt-block" key={i}>
                  <h4 className="hp-rt-block-title">{s.area}</h4>
                  <p className="hp-rt-block-body">{s.evidence}</p>
                  <Citations items={s.citations} onVisit={visit} />
                </article>
              ))}
            </section>
          ) : null}

          {gaps.length > 0 ? (
            <section className="hp-rt-brief-section">
              <h3 className="hp-rt-brief-h">What the record doesn&apos;t show</h3>
              <p className="hp-rt-note">
                These are things this career record does not evidence. They are not marks against the candidate.
              </p>
              {gaps.map((g, i) => (
                <article className="hp-rt-block" data-tone="quiet" key={i}>
                  <h4 className="hp-rt-block-title">{g.area}</h4>
                  <p className="hp-rt-block-body">{g.note}</p>
                </article>
              ))}
            </section>
          ) : null}

          {experience.length > 0 ? (
            <section className="hp-rt-brief-section">
              <h3 className="hp-rt-brief-h">Most relevant experience</h3>
              {experience.map((r, i) => (
                <article className="hp-rt-block" key={i}>
                  <h4 className="hp-rt-block-title">{r.title}</h4>
                  <p className="hp-rt-block-meta">{[r.company, r.dates].filter(Boolean).join(' · ')}</p>
                  {r.why ? <p className="hp-rt-block-body">{r.why}</p> : null}
                  {(r.bullets || []).length > 0 ? (
                    <ul className="hp-rt-bullets">
                      {r.bullets.map((b, j) => <li key={j}>{b}</li>)}
                    </ul>
                  ) : null}
                </article>
              ))}
            </section>
          ) : null}

          {testimonials.length > 0 ? (
            <section className="hp-rt-brief-section">
              <h3 className="hp-rt-brief-h">Supporting voices</h3>
              {testimonials.map((t, i) => (
                <figure className="hp-rt-quote" key={i}>
                  <blockquote className="hp-rt-quote-text">{t.quote}</blockquote>
                  <figcaption className="hp-rt-quote-by">
                    {t.attribution}{t.why ? ` · ${t.why}` : ''}
                  </figcaption>
                </figure>
              ))}
            </section>
          ) : null}

          {allCites.size > 0 ? (
            <section className="hp-rt-brief-section">
              <h3 className="hp-rt-brief-h">Sources</h3>
              <Citations items={[...allCites.values()]} onVisit={visit} />
            </section>
          ) : null}

          <p className="hp-rt-brief-foot">
            Built from {candidateName}&apos;s full career record. Every statement above is drawn from
            material the candidate recorded themselves.
          </p>

          {/* Authorship and an invitation, at the size those deserve. It sits
              under the report rather than beside the download, so it is the
              last thing read and never the first. */}
          <footer className="hp-rt-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="hp-rt-brand-mark" src="/images/hire-power-logo-white-v2.png" alt="Hire Power" />
            <span className="hp-rt-brand-text">
              Take your career beyond the page.{' '}
              <a
                className="hp-rt-brand-link"
                href="https://HirePowerAI.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                Create your Career Profile at HirePowerAI.com
              </a>
            </span>
          </footer>
        </div>
      </div>
    </div>,
    document.body
  )
}
