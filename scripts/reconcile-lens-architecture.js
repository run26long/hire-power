#!/usr/bin/env node
/**
 * One-time reconciliation of profile_lenses against the rules the two pages
 * now enforce between them.
 *
 *   node scripts/reconcile-lens-architecture.js            # dry run
 *   node scripts/reconcile-lens-architecture.js --apply
 *
 * THREE THINGS IT FIXES
 *
 * 1. A lens holding a LIVE core resume that is not active.
 *    Building a core is supposed to put the direction on the Career Profile
 *    and lock it there. Rows predating that rule - the backfill scripts made
 *    some - hold a real resume while sitting on 'suggested', which means the
 *    public route's status filter leaves them off the page entirely. The
 *    direction has a resume behind it and shows nowhere.
 *
 *    Never past three. The page renders three, so a promotion that would make
 *    a fourth is reported and not made: it would be written active and then
 *    sliced off, which is the same invisibility in a different place.
 *
 * 2. A profile with no primary lens.
 *    The primary is `source: 'user'` at `sort_order: 0`, and it is what the
 *    visibility route refuses to hide. A profile without one has no protected
 *    direction at all - every row shows a switch, and turning the last one off
 *    leaves a published page with nothing on it.
 *
 *    The lens holding the priority core is preferred, because that is the pair
 *    every healthy profile already has: the resume the hub opens with, and the
 *    direction it was written for. Failing that, the active one.
 *
 *    The other active directions on that profile are pushed past it in
 *    sort_order, so the primary actually leads the page rather than merely
 *    being named as primary while something else sorts first.
 *
 * 3. A lens holding a core that is archived or gone.
 *    Deleting a core now releases the lens; nothing used to. Such a row is
 *    locked to a resume the Resume Writer no longer lists, and the hub will
 *    not draw a tile for it either - locked on one page, absent from the
 *    other. The pointer is cleared and the status left alone.
 *
 * Reads everything first and prints the whole plan before writing anything.
 */

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

// No dotenv in this project, so parse .env.local directly. Anything already in
// the real environment wins, so you can override per-run from the shell. Same
// loader the other one-time scripts in here use.
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

const MAX_ACTIVE = 3

const isPrimary = (lens) => lens.source === 'user' && lens.sort_order === 0

async function main() {
  const [{ data: profiles, error: pErr }, { data: lenses, error: lErr }, { data: cores, error: rErr }] =
    await Promise.all([
      supabase.from('career_profiles').select('id, slug, user_id, is_published'),
      supabase.from('profile_lenses')
        .select('id, user_id, profile_id, name, status, source, sort_order, core_resume_id, created_at'),
      supabase.from('resumes')
        .select('id, user_id, is_active, is_priority_core')
        .eq('resume_type', 'core')
    ])

  if (pErr || lErr || rErr) {
    console.error('Read failed:', pErr || lErr || rErr)
    process.exit(1)
  }

  const coreById = new Map(cores.map(r => [r.id, r]))
  const liveCore = (id) => {
    const c = id ? coreById.get(id) : null
    return c && c.is_active ? c : null
  }

  // Every write the run intends, gathered before any of them is made so the
  // dry run and the apply are reading from exactly the same plan.
  const writes = []
  const notes = []

  for (const profile of profiles) {
    const mine = lenses
      .filter(l => l.profile_id === profile.id)
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
    if (!mine.length) continue

    const label = profile.slug
    let activeCount = mine.filter(l => l.status === 'active').length

    // ---- 3. release pointers to cores that are gone ----
    for (const lens of mine) {
      if (lens.core_resume_id && !liveCore(lens.core_resume_id)) {
        writes.push({
          id: lens.id,
          profile: label,
          name: lens.name,
          reason: 'core archived or missing',
          patch: { core_resume_id: null }
        })
      }
    }

    // ---- 1. promote a coreless-looking row that actually holds a core ----
    for (const lens of mine) {
      if (!liveCore(lens.core_resume_id)) continue
      if (lens.status === 'active') continue
      if (activeCount >= MAX_ACTIVE) {
        notes.push(
          `${label}: "${lens.name}" holds a live core but ${label} already shows ` +
          `${activeCount} directions. Left on '${lens.status}'.`
        )
        continue
      }
      writes.push({
        id: lens.id,
        profile: label,
        name: lens.name,
        reason: `holds a live core, was '${lens.status}'`,
        patch: { status: 'active' }
      })
      activeCount += 1
    }

    // ---- 2. backfill a primary ----
    if (mine.some(isPrimary)) continue

    // The status this run is giving each row, not the one on disk, so a lens
    // promoted a moment ago is eligible to be the primary.
    const plannedStatus = (lens) => {
      const w = writes.find(x => x.id === lens.id && 'status' in x.patch)
      return w ? w.patch.status : lens.status
    }

    const candidate =
      mine.find(l => liveCore(l.core_resume_id) && liveCore(l.core_resume_id).is_priority_core) ||
      mine.find(l => liveCore(l.core_resume_id)) ||
      mine.find(l => plannedStatus(l) === 'active')

    if (!candidate) {
      notes.push(`${label}: no primary and no candidate for one. Left alone.`)
      continue
    }

    const existing = writes.find(w => w.id === candidate.id)
    const patch = { source: 'user', sort_order: 0 }
    if (plannedStatus(candidate) !== 'active') patch.status = 'active'
    if (existing) {
      Object.assign(existing.patch, patch)
      existing.reason += '; made primary'
    } else {
      writes.push({
        id: candidate.id,
        profile: label,
        name: candidate.name,
        reason: 'profile had no primary',
        patch
      })
    }

    // Everything else on this profile sorts after it, so the primary leads the
    // page rather than only being called the primary.
    let order = 1
    for (const lens of mine) {
      if (lens.id === candidate.id) continue
      if (plannedStatus(lens) !== 'active') continue
      if (lens.sort_order === order) { order += 1; continue }
      const prior = writes.find(w => w.id === lens.id)
      if (prior) Object.assign(prior.patch, { sort_order: order })
      else {
        writes.push({
          id: lens.id,
          profile: label,
          name: lens.name,
          reason: `sorts after the new primary`,
          patch: { sort_order: order }
        })
      }
      order += 1
    }
  }

  console.log(`\n${APPLY ? 'APPLYING' : 'DRY RUN'} — ${writes.length} lens row(s) to change\n`)
  for (const w of writes) {
    console.log(`  ${w.profile.padEnd(24)} ${w.name}`)
    console.log(`      ${w.reason}`)
    console.log(`      ${JSON.stringify(w.patch)}`)
  }
  if (notes.length) {
    console.log('\nReported, not changed:')
    for (const n of notes) console.log(`  - ${n}`)
  }
  if (!writes.length) {
    console.log('  (nothing to do)')
    return
  }

  if (!APPLY) {
    console.log('\nRe-run with --apply to write these.')
    return
  }

  let ok = 0
  for (const w of writes) {
    const { error } = await supabase
      .from('profile_lenses')
      .update({ ...w.patch, updated_at: new Date().toISOString() })
      .eq('id', w.id)
    if (error) console.error(`  FAILED ${w.profile} / ${w.name}:`, error.message)
    else ok += 1
  }
  console.log(`\nWrote ${ok} of ${writes.length}.`)
}

main().catch(err => { console.error(err); process.exit(1) })
