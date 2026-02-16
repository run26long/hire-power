'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import Header from '../components/Header'
import { TIERS } from '@/lib/subscription'

function formatDate(dateStr) {
  if (!dateStr) return ''
  if (dateStr.toLowerCase() === 'present') return 'Present'
  
  const [year, month] = dateStr.split('-')
  const monthNum = parseInt(month, 10)
  const yearShort = year.slice(-2)
  return `${monthNum}/${yearShort}`
}

export default function MyResumes() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [resumeData, setResumeData] = useState(null)
  const [versions, setVersions] = useState([])
  const [selectedVersion, setSelectedVersion] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [userProfile, setUserProfile] = useState(null)
  const [showAnalysisModal, setShowAnalysisModal] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    loadResumeAndProfile()
  }, [])

 useEffect(() => {
    // Check if we should show the AI analysis modal
    if (resumeData && !resumeData.ai_analysis && !localStorage.getItem(`dismissed_analysis_modal_${resumeData.id}`)) {
      setShowAnalysisModal(true)
    }
  }, [resumeData])

  async function loadResumeAndProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      // Load user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier, photo_url, display_name')
        .eq('id', user.id)
        .single()
      
      setUserProfile(profile)

      // Load resume
      const { data, error } = await supabase
        .from('resumes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error) throw error

      setResumeData(data)

      // Load job-specific versions
      const { data: versionsData } = await supabase
        .from('resume_versions')
        .select('*')
        .eq('resume_id', data.id)
        .order('created_at', { ascending: false })

      setVersions(versionsData || [])
      setLoading(false)
    } catch (error) {
      // No resume exists - this is normal for new users
      if (error.code === 'PGRST116') {
        setResumeData(null)
      } else {
        console.error('Error loading resume:', error)
      }
      setLoading(false)
    }
  }

  async function deleteFormattedVersion(templateName, versionId = null) {
    if (!confirm('Delete this formatted version?')) return

    try {
      const tableName = versionId ? 'resume_versions' : 'resumes'
      const recordId = versionId || resumeData.id

      const { data: currentRecord } = await supabase
        .from(tableName)
        .select('formatted_versions')
        .eq('id', recordId)
        .single()

      const formattedVersions = currentRecord?.formatted_versions || {}
      const versionData = formattedVersions[templateName]

      if (versionData?.file_path) {
        await supabase.storage
          .from('resume-pdfs')
          .remove([versionData.file_path])
      }

      delete formattedVersions[templateName]

      await supabase
        .from(tableName)
        .update({ formatted_versions: formattedVersions })
        .eq('id', recordId)

      loadResumeAndProfile()
    } catch (error) {
      console.error('Error deleting version:', error)
      alert('Failed to delete. Please try again.')
    }
  }

  const handleDeleteResume = async () => {
    setDeleting(true)
    
    try {
      // Delete file from storage
      if (resumeData.file_path) {
        await supabase.storage
          .from('resumes')
          .remove([resumeData.file_path])
      }
      
      // Delete from database
      const { error } = await supabase
        .from('resumes')
        .delete()
        .eq('id', resumeData.id)
      
      if (error) throw error
      
      // Reload page to show "no resume" state
      window.location.reload()
    } catch (error) {
      console.error('Error deleting resume:', error)
      alert('Failed to delete resume. Please try again.')
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  if (!resumeData || !resumeData.resume_data) {
    return (
      <>
        <Header />
        <div className="max-w-4xl mx-auto p-8 text-center">
          <h1 className="text-3xl font-bold mb-4">My Resumes</h1>
          <p className="text-gray-600 mb-4">You haven't created a resume yet.</p>
          <button
            onClick={() => router.push('/resume-start')}
            className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700"
          >
            Create Resume
          </button>
        </div>
      </>
    )
  }

  const displayResume = selectedVersion ? selectedVersion.customized_resume_data : resumeData.resume_data
  const isViewingVersion = !!selectedVersion
  const isFree = userProfile?.subscription_tier === TIERS.FREE

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Page Title */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">
              {isViewingVersion 
                ? `${selectedVersion.job_company} - ${selectedVersion.job_title}`
                : 'My Resumes'
              }
            </h1>
            <p className="text-gray-600">
              {isViewingVersion
                ? 'Job-specific customized version'
                : 'Your AI-optimized resume with quantifiable achievements'
              }
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Sidebar - Resume Versions */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-md p-6 sticky top-8">
                
                {/* Core Resume */}
                <div className="mb-6">
                  <h3 className="font-bold text-sm text-gray-500 uppercase mb-3">Core Resume</h3>
                  <button
                    onClick={() => setSelectedVersion(null)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      !selectedVersion 
                        ? 'border-purple-600 bg-purple-50' 
                        : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className="font-semibold text-purple-600">Base Resume</p>
                        <p className="text-xs text-gray-500 mt-1">Your improved content</p>
                      </div>
                      {!selectedVersion && (
                        <span className="text-purple-600 font-bold text-lg">✓</span>
                      )}
                    </div>
                    {Object.keys(resumeData.formatted_versions || {}).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {Object.keys(resumeData.formatted_versions).map(templateName => (
                          <span key={templateName} className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                            {templateName}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                  
                  {/* Delete Button */}
                  {!isViewingVersion && (
                    <button
                      onClick={() => setShowDeleteModal(true)}
                      className="w-full mt-3 text-red-600 hover:text-red-700 hover:bg-red-50 p-2 rounded transition-all text-sm font-medium"
                    >
                      🗑️ Delete Resume
                    </button>
                  )}
                </div>

                {/* AI Analysis Button */}
                <div className="mb-6">
                  <button
                    onClick={() => router.push(`/resume-analysis/${resumeData.id}`)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      resumeData.ai_analysis
                        ? 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                        : 'border-purple-600 bg-purple-50 hover:bg-purple-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`text-2xl ${resumeData.ai_analysis ? '' : 'animate-pulse'}`}>
                        {resumeData.ai_analysis ? '📊' : '🔍'}
                      </div>
                      <div className="flex-1">
                        <p className={`font-semibold ${resumeData.ai_analysis ? 'text-gray-700' : 'text-purple-900'}`}>
                          {resumeData.ai_analysis 
                            ? (isFree ? 'View AI Analysis' : 'AI Analysis')
                            : 'Run AI Analysis'
                          }
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {resumeData.ai_analysis 
                            ? 'See strengths & suggestions'
                            : 'Identify improvements'
                          }
                        </p>
                      </div>
                      {!resumeData.ai_analysis && (
                        <span className="text-purple-600 font-bold">→</span>
                      )}
                    </div>
                  </button>
                </div>

                {/* Job-Specific Versions */}
                {versions.length > 0 && (
                  <div>
                    <h3 className="font-bold text-sm text-gray-500 uppercase mb-3">
                      {isFree ? 'ATS Match Scores' : 'Job-Customized Versions'}
                    </h3>
                    <div className="space-y-3">
                      {versions.map((version) => (
                        <div
                          key={version.id}
                          className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                            selectedVersion?.id === version.id 
                              ? 'border-purple-600 bg-purple-50' 
                              : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <button
                              onClick={() => router.push(`/job-analysis/${version.id}`)}
                              className="flex-1 text-left"
                            >
                              <p className="font-semibold text-sm hover:text-purple-600">{version.job_company}</p>
                              <p className="text-xs text-gray-600 mt-1">{version.job_title}</p>
                            </button>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation()
                                if (!confirm(`Delete ${version.job_company} - ${version.job_title}?`)) return
                                
                                try {
                                  const { error } = await supabase
                                    .from('resume_versions')
                                    .delete()
                                    .eq('id', version.id)
                                  
                                  if (error) throw error
                                  
                                  loadResumeAndProfile()
                                  if (selectedVersion?.id === version.id) {
                                    setSelectedVersion(null)
                                  }
                                } catch (error) {
                                  console.error('Error deleting version:', error)
                                  alert('Failed to delete. Please try again.')
                                }
                              }}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1.5 rounded transition-all ml-2"
                              title="Delete this job version"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                          {version.match_score && (
                            <div className="mt-2">
                              <span className={`text-xs font-semibold px-2 py-1 rounded ${
                                version.match_score >= 85 ? 'bg-green-100 text-green-700' :
                                version.match_score >= 70 ? 'bg-yellow-100 text-yellow-700' :
                                'bg-orange-100 text-orange-700'
                              }`}>
                                {version.match_score}% Match
                              </span>
                            </div>
                          )}
                          {!isFree && Object.keys(version.formatted_versions || {}).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {Object.keys(version.formatted_versions).map(templateName => (
                                <span key={templateName} className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                                  {templateName}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-2">
              
              {/* Action Cards */}
              {isViewingVersion ? (
                /* Job Version Actions */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <button
                    onClick={() => router.push(`/job-analysis/${selectedVersion.id}`)}
                    className="bg-white border-2 border-purple-200 rounded-lg p-6 hover:border-purple-400 hover:shadow-lg transition-all text-left group"
                  >
                    <div className="flex items-center gap-4 mb-3">
                      <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center text-2xl group-hover:bg-purple-200 transition-colors">
                        📊
                      </div>
                      <h3 className="font-bold text-lg">View Match Analysis</h3>
                    </div>
                    <p className="text-sm text-gray-600">
                      {isFree 
                        ? 'See your ATS match score'
                        : 'See detailed keyword analysis and optimization opportunities'
                      }
                    </p>
                  </button>

                  {!isFree && (
                    <button
                      onClick={() => router.push(`/choose-template?versionId=${selectedVersion.id}`)}
                      className="bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg p-6 hover:from-purple-700 hover:to-purple-800 shadow-lg hover:shadow-xl transition-all text-left"
                    >
                      <div className="flex items-center gap-4 mb-3">
                        <div className="w-12 h-12 bg-white bg-opacity-20 rounded-lg flex items-center justify-center text-2xl">
                          📄
                        </div>
                        <h3 className="font-bold text-lg">Format & Download</h3>
                      </div>
                      <p className="text-sm text-purple-100">
                        Choose a template and download your customized resume
                      </p>
                    </button>
                  )}
                </div>
              ) : (
                /* Core Resume Actions - 3 Cards */
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  
                  {/* Edit Resume */}
                  <button
                    onClick={() => router.push(`/resume-editor/${resumeData.id}`)}
                    className="bg-white border-2 border-purple-200 rounded-lg p-6 hover:border-purple-400 hover:shadow-lg transition-all text-left group"
                  >
                    <div className="flex justify-center mb-4">
                      <div className="w-16 h-16 bg-purple-100 rounded-lg flex items-center justify-center text-3xl group-hover:bg-purple-200 transition-colors">
                        📝
                      </div>
                    </div>
                    <h3 className="font-bold text-lg mb-2 text-center">Edit Resume</h3>
                    <p className="text-sm text-gray-600 text-center">
                      Update your core resume content with new achievements or experience
                    </p>
                  </button>

                  {/* Format & Download */}
                  <button
                    onClick={() => router.push('/choose-template')}
                    className="bg-white border-2 border-purple-200 rounded-lg p-6 hover:border-purple-400 hover:shadow-lg transition-all text-left group"
                  >
                    <div className="flex justify-center mb-4">
                      <div className="w-16 h-16 bg-purple-100 rounded-lg flex items-center justify-center text-3xl group-hover:bg-purple-200 transition-colors">
                        📄
                      </div>
                    </div>
                    <h3 className="font-bold text-lg mb-2 text-center">Format & Download</h3>
                    <p className="text-sm text-gray-600 text-center">
                      Choose a professional template and download your resume
                    </p>
                  </button>

                  {/* Customize for Job */}
                  <button
                    onClick={() => router.push(`/customize-resume/${resumeData.id}`)}
                    className={`rounded-lg p-6 hover:shadow-lg transition-all text-left group ${
                      isFree 
                        ? 'bg-white border-2 border-purple-200 hover:border-purple-400'
                        : 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-md hover:from-purple-700 hover:to-purple-800'
                    }`}
                  >
                    <div className="flex justify-center mb-4">
                      <div className={`w-16 h-16 rounded-lg flex items-center justify-center text-3xl transition-colors ${
                        isFree 
                          ? 'bg-purple-100 group-hover:bg-purple-200'
                          : 'bg-white bg-opacity-20'
                      }`}>
                        🎯
                      </div>
                    </div>
                    <h3 className={`font-bold text-lg mb-2 text-center ${isFree ? '' : 'text-white'}`}>
                      Customize for Job
                    </h3>
                    <p className={`text-sm text-center ${isFree ? 'text-gray-600' : 'text-purple-100'}`}>
                      {isFree 
                        ? 'Upload a job description to check your ATS match score'
                        : 'Tailor your resume to a specific job posting with AI optimization'
                      }
                    </p>
                    {isFree && (
                      <div className="mt-3 text-center">
                        <span className="inline-block bg-purple-100 text-purple-700 text-xs px-3 py-1 rounded-full font-semibold">
                          Free Access
                        </span>
                      </div>
                    )}
                  </button>
                </div>
              )}

              {/* Resume Preview */}
              <div className="bg-white rounded-lg shadow-md p-8 border">
                <div className="mb-4 pb-4 border-b">
                  <p className="text-sm text-gray-500">
                    {isViewingVersion 
                      ? `${displayResume.contact?.fullName || 'Resume'} - ${selectedVersion.job_title}` 
                      : 'Core Resume Content Preview'
                    }
                  </p>
                </div>

              {/* Contact Info */}
                {(displayResume.contact || displayResume.fullName) && (
                  <div className="mb-6 text-center border-b pb-6">
                    <h2 className="text-2xl font-bold mb-2">
                      {displayResume.contact?.fullName || displayResume.fullName}
                    </h2>
                    <div className="text-sm text-gray-600">
                      {displayResume.contact?.email || displayResume.email}
                      {(displayResume.contact?.phone || displayResume.phone) && ` | ${displayResume.contact?.phone || displayResume.phone}`}
                      {(displayResume.contact?.location || displayResume.location) && ` | ${displayResume.contact?.location || displayResume.location}`}
                    </div>
                  </div>
                )}

                {/* Professional Summary */}
                {displayResume.summary && (
                  <div className="mb-6">
                    <h3 className="text-xl font-bold mb-3 text-purple-600">PROFESSIONAL SUMMARY</h3>
                    <p className="text-sm text-gray-700 leading-relaxed">{displayResume.summary}</p>
                  </div>
                )}

                {/* Experience */}
                {displayResume.experience && displayResume.experience.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-xl font-bold mb-4 text-purple-600">EXPERIENCE</h3>
                    {displayResume.experience.map((job, index) => (
                      <div key={index} className="mb-4">
                        <div className="mb-2">
                          <h4 className="font-bold">
                            {job.title} | {job.company} | {formatDate(job.startDate)} - {job.current ? 'Present' : formatDate(job.endDate)}
                          </h4>
                        </div>
                        {job.description && (
                          <p className="text-sm text-gray-700 mb-2 whitespace-pre-line">
                            {job.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Education */}
                {displayResume.education && displayResume.education.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-xl font-bold mb-4 text-purple-600">EDUCATION</h3>
                    {displayResume.education.map((edu, index) => (
                      <div key={index} className="mb-3">
                        <h4 className="font-bold">
                          {edu.degree} | {edu.school} | {formatDate(edu.graduationDate)}
                        </h4>
                        <div className="text-sm text-gray-600 mt-1">
                          {edu.gpa && <p>GPA: {edu.gpa}</p>}
                          {edu.activities && <p>{edu.activities}</p>}
                          {edu.honors && <p>{edu.honors}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Skills */}
                {displayResume.skills && displayResume.skills.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-xl font-bold mb-4 text-purple-600">SKILLS</h3>
                    <p className="text-sm text-gray-700">{displayResume.skills.join(' • ')}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Analysis First-Time Modal */}
    {showAnalysisModal && (
        <div className="fixed inset-0 bg-white bg-opacity-80 backdrop-blur-sm flex items-center justify-center z-50 p-4">         
        <div className="bg-white rounded-lg p-8 max-w-lg w-full shadow-2xl border-2 border-purple-300">
            <div className="text-center mb-6">
              <div className="text-5xl mb-4">🎉</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Your Resume is Ready!</h3>
              <p className="text-gray-600">
                Next, let our AI analyze your content to identify strengths and suggest improvements.
              </p>
            </div>
            
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-purple-900 font-medium mb-2">What you'll get:</p>
              <ul className="text-sm text-purple-800 space-y-1">
                <li>• Identify your strongest achievements</li>
                <li>• Spot areas for improvement</li>
                <li>• Get personalized suggestions</li>
              </ul>
              <p className="text-xs text-purple-700 mt-3">⏱️ Takes about 30 seconds</p>
            </div>

           <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setShowAnalysisModal(false)
                  router.push(`/resume-analysis/${resumeData.id}`)
                }}
                className="w-full bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 font-semibold transition-all shadow-md"
              >
                Run AI Analysis →
              </button>
              <button
                onClick={() => {
                  setShowAnalysisModal(false)
                  localStorage.setItem(`dismissed_analysis_modal_${resumeData.id}`, 'true')
                }}
                className="w-full bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 font-medium transition-all"
              >
                Skip for Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-white bg-opacity-80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-8 max-w-md w-full shadow-2xl border-2 border-purple-300">            <h3 className="text-2xl font-bold text-gray-900 mb-4">Delete Resume?</h3>
            <p className="text-gray-700 mb-6">
              This will permanently delete your resume and all associated data. This action cannot be undone.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteResume}
                disabled={deleting}
                className="flex-1 bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting && (
                  <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>
                )}
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}