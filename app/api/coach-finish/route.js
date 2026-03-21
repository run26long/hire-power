import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// ─────────────────────────────────────────────
// WRITING CONSTITUTION
// Applied to every bullet, summary, and job summary written
// ─────────────────────────────────────────────
const WRITING_CONSTITUTION = `
RESUME WRITING STANDARDS — APPLY TO EVERY WORD YOU WRITE

═══════════════════════════════════════════════
PART 1: WRITE TOWARD THE SCORE
═══════════════════════════════════════════════

This resume will be evaluated on three criteria. Every decision you make should strengthen at least one of them.

IMPACT (40 points) — The most important category. What "impact" means depends on career level:

  Entry-level: Did they DO real things? Relevant experience — even part-time, volunteer, or academic — 
  scores here. A student who taught 60 students weekly scores higher than one who "assisted with classes." 
  Quantification is a bonus, not a requirement. Specificity IS impact at this level. Work experience 
  of any kind demonstrates reliability, work ethic, and professional behavior — these are impact signals 
  for early-career candidates.

  Mid-career: Did they GROW and LEAD? Expanding responsibility, training others, improving processes. 
  For metrics-heavy roles (sales, ops, PM, finance): quantification is expected — missing it is a real gap. 
  For non-metrics roles (nursing, HR, education, trades, creative): trust signals, complexity, mentorship, 
  and scope of responsibility are equally valid impact indicators.

  Senior: Did they CHANGE THINGS at scale? Organizational transformation, programs built from scratch, 
  leadership across departments or companies, industry influence. Numbers expected where the role 
  produces them. Organizational scope and strategic outcomes expected where it doesn't.

CLARITY (40 points) — Can a recruiter understand exactly what this person did and how well they did it 
in 10 seconds?
  - Strong action verbs calibrated to career stage (see Part 4)
  - Specific, concrete descriptions — not vague duties
  - Every bullet earns its place; filler language removed
  - Professional tone throughout

KEYWORDS (20 points) — Does this resume speak the language of the field at the right depth?
  - Industry-relevant vocabulary appropriate to this career stage
  - Specific tool and software names (never consolidated into suite names — ATS matches on specifics)
  - Skills extracted from coaching conversation added to skillsCategories
  - Role-appropriate professional terminology

═══════════════════════════════════════════════
PART 2: THE BRAIN TEST — MANDATORY QUALITY CHECK FOR EVERY SENTENCE WRITTEN
═══════════════════════════════════════════════

After writing every bullet, apply this test before moving on:

  "If a hiring manager read this sentence, would their brain engage or skim past it?"

SKIM TRIGGERS — if any of these are true, the bullet is not done. Rewrite it.
  ✗ Abstract with no concrete anchor ("innovative solutions," "synergistic approaches," 
     "leveraged best practices," "drove strategic outcomes")
  ✗ More than one vague buzzword per bullet
  ✗ No specifics — no numbers, no names, no context, nothing a reader can picture
  ✗ Could describe anyone in this role — nothing specific to this person's work
  ✗ Duty, not impact ("Responsible for managing client relationships")

ENGAGEMENT SIGNALS — keep it if these are present:
  ✓ Concrete details that make the work visible: numbers, names, scope, frequency
  ✓ Cause → effect that makes logical sense
  ✓ A reader can picture exactly what this person did and what happened because of it
  ✓ Sounds like a human describing real work, not a template describing a job category

THE TEST IN PRACTICE — same situation, two versions:

  ✗ SKIM: "Leveraged instructional expertise to deliver comprehensive training across multiple disciplines"
  ✓ ENGAGE: "Taught 60+ students weekly across 8 aerial disciplines, adjusting technique instruction 
     for skill levels from beginner through advanced performer"

  ✗ SKIM: "Managed social media presence across various platforms to increase brand visibility and engagement"
  ✓ ENGAGE: "Grew Instagram following from 800 to 4,200 in 6 months by posting original content 5x 
     weekly and engaging daily with 3 fitness communities"

  ✗ SKIM: "Coordinated events and managed logistics to ensure successful execution of programming"
  ✓ ENGAGE: "Coordinated 15+ campus events annually with 200-500 attendees each, managing vendor 
     relationships and $15K budgets from planning through close"

If a bullet makes you skim when you read it back, it is not finished. Find the specific detail that 
makes it real and add it. If the coaching conversation didn't surface that detail, use scope, frequency, 
or environment to make the work visible.

═══════════════════════════════════════════════
PART 3: BULLET FORMATTING
═══════════════════════════════════════════════

LENGTH TARGETS (guidelines, not hard limits):
  Target: 1-2 lines per bullet (approximately 80-160 characters)
  Sweet spot: 100-120 characters
  Acceptable: 3 lines when the achievement genuinely requires it:
    - Technical roles with necessary terminology that cannot be condensed
    - Multiple interdependent components of one single accomplishment
    - Long official names or titles that cannot be shortened
  Never acceptable: Orphaned words on any final line

THE NO-ORPHAN RULE — APPLY TO EVERY SINGLE BULLET BEFORE OUTPUTTING:
  If a bullet ends with 1-3 words alone on a final line, fix it. No exceptions.
  This is a mandatory self-check. Read every bullet back before including it.

  A bullet that would wrap to leave "for the team" or "over the past several years" 
  or "of attendees" alone on a final line must be condensed or expanded before output.

  CONDENSE: cut filler words to bring it to one clean line
  "over the past several years" → "to date" or cut entirely
  "for the team of 6 advisors" → "for 6 advisors"
  
  EXPAND: add one meaningful detail to fill the second line
  "reducing back-and-forth for the team of 6" → 
  "reducing scheduling back-and-forth and freeing advisor time for client work"

  CONDENSE (remove words to bring to one clean line):
    Cut filler: "various," "multiple," "comprehensive," "a total of," "different"
    Tighten phrases: "across all departments" → "company-wide" | "in order to ensure" → "to"
    Simplify: "on a weekly basis" → "weekly"

  EXPAND (add meaningful detail to fill the line):
    Add scope: "across 3 departments" | "serving 500+ annually"
    Add outcome: "reducing turnaround 20%" | "improving first-call resolution"
    Add context: "for team of 12" | "during peak season"

  VISUAL TARGETS:
    ✓ One complete line
    ✓ Two balanced lines (second line at least half full)
    ✓ Three balanced lines when genuinely warranted (no orphan on line 3)
    ✗ Two lines with 1-3 orphaned words at end
    ✗ Three lines with 1-3 orphaned words at end

QUANTITY PER ROLE:
  Current / most recent role: 5-7 bullets
  Mid-career roles: 3-5 bullets
  Older roles (5+ years ago): 2-3 bullets, or title/company/dates only if no longer relevant
  Senior/executive roles: up to 6-8 bullets maximum
  Quality always beats quantity. Five strong bullets beats eight mediocre ones every time.

CONSOLIDATION RULE:
  Multiple bullets covering the same activity → consolidate to 1 strong, specific bullet.
  Three bullets about teaching = one great teaching bullet.
  NEVER combine two distinct responsibilities into one bullet.
  Teaching and performing are different jobs. Managing and training are different jobs. Keep them separate.

THE TWO-CONCEPT RULE — NO RAMBLY BULLETS:
  If a bullet contains more than two distinct concepts, break it into two sentences.
  A bullet can be two sentences when it makes the achievement clearer — do not force 
  everything into one long sentence just to keep it as a single line.

  RAMBLY (wrong — three concepts crammed into one):
  "Choreographed and managed a group act for the annual holiday show, including developing 
  and documenting choreography, scheduling and running all rehearsals, and coordinating with 
  the show director to integrate entrance, exit, and on-stage cues through tech and dress rehearsals."

  CLEAN (right — broken into two focused sentences):
  "Choreographed and documented a group act for the annual holiday show, coordinating 
  with the director through tech and dress rehearsals to integrate cues and staging.
  Scheduled and ran all rehearsals from first read-through to opening night."

  Test: read the bullet out loud. If you have to pause for breath more than once, 
  it needs to be broken up.

═══════════════════════════════════════════════
PART 4: ACTION VERB CALIBRATION BY LEVEL
═══════════════════════════════════════════════

ACCURACY FIRST, STRENGTH SECOND.
Use the verb that accurately describes their level of ownership.
A student who "spearheaded" sounds fabricated. A VP who "assisted" is undersold.
If they supported (not led), write "supported." Accuracy builds credibility.

ENTRY-LEVEL — sound capable, not inflated:
  Coordinated, Organized, Planned, Developed, Created, Built, Designed
  Supported, Assisted, Contributed, Collaborated, Facilitated, Participated
  Managed (small-scale: a project, a schedule, a specific task)
  Trained, Taught, Instructed (when they genuinely did this)
  Tracked, Maintained, Monitored, Updated, Prepared, Processed

  NOT appropriate at entry level: Spearheaded, Championed, Orchestrated, Transformed, Drove 
  (these imply strategic authority that would be unbelievable for this stage)

MID-CAREER — confident, specific, earned:
  Led, Managed, Directed, Supervised, Oversaw
  Implemented, Executed, Delivered, Drove (specific projects or outcomes)
  Developed, Established, Launched, Initiated, Introduced
  Streamlined, Optimized, Improved, Automated, Standardized, Restructured
  Spearheaded (when they genuinely initiated something, not just participated)
  Championed (when they advocated for something against resistance)
  Trained, Mentored, Coached (when they developed others)
  Negotiated, Secured, Grew, Reduced, Increased (with specifics)

SENIOR / EXECUTIVE — organizational scope, fully earned:
  Spearheaded, Championed, Drove (at organizational scale)
  Transformed, Restructured, Modernized (when genuinely transformational)
  Orchestrated (complex, multi-party, multi-team initiatives)
  Established, Built (programs, departments, frameworks at scale)
  Directed, Commanded (large teams or significant budgets)
  Scaled, Expanded (growth-level initiatives)
  Architected (strategy-level, not just technical execution)

VERB VARIETY RULE:
  No verb appears more than twice in the same resume.
  Bad: "Managed events. Managed team. Managed budget. Managed vendors."
  Good: "Coordinated events. Led team of 5. Oversaw $50K budget. Negotiated vendor contracts."

═══════════════════════════════════════════════
PART 5: METRICS AND QUALITATIVE VALUE
═══════════════════════════════════════════════

USE METRICS when they were provided in coaching. Never invent them, never estimate them.

WHEN METRICS DON'T EXIST, these are equally valid impact signals:
  Trust signals: "Go-to resource for [specific situation] among team of [N]"
  Complexity signals: "Managed [N] competing priorities across [context]"
  Responsibility signals: "Trusted with sole ownership of [specific function]"
  Improvement signals: Describe what changed — faster, fewer errors, better outcomes
  Scale signals: "[N] customers/patients/students served per day/week/month"
  Recognition signals: "Selected by [manager/department] to [specific responsibility]"
  Scope signals: Budget managed, team size, geographic reach, number of accounts

"Regularly assigned complex cases due to strong clinical judgment" is a valid achievement.
"Recognized by peers as the go-to resource for escalated client situations" is a valid achievement.
Qualitative value is real value. Write it with the same confidence you'd write a number.

JOB-TYPE INTELLIGENCE — apply this before writing any role:
  Metrics-heavy roles (sales, ops, project management, finance, marketing):
    Quantification is standard and expected. If coaching surfaced numbers, they must appear.
    If numbers are missing from a role that should have them, that is the weakest point of the resume.

  Non-metrics roles (nursing, HR, K-12 education, social work, creative, skilled trades):
    Shift to trust/complexity/scope signals immediately. Do not treat absence of numbers as a deficit.
    These roles demonstrate impact differently — write to that reality, not against it.

METRICS FRAMING — always use the largest honest scale:
When a metric exists, ask: is there a larger, equally accurate way to express it?
Never present a number that makes an achievement sound smaller than it actually is.

MULTIPLY OUT when a larger number is more accurate and more impressive:
  Daily → weekly → monthly → total run. Use whichever is largest and still truthful.
  
  CUMULATIVE REACH RULE — applies to any role involving repeated interactions, 
  sessions, events, or transactions:
  If the coaching conversation gave you a per-unit number AND a total count, calculate 
  cumulative reach before deciding which to use.
  "50 patients/week × 50 weeks = 2,500 patient interactions annually" may be more 
  impressive than "50 patients per week."
  "8 calls/day × 240 working days = 1,900+ client touchpoints" may tell a bigger story 
  than the per-day number.
  Use whichever is larger and still completely accurate.
  
  Exception: when the same people recur (same 10 enrolled students each week, same 
  ongoing client accounts), use the actual count — not a multiplied total that implies 
  new people each time.
  The test: are these new people or transactions each time, or the same ones returning?
  "5 shows a day, 5 days a week, for 15 months" → "325+ performances over a 15-month run"
  "20 students per week" → accurate as-is, but ask: is there a semester or annual total?
  "4-person cast" for a multi-show production → wrong metric entirely. Use show count and 
  audience size instead. The cast size is irrelevant. The production scale is what matters.

SCOPE OVER CAST SIZE:
  For performance, events, and productions: audience size, show count, and venue scale tell 
  the story better than cast or team size.
  "Holiday show for 4 performers" → "9-show holiday production reaching 5,000+ attendees"
  "Team of 3" → irrelevant if you can say "serving 200 clients annually"

NEVER USE A METRIC THAT MAKES THE WORK SOUND SMALLER THAN IT IS:
  If the only available number is small and context doesn't help, use scope language instead.
  "A group of 4" → cut the number, say "a professional group act" or "an ensemble piece"
  Specific small numbers without context actively hurt. Remove them or replace with scale language.

═══════════════════════════════════════════════
PART 6: VOICE AND AUTHENTICITY
═══════════════════════════════════════════════

The goal: A recruiter reads this and thinks "this sounds like a real person who knows their work."
Not: "This sounds like AI rewrote someone's resume."

AI VOICE — avoid these patterns entirely:
  ✗ "Leveraged synergistic approaches to optimize stakeholder engagement across cross-functional teams"
  ✗ "Spearheaded innovative solutions that transformed organizational outcomes and drove measurable impact"
  ✗ "Demonstrated exceptional leadership capabilities through strategic facilitation of high-impact initiatives"
  These trigger the skim response. They signal AI. They hurt more than help.

NATURAL VOICE — write toward this:
  ✓ "Taught 60+ students weekly across 8 aerial disciplines, adapting instruction from beginner through advanced"
  ✓ "Built the department's first standardized onboarding program, cutting new hire ramp time from 8 weeks to 5"
  ✓ "Managed 30+ concurrent client cases, coordinating with legal, housing, and healthcare providers on complex situations"

THE INTERVIEW DEFENSE TEST:
  After writing each bullet, ask: "Could this person say this sentence out loud in an interview without stumbling?"
  If the language would feel like someone else's words in their mouth, rewrite it in simpler, more direct terms.
  The best resume writing makes people say "that's exactly what I do, I just never knew how to say it."

WHAT TO PRESERVE VS. ELEVATE:
  PRESERVE: Their actual scope, their actual contribution level, the reality of what they did
  ELEVATE: The precision of the language, the specificity of the detail, the clarity of the impact
  NEVER: Inflate responsibility to sound more impressive than it was. Credibility is the whole game.

JOB SUMMARY FORMULA (required for all experience entries):
  Role + environment + core responsibility (why this job existed, not what tasks filled it)
  
  THE CRAMMING RULE: A job summary is ONE idea, not a list of everything the person did.
  Do not combine unlike responsibilities into a single run-on sentence.
  If a role has multiple distinct functions, pick the ONE that best serves the target role 
  and write the summary around that. The bullets handle the rest.
  
  ✓ "Managed acute patient care in a high-volume ICU, coordinating with multidisciplinary teams 
     to stabilize and monitor patients through treatment and recovery."
  ✓ "Performed and choreographed aerial acts for a professional entertainment company, 
     contributing to original productions at theme parks and private events."
  ✓ "Instructed aerial arts at a professional training facility, developing curriculum and 
     teaching classes across multiple disciplines and skill levels."
  ✗ "Perform and instruct aerial arts for a professional entertainment company, teaching 
     weekly classes, performing at theme park and special events, and supporting production 
     logistics across rehearsals and live shows." 
     (Wrong: tries to be everything at once, grammatically weak, reads like a duty list)
  ✗ "Provided patient care and assisted doctors."
  
  GRAMMAR CHECK — TENSE AND PERSON:
  Job summaries use first-person implied — no pronouns, no third-person conjugation.
  
  Present tense for current roles, past tense for past roles.
  NEVER use third-person conjugation (teaches, manages, coordinates).
  These read as if someone else is describing the candidate, not the candidate's own resume.

  Current role: "Teach aerial arts and support live production operations for..."
  NOT: "Teaches aerial arts and supports live production operations for..."
  NOT: "Taught aerial arts..." (past tense for a current role is wrong)

  Past role: "Coached youth and adult athletes in obstacle course technique at..."
  Past tense is correct here — no issue.

  CURRENT ROLE TENSE CHECK — mandatory before outputting:
  For every job where current: true, read the job summary back and confirm:
  1. It uses present tense ("Coordinate," "Manage," "Support")
  2. It does NOT use past tense ("Coordinated," "Managed," "Supported")
  3. It does NOT use third-person conjugation ("Coordinates," "Manages")
  If any of these fail — rewrite the job summary before outputting.

  Read every job summary and ask: does this sound like the resume owner's voice, 
  or like a third party describing them? If the latter, fix the conjugation.

═══════════════════════════════════════════════
PART 7: PROFESSIONAL SUMMARY RULES
═══════════════════════════════════════════════

STRUCTURE: Professional identity + area of expertise + what they DELIVER (never what they WANT)

FOR CORE RESUME SUMMARIES:
  Position for a role type, not a specific company or job posting.
  Lead with the strongest credibility signal — not school enrollment, not job title alone.
  Use information from: the full resume + career context + all coaching conversation.
  Do NOT repeat bullet points verbatim.
  Do NOT use: "results-driven," "dynamic professional," "proven track record," "passionate about," 
  "detail-oriented," "team player," "go-getter"

THE EMPLOYER-FIRST RULE (especially for job-specific summaries):
  Show employers what THEY GET. Never what the candidate wants.
  ✓ RIGHT: "Event Coordinator with 3 years of production experience bringing vendor management, 
     budget oversight, and multi-stakeholder coordination to every project."
  ✗ WRONG: "Seeking an Event Coordinator role where I can apply my skills and grow professionally."
  ✗ WRONG: "Passionate professional looking for opportunities in event management."
  ✗ WRONG EVEN IF SUBTLE: "Hoping to bring my background in events to a new team."

NEVER IN ANY SUMMARY:
  - Candidate's age, or any comparative age reference ("at only 22," "unusually young for her age," 
    "most candidates her age") — these invite bias and make strength sound accidental
  - Third-person pronouns anywhere — resumes use first-person implied, no pronouns at all
    "Brings a performer's instincts" ✓ | "She brings a performer's instincts" ✗ — ever
  - Specific company names
  - "Seeking," "looking for," "hoping to," "I am," "I bring," "I have"

═══════════════════════════════════════════════
PART 8: SKILLS SECTION RULES
═══════════════════════════════════════════════

MICROSOFT OFFICE — special ATS rule, different from other suites:
  ATS systems search for BOTH "Microsoft Office" as a phrase AND individual tool names.
  The correct format preserves both: "Microsoft Office (Word, Excel, PowerPoint, Outlook)"
  This matches searches for "Microsoft Office," "Excel," "PowerPoint," and "Word" simultaneously.
  
  NEVER write just the tools without the suite name: "Word, Excel, PowerPoint" loses 
  "Microsoft Office" as a searchable keyword.
  NEVER write just the suite name: "Microsoft Office Suite" loses all individual tool names.
  ALWAYS use: "Microsoft Office (Word, Excel, PowerPoint, Outlook)" — keeps all keywords.

  For other software suites (Adobe, Google Workspace, etc.): keep individual tool names only.
  Individual names: "Photoshop, Illustrator, InDesign" — ATS searches each one separately.
  Suite name alone: "Adobe Creative Suite" — loses all individual keywords. Do not use alone.

CATEGORIES:
  DEFAULT: 2 categories. This is the standard for most resumes.
  Use: Technical Skills + Professional Skills
  Or for industry-specific resumes: [Industry] Skills + Technical Skills
  
  ONLY use 3 categories when:
  - The candidate has a genuinely distinct third grouping that would confuse a recruiter if merged
  - Example: a production role with Equipment/Technical, Administrative, and Soft Skills 
    where mixing them would bury searchable hard skills under soft skills
  - This should be rare, not the default

  NEVER use more than 3 categories under any circumstances.
  Do not create a category for fewer than 4 skills — merge into the closest existing category.
  Remove skills already well-represented in bullets UNLESS they are searchable ATS keywords.
  
  ONE CATEGORY IS ACCEPTABLE when the skill set is small or tightly focused.
  Do not create artificial separation just to add structure.

  PRESERVE ADMIN SKILLS CATEGORY FOR STUDENT AND EARLY-CAREER RESUMES:
  If the original resume had a dedicated administrative or technical skills category containing 
  admin competencies (scheduling, data entry, document management, record keeping, order 
  processing, inventory, customer communication), preserve those skills in the rewrite.
  Do not absorb them into Professional Skills or remove them on the grounds that they seem minor.
  For internship and entry-level targets, administrative capability is a primary requirement.
  A student whose resume shows no admin skills is a weaker internship candidate regardless 
  of how strong their other experience is.
  
  SEARCHABLE ADMIN KEYWORDS TO PRESERVE:
  Data Entry, Document Management, Record Keeping, Scheduling, Inventory Tracking, 
  Order Processing, Customer Communication, Microsoft Office (Word, Excel, PowerPoint, Outlook)
  These are ATS keywords for admin-adjacent internship and coordinator roles. Keep them.

SKILL EXTRACTION FROM COACHING — REQUIRED:
  Skills demonstrated in the coaching conversation but not on the resume must be extracted 
  and added to skillsCategories. This is not optional — it directly improves the Keywords score.

  Skills hiding inside experience descriptions:
  "I handled scheduling for the whole department" → Scheduling, Calendar Management
  "When problems came up I'd figure them out" → Troubleshooting, Problem Resolution
  "I was in charge of training the new people" → Staff Training, Onboarding, Knowledge Transfer
  "I kept track of what we had in stock" → Inventory Management, Supply Chain Coordination
  "I made sure the venue, vendors, and performers were all coordinated" → Vendor Relations, Logistics Coordination, Event Production

SECTION CONSOLIDATION RULE:
  If coaching surfaces items that would create 3+ separate sections with only 1-2 items each 
  (certifications, languages, volunteer, awards, memberships), consolidate into one 
  "Additional Information" section.
  Format each item as: Label | Detail
  Examples: "Spanish | Conversational" | "CPR Certified | American Red Cross, 2024" | 
  "Volunteer | Orlando Arts Council, Board Member 2022-Present"
  
  Give an item its own dedicated section only when there are 3+ items to justify it.

═══════════════════════════════════════════════
PART 9: EDUCATION RULES
═══════════════════════════════════════════════

  - Relevant coursework: list course titles only, comma-separated, one line. 
    Course titles are searchable keywords and signal preparation for the target role.
    Include when the candidate is a student or recent grad targeting roles in their field.
    ✓ "Relevant coursework: Leadership in the Entertainment Industry, Entertainment Law, 
       Revenue Strategies in Entertainment"
    ✗ Paragraphs describing what was studied in each course — too much, leave it out.

  - Academic projects: include ONLY when the deliverable itself demonstrates a skill the 
    target role requires, AND the scope is impressive enough to stand on its own.
    The bar: would a hiring manager find this credible and relevant, or would they skim it?
    ✓ "Developed a comprehensive event plan for the PGA Show covering logistics, operations, 
       marketing, staffing, food and beverage, technology, and environmental impact"
       (Passes — real event, multi-workstream deliverable, relevant to entertainment management)
    ✗ "Created a leadership manifesto for a fictional live event"
       (Fails — fictional, single deliverable, doesn't demonstrate production skill)
    When in doubt, leave the project out. Coursework is almost always enough.

  - GPA, honors, relevant organizations are appropriate to include for students and recent grads.
  - For experienced candidates (5+ years), education section shrinks — degree, school, year only.

═══════════════════════════════════════════════
PART 10: SECTION ORDER LOGIC
═══════════════════════════════════════════════

Apply reordering proactively when the current structure buries the strongest credibility signal.
Do not ask permission. Do not leave a clearly wrong structure in place.
When in doubt, leave it — the user chose it for a reason.

  New graduate, relevant degree, unrelated work → Education first
  Early career with relevant experience → Experience first
  Credential-driven roles (RN, CPA, PMP, AWS) → Certifications can precede experience
  Technical candidates with strong skills → Skills may appear before experience
  Executive candidates → Experience leads always. An MBA after 20 years of C-suite work is 
  supporting evidence, not the headline. Move education down regardless of original placement.
  Career changers → Lead with whatever makes the strongest case for the target role, not 
  whatever field they came from

Rule: Put the strongest credibility signal first. What makes a recruiter want to keep reading?

═══════════════════════════════════════════════
PART 11: SECTOR-SPECIFIC RULES
═══════════════════════════════════════════════

HEALTHCARE / NURSING:
  Credentials follow name in header immediately (AACN order: RN, BSN, specialty cert)
  Patient ratios are meaningful scope indicators: "1:6 ratio, 50-bed unit"
  Patient outcomes are the metrics: satisfaction scores, error reduction, readmission rates
  Name clinical systems specifically: Epic, Cerner, Meditech, Pyxis — do not omit or group
  Soft skills carry genuine weight: cultural competence, crisis response, multidisciplinary coordination
  Page limit: 1-2 pages standard

ACADEMIC / RESEARCH:
  CV format, not resume — length expectations do not apply (5-20+ pages normal for tenured faculty)
  Publications section often precedes teaching for research-focused institutions
  Grants and fellowships include dollar amounts
  Conference presentations, editorial board service, committee work all belong
  Graduate students: 2-5 pages

K-12 EDUCATION:
  State teaching license and subject/grade endorsements are critical — lead with them
  Student outcomes are the metrics: test score improvements, pass rates, engagement data
  Class sizes and grade levels provide scope context
  Curriculum development and technology integration are high-value differentiators
  Page limit: 1-2 pages (3 pages maximum for 15+ years of experience)

SOCIAL WORK / SOCIAL SERVICES:
  State license is essential and must appear prominently: LCSW, LMSW, LSW — include level
  Caseload numbers are the scope metric: "Managed 30+ concurrent cases"
  Client outcomes: housing placements, resource connections, program completion rates
  Specialized training worth naming: trauma-informed care, CBT, DBT, substance abuse certification
  Page limit: 1 page under 10 years experience, 2 pages for 10+

FEDERAL / GOVERNMENT:
  ⚠️ CRITICAL CHANGE AS OF SEPTEMBER 27, 2025: 2-PAGE MAXIMUM via USAJOBS
  Executive Order 14170 ended the long federal resume format. Do not write multi-page federal resumes.
  Required: eligibility section (citizenship, veterans' preference, availability, work schedule preference)
  Required: complete job history (all jobs, even old or unrelated — background checks verify completeness)
  Keywords from the specific Job Opportunity Announcement (JOA) are ATS-critical — match them exactly
  Public service and volunteer work carry extra weight in federal applications

═══════════════════════════════════════════════
PART 12: THE NO-REGRESSION GUARANTEE
═══════════════════════════════════════════════

Before outputting the final resume, evaluate your work against all three scoring categories:

  IMPACT: Did I add or meaningfully improve at least 2-3 bullets to be more specific, 
  more achievement-focused, or better calibrated to this career level?
  If not — I have not used the coaching material fully.

  CLARITY: Did I replace weak verbs, cut filler language, and add specificity to at least 
  3-4 bullets across the resume?
  If not — I have not done enough.

  KEYWORDS: Did I extract skills from the coaching conversation and add them to skillsCategories? 
  Did I ensure industry terminology is present at the right depth for this career stage?
  If not — I have not done enough.

THE STANDARD:
  If you cannot identify meaningful, specific improvements in at least two of three categories,
  you have not fully used the coaching conversation. Return to it. Find what you missed.

  NEVER produce a lateral rewrite — different arrangement of the same quality content.
  NEVER reword for its own sake while leaving substance unchanged.
  If a section is already strong and coaching added nothing new for it, leave it exactly as it was.
  The goal is a demonstrably better resume. Not a different-looking resume. Better.

═══════════════════════════════════════════════
PART 13: ABSOLUTE RULES — NON-NEGOTIABLE
═══════════════════════════════════════════════

NO HALLUCINATION:
  Use ONLY information explicitly in the resume or extracted during coaching.
  NEVER invent metrics, company details, project names, dates, awards, or responsibilities.
  If coaching did not surface a number, write around it with qualitative strength. When in doubt, omit.

NEVER INCLUDE ON ANY RESUME:
  - Candidate's age in any context whatsoever
  - Specific celebrity names (soft reference like "high-profile entertainment events" is fine)
  - Third-person pronouns anywhere in the document
  - "Responsible for," "helped with," "assisted with," "worked on" as bullet openers
  - Generic filler: "results-driven," "team player," "go-getter," "detail-oriented," "passionate about"
  - Em dashes (—) anywhere in the document. Not in bullets. Not in summaries. Not in job summaries.
  - Employment classification details: "contractor," "freelance," "part-time," "temp," "W-2," "1099"
    These create questions and legal ambiguity. The work speaks for itself. Leave classification out.
    Em dashes are an immediate AI signal. Humans don't use them in resumes, especially now.
    Use a comma, a period, or restructure the sentence instead. This is non-negotiable.

BULLET PUNCTUATION:
  Do NOT end bullets with periods. This is the current universal standard.
  Periods at the end of resume bullets are outdated. Omit them consistently across the entire resume.
  Exception: if a bullet contains two distinct sentences, the first sentence takes a period, 
  the second does not. Two-sentence bullets are acceptable when it improves readability — 
  do not force everything into one sentence when a clean break reads better.
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

1. SUMMARY — Set the summary field to an empty string: "".
   The summary will be written in a dedicated second pass after all bullets are finalized.
   Do not write a summary in this pass under any circumstances.

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
// BUILD SUMMARY PROMPT (written last, from completed resume)
// ─────────────────────────────────────────────
function buildSummaryPrompt({ rewrittenResume, conversation, careerContext, level, isJobSpecific, jobDescription, jobTitle, jobCompany }) {

  const levelVoice = {
    entry: `Entry-level candidate. Position them as a prepared, capable early-career professional. Lead with relevant experience or strongest credential. Do not use executive language. Authentic and specific for their stage.`,
    mid: `Mid-career professional. Position them as a confident expert who delivers results. Specific, grounded, evidence-based. Not entry-level and not inflated to executive scope.`,
    senior: `Senior/executive candidate. Reflect organizational scope and strategic leadership. Authoritative, outcome-focused, specific about scale and influence.`
  }

  const contextBlock = careerContext ? `
CAREER CONTEXT:
- Target roles: ${careerContext.target_roles?.join(', ') || 'not specified'}
- Career changer: ${careerContext.is_career_changer ? `YES — transitioning from ${careerContext.previous_field} to ${careerContext.target_roles?.join('/')}` : 'No'}
- Transferable skills identified: ${careerContext.transferable_skills?.join(', ') || 'none noted'}
` : ''

  const bulletSnapshot = rewrittenResume.experience?.map(job =>
    `${job.title} at ${job.company}:\n${(job.bullets || []).map(b => `• ${b}`).join('\n')}`
  ).join('\n\n') || ''

  const conversationBlock = conversation
    .map(msg => `${msg.role === 'assistant' ? 'Coach' : 'Candidate'}: ${msg.content}`)
    .join('\n\n')

  if (isJobSpecific && jobDescription) {
    return `You are writing the professional summary for a job-specific resume.

This is the most important piece of real estate on the page. It is the first thing a recruiter 
reads. It must function as a hook that makes them want to read everything below it.
A weak summary costs interviews. A strong one opens doors.

VOICE: ${levelVoice[level] || levelVoice.mid}

${contextBlock}

TARGET ROLE: ${jobTitle || 'the role'}${jobCompany ? ` at ${jobCompany}` : ''}

JOB DESCRIPTION:
${jobDescription}

FINALIZED RESUME BULLETS (write the summary from these — they are the source of truth):
${bulletSnapshot}

COACHING CONVERSATION (for full context on the candidate's story and background):
${conversationBlock}

THE EMPLOYER-FIRST RULE — ABSOLUTE:
Show employers what THEY GET. Never what the candidate wants.
✓ "Event Coordinator with 3 years of production experience bringing vendor management, 
   budget oversight, and stakeholder coordination to every project."
✗ "Seeking an Event Coordinator role where I can apply my skills and grow professionally."
✗ "Passionate professional looking for opportunities in event management."
✗ Even subtle: "Hoping to bring my background to a new team."

THE FORMULA:
[Role descriptor mirroring the job title as a noun] + [2-3 specific skills from the JD requirements section, using the JD's exact language where possible for ATS matching] + [what the employer gains — outcomes, reliability, scope, expertise]

RULES:
- 3-4 sentences maximum
- Open with a role descriptor that mirrors the job title (a noun, never a goal)
- Name 2-3 skills pulled directly from JD requirements — exact phrasing preferred
- End with what the employer gains, not what the candidate seeks
- NEVER name the company
- NEVER: "seeking," "looking for," "hoping to," "passionate about," "I am," "I bring"
- NEVER third-person pronouns
- NEVER mention age
- NO filler: "results-driven," "dynamic professional," "proven track record," "detail-oriented"
- NEVER use em dashes (—). Use commas or periods instead. Em dashes are an AI signal.
- Do not combine unlike skills or experiences into one crammed sentence. 
  Two focused sentences beat one sentence trying to cover everything.
- Readability is the first rule. If a sentence requires a second read to understand, 
  it needs to be broken up or simplified. A recruiter who has to work to understand 
  your summary has already moved on.
- Be aggressive. This is the hook. It should make a recruiter think: "This person gets what we need."

THE BRAIN TEST:
Read it back. Would a recruiter engage or skim?
If it sounds like every other summary, rewrite it.

Return ONLY the summary paragraph. No JSON. No label. No explanation. Just the text.`
  }

  return `You are writing the professional summary for a core resume.

This is the most important piece of real estate on the page. It is the first thing a recruiter 
reads. It must function as a hook that makes them want to read everything below it.
A weak summary costs interviews. A strong one opens doors.

VOICE: ${levelVoice[level] || levelVoice.mid}

${contextBlock}

FINALIZED RESUME BULLETS (write the summary from these — they are the source of truth, 
not the raw coaching conversation):
${bulletSnapshot}

COACHING CONVERSATION (for full context on who this person is and where they're going):
${conversationBlock}

THE STRUCTURE:
Professional identity + area of expertise + what they DELIVER

THE EMPLOYER-FIRST RULE:
Show employers what they get. Never what the candidate wants.
✓ "Aerial arts instructor and event coordinator with 3 years of performance and production 
   experience, bringing curriculum development, safety management, and multi-disciplinary 
   instruction to every role."
✗ "Seeking a position where I can apply my background in entertainment."

FOR CORE RESUMES:
- Position for a role TYPE, not a specific company or job
- Lead with the strongest credibility signal from the finalized bullets — not school enrollment
- The summary should make a recruiter want to read the bullets below it
- It must feel written about this specific person, not generated from a template
- For career changers: frame the identity around the TARGET role, not the previous field. 
  Use the coaching conversation to find the transferable thread that makes the transition 
  feel inevitable rather than abrupt.

RULES:
- 3-4 sentences maximum
- NEVER: candidate's age or any age-comparative language
- NEVER: third-person pronouns anywhere
- NEVER: "seeking," "looking for," "hoping to," "I am," "I bring"
- NEVER repeat bullet content verbatim
- NO filler: "results-driven," "dynamic professional," "proven track record," 
  "passionate about," "detail-oriented," "team player," "go-getter"
- NEVER use em dashes (—). Commas or periods only. Em dashes are an immediate AI signal.
- Do not cram unlike skills or experiences into a single sentence trying to cover everything.
  A summary that tries to say three things at once says nothing clearly.
  Two sharp, focused sentences beat one sprawling sentence every time.
- THE TARGET ROLE RULE: The summary must serve the candidate's stated target role, 
  not simply describe what they've done. If the coaching conversation or career context 
  established a target role, the summary opens from that angle — not from their current title.
  Example: A performer targeting stage management internships opens as a stage management 
  candidate, not as a performer. Their performance experience becomes evidence, not identity.

THE BRAIN TEST:
Read it back. Would a recruiter engage or skim?
A great summary makes a recruiter think: "I want to meet this person."
If it reads like every other summary, it is not done.

Return ONLY the summary paragraph. No JSON. No label. No explanation. Just the text.`
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
// BUILD TARGETED ENHANCEMENT PROMPT
// ─────────────────────────────────────────────
function buildTargetedEnhancementPrompt({ rewrittenResume, newConversation, remainingGaps, level }) {
  const levelInstructions = LEVEL_WRITING_INSTRUCTIONS[level] || LEVEL_WRITING_INSTRUCTIONS.mid
  
  return `${WRITING_CONSTITUTION}

${levelInstructions}

You are performing a TARGETED ENHANCEMENT PASS on an already-improved resume.
The resume was recently coached and rewritten. It is already significantly better than the original.

YOUR JOB: Use the new information from the follow-up conversation to meaningfully improve 
the resume. This may mean enhancing existing bullets, adding new bullets where the 
conversation surfaced content that has no home yet, or strengthening the summary to 
reflect new positioning information. Be surgical where the original is strong. Be bold 
where new material was provided that isn't yet on the resume at all.

REMAINING GAPS THAT WERE ADDRESSED IN THIS CONVERSATION:
${remainingGaps.map((gap, i) => `${i + 1}. ${gap}`).join('\n')}

FOLLOW-UP COACHING CONVERSATION (new material only — use this):
${newConversation.map(msg => `${msg.role === 'assistant' ? 'Coach' : 'Candidate'}: ${msg.content}`).join('\n\n')}

CURRENT RESUME (already improved — treat this as your baseline):
${JSON.stringify(rewrittenResume, null, 2)}

ENHANCEMENT RULES:
1. Find the bullets that relate to the gaps above
2. If the conversation provided new specific information, enhance those bullets with it
3. If the conversation did not surface new information for a gap, leave those bullets exactly as they are
4. DO NOT rewrite bullets that are unrelated to the gaps
5. DO NOT remove anything
6. DO NOT change the summary unless the new information is directly relevant to the opening positioning
7. DO NOT change the skills section unless new skills were explicitly mentioned

The goal is surgical improvement — not a new rewrite. Most of the resume should be identical 
to what you received. Only the bullets where new specific material was provided should change.

Apply all Writing Constitution rules to any bullets you do enhance.
No em dashes. No orphaned words. No hallucination.

OUTPUT: Return ONLY valid JSON matching the exact same structure as the input resume.
No markdown. No explanation. No backticks.`
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
      conversation,
      detectedLevel,
      careerContext,
      isJobSpecific,
      jobDescription,
      jobTitle,
      jobCompany,
      matchedKeywords,
      missingKeywords,
      retryInstruction,
      isTargetedEnhancement
    } = await request.json()

    if (!resumeData || !conversation) {
      return NextResponse.json({ error: 'resumeData and conversation are required' }, { status: 400 })
    }

// ── TARGETED ENHANCEMENT PATH ──
    if (isTargetedEnhancement) {
      const level = detectedLevel || 'mid'
      const baseResume = resumeData?._rewrittenResume || resumeData
      const remainingGaps = resumeData?._remainingGaps || []
      
      const enhancementPrompt = buildTargetedEnhancementPrompt({
        rewrittenResume: baseResume,
        newConversation: conversation,
        remainingGaps,
        level
      })

      const enhancementMessage = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        messages: [{ role: 'user', content: enhancementPrompt }]
      })

      let cleanedEnhancement = enhancementMessage.content[0].text.trim()
      if (cleanedEnhancement.startsWith('```')) {
        cleanedEnhancement = cleanedEnhancement.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      }
      let enhancedResume = JSON.parse(cleanedEnhancement)

      // Score check — if no improvement, retry with stronger instruction
      const scoreCheckResponse = await fetch(new URL('/api/analyze-resume', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeData: enhancedResume })
      })
      const scoreCheckData = await scoreCheckResponse.json()
      const enhancementScore = scoreCheckData?.score ?? null
      const baseScore = resumeData?._baseScore ?? null

      if (enhancementScore !== null && baseScore !== null && enhancementScore <= baseScore) {
        console.warn(`Targeted enhancement did not improve score (base: ${baseScore}, after: ${enhancementScore}). Retrying with stronger instruction.`)
        
        const retryPrompt = buildTargetedEnhancementPrompt({
          rewrittenResume: baseResume,
          newConversation: conversation,
          remainingGaps,
          level
        }) + `\n\nCRITICAL RETRY INSTRUCTION: Your first attempt scored ${enhancementScore}, which did not improve on the baseline of ${baseScore}. You were too conservative. The new content from the conversation MUST appear prominently in the resume — not as minor edits but as substantive additions that a scorer will notice. Add new bullets if needed. Strengthen the summary if the new positioning information warrants it. The standard is: the resume must score higher than ${baseScore} after this pass.`

        const retryMessage = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 8000,
          messages: [{ role: 'user', content: retryPrompt }]
        })

        let cleanedRetry = retryMessage.content[0].text.trim()
        if (cleanedRetry.startsWith('```')) {
          cleanedRetry = cleanedRetry.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        }
        try {
          const retryResume = JSON.parse(cleanedRetry)
          enhancedResume = retryResume
        } catch (e) {
          console.warn('Retry parse failed, using first attempt')
        }
      }

      const changesPrompt = buildChangesPrompt(baseResume, enhancedResume)
      const changesMessage = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        messages: [{ role: 'user', content: changesPrompt }]
      })

      let cleanedChanges = changesMessage.content[0].text.trim()
      if (cleanedChanges.startsWith('```')) {
        cleanedChanges = cleanedChanges.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      }
      let changes = []
      try { changes = JSON.parse(cleanedChanges) } catch (e) { changes = [] }

      return NextResponse.json({ rewrittenResume: enhancedResume, changes, detectedLevel: level })
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

      // ── SUMMARY: Written last, from completed bullets ──
      const jsSummaryPrompt = buildSummaryPrompt({
        rewrittenResume,
        conversation,
        careerContext,
        level,
        isJobSpecific: true,
        jobDescription,
        jobTitle,
        jobCompany
      })
      const jsSummaryMessage = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        messages: [{ role: 'user', content: jsSummaryPrompt }]
      })
      rewrittenResume.summary = jsSummaryMessage.content[0].text.trim()

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

    const assessmentBlock = resumeData?._analysisResults ? `
PRE-COACHING ASSESSMENT RESULTS (use these to validate your rewrite):

The resume was assessed before coaching. Your rewrite must demonstrably address the gaps 
identified below. If the coaching conversation surfaced material to fill these gaps, it must 
appear in the rewritten resume. If it did not, note the gap as remaining.

GAPS TO ADDRESS:
${(resumeData._analysisResults.weaknesses || []).map(w => `• ${w}`).join('\n')}

ACTION ITEMS TO FULFILL:
${(resumeData._analysisResults.suggestions || []).map(s => `• ${s}`).join('\n')}

WHAT'S WORKING (preserve these — do not change what the assessment confirmed as strong):
${(resumeData._analysisResults.strengths || []).map(s => `• ${s}`).join('\n')}

VALIDATION CHECK: Before outputting, verify that at least 3 of the gaps/action items above 
are visibly addressed in your rewrite. If they are not, you have not finished the job.
` : ''

    const rewritePrompt = `${WRITING_CONSTITUTION}

${levelInstructions}

${contextBlock}

${assessmentBlock}

${retryInstruction ? `⚠️ RETRY INSTRUCTION — READ THIS BEFORE ANYTHING ELSE:\n${retryInstruction}\n` : ''}

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

THE NO-REMOVAL RULE — READ BEFORE WRITING ANYTHING:
Before removing any bullet, section, or piece of content, ask:
  1. Does the coaching conversation or career context give a specific reason to remove this?
  2. Is the content inaccurate, redundant, or genuinely irrelevant to the target role?
  3. Am I replacing it with something strictly better — not just different?

If the answer to all three is not clearly YES, preserve the content.
Changing for the sake of changing is not improvement. Different is not better.
Removing valuable content because it doesn't fit your rewrite plan is a failure, not a feature.
The user's original resume represents choices they made — respect them unless you have 
a clear reason from the coaching conversation to do otherwise.

SPECIAL CASE — SECTIONS: Never remove an entire section (certifications, volunteer, admin 
experience, projects) unless the coaching conversation explicitly indicated it was wrong 
or irrelevant. When in doubt, keep it.

SPECIAL CASE — ADMIN EXPERIENCE, ALL CAREER LEVELS:
Before removing any administrative bullet, ask: is admin capability relevant to the 
target role? For many roles, admin IS the job — not a footnote to it.

Administrative content includes: scheduling, record keeping, roster management, 
data entry, document management, order processing, inventory, family or client 
communication, filing, reporting, coordination, and correspondence.

FOR STUDENTS AND EARLY-CAREER: Admin bullets are almost always essential. 
Internship and entry-level coordinators explicitly look for evidence of admin capability. 
Never remove admin content on the grounds that it "seems minor" or was "absorbed" 
into other bullets. If it was on the original resume and the target role has any 
admin component, it stays.

FOR MID AND SENIOR LEVEL: Admin content stays when:
- The target role has administrative responsibilities (coordinator, manager, director)
- The admin work demonstrates scope, ownership, or systems thinking
- Removing it leaves a gap in the picture of what this person actually does

FOR ANY LEVEL: The test before removing any admin bullet is:
"Does the target role require any form of administrative capability?"
If yes — preserve it. The candidate put it there for a reason.
Only remove admin content if it is genuinely redundant with another bullet that 
says the same thing more specifically, or if the target role has absolutely no 
administrative component whatsoever.

EXPERIENCE (follow this order for each role):

STEP 4A — TRIAGE FIRST. Before writing anything, evaluate every existing bullet:

  STRONG BULLET (passes all of these):
  - Starts with an accurate, calibrated action verb
  - Contains at least one specific detail (number, name, scope, frequency, context)
  - Passes the Brain Test — a recruiter would engage, not skim
  - Accurately represents the candidate's level of ownership
  → DO NOT rewrite. Look for one enhancement only (see below).

  WEAK BULLET (fails any of the above):
  - Vague, duty-focused, or task-oriented
  - No specifics — could describe anyone in this role
  - Fails the Brain Test
  - Opens with a weak or inaccurate verb
  → REWRITE using coaching material.

STEP 4B — ENHANCE STRONG BULLETS, DON'T REPLACE THEM:
  For every bullet that passes the triage above, ask ONE question:
  "Is there one thing from the coaching conversation that would make this bullet undeniable?"

  Enhancement targets in priority order:
  1. QUANTIFICATION — Can a number be added that wasn't there?
     "Teach adult and youth aerial arts classes" → add class size, enrollment built, 
     frequency, number of disciplines, or student age range
  2. SPECIFICITY — Can a vague phrase be made concrete?
     "with emphasis on safety" → "maintaining zero injury record across X sessions"
  3. SCOPE — Can scale be added that wasn't visible?
     "managing students" → "managing simultaneous instruction for skill levels from 
     beginner through advanced within a single class"
  4. COMPELLING FRAMING — Is there a more specific verb or a detail that tells the story better?
     Only change the verb if a more accurate one exists — never change for style alone.

  If the coaching conversation provides material for enhancement → enhance the bullet.
  If the coaching conversation provides nothing new for this bullet → leave it exactly as written.
  Do NOT enhance by adding information not in the resume or coaching conversation.
  Do NOT rewrite the entire bullet when only one element needs updating.

  THE PROFESSIONAL RESUME WRITER TEST:
  A professional resume writer reading a strong bullet asks: "What would make this undeniable?"
  Not: "How would I write this differently?"
  Find the gap. Fill the gap. Leave everything else alone.

STEP 4C — THEN HANDLE THE REST:
1. Keep every existing bullet confirmed strong in triage — enhance only where coaching adds something
2. Rewrite bullets confirmed weak in triage — use coaching material
3. Add new bullets from coaching that represent achievements not yet on the resume
4. Consolidate when multiple bullets cover the same theme (max 4-6 bullets per role)
5. Add a job summary if missing — Role + environment + core responsibility

PROFESSIONAL SUMMARY:
Set summary to an empty string: "".
The summary will be written in a dedicated second pass after all bullets are finalized.
Do not write a summary in this pass under any circumstances.

SKILLS:
Add skills extracted from both the resume AND the coaching conversation.
Organize into max 3 categories. Merge small ones. Remove what is already in bullets.

EDUCATION:
Preserve as-is unless coursework descriptions are paragraph-length — condense to one line.
Cut coursework that does not support the target role.
CRITICAL: Output each education entry EXACTLY ONCE. Do not duplicate degree names, 
school names, or graduation years. If the original data has both a degree field and 
a lines array containing the same degree text, output it once in the cleanest format.
The education section should never repeat the same information twice.

SECTION ORDER:
Apply logic only when a structural change clearly serves the candidate better.
Otherwise, leave the structure alone.

OUTPUT: Return ONLY valid JSON. No markdown. No explanation. No backticks.
Must match this exact structure:
${JSON.stringify(OUTPUT_STRUCTURE, null, 2)}`

    let rewriteMessage
    let rewriteAttempts = 0
    while (rewriteAttempts < 3) {
      try {
        rewriteMessage = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 8000,
          messages: [{ role: 'user', content: rewritePrompt }]
        })
        break
      } catch (err) {
        if (err.status === 529 && rewriteAttempts < 2) {
          rewriteAttempts++
          await new Promise(resolve => setTimeout(resolve, 2000 * rewriteAttempts))
        } else {
          throw err
        }
      }
    }

    let cleanedRewrite = rewriteMessage.content[0].text.trim()
    if (cleanedRewrite.startsWith('```')) {
      cleanedRewrite = cleanedRewrite.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    }

    const rewrittenResume = JSON.parse(cleanedRewrite)

    // ── SUMMARY: Written last, from completed bullets ──
    const coreSummaryPrompt = buildSummaryPrompt({
      rewrittenResume,
      conversation,
      careerContext,
      level,
      isJobSpecific: false,
      jobDescription: null,
      jobTitle: null,
      jobCompany: null
    })
    const coreSummaryMessage = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      messages: [{ role: 'user', content: coreSummaryPrompt }]
    })
    rewrittenResume.summary = coreSummaryMessage.content[0].text.trim()

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