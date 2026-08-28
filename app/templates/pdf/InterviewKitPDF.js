import React from 'react'
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'

// Fonts load over HTTP from /public rather than the filesystem: this template
// renders in the browser, where path.join(process.cwd(), ...) has no meaning.
// The server-rendered PDFs register the same faces from disk.
Font.register({
  family: 'Lato',
  fonts: [
    { src: '/fonts/Lato-Regular.ttf', fontWeight: 400, fontStyle: 'normal' },
    { src: '/fonts/Lato-Bold.ttf', fontWeight: 700, fontStyle: 'normal' },
    { src: '/fonts/Lato-Italic.ttf', fontWeight: 400, fontStyle: 'italic' },
  ]
})

Font.registerHyphenationCallback((word) => [word])

// The accent the resume templates default to. It is the only purple any PDF in
// the codebase uses; the app's screen gradient is chrome and stays on screen.
const ACCENT = '#5b4fcf'

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
  wordmark: {
    fontSize: 9,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: ACCENT,
    marginBottom: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 2,
  },
  // Same line style as the subtitle, in the body colour: the candidate's own
  // name should read a step stronger than the role it sits above.
  candidateName: {
    fontSize: 11,
    color: '#1a1a1a',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 11,
    color: '#444',
    marginBottom: 2,
  },
  date: {
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
    color: ACCENT,
    marginBottom: 6,
    marginTop: 16,
  },
  body: {
    fontSize: 11,
    lineHeight: 1.6,
    color: '#1a1a1a',
    marginBottom: 4,
  },
  muted: {
    fontSize: 10,
    color: '#555',
    marginBottom: 2,
  },
  italicMuted: {
    fontSize: 10,
    color: '#555',
    fontStyle: 'italic',
    marginBottom: 2,
  },
  bold: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 2,
  },
  block: {
    marginBottom: 10,
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  bulletDot: {
    fontSize: 11,
    width: 12,
  },
  bulletText: {
    fontSize: 11,
    flex: 1,
    lineHeight: 1.5,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 60,
    right: 60,
    fontSize: 8,
    color: '#888',
    textAlign: 'center',
  },
})

// Descriptions are pasted plain text. Split on blank lines so paragraphs keep
// their shape instead of arriving as one wall of text.
function toParagraphs(text) {
  return String(text || '')
    .split(/\n\s*\n/)
    .map(p => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean)
}

// polishedStory is what coaching writes when a story completes. The raw STAR
// fields are the fallback for stories saved before polishing, or if it's blank.
function storyBody(story) {
  if (story?.polishedStory) return story.polishedStory
  return [story?.starSituation, story?.starTask, story?.starAction, story?.starResult]
    .filter(Boolean)
    .join(' ')
}

function Section({ title, children }) {
  return (
    <View>
      <Text style={styles.sectionHeader}>{title}</Text>
      {children}
    </View>
  )
}

function Bullet({ children }) {
  return (
    <View style={styles.bulletRow} wrap={false}>
      <Text style={styles.bulletDot}>{'•'}</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  )
}

export default function InterviewKitPDF({
  selected = {},
  jobCard,
  candidateName,
  storyTitleFor,
  coachedStories = [],
  highlights = [],
  questions = [],
  generatedOn,
}) {
  const subtitle = [jobCard?.title, jobCard?.company].filter(Boolean).join(' — ')

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.wordmark}>Hire Power</Text>
        <Text style={styles.title}>Interview Kit</Text>
        {candidateName ? <Text style={styles.candidateName}>{candidateName}</Text> : null}
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {generatedOn ? <Text style={styles.date}>Prepared {generatedOn}</Text> : null}

        <View style={styles.divider} />

        {selected.stories && coachedStories.length > 0 && (
          <Section title="STAR Stories">
            {coachedStories.map(story => (
              <View key={story.id} style={styles.block}>
                <Text style={styles.bold}>
                  {storyTitleFor ? storyTitleFor(story) : (story.itemSkill || 'Untitled story')}
                </Text>
                {story.itemSkill ? <Text style={styles.muted}>{story.itemSkill}</Text> : null}
                <Text style={styles.body}>{storyBody(story)}</Text>
              </View>
            ))}
          </Section>
        )}

        {selected.highlights && highlights.length > 0 && (
          <Section title="Company Highlights">
            {highlights.map((item, i) => <Bullet key={i}>{item}</Bullet>)}
          </Section>
        )}

        {selected.questions && questions.length > 0 && (
          <Section title="Questions For Your Interviewer">
            {questions.map((q, i) => (
              <View key={q.id || i} style={styles.block}>
                <Text style={styles.bold}>{q.tailored_text}</Text>
                {q.rationale ? <Text style={styles.italicMuted}>{q.rationale}</Text> : null}
              </View>
            ))}
          </Section>
        )}

        {selected.jobDescription && jobCard?.description && (
          <Section title="Job Description">
            {toParagraphs(jobCard.description).map((para, i) => (
              <Text key={i} style={styles.body}>{para}</Text>
            ))}
          </Section>
        )}

        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
        />
      </Page>
    </Document>
  )
}
