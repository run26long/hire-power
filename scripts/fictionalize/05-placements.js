// ============================================================================
// STEP 5 - WHERE EACH ITEM IS SHOWN
//
// Rewrites the placement table for this profile from scratch: every publicly
// eligible item on all three directions, in a per-direction order, with one
// lead each.
//
// WHY NOT THE SHARED LAYER
// The first version of this script put the three general credentials in the
// shared layer and nothing else, on the reasoning that a credential argues for
// every direction equally. That was wrong, and ProfileDocument says why:
//
//     data?.evidencePlacements?.[selectedLens?.id] ?? data?.evidenceShared ?? []
//
// Shared is a FALLBACK, reached only by a direction that has no placements of
// its own, and the two are never merged - deliberately, so a reader can always
// tell what this direction actually chose. All three directions here have their
// own placements, so those three credentials were invisible on every one of
// them. Nothing in the UI would have shown that; the item simply was not there.
//
// WHY EVERY ITEM ON EVERY DIRECTION
// Both sections page at six. With sixteen items split three ways by theme, no
// single direction reached seven of either, so neither overflow control ever
// rendered - which is the bug this profile exists to let somebody look at. The
// per-direction ORDER still differs, which is the part that actually matters:
// the same collection, led and sequenced differently under each direction.
//
// WHY IT REPLACES RATHER THAN APPENDS
// Placements were left behind by deleted rows, by the shared-layer mistake, and
// by two earlier runs. Rebuilding the table is one obvious state instead of
// three overlapping corrections.
// ============================================================================

const { sb, PROFILE_ID, LENS, APPLY } = require('./_env')
const { isPortfolioItem } = require('./_portfolio')

// One lead per direction. This used to put a link in the Business Development
// slot so that all three lead-card renderings were on screen somewhere; step 8
// removed every link-class item as invented, so there is no longer a real one
// to lead with and none is invented to fill the gap.
const LEAD = {
  [LENS.OPERATIONS]: 'Production Floor Redesign: Before and After',
  [LENS.BUSINESS_DEV]: 'Parts Store and Staging Redesign',
  [LENS.EXECUTIVE]: 'Rebuilding Delivery Performance at Apex Manufacturing'
}

// What each direction puts first. Anything not named here follows in canonical
// sort order, so adding an item never silently drops it from a direction.
const EMPHASIS = {
  [LENS.OPERATIONS]: [
    'Production Floor Redesign: Before and After',
    'Departmental QC Standard',
    'Weekly WIP Board',
    'Lean Implementation Sequence',
    'Weekly Operations Dashboard',
    'Safety Compliance Scorecard',
    'Rebuilding Delivery Performance at Apex Manufacturing',
    'Lean Six Sigma Black Belt'
  ],
  [LENS.BUSINESS_DEV]: [
    'Parts Store and Staging Redesign',
    'Project Management Professional',
    'Weekly Operations Dashboard',
    'Rebuilding Delivery Performance at Apex Manufacturing'
  ],
  [LENS.EXECUTIVE]: [
    'Rebuilding Delivery Performance at Apex Manufacturing',
    'Operating Structure After Restructure',
    'Leadership Development Program',
    'Production Floor Redesign: Before and After'
  ]
}

const LENS_NAME = {
  [LENS.OPERATIONS]: 'Manufacturing Operations',
  [LENS.BUSINESS_DEV]: 'Business Development',
  [LENS.EXECUTIVE]: 'Executive Leadership'
}

// Both sections page at six, so seven is the first count that shows a control.
const PREVIEW = 6

async function main() {
  const { data: evidence, error } = await sb
    .from('profile_evidence')
    .select('id, title, media_class, source_type, status, privacy, sort_order')
    .eq('profile_id', PROFILE_ID)
    .is('deleted_at', null)
    .order('sort_order')
  if (error) throw error

  // Exactly the filter the public route applies. An item that fails it cannot
  // be seen however it is placed, so it is not placed.
  const visible = evidence.filter(e => e.status === 'published' && e.privacy === 'public')
  const hidden = evidence.filter(e => !(e.status === 'published' && e.privacy === 'public'))

  const byTitle = new Map(visible.map(e => [e.title, e]))
  const rows = []

  for (const [lensId, name] of Object.entries(LENS_NAME)) {
    const emphasis = EMPHASIS[lensId] || []
    for (const title of emphasis) {
      if (!byTitle.has(title)) throw new Error(name + ' emphasises an item that does not exist: ' + title)
    }
    const first = emphasis.map(t => byTitle.get(t))
    const rest = visible.filter(e => !emphasis.includes(e.title))
    const ordered = [...first, ...rest]

    const leadTitle = LEAD[lensId]
    if (!byTitle.has(leadTitle)) throw new Error(name + ' leads on an item that does not exist: ' + leadTitle)

    ordered.forEach((item, i) => {
      rows.push({
        profile_id: PROFILE_ID,
        evidence_id: item.id,
        lens_id: lensId,
        sort_order: i,
        featured: item.title === leadTitle
      })
    })

    const portfolio = ordered.filter(isPortfolioItem)
    const docs = ordered.filter(e => !isPortfolioItem(e))
    console.log(
      name.padEnd(26)
      + 'portfolio ' + String(portfolio.length).padStart(2) + (portfolio.length > PREVIEW ? ' (overflow) ' : ' (no overflow) ')
      + 'evidence ' + String(docs.length).padStart(2) + (docs.length > PREVIEW ? ' (overflow)' : ' (no overflow)')
    )
    console.log('  lead: ' + leadTitle)
  }

  if (hidden.length) {
    console.log('\nNot placed, because the public route would filter them anyway:')
    for (const e of hidden) console.log('  ' + e.status + '/' + e.privacy + '  ' + e.title)
  }

  const { data: current } = await sb
    .from('profile_evidence_placements').select('id, lens_id').eq('profile_id', PROFILE_ID)
  const shared = (current || []).filter(p => p.lens_id === null).length
  console.log('\nReplacing ' + (current || []).length + ' existing placements'
    + (shared ? ' (' + shared + ' of them in the shared layer, which no direction was reaching)' : ''))
  console.log('=== ' + rows.length + ' placements: ' + visible.length + ' items across 3 directions ===')

  if (!APPLY) { console.log('DRY RUN - nothing written. Pass --apply to write.'); return }

  // Cleared first. The partial unique indexes on featured would refuse a second
  // lead for a direction that still has its old one.
  const { error: delErr } = await sb
    .from('profile_evidence_placements').delete().eq('profile_id', PROFILE_ID)
  if (delErr) throw new Error('clear failed: ' + delErr.message)

  const { error: insErr } = await sb.from('profile_evidence_placements').insert(rows)
  if (insErr) throw new Error('insert failed: ' + insErr.message)

  console.log('APPLIED: ' + rows.length + ' placements')
}

main().catch(e => { console.error('ERR', e.message); process.exit(1) })
