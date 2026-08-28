'use client';

import { useState, useEffect } from 'react';

// ============================================================================
// PRACTICE LEFT PANEL
// The working surface for the practice step. Mirrors the session the right
// column is driving; it never owns session state of its own.
// ============================================================================

const GRADIENT = { background: 'linear-gradient(to right, #667eea, #764ba2)' };

function scoreColor(score) {
  if (score >= 85) return '#9333ea';
  if (score >= 75) return '#81c784';
  if (score >= 60) return '#ffc870';
  return '#e57373';
}

const LEVEL_NAMES = {
  0: 'Not started',
  1: 'Getting started',
  2: 'Finding your footing',
  3: 'Interview ready',
  4: 'Strong candidate',
  5: 'Standout'
};

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

// Its own component so its hooks mount and unmount with the active state.
// PracticeLeftPanel returns early per state, so a hook on the parent would
// either run during every state or break the rules of hooks.
function ElapsedTimer({ startedAt }) {
  // The whole clock lives in the interval callback. Reading Date.now() during
  // render is impure, and writing state straight from an effect body cascades
  // renders, so the subscription is the only thing that ever sets it. First
  // paint reads 00:00 and the first tick corrects it a second later.
  const [elapsed, setElapsed] = useState(0);

  // Re-syncs if startedAt arrives after mount, which is what happens when a
  // resumed session finishes loading its row.
  useEffect(() => {
    const parsed = startedAt ? new Date(startedAt).getTime() : NaN;
    // A session created moments ago has no row to read a start time from, so
    // the clock starts here instead. Accurate to the second either way.
    const startMs = Number.isFinite(parsed) ? parsed : Date.now();
    const id = setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  // Inline, so it sits on the header row rather than owning a block of its own.
  return (
    <span className="text-base font-mono font-semibold text-gray-500 flex-shrink-0">{mm}:{ss}</span>
  );
}

function StatTile({ label, value }) {
  const numeric = Number(value) || 0;
  return (
    <div className="flex flex-col items-center justify-center text-center p-3 bg-gray-50 rounded-lg">
      <span
        className="text-2xl font-bold"
        style={{ color: numeric === 0 ? '#d1d5db' : scoreColor(numeric) }}
      >
        {numeric === 0 ? '—' : numeric}
      </span>
      <p className="text-sm md:text-xs font-medium text-gray-700">{label}</p>
    </div>
  );
}

function SessionRow({ session, onClick }) {
  const score = session.readiness_score_after ?? 0;
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

        {score > 0 && (
          <div className="relative w-8 h-8 flex-shrink-0">
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
        )}

        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          <span className="text-xs md:text-[9px] bg-purple-100 text-purple-700 font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">
            Level {session.level_at_end ?? 0}
          </span>
        </div>
      </div>
    </div>
  );
}

function SessionList({ sessions, onSelectSession }) {
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
      {sessions.map(s => (
        <SessionRow key={s.id} session={s} onClick={() => onSelectSession?.(s)} />
      ))}
    </div>
  );
}

export default function PracticeLeftPanel({
  sessionState = 'idle',
  sessionData = null,
  completionData = null,
  pastSessions = [],
  onSelectSession,
  onStartNew
}) {

  // ── ACTIVE ──
  if (sessionState === 'active') {
    const questions = sessionData?.questions || [];
    const currentIndex = sessionData?.currentIndex ?? 0;
    // Every slot is rendered from the target the session was created with, so
    // the list keeps its full shape before the questions have loaded.
    const slotCount = Math.max(sessionData?.session?.question_count_target ?? 0, questions.length);

    // A flex column rather than the usual block: the question list claims all
    // the height left under the progress card.
    return (
      <div className="flex flex-col gap-3 flex-1 min-h-0">

        {/* PROGRESS */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 flex-shrink-0">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0"></span>
              <h4 className="text-sm font-bold uppercase tracking-wide" style={{ color: '#9333ea' }}>In Progress</h4>
            </div>
            <ElapsedTimer startedAt={sessionData?.startedAt} />
          </div>

          <p className="text-sm md:text-xs font-semibold text-gray-900 mb-1.5">
            Question {Math.min(currentIndex + 1, slotCount)} of {slotCount}
          </p>
          {/* One block per question. Counted off the same slots as the list, so
              the two never disagree. Progress only: scores stay out of sight
              until the interview is over, the same way they do on the right. */}
          <div className="flex gap-1">
            {Array.from({ length: slotCount }).map((_, i) => {
              const answered = !!questions[i]?.user_answer_text;
              const isCurrent = i === currentIndex;
              return (
                <div
                  key={questions[i]?.id || i}
                  className={`h-1.5 flex-1 rounded-sm transition-colors ${
                    answered ? '' : isCurrent ? 'bg-purple-200' : 'bg-gray-200'
                  }`}
                  style={answered ? GRADIENT : undefined}
                />
              );
            })}
          </div>
        </div>

        {/* QUESTION LIST — every slot rendered, rows share the height, never scrolls */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 flex-1 min-h-0 overflow-hidden flex flex-col">
          {Array.from({ length: slotCount }).map((_, i) => {
            // Null until the questions load, which is what the placeholder rows
            // render from.
            const q = questions[i] || null;
            const answered = !!q?.user_answer_text;
            const isCurrent = i === currentIndex;
            const isLast = i === slotCount - 1;
            return (
              <div
                key={q?.id || i}
                className={`flex-1 min-h-0 flex items-center gap-2 px-1.5 ${isLast ? '' : 'border-b border-gray-100'} ${isCurrent ? 'bg-purple-50 rounded' : ''}`}
              >
                {answered ? (
                  <>
                    <svg className="w-4 h-4 text-purple-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-xs text-gray-700 truncate flex-1">{q.question_text}</span>
                  </>
                ) : (
                  <>
                    <span className={`w-4 flex-shrink-0 text-center text-xs ${isCurrent ? 'font-bold text-purple-700' : 'text-gray-400'}`}>
                      {i + 1}
                    </span>
                    <span className={`text-xs truncate flex-1 ${isCurrent ? 'font-semibold text-purple-700' : 'text-gray-400'}`}>
                      Question {i + 1}
                    </span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── COMPLETED ──
  if (sessionState === 'completed' && completionData) {
    const summary = completionData.session_summary || {};
    const progression = completionData.level_progression || {};
    const level = progression.level_after ?? 0;

    return (
      <div className="space-y-3">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
          <h4 className="text-sm font-bold uppercase tracking-wide mb-1.5" style={{ color: '#9333ea' }}>Session Results</h4>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <StatTile label="Structure" value={summary.avg_score_structure ?? 0} />
            <StatTile label="Content" value={summary.avg_score_content ?? 0} />
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center mb-3">
            <div className="text-2xl font-bold" style={{ color: '#9333ea' }}>Level {level}</div>
            <p className="text-xs text-gray-500">{LEVEL_NAMES[level] || ''}</p>
          </div>

          <button
            onClick={onStartNew}
            className="w-full text-white rounded-lg py-2.5 px-6 font-semibold text-sm md:text-xs transition-opacity hover:opacity-90"
            style={GRADIENT}
          >
            Practice Again
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
          <h4 className="text-sm font-bold uppercase tracking-wide mb-1.5" style={{ color: '#9333ea' }}>Practice Sessions</h4>
          <SessionList sessions={pastSessions} onSelectSession={onSelectSession} />
        </div>
      </div>
    );
  }

  // ── IDLE ──
  return (
    <div className="space-y-3">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
        <h4 className="text-sm font-bold uppercase tracking-wide mb-1.5" style={{ color: '#9333ea' }}>Practice Sessions</h4>
        <SessionList sessions={pastSessions} onSelectSession={onSelectSession} />
      </div>
    </div>
  );
}
