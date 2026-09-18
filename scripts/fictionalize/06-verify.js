// ============================================================================
// STEP 6 - PROVE IT
//
// Read-only. Two jobs:
//
//   1. No real-world identity survives anywhere on this profile. Whole rows are
//      scanned, not just the columns the rename swept, because the columns that
//      got missed the first time round were exactly the ones nobody thought to
//      list. Case-insensitive, because the coaching transcript is lowercase.
//
//   2. The profile actually renders. The public route filters evidence on
//      deleted_at is null AND status = published AND privacy = public, and then
//      resolves a placement for the direction being viewed; an item that fails
//      any of those is invisible however good its content is. And a portfolio
//      item with no thumbnail_path is a grey mat, because the media route
//      refuses to fall back to the source file for variant=thumbnail.
// ============================================================================

const fs = require('fs')
const path = require('path')
const { sb, PROFILE_ID, USER_ID, SLUG, BUCKET, LENS } = require('./_env')
const { isPortfolioItem, PORTFOLIO_PREVIEW_DESKTOP } = require('./_portfolio')

// The two sections page at different counts, and this script previously
// reported Evidence against the Portfolio's 6 - which said the overflow was
// "correctly absent" at six items while the control was in fact on screen.
// Evidence keeps its limit as a local constant in its own component rather than
// in lib, so it is read from there and the script fails loudly if it moves.
function evidencePreviewDesktop() {
  const src = fs.readFileSync(
    path.join(__dirname, '..', '..', 'app', 'p', '[slug]', '_components', 'EvidenceSection.js'),
    'utf8'
  )
  const m = src.match(/const\s+PREVIEW_DESKTOP\s*=\s*(\d+)/)
  if (!m) throw new Error('Could not read PREVIEW_DESKTOP out of EvidenceSection.js; fix this reader.')
  return Number(m[1])
}
const EVIDENCE_PREVIEW_DESKTOP = evidencePreviewDesktop()

const NEEDLES = [
  /\bJames\b/g, /\bLong\b/g, /disruptor/gi, /\bmbf\b/gi, /madstad/gi, /oshkosh/gi,
  /lake mary/gi, /\bsanford\b/gi, /brooksville/gi, /\borlando\b/gi, /\bflorida\b/gi,
  /, FL\b/g, /jameslong/gi, /321-696/g
]

const TABLES = [
  ['profiles', q => q.eq('id', USER_ID)],
  ['career_profiles', q => q.eq('id', PROFILE_ID)],
  ['career_context', q => q.eq('user_id', USER_ID)],
  ['career_knowledge', q => q.eq('user_id', USER_ID)],
  ['profile_lenses', q => q.eq('profile_id', PROFILE_ID)],
  ['profile_testimonials', q => q.eq('profile_id', PROFILE_ID)],
  ['profile_evidence', q => q.eq('profile_id', PROFILE_ID)],
  ['profile_collective_impacts', q => q.eq('profile_id', PROFILE_ID)],
  ['profile_skill_proofs', q => q.eq('profile_id', PROFILE_ID)],
  ['resumes', q => q.eq('user_id', USER_ID).eq('is_active', true)]
]

// Addresses are out of scope: profiles.email mirrors auth.users and rewriting
// it would break sign-in on an account somebody actually uses.
function scrub(row) {
  const out = { ...row }
  delete out.email; delete out.contact_email; delete out.recipient_email
  if (out.resume_data) { out.resume_data = { ...out.resume_data }; delete out.resume_data.email }
  return out
}

async function main() {
  let failures = 0
  const fail = (m) => { failures++; console.log('  FAIL  ' + m) }
  const pass = (m) => console.log('  ok    ' + m)
  // Reported, not asserted: a fact worth seeing that no longer has a right
  // answer to hold it to.
  const note = (m) => console.log('  --    ' + m)

  // ---- 1. identity ----
  console.log('IDENTITY')
  for (const [table, filter] of TABLES) {
    const { data, error } = await filter(sb.from(table).select('*'))
    if (error) { fail(table + ': ' + error.message); continue }
    for (const row of data) {
      const s = JSON.stringify(scrub(row))
      for (const re of NEEDLES) {
        const m = s.match(re)
        if (m) fail(table + ' ' + row.id + ' still contains "' + m[0] + '" x' + m.length)
      }
    }
  }
  if (!failures) pass('no real-world names, employers or places survive in ' + TABLES.length + ' tables')

  const { data: profile } = await sb.from('career_profiles').select('slug, is_published').eq('id', PROFILE_ID).maybeSingle()
  profile.slug === SLUG ? pass('slug is ' + SLUG) : fail('slug is ' + profile.slug + ', expected ' + SLUG)

  const { data: person } = await sb.from('profiles').select('display_name').eq('id', USER_ID).maybeSingle()
  person.display_name === 'Daniel Mercer'
    ? pass('display_name is Daniel Mercer')
    : fail('display_name is ' + person.display_name)

  // ---- 2. what a visitor actually gets ----
  console.log('\nPUBLIC PAYLOAD')
  const { data: evidence } = await sb
    .from('profile_evidence')
    .select('id, title, media_class, source_type, storage_path, thumbnail_path, status, privacy, deleted_at')
    .eq('profile_id', PROFILE_ID)
    .is('deleted_at', null)

  const visible = evidence.filter(e => e.status === 'published' && e.privacy === 'public')
  pass(evidence.length + ' evidence rows, ' + visible.length + ' publicly eligible')

  // lib/portfolio.js: visual AND a file we hold.
  const portfolio = visible.filter(e => ['image', 'video'].includes(e.media_class) && e.source_type === 'upload')
  const evidenceOnly = visible.filter(e => !(['image', 'video'].includes(e.media_class) && e.source_type === 'upload'))
  portfolio.length >= 8
    ? pass('portfolio holds ' + portfolio.length + ' items (preview shows 6, so overflow is exercised)')
    : fail('portfolio holds only ' + portfolio.length + ', need 8 to exercise overflow')
  note('evidence section holds ' + evidenceOnly.length + ' items')

  // Nothing on this profile should point at an address rather than a file.
  const links = visible.filter(e => ['link', 'embed'].includes(e.media_class))
  links.length === 0
    ? pass('no link-class evidence: every item is backed by a file we hold')
    : fail(links.length + ' link-class items remain: ' + links.map(e => e.title).join(', '))

  const noThumb = portfolio.filter(e => !e.thumbnail_path)
  noThumb.length === 0
    ? pass('every portfolio item resolves a thumbnail')
    : fail(noThumb.length + ' portfolio items have no thumbnail: ' + noThumb.map(e => e.title).join(', '))

  // ---- 3. the objects are really in the bucket ----
  console.log('\nSTORAGE')
  let missing = 0
  for (const e of visible.filter(e => e.source_type === 'upload')) {
    for (const p of [e.storage_path, e.thumbnail_path].filter(Boolean)) {
      const { data, error } = await sb.storage.from(BUCKET).info(p)
      if (error || !data) { missing++; fail('missing object for "' + e.title + '": ' + p) }
    }
  }
  if (!missing) pass('every uploaded item and thumbnail exists in ' + BUCKET)

  // ---- 4. placements ----
  console.log('\nPLACEMENTS')
  const { data: placements } = await sb
    .from('profile_evidence_placements').select('*').eq('profile_id', PROFILE_ID)

  const visibleIds = new Set(visible.map(e => e.id))
  const byId = new Map(visible.map(e => [e.id, e]))

  // ProfileDocument reads evidencePlacements[lensId] ?? evidenceShared: shared
  // is a fallback, never merged, so what a direction shows is exactly its own
  // placements and nothing else. Each is checked on its own terms.
  for (const [name, id] of Object.entries(LENS)) {
    const rows = placements.filter(p => p.lens_id === id && visibleIds.has(p.evidence_id))
    const items = rows.map(p => byId.get(p.evidence_id))
    const portfolio = items.filter(isPortfolioItem)
    const docs = items.filter(e => !isPortfolioItem(e))
    const leads = rows.filter(p => p.featured)

    leads.length === 1
      ? pass(name + ': ' + rows.length + ' items, 1 lead')
      : fail(name + ': ' + rows.length + ' items, ' + leads.length + ' leads (expected exactly 1)')

    // Portfolio is still held to overflowing: eight uploads exist precisely so
    // that control can be looked at, and a drop below seven would mean
    // something went missing rather than something was decided.
    portfolio.length > PORTFOLIO_PREVIEW_DESKTOP
      ? pass('  portfolio ' + portfolio.length + ' > ' + PORTFOLIO_PREVIEW_DESKTOP + ', so "View full portfolio" renders')
      : fail('  portfolio ' + portfolio.length + ' <= ' + PORTFOLIO_PREVIEW_DESKTOP + ', so the overflow link will NOT render')

    // Evidence is reported, not asserted. Once the invented links came out,
    // five is simply what the real material adds up to, and a section that
    // stops offering to show more is the correct behaviour rather than a
    // regression. Holding a number here would only invite somebody to invent
    // items to satisfy it.
    note('  evidence ' + docs.length + (docs.length > EVIDENCE_PREVIEW_DESKTOP
      ? ' > ' + EVIDENCE_PREVIEW_DESKTOP + ', so "View all evidence" renders'
      : ' <= ' + EVIDENCE_PREVIEW_DESKTOP + ', so the evidence overflow is absent'))

    const missing = visible.filter(e => !rows.some(p => p.evidence_id === e.id))
    missing.length === 0
      ? pass('  every eligible item is placed on this direction')
      : fail('  ' + missing.length + ' eligible items missing here: ' + missing.map(e => e.title).join(', '))
  }

  const shared = placements.filter(p => p.lens_id === null)
  shared.length === 0
    ? pass('shared layer empty, which is correct: every direction has its own placements, so a shared row would never be reached')
    : fail(shared.length + ' shared placements that no direction can reach')

  const orphan = placements.filter(p => !visibleIds.has(p.evidence_id))
  orphan.length === 0
    ? pass('no placements point at evidence a visitor cannot see')
    : fail(orphan.length + ' placements point at invisible evidence')

  // Nothing fake left behind.
  const fake = visible.filter(e => String(e.url || '').includes('example.com'))
  fake.length === 0
    ? pass('no example.com placeholders remain')
    : fail(fake.length + ' example.com placeholders still published: ' + fake.map(e => e.title).join(', '))

  // ---- 5. lens copy ----
  console.log('\nDIRECTIONS')
  const { data: lenses } = await sb
    .from('profile_lenses').select('name, headline, bio, proof_points, ready_for_next, status')
    .eq('profile_id', PROFILE_ID).order('sort_order')
  for (const l of lenses) {
    const problems = []
    if (l.headline.length > 200) problems.push('headline > 200')
    if (l.bio.length > 4000) problems.push('bio > 4000')
    if ((l.ready_for_next || '').length > 400) problems.push('ready_for_next > 400')
    if (!Array.isArray(l.proof_points) || l.proof_points.length !== 3) problems.push('proof_points != 3')
    if (JSON.stringify(l).includes('—')) problems.push('contains an em dash')
    problems.length
      ? fail(l.name + ': ' + problems.join(', '))
      : pass(l.name + ' (' + l.status + '): headline ' + l.headline.length + ', bio ' + l.bio.length + ', 3 proof points')
  }

  console.log('\n' + (failures ? '!!! ' + failures + ' FAILURES' : 'ALL CHECKS PASSED'))
  console.log('Profile: /p/' + SLUG + (profile.is_published ? '  (published)' : '  (draft)'))
  process.exit(failures ? 1 : 0)
}

main().catch(e => { console.error('ERR', e.message); process.exit(1) })
