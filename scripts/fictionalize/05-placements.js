// ============================================================================
// STEP 5 - WHERE EACH NEW ITEM IS SHOWN
//
// A placement says which direction shows an item, in what order, and which one
// leads. The table enforces four things this script has to respect:
//
//   unique (evidence_id, lens_id) where lens_id is not null
//   unique (evidence_id)          where lens_id is null   - one shared row only
//   unique (lens_id)              where featured          - one lead per direction
//   unique (profile_id)           where featured and lens_id is null
//
// SHARED IS A FALLBACK, NOT A BROADCAST
// The migration that created this table is explicit that an item with direction
// placements gets no shared row, because explicit curation is not quietly
// widened. So the three general credentials take a shared placement and nothing
// else, and every other item is placed on the directions it actually argues for.
//
// THE LEADS ARE RE-POINTED, DELIBERATELY
// All three directions currently lead on an example.com link that resolves to
// nothing. Two are moved onto real uploads. Business Development is left where
// it is on purpose: that leaves one direction leading on an image, one on a
// document and one on a link, which is the whole set of lead-card renderings
// this profile exists to exercise.
// ============================================================================

const { sb, PROFILE_ID, LENS, APPLY } = require('./_env')

const SHARED = null

// title -> the directions that show it, and whether it leads there
const PLAN = [
  // --- portfolio ---
  ['Production Floor Redesign: Before and After', [[LENS.OPERATIONS, 'lead'], [LENS.EXECUTIVE]]],
  ['Lean Implementation Sequence', [[LENS.OPERATIONS]]],
  ['Weekly Operations Dashboard', [[LENS.OPERATIONS], [LENS.EXECUTIVE]]],
  ['Departmental QC Standard', [[LENS.OPERATIONS]]],
  ['Weekly WIP Board', [[LENS.OPERATIONS]]],
  ['Safety Compliance Scorecard', [[LENS.OPERATIONS]]],
  ['Operating Structure After Restructure', [[LENS.EXECUTIVE]]],
  ['Parts Store and Staging Redesign', [[LENS.BUSINESS_DEV]]],

  // --- evidence ---
  ['Rebuilding Delivery Performance at Apex Manufacturing', [[LENS.EXECUTIVE, 'lead'], [LENS.OPERATIONS]]],
  ['What a WIP Report Changes in the First Week', [[LENS.EXECUTIVE]]],
  ['Carolinas Manufacturing Excellence Award, Operational Turnaround', [[LENS.BUSINESS_DEV], [LENS.EXECUTIVE]]],

  // --- credentials: shared layer, nothing else ---
  ['Lean Six Sigma Black Belt', [[SHARED]]],
  ['Project Management Professional', [[SHARED]]],
  ['Safety Leadership in General Industry', [[SHARED]]]
]

const LENS_NAME = {
  [LENS.OPERATIONS]: 'Manufacturing Operations',
  [LENS.BUSINESS_DEV]: 'Business Development',
  [LENS.EXECUTIVE]: 'Executive Leadership'
}
const label = (id) => id === SHARED ? 'Shared layer' : (LENS_NAME[id] || id)

async function main() {
  const { data: evidence, error: evErr } = await sb
    .from('profile_evidence').select('id, title').eq('profile_id', PROFILE_ID).is('deleted_at', null)
  if (evErr) throw evErr
  const idFor = new Map(evidence.map(e => [e.title, e.id]))

  const { data: existing, error: plErr } = await sb
    .from('profile_evidence_placements').select('*').eq('profile_id', PROFILE_ID)
  if (plErr) throw plErr

  // Next free sort_order per layer, so new rows land after what is already there.
  const nextSort = new Map()
  for (const p of existing) {
    const k = p.lens_id || 'SHARED'
    nextSort.set(k, Math.max(nextSort.get(k) ?? -1, p.sort_order ?? 0))
  }

  const already = new Set(existing.map(p => p.evidence_id + '|' + (p.lens_id || 'SHARED')))

  const inserts = []
  const demote = []   // existing leads that have to stand down first

  for (const [title, targets] of PLAN) {
    const evidenceId = idFor.get(title)
    if (!evidenceId) throw new Error('No evidence row titled: ' + title)

    for (const [lensId, lead] of targets) {
      const key = evidenceId + '|' + (lensId || 'SHARED')
      if (already.has(key)) { console.log('skip (already placed): ' + title + ' on ' + label(lensId)); continue }

      if (lead) {
        // One lead per direction. The incumbent is demoted in the same run,
        // before the new row is written, or the partial unique index refuses it.
        const incumbent = existing.find(p => p.featured && (p.lens_id || 'SHARED') === (lensId || 'SHARED'))
        if (incumbent) demote.push(incumbent)
      }

      const k = lensId || 'SHARED'
      const sort = (nextSort.get(k) ?? -1) + 1
      nextSort.set(k, sort)

      inserts.push({
        profile_id: PROFILE_ID,
        evidence_id: evidenceId,
        lens_id: lensId,
        sort_order: sort,
        featured: Boolean(lead),
        _title: title
      })
    }
  }

  // ---- report ----
  const byLayer = {}
  for (const row of inserts) {
    const k = row.lens_id || 'SHARED'
    ;(byLayer[k] = byLayer[k] || []).push(row)
  }
  for (const [k, rows] of Object.entries(byLayer)) {
    console.log('\n' + label(k === 'SHARED' ? SHARED : k))
    for (const r of rows) {
      console.log('  ' + String(r.sort_order).padStart(3) + '  ' + (r.featured ? '[LEAD] ' : '       ') + r._title)
    }
  }
  if (demote.length) {
    console.log('\nLeads standing down:')
    for (const d of demote) {
      const t = evidence.find(e => e.id === d.evidence_id)
      console.log('  ' + label(d.lens_id) + ': ' + (t ? t.title : d.evidence_id))
    }
  }
  console.log('\n=== ' + inserts.length + ' placements to create, ' + demote.length + ' leads to re-point ===')

  if (!APPLY) { console.log('DRY RUN - nothing written. Pass --apply to write.'); return }

  // Demote first. Doing it the other way round trips the unique index.
  for (const d of demote) {
    const { error } = await sb.from('profile_evidence_placements')
      .update({ featured: false }).eq('id', d.id)
    if (error) throw new Error('demote failed: ' + error.message)
  }

  const { error } = await sb.from('profile_evidence_placements')
    .insert(inserts.map(({ _title, ...row }) => row))
  if (error) throw new Error('insert failed: ' + error.message)

  console.log('APPLIED: ' + inserts.length + ' placements, ' + demote.length + ' leads re-pointed')
}

main().catch(e => { console.error('ERR', e.message); process.exit(1) })
