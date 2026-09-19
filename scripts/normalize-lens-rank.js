#!/usr/bin/env node
/**
 * One-time: give profile_lenses.sort_order a real ordering, and bind primaries
 * to the core resumes they were meant to point at.
 *
 *   node scripts/normalize-lens-rank.js            # dry run
 *   node scripts/normalize-lens-rank.js --apply
 *
 * WHY THE RANK
 * sort_order was 0 on 39 of 42 rows, and 8 of 10 accounts had every lens tied
 * at 0. Both pages sorted by it and then fell through to created_at, so the
 * order was whatever insertion happened to be - readable, but not addressable.
 * The hub now has to put a chosen direction into a chosen slot, and there was
 * no handle to do it with.
 *
 * This writes down the order that is already on screen. Rows are ranked in the
 * exact sequence both pages render them in today (sort_order, then created_at),
 * so nothing visibly moves, and afterwards the column is dense and unique per
 * account.
 *
 * TWO DELIBERATE EXCEPTIONS
 *
 *   The primary takes rank 0 whatever its created_at. It is identified as
 *   `source: 'user'` at `sort_order: 0`, so any other value would stop it being
 *   the primary at all - the visibility route would let it be hidden and the
 *   drawer would offer a switch against it. On accounts where a suggestion was
 *   created first this does move the primary to the front of the public page,
 *   which is where the direction the page is written around belongs.
 *
 *   Dismissed directions rank last, under everything else, which is where the
 *   dismiss route now puts them. They sit at the bottom of the hub's
 *   "Additional suggestions" menu rather than mixed through the overflow.
 *
 * WHY THE BINDING
 * A lens is tied to its resume by core_resume_id, and that tie is what locks
 * the direction on the Career Profile and gives it a switch tile on the hub.
 * The backfill that made those ties ran before two primaries existed, so those
 * two were never offered one: the account has a finished core resume and a
 * primary direction with nothing between them. The core is bound to the
 * primary when the account has exactly one unclaimed core and the primary has
 * none - never guessing between two.
 */

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local')
  if (!fs.existsSync(envPath)) {
    console.error(`Could not find ${envPath}`)
    process.exit(1)
  }
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const match = trimmed.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/)
    if (!match) continue
    const key = match[1]
    let value = match[2].trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

loadEnvLocal()

const APPLY = process.argv.includes('--apply')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const isPrimary = (l) => l.source === 'user' && l.sort_order === 0

async function main() {
  const [{ data: profiles }, { data: lenses }, { data: cores }] = await Promise.all([
    supabase.from('career_profiles').select('id, slug, user_id'),
    supabase.from('profile_lenses')
      .select('id, user_id, profile_id, name, status, source, sort_order, core_resume_id, created_at'),
    supabase.from('resumes')
      .select('id, user_id, is_active, is_priority_core, coaching_complete, display_name')
      .eq('resume_type', 'core')
  ])

  const rankWrites = []
  const bindWrites = []
  const notes = []

  for (const profile of profiles) {
    const mine = (lenses || []).filter(l => l.profile_id === profile.id)
    if (!mine.length) continue

    // ---- RANK ----
    // The order both pages already render, made explicit.
    const current = (a, b) =>
      (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
      String(a.created_at || '').localeCompare(String(b.created_at || ''))

    const primary = mine.find(isPrimary) || null
    const live = mine.filter(l => l !== primary && l.status !== 'dismissed').sort(current)
    const gone = mine.filter(l => l !== primary && l.status === 'dismissed').sort(current)
    const ordered = [...(primary ? [primary] : []), ...live, ...gone]

    if (!primary) notes.push(`${profile.slug}: no primary lens — ranked by existing order alone.`)

    ordered.forEach((lens, index) => {
      if (lens.sort_order === index) return
      rankWrites.push({
        id: lens.id,
        profile: profile.slug,
        name: lens.name,
        from: lens.sort_order,
        to: index,
        why: lens === primary ? 'primary leads'
          : lens.status === 'dismissed' ? 'dismissed, ranks last'
          : 'dense rank'
      })
    })

    // ---- BINDING ----
    if (!primary) continue
    if (primary.core_resume_id) continue

    const claimed = new Set(mine.map(l => l.core_resume_id).filter(Boolean))
    const usable = (cores || []).filter(r =>
      r.user_id === profile.user_id &&
      r.is_active &&
      r.coaching_complete === true &&
      !claimed.has(r.id)
    )

    if (!usable.length) {
      notes.push(`${profile.slug}: primary "${primary.name}" has no core, and no unclaimed finished core to bind.`)
      continue
    }
    // The priority core if there is one, since that is the resume the hub opens
    // with and the pairing every healthy account already has.
    const pick = usable.find(r => r.is_priority_core) || (usable.length === 1 ? usable[0] : null)
    if (!pick) {
      notes.push(
        `${profile.slug}: primary "${primary.name}" has no core and ${usable.length} unclaimed ` +
        `cores with no priority among them. Not guessing.`
      )
      continue
    }
    bindWrites.push({
      id: primary.id,
      profile: profile.slug,
      name: primary.name,
      resumeId: pick.id,
      priority: pick.is_priority_core === true
    })
  }

  console.log(`\n${APPLY ? 'APPLYING' : 'DRY RUN'}`)

  console.log(`\n--- RANK (${rankWrites.length} rows) ---`)
  for (const w of rankWrites) {
    console.log(`  ${w.profile.padEnd(24)} ${String(w.from).padStart(2)} -> ${String(w.to).padStart(2)}  ${w.name.padEnd(34)} ${w.why}`)
  }
  if (!rankWrites.length) console.log('  (nothing to do)')

  console.log(`\n--- BIND PRIMARY TO CORE (${bindWrites.length} rows) ---`)
  for (const w of bindWrites) {
    console.log(`  ${w.profile.padEnd(24)} ${w.name.padEnd(34)} -> ${w.resumeId}${w.priority ? '  (priority core)' : ''}`)
  }
  if (!bindWrites.length) console.log('  (nothing to do)')

  if (notes.length) {
    console.log('\n--- REPORTED, NOT CHANGED ---')
    for (const n of notes) console.log(`  - ${n}`)
  }

  if (!APPLY) {
    console.log('\nRe-run with --apply to write these.')
    return
  }

  let ok = 0
  for (const w of rankWrites) {
    const { error } = await supabase.from('profile_lenses')
      .update({ sort_order: w.to, updated_at: new Date().toISOString() })
      .eq('id', w.id)
    if (error) console.error(`  FAILED rank ${w.profile}/${w.name}:`, error.message)
    else ok += 1
  }
  for (const w of bindWrites) {
    const { error } = await supabase.from('profile_lenses')
      .update({ core_resume_id: w.resumeId, status: 'active', updated_at: new Date().toISOString() })
      .eq('id', w.id)
    if (error) console.error(`  FAILED bind ${w.profile}/${w.name}:`, error.message)
    else ok += 1
  }
  console.log(`\nWrote ${ok} of ${rankWrites.length + bindWrites.length}.`)
}

main().catch(err => { console.error(err); process.exit(1) })
