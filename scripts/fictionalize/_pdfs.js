// ============================================================================
// THE FOUR GENERATED PDFs
//
// Built with @react-pdf/renderer, which the project already depends on, driven
// through React.createElement rather than JSX so these stay plain .js scripts
// that node runs with no build step.
//
// A NOTE ON THE CERTIFICATES
// Every issuing body named on these is invented, and each carries a SPECIMEN
// line. That is deliberate. The whole point of this exercise is that the person
// is fictional, so their credentials should be issued by fictional bodies too;
// and a realistic certificate bearing a real awarding organisation's name is a
// forgeable document whether or not it was made for a test database. The
// credential titles themselves are left as written because those are the words
// a candidate would actually put on a profile, and they are what the layouts
// have to render.
// ============================================================================

const React = require('react')
const h = React.createElement

const INK = '#14161a'
const MUTED = '#5f6570'
const ACCENT = '#5b4fcf'
const LINE = '#d9dce3'
const SOFT = '#f4f5f8'

const CANDIDATE = 'Daniel Mercer'

// ---------------------------------------------------------------------------
// Certificates
// ---------------------------------------------------------------------------
function certificate({ issuer, issuerLine, award, detail, recipient, date, credentialId, signatories = [], specimenTone }) {
  const { Document, Page, Text, View, StyleSheet } = require('@react-pdf/renderer')

  const s = StyleSheet.create({
    // The vertical budget is tight and deliberate: A4 landscape leaves about
    // 450pt of usable height once the frame is drawn, and the first draft of
    // this spilled the SPECIMEN line onto a second page.
    page: { paddingVertical: 38, paddingHorizontal: 56, fontFamily: 'Helvetica', backgroundColor: '#fff' },
    outer: { flexGrow: 1, borderWidth: 2, borderColor: ACCENT, padding: 4 },
    inner: { flexGrow: 1, borderWidth: 0.75, borderColor: LINE, paddingTop: 34, paddingBottom: 20, paddingHorizontal: 44, alignItems: 'center' },
    issuer: { fontSize: 17, fontFamily: 'Helvetica-Bold', color: ACCENT, letterSpacing: 2.5, textAlign: 'center' },
    issuerLine: { fontSize: 8.5, color: MUTED, letterSpacing: 1.4, marginTop: 6, textAlign: 'center' },
    rule: { width: 88, height: 2, backgroundColor: ACCENT, marginTop: 16, marginBottom: 20 },
    certifies: { fontSize: 10, color: MUTED, letterSpacing: 2.2, marginBottom: 12 },
    name: { fontSize: 33, fontFamily: 'Times-Roman', color: INK, marginBottom: 6, textAlign: 'center' },
    nameRule: { width: 300, height: 0.75, backgroundColor: LINE, marginBottom: 16 },
    lead: { fontSize: 10.5, color: MUTED, marginBottom: 10, textAlign: 'center' },
    award: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: INK, textAlign: 'center', marginBottom: 10 },
    detail: { fontSize: 9.5, color: MUTED, textAlign: 'center', lineHeight: 1.6, maxWidth: 420, marginBottom: 20 },
    metaRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 22 },
    metaCell: { paddingHorizontal: 22, alignItems: 'center' },
    metaLabel: { fontSize: 7, color: MUTED, letterSpacing: 1.3, marginBottom: 4 },
    metaValue: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: INK },
    sigRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 'auto', paddingTop: 8 },
    sigCell: { width: 190, alignItems: 'center' },
    sigScript: { fontSize: 15, fontFamily: 'Times-Italic', color: INK, marginBottom: 5 },
    sigRule: { width: '100%', height: 0.75, backgroundColor: LINE, marginBottom: 6 },
    sigName: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: INK },
    sigRole: { fontSize: 7.5, color: MUTED, marginTop: 2 },
    specimen: { fontSize: 6.5, color: MUTED, letterSpacing: 0.9, textAlign: 'center', marginTop: 14 }
  })

  return h(Document, {}, h(Page, { size: 'A4', orientation: 'landscape', style: s.page },
    h(View, { style: s.outer },
      h(View, { style: s.inner },
        h(Text, { style: s.issuer }, issuer.toUpperCase()),
        h(Text, { style: s.issuerLine }, issuerLine.toUpperCase()),
        h(View, { style: s.rule }),
        h(Text, { style: s.certifies }, 'THIS CERTIFIES THAT'),
        h(Text, { style: s.name }, recipient),
        h(View, { style: s.nameRule }),
        h(Text, { style: s.lead }, 'has met every requirement for the designation of'),
        h(Text, { style: s.award }, award),
        h(Text, { style: s.detail }, detail),
        h(View, { style: s.metaRow },
          h(View, { style: s.metaCell },
            h(Text, { style: s.metaLabel }, 'DATE OF AWARD'),
            h(Text, { style: s.metaValue }, date)),
          h(View, { style: s.metaCell },
            h(Text, { style: s.metaLabel }, 'CREDENTIAL ID'),
            h(Text, { style: s.metaValue }, credentialId))
        ),
        h(View, { style: s.sigRow },
          ...signatories.map((sig, i) => h(View, { style: s.sigCell, key: String(i) },
            h(Text, { style: s.sigScript }, sig.script),
            h(View, { style: s.sigRule }),
            h(Text, { style: s.sigName }, sig.name),
            h(Text, { style: s.sigRole }, sig.role)
          ))
        ),
        h(Text, { style: specimenTone ? { ...s.specimen, color: specimenTone, fontSize: 7.5, fontFamily: 'Helvetica-Bold' } : s.specimen },
          specimenTone
            ? 'SPECIMEN DOCUMENT. Not a real credential and not issued by the organisation named. '
              + 'Generated as fixture data for interface testing.'
            : 'SPECIMEN DOCUMENT. Issuing body and credential are fictional, generated for interface testing.')
      )
    )
  ))
}

const LEAN_SIX_SIGMA = () => certificate({
  issuer: 'Continuum Quality Institute',
  issuerLine: 'Process Excellence Certification Board',
  recipient: CANDIDATE,
  award: 'Lean Six Sigma Black Belt',
  detail:
    'Awarded on completion of 160 hours of instruction in statistical process control, value stream '
    + 'mapping, and design of experiments, and on the defence of two supervised improvement projects '
    + 'delivering verified reductions in cycle time and defect rate.',
  date: '14 March 2019',
  credentialId: 'CQI-BB-19-04471',
  signatories: [
    { script: 'H. Okafor', name: 'Helena Okafor', role: 'Director of Certification' },
    { script: 'R. Lindqvist', name: 'Rasmus Lindqvist', role: 'Chair, Examination Board' }
  ]
})

const PMP = () => certificate({
  issuer: 'Meridian Project Institute',
  issuerLine: 'Global Register of Project Practitioners',
  recipient: CANDIDATE,
  award: 'Project Management Professional',
  detail:
    'Awarded on evidence of 7,500 hours directing and leading projects, 35 hours of formal project '
    + 'management education, and a passing result in the examination covering initiation, planning, '
    + 'execution, monitoring and control, and closing.',
  date: '9 September 2020',
  credentialId: 'MPI-PMP-20-88132',
  signatories: [
    { script: 'A. Varga', name: 'Anna Varga', role: 'Registrar' },
    { script: 'D. Mbeki', name: 'Daniel Mbeki', role: 'President' }
  ]
})

// The one certificate here that names a real organisation, because it was
// asked for by name. The SPECIMEN line matters more on this one than on the
// others and is set in the accent rather than the muted grey for that reason:
// what stops a document like this being forgeable is that it says so on its
// face, not that nobody happens to look at it.
const AMA_LEADERSHIP = () => certificate({
  issuer: 'American Management Association',
  issuerLine: 'Executive and Leadership Development',
  recipient: CANDIDATE,
  award: 'Leadership Development Program',
  detail:
    'Awarded on completion of the six-module programme in leading through influence, coaching for '
    + 'performance, structured delegation, and developing supervisors into managers who own a standard '
    + 'rather than enforce one.',
  date: '30 October 2021',
  credentialId: 'AMA-LDP-21-60518',
  specimenTone: ACCENT
})

const OSHA_LEADERSHIP = () => certificate({
  issuer: 'National Workplace Safety Council',
  issuerLine: 'Industrial Safety Leadership Programme',
  recipient: CANDIDATE,
  award: 'Safety Leadership in General Industry',
  detail:
    'Awarded on completion of the 30-hour general industry syllabus together with the supervisory '
    + 'leadership module, covering hazard identification, machine guarding, lockout and tagout, fall '
    + 'protection, and the written floor standards that carry them onto a production line.',
  date: '22 June 2018',
  credentialId: 'NWSC-SL-18-23907',
  signatories: [
    { script: 'M. Castellanos', name: 'Marisol Castellanos', role: 'Programme Director' },
    { script: 'T. Whitmore', name: 'Terrence Whitmore', role: 'Lead Instructor' }
  ]
})

// ---------------------------------------------------------------------------
// The case study
//
// Every figure here already exists in this account's data: the resume bullets,
// career_knowledge, and the two published testimonials.
// ---------------------------------------------------------------------------
// The case-study sheet, made once and shared, so a second case study cannot
// drift from the first by a margin here and a point size there.
function caseStudyStyles() {
  const { StyleSheet } = require('@react-pdf/renderer')

  return StyleSheet.create({
    page: { paddingTop: 52, paddingBottom: 56, paddingHorizontal: 58, fontFamily: 'Helvetica', fontSize: 10, color: INK },
    eyebrow: { fontSize: 7.5, letterSpacing: 2, color: ACCENT, fontFamily: 'Helvetica-Bold', marginBottom: 10 },
    title: { fontSize: 22, fontFamily: 'Helvetica-Bold', lineHeight: 1.25, marginBottom: 8 },
    standfirst: { fontSize: 11, color: MUTED, lineHeight: 1.55, marginBottom: 16 },
    rule: { height: 2, backgroundColor: ACCENT, width: 54, marginBottom: 20 },
    metaBar: { flexDirection: 'row', borderTopWidth: 0.75, borderBottomWidth: 0.75, borderColor: LINE, paddingVertical: 9, marginBottom: 20 },
    metaCell: { flex: 1 },
    metaLabel: { fontSize: 6.5, letterSpacing: 1.1, color: MUTED, marginBottom: 3 },
    metaValue: { fontSize: 9, fontFamily: 'Helvetica-Bold' },
    heading: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 16, marginBottom: 7 },
    body: { fontSize: 10, lineHeight: 1.65, color: '#23262c', marginBottom: 9, textAlign: 'justify' },
    bullet: { flexDirection: 'row', marginBottom: 7, paddingRight: 8 },
    dot: { width: 13, fontSize: 10, color: ACCENT, fontFamily: 'Helvetica-Bold' },
    bulletText: { flex: 1, fontSize: 10, lineHeight: 1.6, color: '#23262c' },
    statRow: { flexDirection: 'row', marginTop: 6, marginBottom: 14 },
    stat: { flex: 1, backgroundColor: SOFT, borderLeftWidth: 2.5, borderLeftColor: ACCENT, paddingVertical: 10, paddingHorizontal: 11, marginRight: 8 },
    statNum: { fontSize: 17, fontFamily: 'Helvetica-Bold', color: ACCENT },
    statLabel: { fontSize: 7.5, color: MUTED, marginTop: 4, lineHeight: 1.45 },
    tableHead: { flexDirection: 'row', backgroundColor: SOFT, paddingVertical: 7, paddingHorizontal: 9 },
    th: { fontSize: 7, letterSpacing: 1, color: MUTED, fontFamily: 'Helvetica-Bold' },
    tr: { flexDirection: 'row', paddingVertical: 7, paddingHorizontal: 9, borderBottomWidth: 0.5, borderColor: LINE },
    td: { fontSize: 9, color: '#23262c' },
    quote: { borderLeftWidth: 2.5, borderLeftColor: ACCENT, paddingLeft: 13, paddingVertical: 4, marginTop: 10, marginBottom: 12 },
    quoteText: { fontSize: 10, fontFamily: 'Times-Italic', lineHeight: 1.6, color: '#23262c' },
    quoteWho: { fontSize: 8, color: MUTED, marginTop: 6 },
    footer: { position: 'absolute', bottom: 30, left: 58, right: 58, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderColor: LINE, paddingTop: 8 },
    footerText: { fontSize: 7.5, color: MUTED }
  })
}

function caseStudy() {
  const { Document, Page, Text, View } = require('@react-pdf/renderer')
  const s = caseStudyStyles()

  const bullet = (t, k) => h(View, { style: s.bullet, key: k },
    h(Text, { style: s.dot }, '•'), h(Text, { style: s.bulletText }, t))

  // Page numbers come from the renderer, not from a constant. An earlier draft
  // hardcoded "of 2" and then quietly ran to three pages.
  const footer = () => h(View, { style: s.footer, fixed: true },
    h(Text, { style: s.footerText }, 'Rebuilding Delivery Performance at Apex Manufacturing'),
    h(Text, {
      style: s.footerText,
      render: ({ pageNumber, totalPages }) => CANDIDATE + '  ·  Page ' + pageNumber + ' of ' + totalPages
    }))

  const cell = (w) => ({ width: w })

  return h(Document, {},
    // ---- PAGE ONE ----
    h(Page, { size: 'A4', style: s.page },
      h(Text, { style: s.eyebrow }, 'OPERATIONS CASE STUDY'),
      h(Text, { style: s.title }, 'Rebuilding Delivery Performance at Apex Manufacturing'),
      h(Text, { style: s.standfirst },
        'A specialty vehicle upfitter where nothing was shipping on time, rebuilt in fifty days around '
        + 'three changes: make the work visible, move the quality check into the department that does '
        + 'it, and resequence the floor.'),
      h(View, { style: s.rule }),

      h(View, { style: s.metaBar },
        h(View, { style: s.metaCell },
          h(Text, { style: s.metaLabel }, 'ORGANISATION'),
          h(Text, { style: s.metaValue }, 'Apex Manufacturing')),
        h(View, { style: s.metaCell },
          h(Text, { style: s.metaLabel }, 'ROLE'),
          h(Text, { style: s.metaValue }, 'Managing Director')),
        h(View, { style: s.metaCell },
          h(Text, { style: s.metaLabel }, 'SECTOR'),
          h(Text, { style: s.metaValue }, 'Specialty vehicle upfitting')),
        h(View, { style: s.metaCell },
          h(Text, { style: s.metaLabel }, 'PERIOD'),
          h(Text, { style: s.metaValue }, '2023, first 90 days'))
      ),

      h(Text, { style: s.heading }, 'The situation'),
      h(Text, { style: s.body },
        'Apex Manufacturing built specialty vehicles to order on a single upfitting line. The order book was '
        + 'healthy and the work was good, but almost nothing left the building on the date it had been '
        + 'promised. The board wanted to know whether the problem was the people, the pricing or the plant.'),
      h(Text, { style: s.body },
        'It was none of those. The company had no way of knowing where any job was. Status lived in the heads '
        + 'of the people doing the work, so a job was discovered to be late at the point it became late, '
        + 'which is the point at which nothing can be done about it. Quality was inspected once, at the end '
        + 'of the line, so a wiring error made in the second hour of a four-day build was found on day four '
        + 'and corrected by people who had not made it. Assembly lost one to two hours every day to rework '
        + 'caused upstream. Twenty-five people worked a floor laid out for a product it no longer built, and '
        + 'roughly $3M of annual spend was committed against forecasts nobody trusted.'),

      h(Text, { style: s.heading }, 'What was done, in order'),
      bullet('Week one: walked the line and timed every stage before changing anything. The bottleneck was '
        + 'not where the team believed it was.', 'b1'),
      bullet("Week two: built the company's first WIP report. Every active job, its stage and its committed "
        + 'date on one page, updated daily. Bottlenecks that had taken weeks to surface became visible within '
        + 'hours.', 'b2'),
      bullet('Weeks three to five: replaced end-of-line inspection with departmental QC standards. Written '
        + 'pass criteria per department, and work did not advance until the department that did it signed it '
        + 'off.', 'b3'),
      bullet('Weeks four to seven: resequenced the floor into a single direction of travel, with '
        + 'manufacturing templates for the repeating build types, cutting six queues back to one line.', 'b4'),
      bullet('Throughout: shifted material purchasing from overstock ordering to deposit-based buying against '
        + 'confirmed orders, taking carrying cost down without risking a stockout.', 'b5'),

      footer()
    ),

    // ---- PAGE TWO ----
    h(Page, { size: 'A4', style: s.page },
      h(Text, { style: s.heading }, 'Results'),
      h(View, { style: s.statRow },
        h(View, { style: s.stat },
          h(Text, { style: s.statNum }, '100%'),
          h(Text, { style: s.statLabel }, 'on-time delivery,\nreached within 50 days')),
        h(View, { style: s.stat },
          h(Text, { style: s.statNum }, '25 to 13'),
          h(Text, { style: s.statLabel }, 'headcount, with output\nand delivery both up')),
        h(View, { style: s.stat },
          h(Text, { style: s.statNum }, '0 hrs'),
          h(Text, { style: s.statLabel }, 'daily assembly rework,\nfrom 1 to 2 hours')),
        h(View, { style: { ...s.stat, marginRight: 0 } },
          h(Text, { style: s.statNum }, '$2M-$3M'),
          h(Text, { style: s.statLabel }, 'new pipeline converted\nin the same quarter'))
      ),

      h(View, { style: s.tableHead },
        h(Text, { style: { ...s.th, ...cell('38%') } }, 'MEASURE'),
        h(Text, { style: { ...s.th, ...cell('22%') } }, 'ON ARRIVAL'),
        h(Text, { style: { ...s.th, ...cell('22%') } }, 'DAY 50'),
        h(Text, { style: { ...s.th, ...cell('18%') } }, 'HELD AT')
      ),
      ...[
        ['On-time delivery', '41%', '100%', '100%'],
        ['Open WIP items', '64', '19', '17 to 22'],
        ['Time to see a bottleneck', '2 to 3 weeks', 'Same day', 'Same day'],
        ['Daily assembly rework', '1 to 2 hours', 'None', 'None'],
        ['Headcount', '25', '13', '13'],
        ['Material carrying cost', 'Overstock', 'Deposit-based', 'Deposit-based']
      ].map((r, i) => h(View, { style: s.tr, key: 'r' + i },
        h(Text, { style: { ...s.td, ...cell('38%'), fontFamily: 'Helvetica-Bold' } }, r[0]),
        h(Text, { style: { ...s.td, ...cell('22%'), color: MUTED } }, r[1]),
        h(Text, { style: { ...s.td, ...cell('22%'), color: ACCENT, fontFamily: 'Helvetica-Bold' } }, r[2]),
        h(Text, { style: { ...s.td, ...cell('18%'), color: MUTED } }, r[3])
      )),

      h(Text, { style: s.heading }, 'Why the headcount fell'),
      h(Text, { style: s.body },
        'The reduction from twenty-five to thirteen was an outcome, not a target, and the order of events '
        + 'matters. Nobody was removed to hit a number. Once the rework stopped, once jobs stopped being '
        + 'built twice, and once the floor ran in one direction, the line needed fewer hands to produce more '
        + 'than it had before. The roles that disappeared existed to absorb the disorder.'),

      h(Text, { style: s.heading }, 'What made it hold'),
      h(Text, { style: s.body },
        'Every one of these changes has been made at other plants and quietly reversed within a year, usually '
        + 'because the standard belonged to the person who introduced it. Here the QC standards were written '
        + 'by the departments that had to meet them, and supervisors were taught the reasoning behind each '
        + 'criterion rather than told which correction to apply. Four of the seven department leads at the '
        + 'end of the period had been operators at the start of it.'),

      h(View, { style: s.quote },
        h(Text, { style: s.quoteText },
          '"We brought Daniel in because nothing was shipping on time. Within fifty days every active '
          + 'account was delivering on schedule, and he did it while reducing the team from twenty-five to '
          + 'thirteen. He does not just fix the number, he rebuilds the system underneath it so it holds."'),
        h(Text, { style: s.quoteWho }, 'Ellen Brightwater, Board Member, Apex Manufacturing')
      ),

      footer()
    )
  )
}

// ---------------------------------------------------------------------------
// The second case study: the QC change on its own
//
// Same Apex Manufacturing engagement as the first, narrowed to the one change
// the first could only give five bullets to. Every figure here is already on
// this profile: the 1 to 2 hours of daily assembly rework caused by upstream
// engineering errors, the end-of-line inspection it replaced, the 25 to 13
// headcount, the 100% on-time inside 50 days, the six stations on the
// upfitting line, and Tomas Duarte's published testimonial. No second employer,
// no outside body, no number that is not already claimed elsewhere on the page.
// ---------------------------------------------------------------------------
function reworkCaseStudy() {
  const { Document, Page, Text, View } = require('@react-pdf/renderer')
  const s = caseStudyStyles()

  const bullet = (t, k) => h(View, { style: s.bullet, key: k },
    h(Text, { style: s.dot }, '•'), h(Text, { style: s.bulletText }, t))

  const footer = () => h(View, { style: s.footer, fixed: true },
    h(Text, { style: s.footerText }, 'Eliminating Rework Through Departmental Quality Control'),
    h(Text, {
      style: s.footerText,
      render: ({ pageNumber, totalPages }) => CANDIDATE + '  ·  Page ' + pageNumber + ' of ' + totalPages
    }))

  const cell = (w) => ({ width: w })

  return h(Document, {},
    h(Page, { size: 'A4', style: s.page },
      h(Text, { style: s.eyebrow }, 'OPERATIONS CASE STUDY'),
      h(Text, { style: s.title }, 'Eliminating Rework Through Departmental Quality Control'),
      h(Text, { style: s.standfirst },
        'An upfitting line inspected its work once, at the end. Moving the check into the department '
        + 'that did the work removed one to two hours of assembly rework every day, and did it without '
        + 'adding a single inspector.'),
      h(View, { style: s.rule }),

      h(View, { style: s.metaBar },
        h(View, { style: s.metaCell },
          h(Text, { style: s.metaLabel }, 'ORGANISATION'),
          h(Text, { style: s.metaValue }, 'Apex Manufacturing')),
        h(View, { style: s.metaCell },
          h(Text, { style: s.metaLabel }, 'ROLE'),
          h(Text, { style: s.metaValue }, 'Managing Director')),
        h(View, { style: s.metaCell },
          h(Text, { style: s.metaLabel }, 'SCOPE'),
          h(Text, { style: s.metaValue }, 'Six stations, one line')),
        h(View, { style: s.metaCell },
          h(Text, { style: s.metaLabel }, 'PERIOD'),
          h(Text, { style: s.metaValue }, '2023, weeks 3 to 5'))
      ),

      h(Text, { style: s.heading }, 'Where the rework came from'),
      h(Text, { style: s.body },
        'Quality was checked once, after paint, by people who had not built the unit. A wiring error '
        + 'introduced in the second hour of a four-day build was therefore found on day four, by which '
        + 'point three more stations had worked on top of it. Assembly was losing one to two hours every '
        + 'day to corrections of this kind, and the errors were largely upstream engineering ones rather '
        + 'than mistakes made at the bench being asked to fix them.'),
      h(Text, { style: s.body },
        'The cost was not only the hours. A defect found at the end is a defect nobody owns: the station '
        + 'that caused it has moved on, the station correcting it did not make it, and the line learns '
        + 'nothing either way. That is the part an extra inspector would not have fixed.'),

      h(Text, { style: s.heading }, 'The change'),
      bullet('Each of the six stations - cut, weld, assembly, wiring, paint and final - was given written '
        + 'pass criteria for its own work, rather than one specification for the finished unit.', 'r1'),
      bullet('Work stopped advancing until the department that did it signed it off. A unit that failed '
        + 'its own station’s criteria went back to that station, not forward to the next one.', 'r2'),
      bullet('The criteria were written by the departments that had to meet them. A standard handed down '
        + 'to a bench is a standard that bench works around.', 'r3'),
      bullet('Supervisors were taught the reasoning behind each criterion rather than told which '
        + 'correction to apply, so a case the criteria did not anticipate still got judged correctly.', 'r4'),
      bullet('End-of-line inspection was retired rather than kept alongside. Running both would have left '
        + 'the last check as the one that counted, and the station checks as paperwork.', 'r5'),

      footer()
    ),

    h(Page, { size: 'A4', style: s.page },
      h(Text, { style: s.heading }, 'What it changed'),
      h(View, { style: s.statRow },
        h(View, { style: s.stat },
          h(Text, { style: s.statNum }, '0 hrs'),
          h(Text, { style: s.statLabel }, 'daily assembly rework,\nfrom 1 to 2 hours')),
        h(View, { style: s.stat },
          h(Text, { style: s.statNum }, '6 of 6'),
          h(Text, { style: s.statLabel }, 'stations checking\ntheir own work')),
        h(View, { style: { ...s.stat, marginRight: 0 } },
          h(Text, { style: s.statNum }, '0'),
          h(Text, { style: s.statLabel }, 'inspectors added to\nmake the change'))
      ),

      h(View, { style: s.tableHead },
        h(Text, { style: { ...s.th, ...cell('46%') } }, 'MEASURE'),
        h(Text, { style: { ...s.th, ...cell('27%') } }, 'END-OF-LINE MODEL'),
        h(Text, { style: { ...s.th, ...cell('27%') } }, 'DEPARTMENTAL MODEL')
      ),
      ...[
        ['Where a defect is found', 'After paint', 'At the station that made it'],
        ['Who corrects it', 'Whoever is at the end', 'Whoever made it'],
        ['Daily assembly rework', '1 to 2 hours', 'None'],
        ['What the line learns', 'Nothing', 'The cause, at the bench'],
        ['Inspection headcount', 'A final check', 'None separate']
      ].map((r, i) => h(View, { style: s.tr, key: 'q' + i },
        h(Text, { style: { ...s.td, ...cell('46%'), fontFamily: 'Helvetica-Bold' } }, r[0]),
        h(Text, { style: { ...s.td, ...cell('27%'), color: MUTED } }, r[1]),
        h(Text, { style: { ...s.td, ...cell('27%'), color: ACCENT, fontFamily: 'Helvetica-Bold' } }, r[2])
      )),

      h(Text, { style: s.heading }, 'What it made possible'),
      h(Text, { style: s.body },
        'This was one of three changes made in the first fifty days, and on its own it did not restore '
        + 'the delivery record. What it did was remove the work that was not building anything. Once the '
        + 'line stopped rebuilding its own mistakes, the same output no longer needed the same number of '
        + 'hands, and the reduction from twenty-five people to thirteen followed from that rather than '
        + 'from a target. Every active account was delivering on schedule within fifty days.'),

      h(Text, { style: s.heading }, 'Why it held'),
      h(Text, { style: s.body },
        'A quality standard usually leaves with the person who introduced it. This one did not belong to '
        + 'that person: it was written by the departments it governed, and the supervisors running it had '
        + 'been taught why each criterion existed rather than what to do when it failed. That is the '
        + 'difference between a rule a line follows and one it understands.'),

      h(View, { style: s.quote },
        h(Text, { style: s.quoteText },
          '"He put the QC checks inside each department instead of at the end, which stopped us '
          + 'rebuilding other people’s mistakes."'),
        h(Text, { style: s.quoteWho }, 'Tomas Duarte, Production Lead, Apex Manufacturing')
      ),

      footer()
    )
  )
}

async function render(docFactory) {
  const { renderToBuffer, Font } = await import('@react-pdf/renderer')
  // Off by default it is not: the renderer hyphenates, and left alone it broke
  // the case study's own title as "Apex Man-ufacturing". Returning the word
  // whole is how this library is told never to split one.
  Font.registerHyphenationCallback(word => [word])
  return renderToBuffer(docFactory())
}

const DOCUMENTS = [
  {
    key: 'lean-six-sigma-black-belt',
    doc: LEAN_SIX_SIGMA,
    title: 'Lean Six Sigma Black Belt',
    description: 'Statistical process control, value stream mapping, and design of experiments, with two supervised improvement projects defended before the examination board. The waste analysis and flow methods behind the floor redesigns.',
    evidence_type: 'Certification',
    organization: 'Continuum Quality Institute',
    date_label: 'Issued 2019'
  },
  {
    key: 'pmp-certification',
    doc: PMP,
    title: 'Project Management Professional',
    description: 'Awarded on 7,500 hours directing projects plus formal examination across initiation, planning, execution, monitoring and control, and closing.',
    evidence_type: 'Certification',
    organization: 'Meridian Project Institute',
    date_label: 'Issued 2020'
  },
  {
    key: 'case-study-apex-delivery',
    doc: caseStudy,
    title: 'Rebuilding Delivery Performance at Apex Manufacturing',
    description: 'The full account of the first ninety days: what was measured before anything was changed, the order the three changes were made in, what the numbers did, and why the headcount reduction was an outcome rather than a target.',
    evidence_type: 'Case study',
    organization: 'Apex Manufacturing',
    date_label: '2023'
  },
  {
    key: 'ama-leadership-development',
    doc: AMA_LEADERSHIP,
    title: 'Leadership Development Program',
    description: 'Six modules on leading through influence, coaching for performance, and structured delegation. The method behind promoting four operators into department leads inside a single turnaround.',
    evidence_type: 'Training certificate',
    organization: 'American Management Association',
    date_label: 'Completed 2021'
  },
  {
    key: 'case-study-departmental-qc',
    doc: reworkCaseStudy,
    title: 'Eliminating Rework Through Departmental Quality Control',
    description: 'The quality change on its own: why an end-of-line check was costing assembly one to two hours a day, what replaced it across all six stations, and why the standard outlasted the person who introduced it.',
    evidence_type: 'Case study',
    organization: 'Apex Manufacturing',
    date_label: '2023'
  },
  {
    key: 'osha-safety-leadership',
    doc: OSHA_LEADERSHIP,
    title: 'Safety Leadership in General Industry',
    description: 'The 30-hour general industry syllabus with the supervisory leadership module: hazard identification, machine guarding, lockout and tagout, and fall protection, carried into the written floor standards for the upfitting line.',
    evidence_type: 'Training certificate',
    organization: 'National Workplace Safety Council',
    date_label: 'Completed 2018'
  }
]

// ---------------------------------------------------------------------------
// Link items
//
// Deliberately empty. This profile carried three: a LinkedIn article that was
// never written and two association awards that were never given. Every one of
// them pointed at an address invented to fill a tile, which is worse than an
// obviously fake one because a plausible hostname invites the click.
// 08-remove-links.js took them out, and the list is emptied here rather than
// left populated, so that re-running this script cannot put them back.
//
// The loop that reads it stays, so a real link can be added without rebuilding
// the path for one.
// ---------------------------------------------------------------------------
const LINKS = []

module.exports = { DOCUMENTS, LINKS, render }
