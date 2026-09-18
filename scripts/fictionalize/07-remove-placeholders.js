// ============================================================================
// STEP 7 - TAKE THE PLACEHOLDERS OUT
//
// The profile was seeded with rows pointing at example.com: a URL that resolves
// to nothing, on a tile that invites a reader to open it. They were useful when
// the layouts had nothing else to hold; they are not useful now that steps 3 to
// 5 put real files behind every tile, and a demo profile where half the links
// are dead is worse than a shorter one where none of them are.
//
// HARD DELETE, NOT SOFT
// profile_evidence is built around deleted_at and the rest of these scripts
// respect that. These rows get removed outright because a soft-deleted row is
// still a row somebody has to filter, and nothing here is anybody's work: it is
// fixture data that has been superseded. Every row is written to
// output/removed-placeholders.json first, which is enough to put any of them
// back with a single insert.
//
// Placements go with them. The placement table's foreign key is ON DELETE
// CASCADE, so this does not delete them by hand - it counts them first and
// checks afterwards that the count actually went to zero.
//
// ALSO IN SCOPE, AND WORTH SAYING OUT LOUD
// "Weekly WIP Report (Internal)" is a private draft rather than an example.com
// link, and it existed to prove the privacy filter and the tile with no
// destination. It is removed too, because the instruction was that nothing fake
// remains. Removing it is the one thing here that costs test coverage, so it is
// reported separately rather than folded into the count.
// ============================================================================

const fs = require('fs')
const path = require('path')
const { sb, PROFILE_ID, APPLY, OUT_DIR } = require('./_env')

// The existing award row predates the second one and named a body that no
// longer matches it. Two associations with near-identical names on one profile
// reads as invented, so both awards now sit under the one that was asked for.
const RETITLE = {
  'Carolinas Manufacturing Excellence Award, Operational Turnaround': {
    organization: 'Carolinas Manufacturing Association',
    url: 'https://www.carolinasmfg.org/awards/2024/operational-turnaround'
  }
}

const isPlaceholder = (e) =>
  String(e.url || '').includes('example.com')
  // No source at all: a row that can never resolve to anything.
  || (e.source_type === null && e.storage_path === null && e.url === null)

async function main() {
  const { data: evidence, error } = await sb
    .from('profile_evidence').select('*').eq('profile_id', PROFILE_ID).is('deleted_at', null)
  if (error) throw error

  const { data: placements } = await sb
    .from('profile_evidence_placements').select('*').eq('profile_id', PROFILE_ID)

  const doomed = evidence.filter(isPlaceholder)
  const byExample = doomed.filter(e => String(e.url || '').includes('example.com'))
  const bySourceless = doomed.filter(e => !String(e.url || '').includes('example.com'))
  const keep = evidence.filter(e => !isPlaceholder(e))

  const placementsFor = (id) => placements.filter(p => p.evidence_id === id)

  console.log('REMOVING ' + byExample.length + ' example.com rows:')
  for (const e of byExample) {
    console.log('  ' + e.media_class.padEnd(9) + String(placementsFor(e.id).length).padStart(2) + ' placements  ' + e.title)
  }
  if (bySourceless.length) {
    console.log('\nALSO REMOVING ' + bySourceless.length + ' row(s) with no source at all')
    console.log('(this is the privacy-filter fixture; removing it costs that coverage):')
    for (const e of bySourceless) {
      console.log('  ' + e.media_class.padEnd(9) + e.status.padEnd(8) + e.privacy.padEnd(9) + e.title)
    }
  }

  const doomedIds = new Set(doomed.map(e => e.id))
  const doomedPlacements = placements.filter(p => doomedIds.has(p.evidence_id))
  const orphanedLeads = doomedPlacements.filter(p => p.featured)

  console.log('\nKEEPING ' + keep.length + ' real items')
  console.log(doomedPlacements.length + ' placements go with the deleted rows (FK cascade)')
  if (orphanedLeads.length) {
    console.log(orphanedLeads.length + ' of those are direction leads; 05-placements.js re-points them afterwards')
  }

  const retitle = keep.filter(e => RETITLE[e.title])
  for (const e of retitle) {
    const patch = RETITLE[e.title]
    console.log('\nUPDATE ' + e.title)
    console.log('  organization  - ' + e.organization + '\n                + ' + patch.organization)
    console.log('  url           - ' + e.url + '\n                + ' + patch.url)
  }

  if (!APPLY) { console.log('\nDRY RUN - nothing written. Pass --apply to write.'); return }

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.writeFileSync(
    path.join(OUT_DIR, 'removed-placeholders.json'),
    JSON.stringify({ removed_at: new Date().toISOString(), evidence: doomed, placements: doomedPlacements }, null, 2)
  )
  console.log('\nBacked up to output/removed-placeholders.json')

  const { error: delErr } = await sb
    .from('profile_evidence').delete().in('id', [...doomedIds])
  if (delErr) throw new Error('delete failed: ' + delErr.message)

  // The cascade is asserted rather than assumed.
  const { data: left } = await sb
    .from('profile_evidence_placements').select('id').in('evidence_id', [...doomedIds])
  if ((left || []).length > 0) throw new Error((left.length) + ' placements survived the cascade')

  for (const e of retitle) {
    const { error: upErr } = await sb.from('profile_evidence').update(RETITLE[e.title]).eq('id', e.id)
    if (upErr) throw new Error('retitle failed: ' + upErr.message)
  }

  console.log('APPLIED: ' + doomed.length + ' rows and ' + doomedPlacements.length + ' placements removed, '
    + retitle.length + ' row(s) updated')
}

main().catch(e => { console.error('ERR', e.message); process.exit(1) })
