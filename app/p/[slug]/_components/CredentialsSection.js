'use client'

import Reveal from './Reveal'
import StrokeIcon, { ICON_CERT, ICON_MEDIA } from './StrokeIcon'
import { mediaClassOf } from '../_lib/profileData'

// ============================================================================
// EVIDENCE
//
// Credentials and the work itself, given two treatments so the section does
// not read as one card repeated, in a wide offset field rather than a narrow
// stack. Each half is omitted when it has nothing in it, and the section with
// it when both are empty.
// ============================================================================
export default function CredentialsSection({ certifications, evidence, animate }) {
  const hasCerts = certifications.length > 0
  const hasWork = evidence.length > 0
  if (!hasCerts && !hasWork) return null

  return (
    <section className="hp-section">
      <div className="hp-wrap">
        <div className="hp-split">
          <Reveal enabled={animate} className="hp-split-intro">
            <span className="hp-label">Evidence</span>
          </Reveal>

          <Reveal enabled={animate}>
            {hasCerts && (
              <div>
                <span className="hp-turn">Credentials</span>
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
              </div>
            )}

            {hasWork && (
              <div className={hasCerts ? 'hp-turn-spaced' : undefined}>
                <span className="hp-turn">Work samples</span>
                <div className="hp-artifacts">
                  {evidence.map((item, index) => {
                    const media = mediaClassOf(item)
                    const label = item.kind || item.media_class
                    const inner = (
                      <>
                        <span className="hp-artifact-face">
                          <StrokeIcon paths={ICON_MEDIA[media] || ICON_MEDIA.default} size={20} />
                        </span>
                        <span className="hp-artifact-title">{item.title || 'Untitled'}</span>
                        {label && <span className="hp-artifact-kind">{label}</span>}
                      </>
                    )
                    // A piece of evidence with no link is still evidence, it
                    // just is not a destination.
                    return item.url ? (
                      <a
                        key={item.id || index}
                        className="hp-artifact"
                        data-media={media}
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {inner}
                      </a>
                    ) : (
                      <div key={item.id || index} className="hp-artifact" data-media={media}>
                        {inner}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </Reveal>
        </div>
      </div>
    </section>
  )
}
