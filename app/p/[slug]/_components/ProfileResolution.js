'use client'

import Reveal from './Reveal'
import ProfileActions from './ProfileActions'

// ============================================================================
// The resolution.
//
// Practical information only: what this person is open to, where they are, and
// the two actions. There is no narrative line here. `ready_for_next` is
// deliberately not rendered anywhere on the Profile.
//
// Location appears only when the resume actually carries one, and there is no
// remote-preference field in the data, so there is no remote line. The actions
// are the same component the header uses, so the two can never drift.
// ============================================================================
export default function ProfileResolution({ readyTags, location, resume, isOwner, animate }) {
  const hasTags = readyTags.length > 0
  const hasLocation = Boolean(location)

  return (
    <section className="hp-resolve">
      <div className="hp-wrap-tight">
        <Reveal enabled={animate}>
          <div className="hp-resolve-inner">
            <div className="hp-facts">
              {hasTags && (
                <div>
                  <span className="hp-fact-label">Open to</span>
                  <div className="hp-open">
                    {readyTags.map((tag, index) => (
                      <span className="hp-open-tag" key={`${tag}-${index}`}>{tag}</span>
                    ))}
                  </div>
                </div>
              )}

              {hasLocation && (
                <div>
                  <span className="hp-fact-label">Based in</span>
                  <span className="hp-fact-value">{location}</span>
                </div>
              )}
            </div>

            <div className="hp-resolve-actions">
              <ProfileActions resume={resume} isOwner={isOwner} />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
