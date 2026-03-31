import React from 'react'
import { Document, Page, View, Text } from '@react-pdf/renderer'

export default function CoverLetterPDFCurrent({ coverLetterData, font = 'Lato', fontSize = 11, spacing = 1 }) {
  const cl = coverLetterData || {}
  const base = fontSize
  const sp = spacing
  const f = font || 'Lato'
  const lineHeight = 1.3

  const contactParts = [cl.location, cl.phone, cl.email, cl.linkedin].filter(Boolean)
  const bulletsIntro = cl.bulletsIntro || 'Highlights of how my experience aligns with this role include:'

  return (
    <Document hyphenationCallback={(w) => [w]}>
      <Page size="LETTER" style={{ fontFamily: f, fontSize: base, lineHeight: 1.25, color: '#1a1a1a', paddingTop: 43, paddingBottom: 36, paddingLeft: 43, paddingRight: 43, backgroundColor: '#ffffff' }}>

        {/* HEADER */}
        <Text style={{ fontFamily: f, fontSize: 22, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 2, textAlign: 'center', color: '#1a1a1a', marginBottom: Math.round(4*sp), lineHeight: 1.1 }}>{cl.candidateName || ''}</Text>
        <View style={{ borderBottomWidth: 1, borderBottomColor: '#bbbbbb' }} />
        <View style={{ paddingTop: Math.round(6*sp), paddingBottom: Math.round(6*sp) }}>
          <Text style={{ fontFamily: f, fontSize: base - 1, color: '#555555', textAlign: 'center', lineHeight: 1.3, letterSpacing: 0.2 }}>{contactParts.join(' | ')}</Text>
        </View>
        <View style={{ borderBottomWidth: 1, borderBottomColor: '#bbbbbb', marginBottom: Math.round(14*sp) }} />

        {/* Date */}
        <Text style={{ fontFamily: f, fontSize: base, color: '#1a1a1a', marginTop: Math.round(8*sp), marginBottom: Math.round(36*sp) }}>{cl.date || ''}</Text>

        {/* To / Re */}
        <View style={{ marginBottom: Math.round(16*sp) }}>
          <View style={{ flexDirection: 'row', marginBottom: Math.round(12*sp) }}>
            <Text style={{ fontFamily: f, fontSize: base, color: '#555555', marginRight: 4 }}>To:</Text>
            <Text style={{ fontFamily: f, fontSize: base }}>{cl.recipientName || 'Hiring Manager'}</Text>
          </View>
          <View style={{ flexDirection: 'row' }}>
            <Text style={{ fontFamily: f, fontSize: base, color: '#555555', marginRight: 4 }}>Re:</Text>
            <Text style={{ fontFamily: f, fontSize: base }}>{cl.jobTitle || ''}{cl.companyName ? ` position at ${cl.companyName}` : ''}</Text>
          </View>
        </View>

        {cl.opening ? <Text style={{ fontFamily: f, fontSize: base, lineHeight, marginBottom: Math.round(16*sp) }}>{cl.opening}</Text> : null}
        {bulletsIntro ? <Text style={{ fontFamily: f, fontSize: base, lineHeight, marginBottom: Math.round(8*sp) }}>{bulletsIntro}</Text> : null}

        {(cl.bullets || []).filter(b => b?.trim()).map((bullet, i) => (
          <View key={i} wrap={false} style={{ flexDirection: 'row', marginBottom: Math.round(8*sp), paddingLeft: 8 }}>
            <Text style={{ fontFamily: f, fontSize: base, width: 10, lineHeight }}>{'\u2022'}</Text>
            <Text style={{ fontFamily: f, fontSize: base, flex: 1, lineHeight }}>{bullet}</Text>
          </View>
        ))}

        {cl.closing ? <Text style={{ fontFamily: f, fontSize: base, lineHeight, marginBottom: Math.round(12*sp) }}>{cl.closing}</Text> : null}

        <Text style={{ fontFamily: f, fontSize: base, lineHeight }}>Sincerely,</Text>
        <Text style={{ fontFamily: f, fontSize: base, marginTop: Math.round(24*sp) }}>{cl.candidateName || ''}</Text>

      </Page>
    </Document>
  )
}