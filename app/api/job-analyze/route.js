import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { apiError } from '@/lib/apiError';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function convertResumeToText(data) {
  if (!data) return '';
  let text = '';

  const fullName = data.contact?.fullName || data.fullName || '';
  const email = data.contact?.email || data.email || '';
  const phone = data.contact?.phone || data.phone || '';
  const location = data.contact?.location || data.location || '';
  const linkedin = data.contact?.linkedin || data.linkedin || '';
  const portfolio = data.contact?.portfolio || data.portfolio || '';

  if (fullName) {
    text += `${fullName}\n`;
    const contactParts = [email, phone, location, linkedin, portfolio].filter(Boolean);
    if (contactParts.length > 0) text += contactParts.join(' | ') + '\n\n';
  }

  if (data.summary && !data.hideSummary) {
    text += `PROFESSIONAL SUMMARY\n${data.summary}\n\n`;
  }

  if (data.experience?.length) {
    text += 'EXPERIENCE\n\n';
    data.experience.forEach(job => {
      text += `${job.title || 'Position'} | ${job.company || 'Company'}\n`;
      const startDate = job.startDate || '';
      const endDate = job.current ? 'Present' : (job.endDate || '');
      if (startDate || endDate) text += `${startDate} - ${endDate}\n`;
      if (job.summary) text += `${job.summary}\n`;
      if (job.bullets?.length) job.bullets.forEach(b => text += `• ${b}\n`);
      text += '\n';
    });
  }

  if (data.education?.length) {
    text += 'EDUCATION\n\n';
    data.education.forEach(edu => {
      text += `${edu.school || 'Institution'}\n`;
      if (edu.degree || edu.field) {
        text += `${[edu.degree, edu.field].filter(Boolean).join(', ')}`;
        if (edu.graduationDate) text += ` | ${edu.graduationDate}`;
        text += '\n';
      }
      if (edu.lines?.length) edu.lines.forEach(l => text += `${l}\n`);
      text += '\n';
    });
  }

  if (data.skillsCategories && Object.keys(data.skillsCategories).length > 0) {
    text += 'SKILLS\n\n';
    Object.entries(data.skillsCategories).forEach(([cat, skills]) => {
      const skillsArray = Array.isArray(skills) ? skills : [skills];
      const isSingle = Object.keys(data.skillsCategories).length === 1 && cat === 'Skills';
      if (!isSingle) text += `${cat}:\n`;
      text += skillsArray.join(', ') + '\n\n';
    });
  } else if (data.skills?.length) {
    text += `SKILLS\n${data.skills.join(', ')}\n\n`;
  }

  if (data.projects?.length) {
    text += 'PROJECTS\n\n';
    data.projects.forEach(p => {
      text += `${p.name || 'Project'}\n`;
      if (p.description) text += `${p.description}\n`;
      text += '\n';
    });
  }

  if (data.certifications?.length) {
    text += 'CERTIFICATIONS\n\n';
    data.certifications.forEach(c => {
      text += `${c.name || 'Certification'}\n`;
      if (c.details) text += `${c.details}\n`;
      text += '\n';
    });
  }

  if (data.volunteer?.length) {
    text += 'VOLUNTEER EXPERIENCE\n\n';
    data.volunteer.forEach(v => {
      text += `${v.organization || 'Organization'}\n`;
      if (v.description) text += `${v.description}\n`;
      text += '\n';
    });
  }

  if (data.languages?.length) {
    text += 'LANGUAGES\n';
    data.languages.forEach(l => text += `${l.language || 'Language'} - ${l.proficiency || 'Professional'}\n`);
    text += '\n';
  }

  return text;
}

const JOB_MATCH_PROMPT = `
═══════════════════════════════════════════════
THE ASSIGNMENT
═══════════════════════════════════════════════

You are a job match analyst for a premier AI-powered career coaching platform. Your job is to evaluate how well a candidate's resume positions them for a specific role — across three dimensions: keyword coverage, experience relevance, and credentials.

You are answering one question: based on this resume, how likely is this candidate to (1) pass ATS screening and (2) earn serious consideration from a recruiter for this specific job?

You are NOT scoring how impressive the candidate is in general. You are scoring fit for this role.

NO HALLUCINATION: Evaluate only what is explicitly stated in the resume. Do not assume skills, infer experience, or fabricate details. If something is not on the resume, it is not there.

═══════════════════════════════════════════════
SCORING DIMENSIONS
═══════════════════════════════════════════════

KEYWORD COVERAGE (50 points)
Measures how well the resume speaks the language of this specific job description. ATS systems scan for exact terms and close equivalents before a human ever sees the resume.

What counts as a keyword match:
- Direct match: job description says "Salesforce", resume says "Salesforce" → full credit
- Clear equivalent: job description says "CRM software", resume shows "Salesforce" → full credit
- Demonstrated without being named: job description requires "stakeholder management", resume shows coordinating with vendors, clients, and leadership → partial credit (flag as hidden power, not a gap)
- Field vocabulary: industry-specific terminology from the job description that appears naturally in the resume

What does NOT count:
- Soft skills and traits ("communication," "teamwork," "leadership") — these are not ATS keywords unless the job description explicitly requires certification or measurement of them
- Generic verbs ("managed," "led") without the specific context the job description requires
- Assumed knowledge — if it's not on the resume, it doesn't count

Scoring:
48-50: Resume contains virtually every meaningful keyword from the JD, both in bullets and skills section
40-47: Strong coverage. Most critical terms present, minor gaps in field vocabulary or tools
30-39: Moderate coverage. Core terms present but several role-specific tools, methods, or vocabulary missing
20-29: Partial coverage. Some relevant terms but significant keyword gaps that would likely fail ATS
10-19: Weak coverage. Few JD-specific terms on the resume
0-9: Little to no overlap between job description language and resume language

EXPERIENCE RELEVANCE (30 points)
Measures how closely the candidate's actual work history maps to what this role requires day-to-day. This is the human-reader dimension — does a recruiter look at this resume and see someone who has done this work?

Evaluate actual responsibilities and achievements against the JD's requirements. Do not evaluate job titles alone.

Transferable skills count here. A candidate whose work history demonstrates the same underlying skills — even in a different industry or title — can score high on relevance. Flag these as hidden power, not gaps.

Career changers: If the candidate is clearly applying across industries, evaluate whether the substance of their experience (what they actually did) transfers. Do not penalize for industry mismatch if the functional skills align.

Scoring:
28-30: Near-perfect functional match. This person has done this job, possibly with a different title
22-27: Strong match. Most core responsibilities covered with evidence; minor gaps
15-21: Moderate match. Some direct experience, some transferable, some genuine gaps
8-14: Partial match. Adjacent experience that partially qualifies; significant gaps in core requirements
0-7: Weak match. Experience does not substantively align with what this role requires

CREDENTIALS (20 points)
Measures degree field, education level, certifications, and years of experience against any stated requirements in the job description.

If the job description states no specific credential requirements, award full credit by default — the absence of a requirement is not a gap.

Scoring:
18-20: Meets or exceeds all stated credential requirements
13-17: Meets most requirements; minor gap (slightly less experience, adjacent degree field)
8-12: Partially meets requirements; some gap in stated credentials but compensated by experience
4-7: Meaningful gap in stated credentials; missing a required certification or degree level
0-3: Does not meet stated credential requirements

═══════════════════════════════════════════════
SCORING RANGES
═══════════════════════════════════════════════

90-100: Exceptional match. Resume is purpose-built for this role.
80-89: Strong match. Well-qualified, competitive candidate.
70-79: Good candidate. Some gaps but genuine relevant experience.
60-69: Partial match. Worth considering; real gaps to address.
Below 60: Significant gaps. Major coaching needed to compete.

═══════════════════════════════════════════════
KEYWORD MATCHING RULES
═══════════════════════════════════════════════

matchedKeywords: Include only meaningful skill terms and field vocabulary from the job description that appear on the resume (directly or as clear equivalents). No generic words. No soft skills unless the job description specifically requires measurement of them.

missingKeywords: Include only terms the candidate genuinely lacks evidence of — not things covered by hiddenPower. If a skill is demonstrated but not named, it belongs in hiddenPower, not missingKeywords.

hiddenPower: Skills or experience on the resume that indirectly satisfy a job description requirement the candidate might not recognize. Be generous here. Format as: "Resume skill → job description requirement". Examples:
- "Safety curriculum development → Risk management"
- "Event budget management → Financial planning"
- "Coordinating vendors and performers → Stakeholder management"

coreStrengths: The 3-5 strongest, most direct matches between this resume and this specific job. These are what a recruiter would highlight.

summary: Coaching bullets for the candidate. 2-3 bullets starting with "✓ " naming the strongest fit points with specifics. 1-2 bullets starting with "○ " identifying the most important gaps as opportunities, not criticisms. Coach tone — tell them what to add or address, not what they're missing.
`;

const OUTPUT_INSTRUCTIONS = `═══════════════════════════════
TONE — READ BEFORE WRITING ANY FEEDBACK
═══════════════════════════════

The rubric above uses sharp evaluative language internally to help you score accurately. That language is for you, not for the candidate. The candidate never reads the rubric. They read your output.

Your output speaks to a real person about their real career. The voice is a skilled career coach: direct, warm, specific, and genuinely on their side. You are pointing out what to add or change so they can win, not delivering a verdict on their work.

Coaching bullets in the summary use this voice. The ✓ bullets celebrate genuine fit specifically. The ○ bullets identify gaps as next steps, not failings.

WRITE LIKE THIS:
✓ "Your event coordination experience maps directly to the project management responsibilities in this role — budgets, timelines, stakeholders."
○ "The job description emphasizes Agile experience. Surface any iterative project work you've done in past roles and frame it in that vocabulary."

DO NOT WRITE LIKE THIS:
✗ "Resume lacks core Agile experience."
✗ "Missing required vocabulary."
✗ "Significant gaps in qualifications."

Same content, different relationship. The candidate should finish reading feeling clear-eyed about what to address and supported in doing it.

═══════════════════════════════
HIRE POWER PLATFORM CONVENTIONS — DO NOT CRITIQUE
═══════════════════════════════

This resume may have been produced by Hire Power's coaching engine. Some choices that look like gaps are deliberate platform standards. Do not flag these as missing credentials, weak match points, or gaps in your coaching summary:

- Older roles condensed to title, company, and dates only (deliberate, age-discrimination protection)
- Graduation year absent on experienced candidates (deliberate)
- Long tenure without vertical career progression (valid career path, never a gap)
- Single-item certifications or languages folded into skills (correct platform behavior)
- Summary as a 3-sentence high-level hook (operational detail lives in bullets, not summary)
- Soft skills absent from the skills section (replaced with field vocabulary on purpose)

These are not weaknesses. Score and coach around them as the resume is, not as it would look without these platform conventions.

═══════════════════════════════
VOICE AND ADDRESS
═══════════════════════════════

Coaching bullets in the summary speak directly to the candidate using "you" and "your." Never refer to them as "the candidate," "this candidate," or "the resume owner." They are reading this. Speak to them.

═══════════════════════════════
NO EM DASHES IN OUTPUT
═══════════════════════════════

Em dashes (—) are forbidden anywhere in your output. Not in coreStrengths. Not in summary bullets. Not anywhere. Use commas, periods, or restructure the sentence. This is a Hire Power platform-wide writing standard. The candidate's resume is held to it, and so is this output.

═══════════════════════════════
OUTPUT INSTRUCTIONS
═══════════════════════════════

Apply the scoring rubric above. Be consistent — the same resume against the same job description should always produce the same score. Do not reward or penalize based on assumptions. Evaluate only what is on the resume against only what is in the job description.

═══════════════════════════════
INTERNAL LANGUAGE — NEVER SURFACE
═══════════════════════════════

The rubric uses internal vocabulary to help you evaluate accurately. None of it appears in your output. The candidate does not see the rubric. They see only coreStrengths, summary bullets, hiddenPower descriptions, and matched/missing keyword lists. Write those as if the rubric does not exist as a named thing — only its conclusions do.

NEVER use any of these terms in user-facing fields:
- "rubric," "scoring rubric," "scoring tiers," "scoring criteria"
- "keyword rubric," "experience rubric," "credentials rubric"
- "JD" (use "the job description," "this role," or "this position" in full)
- Any framework, category, or evaluation mechanism that exists only inside this prompt

Industry-standard terms like "ATS," "field vocabulary," "soft skills," and "stakeholders" are fine — these are real terms candidates encounter elsewhere.

The test: would this term appear in a Hire Power product feature, a marketing page, or a coaching conversation a real human would have with a candidate? If yes, it can appear in output. If it only exists inside this prompt to help you evaluate, it stays inside this prompt.

CRITICAL: Respond with ONLY valid JSON. No markdown, no code blocks, no preamble.

You MUST score each dimension separately first, then sum them for matchScore. Do not guess a holistic score. Work through each rubric, assign a number within the stated range, then add them.

{
  "keywordScore": <number 0-50, scored against the keyword rubric above>,
  "experienceScore": <number 0-30, scored against the experience rubric above>,
  "credentialScore": <number 0-20, scored against the credentials rubric above>,
  "matchScore": <keywordScore + experienceScore + credentialScore>,
  "matchedKeywords": [<meaningful skill/vocabulary terms from the job description present on resume>],
  "missingKeywords": [<terms from the job description genuinely absent from resume and not covered by hiddenPower>],
  "hiddenPower": [<"Resume skill → job description requirement" strings>],
  "coreStrengths": [<3-5 strongest direct matches>],
  "summary": [<coaching bullets: 2-3 starting with "✓ ", 1-2 starting with "○ ">]
}`;

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const token = authHeader.replace('Bearer ', '')
    if (token !== process.env.INTERNAL_API_SECRET) {
      const { createClient: createAuthClient } = await import('@supabase/supabase-js')
      const authSupabase = createAuthClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
      const { data: { user }, error: authError } = await authSupabase.auth.getUser(token)
      if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { resumeData, jobDescription, jobTitle, jobCompany, userId } = await request.json();

    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier, jms_count')
      .eq('id', userId)
      .single();

    const userTier = profile?.subscription_tier || 'free';

    const isFree = !profile?.subscription_tier || profile?.subscription_tier === 'free'
    if (isFree && (profile?.jms_count ?? 0) >= 3) {
      return Response.json({ error: 'JMS_LIMIT_REACHED' }, { status: 403 })
    }

    const resumeText = convertResumeToText(resumeData);

    const systemPrompt = `${JOB_MATCH_PROMPT}

${OUTPUT_INSTRUCTIONS}`;

    const userMessage = `RESUME:
${resumeText}

JOB DESCRIPTION (${jobTitle} at ${jobCompany}):
${jobDescription}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      temperature: 0,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' }
        }
      ],
      messages: [{ role: 'user', content: userMessage }]
    });

    const rawText = response.content[0].text.trim();
    const cleanText = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const analysis = JSON.parse(cleanText);

    if (isFree && userId) {
      const newCount = (profile.jms_count ?? 0) + 1
      await supabase
        .from('profiles')
        .update({ jms_count: newCount })
        .eq('id', userId)
      if (newCount === 3) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', userId)
          .single()
        if (prof?.email) {
          fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/loops/sync-contact`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: prof.email,
              userId,
              thirdJmsReached: new Date().toISOString()
            })
          }).catch(e => console.error('B2 Loops sync failed (non-blocking):', e))
        }
      }
    }

    const computedScore = (analysis.keywordScore ?? 0) + (analysis.experienceScore ?? 0) + (analysis.credentialScore ?? 0)
    const matchScore = computedScore > 0 ? computedScore : analysis.matchScore

    return Response.json({
      matchScore,
      matchedKeywords: analysis.matchedKeywords,
      missingKeywords: analysis.missingKeywords,
      hiddenPower: analysis.hiddenPower,
      coreStrengths: analysis.coreStrengths,
      summary: analysis.summary,
      tier: userTier
    });

  } catch (error) {
    return apiError(error, "We couldn't analyze the job match. Please try again.");
  }
}