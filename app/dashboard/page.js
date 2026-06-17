'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import MainNav from '../components/MainNav';
import ErrorToast from '../components/ErrorToast';

// ── Module-level components (no hooks inside render functions) ──

function WhereBadge() {
  return (
    <div style={{
      position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
      background: 'linear-gradient(to right,#667eea,#764ba2)',
      color: 'white', fontSize: 10, fontWeight: 700,
      padding: '3px 14px 5px', borderRadius: '0 0 10px 10px',
      display: 'flex', alignItems: 'center', gap: 5,
      whiteSpace: 'nowrap', letterSpacing: '0.02em', zIndex: 2,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: 'rgba(255,255,255,0.7)', flexShrink: 0,
        animation: 'hp-pulse 2s ease-in-out infinite',
      }} />
      Where you left off
    </div>
  );
}

function HomeCard({ active, onClick, num, numColor, children }) {
  const [hovered, setHovered] = useState(false);
  const lit = active || hovered;
  return (
    <div
      className="hp-card"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRight: '1px solid rgba(0,0,0,0.06)',
        padding: '20px 28px 16px',
        cursor: 'pointer',
        display: 'flex', flexDirection: 'column',
        position: 'relative',
        background: lit ? '#faf9ff' : 'white',
        transition: 'background 0.18s',
        overflow: 'visible',
      }}
    >
      {active && <WhereBadge />}
      <div className="hp-card-num" style={{
        fontFamily: "'Fraunces', serif", fontWeight: 900,
        fontSize: 'clamp(80px,8vw,108px)',
        lineHeight: 1, letterSpacing: '-7px',
        color: lit ? (numColor || '#ddd6fe') : '#ede9fe',
        marginBottom: 0, transition: 'color 0.2s',
      }}>
        {num}
      </div>
      {children(lit)}
    </div>
  );
}

// ── Pill helper ──
const SP = {
  base: { fontSize: 10, fontWeight: 600, padding: '2px 10px', borderRadius: 20, display: 'inline-block', alignSelf: 'flex-start', marginBottom: 14, letterSpacing: '0.02em' },
  free:  { background: '#f5f3ff', border: '1px solid #e9d5ff', color: '#7c3aed' },
  start: { background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#9ca3af' },
  prog:  { background: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e' },
  done:  { background: '#f0fdf4', border: '1px solid #d1fae5', color: '#166534' },
};

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
  const [applicationCount, setApplicationCount] = useState(0);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

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
          .from('profiles').select('*').eq('id', user.id).single();
        if (profileError && profileError.code === 'PGRST116') {
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
          .order('updated_at', { ascending: false }).limit(1);
        if (resumesError) {
          console.warn('Dashboard resumes load issue (non-fatal):', resumesError);
        }
        if (resumes && resumes.length > 0) setCoreResume(resumes[0]);

        const { count: appCount } = await supabase
          .from('applications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id);
        if (appCount) setApplicationCount(appCount);

        if (searchParams.get('cancelled') === 'true') {
          setToast("Your subscription has been cancelled. You'll keep access until the end of your current billing period.");
          window.history.replaceState({}, '', '/dashboard');
        }
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
        .single();
      if (!profileCheck || profileCheck.deletion_requested_at) {
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
    if (error) { setResetError(error.message); }
    else { setResetSuccess(true); setTimeout(() => { setShowLoginModal(false); window.location.href = '/dashboard'; }, 2000); }
  };

  // ── Derived state ──
  const tier = userProfile?.subscription_tier;
  const isPro = tier === 'pro';
  const isVaultTier = tier === 'vault' || tier === 'maintenance' || (tier === 'pro' && userProfile?.search_status === 'hired');

  const resumeCompleted = !!coreResume?.completed_at;
  const resumeInProgress = !!coreResume && !resumeCompleted;
  const activeCard = resumeInProgress ? 'resume' : null;

  const ccCta = !coreResume ? 'Start the conversation' : 'Update your direction';

  let rcCta = 'Upload your resume';
  let rcStatus = 'not-started';
  if (resumeInProgress)  { rcCta = 'Continue coaching'; rcStatus = 'in-progress'; }
  else if (resumeCompleted) { rcCta = isPro ? 'Build a job-specific version' : 'View your resume'; rcStatus = 'done'; }

  const icCta = !resumeCompleted
    ? 'Finish your resume first'
    : isPro ? 'Start interview prep' : 'Use your free session';

  const c4label = isVaultTier ? 'Career Vault' : 'Job Tracker';
  const c4path  = isVaultTier ? '/career-vault' : '/job-tracker';
  const c4desc  = isVaultTier
    ? "Three years from now you won't remember what you accomplished today. Hire Power will. Log wins between job searches, so your resume is ready when opportunities arise."
    : 'Easily track all applications with job cards that store: resume, cover letter, job description, interview times and practice. Schedule automated follows ups and messages!';
  const c4cta = isVaultTier ? 'Log a win' : 'Track your first application';

  const firstName = userProfile?.display_name
    ? userProfile.display_name.split(' ')[0]
    : userProfile?.email?.split('@')[0] || null;

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f7f6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #ede9fe', borderTopColor: '#9333ea', animation: 'hp-spin 0.8s linear infinite' }} />
      <style>{`@keyframes hp-spin{to{transform:rotate(360deg)}} @keyframes hp-pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,900;1,9..144,900&family=DM+Sans:wght@400;500;600;700&display=swap');
        @keyframes hp-pulse{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes hp-spin{to{transform:rotate(360deg)}}
        @media (max-width: 768px) {
          .hp-page { height: auto !important; min-height: calc(100vh - 56px); overflow: auto !important; grid-template-rows: auto auto !important; }
          .hp-welcome { padding: 4px 20px 0 !important; }
          .hp-hero-grid { grid-template-columns: 1fr !important; padding: 20px 20px 0 !important; }
          .hp-hero-left { padding-bottom: 0 !important; padding-right: 0 !important; }
          .hp-hero-right { padding-bottom: 20px !important; }
          .hp-italic { font-size: 42px !important; letter-spacing: -2px !important; }
          .hp-quote-box { margin-top: 14px !important; }
          .hp-quote-p1 { display: inline !important; margin-bottom: 0 !important; }
          .hp-quote-p2 { display: inline !important; }
          .hp-cards-grid { grid-template-columns: 1fr !important; overflow: auto !important; }
          .hp-card { display: grid !important; grid-template-columns: 1fr auto !important; grid-template-rows: auto auto auto auto !important; gap: 0 !important; border-right: none !important; border-bottom: 1px solid rgba(0,0,0,0.06) !important; padding: 14px 24px 12px !important; }
          .hp-card-num { grid-column: 1 !important; grid-row: 1 !important; font-size: 64px !important; letter-spacing: -4px !important; line-height: 0.9 !important; margin-bottom: 0 !important; align-self: end; }
          .hp-card > span { grid-column: 2 !important; grid-row: 1 !important; align-self: start !important; justify-self: end !important; margin-bottom: 0 !important; padding-top: 4px; }
          .hp-card-title { grid-column: 1 / -1 !important; grid-row: 2 !important; margin-bottom: 0 !important; padding-top: 4px; padding-bottom: 8px; }
          .hp-card > p { grid-column: 1 / -1 !important; grid-row: 3 !important; margin-top: 0 !important; }
          .hp-card > div:last-of-type { grid-column: 1 / -1 !important; grid-row: 4 !important; }
          /* Mobile font-size bumps — desktop unaffected (rules only apply <=768px) */
          .hp-welcome { font-size: 12px !important; }
          .hp-quote-p2 { font-size: 16px !important; }
          .hp-card > span { font-size: 12px !important; }
          .hp-card > p { font-size: 16px !important; }
          .hp-card > div:last-of-type > span:first-child { font-size: 14px !important; }
          .hp-card > div:last-of-type > span:last-child { font-size: 16px !important; }
        }
        @media (min-width: 769px) and (max-width: 1024px) {
          .hp-cards-grid { grid-template-columns: repeat(2,1fr) !important; }
          .hp-hero-grid { padding: 24px 32px 0 !important; grid-template-columns: 1fr 1fr !important; }
          .hp-welcome { padding: 4px 32px 0 !important; }
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

      {/* PAGE */}
      <div className="hp-page" style={{ display: 'grid', gridTemplateRows: 'auto 1fr', height: 'calc(100vh - 56px)', fontFamily: "'DM Sans', sans-serif", background: '#f7f6ff', overflow: 'hidden' }}>

       {/* HERO */}
        <div style={{ borderBottom: '1px solid rgba(0,0,0,0.06)', background: 'white', flexShrink: 0 }}>
          <div className="hp-welcome" style={{ padding: '12px 56px 0', textAlign: 'right', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9333ea', opacity: 0.65 }}>
            {firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
          </div>
          <div className="hp-hero-grid" style={{ padding: '32px 56px 0', display: 'grid', gridTemplateColumns: 'calc(50vw - 56px) 1fr', gap: 0, alignItems: 'end' }}>
            <div className="hp-hero-left" style={{ paddingBottom: 20, paddingRight: 48 }}>
              <h1 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, lineHeight: 1.0 }}>
                <span style={{ fontSize: 'clamp(32px,3.2vw,46px)', color: '#0D0D0D', display: 'block', marginBottom: 2, letterSpacing: '-2px' }}>One platform.</span>
                <em className="hp-italic" style={{ fontStyle: 'italic', color: '#9333ea', fontSize: 'clamp(52px,5.2vw,76px)', letterSpacing: '-3.5px' }}>Your whole career.</em>
              </h1>
            </div>
            <div className="hp-hero-right" style={{ paddingBottom: 32 }}>
              <div className="hp-quote-box" style={{ background: 'rgba(147,51,234,0.05)', borderRadius: '0 12px 12px 0', padding: '16px 20px', borderLeft: '3px solid rgba(147,51,234,0.45)' }}>
                <p className="hp-quote-p1" style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontStyle: 'italic', fontSize: 'clamp(16px,1.5vw,18px)', color: '#0D0D0D', lineHeight: 1.25, letterSpacing: '-0.3px', marginBottom: 6 }}>
                  Most tools help you find a job. Hire Power helps you build a career. 
                </p>
                <p className="hp-quote-p2" style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.25 }}>
                   {' '}Stay ready for any opportunity, and never start from scratch again.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CARDS */}
        <div className="hp-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', overflow: 'hidden' }}>

          {/* 01 CAREER COACH */}
          <HomeCard active={activeCard === 'career'} onClick={() => router.push('/career-coach')} num="01">
            {(lit) => (
              <>
                <span style={{ ...SP.base, ...SP.free }}>Set Your Direction</span>
                <div className="hp-card-title" style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 20, color: '#0D0D0D', letterSpacing: '-0.5px', lineHeight: 1.1, marginBottom: 10 }}>Career Coach</div>
                <p style={{ fontSize: 13, color: '#9ca3af', lineHeight: 1.6, flex: 1 }}>The best 5-minute investment you can make in your career. Same field, new field, or figuring it out. The more know about your goals, the stronger your resume becomes.</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(0,0,0,0.05)', justifyContent: 'flex-end', gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: lit ? '#9333ea' : '#7c3aed', transition: 'color 0.15s' }}>{ccCta}</span>
                  <span style={{ fontSize: 14, color: lit ? '#9333ea' : '#7c3aed', transition: 'color 0.15s, transform 0.15s', display: 'inline-block', transform: lit ? 'translateX(4px)' : 'none' }}>→</span>
                </div>
              </>
            )}
          </HomeCard>

          {/* 02 RESUME COACH */}
          <HomeCard active={activeCard === 'resume'} onClick={() => router.push('/resume-coach')} num="02">
            {(lit) => (
              <>
                <span style={{ ...SP.base, ...(rcStatus === 'not-started' ? SP.start : rcStatus === 'in-progress' ? SP.prog : SP.done) }}>
                  {rcStatus === 'not-started' ? 'Not Started' : rcStatus === 'in-progress' ? 'In Progress' : 'Completed'}
                </span>
                <div className="hp-card-title" style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 20, color: '#0D0D0D', letterSpacing: '-0.5px', lineHeight: 1.1, marginBottom: 10 }}>Resume Coach</div>
                <p style={{ fontSize: 13, color: '#9ca3af', lineHeight: 1.6, flex: 1 }}>Most AI tools only work with what's on the page. Hire Power asks what's missing, just like a $500 résumé writer would. Free tells you what's wrong. Pro fixes it for you.</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: lit ? '#9333ea' : '#7c3aed', transition: 'color 0.15s' }}>{rcCta}</span>
                  <span style={{ fontSize: 14, color: lit ? '#9333ea' : '#7c3aed', transition: 'color 0.15s, transform 0.15s', display: 'inline-block', transform: lit ? 'translateX(4px)' : 'none' }}>→</span>
                </div>
              </>
            )}
          </HomeCard>

          {/* 03 INTERVIEW COACH */}
          <HomeCard active={activeCard === 'interview'} onClick={() => router.push('/interview-coach')} num="03">
            {(lit) => (
              <>
                <span style={{ ...SP.base, ...SP.start }}>Not Started</span>
                <div className="hp-card-title" style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 20, color: '#0D0D0D', letterSpacing: '-0.5px', lineHeight: 1.1, marginBottom: 10 }}>Interview Coach</div>
                <p style={{ fontSize: 13, color: '#9ca3af', lineHeight: 1.6, flex: 1 }}>AI-spoken practice that mimics a real interview using your resume and the job description. Get coaching on how to present your experience for each specific job.</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: lit ? '#9333ea' : '#7c3aed', transition: 'color 0.15s' }}>{icCta}</span>
                  <span style={{ fontSize: 14, color: lit ? '#9333ea' : '#7c3aed', transition: 'color 0.15s, transform 0.15s', display: 'inline-block', transform: lit ? 'translateX(4px)' : 'none' }}>→</span>
                </div>
              </>
            )}
          </HomeCard>

          {/* 04 JOB TRACKER / CAREER VAULT */}
          <HomeCard
            active={activeCard === 'tracker'}
            onClick={() => router.push(c4path)}
            num="04"
            numColor={isVaultTier ? '#ddd6fe' : '#bbf7d0'}
          >
            {(lit) => (
              <>
                <span style={{ ...SP.base, ...(applicationCount > 0 ? SP.prog : SP.start) }}>
                  {applicationCount > 0 ? `${applicationCount} Application${applicationCount !== 1 ? 's' : ''}` : 'Not Started'}
                </span>
                <div className="hp-card-title" style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 20, color: '#0D0D0D', letterSpacing: '-0.5px', lineHeight: 1.1, marginBottom: 10 }}>{c4label}</div>
                <p style={{ fontSize: 13, color: '#9ca3af', lineHeight: 1.6, flex: 1 }}>{c4desc}</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(0,0,0,0.05)', borderRight: 'none' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: lit ? '#9333ea' : '#7c3aed', transition: 'color 0.15s' }}>{c4cta}</span>
                  <span style={{ fontSize: 14, color: lit ? '#9333ea' : '#7c3aed', transition: 'color 0.15s, transform 0.15s', display: 'inline-block', transform: lit ? 'translateX(4px)' : 'none' }}>→</span>
                </div>
              </>
            )}
          </HomeCard>

        </div>
      </div>

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