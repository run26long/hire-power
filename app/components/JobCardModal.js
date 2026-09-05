'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import UpgradeModal from './UpgradeModal';

function StatusBadge({ status }) {
  const config = {
    resume_in_progress: { label: 'Prepping', bg: '#f5f3ff', border: '#c4b5fd', text: '#5b21b6' },
    applied:            { label: 'Applied',       bg: '#fefce8', border: '#fde047', text: '#854d0e' },
    interview:          { label: 'Interview',     bg: '#eff6ff', border: '#93c5fd', text: '#1e40af' },
    hired:              { label: 'Hired',         bg: '#f0fdf4', border: '#86efac', text: '#166534' },
    rejected:           { label: 'Rejected',      bg: '#fef2f2', border: '#fca5a5', text: '#991b1b' },
    archived:           { label: 'Archived',      bg: '#f9fafb', border: '#d1d5db', text: '#6b7280' },
  };
  const c = config[status] || config.applied;
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide"
      style={{ background: c.bg, borderColor: c.border, color: c.text }}>
      {c.label}
    </span>
  );
}

export default function JobCardModal({
  card,
  onClose,
  onArchive,
  onSaveNotes,
  onLogWin,
  onLinkResume,
  onScheduleInterview,
  onMoveCard,
  onSetFollowUpReminder,
  onUpdateInterview,
  onCancelInterview,
  jsResumes = [],
  interviewRounds = [],
  context = 'tracker',
  accomplishmentsCount = 0,
  isPro = true,
  clCount = 0,
}) {
  const router = useRouter();
  const supabase = createClient();
  // Three cover letters is the whole free allowance. Past it the action stays
  // on the card but leads to the upgrade prompt instead of the CL flow.
  const clLimitReached = !isPro && clCount >= 3;
  const [showJdModal, setShowJdModal] = useState(false);
  const [cardWins, setCardWins] = useState([]);

  useEffect(() => {
    async function loadWins() {
      if (!card?.id) return;
      const isHired = card.application_status === 'hired' || card.last_active_status === 'hired';
      if (!isHired) return;
      const { data, error } = await supabase
        .from('achievements')
        .select('*')
        .eq('application_id', card.id)
        .eq('source', 'career_archive')
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Failed to load wins for job card:', error);
        return;
      }
      if (data) setCardWins(data);
    }
    loadWins();
  }, [card?.id]);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingInterview, setEditingInterview] = useState(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleVenue, setScheduleVenue] = useState('');
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [notesValue, setNotesValue] = useState(card.notes || '');
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [followUpOptedIn, setFollowUpOptedIn] = useState(card.follow_up_reminder_opt_in || false);
  const [followUpSaving, setFollowUpSaving] = useState(false);

  function formatDate(dateString) {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  }

  const notesChanged = notesValue !== (card.notes || '');

  return (
    <>
      {/* ── MAIN CARD MODAL ── */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
        onClick={onClose}
      >
        <div
          className="bg-white shadow-2xl w-full max-w-lg overflow-hidden flex flex-col"
          style={{ borderRadius: '12px', maxHeight: '90vh' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div
            style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)' }}
            className="px-6 py-5 relative flex-shrink-0"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-white hover:text-gray-200 text-3xl leading-none font-light"
            >×</button>
            <div className="flex items-center gap-3">
              <img src="/images/Hire_Power_icon.png" alt="Hire Power" className="h-8 w-auto flex-shrink-0" />
              <div>
                <h2 className="text-xl font-bold text-white leading-tight mb-1 line-clamp-2">{card.title}</h2>
                <div className="flex items-center gap-2">
                  <p className="text-purple-100 text-sm md:text-xs">{card.company}</p>
                  <StatusBadge status={card.application_status} />
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Move to row */}
          <div className="md:hidden px-6 py-3 border-b border-gray-100 flex-shrink-0">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Click any board below to move this card</p>
            <div className="flex gap-1.5 flex-wrap">
              {[
                { id: 'prepping',           label: 'Prepping',  color: '#7c3aed' },
                { id: 'applied',            label: 'Applied',   color: '#1d4ed8' },
                { id: 'interview',          label: 'Interview', color: '#92400e' },
                { id: 'rejected',           label: 'Rejected',  color: '#6b7280' },
                { id: 'hired',              label: 'Hired',     color: '#15803d' },
              ].map(col => (
                <button
                  key={col.id}
                  onClick={() => onMoveCard?.(card, col.id)}
                  disabled={card.application_status === col.id}
                  className="px-2.5 py-1 rounded-full text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    border: `1px solid ${col.color}`,
                    color: card.application_status === col.id ? 'white' : col.color,
                    background: card.application_status === col.id ? col.color : 'transparent',
                  }}
                >
                  {col.label}
                </button>
              ))}
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

            {/* Date row */}
            {(card.application_date || card.follow_up_date || card.interview_date || card.hired_at) && (
              <div className="flex gap-2 flex-wrap">
                {card.application_date && (
                  <div className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-100 text-center">
                    <p className="text-xs md:text-[10px] font-bold text-gray-400 uppercase tracking-wide">Applied</p>
                    <p className="text-sm md:text-xs font-semibold text-gray-700">{formatDate(card.application_date)}</p>
                  </div>
                )}
                {card.follow_up_date && card.application_status === 'applied' && (
                  <div className="bg-blue-50 rounded-lg px-3 py-2 border border-blue-100 text-center">
                    <p className="text-xs md:text-[10px] font-bold text-blue-400 uppercase tracking-wide">Follow Up</p>
                    <p className="text-sm md:text-xs font-semibold text-blue-700">{formatDate(card.follow_up_date)}</p>
                  </div>
                )}
                {card.interview_date && (
                  <div className="bg-amber-50 rounded-lg px-3 py-2 border border-amber-100 text-center">
                    <p className="text-xs md:text-[10px] font-bold text-amber-500 uppercase tracking-wide">Interview</p>
                    <p className="text-sm md:text-xs font-semibold text-amber-800">{formatDate(card.interview_date)}</p>
                  </div>
                )}
                {card.hired_at && (card.application_status === 'hired' || card.last_active_status === 'hired') && (
                  <div className="bg-green-50 rounded-lg px-3 py-2 border border-green-100 text-center">
                    <p className="text-xs md:text-[10px] font-bold text-green-500 uppercase tracking-wide">Hired</p>
                    <p className="text-sm md:text-xs font-semibold text-green-800">{formatDate(card.hired_at)}</p>
                  </div>
                )}
                {interviewRounds.map((round, i) => (
                  <div
                    key={round.id}
                    onClick={() => {
                      const d = new Date(round.event_date);
                      const yyyy = d.getFullYear();
                      const mm = String(d.getMonth() + 1).padStart(2, '0');
                      const dd = String(d.getDate()).padStart(2, '0');
                      const hh = String(d.getHours()).padStart(2, '0');
                      const min = String(d.getMinutes()).padStart(2, '0');
                      setEditingInterview(round);
                      setScheduleDate(`${yyyy}-${mm}-${dd}`);
                      setScheduleTime(`${hh}:${min}`);
                      setScheduleVenue(round.venue || '');
                      setShowScheduleModal(true);
                    }}
                    className="bg-green-50 rounded-lg px-3 py-2 border border-green-100 text-center cursor-pointer hover:border-green-300 transition-colors"
                  >
                    <p className="text-xs md:text-[10px] font-bold text-green-500 uppercase tracking-wide">Interview {i + 1}</p>
                    <p className="text-sm md:text-xs font-semibold text-green-800">
                      {new Date(round.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                    <p className="text-[11px] md:text-[9px] text-green-600">{round.venue || ''}</p>
                  </div>
                ))}
                {card.resumes?.current_score && (
                  <div className="bg-purple-50 rounded-lg px-3 py-2 border border-purple-100 text-center">
                    <p className="text-xs md:text-[10px] font-bold text-purple-400 uppercase tracking-wide">Score</p>
                    <p className="text-sm md:text-xs font-semibold text-purple-700">{card.resumes.current_score}</p>
                  </div>
                )}
                {context === 'vault' && (
                  <div className="bg-purple-50 rounded-lg px-3 py-2 border border-purple-100 text-center">
                    <p className="text-xs md:text-[10px] font-bold text-purple-400 uppercase tracking-wide">Wins</p>
                    <p className="text-sm md:text-xs font-semibold text-purple-700">{accomplishmentsCount}</p>
                  </div>
                )}
              </div>
            )}

            {/* Documents */}
            <div className="space-y-2">
              <p className="text-xs md:text-[10px] font-bold text-gray-400 uppercase tracking-wide">Documents</p>

              {card.resumes ? (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">📄</span>
                    <div>
                      <p className="text-sm md:text-xs font-semibold text-gray-800">
                        {card.resumes.resume_type === 'job_specific' ? 'Tailored Resume' : 'Resume'}
                      </p>
                      <p className="text-xs md:text-[10px] text-gray-400">{card.resumes.display_name}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => router.push(`/resume/${card.resume_id}`)}
                    className="text-sm md:text-xs font-semibold text-purple-600 hover:text-purple-800"
                  >Open →</button>
                </div>
              ) : context === 'tracker' ? (
                <>
                  {isPro ? (
                    <div
                      className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-100 cursor-pointer hover:border-purple-300 transition-colors"
                      onClick={() => {
                        // Pass the card id, not the job description. A JD runs to
                        // thousands of characters and does not survive a query string.
                        const params = new URLSearchParams({
                          action: 'new-job-specific',
                          ...(card.id && { applicationId: card.id }),
                        })
                        router.push(`/resume-coach?${params.toString()}`)
                      }}
                    >
                      <div>
                        <p className="text-sm md:text-xs font-semibold text-purple-800">Create Tailored Resume</p>
                        <p className="text-xs md:text-[10px] text-purple-500">Tailored to this job</p>
                      </div>
                      <span className="text-sm md:text-xs font-semibold text-purple-500">+ Create →</span>
                    </div>
                  ) : (
                    <div
                      className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-100 cursor-pointer hover:border-purple-300 transition-colors"
                      onClick={() => setShowUpgradeModal(true)}
                    >
                      <div>
                        <p className="text-sm md:text-xs font-semibold text-purple-800">Tailor Resume for This Job</p>
                        <p className="text-xs md:text-[10px] text-purple-500">Upgrade to Pro to unlock</p>
                      </div>
                      <span className="text-sm md:text-xs font-semibold text-purple-500">Pro →</span>
                    </div>
                  )}
                </>
              ) : null}

              {card.cover_letter_id && (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">✉️</span>
                    <p className="text-sm md:text-xs font-semibold text-gray-800">Cover Letter</p>
                  </div>
                  <button
                    onClick={() => router.push(`/cover-letter/${card.cover_letter_id}`)}
                    className="text-sm md:text-xs font-semibold text-purple-600 hover:text-purple-800"
                  >Open →</button>
                </div>
              )}

              {card.description && (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">📋</span>
                    <p className="text-sm md:text-xs font-semibold text-gray-800">Job Description</p>
                  </div>
                  <button
                    onClick={() => setShowJdModal(true)}
                    className="text-sm md:text-xs font-semibold text-purple-600 hover:text-purple-800"
                  >View →</button>
                </div>
              )}
            </div>

            {/* Action prompts — tracker only, contextual to status */}
            {context === 'tracker' && card.application_status !== 'hired' && (
              <div className="space-y-2">
                <p className="text-xs md:text-[10px] font-bold text-gray-400 uppercase tracking-wide">Actions</p>

                {card.application_status === 'resume_in_progress' && !card.cover_letter_id && (
                  clLimitReached ? (
                    <div
                      className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-100 cursor-pointer hover:border-purple-300 transition-colors"
                      onClick={() => setShowUpgradeModal(true)}
                    >
                      <div>
                        <p className="text-sm md:text-xs font-semibold text-purple-800">Build Cover Letter</p>
                        <p className="text-xs md:text-[10px] text-purple-500">Upgrade to Pro to unlock</p>
                      </div>
                      <span className="text-sm md:text-xs font-semibold text-purple-500">Pro →</span>
                    </div>
                  ) : (
                    <div
                      className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-100 cursor-pointer hover:border-purple-300 transition-colors"
                      onClick={() => {
                        const params = new URLSearchParams({
                          action: 'new-cover-letter',
                          ...(card.title && { jobTitle: card.title }),
                          ...(card.company && { jobCompany: card.company }),
                          ...(card.resume_id && { resumeId: card.resume_id }),
                          ...(card.id && { applicationId: card.id }),
                        });
                        router.push(`/resume-coach?${params.toString()}`);
                      }}
                    >
                      <div>
                        <p className="text-sm md:text-xs font-semibold text-purple-800">Build Cover Letter</p>
                        <p className="text-xs md:text-[10px] text-purple-500">Tailored to this job</p>
                      </div>
                      <span className="text-sm md:text-xs font-semibold text-purple-500">+ Create →</span>
                    </div>
                  )
                )}

                {card.application_status === 'applied' && (
                  <>
                    {followUpOptedIn ? (
                      <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100">
                        <div className="flex items-center gap-2">
                          <span className="text-blue-600">✓</span>
                          <div>
                            <p className="text-sm md:text-xs font-semibold text-blue-800">Follow-up reminder set</p>
                            <p className="text-xs md:text-[10px] text-blue-500">We'll email you in 7 days</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={async () => {
                          if (followUpSaving) return;
                          setFollowUpSaving(true);
                          try {
                            await onSetFollowUpReminder?.(card.id);
                            setFollowUpOptedIn(true);
                          } catch (err) {
                            console.error('Set follow-up reminder failed:', err);
                          } finally {
                            setFollowUpSaving(false);
                          }
                        }}
                        className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100 cursor-pointer hover:border-blue-300 transition-colors"
                      >
                        <div>
                          <p className="text-sm md:text-xs font-semibold text-blue-800">Remind me to follow up in 7 days</p>
                          <p className="text-xs md:text-[10px] text-blue-500">We'll send a check-in email</p>
                        </div>
                        <span className="text-sm md:text-xs font-semibold text-blue-500">
                          {followUpSaving ? 'Setting...' : '+ Set →'}
                        </span>
                      </div>
                    )}
                    <div
                      className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-100 cursor-pointer hover:border-purple-300 transition-colors"
                      onClick={() => router.push(`/interview/${card.id}`)}
                    >
                      <div>
                        <p className="text-sm md:text-xs font-semibold text-purple-800">Prep for Interview</p>
                        <p className="text-xs md:text-[10px] text-purple-500">Power Analysis and practice for this role</p>
                      </div>
                      <span className="text-sm md:text-xs font-semibold text-purple-500">Open →</span>
                    </div>
                  </>
                )}

                {card.application_status === 'interview' && (
                  <>
                    <div
                      className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100 cursor-pointer hover:border-amber-200 transition-colors"
                      onClick={() => setShowScheduleModal(true)}
                    >
                      <div>
                        <p className="text-sm md:text-xs font-semibold text-amber-800">
                          {interviewRounds.length === 0 ? 'Schedule Interview' : `Schedule Interview ${interviewRounds.length + 1}`}
                        </p>
                        <p className="text-xs md:text-[10px] text-amber-600">Date, time, and format</p>
                      </div>
                      <span className="text-sm md:text-xs font-semibold text-amber-500">+ Add →</span>
                    </div>
                    <div
                      className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-100 cursor-pointer hover:border-purple-300 transition-colors"
                      onClick={() => router.push(`/interview/${card.id}`)}
                    >
                      <div>
                        <p className="text-sm md:text-xs font-semibold text-purple-800">Practice Interview</p>
                        <p className="text-xs md:text-[10px] text-purple-500">Power Analysis and practice for this role</p>
                      </div>
                      <span className="text-sm md:text-xs font-semibold text-purple-500">Open →</span>
                    </div>
                  
                  </>
                )}
              </div>
            )}

            {/* Logged Wins (hired cards only) */}
            {cardWins.length > 0 && (
              <div>
                <p className="text-xs md:text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Wins Logged ({cardWins.length})</p>
                <div className="space-y-1.5">
                  {cardWins.map(win => (
                    <div key={win.id} className="flex items-start gap-2 p-2 bg-gray-50 border border-gray-200 rounded-lg">
                      <div className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0 mt-1.5"></div>
                      <p className="text-sm md:text-xs text-gray-700 leading-snug">{win.raw_description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <p className="text-xs md:text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Notes</p>
              <textarea
                value={notesValue}
                onChange={e => { setNotesValue(e.target.value); setNotesSaved(false); }}
                placeholder="Recruiter name, referral source, interview notes..."
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-base md:text-xs text-gray-700 focus:ring-2 focus:ring-purple-400 focus:border-transparent resize-none"
              />
              {notesChanged && (
                <button
                  onClick={async () => {
                    setNotesSaving(true);
                    try {
                      await onSaveNotes?.(card.id, notesValue);
                      setNotesSaved(true);
                    } catch (err) {
                      console.error('Save notes failed:', err);
                    } finally {
                      setNotesSaving(false);
                    }
                  }}
                  disabled={notesSaving}
                  className="mt-1 text-xs md:text-[10px] font-semibold text-purple-600 hover:text-purple-800 disabled:opacity-50"
                >
                  {notesSaving ? 'Saving...' : notesSaved ? 'Saved ✓' : 'Save notes'}
                </button>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0 justify-center">
            {context === 'tracker' && card.application_status !== 'archived' && (
              <button
                onClick={() => onArchive?.(card.id)}
                className="py-2 px-5 border border-gray-200 rounded-lg text-sm md:text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
              >
                Remove & Add to Archive
              </button>
            )}
            {context === 'vault' && onLogWin && (
              <button
                onClick={onLogWin}
                className="py-2 px-5 border border-purple-200 rounded-lg text-sm md:text-xs font-semibold text-purple-600 hover:bg-purple-50 transition-colors"
              >
                + Log a Win
              </button>
            )}
            <button
              onClick={onClose}
              className="py-2 px-8 rounded-lg text-sm md:text-xs font-bold text-white hover:opacity-90 transition-opacity"
              style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
            >
              Done
            </button>
          </div>
        </div>
      </div>

      {/* ── SCHEDULE INTERVIEW MODAL ── */}
      {showScheduleModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
          onClick={() => {
            setShowScheduleModal(false);
            setEditingInterview(null);
            setScheduleDate('');
            setScheduleTime('');
            setScheduleVenue('');
          }}
        >
          <div
            className="bg-white shadow-2xl w-full max-w-sm overflow-hidden"
            style={{ borderRadius: '12px' }}
            onClick={e => e.stopPropagation()}
          >
            <div
              style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)' }}
              className="px-6 py-5 relative"
            >
              <button
                onClick={() => {
                  setShowScheduleModal(false);
                  setEditingInterview(null);
                  setScheduleDate('');
                  setScheduleTime('');
                  setScheduleVenue('');
                }}
                className="absolute top-4 right-4 text-white hover:text-gray-200 text-3xl leading-none font-light"
              >×</button>
              <div className="flex items-center gap-3">
                <img src="/images/Hire_Power_icon.png" alt="Hire Power" className="h-8 w-auto flex-shrink-0" />
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {editingInterview
                      ? `Edit Interview ${interviewRounds.findIndex(r => r.id === editingInterview.id) + 1}`
                      : interviewRounds.length === 0 ? 'Schedule Interview' : `Schedule Interview ${interviewRounds.length + 1}`}
                  </h2>
                  <p className="text-purple-100 text-xs">{card.title} · {card.company}</p>
                </div>
              </div>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={e => setScheduleDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base md:text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Time</label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={e => setScheduleTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base md:text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Format</label>
                <select
                  value={scheduleVenue}
                  onChange={e => setScheduleVenue(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base md:text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Select format...</option>
                  <option value="Phone">Phone</option>
                  <option value="Zoom">Zoom</option>
                  <option value="In Person">In Person</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="flex justify-center pt-1">
                <button
                  onClick={async () => {
                    if (!scheduleDate) return;
                    setScheduleSaving(true);
                    const eventDate = scheduleTime
                      ? new Date(`${scheduleDate}T${scheduleTime}`).toISOString()
                      : new Date(scheduleDate).toISOString();
                    try {
                      if (editingInterview) {
                        await onUpdateInterview?.(editingInterview.id, {
                          event_date: eventDate,
                          venue: scheduleVenue,
                        });
                      } else {
                        await onScheduleInterview?.(card.id, {
                          event_date: eventDate,
                          venue: scheduleVenue,
                          status: 'interview_scheduled',
                        });
                      }
                      setShowScheduleModal(false);
                      setEditingInterview(null);
                      setScheduleDate('');
                      setScheduleTime('');
                      setScheduleVenue('');
                    } catch (err) {
                      console.error('Schedule interview failed:', err);
                    } finally {
                      setScheduleSaving(false);
                    }
                  }}
                  disabled={scheduleSaving || !scheduleDate}
                  className="px-8 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
                  style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
                >
                 {scheduleSaving ? 'Saving...' : editingInterview ? 'Update Interview' : 'Save Interview'}
                </button>
              </div>

              {editingInterview && (
                <div className="flex justify-center pt-2">
                  <button
                    onClick={async () => {
                      if (scheduleSaving) return;
                      setScheduleSaving(true);
                      try {
                        await onCancelInterview?.(editingInterview.id);
                        setShowScheduleModal(false);
                        setEditingInterview(null);
                        setScheduleDate('');
                        setScheduleTime('');
                        setScheduleVenue('');
                      } catch (err) {
                        console.error('Cancel interview failed:', err);
                      } finally {
                        setScheduleSaving(false);
                      }
                    }}
                    disabled={scheduleSaving}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                  >
                    Cancel this interview
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── job description MODAL ── */}
      {showJdModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
          onClick={() => setShowJdModal(false)}
        >
          <div
            className="bg-white shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col"
            style={{ borderRadius: '12px', maxHeight: '85vh' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-5 relative flex-shrink-0" style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)' }}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-white">{card.title}</h3>
                  <p className="text-purple-100 text-xs mt-0.5">{card.company} · Job Description</p>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <button
                    onClick={() => navigator.clipboard.writeText(card.description)}
                    className="text-xs font-semibold text-white hover:opacity-70 transition-opacity"
                  >Copy</button>
                  <button
                    onClick={() => setShowJdModal(false)}
                    className="text-white hover:opacity-70 text-2xl leading-none font-light"
                  >×</button>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{card.description}</p>
            </div>
          </div>
        </div>
      )}

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
      />
    </>
  );
}