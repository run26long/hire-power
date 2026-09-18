// ============================================================================
// THE EIGHT PORTFOLIO IMAGES, AS SVG
//
// These exist to fill the Portfolio section with enough real-looking work that
// its overflow behaviour can be seen. PORTFOLIO_PREVIEW_DESKTOP is 6, so eight
// items is the smallest number that puts the "show the rest" path on screen
// with something left over.
//
// WHY SVG AND NOT A DRAWING LIBRARY
// sharp is already a dependency and rasterises SVG through librsvg, including
// text, which I confirmed on this machine before writing any of them. That
// makes the whole pipeline one dependency the project already ships, and it
// keeps each picture a few dozen lines of markup that can be read and edited
// rather than a canvas program that has to be run to be understood.
//
// One palette across all eight, taken from the profile's own accent (#5b4fcf),
// so a grid of them reads as one person's work rather than eight clip-art tiles.
// ============================================================================

const W = 1600
const H = 1000

const C = {
  bg: '#ffffff',
  panel: '#f7f8fa',
  ink: '#14161a',
  muted: '#6b7280',
  line: '#dfe2e8',
  accent: '#5b4fcf',
  accentSoft: '#ece9fb',
  accentLine: '#b9b0ee',
  good: '#1f8a5b',
  goodSoft: '#e4f3ec',
  warn: '#b7791f',
  warnSoft: '#fbf0dc',
  bad: '#b4433a',
  badSoft: '#f8e6e4'
}

const FONT = "Arial, Helvetica, 'Liberation Sans', sans-serif"

// & < > would otherwise end the attribute or the element. "P&L" is the one that
// actually turns up in this content.
const esc = (s) => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')

const text = (x, y, s, o = {}) =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${o.size || 20}" `
  + `fill="${o.fill || C.ink}" font-weight="${o.weight || 'normal'}" `
  + `text-anchor="${o.anchor || 'start'}"${o.spacing ? ` letter-spacing="${o.spacing}"` : ''}>${esc(s)}</text>`

const rect = (x, y, w, h, o = {}) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.r ?? 8}" `
  + `fill="${o.fill || C.panel}" stroke="${o.stroke || 'none'}" stroke-width="${o.sw || 1}"${o.dash ? ` stroke-dasharray="${o.dash}"` : ''}/>`

const line = (x1, y1, x2, y2, o = {}) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${o.stroke || C.line}" `
  + `stroke-width="${o.sw || 2}"${o.dash ? ` stroke-dasharray="${o.dash}"` : ''}${o.cap ? ` stroke-linecap="${o.cap}"` : ''}/>`

const path = (d, o = {}) =>
  `<path d="${d}" fill="${o.fill || 'none'}" stroke="${o.stroke || C.accent}" `
  + `stroke-width="${o.sw || 2}"${o.dash ? ` stroke-dasharray="${o.dash}"` : ''}${o.cap ? ` stroke-linecap="${o.cap}"` : ''}/>`

const circle = (cx, cy, r, o = {}) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${o.fill || C.accent}" `
  + `stroke="${o.stroke || 'none'}" stroke-width="${o.sw || 1}"/>`

// A pill with a label, used for statuses and small tags.
const pill = (x, y, w, h, label, fill, ink) =>
  rect(x, y, w, h, { r: h / 2, fill })
  + text(x + w / 2, y + h / 2 + 5, label, { size: 15, fill: ink, weight: 'bold', anchor: 'middle' })

const ARROW_DEFS =
  `<defs>
    <marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="${C.accent}"/>
    </marker>
    <marker id="am" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="${C.muted}"/>
    </marker>
    <marker id="ab" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="${C.bad}"/>
    </marker>
  </defs>`

const arrow = (d, o = {}) => path(d, { ...o, }).replace('/>', ` marker-end="url(#${o.marker || 'a'})"/>`)

// Every image shares a header and a footer rule, so the set reads as a series.
function frame(title, subtitle, body, footer) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
    + ARROW_DEFS
    + rect(0, 0, W, H, { r: 0, fill: C.bg })
    + rect(0, 0, 10, H, { r: 0, fill: C.accent })
    + text(64, 82, title, { size: 38, weight: 'bold' })
    + text(64, 120, subtitle, { size: 20, fill: C.muted })
    + line(64, 150, W - 64, 150, { stroke: C.line })
    + body
    + line(64, H - 74, W - 64, H - 74, { stroke: C.line })
    + text(64, H - 40, footer, { size: 16, fill: C.muted })
    + text(W - 64, H - 40, 'Daniel Mercer', { size: 16, fill: C.accent, weight: 'bold', anchor: 'end' })
    + '</svg>'
}

// ---------------------------------------------------------------------------
// 1. Before and after, the same floor
// ---------------------------------------------------------------------------
function floorLayout() {
  // Everything inside a panel is written in panel-relative coordinates and the
  // whole group is translated once. Offsetting the boxes by hand but not the
  // flow paths is exactly the bug that put the second panel's arrows inside the
  // first one.
  const panel = (ox, label, tone, stations, flow, note) => {
    const bad = tone === 'bad'
    let s = rect(0, 0, 700, 640, { fill: C.panel, stroke: C.line })
      + pill(24, 24, 108, 32, label, bad ? C.badSoft : C.goodSoft, bad ? C.bad : C.good)
      + text(150, 46, note, { size: 16, fill: C.muted })
    for (const f of flow) {
      s += arrow(f, { stroke: bad ? C.bad : C.accent, marker: bad ? 'ab' : 'a', sw: 2.5, dash: bad ? '7 5' : null })
    }
    for (const st of stations) {
      s += rect(st[0], st[1], 130, 76, { fill: '#fff', stroke: bad ? C.line : C.accentLine, sw: bad ? 1 : 2 })
        + text(st[0] + 65, st[1] + 33, st[2], { size: 16, weight: 'bold', anchor: 'middle' })
        + text(st[0] + 65, st[1] + 56, st[3], { size: 13, fill: C.muted, anchor: 'middle' })
    }
    return `<g transform="translate(${ox},190)">` + s + '</g>'
  }

  const before = panel(64, 'BEFORE', 'bad', [
    [50, 120, 'Cut', 'queue 3 days'], [420, 130, 'Weld', 'queue 2 days'],
    [190, 280, 'Assembly', 'waiting'], [470, 330, 'Paint', 'idle'],
    [60, 430, 'Wiring', 'rework'], [400, 500, 'Final QC', 'bottleneck']
  ], [
    'M 180 158 C 280 150, 330 160, 416 168',
    'M 485 206 C 485 250, 400 290, 324 314',
    'M 255 356 C 300 400, 430 390, 470 372',
    'M 535 406 C 535 470, 240 450, 190 462',
    'M 190 468 C 280 510, 330 530, 396 538'
  ], 'crossing flow, six queues, QC at the end only')

  const after = panel(836, 'AFTER', 'good', [
    [60, 140, 'Cut', 'QC in station'], [285, 140, 'Weld', 'QC in station'],
    [510, 140, 'Assembly', 'QC in station'],
    [60, 400, 'Wiring', 'QC in station'], [285, 400, 'Paint', 'QC in station'],
    [510, 400, 'Ship', 'on schedule']
  ], [
    'M 190 178 L 279 178', 'M 415 178 L 504 178',
    'M 575 216 L 575 290 L 125 290 L 125 394',
    'M 190 438 L 279 438', 'M 415 438 L 504 438'
  ], 'single direction, QC inside each department')

  return frame(
    'Production floor redesign',
    'Apex Manufacturing, upfitting line. Same building, same footprint, resequenced.',
    before + after,
    'Result: 100% on-time delivery within 50 days. Headcount 25 to 13 with output up.'
  )
}

// ---------------------------------------------------------------------------
// 2. Lean workflow
// ---------------------------------------------------------------------------
function leanWorkflow() {
  const steps = [
    ['1', 'Observe', 'Walk the line,\ntime every stage'],
    ['2', 'Measure', 'First WIP report,\nstatus by hours'],
    ['3', 'Expose', 'Bottleneck visible\nto everyone'],
    ['4', 'Standardise', 'Departmental QC\npass criteria'],
    ['5', 'Reflow', 'Resequence to\nthe real order'],
    ['6', 'Hold', 'Supervisors own\nthe standard']
  ]
  let body = ''
  const x0 = 78, gap = 246, w = 208
  steps.forEach(([n, title, sub], i) => {
    const x = x0 + i * gap
    body += rect(x, 240, w, 200, { fill: i < 3 ? C.panel : C.accentSoft, stroke: i < 3 ? C.line : C.accentLine, sw: i < 3 ? 1 : 2 })
      + circle(x + 34, 282, 20, { fill: i < 3 ? C.muted : C.accent })
      + text(x + 34, 289, n, { size: 18, fill: '#fff', weight: 'bold', anchor: 'middle' })
      + text(x + 68, 289, title, { size: 22, weight: 'bold' })
      + text(x + 24, 340, sub.split('\n')[0], { size: 15, fill: C.muted })
      + text(x + 24, 362, sub.split('\n')[1], { size: 15, fill: C.muted })
    if (i < steps.length - 1) body += arrow(`M ${x + w + 8} 340 L ${x + gap - 10} 340`, { sw: 2.5 })
  })

  body += text(78, 530, 'What each stage removed', { size: 24, weight: 'bold' })
  const wastes = [
    ['Waiting', '3-day queues between cut and weld', '92%'],
    ['Rework', '1-2 hours daily from upstream errors', '100%'],
    ['Overproduction', 'Building ahead of confirmed orders', '74%'],
    ['Inventory', 'Overstock ordering, now deposit-based', '61%']
  ]
  wastes.forEach(([name, detail, cut], i) => {
    const y = 570 + i * 78
    body += rect(78, y, 1444, 62, { fill: i % 2 ? C.bg : C.panel, stroke: C.line })
      + text(104, y + 38, name, { size: 19, weight: 'bold' })
      + text(360, y + 38, detail, { size: 17, fill: C.muted })
      + rect(1210, y + 16, 180, 30, { r: 15, fill: C.accentSoft })
      + text(1300, y + 37, cut + ' reduced', { size: 15, fill: C.accent, weight: 'bold', anchor: 'middle' })
  })

  return frame(
    'Lean implementation sequence',
    'The order the work is done in. Measuring before changing is what makes the rest hold.',
    body,
    'Applied at three sites. Each entered during underperformance, each exited systematized.'
  )
}

// ---------------------------------------------------------------------------
// 3. KPI dashboard
// ---------------------------------------------------------------------------
function kpiDashboard() {
  let body = ''
  const tiles = [
    ['On-time delivery', '100%', 'was 41%', C.good],
    ['Headcount', '13', 'from 25', C.accent],
    ['Daily rework', '0 hrs', 'was 1-2 hrs', C.good],
    ['Annual spend', '$3M', 'under management', C.accent]
  ]
  tiles.forEach(([label, value, sub, tone], i) => {
    const x = 78 + i * 368
    body += rect(x, 195, 336, 150, { fill: C.panel, stroke: C.line })
      + text(x + 26, 232, label, { size: 16, fill: C.muted, spacing: '0.5' })
      + text(x + 26, 292, value, { size: 46, weight: 'bold', fill: tone })
      + text(x + 26, 320, sub, { size: 15, fill: C.muted })
  })

  // Bar chart: on-time delivery by week
  body += rect(78, 380, 720, 420, { fill: C.bg, stroke: C.line })
    + text(106, 420, 'On-time delivery by week', { size: 21, weight: 'bold' })
    + text(106, 444, 'Weeks 1 to 10 after start', { size: 15, fill: C.muted })
  const bars = [41, 48, 52, 61, 66, 74, 81, 88, 95, 100]
  bars.forEach((v, i) => {
    const h = Math.round(v * 2.6)
    const x = 118 + i * 64
    body += rect(x, 760 - h, 42, h, { r: 4, fill: i === bars.length - 1 ? C.accent : C.accentLine })
      + text(x + 21, 780, 'W' + (i + 1), { size: 13, fill: C.muted, anchor: 'middle' })
    if (i === bars.length - 1 || i === 0) {
      body += text(x + 21, 760 - h - 10, v + '%', { size: 14, weight: 'bold', fill: C.accent, anchor: 'middle' })
    }
  })
  body += line(106, 760, 772, 760, { stroke: C.line })

  // Line chart: WIP items open
  body += rect(822, 380, 700, 420, { fill: C.bg, stroke: C.line })
    + text(850, 420, 'Open WIP items', { size: 21, weight: 'bold' })
    + text(850, 444, 'Visibility arrives in week 2', { size: 15, fill: C.muted })
  const wip = [64, 61, 58, 49, 44, 38, 33, 27, 22, 19]
  const px = (i) => 866 + i * 68
  const py = (v) => 760 - Math.round((v / 70) * 280)
  let d = ''
  wip.forEach((v, i) => { d += (i ? ' L ' : 'M ') + px(i) + ' ' + py(v) })
  body += path(d, { stroke: C.accent, sw: 3, cap: 'round' })
  wip.forEach((v, i) => { body += circle(px(i), py(v), 5, { fill: C.accent }) })
  body += line(850, 760, 1496, 760, { stroke: C.line })
    + text(866, py(64) - 16, '64', { size: 14, weight: 'bold', fill: C.accent, anchor: 'middle' })
    + text(px(9), py(19) - 16, '19', { size: 14, weight: 'bold', fill: C.accent, anchor: 'middle' })
    + line(866, py(64), 1478, py(64), { stroke: C.accentLine, dash: '5 6' })

  return frame(
    'Operations dashboard',
    'What the leadership team saw each Monday once the WIP report existed.',
    body,
    'Built from the first WIP report at Apex Manufacturing. Previously no status existed between orders.'
  )
}

// ---------------------------------------------------------------------------
// 4. Quality control process
// ---------------------------------------------------------------------------
function qualityControl() {
  let body = ''
  const box = (x, y, w, h, title, sub, o = {}) =>
    rect(x, y, w, h, { fill: o.fill || C.panel, stroke: o.stroke || C.line, sw: o.sw || 1 })
    + text(x + w / 2, y + (sub ? h / 2 - 4 : h / 2 + 7), title, { size: 19, weight: 'bold', anchor: 'middle', fill: o.ink || C.ink })
    + (sub ? text(x + w / 2, y + h / 2 + 22, sub, { size: 14, fill: C.muted, anchor: 'middle' }) : '')

  // ---- old model: one straight line, inspection bolted on the end ----
  body += text(78, 196, 'Old model: inspect at the end', { size: 22, weight: 'bold', fill: C.bad })
  const old = ['Cut', 'Weld', 'Assembly', 'Wiring', 'Paint']
  old.forEach((s, i) => {
    const x = 78 + i * 200
    body += box(x, 220, 168, 74, s, null)
    if (i < old.length - 1) body += arrow(`M ${x + 176} 257 L ${x + 192} 257`, { stroke: C.muted, marker: 'am' })
  })
  body += arrow('M 1054 257 L 1074 257', { stroke: C.muted, marker: 'am' })
    + box(1082, 220, 200, 74, 'Final inspection', null, { fill: C.badSoft, stroke: C.bad })
    + arrow('M 1290 257 L 1310 257', { stroke: C.bad, marker: 'ab' })
    + box(1318, 220, 204, 74, 'Rework', '1-2 hrs daily', { fill: C.badSoft, stroke: C.bad, ink: C.bad })
    // The return path dips well below the caption that describes it.
    + arrow('M 1420 294 C 1420 372, 300 372, 162 302', { stroke: C.bad, sw: 2, dash: '7 5', marker: 'ab' })
    + text(841, 412, 'every defect travels the whole line before anyone sees it', { size: 16, fill: C.bad, anchor: 'middle' })

  // ---- new model: station, gate, next station ----
  body += line(78, 452, 1522, 452, { stroke: C.line })
    + text(78, 498, 'New model: pass criteria inside each department', { size: 22, weight: 'bold', fill: C.good })

  const GROUP = 288
  const stages = ['Cut', 'Weld', 'Assembly', 'Wiring', 'Paint']
  stages.forEach((s, i) => {
    const x = 78 + i * GROUP
    const dx = x + 225   // diamond centre
    const dy = 578
    body += box(x, 534, 165, 88, s, 'pass criteria', { fill: C.accentSoft, stroke: C.accentLine, sw: 2 })
      + arrow(`M ${x + 165} ${dy} L ${x + 175} ${dy}`, { sw: 2 })
      + `<polygon points="${dx},${dy - 32} ${dx + 48},${dy} ${dx},${dy + 32} ${dx - 48},${dy}" fill="#fff" stroke="${C.accent}" stroke-width="2"/>`
      + text(dx, dy + 6, 'Pass?', { size: 14, weight: 'bold', anchor: 'middle' })
      // "no" returns to the station that made it, never onwards.
      + text(dx - 6, dy + 58, 'no', { size: 13, fill: C.bad, anchor: 'end' })
      + arrow(`M ${dx} ${dy + 32} L ${dx} ${dy + 68} L ${x + 82} ${dy + 68} L ${x + 82} ${dy + 46}`, { stroke: C.bad, sw: 2, dash: '5 5', marker: 'ab' })
    body += (i < stages.length - 1)
      ? arrow(`M ${dx + 48} ${dy} L ${x + GROUP - 2} ${dy}`, { sw: 2 })
      : arrow(`M ${dx + 48} ${dy} L ${dx + 66} ${dy}`, { sw: 2 })
        + text(dx + 46, dy - 22, 'ship', { size: 13, fill: C.accent, weight: 'bold' })
  })

  body += text(78, 754, 'Work does not advance until the department that did it signs it off.', { size: 18, fill: C.ink })
    + text(78, 784, 'Defects are corrected by the people who made them, at the station that made them.', { size: 17, fill: C.muted })
    + rect(78, 822, 1444, 64, { fill: C.goodSoft, stroke: C.good })
    + text(110, 862, 'Daily assembly rework', { size: 17, fill: C.good })
    + text(470, 862, '1-2 hours', { size: 19, fill: C.muted, weight: 'bold' })
    + arrow('M 600 856 L 648 856', { stroke: C.good, sw: 2.5 }).replace('url(#a)', 'url(#a)')
    + text(672, 862, 'zero', { size: 19, fill: C.good, weight: 'bold' })
    + text(1490, 862, 'sustained across the remaining tenure', { size: 15, fill: C.good, anchor: 'end' })

  return frame(
    'Departmental QC standard',
    'Replacing end-of-line inspection with pass criteria at every station.',
    body,
    'Eliminated 1-2 hours of daily assembly rework caused by upstream engineering errors.'
  )
}

// ---------------------------------------------------------------------------
// 5. Org chart
// ---------------------------------------------------------------------------
function orgChart() {
  let body = ''
  const node = (x, y, w, h, name, role, o = {}) =>
    rect(x, y, w, h, { fill: o.fill || C.panel, stroke: o.stroke || C.line, sw: o.sw || 1 })
    + text(x + w / 2, y + 36, name, { size: 19, weight: 'bold', anchor: 'middle', fill: o.ink || C.ink })
    + text(x + w / 2, y + 60, role, { size: 15, fill: C.muted, anchor: 'middle' })

  body += node(640, 200, 320, 88, 'Managing Director', 'P&L, 13 people', { fill: C.accentSoft, stroke: C.accent, sw: 2, ink: C.accent })
    + line(800, 288, 800, 330, { stroke: C.accentLine, sw: 2 })
    + line(300, 330, 1300, 330, { stroke: C.accentLine, sw: 2 })

  const mids = [
    [140, 'Production', '6 operators'],
    [640, 'Engineering', '3 engineers'],
    [1140, 'Commercial', '2 in sales']
  ]
  mids.forEach(([x, name, sub]) => {
    body += line(x + 160, 330, x + 160, 372, { stroke: C.accentLine, sw: 2 })
      + node(x, 372, 320, 88, name, sub, { fill: C.panel, stroke: C.accentLine, sw: 2 })
  })

  const leaves = [
    [90, 'Upfit line'], [300, 'Wiring'], [510, 'Paint & final'],
    [720, 'Design'], [930, 'Change orders'], [1140, 'Accounts'], [1350, 'Pipeline']
  ]
  const parentOf = [0, 0, 0, 1, 1, 2, 2]
  leaves.forEach(([x, name], i) => {
    const px = mids[parentOf[i]][0] + 160
    body += path(`M ${px} 460 L ${px} 500 L ${x + 90} 500 L ${x + 90} 540`, { stroke: C.line, sw: 2 })
      + rect(x, 540, 180, 66, { fill: C.bg, stroke: C.line })
      + text(x + 90, 580, name, { size: 16, anchor: 'middle' })
  })

  body += rect(78, 668, 1444, 130, { fill: C.accentSoft, stroke: C.accentLine })
    + text(110, 706, 'Promoted from within during tenure', { size: 20, weight: 'bold', fill: C.accent })
    + text(110, 740, 'Four of the seven leads above were operators when the turnaround started. Supervisors were taught', { size: 16, fill: C.ink })
    + text(110, 766, 'the reasoning behind each standard rather than the correction, so the structure survives a departure.', { size: 16, fill: C.ink })

  return frame(
    'Operating structure after restructure',
    'Apex Manufacturing. Thirteen people, three functions, every standard owned by the department that runs it.',
    body,
    'Headcount reduced from 25 to 13 while output and delivery performance both improved.'
  )
}

// ---------------------------------------------------------------------------
// 6. Kanban board
// ---------------------------------------------------------------------------
function kanbanBoard() {
  const cols = [
    ['Queued', C.muted, [['Unit 4417', 'Fleet upfit', 'Wk 32'], ['Unit 4421', 'Comms build', 'Wk 32'], ['Unit 4423', 'Fleet upfit', 'Wk 33']]],
    ['In build', C.accent, [['Unit 4402', 'Aerospace bay', 'Wk 31'], ['Unit 4409', 'Comms build', 'Wk 31']]],
    ['QC hold', C.warn, [['Unit 4398', 'Wiring recheck', 'Wk 30']]],
    ['Ready to ship', C.good, [['Unit 4391', 'Fleet upfit', 'Wk 30'], ['Unit 4393', 'Comms build', 'Wk 30'], ['Unit 4395', 'Aerospace bay', 'Wk 30']]]
  ]
  let body = ''
  cols.forEach(([name, tone, cards], i) => {
    const x = 78 + i * 368
    body += rect(x, 195, 336, 600, { fill: C.panel, stroke: C.line })
      + rect(x, 195, 336, 6, { r: 3, fill: tone })
      + text(x + 24, 240, name, { size: 20, weight: 'bold' })
      + text(x + 312, 240, String(cards.length), { size: 20, weight: 'bold', fill: tone, anchor: 'end' })
      + line(x + 24, 258, x + 312, 258, { stroke: C.line })
    cards.forEach(([unit, kind, wk], j) => {
      const y = 280 + j * 118
      body += rect(x + 20, y, 296, 98, { fill: C.bg, stroke: C.line })
        + rect(x + 20, y, 5, 98, { r: 2, fill: tone })
        + text(x + 42, y + 34, unit, { size: 18, weight: 'bold' })
        + text(x + 42, y + 58, kind, { size: 15, fill: C.muted })
        + pill(x + 42, y + 68, 76, 24, wk, C.accentSoft, C.accent)
    })
    if (name === 'In build') {
      // Sits directly under the last card, as the empty slot it represents.
      const y = 280 + cards.length * 118
      body += rect(x + 20, y, 296, 44, { r: 6, fill: C.accentSoft, stroke: C.accentLine, dash: '6 4' })
        + text(x + 168, y + 28, 'WIP limit 3', { size: 15, fill: C.accent, weight: 'bold', anchor: 'middle' })
    }
  })

  return frame(
    'Weekly WIP board',
    'The physical board the daily stand-up runs from. Every unit has one place it can be.',
    body,
    'Bottlenecks surface within hours rather than weeks. All 13 team members aligned on daily priorities.'
  )
}

// ---------------------------------------------------------------------------
// 7. Warehouse optimisation
// ---------------------------------------------------------------------------
function warehouse() {
  let body = ''
  body += rect(78, 190, 900, 610, { fill: C.panel, stroke: C.line })
    + text(104, 226, 'Floor plan, parts and staging', { size: 20, weight: 'bold' })

  // Zones are inset from the panel so the aisles the route uses are real gaps
  // on the plan rather than lines drawn over the racking: a left aisle at
  // x 110-150, cross aisles at x 380-400 and 630-650, and y 400-424.
  const zones = [
    [150, 250, 230, 150, 'A. Fast movers', '68% of picks', C.accentSoft, C.accent],
    [400, 250, 230, 150, 'B. Fleet kits', '21% of picks', C.accentSoft, C.accentLine],
    [650, 250, 300, 150, 'C. Aerospace', 'controlled access', C.goodSoft, C.good],
    [150, 424, 230, 150, 'D. Slow movers', '7% of picks', C.bg, C.line],
    [400, 424, 230, 150, 'E. Bulk stock', '4% of picks', C.bg, C.line],
    [650, 424, 300, 150, 'F. Staging to line', 'sequenced by build', C.warnSoft, C.warn]
  ]
  zones.forEach(([x, y, w, h, name, sub, fill, stroke]) => {
    body += rect(x, y, w, h, { fill, stroke, sw: 2 })
      + text(x + 18, y + 38, name, { size: 18, weight: 'bold' })
      + text(x + 18, y + 62, sub, { size: 15, fill: C.muted })
  })
  body += rect(150, 598, 800, 74, { fill: C.bg, stroke: C.line, dash: '6 4' })
    + text(550, 642, 'Receiving dock', { size: 18, fill: C.muted, anchor: 'middle' })
    // Dock, up the left aisle, along the cross aisle past the two fast zones,
    // down the right-hand aisle and into staging. Aisles only.
    + arrow('M 240 588 L 130 588 L 130 412 L 640 412 L 640 500 L 644 500', { stroke: C.accent, sw: 3, cap: 'round' })
    + line(110, 764, 150, 764, { stroke: C.accent, sw: 3, cap: 'round' })
    + text(164, 770, 'Pick path after zoning, aisles only', { size: 16, weight: 'bold', fill: C.accent })

  body += rect(1010, 190, 512, 610, { fill: C.bg, stroke: C.line })
    + text(1038, 226, 'What changed', { size: 20, weight: 'bold' })
  const rows = [
    ['Average pick path', '410 ft', '155 ft'],
    ['Picks per hour', '18', '31'],
    ['Stockouts per month', '11', '2'],
    ['Overstock value', '$240k', '$94k'],
    ['Staging errors', '6 / wk', '0 / wk']
  ]
  body += text(1038, 276, 'Measure', { size: 14, fill: C.muted, spacing: '1' })
    + text(1330, 276, 'Before', { size: 14, fill: C.muted, anchor: 'middle', spacing: '1' })
    + text(1466, 276, 'After', { size: 14, fill: C.accent, anchor: 'middle', spacing: '1' })
    + line(1038, 292, 1494, 292, { stroke: C.line })
  rows.forEach(([label, before, after], i) => {
    const y = 336 + i * 78
    body += text(1038, y, label, { size: 17 })
      + text(1330, y, before, { size: 17, fill: C.muted, anchor: 'middle' })
      + text(1466, y, after, { size: 18, fill: C.accent, weight: 'bold', anchor: 'middle' })
      + line(1038, y + 24, 1494, y + 24, { stroke: C.line })
  })
  body += rect(1038, 716, 456, 62, { fill: C.accentSoft, stroke: C.accentLine })
    + text(1266, 754, 'Deposit-based purchasing replaced overstock', { size: 15, fill: C.accent, weight: 'bold', anchor: 'middle' })

  return frame(
    'Parts store and staging redesign',
    'Zoned by pick frequency rather than by part number, then staged in build sequence.',
    body,
    'Carrying costs cut by shifting from overstock ordering to deposit-based material purchasing.'
  )
}

// ---------------------------------------------------------------------------
// 8. Safety compliance scorecard
// ---------------------------------------------------------------------------
function safetyScorecard() {
  let body = ''
  const tiles = [
    ['Days without lost time', '412', C.good],
    ['OSHA recordables, YTD', '0', C.good],
    ['Training compliance', '100%', C.good],
    ['Open corrective actions', '2', C.warn]
  ]
  tiles.forEach(([label, value, tone], i) => {
    const x = 78 + i * 368
    body += rect(x, 195, 336, 140, { fill: C.panel, stroke: C.line })
      + rect(x, 195, 336, 5, { r: 2, fill: tone })
      + text(x + 26, 236, label, { size: 15, fill: C.muted })
      + text(x + 26, 300, value, { size: 42, weight: 'bold', fill: tone })
  })

  const rows = [
    ['Machine guarding', 'Monthly', 24, 24, 'Compliant'],
    ['Lockout / tagout', 'Monthly', 24, 24, 'Compliant'],
    ['PPE at station', 'Weekly', 52, 52, 'Compliant'],
    ['Fall protection, bay lifts', 'Monthly', 24, 23, 'Action open'],
    ['Hazardous materials', 'Quarterly', 8, 8, 'Compliant'],
    ['Emergency egress', 'Quarterly', 8, 8, 'Compliant'],
    ['Forklift certification', 'Annual', 13, 12, 'Action open']
  ]
  body += text(78, 390, 'Audit results by area', { size: 22, weight: 'bold' })
    + rect(78, 410, 1444, 44, { fill: C.panel, stroke: C.line })
    + text(104, 439, 'Area', { size: 15, fill: C.muted, spacing: '1' })
    + text(620, 439, 'Cadence', { size: 15, fill: C.muted, spacing: '1' })
    + text(840, 439, 'Checks', { size: 15, fill: C.muted, anchor: 'middle', spacing: '1' })
    + text(1010, 439, 'Passed', { size: 15, fill: C.muted, anchor: 'middle', spacing: '1' })
    + text(1180, 439, 'Rate', { size: 15, fill: C.muted, anchor: 'middle', spacing: '1' })
    + text(1400, 439, 'Status', { size: 15, fill: C.muted, anchor: 'middle', spacing: '1' })

  rows.forEach(([area, cadence, checks, passed, status], i) => {
    const y = 454 + i * 58
    const ok = status === 'Compliant'
    const rate = Math.round((passed / checks) * 100)
    body += rect(78, y, 1444, 58, { r: 0, fill: i % 2 ? C.bg : C.panel, stroke: C.line })
      + text(104, y + 36, area, { size: 17, weight: 'bold' })
      + text(620, y + 36, cadence, { size: 16, fill: C.muted })
      + text(840, y + 36, String(checks), { size: 16, anchor: 'middle' })
      + text(1010, y + 36, String(passed), { size: 16, anchor: 'middle' })
      + rect(1120, y + 22, 120, 14, { r: 7, fill: C.line })
      + rect(1120, y + 22, Math.round(120 * rate / 100), 14, { r: 7, fill: ok ? C.good : C.warn })
      + pill(1330, y + 15, 140, 30, status, ok ? C.goodSoft : C.warnSoft, ok ? C.good : C.warn)
  })

  body += rect(78, 878, 1444, 0, { fill: C.bg })
  return frame(
    'Safety compliance scorecard',
    'Floor standards written from OSHA 30-hour general industry training, audited on a fixed cadence.',
    body,
    'Safety standards carried into the written floor standards for the upfitting line.'
  )
}

// ---------------------------------------------------------------------------
// The set, in the order they are placed
// ---------------------------------------------------------------------------
const IMAGES = [
  {
    key: 'floor-layout-before-after',
    svg: floorLayout,
    title: 'Production Floor Redesign: Before and After',
    description: 'The upfitting line at Apex Manufacturing, resequenced from six crossing flows with end-of-line inspection into a single direction with QC inside each department. Same building, same footprint.',
    evidence_type: 'Work sample',
    organization: 'Apex Manufacturing',
    date_label: '2023'
  },
  {
    key: 'lean-workflow',
    svg: leanWorkflow,
    title: 'Lean Implementation Sequence',
    description: 'The order the work is done in across three turnarounds: observe, measure, expose, standardise, reflow, hold. Measuring before changing is what makes the rest hold.',
    evidence_type: 'Presentation',
    organization: 'Apex Manufacturing',
    date_label: '2023'
  },
  {
    key: 'kpi-dashboard',
    svg: kpiDashboard,
    title: 'Weekly Operations Dashboard',
    description: 'What the leadership team saw each Monday once the first WIP report existed. On-time delivery from 41% to 100% over ten weeks, open WIP items from 64 to 19.',
    evidence_type: 'Report',
    organization: 'Apex Manufacturing',
    date_label: '2023'
  },
  {
    key: 'qc-process-chart',
    svg: qualityControl,
    title: 'Departmental QC Standard',
    description: 'Replacing end-of-line inspection with pass criteria at every station. Work does not advance until the department that did it signs it off, which removed 1-2 hours of daily assembly rework.',
    evidence_type: 'Work sample',
    organization: 'Apex Manufacturing',
    date_label: '2023'
  },
  {
    key: 'org-structure',
    svg: orgChart,
    title: 'Operating Structure After Restructure',
    description: 'Thirteen people across three functions, down from twenty-five. Four of the seven department leads were operators when the turnaround started.',
    evidence_type: 'Work sample',
    organization: 'Apex Manufacturing',
    date_label: '2023'
  },
  {
    key: 'kanban-board',
    svg: kanbanBoard,
    title: 'Weekly WIP Board',
    description: 'The board the daily stand-up runs from. Every unit has exactly one place it can be, with a WIP limit on the build column.',
    evidence_type: 'Work sample',
    organization: 'Apex Manufacturing',
    date_label: '2023'
  },
  {
    key: 'warehouse-optimisation',
    svg: warehouse,
    title: 'Parts Store and Staging Redesign',
    description: 'Zoned by pick frequency rather than part number, then staged in build sequence. Average pick path from 410 feet to 155, stockouts from eleven a month to two.',
    evidence_type: 'Project',
    organization: 'Trident Industrial',
    date_label: '2021'
  },
  {
    key: 'safety-scorecard',
    svg: safetyScorecard,
    title: 'Safety Compliance Scorecard',
    description: 'Floor standards written from OSHA 30-hour general industry training and audited on a fixed cadence. 412 days without a lost-time incident, zero recordables year to date.',
    evidence_type: 'Report',
    organization: 'Apex Manufacturing',
    date_label: '2024'
  }
]

module.exports = { IMAGES, W, H }
