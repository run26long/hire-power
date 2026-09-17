'use client'

import { useCallback, useState } from 'react'
import Reveal from './Reveal'
import { splitLeadSentence } from '../_lib/profileData'
import { EditPencil, EditEmpty, useEditSlot } from './EditAffordance'
import { ProseEditor } from './EditFields'
import ImowEditor from './ImowEditor'
import ImowVideo from './ImowVideo'
import { useFieldEditor } from '../_lib/editContext'
import { useCanShowEmpty } from '../_lib/editContext'

// ============================================================================
// ABOUT + IN MY OWN WORDS.
//
// The move from the public identity of Act I to the private one behind it.
// Three beats, in order: the thesis, the evidence under it, and then the belief
// the evidence came from, raised on its own plane to the right.
//
// The bio is split rather than rewritten. `splitLeadSentence` decides only
// where the stored text divides; the first sentence is set as the thesis and
// the remainder as supporting detail, and the two together are always exactly
// what was stored. A bio of one sentence renders as the thesis alone.
//
// Both passages are shown as stored. Nothing here rewrites copy, substitutes
// pronouns, or reframes the voice it was written in: a profile that says the
// wrong thing says it because the stored value says it, and that is the only
// place it can honestly be fixed.
//
// The three beats resolve in sequence on first view through the same Reveal
// the rest of the page uses, which already renders everything visible when
// there is no observer and when the visitor has asked for reduced motion.
//
// IN MY OWN WORDS HAS TWO FORMS
// Written, or said to camera. The video branch renders when the profile says
// video AND actually carries a file, never on the strength of either alone -
// the type column takes any string and nothing guarantees the two agree.
//
// No URL reaches this component. The payload carries a boolean, and the player
// asks the signing route for a link when it is about to play: a signed URL has
// a life, and one sitting in a payload the page may hold for an hour would be
// dead by the time anybody pressed play.
//
// Where there is both a video and text, the video leads and the text sits under
// it. The point of this section is hearing somebody say it; the text is what a
// reader has when they will not play a video on a train.
// ============================================================================

// Short enough to read as one move rather than three separate arrivals.
const BEAT_MS = 110

export default function ProfileSpread({
  bio,
  bioToShow,
  isCollapsible,
  bioExpanded,
  onToggleBio,
  imowText,
  imowType,
  imowHasVideo,
  slug,
  authHeaders,
  animate = true
}) {
  const hasBio = Boolean(bio)

  // Both, never either. imow_type takes any string - it accepts 'banana' -
  // and nothing guarantees a profile claiming video has a file behind it. A
  // row that says one without the other is not a video, and rendering a frame
  // for it would be rendering an empty box on somebody's profile.
  //
  // videoGone is what the player reports when the link will not sign or will
  // not play. The section then behaves as though there were no video at all,
  // which for a profile with text means the text, and for one without means
  // the section closes - the same rule every other empty section follows.
  const [videoGone, setVideoGone] = useState(false)
  const onVideoGone = useCallback(() => setVideoGone(true), [])
  const hasVideo = imowType === 'video' && imowHasVideo === true && !videoGone
  const hasVoice = Boolean(imowText) || hasVideo
  const canShowEmpty = useCanShowEmpty()
  const slot = useEditSlot()
  const bioEditor = useFieldEditor('bio')
  const imowEditor = useFieldEditor('imow')

  // The public rule stands: with nothing to say, this section does not exist.
  // Edit mode is the one exception, because an owner cannot write a bio into
  // a section that refuses to appear until they already have.
  if (!hasBio && !hasVoice && !canShowEmpty) return null

  const { lead, rest } = splitLeadSentence(bioToShow)
  const detail = rest ? rest.split(/\n\s*\n/).filter(Boolean) : []

  return (
    <section className="hp-frame hp-about-section">
      {/* Above the whole section, because it introduces both columns. The
          eyebrows below introduce one column each. */}
      <Reveal enabled={animate} className="hp-about-intro">
        <h2 className="hp-about-headline">The short version.</h2>
      </Reveal>

      <div
        className="hp-spread"
        data-voice={hasVoice || canShowEmpty ? 'true' : 'false'}
        data-about={hasBio || canShowEmpty ? 'true' : 'false'}
      >
        {bioEditor?.isOpen ? (
          <div data-resolve="about">
            <span className="hp-eyebrow">About</span>
            {/* The whole stored string. The page splits it into a lead
                sentence and the detail under it for display only; editing the
                halves would mean writing back something nobody typed. */}
            <ProseEditor field="bio" label="Bio" value={bio} rows={12} />
          </div>
        ) : null}

        {hasBio && !bioEditor?.isOpen && (
          <div className={`hp-refocus${slot}`} data-resolve="about">
            <EditPencil field="bio" label="the bio for this direction" />
            <Reveal enabled={animate}>
              <span className="hp-eyebrow">About</span>
              {lead && <p className="hp-about-lead">{lead}</p>}
            </Reveal>

            {(detail.length > 0 || isCollapsible) && (
              <Reveal enabled={animate} delay={BEAT_MS}>
                {detail.length > 0 && (
                  <div className="hp-about">
                    {detail.map((paragraph, index) => (
                      <p key={index}>{paragraph}</p>
                    ))}
                  </div>
                )}

                {isCollapsible && (
                  <button
                    type="button"
                    className="hp-more"
                    onClick={onToggleBio}
                    aria-expanded={bioExpanded}
                    data-expanded={bioExpanded ? 'true' : 'false'}
                  >
                    {bioExpanded ? 'Read less' : 'Read more'}
                    <span className="hp-more-mark" aria-hidden="true" />
                  </button>
                )}
              </Reveal>
            )}
          </div>
        )}

        {!hasBio && canShowEmpty && !bioEditor?.isOpen && (
          <div data-resolve="about">
            <span className="hp-eyebrow">About</span>
            <EditEmpty
              field="bio"
              title="Write the bio for this direction"
              note="A few sentences on what this direction is and why it is yours. Coach can draft one from your sessions."
            />
          </div>
        )}

        {imowEditor?.isOpen ? (
          <div data-resolve="voice">
            <span className="hp-eyebrow">In my own words</span>
            <ImowEditor value={imowText} />
          </div>
        ) : null}

        {hasVoice && !imowEditor?.isOpen && (
          <figure
            className={`hp-voice hp-refocus${slot}`}
            data-resolve="voice"
            data-video={hasVideo ? 'true' : undefined}
          >
            <EditPencil field="imow" label="In My Own Words" />

            {/* The quotation marks are for a quotation. Behind a video frame
                they are either invisible or peeking out from under it, and a
                pull-quote glyph over somebody's face is not atmosphere, so the
                video branch does without them. Everything else about the card
                stays: the wash, the rule down the edge, the eyebrow. */}
            {!hasVideo && (
              <span className="hp-voice-mark hp-voice-mark-open" aria-hidden="true">&#8220;</span>
            )}

            <Reveal enabled={animate} delay={BEAT_MS * 2}>
              <span className="hp-eyebrow">In my own words</span>

              {hasVideo && (
                <ImowVideo slug={slug} authHeaders={authHeaders} onUnavailable={onVideoGone} />
              )}

              {/* Video first, then the words, when there are both: the point
                  of this section is hearing them say it, and the text is what
                  somebody reads when they will not play a video on a train. */}
              {imowText && <blockquote className="hp-voice-text">{imowText}</blockquote>}
            </Reveal>

            {!hasVideo && (
              <span className="hp-voice-mark hp-voice-mark-close" aria-hidden="true">&#8221;</span>
            )}
          </figure>
        )}

        {!hasVoice && canShowEmpty && !imowEditor?.isOpen && (
          <div data-resolve="voice">
            <span className="hp-eyebrow">In my own words</span>
            <EditEmpty
              field="imow"
              title="Say it in your own words"
              note="Write it, or record a short video. This is the one part of the page in your voice rather than a summary of you."
            />
          </div>
        )}
      </div>
    </section>
  )
}
