'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import MainNav from '../components/MainNav';
import ErrorToast from '../components/ErrorToast';

function DashboardContent() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [careerContext, setCareerContext] = useState(null);
  const [coreResume, setCoreResume] = useState(null);
  const [jobResumes, setJobResumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginView, setLoginView] = useState('login'); // 'login' | 'forgot' | 'reset'
  const [resetEmail, setResetEmail] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); setShowLoginModal(true); return; }
      setUser(user);

      const { data: profile } = await supabase
        .from('profiles').select('*').eq('id', user.id).single();
      setUserProfile(profile);

      // First-time user routing
      const createdAt = new Date(user.created_at);
      const isNewUser = (Date.now() - createdAt.getTime()) < 30000; // within 30 seconds
      if (isNewUser) {
        router.push('/career-coach');
        return;
      }

      const { data: context } = await supabase
        .from('career_context').select('*').eq('user_id', user.id).maybeSingle();
      setCareerContext(context);

      const { data: resumes } = await supabase
        .from('resumes').select('*').eq('user_id', user.id)
        .eq('resume_type', 'core')
        .order('updated_at', { ascending: false }).limit(1);
      if (resumes && resumes.length > 0) setCoreResume(resumes[0]);

      const { data: jsResumes } = await supabase
        .from('resumes').select('*').eq('user_id', user.id)
        .eq('resume_type', 'job_specific')
        .order('updated_at', { ascending: false }).limit(3);
      if (jsResumes) setJobResumes(jsResumes);

      setLoading(false);
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('cancelled') === 'true') {
        setToast("Your subscription has been cancelled. You'll keep access until the end of your current billing period.");
        window.history.replaceState({}, '', '/dashboard');
      }
    }
    loadData();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });

    setLoginLoading(false);

    if (signInError) {
      if (signInError.message.includes('Invalid login credentials') ||
          signInError.message.includes('Email not confirmed')) {
        setLoginError('account_not_found');
      } else {
        setLoginError(signInError.message);
      }
      return;
    }

    if (data.user) {
      setShowLoginModal(false);
      window.location.href = '/dashboard';
    }
  };
const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      setShowLoginModal(true);
      setLoginView('reset');
    }
  }, [searchParams]);

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setResetLoading(true);
    setResetError('');
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/dashboard`,
    });
    setResetLoading(false);
    if (error) {
      setResetError(error.message);
    } else {
      setResetSuccess(true);
      setTimeout(() => {
        setShowLoginModal(false);
        setResetSuccess(false);
        setLoginView('login');
      }, 3000);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (resetPassword !== resetConfirm) {
      setResetError('Passwords do not match.');
      return;
    }
    if (resetPassword.length < 6) {
      setResetError('Password must be at least 6 characters.');
      return;
    }
    setResetLoading(true);
    setResetError('');
    const { error } = await supabase.auth.updateUser({ password: resetPassword });
    setResetLoading(false);
    if (error) {
      setResetError(error.message);
    } else {
      setResetSuccess(true);
      setTimeout(() => {
        setShowLoginModal(false);
        window.location.href = '/dashboard';
      }, 2000);
    }
  };
  const journeyStep = coreResume?.journey_step || null;
  const hasCareer = !!careerContext;
  const hasResume = !!coreResume;
  const tier = userProfile?.subscription_tier;
  const isPro = tier === 'pro';
 const isVaultTier = tier === 'vault' || tier === 'maintenance' || (tier === 'pro' && userProfile?.search_status === 'hired');

  function StatusPill({ status }) {
    const map = {
      'Start Here':  { bg: '#f3f4f6', border: '#d1d5db', color: '#6b7280' },
      'Not Started': { bg: '#f3f4f6', border: '#d1d5db', color: '#6b7280' },
      'In Progress': { bg: '#fffbeb', border: '#fcd34d', color: '#92400e' },
      'Completed':   { bg: '#f0fdf4', border: '#86efac', color: '#166534' },
    };
    const s = map[status] || map['Not Started'];
    return (
      <span style={{
        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
        background: s.bg, border: `1.5px solid ${s.border}`, color: s.color,
        letterSpacing: '0.02em',
      }}>
        {status}
      </span>
    );
  }

  const careerStatus = hasCareer ? 'Completed' : 'Start Here';
  const resumeStatus = !hasResume ? 'Not Started' : coreResume?.completed_at ? 'Completed' : 'In Progress';
  const interviewStatus = 'Not Started';
  const vaultStatus = 'Not Started';

  function getCareerAdaptiveCopy() {
    if (!careerContext) return null;
    if (careerContext.is_career_changer) {
      const from = careerContext.previous_field || 'your background';
      const to = careerContext.target_roles?.length > 0 ? careerContext.target_roles[0] : 'your target role';
      return `We'll reframe your ${from} experience to speak directly to ${to} opportunities.`;
    }
    return "We'll position you to move up — not just move on.";
  }

  function getResumeNextStep() {
    if (!hasResume) return { title: 'Start here.', body: 'Upload your resume to get your baseline Power Score and see exactly what needs to improve.' };
    if (coreResume?.completed_at) return { title: 'Ready to interview.', body: 'Your resume is done. Head to Interview Coach — it already knows your resume, your strengths, and your gaps.' };
    const map = {
      review:  { title: 'First things first.', body: "Give it a quick review to make sure everything parsed correctly — then we'll get your baseline score." },
      assess:  { title: 'Get your baseline.', body: "Your Resume Power Score tells you exactly what's working and what's not — specific to your experience." },
      coach:   { title: 'Keep going.', body: isPro ? "Let's surface the achievements, numbers, and skills that are missing." : "Get a taste of what coaching can do. One job, one real conversation — then you decide." },
      improve: { title: 'Review your wins.', body: isPro ? "Review each improvement your coach made, then keep, edit, or reject each one." : "Review the suggestions and make your edits directly on the resume." },
      format:  { title: 'Almost there.', body: "Make any final edits before locking it in." },
      save:    { title: 'Final step.', body: isPro ? "Download it, then build job-specific versions on top of this foundation." : "Download it now — and when you're ready, upload a job description to see how well it matches." },
    };
    return map[journeyStep] || { title: 'Keep going.', body: 'Pick up where you left off.' };
  }

  const resumeNext = getResumeNextStep();

  const sidebarSteps = [
    { num: '01', label: 'Career Coach',    sub: 'Clarify your direction — same field, new field, or somewhere in between.', path: '/career-coach'     },
    { num: '02', label: 'Résumé Coach',    sub: 'Uncover the achievements and skills that never made it to the page.',      path: '/resume-coach'    },
    { num: '03', label: 'Interview Coach', sub: 'Learn how to explain your experience with confidence.',                     path: '/interview-coach' },
    isVaultTier
      ? { num: '04', label: 'Career Vault',  sub: 'Capture your wins as they happen — never start from scratch again!', path: '/career-vault' }
      : { num: '04', label: 'Job Tracker',   sub: 'Track every application. One card per job. Nothing slips.',          path: '/job-tracker'  },
  ];

  const labelStyle = { fontSize: 11, fontWeight: 900, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' };
  const valueStyle = { fontSize: 12, fontWeight: 500, color: '#1a1a2e', lineHeight: 1.3, marginTop: 2 };
  const numStyle = { fontSize: 13, fontWeight: 900, color: '#a78bfa', marginRight: 6 };

  const nextStepStyle = {
    background: 'linear-gradient(150deg,#f5f3ff 0%,#ede9fe 100%)',
    border: '1px solid #ddd6fe',
    borderRadius: 12,
    padding: '14px 16px',
    display: 'flex', flexDirection: 'column', flex: 1,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-purple-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">

{/* LOGIN MODAL */}
      {showLoginModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{backgroundColor:'rgba(0,0,0,0.5)'}}
        >
          <div
            className="bg-white shadow-2xl w-full overflow-hidden"
            style={{maxWidth:'420px',borderRadius:'12px'}}
          >
            {/* Header */}
            <div
             style={{background:'linear-gradient(to bottom right, #667eea, #764ba2)'}}
              className="px-6 py-5"
            >
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
                    {loginView === 'reset' && 'Make it something you\'ll remember.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-5">

              {/* LOGIN VIEW */}
              {loginView === 'login' && (
                <>
                  {loginError === 'account_not_found' ? (
                    <div className="bg-blue-50 border border-blue-200 text-blue-700 px-3 py-2 rounded text-sm mb-4">
                      👋 No account found. <button onClick={() => router.push('/landing')} className="font-semibold underline">Sign up free →</button>
                    </div>
                  ) : loginError ? (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm mb-4">
                      {loginError}
                    </div>
                  ) : null}
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
                      <input
                        type="email"
                        required
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                        placeholder="you@example.com"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                      <input
                        type="password"
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                        placeholder="Your password"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loginLoading}
                      className="block mx-auto py-2 px-8 rounded-md text-sm font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
                      style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
                    >
                      {loginLoading ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"/>
                          Logging in...
                        </span>
                      ) : 'Log in'}
                    </button>
                  </form>
                  <div className="flex items-center justify-between mt-4">
                    <button
                      onClick={() => { setLoginView('forgot'); setResetError(''); setResetSuccess(false); }}
                      className="text-xs text-purple-600 hover:underline bg-transparent border-none cursor-pointer"
                    >
                      Forgot password?
                    </button>
                    <button onClick={() => router.push('/landing?signup=true')} className="text-xs text-gray-400 hover:underline bg-transparent border-none cursor-pointer">
                      Sign up free
                    </button>
                  </div>
                </>
              )}

              {/* FORGOT PASSWORD VIEW */}
              {loginView === 'forgot' && (
                <>
                  {resetSuccess ? (
                    <div className="text-center py-4">
                      <div className="text-4xl mb-3">📧</div>
                      <p className="font-semibold text-gray-900 mb-2">Check your email!</p>
                      <p className="text-sm text-gray-600">Click the reset link and you'll be brought back here to choose a new password.</p>
                    </div>
                  ) : (
                    <>
                      {resetError && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm mb-4">{resetError}</div>
                      )}
                      <form onSubmit={handleForgotPassword} className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
                          <input
                            type="email"
                            required
                            value={resetEmail}
                            onChange={(e) => setResetEmail(e.target.value)}
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                            placeholder="you@example.com"
                            autoFocus
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={resetLoading}
                          className="block mx-auto py-2 px-8 rounded-md text-sm font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
                      style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
                        >
                          {resetLoading ? 'Sending...' : 'Send reset link'}
                        </button>
                      </form>
                      <button
                        onClick={() => setLoginView('login')}
                        className="w-full text-center text-xs text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer mt-4"
                      >
                        ← Back to log in
                      </button>
                    </>
                  )}
                </>
              )}

              {/* RESET PASSWORD VIEW */}
              {loginView === 'reset' && (
                <>
                  {resetSuccess ? (
                    <div className="text-center py-4">
                      <div className="text-4xl mb-3">✅</div>
                      <p className="font-semibold text-gray-900 mb-2">Password updated!</p>
                      <p className="text-sm text-gray-600">Taking you to your dashboard...</p>
                    </div>
                  ) : (
                    <>
                      {resetError && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm mb-4">{resetError}</div>
                      )}
                      <form onSubmit={handleResetPassword} className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
                          <input
                            type="password"
                            required
                            value={resetPassword}
                            onChange={(e) => setResetPassword(e.target.value)}
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                            placeholder="Min. 6 characters"
                            minLength={6}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
                          <input
                            type="password"
                            required
                            value={resetConfirm}
                            onChange={(e) => setResetConfirm(e.target.value)}
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                            placeholder="Same password again"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={resetLoading}
                          className="block mx-auto py-2 px-8 rounded-md text-sm font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
                      style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
                        >
                          {resetLoading ? 'Updating...' : 'Update password'}
                        </button>
                      </form>
                    </>
                  )}
                </>
              )}

            </div>
          </div>
        </div>
      )}

      {/* SIDEBAR */}
      <div
        className="w-64 text-white flex-col fixed left-0 top-0 shadow-lg z-40 hidden md:flex"
        style={{ background: 'linear-gradient(180deg, #667eea 0%, #764ba2 100%)', height: '100vh', overflowY: 'hidden' }}
      >
        <div className="px-6 pt-6 pb-4 flex-shrink-0">
          <h1 className="text-[28px] font-bold mb-1.5 whitespace-nowrap tracking-tight">Dashboard</h1>
          <p className="text-[13px] text-white text-opacity-95 leading-tight tracking-tight mb-0.5">Job hunting is small talk.</p>
          <p className="text-[13px] text-white text-opacity-95 leading-tight tracking-tight">Your career deserves a conversation.</p>
          <div className="mt-4 border-b border-gray-400 border-opacity-10"></div>
        </div>

        <div className="flex-1 px-6 pt-3 pb-6 flex flex-col justify-between">
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#fff', lineHeight: 1.3, marginBottom: 6, marginTop: -4 }}>
              AI-powered coaching for people who want more than their next job.
            </p>
            <p style={{ fontSize: 12, fontWeight: 400, color: 'rgba(255,255,255,0.8)', lineHeight: 1.3, marginBottom: 12 }}>
              Building your career, one conversation at a time.
            </p>
            <div className="mb-4">
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
                {sidebarSteps.map((item) => (
                  <li key={item.num} onClick={() => item.path && router.push(item.path)}
                    style={{ cursor: item.path ? 'pointer' : 'default', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ width: 18, height: 22, borderRadius: 5, background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 900, color: '#fff', flexShrink: 0, marginTop: 1 }}>
                      {item.num}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>{item.label}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', lineHeight: 1.3, marginTop: 1 }}>{item.sub}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginBottom: 4, marginTop: 32 }}>Hire Power isn't just for this job search.</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)', lineHeight: 1.4 }}>
              It's the operating system for your career — tracking your growth and capturing your wins so you're always ready when your next opportunity appears.
            </p>
          </div>
          <div className="mt-auto">
            <div className="mb-3 border-b border-gray-400 border-opacity-10"></div>
            <div className="flex items-center gap-2.5 text-white">
              <img src="/images/Hire_Power_icon.png" alt="Lightning" className="h-5 w-auto flex-shrink-0" />
              <p className="text-sm font-medium leading-tight">Your lifelong career coach</p>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="md:ml-64 flex flex-col min-h-screen">
        <MainNav currentPage="dashboard" userProfile={userProfile} />

        {/* MOBILE HERO — hidden on desktop */}
        <div
          className="md:hidden w-full text-white"
          style={{ background: 'linear-gradient(180deg, #667eea 0%, #764ba2 100%)', padding: '24px 24px 20px' }}
        >
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#fff', marginBottom: 6, letterSpacing: '-0.3px', lineHeight: 1.1 }}>Dashboard</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.95)', lineHeight: 1.3, marginBottom: 16 }}>Job hunting is small talk. Your career deserves a conversation.</p>
          <div style={{ borderBottom: '1px solid rgba(180,180,180,0.15)', marginBottom: 16 }} />
          <p style={{ fontSize: 14, fontWeight: 400, color: 'rgba(255,255,255,0.8)', lineHeight: 1.3 }}>
            Building your career, one conversation at a time.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-4 md:px-8 py-1.5 max-w-[1400px] mx-auto w-full">

            {/* ROW 1 */}
            <div className="dash-row-1 grid gap-2 mb-2" style={{ gridTemplateColumns: '1fr 2.2fr' }}>

              {/* ① CAREER COACH */}
              <div
                className="bg-white border border-gray-300 rounded-2xl overflow-hidden flex flex-col shadow-sm hover:border-purple-300 hover:shadow-md transition-all cursor-pointer"
                onClick={() => router.push('/career-coach')}
              >
                <div className="p-2.5 pb-2 flex flex-col flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <div className="text-xl font-bold text-gray-900 tracking-tight">
                      <span style={numStyle}>01</span>Career Coach
                    </div>
                    <span className="ml-auto"><StatusPill status={careerStatus} /></span>
                  </div>
                  <div className="text-[13px] font-normal text-purple-600 mb-2">Point your job search in the right direction.</div>

                  {/* Quote box — always shown */}
                  <div className="rounded-xl p-2.5 mb-2" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.04), rgba(99,102,241,0.04))', border: '1.5px solid rgba(124,58,237,0.12)' }}>
                    <p className="text-[12px] font-bold italic text-gray-900 leading-snug mb-1" style={{ letterSpacing: '-0.03em' }}>
                      "The most valuable 5 minutes of your job search."
                    </p>
                    <p className="text-[11px] text-gray-500 leading-tight" style={{ letterSpacing: '-0.02em' }}>
                      Most tools optimize for where you've been. Career Coach starts with where you're going.
                    </p>
                  </div>

                  {hasCareer ? (
                    <>
                      <div className="flex flex-col gap-0.5 mb-1.5">
                        {[
                          careerContext?.target_roles?.length > 0
                            ? `Targeting: ${careerContext.target_roles.slice(0, 2).join(' · ')}`
                            : 'Direction set',
                          careerContext?.timeline
                            ? `Timeline: ${careerContext.timeline.replace(/_/g, ' ')}`
                            : 'Timeline set',
                          careerContext?.is_career_changer
                            ? 'Career change: experience reframed for target roles'
                            : 'Same-field advancement mapped',
                        ].map((item, i) => (
  <div key={i} className="flex items-center gap-1.5 px-2 py-0.5 bg-gray-50 border border-gray-200 rounded-lg">
    <div className="w-1.5 h-1.5 rounded-full bg-purple-600 flex-shrink-0"></div>
    <span className="text-[11px] text-gray-600">{item}</span>
  </div>
                        ))}
                      </div>
                      {getCareerAdaptiveCopy() && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 4 }}>
                          <img src="/images/Hire_Power_icon_2.png" alt="" style={{ height: 22, width: 'auto', flexShrink: 0 }} />
                          <p style={{ fontSize: 11, fontWeight: 500, color: '#7c3aed', lineHeight: 1.35, marginBottom: 0 }}>
                            {getCareerAdaptiveCopy()}
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex flex-col gap-1 mb-1.5">
                        {['Direction set', 'Target roles identified', 'Experience connected to your goals'].map((item, i) => (
                          <div key={i} className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg" style={{ opacity: 0.4 }}>
                            <div className="w-1.5 h-1.5 rounded-full bg-purple-600 flex-shrink-0"></div>
                            <span className="text-[11px] text-gray-500">{item}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* ② RESUME COACH — two columns: value prop + next step */}
              <div
                className="bg-white border border-gray-300 rounded-2xl overflow-hidden flex flex-col shadow-sm hover:border-purple-300 hover:shadow-md transition-all cursor-pointer"
                onClick={() => router.push('/resume-coach')}
              >
                <div className="p-2.5 flex flex-col flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <div className="text-xl font-bold text-gray-900 tracking-tight">
                      <span style={numStyle}>02</span>Resume Coach
                    </div>
                    <span className="ml-auto"><StatusPill status={resumeStatus} /></span>
                  </div>
                  <div className="text-[13px] font-normal text-purple-600 mb-3">
                    Uncover the achievements and skills that never made it to the page.
                  </div>

                  <div className="dash-col-inner grid grid-cols-2 gap-3 flex-1">
                    {/* Left: what it does */}
                    <div style={{ background: '#faf9ff', border: '1px solid #ede9fe', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {isPro ? (
                        <>
                          {[
                            { label: 'Not a form.', body: 'A conversation. The same questions a $500 resume writer would ask.' },
                            { label: 'Not generation.', body: 'Extraction. We surface your real achievements, then make sure they make it to the page.' },
                            { label: 'Not suggestions.', body: 'Improvements. No figuring out what to add where. We do it for you in under 2 minutes.' },
                            { label: 'Not one-time.', body: 'Forever. Every job version builds on this foundation. Never start from scratch again.' },
                          ].map(({ label, body }) => (
                            <div key={label} style={{ fontSize: 11, lineHeight: 1.2 }}>
                              <span style={{ fontWeight: 800, color: '#5b21b6' }}>{label}</span>
                              {' '}<span style={{ fontWeight: 400, color: '#6b7280' }}>{body}</span>
                            </div>
                          ))}
                        </>
                      ) : isVaultTier ? (
                        <>
                          {[
                            { label: 'Core resume on file.', body: 'Your resume is saved and downloadable anytime.' },
                            { label: 'Unlimited downloads.', body: 'All templates available, no restrictions.' },
                            { label: 'Job tracking.', body: 'Keep your application history in one place between searches.' },
                          ].map(({ label, body }) => (
                            <div key={label} style={{ fontSize: 11, lineHeight: 1.4 }}>
                              <span style={{ fontWeight: 800, color: '#5b21b6' }}>{label}</span>
                              {' '}<span style={{ fontWeight: 400, color: '#6b7280' }}>{body}</span>
                            </div>
                          ))}
                        </>
                      ) : (
                        <>
                          {[
                            { label: 'Core resume.', body: 'AI analysis, Resume Power Score, and a detailed Action Plan to guide you through making improvements.' },
                            { label: 'Coaching trial.', body: 'One job, one conversation, one bullet rewritten. See how the coaching process makes the changes for you' },
                            { label: 'Job match and cover letters.', body: '3 job match scores and 3 custom cover letters included.' },
                          ].map(({ label, body }) => (
                            <div key={label} style={{ fontSize: 11, lineHeight: 1.4 }}>
                              <span style={{ fontWeight: 800, color: '#5b21b6' }}>{label}</span>
                              {' '}<span style={{ fontWeight: 400, color: '#6b7280' }}>{body}</span>
                            </div>
                          ))}
                        </>
                      )}
                    </div>

                    {/* Right: next step */}
                    <div style={nextStepStyle}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Next Step</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#5b21b6', marginBottom: 6, lineHeight: 1.25 }}>
                        {resumeNext.title}
                      </div>
                      <div style={{ fontSize: 12, color: '#4c1d95', lineHeight: 1.45, fontWeight: 400 }}>
                        {resumeNext.body}
                      </div>
                      {hasResume && !coreResume?.completed_at && journeyStep && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 'auto', paddingTop: 12 }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#7c3aed', flexShrink: 0, animation: 'hp-pulse 1.8s ease-in-out infinite' }} />
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#5b21b6' }}>{journeyStep} step</span>
                        </div>
                      )}
                      {coreResume?.completed_at && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 'auto', paddingTop: 12, padding: '4px 10px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #86efac', alignSelf: 'flex-start' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#166534' }}>✓ Complete</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <style>{`
          @keyframes hp-pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
          @media (max-width: 768px) {
            .dash-row-1, .dash-row-2 { grid-template-columns: 1fr !important; }
            .dash-col-inner { grid-template-columns: 1fr !important; }
          }
        `}</style>
              </div>
            </div>

            {/* ROW 2 */}
            <div className="dash-row-2 grid gap-2" style={{ gridTemplateColumns: '2.2fr 1fr' }}>

              {/* ③ INTERVIEW COACH — two columns: power concepts + next step */}
              <div
                className="bg-white border border-gray-300 rounded-2xl overflow-hidden flex flex-col shadow-sm cursor-pointer hover:border-purple-300 hover:shadow-md transition-all"
                onClick={() => window.location.href = '/interview-coach'}
              >
                <div className="p-3 flex flex-col flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <div className="text-xl font-bold text-gray-900 tracking-tight">
                      <span style={numStyle}>03</span>Interview Coach
                    </div>
                    <span className="ml-auto"><StatusPill status={interviewStatus} /></span>
                  </div>
                  <div className="text-[13px] font-normal text-purple-600 mb-3">
                    The first time you answer an interview question shouldn't be in the interview.
                  </div>

                  <div className="dash-col-inner grid grid-cols-2 gap-3 flex-1">
                    {/* Left: power analysis concepts */}
                    <div style={{ background: '#faf9ff', border: '1px solid #ede9fe', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {isPro ? (
                        <>
                          <div style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', lineHeight: 1.4, paddingBottom: 6, borderBottom: '1px solid #ede9fe' }}>Learn how to tell your strongest story for each specific job. Your Interview Coach will prepare you to discuss:</div>
                          {[
                            { label: 'Core Power.', color: '#15803d', body: 'The strengths you already have that directly match the job.' },
                            { label: 'Hidden Power.', color: '#92400e', body: "Transferable skills you didn't know you had, until we ask the right questions." },
                            { label: 'Power Gaps.', color: '#b91c1c', body: "What's missing, and exactly how to address it without apologizing." },
                          ].map(({ label, color, body }) => (
                            <div key={label} style={{ fontSize: 11, lineHeight: 1.4 }}>
                              <span style={{ fontWeight: 800, color }}>{label}</span>
                              {' '}<span style={{ fontWeight: 400, color: '#6b7280' }}>{body}</span>
                            </div>
                          ))}
                        </>
                      ) : isVaultTier ? (
                        <>
                          <div style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', lineHeight: 1.4, paddingBottom: 6, borderBottom: '1px solid #ede9fe' }}>What you get:</div>
                          {[
                            { label: 'General practice.', color: '#15803d', body: 'Unlimited AI-spoken interview practice with common questions, anytime.' },
                            { label: 'Stay sharp.', color: '#92400e', body: 'Keep your interview instincts fresh between job searches.' },
                            { label: 'Ready when you are.', color: '#7c3aed', body: 'Upgrade to Pro when your next search starts to unlock job-specific coaching.' },
                          ].map(({ label, color, body }) => (
                            <div key={label} style={{ fontSize: 11, lineHeight: 1.4 }}>
                              <span style={{ fontWeight: 800, color }}>{label}</span>
                              {' '}<span style={{ fontWeight: 400, color: '#6b7280' }}>{body}</span>
                            </div>
                          ))}
                        </>
                      ) : (
                        <>
                          <div style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', lineHeight: 1.4, paddingBottom: 6, borderBottom: '1px solid #ede9fe' }}>What you get:</div>
                          {[
                            { label: 'Unlimited general practice.', color: '#15803d', body: 'AI-spoken interview questions anytime, no job description needed.' },
                            { label: 'One job-specific session.', color: '#92400e', body: 'Upload a job description and practice with questions built from your resume and the role.' },
                            { label: 'Power Analysis reveal.', color: '#7c3aed', body: 'After your job-specific session, see your Core Power, Hidden Power, and Power Gaps.' },
                          ].map(({ label, color, body }) => (
                            <div key={label} style={{ fontSize: 11, lineHeight: 1.4 }}>
                              <span style={{ fontWeight: 800, color }}>{label}</span>
                              {' '}<span style={{ fontWeight: 400, color: '#6b7280' }}>{body}</span>
                            </div>
                          ))}
                        </>
                      )}
                    </div>

                    {/* Right: next step */}
                    <div style={nextStepStyle}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Next Step</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#5b21b6', marginBottom: 6, lineHeight: 1.25 }}>
                        Practice before it counts.
                      </div>
                      <div style={{ fontSize: 12, color: '#4c1d95', lineHeight: 1.45, fontWeight: 400 }}>
                        {isVaultTier
                          ? "Jump into general practice anytime. Stay sharp between searches."
                          : !coreResume?.completed_at
                          ? "Finish your resume first. Interview Coach uses it to tailor questions to your experience and the job you're targeting."
                          : isPro
                          ? "Upload a job description and your Interview Coach builds questions from your actual resume and the role."
                          : "You get one job-specific session with a Power Analysis reveal after. Unlimited general practice anytime."}
                      </div>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 'auto', paddingTop: 12 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#d1d5db', flexShrink: 0 }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af' }}>Not started</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ④ JOB TRACKER (Pro/Free) or CAREER VAULT (Vault tier) */}
              {isVaultTier ? (
                <div className="bg-white border border-gray-300 rounded-2xl overflow-hidden flex flex-col shadow-sm hover:border-purple-300 hover:shadow-md transition-all cursor-pointer" onClick={() => router.push('/career-vault')}>
                  <div className="p-3 flex flex-col flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <div className="text-xl font-bold text-gray-900 tracking-tight">
                        <span style={numStyle}>04</span>Career Vault
                      </div>
                      <span className="ml-auto"><StatusPill status={vaultStatus} /></span>
                    </div>
                    <div className="text-[13px] font-normal text-purple-600 mb-2">Track your wins before you forget them.</div>
                    <div className="rounded-xl p-2.5 mb-2" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.04), rgba(99,102,241,0.04))', border: '1.5px solid rgba(124,58,237,0.12)' }}>
                      <p className="text-[12px] font-bold italic text-gray-900 leading-snug mb-1" style={{ letterSpacing: '-0.03em' }}>
                        "Three years from now, you won't remember what you accomplished today."
                      </p>
                      <p className="text-[11px] text-gray-500 leading-tight" style={{ letterSpacing: '-0.02em' }}>
                        Keep building your career archive between job searches. When opportunity knocks, you'll be ready.
                      </p>
                    </div>
                    <div className="flex flex-col gap-1.5 mb-2.5">
                      {['Led Q3 launch across 3 teams', 'Promoted to Senior in 18 months', 'Cut onboarding from 3 weeks to 5 days'].map((win, i) => (
                        <div key={i} className="flex items-center gap-1.5 px-2 py-0.5 bg-gray-50 border border-gray-200 rounded-lg" style={{ opacity: 0.4 }}>
                          <div className="w-1.5 h-1.5 rounded-full bg-purple-600 flex-shrink-0"></div>
                          <span className="text-[11px] text-gray-500">{win}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-[12px] text-gray-500 leading-tight" style={{ letterSpacing: '-0.01em' }}>
                      Your career OS, running in the background between searches.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-white border border-gray-300 rounded-2xl overflow-hidden flex flex-col shadow-sm hover:border-purple-300 hover:shadow-md transition-all cursor-pointer" onClick={() => router.push('/job-tracker')}>
                  <div className="p-3 flex flex-col flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <div className="text-xl font-bold text-gray-900 tracking-tight">
                        <span style={numStyle}>04</span>Job Tracker
                      </div>
                      <span className="ml-auto"><StatusPill status="Not Started" /></span>
                    </div>
                    <div className="text-[13px] font-normal text-purple-600 mb-2">Every application. One place. Nothing gets missed.</div>

                    <div className="rounded-xl p-2.5 mb-2" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.04), rgba(99,102,241,0.04))', border: '1.5px solid rgba(124,58,237,0.12)' }}>
                      <p className="text-[12px] font-bold italic text-gray-900 leading-snug" style={{ letterSpacing: '-0.03em' }}>
                        "Most people track jobs in a spreadsheet, a notes app, and their memory. Something always gets forgotten."
                      </p>
                      <p className="text-[11px] text-gray-500 leading-tight mt-1" style={{ letterSpacing: '-0.02em' }}>
                        One card per job keeps your resume, interview practice, and application status all in one place.
                      </p>
                    </div>

                    {/* Kanban column preview */}
                    <div className="flex gap-1 mb-2">
                      {['Resume', 'Applied', 'Interview', 'Hired'].map((col, i) => (
                        <div key={i} className="flex-1 rounded-md px-1 py-0.5 text-center" style={{ background: i === 3 ? 'rgba(21,128,61,0.06)' : 'rgba(124,58,237,0.04)', border: i === 3 ? '1px solid rgba(21,128,61,0.2)' : '1px solid rgba(124,58,237,0.12)' }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: i === 3 ? '#15803d' : '#7c3aed' }}>{col}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col gap-1 mb-1.5">
                      {['Tailored resume linked to every job', 'Interview practice tied to each application', 'Hired cards saved to your Vault'].map((item, i) => (
                        <div key={i} className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg" style={{ opacity: 0.5 }}>
                          <div className="w-1.5 h-1.5 rounded-full bg-purple-600 flex-shrink-0"></div>
                          <span className="text-[11px] text-gray-500">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* CAREER OS FOOTER */}
        <div
          className="md:hidden w-full px-6 py-6"
          style={{ background: 'linear-gradient(180deg, #667eea 0%, #764ba2 100%)', marginTop: 8 }}
        >
         <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginBottom: 4 }}>Hire Power isn't just for this job search.</p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', lineHeight: 1.4, marginBottom: 16 }}>
            It's the operating system for your career — tracking your growth and capturing your wins so you're always ready when your next opportunity appears.
          </p>
          <div style={{ borderTop: '1px solid rgba(180,180,180,0.15)', paddingTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/images/Hire_Power_icon.png" alt="" style={{ height: 20, width: 'auto', flexShrink: 0 }} />
            <p style={{ fontSize: 16, fontWeight: 500, color: '#fff', margin: 0 }}>Your lifelong career coach</p>
          </div>
        </div>
      </div>
      <ErrorToast message={toast} onClose={() => setToast(null)} />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardContent />
    </Suspense>
  );
}