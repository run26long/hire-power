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
// WHAT "CONTINUE BUILDING" DOES
// Goes to the first section that is genuinely incomplete for this profile,
// worked out from the payload rather than hard coded, so the owner is taken to
// something that actually needs them. With nothing left it stops being a
// builder's action and becomes the one thing left worth doing: preview it.
// ============================================================================

const STEPS = [
  ['01', 'See what’s already here', 'Your story, experience, results, and career direction.'],
  ['02', 'Add the proof', 'Your words, visual work, evidence, and testimonials.'],
  ['03', 'Share it when ready', 'Preview everything first. Nothing is public until you publish.']
]

// In the order the page presents them, so "the first incomplete section" means
// the first one the owner would come to scrolling down.
export function firstIncomplete(doc) {
  if (!doc) return null

  const lens = (doc.lenses || [])[0] || null
  const evidence = Array.isArray(doc.evidence) ? doc.evidence : []
  const testimonials = (Array.isArray(doc.testimonials) ? doc.testimonials : [])
    .filter(t => String(t?.polished_text || '').trim())

  const visual = evidence.filter(e => (e?.media_class === 'image' || e?.media_class === 'video') && e?.has_file)
  const documents = evidence.filter(e => !((e?.media_class === 'image' || e?.media_class === 'video') && e?.has_file))

  if (!lens?.proof_points?.length) return { selector: '.hp-act1', label: 'proof points' }
  if (!lens?.bio) return { selector: '.hp-about-section', label: 'the short version' }
  if (!doc?.profile?.imow_text && doc?.profile?.imow_has_video !== true) {
    return { selector: '.hp-about-section', label: 'your own words' }
  }
  if (testimonials.length === 0) return { selector: '.hp-impact', label: 'testimonials' }
  if (visual.length === 0) return { selector: '.hp-pf-section', label: 'your portfolio' }
  if (documents.length === 0) return { selector: '.hp-ev-section', label: 'evidence' }
  return null
}

export default function EditorGuide({ doc, onPreview }) {
  const next = firstIncomplete(doc)

  const go = () => {
    if (!next) { onPreview?.(); return }
    const el = document.querySelector(next.selector)
    if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }

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
          <button type="button" className="hp-ed-action" data-primary="true" onClick={go}>
            {next ? 'Continue building' : 'Preview your profile'}
          </button>
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
