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
// Download carries a menu when, and only when, more than one direction has a
// résumé of its own - see hasOwnResume below. Picking one downloads it and
// nothing else: the page stays on the direction the reader was reading,
// because choosing a file to take away is not the same gesture as changing
// what you are looking at.
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
// WHICH DIRECTIONS THE MENU MAY LIST
//
// Only the ones with a résumé of their own. A direction that has never had a
// core built for it falls back to the priority core, which the download route
// resolves on its side - so listing it offers the reader a name that hands
// over somebody else's file.
//
// That is what this used to do. The rule was "show the menu when the
// directions resolve to more than one file", which is true of a profile with
// three directions where two have cores: the two cores and the fallback are
// three different resolutions, so the menu opened - and listed all three,
// including the one whose entry was the fallback wearing its name. A reader
// picking "Executive Leadership" got the priority core with no way to know.
//
// So the question is no longer how many files the set resolves to. It is
// which directions actually have one, and only those are listed. Fewer than
// two and there is nothing to choose between, so the control stays the plain
// button it has always been and downloads whatever the direction on screen
// resolves to - unchanged, and still the right answer for a reader who never
// opened a menu.
//
// A direction pointing at a résumé that is gone, deactivated or somebody
// else's is not in lensResumes. The route falls back to the priority core for
// exactly that case, so it is not its own answer here either.
// ---------------------------------------------------------------------------
function hasOwnResume(lens, lensResumes) {
  const own = lens?.core_resume_id
  return Boolean(own && lensResumes && lensResumes[own])
}

export function ProfileActionButtons({
  resume,
  contactEmail,
  downloading,
  downloadError,
  onDownload,
  lenses,
  // The résumés the server was able to resolve, keyed by id. A direction's
  // own core counts only if it is in here.
  lensResumes,
  selectedLensId
}) {
  // Only the directions with a résumé of their own; see the note above. The
  // menu is built from this rather than from every direction on the profile.
  const directions = useMemo(
    () => (Array.isArray(lenses) ? lenses : []).filter(lens => hasOwnResume(lens, lensResumes)),
    [lenses, lensResumes]
  )
  const offersChoice = directions.length > 1

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
