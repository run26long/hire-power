import React from 'react'
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'
import path from 'path'

const fontsDir = path.join(process.cwd(), 'public', 'fonts')

Font.register({
  family: 'Lato',
  fonts: [
    { src: path.join(fontsDir, 'Lato-Regular.ttf'), fontWeight: 400, fontStyle: 'normal' },
    { src: path.join(fontsDir, 'Lato-Bold.ttf'), fontWeight: 700, fontStyle: 'normal' },
    { src: path.join(fontsDir, 'Lato-Italic.ttf'), fontWeight: 400, fontStyle: 'italic' },
  ]
})

Font.registerHyphenationCallback((word) => [word])

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Lato',
    fontSize: 11,
    paddingTop: 54,
    paddingBottom: 54,
    paddingLeft: 60,
    paddingRight: 60,
    color: '#1a1a1a',
    lineHeight: 1.5,
  },
  name: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 11,
    color: '#444',
    marginBottom: 2,
  },
  reviewDate: {
    fontSize: 10,
    color: '#888',
    marginBottom: 24,
  },
  divider: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#d1d5db',
    marginBottom: 16,
  },
  sectionHeader: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: '#555',
    marginBottom: 6,
    marginTop: 16,
  },
  body: {
    fontSize: 11,
    lineHeight: 1.6,
    color: '#1a1a1a',
    marginBottom: 4,
  },
})

function parseDocument(text) {
  const lines = text.split('\n')
  const sections = []
  let currentSection = null
  let headerLines = []
  let headerDone = false

  for (const line of lines) {
    const trimmed = line.trim()

    // First 3 non-empty lines are the header (name, title/company, date)
    if (!headerDone) {
      if (trimmed) {
        headerLines.push(trimmed)
        if (headerLines.length === 3) headerDone = true
      }
      continue
    }

    if (!trimmed) {
      // blank line
      if (currentSection) currentSection.body.push('')
      continue
    }

    // ALL CAPS line = section header
    if (trimmed === trimmed.toUpperCase() && trimmed.length > 3 && !trimmed.startsWith('-')) {
      if (currentSection) sections.push(currentSection)
      currentSection = { header: trimmed, body: [] }
    } else {
      if (!currentSection) currentSection = { header: null, body: [] }
      currentSection.body.push(trimmed)
    }
  }
  if (currentSection) sections.push(currentSection)

  return { headerLines, sections }
}

export default function ReviewPrepPDF({ documentText }) {
  const { headerLines, sections } = parseDocument(documentText)

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        {headerLines[0] && <Text style={styles.name}>{headerLines[0]}</Text>}
        {headerLines[1] && <Text style={styles.subtitle}>{headerLines[1]}</Text>}
        {headerLines[2] && <Text style={styles.reviewDate}>{headerLines[2]}</Text>}

        <View style={styles.divider} />

        {/* Sections */}
        {sections.map((section, i) => (
          <View key={i}>
            {section.header && (
              <Text style={styles.sectionHeader}>{section.header}</Text>
            )}
            {section.body.map((line, j) => (
              line === '' ? (
                <Text key={j} style={{ fontSize: 6 }}> </Text>
              ) : (
                <Text key={j} style={styles.body}>{line}</Text>
              )
            ))}
          </View>
        ))}
      </Page>
    </Document>
  )
}