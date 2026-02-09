'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

// Helper to format dates from YYYY-MM to M/YY (no leading zeros)
function formatDate(dateStr) {
  if (!dateStr) return ''
  if (dateStr.toLowerCase() === 'present') return 'Present'
  
  const [year, month] = dateStr.split('-')
  const monthNum = parseInt(month, 10) // Removes leading zero
  const yearShort = year.slice(-2) // Gets last 2 digits of year
  return `${monthNum}/${yearShort}`
}

export default function MyResumes() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [resumeData, setResumeData] = useState(null)
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
      setLoading(false)
    } catch (error) {
      console.error('Error loading resume:', error)
      setLoading(false)
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
    )
  }

  const resume = resumeData.resume_data

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-xl font-bold text-purple-600">Hire Power</h1>
            <button
              onClick={() => router.push('/dashboard')}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto p-8">
        <div className="mb-6">
  <h1 className="text-3xl font-bold mb-2">My Resume</h1>
  <p className="text-gray-600">Your improved resume with quantifiable achievements</p>
</div>

{/* Info Banner */}
<div className="bg-gradient-to-r from-purple-50 to-purple-100 border-l-4 border-purple-600 rounded-lg p-5 mb-6 shadow-sm">
  <div className="flex items-center gap-3">
    <div className="flex-shrink-0 w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
      <span className="text-white text-xl">✓</span>
    </div>
    <div className="flex-1">
      <h3 className="font-semibold text-purple-900 text-sm mb-0.5">Content Extracted</h3>
      <p className="text-xs text-purple-700 leading-relaxed">
        Your achievements are ready. Choose a template below to format your professional resume.
      </p>
    </div>
  </div>
</div>

{/* Action Buttons */}
<div className="flex gap-4 mb-6">
         <button
  onClick={() => router.push('/choose-template')}
  className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 font-medium"
>
  Choose Template & Download
</button>
          <button
            onClick={() => router.push('/resume-coaching')}
            className="border-2 border-purple-600 text-purple-600 px-6 py-2 rounded-lg hover:bg-purple-50 font-medium"
          >
            Edit Resume
          </button>
        </div>

        {/* Resume Preview */}
        <div className="bg-white rounded-lg shadow-lg p-8 border">
         {/* Contact Info */}
{resume.contact && (
  <div className="mb-6 text-center border-b pb-6">
    <h2 className="text-2xl font-bold mb-2">{resume.contact.fullName}</h2>
    <div className="text-sm text-gray-600">
      {resume.contact.email} | {resume.contact.phone}
    </div>
  </div>
)}

{/* Professional Summary */}
{resume.summary && (
  <div className="mb-6">
    <h3 className="text-xl font-bold mb-3 text-purple-600">PROFESSIONAL SUMMARY</h3>
    <p className="text-sm text-gray-700 leading-relaxed">{resume.summary}</p>
  </div>
)}

{/* Experience */}

          {/* Experience */}
          {resume.experience && resume.experience.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xl font-bold mb-4 text-purple-600">EXPERIENCE</h3>
              {resume.experience.map((job, index) => (
  <div key={index} className="mb-4">
    <div className="mb-2">
      <h4 className="font-bold">
  {job.title} | {job.company} | {formatDate(job.startDate)} - {formatDate(job.endDate)}
</h4>
      {job.summary && (
        <p className="text-sm text-gray-600 italic mt-1">{job.summary}</p>
      )}
    </div>
                  {job.achievements && job.achievements.length > 0 && (
                    <ul className="list-disc ml-5 space-y-1">
                      {job.achievements.map((achievement, i) => (
                        <li key={i} className="text-sm text-gray-700">{achievement}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}

         {/* Education */}
{resume.education && resume.education.length > 0 && (
  <div className="mb-6">
    <h3 className="text-xl font-bold mb-4 text-purple-600">EDUCATION</h3>
    {resume.education.map((edu, index) => (
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
          {resume.skills && resume.skills.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xl font-bold mb-4 text-purple-600">SKILLS</h3>
              <p className="text-sm text-gray-700">{resume.skills.join(' • ')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}