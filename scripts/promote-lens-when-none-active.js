/**
 * One-time backfill: give every profile at least one active direction.
 *
 * The public profile now renders only lenses with status 'active'. It used to
 * render suggestions as well, so an account that never activated anything still
 * had directions on its page - and one account has exactly that and nothing
 * else. Left alone, its profile would go from three directions to none the
 * moment the filter changes.
 *
 * So the first of its directions is promoted to active. First by sort_order,
 * which is the order Coach ranked them in and the order the profile itself
 * reads, so the one promoted is the one that was already leading the page.
 *
 * WHAT IT WILL NOT TOUCH
 *
 * Any profile that already has an active lens. Dismissed lenses, which somebody
 * deliberately got rid of and which promoting would resurrect. And hidden ones,
 * for the same reason: hidden is a decision, and the whole point of this feature
 * is that the decision sticks.
 *
 * Usage (from the repo root):
 *
 *   node scripts/promote-lens-when-none-active.js            # DRY RUN
 *   node scripts/promote-lens-when-none-active.js --apply    # writes
 *
 * Dry run is the default. Run it after the public route's filter ships, and
 * before anybody looks at a profile that has gone quiet.
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

const sortWeight = (lens) =>
  Number.isFinite(lens?.sort_order) ? lens.sort_order : Number.MAX_SAFE_INTEGER

async function main() {
  console.log(apply ? '=== APPLYING ===' : '=== DRY RUN (nothing will be written) ===')
  console.log()

  const [{ data: profiles, error: profileError }, { data: lenses, error: lensError }] =
    await Promise.all([
      supabase.from('career_profiles').select('id, slug, is_published'),
      supabase.from('profile_lenses').select('id, profile_id, name, status, sort_order, created_at')
    ])

  if (profileError || lensError) {
    console.error('Lookup failed:', (profileError || lensError).message)
    process.exit(1)
  }

  const stats = { profiles: profiles.length, alreadyActive: 0, promoted: 0, nothingToPromote: 0, errors: 0 }
  const problems = []
  const pending = []

  for (const profile of profiles) {
    const mine = lenses.filter(l => l.profile_id === profile.id)
    const active = mine.filter(l => l.status === 'active')

    if (active.length > 0) {
      stats.alreadyActive += 1
      if (verbose) {
        console.log(`  skip (${active.length} active)  ${profile.slug}  ${active.map(l => l.name).join(', ')}`)
      }
      continue
    }

    // Suggestions only. Dismissed and hidden are both decisions somebody made,
    // and a backfill that overturns them is a backfill nobody can trust.
    const candidates = mine
      .filter(l => l.status === 'suggested')
      .sort((a, b) =>
        sortWeight(a) - sortWeight(b) ||
        String(a.created_at || '').localeCompare(String(b.created_at || ''))
      )

    if (candidates.length === 0) {
      stats.nothingToPromote += 1
      console.log(`  NOTHING TO PROMOTE  ${profile.slug}  (${mine.length} lenses, none suggested)`)
      continue
    }

    const target = candidates[0]
    pending.push({ profile, target, alternatives: candidates.slice(1) })
    console.log(`  ${profile.slug}${profile.is_published ? '  [published]' : ''}`)
    console.log(`      promote: ${target.name}  (sort_order ${target.sort_order})`)
    if (candidates.length > 1) {
      console.log(`      staying suggested: ${candidates.slice(1).map(l => l.name).join(', ')}`)
    }
  }

  if (apply) {
    for (const item of pending) {
      const { error } = await supabase
        .from('profile_lenses')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', item.target.id)
      if (error) {
        stats.errors += 1
        problems.push(`  WRITE FAILED  ${item.profile.slug}  ${error.message}`)
      } else {
        stats.promoted += 1
      }
    }
  } else {
    stats.promoted = pending.length
  }

  console.log()
  console.log('---------------------------------------------')
  console.log(`profiles                  ${stats.profiles}`)
  console.log(`  already had one active  ${stats.alreadyActive}`)
  console.log(`  ${apply ? 'promoted' : 'would promote'}${apply ? '                ' : '           '}${stats.promoted}`)
  console.log(`  nothing to promote      ${stats.nothingToPromote}`)
  if (apply) console.log(`  write errors            ${stats.errors}`)
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
