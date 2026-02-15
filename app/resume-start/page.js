'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import Header from '../components/Header'

export default function ResumeStart() {
  const router = useRouter()
  const supabase = createClient()
  const [resumeCount, setResumeCount] = useState(0)
  const [userTier, setUserTier] = useState(null)
  const [loading, setLoading] = useState(true)

  // Check for in-progress builder and auto-redirect
  useEffect(() => {
    const saved = localStorage.getItem('resumeBuilderProgress')
    if (saved) {
      try {
        const { formData } = JSON.parse(saved)
        // Check if there's actual data (not just empty fields)
        const hasData = formData.fullName || formData.email || 
                       formData.experience.length > 0 || 
                       formData.education.length > 0
        if (hasData) {
          router.push('/resume-builder')
          return
        }
      } catch (error) {
        // Continue to show choices if localStorage is corrupted
      }
    }
  }, [router])

  // Check resume count and tier on mount
  useEffect(() => {
    async function checkResumeLimit() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Get user tier
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', user.id)
        .single()

      setUserTier(profile?.subscription_tier || 'free')

      // Get resume count
      const { count } = await supabase
        .from('resumes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

      setResumeCount(count || 0)
      setLoading(false)
    }

    checkResumeLimit()
  }, [router, supabase])

  // Show loading state
  if (loading) {
    return (
      <>
        <Header />
        <div className="max-w-2xl mx-auto p-8 min-h-screen flex flex-col justify-center">
          <div className="text-center text-gray-600">Loading...</div>
        </div>
      </>
    )
  }

  // Free user with 1 resume already - BLOCKED
  const isBlocked = userTier === 'free' && resumeCount >= 1

  if (isBlocked) {
    return (
      <>
        <Header />
        <div className="max-w-2xl mx-auto p-8 min-h-screen flex flex-col justify-center">
          <h1 className="text-3xl font-bold mb-2">Free Tier Limit Reached</h1>
          <p className="text-gray-600 mb-6">
            You already have a resume. Free tier includes 1 resume at a time.
          </p>

          <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-purple-900 mb-2">
              Your Options:
            </h3>
            <ul className="text-gray-700 space-y-2 mb-4">
              <li>• <strong>Delete your existing resume</strong> to create a new one</li>
              <li>• <strong>Upgrade to Full Resume</strong> ($19.99/mo) for unlimited resumes</li>
            </ul>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => router.push('/my-resumes')}
              className="flex-1 bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-700"
            >
              Go to My Resumes
            </button>
            <button
              onClick={() => router.push('/pricing')}
              className="flex-1 bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700"
            >
              Upgrade to Full Resume →
            </button>
          </div>
        </div>
      </>
    )
  }

  // Normal flow - show upload/build options
  return (
    <>
      <Header />
      <div className="max-w-2xl mx-auto p-8 min-h-screen flex flex-col justify-center">
        <h1 className="text-3xl font-bold mb-2">Let's build your career-ready resume</h1>
        <p className="text-gray-600 mb-8">How would you like to start?</p>

        {/* Upload Option */}
        <div 
          onClick={() => router.push('/resume-upload')}
          className="border-2 border-gray-200 rounded-lg p-6 mb-4 cursor-pointer hover:border-purple-500 transition-colors"
        >
          <div className="flex items-center mb-2">
            <span className="text-2xl mr-3">📤</span>
            <h3 className="text-xl font-semibold">Upload Existing Resume</h3>
          </div>
          <p className="text-gray-600 ml-11">I have a resume ready (PDF, DOCX)</p>
        </div>

        {/* Build from Scratch Option */}
        <div 
          onClick={() => router.push('/resume-builder')}
          className="border-2 border-gray-200 rounded-lg p-6 cursor-pointer hover:border-purple-500 transition-colors"
        >
          <div className="flex items-center mb-2">
            <span className="text-2xl mr-3">✏️</span>
            <h3 className="text-xl font-semibold">Build from Scratch</h3>
          </div>
          <p className="text-gray-600 ml-11">I need to create a resume from the ground up</p>
        </div>
      </div>
    </>
  )
}