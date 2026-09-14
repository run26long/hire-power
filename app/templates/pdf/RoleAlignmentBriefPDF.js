import React from 'react'
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'
import path from 'path'

// ============================================================================
// THE ROLE ALIGNMENT BRIEF
//
// What a recruiter takes away from an evaluation: the candidate's background
// mapped against one role, on paper, in the same house style as every other PDF
// in this codebase.
//
// Two things it deliberately is not.
//
// It carries no score, no percentage, no bar, no rating. A number invites a
// cutoff, and a cutoff applied to somebody's career by a document they never
// saw is not what this is for. The strengths and the gaps say what they say,
// and a reader draws their own conclusion from the evidence beside them.
//
// It is text, not a picture of text. Every line below is a real Text node, so
// the brief can be searched, quoted, and read by a screen reader.
// ============================================================================

const fontsDir = path.join(process.cwd(), 'public', 'fonts')

Font.register({
  family: 'Lato',
  fonts: [
    { src: path.join(fontsDir, 'Lato-Regular.ttf'), fontWeight: 400, fontStyle: 'normal' },
    { src: path.join(fontsDir, 'Lato-Bold.ttf'), fontWeight: 700, fontStyle: 'normal' },
    { src: path.join(fontsDir, 'Lato-Italic.ttf'), fontWeight: 400, fontStyle: 'italic' }
  ]
})

Font.registerHyphenationCallback((word) => [word])

// The accent every PDF in this codebase uses. The profile's own lavender is a
// screen colour and stays on screen.
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
  role: { fontSize: 11, color: MUTED, marginBottom: 2 },
  issued: { fontSize: 8.5, color: MUTED, marginBottom: 18 },
  headRule: { borderBottomWidth: 1, borderBottomColor: RULE, marginBottom: 20 },

  section: { marginBottom: 18 },
  sectionTitle: {
    fontSize: 9,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: ACCENT,
    marginBottom: 8
  },

  summary: { fontSize: 10.5, lineHeight: 1.6 },

  // Each entry is kept whole across a page break: a strength split from the
  // evidence under it reads as an unsupported assertion on the next page.
  entry: { marginBottom: 11 },
  entryTitle: { fontSize: 10, fontWeight: 700, marginBottom: 2 },
  entryBody: { fontSize: 9.5, color: INK },
  entryCite: { fontSize: 8, color: MUTED, marginTop: 2 },

  roleLine: { fontSize: 10, fontWeight: 700 },
  roleMeta: { fontSize: 9, color: MUTED, marginBottom: 3 },
  bullet: { fontSize: 9.5, marginLeft: 10, marginBottom: 1 },

  quote: { fontSize: 9.5, fontStyle: 'italic', lineHeight: 1.55 },
  quoteBy: { fontSize: 8.5, color: MUTED, marginTop: 2 },

  citeItem: { fontSize: 8, color: MUTED, marginBottom: 1 },

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

const Section = ({ title, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
)

export default function RoleAlignmentBriefPDF({
  candidateName,
  roleTitle,
  company,
  issuedOn,
  evaluation,
  profileUrl
}) {
  const {
    match_summary: summary,
    strengths = [],
    gaps = [],
    relevant_experience: experience = [],
    relevant_testimonials: testimonials = []
  } = evaluation || {}

  // The line under the title. Either part may be missing - the evaluation
  // returns null rather than guessing - so the line is assembled from what is
  // actually there and omitted entirely when neither is.
  const roleLine = [roleTitle, company].filter(Boolean).join(' · ')

  // Every source named anywhere in the brief, listed once at the end so a
  // reader can see the whole basis for it in one place.
  const cited = new Map()
  for (const s of strengths) {
    for (const c of (s.citations || [])) if (!cited.has(c.id)) cited.set(c.id, c)
  }

  return (
    <Document
      title={`Role Alignment Brief — ${candidateName}`}
      author="Hire Power"
      subject={roleLine || 'Role alignment brief'}
    >
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.wordmark}>Hire Power</Text>
        <Text style={styles.title}>{candidateName}</Text>
        {roleLine ? <Text style={styles.role}>{roleLine}</Text> : null}
        <Text style={styles.issued}>Role Alignment Brief · {issuedOn}</Text>
        <View style={styles.headRule} />

        {summary ? (
          <Section title="Summary">
            <Text style={styles.summary}>{summary}</Text>
          </Section>
        ) : null}

        {strengths.length > 0 ? (
          <Section title="Where the background matches">
            {strengths.map((s, i) => (
              <View key={i} style={styles.entry} wrap={false}>
                <Text style={styles.entryTitle}>{s.area}</Text>
                <Text style={styles.entryBody}>{s.evidence}</Text>
                {(s.citations || []).length > 0 ? (
                  <Text style={styles.entryCite}>
                    Source: {s.citations.map(c => c.label).join('; ')}
                  </Text>
                ) : null}
              </View>
            ))}
          </Section>
        ) : null}

        {gaps.length > 0 ? (
          <Section title="Not evidenced in the profile">
            {gaps.map((g, i) => (
              <View key={i} style={styles.entry} wrap={false}>
                <Text style={styles.entryTitle}>{g.area}</Text>
                <Text style={styles.entryBody}>{g.note}</Text>
              </View>
            ))}
          </Section>
        ) : null}

        {experience.length > 0 ? (
          <Section title="Relevant experience">
            {experience.map((r, i) => (
              <View key={i} style={styles.entry} wrap={false}>
                <Text style={styles.roleLine}>{r.title}</Text>
                <Text style={styles.roleMeta}>
                  {[r.company, r.dates].filter(Boolean).join(' · ')}
                </Text>
                {r.why ? <Text style={styles.entryBody}>{r.why}</Text> : null}
                {(r.bullets || []).map((b, j) => (
                  <Text key={j} style={styles.bullet}>• {b}</Text>
                ))}
              </View>
            ))}
          </Section>
        ) : null}

        {testimonials.length > 0 ? (
          <Section title="What others said">
            {testimonials.map((t, i) => (
              <View key={i} style={styles.entry} wrap={false}>
                <Text style={styles.quote}>“{t.quote}”</Text>
                <Text style={styles.quoteBy}>
                  {t.attribution}{t.why ? ` — ${t.why}` : ''}
                </Text>
              </View>
            ))}
          </Section>
        ) : null}

        {cited.size > 0 ? (
          <Section title="Sources">
            {[...cited.values()].map((c, i) => (
              <Text key={i} style={styles.citeItem}>• {c.label}</Text>
            ))}
          </Section>
        ) : null}

        {/* Fixed, so it is on every page of a brief that runs long. It says
            where this came from and what it is not: an assessment drawn from
            one person's own record, rather than a reference or a rating. */}
        <View style={styles.footer} fixed>
          <Text>
            Generated from {candidateName}&apos;s Career Profile{profileUrl ? ` · ${profileUrl}` : ''}.
            Every statement above is drawn from material the candidate recorded themselves.
          </Text>
        </View>
      </Page>
    </Document>
  )
}
