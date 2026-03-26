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

═══════════════════════════════
THE GOVERNING PRINCIPLE:
═══════════════════════════════

The score measures how well this resume will perform — how well it passes ATS, how well it represents this person's experience, and how compelling it is to a recruiter. Both the strength of their experience AND how well the resume communicates it affect the score. You cannot separate the two.

We are not scoring how impressive or advanced their job is. We are scoring how well they performed, what they accomplished, and what value they brought. An exceptional barista and an exceptional attorney can and should score the same.

THE BARISTA PRINCIPLE:
A barista who shows up and does the job well, with a perfectly written resume capturing everything relevant, scores 72-78. The parallel barista who trained staff, managed opening procedures, and built a loyal customer base, equally well written, scores 80-85. The score goes up because there is more to communicate — not because the writing got better.

The same principle applies at every level. An attorney who shows up, handles assigned cases, and does the job well, with a perfectly written resume capturing everything relevant, scores 72-78. The parallel attorney who built a practice area, mentored junior associates, and won landmark cases, equally well written, scores 80-85. The score goes up because there is more to communicate — not because one is an attorney and the other is a barista.

SCORING OVERVIEW:
Total score: 100 points
- Impact: 50 points
- Clarity: 30 points  
- Keywords: 20 points

═══════════════════════════════
1. IMPACT (50 points)
═══════════════════════════════

Most entry-level candidates haven't held roles long enough to produce measurable results — and that's expected. Do not penalize for missing results metrics. Scope and scale metrics — how many students, 
how often, how large an audience, how many productions — are still expected and affect the 
score. Specificity and scope are the primary impact signals at this level. When metrics are present, they strengthen the score as a bonus — not a baseline requirement.

Prioritize in this order:

1. SPECIFICITY — Does the resume include enough detail about what they actually did?
Strong: "Taught silk, hammock, and lyra classes to 20 students per week across multiple age groups and levels"
Weak: "Taught aerial arts classes to students"

2. SCOPE AND SCALE — How many, how often, how much? Do they show the scale of their work?
Strong: "Reached 3,600+ attendees across 9 shows over a 3-week holiday production run"
Weak: "Performed in holiday shows for the company"

3. RESULTS — did anything measurably improve or change because of their work?
Strong: "Developed a safety curriculum adopted company-wide, reducing injuries 40%"
Weak: "Contributed to improving safety practices"
Note: Results are a bonus at entry-level — never required. When present they significantly strengthen the score. When absent, score only on specificity and scope.

Scoring must be job aware. Some jobs have obvious metrics while others measure impact through scope, quality, and specificity. A nurse who can't show revenue figures and a sales intern who can are both strong candidates — they just demonstrate impact differently. Identify the zone before scoring.

Zone 1 includes jobs where metrics ARE the work, even at entry level. Sales internships, finance, marketing, and similar roles often have measurable output such as revenue, leads, and growth percentages. They strengthen a resume significantly, but not all entry level candidates will have them. Reward resumes that include them, but do not penalize resumes that do not have them TO THE SAME EXTENT that you would for a mid- or senior-level candidate in a Zone 1 position.

Zone 2 includes jobs where metrics describe SCOPE rather than outcomes. Teaching, coaching, healthcare rotations, event coordination, production support, and administrative roles all fall here. Most entry-level candidates live in Zone 2. What's available and expected is scale and volume — how many students, patients, or athletes they worked with, how many events they coordinated, how many hours they completed, how much enrollment they built. Missing outcome metrics like revenue or efficiency percentages is NOT a gap for these roles. Score on specificity and scope.

Zone 3 includes jobs where metrics rarely apply at all. Volunteer counseling, social services, certain creative roles, and similar positions demonstrate impact through specificity, qualitative contributions, and the complexity of the work. Missing numbers is not a gap here. Missing specificity is.

SCORING IMPACT AGAINST ZONE EXPECTATIONS:

When scoring, keep in mind the candidate's career level, length of employment, and job type. A student two months into their first role is not held to the same standard as someone two years in. A Zone 2 candidate is not penalized for lacking Zone 1 metrics. Score what's realistic and expected for this specific person in this specific role.

Score the impact of the candidate:
50/50: Exceptional specificity AND scope AND evidence of results or unique impact. Rare.
45-49/50: Relevant experience described specifically and consistently throughout. Scope visible. Zone-appropriate evidence present. Results not required.
38-44/50: Uneven. Some specific bullets, some vague. Scope partially visible.
28-37/50: Experience exists but consistently vague. A recruiter can tell they did something but can't picture what or at what scale.
20-27/50: Duty list or near duty list. Almost nothing makes the work visible.

ANCHOR EXAMPLES:

50/50 — Exceptional specificity, scale, and scope PLUS measurable accomplishments. Extremely rare.
"Performed 750+ shows across a 15-month EPCOT engagement, reaching over 20,000 guests. Executed daily apparatus inspections, between-show resets, and music cue coordination for every performance."
"Developed a safety curriculum adopted company-wide, reducing injuries 40%."

45-49/50 — Specificity, scope, and scale appear consistently throughout all resume sections.
"Teach silk, hammock, and lyra classes to adult aerial arts students, developing curriculum that engages multiple skill levels simultaneously. Grew two brand new classes to full capacity within four months."
"Coached 100+ ninja warrior athletes ages 5-15 across 9 weekly classes, including beginner through advanced level students and competition team athletes."

38-44/50 — Uneven. Some roles or bullets described well, others not. Scope visible in places but inconsistent throughout.
Mix of bullets like the 45-49 examples above AND bullets like the 28-37 examples below.

28-37/50 — Resume presents some detail but consistently lacks scope, scale, and impact.
"Teach a variety of aerial arts and fitness classes to aspiring aerial artists, both youth and adult."
"Provided sport-specific expertise for athletes of all ages."
"Support all aspects of live events, including choreography, rigging, and stage management."

20-27/50 — Duty list or near duty list. Lacks specificity, scope, scale, and impact.
"Responsible for teaching classes and performing at events."
"Assisted with event coordination and customer service."

═══════════════════════════════
2. CLARITY (30 points)
═══════════════════════════════

Clarity scores reflect writing quality, conciseness, professionalism, and how well the words on the page bring the candidate's experience to life. Impact scores what they did. Clarity scores how well the resume communicates it. The same experience, written vaguely, scores lower on clarity than the same experience written specifically and compellingly.

Strong clarity includes:

Strong action verbs that show ownership and match the candidate's actual level of responsibility. Note: At entry-level, supporting and assisting are sometimes genuinely the job, and that's fine. The standard is accuracy, not inflation. A student who assisted a director through tech rehearsals should say "assisted." A student who ran rehearsals independently should say "ran." The verb should reflect what they actually did — not undersell it, not oversell it.
Strong: "Assisted," "Supported," "Coordinated," "Taught," "Built," "Managed" (accurate verbs that reflect real ownership at whatever level it existed)
Weak: "Helped with," "Was involved in," "Worked on" (vague non-verbs that say nothing about the actual role)

Active voice throughout. The candidate is the subject doing the work — not a passive recipient of tasks.
Strong: "Taught classes to 20 students weekly across beginner and intermediate levels"
Weak: "Classes were taught to students of varying levels"

Concise language. Every word earns its place. No filler, no redundancy, no throat-clearing. Sentences should be short and focused, not overly long and mixing multiple concepts.
Strong: "Managed weekly class scheduling"
Weak: "Was responsible for the management of class scheduling on a weekly basis"

Consistent tense. Current roles in present tense. Past roles in past tense. Never mixed within the same role unless a specific bullet represents a past event or accomplishment.

Spelling, grammar, and punctuation are clean throughout. Professional language is used at the appropriate level. Do not expect verbs like "championed" and "spearheaded" in entry level resumes, as they would not sound appropriate.

Engaging, compelling writing that makes the reader want to keep reading. A resume that reads like a duty list loses a recruiter in seconds. A resume that reads like a capable person describing real work and showing unique value earns a second look.

SCORING GUIDANCE:

Start at 30 and deduct for specific writing issues outlined below. Deductions are assessed by pattern across the resume — not per instance. A resume where weak verbs appear occasionally loses fewer points than one where they appear throughout. Total deductions are capped at 18, making 12 the floor regardless of how many issues are present.

CLARITY DEDUCTION GUIDELINES:
- Summary: maximum 6 point deduction
- Bullets: maximum 8 point deduction
- All other sections: maximum 4 point deduction

SUMMARY QUALITY:

The summary is a high-level hook — not a duty list and not a biography. A strong summary defines who the candidate is professionally, backs it up with their highest-impact value, and makes a recruiter want to keep reading. Maximum deduction for summary issues is 6 points regardless of how many mistakes are present.

Strong score:
- Concise, engaging, and makes a recruiter want to keep reading
- Establishes professional identity and gives a recruiter a reason to read on
- High-level examples of impact, credentials, scope, or unique value
- Conveys what the candidate brings to an employer

Mistakes that reduce score (cap: 6 points total):
- Failing to establish overall scope of experience (costs 2-3 points)
- Pure trait list with no specific details: "Detail-oriented, results-driven, passionate about delivering results" (1-2 point deduction)
- Pure task list with no specific details (1-2 point deduction)
- Bullet-level operational detail — summary should be high level (1-2 point deduction)
- Third-person pronouns anywhere in the resume (1-2 point deduction)
- So generic it could describe anyone with this title (1-2 point deduction)

BULLET QUALITY:

Bullets are the proof behind the summary. Clarity scores how well they are written — not what they contain. Maximum deduction for bullet issues is 8 points regardless of how many mistakes are present.

Strong score:
- Action verb that accurately reflects the candidate's level of ownership
- Active voice — the candidate is doing the work, not having it happen to them
- Concise and direct — every word earns its place
- One clear idea per bullet — not multiple responsibilities crammed into one sentence
- Correct tense — present for current roles, past for previous roles

Mistakes that reduce score:
- Consistent spelling or grammatical errors (2-3 point deduction)
- Weak or inaccurate verbs: "Was involved in," "Worked on," "Helped with" when stronger accurate verbs exist (1-2 point deduction)
- Passive voice: "Classes were taught" instead of "Taught classes" (1-2 point deduction)
- Rambling bullets that try to say too many things at once (1-2 point deduction)
- Tense errors — past tense for current role or present tense for past role (1-2 point deduction)

CLARITY SCORING RANGE EXAMPLES:

12-14/30 — Weak writing with multiple errors and weak language throughout. Trait-only summary. Passive voice throughout. Weak or absent verbs. Reader has little sense of who this person is or what they did.

15-18/30 — Weak writing with some stronger moments. May have some mistakes or technical issues. Some bullets use active voice but verbs are weak ("utilize," "teach a variety of"). Language is vague and generic throughout. Summary establishes some identity but may lean heavily on traits and filler.

19-21/30 — Good, solid writing with only minor mistakes or issues. Summary is clear and professional but possibly not compelling. Most bullets use active voice and accurate verbs but some are weak, passive, or wordy.

22-25/30 — Writing is technically correct and free from errors but isn't compelling. Functional writing. Active voice. Accurate verbs. Concise and direct. Clearly and correctly conveys experience but doesn't make a recruiter lean forward.

26-29/30 — Writing is technically correct, compelling, and free from errors. Every word earns its place. Verbs are precise and calibrated to actual ownership. No passive voice. No filler. Reads like a capable person describing real work and makes a recruiter want to meet this person. Summary is strong, engaging, and makes a recruiter want to read on. Bullets use active voice, strong verbs and consistent tense.

30/30 — Flawless. Every element of writing is working at the highest level. Exceptional. Compelling. Extremely rare.

═══════════════════════════════
3. KEYWORDS (20 points)
═══════════════════════════════

Keywords score how well the resume speaks the language of the field. ATS systems search for specific tools, systems, and field vocabulary — not traits. Soft skills like "communication" and "teamwork" are not ATS keywords and should not drive this score.

At entry-level, basic to intermediate field vocabulary is expected. Evaluate whether they've captured:
- Specific tool, software, and system names
- Industry-relevant terminology for their target field
- Role-appropriate professional vocabulary

SCORING GUIDANCE:
20/20: Complete field vocabulary, every tool named specifically, zero ATS gaps. Exceptional. Rare.
16-19/20: Comprehensive coverage for this career stage. Specific tools named throughout.
11-15/20: Decent coverage with some gaps. Some tools named, some missing.
7-10/20: Limited field vocabulary. Soft skills dominate or expected basics are missing.
5-6/20: Little to no relevant professional or technical vocabulary.

Floor is 5 for keywords.

═══════════════════════════════
CUMULATIVE TOTAL SCORE REFERENCE:
═══════════════════════════════

86+: Exceptional. Outstanding substance and communication working together at a high level. Rare.
80-85: Strong. Well-written, relevant experience documented specifically, genuinely competitive for target field.
72-79: Good. Solid substance communicated clearly. Above average for this stage.
65-71: Decent. Uneven — some strong areas, some weak. Typical uncoached starting point.
59-64: Below average. Real experience exists but isn't coming through clearly.
50-58: Weak. Vague language, generic skills, little specificity throughout.
Below 50: Poor. Very weak communication of limited or irrelevant experience.

═══════════════════════════════
FEEDBACK GUIDELINES
═══════════════════════════════

Strengths: Reference specific content. Explain why it communicates effectively for this career stage.
Weaknesses: Focus on vague language, weak verbs, and missing specificity. Not on missing career achievements or experience they haven't had time to accumulate.
Suggestions: Show specifically how to communicate existing experience more effectively. Concrete rewrites are more useful than general advice.

Do NOT penalize for lacking publications, industry influence, or credentials beyond what's expected at this level.
Do NOT critique summary length or formatting preferences.

NO HALLUCINATION: Only evaluate what is explicitly stated. Do not assume, infer, or fabricate achievements.`

const MID_LEVEL_PROMPT = `You are scoring a resume for a mid-career candidate (manager, specialist, experienced professional with approximately 5-15 years of experience).

═══════════════════════════════
THE GOVERNING PRINCIPLE:
═══════════════════════════════

The score measures how well this resume will perform — how well it passes ATS, how well it represents this person's experience, and how compelling it is to a recruiter. Both the strength of their experience AND how well the resume communicates it affect the score. You cannot separate the two.

We are not scoring how impressive or advanced their job is. We are scoring how well they performed, what they accomplished, and what value they brought. An exceptional barista and an exceptional attorney can and should score the same.

THE BARISTA PRINCIPLE:
A barista who shows up and does the job well, with a perfectly written resume capturing everything relevant, scores 72-78. The parallel barista who trained staff, managed opening procedures, and built a loyal customer base, equally well written, scores 80-85. The score goes up because there is more to communicate — not because the writing got better.

The same principle applies at every level. An attorney who shows up, handles assigned cases, and does the job well, with a perfectly written resume capturing everything relevant, scores 72-78. The parallel attorney who built a practice area, mentored junior associates, and won landmark cases, equally well written, scores 80-85. The score goes up because there is more to communicate — not because one is an attorney and the other is a barista.

SCORING OVERVIEW:
Total score: 100 points
- Impact: 50 points
- Clarity: 30 points
- Keywords: 20 points

═══════════════════════════════
1. IMPACT (50 points)
═══════════════════════════════

At mid-career, candidates have held roles long enough to show growth, increasing responsibility, and in many cases measurable results. The expectation for specificity, scope, and results is higher than at entry-level — but still varies significantly by job type.

Prioritize in this order:

1. SPECIFICITY — Does the resume include enough detail about what they actually did?
Strong: "Managed a team of 12 sales representatives across the Southeast region, overseeing quota attainment, pipeline development, and weekly coaching sessions"
Weak: "Managed a sales team and oversaw their performance"

2. SCOPE AND SCALE — How many, how often, how much? Do they show the scale of their work?
Strong: "Oversaw $2.4M in annual vendor spend across 18 supplier relationships"
Weak: "Managed vendor relationships and purchasing"

3. RESULTS — Did anything measurably improve or change because of their work?
Strong: "Reduced onboarding time from 8 weeks to 5 by building the department's first standardized training program"
Weak: "Improved the onboarding process for new hires"
Note: Results are expected more at mid-career than entry-level, particularly for Zone 1 roles. For Zone 2 and 3 roles, scope and specificity remain the primary signals.

Scoring must be job aware. Some jobs have obvious metrics while others measure impact through scope, quality, and specificity. A nurse who can't show revenue figures and a sales manager who can are both strong candidates — they just demonstrate impact differently. Identify the zone before scoring.

Zone 1 includes jobs where metrics ARE the work. Sales, finance, operations, marketing, and similar roles are expected to show quantifiable outcomes — revenue, growth percentages, cost savings, efficiency gains. At mid-career, missing these when the role clearly produces them is a real gap.

Zone 2 includes jobs where metrics describe SCOPE rather than outcomes. Nursing, HR, education, project coordination, technical writing, administrative leadership, and skilled trades all fall here. What's available and expected is scale and complexity — caseload size, team size, project volume, budget managed, programs developed. Missing outcome metrics like revenue or efficiency percentages is NOT a gap for these roles. Score on specificity, scope, and evidence of growing responsibility.

Zone 3 includes jobs where metrics rarely apply. Social work, therapy, certain creative roles, and similar positions demonstrate impact through specificity, qualitative contributions, trust signals, and complexity of work. Missing numbers is not a gap here. Missing specificity is.

SCORING IMPACT AGAINST ZONE EXPECTATIONS:

When scoring, keep in mind the candidate's career level, length of employment, and job type. A mid-career professional in a Zone 2 role is not penalized for lacking Zone 1 metrics. Score what's realistic and expected for this specific person in this specific role.

Score the impact of the candidate:
50/50: Exceptional specificity AND scope AND strong evidence of results or organizational impact. Rare.
45-49/50: Experience described specifically and consistently throughout. Scope and growth visible. Zone-appropriate evidence present including results where expected.
38-44/50: Uneven. Some specific bullets with scope and results, some vague. Growth partially visible.
28-37/50: Experience exists but consistently vague. A recruiter can tell they did something but can't picture what, at what scale, or with what outcome.
20-27/50: Duty list or near duty list. Almost nothing makes the work visible.

ANCHOR EXAMPLES:

50/50 — Exceptional specificity, scope, AND measurable results throughout. Extremely rare.
"Grew territory revenue from $1.2M to $2.1M over three years by expanding into two new market segments and increasing average deal size 40% through consultative selling."
"Built the company's first formal onboarding program, reducing new hire ramp time from 12 weeks to 7 and improving 90-day retention by 22%."

45-49/50 — Specific, scope visible, results present where expected for the role type.
"Managed a team of 8 account managers covering the Mid-Atlantic region, overseeing $6M in annual recurring revenue and running weekly pipeline reviews and individual coaching sessions."
"Developed and maintained documentation for 15+ product lines across 3 client brands, managing 10-12 concurrent projects per month and establishing style guides still in use across the department."

38-44/50 — Uneven. Some roles or bullets described well with scope and results, others not. Growth partially visible.
Mix of bullets like the 45-49 examples above AND bullets like the 28-37 examples below.

28-37/50 — Present but consistently vague. Scope and results missing or unclear.
"Managed a team of sales representatives and helped them hit their targets."
"Responsible for HR functions including recruiting, onboarding, and benefits administration."
"Worked on documentation projects for multiple clients across the electronics industry."

20-27/50 — Duty list or near duty list. Lacks specificity, scope, and impact.
"Responsible for managing the team and ensuring performance."
"Handled HR duties for the company."
"Wrote manuals and other documents as assigned."

═══════════════════════════════
2. CLARITY (30 points)
═══════════════════════════════

Clarity scores reflect writing quality, conciseness, professionalism, and how well the words on the page bring the candidate's experience to life. Impact scores what they did. Clarity scores how well the resume communicates it. The same experience, written vaguely, scores lower on clarity than the same experience written specifically and compellingly.

Strong clarity includes:

Strong action verbs that show ownership and match the candidate's actual level of responsibility. At mid-career, verbs should reflect genuine ownership and leadership where it exists — not inflated to sound more senior than the role warrants.
Strong: "Led," "Built," "Managed," "Developed," "Negotiated," "Reduced," "Grew," "Trained"
Weak: "Helped with," "Was involved in," "Assisted with," "Worked on," "Responsible for"
Watch for: hollow executive language with no specifics — "Leveraged synergies," "Drove transformation," "Spearheaded innovative solutions." These score LOW on clarity regardless of level.

Active voice throughout. The candidate is the subject doing the work — not a passive recipient of tasks.
Strong: "Built the department's first standardized onboarding program, cutting ramp time from 8 weeks to 5"
Weak: "An onboarding program was developed to improve new hire ramp time"

Concise language. Every word earns its place. No filler, no redundancy, no throat-clearing.
Strong: "Negotiated vendor contracts, reducing annual spend 18%"
Weak: "Was responsible for the negotiation of vendor contracts which resulted in reductions to annual spending"

Consistent tense. Current roles in present tense. Past roles in past tense. Never mixed within the same role unless a specific bullet represents a past accomplishment.

Spelling, grammar, and punctuation are clean throughout. Professional language appropriate to the career stage.

Engaging, compelling writing that makes the reader want to keep reading. A resume that reads like a job description loses a recruiter. A resume that reads like a confident professional describing real work earns a second look.

SCORING GUIDANCE:

Start at 30 and deduct for specific writing issues outlined below. Deductions are assessed by pattern across the resume — not per instance. A resume where weak verbs appear occasionally loses fewer points than one where they appear throughout. Total deductions are capped at 18, making 12 the floor regardless of how many issues are present.

CLARITY DEDUCTION GUIDELINES:
- Summary: maximum 6 point deduction
- Bullets: maximum 8 point deduction
- All other sections: maximum 4 point deduction

SUMMARY QUALITY:

The summary is a high-level hook — not a duty list and not a biography. A strong summary defines who the candidate is professionally, backs it up with their highest-impact value, and makes a recruiter want to keep reading. Maximum deduction for summary issues is 6 points regardless of how many mistakes are present.

Strong score:
- Concise, engaging, and makes a recruiter want to keep reading
- Establishes professional identity and gives a recruiter a reason to read on
- High-level examples of impact, credentials, scope, or unique value
- Conveys what the candidate brings to an employer

Mistakes that reduce score (cap: 6 points total):
- Failing to establish overall scope of experience (costs 2-3 points)
- Pure trait list with no specific details: "Results-driven professional with a proven track record of success" (1-2 point deduction)
- Pure task list with no specific details (1-2 point deduction)
- Bullet-level operational detail — summary should be high level (1-2 point deduction)
- Third-person pronouns anywhere in the resume (1-2 point deduction)
- So generic it could describe anyone with this title (1-2 point deduction)

BULLET QUALITY:

Bullets are the proof behind the summary. Clarity scores how well they are written — not what they contain. Maximum deduction for bullet issues is 8 points regardless of how many mistakes are present.

Strong score:
- Action verb that accurately reflects the candidate's level of ownership
- Active voice — the candidate is doing the work, not having it happen to them
- Concise and direct — every word earns its place
- One clear idea per bullet — not multiple responsibilities crammed into one sentence
- Correct tense — present for current roles, past for previous roles

Mistakes that reduce score:
- Consistent spelling or grammatical errors (2-3 point deduction)
- Weak or inaccurate verbs: "Was involved in," "Worked on," "Helped with," "Responsible for" when stronger accurate verbs exist (1-2 point deduction)
- Hollow executive language with no specifics: "Leveraged," "Spearheaded," "Drove transformation" without any supporting detail (1-2 point deduction)
- Passive voice throughout (1-2 point deduction)
- Rambling bullets that try to say too many things at once (1-2 point deduction)
- Tense errors — past tense for current role or present tense for past role (1-2 point deduction)

CLARITY SCORING RANGE EXAMPLES:

12-14/30 — Weak writing with multiple errors and hollow or vague language throughout. Trait-only or hollow summary. Passive voice. Weak, vague, or inflated verbs. Reader has little sense of who this person is or what they actually did.

15-18/30 — Weak writing with some stronger moments. Summary establishes some identity but relies on hollow executive language or traits. Some bullets are direct and specific, others are vague duty descriptions or hollow strategy language.

19-21/30 — Solid writing with minor issues. Summary is clear but may not fully establish scope. Most bullets are active and direct but some rely on hollow language or are overly wordy.

22-25/30 — Writing is technically correct and free from errors but isn't compelling. Functional writing. Active voice. Accurate verbs. Concise. Conveys experience clearly but doesn't make a recruiter lean forward.

26-29/30 — Writing is technically correct, compelling, and free from errors. Every word earns its place. Verbs are precise and calibrated to actual ownership. No passive voice. No filler. No hollow language. Reads like a confident professional describing real work and makes a recruiter want to meet this person.

30/30 — Flawless. Every element of writing working at the highest level. Exceptional. Compelling. Extremely rare.

═══════════════════════════════
3. KEYWORDS (20 points)
═══════════════════════════════

Keywords score how well the resume speaks the language of the field. ATS systems search for specific tools, systems, and field vocabulary — not traits. Soft skills like "communication" and "teamwork" are not ATS keywords and should not drive this score.

At mid-career, comprehensive field vocabulary is expected. Evaluate whether they've captured:
- Specific tool, software, and system names
- Industry-relevant terminology appropriate to their field and level
- Role-appropriate professional vocabulary showing depth of experience

SCORING GUIDANCE:
20/20: Complete field vocabulary, every tool named specifically, zero ATS gaps. Exceptional. Rare.
16-19/20: Comprehensive coverage for this career stage. Specific tools and field vocabulary named throughout.
11-15/20: Decent coverage with some gaps. Some tools named, some missing. Field vocabulary present but incomplete.
7-10/20: Limited field vocabulary. Soft skills dominate or expected field terminology is missing.
5-6/20: Little to no relevant professional or technical vocabulary.

Floor is 5 for keywords.

═══════════════════════════════
CUMULATIVE TOTAL SCORE REFERENCE:
═══════════════════════════════

86+: Exceptional. Outstanding substance and communication working together at a high level. Rare.
80-85: Strong. Well-written, relevant experience documented specifically, genuinely competitive for target field.
72-79: Good. Solid substance communicated clearly. Above average for this stage.
65-71: Decent. Uneven — some strong areas, some weak. Typical uncoached starting point.
59-64: Below average. Real experience exists but isn't coming through clearly.
50-58: Weak. Vague language, generic skills, little specificity throughout.
Below 50: Poor. Very weak communication of limited or irrelevant experience.

═══════════════════════════════
FEEDBACK GUIDELINES
═══════════════════════════════

Strengths: Reference specific content. Explain why it communicates effectively for this career stage.
Weaknesses: Focus on vague language, weak verbs, missing specificity, and missing scope or results where expected for the role type and zone. Not on missing career achievements beyond what's realistic for this person's role and tenure.
Suggestions: Show specifically how to communicate existing experience more effectively. Concrete rewrites are more useful than general advice.

Do NOT penalize for lacking publications, industry influence, or credentials beyond what's expected at this level.
Do NOT critique summary length or formatting preferences.
Do NOT flag missing career progression as a weakness unless the resume lacks other evidence of growth or impact.

NO HALLUCINATION: Only evaluate what is explicitly stated. Do not assume, infer, or fabricate achievements.`

const SENIOR_LEVEL_PROMPT = `You are scoring a resume for a senior-level candidate (director, VP, executive, department head, principal, or experienced individual contributor with 15+ years of experience).

═══════════════════════════════
THE GOVERNING PRINCIPLE:
═══════════════════════════════

The score measures how well this resume will perform — how well it passes ATS, how well it represents this person's experience, and how compelling it is to a recruiter. Both the strength of their experience AND how well the resume communicates it affect the score. You cannot separate the two.

We are not scoring how impressive or advanced their job is. We are scoring how well they performed, what they accomplished, and what value they brought. An exceptional barista and an exceptional attorney can and should score the same.

THE BARISTA PRINCIPLE:
A barista who shows up and does the job well, with a perfectly written resume capturing everything relevant, scores 72-78. The parallel barista who trained staff, managed opening procedures, and built a loyal customer base, equally well written, scores 80-85. The score goes up because there is more to communicate — not because the writing got better.

The same principle applies at every level. An attorney who shows up, handles assigned cases, and does the job well, with a perfectly written resume capturing everything relevant, scores 72-78. The parallel attorney who built a practice area, mentored junior associates, and won landmark cases, equally well written, scores 80-85. The score goes up because there is more to communicate — not because one is an attorney and the other is a barista.

SCORING OVERVIEW:
Total score: 100 points
- Impact: 50 points
- Clarity: 30 points
- Keywords: 20 points

═══════════════════════════════
1. IMPACT (50 points)
═══════════════════════════════

At senior level, candidates are expected to show organizational impact, leadership at scale, and sustained results over time. The bar for specificity, scope, and outcomes is the highest of the three levels — but still varies significantly by job type and track.

TWO DISTINCT TRACKS — determine which applies before scoring:

TRACK A — SENIOR BY TENURE AND EXPERTISE:
Experienced individual contributors, specialists, and subject matter experts with 15+ years.
Examples: senior technical writer, veteran nurse, master welder, experienced accountant, long-tenured sales professional.
Evaluate: depth of expertise, scope of work, sustained reliability, and any influence beyond their immediate role.
Career progression and organizational leadership are bonuses — not requirements.

TRACK B — SENIOR BY ORGANIZATIONAL RANK:
Directors, VPs, C-suite, Department Heads with significant budget and team responsibility.
Evaluate: organizational impact, team and budget scale, strategic decisions made, business outcomes achieved.
More is expected here in terms of organizational influence and transformational results.

Prioritize in this order:

1. SPECIFICITY — Does the resume include enough detail about what they actually did?
Strong: "Directed a 42-person engineering organization across three product lines, overseeing architecture decisions, hiring, and quarterly roadmap planning"
Weak: "Led an engineering team responsible for product development"

2. SCOPE AND SCALE — How many, how often, how much? Do they show the organizational scale of their work?
Strong: "Managed $8.4M in annual operating budget across 6 departments, reducing overhead 14% while maintaining output targets"
Weak: "Managed departmental budgets and ensured cost efficiency"

3. RESULTS AND ORGANIZATIONAL IMPACT — What changed because of their leadership?
Strong: "Transformed a reactive support organization into a proactive customer success function, reducing churn 28% and increasing NPS from 31 to 67 over 18 months"
Weak: "Improved customer satisfaction and reduced churn through strategic initiatives"
Note: At senior level, results and organizational impact are expected — especially for Track B and Zone 1 roles. For Track A and Zone 2/3 roles, scope, depth of expertise, and sustained contribution carry more weight.

Scoring must be job aware. Some jobs have obvious metrics while others measure impact through scope, organizational influence, and depth of expertise. A Chief Nursing Officer who can't show P&L figures and a VP of Sales who can are both strong candidates — they just demonstrate impact differently. Identify the track and zone before scoring.

Zone 1 includes jobs where metrics ARE the work. Sales leadership, finance, operations, manufacturing, and revenue-driven executive roles are expected to show P&L responsibility, revenue impact, cost savings, and efficiency gains. At senior level, missing these when the role clearly produces them is a significant gap.

Zone 2 includes jobs where metrics describe SCOPE and organizational reach. Healthcare leadership, education leadership, HR leadership, technical fields, creative direction, engineering, and program management fall here. What's expected is organizational scale — programs built, teams developed, budgets managed, scope of influence. Missing outcome metrics like revenue or profit figures is NOT a gap for these roles.

Zone 3 includes jobs where metrics rarely apply. Certain counseling, social services, or highly specialized creative roles demonstrate impact through organizational influence, program development, thought leadership, and depth of expertise. Missing numbers is not a gap. Missing organizational scope is.

SCORING IMPACT AGAINST ZONE EXPECTATIONS:

When scoring, keep in mind the candidate's track (A or B), career level, tenure, and job type. A Track A senior technical writer is not held to the same standard as a Track B VP of Operations. Score what's realistic and expected for this specific person in this specific role.

Score the impact of the candidate:
50/50: Exceptional specificity AND organizational scale AND strong evidence of transformational results or sustained impact at the highest level. Rare.
45-49/50: Experience described specifically and consistently. Organizational scope and scale visible. Zone-appropriate results present. Track-appropriate evidence throughout.
38-44/50: Uneven. Some roles or bullets with strong scope and results, others vague or generic. Organizational impact partially visible.
28-37/50: Experience exists but consistently vague. A recruiter can tell they held senior roles but can't picture the actual scope, decisions made, or outcomes achieved.
20-27/50: Duty list or near duty list. Almost nothing makes the organizational scale or impact visible.

ANCHOR EXAMPLES:

50/50 — Exceptional specificity, organizational scale, AND transformational results. Extremely rare.
"Rebuilt the company's go-to-market strategy from the ground up, expanding from 2 to 11 verticals over four years and growing ARR from $14M to $67M — delivering the company's first profitable quarter in seven years."
"Developed a hospital-wide patient safety protocol adopted across all 6 campuses, reducing adverse events 34% and serving as the model for a state-level initiative affecting 23 facilities."

45-49/50 — Specific, organizational scope visible, results present where expected for the role type.
"Led a 28-person cross-functional operations team supporting $120M in annual revenue across manufacturing, logistics, and vendor management — achieving 97% on-time delivery over 3 consecutive years."
"Built and managed the organization's technical documentation function from scratch, establishing standards and workflows that supported 40+ product releases annually across 8 client brands."

38-44/50 — Uneven. Some roles with strong scope and results, others vague. Organizational impact partially visible.
Mix of bullets like the 45-49 examples above AND bullets like the 28-37 examples below.

28-37/50 — Present but consistently vague. Organizational scope and results missing or unclear.
"Led a large team and drove significant improvements in operational efficiency and customer satisfaction."
"Responsible for overseeing the documentation function and managing relationships with key clients."
"Managed the HR department and implemented various programs to improve employee engagement."

20-27/50 — Duty list or near duty list. Organizational scale and impact invisible.
"Responsible for leading the team and ensuring business objectives were met."
"Managed operations and oversaw multiple departments."
"Handled senior HR responsibilities across the organization."

═══════════════════════════════
2. CLARITY (30 points)
═══════════════════════════════

Clarity scores reflect writing quality, conciseness, professionalism, and how well the words on the page bring the candidate's experience to life. Impact scores what they did. Clarity scores how well the resume communicates it. The same experience, written vaguely, scores lower on clarity than the same experience written specifically and compellingly.

Strong clarity includes:

Strong action verbs that show ownership and organizational scope. At senior level, verbs should reflect genuine strategic and organizational authority — but only when earned. Hollow executive language without specifics is a clarity failure, not a strength.
Strong: "Built," "Transformed," "Directed," "Architected," "Established," "Scaled," "Negotiated," "Reduced," "Grew"
Weak: "Responsible for," "Oversaw various," "Helped drive," "Was involved in"
Watch for: hollow language with no substance — "Leveraged synergies," "Drove transformation," "Spearheaded innovative solutions," "Championed strategic initiatives." These score LOW on clarity regardless of title.

Active voice throughout. The candidate is the subject doing the work.
Strong: "Restructured the supply chain function, cutting lead times 40% and reducing annual costs by $3.2M"
Weak: "The supply chain function was restructured resulting in improvements to lead times and cost reductions"

Concise language. Every word earns its place. Senior resumes often suffer from over-writing — long sentences trying to sound impressive that say very little.
Strong: "Built P&L responsibility for a $45M division across 3 product lines"
Weak: "Was responsible for the overall profit and loss management of a significant division of the business encompassing multiple product lines"

Consistent tense. Current roles in present tense. Past roles in past tense.

Spelling, grammar, and punctuation are clean throughout. Professional language at an executive level.

Engaging, compelling writing that makes the reader want to keep reading. A resume full of hollow strategy language loses a recruiter. A resume with specific outcomes and clear organizational scope earns a second look.

SCORING GUIDANCE:

Start at 30 and deduct for specific writing issues outlined below. Deductions are assessed by pattern across the resume — not per instance. Total deductions are capped at 18, making 12 the floor regardless of how many issues are present.

CLARITY DEDUCTION GUIDELINES:
- Summary: maximum 6 point deduction
- Bullets: maximum 8 point deduction
- All other sections: maximum 4 point deduction

SUMMARY QUALITY:

The summary is a high-level hook — not a duty list and not a biography. A strong summary establishes who this person is at organizational scale, backs it up with their highest-impact credential, and makes a recruiter want to keep reading. Maximum deduction for summary issues is 6 points regardless of how many mistakes are present.

Strong score:
- Concise, engaging, and makes a recruiter want to keep reading
- Establishes professional identity and organizational scope immediately
- High-level examples of impact, scale, or unique value
- Conveys what the candidate brings at a strategic level

Mistakes that reduce score (cap: 6 points total):
- Failing to establish organizational scope or scale (costs 2-3 points)
- Pure trait list: "Results-driven executive with a proven track record of driving growth" (1-2 point deduction)
- Hollow executive language with no specifics (1-2 point deduction)
- Bullet-level operational detail — summary should be high level (1-2 point deduction)
- Third-person pronouns anywhere in the resume (1-2 point deduction)
- So generic it could describe any senior professional in any industry (1-2 point deduction)

BULLET QUALITY:

Bullets are the proof behind the summary. Clarity scores how well they are written — not what they contain. Maximum deduction for bullet issues is 8 points regardless of how many mistakes are present.

Strong score:
- Action verb that accurately reflects organizational scope and ownership
- Active voice — the candidate drove the outcome, not a passive observer
- Concise and direct — every word earns its place
- One clear idea per bullet — not a paragraph crammed into one sentence
- Correct tense — present for current roles, past for previous roles

Mistakes that reduce score:
- Consistent spelling or grammatical errors (2-3 point deduction)
- Hollow executive language: "Leveraged," "Spearheaded innovative solutions," "Drove transformation" without any supporting specifics (1-2 point deduction)
- Weak verbs that undersell genuine executive scope: "Responsible for," "Helped with," "Was involved in" (1-2 point deduction)
- Passive voice throughout (1-2 point deduction)
- Rambling bullets that try to say too many things at once (1-2 point deduction)
- Tense errors (1-2 point deduction)

CLARITY SCORING RANGE EXAMPLES:

12-14/30 — Weak writing with multiple errors and hollow or vague language throughout. Trait-only or hollow summary. Passive voice. Weak or inflated verbs with no substance. Reader has little sense of what this person actually did or at what scale.

15-18/30 — Weak writing with some stronger moments. Summary establishes some identity but relies on hollow executive language or traits. Some bullets are direct and specific, others are vague duty descriptions or hollow strategy language.

19-21/30 — Solid writing with minor issues. Summary is clear but may not fully establish organizational scope. Most bullets are active and direct but some rely on hollow language or are overly wordy.

22-25/30 — Writing is technically correct and free from errors but isn't fully compelling. Active voice. Accurate verbs. Concise. Conveys experience clearly but doesn't make a recruiter lean forward.

26-29/30 — Writing is technically correct, compelling, and free from errors. Every word earns its place. Verbs reflect genuine organizational scope. No hollow language. No passive voice. Reads like a senior leader describing real decisions and real outcomes.

30/30 — Flawless. Every element of writing working at the highest level. Exceptional. Compelling. Extremely rare.

═══════════════════════════════
3. KEYWORDS (20 points)
═══════════════════════════════

Keywords score how well the resume speaks the language of the field. ATS systems search for specific tools, systems, methodologies, and field vocabulary — not traits. Soft skills like "communication" and "leadership" are not ATS keywords and should not drive this score.

At senior level, comprehensive and deep field vocabulary is expected. Evaluate whether they've captured:
- Specific tool, software, system, and methodology names
- Industry-relevant terminology appropriate to their field and seniority
- Role-appropriate professional vocabulary reflecting genuine depth of expertise

SCORING GUIDANCE:
20/20: Complete field vocabulary, every tool and methodology named specifically, zero ATS gaps. Exceptional. Rare.
16-19/20: Comprehensive coverage for this career stage. Specific tools, systems, and field vocabulary named throughout.
11-15/20: Decent coverage with some gaps. Core vocabulary present but some expected tools or methodologies missing.
7-10/20: Limited field vocabulary. Soft skills dominate or expected field terminology is missing.
5-6/20: Little to no relevant professional or technical vocabulary.

Floor is 5 for keywords.

═══════════════════════════════
CUMULATIVE TOTAL SCORE REFERENCE:
═══════════════════════════════

86+: Exceptional. Outstanding substance and communication working together at a high level. Rare.
80-85: Strong. Well-written, relevant experience documented specifically, genuinely competitive for target field.
72-79: Good. Solid substance communicated clearly. Above average for this stage.
65-71: Decent. Uneven — some strong areas, some weak. Typical uncoached starting point.
59-64: Below average. Real experience exists but isn't coming through clearly.
50-58: Weak. Vague language, generic skills, little specificity throughout.
Below 50: Poor. Very weak communication of limited or irrelevant experience.

═══════════════════════════════
FEEDBACK GUIDELINES
═══════════════════════════════

Strengths: Reference specific content. Explain why it communicates effectively for this career stage and track.
Weaknesses: Focus on vague language, hollow executive language, missing specificity, and missing organizational scope or results where expected for the role type and zone. Not on missing credentials beyond what's realistic for this person's track.
Suggestions: Show specifically how to communicate existing experience more effectively. Concrete rewrites are more useful than general advice.

Do NOT penalize for lacking publications, speaking engagements, advisory roles, or thought leadership unless the candidate is explicitly positioned at a national or industry-leadership level.
Do NOT penalize Track A candidates for lacking organizational leadership credentials.
Do NOT critique summary length or formatting preferences.

NO HALLUCINATION: Only evaluate what is explicitly stated. Do not assume, infer, or fabricate achievements.`

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
- Reference specific content from the resume
- Explain why it communicates effectively for this career stage and job type

WEAKNESSES (3-5 areas needing improvement):
- Focus on vague language, weak verbs, and missing specificity
- For Zone 1 roles: flag missing metrics where expected
- For Zone 2 and 3 roles: flag missing scope and scale indicators
- Do NOT penalize for missing career achievements or experience not yet accumulated
- Do NOT critique summary length or formatting

SUGGESTIONS (exactly 5 actionable recommendations — always provide exactly 5, no fewer):
- When a suggestion refers to a specific job or role, start with the company name referenced in the sentence. If it applies to the whole resume, no prefix needed.
- Each suggestion identifies a specific gap and tells the candidate exactly what information to add
- Format: state what is missing or vague, then instruct them to add the specific category of information that would fill it
- NEVER invent specific numbers, outcomes, or details — name the type of information, not the answer
- Example format: "Your vendor management bullet lacks scale. Add the number of vendors you manage and your approximate annual spend."
- Example format: "Your Asana bullet doesn't show impact. Add what measurably improved after the rollout — project visibility, response time, or follow-up volume."
- NEVER write example bullets with invented numbers or fabricated details
- NEVER suggest content not supported by what is already on the resume
- The goal is to show the candidate exactly what information they need to find — not to invent it for them

CRITICAL: Respond with ONLY valid JSON. No markdown, no code blocks, no preamble.

{
  "overallScore": <number 0-100>,
  "breakdown": {
    "impact": <number 0-50>,
    "clarity": <number 0-30>,
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