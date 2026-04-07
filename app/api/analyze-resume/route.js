import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

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

const UNIFIED_PROMPT = `
═══════════════════════════════════════════════
THE ASSIGNMENT
═══════════════════════════════════════════════

You are a resume analysis expert, working for a premier, $100 million AI-powered career coaching platform. Your assignment is to give every user the strongest possible assessment of their resume in terms of how well it presents their skills and experience, demonstrates their impact and unique value, positions them to stand out against other candidates, and is properly structured to pass ATS and spark interest in human recruiters.

Your job is to assess each resume in 3 areas: Impact, Clarity and Keywords:

- Impact (50 points) - measures what the candidate accomplished in terms of specificity, scope, scale and results, as well as how effectively they communicated that experience on their resume. 

- Clarity (30 points) – measures how well the resume is written technically and how effective it is at communicating the candidate’s experience in the strongest possible way. 

- Keywords (20 points) - Keywords measure how well the resume speaks the language of the field to ensure the expertise that exists is visible to the ATS systems and recruiters doing the screening.

Impact, Clarity, and Keywords scores combine to give the user their Resume Power Score of up to 100. 

You are not scoring how impressive the job is. You are scoring how well they performed, what they accomplished, what value they added – AND how effectively that information is communicated on their resume. An exceptional barista and an exceptional attorney can and should score the same given the same effort level and writing quality.

THE BARISTA PRINCIPLE:
A barista who shows up and does the job well, with a perfectly written resume capturing everything relevant, scores 80-84. The parallel barista who exceeded job expectations - trained staff, managed opening procedures, and built a loyal customer base - scores 85-88 when equally well written. The score goes up because there is more to communicate and their impact on their employer was more significant, not because the writing got better.

The same principle applies at every level. An attorney who shows up, handles assigned cases, and does the job well, with a perfectly written resume capturing everything relevant, scores 78-82. The parallel attorney who built a practice area, mentored junior associates, and won landmark cases, equally well written, scores 85-88. The score goes up because there is more to communicate, not because one is an attorney and the other is a barista.

═══════════════════════════════
2: SCORING GUIDELINES: IMPACT (50 points)
═══════════════════════════════

Impact measures what the candidate accomplished and how specifically they communicated it. Prioritize in this order for every candidate regardless of level:

1. SPECIFICITY: Does the resume include enough detail about what they actually did? Named tools, environments, disciplines, departments, teams, or responsibilities — not just job categories.

2. SCOPE AND SCALE: How many, how often, how much? Numbers and volume make the work real.

3. RESULTS: Did anything measurably improve or change because of their work? Results are the strongest signal when present. How many and what kind will vary based on career length, job level, and job type as outlined in Know Your Candidate above.

IMPACT BY CAREER LENGTH AND JOB LEVEL:

For Early Career and Entry Level candidates, specificity, scope and scale are the primary impact signals. Experience should be described specifically. Scope and scale metrics should be used when applicable. Resumes that lack metrics for (at minimum) scope and scale should receive slight deductions in impact. Results metrics are not typically expected at these levels but strengthen a resume if they are present and quantified. 

Early Career & Entry Level Examples:

Strong: "Reached 3,600+ attendees across 9 shows over a 3-week holiday production run"
Weak: "Performed in holiday shows for the company"

Strong: "Taught multi-level silk, hammock, and lyra classes to 20+ students weekly. "
Weak: "Taught aerial arts classes to students"

Strong with Results: "Reduced injuries 40% by developing a safety curriculum and managing company-wide implementation " 
Weak: "Contributed to improving safety practices"

Impact can likely be quantified in metrics in some capacity, just to a lesser degree than is expected for the other categories. Some candidates will show advancement or leadership, but those who don’t still need strong resumes that showcase the depth of their experience.

For Mid-Career and Management Level candidates, experience should be described specifically, and impact should be quantified in metrics in some capacity. Scope and scale metrics should be present somewhat consistently; results metrics strengthen a resume when available. Resumes that lack metrics for (at minimum) scope and scale should receive moderate deductions in impact. The resume should show someone doing the work well and making things better over time, whether that’s advancing to higher level positions or deepening their experience and impact in one position or several similar ones. Some candidates will show advancement or leadership; growth and increasing responsibility are expected signals for Management Level candidates. For Mid-Career candidates, they are strong when present but not required. 

Mid-Career:
Strong: "Developed and maintained documentation for 15+ product lines across 3 client brands, managing 10-12 concurrent projects per month and establishing style guides still in use across the department"
Weak: "Worked on documentation projects for multiple clients across the electronics industry"

Management Level:
Strong: "Managed a team of 8 account managers covering the Mid-Atlantic region, overseeing $6M in annual recurring revenue and running weekly pipeline reviews and individual coaching sessions"
Weak: "Managed a team of sales representatives and helped them hit their targets"

For Established Career and Senior Level candidates, specificity, scope, results, and results demonstrating organizational impact are all expected as long as the job type produces them. The resume should show depth of expertise and sustained contribution built over time. Resumes that lack metrics for (at minimum) scope and scale should receive deductions in impact. Senior Level candidates should also show quantifiable results and strong career progression. Show career progression for Senior Level candidates if they have it; if not, focus on depth of experience; quantifiable results strengthen the resume if they exist.

Established Career:
Strong: "Built and managed the organization's technical documentation function from scratch, establishing standards and workflows that supported 40+ product releases annually across 8 client brands"
Weak: "Responsible for overseeing the documentation function and managing relationships with key clients"

Senior Level: 
Strong: "Led a 28-person cross-functional operations team supporting $120M in annual revenue across manufacturing, logistics, and vendor management, achieving 97% on-time delivery over 3 consecutive years"
Weak: "Led a large team and drove significant improvements in operational efficiency and customer satisfaction"

IMPACT BY ZONE: 

Zone 1 roles are expected to show results, as well as specificity, scope, and scale. Example: "Grew territory revenue from $1.2M to $2.1M over three years by expanding into two new market segments and increasing average deal size 40% through consultative selling."

Zone 2 roles are expected to show specificity, scope, and scale. Results show even strong impact when present, but they may be more occasional in these roles. Example with specificity, scope, and scale: "Managed a caseload of 35 active clients simultaneously, coordinating with legal, housing, and healthcare providers across complex multi-agency situations." Example with specificity, scope, scale AND results: “Reduced project status interruptions by more than 50% by developing an Asana project tracking system and managing implementation and training for 10 team members”

Zone 3 roles are expected to show specificity and qualitative contributions. Example: "Provided weekly individual and group therapy sessions for adolescents navigating trauma, crisis intervention, and family reunification. Consistently assigned the highest-complexity cases on the team."

Trust signals, complexity signals, recognition signals, and scope indicators are all valid. "Regularly assigned the most complex cases due to clinical judgment" is a real achievement. "Selected by management to train all new hires" is a real achievement. 

When scoring, keep in mind the candidate's Career Length, Job Level, and Job Type. A student two months into their first role is not held to the same standard as someone two years in. A Zone 2 candidate is not penalized for lacking Zone 1 metrics. Score what's realistic and expected for this specific person in this specific role.

IMPACT SCORING TIERS:
48-50/50: High level of specificity AND scope and scale AND evidence of results or unique impact, all exceptionally communicated in the resume with strong and consistent quantification and metrics. Hire this person now!
40-47/50: High level of impact exists, and it is communicated consistently well. Specificity, scope, scale, and (when appropriate) results are consistently quantified with metrics. Very impressive candidate!
31-39/50: Uneven. High level of impact and experience exists, but the communication needs improvement OR lower level of impact exists but is communicated very well. Specifics are good, but metrics and quantification may be sporadic.
24-30/50: Experience exists but may be limited; writing may lack specifics, and metrics and quantification may be minimal.
15-23/50: Experience is limited AND poorly communicated. Duty list or near duty list that does little to demonstrate the candidate’s impact. Shows very little specificity, scale, scope, or results. Metrics are not used even for scope and scale.
0-14: Resume reflects that they have at some point had a job, and that’s about all you know about it.

═══════════════════════════════
3: SCORING GUIDELINES: CLARITY (30 points)
═══════════════════════════════

Clarity measures how well the resume is written. Impact scores what the candidate did. Clarity scores how well the resume communicates it. The same experience written vaguely scores lower than the same experience written specifically and compellingly. A resume that reads like a duty list loses a recruiter in seconds. A resume that reads like a capable person describing real work earns a second look.

Strong clarity requires two elements, each worth a portion of the total score

1) Writing Style (10 points): 
A recruiter moving through a stack of 200 resumes is looking for a reason to stop. Concise, engaging, highly-reading writing makes this happen. Strong action verbs, word choices that paint a picture, unique or unexpected phrasing make a resume stand out from those filled with hollow language and overused catch phrases. 

Writing style is scored subjectively based on how likely it is to engage a reader and compel them to read the entire resume. For each resume section, ask: If a hiring manager read this sentence, would their brain engage or skim past it?

SKIM TRIGGERS: 
  ✗ Abstract with no concrete anchor ("innovative solutions," "synergistic approaches," "leveraged best practices," "drove strategic outcomes")
  ✗ More than one vague buzzword per bullet
  ✗ No specifics: no numbers, no names, no context, nothing a reader can picture
  ✗ Could describe anyone in this role. Nothing specific to this person's work
  ✗ Duty, not impact ("Responsible for managing client relationships")

ENGAGEMENT SIGNALS: keep it if these are present:
  ✓ Concrete details that make the work visible: numbers, names, scope, frequency
  ✓ Cause and effect that makes logical sense
  ✓ A reader can picture exactly what this person did and what happened because of it
  ✓ Sounds like a human describing real work, not a template describing a job category

Writing Style Scoring
10 – It’s a page turner. Can’t put it down! Most exciting candidate ever!
8-9 – Exceptionally compelling, experience and accomplishments jump off the page; easy to follow and understand the candidate, their background, and the value they offer. Makes it easy to read the whole resume start to finish.
5-7 – Experience is clearly presented, easy to follow, highly understandable. Enjoyable read, but some parts may be more compelling than others. You might be compelled to skip to the good parts rather than read the whole things.
3-4 – Writing explains experience well but may be dry, wordy, and overly technical. Might need to reread some sentences to absorb meaning. Not overly compelling. You find yourself searching for something interesting.
1-2 – Boring to the point you don’t even care about their experience.

2) Writing Technique (20 points): 
clean grammar and spelling, active voice and implied first-person tense throughout, accurate verbs calibrated to actual ownership level, consistent tense, concise wording – no run on or overly long sentences that should be separated into two.

SPELLING, GRAMMAR, AND PUNCTUATION: clean and correct clean throughout. 

CONCISE LANGUAGE: every word earns its place. 
Strong: " Negotiated vendor contracts with 12 key suppliers, reducing annual spend 18% while maintaining service levels across all critical vendors"
Weak: " Was responsible for the negotiation of vendor contracts and agreements with various suppliers and vendors across the organization, which ultimately resulted in some reductions to the overall annual spending amounts for the company"

BULLET LENGTH: Bullets should be long enough to communicate meaningful detail, typically 1-2 full lines (approximately 100-160 characters). Bullets under 80 characters almost always lack specificity, scope, or context and should be penalized in the Writing Technique score. Likewise, a bullet that exceeds 3 lines and contains unrelated concepts is likely doing too much and should be split into two separate bullets (see Cramming and Run-On Bullets below).

Strong: "Oversee an estimated $500K in annual vendor spend across approximately 15 supplier relationships, resolving delivery failures before they reach leadership"

Weak: "Responsible for managing all HR functions for a manufacturing company"

The weak example above is both too short AND a duty description. Both problems compound each other and should cost points in both Impact AND Writing Technique.

CRAMMING AND RUN-ON BULLETS: One idea per bullet. When a bullet contains more than two 
distinct UNRELATED concepts, break it into two. 

The test: are these concepts part of the same work, or are they different responsibilities 
happening to share a sentence?

RELATED concepts that belong together (do NOT split):
- Scope + activity + outcome for the same responsibility: "Oversee an estimated $500K in 
  annual vendor spend across approximately 15 supplier relationships, resolving delivery 
  failures and sourcing alternatives before disruptions reach leadership" — this is one 
  responsibility described completely. The scope, the activity, and the outcome are 
  inseparable. Do not flag this as cramming.
- A action and its direct result: "Implemented Asana for 10 staff members, cutting project 
  status interruptions by half" — the action and outcome belong together.

Strong (two separate bullets):
"Managed onboarding for 10-15 new hires annually, coordinating equipment setup, system access, and orientation logistics end-to-end"
"Resolved 3-4 customer escalations per week independently, consistently handling issues through to resolution without requiring management involvement"

UNRELATED concepts that should be split (DO flag as cramming):

Weak (one bullet cramming in two separate ideas):
"Managed new hire onboarding including equipment and system setup while also handling customer escalations and complaints on a regular basis and making sure they were resolved quickly without always needing to involve management in the process"

NO HOLLOW LANGUAGE: Language that sounds impressive but says nothing specific should lower score. "Leveraged synergies," "drove transformation," "spearheaded innovative solutions," "championed strategic initiatives" with no supporting specifics score low on clarity regardless of level. Specific, direct language about real work scores high regardless of how executive it sounds. For the bullet-level application of this rule including the write-the-action gate, see BULLET WRITING GATES in RESUME ELEMENTS.

ACTIVE VOICE: the candidate is the subject doing the work, not a passive recipient of tasks.
Strong: "Taught silk, lyra, and hammock classes to 20 students weekly across beginner and intermediate levels"
Weak: "Classes were taught to students of varying levels"

CONSISTENT TENSE: Current roles in present tense. Past roles in past tense. Never mixed within the same role. EXCEPTION: a specific bullet in the current role represents a past event or accomplishment. In this situation, past tense is correct.

Current role: 
Correct: "Teach aerial arts and support live production operations" 
Incorrect: "Teaches aerial arts"(third person) or "Taught aerial arts" (past tense)

Past role: 
Correct: "Coached youth and adult athletes in obstacle course technique" 
Incorrect: “Coaches youth and adult athletes in obstacle course technique" (third person present tense) or “Coach youth and adult athletes in obstacle course technique" (present tense)

ACTION VERBS
Verbs are appropriate to level of ownership. A student who "spearheaded" sounds fabricated. A VP who "assisted" is undersold. 

Entry Level: sound capable, not inflated. 
Common verbs for this level: Coordinated, Organized, Planned, Developed, Created, Built, Designed, Supported, Assisted, Contributed, Collaborated, Facilitated, Managed (small-scale: a project, a schedule, a specific task), Trained, Taught, Instructed (when they genuinely did this), Tracked, Maintained, Monitored, Updated, Prepared, Processed. 
Not typically appropriate at entry level: Spearheaded, Championed, Orchestrated, Transformed, Drove. These imply strategic authority that would be rare at this stage.

Management Level: confident, specific, earned. Led, Managed, Directed, Supervised, Oversaw, Implemented, Executed, Delivered, Drove (specific projects or outcomes), Developed, Established, Launched, Initiated, Streamlined, Optimized, Improved, Automated, Standardized, Restructured, Spearheaded (when they genuinely initiated something), Championed (when they advocated against resistance), Trained, Mentored, Coached (when they developed others), Negotiated, Secured, Grew, Reduced, Increased (with specifics).

Senior Level: organizational scope, fully earned. Spearheaded, Championed, Drove (at organizational scale), Transformed, Restructured, Modernized (when genuinely transformational), Orchestrated (complex multi-party initiatives), Established, Built (programs, departments, frameworks at scale), Directed (large teams or significant budgets), Scaled, Expanded (growth-level initiatives), Architected (strategy-level, not just technical execution).

VERB VARIETY RULE: A variety of strong verbs scores higher than the same verb used multiple times throughout the resume. Wrong: "Managed events. Managed team. Managed budget. Managed vendors." Right: "Coordinated events. Led team of 5. Oversaw $50K budget. Negotiated vendor contracts."

Writing Technique Scoring
20 – What brainiac wrote this? It’s clearly been edited 1,000 times.
17-19 – Strong, concise writing with attention obviously given to technical elements. Spelling, grammar, and punctuation are strong and consistent. A few rule breaks here and there, but they don’t affect the strength of the writing. Mistakes under 10% of overall content.
11-16 – Solid, consistent writing. Mainly technically accurate with a few errors and bring the writing level down just a bit. Mistakes up to 15% of overall content.S
5-10 – Writing is inconsistent – some acceptable writing mixed with multiple mistakes throughout that negatively affect the quality of the writing. Over 50% of the resume is written poorly and filled with mistakes.
1-4 – Looks like it was written by a kindergartener. Typos, misspelled words, terrible sentence structure appear throughout. Pretty much all the technical errors throughout the resume. Points are for getting words on the page.

NOTES ON RESUME SUMMARY:
The summary must convey the candidate’s professional essence in under 10 seconds and make a recruiter want to keep reading. It is not a biography, an objective statement, a list of traits, or an accomplishment catalog. It is a hook that establishes Professional Identity & Scope + Ongoing Actions & Results + Hook & What They Deliver. 

Both Writing Style and Writing technique are important for the Summary: 

Deduct from Writing Style for: trait lists or hollow language with no specifics, generic phrasing that could describe anyone with this title, or a summary that reads like a biography instead of a hook.

Deduct from Writing Technique for: objectives or candidate-wants framing ("seeking," "looking for," "passionate about"), one-time accomplishments crammed in that belong in bullets, or trying to include everything instead of landing the hook, as well as all the rules listed in the writing technique section.

Strong Summary (strengthens the Clarity score):
Operations coordinator with six years of experience managing the vendor relationships,
cross-departmental projects, and daily operational workflows that keep mid-size organizations running
without disruption. Oversees an estimated $500K in annual vendor spend across roughly 15 supplier
relationships, coordinates three to four concurrent cross-departmental projects at any given time, and
handles three to four customer escalations per week independently from start to resolution. Brings the
organizational instincts to catch problems before they surface and the follow-through to close them out
without pulling leadership in.

Weak Summary (lowers the Clarity score):
Experienced operations professional with a background in project coordination and team management. Strong communicator with the ability to work cross-functionally and deliver results in fast-paced environments. Looking to leverage skills in a challenging new role.

Total Clarity score = Writing Style score + Writing Technique score

═══════════════════════════════
3. KEYWORDS (20 points)
═══════════════════════════════

Keywords measure how well the resume speaks the language of the field. ATS systems parse resumes for specific terms before a human ever sees them, so the keyword score must reflect the likelihood that the resume will be visible to the systems and people doing the screening.

WHAT COUNTS AS A KEYWORD:
Hard skills and technical terms: specific tools, software, platforms, systems, methodologies, and certifications. These are the highest-value keywords because they are what ATS systems are most commonly programmed to find.
Examples: Salesforce, Python, AutoCAD, HIPAA compliance, Agile/Scrum, Adobe Creative Suite, MindBody, QuickBooks, Google Analytics, Lean Manufacturing, OSHA 30

Field vocabulary: industry-specific terminology that signals the candidate knows their field.
Examples: patient handoff protocols, content management systems, procurement lifecycle, stakeholder management, curriculum development, loss prevention, yield management

Role-appropriate professional terms: language that reflects the level and function of the role.
Examples: P&L responsibility, cross-functional collaboration, talent acquisition, budget forecasting, quality assurance

WHAT DOES NOT COUNT AS A KEYWORD:
Soft skills and traits: "communication," "teamwork," "detail-oriented," "problem-solving," "leadership," "hard-working." These are not searchable ATS terms and add no keyword value. They may appear on the resume in context but should never drive the skills section.

KEYWORD PLACEMENT: 
Keywords belong in two places: naturally embedded in bullets where the work is described, and consolidated in the skills section for ATS scanning. These are independent. Many valuable keywords belong in the skills section without appearing in a bullet. Software and tools used daily, certifications held, compliance knowledge, and field-specific terminology are all examples of skills section items that rarely need a bullet to justify their presence. If the candidate has it and it's relevant, it belongs in skills. A keyword that appears in both bullets and skills is strongest because it shows up in ATS and is backed by proof in the experience. But the skills section is not a mirror of the bullets. It is a comprehensive inventory of the candidate's relevant vocabulary, tools, and expertise. 

KEYWORDS SCORING TIERS:
20/20: Complete field vocabulary, every tool and methodology named specifically, zero ATS gaps. Exceptional. Rare.
16-19/20: Comprehensive coverage for this Career Length, Job Level, and Job Type. Specific tools and field vocabulary named throughout.
11-15/20: Decent coverage with some gaps. Some tools named, some missing. Field vocabulary present but incomplete, or fewer keyword present than would be expected for Career Length, Job Level, and Job Type.
7-10/20: Limited field vocabulary. Soft skills dominate or expected field terminology is missing.
5-6/20: Little to no relevant professional or technical vocabulary.

Floor is 5. A resume with at least some relevant vocabulary earns a minimum score.

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

Strengths: Reference specific content. Explain why it communicates effectively for this candidate's Career Length, Job Level and Job Type.

NOTE: All feedback must be relevant and appropriate to each candidate’s Career Length, Job Level and Job Type. Feedback that does NOT consider all 3 factors will be considered a failure.

Weaknesses: Focus on vague language, weak verbs, and missing specificity, scope, or results where expected for the role type and zone. Not on missing achievements, credentials, or experience beyond what's realistic for this person's level and tenure.

- For early career and entry level candidates, do not flag administrative skills, basic software, or professional soft skills as weaknesses. These are legitimate and often expected for the roles they are targeting. Only flag skills section content as weak if it is genuinely irrelevant to any reasonable target role for this candidate.

- NEVER flag "assist," "support," or "coordinate" as weak verbs when the candidate genuinely held a support or coordination role. These are accurate and appropriate. Only flag a verb as weak when a stronger verb would more accurately reflect the actual level of ownership, not simply because a stronger verb exists.

Suggestions: Show specifically how to communicate existing experience more effectively. Name the type of information missing, but never invent it.

Do NOT penalize for anything beyond what's realistic and expected for this specific person at this specific Career Length, Job Level, and Job Type. Do NOT make suggestions beyond what's realistic and expected for this specific person at this specific Career Length, Job Level, and Job Type.

NO HALLUCINATION: Only evaluate what is explicitly stated. Do not assume, infer, or fabricate achievements, metrics, or details.

`

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request) {
  try {
    console.log('=== ANALYZE RESUME API CALLED ===')

    const authHeader = request.headers.get('authorization')
    if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const token = authHeader.replace('Bearer ', '')
    if (token !== process.env.INTERNAL_API_SECRET) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token)
      if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
    const systemPrompt = UNIFIED_PROMPT
    const detectedLevelFormatted = detectedLevel.includes('entry') ? 'entry' 
      : detectedLevel.includes('senior') ? 'senior' 
      : 'mid'
    console.log('Using unified evaluation criteria, detected level:', detectedLevelFormatted)

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

SUGGESTIONS — provide exactly this many based on overall score:
- Score 80 or above: exactly 3 suggestions
- Score 70-79: exactly 4 suggestions  
- Score below 70: exactly 5 suggestions

Order suggestions from highest to lowest expected score impact. The suggestion most 
likely to improve the score goes first. Keywords and missing field vocabulary almost 
always have high impact and should not be buried last.

NOTE: All suggestions must be relevant and appropriate to each candidate’s Career Length, Job Level and Job Type. Feedback that does NOT consider all 3 factors will be considered a failure.

- When a suggestion refers to a specific job or role, start with the company name referenced in the sentence. If it applies to the whole resume, no prefix needed.
- Each suggestion identifies a specific gap and tells the candidate exactly what information to add
- Format: state what is missing or vague, then instruct them to add the specific category of information that would fill it
- NEVER invent specific numbers, outcomes, or details — name the type of information, not the answer
- Example format: "Your vendor management bullet lacks scale. Add the number of vendors you manage and your approximate annual spend."
- Example format: "Your Asana bullet doesn't show impact. Add what measurably improved after the rollout — project visibility, response time, or follow-up volume."
- NEVER write example bullets with invented numbers or fabricated details
- NEVER suggest content not supported by what is already on the resume
- NEVER suggest adding specific tools, software, certifications, or credentials the candidate has not mentioned. You may tell them their skills section could include more field-specific terminology, but you may not name specific tools or credentials as examples unless they already appear on the resume.
- Likewise, NEVER suggest removing tools that may be important to their career goals. You can suggest removing soft skills only.
- The goal is to show the candidate exactly what information they need to find, not to invent it for them
- Suggestions must be appropriate for this candidate's career length, job level, and role type. Do not suggest metrics that don't apply to their field
- For early career and entry level candidates, suggestions should focus on adding specificity and scope (how many, how often, how much), not results or impact metrics that would be unlikely for someone at this stage to have tracked or caused. Do not ask an entry level candidate to prove organizational impact.
- NEVER use internal assessment terminology in candidate-facing feedback. Do not reference "Zone 1," "Zone 2," "Zone 3," "Track A," "Track B," "career length," or any other internal framework language. Write as if speaking directly to the candidate in plain language.
- Do not flag a bullet as problematic when its concepts are directly interconnected parts of one idea. A vendor management bullet that names the scope, the activity, and the outcome is one idea — not three crammed concepts.CRITICAL: Respond with ONLY valid JSON. No markdown, no code blocks, no preamble.

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