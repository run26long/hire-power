import React from 'react'
import { Document, Page, View, Text } from '@react-pdf/renderer'
import { formatDate, formatDateRange, getCertDetails, getSkillsDisplay, hexToRgba } from '../templateUtils'
import { groupExperience } from '../../utils/groupExperience'
import { groupEducation } from '../../utils/groupEducation'

export default function ResumePDFSignature({ resumeData, font = 'EB Garamond', fontSize = 11, spacing = 1, accentColor = '#5b4fcf', dateFormat = 'short' }) {
  if (!resumeData) return null
  const skills = getSkillsDisplay(resumeData)
  const base = fontSize
  const sp = spacing
  const color = accentColor
  const f = font === 'Arial' ? 'Helvetica' : (font || 'EB Garamond')
  const professionalTitle = resumeData.professionalTitle || resumeData.experience?.[0]?.title || ''

  const contactParts = [resumeData.location, resumeData.phone, resumeData.email, resumeData.linkedin, resumeData.portfolio].filter(Boolean)

  const SH = ({ title }) => (
    <View wrap={false} style={{ backgroundColor: hexToRgba(color, 0.133), paddingTop: Math.round(3*sp), paddingBottom: Math.round(3*sp), paddingLeft: Math.round(6*sp), paddingRight: Math.round(6*sp), marginBottom: Math.round(8*sp), alignItems: 'center' }}>
      <Text style={{ fontFamily: f, fontSize: base, fontWeight: 'bold', textTransform: 'uppercase', color: '#1a1a1a', textAlign: 'center' }}>{title}</Text>
    </View>
  )

  return (
    <Document hyphenationCallback={(w) => [w]}>
      <Page size="LETTER" style={{ fontFamily: f, fontSize: base, lineHeight: 1.2, color: '#1a1a1a', paddingTop: 36, paddingBottom: 36, paddingLeft: 43, paddingRight: 43, backgroundColor: '#ffffff' }}>

        {/* Page 2+ continuation header */}
        <View fixed style={{ position: 'absolute', top: 14, left: 43, right: 43 }} render={({ pageNumber }) => pageNumber > 1 ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: '#cccccc', paddingBottom: 4 }}>
            <Text style={{ fontFamily: f, fontSize: base - 2, color: '#888888', letterSpacing: 1 }}>{(resumeData.fullName || '').toUpperCase()}</Text>
            <Text style={{ fontFamily: f, fontSize: base - 2, color: '#888888' }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
          </View>
        ) : null} />

        {/* Header */}
        <View style={{ alignItems: 'center', paddingBottom: Math.round(10*sp), marginBottom: Math.round(4*sp) }}>
          <Text style={{ fontFamily: f, fontSize: 24, fontWeight: 'bold', textTransform: 'uppercase', color: '#1a1a1a', marginBottom: Math.round(16*sp) }}>{resumeData.fullName || ''}</Text>
          {professionalTitle ? <Text style={{ fontFamily: f, fontSize: base, color: color, marginBottom: Math.round(8*sp) }}>{professionalTitle}</Text> : null}
          <View style={{ borderBottomWidth: 1, borderBottomColor: '#cccccc', width: '100%', marginBottom: Math.round(8*sp) }} />
          <Text style={{ fontFamily: f, fontSize: base-1, color: '#555555', textAlign: 'center' }}>{contactParts.join(' | ')}</Text>
        </View>

        {resumeData.summary && !resumeData.hideSummary && (
          <View style={{ marginTop: Math.round(0*sp) }}>
            <SH title={resumeData.sectionTitles?.summary || 'Professional Summary'} />
            <Text style={{ fontFamily: f, fontSize: base, color: '#333333' }}>{resumeData.summary}</Text>
          </View>
        )}

        {(() => {
          const sectionOrder = resumeData.sectionOrder || ['experience', 'education', 'skills']

          const renderExperience = () => {
            if (!resumeData.experience?.length) return null
            const expGroups = groupExperience(resumeData.experience)
            if (!expGroups.length) return null

            const renderBullets = (job) => (job.bullets || []).map((b, k) => (
              <View key={k} wrap={false} style={{ flexDirection: 'row', marginBottom: Math.round(2*sp) }}>
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
                        <Text style={{ fontFamily: f, fontSize: base, color: '#555555' }}>{formatDateRange(job.startDate, job.endDate, job.current, dateFormat)}</Text>
                      </View>
                      <Text style={{ fontFamily: f, fontWeight: 'bold', fontSize: base, marginBottom: Math.round(4*sp) }}>{job.title || ''}</Text>
                      {hasSummary && <Text style={{ fontFamily: f, fontSize: base, color: '#444444', marginBottom: Math.round(3*sp) }}>{job.summary}</Text>}
                      {!hasSummary && bullets.length > 0 && (
                        <View style={{ flexDirection: 'row', marginBottom: Math.round(2*sp) }}>
                          <Text style={{ fontFamily: f, fontSize: base, width: 10 }}>{'\u2022 '}</Text>
                          <Text style={{ fontFamily: f, fontSize: base, flex: 1 }}>{bullets[0]}</Text>
                        </View>
                      )}
                    </View>
                    {(hasSummary ? bullets : bullets.slice(1)).map((b, k) => (
                      <View key={k} wrap={false} style={{ flexDirection: 'row', marginBottom: Math.round(2*sp) }}>
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
                      <Text style={{ fontFamily: f, fontSize: base, color: '#555555' }}>{formatDateRange(group.startDate, group.endDate, group.current, dateFormat)}</Text>
                    </View>
                    <View style={{ paddingLeft: 12 }}>
                      <Text style={{ fontFamily: f, fontSize: base }}>
                        <Text style={{ fontWeight: 'bold' }}>{group.roles[0].title || ''}</Text>
                        <Text style={{ color: '#555555' }}>{` (${formatDateRange(group.roles[0].startDate, group.roles[0].endDate, group.roles[0].current, dateFormat)})`}</Text>
                      </Text>
                      {group.roles[0].summary && !group.roles[0].summaryDismissed && <Text style={{ fontFamily: f, fontSize: base, color: '#444444', marginTop: Math.round(2*sp), marginBottom: Math.round(3*sp) }}>{group.roles[0].summary}</Text>}
                      {(() => {
                        const bullets = (group.roles[0].bullets || []).filter(b => (b || '').trim() && (b || '').trim() !== 'Describe what you did and the impact you made')
                        return bullets.length > 0 ? (
                          <View style={{ flexDirection: 'row', marginBottom: Math.round(2*sp) }}>
                            <Text style={{ fontFamily: f, fontSize: base, width: 10 }}>{'\u2022 '}</Text>
                            <Text style={{ fontFamily: f, fontSize: base, flex: 1 }}>{bullets[0]}</Text>
                          </View>
                        ) : null
                      })()}
                    </View>
                  </View>
                  {/* Remaining bullets for first role */}
                  {(() => {
                    const bullets = (group.roles[0].bullets || []).filter(b => (b || '').trim() && (b || '').trim() !== 'Describe what you did and the impact you made')
                    return bullets.slice(1).map((b, k) => (
                      <View key={`r0-b${k+1}`} wrap={false} style={{ paddingLeft: 12, flexDirection: 'row', marginBottom: Math.round(2*sp) }}>
                        <Text style={{ fontFamily: f, fontSize: base, width: 10 }}>{'\u2022 '}</Text>
                        <Text style={{ fontFamily: f, fontSize: base, flex: 1 }}>{b}</Text>
                      </View>
                    ))
                  })()}
                  {/* Remaining roles */}
                  {group.roles.slice(1).map((job, ri) => {
                    const bullets = (job.bullets || []).filter(b => (b || '').trim() && (b || '').trim() !== 'Describe what you did and the impact you made')
                    return (
                      <React.Fragment key={ri+1}>
                        <View wrap={false} style={{ paddingLeft: 12, marginTop: Math.round(6*sp) }}>
                          <Text style={{ fontFamily: f, fontSize: base }}>
                            <Text style={{ fontWeight: 'bold' }}>{job.title || ''}</Text>
                            <Text style={{ color: '#555555' }}>{` (${formatDateRange(job.startDate, job.endDate, job.current, dateFormat)})`}</Text>
                          </Text>
                          {job.summary && !job.summaryDismissed && <Text style={{ fontFamily: f, fontSize: base, color: '#444444', marginTop: Math.round(2*sp), marginBottom: Math.round(3*sp) }}>{job.summary}</Text>}
                          {bullets.length > 0 && (
                            <View style={{ flexDirection: 'row', marginBottom: Math.round(2*sp) }}>
                              <Text style={{ fontFamily: f, fontSize: base, width: 10 }}>{'\u2022 '}</Text>
                              <Text style={{ fontFamily: f, fontSize: base, flex: 1 }}>{bullets[0]}</Text>
                            </View>
                          )}
                        </View>
                        {bullets.slice(1).map((b, k) => (
                          <View key={k+1} wrap={false} style={{ paddingLeft: 12, flexDirection: 'row', marginBottom: Math.round(2*sp) }}>
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

            return (
              <View style={{ marginTop: Math.round(16*sp) }}>
                {expGroups.map((group, gi) => (
                  <View key={gi} style={{ marginBottom: gi < expGroups.length - 1 ? Math.round(12*sp) : 0 }}>
                    {gi === 0 && <SH title={resumeData.sectionTitles?.experience || 'Experience'} />}
                    {renderGroup(group)}
                  </View>
                ))}
              </View>
            )
          }

          const renderEducation = () => {
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

            return (
              <View style={{ marginTop: Math.round(16*sp) }}>
                <SH title="Education" />
                {eduGroups.map((group, gi) => (
                  <View key={gi} style={{ marginBottom: gi < eduGroups.length - 1 ? Math.round(12*sp) : 0 }}>
                    {renderEduGroup(group)}
                  </View>
                ))}
              </View>
            )
          }

          const renderSkills = () => {
            if (!Object.keys(skills).length) return null
            return (
              <View style={{ marginTop: Math.round(16*sp) }}>
                <SH title="Skills" />
                {Object.entries(skills).map(([cat, items]) => (
                  <View key={cat} style={{ marginBottom: Math.round(4*sp) }}>
                    {Object.keys(skills).length > 1
                      ? <Text style={{ fontFamily: f, fontSize: base }}><Text style={{ fontWeight: 'bold' }}>{cat + ': '}</Text><Text style={{ color: '#333333' }}>{items.join(' \u2022 ')}</Text></Text>
                      : <Text style={{ fontFamily: f, fontSize: base, color: '#333333' }}>{items.join(' \u2022 ')}</Text>
                    }
                  </View>
                ))}
              </View>
            )
          }

          const sectionMap = { experience: renderExperience, education: renderEducation, skills: renderSkills }

          return sectionOrder.map((section, i) => (
            <React.Fragment key={i}>{sectionMap[section] ? sectionMap[section]() : null}</React.Fragment>
          ))
        })()}

        {resumeData.certifications?.length > 0 && (
          <View style={{ marginTop: Math.round(16*sp) }}>
            <SH title="Certifications" />
            {resumeData.certifications.map((c, i) => (
              <View key={i} style={{ marginBottom: i < resumeData.certifications.length - 1 ? Math.round(6*sp) : 0 }}>
                <Text style={{ fontFamily: f, fontSize: base }}><Text style={{ fontWeight: 'bold' }}>{c.name || ''}</Text>{getCertDetails(c)}</Text>
              </View>
            ))}
          </View>
        )}

        {resumeData.volunteer?.length > 0 && (
          <View style={{ marginTop: Math.round(16*sp) }}>
            <SH title="Volunteer Experience" />
            {resumeData.volunteer.map((v, i) => (
              <View key={i} style={{ marginBottom: i < resumeData.volunteer.length - 1 ? Math.round(6*sp) : 0 }}>
                <Text style={{ fontFamily: f, fontWeight: 'bold', fontSize: base }}>{v.organization || ''}</Text>
                <Text style={{ fontFamily: f, fontSize: base, color: '#444444' }}>{v.description || ''}</Text>
              </View>
            ))}
          </View>
        )}

        {resumeData.projects?.length > 0 && (
          <View style={{ marginTop: Math.round(16*sp) }}>
            <SH title="Projects" />
            {resumeData.projects.map((p, i) => (
              <View key={i} style={{ marginBottom: i < resumeData.projects.length - 1 ? Math.round(6*sp) : 0 }}>
                <Text style={{ fontFamily: f, fontWeight: 'bold', fontSize: base }}>{(p.name || '') + (p.link ? ' | ' + p.link : '')}</Text>
                <Text style={{ fontFamily: f, fontSize: base, color: '#444444' }}>{p.description || ''}</Text>
              </View>
            ))}
          </View>
        )}

        {resumeData.additionalInfo?.length > 0 && (
          <View style={{ marginTop: Math.round(16*sp) }}>
            <SH title="Additional Information" />
            {resumeData.additionalInfo.map((item, i) => (
              <View key={i} style={{ marginBottom: Math.round(3*sp) }}>
                <Text style={{ fontFamily: f, fontSize: base }}><Text style={{ fontWeight: 'bold' }}>{item.label || ''}</Text>{item.detail ? ' | ' + item.detail : ''}</Text>
              </View>
            ))}
          </View>
        )}

        {resumeData.languages?.length > 0 && (
          <View style={{ marginTop: Math.round(16*sp) }}>
            <SH title="Languages" />
            <Text style={{ fontFamily: f, fontSize: base, color: '#333333' }}>{resumeData.languages.map(l => `${l.language} (${l.proficiency})`).join(' \u2022 ')}</Text>
          </View>
        )}

      </Page>
    </Document>
  )
}