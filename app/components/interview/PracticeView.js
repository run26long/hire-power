'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

// ============================================================================
// SHARED VISUALS
// Gradients stay inline: Tailwind classes carry tints only. Scoring visuals
// live in PracticeLeftPanel now — this column runs the interview, the other
// one reports on it.
// ============================================================================

const GRADIENT = { background: 'linear-gradient(to right, #667eea, #764ba2)' };

const MODES = [
  { key: 'mode_3', icon: '💬', title: 'Text Interview', subtitle: 'Type your answers', available: true },
  { key: 'mode_2', icon: '🎤', title: 'Voice Interview', subtitle: 'Speak your answers, no recording', available: false },
  { key: 'mode_1', icon: '🎙️', title: 'Voice Interview + Playback', subtitle: 'Speak with recording for review', available: false }
];

const GENERIC_START_ERROR = "We couldn't start your practice session right now. Try again in a moment.";

function formatResetDate(iso) {
  if (!iso) return 'the first of next month';
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
  } catch {
    return 'the first of next month';
  }
}

// ============================================================================
// SMALL PIECES
// ============================================================================

function InterviewerBubble({ text }) {
  return (
    <div>
      <p className="text-xs md:text-[10px] text-gray-500 font-medium mb-1">🎤 Interviewer</p>
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 w-full">
        <p className="text-sm md:text-xs text-gray-800 leading-snug whitespace-pre-line">{text}</p>
      </div>
    </div>
  );
}

function AnswerBubble({ text }) {
  return (
    <div className="flex justify-end">
      <div className="bg-gray-100 border border-gray-200 rounded-lg p-3 max-w-[85%]">
        <p className="text-sm md:text-xs text-gray-800 leading-snug whitespace-pre-line">{text}</p>
      </div>
    </div>
  );
}

// Copied verbatim from the page's module-scope BackLink, which is not exported.
// Every step ends with the same "← Back" link, so this one has to read the same.
function BackLink({ onClick }) {
  return (
    <div className="text-center">
      <button onClick={onClick} className="text-sm md:text-xs text-gray-400 hover:text-gray-600">
        ← Back
      </button>
    </div>
  );
}

// ============================================================================
// PRACTICE VIEW
// Right-column driver for the practice step. Owns the interview mechanics and
// reports its shape upward with onSessionChange so the left panel can mirror it
// without a second copy of the state.
// ============================================================================

export default function PracticeView({
  jobCardId,
  powerAnalysisId,
  userId,
  isPro,
  experienceLevel,
  reviewSessionId = null,
  onBack,
  onSessionChange = () => {},
  onError = () => {}
}) {
  const supabase = createClient();
  const router = useRouter();

  // Read fresh on every call rather than captured once at page load. A Supabase
  // JWT lasts an hour and an interview can easily outrun that; getSession also
  // refreshes the token when it is close to expiring.
  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  const [sessionState, setSessionState] = useState('idle');
  const [session, setSession] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completion, setCompletion] = useState(null);

  const [selectedMode, setSelectedMode] = useState('mode_3');
  const [starting, setStarting] = useState(false);
  const [sending, setSending] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [resuming, setResuming] = useState(true);

  const [input, setInput] = useState('');

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  // Ending early with nothing scored discards the session locally. Without this
  // the resume lookup would find the same in_progress row and drop the user
  // straight back into the interview they just walked away from.
  const dismissedSessionIdRef = useRef(null);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 768);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // ── Report shape upward for the left panel ──
  useEffect(() => {
    onSessionChange({
      state: sessionState,
      session,
      questions,
      currentIndex,
      completion,
      startedAt: session?.started_at ?? null
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionState, session, questions, currentIndex, completion]);

  useEffect(() => {
    if (sessionState === 'active') messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [questions, currentIndex, sessionState]);

  useEffect(() => {
    if (sessionState === 'active' && !sending) inputRef.current?.focus({ preventScroll: true });
  }, [sessionState, sending, currentIndex]);

  // ── Load a session's questions ──
  const loadQuestions = useCallback(async (sessionId) => {
    const { data, error } = await supabase
      .from('interview_questions')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .order('order_index', { ascending: true });
    if (error) {
      console.error('Practice questions load failed:', error);
      return [];
    }
    return data || [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ── RESUME AN IN-PROGRESS SESSION ON MOUNT ──
  useEffect(() => {
    let cancelled = false;

    async function resume() {
      if (!userId || !jobCardId) { setResuming(false); return; }
      try {
        const { data, error } = await supabase
          .from('interview_sessions')
          .select('*')
          .eq('user_id', userId)
          .eq('job_card_id', jobCardId)
          .eq('status', 'in_progress')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        if (cancelled || !data) { if (!cancelled) setResuming(false); return; }
        if (dismissedSessionIdRef.current === data.id) { setResuming(false); return; }

        const rows = await loadQuestions(data.id);
        if (cancelled) return;

        // Pick up at the first unanswered question. Everything before it renders
        // above with whatever feedback it already earned.
        // Nothing pending means they answered everything and left before
        // submitting, so they come back to the wrap-up rather than to the last
        // question they already answered.
        const pendingAt = rows.findIndex(q => q.evaluation_status !== 'scored' && !q.user_answer_text);
        setSession(data);
        setQuestions(rows);
        setCurrentIndex(pendingAt === -1 ? rows.length : pendingAt);
        setSessionState('active');
      } catch (err) {
        console.error('Practice session resume failed:', err);
      } finally {
        if (!cancelled) setResuming(false);
      }
    }

    resume();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, jobCardId]);

  // ── REVIEW A PAST SESSION (left panel click) ──
  useEffect(() => {
    let cancelled = false;
    if (!reviewSessionId) return;

    async function loadReview() {
      try {
        const { data, error } = await supabase
          .from('interview_sessions')
          .select('*')
          .eq('id', reviewSessionId)
          .eq('user_id', userId)
          .maybeSingle();
        if (error || !data || cancelled) return;

        const rows = await loadQuestions(reviewSessionId);
        if (cancelled) return;

        setSession(data);
        setQuestions(rows);
        setCompletion({
          session_summary: {
            status: data.status,
            questions_scored: rows.filter(q => q.evaluation_status === 'scored').length,
            questions_failed: rows.filter(q => q.evaluation_status === 'failed').length,
            avg_score_structure: data.avg_score_structure ?? 0,
            avg_score_content: data.avg_score_content ?? 0,
            overall_score: data.overall_score ?? 0,
            readiness_score: data.readiness_score_after ?? 0,
            closer_bonus: false
          },
          level_progression: {
            level_before: data.level_at_start ?? 0,
            level_after: data.level_at_end ?? 0,
            level_changed: false,
            readiness_score_before: data.readiness_score_before ?? 0,
            readiness_score_after: data.readiness_score_after ?? 0
          }
        });
        setSessionState('completed');
      } catch (err) {
        console.error('Practice session review load failed:', err);
      }
    }

    loadReview();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewSessionId]);

  // ── START ──
  const startSession = async () => {
    // Checked before any loading state is set, so a dead session leaves the
    // panel exactly as it was rather than flashing a spinner at nothing.
    const token = await getToken();
    if (!token) { onError('Your session expired. Refresh the page and sign in again.'); return; }

    setStarting(true);
    try {
      const res = await fetch('/api/interview/mock-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          job_card_id: jobCardId,
          power_analysis_id: powerAnalysisId,
          session_type: isPro ? 'pro_practice' : 'free_trial',
          voice_mode: selectedMode
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data.error === 'FREE_LIMIT_REACHED') {
          onError("You've used your free practice session for this job. Upgrade to Pro for unlimited practice.");
        } else if (data.error === 'MONTHLY_CAP_REACHED') {
          onError(`You've reached your monthly practice limit. Your limit resets on ${formatResetDate(data.resetDate)}.`);
        } else {
          onError(GENERIC_START_ERROR);
        }
        return;
      }

      const rows = await loadQuestions(data.session_id);
      setSession({
        id: data.session_id,
        question_count_target: data.question_count,
        questions_answered: 0,
        current_question_index: 0,
        voice_mode: selectedMode,
        // The route returns no row, so this is stamped here rather than read
        // back. The session began a moment ago either way, and it keeps the
        // timer working whether or not the column exists.
        started_at: new Date().toISOString()
      });
      setQuestions(rows);
      setCurrentIndex(0);
      setCompletion(null);
      setSessionState('active');
    } catch (err) {
      console.error('Start practice session failed:', err);
      onError(GENERIC_START_ERROR);
    } finally {
      setStarting(false);
    }
  };

  // ── ANSWER ──
  const current = questions[currentIndex] || null;
  // Past the last question: every answer is in and the interview is over but
  // not yet submitted.
  const interviewDone = questions.length > 0 && currentIndex >= questions.length;
  const answeredCount = questions.filter(q => q.user_answer_text).length;
  const scoredCount = questions.filter(q => q.evaluation_status === 'scored').length;

  const submitAnswer = async () => {
    const text = input.trim();
    if (!text || !current || sending) return;

    // Ahead of the optimistic update, so a dead session leaves the answer in the
    // box to retry after refreshing rather than clearing it into nowhere.
    const token = await getToken();
    if (!token) { onError('Your session expired. Refresh the page and sign in again.'); return; }

    setSending(true);
    const previousQuestions = questions;
    setQuestions(questions.map((q, i) => (i === currentIndex ? { ...q, user_answer_text: text } : q)));
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';

    try {
      const res = await fetch('/api/interview/evaluate-answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          session_id: session.id,
          question_id: current.id,
          answer_text: text
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // The answer is saved server-side before scoring, so a failure here
        // costs the grade, not the words. Put the text back in the box only
        // when the answer itself never landed.
        if (data.error === 'ANSWER_EMPTY' || data.error === 'ANSWER_SAVE_FAILED') {
          setQuestions(previousQuestions);
          setInput(text);
        }
        onError("We couldn't score that answer right now. Your answer was saved.");
        return;
      }

      setQuestions(prev => prev.map((q, i) => (
        i === currentIndex
          ? {
              ...q,
              user_answer_text: text,
              evaluation_status: data.evaluation ? 'scored' : (data.evaluation_failed ? 'failed' : 'needs_retry'),
              score_structure: data.evaluation?.score_structure ?? null,
              score_content: data.evaluation?.score_content ?? null,
              feedback_structure: data.evaluation?.feedback_structure ?? null,
              feedback_content: data.evaluation?.feedback_content ?? null
            }
          : q
      )));

      setSession(prev => (prev ? {
        ...prev,
        questions_answered: data.session_progress?.questions_answered ?? prev.questions_answered
      } : prev));

      // Straight on to the next question. A real interviewer does not stop to
      // grade you between answers, so the scores stay hidden until the summary.
      advance();
    } catch (err) {
      console.error('Evaluate answer failed:', err);
      onError("We couldn't score that answer right now. Your answer was saved.");
    } finally {
      setSending(false);
    }
  };

  // Runs one past the last question on purpose: that index is the wrap-up,
  // where the interview is over and the only thing left is to submit it.
  const advance = () => {
    setCurrentIndex(i => Math.min(i + 1, questions.length));
  };

  // ── COMPLETE ──
  const completeSession = async () => {
    const token = await getToken();
    if (!token) { onError('Your session expired. Refresh the page and sign in again.'); return; }

    setCompleting(true);
    try {
      const res = await fetch('/api/interview/complete-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          session_id: session.id,
          // No closer any more, so no bonus to earn.
          closer_participated: false
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        onError("We couldn't wrap up your practice session right now. Try again in a moment.");
        return;
      }

      setCompletion(data);
      setSessionState('completed');
    } catch (err) {
      console.error('Complete practice session failed:', err);
      onError("We couldn't wrap up your practice session right now. Try again in a moment.");
    } finally {
      setCompleting(false);
    }
  };

  const resetToIdle = () => {
    setSession(null);
    setQuestions([]);
    setCurrentIndex(0);
    setCompletion(null);
    setInput('');
    setSessionState('idle');
  };

  const endEarly = async () => {
    const ok = window.confirm(
      scoredCount > 0
        ? 'End this interview now? Your answered questions will be scored and saved.'
        : 'End this interview now? Nothing will be saved.'
    );
    if (!ok) return;

    if (scoredCount > 0) {
      await completeSession();
      return;
    }

    // Nothing scored, so there is nothing worth keeping. Dropped locally rather
    // than written anywhere: the row stays in_progress until the cleanup runs.
    dismissedSessionIdRef.current = session?.id ?? null;
    resetToIdle();
  };

  // ==========================================================================
  // STATE 1 — PRE-SESSION
  // ==========================================================================

  if (resuming) {
    return (
      <div className="px-5 py-4 flex-1 flex flex-col">
        <div className="flex justify-center py-6">
          <div className="animate-spin h-6 w-6 border-2 border-purple-600 border-t-transparent rounded-full"></div>
        </div>
      </div>
    );
  }

  if (sessionState === 'idle') {
    return (
      <div className="px-5 py-4 space-y-2 flex-1 flex flex-col">
        <h3 className="font-semibold text-lg -mt-3">🎤 Practice Your Interview</h3>

        <h4 className="text-sm font-bold uppercase tracking-wide" style={{ color: '#111827' }}>
          Choose Your Interview Mode
        </h4>

        <div className="flex flex-col gap-2">
          {MODES.map(mode => {
            const active = selectedMode === mode.key;
            return (
              <button
                key={mode.key}
                type="button"
                onClick={() => mode.available && setSelectedMode(mode.key)}
                disabled={!mode.available}
                className={`text-left bg-white shadow-sm rounded-lg p-3 border transition-all ${
                  active && mode.available
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200'
                } ${
                  mode.available
                    ? 'cursor-pointer hover:border-purple-300 hover:shadow-sm'
                    : 'cursor-not-allowed opacity-60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-base flex-shrink-0 leading-none mt-0.5">{mode.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm md:text-xs font-bold text-gray-900">{mode.title}</p>
                      {!mode.available && (
                        <span className="text-xs md:text-[9px] bg-gray-100 text-gray-500 font-bold px-1.5 py-0.5 rounded uppercase tracking-wide flex-shrink-0 whitespace-nowrap">
                          Coming Soon
                        </span>
                      )}
                    </div>
                    <p className="text-sm md:text-xs text-gray-600 leading-snug">{mode.subtitle}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <button
          onClick={startSession}
          disabled={starting}
          className="w-full text-white rounded-lg py-2.5 px-6 font-semibold text-sm md:text-xs transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          style={GRADIENT}
        >
          {starting && <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-r-transparent"></div>}
          {starting ? 'Building your interview...' : 'Start Interview'}
        </button>

        <p className="text-center text-[11px] text-gray-400 py-1">Your progress is saved automatically.</p>

        <BackLink onClick={onBack} />
      </div>
    );
  }

  // ==========================================================================
  // STATE 3 — POST-SESSION
  // ==========================================================================

  if (sessionState === 'completed' && completion) {
    return (
      <div className="px-5 py-4 space-y-3 flex-1 flex flex-col">
        <h3 className="text-lg font-semibold text-gray-900 -mt-3">Interview Complete</h3>

        {/* The results themselves are the left panel's: sorting ten questions
            into categories needs the width. This column explains what the
            categories mean, so the colours over there are not a code the
            candidate has to break. */}
        <p className="text-sm md:text-xs text-gray-600 leading-relaxed mb-2">
          Here&apos;s how your answers were evaluated.
        </p>

        <div className="space-y-2">
          {[
            {
              heading: '🎯 Nailed It',
              color: '#9333ea',
              body: 'Answers scoring 80 or above. These landed clearly and demonstrated real competency.'
            },
            {
              heading: '💪 Solid Ground',
              color: '#81c784',
              body: 'Answers scoring 60 to 79. Good foundation with room to sharpen examples or tighten delivery.'
            },
            {
              heading: '🌱 Room to Grow',
              color: '#ffc870',
              body: 'Answers below 60. These need stronger examples or a clearer framework. Use your coached stories to build better responses.'
            }
          ].map(({ heading, color, body }) => (
            <div key={heading}>
              <p className="text-sm font-bold" style={{ color }}>{heading}</p>
              <p className="text-sm md:text-xs text-gray-600 leading-snug">{body}</p>
            </div>
          ))}
        </div>

        <div className="bg-purple-50 border-l-4 border-purple-600 p-2 rounded-r">
          <p className="text-sm md:text-xs text-gray-700">
            Click any question on the left to review your full answer and detailed feedback.
          </p>
        </div>

        {/* Grouped so the links sit under the button rather than a third of
            the way down the column: the parent's space-y-3 is right between
            sections and too much between an action and its escape hatches. */}
        <div className="space-y-1.5">
          <button
            onClick={resetToIdle}
            className="mx-auto block text-white rounded-lg py-2.5 px-6 font-semibold text-sm md:text-xs transition-opacity hover:opacity-90"
            style={GRADIENT}
          >
            Practice Again
          </button>

          {/* Two ways out of a finished session: back a step, or out of the
              interview entirely. Not BackLink, which every other state shares
              and centres on its own. */}
          <div className="flex items-center justify-between gap-3">
            <button onClick={onBack} className="text-sm md:text-xs text-gray-400 hover:text-gray-600">
              ← Back
            </button>
            <button
              onClick={() => router.push('/interview-coach')}
              className="text-sm md:text-xs text-gray-400 hover:text-gray-600 whitespace-nowrap"
            >
              Return to Interview Coach
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // STATE 2 — MID-SESSION
  // ==========================================================================

  const currentAnswered = !!current?.user_answer_text;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">

      {/* Transcript. No progress bar of its own: the left panel owns every
          progress display now, and two of them disagreed as often as not. */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="space-y-3">
          {/* Answers show so the candidate can see what they said. Scores and
              feedback do not: this is meant to feel like the real room, and
              they are all waiting in the summary once the interview ends. */}
          {questions.slice(0, currentIndex + 1).map((q) => (
            <div key={q.id} className="space-y-2">
              <InterviewerBubble text={q.question_text} />
              {q.user_answer_text && <AnswerBubble text={q.user_answer_text} />}
            </div>
          ))}

          {/* WRAP-UP — the interviewer signs off in the transcript rather than
              asking an eleventh question. Their own questions live on the left,
              where they can be read without being scored on them. */}
          {interviewDone && (
            <InterviewerBubble text="That wraps up our interview. In a real interview, this is where you'd have the chance to ask your own questions. Review the Questions for Your Interviewer on the left to have them ready." />
          )}

          {sending && (
            <div>
              <p className="text-xs md:text-[10px] text-gray-500 font-medium mb-1">🎤 Interviewer</p>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <div className="flex gap-1.5 items-center">
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Dock */}
      <div className="flex-shrink-0 border-t border-gray-100 p-3">

        {/* Advancing is automatic once an answer is scored, so the only button
            here is the one that ends the interview. */}
        {interviewDone && (
          <button
            onClick={completeSession}
            disabled={completing || scoredCount === 0}
            className="mx-auto block text-white rounded-lg py-2.5 px-6 font-semibold text-sm md:text-xs transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 mb-2"
            style={GRADIENT}
          >
            {completing && <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-r-transparent"></div>}
            {completing ? 'Scoring your interview...' : 'Complete Interview'}
          </button>
        )}

        {/* Input. Gone once the last answer is in: there is nothing left to
            type, and an empty box beside the wrap-up invites an answer that
            has nowhere to go. */}
        {!interviewDone && !currentAnswered && (
          <>
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onInput={e => {
                  if (isMobile) return;
                  e.target.style.height = 'auto';
                  // Same fixed cap the resume coach input uses. Sizing off the
                  // viewport let the box grow to most of the panel before it
                  // ever started scrolling, which pushed the dock off screen.
                  const maxHeight = 120;
                  const target = Math.min(e.target.scrollHeight, maxHeight);
                  e.target.style.height = target + 'px';
                  e.target.style.overflowY = e.target.scrollHeight > target ? 'auto' : 'hidden';
                  e.target.scrollIntoView({ block: 'end', behavior: 'instant' });
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submitAnswer();
                  }
                }}
                placeholder="Type your answer..."
                disabled={sending}
                rows={2}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-base md:text-xs focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                style={
                  isMobile
                    ? { height: '4.5rem', overflowY: 'auto' }
                    : { overflowY: 'hidden', maxHeight: '120px' }
                }
              />
              <button
                onClick={submitAnswer}
                disabled={!input.trim() || sending}
                className="flex-shrink-0 flex items-center justify-center rounded-lg transition-colors disabled:opacity-30"
                style={{
                  width: '32px',
                  background: input.trim() && !sending ? 'linear-gradient(to right, #667eea, #764ba2)' : '#d1d5db',
                  alignSelf: 'stretch'
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-4 h-4">
                  <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                </svg>
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mt-1 text-center font-bold italic">Enter to send. Shift+Enter for a new line.</p>
          </>
        )}

        <p className="text-center text-[11px] text-gray-400 py-1">Your progress is saved automatically.</p>

        {/* Two ways to stop, and the difference is whether they want scoring.
            Leaving needs no confirmation — the session row survives and the
            resume lookup drops them back into it. Ending does, because it
            closes the session for good. */}
        {/* Centred as a pair rather than as text: the two labels together are
            wider than this column at some widths, and text-center would centre
            each wrapped line on its own and read as ragged. */}
        <div className="flex items-center justify-center gap-2">
          <button onClick={onBack} className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer whitespace-nowrap">
            Pause &amp; Continue Later
          </button>
          {answeredCount > 0 && (
            <>
              <span className="text-xs text-gray-300">·</span>
              <button onClick={endEarly} className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer whitespace-nowrap">
                End &amp; Get Feedback
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
