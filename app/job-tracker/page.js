'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import MainNav from '../components/MainNav';

const COLUMNS = [
  { id: 'resume_in_progress', label: 'Resume Ready', color: '#7c3aed', bg: 'rgba(124,58,237,0.06)',  border: 'rgba(124,58,237,0.2)'  },
  { id: 'applied',            label: 'Applied',      color: '#1d4ed8', bg: 'rgba(29,78,216,0.06)',   border: 'rgba(29,78,216,0.2)'   },
  { id: 'interview',          label: 'Interview',    color: '#92400e', bg: 'rgba(146,64,14,0.06)',   border: 'rgba(146,64,14,0.2)'   },
  { id: 'hired',              label: 'Hired 🎉',     color: '#15803d', bg: 'rgba(21,128,61,0.06)',   border: 'rgba(21,128,61,0.2)'   },
  { id: 'rejected',           label: 'Rejected',     color: '#6b7280', bg: 'rgba(107,114,128,0.06)', border: 'rgba(107,114,128,0.2)' },
];

export default function JobTrackerPage() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [applications, setApplications] = useState([]);
  const [archivedCards, setArchivedCards] = useState([]);
  const [jsResumes, setJsResumes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);

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
        .select('*, resumes(display_name, current_score)')
        .eq('user_id', user.id)
        .not('application_status', 'eq', 'archived')
        .order('sort_order', { ascending: true });
      setApplications(apps || []);

      const { data: archived } = await supabase
        .from('applications')
        .select('*')
        .eq('user_id', user.id)
        .eq('application_status', 'archived')
        .order('updated_at', { ascending: false });
      setArchivedCards(archived || []);

      const { data: resumes } = await supabase
        .from('resumes')
        .select('id, display_name, current_score')
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

    // Optimistic update
    setApplications(prev => prev.map(a =>
      a.id === dragCard.id ? { ...a, application_status: columnId } : a
    ));

    await supabase
      .from('applications')
      .update({ application_status: columnId, updated_at: new Date().toISOString() })
      .eq('id', dragCard.id);

    // Auto-archive hired and rejected after brief delay so user sees it land
    if (columnId === 'hired' || columnId === 'rejected') {
      setTimeout(() => {
        setArchivedCards(prev => [...prev, { ...dragCard, application_status: columnId }]);
        setApplications(prev => prev.filter(a => a.id !== dragCard.id));
      }, 1800);
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
      .select('*, resumes(display_name, current_score)')
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

  const handleArchiveCard = async (cardId) => {
    const card = applications.find(a => a.id === cardId);
    await supabase
      .from('applications')
      .update({ application_status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', cardId);
    setArchivedCards(prev => [...prev, { ...card, application_status: 'archived' }]);
    setApplications(prev => prev.filter(a => a.id !== cardId));
    setShowCardModal(false);
  };

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
          <p className="text-[13px] text-white leading-tight mb-0.5">Every application.</p>
          <p className="text-[13px] text-white leading-tight">One place. Nothing slips.</p>
          <div className="mt-4 border-b border-white border-opacity-10"></div>
        </div>

        <div className="flex-1 px-6 pt-3 pb-6 flex flex-col justify-between">
          <div>
            {/* Stats */}
            <div className="mb-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-white opacity-70 mb-2">YOUR SEARCH</h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg p-2.5 text-center" style={{ background: 'rgba(255,255,255,0.12)' }}>
                  <div className="text-2xl font-bold text-white">{totalActive}</div>
                  <div className="text-[10px] text-white opacity-70">Active</div>
                </div>
                <div className="rounded-lg p-2.5 text-center" style={{ background: 'rgba(255,255,255,0.12)' }}>
                  <div className="text-2xl font-bold text-white">{totalInterviews}</div>
                  <div className="text-[10px] text-white opacity-70">Interviews</div>
                </div>
              </div>
            </div>

            {/* Column counts */}
            <div className="mb-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-white opacity-70 mb-2">BOARD</h4>
              <div className="space-y-1.5">
                {COLUMNS.map(col => (
                  <div key={col.id} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-white opacity-50 flex-shrink-0"></div>
                    <span className="text-xs text-white opacity-80">{col.label}</span>
                    <span className="ml-auto text-xs font-bold text-white opacity-50">
                      {getColumnCards(col.id).length}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <button
                onClick={() => setShowAddModal(true)}
                className="w-full text-white text-xs font-bold py-2 px-4 rounded-lg hover:opacity-90 transition-opacity text-left flex items-center gap-2"
                style={{ background: 'rgba(255,255,255,0.15)' }}
              >
                <span>+</span> Add Job Card
              </button>
              <button
                onClick={() => setShowArchiveModal(true)}
                className="w-full text-white text-xs font-bold py-2 px-4 rounded-lg hover:opacity-90 transition-opacity text-left flex items-center gap-2"
                style={{ background: 'rgba(255,255,255,0.10)' }}
              >
                <span>📁</span> View Archive ({archivedCards.length})
              </button>
            </div>
          </div>

          <div className="mt-auto">
            <div className="mb-3 border-b border-white border-opacity-10"></div>
            <div className="flex items-center gap-2.5 text-white">
              <img src="/images/Hire_Power_icon.png" alt="Lightning" className="h-5 w-auto flex-shrink-0" />
              <p className="text-xs font-medium leading-tight opacity-90">Hired cards save to your Vault.</p>
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
            <button
              onClick={() => setShowAddModal(true)}
              className="text-white text-xs font-bold py-1.5 px-4 rounded-lg hover:opacity-90 transition-opacity"
              style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
            >
              + Add Job
            </button>
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
                        border: `1px solid ${isOver ? col.color : '#e5e7eb'}`,
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
                          onClick={() => { setSelectedCard(card); setShowCardModal(true); }}
                          className="bg-white rounded-lg p-2.5 shadow-sm border border-gray-200 cursor-grab active:cursor-grabbing hover:border-purple-300 hover:shadow-md transition-all"
                          style={{ opacity: dragCard?.id === card.id ? 0.4 : 1 }}
                        >
                          <p className="text-xs font-bold text-gray-900 leading-tight mb-0.5">{card.title}</p>
                          <p className="text-[11px] text-gray-500 mb-1.5">{card.company}</p>

                          {card.resumes && (
                            <div className="mb-1">
                              <span className="text-[9px] bg-purple-50 text-purple-600 border border-purple-100 px-1.5 py-0.5 rounded-md font-semibold">
                                Resume linked
                              </span>
                            </div>
                          )}

                          {card.interview_date && (
                            <div className="mb-1">
                              <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-100 px-1.5 py-0.5 rounded-md font-semibold">
                                📅 {new Date(card.interview_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                            </div>
                          )}

                          {card.notes && (
                            <p className="text-[10px] text-gray-400 mt-1 leading-tight line-clamp-2">{card.notes}</p>
                          )}
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
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Job Title *</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="e.g. Marketing Coordinator"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  autoFocus
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
                <label className="block text-xs font-bold text-gray-700 mb-1">Link to JS Resume</label>
                <select
                  value={newResumeId}
                  onChange={e => setNewResumeId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">No resume linked yet</option>
                  {jsResumes.map(r => (
                    <option key={r.id} value={r.id}>{r.display_name || 'Untitled'}</option>
                  ))}
                </select>
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
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddCard}
                  disabled={!newTitle || !newCompany || addLoading}
                  className="flex-1 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
                  style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
                >
                  {addLoading ? 'Adding...' : 'Add Card'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Card Detail Modal */}
      {showCardModal && selectedCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4" style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">{selectedCard.title}</h2>
                  <p className="text-purple-100 text-xs">{selectedCard.company}</p>
                </div>
                <button onClick={() => setShowCardModal(false)} className="text-white text-2xl leading-none font-light hover:opacity-70">×</button>
              </div>
            </div>
            <div className="px-6 py-5 space-y-3">

              <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs font-bold text-gray-500 mb-0.5 uppercase tracking-wide">Status</p>
                <p className="text-sm font-semibold text-gray-900 capitalize">{selectedCard.application_status?.replace(/_/g, ' ')}</p>
              </div>

              {selectedCard.resumes && (
                <div className="flex items-center justify-between p-2.5 bg-purple-50 rounded-lg border border-purple-100">
                  <div>
                    <p className="text-xs font-bold text-purple-700">Linked Resume</p>
                    <p className="text-xs text-purple-600">{selectedCard.resumes.display_name}</p>
                  </div>
                  <button
                    onClick={() => router.push(`/resume/${selectedCard.resume_id}`)}
                    className="text-xs font-bold text-purple-600 hover:text-purple-800"
                  >
                    Open →
                  </button>
                </div>
              )}

              {selectedCard.interview_date && (
                <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-100">
                  <p className="text-xs font-bold text-amber-700 mb-0.5">Interview Date</p>
                  <p className="text-sm font-semibold text-amber-900">
                    {new Date(selectedCard.interview_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </p>
                </div>
              )}

              {selectedCard.notes && (
                <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs font-bold text-gray-500 mb-0.5 uppercase tracking-wide">Notes</p>
                  <p className="text-sm text-gray-700">{selectedCard.notes}</p>
                </div>
              )}

              {isPro && (
                <div className="flex items-center justify-between p-2.5 bg-amber-50 rounded-lg border border-amber-100">
                  <div>
                    <p className="text-xs font-bold text-amber-700">Interview Coach</p>
                    <p className="text-[10px] text-amber-600">Practice for this specific job</p>
                  </div>
                  <button
                    onClick={() => router.push('/interview-coach')}
                    className="text-xs font-bold text-amber-700 hover:text-amber-900"
                  >
                    Practice →
                  </button>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => handleArchiveCard(selectedCard.id)}
                  className="flex-1 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-50"
                >
                  Archive
                </button>
                <button
                  onClick={() => setShowCardModal(false)}
                  className="flex-1 py-2 rounded-lg text-xs font-bold text-white hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Archive Modal */}
      {showArchiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4" style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Archive</h2>
                  <p className="text-purple-100 text-xs">{archivedCards.length} past applications</p>
                </div>
                <button onClick={() => setShowArchiveModal(false)} className="text-white text-2xl leading-none font-light hover:opacity-70">×</button>
              </div>
            </div>
            <div className="px-6 py-4 max-h-96 overflow-y-auto">
              {archivedCards.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No archived cards yet.</p>
              ) : (
                <div className="space-y-2">
                  {archivedCards.map(card => (
                    <div key={card.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div>
                        <p className="text-sm font-bold text-gray-900">{card.title}</p>
                        <p className="text-xs text-gray-500">{card.company}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        card.application_status === 'hired'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {card.application_status === 'hired' ? '🎉 Hired' : 'Archived'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-6 py-3 border-t border-gray-100 flex justify-end">
              <button onClick={() => setShowArchiveModal(false)} className="text-xs font-semibold text-gray-500 hover:text-gray-700">Close</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}