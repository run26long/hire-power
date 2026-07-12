'use client'

import { useEffect, useState, useRef, useCallback, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import MainNav from '@/app/components/MainNav'
import UpgradeModal from '@/app/components/UpgradeModal'
import { getTemplateStyles } from '../../templates/getTemplateStyles'
import Breadcrumb from '@/app/components/Breadcrumb'
import ResumeContent from '../../components/ResumeContent'
import ErrorToast from '../../components/ErrorToast'
import SuccessToast from '../../components/SuccessToast'
import CaptureCounter from '../../components/CaptureCounter'
import CaptureToast from '../../components/CaptureToast'
import CoachReviseModal from '../../components/CoachReviseModal'
import PDFViewer from '../../components/PDFViewer'
import { parseCaptureTags, replayCaptures } from '../../utils/parseCaptureTags'
import { track } from '../../utils/analytics'

const styles = `
  [contenteditable][data-placeholder]:empty:before {
    content: attr(data-placeholder);
    color: #9ca3af;
    font-style: italic;
  }
`

async function fireJT1MarkerIfFirst(supabase) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_card_created_at')
      .eq('id', user.id)
      .single()
    if (!profile || profile.first_card_created_at) return
    const now = new Date().toISOString()
    await supabase.from('profiles').update({ first_card_created_at: now }).eq('id', user.id)
    await fetch('/api/loops/sync-contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: user.email,
        userId: user.id,
        firstCardCreatedAt: now
      })
    })
  } catch (e) {
    console.error('JT1 marker failed (non-blocking):', e)
  }
}

async function fireT4IfFirst(supabase) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase
      .from('profiles')
      .select('t4_sent_at')
      .eq('id', user.id)
      .single()
    if (!profile || profile.t4_sent_at) return
    const now = new Date().toISOString()
    await supabase.from('profiles').update({ t4_sent_at: now }).eq('id', user.id)
    await fetch('/api/loops/sync-contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: user.email,
        userId: user.id,
        firstJSResumeImprovedAt: now
      })
    })
  } catch (e) {
    console.error('T4 trigger failed (non-blocking):', e)
  }
}

async function fireO4MarkerIfFirst(supabase) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase
      .from('profiles')
      .select('reached_improve_at')
      .eq('id', user.id)
      .single()
    if (!profile || profile.reached_improve_at) return
    const now = new Date().toISOString()
    await supabase.from('profiles').update({ reached_improve_at: now }).eq('id', user.id)
    await fetch('/api/loops/sync-contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: user.email,
        userId: user.id,
        reachedImproveAt: now
      })
    })
  } catch (e) {
    console.error('O4 marker failed (non-blocking):', e)
  }
}

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
  const [saveToast, setSaveToast] = useState(null)
  const [saveToastCount, setSaveToastCount] = useState(0)
 const [showPreview, setShowPreview] = useState(false)
const [previewUrl, setPreviewUrl] = useState(null)
const [isLoadingPreview, setIsLoadingPreview] = useState(false)
const previewModalRef = useRef(null)
const [previewScale, setPreviewScale] = useState(1)
 const [isDownloading, setIsDownloading] = useState(false)
 const [showColorPicker, setShowColorPicker] = useState(false)
const isAutoFitJustRanRef = useRef(false)

  // Save reminder: toast first 3 times, then pulse handles it
  useEffect(() => {
    if (hasUnsavedChanges && !saveSuccess) {
      const storageKey = `hp_save_toast_${resume?.id || 'unknown'}`
      const count = parseInt(localStorage.getItem(storageKey) || '0')
      setSaveToastCount(count)
      if (count < 3) {
        setSaveToast(window.innerWidth < 768 ? "You have unsaved changes. Tap Actions → Save when you're done editing." : "You have unsaved changes. Click Save when you're done editing.")
        localStorage.setItem(storageKey, String(count + 1))
        setSaveToastCount(count + 1)
      }
    }
  }, [hasUnsavedChanges])
  const cardCreationRanRef = useRef(false)

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
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [errorToast, setErrorToast] = useState(null)
  const [successToast, setSuccessToast] = useState(null)
  const [postCoachingAnalysis, setPostCoachingAnalysis] = useState(null)
  const [remainingGaps, setRemainingGaps] = useState([])
  const [recoachAttempts, setRecoachAttempts] = useState(0)
  const [reviseModalState, setReviseModalState] = useState(null)
  const [bulletSelectMode, setBulletSelectMode] = useState(null)

  // Capture system state — counter + toast queue
  const [captureCounts, setCaptureCounts] = useState({ jobs: 0, education: 0, skills: 0, wins: 0 })
  const [captureBumpKey, setCaptureBumpKey] = useState(null)
  const [captureToast, setCaptureToast] = useState(null)

    // Use ref for undo flag - synchronous, no timing issues
  const isUndoingRef = useRef(false)
  const resumeDataRef = useRef(null)
  
 // Toolbar states
  const [selectedTemplate, setSelectedTemplate] = useState('current')
const [accentColor, setAccentColor] = useState('#5b4fcf')
  const [selectedFont, setSelectedFont] = useState('Lato')
  const [selectedSize, setSelectedSize] = useState(11)
  const [zoom, setZoom] = useState(100)
  const [mobileScale, setMobileScale] = useState(1)
  const resumePanelRef = useRef(null)
const [dateFormat, setDateFormat] = useState('short')
const [isAutoFitting, setIsAutoFitting] = useState(false)
const [selectedSpacing, setSelectedSpacing] = useState(1)
const [resumeExceedsPage, setResumeExceedsPage] = useState(false)
const [showTooLongModal, setShowTooLongModal] = useState(false)
const [showUpgradedBanner, setShowUpgradedBanner] = useState(false)
const [mobilePanel, setMobilePanel] = useState('coach')
const [mobileToolbar, setMobileToolbar] = useState(null)
const [showEditTip, setShowEditTip] = useState(false)
const [showEditorTip, setShowEditorTip] = useState(false)
const [templatePicked, setTemplatePicked] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('hp_editor_tip_dismissed')) {
      setShowEditorTip(true)
    }
    if (localStorage.getItem('hp_template_picked')) {
      setTemplatePicked(true)
    }
  }, [])

  const dismissEditorTip = () => {
    setShowEditorTip(false)
    localStorage.setItem('hp_editor_tip_dismissed', '1')
  }

  useEffect(() => {
    const updateMobileScale = () => {
      if (window.innerWidth >= 768) {
        setMobileScale(1)
        return
      }
      if (!resumePanelRef.current) return
      const containerWidth = resumePanelRef.current.offsetWidth
      if (containerWidth > 0) setMobileScale(containerWidth / 816)
    }
    updateMobileScale()
    window.addEventListener('resize', updateMobileScale)
    return () => window.removeEventListener('resize', updateMobileScale)
  }, [mobilePanel])

const handleAutoFit = async () => {
  setIsAutoFitting(true)
  try {
    const { data: { user } } = await supabase.auth.getUser()
    const templateForApi = selectedTemplate.charAt(0).toUpperCase() + selectedTemplate.slice(1)
    const minSize = 10
    const maxSize = 12
    let testSize = selectedSize

    const checkSize = async (size, spacing = 1) => {
      const { data: { session: autoFitSession } } = await supabase.auth.getSession()
      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${autoFitSession.access_token}` },
        body: JSON.stringify({
          resumeData: resume.resume_data,
          templateName: templateForApi,
          fontSize: size,
          font: selectedFont,
          accentColor: accentColor,
          dateFormat,
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
      await save({ fontSize: bestSize, spacing: bestSpacing })
    } else {
      // Too long — step down font size first
      testSize = Math.round((testSize - 0.5) * 10) / 10
      let fitted = false
      let fittedSpacing = 1
      while (testSize >= minSize) {
        const result = await checkSize(testSize, 1)
        if (result.pageCount === 1) {
          fitted = true
          fittedSpacing = 1
          break
        }
        testSize = Math.round((testSize - 0.5) * 10) / 10
      }
      // If font bottomed out, try tightening line spacing at min font size
      if (!fitted) {
        testSize = minSize
        let trySpacing = 1.2
        while (trySpacing >= 1.0) {
          const result = await checkSize(testSize, trySpacing)
          if (result.pageCount === 1) {
            fitted = true
            fittedSpacing = trySpacing
            break
          }
          trySpacing = Math.round((trySpacing - 0.05) * 100) / 100
        }
      }
      if (fitted) {
        setSelectedSize(testSize)
        setSelectedSpacing(fittedSpacing)
        setResumeExceedsPage(false)
        isAutoFitJustRanRef.current = true
        await save({ fontSize: testSize, spacing: fittedSpacing })
      } else {
        // Couldn't fit — apply tightest values anyway, then show modal
        // This gets them as close as possible before they manually trim content
        setSelectedSize(minSize)
        setSelectedSpacing(1.0)
        setResumeExceedsPage(true)
        isAutoFitJustRanRef.current = true
        await save({ fontSize: minSize, spacing: 1.0 })
        setShowTooLongModal(true)
      }
    }
  } catch (error) {
    console.error('Auto-fit error:', error)
    setErrorToast('Auto-fit failed. Please try again.')
  } finally {
    setIsAutoFitting(false)
  }
}

const handleDownload = async () => {
  setIsDownloading(true)
  try {
    
    const { data: { user } } = await supabase.auth.getUser()
    
    // Capitalize template name for API
    const templateForApi = selectedTemplate.charAt(0).toUpperCase() + selectedTemplate.slice(1)
    
    const { data: { session: pdfSession } } = await supabase.auth.getSession()
    const response = await fetch('/api/generate-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${pdfSession.access_token}`
      },
      body: JSON.stringify({
  resumeData: resume.resume_data,
  templateName: templateForApi,
  fontSize: selectedSize,
  font: selectedFont,
  accentColor: accentColor,
          dateFormat,
          spacing: selectedSpacing,
          action: 'download',
        resumeId: resume.id,
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
    track('resume_downloaded', { resume_type: resume?.resume_type || 'core' })
    window.URL.revokeObjectURL(blobUrl)
    
 } catch (error) {
    console.error('Error downloading PDF:', error)
    setErrorToast('Failed to generate PDF. Please try again.')
  } finally {
    setIsDownloading(false)
  }
}

const handleReassess = async (overrideData = null) => {
  setIsAnalyzing(true)
  setErrorToast(null)
  try {
    const isJobSpecific = resume.resume_type === 'job_specific'

    if (isJobSpecific) {
      // job specific resume: job match analysis
      const { data: { user: currentUser } } = await supabase.auth.getUser()

      const { data: { session: jobAnalyzeSession } } = await supabase.auth.getSession()
      const response = await fetch('/api/job-analyze', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jobAnalyzeSession.access_token}`
        },
        body: JSON.stringify({
          resumeData: overrideData || resume.resume_data,
          jobDescription: resume.job_description,
          jobTitle: resume.job_title,
          jobCompany: resume.job_company,
          userId: currentUser?.id
        })
      })

      if (!response.ok) throw new Error('Analysis failed')

      const result = await response.json()

      // Wrap to match how ai_analysis is read on load (analysisResults.analysis = raw job-analyze result)
      setAnalysisResults({ analysis: result })

      const { error } = await supabase
        .from('resumes')
        .update({
          current_score: result.matchScore,
          last_assessed_at: new Date().toISOString(),
          ai_analysis: result
        })
        .eq('id', params.id)

      if (error) {
        console.error('Error saving score:', error)
        setErrorToast("We analyzed your resume but couldn't save the score. Please try again.")
        return
      }

      setResume(prev => ({ ...prev, current_score: result.matchScore }))
      setScoreAfterCoaching(result.matchScore)

      const prevScore = resume?.current_score
      if (prevScore && result.matchScore > prevScore) {
        setSuccessToast(`${prevScore} → ${result.matchScore} — +${result.matchScore - prevScore} points. Your changes moved the needle.`)
      } else if (prevScore && result.matchScore === prevScore) {
        setSuccessToast(`${result.matchScore}% — no change. Your content is already dialed in.`)
      } else if (prevScore && result.matchScore < prevScore) {
        setSuccessToast(`${prevScore} → ${result.matchScore} — score shifted. Small fluctuations are normal.`)
      } else {
        setSuccessToast(`${result.matchScore}% — your resume has been scored.`)
      }

      // Update job card match score if one exists
      if (currentUser) {
        const { data: existingCard, error: cardLookupError } = await supabase
          .from('applications')
          .select('id')
          .eq('resume_id', params.id)
          .eq('user_id', currentUser.id)
          .maybeSingle()

        if (cardLookupError) {
          console.error('Error looking up job card:', cardLookupError)
        } else if (existingCard) {
          const { error: cardUpdateError } = await supabase
            .from('applications')
            .update({ match_score: result.matchScore })
            .eq('id', existingCard.id)

          if (cardUpdateError) {
            console.error('Error updating job card match score:', cardUpdateError)
            setErrorToast("Your resume score saved, but the job tracker card didn't update. Refresh the Job Tracker page to sync.")
          }
        }
      }

    } else {
      // Core resume: quality analysis
     const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch('/api/analyze-resume', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          resumeData: overrideData || resume.resume_data
        })
      })

      if (!response.ok) throw new Error('Analysis failed')

      const result = await response.json()

      setAnalysisResults(result)
      setDetectedLevel(result.detectedLevel || 'entry')

      const updateData = {
        current_score: result.score,
        last_assessed_at: new Date().toISOString(),
        ai_analysis: result.analysis,
        score_breakdown: result.analysis?.breakdown
      }

      // Advance from review to assess on first run only
      if (resume.journey_step === 'review') {
        updateData.journey_step = 'assess'
      }

      const { error } = await supabase
        .from('resumes')
        .update(updateData)
        .eq('id', params.id)

      if (error) {
        console.error('Error saving score:', error)
        setErrorToast("We analyzed your resume but couldn't save the score. Please try again.")
        return
      }

      setResume(prev => ({
        ...prev,
        current_score: result.score,
        journey_step: prev.journey_step === 'review' ? 'assess' : prev.journey_step
      }))

      setScoreAfterCoaching(result.score)

      const prevScore = resume?.current_score
      if (prevScore && result.score > prevScore) {
        setSuccessToast(`${prevScore} → ${result.score} — +${result.score - prevScore} points. Your changes moved the needle.`)
      } else if (prevScore && result.score === prevScore) {
        setSuccessToast(`${result.score}/100 — no change. Your content is already dialed in.`)
      } else if (prevScore && result.score < prevScore) {
        setSuccessToast(`${prevScore} → ${result.score} — score shifted. Small fluctuations are normal.`)
      } else {
        setSuccessToast(`${result.score}/100 — your resume has been scored.`)
      }

    }

  } catch (error) {
    console.error('Error analyzing resume:', error)
    setErrorToast('Failed to analyze resume. Please try again.')
  } finally {
    setIsAnalyzing(false)
  }
}
function formatDate(dateString, format = dateFormat) {
    if (!dateString) return ''
    
    const [year, month] = dateString.split('-')
    if (!year || !month || isNaN(parseInt(month))) return dateString
    
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
    if (showPreview && previewModalRef.current) {
      const modalWidth = previewModalRef.current.offsetWidth
      if (modalWidth > 0) setPreviewScale(modalWidth / 816)
    }
  }, [showPreview])

  useEffect(() => {
    if (!resume || resume.resume_type !== 'job_specific') return
    if (cardCreationRanRef.current) return
    cardCreationRanRef.current = true

    async function createJobCard() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError) {
          console.error('Auth error in createJobCard:', authError)
          return
        }
        if (!user) return

        const { data: resumeCards, error: resumeCardsError } = await supabase
          .from('applications')
          .select('id')
          .eq('resume_id', resume.id)
          .eq('user_id', user.id)
          .limit(1)

        if (resumeCardsError) {
          console.error('Error checking for existing job card by resume:', resumeCardsError)
          setErrorToast("We couldn't link this resume to your job tracker. You can add it manually from the Job Tracker page.")
          return
        }

        const cardByResume = resumeCards?.[0] || null

        let jobCardsData = null
        if (!cardByResume && resume.job_title && resume.job_company) {
          const { data: jobCards, error: jobCardsError } = await supabase
            .from('applications')
            .select('id')
            .eq('user_id', user.id)
            .eq('title', resume.job_title)
            .eq('company', resume.job_company)
            .limit(1)

          if (jobCardsError) {
            console.error('Error checking for existing job card by title/company:', jobCardsError)
            setErrorToast("We couldn't link this resume to your job tracker. You can add it manually from the Job Tracker page.")
            return
          }
          jobCardsData = jobCards
        }

        const existingCard = cardByResume || jobCardsData?.[0] || null

        if (!existingCard) {
          const { error: insertError } = await supabase
            .from('applications')
            .insert({
              user_id: user.id,
              title: resume.job_title || 'Untitled Role',
              company: resume.job_company || 'Unknown Company',
              description: resume.job_description || '',
              application_status: 'resume_in_progress',
              resume_id: resume.id,
              match_score: resume.current_score || null,
              application_date: new Date().toISOString().split('T')[0],
              sort_order: 0,
            })

          if (insertError) {
            console.error('Error creating job card:', insertError)
            setErrorToast("We couldn't add this resume to your job tracker. You can add it manually from the Job Tracker page.")
            return
          }
          fireJT1MarkerIfFirst(supabase)
        }
      } catch (err) {
        console.error('Unexpected error in createJobCard:', err)
        setErrorToast("Something went wrong adding this to your job tracker. You can add it manually from the Job Tracker page.")
      }
    }

    createJobCard()
  }, [resume?.id])

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('upgraded') === 'true') {
      setShowUpgradedBanner(true)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  useEffect(() => {
    if (userProfile) {
      setCoachingSamplesUsed(userProfile.coaching_samples_used || 0)
    }
  }, [userProfile])

  // Load saved capture counts from DB on mount.
  // captured_data persists across reloads so the counter is accurate.
  useEffect(() => {
    if (!resume?.captured_data) return
    const saved = resume.captured_data
    setCaptureCounts({
      jobs: saved.jobs || 0,
      education: saved.education || 0,
      skills: saved.skills || 0,
      wins: saved.wins || 0,
    })
  }, [resume?.id])

 const pageCheckTimerRef = useRef(null)

  const triggerPageCheck = () => {
    if (pageCheckTimerRef.current) clearTimeout(pageCheckTimerRef.current)
    pageCheckTimerRef.current = setTimeout(async () => {
      if (isAutoFitJustRanRef.current) {
        isAutoFitJustRanRef.current = false
        return
      }
      try {
        const { data: { user } } = await supabase.auth.getUser()
        const templateForApi = selectedTemplate.charAt(0).toUpperCase() + selectedTemplate.slice(1)
        const { data: { session: checkSession } } = await supabase.auth.getSession()
        const response = await fetch('/api/generate-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${checkSession.access_token}` },
          body: JSON.stringify({
            resumeData: resume.resume_data,
            templateName: templateForApi,
            fontSize: selectedSize,
            font: selectedFont,
            accentColor: accentColor,
            dateFormat,
            spacing: selectedSpacing,
            action: 'check',
            userId: user.id
          })
        })
        if (response.ok) {
          const { pageCount } = await response.json()
          setResumeExceedsPage(pageCount > 1)
        } else {
          console.error('Page check failed:', response.status, response.statusText)
        }
      } catch (e) {
        console.error('Page check error:', e)
      }
    }, 1500)
  }

  useEffect(() => {
    if (!resume) return
    triggerPageCheck()
  }, [resume?.resume_data, selectedSize, selectedSpacing, selectedTemplate, selectedFont])

  useEffect(() => {
   const templateFonts = {
      crisp: 'Source Serif 4',
      sharp: 'Open Sans',
      current: 'Lato',
      command: 'Lato',
      prestige: 'EB Garamond',
      signature: 'EB Garamond',
      vibe: 'Lato',
      edge: 'Open Sans',
    }
    if (templateFonts[selectedTemplate]) {
      setSelectedFont(templateFonts[selectedTemplate])
    }
  }, [selectedTemplate])

 async function loadResume() {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError) {
        console.error('Auth error in loadResume:', authError)
        setErrorToast("We couldn't verify your account. Please refresh the page.")
        setLoading(false)
        return
      }
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
        setErrorToast("We couldn't load your resume. Please try again.")
        setLoading(false)
        return
      }

      setResume(data)

if (data.ai_analysis) {
  setAnalysisResults({ analysis: data.ai_analysis })
}
   const templateFonts = {
      crisp: 'Source Serif 4',
      sharp: 'Open Sans',
      current: 'Lato',
      command: 'Lato',
      prestige: 'EB Garamond',
      signature: 'EB Garamond',
      vibe: 'Lato',
      edge: 'Open Sans',
    }
   const loadedTemplate = data.template_id || 'current'
    
    setSelectedTemplate(loadedTemplate)
    setSelectedFont(data.font_family || templateFonts[loadedTemplate] || 'Lato')
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

    // Load remaining gaps if coaching is complete
    if (data.remaining_gaps && data.remaining_gaps.length > 0) {
      setRemainingGaps(data.remaining_gaps)
    }
    // Initialize history
    const initialData = JSON.parse(JSON.stringify(data.resume_data || {}))
    resumeDataRef.current = initialData
    setHistory([initialData])
    setHistoryIndex(0)
    
    setLoading(false)
    } catch (err) {
      console.error('Unexpected error in loadResume:', err)
      setErrorToast("Something went wrong loading your resume. Please refresh the page.")
      setLoading(false)
    }
  }

  async function loadUserProfile() {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError) {
        console.error('Auth error in loadUserProfile:', authError)
        return
      }
      if (!user) return

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Error loading user profile:', error)
        setErrorToast("We couldn't load your profile. Some features may not work correctly. Please refresh the page.")
        return
      }

      setUserProfile(data)
    } catch (err) {
      console.error('Unexpected error in loadUserProfile:', err)
      setErrorToast("Something went wrong loading your profile. Please refresh the page.")
    }
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
    // Auto-remove empty education lines
    if (clonedData.education) {
      clonedData.education = clonedData.education.map(edu => ({
        ...edu,
        lines: (edu.lines || []).filter(l => l && l.trim() !== '')
      }))
    }

    resumeDataRef.current = clonedData
    
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

  // Ctrl+Z / Cmd+Z keyboard shortcut for undo
  useEffect(() => {
    function handleKeyDown(e) {
      const isUndoShortcut = (e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey
      if (isUndoShortcut && historyIndex > 0) {
        e.preventDefault()
        undo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [historyIndex, history])

  function resetHistory(newData) {
    const cloned = JSON.parse(JSON.stringify(newData))
    resumeDataRef.current = cloned
    setHistory([cloned])
    setHistoryIndex(0)
  }

  async function save(overrides = {}) {
    // Commit any active contentEditable field before saving
    if (document.activeElement && document.activeElement.isContentEditable) {
      document.activeElement.blur()
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    const { error } = await supabase
      .from('resumes')
      .update({ 
        resume_data: resumeDataRef.current || resume.resume_data,
        template_id: selectedTemplate,
        font_family: selectedFont,
        font_size: overrides.fontSize ?? selectedSize,
        date_format: dateFormat,
        accent_color: accentColor,
        spacing: overrides.spacing ?? selectedSpacing,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)

    if (error) {
      console.error('Error saving:', error)
      setErrorToast('Changes could not be saved. Please check your connection and try again.')
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
            onClick={() => router.push('/resume-coach')}
            className="mt-4 text-purple-600 hover:text-purple-700"
          >
            ← Back to Resume Coach
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
     <div className="bg-gray-50 flex flex-col overflow-hidden" style={{ height: '100vh', height: '100dvh' }}>
        {showUpgradedBanner && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-purple-600 text-white text-sm font-semibold flex items-center justify-center gap-3 py-3 px-6 shadow-lg">
          <span>🎉 Welcome to Pro! Your full coaching session is ready.</span>
          <button
            onClick={() => setShowUpgradedBanner(false)}
            className="text-white hover:text-purple-200 text-lg leading-none font-light"
          >×</button>
        </div>
      )}
      <MainNav currentPage="resume-coach" userProfile={userProfile} onUpgradeClick={() => setShowUpgradeModal(true)} />

      <Breadcrumb items={[
        { label: 'Resume Coach', path: '/resume-coach' },
        { label: resume.display_name || 'Core Resume' }
      ]} />

{/* Mobile toggle */}
      <div className="md:hidden flex flex-col bg-white border-b border-gray-200 flex-shrink-0">
        {/* Row 1: Progress / Resume toggle */}
        <div className="flex items-center gap-2 px-4 py-2">
          <button
            onClick={() => setMobilePanel('coach')}
            className="flex-1 py-1.5 text-sm md:text-xs font-semibold rounded-md transition-colors"
            style={{
              color: mobilePanel === 'coach' ? '#7c3aed' : '#6b7280',
              backgroundColor: mobilePanel === 'coach' ? 'rgba(147, 51, 234, 0.08)' : 'transparent'
            }}
          >
            Progress
          </button>
          <button
            onClick={() => {
              setMobilePanel('resume')
              setMobileToolbar(null)
            }}
            className="flex-1 py-1.5 text-sm md:text-xs font-semibold rounded-md transition-colors"
            style={{
              color: mobilePanel === 'resume' ? '#7c3aed' : '#6b7280',
              backgroundColor: mobilePanel === 'resume' ? 'rgba(147, 51, 234, 0.08)' : 'transparent'
            }}
          >
            Resume
          </button>
        </div>
        {showEditTip && (
          <div className="px-4 pb-1 text-sm md:text-xs text-amber-700 text-center">
            Editing works best on desktop. Tap any section to try.
          </div>
        )}
      </div>

{/* Mobile Toolbar */}
      {mobilePanel === 'resume' && (
        <div className="md:hidden bg-white border-b border-gray-200 flex-shrink-0">
          {showEditorTip && (
            <div className="bg-purple-50 border-b border-purple-100 px-3 py-1.5 flex items-center justify-between">
              <p className="text-xs text-purple-700 text-center">
                {['improve','format','save'].includes(resume?.journey_step) && (userProfile?.subscription_tier || 'free') !== 'free' && resume?.coaching_complete
                  ? '✏️ Tap any section to edit · 📄 Fonts & Templates · ⚡ Add or Change Content · ⚙️ Undo, Save & Download'
                  : '✏️ Tap any section to edit · 📄 Format for templates and fonts · ⚙️ Actions to save, undo, or re-assess'
                }
              </p>
              <button onClick={dismissEditorTip} className="text-purple-400 hover:text-purple-600 ml-2 flex-shrink-0 text-sm">✕</button>
            </div>
          )}
          {/* Toolbar row */}
          <div className="flex items-center gap-1 px-1.5 py-1.5 bg-gray-50 border-b border-gray-200">
           
           {/* Format */}
            <button
              onClick={() => setMobileToolbar(mobileToolbar === 'format' ? null : 'format')}
              className="py-1 text-xs font-medium rounded transition-colors flex items-center justify-center gap-1"
              style={{
                paddingLeft: 4, paddingRight: 4,
                color: mobileToolbar === 'format' ? '#7c3aed' : '#4b5563',
                backgroundColor: mobileToolbar === 'format' ? 'rgba(147, 51, 234, 0.08)' : 'white',
                border: mobileToolbar === 'format' ? '1px solid rgba(147,51,234,0.3)' : '1px solid #d1d5db',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
            >
              📄Format
            </button>
            {/* Actions */}
            <button
              onClick={() => setMobileToolbar(mobileToolbar === 'actions' ? null : 'actions')}
              className="py-1 text-xs font-medium rounded transition-colors flex items-center justify-center gap-1"
              style={{
                paddingLeft: 4, paddingRight: 4,
                color: mobileToolbar === 'actions' ? '#7c3aed' : '#4b5563',
                backgroundColor: mobileToolbar === 'actions' ? 'rgba(147, 51, 234, 0.08)' : 'white',
                border: mobileToolbar === 'actions' ? '1px solid rgba(147,51,234,0.3)' : '1px solid #d1d5db',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
            >
              ⚙️Actions
            </button>
            {/* Improve — Pro with coaching only */}
            {['improve','format','save'].includes(resume?.journey_step) && (userProfile?.subscription_tier || 'free') !== 'free' && resume?.coaching_complete && (
              <button
                onClick={() => setMobileToolbar(mobileToolbar === 'improve' ? null : 'improve')}
                className="py-1 text-xs font-medium rounded transition-colors flex items-center justify-center gap-1"
                style={{
                  paddingLeft: 4, paddingRight: 4,
                  color: mobileToolbar === 'improve' ? '#7c3aed' : '#4b5563',
                  backgroundColor: mobileToolbar === 'improve' ? 'rgba(147, 51, 234, 0.08)' : 'white',
                  border: mobileToolbar === 'improve' ? '1px solid rgba(147,51,234,0.3)' : '1px solid #d1d5db',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}
              >
                ⚡Improve
              </button>
            )}
            {/* Score */}
            {score && (
              <div className={`py-1 px-2 rounded text-xs font-semibold flex-shrink-0 ${
                score >= 85 ? 'bg-purple-100 text-purple-700' :
                score >= 75 ? 'bg-green-100 text-green-700' :
                score >= 60 ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-50 text-red-700'
              }`}>
                📊 {score}
              </div>
            )}
          
            {/* Download */}
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex-1 py-1 rounded text-xs font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
              style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
            >
              {isDownloading ? <><div className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div></> : '⬇️Download'}
            </button>
          </div>

          {bulletSelectMode && (
            <div className="bg-purple-100 border-b border-purple-200 px-3 py-2 flex items-center justify-between">
              <p className="text-xs text-purple-800 font-medium">⚡ Tap the sentence you want to change</p>
              <button onClick={() => setBulletSelectMode(null)} className="text-purple-500 hover:text-purple-700 text-sm font-medium">Cancel</button>
            </div>
          )}

          {/* Format panel */}
          {mobileToolbar === 'format' && (
            <div className="px-4 pb-3 grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs md:text-[10px] text-gray-500 uppercase tracking-wide">Template</label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => {
                    const t = e.target.value
                    setSelectedTemplate(t)
                    const fonts = { crisp: 'Source Serif 4', sharp: 'Open Sans', current: 'Lato', command: 'Lato', prestige: 'EB Garamond', signature: 'EB Garamond', vibe: 'Lato', edge: 'Open Sans' }
                    setSelectedFont(fonts[t] || 'Lato')
                    setHasUnsavedChanges(true)
                  }}
                  className="border border-gray-300 rounded px-2 py-1.5 text-base md:text-xs bg-white"
                >
                  <option value="command">Command</option>
                  <option value="crisp">Crisp</option>
                  <option value="current">Current</option>
                  <option value="edge">Edge</option>
                  <option value="prestige">Prestige</option>
                  <option value="signature">Signature</option>
                  <option value="sharp">Sharp</option>
                  <option value="vibe">Vibe</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs md:text-[10px] text-gray-500 uppercase tracking-wide">Font</label>
                <select
                  value={selectedFont}
                  onChange={(e) => { setSelectedFont(e.target.value); setHasUnsavedChanges(true) }}
                  className="border border-gray-300 rounded px-2 py-1.5 text-base md:text-xs bg-white"
                >
                  <option value="EB Garamond">EB Garamond</option>
                  <option value="Lato">Lato</option>
                  <option value="Open Sans">Open Sans</option>
                  <option value="Source Serif 4">Source Serif 4</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs md:text-[10px] text-gray-500 uppercase tracking-wide">Size</label>
                <select
                  value={selectedSize}
                  onChange={(e) => { setSelectedSize(Number(e.target.value)); setHasUnsavedChanges(true) }}
                  className="border border-gray-300 rounded px-2 py-1.5 text-base md:text-xs bg-white"
                >
                  {[10, 11, 12].map(s => <option key={s} value={s}>{s}pt</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs md:text-[10px] text-gray-500 uppercase tracking-wide">Dates</label>
                <select
                  value={dateFormat}
                  onChange={(e) => { setDateFormat(e.target.value); setHasUnsavedChanges(true) }}
                  className="border border-gray-300 rounded px-2 py-1.5 text-base md:text-xs bg-white"
                >
                  <option value="short">MM/YYYY</option>
                  <option value="full">Month YYYY</option>
                  <option value="year">YYYY</option>
                </select>
              </div>
              <div className="flex flex-col gap-1 col-span-2">
                <label className="text-xs md:text-[10px] text-gray-500 uppercase tracking-wide">Accent Color</label>
                <div className="flex items-center gap-1.5">
                  {['#5b4fcf','#1e3a5f','#7a1e3a','#1e6b6b','#1e5f3a','#8b3a1e','#2d2d2d','#2d4a6b'].map(c => (
                    <button
                      key={c}
                      onClick={() => setAccentColor(c)}
                      style={{
                        width: '22px', height: '22px', borderRadius: '4px', background: c,
                        border: accentColor === c ? '2px solid #1a1a1a' : '2px solid #e5e7eb',
                        flexShrink: 0
                      }}
                    />
                  ))}
                  <button
                    onClick={handleAutoFit}
                    disabled={isAutoFitting}
                    className={`flex-1 py-1 rounded text-sm md:text-xs font-semibold border transition-colors ${
                      isAutoFitting ? 'opacity-50 cursor-not-allowed border-gray-300' :
                      resumeExceedsPage ? 'border-amber-400 bg-amber-50 text-amber-700' :
                      'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {isAutoFitting ? '...' : '⚡ Auto-fit'}
                  </button>
                  <button
                    onClick={undo}
                    disabled={historyIndex <= 0}
                    className="flex-1 py-1 rounded text-sm md:text-xs font-medium border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40"
                  >
                    ↶ Undo
                  </button>
                </div>
              </div>
            </div>
          )}

         {/* Actions panel — utility operations */}
          {mobileToolbar === 'actions' && (
            <div className="px-4 pt-2 pb-3">
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  onClick={save}
                  className={`py-1.5 rounded text-[12px] font-semibold ${
                    saveSuccess ? 'bg-green-600 text-white' :
                    hasUnsavedChanges ? `bg-purple-600 text-white ${saveToastCount >= 3 ? 'animate-pulse' : ''}` :
                    'bg-gray-200 text-gray-500'
                  }`}
                >
                  {saveSuccess ? '✓ Saved!' : hasUnsavedChanges ? '💾 Save' : 'No changes'}
                </button>
                <button
                  onClick={() => handleReassess()}
                  disabled={isAnalyzing || journeyStep === 'review'}
                  className="py-1.5 border border-gray-300 rounded text-[12px] font-medium bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  {isAnalyzing ? <div className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div> : 'Re-assess'}
                </button>
                <button
                  onClick={async () => {
                    setIsLoadingPreview(true)
                    try {
                      const { data: { user } } = await supabase.auth.getUser()
                      const templateForApi = selectedTemplate.charAt(0).toUpperCase() + selectedTemplate.slice(1)
                      const { data: { session: previewSession } } = await supabase.auth.getSession()
                      const response = await fetch('/api/generate-pdf', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${previewSession.access_token}` },
                        body: JSON.stringify({ resumeData: resume.resume_data, templateName: templateForApi, fontSize: selectedSize, font: selectedFont, accentColor, dateFormat, spacing: selectedSpacing, action: 'preview-url', resumeId: resume.id, userId: user.id })
                      })
                      if (response.ok) {
                        const data = await response.json()
                        setPreviewUrl(data.previewUrl)
                        setShowPreview(true)
                      }
                    } catch (e) { console.error(e) } finally { setIsLoadingPreview(false) }
                  }}
                  disabled={isLoadingPreview}
                  className="py-1.5 border border-gray-300 rounded text-[12px] font-medium bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  {isLoadingPreview ? '...' : 'Preview'}
                </button>
                <button
                  onClick={undo}
                  disabled={historyIndex <= 0}
                  className="py-1.5 border border-gray-300 rounded text-[12px] font-medium bg-white hover:bg-gray-50 disabled:opacity-40"
                >
                  ↶ Undo
                </button>
              </div>
            </div>
          )}

          {/* Improve panel — AI editing tools (Pro with coaching only) */}
          {mobileToolbar === 'improve' && (
            <div className="px-4 pt-2 pb-3">
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => {
                    setBulletSelectMode(true)
                    setMobileToolbar(null)
                    setMobilePanel('resume')
                  }}
                  className="py-1.5 border border-purple-300 rounded text-[12px] font-semibold text-purple-600 bg-white hover:bg-purple-50"
                >
                  ✏️ Reword or Fix
                </button>
                <button
                  onClick={() => {
                    setReviseModalState({ mode: 'add' })
                    setMobileToolbar(null)
                  }}
                  className="py-1.5 border border-purple-300 rounded text-[12px] font-semibold text-purple-600 bg-white hover:bg-purple-50"
                >
                  ✨ Add More
                </button>
              </div>
            </div>
          )}
        </div>
      )}

{/* Toolbar - STICKY */}
      <div className={`bg-white border-b border-gray-200 sticky top-[80px] z-30 overflow-visible ${mobilePanel === 'coach' ? 'hidden md:block' : 'hidden md:block'}`}>
        <div className={`px-6 ${showEditorTip ? 'pt-0' : 'pt-4'} pb-2 max-w-7xl mx-auto w-full overflow-visible`}>
          {showEditorTip && (
            <div className="bg-purple-50 rounded px-3 py-1 mt-5 mb-0.5 flex items-center justify-between">
              <p className="text-xs text-purple-700">
                ✏️ Click any section to edit directly
                {['improve','format','save'].includes(resume?.journey_step) && (userProfile?.subscription_tier || 'free') !== 'free' && resume?.coaching_complete && (
                  <><span className="mx-5 text-purple-300">·</span>⚡Click to reword or fix any sentence</>
                )}
                <span className="mx-5 text-purple-300">·</span><span className="text-gray-400">▲▼</span> Arrows reorder content<span className="mx-5 text-purple-300">·</span>🗑️ Trash deletes content<span className="mx-5 text-purple-300">·</span>🎨 Toolbar below contains templates, fonts, and colors
              </p>
              <button onClick={dismissEditorTip} className="text-purple-400 hover:text-purple-600 ml-4 flex-shrink-0 text-sm">✕</button>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs flex-nowrap overflow-x-auto md:overflow-visible">

            {/* Template */}
            <div className="flex items-center gap-1 border border-gray-300 px-2 py-1 rounded hover:bg-gray-50">
              <div className="relative group/templatetip">
                <span className="text-purple-400 hover:text-purple-600 cursor-help text-[10px]">ⓘ</span>
                <div className="absolute left-0 top-full mt-2 w-64 bg-white border border-purple-200 rounded-lg shadow-lg p-3 hidden group-hover/templatetip:block z-50">
                  <div className="absolute -top-1.5 left-3 w-3 h-3 bg-white border-l border-t border-purple-200 rotate-45"></div>
                  <p className="text-xs text-gray-700 leading-snug relative z-10">Yes, our templates are plain on purpose. Fancy layouts lose up to 50% of your skills and experience in ATS scans. We'd rather get you hired than win a design award.</p>
                </div>
              </div>
              <span>📄</span>
              <select
                value={templatePicked ? selectedTemplate : ''}
                onChange={(e) => {
                  const t = e.target.value
                  setSelectedTemplate(t)
                  setTemplatePicked(true)
                  localStorage.setItem('hp_template_picked', '1')
                  const templateDefaultFonts = {
                    crisp: 'Source Serif 4',
                    sharp: 'Helvetica',
                    current: 'Lato',
                    command: 'Lato',
                    prestige: 'EB Garamond',
                    signature: 'EB Garamond',
                    vibe: 'Helvetica',
                    edge: 'Open Sans',
                  }
                  setSelectedFont(templateDefaultFonts[t] || 'Lato')
                  setHasUnsavedChanges(true)
                }}
                className="bg-transparent border-none text-xs focus:outline-none cursor-pointer max-w-[90px]"
              >
                {!templatePicked && <option value="" disabled>Template</option>}
                <option value="command">Command</option>
                <option value="crisp">Crisp</option>
                <option value="current">Current</option>               
                <option value="edge">Edge</option>
                <option value="prestige">Prestige</option>
                <option value="signature">Signature</option>
                <option value="sharp">Sharp (Compact)</option>
                <option value="vibe">Vibe (Compact) </option>

              </select>
            </div>

            {/* Font */}
            <div className="flex items-center gap-1 border border-gray-300 px-2 py-1 rounded hover:bg-gray-50">
              <span className="font-bold">A</span>
              <select
                value={selectedFont}
                onChange={(e) => { setSelectedFont(e.target.value); setHasUnsavedChanges(true) }}
                className="bg-transparent border-none text-xs focus:outline-none cursor-pointer max-w-[70px]"
              >
               <option value="EB Garamond">EB Garamond</option>
                <option value="Lato">Lato</option>
                <option value="Open Sans">Open Sans</option>
                <option value="Source Serif 4">Source Serif 4</option>
              </select>
            </div>

            {/* Size */}
            <div className="flex items-center gap-1 border border-gray-300 px-2 py-1 rounded hover:bg-gray-50">
              <span>⚙️</span>
              <select
                value={selectedSize}
                onChange={(e) => { setSelectedSize(Number(e.target.value)); setHasUnsavedChanges(true) }}
                className="bg-transparent border-none text-xs focus:outline-none cursor-pointer"
              >
                {[10, 11, 12].map(size => (
                  <option key={size} value={size}>{size}pt</option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div className="flex items-center gap-1 border border-gray-300 px-2 py-1 rounded hover:bg-gray-50">
              <span>📅</span>
              <select
                value={dateFormat}
                onChange={(e) => { setDateFormat(e.target.value); setHasUnsavedChanges(true) }}
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
              <div className="absolute left-0 top-full pt-1 z-50 hidden group-hover/zoom:block min-w-[80px]">
                <div className="bg-white border border-gray-200 rounded shadow-lg py-1">
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
            </div>

         {/* Color picker */}
            {(
              <div className="relative group/colorpick">
                <button
                  style={{ background: accentColor, width: '26px', height: '26px', borderRadius: '4px', border: '1px solid #d1d5db', cursor: 'pointer', flexShrink: 0, display: 'block' }}
                  title="Change accent color"
                />
                <div className="absolute left-0 top-full z-50 hidden group-hover/colorpick:block pt-1" style={{ minWidth: '120px' }}>
                <div className="bg-white border border-gray-200 rounded shadow-lg p-2">
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
                    const { data: { session: previewSession } } = await supabase.auth.getSession()
                    const response = await fetch('/api/generate-pdf', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${previewSession.access_token}` },
                      body: JSON.stringify({
                        resumeData: resume.resume_data,
                        templateName: templateForApi,
                        fontSize: selectedSize,
                        font: selectedFont,
                        accentColor: accentColor,
                        dateFormat,
                        spacing: selectedSpacing,
                        action: 'preview-url',
                        userId: user.id
                      })
                    })
                    if (response.ok) {
                      const data = await response.json()
                      setPreviewUrl(data.previewUrl)
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
                  ? `bg-purple-600 text-white hover:bg-purple-700 ${saveToastCount >= 3 ? 'animate-pulse' : ''}`
                  : 'bg-gray-300 text-gray-600'
              }`}
            >
              {saveSuccess ? '✓ Saved!' : hasUnsavedChanges ? '💾 Save' : 'No Changes'}
            </button>

              {/* Score */}
              {score && (
                <div className={`px-3 py-1 rounded font-semibold text-xs ${
                  score >= 85 ? 'bg-purple-100 text-purple-700' :
                  score >= 75 ? 'bg-green-100 text-green-700' :
                  score >= 60 ? 'bg-yellow-100 text-yellow-700' :
                  'bg-[#fdecea] text-red-700'
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
                className={`px-3 py-1 rounded text-xs font-medium flex items-center justify-center gap-1 w-20 text-white transition-opacity ${
                  isDownloading ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'
                }`}
                style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
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
         <div className="flex-1 flex overflow-hidden" style={{ height: 'calc(100dvh - 160px)' }}>
        <div className="flex-1 flex gap-6 p-0 md:p-6 max-w-7xl mx-auto w-full">
          <div ref={resumePanelRef} className={`flex-[3] bg-gray-100 md:bg-white md:rounded-lg md:shadow-sm md:border md:border-gray-200 overflow-y-auto relative ${mobilePanel === 'resume' ? 'block' : 'hidden'} md:block`}>

           {/* Capture counter — sticky strip above the resume */}
            <div className="sticky top-0 z-20">
              <CaptureCounter counts={captureCounts} bumpKey={captureBumpKey} journeyStep={journeyStep} />
            </div>

            {/* Capture toast — top-right of resume panel, below counter */}
            <CaptureToast
              message={(journeyStep === 'coach' || journeyStep === 'chat') ? captureToast : null}
              onClose={() => setCaptureToast(null)}
            />

            {resume?.created_via === 'resume_chat' && !resumeData?.fullName && (
              <div className="flex flex-col items-center justify-center h-full min-h-[300px] px-8 text-center">
                <div className="text-4xl mb-4">💬</div>
                <p className="text-sm font-semibold text-gray-700 mb-1">Your résumé will appear here</p>
                <p className="text-xs text-gray-500 leading-snug">Finish your conversation with Coach, then click the build button to see your résumé.</p>
              </div>
            )}
            <div
              data-resume-content="true"
              style={{
                transform: window.innerWidth < 768 ? `scale(${mobileScale})` : `scale(${zoom / 100})`,
                transformOrigin: 'top left',
                width: '816px',
                position: 'relative',
                fontFamily: selectedFont,
                fontSize: `${selectedSize}pt`,
                height: window.innerWidth < 768 ? `${816 * 1.294 * mobileScale}px` : 'auto',
              }}
            >
                <ResumeContent
                  resumeData={resumeData}
                  onUpdate={updateResumeData}
                  isUndoingRef={isUndoingRef}
                  formatDate={formatDate}
                  templateStyles={getTemplateStyles(selectedTemplate, accentColor, selectedSize, selectedFont)}
                  selectedTemplate={selectedTemplate}
                  onBulletAction={['improve','format','save'].includes(resume?.journey_step) && (userProfile?.subscription_tier || 'free') !== 'free' && resume?.coaching_complete ? (text, location) => {
                    setBulletSelectMode(null)
                    setReviseModalState({ mode: 'choose', text, location })
                  } : null}
                  bulletSelectMode={bulletSelectMode}
                />
            </div>
          </div>

 <div className={`flex-1 bg-white md:rounded-lg md:shadow-sm md:border md:border-gray-200 overflow-hidden flex flex-col md:px-6 ${mobilePanel === 'coach' ? 'flex' : 'hidden'} md:flex`}>
       <RightPanel 
              journeyStep={journeyStep}
              score={score}
              analysisResults={analysisResults}
              userTier={userProfile?.subscription_tier || 'free'}
              coachingSamplesUsed={coachingSamplesUsed}
              resumeName={resume.display_name || 'Core Resume'}
              userName={userProfile?.display_name}
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
              captureCounts={captureCounts}
              setCaptureCounts={setCaptureCounts}
              setCaptureBumpKey={setCaptureBumpKey}
              setCaptureToast={setCaptureToast}
              showRevealModal={showRevealModal}
              setShowRevealModal={setShowRevealModal}
              scoreBeforeCoaching={scoreBeforeCoaching}
              setScoreBeforeCoaching={setScoreBeforeCoaching}
              scoreAfterCoaching={scoreAfterCoaching}
              resume={resume}
              setPostCoachingAnalysis={setPostCoachingAnalysis}
              setRemainingGaps={setRemainingGaps}
          remainingGaps={remainingGaps}
          recoachAttempts={recoachAttempts}
          setRecoachAttempts={setRecoachAttempts}
          setShowUpgradeModal={setShowUpgradeModal}
          setCoachingSamplesUsed={setCoachingSamplesUsed}
          handleDownload={handleDownload}
          isDownloading={isDownloading}
          resetHistory={resetHistory}
          setReviseModalState={setReviseModalState}
          bulletSelectMode={bulletSelectMode}
          setBulletSelectMode={setBulletSelectMode}
            />
          </div>
        </div>
      </div>
      </div>
      <ErrorToast message={errorToast} onClose={() => setErrorToast(null)} />
      <SuccessToast message={saveToast} onClose={() => setSaveToast(null)} />
      <SuccessToast message={successToast} onClose={() => setSuccessToast(null)} />

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        resumeId={params.id}
      />

      {showTooLongModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        >
          <div
            className="bg-white rounded-xl shadow-2xl overflow-hidden"
            style={{ width: '364px' }}
          >
            <div className="px-6 py-6 relative" style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)' }}>
              <button onClick={() => setShowTooLongModal(false)} className="absolute top-3 right-4 text-white hover:opacity-70 text-2xl leading-none font-light">×</button>
              <div className="flex flex-col items-center text-center gap-2">
                <img src="/images/Hire_Power_icon.png" alt="Hire Power" className="h-16 w-auto mb-1" />
                <h2 className="text-xl font-bold text-white leading-tight">Resume Too Long</h2>
                <p className="text-purple-100" style={{ fontSize: '14px' }}>Auto-fit couldn't squeeze everything onto one page.</p>
              </div>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-gray-700 mb-3 leading-snug">Your resume has more content than can fit on one page, even at the smallest font size. For fit purposes, EB Garamond & Lato are the most compact fonts. Sharp & Edge are the most compact templates.</p>
              <div className="bg-purple-50 border-l-4 border-purple-600 p-2.5 rounded-r mb-4">
                <p className="text-sm text-gray-800 leading-snug">If your resume still exceeds one page, try removing older jobs, trimming bullets, or shortening your summary. </p>
              </div>
              <div className="flex justify-center">
                <button
                  onClick={() => setShowTooLongModal(false)}
                  className="rounded-lg py-2.5 px-8 text-sm font-semibold"
                  style={{ background: 'linear-gradient(to right, #667eea, #764ba2)', color: 'white' }}
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
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 md:p-8" style={{ backgroundColor: 'rgba(255,255,255,0.85)' }}>
          <div
            className="relative rounded-lg shadow-2xl overflow-hidden bg-white"
            style={{ height: '90vh', width: 'calc(90vh * 8.5 / 11)', maxWidth: '95vw' }}
          >
            <button
              onClick={() => { setShowPreview(false); setPreviewUrl(null) }}
              className="absolute top-2 right-2 z-10 w-7 h-7 flex items-center justify-center rounded-full text-gray-600 hover:text-gray-900 text-xl leading-none font-light"
              style={{ background: 'rgba(255,255,255,0.9)', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }}
            >×</button>
            {previewUrl && <PDFViewer url={previewUrl} />}
          </div>
        </div>
      )}

      {reviseModalState && (
        <CoachReviseModal
          state={reviseModalState}
          onClose={() => { setReviseModalState(null); setBulletSelectMode(null) }}
          resumeData={resumeData}
          coachingMessages={coachingMessages}
          careerContext={careerContext}
          supabase={supabase}
          resumeId={params?.id}
          setResume={setResume}
          onUpdate={updateResumeData}
          onReviewChangeUpdate={(changeIndex, newText) => {
            setResumeChanges(prev => {
              const updated = [...prev]
              updated[changeIndex] = { ...updated[changeIndex], after: newText }
              return updated
            })
            setReviseModalState(null)
          }}
        />
      )}
    </>
  )
}

// Right Panel Component
function RightPanel({ journeyStep, score, analysisResults, userTier, resumeName, userName, userProfile, supabase, params, setResume, handleReassess, isAnalyzing, detectedLevel, resumeData, careerContext, rewrittenResume, setRewrittenResume, resumeChanges, setResumeChanges, coachingMessages, setCoachingMessages, showRevealModal, setShowRevealModal, scoreBeforeCoaching, setScoreBeforeCoaching, scoreAfterCoaching, coachingSamplesUsed, resume, showUpgradeModal, setShowUpgradeModal, setPostCoachingAnalysis, setRemainingGaps, remainingGaps, recoachAttempts, setRecoachAttempts, setCoachingSamplesUsed, handleDownload, isDownloading, resetHistory, captureCounts, setCaptureCounts, setCaptureBumpKey, setCaptureToast, setReviseModalState, bulletSelectMode, setBulletSelectMode }) {
  const isJobSpecific = resume?.resume_type === 'job_specific'
  const jobAnalysis = analysisResults?.analysis || analysisResults || {}
  const matchedCount = jobAnalysis.matchedCount ?? jobAnalysis.matchedKeywords?.length ?? 0
  const missingCount = jobAnalysis.missingCount ?? jobAnalysis.missingKeywords?.length ?? 0

  const isConversational = resume?.created_via === 'resume_chat'
  const skippedCoaching = isJobSpecific && resume?.coaching_complete === true && (!resume?.coaching_conversation || resume.coaching_conversation.length === 0)
  const steps = isJobSpecific
    ? (userTier === 'free'
        ? ['assess', 'save']
        : skippedCoaching
        ? ['assess', 'improve', 'format', 'save']
        : ['assess', 'coach', 'improve', 'format', 'save'])
    : isConversational
    ? ['chat', 'improve', 'format', 'save']
    : ['review', 'assess', 'coach', 'improve', 'format', 'save']
  const currentIndex = steps.indexOf(journeyStep)
  const [isUpdatingJourney, setIsUpdatingJourney] = useState(false)
  const [errorToast, setErrorToast] = useState(null)
  const [maxStepIndex, setMaxStepIndex] = useState(currentIndex)
  const [viewingStep, setViewingStep] = useState(null)
  const [showSkipCoachingModal, setShowSkipCoachingModal] = useState(false)
  const [isSkipCoachingFinishing, setIsSkipCoachingFinishing] = useState(false)

  useEffect(() => {
    if (currentIndex > maxStepIndex) {
      setMaxStepIndex(currentIndex)
    }
  }, [currentIndex])

  // When the DB step advances (forward progression), clear the viewing override
  // so the user sees their actual current step, not a stale view of an earlier one.
  useEffect(() => {
    setViewingStep(null)
  }, [journeyStep])

  // displayStep is what the right panel renders. It prefers viewingStep
  // (in-memory backward navigation) and falls back to journeyStep (DB truth).
  const displayStep = viewingStep || journeyStep
  const displayIndex = steps.indexOf(displayStep)
  const panelRef = useRef(null)

  // Scroll to top when journey step changes to 'assess'
  useEffect(() => {
    if (journeyStep === 'assess' && panelRef.current) {
      panelRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [journeyStep])

 const isConvCoach = (journeyStep === 'coach' || journeyStep === 'chat') && resume?.created_via === 'resume_chat' && !resume?.coaching_complete

 return (
   <div ref={panelRef} className={isConvCoach ? "flex flex-col overflow-hidden flex-1 px-3 md:pl-0 md:pr-3" : "overflow-y-auto overflow-x-hidden flex-1 pb-6 px-3 md:pl-0 md:pr-3 md:pb-6"}>
      
 <div className={`sticky top-0 bg-white px-4 md:-mx-6 md:px-6 z-10 flex-shrink-0 ${isConvCoach ? '' : 'pt-3 md:pt-4'} ${isJobSpecific && userTier === 'free' ? 'mb-2 pb-2 border-b border-gray-100' : isConvCoach ? 'mb-1 pb-2 border-b border-gray-100' : 'mb-3 md:mb-4 pb-2 md:pb-3 border-b border-gray-100'}`} style={isConvCoach ? { paddingTop: '18px' } : {}}>
 {isJobSpecific ? (
        <div className="mb-3 text-center">
          <h3 className="font-bold text-base md:text-sm text-gray-900 leading-tight">{resumeName}</h3>
          {(userTier !== 'free') && (
            <div className="mt-3">
              <p className="text-xs md:text-[10px] text-purple-600 font-semibold uppercase tracking-wide">Resume Tailoring Progress</p>
            </div>
          )}
        </div>
      ) : (
       <h3 className="text-center font-semibold text-base md:text-sm mb-3">
          {isConversational ? (
            <>brb <span className="text-gray-400">·</span> best resume builder</>
          ) : (
            <>{userName ? `${userName.split(' ')[0]}'s ` : ''}{resumeName} Progress</>
          )}
        </h3>
      )}
        
        <div className={`relative ${isJobSpecific && userTier === 'free' ? 'hidden' : ''}`}>
          <div className="absolute top-3 left-0 right-0 h-0.5 bg-gray-300">
            <div 
              className="h-full transition-all duration-300"
              style={{ 
                width: `${maxStepIndex >= 0 ? (maxStepIndex / (steps.length - 1)) * 100 : 0}%`,
                background: 'linear-gradient(to right, #667eea, #764ba2)'
              }}
            />
          </div>
          
        <div className={`relative flex justify-between ${isJobSpecific && userTier === 'free' ? 'hidden' : ''}`}>
            {steps.map((step, index) => (
              <div key={step} className="flex flex-col items-center">
                <div
                  onClick={() => {
                    if (index > maxStepIndex || index === displayIndex) return
                    setViewingStep(step)
                  }}
                  className={`
                    w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold z-10
                   ${index < displayIndex ? 'text-white cursor-pointer transition-colors' :
                    index === displayIndex ? 'text-white' :
                    index <= maxStepIndex ? 'text-white cursor-pointer transition-colors' :
                    'bg-white border-2 border-gray-300 text-gray-400'}
                  `}
                  style={index <= maxStepIndex ? { background: 'linear-gradient(to bottom right, #667eea, #764ba2)' } : {}}>
                 {index < displayIndex ? '✓' : index === displayIndex ? '●' : index <= maxStepIndex ? '✓' : '○'}
                </div>
                <span
                  onClick={() => {
                    if (index >= maxStepIndex || index === displayIndex) return
                    setViewingStep(step)
                  }}
                 className={`text-sm md:text-xs mt-1 capitalize ${
                    index === displayIndex ? 'text-purple-600 font-semibold' :
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

 {displayStep === 'review' && (
        <>
          <h3 className="font-semibold text-lg -mt-3 mb-3">📝 Review Your Resume</h3>
          
          <p className="text-sm md:text-xs text-gray-700 mb-3">
            AI parsing isn't perfect, so things occasionally land in the wrong spot. Take a quick look at your resume, and make sure everything's where it should be. Click any section to edit or move content around.
          </p>

          <div className="bg-purple-50 border-l-4 border-purple-500 p-3 mb-4">
            <div className="text-sm md:text-xs text-purple-900 space-y-2">
              <div><strong>✓ Check contact info</strong></div>
              <div><strong>✓ Verify job titles and dates</strong></div>
              <div><strong>✓ Review bullet points</strong></div>
              <div><strong>✓ Confirm education details</strong></div>
            </div>
          </div>

          {!score && (
            <div className="flex justify-center">
              <button 
                onClick={() => handleReassess()}
                disabled={isAnalyzing}
                className={`text-white rounded-lg px-6 py-2 font-medium text-sm transition-opacity flex items-center justify-center gap-2 ${
                  isAnalyzing ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'
                }`}
              style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
              >
                {isAnalyzing && (
                  <div className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>
                )}
                {isAnalyzing ? 'Analyzing...' : 'Looks Good → Assess Resume'}
              </button>
            </div>
          )}
        </>
      )}
      
  {displayStep === 'assess' && isJobSpecific && (
  <div className="space-y-4">
    <div className="text-center mt-3">
      <div className="text-sm md:text-xs text-gray-500 uppercase tracking-wide mb-1">Job Match Score</div>
      <div className="flex items-baseline justify-center gap-1 mb-2">
        <span className="text-5xl font-bold text-gray-900">{score || '--'}</span>
        <span className="text-xl text-gray-400">%</span>
      </div>
      <div className="h-4 bg-gray-200 rounded-full overflow-hidden mb-2 shadow-inner">
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${score || 0}%`,
            background: (score || 0) >= 85 ? '#9333ea' : (score || 0) >= 75 ? '#81c784' : (score || 0) >= 60 ? '#ffc870' : '#e57373'
          }}
        />
      </div>
    <div className="flex items-center justify-between md:justify-center md:gap-3 text-xs md:text-[9px] text-gray-600">
  {[
    { color: '#e57373', label: 'Needs Work' },
    { color: '#ffc870', label: 'Developing' },
    { color: '#81c784', label: 'Strong' },
    { color: '#9333ea', label: 'Excellent' },
  ].map(({ color, label }) => (
    <div key={label} className="flex items-center gap-1">
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }}></div>
      <span>{label}</span>
    </div>
  ))}
</div>
</div>

  {userTier === 'free' ? (
      <>
        {(matchedCount || missingCount) ? (
          <p className="text-sm md:text-xs text-gray-700 text-center -mt-1">
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
                <li key={i} className="flex items-start gap-2 text-sm md:text-xs text-gray-700">
                  <span className="text-purple-600 mt-0.5 flex-shrink-0">✓</span>
                  <span>{sentence.slice(1).trim()}</span>
                </li>
              ))}
              {hasMore && (
               <li className="flex items-start gap-2 text-sm md:text-xs text-gray-700">
                  <span className="mt-0.5 flex-shrink-0">⚠️</span>
                 <span className="text-purple-600 font-semibold">Additional strengths and opportunities identified — upgrade to reveal</span>
                </li>
              )}
            </ul>
          )
        })()}

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <p className="text-sm md:text-xs font-semibold text-purple-800 mb-2">
            🔒 {matchedCount} skills matched · {missingCount} to address
          </p>
          <p className="text-sm md:text-xs text-gray-600 mb-3">Upgrade to Pro to see exactly what's missing and get personalized coaching to close the gap so your resume becomes a stronger match for this specific job.</p>
          <button
            onClick={() => setShowUpgradeModal(true)}
            className="block mx-auto text-white rounded-lg py-2 px-8 text-sm md:text-xs font-semibold transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
          >
            Close the Gap on This Job →
          </button>
        {(() => {
            const s = score || 0
            const msg = s >= 85
              ? <>Even strong matches get sharper! Pro users typically gain <span className="font-semibold">3–5 points</span> closing specific skill gaps on their resume.</>
              : s >= 75
              ? <>Pro users who coach this type of resume see an average <span className="font-semibold">8-point score improvement.</span></>
              : <>Pro users who coach low-match resumes see an average <span className="font-semibold">12-point score improvement.</span></>
           return (
              <div className="border-l-4 border-purple-400 pl-2 mt-3">
                <p className="text-sm md:text-xs text-gray-500 italic leading-snug">{msg}</p>
              </div>
            )
          })()}
          <div className="text-center mt-3">
            <button
              onClick={() => window.location.href = '/resume-coach'}
              className="text-gray-400 text-sm md:text-xs hover:text-gray-600"
            >
              ← Back to Resume Coach
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
              <li key={i} className="flex items-start gap-2 text-sm md:text-xs text-gray-600">
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
            <h4 className="text-sm md:text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#81c784' }}>✅ Matched Skills</h4>
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
            <h4 className="text-sm md:text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#e57373' }}>⚠️ Skills to Address</h4>
            <div className="flex flex-wrap gap-1.5">
              {analysisResults.analysis.missingKeywords.map((kw, i) => (
                <span key={i} className="bg-red-50 border border-red-200 text-red-700 text-xs px-2 py-0.5 rounded-full">{kw}</span>
              ))}
            </div>
          </div>
        )}

       {!resume?.coaching_complete && (
        <div className="space-y-4 pt-2">
          <div className="text-center">
            <p className="text-xs md:text-[10px] text-purple-600 font-semibold uppercase tracking-wide mb-1">More to add?</p>
            <p className="text-sm md:text-xs text-gray-600 mb-2 leading-snug">
              Tell us about the extra skills and experience, and we'll use it to strengthen your resume.
            </p>
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
              className="block mx-auto text-white rounded-lg py-2 px-8 text-sm md:text-xs font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
            >
              Coach Me Through It →
            </button>
          </div>

          <div className="text-center">
            <p className="text-xs md:text-[10px] text-purple-600 font-semibold uppercase tracking-wide mb-1">Nothing more to add?</p>
            <p className="text-sm md:text-xs text-gray-600 mb-2 leading-snug">
              We'll use your existing content to tailor your resume as well as possible for this job.
            </p>
            <button
              onClick={() => setShowSkipCoachingModal(true)}
              className="block mx-auto bg-white text-purple-600 border border-purple-300 rounded-lg py-2 px-8 text-sm md:text-xs font-semibold hover:bg-purple-50 transition-colors"
            >
              Tailor Without Coaching →
            </button>
          </div>
        </div>
       )}
      </>
    )}
  </div>
)}
 {displayStep === 'assess' && !isJobSpecific && (
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
        background: (score || 62) >= 85 ? '#9333ea' : (score || 62) >= 75 ? '#81c784' : (score || 62) >= 60 ? '#ffc870' : '#e57373'
      }}
    />
  </div>
  
 <div className="flex items-center justify-between md:justify-center md:gap-3 text-xs md:text-[9px] text-gray-600">
  {[
    { color: '#e57373', label: 'Needs Work' },
    { color: '#ffc870', label: 'Developing' },
    { color: '#81c784', label: 'Strong' },
    { color: '#9333ea', label: 'Excellent' },
  ].map(({ color, label }) => (
    <div key={label} className="flex items-center gap-1">
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }}></div>
      <span>{label}</span>
    </div>
  ))}
</div>
</div>
          
         {/* Breakdown - RESTRUCTURED */}
            <div className="bg-white rounded-lg p-4">
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-1.5">Breakdown</h3>
              
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between items-baseline mb-0.5">
                    <span className="font-semibold text-gray-900 text-sm">Impact</span>
                    <span className="text-gray-700 font-medium text-sm">{analysisResults?.analysis?.breakdown?.impact || 25}/50</span>
                  </div>
                 <div className="text-sm md:text-[11px] text-gray-500 leading-tight mb-1.5">
                    {detectedLevel === 'entry' && 'Specificity, scope, and scale'}
                    {detectedLevel === 'mid' && 'Specificity, scope, scale & results'}
                    {detectedLevel === 'senior' && 'Specificity, scope, scale & organizational impact'}
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
  className="h-full"
  style={{ 
    width: `${((analysisResults?.analysis?.breakdown?.impact || 25)/50)*100}%`,
    background: (analysisResults?.analysis?.breakdown?.impact || 25)/50 >= 0.85 ? '#9333ea' :
            (analysisResults?.analysis?.breakdown?.impact || 25)/50 >= 0.75 ? '#81c784' :
            (analysisResults?.analysis?.breakdown?.impact || 25)/50 >= 0.60 ? '#ffc870' :
            '#e57373'
  }}
></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between items-baseline mb-0.5">
                    <span className="font-semibold text-gray-900 text-sm">Clarity</span>
                    <span className="text-gray-700 font-medium text-sm">{analysisResults?.analysis?.breakdown?.clarity || 18}/30</span>
                  </div>
                  <div className="text-sm md:text-[11px] text-gray-500 leading-tight mb-1.5">Active voice, strong verbs, concise language</div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
  className="h-full"
  style={{ 
    width: `${((analysisResults?.analysis?.breakdown?.clarity || 18)/30)*100}%`,
    background: (analysisResults?.analysis?.breakdown?.clarity || 18)/30 >= 0.85 ? '#9333ea' :
            (analysisResults?.analysis?.breakdown?.clarity || 18)/30 >= 0.75 ? '#81c784' :
            (analysisResults?.analysis?.breakdown?.clarity || 18)/30 >= 0.60 ? '#ffc870' :
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
                 <div className="text-sm md:text-[11px] text-gray-500 leading-tight mb-1.5">
                  {detectedLevel === 'entry' && 'Field vocabulary, tools, and software names'}
{detectedLevel === 'mid' && 'Field vocabulary, tools, and software names'}
{detectedLevel === 'senior' && 'Field vocabulary, tools, methodologies, and systems'}
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                   <div 
  className="h-full"
  style={{ 
    width: `${((analysisResults?.analysis?.breakdown?.keywords || 14)/20)*100}%`,
    background: (analysisResults?.analysis?.breakdown?.keywords || 14)/20 >= 0.85 ? '#9333ea' :
            (analysisResults?.analysis?.breakdown?.keywords || 14)/20 >= 0.75 ? '#81c784' :
            (analysisResults?.analysis?.breakdown?.keywords || 14)/20 >= 0.60 ? '#ffc870' :
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
                <li key={i} className="text-sm md:text-xs text-gray-700 flex gap-2 leading-snug">
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
              {((resume?.coaching_complete === true
  ? (analysisResults?.analysis?.weaknesses || []).filter(w => ![
      /weak verb/i, /action verb/i, /passive/i, /vague language/i,
      /filler/i, /rephrase/i, /reword/i, /stronger language/i,
      /word choice/i, /clarity/i, /grammar/i,
      /spelling/i, /punctuation/i, /sentence structure/i, /break up/i,
      /split/i, /combine/i, /rewrite/i, /restructure/i,
      /stronger verb/i, /replace.*verb/i, /strengthen.*verb/i,
      /ownership verb/i, /stronger action verb/i, /need stronger/i,
      /concise/i, /streamline/i, /wordy/i, /redundant/i
    ].some(p => p.test(w)))
  : (analysisResults?.analysis?.weaknesses || [])
) || [
                "Three experience bullets lack quantifiable metrics or measurable outcomes.",
                "Vague language such as 'managed team' without specifying team size or budget.",
                "Generic claim of 'improved efficiency' requires percentage or specific timeframe.",
                "Missing keywords from target job description in technical skills section.",
                "Education section could benefit from relevant coursework or academic honors.",
                "Event coordination lacks scope indicators such as event count or budget details."
             ]).map((weakness, i) => (
                <li key={i} className="text-sm md:text-xs text-gray-700 flex gap-2 leading-snug">
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
              {((resume?.coaching_complete === true
  ? (analysisResults?.analysis?.suggestions || []).filter(s => ![
      /weak verb/i, /action verb/i, /passive/i, /vague language/i,
      /filler/i, /rephrase/i, /reword/i, /stronger language/i,
      /word choice/i, /clarity/i, /grammar/i,
      /spelling/i, /punctuation/i, /sentence structure/i, /break up/i,
      /split/i, /combine/i, /rewrite/i, /restructure/i,
      /stronger verb/i, /replace.*verb/i, /strengthen.*verb/i,
      /ownership verb/i, /stronger action verb/i, /need stronger/i,
      /concise/i, /streamline/i, /wordy/i, /redundant/i
    ].some(p => p.test(s)))
  : (analysisResults?.analysis?.suggestions || [])
) || [
                "Add team size (e.g., 'Led team of 8') and budget amounts to management role descriptions.",
                "Quantify efficiency improvement with specific metrics: '30% faster turnaround' or 'saved 10 hours weekly'.",
                "Include 2-3 technical skills from job description, such as Salesforce, Tableau, or Asana.",
                "Add specific event metrics: '60+ annual events with 200-500 attendees, $50K average budget'.",
                "Strengthen education section: include GPA if above 3.5, relevant coursework, or academic honors.",
                "Replace weak verbs like 'helped' and 'responsible for' with action verbs showing direct impact."
              ]).map((suggestion, i) => (
                <li key={i} className="text-sm md:text-xs text-gray-700 flex gap-2 leading-snug">
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
                  <h4 className="font-semibold text-gray-900 mb-1 text-base md:text-sm">What's Next?</h4>
            
                </div>
                {coachingSamplesUsed > 0 ? (
                  <>
                    <button
                      onClick={() => setShowUpgradeModal(true)}
                      className="block mx-auto text-white rounded-lg py-2 px-4 text-sm md:text-xs font-semibold transition-opacity hover:opacity-90"
                      style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
                    >
                      Upgrade to Pro — we'll find the missing details and rewrite everything for you.
                    </button>
                    <p className="text-sm md:text-xs text-gray-500 text-center">
                      Pro users avg <strong className="text-purple-600">+16 pts</strong> after full coaching
                    </p>
                    <div className="text-center">
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
                              console.error('Error advancing to improve step:', error)
                              setErrorToast("We couldn't move you to the improve step. Please try again.")
                              return
                            }
                            setResume(prev => ({ ...prev, journey_step: 'improve' }))
                            fireO4MarkerIfFirst(supabase)
                          } catch (err) {
                            console.error('Unexpected error advancing to improve step:', err)
                            setErrorToast("Something went wrong. Please try again.")
                          } finally {
                            setIsUpdatingJourney(false)
                          }
                        }}
                        disabled={isUpdatingJourney}
                        className="text-sm md:text-xs text-gray-400 hover:text-gray-600"
                      >
                        Make changes myself →
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setShowUpgradeModal(true)}
                      className="block mx-auto text-white rounded-lg py-2 px-4 text-sm md:text-xs font-semibold transition-opacity hover:opacity-90"
                      style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
                    >
                      Upgrade to Pro — we'll find the missing details and rewrite everything for you.
                    </button>
                    <p className="text-sm md:text-xs text-gray-500 text-center">
                      Pro users avg <strong className="text-purple-600">+16 pts</strong> after full coaching
                    </p>
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
                          if (error) {
                            console.error('Error starting free trial coaching:', error)
                            setErrorToast("We couldn't start your coaching session. Please try again.")
                            return
                          }
                          setResume(prev => ({ ...prev, journey_step: 'coach' }))
                       } catch (err) {
                        console.error('Unexpected error starting free trial coaching:', err)
                        setErrorToast("Something went wrong starting your coaching session. Please try again.")
                      } finally {
                        setIsUpdatingJourney(false)
                      }
                    }}
                    disabled={isUpdatingJourney}
                    className={`block mx-auto bg-white text-purple-600 border border-purple-300 rounded-lg py-2 px-8 text-sm md:text-xs font-semibold hover:bg-purple-50 transition-colors ${
                        isUpdatingJourney ? 'opacity-75 cursor-not-allowed' : ''
                      }`}
                    >
                      Try a free coaching session →
                    </button>
                  </>
                )}
              </div>
            ) : (
              // PRO TIER - Start coaching only if not yet started AND not already complete
              (resume?.coaching_complete || maxStepIndex > steps.indexOf('assess')) ? null : (
                <button
                  onClick={async () => {
                    setIsUpdatingJourney(true)
                    try {
                      const { error } = await supabase
                        .from('resumes')
                        .update({ journey_step: 'coach', updated_at: new Date().toISOString() })
                        .eq('id', params.id)
                      if (error) {
                        setErrorToast('Something went wrong. Please try again.')
                      } else {
                        track('assessment_completed', { score: score || 0 })
                        setResume(prev => ({ ...prev, journey_step: 'coach' }))
                      }
                    } catch (err) {
                      setErrorToast('Something went wrong. Please try again.')
                    } finally {
                      setIsUpdatingJourney(false)
                    }
                  }}
                  disabled={isUpdatingJourney}
                  className={`mx-auto block text-white rounded-lg py-2 px-8 text-sm md:text-xs font-semibold transition-opacity flex items-center gap-2 ${
                    isUpdatingJourney ? 'opacity-75 cursor-not-allowed' : 'hover:opacity-90'
                  }`}
                  style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
                >
                  {isUpdatingJourney && (
                    <div className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>
                  )}
                  {isUpdatingJourney ? 'Loading...' : 'Start Coaching →'}
                </button>
              )
            )}
            
                </div>
        </div>
      )}
       
      {(displayStep === 'coach' || displayStep === 'chat') && (
              <CoachStep
          resume={resume}
          resumeData={resumeData}
          coachingComplete={resume?.coaching_complete || false}
          coachingTierAtSave={resume?.coaching_tier_at_save || null}
          careerContext={careerContext}
          isConversational={isConversational}
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
          trialCoachingUsed={coachingSamplesUsed > 0}
          isJobSpecific={isJobSpecific}
          jobDescription={resume?.job_description || null}
          jobTitle={resume?.job_title || null}
          jobCompany={resume?.job_company || null}
          analysisResults={analysisResults}
          showUpgradeModal={showUpgradeModal}
          setShowUpgradeModal={setShowUpgradeModal}
          scoreBeforeCoaching={scoreBeforeCoaching}
          setScoreBeforeCoaching={setScoreBeforeCoaching}
          setPostCoachingAnalysis={setPostCoachingAnalysis}
          setRemainingGaps={setRemainingGaps}
          setCoachingSamplesUsed={setCoachingSamplesUsed}
          changesAccepted={resume?.changes_accepted || false}
          remainingGaps={remainingGaps}
          score={score}
          resetHistory={resetHistory}
          captureCounts={captureCounts}
          setCaptureCounts={setCaptureCounts}
          setCaptureBumpKey={setCaptureBumpKey}
          setCaptureToast={setCaptureToast}
        />
      )}

   {displayStep === 'improve' && (
       <ImproveStep
          rewrittenResume={rewrittenResume}
          resumeChanges={resumeChanges}
          isConversational={isConversational}
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
          remainingGaps={remainingGaps}
          setRemainingGaps={setRemainingGaps}
          recoachAttempts={recoachAttempts}
          setRecoachAttempts={setRecoachAttempts}
          userName={userProfile?.display_name || resumeData?.fullName}
          userProfile={userProfile}
          detectedLevel={detectedLevel}
          setShowUpgradeModal={setShowUpgradeModal}
          changesAccepted={resume?.changes_accepted || false}
          coachingMessages={coachingMessages}
          careerContext={careerContext}
          setReviseModalState={setReviseModalState}
          bulletSelectMode={bulletSelectMode}
          setBulletSelectMode={setBulletSelectMode}
          setViewingStep={setViewingStep}
        />
      )}

      

      {displayStep === 'format' && (
  <FormatStep
    supabase={supabase}
    params={params}
    setResume={setResume}
    handleReassess={handleReassess}
    isAnalyzing={isAnalyzing}
    score={score}
    userTier={userTier}
    setReviseModalState={setReviseModalState}
    coachingComplete={resume?.coaching_complete}
    setViewingStep={setViewingStep}
  />
)}

     <ErrorToast message={errorToast} onClose={() => setErrorToast(null)} />

      {displayStep === 'save' && (
        <SaveStep
          resumeName={resumeName}
          userName={userName}
          params={params}
          isJobSpecific={isJobSpecific}
          userTier={userTier}
          handleDownload={handleDownload}
          isDownloading={isDownloading}
        />
      )}

      {viewingStep && viewingStep !== journeyStep && (
        <div className="mt-6 pt-4 border-t border-gray-100 flex justify-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full text-xs font-medium text-green-700">
            <span>✅</span>
            <span>
              {viewingStep === 'review' && 'Review Complete'}
              {viewingStep === 'assess' && 'Assessment Complete'}
              {viewingStep === 'coach' && 'Coaching Complete'}
              {viewingStep === 'chat' && 'Conversation Complete'}
              {viewingStep === 'improve' && 'Improvements Complete'}
              {viewingStep === 'format' && 'Formatting Complete'}
            </span>
          </div>
        </div>
      )}

      {showSkipCoachingModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        >
          <div
            className="bg-white rounded-xl shadow-2xl overflow-hidden"
            style={{ width: '364px' }}
          >
            <div className="px-6 py-6 relative" style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)' }}>
              <button
                onClick={() => !isSkipCoachingFinishing && setShowSkipCoachingModal(false)}
                disabled={isSkipCoachingFinishing}
                className="absolute top-3 right-4 text-white hover:opacity-70 text-2xl leading-none font-light disabled:opacity-50"
              >×</button>
              <div className="flex flex-col items-center text-center gap-2">
                <img src="/images/Hire_Power_icon.png" alt="Hire Power" className="h-16 w-auto mb-1" />
                <h2 className="text-xl font-bold text-white leading-tight">Nothing more to add?</h2>
              </div>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-gray-700 mb-4 leading-snug">
                We'll use your existing content to make your resume read like it was written for this role. Your job match score likely won't change much since we won't be adding new skills or experience, but this will help it stand out to recruiters.
              </p>
              <div className="flex flex-col gap-2 items-center">
                <button
                  onClick={async () => {
                    setIsSkipCoachingFinishing(true)
                    try {
                      const { data: { session } } = await supabase.auth.getSession()
                      const response = await fetch('/api/coach-finish', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${session.access_token}`
                        },
                        body: JSON.stringify({
                          resumeData,
                          conversation: [],
                          detectedLevel,
                          careerContext,
                          isJobSpecific: true,
                          jobDescription: resume?.job_description || null,
                          jobTitle: resume?.job_title || null,
                          jobCompany: resume?.job_company || null,
                          matchedKeywords: analysisResults?.analysis?.matchedKeywords || [],
                          missingKeywords: analysisResults?.analysis?.missingKeywords || [],
                          skipCoaching: true
                        })
                      })
                      const data = await response.json()
                      if (!data.rewrittenResume) throw new Error('Rewrite failed')

                      setRewrittenResume(data.rewrittenResume)
                      setResumeChanges(data.changes || [])

                      const { error: saveError } = await supabase
                        .from('resumes')
                        .update({
                          journey_step: 'improve',
                          rewritten_resume: data.rewrittenResume,
                          resume_changes: data.changes || [],
                          coaching_complete: true,
                          updated_at: new Date().toISOString()
                        })
                        .eq('id', params.id)

                      if (saveError) {
                        console.error('Error saving tailored resume:', saveError)
                        setErrorToast("We tailored your resume but couldn't save it. Please try again.")
                        setIsSkipCoachingFinishing(false)
                        return
                      }

                      setResume(prev => ({ ...prev, journey_step: 'improve' }))
                      setShowSkipCoachingModal(false)
                      fireT4IfFirst(supabase)
                    } catch (err) {
                      console.error('Error tailoring resume:', err)
                      setErrorToast('Something went wrong. Please try again.')
                      setIsSkipCoachingFinishing(false)
                    }
                  }}
                  disabled={isSkipCoachingFinishing}
                  className="rounded-lg py-2.5 px-8 text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
                  style={{ background: 'linear-gradient(to right, #667eea, #764ba2)', color: 'white' }}
                >
                  {isSkipCoachingFinishing && <div className="h-3 w-3 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>}
                  {isSkipCoachingFinishing ? 'Tailoring your resume...' : 'Tailor My Resume →'}
                </button>
                <button
                  onClick={() => setShowSkipCoachingModal(false)}
                  disabled={isSkipCoachingFinishing}
                  className="text-gray-400 text-xs hover:text-gray-600 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
// ─────────────────────────────────────────────
// COACH STEP
// ─────────────────────────────────────────────
function CoachStep({ resume, resumeData, careerContext, detectedLevel, userName, userProfile, supabase, params, setResume, coachingMessages, setCoachingMessages, setRewrittenResume, setResumeChanges, userTier: userTierProp, trialCoachingUsed, isJobSpecific, jobDescription, jobTitle, jobCompany, analysisResults, showUpgradeModal, setShowUpgradeModal, scoreBeforeCoaching, setScoreBeforeCoaching, setPostCoachingAnalysis, setRemainingGaps, setCoachingSamplesUsed, coachingComplete, remainingGaps, changesAccepted, score, isConversational, resetHistory, coachingTierAtSave, captureCounts, setCaptureCounts, setCaptureBumpKey, setCaptureToast }) {
  const [sending, setSending] = useState(false)
  const [isFinishing, setIsFinishing] = useState(false)
  const [errorToast, setErrorToast] = useState(null)
  const [userInput, setUserInput] = useState('')
  const [userTier, setUserTier] = useState(userTierProp || null)
  const [trialComplete, setTrialComplete] = useState(false)
  const [trialResult, setTrialResult] = useState(null)
  const [showTrialRevealModal, setShowTrialRevealModal] = useState(false)
  const [editingBullet, setEditingBullet] = useState(false)
  const [editedBullet, setEditedBullet] = useState('')
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const previousMessageCount = useRef(0)
  const hasStartedCoaching = useRef(false)

  // Capture system: track what's already been counted to prevent duplicates
  // when a message gets re-processed (e.g. on remount or state replay).
  const seenCapturesRef = useRef(new Set())

  // Send the user's last message + assistant's response to the extraction API.
  // Updates counts, fires toast for achievements, persists to DB so reloads keep counter intact.
  // Runs as fire-and-forget so it never blocks the UI.
  async function processCaptures(userMessageText, assistantResponseText) {
    if (!setCaptureCounts || !setCaptureBumpKey || !setCaptureToast) return

    // Skip capture processing for free trial — only single-bullet feedback, no captures
    if (userTier === 'free') return

    if (!userMessageText || !assistantResponseText) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch('/api/extract-captures', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          userMessage: userMessageText,
          assistantResponse: assistantResponseText,
          isJobSpecific: isJobSpecific || false
        })
      })

      if (!response.ok) return

      const data = await response.json()
      const captures = data.captures || []
      if (captures.length === 0) return

      // Track which captures were actually new (not duplicates) for DB persistence.
      const newlyAccepted = []

      captures.forEach(capture => {
        const dedupeKey = `${capture.type}:${capture.payload.toLowerCase()}`
        if (seenCapturesRef.current.has(dedupeKey)) return
        seenCapturesRef.current.add(dedupeKey)

        // For job-specific coaching: only skill and achievement tags should fire
        if (isJobSpecific && (capture.type === 'job' || capture.type === 'education')) return

        newlyAccepted.push({ ...capture, dedupeKey })
        const stamp = Date.now() + Math.random()

        if (capture.type === 'job') {
          setCaptureCounts(prev => ({ ...prev, jobs: (prev.jobs || 0) + 1 }))
          setCaptureBumpKey(`jobs:${stamp}`)
        } else if (capture.type === 'education') {
          setCaptureCounts(prev => ({ ...prev, education: (prev.education || 0) + 1 }))
          setCaptureBumpKey(`education:${stamp}`)
        } else if (capture.type === 'skill') {
          setCaptureCounts(prev => ({ ...prev, skills: (prev.skills || 0) + 1 }))
          setCaptureBumpKey(`skills:${stamp}`)
        } else if (capture.type === 'achievement') {
          setCaptureCounts(prev => ({ ...prev, wins: (prev.wins || 0) + 1 }))
          setCaptureBumpKey(`wins:${stamp}`)
          setCaptureToast(capture.payload)
        }
      })

      // Persist updated capture state to DB so it survives reloads.
      // Read current state from DB, increment, write back. Read-modify-write keeps
      // the source of truth in the DB and avoids stale React state issues.
      if (newlyAccepted.length > 0) {
        const { data: row } = await supabase
          .from('resumes')
          .select('captured_data')
          .eq('id', params.id)
          .single()

        const current = row?.captured_data || { jobs: 0, education: 0, skills: 0, wins: 0, seenKeys: [] }
        const seenKeys = new Set(current.seenKeys || [])

        let jobs = current.jobs || 0
        let education = current.education || 0
        let skills = current.skills || 0
        let wins = current.wins || 0

        newlyAccepted.forEach(c => {
          if (seenKeys.has(c.dedupeKey)) return
          seenKeys.add(c.dedupeKey)
          if (c.type === 'job') jobs++
          else if (c.type === 'education') education++
          else if (c.type === 'skill') skills++
          else if (c.type === 'achievement') wins++
        })

        await supabase
          .from('resumes')
          .update({
            captured_data: {
              jobs,
              education,
              skills,
              wins,
              seenKeys: Array.from(seenKeys)
            }
          })
          .eq('id', params.id)
      }
    } catch (err) {
      console.error('Capture extraction failed:', err)
    }
  }

  // On mount, seed the dedupe set from saved capture data so we never
  // re-fire a toast or re-count something that was already captured in a past session.
  useEffect(() => {
    const saved = resume?.captured_data
    if (!saved?.seenKeys) return
    saved.seenKeys.forEach(key => {
      seenCapturesRef.current.add(key)
    })
  }, [resume?.id])

  // ── CONVERSATIONAL PATH FUNCTIONS ──
  async function startResumeChat() {
    setSending(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch('/api/resume-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({
          conversation: [{ role: 'user', content: "Hi! I'm ready to build my résumé." }],
          displayName: userName
        })
      })
      const data = await response.json()
      if (!data.response) throw new Error('No response from resume chat')
    const initialMessages = [
      { role: 'assistant', content: data.response }
    ]
      setCoachingMessages(initialMessages)
      const { error: saveError } = await supabase
        .from('resumes')
        .update({ coaching_conversation: initialMessages, coaching_tier_at_save: 'pro' })
        .eq('id', params.id)
      if (saveError) {
        console.error('Error saving initial chat message:', saveError)
        setErrorToast("We couldn't save the start of your session. If you refresh, you may lose this message.")
      }
    } catch (err) {
      console.error('Error starting resume chat:', err)
      setCoachingMessages([{ role: 'assistant', content: "Something went wrong starting your session. Please refresh and try again." }])
    } finally {
      setSending(false)
      setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 100)
    }
  }

  async function sendResumeChat() {
    if (!userInput.trim() || sending) return
    const userMessageText = userInput
    const newMessage = { role: 'user', content: userInput }
    const updatedMessages = [...coachingMessages, newMessage]
    setCoachingMessages(updatedMessages)
    setUserInput('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
    setSending(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch('/api/resume-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ conversation: updatedMessages, displayName: userName })
      })
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        console.error('Resume chat API error:', errData)
        throw new Error(errData.error || 'API returned an error')
      }
      const data = await response.json()
      const finalMessages = [...updatedMessages, { role: 'assistant', content: data.response }]
      setCoachingMessages(finalMessages)
      processCaptures(userMessageText, data.response)
      const { error: saveError } = await supabase
        .from('resumes')
        .update({ coaching_conversation: finalMessages, coaching_tier_at_save: 'pro' })
        .eq('id', params.id)
      if (saveError) {
        console.error('Error saving chat message:', saveError)
        setErrorToast("We couldn't save your last message. If you refresh, you may lose recent progress.")
      }
    } catch (err) {
      console.error('Error sending resume chat message:', err)
      setCoachingMessages(prev => [...prev, { role: 'assistant', content: "Something went wrong. Please try sending again." }])
    } finally {
      setSending(false)
      setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 100)
    }
  }

  async function finishResumeChat() {
    setIsFinishing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch('/api/coach-finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({
          resumeData: {},
          conversation: coachingMessages,
          detectedLevel,
          careerContext,
          isConversationalSource: true
        })
      })
      const data = await response.json()
      if (!data.rewrittenResume) throw new Error('Resume build failed')

      const { data: { session: scoreSession } } = await supabase.auth.getSession()
      const scoreResponse = await fetch('/api/analyze-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${scoreSession.access_token}` },
        body: JSON.stringify({ resumeData: data.rewrittenResume })
      })
      const scoreData = await scoreResponse.json()
      const newScore = scoreData?.score ?? null

      setRewrittenResume(data.rewrittenResume)

      if (resetHistory) resetHistory(data.rewrittenResume)

      const { error: saveError } = await supabase.from('resumes').update({
        resume_data: data.rewrittenResume,
        rewritten_resume: data.rewrittenResume,
        journey_step: 'improve',
        coaching_conversation: coachingMessages,
        coaching_complete: true,
        current_score: newScore,
        score_breakdown: scoreData?.analysis?.breakdown || null,
        last_assessed_at: new Date().toISOString(),
        ai_analysis: scoreData?.analysis || null,
        updated_at: new Date().toISOString()
      }).eq('id', params.id)

      if (saveError) {
        console.error('Error saving rewritten résumé:', saveError)
        setErrorToast("We built your résumé but couldn't save it. Please try the build button again.")
        setIsFinishing(false)
        return
      }

      setResume(prev => ({
        ...prev,
        resume_data: data.rewrittenResume,
        journey_step: 'improve',
        current_score: newScore
      }))
      fireO4MarkerIfFirst(supabase)

    } catch (err) {
      console.error('Error finishing resume chat:', err)
      setErrorToast('Something went wrong building your résumé. Please try again.')
    } finally {
      setIsFinishing(false)
    }
  }

const getMessageText = (msg) => {
    if (!msg.content) return ''
    if (typeof msg.content === 'string') return msg.content
    if (Array.isArray(msg.content)) return msg.content.map(b => b.text || '').join(' ')
    return ''
  }

  const isCoachingComplete = coachingMessages.some(msg =>
    msg.role === 'assistant' && (
      getMessageText(msg).toLowerCase().includes('click the button below') ||
      getMessageText(msg).toLowerCase().includes('finish coaching')
    )
  )

  const isProCoachingComplete = isCoachingComplete
  const isTrialCoachingComplete = isCoachingComplete

  // Auto-scroll and re-focus after each exchange
  useEffect(() => {
    if (coachingMessages.length > previousMessageCount.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      if (coachingMessages.some(m => m.role === 'user')) {
        setTimeout(() => {
          inputRef.current?.focus({ preventScroll: true })
        }, 100)
      }
    }
    previousMessageCount.current = coachingMessages.length
  }, [coachingMessages])

  // Check tier + start coaching if no messages yet
  // Conversational init — watches isConversational, fires after resume loads
  useEffect(() => {
    if (!isConversational) return
    const hasMessages = coachingMessages.some(m => m.content && typeof m.content === 'string' && m.content.trim().length > 0)
    if (!hasMessages && !hasStartedCoaching.current) {
      hasStartedCoaching.current = true
      startResumeChat()
    }
  }, [isConversational])

 // Standard coaching init — runs once at mount, skips empty resume data
  useEffect(() => {
    const hasContent = resumeData?.fullName || (resumeData?.experience?.length > 0)
    if (!hasContent) return
    async function init() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError) {
          console.error('Auth error in CoachStep init:', authError)
          setErrorToast("We couldn't verify your account. Please refresh the page.")
          return
        }
        if (!user) return

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('subscription_tier')
          .eq('id', user.id)
          .single()

        if (profileError) {
          console.error('Error loading profile tier in CoachStep:', profileError)
          setErrorToast("We couldn't load your account details. Please refresh the page.")
          return
        }

        const tier = profile?.subscription_tier || 'free'
        setUserTier(tier)

      const hasRealMessages = coachingMessages.some(m => m.content && typeof m.content === 'string' && m.content.trim().length > 0)
      const savedTier = coachingTierAtSave
      const isTrialUpgrade = tier !== 'free' && hasRealMessages && !coachingComplete && savedTier === 'free'

      if (isTrialUpgrade && !hasStartedCoaching.current) {
        // Saved conversation was from a trial session — user has since upgraded. Start fresh Pro session with trial as context.
        hasStartedCoaching.current = true
        const capturedTrialTranscript = [...coachingMessages]
        setCoachingMessages([])
        await startCoaching(tier, capturedTrialTranscript)
      } else if ((coachingMessages.length === 0 || !hasRealMessages) && !hasStartedCoaching.current) {
        hasStartedCoaching.current = true
        await startCoaching(tier)
      }
      // Otherwise: saved conversation exists and tier matches (or is null/pro) — restore as-is, do nothing.
      } catch (err) {
        console.error('Unexpected error in CoachStep init:', err)
        setErrorToast("Something went wrong starting your coaching session. Please refresh the page.")
      }
    }
    init()
  }, [])

 async function startCoaching(tier, trialTranscript = null) {
    if (isConversational) return
    setSending(true)
    try {
     const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch('/api/coach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          resumeData: {
            ...resumeData,
            _analysisResults: analysisResults?.analysis || null,
            _trialTranscript: trialTranscript || ((tier !== 'free' && coachingMessages?.length > 0) ? coachingMessages : null)
          },
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
      track('coaching_started', { tier: tier })
      const initialMessages = [{ role: 'assistant', content: data.response }]
      setCoachingMessages(initialMessages)

      const { error: saveError } = await supabase
        .from('resumes')
        .update({ coaching_conversation: initialMessages, coaching_tier_at_save: tier })
        .eq('id', params.id)

      if (saveError) {
        console.error('Error saving initial coaching message:', saveError)
        setErrorToast("We couldn't save the start of your session. If you refresh, you may lose this message.")
      }
   } catch (err) {
      console.error('Error starting coaching:', err)
      setCoachingMessages([{ role: 'assistant', content: "Something went wrong starting your session. Please refresh the page and try again." }])
    } finally {
      setSending(false)
      setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 100)
    }
  }

  async function sendMessage() {
    if (!userInput.trim() || sending) return

    const userMessageText = userInput
    const newMessage = { role: 'user', content: userInput }
    const updatedMessages = [...coachingMessages, newMessage]
    setCoachingMessages(updatedMessages)
    setUserInput('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
    setSending(true)

    try {
     const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch('/api/coach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          resumeData: {
            ...resumeData,
            _analysisResults: analysisResults?.analysis || null
          },
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
      processCaptures(userMessageText, data.response)

      const { error: saveError } = await supabase
        .from('resumes')
        .update({ coaching_conversation: finalMessages, coaching_tier_at_save: userTier })
        .eq('id', params.id)

      if (saveError) {
        console.error('Error saving coaching message:', saveError)
        setErrorToast("We couldn't save your last message. If you refresh, you may lose recent progress.")
      }
    } catch (err) {
      console.error('Error sending message:', err)
      setCoachingMessages(prev => [...prev, { role: 'assistant', content: "Something went wrong. Please try sending your message again." }])
    } finally {
      setSending(false)
      setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 100)
    }
  }

    async function finishCoaching() {
    setIsFinishing(true)
    try {

      // ── ATTEMPT 1: Run coach-finish ──
      const resumeDataWithAnalysis = {
        ...resumeData,
        _analysisResults: analysisResults?.analysis || null
      }

      const coachFinishPayload = {
        resumeData: resumeDataWithAnalysis,
        conversation: coachingMessages,
        detectedLevel,
        careerContext,
        isJobSpecific: isJobSpecific || false,
        jobDescription: jobDescription || null,
        jobTitle: jobTitle || null,
        jobCompany: jobCompany || null,
        matchedKeywords: analysisResults?.analysis?.matchedKeywords || [],
        missingKeywords: analysisResults?.analysis?.missingKeywords || []
      }

      const { data: { session: finishSession } } = await supabase.auth.getSession()
      const response = await fetch('/api/coach-finish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${finishSession.access_token}`
        },
        body: JSON.stringify(coachFinishPayload)
      })
      const data = await response.json()
      if (!data.rewrittenResume) throw new Error('Rewrite failed')

      // ── SCORE CHECK: Analyze the rewritten resume ──
      const { data: { session: coachSession } } = await supabase.auth.getSession()
      const scoreCheckResponse = await fetch('/api/analyze-resume', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${coachSession.access_token}`
        },
        body: JSON.stringify({ resumeData: data.rewrittenResume })
      })
      const scoreCheckData = await scoreCheckResponse.json()
      const attemptOneScore = scoreCheckData?.score ?? null

      // Store post-coaching analysis for targeted recoach
      let gaps = []

      if (scoreCheckData?.analysis) {
        setPostCoachingAnalysis(scoreCheckData.analysis)

        // Filter gaps to only those the user can answer with new information
        // Exclude writing quality issues — those are coach-finish's job, not the user's
        const writingQualityPatterns = [
  // Verb and language quality — AI's job
  /weak verb/i, /action verb/i, /passive/i, /vague language/i,
  /filler/i, /rephrase/i, /reword/i, /stronger language/i,
  /word choice/i, /clarity/i,
  // Formatting and structure — AI's job
  /grammar/i, /spelling/i, /punctuation/i,
  /sentence structure/i, /break up/i, /split/i, /combine/i,
  /rewrite/i, /restructure/i,
  /concise/i, /streamline/i, /wordy/i, /redundant/i
]

        const isWritingQuality = (text) =>
          writingQualityPatterns.some(pattern => pattern.test(text))

        const gaps = (scoreCheckData.analysis.suggestions || [])
          .filter(gap => !isWritingQuality(gap))
          .slice(0, 5)

        setRemainingGaps(gaps)
      }

      let finalResume = data.rewrittenResume
      let finalChanges = data.changes || []

      // ── RETRY: If score didn't improve, try once more with explicit instruction ──
      if (
        attemptOneScore !== null &&
        scoreBeforeCoaching !== null &&
        attemptOneScore <= scoreBeforeCoaching
      ) {
        console.warn(`Score did not improve (before: ${scoreBeforeCoaching}, after: ${attemptOneScore}). Retrying with stronger instruction.`)

        const retryResponse = await fetch('/api/coach-finish', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${finishSession.access_token}`
          },
          body: JSON.stringify({
            ...coachFinishPayload,
            retryInstruction: `Your first attempt produced a resume that scored ${attemptOneScore}, which did not improve on the original score of ${scoreBeforeCoaching}. This means your rewrite was too conservative or did not fully use the coaching conversation. Try again. Go deeper into the coaching material. Find every specific detail, every scope indicator, every trust signal, every skill mentioned — and make sure it appears in the resume. The standard is: every bullet should pass the Brain Test, and the overall resume must score higher than ${scoreBeforeCoaching}.`
          })
        })
        const retryData = await retryResponse.json()

        if (retryData.rewrittenResume) {
          // Score the retry and use whichever attempt scored higher
          const retryScoreResponse = await fetch('/api/analyze-resume', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${coachSession.access_token}`
            },
            body: JSON.stringify({ resumeData: retryData.rewrittenResume })
          })
          const retryScoreData = await retryScoreResponse.json()
          const retryScore = retryScoreData?.score ?? null

          if (retryScore !== null && retryScore > attemptOneScore) {
            console.log(`Retry improved score: ${attemptOneScore} → ${retryScore}. Using retry result.`)
            finalResume = retryData.rewrittenResume
            finalChanges = retryData.changes || []
          } else {
            console.log(`Retry did not further improve score (${retryScore}). Using attempt 1 result.`)
          }
        }
      }

      // ── SAVE AND APPLY ──
      setRewrittenResume(finalResume)
      setResumeChanges(finalChanges)

      const { error: saveError } = await supabase
        .from('resumes')
        .update({
          journey_step: 'improve',
          coaching_conversation: coachingMessages,
          rewritten_resume: finalResume,
          resume_changes: finalChanges,
          coaching_complete: true,
          remaining_gaps: gaps,
          updated_at: new Date().toISOString()
        })
        .eq('id', params.id)

      if (saveError) {
        console.error('Error saving coached resume:', saveError)
        setErrorToast("We rewrote your resume but couldn't save it. Please try the reveal button again.")
        setIsFinishing(false)
        return
      }

      setResume(prev => ({ ...prev, journey_step: 'improve', resume_data: finalResume }))
      if (isJobSpecific) fireT4IfFirst(supabase)
      fireO4MarkerIfFirst(supabase)

    } catch (err) {
      console.error('Error finishing coaching:', err)
      setErrorToast('Something went wrong generating your resume. Please try again.')
    } finally {
      setIsFinishing(false)
    }
  }

  async function finishTrialCoaching() {
    setIsFinishing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch('/api/trial-coach-finish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          resumeData,
          conversation: coachingMessages,
          detectedLevel,
          careerContext
        })
      })
      const data = await response.json()

      const { error: resumeError } = await supabase
        .from('resumes')
        .update({
          trial_coaching_used: true,
          coaching_conversation: coachingMessages,
          updated_at: new Date().toISOString()
        })
        .eq('id', params.id)

      if (resumeError) {
        console.error('Error marking trial coaching used:', resumeError)
        setErrorToast("We finished your coaching but couldn't save the result. Please try the reveal button again.")
        setIsFinishing(false)
        return
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError) {
        console.error('Auth error in finishTrialCoaching:', authError)
      } else if (user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('coaching_samples_used')
          .eq('id', user.id)
          .single()

        if (profileError) {
          console.error('Error reading profile sample count:', profileError)
          setErrorToast("Your trial finished, but your account didn't update properly. Please refresh the page.")
        } else {
          const newCount = (profile?.coaching_samples_used || 0) + 1
          const { error: profileUpdateError } = await supabase
            .from('profiles')
            .update({ coaching_samples_used: newCount })
            .eq('id', user.id)

          if (profileUpdateError) {
            console.error('Error updating profile sample count:', profileUpdateError)
            setErrorToast("Your trial finished, but your account didn't update properly. Please refresh the page.")
          } else {
            setCoachingSamplesUsed(newCount)
            const now = new Date().toISOString()
            try {
              await supabase.from('profiles').update({ coaching_completed_at: now }).eq('id', user.id)
              await fetch('/api/loops/sync-contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user.email, userId: user.id, coachingCompletedAt: now }) })
            } catch (e) { console.error('T7 trigger update failed (non-blocking):', e) }
          }
        }
      }

      setTrialResult(data)
      setEditedBullet(data.after)
      setTrialComplete(true)
      setShowTrialRevealModal(true)
    } catch (err) {
      console.error('Error finishing trial:', err)
      setErrorToast('Something went wrong. Please try again.')
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

      const { error: saveError } = await supabase
        .from('resumes')
        .update({
          resume_data: updatedResume,
          journey_step: 'improve',
          updated_at: new Date().toISOString()
        })
        .eq('id', params.id)

      if (saveError) {
        console.error('Error applying trial bullet:', saveError)
        setErrorToast("We couldn't apply that change. Please try again.")
        return
      }

      setResume(prev => ({ ...prev, resume_data: updatedResume, journey_step: 'improve' }))
    } catch (err) {
      console.error('Error applying bullet:', err)
      setErrorToast("Something went wrong applying that change. Please try again.")
      await advanceToImprove()
    }
  }

  async function advanceToImprove() {
    const { error: saveError } = await supabase
      .from('resumes')
      .update({ journey_step: 'improve', updated_at: new Date().toISOString() })
      .eq('id', params.id)

    if (saveError) {
      console.error('Error advancing to improve step:', saveError)
      setErrorToast("We couldn't move you to the next step. Please try again.")
      return
    }

    setResume(prev => ({ ...prev, journey_step: 'improve' }))
  }
// ── Coaching locked (Pro/JS, complete) — chat renders normally, just hide input and finish button ──
  const proCoachingLocked = coachingComplete && !trialComplete && userTier !== 'free' && !isConversational

  // ── Already used trial → upsell ──
if (trialCoachingUsed && !trialComplete && userTier === 'free') {
      return (
      <div className="space-y-2">
        <h3 className="font-semibold text-lg -mt-3">💬 Resume Coach</h3>
        <div className="bg-purple-50 rounded-lg p-2">
          <p className="text-sm md:text-xs font-semibold text-gray-900 mb-1">You've used your free coaching session</p>
          <p className="text-sm md:text-xs text-gray-600 mb-3">
            Upgrade to Pro to coach every job, every bullet, and uncover skills you didn't know belonged on a resume.
          </p>
          <div className="bg-white rounded-lg p-3 mb-3 border border-purple-100">
            <p className="text-sm md:text-xs font-semibold text-purple-700 mb-2">Pro coaching includes:</p>
            <ul className="text-sm md:text-xs text-gray-600 space-y-1.5">
              <li>✓ Full conversation across all jobs</li>
              <li>✓ Every bullet improved automatically</li>
              <li>✓ Hidden skill identification</li>
              <li>✓ Achievement quantification</li>
              <li>✓ Before/after review for every change</li>
            </ul>
          </div>
          <p className="text-sm md:text-xs text-purple-700 font-medium mb-3 text-center">
            Pro users see an average <strong>16-point improvement</strong> after coaching.
          </p>
          <div className="flex justify-center mb-2">
            <button
              onClick={() => setShowUpgradeModal(true)}
              className="text-white rounded-lg px-4 py-2 text-sm md:text-xs font-semibold transition-opacity hover:opacity-90"
              style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
            >
              Upgrade to Pro →
            </button>
          </div>
          <div className="flex justify-center">
            <button
              onClick={advanceToImprove}
              className="text-gray-400 text-sm md:text-xs hover:text-gray-600"
            >
              Continue improving myself →
            </button>
          </div>
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

 // ── Conversational UI ──
  if (isConversational) {
    const isChatComplete = coachingMessages.some(msg =>
      msg.role === 'assistant' && getMessageText(msg).toLowerCase().includes('click the button below')
    )
    return (
      <>
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div className="flex-1 overflow-y-auto space-y-2 mb-2 pr-1 min-h-0">
            {coachingMessages.map((msg, index) => (
              <div key={index} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} mb-1.5`}>
                <div className={`rounded-lg px-2 py-1.5 text-sm md:text-xs leading-snug ${msg.role === 'assistant' ? 'bg-purple-50 border border-purple-100 w-full' : 'bg-gray-100 border border-gray-200 max-w-[90%]'}`}>
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-sm">🎓</span>
                      <span className="text-xs md:text-[10px] font-semibold text-gray-500">Resume Coach</span>
                    </div>
                  )}
                  {msg.role === 'user' && (
                    <div className="flex items-center gap-1 mb-1">
                      <div className="w-4 h-4 rounded-full bg-purple-200 flex items-center justify-center text-purple-700 text-[8px] font-bold">
                        {userName?.charAt(0).toUpperCase() || 'Y'}
                      </div>
                      <span className="text-xs md:text-[10px] font-semibold text-gray-500">{userName?.split(' ')[0] || 'You'}</span>
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
                  <div className="flex gap-1 items-center">
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              </div>
            )}
           <div ref={messagesEndRef} />
          </div>
         {coachingComplete ? null : !isChatComplete ? (
           <div className="border-t pt-2 pb-4 md:pb-1 flex-shrink-0 px-1 md:px-3 md:-mx-3" style={{ backgroundColor: 'white' }}>
              <div className="flex gap-2 items-end">
                <textarea
                  ref={inputRef}
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onInput={(e) => {
                  if (window.innerWidth < 768) return
                  e.target.style.height = 'auto'
                  const maxHeight = window.innerHeight - 310
                  const target = Math.min(e.target.scrollHeight, maxHeight)
                  e.target.style.height = target + 'px'
                  e.target.style.overflowY = e.target.scrollHeight > target ? 'auto' : 'hidden'
                  e.target.scrollIntoView({ block: 'end', behavior: 'instant' })
                }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendResumeChat() } }}
                  placeholder="Type your response..."
                  disabled={sending}
                  autoComplete="off"
                  rows={2}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-base md:text-xs focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  style={
                    typeof window !== 'undefined' && window.innerWidth < 768
                      ? { height: '4.5rem', overflowY: 'auto' }
                      : { overflowY: 'hidden', maxHeight: 'calc(100vh - 310px)' }
                  }
                />
                <button
                  onClick={sendResumeChat}
                  disabled={!userInput.trim() || sending}
                  className="flex-shrink-0 flex items-center justify-center rounded-lg transition-colors disabled:opacity-30"
                  style={{
                    width: '32px',
                    height: '56px',
                    background: userInput.trim() && !sending ? 'linear-gradient(to right, #667eea, #764ba2)' : '#d1d5db'
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-4 h-4">
                    <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                  </svg>
                </button>
              </div>
            </div>
          ) : (
            <div className="border-t pt-2 pb-3 flex-shrink-0 md:-mx-3 md:px-3 flex justify-center" style={{ backgroundColor: 'white' }}>
              <button
                onClick={finishResumeChat}
                disabled={isFinishing}
                className="px-6 py-2 rounded-lg text-sm md:text-xs font-semibold flex items-center justify-center gap-2 transition-opacity hover:opacity-90 text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(to right, #667eea, #764ba2)', minWidth: '180px' }}
              >
                {isFinishing && <div className="h-3 w-3 animate-spin rounded-full border-2 border-solid border-current border-r-transparent flex-shrink-0"></div>}
                {isFinishing ? 'Building your résumé...' : '✨ Build My Resume →'}
              </button>
            </div>
          )}

        <p className="text-center text-[11px] text-gray-400 py-1 flex-shrink-0">Your coaching progress is saved automatically.</p>
        </div>
        <ErrorToast message={errorToast} onClose={() => setErrorToast(null)} />
      </>
    )
  }

  // ── Main chat UI (free trial or pro) ──
  return (
    <>
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        <h3 className="font-semibold text-lg mb-1 flex-shrink-0">
          💬 {userTier === 'free' ? 'Free Coaching Trial' : 'Coaching in Progress'}
        </h3>

        {userTier === 'free' && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-2 flex-shrink-0">
            <p className="text-sm md:text-xs text-gray-600">
              <strong>Free trial:</strong> Try Resume Coach on one role and see how a single rewritten bullet can transform how your experience reads.
            </p>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-2 mb-2 pr-1 min-h-0">
          {coachingMessages.map((msg, index) => (
            <div key={index} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} mb-1.5`}>
              <div className={`rounded-lg px-2 py-1.5 text-sm md:text-xs leading-snug ${
                msg.role === 'assistant'
                  ? 'bg-purple-50 border border-purple-100 w-full'
                  : 'bg-gray-100 border border-gray-200 max-w-[90%]'
              }`}>
                {msg.role === 'assistant' ? (
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-sm">🎓</span>
                    <span className="text-xs md:text-[10px] font-semibold text-gray-500">Resume Coach</span>
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
                    <span className="text-xs md:text-[10px] font-semibold text-gray-500">{userName?.split(' ')[0] || 'You'}</span>
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
                <p className="text-xs md:text-[10px] font-semibold text-gray-400 mb-0.5">Coach</p>
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
        {!isProCoachingComplete && !isTrialCoachingComplete && !proCoachingLocked && (
          <div className="border-t pt-2 pb-4 md:pb-1 flex-shrink-0 px-1 md:px-3 md:-mx-3" style={{ backgroundColor: 'white' }}>
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
               onInput={(e) => {
                  if (window.innerWidth < 768) return
                  e.target.style.height = 'auto'
                  const maxHeight = window.innerHeight - 310
                  const target = Math.min(e.target.scrollHeight, maxHeight)
                  e.target.style.height = target + 'px'
                  e.target.style.overflowY = e.target.scrollHeight > target ? 'auto' : 'hidden'
                  e.target.scrollIntoView({ block: 'end', behavior: 'instant' })
                }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                placeholder="Type your response..."
                disabled={sending}
                autoComplete="off"
                rows={2}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-base md:text-xs focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                style={
                  typeof window !== 'undefined' && window.innerWidth < 768
                    ? { height: '4.5rem', overflowY: 'auto' }
                    : { overflowY: 'hidden', maxHeight: 'calc(100vh - 310px)' }
                }
              />
              <button
                onClick={sendMessage}
                disabled={!userInput.trim() || sending}
                className="flex-shrink-0 flex items-center justify-center rounded-lg transition-colors disabled:opacity-30"
                style={{
                  width: '32px',
                  height: '56px',
                  background: userInput.trim() && !sending ? 'linear-gradient(to right, #667eea, #764ba2)' : '#d1d5db'
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-4 h-4">
                  <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Pro finish button */}
        {isProCoachingComplete && userTier !== 'free' && !proCoachingLocked && !coachingComplete && (
          <div className="border-t pt-2 pb-3 flex-shrink-0 md:-mx-3 md:px-3 flex justify-center" style={{ backgroundColor: 'white' }}>
           <button
              onClick={finishCoaching}
              disabled={isFinishing}
              className={`px-6 py-2 rounded-lg text-sm md:text-xs font-semibold flex items-center gap-2 transition-opacity hover:opacity-90 text-white ${
                isFinishing ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              style={{ background: isFinishing ? '#9ca3af' : 'linear-gradient(to right, #667eea, #764ba2)' }}
            >
              {isFinishing && <div className="h-3 w-3 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>}
              {isFinishing ? 'Building your resume...' : '✨ Reveal My New Resume →'}
            </button>
          </div>
        )}

        {/* Trial finish button */}
       {isTrialCoachingComplete && userTier === 'free' && !trialComplete && (
          <div className="border-t pt-2 pb-3 flex-shrink-0 md:-mx-3 md:px-3 flex justify-center" style={{ backgroundColor: 'white' }}>
            <button
              onClick={finishTrialCoaching}
              disabled={isFinishing}
              className="px-6 py-2 rounded-lg text-sm md:text-xs font-semibold flex items-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-white"
              style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
            >
              {isFinishing && <div className="h-3 w-3 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>}
              {isFinishing ? 'Analyzing your session...' : '⚡ Reveal My Coached Bullet →'}
            </button>
          </div>
        )}

        <p className="text-center text-[11px] text-gray-400 py-1 flex-shrink-0">Your coaching progress is saved automatically.</p>
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
              style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)', borderRadius: '8px 8px 0 0' }}
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
                    className="text-white rounded-lg px-6 py-2 text-xs font-semibold transition-opacity hover:opacity-90"
                    style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
                  >
                    Upgrade to Pro → Coach My Entire Resume
                  </button>
                  <p className="text-xs text-gray-400">
                    We found this in <strong>5 minutes</strong> from one job. Imagine what's in the rest. Go Pro, and we'll rewrite it all for you!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
   
   <ErrorToast message={errorToast} onClose={() => setErrorToast(null)} />

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
function ImproveStep({ rewrittenResume, resumeChanges, setRewrittenResume, setResumeChanges, originalResumeData, resumeData, supabase, params, setResume, score, handleReassess, isAnalyzing, showRevealModal, setShowRevealModal, scoreBeforeCoaching, setScoreBeforeCoaching, scoreAfterCoaching, userTier, analysisResults, coachingSamplesUsed, remainingGaps, setRemainingGaps, userName, userProfile, detectedLevel, recoachAttempts, setRecoachAttempts, setShowUpgradeModal, changesAccepted, coachingMessages, careerContext, isConversational, setReviseModalState, bulletSelectMode, setBulletSelectMode, setViewingStep }) {
  const [showConvTargetedRecoach, setShowConvTargetedRecoach] = useState(false)
  const [convTargetedMessages, setConvTargetedMessages] = useState([])
  const [accepting, setAccepting] = useState(false)
  const [reviewMode, setReviewMode] = useState(false)
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [errorToast, setErrorToast] = useState(null)
  const [currentChangeIndex, setCurrentChangeIndex] = useState(0)
  const [acceptedChanges, setAcceptedChanges] = useState([])
  const [rejectedChanges, setRejectedChanges] = useState([])
  const [showBeforeAfter, setShowBeforeAfter] = useState(false)
  const [showChangeModal, setShowChangeModal] = useState(false)
  const [editingChange, setEditingChange] = useState(false)
  const [editedText, setEditedText] = useState('')
  const [decisionStack, setDecisionStack] = useState([])
  const [loading, setLoading] = useState(false)
  const [isPreparingReveal, setIsPreparingReveal] = useState(false)
  const [showGapsModal, setShowGapsModal] = useState(false)
  const [showTargetedRecoach, setShowTargetedRecoach] = useState(false)
  const [targetedMessages, setTargetedMessages] = useState([])
  const [isTargetedFinishing, setIsTargetedFinishing] = useState(false)

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
        .then(({ data, error }) => {
          if (error) {
            console.error('Error reloading rewritten resume:', error)
            setErrorToast("We couldn't reload your coached resume. Please refresh the page.")
            return
          }
          if (data?.rewritten_resume) {
            setRewrittenResume(data.rewritten_resume)
            setResumeChanges(data.resume_changes || [])
          }
        })
        .catch(err => {
          console.error('Unexpected error reloading rewritten resume:', err)
          setErrorToast("Something went wrong reloading your coached resume. Please refresh the page.")
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

 // ── CONVERSATIONAL IMPROVE PATH ──
  if (isConversational) {
    if (changesAccepted) {
      return (
        <div className="space-y-3">
          <div className="rounded-lg overflow-hidden border border-purple-200 shadow-sm">
            <div className="px-4 py-3 flex items-center gap-3" style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)' }}>
              <img src="/images/Hire_Power_icon.png" alt="Hire Power" className="h-6 w-auto flex-shrink-0" />
              <div>
                <p className="font-bold text-white text-base md:text-sm">Looking good!</p>
                <p className="text-purple-100 text-sm md:text-xs">Your résumé is ready to format and download.</p>
              </div>
            </div>
            {score && (
              <div className="bg-white px-4 py-3 text-center">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Resume Power Score</div>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-5xl font-bold" style={{ color: score >= 85 ? '#9333ea' : score >= 75 ? '#81c784' : score >= 60 ? '#ffc870' : '#e57373' }}>{score}</span>
                  <span className="text-xl text-gray-400">/100</span>
                </div>
                <button
                  onClick={() => setShowBreakdown(!showBreakdown)}
                  className="text-xs text-purple-600 hover:text-purple-700 font-medium mt-1 inline-flex items-center gap-1"
                >
                  {showBreakdown ? 'Hide score breakdown' : 'View score breakdown'}
                  <span className="text-[10px]">{showBreakdown ? '▲' : '▼'}</span>
                </button>
                {showBreakdown && (
                  <div className="mt-3 pt-3 border-t border-gray-100 text-left">
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between items-baseline mb-0.5">
                          <span className="font-semibold text-gray-900 text-sm">Impact</span>
                          <span className="text-gray-700 font-medium text-sm">{analysisResults?.analysis?.breakdown?.impact || 0}/50</span>
                        </div>
                        <div className="text-sm md:text-[11px] text-gray-500 leading-tight mb-1.5">
                          {detectedLevel === 'entry' && 'Specificity, scope, and scale'}
                          {detectedLevel === 'mid' && 'Specificity, scope, scale & results'}
                          {detectedLevel === 'senior' && 'Specificity, scope, scale & organizational impact'}
                          {!detectedLevel && 'Specificity, scope, and scale'}
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full"
                            style={{
                              width: `${((analysisResults?.analysis?.breakdown?.impact || 0)/50)*100}%`,
                              background: (analysisResults?.analysis?.breakdown?.impact || 0)/50 >= 0.85 ? '#9333ea' :
                                      (analysisResults?.analysis?.breakdown?.impact || 0)/50 >= 0.75 ? '#81c784' :
                                      (analysisResults?.analysis?.breakdown?.impact || 0)/50 >= 0.60 ? '#ffc870' :
                                      '#e57373'
                            }}
                          ></div>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between items-baseline mb-0.5">
                          <span className="font-semibold text-gray-900 text-sm">Clarity</span>
                          <span className="text-gray-700 font-medium text-sm">{analysisResults?.analysis?.breakdown?.clarity || 0}/30</span>
                        </div>
                        <div className="text-sm md:text-[11px] text-gray-500 leading-tight mb-1.5">Active voice, strong verbs, concise language</div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full"
                            style={{
                              width: `${((analysisResults?.analysis?.breakdown?.clarity || 0)/30)*100}%`,
                              background: (analysisResults?.analysis?.breakdown?.clarity || 0)/30 >= 0.85 ? '#9333ea' :
                                      (analysisResults?.analysis?.breakdown?.clarity || 0)/30 >= 0.75 ? '#81c784' :
                                      (analysisResults?.analysis?.breakdown?.clarity || 0)/30 >= 0.60 ? '#ffc870' :
                                      '#e57373'
                            }}
                          ></div>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between items-baseline mb-0.5">
                          <span className="font-semibold text-gray-900 text-sm">Keywords</span>
                          <span className="text-gray-700 font-medium text-sm">{analysisResults?.analysis?.breakdown?.keywords || 0}/20</span>
                        </div>
                        <div className="text-sm md:text-[11px] text-gray-500 leading-tight mb-1.5">
                          {detectedLevel === 'senior' ? 'Field vocabulary, tools, methodologies, and systems' : 'Field vocabulary, tools, and software names'}
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full"
                            style={{
                              width: `${((analysisResults?.analysis?.breakdown?.keywords || 0)/20)*100}%`,
                              background: (analysisResults?.analysis?.breakdown?.keywords || 0)/20 >= 0.85 ? '#9333ea' :
                                      (analysisResults?.analysis?.breakdown?.keywords || 0)/20 >= 0.75 ? '#81c784' :
                                      (analysisResults?.analysis?.breakdown?.keywords || 0)/20 >= 0.60 ? '#ffc870' :
                                      '#e57373'
                            }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex justify-center gap-2 pt-1 flex-wrap">
            <button
              onClick={() => setReviseModalState({ mode: 'add' })}
              className="bg-white text-purple-600 border border-purple-300 rounded-lg px-4 py-2 text-sm md:text-xs font-semibold hover:bg-purple-50 transition-colors whitespace-nowrap"
            >
              ⚡ More to add?
            </button>
            <button
              onClick={async () => {
                const { error: saveError } = await supabase
                  .from('resumes')
                  .update({ journey_step: 'format', updated_at: new Date().toISOString() })
                  .eq('id', params.id)
                if (saveError) {
                  console.error('Error advancing to format step:', saveError)
                  setErrorToast("We couldn't move you to the format step. Please try again.")
                  return
                }
                setResume(prev => ({ ...prev, journey_step: 'format' }))
              }}
              className="text-white rounded-lg px-4 py-2 text-sm md:text-xs font-semibold transition-opacity hover:opacity-90 whitespace-nowrap"
              style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
            >
              Format & Finish →
            </button>
          </div>
        </div>
      )
    }

    return (
      <>
        <div className="space-y-4">
          <div className="rounded-lg overflow-hidden border border-purple-200 shadow-sm">
            <div className="px-4 py-2 flex items-center gap-2" style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)' }}>
              <img src="/images/Hire_Power_icon.png" alt="Hire Power" className="h-6 w-auto flex-shrink-0" />
              <div>
                <p className="font-bold text-white text-sm">Your Résumé is Ready!</p>
                
              </div>
            </div>
            {score && (
              <div className="bg-white px-4 py-3 text-center">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Resume Power Score</div>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-5xl font-bold" style={{ color: score >= 85 ? '#9333ea' : score >= 75 ? '#81c784' : score >= 60 ? '#ffc870' : '#e57373' }}>{score}</span>
                  <span className="text-xl text-gray-400">/100</span>
                </div>
                <button
                  onClick={() => setShowBreakdown(!showBreakdown)}
                  className="text-xs text-purple-600 hover:text-purple-700 font-medium mt-1 inline-flex items-center gap-1"
                >
                  {showBreakdown ? 'Hide score breakdown' : 'View score breakdown'}
                  <span className="text-[10px]">{showBreakdown ? '▲' : '▼'}</span>
                </button>
                {showBreakdown && (
                  <div className="mt-3 pt-3 border-t border-gray-100 text-left">
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between items-baseline mb-0.5">
                          <span className="font-semibold text-gray-900 text-sm">Impact</span>
                          <span className="text-gray-700 font-medium text-sm">{analysisResults?.analysis?.breakdown?.impact || 0}/50</span>
                        </div>
                        <div className="text-sm md:text-[11px] text-gray-500 leading-tight mb-1.5">
                          {detectedLevel === 'entry' && 'Specificity, scope, and scale'}
                          {detectedLevel === 'mid' && 'Specificity, scope, scale & results'}
                          {detectedLevel === 'senior' && 'Specificity, scope, scale & organizational impact'}
                          {!detectedLevel && 'Specificity, scope, and scale'}
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full"
                            style={{
                              width: `${((analysisResults?.analysis?.breakdown?.impact || 0)/50)*100}%`,
                              background: (analysisResults?.analysis?.breakdown?.impact || 0)/50 >= 0.85 ? '#9333ea' :
                                      (analysisResults?.analysis?.breakdown?.impact || 0)/50 >= 0.75 ? '#81c784' :
                                      (analysisResults?.analysis?.breakdown?.impact || 0)/50 >= 0.60 ? '#ffc870' :
                                      '#e57373'
                            }}
                          ></div>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between items-baseline mb-0.5">
                          <span className="font-semibold text-gray-900 text-sm">Clarity</span>
                          <span className="text-gray-700 font-medium text-sm">{analysisResults?.analysis?.breakdown?.clarity || 0}/30</span>
                        </div>
                        <div className="text-sm md:text-[11px] text-gray-500 leading-tight mb-1.5">Active voice, strong verbs, concise language</div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full"
                            style={{
                              width: `${((analysisResults?.analysis?.breakdown?.clarity || 0)/30)*100}%`,
                              background: (analysisResults?.analysis?.breakdown?.clarity || 0)/30 >= 0.85 ? '#9333ea' :
                                      (analysisResults?.analysis?.breakdown?.clarity || 0)/30 >= 0.75 ? '#81c784' :
                                      (analysisResults?.analysis?.breakdown?.clarity || 0)/30 >= 0.60 ? '#ffc870' :
                                      '#e57373'
                            }}
                          ></div>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between items-baseline mb-0.5">
                          <span className="font-semibold text-gray-900 text-sm">Keywords</span>
                          <span className="text-gray-700 font-medium text-sm">{analysisResults?.analysis?.breakdown?.keywords || 0}/20</span>
                        </div>
                        <div className="text-sm md:text-[11px] text-gray-500 leading-tight mb-1.5">
                          {detectedLevel === 'senior' ? 'Field vocabulary, tools, methodologies, and systems' : 'Field vocabulary, tools, and software names'}
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full"
                            style={{
                              width: `${((analysisResults?.analysis?.breakdown?.keywords || 0)/20)*100}%`,
                              background: (analysisResults?.analysis?.breakdown?.keywords || 0)/20 >= 0.85 ? '#9333ea' :
                                      (analysisResults?.analysis?.breakdown?.keywords || 0)/20 >= 0.75 ? '#81c784' :
                                      (analysisResults?.analysis?.breakdown?.keywords || 0)/20 >= 0.60 ? '#ffc870' :
                                      '#e57373'
                            }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <p className="text-sm md:text-xs text-gray-700 text-center leading-snug">
            Take a look at your résumé. Make sure Coach got everything right — dates, job titles, details. If anything looks off, use Fix It below.
          </p>
          <div className="flex flex-col gap-2 items-center">
            <button
              onClick={() => setShowConvTargetedRecoach(true)}
              className="bg-white text-purple-600 border border-purple-300 rounded-lg px-6 py-2 text-sm md:text-xs font-semibold hover:bg-purple-50 transition-colors"
            >
              Something's Off → Fix It
            </button>
            <button
              onClick={async () => {
                const { error: saveError } = await supabase
                  .from('resumes')
                  .update({ changes_accepted: true, journey_step: 'format', updated_at: new Date().toISOString() })
                  .eq('id', params.id)
                if (saveError) {
                  console.error('Error accepting conversational changes:', saveError)
                  setErrorToast("We couldn't save your changes. Please try again.")
                  return
                }
                setResume(prev => ({ ...prev, changes_accepted: true, journey_step: 'format' }))
                if (setViewingStep) setViewingStep(null)
              }}
              className="text-white rounded-lg px-4 py-2 text-sm md:text-xs font-semibold transition-opacity hover:opacity-90 whitespace-nowrap"
              style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
            >
              Looks Good → Format & Finish
            </button>
          </div>
        </div>
        {showConvTargetedRecoach && (
          <TargetedRecoachStep
            resumeData={resumeData}
            rewrittenResume={rewrittenResume}
            remainingGaps={[]}
            detectedLevel={detectedLevel}
            userName={userName}
            userProfile={userProfile}
            supabase={supabase}
            params={params}
            setResume={setResume}
            setRewrittenResume={setRewrittenResume}
            setResumeChanges={setResumeChanges}
            targetedMessages={convTargetedMessages}
            setTargetedMessages={setConvTargetedMessages}
            handleReassess={handleReassess}
            setShowRevealModal={() => {}}
            setRecoachAttempts={setRecoachAttempts}
            score={score}
            originalCoachingMessages={coachingMessages || []}
            careerContext={careerContext}
            isConversationalFix={true}
            onClose={async () => {
              setShowConvTargetedRecoach(false)
              const { error: saveError } = await supabase
                .from('resumes')
                .update({ changes_accepted: true, updated_at: new Date().toISOString() })
                .eq('id', params.id)
              if (saveError) {
                console.error('Error marking conversational changes accepted on close:', saveError)
                setErrorToast("We couldn't save your changes. Please refresh the page.")
                return
              }
              setResume(prev => ({ ...prev, changes_accepted: true }))
            }}
          />
        )}
      </>
    )
  }

  // RETURNING VISITOR VIEW — changes already accepted, don't show accept/review UI again
 if (changesAccepted && userTier !== 'free' && !showRevealModal && !showGapsModal && !showTargetedRecoach && !accepting) {
    const showPushHarder = score < 80 && remainingGaps?.length > 0 && recoachAttempts < 1

    return (
      <div className="space-y-3">
     
        {/* Unified score card */}
        {scoreBeforeCoaching && score && (
          <div className="rounded-lg overflow-hidden border border-purple-200 shadow-sm">

            {/* Purple header */}
            <div
              className="px-4 py-3 flex items-center gap-3"
            style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)' }}
          >
            <img src="/images/Hire_Power_icon.png" alt="Hire Power" className="h-6 w-auto flex-shrink-0" />
            <div>
              <p className="font-bold text-white text-base md:text-sm leading-tight">Improvements Applied!</p>
                <p className="text-purple-100 text-sm md:text-xs leading-tight">
                  Here's what your reviewed changes did for your resume.
                </p>
              </div>
            </div>

            {/* Scores */}
           <div className="bg-white flex items-center justify-center gap-6 pt-6 pb-3 px-2">
              <div className="text-center">
                <p className="text-xs md:text-[10px] text-gray-400 uppercase tracking-wide mb-3">Before</p>
                <p className="text-6xl font-bold" style={{ color: scoreBeforeCoaching >= 85 ? '#9333ea' : scoreBeforeCoaching >= 75 ? '#81c784' : scoreBeforeCoaching >= 60 ? '#ffc870' : '#e57373' }}>{scoreBeforeCoaching}</p>
              </div>
              <div className="flex items-center justify-center mt-5">
                  <span style={{ fontSize: '2rem', color: '#9ca3af', fontWeight: 500, lineHeight: 1 }}>➜</span>
                </div>
              <div className="text-center">
                <p className="text-xs md:text-[10px] text-gray-400 uppercase tracking-wide mb-3">After</p>
                <p className="text-6xl font-bold" style={{ color: score >= 85 ? '#9333ea' : score >= 75 ? '#81c784' : score >= 60 ? '#ffc870' : '#e57373' }}>{score}</p>
              </div>
            </div>

            {score > scoreBeforeCoaching ? (
              <div className="bg-purple-50 border-t border-purple-100 py-2 text-center">
                <p className="text-sm md:text-xs font-semibold text-purple-600">
                  +{score - scoreBeforeCoaching} points from coaching
                </p>
              </div>
            ) : (
                <div className="bg-gray-50 border-t border-gray-100 py-2 text-center">
                  <p className="text-sm md:text-xs text-gray-500">
                    Your resume was already well-optimized.
                  </p>
                </div>
              )}
          </div>
        )}

        {/* Buttons */}
        {showPushHarder && (
          <div className="flex justify-center pt-1">
            <button
              onClick={() => setShowGapsModal(true)}
              className="bg-white text-purple-600 border border-purple-300 rounded-lg px-4 py-2 text-sm md:text-xs font-semibold hover:bg-purple-50 transition-colors whitespace-nowrap"
            >
              Push for a higher score →
            </button>
          </div>
        )}
        <div className="flex justify-center gap-2 pt-1 flex-wrap">
          <button
            onClick={() => setReviseModalState({ mode: 'add' })}
            className="bg-white text-purple-600 border border-purple-300 rounded-lg px-4 py-2 text-sm md:text-xs font-semibold hover:bg-purple-50 transition-colors whitespace-nowrap"
          >
            ⚡ More to add?
          </button>
          <button
            onClick={async () => {
              const { error: saveError } = await supabase
                .from('resumes')
                .update({ journey_step: 'format', updated_at: new Date().toISOString() })
                .eq('id', params.id)
              if (saveError) {
                console.error('Error advancing to format step:', saveError)
                setErrorToast("We couldn't move you to the format step. Please try again.")
                return
              }
              setResume(prev => ({ ...prev, journey_step: 'format' }))
              if (setViewingStep) setViewingStep(null)
            }}
            className="text-white rounded-lg px-4 py-2 text-sm md:text-xs font-semibold transition-opacity hover:opacity-90 whitespace-nowrap"
            style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
          >
            Format & Finish →
          </button>
        </div>
      </div>
    )
  }

  // FREE USER VIEW — must come before rewrittenResume check (free users never have one)
  if (userTier === 'free') {
    const suggestions = analysisResults?.analysis?.suggestions || []
    const allSuggestions = suggestions

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
          setShowUpgradeModal={setShowUpgradeModal}
        />

        {/* Score Reveal Modal — free users */}
        {showRevealModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ backgroundColor: 'rgba(15, 10, 30, 0.75)' }}
          >
            <div className="relative flex items-center md:w-[740px] md:h-[560px] w-full px-4">

              {/* Resume Thumbnail — left panel, desktop only */}
              <div
                className="absolute left-0 bg-white shadow-2xl overflow-hidden hidden md:block"
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

              {/* Score Card — full width on mobile, overlapping on desktop */}
              <div
                className="bg-white shadow-2xl flex flex-col w-full md:absolute md:w-[380px]"
                style={{ borderRadius: '8px', border: '1px solid #e5e7eb', zIndex: 10 }}
              >
                <div
                  style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)', borderRadius: '8px 8px 0 0' }}
                  className="md:[border-radius:0] px-6 py-5 text-center"
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
                          <p className="text-5xl font-bold" style={{ color: scoreBeforeCoaching >= 85 ? '#9333ea' : scoreBeforeCoaching >= 75 ? '#81c784' : scoreBeforeCoaching >= 60 ? '#ffc870' : '#e57373' }}>{scoreBeforeCoaching}</p>
                        </div>
                        <div className="text-2xl" style={{ color: '#9ca3af' }}>→</div>
                        <div className="text-center">
                          <p className="text-xs text-gray-500 mb-1">After</p>
                          <p className="text-5xl font-bold" style={{ color: scoreAfterCoaching >= 85 ? '#9333ea' : scoreAfterCoaching >= 75 ? '#81c784' : scoreAfterCoaching >= 60 ? '#ffc870' : '#e57373' }}>{scoreAfterCoaching}</p>
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

                 <p className="text-sm text-gray-700 mb-3">Your resume is ready to download.</p>

                  <div className="flex justify-center mb-3">
                    <button
                      onClick={async () => {
                        setShowRevealModal(false)
                        await supabase
                          .from('resumes')
                          .update({ journey_step: 'format', updated_at: new Date().toISOString() })
                          .eq('id', params.id)
                        setResume(prev => ({ ...prev, journey_step: 'format' }))
                      }}
                      className="text-white rounded-lg py-2 px-8 font-semibold text-xs transition-opacity hover:opacity-90"
                      style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
                    >
                      Format My Resume →
                    </button>
                  </div>

                  <div className="bg-purple-50 border border-purple-100 rounded-lg p-3 mb-3 text-left">
<p className="text-sm text-gray-700 leading-relaxed mb-2 text-center">Want your entire resume coached and rewritten? Upgrade to Pro and we'll do it for you.</p>                    <div className="flex justify-center">
                      <button
                        onClick={() => {
                          setShowRevealModal(false)
                          setShowUpgradeModal(true)
                        }}
                        className="bg-white text-purple-600 border border-purple-300 rounded-lg py-2 px-4 font-semibold text-xs hover:bg-purple-50 transition-colors"
                      >
                        Let Us Rewrite It
                      </button>
                    </div>
                  </div>
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
      const { error: saveError } = await supabase
        .from('resumes')
        .update({ resume_data: rewrittenResume, changes_accepted: true, updated_at: new Date().toISOString() })
        .eq('id', params.id)

      if (saveError) {
        console.error('Error saving accepted changes:', saveError)
        setErrorToast("We couldn't save your accepted changes. Please try again.")
        setAccepting(false)
        return
      }

      setResume(prev => ({ ...prev, resume_data: rewrittenResume, changes_accepted: true }))
      await handleReassess(rewrittenResume)
      setShowRevealModal(true)
    } catch (err) {
      console.error('Error accepting changes:', err)
      setErrorToast("Something went wrong applying your changes. Please try again.")
    } finally {
      setAccepting(false)
    }
  }

  async function finishReview(explicitAccepted = null) {
    setAccepting(true)
    setIsPreparingReveal(true)
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

      const { error: saveError } = await supabase
        .from('resumes')
        .update({ resume_data: finalData, changes_accepted: true, updated_at: new Date().toISOString() })
        .eq('id', params.id)

      if (saveError) {
        console.error('Error saving reviewed changes:', saveError)
        setErrorToast("We couldn't save your reviewed changes. Please try again.")
        setAccepting(false)
        setIsPreparingReveal(false)
        return
      }

      setResume(prev => ({ ...prev, resume_data: finalData, changes_accepted: true }))
      await handleReassess(finalData)
      setReviewMode(false)
      setShowRevealModal(true)
    } catch (err) {
      console.error('Error finishing review:', err)
      setErrorToast("Something went wrong applying your reviewed changes. Please try again.")
    } finally {
      setAccepting(false)
      setIsPreparingReveal(false)
    }
  }

  function applyChange(data, change) {
    if (change.field === 'summary') {
      data.summary = change.after
      return
    }
    if (change.field === 'sectionOrder') {
      let parsed
      if (Array.isArray(change.after)) {
        parsed = change.after
      } else {
        try {
          parsed = JSON.parse(change.after)
        } catch {
          parsed = change.after.split(',').map(s => s.trim()).filter(Boolean)
        }
      }
      data.sectionOrder = parsed.map(s => String(s).replace(/[\[\]]/g, ''))
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
        <p className="text-sm md:text-xs text-gray-500">Review each change below. Keep what you love, skip what you don't.</p>

        {/* Progress */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-gray-200 rounded-full">
            <div
              className="h-full bg-purple-600 rounded-full transition-all"
              style={{ width: `${(reviewedCount / totalChanges) * 100}%` }}
            />
          </div>
          <span className="text-sm md:text-xs text-gray-500 whitespace-nowrap">{reviewedCount}/{totalChanges}</span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowChangeModal(true)}
            className="flex-1 bg-purple-600 text-white rounded-lg py-1.5 font-medium text-sm md:text-xs hover:bg-purple-700 transition-colors"
          >
            Review Changes ({Math.min(currentChangeIndex + 1, totalChanges)}/{totalChanges})
          </button>
          <button
            onClick={() => {
              const remaining = resumeChanges.slice(currentChangeIndex)
              const newAccepted = [...acceptedChanges, ...remaining]
              setAcceptedChanges(newAccepted)
              setCurrentChangeIndex(totalChanges)
              setShowChangeModal(false)
              finishReview(newAccepted)
            }}
            disabled={accepting}
            className="flex-1 bg-white text-gray-600 border border-gray-300 rounded-lg py-1.5 text-sm md:text-xs hover:bg-gray-50 transition-colors disabled:opacity-75"
          >
            {accepting ? 'Saving...' : 'Accept All'}
          </button>
        </div>

        {/* Preparing Reveal Modal — shown between last change and reveal modal */}
        {isPreparingReveal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ backgroundColor: 'rgba(15, 10, 30, 0.75)' }}
          >
            <div className="bg-white rounded-lg shadow-2xl p-8 text-center" style={{ maxWidth: '320px' }}>
              <img src="/images/Hire_Power_icon_2.png" alt="Hire Power" className="h-10 w-auto mx-auto mb-4" />
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <h3 className="font-semibold text-gray-900 mb-1">Preparing your resume...</h3>
              <p className="text-xs text-gray-500">Applying your changes and calculating your new score.</p>
            </div>
          </div>
        )}

        {/* Change Review Modal */}
        {showChangeModal && currentChange && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.85)' }}
          >
            <div
              className="bg-white shadow-2xl w-full max-w-2xl border border-gray-200 flex flex-col"
              style={{ borderRadius: '8px', height: '480px' }}
            >
              <div
                style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)', borderRadius: '8px 8px 0 0' }}
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
                    <p className="text-purple-100 text-xs">Change {Math.min(currentChangeIndex + 1, totalChanges)} of {totalChanges}{currentChange.section ? ` · ${currentChange.section}` : ''}</p>
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
                        const lastDecision = decisionStack[decisionStack.length - 1]
                        if (lastDecision === 'accept') {
                          setAcceptedChanges(prev => prev.slice(0, -1))
                        } else {
                          setRejectedChanges(prev => prev.slice(0, -1))
                        }
                        setDecisionStack(prev => prev.slice(0, -1))
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
                      setDecisionStack(prev => [...prev, 'reject'])
                      const newIndex = currentChangeIndex + 1
                      setCurrentChangeIndex(newIndex)
                      setEditingChange(false)
                      setEditedText('')
                      if (newIndex >= totalChanges) {
                        setShowChangeModal(false)
                        finishReview([...acceptedChanges])
                      }
                    }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors"
                  >
                    ✗ Keep Original
                  </button>
                  {currentChange.after && setReviseModalState && (
                    <button
                      onClick={() => {
                        setReviseModalState({ mode: 'choose', text: currentChange.after, location: { type: 'reviewChange', changeIndex: currentChangeIndex } })
                      }}
                      className="px-4 py-2 bg-white text-purple-600 border border-purple-300 rounded-lg text-xs font-medium hover:bg-purple-50 transition-colors"
                    >
                      ⚡ Try Different
                    </button>
                  )}
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
                      setDecisionStack(prev => [...prev, 'accept'])
                      const newIndex = currentChangeIndex + 1
                      setCurrentChangeIndex(newIndex)
                      setEditingChange(false)
                      setEditedText('')
                      if (newIndex >= totalChanges) {
                        setShowChangeModal(false)
                        finishReview(newAccepted)
                      }
                      // Modal stays open for next change
                    }}
                    className="px-4 py-2 text-white rounded-lg text-xs font-semibold transition-opacity hover:opacity-90"
                    style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
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
          <h3 className="font-semibold text-gray-900 text-base md:text-base">Your New Resume is Ready!</h3>
          <p className="text-sm md:text-xs text-gray-500 mt-1">
            {totalChanges} improvement{totalChanges !== 1 ? 's' : ''} made
          </p>
        </div>

        <div className="text-sm md:text-xs text-gray-600 text-center space-y-2">
          <p><strong>The improved version is displayed.</strong></p>
          <p>Love it? <strong>Accept All</strong> and you're ready to format, download, and start applying!</p>
          <p>Want to fine-tune? <strong>Review Changes</strong> lets you go through each one and edit as you like.</p>
        </div>

        <div className="flex justify-center mt-2">
          <div className="flex gap-2">
            <button
              onClick={acceptAll}
              disabled={accepting}
              className="bg-purple-600 text-white rounded-lg py-1.5 px-3 text-sm md:text-xs font-medium hover:bg-purple-700 disabled:opacity-75 flex items-center gap-1.5 transition-colors"
            >
              {accepting && <div className="h-3 w-3 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>}
              {accepting ? 'Saving...' : '✓ Accept All'}
            </button>
            <button
              onClick={() => { setReviewMode(true); setShowChangeModal(true) }}
              className="bg-white text-purple-600 border border-purple-600 rounded-lg py-1.5 px-3 text-sm md:text-xs font-medium hover:bg-purple-50 transition-colors"
            >
              Review Changes
            </button>
          </div>
        </div>
      </div>

      {/* Score Reveal Modal — Pro users */}
      {showRevealModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(15, 10, 30, 0.75)' }}
        >
          <div className="relative flex items-center md:w-[740px] md:h-[560px] w-full px-4">

            <div
              className="absolute left-0 bg-white shadow-2xl overflow-hidden hidden md:block"
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
              className="bg-white shadow-2xl flex flex-col w-full md:absolute md:w-[380px] md:left-[320px] md:top-1/2 md:-translate-y-1/2"
              style={{ borderRadius: '8px', border: '1px solid #e5e7eb', zIndex: 10 }}
            >
              <div
                style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)' }}
                className="px-6 py-5 text-center rounded-t-lg md:rounded-none"
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
                        <p className="text-5xl font-bold" style={{ color: scoreBeforeCoaching >= 85 ? '#9333ea' : scoreBeforeCoaching >= 75 ? '#81c784' : scoreBeforeCoaching >= 60 ? '#ffc870' : '#e57373' }}>{scoreBeforeCoaching}</p>
                      </div>
                      <div className="text-2xl" style={{ color: '#9ca3af' }}>→</div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500 mb-1">After</p>
                        <p className="text-5xl font-bold" style={{ color: scoreAfterCoaching >= 85 ? '#9333ea' : scoreAfterCoaching >= 75 ? '#81c784' : scoreAfterCoaching >= 60 ? '#ffc870' : '#e57373' }}>{scoreAfterCoaching}</p>
                      </div>
                    </div>
                    {scoreAfterCoaching > scoreBeforeCoaching ? (
                      <p className="text-sm font-semibold text-purple-600">
                        +{scoreAfterCoaching - scoreBeforeCoaching} points from coaching
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
                    Give it a final review in the Format step, then it's ready to download and apply.
                  </p>
                </div>

                 <button
                  onClick={async () => {
                    setShowRevealModal(false)
                    const { error: saveError } = await supabase
                      .from('resumes')
                      .update({ journey_step: 'format', updated_at: new Date().toISOString() })
                      .eq('id', params.id)
                    if (saveError) {
                      console.error('Error advancing to format step:', saveError)
                      setErrorToast("We couldn't move you to the format step. Please try again.")
                      return
                    }
                    setResume(prev => ({ ...prev, journey_step: 'format' }))
                  }}
                  className="block mx-auto text-white rounded-lg py-2.5 px-8 font-semibold text-sm transition-opacity hover:opacity-90 mb-3"
                  style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
                >
                  Format My Resume →
                </button>

                {scoreAfterCoaching && scoreAfterCoaching < 80 && remainingGaps.length > 0 && recoachAttempts < 1 && (
                  <button
                    onClick={() => {
                      setShowRevealModal(false)
                      setTargetedMessages([])
                      setShowGapsModal(true)
                    }}
                    className="block mx-auto bg-white text-purple-600 border border-purple-300 rounded-lg py-2 px-8 text-xs font-medium hover:bg-purple-50 transition-colors whitespace-nowrap"
                  >
                    Want to push for more points? →
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    {/* Gaps Modal */}
      {showGapsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ backgroundColor: 'rgba(15, 10, 30, 0.75)' }}
        >
          <div
            className="bg-white shadow-2xl w-full max-w-md border border-gray-200"
            style={{ borderRadius: '8px' }}
          >
            <div
              style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)', borderRadius: '8px 8px 0 0' }}
              className="px-6 py-4"
            >
              <div className="flex items-center gap-3">
                <img src="/images/Hire_Power_icon.png" alt="Hire Power" className="h-8 w-auto flex-shrink-0" />
                <div>
                  <h2 className="text-base font-bold text-white">Here's what would move your score higher.</h2>
                  <p className="text-purple-100 text-xs">We need a little more from you to get there.</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <ul className="space-y-2 mb-5">
                {remainingGaps.map((gap, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                    <span className="text-purple-600 flex-shrink-0 mt-0.5">•</span>
                    <span>{gap}</span>
                  </li>
                ))}
              </ul>

              <p className="text-xs text-gray-500 mb-5">
                If you have this information, a 5-minute follow-up session could add more points.
                If you don't — that's okay. Your resume already reflects everything you shared,
                and a score built on honest content will always outperform one built on fluff.
              </p>

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    setShowGapsModal(false)
                    setShowTargetedRecoach(true)
                  }}
                  className="block mx-auto text-white rounded-lg py-2 px-8 text-xs font-semibold transition-opacity hover:opacity-90"
                  style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
                >
                  I have more to share — let's do it →
                </button>
                <button
                  onClick={async () => {
                    setShowGapsModal(false)
                    const { error: saveError } = await supabase
                      .from('resumes')
                      .update({ journey_step: 'format', updated_at: new Date().toISOString() })
                      .eq('id', params.id)
                    if (saveError) {
                      console.error('Error advancing to format step:', saveError)
                      setErrorToast("We couldn't move you to the format step. Please try again.")
                      return
                    }
                    setResume(prev => ({ ...prev, journey_step: 'format' }))
                  }}
                  className="w-full bg-white text-gray-500 border border-gray-200 rounded-lg py-2 text-xs font-medium hover:bg-gray-50 transition-colors"
                >
                  I'm good with my current score
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ErrorToast message={errorToast} onClose={() => setErrorToast(null)} />

      {/* Targeted Recoach */}
      {showTargetedRecoach && (
       <TargetedRecoachStep
          resumeData={resumeData}
          rewrittenResume={rewrittenResume}
          remainingGaps={remainingGaps}
          detectedLevel={detectedLevel}
          userName={userName}
          userProfile={userProfile}
          supabase={supabase}
          params={params}
          setResume={setResume}
          setRewrittenResume={setRewrittenResume}
          setResumeChanges={setResumeChanges}
          targetedMessages={targetedMessages}
          setTargetedMessages={setTargetedMessages}
          handleReassess={handleReassess}
          setShowRevealModal={setShowRevealModal}
          setRecoachAttempts={setRecoachAttempts}
          score={score}
          originalCoachingMessages={coachingMessages || []}
          careerContext={careerContext}
          onClose={() => setShowTargetedRecoach(false)}
        />
      )}
    </>
  )
}

// ─────────────────────────────────────────────
// FREE IMPROVE STEP
// ─────────────────────────────────────────────
function FreeImproveStep({ suggestions, supabase, params, setResume, coachingSamplesUsed, handleReassess, isAnalyzing, setShowRevealModal, setShowUpgradeModal }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isChecking, setIsChecking] = useState(false)
  const [errorToastFree, setErrorToastFree] = useState(null)
  const isDone = currentIndex >= suggestions.length
  const hasUsedTrial = coachingSamplesUsed > 0

  return (
    <div className="space-y-2 -mt-2">
      <h3 className="font-semibold text-lg">✏️ Improve Your Resume</h3>
      <p className="text-sm md:text-xs text-gray-700 text-center">Ready to tackle the rest? We'll walk you through the recommended changes one at a time below.</p>

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
            <p className="text-xs md:text-[10px] font-bold text-purple-700 uppercase tracking-wide mb-1">🎯 Action Item {currentIndex + 1}</p>
            <p className="text-sm md:text-xs text-gray-800 leading-snug">{suggestions[currentIndex]}</p>
          </div>

          <p className="text-sm md:text-[12px] text-gray-600 text-center">
            Make this change on your resume, then click Next Suggestion to make the next improvement.
          </p>

          <div className="mt-5 space-y-2">
            <div className="flex gap-2">
             <button
                onClick={() => setShowUpgradeModal(true)}
                className="flex-1 bg-white text-purple-600 border border-purple-300 rounded-lg py-2 px-3 font-semibold text-sm md:text-xs hover:bg-purple-50 transition-colors"
              >
                Let Us Rewrite It
              </button>
             <button
                onClick={async () => {
                  const isLast = currentIndex === suggestions.length - 1
                  if (isLast) {
                    setIsChecking(true)
                    try {
                      await handleReassess()
                      setShowRevealModal(true)
                    } catch (err) {
                      console.error('Error during final reassess:', err)
                      setErrorToastFree("We couldn't check your score. Please try again.")
                    } finally {
                      setIsChecking(false)
                    }
                  } else {
                    setCurrentIndex(prev => prev + 1)
                  }
                }}
                disabled={isChecking}
                className="flex-1 text-white rounded-lg py-2 px-3 font-semibold text-sm md:text-xs transition-opacity hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-1 whitespace-nowrap"
                style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
              >
              {isChecking
                ? <><div className="h-3 w-3 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div> Checking...</>
                : currentIndex === suggestions.length - 1 ? 'Check My Score →' : 'Next Improvement →'}
              </button>
            </div>
            <div className="flex justify-center">
              <button
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className="text-gray-400 text-sm md:text-xs hover:text-gray-600 disabled:opacity-30"
              >
                ← Back
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
            <p className="text-xl mb-0.5">✅</p>
            <p className="font-semibold text-green-800 text-sm md:text-xs">All suggestions reviewed!</p>
            <p className="text-sm md:text-xs text-green-700">Made changes? Check your updated score.</p>
          </div>

          <div className="flex flex-col items-center gap-2 mt-5">
            <button
              onClick={() => setShowUpgradeModal(true)}
              className="flex-1 text-white rounded-lg py-2 px-3 font-semibold text-sm md:text-xs transition-opacity hover:opacity-90"
              style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
            >
              Let Us Rewrite It
            </button>
           <button
              onClick={async () => {
                try {
                  await handleReassess()
                  setShowRevealModal(true)
                } catch (err) {
                  console.error('Error during reassess:', err)
                  setErrorToastFree("We couldn't check your score. Please try again.")
                }
              }}
              disabled={isAnalyzing}
              className="bg-white text-purple-600 border border-purple-300 rounded-lg py-2 px-4 text-sm md:text-xs font-semibold hover:bg-purple-50 transition-colors flex items-center gap-1"
            >
              {isAnalyzing
                ? <><div className="h-3 w-3 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div> Analyzing...</>
                : '📊 Re-assess My Score'
              }
            </button>
            <button
              onClick={async () => {
              const { error: saveError } = await supabase
                .from('resumes')
                .update({ journey_step: 'format', updated_at: new Date().toISOString() })
                .eq('id', params.id)
              if (saveError) {
                console.error('Error advancing to format step:', saveError)
                setErrorToastFree("We couldn't move you to the format step. Please try again.")
                return
              }
              setResume(prev => ({ ...prev, journey_step: 'format' }))
              if (setViewingStep) setViewingStep(null)
            }}
            className="text-white rounded-lg py-2 px-8 font-semibold text-sm md:text-xs transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
          >
            Format My Resume →
            </button>
          </div>
        </div>
      )}
      <ErrorToast message={errorToastFree} onClose={() => setErrorToastFree(null)} />
    </div>
  )
}
// ─────────────────────────────────────────────
// TARGETED RECOACH STEP
// ─────────────────────────────────────────────
function TargetedRecoachStep({ resumeData, rewrittenResume, remainingGaps, detectedLevel, userName, userProfile, supabase, params, setResume, setRewrittenResume, setResumeChanges, targetedMessages, setTargetedMessages, handleReassess, setShowRevealModal, setRecoachAttempts, score, originalCoachingMessages, careerContext, onClose, isConversationalFix }) {
  const [userInput, setUserInput] = useState('')
  const [sending, setSending] = useState(false)
  const [isFinishing, setIsFinishing] = useState(false)
  const [errorToast, setErrorToast] = useState(null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const hasStartedRef = useRef(false)

  const getMessageText = (msg) => {
    if (!msg.content) return ''
    let raw = ''
    if (typeof msg.content === 'string') raw = msg.content
    else if (Array.isArray(msg.content)) raw = msg.content.map(b => b.text || '').join(' ')
    // Strip capture tags so they never display in the chat UI
    if (msg.role === 'assistant') {
      const { cleanText } = parseCaptureTags(raw)
      return cleanText
    }
    return raw
  }

  const isComplete = targetedMessages.some(msg =>
    msg.role === 'assistant' && getMessageText(msg).toLowerCase().includes('click the button below')
  )

  useEffect(() => {
    if (targetedMessages.length === 0 && !hasStartedRef.current) {
      hasStartedRef.current = true
      startTargetedCoach()
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [targetedMessages])

  async function startTargetedCoach() {
    setSending(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch('/api/coach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          resumeData: {
            ...resumeData,
            _remainingGaps: remainingGaps,
            _previousCoaching: true,
            _originalTranscript: originalCoachingMessages
          },
          careerContext: careerContext || null,
          detectedLevel,
          displayName: userName,
          tier: isConversationalFix ? 'conversational_fix' : 'targeted',
          conversation: [{ role: 'user', content: isConversationalFix ? "I'd like to review my résumé." : "I have more information to share." }]
        })
      })
      const data = await response.json()
      if (data.response) {
        setTargetedMessages([{ role: 'assistant', content: data.response }])
      }
    } catch (err) {
      console.error('Error starting targeted coach:', err)
    } finally {
      setSending(false)
      setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 100)
    }
  }

  async function sendMessage() {
    if (!userInput.trim() || sending) return
    const newMessage = { role: 'user', content: userInput }
    const updatedMessages = [...targetedMessages, newMessage]
    setTargetedMessages(updatedMessages)
    setUserInput('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
    setSending(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch('/api/coach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          resumeData: {
            ...resumeData,
            _remainingGaps: remainingGaps,
            _previousCoaching: true,
            _originalTranscript: originalCoachingMessages
          },
          careerContext: careerContext || null,
          detectedLevel,
          displayName: userName,
          tier: isConversationalFix ? 'conversational_fix' : 'targeted',
          conversation: updatedMessages
        })
      })
      const data = await response.json()
      if (data.response) {
        setTargetedMessages([...updatedMessages, { role: 'assistant', content: data.response }])
      }
    } catch (err) {
      console.error('Error in targeted coach:', err)
    } finally {
      setSending(false)
      setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 100)
    }
  }

  async function finishTargetedCoach() {
    setIsFinishing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch('/api/coach-finish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          resumeData: {
            ...resumeData,
            _rewrittenResume: rewrittenResume,
            _remainingGaps: remainingGaps,
            _baseScore: score
          },
          conversation: targetedMessages,
          detectedLevel,
          isTargetedEnhancement: isConversationalFix ? false : true,
          isConversationalFix: isConversationalFix ? true : false
        })
      })
      const data = await response.json()
      if (!data.rewrittenResume) throw new Error('Enhancement failed')

      setRewrittenResume(data.rewrittenResume)
      setResumeChanges(data.changes || [])
      setRecoachAttempts(prev => prev + 1)

      const { error: saveError } = await supabase
        .from('resumes')
        .update({
          rewritten_resume: data.rewrittenResume,
          resume_changes: data.changes || [],
          updated_at: new Date().toISOString()
        })
        .eq('id', params.id)

      if (saveError) {
        console.error('Error saving targeted recoach result:', saveError)
        setErrorToast("We rewrote your résumé but couldn't save it. Please try the update button again.")
        setIsFinishing(false)
        return
      }

      setResume(prev => ({ ...prev, resume_data: data.rewrittenResume }))
      await handleReassess(data.rewrittenResume)
      setShowRevealModal(true)
      onClose()
    } catch (err) {
      console.error('Error finishing targeted coach:', err)
      setErrorToast('Something went wrong. Please try again.')
    } finally {
      setIsFinishing(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ backgroundColor: 'rgba(15, 10, 30, 0.75)' }}
    >
      <div
        className="bg-white shadow-2xl w-full max-w-lg border border-gray-200 flex flex-col"
        style={{ borderRadius: '8px', maxHeight: '80vh' }}
      >
        <div
          style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)', borderRadius: '8px 8px 0 0' }}
          className="px-6 py-4 flex items-center justify-between flex-shrink-0"
        >
          <div className="flex items-center gap-3">
            <img src="/images/Hire_Power_icon.png" alt="Hire Power" className="h-8 w-auto flex-shrink-0" />
            <div>
              <h2 className="text-base font-bold text-white">{isConversationalFix ? 'Fix It' : "Let's push a little further."}</h2>
              <p className="text-purple-100 text-xs">{isConversationalFix ? 'Tell Coach what to correct or add.' : '5 minutes. Focused. Just the gaps.'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 text-3xl leading-none font-light"
          >×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {targetedMessages.map((msg, i) => (
            <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`rounded-lg px-3 py-2 text-xs leading-snug ${
                msg.role === 'assistant'
                  ? 'bg-purple-50 border border-purple-100 w-full'
                  : 'bg-gray-100 border border-gray-200 max-w-[90%]'
              }`}>
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-sm">🎓</span>
                    <span className="text-[10px] font-semibold text-gray-500">Resume Coach</span>
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
                <div className="flex gap-1 items-center">
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <ErrorToast message={errorToast} onClose={() => setErrorToast(null)} />

        <div className="p-4 border-t border-gray-100 flex-shrink-0">
          {!isComplete ? (
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onInput={(e) => {
                  e.target.style.height = 'auto'
                  const target = Math.min(e.target.scrollHeight, 120)
                  e.target.style.height = target + 'px'
                  e.target.style.overflowY = e.target.scrollHeight > target ? 'auto' : 'hidden'
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
                }}
                placeholder="Type your response..."
                disabled={sending}
                rows={2}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                style={{ overflowY: 'hidden', maxHeight: '120px' }}
              />
              <button
                onClick={sendMessage}
                disabled={!userInput.trim() || sending}
                className="flex-shrink-0 flex items-center justify-center rounded-lg transition-colors disabled:opacity-30"
                style={{
                  width: '32px',
                  height: '56px',
                  background: userInput.trim() && !sending ? 'linear-gradient(to right, #667eea, #764ba2)' : '#d1d5db',
                  alignSelf: 'flex-end'
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-4 h-4">
                  <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                </svg>
              </button>
            </div>
          ) : (
            <button
              onClick={finishTargetedCoach}
              disabled={isFinishing}
              className="block mx-auto text-white rounded-lg py-2 px-8 text-xs font-semibold disabled:opacity-75 flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
              style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
            >
              {isFinishing && <div className="h-3 w-3 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>}
              {isFinishing ? 'Updating your resume...' : isConversationalFix ? '✨ Update My Résumé →' : '✨ Update My Resume →'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// FORMAT STEP
// ─────────────────────────────────────────────
function FormatStep({ supabase, params, setResume, handleReassess, isAnalyzing, score, userTier, setReviseModalState, coachingComplete, setViewingStep }) {
  const [advancing, setAdvancing] = useState(false)
  const [errorToastFormat, setErrorToastFormat] = useState(null)

  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-lg -mt-3">🎨 Format Your Resume</h3>

      <p className="text-sm md:text-xs text-gray-700">
        Content is locked in. Now make sure your resume looks exactly right before saving.
      </p>

      <div className="bg-purple-50 border-l-4 border-purple-500 p-3 rounded">
        <div className="text-sm md:text-xs text-purple-900 space-y-2">
          <div><strong>📄 Pick a template</strong> — 98% of large companies run your resume through ATS software before a human ever sees it. Two-column layouts, graphics, and fancy formatting confuse that software, making half your skills and experience disappear before anyone reads a word. Our templates are simple and ATS-proof by design, because a gorgeous resume that a computer can't read is just a beautiful rejection.</div>
          <div><strong>✏️ Edit directly</strong> — Click any section of your resume to edit text, reorder content, or delete what you don't need.</div>
          <div><strong>🎨 Style it</strong> — Change fonts, adjust size, pick an accent color, or change date formats from the toolbar.</div>
          <div><strong>⚡ Auto-fit</strong> — One click optimizes font size and spacing to fit everything on one perfect page (when possible).</div>
          <div><strong>👀 Preview</strong> — See exactly how your PDF will look before downloading.</div>
          <div><strong>💾 Save anytime</strong> — Your progress auto-saves, but you can also save manually from the toolbar.</div>
        </div>
      </div>

      {score && (
        <div className="flex items-center justify-center gap-2">
          <p className="text-sm text-gray-500">Current score:</p>
          <p className={`text-large font-bold ${score >= 85 ? 'text-purple-600' : score >= 75 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
            {score}/100
          </p>
        </div>
      )}
     <div className="flex gap-2 justify-center pt-1 px-1">
        {userTier !== 'free' && coachingComplete && (
          <button
            onClick={() => setReviseModalState({ mode: 'add' })}
            className="bg-white text-purple-600 border border-purple-300 rounded-lg px-4 py-2 text-sm md:text-xs font-semibold hover:bg-purple-50 transition-colors whitespace-nowrap"
          >
            ⚡ More to add?
          </button>
        )}
        <button
          onClick={async () => {
            setAdvancing(true)
            try {
              const { error: saveError } = await supabase
                .from('resumes')
                .update({ journey_step: 'save', updated_at: new Date().toISOString() })
                .eq('id', params.id)
              if (saveError) {
                console.error('Error advancing to save step:', saveError)
                setErrorToastFormat("We couldn't move you to the save step. Please try again.")
                return
              }
              setResume(prev => ({ ...prev, journey_step: 'save' }))
              if (setViewingStep) setViewingStep(null)
            } catch (err) {
              console.error('Unexpected error advancing to save step:', err)
              setErrorToastFormat("Something went wrong. Please try again.")
            } finally {
              setAdvancing(false)
            }
          }}
          disabled={advancing}
          className="text-white rounded-lg py-2 px-4 font-semibold text-sm md:text-xs disabled:opacity-75 flex items-center gap-2 transition-opacity hover:opacity-90 whitespace-nowrap"
          style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
        >
          {advancing && <div className="h-3 w-3 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>}
          {advancing ? 'Saving...' : 'Ready to Save →'}
        </button>
      </div>
      <ErrorToast message={errorToastFormat} onClose={() => setErrorToastFormat(null)} />
    </div>
  )
}

// ─────────────────────────────────────────────
// SAVE STEP
// ─────────────────────────────────────────────
function SaveStep({ resumeName, userName, params, isJobSpecific, userTier, handleDownload, isDownloading }) {
  const firstName = userName ? userName.split(' ')[0] : null
  const [errorToastSave, setErrorToastSave] = useState(null)

  useEffect(() => {
    async function markComplete() {
      try {
        const supabase = createClient()
        const { data: resume, error: readError } = await supabase
          .from('resumes')
          .select('completed_at')
          .eq('id', params.id)
          .single()

        if (readError) {
          console.error('Error reading completion status:', readError)
          setErrorToastSave("We couldn't confirm your resume's completion status. Your work is safe — please refresh the page.")
          return
        }

        if (!resume?.completed_at) {
          const { error: updateError } = await supabase
            .from('resumes')
            .update({ 
              completed_at: new Date().toISOString(),
              journey_step: 'save'
            })
            .eq('id', params.id)

          if (updateError) {
            console.error('Error marking resume complete:', updateError)
            setErrorToastSave("We couldn't mark your resume as complete. Your work is safe — please refresh the page.")
          }
        }
      } catch (err) {
        console.error('Unexpected error marking complete:', err)
        setErrorToastSave("Something went wrong saving your completion status. Your work is safe — please refresh the page.")
      }
    }
    markComplete()
  }, [params.id])

  return (
    <div className="space-y-1.5 -mt-2">
      <h3 className="font-semibold text-lg -mt-3">⭐ Resume Complete!</h3>

      <p className="text-sm md:text-xs text-gray-500">Your resume is application-ready.</p>

      <div className="flex justify-center pt-1">
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className="text-white rounded-lg py-2 px-8 text-sm md:text-xs font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
          style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
        >
          {isDownloading && <div className="h-3 w-3 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>}
          {isDownloading ? 'Generating...' : '⬇️ Download Your Resume'}
        </button>
      </div>

      <div className="pt-1 border-t border-gray-200">
        <p className="text-sm md:text-xs text-gray-500 mb-3">Ready to put it to use?</p>
        <div className="flex flex-col items-center gap-2" style={{ minWidth: '220px' }}>
          {isJobSpecific && (
            <button
              onClick={() => window.location.href = '/job-tracker'}
              className="w-full bg-white text-purple-600 border border-purple-300 rounded-lg py-2 px-4 text-sm md:text-xs font-semibold hover:bg-purple-50 transition-colors"
            >
              📋 View in Job Tracker →
            </button>
          )}
          {!isJobSpecific && (
            <button
              onClick={() => window.location.href = `/resume-coach?action=new-job-specific&from=${params.id}`}
              className="w-full bg-white text-purple-600 border border-purple-300 rounded-lg py-2 px-4 text-sm md:text-xs font-semibold hover:bg-purple-50 transition-colors"
            >
              {userTier === 'free' ? '📊 Check Match Score for Any Job' : '🎯 Tailor for a Specific Job'}
            </button>
          )}
          <button
            onClick={() => window.location.href = '/resume-coach?action=new-cover-letter'}
            className="w-full bg-white text-purple-600 border border-purple-300 rounded-lg py-2 px-4 text-sm md:text-xs font-semibold hover:bg-purple-50 transition-colors"
          >
            ✉️ Create a Cover Letter
          </button>
          <button
            onClick={() => window.location.href = '/interview-coach'}
            className="w-full bg-white text-purple-600 border border-purple-300 rounded-lg py-2 px-4 text-sm md:text-xs font-semibold hover:bg-purple-50 transition-colors"
          >
            🎤 Start Interview Prep
          </button>
          <button
            onClick={() => window.location.href = '/resume-coach'}
            className="text-gray-400 text-sm md:text-xs hover:text-gray-600 mt-1"
          >
            ← Back to Resume Coach
          </button>
        </div>
      </div>
      <ErrorToast message={errorToastSave} onClose={() => setErrorToastSave(null)} />
    </div>
  )
}