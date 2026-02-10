'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import Header from '@/app/components/Header'
import { TIERS, hasFeatureAccess, FEATURES } from '@/lib/subscription'

export default function CustomizeResume() {
  const router = useRouter()
  const params = useParams()
  const resumeId = params.id
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [resumeData, setResumeData] = useState(null)
  const [formData, setFormData] = useState({
    jobTitle: '',
    company: '',
    jobDescription: ''
  })

  useEffect(() => {
    loadResume()
  }, [])

 async function loadResume() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      // Check subscription tier
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', user.id)
        .single()

      // Block free users from professional coaching
if (profile.subscription_tier === TIERS.FREE) {
  router.push('/pricing')
  return
}

      const { data, error } = await supabase
        .from('resumes')
        .select('*')
        .eq('id', resumeId)
        .eq('user_id', user.id)
        .single()

      if (error) throw error

      setResumeData(data)
      setLoading(false)
    } catch (error) {
      console.error('Error loading resume:', error)
      router.push('/my-resumes')
    }
  }
  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()

      // Call the tailor API endpoint
      const response = await fetch('/api/tailor-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeId: resumeId,
          resumeData: resumeData.resume_data,
          jobTitle: formData.jobTitle,
          company: formData.company,
          jobDescription: formData.jobDescription
        })
      })

      if (!response.ok) throw new Error('Failed to analyze job')

      const result = await response.json()

      // Save to resume_versions table
      const { data: version, error } = await supabase
        .from('resume_versions')
        .insert({
          resume_id: resumeId,
          user_id: user.id,
          version_name: `${formData.company} - ${formData.jobTitle}`,
          job_title: formData.jobTitle,
          job_company: formData.company,
          job_description: formData.jobDescription,
          customized_resume_data: result.customizedResume,
          match_score: result.matchScore,
          analysis: result.analysis
        })
        .select()
        .single()

      if (error) throw error

      // Redirect to the analysis page
      router.push(`/job-analysis/${version.id}`)

    } catch (error) {
      console.error('Error customizing resume:', error)
      alert('Failed to customize resume. Please try again.')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-3xl mx-auto p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Customize for Job</h1>
          <p className="text-gray-600">
            Upload the job description and we'll analyze how well your resume matches and optimize it for this position.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg p-8">
          <div className="mb-6">
            <label className="block text-sm font-semibold mb-2 text-gray-700">
              Job Title *
            </label>
            <input
              type="text"
              value={formData.jobTitle}
              onChange={(e) => setFormData({...formData, jobTitle: e.target.value})}
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-600 focus:border-transparent"
              placeholder="e.g., Senior Marketing Manager"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold mb-2 text-gray-700">
              Company *
            </label>
            <input
              type="text"
              value={formData.company}
              onChange={(e) => setFormData({...formData, company: e.target.value})}
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-600 focus:border-transparent"
              placeholder="e.g., Microsoft"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold mb-2 text-gray-700">
              Job Description *
            </label>
            <textarea
              value={formData.jobDescription}
              onChange={(e) => setFormData({...formData, jobDescription: e.target.value})}
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-600 focus:border-transparent h-64 font-mono text-sm"
              placeholder="Paste the full job description here..."
              required
            />
            <p className="text-xs text-gray-500 mt-2">
              Tip: Copy the entire job posting including requirements, responsibilities, and qualifications
            </p>
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {submitting ? 'Analyzing...' : 'Analyze Match & Customize'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/my-resumes')}
              className="border-2 border-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50 font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}