'use client'

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
// Neither action has a backend yet. Both keep the disabled state and the
// explanation they have always carried; the hover, pressed and focus-visible
// states are written against `:not(:disabled)` so they are already correct the
// day the routes land.
//
// The generate button is the exception: it is the one working write this page
// has, it is owner-only, and it only appears for a direction that has not been
// written yet.
// ============================================================================

const DOWNLOAD_LABEL = 'Download résumé'
const CONTACT_LABEL = 'Contact'

function downloadTitleFor(resume, isOwner) {
  return isOwner
    ? 'Public resume download is not wired up yet'
    : resume
    ? 'Resume download is coming soon'
    : 'No resume published yet'
}

export function ProfileActionButtons({ resume, isOwner }) {
  return (
    <>
      <button
        type="button"
        className="hp-btn hp-btn-secondary"
        disabled
        aria-label={DOWNLOAD_LABEL}
        title={downloadTitleFor(resume, isOwner)}
      >
        {/* The accessible name is on the button, so the visible text can
            shorten in the sticky bar on a phone without the control losing
            what it is called. */}
        <span className="hp-btn-full">{DOWNLOAD_LABEL}</span>
        <span className="hp-btn-short" aria-hidden="true">Résumé</span>
      </button>

      <button
        type="button"
        className="hp-btn hp-btn-primary"
        disabled
        title="Contact is not wired up yet"
      >
        {CONTACT_LABEL}
      </button>
    </>
  )
}

export default function ProfileHeader({
  resume,
  isOwner,
  showGenerate,
  lensName,
  generating,
  generateError,
  onGenerate
}) {
  return (
    <div className="hp-header">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/hire-power-logo-white-v2.png" alt="Hire Power" className="hp-header-mark" />

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

        <ProfileActionButtons resume={resume} isOwner={isOwner} />
      </div>
    </div>
  )
}
