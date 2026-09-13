/**
 * One-time backfill: convert resume_data.skillsCategories from a keyed object
 * to an ordered array.
 *
 *   before: { "Operations": ["Lean", "WIP"], "Tools": ["Salesforce"] }
 *   after:  [{ name: "Operations", skills: ["Lean", "WIP"] },
 *            { name: "Tools", skills: ["Salesforce"] }]
 *
 * The reason is storage, not taste. resume_data is jsonb, and Postgres stores a
 * jsonb object with its keys sorted by length rather than in the order they were
 * written, so category order could never survive a save. A jsonb array keeps the
 * order it was given.
 *
 * Rows that carry `skillsCategoryOrder` — the temporary sibling array that
 * recorded the intended order — are converted into that order. Everything else
 * keeps the order it arrives in, which for an object row is jsonb's, and is the
 * only order that row has ever had.
 *
 * Nothing is reworded, merged, split or dropped. Every row is checked before it
 * is written: the sorted multiset of skill strings going out must be identical
 * to the one that came in, or the row is reported and skipped.
 *
 * Usage (from the repo root):
 *
 *   node scripts/migrate-skills-to-array.js            # DRY RUN, writes nothing
 *   node scripts/migrate-skills-to-array.js --apply    # writes
 *   node scripts/migrate-skills-to-array.js --verbose  # also prints every row
 *
 * Dry run is the default. Run it first, read the report, and only then --apply.
 *
 * Credentials come from .env.local (NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY). The service role key is used because there is no
 * request context here to carry a user JWT, and this has to see every user's
 * rows.
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

// ---- THE CONVERSION ----
// Deliberately a copy of lib/resumeText.js rather than an import: that module is
// ESM and this script is CommonJS, and a one-time backfill should not change
// behaviour later because the app's copy was edited afterwards. What ran is what
// is written here.
function normalizeSkillCategories(resumeData) {
  const categories = resumeData && resumeData.skillsCategories

  if (Array.isArray(categories)) {
    return categories
      .map(group => ({
        name: typeof (group && group.name) === 'string' ? group.name.trim() : '',
        skills: Array.isArray(group && group.skills) ? group.skills : []
      }))
      .filter(group => group.name && group.skills.length > 0)
  }

  if (categories && typeof categories === 'object') {
    const order = Array.isArray(resumeData.skillsCategoryOrder)
      ? resumeData.skillsCategoryOrder.map(name => String(name || '').trim())
      : []

    return Object.entries(categories)
      .map(([name, value]) => ({
        name: String(name || '').trim(),
        skills: Array.isArray(value) ? value : [value]
      }))
      .filter(group => group.name && group.skills.length > 0)
      .sort((a, b) => {
        const ia = order.indexOf(a.name)
        const ib = order.indexOf(b.name)
        if (ia === -1 && ib === -1) return 0
        if (ia === -1) return 1
        if (ib === -1) return -1
        return ia - ib
      })
  }

  if (Array.isArray(resumeData && resumeData.skills) && resumeData.skills.length > 0) {
    return [{ name: 'Skills', skills: resumeData.skills }]
  }

  return []
}

// Every skill string that is in the row now, sorted. This is the thing that must
// not change: not the count, not the spelling, not one stray space.
function skillMultiset(categories) {
  const out = []
  if (Array.isArray(categories)) {
    for (const group of categories) {
      for (const skill of (group && group.skills) || []) out.push(String(skill))
    }
  } else if (categories && typeof categories === 'object') {
    for (const value of Object.values(categories)) {
      const list = Array.isArray(value) ? value : [value]
      for (const skill of list) out.push(String(skill))
    }
  }
  return out.sort()
}

async function fetchAllResumes() {
  const rows = []
  const PAGE = 500
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('resumes')
      .select('id, display_name, resume_type, resume_data')
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1)

    if (error) {
      console.error('Resume fetch failed:', error.message)
      process.exit(1)
    }
    rows.push(...data)
    if (data.length < PAGE) break
  }
  return rows
}

async function main() {
  console.log(apply ? '=== APPLYING ===' : '=== DRY RUN (nothing will be written) ===')
  console.log()

  const rows = await fetchAllResumes()

  const stats = { total: rows.length, alreadyArray: 0, noSkills: 0, converted: 0, failed: 0, writeErrors: 0 }
  const pending = []
  const problems = []

  for (const row of rows) {
    const data = row.resume_data || {}
    const categories = data.skillsCategories
    const label = `${row.id.slice(0, 8)}  ${row.resume_type || '?'}  ${row.display_name || '(untitled)'}`

    if (Array.isArray(categories)) {
      stats.alreadyArray += 1
      if (verbose) console.log(`  skip (already array)  ${label}`)
      continue
    }

    if (!categories || typeof categories !== 'object' || Object.keys(categories).length === 0) {
      stats.noSkills += 1
      if (verbose) console.log(`  skip (no skills)      ${label}`)
      continue
    }

    const before = skillMultiset(categories)
    const next = normalizeSkillCategories(data)
    const after = skillMultiset(next)

    if (JSON.stringify(before) !== JSON.stringify(after)) {
      stats.failed += 1
      const lost = before.filter(s => !after.includes(s))
      const gained = after.filter(s => !before.includes(s))
      problems.push(`  MISMATCH  ${label}\n      lost:   ${JSON.stringify(lost)}\n      gained: ${JSON.stringify(gained)}`)
      continue
    }

    pending.push({ row, next, count: after.length, hadOrder: Array.isArray(data.skillsCategoryOrder) })
    if (verbose) {
      console.log(`  convert  ${label}`)
      console.log(`      ${next.map(g => `${g.name} (${g.skills.length})`).join('  |  ')}`)
    }
  }

  // The rows that carried the temporary ordering hint are the only ones whose
  // order was ever deliberate, so they are worth seeing in full before a write.
  const ordered = pending.filter(p => p.hadOrder)
  if (ordered.length > 0) {
    console.log('Rows carrying skillsCategoryOrder — resolved order:')
    for (const p of ordered) {
      console.log(`  ${p.row.id.slice(0, 8)}  ${p.row.display_name || '(untitled)'}`)
      console.log(`      ${p.next.map(g => g.name).join('  →  ')}`)
    }
    console.log()
  }

  if (apply) {
    // Small concurrency: enough to not take a minute, low enough to stay polite.
    const LANES = 6
    let cursor = 0
    async function lane() {
      while (cursor < pending.length) {
        const item = pending[cursor++]
        const nextData = Object.assign({}, item.row.resume_data, { skillsCategories: item.next })
        const { error } = await supabase
          .from('resumes')
          .update({ resume_data: nextData })
          .eq('id', item.row.id)
        if (error) {
          stats.writeErrors += 1
          problems.push(`  WRITE FAILED  ${item.row.id}  ${error.message}`)
        } else {
          stats.converted += 1
        }
      }
    }
    await Promise.all(Array.from({ length: LANES }, lane))
  } else {
    stats.converted = pending.length
  }

  console.log('---------------------------------------------')
  console.log(`total rows            ${stats.total}`)
  console.log(`  skipped (array)     ${stats.alreadyArray}`)
  console.log(`  skipped (no skills) ${stats.noSkills}`)
  console.log(`  ${apply ? 'converted' : 'would convert'}${apply ? '           ' : '       '}${stats.converted}`)
  console.log(`  failed (mismatch)   ${stats.failed}`)
  if (apply) console.log(`  write errors        ${stats.writeErrors}`)
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
