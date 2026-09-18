// ============================================================================
// STEP 2 - THE THREE DIRECTIONS, REWRITTEN
//
// 01 replaced the names inside the existing lens copy, which left it accurate
// but not good: the three directions read as three variations of one paragraph,
// the Executive headline was a 137-character sentence where its siblings were
// 85-character noun phrases, and the bios asserted a three-turnaround record
// while the figures that would have shown it sat unused in career_knowledge and
// profile_skill_proofs.
//
// So this is a rewrite rather than another substitution. Every number in it is
// one that already exists in this account's data:
//
//   Trident Industrial  $6M to $20M, ~$5M of it annual recurring
//                       sole source framework, 60% across 50+ contracts
//                       Boeing ISS communications trucks
//   Keystone Systems    22 people to 16, all 16 measurably stronger
//   Apex Manufacturing  100% on time in 50 days, 25 to 13, $2M-$3M in 4 weeks
//                       first WIP report, departmental QC replacing end-of-line
//
// Also changes the slug, which is the last place the old identity survived.
// Nothing in the repo hardcodes it and career_profiles_slug_shape accepts it.
// ============================================================================

const { sb, PROFILE_ID, SLUG, LENS, APPLY, assertNoEmDash } = require('./_env')

// Matches the route that would otherwise validate these.
const LIMITS = { headline: 200, bio: 4000, ready_for_next: 400, proof_num: 24, proof_label: 120 }
const PROOF_POINT_COUNT = 3

const REWRITE = {
  [LENS.OPERATIONS]: {
    headline: 'Operations leader who rebuilds production systems and the discipline that holds them',
    bio:
      'Manufacturing operations executive with 30+ years building lean production systems, WIP '
      + 'visibility, and departmental quality standards across specialty vehicle and motorsports '
      + 'plants. Took on three separate turnarounds, each entered during underperformance and each '
      + 'exited with on-time delivery restored and production flow systematized. At Apex '
      + "Manufacturing the first WIP report in the company's history exposed bottlenecks within "
      + 'hours rather than weeks, and departmental QC standards replaced end-of-line inspection; '
      + 'every active account was delivering on schedule within 50 days, with headcount down 48% '
      + 'and output up. Pairs floor-level redesign with budget ownership and the commercial '
      + 'judgement to match plant capability to the revenue it has to carry.',
    proof_points: [
      { num: '100%', label: 'on-time delivery, restored in 50 days' },
      { num: '48%', label: 'headcount reduction with output up' },
      { num: '3', label: 'plant turnarounds led end to end' }
    ],
    ready_for_next:
      'Ready to take full operational ownership of a plant that needs its floor rebuilt rather '
      + 'than tuned: WIP visibility where there is none, QC standards inside each department, and '
      + 'a production flow that holds after the first good quarter. Seeking VP Operations or '
      + 'General Manager.'
  },

  [LENS.BUSINESS_DEV]: {
    headline: 'Business development leader who builds pipelines and the account discipline behind them',
    bio:
      'Industrial sales executive with 30+ years opening aerospace, defense, and government '
      + 'markets to manufacturers most of them were closed to. Scaled Trident Industrial from $6M '
      + 'to $20M by landing Boeing, Lockheed Martin, and Northrop Grumman, roughly $5M of it '
      + 'annual recurring, including a Boeing programme that equipped trucks to communicate with '
      + 'the International Space Station. Wrote the sole source procurement framework that closed '
      + 'at 60% across 50+ contracts. Built the sales function at Apex Manufacturing from nothing, '
      + 'hiring the first salesperson and working a 100-target list into three accounts worth $2M '
      + 'to $3M inside four weeks. At home in a cycle that runs six months to contract and '
      + 'eighteen to delivery.',
    proof_points: [
      { num: '$5M+', label: 'annual recurring revenue added at Trident Industrial' },
      { num: '$2M-$3M', label: 'from three accounts in four weeks' },
      // Replaces "6-18 months / sales cycle management". The cycle length moved
      // into the bio's last sentence; this is the stronger number.
      { num: '60%', label: 'close rate across 50+ sole source contracts' }
    ],
    ready_for_next:
      'Ready to build the revenue engine for a manufacturer whose product is better than its '
      + 'pipeline. Seeking VP Business Development or National Account leadership where the work '
      + 'is opening closed markets, not managing an inherited book.'
  },

  [LENS.EXECUTIVE]: {
    headline: 'Executive who rebuilds the system and develops the people inside it',
    bio:
      'Manufacturing executive with 30+ years of P&L ownership across specialty vehicle and '
      + 'motorsports production, and three companies entered while they were losing ground. Each '
      + 'was left with revenue up and the team smaller: Trident Industrial from $6M to $20M, '
      + 'Keystone Systems down from 22 people to 16 with every one of the 16 measurably stronger, '
      + 'Apex Manufacturing delivering 100% on time inside 50 days on a floor cut from 25 to 13. '
      + 'The method does not change. Make the work visible, put the quality check inside the '
      + 'department that does the work, and teach the supervisors the reasoning rather than the '
      + 'correction, so the system still runs after the person who built it has gone.',
    proof_points: [
      { num: '$20M', label: 'revenue scaled at Trident Industrial' },
      { num: '48%', label: 'headcount reduction with improved output' },
      { num: '100%', label: 'on-time delivery achieved in 50 days' }
    ],
    ready_for_next:
      'Ready to run a business that needs both halves fixed: a floor that is not shipping and a '
      + 'pipeline that is not filling. Seeking General Manager, VP Operations, or VP Business '
      + 'Development.'
  }
}

function validate(id, patch) {
  assertNoEmDash(patch.headline, id + '.headline')
  assertNoEmDash(patch.bio, id + '.bio')
  assertNoEmDash(patch.ready_for_next, id + '.ready_for_next')
  assertNoEmDash(patch.proof_points, id + '.proof_points')

  const fail = (m) => { throw new Error(id + ': ' + m) }
  if (patch.headline.length > LIMITS.headline) fail('headline too long')
  if (patch.bio.length > LIMITS.bio) fail('bio too long')
  if (patch.ready_for_next.length > LIMITS.ready_for_next) fail('ready_for_next too long')
  if (patch.proof_points.length !== PROOF_POINT_COUNT) fail('needs exactly 3 proof points')
  for (const p of patch.proof_points) {
    if (!p.num || p.num.length > LIMITS.proof_num) fail('proof num out of range: ' + p.num)
    if (!p.label || p.label.length > LIMITS.proof_label) fail('proof label out of range: ' + p.label)
  }
}

async function main() {
  const { data: lenses, error } = await sb
    .from('profile_lenses')
    .select('id, name, headline, bio, proof_points, ready_for_next')
    .eq('profile_id', PROFILE_ID)
  if (error) throw error

  for (const lens of lenses) {
    const patch = REWRITE[lens.id]
    if (!patch) { console.log('(no rewrite for ' + lens.name + ')'); continue }
    validate(lens.id, patch)

    console.log('\n==== ' + lens.name + '  ' + lens.id)
    console.log('  headline [' + lens.headline.length + ' -> ' + patch.headline.length + ']')
    console.log('    - ' + lens.headline)
    console.log('    + ' + patch.headline)
    console.log('  bio [' + lens.bio.length + ' -> ' + patch.bio.length + ']')
    console.log('    + ' + patch.bio.slice(0, 160) + ' ...')
    console.log('  proof_points')
    for (let i = 0; i < PROOF_POINT_COUNT; i++) {
      const before = lens.proof_points[i]
      const after = patch.proof_points[i]
      const same = before && before.num === after.num && before.label === after.label
      console.log('    ' + (same ? '=' : '-') + ' ' + (before ? before.num + ' / ' + before.label : '(none)'))
      if (!same) console.log('    + ' + after.num + ' / ' + after.label)
    }
    console.log('  ready_for_next [' + (lens.ready_for_next || '').length + ' -> ' + patch.ready_for_next.length + ']')
  }

  const { data: profile } = await sb
    .from('career_profiles').select('slug').eq('id', PROFILE_ID).maybeSingle()
  console.log('\n==== slug')
  console.log('    - ' + profile.slug)
  console.log('    + ' + SLUG)

  if (!APPLY) { console.log('\nDRY RUN - nothing written. Pass --apply to write.'); return }

  console.log('\nAPPLYING...')
  for (const [id, patch] of Object.entries(REWRITE)) {
    const { error } = await sb.from('profile_lenses').update(patch).eq('id', id).eq('profile_id', PROFILE_ID)
    console.log(error ? '  FAIL ' + id + ': ' + error.message : '  ok  ' + id)
  }
  const { error: slugError } = await sb
    .from('career_profiles').update({ slug: SLUG }).eq('id', PROFILE_ID)
  console.log(slugError ? '  FAIL slug: ' + slugError.message : '  ok  slug -> ' + SLUG)
}

main().catch(e => { console.error('ERR', e.message); process.exit(1) })
