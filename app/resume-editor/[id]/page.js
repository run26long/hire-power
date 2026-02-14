'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import Header from '../../components/Header'

export default function ResumeEditorPage() {
  const [resumeData, setResumeData] = useState(null)
  const [aiSuggestions, setAiSuggestions] = useState(null)
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
    
    // Load AI suggestions (for free users)
    if (profile?.subscription_tier === 'free' && resume.ai_analysis) {
      setAiSuggestions(resume.ai_analysis)
    }
    
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
         <div className={`grid gap-6 ${isFree ? 'lg:grid-cols-3' : 'lg:grid-cols-1'} flex-1 overflow-hidden`}>

            {/* AI SUGGESTIONS PANEL (Free tier only) - STATIC, NO SCROLL */}
            {isFree && (
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
            <div className={`${isFree ? 'lg:col-span-2' : 'lg:col-span-1'} overflow-y-auto`}>
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
    </>
  )
}