'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import Header from '../components/Header'
import { getTierDisplayName, getTierBadgeColor, TIERS } from '@/lib/subscription'

export default function DashboardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [resumeData, setResumeData] = useState(null)
  const [showSavedMessage, setShowSavedMessage] = useState(false)
  const [userProfile, setUserProfile] = useState(null)
  const supabase = createClient()

  useEffect(() => {
    checkTierSelected()
  }, [])

  useEffect(() => {
    checkForResume()
    
    if (searchParams.get('saved') === 'true') {
      setShowSavedMessage(true)
      setTimeout(() => setShowSavedMessage(false), 5000)
    }
  }, [])

  const checkForResume = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('photo_url, display_name, subscription_tier, pdf_downloads_remaining, is_pilot_user, interview_access')
        .eq('id', user.id)
        .single()

      if (profile) {
        setUserProfile(profile)
      }

      const { data, error } = await supabase
        .from('resumes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') throw error

      setResumeData(data)
      setLoading(false)
    } catch (error) {
      console.error('Error checking resume:', error)
      setLoading(false)
    }
  }

  const checkTierSelected = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('tier_selected')
      .eq('id', user.id)
      .single()

    if (!profile?.tier_selected) {
      router.push('/choose-plan')
      return
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

// ==================== TIER DETECTION ====================
  const tier = userProfile?.subscription_tier || 'free'
  const hasInterview = userProfile?.interview_access || false
  
  const access = {
    // Resume - everyone has at least free
    hasFreeResume: tier === 'free',
    hasFullResume: tier === 'full',
    
    // Interview - everyone has at least free
    hasFreeInterview: !hasInterview, // Free when NOT paid
    hasFullInterview: hasInterview,  // Full when paid
    
    // Bundle
    hasBundle: tier === 'full' && hasInterview,
    
    // Data
    hasResumeData: !!resumeData
  }

  // ==================== HERO COPY ====================
  const isNewUser = !resumeData
  const heroHeadline = isNewUser 
    ? "Start Your Career Conversation" 
    : "Continue Your Career Conversation"
  
  const heroSubhead = isNewUser
    ? (access.hasFullResume || access.hasFullInterview || access.hasBundle)
      ? "One conversation extracts achievements you didn't know you had—then we help you bulletproof your resume, level up your interviews, and build your career with Hire Power."
      : "Build your resume with AI-powered analysis or practice interviews with voice-based coaching. Upgrade anytime for professional coaching that extracts achievements you didn't know you had."
    : "Pick up where you left off—customize your resume, practice interviews, or add new achievements to your archive."

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Success Message */}
        {showSavedMessage && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-start">
              <span className="text-xl mr-2">✅</span>
              <div>
                <p className="text-sm text-green-800 font-medium">Progress Saved!</p>
                <p className="text-xs text-green-700 mt-1">
                  Your progress has been saved.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Hero Section */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {heroHeadline}
          </h1>
          <p className="text-base text-gray-600 max-w-3xl mx-auto">
            {heroSubhead}
          </p>
        </div>

        {/* Three Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          
          {/* ==================== RESUME COACH CARD ==================== */}
          <div className={`rounded-lg p-6 border-2 transition-all ${
            access.hasFreeResume || access.hasFullResume
              ? 'bg-white border-purple-300 shadow-md'
              : 'bg-gray-50 border-gray-200 opacity-60'
          }`}>
            <div className="flex items-start justify-between mb-4">
              <div className="text-3xl">📄</div>
              {(access.hasFreeResume || access.hasFullResume) && (
                <span className={`text-xs px-3 py-1 rounded-full font-semibold ${
                  access.hasFullResume 
                    ? 'bg-green-100 text-green-700'
                    : 'bg-purple-100 text-purple-700'
                }`}>
                  {access.hasFullResume ? 'Full Access' : 'Free Access'}
                </span>
              )}
            </div>

            <h3 className="text-xl font-bold mb-3">Resume Coach</h3>

            {/* FREE RESUME */}
            {access.hasFreeResume && !access.hasFullResume && (
              <>
                <p className="text-sm text-gray-700 mb-3 font-medium">Free tier includes:</p>
                <ul className="text-sm text-gray-600 space-y-1 mb-4">
                  <li>• Build 1 resume</li>
                  <li>• AI-powered analysis</li>
                  <li>• Unlimited downloads</li>
                  <li>• Basic templates</li>
                </ul>

                <button
                  onClick={() => router.push(access.hasResumeData ? '/my-resumes' : '/resume-start')}
                  className="w-full bg-purple-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-purple-700 transition-colors mb-3"
                >
                  {access.hasResumeData ? 'View My Resume' : 'Start Resume'}
                </button>

                <div className="border-t border-gray-200 pt-3 mt-3">
                  <p className="text-xs text-gray-700 font-semibold mb-2">Upgrade to Full Resume ($19.99/mo):</p>
                  <ul className="text-xs text-gray-600 space-y-1 mb-2">
                    <li>• Professional coaching conversation</li>
                    <li>• Unlimited job customization (83% higher success)</li>
                    <li>• Unlimited downloads</li>
                    <li>• Premium templates</li>
                  </ul>
                  <button
                    onClick={() => router.push('/pricing')}
                    className="text-xs text-purple-600 font-semibold hover:underline"
                  >
                    Upgrade to Full Resume →
                  </button>
                </div>
              </>
            )}

            {/* FULL RESUME */}
            {access.hasFullResume && (
              <>
                <p className="text-sm text-gray-700 mb-3 font-medium">Full access includes:</p>
                <ul className="text-sm text-gray-600 space-y-1 mb-4">
                  <li>• Professional coaching conversation</li>
                  <li>• Unlimited job customization</li>
                  <li>• ATS match scoring</li>
                  <li>• Unlimited downloads</li>
                  <li>• Premium templates</li>
                </ul>

                <button
                  onClick={() => router.push(access.hasResumeData ? '/my-resumes' : '/resume-start')}
                  className="w-full bg-purple-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-purple-700 transition-colors"
                >
                  {access.hasResumeData ? 'View My Resume' : 'Start Resume Coaching'}
                </button>
              </>
            )}

            {/* LOCKED (no resume access) */}
            {!access.hasFreeResume && !access.hasFullResume && (
              <>
                <p className="text-sm text-gray-600 mb-4">
                  Professional coaching that extracts achievements you didn't know you had.
                </p>
                
                <button
                  onClick={() => router.push('/pricing')}
                  className="w-full bg-gray-300 text-gray-600 px-4 py-2 rounded-lg font-semibold hover:bg-gray-400 transition-colors"
                >
                  Unlock Resume Coach
                </button>
              </>
            )}
          </div>

          {/* ==================== INTERVIEW COACH CARD ==================== */}
          <div className={`rounded-lg p-6 border-2 transition-all ${
            access.hasFreeInterview || access.hasFullInterview
              ? 'bg-white border-purple-300 shadow-md'
              : 'bg-gray-50 border-gray-200 opacity-60'
          }`}>
            <div className="flex items-start justify-between mb-4">
              <div className="text-3xl">🎤</div>
              {(access.hasFreeInterview || access.hasFullInterview) && (
                <span className={`text-xs px-3 py-1 rounded-full font-semibold ${
                  access.hasFullInterview 
                    ? 'bg-green-100 text-green-700'
                    : 'bg-purple-100 text-purple-700'
                }`}>
                  {access.hasFullInterview ? 'Full Access' : 'Free Access'}
                </span>
              )}
            </div>

            <h3 className="text-xl font-bold mb-3">Interview Coach</h3>

            {/* FREE INTERVIEW */}
            {access.hasFreeInterview && !access.hasFullInterview && (
              <>
               <p className="text-sm text-gray-700 mb-3 font-medium">Free tier includes:</p>
                <ul className="text-sm text-gray-600 space-y-1 mb-4">
                  <li>• Basic interview questions</li>
                  <li>• Self-guided practice</li>
                  <li>• Text-based feedback</li>
                  <li>• Record practice sessions</li>
                </ul>

                <button
                  onClick={() => router.push('/interview-start')}
                  className="w-full bg-purple-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-purple-700 transition-colors mb-3"
                >
                  Start Interview Practice
                </button>

                <div className="border-t border-gray-200 pt-3 mt-3">
                  <p className="text-xs text-gray-700 font-semibold mb-2">Upgrade to Full Interview ($19.99/mo):</p>
                  <ul className="text-xs text-gray-600 space-y-1 mb-2">
                    <li>• Voice-based practice sessions</li>
                    <li>• Resume-integrated questions</li>
                    <li>• Company-specific prep</li>
                    <li>• Real-time AI feedback</li>
                  </ul>
                  <button
                    onClick={() => router.push('/pricing')}
                    className="text-xs text-purple-600 font-semibold hover:underline"
                  >
                    Upgrade to Full Interview →
                  </button>
                </div>
              </>
            )}

            {/* FULL INTERVIEW */}
            {access.hasFullInterview && (
              <>
                <p className="text-sm text-gray-700 mb-3 font-medium">Full access includes:</p>
                <ul className="text-sm text-gray-600 space-y-1 mb-4">
                  <li>• Voice-based practice sessions</li>
                  <li>• Resume-integrated questions</li>
                  <li>• Company-specific prep</li>
                  <li>• Real-time AI feedback</li>
                </ul>

                <button
                  onClick={() => router.push('/my-interviews')}
                  className="w-full text-purple-600 font-semibold text-sm mb-3 text-left hover:underline"
                >
                  → View My Interviews
                </button>

                <button
                  onClick={() => router.push('/interview-start')}
                  className="w-full bg-purple-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-purple-700 transition-colors"
                >
                  Start Interview Practice
                </button>
              </>
            )}

            {/* LOCKED (no interview access) */}
            {!access.hasFreeInterview && !access.hasFullInterview && (
              <>
                <p className="text-sm text-gray-600 mb-4">
                  AI-powered interview practice with voice-based questions.
                </p>
                
                <button
                  onClick={() => router.push('/pricing')}
                  className="w-full bg-gray-300 text-gray-600 px-4 py-2 rounded-lg font-semibold hover:bg-gray-400 transition-colors"
                >
                  Unlock Interview Coach
                </button>
              </>
            )}
          </div>

          {/* ==================== INTEGRATED CAREER COACH (BUNDLE) ==================== */}
       {!access.hasBundle ? (
            // BUNDLE UPGRADE CARD
            <div className="bg-gradient-to-br from-purple-100 to-purple-200 border-2 border-purple-300 rounded-lg p-6 shadow-md">
              <div className="flex items-start justify-between mb-4">
                <div className="text-3xl">⭐</div>
                <span className="text-xs px-3 py-1 rounded-full font-semibold bg-purple-600 text-white">
                  BEST VALUE
                </span>
              </div>
              
              <div className="text-center mb-4">
                <h3 className="text-xl font-bold text-gray-900 mb-1">Integrated Career Coach</h3>
                <p className="text-sm text-purple-800 font-semibold">Save $10/month</p>
              </div>

              <p className="text-sm text-gray-700 mb-4">
                One achievement database feeds both resume customization AND interview prep. 
                True integration no competitor offers.
              </p>

              <div className="bg-white bg-opacity-60 rounded-lg p-3 mb-4">
                <p className="text-xs text-gray-700 font-semibold mb-2">Bundle includes:</p>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• Resume coaching + unlimited customization</li>
                  <li>• Interview practice with AI</li>
                  <li>• Career archive for life</li>
                  <li>• All premium features</li>
                </ul>
              </div>

              <div className="text-center mb-3">
                <div className="text-2xl font-bold text-purple-700">$29.99<span className="text-sm">/mo</span></div>
                <p className="text-xs text-gray-600">vs $39.98 separate</p>
              </div>

              <button
                onClick={() => router.push('/pricing')}
                className="w-full bg-purple-600 text-white px-4 py-3 rounded-lg font-bold hover:bg-purple-700 transition-colors"
              >
                Upgrade to Bundle →
              </button>

              {(access.hasFullResume || access.hasFullInterview) && (
                <p className="text-xs text-center text-purple-700 mt-3">
                  Add {access.hasFullResume ? 'Interview' : 'Resume'} access for just $10 more
                </p>
              )}
            </div>
          ) : (
            // MAINTENANCE MODE CARD (Bundle users)
            <div className="bg-gradient-to-br from-purple-100 to-purple-200 border-2 border-purple-300 rounded-lg p-6 shadow-md">
              <div className="flex items-start justify-between mb-4">
                <div className="text-3xl">⭐</div>
                <span className="text-xs px-3 py-1 rounded-full font-semibold bg-green-100 text-green-700">
                  Full Bundle
                </span>
              </div>

              <h3 className="text-xl font-bold mb-3">Career Archive</h3>

              <p className="text-sm text-gray-700 mb-4">
                Log achievements as they happen. Keep your career conversation alive between job searches.
              </p>

              <button
                onClick={() => router.push('/career-archive')}
                className="w-full bg-purple-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-purple-700 transition-colors mb-3"
              >
                Add New Achievement
              </button>

              <div className="border-t border-purple-300 pt-3">
                <p className="text-xs text-gray-600">
                  Between jobs? Switch to Maintenance Mode ($4.99/mo) to keep your archive alive.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}