import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const WRITING_CONSTITUTION = `
RESUME WRITING STANDARDS — APPLY TO EVERY WORD YOU WRITE:

VOICE & AUTHENTICITY:
- Match language to the candidate's career stage. Students sound like exceptional students. 
  Mid-career professionals sound like confident experts. Executives sound like strategic leaders.
- Never use executive language for early-career or service roles.
- Keep responsibility claims believable for the actual job title and experience level.
- Preserve the candidate's natural voice while improving clarity and professionalism.
- Elevate the description of the work — never inflate the responsibility.

BULLET WRITING RULES:
- Start every bullet with a strong action verb appropriate to the role's actual scope.
- Focus on impact and outcomes, not just tasks.
- One bullet = one achievement, project, responsibility, or skill area.
- NEVER combine two distinct responsibilities into one bullet.
- Keep each bullet focused on one idea. Active voice, direct language.
- Avoid: "responsible for," "helped with," "assisted with," "worked on."
- Use metrics when provided in coaching. NEVER invent them.
- When no metrics exist, use trust signals, complexity, scope, and impact language instead.

ACTION VERB CALIBRATION BY LEVEL:
Entry-level: Assisted, Coordinated, Supported, Prepared, Maintained, Tracked, Organized, Contributed
Mid-career: Managed, Developed, Led, Implemented, Improved, Trained, Streamlined, Delivered
Senior: Directed, Established, Transformed, Drove, Oversaw, Championed, Architected, Scaled

NO HALLUCINATION — ABSOLUTE RULE:
You may ONLY use information explicitly in the resume or extracted during coaching.
NEVER invent metrics, company details, project names, dates, awards, or responsibilities.
If coaching didn't surface a number, write around it with qualitative strength.
`

const LEVEL_INSTRUCTIONS = {
  entry: `This is an entry-level candidate. Write their bullet in the voice of a strong early-career professional. Do not use executive language. Authentic, specific, and impressive for their stage.`,
  mid: `This is a mid-career professional. Write with confidence. Ground claims in specifics. Metrics expected where the role produces them.`,
  senior: `This is a senior professional. Focus on organizational scope, strategic impact, and leadership at scale.`
}

export async function POST(request) {
  try {
    const { resumeData, conversation, detectedLevel, careerContext } = await request.json()

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    // Use first job — same job trial-coach coached on
    const job = resumeData?.experience?.[0]
    if (!job) {
      return NextResponse.json({ error: 'No experience found' }, { status: 400 })
    }

    const existingSkills = Object.values(resumeData?.skillsCategories || {}).flat()
    const level = detectedLevel || 'entry'
    const levelNote = LEVEL_INSTRUCTIONS[level] || LEVEL_INSTRUCTIONS.entry

    const careerContextBlock = careerContext ? `
CAREER CONTEXT:
- Target roles: ${careerContext.target_roles?.join(', ') || 'not specified'}
- Career changer: ${careerContext.is_career_changer ? `YES — from ${careerContext.previous_field}` : 'No'}
- Transferable skills to emphasize: ${careerContext.transferable_skills?.join(', ') || 'none noted'}
` : ''

    const systemPrompt = `${WRITING_CONSTITUTION}

${levelNote}

${careerContextBlock}

JOB BEING COACHED:
Title: ${job.title}
Company: ${job.company}
Current bullets:
${(job.bullets || []).map(b => `• ${b}`).join('\n') || 'No bullets'}

EXISTING SKILLS ON RESUME: ${existingSkills.length > 0 ? existingSkills.join(', ') : 'None listed'}

COACHING CONVERSATION:
${conversation.map(msg => `${msg.role === 'user' ? 'Candidate' : 'Coach'}: ${msg.content}`).join('\n\n')}

YOUR TASK:
1. Pick the WEAKEST bullet from the current job — the one most generic, vague, or task-focused that the coaching conversation gives you the most material to improve.
2. Rewrite it using ONLY information from the coaching conversation. Do not invent anything.
3. Count NEW skills demonstrated in the conversation that are NOT already in the existing skills list. Return only the count, not the names.

Return ONLY a valid JSON object. No markdown. No explanation. No backticks.

{
  "before": "exact original bullet text",
  "after": "improved bullet using coaching insights",
  "reason": "1-2 sentences explaining what changed and why it's stronger",
  "skillsCount": <number of NEW skills discovered, 0-7>
}`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: systemPrompt }]
    })

    const responseText = message.content[0].text
    const cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const result = JSON.parse(cleanedText)

    return NextResponse.json(result)

  } catch (error) {
    console.error('Trial coach finish error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}