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
    if (score >= 85) return '#81c784';
    if (score >= 71) return '#ffc870';
    return '#e57373';
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
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex-shrink-0">
          <h1 className="text-[27px] font-semibold mb-2 whitespace-nowrap">Resume Coach</h1>
          <p className="text-sm text-white text-opacity-95 leading-snug">
            We don't invent experience. We extract and strengthen what's already yours.
          </p>
          <div className="mt-4 border-b border-gray-400 border-opacity-10"></div>
        </div>
        
        {/* Main Content - NO SCROLL */}
        <div className="flex-1 p-6 flex flex-col justify-between">
          <div>
            {/* Core Resume Section */}
            <div className="mb-6">
              <h4 className="text-sm font-bold uppercase tracking-wider text-white mb-3">CORE RESUME</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Power Score</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>AI Assessment</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>AI Coaching <span className="font-semibold text-xs">(Pro)</span></span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Achievement Discovery <span className="font-semibold text-xs">(Pro)</span></span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Skill Identification <span className="font-semibold text-xs">(Pro)</span></span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Auto Improvements <span className="font-semibold text-xs">(Pro)</span></span>
                </li>
              </ul>
            </div>
            
            {/* Job-Specific Section */}
            <div>
              <h4 className="text-sm font-bold uppercase tracking-wider text-white mb-3">JOB-SPECIFIC</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Match Score</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>AI Coaching <span className="font-semibold text-xs">(Pro)</span></span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Custom Versions <span className="font-semibold text-xs">(Pro)</span></span>
                </li>
              </ul>
            </div>
          </div>
          
          {/* Bottom guidance - Fixed */}
          <div className="px-6 pb-6 mt-auto">
            <div className="bg-purple-800 bg-opacity-30 rounded-lg px-3 py-3 border border-purple-400 border-opacity-20">
              <div className="flex items-start gap-2">
                <div className="flex-shrink-0 mt-0.5">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <p className="text-[11px] text-white leading-snug font-medium">
                  Select any resume in your workspace to start the conversation.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="ml-64 flex-1 flex flex-col h-screen overflow-hidden">
        <MainNav currentPage="my-resumes" userProfile={userProfile} />

        <div className="flex-1 overflow-y-auto">
          <div className="px-8 py-4 max-w-[1400px] mx-auto w-full">
            
            {/* Clean 2-Column Layout - NO OLD BANNER */}
            {data?.coreResume && (
              <div className="grid grid-cols-12 gap-6">
                
                {/* Core Resume Card (8 cols) */}
                <div className="col-span-8">
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                    <h2 className="text-lg font-semibold text-gray-900 mb-3">Core Resume</h2>
                    
                    {/* Thumbnail LEFT | Score RIGHT */}
                    <div className="grid grid-cols-12 gap-4 mb-4">
                      
                      {/* Left: Thumbnail (35%) */}
                      <div className="col-span-4">
                        <div className="relative">
                          <div
                            onClick={() => router.push(`/resume/${data.coreResume.id}`)}
                            className="w-full group cursor-pointer"
                          >
                            <div className="relative bg-white rounded-lg overflow-hidden shadow-sm border border-gray-200" style={{ aspectRatio: '8.5/11' }}>
                              {data.coreResume.thumbnail_url ? (
                                <img 
                                  src={data.coreResume.thumbnail_url} 
                                  alt="Resume preview"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gray-50">
                                  <div className="text-center">
                                    <div className="text-3xl mb-1">📄</div>
                                    <div className="text-sm text-gray-500">Ava Long</div>
                                  </div>
                                </div>
                              )}
                              
                              {/* Hover Overlay */}
                              <div className="absolute inset-0 bg-gray-900 bg-opacity-60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <button className="w-9 h-9 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center text-white">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                </button>
                                <button className="w-9 h-9 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center text-white">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                </button>
                                <button className="w-9 h-9 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center text-white">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                          
                          {/* Single-line footer - subtle */}
                          <div className="mt-2 text-center text-xs text-gray-500">
                            Ava Long • Edited {formatDate(data.coreResume.updated_at).split(',')[0]}
                          </div>
                        </div>
                      </div>
                      
                      {/* Right: Score Section (65%) */}
                      <div className="col-span-8 flex flex-col justify-between py-3">
                        {/* Giant Score */}
                        <div className="text-center">
                          <div className="mb-3">
                            <span className="text-7xl font-bold text-gray-900">{score || 85}</span>
                            <span className="text-3xl text-gray-400">/100</span>
                          </div>
                          <div className="text-xs text-gray-500 uppercase tracking-wide mb-3">Resume Power Score</div>
                          
                          {/* Score Bar - Improved */}
                          <div className="max-w-md mx-auto">
                            <div className="h-3 bg-gray-200 rounded-full overflow-hidden mb-3 shadow-inner">
                              <div 
                                className="h-full transition-all duration-500"
                                style={{ 
                                  width: `${score || 85}%`,
                                  background: (score || 85) >= 85 ? '#81c784' : (score || 85) >= 71 ? '#ffc870' : '#e57373'
                                }}
                              />
                            </div>
                            
                            {/* Simple text labels with dots */}
                            <div className="flex items-center justify-center gap-4 text-xs text-gray-600">
                              <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full" style={{ background: '#e57373' }}></div>
                                <span>Needs Work<span className="text-gray-400 ml-1">(0-70)</span></span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full" style={{ background: '#ffc870' }}></div>
                                <span>Strong<span className="text-gray-400 ml-1">(71-84)</span></span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full" style={{ background: '#81c784' }}></div>
                                <span>Excellent<span className="text-gray-400 ml-1">(85+)</span></span>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Breakdown Grid - Bigger Text */}
                        <div className="grid grid-cols-3 gap-1.5">
                          <div className="text-center p-1.5 bg-gray-50 rounded-lg">
                            <div className="text-2xl font-bold text-gray-900 mb-0.5">35<span className="text-sm text-gray-400">/40</span></div>
                            <div className="text-[10px] text-gray-600 uppercase tracking-wide mb-0.5">Impact</div>
                            <div className="flex items-center justify-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                              <span className="text-[10px] text-green-600 font-medium">Strong</span>
                            </div>
                          </div>
                          
                          <div className="text-center p-1.5 bg-gray-50 rounded-lg">
                            <div className="text-2xl font-bold text-gray-900 mb-0.5">32<span className="text-sm text-gray-400">/40</span></div>
                            <div className="text-[10px] text-gray-600 uppercase tracking-wide mb-0.5">Clarity</div>
                            <div className="flex items-center justify-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                              <span className="text-[10px] text-green-600 font-medium">Strong</span>
                            </div>
                          </div>
                          
                          <div className="text-center p-1.5 bg-gray-50 rounded-lg">
                            <div className="text-2xl font-bold text-gray-900 mb-0.5">18<span className="text-sm text-gray-400">/20</span></div>
                            <div className="text-[10px] text-gray-600 uppercase tracking-wide mb-0.5">Keywords</div>
                            <div className="flex items-center justify-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                              <span className="text-[10px] text-green-600 font-medium">Excellent</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="mb-4">
                      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-center mb-2">Progress</div>
                      <div className="relative max-w-2xl mx-auto">
                        <div className="absolute top-2.5 left-0 right-0 h-px bg-gray-200">
                          <div 
                            className="h-full bg-purple-600 transition-all" 
                            style={{ width: `${currentIndex >= 0 ? ((currentIndex + 1) / 6) * 100 : 33}%` }}
                          />
                        </div>
                        <div className="relative flex justify-between">
                          {['Build', 'Assess', 'Coach', 'Improve', 'Polish', 'Save'].map((step, index) => {
                            const isPast = currentIndex > index;
                            const isActive = currentIndex === index || (currentIndex < 0 && index <= 1);
                            
                            return (
                              <div key={step} className="flex flex-col items-center">
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold z-10 ${
                                  isPast ? 'bg-purple-600 text-white' : 
                                  isActive ? 'bg-purple-600 text-white' : 
                                  'bg-white border border-gray-300 text-gray-400'
                                }`}>
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
                    
                    {/* What This Means */}
                    <div className="bg-purple-50 border-l-4 border-purple-600 p-3 rounded-r flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <div className="text-[10px] font-bold text-purple-600 uppercase tracking-wide mb-1">What This Means</div>
                        <p className="text-xs text-gray-700 leading-relaxed">
                          Your resume has solid structure. Coaching can help extract quantifiable achievements to maximize your Impact score.
                        </p>
                      </div>
                      <button 
                        onClick={() => router.push(`/resume/${data.coreResume.id}`)}
                        className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm whitespace-nowrap flex-shrink-0"
                      >
                        Start Coaching →
                      </button>
                    </div>
                  </div>
                </div>

                {/* Job-Specific Resumes (4 cols) */}
                <div className="col-span-4">
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Job-Specific Resumes</h2>

                    <div className="space-y-3">
                      {/* Create New Card */}
                      <button
                        onClick={() => router.push(`/resume/${data.coreResume.id}`)}
                        className="w-full border-2 border-dashed border-gray-300 rounded-lg p-3 hover:border-purple-400 hover:bg-purple-50 transition-all flex items-center justify-center gap-2"
                      >
                        <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center">
                          <svg className="w-3 h-3 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </div>
                        <div className="text-sm font-semibold text-gray-900">Create New</div>
                      </button>

                      {/* Job Cards */}
                      {data.resumeVersions?.slice(0, 2).map((version) => (
                        <div
                          key={version.id}
                          onClick={() => router.push(`/resume/${data.coreResume.id}?version=${version.id}`)}
                          className="bg-white border border-gray-200 rounded-lg p-3 hover:border-purple-400 hover:shadow-md transition-all cursor-pointer"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="text-sm font-semibold text-gray-900 mb-0.5">{version.job_title}</div>
                              <div className="text-xs text-gray-500">{version.job_company}</div>
                            </div>
                            <div className="flex items-center justify-center ml-3">
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
                                  <div className="text-sm font-bold" style={{ color: getCircleColor(version.match_score) }}>
                                    {version.match_score}%
                                  </div>
                                </div>
                              </div>
                            </div>
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
    </div>
  );
}