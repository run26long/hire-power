import React from 'react'
import { Document, Page, View, Text } from '@react-pdf/renderer'
import { formatDate, formatDateRange, getSkillsDisplay } from '../templateUtils'

export default function ResumePDFSignature({ resumeData, font = 'EB Garamond', fontSize = 11, spacing = 1, accentColor = '#5b4fcf', dateFormat = 'short' }) {
  if (!resumeData) return null
  const skills = getSkillsDisplay(resumeData)
  const base = fontSize
  const sp = spacing
  const color = accentColor
  const f = font === 'Arial' ? 'Helvetica' : (font || 'EB Garamond')
  const professionalTitle = resumeData.professionalTitle || resumeData.experience?.[0]?.title || ''

  const contactParts = [resumeData.phone, resumeData.email, resumeData.location, resumeData.linkedin, resumeData.portfolio].filter(Boolean)

  const SH = ({ title }) => (
    <View wrap={false} style={{ backgroundColor: color + '22', paddingTop: Math.round(3*sp), paddingBottom: Math.round(3*sp), paddingLeft: Math.round(6*sp), paddingRight: Math.round(6*sp), marginBottom: Math.round(8*sp), alignItems: 'center' }}>
      <Text style={{ fontFamily: f, fontSize: base, fontWeight: 'bold', textTransform: 'uppercase', color: '#1a1a1a', textAlign: 'center' }}>{title}</Text>
    </View>
  )

  return (
    <Document hyphenationCallback={(w) => [w]}>
      <Page size="LETTER" style={{ fontFamily: f, fontSize: base, lineHeight: 1.3, color: '#1a1a1a', paddingTop: 40, paddingBottom: 40, paddingLeft: 56, paddingRight: 56, backgroundColor: '#ffffff' }}>

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

        {resumeData.experience?.length > 0 && (
          <View style={{ marginTop: Math.round(16*sp) }}>
            <SH title="Experience" />
            {resumeData.experience.map((job, i) => (
              <View key={i} style={{ marginBottom: i < resumeData.experience.length - 1 ? Math.round(12*sp) : 0 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontFamily: f, fontWeight: 'bold', fontSize: base, flex: 1 }}>{job.title || ''}</Text>
                  <Text style={{ fontFamily: f, fontSize: base, color: '#555555' }}>{formatDateRange(job.startDate, job.endDate, job.current, dateFormat)}</Text>
                </View>
                <Text style={{ fontFamily: f, fontSize: base, color: '#555555', marginBottom: Math.round(4*sp) }}>{[job.company, job.location].filter(Boolean).join(' | ')}</Text>
                {job.summary && !job.summaryDismissed && <Text style={{ fontFamily: f, fontSize: base, color: '#444444', marginBottom: Math.round(3*sp) }}>{job.summary}</Text>}
                {job.bullets?.map((b, k) => (
                  <View key={k} style={{ flexDirection: 'row', marginBottom: Math.round(2*sp) }}>
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
              <View key={i} style={{ marginBottom: i < resumeData.education.length - 1 ? Math.round(12*sp) : 0 }}>
                <View style={{ flexDirection: 'column' }}>
                  <Text style={{ fontFamily: f, fontWeight: 'bold', fontSize: base }}>{ed.school || ''}</Text>
                  <Text style={{ fontFamily: f, fontSize: base, color: '#555555', marginBottom: Math.round(4*sp) }}>{[[ed.degree, ed.field].filter(Boolean).join(', '), ed.graduationDate ? formatDate(ed.graduationDate, dateFormat) : null].filter(Boolean).join(' | ')}</Text>
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
        )}

        {Object.keys(skills).length > 0 && (
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