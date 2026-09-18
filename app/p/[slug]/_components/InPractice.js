'use client'

import Reveal from './Reveal'
import PortfolioSection from './PortfolioSection'
import EvidenceSection from './EvidenceSection'
import { useCanShowEmpty } from '../_lib/editContext'

// ============================================================================
// IN PRACTICE
//
// One act, two lanes. Everything above this point on the page is a claim about
// somebody: what they do, what they are good at, what the people around them
// said. This is the act that hands the reader the things themselves.
//
// WHY THE TWO SECTIONS WERE JOINED
// They were two sections with two display headlines, one after the other, each
// announcing itself at the same weight as Experience and Skills. A reader
// coming down the page met "The work, as it looks." and then, a screen later,
// "See the work for yourself." - two openings for one idea, competing for the
// same attention and reading as a page that had lost its place.
//
// So the headline is said once, and the two lanes below it are subsections:
// what the work looks like, and what backs it up.
//
// WHAT DID NOT CHANGE
// The lanes themselves. Portfolio and Evidence remain separate collections
// with separate rules, separate management and separate overlays; they are one
// presentation here and nothing more. The split between them is still the one
// rule in lib/portfolio, applied once, upstream of both.
//
// THE COLLAPSE RULE, WHICH IS THE WHOLE POINT OF THE WRAPPER
// A section with nothing in it does not appear on a public profile. Two lanes
// means three ways to be empty, and each is handled here rather than in either
// lane: both empty and the act is not rendered at all, headline included; one
// empty and the act opens normally with a single lane under it and no heading,
// no gap and no placeholder where the other would have been.
//
// The owner's editor is the sole exception, as everywhere else: an absence
// nobody can see is an absence nobody can fill. `useCanShowEmpty` is true only
// while editing, and false in Preview, which is what keeps Preview honest.
// ============================================================================

export default function InPractice({
  portfolio,
  evidence,
  slug,
  lensId,
  animate,
  directionKey
}) {
  const canShowEmpty = useCanShowEmpty()

  const hasPortfolio = (portfolio?.length || 0) > 0
  const hasEvidence = (evidence?.length || 0) > 0

  // Nothing to show and nobody who could add any. The act closes completely:
  // no eyebrow, no headline, no rule, no space where it would have been.
  if (!hasPortfolio && !hasEvidence && !canShowEmpty) return null

  return (
    <section className="hp-section hp-practice">
      <div className="hp-wrap">
        <Reveal enabled={animate} className="hp-practice-intro">
          <span className="hp-label">In practice</span>
          <h2 className="hp-practice-headline">The work behind the claims.</h2>
        </Reveal>

        {/* Each lane still decides whether it has anything to say. Empty and
            public, it returns null and contributes no box, so the lane that
            does have something sits directly under the headline. */}
        <PortfolioSection
          items={portfolio}
          slug={slug}
          lensId={lensId}
          animate={animate}
          directionKey={directionKey}
        />

        <EvidenceSection
          items={evidence}
          slug={slug}
          lensId={lensId}
          animate={animate}
          directionKey={directionKey}
        />
      </div>
    </section>
  )
}
