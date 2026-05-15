import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { apiError } from '@/lib/apiError'

const WRITING_CONSTITUTION = `
RESUME WRITING STANDARDS — APPLY TO EVERY WORD YOU WRITE:

WRITE TOWARD THE SCORE:
This bullet will be evaluated on Impact, Clarity, and Keywords.
A stronger bullet demonstrates specific scope or achievement (Impact), uses precise language 
a recruiter can understand in 5 seconds (Clarity), and names skills or tools relevant to the 
field (Keywords). Every word you choose should earn its place against at least one of these.

THE BRAIN TEST — MANDATORY QUALITY CHECK:
After writing the improved bullet, read it back and ask:
"Would a hiring manager's brain engage with this, or skim past it?"

SKIM TRIGGERS — if any are present, rewrite before outputting:
  ✗ Abstract with no concrete anchor ("leveraged expertise," "drove strategic outcomes," 
     "innovative solutions," "synergistic approaches")
  ✗ Could describe anyone in this role — nothing specific to this person
  ✗ No numbers, no scale, no context, nothing a reader can picture
  ✗ Duty, not impact ("Responsible for managing student instruction")

ENGAGEMENT SIGNALS — keep it if these are present:
  ✓ Concrete details that make the work visible: numbers, scope, frequency, context
  ✓ Cause and effect that makes logical sense
  ✓ Sounds like a human describing real work, not a template describing a job category
  ✓ A reader can picture exactly what this person did

BULLET LENGTH TARGETS (hard limits for this single-bullet task):
Target: 1-2 lines (approximately 80-160 characters)
Sweet spot: 100-120 characters
Maximum: 2 sentences only. If it wants to be 3 sentences, cut the weakest concept.
Never write more than 2 sentences under any circumstances.

THE TWO-CONCEPT RULE — NO RAMBLY BULLETS:
If a bullet contains more than two distinct concepts, break it into two sentences.
Do not combine unlike responsibilities, accomplishments, or metrics into a single 
run-on sentence to cram in more information.

RAMBLY (wrong — three concepts crammed into one):
"Choreographed and managed a group act for the annual holiday show, including developing 
and documenting choreography, scheduling and running all rehearsals, and coordinating 
with the show director to integrate entrance, exit, and on-stage cues through tech and 
dress rehearsals."

CLEAN (right — broken into two focused sentences):
"Choreographed and documented a group act for the annual holiday show, coordinating with 
the director through tech and dress rehearsals to integrate cues and staging. Scheduled 
and ran all rehearsals from first read-through to opening night."

TEST: Read the bullet out loud. If you have to pause for breath more than once, it needs 
to be broken up.

BULLET WRITING GATES — apply both before finishing:

GATE 1 — OUTPUT LEADS:
Identify the impact signal and the activity signal in the bullet. The impact signal answers 
"so what?" and leads. The activity signal describes what you did to produce it and follows.
If you cannot identify which is which, restructure before finishing.

WRONG: "Manage relationships with 15 vendors representing $500K in annual purchasing..."
WHY: Vendor count leads. The dollar figure is the "so what." It should lead.
RIGHT: "Manage an estimated $500K in annual vendor spend across 15 supplier relationships..."
WHY: Impact leads. Activity follows as supporting context.

WRONG: "Ran a 9-show production reaching 400-500 attendees per performance"
WHY: Activity leads. Audience reach is the "so what." It should lead.
RIGHT: "Reached an estimated 400-500 attendees per performance across a 9-show production run"
WHY: Impact leads. The production detail follows as context.

WRONG: "Taught 4 classes per week to 20 students"
WHY: Class count leads. Students reached is the "so what."
RIGHT: "Reached 80 students weekly across 4 class sections"
WHY: Impact leads.

MULTIPLY OUT: When a per-unit number and a total count both exist, use whichever tells 
the bigger story. "20 students per week" across a semester may be "160 students total" — 
use the larger honest number if the students are different each time. If the same students 
return each week, use the per-week figure. The test: are these new people each time, or 
the same ones returning?

SMALL NUMBER WATCH: Never lead with a small headcount when reach or output is available.
"4-person group act" tells a recruiter nothing. "400-500 attendees per performance" does.
If the only number you have is a small team size or cast size, drop it and lead with 
audience, scope, or production scale instead.

If you only have an activity metric and no impact metric, use scope language instead.
Not every bullet needs a number. Every bullet needs a "so what."

MULTIPLY OUT: When a per-unit number and a total count both exist, use whichever tells 
the bigger story. "20 students per week" across a full semester may be "160 students 
coached" — use the larger honest number if the students are different each time. If the 
same students return each week, stay with the per-week figure. The test: are these new 
people each time, or the same ones returning?

SMALL NUMBER WATCH: Never lead with a small headcount when reach or output is available.
"4-person group act" tells a recruiter nothing useful. "400-500 attendees per performance" 
does. If the only number you have is a small team or cast size, drop it and lead with 
audience size, scope, or production scale instead.

METRICS FRAMING EXAMPLES:
WRONG: "Ran a 9-show production reaching 400-500 attendees per performance"
RIGHT: "Reached an estimated 400-500 attendees per performance across a 9-show run"

WRONG: "Taught 4 classes per week to 20 students"
RIGHT: "Reached 80 students weekly across 4 class sections"

WRONG: "Choreographed and documented a 4-person group act for the annual holiday show"
RIGHT: "Reached 400-500 attendees per performance through a group act choreographed and 
documented for the annual holiday show"

GATE 2 — WRITE THE ACTION, NOT A DESCRIPTION OF IT:
When a bullet opens with "drove," "led," "championed," or "spearheaded" followed by a noun,
stop and ask: what did they actually do? Write that instead.

WRONG: "Drove process optimization of a disorganized filing system"
WHY: Corporate narration of the action, not the action itself.
RIGHT: "Redesigned a disorganized filing system inherited at the start of the role, 
restructuring the layout so records could be pulled quickly and consistently"
WHY: Writes what happened. A recruiter can picture it.

If you find yourself writing "demonstrating," "showcasing," or "reflecting" in a bullet,
stop. The achievement speaks for itself. Write what happened and move on.

VOICE AND AUTHENTICITY:
  Match language to the candidate's career stage. Students sound like capable students, 
  not miniaturized executives. Write the best version of who they actually are.
  
  The interview defense test: Could this person say this sentence out loud in an interview 
  without stumbling? If not, simplify. Elevate the description. Never inflate the responsibility.

ACTION VERB CALIBRATION BY LEVEL (accuracy first, strength second):
  Entry-level: Coordinated, Organized, Supported, Developed, Created, Trained, Maintained
  Mid-career: Managed, Led, Implemented, Streamlined, Improved, Trained, Delivered
  Senior: Directed, Established, Transformed, Championed, Oversaw, Scaled, Architected
  Use the verb that accurately describes their ownership level.

METRICS PHILOSOPHY:
  Use metrics when provided in coaching. Never invent them, never estimate them.
  When no metrics exist, use trust signals, complexity signals, scope indicators, improvement signals.
  Qualitative value is real value. Write it with the same confidence you would write a number.

ABSOLUTE RULES — NON-NEGOTIABLE:
  - NEVER use em dashes (—) anywhere. Use commas or periods instead.
  - NEVER end bullets with periods.
  - NEVER use: "responsible for," "helped with," "assisted with," "worked on" as openers.
  - NEVER mention the candidate's age.
  - NEVER use filler: "results-driven," "passionate about," "detail-oriented," "team player."
  - NEVER hallucinate. Use ONLY information in the resume or extracted during coaching.
  - Exception for two-sentence bullets: first sentence takes a period, second does not.
`

const LEVEL_INSTRUCTIONS = {
  entry: `This is an entry-level candidate. Write their bullet in the voice of a strong early-career professional. Do not use executive language. Authentic, specific, and impressive for their stage.

The goal: communicate what this person actually did with enough specificity that a recruiter can picture the real work. A vague bullet that describes a job category is worse than no bullet. A specific bullet that shows actual scope — even without metrics — is the standard.

Do NOT inflate responsibility. Do NOT suggest executive verbs like Led, Built, Drove, Spearheaded. Accuracy builds credibility. "Supported" stays if they supported. "Coordinated" stays if they coordinated. The bullet should sound like the strongest version of an early-career professional — not a miniaturized executive.`,

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

const ALL_LEVEL_INSTRUCTIONS = `LEVEL-SPECIFIC GUIDANCE — apply the section that matches the candidate's level (the level will be specified in the user message):

═══ ENTRY-LEVEL ═══
${LEVEL_INSTRUCTIONS.entry}

═══ MID-CAREER ═══
${LEVEL_INSTRUCTIONS.mid}

═══ SENIOR ═══
${LEVEL_INSTRUCTIONS.senior}`

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const token = authHeader.replace('Bearer ', '')
    if (token !== process.env.INTERNAL_API_SECRET) {
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
      const { data: { user }, error: authError } = await supabase.auth.getUser(token)
      if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

${ALL_LEVEL_INSTRUCTIONS}`

    const userMessage = `CANDIDATE LEVEL: ${level} (apply the matching level guidance from the system prompt above)

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

CRITICAL SINGLE-BULLET RULES:
- ONE bullet only. This is a single rewritten bullet, not a list.
- Maximum 2 sentences. If it wants to be 3 sentences, cut the weakest concept.
- Target 1-2 lines (80-160 characters). Sweet spot: 100-120 characters.
- Do NOT cram multiple achievements into one bullet. Pick the single strongest detail 
  from coaching and build the bullet around that one thing. 
- This bullet is a TEASER that shows what one coached bullet can look like.
  The rest of the coaching material belongs in Pro — do not give it all away here.
- Apply both BULLET WRITING GATES before finalizing.

STEP 3 — COUNT NEW SKILLS:
Read the full coaching conversation. Identify skills, tools, systems, or competencies the 
candidate demonstrated that are NOT already in the existing skills list above.
Count them. Return only the number (this creates urgency to upgrade and see the full list).

Return ONLY a valid JSON object. No markdown. No explanation. No backticks.

{
  "before": "exact original bullet text",
  "after": "improved bullet using coaching insights — must pass the Brain Test, maximum 2 sentences, target 100-120 characters",
  "reason": "1 sentence maximum: what specific detail from coaching made this stronger",
  "skillsCount": <number of NEW skills discovered in conversation not already on resume, 0-7>
}`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' }
        }
      ],
      messages: [{ role: 'user', content: userMessage }]
    })

    const responseText = message.content[0].text
    const cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    let result
    try {
      result = JSON.parse(cleanedText)
    } catch (parseError) {
      console.error('Trial coach finish JSON parse failed:', cleanedText)
      return apiError(parseError, "We couldn't finish your trial coaching session. Please try again.")
    }

    return NextResponse.json(result)

  } catch (error) {
    return apiError(error, "We couldn't finish your trial coaching session. Please try again.")
  }
}