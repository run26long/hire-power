import React from 'react'
import { Document, Page, Text, View, Image, StyleSheet, Font } from '@react-pdf/renderer'
import path from 'path'

// ============================================================================
// THE REFERENCE SHEET
//
// What a candidate hands an employer who has asked for references: the people
// who said yes, how to reach them, and a line about what each of them said.
//
// EVERYBODY ON IT AGREED TO BE ON IT
// The route only includes rows where the referee ticked the box on their own
// page. Nobody's phone number reaches this document because a candidate typed
// it in, and nobody appears because their testimonial happened to be good.
// That is the whole reason the column exists.
//
// IT IS NOT THE PROFILE
// No accent colours, no gradient, no marketing. This gets printed, attached to
// an email, and read by somebody in a hurry who needs a name and a number. So
// it is a list, in the house PDF style, and the one flourish is the mark at
// the bottom saying where it came from.
// ============================================================================

const fontsDir = path.join(process.cwd(), 'public', 'fonts')
const logoPath = path.join(process.cwd(), 'public', 'images', 'HirePower_logo.png')

Font.register({
  family: 'Lato',
  fonts: [
    { src: path.join(fontsDir, 'Lato-Regular.ttf'), fontWeight: 400, fontStyle: 'normal' },
    { src: path.join(fontsDir, 'Lato-Bold.ttf'), fontWeight: 700, fontStyle: 'normal' },
    { src: path.join(fontsDir, 'Lato-Italic.ttf'), fontWeight: 400, fontStyle: 'italic' }
  ]
})

Font.registerHyphenationCallback((word) => [word])

const ACCENT = '#5b4fcf'
const INK = '#1a1a1a'
const MUTED = '#6b6b76'
const RULE = '#e2e2ea'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Lato',
    fontSize: 10,
    paddingTop: 54,
    paddingBottom: 64,
    paddingLeft: 60,
    paddingRight: 60,
    color: INK,
    lineHeight: 1.5
  },

  wordmark: {
    fontSize: 9,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: ACCENT,
    marginBottom: 6
  },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 2 },
  subtitle: { fontSize: 11, color: MUTED, marginBottom: 2 },
  issued: { fontSize: 8.5, color: MUTED, marginBottom: 18 },
  headRule: { borderBottomWidth: 1, borderBottomColor: RULE, marginBottom: 20 },

  // Each reference is kept whole across a page break: a name on one page and
  // its phone number on the next is the one thing this document must not do.
  entry: { marginBottom: 16 },
  name: { fontSize: 11.5, fontWeight: 700 },
  role: { fontSize: 9.5, color: MUTED, marginBottom: 3 },

  contactRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
  contact: { fontSize: 9.5, color: INK, marginRight: 16 },
  contactLabel: { fontSize: 8, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.6 },

  // Their words, indented behind a rule rather than in quotation marks: a
  // curly quote at 9pt is a smudge.
  quote: {
    fontSize: 9.5,
    fontStyle: 'italic',
    color: '#333340',
    borderLeftWidth: 2,
    borderLeftColor: RULE,
    paddingLeft: 10,
    marginTop: 4
  },

  empty: { fontSize: 10.5, color: MUTED, marginTop: 8 },

  brand: {
    marginTop: 26,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: RULE,
    flexDirection: 'column',
    alignItems: 'flex-start'
  },
  brandMark: { width: 74, marginBottom: 7 },
  brandText: { fontSize: 7.5, color: MUTED, lineHeight: 1.45 },

  footer: {
    position: 'absolute',
    bottom: 34,
    left: 60,
    right: 60,
    borderTopWidth: 1,
    borderTopColor: RULE,
    paddingTop: 8,
    fontSize: 7.5,
    color: MUTED,
    lineHeight: 1.4
  }
})

export default function ReferenceSheetPDF({ candidateName, issuedOn, references = [] }) {
  return (
    <Document
      title={`References: ${candidateName}`}
      author="Hire Power"
      subject={`Professional references for ${candidateName}`}
    >
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.wordmark}>Hire Power</Text>
        <Text style={styles.title}>{candidateName}</Text>
        <Text style={styles.subtitle}>Professional references</Text>
        <Text style={styles.issued}>
          {references.length} {references.length === 1 ? 'reference' : 'references'} · {issuedOn}
        </Text>
        <View style={styles.headRule} />

        {references.length === 0 ? (
          <Text style={styles.empty}>
            No references have agreed to be contacted yet. Anyone who writes a testimonial can
            offer to serve as a reference at the same time.
          </Text>
        ) : (
          references.map((person, index) => (
            <View key={index} style={styles.entry} wrap={false}>
              <Text style={styles.name}>{person.name}</Text>
              {person.role ? <Text style={styles.role}>{person.role}</Text> : null}

              <View style={styles.contactRow}>
                {person.email ? (
                  <Text style={styles.contact}>
                    <Text style={styles.contactLabel}>Email </Text>
                    {person.email}
                  </Text>
                ) : null}
                {person.phone ? (
                  <Text style={styles.contact}>
                    <Text style={styles.contactLabel}>Phone </Text>
                    {person.phone}
                  </Text>
                ) : null}
              </View>

              {person.quote ? <Text style={styles.quote}>{person.quote}</Text> : null}
            </View>
          ))
        )}

        <View style={styles.brand} wrap={false}>
          {/* react-pdf's Image is not an HTML img and takes no alt. */}
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image style={styles.brandMark} src={logoPath} />
          <Text style={styles.brandText}>Take your career beyond the page.</Text>
        </View>

        <View style={styles.footer} fixed>
          <Text>
            Everyone listed here agreed to be contacted as a reference for {candidateName}.
            Please treat their contact details as given in confidence.
          </Text>
        </View>
      </Page>
    </Document>
  )
}
