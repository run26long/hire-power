'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import Header from '../../components/Header'
import BatteryScore from '../../components/BatteryScore'

function formatDate(dateStr) {
  if (!dateStr) return ''
  if (dateStr.toLowerCase() === 'present') return 'Present'
  
  const [year, month] = dateStr.split('-')
  const monthNum = parseInt(month, 10)
  const yearShort = year.slice(-2)
  return `${monthNum}/${yearShort}`
}

export default function ResumeReviewPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [resume, setResume] = useState(null)

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
        .eq('id', params.id)
        .eq('user_id', user.id)
        .single()

      if (error) throw error
      setResume(data)
      setLoading(false)
    } catch (error) {
      console.error('Error loading resume:', error)
      router.push('/my-resumes')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  const displayResume = resume.resume_data

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4">
          
          {/* Success Header */}
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">🎉</div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Coaching Complete!
            </h1>
            <p className="text-xl text-gray-600">
              Your resume has been transformed with quantifiable achievements
            </p>
          </div>

          {/* Score Comparison */}
          <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-bold text-center mb-6">Your Resume Power Score</h2>
            <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
              
              {/* Before Score */}
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-4 font-medium">Before Coaching</p>
                {resume.initial_resume_power_score ? (
                  <BatteryScore score={resume.initial_resume_power_score} size="large" />
                ) : (
                  <div className="text-gray-400">No initial score</div>
                )}
              </div>

              {/* After Score */}
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-4 font-medium">After Coaching</p>
                <BatteryScore score={resume.resume_power_score} size="large" />
              </div>
            </div>

            {/* Improvement Message */}
            {resume.initial_resume_power_score && resume.resume_power_score > resume.initial_resume_power_score && (
              <div className="mt-6 text-center">
                <div className="inline-block bg-green-50 border-2 border-green-200 rounded-lg px-6 py-3">
                  <p className="text-green-800 font-semibold">
                    🚀 Improved by {resume.resume_power_score - resume.initial_resume_power_score} points!
                  </p>
                  <p className="text-sm text-green-700 mt-1">
                    Candidates with metrics-driven resumes receive 3x more interview callbacks
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Resume Preview */}
          <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-bold mb-6">Your Improved Resume</h2>
            
            {/* Contact Info */}
            {(displayResume.contact || displayResume.fullName) && (
              <div className="mb-6 text-center border-b pb-6">
                <h3 className="text-2xl font-bold mb-2">
                  {displayResume.contact?.fullName || displayResume.fullName}
                </h3>
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
                <h4 className="text-lg font-bold mb-3 text-purple-600">PROFESSIONAL SUMMARY</h4>
                <p className="text-sm text-gray-700 leading-relaxed">{displayResume.summary}</p>
              </div>
            )}

           {/* Experience */}
            {displayResume.experience && displayResume.experience.length > 0 && (
              <div className="mb-6">
                <h4 className="text-lg font-bold mb-4 text-purple-600">EXPERIENCE</h4>
                {displayResume.experience.map((job, index) => (
                  <div key={index} className="mb-4">
                    <div className="mb-2">
                      <p className="font-bold">
                        {job.title} | {job.company} | {formatDate(job.startDate)} - {job.current ? 'Present' : formatDate(job.endDate)}
                      </p>
                    </div>
                    
                    {/* Handle structured format (summary + achievements) */}
                    {job.summary && (
                      <p className="text-sm text-gray-700 mb-2 italic">
                        {job.summary}
                      </p>
                    )}
                    {job.achievements && job.achievements.length > 0 && (
                      <ul className="text-sm text-gray-700 space-y-1 ml-4">
                        {job.achievements.map((achievement, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span>•</span>
                            <span>{achievement}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    
                    {/* Handle flat format (description with bullets) */}
                    {job.description && !job.achievements && (
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
                <h4 className="text-lg font-bold mb-4 text-purple-600">EDUCATION</h4>
                {displayResume.education.map((edu, index) => (
                  <div key={index} className="mb-3">
                    <p className="font-bold">
                      {edu.degree} | {edu.school} | {formatDate(edu.graduationDate)}
                    </p>
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
                <h4 className="text-lg font-bold mb-4 text-purple-600">SKILLS</h4>
                <p className="text-sm text-gray-700">{displayResume.skills.join(' • ')}</p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto mb-8">
            <button
              onClick={() => router.push('/choose-template')}
              className="bg-green-600 text-white py-4 px-6 rounded-lg hover:bg-green-700 transition-colors font-bold text-lg"
            >
              ✅ Save & Download Resume
            </button>
            <button
              onClick={() => router.push(`/resume-editor/${resume.id}?splitView=true`)}
              className="bg-purple-600 text-white py-4 px-6 rounded-lg hover:bg-purple-700 transition-colors font-bold text-lg"
            >
              ✏️ Edit First
            </button>
          </div>

          <div className="text-center">
            <button
              onClick={() => router.push('/my-resumes')}
              className="text-gray-600 hover:text-gray-800 underline text-sm"
            >
              Go to My Resumes
            </button>
          </div>
        </div>
      </div>
    </>
  )
}