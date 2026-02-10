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
    checkForResume()
    
    // Show success message if coming from saved coaching
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

      // Load user profile (including subscription data)
      const { data: profile } = await supabase
        .from('profiles')
        .select('photo_url, display_name, subscription_tier, pdf_downloads_remaining, is_pilot_user')
        .eq('id', user.id)
        .single()

      if (profile) {
        setUserProfile(profile)
      }

      // Get full resume data
      const { data, error } = await supabase
        .from('resumes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') throw error

      if (!data) {
        router.push('/resume-start')
        return
      }

      setResumeData(data)
      setLoading(false)
    } catch (error) {
      console.error('Error checking resume:', error)
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Success Message */}
        {showSavedMessage && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start">
              <span className="text-2xl mr-3">✅</span>
              <div>
                <h3 className="font-semibold text-green-900">Progress Saved!</h3>
                <p className="text-sm text-green-700 mt-1">
                  Your coaching session has been saved. Click "Work with Your Resume Coach" below to pick up where you left off.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Header with Photo and Badge */}
        <div className="flex items-center gap-4 mb-8">
          {userProfile?.photo_url ? (
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-purple-200">
              <img
                src={userProfile.photo_url}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-2xl font-bold">
              {userProfile?.display_name?.charAt(0).toUpperCase() || 'U'}
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">Your Dashboard</h1>
              {userProfile && (
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getTierBadgeColor(userProfile.subscription_tier)}`}>
                  {getTierDisplayName(userProfile.subscription_tier)}
                </span>
              )}
            </div>
            <p className="text-gray-600 mt-1">Welcome back{userProfile?.display_name ? `, ${userProfile.display_name}` : ''}!</p>
          </div>
        </div>

        {/* Banner for Free Users */}
        {userProfile?.subscription_tier === TIERS.FREE && (
          <div className="bg-gradient-to-r from-purple-50 to-purple-100 border-2 border-purple-200 rounded-lg p-6 mb-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-bold text-lg text-purple-900 mb-2">
                  🚀 You're on the Free Plan
                </h3>
                <p className="text-purple-800 mb-3">
                  You can build 1 resume and download {userProfile.pdf_downloads_remaining} PDFs. 
                  Upgrade to unlock professional coaching that extracts achievements you didn't know you had.
                </p>
                <ul className="text-sm text-purple-700 space-y-1 mb-4">
                  <li>✅ Professional resume writer coaching conversation</li>
                  <li>✅ One-click job customization (83% higher success rate)</li>
                  <li>✅ Unlimited downloads and templates</li>
                  <li>✅ ATS match scoring and optimization</li>
                </ul>
                <button
                  onClick={() => router.push('/pricing')}
                  className="bg-purple-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-purple-700 transition-colors"
                >
                  Upgrade to Full Access ($29.99/mo)
                </button>
              </div>
              <button
                onClick={() => {/* We'll add dismiss logic later */}}
                className="text-purple-400 hover:text-purple-600 ml-4"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Banner for Full Access Users */}
        {userProfile?.subscription_tier === TIERS.FULL && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg p-6 mb-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-bold text-lg text-green-900 mb-2">
                  ✨ You Have Full Access
                </h3>
                <p className="text-green-800 mb-3">
                  Professional coaching, unlimited customization, and ATS optimization at your fingertips. 
                  We're your lifelong career partner.
                </p>
                <div className="flex gap-4 text-sm text-green-700">
                  <div>
                    <div className="font-semibold">Active Job Search</div>
                    <div>Customize for every application</div>
                  </div>
                  <div className="border-l-2 border-green-200 pl-4">
                    <div className="font-semibold">Between Jobs</div>
                    <div>Log achievements as they happen</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Feature Cards */}
        <div className="grid gap-6">
          {/* Resume Coaching Card */}
          <div 
            onClick={() => {
              if (userProfile?.subscription_tier === TIERS.FREE) {
                router.push('/pricing')
              } else {
                router.push('/resume-coaching')
              }
            }}
            className={`border rounded-lg p-6 transition-shadow ${
              userProfile?.subscription_tier === TIERS.FREE 
                ? 'cursor-pointer hover:shadow-md bg-gray-50' 
                : 'cursor-pointer hover:shadow-lg bg-white'
            }`}
          >
            <div className="flex justify-between items-start mb-2">
              <h2 className="text-xl font-semibold">🚀 Work with Your Resume Coach</h2>
              {userProfile?.subscription_tier === TIERS.FREE ? (
                <span className="bg-gray-200 text-gray-700 text-xs px-3 py-1 rounded-full font-medium flex items-center gap-1">
                  🔒 Full Access
                </span>
              ) : userProfile?.subscription_tier === TIERS.FULL ? (
                <span className="bg-green-100 text-green-700 text-xs px-3 py-1 rounded-full font-medium">
                  Available
                </span>
              ) : null}
            </div>
            <p className="text-gray-600">
              {userProfile?.subscription_tier === TIERS.FREE 
                ? 'Professional coaching extracts achievements you didn\'t know you had. Upgrade to unlock.' 
                : 'Begin your coaching journey or pick up where you left off - extract quantifiable achievements from your experience'}
            </p>
            {userProfile?.subscription_tier === TIERS.FREE && (
              <p className="text-sm text-purple-600 font-semibold mt-3">
                Click to upgrade → 40% higher interview rate with coaching
              </p>
            )}
          </div>

          {/* My Resumes */}
          <div 
            onClick={() => router.push('/my-resumes')}
            className="border rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer bg-white"
          >
            <h2 className="text-xl font-semibold mb-2">📄 My Resumes</h2>
            <p className="text-gray-600">
              {resumeData 
                ? 'View your resume (finalize coaching first to download)' 
                : 'Create your first resume'}
            </p>
            {userProfile?.subscription_tier === TIERS.FREE && (
              <p className="text-sm text-purple-600 font-medium mt-2">
                {userProfile.pdf_downloads_remaining} of 3 downloads remaining
              </p>
            )}
          </div>

          {/* Interview Practice - Coming Soon */}
          <div className="border rounded-lg p-6 bg-white opacity-50 cursor-not-allowed">
            <h2 className="text-xl font-semibold mb-2">🎤 Work with Your Interview Coach</h2>
            <p className="text-gray-600">Coming soon - Practice with AI-spoken questions</p>
          </div>
        </div>
      </div>
    </div>
  )
}