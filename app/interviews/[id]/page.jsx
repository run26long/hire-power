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

  const breadcrumbItems = [
    { label: 'Interview Coach', path: '/my-interviews' },
    { label: `${jobTitle} at ${jobCompany}` }
  ];

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <MainNav currentPage="my-interviews" userProfile={userProfile} />
      <Breadcrumb items={breadcrumbItems} />

      {/* Main layout: resume left, coaching right — mirrors Resume Coach and Career Coach */}
      <div className="flex-1 flex overflow-hidden" style={{ height: 'calc(100vh - 160px)' }}>
        <div className="flex-1 flex gap-6 p-6 max-w-7xl mx-auto w-full">

          {/* Left Column — Resume Preview (70-75%) */}
          <div className="flex-[3] bg-white rounded-lg shadow-sm border border-gray-200 overflow-y-auto">
            <div className="p-8">

              {/* Job header */}
              <div className="mb-6 pb-4 border-b border-gray-100">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-2xl">🎯</span>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{jobTitle}</h2>
                    <p className="text-sm text-gray-500">{jobCompany}</p>
                  </div>
                  <span className="ml-auto text-[10px] bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded uppercase tracking-wide">Coming Soon</span>
                </div>
              </div>

              {/* Power Analysis Preview — the three pillars */}
              <div className="mb-6">
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Power Analysis</h3>
                <p className="text-xs text-gray-500 mb-4">
                  Before you practice, your coach analyzes your resume against this job to identify three things.
                </p>

                <div className="space-y-3">
                  {/* Core Power */}
                  <div className="border border-green-200 rounded-lg p-4 bg-green-50">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-base">✅</span>
                      <h4 className="text-sm font-bold text-green-800">Core Power</h4>
                      <span className="text-[10px] bg-green-200 text-green-700 font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ml-auto">Coming Soon</span>
                    </div>
                    <p className="text-xs text-green-700 leading-relaxed">
                      Your direct matches — the experience and skills you have that clearly qualify you for this role. We'll coach you on how to talk about these confidently and specifically.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {['Your matched skills will', 'appear here as tags', 'when Interview Coach launches'].map((tag, i) => (
                        <span key={i} className="bg-green-100 border border-green-200 text-green-600 text-[10px] px-2 py-0.5 rounded-full opacity-50">{tag}</span>
                      ))}
                    </div>
                  </div>

                  {/* Hidden Power */}
                  <div className="border border-yellow-200 rounded-lg p-4 bg-yellow-50">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-base">💡</span>
                      <h4 className="text-sm font-bold text-yellow-800">Hidden Power</h4>
                      <span className="text-[10px] bg-yellow-200 text-yellow-700 font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ml-auto">Coming Soon</span>
                    </div>
                    <p className="text-xs text-yellow-800 leading-relaxed">
                      Transferable skills and experience you have that aren't an obvious match — but could be compelling with the right framing. We'll coach you on how to bridge the gap.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {['Skills you have but', "don't see as relevant", 'will surface here'].map((tag, i) => (
                        <span key={i} className="bg-yellow-100 border border-yellow-200 text-yellow-600 text-[10px] px-2 py-0.5 rounded-full opacity-50">{tag}</span>
                      ))}
                    </div>
                  </div>

                  {/* Power Gaps */}
                  <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-base">⚠️</span>
                      <h4 className="text-sm font-bold text-red-800">Power Gaps</h4>
                      <span className="text-[10px] bg-red-200 text-red-700 font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ml-auto">Coming Soon</span>
                    </div>
                    <p className="text-xs text-red-800 leading-relaxed">
                      Requirements the job asks for that you don't currently have. We'll coach you on how to address these honestly without tanking your chances.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {["What you're missing", 'and how to address it', 'without apologizing'].map((tag, i) => (
                        <span key={i} className="bg-red-100 border border-red-200 text-red-600 text-[10px] px-2 py-0.5 rounded-full opacity-50">{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Practice session history preview */}
              <div>
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Practice Sessions</h3>
                <p className="text-xs text-gray-500 mb-4">Your level progression for this specific job will track here.</p>

                {/* Level progression preview */}
                <div className="flex items-center gap-3 mb-4">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <div key={level} className="flex-1">
                      <div className="flex flex-col items-center gap-1.5">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                          level === 1 ? 'border-dashed border-purple-300 bg-purple-50 text-purple-400' : 'border-dashed border-gray-200 bg-gray-50 text-gray-300'
                        }`}>
                          {level}
                        </div>
                        <div className="text-[9px] text-gray-400 text-center leading-tight">
                          {level === 1 ? 'First practice' :
                           level === 2 ? '3 practices' :
                           level === 3 ? '5 practices' :
                           level === 4 ? '7 practices' : 'Mastery'}
                        </div>
                      </div>
                      {level < 5 && (
                        <div className="h-px bg-gray-200 mt-2 mx-1" />
                      )}
                    </div>
                  ))}
                </div>

                {/* Empty practice history */}
                <div className="text-center py-8 border border-dashed border-gray-200 rounded-lg bg-gray-50">
                  <div className="text-3xl mb-2">🎤</div>
                  <p className="text-xs font-semibold text-gray-600 mb-1">No practices yet for this job</p>
                  <p className="text-xs text-gray-400">Start your first session to begin leveling up</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column — Coaching Panel (25-30%) */}
          <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-y-auto">

            {/* Sticky header — matches career/resume coach pattern */}
            <div className="sticky top-0 bg-white z-10 p-6 pb-4 mb-4 border-b border-gray-200">
              <h3 className="text-center font-semibold text-sm mb-3">
                Interview Preparation
              </h3>

              {/* Progress steps — mirrors the resume coach journey bar */}
              <div className="relative">
                <div className="absolute top-3 left-0 right-0 h-0.5 bg-gray-200"></div>
                <div className="relative flex justify-between">
                  {['Analyze', 'Coach', 'Practice', 'Feedback'].map((step, index) => (
                    <div key={step} className="flex flex-col items-center">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold z-10 bg-white border-2 border-gray-200 text-gray-300">
                        ○
                      </div>
                      <span className="text-xs mt-1 text-gray-400">{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Coaching Panel Content */}
            <div className="px-6 pb-6 space-y-4">

              {/* Coming Soon state — what this panel will do */}
              <div className="text-center py-4">
                <span className="inline-block text-[10px] bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded uppercase tracking-wide mb-3">Coming Soon</span>
                <h3 className="font-semibold text-gray-900 mb-1">Pre-Interview Coaching</h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  When Interview Coach launches, this panel will walk you through your Power Analysis and coach you on how to handle each area before you practice.
                </p>
              </div>

              {/* What will happen here — preview of the flow */}
              <div className="space-y-2">
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <span className="text-base flex-shrink-0">1️⃣</span>
                  <div>
                    <p className="text-xs font-semibold text-gray-800">Power Analysis coaching</p>
                    <p className="text-[10px] text-gray-500 leading-snug">Your coach walks through Core Power, Hidden Power, and Power Gaps — with specific advice for each.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <span className="text-base flex-shrink-0">2️⃣</span>
                  <div>
                    <p className="text-xs font-semibold text-gray-800">Start Interview Practice</p>
                    <p className="text-[10px] text-gray-500 leading-snug">When ready, the practice modal opens — AI speaks questions, you answer, you get real-time feedback.</p>
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

              {/* CTA */}
              <div className="pt-2">
                <div className="bg-purple-50 border-l-4 border-purple-600 p-3 rounded-r mb-4">
                  <p className="text-xs text-gray-700 leading-snug">
                    <strong>Good news:</strong> Everything your Resume Coach learned about you — your achievements, your hidden skills, your career direction — is already here. When Interview Coach launches, it will know your story.
                  </p>
                </div>

                <button
                  onClick={() => router.push('/my-interviews')}
                  className="w-full border border-gray-300 text-gray-600 rounded-lg py-2 text-xs font-medium hover:bg-gray-50 transition-colors"
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
