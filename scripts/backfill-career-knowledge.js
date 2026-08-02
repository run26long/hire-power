/**
 * One-time backfill: merge duplicate career_knowledge rows for a single user.
 *
 * Rows created before semantic deduplication existed can describe the same
 * fact in different wording, so exact content_key matching never caught them.
 * This script asks Claude to group same-fact rows, then folds each group into
 * one surviving row.
 *
 * Nothing is ever deleted. Merged rows stay in the table with superseded_by
 * set, which is how the app already filters them out of active use.
 *
 * Usage (from the repo root):
 *
 *   node scripts/backfill-career-knowledge.js <user_id>                     # DRY RUN
 *   node scripts/backfill-career-knowledge.js <user_id> --apply             # writes
 *   node scripts/backfill-career-knowledge.js <user_id> --apply --skip=1,6  # writes, minus groups 1 and 6
 *
 * Dry run is the default and writes nothing. Run it first, read the groups,
 * and only then re-run with --apply.
 *
 * --skip takes printed group numbers and excludes them from the write. It
 * works in dry run too, so you can preview the reduced set before committing.
 * Group numbering is stable within a run but NOT across runs: Claude may group
 * differently next time, so always re-read the printed groups before trusting
 * a number you noted earlier.
 *
 * Credentials come from .env.local (NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY). The service role key is used
 * because there is no request context here to carry a user JWT.
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
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).replace(/^export\s+/, '').trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

loadEnvLocal()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

// ---- ARGS ----
const userId = process.argv[2]
const flags = process.argv.slice(3)
const apply = flags.includes('--apply')

// --skip=1,6 excludes those printed group numbers from the write. Group numbers
// come from the printed order, which is deterministic within a run, so the
// numbers you read in a dry run are the numbers to pass back on the next run.
const skipArg = flags.find(f => f.startsWith('--skip='))
const skipGroups = new Set()
if (skipArg) {
  for (const token of skipArg.slice('--skip='.length).split(',')) {
    const trimmed = token.trim()
    if (!trimmed) continue
    const n = Number(trimmed)
    if (!Number.isInteger(n) || n < 1) {
      console.error(`Invalid --skip value: ${JSON.stringify(trimmed)}. Expected comma-separated group numbers, e.g. --skip=1,6`)
      process.exit(1)
    }
    skipGroups.add(n)
  }
}

if (!userId || userId.startsWith('--')) {
  console.error('Missing user_id.')
  console.error('')
  console.error('  node scripts/backfill-career-knowledge.js <user_id>                     # dry run')
  console.error('  node scripts/backfill-career-knowledge.js <user_id> --apply             # writes')
  console.error('  node scripts/backfill-career-knowledge.js <user_id> --apply --skip=1,6  # writes, minus groups 1 and 6')
  process.exit(1)
}

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

const { createClient } = require('@supabase/supabase-js')
const Anthropic = require('@anthropic-ai/sdk')

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

const DEDUPE_PROMPT = `Below is a list of career knowledge items belonging to one person. Some of these items describe the same underlying fact in different words, because they were extracted from separate conversations.

Identify groups of items that describe the SAME fact.

Judge by meaning, not wording. Two items are the same fact if a reader would say they describe one piece of the person's background, not two.

Two items are NOT the same fact if they describe related but distinct work. For example, designing a database schema and debugging production queries are both SQL work, but they are different facts. Building a tool and maintaining that tool are different facts.

Be conservative. Only group items when one adds nothing the other does not already say. If one item contains a specific detail, distinction, or piece of reasoning the other lacks, they are different facts and must not be grouped, even if they cover the same general subject. When in doubt, do not group.

For each group, choose which item to keep. Keep the one whose wording is clearest and most complete. Do not rewrite it.

merge_ids must contain ONLY the items being absorbed. Never include keep_id in merge_ids. A group of three items where you keep the first has one keep_id and two merge_ids, not three.

Return ONLY this JSON:

{
  "groups": [
    {
      "keep_id": "...",
      "merge_ids": ["...", "..."],
      "reason": "one short sentence on why these are the same fact"
    }
  ]
}

Return an empty groups array if nothing should be merged.`

const line = () => console.log('─'.repeat(78))
const mentions = row => (Number.isFinite(Number(row?.mention_count)) ? Number(row.mention_count) : 0)

async function main() {
  console.log(`[backfill] user_id: ${userId}`)
  console.log(`[backfill] mode: ${apply ? 'APPLY — this will write to the database' : 'DRY RUN — nothing will be written'}`)
  line()

  // ---- FETCH ----
  const { data: rows, error: fetchError } = await supabase
    .from('career_knowledge')
    .select('id, content, knowledge_type, confidence, mention_count, raw_phrasing, created_at')
    .eq('user_id', userId)
    .is('superseded_by', null)
    .order('created_at', { ascending: true })

  if (fetchError) {
    console.error('[backfill] Fetch failed:', fetchError)
    process.exit(1)
  }

  const items = rows || []
  console.log(`[backfill] Active rows fetched: ${items.length}`)

  if (items.length < 2) {
    console.log('[backfill] Nothing to compare. Exiting.')
    return
  }

  const byId = new Map(items.map(r => [String(r.id), r]))

  // ---- ASK CLAUDE ----
  const itemList = items
    .map((r, i) => `${i + 1}. id: ${r.id} | type: ${r.knowledge_type} | ${r.content}`)
    .join('\n')

  let responseText
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: DEDUPE_PROMPT },
          { type: 'text', text: `ITEMS\n\n${itemList}\n\nReturn the JSON object now.` }
        ]
      }]
    })
    responseText = message.content?.[0]?.text?.trim()
  } catch (apiErr) {
    console.error('[backfill] Claude API error:', apiErr)
    process.exit(1)
  }

  if (!responseText) {
    console.error('[backfill] No content in API response. Exiting without writing.')
    process.exit(1)
  }

  const cleaned = responseText.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim()

  let parsed
  try {
    parsed = JSON.parse(cleaned)
  } catch (e) {
    console.error('[backfill] Parse failed:', e.message)
    console.error('[backfill] Raw response:')
    console.error(responseText)
    process.exit(1)
  }

  const rawGroups = Array.isArray(parsed?.groups) ? parsed.groups : []
  console.log(`[backfill] Groups proposed: ${rawGroups.length}`)

  if (rawGroups.length === 0) {
    console.log('[backfill] Nothing to merge. Exiting.')
    return
  }

  // ---- VALIDATE ----
  // An id may appear in at most one group, counting both keep and merge slots,
  // so a group that fails validation must not claim any ids.
  const claimed = new Set()
  const valid = []

  rawGroups.forEach((group, index) => {
    const label = `group ${index + 1}`
    const keepId = group?.keep_id == null ? '' : String(group.keep_id)
    const mergeIds = Array.isArray(group?.merge_ids) ? group.merge_ids.map(id => (id == null ? '' : String(id))) : null

    if (!keepId || !byId.has(keepId)) {
      console.log(`[backfill] SKIPPED ${label} — keep_id not in fetched rows: ${JSON.stringify(group?.keep_id ?? null)}`)
      return
    }
    if (!mergeIds || mergeIds.length === 0) {
      console.log(`[backfill] SKIPPED ${label} — merge_ids missing or empty`)
      return
    }
    const unknown = mergeIds.filter(id => !byId.has(id))
    if (unknown.length) {
      console.log(`[backfill] SKIPPED ${label} — merge_id not in fetched rows: ${JSON.stringify(unknown)}`)
      return
    }
    // The model sometimes lists the survivor among the items being absorbed.
    // That is a format error, not a bad grouping, so strip it and carry on.
    const withoutKeep = mergeIds.filter(id => id !== keepId)
    if (withoutKeep.length !== mergeIds.length) {
      console.log(`[backfill] ${label} — stripped keep_id ${keepId} from its own merge_ids`)
    }
    const deduped = Array.from(new Set(withoutKeep))
    if (deduped.length !== withoutKeep.length) {
      console.log(`[backfill] ${label} — collapsed repeated merge_ids`)
    }
    if (deduped.length === 0) {
      console.log(`[backfill] SKIPPED ${label} — no merge_ids left after removing keep_id`)
      return
    }
    const reused = [keepId, ...deduped].filter(id => claimed.has(id))
    if (reused.length) {
      console.log(`[backfill] SKIPPED ${label} — id already claimed by an earlier group: ${JSON.stringify(reused)}`)
      return
    }

    for (const id of [keepId, ...deduped]) claimed.add(id)
    valid.push({
      keep: byId.get(keepId),
      merges: deduped.map(id => byId.get(id)),
      reason: typeof group?.reason === 'string' ? group.reason : '(no reason given)'
    })
  })

  console.log(`[backfill] Groups valid: ${valid.length} of ${rawGroups.length}`)

  if (valid.length === 0) {
    console.log('[backfill] No valid groups. Exiting.')
    return
  }

  // Printed order is the numbering --skip refers to, so freeze it here and use
  // group.number everywhere downstream instead of a live loop index.
  valid.forEach((group, index) => {
    group.number = index + 1
    group.skippedByUser = skipGroups.has(group.number)
  })

  const unknownSkips = [...skipGroups].filter(n => n > valid.length).sort((a, b) => a - b)
  if (unknownSkips.length) {
    console.log(`[backfill] WARNING — --skip listed group number(s) that do not exist in this run: ${unknownSkips.join(', ')}`)
  }

  // ---- PRINT ----
  valid.forEach(group => {
    line()
    console.log(`GROUP ${group.number}${group.skippedByUser ? ' — SKIPPED BY USER' : ''} — ${group.reason}`)
    console.log('')
    console.log(`  KEEP    ${group.keep.id}  (mentions: ${mentions(group.keep)}, ${group.keep.confidence})`)
    console.log(`          ${group.keep.content}`)
    for (const row of group.merges) {
      console.log('')
      console.log(`  MERGE   ${row.id}  (mentions: ${mentions(row)}, ${row.confidence})`)
      console.log(`          ${row.content}`)
    }
  })
  line()

  const skippedByUser = valid.filter(g => g.skippedByUser)
  const toProcess = valid.filter(g => !g.skippedByUser)
  const rowsToMerge = toProcess.reduce((sum, g) => sum + g.merges.length, 0)

  if (skippedByUser.length) {
    console.log(`[backfill] Skipped by user: ${skippedByUser.length} group(s) — ${skippedByUser.map(g => g.number).join(', ')}`)
  }

  if (!apply) {
    console.log(`[backfill] DRY RUN — would merge ${rowsToMerge} row(s) into ${toProcess.length} surviving row(s).`)
    console.log('[backfill] Nothing was written. Re-run with --apply to commit these merges.')
    return
  }

  if (toProcess.length === 0) {
    console.log('[backfill] Every valid group was skipped by --skip. Nothing to write.')
    return
  }

  // ---- APPLY ----
  let merged = 0
  let failures = 0

  for (const group of toProcess) {
    const keep = group.keep
    const label = `group ${group.number}`

    const patch = {
      mention_count: mentions(keep) + group.merges.reduce((sum, r) => sum + mentions(r), 0)
    }
    if (!keep.raw_phrasing) {
      const donor = group.merges.find(r => r.raw_phrasing)
      if (donor) patch.raw_phrasing = donor.raw_phrasing
    }
    if (keep.confidence === 'inferred' && group.merges.some(r => r.confidence === 'explicit')) {
      patch.confidence = 'explicit'
    }

    const { error: keepError } = await supabase
      .from('career_knowledge')
      .update(patch)
      .eq('id', keep.id)
      .eq('user_id', userId)

    if (keepError) {
      // Superseding the merge rows now would hide their mention counts without
      // ever transferring them, so leave the whole group untouched.
      failures += 1
      console.error(`[backfill] FAILED ${label} — keep row ${keep.id} update failed, skipping its merges:`, keepError.message)
      continue
    }
    console.log(`[backfill] Updated keep row ${keep.id} — ${JSON.stringify(patch)}`)

    for (const row of group.merges) {
      const { error: mergeError } = await supabase
        .from('career_knowledge')
        .update({ superseded_by: keep.id })
        .eq('id', row.id)
        .eq('user_id', userId)

      if (mergeError) {
        failures += 1
        console.error(`[backfill] FAILED ${label} — could not supersede ${row.id}:`, mergeError.message)
      } else {
        merged += 1
        console.log(`[backfill] Superseded ${row.id} -> ${keep.id}`)
      }
    }
  }

  line()
  console.log(`[backfill] Groups processed: ${toProcess.length}${skippedByUser.length ? ` (${skippedByUser.length} skipped by user)` : ''}`)
  console.log(`[backfill] Rows merged: ${merged} of ${rowsToMerge}`)
  console.log(`[backfill] Failures: ${failures}`)
}

main().catch(err => {
  console.error('[backfill] Unexpected error:', err)
  process.exit(1)
})
