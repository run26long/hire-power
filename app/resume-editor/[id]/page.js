'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import Header from '../../components/Header'

// Transform structured resume data to editor format
function transformResumeForEditor(data) {
  if (!data.experience) return data
  
  return {
    ...data,
    experience: data.experience.map(job => {
      // If already has description format, keep it
      if (job.description) return job
      
      // Transform summary + achievements to description
      const parts = []
      if (job.summary) parts.push(job.summary)
      if (job.achievements && job.achievements.length > 0) {
        job.achievements.forEach(achievement => {
          parts.push(`• ${achievement}`)
        })
      }
      
      return {
        ...job,
        description: parts.join('\n')
      }
    })
  }
}

export default function ResumeEditorPage() {
  const [resumeData, setResumeData] = useState(null)
  const [aiSuggestions, setAiSuggestions] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showTrialCoach, setShowTrialCoach] = useState(false)
  const [trialCoachMessages, setTrialCoachMessages] = useState([])
  const [trialCoachInput, setTrialCoachInput] = useState('')
  const [coachingSending, setCoachingSending] = useState(false)
  const [selectedJob, setSelectedJob] = useState(null)
  const [coachingComplete, setCoachingComplete] = useState(false)
  const [improvedBullet, setImprovedBullet] = useState(null)
  const trialCoachEndRef = useRef(null)
  const trialCoachInputRef = useRef(null)
  const [canUseTrialCoach, setCanUseTrialCoach] = useState(false)
  const [userTier, setUserTier] = useState(null)
  const [saving, setSaving] = useState(false)
  const [userProfile, setUserProfile] = useState(null)
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const reviewChanges = searchParams.get('reviewChanges') === 'true'
const splitView = searchParams.get('splitView') === 'true'
  useEffect(() => {
    loadResumeAndProfile()
  }, [])

  const loadResumeAndProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/dashboard')
      return
    }

    // Load user profile
   const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier, coaching_samples_used')
      .eq('id', user.id)
      .single()
    
    setUserProfile(profile)
    
    // Check trial coach eligibility
    setUserTier(profile?.subscription_tier)
    if (profile?.subscription_tier === 'free' && profile?.coaching_samples_used === 0) {
      setCanUseTrialCoach(true)
      // Show button after 90 seconds
      setTimeout(() => {
        setShowTrialCoach(true)
      }, 45000)
    }

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

    // Transform resume data to editor format
    const transformedData = transformResumeForEditor(resume.resume_data || {})
    setResumeData(transformedData)
    
    // Load AI suggestions (for free users)
    if (profile?.subscription_tier === 'free' && resume.ai_analysis) {
      setAiSuggestions(resume.ai_analysis)
    }
    
    setLoading(false)
  }
// Auto-scroll trial coach messages and auto-focus input
  useEffect(() => {
    if (trialCoachMessages.length > 0) {
      // Scroll to bottom first
      trialCoachEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      // Then focus input after a brief delay
      setTimeout(() => {
        if (!coachingComplete && trialCoachInputRef.current) {
          trialCoachInputRef.current.focus()
        }
      }, 100)
    }
  }, [trialCoachMessages, coachingComplete])
 
  // Prevent back button from navigating when modal is open
  useEffect(() => {
    if (!showTrialCoach) return

    const handleBackButton = (e) => {
      e.preventDefault()
      setShowTrialCoach(false)
      setSelectedJob(null)
      setTrialCoachMessages([])
      setCoachingComplete(false)
      setImprovedBullet(null)
    }

    window.history.pushState(null, '', window.location.href)
    window.addEventListener('popstate', handleBackButton)

    return () => {
      window.removeEventListener('popstate', handleBackButton)
    }
  }, [showTrialCoach])
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
      router.push(`/choose-template?resumeId=${params.id}`)
    }
  }
  const handleSaveProgress = async () => {
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
      router.push('/my-resumes')
    }
  }

  const updateRootField = (field, value) => {
    setResumeData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const updateArrayItem = (arrayName, index, field, value) => {
    setResumeData(prev => {
      const updated = [...(prev[arrayName] || [])]
      updated[index] = {
        ...updated[index],
        [field]: value
      }
      return {
        ...prev,
        [arrayName]: updated
      }
    })
  }

  const updateSkillsArray = (newSkills) => {
    setResumeData(prev => ({
      ...prev,
      skills: newSkills
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

  const isFree = userProfile?.subscription_tier === 'free'

  return (
    <>
      <div className="sticky top-0 z-50 bg-white shadow-sm">
        <Header />
      </div>
      
      {/* Review Changes Banner */}
      {reviewChanges && (
        <div className="bg-green-50 border-b-2 border-green-200 py-3">
          <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <p className="text-green-900 font-semibold">AI coaching complete!</p>
                <p className="text-green-700 text-sm">Review the improvements below, make any edits you'd like, then save.</p>
              </div>
            </div>
            <button
              onClick={() => router.push(`/resume-editor/${params.id}`)}
              className="text-green-700 hover:text-green-900 text-sm font-medium"
            >
              Dismiss ✕
            </button>
          </div>
        </div>
      )}
      
      <div className="bg-gray-50" style={{ height: 'calc(100vh - 64px)' }}>
     <div className="container mx-auto px-4 max-w-7xl h-full flex flex-col">
          
          {/* Header - STATIC */}
          <div className="py-6 pb-4 flex-shrink-0">
            <h1 className="text-3xl font-bold mb-2">Edit Your Resume</h1>
            <p className="text-gray-600">
              {isFree 
                ? 'Apply the AI suggestions to strengthen your resume'
                : 'Make any final tweaks before selecting your template'}
            </p>
          </div>

        {/* Two-column layout - LOCKED HEIGHT */}
         <div className={`grid gap-6 ${splitView ? 'lg:grid-cols-2' : isFree ? 'lg:grid-cols-3' : 'lg:grid-cols-1'} flex-1 overflow-hidden`}>
{/* RESUME PREVIEW (Split View only) - SCROLLABLE */}
            {splitView && (
              <div className="lg:col-span-1 h-full overflow-y-auto">
                <div className="bg-white rounded-lg shadow-md p-6 sticky top-0">
                  <h3 className="text-lg font-bold mb-4 text-purple-600">Preview</h3>
                  
                  {/* Contact */}
                  {resumeData.fullName && (
                    <div className="mb-4 text-center border-b pb-4">
                      <h4 className="text-xl font-bold">{resumeData.fullName}</h4>
                      <p className="text-sm text-gray-600">
                        {resumeData.email}
                        {resumeData.phone && ` | ${resumeData.phone}`}
                        {resumeData.location && ` | ${resumeData.location}`}
                      </p>
                    </div>
                  )}

                  {/* Experience */}
                  {resumeData.experience && resumeData.experience.length > 0 && (
                    <div className="mb-4">
                      <h5 className="text-sm font-bold mb-2 text-purple-600">EXPERIENCE</h5>
                      {resumeData.experience.map((job, idx) => (
                        <div key={idx} className="mb-3 text-xs">
                          <p className="font-bold">
                            {job.title} | {job.company}
                          </p>
                          <p className="text-gray-700 whitespace-pre-line mt-1">
                            {job.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Education */}
                  {resumeData.education && resumeData.education.length > 0 && (
                    <div className="mb-4">
                      <h5 className="text-sm font-bold mb-2 text-purple-600">EDUCATION</h5>
                      {resumeData.education.map((edu, idx) => (
                        <div key={idx} className="mb-2 text-xs">
                          <p className="font-bold">
                            {edu.degree} | {edu.school}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Skills */}
                  {resumeData.skills && resumeData.skills.length > 0 && (
                    <div className="mb-4">
                      <h5 className="text-sm font-bold mb-2 text-purple-600">SKILLS</h5>
                      <p className="text-xs text-gray-700">
                        {resumeData.skills.join(' • ')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* AI SUGGESTIONS PANEL (Free tier only) - STATIC, NO SCROLL */}
            {isFree && !splitView && (
           
              <div className="lg:col-span-1 h-full overflow-hidden">
                <div className="bg-purple-50 border-2 border-purple-300 rounded-lg p-4 h-full flex flex-col">                  <h3 className="text-base font-bold text-purple-900 mb-2 flex items-center gap-2">
                    <span>💡</span> AI Suggestions
                  </h3>
                  <p className="text-xs text-purple-800 mb-3">
                    Apply these to your resume on the right.
                  </p>
                  
                  <div className="space-y-2 text-xs flex-1 overflow-hidden">
                    {aiSuggestions ? (
                      <>
                        {/* Suggestions Only */}
                        {aiSuggestions.suggestions && aiSuggestions.suggestions.length > 0 ? (
                          aiSuggestions.suggestions.map((suggestion, index) => (
                            <div key={index} className="bg-white rounded-md p-2 border border-purple-200">
                              {typeof suggestion === 'string' ? (
                                <div className="text-gray-700 text-xs leading-snug">{suggestion}</div>
                              ) : (
                                <>
                                  <div className="font-semibold text-purple-900 mb-1 text-xs">
                                    {suggestion.section}
                                  </div>
                                  <div className="text-gray-700 text-xs leading-snug">
                                    {suggestion.text}
                                  </div>
                                </>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                            <p className="text-sm text-yellow-800">
                              No suggestions available yet.
                            </p>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <p className="text-sm text-yellow-800">
                          No AI analysis found.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 pt-3 border-t border-purple-200">
                    <button
                      onClick={() => router.push('/choose-plan')}
                      className="w-full bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700 transition-colors text-xs font-medium"
                    >
                      💜 Upgrade to Full Resume
                    </button>
                    <p className="text-xs text-purple-700 mt-1.5 text-center leading-tight">
                      Get AI coaching that applies these automatically
                    </p>
                  </div>
                </div>
              </div>
            )}

          {/* EDITOR COLUMN - SCROLLABLE ONLY */}
            <div className={`${splitView ? 'lg:col-span-1' : isFree ? 'lg:col-span-2' : 'lg:col-span-1'} overflow-y-auto`}>
              <div className="pb-20">
              
              {/* Personal Info */}
              <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <span>👤</span> Personal Information
                </h2>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        value={resumeData.fullName || ''}
                        onChange={(e) => updateRootField('fullName', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email *
                      </label>
                      <input
                        type="email"
                        value={resumeData.email || ''}
                        onChange={(e) => updateRootField('email', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Phone *
                      </label>
                      <input
                        type="tel"
                        value={resumeData.phone || ''}
                        onChange={(e) => updateRootField('phone', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Location *
                      </label>
                      <input
                        type="text"
                        value={resumeData.location || ''}
                        onChange={(e) => updateRootField('location', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="City, State"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      LinkedIn URL
                    </label>
                    <input
                      type="url"
                      value={resumeData.linkedin || ''}
                      onChange={(e) => updateRootField('linkedin', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="https://linkedin.com/in/yourname"
                    />
                  </div>
                </div>
              </div>

              {/* Work Experience */}
              {resumeData.experience && resumeData.experience.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
                  <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <span>💼</span> Work Experience
                  </h2>
                  
                  {resumeData.experience.map((job, index) => (
                    <div key={index} className="mb-6 pb-6 border-b last:border-b-0">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Company
                          </label>
                          <input
                            type="text"
                            value={job.company || ''}
                            onChange={(e) => updateArrayItem('experience', index, 'company', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Job Title
                          </label>
                          <input
                            type="text"
                            value={job.title || ''}
                            onChange={(e) => updateArrayItem('experience', index, 'title', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Start Date
                          </label>
                          <input
                            type="text"
                            value={job.startDate || ''}
                            onChange={(e) => updateArrayItem('experience', index, 'startDate', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="YYYY-MM"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            End Date
                          </label>
                          <input
                            type="text"
                            value={job.endDate || ''}
                            onChange={(e) => updateArrayItem('experience', index, 'endDate', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="YYYY-MM or leave blank if current"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Role Summary & Achievements
                        </label>
                        <textarea
                          rows="8"
                          value={job.description || ''}
                          onChange={(e) => updateArrayItem('experience', index, 'description', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="Brief role summary, then bullet points:&#10;• Achievement 1&#10;• Achievement 2&#10;• Achievement 3"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          💡 Start each line with • for bullet points
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Education */}
              {resumeData.education && resumeData.education.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
                  <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <span>🎓</span> Education
                  </h2>
                  
                  {resumeData.education.map((edu, index) => (
                    <div key={index} className="mb-4 pb-4 border-b last:border-b-0">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            School
                          </label>
                          <input
                            type="text"
                            value={edu.school || ''}
                            onChange={(e) => updateArrayItem('education', index, 'school', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Degree
                          </label>
                          <input
                            type="text"
                            value={edu.degree || ''}
                            onChange={(e) => updateArrayItem('education', index, 'degree', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Major
                          </label>
                          <input
                            type="text"
                            value={edu.major || ''}
                            onChange={(e) => updateArrayItem('education', index, 'major', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Graduation Date
                          </label>
                          <input
                            type="text"
                            value={edu.graduationDate || ''}
                            onChange={(e) => updateArrayItem('education', index, 'graduationDate', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="YYYY-MM"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            GPA (optional)
                          </label>
                          <input
                            type="text"
                            value={edu.gpa || ''}
                            onChange={(e) => updateArrayItem('education', index, 'gpa', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>

                        <div className="col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Minor (optional)
                          </label>
                          <input
                            type="text"
                            value={edu.minor || ''}
                            onChange={(e) => updateArrayItem('education', index, 'minor', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>
                      </div>

                      <div className="mt-3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Activities (optional)
                        </label>
                        <input
                          type="text"
                          value={edu.activities || ''}
                          onChange={(e) => updateArrayItem('education', index, 'activities', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      </div>

                      <div className="mt-3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Honors (optional)
                        </label>
                        <input
                          type="text"
                          value={edu.honors || ''}
                          onChange={(e) => updateArrayItem('education', index, 'honors', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Skills */}
              {resumeData.skills && resumeData.skills.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
                  <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <span>⚡</span> Skills
                  </h2>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Your Skills (comma-separated)
                    </label>
                    <textarea
                      rows="3"
                      value={resumeData.skills.join(', ')}
                      onChange={(e) => {
                        const skillsArray = e.target.value.split(',').map(s => s.trim()).filter(s => s)
                        updateSkillsArray(skillsArray)
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Communication, Leadership, Microsoft Excel, Project Management"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Separate each skill with a comma
                    </p>
                  </div>
                </div>
              )}

              {/* Certifications */}
              {resumeData.certifications && resumeData.certifications.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
                  <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <span>📜</span> Certifications & Licenses
                  </h2>
                  
                  {resumeData.certifications.map((cert, index) => (
                    <div key={index} className="mb-4 pb-4 border-b last:border-b-0">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Name
                          </label>
                          <input
                            type="text"
                            value={cert.name || ''}
                            onChange={(e) => updateArrayItem('certifications', index, 'name', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Issuer
                          </label>
                          <input
                            type="text"
                            value={cert.issuer || ''}
                            onChange={(e) => updateArrayItem('certifications', index, 'issuer', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Date Received
                          </label>
                          <input
                            type="text"
                            value={cert.date || ''}
                            onChange={(e) => updateArrayItem('certifications', index, 'date', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="YYYY-MM"
                          />
                        </div>

                        {cert.expires && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Expiration Date
                            </label>
                            <input
                              type="text"
                              value={cert.expirationDate || ''}
                              onChange={(e) => updateArrayItem('certifications', index, 'expirationDate', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              placeholder="YYYY-MM"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Volunteer */}
              {resumeData.volunteer && resumeData.volunteer.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
                  <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <span>🤝</span> Volunteer & Leadership
                  </h2>
                  
                  {resumeData.volunteer.map((vol, index) => (
                    <div key={index} className="mb-4 pb-4 border-b last:border-b-0">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Role
                          </label>
                          <input
                            type="text"
                            value={vol.role || ''}
                            onChange={(e) => updateArrayItem('volunteer', index, 'role', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Organization
                          </label>
                          <input
                            type="text"
                            value={vol.organization || ''}
                            onChange={(e) => updateArrayItem('volunteer', index, 'organization', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Description
                        </label>
                        <textarea
                          rows="2"
                          value={vol.description || ''}
                          onChange={(e) => updateArrayItem('volunteer', index, 'description', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Projects */}
              {resumeData.projects && resumeData.projects.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
                  <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <span>🚀</span> Projects
                  </h2>
                  
                  {resumeData.projects.map((proj, index) => (
                    <div key={index} className="mb-4 pb-4 border-b last:border-b-0">
                      <div className="mb-3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Project Name
                        </label>
                        <input
                          type="text"
                          value={proj.name || ''}
                          onChange={(e) => updateArrayItem('projects', index, 'name', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      </div>

                      <div className="mb-3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Description
                        </label>
                        <textarea
                          rows="2"
                          value={proj.description || ''}
                          onChange={(e) => updateArrayItem('projects', index, 'description', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Technologies (optional)
                        </label>
                        <input
                          type="text"
                          value={proj.technologies || ''}
                          onChange={(e) => updateArrayItem('projects', index, 'technologies', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Languages */}
              {resumeData.languages && resumeData.languages.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
                  <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <span>🌍</span> Languages
                  </h2>
                  
                  {resumeData.languages.map((lang, index) => (
                    <div key={index} className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Language
                        </label>
                        <input
                          type="text"
                          value={lang.language || ''}
                          onChange={(e) => updateArrayItem('languages', index, 'language', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Proficiency
                        </label>
                        <select
                          value={lang.proficiency || 'conversational'}
                          onChange={(e) => updateArrayItem('languages', index, 'proficiency', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                          <option value="basic">Basic</option>
                          <option value="conversational">Conversational</option>
                          <option value="fluent">Fluent</option>
                          <option value="native">Native</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Action Buttons - Inside Editor Column */}
              <div className="flex justify-between items-center mt-6 pb-6">
                <button
                  onClick={handleSaveProgress}
                  disabled={saving}
                  className="text-gray-600 hover:text-gray-800 font-medium underline"
                >
                  {saving ? 'Saving...' : 'Save & Continue Later'}
                </button>

        <button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-purple-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving && (
                    <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>
                  )}
                  {saving ? 'Saving...' : 'Format & Finalize →'}
                </button>
              </div> {/* Close buttons flex div */}

              </div> {/* Close pb-20 wrapper */}
            </div> {/* Close editor column */}

          </div> {/* Close grid */}

        </div> {/* Close container */}
      </div> {/* Close bg-gray-50 */}
      {/* Floating Trial Coach Button - Free Users Only */}
      {canUseTrialCoach && (
        <button
          onClick={() => {
            // Open job selection modal
            setShowTrialCoach(true)
          }}
          className="fixed bottom-6 right-6 bg-purple-600 text-white px-6 py-4 rounded-full shadow-lg hover:bg-purple-700 transition-all flex items-center gap-2 z-50 animate-pulse"
        >
          <span className="text-2xl">🎓</span>
          <span className="font-semibold">Free AI Coaching</span>
        </button>
      )}

   {/* Trial Coach Modal */}
      {showTrialCoach && (
   <div className="fixed inset-0 bg-white bg-opacity-80 backdrop-blur-sm flex items-center justify-center z-50 p-4">          
 <div className="bg-white rounded-lg p-6 max-w-2xl w-full shadow-2xl border-2 border-purple-300 max-h-[85vh] overflow-y-auto">
            
            {/* Job Selection (before coaching starts) */}
            {trialCoachMessages.length === 0 && (
              <>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">✨ Get Free AI Coaching Sample</h3>
                <p className="text-gray-700 mb-4">
                  Experience our professional resume coaching on one of your jobs.
                </p>
                <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4 mb-6">
                  <p className="font-semibold text-purple-900 mb-2">Our AI coach will:</p>
                  <ul className="text-purple-800 space-y-1 text-sm">
                    <li>• Ask strategic questions to extract your achievements</li>
                    <li>• Identify quantifiable metrics you may have missed</li>
                    <li>• Transform your strongest bullet with professional phrasing</li>
                  </ul>
                  <p className="text-xs text-purple-700 mt-3 italic">
                    Free tier: One coaching session per account
                  </p>
                </div>

                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Which job would you like coaching on?
                </label>
                <select
                  onChange={(e) => {
                    const jobIndex = parseInt(e.target.value)
                    if (!isNaN(jobIndex)) {
                      setSelectedJob(resumeData.experience[jobIndex])
                    }
                  }}
                  className="w-full border border-gray-300 rounded-lg p-3 mb-6"
                >
                  <option value="">Select a job...</option>
                  {resumeData.experience?.map((job, idx) => (
                    <option key={idx} value={idx}>
                      {job.title} at {job.company}
                    </option>
                  ))}
                </select>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowTrialCoach(false)}
                    className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 font-medium"
                  >
                    Maybe Later
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!selectedJob) return
                      
                      // Start coaching conversation
                      setCoachingSending(true)
                      
                      try {
                        const response = await fetch('/api/trial-coach', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            jobData: selectedJob,
                            conversation: [
                              { role: 'user', content: "Hi! I'm ready for coaching on this job." }
                            ]
                          })
                        })
                        
                        const data = await response.json()
                        setTrialCoachMessages([
                          { role: 'assistant', content: data.response }
                        ])
                      } catch (error) {
                        console.error('Error starting trial coach:', error)
                      } finally {
                        setCoachingSending(false)
                      }
                    }}
                    disabled={!selectedJob}
                    className="flex-1 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 font-semibold disabled:opacity-50"
                  >
                    Start Coaching Session
                  </button>
                </div>
              </>
            )}
       {/* Coaching Chat Interface */}
            {trialCoachMessages.length > 0 && (
              <>

             {/* Messages */}
                {!improvedBullet && (
                  <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
                  {trialCoachMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg ${
                        msg.role === 'assistant'
                          ? 'bg-purple-50 border border-purple-200'
                          : 'bg-gray-100 border border-gray-200 ml-8'
                      }`}
                    >
                      <p className="text-xs font-semibold text-gray-700 mb-1">
                        {msg.role === 'assistant' ? '🎓 Coach' : 'You'}
                      </p>
                      <p className="text-sm text-gray-800 whitespace-pre-line">
                        {msg.content}
                      </p>
                    </div>
                  ))}
                  
                  {coachingSending && (
                    <div className="p-3 rounded-lg bg-purple-50 border border-purple-200">
                      <p className="text-xs font-semibold text-gray-700 mb-1">🎓 Coach</p>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                      </div>
                    </div>
                  )}
                     <div ref={trialCoachEndRef} />
                </div>
)}
            {/* Input */}
                {!coachingComplete && (
                  <div className="flex gap-2">
                   <textarea
  ref={trialCoachInputRef}
  value={trialCoachInput}
  onChange={(e) => setTrialCoachInput(e.target.value)}
                      onKeyPress={async (e) => {
                        if (e.key === 'Enter' && !e.shiftKey && !coachingSending && trialCoachInput.trim()) {
                          e.preventDefault()
                          const userMessage = { role: 'user', content: trialCoachInput }
                          const updatedMessages = [...trialCoachMessages, userMessage]
                          setTrialCoachMessages(updatedMessages)
                          setTrialCoachInput('')
                          setCoachingSending(true)

                          try {
                            const response = await fetch('/api/trial-coach', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                jobData: selectedJob,
                                conversation: updatedMessages
                              })
                            })

                            const data = await response.json()
                            setTrialCoachMessages([
                              ...updatedMessages,
                              { role: 'assistant', content: data.response }
                            ])

                            if (data.response.toLowerCase().includes('click \'finish coaching\'')) {
                              setCoachingComplete(true)
                            }
                          } catch (error) {
                            console.error('Error:', error)
                          } finally {
                            setCoachingSending(false)
                          }
                        }
                      }}
                      placeholder="Type your response..."
                      disabled={coachingSending}
                      className="flex-1 border border-gray-300 rounded-lg p-3 text-sm resize-none"
                      rows="3"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        if (!trialCoachInput.trim() || coachingSending) return
                        
                        const userMessage = { role: 'user', content: trialCoachInput }
                        const updatedMessages = [...trialCoachMessages, userMessage]
                        setTrialCoachMessages(updatedMessages)
                        setTrialCoachInput('')
                        setCoachingSending(true)

                        try {
                          const response = await fetch('/api/trial-coach', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              jobData: selectedJob,
                              conversation: updatedMessages
                            })
                          })

                          const data = await response.json()
                          setTrialCoachMessages([
                            ...updatedMessages,
                            { role: 'assistant', content: data.response }
                          ])

                          if (data.response.toLowerCase().includes('click \'finish coaching\'')) {
                            setCoachingComplete(true)
                          }
                        } catch (error) {
                          console.error('Error:', error)
                        } finally {
                          setCoachingSending(false)
                        }
                      }}
         disabled={!trialCoachInput.trim() || coachingSending}
                      className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium"
                    >
                      Send
                    </button>
                  </div>
                )}

                {/* Finish Coaching Button */}
                {coachingComplete && !improvedBullet && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        setCoachingSending(true)
                        
                        const response = await fetch('/api/trial-coach-finish', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            jobData: selectedJob,
                            conversation: trialCoachMessages,
                            existingSkills: resumeData?.skills || []
                          })
                        })

                        const result = await response.json()
                        setImprovedBullet(result)
                        
                        // Mark coaching sample as used
                        const { data: { user } } = await supabase.auth.getUser()
                        await supabase
                          .from('profiles')
                          .update({ coaching_samples_used: 1 })
                          .eq('id', user.id)
                          
                      } catch (error) {
                        console.error('Error:', error)
                        alert('Failed to generate improved bullet. Please try again.')
                      } finally {
                        setCoachingSending(false)
                      }
                    }}
                    disabled={coachingSending}
                    className="w-full mt-4 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {coachingSending && (
                      <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>
                    )}
                    {coachingSending ? 'Analyzing...' : '✅ Finish Coaching'}
                  </button>
                )}

{/* Results - Before/After Comparison */}
                {improvedBullet && (
                  <div className="mt-4 space-y-3">
                    {/* Before/After/Skills in one container */}
                    <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4">
                      <h4 className="font-bold text-purple-900 mb-3">✨ Your Free Coaching Sample</h4>
                      
                      <div className="space-y-2">
                        <div className="bg-red-50 border border-red-200 rounded p-2">
                          <p className="text-xs font-semibold text-red-700 mb-1">BEFORE:</p>
                          <p className="text-sm text-gray-800">{improvedBullet.originalBullet}</p>
                        </div>
                        
                        <div className="bg-green-50 border-2 border-green-300 rounded p-2">
                          <p className="text-xs font-semibold text-green-700 mb-1">AFTER:</p>
                          <p className="text-sm text-gray-900 font-medium">{improvedBullet.improvedBullet}</p>
                        </div>

                        {/* Skills box - same style */}
                        {improvedBullet.skillsCount > 0 && (
                         <div className="bg-white border-2 border-purple-300 rounded p-2">
                            <p className="text-xs font-semibold text-purple-700 mb-1">✨ SKILLS DISCOVERED:</p>
                            <p className="text-sm text-gray-800">
                              I found <span className="font-bold text-purple-900">{improvedBullet.skillsCount} new skill{improvedBullet.skillsCount !== 1 ? 's' : ''}</span> during our conversation that aren't on your resume yet.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Upgrade Button - separate, one line */}
                    <button
                      onClick={() => router.push('/pricing')}
                      className="w-full bg-purple-600 text-white px-4 py-3 rounded-lg hover:bg-purple-700 font-medium text-sm"
                    >
                      Upgrade to Full Coaching to reveal skills and improve all bullets →
                    </button>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          // Apply the improved bullet to the resume
                          const updatedDescription = selectedJob.description.replace(
                            improvedBullet.originalBullet,
                            improvedBullet.improvedBullet
                          )
                          
                          const jobIndex = resumeData.experience.findIndex(
                            job => job.title === selectedJob.title && job.company === selectedJob.company
                          )
                          
                          if (jobIndex !== -1) {
                            updateArrayItem('experience', jobIndex, 'description', updatedDescription)
                          }
                          
                          // Close modal
                          setShowTrialCoach(false)
                          setSelectedJob(null)
                          setTrialCoachMessages([])
                          setCoachingComplete(false)
                          setImprovedBullet(null)
                          setCanUseTrialCoach(false)
                        }}
                        className="bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 font-semibold text-sm"
                      >
                        Apply New Bullet to My Resume
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          // Close modal without applying
                          setShowTrialCoach(false)
                          setSelectedJob(null)
                          setTrialCoachMessages([])
                          setCoachingComplete(false)
                          setImprovedBullet(null)
                          setCanUseTrialCoach(false)
                        }}
                        className="bg-gray-200 text-gray-700 px-4 py-3 rounded-lg hover:bg-gray-300 font-medium text-sm"
                      >
                        Return to Resume Without Applying
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}