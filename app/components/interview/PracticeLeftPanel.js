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
  onSelectSession,
  onStartNew
}) {

  // ── ACTIVE ──
  if (sessionState === 'active') {
    const questions = sessionData?.questions || [];
    const currentIndex = sessionData?.currentIndex ?? 0;
    const total = questions.length;

    const scored = questions.filter(q => q.evaluation_status === 'scored' && q.question_source !== 'closer');
    const avg = (key) => {
      const values = scored.map(q => q[key]).filter(v => Number.isFinite(v));
      if (!values.length) return 0;
      return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
    };

    const progressPct = total > 0 ? Math.round((currentIndex / total) * 100) : 0;

    return (
      <div className="space-y-3">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0"></span>
            <h4 className="text-sm font-bold uppercase tracking-wide" style={{ color: '#9333ea' }}>In Progress</h4>
          </div>

          <p className="text-sm md:text-xs font-semibold text-gray-900 mb-1.5">
            Question {Math.min(currentIndex + 1, total)} of {total}
          </p>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden mb-3">
            <div className="h-full transition-all duration-300" style={{ width: `${progressPct}%`, ...GRADIENT }} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <StatTile label="Structure" value={avg('score_structure')} />
            <StatTile label="Content" value={avg('score_content')} />
          </div>

          <p className="text-xs md:text-[10px] text-gray-400 text-center mt-2">
            Running average across scored answers
          </p>
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
