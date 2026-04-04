'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import MainNav from '../components/MainNav';
import JobCardModal from '../components/JobCardModal';

const COLUMNS = [
  { id: 'resume_in_progress', label: 'Resume Ready', color: '#7c3aed', bg: 'rgba(124,58,237,0.06)',  border: 'rgba(124,58,237,0.2)'  },
  { id: 'applied',            label: 'Applied',      color: '#1d4ed8', bg: 'rgba(29,78,216,0.06)',   border: 'rgba(29,78,216,0.2)'   },
  { id: 'interview',          label: 'Interview',    color: '#92400e', bg: 'rgba(146,64,14,0.06)',   border: 'rgba(146,64,14,0.2)'   },
  { id: 'rejected',           label: 'Rejected',     color: '#6b7280', bg: 'rgba(107,114,128,0.06)', border: 'rgba(107,114,128,0.2)' },
  { id: 'hired',              label: 'Hired',        color: '#15803d', bg: 'rgba(21,128,61,0.06)',   border: 'rgba(21,128,61,0.2)'   },
];

function StatusBadge({ status }) {
  const config = {
    resume_in_progress: { label: 'Resume Ready', bg: '#f5f3ff', border: '#c4b5fd', text: '#5b21b6' },
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

export default function JobTrackerPage() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [applications, setApplications] = useState([]);
  const [archivedCards, setArchivedCards] = useState([]);
  const [jsResumes, setJsResumes] = useState([]);
  const [interviewRounds, setInterviewRounds] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [cardOpenedFromArchive, setCardOpenedFromArchive] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
 const [showHiredModal, setShowHiredModal] = useState(false);
  const [hiredCard, setHiredCard] = useState(null);
  const [rejectedPromptCard, setRejectedPromptCard] = useState(null);

  const [dragCard, setDragCard] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);

  const [newTitle, setNewTitle] = useState('');
  const [newCompany, setNewCompany] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newResumeId, setNewResumeId] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/dashboard'); return; }
      setUser(user);

      const { data: profile } = await supabase
        .from('profiles').select('*').eq('id', user.id).single();
      setUserProfile(profile);

      const { data: apps } = await supabase
        .from('applications')
        .select('*, resumes!applications_resume_id_fkey(display_name, current_score)')
        .eq('user_id', user.id)
        .not('application_status', 'eq', 'archived')
        .order('sort_order', { ascending: true });
      setApplications(apps || []);

      const { data: archived } = await supabase
        .from('applications')
        .select('*, resumes!applications_resume_id_fkey(id, display_name, current_score)')
        .eq('user_id', user.id)
        .eq('application_status', 'archived')
        .order('updated_at', { ascending: false });
      setArchivedCards(archived || []);

      const { data: resumes } = await supabase
        .from('resumes')
        .select('id, display_name, current_score, job_title, job_company, job_description')
        .eq('user_id', user.id)
        .eq('resume_type', 'job_specific')
        .order('updated_at', { ascending: false });
      setJsResumes(resumes || []);

      setLoading(false);
    }
    loadData();
  }, []);

  const getColumnCards = (columnId) =>
    applications.filter(a => a.application_status === columnId);

  const handleDragStart = (e, card) => {
    setDragCard(card);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, columnId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnId);
  };

  const handleDrop = async (e, columnId) => {
    e.preventDefault();
    if (!dragCard || dragCard.application_status === columnId) {
      setDragCard(null);
      setDragOverColumn(null);
      return;
    }
    const droppedCard = dragCard;
    const previousStatus = dragCard.application_status;

    // Optimistic update
    setApplications(prev => prev.map(a =>
      a.id === dragCard.id ? { ...a, application_status: columnId } : a
    ));

    await supabase
      .from('applications')
      .update({ application_status: columnId, updated_at: new Date().toISOString() })
      .eq('id', dragCard.id);

    // Rejected: show prompt to archive or keep on board
    if (columnId === 'rejected') {
      setTimeout(() => {
        setRejectedPromptCard({ ...droppedCard, previousStatus });
      }, 600);
    }

   // Hired: archive any existing hired card, write hired_at, show celebration
    if (columnId === 'hired') {
      const hiredAt = new Date().toISOString();

      // Find and archive any existing hired card — exclude the card we just moved
      const { data: existingHired } = await supabase
        .from('applications')
        .select('*, resumes!applications_resume_id_fkey(display_name, current_score)')
        .eq('user_id', user.id)
        .eq('application_status', 'hired')
        .neq('id', dragCard.id)
        .maybeSingle();

      if (existingHired) {
        await supabase
          .from('applications')
          .update({ application_status: 'archived', last_active_status: 'hired', updated_at: hiredAt })
          .eq('id', existingHired.id);
        setApplications(prev => prev.filter(a => a.id !== existingHired.id));
        setArchivedCards(prev => [...prev, { ...existingHired, application_status: 'archived', last_active_status: 'hired' }]);
      }

      // Set new card as hired
      await supabase
        .from('applications')
        .update({ hired_at: hiredAt, updated_at: hiredAt })
        .eq('id', dragCard.id);

      await supabase
        .from('profiles')
        .update({ search_status: 'hired' })
        .eq('id', user.id);

      setUserProfile(prev => ({ ...prev, search_status: 'hired' }));
      setShowHiredModal(true);
      setHiredCard(dragCard);
    }

    setDragCard(null);
    setDragOverColumn(null);
  };

  const handleDragEnd = () => {
    setDragCard(null);
    setDragOverColumn(null);
  };

  const handleAddCard = async () => {
    if (!newTitle || !newCompany) return;
    setAddLoading(true);

    const { data, error } = await supabase
      .from('applications')
      .insert({
        user_id: user.id,
        title: newTitle,
        company: newCompany,
        description: newDescription || '',
        application_status: 'resume_in_progress',
        notes: newNotes || null,
        resume_id: newResumeId || null,
        application_date: new Date().toISOString().split('T')[0],
        sort_order: applications.length,
      })
      .select('*, resumes!applications_resume_id_fkey(display_name, current_score)')
      .single();

    if (error) {
      console.error('Job card insert error:', error);
      alert('Error: ' + error.message);
    } else if (data) {
      setApplications(prev => [...prev, data]);
      setShowAddModal(false);
      setNewTitle('');
      setNewCompany('');
      setNewDescription('');
      setNewResumeId('');
      setNewNotes('');
    }
    setAddLoading(false);
  };

  const handleScheduleInterview = async (cardId, eventData) => {
    const { data } = await supabase
      .from('application_events')
      .insert({
        application_id: cardId,
        ...eventData,
      })
      .select()
      .single();
    if (data) {
      setInterviewRounds(prev => [...prev, data]);
    }
  };

  const handleLinkResume = async (cardId, resumeId) => {
    await supabase
      .from('applications')
      .update({ resume_id: resumeId, updated_at: new Date().toISOString() })
      .eq('id', cardId);
    const resume = jsResumes.find(r => r.id === resumeId);
    setApplications(prev => prev.map(a =>
      a.id === cardId ? { ...a, resume_id: resumeId, resumes: resume || null } : a
    ));
    setSelectedCard(prev => prev ? { ...prev, resume_id: resumeId, resumes: resume || null } : prev);
  };

  const handleArchiveCard = async (cardId) => {
    const card = applications.find(a => a.id === cardId);
    await supabase
      .from('applications')
      .update({ application_status: 'archived', last_active_status: card.application_status, updated_at: new Date().toISOString() })
      .eq('id', cardId);
    setArchivedCards(prev => [...prev, { ...card, application_status: 'archived', last_active_status: card.application_status }]);
    setApplications(prev => prev.filter(a => a.id !== cardId));
    setShowCardModal(false);
  };

  function formatDate(dateString) {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  }

  const tier = userProfile?.subscription_tier;
  const isPro = tier === 'pro';
  const totalActive = applications.length;
  const totalInterviews = applications.filter(a => a.application_status === 'interview').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-purple-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex">

      {/* Sidebar */}
      <div
        className="w-64 text-white flex flex-col fixed left-0 top-0 shadow-lg z-40"
        style={{ background: 'linear-gradient(180deg, #667eea 0%, #764ba2 100%)', height: '100vh', overflowY: 'hidden' }}
      >
        <div className="px-6 pt-6 pb-4 flex-shrink-0">
          <h1 className="text-[28px] font-bold mb-1.5 tracking-tight">Job Tracker</h1>
          <p className="text-[13px] text-white leading-tight mb-0.5">Job hunting is small talk.</p>
          <p className="text-[13px] text-white leading-tight">Your career deserves a conversation.</p>
          <div className="mt-4 border-b border-white border-opacity-10"></div>
          <p className="text-[13px] font-bold text-white leading-tight tracking-tight mt-3">
            Every application in one place. Nothing slips through the cracks.
          </p>
        </div>

        <div className="flex-1 px-6 pt-2 pb-6 flex flex-col justify-between">
          <div>
            <div className="mb-5">
              <h4 className="text-sm font-bold uppercase tracking-wider text-white mb-1">WHAT TRACKER DOES</h4>
              <ul className="space-y-1.5 text-sm">
                <li className="flex items-start"><span className="mr-2">•</span><span>Track every application</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Move cards as you progress</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Link your resume & cover letter</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Store and view the job posting</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Log notes along the way</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Stay organized start to finish</span></li>
              </ul>
            </div>

            <div className="mb-3">
              <h4 className="text-sm font-bold uppercase tracking-wider text-white mb-1">WHEN YOU GET HIRED</h4>
              <ul className="space-y-1.5 text-sm">
                <li className="flex items-start"><span className="mr-2">•</span><span>Card moves to Career Vault</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Job description saved</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Track wins from day one</span></li>
              </ul>
            </div>
            
          </div>

          <div className="mt-auto">
            <div className="mb-4 border-b border-white border-opacity-10"></div>
            <p className="text-xs text-white text-opacity-90 leading-relaxed mb-3">
              While you're building your career, we're already building your next resume.
            </p>
            <div className="flex items-center gap-2.5 text-white">
              <img src="/images/Hire_Power_icon.png" alt="Lightning" className="h-5 w-auto flex-shrink-0" />
              <p className="text-sm font-medium leading-tight">Saves to Vault when hired.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="ml-64 flex-1 flex flex-col h-screen overflow-hidden">
        <MainNav currentPage="job-tracker" userProfile={userProfile} />

        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="px-6 pt-4 pb-2 flex items-center justify-between flex-shrink-0">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Your Job Search</h2>
              <p className="text-xs text-gray-500">Drag cards between columns as your search progresses</p>
            </div>
           <div className="flex items-center gap-2">
              
              <button
                onClick={() => setShowArchiveModal(true)}
                className="text-xs font-semibold py-1.5 px-4 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
              >
                📁 Archive ({archivedCards.length})
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="text-white text-xs font-bold py-1.5 px-4 rounded-lg hover:opacity-90 transition-opacity"
                style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
              >
                + Add Job
              </button>
            </div>
          </div>

          {/* Kanban */}
          <div className="flex-1 overflow-x-auto overflow-y-hidden px-6 pb-4">
            <div className="flex gap-3 h-full" style={{ minWidth: 900 }}>
              {COLUMNS.map(col => {
                const cards = getColumnCards(col.id);
                const isOver = dragOverColumn === col.id;

                return (
                  <div
                    key={col.id}
                    className="flex flex-col flex-1 min-w-[170px]"
                    onDragOver={(e) => handleDragOver(e, col.id)}
                    onDrop={(e) => handleDrop(e, col.id)}
                    onDragLeave={() => setDragOverColumn(null)}
                  >
                    {/* Column header */}
                    <div
                      className="rounded-t-xl px-3 py-2 flex items-center justify-between flex-shrink-0"
                      style={{
                        background: col.bg,
                        border: `1px solid ${col.border}`,
                        borderBottom: 'none',
                      }}
                    >
                      <span className="text-xs" style={{ fontWeight: 800, color: col.color }}>{col.label}</span>
                      <span className="text-[10px] font-bold rounded-full px-1.5 py-0.5" style={{ background: col.border, color: col.color }}>{cards.length}</span>
                    </div>

                    {/* Column body */}
                    <div
                      className="flex-1 rounded-b-xl p-2 overflow-y-auto flex flex-col gap-2 transition-colors"
                      style={{
                        background: isOver ? col.bg : '#f9fafb',
                        borderLeft: `1px solid ${isOver ? col.color : '#e5e7eb'}`,
                        borderRight: `1px solid ${isOver ? col.color : '#e5e7eb'}`,
                        borderBottom: `1px solid ${isOver ? col.color : '#e5e7eb'}`,
                        borderTop: 'none',
                        minHeight: 200,
                      }}
                    >
                      {cards.length === 0 && (
                        <div className="flex-1 flex items-center justify-center">
                          <p className="text-[10px] text-gray-300 font-medium">
                            {isOver ? '↓ Drop here' : 'No cards'}
                          </p>
                        </div>
                      )}

                      {cards.map(card => (
                        <div
                          key={card.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, card)}
                          onDragEnd={handleDragEnd}
                          onClick={async () => {
            setSelectedCard(card);
            setShowCardModal(true);
            if (card.application_status === 'interview' || card.application_status === 'hired') {
              const { data } = await supabase
                .from('application_events')
                .select('*')
                .eq('application_id', card.id)
                .eq('status', 'interview_scheduled')
                .order('event_date', { ascending: true });
              setInterviewRounds(data || []);
            } else {
              setInterviewRounds([]);
            }
          }}
                          className="bg-white rounded-lg p-2.5 shadow-sm border border-gray-200 cursor-grab active:cursor-grabbing hover:border-purple-300 hover:shadow-md transition-all flex flex-col"
                          style={{ opacity: dragCard?.id === card.id ? 0.4 : 1, height: '100px' }}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-gray-900 leading-tight mb-0.5 line-clamp-2">{card.title}</p>
                              <p className="text-[11px] text-gray-500">{card.company}</p>
                            </div>
                            {card.match_score && (
                              <div className="relative flex-shrink-0" style={{ width: '32px', height: '32px' }}>
                                <svg width="32" height="32" style={{ transform: 'rotate(-90deg)' }}>
                                  <circle cx="16" cy="16" r="12" stroke="#e5e7eb" strokeWidth="2.5" fill="none" />
                                  <circle
                                    cx="16" cy="16" r="12"
                                    stroke={card.match_score >= 85 ? '#9333ea' : card.match_score >= 75 ? '#81c784' : card.match_score >= 60 ? '#ffc870' : '#e57373'}
                                    strokeWidth="2.5" fill="none"
                                    strokeDasharray={`${2 * Math.PI * 12}`}
                                    strokeDashoffset={`${2 * Math.PI * 12 * (1 - card.match_score / 100)}`}
                                    strokeLinecap="round"
                                  />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <span className="text-[8px] font-bold" style={{ color: card.match_score >= 85 ? '#9333ea' : card.match_score >= 75 ? '#81c784' : card.match_score >= 60 ? '#ffc870' : '#e57373' }}>
                                    {card.match_score}%
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="mt-auto pt-1 flex flex-wrap gap-1">
                            {card.resumes && (
                              <span className="text-[9px] bg-purple-50 text-purple-600 border border-purple-100 px-1.5 py-0.5 rounded-md font-semibold">
                                Resume linked
                              </span>
                            )}

                            {card.interview_date && (
                              <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-100 px-1.5 py-0.5 rounded-md font-semibold">
                                📅 {new Date(card.interview_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                            )}

                            {card.notes && (
                              <p className="text-[10px] text-gray-400 leading-tight line-clamp-1 w-full">{card.notes}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Add Card Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4" style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Add Job Card</h2>
                  <p className="text-purple-100 text-xs mt-0.5">Card starts in Resume Ready</p>
                </div>
                <button onClick={() => setShowAddModal(false)} className="text-white text-2xl leading-none font-light hover:opacity-70">×</button>
              </div>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Link to JS Resume</label>
                <p className="text-[10px] text-gray-400 mb-1">Select a JS resume to auto-fill the job details, or fill them in manually below.</p>
                <select
                  value={newResumeId}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === '') {
                      setNewResumeId('');
                      setNewTitle('');
                      setNewCompany('');
                    } else {
                      const selected = jsResumes.find(r => r.id === val);
                      setNewResumeId(val);
                      const nameParts = (selected?.display_name || '').split(' at ');
                      setNewTitle(selected?.job_title || nameParts[0] || '');
                      setNewCompany(selected?.job_company || nameParts[1] || '');
                      setNewDescription(selected?.job_description || '');
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">No resume linked — fill in manually</option>
                  {jsResumes.map(r => (
                    <option key={r.id} value={r.id}>{r.display_name || 'Untitled'}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Job Title *</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="e.g. Marketing Coordinator"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Company *</label>
                <input
                  type="text"
                  value={newCompany}
                  onChange={e => setNewCompany(e.target.value)}
                  placeholder="e.g. Acme Corp"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Job Description</label>
                <textarea
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  placeholder="Paste the job description here..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Notes</label>
                <textarea
                  value={newNotes}
                  onChange={e => setNewNotes(e.target.value)}
                  placeholder="Referral source, recruiter name, anything useful..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                />
              </div>
              <div className="flex justify-center pt-1">
                <button
                  onClick={handleAddCard}
                  disabled={!newTitle || !newCompany || addLoading}
                  className="px-8 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
                  style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
                >
                  {addLoading ? 'Adding...' : 'Add Card'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rejected Archive Prompt */}
      {rejectedPromptCard && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        >
          <div
            className="bg-white shadow-2xl overflow-hidden"
            style={{ width: '364px', borderRadius: '12px' }}
          >
            <div
              className="px-6 py-5 relative"
              style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)' }}
            >
              <div className="flex items-center gap-3">
                <img src="/images/Hire_Power_icon.png" alt="Hire Power" className="h-8 w-auto flex-shrink-0" />
                <div>
                  <h2 className="text-base font-bold text-white">Move to Archive?</h2>
                  <p className="text-purple-100 text-xs">{rejectedPromptCard.title} · {rejectedPromptCard.company}</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-gray-700 mb-5 leading-snug">
                Do you want to archive this application? It will move out of your Job Tracker board but will always be accessible from your Career Archive.
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => {
                    setRejectedPromptCard(null);
                  }}
                  className="px-5 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  Keep on Board
                </button>
                <button
                  onClick={async () => {
                    await supabase
                      .from('applications')
                      .update({ application_status: 'archived', last_active_status: 'rejected', updated_at: new Date().toISOString() })
                      .eq('id', rejectedPromptCard.id);
                    setArchivedCards(prev => [...prev, { ...rejectedPromptCard, application_status: 'archived', last_active_status: 'rejected' }]);
                    setApplications(prev => prev.filter(a => a.id !== rejectedPromptCard.id));
                    setRejectedPromptCard(null);
                  }}
                  className="px-5 py-2 rounded-lg text-xs font-bold text-white hover:opacity-90 transition-opacity"
                  style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
                >
                  Archive It
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hired Celebration Modal */}
      {showHiredModal && hiredCard && (
        <>
          <style>{`
            @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,900;1,900&family=DM+Sans:wght@400;500;600&display=swap');
          `}</style>
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          >
            <div
              className="flex flex-col items-center text-center overflow-hidden relative"
              style={{
                borderRadius: '20px',
                maxWidth: '440px',
                width: '100%',
                background: '#1a1033',
                border: '1px solid rgba(147,51,234,0.25)',
                boxShadow: '0 40px 120px rgba(0,0,0,0.6), 0 0 80px rgba(147,51,234,0.15)',
              }}
            >
              {/* Radial glow */}
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '500px', height: '350px',
                background: 'radial-gradient(ellipse, rgba(147,51,234,0.2) 0%, transparent 70%)',
                pointerEvents: 'none',
                zIndex: 0,
              }} />

              {/* Content */}
              <div className="relative flex flex-col items-center px-10 py-10" style={{ zIndex: 1 }}>

                {/* Checkmark */}
                <div
                  className="flex items-center justify-center mb-5"
                  style={{
                    width: '44px', height: '44px', borderRadius: '50%',
                    background: 'rgba(147,51,234,0.2)',
                    border: '1px solid rgba(147,51,234,0.4)',
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                </div>

                {/* Eyebrow */}
                <p style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: '#a78bfa',
                  marginBottom: '12px',
                }}>Congratulations</p>

                {/* Headline */}
                <div style={{ marginBottom: '4px' }}>
                  <span style={{
                    fontFamily: "'Fraunces', serif",
                    fontSize: 'clamp(28px,4vw,42px)',
                    fontWeight: 900,
                    lineHeight: 1.0,
                    letterSpacing: '-1.5px',
                    color: 'white',
                  }}>You got the </span>
                  <span style={{
                    fontFamily: "'Fraunces', serif",
                    fontSize: 'clamp(28px,4vw,42px)',
                    fontWeight: 900,
                    fontStyle: 'italic',
                    lineHeight: 1.0,
                    letterSpacing: '-1.5px',
                    color: '#9333ea',
                  }}>job.</span>
                </div>

                {/* Role + Company */}
                <p style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'rgba(255,255,255,0.4)',
                  marginBottom: '16px',
                  marginTop: '8px',
                  lineHeight: 1.4,
                }}>
                  {hiredCard.title} · {hiredCard.company}
                </p>

                {/* Divider */}
                <div style={{ width: '32px', height: '1px', background: 'rgba(147,51,234,0.4)', marginBottom: '16px' }} />

                {/* Body copy */}
                {isPro ? (
                  <>
                    <p style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '15px',
                      fontWeight: 400,
                      color: 'rgba(255,255,255,0.65)',
                      lineHeight: 1.45,
                      marginBottom: '20px',
                      maxWidth: '340px',
                    }}>
                      Three years from now, you won't remember what you accomplished today. But Hire Power will.
                    </p>
                    <p style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '15px',
                      fontWeight: 600,
                      color: 'rgba(255,255,255,0.9)',
                      lineHeight: 1.45,
                      marginBottom: '36px',
                      maxWidth: '340px',
                    }}>
                      Career Vault builds your next resume while you're building your career. Keeping you prepared anytime great opportunities arise.
                    </p>
                    <button
                      onClick={() => {
                        setShowHiredModal(false);
                        router.push('/career-vault');
                      }}
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: '13px',
                        fontWeight: 700,
                        color: 'white',
                        background: 'linear-gradient(135deg, #667eea, #764ba2)',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '8px 24px',
                        cursor: 'pointer',
                        boxShadow: '0 4px 24px rgba(102,126,234,0.4)',
                        transition: 'opacity 0.2s',
                      }}
                      onMouseOver={e => e.target.style.opacity = '0.9'}
                      onMouseOut={e => e.target.style.opacity = '1'}
                    >
                      Open Career Vault →
                    </button>
                  </>
                ) : (
                  <>
                    <p style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '15px',
                      fontWeight: 400,
                      color: 'rgba(255,255,255,0.65)',
                      lineHeight: 1.45,
                      marginBottom: '20px',
                      maxWidth: '340px',
                    }}>
                      Now the real work begins — and the wins start stacking up. Don't let them get lost.
                    </p>
                    <p style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '15px',
                      fontWeight: 600,
                      color: 'rgba(255,255,255,0.9)',
                      lineHeight: 1.45,
                      marginBottom: '36px',
                      maxWidth: '340px',
                    }}>
                      Upgrade to Vault and we'll track your achievements as they happen — so your next resume writes itself.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                      <button
                        onClick={() => {
                          setShowHiredModal(false);
                          router.push('/resume-coach');
                        }}
                        style={{
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: '13px',
                          fontWeight: 700,
                          color: 'white',
                          background: 'linear-gradient(135deg, #667eea, #764ba2)',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '8px 24px',
                          cursor: 'pointer',
                          boxShadow: '0 4px 24px rgba(102,126,234,0.4)',
                          transition: 'opacity 0.2s',
                        }}
                        onMouseOver={e => e.target.style.opacity = '0.9'}
                        onMouseOut={e => e.target.style.opacity = '1'}
                      >
                        Upgrade to Vault — $4.99/mo →
                      </button>
                      <button
                        onClick={() => setShowHiredModal(false)}
                        style={{
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: '12px',
                          fontWeight: 500,
                          color: 'rgba(255,255,255,0.4)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        Stay in Job Tracker
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── ARCHIVE MODAL ── */}
      {showArchiveModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowArchiveModal(false)}
        >
          <div
            className="bg-white shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col"
            style={{ borderRadius: '12px', height: '80vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)' }}
              className="px-6 py-5 relative flex-shrink-0"
            >
              <button
                onClick={() => setShowArchiveModal(false)}
                className="absolute top-3 right-4 text-white hover:opacity-70 text-2xl leading-none font-light"
              >×</button>
              <div className="flex items-center gap-3">
                <img src="/images/Hire_Power_icon.png" alt="Hire Power" className="h-8 w-auto flex-shrink-0" />
                <div>
                  <h2 className="text-xl font-bold text-white">Job Archive</h2>
                  <p className="text-purple-100 text-xs">{archivedCards.length} past application{archivedCards.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              {/* Archived Job Cards */}
              <div>
                {archivedCards.length > 0 ? (
                  <div className="space-y-2">
                    {archivedCards.map((card) => (
                      <div key={card.id} className="border border-gray-200 rounded-lg p-4 hover:border-purple-200 transition-colors cursor-pointer" onClick={async () => {
                        setCardOpenedFromArchive(true);
                        setSelectedCard(card);
                        setShowCardModal(true);
                        if (card.application_status === 'interview' || card.application_status === 'hired') {
                          const { data } = await supabase
                            .from('application_events')
                            .select('*')
                            .eq('application_id', card.id)
                            .eq('status', 'interview_scheduled')
                            .order('event_date', { ascending: true });
                          setInterviewRounds(data || []);
                        } else {
                          setInterviewRounds([]);
                        }
                      }}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <p className="text-sm font-semibold text-gray-900">{card.title}</p>
                              <StatusBadge status={card.last_active_status || card.application_status} />
                            </div>
                            <p className="text-xs text-gray-500 mb-2">
                              {card.company}{card.application_date ? ` · Applied ${formatDate(card.application_date)}` : ''}
                            </p>
                            <div className="flex items-center gap-3 flex-wrap">
                              {card.resumes && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); router.push(`/resume/${card.resumes.id}`); }}
                                  className="text-[10px] text-purple-600 font-semibold hover:text-purple-700"
                                >📄 View Resume</button>
                              )}
                              {card.application_status === 'hired' && (
                                <span className="text-[10px] text-gray-400">🔒 JD saved to Vault</span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (confirm('Delete this archived card? This cannot be undone.')) {
                                await supabase.from('applications').delete().eq('id', card.id);
                                setArchivedCards(prev => prev.filter(a => a.id !== card.id));
                              }
                            }}
                            className="text-[10px] text-red-400 font-semibold hover:text-red-600 flex-shrink-0"
                          >Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10 text-gray-400">
                    <div className="text-4xl mb-2">📁</div>
                    <p className="text-sm">No archived items yet</p>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

    {/* Card Detail Modal */}
      {showCardModal && selectedCard && (
        <JobCardModal
          card={selectedCard}
          onClose={() => {
            setShowCardModal(false);
            if (cardOpenedFromArchive) {
              setShowArchiveModal(true);
              setCardOpenedFromArchive(false);
            }
          }}
          onArchive={handleArchiveCard}
          onSaveNotes={async (cardId, notes) => {
            await supabase.from('applications').update({ notes }).eq('id', cardId);
            setApplications(prev => prev.map(a => a.id === cardId ? { ...a, notes } : a));
          }}
          onLinkResume={handleLinkResume}
          onScheduleInterview={handleScheduleInterview}
          jsResumes={jsResumes}
          interviewRounds={interviewRounds}
          context="tracker"
          isPro={isPro}
        />
      )}

    </div>
  );
}