'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import Header from '../components/Header'

function formatDate(dateStr) {
  if (!dateStr) return ''
  if (dateStr.toLowerCase() === 'present') return 'Present'
  
  const [year, month] = dateStr.split('-')
  if (!year || !month) return dateStr
  
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
  const supabase = createClient()

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

      const { data, error } = await supabase
        .from('resumes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error) throw error

      setResumeData(data)

      const { data: versionsData, error: versionsError } = await supabase
        .from('resume_versions')
        .select('*')
        .eq('resume_id', data.id)
        .order('created_at', { ascending: false })

      if (versionsError) throw versionsError

      setVersions(versionsData || [])
      setLoading(false)
   } catch (error) {
      // No resume found - this is expected, don't log as error
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

      loadResume()
    } catch (error) {
      console.error('Error deleting version:', error)
      alert('Failed to delete. Please try again.')
  }
  }

  const handleDeleteResume = async () => {
    setDeleting(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      // Delete from database
      const { error } = await supabase
        .from('resumes')
        .delete()
        .eq('id', resumeData.id)
        .eq('user_id', user.id)

      if (error) throw error

      // Delete file from storage if exists
      if (resumeData.file_path) {
        await supabase.storage
          .from('resumes')
          .remove([resumeData.file_path])
      }

      // Refresh page to show "no resume" state
      setShowDeleteModal(false)
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

 if (!resumeData || (!resumeData.resume_data && !resumeData.parsed_text)) {
    // No resume exists - redirect to dashboard
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-4xl mx-auto p-8 flex items-center justify-center">
          <div className="text-center">
  <h2 className="text-2xl font-bold text-gray-900 mb-2">Ready to build your resume?</h2>
  <p className="text-gray-600 mb-4">Head to your dashboard to get started.</p>
  <button 
    onClick={() => router.push('/dashboard')} 
    className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 font-medium"
  >
    Go to Dashboard →
  </button>
</div>
        </div>
      </div>
    )
  }

  const displayResume = selectedVersion ? selectedVersion.customized_resume_data : resumeData.resume_data
  const isViewingVersion = !!selectedVersion
  const isUploadedResume = resumeData.created_via === 'upload'

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-5xl mx-auto p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">My Resumes</h1>
          <p className="text-gray-600">Your core resume content is ready to be put to work!</p>
        </div>

        {!isViewingVersion && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8 border-l-4 border-purple-600">
            <h3 className="font-bold text-lg mb-4">What would you like to do?</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold">1</div>
                <div>
                  <p className="font-semibold text-gray-900">Choose Template & Download</p>
                  <p className="text-gray-600">Format your core resume and download a print-ready PDF</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold">2</div>
                <div>
                  <p className="font-semibold text-gray-900">Customize for Job</p>
                  <p className="text-gray-600">Tailor your resume to a specific job posting with AI optimization</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold">3</div>
                <div>
                  <p className="font-semibold text-gray-900">Edit Resume</p>
                  <p className="text-gray-600">Update your core resume content with new achievements or experience</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 sticky top-8">
              <h3 className="font-bold text-lg mb-4">Resume Versions</h3>
              
              <button
                onClick={() => setSelectedVersion(null)}
                className={`w-full text-left p-4 rounded-lg border-2 mb-3 transition-all ${
                  !selectedVersion 
                    ? 'border-purple-600 bg-purple-50' 
                    : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <p className="font-semibold text-purple-600">Core Resume</p>
                    <p className="text-xs text-gray-500 mt-1">Your improved base content</p>
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

              {versions.length > 0 && (
                <>
                  <div className="border-t pt-4 mt-4 mb-3">
                    <p className="text-sm font-semibold text-gray-600 mb-3">Job-Specific Versions</p>
                  </div>
                  <div className="space-y-3">
                    {versions.map((version) => (
                      <button
                        key={version.id}
                        onClick={() => setSelectedVersion(version)}
                        className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                          selectedVersion?.id === version.id 
                            ? 'border-purple-600 bg-purple-50' 
                            : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <p className="font-semibold text-sm">{version.job_company}</p>
                            <p className="text-xs text-gray-600 mt-1">{version.job_title}</p>
                          </div>
                          {selectedVersion?.id === version.id && (
                            <span className="text-purple-600 font-bold text-lg ml-2">✓</span>
                          )}
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
                        {Object.keys(version.formatted_versions || {}).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {Object.keys(version.formatted_versions).map(templateName => (
                              <span key={templateName} className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                                {templateName}
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="lg:col-span-2">
            
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">

              {isViewingVersion ? (
                <>
                  <h3 className="font-bold text-lg mb-4">
                    {selectedVersion.job_company} - {selectedVersion.job_title}
                  </h3>
                  <div className="flex gap-3 mb-4">
                    <button
                      onClick={() => router.push(`/job-analysis/${selectedVersion.id}`)}
                      className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm font-medium shadow-sm transition-all"
                    >
                      View Match Analysis
                    </button>
                    <button
                      onClick={() => router.push(`/choose-template?versionId=${selectedVersion.id}`)}
                      className="flex-1 bg-gradient-to-r from-purple-600 to-purple-700 text-white px-4 py-2 rounded-lg hover:from-purple-700 hover:to-purple-800 text-sm font-medium shadow-sm transition-all"
                    >
                      Format & Download
                    </button>
                  </div>
                </>
) : (
                <>
                 {!resumeData.resume_data ? (
                    /* UPLOADED BUT NOT STRUCTURED */
                    <>
                      <h3 className="font-bold text-lg mb-4">Next Step: Structure Your Resume</h3>
                      <p className="text-gray-600 mb-4 text-sm">
                        Fill in the structured fields so we can format and analyze your resume.
                      </p>
                      <button
                        onClick={() => router.push(`/structure-resume/${resumeData.id}`)}
                        className="w-full bg-gradient-to-r from-purple-600 to-purple-700 text-white px-6 py-3 rounded-lg hover:from-purple-700 hover:to-purple-800 font-semibold shadow-lg transition-all"
                      >
                        Structure Your Resume →
                      </button>
                    </>
                  ) : !resumeData.ai_analysis ? (
                    /* STRUCTURED BUT NOT ANALYZED */
                    <>
                      <h3 className="font-bold text-lg mb-4">Next Step: AI Analysis</h3>
                      <p className="text-gray-600 mb-4 text-sm">
                        Your resume has been created! Now let's analyze it to identify strengths and areas for improvement.
                      </p>
                      <button
                        onClick={() => router.push(`/resume-analysis/${resumeData.id}`)}
                        className="w-full bg-gradient-to-r from-purple-600 to-purple-700 text-white px-6 py-3 rounded-lg hover:from-purple-700 hover:to-purple-800 font-semibold shadow-lg transition-all"
                      >
                        Continue to AI Analysis →
                      </button>
                    </>
                  ) : (
                    /* ANALYZED RESUME - SHOW ALL OPTIONS */
                    <>
<div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-lg">Core Resume Actions</h3>
                        <button
                          onClick={() => setShowDeleteModal(true)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1.5 rounded transition-all"
                          title="Delete Resume"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    <div className="flex gap-3 mb-4">
                        <button
                          onClick={() => router.push(`/resume-analysis/${resumeData.id}`)}
                          className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm font-medium shadow-sm transition-all"
                        >
                          View Analysis
                        </button>
                        <button
                          onClick={() => router.push(`/resume-editor/${resumeData.id}`)}
                          className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm font-medium shadow-sm transition-all"
                        >
                          Edit Resume
                        </button>
                        <button
                          onClick={() => router.push('/choose-template')}
                          className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm font-medium shadow-sm transition-all"
                       >
                          Format & Download
                        </button>
                      </div>

                    </>
                  )}
                </>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-md p-8 border">
              <div className="mb-4 pb-4 border-b">
                <p className="text-sm text-gray-500">
                  {isViewingVersion 
                    ? `${displayResume?.fullName || 'Resume'} - ${selectedVersion.job_title}` 
                    : 'Core Resume Content Preview'
                  }
                </p>
              </div>

              {/* UPLOADED RESUME - Show plain text */}
              {isUploadedResume && !isViewingVersion && (
                <div className="prose max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 leading-relaxed">
                    {resumeData.parsed_text}
                  </pre>
                </div>
              )}

              {/* BUILDER RESUME - Show structured data */}
              {!isUploadedResume && displayResume && (
                <>
              {/* Personal Info - Builder format */}
              {displayResume.fullName && (
                <div className="mb-6 text-center border-b pb-6">
                  <h2 className="text-2xl font-bold mb-2">{displayResume.fullName}</h2>
                  <div className="text-sm text-gray-600">
                    {displayResume.email} {displayResume.phone && `| ${displayResume.phone}`}
                  </div>
                  {displayResume.location && (
                    <div className="text-sm text-gray-600">{displayResume.location}</div>
                  )}
                  {displayResume.linkedin && (
                    <div className="text-sm text-gray-600">{displayResume.linkedin}</div>
                  )}
                </div>
              )}

              {/* Work Experience - Builder format */}
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
                        <div className="text-sm text-gray-700 whitespace-pre-line">
                          {job.description}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Education - Builder format */}
              {displayResume.education && displayResume.education.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-xl font-bold mb-4 text-purple-600">EDUCATION</h3>
                  {displayResume.education.map((edu, index) => (
                    <div key={index} className="mb-3">
                      <h4 className="font-bold">
                        {edu.degree}{edu.major && ` in ${edu.major}`} | {edu.school} | {formatDate(edu.graduationDate)}
                      </h4>
                      <div className="text-sm text-gray-600 mt-1">
                        {edu.minor && <p>Minor: {edu.minor}</p>}
                        {edu.gpa && <p>GPA: {edu.gpa}</p>}
                        {edu.activities && <p>Activities: {edu.activities}</p>}
                        {edu.honors && <p>Honors: {edu.honors}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Skills - Builder format (array of strings) */}
              {displayResume.skills && displayResume.skills.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-xl font-bold mb-4 text-purple-600">SKILLS</h3>
                  <p className="text-sm text-gray-700">{displayResume.skills.join(' • ')}</p>
                </div>
              )}

              {/* Certifications - Builder format */}
              {displayResume.certifications && displayResume.certifications.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-xl font-bold mb-4 text-purple-600">CERTIFICATIONS & LICENSES</h3>
                  {displayResume.certifications.map((cert, index) => (
                    <div key={index} className="mb-2 text-sm text-gray-700">
                      <strong>{cert.name}</strong> - {cert.issuer}, {formatDate(cert.date)}
                      {cert.expires && cert.expirationDate && ` • Expires: ${formatDate(cert.expirationDate)}`}
                    </div>
                  ))}
                </div>
              )}

              {/* Volunteer - Builder format */}
              {displayResume.volunteer && displayResume.volunteer.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-xl font-bold mb-4 text-purple-600">VOLUNTEER & LEADERSHIP</h3>
                  {displayResume.volunteer.map((vol, index) => (
                    <div key={index} className="mb-3">
                      <h4 className="font-bold">{vol.role} - {vol.organization}</h4>
                      <p className="text-sm text-gray-700 mt-1">{vol.description}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Projects - Builder format */}
              {displayResume.projects && displayResume.projects.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-xl font-bold mb-4 text-purple-600">PROJECTS</h3>
                  {displayResume.projects.map((proj, index) => (
                    <div key={index} className="mb-3">
                      <h4 className="font-bold">{proj.name}</h4>
                      <p className="text-sm text-gray-700 mt-1">{proj.description}</p>
                      {proj.technologies && (
                        <p className="text-xs text-gray-600 mt-1">Technologies: {proj.technologies}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

             {/* Languages - Builder format */}
              {displayResume.languages && displayResume.languages.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-xl font-bold mb-4 text-purple-600">LANGUAGES</h3>
                  <p className="text-sm text-gray-700">
                    {displayResume.languages.map((lang, index) => (
                      <span key={index}>
                        {lang.language} ({lang.proficiency})
                        {index < displayResume.languages.length - 1 && ' • '}
                      </span>
                    ))}
                  </p>
                </div>
              )}
                </>
              )}
            </div>
          </div>
       </div>
      </div>

     {/* DELETE CONFIRMATION MODAL */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-white bg-opacity-80 flex items-center justify-center z-50 p-4">
          <div className="bg-purple-100 rounded-lg p-6 max-w-md w-full border-2 border-purple-300">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Delete Resume?</h3>
            <p className="text-gray-700 mb-6">
              This will permanently delete your resume and all associated data. You'll be able to create a new resume after deleting.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteResume}
                disabled={deleting}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 font-medium disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete Resume'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}