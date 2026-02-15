'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import Header from '../components/Header'

export default function ResumeBuilder() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [checkingLimit, setCheckingLimit] = useState(true)
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    location: '',
    linkedin: '',
    summary: '',
    experience: [],
    education: [],
    certifications: [],
    volunteer: [],
    projects: [],
    skills: [],
    languages: []
  })

  // Current item being added
  const [currentJob, setCurrentJob] = useState({
    title: '',
    company: '',
    startDate: '',
    endDate: '',
    current: false,
    description: ''
  })
  
  const [currentEd, setCurrentEd] = useState({
    degree: '',
    major: '',
    minor: '',
    school: '',
    graduationDate: '',
    gpa: '',
    activities: '',
    honors: ''
  })

  const [currentCert, setCurrentCert] = useState({
    name: '',
    issuer: '',
    date: '',
    expires: false,
    expirationDate: ''
  })

  const [currentVolunteer, setCurrentVolunteer] = useState({
    role: '',
    organization: '',
    description: ''
  })

  const [currentProject, setCurrentProject] = useState({
    name: '',
    description: '',
    technologies: ''
  })

  const [currentSkill, setCurrentSkill] = useState('')
  const [currentLanguage, setCurrentLanguage] = useState({
    language: '',
    proficiency: 'conversational'
  })

  // Form visibility toggles
  const [showJobForm, setShowJobForm] = useState(true)
  const [showEdForm, setShowEdForm] = useState(true)
  const [showCertForm, setShowCertForm] = useState(true)
  const [showVolunteerForm, setShowVolunteerForm] = useState(true)
  const [showProjectForm, setShowProjectForm] = useState(true)

  // Load saved data on mount
  useEffect(() => {
    const saved = localStorage.getItem('resumeBuilderProgress')
    if (saved) {
      try {
        const { formData: savedFormData, step: savedStep } = JSON.parse(saved)
        setFormData(savedFormData)
        setStep(savedStep)
        // Set form visibility based on whether items exist
        setShowJobForm(savedFormData.experience.length === 0)
        setShowEdForm(savedFormData.education.length === 0)
        setShowCertForm(savedFormData.certifications.length === 0)
        setShowVolunteerForm(savedFormData.volunteer.length === 0)
        setShowProjectForm(savedFormData.projects.length === 0)
      } catch (error) {
        console.error('Error loading saved data:', error)
      }
    }
    setHasLoaded(true)
  }, [])

  // Free tier enforcement - check resume count
  useEffect(() => {
    async function checkResumeLimit() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', user.id)
        .single()

      const tier = profile?.subscription_tier || 'free'

      // Only check for free users
      if (tier === 'free') {
        const { count } = await supabase
          .from('resumes')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)

        if (count >= 1) {
          router.push('/resume-start')
          return
        }
      }

      setCheckingLimit(false)
    }

    checkResumeLimit()
  }, [router, supabase])

  // Auto-save on every change (but only after initial load)
  useEffect(() => {
    if (hasLoaded) {
      localStorage.setItem('resumeBuilderProgress', JSON.stringify({ formData, step }))
    }
  }, [formData, step, hasLoaded])

  // Helper functions
  const updateFormData = (updates) => {
    setFormData(prev => ({ ...prev, ...updates }))
  }

  const formatDate = (dateString) => {
    if (!dateString) return ''
    const [year, month] = dateString.split('-')
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December']
    return `${monthNames[parseInt(month) - 1]} ${year}`
  }

  // Manual save progress
  const handleSaveProgress = async () => {
    setSaving(true)
    // Already saved to localStorage automatically
    setTimeout(() => {
      alert('Progress saved! You can come back anytime to continue.')
      setSaving(false)
    }, 500)
  }

  // Final submit handler
  const handleFinish = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Create resume text
      const resumeText = `
${formData.fullName}
${formData.email} | ${formData.phone} | ${formData.location}
${formData.linkedin ? `LinkedIn: ${formData.linkedin}` : ''}

${formData.summary ? `PROFESSIONAL SUMMARY\n${formData.summary}\n` : ''}

WORK EXPERIENCE
${formData.experience.map(job => `
${job.title} at ${job.company}
${formatDate(job.startDate)} - ${job.current ? 'Present' : formatDate(job.endDate)}
${job.description}
`).join('\n')}

EDUCATION
${formData.education.map(ed => `
${ed.degree}${ed.major ? ` in ${ed.major}` : ''}${ed.minor ? `, Minor in ${ed.minor}` : ''}
${ed.school}, ${formatDate(ed.graduationDate)}
${ed.gpa ? `GPA: ${ed.gpa}` : ''}
${ed.activities ? `Activities: ${ed.activities}` : ''}
${ed.honors ? `Honors: ${ed.honors}` : ''}
`).join('\n')}

${formData.certifications.length > 0 ? `
CERTIFICATIONS, LICENSES & AWARDS
${formData.certifications.map(cert => `
${cert.name} - ${cert.issuer}, ${formatDate(cert.date)}
${cert.expires ? `Expires: ${formatDate(cert.expirationDate)}` : ''}
`).join('\n')}
` : ''}

${formData.volunteer.length > 0 ? `
VOLUNTEER & LEADERSHIP
${formData.volunteer.map(v => `
${v.role} - ${v.organization}
${v.description}
`).join('\n')}
` : ''}

${formData.projects.length > 0 ? `
PROJECTS
${formData.projects.map(p => `
${p.name}
${p.description}
${p.technologies ? `Technologies: ${p.technologies}` : ''}
`).join('\n')}
` : ''}

SKILLS
${formData.skills.join(', ')}

${formData.languages.length > 0 ? `
LANGUAGES
${formData.languages.map(l => `${l.language} (${l.proficiency})`).join(', ')}
` : ''}
      `.trim()

      // Save to database
      const { data: resumeData, error } = await supabase
        .from('resumes')
        .insert({
          user_id: user.id,
          parsed_text: resumeText,
          resume_data: formData,
          created_via: 'builder'
        })
        .select()
        .single()

      if (error) throw error

      // Clear localStorage backup
      localStorage.removeItem('resumeBuilderProgress')

      // Route to My Resumes to review before analysis
      router.push('/my-resumes')
      
    } catch (error) {
      console.error('Error saving resume:', error)
      alert('Failed to save resume. Please try again.')
    }
  }

// Check access before showing any step
  if (checkingLimit) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-gray-600">Checking access...</div>
        </div>
      </>
    )
  }

// ============= STEP 1: PERSONAL INFO =============
  if (step === 1) {
    return (
      <>
        <Header />
      <div className="max-w-2xl mx-auto p-8 min-h-screen">
        <div className="mb-6">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-purple-600 font-medium">Step 1 of 7</span>
            <span className="text-sm text-gray-500">Personal Info</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-purple-600 h-2 rounded-full" style={{ width: '14.3%' }}></div>
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-2">👤 Tell us about yourself</h2>
        <p className="text-gray-600 mb-6">We'll use this to contact you about opportunities</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => updateFormData({ fullName: e.target.value })}
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Jane Smith"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => updateFormData({ email: e.target.value })}
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="jane.smith@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Phone <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => updateFormData({ phone: e.target.value })}
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="(555) 555-5555"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Location <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => updateFormData({ location: e.target.value })}
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Orlando, FL"
            />
            <p className="text-xs text-gray-500 mt-1">City and state is enough</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              LinkedIn <span className="text-gray-400">(optional but recommended)</span>
            </label>
            <input
              type="url"
              value={formData.linkedin}
              onChange={(e) => updateFormData({ linkedin: e.target.value })}
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="linkedin.com/in/yourname"
            />
          </div>
        </div>

        <div className="mt-8 flex justify-end items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={handleSaveProgress}
              disabled={saving}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              {saving ? 'Saving...' : 'Save & Continue Later'}
            </button>
            <button
              onClick={() => setStep(2)}
              disabled={!formData.fullName || !formData.email || !formData.phone || !formData.location}
              className="bg-purple-600 text-white px-8 py-3 rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
            >
              Next: Work Experience →
            </button>
          </div>
        </div>
      </div>
      </>
    )
  }

  // ============= STEP 2: WORK EXPERIENCE =============
  if (step === 2) {
    const addJob = () => {
      if (currentJob.title && currentJob.company && currentJob.startDate && currentJob.description) {
        updateFormData({
          experience: [...formData.experience, currentJob]
        })
        setCurrentJob({
          title: '',
          company: '',
          startDate: '',
          endDate: '',
          current: false,
          description: ''
        })
        setShowJobForm(false)
      }
    }

    const removeJob = (index) => {
      const newExperience = formData.experience.filter((_, i) => i !== index)
      updateFormData({ experience: newExperience })
    }

    return (
      <>
        <Header />
        <div className="max-w-2xl mx-auto p-8 min-h-screen">
        <div className="mb-6">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-purple-600 font-medium">Step 2 of 7</span>
            <span className="text-sm text-gray-500">Work Experience</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-purple-600 h-2 rounded-full" style={{ width: '28.6%' }}></div>
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-2">💼 Your Work Experience</h2>
        <p className="text-gray-600 mb-6">Add your jobs, internships, or relevant experience</p>

        {/* Coaching Tips */}
        <div className="bg-purple-50 border-l-4 border-purple-500 p-4 mb-6">
          <p className="font-semibold text-purple-900 mb-2">💡 How to write a strong job entry</p>
          <ul className="text-sm text-purple-800 space-y-2 mb-3">
            <li>✓ <strong>Start with a 1-2 sentence summary</strong> of your role</li>
            <li>✓ <strong>Then add bullet points</strong> for specific projects and results</li>
            <li>✓ <strong>Include numbers:</strong> team size, budget, percentages, time saved</li>
            <li>✓ <strong>Use proper capitalization and punctuation</strong> (helps our AI analyze accurately)</li>
          </ul>
          <div className="bg-white rounded p-3 text-sm">
            <p className="text-purple-900 font-medium mb-1">Example format:</p>
            <p className="text-gray-700 italic">
              "Supervised front desk operations for 200+ room resort. Managed team of 8 staff members.
              <br/>• Redesigned check-in process, reducing guest wait time by 40%
              <br/>• Increased guest satisfaction scores from 3.2 to 4.7
              <br/>• Trained 12 new hires on customer service protocols"
            </p>
          </div>
        </div>

        {/* Added Jobs */}
        {formData.experience.length > 0 && (
          <div className="mb-6 space-y-3">
            <h3 className="font-medium text-gray-700">Your Experience ({formData.experience.length}):</h3>
            {formData.experience.map((job, index) => (
              <div key={index} className="border-2 border-green-200 bg-green-50 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-green-600 text-lg">✓</span>
                      <h4 className="font-semibold text-lg">{job.title}</h4>
                    </div>
                    <p className="text-gray-600">{job.company}</p>
                    <p className="text-sm text-gray-500">
                      {formatDate(job.startDate)} - {job.current ? 'Present' : formatDate(job.endDate)}
                    </p>
                    <p className="text-sm text-gray-700 mt-2 whitespace-pre-line">{job.description}</p>
                  </div>
                  <button
                    onClick={() => removeJob(index)}
                    className="text-red-500 hover:text-red-700 text-sm font-medium ml-4"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Job Form - Collapsible */}
        {!showJobForm && (
          <button
            onClick={() => setShowJobForm(true)}
            className="w-full border-2 border-dashed border-purple-300 bg-white text-purple-600 py-4 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all font-medium"
          >
            + Add {formData.experience.length === 0 ? 'Your First' : 'Another'} Job
          </button>
        )}

        {showJobForm && (
          <div className="border-2 border-purple-300 rounded-lg p-6 bg-white shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-lg">
                {formData.experience.length === 0 ? '📝 Add Your First Job' : '📝 Add Another Job'}
              </h3>
              {formData.experience.length > 0 && (
                <button
                  onClick={() => setShowJobForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Job Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={currentJob.title}
                  onChange={(e) => setCurrentJob({ ...currentJob, title: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g., Front Desk Supervisor"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Company <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={currentJob.company}
                  onChange={(e) => setCurrentJob({ ...currentJob, company: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g., Disney's Grand Floridian Resort"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={currentJob.startDate.split('-')[1] || ''}
                      onChange={(e) => {
                        const year = currentJob.startDate.split('-')[0] || new Date().getFullYear()
                        setCurrentJob({ ...currentJob, startDate: `${year}-${e.target.value}` })
                      }}
                      className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Month</option>
                      <option value="01">January</option>
                      <option value="02">February</option>
                      <option value="03">March</option>
                      <option value="04">April</option>
                      <option value="05">May</option>
                      <option value="06">June</option>
                      <option value="07">July</option>
                      <option value="08">August</option>
                      <option value="09">September</option>
                      <option value="10">October</option>
                      <option value="11">November</option>
                      <option value="12">December</option>
                    </select>
                    <select
                      value={currentJob.startDate.split('-')[0] || ''}
                      onChange={(e) => {
                        const month = currentJob.startDate.split('-')[1] || '01'
                        setCurrentJob({ ...currentJob, startDate: `${e.target.value}-${month}` })
                      }}
                      className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Year</option>
                      {Array.from({ length: 32 }, (_, i) => new Date().getFullYear() + 1 - i).map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    End Date {currentJob.current && <span className="text-gray-500">(Current)</span>}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={currentJob.endDate.split('-')[1] || ''}
                      onChange={(e) => {
                        const year = currentJob.endDate.split('-')[0] || new Date().getFullYear()
                        setCurrentJob({ ...currentJob, endDate: `${year}-${e.target.value}` })
                      }}
                      className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500"
                      disabled={currentJob.current}
                    >
                      <option value="">Month</option>
                      <option value="01">January</option>
                      <option value="02">February</option>
                      <option value="03">March</option>
                      <option value="04">April</option>
                      <option value="05">May</option>
                      <option value="06">June</option>
                      <option value="07">July</option>
                      <option value="08">August</option>
                      <option value="09">September</option>
                      <option value="10">October</option>
                      <option value="11">November</option>
                      <option value="12">December</option>
                    </select>
                    <select
                      value={currentJob.endDate.split('-')[0] || ''}
                      onChange={(e) => {
                        const month = currentJob.endDate.split('-')[1] || '01'
                        setCurrentJob({ ...currentJob, endDate: `${e.target.value}-${month}` })
                      }}
                      className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500"
                      disabled={currentJob.current}
                    >
                      <option value="">Year</option>
                      {Array.from({ length: 32 }, (_, i) => new Date().getFullYear() + 1 - i).map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={currentJob.current}
                    onChange={(e) => setCurrentJob({
                      ...currentJob,
                      current: e.target.checked,
                      endDate: e.target.checked ? '' : currentJob.endDate
                    })}
                    className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm font-medium">I currently work here</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Role Summary & Accomplishments <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={currentJob.description}
                  onChange={(e) => setCurrentJob({ ...currentJob, description: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500"
                  rows="6"
                  placeholder="Start with 1-2 sentences about your role, then add bullets:&#10;&#10;Supervised front desk operations for 200+ room resort. Managed team of 8.&#10;• Redesigned check-in process, reducing wait time by 40%&#10;• Increased satisfaction scores from 3.2 to 4.7&#10;• Trained 12 new hires on service protocols"
                />
                <p className="text-xs text-gray-500 mt-1">
                  💡 <strong>Be specific!</strong> Instead of "Managed team," try "Managed team of 8 staff members." Instead of "Improved sales," try "Increased sales by 25% in 6 months."
                </p>
              </div>

              <button
                onClick={addJob}
                disabled={!currentJob.title || !currentJob.company || !currentJob.startDate || !currentJob.description}
                className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
              >
                ✓ Save This Job
              </button>
            </div>
          </div>
        )}

        {/* Resume Length Guidance */}
        {formData.experience.length > 0 && (
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <strong>📏 Resume length tip:</strong> 1 page if you have less than 7 years of experience, 2 pages if 7-15 years. Each bullet should be 1-2 lines.
            </p>
          </div>
        )}

        <div className="mt-8 flex justify-between items-center">
          <button
            onClick={() => setStep(1)}
            className="text-gray-600 hover:text-gray-800 font-medium"
          >
            ← Back
          </button>
          <div className="flex items-center gap-4">
            <button
              onClick={handleSaveProgress}
              disabled={saving}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              {saving ? 'Saving...' : 'Save & Continue Later'}
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={formData.experience.length === 0}
              className="bg-purple-600 text-white px-8 py-3 rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
            >
              Next: Education →
            </button>
          </div>
        </div>
      </div>
      </>
    )
  }

  // ============= STEP 3: EDUCATION =============
  if (step === 3) {
    const addEducation = () => {
      if (currentEd.degree && currentEd.school && currentEd.graduationDate && (currentEd.major || currentEd.degree === 'High School Diploma' || currentEd.degree === 'GED')) {
        updateFormData({
          education: [...formData.education, currentEd]
        })
        setCurrentEd({
          degree: '',
          major: '',
          minor: '',
          school: '',
          graduationDate: '',
          gpa: '',
          activities: '',
          honors: ''
        })
        setShowEdForm(false)
      }
    }

    const removeEducation = (index) => {
      const newEducation = formData.education.filter((_, i) => i !== index)
      updateFormData({ education: newEducation })
    }

    return (
      <>
        <Header />
        <div className="max-w-2xl mx-auto p-8 min-h-screen">
        <div className="mb-6">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-purple-600 font-medium">Step 3 of 7</span>
            <span className="text-sm text-gray-500">Education</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-purple-600 h-2 rounded-full" style={{ width: '42.9%' }}></div>
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-2">🎓 Your Education</h2>
        <p className="text-gray-600 mb-6">Add your degrees and academic background</p>

        {/* Added Education */}
        {formData.education.length > 0 && (
          <div className="mb-6 space-y-3">
            <h3 className="font-medium text-gray-700">Your Education ({formData.education.length}):</h3>
            {formData.education.map((ed, index) => (
              <div key={index} className="border-2 border-green-200 bg-green-50 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-green-600 text-lg">✓</span>
                      <h4 className="font-semibold text-lg">
                        {ed.degree}{ed.major && ` in ${ed.major}`}
                      </h4>
                    </div>
                    <p className="text-gray-600">{ed.school}</p>
                    <p className="text-sm text-gray-500">
                      {formatDate(ed.graduationDate)} {ed.gpa && `• GPA: ${ed.gpa}`}
                    </p>
                    {ed.minor && (
                      <p className="text-sm text-gray-700 mt-2">
                        <span className="font-medium">Minor:</span> {ed.minor}
                      </p>
                    )}
                    {ed.activities && (
                      <p className="text-sm text-gray-700 mt-2">
                        <span className="font-medium">Activities:</span> {ed.activities}
                      </p>
                    )}
                    {ed.honors && (
                      <p className="text-sm text-gray-700 mt-1">
                        <span className="font-medium">Honors:</span> {ed.honors}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => removeEducation(index)}
                    className="text-red-500 hover:text-red-700 text-sm font-medium"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Education Form - Collapsible */}
        {!showEdForm && (
          <button
            onClick={() => setShowEdForm(true)}
            className="w-full border-2 border-dashed border-purple-300 bg-white text-purple-600 py-4 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all font-medium"
          >
            + Add {formData.education.length === 0 ? 'Your' : 'Another'} Degree
          </button>
        )}

        {showEdForm && (
          <div className="border-2 border-purple-300 rounded-lg p-6 bg-white shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-lg">
                {formData.education.length === 0 ? '📚 Add Your Education' : '📚 Add Another Degree'}
              </h3>
              {formData.education.length > 0 && (
                <button
                  onClick={() => setShowEdForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Degree Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={currentEd.degree}
                  onChange={(e) => setCurrentEd({ ...currentEd, degree: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Select degree type</option>
                  <option value="High School Diploma">High School Diploma</option>
                  <option value="GED">GED</option>
                  <option value="Trade/Vocational Certificate">Trade/Vocational Certificate</option>
                  <option value="Associate of Arts">Associate of Arts (AA)</option>
                  <option value="Associate of Science">Associate of Science (AS)</option>
                  <option value="Bachelor of Arts">Bachelor of Arts (BA)</option>
                  <option value="Bachelor of Science">Bachelor of Science (BS)</option>
                  <option value="Master of Arts">Master of Arts (MA)</option>
                  <option value="Master of Science">Master of Science (MS)</option>
                  <option value="MBA">MBA</option>
                  <option value="PhD">PhD</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {currentEd.degree && currentEd.degree !== 'High School Diploma' && currentEd.degree !== 'GED' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Major/Field of Study <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={currentEd.major}
                      onChange={(e) => setCurrentEd({ ...currentEd, major: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500"
                      placeholder="e.g., Hospitality Management"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Minor <span className="text-gray-400">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={currentEd.minor}
                      onChange={(e) => setCurrentEd({ ...currentEd, minor: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500"
                      placeholder="e.g., Business Administration"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">
                  School <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={currentEd.school}
                  onChange={(e) => setCurrentEd({ ...currentEd, school: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g., University of Central Florida"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">
                    Graduation Date <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={currentEd.graduationDate.split('-')[1] || ''}
                      onChange={(e) => {
                        const year = currentEd.graduationDate.split('-')[0] || new Date().getFullYear()
                        setCurrentEd({ ...currentEd, graduationDate: `${year}-${e.target.value}` })
                      }}
                      className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Month</option>
                      <option value="01">January</option>
                      <option value="02">February</option>
                      <option value="03">March</option>
                      <option value="04">April</option>
                      <option value="05">May</option>
                      <option value="06">June</option>
                      <option value="07">July</option>
                      <option value="08">August</option>
                      <option value="09">September</option>
                      <option value="10">October</option>
                      <option value="11">November</option>
                      <option value="12">December</option>
                    </select>
                    <select
                      value={currentEd.graduationDate.split('-')[0] || ''}
                      onChange={(e) => {
                        const month = currentEd.graduationDate.split('-')[1] || '01'
                        setCurrentEd({ ...currentEd, graduationDate: `${e.target.value}-${month}` })
                      }}
                      className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Year</option>
                      {Array.from({ length: 55 }, (_, i) => new Date().getFullYear() + 4 - i).map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Or expected graduation</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    GPA <span className="text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={currentEd.gpa}
                    onChange={(e) => setCurrentEd({ ...currentEd, gpa: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500"
                    placeholder="3.8"
                  />
                  <p className="text-xs text-gray-500 mt-1">Only if 3.5+</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Activities & Involvement <span className="text-gray-400">(optional but helpful)</span>
                </label>
                <textarea
                  value={currentEd.activities}
                  onChange={(e) => setCurrentEd({ ...currentEd, activities: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500"
                  rows="2"
                  placeholder="Student Government, Hospitality Club Vice President, Volunteer Coordinator..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  💡 Leadership roles show more than membership! "President of..." is stronger than "Member of..."
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Honors & Awards <span className="text-gray-400">(optional but impressive)</span>
                </label>
                <textarea
                  value={currentEd.honors}
                  onChange={(e) => setCurrentEd({ ...currentEd, honors: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500"
                  rows="2"
                  placeholder="Dean's List (4 semesters), Presidential Scholarship, Academic Excellence Award..."
                />
              </div>

              <button
                onClick={addEducation}
                disabled={!currentEd.degree || !currentEd.school || !currentEd.graduationDate || (currentEd.degree !== 'High School Diploma' && currentEd.degree !== 'GED' && !currentEd.major)}
                className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
              >
                ✓ Save This Degree
              </button>
            </div>
          </div>
        )}

        <div className="mt-8 flex justify-between items-center">
          <button
            onClick={() => setStep(2)}
            className="text-gray-600 hover:text-gray-800 font-medium"
          >
            ← Back
          </button>
          <div className="flex items-center gap-4">
            <button
              onClick={handleSaveProgress}
              disabled={saving}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              {saving ? 'Saving...' : 'Save & Continue Later'}
            </button>
            <button
              onClick={() => setStep(4)}
              disabled={formData.education.length === 0}
              className="bg-purple-600 text-white px-8 py-3 rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
            >
              Next: Certifications & Licenses →
            </button>
          </div>
        </div>
      </div>
      </>
    )
  }

  // ============= STEP 4: CERTIFICATIONS & AWARDS =============
  if (step === 4) {
    const addCertification = () => {
      if (currentCert.name && currentCert.issuer && currentCert.date) {
        updateFormData({
          certifications: [...formData.certifications, currentCert]
        })
        setCurrentCert({
          name: '',
          issuer: '',
          date: '',
          expires: false,
          expirationDate: ''
        })
        setShowCertForm(false)
      }
    }

    const removeCertification = (index) => {
      const newCerts = formData.certifications.filter((_, i) => i !== index)
      updateFormData({ certifications: newCerts })
    }

    return (
      <>
        <Header />
        <div className="max-w-2xl mx-auto p-8 min-h-screen">
        <div className="mb-6">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-purple-600 font-medium">Step 4 of 7</span>
            <span className="text-sm text-gray-500">Certifications & Licenses</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-purple-600 h-2 rounded-full" style={{ width: '57.1%' }}></div>
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-2">🏆 Certifications, Licenses & Awards</h2>
        <p className="text-gray-600 mb-6">Professional certifications, licenses, or recognition (skip if none)</p>

        {formData.certifications.length > 0 && (
          <div className="mb-6 space-y-3">
            <h3 className="font-medium text-gray-700">Your Items ({formData.certifications.length}):</h3>
            {formData.certifications.map((cert, index) => (
              <div key={index} className="border-2 border-green-200 bg-green-50 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-green-600 text-lg">✓</span>
                      <h4 className="font-semibold text-lg">{cert.name}</h4>
                    </div>
                    <p className="text-gray-600">{cert.issuer}</p>
                    <p className="text-sm text-gray-500">
                      Issued: {formatDate(cert.date)}
                      {cert.expires && cert.expirationDate && ` • Expires: ${formatDate(cert.expirationDate)}`}
                    </p>
                  </div>
                  <button
                    onClick={() => removeCertification(index)}
                    className="text-red-500 hover:text-red-700 text-sm font-medium"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!showCertForm && (
          <button
            onClick={() => setShowCertForm(true)}
            className="w-full border-2 border-dashed border-purple-300 bg-white text-purple-600 py-4 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all font-medium"
          >
            + Add {formData.certifications.length === 0 ? 'a' : 'Another'} Certification, License or Award
          </button>
        )}

        {showCertForm && (
          <div className="border-2 border-purple-300 rounded-lg p-6 bg-white shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-lg">
                {formData.certifications.length === 0 ? '🏅 Add Certification, License or Award' : '🏅 Add Another Item'}
              </h3>
              {formData.certifications.length > 0 && (
                <button
                  onClick={() => setShowCertForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-yellow-900">
                <strong>Examples:</strong> RN License, ServSafe, CPR/First Aid, PMP, Google Analytics, Real Estate License, Employee of the Month, Sales Achievement Award
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Certification, License or Award Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={currentCert.name}
                  onChange={(e) => setCurrentCert({ ...currentCert, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g., Certified Hospitality Supervisor"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Issuing Organization <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={currentCert.issuer}
                  onChange={(e) => setCurrentCert({ ...currentCert, issuer: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g., American Hotel & Lodging Educational Institute"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Date Received <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={currentCert.date.split('-')[1] || ''}
                      onChange={(e) => {
                        const year = currentCert.date.split('-')[0] || new Date().getFullYear()
                        setCurrentCert({ ...currentCert, date: `${year}-${e.target.value}` })
                      }}
                      className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Month</option>
                      <option value="01">January</option>
                      <option value="02">February</option>
                      <option value="03">March</option>
                      <option value="04">April</option>
                      <option value="05">May</option>
                      <option value="06">June</option>
                      <option value="07">July</option>
                      <option value="08">August</option>
                      <option value="09">September</option>
                      <option value="10">October</option>
                      <option value="11">November</option>
                      <option value="12">December</option>
                    </select>
                    <select
                      value={currentCert.date.split('-')[0] || ''}
                      onChange={(e) => {
                        const month = currentCert.date.split('-')[1] || '01'
                        setCurrentCert({ ...currentCert, date: `${e.target.value}-${month}` })
                      }}
                      className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Year</option>
                      {Array.from({ length: 32 }, (_, i) => new Date().getFullYear() + 1 - i).map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                {currentCert.expires && (
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Expiration Date
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={currentCert.expirationDate.split('-')[1] || ''}
                        onChange={(e) => {
                          const year = currentCert.expirationDate.split('-')[0] || new Date().getFullYear()
                          setCurrentCert({ ...currentCert, expirationDate: `${year}-${e.target.value}` })
                        }}
                        className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="">Month</option>
                        <option value="01">January</option>
                        <option value="02">February</option>
                        <option value="03">March</option>
                        <option value="04">April</option>
                        <option value="05">May</option>
                        <option value="06">June</option>
                        <option value="07">July</option>
                        <option value="08">August</option>
                        <option value="09">September</option>
                        <option value="10">October</option>
                        <option value="11">November</option>
                        <option value="12">December</option>
                      </select>
                      <select
                        value={currentCert.expirationDate.split('-')[0] || ''}
                        onChange={(e) => {
                          const month = currentCert.expirationDate.split('-')[1] || '01'
                          setCurrentCert({ ...currentCert, expirationDate: `${e.target.value}-${month}` })
                        }}
                        className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="">Year</option>
                        {Array.from({ length: 32 }, (_, i) => new Date().getFullYear() + 10 - i).map(year => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={currentCert.expires}
                    onChange={(e) => setCurrentCert({
                      ...currentCert,
                      expires: e.target.checked,
                      expirationDate: e.target.checked ? currentCert.expirationDate : ''
                    })}
                    className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm font-medium">This certification or license expires</span>
                </label>
              </div>

              <button
                onClick={addCertification}
                disabled={!currentCert.name || !currentCert.issuer || !currentCert.date}
                className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
              >
                ✓ Save This Item
              </button>
            </div>
          </div>
        )}

        <div className="mt-8 flex justify-between items-center">
          <button
            onClick={() => setStep(3)}
            className="text-gray-600 hover:text-gray-800 font-medium"
          >
            ← Back
          </button>
          <div className="flex items-center gap-4">
            <button
              onClick={handleSaveProgress}
              disabled={saving}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              {saving ? 'Saving...' : 'Save & Continue Later'}
            </button>
            <button
              onClick={() => setStep(5)}
              className="bg-purple-600 text-white px-8 py-3 rounded-lg hover:bg-purple-700 transition-colors font-medium"
            >
              {formData.certifications.length === 0 ? 'Skip This Step →' : 'Next: Volunteer & Projects →'}
            </button>
          </div>
        </div>
      </div>
      </>
    )
  }

 // ============= STEP 5: VOLUNTEER & PROJECTS =============
  if (step === 5) {
    const addVolunteer = () => {
      if (currentVolunteer.role && currentVolunteer.organization && currentVolunteer.description) {
        updateFormData({
          volunteer: [...formData.volunteer, currentVolunteer]
        })
        setCurrentVolunteer({
          role: '',
          organization: '',
          description: ''
        })
      }
    }

    const removeVolunteer = (index) => {
      const newVolunteer = formData.volunteer.filter((_, i) => i !== index)
      updateFormData({ volunteer: newVolunteer })
    }

    const addProject = () => {
      if (currentProject.name && currentProject.description) {
        updateFormData({
          projects: [...formData.projects, currentProject]
        })
        setCurrentProject({
          name: '',
          description: '',
          technologies: ''
        })
      }
    }

    const removeProject = (index) => {
      const newProjects = formData.projects.filter((_, i) => i !== index)
      updateFormData({ projects: newProjects })
    }

    return (
      <>
        <Header />
        <div className="max-w-2xl mx-auto p-8 min-h-screen">
        <div className="mb-6">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-purple-600 font-medium">Step 5 of 7</span>
            <span className="text-sm text-gray-500">Volunteer & Projects</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-purple-600 h-2 rounded-full" style={{ width: '71.4%' }}></div>
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-2">🤝 Volunteer & Projects</h2>
        <p className="text-gray-600 mb-6">Add volunteer work, side projects, or personal achievements (skip if none)</p>

        {/* Volunteer Section */}
        <div className="mb-8">
          <h3 className="font-semibold text-lg mb-3">Volunteer & Leadership</h3>
          
          {formData.volunteer.length > 0 && (
            <div className="mb-4 space-y-3">
              {formData.volunteer.map((vol, index) => (
                <div key={index} className="border-2 border-green-200 bg-green-50 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-green-600 text-lg">✓</span>
                        <h4 className="font-semibold">{vol.role}</h4>
                      </div>
                      <p className="text-gray-600 text-sm">{vol.organization}</p>
                      <p className="text-sm text-gray-700 mt-1">{vol.description}</p>
                    </div>
                    <button
                      onClick={() => removeVolunteer(index)}
                      className="text-red-500 hover:text-red-700 text-sm font-medium"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!showVolunteerForm && (
            <button
              onClick={() => setShowVolunteerForm(true)}
              className="w-full border-2 border-dashed border-purple-300 bg-white text-purple-600 py-3 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all font-medium text-sm"
            >
              + Add Volunteer Experience
            </button>
          )}

          {showVolunteerForm && (
            <div className="border-2 border-purple-300 rounded-lg p-4 bg-white shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-semibold">Add Volunteer Experience</h4>
                {formData.volunteer.length > 0 && (
                  <button
                    onClick={() => setShowVolunteerForm(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="space-y-3">
                <input
                  type="text"
                  value={currentVolunteer.role}
                  onChange={(e) => setCurrentVolunteer({ ...currentVolunteer, role: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500"
                  placeholder="Role (e.g., Volunteer Coordinator)"
                />
                <input
                  type="text"
                  value={currentVolunteer.organization}
                  onChange={(e) => setCurrentVolunteer({ ...currentVolunteer, organization: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500"
                  placeholder="Organization (e.g., Habitat for Humanity)"
                />
                <textarea
                  value={currentVolunteer.description}
                  onChange={(e) => setCurrentVolunteer({ ...currentVolunteer, description: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500"
                  rows="2"
                  placeholder="What did you accomplish? (e.g., Coordinated 15 volunteers, built 3 homes)"
                />
                <button
                  onClick={addVolunteer}
                  disabled={!currentVolunteer.role || !currentVolunteer.organization || !currentVolunteer.description}
                  className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  ✓ Save Volunteer Experience
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Projects Section */}
        <div>
          <h3 className="font-semibold text-lg mb-3">Projects</h3>
          <p className="text-sm text-gray-600 mb-3">Side projects, portfolios, or personal initiatives</p>
          
          {formData.projects.length > 0 && (
            <div className="mb-4 space-y-3">
              {formData.projects.map((proj, index) => (
                <div key={index} className="border-2 border-green-200 bg-green-50 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-green-600 text-lg">✓</span>
                        <h4 className="font-semibold">{proj.name}</h4>
                      </div>
                      <p className="text-sm text-gray-700 mt-1">{proj.description}</p>
                      {proj.technologies && (
                        <p className="text-xs text-gray-500 mt-1">Tech: {proj.technologies}</p>
                      )}
                    </div>
                    <button
                      onClick={() => removeProject(index)}
                      className="text-red-500 hover:text-red-700 text-sm font-medium"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!showProjectForm && (
            <button
              onClick={() => setShowProjectForm(true)}
              className="w-full border-2 border-dashed border-purple-300 bg-white text-purple-600 py-3 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all font-medium text-sm"
            >
              + Add Project
            </button>
          )}

          {showProjectForm && (
            <div className="border-2 border-purple-300 rounded-lg p-4 bg-white shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-semibold">Add Project</h4>
                {formData.projects.length > 0 && (
                  <button
                    onClick={() => setShowProjectForm(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="space-y-3">
                <input
                  type="text"
                  value={currentProject.name}
                  onChange={(e) => setCurrentProject({ ...currentProject, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500"
                  placeholder="Project name (e.g., Personal Finance Tracker App)"
                />
                <textarea
                  value={currentProject.description}
                  onChange={(e) => setCurrentProject({ ...currentProject, description: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500"
                  rows="2"
                  placeholder="What does it do? What problem does it solve?"
                />
                <input
                  type="text"
                  value={currentProject.technologies}
                  onChange={(e) => setCurrentProject({ ...currentProject, technologies: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500"
                  placeholder="Technologies used (e.g., React, Python, SQL)"
                />
                <button
                  onClick={addProject}
                  disabled={!currentProject.name || !currentProject.description}
                  className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  ✓ Save Project
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 flex justify-between items-center">
          <button
            onClick={() => setStep(4)}
            className="text-gray-600 hover:text-gray-800 font-medium"
          >
            ← Back
          </button>
          <div className="flex items-center gap-4">
            <button
              onClick={handleSaveProgress}
              disabled={saving}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              {saving ? 'Saving...' : 'Save & Continue Later'}
            </button>
            <button
              onClick={() => setStep(6)}
              className="bg-purple-600 text-white px-8 py-3 rounded-lg hover:bg-purple-700 transition-colors font-medium"
            >
              {formData.volunteer.length === 0 && formData.projects.length === 0 ? 'Skip This Step →' : 'Next: Skills & Languages →'}
            </button>
          </div>
        </div>
      </div>
      </>
    )
  }

  // ============= STEP 6: SKILLS & LANGUAGES =============
  if (step === 6) {
    const addSkill = () => {
      const trimmedSkill = currentSkill.trim()
      if (trimmedSkill && !formData.skills.includes(trimmedSkill)) {
        updateFormData({
          skills: [...formData.skills, trimmedSkill]
        })
        setCurrentSkill('')
      }
    }

    const removeSkill = (skillToRemove) => {
      const newSkills = formData.skills.filter(skill => skill !== skillToRemove)
      updateFormData({ skills: newSkills })
    }

    const addCommonSkill = (skill) => {
      if (!formData.skills.includes(skill)) {
        updateFormData({
          skills: [...formData.skills, skill]
        })
      }
    }

    const addLanguage = () => {
      if (currentLanguage.language && !formData.languages.some(l => l.language === currentLanguage.language)) {
        updateFormData({
          languages: [...formData.languages, currentLanguage]
        })
        setCurrentLanguage({
          language: '',
          proficiency: 'conversational'
        })
      }
    }

    const removeLanguage = (langToRemove) => {
      const newLanguages = formData.languages.filter(l => l.language !== langToRemove)
      updateFormData({ languages: newLanguages })
    }

    const commonSkills = [
      'Communication', 'Leadership', 'Microsoft Excel', 'Project Management',
      'Customer Service', 'Problem Solving', 'Time Management', 'Teamwork',
      'Public Speaking', 'Writing', 'Data Analysis', 'Social Media',
      'Microsoft Office', 'Sales', 'Marketing', 'Budgeting'
    ]

    return (
      <>
        <Header />
        <div className="max-w-2xl mx-auto p-8 min-h-screen">
        <div className="mb-6">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-purple-600 font-medium">Step 6 of 7</span>
            <span className="text-sm text-gray-500">Skills & Languages</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-purple-600 h-2 rounded-full" style={{ width: '85.7%' }}></div>
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-2">🛠️ Skills & Languages</h2>
        <p className="text-gray-600 mb-6">Add the skills and languages that make you stand out</p>

        {/* Skills Section */}
        <div className="mb-8">
          <h3 className="font-semibold text-lg mb-3">Skills</h3>
          
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-purple-900">
              <strong>💡 Tip:</strong> Include both technical skills (software, tools) and soft skills (communication, leadership). Recruiters search for specific terms!
            </p>
          </div>

          <div className="mb-4">
            <input
              type="text"
              value={currentSkill}
              onChange={(e) => setCurrentSkill(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addSkill()
                }
              }}
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500"
              placeholder="Type a skill and press Enter"
            />
          </div>

          {formData.skills.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium mb-2">Your skills:</h4>
              <div className="flex flex-wrap gap-2">
                {formData.skills.map((skill, index) => (
                  <div
                    key={index}
                    className="bg-purple-100 text-purple-700 px-4 py-2 rounded-full text-sm flex items-center"
                  >
                    {skill}
                    <button
                      onClick={() => removeSkill(skill)}
                      className="ml-2 text-purple-500 hover:text-purple-700 font-bold"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h4 className="text-sm font-medium mb-2">Or choose from common skills:</h4>
            <div className="flex flex-wrap gap-2">
              {commonSkills
                .filter(skill => !formData.skills.includes(skill))
                .map((skill, index) => (
                  <button
                    key={index}
                    onClick={() => addCommonSkill(skill)}
                    className="border border-gray-300 px-4 py-2 rounded-full text-sm hover:bg-gray-100 transition-colors"
                  >
                    + {skill}
                  </button>
                ))}
            </div>
          </div>
        </div>

        {/* Languages Section */}
        <div className="mb-8">
          <h3 className="font-semibold text-lg mb-3">Languages</h3>
          <p className="text-sm text-gray-600 mb-3">Especially important for hospitality and customer-facing roles!</p>

          {formData.languages.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium mb-2">Your languages:</h4>
              <div className="flex flex-wrap gap-2">
                {formData.languages.map((lang, index) => (
                  <div
                    key={index}
                    className="bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm flex items-center"
                  >
                    {lang.language} ({lang.proficiency})
                    <button
                      onClick={() => removeLanguage(lang.language)}
                      className="ml-2 text-blue-500 hover:text-blue-700 font-bold"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-white">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <input
                  type="text"
                  value={currentLanguage.language}
                  onChange={(e) => setCurrentLanguage({ ...currentLanguage, language: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g., Spanish"
                />
              </div>
              <select
                value={currentLanguage.proficiency}
                onChange={(e) => setCurrentLanguage({ ...currentLanguage, proficiency: e.target.value })}
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500"
              >
                <option value="basic">Basic</option>
                <option value="conversational">Conversational</option>
                <option value="fluent">Fluent</option>
                <option value="native">Native</option>
              </select>
            </div>
            <button
              onClick={addLanguage}
              disabled={!currentLanguage.language}
              className="w-full mt-3 border-2 border-blue-600 text-blue-600 py-2 rounded-lg hover:bg-blue-50 disabled:border-gray-300 disabled:text-gray-300 disabled:cursor-not-allowed"
            >
              + Add Language
            </button>
          </div>
        </div>

        <div className="mt-8 flex justify-between items-center">
          <button
            onClick={() => setStep(5)}
            className="text-gray-600 hover:text-gray-800 font-medium"
          >
            ← Back
          </button>
          <div className="flex items-center gap-4">
            <button
              onClick={handleSaveProgress}
              disabled={saving}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              {saving ? 'Saving...' : 'Save & Continue Later'}
            </button>
            <button
              onClick={() => setStep(7)}
              disabled={formData.skills.length === 0}
              className="bg-purple-600 text-white px-8 py-3 rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
            >
              Next: Professional Summary →
            </button>
          </div>
        </div>
      </div>
      </>
    )
  }

  // ============= STEP 7: PROFESSIONAL SUMMARY =============
  if (step === 7) {
    return (
      <>
        <Header />
        <div className="max-w-2xl mx-auto p-8 min-h-screen">
          <div className="mb-6">
            <div className="flex justify-between mb-2">
              <span className="text-sm text-purple-600 font-medium">Step 7 of 7</span>
              <span className="text-sm text-gray-500">Professional Summary</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-purple-600 h-2 rounded-full" style={{ width: '100%' }}></div>
            </div>
          </div>

          <h2 className="text-2xl font-bold mb-2">✨ Professional Summary</h2>
          <p className="text-gray-600 mb-6">A brief statement that captures your professional identity and value (optional but recommended)</p>

          {/* Coaching Tips */}
          <div className="bg-purple-50 border-l-4 border-purple-500 p-4 mb-6">
            <p className="font-semibold text-purple-900 mb-2">💡 How to write a strong professional summary</p>
            <ul className="text-sm text-purple-800 space-y-2 mb-3">
              <li>✓ <strong>Keep it brief:</strong> 2-4 sentences maximum</li>
              <li>✓ <strong>Lead with your value:</strong> What do you bring to employers?</li>
              <li>✓ <strong>Include keywords:</strong> Use terms from your target jobs</li>
              <li>✓ <strong>Highlight achievements:</strong> Mention 1-2 impressive accomplishments</li>
              <li>✓ <strong>Show personality:</strong> Let your professional voice shine through</li>
            </ul>
            
            <div className="bg-white rounded p-3 text-sm">
              <p className="text-purple-900 font-medium mb-1">Example:</p>
              <p className="text-gray-700 italic">
                "Hospitality professional with 5+ years of experience managing guest services at luxury resorts. Track record of increasing satisfaction scores by 40% through process improvements and team training. Passionate about creating memorable experiences that turn first-time guests into loyal customers."
              </p>
            </div>
          </div>

          {/* Upsell Message */}
          <div className="bg-gradient-to-r from-purple-100 to-purple-200 border-2 border-purple-300 rounded-lg p-5 mb-6">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 text-2xl">💎</div>
              <div>
                <p className="font-bold text-purple-900 mb-2">Upgrade to Full Resume for AI Coaching</p>
                <p className="text-sm text-purple-800 mb-3">
                  Full Resume users get AI coaching that writes this summary FOR you—extracting your unique value proposition from a conversation. No more staring at a blank page!
                </p>
                <button
                  onClick={() => router.push('/pricing')}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm font-semibold"
                >
                  Upgrade to Full Resume →
                </button>
              </div>
            </div>
          </div>

          {/* Summary Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">
              Your Professional Summary <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              value={formData.summary}
              onChange={(e) => updateFormData({ summary: e.target.value })}
              className="w-full border border-gray-300 rounded-lg p-4 focus:ring-2 focus:ring-purple-500"
              rows="4"
              placeholder="Example: Experienced hospitality professional with a passion for creating exceptional guest experiences. Proven track record of improving team performance and guest satisfaction through innovative service strategies and staff development."
            />
            <p className="text-xs text-gray-500 mt-2">
              💡 <strong>Pro tip:</strong> Focus on what makes you unique and the specific value you bring to employers. Avoid generic statements like "hard worker" or "team player."
            </p>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex justify-between items-center">
            <button
              onClick={() => setStep(6)}
              className="text-gray-600 hover:text-gray-800 font-medium"
            >
              ← Back
            </button>
            <div className="flex items-center gap-4">
              <button
                onClick={handleSaveProgress}
                disabled={saving}
                className="text-sm text-gray-500 hover:text-gray-700 underline"
              >
                {saving ? 'Saving...' : 'Save & Continue Later'}
              </button>
              <button
                onClick={handleFinish}
                className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 transition-colors font-semibold flex items-center gap-2"
              >
                {formData.summary ? 'Complete Resume →' : 'Skip & Complete Resume →'}
              </button>
            </div>
          </div>

          {/* Optional Skip Note */}
          {!formData.summary && (
            <div className="mt-4 text-center">
              <p className="text-sm text-gray-500">
                You can always add a professional summary later by editing your resume
              </p>
            </div>
          )}
        </div>
      </>
    )
  }
  
  return (
    <div className="max-w-2xl mx-auto p-8">
      <p className="text-red-600">Something went wrong. Please refresh the page.</p>
    </div>
  )
}