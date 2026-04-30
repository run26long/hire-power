// app/templates/pdf/ResumePDF.js
// ATS-correct PDF generation using @react-pdf/renderer
// Text is encoded natively — no space-dropping, no word combining, ever.

import React from 'react'
import { Document, Page, View, Text } from '@react-pdf/renderer'
import { formatDate, formatDateRange, getSkillsDisplay } from '../templateUtils'
import { groupExperience } from '../../utils/groupExperience'
import { groupEducation } from '../../utils/groupEducation'

// ─────────────────────────────────────────────
// SECTION HEADER — divider rule + uppercase heading
// ─────────────────────────────────────────────
function SectionHeader({ title, font, base, sp }) {
  return (
    <View wrap={false}>
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
        marginBottom: Math.round(5 * sp),
        lineHeight: 1.2
      }}>
        {title}
      </Text>
    </View>
  )
}

// ─────────────────────────────────────────────
// MAIN PDF COMPONENT
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

  const resolvedFont = font === 'Arial' ? 'Helvetica' : (font || 'Helvetica')
  const professionalTitle = resumeData.professionalTitle || resumeData.experience?.[0]?.title || ''

  const contactParts = [
    resumeData.location,
    resumeData.phone,
    resumeData.email,
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
          lineHeight: 1.2,
          color: '#1a1a1a',
          paddingTop: 43,
          paddingBottom: 43,
          paddingLeft: 43,
          paddingRight: 43,
          backgroundColor: '#ffffff'
        }}
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
          <View style={{ marginTop: Math.round(2 * sp) }}>
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

        {/* ── SECTIONS (sectionOrder-driven) ── */}
        {(resumeData.sectionOrder || ['experience','education','skills','projects','certifications','volunteer','languages','additionalInfo']).map((section) => {
          switch(section) {

            case 'experience': {
              if (!resumeData.experience?.length) return null
              const expGroups = groupExperience(resumeData.experience)
              if (!expGroups.length) return null

              const renderBullets = (job) => (job.bullets || []).map((bullet, k) => (
                <View key={k} wrap={false} style={{ flexDirection: 'row', marginBottom: Math.round(1 * sp) }}>
                  <Text style={{ fontFamily: resolvedFont, fontSize: base, lineHeight: 1.25, width: 10, flexShrink: 0 }}>{'\u2022 '}</Text>
                  <Text style={{ fontFamily: resolvedFont, fontSize: base, lineHeight: 1.25, flex: 1 }}>{(bullet || '').trim()}</Text>
                </View>
              ))

              const renderGroup = (group) => {
                if (group.roles.length === 1) {
                  const job = group.roles[0]
                  return (
                    <>
                      <View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontFamily: resolvedFont, fontSize: base, color: '#1a1a1a', lineHeight: 1.2, flex: 1 }}>
                            <Text style={{ textTransform: 'uppercase' }}>{job.company || ''}</Text>
                            {job.location ? <Text>{` | ${job.location}`}</Text> : null}
                          </Text>
                          <Text style={{ fontFamily: resolvedFont, fontSize: base, color: '#555555', lineHeight: 1.2 }}>{formatDateRange(job.startDate, job.endDate, job.current, dateFormat)}</Text>
                        </View>
                        <Text style={{ fontFamily: resolvedFont, fontWeight: 'bold', fontSize: base, color: '#1a1a1a', marginBottom: Math.round(2 * sp), lineHeight: 1.2 }}>{job.title || ''}</Text>
                        {job.summary && !job.summaryDismissed ? <Text style={{ fontFamily: resolvedFont, fontSize: base, color: '#444444', fontStyle: 'italic', marginTop: Math.round(2 * sp), marginBottom: Math.round(2 * sp), lineHeight: 1.25 }}>{job.summary}</Text> : null}
                      </View>
                      {renderBullets(job)}
                    </>
                  )
                }
                return (
                  <>
                    <View wrap={false} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: Math.round(3 * sp) }}>
                      <Text style={{ fontFamily: resolvedFont, fontSize: base, color: '#1a1a1a', lineHeight: 1.2, flex: 1 }}>
                        <Text style={{ textTransform: 'uppercase' }}>{group.company || ''}</Text>
                        {group.location ? <Text>{` | ${group.location}`}</Text> : null}
                      </Text>
                      <Text style={{ fontFamily: resolvedFont, fontSize: base, color: '#555555', lineHeight: 1.2 }}>{formatDateRange(group.startDate, group.endDate, group.current, dateFormat)}</Text>
                    </View>
                    {group.roles.map((job, ri) => (
                      <View key={ri} style={{ paddingLeft: 12, marginBottom: ri < group.roles.length - 1 ? Math.round(5 * sp) : 0 }}>
                        <View wrap={false}>
                          <Text style={{ fontFamily: resolvedFont, fontSize: base, lineHeight: 1.2 }}>
                            <Text style={{ fontWeight: 'bold', color: '#1a1a1a' }}>{job.title || ''}</Text>
                            <Text style={{ color: '#555555' }}>{` (${formatDateRange(job.startDate, job.endDate, job.current, dateFormat)})`}</Text>
                          </Text>
                          {job.summary && !job.summaryDismissed ? <Text style={{ fontFamily: resolvedFont, fontSize: base, color: '#444444', fontStyle: 'italic', marginTop: Math.round(2 * sp), marginBottom: Math.round(2 * sp), lineHeight: 1.25 }}>{job.summary}</Text> : null}
                        </View>
                        {renderBullets(job)}
                      </View>
                    ))}
                  </>
                )
              }

              const [firstGroup, ...restGroups] = expGroups

              return (
                <View key="experience">
                  <View wrap={false}>
                    <SectionHeader title={resumeData.sectionTitles?.experience || 'EXPERIENCE'} font={resolvedFont} base={base} sp={sp} />
                    <View style={{ marginBottom: restGroups.length > 0 ? Math.round(10 * sp) : 0 }}>
                      {renderGroup(firstGroup)}
                    </View>
                  </View>
                  {restGroups.map((group, gi) => (
                    <View key={gi+1} style={{ marginBottom: gi < restGroups.length - 1 ? Math.round(10 * sp) : 0 }}>
                      {renderGroup(group)}
                    </View>
                  ))}
                </View>
              )
            }

            case 'education': {
              if (!resumeData.education?.length) return null
              const eduGroups = groupEducation(resumeData.education)
              if (!eduGroups.length) return null

              const renderDegreeAndDate = (ed) => {
                const degreeText = ed.degreeDisplay || [ed.degree, ed.field].filter(Boolean).join(', ')
                const dateText = ed.graduationDate ? formatDate(ed.graduationDate, dateFormat) : ''
                return (
                  <Text style={{ fontFamily: resolvedFont, fontSize: base, lineHeight: 1.2 }}>
                    <Text style={{ fontWeight: 'bold', color: '#1a1a1a' }}>{degreeText}</Text>
                    {dateText ? <Text>{` | ${dateText}`}</Text> : null}
                  </Text>
                )
              }

              const renderEduLines = (ed) => {
                const lines = (ed.lines || []).filter(l => l && l.trim() !== '')
                if (!lines.length) return null
                return <Text style={{ fontFamily: resolvedFont, fontSize: base, color: '#333333', lineHeight: 1.25 }}>{lines.join(' | ')}</Text>
              }

              const renderEduGroup = (group) => {
                if (group.degrees.length === 1) {
                  const ed = group.degrees[0]
                  return (
                    <>
                      <Text style={{ fontFamily: resolvedFont, fontSize: base, color: '#1a1a1a', textTransform: 'uppercase', lineHeight: 1.2 }}>{ed.school || ''}</Text>
                      {renderDegreeAndDate(ed)}
                      {renderEduLines(ed)}
                    </>
                  )
                }
                return (
                  <>
                    <Text style={{ fontFamily: resolvedFont, fontSize: base, color: '#1a1a1a', textTransform: 'uppercase', marginBottom: Math.round(2 * sp), lineHeight: 1.2 }}>{group.school || ''}</Text>
                    {group.degrees.map((ed, di) => (
                      <View key={di} style={{ paddingLeft: 12, marginBottom: di < group.degrees.length - 1 ? Math.round(4 * sp) : 0 }}>
                        {renderDegreeAndDate(ed)}
                        {renderEduLines(ed)}
                      </View>
                    ))}
                  </>
                )
              }

              const [firstGroup, ...restGroups] = eduGroups

              return (
                <View key="education">
                  <View wrap={false}>
                    <SectionHeader title={resumeData.sectionTitles?.education || 'EDUCATION'} font={resolvedFont} base={base} sp={sp} />
                    <View style={{ marginBottom: restGroups.length > 0 ? Math.round(10 * sp) : 0 }}>
                      {renderEduGroup(firstGroup)}
                    </View>
                  </View>
                  {restGroups.map((group, gi) => (
                    <View key={gi+1} wrap={false} style={{ marginBottom: gi < restGroups.length - 1 ? Math.round(10 * sp) : 0 }}>
                      {renderEduGroup(group)}
                    </View>
                  ))}
                </View>
              )
            }

            case 'skills': {
              if (!Object.keys(skills).length) return null
              const skillEntries = Object.entries(skills)
              const [firstSkill, ...restSkills] = skillEntries
              return (
                <View key="skills">
                  <View wrap={false}>
                    <SectionHeader title={resumeData.sectionTitles?.skills || 'SKILLS'} font={resolvedFont} base={base} sp={sp} />
                    <View style={{ marginBottom: Math.round(3 * sp) }}>
                      {Object.keys(skills).length > 1
                        ? <Text style={{ fontFamily: resolvedFont, fontSize: base, lineHeight: 1.25 }}><Text style={{ fontWeight: 'bold' }}>{firstSkill[0] + ': '}</Text><Text style={{ color: '#333333' }}>{firstSkill[1].join(' \u2022 ')}</Text></Text>
                        : <Text style={{ fontFamily: resolvedFont, fontSize: base, color: '#333333', lineHeight: 1.25 }}>{firstSkill[1].join(' \u2022 ')}</Text>
                      }
                    </View>
                  </View>
                  {restSkills.map(([cat, items]) => (
                    <View key={cat} wrap={false} style={{ marginBottom: Math.round(3 * sp) }}>
                      <Text style={{ fontFamily: resolvedFont, fontSize: base, lineHeight: 1.25 }}><Text style={{ fontWeight: 'bold' }}>{cat + ': '}</Text><Text style={{ color: '#333333' }}>{items.join(' \u2022 ')}</Text></Text>
                    </View>
                  ))}
                </View>
              )
            }

            case 'certifications': {
              if (!resumeData.certifications?.length) return null
              const [firstCert, ...restCerts] = resumeData.certifications
              return (
                <View key="certifications">
                  <View wrap={false}>
                    <SectionHeader title={resumeData.sectionTitles?.certifications || 'CERTIFICATIONS'} font={resolvedFont} base={base} sp={sp} />
                    <View style={{ marginBottom: restCerts.length > 0 ? Math.round(10 * sp) : 0 }}>
                      <Text style={{ fontFamily: resolvedFont, fontSize: base, lineHeight: 1.25 }}><Text style={{ fontWeight: 'bold' }}>{firstCert.name || ''}</Text>{firstCert.details ? <Text>{' | ' + firstCert.details}</Text> : null}</Text>
                    </View>
                  </View>
                  {restCerts.map((c, i) => (
                    <View key={i+1} wrap={false} style={{ marginBottom: i < restCerts.length - 1 ? Math.round(10 * sp) : 0 }}>
                      <Text style={{ fontFamily: resolvedFont, fontSize: base, lineHeight: 1.25 }}><Text style={{ fontWeight: 'bold' }}>{c.name || ''}</Text>{c.details ? <Text>{' | ' + c.details}</Text> : null}</Text>
                    </View>
                  ))}
                </View>
              )
            }

            case 'volunteer': {
              if (!resumeData.volunteer?.length) return null
              const [firstVol, ...restVol] = resumeData.volunteer
              return (
                <View key="volunteer">
                  <View wrap={false}>
                    <SectionHeader title={resumeData.sectionTitles?.volunteer || 'VOLUNTEER EXPERIENCE'} font={resolvedFont} base={base} sp={sp} />
                    <View style={{ marginBottom: restVol.length > 0 ? Math.round(10 * sp) : 0 }}>
                      <Text style={{ fontFamily: resolvedFont, fontWeight: 'bold', fontSize: base, lineHeight: 1.25 }}>{firstVol.organization || ''}</Text>
                      <Text style={{ fontFamily: resolvedFont, fontSize: base, color: '#444444', lineHeight: 1.25 }}>{firstVol.description || ''}</Text>
                    </View>
                  </View>
                  {restVol.map((v, i) => (
                    <View key={i+1} wrap={false} style={{ marginBottom: i < restVol.length - 1 ? Math.round(10 * sp) : 0 }}>
                      <Text style={{ fontFamily: resolvedFont, fontWeight: 'bold', fontSize: base, lineHeight: 1.25 }}>{v.organization || ''}</Text>
                      <Text style={{ fontFamily: resolvedFont, fontSize: base, color: '#444444', lineHeight: 1.25 }}>{v.description || ''}</Text>
                    </View>
                  ))}
                </View>
              )
            }

            case 'projects': {
              if (!resumeData.projects?.length) return null
              const [firstProj, ...restProj] = resumeData.projects
              return (
                <View key="projects">
                  <View wrap={false}>
                    <SectionHeader title={resumeData.sectionTitles?.projects || 'PROJECTS'} font={resolvedFont} base={base} sp={sp} />
                    <View style={{ marginBottom: restProj.length > 0 ? Math.round(10 * sp) : 0 }}>
                      <Text style={{ fontFamily: resolvedFont, fontWeight: 'bold', fontSize: base, lineHeight: 1.25 }}>{(firstProj.name || '') + (firstProj.link ? ' | ' + firstProj.link : '')}</Text>
                      <Text style={{ fontFamily: resolvedFont, fontSize: base, color: '#444444', lineHeight: 1.25 }}>{firstProj.description || ''}</Text>
                    </View>
                  </View>
                  {restProj.map((p, i) => (
                    <View key={i+1} wrap={false} style={{ marginBottom: i < restProj.length - 1 ? Math.round(10 * sp) : 0 }}>
                      <Text style={{ fontFamily: resolvedFont, fontWeight: 'bold', fontSize: base, lineHeight: 1.25 }}>{(p.name || '') + (p.link ? ' | ' + p.link : '')}</Text>
                      <Text style={{ fontFamily: resolvedFont, fontSize: base, color: '#444444', lineHeight: 1.25 }}>{p.description || ''}</Text>
                    </View>
                  ))}
                </View>
              )
            }

            case 'additionalInfo': {
              if (!resumeData.additionalInfo?.length) return null
              const [firstInfo, ...restInfo] = resumeData.additionalInfo
              return (
                <View key="additionalInfo">
                  <View wrap={false}>
                    <SectionHeader title={resumeData.sectionTitles?.additionalInfo || 'ADDITIONAL INFORMATION'} font={resolvedFont} base={base} sp={sp} />
                    <View style={{ marginBottom: Math.round(3 * sp) }}>
                      <Text style={{ fontFamily: resolvedFont, fontSize: base, lineHeight: 1.25 }}><Text style={{ fontWeight: 'bold' }}>{firstInfo.label || ''}</Text>{firstInfo.detail ? <Text style={{ color: '#555555' }}>{' | ' + firstInfo.detail}</Text> : null}</Text>
                    </View>
                  </View>
                  {restInfo.map((item, i) => (
                    <View key={i+1} wrap={false} style={{ marginBottom: Math.round(3 * sp) }}>
                      <Text style={{ fontFamily: resolvedFont, fontSize: base, lineHeight: 1.25 }}><Text style={{ fontWeight: 'bold' }}>{item.label || ''}</Text>{item.detail ? <Text style={{ color: '#555555' }}>{' | ' + item.detail}</Text> : null}</Text>
                    </View>
                  ))}
                </View>
              )
            }

            case 'languages':
              if (!resumeData.languages?.length) return null
              return (
                <View key="languages">
                  <View wrap={false}>
                    <SectionHeader title={resumeData.sectionTitles?.languages || 'LANGUAGES'} font={resolvedFont} base={base} sp={sp} />
                    <Text style={{ fontFamily: resolvedFont, fontSize: base, color: '#333333', lineHeight: 1.25 }}>
                      {resumeData.languages.map(l => `${l.language} (${l.proficiency})`).join(' \u2022 ')}
                    </Text>
                  </View>
                </View>
              )

            default:
              return null
          }
        })}

      </Page>
    </Document>
  )
}