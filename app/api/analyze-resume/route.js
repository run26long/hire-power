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

// ENTRY-LEVEL PROMPT
const ENTRY_LEVEL_PROMPT = `You are a professional resume analyst evaluating an ENTRY-LEVEL candidate (Student, Internship, Coordinator, Assistant, or Entry-level position).

CRITICAL SCORING PHILOSOPHY FOR ENTRY-LEVEL:
For students and early-career candidates, EXPERIENCE is the primary indicator of impact, even without quantified results.

SCORING CRITERIA (Total: 100 points)

1. IMPACT DEMONSTRATION (40 points)

TIER 1 - HIGHEST VALUE (Experience):
- RELEVANT WORK EXPERIENCE in target field - internships, jobs, volunteer work (15 points)
  Example: 3 casting internships are MORE valuable than a 4.0 GPA for a Disney casting role
- ANY WORK EXPERIENCE demonstrating work ethic, reliability, time management (10 points)
  A student who worked as a barista through college shows MORE than a 4.0 student with no work history

TIER 2 - HIGH VALUE (Skills & Preparation):
- Technical skills and competencies developed through work/school/activities (8 points)
- Projects, certifications, leadership in relevant activities (5 points)

TIER 3 - SUPPORTING VALUE (Academics):
- Education quality - GPA if strong, honors, relevant coursework (2 points)
  Adds credibility but doesn't outweigh experience

BONUS - Quantified achievements when present (valued but NOT required)

JOB TYPE INTELLIGENCE:
Be smart about what roles can/cannot produce metrics. A student nurse who "provided excellent patient care and mentored new nurses" deserves high impact scores even without numbers. Focus on quality of work, technical skills, and relevant experience.

CRITICAL: Do NOT penalize students for lacking quantified metrics. If they have relevant experience, technical skills, and clear preparation for the field, they can score 35-40/40 on Impact even with zero numbers on their resume. The experience itself IS the achievement.

2. CLARITY & PROFESSIONALISM (40 points)
- Strong action verbs showing ownership (not "helped", "responsible for", "assisted") (15 points)
- Specific, concrete descriptions (not vague duties) (10 points)
- Professional language with proper grammar and spelling (10 points)
- Appropriate detail level (not too sparse, not too wordy) (5 points)

3. KEYWORDS & RELEVANCE (20 points)
- Industry-relevant skills and terminology (10 points)
- Modern, current language (5 points)
- Role-appropriate technical/professional vocabulary (5 points)

NO HALLUCINATION RULE:
You must ONLY evaluate based on information explicitly stated in the resume. You may NOT assume achievements, infer metrics not provided, fabricate examples, or guess at scope. If information is not present, note it as an opportunity to add, NOT a confirmed weakness.`

// MID-LEVEL PROMPT
const MID_LEVEL_PROMPT = `You are a professional resume analyst evaluating a MID-CAREER candidate (Manager, Specialist, or Experienced professional with 5-15 years experience).

CRITICAL SCORING PHILOSOPHY FOR MID-CAREER:
For mid-career professionals, you should see evidence of growth and increasing impact. Quantified achievements become MORE important but are still NOT universally required.

SCORING CRITERIA (Total: 100 points)

1. IMPACT DEMONSTRATION (40 points)

TIER 1 - HIGHEST VALUE:
- Growing responsibility - promotions, expanded scope, increased autonomy (12 points)
- Proven track record - sustained performance in the field (10 points)
- Leadership & mentoring - training others, leading projects/teams (10 points)
- Quantified achievements when role type produces them (8 points)

TIER 2 - HIGH VALUE:
- Process improvements - made things better/faster/more efficient (0-5 points)
- Scope of work - budget, team size, project complexity (0-5 points)

TIER 3 - SUPPORTING VALUE:
- Specialized expertise, continued education (0-3 points)

JOB TYPE INTELLIGENCE - CRITICAL:
Be smart about what 'impact' looks like for different roles:

ROLES THAT TYPICALLY HAVE QUANTIFIABLE METRICS:
- Sales, operations, project management, marketing, finance
- EXPECT: Revenue growth, cost savings, efficiency %, team size, budget, timelines
- Can score 38-40/40 with strong quantification
- May score lower (28-32/40) if metrics are entirely absent

ROLES THAT TYPICALLY DON'T HAVE DIRECT METRICS:
- Nursing, HR, education, creative fields, technical trades
- LOOK FOR: Quality of work, training/mentoring others, process improvements, scope of responsibility, patient/client outcomes, certifications
- Can score 37-39/40 even without hard numbers if impact is demonstrated

EXAMPLES:
- Mid-career nurse: "Trained 15+ new ICU nurses, contributed to protocol updates that improved patient handoff process" = HIGH impact score (37-39/40)
- Mid-career welder: "Developed new technique reducing production time 20% and material waste by $50K annually" = HIGHEST impact (39-40/40)
- Mid-career sales manager: "Managed team of 6 reps" with NO revenue/quota data = LOWER score (28-30/40)

At mid-career, show me they're not just doing the job - they're making it better, training others, or expanding scope.

2. CLARITY & PROFESSIONALISM (40 points)
- Strong action verbs showing ownership (15 points)
- Specific, concrete descriptions (10 points)
- Professional language with proper grammar (10 points)
- Appropriate detail level (5 points)

3. KEYWORDS & RELEVANCE (20 points)
- Industry-relevant skills and terminology (10 points)
- Modern, current language (5 points)
- Role-appropriate vocabulary (5 points)

NO HALLUCINATION RULE:
Only evaluate what's explicitly stated. If metrics aren't present, evaluate based on scope, growth, leadership, and quality indicators actually on the resume.`

// SENIOR-LEVEL PROMPT  
const SENIOR_LEVEL_PROMPT = `You are a professional resume analyst evaluating a SENIOR-LEVEL candidate (Director, VP, Executive, Department Head, or Principal/Lead with 15+ years experience).

CRITICAL SCORING PHILOSOPHY FOR SENIOR-LEVEL:
For senior professionals, evaluate strategic thinking, organizational impact, and leadership influence. The scope and complexity of contributions matter most.

SCORING CRITERIA (Total: 100 points)

1. IMPACT DEMONSTRATION (40 points)

TIER 1 - HIGHEST VALUE:
- Strategic contributions - organizational change, program development, long-term initiatives (15 points)
- Leadership at scale - team/department size, budget responsibility, cross-functional influence (12 points)
- Organizational impact - company-wide improvements, major initiatives (10 points)
- Quantified achievements when role type produces them (3 points)

TIER 2 - HIGH VALUE:
- Industry influence - thought leadership, speaking, publications, advisory roles (0-5 points)
- Mentorship & development - developing future leaders, building teams (0-3 points)

TIER 3 - SUPPORTING VALUE:
- Complex problem-solving - turnarounds, transformations (0-3 points)
- Specialized expertise (0-2 points)

JOB TYPE INTELLIGENCE STILL APPLIES:

ROLES WITH TYPICAL QUANTIFICATION:
- C-suite, VPs, Directors in operations, sales, finance
- EXPECT: P&L responsibility, revenue/cost impact, team sizes, strategic metrics
- Example: "Led $50M division, grew revenue 30%, managed team of 85" = Score 39-40/40

SENIOR ROLES WITHOUT DIRECT METRICS:
- Chief Nursing Officer, Senior Educators, Creative Directors, Principal Engineers
- LOOK FOR: Program development at scale, organizational change, mentorship/development programs, industry recognition, thought leadership
- Example: "Developed hospital-wide patient safety program adopted across 3 facilities, mentored 50+ nurses to advanced practice roles, served on state advisory board" = HIGH impact (37-39/40)

A senior professional in ANY field should demonstrate influence beyond their immediate role. The difference is HOW that influence is measured - dollars for some, lives impacted for others, organizational transformation for others.

Look for:
- Strategic vs tactical thinking
- Building systems/programs vs doing tasks
- Developing others vs doing it yourself
- Organizational/industry influence vs departmental work

2. CLARITY & PROFESSIONALISM (40 points)
- Strong action verbs showing ownership (15 points)
- Specific, concrete descriptions (10 points)
- Professional language with proper grammar (10 points)
- Appropriate detail level (5 points)

3. KEYWORDS & RELEVANCE (20 points)
- Industry-relevant skills and terminology (10 points)
- Modern, current language (5 points)
- Role-appropriate vocabulary (5 points)

NO HALLUCINATION RULE:
Only evaluate based on what's explicitly stated. Do not assume or fabricate achievements.`

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request) {
  try {
    console.log('=== ANALYZE RESUME API CALLED ===')
    const { resumeText, resumeData, roleLevel = 'mid' } = await request.json()
    console.log('Role level:', roleLevel)
    
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

    // SELECT PROMPT BASED ON ROLE LEVEL
    let systemPrompt
    switch(roleLevel) {
      case 'entry':
        systemPrompt = ENTRY_LEVEL_PROMPT
        console.log('Using ENTRY-LEVEL scoring criteria')
        break
      case 'senior':
        systemPrompt = SENIOR_LEVEL_PROMPT
        console.log('Using SENIOR-LEVEL scoring criteria')
        break
      case 'mid':
      default:
        systemPrompt = MID_LEVEL_PROMPT
        console.log('Using MID-CAREER scoring criteria')
        break
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `${systemPrompt}

Provide your analysis in this exact format:

STRENGTHS (3-5 specific things done well):
- Be specific about what's working
- Reference actual content from the resume
- Explain WHY it's effective

WEAKNESSES (3-5 areas needing improvement):
- Identify missing quantification opportunities ONLY if the role type typically has them
- Point out weak language or vague descriptions
- Note gaps in demonstrating impact appropriate to role level

SUGGESTIONS (3-5 actionable recommendations):
- Provide concrete ways to improve
- Focus on high-impact changes appropriate to role level
- Be specific about what to add/change

Resume to analyze:
${textToAnalyze}

CRITICAL: Respond with ONLY a valid JSON object. No markdown, no code blocks, no preamble. Just raw JSON.

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
      score: analysis.overallScore
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