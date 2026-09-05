import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ═══════════════════════════════════════════════
// SHARED WRITING RULES
// ═══════════════════════════════════════════════

const writingRules = `
WRITING RULES (non-negotiable):

1. NO EM DASHES anywhere. Use commas, periods, or restructure.
2. NO fabricated information: CATASTROPHIC FAILURE. Every fact, skill, metric, and detail in the revised bullet must trace directly to the resume data or coaching transcript provided. Before outputting, name the source for every claim in the bullet. If you cannot point to where it appears in the resume or transcript, delete it. Do not invent replacement content. Do not infer skills or experience that are not explicitly stated. The resume and coaching transcript are the only sources of truth.
3. NO skills the candidate did not demonstrate. JD vocabulary is acceptable ONLY when describing work the candidate actually did.
4. Match the tone and voice of the existing resume. If the resume uses concise, punchy bullets, write concise and punchy. If it uses detailed narrative bullets, match that style.
5. Start every bullet with a strong action verb. No "Responsible for" or "Duties included."
6. Do not use these words or phrases: "utilize," "leverage," "spearheaded," "rockstar," "ninja," "guru," "supercharge," "level up," "secret sauce," "low-hanging fruit," "moving the needle."
7. Address the user as "you" and "your." Never "the candidate" or "this candidate."
8. Never reference internal terms like "jobIndex," "bulletIndex," "position," or any technical field names. Write as if speaking to the user directly.
9. Keep explanation fields to one short sentence. No justification paragraphs.
10. Never insert a space before punctuation. Commas, periods, semicolons, and colons attach directly to the preceding word.
11. Never join two independent clauses with only a comma. Use a period, a semicolon, or a coordinating conjunction instead.
12. Do NOT end bullets with periods. This is the current universal standard. Periods at the end of resume bullets are outdated. Omit them consistently. If a bullet contains two distinct thoughts, separate with a semicolon, not a period.
13. When the user asks to remove part of a bullet, either shorten the bullet to what remains if it is strong enough to stand alone, or replace the removed portion with something sourced from the resume or coaching transcript. Never invent replacement content. If nothing suitable exists in the sources, the shorter bullet is the correct answer.
`

// ═══════════════════════════════════════════════
// MODE: REWORD
// ═══════════════════════════════════════════════

function buildRewordPrompt(currentText, resumeData, coachingTranscript, careerContext, textType) {
  return `You are a professional resume writer generating alternative phrasings for a single ${textType} on a resume.

${writingRules}

CONTEXT:
The candidate has already been coached. Their resume has been professionally written by Hire Power's coaching engine. They are happy with the content but want to see different ways to say the same thing.

CAREER CONTEXT:
${careerContext ? `Current role: ${careerContext.current_role || 'Not specified'}
Target roles: ${careerContext.target_roles?.join(', ') || 'Not specified'}
Career direction: ${careerContext.career_direction || 'Not specified'}` : 'No career context available.'}

FULL RESUME (for voice and context matching):
${JSON.stringify(resumeData, null, 2)}

COACHING TRANSCRIPT (for factual grounding):
${coachingTranscript}

CURRENT ${textType.toUpperCase()}:
"${currentText}"

Generate exactly 3 alternative versions of this ${textType}. Each alternative must:
- Convey the same information and achievements
- Use different phrasing, structure, or emphasis
- Stay grounded in facts from the resume and coaching transcript
- Match the overall voice of the resume
- Be a direct replacement (same type of content, similar length)

Respond with ONLY valid JSON. No markdown, no code blocks, no preamble.
{"alternatives": ["alternative 1", "alternative 2", "alternative 3"]}`
}

// ═══════════════════════════════════════════════
// MODE: FIX
// ═══════════════════════════════════════════════

function buildFixPrompt(currentText, userExplanation, resumeData, coachingTranscript, careerContext, textType) {
  return `You are a professional resume writer correcting a single ${textType} on a resume based on the candidate's feedback.

${writingRules}

CONTEXT:
The candidate reviewed their coached resume and found something that is not right about this specific ${textType}. They have explained what needs to change. Your job is to rewrite it incorporating their correction.

CAREER CONTEXT:
${careerContext ? `Current role: ${careerContext.current_role || 'Not specified'}
Target roles: ${careerContext.target_roles?.join(', ') || 'Not specified'}
Career direction: ${careerContext.career_direction || 'Not specified'}` : 'No career context available.'}

FULL RESUME (for voice and context matching):
${JSON.stringify(resumeData, null, 2)}

COACHING TRANSCRIPT (for factual grounding):
${coachingTranscript}

CURRENT ${textType.toUpperCase()}:
"${currentText}"

WHAT THE CANDIDATE SAYS IS WRONG:
"${userExplanation}"

Rewrite this ${textType} incorporating the candidate's correction. The rewrite must:
- Fix exactly what the candidate described
- Keep everything else that was correct
- Match the voice of the rest of the resume
- Stay grounded in facts
- Return the complete revised ${textType} as a direct replacement

Respond with ONLY valid JSON. No markdown, no code blocks, no preamble.
{"revised": "the complete corrected ${textType}"}`
}

// ═══════════════════════════════════════════════
// MODE: ADD
// ═══════════════════════════════════════════════

function buildAddPrompt(userDescription, resumeData, coachingTranscript, careerContext) {
  return `You are a professional resume writer adding new content to a resume based on something the candidate forgot to mention during coaching.

${writingRules}

CONTEXT:
The candidate completed coaching and reviewed their resume, but realized they forgot to mention something. They have described what they want to add. Your job is to write it in the voice of the resume and recommend where it belongs.

CAREER CONTEXT:
${careerContext ? `Current role: ${careerContext.current_role || 'Not specified'}
Target roles: ${careerContext.target_roles?.join(', ') || 'Not specified'}
Career direction: ${careerContext.career_direction || 'Not specified'}` : 'No career context available.'}

FULL RESUME:
${JSON.stringify(resumeData, null, 2)}

COACHING TRANSCRIPT (for voice and factual context):
${coachingTranscript}

WHAT THE CANDIDATE WANTS TO ADD:
"${userDescription}"

Analyze the resume and determine:
1. What type of content this is (a bullet for an existing job, a new bullet for a specific role, a summary addition, a new skill, etc.)
2. Where it belongs (which job's bullets, summary, skills, etc.)
3. Write the content in the voice of the resume

SHAPE RULES — READ BEFORE ANSWERING:
The "content" field is ALWAYS a plain string. Never an object. Never an array. The only shape that
carries structured data is the experience shape below, and it uses a "job" field, never "content".
If what the candidate described fits none of the shapes below, do not invent a new one — use the
unsupported shape at the bottom.

ADDING A JOB THAT IS NOT ON THE RESUME:
If the candidate is describing a role that does not appear in the resume above — a different employer,
or a span of dates that no listed role covers — that is a NEW EXPERIENCE ENTRY, not a bullet on an
existing job. Never attach it to an unrelated role just to place it somewhere.

STEP 1 — ASK FIRST. Never create the entry on the first pass. Roles get left off resumes deliberately,
and the candidate may have been telling you about this job for context rather than asking for it on the
page. Return the confirmJob shape and ask whether they want it added.

STEP 2 — ONLY AFTER THEY AGREE. The description you are given includes every turn of this exchange, so
you can see their answer. If they declined, do not create the entry. If they agreed, you need all three
of these before the entry can be created:
1. The job TITLE they held
2. The COMPANY or organization name
3. DATES: at minimum a start year and an end year, or a start year plus an indication they are still there

If ANY of the three is missing, do NOT create the entry. Return the clarification shape and ask for
exactly what is missing, naming what you already have so they do not repeat themselves. Never guess a
title from the duties described, never infer the company from context, and never estimate dates from
the roles around it.

Bullets for a new entry come only from what the candidate said about that job. If they gave you the
role but little detail about the work, write 1-2 honest bullets rather than padding to a target count.
Never add duties that are merely typical of the title.

JOB SUMMARY FOR THE NEW ENTRY — REQUIRED:
Every job on the resume above carries a job summary, the one-to-two sentence overview that sits between
the job title and the bullets. A new entry without one looks broken next to the others, so write one.

The job summary is the high-level overview of the role. Describe the function of the role and the
employer in one sentence. It tells the recruiter where this person worked, what they did, and at what
level, without detail. The details follow in the bullets. Match the voice, length, and level of
abstraction of the job summaries already on the resume above.

  Good: "Supported guest experience for a professional basketball franchise, handling ticketing,
  seating, and escalations across a 41-game home season."
  Bad: "Worked at the Orlando Magic." (too short, tells the recruiter nothing)
  Bad: "Greeted guests, scanned tickets, resolved seating conflicts, and directed traffic." (a duty
  list — that content belongs in bullets)

Write it from what the candidate actually told you plus the plain function of the role and employer.
Do not invent scale, scope, or metrics for the summary any more than you would for a bullet. If they
told you very little, keep the summary to a single plain sentence naming the function and the employer.

Respond with ONLY valid JSON. No markdown, no code blocks, no preamble.

If this is a bullet for an existing job:
{"type": "bullet", "jobIndex": 0, "position": "end", "content": "the new bullet text", "explanation": "One sentence saying where it goes, e.g. 'Added to your role at Company Name.'"}

If this is a summary addition or revision:
{"type": "summary", "content": "the revised full summary incorporating the new information", "explanation": "Brief explanation of what changed"}

If this is a new skill:
{"type": "skill", "category": "Category Name", "skills": ["skill1", "skill2"], "explanation": "Brief explanation"}

If this is a job that is not already on the resume and they have NOT yet agreed to add it:
{"type": "confirmJob", "question": "Would you like me to add that as a new job in your experience section?", "jobLabel": "The shortest accurate label you can build from what they told you, e.g. 'Guest Services Representative at Orlando Magic' or just 'Orlando Magic' if that is all you have"}

If this is a job that is not already on the resume, they HAVE agreed to add it, AND you have the title, company, and dates:
{"type": "experience", "job": {"title": "the job title", "company": "the employer name", "location": "City, ST or an empty string if not stated", "startDate": "YYYY-MM", "endDate": "YYYY-MM, or null if they are still there", "current": false, "summary": "the 1-2 sentence job summary described above — required, never an empty string", "bullets": ["bullet 1", "bullet 2"]}, "explanation": "One sentence, e.g. 'Added as a new role between your positions at X and Y.'"}

Dates use YYYY-MM. If the candidate gave only a year, use YYYY-01 for a start date and YYYY-12 for an
end date. If they are still in the role, set "current": true and "endDate": null.

If the description is too vague to write specific content, or a new job is missing its title, company, or dates:
{"type": "clarification", "question": "A specific question to ask the candidate so you can write the content"}

If this is something the feature cannot place at all:
{"type": "unsupported", "reason": "other", "explanation": "One sentence naming what they described."}`
}

function buildAddPromptCoverLetter(userDescription, coverLetterData) {
  return `You are a professional cover letter writer adding new content to a cover letter based on something the candidate forgot to mention.

${writingRules}

CONTEXT:
The cover letter has three sections:
- opening: the introductory paragraph establishing why the candidate is applying and what they bring
- bullets: body accomplishments, qualifications, and relevant experience (this is where new content almost always belongs)
- closing: the call-to-action paragraph and signoff

New content should go in bullets unless it is clearly an opening statement or closing language. Never add content to the signoff line itself.

FULL COVER LETTER:
${JSON.stringify(coverLetterData, null, 2)}

WHAT THE CANDIDATE WANTS TO ADD:
"${userDescription}"

Write the new content in the voice of the existing cover letter and determine which section it belongs in.

SHAPE RULE: The "content" field is ALWAYS a plain string. Never an object. Never an array.

Respond with ONLY valid JSON. No markdown, no code blocks, no preamble.

If this belongs in bullets (most cases):
{"section": "bullets", "content": "the new bullet text", "explanation": "One sentence explaining what was added."}

If this is clearly opening content:
{"section": "opening", "content": "the revised full opening paragraph incorporating the new information", "explanation": "Brief explanation of what changed."}

If this is clearly closing content:
{"section": "closing", "content": "the revised full closing paragraph incorporating the new information", "explanation": "Brief explanation of what changed."}

If the description is too vague to write specific content:
{"type": "clarification", "question": "A specific question to ask the candidate so you can write the content"}`
}

// ═══════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════

export async function POST(request) {
  try {
    // Auth check
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    let authenticatedUserId = null
    if (token !== process.env.INTERNAL_API_SECRET) {
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
      if (authError || !user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }
      authenticatedUserId = user.id
    }

    const body = await request.json()
    const {
      mode,           // 'reword' | 'fix' | 'add'
      currentText,    // the bullet/summary being acted on (reword, fix)
      userInput,      // user's explanation (fix) or description (add)
      textType,       // 'bullet' | 'summary' | 'job summary'
      resumeData,     // full resume/cover letter JSON
      coachingTranscript, // full coaching conversation
      careerContext,  // career context object
      isCoverLetter,  // true when called from the cover letter editor
    } = body

    if (!mode || !resumeData) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Format coaching transcript for the prompt
    const transcriptText = Array.isArray(coachingTranscript)
      ? coachingTranscript.map(m =>
          `${m.role === 'assistant' ? 'Coach' : 'Candidate'}: ${typeof m.content === 'string' ? m.content : ''}`
        ).join('\n')
      : (coachingTranscript || 'No coaching transcript available.')

    let prompt
    switch (mode) {
      case 'reword':
        if (!currentText) return Response.json({ error: 'currentText required for reword mode' }, { status: 400 })
        prompt = buildRewordPrompt(currentText, resumeData, transcriptText, careerContext, textType || 'bullet')
        break
      case 'fix':
        if (!currentText || !userInput) return Response.json({ error: 'currentText and userInput required for fix mode' }, { status: 400 })
        prompt = buildFixPrompt(currentText, userInput, resumeData, transcriptText, careerContext, textType || 'bullet')
        break
      case 'add':
        if (!userInput) return Response.json({ error: 'userInput required for add mode' }, { status: 400 })
        prompt = isCoverLetter
          ? buildAddPromptCoverLetter(userInput, resumeData)
          : buildAddPrompt(userInput, resumeData, transcriptText, careerContext)
        break
      default:
        return Response.json({ error: 'Invalid mode. Use reword, fix, or add.' }, { status: 400 })
    }

    // Free tier gets three of each edit tool. Counters live on profiles.
    const USAGE_COLUMN = { reword: 'reword_used', fix: 'fix_used', add: 'add_used' }
    const LIMIT_ERROR = { reword: 'REWORD_LIMIT_REACHED', fix: 'FIX_LIMIT_REACHED', add: 'ADD_LIMIT_REACHED' }
    const usageColumn = USAGE_COLUMN[mode]
    let usageCount = null

    if (authenticatedUserId) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('subscription_tier, reword_used, fix_used, add_used')
        .eq('id', authenticatedUserId)
        .maybeSingle()

      const isFree = !profile?.subscription_tier || profile.subscription_tier === 'free'

      if (isFree) {
        usageCount = profile?.[usageColumn] ?? 0
        if (usageCount >= 3) {
          return Response.json({ error: LIMIT_ERROR[mode] }, { status: 403 })
        }
      }
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      temperature: mode === 'reword' ? 0.4 : 0,
      messages: [{ role: 'user', content: prompt }]
    })

    const responseText = response.content[0]?.text || ''

    // Parse JSON response
    let parsed
    try {
      const cleaned = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      parsed = JSON.parse(cleaned)
    } catch (parseError) {
      console.error('Failed to parse coach-revise response:', responseText)
      return Response.json({ error: 'Failed to parse response. Please try again.' }, { status: 500 })
    }

    // Only a finished edit spends a use. A clarifying question, a job still
    // awaiting confirmation, or an unsupported request costs the user nothing,
    // so a multi-turn add counts once.
    const NON_TERMINAL = ['clarification', 'confirmJob', 'unsupported']
    if (usageCount !== null && !NON_TERMINAL.includes(parsed?.type)) {
      const { error: usageError } = await supabaseAdmin
        .from('profiles')
        .update({ [usageColumn]: usageCount + 1 })
        .eq('id', authenticatedUserId)
      if (usageError) {
        console.error('coach-revise usage increment failed (non-blocking):', usageError)
      }
    }

    return Response.json({
      mode,
      result: parsed,
      usage: {
        input_tokens: response.usage?.input_tokens,
        output_tokens: response.usage?.output_tokens,
        cached_input_tokens: response.usage?.cache_read_input_tokens
      }
    })

  } catch (error) {
    console.error('Coach revise error:', error)
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}