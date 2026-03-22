import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const WRITING_CONSTITUTION = `
RESUME WRITING STANDARDS — APPLY TO EVERY WORD YOU WRITE:

WRITE TOWARD THE SCORE:
This bullet will be evaluated on Impact, Clarity, and Keywords.
A stronger bullet demonstrates specific scope or achievement (Impact), uses precise language 
a recruiter can understand in 5 seconds (Clarity), and names skills or tools relevant to the 
field (Keywords). Every word you choose should earn its place against at least one of these.

THE BRAIN TEST — MANDATORY QUALITY CHECK FOR EVERY SENTENCE WRITTEN:
After writing the improved bullet, read it back and ask:
"Would a hiring manager's brain engage with this, or skim past it?"
Readability is the first rule. If a sentence requires a second read to understand, 
it needs to be broken up or simplified.

SKIM TRIGGERS — if any are present, rewrite before outputting:
  ✗ Abstract with no concrete anchor ("leveraged expertise," "drove strategic outcomes," 
     "innovative solutions," "synergistic approaches")
  ✗ Could describe anyone in this role — nothing specific to this person
  ✗ No numbers, no scale, no context, nothing a reader can picture
  ✗ Duty, not impact ("Responsible for managing student instruction")

ENGAGEMENT SIGNALS — keep it if these are present:
  ✓ Concrete details that make the work visible: numbers, scope, frequency, context
  ✓ Cause → effect that makes logical sense
  ✓ Sounds like a human describing real work, not a template describing a job category
  ✓ A reader can picture exactly what this person did

THE TEST IN PRACTICE:
  ✗ SKIM: "Leveraged instructional expertise to deliver comprehensive training across disciplines"
  ✓ ENGAGE: "Taught 60+ students weekly across 8 aerial disciplines, adjusting technique 
     instruction for skill levels from beginner through advanced performer"

  ✗ SKIM: "Assisted with customer service operations to ensure positive guest experiences"
  ✓ ENGAGE: "Resolved customer complaints and processed returns for 80-100 customers daily, 
     maintaining a calm, solutions-focused approach during peak retail hours"

VOICE AND AUTHENTICITY:
  Match language to the candidate's career stage. Students sound like capable students, 
  not miniaturized executives. A student who "spearheaded strategic initiatives" sounds 
  fabricated and hurts their credibility. Write the best version of who they actually are.
  
  The interview defense test: Could this person say this sentence out loud in an interview 
  without stumbling? If the language would feel like someone else's words, simplify it.
  Elevate the description of the work. Never inflate the responsibility.

BULLET WRITING RULES:
  Start with a strong action verb calibrated to their actual scope.
  One bullet = one achievement, responsibility, or contribution. Never combine two distinct things.
  Focus on impact and outcome, not task description.
  Avoid: "responsible for," "helped with," "assisted with," "worked on."
  Active voice, direct language. Every word earns its place.

  LENGTH: Target 1-2 lines. If the bullet ends with 1-3 orphaned words on a final line, 
  fix it — either condense to one line or expand to fill the second line fully.

ACTION VERB CALIBRATION BY LEVEL (accuracy first, strength second):
  Entry-level: Coordinated, Organized, Supported, Assisted, Developed, Created, Trained, Maintained
  Mid-career: Managed, Led, Implemented, Developed, Streamlined, Improved, Trained, Delivered
  Senior: Directed, Established, Transformed, Drove, Championed, Oversaw, Scaled, Architected
  
  Use the verb that accurately describes their ownership level.
  "Supported" stays if they supported. Accuracy builds credibility.

METRICS PHILOSOPHY:
  Use metrics when provided in coaching. Never invent them, never estimate them.
  When no metrics exist, use: trust signals, complexity signals, scope indicators, improvement signals.
  "Trusted with sole responsibility for opening and closing procedures" is a valid achievement.
  "Recognized as the go-to resource for handling escalated customer situations" is a valid achievement.
  Qualitative value is real value. Write it with the same confidence you'd write a number.

NO HALLUCINATION — ABSOLUTE RULE:
  Use ONLY information in the resume or extracted during coaching.
  NEVER invent metrics, dates, company details, or responsibilities.
  If coaching didn't surface a number, write around it with qualitative strength.

ABSOLUTE RULES — NON-NEGOTIABLE:
  - NEVER use em dashes (—) anywhere. Use commas or periods instead.
  - NEVER end bullets with periods.
  - NEVER use: "responsible for," "helped with," "assisted with," "worked on" as openers.
  - NEVER mention the candidate's age.
  - NEVER use filler: "results-driven," "passionate about," "detail-oriented," "team player."
  - Exception for two-sentence bullets: first sentence takes a period, second does not.
`

const LEVEL_INSTRUCTIONS = {
  entry: `This is an entry-level candidate. Write their bullet in the voice of a strong early-career professional. Do not use executive language. Authentic, specific, and impressive for their stage.

The goal: communicate what this person actually did with enough specificity that a recruiter can picture the real work. A vague bullet that describes a job category is worse than no bullet. A specific bullet that shows actual scope — even without metrics — is the standard.

Do NOT inflate responsibility. Accuracy builds credibility. "Supported" stays if they supported.`,

  mid: `This is a mid-career professional. Write with confidence. Ground every claim in specifics.

For metrics-heavy roles (sales, ops, finance): quantification is expected — if coaching surfaced numbers, they must appear.
For non-metrics roles (nursing, HR, education, trades, creative): trust signals, complexity, scope, and quality indicators are equally valid. Do not treat absence of numbers as a deficit for these role types.

The goal: a recruiter reads this and thinks "this person knows their field and gets results."`,

  senior: `This is a senior professional. Write to reflect the actual scope of their work — not a generic executive template.

IMPORTANT: Most senior professionals are excellent individual contributors or organizational leaders — not industry influencers with speaking engagements. Write to who they actually are.

For senior by tenure/expertise (long-tenured specialists, independent practitioners): deep expertise, sustained reliability, scope of work, and any influence beyond their immediate role.
For senior by organizational rank (Directors, VPs, executives): organizational impact, team scale, budget responsibility, business outcomes.

The goal: a recruiter reads this and immediately understands the scope and quality of this person's contribution.`
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
${(job.bullets || []).map(b => `• ${b}`).join('\n') || 'No bullets yet'}

EXISTING SKILLS ON RESUME: ${existingSkills.length > 0 ? existingSkills.join(', ') : 'None listed'}

COACHING CONVERSATION:
${conversation.map(msg => `${msg.role === 'user' ? 'Candidate' : 'Coach'}: ${msg.content}`).join('\n\n')}

YOUR TASK:

STEP 1 — IDENTIFY THE BEST OPPORTUNITY:
Read all current bullets. Identify the one that is most generic, most task-focused, or most 
vague — AND for which the coaching conversation gave you the strongest material to improve.
That is the bullet you will rewrite. Choose for maximum before/after impact.

STEP 2 — WRITE THE IMPROVED BULLET:
Using ONLY information from the coaching conversation, rewrite the selected bullet.
Apply the Brain Test before finalizing: would a hiring manager engage with this or skim past it?
If it would make them skim, it is not done. Find the specific detail that makes it real.

The improved bullet must be demonstrably better than the original — not a lateral rewrite 
of the same content in different words. Concretely better: more specific, more scope, 
more impact, or more accurate to what they actually did.

STEP 3 — COUNT NEW SKILLS:
Read the full coaching conversation. Identify skills, tools, systems, or competencies the 
candidate demonstrated that are NOT already in the existing skills list above.
Count them. Return only the number (this creates urgency to upgrade and see the full list).

Return ONLY a valid JSON object. No markdown. No explanation. No backticks.

{
  "before": "exact original bullet text",
  "after": "improved bullet using coaching insights — must pass the Brain Test",
  "reason": "1-2 sentences: what specific information from coaching made this stronger, and what the improvement demonstrates that the original didn't",
  "skillsCount": <number of NEW skills discovered in conversation not already on resume, 0-7>
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