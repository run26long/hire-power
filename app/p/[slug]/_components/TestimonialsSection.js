'use client'

import Reveal from './Reveal'

// ============================================================================
// WHAT OTHERS SAY
//
// Editorial quotation across the canvas, not a grid of review cards. The first
// voice is given the room; any others sit quieter opposite it. Serif is used
// here and in In My Own Words and nowhere else, which is what keeps it meaning
// "a person is speaking".
// ============================================================================
function Quote({ item, featured }) {
  const who = [item?.recipient_name, item?.recipient_title].filter(Boolean).join(', ')

  return (
    <figure className="hp-quote" data-featured={featured ? 'true' : 'false'}>
      <blockquote className="hp-quote-text">{item.polished_text}</blockquote>
      {(who || item?.relationship) && (
        <figcaption className="hp-quote-attr">
          {who && <span className="hp-quote-who">{who}</span>}
          {item?.relationship && <span className="hp-quote-rel">{item.relationship}</span>}
        </figcaption>
      )}
    </figure>
  )
}

export default function TestimonialsSection({ testimonials, animate }) {
  if (testimonials.length === 0) return null

  const [featured, ...rest] = testimonials

  return (
    <section className="hp-section">
      <div className="hp-wrap">
        <Reveal enabled={animate}>
          <span className="hp-label">What others say</span>
        </Reveal>

        <div className="hp-quotes" data-single={rest.length === 0 ? 'true' : 'false'}>
          <Reveal enabled={animate}>
            <Quote item={featured} featured />
          </Reveal>

          {rest.length > 0 && (
            <Reveal enabled={animate}>
              <div className="hp-quote-rest">
                {rest.map((item, index) => (
                  <Quote key={item?.id || index} item={item} featured={false} />
                ))}
              </div>
            </Reveal>
          )}
        </div>
      </div>
    </section>
  )
}
