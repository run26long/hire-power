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

// Two is the floor for a theme to be recurring rather than one opinion
// restated. Below it there is no Collective Impact and Firsthand stands alone.
const MIN_TESTIMONIALS = 2

// The contract. Everything here is checked before anything is stored.
// The summary range is what two sentences of this register actually run to:
// with no pronouns to carry a clause, the writing is compact, and a floor set
// above that only buys padding.
const SUMMARY_MIN_WORDS = 22
const SUMMARY_MAX_WORDS = 34
const SUMMARY_MAX_SENTENCES = 2
const STATEMENT_MIN_WORDS = 6
const STATEMENT_MAX_WORDS = 12
const THEME_COUNT = 3
const MIN_SOURCES_PER_THEME = 2

// The contract is strict on purpose, and a first pass misses it on length or on
// a stray pronoun often enough that giving up immediately would throw away a
// result one correction would have fixed. Each retry is told what went wrong,
// so it is a correction rather than another guess.
const MAX_ATTEMPTS = 3

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

const wordCount = (text) => text.split(/\s+/).filter(Boolean).length
const sentenceCount = (text) => (text.match(/[.!?](?:\s|$)/g) || []).length

// ============================================================================
// POST /api/career-profile/collective-impact
//
// Synthesises the profile's published testimonials into one short editorial
// summary and three supporting statements, and stores the result.
//
// The model is given the testimonials and nothing else: no resume, no bio, no
// experience, no proof points. What it returns therefore cannot be grounded in
// anything the referees did not actually say, which is the point of the
// section.
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

function buildPrompt(testimonials, ownerName, correction) {
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

  return `You are reading what several people wrote about one person's work, and naming what recurs across them.

These are the only testimonials, and they are all you have. No resume, no biography, no list of achievements. Everything you write comes from the passages below, and a point only counts if it genuinely appears in more than one of them.

TESTIMONIALS:

${block}

Return this exact structure:
{
  "summary": "${SUMMARY_MIN_WORDS} to ${SUMMARY_MAX_WORDS} words, at most ${SUMMARY_MAX_SENTENCES} sentences.",
  "themes": [
    {
      "label": "2 to 5 words, used internally and never shown to anyone",
      "statement": "${STATEMENT_MIN_WORDS} to ${STATEMENT_MAX_WORDS} words, shown on the profile.",
      "testimonial_ids": ["the ids of the testimonials this came from"]
    }
  ]
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
- summary: ${SUMMARY_MIN_WORDS} to ${SUMMARY_MAX_WORDS} words, ${SUMMARY_MAX_SENTENCES} sentences at most. Count the words before returning: under ${SUMMARY_MIN_WORDS} is rejected, and two full sentences is usually what it takes to reach the range. Specific to what actually recurs in these passages. No generic praise, and no filler like "lasting improvements that persist".
- themes: exactly ${THEME_COUNT}. Each statement is ${STATEMENT_MIN_WORDS} to ${STATEMENT_MAX_WORDS} words and must add something the summary has not already said. Three restatements of one idea is the failure this rule exists to prevent.
- Each statement must recur across at least ${MIN_SOURCES_PER_THEME} testimonials, and testimonial_ids must list the ids it came from, copied exactly from the ids above.
- label is internal only. It is stored but never displayed, so do not write it as a heading for the statement beneath it.
- Never invent a fact, a number, an outcome, a relationship, or a level of agreement. If the passages do not support a claim, it does not go in.
- Do not quote the testimonials, and do not lightly reword a sentence from one.
- Do not open with boilerplate. No "Reviewers agree", no "Across these testimonials", no "Colleagues consistently". Start on the substance.
- Do not use em dashes. Use commas, periods, or semicolons instead.
${correction ? `
A previous attempt was rejected because ${correction}. Fix exactly that, leave the rest of the voice and the rules intact, and return the whole structure again.
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
function validateGenerated(parsed, allowedIds, ownerName) {
  const fail = (reason) => ({ value: null, reason })

  const summary = typeof parsed?.summary === 'string' ? parsed.summary.trim() : ''
  if (!summary) return fail('the summary was missing')

  const summaryFault = voiceFault(summary, ownerName)
  if (summaryFault) return fail(`the summary broke the voice rules: ${summaryFault}`)

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

  const rawThemes = Array.isArray(parsed?.themes) ? parsed.themes : []
  if (rawThemes.length !== THEME_COUNT) {
    return fail(`there were ${rawThemes.length} themes instead of exactly ${THEME_COUNT}`)
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
    // A point standing on one voice is not something several people noticed.
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
  let correction = null

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1200,
      temperature: TEMPERATURE,
      messages: [{ role: 'user', content: buildPrompt(eligible, ownerName, correction) }]
    })

    let parsed
    try {
      parsed = parseGenerated(message.content?.[0]?.text)
    } catch (parseFailure) {
      console.error(`[collective-impact] Attempt ${attempt} returned unusable JSON:`, parseFailure)
      correction = 'the response was not valid JSON'
      continue
    }

    const { value, reason } = validateGenerated(parsed, allowedIds, ownerName)
    if (value) return value

    console.error(`[collective-impact] Attempt ${attempt} rejected: ${reason}`)
    correction = reason
  }

  return null
}

export async function POST(request) {
  try {
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
    const generated = await generate(eligible, allowedIds, ownerName)
    if (!generated) return Response.json({ error: 'GENERATION_FAILED' }, { status: 502 })

    // ---- STORE ----
    // One current result per profile, so this is an upsert on profile_id.
    const now = new Date().toISOString()
    const { data: stored, error: writeError } = await supabase
      .from('profile_collective_impacts')
      .upsert(
        {
          profile_id: profile.id,
          user_id: userId,
          summary: generated.summary,
          themes: generated.themes,
          testimonial_ids: eligible.map(t => t.id),
          source_hash: sourceHashFor(eligible),
          generated_at: now,
          updated_at: now
        },
        { onConflict: 'profile_id' }
      )
      .select('id, summary, themes, testimonial_ids, source_hash, generated_at')
      .maybeSingle()

    if (writeError) {
      console.error('[collective-impact] Write failed:', writeError)
      return Response.json({ error: 'GENERATION_FAILED' }, { status: 500 })
    }

    return Response.json({ collectiveImpact: stored })
  } catch (error) {
    return apiError(error, "We couldn't build the collective impact right now. Please try again.")
  }
}
