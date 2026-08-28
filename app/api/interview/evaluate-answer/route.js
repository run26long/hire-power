import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { apiError } from '@/lib/apiError';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Three failed evaluations and the question stops trying. The answer is still
// saved and the session still moves on; only the score is given up.
const MAX_EVALUATION_RETRIES = 3;

const VALID_LEVELS = ['entry', 'mid', 'senior'];

// ============================================================================
// ANSWER EVALUATION — SYSTEM PROMPT
// Cached on every call.
// ============================================================================

const EVALUATION_SYSTEM_PROMPT = `You are an interview coach evaluating a candidate's answer to an interview question. Score the answer on two dimensions and provide specific, actionable feedback.

SCORING DIMENSIONS:

CLARITY (0-100):
How clear is the answer? Is it well-organized and easy to follow?
- 90-100: Clear STAR or similar framework. Situation, action, and result are all distinct and well-defined. Easy to follow.
- 75-89: Good clarity with minor gaps. Maybe the situation runs long, or the result is vague. The bones are there.
- 60-74: Recognizable attempt at structure but disorganized. Jumps around, buries the lead, or blends sections together.
- 40-59: Stream of consciousness. Some relevant content but no clear framework. Hard to follow.
- 0-39: No structure. Rambling, off-topic, or far too short to evaluate.

For non-behavioral questions (like "tell me about yourself" or technical questions), judge clarity by whether the answer has a clear opening, logical flow, and a clean landing.

CONTENT (0-100):
Does the answer actually address the question with relevant, specific information?
- 90-100: Directly addresses the question. Specific examples with names, numbers, or concrete details. Demonstrates clear competency. Shows impact.
- 75-89: Good relevance with some specifics. Could be more concrete or quantified. Answers the question but misses a chance to show full impact.
- 60-74: Somewhat relevant but generic. Talks around the topic without landing on a clear example. Uses vague language ("I always..." "I usually...").
- 40-59: Loosely related to the question. Mostly theoretical ("I would..." "I believe...") rather than demonstrating actual experience.
- 0-39: Does not address the question. Off-topic, irrelevant, or too thin to evaluate.

CALIBRATION BY LEVEL:
You will be told the candidate's level (entry, mid, senior). Calibrate your expectations:
- Entry: Accept less polished delivery. Value any concrete example, even from school, internships, or part-time work. A student who gives a specific example from a class project with a clear result deserves high content scores.
- Mid: Expect professional examples with some specificity. Should demonstrate ownership and impact.
- Senior: Expect strategic thinking, organizational impact, and leadership. Answers should show influence beyond their immediate role.

FEEDBACK RULES:
- feedback_structure: 2-3 sentences on clarity. What made the answer easy to follow, and one specific thing to improve. Be concrete: "Your situation setup was clear, but your result was vague. End with a specific outcome or metric."
- feedback_content: 2-3 sentences. What landed, and what would make the answer stronger. Reference the actual question: "You were asked about stakeholder management, and your example with the vendor negotiation was relevant. To strengthen it, quantify the outcome."
- Never reference Hire Power, Power Analysis, or any internal concepts.
- Never be condescending. Speak as a helpful coach, not a grader.
- No em dashes. Use commas, periods, or restructure.
- Be honest. A weak answer gets honest scores and constructive feedback, not inflated encouragement. Kindness and honesty are not in conflict.

OUTPUT FORMAT:
Respond with ONLY valid JSON. No markdown, no code blocks, no preamble.
The keys are storage names and do not change: score_structure and
feedback_structure carry the clarity score and the clarity feedback.

{
  "score_structure": 0-100,
  "score_content": 0-100,
  "feedback_structure": "2-3 sentences",
  "feedback_content": "2-3 sentences"
}`;

// ============================================================================
// RESPONSE PARSING
// Same brace-slicing approach the other interview routes use: the model
// occasionally writes a line of preamble before the object.
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
// EVALUATION
// One attempt only. The retry path is the caller hitting this endpoint again
// with the same question_id, which is what lets the stored answer be reused
// without the candidate retyping it.
//
// Never throws: a failure comes back as { evaluation: null } with whatever
// usage was burned, so the caller can record the spend and mark the retry.
// ============================================================================

function toScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

async function evaluateAnswer({
  experienceLevel,
  jobTitle,
  jobCompany,
  questionSource,
  questionText,
  answerText
}) {
  const userMessage = `CANDIDATE LEVEL: ${experienceLevel}
ROLE: ${jobTitle || 'Not specified'} at ${jobCompany || 'Not specified'}

INTERVIEW QUESTION (${questionSource || 'general'}):
${questionText}

CANDIDATE'S ANSWER:
${answerText}

Evaluate this answer.`;

  const usage = { input: 0, cached: 0, output: 0 };

  let response;
  try {
    response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      // Zero, unlike question generation: the same answer should score the
      // same way twice, and a retry should not shift the grade.
      temperature: 0,
      system: [
        {
          type: 'text',
          text: EVALUATION_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' }
        }
      ],
      messages: [{ role: 'user', content: userMessage }]
    });
  } catch (apiErr) {
    console.error('Answer evaluation API call failed:', apiErr);
    return { evaluation: null, usage };
  }

  usage.input = response.usage?.input_tokens ?? 0;
  usage.cached = response.usage?.cache_read_input_tokens ?? 0;
  usage.output = response.usage?.output_tokens ?? 0;

  const cleanText = extractJsonText(response.content);
  if (!cleanText) {
    console.error('Answer evaluation returned no JSON object');
    return { evaluation: null, usage };
  }

  let parsed;
  try {
    parsed = JSON.parse(cleanText);
  } catch (parseErr) {
    console.error('Answer evaluation JSON parse error:', parseErr.message);
    console.error('Answer evaluation sliced JSON:', cleanText.slice(0, 2000));
    return { evaluation: null, usage };
  }

  const scoreStructure = toScore(parsed.score_structure);
  const scoreContent = toScore(parsed.score_content);
  const feedbackStructure = typeof parsed.feedback_structure === 'string'
    ? parsed.feedback_structure.trim()
    : '';
  const feedbackContent = typeof parsed.feedback_content === 'string'
    ? parsed.feedback_content.trim()
    : '';

  // A half-formed evaluation is worse than none: the candidate would see a
  // score with no reasoning behind it. Treat it as a failure and let the
  // retry path have another go.
  if (scoreStructure === null || scoreContent === null || !feedbackStructure || !feedbackContent) {
    console.error('Answer evaluation invalid shape:', parsed);
    return { evaluation: null, usage };
  }

  return {
    evaluation: {
      score_structure: scoreStructure,
      score_content: scoreContent,
      feedback_structure: feedbackStructure,
      feedback_content: feedbackContent
    },
    usage
  };
}

// ============================================================================
// COST LOGGING
// Non-blocking: a logging failure must never cost the caller their evaluation.
// Runs on the failure path too — a call that came back unparseable still
// burned tokens, and that spend is only visible if it's recorded.
// status is CHECK-constrained to 'success', 'failure', 'refusal', 'rate_limit'.
// ============================================================================

async function logApiCall(supabase, { userId, sessionId, usage, status }) {
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
      feature: 'answer_evaluation',
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
// NEXT QUESTION
// Positional, not "first unanswered": the interview runs in order, so the
// question after this one is the next one regardless of its state.
// ============================================================================

async function loadNextQuestion(supabase, { sessionId, userId, orderIndex }) {
  const { data } = await supabase
    .from('interview_questions')
    .select('id, question_text, order_index')
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .eq('order_index', orderIndex + 1)
    .maybeSingle();
  return data || null;
}

// ============================================================================
// POST /api/interview/evaluate-answer
// Scores one answer, advances the session, and hands back the next question.
//
// The answer is written before the model is ever called, so a scoring failure
// costs the candidate a grade and never their words. A failed evaluation is
// not an error response: the session moves forward either way, and the caller
// can re-post the same question_id to retry against the stored answer.
//
// Does NOT complete the session. That is a separate step.
//
// Request body: {
//   session_id: string,
//   question_id: string,
//   answer_text: string   // omitted on a retry, where the stored answer wins
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
    const { session_id, question_id, answer_text } = await request.json();

    if (!session_id || !question_id) {
      return Response.json({ error: 'session_id and question_id are required' }, { status: 400 });
    }

    // ---- SESSION ----
    const { data: session, error: sessionError } = await supabase
      .from('interview_sessions')
      .select('id, job_card_id, status, questions_answered, current_question_index, question_count_target')
      .eq('id', session_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (sessionError) {
      console.error('Evaluate answer session lookup error:', sessionError);
      return Response.json({ error: 'EVALUATION_LOOKUP_FAILED' }, { status: 500 });
    }
    if (!session) {
      return Response.json({ error: 'SESSION_NOT_FOUND' }, { status: 404 });
    }
    if (session.status !== 'in_progress') {
      return Response.json({ error: 'SESSION_NOT_ACTIVE' }, { status: 400 });
    }

    // ---- QUESTION ----
    const { data: question, error: questionError } = await supabase
      .from('interview_questions')
      .select('id, question_text, question_source, targets_skills, order_index, user_answer_text, evaluation_status, evaluation_retry_count')
      .eq('id', question_id)
      .eq('session_id', session_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (questionError) {
      console.error('Evaluate answer question lookup error:', questionError);
      return Response.json({ error: 'EVALUATION_LOOKUP_FAILED' }, { status: 500 });
    }
    if (!question) {
      return Response.json({ error: 'QUESTION_NOT_FOUND' }, { status: 404 });
    }
    if (question.evaluation_status === 'scored') {
      return Response.json({ error: 'ALREADY_SCORED' }, { status: 400 });
    }

    // A retry re-scores the answer already on the row. Progress was counted
    // when that answer was first submitted, so this pass must not count it
    // again and must not overwrite answer_submitted_at.
    const isRetry = question.evaluation_status === 'needs_retry' && !!question.user_answer_text;

    // ---- ANSWER ----
    let answerText;
    if (isRetry) {
      answerText = question.user_answer_text;
    } else {
      if (typeof answer_text !== 'string') {
        return Response.json({ error: 'session_id, question_id and answer_text are required' }, { status: 400 });
      }
      answerText = answer_text.trim();
      if (!answerText) {
        return Response.json({ error: 'ANSWER_EMPTY' }, { status: 400 });
      }
    }

    // ---- GIVE-UP CASE ----
    // Already out of retries. Report the state without burning another call,
    // and without touching progress, which was counted on first submission.
    if (question.evaluation_status === 'failed') {
      const nextQuestion = await loadNextQuestion(supabase, {
        sessionId: session_id,
        userId,
        orderIndex: question.order_index
      });
      return Response.json({
        evaluation: null,
        evaluation_failed: true,
        session_progress: {
          questions_answered: session.questions_answered ?? 0,
          question_count: session.question_count_target ?? 0
        },
        next_question: nextQuestion,
        has_next: !!nextQuestion
      });
    }

    // ---- SAVE THE RAW ANSWER FIRST ----
    // Before the model is called, so a scoring failure never costs the answer.
    if (!isRetry) {
      const { error: answerSaveError } = await supabase
        .from('interview_questions')
        .update({
          user_answer_text: answerText,
          answer_submitted_at: new Date().toISOString()
        })
        .eq('id', question_id)
        .eq('user_id', userId);

      if (answerSaveError) {
        console.error('Evaluate answer save error:', answerSaveError);
        return Response.json({ error: 'ANSWER_SAVE_FAILED' }, { status: 500 });
      }
    }

    // ---- CONTEXT ----
    const { data: jobCard } = await supabase
      .from('applications')
      .select('title, company')
      .eq('id', session.job_card_id)
      .eq('user_id', userId)
      .maybeSingle();

    const { data: careerContext } = await supabase
      .from('career_context')
      .select('experience_level')
      .eq('user_id', userId)
      .maybeSingle();

    const experienceLevel = VALID_LEVELS.includes(careerContext?.experience_level)
      ? careerContext.experience_level
      : 'mid';

    // ---- EVALUATE ----
    const { evaluation, usage } = await evaluateAnswer({
      experienceLevel,
      jobTitle: jobCard?.title,
      jobCompany: jobCard?.company,
      questionSource: question.question_source,
      questionText: question.question_text,
      answerText
    });

    // ---- RECORD THE OUTCOME ON THE QUESTION ----
    let evaluationFailed = false;
    let evaluationPending = false;

    if (evaluation) {
      const { error: scoreError } = await supabase
        .from('interview_questions')
        .update({
          score_structure: evaluation.score_structure,
          score_content: evaluation.score_content,
          feedback_structure: evaluation.feedback_structure,
          feedback_content: evaluation.feedback_content,
          evaluation_status: 'scored'
        })
        .eq('id', question_id)
        .eq('user_id', userId);

      if (scoreError) {
        console.error('Evaluate answer score save error:', scoreError);
        return Response.json({ error: 'EVALUATION_SAVE_FAILED' }, { status: 500 });
      }
    } else {
      const retryCount = (question.evaluation_retry_count ?? 0) + 1;
      const exhausted = retryCount >= MAX_EVALUATION_RETRIES;
      evaluationFailed = exhausted;
      evaluationPending = !exhausted;

      const { error: retryError } = await supabase
        .from('interview_questions')
        .update({
          evaluation_status: exhausted ? 'failed' : 'needs_retry',
          evaluation_retry_count: retryCount
        })
        .eq('id', question_id)
        .eq('user_id', userId);

      if (retryError) {
        console.error('Evaluate answer retry-state save error:', retryError);
      }
    }

    // ---- ADVANCE THE SESSION ----
    // Happens whether or not scoring worked. The answer was submitted, so the
    // candidate moves on either way.
    let questionsAnswered = session.questions_answered ?? 0;

    if (!isRetry) {
      const { data: updatedSession, error: progressError } = await supabase
        .from('interview_sessions')
        .update({
          questions_answered: questionsAnswered + 1,
          current_question_index: (session.current_question_index ?? 0) + 1,
          last_activity_at: new Date().toISOString()
        })
        .eq('id', session_id)
        .eq('user_id', userId)
        .select('questions_answered')
        .single();

      if (progressError) {
        console.error('Evaluate answer progress update error:', progressError);
        // Non-fatal: the answer and the score are already saved. Report the
        // count we expect rather than failing a request that mostly succeeded.
        questionsAnswered = questionsAnswered + 1;
      } else {
        questionsAnswered = updatedSession.questions_answered;
      }
    }

    // ---- NEXT QUESTION ----
    const nextQuestion = await loadNextQuestion(supabase, {
      sessionId: session_id,
      userId,
      orderIndex: question.order_index
    });

    // ---- LOG ----
    // Only when tokens actually moved. A call that threw before reaching the
    // API has nothing to record.
    if (usage.input || usage.cached || usage.output) {
      await logApiCall(supabase, {
        userId,
        sessionId: session_id,
        usage,
        status: evaluation ? 'success' : 'failure'
      });
    }

    // ---- RETURN ----
    return Response.json({
      evaluation,
      ...(evaluationPending ? { evaluation_pending: true } : {}),
      ...(evaluationFailed ? { evaluation_failed: true } : {}),
      session_progress: {
        questions_answered: questionsAnswered,
        question_count: session.question_count_target ?? 0
      },
      next_question: nextQuestion,
      has_next: !!nextQuestion
    });

  } catch (error) {
    return apiError(error, "We couldn't score that answer right now. Your answer was saved.");
  }
}
