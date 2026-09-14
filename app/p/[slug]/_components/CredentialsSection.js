'use client'

import Reveal from './Reveal'
import StrokeIcon, { ICON_CERT } from './StrokeIcon'

// ============================================================================
// CREDENTIALS
//
// What the resume carries: the certifications, in a wide offset field rather
// than a narrow stack. Omitted when there are none.
//
// Curated evidence used to live here too, as a second half. It has its own
// section now - direction-scoped, and opening into the viewer rather than
// off the site - so this holds only what the resume itself says.
// ============================================================================
export default function CredentialsSection({ certifications, animate }) {
  if (certifications.length === 0) return null

  return (
    <section className="hp-section">
      <div className="hp-wrap">
        <div className="hp-split">
          <Reveal enabled={animate} className="hp-split-intro">
            <span className="hp-label">Credentials</span>
          </Reveal>

          <Reveal enabled={animate}>
            <div className="hp-creds">
              {certifications.map((cert, index) => {
                const issuer = [cert.organization || cert.issuer, cert.date || cert.details]
                  .filter(Boolean)
                  .join(' · ')
                return (
                  <div className="hp-cred" key={`${cert.name || cert.title}-${index}`}>
                    <span className="hp-cred-badge">
                      <StrokeIcon paths={ICON_CERT} size={18} />
                    </span>
                    <span>
                      <span className="hp-cred-name">{cert.name || cert.title}</span>
                      {issuer && <span className="hp-cred-issuer">{issuer}</span>}
                    </span>
                  </div>
                )
              })}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
