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
const [userTier, setUserTier] = useState(null)
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
        router.push('/dashboard')
        return
      }

      // Check subscription tier
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', user.id)
        .single()
setUserTier(profile?.subscription_tier)
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

      // ATS SCORE TRACKING - Step 1: Save initial score if first time
      const isFirstAnalysis = resumeData.initial_ats_score === null
      
      if (isFirstAnalysis) {
        const { error: scoreError } = await supabase
          .from('resumes')
          .update({ initial_ats_score: result.matchScore })
          .eq('id', resumeId)
        
        if (scoreError) {
          console.error('Failed to save initial ATS score:', scoreError)
        }
      }

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

 // ATS SCORE TRACKING - Step 2: Track improvement if not first analysis AND user is paid
      if (!isFirstAnalysis && userTier !== TIERS.FREE) {
        const initialScore = resumeData.initial_ats_score
        const improvement = result.matchScore - initialScore
        
        // Track improvements for paid users only (they have tools to actually improve)
        await supabase
          .from('ats_improvements')
          .insert({
            user_id: user.id,
            resume_id: resumeId,
            version_id: version.id,
            job_company: formData.company,
            job_title: formData.jobTitle,
            initial_score: initialScore,
            improved_score: result.matchScore,
            improvement_percentage: improvement
          })
      }

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
              className="flex-1 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting && (
                <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>
              )}
              {submitting 
                ? 'Analyzing...' 
                : userTier === TIERS.FREE 
                  ? 'Analyze Match' 
                  : 'Analyze Match & Customize'
              }
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