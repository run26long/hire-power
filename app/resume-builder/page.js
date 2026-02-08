'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
async function saveResumeData(formData, supabase, router) {
  try {
    console.log('Step 1: Getting user...')
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      console.error('No user found!')
      throw new Error('User not authenticated')
    }
    console.log('Step 2: User found:', user.id)
    
    // Create a text representation of the resume (for AI coaching)
    const resumeText = `
${formData.fullName}
${formData.email} | ${formData.phone}
${formData.linkedin ? `LinkedIn: ${formData.linkedin}` : ''}

WORK EXPERIENCE
${formData.experience.map(job => `
${job.title} at ${job.company}
${job.startDate} - ${job.current ? 'Present' : job.endDate}
${job.description}
`).join('\n')}

EDUCATION
${formData.education.map(ed => `
${ed.degree}
${ed.school}, ${ed.graduationDate}
${ed.gpa ? `GPA: ${ed.gpa}` : ''}
${ed.activities ? `Activities: ${ed.activities}` : ''}
${ed.honors ? `Honors: ${ed.honors}` : ''}
`).join('\n')}

SKILLS
${formData.skills.join(', ')}
    `.trim()
    
    console.log('Step 3: Resume text created, length:', resumeText.length)
    console.log('Step 4: Attempting to insert into database...')
    
    // Insert into resumes table
    const { data, error } = await supabase
      .from('resumes')
      .insert({
        user_id: user.id,
        parsed_text: resumeText,
        resume_data: formData,
        created_via: 'builder'
      })
      .select()
      .single()
    
    if (error) {
      console.error('Step 5: Database error occurred!')
      console.error('Full error object:', error)
      console.error('Error message:', error.message)
      console.error('Error details:', error.details)
      console.error('Error hint:', error.hint)
      console.error('Error code:', error.code)
      throw error
    }
    
    console.log('Step 6: Resume saved successfully!', data)
    
    // Navigate to pre-coaching confirmation
    console.log('Step 7: Navigating to confirmation page...')
    router.push('/pre-coaching-confirmation')
    
  } catch (error) {
    console.error('CATCH BLOCK - Error in saveResumeData:')
    console.error('Error type:', typeof error)
    console.error('Error:', error)
    console.error('Error string:', JSON.stringify(error, null, 2))
    alert('There was an error saving your resume. Please try again.')
    throw error
  }
}
export default function ResumeBuilder() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    // Personal Info
    fullName: '',
    email: '',
    phone: '',
    linkedin: '',
    
    // Work Experience (we'll add this next)
    experience: [],
    
    // Education (we'll add this next)
    education: [],
    
    // Skills (we'll add this next)
    skills: []
  })

  // Helper function to update form data
  const updateFormData = (updates) => {
    setFormData(prev => ({ ...prev, ...updates }))
  }
   // ADD THESE LINES HERE (new state for Step 2):
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
  school: '',
  graduationDate: '',
  gpa: '',
  activities: '',
  honors: ''
})
const [currentSkill, setCurrentSkill] = useState('')
  // Helper to format dates nicely
const formatDate = (dateString) => {
  if (!dateString) return ''
  const [year, month] = dateString.split('-')
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December']
  return `${monthNames[parseInt(month) - 1]} ${year}`
}

  // ============= STEP 1: PERSONAL INFO =============
  if (step === 1) {
    return (
      <div className="max-w-2xl mx-auto p-8 min-h-screen">
        {/* Progress indicator */}
        <div className="mb-6">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-purple-600 font-medium">Step 1 of 4</span>
            <span className="text-sm text-gray-500">Personal Info</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-purple-600 h-2 rounded-full" style={{ width: '25%' }}></div>
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
              LinkedIn <span className="text-gray-400">(optional)</span>
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

        {/* Navigation */}
        <div className="mt-8 flex justify-between">
          <button
            onClick={() => router.push('/resume-start')}
            className="text-gray-600 hover:text-gray-800 font-medium"
          >
            ← Back
          </button>
          <button
            onClick={() => setStep(2)}
            disabled={!formData.fullName || !formData.email || !formData.phone}
            className="bg-purple-600 text-white px-8 py-3 rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
          >
            Next: Work Experience →
          </button>
        </div>
      </div>
    )
  }

  // ============= STEP 2: WORK EXPERIENCE =============
  if (step === 2) {
      const addJob = () => {
      if (currentJob.title && currentJob.company && currentJob.startDate && currentJob.description) {
        updateFormData({
          experience: [...formData.experience, currentJob]
        })
        // Reset form
        setCurrentJob({
          title: '',
          company: '',
          startDate: '',
          endDate: '',
          current: false,
          description: ''
        })
      }
    }

    const removeJob = (index) => {
      const newExperience = formData.experience.filter((_, i) => i !== index)
      updateFormData({ experience: newExperience })
    }

    return (
      <div className="max-w-2xl mx-auto p-8 min-h-screen">
        {/* Progress indicator */}
        <div className="mb-6">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-purple-600 font-medium">Step 2 of 4</span>
            <span className="text-sm text-gray-500">Work Experience</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-purple-600 h-2 rounded-full" style={{ width: '50%' }}></div>
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-2">💼 Your Work Experience</h2>
        <p className="text-gray-600 mb-6">Add your jobs, internships, or relevant experience</p>

        {/* Display added jobs */}
        {formData.experience.length > 0 && (
          <div className="mb-6 space-y-3">
            <h3 className="font-medium text-gray-700">Added Experience:</h3>
            {formData.experience.map((job, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg">{job.title}</h4>
                    <p className="text-gray-600">{job.company}</p>
                    <p className="text-sm text-gray-500">
  {formatDate(job.startDate)} - {job.current ? 'Present' : formatDate(job.endDate)}
</p>
                    <p className="text-sm text-gray-700 mt-2">{job.description}</p>
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

        {/* Add new job form */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 bg-white">
          <h3 className="font-semibold text-lg mb-4">
            {formData.experience.length === 0 ? '📝 Add Your First Job' : '📝 Add Another Job'}
          </h3>

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
                Brief Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={currentJob.description}
                onChange={(e) => setCurrentJob({ ...currentJob, description: e.target.value })}
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500"
                rows="3"
                placeholder="What did you do in this role? Just a brief overview - we'll extract the impressive details in the coaching session!"
              />
              <p className="text-xs text-gray-500 mt-1">
                💡 Don't worry about perfection! Our AI coach will help you quantify achievements in the next step.
              </p>
            </div>

            <button
              onClick={addJob}
              disabled={!currentJob.title || !currentJob.company || !currentJob.startDate || !currentJob.description}
              className="w-full border-2 border-purple-600 text-purple-600 py-3 rounded-lg hover:bg-purple-50 disabled:border-gray-300 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
            >
              + Add This Job
            </button>
          </div>
        </div>

        {/* Navigation */}
        <div className="mt-8 flex justify-between">
          <button
            onClick={() => setStep(1)}
            className="text-gray-600 hover:text-gray-800 font-medium"
          >
            ← Back
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
    )
  }

// ============= STEP 3: EDUCATION =============
if (step === 3) {
  const addEducation = () => {
    if (currentEd.degree && currentEd.school && currentEd.graduationDate) {
      updateFormData({
        education: [...formData.education, currentEd]
      })
      setCurrentEd({
        degree: '',
        school: '',
        graduationDate: '',
        gpa: '',
        activities: '',
        honors: ''
      })
    }
  }

  const removeEducation = (index) => {
    const newEducation = formData.education.filter((_, i) => i !== index)
    updateFormData({ education: newEducation })
  }

  return (
    <div className="max-w-2xl mx-auto p-8 min-h-screen">
      <div className="mb-6">
        <div className="flex justify-between mb-2">
          <span className="text-sm text-purple-600 font-medium">Step 3 of 4</span>
          <span className="text-sm text-gray-500">Education</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className="bg-purple-600 h-2 rounded-full" style={{ width: '75%' }}></div>
        </div>
      </div>

      <h2 className="text-2xl font-bold mb-2">🎓 Your Education</h2>
      <p className="text-gray-600 mb-6">Add your degrees, certifications, or relevant coursework</p>

      {formData.education.length > 0 && (
        <div className="mb-6 space-y-3">
          <h3 className="font-medium text-gray-700">Added Education:</h3>
          {formData.education.map((ed, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-semibold text-lg">{ed.degree}</h4>
                  <p className="text-gray-600">{ed.school}</p>
                  <p className="text-sm text-gray-500">
                    {formatDate(ed.graduationDate)} {ed.gpa && `• GPA: ${ed.gpa}`}
                  </p>
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

      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 bg-white">
        <h3 className="font-semibold text-lg mb-4">
          {formData.education.length === 0 ? '📚 Add Your Education' : '📚 Add Another Degree'}
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Degree <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={currentEd.degree}
              onChange={(e) => setCurrentEd({ ...currentEd, degree: e.target.value })}
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500"
              placeholder="e.g., Bachelor of Science in Hospitality Management"
            />
          </div>

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
              Activities & Involvement <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              value={currentEd.activities}
              onChange={(e) => setCurrentEd({ ...currentEd, activities: e.target.value })}
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500"
              rows="2"
              placeholder="Clubs, organizations, volunteer work, leadership roles..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Honors & Awards <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              value={currentEd.honors}
              onChange={(e) => setCurrentEd({ ...currentEd, honors: e.target.value })}
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500"
              rows="2"
              placeholder="Dean's List, scholarships, academic awards, competitions..."
            />
          </div>

          <button
            onClick={addEducation}
            disabled={!currentEd.degree || !currentEd.school || !currentEd.graduationDate}
            className="w-full border-2 border-purple-600 text-purple-600 py-3 rounded-lg hover:bg-purple-50 disabled:border-gray-300 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
          >
            + Add This Degree
          </button>
        </div>
      </div>

      <div className="mt-8 flex justify-between">
        <button
          onClick={() => setStep(2)}
          className="text-gray-600 hover:text-gray-800 font-medium"
        >
          ← Back
        </button>
        <button
          onClick={() => setStep(4)}
          disabled={formData.education.length === 0}
          className="bg-purple-600 text-white px-8 py-3 rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
        >
          Next: Skills →
        </button>
      </div>
    </div>
  )
}

// ============= STEP 4: SKILLS =============
if (step === 4) {
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

  const commonSkills = [
    'Communication', 'Leadership', 'Microsoft Excel', 'Project Management',
    'Customer Service', 'Problem Solving', 'Time Management', 'Teamwork',
    'Public Speaking', 'Writing', 'Data Analysis', 'Social Media',
    'Microsoft Office', 'Sales', 'Marketing', 'Budgeting'
  ]

  const handleFinish = async () => {
  await saveResumeData(formData, supabase, router)
}

  return (
    <div className="max-w-2xl mx-auto p-8 min-h-screen">
      <div className="mb-6">
        <div className="flex justify-between mb-2">
          <span className="text-sm text-purple-600 font-medium">Step 4 of 4</span>
          <span className="text-sm text-gray-500">Skills</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className="bg-purple-600 h-2 rounded-full" style={{ width: '100%' }}></div>
        </div>
      </div>

      <h2 className="text-2xl font-bold mb-2">🛠️ Your Skills</h2>
      <p className="text-gray-600 mb-6">Add the skills that make you stand out</p>

      <div className="mb-6">
        <label className="block text-sm font-medium mb-1">
          Add skills (press Enter after each):
        </label>
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
        <div className="mb-6">
          <h3 className="text-sm font-medium mb-2">Skills you've added:</h3>
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

      <div className="mb-8">
        <h3 className="text-sm font-medium mb-2">Or choose from common skills:</h3>
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

      <div className="mt-8 flex justify-between">
        <button
          onClick={() => setStep(3)}
          className="text-gray-600 hover:text-gray-800 font-medium"
        >
          ← Back
        </button>
        <button
          onClick={handleFinish}
          disabled={formData.skills.length === 0}
          className="bg-purple-600 text-white px-8 py-3 rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
        >
          Finish & Start Coaching 🚀
        </button>
      </div>
    </div>
  )
}

// If no step matches, show error
return (
  <div className="max-w-2xl mx-auto p-8">
    <p className="text-red-600">Something went wrong. Please refresh the page.</p>
  </div>
)
}