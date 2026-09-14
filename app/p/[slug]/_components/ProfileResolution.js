'use client'

import Reveal from './Reveal'
import { ProfileActionButtons } from './ProfileHeader'

// ============================================================================
// The resolution, and the page's footer.
//
// One closing composition under a single hairline: where this person is, what
// they are open to, the two actions, and the quiet mark under all of it - the
// three groups running along a single line, each label kept against the thing
// it names. There is no narrative line here and no call-to-action block;
// `ready_for_next` is deliberately not rendered anywhere on the Profile.
//
// The actions are the masthead's own component rather than a second pair with
// the same copy, so the treatment, the titles and the disabled state are the
// header's by definition and the two can never drift.
//
// Location appears only when the resume actually carries one, and there is no
// remote-preference field in the data, so there is no remote line.
//
// This renders outside <main>, so it is the one part of the page that does not
// dissolve and re-enter when the reader changes direction.
// ============================================================================
export default function ProfileResolution({ readyTags, location, resume, isOwner, animate }) {
  const hasTags = readyTags.length > 0
  const hasLocation = Boolean(location)

  return (
    <footer className="hp-foot">
      <div className="hp-wrap-tight">
        <Reveal enabled={animate}>
          <div className="hp-foot-inner">
            {hasTags && (
              <p className="hp-foot-open">
                <strong className="hp-foot-open-label">Open to</strong>
                {readyTags.map((tag, index) => (
                  <span className="hp-open-tag" key={`${tag}-${index}`}>{tag}</span>
                ))}
              </p>
            )}

            {hasLocation && (
              <p className="hp-foot-where">
                <span className="hp-status-dot" aria-hidden="true" />
                {location}
              </p>
            )}

            <span className="hp-foot-actions">
              <ProfileActionButtons resume={resume} isOwner={isOwner} />
            </span>
          </div>
        </Reveal>

        <p className="hp-foot-mark">Powered by Hire Power</p>
      </div>
    </footer>
  )
}
