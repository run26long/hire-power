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
        router.push('/dashboard');
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

  const isPro = data?.userTier === TIERS.PRO;
  const score = data?.coreResume?.current_score || null;

  // Journey steps for progress bar
  const steps = ['review', 'assess', 'coach', 'improve', 'polish', 'save'];
  const currentIndex = data?.coreResume?.journey_step ? steps.indexOf(data.coreResume.journey_step) : -1;
  const stepsComplete = currentIndex + 1;

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <MainNav currentPage="my-resumes" userProfile={userProfile} />

      <div className="flex-1 overflow-y-auto">
        <div className="px-8 py-6 max-w-[1400px] mx-auto w-full">
          
          {/* VERSION 1: Top Banner with Context */}
          {data?.coreResume && (
            <>
              {/* Page Header */}
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-1">Resume Coach</h1>
                <p className="text-sm text-gray-600">Your guided journey to a bulletproof resume</p>
              </div>

              {/* Next Step Card - Prominent */}
              <div className="mb-8 bg-white rounded-lg shadow-sm border-l-4 border-purple-600 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-purple-600 uppercase tracking-wider mb-1">NEXT STEP</div>
                    <div className="text-base font-semibold text-gray-900">Continue building your core resume</div>
                    <div className="text-sm text-gray-500 mt-1">
                      Status: {getScoreTier(score)} ({score}/100) • {stepsComplete} of 6 steps complete
                    </div>
                  </div>
                  <button
                    onClick={() => router.push(`/resume/${data.coreResume.id}`)}
                    className="bg-purple-600 text-white px-6 py-2.5 rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm whitespace-nowrap"
                  >
                    Open →
                  </button>
                </div>
              </div>

              {/* Main Content: 2-Column Layout */}
              <div className="grid grid-cols-12 gap-6">
                
                {/* Core Resume Card */}
                <div className="col-span-8">
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                    <h2 className="text-base font-semibold text-gray-900 mb-3">Core Resume</h2>
                    
                    <div className="grid grid-cols-10 gap-4">
                      {/* Thumbnail - 30% */}
                      <div className="col-span-3">
                        <button
                          onClick={() => router.push(`/resume/${data.coreResume.id}`)}
                          className="w-full group"
                        >
                          <div className="relative bg-white rounded-lg overflow-hidden shadow-sm border border-gray-200 group-hover:border-purple-400 transition-all" style={{ aspectRatio: '8.5/11' }}>
                            {data.coreResume.thumbnail_url ? (
                              <img 
                                src={data.coreResume.thumbnail_url} 
                                alt="Resume preview"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gray-50">
                                <div className="text-center">
                                  <div className="text-3xl mb-2">📄</div>
                                  <div className="text-xs text-gray-500">Preview</div>
                                </div>
                              </div>
                            )}
                          </div>
                        </button>
                      </div>

                      {/* Content - 70% */}
                      <div className="col-span-7 space-y-4">
                        
                        {/* Progress */}
                        <div>
                          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Progress</div>
                          <div className="relative">
                            <div className="absolute top-2.5 left-0 right-0 h-px bg-gray-200">
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
                                      w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold z-10
                                      ${isPast ? 'bg-purple-600 text-white' : 
                                        isActive ? 'bg-purple-600 text-white' : 
                                        'bg-white border border-gray-300 text-gray-400'}
                                    `}>
                                      {isPast ? '✓' : isActive ? '●' : '○'}
                                    </div>
                                    <span className={`text-[10px] mt-1 ${
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

                        {/* Score */}
                        <div>
                          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Resume Power Score</div>
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full transition-all duration-500 ${
                                    (score || 62) >= 85 ? 'bg-green-500' :
                                    (score || 62) >= 70 ? 'bg-yellow-500' :
                                    'bg-red-500'
                                  }`}
                                  style={{ width: `${score || 62}%` }}
                                />
                              </div>
                              <div className="flex justify-between text-[9px] text-gray-500 mt-1">
                                <span>Needs Work</span>
                                <span>Strong</span>
                                <span>Excellent</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-3xl font-bold text-gray-900">{score || 62}</div>
                              <div className="text-xs text-gray-500">/100</div>
                            </div>
                          </div>
                        </div>

                        {/* Action Button */}
                        <button
                          onClick={() => router.push(`/resume/${data.coreResume.id}`)}
                          className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm"
                        >
                          Tailor for Job →
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Job-Specific Resumes */}
                <div className="col-span-4">
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                    <h2 className="text-base font-semibold text-gray-900 mb-3">Job-Specific Resumes</h2>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Create New Card */}
                      <button
                        onClick={() => router.push(`/resume/${data.coreResume.id}`)}
                        className="border-2 border-dashed border-gray-300 rounded-lg p-3 hover:border-purple-400 hover:bg-purple-50 transition-all flex flex-col items-center justify-center aspect-square group"
                      >
                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center mb-2 group-hover:bg-purple-200 transition-all">
                          <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </div>
                        <div className="text-xs font-semibold text-gray-900">Create New</div>
                      </button>

                      {/* Job Version Cards */}
                      {data.resumeVersions.slice(0, 7).map((version) => (
                        <div
                          key={version.id}
                          onClick={() => router.push(`/resume/${data.coreResume.id}?version=${version.id}`)}
                          className="border border-gray-200 rounded-lg p-3 hover:border-purple-400 hover:shadow-md transition-all cursor-pointer bg-white group relative aspect-square flex flex-col"
                        >
                          <div className="flex-1 flex flex-col">
                            <div className="mb-2">
                              <div className="text-xs font-semibold text-gray-900 mb-0.5 line-clamp-1">
                                {version.job_title}
                              </div>
                              <div className="text-[10px] text-gray-600 truncate">
                                {version.job_company}
                              </div>
                            </div>
                            
                            <div className="flex justify-center my-2">
                              <div className="relative">
                                <svg className="w-10 h-10 transform -rotate-90">
                                  <circle cx="20" cy="20" r="16" stroke="#e5e7eb" strokeWidth="2" fill="none" />
                                  <circle
                                    cx="20" cy="20" r="16"
                                    stroke={getCircleColor(version.match_score)}
                                    strokeWidth="2" fill="none"
                                    strokeDasharray={`${2 * Math.PI * 16}`}
                                    strokeDashoffset={`${2 * Math.PI * 16 * (1 - version.match_score / 100)}`}
                                    strokeLinecap="round"
                                  />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className={`text-xs font-bold ${getScoreColor(version.match_score)}`}>
                                    {version.match_score}%
                                  </div>
                                </div>
                              </div>
                            </div>

                            <button 
                              className="w-full bg-purple-600 text-white py-1.5 rounded-lg text-xs font-medium hover:bg-purple-700 transition-all mt-auto"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/resume/${data.coreResume.id}?version=${version.id}`);
                              }}
                            >
                              Open
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Empty State */}
          {!data?.coreResume && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <div className="text-6xl mb-4">📄</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Build Your Core Resume</h2>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Start by having a career conversation with our AI coach.
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
