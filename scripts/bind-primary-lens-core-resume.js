/**
 * One-time backfill: point every primary lens at its account's core resume.
 *
 * A core resume is named after the direction whose lens points at it, through
 * profile_lenses.core_resume_id. A primary lens with that column empty names
 * nothing, so its owner's core is called "Core Resume" on every screen even
 * though the direction is sitting right there on their profile.
 *
 * WHY THE COLUMN IS EMPTY ON ANY ROW AT ALL
 *
 * ensurePrimaryLens sets it, and ensurePrimaryLens runs at the end of coaching.
 * An account whose core has never finished coaching has therefore never had the
 * binding written: the lens exists, the core exists, and nothing has yet run
 * that would join them. That is one row on file today, and it is not a data
 * error so much as a step that has not happened yet.
 *
 * WHAT IT MATCHES ON
 *
 * The account's priority core, resolved exactly the way every other query here
 * resolves it: the flagged one where there is one, the newest otherwise. A
 * strict is_priority_core filter would return nothing for an account that
 * predates the column.
 *
 * WHAT IT WILL NOT TOUCH
 *
 * A lens already pointing at one of that account's active cores. That pointer
 * is either correct or somebody's own arrangement, and this has no way to tell
 * which - so it leaves both alone. Only an empty pointer, or one aimed at a
 * resume that is no longer an active core of theirs, is written.
 *
 * Usage (from the repo root):
 *
 *   node scripts/bind-primary-lens-core-resume.js            # DRY RUN
 *   node scripts/bind-primary-lens-core-resume.js --apply    # writes
 *   node scripts/bind-primary-lens-core-resume.js --verbose  # also prints skips
 *
 * Dry run is the default, the same shape as every other backfill here.
 *
 * Credentials come from .env.local (NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY).
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
const verbose = flags.includes('--verbose')

const { createClient } = require('@supabase/supabase-js')
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// source 'user' with sort_order 0 is the pair ensurePrimaryLens uses as the
// primary's identity, so this asks the same question the writer answers.
function isPrimary(lens) {
  return lens?.source === 'user' && lens?.sort_order === 0 && lens?.status === 'active'
}

async function main() {
  console.log(apply ? '=== APPLYING ===' : '=== DRY RUN (nothing will be written) ===')
  console.log()

  const [{ data: lenses, error: lensError }, { data: cores, error: coreError }] = await Promise.all([
    supabase.from('profile_lenses').select('id, user_id, name, source, sort_order, status, core_resume_id'),
    supabase
      .from('resumes')
      .select('id, user_id, display_name, is_active, is_priority_core, created_at')
      .eq('resume_type', 'core')
      .eq('is_active', true)
  ])

  if (lensError || coreError) {
    console.error('Lookup failed:', (lensError || coreError).message)
    process.exit(1)
  }

  // The priority core per account, and the set of every active core, resolved
  // once rather than per lens.
  const coresByUser = new Map()
  for (const core of cores) {
    if (!coresByUser.has(core.user_id)) coresByUser.set(core.user_id, [])
    coresByUser.get(core.user_id).push(core)
  }
  for (const list of coresByUser.values()) {
    list.sort((a, b) =>
      (b.is_priority_core ? 1 : 0) - (a.is_priority_core ? 1 : 0) ||
      new Date(b.created_at) - new Date(a.created_at)
    )
  }

  const primaries = lenses.filter(isPrimary)
  const stats = { primaries: primaries.length, bound: 0, alreadyBound: 0, noCore: 0, repointed: 0, errors: 0 }
  const problems = []
  const pending = []

  for (const lens of primaries) {
    const list = coresByUser.get(lens.user_id) || []
    const tag = `${lens.user_id.slice(0, 8)}  ${lens.name}`

    if (list.length === 0) {
      stats.noCore += 1
      if (verbose) console.log(`  skip (no active core)  ${tag}`)
      continue
    }

    const activeIds = new Set(list.map(c => c.id))
    if (lens.core_resume_id && activeIds.has(lens.core_resume_id)) {
      stats.alreadyBound += 1
      if (verbose) console.log(`  skip (already bound)   ${tag}`)
      continue
    }

    const target = list[0]
    const repoint = Boolean(lens.core_resume_id)
    if (repoint) stats.repointed += 1
    pending.push({ lens, target, repoint })
    console.log(
      `  ${tag}\n` +
      `      ${repoint ? 'REPOINT (target is not an active core)' : 'BIND (was empty)'}\n` +
      `      -> ${target.id.slice(0, 8)}  ${JSON.stringify(target.display_name)}` +
      `${target.is_priority_core ? '  (flagged priority core)' : '  (newest active core)'}`
    )
  }

  if (apply) {
    for (const item of pending) {
      const { error } = await supabase
        .from('profile_lenses')
        .update({ core_resume_id: item.target.id, updated_at: new Date().toISOString() })
        .eq('id', item.lens.id)
      if (error) {
        stats.errors += 1
        problems.push(`  WRITE FAILED  ${item.lens.id}  ${error.message}`)
      } else {
        stats.bound += 1
      }
    }
  } else {
    stats.bound = pending.length
  }

  console.log()
  console.log('---------------------------------------------')
  console.log(`primary lenses          ${stats.primaries}`)
  console.log(`  ${apply ? 'bound' : 'would bind'}${apply ? '                 ' : '             '}${stats.bound}`)
  console.log(`    of which re-pointed  ${stats.repointed}`)
  console.log(`  already bound         ${stats.alreadyBound}`)
  console.log(`  skipped (no core)     ${stats.noCore}`)
  if (apply) console.log(`  write errors          ${stats.errors}`)
  console.log('---------------------------------------------')

  if (problems.length > 0) {
    console.log()
    console.log('Problems:')
    problems.forEach(p => console.log(p))
  }

  if (!apply) {
    console.log()
    console.log('Dry run. Re-run with --apply to write.')
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
