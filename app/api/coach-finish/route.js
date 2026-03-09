import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// ─────────────────────────────────────────────
// WRITING CONSTITUTION
// Applied to every bullet, summary, and job summary written
// ─────────────────────────────────────────────
const WRITING_CONSTITUTION = `
RESUME WRITING STANDARDS — APPLY TO EVERY WORD YOU WRITE:

VOICE & AUTHENTICITY:
- Match language to the candidate's career stage. Students sound like exceptional students. 
  Mid-career professionals sound like confident experts. Executives sound like strategic leaders.
- Never use executive language for early-career or service roles. 
  "Spearheaded strategic customer engagement initiatives" for a cashier is worse than no resume at all.
- Keep responsibility claims believable for the actual job title and experience level.
- Preserve the candidate's natural voice while improving clarity and professionalism.
- Elevate the description of the work — never inflate the responsibility.

BULLET WRITING RULES:
- Start every bullet with a strong action verb appropriate to the role's actual scope.
- Focus on impact and outcomes, not just tasks.
- Maximum bullets per role: 4-6 total. Prioritize ruthlessly — keep only the strongest.
- When a candidate has multiple bullets covering the exact same activity (e.g. 3 bullets all about 
  teaching, or 3 bullets all about performing), consolidate to 1 strong bullet.
- NEVER combine two distinct responsibilities into one bullet just because they share a field or 
  environment. Teaching and performing are different jobs. Managing and training are different jobs. 
  Keep them separate.
- Ask: does this bullet serve the TARGET role? If not, condense it or cut it.
- NEVER include: candidate's age, specific celebrity names, or personal details that would not 
  appear on a professional resume. These feel impressive but hurt credibility.
- Soft details like "performed at a high-profile corporate event with A-list entertainment" are fine. 
  Naming specific celebrities (J.Lo, Pitbull, etc.) is not.
- Skills that appear as resume bullets should be extracted to skillsCategories when possible, 
  not repeated in both places.
- Use specific context to make the work believable (environment, scope, who was involved).
- Show responsibility, judgment, or ownership when the work had it.
- Highlight improvements, problem-solving, or contributions.
- Avoid: "responsible for," "helped with," "assisted with," "worked on."
- Keep each bullet focused on one idea.
- Active voice, direct language.
- Prioritize the most relevant and impressive content first.
- Show why the work mattered.

ACTION VERB CALIBRATION BY LEVEL:
Entry-level: Assisted, Coordinated, Supported, Prepared, Maintained, Tracked, Organized, Contributed
Mid-career: Managed, Developed, Led, Implemented, Improved, Trained, Streamlined, Delivered
Senior: Directed, Established, Transformed, Drove, Oversaw, Championed, Architected, Scaled

METRICS PHILOSOPHY:
- Use metrics when they were provided in coaching. Never invent them.
- When no metrics exist, use trust signals, complexity, scope, and impact language instead.
- "Regularly assigned complex cases due to strong clinical judgment" is a valid achievement.
- "Recognized by peers as a go-to resource for..." is a valid achievement.
- Qualitative value is real value. Write it like it is.

JOB SUMMARY FORMULA:
Role + environment + core responsibility (why this role existed, not what tasks happened)
Example: "Managed acute patient care in a high-volume hospital unit, coordinating with 
multidisciplinary teams to stabilize and monitor patients through treatment and recovery."
NOT: "Provided patient care and assisted doctors."

PROFESSIONAL SUMMARY RULES:
- Structure: Professional identity + area of expertise + impact or direction
- For CORE resumes: do NOT name a specific target company. Position for a role TYPE, not a specific job.
- Do NOT mention the candidate's age or how young they were in any role — ever.
- Do NOT reference age comparatively ("most candidates her age", "unusually young", 
  "for someone her age", "at only X years old"). These read as unprofessional and 
  can invite age discrimination. Strength stands on its own without age context.
- NEVER refer to the candidate in the third person ("she", "he", "they", "her", "him"). 
  Resumes are written in first-person implied (no pronouns). 
  "Brings a performer's instincts" is correct. "She brings a performer's instincts" is never acceptable.
- Lead with the strongest credibility signal, not school enrollment.
- Uses information from: the full resume + career coach context + coaching conversation
- Does NOT repeat bullet points
- Does NOT use generic phrases ("results-driven," "dynamic professional," "proven track record")
- IS a hook and a positioning statement
- Tells the reader what kind of professional this person is and how to read the rest of the resume

SKILLS SECTION RULES:
- Maximum 3 categories for a core resume. 2 is often better.
- Suggested groupings: Technical/Production skills + Professional/Soft skills
- Do not create a category for fewer than 4 skills — merge into another category instead.
- Remove skills that are already well-represented in bullet points unless they are searchable keywords.
- Do not stuff skills — only include what is genuinely demonstrated by the resume content.
- NEVER consolidate specific software tools into suite names (e.g. never replace "Word, Excel, 
  PowerPoint, Outlook" with "Microsoft Office Suite"). ATS systems search for specific tool names. 
  Consolidating loses searchable keywords and can cause ATS rejection. Always keep individual 
  tool names.

EDUCATION SECTION RULES:
- Relevant coursework projects: one line maximum. Lead with what was built/delivered, not the class description.
- Example: "Designed conceptual aerial show for Animal Kingdom including leadership continuity plan" — not a paragraph.
- If a project does not directly support the target role, leave it out entirely.
- GPA, honors, and relevant organizations are appropriate to include for students and recent grads.

SECTION ORDER LOGIC (apply when reordering):
- New graduate with relevant degree, unrelated work → Education first
- Early career with some experience → Experience first  
- Credential-driven roles (RN, CPA, PMP, AWS) → Certifications can precede experience
- Technical candidates → Skills may appear before experience
- Executive resumes → Summary + key achievements first
- Rule: Put the strongest credibility signal first. What convinces a recruiter fastest?

NO HALLUCINATION — ABSOLUTE RULE:
You may ONLY use information explicitly in the resume or extracted during coaching.
NEVER invent metrics, company details, project names, dates, awards, or responsibilities.
If coaching did not surface a number, write around it with qualitative strength.
`

// ─────────────────────────────────────────────
// LEVEL-SPECIFIC WRITING INSTRUCTIONS
// ─────────────────────────────────────────────
const LEVEL_WRITING_INSTRUCTIONS = {
  entry: `
WRITING FOR ENTRY-LEVEL / STUDENT:
This resume should sound like the strongest version of an early-career candidate — 
not a junior executive. Authentic, specific, and impressive for their stage.

Prioritize:
- Relevant experience and what they actually did
- Skills demonstrated through work, school, and activities  
- Growth signals (initiative, learning, responsibility earned)
- Academic achievements when they strengthen the picture

Do NOT:
- Use strategic or executive language
- Inflate simple responsibilities
- Add metrics that were not provided
- Mention how young the candidate was in any role

The goal: A recruiter reads this and thinks "this is a prepared, capable candidate for this level."
`,
  mid: `
WRITING FOR MID-CAREER PROFESSIONAL:
This resume should sound like a confident professional who has earned their expertise.
Specific, grounded, and evidence-based.

Prioritize:
- Growth and expanding responsibility over time
- Leadership activities (training, mentoring, project ownership)
- Process improvements and operational contributions
- Metrics for roles that produce them; trust/complexity signals for roles that do not

Do NOT:
- Write at entry-level (undersells their experience)
- Write at executive level (oversells their scope)
- Use vague claims without grounding them in specifics

The goal: A recruiter reads this and thinks "this person knows their field and gets results."
`,
  senior: `
WRITING FOR SENIOR / EXECUTIVE:
This resume should reflect organizational scope and strategic leadership.
Authoritative, specific about scale, and outcome-focused.

Prioritize:
- Organizational impact (programs built, transformations led)
- Leadership at scale (team size, budget responsibility, cross-functional influence)
- Strategic initiatives with business outcomes
- Developing other leaders, not just doing the work

Do NOT:
- Describe tasks — describe outcomes and influence
- Use hollow strategic language without specifics
- Understate genuine executive scope

The goal: A recruiter reads this and immediately understands the scale of leadership this person operates at.
`
}

// ─────────────────────────────────────────────
// JOB-SPECIFIC WRITING CONSTITUTION
// ─────────────────────────────────────────────
const JS_WRITING_CONSTITUTION = `
JOB-SPECIFIC RESUME WRITING STANDARDS:

GOAL: Maximize this resume's chance of passing ATS and impressing a human recruiter for this specific role.
Two things must be true: the right keywords appear, AND the resume reads as a genuine strong fit.

ATS KEYWORD STRATEGY:
- Missing keywords from the analysis are your primary targets. Work each one in naturally.
- Use the EXACT phrasing from the job description when possible — ATS matches on exact strings.
- If a missing keyword represents something the candidate genuinely has (based on their resume or 
  the coaching conversation), find the bullet or section where it fits most naturally and add it.
- If a missing keyword represents something they partially have, reframe existing experience to 
  surface that skill explicitly.
- If a missing keyword represents a genuine gap, do NOT fabricate it. Leave it out.
- Matched keywords should already appear — confirm they are still present in the rewrite.
- Do not keyword-stuff. Every keyword must appear in a context that makes sense.

BULLET RELEVANCE ORDERING:
- Within each role, reorder bullets so the most JD-relevant appear first.
- A recruiter scanning for 5 seconds will read the first 2 bullets. Make them count.
- Bullets that do not connect to this specific JD can stay but go last.

SUMMARY — THE EMPLOYER-FIRST RULE:
This is the most important section. It is your strongest ATS and recruiter hook.

The cardinal rule: Show employers what THEY GET by hiring this person.
NEVER what the candidate WANTS or is SEEKING.

RIGHT: "Event Coordinator with 3 years of production experience who brings stakeholder 
management, budget oversight, and vendor negotiation to every project."
WRONG: "Seeking an Event Coordinator role where I can grow my skills."
WRONG: "Passionate professional looking for opportunities in event management."
WRONG EVEN IF SUBTLE: "Hoping to bring my skills to a new team."

The summary formula:
[Role title or professional identity] + [2-3 specific skill areas from the JD] + 
[what they DELIVER, not what they want]

The summary should:
- Open with a role descriptor that mirrors the job title (as a noun, not a goal)
- Name 2-3 skills pulled directly from the JD requirements section
- End with what the employer gains — outcomes, impact, reliability, expertise
- NEVER name the company
- NEVER use "seeking," "looking for," "hoping to," "passionate about"
- NEVER write in first person ("I am" or "I bring")
- BE aggressive — this is the hook. Make it land.

SKILLS SECTION:
- Add missing keywords here if they cannot fit naturally into bullets.
- Skills section is a secondary ATS target — bullets are primary.
- Keep skills honest — only add what the coaching conversation or resume supports.
- Never consolidate specific software tool names into suite names (kills ATS matching).

NO HALLUCINATION — ABSOLUTE:
Only add a keyword if the candidate actually has that skill or experience.
Source: their resume OR the coaching conversation.
If neither mentions it, do not add it — even if the JD requires it.
`

// ─────────────────────────────────────────────
// SHARED OUTPUT STRUCTURE
// ─────────────────────────────────────────────
const OUTPUT_STRUCTURE = {
  fullName: "string",
  email: "string",
  phone: "string",
  location: "string",
  linkedin: "string",
  portfolio: "string",
  summary: "string",
  hideSummary: false,
  experience: [{
    title: "string",
    company: "string",
    location: "string",
    startDate: "YYYY-MM",
    endDate: "YYYY-MM or null",
    current: false,
    summary: "string (1-2 sentence job summary — required for all jobs)",
    summaryDismissed: false,
    bullets: ["string"]
  }],
  education: [{
    school: "string",
    degree: "string",
    field: "string",
    graduationDate: "YYYY-MM",
    location: "string",
    lines: ["string"]
  }],
  skillsCategories: {
    "Category Name": ["skill1", "skill2"]
  },
  projects: [{
    name: "string",
    description: "string",
    link: "string"
  }],
  certifications: [{
    name: "string",
    details: "string"
  }],
  volunteer: [{
    organization: "string",
    description: "string"
  }],
  languages: [{
    language: "string",
    proficiency: "string"
  }],
  sectionOrder: ["experience", "education", "skills"]
}

// ─────────────────────────────────────────────
// BUILD JOB-SPECIFIC REWRITE PROMPT
// ─────────────────────────────────────────────
function buildJobSpecificRewritePrompt({ resumeData, conversation, levelInstructions, careerContext, jobDescription, jobTitle, jobCompany, matchedKeywords, missingKeywords }) {
  const contextBlock = careerContext ? `
CAREER CONTEXT:
- Target roles: ${careerContext.target_roles?.join(', ') || jobTitle || 'not specified'}
- Career changer: ${careerContext.is_career_changer ? `YES — from ${careerContext.previous_field}` : 'No'}
- Transferable skills: ${careerContext.transferable_skills?.join(', ') || 'none noted'}
` : ''

  return `${JS_WRITING_CONSTITUTION}

${levelInstructions}

${contextBlock}

TARGET ROLE: ${jobTitle || 'the role'}${jobCompany ? ` at ${jobCompany}` : ''}

JOB DESCRIPTION:
${jobDescription}

ATS KEYWORD ANALYSIS (from pre-coaching assessment):
ALREADY MATCHED — confirm these remain in the rewrite:
${matchedKeywords.length > 0 ? matchedKeywords.map(k => `• ${k}`).join('\n') : '• (none identified)'}

MISSING — these are your primary targets to work in naturally:
${missingKeywords.length > 0 ? missingKeywords.map(k => `• ${k}`).join('\n') : '• (none identified — resume is a strong match already)'}

COACHING CONVERSATION (everything the candidate revealed — use all of it):
${conversation.map(msg => `${msg.role === 'assistant' ? 'Coach' : 'Candidate'}: ${msg.content}`).join('\n\n')}

ORIGINAL RESUME (what you are improving):
${JSON.stringify(resumeData, null, 2)}

YOUR REWRITE INSTRUCTIONS:

1. SUMMARY — Full rewrite required. Apply the employer-first rule. Mirror the job title as a 
   descriptor. Pull the 2-3 strongest skill matches from the JD. End with what the employer gains.
   Never name the company. Never use seeking or looking for. Be aggressive.

2. MISSING KEYWORDS — Work through each one:
   - Does the coaching conversation or resume give you material to support this keyword? Add it.
   - Best location: existing bullet where it fits naturally (reframe the bullet to include it).
   - Second best: new bullet if coaching surfaced relevant experience not yet captured.
   - Third option: skills section if it cannot fit naturally in experience.
   - If you have no material to support it: leave it out entirely.

3. BULLET REORDERING — Within each role, put the most JD-relevant bullets first.
   A recruiter will read the first 2. Make them the strongest match for this specific role.

4. MATCHED KEYWORDS — Verify they are still present and prominent. Do not accidentally remove them.

5. SKILLS SECTION — Add any missing keywords that could not fit into bullets.
   Keep all existing specific tool names — never consolidate into suite names.

6. EVERYTHING ELSE — Apply standard resume writing quality (strong verbs, specific language, 
   no hallucination). But the keyword strategy is the priority for this rewrite.

OUTPUT: Return ONLY valid JSON. No markdown. No explanation. No backticks.
Must match this exact structure:
${JSON.stringify(OUTPUT_STRUCTURE, null, 2)}`
}

// ─────────────────────────────────────────────
// BUILD CHANGES PROMPT (shared by both paths)
// ─────────────────────────────────────────────
function buildChangesPrompt(originalResume, rewrittenResume) {
  return `Compare these two resume versions. List only meaningful changes to bullets, summary, job summaries, and skills.

ORIGINAL:
${JSON.stringify(originalResume, null, 2)}

REWRITTEN:
${JSON.stringify(rewrittenResume, null, 2)}

Return ONLY a valid JSON array. No markdown. No explanation. Max 20 changes — prioritize most impactful.

[
  {
    "field": "experience[0].bullets[1]",
    "section": "Experience | Company Name",
    "type": "improved",
    "before": "original text or null if new",
    "after": "new text",
    "reason": "one sentence explaining why this is better"
  }
]

Types: "improved" | "added" | "removed" | "reordered"
For summary: field = "summary", section = "Summary"
For job summaries: field = "experience[N].summary", section = "Experience | Company Name"
For bullets: field = "experience[N].bullets[M]", section = "Experience | Company Name"
For skills: field = "skillsCategories", section = "Skills"
For section reorder: field = "sectionOrder", section = "Section Order"`
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
      resumeData,       // canonical resume_data (structured JSON)
      conversation,     // full coaching conversation array
      detectedLevel,    // 'entry' | 'mid' | 'senior'
      careerContext,    // from career_context table (optional)
      isJobSpecific,    // boolean
      jobDescription,   // raw JD text
      jobTitle,         // string
      jobCompany,       // string
      matchedKeywords,  // string[] from assess step
      missingKeywords   // string[] from assess step
    } = await request.json()

    if (!resumeData || !conversation) {
      return NextResponse.json({ error: 'resumeData and conversation are required' }, { status: 400 })
    }

    const level = detectedLevel || 'mid'
    const levelInstructions = LEVEL_WRITING_INSTRUCTIONS[level] || LEVEL_WRITING_INSTRUCTIONS.mid

    // ── JOB-SPECIFIC REWRITE PATH ──
    if (isJobSpecific && jobDescription) {
      const jsRewritePrompt = buildJobSpecificRewritePrompt({
        resumeData,
        conversation,
        level,
        levelInstructions,
        careerContext,
        jobDescription,
        jobTitle,
        jobCompany,
        matchedKeywords: matchedKeywords || [],
        missingKeywords: missingKeywords || []
      })

      const rewriteMessage = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        messages: [{ role: 'user', content: jsRewritePrompt }]
      })

      let cleanedRewrite = rewriteMessage.content[0].text.trim()
      if (cleanedRewrite.startsWith('```')) {
        cleanedRewrite = cleanedRewrite.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      }
      const rewrittenResume = JSON.parse(cleanedRewrite)

      const changesPrompt = buildChangesPrompt(resumeData, rewrittenResume)
      const changesMessage = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        messages: [{ role: 'user', content: changesPrompt }]
      })

      let cleanedChanges = changesMessage.content[0].text.trim()
      if (cleanedChanges.startsWith('```')) {
        cleanedChanges = cleanedChanges.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      }

      let changes = []
      try {
        changes = JSON.parse(cleanedChanges)
      } catch (e) {
        console.warn('Changes JSON truncated — continuing without change list')
      }

      return NextResponse.json({ rewrittenResume, changes, detectedLevel: level })
    }

    // ── CORE RESUME REWRITE PATH ──
    const contextBlock = careerContext ? `
CAREER DIRECTION CONTEXT:
- Target roles: ${careerContext.target_roles?.join(', ') || 'not specified'}
- Career goal: ${careerContext.career_goal || 'not specified'}
- Career changer: ${careerContext.is_career_changer ? `YES — from ${careerContext.previous_field} → ${careerContext.target_roles?.join('/')}` : 'No'}
- Skills identified but not yet on resume: ${careerContext.skills_not_on_resume?.join(', ') || 'none'}
- Target timeline: ${careerContext.timeline || 'not specified'}

For career changers: frame transferable skills explicitly. The resume should position this person 
for their TARGET field, not just document their past.
` : ''

    const rewritePrompt = `${WRITING_CONSTITUTION}

${levelInstructions}

${contextBlock}

COACHING CONVERSATION (everything extracted — use all of it):
${conversation.map(msg => `${msg.role === 'assistant' ? 'Coach' : 'Candidate'}: ${msg.content}`).join('\n\n')}

ORIGINAL RESUME DATA (canonical JSON structure — this is what you are improving):
${JSON.stringify(resumeData, null, 2)}

STEP 1 — ASSESS THE STARTING POINT:
Before writing anything, evaluate the original resume quality:

STRONG RESUME (has multiple bullets per role, clear structure, relevant content):
→ Enhancement mode. Preserve what is working. Improve what is weak. Add what is missing.
→ The user built something — respect it and make it better.

BARE-BONES RESUME (1-2 bullets per role, vague descriptions, thin content, or mostly empty):
→ Build mode. The coaching conversation IS the resume. Extract everything from it.
→ Keep any existing content that is accurate, but expect to write most of this from scratch.
→ A bare-bones resume after coaching should look dramatically different. That is the point.

STEP 2 — FILTER THE COACHING CONVERSATION:
The coaching conversation is raw material, not a script. The candidate said things.
YOU decide what belongs on a resume and in what form.

Apply this filter to everything from the conversation:
- Does it demonstrate a skill, achievement, or responsibility relevant to their target role? → Include it
- Is it a specific name, celebrity, personal anecdote, or colorful detail? → Reframe or omit
- Is it a skill hiding inside a story? → Extract to skillsCategories, not a bullet
- Is it an impressive-sounding fact that does not help their job search? → Cut it
- Is it something a professional resume writer would never include? → Do not include it

Examples of the filter in action:
- "I performed at the same event as J.Lo and Pitbull" → becomes: "Performed at major corporate galas and entertainment events requiring professional discretion"
- "I started this job when I was 17" → Cut entirely. Age never belongs on a resume.
- "My manager trusted me more than anyone else" → becomes: "Trusted with [specific responsibility] due to [demonstrated quality]"
- "I kind of helped with social media" → if it is real, write it properly

STEP 3 — SKILLS EXTRACTION FROM EXPERIENCE:
Read every bullet, every job summary, every coaching answer and ask:
"What skill is this person demonstrating that they have not explicitly listed?"

Examples:
- Contingency planning for live shows → Risk Management, Crisis Response
- Coordinating vendors and venues → Vendor Relations, Logistics Coordination  
- Training new staff → Onboarding, Knowledge Transfer, Mentorship
- Managing social media growth → Content Strategy, Community Engagement

These go in skillsCategories. Do NOT create a bullet for every skill — extract them.

STEP 4 — WRITE THE ENHANCED RESUME:

EXPERIENCE (follow this order for each role):
1. Keep every existing bullet that is accurate and genuinely strong — do not touch it
2. Improve bullets that are weak, vague, or task-focused — rewrite in place
3. Add new bullets from coaching that represent achievements not yet on the resume
4. Consolidate when multiple bullets cover the same theme (max 4-6 bullets per role)
5. Add a job summary if missing — Role + environment + core responsibility

PROFESSIONAL SUMMARY:
Full rewrite always — summaries are almost always the weakest part.
Use the entire picture: resume + career context + all coaching.
Position for a role TYPE (not a specific company).
Lead with strongest credibility signal.

SKILLS:
Add skills extracted from both the resume AND the coaching conversation.
Organize into max 3 categories. Merge small ones. Remove what is already in bullets.

EDUCATION:
Preserve as-is unless coursework descriptions are paragraph-length — condense to one line.
Cut coursework that does not support the target role.

SECTION ORDER:
Apply logic only when a structural change clearly serves the candidate better.
Otherwise, leave the structure alone.

OUTPUT: Return ONLY valid JSON. No markdown. No explanation. No backticks.
Must match this exact structure:
${JSON.stringify(OUTPUT_STRUCTURE, null, 2)}`

    const rewriteMessage = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      messages: [{ role: 'user', content: rewritePrompt }]
    })

    let cleanedRewrite = rewriteMessage.content[0].text.trim()
    if (cleanedRewrite.startsWith('```')) {
      cleanedRewrite = cleanedRewrite.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    }

    const rewrittenResume = JSON.parse(cleanedRewrite)

    const changesPrompt = buildChangesPrompt(resumeData, rewrittenResume)

    const changesMessage = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [{ role: 'user', content: changesPrompt }]
    })

    let cleanedChanges = changesMessage.content[0].text.trim()
    if (cleanedChanges.startsWith('```')) {
      cleanedChanges = cleanedChanges.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    }

    let changes = []
    try {
      changes = JSON.parse(cleanedChanges)
    } catch (e) {
      console.warn('Changes JSON truncated or malformed — continuing without change list')
      changes = []
    }

    return NextResponse.json({
      rewrittenResume,
      changes,
      detectedLevel: level
    })

  } catch (error) {
    console.error('Extract achievements error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}