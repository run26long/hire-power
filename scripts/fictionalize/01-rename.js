// ============================================================================
// STEP 1 - REPLACE THE REAL IDENTITY
//
// Sweeps every table this profile reaches and replaces the person, their three
// employers, and the geography that went with them. Dry run by default; writes
// only with --apply, and refuses to apply while the leftover scan is dirty.
//
// THINGS THIS GOT WRONG THE FIRST TIME, NOW GUARDED
//
// A generic "Florida -> North Carolina" rule produces "University of South
// North Carolina" and "the Carolinas Manufacturer Lands Defense Contracts". The
// specific forms are listed ahead of the generic one for that reason, and the
// same applies to "an Oshkosh company" and "Oshkosh AeroTech".
//
// Rules were case-sensitive, and the raw coaching transcript is not: the owner
// typed "at mbf and madstad". Lowercase variants are listed and stay lowercase,
// so a transcript still reads like something a person wrote.
//
// URL slugs are text too. "florida-general-contractor-license" through a rule
// producing "north carolina" puts a space inside a URL, so hyphenated forms are
// handled before the plain one.
//
// The five INACTIVE resumes on this account belong to an entirely different
// test persona ("Marcus Rivera", Tampa FL) and nothing on the profile reads
// them. Sweeping them corrupted unrelated fixtures, so resumes are scoped to
// is_active. The tailored resume also carries the old identity in six columns
// beyond resume_data, including the coaching transcript and the target job ad.
//
// career_knowledge.content_key is NOT swept. It is derived from content and
// backs the unique index (user_id, content_key), so it is regenerated with the
// app's own function - the only way the two cannot drift.
//
// EMAILS ARE DELIBERATELY UNTOUCHED. profiles.email mirrors auth.users, and
// rewriting it would break sign-in on an account somebody actually uses.
// ============================================================================

const fs = require('fs')
const path = require('path')
const { sb, PROFILE_ID, USER_ID, APPLY, OUT_DIR } = require('./_env')

// Order matters: the specific forms must precede the general ones.
const RULES = [
  // --- employers ---
  [/Disruptor Manufacturing/g, 'Apex Manufacturing'],
  [/MBF Industries/g, 'Trident Industrial'],
  [/Madstad Engineering/g, 'Keystone Systems'],
  [/\bDisruptor\b/g, 'Apex'],
  [/\bMBF\b/g, 'Trident'],
  [/\bMadstad\b/g, 'Keystone'],
  [/\bdisruptor\b/g, 'apex'],
  [/\bmbf\b/g, 'trident'],
  [/\bmadstad\b/g, 'keystone'],

  // --- person ---
  [/James Long/g, 'Daniel Mercer'],
  [/\bJames\b/g, 'Daniel'],
  [/\bLong\b/g, 'Mercer'],
  [/\bjames\b/g, 'daniel'],
  [/jameslong/g, 'danielmercer'],

  // --- a real third party named in this account's metadata ---
  [/oshkoshcorp\.com/gi, 'vanguardvehicle.com'],
  [/\ban Oshkosh company\b/g, 'a Vanguard company'],
  [/\bOshkosh AeroTech\b/g, 'Vanguard AeroTech'],
  [/\bOshkosh Corporation\b/g, 'Vanguard Vehicle Group'],
  [/\bOshkosh\b/g, 'Vanguard Vehicle Group'],

  // --- geography: named institutions, then slugs, then plain words ---
  [/University of South Florida/g, 'University of North Carolina at Charlotte'],
  [/Central Florida Manufacturer/g, 'North Carolina Manufacturer'],
  [/Orlando Business Journal/g, 'Charlotte Business Journal'],
  [/Florida General Contractor License/g, 'North Carolina General Contractor License'],
  [/Florida DBPR/g, 'NC Licensing Board'],
  [/Lake Mary, FL/g, 'Charlotte, NC'],
  [/\bLake Mary\b/g, 'Charlotte'],
  [/Sanford, FL/g, 'Concord, NC'],
  [/\bSanford\b/g, 'Concord'],
  [/Brooksville, FL/g, 'Hickory, NC'],
  [/\bBrooksville\b/g, 'Hickory'],
  [/Orlando, FL/g, 'Charlotte, NC'],
  [/\bOrlando\b/g, 'Charlotte'],
  [/Central Florida/g, 'the Carolinas'],
  [/\bcentral-florida\b/g, 'north-carolina'],
  [/\bflorida-/g, 'north-carolina-'],
  [/-florida\b/g, '-north-carolina'],
  [/\bFlorida\b/g, 'North Carolina'],
  [/\blake mary\b/g, 'charlotte'],
  [/\bsanford\b/g, 'concord'],
  [/\bbrooksville\b/g, 'hickory'],
  [/\borlando\b/g, 'charlotte'],
  [/\bflorida\b/g, 'north carolina'],

  // Area code follows the move; 555-01xx is the reserved fictional range.
  [/321-696-5411/g, '704-555-0142']
]

const sub = (s) => RULES.reduce((acc, [re, to]) => acc.replace(re, to), s)

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

const TARGETS = [
  { table: 'profiles', filter: q => q.eq('id', USER_ID), cols: ['display_name'] },
  { table: 'career_profiles', filter: q => q.eq('id', PROFILE_ID), cols: ['imow_text'] },
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
    table: 'resumes', filter: q => q.eq('user_id', USER_ID).eq('is_active', true),
    cols: ['display_name', 'resume_data', 'coaching_conversation', 'ai_analysis',
      'rewritten_resume', 'resume_changes', 'job_company', 'job_description', 'captured_data']
  }
]

// Referees get new identities rather than substituted strings.
const REFEREES = {
  'Ray Okonkwo': 'Marcus Adeyemi',
  'Dana Whitfield': 'Dana Kessler',
  'Marcus Feld': 'Priya Raghavan',
  'Tomas Reyes': 'Tomas Duarte',
  'Ellen Vasquez': 'Ellen Brightwater'
}

// Scanned against the RESULT of every swept field. A hit means a rule missed.
const LEFTOVERS = [
  /\bJames\b/, /\bLong\b/, /disruptor/i, /\bmbf\b/i, /madstad/i, /oshkosh/i,
  /lake mary/i, /\bsanford\b/i, /brooksville/i, /\borlando\b/i, /\bflorida\b/i,
  /, FL\b/, /jameslong/i, /321-696/
]

// Copied verbatim from app/api/career-knowledge/route.js
const buildContentKey = (content) => String(content)
  .toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()

async function main() {
  const backup = {}
  const plan = []
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
      if (table === 'profile_testimonials' && REFEREES[row.recipient_name]) {
        hits.push(['recipient_name (identity swap)', row.recipient_name, REFEREES[row.recipient_name]])
        patch.recipient_name = REFEREES[row.recipient_name]
      }
      // Derived, never substituted.
      if (table === 'career_knowledge') {
        const content = 'content' in patch ? patch.content : row.content
        const key = buildContentKey(content)
        if (key !== row.content_key) {
          hits.push(['content_key (regenerated)', row.content_key, key])
          patch.content_key = key
        }
      }
      if (Object.keys(patch).length) { plan.push({ table, id: row.id, patch, hits }); totalFields += hits.length }

      for (const col of cols) {
        if (!(col in row) || row[col] === null) continue
        const after = col in patch ? patch[col] : row[col]
        const flat = typeof after === 'string' ? after : JSON.stringify(after)
        for (const re of LEFTOVERS) {
          const m = flat.match(re)
          if (m) leftovers.push([table, row.id, col, m[0], flat.slice(Math.max(0, flat.indexOf(m[0]) - 60), flat.indexOf(m[0]) + 80)])
        }
      }
    }
  }

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.writeFileSync(path.join(OUT_DIR, 'rename-backup.json'), JSON.stringify(backup, null, 2))

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

  if (leftovers.length) {
    console.log('\n!!! ' + leftovers.length + ' LEFTOVER NEEDLES after substitution:')
    for (const [table, id, col, needle, ctx] of leftovers) {
      console.log('  ' + table + '.' + col + ' [' + needle + '] ' + id)
      console.log('      ...' + ctx + '...')
    }
  } else {
    console.log('Leftover scan: clean.')
  }

  if (!APPLY) { console.log('DRY RUN - nothing written. Pass --apply to write.'); return }
  if (leftovers.length) { console.log('Refusing to apply with leftovers outstanding. Fix the rules first.'); return }

  console.log('APPLYING...')
  for (const { table, id, patch } of plan) {
    const { error } = await sb.from(table).update(patch).eq('id', id)
    console.log(error ? '  FAIL ' + table + ' ' + id + ': ' + error.message : '  ok ' + table + ' ' + id)
  }
}

main().catch(e => { console.error('ERR', e.message); process.exit(1) })
