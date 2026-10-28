import { createHash } from 'node:crypto'
import Anthropic from '@anthropic-ai/sdk'

// ============================================================================
// THE COLLECTIVE IMPACT SYNTHESIS
//
// One synthesis per profile, read from every published testimonial on it.
//
// WHY THIS IS A MODULE AND NOT A ROUTE
// Two callers need it: the editor's route, which runs it for the signed-in
// owner, and scripts/backfill-collective-impact.js, which runs it for
// profiles that were finished before anything called it. The script used to
// reach the logic by minting a session for the owner and calling the route
// over HTTP, which meant logging in as somebody to do a job on their behalf.
// Nothing about the synthesis needs a session: it reads rows, calls the
// model, writes one row. So the work lives here, the route is the part that
// decides who is asking, and the script is the part that decides which
// profiles. The prompt, the validation, the hash and the write stay in one
// place, which is what keeps the two callers honest.
//
// WHY ONE SYNTHESIS, NOT ONE PER DIRECTION
// It was briefly written per Career Direction, reading only the testimonials
// that direction showed. That made it almost impossible to have: a profile
// with four testimonials spread over three directions has two on none of
// them, so most directions sat under the minimum and got nothing, and moving
// one testimonial between directions could silently empty a direction's
// reading. What referees say about a person is about the person. Read it all
// together, once, and show that reading wherever the profile is read.
// ============================================================================

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Reading several short passages and naming what recurs across them. Structured
// extraction rather than open writing, so Haiku carries it, with a little
// temperature because the synthesis is prose.
const MODEL = 'claude-haiku-4-5-20251001'
const TEMPERATURE = 0.4

// Two, because this is a synthesis. One testimonial has no patterns across
// it - whatever came back would be that one passage restated, presented as
// something read out of several. Below two there is no Collective Impact at
// all and Firsthand Accounts stands alone in the row.
export const MIN_TESTIMONIALS = 2

// The contract. Everything here is checked before anything is stored.
// The summary range is what two sentences of this register actually run to:
// with no pronouns to carry a clause, the writing is compact, and a floor set
// above that only buys padding.
const SUMMARY_MIN_WORDS = 18
const SUMMARY_MAX_WORDS = 34
const SUMMARY_MAX_SENTENCES = 2
const STATEMENT_MIN_WORDS = 6
const STATEMENT_MAX_WORDS = 14
// Up to three themes, and as few as one. Three is what a well-covered
// profile carries, but what decides it is how many points two referees
// actually both make. A theme that only one passage supports is not written
// at all, so the floor has to be one: with a floor of three, the only way to
// return a legal answer from thinner testimony is to invent the third.
const THEME_COUNT = 3
const THEME_MIN = 1
const THEME_RANGE = { min: THEME_MIN, max: THEME_COUNT }

// A pattern is something more than one person noticed. One passage saying a
// thing is that passage's account of it, and Firsthand already prints that
// in the referee's own words. This section exists to say what recurs, so a
// statement rests on two passages or it is not a finding this section is
// entitled to make.
const MIN_SOURCES_PER_THEME = 2

// The contract is strict on purpose, and a first pass misses it on length or on
// a stray pronoun often enough that giving up immediately would throw away a
// result one correction would have fixed. Each retry is told what went wrong,
// so it is a correction rather than another guess.
const MAX_ATTEMPTS = 5

// Quoting the testimonials is the one thing this section is not allowed to do.
const QUOTE_MARKS = /["“”]/

// Barred in the prompt for as long as there has been a prompt, and now
// checked, because asking was not enough.
const EM_DASH = /—/

// Every string this stores is rendered as profile copy, and profile copy does
// not narrate the person: not in the first person, not in the third, and not
// by name. What is barred is a pronoun that can stand in for the person,
// which is what turns a summary line into narration.
//
// WHY "THEY", "THEM" AND "THEIR" ARE NOT ON THIS LIST
// They were, and the check could not tell which sense was meant, because
// nothing about the word says. In English those three are the ordinary
// plural for things: strengths, systems, teams, markets, problems. A
// synthesis of several testimonials reaches for a plural constantly, so the
// honest sentence "Names strengths and connects them to career direction"
// was rejected for a pronoun pointing at strengths. On one profile that
// happened on all five attempts and the whole synthesis was lost - not
// because the writing narrated anybody, but because a plural noun had been
// referred to a second time.
//
// A test that fails good writing more often than bad writing is not
// protecting anything. What is left is the set that can only mean a person:
// first person, and gendered third person. Those two are what narration
// actually sounds like here, and a false positive on either is rare enough
// to be worth a retry.
//
// "It" and "its" were never on the list, for the same reason "them" is off
// it now: a system, a process or a method is a legitimate subject, and
// forbidding the word only pushes the sentence into worse English.
//
// The testimonials are exempt and untouched; they are someone else speaking,
// and a referee saying "he" is the whole point of Firsthand.
const PRONOUNS = /\b(he|him|his|she|her|hers|i|me|my|mine|we|us|our|ours)\b/i

// The person's own first name, which the summary may use once and a theme
// statement may not use at all. Escaped, because a display name is whatever
// somebody typed and a bracket in it would otherwise throw here.
const firstNameOf = (ownerName) => String(ownerName || '').trim().split(/\s+/)[0] || ''

function nameUses(text, firstName) {
  if (!firstName) return 0
  const escaped = firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return (text.match(new RegExp(`\\b${escaped}\\b`, 'gi')) || []).length
}

// Tense and sentence openings are asked for in the prompt and no longer
// checked here. The checks were rejecting ordinary English - a summary
// sentence that opens on a noun, a verb that is irregular - and every
// rejection spends an attempt. What is left below is the set of limits that
// are true whatever register the writing arrives in.
const wordCount = (text) => text.split(/\s+/).filter(Boolean).length
const sentenceCount = (text) => (text.match(/[.!?](?:\s|$)/g) || []).length

// ---- THE SAME WORDS IN THE SAME ORDER ----
//
// Two of the checks below ask whether one piece of writing is carrying
// another one's words: a statement restating the summary, and either of them
// lifting a run of words out of a passage. Both questions are the same
// question at different lengths, so both are asked of the same reduction of
// the text - lower case, apostrophes closed up, everything else that is not a
// letter or a digit treated as a space. Comparing anything richer than that
// would let a comma or a capital hide a copy.
const wordsOf = (text) => String(text || '')
  .toLowerCase()
  .replace(/['’]/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .split(' ')
  .filter(Boolean)

// Every run of n consecutive words in a text.
function gramsOf(text, n) {
  const words = wordsOf(text)
  const grams = new Set()
  for (let at = 0; at + n <= words.length; at += 1) {
    grams.add(words.slice(at, at + n).join(' '))
  }
  return grams
}

// Every run of n consecutive words across several texts. A run is only ever
// built inside one text, so a match means that whole run appears in a single
// passage rather than being assembled out of two.
function gramsAcross(texts, n) {
  const grams = new Set()
  for (const text of texts) {
    for (const gram of gramsOf(text, n)) grams.add(gram)
  }
  return grams
}

// The first run of n words this text shares with a set of runs, or null.
function sharedRun(text, grams, n) {
  const words = wordsOf(text)
  for (let at = 0; at + n <= words.length; at += 1) {
    const run = words.slice(at, at + n).join(' ')
    if (grams.has(run)) return run
  }
  return null
}

// A statement exists to add something. Four words of the summary in the same
// order is not a new point, it is the summary again in a shorter box.
const ECHO_WORDS = 4

// Five words of a passage in the same order is the referee's sentence, not a
// reading of it. Short enough to catch a lifted phrase, long enough that an
// ordinary run of plain English - "the way the team works" - is not treated
// as a copy.
const LIFT_WORDS = 5

// What the synthesis was made from, counting the instructions as part of it.
//
// The hash used to be the testimonials alone, which made every prompt change
// invisible: the set had not moved, so the stored row was declared current
// and the new instructions were never run. The prompt is half of what
// produced the writing, so it belongs in the fingerprint of it.
//
// Bump this whenever the prompt or the contract changes in a way that should
// rewrite what is already stored. Every row goes stale at once, and the next
// refresh or backfill regenerates it. 1 was every prompt before this file
// carried a version.
const PROMPT_VERSION = 6

// The fingerprint of what a synthesis was made from: the prompt version,
// then the eligible ids in a stable order, each with its exact stored text.
// What makes a second run cheap and a half-finished one safe to pick up.
export function sourceHashFor(testimonials) {
  const canonical = testimonials
    .map(t => `${t.id} ${t.polished_text}`)
    .sort()
    .join('\n')
  return createHash('sha256').update(`prompt ${PROMPT_VERSION}\n${canonical}`).digest('hex')
}

// ============================================================================
// THE PROMPT
//
// Short on purpose. What stood here before was the scar tissue of every bad
// result it had ever produced: a voice section, a rules section, worked
// repairs, barred words, an example of the failure each rule existed to
// prevent. Each line was written for a real fault, and together they taught
// the model to write like something being marked rather than like somebody
// talking. The stiffness was the instructions, not the model.
//
// So the rules are the few that are load-bearing, and the register is shown
// rather than described: one example of the voice, from a different person,
// which is worth more than a paragraph about warmth.
// ============================================================================
function buildPrompt(testimonials, firstName, correction) {
  const block = testimonials
    .map((t, i) => {
      const context = [t.recipient_title, t.relationship].filter(Boolean).join(', ')
      return [
        `[${i + 1}] id: ${t.id}`,
        context ? `who they are: ${context}` : null,
        `what they wrote: ${t.polished_text}`
      ].filter(Boolean).join('\n')
    })
    .join('\n\n')

  // The prompt is written around a name and reads badly without one, and
  // nothing upstream promises the profile has a display name on it.
  const name = firstName || 'this person'

  return `Below are testimonials people wrote about ${name}. Write a short synthesis of what they say, the way a perceptive colleague would sum it up for someone deciding whether to work with ${name}.

TESTIMONIALS:

${block}

Return only valid JSON in this shape:
{
  "summary": "two sentences, ${SUMMARY_MIN_WORDS} to ${SUMMARY_MAX_WORDS} words",
  "themes": [
    { "label": "2 to 5 words, internal only", "statement": "${STATEMENT_MIN_WORDS} to ${STATEMENT_MAX_WORDS} words", "testimonial_ids": ["ids this came from"] }
  ]
}

How to write it:
- Name the qualities that come up across several testimonials and would be true in any role ${name} is considered for. Leave out details that belong to one person's project.
- Summary: two plain, warm sentences. Use ${name}'s first name once, at most. Do not use he, she, him, her, his or hers. The second sentence can describe what people experience working with ${name}.
- Themes: ${THEME_RANGE.min} to ${THEME_RANGE.max}, strongest first. Each is a short line that opens with a present-tense verb and says one thing. Each must be supported by at least ${MIN_SOURCES_PER_THEME} testimonials; list their ids exactly. Only include as many as the testimonials genuinely support.
- When you refer to the people who wrote these, you may say people, others, or name the relationships listed above, combined where several apply (for example, clients and colleagues). Only name a relationship that appears in the list. Vary the wording rather than repeating people.
- Use plain words. Write it in your own words; do not copy phrases from the testimonials.
- Prefer everyday words. Avoid capabilities, leverage, stakeholders, narratives and similar corporate terms.
- Never invent a fact, number, outcome or level of agreement.
- No quotation marks. No em dashes.

Example of the voice (different person, do not reuse its content):
{"summary": "Marcus turns messy operations into something a team can rely on. People describe calm judgment under pressure, plans people can actually follow, and a habit of fixing causes instead of symptoms.",
 "themes": [
  {"label": "root causes", "statement": "Finds the cause of a problem before fixing it.", "testimonial_ids": ["..."]},
  {"label": "clear plans", "statement": "Writes plans a whole team can follow.", "testimonial_ids": ["..."]},
  {"label": "steady", "statement": "Stays steady when a launch goes sideways.", "testimonial_ids": ["..."]}
 ]}${correction ? `

A previous attempt was rejected because ${correction}. Fix that and return the whole structure again.` : ''}`
}

function parseGenerated(rawText) {
  let json = String(rawText || '').trim()
  if (json.startsWith('```')) {
    json = json.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  }
  return JSON.parse(json)
}

// What is wrong with a string, phrased so it can be handed straight back to
// the model as a correction. Null when nothing is wrong. These are the marks
// and the words that are wrong in any register, which is why they are still
// checked when the stylistic rules are not.
function voiceFault(text) {
  if (QUOTE_MARKS.test(text)) return 'it contains quotation marks'
  if (EM_DASH.test(text)) return 'it contains an em dash'

  const pronoun = text.match(PRONOUNS)
  if (pronoun) return `it uses the pronoun "${pronoun[0]}"`

  return null
}

// Every string that will be rendered has to clear the voice rules and its own
// length, and every testimonial id has to exist in the set actually supplied,
// so an id the model invented can never reach the table. A partial result is
// worse than none: it would half fill the section and look finished.
//
// Returns the validated result, or the reason it was rejected. Never both.
function validateGenerated(parsed, allowedIds, firstName, themeRange, sourceGrams) {
  const fail = (reason) => ({ value: null, reason })

  const summary = typeof parsed?.summary === 'string' ? parsed.summary.trim() : ''
  if (!summary) return fail('the summary was missing')

  const summaryFault = voiceFault(summary)
  if (summaryFault) return fail(`the summary "${summary}" broke the rules: ${summaryFault}`)

  const words = wordCount(summary)
  if (words < SUMMARY_MIN_WORDS) {
    return fail(`the summary was ${words} words, under the ${SUMMARY_MIN_WORDS} word minimum`)
  }
  if (words > SUMMARY_MAX_WORDS) {
    return fail(`the summary was ${words} words, over the ${SUMMARY_MAX_WORDS} word maximum`)
  }
  if (sentenceCount(summary) > SUMMARY_MAX_SENTENCES) {
    return fail(`the summary ran past ${SUMMARY_MAX_SENTENCES} sentences`)
  }

  // The summary may say the name once. A second use is the section talking
  // about somebody rather than summing them up.
  if (nameUses(summary, firstName) > 1) {
    return fail(`the summary uses the name "${firstName}" more than once`)
  }

  const summaryLift = sharedRun(summary, sourceGrams, LIFT_WORDS)
  if (summaryLift) {
    return fail(
      `the summary lifts the phrase "${summaryLift}" from one of the passages. ` +
      'Name the quality in your own words'
    )
  }

  const summaryGrams = gramsOf(summary, ECHO_WORDS)

  const rawThemes = Array.isArray(parsed?.themes) ? parsed.themes : []
  if (rawThemes.length < themeRange.min || rawThemes.length > themeRange.max) {
    return fail(
      themeRange.min === themeRange.max
        ? `there were ${rawThemes.length} themes instead of exactly ${themeRange.max}`
        : `there were ${rawThemes.length} themes, outside the ${themeRange.min} to ${themeRange.max} allowed`
    )
  }

  const themes = []
  for (const theme of rawThemes) {
    // Stored so the schema does not have to change, and so a future editor has
    // something to key on. Never rendered.
    const label = typeof theme?.label === 'string' ? theme.label.trim() : ''
    const statement = typeof theme?.statement === 'string' ? theme.statement.trim() : ''
    if (!label || !statement) return fail('a theme was missing its label or its statement')

    const statementFault = voiceFault(statement)
    if (statementFault) {
      return fail(`the statement "${statement}" broke the rules: ${statementFault}`)
    }

    if (nameUses(statement, firstName) > 0) {
      return fail(
        `the statement "${statement}" uses the name "${firstName}", which belongs ` +
        'only in the summary'
      )
    }

    const statementWords = wordCount(statement)
    if (statementWords < STATEMENT_MIN_WORDS || statementWords > STATEMENT_MAX_WORDS) {
      return fail(
        `the statement "${statement}" was ${statementWords} words, outside the ` +
        `${STATEMENT_MIN_WORDS} to ${STATEMENT_MAX_WORDS} word range`
      )
    }

    // A theme is owed something the summary has not already said, and this
    // is the version of that rule a machine can check.
    const echo = sharedRun(statement, summaryGrams, ECHO_WORDS)
    if (echo) {
      return fail(
        `the statement "${statement}" repeats the summary: both contain ` +
        `"${echo}". A statement has to add something the summary has not said`
      )
    }

    const lift = sharedRun(statement, sourceGrams, LIFT_WORDS)
    if (lift) {
      return fail(
        `the statement "${statement}" lifts the phrase "${lift}" from one of ` +
        'the passages. Name the quality in your own words'
      )
    }

    const ids = Array.isArray(theme?.testimonial_ids)
      ? [...new Set(theme.testimonial_ids.filter(id => allowedIds.has(id)))]
      : []
    // A pattern has to be one that more than one referee actually made. The
    // whole result is rejected and the model is told which statement was
    // short, rather than the statement being dropped here: the range allows
    // as few as one theme, so returning fewer is an answer it can give.
    if (ids.length < MIN_SOURCES_PER_THEME) {
      return fail(
        `the statement "${statement}" cited ${ids.length} valid testimonial ids, ` +
        `under the ${MIN_SOURCES_PER_THEME} required`
      )
    }

    themes.push({ label, statement, testimonial_ids: ids })
  }

  return { value: { summary, themes }, reason: null }
}

async function generate(eligible, allowedIds, ownerName) {
  const firstName = firstNameOf(ownerName)
  // Built once rather than per attempt: the passages do not change between
  // tries, only the writing being checked against them.
  const sourceGrams = gramsAcross(eligible.map(t => t.polished_text), LIFT_WORDS)
  let correction = null

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1200,
      temperature: TEMPERATURE,
      messages: [{ role: 'user', content: buildPrompt(eligible, firstName, correction) }]
    })

    let parsed
    try {
      parsed = parseGenerated(message.content?.[0]?.text)
    } catch (parseFailure) {
      console.error(`[collective-impact] Attempt ${attempt} returned unusable JSON:`, parseFailure)
      correction = 'the response was not valid JSON'
      continue
    }

    const { value, reason } = validateGenerated(parsed, allowedIds, firstName, THEME_RANGE, sourceGrams)
    if (value) return value

    console.error(`[collective-impact] Attempt ${attempt} rejected: ${reason}`)
    correction = reason
  }

  return null
}

// Every published testimonial on the profile that actually has words in it,
// oldest first. No placement query and no direction filter: the synthesis is
// of the person, and every direction shows the same one.
export async function eligibleTestimonials(supabase, profileId) {
  const { data, error } = await supabase
    .from('profile_testimonials')
    .select('id, polished_text, recipient_title, relationship')
    .eq('profile_id', profileId)
    .eq('status', 'published')
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data || []).filter(t => String(t?.polished_text || '').trim())
}

// ============================================================================
// THE WHOLE JOB, FOR ONE PROFILE
//
// Reads the testimonials, decides whether anything needs doing, generates and
// writes the profile-wide row. `supabase` is a service-role client: whoever
// is asking has already been established by the caller, and nothing below
// checks again.
//
// Returns one of:
//   { status: 'not_enough', eligible }   under the minimum, nothing written
//   { status: 'unchanged',  eligible }   the stored row was made from this set
//   { status: 'dry-run',    eligible }   would have generated; did not
//   { status: 'written',    eligible, impact }
// and throws on a database failure or a generation that never cleared the
// contract, so a caller can report one profile and carry on to the next.
// ============================================================================
export async function synthesiseProfile(supabase, { profileId, userId, ownerName = '', dryRun = false }) {
  const eligible = await eligibleTestimonials(supabase, profileId)

  if (eligible.length < MIN_TESTIMONIALS) {
    return { status: 'not_enough', eligible: eligible.length }
  }

  // ---- NOTHING HAS CHANGED ----
  //
  // source_hash is the ids and the words they carry. The triggers that reach
  // this fire on anything that could alter the set, which includes plenty
  // that does not, so the cheap question is asked before the expensive one.
  const hash = sourceHashFor(eligible)
  const { data: already, error: readError } = await supabase
    .from('profile_collective_impacts')
    .select('id, source_hash')
    .eq('profile_id', profileId)
    .is('lens_id', null)
    .maybeSingle()

  if (readError) throw readError
  if (already?.source_hash && already.source_hash === hash) {
    return { status: 'unchanged', eligible: eligible.length }
  }

  if (dryRun) return { status: 'dry-run', eligible: eligible.length }

  const allowedIds = new Set(eligible.map(t => t.id))
  const generated = await generate(eligible, allowedIds, ownerName)
  if (!generated) throw new Error('the synthesis never cleared the contract')

  // ---- STORE ----
  // One current row per profile, with no direction on it. The uniqueness is a
  // partial unique index and ON CONFLICT cannot infer one, so the row is
  // replaced by deleting and inserting, scoped to lens_id is null so that a
  // per-direction row left over from the brief period when those were
  // generated is neither read nor disturbed.
  const now = new Date().toISOString()
  const row = {
    profile_id: profileId,
    user_id: userId,
    lens_id: null,
    summary: generated.summary,
    themes: generated.themes,
    testimonial_ids: eligible.map(t => t.id),
    testimonial_order: [],
    source_hash: hash,
    generated_at: now,
    updated_at: now
  }

  const { error: clearError } = await supabase
    .from('profile_collective_impacts')
    .delete()
    .eq('profile_id', profileId)
    .is('lens_id', null)

  if (clearError) throw clearError

  const { data: stored, error: writeError } = await supabase
    .from('profile_collective_impacts')
    .insert(row)
    .select('id, lens_id, summary, themes, testimonial_ids, testimonial_order, source_hash, generated_at')
    .maybeSingle()

  if (writeError) throw writeError

  return { status: 'written', eligible: eligible.length, impact: stored }
}
