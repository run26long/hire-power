// ============================================================================
// SHARED SETUP FOR THE FICTIONALISATION SCRIPTS
//
// One test profile in this project carries a real person's name, employers and
// home town. These scripts replace all of that with invented equivalents so the
// profile can be shown, screenshotted and demoed without publishing anybody's
// identity, and then fill it with enough evidence and portfolio work to
// exercise the layouts that only misbehave when a section is full.
//
// WHY A SERVICE-ROLE CLIENT
// There is no request context here to carry a user JWT, and the writes span
// tables whose RLS policies are all written around auth.uid(). The same choice
// scripts/backfill-career-knowledge.js already makes, for the same reason.
//
// WHY EVERY SCRIPT IS DRY RUN BY DEFAULT
// Each one prints exactly what it would change and writes nothing until it is
// given --apply. They are ordered and idempotent: running 01 twice is a no-op
// the second time, because the thing it looks for is already gone.
// ============================================================================

const fs = require('fs')
const path = require('path')

// No dotenv in this project, so .env.local is parsed directly. Anything already
// in the real environment wins, so a value can be overridden per-run.
function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '..', '.env.local')
  if (!fs.existsSync(envPath)) {
    console.error('Could not find ' + envPath)
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

const { createClient } = require('@supabase/supabase-js')

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// The one profile these scripts touch. Named rather than discovered, so a
// script cannot wander onto somebody else's account.
const PROFILE_ID = '0bf7205f-b60c-414e-b5e2-1747c6094317'
const USER_ID = '9750ed49-895a-429f-bed8-9471fa027714'
const SLUG = 'daniel-mercer-test'
const BUCKET = 'profile-media'

// The three directions, by the ids they already have.
const LENS = {
  OPERATIONS: '4673f5cf-5a39-4515-a6b3-0217536e5eae',
  BUSINESS_DEV: 'd42494e9-68d6-4f0f-9c83-0e2f8bf0432b',
  EXECUTIVE: 'eee6f26b-7e85-4184-999a-2e329e8040b9'
}

const APPLY = process.argv.includes('--apply')

// The house rule the API applies to every piece of owner text. Repeated here
// because these scripts write to the tables directly and so never pass through
// the route that would otherwise enforce it.
const EM_DASH = '—'
function assertNoEmDash(value, label) {
  const s = typeof value === 'string' ? value : JSON.stringify(value)
  if (s.includes(EM_DASH)) throw new Error('Em dash in ' + label + ': ' + s.slice(0, 120))
}

const OUT_DIR = path.join(__dirname, 'output')

module.exports = { sb, PROFILE_ID, USER_ID, SLUG, BUCKET, LENS, APPLY, assertNoEmDash, OUT_DIR }
