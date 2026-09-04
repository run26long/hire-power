import React from 'react'
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'
import path from 'path'

// Fonts load from disk: the kit is rendered server-side by
// /api/interview/interview-kit-pdf, the same way the review prep PDF is.
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

// The accent the resume templates default to. It is the only purple any PDF in
// the codebase uses; the app's screen gradient is chrome and stays on screen.
const ACCENT = '#5b4fcf'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Lato',
    fontSize: 10,
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
    fontSize: 10,
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
    fontSize: 10,
    fontWeight: 700,
    marginBottom: 2,
  },
  // Sits above the story title in the accent, the same micro-caps treatment
  // the section headers use, a step down in size.
  bucketTag: {
    fontSize: 8,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: ACCENT,
    marginBottom: 1,
  },
  block: {
    marginBottom: 10,
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  bulletDot: {
    fontSize: 10,
    width: 12,
  },
  bulletText: {
    fontSize: 10,
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

// Which bucket of the Power Analysis a story came from. Printed on the story
// so the candidate knows what they're holding: something to lead with, to
// reframe, or to have an answer ready for.
const BUCKET_LABELS = {
  core_power: 'Core Power',
  hidden_power: 'Hidden Power',
  power_gap: 'Power Gap',
}

function bucketLabel(itemType) {
  return BUCKET_LABELS[itemType] || null
}

// The Power Analysis buckets, in the order the screen shows them. Each names
// the field holding the item's title and the field holding its coaching, so
// three differently shaped bucket arrays print as one uniform list.
// The colour is the one the bucket carries on screen, darkened where the
// screen value is too light to read as small print on white.
const PA_BUCKETS = [
  { key: 'core_power', label: 'Core Power', title: 'skill', body: 'evidence', color: '#81c784' },
  { key: 'hidden_power', label: 'Hidden Power', title: 'skill', body: 'evidence_reframe', color: '#9333ea' },
  { key: 'power_gaps', label: 'Power Gaps', title: 'gap', body: 'bridge_strategy', color: '#ffc870' },
]

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
  powerAnalysis = null,
  candidateName,
  storyTitleFor,
  coachedStories = [],
  highlights = [],
  questions = [],
  generatedOn,
}) {
  const subtitle = [jobCard?.title, jobCard?.company].filter(Boolean).join(' — ')

  // An empty bucket drops out here rather than printing a heading with nothing
  // under it, and an analysis empty in all three drops the section.
  const paBuckets = PA_BUCKETS
    .map(bucket => ({
      ...bucket,
      items: Array.isArray(powerAnalysis?.[bucket.key]) ? powerAnalysis[bucket.key] : [],
    }))
    .filter(bucket => bucket.items.length > 0)

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.wordmark}>Hire Power</Text>
        <Text style={styles.title}>Interview Kit</Text>
        {candidateName ? <Text style={styles.candidateName}>{candidateName}</Text> : null}
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {generatedOn ? <Text style={styles.date}>Prepared {generatedOn}</Text> : null}

        <View style={styles.divider} />

        {selected.powerAnalysis && paBuckets.length > 0 && (
          <Section title="Power Analysis">
            {paBuckets.map(bucket => (
              <View key={bucket.key}>
                <Text style={[styles.bucketTag, { color: bucket.color }]}>{bucket.label}</Text>
                {bucket.items.map((item, i) => (
                  <View key={i} style={styles.block} wrap={false}>
                    <Text style={styles.bold}>{item?.[bucket.title] || 'Untitled'}</Text>
                    {item?.[bucket.body] ? (
                      <Text style={styles.body}>{item[bucket.body]}</Text>
                    ) : null}
                  </View>
                ))}
              </View>
            ))}
          </Section>
        )}

        {selected.stories && coachedStories.length > 0 && (
          <Section title="STAR Stories">
            {coachedStories.map(story => (
              <View key={story.id} style={styles.block}>
                {bucketLabel(story.itemType) ? (
                  <Text style={styles.bucketTag}>{bucketLabel(story.itemType)}</Text>
                ) : null}
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
