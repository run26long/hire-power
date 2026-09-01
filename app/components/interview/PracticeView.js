'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import VoiceConsentModal from './VoiceConsentModal';

// ============================================================================
// SHARED VISUALS
// Gradients stay inline: Tailwind classes carry tints only. Scoring visuals
// live in PracticeLeftPanel now — this column runs the interview, the other
// one reports on it.
// ============================================================================

const GRADIENT = { background: 'linear-gradient(to right, #667eea, #764ba2)' };

// Five minutes of one answer is well past the point where an interviewer has
// stopped listening. The cap is a backstop for a recording left running, not
// a target, so it stops rather than warns.
const MAX_RECORDING_SECONDS = 300;

// Recording red. Matches the "Room to Grow" band in the results, which is the
// only other place this column uses a warm signal colour.
const RECORDING_RED = '#e57373';

// mode_1 stays visible and unavailable: its consent promises recordings kept
// for playback, and there is nowhere to keep them until storage is wired.
// Offering it before then would take consent for something we don't do.
const MODES = [
  { key: 'mode_3', icon: '💬', title: 'Text Interview', subtitle: 'Type your answers', available: true },
  { key: 'mode_2', icon: '🎤', title: 'Voice Interview', subtitle: 'Speak your answers, no recording', available: true },
  { key: 'mode_1', icon: '🎙️', title: 'Voice Interview + Playback', subtitle: 'Speak with recording for review', available: false }
];

// mode_3 is typed and opens nothing. The other two reach for the microphone,
// so each carries its own recorded consent: agreeing to one is not agreeing
// to the other, and mode_1 keeps audio that mode_2 never writes down.
const CONSENT_REQUIRED_MODES = ['mode_1', 'mode_2'];

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

function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// ============================================================================
// VOICE INPUT PANEL
// The dock's contents in a voice session, in place of the textarea. Pure
// presentation: every stage transition is decided by the parent, which owns
// the microphone, the audio element and the timers.
//
// "Type instead" is on every stage but review, where the transcript is already
// sitting in an editable box and typing is what the candidate is doing.
// ============================================================================

function VoiceInputPanel({
  stage,
  recordingSeconds,
  transcript,
  sending,
  onTranscriptChange,
  onSkipSpeaking,
  onStartRecording,
  onStopRecording,
  onSubmit,
  onReRecord,
  onTypeInstead
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-2">

      {stage === 'speaking' && (
        <>
          <div
            className="h-16 w-16 rounded-full flex items-center justify-center animate-pulse"
            style={GRADIENT}
          >
            <span className="text-2xl">🔊</span>
          </div>
          <p className="text-sm md:text-xs text-gray-500">Speaking...</p>
          <button onClick={onSkipSpeaking} className="text-xs text-gray-400 hover:text-gray-600">
            Skip
          </button>
        </>
      )}

      {stage === 'ready' && (
        <>
          <button
            type="button"
            onClick={onStartRecording}
            aria-label="Start recording"
            className="h-16 w-16 rounded-full flex items-center justify-center transition-opacity hover:opacity-90"
            style={GRADIENT}
          >
            <span className="text-2xl">🎤</span>
          </button>
          <p className="text-sm md:text-xs text-gray-500">Tap to start recording</p>
        </>
      )}

      {stage === 'recording' && (
        <>
          <button
            type="button"
            onClick={onStopRecording}
            aria-label="Stop recording"
            className="h-16 w-16 rounded-full flex items-center justify-center animate-pulse transition-opacity hover:opacity-90"
            style={{ backgroundColor: RECORDING_RED }}
          >
            <span className="text-2xl">🎤</span>
          </button>
          <p className="text-sm md:text-xs text-red-500">Recording... tap to stop</p>
          <p className="text-xs font-mono text-gray-400">{formatDuration(recordingSeconds)}</p>
        </>
      )}

      {stage === 'processing' && (
        <>
          <div className="h-8 w-8 animate-spin border-2 border-purple-600 border-t-transparent rounded-full"></div>
          <p className="text-sm md:text-xs text-gray-500">Transcribing...</p>
        </>
      )}

      {stage === 'review' && (
        <div className="w-full space-y-2">
          <textarea
            value={transcript}
            onChange={e => onTranscriptChange(e.target.value)}
            rows={4}
            disabled={sending}
            className="w-full border border-gray-200 rounded-lg p-3 text-sm md:text-xs text-gray-800 leading-snug focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
          />
          <p className="text-xs text-gray-400 text-center">Edit your answer or submit as-is</p>
          <div className="flex gap-2">
            <button
              onClick={onSubmit}
              disabled={!transcript.trim() || sending}
              className="flex-1 text-white rounded-lg py-2 px-4 font-semibold text-sm md:text-xs transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              style={GRADIENT}
            >
              {sending && <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-r-transparent"></div>}
              {sending ? 'Sending...' : 'Submit'}
            </button>
            <button
              onClick={onReRecord}
              disabled={sending}
              className="flex-1 border border-gray-300 text-gray-600 rounded-lg py-2 px-4 font-semibold text-sm md:text-xs hover:bg-gray-50 disabled:opacity-50"
            >
              Re-record
            </button>
          </div>
        </div>
      )}

      {stage !== 'review' && (
        <button onClick={onTypeInstead} className="text-xs text-gray-400 hover:text-gray-600">
          Type instead
        </button>
      )}
    </div>
  );
}

// ============================================================================
// END INTERVIEW MODAL
// The job card modal's bones at alert size: same backdrop, same gradient
// header, same footer buttons, no scrolling body. Replaces the window.confirm
// that used to ask this, which was the one dialog in the flow wearing the
// browser's chrome instead of ours.
// ============================================================================

function EndInterviewModal({ onCancel, onConfirm, confirming, hasScored }) {
  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={onCancel}
    >
      <div
        className="bg-white shadow-2xl overflow-hidden flex flex-col"
        style={{ borderRadius: '12px', width: '364px' }}
        onClick={e => e.stopPropagation()}
      >
        <div
          style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)' }}
          className="px-6 py-5 relative flex-shrink-0"
        >
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 text-white hover:text-gray-200 text-3xl leading-none font-light"
          >×</button>
          <div className="flex items-center gap-3">
            <img src="/images/Hire_Power_icon.png" alt="Hire Power" className="h-8 w-auto flex-shrink-0" />
            <h2 className="text-xl font-bold text-white">End Interview?</h2>
          </div>
        </div>

        <div className="p-5">
          {/* Nothing scored means nothing to keep: say that rather than promise
              results this session cannot produce. */}
          <p className="text-sm md:text-xs text-gray-700 leading-relaxed">
            {hasScored
              ? "Your answered questions will be scored and saved. Unanswered questions won't be included in your results."
              : 'No answers have been scored yet. Ending now will discard this session.'}
          </p>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0 justify-center">
          <button
            onClick={onCancel}
            disabled={confirming}
            className="py-2 px-5 border border-gray-200 rounded-lg text-sm md:text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={confirming}
            className="py-2 px-8 rounded-lg text-sm md:text-xs font-bold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
          >
            {confirming ? 'Ending...' : hasScored ? 'End & Get Feedback' : 'End Session'}
          </button>
        </div>
      </div>
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
  // Back to the coaching step to build more stories. Falls back to onBack so
  // the button still leads somewhere if the parent doesn't wire it.
  onGoToCoach = onBack,
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
  // The mode the candidate clicked and has not yet consented to. Non-null is
  // what puts the consent modal on screen; selectedMode does not move until
  // the consent row is actually written.
  const [pendingVoiceMode, setPendingVoiceMode] = useState(null);
  const [checkingConsent, setCheckingConsent] = useState(false);
  const [starting, setStarting] = useState(false);
  const [sending, setSending] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [coachingLoading, setCoachingLoading] = useState(false);
  const [resuming, setResuming] = useState(true);

  const [input, setInput] = useState('');

  // Voice input. Local UI only: nothing here survives a refresh, and nothing
  // persists until the transcript goes through submitAnswer like any answer.
  // 'idle' covers the states with no voice control on screen at all.
  const [voiceStage, setVoiceStage] = useState('idle');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  // The one question the candidate chose to type. Cleared on every question
  // change: opting out of the microphone once is not opting out of the mode.
  const [typedFallbackId, setTypedFallbackId] = useState(null);

  const [showEndConfirm, setShowEndConfirm] = useState(false);

  const audioRef = useRef(null);
  const audioUrlRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const durationTimerRef = useRef(null);
  const secondsRef = useRef(0);
  // Bumped on every question change. Anything async that comes back holding a
  // stale generation is answering about a question the candidate has left, so
  // it drops its result instead of speaking over the current one.
  const voiceGenerationRef = useRef(0);

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
      coachingLoading,
      startedAt: session?.started_at ?? null
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionState, session, questions, currentIndex, completion, coachingLoading]);

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

  // ── MODE SELECTION ──
  const handleSelectMode = async (modeKey) => {
    if (!CONSENT_REQUIRED_MODES.includes(modeKey)) {
      setSelectedMode(modeKey);
      return;
    }
    if (checkingConsent || !userId) return;

    setCheckingConsent(true);
    try {
      const { data, error } = await supabase
        .from('user_voice_consent')
        .select('id')
        .eq('user_id', userId)
        .eq('mode_selected', modeKey)
        .limit(1)
        .maybeSingle();

      // Fails closed. A lookup that didn't answer is not a consent on file,
      // and asking a second time costs a click where assuming costs a promise.
      if (error) {
        console.error('Voice consent lookup failed:', error);
        setPendingVoiceMode(modeKey);
        return;
      }

      if (data) setSelectedMode(modeKey);
      else setPendingVoiceMode(modeKey);
    } finally {
      setCheckingConsent(false);
    }
  };

  // The mode is not selected until the row lands. A consent we agreed to but
  // failed to record is not a consent we can show anyone later, so a failed
  // write drops back to text rather than opening the microphone anyway.
  const handleConsentGranted = async (record) => {
    const modeKey = pendingVoiceMode;

    const { error } = await supabase
      .from('user_voice_consent')
      .insert({ user_id: userId, ...record });

    setPendingVoiceMode(null);

    if (error) {
      console.error('Voice consent write failed:', error);
      setSelectedMode('mode_3');
      onError("We couldn't record your consent, so we've kept you in text mode. Try again in a moment.");
      return;
    }

    setSelectedMode(modeKey);
  };

  const handleConsentCancelled = () => {
    setPendingVoiceMode(null);
    setSelectedMode('mode_3');
  };

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

  // ==========================================================================
  // VOICE
  // The interviewer speaks, the candidate records, the recording becomes text,
  // and the text goes through submitAnswer exactly as a typed answer does.
  // Nothing below touches the session or the database: the audio's only job is
  // to become a transcript, and it is discarded once it has.
  // ==========================================================================

  const isVoiceSession = session?.voice_mode === 'mode_1' || session?.voice_mode === 'mode_2';
  const typingThisQuestion = !!current && typedFallbackId === current.id;

  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  };

  // Clears onstop before stopping on purpose: a recording torn down because the
  // question changed must not transcribe itself into the next question's box.
  const teardownRecorder = () => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    const recorder = mediaRecorderRef.current;
    if (recorder) {
      recorder.onstop = null;
      recorder.ondataavailable = null;
      if (recorder.state !== 'inactive') {
        try { recorder.stop(); } catch (err) { console.error('Recorder stop failed:', err); }
      }
      mediaRecorderRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    audioChunksRef.current = [];
    secondsRef.current = 0;
  };

  const speakQuestion = async (text, generation) => {
    try {
      const token = await getToken();
      if (!token || generation !== voiceGenerationRef.current) return;

      const res = await fetch('/api/interview/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ session_id: session.id, text })
      });
      if (generation !== voiceGenerationRef.current) return;

      // A question that can't be spoken is still a question they can read: it
      // is on screen above. Drop to the microphone rather than stranding the
      // interview on an audio failure.
      if (!res.ok) { setVoiceStage('ready'); return; }

      const blob = await res.blob();
      if (generation !== voiceGenerationRef.current) return;

      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        if (generation === voiceGenerationRef.current) setVoiceStage('ready');
      };
      audio.onerror = () => {
        if (generation === voiceGenerationRef.current) setVoiceStage('ready');
      };
      await audio.play();
    } catch (err) {
      // Autoplay refused, or the request died. Same answer either way.
      console.error('Question playback failed:', err);
      if (generation === voiceGenerationRef.current) setVoiceStage('ready');
    }
  };

  const transcribe = async (blob) => {
    setVoiceStage('processing');
    try {
      const token = await getToken();
      if (!token) {
        onError('Your session expired. Refresh the page and sign in again.');
        setVoiceStage('ready');
        return;
      }

      const form = new FormData();
      // No Content-Type header: the browser writes it along with the multipart
      // boundary, and setting it by hand breaks the body the route receives.
      form.append('audio', blob, 'answer.webm');
      form.append('session_id', session.id);

      const res = await fetch('/api/interview/stt', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: form
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.transcript) {
        onError(
          data.error === 'AUDIO_EMPTY' || (res.ok && !data.transcript)
            ? "We didn't catch anything in that recording. Try again, or type your answer."
            : "We couldn't transcribe that recording. Try again, or type your answer."
        );
        setVoiceStage('ready');
        return;
      }

      // Straight into the same box a typed answer uses, so Submit is the same
      // path with the same validation.
      setInput(data.transcript);
      setVoiceStage('review');
    } catch (err) {
      console.error('Transcription failed:', err);
      onError("We couldn't transcribe that recording. Try again, or type your answer.");
      setVoiceStage('ready');
    }
  };

  const stopRecording = () => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  };

  const startRecording = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      onError('Voice mode needs microphone access. Enable it in your browser settings, or switch to text mode.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = e => {
        if (e.data && e.data.size) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        // The recorder's own mimeType, not a guess: Safari records mp4 where
        // Chrome records webm, and the route reads the format off the type.
        const type = recorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type });
        audioChunksRef.current = [];
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach(track => track.stop());
          mediaStreamRef.current = null;
        }
        if (!blob.size) {
          onError("We didn't catch anything in that recording. Try again, or type your answer.");
          setVoiceStage('ready');
          return;
        }
        transcribe(blob);
      };

      recorder.start();
      secondsRef.current = 0;
      setRecordingSeconds(0);
      setVoiceStage('recording');

      durationTimerRef.current = setInterval(() => {
        secondsRef.current += 1;
        setRecordingSeconds(secondsRef.current);
        if (secondsRef.current >= MAX_RECORDING_SECONDS) stopRecording();
      }, 1000);
    } catch (err) {
      console.error('Microphone access failed:', err);
      onError('Voice mode needs microphone access. Enable it in your browser settings, or switch to text mode.');
      setVoiceStage('ready');
    }
  };

  const skipSpeaking = () => {
    stopPlayback();
    setVoiceStage('ready');
  };

  const reRecord = () => {
    setInput('');
    secondsRef.current = 0;
    setRecordingSeconds(0);
    setVoiceStage('ready');
  };

  // Scoped to this question only. The session stays a voice session, and the
  // next question opens with the interviewer speaking as usual.
  const typeInstead = () => {
    stopPlayback();
    teardownRecorder();
    setVoiceStage('idle');
    setTypedFallbackId(current?.id ?? null);
  };

  // ── Speak each new question, and tear the last one down ──
  useEffect(() => {
    if (!isVoiceSession) return;

    const generation = ++voiceGenerationRef.current;
    stopPlayback();
    teardownRecorder();
    setRecordingSeconds(0);
    setTypedFallbackId(null);
    setInput('');

    // Nothing to speak: between questions, on the wrap-up, or on a question
    // that already has its answer.
    if (sessionState !== 'active' || !current || current.user_answer_text) {
      setVoiceStage('idle');
      return;
    }

    setVoiceStage('speaking');
    speakQuestion(current.question_text, generation);

    return () => {
      stopPlayback();
      teardownRecorder();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVoiceSession, sessionState, current?.id]);

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

      // Not awaited: coaching is a second model call over the whole session,
      // and the candidate should be reading their scores while it runs rather
      // than watching a spinner for both.
      loadCoaching(session.id);
    } catch (err) {
      console.error('Complete practice session failed:', err);
      onError("We couldn't wrap up your practice session right now. Try again in a moment.");
    } finally {
      setCompleting(false);
    }
  };

  // ── COACHING ──
  // Power-Analysis-informed notes, one per question, generated after the fact.
  // A failure here is silent: the results are complete without it, and an
  // error toast over a finished interview would read as though the scores
  // themselves had gone wrong.
  const loadCoaching = async (sessionId) => {
    setCoachingLoading(true);
    try {
      const token = await getToken();
      if (!token) return;

      const res = await fetch('/api/interview/session-coaching', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ session_id: sessionId })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error('Session coaching failed:', data.error);
        return;
      }

      const byId = new Map(
        (data.coaching || []).map(c => [c.question_id, c.coaching_feedback])
      );
      if (byId.size === 0) return;

      setQuestions(prev => prev.map(q => (
        byId.has(q.id) ? { ...q, coaching_feedback: byId.get(q.id) } : q
      )));
    } catch (err) {
      console.error('Session coaching request failed:', err);
    } finally {
      setCoachingLoading(false);
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

  const endEarly = () => setShowEndConfirm(true);

  const confirmEndEarly = async () => {
    if (scoredCount > 0) {
      // The modal stays up through the call and goes away with the whole
      // mid-session view when the session flips to completed.
      await completeSession();
      return;
    }

    // Nothing scored, so there is nothing worth keeping. Dropped locally rather
    // than written anywhere: the row stays in_progress until the cleanup runs.
    dismissedSessionIdRef.current = session?.id ?? null;
    setShowEndConfirm(false);
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
                onClick={() => mode.available && handleSelectMode(mode.key)}
                disabled={!mode.available || checkingConsent}
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

        {pendingVoiceMode && (
          <VoiceConsentModal
            mode={pendingVoiceMode}
            onConsent={handleConsentGranted}
            onCancel={handleConsentCancelled}
          />
        )}
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

        {/* Two ways onward, sized to their labels. Practising again lives on
            the score card in the left column, and the progress strip above
            carries every other move, so neither is repeated here. */}
        <div className="flex gap-3 justify-center">
          <button
            onClick={onGoToCoach}
            className="bg-white text-purple-600 border border-purple-300 rounded-lg py-2 px-6 text-sm md:text-xs font-semibold hover:bg-purple-50 transition-colors"
          >
            Coach Stories
          </button>
          <button
            onClick={() => router.push('/interview-coach')}
            className="bg-white text-purple-600 border border-purple-300 rounded-lg py-2 px-6 text-sm md:text-xs font-semibold hover:bg-purple-50 transition-colors"
          >
            Interview Coach
          </button>
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
            <InterviewerBubble text={"That wraps up our interview. In a real interview, this is where you'd have the chance to ask your own questions. Review the Questions for Your Interviewer on the left to have them ready.\n\nWhen you're ready, complete your interview to see your scores and personalized feedback."} />
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

        {/* Voice dock. Same slot as the textarea, same two lines beneath it. */}
        {!interviewDone && !currentAnswered && isVoiceSession && !typingThisQuestion && (
          <VoiceInputPanel
            stage={voiceStage}
            recordingSeconds={recordingSeconds}
            transcript={input}
            sending={sending}
            onTranscriptChange={setInput}
            onSkipSpeaking={skipSpeaking}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            onSubmit={submitAnswer}
            onReRecord={reRecord}
            onTypeInstead={typeInstead}
          />
        )}

        {/* Input. Gone once the last answer is in: there is nothing left to
            type, and an empty box beside the wrap-up invites an answer that
            has nowhere to go. */}
        {!interviewDone && !currentAnswered && (!isVoiceSession || typingThisQuestion) && (
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

      {showEndConfirm && (
        <EndInterviewModal
          onCancel={() => setShowEndConfirm(false)}
          onConfirm={confirmEndEarly}
          confirming={completing}
          hasScored={scoredCount > 0}
        />
      )}
    </div>
  );
}
