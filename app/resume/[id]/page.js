'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function ResumePage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  
  const [resume, setResume] = useState(null)
  const [loading, setLoading] = useState(true)
  const [userProfile, setUserProfile] = useState(null)
  const [history, setHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  
  // Toolbar states
  const [selectedTemplate, setSelectedTemplate] = useState('modern')
  const [selectedFont, setSelectedFont] = useState('Calibri')
  const [selectedSize, setSelectedSize] = useState(11)
  const [zoom, setZoom] = useState(100)

  useEffect(() => {
    loadResume()
    loadUserProfile()
  }, [params.id])

  async function loadResume() {
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

    if (error) {
      console.error('Error loading resume:', error)
      router.push('/my-resumes')
      return
    }

    setResume(data)
    setSelectedTemplate(data.template_id || 'modern')
    setSelectedFont(data.font_family || 'Calibri')
    setSelectedSize(data.font_size || 11)
    
    // Initialize history
    const initialData = JSON.parse(JSON.stringify(data.resume_data || {}))
    setHistory([initialData])
    setHistoryIndex(0)
    
    setLoading(false)
  }

  async function loadUserProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    setUserProfile(data)
  }

  function updateResumeData(newResumeData) {
    // Deep clone to avoid reference issues
    const clonedData = JSON.parse(JSON.stringify(newResumeData))
    
    // Add to history for undo
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(clonedData)
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
    
    setResume({ ...resume, resume_data: clonedData })
    setHasUnsavedChanges(true)
  }

  function undo() {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      setResume({ ...resume, resume_data: JSON.parse(JSON.stringify(history[newIndex])) })
      setHasUnsavedChanges(true)
    }
  }

  async function save() {
    const { error } = await supabase
      .from('resumes')
      .update({ 
        resume_data: resume.resume_data,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)

    if (error) {
      console.error('Error saving:', error)
      return
    }

    setHasUnsavedChanges(false)
    setSaveSuccess(true)
    
    // Hide success message after 2 seconds
    setTimeout(() => setSaveSuccess(false), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading resume...</p>
        </div>
      </div>
    )
  }

  if (!resume) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Resume not found</p>
          <button
            onClick={() => router.push('/my-resumes')}
            className="mt-4 text-purple-600 hover:text-purple-700"
          >
            ← Back to My Resumes
          </button>
        </div>
      </div>
    )
  }

  const resumeData = resume.resume_data || {}
  const journeyStep = resume.journey_step || 'start'
  const score = resume.current_score || null

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Main Navigation Header - STICKY */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="px-6 py-2 flex items-center justify-between">
          {/* Logo + Tagline */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="flex items-center gap-2"
            >
              <img 
                src="/images/HirePower_logo.png" 
                alt="Hire Power" 
                className="h-8 w-auto"
              />
            </button>
            <span className="text-xs text-gray-500 border-l border-gray-300 pl-3">
              AI-powered career coaching for people who want more than their next job
            </span>
          </div>

          {/* Right Side: Nav + Profile */}
          <div className="flex items-center gap-6">
            <nav className="flex items-center gap-6">
              <button
                onClick={() => router.push('/career-coach')}
                className="text-sm text-gray-600 hover:text-purple-600"
              >
                Career Coach
              </button>
              <span className="text-sm text-purple-600 font-semibold border-b-2 border-purple-600 pb-1">
                Resume Coach
              </span>
              <button className="text-sm text-gray-400 cursor-not-allowed">
                Interview Coach
              </button>
            </nav>

            {/* Profile */}
            <button
              onClick={() => router.push('/profile')}
              className="flex items-center gap-2 text-gray-700 hover:text-purple-600"
            >
              {userProfile?.photo_url ? (
                <img
                  src={userProfile.photo_url}
                  alt="Profile"
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-sm">
                  {userProfile?.display_name?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Breadcrumb - STICKY */}
      <div className="bg-white border-b border-gray-200 sticky top-[52px] z-40">
        <div className="px-6 py-1.5 flex items-center text-xs">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-gray-600 hover:text-purple-600"
          >
            Dashboard
          </button>
          <span className="mx-2 text-gray-400">|</span>
          <button
            onClick={() => router.push('/my-resumes')}
            className="text-gray-600 hover:text-purple-600"
          >
            My Resumes
          </button>
          <span className="mx-2 text-gray-400">|</span>
          <span className="text-purple-600 font-semibold">
            {resume.display_name || 'Core Resume'}
          </span>
        </div>
      </div>

     {/* Toolbar - STICKY */}
      <div className="bg-white border-b border-gray-200 sticky top-[80px] z-30">
        <div className="px-6 py-1.5 flex items-center gap-2 text-xs">
          <span className="text-gray-700 font-medium mr-2">Formatting Tools:</span>
          
          {/* Template */}
          <div className="flex items-center gap-1 bg-purple-100 px-2 py-1 rounded">
            <span>📄</span>
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              className="bg-transparent border-none text-xs focus:outline-none cursor-pointer"
            >
              <option value="modern">Modern</option>
              <option value="classic">Classic</option>
            </select>
          </div>

          {/* Font */}
          <div className="flex items-center gap-1 bg-purple-100 px-2 py-1 rounded">
            <span className="font-bold">A</span>
            <select
              value={selectedFont}
              onChange={(e) => setSelectedFont(e.target.value)}
              className="bg-transparent border-none text-xs focus:outline-none cursor-pointer"
            >
              <option value="Calibri">Calibri</option>
              <option value="Arial">Arial</option>
              <option value="Times New Roman">Times New Roman</option>
              <option value="Georgia">Georgia</option>
              <option value="Helvetica">Helvetica</option>
            </select>
          </div>

          {/* Size */}
          <div className="flex items-center gap-1 bg-purple-100 px-2 py-1 rounded">
            <span>⚙️</span>
            <select
              value={selectedSize}
              onChange={(e) => setSelectedSize(Number(e.target.value))}
              className="bg-transparent border-none text-xs focus:outline-none cursor-pointer"
            >
              {[10, 11, 12, 13, 14].map(size => (
                <option key={size} value={size}>{size}pt</option>
              ))}
            </select>
          </div>

          {/* Zoom */}
          <div className="flex items-center gap-1 bg-purple-100 px-2 py-1 rounded">
            <span>🔍</span>
            <select
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="bg-transparent border-none text-xs focus:outline-none cursor-pointer"
            >
              <option value={75}>75%</option>
              <option value={100}>100%</option>
              <option value={125}>125%</option>
              <option value={150}>150%</option>
            </select>
          </div>

          {/* DIVIDER */}
          <div className="h-6 w-px bg-gray-300 mx-2" />

          {/* Undo */}
          <button
            onClick={undo}
            disabled={historyIndex <= 0}
            className={`px-3 py-1 rounded text-xs font-medium transition-all ${
              historyIndex <= 0
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-purple-100 hover:bg-purple-200'
            }`}
          >
            ↶ Undo
          </button>

          {/* Save */}
          <button
            onClick={save}
            className={`px-3 py-1 rounded text-xs font-medium transition-all ${
              saveSuccess
                ? 'bg-green-600 text-white'
                : hasUnsavedChanges
                ? 'bg-purple-600 text-white hover:bg-purple-700'
                : 'bg-gray-300 text-gray-600'
            }`}
          >
            {saveSuccess ? '✓ Saved!' : hasUnsavedChanges ? '💾 Save' : 'No Changes'}
          </button>

          <div className="flex-1" />

          {/* Score */}
          {score && (
            <div className={`
              px-3 py-1 rounded font-semibold text-xs
              ${score >= 80 ? 'bg-green-100 text-green-700' : 
                score >= 60 ? 'bg-yellow-100 text-yellow-700' : 
                'bg-red-100 text-red-700'}
            `}>
              📊 {score}/100
            </div>
          )}

          {/* Re-assess */}
          <button className="px-3 py-1 border border-gray-300 rounded text-xs hover:bg-gray-50">
            Re-assess
          </button>

          {/* Preview */}
          <button className="px-3 py-1 border border-gray-300 rounded text-xs hover:bg-gray-50">
            Preview
          </button>

          {/* Download */}
          <button className="px-3 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 font-medium">
            Download
          </button>
        </div>
      </div>

      {/* Main Content: Resume + Right Panel */}
      <div className="flex-1 flex">
        <div className="flex-1 flex gap-6 p-6 max-w-7xl mx-auto w-full overflow-hidden">
          {/* Resume (70-75%) */}
          <div className="flex-[3] bg-white rounded-lg shadow-sm border border-gray-200 overflow-auto">
            <div 
              className="p-8"
              style={{ 
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'top left',
                fontFamily: selectedFont,
                fontSize: `${selectedSize}pt`
              }}
            >
              <ResumeContent 
                resumeData={resumeData} 
                onUpdate={updateResumeData}
              />
            </div>
          </div>

          {/* Right Panel (25-30%) */}
          <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 p-6 overflow-y-auto">
            <RightPanel 
              journeyStep={journeyStep}
              score={score}
              userTier={userProfile?.subscription_tier || 'free'}
              resumeName={resume.display_name || 'Core Resume'}
              userName={userProfile?.display_name || resumeData.fullName}
            />
          </div>
        </div>
      </div>

   
    </div>
  )
}
// Resume Content Component
function ResumeContent({ resumeData, onUpdate }) {
  
  function addExperienceSummary(jobIndex) {
    const newData = JSON.parse(JSON.stringify(resumeData))
    if (!newData.experience[jobIndex]) return
    newData.experience[jobIndex].summary = 'Add summary paragraph here...'
    onUpdate(newData)
  }

  function removeExperienceSummary(jobIndex) {
    const newData = JSON.parse(JSON.stringify(resumeData))
    delete newData.experience[jobIndex].summary
    onUpdate(newData)
  }

  function addExperienceBullet(jobIndex) {
    const newData = JSON.parse(JSON.stringify(resumeData))
    if (!newData.experience[jobIndex].bullets) {
      newData.experience[jobIndex].bullets = []
    }
    newData.experience[jobIndex].bullets.push('New bullet point')
    onUpdate(newData)
  }

  function deleteExperienceBullet(jobIndex, bulletIndex) {
    const newData = JSON.parse(JSON.stringify(resumeData))
    newData.experience[jobIndex].bullets.splice(bulletIndex, 1)
    onUpdate(newData)
  }

  function addEducationLine(eduIndex) {
    const newData = JSON.parse(JSON.stringify(resumeData))
    if (!newData.education[eduIndex].lines) {
      newData.education[eduIndex].lines = []
    }
    newData.education[eduIndex].lines.push('New line')
    onUpdate(newData)
  }

  function deleteEducationLine(eduIndex, lineIndex) {
    const newData = JSON.parse(JSON.stringify(resumeData))
    newData.education[eduIndex].lines.splice(lineIndex, 1)
    onUpdate(newData)
  }

  function addSkill(category) {
    const newData = JSON.parse(JSON.stringify(resumeData))
    if (!newData.skillsCategories) {
      newData.skillsCategories = {}
    }
    if (!newData.skillsCategories[category]) {
      newData.skillsCategories[category] = []
    }
    newData.skillsCategories[category].push('New Skill')
    onUpdate(newData)
  }

  function deleteSkill(category, index) {
    const newData = JSON.parse(JSON.stringify(resumeData))
    newData.skillsCategories[category].splice(index, 1)
    onUpdate(newData)
  }

  function updateField(field, value) {
    const newData = { ...resumeData, [field]: value }
    onUpdate(newData)
  }

  function updateNestedField(path, value) {
    const newData = JSON.parse(JSON.stringify(resumeData))
    const keys = path.split('.')
    let current = newData
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i]
      const arrayMatch = key.match(/(\w+)\[(\d+)\]/)
      
      if (arrayMatch) {
        const [, arrayName, index] = arrayMatch
        current = current[arrayName][parseInt(index)]
      } else {
        current = current[key]
      }
    }
    
    const lastKey = keys[keys.length - 1]
    current[lastKey] = value
    onUpdate(newData)
  }

  return (
    <>
      {/* Contact */}
      <div className="text-center mb-6 p-2 rounded">
        <h1 
          className="text-2xl font-bold cursor-text hover:bg-purple-50 p-1 rounded"
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => updateField('fullName', e.currentTarget.textContent)}
        >
          {resumeData.fullName || 'Your Name'}
        </h1>
        <p 
          className="text-sm text-gray-600 mt-1 cursor-text hover:bg-purple-50 p-1 rounded"
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => {
            const parts = e.currentTarget.textContent.split('|').map(p => p.trim())
            const newData = {
              ...resumeData,
              location: parts[0] || '',
              phone: parts[1] || '',
              email: parts[2] || '',
              linkedin: parts[3] || ''
            }
            onUpdate(newData)
          }}
        >
          {[resumeData.location, resumeData.phone, resumeData.email, resumeData.linkedin].filter(Boolean).join(' | ') || 'Contact Info'}
        </p>
      </div>

      {/* Summary */}
      {resumeData.summary && (
        <div className="mb-6 p-2 rounded">
          <h2 className="text-lg font-semibold border-b border-gray-300 pb-1 mb-2">SUMMARY</h2>
          <p 
            className="text-sm cursor-text hover:bg-purple-50 p-1 rounded"
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => updateField('summary', e.currentTarget.textContent)}
          >
            {resumeData.summary}
          </p>
        </div>
      )}

      {/* Experience */}
      {resumeData.experience && resumeData.experience.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold border-b border-gray-300 pb-1 mb-3">EXPERIENCE</h2>
          {resumeData.experience.map((job, jobIndex) => (
            <div key={jobIndex} className="mb-4 p-2 rounded hover:bg-purple-50 group">
              <div className="flex justify-between items-start mb-1">
                <h3 
                  className="font-semibold cursor-text"
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => updateNestedField(`experience[${jobIndex}].title`, e.currentTarget.textContent)}
                >
                  {job.title || 'Job Title'}
                </h3>
                <span className="text-sm text-gray-600">{job.startDate} - {job.current ? 'Present' : job.endDate}</span>
              </div>
              <p 
                className="text-sm font-medium text-gray-700 mb-2 cursor-text"
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => updateNestedField(`experience[${jobIndex}].company`, e.currentTarget.textContent)}
              >
                {job.company}
              </p>
              
              {/* Summary paragraph */}
              {job.summary ? (
                <div className="group/summary mb-2">
                  <p 
                    className="text-sm text-gray-700 cursor-text italic"
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => updateNestedField(`experience[${jobIndex}].summary`, e.currentTarget.textContent)}
                  >
                    {job.summary}
                  </p>
                  <button
                    onClick={() => removeExperienceSummary(jobIndex)}
                    className="text-red-500 text-xs mt-1 opacity-0 group-hover/summary:opacity-100"
                  >
                    Remove Summary
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => addExperienceSummary(jobIndex)}
                  className="text-purple-600 text-xs mb-2 opacity-0 group-hover:opacity-100"
                >
                  + Add Summary Paragraph
                </button>
              )}

              {/* Bullets */}
              {job.bullets && job.bullets.length > 0 && job.bullets.map((bullet, bulletIndex) => (
                <div key={bulletIndex} className="flex items-start gap-2 mb-1 group/bullet">
                  <span className="text-sm">•</span>
                  <p 
                    className="text-sm flex-1 cursor-text"
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => updateNestedField(`experience[${jobIndex}].bullets[${bulletIndex}]`, e.currentTarget.textContent)}
                  >
                    {bullet}
                  </p>
                  <button
                    onClick={() => deleteExperienceBullet(jobIndex, bulletIndex)}
                    className="text-red-500 opacity-0 group-hover/bullet:opacity-100 text-xs"
                  >
                    ×
                  </button>
                </div>
              ))}

              <button
                onClick={() => addExperienceBullet(jobIndex)}
                className="text-purple-600 text-xs mt-2 opacity-0 group-hover:opacity-100"
              >
                + Add Bullet
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Education */}
      {resumeData.education && resumeData.education.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold border-b border-gray-300 pb-1 mb-3">EDUCATION</h2>
          {resumeData.education.map((edu, eduIndex) => (
            <div key={eduIndex} className="mb-3 p-2 rounded hover:bg-purple-50 group">
              <h3 
                className="font-semibold cursor-text mb-1"
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => updateNestedField(`education[${eduIndex}].school`, e.currentTarget.textContent)}
              >
                {edu.school}
              </h3>
              
              {/* Flexible lines */}
              {edu.lines && edu.lines.map((line, lineIndex) => (
                <div key={lineIndex} className="flex items-start gap-2 group/line">
                  <p 
                    className="text-sm font-medium text-gray-700 flex-1 cursor-text"
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => updateNestedField(`education[${eduIndex}].lines[${lineIndex}]`, e.currentTarget.textContent)}
                  >
                    {line}
                  </p>
                  <button
                    onClick={() => deleteEducationLine(eduIndex, lineIndex)}
                    className="text-red-500 opacity-0 group-hover/line:opacity-100 text-xs"
                  >
                    ×
                  </button>
                </div>
              ))}

              <button
                onClick={() => addEducationLine(eduIndex)}
                className="text-purple-600 text-xs mt-1 opacity-0 group-hover:opacity-100"
              >
                + Add Line
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Skills */}
      {resumeData.skillsCategories && Object.keys(resumeData.skillsCategories).length > 0 && (
        <div className="mb-6 p-2 rounded hover:bg-purple-50">
          <h2 className="text-lg font-semibold border-b border-gray-300 pb-1 mb-2">SKILLS</h2>
          
          {Object.entries(resumeData.skillsCategories).map(([category, skills]) => (
            <div key={category} className="mb-3 group/category">
              <p className="text-sm font-semibold mb-1">{category}</p>
              <div className="flex flex-wrap gap-2">
                {Array.isArray(skills) && skills.map((skill, index) => (
                  <div key={index} className="flex items-center gap-1 group/skill">
                    <span 
                      className="text-sm cursor-text hover:bg-purple-100 px-1 rounded"
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) => {
                        const newData = JSON.parse(JSON.stringify(resumeData))
                        newData.skillsCategories[category][index] = e.currentTarget.textContent
                        onUpdate(newData)
                      }}
                    >
                      {skill}
                    </span>
                    {index < skills.length - 1 && <span className="text-gray-400">•</span>}
                    <button
                      onClick={() => deleteSkill(category, index)}
                      className="text-red-500 opacity-0 group-hover/skill:opacity-100 text-xs"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => addSkill(category)}
                  className="text-purple-600 text-xs opacity-0 group-hover/category:opacity-100"
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Placeholder */}
      {(!resumeData.experience || resumeData.experience.length === 0) && (
        <div className="text-center text-gray-400 py-12">
          <p>Resume content will appear here</p>
          <p className="text-sm mt-2">Click to edit</p>
        </div>
      )}
    </>
  )
}

// Right Panel Component
function RightPanel({ journeyStep, score, userTier, resumeName, userName }) {
  const steps = ['review', 'assess', 'coach', 'improve', 'polish', 'save']
  const currentIndex = steps.indexOf(journeyStep)

  return (
    <div>
      {/* Progress Bar */}
      <div className="mb-6 pb-4 border-b border-gray-200">
        <h3 className="text-center font-semibold text-sm mb-3">
          {userName ? `${userName.split(' ')[0]}'s ` : ''}{resumeName} Progress
        </h3>
        
        <div className="relative">
          {/* Line */}
          <div className="absolute top-3 left-0 right-0 h-0.5 bg-gray-300">
            <div 
              className="h-full bg-purple-600 transition-all duration-300"
              style={{ width: `${currentIndex >= 0 ? (currentIndex / (steps.length - 1)) * 100 : 0}%` }}
            />
          </div>
          
          {/* Steps */}
          <div className="relative flex justify-between">
            {steps.map((step, index) => (
              <div key={step} className="flex flex-col items-center">
                <div className={`
                  w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold z-10
                  ${index < currentIndex ? 'bg-purple-600 text-white' : 
                    index === currentIndex ? 'bg-purple-600 text-white' : 
                    'bg-white border-2 border-gray-300 text-gray-400'}
                `}>
                  {index < currentIndex ? '✓' : index === currentIndex ? '●' : '○'}
                </div>
                <span className={`text-xs mt-1 capitalize ${
                  index === currentIndex ? 'text-purple-600 font-semibold' :
                  index < currentIndex ? 'text-purple-600' :
                  'text-gray-400'
                }`}>
                  {step}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content based on step */}
      {journeyStep === 'review' && (
        <>
          <h3 className="font-semibold text-lg mb-3">📝 Review Your Resume</h3>
          <p className="text-sm text-gray-700 mb-4">
            We've structured your uploaded resume. Please review for accuracy:
          </p>
          <div className="bg-purple-50 border-l-4 border-purple-500 p-3 mb-4">
            <p className="text-xs text-purple-900 space-y-1">
              <strong>✓ Check contact info</strong><br/>
              <strong>✓ Verify job titles and dates</strong><br/>
              <strong>✓ Review bullet points</strong><br/>
              <strong>✓ Confirm education details</strong>
            </p>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Click any text to edit. Use + buttons to add bullets or sections. When everything looks good, we'll assess your resume.
          </p>
          <button className="w-full bg-purple-600 text-white rounded py-2 font-medium hover:bg-purple-700">
            Looks Good → Assess Resume
          </button>
        </>
      )}

      {(journeyStep === 'start' || currentIndex < 0) && (
        <>
          <h3 className="font-semibold text-lg mb-3">✅ Resume Loaded!</h3>
          <p className="text-sm text-gray-700 mb-4">
            Next: Review the structure and make sure everything parsed correctly.
          </p>
          <p className="text-sm text-gray-600 mb-6">
            Click on any text to edit directly. Use + buttons to add bullets or sections.
          </p>
          <button className="w-full bg-purple-600 text-white rounded py-2 font-medium hover:bg-purple-700">
            Assess Resume →
          </button>
        </>
      )}

      {journeyStep === 'assess' && (
        <>
          <h3 className="font-semibold text-lg mb-3">Assessment Complete</h3>
          <div className="bg-gray-100 rounded p-4 mb-4">
            <p className="text-3xl font-bold text-center">{score || 62}/100</p>
          </div>
          <p className="text-sm text-gray-700 mb-4">Breakdown:</p>
          <ul className="text-sm text-gray-600 space-y-1 mb-6">
            <li>• Impact: 20/40</li>
            <li>• Clarity: 28/40</li>
            <li>• Keywords: 14/20</li>
          </ul>
          <p className="text-sm font-medium mb-4">Let's improve this!</p>
          <button className="w-full bg-purple-600 text-white rounded py-2 font-medium hover:bg-purple-700">
            Start Coaching →
          </button>
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500">💡 Baseline: {score || 62}/100</p>
          </div>
        </>
      )}

     {journeyStep !== 'start' && journeyStep !== 'review' && journeyStep !== 'assess' && currentIndex >= 0 && (
        <>
          <h3 className="font-semibold text-lg mb-3">Resume Coach</h3>
          <p className="text-sm text-gray-600">
            Context-aware guidance will appear here based on your current step.
          </p>
        </>
      )}
    </div>
  )
}