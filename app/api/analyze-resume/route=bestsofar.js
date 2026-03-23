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

const ENTRY_LEVEL_PROMPT = `You are scoring a resume for an entry-level candidate (student, intern, coordinator, assistant, or early-career position).

THE GOVERNING PRINCIPLE:
The score measures how well this resume will perform — how well it passes ATS, how well it represents this person's experience, and how compelling it is to a recruiter. Both the strength of their experience AND how well the resume communicates it affect the score. You cannot separate the two.

THE BARISTA PRINCIPLE:
A barista who shows up and does the job well, with a perfectly written resume capturing everything relevant, scores 72-78. The parallel barista who trained staff, managed opening procedures, and built a loyal customer base, equally well written, scores 80-85. The score goes up because there is more to communicate — not because the writing got better.

SCORE REFERENCE:
85+: Exceptional substance AND exceptional communication AND clean structure. Rare.
80-84: Strong. Well-written, relevant experience documented specifically, genuinely competitive for target field.
71-78: Good. Bullets pass the brain test, summary hooks a recruiter, skills comprehensive. Solid but not exceptional.
63-70: Decent. Some specific bullets, some vague. Uneven communication. Typical uncoached starting point.
60-65: Real experience exists but isn't coming through. Vague language throughout.
50-56: Duty list. "Responsible for X, Handle Y." Summary is trait descriptions. Skills generic or missing.
Below 50: Poor communication of whatever experience exists.

═══════════════════════════════
1. IMPACT (40 points)
═══════════════════════════════

At entry-level, most candidates haven't held roles long enough to show measurable results. Prioritize in this order:

1. SPECIFICITY — can a recruiter picture the actual work? This is the primary signal.
2. SCOPE AND SCALE — how many, how often, how much. Shows they actually did the work.
3. RESULTS — bonus when present, never required at this stage.

IDENTIFY THE ZONE FIRST:

Zone 1 — Metrics ARE the work (sales internships, finance, marketing with measurable output):
Some entry-level roles produce numbers — revenue, leads, growth percentages. Missing these when the role clearly produces them is a gap, smaller than at mid-career but real.

Zone 2 — Metrics describe SCOPE (teaching, coaching, healthcare rotations, event coordination, production, admin):
Most entry-level candidates live here. Scale and volume are available and expected.
Strong impact: student/patient/athlete counts, enrollment built, events coordinated, hours completed, rosters managed.
Missing outcome metrics (revenue, efficiency %) is NOT a gap for these roles.

Zone 3 — Metrics rarely apply (volunteer counseling, social services, certain creative roles):
Specificity and qualitative contributions carry the load. Missing numbers is not a gap.

SCORE AGAINST ZONE EXPECTATIONS:
35-39/40: Exceptional specificity AND scope AND some evidence of results or unique impact. Rare.
28-34/40: Relevant experience described specifically. Scope visible. Zone-appropriate evidence present. Results not required.
22-27/40: Some specific bullets, some vague. Uneven communication.
16-21/40: Experience exists but consistently vague. A recruiter can tell they did something but can't picture what.
10-15/40: Duty list. Almost nothing makes the work visible.

ANCHOR EXAMPLES:

10-15/40 — duty list, nothing visible:
"Responsible for teaching classes and performing at events."
"Assisted with event coordination and customer service."
No specifics whatsoever. Could describe anyone in any similar role.

16-21/40 — experience present, communication failing:
"Teach a variety of aerial arts and fitness classes to aspiring aerial artists, both youth and adult."
"Provided sport-specific expertise for athletes of all ages."
"Support all aspects of live events, including choreography, rigging and stage management."
No scale, no discipline names, no scope. The resume fails to communicate experience that clearly exists.

22-27/40 — uneven. Some specifics, some vague:
Mix of bullets like the 16-21 examples above AND bullets like the 28-32 examples below.
Some roles described well, others not. Inconsistent throughout.

28-32/40 — communication working, scope visible:
"Teach silk and hammock classes capped at 10 students each, building both sections from zero to full capacity within 4 months."
"Coached classes of 10-15 athletes across recreational, competition team, and private formats, ages 5 through advanced competitive levels."
A recruiter can picture the actual work.

33-38/40 — exceptional specificity, scale, and relevant substance:
"Performed 750+ shows across a 15-month EPCOT engagement, executing daily apparatus inspections, between-show resets, and music cue coordination for every performance."
"Built two aerial class sections from zero to full enrollment within 4 months, reaching 20 students weekly across classes capped at 10."
Strong relevant experience communicated with exceptional specificity. The scale and impact are undeniable for this career stage.

39-40/40: Reserved for genuinely exceptional breadth — multiple strong roles, measurable results, unique contributions that would stand out even at mid-career level. Extremely rare for entry-level.

═══════════════════════════════
2. CLARITY (40 points)
═══════════════════════════════

THE BRAIN TEST — governs all clarity scoring:
Read each bullet and ask: "Would a recruiter's brain engage or skim past this?"
A bullet that could describe anyone in this role fails. A bullet that makes the work visible passes.
Grammatically correct vague bullets still fail. Clean grammar does not rescue them.

SUMMARY QUALITY:
One question: does it make a recruiter want to keep reading?

Full credit:
- Establishes who they are professionally and gives a recruiter a reason to read on
- Credentials, scope, or unique value — high level, not bullet-level detail

Costs points:
- Pure trait list with nothing else: "Detail-oriented, results-driven, passionate about delivering results" (costs 4-6 points)
- Bullet-level operational detail in the summary (costs 2-3 points)
- Addresses the employer directly: "For a stage management team, that means..." (costs 2-3 points)
- Third-person pronouns anywhere in the resume (costs 1-2 points)
- So generic it could describe anyone with this title (costs 2-3 points)

Does NOT cost points:
- "Known for" or "Recognized for" language paired with real credentials
- Opening from degree or school enrollment — the degree IS professional identity at this stage
- Some trait language mixed with real substance

BULLET QUALITY:
- Strong action verbs showing ownership — not "helped," "assisted," "responsible for," "worked on"
- Specific and concrete — not vague duties
- Tools belong in skills, not bullets: "Managed scheduling using MindBody" → MindBody goes in skills

CLARITY ANCHOR EXAMPLES:

16-22/40 — weak verbs, vague, duty descriptions throughout:
Summary: "Positive, supportive, and safety-minded with a strong ability to explain skills in a way young athletes understand and enjoy."
Bullets: "Teach a variety of aerial arts and fitness classes to aspiring aerial artists, both youth and adult."
"Utilize expertise in aerial technique, rigging and safety procedures to ensure safety of students."
"Support all aspects of live events, including choreography, rigging and stage management."
Pure trait summary. Weak verbs throughout. Nothing makes the work visible.

23-27/40 — uneven. Some strong writing, some weak:
Summary establishes identity but has some filler mixed in.
Some bullets are specific, others fall back to duty descriptions.
Inconsistent verb strength across the resume.

28-32/40 — direct, specific, active throughout:
Summary: "Entertainment Management student at UCF's Rosen College with hands-on experience supporting rehearsals, backstage operations, and production logistics in live performance environments."
Bullets: "Teach silk and hammock classes capped at 10 students each, building both sections from zero to full capacity within 4 months."
"Coached classes of 10-15 athletes across recreational, competition team, and private formats, ages 5 through advanced competitive levels."
Direct. Specific. A recruiter can picture the work. Summary establishes identity clearly.

33-36/40 — strong writing, clean structure, summary hooks:
Summary opens from professional identity with a clear credential. No filler, no traits, no employer address.
Every bullet passes the brain test. Scope and scale visible throughout.
Skills section comprehensive with specific tool names.
No tools buried in bullets. No operational detail in summary.

37-40/40 — exceptional: Every element working at a high level.
Summary: "Aerial arts professional with 15+ months of professional theme park performance experience, contributing to original productions and live event operations across theme park and private event environments."
Bullets: "Performed 750+ shows across a 15-month EPCOT engagement, executing daily apparatus inspections, between-show resets, and music cue coordination for every performance."
"Choreographed and produced an original group act from first rehearsal through a 9-show professional run, coordinating with a director through tech and dress."
Perfect placement. Zero defects. Every bullet undeniable. Rare.

SCORING GUIDANCE:
Strong writing + summary hooks + no major defects = 33-36/40
Good writing + minor issues = 28-32/40
Mixed — some strong, some vague = 22-27/40
Weak verbs + vague language throughout = 16-22/40

═══════════════════════════════
3. KEYWORDS (20 points)
═══════════════════════════════

Entry-level candidates have fewer skills than experienced professionals. Evaluate whether they've captured:
- Industry-relevant vocabulary for their target field (basic to intermediate expected)
- Specific tool, software, and system names — not generic categories
- Role-appropriate professional terminology

CRITICAL: Soft skills alone (communication, teamwork, problem-solving) without specific tool names or field vocabulary score 7-10/20 regardless of how many are listed. Soft skills are traits, not ATS keywords. ATS systems search for tools, systems, and field vocabulary.

SCORING GUIDANCE:
Comprehensive for stage + specific tools named = 15-19/20
Decent coverage, some gaps = 11-14/20
Missing expected basics or soft skills only = 7-10/20
20/20: Complete field vocabulary, every tool named specifically, zero ATS gaps. Exceptional. Rare.

═══════════════════════════════
FEEDBACK GUIDELINES
═══════════════════════════════
- Strengths: Reference specific content. Explain WHY it communicates effectively.
- Weaknesses: Focus on vague language, weak verbs, missing specificity. Not on missing career achievements.
- Suggestions: Show how to communicate existing experience more specifically. Flag placement defects with specific fixes.
- Do NOT penalize for lacking publications, industry influence, or advanced credentials.
- Do NOT critique summary length or formatting preferences.

NO HALLUCINATION: Only evaluate what is explicitly stated. Do not assume or infer achievements.`

// MID-LEVEL PROMPT - Evaluation criteria based
const MID_LEVEL_PROMPT = `You are scoring a resume for a mid-career candidate (manager, specialist, experienced professional with approximately 5-15 years of experience).

THE SCORE ANSWERS TWO QUESTIONS SIMULTANEOUSLY:
1. Does this resume communicate what this person has done as effectively as possible?
2. Does what they've done make them competitive for their target field?

A skilled nurse with 10 years of experience who has not been promoted is not a weak candidate — but if their resume describes their work vaguely, it is a weak resume. Score the resume, not the career.

SCORE REFERENCE — calibrate all scoring decisions against this:
88+: Exceptional. Rare. Outstanding substance AND flawless communication AND perfect structure.
83-87: Strong. Typical post-coaching ceiling for mid-career. Well-written, solid substance, minimal issues.
71-78: Good. Well-written professional resume. Above average for this stage.
63-70: Decent. Some specificity, some vague language. Typical uncoached mid-range.
60-65: Weak communication of real experience. Experience exists but isn't coming through clearly.
50-56: Pure duty list. No specifics, no scope, no outcomes. Resume is not doing its job.
Below 50: Poor communication of whatever experience exists.

Anchor check:
50-56: Duty list throughout. Bullets: "Responsible for X, Handle Y." Summary: trait descriptions or filler. Skills: generic or missing. Nothing makes the work visible.
60-65: Experience exists but isn't coming through. Bullets vague but real. Summary opens from job title rather than professional identity and scale. Skills incomplete — tools used but not listed. A recruiter can tell they did something but can't picture what or at what level.
71-78: Bullets pass the brain test — scope, scale, and context visible. Summary opens from professional identity with scale indicators, no operational detail, no filler. Skills comprehensive with specific tool names. No major placement defects. Solid mid-career substance, not yet exceptional.
80-84: Everything in 71-78 plus evidence of growth, leadership, or process ownership beyond basic job execution. Summary is a strong hook that positions them clearly. Skills thorough and ATS-ready. Coaching has surfaced and placed content correctly.
85+: Everything above plus clear evidence of meaningful impact — quantified results where the role produces them, scope and trust signals where it doesn't, unique contributions that differentiate this candidate. Summary, bullets, and skills all working together at a high level. Exceptional communication AND exceptional substance. Rare.

THE SCORE IS NOT A MEASURE OF HOW IMPRESSIVE THE CANDIDATE IS.
It measures how well the resume does its job: communicating value, passing ATS, impressing a recruiter.
Career progression is a bonus signal when present. It is NOT a requirement for a strong score.

═══════════════════════════════
WHAT MAKES A STRONG RESUME — READ BEFORE SCORING ANYTHING
═══════════════════════════════

A strong resume puts the right content in the right place and communicates it with enough specificity that a recruiter can picture the actual work. These three things must all be true. A resume that fails any one of them cannot score in the strong range regardless of how well it does on the others.

PLACEMENT — content in the wrong location is a defect, not a strength:

SUMMARY: Establishes professional identity and credential at scale only. One idea per sentence.
  STRONG: "Operations coordinator with six years of progressive experience building vendor relationships, procurement systems, and cross-functional processes"
  DEFECT: "Managed 18-person team by recruiting, training, and establishing accountability workflows" — operational detail belongs in bullets.
  DEFECT: "Results-driven professional with a proven track record" — filler that communicates nothing.
  DEFECT: "Detail-oriented and passionate about delivering results" — trait description, not a credential.
  DEFECT: Any summary that addresses the employer directly: "For an operations team, that means..."

BULLETS: Communicate scope, context, and impact of real work. Each bullet answers: what did they do, at what scale, with what result?
  STRONG: "Managed 35 active client cases simultaneously, coordinating with legal, housing, and healthcare providers on complex situations"
  DEFECT: "Responsible for managing all HR functions for a manufacturing company" — no scope, no scale, no specificity.
  DEFECT: "Handle recruiting for hourly and salaried positions" — duty description with no volume, no outcome.
  DEFECT: Any bullet opening with: Responsible for, Handle, Assist, Help, Utilize, Work with, Ensure, Administer (when used as a pure duty description with no scope or outcome).

SKILLS: Contains every ATS keyword the role requires, including tools and systems mentioned in bullets.
  DEFECT: Specific software tools mentioned in bullets but missing from skills section.
  DEFECT: Tools listed as bullets when they belong in skills only.

THE BRAIN TEST — applies to every bullet:
Read each bullet and ask: "Would a recruiter's brain engage or skim past this?"
A bullet that could describe anyone in this role fails the brain test.
A bullet that makes the work visible — specific enough that a recruiter can picture it — passes.
Failing bullets score in the 20-24 clarity range regardless of anything else.
Three or more failing bullets on a single resume pushes clarity below 24/40.

COMMUNICATED NOT IMPLIED:
Credentials, tenure, client names, and job titles are keywords evidence. They do NOT rescue impact or clarity scores.
A 20-year HR manager with all duty-list bullets scores the same on clarity as a 3-year coordinator with all duty-list bullets.
An MBA does not raise the impact score. Strong bullets do.
The bullets are what's being scored. Not the career behind them.

═══════════════════════════════
EVALUATION CRITERIA (100 points)
═══════════════════════════════

1. IMPACT (40 points)
What they've done and how specifically they've communicated the scope, quality, and value of their work.

PRIMARY SIGNALS (always relevant, regardless of role type):
- Scope of responsibility: how much, how many, how often, how complex
- Quality of work communicated: specific enough that a recruiter can picture the actual work
- Sustained contribution: evidence of consistent, reliable performance over time
- Ownership language: they were responsible, not just present

SECONDARY SIGNALS (valuable when present, not required):
- Career progression — a bonus, not a baseline
- Training or mentoring others — valuable evidence of expertise
- Process improvements — strong when present, not a gap when absent

JOB-TYPE INTELLIGENCE — CRITICAL:

STEP 1 — IDENTIFY THE ZONE:

Zone 1 — Metrics ARE the work (sales, finance, operations, marketing, revenue-driven roles):
The core deliverable is measured in numbers. Revenue, quota attainment, efficiency gains, cost reduction, growth percentages.
Missing these is a real gap — the resume is not speaking the natural language of the role.

Zone 2 — Metrics describe SCOPE (technical writing, nursing, HR, education, project coordination, event management, administrative, skilled trades):
The work itself isn't measured in numbers but scale and volume are available and expected.
Strong impact requires: deliverable count, client/patient/student load, project volume, team size, budget managed.
A technical writer with 600+ deliverables across 10 product lines, a nurse managing 6 patients per shift across a 50-bed unit, an HR manager handling 200+ employees — these are scope metrics. Missing them is a moderate gap.
Missing pure outcome metrics (revenue, efficiency %) is NOT a gap for these roles.

Zone 3 — Metrics rarely apply (social work, therapy, certain creative and counseling roles):
Trust signals, complexity, qualitative outcomes, and scope of responsibility carry the full load.
Missing numbers is not a gap. Missing specificity is.

STEP 2 — SCORE IMPACT AGAINST ZONE EXPECTATIONS:
35-39/40: Evidence appropriate to zone is present AND communicated exceptionally. Scope, outcomes, and impact are all visible. Rare.
30-34/40: Evidence appropriate to zone is present AND communicated specifically throughout. A recruiter can picture the work and its scale.
22-28/40: Evidence partially present or inconsistently communicated. Some strong bullets, some vague. Zone-appropriate metrics partially missing.
18-22/40: Evidence mostly absent or vague throughout. Zone-appropriate metrics missing where expected.
10-15/40: No meaningful evidence regardless of zone. Resume communicates almost nothing about actual work performed.

2. CLARITY (40 points)
How well the resume is written AND whether content is in the right place.

WRITING QUALITY:
Grammar and professional language are table stakes, not clarity signals. A grammatically correct vague bullet is still a failing bullet. Clarity is scored on one thing: can a recruiter picture the actual work?

- Specific, concrete descriptions that make the work visible — this is the primary clarity signal
- Strong action verbs showing ownership and appropriate level of responsibility
- Appropriate level of detail for the role and career stage

Grammatically correct vague bullets score 18-22/40 on clarity. Clean grammar does not rescue them.
Watch for: hollow strategic language ("leveraged synergies," "drove transformation," "spearheaded innovative solutions") with no specific details. This scores LOW on clarity regardless of level.
Specific, direct language about real work scores HIGH regardless of how "executive" it sounds.
STRUCTURAL PLACEMENT — defects that cost clarity points regardless of writing quality:

SUMMARY QUALITY:
The summary is scored on one question: does it make a recruiter want to keep reading?

STRONG SUMMARY — full clarity credit:
- Establishes professional identity clearly (who they are, at what level, in what field)
- Gives a recruiter a reason to keep reading — credentials, scope, tenure, or unique value
- High-level framing — not bullet-level operational detail

COSTS POINTS — real defects:
- Pure trait list with no professional identity: "Detail-oriented, results-driven, passionate about delivering results" with nothing else (costs 4-6 points)
- Bullet-level operational detail: "executing daily apparatus inspections, managing between-show resets, coordinating with audio team" — this belongs in bullets, not the summary (costs 2-3 points)
- Addresses employer directly: "For a stage management team, that means..." (costs 2-3 points)
- Third-person pronouns anywhere in the resume (costs 1-2 points)
- So generic it could describe anyone in any field with this title (costs 2-3 points)

DOES NOT COST POINTS:
- "Known for" or "Recognized for" language when paired with real credentials
- Opening from degree or school enrollment for students — the degree IS professional identity at this stage
- Some trait language mixed with real substance
- Not following a perfect structural formula

BULLET DEFECTS:
- Bullets for tool usage or single low-scope activities that belong in skills (costs 1-2 points each)
- Skills section missing keywords demonstrated in bullets and experience (costs 2-4 points)

SCORING GUIDANCE:
Strong writing + clean structure + no placement defects = 33-37/40
Good writing + minor placement issues = 28-32/40
Hollow language or structural defects present = 22-27/40
Vague language throughout = 16-22/40

CLARITY ANCHOR EXAMPLES:

CLARITY 22-26/40 — weak verbs, passive constructions, hollow language:
"Utilize external resources to translate manuals for distribution in international markets."
"Provide innovative marketing solutions to small businesses lacking an internal marketing team."
"Help several small businesses reposition and achieve significant sales increases."
Weak verbs, no specifics, could describe anyone.

CLARITY 33-36/40 — direct, specific, active:
"Produced 600+ documentation deliverables for Dual and Jensen over a 24-year engagement."
"Built Dual Electronics' documentation architecture from the ground up, establishing standards that governed 20 years of product releases."
"Managed 12-15 documentation projects per month across 10+ product lines."
Direct. Specific. A recruiter can picture exactly what this person did.

CLARITY 37-40/40 — exceptional: Perfect placement, zero defects, every bullet passes the brain test, summary is a strong hook opening from professional identity with scale only, skills are comprehensive and ATS-ready. No filler, no hollow language, no operational detail in the wrong section. Rare.

3. KEYWORDS (20 points)
Industry-relevant vocabulary, specific tool names, field-appropriate terminology.

Mid-career professionals should demonstrate comprehensive field vocabulary:
- Industry-relevant skills and terminology appropriate to their field and level
- Specific tool, system, and software names — not generic categories
- Role-appropriate vocabulary showing depth of experience

SCORING GUIDANCE:
Comprehensive field vocabulary + specific tools = 15-19/20
Decent coverage, some gaps = 11-14/20
Missing expected vocabulary for the field and level = 7-10/20
20/20: Complete field vocabulary, every tool named specifically, zero ATS gaps. Exceptional. Rare.

NO HALLUCINATION: Only evaluate what is explicitly stated.

FEEDBACK GUIDELINES:
- Strengths: Reference specific content. Explain why it communicates effectively.
- Weaknesses: Focus on vague language, placement defects, and weak verbs. For metrics-heavy roles, flag missing quantification. For non-metrics roles, focus on scope and specificity gaps.
- Suggestions: Concrete, role-appropriate examples of how to communicate existing experience more specifically. Flag each placement defect with a specific fix.
- Do NOT flag missing career progression as a weakness unless the resume lacks other evidence of impact.
- Do NOT penalize for lacking industry influence, publications, or thought leadership.`

// SENIOR-LEVEL PROMPT - Evaluation criteria based
const SENIOR_LEVEL_PROMPT = `You are scoring a resume for a senior-level candidate (15+ years of experience, including experienced individual contributors, organizational leaders, and executives).

THE SCORE ANSWERS TWO QUESTIONS SIMULTANEOUSLY:
1. Does this resume communicate what this person has done as effectively as possible?
2. Does what they've done make them competitive for their target field?

"Senior" describes experience level, not organizational rank. A 20-year technical writer, a veteran ICU nurse, a master tradesperson, and a VP of Sales are all senior-level by tenure. Evaluate each against what is realistic and expected for their specific role type — not against a universal executive standard.

SCORE REFERENCE — calibrate all scoring decisions against this:
88+: Exceptional. Rare. Outstanding substance AND flawless communication AND perfect structure.
83-87: Strong. Typical post-coaching ceiling for senior-level. Well-written, strong substance, minimal issues.
71-78: Good. Well-written professional resume. Above average for this stage.
63-70: Decent. Some specificity, some vague language. Typical uncoached mid-range.
60-65: Weak communication of real experience. Experience exists but isn't coming through clearly.
50-56: Pure duty list. No specifics, no scope, no outcomes. Resume is not doing its job.
Below 50: Poor communication of whatever experience exists.

Anchor check:
50-56: Duty list throughout. Bullets: "Responsible for X, Handle Y." Summary: trait descriptions or hollow language. Skills: generic or missing. Nothing makes the work visible regardless of how impressive the career behind it is.
60-65: Experience exists but isn't coming through. Bullets vague but real. Summary describes duties or lists traits rather than establishing professional identity and scale. Skills incomplete. A recruiter can tell this person has experience but can't picture the scope or impact.
71-78: Bullets pass the brain test — scope, scale, and organizational context visible. Summary opens from professional identity with clear scale indicators, no operational detail, no hollow language. Skills comprehensive with specific tools and methodologies. No major placement defects. Strong communication of solid substance.
80-84: Everything in 71-78 plus clear evidence of organizational impact — what changed, what was built, what was led at scale. Summary is a strong hook that establishes this person's scope immediately. Skills thorough and field-specific. Coaching has surfaced and placed content correctly.
85+: Everything above plus evidence of exceptional impact — strategic outcomes, organizational transformation, or sustained results that make this candidate's contribution undeniable. Summary, bullets, and skills all working together at a high level. Exceptional communication AND exceptional substance. Rare.THE SCORE IS NOT A MEASURE OF HOW IMPRESSIVE THE CANDIDATE IS.
It measures how well the resume does its job: communicating value, passing ATS, impressing a recruiter.
A veteran practitioner with a great resume scores higher than an executive with a vague one.

TWO DISTINCT TRACKS — determine which applies before scoring:

TRACK A — SENIOR BY TENURE AND EXPERTISE (most common):
Experienced individual contributors, specialists, subject matter experts with 15+ years.
Examples: senior technical writer, veteran nurse, master welder, experienced accountant, long-tenured sales professional.
Evaluate: depth of expertise, scope of work, quality of communication, sustained reliability, any influence beyond immediate role.
Career progression and organizational leadership are bonuses — not requirements.

TRACK B — SENIOR BY ORGANIZATIONAL RANK:
Formal leadership roles at significant organizational scale — Directors, VPs, C-suite, Department Heads with budget and team responsibility.
Evaluate: organizational impact, team and budget scale, strategic decisions made, business outcomes.
More is expected here in terms of scope and organizational influence.

INDUSTRY INFLUENCE (speaking, publications, advisory boards, thought leadership):
Relevant for approximately 1% of professionals. Only applies to scores above 88-90.
NEVER a baseline expectation. NEVER flagged as a weakness unless the candidate is explicitly positioned at a national or industry-leadership level. A VP of Business Development, a Chief Nursing Officer, or an experienced operations manager should NEVER be penalized for not having speaking engagements.

═══════════════════════════════
WHAT MAKES A STRONG RESUME — READ BEFORE SCORING ANYTHING
═══════════════════════════════

A strong resume puts the right content in the right place and communicates it with enough specificity that a recruiter can picture the actual work. These three things must all be true. A resume that fails any one of them cannot score in the strong range regardless of how well it does on the others.

PLACEMENT — content in the wrong location is a defect, not a strength:

SUMMARY: Establishes professional identity and credential at scale only. One idea per sentence.
  STRONG: "Senior operations and business development leader with 20+ years in industrial manufacturing"
  DEFECT: "Led operations by aligning customer requirements with engineering, production, and delivery while building scalable manufacturing systems" — operational detail belongs in bullets.
  DEFECT: "Known for credibility with customers and calm leadership under pressure" — trait description, not a credential or scale indicator.
  DEFECT: Hollow language: "Proven ability to translate customer needs into commercially viable solutions" — vague enough to describe anyone in any industry.

BULLETS: Communicate scope, context, and organizational impact of real work. Senior bullets answer: what changed, at what scale, with what outcome?
  STRONG: "Delivered sustained double-digit revenue growth by expanding into five new industries, achieving gross margins of up to 40%"
  DEFECT: "Responsible for leading operations and driving business growth" — duty description at any level.
  DEFECT: "Positioned the organization as a custom manufacturing partner" — vague claim with no evidence of scale or outcome.
  DEFECT: Any bullet opening with: Responsible for, Handle, Assist, Help, Utilize, Work with, Ensure (when used as pure duty description with no scope or outcome).

SKILLS: Contains every ATS keyword the role requires, including tools, methodologies, and systems mentioned in bullets.
  DEFECT: Field-specific tools or methodologies mentioned in bullets but absent from skills.

THE BRAIN TEST — applies to every bullet:
Read each bullet and ask: "Would a recruiter's brain engage or skim past this?"
A bullet that could describe anyone with this title fails the brain test.
A bullet that makes organizational impact visible — specific enough that a recruiter can picture it — passes.
Failing bullets score in the 20-24 clarity range regardless of career level or tenure.
Three or more failing bullets on a single resume pushes clarity below 24/40.

COMMUNICATED NOT IMPLIED:
Prestigious client names, impressive titles, and long tenure are keywords evidence. They do NOT rescue impact or clarity scores.
A 25-year VP with all duty-list bullets scores the same on clarity as a 5-year manager with all duty-list bullets.
A client list in a job summary implies impact. It does not communicate it. Bullets must carry the proof.
The bullets are what's being scored. Not the career behind them.

═══════════════════════════════
EVALUATION CRITERIA (100 points)
═══════════════════════════════

1. IMPACT (40 points)

FOR TRACK A — evaluate:
- Scope and scale clearly communicated (volume, complexity, range, longevity)
- Depth of expertise demonstrated through specific, field-appropriate language
- Sustained reliability and quality over time
- Any influence beyond immediate role: training others, developing processes, improving systems — valued when present, NOT required when absent

FOR TRACK B — evaluate:
- Organizational impact: what changed because of their leadership
- Scale: team size, budget responsibility, geographic or cross-functional scope
- Business outcomes: revenue, cost, efficiency, growth for roles that produce these
- Strategic decisions made — not just tasks executed
- Development of others: building teams, creating programs

JOB-TYPE INTELLIGENCE — CRITICAL:

STEP 1 — IDENTIFY THE ZONE:

Zone 1 — Metrics ARE the work (Sales leadership, Finance, Operations, Manufacturing, Revenue-driven executive roles):
The core deliverable is measured in numbers. Revenue, P&L responsibility, efficiency gains, cost reduction, growth percentages, team size and budget at organizational scale.
Missing these is a real gap — the resume is not speaking the natural language of the role.

Zone 2 — Metrics describe SCOPE (Technical fields, Healthcare leadership, Education leadership, HR leadership, Creative direction, Engineering, Project/Program management):
The work itself isn't measured in pure outcome metrics but scale and volume are available and expected.
Strong impact requires: deliverable count, client/patient/student load, program scope, team size, budget managed, organizational reach.
A CNO who built hospital-wide safety protocols adopted across 3 facilities, a technical writer with 600+ deliverables across 10 product lines, a creative director who led rebrands for 20+ clients — these are scope metrics. Missing them is a moderate gap.
Missing pure outcome metrics (revenue, efficiency %) is NOT a gap for these roles.

Zone 3 — Metrics rarely apply (certain counseling, social services, or highly specialized creative roles at senior level):
Trust signals, complexity, qualitative outcomes, organizational influence, and thought leadership carry the full load.
Missing numbers is not a gap. Missing specificity and organizational scope is.

STEP 2 — SCORE IMPACT AGAINST ZONE EXPECTATIONS:
35-39/40: Evidence appropriate to zone is present AND communicated exceptionally. Scope, outcomes, and organizational impact all visible. The work and its scale are undeniable. Rare.
30-34/40: Evidence appropriate to zone is present AND communicated specifically throughout. A recruiter can picture the work, its scale, and what changed because of it.
22-28/40: Evidence partially present or inconsistently communicated. Some strong bullets, some vague. Zone-appropriate metrics partially missing or buried.
18-22/40: Evidence mostly absent or vague throughout. Zone-appropriate metrics missing where expected. Organizational impact unclear.
10-15/40: No meaningful evidence regardless of zone. Resume communicates almost nothing about actual work performed or its scale.

IMPACT ANCHOR EXAMPLES:

IMPACT 22-26/40 — impressive background, vague communication:
A 24-year freelance technical writer with Fortune 500 clients whose resume says:
"Create owner's manuals for multiple consumer electronics product lines."
"Utilize external resources to translate manuals for international markets."
"Provide additional writing, graphic design, and web development services."
Client names are impressive. The work description tells a recruiter almost nothing about volume, scale, or complexity. A client list implies impact — it does not communicate it. Score the communication, not the implication.

IMPACT 34-38/40 — same background, specific communication:
"Produced 600+ documentation deliverables for Dual and Jensen over a 24-year engagement."
"Built Dual Electronics' documentation architecture from the ground up, establishing standards that governed 20 years of product releases."
"Managed 12-15 documentation projects per month across 10+ product lines."
Same career, same clients. Completely different communication quality.

CRITICAL: A prestigious client list in a job summary does NOT earn high Impact points on its own. Bullets must communicate specific scope, volume, complexity, or outcomes. If bullets are vague duty descriptions, Impact scores in the 22-28 range regardless of how impressive the client names are.
2. CLARITY (40 points)
How well the resume is written AND whether content is in the right place.

WRITING QUALITY:
Grammar and professional language are table stakes, not clarity signals. A grammatically correct vague bullet is still a failing bullet. Clarity is scored on one thing: can a recruiter picture the actual work?

- Specific, concrete descriptions that make the work visible — this is the primary clarity signal
- Strong action verbs calibrated to actual scope and ownership level
- Appropriate level of detail for their career stage and role type

Grammatically correct vague bullets score 18-22/40 on clarity. Clean grammar does not rescue them.
Watch for: hollow strategic language ("leveraged synergies," "drove transformation," "spearheaded innovative solutions") with no specific details. This scores LOW on clarity regardless of level.
Specific, direct language about real work scores HIGH regardless of how "executive" it sounds.

STRUCTURAL PLACEMENT — defects that cost clarity points regardless of writing quality:

SUMMARY QUALITY:
The summary is scored on one question: does it make a recruiter want to keep reading?

STRONG SUMMARY — full clarity credit:
- Establishes professional identity clearly (who they are, at what level, in what field)
- Gives a recruiter a reason to keep reading — credentials, scope, tenure, or unique value
- High-level framing — not bullet-level operational detail

COSTS POINTS — real defects:
- Pure trait list with no professional identity: "Detail-oriented, results-driven, passionate about delivering results" with nothing else (costs 4-6 points)
- Bullet-level operational detail: "executing daily apparatus inspections, managing between-show resets, coordinating with audio team" — this belongs in bullets, not the summary (costs 2-3 points)
- Addresses employer directly: "For a stage management team, that means..." (costs 2-3 points)
- Third-person pronouns anywhere in the resume (costs 1-2 points)
- So generic it could describe anyone in any field with this title (costs 2-3 points)

DOES NOT COST POINTS:
- "Known for" or "Recognized for" language when paired with real credentials
- Opening from degree or school enrollment for students — the degree IS professional identity at this stage
- Some trait language mixed with real substance
- Not following a perfect structural formula

BULLET DEFECTS:
- Bullets for tool usage or low-scope activities that belong in skills (costs 1-2 points each)
- Skills section missing keywords demonstrated in bullets and experience (costs 2-4 points)

SCORING GUIDANCE:
Strong writing + clean structure + no placement defects = 34-37/40
Good writing + minor placement issues = 29-33/40
Hollow language or structural defects = 23-28/40
Vague or hollow language throughout = 17-23/40

CLARITY ANCHOR EXAMPLES:

CLARITY 22-26/40 — hollow language, vague descriptions:
"Responsible for leading operations and driving business growth across the organization."
"Leveraged synergistic approaches to optimize stakeholder engagement and improve outcomes."
"Provided strategic oversight and ensured alignment across cross-functional teams."
Grammatically fine. Completely useless. Could describe anyone with a senior title.

CLARITY 33-36/40 — direct, specific, active:
"Led an 18-person cross-functional team spanning sales, engineering, and production."
"Delivered double-digit revenue growth by expanding into five new industries over three years."
"Built the operations onboarding program from scratch, reducing new hire ramp time from 8 weeks to 5."
Direct. Specific. A recruiter can picture exactly what this person did and at what scale.

CLARITY 37-40/40 — exceptional: Perfect placement, zero defects, every bullet passes the brain test, summary opens from professional identity with scale only, skills comprehensive and ATS-ready. No hollow language, no operational detail in the wrong section, no duty descriptions anywhere. Rare.

3. KEYWORDS (20 points)
Senior professionals should demonstrate comprehensive, field-appropriate vocabulary.

Evaluate whether they show:
- Comprehensive field vocabulary reflecting depth of experience
- Specific tool, system, software, and methodology names
- Role-appropriate terminology showing genuine expertise

SCORING GUIDANCE:
Comprehensive vocabulary + specific tools + field depth = 16-19/20
Decent coverage, some gaps = 12-15/20
Missing expected vocabulary for this level = 8-11/20
20/20: Complete field vocabulary, every tool and methodology named specifically, zero ATS gaps. Exceptional. Rare.

NO HALLUCINATION: Only evaluate what is explicitly stated.

FEEDBACK GUIDELINES:
- Strengths: Reference specific content. Explain why it communicates effectively.
- Weaknesses: Focus on vague language, placement defects, scope gaps — calibrated to their track. For metrics-heavy roles, flag missing quantification. For non-metrics, flag vague descriptions and missing scope indicators. For Track B, flag missing organizational outcomes.
- Suggestions: Concrete, role-appropriate examples calibrated to their actual career type. Flag each placement defect with a specific fix.
- Do NOT flag missing industry influence as a weakness unless the candidate is explicitly positioned at a national leadership level.
- Do NOT penalize Track A candidates for lacking organizational leadership credentials.`

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