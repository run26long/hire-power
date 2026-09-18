/**
 * One-time backfill: rename the skills categories on existing resumes so each
 * one names a real domain of the candidate's expertise instead of describing
 * the shape of a list.
 *
 *   before: [{ name: "Technical Skills",    skills: [...] },
 *            { name: "Professional Skills", skills: [...] }]
 *   after:  [{ name: "Campaign & Content Operations",   skills: [...] },
 *            { name: "Marketing Analytics",             skills: [...] },
 *            { name: "Stakeholder & Vendor Management", skills: [...] }]
 *
 * The naming standard is the one already written into
 * app/api/extract-resume-structure/route.js: derive the category names from the
 * content in front of you, and never fall back to a label like "Technical
 * Skills" that says nothing about what the person does. This script applies
 * that standard to rows written before it existed.
 *
 * WHAT IS AND IS NOT ALLOWED TO CHANGE
 *
 * Category names and the assignment of skills to categories change. The skill
 * strings themselves do not. Every skill that goes in must come back out,
 * spelled identically — none lost, none invented, none reworded, none
 * duplicated. This is checked per row by comparing the sorted multiset of skill
 * strings before and after, and a row that fails is retried once and then
 * skipped and reported. Without that check this becomes a content rewrite: the
 * model will happily "improve" "Microsoft Office (Word, Excel, PowerPoint,
 * Outlook)" into something that breaks the ATS rule the resume prompt is
 * careful about.
 *
 * Usage (from the repo root):
 *
 *   node scripts/recategorize-skills.js --dry-run       # writes nothing
 *   node scripts/recategorize-skills.js --limit 5       # first 5 candidates
 *   node scripts/recategorize-skills.js --apply         # writes
 *   node scripts/recategorize-skills.js --verbose       # also prints skips
 *
 * Dry run is the default. A backfill that writes when you forget a flag is a
 * bad backfill, so --apply is required to touch the database. --dry-run is
 * accepted and explicit, and is what the default already does.
 *
 * REVIEWING BEFORE WRITING
 *
 * A plain --apply asks the model again, so the names it writes are not the ones
 * a previous dry run showed you — run the same set twice and the wording moves.
 * To write exactly what you reviewed, save the dry run and apply that file:
 *
 *   node scripts/recategorize-skills.js --dry-run --plan-out plan.json
 *   node scripts/recategorize-skills.js --apply --plan-in plan.json
 *
 * Applying a plan calls no model at all. Each row is re-read first and skipped
 * if its skills have changed since the plan was written, so a stale plan cannot
 * quietly undo an edit someone made in between.
 *
 * Credentials come from .env.local (NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY). The service role key is used
 * because there is no request context here to carry a user JWT, and this has to
 * see every user's rows.
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

const limitIndex = flags.findIndex(f => f === '--limit' || f.startsWith('--limit='))
let limit = Infinity
if (limitIndex !== -1) {
  const raw = flags[limitIndex].startsWith('--limit=')
    ? flags[limitIndex].slice('--limit='.length)
    : flags[limitIndex + 1]
  const parsed = parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    console.error('--limit needs a positive integer, e.g. --limit 5')
    process.exit(1)
  }
  limit = parsed
}

// --plan-out FILE writes the dry run's result to disk; --plan-in FILE applies
// exactly those categories without calling the model again. A dry run is only a
// sample of the model's behaviour otherwise — run it twice and the names come
// back slightly different — so a plan is how you apply the names you actually
// reviewed.
function flagValue(name) {
  const index = flags.findIndex(f => f === name || f.startsWith(`${name}=`))
  if (index === -1) return null
  const raw = flags[index].startsWith(`${name}=`)
    ? flags[index].slice(name.length + 1)
    : flags[index + 1]
  if (!raw || raw.startsWith('--')) {
    console.error(`${name} needs a file path`)
    process.exit(1)
  }
  return raw
}

const planOut = flagValue('--plan-out')
const planIn = flagValue('--plan-in')

if (planIn && planOut) {
  console.error('--plan-in and --plan-out are mutually exclusive')
  process.exit(1)
}
if (planIn && !apply) {
  console.error('--plan-in only makes sense with --apply')
  process.exit(1)
}

const MODEL = 'claude-haiku-4-5-20251001'
const LANES = 4          // model calls, so lower than a plain DB backfill
const MIN_SKILLS = 4     // below this there is nothing to split into categories

const { createClient } = require('@supabase/supabase-js')
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const Anthropic = require('@anthropic-ai/sdk')
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

// ---- SHAPE ----
// Deliberately a copy of lib/resumeText.js rather than an import: that module is
// ESM and this script is CommonJS, and a one-time backfill should not change
// behaviour later because the app's copy was edited afterwards.
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

  return []
}

// Every skill string in the row, sorted. This is the thing that must not change:
// not the count, not the spelling, not one stray space.
function skillMultiset(categories) {
  const out = []
  for (const group of categories || []) {
    for (const skill of (group && group.skills) || []) out.push(String(skill))
  }
  return out.sort()
}

// ---- THE GENERIC-NAME TEST ----
// A name that describes the shape of a list rather than what the person does.
// Matched on the whole name, case and punctuation insensitive, so "Clinical
// Operations" passes and "Technical Skills:" does not.
const GENERIC_NAMES = new Set([
  'skills',
  'technical',
  'technical skills',
  'technical proficiencies',
  'professional',
  'professional skills',
  'soft skills',
  'hard skills',
  'core competencies',
  'competencies',
  'key skills',
  'key competencies',
  'additional skills',
  'other skills',
  'other',
  'general',
  'general skills',
  'relevant skills',
  'areas of expertise',
  'expertise',
  'strengths',
  'abilities',
  'qualifications'
])

function isGenericName(name) {
  const normalized = String(name || '')
    .toLowerCase()
    .replace(/[^a-z ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized === '' || GENERIC_NAMES.has(normalized)
}

// A row needs work if ANY of its categories is generic. "Clinical Operations"
// sitting next to "Technical Skills" is still a resume with a bad category.
function needsRecategorization(categories) {
  return categories.some(group => isGenericName(group.name))
}

// ---- THE PROMPT ----
// The naming standard is lifted from app/api/extract-resume-structure/route.js.
// The count rule is the one difference: that prompt asks for exactly 3 because
// it is writing a resume from scratch, and here the skills already exist and
// should decide their own grouping.
function buildPrompt(row, categories) {
  const data = row.resume_data || {}
  const skills = categories.flatMap(group => group.skills)

  const roles = Array.isArray(data.experience)
    ? data.experience
        .map(job => [job && job.title, job && job.company].filter(Boolean).join(' at '))
        .filter(Boolean)
        .slice(0, 6)
    : []

  const context = [
    data.professionalTitle ? `Professional title: ${data.professionalTitle}` : null,
    row.job_title ? `Target role: ${row.job_title}` : null,
    roles.length > 0 ? `Recent roles:\n${roles.map(r => `  - ${r}`).join('\n')}` : null
  ].filter(Boolean).join('\n')

  return `You are organizing the skills section of a resume into categories.

${context || 'No additional role context is available for this candidate.'}

Here are the skills, exactly as they appear on the resume:

${skills.map(s => `- ${s}`).join('\n')}

Group these skills into categories, and name each category for the real domain
of expertise it represents, as these skills show it. Derive the names from the
content in front of you — read the tools, the systems, and the vocabulary, and
name the areas the work actually falls into. An operations candidate might yield
"Operations & Manufacturing", "Commercial Strategy", "Tools & Platforms"; an
engineering candidate might yield "Software Engineering", "Data & Analytics",
"Cloud Infrastructure". Those are illustrations of the right altitude, not a
list to choose from.

NEVER use a name like "Technical Skills", "Professional Skills", "Soft Skills",
"Core Competencies", "Key Skills", "Additional Skills" or "Areas of Expertise".
Those describe the shape of a list rather than what the person does. Every
category name must be specific to what is actually in it.

Write between 2 and 4 categories. Let the skills decide the number — use the
number they genuinely fall into, and do not pad to reach a target or merge
distinct domains to stay under one. Each category must hold at least 2 skills.

CRITICAL: you are regrouping and renaming only. Reproduce every skill string
EXACTLY as given above, character for character. Do not reword, expand,
abbreviate, correct, split, combine, translate or reformat any skill. Do not add
a skill that is not in the list. Do not drop one. Do not place the same skill in
two categories. Every skill above must appear exactly once in your output.

Order the skills within each category from most to least important for this
candidate's field.

Return ONLY a JSON array, no prose and no markdown fences:
[{ "name": "Category Name", "skills": ["skill1", "skill2"] }]`
}

// The prompt asks for a bare JSON array and usually gets one, but the model
// sometimes wraps it in fences or adds a sentence after the closing bracket. So
// take the first balanced top-level array and ignore whatever surrounds it,
// tracking string state so a bracket inside a skill name cannot end it early.
function parseModelJson(text) {
  let cleaned = String(text || '').trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  }

  const start = cleaned.indexOf('[')
  if (start === -1) throw new SyntaxError('no JSON array in model output')

  let depth = 0
  let inString = false
  let escaped = false

  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i]

    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }

    if (ch === '"') inString = true
    else if (ch === '[') depth += 1
    else if (ch === ']') {
      depth -= 1
      if (depth === 0) return JSON.parse(cleaned.slice(start, i + 1))
    }
  }

  throw new SyntaxError('unterminated JSON array in model output')
}

// Returns null when the candidate output is good, or a sentence naming the
// problem — which is both what gets reported and what the retry is told.
function validate(next, beforeMultiset) {
  if (!Array.isArray(next)) return 'model did not return an array'
  if (next.length < 2 || next.length > 4) {
    return `model returned ${next.length} categories, expected 2 to 4`
  }

  for (const group of next) {
    if (!group || typeof group !== 'object') return 'a category was not an object'
    if (typeof group.name !== 'string' || !group.name.trim()) return 'a category had no name'
    if (!Array.isArray(group.skills) || group.skills.length === 0) {
      return `category "${group.name}" had no skills`
    }
    if (isGenericName(group.name)) {
      return `category name "${group.name}" is generic`
    }
  }

  const names = next.map(g => g.name.trim().toLowerCase())
  if (new Set(names).size !== names.length) return 'two categories shared a name'

  const after = skillMultiset(next)
  if (JSON.stringify(after) !== JSON.stringify(beforeMultiset)) {
    const lost = beforeMultiset.filter(s => !after.includes(s))
    const gained = after.filter(s => !beforeMultiset.includes(s))
    const parts = []
    if (lost.length) parts.push(`dropped ${JSON.stringify(lost)}`)
    if (gained.length) parts.push(`invented or reworded ${JSON.stringify(gained)}`)
    if (!parts.length) parts.push('duplicated a skill')
    return `skills changed — ${parts.join('; ')}`
  }

  return null
}

async function recategorize(row, categories) {
  const beforeMultiset = skillMultiset(categories)
  const prompt = buildPrompt(row, categories)
  let lastProblem = null

  for (let attempt = 1; attempt <= 2; attempt++) {
    const messages = [{ role: 'user', content: prompt }]
    if (attempt === 2) {
      messages.push(
        { role: 'assistant', content: 'I will return the corrected JSON array.' },
        {
          role: 'user',
          content: `Your previous answer was rejected: ${lastProblem}.\n\nTry again. Reproduce every skill string exactly as it was given, use between 2 and 4 categories, and give every category a name specific to what it holds. Return ONLY the JSON array.`
        }
      )
    }

    let next
    try {
      const message = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 2000,
        messages
      })
      next = parseModelJson(message.content[0].text)
    } catch (err) {
      lastProblem = `${err.name || 'error'}: ${err.message}`
      continue
    }

    const problem = validate(next, beforeMultiset)
    if (!problem) {
      return {
        ok: true,
        next: next.map(g => ({ name: g.name.trim(), skills: g.skills })),
        attempts: attempt
      }
    }
    lastProblem = problem
  }

  return { ok: false, problem: lastProblem }
}

async function fetchAllResumes() {
  const rows = []
  const PAGE = 500
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('resumes')
      .select('id, display_name, resume_type, job_title, resume_data')
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

const label = row => `${row.id.slice(0, 8)}  ${row.resume_type || '?'}  ${row.display_name || '(untitled)'}`
const summarize = groups => groups.map(g => `${g.name} (${g.skills.length})`).join('  |  ')

// ---- APPLYING A SAVED PLAN ----
// Writes the exact categories a reviewed dry run produced. The row is re-read
// first and its current skills are compared against what the plan saw: if the
// resume has been edited since the plan was written, the plan is stale for that
// row and writing it would silently undo the edit, so the row is skipped and
// reported instead.
async function applyPlan(planPath) {
  if (!fs.existsSync(planPath)) {
    console.error(`Could not find plan file ${planPath}`)
    process.exit(1)
  }

  let plan
  try {
    plan = JSON.parse(fs.readFileSync(planPath, 'utf8'))
  } catch (err) {
    console.error(`Could not read plan file ${planPath}: ${err.message}`)
    process.exit(1)
  }

  const entries = Array.isArray(plan && plan.entries) ? plan.entries : null
  if (!entries || entries.length === 0) {
    console.error('Plan file has no entries')
    process.exit(1)
  }

  console.log('=== APPLYING SAVED PLAN ===')
  console.log(`plan       ${planPath}`)
  console.log(`generated  ${plan.generatedAt || 'unknown'}`)
  console.log(`entries    ${entries.length}`)
  console.log()

  const stats = { written: 0, stale: 0, missing: 0, writeErrors: 0 }
  const problems = []

  let cursor = 0
  async function writeLane() {
    while (cursor < entries.length) {
      const entry = entries[cursor++]
      const tag = `${entry.id.slice(0, 8)}  ${entry.resumeType || '?'}  ${entry.displayName || '(untitled)'}`

      const { data: row, error: readError } = await supabase
        .from('resumes')
        .select('id, resume_data')
        .eq('id', entry.id)
        .maybeSingle()

      if (readError || !row) {
        stats.missing += 1
        problems.push(`  MISSING  ${tag}  ${readError ? readError.message : 'row no longer exists'}`)
        continue
      }

      const current = skillMultiset(normalizeSkillCategories(row.resume_data || {}))
      const planned = skillMultiset(entry.before)
      if (JSON.stringify(current) !== JSON.stringify(planned)) {
        stats.stale += 1
        problems.push(`  STALE  ${tag}\n      resume changed since the plan was written — skipped`)
        console.log(`  STALE  ${tag}`)
        continue
      }

      const nextData = Object.assign({}, row.resume_data, { skillsCategories: entry.after })
      delete nextData.skillsCategoryOrder
      const { error } = await supabase
        .from('resumes')
        .update({ resume_data: nextData })
        .eq('id', entry.id)

      if (error) {
        stats.writeErrors += 1
        problems.push(`  WRITE FAILED  ${tag}  ${error.message}`)
        continue
      }

      stats.written += 1
      console.log([
        `  ${tag}`,
        `      before:  ${summarize(entry.before)}`,
        `      after:   ${summarize(entry.after)}`
      ].join('\n'))
    }
  }
  await Promise.all(Array.from({ length: 6 }, writeLane))

  console.log()
  console.log('---------------------------------------------')
  console.log(`plan entries        ${entries.length}`)
  console.log(`  written           ${stats.written}`)
  console.log(`  skipped (stale)   ${stats.stale}`)
  console.log(`  skipped (missing) ${stats.missing}`)
  console.log(`  write errors      ${stats.writeErrors}`)
  console.log('---------------------------------------------')

  if (problems.length > 0) {
    console.log()
    console.log('Problems:')
    problems.forEach(p => console.log(p))
  }
}

async function main() {
  if (planIn) {
    await applyPlan(planIn)
    return
  }

  console.log(apply ? '=== APPLYING ===' : '=== DRY RUN (nothing will be written) ===')
  if (limit !== Infinity) console.log(`=== LIMIT ${limit} ===`)
  console.log()

  const rows = await fetchAllResumes()

  const stats = {
    total: rows.length,
    noSkills: 0,
    alreadyNamed: 0,
    tooFewSkills: 0,
    recategorized: 0,
    rejected: 0,
    writeErrors: 0
  }
  const problems = []
  const candidates = []

  for (const row of rows) {
    const categories = normalizeSkillCategories(row.resume_data || {})

    if (categories.length === 0) {
      stats.noSkills += 1
      if (verbose) console.log(`  skip (no skills)       ${label(row)}`)
      continue
    }

    if (!needsRecategorization(categories)) {
      stats.alreadyNamed += 1
      if (verbose) console.log(`  skip (already named)   ${label(row)}\n      ${summarize(categories)}`)
      continue
    }

    const skillCount = categories.reduce((n, g) => n + g.skills.length, 0)
    if (skillCount < MIN_SKILLS) {
      stats.tooFewSkills += 1
      if (verbose) console.log(`  skip (${skillCount} skills)        ${label(row)}`)
      continue
    }

    candidates.push({ row, categories })
  }

  // Scanning is free, so every row is classified before --limit is applied.
  // Breaking out of the loop early would report skip counts over a corpus that
  // was never looked at.
  const held = candidates.length - Math.min(candidates.length, limit)
  candidates.length = Math.min(candidates.length, limit)

  console.log(`${candidates.length} resume${candidates.length === 1 ? '' : 's'} to recategorize${held > 0 ? `  (${held} more held back by --limit)` : ''}`)
  console.log()

  // Each result prints as one joined string so concurrent lanes cannot
  // interleave halfway through a block.
  const pending = []
  let cursor = 0
  async function lane() {
    while (cursor < candidates.length) {
      const item = candidates[cursor++]
      const result = await recategorize(item.row, item.categories)

      if (!result.ok) {
        stats.rejected += 1
        problems.push(`  REJECTED  ${label(item.row)}\n      ${result.problem}`)
        console.log([
          `  REJECTED  ${label(item.row)}`,
          `      ${result.problem}`
        ].join('\n'))
        continue
      }

      pending.push({ row: item.row, before: item.categories, next: result.next })
      console.log([
        `  ${label(item.row)}${result.attempts > 1 ? '   (retried)' : ''}`,
        `      before:  ${summarize(item.categories)}`,
        `      after:   ${summarize(result.next)}`
      ].join('\n'))
    }
  }
  await Promise.all(Array.from({ length: Math.min(LANES, candidates.length) }, lane))

  if (planOut) {
    const plan = {
      generatedAt: new Date().toISOString(),
      model: MODEL,
      entries: pending.map(item => ({
        id: item.row.id,
        displayName: item.row.display_name,
        resumeType: item.row.resume_type,
        before: item.before,
        after: item.next
      }))
    }
    fs.writeFileSync(planOut, JSON.stringify(plan, null, 2))
    console.log()
    console.log(`Plan written to ${planOut} (${plan.entries.length} entries)`)
    console.log(`Apply it with: node scripts/recategorize-skills.js --apply --plan-in ${planOut}`)
  }

  if (apply) {
    let writeCursor = 0
    async function writeLane() {
      while (writeCursor < pending.length) {
        const item = pending[writeCursor++]
        const nextData = Object.assign({}, item.row.resume_data, { skillsCategories: item.next })
        delete nextData.skillsCategoryOrder
        const { error } = await supabase
          .from('resumes')
          .update({ resume_data: nextData })
          .eq('id', item.row.id)
        if (error) {
          stats.writeErrors += 1
          problems.push(`  WRITE FAILED  ${item.row.id}  ${error.message}`)
        } else {
          stats.recategorized += 1
        }
      }
    }
    await Promise.all(Array.from({ length: 6 }, writeLane))
  } else {
    stats.recategorized = pending.length
  }

  console.log()
  console.log('---------------------------------------------')
  console.log(`total rows                 ${stats.total}`)
  console.log(`  skipped (no skills)      ${stats.noSkills}`)
  console.log(`  skipped (already named)  ${stats.alreadyNamed}`)
  console.log(`  skipped (<${MIN_SKILLS} skills)      ${stats.tooFewSkills}`)
  console.log(`  ${apply ? 'recategorized' : 'would recategorize'}      ${stats.recategorized}`)
  console.log(`  rejected (validation)    ${stats.rejected}`)
  if (apply) console.log(`  write errors             ${stats.writeErrors}`)
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
