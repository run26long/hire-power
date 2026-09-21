'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import MainNav from '../components/MainNav';
import AppShell from '../components/AppShell';
import JobCardModal from '../components/JobCardModal';
import ErrorToast from '../components/ErrorToast';
import SuccessToast from '../components/SuccessToast';
import VaultUpgradeModal from '../components/VaultUpgradeModal';
import UpgradeModal from '../components/UpgradeModal';
import { fetchJSON } from '@/lib/fetchJSON';
import { coreResumeLabel } from '@/lib/resumeLabel';
import { canLogWins, canUseReviewPrep } from '@/lib/tiers';

// ---- LOGGING A WIN ----
// Through the route rather than straight into the table. The insert used to
// go from here to Supabase with the user's own client, which left nowhere to
// ask what plan the account was on - a disabled button is not a gate. The
// route answers that, and hands back the row the list renders.
//
// UPGRADE_REQUIRED comes back as a value rather than a throw, because the
// caller shows an upgrade prompt for it and an error message for everything
// else, and those are two different things to do.
async function logWin(supabase, { description, applicationId, occurredAt }) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch('/api/career-vault/win', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify({ description, applicationId: applicationId || null, occurredAt: occurredAt || null }),
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 403) return { upgrade: true };
  if (!res.ok) return { error: body?.error || 'Something went wrong. Please try again.' };
  return { achievement: body.achievement };
}

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
      const result = await logWin(supabase, {
        description: text.trim(),
        applicationId: currentJobEntry?.id || null,
      })
      if (result.upgrade) {
        setError('Logging wins is part of Vault and Pro.')
        return
      }
      if (result.error) {
        setError(result.error)
        return
      }
      onSaved(result.achievement)
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
  const [tier, setTier] = useState('free');
  // handleOpenReviewPrep is defined above the render body and is handed to
  // modals that outlive a render, so it reads the tier through a ref rather
  // than closing over whatever it was at definition.
  const tierRef = useRef('free');

  // Accomplishments
  const [accomplishments, setAccomplishments] = useState([]);
  const [showLogModal, setShowLogModal] = useState(false);
  // What the Vault prompt is currently explaining, or null. One piece of
  // state rather than one flag per locked control, so two of them can never
  // be open at once.
  const [vaultPrompt, setVaultPrompt] = useState(null);
  const [logText, setLogText] = useState('');
  const [logDate, setLogDate] = useState('');
  const [logSaving, setLogSaving] = useState(false);
  const [logError, setLogError] = useState(null);

  // Archive modal
 const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [resumeCount, setResumeCount] = useState(0);
  const [activeResumes, setActiveResumes] = useState([]);
  // What this account's cores are called, read the same way the hub and the
  // resume page read it so one resume does not carry two names across screens.
  const [namingLenses, setNamingLenses] = useState([]);
  const [currentLensName, setCurrentLensName] = useState(null);
  const [activeCoreCount, setActiveCoreCount] = useState(null);
  const [showResumeListModal, setShowResumeListModal] = useState(false);
  const [confirmArchiveResume, setConfirmArchiveResume] = useState(null);
  const [archivingResumeId, setArchivingResumeId] = useState(null);
  const [showNewSearchModal, setShowNewSearchModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Review Prep
  // What the Vault knows, counted by the summary endpoint. 'loading' until
  // it answers and 'failed' if it does not: a scorecard that says zero when
  // the request fell over is a lie about somebody's career, so the numbers
  // are simply absent instead.
  const [summary, setSummary] = useState(null)
  const [summaryState, setSummaryState] = useState('loading')
  // What was waiting when this visit began. Held here because opening the
  // page sets the stored count back to zero: by the time the summary answers
  // it has nothing left to report, and the scorecard would say "+0" about a
  // visit that had four new things in it.
  const [arrivedSinceLastVisit, setArrivedSinceLastVisit] = useState(0)

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
  const [successToast, setSuccessToast] = useState(null);

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
        setTier(profile?.subscription_tier || 'free');
        tierRef.current = profile?.subscription_tier || 'free';

        // What landed while they were somewhere else. Said once, in their
        // own words - "items", not "knowledge entries" - and then the count
        // goes back to zero, which is what makes the badge in the nav
        // disappear. Local state is cleared too, so the badge goes on this
        // render rather than on the next load.
        const unseen = Number(profile?.unseen_vault_count) || 0;
        setArrivedSinceLastVisit(unseen);
        if (unseen > 0) {
          setSuccessToast(
            unseen === 1
              ? '1 new item added to your Career Vault'
              : `${unseen} new items added to your Career Vault`
          );
          setUserProfile({ ...profile, unseen_vault_count: 0 });
          const { error: clearError } = await supabase
            .from('profiles')
            .update({ unseen_vault_count: 0 })
            .eq('id', user.id);
          if (clearError) {
            // Not worth stopping the page for: they have seen the number, and
            // the worst case is seeing it again next time.
            console.error('Career vault count reset failed (non-fatal):', clearError);
          }
        }

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

        // What to call the cores. The lens rows name them, career_context is the
        // fallback for an account with no profile yet, and the count of active
        // cores decides whether the account's direction can mean one particular
        // document. Failing here costs the direction in the name and nothing
        // else, so it is read alongside rather than guarded against.
        const [{ data: lensRows }, { data: contextRow }] = await Promise.all([
          supabase
            .from('profile_lenses')
            .select('name, source, sort_order, status, core_resume_id')
            .eq('user_id', user.id),
          supabase
            .from('career_context')
            .select('current_lens_name')
            .eq('user_id', user.id)
            .maybeSingle()
        ]);
        setNamingLenses(lensRows || []);
        setCurrentLensName(contextRow?.current_lens_name || null);
        setActiveCoreCount(sortedResumes.filter(r => r.resume_type === 'core').length);

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

        // The scorecard's own read. Deliberately after everything above and
        // deliberately swallowed: the Vault has to render whether or not the
        // summary answers.
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const counted = await fetchJSON('/api/career-vault/summary', {
            headers: { Authorization: `Bearer ${session?.access_token}` },
          });
          setSummary(counted);
          setSummaryState('ready');
        } catch (summaryError) {
          console.error('Career vault summary failed (non-fatal):', summaryError);
          setSummaryState('failed');
        }

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
    if (!canUseReviewPrep(tierRef.current)) {
      setVaultPrompt({
        title: 'Walk into your review with the receipts.',
        message: 'Review Prep turns the wins in your Vault into a document you can take into a performance review. It is part of Vault.',
      });
      return;
    }
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
      const result = await logWin(supabase, {
        description: logText.trim(),
        applicationId: currentJobEntry?.id || null,
        occurredAt: logDate || null,
      });
      // The route refused. The modal should not have opened - openLogWin
      // checks the same thing - so this is the case where the plan changed
      // under an open tab. Swap the modal for the explanation rather than
      // leaving a dead Save button behind.
      if (result.upgrade) {
        setLogSaving(false);
        setShowLogModal(false);
        setVaultPrompt({
          title: 'Log wins as they happen.',
          message: 'Your Vault keeps every promotion, project and metric you add, and writes them into your next resume. Adding to it is part of Vault.',
        });
        return;
      }
      if (result.error) {
        setLogError(result.error);
        return;
      }
      setAccomplishments(prev => [result.achievement, ...prev]);
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
  // Logging a win and preparing for a review are the two things the Vault
  // does rather than shows. A free account sees everything already in here
  // and is offered the plan when it tries to add to it.
  const mayLogWins = canLogWins(tier);
  const mayPrepReview = canUseReviewPrep(tier);
  const openLogWin = () => {
    if (!mayLogWins) {
      setVaultPrompt({
        title: 'Log wins as they happen.',
        message: 'Your Vault keeps every promotion, project and metric you add, and writes them into your next resume. Adding to it is part of Vault.',
      });
      return;
    }
    setShowLogModal(true);
  };
  const firstName = userProfile?.first_name || userProfile?.display_name?.split(' ')[0] || '';
  // ---- WHAT THE SCORECARD READS ------------------------------------------
  //
  // All of it out of /api/career-vault/summary. Nothing here counts anything
  // itself: the endpoint owns the arithmetic, and this turns its numbers into
  // labels, widths and colours. A missing block resolves to zero rather than
  // to a crash, because a summary that lost one query still has the rest.

  const knowledgeTotal = summary?.knowledge?.total ?? 0;
  // The page's own reading first; the endpoint's is the fallback for a
  // render where the profile has not been read yet.
  const sinceLastVisit = arrivedSinceLastVisit || (summary?.knowledge?.sinceLastVisit ?? 0);

  // The eight kinds the extractor writes, in the order the bar should read:
  // most of the vault first. Only the kinds that exist are drawn, so an
  // account with three kinds of detail gets three segments and three labels.
  const TYPE_LABEL = {
    experience: 'Experience',
    skill: 'Skills',
    achievement: 'Achievements',
    tool: 'Tools',
    methodology: 'Methods',
    credential: 'Credentials',
    industry: 'Industry',
    relationship: 'People',
  };
  // One violet ramp rather than eight hues, laid on in rank order so the
  // ribbon reads darkest-first: the kind there is most of leads it.
  const TYPE_RAMP = ['#6d28d9', '#8b5cf6', '#a78bfa', '#bda9f7', '#cfc1fa', '#ded3fc', '#e9e1fd', '#f1ebff'];
  const knowledgeSegments = Object.entries(summary?.knowledge?.byType || {})
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count], rank) => ({
      type,
      color: TYPE_RAMP[Math.min(rank, TYPE_RAMP.length - 1)],
      count,
      label: TYPE_LABEL[type] || type,
      share: knowledgeTotal > 0 ? (count / knowledgeTotal) * 100 : 0,
    }));

  const SOURCE_LABEL = {
    conversation: 'coaching',
    uploaded_resume: 'your résumés',
    interview_practice: 'interview practice',
  };
  const builtFrom = Object.entries(summary?.knowledge?.bySource || {})
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([source, count]) => ({ count, label: SOURCE_LABEL[source] || source }));

  // Four cards, each one a thing the account has done rather than a thing it
  // is holding. The note under each says what the number is worth.
  const proofTotal = (summary?.evidence?.total ?? 0) + (summary?.testimonials?.total ?? 0);
  const intelligenceCards = [
    {
      label: 'Coaching completed',
      value: summary?.coaching?.total ?? 0,
      note: (summary?.coaching?.total ?? 0) > 0
        ? 'Conversations your résumés are written from'
        : 'Your first session teaches it the most',
    },
    {
      label: 'Interview practice',
      value: summary?.interviews?.completed ?? 0,
      note: summary?.interviews?.averageScore != null
        ? `Averaging ${summary.interviews.averageScore} readiness`
        : 'Sessions finished and scored',
    },
    {
      label: 'Résumés created',
      value: summary?.resumes?.total ?? 0,
      note: (summary?.resumes?.core ?? 0) > 0
        ? `${summary.resumes.core} core · ${summary?.resumes?.jobSpecific ?? 0} job-specific`
        : 'Core and job-specific versions',
    },
    {
      label: 'Proof collected',
      value: proofTotal,
      note: proofTotal > 0
        ? `${summary?.evidence?.total ?? 0} piece${(summary?.evidence?.total ?? 0) === 1 ? '' : 's'} of evidence · ${summary?.testimonials?.total ?? 0} testimonial${(summary?.testimonials?.total ?? 0) === 1 ? '' : 's'}`
        : 'Evidence and testimonials on your profile',
    },
  ];

  const careerHistory = Array.isArray(summary?.careerHistory) ? summary.careerHistory : [];

  // The four ways in, all of them somewhere that already exists: the win
  // modal on this page, and the Career Profile, which is where proof and
  // testimonials are added.
  const growthActions = [
    {
      icon: '🏆',
      title: 'Log a win',
      desc: 'Capture projects, promotions, metrics, recognition, and new skills while they’re fresh.',
      onClick: () => openLogWin(),
    },
    {
      icon: '📇',
      title: 'Build your Career Profile',
      desc: 'Add the story, proof, and context that do not fit on a résumé.',
      onClick: () => router.push('/career-profile'),
    },
    {
      icon: '💬',
      title: 'Collect testimonials',
      desc: 'Ask people who know your work to add perspective and credibility.',
      onClick: () => router.push('/career-profile'),
    },
    {
      icon: '📎',
      title: 'Add evidence',
      desc: 'Upload work samples, certifications, presentations, awards, and other proof.',
      onClick: () => router.push('/career-profile'),
    },
  ];



  return (
    <AppShell sidebar={<>

      {/* Left Sidebar */}
      
        <div className="px-6 pt-6 pb-4 flex-shrink-0">
          <h1 className="text-[28px] font-bold mb-1.5 whitespace-nowrap tracking-tight">Career Vault</h1>
          <p className="text-sm text-white text-opacity-95 leading-tight tracking-tight mb-0.5">
            Job hunting is small talk.
          </p>
          <p className="text-sm text-white text-opacity-95 leading-tight tracking-tight">
            Your career deserves a conversation.
          </p>
          <div className="mt-4 border-b border-gray-400 border-opacity-10"></div>
          </div>

        <div className="px-6 pt-0 pb-6 flex-1 flex flex-col">

          {/* Steps */}
          <div style={{ marginBottom: 16 }}>
            {[
              {
                num: '1',
                title: 'Hire Power remembers for you',
                desc: 'Coaching, interviews, résumés, testimonials, and evidence all add to your Vault.',
              },
              {
                num: '2',
                title: 'See what’s building',
                desc: 'Your Vault shows the experience, skills, proof, and stories Hire Power has learned about you.',
              },
              {
                num: '3',
                title: 'Log wins as they happen',
                desc: 'Add projects, promotions, metrics, skills, and accomplishments while they’re fresh.',
              },
              {
                num: '4',
                title: 'Build the bigger picture',
                desc: 'Add evidence, collect testimonials, and expand your Career Profile beyond the résumé.',
              },
              {
                num: '5',
                title: 'Use it when it matters',
                desc: 'Everything in your Vault makes future résumés, interviews, reviews, and negotiations easier.',
              },
              {
                num: '6',
                title: 'Never start from scratch again',
                desc: 'When your next opportunity comes, your career story is already waiting.',
              },
            ].map(({ num, title, desc }) => (
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
                </div>
              </div>
            ))}
          </div>


          {/* Bottom section */}
          <div className="mt-auto mb-4">
            <div className="border-b border-gray-400 border-opacity-10" style={{ marginBottom: 14 }}></div>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#fff', lineHeight: 1.3, marginBottom: 4 }}>
              Three years from now?
            </p>
            <p style={{ fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4, marginBottom: 0 }}>
              You won't remember today's achievements. But Hire Power will.
            </p>
          </div>

        </div>
      </>}>

      {/* Main Content */}
      <AppShell.Main>
        <MainNav currentPage="career-vault" userProfile={userProfile} />

        <div className="flex-1 overflow-y-auto">
          <div className="px-6 lg:px-8 py-5 max-w-[1400px] mx-auto w-full">

            {/* ================================================================
                TWO COLUMNS
                The left is the story the Vault tells — what it holds, where it
                came from, and the wins only the owner can add. The right is the
                instrument panel beside it: counts, the ways to add more, and
                the things the Vault can hand back. They stack on a phone in
                that same order.
                ================================================================ */}
            <div className="grid grid-cols-1 lg:grid-cols-[64fr_36fr] gap-5 items-start">

              {/* ============================ LEFT ============================ */}
              <div className="min-w-0 flex flex-col gap-5">

                {/* ---- Career memory ----
                    The centrepiece, set the way the light Career Profile sets
                    its cover: an oversized numeral against white, a pale
                    lavender atmosphere rather than a fill, thin rules instead
                    of boxes, and nothing scored out of a maximum, because
                    there is no such thing as a complete career. */}
                <section
                  className="relative overflow-hidden bg-white rounded-2xl border border-[#ece9f6]"
                  style={{ boxShadow: '0 1px 2px rgba(23,16,48,0.04), 0 18px 40px -28px rgba(76,49,150,0.28)' }}
                >
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background:
                        'radial-gradient(115% 85% at 86% -22%, rgba(124,58,237,0.10), rgba(124,58,237,0) 62%),' +
                        'radial-gradient(85% 70% at -8% 118%, rgba(99,102,241,0.06), rgba(99,102,241,0) 58%)',
                    }}
                  />

                  <div className="relative px-6 sm:px-9 pt-7 pb-7">
                    <div className="flex items-center justify-between gap-3">
                      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#7c3aed' }}>
                        Career memory
                      </p>
                      <span className="md:hidden text-xs font-semibold px-2 py-0.5 rounded-md whitespace-nowrap" style={{ backgroundColor: 'rgba(147, 51, 234, 0.08)', color: '#7e22ce' }}>Career Vault</span>
                    </div>

                    {/* Headline left, figure right: the composition is deliberately
                        off-centre, and the figure is the thing the eye lands on. */}
                    <div className="flex items-start justify-between gap-6 flex-wrap" style={{ marginTop: 18 }}>
                      <div className="min-w-0" style={{ flex: '1 1 320px' }}>
                        <h1 style={{ fontSize: 'clamp(30px, 3.1vw, 44px)', fontWeight: 650, lineHeight: 1.02, letterSpacing: '-0.035em', color: '#17132a' }}>
                          Your career, remembered.
                        </h1>
                        <p style={{ marginTop: 14, fontSize: 15, lineHeight: 1.55, color: '#5f5a72', maxWidth: '46ch' }}>
                          Hire Power has been paying attention. Everything it learns about you makes the next résumé, interview, and job search easier.
                        </p>
                      </div>

                      <div className="flex-shrink-0 text-right" style={{ minWidth: 150 }}>
                        {summaryState === 'ready' ? (
                          <>
                            <p style={{ fontSize: 'clamp(62px, 7.2vw, 104px)', fontWeight: 650, lineHeight: 0.82, letterSpacing: '-0.055em', color: '#17132a', fontVariantNumeric: 'tabular-nums' }}>
                              {knowledgeTotal}
                            </p>
                            <p style={{ marginTop: 13, fontSize: 11, fontWeight: 700, letterSpacing: '0.17em', textTransform: 'uppercase', color: '#8b849c' }}>
                              career detail{knowledgeTotal === 1 ? '' : 's'} saved
                            </p>
                            {sinceLastVisit > 0 && (
                              <p style={{ marginTop: 9, fontSize: 13, fontWeight: 600, color: '#7c3aed' }}>
                                +{sinceLastVisit} since your last visit
                              </p>
                            )}
                          </>
                        ) : (
                          <p style={{ fontSize: 'clamp(62px, 7.2vw, 104px)', fontWeight: 650, lineHeight: 0.82, letterSpacing: '-0.055em', color: '#ece9f6' }}>
                            &mdash;
                          </p>
                        )}
                      </div>
                    </div>

                    {/* The ribbon: one sliver per kind of detail, widths as shares
                        of what is there. A single violet ramp, darkest first, so
                        it reads as one measure rather than as a chart. */}
                    {summaryState === 'ready' && knowledgeTotal > 0 && (
                      <div style={{ marginTop: 32 }}>
                        <div aria-hidden="true" style={{ height: 1, background: '#f0edf9' }} />
                        <div className="flex w-full" style={{ gap: 4, marginTop: 22 }}>
                          {knowledgeSegments.map(seg => (
                            <div
                              key={seg.type}
                              title={`${seg.label}: ${seg.count}`}
                              style={{ width: `${seg.share}%`, height: 6, borderRadius: 3, background: seg.color }}
                            />
                          ))}
                        </div>
                        <div className="flex flex-wrap" style={{ gap: '8px 24px', marginTop: 16 }}>
                          {knowledgeSegments.map(seg => (
                            <div key={seg.type} className="flex items-center" style={{ gap: 7 }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: seg.color, flexShrink: 0 }} />
                              <span style={{ fontSize: 13, color: '#6b6580' }}>{seg.label}</span>
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#17132a', fontVariantNumeric: 'tabular-nums' }}>{seg.count}</span>
                            </div>
                          ))}
                        </div>
                        {builtFrom.length > 0 && (
                          <p style={{ marginTop: 18, fontSize: 12, color: '#a09aae' }}>
                            Built from {builtFrom.map(s => `${s.count} from ${s.label}`).join('  ·  ')}
                          </p>
                        )}
                      </div>
                    )}

                    {summaryState === 'ready' && knowledgeTotal === 0 && (
                      <p style={{ marginTop: 28, fontSize: 14, color: '#8b849c' }}>
                        Nothing saved yet. Your first coaching session, practice interview or logged win starts it off.
                      </p>
                    )}
                    {summaryState === 'loading' && (
                      <p style={{ marginTop: 28, fontSize: 14, color: '#a09aae' }}>Counting what it knows&hellip;</p>
                    )}
                    {summaryState === 'failed' && (
                      <p style={{ marginTop: 28, fontSize: 14, color: '#a09aae' }}>
                        We couldn&apos;t count your Vault just now. Everything in it is still there — refresh to try again.
                      </p>
                    )}
                  </div>
                </section>

                {/* ---- Where it all came from ---- */}
                {careerHistory.length > 0 && (
                  <section className="bg-white rounded-2xl border border-[#ece9f6] px-6 sm:px-9 py-7" style={{ boxShadow: '0 1px 2px rgba(23,16,48,0.04)' }}>
                    <div className="flex items-baseline gap-3 flex-wrap">
                      <h2 style={{ fontSize: 20, fontWeight: 650, letterSpacing: '-0.02em', color: '#17132a' }}>Career History</h2>
                      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#a09aae' }}>
                        {careerHistory.length} role{careerHistory.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    <p style={{ marginTop: 6, fontSize: 14, lineHeight: 1.5, color: '#6b6580' }}>
                      The roles your saved details came from, most recent first.
                    </p>

                    <div style={{ marginTop: 24, position: 'relative', paddingLeft: 22 }}>
                      <div aria-hidden="true" style={{ position: 'absolute', left: 3, top: 7, bottom: 7, width: 1, background: 'linear-gradient(180deg, #e2dbf6, #f3effc)' }} />
                      {careerHistory.map((role, index) => (
                        <div
                          key={`${role.title}-${role.company}-${index}`}
                          style={{ position: 'relative', paddingBottom: index === careerHistory.length - 1 ? 0 : 20 }}
                        >
                          <span aria-hidden="true" style={{ position: 'absolute', left: -22, top: 5, width: 7, height: 7, borderRadius: '50%', background: '#a78bfa', boxShadow: '0 0 0 3px #fff' }} />
                          <div className="flex items-baseline justify-between gap-4">
                            <div className="min-w-0">
                              <p style={{ fontSize: 15, fontWeight: 650, color: '#17132a', lineHeight: 1.3 }}>{role.title || 'Role not named'}</p>
                              {role.company && <p style={{ marginTop: 2, fontSize: 13.5, color: '#7d7690' }}>{role.company}</p>}
                            </div>
                            <span style={{ fontSize: 12.5, color: '#a09aae', flexShrink: 0, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                              {role.entries} detail{role.entries === 1 ? '' : 's'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* ---- The wins themselves, which are the part only they can add ---- */}
                <section className="bg-white rounded-2xl border border-[#ece9f6] px-6 sm:px-9 py-7" style={{ boxShadow: '0 1px 2px rgba(23,16,48,0.04)' }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-3 flex-wrap">
                        <h2 style={{ fontSize: 20, fontWeight: 650, letterSpacing: '-0.02em', color: '#17132a' }}>Accomplishments</h2>
                        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#a09aae' }}>
                          {accomplishments.length} logged
                        </span>
                      </div>
                      <p style={{ marginTop: 6, fontSize: 14, lineHeight: 1.5, color: '#6b6580' }}>
                        Log wins as they happen: promotions, projects, metrics, skills, anything worth remembering.
                      </p>
                    </div>
                    {/* Locked rather than hidden. A free account should be
                        able to see that its Vault takes wins; what it cannot
                        do is add one, and the click says why. */}
                    <button
                      onClick={() => openLogWin()}
                      title={mayLogWins ? undefined : 'Logging wins is part of Vault'}
                      className={`text-sm font-semibold px-3 py-1.5 rounded-lg border transition-colors whitespace-nowrap flex-shrink-0 ${
                        mayLogWins
                          ? 'border-purple-300 text-purple-600 hover:bg-purple-50'
                          : 'border-gray-200 text-gray-400 hover:bg-gray-50'
                      }`}
                    >
                      {mayLogWins ? '+ Log a Win' : '🔒 Log a Win'}
                    </button>
                  </div>

                  {accomplishments.length > 0 ? (
                    <div className="space-y-1" style={{ marginTop: 18 }}>
                      {accomplishments.slice(0, 4).map((acc) => (
                        <div
                          key={acc.id}
                          onClick={() => { setSelectedWin(acc); setWinCopied(false); }}
                          className="flex items-start gap-2.5 p-2 bg-gray-50 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors cursor-pointer"
                          style={{ minHeight: '52px' }}
                        >
                          <div className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0 mt-1.5"></div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-800 leading-snug line-clamp-2">{acc.raw_description}</p>
                          </div>
                        </div>
                      ))}
                      {accomplishments.length > 4 && (
                        <button
                          onClick={() => setShowOlderWinsModal(true)}
                          className="w-full text-center pt-4 text-sm text-purple-600 hover:text-purple-700 font-medium transition-colors"
                        >
                          See {accomplishments.length - 4} more win{accomplishments.length - 4 > 1 ? 's' : ''} →
                        </button>
                      )}
                    </div>
                  ) : (
                    /* Not a blank container with a dashed edge round it. A thin
                       rule, a small mark, and a sentence that says what goes
                       here — the same furniture as a filled section. */
                    <div style={{ marginTop: 22, borderTop: '1px solid #f0edf9', paddingTop: 22 }}>
                      <div className="flex items-start gap-4">
                        <span
                          aria-hidden="true"
                          className="flex items-center justify-center flex-shrink-0"
                          style={{ width: 38, height: 38, borderRadius: '50%', fontSize: 16, background: 'linear-gradient(180deg, #faf8ff, #f4f0fd)', border: '1px solid #ebe5fb' }}
                        >
                          🏆
                        </span>
                        <div className="min-w-0">
                          {!currentJobEntry ? (
                            <>
                              <p style={{ fontSize: 15, fontWeight: 650, color: '#17132a' }}>No current job set</p>
                              <p style={{ marginTop: 4, fontSize: 14, lineHeight: 1.5, color: '#6b6580', maxWidth: '54ch' }}>
                                Mark a job as Hired and wins you log will attach to that role automatically.
                              </p>
                            </>
                          ) : (
                            <>
                              <p style={{ fontSize: 15, fontWeight: 650, color: '#17132a' }}>Nothing logged yet</p>
                              <p style={{ marginTop: 4, fontSize: 14, lineHeight: 1.5, color: '#6b6580', maxWidth: '54ch' }}>
                                The next time something good happens, log it here. Takes 30 seconds. Saves hours later.
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </section>
              </div>

              {/* ============================ RIGHT ============================ */}
              <div className="min-w-0 flex flex-col gap-4">

                {/* ---- What the knowing adds up to ----
                    Four figures in one card rather than four cards, because
                    they are one reading. Thin rules between them, no boxes. */}
                <section className="bg-white rounded-xl border border-[#ece9f6] overflow-hidden" style={{ boxShadow: '0 1px 2px rgba(23,16,48,0.04)' }}>
                  <div className="px-5 pt-4 pb-3">
                    <h2 style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: '-0.005em', color: '#17132a' }}>
                      What&rsquo;s building in your Vault
                    </h2>
                  </div>
                  <div className="grid grid-cols-2" style={{ borderTop: '1px solid #f0edf9' }}>
                    {intelligenceCards.map((card, i) => (
                      <div
                        key={card.label}
                        className="px-5 py-4"
                        style={{
                          borderRight: i % 2 === 0 ? '1px solid #f0edf9' : undefined,
                          borderBottom: i < 2 ? '1px solid #f0edf9' : undefined,
                        }}
                      >
                        <p style={{ fontSize: 30, fontWeight: 650, lineHeight: 1, letterSpacing: '-0.035em', color: '#17132a', fontVariantNumeric: 'tabular-nums' }}>
                          {card.value}
                        </p>
                        <p style={{ marginTop: 8, fontSize: 12.5, fontWeight: 650, lineHeight: 1.25, color: '#453f55' }}>{card.label}</p>
                        {card.note && (
                          <p style={{ marginTop: 4, fontSize: 12, lineHeight: 1.35, color: '#9a94a8' }}>{card.note}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>

                {/* ================================================================
                    KEEP IT GROWING
                    The current job anchors it, because a win belongs to a role,
                    and the four ways in are the ones that already exist.
                    ================================================================ */}
                <section className="bg-white rounded-xl border border-[#ece9f6] p-5" style={{ boxShadow: '0 1px 2px rgba(23,16,48,0.04)' }}>
                  <h2 style={{ fontSize: 16, fontWeight: 650, letterSpacing: '-0.015em', color: '#17132a' }}>Keep it growing.</h2>
                  <p style={{ marginTop: 5, fontSize: 13, lineHeight: 1.45, color: '#6b6580' }}>
                    Your Vault gets stronger every time you add a win, a voice, or a piece of proof.
                  </p>

                  {/* The role everything new attaches to. */}
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
                    const meta = [sinceStr ? `Since ${sinceStr}` : '', tenureStr && tenureStr !== 'Just started' ? `${tenureStr} in role` : '']
                      .filter(Boolean).join(' · ');
                    return (
                      <button
                        onClick={() => setShowJobModal(true)}
                        className="w-full text-left group flex items-center gap-3 transition-colors hover:border-[#ddd2fa]"
                        style={{ marginTop: 14, padding: '10px 12px', borderRadius: 10, background: 'linear-gradient(180deg, #faf8ff, #f6f2fe)', border: '1px solid #ece5fc' }}
                      >
                        <span
                          aria-hidden="true"
                          className="flex items-center justify-center flex-shrink-0"
                          style={{ width: 32, height: 32, borderRadius: '50%', background: '#fff', border: '1px solid #e7dffb', fontSize: 15 }}
                        >
                          🏆
                        </span>
                        <span className="flex-1 min-w-0 block">
                          <span className="block" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7c3aed' }}>
                            Current job
                          </span>
                          <span className="block truncate" style={{ fontSize: 13.5, fontWeight: 700, color: '#17132a', marginTop: 1 }}>{currentJobEntry.title}</span>
                          <span className="block truncate" style={{ fontSize: 12.5, color: '#7d7690' }}>{currentJobEntry.company}</span>
                          {meta && (
                            <span className="block truncate" style={{ marginTop: 2, fontSize: 11.5, color: '#a09aae' }}>{meta}</span>
                          )}
                        </span>
                        <span className="flex-shrink-0 text-[#c9c2dc] group-hover:text-[#8b5cf6] transition-colors" style={{ fontSize: 13 }}>→</span>
                      </button>
                    );
                  })() : (
                    <div style={{ marginTop: 14, padding: '12px', borderRadius: 10, background: '#faf9fc', border: '1px solid #f0edf9' }}>
                      <p style={{ fontSize: 13, lineHeight: 1.45, color: '#6b6580' }}>
                        No current job set. Mark a job card as Hired and it appears here automatically.
                      </p>
                      <button
                        onClick={() => setShowSetJobModal(true)}
                        className="font-semibold text-purple-600 hover:text-purple-700 transition-colors"
                        style={{ marginTop: 8, fontSize: 13 }}
                      >
                        Set current job manually →
                      </button>
                    </div>
                  )}

                  <div style={{ marginTop: 14 }}>
                    {growthActions.map((action, i) => (
                      <button
                        key={action.title}
                        onClick={action.onClick}
                        className="w-full text-left group flex items-start gap-3 transition-colors hover:bg-[#faf8ff]"
                        style={{ padding: '11px 8px', borderTop: i === 0 ? undefined : '1px solid #f3f0fa', borderRadius: 8 }}
                      >
                        <span aria-hidden="true" className="flex-shrink-0" style={{ fontSize: 14, marginTop: 1 }}>{action.icon}</span>
                        <span className="flex-1 min-w-0 block">
                          <span className="block" style={{ fontSize: 13.5, fontWeight: 650, color: '#221d33' }}>{action.title}</span>
                          <span className="block" style={{ marginTop: 2, fontSize: 12.5, lineHeight: 1.4, color: '#837c96' }}>{action.desc}</span>
                        </span>
                        <span className="flex-shrink-0 text-[#cdc6de] group-hover:text-[#8b5cf6] transition-colors" style={{ fontSize: 13, marginTop: 2 }}>→</span>
                      </button>
                    ))}
                  </div>
                </section>

                {/* ---- What the Vault can hand back ---- */}
                <section className="bg-white rounded-xl border border-[#ece9f6] px-5 py-2" style={{ boxShadow: '0 1px 2px rgba(23,16,48,0.04)' }}>
                  {/* Two different reasons this can be unavailable, and they
                      are not the same sentence. With no wins there is nothing
                      to make a document out of; on a free plan there is, and
                      the plan is what unlocks it - so that one stays clickable
                      and explains itself. */}
                  <button
                    onClick={accomplishments.length > 0 ? handleOpenReviewPrep : undefined}
                    disabled={accomplishments.length === 0}
                    className={`w-full text-left group flex items-start gap-3 transition-colors rounded-lg ${
                      accomplishments.length > 0 ? 'hover:bg-[#faf8ff]' : 'opacity-60 cursor-not-allowed'
                    }`}
                    style={{ padding: '11px 6px' }}
                  >
                    <span aria-hidden="true" className="flex-shrink-0" style={{ fontSize: 14, marginTop: 1 }}>
                      {mayPrepReview ? '📋' : '🔒'}
                    </span>
                    <span className="flex-1 min-w-0 block">
                      <span className="block" style={{ fontSize: 13.5, fontWeight: 650, color: '#221d33' }}>Prepare for My Review</span>
                      <span className="block" style={{ marginTop: 2, fontSize: 12.5, lineHeight: 1.4, color: '#837c96' }}>
                        {accomplishments.length === 0
                          ? 'Log wins to unlock your review document'
                          : mayPrepReview
                          ? `Turn your ${accomplishments.length} win${accomplishments.length !== 1 ? 's' : ''} into a review document`
                          : 'Part of Vault — turn your wins into a review document'}
                      </span>
                    </span>
                    {accomplishments.length > 0 && (
                      <span className="flex-shrink-0 text-[#cdc6de] group-hover:text-[#8b5cf6] transition-colors" style={{ fontSize: 13, marginTop: 2 }}>→</span>
                    )}
                  </button>

                  <button
                    onClick={() => resumeCount > 0 ? setShowResumeListModal(true) : router.push('/resume-coach')}
                    className="w-full text-left group flex items-start gap-3 transition-colors hover:bg-[#faf8ff] rounded-lg"
                    style={{ padding: '11px 6px', borderTop: '1px solid #f3f0fa' }}
                  >
                    <span aria-hidden="true" className="flex-shrink-0" style={{ fontSize: 14, marginTop: 1 }}>📄</span>
                    <span className="flex-1 min-w-0 block">
                      <span className="block" style={{ fontSize: 13.5, fontWeight: 650, color: '#221d33' }}>Your résumés</span>
                      <span className="block" style={{ marginTop: 2, fontSize: 12.5, lineHeight: 1.4, color: '#837c96' }}>
                        {resumeCount > 0
                          ? `${resumeCount} saved and ready to reuse`
                          : (isPro ? 'Build, coach, and download' : 'View, format, download')}
                      </span>
                    </span>
                    <span className="flex-shrink-0 text-[#cdc6de] group-hover:text-[#8b5cf6] transition-colors" style={{ fontSize: 13, marginTop: 2 }}>→</span>
                  </button>

                  <button
                    onClick={() => setShowArchiveModal(true)}
                    className="w-full text-left group flex items-start gap-3 transition-colors hover:bg-[#faf8ff] rounded-lg"
                    style={{ padding: '11px 6px', borderTop: '1px solid #f3f0fa' }}
                  >
                    <span aria-hidden="true" className="flex-shrink-0" style={{ fontSize: 14, marginTop: 1 }}>📁</span>
                    <span className="flex-1 min-w-0 block">
                      <span className="block" style={{ fontSize: 13.5, fontWeight: 650, color: '#221d33' }}>View Archive</span>
                      <span className="block" style={{ marginTop: 2, fontSize: 12.5, lineHeight: 1.4, color: '#837c96' }}>
                        {archivedCards.length + archivedCoreResumes.length} archived items
                      </span>
                    </span>
                    <span className="flex-shrink-0 text-[#cdc6de] group-hover:text-[#8b5cf6] transition-colors" style={{ fontSize: 13, marginTop: 2 }}>→</span>
                  </button>
                </section>

                {/* ---- And the way back out into a search ---- */}
                <section
                  className="rounded-xl border p-5"
                  style={{ borderColor: '#e4daf9', background: 'linear-gradient(180deg, #fdfcff, #f9f6fe)' }}
                >
                  {isPro ? (
                    <>
                      <h2 style={{ fontSize: 15, fontWeight: 650, letterSpacing: '-0.01em', color: '#17132a' }}>Ready to search again?</h2>
                      <p style={{ marginTop: 5, fontSize: 13, lineHeight: 1.45, color: '#6b6580' }}>
                        Update your résumé in minutes using everything in here. You&apos;ve logged{' '}
                        <strong style={{ color: '#6d28d9', fontWeight: 700 }}>{accomplishments.length} win{accomplishments.length !== 1 ? 's' : ''}</strong>{' '}
                        in your current job, and your coach remembers all of it.
                      </p>
                      <button
                        onClick={() => setShowNewSearchModal(true)}
                        className="w-full text-white rounded-lg py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
                        style={{ marginTop: 14, background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
                      >
                        Start new search →
                      </button>
                    </>
                  ) : (
                    <>
                      <h2 style={{ fontSize: 15, fontWeight: 650, letterSpacing: '-0.01em', color: '#17132a' }}>Ready to job search again?</h2>
                      <p style={{ marginTop: 5, fontSize: 13, lineHeight: 1.45, color: '#6b6580' }}>
                        Upgrade to Pro and we&apos;ll coach everything you&apos;ve logged into a stronger résumé. You&apos;ve logged{' '}
                        <strong style={{ color: '#6d28d9', fontWeight: 700 }}>{accomplishments.length} win{accomplishments.length !== 1 ? 's' : ''}</strong>{' '}
                        in your current job.
                      </p>
                      <button
                        onClick={() => setShowUpgradeModal(true)}
                        className="w-full bg-purple-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-purple-700 transition-colors"
                        style={{ marginTop: 14 }}
                      >
                        Upgrade to Pro — $29.99/mo
                      </button>
                    </>
                  )}
                </section>
              </div>
            </div>
          </div>
        </div>
      </AppShell.Main>

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
          onLogWin={() => { setShowJobModal(false); openLogWin(); }}
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
          clCount={userProfile?.cl_count ?? 0}
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
                            {isPro && (
                            <button
                              onClick={() => setConfirmDelete({ id: resume.id, type: 'core' })}
                              className="text-[10px] text-red-400 font-semibold hover:text-red-600"
                            >Delete</button>
                            )}
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
          clCount={userProfile?.cl_count ?? 0}
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
                            ? coreResumeLabel({
                                resume,
                                lenses: namingLenses,
                                currentLensName,
                                coreCount: activeCoreCount
                              })
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
                    ? coreResumeLabel({
                        resume: confirmArchiveResume,
                        lenses: namingLenses,
                        currentLensName,
                        coreCount: activeCoreCount
                      })
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
    <SuccessToast message={successToast} onClose={() => setSuccessToast(null)} />

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
                Your Resume Writer will walk you through incorporating everything you've logged: your wins, skills, and the role you landed, all building a stronger starting point for your next search.
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
                  Just want to view or download your resume? <br/>Go to Resume Writer →
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

   <VaultUpgradeModal
        isOpen={Boolean(vaultPrompt)}
        onClose={() => setVaultPrompt(null)}
        title={vaultPrompt?.title}
        message={vaultPrompt?.message}
      />

   <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        currentTier={tier}
      />
    </AppShell>
  );
}