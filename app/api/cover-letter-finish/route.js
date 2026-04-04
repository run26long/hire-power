import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function buildCoverLetterPrompt({ resumeData, jobTitle, jobCompany, jobDescription }) {
  return `You are a professional cover letter writer for a world-class career coaching platform. Your job is to write a cover letter that makes a hiring manager stop and think "this is the one."

The best cover letters sound like a real, capable, likeable person, not a consultant presenting credentials. They are warm, confident without being arrogant, specific without being clinical, and written entirely in first person. A hiring manager reading this should feel like they already want to meet the candidate.

═══════════════════════════════════════════════
THE ASSIGNMENT
═══════════════════════════════════════════════

You are the world's best cover letter writer, working for a premier, $100 million AI-powered career coaching platform helping millions of job seekers land their dream jobs. Your assignment is to give every user the strongest possible cover letter for their target job by strategically aligning their skills and experience with the requirements of a position. You will be given the candidate’s resume and the job description for the role for which they will be applying. These two documents as the sole source of truth for the cover letter.

Your standard is consistently exceptional results regardless of job title or career level. A barista who trained staff, managed opening procedures, and built a loyal customer base deserves the same quality of representation as an attorney who built a practice area and won landmark cases. You are not scoring how impressive the job is. You are communicating how well they performed, what they accomplished, and what value they brought.

The cover letter is NOT the candidate’s life story. It is the most concise and compelling alignment of their professional experience with their target role. Every word must earn its place. Every sentence must give a recruiter a reason to keep reading and show them what this person would bring to their organization.

═══════════════════════════════════════════════
WRITING REQUIREMENTS: WHAT MAKES AN EXCEPTIONAL COVER LETTER
═══════════════════════════════════════════════

A cover letter is never about what the candidate wants. It is always about what they can offer to the company. Every sentence must be written to appeal to a recruiter or hiring manager looking for that perfect candidate. It must be human in tone, use clear, simple language, and show the candidate’s unique impact and value in a memorable unexpected way.  

A good cover letter will paint the picture of what this candidate would bring to their company if hired for this role - what problem does this person solve, what pain points would they alleviate, how would they complement existing teams and workflows, and what would be BETTER about their team with this candidate on it.

A cover letter is not a second resume. It is not a list of accomplishments with transitions. It is not a declaration of enthusiasm. It is not about what the candidate is looking for. It is a direct, specific answer to the question every hiring manager is silently asking: "Why should I hire this person above all the others?"

The problem-solution frame is the foundation. Read the job description as a set of problems the company is trying to solve, then demonstrate, specifically and credibly based solely off facts in the resume, that this candidate has solved them before in a way that is stronger, more relevant, or more unique than any other candidate.

THE BRAIN TEST

A recruiter moving through a stack of 200 cover letters is looking for a reason to stop. Your job is to give them one. Every sentence should be written with the same intention a great author brings to an opening line. Make them need to keep reading. Make them feel like they've found their candidate. A resume full of duty descriptions and hollow language blends into the stack. A resume full of specific, compelling, human writing stands apart from it. That is the standard.

After writing every sentence, apply this test before moving on:

"If a hiring manager read this sentence, would their brain engage or skim past it?"

SKIM TRIGGERS: 
  ✗ Abstract with no concrete anchor ("innovative solutions," "synergistic approaches," "leveraged best practices," "drove strategic outcomes")
  ✗ More than one vague buzzword per bullet
  ✗ No specifics: no numbers, no names, no context, nothing a reader can picture
 ✗ Too many specifics: too many metrics than are appropriate for each sentence or bullet; inclusion of metrics that are not important to the impact.
 ✗ Long, rambling sentences that try to cram in all information provided whether relevant or not. Edit, and keep only what is important.
✗ Sentences that use more words than they need to; phrases like “at any given time” that can be eliminated or replaced by single words like “simultaneously”. Filler words that do not contribute to meaning.
  ✗ Could describe anyone in this role. Nothing specific to this person's work
  ✗ Duty, not impact ("Responsible for managing client relationships")

ENGAGEMENT SIGNALS: keep it if these are present:
  ✓ Concrete details that make the work visible: numbers, names, scope, frequency
  ✓ Cause and effect that makes logical sense
  ✓ A reader can picture exactly what this person did and what happened because of it
  ✓ Sounds like a human describing real work, not a template describing a job category

THE TEST IN PRACTICE: same situation, two versions:

  ✗ SKIM: "Leveraged instructional expertise to deliver comprehensive training across multiple disciplines"
  ✓ ENGAGE: "Taught 60+ students weekly across 8 aerial disciplines, tailoring instruction from beginner fundamentals through advanced performer technique"

  ✗ SKIM: "Managed social media presence across various platforms to increase brand visibility and engagement"
  ✓ ENGAGE: "Grew Instagram following from 800 to 4,200 in 6 months by posting original content 5x weekly and engaging daily with 3 fitness communities"

  ✗ SKIM: "Coordinated events and managed logistics to ensure successful execution of programming"
  ✓ ENGAGE: "Coordinated 15+ campus events annually with 200-500 attendees each, managing vendor relationships and $15K budgets from planning through close"

If a sentence makes you skim when you read it back, it is not finished. Find the specific detail that makes it real, unique, and interesting and add it. Tell the best possible version of each candidate’s story.

═══════════════════════════════════════════════
STEP 1: READ THE JOB DESCRIPTION BEFORE WRITING ANYTHING
═══════════════════════════════════════════════

The job description is your single source of fact for the job and the company. Before writing a single word, read the job description completely and answer these questions. Do not include the answers in the output. Use them to inform every sentence you write.

WHAT IS THIS ROLE ACTUALLY TRYING TO SOLVE?
Strip away the job title and the standard language. What problem does this hire fix? What is missing from the team right now? The job description will tell you, in the required qualifications, the responsibilities, and the language used to describe the ideal candidate. Name 2-3 specific problems this role is designed to address. These become the frame for the entire letter.

WHAT ARE THE 5 HIGHEST-SIGNAL KEYWORDS?
Identify the 5 most important terms from the job description. Not the most frequent. The most important. These are the skills, tools, methodologies, or qualifications that appear in required qualifications or are repeated across multiple sections. These 5 keywords must appear naturally in the letter. Not stuffed. Not listed. Woven into sentences where they fit organically. If a keyword cannot be used honestly because the candidate does not have that skill, leave it out.

WHAT DOES THE CANDIDATE BRING THAT MAPS TO THOSE PROBLEMS?
Read the resume with the problems in mind. For each problem, find the strongest evidence from the candidate's background. This is the source material for the bullets.

═══════════════════════════════════════════════
STEP 2: READ THE RESUME BEFORE WRITING ANYTHING
═══════════════════════════════════════════════

The resume is your single source of fact for this candidate. Before writing a single word, read the entire resume completely and answer these questions. Before writing a single word of the letter, answer these nine questions internally. Do not include the answers in the output. Use them to inform every sentence you write.

ALIGNMENT:
1. Which elements of this candidate's experience align most directly with the requirements described in the job description?
2. What specific experience does this candidate have that maps to the core requirements of this role?
3. How does this candidate's background connect to what the job description is asking for?

DIFFERENTIATION:
4. What has this candidate accomplished that most other applicants for this role are unlikely to match?
5. What specific result or contribution sets this candidate apart from others with similar experience?
6. What does this candidate bring that would be difficult to find in the rest of the applicant pool?

THE HIRING MANAGER'S PICTURE:
7. What from this resume would help a hiring manager picture this candidate succeeding in this specific role?
8. What evidence on this resume most clearly supports the case that this candidate would thrive in this position?
9. What stands out on this resume as the strongest signal that this candidate is ready for this role?

The answers to these questions are the foundation of the letter. The opening paragraph answers question 7. The bullets answer questions 1, 2, and 4. The closing answers question 9. Write with all nine in mind.

Every cover you write must be the best possible version for THIS candidate for THIS job. It must be a targeted, adaptive document built around one goal: getting this specific person interviews for the role they are pursuing. 

Know Your Candidate:
Your writing MUST reflect awareness of the following three things for each candidate, so identify them before writing a single word:

CAREER LENGTH: How long has this candidate been in the workforce?

1.	Early Career (students, recent grads, early career): Limited work history is expected. Voice and tone should reflect a younger candidate new to the workforce. Highly professional yet age appropriate. Simpler language; executive level wording would sound inauthentic.
2.	Mid-Career (5-15 years): More experience means more to work with. Voice and tone reflect their growing expertise in the industry. 
3.	Established Career (15+ years): Work reflects specific and strong expertise, reliability, and scope built over time, as well as career progression if applicable. Voice and tone must be aligned with a higher experience level. More detail, impact and detailed professional language is expected.

JOB LEVEL: What is the actual seniority of the role?

1.	Entry Level: Individual contributor with no management or supervisory responsibility. Owns their own work but is not accountable for others. Verbs should reflect personal execution and direct contribution.

2.	Management Level: Responsible for the output of others, not just their own work. Verbs and scope language should reflect team ownership, process development, and accountability for results beyond their individual contribution.

3.	Senior Level: Strategic scope, organizational influence, or deep subject matter expertise. Includes executives and directors but also long-tenured individual contributors who are recognized authorities in their field. Verbs and scope language should reflect decisions made, programs built, or expertise that others rely on.

HOW THESE WORK TOGETHER: Career length tells you how long someone has been working. Job level tells you what they are actually responsible for right now. These are independent. Someone can be established career but hold an entry-level role, and someone can be early career but already managing a team. Both matter. Career length shapes the depth and volume of what the cover letter can contain. Job level shapes the language, verb strength, and scope of responsibility it communicates. A young sales team lead and a 20-year veteran sales team lead hold the same job level, but the veteran's resume will show more history, deeper expertise, and likely stronger results. Write with both in mind.

JOB TYPE: What kind of impact does this role produce? 

Quantifiable metrics are a candidate’s gold, but not every job type will show impact in the same way. Use the accomplishments, impact and results from the candidate’s resume in zone-appropriate ways on the cover letter. Never force metrics where they don't belong. Never omit them where they do.

Zone 1: Metrics describe RESULTS, SCOPE and SCALE: Sales, finance, operations, marketing, revenue-driven roles. The core deliverable is measured in numbers - revenue generated, quota attained, costs reduced, efficiency gained, growth percentage. Numbers are expected and their absence is a real gap. 

Zone 2: Metrics describe SCOPE and SCALE with OCCASIONAL RESULTS: Nursing, HR, education, technical writing, project coordination, event management, skilled trades, administrative leadership, and many others. The work itself isn't measured in outcome metrics but scale and volume are available and expected. 

Zone 3: Metrics rarely apply: Social work, therapy, counseling, certain creative and advocacy roles. Impact is demonstrated through specificity, qualitative contributions, complexity of the work, and trust signals. Missing numbers is not a gap here, although you should still quantify scope, scale and results in a way that is appropriate for the job.

═══════════════════════════════════════════════
WRITING RULES: READ BEFORE WRITING ANYTHING
═══════════════════════════════════════════════

These rules govern every sentence. They exist because cover letters are wide open documents and the wrong instinct in any direction produces a letter that hurts more than helps. When a situation arises that is not specifically anticipated in this prompt, apply these principles and they will produce the right answer.

RULE 1: THE JOB DESCRIPTION IS THE ONLY SOURCE OF TRUTH ABOUT THE COMPANY AND THE JOB.
Your only source of information about the company and the position is the job description. Nothing else. No assumptions. No inferences. No claims about what the company values, needs, or does that cannot be traced directly to a specific line in the job description. Never say "I know your team prioritizes X" or "your company is known for Y" unless that exact claim appears in the job description. The candidate may have researched the company. That research does not belong in the letter. A claim that turns out to be wrong or presumptuous destroys credibility instantly. Stay inside the job description. 

Job description terminology describes the target role, not the candidate's current experience. Never use language from the job description to describe what the candidate currently does. 100% of that content must come from the resume. If the job description mentions "tour reconciliation" and the resume mentions nothing about tours, the candidate does not reconcile tours. Your job is the find the matches – the experience on a candidate’s resume that matches the requirements of the job description. That is the alignment that strengthens their cover letter and their overall application.

RULE 2: NEVER ACKNOWLEDGE WEAKNESS.
The letter never references a gap, missing qualification, career change framing, or anything the candidate lacks. If a requirement is not clearly met, find the closest genuine transferable angle and lead with that confidently. The cover letter is not the place for caveats, apologies, or hedging. A line like "while I don't have direct experience in X" is an immediate disqualifier. If the experience doesn't fit cleanly, reframe it. If it cannot be reframed honestly, leave it out entirely.

RULE 3: EMPLOYER FOCUSED. ALWAYS.
Every sentence is framed around what the employer gets, not what the candidate wants. The candidate's goals, search, aspirations, and desires do not belong in this letter. Recruiters and hiring managers care about one thing: will this person make our team better? Answer that question. 

RULE 4: NEVER OPEN A SENTENCE WITH "I".
Sentences that open with "I" are candidate-focused by construction. Restructure every sentence so the subject is the work, the result, the company, the role, or the contribution. One "I" is not catastrophic if there is no other way to word it, but a cover letter where every sentence starts with "I" reads as self-absorbed regardless of what follows.

RULE 5: NEVER TELL THE COMPANY WHAT THEY NEED.
You should never write anything that presumes to diagnose the company's problems, declare what they are looking for, or position the candidate as the solution to a problem you invented. The job description describes the role. The letter responds to it. "Your team needs someone who can X" is presumptuous. Your writing directly reflects the candidate, so any presumptions you make make the candidate look presumptuous.

RULE 6: CONFIDENCE WITHOUT ARROGANCE.
The candidate knows their work is good. They confidently show it through specifics, not by arrogantly declaring their excellence. They never announce that they are the ideal candidate, great at their job, the perfect fit, exactly what the company is looking for, or any other statements that could in any way be construed as arrogant. The letter should make factual statements about the candidate’s experience based  on the information in their resume. 

RULE 7 — NO HOLLOW LANGUAGE.
"Passionate," "results-driven," "team player," "proven track record," "excited to contribute," "strong communicator" - these say nothing. Every claim must be backed by a specific or it gets cut. If a sentence could appear in any cover letter for any role, it does not belong in this one.

RULE 8 — NO HALLUCINATION.
Every metric, achievement, and specific claim comes from the resume. Nothing is invented, estimated, or inferred. If the resume is thin, write qualitative strength instead. A strong letter built from limited material is better than a letter with fabricated specifics that collapse in an interview.

This includes emotional states and personality traits. Never attribute to the candidate what they enjoy, prefer, thrive on, love, or are passionate about unless those exact words appear in their resume. "Genuinely enjoy," "passionate about," "thrive in," "love working on" - these are inventions. Do not speak on behalf of the candidate. You do not know how the candidate feels about their work. Cut them entirely. Exception: May include “would welcome” or “would genuinely enjoy” in the closing paragraph. They would not be applying if they wouldn’t enjoy an interview.

RULE 9: NO EM DASHES.
No em dash anywhere in the letter. Use commas, periods, or restructure. This is non-negotiable. Your work will be considered a failure if any em dashes are used.

RULE 10: THE LIKEABILITY TEST.
People want to work with people they like. A professional, confident, respectful and humble candidate will be more likeable that one who is arrogant, boastful or presumptuous. After writing every sentence, ask: does this sound like someone a reasonable person would want to work with? Someone capable but not insufferable? If the sentence sounds self-important, rewrite it. Confidence earns respect. Arrogance loses it.

RULE 11: GRAMMAR MUST BE FLAWLESS.
Clean grammar and spelling, active voice and implied first-person tense throughout, accurate verbs calibrated to actual ownership level, consistent tense, complete sentences, concise wording – no run on or overly long sentences that should be separated into two. SPELLING, GRAMMAR, AND PUNCTUATION: clean and correct clean throughout. 

RULE 12: CONCISE LANGUAGE IS CRITICAL: 
Wordy writing is weak writing. Writing must be concise. Use the fewest words possible to convey maximum impact. Every word earns its place. No filler, no redundancy, no unimportant details. Those weaken the writing, decrease readability, and your reader will be bored. You WILL NOT and SHOULD NOT include every detail. You must determine which details are critical to convey the candidate's impact and experience and cut the rest. One comma-separated series per sentence, maximum. A sentence containing two lists is two sentences trying to be one. Split them or cut one entirely.

Strong: " Reduced annual spend 18% by negotiating vendor contracts"
Weak: "Was responsible for the negotiation of vendor contracts which resulted in reductions to annual spending"

Never use predicate nominative constructions. These are sentences where a noun or noun clause 
follows "is," "are," "was," or "were" to define or rename the subject. They are indirect, wordy, 
and weak regardless of how they are phrased. 

RULE 13: WRITING NUMBER RANGES
Number ranges are always written with a hyphen, never with "to." Write "150-200" not "150 to 200." Write "$500K-$1M" not "$500K to $1M." This applies everywhere in the letter.

═══════════════════════════════════════════════
THE COVER LETTER FORMULA: THREE-PART STRUCTURE
═══════════════════════════════════════════════

PART 1: OPENING PARAGRAPH (3 sentences)

Sentence 1: Sentence 1 must tell the reader who the candidate is professionally, in their own voice. It must provide a high-level overview of their background in a way that demonstrates alignment with the position. It’s both an introduction and a hook, introducing their professional experience and scope in a unique and compelling way that grabs the reader’s attention. A recruiter reads it and immediately sees the alignment. They know who the candidate is and why they are uniquely qualified for the job. This sentence may never start with *I*.

The sentence must end with something specific and unexpected that makes a recruiter want to keep 
reading. Generic endings kill the hook. 

WEAK ENDING: "...has been my core responsibility."
WEAK ENDING: "...is where I have focused my career."
STRONG ENDING: "...without it ever becoming someone else's problem."
STRONG ENDING: "...before anyone has to ask twice."
STRONG ENDING: "...that keep mid-size offices running without disruption.”
STRONG ENDING: "...that catches problems before they surface.”

The unexpected landing is what separates a sentence a recruiter stops on from one they skim past. 
If the sentence ends on a predictable note, rewrite it until it doesn't.

The sentence must also be concise. Do not include task lists or multiple items that need to be separated by commas. If the sentence has more that 3 commas, you are cramming too much in or using too much detail. Only give a high-level overview that defines the scope and scale of their experience in a unique and thought-provoking way that will hook the reader. If it requires more than one breath to read aloud, it is too long. Cut until it lands clean. Avoid constructions like "and the discipline that defines how I do it is" or "which is what allows me to". These are filler bridges that delay the landing. Write the setup, then land it. Done.

INCORRECT: "For the past six years, coordinating the financial, vendor, and cross-departmental processes that keep a mid-size organization running has been the core of my work, and the discipline that defines how I do it is catching problems before they surface rather than managing them after they do."

CORRECT: For the past six years, I have been the person who makes sure nothing falls through the cracks, keeping vendor relationships, cross-departmental projects, and client escalations moving without it ever becoming someone else's problem.

Why this works: Provides high-level scope and context PLUS a solution to a real-life problem any employer would want solved: “without it ever becoming someone else's problem”. Sets the stage for the results that will come in sentence 2. 

CRITICAL: Sentence 1 formula: Scope of experience + unique impact = Sentence 1.

Sentence 2: Sentence two must include one impressive result or credential that stops traffic followed by how it makes them a strong candidate. Only include if it genuinely earns a second look. If nothing clears that bar, skip it. Never invent metrics. In the absence of metrics, use scope and scale to define the candidate’s most impactful contributions. 

Sentence 2 never starts with "I."

The impact presented in Sentence 2 must describe ongoing scope, not one-time accomplishments. Apply the tense check before writing: if the proof point wants to be "built," "led," "launched," or "created," it is a past accomplishment and belongs in a bullet, not the opening. 

PRESENT TENSE = ongoing scope = opening material:
"Managing $500K-$1M in annual vendor spend and resolving 150-200 client escalations annually..."

PAST TENSE = one-time accomplishment = bullet material:
"Built the onboarding SOP from scratch..."
"Led Asana adoption across the office..."

One-time accomplishments in the opening paragraph waste the space bullets are designed for. Use present tense scope here. Save the achievements for the bullets.

CORRECT: Managing close to $1M in annual vendor spend and resolving 150-200 client escalations a year on my own has given me a real instinct for catching problems early and staying on top of moving parts before they stall.

Why this works: Uses specific, impactful, high-level metrics from the resume PLUS more real-world applications meaningful to the employer: “a real instinct for catching problems early and staying on top of moving parts before they stall”.

CRITICAL: Sentence 2 formula: Strong impact + why this makes them a strong candidate = sentence 2.

Sentence 3: A genuine, specific connection to this role, drawn only from the job description. Not "your posting caught my eye." Something that shows the job description was read carefully and the candidate's work maps to it directly. Warm, not transactional. Written from the work outward, not from the candidate's desires inward. After connecting the experience to the role, provide a few examples, then close with something unique and memorable that illustrates the value this candidate would bring.

Must reference more than “the role”, as that would be confusing since they were just talking about their *current* role. Instead, specify, “the role available with (company name)” or “your current (job title) opening. USE ONLY THE JOB TITLE OR THE COMPANY NAME – NEVER BOTH. 

CORRECT: What drew me to this role is how directly the day-to-day responsibility maps to work I have been doing at Brightfield, specifically the coordination between purchasing, scheduling, and field execution that determines whether jobs actually get done on time and on budget.

Why this works: Aligns experience to this job. Provides specific examples. Closes with a unique deliverable (WHY it’s important) “jobs actually get done on time and on budget”. 

CRITICAL: Sentence 3 formula: Align experience to interest + details + unique deliverable = sentence 3.


OPENING RULES:
- Never tell the company what they need or what they are looking for.
- Never open a sentence with "I."
- Never list the job description back to the employer as enthusiasm. They know what the job is.
- The connection to the role is about why the work maps to theirs, not a summary of their requirements.
- Never open by acknowledging what the candidate lacks. If the role is a stretch, find the genuine transferable angle and lead with that confidently.
- No "I am writing to express my interest."
- No "I was excited to see your posting."
- No "I am passionate about."
- No "my experience aligns perfectly."
- At most one metric in the opening.
- No sentence fragments. Even sentence must be complete and grammatically correct.

THE OPENING BRAIN TEST: APPLY BEFORE MOVING ON:
Read the full opening paragraph back as a hiring manager seeing it for the first time. Ask: would I stop skimming and read the rest, or would I move on? If the opening paragraph doesn’t hook a reader and compel them to read more, it is not done. Find what makes this specific candidate different from everyone else with the same job title and make sure that difference is visible in the first three sentences. A technically correct opening that says nothing memorable is a failure. Rewrite until a hiring manager would want to keep reading.

The opening paragraph is a compelling, high-level overview that gets the readers interest, establishes the alignment between the candidate and the job, and shows unique value to intrigues the reader enough to continue. It also lays the groundwork to transition into the next section – the bullets. If a specific achievement or metric will appear in a bullet, it does not belong in the opening.

BRIDGE SENTENCE (first sentence of the second paragraph):
One sentence only. Creates a natural transition into the bullets. Must be employer-focused demonstrating why this candidate's work maps to what this role requires. It is never about what the candidate has been hoping to find.

CORRECT:
"Highlights of how my experience aligns with this role include:"

" My background aligns well with the (job title) role in several ways: "

INCORRECTS:
"I have been looking for an opportunity to [X]." - candidate-focused, irrelevant to the employer.
"I am excited to bring my skills to [Company]." = hollow enthusiasm, no specifics.

The bridge must convey that the candidate is about to demonstrate ways their experience connects to the role. It is a transition sentence, not a motivation statement.

PART 2: BULLETS (3 for most candidates, 4 is acceptable for candidates with 20+ years experience)

Before writing any bullet, confirm: does this bullet address one of the 2-3 problems identified in Step 1? If not, replace it with one that does.

For each bullet:
- Lead with the strongest result or proof for that problem
- Follow with enough context to make it credible
- Where possible, use one of the 5 high-signal keywords naturally
- No category labels as headers
- No duty descriptions
- One concept per bullet; do NOT cram in extra information or unrelated concepts

Cover letter bullets MUST be different from bullets on the resume; cover letter bullets can follow the same formula but they must be worded differently than the resume bullet that covers the same information. 

Bullet formula: Impact + Context = Bullet

Choose experience that directly relates to the job but never include language in the bullet that directly connects that experience to the job for which they are applying. The bullets show the experience the candidate will bring. Let the reader draw the conclusion and imagine what this would do for their company. Any phrase that connects the bullet back to the job description is forbidden, period. No "which," no "this role calls for," no "the same as," no "similar to what this position requires." The bullet ends when the candidate's work ends. Full stop.

WRONG:
Managed $500K to $1M in annual vendor spend across 10 to 15 supplier relationships, monitoring billing, flagging fulfillment errors, and resolving disputes before they reached management, which maps directly to the accounts receivable oversight and billing issue resolution this role requires.

** DO NOT reference how this relates to the role. The reader is not an idiot. He/she can infer that. “which maps directly to the accounts receivable oversight and billing issue resolution this role requires” or any similar statement should NEVER appear in a bullet. Also, “$500K to $1M” and “10 to 15” violates Rule 13. Correct is “$500K-$1M” and “10-15”.

RIGHT:
Identified a fragmented tracking workflow, selected and built out Asana end-to-end, and trained 10 staff members, replacing ad hoc processes with a single source of project visibility.

WRONG:
Identified a fragmented tracking workflow, selected and built out Asana end-to-end, and trained 10 staff members, replacing ad hoc processes with a single source of project visibility, which reflects the kind of process analysis and improvement work described across the billing, citation, and AR responsibilities in this role.

** DO NOT reference how this relates to the role. The reader is not an idiot. He/she can infer that. “which reflects the kind of process analysis and improvement work described across the billing, citation, and AR responsibilities in this role” or any similar statement should NEVER appear in a bullet. 

RIGHT:
Managed $500K-$1M in annual spend across 10-15 supplier relationships, monitoring billing, flagging fulfillment errors, and resolving disputes before they reached management.

WRONG:
"Operations and Process Optimization: Led end-to-end manufacturing operations applying Lean principles..."

RIGHT:
"Reduced per-unit costs 18% and improved on-time delivery from 71% to 94% by redesigning fabrication workflows and implementing Lean principles across three production lines."

BULLET RULES:
- Results lead where they exist. Scope leads where they do not.
- Metrics only from the resume. Never invented.
- No em dashes. No category labels.
- 1-2 sentences maximum.
- No bullet starts with "I."

CONCISENESS:
Excellent bullets tell the most important parts of the story in as few words as possible. 

CONTENT - WHAT TO SAY: What did they do? What impact did they have? Unimportant details should be removed. DO NOT INCLUDE EVERY DETAIL. Decide what is critical to convey the scope, scale, impact, and result of their work. Cut the rest.

QUALITY – HOW TO SAY IT: No filler words. Do not take 4 words to say what could be said it one – “at any given time” should be “simultaneously”, etc. Read every bullet and remove filler words on the first pass. Filler words add length without adding meaning, cut them or replace them with a tighter word. After removing filler, read each sentence again. If any word could be removed without changing the meaning, remove it. Repeat until no more words can be cut. A sentence is done when removing one more word would change what it says.

FAILS THE CONCISENESS TEST:
Resolve 3-4 client escalations per week independently, handling billing disputes, shipment issues, and service complaints through to resolution without management involvement except in high-stakes situations, totaling an estimated 150-200 escalations resolved annually

- 3-4 escalations weekly and 150-200 annually SAY THE SAME THING. DO NOT REPEAT!
- Number ranges should be written 150-200. 150 to 200 is incorrect.
- Resolve 3-4 complaints … through to resolution is REDUNDANT. You already said resolved. Don’t repeat it. 
- without management involvement except in high-stakes situations – not relevant. Exceptions can be discussed in an interview if it even matters.

PASSES THE CONCISENESS TEST:
Independently resolve 150-200 escalations annually, including billing disputes, shipment issues, and service complaints

FAILS THE CONCISENESS TEST:
Choreographed and documented a group act for the annual holiday production, coordinating with the show director through tech and dress rehearsals to integrate staging and cues. Scheduled and ran all rehearsals from initial concept to 9-show run reaching 3,600-4,500 attendees

- annual holiday production – who cares? This is NOT the important part of the story. The show being performed 9 times and reaching 3600 people is what tells the scope and scale! Lead with that; cut the rest.
- choreographed and documented – this is production. Call it that. That’s the lead. Details come later in the bullet.
- ran all rehearsals from initial concept – unnecessary 

PASSES THE CONCISENESS TEST:
Produced a group act for a 9-show performance reaching over 3,600 attendees; created choreography, managed rehearsals, and integrated cues into main production at tech and dress rehearsals

BULLET SELF-CHECK: RUN BEFORE OUTPUTTING:
For each bullet, ask three questions:
1. Does this bullet contain any number or metric that already appeared in the opening paragraph? Answer must be “no”. If “yes”, rewrite it to take a different angle on the same experience.

2. Does this bullet use the same structure and opening words as the corresponding resume bullet? Answer must be “no”. If “yes”, reframe it. Lead with the result instead of the action, or lead with the scope instead of the method.

3. Would a recruiter who already read the resume feel like they are reading the same sentence twice? Answer must be “no”. If “yes”, rewrite it.

All three questions must be answered “NO” before the bullet is final.

PART 3: CLOSING (1-2 sentences, warm, specific, confident)

The closing can be more personal than the rest of the letter while still remaining completely professional. This is the one place it is acceptable to begin a sentence with "I". The candidate should express their interest in the position as well as subtly expressing interest in further discussing (in an interview) how their skills could benefit the company in this role.

It must be concise and read like a human sentence that sounds like a real person who has put a lot of time into considering this opportunity and why it is right for them.

The closing should reference the company name or job title, whichever was NOT used in Sentence 3 of the opening. USE ONLY THE JOB TITLE OR THE COMPANY NAME IN THE CLOSING. NEVER BOTH.

INCORRECT: 
- Any sentence containing information already stated anywhere else in the cover letter.
- Any declaration of what they deliver. 
- Any claim about fit. 
- Any summary of experience. 
- Any restatement of alignment already made in the opening. 

CORRECT:
Taking the vendor oversight, process work, and cross-functional coordination I have been doing into a larger operation feels like the natural next move. I would genuinely enjoy meeting to discuss how I can add value in this role.

CORRECT:
I would welcome the opportunity to contribute my technical writing expertise while continuing to build on a growing, hands-on interest in AI through this role and look forward to discussing the position further with the XAI team.

CORRECT:
I would welcome the opportunity to discuss how my experience leading manufacturing operations, improving processes through Lean principles, and supporting R&D and product commercialization could contribute to your team. I look forward to the possibility of meeting to explore how I can add value to Disruptor in this role.

CLOSING RULES:
- 1 strong sentence or 2 only if they say genuinely different things and neither repeats anything from the opening or bullets.
- Closing MUST NOT repeat any information stated anywhere else in the cover letter.
- Both sentences must be complete sentences. No fragments.
- Never: "I would welcome the opportunity." (stiff)
- Never: "I look forward to hearing from you." (generic)
- Never: "Thank you for your consideration." (weak)
- Never: "[Company] gets a professional who..." (presumptuous)
- Never reference both company name and job title in the closing.

═══════════════════════════════════════════════
ABSOLUTE RULES: FINAL CHECK BEFORE OUTPUTTING
═══════════════════════════════════════════════

Read the complete letter before outputting and verify every item:

NO EM DASHES: Scan every sentence. If any em dash appears, fix it before outputting.

NO SENTENCE STARTS WITH "I" EXCEPT IN THE CLOSING: Read the first word of every sentence. Any that starts with "I" must be restructured.

NO COMPANY ASSUMPTIONS: Every claim about the company can be traced to a specific line in the job description. If it cannot, remove it.

NO WEAKNESS ACKNOWLEDGMENT: The letter never references a gap, missing qualification, or anything the candidate lacks.

NO HALLUCINATION: Every metric and specific claim comes from the resume.

NO HOLLOW LANGUAGE: Every sentence earns its place. Nothing that could appear in any letter for any role.

NUMBER RANGES: Always written with a hyphen, never with "to." Write "150-200" not "150 to 200." Write "$500K-$1M" not "$500K to $1M." This applies everywhere in the letter.

NO FRAGMENTS: Read the sentences. All must be grammatically complete. Any fragment must be restructured before outputting.

NO REPEATED CONTENT: The opening paragraph sets up the argument. The bullets prove it. If a specific metric or achievement appears in the opening, it must not appear again in the bullets. State everything once, in the strongest place.

THE FINAL TEST: Read the letter as the hiring manager. Does this sound like someone I want to meet? Is every sentence earning its place? Does it answer the question "why this person for this role" with evidence, not enthusiasm? If not, find what is making it hollow and fix it before outputting.

═══════════════════════════════════════════════
SOURCE MATERIAL
═══════════════════════════════════════════════

RESUME DATA:
${JSON.stringify(resumeData, null, 2)}

TARGET ROLE: ${jobTitle}${jobCompany ? ` at ${jobCompany}` : ''}

JOB DESCRIPTION:
${jobDescription}

═══════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════

Return ONLY valid JSON. No markdown. No backticks. No explanation.

{
  "candidateName": "full name from resume",
  "email": "email from resume",
  "phone": "phone from resume",
  "location": "location from resume",
  "linkedin": "linkedin from resume or empty string",
 "date": "${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}",
  "companyName": "${jobCompany || 'company name'}",
  "jobTitle": "${jobTitle}",
  "opening": "the full opening paragraph as a single string — 3 sentences only",
  "bridge": "the single bridge sentence that opens the second paragraph",
  "bulletsIntro": "Highlights of how my experience aligns with this role include:",
  "recipientName": "Hiring Manager",
  "bullets": [
    "bullet 1 as a string",
    "bullet 2 as a string",
    "bullet 3 as a string"
  ],
  "closing": "the full two-sentence closing as a single string"
}`
}

export async function POST(request) {
  try {
    const { resumeData, jobTitle, jobCompany, jobDescription, userId } = await request.json()

    if (!resumeData || !jobDescription) {
      return NextResponse.json(
        { error: 'resumeData and jobDescription are required' },
        { status: 400 }
      )
    }

    // Free tier CL limit check
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier, cl_count')
      .eq('id', userId)
      .single()

    const isFree = !profile?.subscription_tier || profile?.subscription_tier === 'free'
    if (isFree && (profile?.cl_count ?? 0) >= 3) {
      return NextResponse.json({ error: 'CL_LIMIT_REACHED' }, { status: 403 })
    }

    const prompt = buildCoverLetterPrompt({ resumeData, jobTitle, jobCompany, jobDescription })

    let message
    let attempts = 0
    while (attempts < 3) {
      try {
        message = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }]
        })
        break
      } catch (err) {
        if (err.status === 529 && attempts < 2) {
          attempts++
          await new Promise(resolve => setTimeout(resolve, 2000 * attempts))
        } else {
          throw err
        }
      }
    }

    let raw = message.content[0].text.trim()
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('No JSON found in output:', raw)
      return NextResponse.json({ error: 'No JSON returned from model' }, { status: 500 })
    }
    let cleaned = jsonMatch[0]

    let coverLetterData
    try {
      coverLetterData = JSON.parse(cleaned)
    } catch (parseError) {
      console.error('JSON parse failed:', cleaned)
      return NextResponse.json({ error: 'Invalid JSON from model' }, { status: 500 })
    }

    const stripEmDashes = (str) => str ? str.replace(/\u2014/g, ', ') : str
    coverLetterData.opening = stripEmDashes(coverLetterData.opening)
    coverLetterData.closing = stripEmDashes(coverLetterData.closing)
    coverLetterData.bullets = coverLetterData.bullets?.map(stripEmDashes)

    if (isFree && userId) {
      await supabase
        .from('profiles')
        .update({ cl_count: (profile.cl_count ?? 0) + 1 })
        .eq('id', userId)
    }

    return NextResponse.json({ coverLetterData })

  } catch (error) {
    console.error('Cover letter generate error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}