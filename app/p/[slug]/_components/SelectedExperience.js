'use client'

import Reveal from './Reveal'
import ExperienceStory from './ExperienceStory'
import { EditElsewhere, useEditSlot } from './EditAffordance'

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
  const slot = useEditSlot()
  if (experience.length === 0) return null

  return (
    <section className="hp-section hp-section-exp">
      <div className="hp-wrap">
        {/* No pencil here on purpose. These roles are read straight off the
            resume, so the place to change them is the resume. A control that
            let somebody type over them here would be writing into a copy. */}
        <Reveal enabled={animate} className={`hp-exp-intro${slot}`}>
          <EditElsewhere href="/resume-coach">Edit in Resume Coach</EditElsewhere>
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
