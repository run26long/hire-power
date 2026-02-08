'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

export default function PreCoachingConfirmation() {
  const router = useRouter()
  const [resumeData, setResumeData] = useState(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadResumeData()
  }, [])

  async function loadResumeData() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      const { data, error } = await supabase
        .from('resumes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error) throw error

      setResumeData(data)
      setLoading(false)
    } catch (error) {
      console.error('Error loading resume:', error)
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your resume...</p>
        </div>
      </div>
    )
  }

  if (!resumeData) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <p className="text-red-600">Error loading resume data. Please try again.</p>
        <button
          onClick={() => router.push('/resume-start')}
          className="mt-4 text-purple-600 hover:underline"
        >
          ← Start over
        </button>
      </div>
    )
  }

 const data = resumeData.resume_data || {}
const isUpload = resumeData.created_via === 'upload'

return (
  <div className="max-w-2xl mx-auto p-8">
    <div className="mb-8">
      <div className="text-green-600 text-6xl mb-4">✅</div>
      <h2 className="text-3xl font-bold mb-4">Great! Here's what we have:</h2>
      
      {isUpload ? (
        <div className="bg-gray-50 rounded-lg p-6">
          <p className="text-gray-700 mb-3">
            ✅ Resume uploaded and parsed successfully!
          </p>
          <p className="text-sm text-gray-600">
            We've extracted your resume content and it's ready for coaching.
          </p>
        </div>
      ) : (
        <div className="space-y-3 text-lg text-gray-700 bg-gray-50 rounded-lg p-6">
          <p className="flex items-center">
            <span className="text-2xl mr-3">👤</span>
            <span><strong>{data.fullName}</strong></span>
          </p>
          <p className="flex items-center">
            <span className="text-2xl mr-3">💼</span>
            <span><strong>{data.experience?.length || 0}</strong> {data.experience?.length === 1 ? 'job' : 'jobs'} listed</span>
          </p>
          <p className="flex items-center">
            <span className="text-2xl mr-3">🎓</span>
            <span><strong>{data.education?.length || 0}</strong> education {data.education?.length === 1 ? 'entry' : 'entries'}</span>
          </p>
          <p className="flex items-center">
            <span className="text-2xl mr-3">🛠️</span>
            <span><strong>{data.skills?.length || 0}</strong> skills listed</span>
          </p>
        </div>
      )}
    </div>

  <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-6 mb-6">
  <h3 className="font-semibold text-lg mb-3">Ready to start coaching?</h3>
  <p className="text-gray-700 mb-4">
    Our AI coach will help you extract quantifiable achievements and craft compelling bullet points.
  </p>
  <p className="text-sm text-gray-500 mt-2">
    💡 During coaching, we'll ask if there's anything recent you'd like to add!
  </p>
</div>

      <div className="flex gap-4">
        <button
          onClick={() => router.push('/resume-start')}
          className="flex-1 border-2 border-gray-300 text-gray-700 py-4 rounded-lg hover:bg-gray-50 transition-colors font-medium text-lg"
        >
          ← Go Back
        </button>
        <button
          onClick={() => router.push('/resume-coaching')}
          className="flex-1 bg-purple-600 text-white py-4 rounded-lg hover:bg-purple-700 transition-colors font-medium text-lg"
        >
          Start Coaching! 🚀
        </button>
      </div>
    </div>
  )
}