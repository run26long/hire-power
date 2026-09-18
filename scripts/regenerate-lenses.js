/**
 * One-time backfill: generate the missing Career Profile lens content for every
 * existing profile, and in particular the two pieces that make the Skills
 * section clickable — skill_emphasis on the lens, and the profile_skill_proofs
 * rows derived from it.
 *
 * WHAT IT RUNS
 *
 * The generation engine itself, imported from
 * app/api/career-profile/_lib/generateLens.js — the same code the Generate
 * button runs, not a copy of it. That module was extracted out of the route for
 * this script to reach; the route still owns authentication and the tier gate.
 *
 * WHICH FIELDS GET WRITTEN
 *
 * The engine always generates all six fields from one reading of the knowledge
 * base, and `fields` decides only which of them are stored. That is what makes
 * the rule below free: filling an empty headline costs no extra model call.
 *
 *   skill_emphasis   always written, and always followed by skill proof.
 *                    Nothing hand-edits it, and the Skills section reads it.
 *   the other five   written only where the lens has nothing. A headline with
 *                    content may have been typed by the owner, and a backfill
 *                    must not overwrite that.
 *
 * --full drops the second rule and rewrites everything. That is for a profile
 * whose underlying material has changed, where the old wording is stale rather
 * than precious.
 *
 * WHY IT DOES NOT GO THROUGH THE HTTP ROUTE
 *
 * The route refuses a free account that has more than one direction, which is
 * correct for a button and wrong for a repair: those lenses already exist, and
 * leaving them without proof is not a paywall, it is a gap. Calling the engine
 * directly also means no dev server and no minted user tokens.
 *
 * Usage (from the repo root):
 *
 *   node scripts/regenerate-lenses.js --dry-run
 *   node scripts/regenerate-lenses.js --limit 2
 *   node scripts/regenerate-lenses.js --apply
 *   node scripts/regenerate-lenses.js --profile-id daniel-mercer-test --full --apply
 *
 * Dry run is the default and --apply is required to write, the same shape as
 * scripts/recategorize-skills.js. A dry run generates through the engine's
 * preview path, which returns the draft and stores nothing — and, importantly,
 * never reaches the skill-proof pass, because that clears a direction's
 * existing proof rows before it writes new ones.
 *
 * Credentials come from .env.local (NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY).
 */

const fs = require('fs')
const path = require('path')
const { pathToFileURL } = require('url')

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
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

for (const [name, value] of [
  ['NEXT_PUBLIC_SUPABASE_URL', SUPABASE_URL],
  ['SUPABASE_SERVICE_ROLE_KEY', SUPABASE_SERVICE_ROLE_KEY],
  ['ANTHROPIC_API_KEY', ANTHROPIC_API_KEY]
]) {
  if (!value) {
    console.error(`Missing ${name} in .env.local`)
    process.exit(1)
  }
}

// ---- FLAGS ----
const flags = process.argv.slice(2)
const apply = flags.includes('--apply')
const verbose = flags.includes('--verbose')
const full = flags.includes('--full')

function flagValue(name) {
  const index = flags.findIndex(f => f === name || f.startsWith(`${name}=`))
  if (index === -1) return null
  const raw = flags[index].startsWith(`${name}=`)
    ? flags[index].slice(name.length + 1)
    : flags[index + 1]
  if (!raw || raw.startsWith('--')) {
    console.error(`${name} needs a value`)
    process.exit(1)
  }
  return raw
}

const profileTarget = flagValue('--profile-id')

let limit = Infinity
const rawLimit = flagValue('--limit')
if (rawLimit !== null) {
  const parsed = parseInt(rawLimit, 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    console.error('--limit needs a positive integer, e.g. --limit 2')
    process.exit(1)
  }
  limit = parsed
}

// One lens is one or two model calls and a dozen queries, so this stays low.
const LANES = 3

// The five the owner may have written by hand. skill_emphasis is deliberately
// not among them: nothing edits it, and proof is derived from it.
const NARRATIVE_FIELDS = ['headline', 'bio', 'proof_points', 'ready_for_next', 'ready_tags']

// A dismissed direction is one the owner has put away. Generating for it would
// spend a call on something nothing renders.
const SKIP_STATUSES = new Set(['dismissed'])

const { createClient } = require('@supabase/supabase-js')
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

function hasContent(value) {
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'string') return value.trim().length > 0
  return value !== null && value !== undefined
}

// Which columns this lens should have written, and which are being left alone.
function planFields(lens) {
  if (full) {
    return { write: ['skill_emphasis', ...NARRATIVE_FIELDS], preserve: [] }
  }
  const write = ['skill_emphasis']
  const preserve = []
  for (const field of NARRATIVE_FIELDS) {
    if (hasContent(lens[field])) preserve.push(field)
    else write.push(field)
  }
  return { write, preserve }
}

async function main() {
  console.log(apply ? '=== APPLYING ===' : '=== DRY RUN (nothing will be written) ===')
  if (full) console.log('=== FULL REGENERATION (overwrites hand-edited fields) ===')
  if (profileTarget) console.log(`=== PROFILE ${profileTarget} ===`)
  if (limit !== Infinity) console.log(`=== LIMIT ${limit} ===`)
  console.log()

  // Imported here rather than at the top: the module builds its Anthropic
  // client at import time from process.env, so .env.local has to be loaded
  // first. Dynamic import because this script is CommonJS and the engine, like
  // the rest of the app, is ESM.
  const enginePath = path.join(
    __dirname, '..', 'app', 'api', 'career-profile', '_lib', 'generateLens.js'
  )
  const { generateLensContent } = await import(pathToFileURL(enginePath).href)

  const { data: profiles, error: profileError } = await supabase
    .from('career_profiles')
    .select('id, slug, user_id')

  if (profileError) {
    console.error('Career profile fetch failed:', profileError.message)
    process.exit(1)
  }

  let scoped = profiles
  if (profileTarget) {
    scoped = profiles.filter(p => p.id === profileTarget || p.slug === profileTarget)
    if (scoped.length === 0) {
      console.error(`No career profile matches "${profileTarget}" by id or slug`)
      process.exit(1)
    }
  }

  const { data: lenses, error: lensError } = await supabase
    .from('profile_lenses')
    .select(
      'id, profile_id, user_id, name, status, headline, bio, proof_points, ' +
      'ready_for_next, ready_tags, skill_emphasis'
    )
    .order('sort_order', { ascending: true })

  if (lensError) {
    console.error('Lens fetch failed:', lensError.message)
    process.exit(1)
  }

  const byProfile = new Map(scoped.map(p => [p.id, p]))
  const stats = { profiles: 0, dismissed: 0, orphaned: 0, generated: 0, failed: 0 }
  const problems = []
  const candidates = []

  for (const lens of lenses) {
    const profile = byProfile.get(lens.profile_id)
    if (!profile) {
      // Either out of scope for --profile-id, or a lens with no profile row.
      if (!profileTarget && !lens.profile_id) {
        stats.orphaned += 1
        if (verbose) console.log(`  skip (no profile)  ${lens.name}`)
      }
      continue
    }
    if (SKIP_STATUSES.has(lens.status)) {
      stats.dismissed += 1
      if (verbose) console.log(`  skip (dismissed)   ${profile.slug}  ${lens.name}`)
      continue
    }
    candidates.push({ profile, lens, ...planFields(lens) })
  }

  // Scanning is free, so every lens is classified before --limit is applied.
  const held = candidates.length - Math.min(candidates.length, limit)
  candidates.length = Math.min(candidates.length, limit)
  stats.profiles = new Set(candidates.map(c => c.profile.id)).size

  console.log(
    `${candidates.length} lens${candidates.length === 1 ? '' : 'es'} across ` +
    `${stats.profiles} profile${stats.profiles === 1 ? '' : 's'}` +
    `${held > 0 ? `  (${held} more held back by --limit)` : ''}`
  )
  console.log()

  let cursor = 0
  async function lane() {
    while (cursor < candidates.length) {
      const item = candidates[cursor++]
      const { profile, lens, write, preserve } = item
      const tag = `${profile.slug}  ${lens.name} [${lens.status}]`

      let result
      try {
        result = await generateLensContent({
          supabase,
          userId: lens.user_id,
          lensId: lens.id,
          fields: new Set(write),
          // A dry run takes the engine's preview path: it generates exactly as
          // it otherwise would, returns the draft, and stores nothing. It also
          // never reaches the skill-proof pass, which clears a direction's
          // rows before writing new ones.
          preview: !apply
        })
      } catch (err) {
        stats.failed += 1
        problems.push(`  ERROR  ${tag}\n      ${err.message}`)
        console.log(`  ERROR  ${tag}\n      ${err.message}`)
        continue
      }

      if (!result.ok) {
        stats.failed += 1
        problems.push(`  FAILED  ${tag}\n      ${result.error}`)
        console.log(`  FAILED  ${tag}\n      ${result.error}`)
        continue
      }

      stats.generated += 1
      const produced = result.draft || result.lens || {}
      const emphasis = Array.isArray(produced.skill_emphasis) ? produced.skill_emphasis : []

      const lines = [`  ${tag}`]
      lines.push(`      write:    ${write.join(', ')}${full ? '   (full regen)' : ''}`)
      lines.push(`      preserve: ${preserve.length ? preserve.join(', ') : '(nothing to preserve)'}`)
      lines.push(`      emphasis: ${emphasis.length ? emphasis.join(' | ') : '(none matched the resume)'}`)
      lines.push(`      proof:    ${apply ? 'regenerated from emphasis' : 'not previewed (it replaces stored rows)'}`)
      if (verbose && produced.headline) lines.push(`      headline: ${produced.headline}`)
      if (verbose && produced.bio) lines.push(`      bio:      ${produced.bio}`)
      console.log(lines.join('\n'))
    }
  }
  await Promise.all(Array.from({ length: Math.min(LANES, candidates.length) }, lane))

  console.log()
  console.log('---------------------------------------------')
  console.log(`lenses in scope       ${candidates.length}`)
  console.log(`  ${apply ? 'generated' : 'would generate'}${apply ? '           ' : '      '}${stats.generated}`)
  console.log(`  failed              ${stats.failed}`)
  console.log(`  skipped (dismissed) ${stats.dismissed}`)
  if (stats.orphaned) console.log(`  skipped (no profile) ${stats.orphaned}`)
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
