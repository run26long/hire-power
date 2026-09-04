'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';

// ============================================================================
// PRACTICE LEFT PANEL
// The working surface for the practice step. Mirrors the session the right
// column is driving; it never owns session state of its own.
// ============================================================================

const GRADIENT = { background: 'linear-gradient(to right, #667eea, #764ba2)' };

// Three bands, cut where the completion columns cut: an answer's colour and
// the column it lands in are the same judgement, so they read off the same
// two numbers.
function scoreColor(score) {
  if (score >= 80) return '#9333ea';
  if (score >= 60) return '#81c784';
  return '#ffc870';
}

// The three bands the score ramp reads as, named the way the completion
// columns name them, so the key under the bar and the columns beside it are
// saying one thing rather than two.
const SCORE_LEGEND = [
  { color: '#ffc870', label: 'Room to Grow' },
  { color: '#81c784', label: 'Solid Ground' },
  { color: '#9333ea', label: 'Nailed It' },
];

// Names the band a score falls in. Thresholds are scoreColor's, so a dot and
// the word beside it can never disagree.
function scoreBand(score) {
  if (score >= 80) return 'Nailed It';
  if (score >= 60) return 'Solid Ground';
  return 'Room to Grow';
}

// What the categories sort on. Content carries more weight than clarity: a
// well-organized answer to the wrong question is still the wrong answer.
const WEIGHT_CLARITY = 0.40;
const WEIGHT_CONTENT = 0.60;

function weightedScore(q) {
  return (q.score_structure ?? 0) * WEIGHT_CLARITY + (q.score_content ?? 0) * WEIGHT_CONTENT;
}

function isFailed(q) {
  return q.evaluation_status === 'failed' || q.evaluation_status === 'needs_retry';
}

// Amber is the only fill light enough to need dark text on it, and it is now
// the bottom band rather than the middle one.
function scoreTextClass(score) {
  return score < 60 ? 'text-gray-900' : 'text-white';
}

function ScorePill({ label, value }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs md:text-[10px] font-semibold ${scoreTextClass(value)}`}
      style={{ backgroundColor: scoreColor(value) }}
    >
      {label}: {value}
    </span>
  );
}

// The three columns, best first. Structure is the Coach step's BucketColumn;
// only the palette and the floors differ.
const RESULT_COLUMNS = [
  { key: 'nailed', title: 'Nailed It',    icon: '🎯', color: 'purple', min: 80,
    emptyText: 'Nothing scored 80 or above this time.' },
  { key: 'solid',  title: 'Solid Ground', icon: '💪', color: 'green',  min: 60,
    emptyText: 'Nothing landed in this range.' },
  { key: 'grow',   title: 'Room to Grow', icon: '🌱', color: 'amber',  min: 0,
    emptyText: 'Nothing fell below 60. Strong session.' },
];

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

// ============================================================================
// DELETE SESSION MODAL
// EndInterviewModal's shape: the other place in practice where something is
// confirmed before it cannot be taken back. Red on the confirm rather than the
// gradient, because this one destroys rather than proceeds.
// ============================================================================

export function DeleteSessionModal({ onCancel, onConfirm, deleting }) {
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
            disabled={deleting}
            className="absolute top-4 right-4 text-white hover:text-gray-200 text-3xl leading-none font-light"
          >×</button>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-lg">🗑️</span>
            </div>
            <h2 className="text-xl font-bold text-white">Delete Practice Session</h2>
          </div>
        </div>

        <div className="p-5">
          <p className="text-sm md:text-xs text-gray-700 leading-relaxed">
            This will permanently delete this practice session, including all scores, feedback, and audio recordings. This cannot be undone.
          </p>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0 justify-center">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="py-2 px-5 border border-gray-200 rounded-lg text-sm md:text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="py-2 px-8 rounded-lg text-sm md:text-xs font-bold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{ backgroundColor: '#e57373' }}
          >
            {deleting ? 'Deleting...' : 'Delete Session'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SessionRow({ session, onClick, onDeleteRequest }) {
  const score = session.readiness_score_after ?? 0;
  // Whether they spoke it or typed it. Anything unrecognised reads as text,
  // which is what a session with no mode recorded on it was.
  const isVoice = session.voice_mode === 'mode_1' || session.voice_mode === 'mode_2';
  // Still open. It has no readiness score and no level yet, and showing the
  // zeroes it would default to would read as a session that scored nothing
  // rather than one that has not finished.
  const isPaused = session.status === 'in_progress';
  return (
    <div
      onClick={onClick}
      className="group border border-gray-200 rounded-lg px-3 py-2.5 hover:border-purple-300 hover:shadow-sm transition-all cursor-pointer overflow-hidden flex items-center"
      style={{ height: '66px' }}
    >
      <div className="flex items-center w-full gap-3">
        <div className="min-w-0 md:flex-shrink-0 md:w-36">
          <div className="text-base md:text-sm font-semibold text-gray-900 truncate">
            {formatDate(session.completed_at || session.created_at)}
          </div>
          <div className="text-sm md:text-xs text-gray-500 truncate">
            {session.questions_answered ?? 0} of {session.question_count_target ?? 0} answered
          </div>
        </div>

        {!isPaused && score > 0 && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-[9px] text-gray-400 uppercase tracking-wide whitespace-nowrap">
              Session Score
            </span>
            <div className="relative w-8 h-8">
              <svg className="w-8 h-8 transform -rotate-90">
                <circle cx="16" cy="16" r="12" stroke="#e5e7eb" strokeWidth="2.5" fill="none" />
                <circle
                  cx="16" cy="16" r="12"
                  stroke={scoreColor(score)}
                  strokeWidth="2.5" fill="none"
                  strokeDasharray={`${2 * Math.PI * 12}`}
                  strokeDashoffset={`${2 * Math.PI * 12 * (1 - score / 100)}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-[9px] font-bold" style={{ color: scoreColor(score) }}>{score}</div>
              </div>
            </div>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          {isPaused && (
            <span className="text-xs md:text-[9px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">
              Paused
            </span>
          )}
          <span
            className={`text-sm font-bold uppercase ${isVoice ? '' : 'text-gray-400'}`}
            style={isVoice ? { color: '#9333ea' } : undefined}
          >
            {isVoice ? 'Voice' : 'Text'}
          </span>
          {/* The row itself opens the session for review, so this has to stop
              the click before it gets there. */}
          <button
            onClick={(e) => { e.stopPropagation(); onDeleteRequest(); }}
            className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-full bg-[#fdecea] hover:bg-[#e57373] flex items-center justify-center text-[#e57373] hover:text-white transition-all flex-shrink-0"
            title="Delete session"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// The hub shows three cards and a link rather than a list that grows without
// end. Matched here by count, the same way it does it.
const VISIBLE_SESSIONS = 5;

// The hub's own modal shell: same backdrop, same max-w-lg card, same gradient
// header with a count, same 60vh scrolling body.
function AllSessionsModal({ sessions, onSelectSession, onDeleteRequest, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4" style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)' }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Practice Sessions</h2>
              <p className="text-purple-100 text-xs">{sessions.length} sessions</p>
            </div>
            <button onClick={onClose} className="text-white text-2xl leading-none font-light hover:opacity-70">×</button>
          </div>
        </div>
        <div className="px-6 py-4 overflow-y-auto" style={{ maxHeight: '60vh' }}>
          <div className="space-y-2">
            {sessions.map(s => (
              <SessionRow
                key={s.id}
                session={s}
                onClick={() => onSelectSession?.(s)}
                onDeleteRequest={() => onDeleteRequest?.(s)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SessionList({ sessions, onSelectSession, onDeleteRequest, onViewAll }) {
  if (!sessions?.length) {
    return (
      <div className="text-center py-4">
        <div className="text-2xl mb-1">🎯</div>
        <p className="text-sm md:text-xs text-gray-500">
          Complete your first mock interview to see your progress here.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3">
        {sessions.slice(0, VISIBLE_SESSIONS).map(s => (
          <SessionRow
            key={s.id}
            session={s}
            onClick={() => onSelectSession?.(s)}
            onDeleteRequest={() => onDeleteRequest?.(s)}
          />
        ))}
      </div>
      {sessions.length > VISIBLE_SESSIONS && (
        <button
          onClick={onViewAll}
          className="w-full text-center py-1.5 text-sm md:text-xs text-purple-600 hover:text-purple-700 font-medium transition-colors"
        >
          View all practice sessions →
        </button>
      )}
    </div>
  );
}

// Lifted from the Coach step's BucketColumn: same container, same header row,
// same item button. Purple joins the palette because the Coach step has no
// bucket that colour and these categories have always used it. The coach-mode
// select-all and the coached-story badge are dropped — neither means anything
// to a finished interview.
function ResultColumn({ title, icon, colorClass, questions, emptyText, onQuestionClick }) {
  const colors = {
    purple: { border: 'border-purple-200', bg: 'bg-purple-50', titleText: 'text-purple-800', countText: 'text-purple-700', emptyText: 'text-purple-700' },
    green:  { border: 'border-green-200',  bg: 'bg-green-50',  titleText: 'text-green-800',  countText: 'text-green-700',  emptyText: 'text-green-700' },
    amber:  { border: 'border-amber-200',  bg: 'bg-amber-50',  titleText: 'text-amber-800',  countText: 'text-amber-700',  emptyText: 'text-amber-800' }
  };
  const c = colors[colorClass];

  return (
    <div className={`border ${c.border} rounded-lg p-3 ${c.bg}`}>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-base">{icon}</span>
        <h4 className={`text-sm md:text-xs font-bold ${c.titleText}`}>{title}</h4>
        <div className="ml-auto flex items-center gap-2">
          <span className={`text-xs md:text-[10px] ${c.countText} font-semibold`}>{questions.length}</span>
        </div>
      </div>
      {questions.length === 0 ? (
        <p className={`text-sm md:text-xs ${c.emptyText} italic`}>{emptyText}</p>
      ) : (
        <ul className="space-y-2">
          {questions.map(({ q, number }) => (
            <li key={q.id}>
              <button
                onClick={() => onQuestionClick({ q, number, icon })}
                className="w-full text-left bg-white rounded p-2 border hover:border-purple-300 hover:shadow-sm transition-all cursor-pointer block"
                style={{ borderColor: '#ffffff' }}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  {/* Clamped because a question runs far longer than the skill
                      names this card was built for. The full text is a click away. */}
                  <p className="text-sm md:text-xs font-bold text-gray-900 flex-1 line-clamp-2">
                    #{number}: {q.question_text}
                  </p>
                </div>
                {isFailed(q) ? (
                  <p className="text-xs text-gray-400">Evaluation unavailable</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    <ScorePill label="Clarity" value={q.score_structure ?? 0} />
                    <ScorePill label="Content" value={q.score_content ?? 0} />
                  </div>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ============================================================================
// ANSWER AUDIO PLAYER
// Mode 1 only. A play button and a bar, not a browser audio element: this sits
// inside a feedback modal and native chrome would be the loudest thing in it.
//
// The signed URL is fetched on the first press and kept for the life of the
// modal. It outlasts any single playback, and asking for one before the
// candidate has shown interest would sign a link nobody uses.
// ============================================================================

function AnswerAudioPlayer({ questionId }) {
  const supabase = createClient();
  const audioRef = useRef(null);
  const urlRef = useRef(null);

  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, []);

  const loadUrl = async () => {
    if (urlRef.current) return urlRef.current;

    const { data: { session: authSession } } = await supabase.auth.getSession();
    const token = authSession?.access_token;
    if (!token) return null;

    const res = await fetch('/api/interview/audio-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ question_id: questionId })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) return null;

    urlRef.current = data.url;
    return data.url;
  };

  const toggle = async () => {
    if (loading) return;

    if (playing && audioRef.current) {
      audioRef.current.pause();
      setPlaying(false);
      return;
    }

    if (audioRef.current) {
      audioRef.current.play().catch(() => setUnavailable(true));
      setPlaying(true);
      return;
    }

    setLoading(true);
    try {
      const url = await loadUrl();
      if (!url) { setUnavailable(true); return; }

      const audio = new Audio(url);
      audioRef.current = audio;
      audio.ontimeupdate = () => {
        if (audio.duration) setProgress((audio.currentTime / audio.duration) * 100);
      };
      audio.onended = () => { setPlaying(false); setProgress(0); };
      audio.onerror = () => { setUnavailable(true); setPlaying(false); };
      await audio.play();
      setPlaying(true);
    } catch (err) {
      console.error('Answer playback failed:', err);
      setUnavailable(true);
    } finally {
      setLoading(false);
    }
  };

  // An upload that failed during the interview ends here. Said plainly and
  // quietly: the answer and its scores above are all intact.
  if (unavailable) {
    return <p className="text-xs text-gray-400">Recording unavailable</p>;
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={toggle}
        disabled={loading}
        aria-label={playing ? 'Pause your answer' : 'Play your answer'}
        className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        style={GRADIENT}
      >
        {loading
          ? <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
          : <span className="text-xs leading-none">{playing ? '❚❚' : '▶'}</span>}
      </button>
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ ...GRADIENT, width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// StoryModal's shell exactly: same backdrop, same max-w-lg 80vh card, same
// gradient header and close button, same scrollable body.
function FeedbackModal({ entry, voiceMode, coachingLoading, onClose }) {
  useEffect(() => {
    if (!entry) return;
    const handleKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [entry, onClose]);

  if (!entry) return null;

  const { q, number, icon } = entry;
  const failed = isFailed(q);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col"
        style={{ maxHeight: '80vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 flex-shrink-0" style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)' }}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="h-8 w-8 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-lg">{icon}</span>
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold text-white truncate">Question {number}</h2>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:opacity-70 text-2xl leading-none font-light flex-shrink-0"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-4" style={{ WebkitOverflowScrolling: 'touch' }}>
          <p className="text-sm md:text-xs font-bold text-gray-900 leading-snug">{q.question_text}</p>

          {q.user_answer_text && (
            <div>
              <p className="text-xs font-bold text-purple-700 uppercase tracking-wide mb-1">Your Answer</p>
              <p className="text-sm md:text-xs text-gray-800 leading-snug whitespace-pre-line">{q.user_answer_text}</p>
              {/* Only mode_1 kept a recording. Hearing it back is the point of
                  that mode, so it sits with the words rather than apart. */}
              {voiceMode === 'mode_1' && (
                <div className="mt-2">
                  <AnswerAudioPlayer questionId={q.id} />
                </div>
              )}
            </div>
          )}

          {failed ? (
            <p className="text-sm md:text-xs text-gray-400">Evaluation unavailable</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <ScorePill label="Clarity" value={q.score_structure ?? 0} />
                <ScorePill label="Content" value={q.score_content ?? 0} />
              </div>
              {q.feedback_structure && (
                <div>
                  <p className="text-xs font-bold text-purple-700 uppercase tracking-wide mb-1">Clarity Feedback</p>
                  <p className="text-sm md:text-xs text-gray-800 leading-snug">{q.feedback_structure}</p>
                </div>
              )}
              {q.feedback_content && (
                <div>
                  <p className="text-xs font-bold text-purple-700 uppercase tracking-wide mb-1">Content Feedback</p>
                  <p className="text-sm md:text-xs text-gray-800 leading-snug">{q.feedback_content}</p>
                </div>
              )}

              {/* Coaching arrives after the scores do. Absent and not loading
                  means the model skipped this one, and the modal simply ends
                  at the feedback above rather than explaining itself. */}
              {q.coaching_feedback ? (
                <div>
                  <p className="text-xs font-bold text-purple-700 uppercase tracking-wide mb-1">Coach&apos;s Notes</p>
                  <p className="text-sm md:text-xs text-gray-800 leading-snug">{q.coaching_feedback}</p>
                </div>
              ) : coachingLoading ? (
                <div>
                  <p className="text-xs font-bold text-purple-700 uppercase tracking-wide mb-1">Coach&apos;s Notes</p>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 animate-spin border-2 border-purple-600 border-t-transparent rounded-full flex-shrink-0"></div>
                    <span className="text-xs text-gray-400">Generating personalized feedback...</span>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Its own component so the modal's hooks mount and unmount with the completed
// state. PracticeLeftPanel returns early per state, so a hook on the parent
// would either run during every state or break the rules of hooks.
function CompletedPanel({
  completionData,
  questions,
  voiceMode,
  userId,
  sessionId,
  coachingLoading,
  onSuccess = () => {},
  onError = () => {}
}) {
  const supabase = createClient();
  const [openEntry, setOpenEntry] = useState(null);
  const [audioDeleted, setAudioDeleted] = useState(false);
  const [deletingAudio, setDeletingAudio] = useState(false);

  // One session's recordings, not the whole account's. The folder is known, so
  // this is a single listing rather than the two-level walk Settings needs.
  const deleteSessionAudio = async () => {
    if (deletingAudio || !userId || !sessionId) return;
    setDeletingAudio(true);
    try {
      const folder = `${userId}/${sessionId}`;
      const { data: files, error: listError } = await supabase.storage
        .from('interview-audio')
        .list(folder);
      if (listError) throw listError;

      const paths = (files || []).map(file => `${folder}/${file.name}`);
      if (paths.length > 0) {
        const { error: removeError } = await supabase.storage
          .from('interview-audio')
          .remove(paths);
        if (removeError) throw removeError;
      }

      // Nothing stored is the outcome they asked for either way.
      setAudioDeleted(true);
      onSuccess('Audio recording deleted.');
    } catch (err) {
      console.error('Session audio delete failed:', err);
      onError("Couldn't delete the recording. Try again.");
    } finally {
      setDeletingAudio(false);
    }
  };

  const summary = completionData.session_summary || {};
  const readiness = summary.readiness_score ?? 0;
  const clarity = summary.avg_score_structure ?? 0;
  const content = summary.avg_score_content ?? 0;

  // Numbered by their place in the interview, not their place in a column, so
  // the modal's "Question 3" is the third question they were asked. Numbered
  // before the filter for the same reason: dropping a question must not
  // renumber the ones after it.
  //
  // A question with no answer was never submitted and carries no scores. Left
  // in, every one of them would land in Room to Grow on a weighted score of
  // zero and read as an answer that failed rather than one never given.
  const numbered = questions
    .map((q, i) => ({ q, number: i + 1 }))
    .filter(({ q }) => !!q.user_answer_text?.trim());

  const columns = RESULT_COLUMNS.map(col => ({
    ...col,
    questions: numbered
      .filter(({ q }) => {
        const s = weightedScore(q);
        const above = RESULT_COLUMNS.filter(c => c.min > col.min);
        return s >= col.min && !above.some(c => s >= c.min);
      })
      .sort((a, b) => weightedScore(b.q) - weightedScore(a.q))
  }));

  return (
    <div className="space-y-3">

      {/* SCORE CARD — one row: the headline score and what it is made of.
          Stacked, these took most of the column before the candidate reached
          a single question. */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
        <div className="flex items-center gap-4">

          {/* READINESS */}
          <div className="flex flex-col items-center flex-shrink-0" style={{ width: '42%' }}>
            <div className="flex items-baseline gap-1">
              <span className="text-5xl font-bold text-gray-900">{readiness}</span>
              <span className="text-lg text-gray-600">/100</span>
            </div>
            <p className="text-xs font-bold uppercase tracking-wide mt-0.5" style={{ color: '#9333ea' }}>
              Interview Readiness
            </p>
            <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden shadow-inner mt-1.5">
              <div
                className="h-full transition-all duration-500"
                style={{ width: `${readiness}%`, background: scoreColor(readiness) }}
              />
            </div>
            <div className="flex items-center justify-between w-full text-[9px] text-gray-600 mt-1">
              {SCORE_LEGEND.map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }}></div>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* BREAKDOWN */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {[
              { label: 'Clarity', value: clarity },
              { label: 'Content', value: content },
              // Delivery has nothing behind it until voice mode ships. It holds
              // its place rather than appearing later and moving the other two.
              { label: 'Delivery', value: null }
            ].map(({ label, value }) => {
              const pending = value === null;
              return (
                <div
                  key={label}
                  className={`rounded-lg p-2 flex-1 text-center bg-gray-50 ${pending ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-baseline justify-center gap-0.5">
                    <span className="text-xl font-bold text-gray-900">{pending ? '—' : value}</span>
                    {!pending && <span className="text-xs text-gray-500">/100</span>}
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">{label}</p>
                  {pending ? (
                    <p className="text-[9px] text-gray-400">Voice Mode</p>
                  ) : (
                    <p className="text-[9px] text-gray-500 flex items-center justify-center gap-1">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: scoreColor(value) }}></span>
                      {scoreBand(value)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Only mode_1 recorded anything to delete. Its own line rather than
          inside the row above: that row is sized to the score and its
          breakdown, and a label this long would squeeze them. Right-aligned so
          it still reads as sitting under the card. */}
      {voiceMode === 'mode_1' && !audioDeleted && userId && sessionId && (
        <div className="flex justify-end -mt-1">
          <button
            onClick={deleteSessionAudio}
            disabled={deletingAudio}
            className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer disabled:opacity-50"
          >
            {deletingAudio ? 'Deleting...' : 'Delete audio recording'}
          </button>
        </div>
      )}

      {/* THREE COLUMNS — the Coach step's grid, same gaps. */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-3">
        {columns.map(col => (
          <ResultColumn
            key={col.key}
            title={col.title}
            icon={col.icon}
            colorClass={col.color}
            questions={col.questions}
            emptyText={col.emptyText}
            onQuestionClick={setOpenEntry}
          />
        ))}
      </div>

      {/* Re-resolved against the live rows rather than passed as opened:
          coaching lands after the modal may already be open, and a snapshot
          taken on click would leave the spinner turning forever. */}
      <FeedbackModal
        entry={openEntry && {
          ...openEntry,
          q: questions.find(x => x.id === openEntry.q.id) || openEntry.q
        }}
        voiceMode={voiceMode}
        coachingLoading={coachingLoading}
        onClose={() => setOpenEntry(null)}
      />
    </div>
  );
}

// ============================================================================
// INTERVIEW TIPS
// Static, every session the same. Nothing here is scored, generated or read
// from a row: it's the handful of things worth being reminded of while the
// next question is being read out.
// ============================================================================

const STAR_STEPS = [
  { label: 'Situation', text: 'Set the scene briefly' },
  { label: 'Task', text: 'What was your responsibility' },
  { label: 'Action', text: 'What YOU specifically did' },
  { label: 'Result', text: 'The measurable outcome' }
];

// The two categories every answer comes back scored on, said the way the
// feedback says them, so the panel and the scores use one vocabulary.
const SCORED_CATEGORIES = [
  { label: 'Clarity', text: 'How well-structured and easy to follow your answer is. Use a clear opening, logical flow, and a strong finish.' },
  { label: 'Content', text: 'How relevant and specific your answer is. Include real examples, numbers, and results from your experience.' }
];

const QUICK_TIPS = [
  'Take a breath before answering',
  "It's okay to pause and think",
  'Specific beats generic every time',
  'Connect your answer back to the role'
];

// The left rule is the one the research and prep cards carry, so a tip reads
// as the same kind of thing. overflow-hidden so a card that runs long is
// clipped rather than pushing its neighbours around.
function TipCard({ icon, title, children }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 border-l-4 border-l-purple-300 py-3 px-2.5 overflow-hidden">
      <p className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: '#9333ea' }}>
        {icon} {title}
      </p>
      {children}
    </div>
  );
}

export default function PracticeLeftPanel({
  // Only for the storage path a recording is filed under.
  userId = null,
  sessionState = 'idle',
  sessionData = null,
  completionData = null,
  pastSessions = [],
  onSelectSession,
  // Deleting a session is the parent's to record: it owns the list this one
  // renders, and the toasts that report how it went.
  onSessionDeleted = () => {},
  onSuccess = () => {},
  onError = () => {}
}) {

  // ── ACTIVE ──
  if (sessionState === 'active') {
    const questions = sessionData?.questions || [];
    const currentIndex = sessionData?.currentIndex ?? 0;
    // Every slot is rendered from the target the session was created with, so
    // the list keeps its full shape before the questions have loaded.
    const slotCount = Math.max(sessionData?.session?.question_count_target ?? 0, questions.length);

    // A flex column rather than the usual block: the progress card sits at the
    // top and the tips take a fixed block underneath it.
    return (
      <div className="flex flex-col gap-3 flex-1 min-h-0">

        {/* PROGRESS */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 flex-shrink-0">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0"></span>
              <span className="text-sm font-bold uppercase tracking-wide" style={{ color: '#9333ea' }}>Interview Progress</span>
            </div>
            <span className="text-xs font-semibold text-gray-500">
              Question {Math.min(currentIndex + 1, slotCount)} of {slotCount}
            </span>
          </div>

          {/* One block per question. Progress only: scores stay out of sight
              until the interview is over, the same way they do on the right. */}
          <div className="flex gap-1 mt-2">
            {Array.from({ length: slotCount }).map((_, i) => {
              const answered = !!questions[i]?.user_answer_text;
              const isCurrent = i === currentIndex;
              return (
                <div
                  key={questions[i]?.id || i}
                  className={`h-2 flex-1 rounded-full transition-colors ${
                    answered ? '' : isCurrent ? 'bg-purple-300' : 'bg-gray-100'
                  }`}
                  style={answered ? GRADIENT : undefined}
                />
              );
            })}
          </div>
        </div>

        {/* INTERVIEW TIPS — the two short cards share a row and the one with
            sentences in it takes the width below them. Sized to their words
            rather than to a fixed block: two rows are short enough to sit on
            the page whole, which is what matters for something read at a
            glance mid-interview. */}
        <div className="flex flex-col gap-3 flex-shrink-0">
          <h4 className="text-sm font-bold uppercase tracking-wide flex-shrink-0 mt-3" style={{ color: '#9333ea' }}>
            Interview Tips
          </h4>

          <div className="grid grid-cols-2 gap-3">
            <TipCard icon="⭐" title="The STAR Method">
              <p className="text-sm md:text-xs text-gray-600 leading-relaxed mb-1.5">
                Structure your answers so the interviewer can understand your real results.
              </p>
              <ul className="space-y-1">
                {STAR_STEPS.map(({ label, text }) => (
                  <li key={label} className="text-sm md:text-xs leading-snug">
                    <span className="text-sm font-bold text-gray-900">{label}:</span>{' '}
                    <span className="text-gray-600">{text}</span>
                  </li>
                ))}
              </ul>
            </TipCard>

            <TipCard icon="💡" title="Quick Tips">
              <p className="text-sm md:text-xs text-gray-600 leading-relaxed mb-1.5">
                Small things that make a big difference in how you come across.
              </p>
              <ul className="space-y-1">
                {QUICK_TIPS.map(tip => (
                  <li key={tip} className="text-sm md:text-xs leading-snug text-gray-600 flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0 mt-1.5"></span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </TipCard>
          </div>

          <TipCard icon="📊" title="What We Score">
            <p className="text-sm md:text-xs text-gray-600 leading-relaxed mb-1.5">
              Both make a lasting impression on an interviewer.
            </p>
            <ul className="space-y-1.5">
              {SCORED_CATEGORIES.map(({ label, text }) => (
                <li key={label} className="text-sm md:text-xs leading-snug">
                  <span className="text-sm font-bold text-gray-900">{label}:</span>{' '}
                  <span className="text-gray-600">{text}</span>
                </li>
              ))}
            </ul>
          </TipCard>
        </div>
      </div>
    );
  }

  // ── COMPLETED ──
  if (sessionState === 'completed' && completionData) {
    return (
      <CompletedPanel
        completionData={completionData}
        questions={sessionData?.questions || []}
        voiceMode={sessionData?.session?.voice_mode}
        userId={userId}
        sessionId={sessionData?.session?.id}
        coachingLoading={!!sessionData?.coachingLoading}
        onSuccess={onSuccess}
        onError={onError}
      />
    );
  }

  // ── IDLE ──
  return (
    <IdlePanel
      pastSessions={pastSessions}
      onSelectSession={onSelectSession}
      onSessionDeleted={onSessionDeleted}
      onSuccess={onSuccess}
      onError={onError}
    />
  );
}

// Its own component for the same reason CompletedPanel is: the confirmation
// modal needs state, and a hook on PracticeLeftPanel would run in every one of
// its states rather than only the one that uses it.
function IdlePanel({ pastSessions, onSelectSession, onSessionDeleted, onSuccess, onError }) {
  const supabase = createClient();
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [showAllSessions, setShowAllSessions] = useState(false);

  const confirmDelete = async () => {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const token = authSession?.access_token;
      if (!token) throw new Error('No access token');

      const res = await fetch('/api/interview/delete-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ session_id: pendingDelete.id })
      });
      if (!res.ok) throw new Error('Delete failed');

      // Told after the row is actually gone, not before. The parent owns the
      // list and the toast that goes with dropping it, so that a delete reads
      // the same whether it started here or on a paused session.
      setPendingDelete(null);
      onSessionDeleted(pendingDelete.id);
    } catch (err) {
      console.error('Delete practice session failed:', err);
      setPendingDelete(null);
      onError("We couldn't delete this session. Try again.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
        <h4 className="text-sm font-bold uppercase tracking-wide mb-1.5" style={{ color: '#9333ea' }}>Practice Sessions</h4>
        <SessionList
          sessions={pastSessions}
          onSelectSession={onSelectSession}
          onDeleteRequest={setPendingDelete}
          onViewAll={() => setShowAllSessions(true)}
        />
      </div>

      {showAllSessions && (
        <AllSessionsModal
          sessions={pastSessions}
          onSelectSession={(s) => { setShowAllSessions(false); onSelectSession?.(s); }}
          onDeleteRequest={setPendingDelete}
          onClose={() => setShowAllSessions(false)}
        />
      )}

      {pendingDelete && (
        <DeleteSessionModal
          onCancel={() => setPendingDelete(null)}
          onConfirm={confirmDelete}
          deleting={deleting}
        />
      )}
    </div>
  );
}
