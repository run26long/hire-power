import Anthropic from '@anthropic-ai/sdk'

// Convert structured resume data to plain text for analysis
function convertStructuredToText(data) {
  let text = ''
  
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
      const isSingleCategory = Object.keys(data.skillsCategories).length === 1 && category === 'Skills'
      if (!isSingleCategory) text += `${category}:\n`
      const skillsArray = Array.isArray(skills) ? skills : [skills]
      text += skillsArray.join(', ') + '\n\n'
    })
  } else if (data.skills && data.skills.length > 0) {
    text += `SKILLS\n${data.skills.join(', ')}\n\n`
  }
  
  if (data.projects && data.projects.length > 0) {
    text += 'PROJECTS\n\n'
    data.projects.forEach(project => {
      text += `${project.name || 'Project'}\n`
      if (project.description) text += `${project.description}\n`
      if (project.link) text += `${project.link}\n`
      text += '\n'
    })
  }
  
  if (data.certifications && data.certifications.length > 0) {
    text += 'CERTIFICATIONS\n\n'
    data.certifications.forEach(cert => {
      text += `${cert.name || 'Certification'}\n`
      if (cert.details) text += `${cert.details}\n`
      text += '\n'
    })
  }
  
  if (data.volunteer && data.volunteer.length > 0) {
    text += 'VOLUNTEER EXPERIENCE\n\n'
    data.volunteer.forEach(vol => {
      text += `${vol.organization || 'Organization'}\n`
      if (vol.description) text += `${vol.description}\n`
      text += '\n'
    })
  }
  
  if (data.languages && data.languages.length > 0) {
    text += 'LANGUAGES\n'
    data.languages.forEach(lang => {
      text += `${lang.language || 'Language'} - ${lang.proficiency || 'Professional'}\n`
    })
    text += '\n'
  }
  
  return text
}

// ─────────────────────────────────────────────────────────────────────────────
// SCORING FORMULA
// AI counts specific things. This function does the math.
// If scores are consistently off, adjust thresholds here — not in the prompt.
// ─────────────────────────────────────────────────────────────────────────────

function calculateScoreFromAnswers(answers) {
  const {
    totalBullets = 0,
    passingBullets = 0,
    scopeIndicators = 0,
    notableCredentials = false,
    summaryQuality = 'missing',
    specificToolsNamed = false,
    fieldVocabularyDepth = 'generic',
    professionallyWritten = false
  } = answers

  const passRate = totalBullets > 0 ? passingBullets / totalBullets : 0
  const scopeRate = totalBullets > 0 ? scopeIndicators / totalBullets : 0

  // ── IMPACT (40 points) ──────────────────────────────────────────────────────
  // Strong substance: high pass rate AND meaningful scope density
  const strongSubstance =
    (passRate >= 0.55 && (scopeRate >= 0.25 || scopeIndicators >= 5)) ||
    (notableCredentials && passRate >= 0.70) ||
    (notableCredentials && passRate >= 0.55 && scopeIndicators >= 4)

  // Moderate substance: real experience at least partially communicated.
  // Lowered thresholds so resumes like Reese's (few passing bullets but real
  // scope indicators) correctly land here rather than in thin substance.
  const moderateSubstance =
    passRate >= 0.28 ||
    (notableCredentials && passRate >= 0.12) ||
    scopeIndicators >= 2

  let impact
  if (strongSubstance) {
    // Lowered ceiling: strong substance tops out at 30, not 33.
    // A well-written uncoached resume should not score "excellent" range.
    if (scopeRate >= 0.45 || scopeIndicators >= 7) impact = 30
    else if (passRate >= 0.65) impact = 28
    else impact = 26
  } else if (moderateSubstance) {
    if (passRate >= 0.50) impact = 26
    else if (passRate >= 0.35) impact = 25
    else if (passRate >= 0.20) impact = 24
    else impact = 22  // notable credentials or scope, poor bullet communication
  } else {
    // Thin substance: real jobs but almost nothing communicated on the page.
    // Floor raised from 15 to 19 — even the worst real resume has some value.
    impact = notableCredentials ? 22 : 19
  }

  // Scope indicator bonus: rewards resumes that have real specifics even when
  // overall pass rate is low. This is what separates Reese (500+ shifts,
  // named venue, promotion) from a pure duty-list resume.
  if (!strongSubstance && scopeIndicators >= 5) impact = Math.min(impact + 3, 28)
  else if (!strongSubstance && scopeIndicators >= 3) impact = Math.min(impact + 2, 27)
  else if (!strongSubstance && scopeIndicators >= 2) impact = Math.min(impact + 1, 25)

  // ── CLARITY (40 points) ─────────────────────────────────────────────────────
  // Pass rate is the primary signal. Summary quality adjusts within that band.
  // Floors raised throughout: a professionally written duty-list resume is not
  // the same as a disorganized one, even with the same pass rate.
  let clarity
  if (passRate >= 0.65) clarity = 31
  else if (passRate >= 0.50) clarity = 27
  else if (passRate >= 0.35) clarity = 25
  else if (passRate >= 0.20) clarity = 23
  else clarity = 21  // raised from 17 — professional writing deserves a floor

  const summaryAdj = {
    strong: 1,
    adequate: 0,
    weak: -1,
    duties: -2,
    missing: -1
  }
  clarity += (summaryAdj[summaryQuality] ?? 0)

  // Professional writing floor raised: 17→21 for weak/duties, 20→23 for others.
  if (professionallyWritten) {
    const floor = (summaryQuality === 'duties' || summaryQuality === 'weak') ? 21 : 23
    clarity = Math.max(clarity, floor)
  }

  clarity = Math.min(Math.max(clarity, 16), 36)

  // ── KEYWORDS (20 points) ───────────────────────────────────────────────────
  // Minimums raised across the board — generic soft skills are still skills.
  const vocabBase = {
    comprehensive: 12,
    adequate: 10,  // was 9
    minimal: 7,    // was 6
    generic: 5     // was 3
  }
  const keywords = Math.min(
    (vocabBase[fieldVocabularyDepth] ?? 5) + (specificToolsNamed ? 4 : 0),
    17
  )

  const overallScore = Math.round(impact + clarity + keywords)

  return {
    overallScore,
    breakdown: { impact, clarity, keywords },
    _debug: {
      passRate: Math.round(passRate * 100),
      scopeRate: Math.round(scopeRate * 100),
      strongSubstance,
      moderateSubstance,
      totalBullets,
      passingBullets,
      scopeIndicators
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// QUESTIONNAIRE PROMPT
// AI answers specific countable questions. No holistic scoring allowed.
// ─────────────────────────────────────────────────────────────────────────────

function buildQuestionnairePrompt(stage) {
  return `You are analyzing a resume to answer specific factual questions. Your job is counting and classifying — not scoring. Be conservative: when a bullet is borderline, count it as FAILING.

CAREER STAGE: This is a ${stage}-level candidate.

THE BRAIN TEST — for every bullet, ask: "Can a recruiter picture the specific work this person did?"

ALWAYS FAILS:
- "Responsible for [duty]"
- "Handle [function]"
- "Assist with [task]"
- "Help coordinate [activity]"
- "Utilize expertise to ensure [outcome]"
- "Work with teams to [generic activity]"
- "Provided [generic service] to [generic audience]"
- Any bullet that could describe anyone in this role without changing a word

ALWAYS PASSES:
- Contains specific numbers or frequencies with scale ("60+ students weekly," "500+ shifts")
- Names a specific discipline, system, or environment ("8 aerial disciplines," "ICU rotations")
- Shows a specific ownership or outcome ("built from zero to capacity," "reduced injuries 40%")
- Names specific clients, venues, companies, or productions as the object of work
- Describes a unique contribution that could not apply to everyone in this role

BORDERLINE = count as FAILING:
- Has a strong verb but no specifics ("Created documentation for product lines")
- Describes category of work but not the work itself ("Managed vendor relationships")
- Vaguely positive with nothing verifiable ("Maintained high quality standards")

SCOPE INDICATORS — count bullets containing ANY of:
- Specific numbers (18 employees, 600+ deliverables, 40% reduction, $50K budget)
- Named organizations or clients as direct objects of work (not just the employer header)
- Specific frequencies paired with scale (60 students weekly, 500+ shifts to date)
- Specific counts of output or responsibility (8 disciplines, 10 product lines, 15 events)
- Measurable before/after outcomes

NOT scope indicators: "multiple clients," "various industries," "several projects," named employer in the job header

NOTABLE CREDENTIALS — TRUE only if resume contains:
- Named well-known employers (Fortune 500, major government agencies, recognized household brands)
- Named TV/film/major performance appearances (network shows, Disney/Universal/major venue productions)
- Named national or international competitions with specific placements
- Named well-recognized clients (Boeing, FEMA, Goldman Sachs — not generic company names)
- Named professional licenses (RN, MD, JD, CPA, PE)

FALSE for: generic company names, MBA or standard certifications alone (SHRM-CP, PMP without major employer context), state/local government without named notable agency

Return ONLY valid JSON. No markdown, no explanation, no preamble.

{
  "totalBullets": <count every bullet point across ALL jobs>,
  "passingBullets": <count ONLY bullets passing the brain test — be conservative, borderline = failing>,
  "scopeIndicators": <count bullets meeting scope indicator criteria>,
  "notableCredentials": <true or false per criteria above>,
  "summaryQuality": <"strong" if opens from professional identity with real credentials | "adequate" if professional but generic | "weak" if trait-focused or hollow language | "duties" if describes job duties | "missing" if no summary>,
  "specificToolsNamed": <true if skills section names specific software or tools by product name — "Excel" counts, "Microsoft Office Suite" alone does not, "Microsoft Office (Word, Excel, PowerPoint)" does count>,
  "fieldVocabularyDepth": <"comprehensive" = extensive field-specific terminology | "adequate" = basic field terms present | "minimal" = few field-specific terms | "generic" = only soft skills and general terms>,
  "professionallyWritten": <true if grammar is consistently correct and resume is well-organized>,
  "strengths": [
    "<specific strength referencing actual resume content — name the bullet or section and explain why it works>",
    "<second strength>",
    "<third strength>"
  ],
  "weaknesses": [
    "<specific weakness — name the vague bullet or section and explain what a recruiter cannot picture>",
    "<second weakness>",
    "<third weakness>"
  ],
  "suggestions": [
    "<concrete actionable suggestion — show before/after or describe the specific information to add>",
    "<second suggestion>",
    "<third suggestion>"
  ]
}`
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────────────────────────────────────

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request) {
  try {
    console.log('=== ANALYZE RESUME API CALLED ===')
    const { resumeText, resumeData } = await request.json()

    let textToAnalyze = resumeText
    if (!textToAnalyze && resumeData) {
      textToAnalyze = convertStructuredToText(resumeData)
      console.log('Converted structured data to text')
    }

    if (!textToAnalyze) {
      throw new Error('No resume data provided')
    }

    console.log('Resume text length:', textToAnalyze?.length || 0)

    // STEP 1: DETECT CAREER STAGE BY TENURE (not job title)
    const detectionMessage = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 10,
      temperature: 0,
      messages: [{
        role: 'user',
        content: `Look at the job dates in this resume. Calculate the total career span from the earliest job start date to present. Respond with ONLY one word based on total career span — ignore job titles completely:
- "entry" = under 5 years total work history
- "mid" = 5 to 15 years total work history
- "senior" = over 15 years total work history

An Operations Manager with 3 years total is "entry". A specialist with 20 years in one role is "senior".

Resume:
${textToAnalyze}`
      }]
    })

    const rawLevel = detectionMessage.content[0].text.trim().toLowerCase()
    const stage = rawLevel.includes('senior') ? 'senior' : rawLevel.includes('mid') ? 'mid' : 'entry'
    console.log('Detected career stage:', stage)

    // STEP 2: STRUCTURED QUESTIONNAIRE (counting, not scoring)
    const questionnaireMessage = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      temperature: 0,
      messages: [{
        role: 'user',
        content: `${buildQuestionnairePrompt(stage)}

Resume to analyze:
${textToAnalyze}`
      }]
    })

    let cleanedResponse = questionnaireMessage.content[0].text.trim()
    if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    }

    console.log('Raw questionnaire response:', cleanedResponse)

    const answers = JSON.parse(cleanedResponse)

    console.log('Questionnaire answers:', JSON.stringify({
      totalBullets: answers.totalBullets,
      passingBullets: answers.passingBullets,
      scopeIndicators: answers.scopeIndicators,
      notableCredentials: answers.notableCredentials,
      summaryQuality: answers.summaryQuality,
      specificToolsNamed: answers.specificToolsNamed,
      fieldVocabularyDepth: answers.fieldVocabularyDepth,
      professionallyWritten: answers.professionallyWritten
    }))

    // STEP 3: CALCULATE SCORE PROGRAMMATICALLY (no AI judgment in scoring)
    const { overallScore, breakdown, _debug } = calculateScoreFromAnswers(answers)

    console.log('Final score:', overallScore)
    console.log('Breakdown:', breakdown)
    console.log('Debug info:', _debug)

    return Response.json({
      analysis: {
        strengths: answers.strengths || [],
        weaknesses: answers.weaknesses || [],
        suggestions: answers.suggestions || [],
        breakdown
      },
      score: overallScore,
      detectedLevel: stage
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