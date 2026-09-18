// ============================================================================
// STEP 8 - TAKE THE LINK ITEMS OUT
//
// Every remaining link on this profile points at an address that was invented
// to fill a tile: a LinkedIn article that was never written, two association
// awards that were never given. They are not example.com, so step 7 left them
// alone, but they fail in the same way and worse - a plausible hostname invites
// a reader to click where an obviously fake one does not.
//
// Only media_class 'link' and 'embed' go. Everything backed by a file we
// actually hold stays, and nothing is invented to replace what leaves: the
// counts are what the real material adds up to, and a section that drops below
// its preview limit simply stops offering to show more. That is the honest
// result and it is the one worth looking at.
//
// What this costs, said plainly: no link-class evidence is left on the profile,
// so the link tile and the "visit original" path in the viewer no longer have
// anything here to exercise them.
//
// Backed up to output/removed-links.json first. Placements go by FK cascade,
// counted before and asserted after, as in step 7.
// ============================================================================

const fs = require('fs')
const path = require('path')
const { sb, PROFILE_ID, APPLY, OUT_DIR } = require('./_env')

// The two classes that are an address rather than a file.
const LINK_CLASSES = new Set(['link', 'embed'])

async function main() {
  const { data: evidence, error } = await sb
    .from('profile_evidence').select('*').eq('profile_id', PROFILE_ID).is('deleted_at', null)
  if (error) throw error

  const { data: placements } = await sb
    .from('profile_evidence_placements').select('*').eq('profile_id', PROFILE_ID)

  const doomed = evidence.filter(e => LINK_CLASSES.has(e.media_class))
  const keep = evidence.filter(e => !LINK_CLASSES.has(e.media_class))

  if (doomed.length === 0) { console.log('No link-class evidence left. Nothing to do.'); return }

  const doomedIds = new Set(doomed.map(e => e.id))
  const doomedPlacements = placements.filter(p => doomedIds.has(p.evidence_id))
  const orphanedLeads = doomedPlacements.filter(p => p.featured)

  console.log('REMOVING ' + doomed.length + ' link-class items:')
  for (const e of doomed) {
    const mine = placements.filter(p => p.evidence_id === e.id)
    console.log('  ' + e.media_class.padEnd(6) + String(mine.length).padStart(2) + ' placements  '
      + (mine.some(p => p.featured) ? '[LEAD] ' : '       ') + e.title)
    console.log('         ' + e.url)
  }

  // What the sections will hold afterwards, which is the point of the change.
  const visible = keep.filter(e => e.status === 'published' && e.privacy === 'public')
  const portfolio = visible.filter(e => ['image', 'video'].includes(e.media_class) && e.source_type === 'upload')
  const documents = visible.filter(e => !(['image', 'video'].includes(e.media_class) && e.source_type === 'upload'))

  console.log('\nAFTERWARDS, per direction:')
  console.log('  portfolio ' + portfolio.length + (portfolio.length > 6 ? '  (still overflows)' : '  (no overflow)'))
  console.log('  evidence  ' + documents.length + (documents.length > 6 ? '  (still overflows)' : '  (no overflow - the control stops being offered)'))
  if (orphanedLeads.length) {
    console.log('\n' + orphanedLeads.length + ' direction lead(s) go with these. Re-run 05-placements.js afterwards.')
  }

  if (!APPLY) { console.log('\nDRY RUN - nothing written. Pass --apply to write.'); return }

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.writeFileSync(
    path.join(OUT_DIR, 'removed-links.json'),
    JSON.stringify({ removed_at: new Date().toISOString(), evidence: doomed, placements: doomedPlacements }, null, 2)
  )
  console.log('\nBacked up to output/removed-links.json')

  const { error: delErr } = await sb.from('profile_evidence').delete().in('id', [...doomedIds])
  if (delErr) throw new Error('delete failed: ' + delErr.message)

  const { data: left } = await sb
    .from('profile_evidence_placements').select('id').in('evidence_id', [...doomedIds])
  if ((left || []).length > 0) throw new Error(left.length + ' placements survived the cascade')

  console.log('APPLIED: ' + doomed.length + ' rows and ' + doomedPlacements.length + ' placements removed')
}

main().catch(e => { console.error('ERR', e.message); process.exit(1) })
