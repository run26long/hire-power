'use client'

import Reveal from './Reveal'
import ExperienceStory from './ExperienceStory'

// ============================================================================
// SELECTED EXPERIENCE
//
// The section opens on its own headline rather than a label: this is where the
// profile stops asserting and starts showing, and the opening is sized to say
// so. The instruction below it is the one place the page tells the reader what
// to do, so it is quiet and it is said once.
//
// Below that, one full-width panel per role, opened one at a time. The order
// is the order the data is in, so chronology is untouched, and the data itself
// is whatever the current direction resolved to. Every role gets the same
// panel: there is no lead, no stagger, and nothing is promoted.
// ============================================================================
export default function SelectedExperience({ experience, expandedRole, onToggleRole, animate }) {
  if (experience.length === 0) return null

  return (
    <section className="hp-section hp-section-exp">
      <div className="hp-wrap">
        <Reveal enabled={animate} className="hp-exp-intro">
          <span className="hp-label">Selected experience</span>
          <h2 className="hp-exp-headline">Proof, not just claims.</h2>
        </Reveal>

        <Reveal enabled={animate}>
          <div className="hp-roles">
            {experience.map((job, index) => (
              <ExperienceStory
                key={`${job?.company || 'role'}-${index}`}
                job={job}
                index={index}
                isOpen={expandedRole === index}
                onToggle={onToggleRole}
              />
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
