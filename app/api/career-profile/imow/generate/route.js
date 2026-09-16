import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { noEmDash, isEntitledTier } from '../../_lib/recruiterContext'

// ============================================================================
// POST /api/career-profile/imow/generate
//
// A first draft of In My Own Words, handed back and stored nowhere.
//
// THIS ROUTE HAS NO WRITE IN IT
// Not a flag, not a branch, nothing to get backwards. It reads, it asks the
// model, it returns a string. The owner reads that string in the textarea,
// changes whatever they want, and the save route is the only thing that ever
// stores anything. A section whose entire purpose is sounding like the person
// must not be able to reach their profile without them having read it.
//
// THE VOICE IS THE OPPOSITE OF EVERY OTHER GENERATION HERE
// /api/career-profile/generate bans the first person across every field it
// writes, and says why in its own prompt: "The profile has exactly one section
// written in deliberate first person, In My Own Words, and you are not writing
// it." This is that section. The rule here is inverted on purpose, and the two
// prompts sit one directory apart - so if one is ever copied from the other,
// this is the paragraph that says which way round it goes.
//
// WHAT IT BUILDS FROM
// career_knowledge, and specifically raw_phrasing: the person's own words as
// they said them, which is the only material in the database that can make
// three sentences sound like somebody rather than about them. content is the
// summarised version and is second. The resume and the directions are there
// for grounding - so the draft knows what they actually do - and not to be
// restated, because a profile that says the same thing twice in two voices is
// worse than one that says it once.
// ============================================================================

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MODEL = 'claude-haiku-4-5-20251001'
const TEMPERATURE = 0
const MAX_TOKENS = 700

const MIN_CHARS = 120
const MAX_CHARS = 1600

// Enough material for the model to have something to work from without the
// prompt becoming the whole knowledge base.
const KNOWLEDGE_LIMIT = 120

const EM_DASH = String.fromCharCode(0x2014)

const FIRST_PERSON = /\b(I|I'm|I've|I'd|I'll|my|me|mine)\b/i

// The narrator voice this section must never slip into.
//
// NOT a ban on third-person pronouns. My first version was, and it refused
// every draft written from a real account - because this section is somebody
// talking about their work, and talking about your work means talking about
// customers, teams and the people you led. "leaders who had the instincts but
// lacked the skill sets" is first-person writing with a "they" in it, and
// refusing it made the whole feature unusable on the one profile I tested.
//
// What is actually wrong is the WRITER being described from outside. That
// shows up as a sentence that opens on a third-person pronoun, which is how a
// narrator writes and not how somebody describing their own work does, or as
// one of the stock phrases the rest of this codebase already bans by name.
const NARRATOR_START = /(^|[.!?]["')\]]?\s+)(He|She|They|His|Her|Their)\b/
const NARRATOR_PHRASE = /\b(the candidate|this executive|this professional|this leader|this manager)\b/i

function buildPrompt({ knowledge, resumeText, lenses, displayName }) {
  const knowledgeBlock = knowledge.length
    ? knowledge.map(k => {
        const said = k.raw_phrasing ? `\n  they said: "${k.raw_phrasing}"` : ''
        const where = [k.source_job_title, k.source_job_company].filter(Boolean).join(' at ')
        const repeated = k.mention_count > 1 ? ` (came up ${k.mention_count} times)` : ''
        return `- [${k.knowledge_type || 'note'}]${repeated} ${k.content}${where ? ` (from ${where})` : ''}${said}`
      }).join('\n')
    : '(nothing on file)'

  const directionsBlock = lenses.length
    ? lenses.map(l => {
        const proof = Array.isArray(l.proof_points)
          ? l.proof_points.map(p => `${p?.num || ''} ${p?.label || ''}`.trim()).filter(Boolean).join('; ')
          : ''
        return [
          `- ${l.name}`,
          l.headline ? `  headline: ${l.headline}` : null,
          proof ? `  proof: ${proof}` : null
        ].filter(Boolean).join('\n')
      }).join('\n')
    : '(none yet)'

  return `You are helping ${displayName || 'this person'} write the one part of their Career Profile that is in their own voice. It is called In My Own Words, and it sits beside a short third-person bio on a page a recruiter will read.

WHAT THIS SECTION IS FOR
Everything else on the profile is the record: roles, numbers, evidence, what other people said. This is the part where the person says what drives them, what they believe about the work, and what they bring that the numbers do not show. A recruiter reads it to find out what it would be like to work with them.

VOICE, AND THIS GOVERNS EVERYTHING ELSE
First person, always. "I", "my", "me". This is the ONLY section of this profile written that way, and the rest of it is deliberately written without pronouns - so do not hedge toward that register here. Never write about them in the third person: no "he", no "she", no "they", never their name as a narrator, never "this leader" or "the candidate".

It should read like them talking. Plain sentences. The rhythm of somebody explaining what they care about to a person they respect, not a personal statement and not a LinkedIn summary. If the material below contains their actual phrasing, use it - that is the most valuable thing in this prompt.

RULES
- Three to five sentences. No more.
- Nothing invented. Everything comes from the material below.
- No statistics, no percentages, no job titles, no company names. The rest of the page already carries those, and repeating them here wastes the one section that cannot be got from a resume.
- No em dashes. Use a comma, a full stop, or rewrite the sentence.
- Do not open with "I am a" or "I'm a". Do not open with their name.
- No closing line that offers value to an employer. This is not a cover letter.

WHAT THEY HAVE SAID, FROM THEIR COACHING SESSIONS
${knowledgeBlock}

THE DIRECTIONS THEIR PROFILE IS WRITTEN IN
For grounding only. Do not restate these.
${directionsBlock}

THEIR RESUME
For grounding only. Do not restate it.
${resumeText || '(not on file)'}

Return ONLY the paragraph. No preamble, no quotation marks around it, no JSON, no explanation.`
}

// Cleaned, then judged. A draft that fails these is worse than no draft: it
// would land in the textarea looking finished and reading like the rest of the
// page rather than like them.
//
// It returns the reason it refused rather than a bare null, because a 502 that
// does not say which rule tripped is a 502 nobody can act on - including me,
// reading the logs. Exported so the checks can be exercised on their own.
export function validateDraft(raw) {
  const text = noEmDash(
    String(raw || '')
      .replace(/^["'\s]+|["'\s]+$/g, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  )

  if (text.length < MIN_CHARS) return { reason: `too short (${text.length})` }
  if (text.length > MAX_CHARS) return { reason: `too long (${text.length})` }
  if (text.includes(EM_DASH)) return { reason: 'an em dash survived stripping' }
  if (!FIRST_PERSON.test(text)) return { reason: 'not in the first person' }
  const narrating = text.match(NARRATOR_START)
  if (narrating) return { reason: `a sentence narrates: "${narrating[2]}"` }
  const stock = text.match(NARRATOR_PHRASE)
  if (stock) return { reason: `stock phrase: "${stock[0]}"` }
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

    const { data: profile } = await supabase
      .from('career_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!profile) return Response.json({ error: 'No profile to write for.' }, { status: 404 })

    // ---- TIER ----
    // The same question the lens generator asks, and asked the same way: Pro,
    // or a free account with only its one entitled direction. Two generators
    // that disagreed about who may generate would be two answers to one
    // product decision.
    const { data: account } = await supabase
      .from('profiles')
      .select('subscription_tier, display_name')
      .eq('id', user.id)
      .maybeSingle()

    if (!isEntitledTier(account?.subscription_tier)) {
      const { count } = await supabase
        .from('profile_lenses')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .in('status', ['active', 'suggested'])
      if ((count || 0) > 1) return Response.json({ error: 'PRO_REQUIRED' }, { status: 403 })
    }

    // ---- MATERIAL ----
    const [knowledgeRes, lensRes, coreRes] = await Promise.all([
      supabase
        .from('career_knowledge')
        .select('knowledge_type, content, raw_phrasing, confidence, mention_count, source_job_title, source_job_company')
        .eq('user_id', user.id)
        .is('superseded_by', null)
        // What they have come back to is what they actually believe, and this
        // section is about what they believe.
        .order('mention_count', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: true })
        .limit(KNOWLEDGE_LIMIT),
      supabase
        .from('profile_lenses')
        .select('name, headline, bio, proof_points')
        .eq('profile_id', profile.id)
        .in('status', ['active', 'suggested'])
        .order('sort_order', { ascending: true }),
      supabase
        .from('resumes')
        .select('resume_data, is_priority_core, updated_at')
        .eq('user_id', user.id)
        .order('is_priority_core', { ascending: false, nullsFirst: false })
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    ])

    const knowledge = knowledgeRes.data || []
    const lenses = lensRes.data || []

    // Nothing to write from is not a failure to retry. It is a different
    // problem with a different answer, and saying so is better than handing
    // back an invented paragraph.
    if (knowledge.length === 0 && lenses.length === 0) {
      return Response.json(
        { error: "There isn't enough in your coaching sessions yet to write from.", code: 'NO_MATERIAL' },
        { status: 422 }
      )
    }

    // The resume as text, kept short: it is grounding, not source material,
    // and the prompt says so.
    const resumeData = coreRes.data?.resume_data
    const resumeText = resumeData
      ? JSON.stringify(resumeData).slice(0, 6000)
      : null

    const prompt = buildPrompt({
      knowledge,
      resumeText,
      lenses,
      displayName: account?.display_name
    })

    // Two attempts. The validator refuses a draft in the wrong voice or the
    // wrong length, and a second pass at temperature 0 with the same prompt is
    // cheap next to handing back something that reads like the rest of the
    // page.
    let draft = null
    const refusals = []
    for (let attempt = 0; attempt < 2 && !draft; attempt++) {
      const message = await anthropic.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        messages: [{ role: 'user', content: prompt }]
      })
      const checked = validateDraft(message?.content?.[0]?.text)
      if (checked.text) draft = checked.text
      else refusals.push(checked.reason)
    }

    if (!draft) {
      console.error('[career-profile] IMOW draft refused:', refusals.join(' | '))
      // `reason` says which of this prompt's own rules the model broke. It
      // describes our rules and the model's output, nothing about the person
      // or the system, and without it a 502 here is unactionable from outside.
      return Response.json(
        {
          error: "We couldn't write a draft that sounded right. Please try again.",
          code: 'UNUSABLE',
          reason: refusals.join(' | ')
        },
        { status: 502 }
      )
    }

    // Returned, and that is all. Nothing above wrote anything.
    return Response.json({ imow_text: draft })
  } catch (error) {
    console.error('[career-profile] IMOW generation failed:', error)
    return Response.json(
      { error: "We couldn't write a draft just now. Please try again." },
      { status: 500 }
    )
  }
}
