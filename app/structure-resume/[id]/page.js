'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import Header from '../../components/Header'

export default function StructureResumePage() {
  const [resume, setResume] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()

  // Form state - matches builder structure
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    location: '',
    linkedin: '',
    portfolio: '',
    summary: '',
    experience: [],
    education: [],
    certifications: [],
    volunteer: [],
    projects: [],
    skills: [],
    languages: []
  })

  // Form visibility states
  const [showJobForm, setShowJobForm] = useState(false)
  const [showEdForm, setShowEdForm] = useState(false)
  const [showCertForm, setShowCertForm] = useState(false)
  const [showVolunteerForm, setShowVolunteerForm] = useState(false)
  const [showProjectForm, setShowProjectForm] = useState(false)

  // Temp form states
  const [currentJob, setCurrentJob] = useState({ title: '', company: '', startDate: '', endDate: '', current: false, description: '' })
  const [currentEd, setCurrentEd] = useState({ degree: '', school: '', graduationDate: '', major: '', minor: '', gpa: '', activities: '', honors: '' })
  const [currentCert, setCurrentCert] = useState({ name: '', organization: '', dateObtained: '', expirationDate: '', expires: false })
  const [currentVolunteer, setCurrentVolunteer] = useState({ organization: '', role: '', dates: '', description: '' })
  const [currentProject, setCurrentProject] = useState({ title: '', dates: '', description: '' })
  const [skillInput, setSkillInput] = useState('')
  const [languageInput, setLanguageInput] = useState('')

  // Load resume
  useEffect(() => {
    async function loadResume() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/dashboard')
        return
      }

      const { data, error } = await supabase
        .from('resumes')
        .select('*')
        .eq('id', params.id)
        .eq('user_id', user.id)
        .single()

      if (error || !data) {
        console.error('Error loading resume:', error)
        router.push('/my-resumes')
        return
      }

     setResume(data)
      
      // If uploaded resume (has parsed_text but no resume_data), extract structure
      if (data.parsed_text && !data.resume_data) {
        extractStructure(data.parsed_text)
      } else {
        setLoading(false)
      }
    }

    loadResume()
  }, [params.id, router, supabase])

  // Extract structure from parsed text using AI
  async function extractStructure(parsedText) {
    try {
      const response = await fetch('/api/extract-resume-structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parsedText })
      })

      const result = await response.json()

      if (result.data) {
        setFormData(result.data)
      }
    } catch (error) {
      console.error('Error extracting structure:', error)
      // Continue anyway - user can fill manually
    } finally {
      setLoading(false)
    }
  }

  // Add handlers
  const addJob = () => {
    if (!currentJob.title || !currentJob.company) return
    setFormData({...formData, experience: [...formData.experience, currentJob]})
    setCurrentJob({ title: '', company: '', startDate: '', endDate: '', current: false, description: '' })
    setShowJobForm(false)
  }

  const addEducation = () => {
    if (!currentEd.degree || !currentEd.school) return
    setFormData({...formData, education: [...formData.education, currentEd]})
    setCurrentEd({ degree: '', school: '', graduationDate: '', major: '', minor: '', gpa: '', activities: '', honors: '' })
    setShowEdForm(false)
  }

  const addCertification = () => {
    if (!currentCert.name || !currentCert.organization) return
    setFormData({...formData, certifications: [...formData.certifications, currentCert]})
    setCurrentCert({ name: '', organization: '', dateObtained: '', expirationDate: '', expires: false })
    setShowCertForm(false)
  }

  const addVolunteer = () => {
    if (!currentVolunteer.organization || !currentVolunteer.role) return
    setFormData({...formData, volunteer: [...formData.volunteer, currentVolunteer]})
    setCurrentVolunteer({ organization: '', role: '', dates: '', description: '' })
    setShowVolunteerForm(false)
  }

  const addProject = () => {
    if (!currentProject.title) return
    setFormData({...formData, projects: [...formData.projects, currentProject]})
    setCurrentProject({ title: '', dates: '', description: '' })
    setShowProjectForm(false)
  }

  const addSkill = () => {
    if (!skillInput.trim()) return
    setFormData({...formData, skills: [...formData.skills, skillInput.trim()]})
    setSkillInput('')
  }

  const addLanguage = () => {
    if (!languageInput.trim()) return
    setFormData({...formData, languages: [...formData.languages, languageInput.trim()]})
    setLanguageInput('')
  }

  const handleSave = async () => {
    setSaving(true)

    try {
      const { error } = await supabase
        .from('resumes')
        .update({ resume_data: formData })
        .eq('id', params.id)

     if (error) throw error

    // Route directly to analysis
    router.push(`/resume-analysis/${params.id}`)
  } catch (error) {
      console.error('Error saving:', error)
      alert('Error saving resume structure')
      setSaving(false)
    }
  }

 if (loading) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
          {/* Animated spinner */}
          <div className="relative mb-6">
            <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
          </div>
          
          {/* Loading message */}
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Structuring Your Resume
          </h2>
          <p className="text-gray-600 text-center max-w-md">
            Our AI is extracting your experience, education, and skills to help you structure your resume...
          </p>
        </div>
      </>
    )
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50 pb-8">
        {/* STICKY HEADER - Stays at top */}
        <div className="sticky top-0 z-10 bg-white shadow p-6 mx-8 mb-4 rounded-lg mt-0 pt-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            📝 Structure Your Resume
          </h1>
          <p className="text-gray-600">
            Copy information from your uploaded resume (left) into the structured fields (right).
          </p>
        </div>

        <div className="px-8">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-2 gap-6">
              
              {/* LEFT: Original Text - STICKY BOX, TEXT SCROLLS INSIDE */}
              <div className="bg-white rounded-lg shadow p-6 sticky top-32 self-start">
                <h2 className="text-lg font-bold text-gray-900 mb-4">
                  📄 Your Original Resume
                </h2>
                <div className="bg-gray-50 p-4 rounded border border-gray-200 max-h-[calc(100vh-250px)] overflow-y-auto">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">
                    {resume.parsed_text}
                  </pre>
                </div>
              </div>

              {/* RIGHT: Structured Fields - SCROLLS NATURALLY */}
              <div className="space-y-6">
                {/* Contact Info */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">Contact Information</h2>
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Full Name *"
                      value={formData.fullName}
                      onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded"
                    />
                    <input
                      type="email"
                      placeholder="Email *"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded"
                    />
                    <input
                      type="tel"
                      placeholder="Phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded"
                    />
                    <input
                      type="text"
                      placeholder="Location (City, State)"
                      value={formData.location}
                      onChange={(e) => setFormData({...formData, location: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded"
                    />
                    <input
                      type="url"
                      placeholder="LinkedIn URL (optional)"
                      value={formData.linkedin}
                      onChange={(e) => setFormData({...formData, linkedin: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded"
                    />
                    <input
                      type="url"
                      placeholder="Portfolio/Website (optional)"
                      value={formData.portfolio}
                      onChange={(e) => setFormData({...formData, portfolio: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded"
                    />
                  </div>
                </div>

                {/* Summary */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">Professional Summary</h2>
                  <textarea
                    placeholder="Brief professional summary (optional)"
                    value={formData.summary}
                    onChange={(e) => setFormData({...formData, summary: e.target.value})}
                    rows={4}
                    className="w-full p-2 border border-gray-300 rounded"
                  />
                </div>

                {/* Work Experience */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">Work Experience</h2>
                  
                  {/* Saved jobs */}
                  {formData.experience.map((job, idx) => (
                    <div key={idx} className="bg-green-50 border border-green-200 rounded p-3 mb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-green-900">{job.title} at {job.company}</p>
                          <p className="text-sm text-green-700">{job.startDate} - {job.current ? 'Present' : job.endDate}</p>
                        </div>
                        <button
                          onClick={() => setFormData({...formData, experience: formData.experience.filter((_, i) => i !== idx)})}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Add form */}
                  {showJobForm ? (
                    <div className="border border-gray-300 rounded p-4 mb-3">
                      <input
                        type="text"
                        placeholder="Job Title *"
                        value={currentJob.title}
                        onChange={(e) => setCurrentJob({...currentJob, title: e.target.value})}
                        className="w-full p-2 border border-gray-300 rounded mb-2"
                      />
                      <input
                        type="text"
                        placeholder="Company Name *"
                        value={currentJob.company}
                        onChange={(e) => setCurrentJob({...currentJob, company: e.target.value})}
                        className="w-full p-2 border border-gray-300 rounded mb-2"
                      />
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <input
                          type="text"
                          placeholder="Start Date (MM/YYYY)"
                          value={currentJob.startDate}
                          onChange={(e) => setCurrentJob({...currentJob, startDate: e.target.value})}
                          className="p-2 border border-gray-300 rounded"
                        />
                        <input
                          type="text"
                          placeholder="End Date (MM/YYYY)"
                          value={currentJob.endDate}
                          onChange={(e) => setCurrentJob({...currentJob, endDate: e.target.value})}
                          disabled={currentJob.current}
                          className="p-2 border border-gray-300 rounded disabled:bg-gray-100"
                        />
                      </div>
                      <label className="flex items-center mb-2">
                        <input
                          type="checkbox"
                          checked={currentJob.current}
                          onChange={(e) => setCurrentJob({...currentJob, current: e.target.checked, endDate: e.target.checked ? '' : currentJob.endDate})}
                          className="mr-2"
                        />
                        <span className="text-sm">I currently work here</span>
                      </label>
                      <textarea
                        placeholder="Responsibilities and achievements"
                        value={currentJob.description}
                        onChange={(e) => setCurrentJob({...currentJob, description: e.target.value})}
                        rows={3}
                        className="w-full p-2 border border-gray-300 rounded mb-2"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={addJob}
                          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                        >
                          Add Job
                        </button>
                        <button
                          onClick={() => setShowJobForm(false)}
                          className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowJobForm(true)}
                      className="text-purple-600 hover:text-purple-700 font-medium"
                    >
                      + Add Work Experience
                    </button>
                  )}
                </div>

                {/* Education */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">Education</h2>
                  
                  {formData.education.map((ed, idx) => (
                    <div key={idx} className="bg-green-50 border border-green-200 rounded p-3 mb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-green-900">{ed.degree} - {ed.school}</p>
                          <p className="text-sm text-green-700">{ed.graduationDate}</p>
                        </div>
                        <button
                          onClick={() => setFormData({...formData, education: formData.education.filter((_, i) => i !== idx)})}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}

                  {showEdForm ? (
                    <div className="border border-gray-300 rounded p-4 mb-3">
                      <input
                        type="text"
                        placeholder="Degree *"
                        value={currentEd.degree}
                        onChange={(e) => setCurrentEd({...currentEd, degree: e.target.value})}
                        className="w-full p-2 border border-gray-300 rounded mb-2"
                      />
                      <input
                        type="text"
                        placeholder="School Name *"
                        value={currentEd.school}
                        onChange={(e) => setCurrentEd({...currentEd, school: e.target.value})}
                        className="w-full p-2 border border-gray-300 rounded mb-2"
                      />
                      <input
                        type="text"
                        placeholder="Graduation Date (MM/YYYY)"
                        value={currentEd.graduationDate}
                        onChange={(e) => setCurrentEd({...currentEd, graduationDate: e.target.value})}
                        className="w-full p-2 border border-gray-300 rounded mb-2"
                      />
                      <input
                        type="text"
                        placeholder="Major (optional)"
                        value={currentEd.major}
                        onChange={(e) => setCurrentEd({...currentEd, major: e.target.value})}
                        className="w-full p-2 border border-gray-300 rounded mb-2"
                      />
                      <input
                        type="text"
                        placeholder="GPA (optional, only if 3.5+)"
                        value={currentEd.gpa}
                        onChange={(e) => setCurrentEd({...currentEd, gpa: e.target.value})}
                        className="w-full p-2 border border-gray-300 rounded mb-2"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={addEducation}
                          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                        >
                          Add Education
                        </button>
                        <button
                          onClick={() => setShowEdForm(false)}
                          className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowEdForm(true)}
                      className="text-purple-600 hover:text-purple-700 font-medium"
                    >
                      + Add Education
                    </button>
                  )}
                </div>

                {/* Skills */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">Skills</h2>
                  
                  <div className="flex flex-wrap gap-2 mb-3">
                    {formData.skills.map((skill, idx) => (
                      <span key={idx} className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                        {skill}
                        <button
                          onClick={() => setFormData({...formData, skills: formData.skills.filter((_, i) => i !== idx)})}
                          className="text-purple-600 hover:text-purple-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add a skill"
                      value={skillInput}
                      onChange={(e) => setSkillInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addSkill()}
                      className="flex-1 p-2 border border-gray-300 rounded"
                    />
                    <button
                      onClick={addSkill}
                      className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Certifications */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">Certifications & Licenses</h2>
                  
                  {formData.certifications.map((cert, idx) => (
                    <div key={idx} className="bg-green-50 border border-green-200 rounded p-3 mb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-green-900">{cert.name}</p>
                          <p className="text-sm text-green-700">{cert.organization}</p>
                        </div>
                        <button
                          onClick={() => setFormData({...formData, certifications: formData.certifications.filter((_, i) => i !== idx)})}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}

                  {showCertForm ? (
                    <div className="border border-gray-300 rounded p-4 mb-3">
                      <input
                        type="text"
                        placeholder="Certification/License Name *"
                        value={currentCert.name}
                        onChange={(e) => setCurrentCert({...currentCert, name: e.target.value})}
                        className="w-full p-2 border border-gray-300 rounded mb-2"
                      />
                      <input
                        type="text"
                        placeholder="Issuing Organization *"
                        value={currentCert.organization}
                        onChange={(e) => setCurrentCert({...currentCert, organization: e.target.value})}
                        className="w-full p-2 border border-gray-300 rounded mb-2"
                      />
                      <input
                        type="text"
                        placeholder="Date Obtained (MM/YYYY)"
                        value={currentCert.dateObtained}
                        onChange={(e) => setCurrentCert({...currentCert, dateObtained: e.target.value})}
                        className="w-full p-2 border border-gray-300 rounded mb-2"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={addCertification}
                          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                        >
                          Add Certification
                        </button>
                        <button
                          onClick={() => setShowCertForm(false)}
                          className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowCertForm(true)}
                      className="text-purple-600 hover:text-purple-700 font-medium"
                    >
                      + Add Certification
                    </button>
                  )}
                </div>

                {/* Volunteer Work */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">Volunteer Work</h2>
                  
                  {formData.volunteer.map((vol, idx) => (
                    <div key={idx} className="bg-green-50 border border-green-200 rounded p-3 mb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-green-900">{vol.role} at {vol.organization}</p>
                          <p className="text-sm text-green-700">{vol.dates}</p>
                        </div>
                        <button
                          onClick={() => setFormData({...formData, volunteer: formData.volunteer.filter((_, i) => i !== idx)})}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}

                  {showVolunteerForm ? (
                    <div className="border border-gray-300 rounded p-4 mb-3">
                      <input
                        type="text"
                        placeholder="Organization *"
                        value={currentVolunteer.organization}
                        onChange={(e) => setCurrentVolunteer({...currentVolunteer, organization: e.target.value})}
                        className="w-full p-2 border border-gray-300 rounded mb-2"
                      />
                      <input
                        type="text"
                        placeholder="Role *"
                        value={currentVolunteer.role}
                        onChange={(e) => setCurrentVolunteer({...currentVolunteer, role: e.target.value})}
                        className="w-full p-2 border border-gray-300 rounded mb-2"
                      />
                      <input
                        type="text"
                        placeholder="Dates"
                        value={currentVolunteer.dates}
                        onChange={(e) => setCurrentVolunteer({...currentVolunteer, dates: e.target.value})}
                        className="w-full p-2 border border-gray-300 rounded mb-2"
                      />
                      <textarea
                        placeholder="Description"
                        value={currentVolunteer.description}
                        onChange={(e) => setCurrentVolunteer({...currentVolunteer, description: e.target.value})}
                        rows={3}
                        className="w-full p-2 border border-gray-300 rounded mb-2"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={addVolunteer}
                          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                        >
                          Add Volunteer Work
                        </button>
                        <button
                          onClick={() => setShowVolunteerForm(false)}
                          className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowVolunteerForm(true)}
                      className="text-purple-600 hover:text-purple-700 font-medium"
                    >
                      + Add Volunteer Work
                    </button>
                  )}
                </div>

                {/* Projects */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">Projects</h2>
                  
                  {formData.projects.map((proj, idx) => (
                    <div key={idx} className="bg-green-50 border border-green-200 rounded p-3 mb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-green-900">{proj.title}</p>
                          <p className="text-sm text-green-700">{proj.dates}</p>
                        </div>
                        <button
                          onClick={() => setFormData({...formData, projects: formData.projects.filter((_, i) => i !== idx)})}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}

                  {showProjectForm ? (
                    <div className="border border-gray-300 rounded p-4 mb-3">
                      <input
                        type="text"
                        placeholder="Project Title *"
                        value={currentProject.title}
                        onChange={(e) => setCurrentProject({...currentProject, title: e.target.value})}
                        className="w-full p-2 border border-gray-300 rounded mb-2"
                      />
                      <input
                        type="text"
                        placeholder="Dates"
                        value={currentProject.dates}
                        onChange={(e) => setCurrentProject({...currentProject, dates: e.target.value})}
                        className="w-full p-2 border border-gray-300 rounded mb-2"
                      />
                      <textarea
                        placeholder="Description"
                        value={currentProject.description}
                        onChange={(e) => setCurrentProject({...currentProject, description: e.target.value})}
                        rows={3}
                        className="w-full p-2 border border-gray-300 rounded mb-2"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={addProject}
                          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                        >
                          Add Project
                        </button>
                        <button
                          onClick={() => setShowProjectForm(false)}
                          className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowProjectForm(true)}
                      className="text-purple-600 hover:text-purple-700 font-medium"
                    >
                      + Add Project
                    </button>
                  )}
                </div>

                {/* Languages */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">Languages</h2>
                  
                  <div className="flex flex-wrap gap-2 mb-3">
                    {formData.languages.map((lang, idx) => (
                      <span key={idx} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                        {lang}
                        <button
                          onClick={() => setFormData({...formData, languages: formData.languages.filter((_, i) => i !== idx)})}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add a language (e.g., Spanish - Fluent)"
                      value={languageInput}
                      onChange={(e) => setLanguageInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addLanguage()}
                      className="flex-1 p-2 border border-gray-300 rounded"
                    />
                    <button
                      onClick={addLanguage}
                      className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Save Button */}
                <div className="bg-white rounded-lg shadow p-6">
                  <button
                    onClick={handleSave}
                    disabled={saving || !formData.fullName || !formData.email}
                    className="w-full bg-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Saving...' : 'Save & Continue to AI Analysis →'}
                  </button>
                  
                  {(!formData.fullName || !formData.email) && (
                    <p className="text-sm text-gray-500 mt-2 text-center">
                      Fill in at least your name and email to continue
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}