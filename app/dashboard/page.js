'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import Header from '../components/Header'

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
      setTimeout(() => setShowSavedMessage(false), 5000) // Hide after 5 seconds
    }
  }, [])

  const checkForResume = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }
// Load user profile
const { data: profile } = await supabase
  .from('profiles')
  .select('photo_url, display_name')
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

  

  // Calculate progress
  const getProgress = () => {
    if (!resumeData) return { step: 0, percent: 0, label: 'Not started' }
    
    const hasResume = resumeData.parsed_text || resumeData.resume_data
    const hasCoaching = resumeData.coaching_conversation && resumeData.coaching_conversation.length > 0
    const isComplete = resumeData.coaching_complete === true
    
    if (isComplete) return { step: 3, percent: 100, label: 'Coaching complete!' }
    if (hasCoaching) return { step: 2, percent: 66, label: 'Coaching in progress' }
    if (hasResume) return { step: 1, percent: 33, label: 'Resume uploaded' }
    return { step: 0, percent: 0, label: 'Not started' }
  }

  const progress = resumeData ? getProgress() : { step: 0, percent: 0, label: 'Not started' }

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
  <div>
    <h1 className="text-3xl font-bold mb-1">Your Dashboard</h1>
    <p className="text-gray-600">Welcome back{userProfile?.display_name ? `, ${userProfile.display_name}` : ''}!</p>
  </div>
</div>

        {/* Progress Bar */}
        <div className="bg-white rounded-lg p-6 mb-6 shadow-sm border">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Resume Progress</span>
            <span className="text-sm font-medium text-purple-600">{progress.label}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className="bg-purple-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${progress.percent}%` }}
            ></div>
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>Start</span>
            <span>Coaching</span>
            <span>Complete</span>
          </div>
        </div>
        
        <div className="grid gap-6">
          {/* Resume Coaching Card */}
          <div 
            onClick={() => router.push('/resume-coaching')}
            className="border rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer bg-white"
          >
            <div className="flex justify-between items-start mb-2">
              <h2 className="text-xl font-semibold">🚀 Work with Your Resume Coach</h2>
              {progress.step >= 2 && (
                <span className="bg-purple-100 text-purple-700 text-xs px-3 py-1 rounded-full font-medium">
                  In Progress
                </span>
              )}
            </div>
            <p className="text-gray-600">
              Begin your coaching journey or pick up where you left off - extract quantifiable achievements from your experience
            </p>
          </div>

          {/* Interview Practice */}
          <div className="border rounded-lg p-6 bg-white opacity-50 cursor-not-allowed">
            <h2 className="text-xl font-semibold mb-2">🎤 Work with Your Interview Coach</h2>
            <p className="text-gray-600">Coming soon - Practice with AI-spoken questions</p>
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
          </div>
        </div>
      </div>
    </div>
  )
}