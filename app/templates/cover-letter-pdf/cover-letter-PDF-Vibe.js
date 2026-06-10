import React from 'react'
import { Document, Page, View, Text } from '@react-pdf/renderer'

export default function CoverLetterPDFVibe({ coverLetterData, font = 'Lato', fontSize = 11, spacing = 1 }) {
  const cl = coverLetterData || {}
  const base = fontSize
  const sp = spacing
  const f = font || 'Lato'
  const lineHeight = 1.3

  const bulletsIntro = cl.bulletsIntro || 'Highlights of how my experience aligns with this role include:'

  const contactRight = []
  if (cl.email) contactRight.push(cl.email)
  if (cl.phone && cl.location) contactRight.push(`${cl.phone} | ${cl.location}`)
  else {
    if (cl.phone) contactRight.push(cl.phone)
    if (cl.location) contactRight.push(cl.location)
  }
  if (cl.linkedin) contactRight.push(cl.linkedin)

  return (
    <Document hyphenationCallback={(w) => [w]}>
      <Page size="LETTER" style={{ fontFamily: f, fontSize: base, lineHeight: 1.2, color: '#1a1a1a', paddingTop: 36, paddingBottom: 28, paddingLeft: 36, paddingRight: 36, backgroundColor: '#ffffff' }}>

        {/* HEADER — copied verbatim from ResumePDF-Vibe.js */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Math.round(2*sp) }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: f, fontSize: 24, fontWeight: 'bold', textTransform: 'uppercase', color: '#1a1a1a', marginBottom: Math.round(2*sp) }}>{cl.candidateName || ''}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            {contactRight.map((line, i) => <Text key={i} style={{ fontFamily: f, fontSize: base, color: '#555555', lineHeight: 1.4 }}>{line}</Text>)}
          </View>
        </View>
        <View style={{ borderBottomWidth: 1, borderBottomColor: '#aaaaaa', marginBottom: Math.round(20*sp) }} />

        {/* Date */}
        <Text style={{ fontFamily: f, fontSize: base, color: '#1a1a1a', marginTop: Math.round(30*sp), marginBottom: Math.round(36*sp) }}>{cl.date || ''}</Text>

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
            <Text style={{ fontFamily: f, fontSize: base, flex: 1, lineHeight }}>{bullet.replace(/\*\*/g, '')}</Text>
          </View>
        ))}

        {cl.closing ? <Text style={{ fontFamily: f, fontSize: base, lineHeight, marginBottom: Math.round(12*sp) }}>{cl.closing}</Text> : null}

        <Text style={{ fontFamily: f, fontSize: base, lineHeight }}>Sincerely,</Text>
        <Text style={{ fontFamily: f, fontSize: base, marginTop: Math.round(24*sp) }}>{cl.candidateName || ''}</Text>

      </Page>
    </Document>
  )
}