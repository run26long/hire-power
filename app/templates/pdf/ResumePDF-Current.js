// app/templates/pdf/ResumePDF.js
// ATS-correct PDF generation using @react-pdf/renderer
// Text is encoded natively — no space-dropping, no word combining, ever.

import React from 'react'
import { Document, Page, View, Text } from '@react-pdf/renderer'
import { formatDate, formatDateRange, getSkillsDisplay } from '../templateUtils'

// ─────────────────────────────────────────────
// SECTION HEADER — divider rule + uppercase heading
// ─────────────────────────────────────────────
function SectionHeader({ title, font, base, sp }) {
  return (
    <View>
      <View style={{
        borderBottomWidth: 1,
        borderBottomColor: '#bbbbbb',
        marginTop: Math.round(12 * sp),
        marginBottom: Math.round(12 * sp)
      }} />
      <Text style={{
        fontFamily: font,
        fontSize: base + 1,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        color: '#1a1a1a',
        marginBottom: Math.round(8 * sp),
        lineHeight: 1.2
      }}>
        {title}
      </Text>
    </View>
  )
}

// ─────────────────────────────────────────────
// MAIN PDF COMPONENT
// Used for ALL templates — single source of ATS truth
// ─────────────────────────────────────────────
export default function ResumePDF({
  resumeData,
  font = 'Lato',
  fontSize = 11,
  spacing = 1,
  accentColor = '#5b4fcf',
  dateFormat = 'short'
}) {
  if (!resumeData) return null

  const skills = getSkillsDisplay(resumeData)
  const base = fontSize || 11
  const sp = spacing || 1

  // Arial maps to Helvetica (built-in react-pdf font, no registration needed)
  // All other fonts must be registered in the route before calling this component
  const resolvedFont = font === 'Arial' ? 'Helvetica' : (font || 'Helvetica')

  const professionalTitle = resumeData.professionalTitle || resumeData.experience?.[0]?.title || ''

  const contactParts = [
    resumeData.phone,
    resumeData.email,
    resumeData.location,
    resumeData.linkedin,
    resumeData.portfolio,
  ].filter(Boolean)

  return (
    <Document onRender={() => {}} hyphenationCallback={(word) => [word]}>
      <Page
        size="LETTER"
        style={{
          fontFamily: resolvedFont,
          fontSize: base,
          lineHeight: 1.25,
          color: '#1a1a1a',
          paddingTop: 36,
          paddingBottom: 36,
          paddingLeft: 56,
          paddingRight: 56,
          backgroundColor: '#ffffff'
        }}
        wrap={false}
      >

        {/* ── HEADER ── */}
        <View style={{ alignItems: 'center' }}>
          <Text style={{
            fontFamily: resolvedFont,
            fontSize: 22,
            fontWeight: 'bold',
            letterSpacing: 2,
            textTransform: 'uppercase',
            color: '#1a1a1a',
            marginBottom: Math.round(3 * sp),
            lineHeight: 1.1
          }}>
            {resumeData.fullName || ''}
          </Text>

          {professionalTitle ? (
            <Text style={{
              fontFamily: resolvedFont,
              fontSize: base,
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              color: '#555555',
              marginBottom: Math.round(6 * sp),
              lineHeight: 1.2
            }}>
              {professionalTitle}
            </Text>
          ) : null}
        </View>

        {/* Rule above contact */}
        <View style={{ borderBottomWidth: 1, borderBottomColor: '#bbbbbb' }} />

        {/* Contact */}
        <View style={{ paddingTop: Math.round(6 * sp), paddingBottom: Math.round(6 * sp) }}>
          <Text style={{
            fontFamily: resolvedFont,
            fontSize: base - 1,
            color: '#555555',
            textAlign: 'center',
            lineHeight: 1.3,
            letterSpacing: 0.2
          }}>
            {contactParts.join(' | ')}
          </Text>
        </View>

        {/* Rule below contact */}
        <View style={{
          borderBottomWidth: 1,
          borderBottomColor: '#bbbbbb',
          marginBottom: Math.round(14 * sp)
        }} />

        {/* ── SUMMARY ── */}
        {resumeData.summary && !resumeData.hideSummary ? (
          <View style={{ marginTop: Math.round(18 * sp) }}>
            <Text style={{
              fontFamily: resolvedFont,
              fontSize: base + 1,
              fontWeight: 'bold',
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              color: '#1a1a1a',
              marginBottom: Math.round(8 * sp),
              lineHeight: 1.2
            }}>
              {resumeData.sectionTitles?.summary || 'PROFESSIONAL SUMMARY'}
            </Text>
            <Text style={{
              fontFamily: resolvedFont,
              fontSize: base,
              color: '#333333',
              lineHeight: 1.25
            }}>
              {resumeData.summary}
            </Text>
          </View>
        ) : null}

        {/* ── EXPERIENCE ── */}
        {resumeData.experience?.length > 0 ? (
          <View>
            <SectionHeader title="EXPERIENCE" font={resolvedFont} base={base} sp={sp} />
            {resumeData.experience.map((job, i) => (
              <View
                key={i}
                style={{ marginBottom: i < resumeData.experience.length - 1 ? Math.round(10 * sp) : 0 }}
              >
                {/* Title + Date */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{
                    fontFamily: resolvedFont,
                    fontWeight: 'bold',
                    fontSize: base,
                    lineHeight: 1.2,
                    color: '#1a1a1a',
                    flex: 1
                  }}>
                    {job.title || ''}
                  </Text>
                  <Text style={{
                    fontFamily: resolvedFont,
                    fontSize: base,
                    color: '#555555',
                    lineHeight: 1.2
                  }}>
                    {formatDateRange(job.startDate, job.endDate, job.current, dateFormat)}
                  </Text>
                </View>

                {/* Company */}
                <Text style={{
                  fontFamily: resolvedFont,
                  fontSize: base,
                  color: '#555555',
                  marginBottom: Math.round(2 * sp),
                  lineHeight: 1.2
                }}>
                  {[job.company, job.location].filter(Boolean).join(' | ')}
                </Text>

                {/* Job summary — italic */}
                {job.summary && !job.summaryDismissed ? (
                  <Text style={{
                    fontFamily: resolvedFont,
                    fontSize: base,
                    color: '#444444',
                    fontStyle: 'italic',
                    marginTop: Math.round(2 * sp),
                    marginBottom: Math.round(2 * sp),
                    lineHeight: 1.25
                  }}>
                    {job.summary}
                  </Text>
                ) : null}

                {/* Bullets */}
                {job.bullets?.length > 0 ? (
                  <View style={{ marginTop: Math.round(2 * sp) }}>
                    {job.bullets.map((bullet, k) => (
                      <View
                        key={k}
                        style={{ flexDirection: 'row', marginBottom: Math.round(1 * sp) }}
                      >
                        <Text style={{
                          fontFamily: resolvedFont,
                          fontSize: base,
                          lineHeight: 1.25,
                          width: 10,
                          flexShrink: 0
                        }}>
                          {'\u2022 '}
                        </Text>
                        <Text style={{
                          fontFamily: resolvedFont,
                          fontSize: base,
                          lineHeight: 1.25,
                          flex: 1
                        }}>
                          {bullet}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {/* ── EDUCATION ── */}
        {resumeData.education?.length > 0 ? (
          <View>
            <SectionHeader title="EDUCATION" font={resolvedFont} base={base} sp={sp} />
            {resumeData.education.map((ed, i) => (
              <View
                key={i}
                style={{ marginBottom: i < resumeData.education.length - 1 ? Math.round(10 * sp) : 0 }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{
                    fontFamily: resolvedFont,
                    fontWeight: 'bold',
                    fontSize: base,
                    lineHeight: 1.2,
                    color: '#1a1a1a',
                    flex: 1
                  }}>
                    {ed.school || ''}
                  </Text>
                  <Text style={{
                    fontFamily: resolvedFont,
                    fontSize: base,
                    color: '#555555',
                    lineHeight: 1.2
                  }}>
                    {formatDate(ed.graduationDate, dateFormat)}
                  </Text>
                </View>

                <Text style={{
                  fontFamily: resolvedFont,
                  fontSize: base,
                  color: '#555555',
                  marginBottom: Math.round(2 * sp),
                  lineHeight: 1.2
                }}>
                  {[ed.degree, ed.field].filter(Boolean).join(', ')}
                </Text>

                {ed.lines?.map((line, k) => (
                  <Text key={k} style={{
                    fontFamily: resolvedFont,
                    fontSize: base,
                    color: '#333333',
                    lineHeight: 1.25
                  }}>
                    {line}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        ) : null}

        {/* ── SKILLS ── */}
        {Object.keys(skills).length > 0 ? (
          <View>
            <SectionHeader title="SKILLS" font={resolvedFont} base={base} sp={sp} />
            {Object.entries(skills).map(([cat, items]) => (
              <View key={cat} style={{ marginBottom: Math.round(3 * sp) }}>
                {Object.keys(skills).length > 1 ? (
                  <Text style={{ fontFamily: resolvedFont, fontSize: base, lineHeight: 1.25 }}>
                    <Text style={{ fontWeight: 'bold' }}>{cat + ': '}</Text>
                    <Text style={{ color: '#333333' }}>{items.join(' \u2022 ')}</Text>
                  </Text>
                ) : (
                  <Text style={{
                    fontFamily: resolvedFont,
                    fontSize: base,
                    color: '#333333',
                    lineHeight: 1.25
                  }}>
                    {items.join(' \u2022 ')}
                  </Text>
                )}
              </View>
            ))}
          </View>
        ) : null}

        {/* ── CERTIFICATIONS ── */}
        {resumeData.certifications?.length > 0 ? (
          <View>
            <SectionHeader title="CERTIFICATIONS" font={resolvedFont} base={base} sp={sp} />
            {resumeData.certifications.map((c, i) => (
              <View
                key={i}
                style={{ marginBottom: i < resumeData.certifications.length - 1 ? Math.round(10 * sp) : 0 }}
              >
                <Text style={{ fontFamily: resolvedFont, fontSize: base, lineHeight: 1.25 }}>
                  <Text style={{ fontWeight: 'bold' }}>{c.name || ''}</Text>
                  {c.details ? <Text>{' | ' + c.details}</Text> : null}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* ── VOLUNTEER ── */}
        {resumeData.volunteer?.length > 0 ? (
          <View>
            <SectionHeader title="VOLUNTEER EXPERIENCE" font={resolvedFont} base={base} sp={sp} />
            {resumeData.volunteer.map((v, i) => (
              <View
                key={i}
                style={{ marginBottom: i < resumeData.volunteer.length - 1 ? Math.round(10 * sp) : 0 }}
              >
                <Text style={{
                  fontFamily: resolvedFont,
                  fontWeight: 'bold',
                  fontSize: base,
                  lineHeight: 1.25
                }}>
                  {v.organization || ''}
                </Text>
                <Text style={{
                  fontFamily: resolvedFont,
                  fontSize: base,
                  color: '#444444',
                  lineHeight: 1.25
                }}>
                  {v.description || ''}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* ── PROJECTS ── */}
        {resumeData.projects?.length > 0 ? (
          <View>
            <SectionHeader title="PROJECTS" font={resolvedFont} base={base} sp={sp} />
            {resumeData.projects.map((p, i) => (
              <View
                key={i}
                style={{ marginBottom: i < resumeData.projects.length - 1 ? Math.round(10 * sp) : 0 }}
              >
                <Text style={{
                  fontFamily: resolvedFont,
                  fontWeight: 'bold',
                  fontSize: base,
                  lineHeight: 1.25
                }}>
                  {(p.name || '') + (p.link ? ' | ' + p.link : '')}
                </Text>
                <Text style={{
                  fontFamily: resolvedFont,
                  fontSize: base,
                  color: '#444444',
                  lineHeight: 1.25
                }}>
                  {p.description || ''}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* ── ADDITIONAL INFORMATION ── */}
        {resumeData.additionalInfo?.length > 0 ? (
          <View>
            <SectionHeader title="ADDITIONAL INFORMATION" font={resolvedFont} base={base} sp={sp} />
            {resumeData.additionalInfo.map((item, i) => (
              <View key={i} style={{ marginBottom: Math.round(3 * sp) }}>
                <Text style={{ fontFamily: resolvedFont, fontSize: base, lineHeight: 1.25 }}>
                  <Text style={{ fontWeight: 'bold' }}>{item.label || ''}</Text>
                  {item.detail ? (
                    <Text style={{ color: '#555555' }}>{' | ' + item.detail}</Text>
                  ) : null}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* ── LANGUAGES ── */}
        {resumeData.languages?.length > 0 ? (
          <View>
            <SectionHeader title="LANGUAGES" font={resolvedFont} base={base} sp={sp} />
            <Text style={{
              fontFamily: resolvedFont,
              fontSize: base,
              color: '#333333',
              lineHeight: 1.25
            }}>
              {resumeData.languages.map(l => `${l.language} (${l.proficiency})`).join(' \u2022 ')}
            </Text>
          </View>
        ) : null}

      </Page>
    </Document>
  )
}