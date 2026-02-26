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

CRITICAL: For early-career candidates, EXPERIENCE is the primary indicator of impact, even without quantified results.

EVALUATION CRITERIA (Total: 100 points)

1. IMPACT DEMONSTRATION (40 points)

Evaluate whether the candidate demonstrates:
- Relevant work experience in their target field (highest value: internships, jobs, volunteer work showing they've done work related to their goals)
- ANY work experience showing reliability and work ethic (valuable even if unrelated to target role)
- Technical skills and competencies developed through work, school, or activities
- Projects, certifications, or leadership in relevant activities
- Strong academic performance (supporting evidence, not primary)

Quantified metrics are a BONUS when present but NOT required. Do NOT penalize entry-level candidates for lacking numbers. A student with 2 years of relevant experience can demonstrate strong impact even without quantification.

Job-type intelligence: Students in nursing, education, creative fields, service roles typically lack quantifiable metrics. Evaluate impact by quality and relevance of experience, not by presence of numbers.

2. CLARITY & PROFESSIONALISM (40 points)

Evaluate whether the resume demonstrates:
- Strong action verbs showing ownership (not weak verbs like "helped," "assisted," "responsible for")
- Specific, concrete descriptions rather than vague duties
- Professional language with proper grammar and spelling
- Appropriate level of detail (not too sparse, not overly wordy)

3. KEYWORDS & RELEVANCE (20 points)

Entry-level candidates naturally have fewer skills than those with 10+ years of experience. Evaluate whether they have:
- Industry-relevant vocabulary for their target field (basic to intermediate terminology expected)
- Modern, current language (not outdated terms)
- Role-appropriate professional vocabulary

Missing expected basics (computer skills, communication abilities, organizational skills they likely possess but didn't document) represents coaching opportunities, not necessarily current capability gaps.

NO HALLUCINATION: Only evaluate what's explicitly stated. Do NOT assume or fabricate achievements.

FEEDBACK GUIDELINES:
- Do NOT critique summary length or formatting preferences
- Focus on content quality and missing opportunities
- Suggest specific quantification examples where applicable
- Identify skills they likely have but didn't document`

// MID-LEVEL PROMPT - Evaluation criteria based
const MID_LEVEL_PROMPT = `You are evaluating a MID-CAREER candidate (Manager, Specialist, Professional with 5-15 years experience).

CRITICAL: Expect to see growth, increasing impact, and leadership. Quantification matters MORE at this level, but job type determines how much.

EVALUATION CRITERIA (Total: 100 points)

1. IMPACT DEMONSTRATION (40 points)

Evaluate whether the candidate demonstrates:
- Growing responsibility through promotions, expanded scope, or increased autonomy
- Leadership activities: mentoring, training others, leading projects or teams
- Proven track record of sustained performance in their field
- Quantified achievements when their role type typically produces them
- Process improvements or efficiency gains
- Specialized expertise or increasing scope of work

Job-type intelligence:
METRICS-HEAVY ROLES (Sales, Operations, Project Management, Finance): Expect revenue numbers, cost savings, efficiency percentages, team sizes, budgets, timelines. Missing quantification in these roles represents a significant gap.

NON-METRICS ROLES (Nursing, HR, Education, Creative fields, Skilled trades): Strong impact can be demonstrated through quality indicators - training others, protocol improvements, scope of responsibility, patient/client outcomes, specialized certifications. Numbers are valuable but not required.

Mid-career means not just doing the job, but making things better, training others, or expanding scope of responsibility.

2. CLARITY & PROFESSIONALISM (40 points)

Evaluate whether the resume demonstrates:
- Strong action verbs showing ownership
- Specific, concrete descriptions (not vague duties)
- Professional language with proper grammar and spelling
- Appropriate level of detail

Standards are slightly higher than entry-level, but well-written content scores well at all stages.

3. KEYWORDS & RELEVANCE (20 points)

Mid-career professionals should have more comprehensive vocabulary than entry-level. Evaluate whether they demonstrate:
- Industry-relevant skills and comprehensive professional vocabulary (more extensive than entry-level)
- Modern, current language
- Role-appropriate professional terminology showing depth of experience

With 5-15 years in a field, candidates naturally develop a broader skill set. Missing expected professional vocabulary represents coaching opportunities.

NO HALLUCINATION: Only evaluate explicit content. Do NOT invent metrics or assume achievements.

FEEDBACK GUIDELINES:
- Do NOT critique summary length or formatting preferences
- Focus on missing growth indicators or leadership evidence
- Suggest specific quantification appropriate to their role type
- Identify advancement or development opportunities not documented`

// SENIOR-LEVEL PROMPT - Evaluation criteria based
const SENIOR_LEVEL_PROMPT = `You are evaluating a SENIOR-LEVEL candidate (Director, VP, Executive, Department Head, Principal/Lead with 15+ years).

CRITICAL: Evaluate strategic thinking, organizational impact, and leadership influence at scale.

EVALUATION CRITERIA (Total: 100 points)

1. IMPACT DEMONSTRATION (40 points)

Evaluate whether the candidate demonstrates:
- Strategic contributions: organizational change, program development, long-term initiatives
- Leadership at scale: team/department size, budget responsibility, cross-functional influence
- Organizational impact: company-wide improvements, major transformations
- Industry influence: thought leadership, speaking engagements, publications, advisory roles
- Mentorship programs or systematic development of future leaders
- Complex problem-solving: turnarounds, major challenges, strategic pivots

Job-type intelligence:
METRICS ROLES (C-suite, VPs in Operations/Sales/Finance): Expect P&L responsibility, revenue/cost impact, team sizes, strategic financial metrics. Strong quantification is standard at this level.

NON-METRICS SENIOR ROLES (Chief Nursing Officer, Senior Educators, Creative Directors, Principal Engineers): Strong impact demonstrated through program development at organizational scale, transformation initiatives, mentorship/development programs, industry recognition, thought leadership.

Senior professionals demonstrate influence beyond their immediate role. How that influence is measured varies by field - financial impact for some, organizational transformation for others, lives impacted for healthcare, creative influence for artists.

2. CLARITY & PROFESSIONALISM (40 points)

Evaluate whether the resume demonstrates:
- Strong action verbs showing ownership and strategic thinking
- Specific, concrete descriptions of strategic initiatives
- Professional language with proper grammar and spelling
- Appropriate level of detail for executive-level communication

3. KEYWORDS & RELEVANCE (20 points)

Senior-level professionals should demonstrate the most comprehensive and strategic vocabulary. Evaluate whether they show:
- Industry-relevant skills and strategic, executive-level vocabulary
- Modern, current language reflecting contemporary business practices
- Leadership and organizational terminology appropriate to their level

With 15+ years of experience, expect the most extensive skill set and strategic vocabulary. Missing expected executive competencies represents development opportunities.

NO HALLUCINATION: Only evaluate explicit content.

FEEDBACK GUIDELINES:
- Do NOT critique summary length or formatting preferences
- Focus on missing strategic impact or organizational influence
- Suggest executive-level quantification and scope indicators
- Identify leadership development or industry influence opportunities`

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