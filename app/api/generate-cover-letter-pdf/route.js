import React from 'react'
import { renderToBuffer, Font, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { createClient } from '@supabase/supabase-js'
import path from 'path'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const fontsDir = path.join(process.cwd(), 'public', 'fonts')

Font.register({
  family: 'Lato',
  fonts: [
    { src: path.join(fontsDir, 'Lato-Regular.ttf'), fontWeight: 400, fontStyle: 'normal' },
    { src: path.join(fontsDir, 'Lato-Bold.ttf'), fontWeight: 700, fontStyle: 'normal' },
    { src: path.join(fontsDir, 'Lato-Italic.ttf'), fontWeight: 400, fontStyle: 'italic' },
    { src: path.join(fontsDir, 'Lato-BoldItalic.ttf'), fontWeight: 700, fontStyle: 'italic' },
  ]
})

Font.register({
  family: 'EB Garamond',
  fonts: [
    { src: path.join(fontsDir, 'EBGaramond-Regular.ttf'), fontWeight: 400, fontStyle: 'normal' },
    { src: path.join(fontsDir, 'EBGaramond-Bold.ttf'), fontWeight: 700, fontStyle: 'normal' },
    { src: path.join(fontsDir, 'EBGaramond-Italic.ttf'), fontWeight: 400, fontStyle: 'italic' },
    { src: path.join(fontsDir, 'EBGaramond-BoldItalic.ttf'), fontWeight: 700, fontStyle: 'italic' },
  ]
})

Font.register({
  family: 'Open Sans',
  fonts: [
    { src: path.join(fontsDir, 'OpenSans-Regular.ttf'), fontWeight: 400, fontStyle: 'normal' },
    { src: path.join(fontsDir, 'OpenSans-Bold.ttf'), fontWeight: 700, fontStyle: 'normal' },
    { src: path.join(fontsDir, 'OpenSans-Italic.ttf'), fontWeight: 400, fontStyle: 'italic' },
    { src: path.join(fontsDir, 'OpenSans-BoldItalic.ttf'), fontWeight: 700, fontStyle: 'italic' },
  ]
})

Font.register({
  family: 'Source Serif 4',
  fonts: [
    { src: path.join(fontsDir, 'SourceSerif4-Regular.ttf'), fontWeight: 400, fontStyle: 'normal' },
    { src: path.join(fontsDir, 'SourceSerif4-Bold.ttf'), fontWeight: 700, fontStyle: 'normal' },
    { src: path.join(fontsDir, 'SourceSerif4-Italic.ttf'), fontWeight: 400, fontStyle: 'italic' },
    { src: path.join(fontsDir, 'SourceSerif4-BoldItalic.ttf'), fontWeight: 700, fontStyle: 'italic' },
  ]
})

Font.registerHyphenationCallback((word) => [word])

function countPDFPages(buffer) {
  const str = buffer.toString('binary')
  const matches = str.match(/\/Type\s*\/Page[^s]/g)
  return matches ? matches.length : 1
}

function CoverLetterPDF({ coverLetterData, font, fontSize, spacing, templateName }) {
  const cl = coverLetterData || {}
  const isBoldDivider = ['Sharp', 'Command', 'Edge'].includes(templateName)
  const lineHeight = spacing * 1.3

  const styles = StyleSheet.create({
    page: {
      paddingTop: 54,
      paddingBottom: 46,
      paddingLeft: 54,
      paddingRight: 54,
      fontFamily: font === 'Helvetica' ? 'Helvetica' : font,
      fontSize,
      color: '#1a1a1a',
    },
    name: {
      fontSize: fontSize + 6,
      fontWeight: 'bold',
      letterSpacing: 2,
      textAlign: 'center',
      marginBottom: Math.round(3 * spacing),
    },
    contact: {
      fontSize,
      color: '#4a5568',
    },
    headerDivider: {
      borderBottomWidth: isBoldDivider ? 2 : 0.75,
      borderBottomColor: isBoldDivider ? '#1a1a1a' : '#d1d5db',
      paddingBottom: 12,
      marginBottom: 16,
    },
    block: {
      marginBottom: 16,
      lineHeight,
    },
    paragraph: {
      fontSize,
      lineHeight,
      marginBottom: 16,
    },
    bulletRow: {
      flexDirection: 'row',
      marginBottom: 8,
      paddingLeft: 8,
    },
    bulletDot: {
      fontSize,
      marginRight: 8,
      lineHeight,
    },
    bulletText: {
      flex: 1,
      fontSize,
      lineHeight,
    },
    signatureLine: {
      fontSize,
      lineHeight,
    },
    signatureName: {
      fontSize,
      fontWeight: 'bold',
      marginTop: 24,
    },
  })

  const contactLine = [cl.location, cl.phone, cl.email, cl.linkedin].filter(Boolean).join(' | ')
  const bulletsIntro = cl.bulletsIntro || 'Highlights of how my experience aligns with this role include:'

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>

        {/* Header — varies by template */}
        {templateName === 'Vibe' ? (
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Math.round(2 * spacing) }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 24, fontWeight: 'bold', letterSpacing: 1.5, textTransform: 'uppercase', color: '#1a1a1a', lineHeight: 1.1 }}>{cl.candidateName || ''}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                {[cl.email, cl.phone && cl.location ? `${cl.phone} | ${cl.location}` : (cl.phone || cl.location), cl.linkedin].filter(Boolean).map((line, i) => (
                  <Text key={i} style={{ fontSize, color: '#555555', lineHeight: 1.4 }}>{line}</Text>
                ))}
              </View>
            </View>
            <View style={{ borderBottomWidth: 1, borderBottomColor: '#aaaaaa', marginBottom: Math.round(20 * spacing) }} />
          </View>
          
        ) : templateName === 'Sharp' ? (
          <View style={{ marginBottom: Math.round(8 * spacing) }}>
            <Text style={{ fontFamily: font, fontSize: 22, fontWeight: 'bold', color: '#111111', marginBottom: Math.round(4 * spacing) }}>{cl.candidateName || ''}</Text>
            <View style={{ height: 2, backgroundColor: '#111111', marginBottom: Math.round(4 * spacing) }} />
            <Text style={{ fontFamily: font, fontSize: fontSize, color: '#444444', marginBottom: Math.round(8 * spacing) }}>{contactLine}</Text>
          </View>
        ) : (
          <>
            <View style={{ alignItems: 'center', marginBottom: Math.round(4 * spacing) }}>
              <Text style={styles.name}>{cl.candidateName || ''}</Text>
            </View>
            <View style={{ borderBottomWidth: 1, borderBottomColor: '#bbbbbb' }} />
            <View style={{ paddingTop: Math.round(6 * spacing), paddingBottom: Math.round(6 * spacing) }}>
              <Text style={{ ...styles.contact, textAlign: 'center' }}>{contactLine}</Text>
            </View>
            <View style={{ borderBottomWidth: 1, borderBottomColor: '#bbbbbb', marginBottom: Math.round(20 * spacing) }} />
          </>
        )}

        {/* Date */}
        <View style={{ marginTop: Math.round(30 * spacing), marginBottom: Math.round(12 * spacing) }}>
          <Text style={styles.paragraph}>{cl.date || ''}</Text>
        </View>

        {/* Memo block — To / Re */}
        <View style={{ marginBottom: Math.round(16 * spacing) }}>
          <View style={{ flexDirection: 'row', marginBottom: Math.round(12 * spacing) }}>
            <Text style={{ fontSize, lineHeight, color: '#555555', marginRight: 4 }}>To:</Text>
            <Text style={{ fontSize, lineHeight }}>{cl.recipientName || 'Hiring Manager'}</Text>
          </View>
          <View style={{ flexDirection: 'row' }}>
            <Text style={{ fontSize, lineHeight, color: '#555555', marginRight: 4 }}>Re:</Text>
            <Text style={{ fontSize, lineHeight }}>{cl.jobTitle || ''}{cl.companyName ? ` position at ${cl.companyName}` : ''}</Text>
          </View>
        </View>

        {/* Opening */}
        {cl.opening ? <Text style={styles.paragraph}>{cl.opening}</Text> : null}

        {/* Bullets intro */}
        {bulletsIntro ? <Text style={{ ...styles.paragraph, marginBottom: 8 }}>{bulletsIntro}</Text> : null}

        {/* Bullets */}
        {(cl.bullets || []).filter(b => b?.trim()).map((bullet, i) => (
          <View key={i} style={styles.bulletRow}>
            <Text style={styles.bulletDot}>{'\u2022'}</Text>
            <Text style={styles.bulletText}>{bullet}</Text>
          </View>
        ))}

        {cl.closing ? <Text style={styles.paragraph}>{cl.closing}</Text> : null}

        {/* Signature */}
        <View>
          <Text style={styles.signatureLine}>Sincerely,</Text>
          <Text style={{ ...styles.signatureName, fontWeight: 'normal' }}>{cl.candidateName || ''}</Text>
        </View>

      </Page>
    </Document>
  )
}

export async function POST(request) {
  try {
    const {
      coverLetterData,
      templateName,
      fontSize,
      font,
      spacing,
      action,
      userId
    } = await request.json()

    const fontMap = {
      'Lato': 'Lato',
      'EB Garamond': 'EB Garamond',
      'Open Sans': 'Open Sans',
      'Source Serif 4': 'Source Serif 4',
      'Helvetica': 'Helvetica',
    }
    const fontToUse = fontMap[font] || 'Lato'

    const element = React.createElement(CoverLetterPDF, {
      coverLetterData,
      font: fontToUse,
      fontSize: fontSize || 11,
      spacing: spacing || 1,
      templateName: templateName || 'Current'
    })

    const pdfBuffer = await renderToBuffer(element)

    if (action === 'check') {
      const pageCount = countPDFPages(pdfBuffer)
      return Response.json({ pageCount })
    }

    if (action === 'preview') {
      return new Response(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'inline',
        }
      })
    }

    // Download — upload to storage and return URL
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const candidateName = coverLetterData?.candidateName || 'Cover_Letter'
    const nameParts = candidateName.split(' ')
    const atsName = nameParts.length > 1
      ? `${nameParts[0]}_${nameParts[nameParts.length - 1]}`
      : nameParts[0]
    const fileName = `${userId}/cover-letters/${atsName}_Cover_Letter_${timestamp}.pdf`

    const { error: uploadError } = await supabase.storage
      .from('resume-pdfs')
      .upload(fileName, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false
      })

    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabase.storage
      .from('resume-pdfs')
      .getPublicUrl(fileName)

    return Response.json({ success: true, pdfUrl: publicUrl })

  } catch (error) {
    console.error('Cover letter PDF error:', error)
    return Response.json({ error: 'Failed to generate PDF', details: error.message }, { status: 500 })
  }
}