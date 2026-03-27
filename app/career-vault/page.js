'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import MainNav from '../components/MainNav';

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
  const [upgrading, setUpgrading] = useState(false);

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles').select('email').eq('id', user.id).single();
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: process.env.NEXT_PUBLIC_STRIPE_VAULT_PRICE_ID,
          userId: user.id,
          email: profile?.email || user.email,
        })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      window.location.href = data.url;
    } catch (err) {
      console.error('Upgrade error:', err);
      setUpgrading(false);
    }
  };

  // Current job entry (from hired job card)
  const [currentJobEntry, setCurrentJobEntry] = useState(null);

  // Archived job cards (mock for shell)
  const [archivedCards] = useState([
    {
      id: '1', jobTitle: 'Marketing Coordinator', jobCompany: 'Acme Corp',
      status: 'rejected', appliedDate: '2026-01-15', resumeLink: true, practiceCount: 3
    },
    {
      id: '2', jobTitle: 'Event Manager', jobCompany: 'Summit Events',
      status: 'hired', appliedDate: '2025-11-02', resumeLink: true, practiceCount: 5
    },
    {
      id: '3', jobTitle: 'Project Coordinator', jobCompany: 'TechStart',
      status: 'rejected', appliedDate: '2025-10-18', resumeLink: true, practiceCount: 2
    },
  ]);

  const logInputRef = useRef(null);

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/dashboard'); return; }
      setUser(user);

      const { data: profile } = await supabase
        .from('profiles').select('*').eq('id', user.id).single();
      setUserProfile(profile);
      setTier(profile?.subscription_tier || 'vault');

      // Load accomplishments from achievements table
      const { data: accs } = await supabase
        .from('achievements')
        .select('*')
        .eq('user_id', user.id)
        .eq('source', 'career_archive')
        .order('created_at', { ascending: false });
      if (accs) setAccomplishments(accs);

      const { count: resumeCount } = await supabase
        .from('resumes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('resume_type', 'core');
      setResumeCount(resumeCount || 0);

      setLoading(false);
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
    await supabase.from('achievements').delete().eq('id', id);
    setAccomplishments(prev => prev.filter(a => a.id !== id));
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
        className="w-64 text-white flex flex-col fixed left-0 top-0 shadow-lg z-40"
        style={{
          background: 'linear-gradient(180deg, #667eea 0%, #764ba2 100%)',
          height: '100vh',
          overflowY: 'hidden'
        }}
      >
        <div className="px-6 pt-6 pb-4 flex-shrink-0">
          <h1 className="text-[28px] font-bold mb-1.5 whitespace-nowrap tracking-tight">Career Vault</h1>
          <p className="text-[13px] text-white text-opacity-95 leading-tight tracking-tight mb-0.5">
            Track your wins as they happen.
          </p>
          <p className="text-[13px] text-white text-opacity-95 leading-tight tracking-tight">
            Stay ready between job searches.
          </p>
          <div className="mt-4 border-b border-gray-400 border-opacity-10"></div>
          <p className="text-[15px] font-bold text-white leading-tight tracking-tight mt-3">
            Three years from now, you won't remember what you accomplished today.
          </p>
        </div>

        <div className="flex-1 px-6 pt-3 pb-6 flex flex-col justify-between">
          <div>
            <div className="mb-5">
              <h4 className="text-sm font-bold uppercase tracking-wider text-white mb-2">WHAT VAULT DOES</h4>
              <ul className="space-y-1.5 text-sm">
                <li className="flex items-start"><span className="mr-2">•</span><span>Log wins in 30 seconds</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Save your current job entry</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Access all your resumes</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Run job match scores</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Generic interview practice</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Browse your archive</span></li>
              </ul>
            </div>

            <div className="mb-4">
              <h4 className="text-sm font-bold uppercase tracking-wider text-white mb-2">WHEN YOU'RE READY</h4>
              <ul className="space-y-1.5 text-sm">
                <li className="flex items-start"><span className="mr-2">•</span><span>Upgrade to Pro</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>We coach everything you logged</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Your resume builds itself</span></li>
              </ul>
            </div>
          </div>

          <div className="mt-auto">
            <div className="mb-3 border-b border-gray-400 border-opacity-10"></div>
            <div>
              <p className="text-xs text-white text-opacity-90 leading-relaxed mb-3">
                The OS running in the background between active sessions.
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
      <div className="ml-64 flex-1 flex flex-col h-screen overflow-hidden">
        <MainNav currentPage="career-vault" userProfile={userProfile} />

        <div className="flex-1 overflow-y-auto">
          <div className="px-8 py-4 max-w-[1400px] mx-auto w-full">

            <div className="grid grid-cols-12 gap-6">

              {/* LEFT: Accomplishments (8 cols) */}
              <div className="col-span-8 space-y-4">

                {/* Current Job Entry */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-1">
                    <h2 className="text-lg font-semibold text-gray-900">Current Job</h2>
                    {currentJobEntry
                      ? <StatusBadge status="hired" />
                      : <span className="text-[10px] text-gray-400 font-medium">Not set</span>
                    }
                  </div>
                  <p className="text-xs text-gray-500 mb-4">
                    Your current role — accomplishments you log here attach to this job entry and feed directly into your next resume.
                  </p>

                  {currentJobEntry ? (
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <p className="text-sm font-semibold text-gray-900">{currentJobEntry.title}</p>
                      <p className="text-xs text-gray-500">{currentJobEntry.company}</p>
                    </div>
                  ) : (
                    <div className="border border-dashed border-gray-300 rounded-lg p-4 text-center bg-gray-50">
                      <p className="text-xs text-gray-500 mb-3">
                        No current job set. Mark a job card as Hired, and it appears here automatically. Or, add info below.
                      </p>
                      <button className="text-xs text-purple-600 font-semibold hover:text-purple-700">
                        Set current job manually →
                      </button>
                    </div>
                  )}
                </div>

                {/* Accomplishments Log */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 pb-10">
                  <div className="flex items-center justify-between mb-1">
                    <h2 className="text-lg font-semibold text-gray-900">Accomplishments</h2>
                    <span className="text-xs text-gray-400">{accomplishments.length} logged</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-4">
                    Log wins as they happen — promotions, projects, metrics, skills, anything worth remembering.
                  </p>

                  {/* Log New Button */}
                  <button
                    onClick={() => setShowLogModal(true)}
                    className="w-full border-2 border-dashed border-purple-300 rounded-lg p-3 hover:border-purple-500 hover:bg-purple-50 transition-all flex items-center justify-center gap-3 mb-4 group"
                  >
                    <div className="w-7 h-7 rounded-full bg-purple-100 group-hover:bg-purple-200 flex items-center justify-center transition-colors">
                      <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">Log a Win</span>
                  </button>

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
                      <p className="text-sm font-semibold text-gray-600 mb-1">Nothing logged yet</p>
                      <p className="text-xs text-gray-400 text-center leading-relaxed">
                        The next time something good happens at work, log it here.<br />
                        Takes 30 seconds. Saves hours later.
                      </p>
                    </div>
                  )}
                </div>

              </div>

             {/* RIGHT: Compact status + actions + upgrade (4 cols) */}
                <div className="col-span-4 flex flex-col gap-3">

                  {/* Stats + Quick Actions combined */}
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="mb-3">
                      <h2 className="text-sm font-semibold text-gray-900">Your Career Vault</h2>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {[
                        { label: 'Logged',   value: accomplishments.length, icon: '🏆' },
                        { label: 'Resumes',  value: resumeCount,            icon: '📄' },
                        { label: 'Archived', value: archivedCards.length,   icon: '📁' },
                      ].map((item) => (
                        <div key={item.label} className="text-center p-2 bg-gray-50 rounded-lg">
                          <div className="text-base">{item.icon}</div>
                          <div className="text-lg font-bold text-gray-700">{item.value}</div>
                          <div className="text-[9px] text-gray-400 uppercase tracking-wide">{item.label}</div>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-gray-100 pt-1 mt-1 mb-2 text-center">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Quick Actions Still Available in Vault</p>
                      </div>
                    <div className="space-y-1.5">
                      <button onClick={() => router.push('/resume-coach')}
                        className="w-full flex items-center gap-2 p-2 bg-gray-50 rounded-lg hover:bg-purple-50 border border-gray-200 hover:border-purple-200 transition-colors text-left">
                        <span className="text-sm">📄</span>
                        <div>
                          <p className="text-xs font-semibold text-gray-800">Resume Coach</p>
                          <p className="text-[10px] text-gray-400">View, format, download</p>
                        </div>
                      </button>
                      <button onClick={() => router.push('/interview-coach')}
                        className="w-full flex items-center gap-2 p-2 bg-gray-50 rounded-lg hover:bg-purple-50 border border-gray-200 hover:border-purple-200 transition-colors text-left">
                        <span className="text-sm">🎤</span>
                        <div>
                          <p className="text-xs font-semibold text-gray-800">Interview Practice</p>
                          <p className="text-[10px] text-gray-400">Generic practice, always free</p>
                        </div>
                      </button>
                      <button onClick={() => setShowArchiveModal(true)}
                        className="w-full flex items-center gap-2 p-2 bg-gray-50 rounded-lg hover:bg-purple-50 border border-gray-200 hover:border-purple-200 transition-colors text-left">
                        <span className="text-sm">📁</span>
                        <div>
                          <p className="text-xs font-semibold text-gray-800">View Archive</p>
                          <p className="text-[10px] text-gray-400">{archivedCards.length} past job cards</p>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Upgrade CTA */}
                  <div className="bg-white rounded-lg shadow-sm border border-purple-200 p-3 pb-6">
                    <h2 className="text-sm font-semibold text-gray-900 mb-0.5">Ready to job search again?</h2>
                    <p className="text-xs text-gray-500 mb-1.5">Upgrade to Pro and we'll coach everything you've logged into a stronger resume.</p>
                    <div className="bg-purple-50 border-l-4 border-purple-600 p-1.5 rounded-r mb-2">
                      <p className="text-xs text-gray-700 leading-snug">
                        You've logged <strong className="text-purple-700">{accomplishments.length} win{accomplishments.length !== 1 ? 's' : ''}</strong> in your current job. Upgrade so your coach can apply them to your resume.
                      </p>
                    </div>
                    <button
                      onClick={handleUpgrade}
                      disabled={upgrading}
                      className="w-full bg-purple-600 text-white rounded-lg py-2 text-xs font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {upgrading && <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                      {upgrading ? 'Redirecting...' : 'Upgrade to Pro — $29.99/mo'}
                    </button>
                  </div>

                </div>
            </div>
          </div>
        </div>
      </div>

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
              style={{ background: 'linear-gradient(to bottom right, #9333ea, #6b21a8)', borderRadius: '8px 8px 0 0' }}
              className="px-6 py-4 flex items-center justify-between flex-shrink-0"
            >
              <div className="flex items-center gap-3">
                <img src="/images/Hire_Power_icon.png" alt="Hire Power" className="h-8 w-auto flex-shrink-0" />
                <div>
                  <h2 className="text-base font-bold text-white">Log a Win</h2>
                  <p className="text-purple-100 text-xs">30 seconds now. Hours saved later.</p>
                </div>
              </div>
              <button
                onClick={() => { setShowLogModal(false); setLogText(''); setLogDate(''); setLogError(null); }}
                className="text-white hover:text-gray-200 text-4xl leading-none font-light w-8 h-8 flex items-center justify-center"
              >×</button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
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
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  Don't overthink it. Raw notes are fine — numbers, scale, impact, whatever you remember.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Approximate date <span className="font-normal text-gray-400">(optional)</span></label>
                <input
                  type="month"
                  value={logDate}
                  onChange={e => setLogDate(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
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
                className="w-full bg-purple-600 text-white rounded-lg py-2.5 font-semibold text-sm hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
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
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.85)' }}
          onClick={() => setShowArchiveModal(false)}
        >
          <div
            className="bg-white shadow-2xl w-full max-w-2xl border border-gray-200 flex flex-col"
            style={{ borderRadius: '8px', maxHeight: '80vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{ background: 'linear-gradient(to bottom right, #9333ea, #6b21a8)', borderRadius: '8px 8px 0 0' }}
              className="px-6 py-4 flex items-center justify-between flex-shrink-0"
            >
              <div className="flex items-center gap-3">
                <img src="/images/Hire_Power_icon.png" alt="Hire Power" className="h-8 w-auto flex-shrink-0" />
                <div>
                  <h2 className="text-base font-bold text-white">Job Archive</h2>
                  <p className="text-purple-100 text-xs">{archivedCards.length} past applications — resumes and practices preserved</p>
                </div>
              </div>
              <button
                onClick={() => setShowArchiveModal(false)}
                className="text-white hover:text-gray-200 text-4xl leading-none font-light w-8 h-8 flex items-center justify-center"
              >×</button>
            </div>

            {/* Scrollable card list */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {archivedCards.length > 0 ? archivedCards.map((card) => (
                <div
                  key={card.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-purple-200 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-gray-900">{card.jobTitle}</p>
                        <StatusBadge status={card.status} />
                      </div>
                      <p className="text-xs text-gray-500 mb-2">{card.jobCompany} · Applied {formatDate(card.appliedDate)}</p>

                      {/* Links row */}
                      <div className="flex items-center gap-3 flex-wrap">
                        {card.resumeLink && (
                          <button className="text-[10px] text-purple-600 font-semibold hover:text-purple-700 flex items-center gap-1">
                            <span>📄</span> View Resume
                          </button>
                        )}
                        {card.practiceCount > 0 && (
                          <button className="text-[10px] text-purple-600 font-semibold hover:text-purple-700 flex items-center gap-1">
                            <span>🎤</span> {card.practiceCount} Interview Practice{card.practiceCount !== 1 ? 's' : ''}
                          </button>
                        )}
                        {card.status === 'hired' && (
                          <span className="text-[10px] text-gray-400 flex items-center gap-1">
                            <span>🔒</span> JD saved to Vault
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="text-center py-10 text-gray-400">
                  <div className="text-4xl mb-2">📁</div>
                  <p className="text-sm">No archived jobs yet</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0">
              <button
                onClick={() => setShowArchiveModal(false)}
                className="w-full bg-gray-100 text-gray-600 rounded-lg py-2 text-xs font-medium hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}