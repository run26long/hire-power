import React from 'react'
import { Document, Page, View, Text } from '@react-pdf/renderer'
import { formatDate, formatDateRange, getSkillsDisplay } from '../templateUtils'

export default function ResumePDFEdge({ resumeData, font = 'Open Sans', fontSize = 11, spacing = 1, accentColor = '#5b4fcf', dateFormat = 'short' }) {
  if (!resumeData) return null
  const skills = getSkillsDisplay(resumeData)
  const base = fontSize
  const sp = spacing
  const color = accentColor
  const f = font === 'Arial' ? 'Helvetica' : (font || 'Open Sans')
  const professionalTitle = resumeData.professionalTitle || resumeData.experience?.[0]?.title || ''

  const contactParts = [resumeData.phone, resumeData.email, resumeData.location, resumeData.linkedin, resumeData.portfolio].filter(Boolean)

  const SH = ({ title, first = false }) => (
    <View style={{ backgroundColor: color + '33', borderRadius: 20, paddingTop: Math.round(3*sp), paddingBottom: Math.round(3*sp), paddingLeft: Math.round(10*sp), paddingRight: Math.round(10*sp), marginTop: first ? 0 : Math.round(12*sp), marginBottom: Math.round(6*sp), alignItems: 'center' }}>
      <Text style={{ fontFamily: f, fontSize: base, fontWeight: 'bold', textTransform: 'uppercase', fontStyle: 'italic', color: '#1a1a1a', textAlign: 'center' }}>{title}</Text>
    </View>
  )

  return (
    <Document hyphenationCallback={(w) => [w]}>
      <Page size="LETTER" style={{ fontFamily: f, fontSize: base, lineHeight: 1.2, color: '#1a1a1a', paddingTop: 36, paddingBottom: 36, paddingLeft: 52, paddingRight: 52, backgroundColor: '#ffffff' }}>

        <View style={{ alignItems: 'center', marginBottom: Math.round(14*sp) }}>
          <Text style={{ fontFamily: f, fontSize: 22, fontWeight: 'bold', textTransform: 'uppercase', color: '#1a1a1a', marginBottom: Math.round(16*sp) }}>{resumeData.fullName || ''}</Text>
          {professionalTitle ? <Text style={{ fontFamily: f, fontSize: base, fontWeight: 'bold', textTransform: 'uppercase', color: '#1a1a1a', marginBottom: Math.round(4*sp) }}>{professionalTitle}</Text> : null}
          <Text style={{ fontFamily: f, fontSize: base, color: '#555555' }}>{contactParts.join(' | ')}</Text>
        </View>

        {resumeData.summary && !resumeData.hideSummary && (
          <View>
            <SH title={resumeData.sectionTitles?.summary || 'Summary'} first={true} />
            <View style={{ paddingLeft: Math.round(10*sp), paddingRight: Math.round(10*sp) }}>
              <Text style={{ fontFamily: f, fontSize: base, color: '#333333' }}>{resumeData.summary}</Text>
            </View>
          </View>
        )}

        {Object.keys(skills).length > 0 && (
          <View>
            <SH title="Skills" />
            <View style={{ paddingLeft: Math.round(10*sp), paddingRight: Math.round(10*sp) }}>
              {Object.entries(skills).map(([cat, items]) => (
                <View key={cat} style={{ marginBottom: Math.round(3*sp) }}>
                  {Object.keys(skills).length > 1
                    ? <Text style={{ fontFamily: f, fontSize: base }}><Text style={{ fontWeight: 'bold' }}>{cat + ': '}</Text><Text style={{ color: '#333333' }}>{items.join(' \u2022 ')}</Text></Text>
                    : <Text style={{ fontFamily: f, fontSize: base, color: '#333333' }}>{items.join(' \u2022 ')}</Text>
                  }
                </View>
              ))}
            </View>
          </View>
        )}

        {resumeData.experience?.length > 0 && (
          <View>
            <SH title="Professional Experience" />
            <View style={{ paddingLeft: Math.round(10*sp), paddingRight: Math.round(10*sp) }}>
              {resumeData.experience.map((job, i) => (
                <View key={i} style={{ marginBottom: i < resumeData.experience.length - 1 ? Math.round(8*sp) : 0 }}>
                  <Text style={{ fontFamily: f, fontWeight: 'bold', fontSize: base }}>{job.title || ''}</Text>
                  <Text style={{ fontFamily: f, fontSize: base, color: '#555555', marginBottom: Math.round(2*sp) }}>{[job.company, job.location, formatDateRange(job.startDate, job.endDate, job.current, dateFormat)].filter(Boolean).join(' | ')}</Text>
                  {job.summary && !job.summaryDismissed && <Text style={{ fontFamily: f, fontSize: base, color: '#444444', marginBottom: Math.round(2*sp) }}>{job.summary}</Text>}
                  {job.bullets?.map((b, k) => (
                    <View key={k} style={{ flexDirection: 'row', marginBottom: Math.round(1*sp) }}>
                      <Text style={{ fontFamily: f, fontSize: base, width: 10 }}>{'\u2022 '}</Text>
                      <Text style={{ fontFamily: f, fontSize: base, flex: 1 }}>{b}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </View>
        )}

        {resumeData.education?.length > 0 && (
          <View>
            <SH title="Education" />
            <View style={{ paddingLeft: Math.round(10*sp), paddingRight: Math.round(10*sp) }}>
              {resumeData.education.map((ed, i) => (
                <View key={i} style={{ marginBottom: i < resumeData.education.length - 1 ? Math.round(8*sp) : 0 }}>
                  {[ed.degree, ed.field].filter(Boolean).length > 0 ? (
                    <>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: Math.round(1*sp) }}>
                        <Text style={{ fontFamily: f, fontWeight: 'bold', fontSize: base, flex: 1 }}>{[ed.degree, ed.field].filter(Boolean).join(', ')}</Text>
                        <Text style={{ fontFamily: f, fontSize: base, fontWeight: 'bold', color: '#1a1a1a' }}>{formatDate(ed.graduationDate, dateFormat)}</Text>
                      </View>
                      <Text style={{ fontFamily: f, fontSize: base, color: '#555555' }}>{ed.school || ''}</Text>
                    </>
                  ) : (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: Math.round(1*sp) }}>
                      <Text style={{ fontFamily: f, fontWeight: 'bold', fontSize: base, flex: 1 }}>{ed.school || ''}</Text>
                      <Text style={{ fontFamily: f, fontSize: base, fontWeight: 'bold', color: '#1a1a1a' }}>{formatDate(ed.graduationDate, dateFormat)}</Text>
                    </View>
                  )}
                  {ed.lines?.map((l, k) => <Text key={k} style={{ fontFamily: f, fontSize: base, color: '#333333' }}>{l}</Text>)}
                </View>
              ))}
            </View>
          </View>
        )}

        {resumeData.certifications?.length > 0 && (
          <View>
            <SH title="Certifications" />
            <View style={{ paddingLeft: Math.round(10*sp), paddingRight: Math.round(10*sp) }}>
              {resumeData.certifications.map((c, i) => (
                <View key={i} style={{ marginBottom: i < resumeData.certifications.length - 1 ? Math.round(6*sp) : 0 }}>
                  <Text style={{ fontFamily: f, fontSize: base }}><Text style={{ fontWeight: 'bold' }}>{c.name || ''}</Text>{c.details ? ' | ' + c.details : ''}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {resumeData.volunteer?.length > 0 && (
          <View>
            <SH title="Volunteer Experience" />
            <View style={{ paddingLeft: Math.round(10*sp), paddingRight: Math.round(10*sp) }}>
              {resumeData.volunteer.map((v, i) => (
                <View key={i} style={{ marginBottom: i < resumeData.volunteer.length - 1 ? Math.round(6*sp) : 0 }}>
                  <Text style={{ fontFamily: f, fontWeight: 'bold', fontSize: base }}>{v.organization || ''}</Text>
                  <Text style={{ fontFamily: f, fontSize: base, color: '#444444' }}>{v.description || ''}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {resumeData.projects?.length > 0 && (
          <View>
            <SH title="Projects" />
            <View style={{ paddingLeft: Math.round(10*sp), paddingRight: Math.round(10*sp) }}>
              {resumeData.projects.map((p, i) => (
                <View key={i} style={{ marginBottom: i < resumeData.projects.length - 1 ? Math.round(6*sp) : 0 }}>
                  <Text style={{ fontFamily: f, fontWeight: 'bold', fontSize: base }}>{(p.name || '') + (p.link ? ' | ' + p.link : '')}</Text>
                  <Text style={{ fontFamily: f, fontSize: base, color: '#444444' }}>{p.description || ''}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {resumeData.additionalInfo?.length > 0 && (
          <View>
            <SH title="Additional Information" />
            <View style={{ paddingLeft: Math.round(10*sp), paddingRight: Math.round(10*sp) }}>
              {resumeData.additionalInfo.map((item, i) => (
                <View key={i} style={{ flexDirection: 'row', marginBottom: Math.round(3*sp) }}>
                  <Text style={{ fontFamily: f, fontSize: base, width: 10 }}>{'\u2022 '}</Text>
                  <Text style={{ fontFamily: f, fontSize: base, flex: 1 }}><Text style={{ fontWeight: 'bold' }}>{item.label || ''}</Text>{item.detail ? ' | ' + item.detail : ''}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {resumeData.languages?.length > 0 && (
          <View>
            <SH title="Languages" />
            <View style={{ paddingLeft: Math.round(10*sp), paddingRight: Math.round(10*sp) }}>
              <Text style={{ fontFamily: f, fontSize: base, color: '#333333' }}>{resumeData.languages.map(l => `${l.language} (${l.proficiency})`).join(' \u2022 ')}</Text>
            </View>
          </View>
        )}

      </Page>
    </Document>
  )
}