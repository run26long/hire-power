'use client';

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
  interviewerQuestions = [],
  // Only to tell "questions still loading" from "no questions": an empty array
  // is the same value either way, and the id is the thing they'd load from.
  powerAnalysisId = null,
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

    // A flex column rather than the usual block: the interviewer questions
    // claim all the height left under the progress card.
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

        {/* QUESTIONS FOR YOUR INTERVIEWER — full width under both cards, and
            scrolls if the list outgrows the space left. */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex-1 min-h-0 overflow-y-auto">
          <h4 className="text-sm font-bold uppercase tracking-wide mb-2" style={{ color: '#9333ea' }}>
            Questions For Your Interviewer
          </h4>

          {/* An empty array is ambiguous on its own — it's the same value while
              the fetch is in flight and after it comes back with nothing. The
              spinner shows until there's a power analysis to have loaded from. */}
          {!powerAnalysisId ? (
            <div className="flex justify-center py-3">
              <div className="h-4 w-4 animate-spin border-2 border-purple-600 border-t-transparent rounded-full"></div>
            </div>
          ) : interviewerQuestions.length > 0 ? (
            <div className="space-y-2">
              {interviewerQuestions.map((q, i) => (
                <div key={q.id || i} className={i === 0 ? '' : 'border-t border-purple-200 pt-2'}>
                  <div className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0 mt-1.5"></span>
                    <div className="min-w-0">
                      <p className="text-sm md:text-xs font-semibold text-gray-900 leading-snug">
                        {q.tailored_text || q.original_text}
                      </p>
                      {q.rationale && (
                        <p className="text-sm md:text-xs text-gray-600 leading-snug mt-0.5">
                          {q.rationale}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500">
              Complete Research to generate interviewer questions.
            </p>
          )}
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
            <StatTile label="Clarity" value={summary.avg_score_structure ?? 0} />
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
