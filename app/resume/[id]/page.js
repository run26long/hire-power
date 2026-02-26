'use client'

import { useEffect, useState, useRef } from 'react'
import ReactDOM from 'react-dom/client'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

const styles = `
  [contenteditable][data-placeholder]:empty:before {
    content: attr(data-placeholder);
    color: #9ca3af;
    font-style: italic;
  }
`

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
 const [showPreview, setShowPreview] = useState(false)
 const [isDownloading, setIsDownloading] = useState(false)

  // Analysis state
  const [analysisResults, setAnalysisResults] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
const [detectedLevel, setDetectedLevel] = useState('entry')

  // Use ref for undo flag - synchronous, no timing issues
  const isUndoingRef = useRef(false)
  
  // Toolbar states
  const [selectedTemplate, setSelectedTemplate] = useState('modern')
  const [selectedFont, setSelectedFont] = useState('Calibri')
  const [selectedSize, setSelectedSize] = useState(11)
  const [zoom, setZoom] = useState(100)
const [dateFormat, setDateFormat] = useState('short')

const handleDownload = async () => {
  setIsDownloading(true)
  try {
    
    const { data: { user } } = await supabase.auth.getUser()
    
    // Convert font size number to API format
    let fontSizeForApi = 'medium'
    if (selectedSize <= 10) fontSizeForApi = 'small'
    else if (selectedSize === 11) fontSizeForApi = 'medium'
    else if (selectedSize >= 12) fontSizeForApi = 'large'
    
    // Capitalize template name for API
    const templateForApi = selectedTemplate.charAt(0).toUpperCase() + selectedTemplate.slice(1)
    
    const response = await fetch('/api/generate-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        resumeData: resume,
        templateName: templateForApi,
        fontSize: fontSizeForApi,
        action: 'download',
        versionId: null,
        isJobVersion: false,
        userId: user.id
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('API Error:', errorData)
      throw new Error('PDF generation failed')
    }

    const result = await response.json()
    
    // Fetch PDF as blob to force download
    const pdfResponse = await fetch(result.pdfUrl)
    const blob = await pdfResponse.blob()
    const blobUrl = window.URL.createObjectURL(blob)
    
    // Trigger download
    const a = document.createElement('a')
    a.href = blobUrl
   // Set filename and trigger download
a.download = `${(resume.resume_data?.fullName || 'Resume').replace(/\s+/g, '_')}_Resume.pdf`
document.body.appendChild(a)
a.click()
document.body.removeChild(a)
// Clean up blob URL
    window.URL.revokeObjectURL(blobUrl)
    
 } catch (error) {
    console.error('Error downloading PDF:', error)
    alert('Failed to generate PDF. Please try again.')
  } finally {
    setIsDownloading(false)
  }
}

const handleReassess = async () => {
  setIsAnalyzing(true)
  try {
    const response = await fetch('/api/analyze-resume', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
     body: JSON.stringify({
        resumeData: resume.resume_data,
             })
    })

    if (!response.ok) {
      throw new Error('Analysis failed')
    }

    const result = await response.json()
 
    // Store analysis results
    setAnalysisResults(result)
setDetectedLevel(result.detectedLevel || 'entry')
    
    // Update resume score in database
    // Update database with score and journey step if first assessment
    const updateData = {
      current_score: result.score,
      last_assessed_at: new Date().toISOString(),
    }
    
    // If coming from review, also update journey_step
    if (resume.journey_step === 'review') {
      updateData.journey_step = 'assess'
    }
    
    const { error } = await supabase
      .from('resumes')
      .update(updateData)
      .eq('id', params.id)

  if (error) {
      console.error('Error saving score:', error.message)
    }
    
  // Update local resume state and journey step if this is first assessment
    setResume(prev => ({
      ...prev,
      current_score: result.score,
      journey_step: prev.journey_step === 'review' ? 'assess' : prev.journey_step
    }))
    
  } catch (error) {
    console.error('Error analyzing resume:', error)
    alert('Failed to analyze resume. Please try again.')
  } finally {
    setIsAnalyzing(false)
  }
}
function formatDate(dateString, format = dateFormat) {
    if (!dateString) return ''
    
    const [year, month] = dateString.split('-')
    if (!year || !month) return dateString
    
    const monthNum = parseInt(month)
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December']
    
    switch(format) {
      case 'short':
        return `${monthNum}/${year}` // 9/2022
      case 'full':
        return `${monthNames[monthNum - 1]} ${year}` // September 2022
      case 'year':
        return year // 2022
      default:
        return `${monthNum}/${year}`
    }
  }
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
    setAnalysisResults(null)  // Clear stale analysis results
    setSelectedTemplate(data.template_id || 'modern')
    setSelectedFont(data.font_family || 'Calibri')
    setSelectedSize(data.font_size || 11)
    setDateFormat(data.date_format || 'short')
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
    // Skip if undoing
    if (isUndoingRef.current) return
    
    // Deep clone to avoid reference issues
    const clonedData = JSON.parse(JSON.stringify(newResumeData))
    
    // Add to history
    setHistory(prevHistory => {
      const newHistory = prevHistory.slice(0, historyIndex + 1)
      newHistory.push(clonedData)
      return newHistory
    })
    
    setHistoryIndex(prevIndex => prevIndex + 1)
    
    setResume(prevResume => ({ 
      ...prevResume, 
      resume_data: clonedData 
    }))
    
    setHasUnsavedChanges(true)
  }

  function undo() {
    if (historyIndex > 0) {
      isUndoingRef.current = true
      
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      setResume(prev => ({ 
        ...prev, 
        resume_data: JSON.parse(JSON.stringify(history[newIndex])) 
      }))
      setHasUnsavedChanges(true)
      
      // Clear flag after render
      requestAnimationFrame(() => {
        isUndoingRef.current = false
      })
    }
  }

  async function save() {
    const { error } = await supabase
      .from('resumes')
      .update({ 
        resume_data: resume.resume_data,
        template_id: selectedTemplate,
        font_family: selectedFont,
        font_size: selectedSize,
        date_format: dateFormat,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)

    if (error) {
      console.error('Error saving:', error)
      return
    }

    setHasUnsavedChanges(false)
    setSaveSuccess(true)
    
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
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
     <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
        {/* Main Navigation Header - STICKY */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="px-6 py-2 flex items-center justify-between">
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
              AI-powered career coaching for people seeking more than their next job
            </span>
          </div>

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
          <span className="text-purple-600 font-semibold border-b-2 border-purple-600 pb-0.5">
            {resume.display_name || 'Core Resume'}
          </span>
        </div>
      </div>

      {/* Toolbar - STICKY */}
      <div className="bg-white border-b border-gray-200 sticky top-[80px] z-30">
        <div className="px-6 py-1.5 flex items-center gap-2 text-xs">
          <span className="text-gray-700 font-medium mr-2">Formatting Tools:</span>
          
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
<div className="flex items-center gap-1 bg-purple-100 px-2 py-1 rounded">
              <span>📅</span>
              <select
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value)}
                className="bg-transparent border-none text-xs focus:outline-none cursor-pointer"
              >
                <option value="short">MM/YYYY</option>
                <option value="full">Month YYYY</option>
                <option value="year">YYYY</option>
              </select>
            </div>
          <div className="h-6 w-px bg-gray-300 mx-2" />

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

     <button 
            onClick={handleReassess}
            disabled={isAnalyzing || journeyStep === 'review'}
            className={`px-3 py-1 border border-gray-300 rounded text-xs flex items-center gap-1 ${
              isAnalyzing || journeyStep === 'review' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'
            }`}
            title={journeyStep === 'review' ? 'Run initial assessment first' : ''}
          >
            {isAnalyzing && journeyStep !== 'review' && (
              <div className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>
            )}
            {isAnalyzing && journeyStep !== 'review' ? 'Analyzing...' : 'Re-assess'}
          </button>

         <button 
              onClick={() => setShowPreview(true)}
              className="px-3 py-1 border border-gray-300 rounded text-xs hover:bg-gray-50"
            >
              Preview
            </button>

          <button 
  onClick={handleDownload}
  disabled={isDownloading}
  className={`px-3 py-1 rounded text-xs font-medium flex items-center gap-1 ${
    isDownloading 
      ? 'bg-gray-400 cursor-not-allowed' 
      : 'bg-purple-600 hover:bg-purple-700 text-white'
  }`}
>
  {isDownloading && (
    <div className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>
  )}
  {isDownloading ? 'Generating...' : 'Download'}
</button>
        </div>
      </div>

    {/* Main Content: Resume + Right Panel */}
      <div className="flex-1 flex overflow-hidden" style={{ height: 'calc(100vh - 160px)' }}>
        <div className="flex-1 flex gap-6 p-6 max-w-7xl mx-auto w-full">
          <div className="flex-[3] bg-white rounded-lg shadow-sm border border-gray-200 overflow-y-auto">
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
                  isUndoingRef={isUndoingRef}
                  formatDate={formatDate}
                />
            </div>
          </div>

          <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 p-6 overflow-y-auto">
       <RightPanel 
              journeyStep={journeyStep}
              score={score}
              analysisResults={analysisResults}
              userTier={userProfile?.subscription_tier || 'free'}
              resumeName={resume.display_name || 'Core Resume'}
              userName={userProfile?.display_name || resumeData.fullName}
              supabase={supabase}
              params={params}
              setResume={setResume}
              handleReassess={handleReassess}
              isAnalyzing={isAnalyzing}
              detectedLevel={detectedLevel}
            />
          </div>
        </div>
      </div>
      </div>
      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-8">
          <div className="bg-white rounded-lg w-full max-w-4xl h-full max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Resume Preview</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-auto p-8 bg-gray-50">
              <div 
                className="bg-white p-8 shadow-lg mx-auto"
                style={{ 
                  maxWidth: '8.5in',
                  fontFamily: selectedFont,
                  fontSize: `${selectedSize}pt`
                }}
              >
               <ResumeContent 
                  resumeData={resumeData} 
                  onUpdate={() => {}} 
                  isUndoingRef={isUndoingRef}
                  formatDate={formatDate}
                  readOnly={true}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// Resume Content Component
function ResumeContent({ resumeData, onUpdate, isUndoingRef, formatDate, readOnly = false }) {
  const [confirmingDelete, setConfirmingDelete] = useState(null)
  
  function addExperienceSummary(jobIndex) {
    const newData = JSON.parse(JSON.stringify(resumeData))
    if (!newData.experience[jobIndex]) return
    newData.experience[jobIndex].summary = ' ' // Space so it's truthy
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

  function moveExperienceBulletUp(jobIndex, bulletIndex) {
    if (bulletIndex === 0) return
    const newData = JSON.parse(JSON.stringify(resumeData))
    const bullets = newData.experience[jobIndex].bullets
    const temp = bullets[bulletIndex]
    bullets[bulletIndex] = bullets[bulletIndex - 1]
    bullets[bulletIndex - 1] = temp
    onUpdate(newData)
  }

  function moveExperienceBulletDown(jobIndex, bulletIndex) {
    const newData = JSON.parse(JSON.stringify(resumeData))
    const bullets = newData.experience[jobIndex].bullets
    if (bulletIndex === bullets.length - 1) return
    const temp = bullets[bulletIndex]
    bullets[bulletIndex] = bullets[bulletIndex + 1]
    bullets[bulletIndex + 1] = temp
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
  function renameSkillCategory(oldName, newName) {
    if (!newName.trim() || oldName === newName) return
    const newData = JSON.parse(JSON.stringify(resumeData))
    newData.skillsCategories[newName] = newData.skillsCategories[oldName]
    delete newData.skillsCategories[oldName]
    onUpdate(newData)
  }

 function deleteSkillCategory(category) {
    const newData = JSON.parse(JSON.stringify(resumeData))
    const skillsToMerge = newData.skillsCategories[category]
    const categories = Object.keys(newData.skillsCategories)
    
    if (categories.length === 1) return // Can't delete last category
    
    // Find first remaining category
    const targetCategory = categories.find(cat => cat !== category)
    
    // Merge skills into that category
    newData.skillsCategories[targetCategory] = [
      ...newData.skillsCategories[targetCategory], 
      ...skillsToMerge
    ]
    
    delete newData.skillsCategories[category]
    onUpdate(newData)
  }

  function addSkillCategory() {
    const newData = JSON.parse(JSON.stringify(resumeData))
    if (!newData.skillsCategories) {
      newData.skillsCategories = {}
    }
    newData.skillsCategories['New Category'] = []
    onUpdate(newData)
  }
  function flattenSkills() {
    const newData = JSON.parse(JSON.stringify(resumeData))
    const allSkills = []
    Object.values(newData.skillsCategories).forEach(skills => {
      allSkills.push(...skills)
    })
    newData.skillsCategories = { "Skills": allSkills }
    onUpdate(newData)
  }
function addProject() {
    const newData = JSON.parse(JSON.stringify(resumeData))
    if (!newData.projects) {
      newData.projects = []
    }
    newData.projects.push({
      name: 'New Project',
      description: 'Project description',
      link: ''
    })
    onUpdate(newData)
  }

  function deleteProject(projectIndex) {
    const newData = JSON.parse(JSON.stringify(resumeData))
    newData.projects.splice(projectIndex, 1)
    onUpdate(newData)
  }

  function addCertification() {
    const newData = JSON.parse(JSON.stringify(resumeData))
    if (!newData.certifications) {
      newData.certifications = []
    }
    newData.certifications.push({
      name: 'New Certification',
      details: 'Issuing organization | Date'
    })
    onUpdate(newData)
  }

  function deleteCertification(certIndex) {
    const newData = JSON.parse(JSON.stringify(resumeData))
    newData.certifications.splice(certIndex, 1)
    onUpdate(newData)
  }

  function addVolunteer() {
    const newData = JSON.parse(JSON.stringify(resumeData))
    if (!newData.volunteer) {
      newData.volunteer = []
    }
    newData.volunteer.push({
      organization: 'Organization Name',
      description: 'Role and responsibilities'
    })
    onUpdate(newData)
  }

  function deleteVolunteer(volIndex) {
    const newData = JSON.parse(JSON.stringify(resumeData))
    newData.volunteer.splice(volIndex, 1)
    onUpdate(newData)
  }

  function addLanguage() {
    const newData = JSON.parse(JSON.stringify(resumeData))
    if (!newData.languages) {
      newData.languages = []
    }
    newData.languages.push({
      language: 'Language',
      proficiency: 'Professional'
    })
    onUpdate(newData)
  }

  function deleteLanguage(langIndex) {
    const newData = JSON.parse(JSON.stringify(resumeData))
    newData.languages.splice(langIndex, 1)
    onUpdate(newData)
  }
  function updateField(field, value) {
    if (isUndoingRef.current) return
    const newData = { ...resumeData, [field]: value }
    onUpdate(newData)
  }
function toggleSummary() {
    const newData = JSON.parse(JSON.stringify(resumeData))
    newData.hideSummary = !newData.hideSummary
    onUpdate(newData)
  }

  function moveSectionUp(sectionName) {
    const newData = JSON.parse(JSON.stringify(resumeData))
    const order = newData.sectionOrder || []
    const index = order.indexOf(sectionName)
    if (index <= 0) return // Already at top or not found
    
    // Swap with previous
    const temp = order[index]
    order[index] = order[index - 1]
    order[index - 1] = temp
    
    newData.sectionOrder = order
    onUpdate(newData)
  }

  function moveSectionDown(sectionName) {
    const newData = JSON.parse(JSON.stringify(resumeData))
    const order = newData.sectionOrder || []
    const index = order.indexOf(sectionName)
    if (index < 0 || index >= order.length - 1) return // At bottom or not found
    
    // Swap with next
    const temp = order[index]
    order[index] = order[index + 1]
    order[index + 1] = temp
    
    newData.sectionOrder = order
    onUpdate(newData)
  }
  function updateNestedField(path, value) {
    if (isUndoingRef.current) return
    
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

  // Helper function to render sections dynamically
  function renderSection(sectionName) {
    switch(sectionName) {
      case 'experience':
        if (!resumeData.experience || resumeData.experience.length === 0) return null
        return (
          <div key="experience" className="mb-6 group">
            {/* ... full Experience section JSX ... */}
          </div>
        )
      
      case 'education':
        if (!resumeData.education || resumeData.education.length === 0) return null
        return (
          <div key="education" className="mb-6 group">
            {/* ... full Education section JSX ... */}
          </div>
        )
      
      // ... etc for all sections
    }
  }

  return (
    <>
      {/* Contact */}
      <div className="text-center mb-6 p-2 rounded">
        <h1 
                className={`text-3xl font-bold text-center mb-1 ${!readOnly && 'cursor-text hover:bg-purple-100 px-2 rounded'}`}
                contentEditable={!readOnly}
                suppressContentEditableWarning
          onBlur={(e) => updateField('fullName', e.currentTarget.textContent)}
        >
          {resumeData.fullName || 'Your Name'}
        </h1>
        <p 
          className={`text-sm text-gray-600 mt-1 ${!readOnly && 'cursor-text hover:bg-purple-50 p-1 rounded'}`}
          contentEditable={!readOnly}
          suppressContentEditableWarning
          onBlur={(e) => {
            if (isUndoingRef.current) return
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
      {resumeData.summary && !resumeData.hideSummary && (
    <div className={`mb-6 p-2 rounded group ${!readOnly && 'hover:bg-purple-50'}`}>         <h2 className="text-lg font-semibold border-b border-gray-300 pb-1 mb-2">
            SUMMARY
            {!readOnly && (
              <button
                onClick={toggleSummary}
                className="text-gray-400 hover:text-gray-600 text-xs ml-2 opacity-0 group-hover:opacity-100"
                title="Hide this section from your resume"
              >
                Hide Summary Section
              </button>
            )}
          </h2>
         <p 
            className={`text-sm ${!readOnly && 'cursor-text hover:bg-purple-50 p-1 rounded'}`}
            contentEditable={!readOnly}
            suppressContentEditableWarning
            onBlur={(e) => updateField('summary', e.currentTarget.textContent)}
          >
            {resumeData.summary}
          </p>
        </div>
      )}
      
     {/* Show Summary button if hidden */}
      {!readOnly && resumeData.summary && resumeData.hideSummary && (
        <button
          onClick={toggleSummary}
          className="mb-4 text-purple-600 text-sm opacity-50 hover:opacity-100"
        >
          👁️ Show Summary Section
        </button>
      )}

 {/* Experience */}
      {resumeData.experience && resumeData.experience.length > 0 && (
        <div className="mb-6 group">
          <h2 className="text-lg font-semibold border-b border-gray-300 pb-1 mb-3">
            EXPERIENCE
            {!readOnly && (
              <span className="opacity-30 group-hover:opacity-100 ml-2">
              <button
                onClick={() => moveSectionUp('experience')}
                disabled={resumeData.sectionOrder?.[0] === 'experience'}
                className="text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-30 disabled:cursor-not-allowed text-sm"
                title="Move this section up on your resume"
              >
                ↑
              </button>
              <button
                onClick={() => moveSectionDown('experience')}
                disabled={resumeData.sectionOrder?.[resumeData.sectionOrder.length - 1] === 'experience'}
                className="text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-30 disabled:cursor-not-allowed text-sm"
                title="Move this section down on your resume"
              >
                ↓
             </button>
              </span>
            )}
          </h2>
          {resumeData.experience.map((job, jobIndex) => (
           <div key={jobIndex} className={`mb-4 p-2 rounded group ${!readOnly && 'hover:bg-purple-50'}`}>
              <div className="flex justify-between items-start mb-1">
               <h3 
                  className={`font-semibold ${!readOnly && 'cursor-text'}`}
                  contentEditable={!readOnly}
                  suppressContentEditableWarning
                  onBlur={(e) => updateNestedField(`experience[${jobIndex}].title`, e.currentTarget.textContent)}
                >
                  {job.title || 'Job Title'}
                </h3>
               <span className="text-sm text-gray-600">
                  {formatDate(job.startDate)} - {job.current ? 'Present' : formatDate(job.endDate)}
                </span>
              </div>
             <p 
                className={`text-sm font-medium text-gray-700 mb-2 ${!readOnly && 'cursor-text'}`}
                contentEditable={!readOnly}
                suppressContentEditableWarning
                onBlur={(e) => updateNestedField(`experience[${jobIndex}].company`, e.currentTarget.textContent)}
              >
                {job.company}
              </p>
              
          {/* Summary paragraph */}
             {job.summary ? (
                <div className="mb-2">
                  <p 
                    className={`text-sm text-gray-700 italic ${!readOnly && 'cursor-text'}`}
                    contentEditable={!readOnly}
                    suppressContentEditableWarning
                    onBlur={(e) => updateNestedField(`experience[${jobIndex}].summary`, e.currentTarget.textContent)}
                  >
                    {job.summary}
                  </p>
                  {!readOnly && (
                    <button
                      onClick={() => removeExperienceSummary(jobIndex)}
                      className="text-red-500 text-xs mt-1 opacity-50 hover:opacity-100"
                    >
                      × Remove Summary
                    </button>
                  )}
                </div>
             ) : !readOnly && job.summaryDismissed !== true && (
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={() => addExperienceSummary(jobIndex)}
                    className="text-purple-600 text-xs opacity-50 hover:opacity-100"
                  >
                    + Add Summary Paragraph (1-2 sentences)
                  </button>
                  <button
                    onClick={() => {
                      const newData = JSON.parse(JSON.stringify(resumeData))
                      newData.experience[jobIndex].summaryDismissed = true
                      onUpdate(newData)
                    }}
                    className="text-gray-400 text-xs hover:text-gray-600"
                  >
                    × Hide this field
                  </button>
                </div>
              )}

             {/* Bullets */}
              {job.bullets && job.bullets.length > 0 && job.bullets.map((bullet, bulletIndex) => (
                <div key={bulletIndex} className="flex items-start gap-2 mb-1 group/bullet">
                  <span className="text-sm">•</span>
                <p 
                    className={`text-sm flex-1 ${!readOnly && 'cursor-text'}`}
                    contentEditable={!readOnly}
                    suppressContentEditableWarning
                    onBlur={(e) => updateNestedField(`experience[${jobIndex}].bullets[${bulletIndex}]`, e.currentTarget.textContent)}
                  >
                    {bullet}
                  </p>
               {!readOnly && (
                    <div className="flex items-center gap-1 opacity-30 group-hover/bullet:opacity-100">
                    <button
                      onClick={() => moveExperienceBulletUp(jobIndex, bulletIndex)}
                      disabled={bulletIndex === 0}
                      className="text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveExperienceBulletDown(jobIndex, bulletIndex)}
                      disabled={bulletIndex === job.bullets.length - 1}
                      className="text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move down"
                    >
                      ↓
                    </button>
                    {confirmingDelete === `experience-${jobIndex}-${bulletIndex}` ? (
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-gray-600">Delete?</span>
                        <button
                          onClick={() => {
                            deleteExperienceBullet(jobIndex, bulletIndex)
                            setConfirmingDelete(null)
                          }}
                          className="text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setConfirmingDelete(null)}
                          className="text-gray-600 hover:bg-gray-100 px-2 py-0.5 rounded"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmingDelete(`experience-${jobIndex}-${bulletIndex}`)}
                        className="text-red-500 hover:bg-red-50 px-1 rounded"
                        title="Delete bullet"
                      >
                        🗑️
                      </button>
                    )}
                    </div>
                  )}
                </div>
              ))}

             {!readOnly && (
                <button
                  onClick={() => addExperienceBullet(jobIndex)}
                  className="text-purple-600 text-xs mt-2 opacity-0 group-hover:opacity-100"
                >
                  + Add Bullet
                </button>
              )}
            </div>
          ))}
        </div>
      )}

     {/* Education */}
      {resumeData.education && resumeData.education.length > 0 && (
        <div className="mb-6 group">
          <h2 className="text-lg font-semibold border-b border-gray-300 pb-1 mb-3">
            EDUCATION
            {!readOnly && (
              <span className="opacity-30 group-hover:opacity-100 ml-2">
              <button
                onClick={() => moveSectionUp('education')}
                disabled={resumeData.sectionOrder?.[0] === 'education'}
                className="text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-30 disabled:cursor-not-allowed text-sm"
                title="Move this section up on your resume"
              >
                ↑
              </button>
              <button
                onClick={() => moveSectionDown('education')}
                disabled={resumeData.sectionOrder?.[resumeData.sectionOrder.length - 1] === 'education'}
                className="text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-30 disabled:cursor-not-allowed text-sm"
                title="Move this section down on your resume"
              >
                ↓
             </button>
              </span>
            )}
          </h2>
          {resumeData.education.map((edu, eduIndex) => (
           <div key={eduIndex} className={`mb-3 p-2 rounded group ${!readOnly && 'hover:bg-purple-50'}`}>
              <h3 
                className={`font-semibold mb-1 ${!readOnly && 'cursor-text'}`}
                contentEditable={!readOnly}
                suppressContentEditableWarning
                onBlur={(e) => updateNestedField(`education[${eduIndex}].school`, e.currentTarget.textContent)}
              >
                {edu.school}
              </h3>
              
              {/* Flexible lines */}
              {edu.lines && edu.lines.map((line, lineIndex) => (
                <div key={lineIndex} className="flex items-start gap-2 group/line">
                  <p 
                    className={`text-sm font-medium text-gray-700 flex-1 ${!readOnly && 'cursor-text'}`}
                    contentEditable={!readOnly}
                    suppressContentEditableWarning
                    onBlur={(e) => updateNestedField(`education[${eduIndex}].lines[${lineIndex}]`, e.currentTarget.textContent)}
                  >
                    {line}
                  </p>
                 {!readOnly && (
                    <button
                      onClick={() => deleteEducationLine(eduIndex, lineIndex)}
                      className="text-red-500 opacity-0 group-hover/line:opacity-100 text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}

              {!readOnly && (
                <button
                  onClick={() => addEducationLine(eduIndex)}
                  className="text-purple-600 text-xs mt-1 opacity-0 group-hover:opacity-100"
                >
                  + Add Line
                </button>
              )}
            </div>
          ))}
        </div>
      )}

{/* Skills */}
      {resumeData.skillsCategories && Object.keys(resumeData.skillsCategories).length > 0 && (
       <div className={`mb-6 p-2 rounded group ${!readOnly && 'hover:bg-purple-50'}`}>
          <h2 className="text-lg font-semibold border-b border-gray-300 pb-1 mb-2">
            SKILLS
            {!readOnly && (
              <span className="opacity-30 group-hover:opacity-100 ml-2">
                <button
                  onClick={() => moveSectionUp('skills')}
                  disabled={resumeData.sectionOrder?.[0] === 'skills'}
                  className="text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-30 disabled:cursor-not-allowed text-sm"
                  title="Move this section up on your resume"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveSectionDown('skills')}
                  disabled={resumeData.sectionOrder?.[resumeData.sectionOrder.length - 1] === 'skills'}
                  className="text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-30 disabled:cursor-not-allowed text-sm"
                  title="Move this section down on your resume"
                >
                  ↓
                </button>
                {Object.keys(resumeData.skillsCategories).length > 1 && (
                  <button
                    onClick={flattenSkills}
                    className="text-purple-600 hover:bg-purple-100 px-2 py-1 rounded text-xs ml-2 font-medium"
                  >
                    Combine All Skills Into One List
                  </button>
                )}
              </span>
            )}
          </h2>
          
          {Object.entries(resumeData.skillsCategories).map(([category, skills]) => {
            const isSingleSkillsCategory = Object.keys(resumeData.skillsCategories).length === 1 && category === 'Skills'
            
            return (
              <div key={category} className="mb-3 group/category">
                {!isSingleSkillsCategory && (
                  <div className="flex items-center gap-2 mb-1">
                    <p 
                      className={`text-sm font-semibold ${!readOnly && 'cursor-text hover:bg-purple-100 px-1 rounded'}`}
                      contentEditable={!readOnly}
                      suppressContentEditableWarning
                      onBlur={(e) => {
                        if (isUndoingRef.current) return
                        const newName = e.currentTarget.textContent.trim()
                        if (newName && newName !== category) {
                          renameSkillCategory(category, newName)
                        }
                      }}
                    >
                      {category}
                    </p>
                    {!readOnly && (
                      <>
                        {confirmingDelete === `category-${category}` ? (
                          <div className="flex items-center gap-1 text-xs">
                            <span className="text-gray-600">Delete?</span>
                            <button
                              onClick={() => {
                                deleteSkillCategory(category)
                                setConfirmingDelete(null)
                              }}
                              className="text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setConfirmingDelete(null)}
                              className="text-gray-600 hover:bg-gray-100 px-2 py-0.5 rounded"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmingDelete(`category-${category}`)}
                            className="text-red-500 opacity-0 group-hover/category:opacity-100 text-xs px-1 hover:bg-red-50 rounded"
                          >
                            🗑️
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
                <p 
                  className={`text-sm ${!readOnly && 'cursor-text hover:bg-purple-100 px-1 rounded'}`}
                  contentEditable={!readOnly}
                  suppressContentEditableWarning
                  onBlur={(e) => {
                    if (isUndoingRef.current) return
                    const newData = JSON.parse(JSON.stringify(resumeData))
                    const skillText = e.currentTarget.textContent.trim()
                    newData.skillsCategories[category] = skillText
                      .split(/[,•]/)
                      .map(s => s.trim())
                      .filter(s => s.length > 0)
                    onUpdate(newData)
                  }}
                >
                  {Array.isArray(skills) ? skills.join(', ') : skills}
                </p>
              </div>
            )
          })}
          
          {!readOnly && (
            <button
              onClick={addSkillCategory}
              className="text-purple-600 text-xs mt-2 opacity-0 group-hover:opacity-100"
            >
              + Add Category
            </button>
          )}
        </div>
      )}
{/* Projects */}
      {resumeData.projects && resumeData.projects.length > 0 && (
        <div className="mb-6 group">
          <h2 className="text-lg font-semibold border-b border-gray-300 pb-1 mb-3">
            PROJECTS
            {!readOnly && (
              <span className="opacity-30 group-hover:opacity-100 ml-2">
                <button
                  onClick={() => moveSectionUp('projects')}
                  disabled={resumeData.sectionOrder?.[0] === 'projects'}
                  className="text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-30 disabled:cursor-not-allowed text-sm"
                  title="Move this section up on your resume"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveSectionDown('projects')}
                  disabled={resumeData.sectionOrder?.[resumeData.sectionOrder.length - 1] === 'projects'}
                  className="text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-30 disabled:cursor-not-allowed text-sm"
                  title="Move this section down on your resume"
                >
                  ↓
                </button>
              </span>
            )}
          </h2>
          {resumeData.projects.map((project, projectIndex) => (
            <div key={projectIndex} className={`mb-3 p-2 rounded group/project ${!readOnly && 'hover:bg-purple-50'}`}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <h3 
                  className={`font-semibold flex-1 ${!readOnly && 'cursor-text'}`}
                  contentEditable={!readOnly}
                  suppressContentEditableWarning
                  onBlur={(e) => updateNestedField(`projects[${projectIndex}].name`, e.currentTarget.textContent)}
                >
                  {project.name}
                </h3>
                {!readOnly && (
                  <>
                    {confirmingDelete === `projects-${projectIndex}` ? (
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-gray-600">Delete?</span>
                        <button
                          onClick={() => {
                            deleteProject(projectIndex)
                            setConfirmingDelete(null)
                          }}
                          className="text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setConfirmingDelete(null)}
                          className="text-gray-600 hover:bg-gray-100 px-2 py-0.5 rounded"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmingDelete(`projects-${projectIndex}`)}
                        className="text-red-500 hover:bg-red-50 px-1 rounded opacity-0 group-hover/project:opacity-100"
                        title="Delete project"
                      >
                        🗑️
                      </button>
                    )}
                  </>
                )}
              </div>
              <p 
                className={`text-sm text-gray-700 mb-1 ${!readOnly && 'cursor-text'}`}
                contentEditable={!readOnly}
                suppressContentEditableWarning
                onBlur={(e) => updateNestedField(`projects[${projectIndex}].description`, e.currentTarget.textContent)}
              >
                {project.description}
              </p>
              {project.link && (
                <p 
                  className={`text-sm text-purple-600 ${!readOnly && 'cursor-text'}`}
                  contentEditable={!readOnly}
                  suppressContentEditableWarning
                  onBlur={(e) => updateNestedField(`projects[${projectIndex}].link`, e.currentTarget.textContent)}
                >
                  {project.link}
                </p>
              )}
            </div>
          ))}
          {!readOnly && (
            <button
              onClick={addProject}
              className="text-purple-600 text-xs opacity-0 group-hover:opacity-100"
            >
              + Add Project
            </button>
          )}
        </div>
      )}
           {/* Certifications */}
      {resumeData.certifications && resumeData.certifications.length > 0 && (
        <div className="mb-6 group">
          <h2 className="text-lg font-semibold border-b border-gray-300 pb-1 mb-3">
            CERTIFICATIONS
            {!readOnly && (
              <span className="opacity-30 group-hover:opacity-100 ml-2">
                <button
                  onClick={() => moveSectionUp('certifications')}
                  disabled={resumeData.sectionOrder?.[0] === 'certifications'}
                  className="text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-30 disabled:cursor-not-allowed text-sm"
                  title="Move this section up on your resume"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveSectionDown('certifications')}
                  disabled={resumeData.sectionOrder?.[resumeData.sectionOrder.length - 1] === 'certifications'}
                  className="text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-30 disabled:cursor-not-allowed text-sm"
                  title="Move this section down on your resume"
                >
                  ↓
                </button>
              </span>
            )}
          </h2>
          {resumeData.certifications.map((cert, certIndex) => (
          <div key={volIndex} className={`mb-3 p-2 rounded group/vol ${!readOnly && 'hover:bg-purple-50'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <h3 
                    className={`font-semibold ${!readOnly && 'cursor-text'}`}
                    contentEditable={!readOnly}
                    suppressContentEditableWarning
                    onBlur={(e) => updateNestedField(`certifications[${certIndex}].name`, e.currentTarget.textContent)}
                  >
                    {cert.name}
                  </h3>
                  <p 
                    className={`text-sm text-gray-600 ${!readOnly && 'cursor-text'}`}
                    contentEditable={!readOnly}
                    suppressContentEditableWarning
                    onBlur={(e) => updateNestedField(`certifications[${certIndex}].details`, e.currentTarget.textContent)}
                  >
                    {cert.details}
                  </p>
                </div>
                {!readOnly && (
                  <>
                    {confirmingDelete === `certifications-${certIndex}` ? (
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-gray-600">Delete?</span>
                        <button
                          onClick={() => {
                            deleteCertification(certIndex)
                            setConfirmingDelete(null)
                          }}
                          className="text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setConfirmingDelete(null)}
                          className="text-gray-600 hover:bg-gray-100 px-2 py-0.5 rounded"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmingDelete(`certifications-${certIndex}`)}
                        className="text-red-500 hover:bg-red-50 px-1 rounded opacity-0 group-hover/cert:opacity-100"
                        title="Delete certification"
                      >
                        🗑️
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
          {!readOnly && (
            <button
              onClick={addCertification}
              className="text-purple-600 text-xs opacity-0 group-hover:opacity-100"
            >
              + Add Certification
            </button>
          )}
        </div>
      )}
     {/* Volunteer */}
      {resumeData.volunteer && resumeData.volunteer.length > 0 && (
        <div className="mb-6 group">
          <h2 className="text-lg font-semibold border-b border-gray-300 pb-1 mb-3">
            VOLUNTEER
            {!readOnly && (
              <span className="opacity-30 group-hover:opacity-100 ml-2">
                <button
                  onClick={() => moveSectionUp('volunteer')}
                  disabled={resumeData.sectionOrder?.[0] === 'volunteer'}
                  className="text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-30 disabled:cursor-not-allowed text-sm"
                  title="Move this section up on your resume"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveSectionDown('volunteer')}
                  disabled={resumeData.sectionOrder?.[resumeData.sectionOrder.length - 1] === 'volunteer'}
                  className="text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-30 disabled:cursor-not-allowed text-sm"
                  title="Move this section down on your resume"
                >
                  ↓
                </button>
              </span>
            )}
          </h2>
          {resumeData.volunteer.map((vol, volIndex) => (
            <div key={volIndex} className="mb-3 p-2 rounded hover:bg-purple-50 group/vol">
              <div className="flex items-start justify-between gap-2 mb-1">
                <h3 
                  className={`font-semibold flex-1 ${!readOnly && 'cursor-text'}`}
                  contentEditable={!readOnly}
                  suppressContentEditableWarning
                  onBlur={(e) => updateNestedField(`volunteer[${volIndex}].organization`, e.currentTarget.textContent)}
                >
                  {vol.organization}
                </h3>
                {!readOnly && (
                  <>
                    {confirmingDelete === `volunteer-${volIndex}` ? (
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-gray-600">Delete?</span>
                        <button
                          onClick={() => {
                            deleteVolunteer(volIndex)
                            setConfirmingDelete(null)
                          }}
                          className="text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setConfirmingDelete(null)}
                          className="text-gray-600 hover:bg-gray-100 px-2 py-0.5 rounded"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmingDelete(`volunteer-${volIndex}`)}
                        className="text-red-500 hover:bg-red-50 px-1 rounded opacity-0 group-hover/vol:opacity-100"
                        title="Delete volunteer experience"
                      >
                        🗑️
                      </button>
                    )}
                  </>
                )}
              </div>
              <p 
                className={`text-sm text-gray-700 ${!readOnly && 'cursor-text'}`}
                contentEditable={!readOnly}
                suppressContentEditableWarning
                onBlur={(e) => updateNestedField(`volunteer[${volIndex}].description`, e.currentTarget.textContent)}
              >
                {vol.description}
              </p>
            </div>
          ))}
          {!readOnly && (
            <button
              onClick={addVolunteer}
              className="text-purple-600 text-xs opacity-0 group-hover:opacity-100"
            >
              + Add Volunteer Experience
            </button>
          )}
        </div>
      )}
     {/* Languages */}
      {resumeData.languages && resumeData.languages.length > 0 && (
        <div className="mb-6 group">
          <h2 className="text-lg font-semibold border-b border-gray-300 pb-1 mb-3">
            LANGUAGES
            {!readOnly && (
              <span className="opacity-30 group-hover:opacity-100 ml-2">
                <button
                  onClick={() => moveSectionUp('languages')}
                  disabled={resumeData.sectionOrder?.[0] === 'languages'}
                  className="text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-30 disabled:cursor-not-allowed text-sm"
                  title="Move this section up on your resume"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveSectionDown('languages')}
                  disabled={resumeData.sectionOrder?.[resumeData.sectionOrder.length - 1] === 'languages'}
                  className="text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-30 disabled:cursor-not-allowed text-sm"
                  title="Move this section down on your resume"
                >
                  ↓
                </button>
              </span>
            )}
          </h2>
          {resumeData.languages.map((lang, langIndex) => (
          <div key={langIndex} className={`mb-2 p-2 rounded group/lang flex items-center justify-between ${!readOnly && 'hover:bg-purple-50'}`}>
              <div className="flex items-center gap-3 flex-1">
                <span 
                  className={`font-semibold ${!readOnly && 'cursor-text'}`}
                  contentEditable={!readOnly}
                  suppressContentEditableWarning
                  onBlur={(e) => updateNestedField(`languages[${langIndex}].language`, e.currentTarget.textContent)}
                >
                  {lang.language}
                </span>
                <span className="text-gray-400">—</span>
                {readOnly ? (
                  <span className="text-sm text-gray-600">{lang.proficiency || 'Professional'}</span>
                ) : (
                  <select
                    value={lang.proficiency || 'Professional'}
                    onChange={(e) => updateNestedField(`languages[${langIndex}].proficiency`, e.target.value)}
                    className="text-sm text-gray-600 bg-transparent border-none focus:outline-none cursor-pointer"
                  >
                    <option value="Native">Native</option>
                    <option value="Fluent">Fluent</option>
                    <option value="Professional">Professional</option>
                    <option value="Conversational">Conversational</option>
                    <option value="Basic">Basic</option>
                  </select>
                )}
              </div>
              {!readOnly && (
                <>
                  {confirmingDelete === `languages-${langIndex}` ? (
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-gray-600">Delete?</span>
                      <button
                        onClick={() => {
                          deleteLanguage(langIndex)
                          setConfirmingDelete(null)
                        }}
                        className="text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setConfirmingDelete(null)}
                        className="text-gray-600 hover:bg-gray-100 px-2 py-0.5 rounded"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmingDelete(`languages-${langIndex}`)}
                      className="text-red-500 hover:bg-red-50 px-1 rounded opacity-0 group-hover/lang:opacity-100"
                      title="Delete language"
                    >
                      🗑️
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
          {!readOnly && (
            <button
              onClick={addLanguage}
              className="text-purple-600 text-xs opacity-0 group-hover:opacity-100"
            >
              + Add Language
            </button>
          )}
        </div>
      )}
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
function RightPanel({ journeyStep, score, analysisResults, userTier, resumeName, userName, supabase, params, setResume, handleReassess, isAnalyzing, detectedLevel }) {  const steps = ['review', 'assess', 'coach', 'improve', 'polish', 'save']
  const currentIndex = steps.indexOf(journeyStep)
  const [isUpdatingJourney, setIsUpdatingJourney] = useState(false)
  const panelRef = useRef(null)

  // Scroll to top when journey step changes to 'assess'
  useEffect(() => {
    if (journeyStep === 'assess' && panelRef.current) {
      panelRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [journeyStep])

 return (
    <div ref={panelRef} className="overflow-y-auto overflow-x-hidden h-full pr-3">
      
      <div className="mb-6 pb-4 border-b border-gray-200">
        <h3 className="text-center font-semibold text-sm mb-3">
          {userName ? `${userName.split(' ')[0]}'s ` : ''}{resumeName} Progress
        </h3>
        
        <div className="relative">
          <div className="absolute top-3 left-0 right-0 h-0.5 bg-gray-300">
            <div 
              className="h-full bg-purple-600 transition-all duration-300"
              style={{ width: `${currentIndex >= 0 ? (currentIndex / (steps.length - 1)) * 100 : 0}%` }}
            />
          </div>
          
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

 {journeyStep === 'review' && (
        <>
          <h3 className="font-semibold text-lg mb-3">📝 Review Your Resume</h3>
          
          <p className="text-xs text-gray-700 mb-4">
            AI parsing isn't perfect, so things occasionally land in the wrong spot. Take a quick look at your resume, and make sure everything's where it should be. Click any section to edit or move content around.
          </p>

          <div className="bg-purple-50 border-l-4 border-purple-500 p-3 mb-4">
            <div className="text-xs text-purple-900 space-y-2">
              <div><strong>✓ Check contact info</strong></div>
              <div><strong>✓ Verify job titles and dates</strong></div>
              <div><strong>✓ Review bullet points</strong></div>
              <div><strong>✓ Confirm education details</strong></div>
            </div>
          </div>

          <button 
            onClick={handleReassess}
            disabled={isAnalyzing}
            className={`w-full bg-purple-600 text-white rounded-lg py-3 font-semibold transition-colors flex items-center justify-center gap-2 ${
              isAnalyzing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-purple-700'
            }`}
          >
            {isAnalyzing && (
              <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>
            )}
            {isAnalyzing ? 'Analyzing...' : 'Looks Good → Assess Resume'}
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
        <div className="space-y-5">
       {/* Header */}
        <div className="flex items-center justify-center gap-6 -mt-1">
              <div className="text-center">
                <div className="text-sm text-gray-600 leading-tight">Assessment Complete!</div>
                <div className="text-base text-gray-900 font-semibold leading-tight">Resume Power Score:</div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-gray-900">{score || 62}</span>
                <span className="text-lg text-gray-600">/100</span>
              </div>
            </div>
          
          {/* Progress Bar */}
          <div>
            <div className="relative mb-4">
             <div className="h-8 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${
                    (score || 62) >= 85 ? 'bg-gradient-to-r from-green-400 to-green-500' :
                    (score || 62) >= 70 ? 'bg-gradient-to-r from-yellow-400 to-yellow-500' :
                    'bg-gradient-to-r from-red-400 to-red-500'
                  }`}
                  style={{ width: `${score || 62}%` }}
                />
              </div>
            </div>
            
            <div className="relative h-12 mb-2">
              <div className="flex h-2">
                <div className="bg-red-500 rounded-l-full" style={{ width: '70%' }}></div>
                <div className="bg-yellow-500" style={{ width: '14%' }}></div>
                <div className="bg-green-500 rounded-r-full" style={{ width: '16%' }}></div>
              </div>
              
              <div className="absolute top-0 left-[70%] -translate-x-1/2 -translate-y-px">
                <div className="w-3 h-3 rounded-full bg-white border-2 border-red-500"></div>
              </div>
              <div className="absolute top-0 left-[84%] -translate-x-1/2 -translate-y-px">
                <div className="w-3 h-3 rounded-full bg-white border-2 border-yellow-500"></div>
              </div>
              
              <div className="flex mt-2">
                <div className="text-center text-xs text-gray-700" style={{ width: '70%' }}>
                  <div className="font-medium">Needs Improvement</div>
                  <div className="text-gray-500">(0-70)</div>
                </div>
                <div className="text-center text-xs text-gray-700" style={{ width: '14%' }}>
                  <div className="font-medium">Strong</div>
                  <div className="text-gray-500">(71-84)</div>
                </div>
                <div className="text-center text-xs text-gray-700" style={{ width: '16%' }}>
                  <div className="font-medium">Excellent</div>
                  <div className="text-gray-500">(85-100)</div>
                </div>
              </div>
            </div>
          </div>
          
         {/* Breakdown - RESTRUCTURED */}
            <div className="bg-white rounded-lg p-4">
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-1.5">Breakdown</h3>
              
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between items-baseline mb-0.5">
                    <span className="font-semibold text-gray-900 text-sm">Impact</span>
                    <span className="text-gray-700 font-medium text-sm">{analysisResults?.analysis?.breakdown?.impact || 20}/40</span>
                  </div>
                 <div className="text-[11px] text-gray-500 leading-tight mb-1.5">
                    {detectedLevel === 'entry' && 'Relevant experience, skills, work ethic'}
                    {detectedLevel === 'mid' && 'Growth, leadership, quantified results'}
                    {detectedLevel === 'senior' && 'Strategic impact, organizational influence'}
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${
                        (analysisResults?.analysis?.breakdown?.impact || 20)/40 >= 0.8 ? 'bg-green-500' : 
                        (analysisResults?.analysis?.breakdown?.impact || 20)/40 >= 0.6 ? 'bg-yellow-500' : 
                        'bg-red-500'
                      }`}
                      style={{ width: `${((analysisResults?.analysis?.breakdown?.impact || 20)/40)*100}%` }}
                    ></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between items-baseline mb-0.5">
                    <span className="font-semibold text-gray-900 text-sm">Clarity</span>
                    <span className="text-gray-700 font-medium text-sm">{analysisResults?.analysis?.breakdown?.clarity || 28}/40</span>
                  </div>
                  <div className="text-[11px] text-gray-500 leading-tight mb-1.5">Strong verbs, grammar, professional language</div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${
                        (analysisResults?.analysis?.breakdown?.clarity || 28)/40 >= 0.8 ? 'bg-green-500' : 
                        (analysisResults?.analysis?.breakdown?.clarity || 28)/40 >= 0.6 ? 'bg-yellow-500' : 
                        'bg-red-500'
                      }`}
                      style={{ width: `${((analysisResults?.analysis?.breakdown?.clarity || 28)/40)*100}%` }}
                    ></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between items-baseline mb-0.5">
                    <span className="font-semibold text-gray-900 text-sm">Keywords</span>
                    <span className="text-gray-700 font-medium text-sm">{analysisResults?.analysis?.breakdown?.keywords || 14}/20</span>
                  </div>
                 <div className="text-[11px] text-gray-500 leading-tight mb-1.5">
                    {detectedLevel === 'entry' && 'Industry-relevant skills and terminology'}
                    {detectedLevel === 'mid' && 'Comprehensive professional vocabulary'}
                    {detectedLevel === 'senior' && 'Strategic and executive-level terminology'}
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${
                        (analysisResults?.analysis?.breakdown?.keywords || 14)/20 >= 0.8 ? 'bg-green-500' : 
                        (analysisResults?.analysis?.breakdown?.keywords || 14)/20 >= 0.6 ? 'bg-yellow-500' : 
                        'bg-red-500'
                      }`}
                      style={{ width: `${((analysisResults?.analysis?.breakdown?.keywords || 14)/20)*100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          
         {/* Strengths */}
          <div className="pt-3 border-t border-gray-300">
            <h3 className="text-sm font-bold text-green-700 uppercase tracking-wide mb-1.5">✅ What's Working</h3>
            <ul className="space-y-1">
              {(analysisResults?.analysis?.strengths || [
                "Strong quantification throughout with specific numbers demonstrating scope and impact.",
                "Action verbs consistently demonstrate ownership and leadership.",
                "Professional formatting maintains clear, readable structure.",
                "Skills section includes relevant technical and soft skills."
              ]).map((strength, i) => (
                <li key={i} className="text-sm text-gray-700 flex gap-2 leading-snug">
                  <span className="text-green-600 flex-shrink-0">•</span>
                  <span>{strength}</span>
                </li>
              ))}
            </ul>
          </div>
          
          {/* Weaknesses */}
          <div className="pt-3 border-t border-gray-300">
            <h3 className="text-sm font-bold text-red-700 uppercase tracking-wide mb-1.5">⚠️ What's Missing</h3>
            <ul className="space-y-1">
              {(analysisResults?.analysis?.weaknesses || [
                "Three experience bullets lack quantifiable metrics or measurable outcomes.",
                "Vague language such as 'managed team' without specifying team size or budget.",
                "Generic claim of 'improved efficiency' requires percentage or specific timeframe.",
                "Missing keywords from target job description in technical skills section.",
                "Education section could benefit from relevant coursework or academic honors.",
                "Event coordination lacks scope indicators such as event count or budget details."
              ]).map((weakness, i) => (
                <li key={i} className="text-sm text-gray-700 flex gap-2 leading-snug">
                  <span className="text-red-600 flex-shrink-0">•</span>
                  <span>{weakness}</span>
                </li>
              ))}
            </ul>
          </div>
          
          {/* Suggestions */}
          <div className="pt-3 border-t border-gray-300">
            <h3 className="text-sm font-bold text-yellow-700 uppercase tracking-wide mb-1.5">🎯 Action Plan</h3>
            <ul className="space-y-1">
              {(analysisResults?.analysis?.suggestions || [
                "Add team size (e.g., 'Led team of 8') and budget amounts to management role descriptions.",
                "Quantify efficiency improvement with specific metrics: '30% faster turnaround' or 'saved 10 hours weekly'.",
                "Include 2-3 technical skills from job description, such as Salesforce, Tableau, or Asana.",
                "Add specific event metrics: '60+ annual events with 200-500 attendees, $50K average budget'.",
                "Strengthen education section: include GPA if above 3.5, relevant coursework, or academic honors.",
                "Replace weak verbs like 'helped' and 'responsible for' with action verbs showing direct impact."
              ]).map((suggestion, i) => (
                <li key={i} className="text-sm text-gray-700 flex gap-2 leading-snug">
                  <span className="text-yellow-600 flex-shrink-0">•</span>
                  <span>{suggestion}</span>
                </li>
              ))}
            </ul>
          </div>          
{/* CTA */}
          <div className="pt-3 border-t border-gray-300">
        {userTier === 'free' ? (
              // FREE TIER - Two options
             <div className="space-y-4">
                <div className="text-center mb-2">
                  <h4 className="font-semibold text-gray-900 mb-1">What's Next?</h4>
                  <p className="text-xs text-gray-600">Time to apply edits and boost that score!</p>
                </div>

                <button
                  onClick={async () => {
                    setIsUpdatingJourney(true)
                    try {
                      const { error } = await supabase
                        .from('resumes')
                        .update({ 
                          journey_step: 'improve',
                          updated_at: new Date().toISOString()
                        })
                        .eq('id', params.id)

                      if (error) {
                        console.error('Error updating journey:', error)
                        alert('Failed to move to Improve. Please try again.')
                      } else {
                        setResume(prev => ({ ...prev, journey_step: 'improve' }))
                      }
                    } catch (err) {
                      console.error('Unexpected error:', err)
                      alert('Something went wrong. Please try again.')
                    } finally {
                      setIsUpdatingJourney(false)
                    }
                  }}
                  disabled={isUpdatingJourney}
                  className={`w-full bg-purple-600 text-white rounded-lg py-2 px-3 transition-colors ${
                    isUpdatingJourney ? 'opacity-75 cursor-not-allowed' : 'hover:bg-purple-700'
                  }`}
                >
                  <div className="font-semibold text-sm leading-tight">Improve It Yourself</div>
                  <div className="text-xs text-purple-100 leading-tight">Edit your resume using our AI suggestions</div>
                </button>
                
                <div className="relative my-.5">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-white px-2 text-gray-500">or</span>
                  </div>
                </div>
                
                <button
                  onClick={() => {
                    window.location.href = '/upgrade'
                  }}
                  className="w-full bg-white text-purple-600 border-2 border-purple-600 rounded-lg py-2 px-3 hover:bg-purple-50 transition-colors"
                >
                  <div className="font-semibold text-sm leading-tight">Upgrade to Pro</div>
                  <div className="text-xs text-purple-500 leading-tight">Let our Resume Coach make the changes</div>
                </button>
                
                <p className="text-xs text-gray-600 text-center mt-.5 mb-4">
                  Pro users see an average <strong className="text-purple-600">16-point improvement</strong> after coaching!
                </p>
              </div>
            ) : (
              // PRO TIER - Start coaching
              <button 
                onClick={async () => {
                  console.log('Start Coaching clicked!')
                  setIsUpdatingJourney(true)
                  try {
                    console.log('Updating journey step to coach...')
                    const { error } = await supabase
                      .from('resumes')
                      .update({ 
                        journey_step: 'coach',
                        updated_at: new Date().toISOString()
                      })
                      .eq('id', params.id)

                    if (error) {
                      console.error('Error updating journey:', error)
                      alert('Failed to start coaching. Please try again.')
                    } else {
                      console.log('Journey step updated successfully!')
                      setResume(prev => ({ ...prev, journey_step: 'coach' }))
                    }
                  } catch (err) {
                    console.error('Unexpected error:', err)
                    alert('Something went wrong. Please try again.')
                  } finally {
                    setIsUpdatingJourney(false)
                  }
                }}
                disabled={isUpdatingJourney}
                className={`w-full bg-purple-600 text-white rounded-lg py-3 font-semibold transition-colors flex items-center justify-center gap-2 ${
                  isUpdatingJourney ? 'opacity-75 cursor-not-allowed' : 'hover:bg-purple-700'
                }`}
              >
                {isUpdatingJourney && (
                  <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>
                )}
                {isUpdatingJourney ? 'Starting...' : 'Start Coaching →'}
              </button>
            )}
            
                </div>
        </div>
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