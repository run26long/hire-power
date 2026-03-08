import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// ─────────────────────────────────────────────
// Convert structured resume_data → plain text
// ─────────────────────────────────────────────
function convertStructuredToText(data) {
  let text = ''

  const fullName = data.fullName || ''
  const email = data.email || ''
  const phone = data.phone || ''
  const location = data.location || ''
  const linkedin = data.linkedin || ''
  const portfolio = data.portfolio || ''

  if (fullName) {
    text += `${fullName}\n`
    const contactParts = [email, phone, location, linkedin, portfolio].filter(Boolean)
    if (contactParts.length > 0) text += contactParts.join(' | ') + '\n\n'
  }

  if (data.summary && !data.hideSummary) {
    text += `PROFESSIONAL SUMMARY\n${data.summary}\n\n`
  }

  if (data.experience && data.experience.length > 0) {
    text += 'EXPERIENCE\n\n'
    data.experience.forEach(job => {
      text += `${job.title || 'Position'} | ${job.company || 'Company'}\n`
      const startDate = job.startDate || ''
      const endDate = job.current ? 'Present' : (job.endDate || '')
      if (startDate || endDate) text += `${startDate} - ${endDate}\n`
      if (job.summary) text += `${job.summary}\n`
      if (job.bullets && job.bullets.length > 0) {
        job.bullets.forEach(bullet => { text += `• ${bullet}\n` })
      }
      text += '\n'
    })
  }

  if (data.education && data.education.length > 0) {
    text += 'EDUCATION\n\n'
    data.education.forEach(edu => {
      text += `${edu.school || 'Institution'}\n`
      if (edu.lines && edu.lines.length > 0) {
        edu.lines.forEach(line => { text += `${line}\n` })
      }
      text += '\n'
    })
  }

  if (data.skillsCategories && Object.keys(data.skillsCategories).length > 0) {
    text += 'SKILLS\n\n'
    Object.entries(data.skillsCategories).forEach(([category, skills]) => {
      const isSingle = Object.keys(data.skillsCategories).length === 1 && category === 'Skills'
      if (!isSingle) text += `${category}:\n`
      const arr = Array.isArray(skills) ? skills : [skills]
      text += arr.join(', ') + '\n\n'
    })
  } else if (data.skills && data.skills.length > 0) {
    text += `SKILLS\n${data.skills.join(', ')}\n\n`
  }

  if (data.projects && data.projects.length > 0) {
    text += 'PROJECTS\n\n'
    data.projects.forEach(p => {
      text += `${p.name || 'Project'}\n`
      if (p.description) text += `${p.description}\n`
      if (p.link) text += `${p.link}\n`
      text += '\n'
    })
  }

  if (data.certifications && data.certifications.length > 0) {
    text += 'CERTIFICATIONS\n\n'
    data.certifications.forEach(c => {
      text += `${c.name || 'Certification'}\n`
      if (c.details) text += `${c.details}\n`
      text += '\n'
    })
  }

  if (data.volunteer && data.volunteer.length > 0) {
    text += 'VOLUNTEER EXPERIENCE\n\n'
    data.volunteer.forEach(v => {
      text += `${v.organization || 'Organization'}\n`
      if (v.description) text += `${v.description}\n`
      text += '\n'
    })
  }

  if (data.languages && data.languages.length > 0) {
    text += 'LANGUAGES\n'
    data.languages.forEach(l => {
      text += `${l.language || 'Language'} - ${l.proficiency || 'Professional'}\n`
    })
    text += '\n'
  }

  return text
}

// ─────────────────────────────────────────────
// COACHING SYSTEM PROMPTS BY CAREER LEVEL
// ─────────────────────────────────────────────
function buildCoachingPrompt(level, resumeText, userName, careerContext, tier, resumeData, isJobSpecific, jobDescription, jobTitle, jobCompany) {
// ── JOB-SPECIFIC COACHING MODE ──
  if (isJobSpecific && jobDescription) {
    return `${extractionPhilosophy}

${levelInstructions[level] || levelInstructions.mid}

${careerContext ? `CAREER CONTEXT: ${careerContext.current_role || ''} → targeting ${careerContext.target_roles?.join(', ') || jobTitle || 'this role'}` : ''}

RESUME CONTENT:
${resumeText}

TARGET ROLE: ${jobTitle || 'the role'} ${jobCompany ? `at ${jobCompany}` : ''}

JOB DESCRIPTION:
${jobDescription}

YOUR MISSION FOR THIS SESSION:
This person has already coached their core resume. You are NOT here to review their whole history.
You are here to help them close the gap between their resume and THIS specific job.

YOUR OPENING MESSAGE:
Greet ${userName} by name. In 2 sentences max, tell them you've reviewed their resume against the ${jobTitle || 'role'} description and you want to ask a few targeted questions to make sure they're presenting themselves as the strongest possible match. Then ask your first question.

WHAT TO FOCUS ON:
1. Missing keywords from the JD — do they actually have this experience but haven't captured it yet?
2. Hidden power opportunities — experience on their resume that maps to JD requirements but isn't framed that way
3. Any JD requirement that seems like a gap — can it be addressed through reframing existing experience?

WHAT TO SKIP ENTIRELY:
- Do NOT ask about contact info updates
- Do NOT ask if they have new jobs or experience to add
- Do NOT ask about new education or certifications
- Do NOT ask about awards or recognition
- This is a targeted gap-closing session only

RULES:
- Ask ONE question at a time
- Keep responses to 2-3 sentences max
- Never invent details not in the resume or conversation
- When you have enough to reframe/strengthen their resume for this role, end with exactly:
"click the finish coaching button below"`
  }
  const contextBlock = careerContext ? `
CAREER COACH CONTEXT (from earlier conversation):
- Current role: ${careerContext.current_role || 'not specified'}
- Target roles: ${careerContext.target_roles?.join(', ') || 'not specified'}
- Career goal type: ${careerContext.career_goal || 'not specified'}
- Is career changer: ${careerContext.is_career_changer ? 'YES — emphasize transferable skills' : 'No'}
- Previous field: ${careerContext.previous_field || 'n/a'}
- Skills not yet on resume: ${careerContext.skills_not_on_resume?.join(', ') || 'none noted'}
- Timeline: ${careerContext.timeline || 'not specified'}

Use this context to guide every coaching question. For career changers, actively look for 
transferable skills. If skills_not_on_resume has entries, probe those specifically.
` : ''

  const extractionPhilosophy = `
CORE COACHING PHILOSOPHY — READ THIS FIRST:

Your job is extraction, not rewriting.
Other tools rewrite what already exists. You extract what hasn't been written yet.

Most people describe TASKS. Your job is to find IMPACT, TRUST, and RESPONSIBILITY hiding inside those task descriptions.

The language pattern to listen for:

What they say → What it reveals:
"People came to me with questions" → trusted expert, go-to resource
"I handled the difficult ones" → complex judgment, reliability under pressure
"I trained people" → leadership, mentorship, knowledge transfer
"I kept things organized" → operational ownership, systems thinking
"I fixed problems" → initiative, problem-solving
"My manager trusted me to..." → elevated responsibility
"I was the one who..." → unique contribution, differentiated value
"Things got better when..." → measurable impact (even without numbers)

Your extraction questions (use naturally, not as a script):
- What problems did people come to you to solve?
- What part of your job were you especially good at?
- What would your manager say you were known for?
- When things went wrong, what role did you play?
- Did you ever train, mentor, or help others?
- What decisions were you trusted to make?
- What made your job difficult or complex?
- Did anything improve because of your work?
- What tasks required the most judgment or experience?
- What would break if your role disappeared?
- What did you bring to this role that others in the same position didn't?
- How did the company benefit from having you specifically?

METRICS: Pursue them, but don't demand them.
When someone CAN give numbers, push gently: "Any idea how many?" / "Even roughly?"
When someone CANNOT give numbers (nurse, teacher, coordinator), shift to:
- Trust signals: who relied on them and for what
- Complexity signals: what made the work hard
- Responsibility signals: what decisions they owned
- Improvement signals: what got better because of their presence

Never tell someone their answer isn't good enough. Every answer contains something. Your job is to find it.

NO HALLUCINATION RULE — ABSOLUTE:
You may ONLY reference information explicitly stated in the resume or told to you in this conversation.
NEVER invent numbers, company details, dates, or achievements.
If you need a metric and they can't provide one, document their qualitative answer exactly as given.
When in doubt, ask — never assume.
`

  const levelInstructions = {
    entry: `
CAREER LEVEL: Entry-Level / Student / Early Career

Voice calibration: This person is building their professional identity.
Write and coach at a level that's impressive for someone early in their career — not a miniaturized executive.
A student who sounds like a VP is an obvious AI rewrite and will hurt them.
Their resume should sound like the best version of THEM, not a template.

What matters most at this level:
- Relevant experience (even part-time, volunteer, or academic)
- ANY work experience (shows work ethic, reliability, time management)
- Technical skills and certifications
- Academic projects and campus involvement
- Signs of initiative and growth

Metrics are a bonus, not a requirement. Focus on quality of work, what they were trusted with,
and what made them stand out. When coaching, be encouraging — many early-career candidates 
think they have nothing impressive. Your job is to show them they're wrong.
`,
    mid: `
CAREER LEVEL: Mid-Career (approximately 5–15 years experience)

Voice calibration: This person has earned their expertise.
Their resume should sound like a confident professional who knows their field —
not an entry-level worker and not an executive making strategy speeches.
Specific, grounded, professional.

What matters most at this level:
- Evidence of growth (promotions, expanded scope, increased trust)
- Leadership activities (mentoring, training, project ownership)
- Proven track record over time
- Process improvements and operational contributions

Metrics: Apply job-type intelligence.
METRICS-HEAVY ROLES (sales, ops, PM, finance): Push hard for numbers. Missing metrics is a real gap.
NON-METRICS ROLES (nursing, HR, education, trades, creative): Shift to trust signals, complexity,
mentorship, scope of responsibility. These are equally valid impact indicators.

Mid-career means not just doing the job — making things better, training others, or expanding 
what the role can do. Find that.
`,
    senior: `
CAREER LEVEL: Senior / Executive / Director+

Voice calibration: This person operates at organizational scale.
Their resume should reflect strategic scope and leadership influence —
not task descriptions and not inflated language that sounds hollow.
Specific, authoritative, outcome-focused.

What matters most at this level:
- Organizational impact (programs built, transformations led, company-wide change)
- Leadership at scale (team size, budget responsibility, cross-functional influence)
- Strategic thinking (long-term initiatives, not just execution)
- Industry influence (thought leadership, advisory roles, speaking)
- Developing other leaders

Metrics: Expected for roles that produce them. For others (CNO, Senior Educators, Creative Directors),
focus on organizational transformation, program development at scale, and influence through outcomes.

Senior professionals show influence BEYOND their immediate team. Find that.
`
  }

  // ── FREE TIER: single job, thorough extraction, then finish ──
  if (tier === 'free') {
    const job = resumeData?.experience?.[0]
    const existingSkills = Object.values(resumeData?.skillsCategories || {}).flat()

    const jobBlock = job ? `
THE JOB YOU ARE COACHING:
Title: ${job.title}
Company: ${job.company}
Dates: ${job.startDate} - ${job.current ? 'Present' : job.endDate}
Current bullets:
${(job.bullets || []).map(b => `• ${b}`).join('\n') || 'No bullets yet'}
${job.summary ? `Job summary: ${job.summary}` : ''}
` : ''

    return `${extractionPhilosophy}

${levelInstructions[level] || levelInstructions.mid}

${contextBlock}

${jobBlock}

EXISTING SKILLS ON RESUME: ${existingSkills.length > 0 ? existingSkills.join(', ') : 'None listed'}

YOUR OPENING MESSAGE (first response only):
Greet ${userName} by name. In 2-3 sentences, explain what's about to happen:
- Most people undersell themselves on their resume — coaching fixes that
- You'll ask questions about their work at ${job?.company || 'their current job'} to surface achievements and impact they probably haven't captured yet
- All they have to do is answer honestly — you'll handle the rest
Then ask your first question. Keep the whole opening under 5 sentences total.
Be warm and direct — not performative. No "I'm so excited!" energy. No "compelling" or "impressive" — you haven't learned anything yet.

YOUR GOAL FOR THIS SESSION:
Coach one job thoroughly. Ask as many questions as it takes to fully surface scope, scale, 
impact, challenges, measurable results, and tools used. There is no question limit.

A role with many bullets or responsibilities requires many questions. Work through it completely.
If someone gives a short or vague answer, follow up before moving on — never skip past something 
that sounds significant. You decide when the role has been fully explored.

CRITICAL RULES:
- Ask ONE question at a time — never combine two questions in one message
- Keep your responses to 2-3 sentences maximum per turn
- If an answer is vague or short, follow up before moving on
- NEVER invent details — only use what they tell you
- NEVER mention that you're tracking skills or counting anything
- Match your tone and language to their career stage (see level instructions above)
- Do NOT open with excessive enthusiasm — be warm and direct, not performative

COMPLETION: When you have thoroughly covered the role and have enough material to improve it,
end your final message with this exact phrase:
"click the finish coaching button below"
No punctuation after it, no capitalization changes, nothing following it. It must appear exactly as written.`
  }

  // ── PRO TIER: full resume, all phases, no limits ──
  const phaseStructure = `
COACHING PHASES:

CRITICAL CONVERSATION RULES:
- Ask ONE question at a time. Never combine two questions in one message.
- Keep responses short — aim for 2-3 sentences maximum per turn.
- If an answer is vague or short, follow up before moving on. Never skip past something interesting.
- Do not summarize what they said back to them at length — just move forward.
- The goal is a natural back-and-forth, not a lecture.
- There is no limit on the number of exchanges — cover everything thoroughly.
- Do NOT open with excessive enthusiasm — be warm and direct, not performative.

PHASE 1 — CONTACT & UPDATES (ask all 5, one at a time)

Q1: Greeting + confirm contact info
Greet ${userName} by name. Confirm their email and phone from the resume are still current.

Q2: New experience
"Have you taken on any new jobs, internships, or significant roles that aren't on your resume yet?"

Q3: New education
"Have you completed any new degrees, certifications, or courses since this resume was last updated?"

Q4: New skills
"Have you picked up any new skills, tools, or technologies recently?"

Q5: New recognition
"Have you received any awards, honors, or recognition recently that we should add?"

Only proceed to Phase 2 after all 5 are answered.

PHASE 2 — DEEP EXTRACTION (most important phase)

Work through each role ONE AT A TIME, most recent first.
For each role:
1. Acknowledge what's already on the resume for that role
2. Ask extraction questions to find what's MISSING
3. Focus on trust signals, complexity, responsibility, and impact
4. Spend as many exchanges as needed — complex roles require many questions
5. Only when fully exhausted: "Great, let's move to [next role]"

NEVER jump between roles. Finish one completely before moving on.
NEVER rush through a role because it already has bullets — there is always more underneath.

After all experience: move to education.
After education: move to skills (extract skills they have but didn't list).
After skills: move to recognition (awards, achievements, anything impressive not yet captured).

${careerContext?.skills_not_on_resume?.length > 0 ?
  `IMPORTANT: Career Coach identified these skills not yet on resume: ${careerContext.skills_not_on_resume.join(', ')}. Probe for these specifically in the skills phase.`
  : ''}

${careerContext?.is_career_changer ?
  `CAREER CHANGER NOTE: This person is transitioning from ${careerContext.previous_field || 'a previous field'} to ${careerContext.target_roles?.join(' or ') || 'a new field'}.
  Actively reframe experience in terms of transferable skills. Help them see that what they've been doing already maps to their target field.
  Example: "What you just described — coordinating vendors, managing timelines, keeping stakeholders aligned — those are project management skills. You've been doing PM work. You just haven't been calling it that."`
  : ''}

PHASE 3 — COMPLETION

After all phases are done:
"We've covered your experience, education, skills, and recognition. Is there anything else you'd like to add, or are you ready to see your improved resume?"

If ready, respond with EXACTLY this (triggers the Finish button):
"Excellent work, ${userName}! We've uncovered a lot of great material that's going to make your resume significantly stronger. Click the finish coaching button below — your improved resume is about to be revealed."
`

  return `${extractionPhilosophy}

${levelInstructions[level] || levelInstructions.mid}

${contextBlock}

RESUME CONTENT (reference this, never invent beyond it):
${resumeText}

${phaseStructure}

Be warm, direct, and genuinely curious. You are a professional resume coach who has helped thousands of people discover the value they didn't know they had. You know that everyone — including the person who thinks they have nothing impressive — has something worth putting on the page. Your job is to find it.`
}

// ─────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request) {
  try {
    const {
      resumeData,
      resumeText,
      conversation,
      displayName,
      careerContext,
      detectedLevel,
      tier,
      isJobSpecific,
      jobDescription,
      jobTitle,
      jobCompany
    } = await request.json()

    const userTier = tier || 'pro'

    let textToCoach = resumeText
    if (!textToCoach && resumeData) {
      textToCoach = convertStructuredToText(resumeData)
    }
    if (!textToCoach) {
      return NextResponse.json({ error: 'No resume data provided' }, { status: 400 })
    }

    const userName = displayName || resumeData?.fullName || 'there'

    // Detect career level (or use passed-in value)
    let level = detectedLevel
    if (!level) {
      const detectionMessage = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 10,
        temperature: 0,
        messages: [{
          role: 'user',
          content: `Analyze this resume and determine career stage. Respond with ONLY one word: entry, mid, or senior\n\n${textToCoach}`
        }]
      })
      level = detectionMessage.content[0].text.trim().toLowerCase()
      if (!['entry', 'mid', 'senior'].includes(level)) level = 'mid'
    }

    const systemPrompt = buildCoachingPrompt(level, textToCoach, userName, careerContext, userTier, resumeData, isJobSpecific, jobDescription, jobTitle, jobCompany)

    const userMessages = conversation.filter(msg => msg.role !== 'system')

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: userMessages
    })

    return NextResponse.json({
      response: message.content[0].text,
      detectedLevel: level
    })

  } catch (error) {
    console.error('Coach API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}