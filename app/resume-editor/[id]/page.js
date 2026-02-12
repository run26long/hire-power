'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import Header from '../../components/Header'

export default function ResumeEditorPage() {
  const [resumeData, setResumeData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userProfile, setUserProfile] = useState(null)
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()

  useEffect(() => {
    loadResumeAndProfile()
  }, [])

  const loadResumeAndProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    // Load user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .single()
    
    setUserProfile(profile)

    // Load resume
    const { data: resume, error } = await supabase
      .from('resumes')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (error || !resume) {
      console.error('Error loading resume:', error)
      router.push('/dashboard')
      return
    }

    setResumeData(resume.resume_data || {})
    setLoading(false)
  }

  const handleSave = async () => {
    setSaving(true)

    const { error } = await supabase
      .from('resumes')
      .update({ 
        resume_data: resumeData,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)

    setSaving(false)

    if (error) {
      alert('Error saving changes')
      console.error(error)
    } else {
      // Continue to template selection
      router.push(`/template-selection/${params.id}`)
    }
  }

  const updateSection = (section, value) => {
    setResumeData(prev => ({
      ...prev,
      [section]: value
    }))
  }

  if (loading) {
    return (
      <>
        <Header />
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-600 border-r-transparent mb-4"></div>
            <p className="text-gray-600">Loading your resume...</p>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Edit Your Resume</h1>
          <p className="text-gray-600">
            Make any final tweaks before selecting your template.
          </p>
        </div>

        {/* Personal Info */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Personal Information</h2>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={resumeData.personalInfo?.fullName || ''}
                onChange={(e) => updateSection('personalInfo', {
                  ...resumeData.personalInfo,
                  fullName: e.target.value
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={resumeData.personalInfo?.email || ''}
                onChange={(e) => updateSection('personalInfo', {
                  ...resumeData.personalInfo,
                  email: e.target.value
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={resumeData.personalInfo?.phone || ''}
                onChange={(e) => updateSection('personalInfo', {
                  ...resumeData.personalInfo,
                  phone: e.target.value
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <input
                type="text"
                value={resumeData.personalInfo?.location || ''}
                onChange={(e) => updateSection('personalInfo', {
                  ...resumeData.personalInfo,
                  location: e.target.value
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Professional Summary (Optional)
            </label>
            <textarea
              rows="3"
              value={resumeData.personalInfo?.summary || ''}
              onChange={(e) => updateSection('personalInfo', {
                ...resumeData.personalInfo,
                summary: e.target.value
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Brief professional summary..."
            />
          </div>
        </div>

        {/* Work Experience */}
        {resumeData.workExperience && resumeData.workExperience.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Work Experience</h2>
            
            {resumeData.workExperience.map((job, index) => (
              <div key={index} className="mb-6 pb-6 border-b last:border-b-0">
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Company
                    </label>
                    <input
                      type="text"
                      value={job.company || ''}
                      onChange={(e) => {
                        const updated = [...resumeData.workExperience]
                        updated[index].company = e.target.value
                        updateSection('workExperience', updated)
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Job Title
                    </label>
                    <input
                      type="text"
                      value={job.title || ''}
                      onChange={(e) => {
                        const updated = [...resumeData.workExperience]
                        updated[index].title = e.target.value
                        updateSection('workExperience', updated)
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Responsibilities & Achievements
                  </label>
                  <textarea
                    rows="6"
                    value={job.responsibilities || ''}
                    onChange={(e) => {
                      const updated = [...resumeData.workExperience]
                      updated[index].responsibilities = e.target.value
                      updateSection('workExperience', updated)
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm"
                    placeholder="• Bullet point 1&#10;• Bullet point 2&#10;• Bullet point 3"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    💡 Start each line with • for bullet points
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={() => router.push(`/resume-analysis/${params.id}`)}
            className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            ← Back to Analysis
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && (
              <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>
            )}
            {saving ? 'Saving...' : 'Save & Pick Template →'}
          </button>
        </div>
      </div>
    </>
  )
}