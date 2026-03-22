import React from 'react'
import { Document, Page, View, Text } from '@react-pdf/renderer'
import { formatDate, formatDateRange, getSkillsDisplay } from '../templateUtils'

export default function ResumePDFSharp({ resumeData, font = 'Helvetica', fontSize = 11, spacing = 1, accentColor = '#5b4fcf', dateFormat = 'short' }) {
  if (!resumeData) return null
  const skills = getSkillsDisplay(resumeData)
  const base = fontSize
  const sp = spacing
  const f = (font === 'Arial' || font === 'Helvetica') ? 'Lato' : (font || 'Lato')

  const contactParts = [resumeData.phone, resumeData.email, resumeData.location, resumeData.linkedin, resumeData.portfolio].filter(Boolean)

  return (
    <Document hyphenationCallback={(w) => [w]}>
      <Page size="LETTER" style={{ fontFamily: f, fontSize: base, lineHeight: 1.3, color: '#111111', paddingTop: 36, paddingBottom: 36, paddingLeft: 52, paddingRight: 52, backgroundColor: '#ffffff' }}>

        <Text style={{ fontFamily: f, fontSize: 22, fontWeight: 'bold', color: '#111111', marginBottom: Math.round(16*sp) }}>{resumeData.fullName || ''}</Text>
        <View style={{ borderBottomWidth: 1, borderBottomColor: '#111111', marginBottom: Math.round(4*sp) }} />
        <Text style={{ fontFamily: f, fontSize: base, color: '#444444', marginBottom: Math.round(8*sp) }}>{contactParts.join(' | ')}</Text>

        {resumeData.summary && !resumeData.hideSummary && (
          <View style={{ marginTop: Math.round(6*sp) }}>
            <Text style={{ fontFamily: f, fontSize: base+2, fontWeight: 'bold', textTransform: 'uppercase', borderBottomWidth: 1.5, borderBottomColor: '#111111', paddingBottom: Math.round(2*sp), marginBottom: Math.round(5*sp), color: '#111111' }}>{resumeData.sectionTitles?.summary || 'Professional Summary'}</Text>
            <Text style={{ fontFamily: f, fontSize: base, color: '#333333' }}>{resumeData.summary}</Text>
          </View>
        )}

        {resumeData.experience?.length > 0 && (
          <View style={{ marginTop: Math.round(14*sp) }}>
            <Text style={{ fontFamily: f, fontSize: base+2, fontWeight: 'bold', textTransform: 'uppercase', borderBottomWidth: 1.5, borderBottomColor: '#111111', paddingBottom: Math.round(2*sp), marginBottom: Math.round(5*sp), color: '#111111' }}>Experience</Text>
            {resumeData.experience.map((job, i) => (
              <View key={i} style={{ marginBottom: i < resumeData.experience.length - 1 ? Math.round(10*sp) : 0 }}>
                <Text style={{ fontFamily: f, fontWeight: 'bold', fontSize: base, color: '#111111' }}>{job.title || ''}</Text>
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
        )}

        {resumeData.education?.length > 0 && (
          <View style={{ marginTop: Math.round(14*sp) }}>
            <Text style={{ fontFamily: f, fontSize: base+2, fontWeight: 'bold', textTransform: 'uppercase', borderBottomWidth: 1.5, borderBottomColor: '#111111', paddingBottom: Math.round(2*sp), marginBottom: Math.round(5*sp), color: '#111111' }}>Education</Text>
            {resumeData.education.map((ed, i) => (
              <View key={i} style={{ marginBottom: i < resumeData.education.length - 1 ? Math.round(10*sp) : 0 }}>
                <Text style={{ fontFamily: f, fontWeight: 'bold', fontSize: base, color: '#111111' }}>{ed.school || ''}</Text>
                <Text style={{ fontFamily: f, fontSize: base, color: '#555555' }}>{[ed.degree && ed.field ? `${ed.degree}, ${ed.field}` : (ed.degree || ed.field), formatDate(ed.graduationDate, dateFormat)].filter(Boolean).join(' | ')}</Text>
                {ed.lines?.map((l, k) => <Text key={k} style={{ fontFamily: f, fontSize: base, color: '#333333' }}>{l}</Text>)}
              </View>
            ))}
          </View>
        )}

        {Object.keys(skills).length > 0 && (
          <View style={{ marginTop: Math.round(14*sp) }}>
            <Text style={{ fontFamily: f, fontSize: base+2, fontWeight: 'bold', textTransform: 'uppercase', borderBottomWidth: 1.5, borderBottomColor: '#111111', paddingBottom: Math.round(2*sp), marginBottom: Math.round(5*sp), color: '#111111' }}>Skills</Text>
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
          <View style={{ marginTop: Math.round(14*sp) }}>
            <Text style={{ fontFamily: f, fontSize: base+2, fontWeight: 'bold', textTransform: 'uppercase', borderBottomWidth: 1.5, borderBottomColor: '#111111', paddingBottom: Math.round(2*sp), marginBottom: Math.round(5*sp), color: '#111111' }}>Certifications</Text>
            {resumeData.certifications.map((c, i) => (
              <View key={i} style={{ marginBottom: i < resumeData.certifications.length - 1 ? Math.round(6*sp) : 0 }}>
                <Text style={{ fontFamily: f, fontSize: base }}><Text style={{ fontWeight: 'bold' }}>{c.name || ''}</Text>{c.details ? ' | ' + c.details : ''}</Text>
              </View>
            ))}
          </View>
        )}

        {resumeData.volunteer?.length > 0 && (
          <View style={{ marginTop: Math.round(14*sp) }}>
            <Text style={{ fontFamily: f, fontSize: base+2, fontWeight: 'bold', textTransform: 'uppercase', borderBottomWidth: 1.5, borderBottomColor: '#111111', paddingBottom: Math.round(2*sp), marginBottom: Math.round(5*sp), color: '#111111' }}>Volunteer Experience</Text>
            {resumeData.volunteer.map((v, i) => (
              <View key={i} style={{ marginBottom: i < resumeData.volunteer.length - 1 ? Math.round(6*sp) : 0 }}>
                <Text style={{ fontFamily: f, fontWeight: 'bold', fontSize: base }}>{v.organization || ''}</Text>
                <Text style={{ fontFamily: f, fontSize: base, color: '#444444' }}>{v.description || ''}</Text>
              </View>
            ))}
          </View>
        )}

        {resumeData.projects?.length > 0 && (
          <View style={{ marginTop: Math.round(14*sp) }}>
            <Text style={{ fontFamily: f, fontSize: base+2, fontWeight: 'bold', textTransform: 'uppercase', borderBottomWidth: 1.5, borderBottomColor: '#111111', paddingBottom: Math.round(2*sp), marginBottom: Math.round(5*sp), color: '#111111' }}>Projects</Text>
            {resumeData.projects.map((p, i) => (
              <View key={i} style={{ marginBottom: i < resumeData.projects.length - 1 ? Math.round(6*sp) : 0 }}>
                <Text style={{ fontFamily: f, fontWeight: 'bold', fontSize: base }}>{(p.name || '') + (p.link ? ' — ' + p.link : '')}</Text>
                <Text style={{ fontFamily: f, fontSize: base, color: '#444444' }}>{p.description || ''}</Text>
              </View>
            ))}
          </View>
        )}

        {resumeData.additionalInfo?.length > 0 && (
          <View style={{ marginTop: Math.round(14*sp) }}>
            <Text style={{ fontFamily: f, fontSize: base+2, fontWeight: 'bold', textTransform: 'uppercase', borderBottomWidth: 1.5, borderBottomColor: '#111111', paddingBottom: Math.round(2*sp), marginBottom: Math.round(5*sp), color: '#111111' }}>Additional Information</Text>
            {resumeData.additionalInfo.map((item, i) => (
              <View key={i} style={{ marginBottom: Math.round(3*sp) }}>
                <Text style={{ fontFamily: f, fontSize: base }}><Text style={{ fontWeight: 'bold' }}>{item.label || ''}</Text>{item.detail ? ' | ' + item.detail : ''}</Text>
              </View>
            ))}
          </View>
        )}

        {resumeData.languages?.length > 0 && (
          <View style={{ marginTop: Math.round(14*sp) }}>
            <Text style={{ fontFamily: f, fontSize: base+2, fontWeight: 'bold', textTransform: 'uppercase', borderBottomWidth: 1.5, borderBottomColor: '#111111', paddingBottom: Math.round(2*sp), marginBottom: Math.round(5*sp), color: '#111111' }}>Languages</Text>
            <Text style={{ fontFamily: f, fontSize: base, color: '#333333' }}>{resumeData.languages.map(l => `${l.language} (${l.proficiency})`).join(' \u2022 ')}</Text>
          </View>
        )}

      </Page>
    </Document>
  )
}