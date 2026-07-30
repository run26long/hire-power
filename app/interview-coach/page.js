'use client';

import { useState, useEffect, useRef } from 'react';
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

  // Delete confirmation
  const [confirmDeletePracticeId, setConfirmDeletePracticeId] = useState(null);
  const [deletingPracticeId, setDeletingPracticeId] = useState(null);

  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const questionOfTheDay = QUESTIONS_OF_THE_DAY[dayOfYear % QUESTIONS_OF_THE_DAY.length];

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/dashboard'); return; }
      setUser(user);

      const { data: profile } = await supabase
        .from('profiles').select('*').eq('id', user.id).maybeSingle();
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
          core_power,
          hidden_power,
          power_gaps,
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

      // Load completed story counts per job card
      const { data: storyRows } = await supabase
        .from('interview_stories')
        .select('job_card_id, coaching_complete')
        .eq('user_id', user.id)
        .eq('coaching_complete', true);

      const storyCountByJobCard = {};
      (storyRows || []).forEach(row => {
        storyCountByJobCard[row.job_card_id] = (storyCountByJobCard[row.job_card_id] || 0) + 1;
      });

      const cards = (paRows || [])
        .filter(row => row.applications && row.applications.application_status !== 'archived')
        .map(row => {
          const totalItems =
            (row.core_power?.length || 0) +
            (row.hidden_power?.length || 0) +
            (row.power_gaps?.length || 0);
          return {
            paId: row.id,
            jobCardId: row.job_card_id,
            generatedAt: row.last_refreshed_at || row.generated_at,
            title: row.applications.title,
            company: row.applications.company,
            interviewDate: row.applications.interview_date,
            level: row.applications.interview_level || 0,
            sessionsCount: row.applications.interview_sessions_count || 0,
            matchScore: row.applications.match_score,
            storiesCoached: storyCountByJobCard[row.job_card_id] || 0,
            totalStoryItems: totalItems
          };
        });

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

  async function handleDeletePractice(jobCardId) {
    try {
      setDeletingPracticeId(jobCardId);

      const { error: storiesError } = await supabase
        .from('interview_stories')
        .delete()
        .eq('job_card_id', jobCardId)
        .eq('user_id', user.id);
      if (storiesError) throw storiesError;

      const { error: paError } = await supabase
        .from('power_analysis')
        .delete()
        .eq('job_card_id', jobCardId)
        .eq('user_id', user.id);
      if (paError) throw paError;

      setConfirmDeletePracticeId(null);
      setPracticeCards(prev => prev.filter(c => c.jobCardId !== jobCardId));
      setErrorToast("Interview practice deleted. Restart it anytime from your Job Tracker.");
    } catch (error) {
      console.error('Delete practice error:', error);
      setErrorToast('Could not delete interview practice. Please try again.');
    } finally {
      setDeletingPracticeId(null);
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
        </div>

        <div className="px-6 pt-0 pb-6">

          {/* Steps */}
          <div style={{ marginBottom: 16 }}>
            {[
              { 
                num: '1', 
                title: 'Power Analysis', 
                desc: 'We analyze your resume against the job description and show you what to highlight in each interview.',
          
              },
              { 
                num: '2', 
                title: 'STAR Story Coaching', 
                desc: 'Through conversation, we extract your real Situation, Task, Action, and Result for each item so you know how to confidently tell each story.',
                tag: 'Pro only'
              },
              { 
                num: '3', 
                title: 'Company Research', 
                desc: 'Learn about the company to align your experience with business goals.',
                tag: 'Pro only'
              },
              { 
                num: '4', 
                title: 'Mock Interview', 
                desc: 'Practice with customized questions based on your skills and experience and the job requirements.',
                tag: 'Free: 1 session · Pro: Unlimited'
              },
              { 
                num: '5', 
                title: 'Interview Feedback', 
                desc: 'Record yourself and get feedback on delivery, not just content.',
                tag: 'Pro'
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
                    <span style={{ fontSize: 9, fontWeight: 700, fontStyle: 'italic', color: 'rgba(255,255,255,0.45)', letterSpacing: '0.02em', display: 'block', marginTop: 0 }}>
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
              You already have the experience. We help you tell it.
            </p>
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
                    <h2 className="text-lg font-semibold text-gray-900">Interview Prep</h2>
                    <span className="md:hidden text-sm font-semibold px-3 py-1 rounded-md" style={{ backgroundColor: 'rgba(147, 51, 234, 0.08)', color: '#7e22ce' }}>Interview Coach</span>
                  </div>
                  <p className="text-sm md:text-xs text-gray-500 mb-2">
                    Prep for any interview with <span className="whitespace-nowrap font-semibold text-gray-700">Power Analysis</span>, <span className="whitespace-nowrap font-semibold text-gray-700">Story Coaching</span>, or <span className="whitespace-nowrap font-semibold text-gray-700">Interview Practice</span>. Do all three, or jump to what you need.
                  </p>

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
                            <PracticeCard
                              key={card.jobCardId}
                              card={card}
                              onClick={() => router.push(`/interview/${card.jobCardId}`)}
                              onDeleteRequest={() => setConfirmDeletePracticeId(card.jobCardId)}
                            />
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
                        <p className="text-base md:text-sm font-semibold text-gray-700 mb-1">Your interviews will live here</p>
                        <p className="text-sm md:text-xs text-gray-500 max-w-sm mx-auto leading-relaxed mb-4">
                          Each job gets three prep tools. Use any or all to walk into your interview ready.
                        </p>
                        <div className="flex items-center justify-center gap-6">
                          <div className="flex flex-col items-center gap-1">
                            <div className="text-2xl">🎯</div>
                            <span className="text-[11px] md:text-[10px] font-semibold text-gray-600">Power Analysis</span>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <div className="text-2xl">🎤</div>
                            <span className="text-[11px] md:text-[10px] font-semibold text-gray-600">Story Coaching</span>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <div className="text-2xl">🎙️</div>
                            <span className="text-[11px] md:text-[10px] font-semibold text-gray-600">Interview Practice</span>
                          </div>
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
                  onDeleteRequest={() => {
                    setShowOlderModal(false);
                    setConfirmDeletePracticeId(card.jobCardId);
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Interview Practice Delete Confirmation */}
      {confirmDeletePracticeId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={() => setConfirmDeletePracticeId(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-gray-900 mb-2">Delete this interview practice?</h3>
            <p className="text-sm text-gray-600 mb-5">This removes the Power Analysis and coached stories. The job card stays in your Job Tracker and you can restart practice anytime.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeletePracticeId(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeletePractice(confirmDeletePracticeId)}
                disabled={deletingPracticeId === confirmDeletePracticeId}
                className="flex-1 px-4 py-2 bg-[#e57373] text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deletingPracticeId === confirmDeletePracticeId ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Deleting...
                  </>
                ) : (
                  'Yes, Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <ErrorToast message={errorToast} onClose={() => setErrorToast(null)} />
    </div>
  );
}

// ============================================================================
// Practice Card Component
// Smart CTA + Jump to menu, status pills below.
// State-driven: card knows what's next, user can override.
// ============================================================================
function PracticeCard({ card, onClick, onDeleteRequest }) {
  const router = useRouter();

  const storiesCoached = card.storiesCoached || 0;
  const totalStoryItems = card.totalStoryItems || 0;
  const hasAnalyzed = true; // card only appears if PA exists
  const hasCoached = storiesCoached > 0;
  const allCoached = totalStoryItems > 0 && storiesCoached === totalStoryItems;
  const hasPracticed = (card.sessionsCount || 0) > 0;

  const interviewIsUpcoming = card.interviewDate && new Date(card.interviewDate).getTime() > Date.now();
  const interviewIsPast = card.interviewDate && new Date(card.interviewDate).getTime() < Date.now();

  // Determine smart CTA label based on state
  let primaryCtaLabel;
  if (interviewIsPast) {
    primaryCtaLabel = 'Review →';
  } else if (!hasCoached) {
    primaryCtaLabel = 'Start Story Coaching →';
  } else if (!allCoached) {
    primaryCtaLabel = 'Continue Coaching →';
  } else if (!hasPracticed) {
    primaryCtaLabel = 'Start Interview Practice →';
  } else {
    primaryCtaLabel = 'Practice Again →';
  }

  const goToDetail = (e, anchor) => {
    if (e) e.stopPropagation();
    const url = anchor ? `/interview/${card.jobCardId}#${anchor}` : `/interview/${card.jobCardId}`;
    router.push(url);
  };

  return (
    <div className="group border border-gray-200 rounded-lg px-3 py-2.5 hover:border-purple-300 hover:shadow-sm transition-all">
      {/* Top row: title + match info + CTA group */}
      <div className="flex items-start gap-3">
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
            {interviewIsPast ? (
              <>Past · {new Date(card.interviewDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</>
            ) : (
              <>{card.company}</>
            )}
            {card.matchScore && <span className="text-gray-400"> · Match {card.matchScore}</span>}
          </p>
        </div>

        {/* CTA group */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {!interviewIsPast && (
            <JumpToMenu
              jobCardId={card.jobCardId}
              hasCoachedAny={hasCoached}
              onNavigate={goToDetail}
            />
          )}
          <button
            onClick={(e) => goToDetail(e, null)}
            className="text-white rounded-md py-1.5 px-3 text-xs md:text-[11px] font-semibold transition-opacity hover:opacity-90 whitespace-nowrap"
            style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
          >
            {primaryCtaLabel}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDeleteRequest(); }}
            className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-full bg-[#fdecea] hover:bg-[#e57373] flex items-center justify-center text-[#e57373] hover:text-white transition-all flex-shrink-0"
            title="Delete practice"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Bottom row: status pills */}
      <div className="flex items-center gap-1.5 mt-2">
        <StepPill label="Analyzed" complete={hasAnalyzed} />
        <StepPill
          label={hasCoached ? `Coached ${storiesCoached}` : 'Coached'}
          complete={hasCoached}
        />
        <StepPill
          label={hasPracticed && card.level > 0 ? `Practiced L${card.level}` : 'Practiced'}
          complete={hasPracticed}
        />
      </div>
    </div>
  );
}

function StepPill({ label, complete, partial }) {
  let className;
  if (complete) {
    className = 'bg-green-100 text-green-700';
  } else if (partial) {
    className = 'bg-purple-50 text-purple-700';
  } else {
    className = 'bg-gray-100 text-gray-400';
  }
  const icon = complete ? '✓' : partial ? '◐' : '○';
  return (
    <div className={`flex items-center gap-1 px-2 py-0.5 rounded ${className}`}>
      <span className="text-xs md:text-[10px] font-bold">{icon}</span>
      <span className="text-xs md:text-[10px] font-semibold">{label}</span>
    </div>
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
  );
}

// ============================================================================
// Jump To Menu Component
// Phase navigation dropdown. All three phases always enabled
// (user gets full control per spec).
// ============================================================================
function JumpToMenu({ jobCardId, hasCoachedAny, onNavigate }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e) {
      if (
        menuRef.current && !menuRef.current.contains(e.target) &&
        buttonRef.current && !buttonRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    function handleEscape(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const handleSelect = (anchor) => {
    setOpen(false);
    onNavigate(null, anchor);
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        className="border border-gray-200 rounded-md py-1.5 px-2.5 text-xs md:text-[11px] font-semibold text-gray-600 hover:border-purple-300 hover:text-purple-700 transition-colors whitespace-nowrap flex items-center gap-1"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Jump to
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          ref={menuRef}
          className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-30"
          style={{ minWidth: '180px' }}
          role="menu"
        >
          <button
            onClick={() => handleSelect('power-analysis')}
            className="w-full text-left px-3 py-2 text-xs md:text-[11px] font-medium text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-colors flex items-center gap-2"
            role="menuitem"
          >
            <span className="text-sm">🎯</span>
            Power Analysis
          </button>
          <button
            onClick={() => handleSelect('coaching')}
            className="w-full text-left px-3 py-2 text-xs md:text-[11px] font-medium text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-colors flex items-center gap-2 border-t border-gray-100"
            role="menuitem"
          >
            <span className="text-sm">🎤</span>
            Story Coaching
          </button>
          <button
            onClick={() => handleSelect('practice')}
            className="w-full text-left px-3 py-2 text-xs md:text-[11px] font-medium text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-colors flex items-center gap-2 border-t border-gray-100"
            role="menuitem"
          >
            <span className="text-sm">🎙️</span>
            Interview Practice
          </button>
        </div>
      )}
    </div>
  );
}