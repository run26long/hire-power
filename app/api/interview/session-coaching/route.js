import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { convertResumeToText } from '@/lib/resumeText';
import { apiError } from '@/lib/apiError';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const VALID_LEVELS = ['entry', 'mid', 'senior'];

// ============================================================================
// SESSION COACHING — SYSTEM PROMPT
// Cached on every call.
// ============================================================================

const COACHING_SYSTEM_PROMPT = `You are a career coach reviewing a candidate's mock interview answers. You have access to their Power Analysis, which maps their resume against the job description into three categories: Core Power (skills they clearly have), Hidden Power (transferable skills they may not recognize), and Power Gaps (requirements they don't meet).

Your job is to write one coaching paragraph per question that connects their answer to their specific Power Analysis. This is NOT generic feedback. This is personalized coaching that references their actual strengths and gaps.

COACHING RULES:

For answers that scored well (80+):
- Identify which Core Power or Hidden Power skill made this answer strong
- Reference the specific evidence from their PA
- If they used a Hidden Power skill effectively, call that out
- Keep it encouraging but specific. Never generic praise.

For answers that scored mid-range (60-79):
- Identify what was missing. Was there a Core Power skill they could have leveraged but didn't?
- Suggest a specific improvement using their PA data
- If the question targeted a Hidden Power area, suggest the reframe

For answers that scored low (below 60):
- Check if this question hit a Power Gap. If so, reference the bridge strategy from the PA.
- If not a gap but a weak answer, identify the nearest Core or Hidden Power that could have been used
- Be constructive, never harsh. Frame it as opportunity.

For failed evaluations:
- Write a brief note suggesting they review the question against their strengths.

WRITING STYLE:
- Direct, warm, specific. Like a coach who knows this candidate personally.
- Use "you" and "your"
- Reference specific companies, skills, and evidence from the PA and resume
- No em dashes. Use commas, periods, or restructure.
- 2-4 sentences per question. Quality over length.
- Never reference "Power Analysis," "Core Power," "Hidden Power," or "Power Gaps" by name. These are internal concepts. Just coach naturally.

OUTPUT FORMAT:
Respond with ONLY valid JSON. No markdown, no code blocks, no preamble.

{
  "coaching": [
    {
      "order_index": 0,
      "coaching_feedback": "the coaching paragraph"
    }
  ]
}`;

// ============================================================================
// RESPONSE PARSING
// Slice by braces rather than trusting the whole body to parse, the same way
// the other interview routes do.
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
// GENERATION
// Never throws: a failure comes back as { coaching: null } with whatever usage
// was burned, so the caller can record the spend and answer honestly.
// ============================================================================

async function generateCoaching({
  experienceLevel,
  jobTitle,
  jobCompany,
  corePower,
  hiddenPower,
  powerGaps,
  resumeText,
  questions
}) {
  const transcript = questions.map(q => (
    `Question ${q.order_index + 1} (${q.question_source || 'general'}):
Q: ${q.question_text}
A: ${q.user_answer_text || 'No answer provided'}
Clarity Score: ${q.score_structure ?? 'Not scored'}
Content Score: ${q.score_content ?? 'Not scored'}`
  )).join('\n\n');

  const userMessage = `CANDIDATE LEVEL: ${experienceLevel}
ROLE: ${jobTitle || 'Not specified'} at ${jobCompany || 'Not specified'}

POWER ANALYSIS:
Core Power: ${JSON.stringify(corePower)}
Hidden Power: ${JSON.stringify(hiddenPower)}
Power Gaps: ${JSON.stringify(powerGaps)}

CANDIDATE RESUME (for specific references):
${resumeText}

INTERVIEW QUESTIONS AND ANSWERS:
${transcript}

Write one coaching paragraph per question.`;

  const usage = { input: 0, cached: 0, output: 0 };

  let response;
  try {
    response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 3000,
      // Zero: the same session should coach the same way twice. A candidate
      // reopening their results should not find different advice.
      temperature: 0,
      system: [
        {
          type: 'text',
          text: COACHING_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' }
        }
      ],
      messages: [{ role: 'user', content: userMessage }]
    });
  } catch (apiErr) {
    console.error('Session coaching API call failed:', apiErr);
    return { coaching: null, usage };
  }

  usage.input = response.usage?.input_tokens ?? 0;
  usage.cached = response.usage?.cache_read_input_tokens ?? 0;
  usage.output = response.usage?.output_tokens ?? 0;

  const cleanText = extractJsonText(response.content);
  if (!cleanText) {
    console.error('Session coaching returned no JSON object');
    return { coaching: null, usage };
  }

  let parsed;
  try {
    parsed = JSON.parse(cleanText);
  } catch (parseErr) {
    console.error('Session coaching JSON parse error:', parseErr.message);
    console.error('Session coaching sliced JSON:', cleanText.slice(0, 2000));
    return { coaching: null, usage };
  }

  const raw = Array.isArray(parsed?.coaching) ? parsed.coaching : null;
  if (!raw) {
    console.error('Session coaching invalid shape:', parsed);
    return { coaching: null, usage };
  }

  // Anything without a usable index or body is dropped rather than written as
  // an empty paragraph. A question with no coaching renders without it.
  const clean = raw
    .map(item => ({
      order_index: Number.isInteger(item?.order_index) ? item.order_index : null,
      coaching_feedback: typeof item?.coaching_feedback === 'string'
        ? item.coaching_feedback.trim()
        : ''
    }))
    .filter(item => item.order_index !== null && item.coaching_feedback);

  return { coaching: clean, usage };
}

// ============================================================================
// COST LOGGING
// Non-blocking: a logging failure must never cost the caller their coaching.
// Runs on the failure path too — a call that came back unparseable still
// burned tokens, and that spend is only visible if it's recorded.
// ============================================================================

async function logApiCall(supabase, { userId, sessionId, usage, status }) {
  try {
    // input_tokens is already the uncached remainder — cache reads are
    // reported separately, so subtracting them double-counts.
    const estimatedCost =
      (usage.input * 1.0 / 1_000_000) +
      (usage.cached * 0.10 / 1_000_000) +
      (usage.output * 5.0 / 1_000_000);

    const { error } = await supabase.from('api_call_log').insert({
      user_id: userId,
      session_id: sessionId,
      feature: 'session_coaching',
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
      call_type: 'completion',
      input_tokens: usage.input,
      cached_input_tokens: usage.cached,
      output_tokens: usage.output,
      estimated_cost_usd: estimatedCost,
      status
    });
    if (error) console.error('api_call_log insert failed (non-blocking):', error);
  } catch (logErr) {
    console.error('api_call_log insert failed (non-blocking):', logErr);
  }
}

// ============================================================================
// POST /api/interview/session-coaching
// Writes one coaching paragraph per question, informed by the Power Analysis
// the session was built from.
//
// Called lazily once the completion UI has rendered, so the candidate sees
// their scores immediately and the coaching arrives behind them. Generated
// once per session: a second call returns what is already stored rather than
// paying for the same paragraphs twice.
//
// Request body: { session_id: string }
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
    const { session_id } = await request.json();
    if (!session_id) {
      return Response.json({ error: 'session_id is required' }, { status: 400 });
    }

    // ---- SESSION ----
    const { data: session, error: sessionError } = await supabase
      .from('interview_sessions')
      .select('id, job_card_id, power_analysis_id, status')
      .eq('id', session_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (sessionError) {
      console.error('Session coaching session lookup error:', sessionError);
      return Response.json({ error: 'COACHING_LOOKUP_FAILED' }, { status: 500 });
    }
    if (!session) {
      return Response.json({ error: 'SESSION_NOT_FOUND' }, { status: 404 });
    }
    if (session.status !== 'completed') {
      return Response.json({ error: 'SESSION_NOT_COMPLETED' }, { status: 400 });
    }

    // ---- QUESTIONS ----
    const { data: questionRows, error: questionsError } = await supabase
      .from('interview_questions')
      .select('id, question_text, user_answer_text, score_structure, score_content, feedback_structure, feedback_content, evaluation_status, question_source, targets_skills, order_index, coaching_feedback')
      .eq('session_id', session_id)
      .eq('user_id', userId)
      .order('order_index', { ascending: true });

    if (questionsError) {
      console.error('Session coaching questions lookup error:', questionsError);
      return Response.json({ error: 'COACHING_LOOKUP_FAILED' }, { status: 500 });
    }

    const questions = questionRows || [];
    if (!questions.length) {
      return Response.json({ coaching: [] });
    }

    // ---- ALREADY COACHED ----
    // One paragraph anywhere means this session has been through the model.
    // Regenerating would spend again and could contradict what they read
    // last time.
    const existing = questions.filter(q => q.coaching_feedback);
    if (existing.length > 0) {
      return Response.json({
        coaching: existing.map(q => ({
          question_id: q.id,
          order_index: q.order_index,
          coaching_feedback: q.coaching_feedback
        })),
        cached: true
      });
    }

    // ---- POWER ANALYSIS ----
    const { data: powerAnalysis } = session.power_analysis_id
      ? await supabase
          .from('power_analysis')
          .select('id, resume_id, core_power, hidden_power, power_gaps')
          .eq('id', session.power_analysis_id)
          .eq('user_id', userId)
          .maybeSingle()
      : { data: null };

    if (!powerAnalysis) {
      return Response.json({ error: 'POWER_ANALYSIS_NOT_FOUND' }, { status: 404 });
    }

    // ---- JOB CARD ----
    const { data: jobCard } = await supabase
      .from('applications')
      .select('id, title, company')
      .eq('id', session.job_card_id)
      .eq('user_id', userId)
      .maybeSingle();

    // ---- EXPERIENCE LEVEL ----
    const { data: careerContext } = await supabase
      .from('career_context')
      .select('experience_level')
      .eq('user_id', userId)
      .maybeSingle();

    const experienceLevel = VALID_LEVELS.includes(careerContext?.experience_level)
      ? careerContext.experience_level
      : 'mid';

    // ---- RESUME ----
    // The resume the analysis ran against, matching how the questions were
    // generated. Missing is survivable here: the analysis alone still supports
    // coaching, it just loses the specific company and title references.
    const { data: resume } = powerAnalysis.resume_id
      ? await supabase
          .from('resumes')
          .select('id, resume_data')
          .eq('id', powerAnalysis.resume_id)
          .eq('user_id', userId)
          .maybeSingle()
      : { data: null };

    const resumeText = resume?.resume_data
      ? convertResumeToText(resume.resume_data)
      : 'Not available.';

    // ---- GENERATE ----
    const { coaching, usage } = await generateCoaching({
      experienceLevel,
      jobTitle: jobCard?.title,
      jobCompany: jobCard?.company,
      corePower: powerAnalysis.core_power || [],
      hiddenPower: powerAnalysis.hidden_power || [],
      powerGaps: powerAnalysis.power_gaps || [],
      resumeText,
      questions
    });

    await logApiCall(supabase, {
      userId,
      sessionId: session_id,
      usage,
      status: coaching ? 'success' : 'failure'
    });

    if (!coaching) {
      return Response.json({ error: 'COACHING_GENERATION_FAILED' }, { status: 500 });
    }

    // ---- PERSIST ----
    // Matched on order_index, which is the only key the model was given. A
    // paragraph for an index that isn't in this session is dropped.
    const byIndex = new Map(questions.map(q => [q.order_index, q]));
    const saved = [];

    for (const item of coaching) {
      const question = byIndex.get(item.order_index);
      if (!question) continue;

      const { error: updateError } = await supabase
        .from('interview_questions')
        .update({ coaching_feedback: item.coaching_feedback })
        .eq('id', question.id)
        .eq('user_id', userId);

      // One failed write should not cost the others. The question simply
      // renders without coaching, the same as one the model skipped.
      if (updateError) {
        console.error('Session coaching update failed for question', question.id, updateError);
        continue;
      }

      saved.push({
        question_id: question.id,
        order_index: question.order_index,
        coaching_feedback: item.coaching_feedback
      });
    }

    return Response.json({ coaching: saved });

  } catch (error) {
    return apiError(error, "We couldn't generate coaching for this session. Please try again.");
  }
}
