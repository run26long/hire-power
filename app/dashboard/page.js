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
      <div style={{
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

  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    if (code) { setShowLoginModal(true); setLoginView('reset'); }
  }, [searchParams]);

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); setShowLoginModal(true); return; }
      setUser(user);

      const { data: profile } = await supabase
        .from('profiles').select('*').eq('id', user.id).single();
      setUserProfile(profile);

      // New user → Career Coach
      const createdAt = new Date(user.created_at);
      if ((Date.now() - createdAt.getTime()) < 30000) {
        router.push('/career-coach');
        return;
      }

      const { data: resumes } = await supabase
        .from('resumes').select('*').eq('user_id', user.id)
        .eq('resume_type', 'core')
        .order('updated_at', { ascending: false }).limit(1);
      if (resumes && resumes.length > 0) setCoreResume(resumes[0]);

      setLoading(false);

      if (searchParams.get('cancelled') === 'true') {
        setToast("Your subscription has been cancelled. You'll keep access until the end of your current billing period.");
        window.history.replaceState({}, '', '/dashboard');
      }
    }
    loadData();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true); setLoginError('');
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
    setLoginLoading(false);
    if (signInError) {
      setLoginError(signInError.message.includes('Invalid login credentials') || signInError.message.includes('Email not confirmed') ? 'account_not_found' : signInError.message);
      return;
    }
    if (data.user) { setShowLoginModal(false); window.location.href = '/dashboard'; }
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
    if (resetPassword.length < 6) { setResetError('Password must be at least 6 characters.'); return; }
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
    ? "Log a win in 30 seconds. Three years from now you won't remember what you accomplished today. Your Vault will — and your next resume starts here."
    : 'Every application gets one card — your tailored resume, cover letter, interview practice, and status. Hired cards feed your next search.';
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
                  {loginError === 'account_not_found' ? (
                    <div className="bg-blue-50 border border-blue-200 text-blue-700 px-3 py-2 rounded text-sm mb-4">
                      No account found. <button onClick={() => router.push('/landing')} className="font-semibold underline">Sign up free →</button>
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
                      <input type="password" required value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                        placeholder="Your password" />
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
                        <input type="password" required value={resetPassword} onChange={e => setResetPassword(e.target.value)}
                          className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                          placeholder="Min. 6 characters" minLength={6} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
                        <input type="password" required value={resetConfirm} onChange={e => setResetConfirm(e.target.value)}
                          className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                          placeholder="Same password again" />
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
      <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', height: 'calc(100vh - 56px)', fontFamily: "'DM Sans', sans-serif", background: '#f7f6ff', overflow: 'hidden' }}>

       {/* HERO */}
        <div style={{ borderBottom: '1px solid rgba(0,0,0,0.06)', background: 'white', flexShrink: 0 }}>
          <div style={{ padding: '4px 56px 0', textAlign: 'right', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9333ea', opacity: 0.65 }}>
            {firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
          </div>
          <div style={{ padding: '32px 56px 0', display: 'grid', gridTemplateColumns: 'calc(50vw - 56px) 1fr', gap: 0, alignItems: 'end' }}>
            <div style={{ paddingBottom: 20, paddingRight: 48 }}>
              <h1 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, lineHeight: 1.0 }}>
                <span style={{ fontSize: 'clamp(32px,3.2vw,46px)', color: '#0D0D0D', display: 'block', marginBottom: 2, letterSpacing: '-2px' }}>One platform.</span>
                <em style={{ fontStyle: 'italic', color: '#9333ea', fontSize: 'clamp(52px,5.2vw,76px)', letterSpacing: '-3.5px' }}>Your whole career.</em>
              </h1>
            </div>
            <div style={{ paddingBottom: 32 }}>
              <div style={{ background: 'rgba(147,51,234,0.05)', borderRadius: '0 12px 12px 0', padding: '16px 20px', borderLeft: '3px solid rgba(147,51,234,0.45)' }}>
                <p style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontStyle: 'italic', fontSize: 'clamp(16px,1.5vw,18px)', color: '#0D0D0D', lineHeight: 1.25, letterSpacing: '-0.3px', marginBottom: 6 }}>
                  Most tools help you find a job. Hire Power helps you build a career.
                </p>
                <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.25 }}>
                  Stay ready for any opportunity, and never start from scratch again.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CARDS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', overflow: 'hidden' }}>

          {/* 01 CAREER COACH */}
          <HomeCard active={activeCard === 'career'} onClick={() => router.push('/career-coach')} num="01">
            {(lit) => (
              <>
                <span style={{ ...SP.base, ...SP.free }}>Free · Unlimited</span>
                <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 20, color: '#0D0D0D', letterSpacing: '-0.5px', lineHeight: 1.1, marginBottom: 10 }}>Career Coach</div>
                <p style={{ fontSize: 13, color: '#9ca3af', lineHeight: 1.6, flex: 1 }}>Set your direction before we touch your resume. Same field, new field, or figuring it out — five minutes that shape everything that follows.</p>
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
                <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 20, color: '#0D0D0D', letterSpacing: '-0.5px', lineHeight: 1.1, marginBottom: 10 }}>Resume Coach</div>
                <p style={{ fontSize: 13, color: '#9ca3af', lineHeight: 1.6, flex: 1 }}>We ask the questions a $500 resume writer would ask. Your achievements extracted, your bullets rewritten — done for you in under two minutes.</p>
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
                <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 20, color: '#0D0D0D', letterSpacing: '-0.5px', lineHeight: 1.1, marginBottom: 10 }}>Interview Coach</div>
                <p style={{ fontSize: 13, color: '#9ca3af', lineHeight: 1.6, flex: 1 }}>The first time you answer an interview question shouldn't be in the interview. Your Coach knows your resume and prepares you for the specific role.</p>
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
                <span style={{ ...SP.base, ...SP.start }}>Not Started</span>
                <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: 20, color: '#0D0D0D', letterSpacing: '-0.5px', lineHeight: 1.1, marginBottom: 10 }}>{c4label}</div>
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