'use client'

// ============================================================================
// THE OWNER'S INTRODUCTION
//
// One editorial spread between the toolbar and the profile, in Edit mode only.
// It exists because the owner arrives without knowing what a Career Profile is,
// how much of theirs already exists, or what is left to do, and the page they
// land on answers none of that on its own.
//
// It is deliberately short. An introduction that fills the first screen buys
// its explanation by hiding the thing it is explaining, and the argument this
// page has to make is the profile itself: at 1440 by 900 the owner should read
// this and already be looking at the top of their own hero.
//
// It is not the band this replaced. That one was a wide gradient panel with a
// paragraph and a button, which read as onboarding furniture rather than as
// part of the Career Profile.
//
// ============================================================================

const STEPS = [
  ['01', 'See what’s already here', 'Your story, experience, results, and career direction.'],
  ['02', 'Add the proof', 'Your words, visual work, evidence, and testimonials.'],
  ['03', 'Share it when ready', 'Preview everything first. Nothing is public until you publish.']
]

export default function EditorGuide() {
  return (
    <section className="hp-ed-guide-intro" aria-label="About your Career Profile">
      <div className="hp-ed-guide-inner">
        <div className="hp-ed-guide-say">
          <span className="hp-ed-guide-eyebrow">Your Career Profile</span>
          <h2 className="hp-ed-guide-headline">
            Your résumé tells people where you worked. This shows them why it mattered.
          </h2>
          <p className="hp-ed-guide-lede">
            Hire Power has already turned your résumé and coaching conversations
            into a living profile of your work, results, and reputation. The
            foundation is here. We&rsquo;ll guide you through the few pieces only
            you and the people who worked with you can add.
          </p>
        </div>

        <ol className="hp-ed-guide-steps">
          {STEPS.map(([n, title, note]) => (
            <li className="hp-ed-guide-step" key={n}>
              <span className="hp-ed-guide-step-index" aria-hidden="true">{n}</span>
              <span className="hp-ed-guide-step-title">{title}</span>
              <span className="hp-ed-guide-step-note">{note}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
