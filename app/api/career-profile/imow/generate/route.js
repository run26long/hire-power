import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { noEmDash } from '../../_lib/recruiterContext'
import { canUseProTools } from '@/lib/tiers'

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
// Enough for five sentences and no more. A budget that allows a page invites
// one, and the failure this section actually has is length.
const MAX_TOKENS = 350

// The floor stays low on purpose. The prompt asks for 400 to 800 characters,
// but a genuinely tight draft is the best outcome this section has, not a
// failed one: three varied sentences at 270 characters is what this is for, and
// refusing it would spend both retries replacing something good with something
// longer. The ceiling is the rule that matters, so it is the one that bites.
const MIN_CHARS = 150
const MAX_CHARS = 900

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

// ---------------------------------------------------------------------------
// HOW MANY SENTENCES MAY OPEN ON "I"
//
// First person is required here and a run of sentences all starting on the
// pronoun is what makes writing sound like a child's news book. Four sentences
// opening "I've spent... I design... I move..." is the single thing that most
// separates this section from writing somebody was paid to do.
//
// The prompt asks for variety. This enforces it, because asking has not been
// enough: the route already retries a refused draft, so a failed count is one
// more attempt rather than a failed feature.
//
// One is allowed, not zero. Banning the opening outright would push the model
// into contortions to avoid a word the section is written in.
// ---------------------------------------------------------------------------
const I_OPENING_MAX = 1

// The prompt has asked for three to five sentences since it was written, and
// drafts still come back with six. Asking is not enforcement here any more than
// it was for the opening pronoun, and a six-sentence passage is the biography
// this section is explicitly not. The floor is not checked: a draft that clears
// MIN_CHARS in two sentences is short and good, not broken.
const SENTENCE_MAX = 5

// Split on sentence ends that are followed by a space and a capital. Not a
// parser: it only has to be right about where sentences start, and the draft it
// runs on is five sentences of plain prose.
function sentencesOf(text) {
  return String(text || '')
    .split(/(?<=[.!?]["')\]]?)\s+/)
    .map(s => s.trim())
    .filter(Boolean)
}

function countIOpenings(text) {
  return sentencesOf(text).filter(s => /^I\b|^I['’]/.test(s)).length
}

function buildPrompt({ knowledge, resumeText, lenses, displayName }) {
  // Their words lead, the summary follows. It used to be the other way round,
  // and it read like it: the model built from content, which is the tidied
  // third-person statement, and the draft came back sounding tidied. An entry
  // that carries raw_phrasing is the only material here that can make three
  // sentences sound like somebody, so it goes first and is labelled as the
  // thing to build from.
  const knowledgeBlock = knowledge.length
    ? knowledge.map(k => {
        const where = [k.source_job_title, k.source_job_company].filter(Boolean).join(' at ')
        const repeated = k.mention_count > 1 ? ` (said ${k.mention_count} times)` : ''
        const summary = k.content ? `\n  what that was: ${k.content}${where ? ` (from ${where})` : ''}` : ''
        return k.raw_phrasing
          ? `- THEIR WORDS${repeated}: "${k.raw_phrasing}"${summary}`
          : `- [${k.knowledge_type || 'note'}]${repeated} ${k.content}${where ? ` (from ${where})` : ''}`
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

It should read like them talking. Plain sentences. The rhythm of somebody explaining what they care about to a person they respect, not a personal statement and not a LinkedIn summary.

BUILD IT FROM THEIR WORDS
The entries marked THEIR WORDS below are what this person actually said, in the words they said it in. They are the most valuable thing in this prompt and the reason this section exists.

Take their VOICE from them: their rhythm, their comparisons, the way they frame a problem, the phrase they use for something where they have one of their own. Do not simply take their subject matter. Most of what they said is the detail of the work, and this section is not the detail of the work, it is what the person makes of it. Read across everything below for what they keep coming back to and what they clearly care about, and write that, in the way they would say it. The summary under each entry is there so you know what they were talking about, not to be written from.

HOW LONG IT IS, AND THIS IS THE RULE MOST OFTEN BROKEN
Three to five sentences. Between 400 and 800 characters, and never more than 900. That is ONE SHORT PARAGRAPH, about the length of this instruction.

Count it before you answer. A draft at 1,200 characters is not a long version of the right answer, it is the wrong answer: it has become a biography, and the page already has one of those in the column beside it. If you have written more than five sentences, delete whole sentences rather than trimming clauses from all of them. The sentence that goes is the one that says least.

HOW IT HAS TO BE WRITTEN
This sits on a page whose every other line was written by somebody who writes for a living, and it must not be the paragraph that gives that away.

- VARY HOW SENTENCES OPEN. At most ONE sentence in the whole passage may begin with "I". A run of them beginning "I've spent... I design... I move..." is the single thing that makes this section read as juvenile, and it is the most common way this draft fails. Open the others some other way: on the work itself, on a dependent clause, on a participial phrase, on what they noticed or what turned out to be true. "Twenty years of..." "Most of that work came down to..." "Where it gets interesting is..." "Having spent a decade..." Every one of those can carry "I" later in the sentence, and should.
- Vary sentence LENGTH too. Three sentences of identical shape read as a list even when they open differently. At least one sentence must be short, under about fifteen words, and a short one after two longer ones is what makes a passage sound spoken rather than written.
- NOT AN INVENTORY. Naming the tools, systems and processes they work with is what the Skills section of this page is for, and doing it again here spends the one section a resume cannot replace on something a resume already does. Take their words for HOW they think about the work and WHY it matters to them, not their list of what they have used. If a sentence would survive being moved into a skills list, it does not belong here.
- No filler. Every sentence says something that the rest of the page does not.
- Do not narrate what the passage demonstrates. If a sentence explains that this shows rigour, or reflects a commitment to quality, cut it. The thing said plainly is stronger than any label put on it.
- Concrete over abstract. What they actually do beats what it is an example of.

RULES
- Three to five sentences. No more.
- 400 to 800 characters. A passage past that is a biography, and this is a personal statement. If it is running long, cut the sentence that says least, not a clause from every sentence.
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
  const sentenceCount = sentencesOf(text).length
  if (sentenceCount > SENTENCE_MAX) {
    return { reason: `${sentenceCount} sentences, at most ${SENTENCE_MAX} allowed` }
  }
  const iOpenings = countIOpenings(text)
  if (iOpenings > I_OPENING_MAX) {
    return { reason: `${iOpenings} sentences open on "I", at most ${I_OPENING_MAX} may` }
  }
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
    // A paid plan, or a free account with only its one entitled direction.
    // Vault is in: a profile it keeps whole is one it can still write, and the
    // direction count is what free is held to rather than what Vault is.
    const { data: account } = await supabase
      .from('profiles')
      .select('subscription_tier, display_name')
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
    // Three, not two. A corrected retry fixes the rule it was told about and
    // can break a different one on the way past - one observed run was refused
    // for repeated "I" openings and then for a stock phrase, and ran out of
    // attempts having got closer each time. A third is one more Haiku call of a
    // few seconds against a 502 the owner has to act on.
    for (let attempt = 0; attempt < 3 && !draft; attempt++) {
      // The retry says what was wrong with the last one. It used to re-send the
      // prompt unchanged, which at temperature 0 asks the same question and
      // gets the same answer: a draft refused for being 1,200 characters came
      // back at 1,300, and both attempts were spent on the same mistake. The
      // failure is appended rather than rebuilt, so the second call is the same
      // request with one correction on the end.
      // The correction carries the voice rule with it, because without it the
      // fix for one rule breaks another. Told only that too many sentences
      // opened on "I", the model stopped writing in the first person and
      // reached for "the candidate" instead, and three runs in a row were
      // refused twice over on the way to running out of attempts. Varying an
      // opening and leaving first person are different things, and the retry
      // has to say so.
      const content = attempt === 0
        ? prompt
        : `${prompt}

Your previous draft was rejected: ${refusals[refusals.length - 1]}. Write it again, fixing only that and keeping everything else.

It must still be first person throughout, written as this person speaking. Varying how a sentence opens does NOT mean writing about them from outside: never "the candidate", never "this leader", never "he" or "she" or "they" as the subject. Open on the work, on a dependent clause, on a participial phrase, and keep "I" and "my" inside the sentence.`

      const message = await anthropic.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        messages: [{ role: 'user', content }]
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
