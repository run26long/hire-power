'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import MainNav from '../components/MainNav';

const QUESTIONS_OF_THE_DAY = [
  "Tell me about a time you had to deliver results under a tight deadline. What did you do?",
  "Describe a situation where you had to work with a difficult colleague. How did you handle it?",
  "Walk me through a project you're proud of. What was your role and what was the outcome?",
  "Tell me about a time you made a mistake at work. What happened and what did you learn?",
  "Describe a time you had to persuade someone to see things your way. How did you approach it?",
  "Tell me about a time you identified a problem before it became serious. What did you do?",
  "Describe a situation where you had to learn something new quickly. How did you manage it?",
];

export default function MyInterviewsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPro, setIsPro] = useState(false);
  const [showComingSoonModal, setShowComingSoonModal] = useState(false);

  // Rotate question of the day by day of year
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

      setLoading(false);
    }
    loadData();
  }, [supabase, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-purple-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

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
                    <h2 className="text-lg font-semibold text-gray-900">Interview Practices</h2>
                    <div className="flex items-center gap-2">
                      <span className="md:hidden text-sm font-semibold px-3 py-1 rounded-md" style={{ backgroundColor: 'rgba(147, 51, 234, 0.08)', color: '#7e22ce' }}>Interview Coach</span>
                      <span className="text-xs md:text-[10px] bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded uppercase tracking-wide">Coming Soon</span>
                    </div>
                  </div>
                  <p className="text-sm md:text-xs text-gray-500 mb-5">Your saved practice sessions will appear here, each tied to a specific job.</p>

                  {/* New Practice Button */}
                 <button
                    onClick={() => setShowComingSoonModal(true)}
                    className="w-full border-2 border-dashed border-purple-300 rounded-lg p-3 hover:border-purple-500 hover:bg-purple-50 transition-all flex items-center justify-center gap-3 mb-3 group"
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

                  {/* Empty State */}
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
                </div>

                {/* Question of the Day */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-base font-semibold text-gray-900">Question of the Day</h2>
                    <span className="text-xs md:text-[10px] text-gray-400">Think it through — no pressure</span>
                  </div>
                  <div className="bg-purple-50 border-l-4 border-purple-600 p-4 rounded-r mt-3">
                    <p className="text-base md:text-sm text-gray-800 font-medium leading-relaxed">{questionOfTheDay}</p>
                  </div>
                  <div className="mt-3 flex flex-col md:flex-row md:items-center md:justify-between gap-1.5">
                    <p className="text-sm md:text-xs text-gray-500">Use the STAR method: Situation, Task, Action, Result</p>
                    <button
                      onClick={() => setShowComingSoonModal(true)}
                     className="text-sm md:text-xs text-purple-600 font-semibold hover:text-purple-700 text-center md:text-right"
                    >
                      Practice this question →
                    </button>
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
                        { label: 'Jobs Practiced', sub: 'Unique targets', val: '0' },
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
                          onClick={() => setShowComingSoonModal(true)}
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
                    Candidates who practice out loud - not just in their head - are significantly more confident and articulate in real interviews.
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

      {/* Coming Soon Modal */}
      {showComingSoonModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.85)' }}
          onClick={() => setShowComingSoonModal(false)}
        >
          <div
            className="bg-white shadow-2xl max-w-md w-full border border-gray-200 overflow-hidden"
            style={{ borderRadius: '8px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)', borderRadius: '8px 8px 0 0' }}
              className="px-6 py-5 relative"
            >
              <button
                onClick={() => setShowComingSoonModal(false)}
                className="absolute top-4 right-4 text-white hover:text-gray-200 text-3xl leading-none font-light"
              >×</button>
              <div className="flex items-center gap-3">
                <img src="/images/Hire_Power_icon.png" alt="Hire Power" className="h-8 w-auto flex-shrink-0" />
                <div>
                  <h2 className="text-xl font-bold text-white">Interview Coach is on its way.</h2>
                  <p className="text-purple-100 text-xs">We're building something worth waiting for.</p>
                </div>
              </div>
            </div>

           <div className="px-6 py-3">
              <p className="text-sm text-gray-700 mb-3 leading-relaxed">
                Interview Coach is being built during beta. When it launches, you'll get:
              </p>

              <div className="space-y-2 mb-3">
                {[
                  { icon: '🔍', title: 'Pre-interview Power Analysis', desc: 'We analyze your resume against the job description to identify your strengths before you practice.' },
                  { icon: '🎤', title: 'AI-spoken practice sessions', desc: 'A real conversational interview — AI asks the questions out loud, you answer. Unlimited practice for every job.' },
                  { icon: '🏆', title: 'Gamified level progression', desc: 'Level up your interview for each specific job. The more you practice, the more confident (and more hired) you become.' },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-3">
                    <span className="text-xl flex-shrink-0">{item.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                      <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-l-4 border-purple-600 p-3 mb-3">
                <p className="text-sm text-gray-800 font-medium">
                  For now, use the Question of the Day to stay sharp — and your Resume Coach results are already feeding into what Interview Coach will know about you.
                </p>
              </div>

             <button
                onClick={() => setShowComingSoonModal(false)}
                className="block mx-auto rounded-lg py-2 px-8 font-semibold text-sm transition-opacity hover:opacity-90 text-white"
                style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
              >
                Got it — I'll be ready
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Small reusable checklist item with local toggle state
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
