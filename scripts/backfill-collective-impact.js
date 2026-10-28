#!/usr/bin/env node
/**
 * One-time: write the Collective Impact synthesis for every profile that
 * already has enough published testimonials for one.
 *
 *   node scripts/backfill-collective-impact.js                # dry run
 *   node scripts/backfill-collective-impact.js --apply
 *   node scripts/backfill-collective-impact.js --profile=<id|slug> --apply
 *
 * WHY
 * The generator has always been complete and nothing ever called it. It is
 * called from the editor now, whenever the profile's set of published
 * testimonials changes - but that only covers changes from here on. Every
 * profile that was already finished has no synthesis and no reason to get
 * one, because nothing about it is going to change.
 *
 * WHAT IT DOES
 * Calls the synthesis directly, in this process, with the service role:
 * app/api/career-profile/_lib/collectiveImpact.js, the same module the
 * editor's route calls. It does not reimplement anything, and it does not
 * call the deployed site. The prompt, the validation, the hash and the write
 * all stay in one place and this is a caller.
 *
 * IT DOES NOT LOG IN AS ANYBODY
 * An earlier version minted a magic link for each owner and used their
 * session to call the route over HTTP, because the route takes the profile
 * from the caller's token. That is signing in as a user to do a job on their
 * behalf, and nothing about the work needs it. The route still takes the
 * profile from the token, because for the route that is the only thing
 * standing between a profile id and whoever guessed it. Here, the service
 * role is the authority and the profile is named outright.
 *
 * SAFE TO RE-RUN
 * The synthesis compares the hash of the set it just read against the hash
 * stored on the row and returns `unchanged` without calling the model when
 * they match. A second run therefore costs one cheap query per profile and
 * writes nothing. That is also what makes a half-finished run safe to pick
 * up: the profiles already done are skipped.
 *
 * A FAILURE IS ONE PROFILE
 * Each is done on its own; one that fails is counted, named and stepped
 * over. A profile with no synthesis renders without the column, which is
 * what it does today.
 */

const fs = require('fs')
const path = require('path')
const { pathToFileURL } = require('url')
const { createClient } = require('@supabase/supabase-js')

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

const APPLY = process.argv.includes('--apply')
const onlyArg = process.argv.find(one => one.startsWith('--profile='))
const ONLY = onlyArg ? onlyArg.split('=')[1] : null

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  console.log(APPLY ? '=== APPLYING ===' : '=== DRY RUN (nothing will be written) ===')
  if (ONLY) console.log(`=== PROFILE ${ONLY} ===`)
  console.log()

  // Imported here rather than at the top: the module builds its Anthropic
  // client at import time from process.env, so .env.local has to be loaded
  // first. Dynamic import because this script is CommonJS and the module,
  // like the rest of the app, is ESM.
  const enginePath = path.join(
    __dirname, '..', 'app', 'api', 'career-profile', '_lib', 'collectiveImpact.js'
  )
  const { MIN_TESTIMONIALS, synthesiseProfile } = await import(pathToFileURL(enginePath).href)

  const { data: profiles, error: profileError } = await supabase
    .from('career_profiles')
    .select('id, slug, user_id')

  if (profileError) {
    console.error('Career profile fetch failed:', profileError.message)
    process.exit(1)
  }

  let scoped = profiles || []
  if (ONLY) {
    scoped = scoped.filter(one => one.id === ONLY || one.slug === ONLY)
    if (scoped.length === 0) {
      console.error(`No career profile matches "${ONLY}" by id or slug`)
      process.exit(1)
    }
  }

  // Only so the name can be kept out of the copy it is about. One query for
  // all of them rather than one per profile.
  const { data: owners } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in('id', [...new Set(scoped.map(one => one.user_id))])
  const nameFor = new Map((owners || []).map(one => [one.id, one.display_name || '']))

  let wrote = 0
  let would = 0
  let unchanged = 0
  let tooFew = 0
  let failed = 0

  for (const profile of scoped) {
    const label = profile.slug || profile.id
    try {
      const result = await synthesiseProfile(supabase, {
        profileId: profile.id,
        userId: profile.user_id,
        ownerName: nameFor.get(profile.user_id) || '',
        dryRun: !APPLY
      })

      if (result.status === 'not_enough') {
        tooFew++
        console.log(`  skip       ${label}  (${result.eligible} published, needs ${MIN_TESTIMONIALS})`)
      } else if (result.status === 'unchanged') {
        unchanged++
        console.log(`  unchanged  ${label}  (${result.eligible} testimonials)`)
      } else if (result.status === 'dry-run') {
        would++
        console.log(`  would      ${label}  (${result.eligible} testimonials)`)
      } else {
        wrote++
        console.log(`  wrote      ${label}  (${result.eligible} testimonials)`)
      }
    } catch (err) {
      failed++
      console.error(`  failed     ${label}  ${err?.message || err}`)
    }
  }

  console.log()
  if (APPLY) {
    console.log(`${wrote} written, ${unchanged} already current, ${tooFew} under the minimum, ${failed} failed.`)
    if (failed > 0) console.log('A profile with no synthesis renders without the column, as it does today.')
  } else {
    console.log(`${would} would be generated, ${unchanged} already current, ${tooFew} under the minimum, ${failed} failed to read.`)
    console.log('Dry run. Nothing was generated and nothing was written.')
    console.log('Re-run with --apply to write them.')
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
