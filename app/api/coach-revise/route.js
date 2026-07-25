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
2. NO fabricated information. Every detail must come from the resume data or coaching transcript provided.
3. NO skills the candidate did not demonstrate. JD vocabulary is acceptable ONLY when describing work the candidate actually did.
4. Match the tone and voice of the existing resume. If the resume uses concise, punchy bullets, write concise and punchy. If it uses detailed narrative bullets, match that style.
5. Start every bullet with a strong action verb. No "Responsible for" or "Duties included."
6. Do not use these words or phrases: "utilize," "leverage," "spearheaded," "rockstar," "ninja," "guru," "supercharge," "level up," "secret sauce," "low-hanging fruit," "moving the needle."
7. Address the user as "you" and "your." Never "the candidate" or "this candidate."
8. Never reference internal terms like "jobIndex," "bulletIndex," "position," or any technical field names. Write as if speaking to the user directly.
9. Keep explanation fields to one short sentence. No justification paragraphs.
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

Respond with ONLY valid JSON. No markdown, no code blocks, no preamble.

If this is a bullet for an existing job:
{"type": "bullet", "jobIndex": 0, "position": "end", "content": "the new bullet text", "explanation": "One sentence saying where it goes, e.g. 'Added to your role at Company Name.'"}

If this is a summary addition or revision:
{"type": "summary", "content": "the revised full summary incorporating the new information", "explanation": "Brief explanation of what changed"}

If this is a new skill:
{"type": "skill", "category": "Category Name", "skills": ["skill1", "skill2"], "explanation": "Brief explanation"}

If the description is too vague to write specific content:
{"type": "clarification", "question": "A specific question to ask the candidate so you can write the content"}`
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
    if (token !== process.env.INTERNAL_API_SECRET) {
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
      if (authError || !user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }
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

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      temperature: mode === 'reword' ? 0.7 : 0,
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