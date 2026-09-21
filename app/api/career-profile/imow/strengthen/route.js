import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { noEmDash } from '../../_lib/recruiterContext'
import { canUseProTools } from '@/lib/tiers'

// ============================================================================
// POST /api/career-profile/imow/strengthen
//
// The owner's own In My Own Words, tightened. Handed back and stored nowhere.
//
// THE DIFFERENCE FROM ITS NEIGHBOUR
// ./generate writes a draft from the coaching sessions: it has material and no
// text. This has text and no material, and that is the whole distinction. It
// is given what the person wrote and is allowed to improve how it reads and
// nothing else - no new claims, no new facts, no new register. Everything the
// polished version says, the original already said.
//
// It is the same bargain the testimonial polish makes with a referee's words,
// for the same reason: this section is the one place on the profile where the
// person is speaking, and a polish that quietly adds something has put words
// in somebody's mouth on a page recruiters read as theirs.
//
// THIS ROUTE HAS NO WRITE IN IT
// Like ./generate, and deliberately in the same shape: it reads, it asks the
// model, it returns a string. The editor shows the two versions side by side
// and the owner picks. Save is still the only thing that stores anything.
//
// WHY THE CHECKS ARE ARITHMETIC AND NOT JUDGEMENT
// "Nothing added" is not something a second model call can be trusted to
// confirm, but two of its consequences can be measured: a polish does not grow
// the text much, and a polish does not contain a number the original did not.
// A model that has started inventing nearly always trips one of those, and
// both fail closed - the owner keeps what they wrote and is told to try again.
// ============================================================================

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MODEL = 'claude-haiku-4-5-20251001'
const TEMPERATURE = 0
const MAX_TOKENS = 700

// The column's own ceiling, so nothing can come back that would not save.
const MAX_CHARS = 2000

// Below this there is nothing to tighten, and a model asked to improve eight
// words will write some more of them.
const MIN_INPUT = 40

const EM_DASH = String.fromCharCode(0x2014)

const FIRST_PERSON = /\b(I|I'm|I've|I'd|I'll|my|me|mine)\b/i

// The same two shapes ./generate refuses, and for the same reason: this
// section is somebody speaking, and a sentence that opens on a third-person
// pronoun is somebody being described.
const NARRATOR_START = /(^|[.!?]["')\]]?\s+)(He|She|They|His|Her|Their)\b/
const NARRATOR_PHRASE = /\b(the candidate|this executive|this professional|this leader|this manager)\b/i

// A polish is allowed to be a little longer than what it polished - a clause
// unpacked, a pronoun made explicit - and not much. Past this it has stopped
// editing and started writing.
const GROWTH_LIMIT = 1.2
const GROWTH_ALLOWANCE = 60

// And not much shorter either: this is a tightening, not a summary. Somebody
// who wanted half of what they wrote would have deleted it themselves.
const SHRINK_LIMIT = 0.6

function numbersIn(text) {
  return (text.match(/\d+/g) || [])
}

function buildPrompt(text) {
  return `Below is a passage somebody wrote about themselves for their Career Profile. It is the one section of that profile in their own voice, and it sits on a page a recruiter will read.

Your job is to make it read better. That is all.

WHAT YOU MAY DO
- Tighten. Remove words that are doing no work.
- Clarify. If a sentence is hard to follow, make it easy to follow.
- Fix grammar, punctuation, agreement and obvious typos.
- Break a sentence that has too much in it, or join two that are fighting.

WHAT YOU MAY NOT DO
- Do not add a single claim, fact, number, achievement, skill, job, company or quality that is not already in the passage. If it is not below, it does not go in.
- Do not remove a claim they made. Everything the passage says, your version says.
- Do not change their voice. If they write in short blunt sentences, it stays short and blunt. If they are warm and discursive, it stays warm and discursive. This must still sound like the same person, not like a better writer.
- Do not raise or lower the temperature of what they said. No new enthusiasm, no new modesty, no new confidence.
- Do not change the register. It is not a cover letter, a personal statement or a LinkedIn summary, and it must not become one.
- Do not add an opening line introducing them or a closing line offering value to an employer.
- Do not use em dashes. Use a comma, a full stop, or rewrite the sentence.
- Keep it in the first person, exactly as they wrote it.

If the passage is already good, change very little. Returning something close to what you were given is a correct answer.

THE PASSAGE
${text}

Return ONLY the improved passage. No preamble, no quotation marks around it, no notes on what you changed, no JSON.`
}

// Cleaned, then measured against what it was supposed to be polishing. The
// reason is returned rather than a bare null: a refusal that does not say
// which rule tripped cannot be acted on from the logs.
export function validatePolish(raw, original) {
  const text = noEmDash(
    String(raw || '')
      .replace(/^["'\s]+|["'\s]+$/g, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  )

  const source = String(original || '').trim()

  if (!text) return { reason: 'empty' }
  if (text.length > MAX_CHARS) return { reason: `too long (${text.length})` }
  if (text.includes(EM_DASH)) return { reason: 'an em dash survived stripping' }
  if (!FIRST_PERSON.test(text)) return { reason: 'not in the first person' }

  const narrating = text.match(NARRATOR_START)
  if (narrating) return { reason: `a sentence narrates: "${narrating[2]}"` }

  const stock = text.match(NARRATOR_PHRASE)
  if (stock) return { reason: `stock phrase: "${stock[0]}"` }

  if (text.length > source.length * GROWTH_LIMIT + GROWTH_ALLOWANCE) {
    return { reason: `grew too far (${source.length} to ${text.length})` }
  }
  if (text.length < source.length * SHRINK_LIMIT) {
    return { reason: `cut too far (${source.length} to ${text.length})` }
  }

  // Every number in the polish has to be a number the person already wrote.
  // This is the cheapest available proof that nothing was invented, and
  // invented specifics are almost always numeric.
  const had = new Set(numbersIn(source))
  const invented = numbersIn(text).filter(n => !had.has(n))
  if (invented.length) return { reason: `invented figures: ${invented.join(', ')}` }

  return { text }
}

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    const { data: { user }, error: authError } =
      await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    let body
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'Invalid request.' }, { status: 400 })
    }

    // What the owner has in front of them, not what is stored. The whole point
    // is to polish the draft as it currently reads, including edits they have
    // not saved.
    const source = typeof body?.imow_text === 'string' ? body.imow_text.trim() : ''
    if (source.length < MIN_INPUT) {
      return Response.json(
        { error: 'Write a little more first, then this can tighten it.', code: 'TOO_SHORT' },
        { status: 422 }
      )
    }
    if (source.length > MAX_CHARS) {
      return Response.json(
        { error: 'That is longer than this section can hold.', code: 'TOO_LONG' },
        { status: 422 }
      )
    }

    const { data: profile } = await supabase
      .from('career_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!profile) return Response.json({ error: 'No profile to write for.' }, { status: 404 })

    // ---- TIER ----
    // The same question ./generate asks, asked the same way: Pro, or a free
    // account with only its one entitled direction. Two tools on one control
    // bar that disagreed about who may use them would be two answers to one
    // product decision.
    const { data: account } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .maybeSingle()

    if (!canUseProTools(account?.subscription_tier)) {
      const { count } = await supabase
        .from('profile_lenses')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .in('status', ['active', 'suggested'])
      if ((count || 0) > 1) return Response.json({ error: 'PRO_REQUIRED' }, { status: 403 })
    }

    // Two attempts, like ./generate. At temperature 0 the second pass is only
    // worth making because the first one is thrown away when it breaks a rule,
    // and it is cheap next to handing back a version that says something the
    // person did not.
    let polished = null
    const refusals = []
    const prompt = buildPrompt(source)

    for (let attempt = 0; attempt < 2 && !polished; attempt++) {
      const message = await anthropic.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        messages: [{ role: 'user', content: prompt }]
      })
      const checked = validatePolish(message?.content?.[0]?.text, source)
      if (checked.text) polished = checked.text
      else refusals.push(checked.reason)
    }

    if (!polished) {
      console.error('[career-profile] IMOW polish refused:', refusals.join(' | '))
      return Response.json(
        {
          error: "We couldn't improve that without changing what it says. Your draft is unchanged.",
          code: 'UNUSABLE',
          reason: refusals.join(' | ')
        },
        { status: 502 }
      )
    }

    // Returned, and that is all. Nothing above wrote anything.
    return Response.json({ imow_text: polished })
  } catch (error) {
    console.error('[career-profile] IMOW polish failed:', error)
    return Response.json(
      { error: "We couldn't do that just now. Please try again." },
      { status: 500 }
    )
  }
}
