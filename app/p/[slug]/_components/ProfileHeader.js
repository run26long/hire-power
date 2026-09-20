'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import ProfileMark from './ProfileMark'

// ============================================================================
// The masthead, and the pair of actions it owns.
//
// `ProfileActionButtons` is exported so the sticky direction control can render
// the same two controls rather than restating their copy, their titles or their
// disabled state. One definition, two placements: the header's and the bar's
// can never drift apart, and there is no second copy of the behaviour anywhere.
//
// Contact is the primary conversion action and carries the filled treatment;
// Download résumé is a real secondary button beside it, quieter but
// unmistakably a control.
//
// Both actions are live now. Download builds the PDF on the server from the
// direction being read; Contact is a mailto: to the address the owner set.
//
// Download carries a menu when, and only when, the profile's directions
// actually resolve to more than one file - see offersRealChoice below. Picking
// one downloads it and nothing else: the page stays on the direction the reader
// was reading, because choosing a file to take away is not the same gesture as
// changing what you are looking at.
//
// Contact does not render at all when no address is set. A disabled button
// would tell a recruiter that there is a way to reach this person and that it
// is closed, which is worse than the page simply not offering one - the same
// rule the recruiter tools follow when a profile does not carry them.
//
// The generate button is the exception: it is owner-only, and it only appears
// for a direction that has not been written yet.
// ============================================================================

const DOWNLOAD_LABEL = 'Download résumé'
const CONTACT_LABEL = 'Contact'

function downloadTitleFor(resume, downloading, offersChoice) {
  if (downloading) return 'Building the PDF'
  if (!resume) return 'No resume published yet'
  return offersChoice ? 'Choose which résumé to download' : 'Download this résumé as a PDF'
}

// ---------------------------------------------------------------------------
// WHETHER THE CHOICE IS WORTH OFFERING
//
// A direction downloads its own résumé only when it has built one. Every
// direction that has not falls back to the same priority core, which the
// download route resolves on its side - so a profile can show five directions
// and hand over one file for all of them.
//
// A menu there would be a menu of one answer wearing five names. The reader
// would pick "Executive Leadership", get the same PDF they would have got
// anyway, and have no way to know that was the whole truth. So the menu appears
// only when the choice actually changes what arrives: more than one direction,
// AND more than one file behind them. One direction, or one file, and the
// button stays the plain button it has always been.
//
// WHAT COUNTS AS A DIFFERENT FILE
// Not whether the column is filled in. Counting a null as its own answer made
// a profile with one core show a menu of three the moment one direction was
// pointed at that very core: two nulls and an id read as two files when they
// were one. So each direction is resolved the way the download route resolves
// it - its own core when it has one the server can still serve, the priority
// core otherwise - and the menu appears only if those resolutions differ.
//
// A direction pointing at a resume that is gone, deactivated or somebody
// else's is not in lensResumes, which is exactly the case the route falls back
// on, so it resolves here to the same core the route would send.
// ---------------------------------------------------------------------------
function resolveResumeId(lens, lensResumes, coreResumeId) {
  const own = lens?.core_resume_id
  if (own && lensResumes && lensResumes[own]) return own
  return coreResumeId || 'CORE'
}

function offersRealChoice(lenses, lensResumes, coreResumeId) {
  if (!Array.isArray(lenses) || lenses.length < 2) return false
  const targets = new Set(lenses.map(lens => resolveResumeId(lens, lensResumes, coreResumeId)))
  return targets.size > 1
}

export function ProfileActionButtons({
  resume,
  contactEmail,
  downloading,
  downloadError,
  onDownload,
  lenses,
  // What each direction would actually hand over: the resumes the server was
  // able to resolve, and the core everything else falls back to.
  lensResumes,
  coreResumeId,
  selectedLensId
}) {
  const directions = useMemo(() => (Array.isArray(lenses) ? lenses : []), [lenses])
  const offersChoice = useMemo(
    () => offersRealChoice(directions, lensResumes, coreResumeId),
    [directions, lensResumes, coreResumeId]
  )

  const [menuOpen, setMenuOpen] = useState(false)
  // Held per instance, deliberately. This component is built once by the page
  // and rendered in three places, so three copies of it exist; opening the
  // masthead's menu must not open the footer's. The busy state and the error
  // are the opposite case and stay lifted, so all three agree about them.
  const wrapRef = useRef(null)
  const triggerRef = useRef(null)
  const itemRefs = useRef([])

  const closeMenu = useCallback((returnFocus) => {
    setMenuOpen(false)
    if (returnFocus) triggerRef.current?.focus()
  }, [])

  // A menu that cannot be dismissed by the two gestures everyone already knows
  // is a trap, so both are wired: anywhere outside closes it, Escape closes it
  // and puts focus back where it started.
  useEffect(() => {
    if (!menuOpen) return undefined

    function onPointerDown(event) {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setMenuOpen(false)
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        closeMenu(true)
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen, closeMenu])

  // Opening lands on the direction being read, which is the one already marked
  // as chosen. A keyboard reader who opens and presses Enter gets exactly what
  // the button would have given them unaided.
  useEffect(() => {
    if (!menuOpen) return
    const current = directions.findIndex(lens => lens.id === selectedLensId)
    itemRefs.current[current > -1 ? current : 0]?.focus()
  }, [menuOpen, directions, selectedLensId])

  function choose(lensId) {
    setMenuOpen(false)
    triggerRef.current?.focus()
    onDownload(lensId)
  }

  function onItemKeyDown(event, index) {
    const last = directions.length - 1
    let next = null
    if (event.key === 'ArrowDown') next = index === last ? 0 : index + 1
    else if (event.key === 'ArrowUp') next = index === 0 ? last : index - 1
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = last
    if (next === null) return
    event.preventDefault()
    itemRefs.current[next]?.focus()
  }

  // Sent only when the reader picked one. Without a choice the page's own
  // selection decides, which is what this button has always done.
  const downloadCurrent = () => onDownload(null)

  return (
    <>
      {/* The positioned ancestor the menu hangs off. inline-flex so it takes
          exactly the button's box and the flex rows it sits in are unchanged. */}
      <span className="hp-dl" ref={wrapRef}>
        <button
          type="button"
          ref={triggerRef}
          className="hp-btn hp-btn-secondary"
          disabled={!resume || downloading}
          aria-label={DOWNLOAD_LABEL}
          aria-busy={downloading ? 'true' : undefined}
          aria-haspopup={offersChoice ? 'menu' : undefined}
          aria-expanded={offersChoice ? (menuOpen ? 'true' : 'false') : undefined}
          title={downloadTitleFor(resume, downloading, offersChoice)}
          onClick={offersChoice ? () => setMenuOpen(open => !open) : downloadCurrent}
        >
          {/* The accessible name is on the button, so the visible text can
              shorten in the sticky bar on a phone without the control losing
              what it is called. */}
          <span className="hp-btn-full">{downloading ? 'Building…' : DOWNLOAD_LABEL}</span>
          <span className="hp-btn-short" aria-hidden="true">
            {downloading ? '…' : 'Résumé'}
          </span>
          {offersChoice && !downloading ? (
            <span className="hp-dl-caret" aria-hidden="true" />
          ) : null}
        </button>

        {offersChoice && menuOpen ? (
          <div className="hp-dl-menu" role="menu" aria-label="Choose a résumé to download">
            {directions.map((lens, index) => {
              const current = lens.id === selectedLensId
              return (
                <button
                  key={lens.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={current ? 'true' : 'false'}
                  data-current={current ? 'true' : 'false'}
                  className="hp-dl-item"
                  ref={node => { itemRefs.current[index] = node }}
                  onClick={() => choose(lens.id)}
                  onKeyDown={event => onItemKeyDown(event, index)}
                >
                  {lens.name}
                </button>
              )
            })}
          </div>
        ) : null}
      </span>

      {/* An anchor rather than a button, because it goes somewhere: it should
          be openable in the way every other link is, and a mail client is a
          destination even though it is not a page. */}
      {/* encodeURI, not encodeURIComponent: the component form percent-encodes
          the @, and a mailto whose separator is %40 is mishandled by enough
          mail clients to matter. This escapes what is genuinely unsafe in a URL
          and leaves the address's own punctuation alone. The stored value has
          already been checked for shape and refused any whitespace. */}
      {contactEmail ? (
        <a className="hp-btn hp-btn-primary" href={`mailto:${encodeURI(contactEmail)}`}>
          {CONTACT_LABEL}
        </a>
      ) : null}

      {downloadError ? (
        <span className="hp-btn-error" role="alert">{downloadError}</span>
      ) : null}
    </>
  )
}

export default function ProfileHeader({
  actions,
  showGenerate,
  lensName,
  generating,
  generateError,
  onGenerate
}) {
  return (
    <div className="hp-header">
      { }
      <ProfileMark className="hp-header-mark" />

      <div className="hp-header-actions">
        {generateError && <span className="hp-owner-note" role="alert">{generateError}</span>}

        {showGenerate && (
          <button
            type="button"
            className="hp-owner-action"
            onClick={onGenerate}
            disabled={generating}
          >
            {generating ? 'Generating' : `Write ${lensName}`}
          </button>
        )}

        {/* Built once by the page and handed to all three placements, so the
            masthead, the sticky bar and the footer share one busy state and
            one error rather than three copies that can disagree. */}
        {actions}
      </div>
    </div>
  )
}
