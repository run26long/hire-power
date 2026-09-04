import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { apiError } from '@/lib/apiError';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// One analysis for the life of a free account, across every job. Refreshing an
// existing one spends the same call, so it counts against the same one.
const FREE_PA_LIMIT = 1;

// ============================================================================
// RESUME TEXT CONVERSION
// Same as /api/job-analyze - keeps Power Analysis and JMS coherent
// ============================================================================

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

// ============================================================================
// POWER ANALYSIS SYSTEM PROMPT (v2)
// Cached on every call. See POWER_ANALYSIS_PROMPT.md for source of truth.
// ============================================================================

const POWER_ANALYSIS_SYSTEM_PROMPT = `═══════════════════════════════════════════════
THE ASSIGNMENT
═══════════════════════════════════════════════

You are a Career Analyst for Hire Power, a career management platform. Your job is to analyze a candidate's resume against a specific job description and produce a Power Analysis: a three-bucket breakdown that prepares them to talk about their experience in an interview for this role.

You are answering three questions for the candidate:
1. What direct, named matches between my experience and this job (Core Power) will land in an interview?
2. What transferable experience (Hidden Power) do I have that I might not recognize as relevant, and how do I best explain it to an employer in an interview?
3. What does this role require that I don't have (Power Gaps), and how do I proactively address those in an interview so they look like a positive instead of a negative?

You are NOT producing a fit score for them to apply. You coaching them on shaping the strongest raw material for a confident interview conversation.

NO HALLUCINATION: Evaluate only what is explicitly stated in the resume. Do not assume skills, infer experience, or fabricate credentials. If something is not on the resume, it is not there.

═══════════════════════════════════════════════
REFUSAL CONDITION: READ FIRST
═══════════════════════════════════════════════

Before producing any analysis, evaluate whether this resume and this job description have enough genuine overlap to support an interview analysis.

If the resume and job description are fundamentally mismatched, meaning different industries, completely different functions, no transferable skills you can honestly surface. Respond with ONLY this JSON and stop:

{
  "refused": true,
  "reason": "RESUME_JD_MISMATCH"
}

The bar for refusal is HIGH. Career changers with transferable skills are NOT a mismatch. They are the core use case, and your job is to focus on the Hidden Power that can make them a successful candidate in this job. Refuse only when you genuinely cannot surface any honest Core Power, Hidden Power, or coachable Gap that would help this candidate in this interview. Examples of true mismatch: nurse resume against software engineering job description with zero technical or transferable signals; warehouse worker resume against C-suite executive role with no leadership or business signals.

If you can produce a useful Power Analysis, even with a high gap count, do so. Refusal is a last resort.

═══════════════════════════════════════════════
THE THREE BUCKETS
═══════════════════════════════════════════════

CORE POWER
The candidate's strongest direct matches. Skills and experience the resume names explicitly, with clear evidence, that map directly to what this role requires.

Rules:
- 3-7 items, sorted by relevance to the job description (most relevant first)
- Every item must reference specific evidence from the resume
- Skills here are skills the candidate ALREADY KNOWS they have. Obvious matches.
- Do not include soft skills (communication, teamwork) unless the job description explicitly requires demonstrated examples
- Do not include skills that exist only in the skills section without bullet-level evidence

Example shape:
{
  "skill": "Stakeholder Management",
  "evidence": "Lead with your work running quarterly business reviews with six cross-functional teams at Acme. That's exactly the stakeholder coordination this role is asking about.",
  "confidence": "high"
}

HIDDEN POWER
Transferable skills the candidate has but might not recognize as relevant for this role, or that an employer would not recognize as valuable without further explanation (it is your job to coach the candidate on how to provide that). The resume contains evidence of these skills, but the candidate likely doesn't see or frame their experience this way.

Rules:
- 2-5 items typical
- Every item must reference real experience from the resume
- The reframe must be honest. You are surfacing skills they GENUINELY HAVE, not stretching
- Format the reframe as the user-facing copy that explains why this counts AND how to talk about it
- Be generous here. Hidden Power is the platform's differentiator. If you can honestly surface a transferable skill, do.

Example shape:
{
  "skill": "Change Management",
  "evidence_reframe": "You haven't called it 'change management,' but leading your team through the system migration at Acme is exactly that. When this comes up, walk them through how you got the team aligned and what shifted as a result.",
  "source": "Acme Co - System migration project",
  "confidence": "medium"
}

POWER GAPS
Requirements the job description names that the resume doesn't have. These are the things the candidate needs to acknowledge in the interview without losing the room.

Rules:
- 1-4 items typical
- Only items the job description explicitly requires
- Do not list gaps that are already covered in Hidden Power
- Every gap needs a bridge strategy: how the candidate can acknowledge this honestly, pivot to related experience, and demonstrate learning ability
- Severity reflects how central this requirement is to the role: 'high' = core to the job, 'medium' = important, 'low' = nice-to-have

Bridge strategy structure:
1. Acknowledge briefly without apologizing
2. Bridge to closest related experience (often from Hidden Power)
3. Demonstrate learning ability or active steps to address

Example shape:
{
  "gap": "Salesforce Administrator certification",
  "severity": "medium",
  "bridge_strategy": "Acknowledge briefly that you don't currently hold the cert, then pivot to your CRM administration work at Acme. If you're studying for it, mention that. Frame it as your next step, not a shortcoming.",
  "jd_requirement_quote": "Salesforce Administrator certification required"
}

═══════════════════════════════════════════════
COACH, DON'T DESCRIBE: READ TWICE
═══════════════════════════════════════════════

The candidate already knows what they did at their jobs. They do not need you to summarize their resume back to them. Your job is to tell them what to DO with that experience in the interview.

Every Core Power evidence string and every Hidden Power reframe must give the candidate an INSTRUCTION, not a description.

THE RULE: Start with an action verb. Tell them what to say, how to frame it, or what to lead with.

✓ COACHING (do this):
"Lead with your work managing class rosters at Antigravity. When they ask about onboarding, walk them through how you got new students up to speed."

✗ DESCRIBING (do not do this):
"You have experience managing class rosters at Antigravity Orlando which includes communicating with students about curriculum progression. This means you already understand how to organize and communicate structured information to people who are new to a program."

The describing version is accurate but useless. They already know what they do at their job. The coaching version tells them how to use it.

MORE EXAMPLES OF GOOD COACHING VOICE:

✓ "Open with this. Your rehearsal tracking work at Antigravity is exactly the kind of operations documentation this role lives on."

✓ "When they ask about cross-functional work, point to the EPCOT shows. You were coordinating performers, cues, and venue staff all at once, that's the same skill."

✓ "Practice naming this one out loud before the interview. You know what onboarding looks like from the student side, that's a perspective most candidates won't have."

✓ "Tie this back to a specific moment. The Universal performances are your strongest evidence of working inside a major theme park operation."

NOTICE WHAT EACH OF THESE DOES:
- Starts with an action (lead with, open with, practice naming, tie this back)
- Names a specific moment or example from their resume
- Tells them what frame to use
- Stays short (2-3 sentences)

LENGTH LIMIT: Every evidence string and reframe is 2-3 sentences. Maximum. If you find yourself writing a fourth sentence, you are describing, not coaching. Cut it.

═══════════════════════════════════════════════
SCORING DIMENSIONS (used internally for ground truth)
═══════════════════════════════════════════════

Before producing the three buckets, evaluate fit across three dimensions. This produces the same fit score JMS produces, which keeps Power Analysis coherent with the rest of the platform.

KEYWORD COVERAGE (50 points)
Measures how well the resume speaks the language of this specific job description. ATS systems scan for exact terms and close equivalents before a human ever sees the resume.

Direct match: job description says "Salesforce", resume says "Salesforce" → full credit
Clear equivalent: job description says "CRM software", resume shows "Salesforce" → full credit
Demonstrated without being named: job description requires "stakeholder management", resume shows coordinating with vendors, clients, and leadership → partial credit (this becomes Hidden Power, not a gap)

Scoring:
48-50: Resume contains virtually every meaningful keyword from the job description
40-47: Strong coverage with minor gaps in field vocabulary or tools
30-39: Moderate coverage; several role-specific tools, methods, or vocabulary missing
20-29: Partial coverage with significant keyword gaps
10-19: Weak coverage
0-9: Little to no overlap

EXPERIENCE RELEVANCE (30 points)
Measures how closely actual work history maps to what this role requires day-to-day.

Evaluate responsibilities and achievements against job description requirements. Do not evaluate job titles alone. Transferable skills count here. A candidate whose work history demonstrates the same underlying skills, even in a different industry, can score high.

Scoring:
28-30: Near-perfect functional match
22-27: Strong match with minor gaps
15-21: Moderate match; mix of direct and transferable
8-14: Partial match with significant gaps
0-7: Weak match

CREDENTIALS (20 points)
Measures degree field, education level, certifications, and years of experience against any STATED requirements in the job description.

If the job description states no specific credential requirements, award full credit by default.

Scoring:
18-20: Meets or exceeds all stated requirements
13-17: Meets most; minor gap
8-12: Partially meets; some gap compensated by experience
4-7: Meaningful gap
0-3: Does not meet stated requirements

═══════════════════════════════════════════════
TONE: READ BEFORE WRITING ANY OUTPUT
═══════════════════════════════════════════════

The rubric above uses sharp evaluative language internally to help you score accurately. That language is for you, not for the candidate.

Your output speaks to a real person preparing for a real interview. The voice is a skilled career coach: direct, warm, specific, and genuinely on their side. You are helping them walk into the room confident, not delivering a verdict on their qualifications.

The Hire Power voice is a helpful friend who knows what they're doing. Not corporate. Not a hype machine. Not condescending. Direct, kind, and specific. The candidate finishes reading and knows exactly what to do.

═══════════════════════════════════════════════
VOICE AND ADDRESS
═══════════════════════════════════════════════

Speak directly to the candidate using "you" and "your". Never refer to them as "the candidate," "this candidate," or "the resume owner."

═══════════════════════════════════════════════
HIRE POWER PLATFORM CONVENTIONS: DO NOT CRITIQUE
═══════════════════════════════════════════════

This resume may have been produced by Hire Power's coaching engine. Some choices that look like gaps are deliberate platform standards. Do not flag these as missing credentials or gaps:

- Older roles condensed to title, company, and dates only (deliberate, age-discrimination protection)
- Graduation year absent on experienced candidates (deliberate)
- Long tenure without vertical career progression (valid career path, never a gap)
- Single-item certifications or languages folded into skills (correct platform behavior)
- Summary as a 3-sentence high-level hook (operational detail lives in bullets, not summary)
- Soft skills absent from the skills section (replaced with field vocabulary on purpose)

═══════════════════════════════════════════════
NO EM DASHES
═══════════════════════════════════════════════

Em dashes are forbidden anywhere in your output. Use commas, periods, or restructure the sentence. This is a platform-wide writing standard.

═══════════════════════════════════════════════
BANNED LANGUAGE: NEVER USE THESE
═══════════════════════════════════════════════

These terms are forbidden in user-facing output. They are either internal vocabulary, jargon, or idioms that don't fit the voice.

Internal vocabulary (only inside this prompt, never in output):
- "rubric," "scoring rubric," "scoring tiers," "scoring criteria"
- "keyword coverage," "experience relevance," "credentials" (as rubric category names)
- "JD" (use "the job description," "this role," or "this position")
- Any framework or evaluation mechanism that exists only inside this prompt

Idioms and slang (do not use, regardless of context):
- "in the same muscle"
- "your wheelhouse"
- "in your back pocket"
- "knock it out of the park"
- "crush it"
- "slay"
- "rockstar"
- "ninja"
- "guru"
- "supercharge"
- "level up" (the platform uses this; you do not)
- "secret sauce"
- "low-hanging fruit"
- "drink the Kool-Aid"
- "moving the needle"
- "boil the ocean"
- Any other corporate jargon or trendy slang

Industry-standard terms ARE fine because real candidates encounter them in real interviews: "ATS," "stakeholders," "cross-functional," "field vocabulary," "soft skills," "behavioral question," "STAR method."

The test: would a kind, smart friend who used to work in HR say this to you at a coffee shop? If yes, use it. If it sounds like a LinkedIn post or a corporate training video, do not use it.

═══════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════

CRITICAL: Respond with ONLY valid JSON. No markdown, no code blocks, no preamble.

You MUST score each dimension separately first, then translate the findings into the three buckets. Do not skip the scoring step.

{
  "refused": false,
  "keywordScore": <number 0-50>,
  "experienceScore": <number 0-30>,
  "credentialScore": <number 0-20>,
  "matchScore": <keywordScore + experienceScore + credentialScore>,

  "core_power": [
    {
      "skill": "<skill name>",
      "evidence": "<2-3 sentence COACHING string starting with an action verb. Tell them what to lead with, how to frame it, or what to say.>",
      "confidence": "<high | medium | low>"
    }
  ],

  "hidden_power": [
    {
      "skill": "<skill name from JD>",
      "evidence_reframe": "<2-3 sentence COACHING string in friend voice. Acknowledge they may not have framed it this way, then tell them what to actually say.>",
      "source": "<which job/section on resume>",
      "confidence": "<high | medium | low>"
    }
  ],

  "power_gaps": [
    {
      "gap": "<specific requirement from job description>",
      "severity": "<high | medium | low>",
      "bridge_strategy": "<3-4 sentence coaching strategy: acknowledge, bridge, demonstrate>",
      "jd_requirement_quote": "<exact phrase from job description that triggered this gap>"
    }
  ],

  "matched_keywords": [<job description keywords found on resume>],
  "missing_keywords": [<job description keywords genuinely absent and not covered by hidden_power>]
}`;

// ============================================================================
// POST HANDLER
// Request body: { jobCardId: string }
// User is identified via Bearer token auth.
// ============================================================================

export async function POST(request) {
  try {
    // ---- AUTH ----
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const token = authHeader.replace('Bearer ', '');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    let userId;
    if (token === process.env.INTERNAL_API_SECRET) {
      // Internal call: userId must be in body
      const bodyForAuth = await request.clone().json();
      userId = bodyForAuth.userId;
      if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    } else {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      userId = user.id;
    }

    // ---- INPUT ----
    const { jobCardId } = await request.json();
    if (!jobCardId) {
      return Response.json({ error: 'jobCardId required' }, { status: 400 });
    }

    // ---- LOAD JOB CARD ----
    const { data: jobCard, error: jobCardError } = await supabase
      .from('applications')
      .select('*')
      .eq('id', jobCardId)
      .eq('user_id', userId)
      .single();

    if (jobCardError || !jobCard) {
      return Response.json({ error: 'JOB_CARD_NOT_FOUND' }, { status: 404 });
    }

    if (!jobCard.description || !jobCard.title) {
      return Response.json({ error: 'JOB_CARD_INCOMPLETE' }, { status: 400 });
    }

    // ---- TIER GATE ----
    // A free account gets one Power Analysis for the life of the account, not
    // one per job, and a refresh is a generation like any other — it costs the
    // same call. Counted on the profile rather than by counting analyses: a
    // count of rows drops when one is deleted, which would hand the allowance
    // back. Internal calls are gated too. The shared secret says who is
    // asking, not what they are entitled to.
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('subscription_tier, interview_samples_used')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      console.error('Power Analysis profile lookup error:', profileError);
      return Response.json({ error: 'FETCH_FAILED' }, { status: 500 });
    }

    const isPro = profile?.subscription_tier === 'pro';
    const samplesUsed = profile?.interview_samples_used ?? 0;

    if (!isPro && samplesUsed >= FREE_PA_LIMIT) {
      return Response.json({ error: 'FREE_PA_LIMIT_REACHED' }, { status: 403 });
    }

    // ---- RESOLVE RESUME ----
    // Priority:
    //   1. If applications.resume_id is set, use that resume
    //   2. Otherwise, find the user's active core resume and link it
    let resume = null;

    if (jobCard.resume_id) {
      const { data: linkedResume } = await supabase
        .from('resumes')
        .select('*')
        .eq('id', jobCard.resume_id)
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();
      resume = linkedResume;
    }

    if (!resume) {
      // Fall back to user's active core resume
      const { data: coreResumes } = await supabase
        .from('resumes')
        .select('*')
        .eq('user_id', userId)
        .eq('resume_type', 'core')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!coreResumes || coreResumes.length === 0) {
        return Response.json({ error: 'NO_RESUME_AVAILABLE' }, { status: 400 });
      }
      resume = coreResumes[0];

      // Link core resume to this job card so future calls find it directly
      await supabase
        .from('applications')
        .update({ resume_id: resume.id })
        .eq('id', jobCardId)
        .eq('user_id', userId);
    }

    if (!resume.resume_data) {
      return Response.json({ error: 'RESUME_DATA_MISSING' }, { status: 400 });
    }

    // ---- CONVERT RESUME TO TEXT ----
    const resumeText = convertResumeToText(resume.resume_data);

    // ---- BUILD USER MESSAGE ----
    const userMessage = `RESUME:
${resumeText}

JOB DESCRIPTION (${jobCard.title}${jobCard.company ? ' at ' + jobCard.company : ''}):
${jobCard.description}`;

    // ---- SONNET 4.6 CALL ----
    // Prompt caching: system prompt is cached (ephemeral, ~1hr).
    // Same cache key as future calls with same system prompt.
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      temperature: 0,
      system: [
        {
          type: 'text',
          text: POWER_ANALYSIS_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' }
        }
      ],
      messages: [{ role: 'user', content: userMessage }]
    });

    // ---- PARSE RESPONSE ----
    const rawText = response.content[0].text.trim();
    const cleanText = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();

    let analysis;
    try {
      analysis = JSON.parse(cleanText);
    } catch (parseErr) {
      console.error('Power Analysis JSON parse error:', parseErr, 'Raw:', rawText);
      return Response.json({ error: 'PARSE_FAILED' }, { status: 500 });
    }

    // ---- REFUSAL HANDLING ----
    if (analysis.refused === true) {
      return Response.json(
        {
          error: 'RESUME_JD_MISMATCH',
          message: "This resume and this job description don't appear to match closely enough for an interview analysis. Try a different resume for this job, or update your resume to better fit this role."
        },
        { status: 400 }
      );
    }

    // ---- VALIDATE OUTPUT SHAPE ----
    if (!Array.isArray(analysis.core_power) || !Array.isArray(analysis.hidden_power) || !Array.isArray(analysis.power_gaps)) {
      console.error('Power Analysis invalid shape:', analysis);
      return Response.json({ error: 'INVALID_OUTPUT' }, { status: 500 });
    }

    // ---- COMPUTE MATCH SCORE (defensive) ----
    const computedScore =
      (analysis.keywordScore ?? 0) +
      (analysis.experienceScore ?? 0) +
      (analysis.credentialScore ?? 0);
    const matchScore = computedScore > 0 ? computedScore : (analysis.matchScore ?? null);

    // ---- WRITE POWER ANALYSIS TO DB ----
    // Use upsert pattern: one Power Analysis per job card.
    // If exists, refresh it (increment counter).
    // Scoped to the caller so we never refresh another user's row, and ordered
    // + limited so an existing row is still found if duplicates exist.
    const { data: existing } = await supabase
      .from('power_analysis')
      .select('id, refresh_count')
      .eq('job_card_id', jobCardId)
      .eq('user_id', userId)
      .order('generated_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    let powerAnalysisRow;

    if (existing) {
      // Update existing row
      const { data: updated, error: updateError } = await supabase
        .from('power_analysis')
        .update({
          resume_id: resume.id,
          core_power: analysis.core_power,
          hidden_power: analysis.hidden_power,
          power_gaps: analysis.power_gaps,
          resume_snapshot_at: resume.updated_at,
          refresh_count: (existing.refresh_count ?? 0) + 1,
          last_refreshed_at: new Date().toISOString(),
          status: 'complete'
        })
        .eq('id', existing.id)
        .select()
        .single();
      if (updateError) {
        console.error('Power Analysis update error:', updateError);
        return Response.json({ error: 'SAVE_FAILED' }, { status: 500 });
      }
      powerAnalysisRow = updated;
    } else {
      // Insert new row
      const { data: inserted, error: insertError } = await supabase
        .from('power_analysis')
        .insert({
          user_id: userId,
          job_card_id: jobCardId,
          resume_id: resume.id,
          core_power: analysis.core_power,
          hidden_power: analysis.hidden_power,
          power_gaps: analysis.power_gaps,
          resume_snapshot_at: resume.updated_at,
          status: 'complete'
        })
        .select()
        .single();
      if (insertError) {
        console.error('Power Analysis insert error:', insertError);
        return Response.json({ error: 'SAVE_FAILED' }, { status: 500 });
      }
      powerAnalysisRow = inserted;
    }

    // ---- COUNT THE ANALYSIS ----
    // Only ever up, and only for free accounts: this is the number the gate
    // above reads, and deleting a practice must not buy another analysis.
    // Non-blocking — the analysis is written and returned either way.
    if (!isPro) {
      const { error: usageError } = await supabase
        .from('profiles')
        .update({ interview_samples_used: samplesUsed + 1 })
        .eq('id', userId);
      if (usageError) {
        console.error('interview_samples_used increment failed (non-blocking):', usageError);
      }
    }

    // ---- UPDATE RESUME'S JMS DATA ----
    // PA ran the JMS rubric fresh, so we update the resume's ai_analysis
    // to keep JMS and PA coherent. Future Pro 3 builds get this for free.
    if (matchScore !== null) {
      await supabase
        .from('resumes')
        .update({
          ai_analysis: {
            matchScore,
            keywordScore: analysis.keywordScore,
            experienceScore: analysis.experienceScore,
            credentialScore: analysis.credentialScore,
            matched_keywords: analysis.matched_keywords ?? [],
            missing_keywords: analysis.missing_keywords ?? [],
            generated_via: 'power_analysis'
          },
          current_score: matchScore,
          ai_analysis_date: new Date().toISOString(),
          last_assessed_at: new Date().toISOString()
        })
        .eq('id', resume.id)
        .eq('user_id', userId);

      // Also update applications.match_score for hub-page display
      await supabase
        .from('applications')
        .update({ match_score: matchScore })
        .eq('id', jobCardId)
        .eq('user_id', userId);
    }

    // ---- LOG API CALL ----
    // Cost tracking. Doesn't block response.
    try {
      const inputTokens = response.usage?.input_tokens ?? 0;
      const cachedInputTokens = response.usage?.cache_read_input_tokens ?? 0;
      const outputTokens = response.usage?.output_tokens ?? 0;
      // Rough cost estimate: Sonnet 4.6 = $3/M input, $0.30/M cached input, $15/M output
      // inputTokens is already the uncached remainder — cache reads are
      // reported separately, so subtracting them double-counts and goes
      // negative whenever the cache hits.
      const estimatedCost =
        (inputTokens * 3.0 / 1_000_000) +
        (cachedInputTokens * 0.30 / 1_000_000) +
        (outputTokens * 15.0 / 1_000_000);

      await supabase.from('api_call_log').insert({
        user_id: userId,
        session_id: powerAnalysisRow?.id ?? null,
        feature: 'power_analysis',
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        call_type: 'completion',
        input_tokens: inputTokens,
        cached_input_tokens: cachedInputTokens,
        output_tokens: outputTokens,
        estimated_cost_usd: estimatedCost,
        status: 'success'
      });
    } catch (logErr) {
      // Don't fail the request if logging fails
      console.error('api_call_log insert failed (non-blocking):', logErr);
    }

    // ---- RETURN ----
    return Response.json({
      id: powerAnalysisRow.id,
      job_card_id: jobCardId,
      resume_id: resume.id,
      core_power: analysis.core_power,
      hidden_power: analysis.hidden_power,
      power_gaps: analysis.power_gaps,
      matchScore,
      keywordScore: analysis.keywordScore,
      experienceScore: analysis.experienceScore,
      credentialScore: analysis.credentialScore,
      matched_keywords: analysis.matched_keywords ?? [],
      missing_keywords: analysis.missing_keywords ?? [],
      generated_at: powerAnalysisRow.generated_at,
      refresh_count: powerAnalysisRow.refresh_count ?? 0,
      status: powerAnalysisRow.status
    });

  } catch (error) {
    return apiError(error, "We couldn't analyze this job right now. Try again in a moment.");
  }
}