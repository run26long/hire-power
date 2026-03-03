'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import MainNav from '../components/MainNav';
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

  const nextStep = getNextStep();
  const isPro = data?.userTier === TIERS.PRO;
  const score = data?.coreResume?.current_score || null;

  // Journey steps for progress bar
  const steps = ['review', 'assess', 'coach', 'improve', 'polish', 'save'];
  const currentIndex = data?.coreResume?.journey_step ? steps.indexOf(data.coreResume.journey_step) : -1;

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <MainNav currentPage="my-resumes" userProfile={userProfile} />

      <div className="flex-1 overflow-y-auto">
        <div className="px-8 py-4 max-w-[1400px] mx-auto w-full">
          
          {/* New Top Bar - 2 boxes aligned with columns below */}
          {data?.coreResume && (
            <div className="mb-5">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2.5">
                <div className="grid grid-cols-12 gap-2.5">
                  
                  {/* Coaching Message - aligns with columns 1+2 below */}
                  <div className="col-span-8 bg-gray-50 border border-gray-200 rounded-lg p-2.5">
                    <h3 className="text-lg font-bold text-gray-900 mb-0.5">Welcome to Resume Coach!</h3>
                    <p className="text-xs text-gray-600 leading-snug">
                      Your coach walks you through building, assessing, and improving your resume—not just tips, but guided steps. Just like your career moves, you'll always know what's next. Pro members get conversational coaching where we extract hidden skills and achievements and make all the improvements for you.
                    </p>
                  </div>
                  
                  {/* Status + Next Step - side by side - aligns with column 3 below */}
                  <div className="col-span-4 grid grid-cols-2 gap-2">
                    
                    {/* Current Status */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-2 flex flex-col">
                      <div className="text-sm font-bold text-gray-900 mb-2 text-center">CURRENT STATUS</div>
                      <div className="space-y-1.5 flex-1 flex flex-col justify-center">
                        <div className="text-center">
                          <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Core Resume: </span>
                          <span className={`text-sm font-bold ${getScoreColor(data.coreResume.current_score)}`}>
                            {data.coreResume.current_score >= 85 ? 'Complete!' : getScoreTier(data.coreResume.current_score)}
                          </span>
                        </div>
                        <div className="text-center">
                          <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Job-Specific: </span>
                          <span className="text-sm font-bold text-purple-600">{data.stats.versionCount} Created</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Next Step */}
                    <div 
                      onClick={() => router.push(`/resume/${data.coreResume.id}`)}
                      className="bg-gradient-to-br from-purple-600 to-purple-700 border-2 border-purple-600 rounded-lg px-2 py-2 flex flex-col shadow-sm hover:shadow-md transition-all cursor-pointer group"
                    >
                      <div className="text-sm font-bold text-white mb-2 text-center">NEXT STEP</div>
                      <div className="flex-1 flex items-center justify-center">
                        <div className="text-lg font-bold text-white group-hover:text-purple-50 transition-colors leading-tight text-center">
                          {nextStep.actions ? 'Tailor for Job' : nextStep.label.replace('Continue Core Resume', 'Continue building your core resume')}
                        </div>
                      </div>
                    </div>
                    
                  </div>
                  
                </div>
              </div>
            </div>
          )}

          {/* Main Content: 2-Column Layout */}
          {data?.coreResume && (
            <div className="grid grid-cols-12 gap-5">
              
              {/* Combined Column 1+2: Core Resume Card (67%) */}
              <div className="col-span-8">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <h2 className="text-lg font-bold text-gray-900 mb-1 text-center">Core Resume</h2>
                  <p className="text-xs text-gray-600 mb-4 text-center leading-snug">
                    Start here! Your core resume represents all your skills and experience. Your resume coach will assess current content and give you specific recommendations to improve it.
                  </p>
                  
                  <div className="grid grid-cols-5 gap-5">
                    {/* Left side: Thumbnail */}
                    <div className="col-span-2">
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

                    {/* Right side: Progress, Score, Status, Ready to Apply */}
                    <div className="col-span-3 space-y-3">

                      {/* Progress Bar - no card, with divider */}
                      <div className="pb-2.5 border-b border-gray-200">
                        <div className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2 text-center">Your Progress</div>
                        <div className="relative">
                          <div className="absolute top-3 left-0 right-0 h-0.5 bg-gray-300">
                            <div 
                              className="h-full bg-purple-600 transition-all" 
                              style={{ width: `${currentIndex >= 0 ? ((currentIndex + 1) / 6) * 100 : 0}%` }}
                            />
                          </div>
                          <div className="relative flex justify-between">
                            {['Build', 'Assess', 'Coach', 'Improve', 'Polish', 'Save'].map((step, index) => {
                              const isPast = currentIndex > index;
                              const isActive = currentIndex === index;
                              
                              return (
                                <div key={step} className="flex flex-col items-center">
                                  <div className={`
                                    w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold z-10
                                    ${isPast ? 'bg-purple-600 text-white' : 
                                      isActive ? 'bg-purple-600 text-white' : 
                                      'bg-white border-2 border-gray-300 text-gray-400'}
                                  `}>
                                    {isPast ? '✓' : isActive ? '●' : '○'}
                                  </div>
                                  <span className={`text-[11px] mt-1 ${
                                    isActive ? 'text-purple-600 font-bold' :
                                    isPast ? 'text-purple-600 font-semibold' :
                                    'text-gray-400 font-semibold'
                                  }`}>
                                    {step}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Score Section - wider bar, score on side, vertically centered */}
                      <div className="pt-4">
                        <div className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2 text-center">Resume Power Score</div>
                        <div className="flex items-center gap-3">
                          {/* Left: Bar (75%) */}
                          <div className="flex-1">
                            <div className="h-5 bg-gray-200 rounded-full overflow-hidden mb-2">
                              <div 
                                className={`h-full transition-all duration-500 ${
                                  (score || 62) >= 85 ? 'bg-gradient-to-r from-green-400 to-green-500' :
                                  (score || 62) >= 70 ? 'bg-gradient-to-r from-yellow-400 to-yellow-500' :
                                  'bg-gradient-to-r from-red-400 to-red-500'
                                }`}
                                style={{ width: `${score || 62}%` }}
                              />
                            </div>
                            
                            <div className="relative h-12">
                              <div className="flex h-1.5">
                                <div className="bg-red-500 rounded-l-full" style={{ width: '70%' }}></div>
                                <div className="bg-yellow-500" style={{ width: '14%' }}></div>
                                <div className="bg-green-500 rounded-r-full" style={{ width: '16%' }}></div>
                              </div>
                              
                              <div className="absolute top-0 left-[70%] -translate-x-1/2 -translate-y-px">
                                <div className="w-2 h-2 rounded-full bg-white border-2 border-red-500"></div>
                              </div>
                              <div className="absolute top-0 left-[84%] -translate-x-1/2 -translate-y-px">
                                <div className="w-2 h-2 rounded-full bg-white border-2 border-yellow-500"></div>
                              </div>
                              
                              <div className="flex mt-1">
                                <div className="text-center text-[8px] text-gray-700 leading-tight" style={{ width: '70%' }}>
                                  <div className="font-medium">Needs Work</div>
                                  <div className="text-gray-500">(0-70)</div>
                                </div>
                                <div className="text-center text-[8px] text-gray-700 leading-tight" style={{ width: '14%' }}>
                                  <div className="font-medium">Strong</div>
                                  <div className="text-gray-500">(71-84)</div>
                                </div>
                                <div className="text-center text-[8px] text-gray-700 leading-tight" style={{ width: '16%' }}>
                                  <div className="font-medium">Excellent</div>
                                  <div className="text-gray-500">(85+)</div>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Right: Score (25%) - vertically centered */}
                          <div className="text-center flex items-center justify-center" style={{ height: '68px' }}>
                            <div className="flex items-baseline justify-center gap-1">
                              <span className="text-4xl font-bold text-gray-900">{score || 62}</span>
                              <span className="text-lg text-gray-600">/100</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Core Resume Status - 3 cards */}
                      <div className="border-t border-gray-200 pt-2">
                        <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2 text-center">Core Resume Status</div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-gray-50 rounded-lg p-2 border border-gray-200">
                            <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mb-1">Core Resume</div>
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full bg-green-500"></div>
                              <div className="text-sm font-bold text-gray-900">
                                {data.coreResume.current_score >= 85 ? 'Optimized' : getScoreTier(data.coreResume.current_score)}
                              </div>
                            </div>
                          </div>
                          
                          <div className="bg-gray-50 rounded-lg p-2 border border-gray-200">
                            <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mb-1">Strength</div>
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full bg-green-500"></div>
                              <div className="text-sm font-bold text-gray-900">{getScoreTier(data.coreResume.current_score)}</div>
                            </div>
                          </div>
                          
                          <div className="bg-gray-50 rounded-lg p-2 border border-gray-200">
                            <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mb-1">Updated</div>
                            <div className="text-sm font-bold text-gray-900">{formatDate(data.coreResume.updated_at).split(',')[0]}</div>
                          </div>
                        </div>
                      </div>

                      {/* Ready to Apply - Tighter line spacing */}
                      <div className="bg-gradient-to-r from-purple-100 to-pink-100 border-2 border-purple-300 rounded-xl p-2.5 relative overflow-hidden">
                        <div className="absolute top-2 right-2 opacity-10">
                          <svg className="w-12 h-12 text-purple-400" fill="none" viewBox="0 0 64 64">
                            <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="2"/>
                            <circle cx="32" cy="32" r="20" stroke="currentColor" strokeWidth="2"/>
                            <circle cx="32" cy="32" r="12" stroke="currentColor" strokeWidth="2"/>
                            <circle cx="32" cy="32" r="4" fill="currentColor"/>
                          </svg>
                        </div>
                        <div className="relative z-10 flex items-center gap-2.5">
                          <div className="flex-1">
                            <h3 className="text-base font-bold text-gray-900 leading-tight mb-0">Ready to apply?</h3>
                            <p className="text-xs text-gray-700 leading-snug mb-0.5">Create a job-specific version in minutes.</p>
                            <div className="flex flex-wrap gap-x-2.5 gap-y-0 text-xs text-gray-800 leading-tight">
                              <span className="flex items-center gap-1">
                                <div className="w-1 h-1 rounded-full bg-purple-600"></div>
                                Target skills
                              </span>
                              <span className="flex items-center gap-1">
                                <div className="w-1 h-1 rounded-full bg-purple-600"></div>
                                Match keywords
                              </span>
                              <span className="flex items-center gap-1">
                                <div className="w-1 h-1 rounded-full bg-purple-600"></div>
                                Stand out
                              </span>
                            </div>
                          </div>
                          <button 
                            onClick={() => router.push(`/resume/${data.coreResume.id}`)}
                            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-all font-bold text-sm shadow-lg hover:shadow-xl whitespace-nowrap"
                          >
                            Tailor for Job →
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Column 3: Job-Specific Resumes (33%) */}
              <div className="col-span-4">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <h2 className="text-lg font-bold text-gray-900 mb-1 text-center">Job-Specific Resumes</h2>
                  <p className="text-xs text-gray-600 mb-4 text-center leading-snug">
                    {isPro 
                      ? "Once your core resume is complete, upload any job description to see how well you match the job. Your resume coach will help you improve it and strengthen your match score."
                      : "Once your core resume is complete, upload any job description to see how well you match the job. Upgrade to Pro for personalized coaching to improve your match score."
                    }
                  </p>

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

                    {/* Job Version Cards */}
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
    </div>
  );
}