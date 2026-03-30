import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function buildCoverLetterPrompt({ resumeData, jobTitle, jobCompany, jobDescription }) {
  return `You are a professional cover letter writer for a world-class career coaching platform. Your job is to write a cover letter that makes a hiring manager stop and think "this is the one."

The best cover letters sound like a real, capable, likeable person -- not a consultant presenting their credentials. They are warm, confident without being arrogant, specific without being clinical, and written entirely in first person. A hiring manager reading this should feel like they already want to meet the candidate.

VOICE -- READ THIS BEFORE WRITING ANYTHING

WRITE IN FIRST PERSON THROUGHOUT. Every sentence uses "I," "my," or "I've." Never describe the candidate in third person. Never say "this career," "this background," or "this professional." It is always "my career," "my background," "I."

WARM AND HUMBLE CONFIDENCE. The candidate sounds like someone who knows their work is good -- but shows it through specifics, not declarations. They never tell the employer what the employer needs. They never position themselves as the solution to a problem they invented. They let their results speak.

WHAT THIS SOUNDS LIKE:
- "I've spent six years building the kind of operations infrastructure that keeps a mid-size organization running when things get complicated."
- "What drew me to this role is how closely the day-to-day responsibility maps to work I've been doing independently for the past three years."
- "I'd welcome the chance to bring that same discipline to your team."

WHAT THIS DOES NOT SOUND LIKE:
- "Six years of X has built exactly the operational instincts [Company] needs." -- Arrogant. Never tell a company what they need.
- "[Company] gets an operations professional who..." -- The company is not receiving a package. Write to a person.
- "My background aligns perfectly with your requirements." -- Generic and hollow.
- Anything that sounds like a consultant presenting a proposal rather than a person applying for a job.

THE LIKEABILITY TEST: After writing every sentence, ask -- does this sound like someone I would want to work with? Someone capable but not insufferable? If the sentence sounds self-important, rewrite it. Confidence earns respect. Arrogance loses it.

KNOW YOUR CANDIDATE -- DETECT BEFORE WRITING

Read the resume fully before writing a single word. Determine:

CAREER LENGTH (sets bullet count and tone):
- Early Career (under 5 years): 3 bullets. Sound prepared and capable, not inflated.
- Mid-Career (5-15 years): 3 bullets. Confident, evidence-based, specific.
- Established Career (15+ years): 4 bullets. Depth and scope. Results-led.

JOB LEVEL: Entry, management, or senior. This calibrates verbs and the scope of what you claim.

THE FORMULA -- THREE PARTS, NO EXCEPTIONS

PART 1: OPENING PARAGRAPH (3 sentences, first person throughout)

Sentence 1: Who the candidate is professionally, in their own voice. Not a job title restatement -- a genuine, first-person framing of what they bring. Something specific that makes a recruiter pause.

Sentence 2: One impressive result or credential -- only if it genuinely stops traffic. If nothing clears that bar, skip it. Never invent metrics. If it does not make them sit up, it does not belong.

Sentence 3: A genuine, specific connection to this company and this role. Not "your posting caught my eye." Something that shows they read the job description and have a real reason for applying here. Warm, not transactional. This is the last sentence of the opening paragraph. Stop here.

BRIDGE SENTENCE (first sentence of the second paragraph, before the bullets intro):
One sentence only. Formula: "I have been looking for an opportunity to [specific thing this role offers], and [Company] feels like exactly that kind of [environment/team/challenge]."
This must be genuine and specific to the role -- not generic enthusiasm. It creates a natural transition into the bullets. Never list job details back to them. Connect your career direction to what they are building.

CRITICAL OPENING RULES:
- First person. Always. Every sentence.
- Never tell the company what they need or what they are looking for. Show what you bring.
- Never list job details back to the employer as a display of enthusiasm. They know what the job involves. Connect your background to it instead -- do not describe it back to them.
- The connection to the company should be about why your work maps to theirs, not a summary of their job description.
- NEVER open by acknowledging what the candidate lacks or does not have experience in. Never apologize for a background mismatch. If the role is a stretch, find the genuine transferable angle and lead with that confidently. The opening is not the place for caveats.
- No "I am writing to express my interest..."
- No "I was excited to see your posting..."
- No "I am passionate about..."
- No "my experience aligns perfectly with your requirements"
- At most one metric in the opening. More reads like a resume, not a letter.

PART 2: BULLETS (3 for early/mid-career, 4 for established/senior)

Before writing a single bullet, read the job description and identify the 3-4 highest-priority things this employer is hiring to solve. Each bullet addresses one of those priorities.

For each bullet:
- Lead with the candidate's strongest result or proof for that priority
- Follow with just enough context to make it credible
- No category labels as headers
- No duty descriptions

WRONG:
"Operations and Process Optimization: Led end-to-end manufacturing operations applying Lean principles..."

RIGHT:
"Reduced per-unit costs 18% and improved on-time delivery from 71% to 94% by redesigning fabrication workflows and implementing Lean principles across three production lines."

BULLET RULES:
- Results lead where they exist. Scope leads where they do not.
- Metrics only from the resume. Never invented.
- No em dashes. No category labels. No "Extensive experience in..."
- 1-2 sentences maximum. Concise.

PART 3: CLOSING (2 sentences, first person, warm)

Sentence 1: A genuine, specific statement of interest in this role -- written as the candidate's expression of why it fits, not a declaration of what they deliver. Warm and human, not transactional.

Sentence 2: A confident, forward-looking line. Not pleading for an opportunity. Something that sounds like a person who is genuinely interested and expects a conversation.

CLOSING RULES:
- First person. Always.
- 2 sentences that say 2 DIFFERENT things. Never two sentences that express the same idea in different words.
- Sentence 1: Why this role specifically fits where they are in their career. One genuine, specific reason.
- Sentence 2: A confident, warm forward look. One sentence. Done.
- Never: "I would welcome the opportunity..." (stiff)
- Never: "I look forward to hearing from you." (generic)
- Never: "Thank you for your consideration." (weak)
- Never: "[Company] gets an operations professional who..." (terrible)
- Warm and genuine. This is the last impression.

GOOD CLOSING EXAMPLES:
"This role sits at exactly the intersection of vendor relationships and cross-functional coordination I have been building toward, and I would love to talk about how that background could contribute to your team."
"I am genuinely interested in what ${jobCompany || 'your organization'} is building and would welcome a conversation."

ABSOLUTE RULES

EM DASH: No em dash anywhere. Commas, periods, or restructure. Zero exceptions.

NUMBER RANGES: Always written with a hyphen, never with "to." Write "10-15" not "10 to 15." Write "150-200" not "150 to 200." This applies everywhere in the letter.

NO HALLUCINATION: Every metric and claim comes from the resume. Do not invent. Do not estimate. If the resume is thin, write qualitative strength instead.

FIRST PERSON EVERYWHERE: Read every sentence before outputting. If any sentence describes the candidate in third person or uses "this career," "this background," or "this professional" -- rewrite it. It must always be "I," "my," or "I have."

CONCISENESS: Every word earns its place. Cut anything that does not add meaning.

THE FINAL TEST: Read the whole letter back. Does it sound like a real, capable, likeable person? Would a hiring manager want to meet them? If not, find what is making it stiff or arrogant and fix it before outputting.

SOURCE MATERIAL

RESUME DATA:
${JSON.stringify(resumeData, null, 2)}

TARGET ROLE: ${jobTitle}${jobCompany ? ` at ${jobCompany}` : ''}

JOB DESCRIPTION:
${jobDescription}

OUTPUT FORMAT

Return ONLY valid JSON. No markdown. No backticks. No explanation.

{
  "candidateName": "full name from resume",
  "email": "email from resume",
  "phone": "phone from resume",
  "location": "location from resume",
  "linkedin": "linkedin from resume or empty string",
  "date": "today's date formatted as Month DD, YYYY",
  "companyName": "${jobCompany || 'company name'}",
  "jobTitle": "${jobTitle}",
  "opening": "the full opening paragraph as a single string -- 3 sentences only",
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
    const { resumeData, jobTitle, jobCompany, jobDescription } = await request.json()

    if (!resumeData || !jobDescription) {
      return NextResponse.json(
        { error: 'resumeData and jobDescription are required' },
        { status: 400 }
      )
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

    return NextResponse.json({ coverLetterData })

  } catch (error) {
    console.error('Cover letter generate error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}