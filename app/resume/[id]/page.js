'use client'

import { useEffect, useState, useRef } from 'react'
import ReactDOM from 'react-dom/client'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import MainNav from '@/app/components/MainNav'
import UpgradeModal from '@/app/components/UpgradeModal'
import { getTemplateStyles } from '../../templates/getTemplateStyles'
import Breadcrumb from '@/app/components/Breadcrumb'
import ResumeContent from '../../components/ResumeContent'

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
const [previewUrl, setPreviewUrl] = useState(null)
const [isLoadingPreview, setIsLoadingPreview] = useState(false)
 const [isDownloading, setIsDownloading] = useState(false)
 const [showColorPicker, setShowColorPicker] = useState(false)
const isAutoFitJustRanRef = useRef(false)

  // Analysis state
  const [analysisResults, setAnalysisResults] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
const [detectedLevel, setDetectedLevel] = useState('entry')
const [careerContext, setCareerContext] = useState(null)
const [rewrittenResume, setRewrittenResume] = useState(null)
  const [showRevealModal, setShowRevealModal] = useState(false)
  const [scoreBeforeCoaching, setScoreBeforeCoaching] = useState(null)
  const [scoreAfterCoaching, setScoreAfterCoaching] = useState(null)
const [resumeChanges, setResumeChanges] = useState([])
const [coachingMessages, setCoachingMessages] = useState([])
const [coachingSamplesUsed, setCoachingSamplesUsed] = useState(0)
const [showCtaModal, setShowCtaModal] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  // Use ref for undo flag - synchronous, no timing issues
  const isUndoingRef = useRef(false)
  
  // Toolbar states
  const [selectedTemplate, setSelectedTemplate] = useState('crisp')
const [accentColor, setAccentColor] = useState('#5b4fcf')
  const [selectedFont, setSelectedFont] = useState('Georgia')
  const [selectedSize, setSelectedSize] = useState(11)
  const [zoom, setZoom] = useState(100)
const [dateFormat, setDateFormat] = useState('short')
const [isAutoFitting, setIsAutoFitting] = useState(false)
const [selectedSpacing, setSelectedSpacing] = useState(1)
const [resumeExceedsPage, setResumeExceedsPage] = useState(false)
const [showTooLongModal, setShowTooLongModal] = useState(false)

const handleAutoFit = async () => {
  setIsAutoFitting(true)
  try {
    const { data: { user } } = await supabase.auth.getUser()
    const templateForApi = selectedTemplate.charAt(0).toUpperCase() + selectedTemplate.slice(1)
    const minSize = 9.5
    const maxSize = 12
    let testSize = selectedSize

    const checkSize = async (size, spacing = 1) => {
      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeData: resume.resume_data,
          templateName: templateForApi,
          fontSize: size,
          font: selectedFont,
          accentColor: accentColor,
          spacing,
          action: 'check',
          userId: user.id
        })
      })
      if (!response.ok) {
        const err = await response.json()
        console.error('Auto-fit API error:', err)
        throw new Error('Auto-fit check failed')
      }
      return await response.json()
    }

    // First check current size
    const current = await checkSize(testSize)

    if (current.pageCount === 1) {
      // Fits — try growing font up to maxSize first
      let bestSize = testSize
      let bestSpacing = 1
      let trySize = Math.round((testSize + 0.5) * 10) / 10
      while (trySize <= maxSize) {
        const result = await checkSize(trySize, 1)
        if (result.pageCount === 1) {
          bestSize = trySize
          trySize = Math.round((trySize + 0.5) * 10) / 10
        } else {
          break
        }
      }
      // If still under-filling, nudge spacing up (1.0 → 1.5 max)
      let trySpacing = Math.round((bestSpacing + 0.1) * 10) / 10
      while (trySpacing <= 1.5) {
        const result = await checkSize(bestSize, trySpacing)
        if (result.pageCount === 1) {
          bestSpacing = trySpacing
          trySpacing = Math.round((trySpacing + 0.1) * 10) / 10
        } else {
          break
        }
      }
      setSelectedSize(bestSize)
      setSelectedSpacing(bestSpacing)
      setResumeExceedsPage(false)
      isAutoFitJustRanRef.current = true
      await save()
    } else {
      // Too long — step down until it fits
      testSize = Math.round((testSize - 0.5) * 10) / 10
      let fitted = false
      while (testSize >= minSize) {
        const result = await checkSize(testSize)
        if (result.pageCount === 1) {
          setSelectedSize(testSize)
          fitted = true
          isAutoFitJustRanRef.current = true
          await save()
          break
        }
        testSize = Math.round((testSize - 0.5) * 10) / 10
      }
      if (!fitted) {
        setSelectedSize(minSize)
        setShowTooLongModal(true)
      } else {
        setResumeExceedsPage(false)
      }
    }
 } catch (error) {
    console.error('Auto-fit error:', error)
    alert('Auto-fit failed. Please try again.')
  } finally {
    setIsAutoFitting(false)
    setResumeExceedsPage(false)
  }
}

const handleDownload = async () => {
  setIsDownloading(true)
  try {
    
    const { data: { user } } = await supabase.auth.getUser()
    
    // Capitalize template name for API
    const templateForApi = selectedTemplate.charAt(0).toUpperCase() + selectedTemplate.slice(1)
    
    const response = await fetch('/api/generate-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
  resumeData: resume.resume_data,
  templateName: templateForApi,
  fontSize: selectedSize,
  font: selectedFont,
  accentColor: accentColor,
          spacing: selectedSpacing,
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
const baseName = resume.display_name
  ? `${(resume.resume_data?.fullName || '').replace(/\s+/g, '_')}_${resume.display_name.replace(/\s+/g, '_')}`
  : `${(resume.resume_data?.fullName || 'Resume').replace(/\s+/g, '_')}_Resume`
a.download = `${baseName}.pdf`
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

const handleReassess = async (overrideData = null) => {
  setIsAnalyzing(true)
  try {
    const response = await fetch('/api/analyze-resume', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        resumeData: overrideData || resume.resume_data,
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
  ai_analysis: result.analysis,
  score_breakdown: result.analysis?.breakdown,
}
    
    // If coming from review, also update journey_step
    if (resume.journey_step === 'review' || resume.journey_step === 'assess') {
      updateData.journey_step = 'coach'
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

    setScoreAfterCoaching(result.score)
    
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

  useEffect(() => {
    if (isAutoFitJustRanRef.current) {
      isAutoFitJustRanRef.current = false
      return
    }
    const resumeEl = document.querySelector('[data-resume-content="true"]')
    if (resumeEl) {
      const pageHeight = (11 * 96) * 1.08
      const isOver = resumeEl.scrollHeight > pageHeight
      setResumeExceedsPage(isOver)
    }
  }, [resume?.resume_data])

  useEffect(() => {
    const templateFonts = {
      crisp: 'Georgia',
      sharp: 'Trebuchet MS',
      command: 'Arial',
      prestige: 'Palatino Linotype',
      signature: 'Palatino Linotype',
    }
    if (templateFonts[selectedTemplate]) {
      setSelectedFont(templateFonts[selectedTemplate])
    }
  }, [selectedTemplate])

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

    if (error) {
      console.error('Error loading resume:', error)
      router.push('/my-resumes')
      return
    }

    setResume(data)    
if (data.ai_analysis) {
  setAnalysisResults({ analysis: data.ai_analysis })
}
   const templateFonts = {
      crisp: 'Georgia',
      sharp: 'Trebuchet MS',
      command: 'Arial',
      prestige: 'Palatino Linotype',
      signature: 'Palatino Linotype',
    }
   const loadedTemplate = data.template_id || 'crisp'
    
    setSelectedTemplate(loadedTemplate)
    setSelectedFont(data.font_family || templateFonts[loadedTemplate] || 'Georgia')
    setSelectedSize(data.font_size || 11)
    setDateFormat(data.date_format || 'short')
    setAccentColor(data.accent_color || '#5b4fcf')

    // Load career context if it exists
   const { data: contextData } = await supabase
      .from('career_context')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
    if (contextData) setCareerContext(contextData)

    // Load saved coaching messages if resuming mid-session
    if (data.coaching_conversation && data.coaching_conversation.length > 0) {
      setCoachingMessages(data.coaching_conversation)
    }
    // Initialize history
    const initialData = JSON.parse(JSON.stringify(data.resume_data || {}))
    setHistory([initialData])
    setHistoryIndex(0)
    
    setLoading(false)

    // Show CTA modal on first visit to resume detail
    const ctaSeen = localStorage.getItem('hp_resume_cta_seen')
    if (!ctaSeen) {
      setTimeout(() => setShowCtaModal(true), 500)
    }
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
        accent_color: accentColor,
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

    // Check if resume exceeds one page (fast browser check, no API call)
    const resumeEl = document.querySelector('[data-resume-content="true"]')
    
    if (resumeEl) {
      const pageHeight = 11 * 96
      setResumeExceedsPage(resumeEl.scrollHeight > pageHeight)
    }
  }
if (showCtaModal) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{backgroundColor:'rgba(0,0,0,0.6)'}}
      >
        <div
          className="bg-white shadow-2xl w-full overflow-hidden"
          style={{maxWidth:'480px',borderRadius:'12px'}}
        >
          {/* Header */}
          <div
            style={{background:'linear-gradient(to bottom right, #9333ea, #6b21a8)'}}
            className="px-6 py-5"
          >
            <div className="flex items-center gap-3">
              <img src="/images/Hire_Power_icon.png" alt="Hire Power" className="h-8 w-auto flex-shrink-0" />
              <div>
                <h2 className="text-xl font-bold text-white">Your resume is ready to improve.</h2>
                <p className="text-purple-100 text-xs">Here's what Pro does that Free can't.</p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-5">
            <div className="space-y-3 mb-5">
              {[
                { icon: '💬', title: 'Coaching conversation', desc: 'We interview you like a professional resume writer — uncovering achievements you forgot to include.' },
                { icon: '⚡', title: 'Improvements applied automatically', desc: "No guessing how to rewrite your bullets. Pro does it for you in under a minute." },
                { icon: '🎯', title: 'Tailored for every job', desc: 'Unlimited job-specific versions, each coached and optimized for the role.' },
                { icon: '🎤', title: 'Interview Coach included', desc: 'Power Analysis + AI-spoken practice built from your actual resume and target role.' },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0">{item.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                    <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-l-4 border-purple-600 p-3 mb-5">
              <p className="text-sm text-gray-800 font-medium">
                Free tells you what to fix. Pro fixes it for you.
              </p>
            </div>

            <button
              onClick={() => {
                localStorage.setItem('hp_resume_cta_seen', 'true')
                setShowCtaModal(false)
                // Wire to Stripe later
              }}
              className="w-full py-2.5 px-4 rounded-md text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 transition-colors mb-3"
            >
              Upgrade to Pro — $29.99/mo
            </button>

            <button
              onClick={() => {
                localStorage.setItem('hp_resume_cta_seen', 'true')
                setShowCtaModal(false)
              }}
              className="w-full text-center text-xs text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer"
            >
              Continue with Free
            </button>
          </div>
        </div>
      </div>
    )
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

  const resumeData = resume?.resume_data || {}
  const journeyStep = resume?.journey_step || 'start'
  const score = resume?.current_score || null

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
     <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
        <MainNav currentPage="my-resumes" userProfile={userProfile} />

      <Breadcrumb items={[
        { label: 'Resume Coach', path: '/my-resumes' },
        { label: resume.display_name || 'Core Resume' }
      ]} />

{/* Toolbar - STICKY */}
      <div className="bg-white border-b border-gray-200 sticky top-[80px] z-30 overflow-visible">
        <div className="px-6 pt-4 pb-2 max-w-7xl mx-auto w-full overflow-visible">
          <div className="flex items-center gap-2 text-xs overflow-visible flex-nowrap">

            {/* Template */}
            <div className="flex items-center gap-1 border border-gray-300 px-2 py-1 rounded hover:bg-gray-50">
              <span>📄</span>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="bg-transparent border-none text-xs focus:outline-none cursor-pointer max-w-[90px]"
              >
                <option value="crisp">Crisp (Free)</option>
                <option value="sharp">Sharp (Free)</option>
                <option value="command">Command ✦ Pro</option>
                <option value="prestige">Prestige ✦ Pro</option>
                <option value="signature">Signature ✦ Pro</option>
              </select>
            </div>

            {/* Font */}
            <div className="flex items-center gap-1 border border-gray-300 px-2 py-1 rounded hover:bg-gray-50">
              <span className="font-bold">A</span>
              <select
                value={selectedFont}
                onChange={(e) => setSelectedFont(e.target.value)}
                className="bg-transparent border-none text-xs focus:outline-none cursor-pointer max-w-[70px]"
              >
                <option value="Georgia">Georgia</option>
                <option value="Calibri">Calibri</option>
                <option value="Arial">Arial</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Helvetica">Helvetica</option>
              </select>
            </div>

            {/* Size */}
            <div className="flex items-center gap-1 border border-gray-300 px-2 py-1 rounded hover:bg-gray-50">
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

            {/* Date */}
            <div className="flex items-center gap-1 border border-gray-300 px-2 py-1 rounded hover:bg-gray-50">
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

            {/* Zoom dropdown */}
            <div className="relative group/zoom">
              <button className="px-2 py-1 border border-gray-300 rounded text-xs hover:bg-gray-50 flex items-center gap-1">
                🔍 <span>{zoom}%</span>
              </button>
              <div className="absolute left-0 top-full mt-1 z-50 hidden group-hover/zoom:block bg-white border border-gray-200 rounded shadow-lg py-1 min-w-[80px]">
                {[75, 100, 125, 150].map(z => (
                  <button
                    key={z}
                    onClick={() => setZoom(z)}
                    className={`w-full text-left px-3 py-1 text-xs hover:bg-purple-50 ${zoom === z ? 'text-purple-600 font-semibold' : 'text-gray-700'}`}
                  >
                    {z}%
                  </button>
                ))}
              </div>
            </div>

          {/* Color picker - Pro templates only */}
            {['command','prestige','signature'].includes(selectedTemplate) && (
              <div className="relative group/colorpick">
                <button
                  style={{ background: accentColor, width: '26px', height: '26px', borderRadius: '4px', border: '1px solid #d1d5db', cursor: 'pointer', flexShrink: 0, display: 'block' }}
                  title="Change accent color"
                />
                <div className="absolute left-0 top-full mt-1 z-50 hidden group-hover/colorpick:block bg-white border border-gray-200 rounded shadow-lg p-2" style={{ minWidth: '120px' }}>
                    <div className="flex gap-1 items-center mb-2 flex-wrap">
                      {['#5b4fcf','#1e3a5f','#7a1e3a','#1e6b6b','#1e5f3a','#8b3a1e','#2d2d2d','#2d4a6b'].map(c => (
                        <button
                          key={c}
                          onClick={() => { setAccentColor(c); setShowColorPicker(false) }}
                          title={c}
                          style={{
                            width: '20px', height: '20px', borderRadius: '4px', background: c,
                            border: accentColor === c ? '2px solid #1a1a1a' : '2px solid #e5e7eb',
                            cursor: 'pointer', padding: 0, flexShrink: 0
                          }}
                        />
                      ))}
                    </div>
                    <input
                      type="color"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      style={{ width: '100%', height: '24px', border: 'none', cursor: 'pointer', borderRadius: '4px', padding: 0 }}
                      title="Custom color"
                    />
                 </div>
              </div>
            )}

            {/* Auto-fit */}
            <div className="relative group/autofit">
              <button
                onClick={handleAutoFit}
                disabled={isAutoFitting}
                className={`px-3 py-1 border rounded text-xs flex items-center gap-1 transition-colors ${
                  isAutoFitting ? 'opacity-50 cursor-not-allowed border-gray-300'
                  : resumeExceedsPage ? 'border-[#ffc870] bg-[#fff8ee] text-[#a06000] animate-pulse hover:bg-[#ffefd0]'
                  : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                {isAutoFitting && (
                  <div className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>
                )}
                {isAutoFitting ? 'Fitting...' : '⚡ Auto-fit'}
              </button>
              <div className="absolute left-0 top-full mt-1 z-50 hidden group-hover/autofit:block w-56 bg-gray-800 text-white text-xs rounded px-2 py-1.5 shadow-lg pointer-events-none">
                {'Automatically adjusts font size and spacing to best fill one page.' + (resumeExceedsPage ? ' Your resume currently exceeds one page.' : '')}
              </div>
            </div>

            {/* Preview */}
            <div className="relative group/preview">
              <button
                onClick={async () => {
                  setIsLoadingPreview(true)
                  try {
                    const { data: { user } } = await supabase.auth.getUser()
                    const templateForApi = selectedTemplate.charAt(0).toUpperCase() + selectedTemplate.slice(1)
                    const response = await fetch('/api/generate-pdf', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        resumeData: resume.resume_data,
                        templateName: templateForApi,
                        fontSize: selectedSize,
                        font: selectedFont,
                        accentColor: accentColor,
                        spacing: selectedSpacing,
                        action: 'preview',
                        userId: user.id
                      })
                    })
                    if (response.ok) {
                      const blob = await response.blob()
                      const url = window.URL.createObjectURL(blob)
                      setPreviewUrl(url)
                      setShowPreview(true)
                    }
                  } catch (e) {
                    console.error('Preview error:', e)
                  } finally {
                    setIsLoadingPreview(false)
                  }
                }}
                disabled={isLoadingPreview}
                className={`px-3 py-1 border border-gray-300 rounded text-xs flex items-center justify-center gap-1 w-20 ${isLoadingPreview ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
              >
                {isLoadingPreview && <div className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>}
                {isLoadingPreview ? 'Loading...' : 'Preview'}
              </button>
              <div className="absolute left-0 top-full mt-1 z-50 hidden group-hover/preview:block w-48 bg-gray-800 text-white text-xs rounded px-2 py-1.5 shadow-lg pointer-events-none">
                See your resume at actual page size before downloading.
              </div>
            </div>

            {/* Undo */}
            <button
              onClick={undo}
              disabled={historyIndex <= 0}
              className={`px-3 py-1 border border-gray-300 rounded text-xs font-medium transition-all ${
                historyIndex <= 0 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-50'
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

              {/* Score */}
              {score && (
                <div className={`px-3 py-1 rounded font-semibold text-xs ${
                  score >= 85 ? 'bg-green-100 text-green-700' :
                  score >= 71 ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  📊 {score}/100
                </div>
              )}

              {/* Re-assess */}
              <button
                onClick={() => handleReassess()}
                disabled={isAnalyzing || journeyStep === 'review'}
                className={`px-3 py-1 border border-gray-300 rounded text-xs flex items-center justify-center gap-1 w-20 whitespace-nowrap ${
                  isAnalyzing || journeyStep === 'review' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'
                }`}
                title={journeyStep === 'review' ? 'Run initial assessment first' : ''}
              >
                {isAnalyzing && journeyStep !== 'review' && (
                  <div className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>
                )}
                {isAnalyzing && journeyStep !== 'review' ? 'Analyzing...' : 'Re-assess'}
              </button>

              {/* Download */}
              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className={`px-3 py-1 rounded text-xs font-medium flex items-center justify-center gap-1 w-20 ${
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
        </div>
      

    {/* Main Content: Resume + Right Panel */}
         <div className="flex-1 flex overflow-hidden" style={{ height: 'calc(100vh - 160px)' }}>
        <div className="flex-1 flex gap-6 p-6 max-w-7xl mx-auto w-full">
          <div className="flex-[3] bg-white rounded-lg shadow-sm border border-gray-200 overflow-y-auto relative">
            <div
              data-resume-content="true"
              style={{
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'top left',
                width: '816px',
                position: 'relative',
fontFamily: selectedFont,
                fontSize: `${selectedSize}pt`,
              }}
            >
                 <ResumeContent
                  resumeData={resumeData}
                  onUpdate={updateResumeData}
                  isUndoingRef={isUndoingRef}
                  formatDate={formatDate}
                  templateStyles={getTemplateStyles(selectedTemplate, accentColor, selectedSize, selectedFont)}
                />
            </div>
          </div>

   <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-y-auto px-6 pb-6">
       <RightPanel 
              journeyStep={journeyStep}
              score={score}
              analysisResults={analysisResults}
              userTier={userProfile?.subscription_tier || 'free'}
              coachingSamplesUsed={coachingSamplesUsed}
              resumeName={resume.display_name || 'Core Resume'}
              userName={userProfile?.display_name || resumeData.fullName}
              userProfile={userProfile}
              supabase={supabase}
              params={params}
              setResume={setResume}
              handleReassess={handleReassess}
              isAnalyzing={isAnalyzing}
              detectedLevel={detectedLevel}
              resumeData={resumeData}
              careerContext={careerContext}
             rewrittenResume={rewrittenResume}
              setRewrittenResume={setRewrittenResume}
              resumeChanges={resumeChanges}
              setResumeChanges={setResumeChanges}
              coachingMessages={coachingMessages}
              setCoachingMessages={setCoachingMessages}
              showRevealModal={showRevealModal}
              setShowRevealModal={setShowRevealModal}
              scoreBeforeCoaching={scoreBeforeCoaching}
              setScoreBeforeCoaching={setScoreBeforeCoaching}
              scoreAfterCoaching={scoreAfterCoaching}
              resume={resume}
            />
          </div>
        </div>
      </div>
      </div>
      {/* Too Long Modal */}
      {showTooLongModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)' }}
          onClick={() => setShowTooLongModal(false)}
        >
          <div
            className="bg-white shadow-2xl max-w-md w-full overflow-hidden border border-gray-200"
            onClick={(e) => e.stopPropagation()}
            style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', borderRadius: '8px' }}
          >
            <div
              style={{ background: 'linear-gradient(to bottom right, rgb(147 51 234), rgb(37 99 235))' }}
              className="px-6 py-5 relative"
            >
              <button
                onClick={() => setShowTooLongModal(false)}
                className="absolute top-4 right-4 text-white hover:text-gray-200 text-3xl leading-none font-light"
              >×</button>
              <div className="flex items-center gap-3">
                <img src="/images/Hire_Power_icon.png" alt="Hire Power" className="h-8 w-auto flex-shrink-0" />
                <div>
                  <h2 className="text-xl font-bold text-white">Resume Too Long</h2>
                  <p className="text-purple-100 text-xs">Auto-fit couldn't squeeze everything onto one page.</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-5">
              <p className="text-gray-700 mb-3">Your resume has more content than can fit on one page, even at the smallest font size.</p>
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-l-4 border-purple-600 p-3 mb-5">
                <p className="text-sm text-gray-800">Try removing older jobs, trimming bullets to your most impactful ones, or shortening your summary.</p>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setShowTooLongModal(false)}
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm font-semibold"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-8">
          <div className="bg-white rounded-lg w-full max-w-4xl h-full max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="text-lg font-semibold">Resume Preview</h3>
                <p className="text-sm text-gray-500 mt-0.5">Need help with page fit? Use <span className="font-medium text-purple-600">⚡ Auto-fit</span> in the toolbar. It automatically adjusts font size and spacing to best fill one page, whether your resume is too long or too short.</p>
              </div>
              <button
                onClick={() => {
                  setShowPreview(false)
                  if (previewUrl) window.URL.revokeObjectURL(previewUrl)
                  setPreviewUrl(null)
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              {previewUrl && (
                <iframe
                  src={`${previewUrl}#toolbar=0`}
                  className="w-full h-full"
                  title="Resume Preview"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// Right Panel Component
function RightPanel({ journeyStep, score, analysisResults, userTier, resumeName, userName, userProfile, supabase, params, setResume, handleReassess, isAnalyzing, detectedLevel, resumeData, careerContext, rewrittenResume, setRewrittenResume, resumeChanges, setResumeChanges, coachingMessages, setCoachingMessages, showRevealModal, setShowRevealModal, scoreBeforeCoaching, setScoreBeforeCoaching, scoreAfterCoaching, coachingSamplesUsed, resume, showUpgradeModal, setShowUpgradeModal }) {  
  const isJobSpecific = resume?.resume_type === 'job_specific'
  const jobAnalysis = analysisResults?.analysis || analysisResults || {}
  const matchedCount = jobAnalysis.matchedCount ?? jobAnalysis.matchedKeywords?.length ?? 0
  const missingCount = jobAnalysis.missingCount ?? jobAnalysis.missingKeywords?.length ?? 0

  const steps = isJobSpecific
    ? (userTier === 'free'
        ? ['assess', 'save']
        : ['assess', 'coach', 'improve', 'polish', 'save'])
    : (userTier === 'free'
        ? ['review', 'assess', 'coach', 'improve', 'save']
        : ['review', 'assess', 'coach', 'improve', 'polish', 'save'])
 const currentIndex = steps.indexOf(journeyStep)
  const [isUpdatingJourney, setIsUpdatingJourney] = useState(false)
  const [maxStepIndex, setMaxStepIndex] = useState(currentIndex)

  useEffect(() => {
    if (currentIndex > maxStepIndex) {
      setMaxStepIndex(currentIndex)
    }
  }, [currentIndex])
  const panelRef = useRef(null)

  // Scroll to top when journey step changes to 'assess'
  useEffect(() => {
    if (journeyStep === 'assess' && panelRef.current) {
      panelRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [journeyStep])

 return (
    <div ref={panelRef} className="overflow-y-auto overflow-x-hidden h-full pr-3">
      
  <div className={`sticky top-0 bg-white -mx-6 px-6 pt-6 z-10 ${isJobSpecific && userTier === 'free' ? 'mb-2 pb-2 shadow-sm' : 'mb-6 pb-4 shadow-sm'}`}>
 {isJobSpecific ? (
        <div className="mb-3 text-center">
          <h3 className="font-bold text-sm text-gray-900 leading-tight">{resumeName}</h3>
          {(userTier !== 'free') && (
            <div className="mt-3">
              <p className="text-[10px] text-purple-600 font-semibold uppercase tracking-wide">Resume Tailoring Progress</p>
            </div>
          )}
        </div>
      ) : (
        <h3 className="text-center font-semibold text-sm mb-3">
          {userName ? `${userName.split(' ')[0]}'s ` : ''}{resumeName} Progress
        </h3>
      )}
        
        <div className={`relative ${isJobSpecific && userTier === 'free' ? 'hidden' : ''}`}>
          <div className="absolute top-3 left-0 right-0 h-0.5 bg-gray-300">
            <div 
              className="h-full bg-purple-600 transition-all duration-300"
              style={{ width: `${maxStepIndex >= 0 ? (maxStepIndex / (steps.length - 1)) * 100 : 0}%` }}
            />
          </div>
          
        <div className={`relative flex justify-between ${isJobSpecific && userTier === 'free' ? 'hidden' : ''}`}>
            {steps.map((step, index) => (
              <div key={step} className="flex flex-col items-center">
                <div
                  onClick={async () => {
                 if (index > maxStepIndex || index === currentIndex) return
                    setResume(prev => ({ ...prev, journey_step: step }))
                  }}
                  className={`
                    w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold z-10
                   ${index < currentIndex ? 'bg-purple-600 text-white cursor-pointer hover:bg-purple-800 transition-colors' : 
                    index === currentIndex ? 'bg-purple-600 text-white' :
                    index <= maxStepIndex ? 'bg-purple-600 text-white cursor-pointer hover:bg-purple-800 transition-colors' :
                    'bg-white border-2 border-gray-300 text-gray-400'}
                  `}>
                 {index < currentIndex ? '✓' : index === currentIndex ? '●' : index <= maxStepIndex ? '✓' : '○'}
                </div>
                <span
                  onClick={async () => {
                    if (index >= currentIndex) return
                    const { error } = await supabase
                      .from('resumes')
                      .update({ journey_step: step, updated_at: new Date().toISOString() })
                      .eq('id', params.id)
                    if (!error) setResume(prev => ({ ...prev, journey_step: step }))
                  }}
                 className={`text-xs mt-1 capitalize ${
                    index === currentIndex ? 'text-purple-600 font-semibold' :
                    index <= maxStepIndex ? 'text-purple-600 cursor-pointer hover:underline' :
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

          <div className="flex justify-center">
  <button 
   onClick={() => handleReassess()}
    disabled={isAnalyzing}
    className={`bg-purple-600 text-white rounded-lg px-6 py-2 font-medium text-sm transition-colors flex items-center justify-center gap-2 ${
      isAnalyzing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-purple-700'
    }`}
  >
    {isAnalyzing && (
      <div className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>
    )}
    {isAnalyzing ? 'Analyzing...' : 'Looks Good → Assess Resume'}
  </button>
</div>
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

  {journeyStep === 'assess' && isJobSpecific && (
  <div className="space-y-4">
    <div className="text-center mt-3">
      <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Job Match Score</div>
      <div className="flex items-baseline justify-center gap-1 mb-2">
        <span className="text-5xl font-bold text-gray-900">{score || '--'}</span>
        <span className="text-xl text-gray-400">%</span>
      </div>
      <div className="h-4 bg-gray-200 rounded-full overflow-hidden mb-2 shadow-inner">
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${score || 0}%`,
            background: (score || 0) >= 85 ? '#81c784' : (score || 0) >= 71 ? '#ffc870' : '#e57373'
          }}
        />
      </div>
      <div className="flex items-center justify-center gap-2 text-[10px] text-gray-800">
        <div className="flex items-center gap-0.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#e57373' }}></div>
          <span>Needs Work <span className="text-gray-500">(0-70)</span></span>
        </div>
        <div className="flex items-center gap-0.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#ffc870' }}></div>
          <span>Strong <span className="text-gray-500">(71-84)</span></span>
        </div>
        <div className="flex items-center gap-0.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#81c784' }}></div>
          <span>Excellent <span className="text-gray-500">(85+)</span></span>
        </div>
      </div>
    </div>

  {userTier === 'free' ? (
      <>
        {(matchedCount || missingCount) ? (
          <p className="text-xs text-gray-700 text-center -mt-1">
            You meet <span className="font-semibold text-gray-900">{matchedCount} of {matchedCount + missingCount}</span> requirements for this role.
          </p>
        ) : null}

        {(() => {
          const positiveBullets = (Array.isArray(jobAnalysis.summary) ? jobAnalysis.summary : []).filter(s => s.startsWith('✓'))
          const visible = positiveBullets.slice(0, 2)
          const hasMore = positiveBullets.length > 2 || missingCount > 0
          return (
            <ul className="space-y-1.5 text-left">
              {visible.map((sentence, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                  <span className="text-purple-600 mt-0.5 flex-shrink-0">✓</span>
                  <span>{sentence.slice(1).trim()}</span>
                </li>
              ))}
              {hasMore && (
               <li className="flex items-start gap-2 text-xs text-gray-700">
                  <span className="mt-0.5 flex-shrink-0">⚠️</span>
                 <span className="text-purple-600 font-semibold">Additional strengths and opportunities identified — upgrade to reveal</span>
                </li>
              )}
            </ul>
          )
        })()}

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <p className="text-xs font-semibold text-purple-800 mb-2">
            🔒 {matchedCount} skills matched · {missingCount} to address
          </p>
          <p className="text-xs text-gray-600 mb-3">Upgrade to Pro to see exactly what's missing and get personalized coaching to close the gap — so your resume becomes a stronger match for this specific job.</p>
          <button
            onClick={() => setShowUpgradeModal(true)}
            className="w-full bg-purple-600 text-white rounded-lg py-2 px-4 text-xs font-semibold hover:bg-purple-700 transition-colors"
          >
            Close the Gap on This Job →
          </button>
          {(() => {
            const s = score || 0
            const msg = s >= 85
              ? <>Even strong matches get sharper! Pro users typically gain <span className="font-semibold">3–5 points</span> closing specific skill gaps on their resume.</>
              : s >= 71
              ? <>Pro users who coach this type of resume see an average <span className="font-semibold">8-point score improvement.</span></>
              : <>Pro users who coach low-match resumes see an average <span className="font-semibold">12-point score improvement.</span></>
            return (
              <div className="border-l-4 border-purple-400 pl-2 mt-3">
                <p className="text-xs text-gray-500 italic leading-snug">{msg}</p>
              </div>
            )
          })()}
          <div className="text-center mt-3">
            <button
              onClick={() => window.location.href = '/my-resumes'}
              className="text-gray-400 text-xs hover:text-gray-600"
            >
              ← Back to My Resumes
            </button>
          </div>
        </div>
      </>
    ) : (
      <>
        {/* Summary bullets */}
        <ul className="space-y-1.5 text-left">
          {(Array.isArray(analysisResults?.analysis?.summary) ? analysisResults.analysis.summary : [])
            .map((sentence, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                <span className={`mt-0.5 flex-shrink-0 ${sentence.startsWith('○') ? 'text-gray-400' : 'text-purple-600'}`}>
                  {sentence.startsWith('○') ? '○' : '✓'}
                </span>
                <span>{sentence.slice(1).trim()}</span>
              </li>
            ))}
        </ul>

        {/* Matched Skills */}
        {analysisResults?.analysis?.matchedKeywords?.length > 0 && (
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#81c784' }}>✅ Matched Skills</h4>
            <div className="flex flex-wrap gap-1.5">
              {analysisResults.analysis.matchedKeywords.map((kw, i) => (
                <span key={i} className="bg-green-50 border border-green-200 text-green-800 text-xs px-2 py-0.5 rounded-full">{kw}</span>
              ))}
            </div>
          </div>
        )}

        {/* Missing Skills */}
        {analysisResults?.analysis?.missingKeywords?.length > 0 && (
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#e57373' }}>⚠️ Skills to Address</h4>
            <div className="flex flex-wrap gap-1.5">
              {analysisResults.analysis.missingKeywords.map((kw, i) => (
                <span key={i} className="bg-red-50 border border-red-200 text-red-700 text-xs px-2 py-0.5 rounded-full">{kw}</span>
              ))}
            </div>
          </div>
        )}

       <button
          onClick={async () => {
            setIsUpdatingJourney(true)
            try {
              const { error } = await supabase
                .from('resumes')
                .update({ journey_step: 'coach', updated_at: new Date().toISOString() })
                .eq('id', params.id)
              if (!error) setResume(prev => ({ ...prev, journey_step: 'coach' }))
            } finally {
              setIsUpdatingJourney(false)
            }
          }}
          disabled={isUpdatingJourney}
          className="block mx-auto bg-purple-600 text-white rounded-lg py-2 px-4 text-xs font-semibold hover:bg-purple-700 transition-colors"
        >
          Start Job Coaching →
        </button>
      </>
    )}
  </div>
)}
     {journeyStep === 'assess' && !isJobSpecific && (
        <div className="space-y-3">
       {/* Header */}
        <div className="flex items-center justify-center gap-6 -mt-1">
              <div className="text-center">
                <div className="text-sm text-gray-600 leading-tight">Assessment Complete!</div>
                <div className="text-sm text-gray-900 font-semibold">Resume Power Score</div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-gray-900">{score || 62}</span>
                <span className="text-lg text-gray-600">/100</span>
              </div>
            </div>
          
         {/* Progress Bar */}
<div>
  <div className="h-4 bg-gray-200 rounded-full overflow-hidden mb-2 shadow-inner">
    <div 
      className="h-full transition-all duration-500"
      style={{ 
        width: `${score || 62}%`,
        background: (score || 62) >= 85 ? '#81c784' : (score || 62) >= 71 ? '#ffc870' : '#e57373'
      }}
    />
  </div>
  
  <div className="flex items-center justify-center gap-2 text-[10px] text-gray-600">
  <div className="flex items-center gap-0.5">
    <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#e57373' }}></div>
    <span>Needs Work <span className="text-gray-400">(0-70)</span></span>
  </div>
  <div className="flex items-center gap-0.5">
    <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#ffc870' }}></div>
    <span>Strong <span className="text-gray-400">(71-84)</span></span>
  </div>
  <div className="flex items-center gap-0.5">
    <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#81c784' }}></div>
    <span>Excellent <span className="text-gray-400">(85+)</span></span>
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
  className="h-full"
  style={{ 
    width: `${((analysisResults?.analysis?.breakdown?.impact || 20)/40)*100}%`,
    background: (analysisResults?.analysis?.breakdown?.impact || 20)/40 >= 0.8 ? '#81c784' : 
                (analysisResults?.analysis?.breakdown?.impact || 20)/40 >= 0.6 ? '#ffc870' : 
                '#e57373'
  }}
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
  className="h-full"
  style={{ 
    width: `${((analysisResults?.analysis?.breakdown?.clarity || 28)/40)*100}%`,
    background: (analysisResults?.analysis?.breakdown?.clarity || 28)/40 >= 0.8 ? '#81c784' : 
                (analysisResults?.analysis?.breakdown?.clarity || 28)/40 >= 0.6 ? '#ffc870' : 
                '#e57373'
  }}
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
  className="h-full"
  style={{ 
    width: `${((analysisResults?.analysis?.breakdown?.keywords || 14)/20)*100}%`,
    background: (analysisResults?.analysis?.breakdown?.keywords || 14)/20 >= 0.8 ? '#81c784' : 
                (analysisResults?.analysis?.breakdown?.keywords || 14)/20 >= 0.6 ? '#ffc870' : 
                '#e57373'
  }}
></div>
                  </div>
                </div>
              </div>
            </div>
          
         {/* Strengths */}
          <div className="pt-3 border-t border-gray-300">
           <h3 className="text-sm font-bold uppercase tracking-wide mb-1.5" style={{ color: '#81c784' }}>✅ What's Working</h3>
            <ul className="space-y-1">
              {(analysisResults?.analysis?.strengths || [
                "Strong quantification throughout with specific numbers demonstrating scope and impact.",
                "Action verbs consistently demonstrate ownership and leadership.",
                "Professional formatting maintains clear, readable structure.",
                "Skills section includes relevant technical and soft skills."
              ]).map((strength, i) => (
                <li key={i} className="text-xs text-gray-700 flex gap-2 leading-snug">
                  <span className="text-green-600 flex-shrink-0">•</span>
                  <span>{strength}</span>
                </li>
              ))}
            </ul>
          </div>
          
          {/* Weaknesses */}
          <div className="pt-3 border-t border-gray-300">
           <h3 className="text-sm font-bold uppercase tracking-wide mb-1.5" style={{ color: '#e57373' }}>⚠️ What's Missing</h3>
            <ul className="space-y-1">
              {(analysisResults?.analysis?.weaknesses || [
                "Three experience bullets lack quantifiable metrics or measurable outcomes.",
                "Vague language such as 'managed team' without specifying team size or budget.",
                "Generic claim of 'improved efficiency' requires percentage or specific timeframe.",
                "Missing keywords from target job description in technical skills section.",
                "Education section could benefit from relevant coursework or academic honors.",
                "Event coordination lacks scope indicators such as event count or budget details."
              ]).map((weakness, i) => (
                <li key={i} className="text-xs text-gray-700 flex gap-2 leading-snug">
                  <span className="text-red-600 flex-shrink-0">•</span>
                  <span>{weakness}</span>
                </li>
              ))}
            </ul>
          </div>
          
          {/* Suggestions */}
          <div className="pt-3 border-t border-gray-300">
           <h3 className="text-sm font-bold uppercase tracking-wide mb-1.5" style={{ color: '#ffc870' }}>🎯 Action Plan</h3>
            <ul className="space-y-1">
              {(analysisResults?.analysis?.suggestions || [
                "Add team size (e.g., 'Led team of 8') and budget amounts to management role descriptions.",
                "Quantify efficiency improvement with specific metrics: '30% faster turnaround' or 'saved 10 hours weekly'.",
                "Include 2-3 technical skills from job description, such as Salesforce, Tableau, or Asana.",
                "Add specific event metrics: '60+ annual events with 200-500 attendees, $50K average budget'.",
                "Strengthen education section: include GPA if above 3.5, relevant coursework, or academic honors.",
                "Replace weak verbs like 'helped' and 'responsible for' with action verbs showing direct impact."
              ]).map((suggestion, i) => (
                <li key={i} className="text-xs text-gray-700 flex gap-2 leading-snug">
                  <span className="text-yellow-600 flex-shrink-0">•</span>
                  <span>{suggestion}</span>
                </li>
              ))}
            </ul>
          </div>          
{/* CTA */}
          <div className="pt-3 border-t border-gray-300">
        {userTier === 'free' ? (
              // FREE TIER - Go to coaching
              <div className="space-y-3">
                <div className="text-center">
                  <h4 className="font-semibold text-gray-900 mb-1">What's Next?</h4>
            
                </div>
                <button
                  onClick={async () => {
                    setIsUpdatingJourney(true)
                    try {
                      const { error } = await supabase
                        .from('resumes')
                        .update({
                          journey_step: 'coach',
                          updated_at: new Date().toISOString()
                        })
                        .eq('id', params.id)
                      if (error) throw error
                      setResume(prev => ({ ...prev, journey_step: 'coach' }))
                    } catch (err) {
                      console.error('Error:', err)
                      alert('Something went wrong. Please try again.')
                    } finally {
                      setIsUpdatingJourney(false)
                    }
                  }}
                  disabled={isUpdatingJourney}
                  className={`mx-auto block bg-purple-600 text-white rounded-lg py-2 px-4 text-xs font-semibold transition-colors -mt-1 ${
                    isUpdatingJourney ? 'opacity-75 cursor-not-allowed' : 'hover:bg-purple-700'
                  }`}
                >
                  Start Free Coaching Trial →
                </button>
                <p className="text-xs text-gray-500 text-center">
                  Pro users avg <strong className="text-purple-600">+16 pts</strong> after full coaching
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
       
      {journeyStep === 'coach' && (
              <CoachStep
          resumeData={resumeData}
          careerContext={careerContext}
          detectedLevel={detectedLevel}
          userName={userName}
          userProfile={userProfile}
          supabase={supabase}
          params={params}
          setResume={setResume}
          coachingMessages={coachingMessages}
          setCoachingMessages={setCoachingMessages}
          setRewrittenResume={setRewrittenResume}
          setResumeChanges={setResumeChanges}
          userTier={userTier}
          trialCoachingUsed={resume?.trial_coaching_used || false}
          isJobSpecific={isJobSpecific}
          jobDescription={resume?.job_description || null}
          jobTitle={resume?.job_title || null}
          jobCompany={resume?.job_company || null}
          analysisResults={analysisResults}
          showUpgradeModal={showUpgradeModal}
          setShowUpgradeModal={setShowUpgradeModal}
        />
      )}

   {journeyStep === 'improve' && (
       <ImproveStep
          rewrittenResume={rewrittenResume}
          resumeChanges={resumeChanges}
          setRewrittenResume={setRewrittenResume}
          setResumeChanges={setResumeChanges}
          originalResumeData={resumeData}
          resumeData={resumeData}
          userTier={userTier}
          analysisResults={analysisResults}
          supabase={supabase}
          params={params}
          setResume={setResume}
          score={score}
          handleReassess={handleReassess}
         showRevealModal={showRevealModal}
          setShowRevealModal={setShowRevealModal}
          scoreBeforeCoaching={scoreBeforeCoaching}
          setScoreBeforeCoaching={setScoreBeforeCoaching}
          scoreAfterCoaching={scoreAfterCoaching}
          coachingSamplesUsed={coachingSamplesUsed}
        />
      )}

      {journeyStep === 'polish' && (
  <PolishStep
    supabase={supabase}
    params={params}
    setResume={setResume}
    handleReassess={handleReassess}
    isAnalyzing={isAnalyzing}
    score={score}
    userTier={userTier}
  />
)}

     {journeyStep === 'save' && (
        <SaveStep
          resumeName={resumeName}
          userName={userName}
          params={params}
          isJobSpecific={isJobSpecific}
          userTier={userTier}
        />
      )}
    </div>
  )
}
// ─────────────────────────────────────────────
// COACH STEP
// ─────────────────────────────────────────────
function CoachStep({ resumeData, careerContext, detectedLevel, userName, userProfile, supabase, params, setResume, coachingMessages, setCoachingMessages, setRewrittenResume, setResumeChanges, userTier: userTierProp, trialCoachingUsed, isJobSpecific, jobDescription, jobTitle, jobCompany, analysisResults, showUpgradeModal, setShowUpgradeModal }) {
  const [userInput, setUserInput] = useState('')
  const [sending, setSending] = useState(false)
  const [isFinishing, setIsFinishing] = useState(false)
  const [userTier, setUserTier] = useState(userTierProp || null)
  const [trialComplete, setTrialComplete] = useState(false)
  const [trialResult, setTrialResult] = useState(null)
  const [showTrialRevealModal, setShowTrialRevealModal] = useState(false)
  const [editingBullet, setEditingBullet] = useState(false)
  const [editedBullet, setEditedBullet] = useState('')
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const previousMessageCount = useRef(0)

const getMessageText = (msg) => {
    if (!msg.content) return ''
    if (typeof msg.content === 'string') return msg.content
    if (Array.isArray(msg.content)) return msg.content.map(b => b.text || '').join(' ')
    return ''
  }

  const isProCoachingComplete = coachingMessages.some(msg =>
    msg.role === 'assistant' && (
      getMessageText(msg).toLowerCase().includes('click the button below') ||
      getMessageText(msg).toLowerCase().includes('finish coaching')
    )
  )

  const isTrialCoachingComplete = coachingMessages.some(msg =>
    msg.role === 'assistant' && (
      getMessageText(msg).toLowerCase().includes('click the button below') ||
      getMessageText(msg).toLowerCase().includes('finish coaching')
    )
  )

  // Auto-scroll and re-focus after each exchange
  useEffect(() => {
    const hasUserMessage = coachingMessages.some(m => m.role === 'user')
    if (hasUserMessage && coachingMessages.length > previousMessageCount.current && previousMessageCount.current > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      setTimeout(() => {
        inputRef.current?.focus({ preventScroll: true })
      }, 100)
    }
    previousMessageCount.current = coachingMessages.length
  }, [coachingMessages])

  // Check tier + start coaching if no messages yet
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', user.id)
        .single()

      const tier = profile?.subscription_tier || 'free'
      setUserTier(tier)

      const hasRealMessages = coachingMessages.some(m => m.content && typeof m.content === 'string' && m.content.trim().length > 0)
      if (coachingMessages.length === 0 || !hasRealMessages) {
        await startCoaching(tier)
      }
    }
    init()
  }, [])

  async function startCoaching(tier) {
    setSending(true)
    try {
      const response = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeData,
          careerContext,
          detectedLevel,
          displayName: userName,
          tier: tier,
          isJobSpecific,
          jobDescription,
          jobTitle,
          jobCompany,
          conversation: [{ role: 'user', content: "Hi! I'm ready to work on my resume." }]
        })
      })
      const data = await response.json()
      if (!data.response) throw new Error('No response from coach API')
      const initialMessages = [{ role: 'assistant', content: data.response }]
      setCoachingMessages(initialMessages)

      await supabase
        .from('resumes')
        .update({ coaching_conversation: initialMessages })
        .eq('id', params.id)
    } catch (err) {
      console.error('Error starting coaching:', err)
    } finally {
      setSending(false)
      setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 100)
    }
  }

  async function sendMessage() {
    if (!userInput.trim() || sending) return

    const newMessage = { role: 'user', content: userInput }
    const updatedMessages = [...coachingMessages, newMessage]
    setCoachingMessages(updatedMessages)
    setUserInput('')
    setSending(true)

    try {
     const response = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeData,
          careerContext,
          detectedLevel,
          displayName: userName,
          tier: userTier,
          isJobSpecific,
          jobDescription,
          jobTitle,
          jobCompany,
          conversation: updatedMessages
        })
      })
      const data = await response.json()
      const finalMessages = [...updatedMessages, { role: 'assistant', content: data.response }]
      setCoachingMessages(finalMessages)

      await supabase
        .from('resumes')
        .update({ coaching_conversation: finalMessages })
        .eq('id', params.id)
    } catch (err) {
      console.error('Error sending message:', err)
    } finally {
      setSending(false)
      setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 100)
    }
  }

    async function finishCoaching() {
    setIsFinishing(true)
    try {
      const response = await fetch('/api/coach-finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeData,
          conversation: coachingMessages,
          detectedLevel,
          careerContext,
          isJobSpecific: isJobSpecific || false,
          jobDescription: jobDescription || null,
          jobTitle: jobTitle || null,
          jobCompany: jobCompany || null,
          matchedKeywords: analysisResults?.analysis?.matchedKeywords || [],
          missingKeywords: analysisResults?.analysis?.missingKeywords || []
        })
      })
      const data = await response.json()
      if (!data.rewrittenResume) throw new Error('Rewrite failed')

      setRewrittenResume(data.rewrittenResume)
      setResumeChanges(data.changes || [])

      await supabase
        .from('resumes')
        .update({
          journey_step: 'improve',
          coaching_conversation: coachingMessages,
          rewritten_resume: data.rewrittenResume,
          resume_changes: data.changes || [],
          updated_at: new Date().toISOString()
        })
        .eq('id', params.id)

      setResume(prev => ({ ...prev, journey_step: 'improve', resume_data: data.rewrittenResume }))
    } catch (err) {
      console.error('Error finishing coaching:', err)
      alert('Something went wrong generating your resume. Please try again.')
    } finally {
      setIsFinishing(false)
    }
  }

  async function finishTrialCoaching() {
    setIsFinishing(true)
    try {
      const response = await fetch('/api/trial-coach-finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeData,
          conversation: coachingMessages,
          detectedLevel,
          careerContext
        })
      })
      const data = await response.json()

      await supabase
        .from('resumes')
        .update({
          trial_coaching_used: true,
          coaching_conversation: coachingMessages,
          updated_at: new Date().toISOString()
        })
        .eq('id', params.id)

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('coaching_samples_used')
          .eq('id', user.id)
          .single()
        await supabase
          .from('profiles')
          .update({ coaching_samples_used: (profile?.coaching_samples_used || 0) + 1 })
          .eq('id', user.id)
      }

      setTrialResult(data)
      setEditedBullet(data.after)
      setTrialComplete(true)
      setShowTrialRevealModal(true)
    } catch (err) {
      console.error('Error finishing trial:', err)
      alert('Something went wrong. Please try again.')
    } finally {
      setIsFinishing(false)
    }
  }

  async function applyTrialBullet(bulletText) {
    try {
      const updatedResume = JSON.parse(JSON.stringify(resumeData))
      const job = updatedResume.experience?.[0]
      if (job && trialResult?.before) {
        const bulletIndex = job.bullets?.findIndex(b => b === trialResult.before)
        if (bulletIndex !== -1) {
          job.bullets[bulletIndex] = bulletText
        } else {
          job.bullets = job.bullets || []
          job.bullets[0] = bulletText
        }
      }

      await supabase
        .from('resumes')
        .update({
          resume_data: updatedResume,
          journey_step: 'improve',
          updated_at: new Date().toISOString()
        })
        .eq('id', params.id)

      setResume(prev => ({ ...prev, resume_data: updatedResume, journey_step: 'improve' }))
    } catch (err) {
      console.error('Error applying bullet:', err)
      await advanceToImprove()
    }
  }

  async function advanceToImprove() {
    await supabase
      .from('resumes')
      .update({ journey_step: 'improve', updated_at: new Date().toISOString() })
      .eq('id', params.id)
    setResume(prev => ({ ...prev, journey_step: 'improve' }))
  }

  // ── Already used trial → upsell ──
  if (trialCoachingUsed && !trialComplete) {
    return (
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">💬 Resume Coach</h3>
        <div className="bg-purple-50 rounded-lg p-4">
          <p className="font-semibold text-gray-900 mb-2">You've used your free coaching session</p>
          <p className="text-sm text-gray-600 mb-4">
            Upgrade to Pro to coach every job, every bullet, and uncover skills you didn't know belonged on a resume.
          </p>
          <div className="bg-white rounded-lg p-3 mb-4 border border-purple-100">
            <p className="text-xs font-semibold text-purple-700 mb-2">Pro coaching includes:</p>
            <ul className="text-xs text-gray-600 space-y-1.5">
              <li>✓ Full conversation across all jobs</li>
              <li>✓ Every bullet improved automatically</li>
              <li>✓ Hidden skill identification</li>
              <li>✓ Achievement quantification</li>
              <li>✓ Before/after review for every change</li>
            </ul>
          </div>
          <p className="text-xs text-purple-700 font-medium mb-3 text-center">
            Pro users see an average <strong>16-point improvement</strong> after coaching.
          </p>
          <button
            onClick={() => setShowUpgradeModal(true)}
            className="w-full bg-purple-600 text-white rounded-lg px-6 py-2.5 text-sm font-semibold hover:bg-purple-700 transition-colors"
          >
            Upgrade to Pro →
          </button>
          <button
            onClick={advanceToImprove}
            className="w-full mt-2 text-gray-400 text-xs hover:text-gray-600 py-1 text-center"
          >
            Continue improving myself →
          </button>
        </div>
      </div>
    )
  }

  // ── Loading state ──
  if (userTier === null) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  // ── Main chat UI (free trial or pro) ──
  return (
    <>
      <div className="flex flex-col">
        <h3 className="font-semibold text-lg mb-1 -mt-3 flex-shrink-0">
          💬 {userTier === 'free' ? 'Free Coaching Trial' : 'Coaching in Progress'}
        </h3>

        {userTier === 'free' && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-2 flex-shrink-0">
            <p className="text-xs text-gray-600">
              <strong>Free trial:</strong> Try Resume Coach on one role and see how a single rewritten bullet can transform how your experience reads.
            </p>
          </div>
        )}

        {/* Messages */}
        <div className="space-y-2 mb-2">
          {coachingMessages.map((msg, index) => (
            <div key={index} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} mb-1.5`}>
              <div className={`rounded-lg px-2 py-1.5 text-xs leading-snug ${
                msg.role === 'assistant'
                  ? 'bg-purple-50 border border-purple-100 w-full'
                  : 'bg-gray-100 border border-gray-200 max-w-[90%]'
              }`}>
                {msg.role === 'assistant' ? (
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-sm">🎓</span>
                    <span className="text-[10px] font-semibold text-gray-500">Resume Coach</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 mb-1">
                    {userProfile?.photo_url ? (
                      <img src={userProfile.photo_url} alt="You" className="w-4 h-4 rounded-full object-cover" />
                    ) : (
                      <div className="w-4 h-4 rounded-full bg-purple-200 flex items-center justify-center text-purple-700 text-[8px] font-bold">
                        {userName?.charAt(0).toUpperCase() || 'Y'}
                      </div>
                    )}
                    <span className="text-[10px] font-semibold text-gray-500">{userName?.split(' ')[0] || 'You'}</span>
                  </div>
                )}
               <div className="text-gray-800" dangerouslySetInnerHTML={{
                  __html: getMessageText(msg)
                    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\n\n/g, '<br/><br/>')
                    .replace(/\n/g, '<br/>')
                }} />
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex">
              <div className="bg-purple-50 border border-purple-100 rounded-lg px-3 py-2 w-full">
                <p className="text-[10px] font-semibold text-gray-400 mb-0.5">Coach</p>
                <div className="flex gap-1 items-center">
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            </div>
          )}
          {coachingMessages.some(m => m.role === 'user') && <div ref={messagesEndRef} />}
        </div>

        {/* Input */}
        {!isProCoachingComplete && !isTrialCoachingComplete && (
          <div className="flex gap-2 flex-shrink-0">
            <textarea
              ref={inputRef}
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              placeholder="Type your response..."
              disabled={sending}
              rows={2}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
            />
            <button
              onClick={sendMessage}
              disabled={!userInput.trim() || sending}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors self-end"
            >
              Send
            </button>
          </div>
        )}

        {/* Pro finish button */}
        {isProCoachingComplete && userTier !== 'free' && (
          <div className="flex justify-center flex-shrink-0 mt-2">
            <button
              onClick={finishCoaching}
              disabled={isFinishing}
              className={`px-6 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
                isFinishing ? 'bg-gray-400 cursor-not-allowed text-white' : 'bg-purple-600 hover:bg-purple-700 text-white'
              }`}
            >
              {isFinishing && <div className="h-3 w-3 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>}
              {isFinishing ? 'Building your resume...' : '✨ Reveal My New Resume →'}
            </button>
          </div>
        )}

        {/* Trial finish button */}
       {isTrialCoachingComplete && userTier === 'free' && !trialComplete && (
          <div className="flex justify-center flex-shrink-0 mt-2">
            <button
              onClick={finishTrialCoaching}
              disabled={isFinishing}
              className={`px-6 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
                isFinishing ? 'bg-gray-400 cursor-not-allowed text-white' : 'bg-purple-600 hover:bg-purple-700 text-white'
              }`}
            >
              {isFinishing && <div className="h-3 w-3 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>}
              {isFinishing ? 'Analyzing your session...' : '⚡ Reveal My Coached Bullet →'}
            </button>
          </div>
        )}
      </div>

      {/* Trial Reveal Modal */}
      {showTrialRevealModal && trialResult && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.85)' }}
        >
          <div
            className="bg-white shadow-2xl w-full max-w-2xl border border-gray-200 flex flex-col"
            style={{ borderRadius: '8px' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Purple-only gradient header — matches improve modal exactly */}
            <div
              style={{ background: 'linear-gradient(to bottom right, #9333ea, #6b21a8)', borderRadius: '8px 8px 0 0' }}
              className="px-6 py-4 flex items-center justify-between flex-shrink-0"
            >
              <div className="flex items-center gap-3">
               <img src="/images/Hire_Power_icon.png" alt="Hire Power" className="h-8 w-auto flex-shrink-0" />
                <div>
                  <h2 className="text-base font-bold text-white">Your First Coached Bullet</h2>
                  <p className="text-purple-100 text-xs">
                    Resume Coach | {resumeData?.experience?.[0]?.company || resumeData?.experience?.[0]?.title || 'First Job'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTrialRevealModal(false)}
                className="text-white hover:text-gray-200 text-4xl leading-none font-light w-8 h-8 flex items-center justify-center"
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div className="flex flex-col flex-1 p-4 min-h-0">

              {/* Column labels */}
              <div className="grid grid-cols-2 gap-3 mb-1 flex-shrink-0">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Before</p>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">After</p>
              </div>

              {/* Before / After boxes */}
              <div className="grid grid-cols-2 gap-3 mb-3" style={{ minHeight: 0 }}>
                <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 overflow-y-auto" style={{ maxHeight: '120px' }}>
                  <p className="text-xs text-gray-600 leading-snug line-through decoration-red-400">
                    {trialResult.before}
                  </p>
                </div>

                {editingBullet ? (
                  <textarea
                    className="w-full text-xs text-gray-800 leading-snug bg-green-50 border border-green-200 rounded-lg p-2.5 outline-none resize-none"
                    style={{ maxHeight: '120px' }}
                    value={editedBullet}
                    onChange={e => setEditedBullet(e.target.value)}
                    autoFocus
                  />
                ) : (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-2.5 overflow-y-auto" style={{ maxHeight: '120px' }}>
                    <p className="text-xs text-gray-800 leading-snug font-medium">{editedBullet}</p>
                  </div>
                )}
              </div>

              {/* Why this is better — white bg, purple left border only */}
              <div className="bg-white border border-gray-100 border-l-4 border-l-purple-600 p-2.5 rounded-r mb-2 flex-shrink-0">
                <p className="text-[10px] font-bold text-purple-700 uppercase tracking-wide mb-0.5">Why this is better</p>
                <p className="text-xs text-gray-700 leading-snug">{trialResult.reason}</p>
              </div>

              {/* Action buttons */}
              <div className="flex-shrink-0 space-y-2">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => advanceToImprove()}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors whitespace-nowrap"
                  >
                    ✗ Keep Original
                  </button>
                  {!editingBullet ? (
                    <button
                      onClick={() => setEditingBullet(true)}
                      className="px-4 py-2 bg-white text-purple-600 border border-purple-300 rounded-lg text-xs font-medium hover:bg-purple-50 transition-colors whitespace-nowrap"
                    >
                      ✏️ Edit Change
                    </button>
                  ) : (
                    <button
                      onClick={() => setEditingBullet(false)}
                      className="px-4 py-2 bg-white text-gray-600 border border-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors whitespace-nowrap"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    onClick={() => applyTrialBullet(editedBullet)}
                    className="px-4 py-2 bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-xs font-semibold hover:bg-purple-200 transition-colors whitespace-nowrap"
                  >
                    ✓ Apply Change
                  </button>
                </div>

                {/* Upgrade CTA */}
                <div className="flex flex-col items-center gap-3 pt-5">
                  {trialResult.skillsCount > 0 && (
                    <p className="text-xs text-gray-600 text-center">
                      <strong className="text-purple-700">We identified {trialResult.skillsCount} skills</strong> in this conversation that aren't on your resume yet. <strong className="text-purple-700">Go Pro</strong> to see them!
                    </p>
                  )}
                  <button
                    onClick={() => setShowUpgradeModal(true)}
                    className="bg-purple-600 text-white rounded-lg px-6 py-2 text-xs font-semibold hover:bg-purple-700 transition-colors"
                  >
                    Upgrade to Pro → Coach My Entire Resume
                  </button>
                  <p className="text-xs text-gray-400">
                    We found this in <strong>5 minutes</strong> from one job. Imagine what's in the rest.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
   
   <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
      />

    </>
  )
}
// ─────────────────────────────────────────────
// IMPROVE STEP
// ─────────────────────────────────────────────
function ImproveStep({ rewrittenResume, resumeChanges, setRewrittenResume, setResumeChanges, originalResumeData, resumeData, supabase, params, setResume, score, handleReassess, isAnalyzing, showRevealModal, setShowRevealModal, scoreBeforeCoaching, setScoreBeforeCoaching, scoreAfterCoaching, userTier, analysisResults, coachingSamplesUsed }) {
  const [accepting, setAccepting] = useState(false)
  const [reviewMode, setReviewMode] = useState(false)
  const [currentChangeIndex, setCurrentChangeIndex] = useState(0)
  const [acceptedChanges, setAcceptedChanges] = useState([])
  const [rejectedChanges, setRejectedChanges] = useState([])
  const [showBeforeAfter, setShowBeforeAfter] = useState(false)
  const [showChangeModal, setShowChangeModal] = useState(false)
  const [editingChange, setEditingChange] = useState(false)
  const [editedText, setEditedText] = useState('')
  const [loading, setLoading] = useState(false)

  // Capture score before coaching when improve step loads
  useEffect(() => {
    if (score && !scoreBeforeCoaching) {
      setScoreBeforeCoaching(score)
    }
  }, [])

  // Load from Supabase on refresh if state is empty
  useEffect(() => {
    if (!rewrittenResume && supabase && params?.id) {
      setLoading(true)
      supabase
        .from('resumes')
        .select('rewritten_resume, resume_changes')
        .eq('id', params.id)
        .single()
        .then(({ data }) => {
          if (data?.rewritten_resume) {
            setRewrittenResume(data.rewritten_resume)
            setResumeChanges(data.resume_changes || [])
          }
        })
        .finally(() => setLoading(false))
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  // FREE USER VIEW — must come before rewrittenResume check (free users never have one)
  if (userTier === 'free') {
    const suggestions = analysisResults?.analysis?.suggestions || []
    const allSuggestions = [
      ...suggestions,
      'Replace weak verbs like "helped," "assisted," and "responsible for" with strong action verbs: Led, Built, Drove, Reduced, Increased, Designed, Managed.'
    ]

    return (
      <>
        <FreeImproveStep
          suggestions={allSuggestions}
          supabase={supabase}
          params={params}
          setResume={setResume}
          coachingSamplesUsed={coachingSamplesUsed}
          handleReassess={handleReassess}
          isAnalyzing={isAnalyzing}
          setShowRevealModal={setShowRevealModal}
        />

        {/* Score Reveal Modal — free users go to save, not polish */}
        {showRevealModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ backgroundColor: 'rgba(15, 10, 30, 0.75)' }}
          >
            <div className="relative flex items-center" style={{ width: '740px', height: '560px' }}>

              {/* Resume Thumbnail — left panel */}
              <div
                className="absolute left-0 bg-white shadow-2xl overflow-hidden"
                style={{ width: '420px', height: '560px', borderRadius: '0px', border: '1px solid #e5e7eb' }}
              >
                <div className="absolute inset-0 z-10" style={{ background: 'rgba(147, 51, 234, 0.06)' }} />
                <div
                  style={{ transform: 'scale(0.45)', transformOrigin: 'top left', width: '933px', pointerEvents: 'none' }}
                  className="p-8 font-sans"
                >
                  <ResumeContent
                    resumeData={resumeData}
                    onUpdate={() => {}}
                    isUndoingRef={{ current: false }}
                    formatDate={(d) => d || ''}
                    readOnly={true}
                  />
                </div>
                <div
                  className="absolute bottom-0 left-0 right-0 z-20 px-4 py-3"
                  style={{ background: 'linear-gradient(to top, rgba(255,255,255,0.95), transparent)' }}
                >
                  <p className="text-xs text-gray-400 text-center">Your improved resume</p>
                </div>
              </div>

              {/* Score Card — right, overlapping */}
              <div
                className="absolute bg-white shadow-2xl flex flex-col"
                style={{ width: '380px', borderRadius: '0px', border: '1px solid #e5e7eb', zIndex: 10, left: '320px', top: '50%', transform: 'translateY(-50%)' }}
              >
                <div
                  style={{ background: 'linear-gradient(to bottom right, #9333ea, #6b21a8)', borderRadius: '0' }}
                  className="px-6 py-5 text-center"
                >
                  <img src="/images/Hire_Power_icon.png" alt="Hire Power" className="h-8 w-auto mx-auto mb-1" />
                  <h2 className="text-xl font-bold text-white">Improvement Complete.</h2>
                </div>

                <div className="p-6 text-center">
                  {scoreBeforeCoaching && scoreAfterCoaching ? (
                    <div className="mb-4">
                      <div className="flex items-center justify-center gap-4 mb-2">
                        <div className="text-center">
                          <p className="text-xs text-gray-500 mb-1">Before</p>
                          <p className="text-5xl font-bold text-gray-400">{scoreBeforeCoaching}</p>
                        </div>
                        <div className="text-2xl text-purple-300">→</div>
                        <div className="text-center">
                          <p className="text-xs text-gray-500 mb-1">After</p>
                          <p className="text-5xl font-bold text-purple-600">{scoreAfterCoaching}</p>
                        </div>
                      </div>
                      {scoreAfterCoaching > scoreBeforeCoaching ? (
                        <p className="text-sm font-semibold text-green-600">
                          +{scoreAfterCoaching - scoreBeforeCoaching} points from your edits
                        </p>
                      ) : (
                        <p className="text-sm text-gray-500">Score held — your resume was already well-optimized.</p>
                      )}
                    </div>
                  ) : (
                    <div className="mb-4">
                      <p className="text-3xl font-bold text-purple-600">{scoreAfterCoaching || score}/100</p>
                      <p className="text-sm text-gray-500 mt-1">Resume scored</p>
                    </div>
                  )}

                  <div className="bg-purple-50 border border-purple-100 rounded-lg p-3 mb-5 text-left">
                    <p className="text-sm text-gray-700 leading-relaxed">
                      Your resume is ready to download and use for job applications. Want even more improvement? Upgrade to Pro for full coaching.
                    </p>
                  </div>

                  <button
                    onClick={async () => {
                      setShowRevealModal(false)
                      await supabase
                        .from('resumes')
                        .update({ journey_step: 'save', updated_at: new Date().toISOString() })
                        .eq('id', params.id)
                      setResume(prev => ({ ...prev, journey_step: 'save' }))
                    }}
                    className="w-full bg-purple-600 text-white rounded-lg py-3 font-semibold text-sm hover:bg-purple-700 transition-colors"
                  >
                    Save My Resume →
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}
      </>
    )
  }

  if (!rewrittenResume) {
    return (
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Review Your Improvements</h3>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-gray-700 mb-3">
            It looks like your coaching session results aren't loaded. This can happen after a page refresh.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm text-purple-600 hover:text-purple-700 font-medium"
          >
            Reload page →
          </button>
        </div>
        <p className="text-xs text-gray-500">
          If the issue persists, go back to the Coach step and click "Reveal My New Resume" again.
        </p>
      </div>
    )
  }

  async function acceptAll() {
    setAccepting(true)
    try {
      await supabase
        .from('resumes')
        .update({ resume_data: rewrittenResume, updated_at: new Date().toISOString() })
        .eq('id', params.id)

      setResume(prev => ({ ...prev, resume_data: rewrittenResume }))
      await handleReassess(rewrittenResume)
      setShowRevealModal(true)
    } catch (err) {
      console.error('Error accepting changes:', err)
      alert('Something went wrong. Please try again.')
    } finally {
      setAccepting(false)
    }
  }

  async function finishReview(explicitAccepted = null) {
    setAccepting(true)
    try {
      let finalData = JSON.parse(JSON.stringify(originalResumeData))
      const changesToApply = explicitAccepted || acceptedChanges
      changesToApply.forEach(change => {
        try {
          applyChange(finalData, change)
        } catch (e) {
          console.error('Error applying change:', change.field, e)
        }
      })

      await supabase
        .from('resumes')
        .update({ resume_data: finalData, updated_at: new Date().toISOString() })
        .eq('id', params.id)

      setResume(prev => ({ ...prev, resume_data: finalData }))
      await handleReassess(finalData)
      setReviewMode(false)
      setShowRevealModal(true)
    } catch (err) {
      console.error('Error finishing review:', err)
      alert('Something went wrong. Please try again.')
    } finally {
      setAccepting(false)
    }
  }

  function applyChange(data, change) {
    if (change.field === 'summary') {
      data.summary = change.after
      return
    }
    if (change.field === 'sectionOrder') {
      try {
        data.sectionOrder = JSON.parse(change.after)
      } catch {
        data.sectionOrder = change.after.split(',').map(s => s.trim()).filter(Boolean)
      }
      return
    }

   const expMatch = change.field.match(/^experience\[(\d+)\]\.bullets\[(\d+)\]$/)
    if (expMatch) {
      const [, jobIdx, bulletIdx] = expMatch
      if (!data.experience?.[parseInt(jobIdx)]) return
      if (change.type === 'removed') {
        data.experience[jobIdx].bullets.splice(bulletIdx, 1)
      } else {
        if (!data.experience[jobIdx].bullets) data.experience[jobIdx].bullets = []
        data.experience[jobIdx].bullets[bulletIdx] = change.after
      }
      return
    }

    const summaryMatch = change.field.match(/^experience\[(\d+)\]\.summary$/)
    if (summaryMatch) {
      const jobIdx = parseInt(summaryMatch[1])
      if (data.experience?.[jobIdx]) {
        data.experience[jobIdx].summary = change.after
      }
      return
    }

    const skillMatch = change.field.match(/^skillsCategories\.(.+)$/)
    if (skillMatch) {
      try {
        data.skillsCategories[skillMatch[1]] = JSON.parse(change.after)
      } catch {
        data.skillsCategories[skillMatch[1]] = change.after.split('|').map(s => s.trim()).filter(Boolean)
      }
      return
    }
  }

  if (reviewMode) {
    const currentChange = resumeChanges[currentChangeIndex]
    const totalChanges = resumeChanges.length
    const reviewedCount = acceptedChanges.length + rejectedChanges.length
    const isDone = currentChangeIndex >= totalChanges

    return (
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">🎉 Your New Resume is Ready!</h3>
        <p className="text-xs text-gray-500">Review each change below. Keep what you love, skip what you don't.</p>

        {/* Progress */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-gray-200 rounded-full">
            <div
              className="h-full bg-purple-600 rounded-full transition-all"
              style={{ width: `${(reviewedCount / totalChanges) * 100}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 whitespace-nowrap">{reviewedCount}/{totalChanges}</span>
        </div>

        {!isDone ? (
          <>
            <button
              onClick={() => setShowChangeModal(true)}
              className="w-full bg-purple-600 text-white rounded-lg py-2.5 font-semibold text-sm hover:bg-purple-700 transition-colors"
            >
              Review Change {currentChangeIndex + 1} of {totalChanges} →
            </button>
            <button
              onClick={() => {
                const remaining = resumeChanges.slice(currentChangeIndex)
                setAcceptedChanges(prev => [...prev, ...remaining])
                setCurrentChangeIndex(totalChanges)
              }}
              className="w-full bg-white text-gray-600 border border-gray-300 rounded-lg py-2 text-sm hover:bg-gray-50 transition-colors"
            >
              Accept All Remaining
            </button>
          </>
        ) : (
          <div className="space-y-3">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
              <p className="font-semibold text-green-800 text-sm">Review complete!</p>
              <p className="text-xs text-green-700 mt-1">Keeping {acceptedChanges.length} of {totalChanges} changes</p>
            </div>
            <div className="flex justify-center">
              <button
                onClick={() => finishReview()}
                disabled={accepting}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg text-xs font-semibold hover:bg-purple-700 disabled:opacity-75 flex items-center gap-2 transition-colors"
              >
                {accepting && <div className="h-3 w-3 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>}
                {accepting ? 'Applying...' : 'Apply Selected Changes →'}
              </button>
            </div>
          </div>
        )}

        {/* Change Review Modal */}
        {showChangeModal && currentChange && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.85)' }}
            onClick={() => setShowChangeModal(false)}
          >
            <div
              className="bg-white shadow-2xl w-full max-w-2xl border border-gray-200 flex flex-col"
              style={{ borderRadius: '8px', height: '480px' }}
              onClick={e => e.stopPropagation()}
            >
              <div
                style={{ background: 'linear-gradient(to bottom right, #9333ea, #6b21a8)', borderRadius: '8px 8px 0 0' }}
                className="px-6 py-4 flex items-center justify-between flex-shrink-0"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-white rounded flex items-center justify-center flex-shrink-0">
                    <span className="text-purple-600 font-bold text-lg">⚡</span>
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">
                      {currentChange.type === 'added' ? '✨ New Addition' : currentChange.type === 'removed' ? '🗑️ Removal' : '✏️ Improvement'}
                    </h2>
                    <p className="text-purple-100 text-xs">Change {currentChangeIndex + 1} of {totalChanges}{currentChange.section ? ` · ${currentChange.section}` : ''}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowChangeModal(false)}
                  className="text-white hover:text-gray-200 text-4xl leading-none font-light w-8 h-8 flex items-center justify-center"
                >
                  ×
                </button>
              </div>

              <div className="flex flex-col flex-1 p-4 min-h-0">
                <div className="grid grid-cols-2 gap-3 mb-1 flex-shrink-0">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Before</p>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">After</p>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3" style={{ flex: 1, minHeight: 0 }}>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 overflow-y-auto" style={{ height: '100%' }}>
                    {currentChange.before ? (
                      <p className="text-xs text-gray-600 leading-snug line-through decoration-red-400">{currentChange.before}</p>
                    ) : (
                      <p className="text-xs text-gray-400 italic">Nothing — this is a new addition</p>
                    )}
                  </div>

                  {editingChange ? (
                    <textarea
                      className="w-full h-full text-xs text-gray-800 leading-snug bg-green-50 border border-green-200 rounded-lg p-2.5 outline-none resize-none"
                      value={editedText}
                      onChange={e => setEditedText(e.target.value)}
                      autoFocus
                    />
                  ) : (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-2.5 overflow-y-auto" style={{ height: '100%' }}>
                      {currentChange.after ? (
                        <p className="text-xs text-gray-800 leading-snug font-medium">{currentChange.after}</p>
                      ) : (
                        <p className="text-xs text-gray-400 italic">This is being removed — the content was absorbed into another bullet or is no longer needed.</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="bg-white border-l-4 border-purple-600 border border-gray-100 p-2.5 rounded-r mb-3 flex-shrink-0">
                  <p className="text-[10px] font-bold text-purple-700 uppercase tracking-wide mb-0.5">Why this is better</p>
                  <p className="text-xs text-gray-700 leading-snug">{currentChange.reason}</p>
                </div>

                <div className="flex justify-end gap-2 flex-shrink-0">
                  {currentChangeIndex > 0 && (
                    <button
                      onClick={() => {
                        const prevIndex = currentChangeIndex - 1
                        if (acceptedChanges[acceptedChanges.length - 1] === resumeChanges[prevIndex]) {
                          setAcceptedChanges(prev => prev.slice(0, -1))
                        } else {
                          setRejectedChanges(prev => prev.slice(0, -1))
                        }
                        setCurrentChangeIndex(prevIndex)
                        setEditingChange(false)
                        setEditedText('')
                      }}
                      className="px-4 py-2 bg-white text-gray-500 border border-gray-200 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors"
                    >
                      ← Back
                    </button>
                  )}
                 <button
                    onClick={() => {
                      setRejectedChanges(prev => [...prev, currentChange])
                      const newIndex = currentChangeIndex + 1
                      setCurrentChangeIndex(newIndex)
                      setEditingChange(false)
                      setEditedText('')
                      setShowChangeModal(false)
                      if (newIndex >= totalChanges) {
                        finishReview([...acceptedChanges])
                      }
                    }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors"
                  >
                    ✗ Keep Original
                  </button>
                  {!editingChange ? (
                    <button
                      onClick={() => { setEditingChange(true); setEditedText(currentChange.after) }}
                      className="px-4 py-2 bg-white text-purple-600 border border-purple-300 rounded-lg text-xs font-medium hover:bg-purple-50 transition-colors"
                    >
                      ✏️ Edit Change
                    </button>
                  ) : (
                    <button
                      onClick={() => setEditingChange(false)}
                      className="px-4 py-2 bg-white text-gray-600 border border-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors"
                    >
                      Cancel Edit
                    </button>
                  )}
                  <button
                    onClick={() => {
                      const finalChange = editingChange ? { ...currentChange, after: editedText } : currentChange
                      const newAccepted = [...acceptedChanges, finalChange]
                      setAcceptedChanges(newAccepted)
                      const newIndex = currentChangeIndex + 1
                      setCurrentChangeIndex(newIndex)
                      setEditingChange(false)
                      setEditedText('')
                      setShowChangeModal(false)
                      if (newIndex >= totalChanges) {
                        finishReview(newAccepted)
                      }
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg text-xs font-semibold hover:bg-purple-700 transition-colors"
                  >
                    ✓ Apply Change
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Big reveal view
  const totalChanges = resumeChanges.length

  return (
    <>
      <div className="space-y-4">
        <div className="text-center py-2">
          <h3 className="font-semibold text-gray-900">Your New Resume is Ready!</h3>
          <p className="text-xs text-gray-500 mt-1">
            {totalChanges} improvement{totalChanges !== 1 ? 's' : ''} made
          </p>
        </div>

        <p className="text-xs text-gray-600 text-center">
          The improved version is displayed on your resume. Accept it to move forward, or review each change individually.
        </p>

        <div className="flex justify-center mt-2">
          <div className="flex flex-col gap-2" style={{ minWidth: '210px' }}>
            <button
              onClick={acceptAll}
              disabled={accepting}
              className="w-full bg-purple-600 text-white rounded-lg py-2 px-4 text-xs font-semibold hover:bg-purple-700 disabled:opacity-75 flex items-center justify-center gap-2 transition-colors"
            >
              {accepting && <div className="h-3 w-3 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>}
              {accepting ? 'Saving...' : '✓ Accept All Changes'}
            </button>
            <button
              onClick={() => { setReviewMode(true); setShowChangeModal(true) }}
              className="w-full bg-white text-purple-600 border border-purple-600 rounded-lg py-2 px-4 text-xs font-semibold hover:bg-purple-50 transition-colors"
            >
              Review Each Change
            </button>
          </div>
        </div>
      </div>

      {/* Score Reveal Modal — Pro users go to polish */}
      {showRevealModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(15, 10, 30, 0.75)' }}
        >
          <div className="relative flex items-center" style={{ width: '740px', height: '560px' }}>

            <div
              className="absolute left-0 bg-white shadow-2xl overflow-hidden"
              style={{ width: '420px', height: '560px', borderRadius: '0px', border: '1px solid #e5e7eb' }}
            >
              <div className="absolute inset-0 z-10" style={{ background: 'rgba(147, 51, 234, 0.06)' }} />
              <div
                style={{ transform: 'scale(0.45)', transformOrigin: 'top left', width: '933px', pointerEvents: 'none' }}
                className="p-8 font-sans"
              >
                <ResumeContent
                  resumeData={rewrittenResume || resumeData}
                  onUpdate={() => {}}
                  isUndoingRef={{ current: false }}
                  formatDate={(d) => d || ''}
                  readOnly={true}
                />
              </div>
              <div
                className="absolute bottom-0 left-0 right-0 z-20 px-4 py-3"
                style={{ background: 'linear-gradient(to top, rgba(255,255,255,0.95), transparent)' }}
              >
                <p className="text-xs text-gray-400 text-center">Your improved resume</p>
              </div>
            </div>

            <div
              className="absolute bg-white shadow-2xl flex flex-col"
              style={{ width: '380px', borderRadius: '0px', border: '1px solid #e5e7eb', zIndex: 10, left: '320px', top: '50%', transform: 'translateY(-50%)' }}
            >
              <div
                style={{ background: 'linear-gradient(to bottom right, #9333ea, #6b21a8)', borderRadius: '0' }}
                className="px-6 py-5 text-center"
              >
                <img src="/images/Hire_Power_icon.png" alt="Hire Power" className="h-8 w-auto mx-auto mb-1" />
                <h2 className="text-xl font-bold text-white">Improvement Complete.</h2>
              </div>

              <div className="p-6 text-center">
                {scoreBeforeCoaching && scoreAfterCoaching ? (
                  <div className="mb-4">
                    <div className="flex items-center justify-center gap-4 mb-2">
                      <div className="text-center">
                        <p className="text-xs text-gray-500 mb-1">Before</p>
                        <p className="text-5xl font-bold text-gray-400">{scoreBeforeCoaching}</p>
                      </div>
                      <div className="text-2xl text-purple-300">→</div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500 mb-1">After</p>
                        <p className="text-5xl font-bold text-purple-600">{scoreAfterCoaching}</p>
                      </div>
                    </div>
                    {scoreAfterCoaching > scoreBeforeCoaching ? (
                      <p className="text-sm font-semibold text-green-600">
                        +{scoreAfterCoaching - scoreBeforeCoaching} points from coaching
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500">Score held — your resume was already well-optimized.</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">We recommend submitting at 85 or above.</p>
                  </div>
                ) : (
                  <div className="mb-4">
                    <p className="text-3xl font-bold text-purple-600">{scoreAfterCoaching || score}/100</p>
                    <p className="text-sm text-gray-500 mt-1">Resume scored</p>
                  </div>
                )}

                <div className="bg-purple-50 border border-purple-100 rounded-lg p-3 mb-5 text-left">
                  <p className="text-sm text-gray-700 leading-relaxed">
                    Give it a final review in the Polish step, then download.
                  </p>
                </div>

                <button
                  onClick={async () => {
                    setShowRevealModal(false)
                    await supabase
                      .from('resumes')
                      .update({ journey_step: 'polish', updated_at: new Date().toISOString() })
                      .eq('id', params.id)
                    setResume(prev => ({ ...prev, journey_step: 'polish' }))
                  }}
                  className="w-full bg-purple-600 text-white rounded-lg py-3 font-semibold text-sm hover:bg-purple-700 transition-colors"
                >
                  Polish My Resume →
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  )
}

// ─────────────────────────────────────────────
// FREE IMPROVE STEP
// ─────────────────────────────────────────────
function FreeImproveStep({ suggestions, supabase, params, setResume, coachingSamplesUsed, handleReassess, isAnalyzing, setShowRevealModal }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const isDone = currentIndex >= suggestions.length
  const hasUsedTrial = coachingSamplesUsed > 0

  return (
    <div className="space-y-2 -mt-2">
      <h3 className="font-semibold text-lg">✏️ Improve Your Resume</h3>
      <p className="text-xs text-gray-700 text-center">Ready to tackle the rest? We'll walk you through the recommended changes one at a time below.</p>
      <p className="text-xs text-gray-500 text-center">
        Want your entire resume coached?{' '}
        <button
          onClick={() => setShowUpgradeModal(true)}
          className="text-purple-600 font-medium hover:text-purple-700 underline"
        >
          Upgrade to Pro →
        </button>
      </p>

      {!isDone ? (
        <div className="space-y-2">
          {/* Numbered circles progress bar */}
          <div className="flex items-center justify-between gap-1">
            {suggestions.map((_, i) => {
              const done = i < currentIndex
              const current = i === currentIndex
              return (
                <div key={i} className="flex items-center flex-1">
                  <div
                    className="flex items-center justify-center rounded-full text-[10px] font-bold flex-shrink-0 transition-all"
                    style={{
                      width: current ? '22px' : '18px',
                      height: current ? '22px' : '18px',
                      backgroundColor: done ? '#7c3aed' : current ? '#9333ea' : '#d1d5db',
                      color: '#ffffff',
                      boxShadow: current ? '0 0 0 2px #e9d5ff' : 'none'
                    }}
                  >
                    {done ? '✓' : i + 1}
                  </div>
                  {i < suggestions.length - 1 && (
                    <div className="flex-1 h-px mx-0.5" style={{ backgroundColor: i < currentIndex ? '#7c3aed' : '#d1d5db' }} />
                  )}
                </div>
              )
            })}
          </div>

          {/* Current suggestion */}
          <div className="bg-gray-50 border-l-4 border-purple-600 border border-gray-200 p-2.5 rounded-r">
            <p className="text-[10px] font-bold text-purple-700 uppercase tracking-wide mb-1">🎯 Action Item {currentIndex + 1}</p>
            <p className="text-xs text-gray-800 leading-snug">{suggestions[currentIndex]}</p>
          </div>

          <p className="text-[10px] text-gray-400 text-center">
            Make this change wherever it applies on your resume.
          </p>

          <div className="flex flex-col items-center gap-1 mt-5">
            <button
              onClick={async () => {
                const isLast = currentIndex === suggestions.length - 1
                if (isLast) {
                  await handleReassess()
                  setShowRevealModal(true)
                } else {
                  setCurrentIndex(prev => prev + 1)
                }
              }}
              className="bg-purple-600 text-white rounded-lg py-2 px-4 font-semibold text-xs hover:bg-purple-700 transition-colors"
            >
              {currentIndex === suggestions.length - 1 ? 'Finalize & Check My Score →' : 'Next Suggestion →'}
            </button>
            <button
              onClick={() => setCurrentIndex(prev => prev + 1)}
              className="text-gray-400 text-xs hover:text-gray-600"
            >
              Skip
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
            <p className="text-xl mb-0.5">✅</p>
            <p className="font-semibold text-green-800 text-xs">All suggestions reviewed!</p>
            <p className="text-xs text-green-700">Made changes? Check your updated score.</p>
          </div>

          <div className="flex flex-col items-center gap-2 mt-5">
            <button
              onClick={async () => {
                await handleReassess()
                setShowRevealModal(true)
              }}
              disabled={isAnalyzing}
              className="bg-white text-purple-600 border border-purple-300 rounded-lg py-2 px-4 text-xs font-semibold hover:bg-purple-50 transition-colors flex items-center gap-1"
            >
              {isAnalyzing
                ? <><div className="h-3 w-3 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div> Analyzing...</>
                : '📊 Re-assess My Score'
              }
            </button>
            <button
              onClick={async () => {
                await supabase
                  .from('resumes')
                  .update({ journey_step: 'save', updated_at: new Date().toISOString() })
                  .eq('id', params.id)
                setResume(prev => ({ ...prev, journey_step: 'save' }))
              }}
              className="bg-purple-600 text-white rounded-lg py-2 px-4 font-semibold text-xs hover:bg-purple-700 transition-colors"
            >
              Finalize Changes →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
// ─────────────────────────────────────────────
// POLISH STEP
// ─────────────────────────────────────────────
function PolishStep({ supabase, params, setResume, handleReassess, isAnalyzing, score, userTier }) {
  const [advancing, setAdvancing] = useState(false)

  if (userTier === 'free') {
    async function skipToSave() {
      await supabase
        .from('resumes')
        .update({ journey_step: 'save', updated_at: new Date().toISOString() })
        .eq('id', params.id)
      setResume(prev => ({ ...prev, journey_step: 'save' }))
    }
    skipToSave()
    return null
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg">✨ Polish Your Resume</h3>

      <p className="text-sm text-gray-700">
        Your resume has been improved. Take a final look and make any last tweaks before saving.
      </p>

      <div className="bg-purple-50 border-l-4 border-purple-500 p-3 rounded">
        <div className="text-xs text-purple-900 space-y-1.5">
          <div>✓ Review all sections for personal accuracy</div>
          <div>✓ Adjust any wording you want to personalize</div>
          <div>✓ Check formatting looks right at your chosen zoom</div>
          <div>✓ Try different templates from the toolbar</div>
        </div>
      </div>

      {score && (
        <div className="text-center">
          <p className="text-xs text-gray-500 mb-1">Current score</p>
          <p className={`text-2xl font-bold ${score >= 80 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
            {score}/100
          </p>
        </div>
      )}

      <div className="flex flex-col items-center mt-5">
        <button
          onClick={async () => {
            setAdvancing(true)
            try {
              await supabase
                .from('resumes')
                .update({ journey_step: 'save', updated_at: new Date().toISOString() })
                .eq('id', params.id)
              setResume(prev => ({ ...prev, journey_step: 'save' }))
            } catch (err) {
              console.error(err)
            } finally {
              setAdvancing(false)
            }
          }}
          disabled={advancing}
          className="bg-purple-600 text-white rounded-lg py-2 px-4 font-semibold text-xs hover:bg-purple-700 disabled:opacity-75 flex items-center gap-2 transition-colors"
        >
          {advancing && <div className="h-3 w-3 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>}
          {advancing ? 'Saving...' : 'Ready to Save →'}
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// SAVE STEP
// ─────────────────────────────────────────────
function SaveStep({ resumeName, userName, params, isJobSpecific, userTier }) {
  const firstName = userName ? userName.split(' ')[0] : null

  useEffect(() => {
    async function markComplete() {
      const supabase = createClient()
      const { data: resume } = await supabase
        .from('resumes')
        .select('completed_at')
        .eq('id', params.id)
        .single()
      if (!resume?.completed_at) {
        await supabase
          .from('resumes')
          .update({ 
            completed_at: new Date().toISOString(),
            journey_step: 'save'
          })
          .eq('id', params.id)
      }
    }
    markComplete()
  }, [params.id])

  return (
    <div className="space-y-2 -mt-2">
      <h3 className="font-semibold text-lg">⭐ Resume Complete!</h3>

      <p className="text-sm text-gray-500">
        {firstName ? `${firstName}'s ` : ''}{resumeName} is application-ready.
      </p>

      <p className="text-sm text-gray-700">
        Use the <strong>Download</strong> button in the toolbar to save your resume as a PDF.
      </p>

      <div className="pt-2">
        <p className="text-sm text-gray-500 mb-4">Ready to put it to use?</p>
        <div className="flex flex-col items-center gap-2">
          <div className="flex flex-col gap-2" style={{ minWidth: '220px' }}>
            {!isJobSpecific && (
              <button
                onClick={() => window.location.href = `/my-resumes?action=new-job-specific&from=${params.id}`}
                className="w-full bg-white text-purple-600 border border-purple-300 rounded-lg py-2 px-4 text-xs font-semibold hover:bg-purple-50 transition-colors"
              >
                {userTier === 'free' ? '📊 Check Match Score for Any Job' : '🎯 Tailor for a Specific Job'}
              </button>
            )}
            <button
              onClick={() => window.location.href = '/my-interviews'}
              className="w-full bg-purple-600 text-white rounded-lg py-2 px-4 text-xs font-semibold hover:bg-purple-700 transition-colors"
            >
              🎤 Start Interview Prep
            </button>
          </div>
          <button
            onClick={() => window.location.href = '/my-resumes'}
            className="text-gray-400 text-xs hover:text-gray-600"
          >
            ← Back to My Resumes
          </button>
        </div>
      </div>
    </div>
  )
}