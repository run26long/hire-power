import React from 'react'
import { Document, Page, View, Text } from '@react-pdf/renderer'

export default function CoverLetterPDFSharp({ coverLetterData, font = 'Open Sans', fontSize = 11, spacing = 1 }) {
  const cl = coverLetterData || {}
  const base = fontSize
  const sp = spacing
  const f = font || 'Open Sans'
  const lineHeight = 1.3

  const contactParts = [cl.location, cl.phone, cl.email, cl.linkedin].filter(Boolean)
  const bulletsIntro = cl.bulletsIntro || 'Highlights of how my experience aligns with this role include:'

  return (
    <Document hyphenationCallback={(w) => [w]}>
      <Page size="LETTER" style={{ fontFamily: f, fontSize: base, lineHeight: 1.2, color: '#111111', paddingTop: 36, paddingBottom: 28, paddingLeft: 36, paddingRight: 36, backgroundColor: '#ffffff' }}>

        {/* HEADER — copied verbatim from ResumePDF-Sharp.js */}
        <Text style={{ fontFamily: f, fontSize: 22, fontWeight: 'bold', color: '#111111', marginBottom: Math.round(14*sp) }}>{cl.candidateName || ''}</Text>
        <View style={{ borderBottomWidth: 1.5, borderBottomColor: '#111111', marginBottom: Math.round(4*sp) }} />
        <Text style={{ fontFamily: f, fontSize: base, color: '#444444', marginBottom: Math.round(8*sp) }}>{contactParts.join(' | ')}</Text>

        {/* Date */}
        <Text style={{ fontFamily: f, fontSize: base, color: '#111111', marginTop: Math.round(30*sp), marginBottom: Math.round(36*sp) }}>{cl.date || ''}</Text>

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

        {/* Opening */}
        {cl.opening ? <Text style={{ fontFamily: f, fontSize: base, lineHeight, marginBottom: Math.round(16*sp) }}>{cl.opening}</Text> : null}

        {/* Bullets intro */}
        {bulletsIntro ? <Text style={{ fontFamily: f, fontSize: base, lineHeight, marginBottom: Math.round(8*sp) }}>{bulletsIntro}</Text> : null}

        {/* Bullets */}
        {(cl.bullets || []).filter(b => b?.trim()).map((bullet, i) => (
          <View key={i} wrap={false} style={{ flexDirection: 'row', marginBottom: Math.round(8*sp), paddingLeft: 8 }}>
            <Text style={{ fontFamily: f, fontSize: base, width: 10, lineHeight }}>{'\u2022'}</Text>
            <Text style={{ fontFamily: f, fontSize: base, flex: 1, lineHeight }}>{bullet.replace(/\*\*/g, '')}</Text>
          </View>
        ))}

        {/* Closing */}
        {cl.closing ? <Text style={{ fontFamily: f, fontSize: base, lineHeight, marginBottom: Math.round(12*sp) }}>{cl.closing}</Text> : null}

        {/* Signature */}
        <Text style={{ fontFamily: f, fontSize: base, lineHeight }}>Sincerely,</Text>
        <Text style={{ fontFamily: f, fontSize: base, marginTop: Math.round(24*sp) }}>{cl.candidateName || ''}</Text>

      </Page>
    </Document>
  )
}