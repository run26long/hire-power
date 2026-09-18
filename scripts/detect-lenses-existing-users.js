/**
 * One-time backfill: run lens detection for people who finished coaching before
 * it existed.
 *
 * They have a career knowledge base and no directions to show for it: either no
 * career_profiles row at all, or a profile with no profile_lenses under it. This
 * gives them what the end of a coaching session gives everybody now.
 *
 * WHAT IT RUNS
 *
 * The real thing, imported, not a copy:
 *
 *   ensurePrimaryLens          the direction they are actually targeting
 *   detectLensesFromKnowledge  reads the knowledge base and asks for directions
 *   saveSuggestedLenses        writes them, deduped by slug
 *   generateLensContent        headline, bio, proof points, emphasis, proof
 *
 * The first three were extracted out of /api/coach-finish into
 * app/api/career-profile/_lib/detectLenses.js so this script could reach them;
 * the route still calls them and its behaviour is unchanged. generateLens.js was
 * extracted earlier for the same reason. Nothing here reimplements either, so
 * the prompt that decides a direction cannot drift from the one coaching uses.
 *
 * WHAT COACHING DOES NOT DO, AND THIS DOES
 *
 * Coaching creates the lenses and leaves them empty - the owner presses Generate
 * on the profile when they are ready. A backfilled user has no reason to know
 * there is anything to press, so this generates the content too.
 *
 * ORDER, AND WHY
 *
 *   1. the career_profiles row, if they have none
 *   2. the primary lens, because detection is told not to re-suggest the
 *      direction they already have, and it can only be told that if it exists
 *   3. detection, then the suggestions
 *   4. generation over every lens that ended up empty
 *
 * THE PRIMARY LENS NAME
 *
 * ensurePrimaryLens names it from career_context.current_lens_name, then from
 * the first of target_roles, then "Core". The middle step exists for exactly the
 * people this script is for: current_lens_name is written by the same coaching
 * run that would have made this lens, so everyone here has it empty, and "Core"
 * is an internal default that would sit on a page an employer reads.
 *
 * Usage (from the repo root):
 *
 *   node scripts/detect-lenses-existing-users.js             # DRY RUN
 *   node scripts/detect-lenses-existing-users.js --limit 1
 *   node scripts/detect-lenses-existing-users.js --apply
 *   node scripts/detect-lenses-existing-users.js --verbose
 *
 * Dry run is the default and --apply is required to write, the same shape as the
 * other backfills here.
 *
 * WHAT A DRY RUN CAN AND CANNOT SHOW
 *
 * It runs detection for real - that is a read and a model call, and it writes
 * nothing - so the directions it prints are the ones that would be created. It
 * cannot show you a headline or a bio: generation needs a lens row to exist, and
 * in a dry run none does. It says so per user rather than implying otherwise.
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

let limit = Infinity
const rawLimit = flagValue('--limit')
if (rawLimit !== null) {
  const parsed = parseInt(rawLimit, 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    console.error('--limit needs a positive integer, e.g. --limit 1')
    process.exit(1)
  }
  limit = parsed
}

// --plan-out FILE saves what a dry run decided; --plan-in FILE writes exactly
// that, asking the model nothing about which directions exist.
//
// Detection is temperature 0 and still varies between calls - run it twice and
// a direction is named "Field Service" once and "Service Operations" the next
// time. So a dry run is a fair sample of the answer, not the answer. When the
// names that were read and approved are the names that must be written, they
// have to be carried rather than re-derived.
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

// One user is a detection call plus two calls per lens. Deliberately serial:
// this touches a handful of accounts, and a readable log beats a fast one.
const { createClient } = require('@supabase/supabase-js')
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const Anthropic = require('@anthropic-ai/sdk')
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

const ALL_FIELDS = new Set([
  'headline', 'bio', 'proof_points', 'ready_for_next', 'ready_tags', 'skill_emphasis'
])

// Every user with a knowledge base, and what they already have to show for it.
async function findCandidates() {
  const knowledge = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('career_knowledge')
      .select('user_id')
      .is('superseded_by', null)
      .range(from, from + PAGE - 1)
    if (error) {
      console.error('Knowledge fetch failed:', error.message)
      process.exit(1)
    }
    knowledge.push(...data)
    if (data.length < PAGE) break
  }

  const counts = new Map()
  for (const row of knowledge) counts.set(row.user_id, (counts.get(row.user_id) || 0) + 1)

  const [{ data: profiles, error: profileError }, { data: lenses, error: lensError }] =
    await Promise.all([
      supabase.from('career_profiles').select('id, user_id, slug, is_published'),
      supabase.from('profile_lenses').select('id, user_id, profile_id, name, status, source, sort_order')
    ])

  if (profileError || lensError) {
    console.error('Lookup failed:', (profileError || lensError).message)
    process.exit(1)
  }

  const profileByUser = new Map(profiles.map(p => [p.user_id, p]))
  const lensCount = new Map()
  for (const lens of lenses) lensCount.set(lens.user_id, (lensCount.get(lens.user_id) || 0) + 1)

  const out = []
  for (const [userId, knowledgeCount] of counts) {
    const profile = profileByUser.get(userId) || null
    const existingLenses = lensCount.get(userId) || 0
    // The two shapes this is for. A user with lenses already has what coaching
    // would have given them, whatever state it is in.
    if (existingLenses > 0) continue
    out.push({ userId, knowledgeCount, profile, existingLenses })
  }
  out.sort((a, b) => b.knowledgeCount - a.knowledgeCount)
  return { candidates: out, totalKnowledgeUsers: counts.size }
}

// ---------------------------------------------------------------------------
// NAMING THE PRIMARY
//
// target_roles is what the person typed when asked what they were going for, and
// it is not all of one kind. "Creative Director" is a direction somebody applies
// under. "Leadership" is a competency: nobody searches job boards for it, and it
// would sit on the profile beside four properly named directions looking like a
// mistake.
//
// So the first target role is used only when it reads as a direction, judged by
// the standard the detection prompt already states - a direction is something
// that would appear as a job title or department. When it does not, the strongest
// direction the knowledge base actually produced is promoted instead, which is
// both a real name and one the evidence supports.
// ---------------------------------------------------------------------------

// Set by hand, and deliberately: this person's stated target no longer matches
// what their knowledge base holds, and the right primary is one a reader of that
// base would recognise. A one-time script is the right place for a one-time
// judgement; nothing in the app carries it.
const PRIMARY_OVERRIDES = {
  '31e4fbad-5eed-4f83-939c-4b90c85009f1': 'Technical Writing'
}

// Would this string appear as a job title or a department? The wording is taken
// from the detection prompt so both sides of the feature judge it the same way.
async function readsAsDirection(anthropic, candidate) {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 100,
    temperature: 0,
    messages: [{
      role: 'user',
      content: `Is "${candidate}" a professional direction someone applies for jobs under, or a competency used within one?

A direction is a career path someone applies for jobs under, not a skill or competency. "Business Development" is a direction. "Proposal Management" is a skill used within Business Development. "Strategic Planning" is a capability, not a job search. "Leadership" is a capability, not a job search. Only a direction would appear as a job title or a department.

A tool name is not a direction either. "AutoCAD" is a tool used within a direction.

Respond with ONLY valid JSON, no markdown:
{"is_direction": true or false, "why": "under 12 words"}`
    }]
  })

  let json = message.content[0].text.trim()
  if (json.startsWith('```')) {
    json = json.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  }
  const parsed = JSON.parse(json)
  return { isDirection: parsed?.is_direction === true, why: parsed?.why || '' }
}

// The name the primary will get, and where it came from. The same function
// decides it in a dry run and in an apply, so what is printed is what is written.
async function primaryLensNameFor(anthropic, userId, detectedLenses) {
  const override = PRIMARY_OVERRIDES[userId]
  if (override) return { name: override, from: 'override (set in this script)' }

  const { data } = await supabase
    .from('career_context')
    .select('current_lens_name, target_roles')
    .eq('user_id', userId)
    .maybeSingle()

  const contextName = (data?.current_lens_name || '').trim()
  if (contextName) return { name: contextName, from: 'current_lens_name' }

  const roles = Array.isArray(data?.target_roles) ? data.target_roles : []
  const firstTarget = roles.map(role => String(role || '').trim()).find(Boolean) || ''
  const topDetected = detectedLenses?.[0]?.name || ''

  if (firstTarget) {
    let verdict
    try {
      verdict = await readsAsDirection(anthropic, firstTarget)
    } catch (err) {
      // Judging it is what fails, not the backfill. A detected direction is
      // always a safe name, because detection wrote it under these same rules.
      if (topDetected) {
        return { name: topDetected, from: `top detected — could not judge "${firstTarget}" (${err.message})` }
      }
      return { name: firstTarget, from: `target_roles[0] — could not judge it (${err.message})` }
    }

    if (verdict.isDirection) {
      return { name: firstTarget, from: 'target_roles[0], reads as a direction' }
    }
    if (topDetected) {
      return {
        name: topDetected,
        from: `top detected — "${firstTarget}" is a competency${verdict.why ? ` (${verdict.why})` : ''}`
      }
    }
  }

  if (topDetected) return { name: topDetected, from: 'top detected — no target role on file' }
  return { name: 'Core', from: 'fallback — nothing on file to name it from' }
}

// The name the profile slug is built from. coach-finish passes the resume's
// fullName, not the account's display name, so this reads the same place.
async function displayNameFor(userId) {
  const { data } = await supabase
    .from('resumes')
    .select('resume_data')
    .eq('user_id', userId)
    .eq('resume_type', 'core')
    .eq('is_active', true)
    .order('is_priority_core', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
  const fullName = (data || [])[0]?.resume_data?.fullName
  if (typeof fullName === 'string' && fullName.trim()) return fullName.trim()

  const { data: account } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .maybeSingle()
  return account?.display_name || null
}

// ---------------------------------------------------------------------------
// WRITING ONE USER
//
// Shared by the direct --apply and by --plan-in, so a plan cannot take a
// different path through the database than the run that produced it. Everything
// it needs is decided by the caller: this only writes.
// ---------------------------------------------------------------------------
async function writeUser({ detect, generateLensContent, userId, displayName, primaryName, lenses, lines, stats, problems, tag }) {
  // The primary first: the suggestions below are deduped by slug against every
  // row, so a direction that is also the primary has to find the primary already
  // there. Written in the other order it would be inserted twice under two
  // statuses, and the profile would show the same direction as both.
  await detect.ensurePrimaryLens({
    userId,
    displayName,
    supabase,
    nameOverride: primaryName
  })

  const profileId = await detect.ensureCareerProfile(supabase, userId, displayName)
  if (!profileId) {
    stats.failed += 1
    problems.push(`  FAILED  ${tag}\n      could not create or find a career_profiles row`)
    lines.push('      FAILED    : no career_profiles row')
    return false
  }

  await detect.saveSuggestedLenses(supabase, {
    userId,
    profileId,
    // A suggestion is not tied to a resume. build-core sets core_resume_id when
    // the user turns one into an actual core.
    coreResumeId: null,
    lenses
  })

  const { data: written } = await supabase
    .from('profile_lenses')
    .select('id, name, status, source, sort_order')
    .eq('profile_id', profileId)
    .order('sort_order', { ascending: true })

  const created = written || []
  stats.lensesCreated += created.length
  lines.push(`      created   : ${created.map(l => `${l.name} [${l.status}]`).join(' | ')}`)

  // ---- GENERATE ----
  // Coaching leaves a new lens empty and waits for the owner to press Generate.
  // Nobody here knows there is a button, so it is pressed for them.
  for (const lens of created) {
    const result = await generateLensContent({
      supabase,
      userId,
      lensId: lens.id,
      fields: new Set(ALL_FIELDS),
      preview: false
    })
    if (result?.ok) {
      stats.generated += 1
      const emphasis = result.lens?.skill_emphasis
      lines.push(
        `          ${lens.name}: written` +
        `${Array.isArray(emphasis) && emphasis.length ? `, emphasis ${emphasis.join(', ')}` : ', no emphasis matched'}`
      )
    } else {
      stats.failed += 1
      const why = result?.error || 'unknown'
      problems.push(`  GENERATION FAILED  ${tag}  lens "${lens.name}": ${why}`)
      lines.push(`          ${lens.name}: GENERATION FAILED (${why})`)
    }
  }
  return true
}

// ---------------------------------------------------------------------------
// APPLYING A SAVED PLAN
//
// Writes the directions a reviewed dry run decided on, asking the model nothing
// about which they are. Each user is re-checked first: the plan was written for
// somebody with no lenses, and if they have some now then something else has
// given them directions since and the plan is stale for them.
// ---------------------------------------------------------------------------
async function applyPlan(planPath, detect, generateLensContent) {
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

  const entries = Array.isArray(plan?.entries) ? plan.entries : null
  if (!entries || entries.length === 0) {
    console.error('Plan file has no entries')
    process.exit(1)
  }

  console.log('=== APPLYING SAVED PLAN ===')
  console.log(`plan       ${planPath}`)
  console.log(`generated  ${plan.generatedAt || 'unknown'}`)
  console.log(`entries    ${entries.length}`)
  console.log()

  const stats = { processed: 0, stale: 0, lensesCreated: 0, generated: 0, failed: 0 }
  const problems = []

  for (const entry of entries) {
    const tag = `${entry.userId.slice(0, 8)}  ${entry.displayName || '(no name on file)'}`
    const lines = [`  ${tag}`]

    const { count, error } = await supabase
      .from('profile_lenses')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', entry.userId)

    if (error) {
      stats.failed += 1
      problems.push(`  FAILED  ${tag}  lens count failed: ${error.message}`)
      console.log(`  FAILED  ${tag}  ${error.message}`)
      continue
    }
    if ((count || 0) > 0) {
      stats.stale += 1
      lines.push(`      STALE     : already has ${count} lenses — skipped`)
      console.log(lines.join('\n'))
      continue
    }

    lines.push(`      primary   : "${entry.primary.name}"  (${entry.primary.from})`)
    lines.push(`      from plan : ${entry.lenses.map(l => l.name).join(' | ')}`)

    try {
      const ok = await writeUser({
        detect,
        generateLensContent,
        userId: entry.userId,
        displayName: entry.displayName,
        primaryName: entry.primary.name,
        lenses: entry.lenses,
        lines,
        stats,
        problems,
        tag
      })
      if (ok) stats.processed += 1
    } catch (err) {
      stats.failed += 1
      problems.push(`  ERROR  ${tag}\n      ${err.message}`)
      lines.push(`      ERROR     : ${err.message}`)
    }
    console.log(lines.join('\n'))
  }

  console.log()
  console.log('---------------------------------------------')
  console.log(`plan entries        ${entries.length}`)
  console.log(`  processed         ${stats.processed}`)
  console.log(`  skipped (stale)   ${stats.stale}`)
  console.log(`  lenses created    ${stats.lensesCreated}`)
  console.log(`  lenses generated  ${stats.generated}`)
  console.log(`  failed            ${stats.failed}`)
  console.log('---------------------------------------------')

  if (problems.length > 0) {
    console.log()
    console.log('Problems:')
    problems.forEach(p => console.log(p))
  }
}

async function main() {
  console.log(apply ? '=== APPLYING ===' : '=== DRY RUN (nothing will be written) ===')
  if (limit !== Infinity) console.log(`=== LIMIT ${limit} ===`)
  console.log()

  // Imported here rather than at the top: both modules build clients from
  // process.env at import time, so .env.local has to be loaded first. Dynamic
  // import because this script is CommonJS and both modules, like the rest of
  // the app, are ESM.
  const detect = await import(pathToFileURL(
    path.join(__dirname, '..', 'app', 'api', 'career-profile', '_lib', 'detectLenses.js')
  ).href)
  const { generateLensContent } = await import(pathToFileURL(
    path.join(__dirname, '..', 'app', 'api', 'career-profile', '_lib', 'generateLens.js')
  ).href)

  if (planIn) {
    await applyPlan(planIn, detect, generateLensContent)
    return
  }

  const { candidates, totalKnowledgeUsers } = await findCandidates()

  const held = candidates.length - Math.min(candidates.length, limit)
  const scoped = candidates.slice(0, limit)

  console.log(`${totalKnowledgeUsers} users have a career knowledge base`)
  console.log(
    `${scoped.length} of them have no lenses${held > 0 ? `  (${held} more held back by --limit)` : ''}`
  )
  console.log(`threshold: ${detect.MIN_KNOWLEDGE_FOR_LENSES} knowledge entries`)
  console.log()

  const stats = {
    processed: 0,
    belowThreshold: 0,
    nothingDetected: 0,
    profilesCreated: 0,
    lensesCreated: 0,
    generated: 0,
    failed: 0
  }
  const problems = []
  const planEntries = []

  for (const candidate of scoped) {
    const { userId, knowledgeCount, profile } = candidate
    const name = await displayNameFor(userId)
    const tag = `${userId.slice(0, 8)}  ${name || '(no name on file)'}`

    const lines = [`  ${tag}`]
    lines.push(`      knowledge : ${knowledgeCount} entries`)
    lines.push(
      `      profile   : ${profile ? `${profile.slug} (exists)` : `none — would create "${detect.slugify(name) || `u-${userId.slice(0, 8)}`}"`}`
    )

    try {
      // ---- DETECT ----
      // Read and ask, write nothing. Done before any row is created so a dry run
      // and an apply see exactly the same answer.
      const detected = await detect.detectLensesFromKnowledge({ userId, supabase })

      if (!detected.ok) {
        stats.belowThreshold += 1
        lines.push(`      SKIPPED   : ${detected.reason}`)
        console.log(lines.join('\n'))
        continue
      }

      if (detected.lenses.length === 0) {
        stats.nothingDetected += 1
        lines.push('      detected  : nothing cleared the bar (an empty answer is a valid one)')
        console.log(lines.join('\n'))
        continue
      }

      lines.push(`      detected  : ${detected.lenses.map(l => l.name).join(' | ')}`)
      if (verbose) {
        for (const lens of detected.lenses) {
          lines.push(`          ${lens.name}: ${lens.evidence_summary || '(no evidence summary)'}`)
        }
      }

      // Decided once, before the branch, so the name a dry run prints is the
      // name an apply writes.
      const primary = await primaryLensNameFor(anthropic, userId, detected.lenses)
      lines.push(`      primary   : "${primary.name}"  (${primary.from})`)

      if (!apply) {
        planEntries.push({
          userId,
          displayName: name,
          knowledgeCount,
          existingProfileSlug: profile ? profile.slug : null,
          primary,
          lenses: detected.lenses
        })
        lines.push('      generate  : would run per lens (needs the rows to exist, so not previewed)')
        stats.processed += 1
        console.log(lines.join('\n'))
        continue
      }

      if (!profile) stats.profilesCreated += 1
      const ok = await writeUser({
        detect,
        generateLensContent,
        userId,
        displayName: name,
        primaryName: primary.name,
        lenses: detected.lenses,
        lines,
        stats,
        problems,
        tag
      })
      if (ok) stats.processed += 1
      console.log(lines.join('\n'))
    } catch (err) {
      stats.failed += 1
      problems.push(`  ERROR  ${tag}\n      ${err.message}`)
      lines.push(`      ERROR     : ${err.message}`)
      console.log(lines.join('\n'))
    }
  }

  if (planOut) {
    const plan = {
      generatedAt: new Date().toISOString(),
      entries: planEntries
    }
    fs.writeFileSync(planOut, JSON.stringify(plan, null, 2))
    console.log()
    console.log(`Plan written to ${planOut} (${planEntries.length} users)`)
    console.log(`Apply it with: node scripts/detect-lenses-existing-users.js --apply --plan-in ${planOut}`)
  }

  console.log()
  console.log('---------------------------------------------')
  console.log(`users in scope           ${scoped.length}`)
  console.log(`  ${apply ? 'processed' : 'would process'}${apply ? '              ' : '          '}${stats.processed}`)
  console.log(`  skipped (too little)   ${stats.belowThreshold}`)
  console.log(`  detected nothing       ${stats.nothingDetected}`)
  if (apply) {
    console.log(`  profiles created       ${stats.profilesCreated}`)
    console.log(`  lenses created         ${stats.lensesCreated}`)
    console.log(`  lenses generated       ${stats.generated}`)
  }
  console.log(`  failed                 ${stats.failed}`)
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
