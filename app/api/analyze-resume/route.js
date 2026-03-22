import Anthropic from '@anthropic-ai/sdk'

// Convert structured resume data to plain text for analysis
function convertStructuredToText(data) {
  let text = ''
  
  // Contact - handle both nested and flat structure
  const fullName = data.contact?.fullName || data.fullName || ''
  const email = data.contact?.email || data.email || ''
  const phone = data.contact?.phone || data.phone || ''
  const location = data.contact?.location || data.location || ''
  const linkedin = data.contact?.linkedin || data.linkedin || ''
  const portfolio = data.contact?.portfolio || data.portfolio || ''
  
  if (fullName) {
    text += `${fullName}\n`
    const contactParts = [email, phone, location, linkedin, portfolio].filter(Boolean)
    if (contactParts.length > 0) {
      text += contactParts.join(' | ') + '\n\n'
    }
  }
  
  // Summary
  if (data.summary && !data.hideSummary) {
    text += `PROFESSIONAL SUMMARY\n${data.summary}\n\n`
  }
  
  // Experience
  if (data.experience && data.experience.length > 0) {
    text += 'EXPERIENCE\n\n'
    data.experience.forEach(job => {
      text += `${job.title || 'Position'} | ${job.company || 'Company'}\n`
      const startDate = job.startDate || ''
      const endDate = job.current ? 'Present' : (job.endDate || '')
      if (startDate || endDate) {
        text += `${startDate} - ${endDate}\n`
      }
      
      // Summary paragraph (if exists)
      if (job.summary) {
        text += `${job.summary}\n`
      }
      
      // Bullets array
      if (job.bullets && job.bullets.length > 0) {
        job.bullets.forEach(bullet => {
          text += `• ${bullet}\n`
        })
      }
      
      text += '\n'
    })
  }
  
  // Education
  if (data.education && data.education.length > 0) {
    text += 'EDUCATION\n\n'
    data.education.forEach(edu => {
      text += `${edu.school || 'Institution'}\n`
      
      // Flexible lines array
      if (edu.lines && edu.lines.length > 0) {
        edu.lines.forEach(line => {
          text += `${line}\n`
        })
      }
      
      text += '\n'
    })
  }
  
  // Skills - handle both categorized and flat
  if (data.skillsCategories && Object.keys(data.skillsCategories).length > 0) {
    text += 'SKILLS\n\n'
    Object.entries(data.skillsCategories).forEach(([category, skills]) => {
      const isSingleCategory = Object.keys(data.skillsCategories).length === 1 && category === 'Skills'
      
      if (!isSingleCategory) {
        text += `${category}:\n`
      }
      
      const skillsArray = Array.isArray(skills) ? skills : [skills]
      text += skillsArray.join(', ') + '\n\n'
    })
  } else if (data.skills && data.skills.length > 0) {
    text += `SKILLS\n${data.skills.join(', ')}\n\n`
  }
  
  // Projects
  if (data.projects && data.projects.length > 0) {
    text += 'PROJECTS\n\n'
    data.projects.forEach(project => {
      text += `${project.name || 'Project'}\n`
      if (project.description) text += `${project.description}\n`
      if (project.link) text += `${project.link}\n`
      text += '\n'
    })
  }
  
  // Certifications
  if (data.certifications && data.certifications.length > 0) {
    text += 'CERTIFICATIONS\n\n'
    data.certifications.forEach(cert => {
      text += `${cert.name || 'Certification'}\n`
      if (cert.details) text += `${cert.details}\n`
      text += '\n'
    })
  }
  
  // Volunteer
  if (data.volunteer && data.volunteer.length > 0) {
    text += 'VOLUNTEER EXPERIENCE\n\n'
    data.volunteer.forEach(vol => {
      text += `${vol.organization || 'Organization'}\n`
      if (vol.description) text += `${vol.description}\n`
      text += '\n'
    })
  }
  
  // Languages
  if (data.languages && data.languages.length > 0) {
    text += 'LANGUAGES\n'
    data.languages.forEach(lang => {
      text += `${lang.language || 'Language'} - ${lang.proficiency || 'Professional'}\n`
    })
    text += '\n'
  }
  
  return text
}

// ENTRY-LEVEL PROMPT - Evaluation criteria based
const ENTRY_LEVEL_PROMPT = `You are evaluating an ENTRY-LEVEL candidate (Student, Intern, Coordinator, Assistant, Entry-level position).

CORE SCORING PHILOSOPHY — READ THIS FIRST:
A perfect score means the resume is doing everything possible to communicate this person's value to an employer — not that the person has an impressive career. Your job is to evaluate how well the resume represents what this candidate has done, not how impressive their background is.

CRITICAL DISTINCTION — HAS EXPERIENCE vs. COMMUNICATES EXPERIENCE EFFECTIVELY:
Two candidates can have identical experience. One communicates it with specificity, scope, and strong language. The other describes it vaguely with weak verbs and no details. They should NOT score the same. The resume that communicates well scores higher — always.

Example: "taught aerial arts classes" vs. "taught 60+ students weekly across 8 disciplines, building two classes from zero to full capacity in 4 months" — same job, dramatically different communication quality. Score the communication, not the existence of the experience.

EVALUATION CRITERIA (Total: 100 points)

1. IMPACT DEMONSTRATION (40 points)

Evaluate whether the resume COMMUNICATES the candidate's experience effectively:

TIER 1 — HIGHEST VALUE (Experience communicated with specificity):
- Relevant work experience described with scope, scale, and concrete detail
- ANY work experience described specifically enough to demonstrate work ethic, reliability, and professional behavior
- Technical skills named specifically (tools, systems, certifications)
- Projects or activities described with outcomes or scope, not just titles

TIER 2 — SUPPORTING VALUE:
- Relevant experience present but described vaguely — partial credit, flagged as improvement opportunity
- Academic achievement when communicated with specifics (GPA, honors, relevant coursework)

SCORING GUIDANCE:
- Strong relevant experience + communicated specifically = 34-38/40
- Strong relevant experience + communicated vaguely = 24-28/40 (the vagueness is the gap, not the experience)
- Limited experience + communicated well = 26-30/40
- Limited experience + communicated vaguely = 18-24/40

Quantified metrics are a BONUS when present, NOT a requirement. Do NOT penalize for lack of numbers if scope and specificity are otherwise strong. DO penalize for vague language regardless of whether metrics are present.

ANCHOR EXAMPLES — use these to calibrate your scoring:

IMPACT 28-30/40 (experience present, communication poor):
"Teach a variety of aerial arts and fitness classes to aspiring aerial artists, both youth and adult."
"Provided sport-specific expertise for athletes of all ages."
These tell a recruiter almost nothing about scale, scope, or what was actually taught.

IMPACT 35-37/40 (experience present, communication strong — realistic ceiling for most entry-level):
"Teach silk and hammock classes capped at 10 students each, building both class sections 
from zero enrollment to consistently full within 4 months."
"Coached classes of 10-15 athletes across recreational, competition team, and private lesson 
formats, working primarily with youth ages 5-15 through advanced competitive levels."
These give a recruiter a clear picture of real work at real scale.

IMPORTANT CEILING RULE FOR ENTRY-LEVEL:
A student with 1-2 jobs, no matter how well communicated, should score 35-37/40 on Impact maximum.
Scores of 38-40/40 require genuinely exceptional breadth — multiple roles, significant leadership,
measurable organizational impact. This is rare at the entry level and should be scored accordingly.
Strong communication of ordinary student experience earns 34-36/40. Not 38-40/40.

IMPACT 22-26/40 (experience present, communication consistently poor):
"Teach a variety of aerial arts and fitness classes to aspiring aerial artists, both youth and adult."
"Provided sport-specific expertise for athletes of all ages."
"Support all aspects of live events, including choreography, rigging and stage management."
When nearly every bullet is this vague — no scale, no discipline names, no scope, no outcomes — 
the resume is failing at its primary job even if the underlying experience is strong.
Score the resume for what it actually communicates, not what the candidate probably did.

The difference between these is NOT the experience — it's the communication. Score accordingly.
"Teach a variety of aerial arts and fitness classes to aspiring aerial artists, both youth and adult."
"Provided sport-specific expertise for athletes of all ages."
"Support all aspects of live events, including choreography, rigging and stage management."
When nearly every bullet is this vague — no scale, no discipline names, no scope, no outcomes — 
the resume is failing at its primary job even if the underlying experience is strong.
Score the resume for what it actually communicates, not what the candidate probably did.

The difference between these is NOT the experience — it's the communication. Score accordingly.

Job-type intelligence: Roles in nursing, education, creative fields, and physical performance typically produce fewer quantifiable metrics. Evaluate by specificity and scope of description, not presence of numbers.

2. CLARITY & PROFESSIONALISM (40 points)

Evaluate whether the resume demonstrates:
- Strong action verbs showing ownership (not weak verbs like "helped," "assisted," "responsible for," "worked on")
- Specific, concrete descriptions rather than vague duties — this is the primary clarity signal
- Professional language with proper grammar and spelling
- Appropriate level of detail (not too sparse, not overly wordy)

SCORING GUIDANCE:
- Strong verbs + specific descriptions throughout = 35-38/40
- Mixed quality — some strong, some vague = 28-32/40
- Predominantly weak verbs and vague descriptions = 20-26/40

3. KEYWORDS & RELEVANCE (20 points)

Entry-level candidates naturally have fewer skills than those with 10+ years of experience. Evaluate whether they have:
- Industry-relevant vocabulary for their target field (basic to intermediate terminology expected)
- Specific tool, software, and system names rather than generic categories
- Role-appropriate professional vocabulary

Missing expected basics (computer skills, relevant certifications, field-specific terminology) represents coaching opportunities. Missing skills they likely possess but didn't document should be flagged as suggestions, not scored as hard gaps.

NO HALLUCINATION: Only evaluate what's explicitly stated. Do NOT assume or fabricate achievements.

FEEDBACK GUIDELINES:
- Strengths: Reference specific content and explain WHY it communicates effectively
- Weaknesses: Focus on vague language, missing specificity, and weak verbs — not on missing career achievements
- Suggestions: Provide concrete examples of how to communicate existing experience more specifically
- Do NOT critique summary length or formatting preferences
- Do NOT penalize for lacking industry influence, publications, or advanced credentials`

// MID-LEVEL PROMPT - Evaluation criteria based
const MID_LEVEL_PROMPT = `You are evaluating a MID-CAREER candidate (Manager, Specialist, Professional with 5-15 years experience).

CORE SCORING PHILOSOPHY — READ THIS FIRST:
A perfect score means the resume is doing everything possible to communicate this person's value to an employer — not that the person has an impressive career. Your job is to evaluate how well the resume represents what this candidate has done, not how impressive their trajectory looks.

IMPORTANT: Most mid-career professionals are excellent at their jobs without dramatic progression or transformation stories. A skilled ICU nurse with 10 years of experience who has not been promoted is not a weak candidate. A technical writer who has mastered their craft over 15 years without becoming a manager is not a weak candidate. Evaluate the quality and clarity of what they communicate about their work — not whether their career arc looks impressive on paper.

Career progression is a BONUS signal when present. It is NOT a requirement for a strong score.

EVALUATION CRITERIA (Total: 100 points)

1. IMPACT DEMONSTRATION (40 points)

Evaluate whether the resume communicates the scope, quality, and value of their work:

PRIMARY SIGNALS (always relevant, regardless of role type):
- Scope of responsibility: how much, how many, how often, how complex
- Quality of work communicated: specific enough that a recruiter can picture the actual work
- Sustained contribution: evidence of consistent, reliable performance over time
- Ownership: language that shows they were responsible, not just present

SECONDARY SIGNALS (valuable when present, not required):
- Career progression (promotions, expanded scope) — a bonus, not a baseline
- Training or mentoring others — valuable evidence of expertise, not universally expected
- Process improvements — strong when present, not a gap when absent

JOB-TYPE INTELLIGENCE — CRITICAL:
METRICS-HEAVY ROLES (Sales, Operations, Project Management, Finance, Marketing):
Quantification is standard for these roles. If metrics are completely absent from a resume 
where numbers are the natural language of the work, that is a real communication gap.
Missing revenue figures, efficiency percentages, or team sizes in a sales or ops role 
means the resume isn't telling the full story.

NON-METRICS ROLES (Nursing, HR, K-12 Education, Social Work, Skilled Trades, Creative Fields,
Technical Writing, Administrative roles, and many others):
These roles demonstrate impact through scope, trust, complexity, and quality — not numbers.
A skilled nurse, a master welder, an experienced HR manager, or a seasoned technical writer 
can score 36-38/40 on Impact without a single percentage or dollar figure.
Evaluate these resumes on: caseload size, complexity of work, trust signals, 
scope of responsibility, and the specificity with which they describe their work.
Do NOT treat absence of metrics as a deficit for these role types.

SCORING GUIDANCE:
- Metrics-heavy role WITH strong quantification + specific descriptions = 36-40/40
- Metrics-heavy role WITHOUT any quantification = 24-30/40 (real gap for this role type)
- Non-metrics role WITH specific scope/complexity/trust descriptions = 35-38/40
- Non-metrics role WITH vague descriptions = 22-28/40 (vagueness is the gap, not the role type)
- Any role with strong, specific communication of actual work performed = rewarded appropriately

2. CLARITY & PROFESSIONALISM (40 points)

Evaluate whether the resume demonstrates:
- Strong action verbs showing ownership and appropriate level of responsibility
- Specific, concrete descriptions — not vague duties
- Professional language with proper grammar and spelling
- Appropriate level of detail for the role and career stage

Watch for: hollow strategic language ("leveraged synergies," "drove transformation," "spearheaded 
innovative solutions") with no specific details. This scores LOW on clarity regardless of level.
Specific, direct language about real work scores HIGH regardless of how "executive" it sounds.

CLARITY ANCHOR EXAMPLES:

CLARITY 28-30/40 (weak verbs, passive constructions, vague language throughout):
"Utilize external resources to translate manuals for distribution in international markets."
"Working collaboratively with engineering and marketing teams, test samples, write instructions."
"Provide innovative marketing solutions to small businesses lacking an internal marketing team."
"Help several small businesses reposition and achieve significant sales increases."
These read as duty descriptions. The verbs are weak ("utilize," "provide," "help," "working").
Nothing specific enough for a recruiter to picture the actual work.

CLARITY 33-36/40 (strong verbs, specific descriptions, direct ownership language):
"Produced 600+ documentation deliverables for Dual and Jensen over a 24-year engagement."
"Built Dual Electronics' documentation architecture from the ground up, establishing layout 
standards and style guides that governed 20 years of product releases."
"Managed 12-15 documentation projects per month for Baccus Global Brands."
Direct, specific, active. A recruiter can picture exactly what this person did.

The difference is not seniority — it is the precision and directness of the language.
A resume full of "utilize," "assist," "provide," and passive constructions scores in the 
26-30 range on Clarity regardless of how many years of experience the candidate has.

3. KEYWORDS & RELEVANCE (20 points)

Mid-career professionals should demonstrate comprehensive field vocabulary. Evaluate whether they show:
- Industry-relevant skills and professional terminology appropriate to their field and level
- Specific tool, system, and software names
- Role-appropriate vocabulary showing depth of experience

NO HALLUCINATION: Only evaluate explicit content. Do NOT invent metrics or assume achievements.

FEEDBACK GUIDELINES:
- Strengths: Reference specific content and explain why it communicates effectively
- Weaknesses: Focus on vague language, missing specificity, and weak verbs. For metrics-heavy roles, flag missing quantification. For non-metrics roles, focus on scope and specificity gaps instead
- Suggestions: Provide concrete, role-appropriate examples of how to communicate existing experience more specifically
- Do NOT critique summary length or formatting preferences
- Do NOT flag missing career progression as a weakness unless the resume lacks other evidence of impact
- Do NOT penalize for lacking industry influence, publications, speaking engagements, or thought leadership`

// SENIOR-LEVEL PROMPT - Evaluation criteria based
const SENIOR_LEVEL_PROMPT = `You are evaluating a SENIOR-LEVEL candidate (15+ years of experience, including experienced individual contributors, organizational leaders, and executives).

CORE SCORING PHILOSOPHY — READ THIS FIRST:
A perfect score means the resume is doing everything possible to communicate this person's value to an employer — not that the person has had an impressive career trajectory. Your job is to evaluate how well the resume represents what this candidate has actually done.

CRITICAL: "Senior" describes experience level, not organizational rank. A 20-year technical writer, a veteran ICU nurse, a master tradesperson, and a VP of Sales are all senior-level by tenure. They should be evaluated against what is realistic and expected for their specific role type — not against a universal executive standard.

TWO DISTINCT TRACKS — DETERMINE WHICH APPLIES BEFORE SCORING:

TRACK A — SENIOR BY TENURE AND EXPERTISE (most common):
Experienced individual contributors, independent practitioners, specialists, and subject matter experts 
with 15+ years in their field. These candidates have deep expertise and sustained contribution.
Examples: senior technical writer, veteran nurse, master welder, experienced accountant, 
seasoned consultant, long-tenured sales professional, independent practitioner of any kind.
What to evaluate: depth of expertise, scope of work, quality of communication, sustained reliability,
and any evidence of influence beyond their immediate role (training others, developing processes, 
advising others in their field). Career progression and organizational leadership are bonuses, not requirements.

TRACK B — SENIOR BY ORGANIZATIONAL RANK:
Candidates who have held formal leadership roles at significant organizational scale — 
Directors, VPs, C-suite executives, Department Heads with budget and team responsibility.
What to evaluate: organizational impact, team and budget scale, strategic decisions made,
business outcomes achieved. More is expected here in terms of scope and organizational influence.

INDUSTRY INFLUENCE (speaking, publications, advisory boards, thought leadership):
This applies to approximately 1% of professionals. It is ONLY relevant for scores above 88-90.
It should NEVER be a baseline expectation, and its absence should NEVER be flagged as a weakness
unless the candidate is clearly positioned at a national or industry-leadership level.
A VP of Business Development, a Chief Nursing Officer, a veteran technical writer, or an 
experienced operations manager should NEVER be penalized for not having speaking engagements.

EVALUATION CRITERIA (Total: 100 points)

1. IMPACT DEMONSTRATION (40 points)

FOR TRACK A (Senior by Tenure and Expertise) — evaluate:
- Scope and scale of work clearly communicated (volume, complexity, range, longevity)
- Depth of expertise demonstrated through specific, field-appropriate language
- Sustained reliability and quality over time
- Any influence beyond immediate role: training others, developing processes, advising, 
  improving systems — valued when present, NOT required when absent
- For metrics-appropriate roles (sales, finance, operations): quantification expected
- For non-metrics roles (healthcare, education, creative, technical, trades): specificity 
  and scope signals are equally valid

SCORING GUIDANCE FOR TRACK A:
- Deep expertise + communicated with strong specificity and scope = 34-38/40
- Deep expertise + communicated vaguely = 24-28/40 (vagueness is the gap)
- Evidence of influence beyond immediate role (training, processes, advising) = bonus 2-4 points
- No career progression or organizational leadership = NOT a deduction

IMPACT ANCHOR EXAMPLES FOR TRACK A:

IMPACT 24-26/40 (impressive background, vague communication):
A 24-year freelance technical writer with Fortune 500 clients whose resume says:
"Create owner's manuals for multiple consumer electronics product lines."
"Utilize external resources to translate manuals for international markets."
"Provide additional writing, graphic design, and web development services."
The client names are impressive. The work description tells a recruiter almost nothing 
about volume, scale, complexity, or what this person actually produced. A client list 
is not impact demonstrated — it is impact implied. Score the communication, not the implication.

IMPACT 34-36/40 (same background, specific communication):
"Produced 600+ documentation deliverables for Dual and Jensen over a 24-year engagement,
reaching tens of millions of end users through printed manuals and digital guides."
"Built Dual Electronics' documentation architecture from the ground up, establishing 
standards that governed 20 years of product releases."
"Managed 12-15 documentation projects per month for Baccus Global Brands across 10+ 
product lines including Black & Decker, DeWalt, and Stanley."
Same career, same clients. Completely different communication quality.

CRITICAL RULE: A prestigious client list in a job summary does NOT earn high Impact points 
on its own. The bullets must communicate specific scope, volume, complexity, or outcomes. 
If the bullets are vague duty descriptions, Impact scores in the 22-28 range regardless 
of how impressive the client names are.

FOR TRACK B (Senior by Organizational Rank) — evaluate:
- Organizational impact: what changed, improved, or was built because of their leadership
- Scale indicators: team size, budget responsibility, geographic or cross-functional scope
- Business outcomes: revenue, cost, efficiency, growth — for roles that produce these metrics
- Strategic decisions made, not just tasks executed
- Development of others: building teams, developing talent, creating programs

SCORING GUIDANCE FOR TRACK B:
- Clear organizational impact + strong metrics for metrics-appropriate roles = 36-40/40
- Organizational scope present but vaguely described = 28-34/40
- Leadership described in task language rather than outcome language = 26-32/40
- Strong non-metrics impact (program development, organizational transformation, scale) = 34-38/40

JOB-TYPE INTELLIGENCE (applies to both tracks):
METRICS-HEAVY ROLES (Sales, Operations, Finance, Manufacturing leadership):
Quantification is the natural language of these roles. Missing revenue, efficiency, or growth 
figures when the role clearly produces them is a real communication gap.

NON-METRICS ROLES (Healthcare leadership, Education, Creative direction, Technical fields,
Independent practice, Administrative leadership, Skilled trades at scale):
Impact demonstrated through scope, program development, team influence, quality outcomes,
and depth of expertise. These candidates can score 35-38/40 without financial metrics.

2. CLARITY & PROFESSIONALISM (40 points)

Evaluate whether the resume demonstrates:
- Strong action verbs calibrated to their actual scope and ownership level
- Specific, concrete descriptions — not vague duties or hollow executive language
- Professional language with proper grammar and spelling
- Appropriate level of detail for their career stage and role type

Watch for: hollow strategic language ("leveraged synergies," "drove transformation," "spearheaded 
innovative solutions") with no specific details. This scores LOW on clarity regardless of level.
Specific, direct language about real work scores HIGH regardless of how "executive" it sounds.

3. KEYWORDS & RELEVANCE (20 points)

Evaluate whether they demonstrate:
- Comprehensive, field-appropriate vocabulary for their specific role and industry
- Specific tool, system, software, and methodology names
- Role-appropriate professional terminology reflecting depth of experience

NO HALLUCINATION: Only evaluate explicit content. Do NOT invent achievements or assume scope.

FEEDBACK GUIDELINES:
- Strengths: Reference specific content and explain why it communicates effectively
- Weaknesses: Focus on vague language, missing specificity, and scope gaps — calibrated to their track
  For metrics-heavy roles: flag missing quantification
  For non-metrics roles: flag vague descriptions and missing scope indicators
  For Track B: flag missing organizational outcomes and impact language
- Suggestions: Provide concrete, role-appropriate examples calibrated to their actual career type
- Do NOT critique summary length or formatting preferences
- Do NOT flag missing industry influence (speaking, publications, advisory roles) as a weakness
  unless the candidate is explicitly positioned at a national or industry-leadership level
- Do NOT penalize Track A candidates for lacking organizational leadership credentials
- Do NOT use executive buzzwords as the benchmark for clarity — direct, specific language wins`

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request) {
  try {
    console.log('=== ANALYZE RESUME API CALLED ===')
    const { resumeText, resumeData } = await request.json()
    
    // Handle both formats: plain text OR structured data
    let textToAnalyze = resumeText
    
    if (!textToAnalyze && resumeData) {
      // Convert structured data to text
      textToAnalyze = convertStructuredToText(resumeData)
      console.log('Converted structured data to text')
    }
    
    console.log('Resume text length:', textToAnalyze?.length || 0)
    
    if (!textToAnalyze) {
      throw new Error('No resume data provided')
    }

    // STEP 1: DETECT CAREER STAGE
    const detectionPrompt = `Analyze this resume and determine the career stage:

${textToAnalyze}

Based on:
- Years of experience (from dates)
- Job titles and progression
- Leadership indicators
- Scope and complexity

Respond with ONLY one word: entry, mid, or senior`

    const detectionMessage = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 10,
      temperature: 0,  // Deterministic detection
      messages: [{
        role: 'user',
        content: detectionPrompt
      }]
    })

    const detectedLevel = detectionMessage.content[0].text.trim().toLowerCase()
    console.log('Detected career level:', detectedLevel)

    // STEP 2: SELECT APPROPRIATE PROMPT
    let systemPrompt
    let detectedLevelFormatted
    
    if (detectedLevel.includes('entry')) {
      systemPrompt = ENTRY_LEVEL_PROMPT
      detectedLevelFormatted = 'entry'
      console.log('Using ENTRY-LEVEL evaluation criteria')
    } else if (detectedLevel.includes('senior')) {
      systemPrompt = SENIOR_LEVEL_PROMPT
      detectedLevelFormatted = 'senior'
      console.log('Using SENIOR-LEVEL evaluation criteria')
    } else {
      systemPrompt = MID_LEVEL_PROMPT
      detectedLevelFormatted = 'mid'
      console.log('Using MID-CAREER evaluation criteria')
    }

    // STEP 3: ANALYZE WITH APPROPRIATE CRITERIA
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      temperature: 0,  // Deterministic scoring
      messages: [{
        role: 'user',
        content: `${systemPrompt}

Analyze this resume:
${textToAnalyze}

STRENGTHS (3-5 specific things done well):
- Reference actual content
- Explain WHY it's effective for this career stage

WEAKNESSES (3-5 areas needing improvement):
- Identify specific quantification opportunities when applicable
- Point out weak language or vague descriptions
- Note missing elements expected at this career stage
- Do NOT critique summary length or formatting

SUGGESTIONS (3-5 actionable recommendations):
- Provide concrete examples appropriate to career stage
- Focus on high-impact changes
- Suggest specific skills or achievements likely possessed but not documented
- Do NOT suggest shortening or reformatting the summary

CRITICAL: Respond with ONLY valid JSON. No markdown, no code blocks, no preamble.

{
  "overallScore": <number 0-100>,
  "breakdown": {
    "impact": <number 0-40>,
    "clarity": <number 0-40>,
    "keywords": <number 0-20>
  },
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "weaknesses": ["weakness 1", "weakness 2", "weakness 3"],
  "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"]
}`
      }]
    })

    console.log('Claude response received')
    const responseText = message.content[0].text
    console.log('Raw response:', responseText)

    // Clean up response - remove markdown code blocks if present
    let cleanedResponse = responseText.trim()
    if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    }
    
    console.log('Cleaned response:', cleanedResponse)

    const analysis = JSON.parse(cleanedResponse)
    console.log('Analysis parsed successfully')
    console.log('Overall score:', analysis.overallScore)
    console.log('Breakdown:', analysis.breakdown)

    return Response.json({ 
      analysis: {
        strengths: analysis.strengths,
        weaknesses: analysis.weaknesses,
        suggestions: analysis.suggestions,
        breakdown: analysis.breakdown
      },
      score: analysis.overallScore,
      detectedLevel: detectedLevelFormatted
    })
    
  } catch (error) {
    console.error('=== ANALYSIS ERROR ===')
    console.error('Error type:', error.constructor.name)
    console.error('Error message:', error.message)
    console.error('Full error:', error)
    
    return Response.json(
      { error: `Failed to analyze resume: ${error.message}` },
      { status: 500 }
    )
  }
}