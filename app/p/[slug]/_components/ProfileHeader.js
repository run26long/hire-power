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
// Both actions are live now. Download builds the PDF on the server from the
// direction being read; Contact is a mailto: to the address the owner set.
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

function downloadTitleFor(resume, downloading) {
  if (downloading) return 'Building the PDF'
  return resume ? 'Download this résumé as a PDF' : 'No resume published yet'
}

export function ProfileActionButtons({
  resume,
  contactEmail,
  downloading,
  downloadError,
  onDownload
}) {
  return (
    <>
      <button
        type="button"
        className="hp-btn hp-btn-secondary"
        disabled={!resume || downloading}
        aria-label={DOWNLOAD_LABEL}
        aria-busy={downloading ? 'true' : undefined}
        title={downloadTitleFor(resume, downloading)}
        onClick={onDownload}
      >
        {/* The accessible name is on the button, so the visible text can
            shorten in the sticky bar on a phone without the control losing
            what it is called. */}
        <span className="hp-btn-full">{downloading ? 'Building…' : DOWNLOAD_LABEL}</span>
        <span className="hp-btn-short" aria-hidden="true">
          {downloading ? '…' : 'Résumé'}
        </span>
      </button>

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

        {/* Built once by the page and handed to all three placements, so the
            masthead, the sticky bar and the footer share one busy state and
            one error rather than three copies that can disagree. */}
        {actions}
      </div>
    </div>
  )
}
