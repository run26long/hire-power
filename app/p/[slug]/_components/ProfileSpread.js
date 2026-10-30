'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Reveal from './Reveal'
import { splitLeadSentence } from '../_lib/profileData'
import { EditPencil, SlotGuide, GuideAction, useEditSlot, UpgradeNote } from './EditAffordance'
import { ProseEditor } from './EditFields'
import ImowEditor from './ImowEditor'
import ImowVideo from './ImowVideo'
import { useFieldEditor, useProfileEdit } from '../_lib/editContext'
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
  imowExpanded,
  onToggleImow,
  imowType,
  imowHasVideo,
  // The shape the video was recorded in, and whether there is a still to show
  // before it plays. Passed straight through to the player, which is the only
  // thing that uses them; the card around it is unchanged.
  imowVideoWidth = null,
  imowVideoHeight = null,
  imowHasPoster = false,
  slug,
  getAuthHeaders,
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

  // ---- WHETHER THE PASSAGE IS ACTUALLY LONGER THAN ITS CLAMP ----
  //
  // The clamp is a line count in CSS, so only the rendered box knows whether it
  // cut anything off. A character count could be asked in advance and was what
  // this used to do; it could not answer the question the control depends on,
  // because the same number of characters is a different number of lines at
  // every width and every one of this section's three type sizes.
  //
  // Measured while clamped, which is the only state where the two heights can
  // differ. Once expanded the clamp is off and they agree again, so the last
  // answer stands - which is what keeps Show less on screen.
  const voiceRef = useRef(null)
  const [imowOverflows, setImowOverflows] = useState(false)

  useEffect(() => {
    const node = voiceRef.current
    if (!node || imowExpanded) return undefined

    const measure = () => {
      // A pixel of slack: sub-pixel line heights make scrollHeight exceed
      // clientHeight by a fraction on text that fits perfectly.
      setImowOverflows(node.scrollHeight > node.clientHeight + 1)
    }
    measure()

    // Re-asked when the column changes width, because a passage that fits at
    // one width wraps to another line at the next.
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [imowText, imowExpanded])
  const hasVideo = imowType === 'video' && imowHasVideo === true && !videoGone
  const hasVoice = Boolean(imowText) || hasVideo
  const canShowEmpty = useCanShowEmpty()
  const slot = useEditSlot()
  const bioEditor = useFieldEditor('bio')
  const imowEditor = useFieldEditor('imow')

  // ---- WHICH HALF A VISITOR SEES, DECIDED WHERE THEY WOULD SEE IT ----
  //
  // An owner with both a paragraph and a film has one thing left to decide
  // about this section: which of them a visitor gets. That decision used to be
  // made inside Tell your story, which is the room for writing and uploading -
  // so the owner chose a half while looking at a form rather than at the card
  // the choice is about. It is here instead, directly above the card, and
  // selecting swaps the card in place.
  //
  // THE PROPS ABOVE ARE THE PUBLIC TRUTH; THIS IS THE OWNER'S
  // The document payload carries only the chosen half - imowText is null on a
  // profile leading with its video - so the props this component renders from
  // cannot say whether the other half exists. The edit context can: it is
  // built from the management record, which holds both. Hence the reads below
  // rather than the props above.
  //
  // The context is null on the public page and in preview, which is what keeps
  // the switch off both without a second condition saying so.
  const edit = useProfileEdit()
  const ownerHasText = Boolean(String(edit?.imowText || '').trim())
  const ownerHasVideo = edit?.imowHasVideo === true
  const canChooseHalf = Boolean(edit?.setImowLive) && ownerHasText && ownerHasVideo
  const liveHalf = edit?.imowType === 'video' ? 'video' : 'text'

  // Its own flag rather than the field editor's busy slot: nothing is being
  // edited, and the pencil's spinner has nothing to do with this.
  const [swapping, setSwapping] = useState(false)

  const chooseHalf = useCallback(async (next) => {
    if (!edit?.setImowLive || next === liveHalf) return
    setSwapping(true)
    try {
      // The existing write, which reloads both records and so swaps the card
      // under this switch. It opens nothing and closes nothing.
      await edit.setImowLive(next)
    } catch (err) {
      edit.notify?.({
        type: 'error',
        message: err?.message || "We couldn't change that. Please try again."
      })
    } finally {
      setSwapping(false)
    }
  }, [edit, liveHalf])

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
            <ProseEditor field="bio" label="Bio" value={bio} rows={6} />
          </div>
        ) : null}

        {hasBio && !bioEditor?.isOpen && (
          <div className={`hp-refocus${slot}`} data-resolve="about">
            <EditPencil field="bio" label="the bio for this Career Direction" tourId="profile-about" />
            <UpgradeNote feature="bio" />
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
          <div className="hp-ed-incomplete" data-resolve="about">
            <span className="hp-ed-pill">Add your intro</span>
            <span className="hp-eyebrow">About</span>
            {/* The guidance takes the lead paragraph's own position and its own
                measure, so it sits where the story will sit rather than under
                a drawing of it. */}
            <div className="hp-about-lead hp-ed-guide-prose">
              <SlotGuide
                heading="Your career, in under a minute."
                action="Review the short version"
                feature="bio"
                onAction={() => bioEditor?.open()}
              >
                This is the career story someone can understand in under a
                minute. We have started it from your résumé and coaching.
                Review it, sharpen it, and make sure it sounds like you.
              </SlotGuide>
            </div>
          </div>
        )}

        {/* Rendered unconditionally and null until it is open. It is a dialog
            now, so it inserts nothing into the document and the card below
            stays exactly where it was while somebody is writing. */}
        <ImowEditor value={imowText} />

        {/* The slot exists so the switch can stand above the card without
            becoming a column of its own: at desktop the spread places its
            direct children, and two of them would be two placements. The card
            keeps data-resolve="voice" - it is still the thing that resolves on
            a direction change - and the slot is placed by its own class in
            sections.css, so nothing about the card moves.

            The slot is here in every mode rather than only when the switch is,
            so there is one shape to lay out rather than two. */}
        {hasVoice && (
          <div className="hp-voice-slot">
          {/* The profile's own segmented control, the one the editor already
              uses for two readings of a polish. Not a tab row: these are not
              two pages, they are two values of one setting, and the setting is
              named beside them. Nothing but this moves the line. */}
          {canChooseHalf ? (
            <div className="hp-voice-live">
              <span className="hp-voice-live-label">Show on profile</span>
              <div className="hp-ed-versions" role="group" aria-label="Which half your profile shows">
                <button
                  type="button"
                  className="hp-ed-version"
                  data-on={liveHalf === 'text' ? 'true' : 'false'}
                  aria-pressed={liveHalf === 'text'}
                  disabled={swapping}
                  onClick={() => chooseHalf('text')}
                >
                  Written
                </button>
                <button
                  type="button"
                  className="hp-ed-version"
                  data-on={liveHalf === 'video' ? 'true' : 'false'}
                  aria-pressed={liveHalf === 'video'}
                  disabled={swapping}
                  onClick={() => chooseHalf('video')}
                >
                  Video
                </button>
              </div>
            </div>
          ) : null}

          <figure
            className={`hp-voice hp-refocus${slot}`}
            data-resolve="voice"
            data-video={hasVideo ? 'true' : undefined}
          >
            {/* No UpgradeNote beside it any more. This section is writable on
                every plan, so a line saying otherwise would be wrong; the one
                thing still gated here - having it written for you - is locked
                where it is offered, inside the dialog. */}
            <EditPencil field="imow" label="In My Own Words" persists />

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
                <ImowVideo
                  slug={slug}
                  getAuthHeaders={getAuthHeaders}
                  onUnavailable={onVideoGone}
                  width={imowVideoWidth}
                  height={imowVideoHeight}
                  hasPoster={imowHasPoster}
                />
              )}

              {/* Video first, then the words, when there are both: the point
                  of this section is hearing them say it, and the text is what
                  somebody reads when they will not play a video on a train. */}
              {/* The whole passage, always. Collapsing is the clamp in CSS and
                  not a shorter string, so expanding reveals what is already
                  here rather than swapping the text for a longer copy of
                  itself. */}
              {imowText && (
                <blockquote
                  ref={voiceRef}
                  className="hp-voice-text"
                  data-clamped={imowExpanded ? 'false' : 'true'}
                >
                  {imowText}
                </blockquote>
              )}

              {/* The About column's control, reused rather than restated, so
                  the two sides of the spread open the same way. It sits inside
                  the Reveal and under the words, which keeps it inside the card
                  and clear of the closing quotation mark below. */}
              {imowText && (imowOverflows || imowExpanded) && (
                <button
                  type="button"
                  className="hp-more"
                  onClick={onToggleImow}
                  aria-expanded={imowExpanded}
                  data-expanded={imowExpanded ? 'true' : 'false'}
                >
                  {imowExpanded ? 'Read less' : 'Read more'}
                  <span className="hp-more-mark" aria-hidden="true" />
                </button>
              )}
            </Reveal>

            {!hasVideo && (
              <span className="hp-voice-mark hp-voice-mark-close" aria-hidden="true">&#8221;</span>
            )}
          </figure>
          </div>
        )}

        {/* The public voice card, empty. The same figure, the same wash, the
            same rule down its edge, the same quotation marks and the same
            eyebrow the populated card carries, so this side of the spread
            keeps the weight it will have rather than becoming a rectangle. */}
        {!hasVoice && canShowEmpty && (
          <div data-resolve="voice">
            {/* The real voice card, with the invitation where the words go.
                Same figure, same wash, same rule down its edge, same quotation
                marks and same eyebrow, so this side of the spread keeps the
                weight it will have. */}
            {/* The public card, with the invitation as its content. Same
                figure, same rule, same quote marks, same wash, and the lead
                line set in .hp-voice-text so it carries the card's own serif
                exactly as a real statement would. */}
            <figure className="hp-voice hp-ed-guide-voice hp-ed-incomplete">
              <span className="hp-ed-pill">Tell your story</span>
              <span className="hp-voice-mark hp-voice-mark-open" aria-hidden="true">&#8220;</span>
              <span className="hp-eyebrow">In my own words</span>

              <p className="hp-voice-text">
                A r&eacute;sum&eacute; can&rsquo;t speak directly to an employer.
                Your Career Profile can.
              </p>

              <p className="hp-ed-voice-note">
                This is your chance to make an impression and show a potential
                employer what sets you apart from other candidates. Use our
                suggestion as written, write your own version and let us polish
                it, or upload a video and let them hear from you.
              </p>

              <GuideAction label="Tell your story" feature="imow" onAction={() => imowEditor?.open()} />

              <span className="hp-voice-mark hp-voice-mark-close" aria-hidden="true">&#8221;</span>
            </figure>
          </div>
        )}
      </div>
    </section>
  )
}
