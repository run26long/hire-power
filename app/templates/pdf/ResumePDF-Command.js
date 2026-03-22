import React from 'react'
import { Document, Page, View, Text } from '@react-pdf/renderer'
import { formatDate, formatDateRange, getSkillsDisplay } from '../templateUtils'

export default function ResumePDFCommand({ resumeData, font = 'Lato', fontSize = 11, spacing = 1, accentColor = '#5b4fcf', dateFormat = 'short' }) {
  if (!resumeData) return null
  const skills = getSkillsDisplay(resumeData)
  const base = fontSize
  const sp = spacing
  const color = accentColor
  const f = font === 'Arial' ? 'Helvetica' : (font || 'Lato')

  const contactParts = [resumeData.phone, resumeData.email, resumeData.location, resumeData.linkedin, resumeData.portfolio].filter(Boolean)

  return (
    <Document hyphenationCallback={(w) => [w]}>
      <Page size="LETTER" style={{ fontFamily: f, fontSize: base, lineHeight: 1.3, color: '#1a1a1a', backgroundColor: '#ffffff' }}>

        {/* Color header */}
        <View style={{ backgroundColor: color, paddingTop: Math.round(24*sp), paddingBottom: Math.round(18*sp), paddingLeft: Math.round(52*sp), paddingRight: Math.round(52*sp) }}>
          <Text style={{ fontFamily: f, fontSize: 22, fontWeight: 'bold', color: '#ffffff', marginBottom: Math.round(16*sp) }}>{resumeData.fullName || ''}</Text>
          <Text style={{ fontFamily: f, fontSize: base, color: 'rgba(255,255,255,0.9)' }}>{contactParts.join(' | ')}</Text>
        </View>

        {/* Body */}
        <View style={{ paddingLeft: Math.round(52*sp), paddingRight: Math.round(52*sp), paddingTop: Math.round(16*sp), paddingBottom: Math.round(36*sp) }}>

          {resumeData.summary && !resumeData.hideSummary && (
            <View style={{ marginTop: 0 }}>
              <Text style={{ fontFamily: f, fontSize: base+1, fontWeight: 'bold', textTransform: 'uppercase', color: color, borderBottomWidth: 2, borderBottomColor: color, paddingBottom: Math.round(2*sp), marginBottom: Math.round(5*sp) }}>{resumeData.sectionTitles?.summary || 'Professional Summary'}</Text>
              <Text style={{ fontFamily: f, fontSize: base, color: '#333333' }}>{resumeData.summary}</Text>
            </View>
          )}

          {resumeData.experience?.length > 0 && (
            <View style={{ marginTop: Math.round(14*sp) }}>
              <Text wrap={false} style={{ fontFamily: f, fontSize: base+1, fontWeight: 'bold', textTransform: 'uppercase', color: color, borderBottomWidth: 2, borderBottomColor: color, paddingBottom: Math.round(2*sp), marginBottom: Math.round(5*sp) }}>Experience</Text>
              {resumeData.experience.map((job, i) => (
                <View key={i} wrap={false} style={{ marginBottom: i < resumeData.experience.length - 1 ? Math.round(10*sp) : 0 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontFamily: f, fontWeight: 'bold', fontSize: base, flex: 1 }}>{job.title || ''}</Text>
                    <Text style={{ fontFamily: f, fontSize: base, color: '#666666' }}>{formatDateRange(job.startDate, job.endDate, job.current, dateFormat)}</Text>
                  </View>
                  <Text style={{ fontFamily: f, fontSize: base, color: '#555555', marginBottom: Math.round(2*sp) }}>{[job.company, job.location].filter(Boolean).join(' | ')}</Text>
                  {job.summary && !job.summaryDismissed && <Text style={{ fontFamily: f, fontSize: base, color: '#444444', fontStyle: 'italic', marginBottom: Math.round(2*sp) }}>{job.summary}</Text>}
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
            <View style={{ marginTop: Math.round(14*sp) }}>
              <Text wrap={false} style={{ fontFamily: f, fontSize: base+1, fontWeight: 'bold', textTransform: 'uppercase', color: color, borderBottomWidth: 2, borderBottomColor: color, paddingBottom: Math.round(2*sp), marginBottom: Math.round(5*sp) }}>Education</Text>
              {resumeData.education.map((ed, i) => (
                <View key={i} wrap={false} style={{ marginBottom: i < resumeData.education.length - 1 ? Math.round(10*sp) : 0 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontFamily: f, fontWeight: 'bold', fontSize: base, flex: 1 }}>{ed.school || ''}</Text>
                    <Text style={{ fontFamily: f, fontSize: base, color: '#666666' }}>{formatDate(ed.graduationDate, dateFormat)}</Text>
                  </View>
                  <Text style={{ fontFamily: f, fontSize: base, color: '#555555' }}>{[ed.degree, ed.field].filter(Boolean).join(', ')}</Text>
                  {ed.lines?.map((l, k) => <Text key={k} style={{ fontFamily: f, fontSize: base, color: '#333333' }}>{l}</Text>)}
                </View>
              ))}
            </View>
          )}

          {Object.keys(skills).length > 0 && (
            <View style={{ marginTop: Math.round(14*sp) }}>
              <Text wrap={false} style={{ fontFamily: f, fontSize: base+1, fontWeight: 'bold', textTransform: 'uppercase', color: color, borderBottomWidth: 2, borderBottomColor: color, paddingBottom: Math.round(2*sp), marginBottom: Math.round(5*sp) }}>Skills</Text>
              {Object.entries(skills).map(([cat, items]) => (
                <View key={cat} wrap={false} style={{ marginBottom: Math.round(3*sp) }}>
                  {Object.keys(skills).length > 1
                    ? <Text style={{ fontFamily: f, fontSize: base }}><Text style={{ fontWeight: 'bold' }}>{cat + ': '}</Text><Text style={{ color: '#333333' }}>{items.join(' \u2022 ')}</Text></Text>
                    : <Text style={{ fontFamily: f, fontSize: base, color: '#333333' }}>{items.join(' \u2022 ')}</Text>
                  }
                </View>
              ))}
            </View>
          )}

          {resumeData.certifications?.length > 0 && (
            <View style={{ marginTop: Math.round(14*sp) }}>
              <Text wrap={false} style={{ fontFamily: f, fontSize: base+1, fontWeight: 'bold', textTransform: 'uppercase', color: color, borderBottomWidth: 2, borderBottomColor: color, paddingBottom: Math.round(2*sp), marginBottom: Math.round(5*sp) }}>Certifications</Text>
              {resumeData.certifications.map((c, i) => (
                <View key={i} wrap={false} style={{ marginBottom: i < resumeData.certifications.length - 1 ? Math.round(6*sp) : 0 }}>
                  <Text style={{ fontFamily: f, fontSize: base }}><Text style={{ fontWeight: 'bold' }}>{c.name || ''}</Text>{c.details ? ' | ' + c.details : ''}</Text>
                </View>
              ))}
            </View>
          )}

          {resumeData.volunteer?.length > 0 && (
            <View style={{ marginTop: Math.round(14*sp) }}>
              <Text wrap={false} style={{ fontFamily: f, fontSize: base+1, fontWeight: 'bold', textTransform: 'uppercase', color: color, borderBottomWidth: 2, borderBottomColor: color, paddingBottom: Math.round(2*sp), marginBottom: Math.round(5*sp) }}>Volunteer Experience</Text>
              {resumeData.volunteer.map((v, i) => (
                <View key={i} wrap={false} style={{ marginBottom: i < resumeData.volunteer.length - 1 ? Math.round(6*sp) : 0 }}>
                  <Text style={{ fontFamily: f, fontWeight: 'bold', fontSize: base }}>{v.organization || ''}</Text>
                  <Text style={{ fontFamily: f, fontSize: base, color: '#444444' }}>{v.description || ''}</Text>
                </View>
              ))}
            </View>
          )}

          {resumeData.projects?.length > 0 && (
            <View style={{ marginTop: Math.round(14*sp) }}>
              <Text wrap={false} style={{ fontFamily: f, fontSize: base+1, fontWeight: 'bold', textTransform: 'uppercase', color: color, borderBottomWidth: 2, borderBottomColor: color, paddingBottom: Math.round(2*sp), marginBottom: Math.round(5*sp) }}>Projects</Text>
              {resumeData.projects.map((p, i) => (
                <View key={i} wrap={false} style={{ marginBottom: i < resumeData.projects.length - 1 ? Math.round(6*sp) : 0 }}>
                  <Text style={{ fontFamily: f, fontWeight: 'bold', fontSize: base }}>{(p.name || '') + (p.link ? ' — ' + p.link : '')}</Text>
                  <Text style={{ fontFamily: f, fontSize: base, color: '#444444' }}>{p.description || ''}</Text>
                </View>
              ))}
            </View>
          )}

          {resumeData.additionalInfo?.length > 0 && (
            <View style={{ marginTop: Math.round(14*sp) }}>
              <Text wrap={false} style={{ fontFamily: f, fontSize: base+1, fontWeight: 'bold', textTransform: 'uppercase', color: color, borderBottomWidth: 2, borderBottomColor: color, paddingBottom: Math.round(2*sp), marginBottom: Math.round(5*sp) }}>Additional Information</Text>
              {resumeData.additionalInfo.map((item, i) => (
                <View key={i} wrap={false} style={{ marginBottom: Math.round(3*sp) }}>
                  <Text style={{ fontFamily: f, fontSize: base }}><Text style={{ fontWeight: 'bold' }}>{item.label || ''}</Text>{item.detail ? ' | ' + item.detail : ''}</Text>
                </View>
              ))}
            </View>
          )}

          {resumeData.languages?.length > 0 && (
            <View style={{ marginTop: Math.round(14*sp) }}>
              <Text wrap={false} style={{ fontFamily: f, fontSize: base+1, fontWeight: 'bold', textTransform: 'uppercase', color: color, borderBottomWidth: 2, borderBottomColor: color, paddingBottom: Math.round(2*sp), marginBottom: Math.round(5*sp) }}>Languages</Text>
              <Text style={{ fontFamily: f, fontSize: base, color: '#333333' }}>{resumeData.languages.map(l => `${l.language} (${l.proficiency})`).join(' \u2022 ')}</Text>
            </View>
          )}

        </View>
      </Page>
    </Document>
  )
}