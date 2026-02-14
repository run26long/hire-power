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
      console.error('Error loading resume:', error)
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  if (!resumeData || (!resumeData.resume_data && !resumeData.parsed_text)) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-4xl mx-auto p-8">
          <h1 className="text-3xl font-bold mb-4">My Resumes</h1>
          <p className="text-gray-600">Complete coaching first to see your improved resume here.</p>
          <button
            onClick={() => router.push('/resume-coaching')}
            className="mt-4 bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700"
          >
            Start Coaching
          </button>
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
                  {!resumeData.ai_analysis ? (
                    /* NEW RESUME - NEEDS ANALYSIS */
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
                      <h3 className="font-bold text-lg mb-4">Core Resume Actions</h3>
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
    </div>
  )
}