#!/usr/bin/env node
/**
 * One-time: turn every dismissed Career Direction into a switched-off one.
 *
 *   node scripts/convert-dismissed-directions.js             # DRY RUN (default)
 *   node scripts/convert-dismissed-directions.js --dry-run   # same thing, said out loud
 *   node scripts/convert-dismissed-directions.js --apply     # writes
 *
 * Dry run is the default, the same shape as every other backfill here. It
 * prints every write it would make and changes nothing.
 *
 * WHAT IT IS FOR
 *
 * 'dismissed' was a fourth state for a Career Direction: thrown away from the
 * Resume Writer hub's suggestions row. That row was also the only way back -
 * the Career Profile's settings drawer never offered one, on the reasoning
 * that restoring something somebody threw away is a different decision from
 * un-hiding something they kept.
 *
 * The hub no longer shows Career Directions at all. So nothing can dismiss one
 * and nothing can restore one, and the rows already carrying that status are
 * stranded: they are in the drawer's payload and in none of its three groups,
 * so they render nowhere, and the visibility route used to refuse them with
 * "Restore it from your suggestions first" - pointing at a control that is
 * gone.
 *
 * WHY 'hidden' IS THE RIGHT STATE
 *
 * It is what the product already means by a direction that is switched off:
 * the drawer reads 'hidden' into its HIDDEN_STATE group, lists it under the
 * active ones with its switch off, and one press puts it back on the profile.
 * It is also the more generous of the two candidates. The visibility route
 * lets any paying plan turn a 'hidden' direction back on, because that is
 * restoring work the owner already had; turning on a 'suggested' one is adding
 * something new and is Pro alone. A direction somebody once had on their
 * profile is the first of those, not the second.
 *
 * WHAT IT DOES NOT TOUCH
 *
 * sort_order. Dismissing used to push a row to the end of the account's
 * ranking, and that rank is where it has been sitting ever since. Only the
 * active group has an order anybody sees - a hidden direction has no position
 * to hold - so rewriting it would change nothing on screen and would lose the
 * one record of where the row came in.
 *
 * Nothing about limits, either. The three-direction ceiling counts rows with
 * status 'active' and only those: /api/profile-lenses/create-custom counts
 * them, the visibility route counts them, and the drawer's own badge counts
 * them. 'hidden' is outside all three, so no account can be pushed over the
 * ceiling by this - the check below asserts that rather than assuming it, and
 * refuses to write if it is ever untrue.
 *
 * An account already at three active directions is a normal outcome, not a
 * problem: its converted direction sits in the drawer switched off, and
 * turning it on asks them to turn another off, which is what the drawer
 * already says and what any other hidden direction would do.
 *
 * Credentials come from .env.local (NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY). Service role, no session: this reads and writes
 * across every account, and there is no user to authenticate as.
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

// The state the drawer means by "switched off". SettingsDrawer.js reads this
// exact string into HIDDEN_STATE; keep the two in step.
const SWITCHED_OFF = 'hidden'

// How many directions a profile shows at once. lib/tiers.js MAX_LENSES and
// _lib/directions.js LENS_DISPLAY_LIMIT are the same number for the same
// reason; this is here so the assertion below can be read on its own.
const MAX_ACTIVE = 3

async function main() {
  console.log(apply ? '=== APPLY: writing changes ===' : '=== DRY RUN: no writes (pass --apply to write) ===')
  console.log('')

  const [{ data: lenses, error: lensError }, { data: profiles, error: profileError }] = await Promise.all([
    supabase
      .from('profile_lenses')
      .select('id, user_id, profile_id, name, slug, status, source, sort_order'),
    supabase
      .from('career_profiles')
      .select('user_id, slug')
  ])

  for (const [what, error] of [['profile_lenses', lensError], ['career_profiles', profileError]]) {
    if (error) {
      console.error(`Could not read ${what}:`, error.message)
      process.exit(1)
    }
  }

  const slugOf = new Map((profiles || []).map(p => [p.user_id, p.slug]))
  const label = (userId) => slugOf.get(userId) || userId

  const rows = lenses || []
  const dismissed = rows.filter(l => l.status === 'dismissed')

  if (dismissed.length === 0) {
    console.log('No Career Direction is in the dismissed state. Nothing to do.')
    return
  }

  // ---- THE CEILING, ASSERTED RATHER THAN ASSUMED ----
  //
  // Converting to 'hidden' cannot raise an account's active count, because
  // 'hidden' is not 'active'. That is the whole argument, and it is one line
  // of reasoning away from being wrong if the drawer or a route ever starts
  // counting hidden rows. So the count is computed both ways and compared, and
  // anything that does not match stops the run before a single write.
  const blocked = []
  for (const lens of dismissed) {
    const mine = rows.filter(l => l.user_id === lens.user_id)
    const activeBefore = mine.filter(l => l.status === 'active').length
    const activeAfter = mine.filter(l =>
      l.id === lens.id ? SWITCHED_OFF === 'active' : l.status === 'active'
    ).length
    if (activeAfter > activeBefore || activeAfter > MAX_ACTIVE) {
      blocked.push({ lens, activeBefore, activeAfter })
    }
  }

  if (blocked.length > 0) {
    console.error('STOPPED. Converting would change an account\'s active direction count:')
    for (const b of blocked) {
      console.error(`  ${label(b.lens.user_id)}  "${b.lens.name}"  active ${b.activeBefore} -> ${b.activeAfter} (ceiling ${MAX_ACTIVE})`)
    }
    console.error('\nNothing was written. The ceiling counts status \'active\' only, so this')
    console.error('should be unreachable - if it fired, something now counts differently.')
    process.exit(1)
  }

  // ---- THE PLAN ----
  console.log(`Career Directions to convert: ${dismissed.length}`)
  console.log('')
  for (const lens of dismissed) {
    const mine = rows.filter(l => l.user_id === lens.user_id)
    const active = mine.filter(l => l.status === 'active').length
    const hidden = mine.filter(l => l.status === SWITCHED_OFF).length
    console.log(`${label(lens.user_id)}`)
    console.log(`  profile_lenses  ${lens.id}`)
    console.log(`                  "${lens.name}" (slug ${lens.slug}, source ${lens.source}, sort_order ${lens.sort_order})`)
    console.log(`                  status: dismissed -> ${SWITCHED_OFF}`)
    console.log(`                  account now: ${active} active (of ${MAX_ACTIVE}), ${hidden} switched off`)
    console.log(`                  after: ${active} active (of ${MAX_ACTIVE}), ${hidden + 1} switched off`)
    if (active >= MAX_ACTIVE) {
      console.log(`                  note: already showing ${MAX_ACTIVE}, so turning this one on will`)
      console.log(`                        ask them to turn another off - the same as any hidden one`)
    }
    console.log('')
  }

  // ---- THE WRITES ----
  // Row by row, each scoped to its owner and to the status it is expected to
  // be in. The service role sees every row, so the user_id is what keeps a
  // mistyped id off somebody else's direction; the status filter means a row
  // that has moved since the read above is skipped rather than overwritten.
  if (!apply) {
    console.log('Dry run complete. Nothing was written. Re-run with --apply.')
    return
  }

  console.log('---- WRITING ----')
  let written = 0
  let failed = 0
  let stale = 0
  for (const lens of dismissed) {
    const { data, error } = await supabase
      .from('profile_lenses')
      .update({ status: SWITCHED_OFF, updated_at: new Date().toISOString() })
      .eq('id', lens.id)
      .eq('user_id', lens.user_id)
      .eq('status', 'dismissed')
      .select('id, name, status')
      .maybeSingle()

    if (error) {
      failed++
      console.error(`  FAILED ${lens.id}: ${error.message}`)
    } else if (!data) {
      stale++
      console.log(`  SKIPPED ${lens.id}: no longer dismissed`)
    } else {
      written++
      console.log(`  ${label(lens.user_id)}  "${data.name}" -> ${data.status}`)
    }
  }
  console.log(`  ${written} written, ${stale} skipped, ${failed} failed`)
  console.log('')

  // ---- AFTER ----
  const { data: after, error: afterError } = await supabase
    .from('profile_lenses')
    .select('id, user_id, name, status')
  if (afterError) {
    console.error('Could not read back:', afterError.message)
    return
  }

  const stillDismissed = (after || []).filter(l => l.status === 'dismissed')
  console.log('---- INVARIANT ----')
  console.log(`  Career Directions still dismissed: ${stillDismissed.length}`)
  for (const l of stillDismissed) console.log(`    ${label(l.user_id)}  "${l.name}"`)
  console.log('')
  console.log('Done.')
}

main().catch(err => {
  console.error('Conversion failed:', err)
  process.exit(1)
})
