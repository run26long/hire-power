'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import MainNav from '../../components/MainNav';
import Breadcrumb from '../../components/Breadcrumb';

export default function InterviewDetailPage() {
  const router = useRouter();
  const params = useParams();
  const supabase = createClient();

  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPro, setIsPro] = useState(false);

  // For the shell: mock job data so the page renders sensibly
  // When built out, this will load from the database via params.id
  const [jobTitle] = useState('Your Target Job');
  const [jobCompany] = useState('Company Name');

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

  const breadcrumbItems = [
    { label: 'Interview Coach', path: '/my-interviews' },
    { label: `${jobTitle} at ${jobCompany}` }
  ];

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <MainNav currentPage="my-interviews" userProfile={userProfile} />
      <Breadcrumb items={breadcrumbItems} />

      <div className="flex-1 flex overflow-hidden" style={{ height: 'calc(100vh - 160px)' }}>
        <div className="flex-1 flex gap-6 p-6 max-w-7xl mx-auto w-full">

          {/* Left Column (70-75%) — fixed, no scroll */}
          <div className="flex-[3] bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col">
            <div className="p-6 flex flex-col gap-4">

              {/* Job header */}
              <div className="pb-3 border-b border-gray-100 flex items-center gap-3">
                <span className="text-2xl">🎯</span>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{jobTitle}</h2>
                  <p className="text-sm text-gray-500">{jobCompany}</p>
                </div>
                <span className="ml-auto text-[10px] bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded uppercase tracking-wide">Coming Soon</span>
              </div>

              {/* Practice Sessions */}
              <div>
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-1">Practice Sessions</h3>
                <p className="text-xs text-gray-500 mb-3">Your level progression for this specific job will track here.</p>

                <div className="flex items-center gap-3 mb-3">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <div key={level} className="flex-1">
                      <div className="flex flex-col items-center gap-1">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                          level === 1 ? 'border-dashed border-purple-300 bg-purple-50 text-purple-400' : 'border-dashed border-gray-200 bg-gray-50 text-gray-300'
                        }`}>
                          {level}
                        </div>
                        <div className="text-[9px] text-gray-400 text-center">
                          {level === 5 ? 'Mastery' : `L${level}`}
                        </div>
                      </div>
                      {level < 5 && <div className="h-px bg-gray-200 mt-2 mx-1" />}
                    </div>
                  ))}
                </div>

                <div className="text-center py-6 border border-dashed border-gray-200 rounded-lg bg-gray-50">
                  <div className="text-3xl mb-1">🎤</div>
                  <p className="text-xs font-semibold text-gray-600 mb-1">No practices yet for this job</p>
                  <p className="text-xs text-gray-400">Start your first session to begin leveling up</p>
                </div>
              </div>

              {/* Power Analysis */}
              <div>
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-2">Power Analysis</h3>
                <div className="grid grid-cols-3 gap-2">
                  <div className="border border-green-200 rounded-lg p-3 bg-green-50">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-sm">✅</span>
                      <h4 className="text-xs font-bold text-green-800">Core Power</h4>
                    </div>
                    <p className="text-[10px] text-green-700 leading-relaxed">Your direct matches — skills and experience that clearly qualify you for this role.</p>
                  </div>
                  <div className="border border-yellow-200 rounded-lg p-3 bg-yellow-50">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-sm">💡</span>
                      <h4 className="text-xs font-bold text-yellow-800">Hidden Power</h4>
                    </div>
                    <p className="text-[10px] text-yellow-800 leading-relaxed">Transferable skills that aren't an obvious match but could be compelling with the right framing.</p>
                  </div>
                  <div className="border border-red-200 rounded-lg p-3 bg-red-50">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-sm">⚠️</span>
                      <h4 className="text-xs font-bold text-red-800">Power Gaps</h4>
                    </div>
                    <p className="text-[10px] text-red-800 leading-relaxed">Requirements you don't currently have and how to address them honestly without tanking your chances.</p>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Right Column (25-30%) — scrollable */}
          <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-y-auto">
            <div className="sticky top-0 bg-white z-10 p-4 pb-3 border-b border-gray-200">
              <h3 className="text-center font-semibold text-sm mb-3">Interview Preparation</h3>
              <div className="relative">
                <div className="absolute top-3 left-0 right-0 h-0.5 bg-gray-200"></div>
                <div className="relative flex justify-between">
                  {['Analyze', 'Coach', 'Practice', 'Feedback'].map((step) => (
                    <div key={step} className="flex flex-col items-center">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold z-10 bg-white border-2 border-gray-200 text-gray-300">○</div>
                      <span className="text-xs mt-1 text-gray-400">{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-5 pb-5 pt-1 space-y-1">
              <div className="text-center py-3">
                <span className="inline-block text-[10px] bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded uppercase tracking-wide mb-2">Coming Soon</span>
              
              </div>

              <div className="space-y-2 mt-1">
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <span className="text-base flex-shrink-0">1️⃣</span>
                  <div>
                    <p className="text-xs font-semibold text-gray-800">Power Analysis coaching</p>
                    <p className="text-[10px] text-gray-500 leading-snug">Your coach walks through Core Power, Hidden Power, and Power Gaps with specific advice for each.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <span className="text-base flex-shrink-0">2️⃣</span>
                  <div>
                    <p className="text-xs font-semibold text-gray-800">Start Interview Practice</p>
                    <p className="text-[10px] text-gray-500 leading-snug">When ready, the practice modal opens. AI speaks questions, you answer, you get real-time feedback.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <span className="text-base flex-shrink-0">3️⃣</span>
                  <div>
                    <p className="text-xs font-semibold text-gray-800">Review and level up</p>
                    <p className="text-[10px] text-gray-500 leading-snug">See what landed, what to improve, and come back to practice again until you hit Level 5.</p>
                  </div>
                </div>
              </div>

               <div className="pt-4">
                <button
                  onClick={() => router.push('/interview-coach')}
                  className="block mx-auto border border-gray-300 text-gray-500 rounded-lg py-1.5 px-6 text-[11px] font-medium hover:bg-gray-50 transition-colors"
                >
                  ← Back to Interview Coach
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
