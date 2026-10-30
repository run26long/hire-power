#!/usr/bin/env node
/**
 * One-time migration to one core resume per user.
 *
 *   node scripts/one-core-migration.js             # DRY RUN (default)
 *   node scripts/one-core-migration.js --dry-run   # same thing, said out loud
 *   node scripts/one-core-migration.js --apply     # writes
 *
 * Dry run is the default, the same shape as every other backfill here. It
 * prints every write it would make and changes nothing.
 *
 * WHAT IT IS FOR
 *
 * The product used to let a Pro account hold up to three core resumes, one per
 * Career Direction, bound through profile_lenses.core_resume_id. It no longer
 * does: there is one core resume, it is called "Core Resume", and a direction
 * reads the account's one core rather than owning one. The code enforces that
 * from here on; this is the data that predates it.
 *
 * SEVEN STEPS, IN THIS ORDER
 *
 *   a  daniel-mercer-test's lens core is archived and released.
 *   b  denia-bent's lens core becomes a job-specific resume under her priority
 *      core, and her Photography direction lets go of it. The direction's id is
 *      printed, because the next task attaches that resume to that direction.
 *   c  every account that has a real core loses its leftover unfinished chat
 *      rows - the ones the hub has never shown.
 *   d  every account still holding more than one real core keeps one.
 *   e  the survivor is flagged is_priority_core, and nothing else is.
 *   f  every core_resume_id and every resumes.lens_id is cleared.
 *   g  a before/after line per account.
 *
 * The order matters and the plan is built in it: (d) counts what (a), (b) and
 * (c) have already taken out, so a dry run reports the same decisions an apply
 * would make rather than counting rows that are about to go.
 *
 * WHAT IT WILL NOT TOUCH
 *
 * An account with no real core. Its only core rows are unfinished chat
 * sessions, which means somebody may be in the middle of one right now, and
 * archiving the row they are typing into would take the session away mid
 * sentence. Those accounts are listed and left exactly as they are - including
 * their is_priority_core flags, because freeCoreId reads that column to decide
 * which resume a free account keeps and rewriting it would move the answer for
 * an account this migration has no business changing.
 *
 * Job-specific resumes are never archived. One of them is created here (step
 * b) and the rest are left alone: a job-specific resume parented to a core
 * that gets archived stays active on purpose, which is what the hub and the
 * Vault have always done.
 *
 * Credentials come from .env.local (NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY). Service role, no session: this reads and writes
 * across every account, which is the whole point, and there is no user to
 * authenticate as.
 */

const fs = require('fs')
const path = require('path')

// ---- ENV ----
// No dotenv in this project, so parse .env.local directly. Anything already in
// the real environment wins, so you can override per-run from the shell.
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

for (const [name, value] of [
  ['NEXT_PUBLIC_SUPABASE_URL', SUPABASE_URL],
  ['SUPABASE_SERVICE_ROLE_KEY', SUPABASE_SERVICE_ROLE_KEY]
]) {
  if (!value) {
    console.error(`Missing ${name} in .env.local`)
    process.exit(1)
  }
}

const flags = process.argv.slice(2)
const apply = flags.includes('--apply')

const { createClient } = require('@supabase/supabase-js')
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
})

// ---- THE TWO NAMED ACCOUNTS ----
// Resolved by profile slug and then asserted against the resume's owner, so a
// hard-coded id that has since moved or been deleted stops the step rather
// than writing to somebody else's row. The ids are prefixes on purpose: they
// are what the task named, and matching on a prefix inside one account is
// unambiguous without pasting a full uuid twice.
const DANIEL = {
  slug: 'daniel-mercer-test',
  archiveCorePrefix: '7df610dd'
}
const DENIA = {
  slug: 'denia-bent',
  convertCorePrefix: '00ff37a1',
  parentCorePrefix: '8e43edd0',
  newName: 'Photography Resume'
}

// ---- WHICH CORE RESUMES ARE REAL ----
// lib/coreResumes.js, restated rather than imported: that file is ESM inside
// the Next app and this is a CommonJS script. Keep the two in step - it is the
// test the hub, the build limit and the breadcrumb all share, and the whole
// migration turns on it.
const isRealCore = (resume) =>
  Boolean(resume) && (resume.created_via !== 'resume_chat' || resume.coaching_complete === true)

const isCore = (row) => row.resume_type === 'core'
const short = (id) => String(id || '').slice(0, 8)
const day = (value) => (value ? String(value).slice(0, 10) : '—')

// An unfinished chat row: started the chat flow and walked away. Never shown on
// the hub, never switchable to, and the thing step (c) clears.
const isUnfinishedChat = (row) =>
  row.created_via === 'resume_chat' && row.coaching_complete !== true

function describe(row) {
  return [
    short(row.id),
    `"${row.display_name || ''}"`,
    row.resume_type,
    row.is_active ? 'active' : 'archived',
    row.is_priority_core ? 'priority' : '',
    `via=${row.created_via || 'null'}`,
    row.coaching_complete ? 'coached' : 'uncoached',
    `upd=${day(row.updated_at)}`
  ].filter(Boolean).join(' ')
}

async function main() {
  console.log(apply ? '=== APPLY: writing changes ===' : '=== DRY RUN: no writes (pass --apply to write) ===')
  console.log('')

  // ---- EVERYTHING IN HAND BEFORE ANY DECISION ----
  // Three reads, then all of the arithmetic in memory. The plan is built by
  // mutating this snapshot step by step, so each step sees what the steps
  // before it did and a dry run reports the decisions an apply would make.
  const [{ data: resumes, error: resumeError }, { data: lenses, error: lensError }, { data: profiles, error: profileError }] =
    await Promise.all([
      supabase
        .from('resumes')
        .select('id, user_id, resume_type, is_active, is_priority_core, created_via, coaching_complete, display_name, parent_resume_id, lens_id, updated_at, created_at'),
      supabase
        .from('profile_lenses')
        .select('id, user_id, profile_id, name, status, core_resume_id'),
      supabase
        .from('career_profiles')
        .select('id, user_id, slug')
    ])

  for (const [what, error] of [['resumes', resumeError], ['profile_lenses', lensError], ['career_profiles', profileError]]) {
    if (error) {
      console.error(`Could not read ${what}:`, error.message)
      process.exit(1)
    }
  }

  const slugOf = new Map((profiles || []).map(p => [p.user_id, p.slug]))
  const userBySlug = new Map((profiles || []).map(p => [p.slug, p.user_id]))
  const label = (userId) => slugOf.get(userId) || userId

  // The before picture, kept as plain strings so step (g) can print it after
  // the snapshot has been mutated.
  const before = new Map()
  const byUser = new Map()
  for (const row of resumes || []) {
    if (!byUser.has(row.user_id)) byUser.set(row.user_id, [])
    byUser.get(row.user_id).push(row)
  }
  for (const [userId, rows] of byUser) {
    const cores = rows.filter(isCore)
    const active = cores.filter(c => c.is_active)
    before.set(userId, {
      coreRows: cores.length,
      activeCores: active.length,
      realActiveCores: active.filter(isRealCore).length,
      priorityFlags: cores.filter(c => c.is_priority_core === true).length,
      jobSpecific: rows.filter(r => r.resume_type === 'job_specific' && r.is_active).length
    })
  }

  // ---- THE PLAN ----
  // One entry per write. Collected rather than issued so the dry run and the
  // apply walk the same list and cannot disagree about what was decided.
  const resumeWrites = []   // { id, userId, patch, why }
  const lensWrites = []     // { id, userId, patch, why }
  const notes = []          // things to say out loud that are not writes
  const skipped = []        // steps that found nothing to do

  const patchResume = (row, patch, why) => {
    resumeWrites.push({ id: row.id, userId: row.user_id, patch, why })
    Object.assign(row, patch)
  }
  const patchLens = (lens, patch, why) => {
    lensWrites.push({ id: lens.id, userId: lens.user_id, patch, why })
    Object.assign(lens, patch)
  }

  const coresOf = (userId) => (byUser.get(userId) || []).filter(isCore)
  const activeCoresOf = (userId) => coresOf(userId).filter(c => c.is_active)

  // ---- (a) daniel-mercer-test: archive the lens core ----
  {
    const userId = userBySlug.get(DANIEL.slug)
    if (!userId) {
      skipped.push(`(a) no career_profiles row with slug '${DANIEL.slug}' - step skipped`)
    } else {
      const target = coresOf(userId).find(c => c.id.startsWith(DANIEL.archiveCorePrefix))
      if (!target) {
        skipped.push(`(a) ${DANIEL.slug} has no core resume starting ${DANIEL.archiveCorePrefix} - step skipped`)
      } else if (!target.is_active) {
        skipped.push(`(a) ${DANIEL.slug} core ${short(target.id)} is already archived - nothing to do`)
      } else {
        patchResume(target, { is_active: false }, `(a) archive ${DANIEL.slug}'s lens core`)
        for (const lens of (lenses || []).filter(l => l.user_id === userId && l.core_resume_id === target.id)) {
          patchLens(lens, { core_resume_id: null }, `(a) release "${lens.name}" from the archived core`)
        }
      }
    }
  }

  // ---- (b) denia-bent: convert the lens core to a job-specific resume ----
  {
    const userId = userBySlug.get(DENIA.slug)
    if (!userId) {
      skipped.push(`(b) no career_profiles row with slug '${DENIA.slug}' - step skipped`)
    } else {
      const target = coresOf(userId).find(c => c.id.startsWith(DENIA.convertCorePrefix))
      const parent = coresOf(userId).find(c => c.id.startsWith(DENIA.parentCorePrefix))
      if (!target) {
        skipped.push(`(b) ${DENIA.slug} has no core resume starting ${DENIA.convertCorePrefix} - step skipped`)
      } else if (!parent) {
        // Refused rather than guessed. parent_resume_id is what ties this
        // resume to the career it came out of, and picking a different core
        // because the named one is missing would file it under the wrong one.
        skipped.push(`(b) ${DENIA.slug} has no core resume starting ${DENIA.parentCorePrefix} to parent to - step skipped`)
      } else {
        patchResume(
          target,
          {
            resume_type: 'job_specific',
            display_name: DENIA.newName,
            parent_resume_id: parent.id,
            // A job-specific resume is not a core, so it holds no core's
            // flags. Left set, this row would keep competing for the priority
            // flag that step (e) is about to settle.
            is_priority_core: false
          },
          `(b) convert ${DENIA.slug}'s "Photography Core Resume" to a job-specific resume under ${short(parent.id)}`
        )

        const bound = (lenses || []).filter(l => l.user_id === userId && l.core_resume_id === target.id)
        for (const lens of bound) {
          patchLens(lens, { core_resume_id: null }, `(b) release "${lens.name}" from the converted resume`)
          notes.push(
            `(b) NEXT TASK: attach job-specific resume ${target.id} to Career Direction "${lens.name}" (lens id ${lens.id})`
          )
        }
        if (bound.length === 0) {
          notes.push(`(b) no Career Direction is bound to ${short(target.id)}; nothing to print for the next task`)
        }
      }
    }
  }

  // ---- (c) leftover unfinished chat rows, where a real core exists ----
  // Only for an account that has a real core. One with none may have somebody
  // inside that very chat session right now - see the header.
  for (const [userId] of byUser) {
    const active = activeCoresOf(userId)
    const real = active.filter(isRealCore)
    if (real.length === 0) {
      if (active.length > 0) {
        notes.push(`(c) ${label(userId)}: no real core, ${active.length} active chat row(s) left alone`)
      }
      continue
    }
    for (const row of active.filter(isUnfinishedChat)) {
      patchResume(row, { is_active: false }, `(c) archive unfinished chat row for ${label(userId)}`)
    }
  }

  // ---- (d) more than one real core: keep one ----
  // The priority core, else the most recently updated coached one, else the
  // most recently updated. Same preference order the app reads cores in, so
  // the one kept is the one the hub was already opening on.
  const newest = (a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || ''))
  for (const [userId] of byUser) {
    const real = activeCoresOf(userId).filter(isRealCore)
    if (real.length <= 1) continue

    const keep =
      real.find(c => c.is_priority_core === true) ||
      [...real].filter(c => c.coaching_complete === true).sort(newest)[0] ||
      [...real].sort(newest)[0]

    for (const row of real) {
      if (row.id === keep.id) continue
      patchResume(row, { is_active: false }, `(d) archive duplicate core for ${label(userId)} (keeping ${short(keep.id)})`)
    }
  }

  // ---- (e) one priority flag per account ----
  // True on the one real core left, false on every other core row of that
  // account. An account with no real core left is not touched at all.
  for (const [userId] of byUser) {
    const cores = coresOf(userId)
    const real = cores.filter(c => c.is_active && isRealCore(c))
    if (real.length !== 1) {
      if (real.length === 0 && cores.some(c => c.is_priority_core === true)) {
        notes.push(`(e) ${label(userId)}: no real active core, priority flags left as they are`)
      }
      if (real.length > 1) {
        // Cannot happen after (d); reported rather than silently flagged, so a
        // change to (d) that breaks the invariant is visible.
        notes.push(`(e) ${label(userId)}: ${real.length} real active cores after step (d) - NOT flagged, investigate`)
      }
      continue
    }
    const survivor = real[0]
    if (survivor.is_priority_core !== true) {
      patchResume(survivor, { is_priority_core: true }, `(e) flag ${label(userId)}'s core as the priority core`)
    }
    for (const row of cores) {
      if (row.id === survivor.id) continue
      if (row.is_priority_core === true) {
        patchResume(row, { is_priority_core: false }, `(e) clear stale priority flag for ${label(userId)}`)
      }
    }
  }

  // ---- (f) nothing binds a core to a direction any more ----
  for (const lens of lenses || []) {
    if (lens.core_resume_id) {
      patchLens(lens, { core_resume_id: null }, `(f) clear core_resume_id on "${lens.name}" (${label(lens.user_id)})`)
    }
  }
  for (const row of resumes || []) {
    if (row.lens_id) {
      patchResume(row, { lens_id: null }, `(f) clear lens_id on ${short(row.id)} (${label(row.user_id)})`)
    }
  }

  // ---- WHAT THE PLAN SAYS ----
  const touchedUsers = new Set([
    ...resumeWrites.map(w => w.userId),
    ...lensWrites.map(w => w.userId)
  ])

  console.log(`Accounts in the data: ${byUser.size}`)
  console.log(`Accounts this touches: ${touchedUsers.size}`)
  console.log(`Resume writes: ${resumeWrites.length}   Career Direction writes: ${lensWrites.length}`)
  console.log('')

  if (skipped.length > 0) {
    console.log('---- STEPS WITH NOTHING TO DO ----')
    for (const line of skipped) console.log(`  ${line}`)
    console.log('')
  }

  if (notes.length > 0) {
    console.log('---- NOTES ----')
    for (const line of notes) console.log(`  ${line}`)
    console.log('')
  }

  console.log('---- EVERY CHANGE, BY ACCOUNT ----')
  for (const userId of [...touchedUsers].sort((a, b) => label(a).localeCompare(label(b)))) {
    console.log(`\n${label(userId)}  (${userId})`)
    for (const w of resumeWrites.filter(w => w.userId === userId)) {
      console.log(`  resumes      ${short(w.id)}  ${JSON.stringify(w.patch)}`)
      console.log(`               ${w.why}`)
    }
    for (const w of lensWrites.filter(w => w.userId === userId)) {
      console.log(`  lens         ${short(w.id)}  ${JSON.stringify(w.patch)}`)
      console.log(`               ${w.why}`)
    }
  }
  console.log('')

  // ---- THE WRITES ----
  // Row by row, each scoped to its owner. The service role sees every row, so
  // the user_id on the update is the only thing keeping a mistyped id from
  // landing on somebody else's resume.
  let written = 0
  let failed = 0
  if (apply) {
    console.log('---- WRITING ----')
    for (const w of resumeWrites) {
      const { error } = await supabase
        .from('resumes')
        .update({ ...w.patch, updated_at: new Date().toISOString() })
        .eq('id', w.id)
        .eq('user_id', w.userId)
      if (error) {
        failed++
        console.error(`  FAILED resumes ${short(w.id)}: ${error.message}`)
      } else {
        written++
      }
    }
    for (const w of lensWrites) {
      const { error } = await supabase
        .from('profile_lenses')
        .update({ ...w.patch, updated_at: new Date().toISOString() })
        .eq('id', w.id)
        .eq('user_id', w.userId)
      if (error) {
        failed++
        console.error(`  FAILED profile_lenses ${short(w.id)}: ${error.message}`)
      } else {
        written++
      }
    }
    console.log(`  ${written} written, ${failed} failed`)
    console.log('')
  }

  // ---- (g) BEFORE AND AFTER ----
  // Read back from the database on an apply, so the "after" is what is on file
  // rather than what this intended. On a dry run it is the mutated snapshot,
  // which is the same thing by construction.
  let afterRows = resumes || []
  let afterLenses = lenses || []
  if (apply) {
    const [{ data: freshResumes }, { data: freshLenses }] = await Promise.all([
      supabase
        .from('resumes')
        .select('id, user_id, resume_type, is_active, is_priority_core, created_via, coaching_complete, display_name, lens_id, updated_at'),
      supabase
        .from('profile_lenses')
        .select('id, user_id, name, core_resume_id')
    ])
    if (freshResumes) afterRows = freshResumes
    if (freshLenses) afterLenses = freshLenses
  }

  const afterByUser = new Map()
  for (const row of afterRows) {
    if (!afterByUser.has(row.user_id)) afterByUser.set(row.user_id, [])
    afterByUser.get(row.user_id).push(row)
  }

  console.log('---- BEFORE / AFTER, BY ACCOUNT ----')
  console.log('  (cores = core rows, active = active cores, real = real active cores, prio = priority flags)')
  for (const userId of [...byUser.keys()].sort((a, b) => label(a).localeCompare(label(b)))) {
    const b = before.get(userId)
    const rows = afterByUser.get(userId) || []
    const cores = rows.filter(isCore)
    const active = cores.filter(c => c.is_active)
    const real = active.filter(isRealCore)
    const a = {
      coreRows: cores.length,
      activeCores: active.length,
      realActiveCores: real.length,
      priorityFlags: cores.filter(c => c.is_priority_core === true).length,
      jobSpecific: rows.filter(r => r.resume_type === 'job_specific' && r.is_active).length
    }

    const changed =
      b.coreRows !== a.coreRows ||
      b.activeCores !== a.activeCores ||
      b.realActiveCores !== a.realActiveCores ||
      b.priorityFlags !== a.priorityFlags ||
      b.jobSpecific !== a.jobSpecific ||
      touchedUsers.has(userId)

    if (!changed) continue

    console.log(`\n${label(userId)}`)
    console.log(`  before  cores=${b.coreRows} active=${b.activeCores} real=${b.realActiveCores} prio=${b.priorityFlags} job-specific=${b.jobSpecific}`)
    console.log(`  after   cores=${a.coreRows} active=${a.activeCores} real=${a.realActiveCores} prio=${a.priorityFlags} job-specific=${a.jobSpecific}`)
    for (const row of rows.filter(r => isCore(r) || r.resume_type === 'job_specific').sort((x, y) => String(x.created_at || '').localeCompare(String(y.created_at || '')))) {
      console.log(`    ${describe(row)}`)
    }
  }
  console.log('')

  // ---- THE INVARIANTS THIS WAS FOR ----
  const multiReal = [...afterByUser.entries()].filter(([, rows]) =>
    rows.filter(r => isCore(r) && r.is_active && isRealCore(r)).length > 1
  )
  const stillBound = afterLenses.filter(l => l.core_resume_id)
  const stillStamped = afterRows.filter(r => r.lens_id)
  const activeLensCores = afterRows.filter(r => isCore(r) && r.is_active && r.created_via === 'lens_core')

  console.log('---- INVARIANTS ----')
  console.log(`  accounts with more than one real active core: ${multiReal.length}${multiReal.length ? ' -> ' + multiReal.map(([u]) => label(u)).join(', ') : ''}`)
  console.log(`  Career Directions still bound to a core:      ${stillBound.length}`)
  console.log(`  resumes still carrying lens_id:               ${stillStamped.length}`)
  console.log(`  active core rows with created_via lens_core:  ${activeLensCores.length}`)
  console.log('')
  console.log(apply ? 'Done.' : 'Dry run complete. Nothing was written. Re-run with --apply.')
}

main().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
