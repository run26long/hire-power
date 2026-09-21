'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import MainNav from '../components/MainNav';
import ErrorToast from '../components/ErrorToast';
import { canAccessBuiltWork } from '@/lib/tiers';
import { fetchJSON } from '@/lib/fetchJSON';

// ── Module-level components (no hooks inside render functions) ──

// ── Pill helper ──
const SP = {
  base: { fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 20, display: 'inline-block', letterSpacing: '0.02em', whiteSpace: 'nowrap' },
  free:  { background: '#f5f3ff', border: '1px solid #e9d5ff', color: '#7c3aed' },
  start: { background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#9ca3af' },
  prog:  { background: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e' },
  done:  { background: '#f0fdf4', border: '1px solid #d1fae5', color: '#166534' },
};

// The two states this design names its own colours for. Everything else -
// "Not started", "Completed" - keeps the pill it already had.
const PILL_PROGRESS = { fontSize: 11, fontWeight: 600, padding: '5px 10px', borderRadius: 999, display: 'inline-block', whiteSpace: 'nowrap', color: '#9A5B00', background: '#FFF8E8', border: '1px solid #F4C866' };
const PILL_PUBLISHED = { ...PILL_PROGRESS, color: '#137A3A', background: '#ECFDF3', border: '1px solid #C7F0D5' };

// ── The primary panel ──
//
// The numeral and the badge share the first line and are part of the flow
// rather than laid over it, so the heading beneath them starts at the same
// height in both panels whatever the badge says.
function PrimaryPanel({ onClick, numeral, heading, lead, copy, copyWidth, badge, cta }) {
  return (
    <div className="hp-panel" onClick={onClick}>
      <span className="hp-panel-wash" aria-hidden="true" />
      {badge ? <span className="hp-panel-badge">{badge}</span> : null}
      <span className="hp-numeral" aria-hidden="true">{numeral}</span>
      <div className="hp-panel-body">
        <p className="hp-name">{heading}</p>
        <p className="hp-lead">{lead}</p>
        <p className="hp-copy" style={{ maxWidth: copyWidth }}>{copy}</p>
        <span className="hp-cta">{cta}</span>
      </div>
    </div>
  );
}

// ── The tool column ──
function ToolColumn({ onClick, numeral, name, lead, copy, copyWidth = 320, cta }) {
  return (
    <div className="hp-col" onClick={onClick}>
      <span className="hp-numeral" aria-hidden="true">{numeral}</span>
      <p className="hp-col-name">{name}</p>
      <p className="hp-col-lead">{lead}</p>
      <p className="hp-col-copy" style={{ maxWidth: copyWidth }}>{copy}</p>
      <span className="hp-cta hp-cta-sm">{cta}</span>
    </div>
  );
}


// ── Main page ──

function DashboardContent() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [coreResume, setCoreResume] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginView, setLoginView] = useState('login');
  const [resetEmail, setResetEmail] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [toast, setToast] = useState(null);
  const [hasBuildProgress, setHasBuildProgress] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showTourModal, setShowTourModal] = useState(false);
  const [creatingChat, setCreatingChat] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [archivedCoreCount, setArchivedCoreCount] = useState(0);
  // The one thing the page still asks about beyond the account itself:
  // whether there is a Career Profile, and whether it is published. Optional,
  // like everything else here - the panel renders either way.
  const [profileSignals, setProfileSignals] = useState(null);

  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          console.error('Code exchange failed:', error);
          setToast('This reset link has expired. Please request a new one.');
          setShowLoginModal(true);
          setLoginView('forgot');
        } else {
          setShowLoginModal(true);
          setLoginView('reset');
        }
      });
      window.history.replaceState({}, '', '/dashboard');
    }
  }, [searchParams]);

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          // No valid session — show login modal instead of throwing.
          // Auth errors here usually mean expired/missing refresh token, which is normal.
          setShowLoginModal(true);
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles').select('*').eq('id', user.id).maybeSingle();
        if (!profile && !profileError) {
          // Profile row doesn't exist — deleted account with a stale session
          await supabase.auth.signOut();
          setShowLoginModal(true);
          setLoginView('login');
          setLoginError('account_deleted');
          return;
        }
        if (profileError) {
          console.warn('Dashboard profile load issue (non-fatal):', profileError);
        }

        setUser(user);
        if (profile) setUserProfile(profile);

        // First-time Loops sync for confirmed Free users.
        // Pro/Vault users are synced by the Stripe webhook on payment.
        if (
          user.email_confirmed_at &&
          profile &&
          !profile.loops_synced_at &&
          profile.subscription_tier === 'free'
        ) {
          fetch('/api/loops/sync-contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: user.email,
              userId: user.id,
              subscriptionTier: 'free',
              firstName: profile.first_name || '',
              lastName: profile.last_name || '',
              isInitialSync: true
            })
          })
            .then(res => {
              if (res.ok) {
                supabase.from('profiles').update({ loops_synced_at: new Date().toISOString() }).eq('id', user.id);
              }
            })
            .catch(err => console.error('Loops first-sync failed:', err));
        }

        // New user → Dashboard
        const createdAt = new Date(user.created_at);
        if ((Date.now() - createdAt.getTime()) < 30000) {
          router.push('/dashboard');
          return;
        }

        const { data: resumes, error: resumesError } = await supabase
          .from('resumes').select('*').eq('user_id', user.id)
          .eq('resume_type', 'core')
          .eq('is_active', true)
          .order('is_priority_core', { ascending: false })
          .order('updated_at', { ascending: false });
        if (resumesError) {
          console.warn('Dashboard resumes load issue (non-fatal):', resumesError);
        }
        // Filter out abandoned chat sessions (empty resume_data from unfinished brb)
        const meaningfulResume = resumes?.find(r => {
          if (r.journey_step === 'chat' && (!r.resume_data || Object.keys(r.resume_data).length === 0)) return false;
          return true;
        });
        if (meaningfulResume) setCoreResume(meaningfulResume);

        // Deliberately swallowed and deliberately not awaited with the rest:
        // the dashboard has to render whether or not it answers, and a panel
        // without its badge is worth more than a page that will not load.
        const { data: { session } } = await supabase.auth.getSession();
        const headers = { Authorization: `Bearer ${session?.access_token}` };

        fetchJSON('/api/career-profile/manage', { headers })
          .then(setProfileSignals)
          .catch(err => console.warn('Dashboard profile signals failed (non-fatal):', err));

        if (searchParams.get('cancelled') === 'true') {
          setToast("Your subscription has been cancelled. You'll keep access until the end of your current billing period.");
          window.history.replaceState({}, '', '/dashboard');
        }

        // Show tour modal if user has no meaningful core resume
        if (!meaningfulResume) {
          const { count: archivedCount } = await supabase
            .from('resumes')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('resume_type', 'core')
            .eq('is_active', false);
          setArchivedCoreCount(archivedCount || 0);
          setShowTourModal(true);
        }

        // Check for in-progress form builder session
        try {
          const buildProgress = localStorage.getItem(`hp_build_progress_${user.id}`);
          if (buildProgress) {
            const parsed = JSON.parse(buildProgress);
            if (parsed.data && Object.values(parsed.data).some(v => v && (typeof v === 'string' ? v.trim() : Array.isArray(v) ? v.length > 0 : false))) {
              setHasBuildProgress(true);
            }
          }
        } catch (e) {}
      } catch (err) {
        console.error('Dashboard load failed:', err);
        setToast("We couldn't load your dashboard. Please refresh the page.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Password strength: returns { score: 0-3, label, color, width }
  const getPasswordStrength = (password) => {
    if (!password) return null;
    const len = password.length;
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSymbol = /[^a-zA-Z0-9]/.test(password);
    const variety = [hasLetter, hasNumber, hasSymbol].filter(Boolean).length;

    if (len < 8) return { score: 0, label: 'Too short', color: '#ef4444', width: '25%' };
    if (len >= 12 || (len >= 10 && variety >= 2)) return { score: 3, label: 'Strong', color: '#10b981', width: '100%' };
    if (len >= 10 || (len >= 8 && variety >= 2)) return { score: 2, label: 'Good', color: '#f59e0b', width: '66%' };
    return { score: 1, label: 'Weak', color: '#f59e0b', width: '40%' };
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true); setLoginError('');
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
    if (signInError) {
      setLoginLoading(false);
      const msg = signInError.message;
      if (msg.includes('Email not confirmed')) {
        setLoginError('email_not_confirmed');
      } else if (msg.includes('Invalid login credentials')) {
        setLoginError('invalid_credentials');
      } else {
        setLoginError(msg);
      }
      return;
    }
    if (data.user) {
      // Block login if the account has been flagged for deletion.
      const { data: profileCheck } = await supabase
        .from('profiles')
        .select('deletion_requested_at')
        .eq('id', data.user.id)
        .maybeSingle();
      if (profileCheck?.deletion_requested_at) {
        await supabase.auth.signOut();
        setLoginLoading(false);
        setLoginError('account_deleted');
        return;
      }
      setLoginLoading(false);
      setShowLoginModal(false);
      window.location.href = '/dashboard';
    }
  };

  // Supabase returns a raw character-class list when a password fails its rules.
  // Point people at the requirements already shown under the field instead.
  const friendlyAuthError = (message) =>
    /password/i.test(message || '')
      ? "Your password doesn't meet the requirements listed below."
      : message;

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setResetLoading(true); setResetError('');
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, { redirectTo: `${window.location.origin}/dashboard` });
    setResetLoading(false);
    if (error) { setResetError(error.message); }
    else { setResetSuccess(true); setTimeout(() => { setShowLoginModal(false); setResetSuccess(false); setLoginView('login'); }, 3000); }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (resetPassword !== resetConfirm) { setResetError('Passwords do not match.'); return; }
    if (resetPassword.length < 8) { setResetError('Password must be at least 8 characters.'); return; }
    setResetLoading(true); setResetError('');
    const { error } = await supabase.auth.updateUser({ password: resetPassword });
    setResetLoading(false);
    if (error) { setResetError(friendlyAuthError(error.message)); }
    else { setResetSuccess(true); setTimeout(() => { setShowLoginModal(false); window.location.href = '/dashboard'; }, 2000); }
  };

  const handleDashboardUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(file.type)) throw new Error('Please upload a PDF or DOCX file.');
      if (file.size > 10 * 1024 * 1024) throw new Error('File is too large. Maximum size is 10MB.');
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;
      const { error: upErr } = await supabase.storage.from('resumes').upload(filePath, file);
      if (upErr) throw new Error('Upload failed. Please try again.');
      const { data: { session } } = await supabase.auth.getSession();
      const parseRes = await fetch('/api/parse-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` }, body: JSON.stringify({ filePath }) });
      if (!parseRes.ok) throw new Error('Could not read file. Try a different format.');
      const { text } = await parseRes.json();
      const extractRes = await fetch('/api/extract-resume-structure', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` }, body: JSON.stringify({ parsedText: text }) });
      if (!extractRes.ok) throw new Error('Upload failed. Please try again.');
      const { data: resumeData } = await extractRes.json();
      const { data: savedResume, error: saveErr } = await supabase.from('resumes').insert({ user_id: user.id, resume_type: 'core', display_name: 'Core Resume', resume_data: resumeData, journey_step: 'review', file_path: filePath }).select().single();
      if (saveErr) throw new Error('Upload failed. Please try again.');
      try { await fetch('/api/loops/mark-has-resume', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) }) } catch (e) {}
      setShowTourModal(false);
      router.push(`/resume/${savedResume.id}`);
    } catch (err) {
      setUploadError(err.message);
      setUploading(false);
    }
  };

  const handleDashboardChat = async () => {
    setCreatingChat(true);
    try {
      const { data: newResume, error } = await supabase.from('resumes').insert({ user_id: user.id, resume_type: 'core', display_name: 'Core Resume', resume_data: {}, journey_step: 'chat', created_via: 'resume_chat' }).select().single();
      if (error || !newResume) { setCreatingChat(false); return; }
      try { await fetch('/api/loops/mark-has-resume', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) }) } catch (e) {}
      setShowTourModal(false);
      router.push(`/resume/${newResume.id}`);
    } catch (err) {
      console.error('Resume chat start error:', err);
      setCreatingChat(false);
    }
  };

  // ── Derived state ──
  const tier = userProfile?.subscription_tier;
  const isPro = tier === 'pro';

  const resumeCompleted = !!coreResume?.completed_at;
  const resumeInProgress = !!coreResume && !resumeCompleted;

  let rcCta = 'Upload your resume';
  let rcStatus = 'not-started';
  if (hasBuildProgress) { rcCta = 'Continue in builder'; rcStatus = 'in-progress'; }
  else if (resumeInProgress)  { rcCta = 'Continue coaching'; rcStatus = 'in-progress'; }
  // Three answers, not two. Pro is invited to build another; Vault, which
  // keeps what it built but does not build more, is pointed at what it has;
  // free gets the one resume it keeps. The middle case used to fall into the
  // free copy because the only question asked was isPro.
  else if (resumeCompleted) {
    rcCta = isPro
      ? 'Build a job-specific version'
      : canAccessBuiltWork(tier)
      ? 'Open your resumes'
      : 'View your resume';
    rcStatus = 'done';
  }

  // A profile exists once there is a row for it. The management route
  // answers with profile: null for an account that has never generated one,
  // which is the same question the Career Profile page asks. These two are
  // the whole of what this page reads from it.
  const hasProfile = Boolean(profileSignals?.profile);
  const profilePublished = profileSignals?.profile?.is_published === true;


  const firstName = userProfile?.display_name
    ? userProfile.display_name.split(' ')[0]
    : userProfile?.email?.split('@')[0] || null;

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #ede9fe', borderTopColor: '#9333ea', animation: 'hp-spin 0.8s linear infinite' }} />
      <style>{`@keyframes hp-spin{to{transform:rotate(360deg)}} @keyframes hp-pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,700;0,9..144,900;1,9..144,700;1,9..144,900&family=DM+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes hp-pulse{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes hp-spin{to{transform:rotate(360deg)}}
        /* ── THE SHELL ──
           One screen. The hero, the pair of panels and the three tools are
           each held to a stated height, and they add up to less than a
           desktop viewport at 1440. */
        .hp-shell { max-width: 1440px; margin: 0 auto; padding: 0 64px 20px; }

        /* ── THE HERO ──
           The title, the greeting opposite it, and one rule with the thesis
           under it. The callout that used to stand beside the title is gone:
           the sentence it held now runs the width of the page, which is both
           a plainer way to say it and what makes the hero short enough for
           the rest of the dashboard to fit under it. */
        .hp-hero-wrap { padding: 14px 0 12px; }
        .hp-hero-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 32px; }
        .hp-welcome { font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #9333EA; opacity: 0.65; white-space: nowrap; padding-top: 4px; }
        .hp-hero-1 { font-family: 'Fraunces', serif; font-size: 28px; font-weight: 700; line-height: 1; color: #17131D; display: block; }
        .hp-hero-2 { font-family: 'Fraunces', serif; font-size: 43px; font-weight: 700; font-style: italic; line-height: 0.95; color: #9333EA; display: block; }

        /* ── THE PRIMARY ROW ── */
        .hp-row-lg { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 20px; }

        .hp-panel {
          height: 250px; background: #FBF9FD; border: 1px solid #E8E1F0; border-radius: 18px;
          padding: 28px 30px; position: relative; overflow: hidden;
          display: flex; flex-direction: column; cursor: pointer;
          transition: border-color 160ms ease, background 160ms ease;
        }
        .hp-panel:hover { border-color: #D8C8EC; background: #FAF7FD; }
        /* The rail the status and the numeral stand in. A wash rather than a
           rule: it gives the right of the card a weight of its own without
           cutting the card in two. */
        .hp-panel-wash {
          position: absolute; top: 0; right: 0; bottom: 0; width: 190px; pointer-events: none;
          background: linear-gradient(
            90deg,
            rgba(147,51,234,0) 0%,
            rgba(147,51,234,0.025) 35%,
            rgba(147,51,234,0.07) 100%
          );
        }
        .hp-panel-badge { position: absolute; top: 24px; right: 28px; z-index: 2; }

        /* Every word of the panel lives here, and it is the width of the card
           less the rail. Nothing can run under the numeral, whatever it says. */
        .hp-panel-body {
          width: calc(100% - 190px); max-width: 480px; height: 100%;
          display: flex; flex-direction: column; position: relative; z-index: 2;
        }

        .hp-name { font-size: 34px; font-weight: 800; line-height: 1; letter-spacing: -0.025em; color: #17131D; margin: 0; white-space: nowrap; }
        .hp-lead { font-size: 17px; font-weight: 700; line-height: 1.25; color: #2E2834; margin: 14px 0 0; max-width: 420px; }
        .hp-copy { font-size: 14px; font-weight: 400; line-height: 1.45; color: #77707E; margin: 8px 0 0; }

        /* ── THE SECONDARY ROW ── */
        .hp-tools {
          margin-top: 16px; height: 178px; background: #FFFFFF;
          border-top: 1px solid #ECE8F0; border-bottom: 1px solid #ECE8F0;
          display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        .hp-col { height: 178px; padding: 22px 28px; display: flex; flex-direction: column; position: relative; cursor: pointer; }
        .hp-col + .hp-col { border-left: 1px solid #ECE8F0; }
        .hp-col-name { font-size: 27px; font-weight: 800; line-height: 1; letter-spacing: -0.025em; color: #17131D; margin: 0; }
        .hp-col-lead { font-size: 14px; font-weight: 700; color: #302A36; margin: 10px 0 0; }
        .hp-col-copy { font-size: 13px; line-height: 1.4; color: #7A7480; margin: 6px 0 0; }

        /* ── THE NUMERALS ──
           In the tools they sit in the upper right over the column. In the
           panels they lead the first line instead, so the heading under them
           starts level in both. */
        .hp-numeral { font-family: 'Fraunces', serif; font-size: 50px; font-weight: 700; line-height: 0.8; color: #E7D9FA; }
        .hp-col .hp-numeral { position: absolute; right: 26px; top: 22px; pointer-events: none; }
        .hp-panel .hp-numeral {
          position: absolute; top: 67px; right: 27px; z-index: 1; pointer-events: none;
          font-size: 88px; letter-spacing: -0.035em; color: #E3D2FA;
        }

        /* ── THE WAY ON ──
           A line of text, not a button, on all five. It sits at the foot of
           its column, so the five of them line up within their row. */
        .hp-cta {
          align-self: flex-start; margin-top: auto;
          font-size: 13.5px; font-weight: 700; color: #7C3AED;
          transition: color 160ms ease;
        }
        .hp-panel .hp-cta { font-size: 14px; margin-bottom: 2px; }
        .hp-cta-sm { font-size: 13px; }

        /* A band rather than a line of type on the page: the sentence is the
           last thing read and it closes the dashboard off, so it is given a
           surface of its own to sit in. */
        .hp-thesis {
          margin: 0; height: 52px; padding: 0 24px;
          background: #FBF8FE;
          border-top: 1px solid #EEE7F6; border-bottom: 1px solid #EEE7F6;
          display: flex; align-items: center; justify-content: center; text-align: center;
          font-size: 14px; line-height: 20px; font-weight: 500; color: #6F6878;
        }
        .hp-thesis strong { font-weight: 700; color: #7C3AED; }
        .hp-panel:hover .hp-cta, .hp-col:hover .hp-cta { color: #5B21B6; text-decoration: underline; }

        @media (max-width: 1100px) {
          .hp-shell { padding: 0 32px 20px; }
          .hp-hero-top { flex-direction: column-reverse; align-items: flex-start; gap: 8px; }
          .hp-welcome { padding-top: 0; }
          .hp-row-lg { grid-template-columns: minmax(0, 1fr); }
          .hp-panel { height: auto; min-height: 0; }
          .hp-tools { grid-template-columns: minmax(0, 1fr); height: auto; }
          .hp-col { height: auto; }
          .hp-col + .hp-col { border-left: 0; border-top: 1px solid #ECE8F0; }
        }
        @media (max-width: 768px) {
          .hp-shell { padding: 0 20px 20px; }
          .hp-thesis { height: auto; padding: 14px 24px; }
          .hp-panel-wash { display: none; }
          .hp-panel-body { width: 100%; max-width: none; padding-right: 64px; padding-top: 40px; }
          .hp-panel .hp-numeral { font-size: 50px; top: 56px; }
          .hp-hero-2 { font-size: 38px; }
          .hp-panel { padding: 22px; }
          .hp-col { padding: 22px; }
          .hp-name { font-size: 32px; }
          .hp-col-name { font-size: 24px; }
        }
      `}</style>

      {/* LOGIN MODAL */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white shadow-2xl w-full overflow-hidden" style={{ maxWidth: 420, borderRadius: 12 }}>
            <div style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)' }} className="px-6 py-5">
              <div className="flex items-center gap-3">
                <img src="/images/Hire_Power_icon.png" alt="Hire Power" className="h-8 w-auto flex-shrink-0" />
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {loginView === 'login' && 'Welcome back'}
                    {loginView === 'forgot' && 'Reset your password'}
                    {loginView === 'reset' && 'Choose a new password'}
                  </h2>
                  <p className="text-purple-100 text-xs">
                    {loginView === 'login' && 'Your lifelong career coach.'}
                    {loginView === 'forgot' && "We'll send you a reset link."}
                    {loginView === 'reset' && "Make it something you'll remember."}
                  </p>
                </div>
              </div>
            </div>
            <div className="px-6 py-5">
              {loginView === 'login' && (
                <>
                  {loginError === 'invalid_credentials' ? (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm mb-4">
                      Email or password is incorrect. Try again, or use <button onClick={() => { setLoginView('forgot'); setResetError(''); setResetSuccess(false); }} className="font-semibold underline bg-transparent border-none cursor-pointer p-0 text-red-700">Forgot password?</button>
                    </div>
                  ) : loginError === 'email_not_confirmed' ? (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 rounded text-sm mb-4">
                      Please confirm your email before logging in. Check your inbox for the confirmation link.
                    </div>
                  ) : loginError === 'account_deleted' ? (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm mb-4">
                      This account has been deleted. If this was a mistake, email <a href="mailto:hired@hirepowerai.com" className="font-semibold underline">hired@hirepowerai.com</a>.
                    </div>
                  ) : loginError ? (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm mb-4">{loginError}</div>
                  ) : null}
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
                      <input type="email" required value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                        placeholder="you@example.com" autoFocus />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                      <div className="relative">
                        <input type={showLoginPassword ? "text" : "password"} required value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
                          className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 pr-10"
                          placeholder="Your password" />
                        <button type="button" onClick={() => setShowLoginPassword(!showLoginPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {showLoginPassword ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                    <button type="submit" disabled={loginLoading}
                      className="block mx-auto py-2 px-8 rounded-md text-sm font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
                      style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}>
                      {loginLoading ? 'Logging in...' : 'Log in'}
                    </button>
                  </form>
                  <div className="flex items-center justify-between mt-4">
                    <button onClick={() => { setLoginView('forgot'); setResetError(''); setResetSuccess(false); }}
                      className="text-xs text-purple-600 hover:underline bg-transparent border-none cursor-pointer">
                      Forgot password?
                    </button>
                    <button onClick={() => router.push('/landing?signup=true')} className="text-xs text-gray-400 hover:underline bg-transparent border-none cursor-pointer">
                      Sign up free
                    </button>
                  </div>
                </>
              )}
              {loginView === 'forgot' && (
                resetSuccess ? (
                  <div className="text-center py-4">
                    <div className="text-4xl mb-3">📧</div>
                    <p className="font-semibold text-gray-900 mb-2">Check your email!</p>
                    <p className="text-sm text-gray-600">Click the reset link and you'll be brought back here to choose a new password.</p>
                  </div>
                ) : (
                  <>
                    {resetError && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm mb-4">{resetError}</div>}
                    <form onSubmit={handleForgotPassword} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
                        <input type="email" required value={resetEmail} onChange={e => setResetEmail(e.target.value)}
                          className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                          placeholder="you@example.com" autoFocus />
                      </div>
                      <button type="submit" disabled={resetLoading}
                        className="block mx-auto py-2 px-8 rounded-md text-sm font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
                        style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}>
                        {resetLoading ? 'Sending...' : 'Send reset link'}
                      </button>
                    </form>
                    <button onClick={() => setLoginView('login')} className="w-full text-center text-xs text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer mt-4">
                      ← Back to log in
                    </button>
                  </>
                )
              )}
              {loginView === 'reset' && (
                resetSuccess ? (
                  <div className="text-center py-4">
                    <div className="text-4xl mb-3">✅</div>
                    <p className="font-semibold text-gray-900 mb-2">Password updated!</p>
                    <p className="text-sm text-gray-600">Taking you to your dashboard...</p>
                  </div>
                ) : (
                  <>
                    {resetError && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm mb-4">{resetError}</div>}
                    <form onSubmit={handleResetPassword} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
                        <div className="relative">
                          <input type={showResetPassword ? "text" : "password"} required value={resetPassword} onChange={e => setResetPassword(e.target.value)}
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 pr-10"
                            placeholder="Min. 8 characters" />
                          <button type="button" onClick={() => setShowResetPassword(!showResetPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            {showResetPassword ? (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            )}
                          </button>
                        </div>
                        {resetPassword && (() => {
                          const s = getPasswordStrength(resetPassword);
                          return (
                            <div className="mt-1.5">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full transition-all duration-200" style={{ width: s.width, background: s.color }} />
                                </div>
                                <span className="text-[10px] font-medium" style={{ color: s.color }}>{s.label}</span>
                              </div>
                            </div>
                          );
                        })()}
                        <p className="text-xs text-gray-400 mt-1">Must include at least 1 uppercase, 1 lowercase, 1 number & 1 symbol</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
                        <div className="relative">
                          <input type={showResetConfirm ? "text" : "password"} required value={resetConfirm} onChange={e => setResetConfirm(e.target.value)}
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 pr-10"
                            placeholder="Same password again" />
                          <button type="button" onClick={() => setShowResetConfirm(!showResetConfirm)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            {showResetConfirm ? (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Must include at least 1 uppercase, 1 lowercase, 1 number & 1 symbol</p>
                      </div>
                      <button type="submit" disabled={resetLoading}
                        className="block mx-auto py-2 px-8 rounded-md text-sm font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
                        style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}>
                        {resetLoading ? 'Updating...' : 'Update password'}
                      </button>
                    </form>
                  </>
                )
              )}
            </div>
          </div>
        </div>
      )}

      <MainNav currentPage="dashboard" userProfile={userProfile} />

      {/* PAGE
          One screen at 1440. The hero, the pair of panels and the three
          tools are each held to a stated height, so the five places a person
          can go are all in front of them without scrolling. */}
      <div className="hp-page" style={{ fontFamily: "'DM Sans', sans-serif", background: '#FFFFFF' }}>
        <div className="hp-shell">

          {/* ================= HERO ================= */}
          <div className="hp-hero-wrap">
            <div className="hp-hero-top">
              <h1 style={{ margin: 0 }}>
                <span className="hp-hero-1">One platform.</span>
                <em className="hp-hero-2">Your whole career.</em>
              </h1>
              <p className="hp-welcome">{firstName ? `Welcome back, ${firstName}` : 'Welcome back'}</p>
            </div>
          </div>

          {/* ================= PRIMARY ROW ================= */}
          <div className="hp-row-lg">

            <PrimaryPanel
              onClick={() => router.push(hasBuildProgress ? '/build?from=resume-coach' : '/resume-coach')}
              numeral="01"
              heading="Resume Writer"
              lead="Build the strongest version of your story."
              copy="Hire Power finds what’s missing and turns your real experience into a résumé that sounds like you."
              copyWidth={430}
              cta="Open Resume Writer →"
              badge={
                <span style={rcStatus === 'in-progress'
                  ? PILL_PROGRESS
                  : { ...SP.base, ...(rcStatus === 'not-started' ? SP.start : SP.done) }}>
                  {rcStatus === 'not-started' ? 'Not started' : rcStatus === 'in-progress' ? 'In progress' : 'Completed'}
                </span>
              }
            />

            <PrimaryPanel
              onClick={() => router.push('/career-profile')}
              numeral="02"
              heading="Career Profile"
              lead="Your career deserves more than one page."
              copy="Bring together the story, proof, and perspective a résumé can’t hold — and show employers the fuller picture of who you are."
              copyWidth={445}
              cta="Open Career Profile →"
              badge={hasProfile ? (
                <span style={profilePublished ? PILL_PUBLISHED : { ...SP.base, ...SP.prog }}>
                  {profilePublished ? 'Published' : 'Draft'}
                </span>
              ) : null}
            />

          </div>

          {/* ================= SECONDARY ROW ================= */}
          <div className="hp-tools">

            {/* The way in is the same one the nav offers. What a résumé is
                needed for is Interview Practice's own question to ask on the
                page where it can be answered, not a door held shut here. */}
            <ToolColumn
              onClick={() => router.push('/interview-coach')}
              numeral="03"
              name="Interview Practice"
              lead="Be ready to say it out loud."
              copy="Practice with your résumé and target job in context."
              cta="Open Interview Practice →"
            />

            <ToolColumn
              onClick={() => router.push('/job-tracker')}
              numeral="04"
              name="Job Tracker"
              lead="Keep the search moving."
              copy="Keep applications, interviews, follow-ups, and next steps in one place."
              cta="Open Job Tracker →"
            />

            <ToolColumn
              onClick={() => router.push('/career-vault')}
              numeral="05"
              name="Career Vault"
              lead="Never start from scratch again."
              copy="Everything Hire Power learns about your career makes the next résumé, interview, and job search easier."
              copyWidth={360}
              cta="Open Career Vault →"
            />

          </div>

          <p className="hp-thesis">
            <span>
              Most tools help you find a job. <strong>Hire Power helps you build a career.</strong>{' '}
              Stay ready for any opportunity, and never start from scratch again.
            </span>
          </p>
        </div>
      </div>

      {/* TOUR MODAL — shown when user has no core resume */}
      {showTourModal && user && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)' }}
          onMouseDown={(e) => { e.currentTarget.dataset.downTarget = e.target === e.currentTarget ? 'backdrop' : 'inside'; }}
          onMouseUp={(e) => {
            if (e.target === e.currentTarget && e.currentTarget.dataset.downTarget === 'backdrop') {
              setShowTourModal(false);
            }
          }}
        >
          <div
            className="bg-white shadow-2xl max-w-lg w-full overflow-hidden border border-gray-200"
            onMouseDown={(e) => e.stopPropagation()}
            style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', borderRadius: '8px' }}
          >
            <div
              style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)' }}
              className="px-6 py-5 relative"
            >
              <button
                onClick={() => setShowTourModal(false)}
                className="absolute top-4 right-4 text-white hover:text-gray-200 text-3xl leading-none font-light"
              >×</button>
              <div className="flex items-center gap-3">
                <img src="/images/Hire_Power_icon.png" alt="Hire Power" className="h-8 w-auto flex-shrink-0" />
                <div>
                  <h2 className="text-xl font-bold text-white">Let's Get Started</h2>
                  <p className="text-purple-100 text-xs">Your resume is the starting point.</p>
                </div>
              </div>
            </div>

            <div className="px-6 py-5">
              <div className="flex flex-col py-2">

                {/* Option 1 — Upload */}
                <div className="flex items-center gap-4 py-4">
                  <span className="text-6xl font-black text-gray-200 leading-none flex-shrink-0 w-10" style={{ fontFamily: 'Fraunces, serif' }}>1</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 leading-snug">Already have a resume?</p>
                    <p className="text-xs text-gray-500 leading-snug mt-0.5">Upload it here, and we'll coach it into something stronger.</p>
                  </div>
                  <label className="block cursor-pointer flex-shrink-0">
                    <input
                      type="file"
                      accept=".pdf,.docx"
                      onChange={handleDashboardUpload}
                      className="hidden"
                      disabled={uploading}
                    />
                    <div
                      className="text-white px-4 py-2 rounded-lg transition-opacity hover:opacity-90 font-semibold text-xs cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                      style={{ background: 'linear-gradient(to right, #667eea, #764ba2)', minWidth: '140px', justifyContent: 'center' }}
                    >
                      {uploading ? (
                        <>
                          <div className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full"></div>
                          Uploading...
                        </>
                      ) : 'Upload Resume'}
                    </div>
                  </label>
                </div>

                <div className="border-t border-gray-100 mx-2" />

                {/* Option 2 — Build with Coach */}
                <div className="flex items-center gap-4 py-4">
                  <span className="text-6xl font-black text-gray-200 leading-none flex-shrink-0 w-10" style={{ fontFamily: 'Fraunces, serif' }}>2</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 leading-snug">No resume? No problem!</p>
                    <p className="text-xs text-gray-500 leading-snug mt-0.5">Meet brb — best resume builder. Writes your resume from one conversation. Mobile friendly, desktop optional. Type your answers, or use talk-to-text on your mobile device.</p>
                  </div>
                  <div className="flex-shrink-0 text-center">
                    <button
                      onClick={handleDashboardChat}
                      disabled={creatingChat}
                      className="px-4 py-2 rounded-lg font-semibold text-xs inline-flex items-center gap-1.5 text-white transition-opacity hover:opacity-90 whitespace-nowrap disabled:opacity-85"
                      style={{ background: 'linear-gradient(to right, #667eea, #764ba2)', minWidth: '140px', justifyContent: 'center' }}
                    >
                      {creatingChat ? (
                        <>
                          <div className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full"></div>
                          Starting...
                        </>
                      ) : 'brb'}
                    </button>
                  </div>
                </div>

                {/* Option 3 — Restore from archive (only if archived cores exist) */}
                {archivedCoreCount > 0 && (
                  <>
                    <div className="border-t border-gray-100 mx-2" />
                    <div className="flex items-center gap-4 py-4">
                      <span className="text-6xl font-black text-gray-200 leading-none flex-shrink-0 w-10" style={{ fontFamily: 'Fraunces, serif' }}>3</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 leading-snug">Restore from archive</p>
                        <p className="text-xs text-gray-500 leading-snug mt-0.5">You have {archivedCoreCount} core resume{archivedCoreCount !== 1 ? 's' : ''} in your archive.</p>
                      </div>
                      <button
                        onClick={() => { setShowTourModal(false); router.push('/career-vault?openArchive=true'); }}
                        className="px-4 py-2 rounded-lg font-semibold text-xs text-white transition-opacity hover:opacity-90 whitespace-nowrap"
                        style={{ background: 'linear-gradient(to right, #667eea, #764ba2)', minWidth: '140px', textAlign: 'center' }}
                      >
                        View Archive
                      </button>
                    </div>
                  </>
                )}

                {/* Builder link — desktop only */}
                <div className="hidden md:block text-center mt-2" style={{ lineHeight: '1' }}>
                  <span className="block text-xs text-gray-400">Not feeling chatty?</span>
                  <button
                    onClick={() => { setShowTourModal(false); router.push('/build?from=resume-coach'); }}
                    className="text-xs text-purple-400 hover:text-purple-700 font-medium hover:underline bg-transparent border-none cursor-pointer"
                  >
                    Build it yourself with our form-based resume builder.
                  </button>
                </div>

                {/* Mobile note */}
                <p className="md:hidden text-xs text-gray-400 text-center mt-2">
                  Not feeling chatty? <br/> Use our form-based resume builder from your computer.
                </p>

                {uploadError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm mt-3 text-center">
                    {uploadError}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <ErrorToast message={toast} onClose={() => setToast(null)} />
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardContent />
    </Suspense>
  );
}