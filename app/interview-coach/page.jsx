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
        .from('profiles').select('*').eq('id', user.id).single();
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
        className="w-64 text-white flex flex-col fixed left-0 top-0 shadow-lg z-40"
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
            Practice interviews. Build real confidence.
          </p>
        </div>

        <div className="flex-1 px-6 pt-3 pb-6 flex flex-col justify-between">
          <div>
            {/* Free Features */}
            <div className="mb-5">
              <h4 className="text-sm font-bold uppercase tracking-wider text-white mb-2">FREE</h4>
              <ul className="space-y-1.5 text-sm">
                <li className="flex items-start"><span className="mr-2">•</span><span>Unlimited generic practice</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>1 job-specific session</span></li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Power Analysis reveal <span className="text-[10px] text-white text-opacity-60">(view only)</span></span>
                </li>
              </ul>
            </div>

            {/* Pro Features */}
            <div className="mb-4">
              <h4 className="text-sm font-bold uppercase tracking-wider text-white mb-2">PRO</h4>
              <ul className="space-y-1.5 text-sm">
                <li className="flex items-start"><span className="mr-2">•</span><span>Pre-interview coaching</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Unlimited job-specific sessions</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>AI-spoken questions</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Video feedback</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Gamified progression</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Core Power, Hidden Power, Power Gaps</span></li>
              </ul>
            </div>
          </div>

          <div className="mt-auto">
            <div className="mb-3 border-b border-gray-400 border-opacity-10"></div>
            <div>
              <p className="text-xs text-white text-opacity-90 leading-relaxed mb-3">
                Users who reach Level 5 on a practice interview are significantly more likely to land the job. Coming soon.
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
      <div className="ml-64 flex-1 flex flex-col h-screen overflow-hidden">
        <MainNav currentPage="interview-coach" userProfile={userProfile} />

        <div className="flex-1 overflow-y-auto">
          <div className="px-8 py-4 max-w-[1400px] mx-auto w-full">

            <div className="grid grid-cols-12 gap-6">

              {/* LEFT: Practice History (8 cols) */}
              <div className="col-span-8 space-y-4">

                {/* Practice History Card */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-1">
                    <h2 className="text-lg font-semibold text-gray-900">Interview Practices</h2>
                    <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded uppercase tracking-wide">Coming Soon</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-5">Your saved practice sessions will appear here — each one tied to a specific job</p>

                  {/* New Practice Button */}
                  <button
                    onClick={() => setShowComingSoonModal(true)}
                    className="w-full border-2 border-dashed border-purple-300 rounded-lg p-4 hover:border-purple-500 hover:bg-purple-50 transition-all flex items-center justify-center gap-3 mb-5 group"
                  >
                    <div className="w-8 h-8 rounded-full bg-purple-100 group-hover:bg-purple-200 flex items-center justify-center transition-colors">
                      <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-semibold text-gray-900">New Interview Practice</div>
                      <div className="text-xs text-gray-500">Choose a job-specific resume or start from scratch</div>
                    </div>
                  </button>

                  {/* Empty State */}
                  <div className="text-center py-10 border border-dashed border-gray-200 rounded-lg bg-gray-50">
                    <div className="text-5xl mb-3">🎤</div>
                    <p className="text-sm font-semibold text-gray-700 mb-1">Your practice sessions will live here</p>
                    <p className="text-xs text-gray-500 max-w-xs mx-auto leading-relaxed">
                      Each practice is tied to a specific job — with a level badge, score history, and coaching notes so you can track improvement over time.
                    </p>

                    {/* Level preview */}
                    <div className="flex items-center justify-center gap-3 mt-5">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <div key={level} className="flex flex-col items-center gap-1">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                            level === 1 ? 'border-purple-300 bg-purple-50 text-purple-500' : 'border-gray-200 bg-white text-gray-300'
                          }`}>
                            {level}
                          </div>
                          <span className="text-[9px] text-gray-400">L{level}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2">Practice for each job to unlock levels and track your confidence</p>
                  </div>
                </div>

                {/* Question of the Day */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-base font-semibold text-gray-900">Question of the Day</h2>
                    <span className="text-[10px] text-gray-400">Think it through — no pressure</span>
                  </div>
                  <div className="bg-purple-50 border-l-4 border-purple-600 p-4 rounded-r mt-3">
                    <p className="text-sm text-gray-800 font-medium leading-relaxed">{questionOfTheDay}</p>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-xs text-gray-500">Use the STAR method: Situation, Task, Action, Result</p>
                    <button
                      onClick={() => setShowComingSoonModal(true)}
                      className="text-xs text-purple-600 font-semibold hover:text-purple-700"
                    >
                      Practice this question →
                    </button>
                  </div>
                </div>

              </div>

              {/* RIGHT: Stats + Readiness (4 cols) */}
              <div className="col-span-4 space-y-4">

                {/* Practice Stats */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                  <h2 className="text-base font-semibold text-gray-900 mb-1">Practice Stats</h2>
                  <p className="text-xs text-gray-500 mb-4">Your interview training at a glance</p>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-xs font-medium text-gray-700">Total Sessions</p>
                        <p className="text-[10px] text-gray-400">Across all jobs</p>
                      </div>
                      <span className="text-2xl font-bold text-gray-300">0</span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-xs font-medium text-gray-700">Best Level Reached</p>
                        <p className="text-[10px] text-gray-400">Max L5 per job</p>
                      </div>
                      <span className="text-2xl font-bold text-gray-300">--</span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-xs font-medium text-gray-700">Practice Streak</p>
                        <p className="text-[10px] text-gray-400">Consecutive days</p>
                      </div>
                      <span className="text-2xl font-bold text-gray-300">0</span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-xs font-medium text-gray-700">Jobs Practiced</p>
                        <p className="text-[10px] text-gray-400">Unique job targets</p>
                      </div>
                      <span className="text-2xl font-bold text-gray-300">0</span>
                    </div>
                  </div>

                  <p className="text-[10px] text-gray-400 text-center mt-3">Start practicing to see your stats here</p>
                </div>

                {/* Interview Readiness Checklist */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                  <h2 className="text-base font-semibold text-gray-900 mb-1">Interview Readiness</h2>
                  <p className="text-xs text-gray-500 mb-4">Quick prep before any interview</p>

                  <div className="space-y-2">
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

                  <div className="mt-4 bg-purple-50 border-l-4 border-purple-600 p-2.5 rounded-r">
                    <p className="text-xs text-gray-700 leading-snug">
                      Candidates who practice out loud — not just in their head — are significantly more confident and articulate in real interviews.
                    </p>
                  </div>
                </div>

                {/* Pro Upgrade Card (free users only) */}
                {!isPro && (
                  <div className="bg-white rounded-lg shadow-sm border border-purple-200 p-5">
                    <h2 className="text-base font-semibold text-gray-900 mb-1">Unlock Pro Interview Coaching</h2>
                    <p className="text-xs text-gray-500 mb-3">Coming soon with Pro</p>

                    <div className="space-y-2 mb-4">
                      {[
                        'Pre-interview Power Analysis',
                        'Core Power, Hidden Power, Power Gaps',
                        'AI-spoken practice questions',
                        'Unlimited job-specific sessions',
                        'Gamified level progression',
                        'Video feedback',
                      ].map((feature) => (
                        <div key={feature} className="flex items-center gap-2 text-xs text-gray-600">
                          <span className="text-purple-500 flex-shrink-0">✓</span>
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => setShowComingSoonModal(true)}
                      className="w-full bg-purple-600 text-white rounded-lg py-2 text-xs font-semibold hover:bg-purple-700 transition-colors"
                    >
                      Upgrade to Pro
                    </button>
                  </div>
                )}
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

            <div className="px-6 py-5">
              <p className="text-sm text-gray-700 mb-4 leading-relaxed">
                Interview Coach is being built during beta. When it launches, you'll get:
              </p>

              <div className="space-y-3 mb-5">
                {[
                  { icon: '🔍', title: 'Pre-interview Power Analysis', desc: 'We analyze your resume against the job description to identify your Core Power, Hidden Power, and Power Gaps before you practice.' },
                  { icon: '🎤', title: 'AI-spoken practice sessions', desc: 'A real conversational interview — AI asks the questions out loud, you answer. Unlimited practice for every job you apply to.' },
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

              <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-l-4 border-purple-600 p-3 mb-4">
                <p className="text-sm text-gray-800 font-medium">
                  For now, use the Question of the Day to stay sharp — and your Resume Coach results are already feeding into what Interview Coach will know about you.
                </p>
              </div>

              <button
                onClick={() => setShowComingSoonModal(false)}
                className="w-full bg-purple-600 text-white rounded-lg py-2 font-semibold text-sm hover:bg-purple-700 transition-colors"
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
      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors text-left"
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
      <span className={`text-xs transition-colors ${checked ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
        {label}
      </span>
    </button>
  );
}
