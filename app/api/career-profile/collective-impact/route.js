import { createHash } from 'node:crypto'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { apiError } from '@/lib/apiError'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Reading several short passages and naming what recurs across them. Structured
// extraction rather than open writing, so Haiku carries it, with a little
// temperature because the synthesis is prose.
const MODEL = 'claude-haiku-4-5-20251001'
const TEMPERATURE = 0.4

// One published testimonial is enough to have something to say. Below that
// there is no Collective Impact and Firsthand stands alone.
const MIN_TESTIMONIALS = 1

// The contract. Everything here is checked before anything is stored.
// The summary range is what two sentences of this register actually run to:
// with no pronouns to carry a clause, the writing is compact, and a floor set
// above that only buys padding.
//
// The floor was 22, which was calibrated on a broad reading of a whole career.
// A direction that reads narrowly - one subject, one kind of evidence - says
// what it has to say in fewer words than that, and was being rejected for
// being exactly as tight as it should be. 18 is the floor that still refuses a
// one-line platitude without taxing a focused reading.
const SUMMARY_MIN_WORDS = 18
const SUMMARY_MAX_WORDS = 34
const SUMMARY_MAX_SENTENCES = 2
const STATEMENT_MIN_WORDS = 6
const STATEMENT_MAX_WORDS = 12
// Three themes where there is testimony enough to carry three. On a single
// passage, as many as that passage genuinely makes - splitting one idea three
// ways to reach a number is the failure this range exists to avoid.
const THEME_COUNT = 3
const THEME_MIN_SINGLE_SOURCE = 1

// How many themes are owed, given how much testimony there is.
const themeRangeFor = (sourceCount) => sourceCount <= 1
  ? { min: THEME_MIN_SINGLE_SOURCE, max: THEME_COUNT }
  : { min: THEME_COUNT, max: THEME_COUNT }
// A theme has to stand on something that was actually written, and that is the
// whole of the requirement. There is deliberately no floor on how many
// different voices a set of themes draws on: asking for two was pulling a
// reading off its own ground and back onto whatever another passage happened
// to be about, which is the opposite of reading for a direction. Where one
// passage carries the strongest relevant evidence, all three themes may cite
// it.
const MIN_SOURCES_PER_THEME = 1

// The contract is strict on purpose, and a first pass misses it on length or on
// a stray pronoun often enough that giving up immediately would throw away a
// result one correction would have fixed. Each retry is told what went wrong,
// so it is a correction rather than another guess.
// Reading through a direction raises the miss rate: a passage about clients
// invites "they", and the contract bars it even where it points at something
// other than the person. The correction fixes it, but it takes more than three
// tries often enough to be worth the ceiling.
const MAX_ATTEMPTS = 5

// Quoting the testimonials is the one thing this section is not allowed to do.
const QUOTE_MARKS = /["“”]/

// Every string this route stores is rendered as profile copy, and profile copy
// does not narrate the person: not in the first person, not in the third, and
// not by name. What is barred is a pronoun standing in for the person, which is
// what turns a summary line into narration. "It" and "its" are not on the list:
// a system, a process or a method is a legitimate subject, and forbidding the
// word only pushes the sentence into worse English. The testimonials are exempt
// and untouched; they are someone else speaking, and a referee saying "he" is
// the whole point of Firsthand.
const PRONOUNS = /\b(he|him|his|she|her|hers|they|them|their|theirs|i|me|my|mine|we|our|ours|us)\b/i
const STAND_INS = /\b(this (executive|professional|leader|candidate|individual)|the (candidate|individual))\b/i

// Present tense, checked rather than asked for. The voice drops the subject,
// so the first word of every sentence is the verb, and a third person present
// verb ends in s: "Rebuilds", "Opens", "Develops". A lead ending in "ed", or
// any lead that is not a present verb, is the section narrating a career
// instead of naming a capability.
const leadWords = (text) => text
  .split(/(?<=[.!?])\s+/)
  .map(part => (part.trim().match(/^[A-Za-z']+/) || [''])[0])
  .filter(Boolean)

// The opening claim of a summary, reduced to the few words that carry it.
// Measured and logged, never enforced: two directions may honestly arrive at
// the same lead, because the strongest reading of the same testimony is
// sometimes the same reading. Rejecting on this made a direction fail for
// resembling a sibling, which made regeneration depend on the order the
// directions were written in and would have meant deleting a good row to let
// another one through. Relevance decides; difference is earned or it is not
// there to have.
const LEAD_STOP = new Set([
  'the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'on', 'for', 'with', 'that',
  'while', 'than', 'rather', 'through', 'by', 'into', 'before', 'after', 'so'
])
const LEAD_WORDS = 4

function leadSignature(text) {
  const first = String(text || '').split(/(?<=[.!?])\s/)[0] || ''
  return (first.toLowerCase().match(/[a-z]+/g) || [])
    .filter(word => !LEAD_STOP.has(word))
    .slice(0, LEAD_WORDS)
}

const wordCount = (text) => text.split(/\s+/).filter(Boolean).length
const sentenceCount = (text) => (text.match(/[.!?](?:\s|$)/g) || []).length

// ============================================================================
// POST /api/career-profile/collective-impact
// Body: { lensId?: string }
//
// Synthesises the profile's published testimonials into one short editorial
// summary and three supporting statements, and stores the result.
//
// The model is given the testimonials and nothing else: no resume, no bio, no
// experience, no proof points. What it returns therefore cannot be grounded in
// anything the referees did not actually say, which is the point of the
// section.
//
// With a lensId in the body it writes for one direction instead of the
// profile. The direction's name and positioning go in, but they are a vantage
// point and never a source: they decide which of the recurring material leads
// and how the testimonials are ranked, and nothing may be claimed that the
// passages do not already say. The same testimonials read through a different
// direction should come out as genuinely different writing, not the same
// writing with a few nouns exchanged - but every claim in it is still one the
// passages make.
//
// A direction also returns an order for the testimonials: ids only, most
// relevant first. They are never copied, rewritten or summarised for a
// direction; only the order they are read in changes.
//
// The testimonials are never written to. This route reads them and writes one
// row of its own.
// ============================================================================

// The fingerprint of what a synthesis was made from: the eligible ids in a
// stable order, each with its exact stored text. Stored rather than acted on,
// so a later testimonial write path can tell that a stored synthesis has gone
// stale without having to guess.
function sourceHashFor(testimonials) {
  const canonical = testimonials
    .map(t => `${t.id} ${t.polished_text}`)
    .sort()
    .join('\n')
  return createHash('sha256').update(canonical).digest('hex')
}

function buildPrompt(testimonials, ownerName, correction, direction, themeRange) {
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

  // A vantage point, written into the prompt as one. Everything in it steers
  // selection and emphasis; none of it is allowed to become a claim.
  const directionBlock = direction
    ? `
THE DIRECTION YOU ARE READING FOR: ${direction.name}${direction.positioning ? `
How this direction is positioned: ${direction.positioning}` : ''}

This is a vantage point, not a source. It says which passages to read closely and what to lead with. It says nothing about the person, and not one word of it may appear as a claim. Where the direction suggests something the passages do not say, it does not go in: the passages win every time.

Before drafting anything, do this and do it properly:

1. Read each passage on its own against ${direction.name}. Ask what that passage is direct evidence of, in its own words.
2. Name the strongest evidence in these passages for ${direction.name} specifically. Not the most impressive thing in them and not the largest number in them - the thing a reader who came here for ${direction.name} needs to know. The most striking passage in the set is very often not the most relevant one to this direction, and choosing it because it is striking is the commonest way this goes wrong.

   Where one passage is clearly the best evidence for ${direction.name}, that passage is the spine of the whole reading: the summary and every statement come off it, and the others are used only where they genuinely add to that same story. Three statements resting on one passage is a correct outcome when that passage is where this direction's evidence lives. Reaching into an unrelated passage so that another name appears in the sources is not.
3. Choose the story that evidence most strongly tells for ${direction.name} and commit to it. If the strongest honest reading for this direction is much the same as it would be for another, write it anyway: a reading is worth having because it is true and relevant, not because it differs from somebody else's.
4. Draft the summary and all three statements from that evidence alone.

The passages usually carry more than one kind of evidence: delivery and defect and output evidence is not the same evidence as opening markets, and neither is the same as teaching a person to do the work and promoting them. Lead with the kind that belongs to ${direction.name}, and stay on it - do not wander into another kind merely to bring in another name.

What it cannot change: the facts, or the voice. The same passages are the only evidence whichever direction is reading. Writing for a direction is not a licence for a pronoun; the voice rules below govern every string exactly as they would otherwise.
`
    : ''

  const orderField = direction
    ? `,
  "testimonial_order": ["every testimonial id above, most relevant to ${direction.name} first"]`
    : ''

  return `You are reading what several people wrote about one person's work, and naming what recurs across them.

These are the only testimonials, and they are all you have. No resume, no biography, no list of achievements. Everything you write comes from the passages below, and a point only counts if it genuinely appears in more than one of them.
${directionBlock}
TESTIMONIALS:

${block}

Return this exact structure:
{
  "summary": "${SUMMARY_MIN_WORDS} to ${SUMMARY_MAX_WORDS} words, at most ${SUMMARY_MAX_SENTENCES} sentences.",
  "themes": [   // ${themeRange.min === themeRange.max ? themeRange.max : `${themeRange.min} to ${themeRange.max}`} of these
    {
      "label": "2 to 5 words, used internally and never shown to anyone",
      "statement": "${STATEMENT_MIN_WORDS} to ${STATEMENT_MAX_WORDS} words, shown on the profile.",
      "testimonial_ids": ["the ids of the testimonials this came from"]
    }
  ]${orderField}
}

THE VOICE, which governs every string you return:
- Write in the register of a strong professional summary, where a subject pronoun is simply not needed: "Rebuilds production systems rather than patching output." That is the voice. What it must never read as is a sentence with the pronoun deleted out of it.
- No pronoun standing in for the person. Not "he", "him", "his", "she", "her", "they", "them", "their". Not "I", "me", "my", "we", "our", "us".
- "They" is barred even where it refers to something other than the person, because it reads as the narration coming back. Name the thing instead. "It" and "its" are fine where the subject is a system, a process or a method.
- Never the person's name${ownerName ? ` (${ownerName})` : ''} as a narrator.
- No stand-ins either: not "this executive", not "this professional", not "the candidate", not "the individual".
- No quotation marks anywhere.

RULES:
- Every string must be a natural English sentence, read back and checked as one. Dropping the subject pronoun is the only liberty taken with ordinary grammar; everything after the verb is written the way a person would actually write it. "Implements systems that surface problems before cascades start" is the failure this rule exists to prevent: a noun pressed into service as a verb phrase because it was shorter. "Implements systems that expose problems before escalation" is the same point in real English. Prefer the plain noun to the strained one, and never compress a phrase past the point where it still parses.
- One relationship per statement, and it must land on the first reading. Name the thing that is done and what it achieves, then stop. A statement carrying two causal relations at once has no main point and stops meaning anything: where a sentence has both a "before X" clause and a separate "so that Y" or "stops Z" clause competing to be its conclusion, one of them is surplus. Keep the stronger and delete the other, or make them two statements. A worked repair: "Builds forecasting that flags shortages before stockouts halt production lines" carries two endings fighting each other; "Builds forecasting that flags shortages before they reach the line" is the same point with one. Read each statement back once at ordinary speed and ask what it says; if you have to return to the beginning to work that out, rewrite it before returning it.
${direction ? `- The first sentence of the summary is the ${direction.name} story and nothing else: the most relevant thing these passages evidence for this direction.
` : ''}- summary: ${SUMMARY_MIN_WORDS} to ${SUMMARY_MAX_WORDS} words, ${SUMMARY_MAX_SENTENCES} sentences at most. Count the words before returning: under ${SUMMARY_MIN_WORDS} is rejected, and two full sentences is usually what it takes to reach the range. Specific to what actually recurs in these passages. No generic praise, and no filler like "lasting improvements that persist".
- themes: ${themeRange.min === themeRange.max ? `exactly ${themeRange.max}` : `${themeRange.min} to ${themeRange.max}, and only as many as the testimony genuinely carries - one well-supported point is better than three restatements of it`}. Each statement is ${STATEMENT_MIN_WORDS} to ${STATEMENT_MAX_WORDS} words and adds something the summary has not already said${direction ? `, drawn from the same body of ${direction.name} evidence rather than from a different subject` : ''}. Three restatements of one idea is one failure this rule exists to prevent; three statements about three unrelated subjects, only one of which this direction came for, is the other.
- Each statement must be supported by at least ${MIN_SOURCES_PER_THEME} of the passages, and testimonial_ids must list the ids it came from, copied exactly from the ids above.
- There is no requirement to spread the statements across different passages. Cite whichever passages actually support each statement, and where one passage holds the strongest evidence for this direction, let every statement cite that one. Never reach for a weaker, less relevant point merely so another name appears in the sources.
- Present tense, every string. Name the capability the passages demonstrate, do not narrate the career. "Rebuilds production systems", "Opens complex markets", "Develops supervisors into leaders". Never "Rebuilt", "Reduced", "Implemented", "Developed", or any other past-tense lead. This holds for both sentences of the summary and for every statement, and it holds even though the passages themselves are written in the past: a referee recounting what happened is evidence of what this person does.
- label is internal only. It is stored but never displayed, so do not write it as a heading for the statement beneath it.
- Never invent a fact, a number, an outcome, a relationship, or a level of agreement. If the passages do not support a claim, it does not go in.
- Do not quote the testimonials, and do not lightly reword a sentence from one.
- Do not open with boilerplate. No "Reviewers agree", no "Across these testimonials", no "Colleagues consistently". Start on the substance.
- Do not use em dashes. Use commas, periods, or semicolons instead.
${direction ? `- testimonial_order: every id listed above, once each, ids only, copied exactly. Rank independently of the summary and statements you have just written: the order answers a different question, which is what this reader should read first, and it is not obliged to agree with what you chose to lead the synthesis on. Work it out passage by passage. For each one, say in a single phrase what that passage is direct evidence of, then ask how close that phrase sits to the subject of ${direction.name} itself. Rank by that closeness and by nothing else: a passage whose subject simply is the subject of ${direction.name} outranks a passage reporting a larger result in a neighbouring area. Judge each passage on its own rather than comparing them to each other. What decides it is how directly the passage evidences the behaviour at the centre of ${direction.name}. What does not decide it: the order the passages were given in, the size of the numbers in them, how dramatic the outcome sounds, or how senior the person writing is. A passage about coaching, judgement, teaching, influence, promoting someone, or building capability in other people is direct evidence for a leadership reading and ranks accordingly there, even where it carries no figures at all. Where nothing in the passages makes one more relevant than another, return them in the order they were given rather than inventing a ranking.
` : ''}${correction ? `
A previous attempt was rejected because ${correction}. Fix exactly that, leave the rest of the voice and the rules intact, and return the whole structure again.

If the fault was a pronoun: the fix is not a synonym, it is a rewrite. Name the noun the pronoun was standing in for, or recast the clause so no subject is needed. "Systems that surface problems before they cascade" becomes "systems that surface problems before escalation". Read every string back once, word by word, and check each one against the barred list before returning.
` : ''}
Respond with ONLY valid JSON, no markdown, no explanation.`
}

function parseGenerated(rawText) {
  let json = String(rawText || '').trim()
  if (json.startsWith('```')) {
    json = json.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  }
  return JSON.parse(json)
}

// What is wrong with a string's tense, phrased so it can be handed straight
// back as a correction. Null when nothing is wrong.
function tenseFault(text) {
  for (const lead of leadWords(text)) {
    if (/ed$/i.test(lead)) {
      return `it opens a sentence with "${lead}", which is past tense`
    }
    if (!/s$/i.test(lead)) {
      return `it opens a sentence with "${lead}" rather than a present-tense verb`
    }
  }
  return null
}

// What is wrong with a string's voice, phrased so it can be handed straight
// back to the model as a correction. Null when nothing is wrong.
function voiceFault(text, ownerName) {
  if (QUOTE_MARKS.test(text)) return 'it contains quotation marks'

  const pronoun = text.match(PRONOUNS)
  if (pronoun) return `it uses the pronoun "${pronoun[0]}"`

  const standIn = text.match(STAND_INS)
  if (standIn) return `it uses the stand-in "${standIn[0]}"`

  if (ownerName) {
    const first = ownerName.split(/\s+/)[0]
    if (first && first.length > 2 && new RegExp(`\\b${first}\\b`, 'i').test(text)) {
      return 'it names the person being written about'
    }
  }

  return null
}

// Every string that will be rendered has to clear the voice rules and its own
// length, and every testimonial id has to exist in the set actually supplied,
// so an id the model invented can never reach the table. A partial result is
// worse than none: it would half fill the section and look finished.
//
// Returns the validated result, or the reason it was rejected. Never both.
function validateGenerated(parsed, allowedIds, ownerName, direction, themeRange) {
  const fail = (reason) => ({ value: null, reason })

  const summary = typeof parsed?.summary === 'string' ? parsed.summary.trim() : ''
  if (!summary) return fail('the summary was missing')

  const summaryFault = voiceFault(summary, ownerName)
  if (summaryFault) return fail(`the summary "${summary}" broke the voice rules: ${summaryFault}`)

  const words = wordCount(summary)
  if (words < SUMMARY_MIN_WORDS) {
    return fail(`the summary was ${words} words, under the ${SUMMARY_MIN_WORDS} word minimum`)
  }
  if (words > SUMMARY_MAX_WORDS) {
    return fail(`the summary was ${words} words, over the ${SUMMARY_MAX_WORDS} word maximum`)
  }
  const summaryTense = tenseFault(summary)
  if (summaryTense) return fail(`the summary "${summary}" is not in the present tense: ${summaryTense}`)

  if (sentenceCount(summary) > SUMMARY_MAX_SENTENCES) {
    return fail(`the summary ran past ${SUMMARY_MAX_SENTENCES} sentences`)
  }


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

    const statementFault = voiceFault(statement, ownerName)
    if (statementFault) {
      return fail(`the statement "${statement}" broke the voice rules: ${statementFault}`)
    }

    const statementTense = tenseFault(statement)
    if (statementTense) {
      return fail(`the statement "${statement}" is not in the present tense: ${statementTense}`)
    }

    const statementWords = wordCount(statement)
    if (statementWords < STATEMENT_MIN_WORDS || statementWords > STATEMENT_MAX_WORDS) {
      return fail(
        `the statement "${statement}" was ${statementWords} words, outside the ` +
        `${STATEMENT_MIN_WORDS} to ${STATEMENT_MAX_WORDS} word range`
      )
    }

    const ids = Array.isArray(theme?.testimonial_ids)
      ? [...new Set(theme.testimonial_ids.filter(id => allowedIds.has(id)))]
      : []
    // A point has to rest on something that was actually written.
    if (ids.length < MIN_SOURCES_PER_THEME) {
      return fail(
        `the statement "${statement}" cited ${ids.length} valid testimonial ids, ` +
        `under the ${MIN_SOURCES_PER_THEME} required`
      )
    }

    themes.push({ label, statement, testimonial_ids: ids })
  }


  // Ids only, and only ids that were actually supplied, so an id the model
  // invented can never reach the table. A short or missing order is not a
  // failure: the reader appends whatever was left out in its own stable order.
  const order = direction && Array.isArray(parsed?.testimonial_order)
    ? [...new Set(parsed.testimonial_order.filter(id => allowedIds.has(id)))]
    : []

  return { value: { summary, themes, testimonial_order: order }, reason: null }
}

async function generate(eligible, allowedIds, ownerName, direction) {
  // One passage cannot honestly carry three separate points, so how many are
  // owed follows the testimony rather than a constant.
  const themeRange = themeRangeFor(allowedIds.size)
  let correction = null

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1200,
      temperature: TEMPERATURE,
      messages: [{ role: 'user', content: buildPrompt(eligible, ownerName, correction, direction, themeRange) }]
    })

    let parsed
    try {
      parsed = parseGenerated(message.content?.[0]?.text)
    } catch (parseFailure) {
      console.error(`[collective-impact] Attempt ${attempt} returned unusable JSON:`, parseFailure)
      correction = 'the response was not valid JSON'
      continue
    }

    const { value, reason } = validateGenerated(parsed, allowedIds, ownerName, direction, themeRange)
    if (value) return value

    console.error(`[collective-impact] Attempt ${attempt} rejected: ${reason}`)
    correction = reason
  }

  return null
}

export async function POST(request) {
  try {
    // A body is optional: without one this writes the profile-wide synthesis,
    // exactly as it always has.
    let lensId = null
    try {
      const body = await request.json()
      lensId = body?.lensId || null
    } catch {
      lensId = null
    }

    const authHeader = request.headers.get('authorization')
    if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const token = authHeader.replace('Bearer ', '')

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // The profile this writes to comes from the token, never from the body. The
    // service role sees every row, so this is the only thing standing between a
    // profile id and whoever guessed it.
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = user.id

    const [profileRes, ownerRes] = await Promise.all([
      supabase.from('career_profiles').select('id, user_id').eq('user_id', userId).maybeSingle(),
      // Only so the name can be kept out of the copy it is about.
      supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle()
    ])

    if (profileRes.error) {
      console.error('[collective-impact] Profile lookup failed:', profileRes.error)
      return Response.json({ error: 'GENERATION_FAILED' }, { status: 500 })
    }
    const profile = profileRes.data
    if (!profile) return Response.json({ error: 'PROFILE_NOT_FOUND' }, { status: 404 })
    const ownerName = ownerRes.data?.display_name || ''

    // ---- THE DIRECTION, IF THERE IS ONE ----
    // Looked up under this profile's id rather than taken on trust, so a lens
    // id belonging to someone else resolves to nothing.
    let direction = null
    if (lensId) {
      const { data: lens, error: lensError } = await supabase
        .from('profile_lenses')
        .select('id, name, headline')
        .eq('id', lensId)
        .eq('profile_id', profile.id)
        .maybeSingle()

      if (lensError) {
        console.error('[collective-impact] Direction lookup failed:', lensError)
        return Response.json({ error: 'GENERATION_FAILED' }, { status: 500 })
      }
      if (!lens) return Response.json({ error: 'LENS_NOT_FOUND' }, { status: 404 })

      // The headline is how the direction is positioned. It steers what gets
      // read closely; the prompt is explicit that it may not become a claim.
      direction = { id: lens.id, name: lens.name, positioning: lens.headline || '' }
    }

    // ---- THE ONLY INPUT ----
    const { data: testimonials, error: testimonialError } = await supabase
      .from('profile_testimonials')
      .select('id, polished_text, recipient_title, relationship')
      .eq('profile_id', profile.id)
      .eq('status', 'published')
      .order('created_at', { ascending: true })

    if (testimonialError) {
      console.error('[collective-impact] Testimonial lookup failed:', testimonialError)
      return Response.json({ error: 'GENERATION_FAILED' }, { status: 500 })
    }

    const eligible = (testimonials || []).filter(t => String(t?.polished_text || '').trim())
    if (eligible.length < MIN_TESTIMONIALS) {
      return Response.json(
        { error: 'NOT_ENOUGH_TESTIMONIALS', eligible: eligible.length },
        { status: 422 }
      )
    }

    const allowedIds = new Set(eligible.map(t => t.id))
    const generated = await generate(eligible, allowedIds, ownerName, direction)
    if (!generated) return Response.json({ error: 'GENERATION_FAILED' }, { status: 502 })

    // ---- STORE ----
    // One current result per profile per direction, plus one profile-wide row
    // with no direction. Both are enforced by partial unique indexes, and
    // ON CONFLICT cannot infer a partial index, so each is replaced by
    // deleting its own row and inserting - scoped so that writing one
    // direction can never touch another, or the shared row.
    const now = new Date().toISOString()
    const row = {
      profile_id: profile.id,
      user_id: userId,
      lens_id: direction ? direction.id : null,
      summary: generated.summary,
      themes: generated.themes,
      testimonial_ids: eligible.map(t => t.id),
      testimonial_order: generated.testimonial_order || [],
      source_hash: sourceHashFor(eligible),
      generated_at: now,
      updated_at: now
    }

    const scoped = supabase
      .from('profile_collective_impacts')
      .delete()
      .eq('profile_id', profile.id)
    const { error: clearError } = direction
      ? await scoped.eq('lens_id', direction.id)
      : await scoped.is('lens_id', null)

    if (clearError) {
      console.error('[collective-impact] Clear failed:', clearError)
      return Response.json({ error: 'GENERATION_FAILED' }, { status: 500 })
    }

    const { data: stored, error: writeError } = await supabase
      .from('profile_collective_impacts')
      .insert(row)
      .select('id, lens_id, summary, themes, testimonial_ids, testimonial_order, source_hash, generated_at')
      .maybeSingle()

    if (writeError) {
      console.error('[collective-impact] Write failed:', writeError)
      return Response.json({ error: 'GENERATION_FAILED' }, { status: 500 })
    }

    // How close this reading landed to the profile's other directions.
    // Reported, never enforced: two directions may honestly share a lead, and
    // failing on the resemblance would make regeneration depend on the order
    // the directions happened to be written in.
    if (direction) {
      const { data: others } = await supabase
        .from('profile_collective_impacts')
        .select('lens_id, summary')
        .eq('profile_id', profile.id)
        .not('lens_id', 'is', null)
        .neq('lens_id', direction.id)
      const mine = leadSignature(generated.summary)
      for (const other of others || []) {
        const theirs = new Set(leadSignature(other.summary))
        const shared = mine.filter(word => theirs.has(word)).length
        if (shared >= mine.length) {
          console.info(
            `[collective-impact] ${direction.name} opens on the same claim as ` +
            `lens ${other.lens_id}. Allowed: the testimony reads that way for both.`
          )
        }
      }
    }

    return Response.json({ collectiveImpact: stored })
  } catch (error) {
    return apiError(error, "We couldn't build the collective impact right now. Please try again.")
  }
}
