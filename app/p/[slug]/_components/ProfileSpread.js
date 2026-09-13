'use client'

import Reveal from './Reveal'
import { splitLeadSentence } from '../_lib/profileData'

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
// `imow_type` can say video, but there is no media URL anywhere in the API
// contract for this page, so no player is faked here and nothing invites an
// upload. Text is the only branch that exists to render.
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
  animate = true
}) {
  const hasBio = Boolean(bio)
  const hasVoice = Boolean(imowText)
  if (!hasBio && !hasVoice) return null

  const { lead, rest } = splitLeadSentence(bioToShow)
  const detail = rest ? rest.split(/\n\s*\n/).filter(Boolean) : []

  return (
    <section className="hp-frame">
      <div
        className="hp-spread"
        data-voice={hasVoice ? 'true' : 'false'}
        data-about={hasBio ? 'true' : 'false'}
      >
        {hasBio && (
          <div className="hp-refocus" data-resolve="about">
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

        {hasVoice && (
          <figure className="hp-voice hp-refocus" data-resolve="voice">
            {/* Atmosphere, not punctuation. These sit behind the words, are
                never part of the stored string, and are hidden from assistive
                technology so the statement is not announced as a quotation
                twice over. */}
            <span className="hp-voice-mark hp-voice-mark-open" aria-hidden="true">&#8220;</span>

            <Reveal enabled={animate} delay={BEAT_MS * 2}>
              <span className="hp-eyebrow">In my own words</span>
              <blockquote className="hp-voice-text">{imowText}</blockquote>
            </Reveal>

            <span className="hp-voice-mark hp-voice-mark-close" aria-hidden="true">&#8221;</span>
          </figure>
        )}
      </div>
    </section>
  )
}
