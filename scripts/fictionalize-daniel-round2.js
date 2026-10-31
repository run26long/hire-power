// ============================================================================
// FICTIONALISATION, ROUND 2 - THE TWO EMPLOYERS THE FIRST PASS MISSED
//
// scripts/fictionalize/01-rename.js replaced James Long's name, three of his
// five employers (Disruptor Manufacturing, Madstad Engineering, MBF Industries)
// and the geography that went with them. It did not touch the two oldest roles
// on his resume, and they are still there:
//
//   Powers Fastener        -> Brightwell Anchoring
//   Fastening Specialists  -> Halvorsen Fastening Supply
//
// Everything about this script is the shape 01-rename.js already established:
// dry run by default, service role, scoped to one account by id, every row it
// would touch backed up verbatim first, and --apply refused while any target
// name would still be readable afterwards.
//
// WHAT IS DIFFERENT, AND WHY
//
// The backup goes to scratchpad/ rather than scripts/fictionalize/output/.
// scratchpad/ is gitignored at the repository root, which is the property that
// matters: the backup is a verbatim copy of rows carrying a real person's
// employment history, and committing it would put the thing this script exists
// to remove into git history permanently, where deleting the file later would
// not take it back out.
//
// THE TABLES THIS SWEEPS, AND THE ONES IT DOES NOT
//
// A read-only survey of all 24 tables holding this account's data found the two
// names in exactly two of them: career_knowledge and resumes. This script still
// sweeps the full set 01-rename.js swept, because a table that is clean today
// costs one empty query and a table that is missing from the list costs a
// second round of this.
//
// resumes is NOT scoped to is_active here, and that is a deliberate departure
// from 01. That scope existed because five inactive resumes on this account
// belong to a different test persona ("Marcus Rivera", Tampa FL) and a generic
// Florida rule was corrupting them. There is no generic rule here - the two
// names are specific, they appear in no Marcus row, and two of the three rows
// that do carry them are inactive core resumes. Scoping to active would leave
// them behind, which is how this round came to exist.
//
// career_knowledge.content_key is NOT substituted. It is derived from content
// and backs the unique index (user_id, content_key), so it is regenerated with
// the app's own function - the only way the two cannot drift. That is also why
// the lowercase forms of both names appear in the data: they are in the key,
// put there by the key builder, and they leave when the key is rebuilt.
//
// THE BARE "Powers" RULE IS SAFE HERE, AND WAS CHECKED
//
// "powers" is an ordinary English word, so a bare rule is the kind that quietly
// rewrites a sentence it has no business touching. Every occurrence in this
// account was read first. There are three, all of them the employer:
//
//   career_knowledge.raw_phrasing    "Fastening Specialists and Powers both..."
//   coaching_conversation[9]         "Not as much at powers but definitely..."
//   coaching_conversation[11]        "Fastening Specialists and Powers both..."
//
// The dry run prints every change it would make, so a fourth occurrence arriving
// later is visible before anything is written rather than after.
//
// ORDERING IS LOAD-BEARING, FOR ONE REASON IN PARTICULAR
//
// The replacement for Fastening Specialists contains the word "Fastening". A
// bare rule on that word would eat its own output on a second run, so there is
// no bare rule on it - and the survey confirmed there is no standalone
// "Fastening" or "Fastener" in this account to need one. Every occurrence of
// "Fastener" is the tail of "Powers Fastener"; every "Fastening" is the head of
// "Fastening Specialists".
// ============================================================================

const fs = require('fs')
const path = require('path')

// ---------------------------------------------------------------------------
// .env.local, parsed directly. No dotenv in this project, and the same reader
// scripts/fictionalize/_env.js uses. Anything already in the real environment
// wins, so a value can be overridden per run.
// ---------------------------------------------------------------------------
function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local')
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

// Service role, for the reason scripts/fictionalize/_env.js gives: there is no
// request context here to carry a user JWT and the writes span tables whose RLS
// policies are all written around auth.uid().
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// The one account this touches. Named rather than discovered, so the script
// cannot wander onto somebody else's rows - and in particular cannot wander
// onto james-long's own profile, which is where these names belong.
const USER_ID = '9750ed49-895a-429f-bed8-9471fa027714'
const PROFILE_ID = '0bf7205f-b60c-414e-b5e2-1747c6094317'
const SLUG = 'daniel-mercer-test'

const APPLY = process.argv.includes('--apply')

// Gitignored at the repository root. See the header.
const OUT_DIR = path.join(__dirname, '..', 'scratchpad')
const BACKUP = path.join(OUT_DIR, 'fictionalize-round2-backup.json')

// ---------------------------------------------------------------------------
// THE THUMBNAILS, WHICH ARE PICTURES OF THE ROWS
//
// Every core resume on this account has a rendered PNG in the resume-thumbnails
// bucket, and that bucket is PUBLIC: the URL in resumes.thumbnail_url answers
// 200 with no credentials. The picture is a screenshot of the resume as it was
// when it was taken, so the details are pixels and no text sweep reaches them.
// Rewriting a row leaves its old thumbnail saying the old thing, to anybody
// with the link.
//
// There are two kinds of problem here and they have different answers.
//
// ONE ROW HAS TO LOSE ITS PICTURE
// resumes 23f9c7b0 is the abandoned upload, and its thumbnail is a render of
// the owner's own name, email and phone. There is nothing to regenerate: the
// row is an archived draft full of keyboard mash and nothing in the app reads
// its thumbnail. The object is deleted and the column set to null.
//
// ONE MORE ROW NEEDS A NEW PICTURE, AND THIS SCRIPT CANNOT MAKE IT
// 090da437, the active core, carries a render of match100pro@gmail.com. It
// needs regenerating rather than deleting, and the app's generator cannot be
// called from here - see the note above CLEAR_ACTIVE_CORE_THUMB. It is
// reported and left alone, which is the instruction for exactly this case.
//
// 7df610dd and 4378f821 were the other two candidates and have no thumbnail
// at all, so there is nothing of theirs to regenerate or delete.
// ---------------------------------------------------------------------------
const THUMB_BUCKET = 'resume-thumbnails'

// Deleted outright: nothing regenerates these and nothing reads them.
const THUMBNAIL_CLEAR = ['23f9c7b0-9de6-408f-b47b-dc901d55767c']

// Reported, not touched. The resume each one belongs to, and what its current
// picture is still showing.
// Reported, not touched - and only one of these has a picture today. The
// other two are listed because thumbnail_url is nullable and a later hub
// load or a later feature could give them one, and a row that is checked is
// better than a row that is assumed.
const THUMBNAIL_STALE = {
  '090da437-b5be-48d8-a8db-fafc527eef13': 'active core: its render shows the old email',
  '7df610dd-8e87-40b6-a4cc-c3e10d21e3fd': 'archived core: no thumbnail today',
  '4378f821-9f18-4248-89e4-f7d03bdda83c': 'active job-specific: no thumbnail today'
}

// The bytes of a deleted thumbnail, beside the row backup. Gitignored for the
// same reason and kept for the same one: every other change this script makes
// is reversible from scratchpad/, and a delete that is not would be the one
// step nobody could undo.
const THUMB_BACKUP_DIR = path.join(OUT_DIR, 'fictionalize-round2-thumbnails')

// A public storage URL back to the object path inside its bucket. Derived from
// the URL rather than rebuilt from the row id, because the stored name carries
// a timestamp this script does not know - and guessing a path to hand to a
// delete call is the wrong kind of guess.
function thumbObjectPath(url) {
  if (typeof url !== 'string') return null
  const marker = '/' + THUMB_BUCKET + '/'
  const at = url.indexOf(marker)
  if (at === -1) return null
  const rest = url.slice(at + marker.length)
  if (!rest) return null
  // A signed or cache-busted URL would carry a query; the object does not.
  return decodeURIComponent(rest.split('?')[0])
}

// ---------------------------------------------------------------------------
// WHY THE THREE ARE NOT REGENERATED HERE
//
// The generator is generateThumbnail(resumeData, resumeId) in
// app/api/resume-coach/data/route.js. It launches puppeteer, renders the HTML
// that generateResumeHTML(resumeData) builds in the same file, screenshots it
// at 850x1100 and uploads <resumeId>-<Date.now()>.png to this bucket.
//
// Neither function is exported - the route exports GET and nothing else - and
// the module is an ESM Next route that resolves @/lib/... through the bundler's
// path alias, so a plain node script cannot import it even with puppeteer
// installed, which it is. Copying the two functions in here would be two
// hundred lines of HTML template kept in step by hand, which is the thing that
// drifts.
//
// HOW THE APP DOES IT, WHICH IS THE ANSWER FOR ONE OF THE THREE
//
// GET /api/resume-coach/data regenerates lazily, and only in one case:
//
//   let thumbnailUrl = coreResume?.thumbnail_url
//   if (coreResume && !thumbnailUrl) { ...generate, then store the URL... }
//
// coreResume is allCore.find(isRealCore) over a query filtered to
// is_active, so the hub rebuilds a missing thumbnail for the ONE active real
// core and for nothing else. An existing thumbnail is never refreshed.
//
// So for 090da437 - the active core - deleting the object and nulling the
// column is enough: the next load of the Resume Writer hub renders a new one
// from the updated resume_data and stores it. That is the app's own generator
// doing the work, just on its own schedule rather than this script's.
//
// For 7df610dd (archived) and 4378f821 (job-specific) nothing would ever
// rebuild them, so nulling the column would leave two cards with no picture.
//
// None of the three is touched here, because the instruction for "the
// generator cannot run from a script" was to report and leave them. Passing
// --clear-active-core-thumb opts into the one case that is self-healing.
// ---------------------------------------------------------------------------
const CLEAR_ACTIVE_CORE_THUMB = process.argv.includes('--clear-active-core-thumb')
const ACTIVE_CORE_ID = '090da437-b5be-48d8-a8db-fafc527eef13'


// ---------------------------------------------------------------------------
// THE RULES
//
// Full names first, bare forms after, each case written out rather than matched
// case-insensitively: the transcript is lowercase because the owner typed it
// that way, and a rule that normalises case makes a transcript stop reading
// like something a person wrote. The same choice 01-rename.js made.
// ---------------------------------------------------------------------------
const RULES = [
  // --- Powers Fastener ---
  [/Powers Fastener/g, 'Brightwell Anchoring'],
  [/powers fastener/g, 'brightwell anchoring'],
  [/POWERS FASTENER/g, 'BRIGHTWELL ANCHORING'],

  // --- Fastening Specialists ---
  // Both the plural the resume uses and the singular, because the two differ by
  // one letter and only one of them is in the data today.
  [/Fastening Specialists/g, 'Halvorsen Fastening Supply'],
  [/Fastening Specialist\b/g, 'Halvorsen Fastening Supply'],
  [/fastening specialists/g, 'halvorsen fastening supply'],
  [/fastening specialist\b/g, 'halvorsen fastening supply'],
  [/FASTENING SPECIALISTS/g, 'HALVORSEN FASTENING SUPPLY'],

  // --- the bare employer, after the full forms so it cannot pre-empt them ---
  [/\bPowers\b/g, 'Brightwell'],
  [/\bpowers\b/g, 'brightwell'],
  [/\bPOWERS\b/g, 'BRIGHTWELL'],

  // --- the contact address ---
  // Jim's real email, and the only one of these that is published: it is
  // career_profiles.contact_email, which is what the Contact button on the
  // public profile opens. hired@hirepowerai.com is the product's own support
  // address and already appears in the footer, the privacy page and the terms,
  // so it is a real address that belongs to this product rather than to a
  // person - which is what a demo profile should be answering on.
  //
  // profiles.email is deliberately NOT a target. It mirrors auth.users and
  // rewriting it would break sign-in on an account somebody uses, which is the
  // same exception scripts/fictionalize/01-rename.js records.
  [/match100pro@gmail\.com/g, 'hired@hirepowerai.com'],
  [/MATCH100PRO@GMAIL\.COM/g, 'HIRED@HIREPOWERAI.COM'],
  // A backstop, not a rule anybody expects to fire: the full address above
  // takes every occurrence in the data today. It is here for a bare local
  // part arriving in a field somebody types into later, and it deliberately
  // produces a bare word rather than half an address.
  [/match100pro/g, 'hired']
]

const sub = (s) => RULES.reduce((acc, [re, to]) => acc.replace(re, to), s)

// Every string in a JSON column, wherever it is nested, with a readable trail
// so the dry run says which bullet of which role changed.
function walk(value, trail, hits) {
  if (typeof value === 'string') {
    const next = sub(value)
    if (next !== value) hits.push([trail, value, next])
    return next
  }
  if (Array.isArray(value)) return value.map((v, i) => walk(v, trail + '[' + i + ']', hits))
  if (value && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) out[k] = walk(v, trail ? trail + '.' + k : k, hits)
    return out
  }
  return value
}


// ---------------------------------------------------------------------------
// THE SCHOOL, WHICH IS NOT A SUBSTITUTION
//
// Jim's technical degree is replaced by a fictional bachelor's. It is done as
// an object transform rather than through RULES because a resume's education
// entry is structured, and three of its fields have to move together: changing
// the school alone would leave a Bachelor of Science in Carpentry.
//
// WHY field IS CLEARED
// Every renderer in this app prints the pair the same way -
// [degree, field].filter(Boolean).join(', ') - in lib/resumeText.js and in the
// analyze, coach, job-analyze, power-analysis and generateLens routes. The new
// degree string already carries its field, so leaving the old one behind would
// print "Bachelor of Science in Business Administration, Carpentry, Masonry,
// and Electrical" on every one of them.
//
// WHAT IS KEPT
// graduationDate, lines, and every other key on the entry, untouched. There is
// no year to keep on this account - all four entries carry graduationDate null
// - but the rule is written to preserve one rather than to assume there is
// none, because the archived rows are editable and one could acquire a date
// before this is run.
//
// degreeDisplay is a derived display string that exists on some resume shapes
// and not on these four. It is rewritten where present rather than left to
// contradict the degree beside it.
//
// MATCHED ON THE SCHOOL, CASE-INSENSITIVELY
// "Westminster Technical" is the only school this applies to, and the entry is
// identified by it rather than by index: education[0] is the right entry today
// and would be the wrong one the moment somebody adds a second school.
// ---------------------------------------------------------------------------
const EDUCATION_MATCH = /westminster/i

const EDUCATION_TO = {
  school: 'Brandt University',
  location: 'Wilmington, DE',
  degree: 'Bachelor of Science in Business Administration',
  field: ''
}

// Returns [nextEntry, changed]. Shallow by design: an education entry is flat.
function fixEducationEntry(entry) {
  if (!entry || typeof entry !== 'object') return [entry, false]
  if (!EDUCATION_MATCH.test(String(entry.school || ''))) return [entry, false]
  const next = { ...entry, ...EDUCATION_TO }
  if ('degreeDisplay' in entry) next.degreeDisplay = EDUCATION_TO.degree
  return [next, true]
}

// The education arrays this sweep reaches, by table and column. Reported in
// full in the dry run - before and after - because a structured rewrite cannot
// be read off a string diff the way the rest of this can.
const EDUCATION_COLS = { resumes: ['resume_data', 'rewritten_resume'] }

// ---------------------------------------------------------------------------
// ONE ARCHIVED ROW, AND ONLY THAT ROW
//
// resumes 23f9c7b0 is an abandoned upload from before this account became a
// test fixture. Everything in it is keyboard mash - school "sdf", company
// "dfg", title "sfdg" - except three fields that are the real owner's own
// name, email and phone.
//
// Scoped to the row id rather than written as a RULE, for one reason that
// matters: a global /Jessica Long/ rule would also rewrite
// profile_testimonials.recipient_name, which is a published testimonial the
// owner has said they will remove themselves. The stored value here is
// "Jessica longq" with a trailing q, so a literal rule would in fact miss the
// testimonial - but relying on a typo to keep two things apart is not a
// guarantee, and a row id is.
//
// The same scoping is why run2long@gmail.com and the phone are here rather
// than in RULES: they appear in this row and nowhere else, and a rule that
// cannot reach anything else cannot surprise anybody.
// ---------------------------------------------------------------------------
const ROW_FIXES = {
  'resumes|23f9c7b0-9de6-408f-b47b-dc901d55767c': {
    resume_data: {
      fullName: ['Jessica longq', 'Daniel Mercer'],
      email: ['run2long@gmail.com', 'hired@hirepowerai.com'],
      phone: ['4073214931', '704-555-0142']
    }
  }
}

// Applies a row fix in place on a copy, reporting what it touched. A stored
// value that is not the one expected is left alone and reported, rather than
// overwritten: if the row has changed since this was written, that is something
// to look at and not something to flatten.
function applyRowFix(table, row, patch, hits) {
  const fix = ROW_FIXES[table + '|' + row.id]
  if (!fix) return
  for (const [col, fields] of Object.entries(fix)) {
    const current = col in patch ? patch[col] : row[col]
    if (!current || typeof current !== 'object') continue
    const next = { ...current }
    let touched = false
    for (const [field, [from, to]] of Object.entries(fields)) {
      if (next[field] === from) {
        hits.push([col + '.' + field + ' (row-scoped)', from, to])
        next[field] = to
        touched = true
      } else if (next[field] !== to) {
        hits.push([col + '.' + field + ' (SKIPPED - not the expected value)', next[field], '(left as is)'])
      }
    }
    if (touched) patch[col] = next
  }
}

// ---------------------------------------------------------------------------
// The same table set 01-rename.js swept, plus the four it did not reach:
// cover_letters, applications, achievements and the two placement tables are
// where this account's remaining text lives. All six are clean of these two
// names today; they are listed so that stays checked rather than assumed.
// ---------------------------------------------------------------------------
const TARGETS = [
  { table: 'profiles', filter: q => q.eq('id', USER_ID), cols: ['display_name'] },
  // contact_email is what the Contact button opens, so it is swept rather
  // than left as the one published copy of the address.
  { table: 'career_profiles', filter: q => q.eq('id', PROFILE_ID), cols: ['imow_text', 'contact_email'] },
  {
    table: 'career_context', filter: q => q.eq('user_id', USER_ID),
    cols: ['current_company', 'location_preference', 'career_goal', 'target_industries', 'current_lens_name', 'target_roles']
  },
  {
    table: 'career_knowledge', filter: q => q.eq('user_id', USER_ID),
    cols: ['content', 'raw_phrasing', 'source_job_title', 'source_job_company', 'previous_content']
  },
  {
    table: 'profile_lenses', filter: q => q.eq('profile_id', PROFILE_ID),
    cols: ['name', 'headline', 'bio', 'proof_points', 'ready_for_next', 'ready_tags', 'evidence_summary', 'skill_emphasis']
  },
  {
    table: 'profile_testimonials', filter: q => q.eq('profile_id', PROFILE_ID),
    cols: ['recipient_title', 'relationship', 'raw_text', 'polished_text']
  },
  {
    table: 'profile_evidence', filter: q => q.eq('profile_id', PROFILE_ID),
    cols: ['title', 'description', 'organization', 'date_label', 'kind', 'evidence_type', 'url']
  },
  { table: 'profile_collective_impacts', filter: q => q.eq('profile_id', PROFILE_ID), cols: ['summary', 'themes'] },
  { table: 'profile_skill_proofs', filter: q => q.eq('profile_id', PROFILE_ID), cols: ['skill_label', 'proofs'] },
  {
    // Every resume, active or not. See the header for why this differs from 01.
    table: 'resumes', filter: q => q.eq('user_id', USER_ID),
    cols: ['display_name', 'resume_data', 'coaching_conversation', 'ai_analysis',
      'rewritten_resume', 'resume_changes', 'job_company', 'job_title', 'job_description', 'captured_data']
  },
  {
    table: 'cover_letters', filter: q => q.eq('user_id', USER_ID),
    cols: ['cover_letter_data', 'job_title', 'company', 'job_description']
  },
  {
    table: 'applications', filter: q => q.eq('user_id', USER_ID),
    cols: ['company', 'job_title', 'description', 'notes', 'location']
  },
  {
    table: 'achievements', filter: q => q.eq('user_id', USER_ID),
    cols: ['raw_description', 'coached_description', 'final_description', 'metrics', 'skills_demonstrated']
  }
]

// ---------------------------------------------------------------------------
// Scanned against the RESULT of every swept field. A hit means a rule missed,
// and --apply refuses while any remain. Case-insensitive on purpose: the rules
// are case-specific and this is the thing that catches a casing nobody listed.
// ---------------------------------------------------------------------------
const LEFTOVERS = [
  /powers\s*fastener/i,
  /fastening\s*specialist/i,
  /\bpowers\b/i,

  // --- the three targets added in the second round of scope ---
  /match100pro/i,
  /westminster/i,
  /run2long/i,
  /407[-.\s]?321[-.\s]?4931/,
  // The trailing q is load-bearing. The published testimonial's recipient is
  // "Jessica Long" without it, and the owner is removing that row by hand -
  // so a scan for the bare name would refuse --apply forever over a row this
  // script is not allowed to touch.
  /Jessica longq/i
]

// Copied verbatim from app/api/career-knowledge/route.js, as 01-rename.js does.
// career_knowledge.content_key is derived, never substituted.
const buildContentKey = (content) => String(content)
  .toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()

// One education entry as one readable line, for the dry run's own report. Named
// rather than inlined because the before and the after have to be formatted
// identically or the comparison is not one.
function summariseEducation(entry) {
  const e = entry || {}
  const degree = [e.degree, e.field].filter(Boolean).join(', ') || '(no degree)'
  return [
    'school=' + JSON.stringify(e.school ?? null),
    'location=' + JSON.stringify(e.location ?? null),
    'degree=' + JSON.stringify(degree),
    'graduationDate=' + JSON.stringify(e.graduationDate ?? null)
  ].join('  ')
}


// ---------------------------------------------------------------------------
// The thumbnail step. Planned during the dry run and carried out only under
// --apply, after the row updates: the pictures are of the rows, so the rows go
// first and a failure part way through leaves a stale picture rather than a
// deleted one over a row that never changed.
// ---------------------------------------------------------------------------
function planThumbnails(resumeRows) {
  const todo = []
  const byId = new Map((resumeRows || []).map(r => [r.id, r]))

  for (const id of THUMBNAIL_CLEAR) {
    const row = byId.get(id)
    if (!row) { todo.push({ id, action: 'missing', why: 'no such row in this account' }); continue }
    if (!row.thumbnail_url) { todo.push({ id, action: 'already clear', why: 'thumbnail_url is already null' }); continue }
    const objectPath = thumbObjectPath(row.thumbnail_url)
    if (!objectPath) { todo.push({ id, action: 'unparseable', why: row.thumbnail_url }); continue }
    todo.push({ id, action: 'delete', objectPath, url: row.thumbnail_url })
  }

  for (const [id, note] of Object.entries(THUMBNAIL_STALE)) {
    const row = byId.get(id)
    if (!row || !row.thumbnail_url) continue
    const self = id === ACTIVE_CORE_ID && CLEAR_ACTIVE_CORE_THUMB
    todo.push({
      id,
      action: self ? 'delete (hub will regenerate)' : 'stale, left alone',
      objectPath: thumbObjectPath(row.thumbnail_url),
      url: row.thumbnail_url,
      why: note
    })
  }
  return todo
}

async function applyThumbnails(todo) {
  const doing = todo.filter(t => t.action.startsWith('delete'))
  if (!doing.length) { console.log('\nThumbnails: nothing to do.'); return }

  if (!fs.existsSync(THUMB_BACKUP_DIR)) fs.mkdirSync(THUMB_BACKUP_DIR, { recursive: true })

  for (const t of doing) {
    // The bytes first. A delete this script cannot undo is the one step in it
    // that would not be reversible from scratchpad/.
    const { data, error: downloadError } = await sb.storage.from(THUMB_BUCKET).download(t.objectPath)
    if (downloadError) {
      console.log('  SKIP ' + t.id + ': could not read the object to back it up: ' + downloadError.message)
      continue
    }
    const file = path.join(THUMB_BACKUP_DIR, t.objectPath.replace(/[\\/]/g, '_'))
    fs.writeFileSync(file, Buffer.from(await data.arrayBuffer()))
    console.log('  saved ' + file)

    // Then the object, and only then the column. The object is what is exposed;
    // the column is bookkeeping. In this order a failure leaves a row pointing
    // at a picture that is already gone, which is harmless - the other order
    // leaves a public picture with nothing pointing at it, which is worse and
    // harder to find again.
    const { error: removeError } = await sb.storage.from(THUMB_BUCKET).remove([t.objectPath])
    if (removeError) {
      console.log('  FAIL ' + t.id + ': delete refused: ' + removeError.message)
      continue
    }
    console.log('  deleted ' + THUMB_BUCKET + '/' + t.objectPath)

    const { error: updateError } = await sb.from('resumes').update({ thumbnail_url: null }).eq('id', t.id)
    console.log(updateError
      ? '  FAIL ' + t.id + ': thumbnail_url not cleared: ' + updateError.message
      : '  ok ' + t.id + ' thumbnail_url = null')
  }
}


async function main() {
  console.log('Account: ' + SLUG + '  (user ' + USER_ID + ')')
  console.log(APPLY ? 'MODE: APPLY\n' : 'MODE: dry run\n')

  // Refuse to run at all against the wrong account. Cheap, and the one mistake
  // that would be unrecoverable is writing these names over the real profile.
  const { data: owner, error: ownerError } = await sb
    .from('career_profiles').select('id, user_id, slug').eq('id', PROFILE_ID).maybeSingle()
  if (ownerError) { console.error('Could not read the profile: ' + ownerError.message); process.exit(1) }
  if (!owner || owner.slug !== SLUG || owner.user_id !== USER_ID) {
    console.error('Profile ' + PROFILE_ID + ' is not ' + SLUG + '. Refusing to touch anything.')
    process.exit(1)
  }

  const backup = {}
  const plan = []
  // Every education entry this would rewrite, for the report at the end.
  const schools = []
  const leftovers = []
  let totalFields = 0

  for (const { table, filter, cols } of TARGETS) {
    const { data, error } = await filter(sb.from(table).select('*'))
    if (error) { console.log('!! ' + table + ': ' + error.message); continue }
    backup[table] = data

    for (const row of data) {
      const patch = {}, hits = []
      for (const col of cols) {
        if (!(col in row) || row[col] === null) continue
        const next = walk(row[col], col, hits)
        if (JSON.stringify(next) !== JSON.stringify(row[col])) patch[col] = next
      }

      // Derived, never substituted. Regenerated from whatever content ends up
      // being, so the key and the content cannot disagree.
      if (table === 'career_knowledge') {
        const content = 'content' in patch ? patch.content : row.content
        const key = buildContentKey(content)
        if (key !== row.content_key) {
          hits.push(['content_key (regenerated)', row.content_key, key])
          patch.content_key = key
        }
      }

      // ---- the school, transformed rather than substituted ----
      // Done after the string sweep so it is applied to the swept copy, and
      // recorded in `schools` as well as in `hits` so the dry run can print
      // the before and after of every entry side by side.
      for (const col of (EDUCATION_COLS[table] || [])) {
        const current = col in patch ? patch[col] : row[col]
        if (!current || !Array.isArray(current.education)) continue
        let touched = false
        const nextEducation = current.education.map((entry, i) => {
          const [next, changed] = fixEducationEntry(entry)
          if (!changed) return entry
          touched = true
          hits.push([col + '.education[' + i + '] (entry rewritten)', summariseEducation(entry), summariseEducation(next)])
          schools.push({ table, id: row.id, col, index: i, before: entry, after: next })
          return next
        })
        if (touched) patch[col] = { ...current, education: nextEducation }
      }

      // ---- the one archived row, by id ----
      applyRowFix(table, row, patch, hits)

      if (Object.keys(patch).length) { plan.push({ table, id: row.id, patch, hits }); totalFields += hits.length }

      // The leftover scan reads the RESULT, including content_key.
      for (const col of [...cols, 'content_key']) {
        if (!(col in row) || row[col] === null) continue
        const after = col in patch ? patch[col] : row[col]
        const flat = typeof after === 'string' ? after : JSON.stringify(after)
        for (const re of LEFTOVERS) {
          const m = flat.match(re)
          if (m) {
            const at = flat.indexOf(m[0])
            leftovers.push([table, row.id, col, m[0], flat.slice(Math.max(0, at - 60), at + 80)])
          }
        }
      }
    }
  }

  // ---- the backup, before anything is printed as a plan ----
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.writeFileSync(BACKUP, JSON.stringify(backup, null, 2))
  console.log('Backup of every row read: ' + BACKUP + '\n')

  const short = (s) => String(s).length > 260 ? String(s).slice(0, 260) + ' ...' : String(s)
  for (const { table, id, hits } of plan) {
    console.log('\n' + table + '  ' + id)
    for (const [where, from, to] of hits) {
      console.log('  @ ' + where)
      console.log('    - ' + short(from))
      console.log('    + ' + short(to))
    }
  }
  console.log('\n=== ' + plan.length + ' rows, ' + totalFields + ' field changes ===')

  // ---- the education report, asked for explicitly ----
  // The string diffs above show these too, but a structured rewrite is worth
  // reading as a table: four fields move together and one of them is cleared,
  // which is not obvious from a line of JSON.
  if (schools.length) {
    console.log('\n=== EDUCATION: ' + schools.length + ' entr' + (schools.length === 1 ? 'y' : 'ies') + ' rewritten ===')
    for (const s of schools) {
      console.log('\n' + s.table + ' ' + s.id + '  ' + s.col + '.education[' + s.index + ']')
      console.log('  today: ' + summariseEducation(s.before))
      console.log('  after: ' + summariseEducation(s.after))
    }
    // Said out loud because 'keep any existing graduation year' has nothing to
    // keep on this account, and a silent null is the kind of thing somebody
    // later reads as a bug in this script.
    const withYear = schools.filter(s => s.before.graduationDate)
    console.log(
      withYear.length
        ? '\n' + withYear.length + ' of these carried a graduation date, and it is preserved.'
        : '\nNone of these carried a graduation date, so there is none to preserve.'
    )
  } else {
    console.log('\n=== EDUCATION: no entry matched ' + EDUCATION_MATCH + ' ===')
  }

  if (leftovers.length) {
    console.log('\n!!! ' + leftovers.length + ' LEFTOVER NEEDLES after substitution:')
    for (const [table, id, col, needle, ctx] of leftovers) {
      console.log('  ' + table + '.' + col + ' [' + needle + '] ' + id)
      console.log('      ...' + ctx + '...')
    }
  } else {
    console.log('Leftover scan: clean.')
  }

  // ---- the thumbnail plan, listed whether or not it will run ----
  const thumbnails = planThumbnails(backup.resumes)
  console.log('\n=== THUMBNAILS (' + THUMB_BUCKET + ', a PUBLIC bucket) ===')
  for (const t of thumbnails) {
    console.log('\n' + t.id + '  ->  ' + t.action)
    if (t.why) console.log('  ' + t.why)
    if (t.objectPath) console.log('  object: ' + t.objectPath)
  }
  if (!thumbnails.some(t => t.action.startsWith('delete'))) {
    console.log('\nNothing would be deleted from the bucket.')
  }
  console.log('')
  console.log(
    'A stale render is not regenerated here. generateThumbnail() lives'
    + ' inside app/api/resume-coach/data/route.js, is not exported, and the route'
    + ' resolves @/lib through the bundler, so a node script cannot call it.'
  )
  if (!CLEAR_ACTIVE_CORE_THUMB) {
    console.log('The active core (' + ACTIVE_CORE_ID.slice(0, 8) + ') is the one case the'
      + ' app would heal by itself: GET /api/resume-coach/data rebuilds a MISSING'
      + ' thumbnail for the active real core. Pass --clear-active-core-thumb to'
      + ' delete it and let the hub render a new one from the updated resume_data.')
  }

  if (!APPLY) { console.log('\nDRY RUN - nothing written. Pass --apply to write.'); return }
  if (leftovers.length) { console.log('\nRefusing to apply with leftovers outstanding. Fix the rules first.'); return }

  console.log('\nAPPLYING...')
  for (const { table, id, patch } of plan) {
    const { error } = await sb.from(table).update(patch).eq('id', id)
    console.log(error ? '  FAIL ' + table + ' ' + id + ': ' + error.message : '  ok ' + table + ' ' + id)
  }

  console.log('\nTHUMBNAILS...')
  await applyThumbnails(thumbnails)
}

main().catch(e => { console.error('ERR', e.message); process.exit(1) })
