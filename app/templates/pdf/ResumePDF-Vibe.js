import React from 'react'
import { Document, Page, View, Text } from '@react-pdf/renderer'
import { formatDate, formatDateRange, getSkillsDisplay } from '../templateUtils'

export default function ResumePDFVibe({ resumeData, font = 'Source Serif 4', fontSize = 11, spacing = 1, accentColor = '#5b4fcf', dateFormat = 'short' }) {
  if (!resumeData) return null
  const skills = getSkillsDisplay(resumeData)
  const base = fontSize
  const sp = spacing
  const f = font === 'Arial' ? 'Helvetica' : (font || 'Source Serif 4')
  const professionalTitle = resumeData.professionalTitle || resumeData.experience?.[0]?.title || ''

  const SH = ({ title }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: Math.round(18*sp), marginBottom: Math.round(8*sp) }}>
      <View style={{ flex: 1, borderBottomWidth: 1, borderBottomColor: '#aaaaaa' }} />
      <Text style={{ fontFamily: f, fontSize: base, fontWeight: 'bold', textTransform: 'uppercase', color: '#1a1a1a', marginLeft: 8, marginRight: 8 }}>{title}</Text>
      <View style={{ flex: 1, borderBottomWidth: 1, borderBottomColor: '#aaaaaa' }} />
    </View>
  )

  const contactRight = []
  if (resumeData.email) contactRight.push(resumeData.email)
  if (resumeData.phone && resumeData.location) contactRight.push(`${resumeData.phone} | ${resumeData.location}`)
  else {
    if (resumeData.phone) contactRight.push(resumeData.phone)
    if (resumeData.location) contactRight.push(resumeData.location)
  }
  if (resumeData.linkedin) contactRight.push(resumeData.linkedin)
  if (resumeData.portfolio) contactRight.push(resumeData.portfolio)

  return (
    <Document hyphenationCallback={(w) => [w]}>
      <Page size="LETTER" style={{ fontFamily: f, fontSize: base, lineHeight: 1.2, color: '#1a1a1a', paddingTop: 36, paddingBottom: 36, paddingLeft: 52, paddingRight: 52, backgroundColor: '#ffffff' }} wrap={false}>

        {/* Two-column header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Math.round(10*sp), paddingBottom: Math.round(8*sp) }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: f, fontSize: 24, fontWeight: 'bold', textTransform: 'uppercase', color: '#1a1a1a', marginBottom: Math.round(16*sp) }}>{resumeData.fullName || ''}</Text>
            {professionalTitle ? <Text style={{ fontFamily: f, fontSize: base, color: '#555555' }}>{professionalTitle}</Text> : null}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            {contactRight.map((line, i) => <Text key={i} style={{ fontFamily: f, fontSize: base, color: '#555555', lineHeight: 1.4 }}>{line}</Text>)}
          </View>
        </View>

        {resumeData.summary && !resumeData.hideSummary && (
          <View style={{ marginTop: 0 }}>
            <SH title={resumeData.sectionTitles?.summary || 'Professional Summary'} />
            <Text style={{ fontFamily: f, fontSize: base, color: '#333333' }}>{resumeData.summary}</Text>
          </View>
        )}

        {resumeData.experience?.length > 0 && (
          <View>
            <SH title="Work Experience" />
            {resumeData.experience.map((job, i) => (
              <View key={i} style={{ marginBottom: i < resumeData.experience.length - 1 ? Math.round(8*sp) : 0 }}>
                <Text style={{ fontFamily: f, fontWeight: 'bold', fontSize: base }}>{job.title || ''}</Text>
                <Text style={{ fontFamily: f, fontSize: base, color: '#555555', marginBottom: Math.round(2*sp) }}>{[job.company, job.location, formatDateRange(job.startDate, job.endDate, job.current, dateFormat)].filter(Boolean).join(' | ')}</Text>
                {job.summary && !job.summaryDismissed && <Text style={{ fontFamily: f, fontSize: base, color: '#333333', marginBottom: Math.round(2*sp) }}>{job.summary}</Text>}
                {job.bullets?.map((b, k) => (
                  <View key={k} style={{ flexDirection: 'row', marginBottom: Math.round(1*sp) }}>
                    <Text style={{ fontFamily: f, fontSize: base, width: 10 }}>{'\u2022 '}</Text>
                    <Text style={{ fontFamily: f, fontSize: base, flex: 1 }}>{b}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {resumeData.education?.length > 0 && (
          <View>
            <SH title="Education" />
            {resumeData.education.map((ed, i) => (
              <View key={i} style={{ marginBottom: i < resumeData.education.length - 1 ? Math.round(8*sp) : 0 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontFamily: f, fontWeight: 'bold', fontSize: base, flex: 1 }}>{ed.school || ''}</Text>
                  <Text style={{ fontFamily: f, fontSize: base, color: '#555555' }}>{formatDate(ed.graduationDate, dateFormat)}</Text>
                </View>
                <Text style={{ fontFamily: f, fontSize: base, color: '#555555' }}>{[ed.degree, ed.field].filter(Boolean).join(', ')}</Text>
                {ed.lines?.map((l, k) => <Text key={k} style={{ fontFamily: f, fontSize: base, color: '#333333' }}>{l}</Text>)}
              </View>
            ))}
          </View>
        )}

        {Object.keys(skills).length > 0 && (
          <View>
            <SH title="Skills" />
            {Object.entries(skills).map(([cat, items]) => (
              <View key={cat} style={{ marginBottom: Math.round(3*sp) }}>
                {Object.keys(skills).length > 1
                  ? <Text style={{ fontFamily: f, fontSize: base }}><Text style={{ fontWeight: 'bold' }}>{cat + ': '}</Text><Text style={{ color: '#333333' }}>{items.join(' \u2022 ')}</Text></Text>
                  : <Text style={{ fontFamily: f, fontSize: base, color: '#333333' }}>{items.join(' \u2022 ')}</Text>
                }
              </View>
            ))}
          </View>
        )}

        {resumeData.certifications?.length > 0 && (
          <View>
            <SH title="Certifications" />
            {resumeData.certifications.map((c, i) => (
              <View key={i} style={{ marginBottom: i < resumeData.certifications.length - 1 ? Math.round(6*sp) : 0 }}>
                <Text style={{ fontFamily: f, fontSize: base }}><Text style={{ fontWeight: 'bold' }}>{c.name || ''}</Text>{c.details ? ' | ' + c.details : ''}</Text>
              </View>
            ))}
          </View>
        )}

        {resumeData.volunteer?.length > 0 && (
          <View>
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
          <View>
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
          <View>
            <SH title="Additional Information" />
            {resumeData.additionalInfo.map((item, i) => (
              <View key={i} style={{ marginBottom: Math.round(3*sp) }}>
                <Text style={{ fontFamily: f, fontSize: base }}><Text style={{ fontWeight: 'bold' }}>{item.label || ''}</Text>{item.detail ? ' | ' + item.detail : ''}</Text>
              </View>
            ))}
          </View>
        )}

        {resumeData.languages?.length > 0 && (
          <View>
            <SH title="Languages" />
            <Text style={{ fontFamily: f, fontSize: base, color: '#333333' }}>{resumeData.languages.map(l => `${l.language} (${l.proficiency})`).join(' \u2022 ')}</Text>
          </View>
        )}

      </Page>
    </Document>
  )
}