'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import MainNav from '../components/MainNav';
import JobCardModal from '../components/JobCardModal';
import ErrorToast from '../components/ErrorToast';
import UpgradeModal from '../components/UpgradeModal';
import { fetchJSON } from '@/lib/fetchJSON';

// Status badge colors — muted to avoid clashing with HP purple
function GapWinLogger({ gapText, currentJobEntry, supabase, user, onSaved, onDismiss, onRegenerate }) {
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSave() {
    if (!text.trim()) return
    setSaving(true)
    setError(null)
    try {
      const { data, error: saveError } = await supabase
        .from('achievements')
        .insert({
          user_id: user.id,
          source: 'career_archive',
          raw_description: text.trim(),
          status: 'approved',
          application_id: currentJobEntry?.id || null,
          created_at: new Date().toISOString(),
        })
        .select()
        .single()
      if (saveError) throw saveError
      onSaved(data)
      setText('')
      onDismiss()
      onRegenerate()
    } catch (err) {
      console.error('Gap win save error:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-amber-50 border-l-4 border-amber-400 px-4 py-3 rounded-r mb-6">
      <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-1">Heads up</p>
      <p className="text-xs text-amber-800 leading-snug mb-3">{gapText}</p>
      <div className="flex gap-2 items-start">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="What happened during that stretch?"
          rows={2}
          className="flex-1 border border-amber-300 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none bg-white"
        />
        <button
          onClick={handleSave}
          disabled={saving || !text.trim()}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90 flex-shrink-0 flex items-center gap-1.5"
          style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
        >
          {saving && <div className="h-3 w-3 animate-spin rounded-full border-2 border-solid border-white border-r-transparent" />}
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}

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
  const [activeResumes, setActiveResumes] = useState([]);
  const [showResumeListModal, setShowResumeListModal] = useState(false);
  const [confirmArchiveResume, setConfirmArchiveResume] = useState(null);
  const [archivingResumeId, setArchivingResumeId] = useState(null);
  const [showNewSearchModal, setShowNewSearchModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Review Prep
  const [showOlderWinsModal, setShowOlderWinsModal] = useState(false)
  const [selectedWin, setSelectedWin] = useState(null)
  const [winCopied, setWinCopied] = useState(false)
  const [showReviewPrepModal, setShowReviewPrepModal] = useState(false)
  const [reviewPrepStep, setReviewPrepStep] = useState(1)
  const [rpName, setRpName] = useState('')
  const [rpTitle, setRpTitle] = useState('')
  const [rpCompany, setRpCompany] = useState('')
  const [rpDate, setRpDate] = useState('')
  const [rpRange, setRpRange] = useState('12months')
  const [rpFocus, setRpFocus] = useState('standard')
  const [rpDocument, setRpDocument] = useState('')
  const [rpLoading, setRpLoading] = useState(false)
  const [rpError, setRpError] = useState(null)
  const [rpCopied, setRpCopied] = useState(false)
  const [rpHasGap, setRpHasGap] = useState(false)
  const [rpGapText, setRpGapText] = useState('')
  const [rpGapDismissed, setRpGapDismissed] = useState(false)
  const [rpDownloading, setRpDownloading] = useState(false)

  const handleStartNewSearch = async () => {
    const now = new Date().toISOString();

    try {
      // Archive all active applications
      const { data: activeApps, error: activeAppsError } = await supabase
        .from('applications')
        .select('id, application_status')
        .eq('user_id', user.id)
        .not('application_status', 'eq', 'archived');
      if (activeAppsError) throw activeAppsError;

      if (activeApps?.length > 0) {
        const archiveResults = await Promise.all(activeApps.map(app =>
          supabase
            .from('applications')
            .update({
              application_status: 'archived',
              last_active_status: app.application_status,
              updated_at: now
            })
            .eq('id', app.id)
        ));
        const archiveError = archiveResults.find(r => r.error);
        if (archiveError) throw archiveError.error;
      }

      // Archive all job specific resumes (core resume stays active)
      const { error: jsError } = await supabase
        .from('resumes')
        .update({ is_active: false, updated_at: now })
        .eq('user_id', user.id)
        .eq('resume_type', 'job_specific')
        .eq('is_active', true);
      if (jsError) throw jsError;

      // Archive all cover letters
      const { error: clError } = await supabase
        .from('cover_letters')
        .update({ is_active: false, updated_at: now })
        .eq('user_id', user.id)
        .eq('is_active', true);
      if (clError) throw clError;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ search_status: 'actively_searching' })
        .eq('id', user.id);
      if (profileError) throw profileError;

      router.push('/resume-coach');
    } catch (err) {
      console.error('Start new search failed:', err);
      setErrorToast("We couldn't start your new search. Please try again.");
    }
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
  const [setJobTitleError, setSetJobTitleError] = useState(null);
  const [setJobCompany, setSetJobCompany] = useState('');
  const [setJobCompanyError, setSetJobCompanyError] = useState(null);
  const [setJobDescription, setSetJobDescription] = useState('');
  const [setJobResumeId, setSetJobResumeId] = useState('');
  const [setJobHiredDate, setSetJobHiredDate] = useState('');
  const [setJobSaving, setSetJobSaving] = useState(false);
  const [setJobError, setSetJobError] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push('/dashboard'); return; }
        setUser(user);

        const { data: profile, error: profileError } = await supabase
          .from('profiles').select('*').eq('id', user.id).maybeSingle();
        if (profileError) throw profileError;
        setUserProfile(profile);
        setTier(profile?.subscription_tier || 'vault');

        // Load hired card first so we can filter accomplishments by it
        const { data: hiredCard, error: hiredError } = await supabase
          .from('applications')
          .select('*, resumes!applications_resume_id_fkey(id, display_name, current_score)')
          .eq('user_id', user.id)
          .eq('application_status', 'hired')
          .order('hired_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (hiredError) throw hiredError;
        if (hiredCard) setCurrentJobEntry(hiredCard);

        // Load accomplishments tied to current hired card only
        if (hiredCard?.id) {
          const { data: accs, error: accsError } = await supabase
            .from('achievements')
            .select('*')
            .eq('user_id', user.id)
            .eq('source', 'career_archive')
            .eq('application_id', hiredCard.id)
            .order('created_at', { ascending: false });
          if (accsError) throw accsError;
          if (accs) setAccomplishments(accs);
        }

        // Load all active resumes (core + JS) for count and modal
        const { data: allActiveResumes, error: activeResumesError } = await supabase
          .from('resumes')
          .select('id, display_name, current_score, resume_type, job_title, job_company, updated_at, created_at')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('updated_at', { ascending: false });
        if (activeResumesError) throw activeResumesError;

        // Sort: core first, then job specific by most recently updated
        const sortedResumes = (allActiveResumes || []).sort((a, b) => {
          if (a.resume_type === 'core' && b.resume_type !== 'core') return -1;
          if (a.resume_type !== 'core' && b.resume_type === 'core') return 1;
          return new Date(b.updated_at) - new Date(a.updated_at);
        });
        setActiveResumes(sortedResumes);
        setResumeCount(sortedResumes.length);

        // Load archived job cards
        const { data: archivedApps, error: archivedError } = await supabase
          .from('applications')
          .select('*, resumes!applications_resume_id_fkey(id, display_name, current_score)')
          .eq('user_id', user.id)
          .eq('application_status', 'archived')
          .order('updated_at', { ascending: false });
        if (archivedError) throw archivedError;

        const statusPriority = { hired: 0, interview: 1, applied: 2, resume_in_progress: 3, rejected: 4, archived: 5 };
        const sortedApps = (archivedApps || []).sort((a, b) =>
          (statusPriority[a.application_status] ?? 5) - (statusPriority[b.application_status] ?? 5)
        );
        setArchivedCards(sortedApps);

        // Load archived core resumes (is_active = false)
        const { data: inactiveCores, error: inactiveError } = await supabase
          .from('resumes')
          .select('id, display_name, created_at, updated_at, current_score, resume_power_score')
          .eq('user_id', user.id)
          .eq('resume_type', 'core')
          .eq('is_active', false)
          .order('updated_at', { ascending: false });
        if (inactiveError) throw inactiveError;
        setArchivedCoreResumes(inactiveCores || []);

        // Load active application counts
        const { data: activeApps, error: activeAppsError } = await supabase
          .from('applications')
          .select('application_status')
          .eq('user_id', user.id)
          .not('application_status', 'eq', 'archived');
        if (activeAppsError) throw activeAppsError;
        setActiveApplications(activeApps || []);

        // Load job specific resumes for linking
        const { data: jsResumesData, error: jsResumesError } = await supabase
          .from('resumes')
          .select('id, display_name, current_score')
          .eq('user_id', user.id)
          .eq('resume_type', 'job_specific')
          .order('updated_at', { ascending: false });
        if (jsResumesError) throw jsResumesError;
        setJsResumes(jsResumesData || []);

        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('openArchive') === 'true') {
          setShowArchiveModal(true);
          window.history.replaceState({}, '', '/career-vault');
        }
        if (urlParams.get('downgraded') === 'true') {
          setErrorToast("You've switched to Vault. Career history saved. Ready to log wins!");
          window.history.replaceState({}, '', '/career-vault');
        }
      } catch (err) {
        console.error('Career vault load failed:', err);
        setErrorToast("We couldn't load your career vault. Please refresh the page.");
      } finally {
        setLoading(false);
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

  function handleOpenReviewPrep() {
    const displayName = userProfile?.display_name || `${userProfile?.first_name || ''} ${userProfile?.last_name || ''}`.trim() || ''
    setRpName(displayName)
    setRpTitle(currentJobEntry?.title || '')
    setRpCompany(currentJobEntry?.company || '')
    const now = new Date()
    setRpDate(`${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`)
    setRpRange('12months')
    setRpFocus('standard')
    setRpDocument('')
    setRpError(null)
    setRpCopied(false)
    setRpGapDismissed(false)
    setReviewPrepStep(1)
    setShowReviewPrepModal(true)
  }

  async function handleGenerateReviewPrep() {
    setRpLoading(true)
    setRpError(null)
    setReviewPrepStep(3)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const data = await fetchJSON('/api/review-prep', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          name: rpName,
          title: rpTitle,
          company: rpCompany,
          reviewDate: rpDate,
          dateRange: rpRange,
          focus: rpFocus,
          accomplishments
        })
      })
      if (!data.success) throw new Error("We couldn't generate your review prep. Please try again.")
      setRpDocument(data.document)
      setRpHasGap(data.hasGap || false)
      setRpGapText(data.gapText || '')
      setReviewPrepStep(4)
    } catch (err) {
      setRpError(err.message)
      setReviewPrepStep(2)
    } finally {
      setRpLoading(false)
    }
  }

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

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ search_status: 'hired' })
        .eq('id', user.id);
      if (profileError) throw profileError;

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
    try {
      const { error } = await supabase
        .from('resumes')
        .update({ is_active: true })
        .eq('id', resumeId);
      if (error) throw error;
      router.push(`/resume/${resumeId}`);
    } catch (err) {
      console.error('Restore core resume failed:', err);
      setErrorToast("We couldn't restore that resume. Please try again.");
      setArchiveActionLoading(false);
    }
  }

  async function handleArchiveResume(resume) {
    setArchivingResumeId(resume.id);
    try {
      const now = new Date().toISOString();

      // Archive the resume itself. JS resumes parented to a core resume stay active —
      // they're standalone artifacts tied to their own job cards.
      const { error } = await supabase
        .from('resumes')
        .update({ is_active: false, updated_at: now })
        .eq('id', resume.id)
        .eq('user_id', user.id);
      if (error) throw error;

      // Update local state
      setActiveResumes(prev => prev.filter(r => r.id !== resume.id));
      setResumeCount(prev => Math.max(0, prev - 1));
      setConfirmArchiveResume(null);

      // Reload archived list so it shows up in archive immediately
      const { data: archivedApps } = await supabase
        .from('applications')
        .select('*, resumes!applications_resume_id_fkey(id, display_name, current_score)')
        .eq('user_id', user.id)
        .eq('application_status', 'archived')
        .order('updated_at', { ascending: false });
      setArchivedCards(archivedApps || []);

      const { data: inactiveCores } = await supabase
        .from('resumes')
        .select('id, display_name, created_at, updated_at, current_score, resume_power_score')
        .eq('user_id', user.id)
        .eq('resume_type', 'core')
        .eq('is_active', false)
        .order('updated_at', { ascending: false });
      setArchivedCoreResumes(inactiveCores || []);
    } catch (err) {
      console.error('Error archiving resume:', err);
      setErrorToast('Could not archive. Please try again.');
    } finally {
      setArchivingResumeId(null);
    }
  }

  async function handleHardDelete() {
    if (!confirmDelete) return;
    setArchiveActionLoading(true);
    try {
      if (confirmDelete.type === 'core') {
        // Detach any job-specific resumes that reference this core as parent
        await supabase.from('resumes').update({ parent_resume_id: null }).eq('parent_resume_id', confirmDelete.id);
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
          </div>

        <div className="px-6 pt-0 pb-6">

          {/* Steps */}
          <div style={{ marginBottom: 16 }}>
            {[
              { 
                num: '1', 
                title: 'Save Your Current Job', 
                desc: 'Your title, company, and start date. The saved job description becomes foundation for your next resume.' 
              },
              { 
                num: '2', 
                title: 'Log Wins as They Happen', 
                desc: 'Promotions, projects, metrics, skills. Takes 30 seconds. Saves hours later.' 
              },
              { 
                num: '3', 
                title: 'Prepare for Your Review', 
                desc: 'Your logged wins organized by category, ready to reference during performance reviews.' 
              },
              { 
                num: '4', 
                title: 'Access All Your Resumes', 
                desc: 'All in one place. Any time you need them.' 
              },
              { 
                num: '5', 
                title: 'Browse Your Archive', 
                desc: 'Every resume you\'ve ever built, saved and searchable.' 
              },
              { 
                num: '6', 
                title: 'When You\'re Ready to Search', 
                desc: 'Five minutes with your coach and your resume updates itself.' 
              },
            ].map(({ num, title, desc, tag }) => (
              <div key={num} style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                <div style={{ 
                  width: 20, height: 20, borderRadius: '50%', 
                  border: '1.5px solid rgba(255,255,255,0.4)', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.7)',
                  flexShrink: 0, marginTop: 1
                }}>
                  {num}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#fff', lineHeight: 1.3, marginBottom: 2 }}>
                    {title}
                  </p>
                  <p style={{ fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,0.7)', lineHeight: 1.35, marginBottom: 0 }}>
                    {desc}
                  </p>
                  {tag && (
                    <span style={{ fontSize: 9, fontWeight: 700, fontStyle: 'italic', color: 'rgba(255,255,255,0.45)', letterSpacing: '0.02em', display: 'block', marginTop: -2 }}>
                      {tag}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Bottom section */}
          <div>
            <div className="border-b border-gray-400 border-opacity-10" style={{ marginBottom: 14 }}></div>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#fff', lineHeight: 1.3, marginBottom: 4 }}>
              Three years from now?
            </p>
            <p style={{ fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4, marginBottom: 0 }}>
              You won't remember today's achievements. But Hire Power will.
            </p>
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
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <h2 className="text-lg font-semibold text-gray-900 whitespace-nowrap">Current Job</h2>
                      {currentJobEntry && <StatusBadge status="hired" />}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!currentJobEntry && <span className="text-xs md:text-[10px] text-gray-400 font-medium">Not set</span>}
                      <span className="md:hidden text-xs font-semibold px-2 py-0.5 rounded-md whitespace-nowrap" style={{ backgroundColor: 'rgba(147, 51, 234, 0.08)', color: '#7e22ce' }}>Career Vault</span>
                    </div>
                  </div>
                  <p className="text-sm md:text-xs text-gray-500 mb-4">
                    The saved job description and any wins you log here attach to this job to create your next resume.
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
                      <div className="flex flex-col gap-3 w-full md:flex-row">
                        {/* Job card */}
                        <button
                          onClick={() => setShowJobModal(true)}
                          className="w-full md:w-1/2 bg-gray-50 rounded-lg border border-gray-200 p-3 hover:border-purple-300 hover:shadow-sm transition-all text-left group flex items-center gap-3"
                        >
                          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', border: '2px solid #86efac' }}>
                            <span className="text-xl">🏆</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-base md:text-sm font-bold text-gray-900 truncate">{currentJobEntry.title}</p>
                            <p className="text-sm md:text-xs text-gray-500 truncate">{currentJobEntry.company}</p>
                          </div>
                          <span className="text-gray-300 group-hover:text-purple-400 text-sm md:text-xs transition-colors flex-shrink-0">→</span>
                        </button>

                        {/* Tenure + Wins */}
                        <div className="flex gap-3 items-stretch flex-1">
                          {/* Tenure card */}
                          <div className="bg-gray-50 rounded-lg border border-gray-200 px-3 py-2 flex flex-col items-center justify-center text-center flex-1">
                           {sinceStr && (
                              <>
                                <p className="text-xs md:text-[10px] font-bold text-purple-600 uppercase tracking-wider leading-none">Since</p>
                                <p className="text-base md:text-sm font-bold text-gray-700 mt-1 whitespace-nowrap">{sinceStr}</p>
                                {tenureStr && tenureStr !== 'Just started' && (
                                  <p className="text-xs md:text-[10px] text-gray-400 mt-1 whitespace-nowrap">{tenureStr} in role</p>
                                )}
                              </>
                            )}
                          </div>

                          {/* Wins card */}
                          <div className="bg-gray-50 rounded-lg border border-gray-200 px-3 py-2 flex flex-col items-center justify-center text-center flex-1">
                            <p className="text-3xl font-bold text-purple-600 leading-none">{accomplishments.length}</p>
                            <p className="text-xs md:text-[10px] text-gray-500 uppercase tracking-wide mt-1">Wins Logged</p>
                          </div>
                        </div>

                        </div>
                    );
                  })() : (
                    <div className="border border-dashed border-gray-300 rounded-lg p-4 text-center bg-gray-50">
                      <p className="text-sm md:text-xs text-gray-500 mb-2">
                        No current job set. Mark a job card as Hired and it appears here automatically.
                      </p>
                      <button
                        onClick={() => setShowSetJobModal(true)}
                        className="text-sm md:text-xs text-purple-600 font-semibold hover:text-purple-700"
                      >
                        Set current job manually →
                      </button>
                    </div>
                  )}
                </div>

                {/* Accomplishments Log */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 pt-4 flex flex-col flex-1">
                  <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <h2 className="text-lg font-semibold text-gray-900 truncate">Accomplishments</h2>
                        <span className="text-sm md:text-xs text-gray-400 flex-shrink-0">{accomplishments.length} logged</span>
                      </div>
                      <button
                        onClick={() => setShowLogModal(true)}
                        className="text-sm md:text-xs font-semibold px-3 py-1.5 rounded-lg border border-purple-300 text-purple-600 hover:bg-purple-50 transition-colors whitespace-nowrap flex-shrink-0"
                      >
                        + Log a Win
                      </button>
                    </div>
                  <p className="text-sm md:text-xs text-gray-500 mb-2">
                    Log wins as they happen: promotions, projects, metrics, skills, anything worth remembering.
                  </p>

                  {/* Accomplishment List */}
                  {accomplishments.length > 0 ? (
                    <div className="space-y-1">
                      {accomplishments.slice(0, 4).map((acc) => (
                        <div
                          key={acc.id}
                          onClick={() => { setSelectedWin(acc); setWinCopied(false); }}
                          className="flex items-start gap-2.5 p-2 bg-gray-50 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors cursor-pointer"
                          style={{ height: '52px' }}
                        >
                          <div className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0 mt-1.5"></div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm md:text-xs text-gray-800 leading-snug line-clamp-2">{acc.raw_description}</p>
                          </div>
                        </div>
                      ))}
                      {accomplishments.length > 4 && (
                        <button
                          onClick={() => setShowOlderWinsModal(true)}
                          className="w-full text-center pt-4 text-sm md:text-xs text-purple-600 hover:text-purple-700 font-medium transition-colors"
                        >
                          See {accomplishments.length - 4} more win{accomplishments.length - 4 > 1 ? 's' : ''} →
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-3 border border-dashed border-gray-200 rounded-lg bg-gray-50">
                      <div className="text-4xl mb-2">🏆</div>
                      {!currentJobEntry ? (
                        <>
                          <p className="text-base md:text-sm font-semibold text-gray-600 mb-1">No current job set</p>
                          <p className="text-sm md:text-xs text-gray-400 text-center leading-relaxed">
                            Mark a job as Hired and wins you log will attach to that role automatically.
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-base md:text-sm font-semibold text-gray-600 mb-1">Nothing logged yet</p>
                          <p className="text-sm md:text-xs text-gray-400 text-center leading-relaxed">
                            The next time something good happens, log it here. Takes 30 seconds. Saves hours later.
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
                      <h2 className="text-lg md:text-sm font-semibold text-gray-900">Your Career Vault</h2>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {[
                        { label: 'Logged',   value: accomplishments.length, icon: '🏆', onClick: null },
                        { label: 'Resumes',  value: resumeCount,            icon: '📄', onClick: resumeCount > 0 ? () => setShowResumeListModal(true) : null },
                        { label: 'Archived', value: archivedCards.length + archivedCoreResumes.length, icon: '📁', onClick: (archivedCards.length + archivedCoreResumes.length) > 0 ? () => setShowArchiveModal(true) : null },
                      ].map((item) => (
                        <div
                          key={item.label}
                          onClick={item.onClick || undefined}
                          className={`text-center p-2 bg-gray-50 rounded-lg border border-gray-200 select-none ${item.onClick ? 'cursor-pointer hover:border-purple-300 hover:bg-purple-50 transition-colors' : ''}`}
                        >
                          <div className="text-2xl md:text-base">{item.icon}</div>
                          <div className="text-2xl md:text-lg font-bold text-gray-700">{item.value}</div>
                          <div className="text-xs md:text-[9px] text-gray-400 uppercase tracking-wide">{item.label}</div>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-gray-100 pt-1 mt-1 mb-2 text-center">
                      <p className="text-sm md:text-xs font-bold text-gray-500 uppercase tracking-wide">
                        {isPro ? 'Quick Actions' : 'Quick Actions Still Available in Vault'}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <button
                        onClick={accomplishments.length > 0 ? handleOpenReviewPrep : null}
                        disabled={accomplishments.length === 0}
                        className={`w-full flex items-center gap-2 p-2 rounded-lg border transition-colors text-left group shadow-sm ${
                          accomplishments.length > 0
                            ? 'bg-purple-50 border-purple-200 hover:bg-purple-100 hover:border-purple-400'
                            : 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'
                        }`}>
                        <span className="text-base md:text-sm">📋</span>
                        <div className="flex-1">
                          <p className="text-base md:text-xs font-semibold text-gray-800">Prepare for My Review</p>
                          <p className="text-sm md:text-[10px] text-gray-400">
                            {accomplishments.length > 0
                              ? `Turn your ${accomplishments.length} win${accomplishments.length !== 1 ? 's' : ''} into a review document`
                              : 'Log wins to unlock your review document'}
                          </p>
                        </div>
                        {accomplishments.length > 0 && (
                          <span className="text-purple-400 group-hover:text-purple-600 text-base md:text-xs transition-colors">→</span>
                        )}
                      </button>
                      <button onClick={() => router.push('/resume-coach')}
                        className="w-full flex items-center gap-2 p-2 bg-white rounded-lg hover:bg-purple-50 border border-gray-200 hover:border-purple-300 transition-colors text-left group shadow-sm">
                        <span className="text-base md:text-sm">📄</span>
                        <div className="flex-1">
                          <p className="text-base md:text-xs font-semibold text-gray-800">Resume Coach</p>
                          <p className="text-sm md:text-[10px] text-gray-400">{isPro ? 'Build, coach, and download' : 'View, format, download'}</p>
                        </div>
                        <span className="text-gray-300 group-hover:text-purple-400 text-base md:text-xs transition-colors">→</span>
                      </button>
                      <button onClick={() => setShowArchiveModal(true)}
                        className="w-full flex items-center gap-2 p-2 bg-white rounded-lg hover:bg-purple-50 border border-gray-200 hover:border-purple-300 transition-colors text-left group shadow-sm">
                        <span className="text-base md:text-sm">📁</span>
                        <div className="flex-1">
                          <p className="text-base md:text-xs font-semibold text-gray-800">View Archive</p>
                          <p className="text-sm md:text-[10px] text-gray-400">{archivedCards.length + archivedCoreResumes.length} archived items</p>
                        </div>
                        <span className="text-gray-300 group-hover:text-purple-400 text-base md:text-xs transition-colors">→</span>
                      </button>
                    </div>
                  </div>

                  {/* Upgrade CTA */}
                  <div className="bg-white rounded-lg shadow-sm border border-purple-200 p-3 pb-6">
                  {isPro ? (
                      <>
                        <h2 className="text-lg md:text-sm font-semibold text-gray-900 mb-0.5">Ready to search again?</h2>
                        <p className="text-sm md:text-xs text-gray-500 mb-1.5">Update your resume in minutes using your logged wins.</p>
                        <div className="bg-purple-50 border-l-4 border-purple-600 p-1.5 rounded-r mb-2">
                          <p className="text-sm md:text-xs text-gray-700 leading-snug">
                            You've logged <strong className="text-purple-700">{accomplishments.length} win{accomplishments.length !== 1 ? 's' : ''}</strong> in your current job. Your coach remembers all of it.
                          </p>
                        </div>
                        <button
                          onClick={() => setShowNewSearchModal(true)}
                          className="block mx-auto text-white rounded-lg py-2 px-8 text-base md:text-xs font-semibold hover:opacity-90 transition-opacity"
                          style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
                        >
                          Start new search →
                        </button>
                      </>
                    ) : (
                      <>
                        <h2 className="text-lg md:text-sm font-semibold text-gray-900 mb-0.5">Ready to job search again?</h2>
                        <p className="text-sm md:text-xs text-gray-500 mb-1.5">Upgrade to Pro and we'll coach everything you've logged into a stronger resume.</p>
                        <div className="bg-purple-50 border-l-4 border-purple-600 p-1.5 rounded-r mb-2">
                          <p className="text-sm md:text-xs text-gray-700 leading-snug">
                            You've logged <strong className="text-purple-700">{accomplishments.length} win{accomplishments.length !== 1 ? 's' : ''}</strong> in your current job. Upgrade so your coach can apply them to your resume.
                          </p>
                        </div>
                       <button
                          onClick={() => setShowUpgradeModal(true)}
                          className="w-full bg-purple-600 text-white rounded-lg py-2 text-base md:text-xs font-semibold hover:bg-purple-700 transition-colors"
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
            const { error } = await supabase.from('applications').update({ notes }).eq('id', cardId);
            if (error) {
              console.error('Save notes failed:', error);
              setErrorToast("We couldn't save your notes. Please try again.");
              throw error;
            }
            setCurrentJobEntry(prev => ({ ...prev, notes }));
          }}
          onLogWin={() => { setShowJobModal(false); setShowLogModal(true); }}
          onLinkResume={async (cardId, resumeId) => {
            const { error } = await supabase.from('applications').update({ resume_id: resumeId }).eq('id', cardId);
            if (error) {
              console.error('Link resume failed:', error);
              setErrorToast("We couldn't link your resume. Please try again.");
              return;
            }
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
          onMouseDown={(e) => { e.currentTarget.dataset.downTarget = e.target === e.currentTarget ? 'backdrop' : 'inside'; }}
          onMouseUp={(e) => { if (e.target === e.currentTarget && e.currentTarget.dataset.downTarget === 'backdrop') { setShowLogModal(false); setLogText(''); setLogDate(''); setLogError(null); } }}
        >
          <div
            className="bg-white shadow-2xl w-full max-w-lg border border-gray-200 flex flex-col"
            style={{ borderRadius: '8px' }}
            onMouseDown={e => e.stopPropagation()}
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
                                <span className="text-[10px] text-gray-400">🔒 job description saved to Vault</span>
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
            const { error } = await supabase.from('applications').update({ notes }).eq('id', cardId);
            if (error) {
              console.error('Save notes failed:', error);
              setErrorToast("We couldn't save your notes. Please try again.");
              throw error;
            }
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
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Link a job specific Resume <span className="font-normal text-gray-400">(optional)</span></label>
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
                  onChange={e => { setSetJobTitle(e.target.value); setSetJobTitleError(null); }}
                  onBlur={e => setSetJobTitleError(
                    e.target.value.length > 100 ? 'Please enter just the job title (max 100 characters).' : null
                  )}
                  placeholder="e.g. Operations Coordinator"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                {setJobTitleError && <p className="text-xs text-red-600 mt-1">{setJobTitleError}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Company *</label>
                <input
                  type="text"
                  value={setJobCompany}
                  onChange={e => { setSetJobCompany(e.target.value); setSetJobCompanyError(null); }}
                  onBlur={e => setSetJobCompanyError(
                    e.target.value.length > 100 ? 'Please enter just the company name (max 100 characters).' : null
                  )}
                  placeholder="e.g. Freeman"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                {setJobCompanyError && <p className="text-xs text-red-600 mt-1">{setJobCompanyError}</p>}
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
                disabled={setJobSaving || !setJobTitle.trim() || !setJobCompany.trim() || !!setJobTitleError || !!setJobCompanyError}
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

    {/* ── REVIEW PREP MODAL ── */}
    {showReviewPrepModal && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ backgroundColor: 'rgba(255,255,255,0.85)' }}
        onClick={() => reviewPrepStep !== 3 && setShowReviewPrepModal(false)}
      >
        {/* Steps 1 & 2 — narrow modal */}
        {(reviewPrepStep === 1 || reviewPrepStep === 2) && (
          <div
            className="bg-white shadow-2xl border border-gray-200 flex flex-col w-full"
            style={{ maxWidth: '364px', borderRadius: '8px' }}
            onClick={e => e.stopPropagation()}
          >
            <div
              style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)', borderRadius: '8px 8px 0 0' }}
              className="px-6 py-4 flex items-center justify-between flex-shrink-0"
            >
              <div className="flex items-center gap-3">
                <img src="/images/Hire_Power_icon.png" alt="Hire Power" className="h-8 w-auto flex-shrink-0" />
                <div>
                  <h2 className="text-base font-bold text-white">
                    {reviewPrepStep === 1 ? 'Confirm Your Details' : 'Set the Focus'}
                  </h2>
                  <p className="text-purple-100 text-xs">
                    {reviewPrepStep === 1 ? 'Step 1 of 2' : 'Step 2 of 2'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowReviewPrepModal(false)}
                className="text-white hover:opacity-70 text-2xl leading-none font-light"
              >×</button>
            </div>

            {reviewPrepStep === 1 && (
              <div className="p-5 space-y-3">
                <p className="text-xs text-gray-500">Pre-filled from your Vault. Edit anything that needs updating.</p>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={rpName}
                    onChange={e => setRpName(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={rpTitle}
                    onChange={e => setRpTitle(e.target.value)}
                    placeholder="e.g. Operations Coordinator"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Company</label>
                  <input
                    type="text"
                    value={rpCompany}
                    onChange={e => setRpCompany(e.target.value)}
                    placeholder="e.g. Brightfield Solutions"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Review Date</label>
                  <input
                    type="text"
                    value={rpDate}
                    onChange={e => setRpDate(e.target.value)}
                    placeholder="e.g. April 2026"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div className="flex justify-center pt-1">
                  <button
                    onClick={() => setReviewPrepStep(2)}
                    disabled={!rpName.trim() || !rpTitle.trim() || !rpCompany.trim()}
                    className="text-white rounded-lg py-2 px-8 text-xs font-semibold disabled:opacity-50 transition-opacity hover:opacity-90"
                    style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
                  >
                    Continue →
                  </button>
                </div>
              </div>
            )}

            {reviewPrepStep === 2 && (
              <div className="p-5 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Review Period</label>
                  <select
                    value={rpRange}
                    onChange={e => setRpRange(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                  >
                    <option value="3months">Last 3 months</option>
                    <option value="6months">Last 6 months</option>
                    <option value="12months">Last 12 months</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Review Focus</label>
                  <select
                    value={rpFocus}
                    onChange={e => setRpFocus(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                  >
                    <option value="standard">Standard annual review</option>
                    <option value="raise">Raise or compensation discussion</option>
                    <option value="promotion">Promotion consideration</option>
                    <option value="pip">Performance improvement plan</option>
                    <option value="other">Other / not sure</option>
                  </select>
                  <p className="text-[10px] text-gray-400 mt-1">This shapes the framing of your document, not what wins are included.</p>
                </div>
                {rpError && <p className="text-xs text-red-600">{rpError}</p>}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setReviewPrepStep(1)}
                    className="flex-1 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={handleGenerateReviewPrep}
                    disabled={rpLoading}
                    className="flex-1 text-white rounded-lg py-2 text-xs font-semibold disabled:opacity-50 transition-opacity hover:opacity-90"
                    style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
                  >
                    Generate My Document →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3 — Loading */}
        {reviewPrepStep === 3 && (
          <div className="bg-white shadow-2xl border border-gray-200 flex flex-col items-center p-10 text-center" style={{ maxWidth: '364px', borderRadius: '8px', width: '100%' }}>
            <img src="/images/Hire_Power_icon_2.png" alt="Hire Power" className="h-10 w-auto mx-auto mb-4" />
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <h3 className="font-semibold text-gray-900 mb-1">Building your narrative...</h3>
            <p className="text-xs text-gray-500">Pulling your wins and shaping them into a review document.</p>
          </div>
        )}

        {/* Step 4 — Document output */}
        {reviewPrepStep === 4 && (
          <div
            className="bg-white shadow-2xl border border-gray-200 flex flex-col w-full"
            style={{ maxWidth: '680px', borderRadius: '8px', height: '85vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)', borderRadius: '8px 8px 0 0' }}
              className="px-6 py-4 flex items-center justify-between flex-shrink-0"
            >
              <div className="flex items-center gap-3">
                <img src="/images/Hire_Power_icon.png" alt="Hire Power" className="h-7 w-auto flex-shrink-0" />
                <div>
                  <h2 className="text-base font-bold text-white">Your Review Document</h2>
                  <p className="text-purple-100 text-xs">{rpName} · {rpCompany} · {rpDate}</p>
                </div>
              </div>
              <button
                onClick={() => setShowReviewPrepModal(false)}
                className="text-white hover:opacity-70 text-2xl leading-none font-light ml-4"
              >×</button>
            </div>

            {/* Action bar */}
            <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(rpDocument)
                  setRpCopied(true)
                  setTimeout(() => setRpCopied(false), 2000)
                }}
                className="flex items-center gap-1.5 px-4 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {rpCopied ? '✓ Copied!' : '📋 Copy All'}
              </button>
             <button
                onClick={async () => {
                  setRpDownloading(true)
                  try {
                    const { data: { session } } = await supabase.auth.getSession()
                    const data = await fetchJSON('/api/generate-review-prep-pdf', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`
                      },
                      body: JSON.stringify({
                        documentText: rpDocument,
                        userId: user.id
                      })
                    })
                    if (!data.pdfUrl) {
                      throw new Error("We couldn't download your PDF. Please try again.")
                    }
                    const pdfResponse = await fetch(data.pdfUrl)
                    if (!pdfResponse.ok) {
                      throw new Error("We couldn't download your PDF. Please try again.")
                    }
                    const contentType = pdfResponse.headers.get('content-type') || ''
                    if (!contentType.includes('application/pdf')) {
                      throw new Error("We couldn't download your PDF. Please try again.")
                    }
                    const blob = await pdfResponse.blob()
                    const blobUrl = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = blobUrl
                    a.download = `${rpName.replace(/\s+/g, '_')}_Performance_Review_${rpDate.replace(/\s+/g, '_')}.pdf`
                    document.body.appendChild(a)
                    a.click()
                    document.body.removeChild(a)
                    URL.revokeObjectURL(blobUrl)
                  } catch (err) {
                    setErrorToast(err.message)
                  } finally {
                    setRpDownloading(false)
                  }
                }}
                className="flex items-center gap-1.5 px-4 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                disabled={rpDownloading}
              >
                {rpDownloading
                  ? <><div className="h-3 w-3 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div> Generating...</>
                  : '⬇️ Download PDF'
                }
              </button>
              
            </div>

            {/* Document content */}
            <div className="flex-1 overflow-y-auto px-8 py-6">
              {rpHasGap && rpGapText && !rpGapDismissed && (
                <GapWinLogger
                  gapText={rpGapText}
                  currentJobEntry={currentJobEntry}
                  supabase={supabase}
                  user={user}
                  onSaved={(newAcc) => {
                    setAccomplishments(prev => [newAcc, ...prev])
                  }}
                  onDismiss={() => setRpGapDismissed(true)}
                  onRegenerate={handleGenerateReviewPrep}
                />
              )}
              <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800 leading-relaxed">
                {rpDocument}
              </pre>
            </div>
          </div>
        )}
      </div>
    )}

    {/* Win detail modal */}
    {selectedWin && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ backgroundColor: 'rgba(255,255,255,0.85)' }}
        onClick={() => setSelectedWin(null)}
      >
        <div
          className="bg-white shadow-2xl border border-gray-200 w-full"
          style={{ maxWidth: '364px', borderRadius: '8px' }}
          onClick={e => e.stopPropagation()}
        >
          <div
            style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)', borderRadius: '8px 8px 0 0' }}
            className="px-6 py-4 flex items-center justify-between flex-shrink-0"
          >
            <div className="flex items-center gap-3">
              <img src="/images/Hire_Power_icon.png" alt="Hire Power" className="h-7 w-auto flex-shrink-0" />
              <div>
                <h2 className="text-sm font-bold text-white">Logged Win</h2>
                <p className="text-purple-100 text-xs">{selectedWin.created_at ? formatDate(selectedWin.created_at) : 'No date'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(selectedWin.raw_description)
                  setWinCopied(true)
                  setTimeout(() => setWinCopied(false), 2000)
                }}
                className="text-xs font-semibold text-white hover:opacity-70 transition-opacity"
              >
                {winCopied ? 'Copied ✓' : 'Copy'}
              </button>
              <button
                onClick={() => setSelectedWin(null)}
                className="text-white hover:opacity-70 text-2xl leading-none font-light"
              >×</button>
            </div>
          </div>
          <div className="p-5">
            <p className="text-sm text-gray-800 leading-relaxed">{selectedWin.raw_description}</p>
            <div className="flex justify-end items-center mt-5">
              <button
                onClick={async () => {
                  await handleDeleteAccomplishment(selectedWin.id)
                  setSelectedWin(null)
                }}
                className="w-7 h-7 rounded-full bg-[#fdecea] hover:bg-[#e57373] flex items-center justify-center text-[#e57373] hover:text-white transition-all"
                title="Delete"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Older wins modal */}
    {showOlderWinsModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
          <div className="px-6 py-4" style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)' }}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">All Wins</h2>
                <p className="text-purple-100 text-xs">{accomplishments.length} logged</p>
              </div>
              <button onClick={() => setShowOlderWinsModal(false)} className="text-white text-2xl leading-none font-light hover:opacity-70">×</button>
            </div>
          </div>
          <div className="px-5 py-3 border-b border-gray-100 flex justify-end">
            <button
              onClick={() => { setShowOlderWinsModal(false); handleOpenReviewPrep(); }}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-purple-300 text-purple-600 hover:bg-purple-50 transition-colors"
            >
              📋 Prepare for My Review
            </button>
          </div>
          <div className="px-6 py-4 overflow-y-auto" style={{ maxHeight: '60vh' }}>
            <div className="space-y-1.5">
              {accomplishments.map((acc) => (
                <div
                  key={acc.id}
                  onClick={() => { setShowOlderWinsModal(false); setSelectedWin(acc); setWinCopied(false); }}
                  className="flex items-start gap-2.5 p-2 bg-gray-50 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors cursor-pointer"
                  style={{ height: '52px' }}
                >
                  <div className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0 mt-1.5"></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-800 leading-snug line-clamp-2">{acc.raw_description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )}

    {/* ── RESUME LIST MODAL ── */}
    {showResumeListModal && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        onClick={() => setShowResumeListModal(false)}
      >
        <div
          className="bg-white shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col"
          style={{ borderRadius: '12px', maxHeight: '80vh' }}
          onClick={e => e.stopPropagation()}
        >
          <div
            style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)' }}
            className="px-6 py-5 relative flex-shrink-0"
          >
            <button
              onClick={() => setShowResumeListModal(false)}
              className="absolute top-3 right-4 text-white hover:opacity-70 text-2xl leading-none font-light"
            >×</button>
            <div className="flex items-center gap-3">
              <img src="/images/Hire_Power_icon.png" alt="Hire Power" className="h-8 w-auto flex-shrink-0" />
              <div>
                <h2 className="text-xl font-bold text-white">Your Resumes</h2>
                <p className="text-purple-100 text-xs">{activeResumes.length} active resume{activeResumes.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-2">
            {activeResumes.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <div className="text-4xl mb-2">📄</div>
                <p className="text-sm">No active resumes</p>
              </div>
            ) : (
              activeResumes.map((resume) => (
                <div key={resume.id} className="border border-gray-200 rounded-lg p-4 hover:border-purple-200 transition-colors">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {resume.resume_type === 'core'
                            ? (resume.display_name || 'Core Resume')
                            : (resume.display_name || `${resume.job_title || 'Untitled'}${resume.job_company ? ' at ' + resume.job_company : ''}`)
                          }
                        </p>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide" style={{
                          background: resume.resume_type === 'core' ? '#f5f3ff' : '#eff6ff',
                          borderColor: resume.resume_type === 'core' ? '#c4b5fd' : '#93c5fd',
                          color: resume.resume_type === 'core' ? '#5b21b6' : '#1e40af'
                        }}>
                          {resume.resume_type === 'core' ? 'Core' : 'Job-Specific'}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400">
                        Updated {formatDate(resume.updated_at)}{resume.current_score ? ` · Score: ${resume.current_score}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => { setShowResumeListModal(false); router.push(`/resume/${resume.id}`); }}
                        className="text-[10px] text-purple-600 font-semibold hover:text-purple-700"
                      >View</button>
                      {resume.resume_type !== 'core' && (
                        <button
                          onClick={() => setConfirmArchiveResume(resume)}
                          className="text-[10px] text-gray-500 font-semibold hover:text-gray-700"
                        >Remove & Add to Archive</button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    )}

    {/* ── ARCHIVE CONFIRMATION ── */}
    {confirmArchiveResume && (
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center p-4"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        onClick={() => archivingResumeId === null && setConfirmArchiveResume(null)}
      >
        <div
          className="bg-white shadow-2xl overflow-hidden"
          style={{ width: '364px', borderRadius: '12px' }}
          onClick={e => e.stopPropagation()}
        >
          <div
            className="px-6 py-5 relative"
            style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)' }}
          >
            <div className="flex items-center gap-3">
              <img src="/images/Hire_Power_icon.png" alt="Hire Power" className="h-8 w-auto flex-shrink-0" />
              <div>
                <h2 className="text-base font-bold text-white">Move to Archive?</h2>
                <p className="text-purple-100 text-xs">
                  {confirmArchiveResume.resume_type === 'core'
                    ? (confirmArchiveResume.display_name || 'Core Resume')
                    : `${confirmArchiveResume.job_title || 'Untitled'}${confirmArchiveResume.job_company ? ' at ' + confirmArchiveResume.job_company : ''}`
                  }
                </p>
              </div>
            </div>
          </div>
          <div className="px-6 py-5">
            <p className="text-sm text-gray-700 mb-5 leading-snug">
              {confirmArchiveResume.resume_type === 'core'
                ? 'This will move your core resume to your archive. Job-specific resumes stay where they are. You can restore or permanently delete from your archive.'
                : 'This will move this job-specific resume to your archive. You can restore or permanently delete from there.'
              }
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setConfirmArchiveResume(null)}
                disabled={archivingResumeId !== null}
                className="px-5 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleArchiveResume(confirmArchiveResume)}
                disabled={archivingResumeId !== null}
                className="px-5 py-2 rounded-lg text-xs font-bold text-white hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
                style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
              >
                {archivingResumeId !== null && <div className="h-3 w-3 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>}
                {archivingResumeId !== null ? 'Archiving...' : 'Move to Archive'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* ── DELETE CONFIRMATION ── */}
    {confirmDelete && (
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center p-4"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        onClick={() => setConfirmDelete(null)}
      >
        <div
          className="bg-white shadow-2xl overflow-hidden"
          style={{ width: '364px', borderRadius: '12px' }}
          onClick={e => e.stopPropagation()}
        >
          <div
            className="px-6 py-5 relative"
            style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)' }}
          >
            <div className="flex items-center gap-3">
              <img src="/images/Hire_Power_icon.png" alt="Hire Power" className="h-8 w-auto flex-shrink-0" />
              <div>
                <h2 className="text-base font-bold text-white">Delete permanently?</h2>
                <p className="text-purple-100 text-xs">This cannot be undone.</p>
              </div>
            </div>
          </div>
          <div className="px-6 py-5">
            <p className="text-sm text-gray-600 mb-5 leading-snug">
              This will permanently remove this {confirmDelete.type === 'core' ? 'resume' : 'job card'} from your archive.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-5 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleHardDelete}
                disabled={archiveActionLoading}
                className="px-5 py-2 rounded-lg text-xs font-bold text-white hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
                style={{ background: '#e57373' }}
              >
                {archiveActionLoading && <div className="h-3 w-3 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>}
                {archiveActionLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
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
                  className="text-xs text-purple-600 hover:text-purple-700 font-medium bg-transparent border-none cursor-pointer p-0 text-center block w-full"
                >
                  Just want to view or download your resume? <br/>Go to Resume Coach →
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