import React from 'react'
import { Document, Page, View, Text } from '@react-pdf/renderer'
import { formatDate, formatDateRange, getSkillsDisplay } from '../templateUtils'

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
      <Page size="LETTER" style={{ fontFamily: f, fontSize: base, lineHeight: 1.3, color: '#1a1a1a', backgroundColor: '#ffffff', paddingTop: Math.round(20*sp), paddingBottom: Math.round(36*sp) }}>

        {/* Name block */}
        <View style={{ marginTop: -Math.round(20*sp), paddingTop: Math.round(30*sp), paddingLeft: Math.round(52*sp), paddingRight: Math.round(52*sp) }}>
          <Text style={{ fontFamily: f, fontSize: 22, fontWeight: 'bold', textTransform: 'uppercase', color: '#1a1a1a', marginBottom: Math.round(16*sp) }}>{resumeData.fullName || ''}</Text>
          {titleLine ? <Text style={{ fontFamily: f, fontSize: base+1, fontWeight: 'bold', color: color, marginBottom: Math.round(4*sp) }}>{titleLine}</Text> : null}
        </View>

        {/* Contact band */}
        <View style={{ backgroundColor: '#f0eeff', borderTopWidth: 2, borderTopColor: color, borderBottomWidth: 1, borderBottomColor: color, paddingTop: Math.round(6*sp), paddingBottom: Math.round(6*sp), paddingLeft: Math.round(52*sp), paddingRight: Math.round(52*sp), marginBottom: Math.round(8*sp) }}>
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
                const [firstJob, ...restJobs] = resumeData.experience
                return (
                  <View key="experience" style={{ marginTop: Math.round(16*sp) }}>
                    <View wrap={false}>
                      <SH title={resumeData.sectionTitles?.experience || 'Experience'} />
                      <View style={{ marginBottom: restJobs.length > 0 ? Math.round(10*sp) : 0 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontFamily: f, fontWeight: 'bold', fontSize: base, flex: 1 }}>{firstJob.title || ''}</Text>
                          <Text style={{ fontFamily: f, fontSize: base, color: '#666666', fontStyle: 'italic' }}>{formatDateRange(firstJob.startDate, firstJob.endDate, firstJob.current, dateFormat)}</Text>
                        </View>
                        <Text style={{ fontFamily: f, fontSize: base, color: '#555555', fontStyle: 'italic', marginBottom: Math.round(2*sp) }}>{[firstJob.company, firstJob.location].filter(Boolean).join(' | ')}</Text>
                        {firstJob.summary && !firstJob.summaryDismissed && <Text style={{ fontFamily: f, fontSize: base, color: '#333333', marginBottom: Math.round(2*sp) }}>{firstJob.summary}</Text>}
                        {firstJob.bullets?.map((b, k) => (
                          <View key={k} wrap={false} style={{ flexDirection: 'row', marginBottom: Math.round(1*sp) }}>
                            <Text style={{ fontFamily: f, fontSize: base, width: 10 }}>{'\u2022 '}</Text>
                            <Text style={{ fontFamily: f, fontSize: base, flex: 1 }}>{b}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                    {restJobs.map((job, i) => (
                      <View key={i+1} style={{ marginBottom: i < restJobs.length - 1 ? Math.round(10*sp) : 0 }}>
                        <View wrap={false}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontFamily: f, fontWeight: 'bold', fontSize: base, flex: 1 }}>{job.title || ''}</Text>
                            <Text style={{ fontFamily: f, fontSize: base, color: '#666666', fontStyle: 'italic' }}>{formatDateRange(job.startDate, job.endDate, job.current, dateFormat)}</Text>
                          </View>
                          <Text style={{ fontFamily: f, fontSize: base, color: '#555555', fontStyle: 'italic', marginBottom: Math.round(2*sp) }}>{[job.company, job.location].filter(Boolean).join(' | ')}</Text>
                          {job.summary && !job.summaryDismissed && <Text style={{ fontFamily: f, fontSize: base, color: '#333333', marginBottom: Math.round(2*sp) }}>{job.summary}</Text>}
                        </View>
                        {job.bullets?.map((b, k) => (
                          <View key={k} wrap={false} style={{ flexDirection: 'row', marginBottom: Math.round(1*sp) }}>
                            <Text style={{ fontFamily: f, fontSize: base, width: 10 }}>{'\u2022 '}</Text>
                            <Text style={{ fontFamily: f, fontSize: base, flex: 1 }}>{b}</Text>
                          </View>
                        ))}
                      </View>
                    ))}
                  </View>
                )
              }

              case 'education': {
                if (!resumeData.education?.length) return null
                const [firstEd, ...restEd] = resumeData.education
                return (
                  <View key="education" style={{ marginTop: Math.round(16*sp) }}>
                    <View wrap={false}>
                      <SH title={resumeData.sectionTitles?.education || 'Education'} />
                      <View style={{ marginBottom: restEd.length > 0 ? Math.round(10*sp) : 0 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontFamily: f, fontWeight: 'bold', fontSize: base, flex: 1 }}>{firstEd.school || ''}</Text>
                          <Text style={{ fontFamily: f, fontSize: base, color: '#666666', fontStyle: 'italic' }}>{formatDate(firstEd.graduationDate, dateFormat)}</Text>
                        </View>
                        <Text style={{ fontFamily: f, fontSize: base, color: '#555555', fontStyle: 'italic' }}>{[firstEd.degree, firstEd.field].filter(Boolean).join(', ')}</Text>
                        {firstEd.lines?.map((l, k) => <Text key={k} style={{ fontFamily: f, fontSize: base, color: '#333333' }}>{l}</Text>)}
                      </View>
                    </View>
                    {restEd.map((ed, i) => (
                      <View key={i+1} wrap={false} style={{ marginBottom: i < restEd.length - 1 ? Math.round(10*sp) : 0 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontFamily: f, fontWeight: 'bold', fontSize: base, flex: 1 }}>{ed.school || ''}</Text>
                          <Text style={{ fontFamily: f, fontSize: base, color: '#666666', fontStyle: 'italic' }}>{formatDate(ed.graduationDate, dateFormat)}</Text>
                        </View>
                        <Text style={{ fontFamily: f, fontSize: base, color: '#555555', fontStyle: 'italic' }}>{[ed.degree, ed.field].filter(Boolean).join(', ')}</Text>
                        {ed.lines?.map((l, k) => <Text key={k} style={{ fontFamily: f, fontSize: base, color: '#333333' }}>{l}</Text>)}
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