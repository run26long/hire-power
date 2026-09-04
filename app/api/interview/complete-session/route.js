import { createClient } from '@supabase/supabase-js';
import { apiError } from '@/lib/apiError';

// ============================================================================
// LEVEL THRESHOLDS
// Level 0 means "not started" and describes a card with no completed practice
// behind it. Finishing a session always earns at least level 1, however the
// answers scored, so the threshold table below never applies its own floor.
// ============================================================================

const LEVEL_THRESHOLDS = [
  { level: 5, min: 92 },
  { level: 4, min: 85 },
  { level: 3, min: 75 },
  { level: 2, min: 65 },
  { level: 1, min: 50 }
];

// The floor for any completed session. Keeps level 0 meaning "has not
// practiced" rather than "practiced and scored badly".
const MIN_COMPLETED_LEVEL = 1;

function levelForScore(score) {
  for (const { level, min } of LEVEL_THRESHOLDS) {
    if (score >= min) return level;
  }
  return 0;
}

// Asking the interviewer a question is part of interviewing well, but it is
// worth a nudge rather than a grade.
const CLOSER_BONUS = 2;

// ============================================================================
// READINESS SCORE
//
// Voice sessions score a third dimension, text sessions do not. The branch is
// on a non-null delivery average rather than on voice_mode itself: a voice
// session whose answers all failed evaluation carries no delivery data to
// weigh, and keying off the mode would only produce NaN.
// ============================================================================

function readinessScore({ structure, content, delivery }) {
  if (delivery === null || delivery === undefined) {
    return Math.round(structure * 0.40 + content * 0.60);
  }
  return Math.round(structure * 0.30 + content * 0.45 + delivery * 0.25);
}

function average(values) {
  if (!values.length) return null;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

// ============================================================================
// POST /api/interview/complete-session
// Finalizes a practice session: averages the scored answers, converts that to
// a readiness score and a level, and writes both to the session and the job
// card. Pure computation, no model call.
//
// Level and readiness on the job card are high-water marks. A weak session
// records its own honest numbers on the session row but never pulls the card
// down from what an earlier session earned.
//
// Request body: {
//   session_id: string,
//   closer_participated?: boolean   // absent counts as false
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
    const { session_id, closer_participated } = await request.json();

    if (!session_id) {
      return Response.json({ error: 'session_id is required' }, { status: 400 });
    }
    // Optional. A session that ended before the closer simply doesn't send it,
    // and anything other than an explicit true reads as no participation.
    const closerParticipated = closer_participated === true;

    // ---- SESSION ----
    const { data: session, error: sessionError } = await supabase
      .from('interview_sessions')
      .select('id, job_card_id, status, voice_mode, question_count_target')
      .eq('id', session_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (sessionError) {
      console.error('Complete session lookup error:', sessionError);
      return Response.json({ error: 'SESSION_COMPLETION_FAILED' }, { status: 500 });
    }
    if (!session) {
      return Response.json({ error: 'SESSION_NOT_FOUND' }, { status: 404 });
    }
    // Checked ahead of the general status test so a second completion gets the
    // specific answer rather than the catch-all one.
    if (session.status === 'completed') {
      return Response.json({ error: 'SESSION_ALREADY_COMPLETED' }, { status: 400 });
    }
    if (session.status !== 'in_progress') {
      return Response.json({ error: 'SESSION_NOT_ACTIVE' }, { status: 400 });
    }

    // ---- QUESTIONS ----
    const { data: questions, error: questionsError } = await supabase
      .from('interview_questions')
      .select('score_structure, score_content, score_delivery, evaluation_status, question_source')
      .eq('session_id', session_id)
      .eq('user_id', userId);

    if (questionsError) {
      console.error('Complete session questions lookup error:', questionsError);
      return Response.json({ error: 'SESSION_COMPLETION_FAILED' }, { status: 500 });
    }

    const allQuestions = questions || [];

    // The closer is a conversation prompt, not a graded answer, so it never
    // reaches the averages even on the rare occasion it carries a score.
    const scorable = allQuestions.filter(
      q => q.evaluation_status === 'scored' && q.question_source !== 'closer'
    );

    const structureScores = scorable
      .map(q => q.score_structure)
      .filter(v => Number.isFinite(v));
    const contentScores = scorable
      .map(q => q.score_content)
      .filter(v => Number.isFinite(v));

    // Voice only. Text rows never carry a delivery score, so this comes back
    // empty and the average stays null, which is what selects the two-
    // dimension formula below.
    const deliveryScores = scorable
      .map(q => q.score_delivery)
      .filter(v => Number.isFinite(v));

    // Guarded on the set the averages actually use, not on scored questions in
    // general: a session whose only scored row is the closer has nothing to
    // average and would otherwise divide by zero.
    if (!structureScores.length || !contentScores.length) {
      return Response.json({ error: 'NO_SCORED_QUESTIONS' }, { status: 400 });
    }

    const questionsFailed = allQuestions.filter(q => q.evaluation_status === 'failed').length;

    // ---- SCORES ----
    const avgScoreStructure = average(structureScores);
    const avgScoreContent = average(contentScores);
    const avgScoreDelivery = average(deliveryScores);

    const baseReadiness = readinessScore({
      structure: avgScoreStructure,
      content: avgScoreContent,
      delivery: avgScoreDelivery
    });
    const finalReadiness = Math.min(
      100,
      baseReadiness + (closerParticipated ? CLOSER_BONUS : 0)
    );
    const overallScore = finalReadiness;

    // ---- JOB CARD (read before write, for the high-water comparisons) ----
    const { data: jobCard, error: jobCardError } = await supabase
      .from('applications')
      .select('id, interview_level, interview_readiness_score, interview_sessions_count')
      .eq('id', session.job_card_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (jobCardError) {
      console.error('Complete session job card lookup error:', jobCardError);
      return Response.json({ error: 'SESSION_COMPLETION_FAILED' }, { status: 500 });
    }
    if (!jobCard) {
      return Response.json({ error: 'JOB_CARD_NOT_FOUND' }, { status: 404 });
    }

    const levelBefore = jobCard.interview_level ?? 0;
    const readinessBefore = jobCard.interview_readiness_score ?? 0;

    // Three floors, in order: never below what the card already earned, never
    // below what this score maps to, and never below 1 now that a session has
    // been completed.
    const earnedLevel = levelForScore(finalReadiness);
    const finalLevel = Math.max(levelBefore, earnedLevel, MIN_COMPLETED_LEVEL);

    const now = new Date().toISOString();

    // ---- UPDATE JOB CARD FIRST ----
    // Deliberately ahead of the session write. If this succeeds and the session
    // write then fails, a retry re-runs cleanly: level and readiness are
    // high-water marks and settle to the same values. The only cost is
    // interview_sessions_count counting the retry, which is recoverable. The
    // reverse order is not: a completed session blocks its own retry, and the
    // card would never receive the progression at all.
    const jobCardUpdate = {
      interview_level: finalLevel,
      interview_sessions_count: (jobCard.interview_sessions_count ?? 0) + 1,
      interview_last_practiced_at: now
    };
    // High-water mark: a weaker session leaves the stored score alone.
    if (finalReadiness > readinessBefore) {
      jobCardUpdate.interview_readiness_score = finalReadiness;
    }

    const { error: jobCardUpdateError } = await supabase
      .from('applications')
      .update(jobCardUpdate)
      .eq('id', session.job_card_id)
      .eq('user_id', userId);

    if (jobCardUpdateError) {
      console.error('Complete session job card update error:', jobCardUpdateError);
      return Response.json({ error: 'SESSION_COMPLETION_FAILED' }, { status: 500 });
    }

    // ---- UPDATE SESSION ----
    // readiness_score_after and level_at_end record what this session actually
    // earned, not the card's high-water mark, so a weak session stays honest
    // in the history even though the card holds.
    const { error: sessionUpdateError } = await supabase
      .from('interview_sessions')
      .update({
        status: 'completed',
        completed_at: now,
        last_activity_at: now,
        avg_score_structure: avgScoreStructure,
        avg_score_content: avgScoreContent,
        avg_score_delivery: avgScoreDelivery,
        overall_score: overallScore,
        readiness_score_after: finalReadiness,
        level_at_end: finalLevel
      })
      .eq('id', session_id)
      .eq('user_id', userId);

    if (sessionUpdateError) {
      console.error('Complete session update error:', sessionUpdateError);
      return Response.json({ error: 'SESSION_COMPLETION_FAILED' }, { status: 500 });
    }

    // ---- RETURN ----
    return Response.json({
      session_summary: {
        status: 'completed',
        questions_scored: scorable.length,
        questions_failed: questionsFailed,
        avg_score_structure: avgScoreStructure,
        avg_score_content: avgScoreContent,
        // Null on a text session, which is how the caller tells the two
        // dimensions apart from the three without knowing the mode.
        avg_score_delivery: avgScoreDelivery,
        overall_score: overallScore,
        readiness_score: finalReadiness,
        closer_bonus: closerParticipated
      },
      level_progression: {
        level_before: levelBefore,
        level_after: finalLevel,
        level_changed: finalLevel !== levelBefore,
        readiness_score_before: readinessBefore,
        readiness_score_after: finalReadiness
      }
    });

  } catch (error) {
    return apiError(error, "We couldn't wrap up your practice session right now. Try again in a moment.");
  }
}
