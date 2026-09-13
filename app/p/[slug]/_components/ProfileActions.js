'use client'

// ============================================================================
// Download Resume and Contact.
//
// Neither has a route. This is the behaviour they have always had on this
// page: disabled, with the reason on hover, rather than a control that fails
// on click or a backend improvised here. The title copy is the copy that was
// already in use.
//
// Rendered in the header and again at the foot of the Profile, which is why it
// is one component rather than two sets of buttons drifting apart.
// ============================================================================
export default function ProfileActions({ resume, isOwner }) {
  const downloadTitle = isOwner
    ? 'Public resume download is not wired up yet'
    : resume
    ? 'Resume download is coming soon'
    : 'No resume published yet'

  return (
    <>
      <button
        type="button"
        className="hp-action hp-action-primary"
        disabled
        title={downloadTitle}
      >
        Download resume
      </button>

      <button
        type="button"
        className="hp-action"
        disabled
        title="Contact is not wired up yet"
      >
        Contact
      </button>
    </>
  )
}
