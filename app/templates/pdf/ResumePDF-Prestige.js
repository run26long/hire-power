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
  const titleLine = resumeData.experience?.[0]?.title || ''

  const contactParts = [resumeData.location, resumeData.phone, resumeData.email, resumeData.linkedin, resumeData.portfolio].filter(Boolean)

  const SH = ({ title }) => (
    <View>
      <Text style={{ fontFamily: f, fontSize: base, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0, color: '#1a1a1a', marginBottom: Math.round(2*sp) }}>{title}</Text>
      <View style={{ borderBottomWidth: 1, borderBottomColor: color, marginBottom: Math.round(5*sp) }} />
    </View>
  )

  return (
    <Document hyphenationCallback={(w) => [w]}>
      <Page size="LETTER" style={{ fontFamily: f, fontSize: base, lineHeight: 1.3, color: '#1a1a1a', backgroundColor: '#ffffff' }}>

        {/* Name block */}
        <View style={{ paddingTop: Math.round(30*sp), paddingLeft: Math.round(52*sp), paddingRight: Math.round(52*sp) }}>
          <Text style={{ fontFamily: f, fontSize: 22, fontWeight: 'bold', textTransform: 'uppercase', color: '#1a1a1a', marginBottom: Math.round(16*sp) }}>{resumeData.fullName || ''}</Text>
          {titleLine ? <Text style={{ fontFamily: f, fontSize: base+1, fontWeight: 'bold', color: color, marginBottom: Math.round(4*sp) }}>{titleLine}</Text> : null}
        </View>

        {/* Contact band */}
        <View style={{ backgroundColor: '#f0eeff', borderTopWidth: 2, borderTopColor: color, borderBottomWidth: 1, borderBottomColor: color, paddingTop: Math.round(6*sp), paddingBottom: Math.round(6*sp), paddingLeft: Math.round(52*sp), paddingRight: Math.round(52*sp), marginBottom: Math.round(8*sp) }}>
          <Text style={{ fontFamily: f, fontSize: base, color: '#444444' }}>{contactParts.join('  |  ')}</Text>
        </View>

        {/* Body */}
        <View style={{ paddingLeft: Math.round(52*sp), paddingRight: Math.round(52*sp), paddingBottom: Math.round(36*sp) }}>

          {resumeData.summary && !resumeData.hideSummary && (
            <View style={{ marginTop: Math.round(8*sp) }}>
              <SH title={resumeData.sectionTitles?.summary || 'Professional Summary'} />
              <Text style={{ fontFamily: f, fontSize: base, color: '#333333' }}>{resumeData.summary}</Text>
            </View>
          )}

          {resumeData.experience?.length > 0 && (
            <View style={{ marginTop: Math.round(16*sp) }}>
              <SH title="Experience" />
              {resumeData.experience.map((job, i) => (
                <View key={i} style={{ marginBottom: i < resumeData.experience.length - 1 ? Math.round(10*sp) : 0 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontFamily: f, fontWeight: 'bold', fontSize: base, flex: 1 }}>{job.title || ''}</Text>
                    <Text style={{ fontFamily: f, fontSize: base, color: '#666666', fontStyle: 'italic' }}>{formatDateRange(job.startDate, job.endDate, job.current, dateFormat)}</Text>
                  </View>
                  <Text style={{ fontFamily: f, fontSize: base, color: '#555555', fontStyle: 'italic', marginBottom: Math.round(2*sp) }}>{[job.company, job.location].filter(Boolean).join(' | ')}</Text>
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
            <View style={{ marginTop: Math.round(16*sp) }}>
              <SH title="Education" />
              {resumeData.education.map((ed, i) => (
                <View key={i} style={{ marginBottom: i < resumeData.education.length - 1 ? Math.round(10*sp) : 0 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontFamily: f, fontWeight: 'bold', fontSize: base, flex: 1 }}>{ed.school || ''}</Text>
                    <Text style={{ fontFamily: f, fontSize: base, color: '#666666', fontStyle: 'italic' }}>{formatDate(ed.graduationDate, dateFormat)}</Text>
                  </View>
                  <Text style={{ fontFamily: f, fontSize: base, color: '#555555', fontStyle: 'italic' }}>{[ed.degree, ed.field].filter(Boolean).join(', ')}</Text>
                  {ed.lines?.map((l, k) => <Text key={k} style={{ fontFamily: f, fontSize: base, color: '#333333' }}>{l}</Text>)}
                </View>
              ))}
            </View>
          )}

          {Object.keys(skills).length > 0 && (
            <View style={{ marginTop: Math.round(16*sp) }}>
              <SH title="Skills" />
              {Object.entries(skills).map(([cat, items]) => (
                <View key={cat} style={{ marginBottom: Math.round(3*sp) }}>
                  {Object.keys(skills).length > 1
                    ? <Text style={{ fontFamily: f, fontSize: base }}><Text style={{ fontWeight: 'bold', color: '#1a1a1a' }}>{cat + ': '}</Text><Text style={{ color: '#444444' }}>{items.join(' \u2022 ')}</Text></Text>
                    : <Text style={{ fontFamily: f, fontSize: base, color: '#444444' }}>{items.join(' \u2022 ')}</Text>
                  }
                </View>
              ))}
            </View>
          )}

          {resumeData.certifications?.length > 0 && (
            <View style={{ marginTop: Math.round(16*sp) }}>
              <SH title="Certifications" />
              {resumeData.certifications.map((c, i) => (
                <View key={i} style={{ marginBottom: i < resumeData.certifications.length - 1 ? Math.round(6*sp) : 0 }}>
                  <Text style={{ fontFamily: f, fontSize: base }}><Text style={{ fontWeight: 'bold' }}>{c.name || ''}</Text>{c.details ? ' | ' + c.details : ''}</Text>
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
                  <Text style={{ fontFamily: f, fontWeight: 'bold', fontSize: base }}>{(p.name || '') + (p.link ? ' — ' + p.link : '')}</Text>
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

        </View>
      </Page>
    </Document>
  )
}