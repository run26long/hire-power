'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import MainNav from '../components/MainNav';
import JobCardModal from '../components/JobCardModal';
import ErrorToast from '../components/ErrorToast';
import UpgradeModal from '../components/UpgradeModal';

// Status badge colors — muted to avoid clashing with HP purple
function StatusBadge({ status }) {
  const config = {
    hired:      { label: 'Hired',      bg: '#f0fdf4', border: '#86efac', text: '#166534' },
    applied:    { label: 'Applied',    bg: '#fefce8', border: '#fde047', text: '#854d0e' },
    interview:  { label: 'Interview',  bg: '#eff6ff', border: '#93c5fd', text: '#1e40af' },
    rejected:   { label: 'Rejected',   bg: '#fef2f2', border: '#fca5a5', text: '#991b1b' },
    saved:      { label: 'Saved',      bg: '#f5f3ff', border: '#c4b5fd', text: '#5b21b6' },
    archived:   { label: 'Archived',   bg: '#f9fafb', border: '#d1d5db', text: '#6b7280' },
  };
  const c = config[status] || config.saved;
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide"
      style={{ background: c.bg, borderColor: c.border, color: c.text }}>
      {c.label}
    </span>
  );
}

export default function CareerVaultPage() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState('vault');

  // Accomplishments
  const [accomplishments, setAccomplishments] = useState([]);
  const [showLogModal, setShowLogModal] = useState(false);
  const [logText, setLogText] = useState('');
  const [logDate, setLogDate] = useState('');
  const [logSaving, setLogSaving] = useState(false);
  const [logError, setLogError] = useState(null);

  // Archive modal
 const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [resumeCount, setResumeCount] = useState(0);
  const [showNewSearchModal, setShowNewSearchModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const handleStartNewSearch = async () => {
    await supabase
      .from('profiles')
      .update({ search_status: 'actively_searching' })
      .eq('id', user.id);
    router.push('/resume-coach');
  };

  // Current job entry (from hired job card)
  const [currentJobEntry, setCurrentJobEntry] = useState(null);

  // Job card modal
  const [showJobModal, setShowJobModal] = useState(false);
  const [showArchiveCardModal, setShowArchiveCardModal] = useState(false);
  const [selectedArchiveCard, setSelectedArchiveCard] = useState(null);
  const [jsResumes, setJsResumes] = useState([]);

  // Archive state
  const [archivedCards, setArchivedCards] = useState([]);
  const [archivedCoreResumes, setArchivedCoreResumes] = useState([]);
  const [activeApplications, setActiveApplications] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(null); // { id, type: 'card' | 'core' }
  const [archiveActionLoading, setArchiveActionLoading] = useState(false);
  const [errorToast, setErrorToast] = useState(null);

  const logInputRef = useRef(null);

  // Set current job manually
  const [showSetJobModal, setShowSetJobModal] = useState(false);
  const [setJobTitle, setSetJobTitle] = useState('');
  const [setJobCompany, setSetJobCompany] = useState('');
  const [setJobDescription, setSetJobDescription] = useState('');
  const [setJobResumeId, setSetJobResumeId] = useState('');
  const [setJobHiredDate, setSetJobHiredDate] = useState('');
  const [setJobSaving, setSetJobSaving] = useState(false);
  const [setJobError, setSetJobError] = useState(null);

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/dashboard'); return; }
      setUser(user);

      const { data: profile } = await supabase
        .from('profiles').select('*').eq('id', user.id).single();
      setUserProfile(profile);
      setTier(profile?.subscription_tier || 'vault');

      // Load hired card first so we can filter accomplishments by it
      const { data: hiredCard } = await supabase
        .from('applications')
        .select('*, resumes!applications_resume_id_fkey(id, display_name, current_score)')
        .eq('user_id', user.id)
        .eq('application_status', 'hired')
        .order('hired_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (hiredCard) setCurrentJobEntry(hiredCard);

      // Load accomplishments tied to current hired card only
      if (hiredCard?.id) {
        const { data: accs } = await supabase
          .from('achievements')
          .select('*')
          .eq('user_id', user.id)
          .eq('source', 'career_archive')
          .eq('application_id', hiredCard.id)
          .order('created_at', { ascending: false });
        if (accs) setAccomplishments(accs);
      }

      const { count: resumeCount } = await supabase
        .from('resumes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('resume_type', 'core')
        .eq('is_active', true);
      setResumeCount(resumeCount || 0);

      // Load archived job cards
      const { data: archivedApps } = await supabase
        .from('applications')
        .select('*, resumes!applications_resume_id_fkey(id, display_name, current_score)')
        .eq('user_id', user.id)
        .eq('application_status', 'archived')
        .order('updated_at', { ascending: false });

      const statusPriority = { hired: 0, interview: 1, applied: 2, resume_in_progress: 3, rejected: 4, archived: 5 };
      const sortedApps = (archivedApps || []).sort((a, b) =>
        (statusPriority[a.application_status] ?? 5) - (statusPriority[b.application_status] ?? 5)
      );
      setArchivedCards(sortedApps);

      // Load archived core resumes (is_active = false)
      const { data: inactiveCores } = await supabase
        .from('resumes')
        .select('id, display_name, created_at, updated_at, current_score, resume_power_score')
        .eq('user_id', user.id)
        .eq('resume_type', 'core')
        .eq('is_active', false)
        .order('updated_at', { ascending: false });
      setArchivedCoreResumes(inactiveCores || []);

           // Load active application counts
      const { data: activeApps } = await supabase
        .from('applications')
        .select('application_status')
        .eq('user_id', user.id)
        .not('application_status', 'eq', 'archived');
      setActiveApplications(activeApps || []);

      // Load JS resumes for linking
      const { data: jsResumesData } = await supabase
        .from('resumes')
        .select('id, display_name, current_score')
        .eq('user_id', user.id)
        .eq('resume_type', 'job_specific')
        .order('updated_at', { ascending: false });
      setJsResumes(jsResumesData || []);

      setLoading(false);
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('downgraded') === 'true') {
        setErrorToast("You've switched to Vault. Career history saved. Ready to log wins!");
        window.history.replaceState({}, '', '/career-vault');
      }
    }
    loadData();
  }, [supabase, router]);

  // Focus input when log modal opens
  useEffect(() => {
    if (showLogModal) {
      setTimeout(() => logInputRef.current?.focus(), 100);
    }
  }, [showLogModal]);

  async function handleSaveAccomplishment() {
    if (!logText.trim()) { setLogError('Tell us what happened.'); return; }
    setLogSaving(true);
    setLogError(null);
    try {
      const { data, error } = await supabase
        .from('achievements')
        .insert({
          user_id: user.id,
          source: 'career_archive',
          raw_description: logText.trim(),
          status: 'approved',
          application_id: currentJobEntry?.id || null,
          created_at: logDate
            ? new Date(logDate).toISOString()
            : new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      setAccomplishments(prev => [data, ...prev]);
      setLogText('');
      setLogDate('');
      setShowLogModal(false);
    } catch (err) {
      console.error('Error saving accomplishment:', err);
      setLogError('Something went wrong. Please try again.');
    } finally {
      setLogSaving(false);
    }
  }

  async function handleDeleteAccomplishment(id) {
    const { error } = await supabase.from('achievements').delete().eq('id', id);
    if (error) {
      setErrorToast('Could not delete. Please try again.');
      return;
    }
    setAccomplishments(prev => prev.filter(a => a.id !== id));
  }

  async function handleSetCurrentJobManually() {
    if (!setJobTitle.trim() || !setJobCompany.trim()) {
      setSetJobError('Job title and company are required.');
      return;
    }
    setSetJobSaving(true);
    setSetJobError(null);
    try {
      const hiredAt = setJobHiredDate
        ? new Date(setJobHiredDate).toISOString()
        : new Date().toISOString();

      const { data, error } = await supabase
        .from('applications')
        .insert({
          user_id: user.id,
          title: setJobTitle.trim(),
          company: setJobCompany.trim(),
          description: setJobDescription.trim() || null,
          application_status: 'hired',
          hired_at: hiredAt,
          application_date: setJobHiredDate || new Date().toISOString().split('T')[0],
          resume_id: setJobResumeId || null,
          sort_order: 0,
        })
        .select('*, resumes!applications_resume_id_fkey(id, display_name, current_score)')
        .single();

      if (error) throw error;

      await supabase
        .from('profiles')
        .update({ search_status: 'hired' })
        .eq('id', user.id);

      setCurrentJobEntry(data);
      setShowSetJobModal(false);
      setSetJobTitle('');
      setSetJobCompany('');
      setSetJobDescription('');
      setSetJobResumeId('');
      setSetJobHiredDate('');
    } catch (err) {
      console.error('Error setting current job:', err);
      setSetJobError('Something went wrong. Please try again.');
    } finally {
      setSetJobSaving(false);
    }
  }

  async function handleRestoreCore(resumeId) {
    setArchiveActionLoading(true);
    await supabase
      .from('resumes')
      .update({ is_active: true })
      .eq('id', resumeId);
    setArchivedCoreResumes(prev => prev.filter(r => r.id !== resumeId));
    setResumeCount(prev => prev + 1);
    setArchiveActionLoading(false);
  }

  async function handleHardDelete() {
    if (!confirmDelete) return;
    setArchiveActionLoading(true);
    try {
      if (confirmDelete.type === 'core') {
        const { error } = await supabase.from('resumes').delete().eq('id', confirmDelete.id);
        if (error) throw error;
        setArchivedCoreResumes(prev => prev.filter(r => r.id !== confirmDelete.id));
      } else {
        const { error } = await supabase.from('applications').delete().eq('id', confirmDelete.id);
        if (error) throw error;
        setArchivedCards(prev => prev.filter(c => c.id !== confirmDelete.id));
      }
      setConfirmDelete(null);
    } catch (err) {
      console.error('Delete error:', err);
      setErrorToast('Could not delete. Please try again.');
    } finally {
      setArchiveActionLoading(false);
    }
  }

  function formatDate(dateString) {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-purple-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const isPro = tier === 'pro';
  const firstName = userProfile?.first_name || userProfile?.display_name?.split(' ')[0] || '';

  return (
    <div className="h-screen bg-gray-50 flex">

      {/* Left Sidebar */}
      <div
        className="hidden md:flex w-64 text-white flex-col fixed left-0 top-0 shadow-lg z-40"
        style={{
          background: 'linear-gradient(180deg, #667eea 0%, #764ba2 100%)',
          height: '100vh',
          overflowY: 'hidden'
        }}
      >
        <div className="px-6 pt-6 pb-4 flex-shrink-0">
          <h1 className="text-[28px] font-bold mb-1.5 whitespace-nowrap tracking-tight">Career Vault</h1>
          <p className="text-[13px] text-white text-opacity-95 leading-tight tracking-tight mb-0.5">
            Job hunting is small talk.
          </p>
          <p className="text-[13px] text-white text-opacity-95 leading-tight tracking-tight">
            Your career deserves a conversation.
          </p>
          <div className="mt-4 border-b border-gray-400 border-opacity-10"></div>
          <p className="text-[13px] font-bold text-white leading-tight tracking-tight mt-3">
            Three years from now, you won't remember today's achievements. 
          </p>
          <p className="text-[13px] font-bold text-white leading-tight tracking-tight mt-3">
            But Hire Power will.
          </p>
        </div>

        <div className="flex-1 px-6 pt-2 pb-6 flex flex-col justify-between">
          <div>
            <div className="mb-5">
              <h4 className="text-sm font-bold uppercase tracking-wider text-white mb-1">WHAT VAULT DOES</h4>
              <ul className="space-y-1.5 text-sm">
                <li className="flex items-start"><span className="mr-2">•</span><span>Save your current job entry</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Log wins in 30 seconds</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Access all your resumes</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Run job match scores</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Basic interview practice</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Browse your archive</span></li>
              </ul>
            </div>

            <div className="mb-3">
              <h4 className="text-sm font-bold uppercase tracking-wider text-white mb-1">WHEN YOU'RE READY</h4>
              {isPro ? (
                <ul className="space-y-1.5 text-sm">
                  <li className="flex items-start"><span className="mr-2">•</span><span>Jump back into Resume Coach</span></li>
                  <li className="flex items-start"><span className="mr-2">•</span><span>5-minutes with your coach</span></li>
                  <li className="flex items-start"><span className="mr-2">•</span><span>Your resume builds itself</span></li>
                </ul>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  <li className="flex items-start"><span className="mr-2">•</span><span>Upgrade to Pro</span></li>
                  <li className="flex items-start"><span className="mr-2">•</span><span>5-minutes with your coach</span></li>
                  <li className="flex items-start"><span className="mr-2">•</span><span>Your resume builds itself</span></li>
                </ul>
              )}
            </div>
          </div>

          <div className="mt-auto">
            <div className="mb-4 border-b border-gray-400 border-opacity-10"></div>
            <div>
              <p className="text-xs text-white text-opacity-90 leading-relaxed mb-3">
                While you're building your career, we're already building your next resume.
              </p>
              <div className="flex items-center gap-2.5 text-white">
                <img src="/images/Hire_Power_icon.png" alt="Lightning" className="h-5 w-auto flex-shrink-0" />
                <p className="text-sm font-medium leading-tight">
                  Log a win. It'll matter later.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-0 md:ml-64 flex-1 flex flex-col h-screen overflow-hidden">
        <MainNav currentPage="career-vault" userProfile={userProfile} />

        <div className="flex-1 overflow-y-auto">
          <div className="px-8 py-4 max-w-[1400px] mx-auto w-full">

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">

              {/* LEFT: Accomplishments (8 cols) */}
             <div className="col-span-1 md:col-span-8 flex flex-col gap-4">

                {/* Current Job Section */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold text-gray-900">Current Job</h2>
                      {currentJobEntry && <StatusBadge status="hired" />}
                    </div>
                    <div className="flex items-center gap-2">
                      {!currentJobEntry && <span className="text-[10px] text-gray-400 font-medium">Not set</span>}
                      <span className="md:hidden text-xs font-semibold px-3 py-1 rounded-md" style={{ backgroundColor: 'rgba(147, 51, 234, 0.08)', color: '#7e22ce' }}>Career Vault</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mb-4">
                    The saved job description and any accomplishments you log here attach to this job entry to create your next resume.
                  </p>

                  {currentJobEntry ? (() => {
                    const start = currentJobEntry.hired_at
                      ? new Date(currentJobEntry.hired_at)
                      : currentJobEntry.application_date
                      ? new Date(currentJobEntry.application_date)
                      : null;
                    let tenureStr = '';
                    let sinceStr = '';
                    if (start) {
                      const now = new Date();
                      const totalMonths = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
                      const years = Math.floor(totalMonths / 12);
                      const months = totalMonths % 12;
                      if (years > 0 && months > 0) tenureStr = `${years} yr ${months} mo`;
                      else if (years > 0) tenureStr = `${years} yr`;
                      else if (months > 0) tenureStr = `${months} mo`;
                      else tenureStr = 'Just started';
                      sinceStr = start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                    }
                    return (
                      <div className="flex flex-col gap-3 w-full">
                        {/* Job card — full width */}
                        <button
                          onClick={() => setShowJobModal(true)}
                          className="w-full bg-gray-50 rounded-lg border border-gray-200 p-3 hover:border-purple-300 hover:shadow-sm transition-all text-left group flex items-center gap-3"
                        >
                          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', border: '2px solid #86efac' }}>
                            <span className="text-xl">🏆</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate">{currentJobEntry.title}</p>
                            <p className="text-xs text-gray-500 truncate">{currentJobEntry.company}</p>
                          </div>
                          <span className="text-gray-300 group-hover:text-purple-400 text-xs transition-colors flex-shrink-0">→</span>
                        </button>

                        {/* Tenure + Wins + Button on same row */}
                        <div className="flex gap-3 items-stretch">
                          {/* Tenure card */}
                          <div className="bg-gray-50 rounded-lg border border-gray-200 px-4 py-3 flex flex-col items-center justify-center text-center flex-shrink-0">
                            {sinceStr && (
                              <>
                                <p className="text-[10px] font-bold text-purple-600 uppercase tracking-wider leading-none">Since</p>
                                <p className="text-sm font-bold text-gray-700 mt-1 whitespace-nowrap">{sinceStr}</p>
                                {tenureStr && tenureStr !== 'Just started' && (
                                  <p className="text-[10px] text-gray-400 mt-1 whitespace-nowrap">{tenureStr} in role</p>
                                )}
                              </>
                            )}
                          </div>

                          {/* Wins card */}
                          <div className="bg-gray-50 rounded-lg border border-gray-200 px-4 py-3 flex flex-col items-center justify-center text-center flex-shrink-0">
                            <p className="text-3xl font-bold text-purple-600 leading-none">{accomplishments.length}</p>
                            <p className="text-[10px] text-gray-500 uppercase tracking-wide mt-1">Wins Logged</p>
                          </div>

                          {/* Log a Win button */}
                          <button
                            onClick={() => setShowLogModal(true)}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-white rounded-lg text-xs font-semibold transition-opacity hover:opacity-90 flex-shrink-0 self-center"
                            style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
                          >
                            <span>+</span> Log a Win
                          </button>
                        </div>
                      </div>
                    );
                  })() : (
                    <div className="border border-dashed border-gray-300 rounded-lg p-4 text-center bg-gray-50">
                      <p className="text-xs text-gray-500 mb-2">
                        No current job set. Mark a job card as Hired and it appears here automatically.
                      </p>
                      <button
                        onClick={() => setShowSetJobModal(true)}
                        className="text-xs text-purple-600 font-semibold hover:text-purple-700"
                      >
                        Set current job manually →
                      </button>
                    </div>
                  )}
                </div>

                {/* Accomplishments Log */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 flex flex-col flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h2 className="text-lg font-semibold text-gray-900">Accomplishments</h2>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400">{accomplishments.length} logged</span>
                      {accomplishments.length > 0 && (
                        <button
                          onClick={() => setShowLogModal(true)}
                          className="text-xs text-purple-600 font-semibold hover:text-purple-700"
                        >
                          + Add
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mb-4">
                    Log wins as they happen — promotions, projects, metrics, skills, anything worth remembering.
                  </p>

                  {/* Accomplishment List */}
                  {accomplishments.length > 0 ? (
                    <div className="space-y-2">
                      {accomplishments.map((acc) => (
                        <div
                          key={acc.id}
                          className="group flex items-start gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg hover:border-purple-200 transition-colors"
                        >
                          <div className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0 mt-1.5"></div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-800 leading-snug">{acc.raw_description}</p>
                            {acc.created_at && (
                              <p className="text-[10px] text-gray-400 mt-1">{formatDate(acc.created_at)}</p>
                            )}
                          </div>
                          <button
                            onClick={() => handleDeleteAccomplishment(acc.id)}
                            className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all flex-shrink-0 text-lg leading-none"
                            title="Delete"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-3 border border-dashed border-gray-200 rounded-lg bg-gray-50">
                      <div className="text-4xl mb-2">🏆</div>
                      {!currentJobEntry ? (
                        <>
                          <p className="text-sm font-semibold text-gray-600 mb-1">No current job set</p>
                          <p className="text-xs text-gray-400 text-center leading-relaxed">
                            Mark a job as Hired and wins you log will attach to that role automatically.
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-semibold text-gray-600 mb-1">Nothing logged yet</p>
                          <p className="text-xs text-gray-400 text-center leading-relaxed">
                            The next time something good happens at work, log it here.<br />
                            Takes 30 seconds. Saves hours later.
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>

              </div>

             {/* RIGHT: Compact status + actions + upgrade (4 cols) */}
                <div className="col-span-1 md:col-span-4 flex flex-col gap-3">

                  {/* Stats + Quick Actions combined */}
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="mb-3">
                      <h2 className="text-sm font-semibold text-gray-900">Your Career Vault</h2>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {[
                        { label: 'Logged',   value: accomplishments.length, icon: '🏆' },
                        { label: 'Resumes',  value: resumeCount,            icon: '📄' },
                        { label: 'Archived', value: archivedCards.length + archivedCoreResumes.length, icon: '📁' },
                      ].map((item) => (
                        <div key={item.label} className="text-center p-2 bg-gray-50 rounded-lg border border-gray-200 select-none">
                          <div className="text-base">{item.icon}</div>
                          <div className="text-lg font-bold text-gray-700">{item.value}</div>
                          <div className="text-[9px] text-gray-400 uppercase tracking-wide">{item.label}</div>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-gray-100 pt-1 mt-1 mb-2 text-center">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                        {isPro ? 'Quick Actions' : 'Quick Actions Still Available in Vault'}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <button onClick={() => router.push('/resume-coach')}
                        className="w-full flex items-center gap-2 p-2 bg-white rounded-lg hover:bg-purple-50 border border-gray-200 hover:border-purple-300 transition-colors text-left group shadow-sm">
                        <span className="text-sm">📄</span>
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-gray-800">Resume Coach</p>
                          <p className="text-[10px] text-gray-400">{isPro ? 'Build, coach, and download' : 'View, format, download'}</p>
                        </div>
                        <span className="text-gray-300 group-hover:text-purple-400 text-xs transition-colors">→</span>
                      </button>
                      <button onClick={() => router.push('/interview-coach')}
                        className="w-full flex items-center gap-2 p-2 bg-white rounded-lg hover:bg-purple-50 border border-gray-200 hover:border-purple-300 transition-colors text-left group shadow-sm">
                        <span className="text-sm">🎤</span>
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-gray-800">Interview Practice</p>
                          <p className="text-[10px] text-gray-400">{isPro ? 'Job-specific prep, always ready' : 'Generic practice, always free'}</p>
                        </div>
                        <span className="text-gray-300 group-hover:text-purple-400 text-xs transition-colors">→</span>
                      </button>
                      <button onClick={() => setShowArchiveModal(true)}
                        className="w-full flex items-center gap-2 p-2 bg-white rounded-lg hover:bg-purple-50 border border-gray-200 hover:border-purple-300 transition-colors text-left group shadow-sm">
                        <span className="text-sm">📁</span>
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-gray-800">View Archive</p>
                          <p className="text-[10px] text-gray-400">{archivedCards.length + archivedCoreResumes.length} archived items</p>
                        </div>
                        <span className="text-gray-300 group-hover:text-purple-400 text-xs transition-colors">→</span>
                      </button>
                    </div>
                  </div>

                  {/* Upgrade CTA */}
                  <div className="bg-white rounded-lg shadow-sm border border-purple-200 p-3 pb-6">
                   {isPro ? (
                      <>
                        <h2 className="text-sm font-semibold text-gray-900 mb-0.5">Ready to search again?</h2>
                        <p className="text-xs text-gray-500 mb-1.5">Update your resume in minutes using everything you've logged.</p>
                        <div className="bg-purple-50 border-l-4 border-purple-600 p-1.5 rounded-r mb-2">
                          <p className="text-xs text-gray-700 leading-snug">
                            You've logged <strong className="text-purple-700">{accomplishments.length} win{accomplishments.length !== 1 ? 's' : ''}</strong> in your current job. Your coach remembers all of it.
                          </p>
                        </div>
                        <button
                          onClick={() => setShowNewSearchModal(true)}
                          className="block mx-auto text-white rounded-lg py-2 px-8 text-xs font-semibold hover:opacity-90 transition-opacity"
                          style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
                        >
                          Start new search →
                        </button>
                      </>
                    ) : (
                      <>
                        <h2 className="text-sm font-semibold text-gray-900 mb-0.5">Ready to job search again?</h2>
                        <p className="text-xs text-gray-500 mb-1.5">Upgrade to Pro and we'll coach everything you've logged into a stronger resume.</p>
                        <div className="bg-purple-50 border-l-4 border-purple-600 p-1.5 rounded-r mb-2">
                          <p className="text-xs text-gray-700 leading-snug">
                            You've logged <strong className="text-purple-700">{accomplishments.length} win{accomplishments.length !== 1 ? 's' : ''}</strong> in your current job. Upgrade so your coach can apply them to your resume.
                          </p>
                        </div>
                       <button
                          onClick={() => setShowUpgradeModal(true)}
                          className="w-full bg-purple-600 text-white rounded-lg py-2 text-xs font-semibold hover:bg-purple-700 transition-colors"
                        >
                          Upgrade to Pro — $29.99/mo
                        </button>
                      </>
                    )}
                  </div>

                </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── JOB CARD MODAL ── */}
      {showJobModal && currentJobEntry && (
        <JobCardModal
          card={currentJobEntry}
          onClose={() => setShowJobModal(false)}
          onSaveNotes={async (cardId, notes) => {
            await supabase.from('applications').update({ notes }).eq('id', cardId);
            setCurrentJobEntry(prev => ({ ...prev, notes }));
          }}
          onLogWin={() => { setShowJobModal(false); setShowLogModal(true); }}
          onLinkResume={async (cardId, resumeId) => {
            await supabase.from('applications').update({ resume_id: resumeId }).eq('id', cardId);
            const resume = jsResumes.find(r => r.id === resumeId);
            setCurrentJobEntry(prev => ({ ...prev, resume_id: resumeId, resumes: resume || null }));
          }}
          jsResumes={jsResumes}
          context="vault"
          accomplishmentsCount={accomplishments.length}
          isPro={isPro}
        />
      )}

     {/* ── LOG WIN MODAL ── */}
      {showLogModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.85)' }}
          onClick={() => { setShowLogModal(false); setLogText(''); setLogDate(''); setLogError(null); }}
        >
          <div
            className="bg-white shadow-2xl w-full max-w-lg border border-gray-200 flex flex-col"
            style={{ borderRadius: '8px' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)', borderRadius: '8px 8px 0 0' }}
              className="px-6 py-5 relative flex-shrink-0"
            >
              <button
                onClick={() => { setShowLogModal(false); setLogText(''); setLogDate(''); setLogError(null); }}
                className="absolute top-4 right-4 text-white hover:text-gray-200 text-3xl leading-none font-light"
              >×</button>
              <div className="flex items-center gap-3">
                <img src="/images/Hire_Power_icon.png" alt="Hire Power" className="h-8 w-auto flex-shrink-0" />
                <div>
                  <h2 className="text-xl font-bold text-white">Log a Win</h2>
                  <p className="text-purple-100 text-xs">30 seconds now. Hours saved later.</p>
                </div>
              </div>
            </div>

            {/* Body */}
           <div className="p-4 md:p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">What happened?</label>
                <textarea
                  ref={logInputRef}
                  value={logText}
                  onChange={e => setLogText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && e.metaKey) handleSaveAccomplishment();
                  }}
                  placeholder="e.g. Led the Q3 product launch across 3 teams. Delivered 2 weeks early."
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  Don't overthink it. Raw notes are fine — numbers, scale, impact, whatever you remember.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Approximate date <span className="font-normal text-gray-400">(optional)</span></label>
                <div className="flex gap-2">
                  <select
                    value={logDate ? logDate.split('-')[1] : ''}
                    onChange={e => {
                      const year = logDate ? logDate.split('-')[0] : new Date().getFullYear().toString();
                      setLogDate(e.target.value ? `${year}-${e.target.value}` : '');
                    }}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">Month</option>
                    {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m, i) => (
                      <option key={m} value={m}>
                        {['January','February','March','April','May','June','July','August','September','October','November','December'][i]}
                      </option>
                    ))}
                  </select>
                  <select
                    value={logDate ? logDate.split('-')[0] : ''}
                    onChange={e => {
                      const month = logDate ? logDate.split('-')[1] : '01';
                      setLogDate(e.target.value ? `${e.target.value}-${month}` : '');
                    }}
                    className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">Year</option>
                    {Array.from({length: 10}, (_, i) => new Date().getFullYear() - i).map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              {logError && <p className="text-xs text-red-600">{logError}</p>}

              {/* Example prompts */}
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-2">Need a nudge?</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Got a promotion',
                    'Led a project',
                    'Trained someone',
                    'Hit a metric',
                    'Solved a problem',
                    'Got recognized',
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => setLogText(prev => prev ? prev + ` ${prompt.toLowerCase()}` : prompt)}
                      className="text-[10px] bg-white border border-gray-200 text-gray-600 px-2 py-0.5 rounded-full hover:border-purple-300 hover:text-purple-600 transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleSaveAccomplishment}
                disabled={logSaving || !logText.trim()}
                className="text-white rounded-lg py-2 px-6 font-bold text-xs hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2 mx-auto"
                style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
              >
                {logSaving && <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                {logSaving ? 'Saving...' : 'Save to Vault'}
              </button>
            </div>
          </div>
        </div>
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
                  <p className="text-purple-100 text-xs">{archivedCards.length + archivedCoreResumes.length} archived items — resumes and history preserved</p>
                </div>
              </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              {/* Section 1: Archived Core Resumes */}
              {archivedCoreResumes.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Core Resumes</p>
                  <div className="space-y-2">
                    {archivedCoreResumes.map((resume) => (
                      <div key={resume.id} className="border border-gray-200 rounded-lg p-4 hover:border-purple-200 transition-colors">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 mb-0.5 truncate">{resume.display_name || 'Untitled Resume'}</p>
                            <p className="text-[10px] text-gray-400">Archived {formatDate(resume.updated_at)}{resume.current_score ? ` · Score: ${resume.current_score}` : ''}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              onClick={() => router.push(`/resume/${resume.id}`)}
                              className="text-[10px] text-purple-600 font-semibold hover:text-purple-700"
                            >View</button>
                            <button
                              onClick={() => handleRestoreCore(resume.id)}
                              disabled={archiveActionLoading}
                              className="text-[10px] text-green-600 font-semibold hover:text-green-700 disabled:opacity-50"
                            >Restore</button>
                            <button
                              onClick={() => setConfirmDelete({ id: resume.id, type: 'core' })}
                              className="text-[10px] text-red-400 font-semibold hover:text-red-600"
                            >Delete</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section 2: Archived Job Cards */}
              <div>
                {archivedCoreResumes.length > 0 && (
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Past Applications</p>
                )}
                {archivedCards.length > 0 ? (
                  <div className="space-y-2">
                    {archivedCards.map((card) => (
                      <div key={card.id} className="border border-gray-200 rounded-lg p-4 hover:border-purple-200 transition-colors cursor-pointer" onClick={() => {
                        setSelectedArchiveCard(card);
                        setShowArchiveCardModal(true);
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
                            onClick={(e) => { e.stopPropagation(); setConfirmDelete({ id: card.id, type: 'card' }); }}
                            className="text-[10px] text-red-400 font-semibold hover:text-red-600 flex-shrink-0"
                          >Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : archivedCoreResumes.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">
                    <div className="text-4xl mb-2">📁</div>
                    <p className="text-sm">No archived items yet</p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 text-center py-4">No past applications yet</p>
                )}
              </div>

           </div>
          </div>
        </div>
      )}

      {/* ── ARCHIVE CARD MODAL ── */}
      {showArchiveCardModal && selectedArchiveCard && (
        <JobCardModal
          card={selectedArchiveCard}
          onClose={() => { setShowArchiveCardModal(false); setSelectedArchiveCard(null); }}
          onSaveNotes={async (cardId, notes) => {
            await supabase.from('applications').update({ notes }).eq('id', cardId);
            setArchivedCards(prev => prev.map(c => c.id === cardId ? { ...c, notes } : c));
          }}
          jsResumes={jsResumes}
          context="vault"
          isPro={isPro}
        />
      )}

    {/* ── SET CURRENT JOB MODAL ── */}
      {showSetJobModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => { setShowSetJobModal(false); setSetJobError(null); }}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4" style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img src="/images/Hire_Power_icon.png" alt="Hire Power" className="h-8 w-auto flex-shrink-0" />
                  <div>
                    <h2 className="text-base font-bold text-white">Set Current Job</h2>
                    <p className="text-purple-100 text-xs">Wins you log will attach to this role and feed into your next resume.</p>
                  </div>
                </div>
                <button
                  onClick={() => { setShowSetJobModal(false); setSetJobError(null); }}
                  className="text-white hover:opacity-70 text-2xl leading-none font-light"
                >×</button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {jsResumes.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Link a JS Resume <span className="font-normal text-gray-400">(optional)</span></label>
                  <select
                    value={setJobResumeId}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '') {
                        setSetJobResumeId('');
                      } else {
                        const selected = jsResumes.find(r => r.id === val);
                        setSetJobResumeId(val);
                        if (selected?.display_name) {
                          const parts = selected.display_name.split(' at ');
                          if (!setJobTitle) setSetJobTitle(parts[0] || '');
                          if (!setJobCompany) setSetJobCompany(parts[1] || '');
                        }
                      }
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                  >
                    <option value="">No resume linked</option>
                    {jsResumes.map(r => (
                      <option key={r.id} value={r.id}>{r.display_name || 'Untitled'}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Job Title *</label>
                <input
                  type="text"
                  value={setJobTitle}
                  onChange={e => setSetJobTitle(e.target.value)}
                  placeholder="e.g. Operations Coordinator"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Company *</label>
                <input
                  type="text"
                  value={setJobCompany}
                  onChange={e => setSetJobCompany(e.target.value)}
                  placeholder="e.g. Freeman"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Start Date <span className="font-normal text-gray-400">(optional)</span></label>
                <input
                  type="date"
                  value={setJobHiredDate}
                  onChange={e => setSetJobHiredDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Job Description <span className="font-normal text-gray-400">(optional but recommended)</span></label>
                <textarea
                  value={setJobDescription}
                  onChange={e => setSetJobDescription(e.target.value)}
                  placeholder="Paste the job description — your coach will use this when it's time to build your next resume."
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
              </div>
              {setJobError && <p className="text-xs text-red-600">{setJobError}</p>}
              <button
                onClick={handleSetCurrentJobManually}
                disabled={setJobSaving || !setJobTitle.trim() || !setJobCompany.trim()}
                className="w-full rounded-lg py-2.5 font-semibold text-sm flex items-center justify-center gap-2 transition-opacity disabled:opacity-60 hover:opacity-90"
                style={{ background: 'linear-gradient(to right, #667eea, #764ba2)', color: 'white' }}
              >
                {setJobSaving && <div className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent" />}
                {setJobSaving ? 'Saving...' : 'Set as Current Job →'}
              </button>
            </div>
          </div>
        </div>
      )}

    <ErrorToast message={errorToast} onClose={() => setErrorToast(null)} />

      {/* NEW SEARCH MODAL */}
      {showNewSearchModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowNewSearchModal(false)}
        >
          <div
            className="bg-white shadow-2xl w-full overflow-hidden"
            style={{ maxWidth: '364px', borderRadius: '12px' }}
            onClick={e => e.stopPropagation()}
          >
            <div
              style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)' }}
              className="px-6 py-5"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.2)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Ready to search again?</h2>
                  <p className="text-purple-100 text-xs">Your vault stays exactly where it is.</p>
                </div>
              </div>
            </div>

            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-gray-700 leading-relaxed">
                Your Resume Coach will walk you through incorporating everything you've logged: your wins, skills, and the role you landed, all building a stronger starting point for your next search.
              </p>

              <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 space-y-2">
                {[
                  'Your Career Vault and logged wins are kept',
                  'Your resumes and coaching history are kept',
                  'Job Tracker replaces Career Vault in your nav',
                ].map(item => (
                  <div key={item} className="flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#667eea" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <span className="text-xs text-gray-600">{item}</span>
                  </div>
                ))}
              </div>

              <div>
                <button
                  onClick={() => { setShowNewSearchModal(false); router.push('/resume-coach'); }}
                  className="text-xs text-purple-600 hover:text-purple-700 font-medium bg-transparent border-none cursor-pointer p-0"
                >
                  Just want to view or download your resume? Go to Resume Coach →
                </button>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowNewSearchModal(false)}
                  className="flex-1 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Not yet
                </button>
                <button
                  onClick={handleStartNewSearch}
                  className="flex-1 py-2 text-sm font-semibold text-white rounded-lg hover:opacity-90 transition-opacity"
                  style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
                >
                  Start new search →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

   <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        currentTier={tier}
      />
    </div>
  );
}