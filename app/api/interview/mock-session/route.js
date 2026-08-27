import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { apiError } from '@/lib/apiError';
import { convertResumeToText } from '@/lib/resumeText';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// A free trial is one session per job card. Pro practice is capped monthly
// rather than per card so a candidate can spread it across their search.
const FREE_TRIAL_LIMIT = 1;
const MONTHLY_PRACTICE_CAP = 30;

const QUESTION_COUNTS = { free_trial: 5, pro_practice: 10 };
const BANK_COUNTS = { free_trial: 1, pro_practice: 2 };

const VALID_SESSION_TYPES = ['free_trial', 'pro_practice'];
const VALID_VOICE_MODES = ['mode_1', 'mode_2', 'mode_3'];
const VALID_LEVELS = ['entry', 'mid', 'senior'];
const VALID_SOURCES = ['warmup', 'resume', 'jd', 'behavioral_bank', 'closer'];

// ============================================================================
// QUESTION GENERATION — SYSTEM PROMPT
// Cached on every call.
// ============================================================================

const QUESTION_GENERATION_SYSTEM_PROMPT = `You are a hiring manager conducting an interview. You have reviewed the candidate's resume and the job description for the role they applied to. Your job is to generate realistic interview questions that a real interviewer would ask.

You are NOT a coach. You are NOT helping the candidate. You are the interviewer. Your questions come from reading the resume and the job description, the same way a real hiring manager prepares.

QUESTION GENERATION RULES:

QUESTION 1 — WARMUP (difficulty 1):
Always open with a natural warmup. "Tell me a little about yourself and what drew you to this role" or a variant. This sets the tone and gives the candidate a chance to settle in.

RESUME-BASED QUESTIONS (3-4 for a 10-question session, 1-2 for a 5-question session):
- Reference specific experience, job titles, companies, or accomplishments from the resume
- Ask the candidate to walk through, explain, or elaborate on something they claimed
- Use natural interviewer language: "I see you...", "Walk me through...", "Tell me about your time at..."
- Never ask about something not on the resume
- Go deeper than surface level. "I see you managed a team of 12. Tell me about a time that team dynamic got difficult."

JD-BASED QUESTIONS (3-4 for a 10-question session, 1-2 for a 5-question session):
- Target specific requirements, skills, or responsibilities from the job description
- Ask the candidate to demonstrate they can do what the role needs
- Use natural interviewer language: "This role involves a lot of...", "How would you handle...", "What's your approach to..."
- These should feel like the interviewer is checking fit, not quizzing

BEHAVIORAL BANK QUESTIONS (2 for a 10-question session, 1 for a 5-question session):
- Select from the provided question bank
- Choose questions that do NOT overlap with skills already covered by your resume and JD questions
- You may tailor the wording slightly to fit the role and company context, but keep the core question intact
- Return the bank question's ID in bank_question_id

CLOSER (always the last question):
- The final question must always be a natural variant of "Do you have any questions for me about the role or the company?"
- Make it conversational, not robotic

SENIORITY CALIBRATION:
You will be told the candidate's level (entry, mid, or senior). Calibrate accordingly:
- Entry: straightforward behavioral questions, simpler scenarios, focus on potential and learning
- Mid: cross-functional challenges, process improvement, managing competing priorities, team dynamics
- Senior: strategic decisions, organizational impact, stakeholder management, vision, leading through ambiguity

INDUSTRY AWARENESS:
Read the company name and JD to determine the industry. Use industry-appropriate vocabulary and framing. A healthcare interview sounds different from a fintech interview.

SKILLS THE CANDIDATE HAS ALREADY PRACTICED:
You will be given a list of skills the candidate has already drilled in coaching (STAR stories). Do not avoid these entirely, but do not stack multiple questions on skills they have clearly practiced. Spread your questions across their full experience, including areas they have NOT practiced. The goal is a realistic interview, not a victory lap.

QUESTION QUALITY RULES:
- Each question must test a different skill or competency. No duplicates.
- Escalate difficulty: warmup first, standard questions in the middle, more challenging questions before the closer.
- Never reference "Power Analysis," "Core Power," "Hidden Power," "Power Gaps," or any Hire Power internal concepts.
- Never reference coaching, practice, or the fact that this is a simulation.
- Write as a real interviewer who spent 5 minutes reviewing this resume and JD.
- No em dashes anywhere. Use commas, periods, or restructure.
- Keep questions to 1-3 sentences max. Real interviewers don't give speeches.

OUTPUT FORMAT:
Respond with ONLY valid JSON. No markdown, no code blocks, no preamble.

{
  "questions": [
    {
      "question_text": "the interview question",
      "question_source": "warmup" | "resume" | "jd" | "behavioral_bank" | "closer",
      "targets_skills": ["skill1", "skill2"],
      "difficulty": 1 | 2 | 3,
      "bank_question_id": "uuid or null",
      "rationale": "1 sentence: why this question, what it probes"
    }
  ]
}`;

// ============================================================================
// RESPONSE PARSING
// The bank and the resume ride in the user turn, so the model occasionally
// writes a line of preamble. Slice by braces rather than trusting the whole
// body to parse, the same way company-research and interviewer-questions do.
// ============================================================================

function extractJsonText(content) {
  const joined = (content || [])
    .filter(b => b.type === 'text' && b.text?.trim())
    .map(b => b.text)
    .join('');
  if (!joined.trim()) return null;

  const start = joined.indexOf('{');
  const end = joined.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return joined.slice(start, end + 1);
}

// ============================================================================
// USER MESSAGE
// Everything variable lives here so the system prompt stays cacheable.
// ============================================================================

function buildUserMessage({
  experienceLevel,
  resumeText,
  jobTitle,
  jobCompany,
  jobDescription,
  companyResearch,
  practicedSkills,
  bankQuestions,
  bankCount,
  questionCount
}) {
  const companyBlock = companyResearch
    ? `
COMPANY CONTEXT:
What they do: ${companyResearch.what_they_do || 'Not available'}
Culture: ${companyResearch.culture_signals ? JSON.stringify(companyResearch.culture_signals) : 'Not available'}
Interview style: ${companyResearch.interview_style ? JSON.stringify(companyResearch.interview_style) : 'Not available'}
`
    : '';

  const practicedBlock = practicedSkills.length ? practicedSkills.join('\n') : 'None yet';

  const bankBlock = bankQuestions.length
    ? bankQuestions
        .map(q => `${q.id} | ${q.question_text} | ${q.question_category || 'general'} | ${q.difficulty ?? 'unspecified'}`)
        .join('\n')
    : 'No bank questions available for this level. Generate all questions from the resume and job description instead.';

  return `CANDIDATE LEVEL: ${experienceLevel}

CANDIDATE RESUME:
${resumeText}

JOB DESCRIPTION (${jobTitle || 'Not specified'} at ${jobCompany || 'Not specified'}):
${jobDescription}
${companyBlock}
SKILLS THE CANDIDATE HAS ALREADY PRACTICED IN COACHING:
${practicedBlock}

BEHAVIORAL QUESTION BANK (select ${bankCount} from this list, return the id):
${bankBlock}

Generate exactly ${questionCount} interview questions.`;
}

// ============================================================================
// NORMALIZATION
// The model picks bank ids out of the list it was handed, so an id that isn't
// in the bank is a hallucination and would write a dangling foreign key. Drop
// those to null. Warmup leads and closer trails regardless of what order the
// model returned them in, because order_index drives the interview flow.
// ============================================================================

function normalizeQuestions(parsed, { bankIds, questionCount }) {
  const raw = Array.isArray(parsed?.questions) ? parsed.questions : null;
  if (!raw) return [];

  const clean = raw
    .filter(q => q && typeof q.question_text === 'string' && q.question_text.trim())
    .map(q => ({
      question_text: q.question_text.trim(),
      question_source: VALID_SOURCES.includes(q.question_source) ? q.question_source : 'resume',
      targets_skills: Array.isArray(q.targets_skills)
        ? q.targets_skills.filter(s => typeof s === 'string' && s.trim()).map(s => s.trim())
        : [],
      bank_question_id: bankIds.has(q.bank_question_id) ? q.bank_question_id : null,
      // Stored on the question row. The model sometimes writes difficulty as a
      // string or skips rationale entirely, so both land as null rather than
      // pushing a bad type at the column.
      difficulty: Number.isInteger(q.difficulty) ? q.difficulty : null,
      rationale: typeof q.rationale === 'string' && q.rationale.trim() ? q.rationale.trim() : null
    }))
    .slice(0, questionCount);

  const warmups = clean.filter(q => q.question_source === 'warmup');
  const closers = clean.filter(q => q.question_source === 'closer');
  const middle = clean.filter(q => q.question_source !== 'warmup' && q.question_source !== 'closer');

  return [...warmups, ...middle, ...closers];
}

// ============================================================================
// GENERATION
// One retry on a bad response, because a malformed body is usually transient.
// Usage accumulates across attempts so a retry's spend is still recorded.
// ============================================================================

async function generateQuestions(params) {
  const userMessage = buildUserMessage(params);
  const usage = { input: 0, cached: 0, output: 0 };
  let lastError = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      temperature: 0.7,
      system: [
        {
          type: 'text',
          text: QUESTION_GENERATION_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' }
        }
      ],
      messages: [{ role: 'user', content: userMessage }]
    });

    usage.input += response.usage?.input_tokens ?? 0;
    usage.cached += response.usage?.cache_read_input_tokens ?? 0;
    usage.output += response.usage?.output_tokens ?? 0;

    const cleanText = extractJsonText(response.content);
    if (!cleanText) {
      lastError = new Error('Question generation returned no JSON object');
      console.error('Mock session: no JSON object on attempt', attempt + 1);
      continue;
    }

    let parsed;
    try {
      parsed = JSON.parse(cleanText);
    } catch (parseErr) {
      lastError = parseErr;
      console.error('Mock session JSON parse error on attempt', attempt + 1, parseErr.message);
      console.error('Mock session sliced JSON:', cleanText.slice(0, 2000));
      continue;
    }

    const questions = normalizeQuestions(parsed, params);
    if (!questions.length) {
      lastError = new Error('Question generation returned no usable questions');
      console.error('Mock session: no usable questions on attempt', attempt + 1);
      continue;
    }

    return { questions, usage };
  }

  return { questions: [], usage, error: lastError };
}

// ============================================================================
// COST LOGGING
// Non-blocking: a logging failure must never cost the caller their session.
// ============================================================================

async function logApiCall(supabase, { userId, sessionId, usage }) {
  try {
    // input_tokens is already the uncached remainder — cache reads are
    // reported separately, so subtracting them double-counts and goes
    // negative whenever the cache hits.
    const estimatedCost =
      (usage.input * 1.0 / 1_000_000) +
      (usage.cached * 0.10 / 1_000_000) +
      (usage.output * 5.0 / 1_000_000);

    const { error } = await supabase.from('api_call_log').insert({
      user_id: userId,
      session_id: sessionId,
      feature: 'question_generation',
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
      call_type: 'completion',
      input_tokens: usage.input,
      cached_input_tokens: usage.cached,
      output_tokens: usage.output,
      estimated_cost_usd: estimatedCost,
      status: 'success'
    });
    if (error) console.error('api_call_log insert failed (non-blocking):', error);
  } catch (logErr) {
    console.error('api_call_log insert failed (non-blocking):', logErr);
  }
}

// ============================================================================
// POST /api/interview/mock-session
// Creates a practice session and generates every question for it in one call.
// Questions are generated BEFORE the session row is written, so a generation
// failure never leaves an orphan session sitting in the user's history.
//
// Request body: {
//   job_card_id: string,
//   power_analysis_id: string,
//   session_type: 'free_trial' | 'pro_practice',
//   voice_mode: 'mode_1' | 'mode_2' | 'mode_3'
// }
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

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = user.id;

    // ---- INPUT ----
    const { job_card_id, power_analysis_id, session_type, voice_mode } = await request.json();

    if (!job_card_id || !power_analysis_id || !session_type || !voice_mode) {
      return Response.json(
        { error: 'job_card_id, power_analysis_id, session_type and voice_mode are required' },
        { status: 400 }
      );
    }
    if (!VALID_SESSION_TYPES.includes(session_type)) {
      return Response.json({ error: 'Invalid session_type' }, { status: 400 });
    }
    if (!VALID_VOICE_MODES.includes(voice_mode)) {
      return Response.json({ error: 'Invalid voice_mode' }, { status: 400 });
    }

    // ---- POWER ANALYSIS (ownership check) ----
    const { data: powerAnalysis, error: paError } = await supabase
      .from('power_analysis')
      .select('id, resume_id, job_card_id, core_power, hidden_power, power_gaps')
      .eq('id', power_analysis_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (paError) {
      console.error('Mock session power analysis lookup error:', paError);
      return Response.json({ error: 'SESSION_CREATION_FAILED' }, { status: 500 });
    }
    if (!powerAnalysis) {
      return Response.json({ error: 'POWER_ANALYSIS_NOT_FOUND' }, { status: 404 });
    }

    // ---- GATING ----
    if (session_type === 'free_trial') {
      const { count, error: countError } = await supabase
        .from('interview_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('job_card_id', job_card_id)
        .in('status', ['completed', 'in_progress']);

      if (countError) {
        console.error('Mock session free trial count error:', countError);
        return Response.json({ error: 'SESSION_CREATION_FAILED' }, { status: 500 });
      }
      if ((count ?? 0) >= FREE_TRIAL_LIMIT) {
        return Response.json({ error: 'FREE_LIMIT_REACHED' }, { status: 403 });
      }
    }

    if (session_type === 'pro_practice') {
      const now = new Date();
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      // Date.UTC rolls a month index of 12 into January of the next year.
      const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

      const { count, error: countError } = await supabase
        .from('interview_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', monthStart.toISOString());

      if (countError) {
        console.error('Mock session monthly count error:', countError);
        return Response.json({ error: 'SESSION_CREATION_FAILED' }, { status: 500 });
      }
      if ((count ?? 0) >= MONTHLY_PRACTICE_CAP) {
        return Response.json(
          { error: 'MONTHLY_CAP_REACHED', resetDate: nextMonthStart.toISOString() },
          { status: 403 }
        );
      }
    }

    // ---- JOB CARD ----
    const { data: jobCard, error: jobCardError } = await supabase
      .from('applications')
      .select('id, title, company, description, interview_level, interview_readiness_score')
      .eq('id', job_card_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (jobCardError) {
      console.error('Mock session job card lookup error:', jobCardError);
      return Response.json({ error: 'SESSION_CREATION_FAILED' }, { status: 500 });
    }
    if (!jobCard) {
      return Response.json({ error: 'JOB_CARD_NOT_FOUND' }, { status: 404 });
    }

    // ---- RESUME ----
    // Deliberately the resume the Power Analysis ran against, not the job
    // card's current one, so the questions match the analysis the candidate
    // has been preparing from.
    const { data: resume } = powerAnalysis.resume_id
      ? await supabase
          .from('resumes')
          .select('id, resume_data')
          .eq('id', powerAnalysis.resume_id)
          .eq('user_id', userId)
          .maybeSingle()
      : { data: null };

    if (!resume?.resume_data) {
      return Response.json({ error: 'RESUME_NOT_FOUND' }, { status: 400 });
    }
    const resumeText = convertResumeToText(resume.resume_data);

    // ---- COMPANY RESEARCH (optional) ----
    let companyResearch = null;
    if (jobCard.company?.trim()) {
      const { data: research } = await supabase
        .from('company_research')
        .select('what_they_do, culture_signals, interview_style')
        .eq('company_name_normalized', jobCard.company.toLowerCase().trim())
        .order('generated_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      companyResearch = research || null;
    }

    // ---- EXPERIENCE LEVEL ----
    const { data: careerContext } = await supabase
      .from('career_context')
      .select('experience_level')
      .eq('user_id', userId)
      .maybeSingle();

    const experienceLevel = VALID_LEVELS.includes(careerContext?.experience_level)
      ? careerContext.experience_level
      : 'mid';

    // ---- BEHAVIORAL BANK ----
    // 'any' rows apply at every level, so they sit alongside the level match.
    const { data: bankQuestions } = await supabase
      .from('behavioral_question_bank')
      .select('id, question_text, question_category, target_skills, difficulty')
      .eq('is_active', true)
      .in('role_level', [experienceLevel, 'any']);

    const bank = bankQuestions || [];
    const bankIds = new Set(bank.map(q => q.id));

    // ---- ALREADY-PRACTICED SKILLS ----
    // Only finished stories count. A story still mid-coaching is not something
    // the candidate has practiced yet.
    const { data: stories } = await supabase
      .from('interview_stories')
      .select('item_skill, item_type')
      .eq('power_analysis_id', power_analysis_id)
      .eq('user_id', userId)
      .eq('coaching_complete', true);

    const practicedSkills = [...new Set(
      (stories || []).map(s => s.item_skill).filter(s => typeof s === 'string' && s.trim())
    )];

    // ---- GENERATE ----
    const questionCount = QUESTION_COUNTS[session_type];
    const bankCount = BANK_COUNTS[session_type];

    let generated;
    try {
      generated = await generateQuestions({
        experienceLevel,
        resumeText,
        jobTitle: jobCard.title,
        jobCompany: jobCard.company,
        jobDescription: jobCard.description || '',
        companyResearch,
        practicedSkills,
        bankQuestions: bank,
        bankIds,
        bankCount,
        questionCount
      });
    } catch (genErr) {
      console.error('Mock session question generation failed:', genErr);
      return Response.json({ error: 'QUESTION_GENERATION_FAILED' }, { status: 500 });
    }

    const { questions, usage } = generated;
    if (!questions.length) {
      console.error('Mock session: no usable questions after retry', generated.error?.message);
      return Response.json({ error: 'QUESTION_GENERATION_FAILED' }, { status: 500 });
    }

    // ---- CREATE SESSION ----
    // Only now that questions exist. question_count_target reflects what was
    // actually generated, so a short set never reads as a session the candidate
    // abandoned partway through.
    const { data: session, error: sessionError } = await supabase
      .from('interview_sessions')
      .insert({
        user_id: userId,
        job_card_id,
        power_analysis_id,
        session_type,
        voice_mode,
        question_count_target: questions.length,
        status: 'in_progress',
        questions_answered: 0,
        current_question_index: 0,
        level_at_start: jobCard.interview_level || 0,
        readiness_score_before: jobCard.interview_readiness_score || 0
      })
      .select()
      .single();

    if (sessionError || !session) {
      console.error('Mock session insert error:', sessionError);
      return Response.json({ error: 'SESSION_CREATION_FAILED' }, { status: 500 });
    }

    // ---- CREATE QUESTIONS ----
    const { data: savedQuestions, error: questionsError } = await supabase
      .from('interview_questions')
      .insert(
        questions.map((q, i) => ({
          session_id: session.id,
          user_id: userId,
          question_text: q.question_text,
          question_source: q.question_source,
          targets_skills: q.targets_skills,
          order_index: i,
          bank_question_id: q.bank_question_id,
          difficulty: q.difficulty || null,
          rationale: q.rationale || null,
          evaluation_status: 'pending'
        }))
      )
      .select()
      .order('order_index', { ascending: true });

    if (questionsError || !savedQuestions?.length) {
      console.error('Mock session questions insert error:', questionsError);
      // Roll the session back rather than leave one with no questions in it.
      await supabase.from('interview_sessions').delete().eq('id', session.id).eq('user_id', userId);
      return Response.json({ error: 'SESSION_CREATION_FAILED' }, { status: 500 });
    }

    await logApiCall(supabase, { userId, sessionId: session.id, usage });

    // ---- RETURN ----
    const firstQuestion = savedQuestions[0];
    return Response.json({
      session_id: session.id,
      question_count: savedQuestions.length,
      detected_level: experienceLevel,
      current_question: {
        id: firstQuestion.id,
        question_text: firstQuestion.question_text,
        order_index: firstQuestion.order_index
      }
    });

  } catch (error) {
    return apiError(error, "We couldn't start your practice session right now. Try again in a moment.");
  }
}
