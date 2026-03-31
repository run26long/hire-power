import React from 'react'
import { Document, Page, View, Text } from '@react-pdf/renderer'
import { hexToRgba } from '../../templates/templateUtils'

export default function CoverLetterPDFSignature({ coverLetterData, font = 'EB Garamond', fontSize = 11, spacing = 1, accentColor = '#5b4fcf' }) {
  const cl = coverLetterData || {}
  const base = fontSize
  const sp = spacing
 const f = font || 'EB Garamond'
  const accent = accentColor
  const lineHeight = 1.2

  const contactParts = [cl.location, cl.phone, cl.email, cl.linkedin].filter(Boolean)
  const bulletsIntro = cl.bulletsIntro || 'Highlights of how my experience aligns with this role include:'

  return (
    <Document hyphenationCallback={(w) => [w]}>
      <Page size="LETTER" style={{ fontFamily: f, fontSize: base, lineHeight: 1.2, color: '#1a1a1a', paddingTop: 36, paddingBottom: 36, paddingLeft: 43, paddingRight: 43, backgroundColor: '#ffffff' }}>

        {/* Header */}
        <View style={{ alignItems: 'center', marginBottom: Math.round(4*sp) }}>
          <Text style={{ fontFamily: f, fontSize: 24, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 3, color: '#1a1a1a', marginBottom: Math.round(8*sp), textAlign: 'center' }}>{cl.candidateName || ''}</Text>
        </View>
        <View style={{ backgroundColor: hexToRgba(accent, 0.133), paddingTop: Math.round(3*sp), paddingBottom: Math.round(3*sp), paddingLeft: Math.round(6*sp), paddingRight: Math.round(6*sp), marginTop: Math.round(4*sp), marginBottom: Math.round(16*sp), alignItems: 'center' }}>
          <Text style={{ fontFamily: f, fontSize: base - 1, color: '#555555', textAlign: 'center', letterSpacing: 0.3, lineHeight: 1.4 }}>{contactParts.join(' | ')}</Text>
        </View>

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