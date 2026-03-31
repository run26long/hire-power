import React from 'react'
import { Document, Page, View, Text } from '@react-pdf/renderer'
import { formatDate, formatDateRange, getSkillsDisplay } from '../templateUtils'

export default function ResumePDFCrisp({ resumeData, font = 'Source Serif 4', fontSize = 11, spacing = 1, accentColor = '#5b4fcf', dateFormat = 'short' }) {
  if (!resumeData) return null
  const skills = getSkillsDisplay(resumeData)
  const base = fontSize
  const sp = spacing
  const f = font === 'Arial' ? 'Helvetica' : (font || 'Source Serif 4')

  const contactParts = [resumeData.location, resumeData.phone, resumeData.email, resumeData.linkedin, resumeData.portfolio].filter(Boolean)

  const SH = ({ title }) => (
    <View>
      <Text style={{ fontFamily: f, fontSize: base+1, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: Math.round(2*sp) }}>{title}</Text>
      <View style={{ borderBottomWidth: 1.5, borderBottomColor: '#1a1a1a', marginBottom: Math.round(4*sp) }} />
    </View>
  )

  return (
    <Document hyphenationCallback={(w) => [w]}>
      <Page size="LETTER" style={{ fontFamily: f, fontSize: base, lineHeight: 1.2, color: '#1a1a1a', paddingTop: 36, paddingBottom: 36, paddingLeft: 43, paddingRight: 43, backgroundColor: '#ffffff' }}>

        <Text style={{ fontFamily: f, fontSize: 20, fontWeight: 'bold', textTransform: 'uppercase', textAlign: 'center', marginBottom: Math.round(13*sp) }}>{resumeData.fullName || ''}</Text>
        <Text style={{ fontFamily: f, fontSize: base, color: '#444444', textAlign: 'center', marginBottom: Math.round(5*sp) }}>{contactParts.join(' \u2022 ')}</Text>

        {resumeData.summary && !resumeData.hideSummary && (
          <View style={{ marginTop: Math.round(6*sp) }}>
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
                <View key="experience" style={{ marginTop: Math.round(14*sp) }}>
                  <View wrap={false}>
                    <SH title={resumeData.sectionTitles?.experience || 'Experience'} />
                    <View style={{ marginBottom: restJobs.length > 0 ? Math.round(7*sp) : 0 }}>
                      <View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontFamily: f, fontWeight: 'bold', fontSize: base, flex: 1 }}>{firstJob.title || ''}</Text>
                          <Text style={{ fontFamily: f, fontSize: base, color: '#555555' }}>{formatDateRange(firstJob.startDate, firstJob.endDate, firstJob.current, dateFormat)}</Text>
                        </View>
                        <Text style={{ fontFamily: f, fontSize: base, fontStyle: 'italic', color: '#555555', marginBottom: Math.round(2*sp) }}>{[firstJob.company, firstJob.location].filter(Boolean).join(' | ')}</Text>
                        {firstJob.summary && !firstJob.summaryDismissed && <Text style={{ fontFamily: f, fontSize: base, color: '#444444', marginBottom: Math.round(2*sp) }}>{firstJob.summary}</Text>}
                      </View>
                      {firstJob.bullets?.map((b, k) => (
                        <View key={k} wrap={false} style={{ flexDirection: 'row', marginBottom: Math.round(1*sp) }}>
                          <Text style={{ fontFamily: f, fontSize: base, width: 10 }}>{'\u2022 '}</Text>
                          <Text style={{ fontFamily: f, fontSize: base, flex: 1 }}>{(b || '').trim()}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  {restJobs.map((job, i) => (
                    <View key={i+1} style={{ marginBottom: i < restJobs.length - 1 ? Math.round(7*sp) : 0 }}>
                      <View wrap={false}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontFamily: f, fontWeight: 'bold', fontSize: base, flex: 1 }}>{job.title || ''}</Text>
                          <Text style={{ fontFamily: f, fontSize: base, color: '#555555' }}>{formatDateRange(job.startDate, job.endDate, job.current, dateFormat)}</Text>
                        </View>
                        <Text style={{ fontFamily: f, fontSize: base, fontStyle: 'italic', color: '#555555', marginBottom: Math.round(2*sp) }}>{[job.company, job.location].filter(Boolean).join(' | ')}</Text>
                        {job.summary && !job.summaryDismissed && <Text style={{ fontFamily: f, fontSize: base, color: '#444444', marginBottom: Math.round(2*sp) }}>{job.summary}</Text>}
                      </View>
                      {job.bullets?.map((b, k) => (
                        <View key={k} wrap={false} style={{ flexDirection: 'row', marginBottom: Math.round(1*sp) }}>
                          <Text style={{ fontFamily: f, fontSize: base, width: 10 }}>{'\u2022 '}</Text>
                          <Text style={{ fontFamily: f, fontSize: base, flex: 1 }}>{(b || '').trim()}</Text>
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
                <View key="education" style={{ marginTop: Math.round(14*sp) }}>
                  <View wrap={false}>
                    <SH title={resumeData.sectionTitles?.education || 'Education'} />
                    <View style={{ marginBottom: restEd.length > 0 ? Math.round(10*sp) : 0 }}>
                      <View style={{ flexDirection: 'column' }}>
                        <Text style={{ fontFamily: f, fontWeight: 'bold', fontSize: base }}>{firstEd.school || ''}</Text>
                        <Text style={{ fontFamily: f, fontSize: base, fontStyle: 'italic', color: '#555555' }}>{[[firstEd.degree, firstEd.field].filter(Boolean).join(', '), firstEd.graduationDate ? formatDate(firstEd.graduationDate, dateFormat) : null].filter(Boolean).join(' | ')}</Text>
                      </View>
                      {firstEd.lines?.filter(l => {
                        const ll = (l || '').toLowerCase()
                        const dl = (firstEd.degree || '').toLowerCase()
                        const fl = (firstEd.field || '').toLowerCase()
                        return !(dl && ll.includes(dl)) && !(fl && ll.includes(fl))
                      }).map((l, k) => <Text key={k} style={{ fontFamily: f, fontSize: base, color: '#333333' }}>{l}</Text>)}
                    </View>
                  </View>
                  {restEd.map((ed, i) => (
                    <View key={i+1} wrap={false} style={{ marginBottom: i < restEd.length - 1 ? Math.round(10*sp) : 0 }}>
                      <View style={{ flexDirection: 'column' }}>
                        <Text style={{ fontFamily: f, fontWeight: 'bold', fontSize: base }}>{ed.school || ''}</Text>
                        <Text style={{ fontFamily: f, fontSize: base, fontStyle: 'italic', color: '#555555' }}>{[[ed.degree, ed.field].filter(Boolean).join(', '), ed.graduationDate ? formatDate(ed.graduationDate, dateFormat) : null].filter(Boolean).join(' | ')}</Text>
                      </View>
                      {ed.lines?.filter(l => {
                        const ll = (l || '').toLowerCase()
                        const dl = (ed.degree || '').toLowerCase()
                        const fl = (ed.field || '').toLowerCase()
                        return !(dl && ll.includes(dl)) && !(fl && ll.includes(fl))
                      }).map((l, k) => <Text key={k} style={{ fontFamily: f, fontSize: base, color: '#333333' }}>{l}</Text>)}
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
                <View key="skills" style={{ marginTop: Math.round(14*sp) }}>
                  <View wrap={false}>
                    <SH title={resumeData.sectionTitles?.skills || 'Skills'} />
                    <View style={{ marginBottom: Math.round(3*sp) }}>
                      {Object.keys(skills).length > 1
                        ? <Text style={{ fontFamily: f, fontSize: base }}><Text style={{ fontWeight: 'bold' }}>{firstSkill[0] + ': '}</Text><Text style={{ color: '#333333' }}>{firstSkill[1].join(' \u2022 ')}</Text></Text>
                        : <Text style={{ fontFamily: f, fontSize: base, color: '#333333' }}>{firstSkill[1].join(' \u2022 ')}</Text>
                      }
                    </View>
                  </View>
                  {restSkills.map(([cat, items]) => (
                    <View key={cat} wrap={false} style={{ marginBottom: Math.round(3*sp) }}>
                      <Text style={{ fontFamily: f, fontSize: base }}><Text style={{ fontWeight: 'bold' }}>{cat + ': '}</Text><Text style={{ color: '#333333' }}>{items.join(' \u2022 ')}</Text></Text>
                    </View>
                  ))}
                </View>
              )
            }

            case 'certifications': {
              if (!resumeData.certifications?.length) return null
              const [firstCert, ...restCerts] = resumeData.certifications
              return (
                <View key="certifications" style={{ marginTop: Math.round(14*sp) }}>
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
                <View key="volunteer" style={{ marginTop: Math.round(14*sp) }}>
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
                <View key="projects" style={{ marginTop: Math.round(14*sp) }}>
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
                <View key="additionalInfo" style={{ marginTop: Math.round(14*sp) }}>
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
                <View key="languages" style={{ marginTop: Math.round(14*sp) }}>
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

      </Page>
    </Document>
  )
}