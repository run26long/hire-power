'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import MainNav from '../components/MainNav';
import ErrorToast from '../components/ErrorToast';
import { getJobSources } from '../utils/getJobSources';

const QUESTIONS_OF_THE_DAY = [
  "Tell me about a time you had to deliver results under a tight deadline. What did you do?",
  "Describe a situation where you had to work with a difficult colleague. How did you handle it?",
  "Walk me through a project you're proud of. What was your role and what was the outcome?",
  "Tell me about a time you made a mistake at work. What happened and what did you learn?",
  "Describe a time you had to persuade someone to see things your way. How did you approach it?",
  "Tell me about a time you identified a problem before it became serious. What did you do?",
  "Describe a situation where you had to learn something new quickly. How did you manage it?",
];

const VISIBLE_CARD_LIMIT = 4;

// AP-style title case helper (matches resume-coach pattern)
function toTitleCaseOnBlur(value) {
  if (!value) return value;
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  const words = trimmed.split(/\s+/);
  const hasMidWordCap = words.some(w => {
    for (let i = 1; i < w.length; i++) {
      if (w[i] >= 'A' && w[i] <= 'Z') return true;
    }
    return false;
  });
  if (hasMidWordCap) return trimmed;
  const smallWords = new Set(['a','an','and','as','at','but','by','for','if','in','nor','of','on','or','so','the','to','up','yet']);
  const acronyms = new Set(['hr','it','pr','qa','ui','ux','vp','ceo','cfo','coo','cto','cmo','seo','ai','ml']);
  const tokens = trimmed.toLowerCase().split(/(\s+)/);
  const wordIndices = [];
  tokens.forEach((tok, i) => { if (tok.trim() !== '') wordIndices.push(i); });
  const firstIdx = wordIndices[0];
  const lastIdx = wordIndices[wordIndices.length - 1];
  return tokens.map((tok, i) => {
    if (tok.trim() === '') return tok;
    const cleanTok = tok.replace(/[^a-z]/g, '');
    if (acronyms.has(cleanTok)) return tok.toUpperCase();
    const isFirst = i === firstIdx;
    const isLast = i === lastIdx;
    if (!isFirst && !isLast && smallWords.has(tok)) return tok;
    return tok.charAt(0).toUpperCase() + tok.slice(1);
  }).join('');
}

export default function MyInterviewsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPro, setIsPro] = useState(false);

  // Practice cards
  const [practiceCards, setPracticeCards] = useState([]);
  const [showOlderModal, setShowOlderModal] = useState(false);

  // New Practice Modal state
  const [showPracticeModal, setShowPracticeModal] = useState(false);
  const [jobSources, setJobSources] = useState([]);
  const [selectedJobSourceId, setSelectedJobSourceId] = useState('');
  const [practiceJobTitle, setPracticeJobTitle] = useState('');
  const [practiceJobCompany, setPracticeJobCompany] = useState('');
  const [practiceJobDescription, setPracticeJobDescription] = useState('');
  const [creatingPractice, setCreatingPractice] = useState(false);
  const [practiceCreateError, setPracticeCreateError] = useState(null);

  // Error toast
  const [errorToast, setErrorToast] = useState(null);

  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const questionOfTheDay = QUESTIONS_OF_THE_DAY[dayOfYear % QUESTIONS_OF_THE_DAY.length];

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/dashboard'); return; }
      setUser(user);

      const { data: profile } = await supabase
        .from('profiles').select('*').eq('id', user.id).single();
      setUserProfile(profile);
      setIsPro(profile?.subscription_tier === 'pro');

      const sources = await getJobSources(supabase, user.id);
      setJobSources(sources);

      // Load practice cards: any job card that has a Power Analysis row
      const { data: paRows } = await supabase
        .from('power_analysis')
        .select(`
          id,
          job_card_id,
          generated_at,
          last_refreshed_at,
          applications:job_card_id (
            id,
            title,
            company,
            interview_date,
            interview_level,
            interview_sessions_count,
            match_score,
            application_status
          )
        `)
        .eq('user_id', user.id)
        .order('last_refreshed_at', { ascending: false, nullsFirst: false });

      const cards = (paRows || [])
        .filter(row => row.applications && row.applications.application_status !== 'archived')
        .map(row => ({
          paId: row.id,
          jobCardId: row.job_card_id,
          generatedAt: row.last_refreshed_at || row.generated_at,
          title: row.applications.title,
          company: row.applications.company,
          interviewDate: row.applications.interview_date,
          level: row.applications.interview_level || 0,
          sessionsCount: row.applications.interview_sessions_count || 0,
          matchScore: row.applications.match_score
        }));

      setPracticeCards(cards);
      setLoading(false);
    }
    loadData();
  }, [supabase, router]);

  function handleOpenPracticeModal() {
    setSelectedJobSourceId('');
    setPracticeJobTitle('');
    setPracticeJobCompany('');
    setPracticeJobDescription('');
    setPracticeCreateError(null);
    setShowPracticeModal(true);
  }

  async function handleStartPractice() {
    if (selectedJobSourceId) {
      setShowPracticeModal(false);
      router.push(`/interview/${selectedJobSourceId}`);
      return;
    }

    if (!practiceJobTitle.trim() || !practiceJobDescription.trim()) {
      setPracticeCreateError('Please fill in the job title and job description.');
      return;
    }

    setCreatingPractice(true);
    setPracticeCreateError(null);

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error("You're signed out. Please refresh and sign in again.");

      const { data: newCard, error: insertError } = await supabase
        .from('applications')
        .insert({
          user_id: authUser.id,
          title: practiceJobTitle.trim(),
          company: practiceJobCompany.trim() || 'Company Name',
          description: practiceJobDescription.trim(),
          application_status: 'prepping'
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setShowPracticeModal(false);
      router.push(`/interview/${newCard.id}`);
    } catch (err) {
      console.error('Create practice job error:', err);
      setPracticeCreateError(err.message || "We couldn't create this practice. Please try again.");
    } finally {
      setCreatingPractice(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-purple-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const visibleCards = practiceCards.slice(0, VISIBLE_CARD_LIMIT);
  const olderCards = practiceCards.slice(VISIBLE_CARD_LIMIT);
  const hasOlder = olderCards.length > 0;

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
          <h1 className="text-[28px] font-bold mb-1.5 whitespace-nowrap tracking-tight">Interview Coach</h1>
          <p className="text-[13px] text-white text-opacity-95 leading-tight tracking-tight mb-0.5">
            Job hunting is small talk.
          </p>
          <p className="text-[13px] text-white text-opacity-95 leading-tight tracking-tight">
            Your career deserves a conversation.
          </p>
          <div className="mt-4 border-b border-gray-400 border-opacity-10"></div>
          <p className="text-[15px] font-bold text-white leading-tight tracking-tight mt-3">
            AI-spoken interview practice that mimics a real interview
          </p>
        </div>

        <div className="flex-1 px-6 pt-1 pb-6 flex flex-col justify-between">
          <div>
            <div className="mb-5">
              <h4 className="text-sm font-bold uppercase tracking-wider text-white mb-2">FREE</h4>
              <ul className="space-y-1 text-sm">
                <li className="flex items-start"><span className="mr-2">•</span><span>General - unlimited practice</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Job-specific - 1 practice</span></li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Power Analysis reveal <span className="text-[10px] text-white text-opacity-60">(view only)</span></span>
                </li>
              </ul>
            </div>

            <div className="mb-4">
              <h4 className="text-sm font-bold uppercase tracking-wider text-white mb-2">PRO</h4>
              <ul className="space-y-1 text-sm">
                <li className="flex items-start"><span className="mr-2">•</span><span>Pre-interview coaching</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Power Analysis for every job</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Company research integration</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Unlimited job-specific sessions</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Post-practice feedback</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Gamified progression</span></li>
              </ul>
            </div>
          </div>

          <div className="mt-auto">
            <div className="mb-3 border-b border-gray-400 border-opacity-10"></div>
            <div>
              <p className="text-xs text-white text-opacity-90 leading-snug mb-5">
                Interview Coach prepares you to present your experience with confidence, for every role you pursue
              </p>
              <div className="flex items-center gap-2.5 text-white">
                <img
                  src="/images/Hire_Power_icon.png"
                  alt="Lightning"
                  className="h-5 w-auto flex-shrink-0"
                />
                <p className="text-sm font-medium leading-tight">
                  Practice until it feels real.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-0 md:ml-64 flex-1 flex flex-col h-screen overflow-hidden">
        <MainNav currentPage="interview-coach" userProfile={userProfile} />

        <div className="flex-1 overflow-y-auto">
          <div className="px-4 md:px-6 py-2 md:py-4 max-w-[1400px] mx-auto w-full">

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">

              {/* LEFT: Practice History (8 cols) */}
              <div className="col-span-1 md:col-span-8 space-y-2">

                {/* Practice History Card */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 md:px-5 md:py-3">
                  <div className="flex items-center justify-between mb-1">
                    <h2 className="text-lg font-semibold text-gray-900">Interview Practices</h2>
                    <span className="md:hidden text-sm font-semibold px-3 py-1 rounded-md" style={{ backgroundColor: 'rgba(147, 51, 234, 0.08)', color: '#7e22ce' }}>Interview Coach</span>
                  </div>
                  <p className="text-sm md:text-xs text-gray-500 mb-2">Your saved practice sessions will appear here, each tied to a specific job.</p>

                  {/* New Practice Button */}
                  <button
                    onClick={handleOpenPracticeModal}
                    className="w-full border-2 border-dashed border-purple-300 rounded-lg py-2 px-3 hover:border-purple-500 hover:bg-purple-50 transition-all flex items-center justify-center gap-3 mb-2 group"
                  >
                    <div className="w-8 h-8 rounded-full bg-purple-100 group-hover:bg-purple-200 flex items-center justify-center transition-colors">
                      <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <div className="text-base md:text-sm font-semibold text-gray-900">New Interview Practice</div>
                      <div className="text-sm md:text-xs text-gray-500">Choose a job-specific resume or start from scratch</div>
                    </div>
                  </button>

                  {/* Practice Cards List OR Empty State — fixed height, fits 4 cards */}
                  <div style={{ height: '235px' }} className="flex flex-col">
                    {visibleCards.length > 0 ? (
                      <>
                        <div className="space-y-1.5">
                          {visibleCards.map((card) => (
                            <PracticeCard key={card.jobCardId} card={card} onClick={() => router.push(`/interview/${card.jobCardId}`)} />
                          ))}
                        </div>
                        {hasOlder && (
                          <div className="mt-2 text-center">
                            <button
                              onClick={() => setShowOlderModal(true)}
                              className="text-sm md:text-xs text-purple-600 hover:text-purple-700 font-semibold"
                            >
                              See {olderCards.length} older practice{olderCards.length === 1 ? '' : 's'} →
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-center border border-dashed border-gray-200 rounded-lg bg-gray-50 px-4">
                        <div className="text-3xl mb-1">🎤</div>
                        <p className="text-base md:text-sm font-semibold text-gray-700 mb-1">Your practice sessions will live here</p>
                        <p className="text-sm md:text-xs text-gray-500 max-w-xs mx-auto leading-relaxed">
                          Each practice is tied to a specific job, with a level badge, score history, and coaching notes so you can track improvement over time.
                        </p>
                        <div className="flex items-center justify-center gap-3 mt-3">
                          {[1, 2, 3, 4, 5].map((level) => (
                            <div key={level} className="flex flex-col items-center gap-1">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                                level === 1 ? 'border-purple-300 bg-purple-50 text-purple-500' : 'border-gray-200 bg-white text-gray-300'
                              }`}>
                                {level}
                              </div>
                              <span className="text-[11px] md:text-[9px] text-gray-400">L{level}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Question of the Day */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-base font-semibold text-gray-900">Question of the Day</h2>
                    <span className="text-xs md:text-[10px] text-gray-400">Think it through, no pressure</span>
                  </div>
                  <div className="bg-purple-50 border-l-4 border-purple-600 p-4 rounded-r mt-3">
                    <p className="text-base md:text-sm text-gray-800 font-medium leading-relaxed">{questionOfTheDay}</p>
                  </div>
                  <div className="mt-3 flex flex-col md:flex-row md:items-center md:justify-between gap-1.5">
                    <p className="text-sm md:text-xs text-gray-500">Use the STAR method: Situation, Task, Action, Result</p>
                  </div>
                </div>

              </div>

              {/* RIGHT: Stats + Readiness (4 cols) */}
              <div className="col-span-1 md:col-span-4 space-y-2">

                {/* Practice Stats */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
                  <h2 className="text-base font-semibold text-gray-900 mb-1">Practice Stats</h2>
                  <p className="text-sm md:text-xs text-gray-500 mb-3.5">Your interview training at a glance</p>

                  {isPro ? (
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { label: 'Total Sessions', sub: 'Across all jobs', val: '0' },
                        { label: 'Best Level', sub: 'Max L5 per job', val: '--' },
                        { label: 'Practice Streak', sub: 'Consecutive days', val: '0' },
                        { label: 'Jobs Practiced', sub: 'Unique targets', val: String(practiceCards.length) },
                      ].map((stat) => (
                        <div key={stat.label} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                          <div>
                            <p className="text-sm md:text-xs font-medium text-gray-700">{stat.label}</p>
                            <p className="text-xs md:text-[10px] text-gray-400">{stat.sub}</p>
                          </div>
                          <span className="text-2xl font-bold text-gray-300">{stat.val}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { label: 'Total Sessions', sub: 'Across all jobs', val: '0' },
                          { label: 'Practice Streak', sub: 'Consecutive days', val: '0' },
                        ].map((stat) => (
                          <div key={stat.label} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                            <div>
                              <p className="text-sm md:text-xs font-medium text-gray-700">{stat.label}</p>
                              <p className="text-xs md:text-[10px] text-gray-400">{stat.sub}</p>
                            </div>
                            <span className="text-2xl font-bold text-gray-300">{stat.val}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between p-2.5 bg-purple-50 border border-purple-200 rounded-lg gap-3">
                        <p className="text-sm md:text-xs text-purple-800 leading-snug">Unlock Power Analysis, job-specific sessions, and gamified progression.</p>
                        <button
                          onClick={() => router.push('/pricing')}
                          className="text-white rounded-md py-1.5 px-3 text-xs md:text-[11px] font-semibold flex-shrink-0 transition-opacity hover:opacity-90"
                          style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
                        >
                          Go Pro
                        </button>
                      </div>
                    </div>
                  )}

                  <p className="text-xs md:text-[10px] text-gray-400 text-center mt-2">Start practicing to see your stats here</p>
                </div>

                {/* Practice out loud callout */}
                <div className="bg-purple-50 border-l-4 border-purple-600 p-3 rounded-r">
                  <p className="text-sm md:text-xs text-gray-700 leading-snug">
                    Candidates who practice out loud, not just in their head, are significantly more confident and articulate in real interviews.
                  </p>
                </div>

                {/* Interview Readiness Checklist */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
                  <h2 className="text-base font-semibold text-gray-900 mb-1">Interview Readiness</h2>
                  <p className="text-sm md:text-xs text-gray-500 mb-4">Quick prep before any interview</p>

                  <div className="space-y-1.5">
                    {[
                      { label: 'Resume reviewed and current', key: 'resume' },
                      { label: 'Researched the company', key: 'research' },
                      { label: 'Know your 3 strongest stories', key: 'stories' },
                      { label: 'Prepared a question to ask them', key: 'question' },
                      { label: 'Practiced out loud at least once', key: 'practiced' },
                    ].map((item) => (
                      <ChecklistItem key={item.key} label={item.label} />
                    ))}
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>

      {/* New Interview Practice Modal */}
      {showPracticeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => { setShowPracticeModal(false); setPracticeCreateError(null); }}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4" style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-lg">🎤</span>
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">New Interview Practice</h2>
                    <p className="text-purple-100 text-sm md:text-xs">Pick a job from your tracker, or start a new one.</p>
                  </div>
                </div>
                <button
                  onClick={() => { setShowPracticeModal(false); setPracticeCreateError(null); }}
                  className="text-white hover:opacity-70 text-2xl leading-none font-light"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {jobSources.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Use details from existing job</label>
                  <p className="text-[10px] text-gray-400 mb-1">Select an existing job to auto-fill the details below, or fill them in manually.</p>
                  <select
                    value={selectedJobSourceId}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '') {
                        setSelectedJobSourceId('');
                        setPracticeJobTitle('');
                        setPracticeJobCompany('');
                        setPracticeJobDescription('');
                      } else {
                        const selected = jobSources.find(s => s.id === val);
                        setSelectedJobSourceId(val);
                        setPracticeJobTitle(selected?.title || '');
                        setPracticeJobCompany(selected?.company || '');
                        setPracticeJobDescription(selected?.description || '');
                      }
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base md:text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                  >
                    <option value="">None selected</option>
                    {jobSources.map(s => (
                      <option key={s.id} value={s.id}>{s.displayLabel}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm md:text-xs font-semibold text-gray-700 mb-1">Job Title *</label>
                <input
                  type="text"
                  value={practiceJobTitle}
                  onChange={e => setPracticeJobTitle(e.target.value)}
                  onBlur={e => setPracticeJobTitle(toTitleCaseOnBlur(e.target.value))}
                  placeholder="e.g. Marketing Coordinator"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm md:text-xs font-semibold text-gray-700 mb-1">Company</label>
                <input
                  type="text"
                  value={practiceJobCompany}
                  onChange={e => setPracticeJobCompany(e.target.value)}
                  onBlur={e => setPracticeJobCompany(toTitleCaseOnBlur(e.target.value))}
                  placeholder="e.g. Disney"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm md:text-xs font-semibold text-gray-700 mb-1">Job Description *</label>
                <textarea
                  value={practiceJobDescription}
                  onChange={e => setPracticeJobDescription(e.target.value)}
                  placeholder="Paste the full job description here..."
                  rows={6}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
              </div>

              {practiceCreateError && (
                <p className="text-sm md:text-xs text-red-600">{practiceCreateError}</p>
              )}

              <button
                onClick={handleStartPractice}
                disabled={creatingPractice}
                className="block mx-auto rounded-lg py-2 px-8 font-semibold text-sm flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(to right, #667eea, #764ba2)', color: 'white', opacity: creatingPractice ? 0.85 : 1 }}
              >
                <span key={creatingPractice ? 'loading' : 'idle'} className="flex items-center gap-2">
                  {creatingPractice && <div className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>}
                  {creatingPractice ? 'Starting...' : 'Start Practice →'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Older Practices Modal */}
      {showOlderModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowOlderModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col"
            style={{ height: '80vh' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4 flex-shrink-0" style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white">Older Practices</h2>
                  <p className="text-purple-100 text-sm md:text-xs">{olderCards.length} practice{olderCards.length === 1 ? '' : 's'}</p>
                </div>
                <button
                  onClick={() => setShowOlderModal(false)}
                  className="text-white hover:opacity-70 text-2xl leading-none font-light"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-4 md:p-6 flex-1 overflow-y-auto space-y-1.5">
              {olderCards.map((card) => (
                <PracticeCard
                  key={card.jobCardId}
                  card={card}
                  onClick={() => {
                    setShowOlderModal(false);
                    router.push(`/interview/${card.jobCardId}`);
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <ErrorToast message={errorToast} onClose={() => setErrorToast(null)} />
    </div>
  );
}

// ============================================================================
// Practice Card Component (compact row layout)
// ============================================================================
function PracticeCard({ card, onClick }) {
  const hasAnalyzed = true;
  const hasCoached = false;
  const hasPracticed = (card.sessionsCount || 0) > 0;

  const interviewIsUpcoming = card.interviewDate && new Date(card.interviewDate).getTime() > Date.now();

  return (
    <button
      onClick={onClick}
      className="w-full text-left border border-gray-200 rounded-lg px-3 py-2 hover:border-purple-300 hover:bg-purple-50 transition-all flex items-center gap-3 group"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm md:text-xs font-semibold text-gray-900 truncate">{card.title}</p>
          {interviewIsUpcoming && (
            <span className="text-xs md:text-[9px] bg-purple-100 text-purple-700 font-bold px-1.5 py-0.5 rounded uppercase tracking-wide flex-shrink-0">
              Upcoming
            </span>
          )}
        </div>
        <p className="text-xs md:text-[10px] text-gray-500 truncate">
          {card.company}
          {card.matchScore && <span className="text-gray-400"> • Match {card.matchScore}</span>}
        </p>
      </div>

      <div className="hidden md:flex items-center gap-2 flex-shrink-0">
        <StepPill label="Analyzed" complete={hasAnalyzed} />
        <StepPill label="Coached" complete={hasCoached} />
        <StepPill label="Practiced" complete={hasPracticed} />
      </div>

      <div className="flex md:hidden items-center gap-1 flex-shrink-0">
        <StatusDot complete={hasAnalyzed} />
        <StatusDot complete={hasCoached} />
        <StatusDot complete={hasPracticed} />
      </div>

      <svg className="w-4 h-4 text-gray-400 group-hover:text-purple-600 flex-shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

function StepPill({ label, complete }) {
  return (
    <div className={`flex items-center gap-1 px-2 py-0.5 rounded ${
      complete ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
    }`}>
      <span className="text-xs md:text-[10px] font-bold">{complete ? '✓' : '○'}</span>
      <span className="text-xs md:text-[10px] font-semibold">{label}</span>
    </div>
  );
}

function StatusDot({ complete }) {
  return (
    <div className={`w-2 h-2 rounded-full ${complete ? 'bg-green-500' : 'bg-gray-300'}`} />
  );
}

function ChecklistItem({ label }) {
  const [checked, setChecked] = useState(false);
  return (
    <button
      onClick={() => setChecked(!checked)}
      className="w-full flex items-center gap-3 p-1.5 rounded-lg hover:bg-gray-50 transition-colors text-left"
    >
      <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${
        checked ? 'bg-purple-600 border-purple-600' : 'border-gray-300 bg-white'
      }`}>
        {checked && (
          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <span className={`text-sm md:text-xs transition-colors ${checked ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
        {label}
      </span>
    </button>
  );{/* Practice Cards List OR Empty State */}
                  {visibleCards.length > 0 ? (
                    <>
                      <div className="space-y-1.5">
                        {visibleCards.map((card) => (
                          <PracticeCard key={card.jobCardId} card={card} onClick={() => router.push(`/interview/${card.jobCardId}`)} />
                        ))}
                      </div>
                      {hasOlder && (
                        <div className="mt-2 text-center">
                          <button
                            onClick={() => setShowOlderModal(true)}
                            className="text-sm md:text-xs text-purple-600 hover:text-purple-700 font-semibold"
                          >
                            See {olderCards.length} older practice{olderCards.length === 1 ? '' : 's'} →
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-4 border border-dashed border-gray-200 rounded-lg bg-gray-50">
                      <div className="text-3xl mb-1">🎤</div>
                      <p className="text-base md:text-sm font-semibold text-gray-700 mb-1">Your practice sessions will live here</p>
                      <p className="text-sm md:text-xs text-gray-500 max-w-xs mx-auto leading-relaxed">
                        Each practice is tied to a specific job, with a level badge, score history, and coaching notes so you can track improvement over time.
                      </p>
                      <div className="flex items-center justify-center gap-3 mt-3">
                        {[1, 2, 3, 4, 5].map((level) => (
                          <div key={level} className="flex flex-col items-center gap-1">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                              level === 1 ? 'border-purple-300 bg-purple-50 text-purple-500' : 'border-gray-200 bg-white text-gray-300'
                            }`}>
                              {level}
                            </div>
                            <span className="text-[11px] md:text-[9px] text-gray-400">L{level}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
}