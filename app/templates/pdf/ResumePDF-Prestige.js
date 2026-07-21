import React from 'react'
import { Document, Page, View, Text } from '@react-pdf/renderer'
import { formatDate, formatDateRange, getSkillsDisplay, hexToRgba } from '../templateUtils'
import { groupExperience } from '../../utils/groupExperience'
import { groupEducation } from '../../utils/groupEducation'

export default function ResumePDFPrestige({ resumeData, font = 'EB Garamond', fontSize = 11, spacing = 1, accentColor = '#5b4fcf', dateFormat = 'short' }) {
  if (!resumeData) return null
  const skills = getSkillsDisplay(resumeData)
  const base = fontSize
  const sp = spacing
  const color = accentColor
  const f = font === 'Arial' ? 'Helvetica' : (font || 'EB Garamond')
  const titleLine = resumeData.professionalTitle || resumeData.experience?.[0]?.title || ''

  const contactParts = [resumeData.location, resumeData.phone, resumeData.email, resumeData.linkedin, resumeData.portfolio].filter(Boolean)

  const SH = ({ title }) => (
    <View>
      <Text style={{ fontFamily: f, fontSize: base, fontWeight: 'bold', textTransform: 'uppercase', color: '#1a1a1a', marginBottom: Math.round(2*sp) }}>{title}</Text>
      <View style={{ borderBottomWidth: 1, borderBottomColor: color, marginBottom: Math.round(5*sp) }} />
    </View>
  )

  return (
    <Document hyphenationCallback={(w) => [w]}>
      <Page size="LETTER" style={{ fontFamily: f, fontSize: base, lineHeight: 1.2, color: '#1a1a1a', backgroundColor: '#ffffff', paddingTop: Math.round(40*sp), paddingBottom: Math.round(36*sp) }}>

        {/* Page 2+ continuation header */}
        <View fixed style={{ position: 'absolute', top: 14, left: 52, right: 52 }} render={({ pageNumber }) => pageNumber > 1 ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: color, paddingBottom: 3 }}>
            <Text style={{ fontFamily: f, fontSize: base - 2, textTransform: 'uppercase', color: '#888888' }}>{resumeData.fullName || ''}</Text>
            <Text style={{ fontFamily: f, fontSize: base - 2, color: '#888888' }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
          </View>
        ) : null} />

        {/* Name block */}
        <View style={{ marginTop: -Math.round(40*sp), paddingTop: Math.round(30*sp), paddingLeft: Math.round(52*sp), paddingRight: Math.round(52*sp) }}>
          <Text style={{ fontFamily: f, fontSize: 22, fontWeight: 'bold', textTransform: 'uppercase', color: '#1a1a1a', marginBottom: Math.round(16*sp) }}>{resumeData.fullName || ''}</Text>
          {titleLine ? <Text style={{ fontFamily: f, fontSize: base+1, fontWeight: 'bold', color: color, marginBottom: Math.round(4*sp) }}>{titleLine}</Text> : null}
        </View>

        {/* Contact band */}
        <View style={{ backgroundColor: hexToRgba(color, 0.094), borderTopWidth: 2, borderTopColor: color, paddingTop: Math.round(6*sp), paddingBottom: Math.round(6*sp), paddingLeft: Math.round(52*sp), paddingRight: Math.round(52*sp), marginBottom: Math.round(8*sp) }}>
          <Text style={{ fontFamily: f, fontSize: base, color: '#444444' }}>{contactParts.join('  |  ')}</Text>
        </View>

        {/* Body */}
        <View style={{ paddingLeft: Math.round(52*sp), paddingRight: Math.round(52*sp) }}>

          {resumeData.summary && !resumeData.hideSummary && (
            <View style={{ marginTop: Math.round(8*sp) }}>
              <SH title={resumeData.sectionTitles?.summary || 'Professional Summary'} />
              <Text style={{ fontFamily: f, fontSize: base, color: '#333333' }}>{resumeData.summary}</Text>
            </View>
          )}

          {(resumeData.sectionOrder || ['experience','education','skills','projects','certifications','volunteer','languages','additionalInfo']).map((section) => {
            switch(section) {

              case 'experience': {
                if (!resumeData.experience?.length) return null
                const expGroups = groupExperience(resumeData.experience)
                if (!expGroups.length) return null

                const renderBullets = (job) => (job.bullets || []).map((b, k) => (
                  <View key={k} wrap={false} style={{ flexDirection: 'row', marginBottom: Math.round(1*sp) }}>
                    <Text style={{ fontFamily: f, fontSize: base, width: 10 }}>{'\u2022 '}</Text>
                    <Text style={{ fontFamily: f, fontSize: base, flex: 1 }}>{(b || '').trim()}</Text>
                  </View>
                ))

                const renderGroup = (group, includeHeader = false) => {
                  if (group.roles.length === 1) {
                    const job = group.roles[0]
                    const hasSummary = job.summary && !job.summaryDismissed
                    const bullets = (job.bullets || []).filter(b => (b || '').trim() && (b || '').trim() !== 'Describe what you did and the impact you made')
                    return (
                      <>
                        <View wrap={false}>
                          {includeHeader && <SH title={resumeData.sectionTitles?.experience || 'Experience'} />}
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontFamily: f, fontSize: base, color: '#1a1a1a', flex: 1 }}>
                              <Text style={{ textTransform: 'uppercase' }}>{job.company || ''}</Text>
                              {job.location ? <Text>{` | ${job.location}`}</Text> : null}
                            </Text>
                            <Text style={{ fontFamily: f, fontSize: base, color: '#666666', fontStyle: 'italic' }}>{formatDateRange(job.startDate, job.endDate, job.current, dateFormat)}</Text>
                          </View>
                          <Text style={{ fontFamily: f, fontWeight: 'bold', fontSize: base, marginBottom: Math.round(2*sp) }}>{job.title || ''}</Text>
                          {hasSummary && <Text style={{ fontFamily: f, fontSize: base, color: '#333333', marginBottom: Math.round(2*sp) }}>{job.summary}</Text>}
                          {!hasSummary && bullets.length > 0 && (
                            <View style={{ flexDirection: 'row', marginBottom: Math.round(1*sp) }}>
                              <Text style={{ fontFamily: f, fontSize: base, width: 10 }}>{'\u2022 '}</Text>
                              <Text style={{ fontFamily: f, fontSize: base, flex: 1 }}>{bullets[0]}</Text>
                            </View>
                          )}
                        </View>
                        {(hasSummary ? bullets : bullets.slice(1)).map((b, k) => (
                          <View key={k} wrap={false} style={{ flexDirection: 'row', marginBottom: Math.round(1*sp) }}>
                            <Text style={{ fontFamily: f, fontSize: base, width: 10 }}>{'\u2022 '}</Text>
                            <Text style={{ fontFamily: f, fontSize: base, flex: 1 }}>{b}</Text>
                          </View>
                        ))}
                      </>
                    )
                  }
                  return (
                    <>
                      <View wrap={false}>
                        {includeHeader && <SH title={resumeData.sectionTitles?.experience || 'Experience'} />}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: Math.round(3*sp) }}>
                          <Text style={{ fontFamily: f, fontSize: base, color: '#1a1a1a', flex: 1 }}>
                            <Text style={{ textTransform: 'uppercase' }}>{group.company || ''}</Text>
                            {group.location ? <Text>{` | ${group.location}`}</Text> : null}
                          </Text>
                          <Text style={{ fontFamily: f, fontSize: base, color: '#666666', fontStyle: 'italic' }}>{formatDateRange(group.startDate, group.endDate, group.current, dateFormat)}</Text>
                        </View>
                        <View style={{ paddingLeft: 12 }}>
                          <Text style={{ fontFamily: f, fontSize: base }}>
                            <Text style={{ fontWeight: 'bold' }}>{group.roles[0].title || ''}</Text>
                            <Text style={{ color: '#666666', fontStyle: 'italic' }}>{` (${formatDateRange(group.roles[0].startDate, group.roles[0].endDate, group.roles[0].current, dateFormat)})`}</Text>
                          </Text>
                          {group.roles[0].summary && !group.roles[0].summaryDismissed && <Text style={{ fontFamily: f, fontSize: base, color: '#333333', marginTop: Math.round(2*sp), marginBottom: Math.round(2*sp) }}>{group.roles[0].summary}</Text>}
                          {(() => {
                            const hasSummary = group.roles[0].summary && !group.roles[0].summaryDismissed
                            const bullets = (group.roles[0].bullets || []).filter(b => (b || '').trim() && (b || '').trim() !== 'Describe what you did and the impact you made')
                            return !hasSummary && bullets.length > 0 ? (
                              <View style={{ flexDirection: 'row', marginBottom: Math.round(1*sp) }}>
                                <Text style={{ fontFamily: f, fontSize: base, width: 10 }}>{'\u2022 '}</Text>
                                <Text style={{ fontFamily: f, fontSize: base, flex: 1 }}>{bullets[0]}</Text>
                              </View>
                            ) : null
                          })()}
                        </View>
                      </View>
                      {/* Remaining bullets for first role */}
                      {(() => {
                        const hasSummary = group.roles[0].summary && !group.roles[0].summaryDismissed
                        const bullets = (group.roles[0].bullets || []).filter(b => (b || '').trim() && (b || '').trim() !== 'Describe what you did and the impact you made')
                        return (hasSummary ? bullets : bullets.slice(1)).map((b, k) => (
                          <View key={`r0-b${k}`} wrap={false} style={{ paddingLeft: 12, flexDirection: 'row', marginBottom: Math.round(1*sp) }}>
                            <Text style={{ fontFamily: f, fontSize: base, width: 10 }}>{'\u2022 '}</Text>
                            <Text style={{ fontFamily: f, fontSize: base, flex: 1 }}>{b}</Text>
                          </View>
                        ))
                      })()}
                      {/* Remaining roles */}
                      {group.roles.slice(1).map((job, ri) => {
                        const hasSummary = job.summary && !job.summaryDismissed
                        const bullets = (job.bullets || []).filter(b => (b || '').trim() && (b || '').trim() !== 'Describe what you did and the impact you made')
                        return (
                          <React.Fragment key={ri+1}>
                            <View wrap={false} style={{ paddingLeft: 12, marginTop: Math.round(5*sp) }}>
                              <Text style={{ fontFamily: f, fontSize: base }}>
                                <Text style={{ fontWeight: 'bold' }}>{job.title || ''}</Text>
                                <Text style={{ color: '#666666', fontStyle: 'italic' }}>{` (${formatDateRange(job.startDate, job.endDate, job.current, dateFormat)})`}</Text>
                              </Text>
                              {hasSummary && <Text style={{ fontFamily: f, fontSize: base, color: '#333333', marginTop: Math.round(2*sp), marginBottom: Math.round(2*sp) }}>{job.summary}</Text>}
                              {!hasSummary && bullets.length > 0 && (
                                <View style={{ flexDirection: 'row', marginBottom: Math.round(1*sp) }}>
                                  <Text style={{ fontFamily: f, fontSize: base, width: 10 }}>{'\u2022 '}</Text>
                                  <Text style={{ fontFamily: f, fontSize: base, flex: 1 }}>{bullets[0]}</Text>
                                </View>
                              )}
                            </View>
                            {(hasSummary ? bullets : bullets.slice(1)).map((b, k) => (
                              <View key={k} wrap={false} style={{ paddingLeft: 12, flexDirection: 'row', marginBottom: Math.round(1*sp) }}>
                                <Text style={{ fontFamily: f, fontSize: base, width: 10 }}>{'\u2022 '}</Text>
                                <Text style={{ fontFamily: f, fontSize: base, flex: 1 }}>{b}</Text>
                              </View>
                            ))}
                          </React.Fragment>
                        )
                      })}
                    </>
                  )
                }

                const [firstGroup, ...restGroups] = expGroups

                return (
                  <View key="experience" style={{ marginTop: Math.round(16*sp) }}>
                    <View style={{ marginBottom: restGroups.length > 0 ? Math.round(10*sp) : 0 }}>
                      {renderGroup(firstGroup, true)}
                    </View>
                    {restGroups.map((group, gi) => (
                      <View key={gi+1} style={{ marginBottom: gi < restGroups.length - 1 ? Math.round(10*sp) : 0 }}>
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
                  if (!degreeText && !dateText) return null
                  return (
                    <Text style={{ fontFamily: f, fontSize: base }}>
                      <Text style={{ fontWeight: 'bold' }}>{degreeText}</Text>
                      {dateText ? <Text style={{ color: '#555555' }}>{` | ${dateText}`}</Text> : null}
                    </Text>
                  )
                }

                const renderEduLines = (ed) => {
                  const lines = (ed.lines || []).filter(l => l && l.trim() !== '')
                  if (!lines.length) return null
                  return <Text style={{ fontFamily: f, fontSize: base, color: '#333333' }}>{lines.join(' | ')}</Text>
                }

                const renderEduGroup = (group) => {
                  if (group.degrees.length === 1) {
                    const ed = group.degrees[0]
                    return (
                      <>
                        <Text style={{ fontFamily: f, fontSize: base, color: '#1a1a1a', textTransform: 'uppercase' }}>{ed.school || ''}</Text>
                        {renderDegreeAndDate(ed)}
                        {renderEduLines(ed)}
                      </>
                    )
                  }
                  return (
                    <>
                      <Text style={{ fontFamily: f, fontSize: base, color: '#1a1a1a', textTransform: 'uppercase', marginBottom: Math.round(2*sp) }}>{group.school || ''}</Text>
                      {group.degrees.map((ed, di) => (
                        <View key={di} style={{ paddingLeft: 12, marginBottom: di < group.degrees.length - 1 ? Math.round(4*sp) : 0 }}>
                          {renderDegreeAndDate(ed)}
                          {renderEduLines(ed)}
                        </View>
                      ))}
                    </>
                  )
                }

                const [firstGroup, ...restGroups] = eduGroups

                return (
                  <View key="education" style={{ marginTop: Math.round(16*sp) }}>
                    <View wrap={false}>
                      <SH title={resumeData.sectionTitles?.education || 'Education'} />
                      <View style={{ marginBottom: restGroups.length > 0 ? Math.round(10*sp) : 0 }}>
                        {renderEduGroup(firstGroup)}
                      </View>
                    </View>
                    {restGroups.map((group, gi) => (
                      <View key={gi+1} wrap={false} style={{ marginBottom: gi < restGroups.length - 1 ? Math.round(10*sp) : 0 }}>
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
                  <View key="skills" style={{ marginTop: Math.round(16*sp) }}>
                    <View wrap={false}>
                      <SH title={resumeData.sectionTitles?.skills || 'Skills'} />
                      <View style={{ marginBottom: Math.round(3*sp) }}>
                        {Object.keys(skills).length > 1
                          ? <Text style={{ fontFamily: f, fontSize: base }}><Text style={{ fontWeight: 'bold', color: '#1a1a1a' }}>{firstSkill[0] + ': '}</Text><Text style={{ color: '#444444' }}>{firstSkill[1].join(' \u2022 ')}</Text></Text>
                          : <Text style={{ fontFamily: f, fontSize: base, color: '#444444' }}>{firstSkill[1].join(' \u2022 ')}</Text>
                        }
                      </View>
                    </View>
                    {restSkills.map(([cat, items]) => (
                      <View key={cat} wrap={false} style={{ marginBottom: Math.round(3*sp) }}>
                        <Text style={{ fontFamily: f, fontSize: base }}><Text style={{ fontWeight: 'bold', color: '#1a1a1a' }}>{cat + ': '}</Text><Text style={{ color: '#444444' }}>{items.join(' \u2022 ')}</Text></Text>
                      </View>
                    ))}
                  </View>
                )
              }

              case 'certifications': {
                if (!resumeData.certifications?.length) return null
                const [firstCert, ...restCerts] = resumeData.certifications
                return (
                  <View key="certifications" style={{ marginTop: Math.round(16*sp) }}>
                    <View wrap={false}>
                      <SH title={resumeData.sectionTitles?.certifications || 'Certifications'} />
                      <View style={{ marginBottom: restCerts.length > 0 ? Math.round(6*sp) : 0 }}>
                        <Text style={{ fontFamily: f, fontSize: base }}><Text style={{ fontWeight: 'bold' }}>{firstCert.name || ''}</Text>{firstCert.details ? ' | ' + firstCert.details : ''}</Text>
                      </View>
                    </View>
                    {restCerts.map((c, i) => (
                      <View key={i+1} wrap={false} style={{ marginBottom: i < restCerts.length - 1 ? Math.round(6*sp) : 0 }}>
                        <Text style={{ fontFamily: f, fontSize: base }}><Text style={{ fontWeight: 'bold' }}>{c.name || ''}</Text>{c.details ? ' | ' + c.details : ''}</Text>
                      </View>
                    ))}
                  </View>
                )
              }

              case 'volunteer': {
                if (!resumeData.volunteer?.length) return null
                const [firstVol, ...restVol] = resumeData.volunteer
                return (
                  <View key="volunteer" style={{ marginTop: Math.round(16*sp) }}>
                    <View wrap={false}>
                      <SH title={resumeData.sectionTitles?.volunteer || 'Volunteer Experience'} />
                      <View style={{ marginBottom: restVol.length > 0 ? Math.round(6*sp) : 0 }}>
                        <Text style={{ fontFamily: f, fontWeight: 'bold', fontSize: base }}>{firstVol.organization || ''}</Text>
                        <Text style={{ fontFamily: f, fontSize: base, color: '#444444' }}>{firstVol.description || ''}</Text>
                      </View>
                    </View>
                    {restVol.map((v, i) => (
                      <View key={i+1} wrap={false} style={{ marginBottom: i < restVol.length - 1 ? Math.round(6*sp) : 0 }}>
                        <Text style={{ fontFamily: f, fontWeight: 'bold', fontSize: base }}>{v.organization || ''}</Text>
                        <Text style={{ fontFamily: f, fontSize: base, color: '#444444' }}>{v.description || ''}</Text>
                      </View>
                    ))}
                  </View>
                )
              }

              case 'projects': {
                if (!resumeData.projects?.length) return null
                const [firstProj, ...restProj] = resumeData.projects
                return (
                  <View key="projects" style={{ marginTop: Math.round(16*sp) }}>
                    <View wrap={false}>
                      <SH title={resumeData.sectionTitles?.projects || 'Projects'} />
                      <View style={{ marginBottom: restProj.length > 0 ? Math.round(6*sp) : 0 }}>
                        <Text style={{ fontFamily: f, fontWeight: 'bold', fontSize: base }}>{(firstProj.name || '') + (firstProj.link ? ' — ' + firstProj.link : '')}</Text>
                        <Text style={{ fontFamily: f, fontSize: base, color: '#444444' }}>{firstProj.description || ''}</Text>
                      </View>
                    </View>
                    {restProj.map((p, i) => (
                      <View key={i+1} wrap={false} style={{ marginBottom: i < restProj.length - 1 ? Math.round(6*sp) : 0 }}>
                        <Text style={{ fontFamily: f, fontWeight: 'bold', fontSize: base }}>{(p.name || '') + (p.link ? ' — ' + p.link : '')}</Text>
                        <Text style={{ fontFamily: f, fontSize: base, color: '#444444' }}>{p.description || ''}</Text>
                      </View>
                    ))}
                  </View>
                )
              }

              case 'additionalInfo': {
                if (!resumeData.additionalInfo?.length) return null
                const [firstInfo, ...restInfo] = resumeData.additionalInfo
                return (
                  <View key="additionalInfo" style={{ marginTop: Math.round(16*sp) }}>
                    <View wrap={false}>
                      <SH title={resumeData.sectionTitles?.additionalInfo || 'Additional Information'} />
                      <View style={{ marginBottom: Math.round(3*sp) }}>
                        <Text style={{ fontFamily: f, fontSize: base }}><Text style={{ fontWeight: 'bold' }}>{firstInfo.label || ''}</Text>{firstInfo.detail ? ' | ' + firstInfo.detail : ''}</Text>
                      </View>
                    </View>
                    {restInfo.map((item, i) => (
                      <View key={i+1} wrap={false} style={{ marginBottom: Math.round(3*sp) }}>
                        <Text style={{ fontFamily: f, fontSize: base }}><Text style={{ fontWeight: 'bold' }}>{item.label || ''}</Text>{item.detail ? ' | ' + item.detail : ''}</Text>
                      </View>
                    ))}
                  </View>
                )
              }

              case 'languages':
                if (!resumeData.languages?.length) return null
                return (
                  <View key="languages" style={{ marginTop: Math.round(16*sp) }}>
                    <View wrap={false}>
                      <SH title={resumeData.sectionTitles?.languages || 'Languages'} />
                      <Text style={{ fontFamily: f, fontSize: base, color: '#333333' }}>{resumeData.languages.map(l => `${l.language} (${l.proficiency})`).join(' \u2022 ')}</Text>
                    </View>
                  </View>
                )

              default:
                return null
            }
          })}

        </View>
      </Page>
    </Document>
  )
}