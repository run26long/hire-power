'use client'

import StrokeIcon, { ICON_PLUS } from './StrokeIcon'
import { bulletsFor, dateRangeFor } from '../_lib/profileData'

// ============================================================================
// One role, as one full-width panel.
//
// `bulletsFor` returns the stored summary followed by the stored detail. The
// summary is the line that says what the role was, so it stays in the header
// whether the panel is open or shut, and only what follows it is revealed.
// Opening therefore adds the evidence rather than swapping the summary out for
// a list that begins with the same sentence.
//
// A role whose stored content is a summary and nothing else has no evidence to
// reveal, so its button is disabled and carries no expanded state to announce.
//
// The header is a twelve column field on desktop: identity, then the summary
// across the middle, then the control at the far edge. The whole header is the
// button, so the target is the panel rather than the circle, and the circle is
// a mark rather than a second control.
//
// Nothing is composed here. There is no achievement-title field in the stored
// data, so the title is the real role title rather than a promoted bullet.
// ============================================================================

// Below this the two column detail grid would leave one column nearly empty,
// so the list stays as one column and reads as a list rather than a layout.
const TWO_COLUMN_FROM = 4

export default function ExperienceStory({ job, index, isOpen, onToggle }) {
  const points = bulletsFor(job)
  const summary = points[0] || ''
  const detail = points.slice(1)

  const title = job?.title || 'Role'
  const company = job?.company || ''
  const dates = dateRangeFor(job)

  const canOpen = detail.length > 0
  const bodyId = `hp-role-${index}`

  return (
    <article className="hp-role" data-open={isOpen ? 'true' : 'false'}>
      <button
        type="button"
        className="hp-role-head"
        data-open={isOpen ? 'true' : 'false'}
        aria-expanded={canOpen ? isOpen : undefined}
        aria-controls={canOpen ? bodyId : undefined}
        disabled={!canOpen}
        onClick={() => onToggle(index)}
      >
        <span className="hp-role-identity">
          <span className="hp-role-title">{title}</span>

          {(company || dates) && (
            <span className="hp-role-meta">
              {company && <span className="hp-role-company">{company}</span>}
              {company && dates && <span className="hp-role-sep" aria-hidden="true">·</span>}
              {dates && <span className="hp-role-dates">{dates}</span>}
            </span>
          )}
        </span>

        {summary && <span className="hp-role-context">{summary}</span>}

        {canOpen && (
          <span className="hp-role-toggle" aria-hidden="true">
            <StrokeIcon paths={ICON_PLUS} size={16} />
          </span>
        )}
      </button>

      {isOpen && canOpen && (
        <div className="hp-role-body" id={bodyId}>
          <ul
            className="hp-role-list"
            data-columns={detail.length >= TWO_COLUMN_FROM ? '2' : '1'}
          >
            {detail.map((point, pointIndex) => (
              <li key={pointIndex}>{point}</li>
            ))}
          </ul>
        </div>
      )}
    </article>
  )
}
