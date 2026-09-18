'use client'

import Reveal from './Reveal'
import { EditPencil, useEditSlot, UpgradeNote } from './EditAffordance'
import { TagsEditor } from './EditFields'

// ============================================================================
// The resolution, and the page's footer.
//
// One closing composition under a single hairline: where this person is, what
// they are open to, the two actions, and the quiet mark under all of it - the
// three groups running along a single line, each label kept against the thing
// it names. There is no narrative line here and no call-to-action block;
// `ready_for_next` is deliberately not rendered anywhere on the Profile.
//
// The actions are the masthead's own pair, handed down rather than rebuilt, so
// the treatment, the copy and the busy state are the header's by definition
// and the two placements can never drift.
//
// Nothing here is editable, by anybody. The address behind the Contact button
// is set on the Career Profile management page: a published profile is a thing
// to be read, and a control for changing it does not belong on it even when
// the person reading it happens to own it.
//
// Location appears only when the resume actually carries one, and there is no
// remote-preference field in the data, so there is no remote line.
//
// This renders outside <main>, so it is the one part of the page that does not
// dissolve and re-enter when the reader changes direction.
// ============================================================================
export default function ProfileResolution({ readyTags, location, actions, animate }) {
  const slot = useEditSlot()
  const hasTags = readyTags.length > 0
  const hasLocation = Boolean(location)

  return (
    <footer className="hp-foot">
      <div className="hp-wrap-tight">
        <Reveal enabled={animate}>
          <div className="hp-foot-inner">
            {/* Rendered unconditionally and null until it is open. As a dialog
                it puts nothing in the footer, so the closing line of the page
                does not rearrange itself the moment somebody presses a
                pencil. */}
            <TagsEditor value={readyTags} />

            {hasTags && (
              <p className={`hp-foot-open${slot}`}>
                {/* The pencil sits in the line itself, beside the label it
                    edits, rather than floating in a band above it. On a row
                    that reads like a statement about the person a hover-only
                    affordance goes unfound, so in Edit this one is standing
                    rather than waiting to be hovered. It opens the same dialog
                    it always did. */}
                <EditPencil field="ready_tags" label="the Open To tags" persists />
                <strong className="hp-foot-open-label">Open to</strong>
                {readyTags.map((tag, index) => (
                  <span className="hp-open-tag" key={`${tag}-${index}`}>{tag}</span>
                ))}
              </p>
            )}

            {/* Beside the tags rather than inside them: the line is a
                paragraph and so is the row of tags, and a paragraph cannot
                contain one. */}
            <UpgradeNote feature="ready_tags" />

            {hasLocation && (
              <p className="hp-foot-where">
                <span className="hp-status-dot" aria-hidden="true" />
                {location}
              </p>
            )}

            <span className="hp-foot-actions">{actions}</span>
          </div>
        </Reveal>

        {/* The words stay words and the name becomes the mark. One line, the
            same height it was: the logo is set to the cap height of the type
            beside it rather than to its own idea of a size. */}
        <p className="hp-foot-mark">
          <span className="hp-foot-mark-by">Powered by</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="hp-foot-mark-logo" src="/images/hire-power-logo-white-v2.png" alt="Hire Power" />
        </p>
      </div>
    </footer>
  )
}
