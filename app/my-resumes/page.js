'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import MainNav from '../components/MainNav';
import Breadcrumb from '../components/Breadcrumb';
import { TIERS } from '@/lib/subscription';

export default function MyResumesPage() {
  const router = useRouter();
  const supabase = createClient();
  
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUser(user);

      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch('/api/my-resumes/data', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to load data');
      }
      
      const resData = await response.json();
      setData(resData);
      setUserProfile(resData.userProfile);
      
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  function getScoreColor(score) {
    if (!score) return 'text-gray-400';
    if (score >= 85) return 'text-green-600';
    if (score >= 71) return 'text-yellow-600';
    return 'text-red-600';
  }

  function getScoreTier(score) {
    if (!score) return 'Not Assessed';
    if (score >= 85) return 'Excellent';
    if (score >= 71) return 'Strong';
    return 'Needs Improvement';
  }

  function getCircleColor(score) {
    if (score >= 85) return '#10b981';
    if (score >= 71) return '#f59e0b';
    return '#ef4444';
  }

  function getNextStep() {
    if (!data?.stats.hasCoreResume) {
      return { label: 'Build Core Resume', action: () => router.push('/my-career') };
    }
    
    if (!data?.coreResume) {
      return { label: 'Build Core Resume', action: () => router.push('/my-career') };
    }

    const journeyStep = data.coreResume.journey_step;
    
    if (journeyStep === 'save' || journeyStep === 'completed') {
      if (data.stats.versionCount === 0) {
        return { 
          label: 'Tailor for Job', 
          action: () => router.push(`/resume/${data.coreResume.id}`) 
        };
      } else {
        return { 
          label: 'Practice Interview or Create Tailored Resume',
          actions: [
            { label: 'Practice Interview', action: () => router.push('/my-interviews') },
            { label: 'Create Tailored Resume', action: () => router.push(`/resume/${data.coreResume.id}`) }
          ]
        };
      }
    }
    
    return { 
      label: 'Continue Core Resume', 
      action: () => router.push(`/resume/${data.coreResume.id}`) 
    };
  }

  function formatDate(dateString) {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-purple-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const breadcrumbItems = [
    { label: 'My Resumes' }
  ];

  const nextStep = getNextStep();
  const isPro = data?.userTier === TIERS.PRO;
  const score = data?.coreResume?.current_score || null;

  // Journey steps for progress bar
  const steps = ['review', 'assess', 'coach', 'improve', 'polish', 'save'];
  const currentIndex = data?.coreResume?.journey_step ? steps.indexOf(data.coreResume.journey_step) : -1;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <MainNav currentPage="my-resumes" userProfile={userProfile} />
      <Breadcrumb items={breadcrumbItems} description="" />

      <div className="flex-1 px-8 py-4 max-w-[1400px] mx-auto w-full">
        
        {/* 5-Step Hero Bar */}
        {data?.coreResume && (
          <div className="mb-5">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="grid grid-cols-5 gap-6">
                {/* 1. Core Resume Status */}
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm ${
                    data.coreResume.current_score >= 85 ? 'bg-green-50 border border-green-200' : 'bg-purple-50 border border-purple-200'
                  }`}>
                    <svg className={`w-6 h-6 ${
                      data.coreResume.current_score >= 85 ? 'text-green-600' : 'text-purple-600'
                    }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 font-medium mb-0.5">Core Resume</div>
                    <div className={`text-sm font-bold flex items-center gap-1 ${getScoreColor(data.coreResume.current_score)}`}>
                      <div className={`w-2 h-2 rounded-full ${data.coreResume.current_score >= 85 ? 'bg-green-600' : 'bg-purple-600'}`}></div>
                      {data.coreResume.current_score >= 85 ? 'Optimized' : getScoreTier(data.coreResume.current_score)}
                    </div>
                  </div>
                </div>

                {/* 2. Resume Strength */}
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center shadow-sm border border-purple-200">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 font-medium mb-0.5">Resume Strength</div>
                    <div className={`text-sm font-bold ${getScoreColor(data.coreResume.current_score)}`}>
                      {getScoreTier(data.coreResume.current_score)}
                    </div>
                  </div>
                </div>

                {/* 3. Tailored Versions */}
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center shadow-sm border border-purple-200">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 font-medium mb-0.5">Tailored Versions</div>
                    <div className="text-sm font-bold text-gray-900">
                      <span className="text-purple-600">{data.stats.versionCount} Active</span>
                      {isPro && <span className="text-xs font-normal text-gray-500 ml-1">Unlimited</span>}
                    </div>
                  </div>
                </div>

                {/* 4. Last Updated */}
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center shadow-sm border border-gray-200">
                    <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 font-medium mb-0.5">Last Updated</div>
                    <div className="text-sm font-bold text-gray-900">{formatDate(data.coreResume.updated_at)}</div>
                  </div>
                </div>

                {/* 5. Next Step */}
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center shadow-sm border border-purple-200">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-gray-500 font-medium mb-0.5">Next Step</div>
                    <button
                      onClick={() => router.push(`/resume/${data.coreResume.id}`)}
                      className="text-sm font-bold text-purple-600 hover:text-purple-700 truncate block text-left"
                    >
                      {nextStep.actions ? 'Tailor for a Job →' : `${nextStep.label} →`}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content: 3-Column Layout */}
        {data?.coreResume && (
          <div className="grid grid-cols-12 gap-5">
            
            {/* Column 1: Core Resume Thumbnail (33%) */}
            <div className="col-span-4">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Core Resume</h2>
                
                <button
                  onClick={() => router.push(`/resume/${data.coreResume.id}`)}
                  className="w-full group"
                >
                  <div className="relative bg-white rounded-xl overflow-hidden shadow-md border-2 border-gray-200 group-hover:border-purple-400 transition-all" style={{ aspectRatio: '8.5/11' }}>
                    {data.coreResume.thumbnail_url ? (
                      <img 
                        src={data.coreResume.thumbnail_url} 
                        alt="Resume preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-50">
                        <div className="text-center">
                          <div className="text-4xl mb-2">📄</div>
                          <div className="text-xs text-gray-500">Resume Preview</div>
                        </div>
                      </div>
                    )}
                    
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-purple-900/95 via-purple-800/70 to-transparent px-4 py-3">
                      <div className="text-white text-xs font-bold uppercase tracking-wider mb-1">CORE RESUME</div>
                      <div className="text-white/90 text-xs">Last Updated: <span className="font-medium">{formatDate(data.coreResume.updated_at)}</span></div>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Column 2: Score + Ready to Apply (33%) */}
            <div className="col-span-4">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
                
                {/* 4-Step Journey Progress */}
                <div>
                  <h3 className="text-center font-semibold text-sm mb-3">
                    {userProfile?.display_name ? `${userProfile.display_name.split(' ')[0]}'s ` : ''}{data.coreResume.display_name || 'Core Resume'} Progress
                  </h3>
                  
                  <div className="relative">
                    <div className="absolute top-3 left-0 right-0 h-0.5 bg-gray-300">
                      <div 
                        className="h-full bg-purple-600 transition-all duration-300"
                        style={{ width: `${currentIndex >= 0 ? (currentIndex / 3) * 100 : 0}%` }}
                      />
                    </div>
                    
                    <div className="relative flex justify-between">
                      {['Build', 'Assess', 'Improve', 'Complete'].map((step, index) => {
                        const journeyStepMap = {
                          0: currentIndex < 0, // Build
                          1: currentIndex >= 1 && currentIndex < 2, // Assess (assess step)
                          2: currentIndex >= 2 && currentIndex < 5, // Improve (coach/improve/polish)
                          3: currentIndex >= 5 // Complete (save)
                        };
                        const isActive = journeyStepMap[index];
                        const isPast = index < (currentIndex < 0 ? 0 : currentIndex >= 5 ? 4 : currentIndex >= 2 ? 3 : currentIndex >= 1 ? 2 : 1);
                        
                        return (
                          <div key={step} className="flex flex-col items-center">
                            <div className={`
                              w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold z-10
                              ${isPast ? 'bg-purple-600 text-white' : 
                                isActive ? 'bg-purple-600 text-white' : 
                                'bg-white border-2 border-gray-300 text-gray-400'}
                            `}>
                              {isPast ? '✓' : isActive ? '●' : '○'}
                            </div>
                            <span className={`text-xs mt-1 ${
                              isActive ? 'text-purple-600 font-semibold' :
                              isPast ? 'text-purple-600' :
                              'text-gray-400'
                            }`}>
                              {step}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Score Section */}
                <div>
                  <div className="text-center mb-2">
                    <div className="text-sm text-gray-600 font-medium">Resume Power Score</div>
                  </div>
                  
                  <div className="flex items-baseline justify-center gap-1 mb-3">
                    <span className="text-4xl font-bold text-gray-900">{score || 62}</span>
                    <span className="text-lg text-gray-600">/100</span>
                  </div>

                  {/* Progress Bar */}
                  <div className="relative mb-4">
                    <div className="h-8 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${
                          (score || 62) >= 85 ? 'bg-gradient-to-r from-green-400 to-green-500' :
                          (score || 62) >= 70 ? 'bg-gradient-to-r from-yellow-400 to-yellow-500' :
                          'bg-gradient-to-r from-red-400 to-red-500'
                        }`}
                        style={{ width: `${score || 62}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="relative h-16 mb-2">
                    <div className="flex h-2">
                      <div className="bg-red-500 rounded-l-full" style={{ width: '70%' }}></div>
                      <div className="bg-yellow-500" style={{ width: '14%' }}></div>
                      <div className="bg-green-500 rounded-r-full" style={{ width: '16%' }}></div>
                    </div>
                    
                    <div className="absolute top-0 left-[70%] -translate-x-1/2 -translate-y-px">
                      <div className="w-3 h-3 rounded-full bg-white border-2 border-red-500"></div>
                    </div>
                    <div className="absolute top-0 left-[84%] -translate-x-1/2 -translate-y-px">
                      <div className="w-3 h-3 rounded-full bg-white border-2 border-yellow-500"></div>
                    </div>
                    
                    <div className="flex mt-2">
                      <div className="text-center text-[10px] text-gray-700 leading-tight" style={{ width: '70%' }}>
                        <div className="font-medium">Needs Improvement</div>
                        <div className="text-gray-500">(0-70)</div>
                      </div>
                      <div className="text-center text-[10px] text-gray-700 leading-tight" style={{ width: '14%' }}>
                        <div className="font-medium">Strong</div>
                        <div className="text-gray-500">(71-84)</div>
                      </div>
                      <div className="text-center text-[10px] text-gray-700 leading-tight" style={{ width: '16%' }}>
                        <div className="font-medium">Excellent</div>
                        <div className="text-gray-500">(85-100)</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Ready to Apply Card - Match mockup exactly */}
                <div className="bg-gradient-to-br from-purple-100 via-pink-100 to-purple-50 border-2 border-purple-300 rounded-2xl p-6 relative shadow-sm">
                  {/* Bullseye Icon - styled like mockup */}
                  <div className="absolute top-5 right-5 opacity-20">
                    <div className="relative w-16 h-16">
                      <svg className="w-16 h-16 text-purple-400" fill="none" viewBox="0 0 64 64">
                        <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="2"/>
                        <circle cx="32" cy="32" r="20" stroke="currentColor" strokeWidth="2"/>
                        <circle cx="32" cy="32" r="12" stroke="currentColor" strokeWidth="2"/>
                        <circle cx="32" cy="32" r="4" fill="currentColor"/>
                      </svg>
                    </div>
                  </div>

                  <div className="relative z-10">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Ready to apply?</h3>
                    <p className="text-sm text-gray-600 mb-4">Create a job-specific version in minutes.</p>
                    
                    <ul className="space-y-2.5 mb-5">
                      <li className="flex items-center gap-2.5 text-sm text-gray-800">
                        <div className="w-2 h-2 rounded-full bg-purple-600 flex-shrink-0"></div>
                        <span>Target key skills</span>
                      </li>
                      <li className="flex items-center gap-2.5 text-sm text-gray-800">
                        <div className="w-2 h-2 rounded-full bg-purple-600 flex-shrink-0"></div>
                        <span>Match job keywords</span>
                      </li>
                      <li className="flex items-center gap-2.5 text-sm text-gray-800">
                        <div className="w-2 h-2 rounded-full bg-purple-600 flex-shrink-0"></div>
                        <span>Stand out to hiring teams</span>
                      </li>
                    </ul>

                    <button
                      onClick={() => router.push(`/resume/${data.coreResume.id}`)}
                      className="w-full bg-purple-600 text-white px-5 py-3.5 rounded-xl hover:bg-purple-700 transition-all font-bold text-base shadow-lg hover:shadow-xl"
                    >
                      Tailor for Job →
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Column 3: Job-Specific Resumes (33%) */}
            <div className="col-span-4">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-5">Job-Specific Resumes</h2>

                <div className="grid grid-cols-2 gap-3">
                  {/* Create New Card - FIRST */}
                  <button
                    onClick={() => router.push(`/resume/${data.coreResume.id}`)}
                    className="border-2 border-dashed border-gray-300 rounded-xl p-4 hover:border-purple-400 hover:bg-purple-50 transition-all flex flex-col items-center justify-center aspect-square group"
                  >
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center mb-2 group-hover:bg-purple-200 transition-all">
                      <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-sm text-gray-900 mb-0.5">Create New</div>
                      <div className="text-[10px] text-gray-600 leading-tight">Tailor for a job</div>
                    </div>
                  </button>

                  {/* Job Version Cards - More compact */}
                  {data.resumeVersions.slice(0, 7).map((version) => (
                    <div
                      key={version.id}
                      onClick={() => {
                        if (isPro) {
                          router.push(`/resume/${data.coreResume.id}?version=${version.id}`);
                        } else {
                          router.push(`/match-score/${version.id}`);
                        }
                      }}
                      className="border-2 border-gray-200 rounded-xl p-3 hover:border-purple-400 hover:shadow-lg transition-all cursor-pointer bg-white group relative aspect-square flex flex-col"
                    >
                      {/* Edit Icon */}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/resume/${data.coreResume.id}?version=${version.id}`);
                        }}
                        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center hover:bg-gray-50 hover:border-purple-400 transition-all shadow-sm opacity-0 group-hover:opacity-100 z-10"
                      >
                        <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>

                      <div className="flex-1 flex flex-col">
                        <div className="mb-2">
                          <div className="text-xs font-bold text-gray-900 mb-0.5 line-clamp-1 pr-6">
                            {version.job_title}
                          </div>
                          <div className="text-[10px] text-gray-600 truncate">
                            {version.job_company}
                          </div>
                        </div>
                        
                        {/* Circular Badge - Smaller */}
                        <div className="flex justify-center my-2">
                          <div className="relative">
                            <svg className="w-12 h-12 transform -rotate-90">
                              <circle cx="24" cy="24" r="20" stroke="#e5e7eb" strokeWidth="3" fill="none" />
                              <circle
                                cx="24" cy="24" r="20"
                                stroke={getCircleColor(version.match_score)}
                                strokeWidth="3" fill="none"
                                strokeDasharray={`${2 * Math.PI * 20}`}
                                strokeDashoffset={`${2 * Math.PI * 20 * (1 - version.match_score / 100)}`}
                                strokeLinecap="round"
                              />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="text-center">
                                <div className={`text-xs font-bold ${getScoreColor(version.match_score)}`}>
                                  {version.match_score}%
                                </div>
                                <div className="text-[8px] text-gray-500 uppercase font-semibold">Match</div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <button 
                          className="w-full bg-purple-600 text-white py-1.5 rounded-lg text-xs font-bold hover:bg-purple-700 transition-all shadow-sm mt-auto"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/resume/${data.coreResume.id}?version=${version.id}`);
                          }}
                        >
                          Open
                        </button>
                      </div>

                      <div className="flex items-center justify-center gap-1 text-[9px] text-gray-500 mt-2 pt-2 border-t border-gray-200">
                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{formatDate(version.updated_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!data?.coreResume && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <div className="text-6xl mb-4">📄</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Build Your Core Resume</h2>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Start by having a career conversation with our AI coach. We'll help you build a resume targeted to where you want to go.
            </p>
            <button
              onClick={() => router.push('/my-career')}
              className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors font-medium"
            >
              Start Career Conversation
            </button>
          </div>
        )}
      </div>
    </div>
  );
}