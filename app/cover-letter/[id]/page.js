'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import MainNav from '@/app/components/MainNav'
import Breadcrumb from '@/app/components/Breadcrumb'
import CoverLetterContent from '@/app/components/CoverLetterContent'
import ErrorToast from '@/app/components/ErrorToast'
import SuccessToast from '@/app/components/SuccessToast'
import PDFViewer from '@/app/components/PDFViewer'
import { fetchJSON } from '@/lib/fetchJSON'
import CoachReviseModal from '@/app/components/CoachReviseModal'
import UpgradeModal from '@/app/components/UpgradeModal'

// Mirrors the display_name convention job-specific resumes are created with,
// so a job reads the same whichever document you are looking at.
function coverLetterLabel(cl) {
  const title = cl?.job_title?.trim()
  const company = cl?.job_company?.trim()
  if (title && company) return `${title} at ${company}`
  return title || company || 'Draft'
}

export default function CoverLetterPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()

  const [coverLetter, setCoverLetter] = useState(null)
  const [loading, setLoading] = useState(true)
  const [userProfile, setUserProfile] = useState(null)
  const [siblingCoverLetters, setSiblingCoverLetters] = useState([])
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [unsavedNavTarget, setUnsavedNavTarget] = useState(null)
  const [pendingNavigation, setPendingNavigation] = useState(null)
  const [saveToast, setSaveToast] = useState(null)
  const [saveToastCount, setSaveToastCount] = useState(0)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [isAutoFitting, setIsAutoFitting] = useState(false)
  const [showTooLongModal, setShowTooLongModal] = useState(false)
  const isAutoFitJustRanRef = useRef(false)
  const pageCheckTimerRef = useRef(null)
  const cardLinkRanRef = useRef(false)

  // Toolbar state
  const [selectedTemplate, setSelectedTemplate] = useState('current')
  const [selectedFont, setSelectedFont] = useState('Lato')
  const [userChangedTemplate, setUserChangedTemplate] = useState(false)
  const [userChangedFont, setUserChangedFont] = useState(false)
  const [selectedSize, setSelectedSize] = useState(11)
  const [selectedSpacing, setSelectedSpacing] = useState(1)
  const [zoom, setZoom] = useState(100)
  const [accentColor, setAccentColor] = useState('#5b4fcf')
  const [resumeExceedsPage, setResumeExceedsPage] = useState(false)
  const [errorToast, setErrorToast] = useState(null)
  const [mobileToolbar, setMobileToolbar] = useState(null)
  const [mobileScale, setMobileScale] = useState(1)
  const [showEditTip, setShowEditTip] = useState(false)
  const [showEditorTip, setShowEditorTip] = useState(false)
  const [reviseModalState, setReviseModalState] = useState(null)
  const [bulletSelectMode, setBulletSelectMode] = useState(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [history, setHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const isUndoingRef = useRef(false)
  const clPanelRef = useRef(null)
  const confirmedLeaveRef = useRef(false)

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

  useEffect(() => {
    const updateMobileScale = () => {
      if (window.innerWidth >= 768) {
        setMobileScale(1)
        return
      }
      if (!clPanelRef.current) return
      const containerWidth = clPanelRef.current.offsetWidth
      if (containerWidth > 0) setMobileScale(containerWidth / 816)
    }
    updateMobileScale()
    window.addEventListener('resize', updateMobileScale)
    return () => window.removeEventListener('resize', updateMobileScale)
  }, [loading])

  useEffect(() => {
    if (!localStorage.getItem('hp_cl_editor_tip_dismissed')) {
      setShowEditorTip(true)
    }
  }, [])

  const dismissEditorTip = () => {
    setShowEditorTip(false)
    localStorage.setItem('hp_cl_editor_tip_dismissed', '1')
  }

  useEffect(() => {
    if (hasUnsavedChanges && !saveSuccess) {
      const storageKey = `hp_save_toast_cl_${params.id}`
      const count = parseInt(localStorage.getItem(storageKey) || '0')
      setSaveToastCount(count)
      if (count < 3) {
        setSaveToast(window.innerWidth < 768 ? "You have unsaved changes. Tap Actions → Save when you're done editing." : "You have unsaved changes. Click Save when you're done editing.")
        localStorage.setItem(storageKey, String(count + 1))
        setSaveToastCount(count + 1)
      }
    }
  }, [hasUnsavedChanges, saveSuccess])

  // Warn before browser close / refresh / hard navigation
  useEffect(() => {
    if (!hasUnsavedChanges) return
    const handler = (e) => {
      if (confirmedLeaveRef.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasUnsavedChanges])

  // Navigate after save completes — decoupled from the async save to avoid history stack interference
  useEffect(() => {
    if (!pendingNavigation || hasUnsavedChanges) return
    window.location.href = pendingNavigation
  }, [hasUnsavedChanges, pendingNavigation])

  function safeNavigate(path) {
    if (hasUnsavedChanges) { setUnsavedNavTarget(path); return }
    router.push(path)
  }

  useEffect(() => {
    loadCoverLetter()
    loadUserProfile()
  }, [params.id])

  useEffect(() => {
    if (!coverLetter) return
    triggerPageCheck()
  }, [coverLetter?.cover_letter_data, selectedSize, selectedSpacing, selectedTemplate, selectedFont])

  useEffect(() => {
    if (templateFonts[selectedTemplate]) {
      setSelectedFont(templateFonts[selectedTemplate])
    }
  }, [selectedTemplate])

  useEffect(() => {
    if (!coverLetter) return
    if (cardLinkRanRef.current) return
    cardLinkRanRef.current = true
    autoLinkJobCard()
  }, [coverLetter?.id])

  async function autoLinkJobCard() {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError) throw authError
      if (!user) return

      // Check if any card (including archived) already has this cover letter linked
      const { data: existingCards, error: existingError } = await supabase
        .from('applications')
        .select('id')
        .eq('cover_letter_id', coverLetter.id)
        .eq('user_id', user.id)
        .limit(1)
      if (existingError) throw existingError

      if (existingCards?.[0]) return // already linked, nothing to do

      // Check if a card exists for the linked job specific resume (only if it's job-specific)
      if (coverLetter.linked_resume_id) {
        const { data: linkedResume, error: linkedResumeError } = await supabase
          .from('resumes')
          .select('id, resume_type')
          .eq('id', coverLetter.linked_resume_id)
          .single()
        if (linkedResumeError && linkedResumeError.code !== 'PGRST116') throw linkedResumeError

        const isJobSpecific = linkedResume?.resume_type === 'job_specific'

        if (isJobSpecific) {
          const { data: resumeCards, error: resumeCardsError } = await supabase
            .from('applications')
            .select('id')
            .eq('resume_id', coverLetter.linked_resume_id)
            .eq('user_id', user.id)
            .neq('application_status', 'archived')
            .limit(1)
          if (resumeCardsError) throw resumeCardsError

          const resumeCard = resumeCards?.[0] || null

          if (resumeCard) {
            const { error: updateError } = await supabase
              .from('applications')
              .update({ cover_letter_id: coverLetter.id })
              .eq('id', resumeCard.id)
            if (updateError) throw updateError
            return
          }
        }
      }

      // Check if a card already exists for this job title + company before creating.
      // PostgREST filters travel in the query string, so an oversized title or
      // company overflows the request URL and the gateway answers with a body that
      // isn't JSON — surfacing as an empty error object rather than a Postgres
      // error. Skip the lookup instead: the insert below is a POST, so it still
      // succeeds.
      const titleOk = typeof coverLetter.job_title === 'string' && coverLetter.job_title.trim().length > 0 && coverLetter.job_title.length <= 200
      const companyOk = typeof coverLetter.job_company === 'string' && coverLetter.job_company.trim().length > 0 && coverLetter.job_company.length <= 200

      if (titleOk && companyOk) {
        const { data: matchingCards, error: matchError } = await supabase
          .from('applications')
          .select('id')
          .eq('user_id', user.id)
          .eq('title', coverLetter.job_title)
          .eq('company', coverLetter.job_company)
          .neq('application_status', 'archived')
          .limit(1)
        if (matchError) throw matchError

        if (matchingCards?.[0]) {
          // Card exists for this job — link CL to it
          const { error: updateError } = await supabase
            .from('applications')
            .update({ cover_letter_id: coverLetter.id })
            .eq('id', matchingCards[0].id)
          if (updateError) throw updateError
          return
        }
      }

      // No existing card — create one (never link a core resume to a job card)
      const { error: insertError } = await supabase
        .from('applications')
        .insert({
          user_id: user.id,
          title: coverLetter.job_title || 'Untitled Role',
          company: coverLetter.job_company || 'Unknown Company',
          description: coverLetter.job_description || '',
          cover_letter_id: coverLetter.id,
          resume_id: null,
          application_status: 'resume_in_progress',
          application_date: new Date().toISOString().split('T')[0],
        })
      if (insertError) throw insertError
    } catch (err) {
      console.error('Auto-link job card failed:', err)
      // Auto-linking is best-effort behind the scenes. Don't block the user
      // from editing their cover letter if linking fails — they can manually
      // link from job tracker. But surface it so we know if it's broken.
      setErrorToast("We couldn't link this cover letter to a job card. You can link it manually from Job Tracker.")
    }
  }

  async function loadCoverLetter() {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError) throw authError
      if (!user) { router.push('/resume-coach'); return }

      const { data, error } = await supabase
        .from('cover_letters')
        .select('*')
        .eq('id', params.id)
        .eq('user_id', user.id)
        .single()

      if (error) {
        // Distinguish "not found" from real load failure
        if (error.code === 'PGRST116') {
          router.push('/resume-coach')
          return
        }
        throw error
      }

      setCoverLetter(data)
      loadBreadcrumbLinks(user.id)
      const loadedTemplate = data.template_id || 'current'
      setSelectedTemplate(loadedTemplate)
      setSelectedFont(data.font_family || templateFonts[loadedTemplate] || 'Lato')
      setSelectedSize(data.font_size || 11)
      setSelectedSpacing(data.spacing || 1)
    } catch (err) {
      console.error('Load cover letter failed:', err)
      setErrorToast("We couldn't load your cover letter. Please refresh the page.")
    } finally {
      setLoading(false)
    }
  }

  // Breadcrumb dropdown targets. The linked resume already rides along on the
  // cover letter row, so the only thing missing is the user's other letters.
  async function loadBreadcrumbLinks(userId) {
    try {
      const { data } = await supabase
        .from('cover_letters')
        .select('id, job_title, job_company')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      setSiblingCoverLetters(data || [])
    } catch (err) {
      // Navigation shortcut only. Log it and leave the crumb without its menu.
      console.warn('Breadcrumb links failed to load:', err)
    }
  }

  async function loadUserProfile() {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError) throw authError
      if (!user) return
      const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
      if (error) throw error
      setUserProfile(data)
    } catch (err) {
      console.error('Load user profile failed:', err)
      // Profile loading is non-blocking — the page still works without it.
      // Don't show a toast; just log and move on.
    }
  }

  function updateCoverLetterData(newData) {
    if (isUndoingRef.current) return
    const cloned = JSON.parse(JSON.stringify(newData))
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1)
      newHistory.push(cloned)
      return newHistory
    })
    setHistoryIndex(prev => prev + 1)
    setCoverLetter(prev => ({ ...prev, cover_letter_data: cloned }))
    setHasUnsavedChanges(true)
  }

  function undo() {
    if (historyIndex > 0) {
      isUndoingRef.current = true
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      setCoverLetter(prev => ({ ...prev, cover_letter_data: JSON.parse(JSON.stringify(history[newIndex])) }))
      setHasUnsavedChanges(true)
      requestAnimationFrame(() => { isUndoingRef.current = false })
    }
  }

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

  async function save(overrides = {}) {
    try {
      const { error } = await supabase
        .from('cover_letters')
        .update({
          cover_letter_data: coverLetter.cover_letter_data,
          template_id: selectedTemplate,
          font_family: selectedFont,
          font_size: Math.round(overrides.fontSize ?? selectedSize),
          spacing: overrides.spacing ?? selectedSpacing,
          updated_at: new Date().toISOString()
        })
        .eq('id', params.id)

      if (error) throw error
      setHasUnsavedChanges(false)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2000)
    } catch (err) {
      console.error('Save error:', err)
      setErrorToast("We couldn't save your changes. Please check your connection and try again.")
      // Note: hasUnsavedChanges stays true so the Save button stays
      // active and the user can retry without losing their edits.
    }
  }

  const triggerPageCheck = () => {
    if (pageCheckTimerRef.current) clearTimeout(pageCheckTimerRef.current)
    pageCheckTimerRef.current = setTimeout(async () => {
      if (isAutoFitJustRanRef.current) { isAutoFitJustRanRef.current = false; return }
      try {
        const { data: { user } } = await supabase.auth.getUser()
        const templateForApi = selectedTemplate.charAt(0).toUpperCase() + selectedTemplate.slice(1)
        const { data: { session: checkSession } } = await supabase.auth.getSession()
        const response = await fetch('/api/generate-cover-letter-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${checkSession.access_token}` },
          body: JSON.stringify({
            coverLetterData: coverLetter.cover_letter_data,
            templateName: templateForApi,
            fontSize: selectedSize,
            font: selectedFont,
            spacing: selectedSpacing,
            action: 'check',
            userId: user.id
          })
        })
        if (response.ok) {
          const { pageCount } = await response.json()
          setResumeExceedsPage(pageCount > 1)
        }
      } catch (e) {
        console.warn('Page check failed (non-blocking):', e)
      }
    }, 1500)
  }

  const handleAutoFit = async () => {
    setIsAutoFitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: { session: autoFitSession } } = await supabase.auth.getSession()
      const templateForApi = selectedTemplate.charAt(0).toUpperCase() + selectedTemplate.slice(1)
      const minSize = 10
      const maxSize = 12
      let testSize = selectedSize

      const checkSize = async (size, spacing = 1) => {
        return await fetchJSON('/api/generate-cover-letter-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${autoFitSession.access_token}` },
          body: JSON.stringify({
            coverLetterData: coverLetter.cover_letter_data,
            templateName: templateForApi,
            fontSize: size,
            font: selectedFont,
            spacing,
            action: 'check',
            userId: user.id
          })
        })
      }

      const current = await checkSize(testSize)

      if (current.pageCount === 1) {
        let bestSize = testSize
        let bestSpacing = 1
        let trySize = Math.round((testSize + 0.5) * 10) / 10
        while (trySize <= maxSize) {
          const result = await checkSize(trySize, 1)
          if (result.pageCount === 1) { bestSize = trySize; trySize = Math.round((trySize + 0.5) * 10) / 10 }
          else break
        }
        let trySpacing = Math.round((bestSpacing + 0.1) * 10) / 10
        while (trySpacing <= 1.5) {
          const result = await checkSize(bestSize, trySpacing)
          if (result.pageCount === 1) { bestSpacing = trySpacing; trySpacing = Math.round((trySpacing + 0.1) * 10) / 10 }
          else break
        }
        setSelectedSize(bestSize)
        setSelectedSpacing(bestSpacing)
        setResumeExceedsPage(false)
        isAutoFitJustRanRef.current = true
        await save({ fontSize: bestSize, spacing: bestSpacing })
      } else {
        testSize = Math.round((testSize - 0.5) * 10) / 10
        let fitted = false
        let fittedSpacing = 1
        while (testSize >= minSize) {
          const result = await checkSize(testSize, 1)
          if (result.pageCount === 1) { fitted = true; fittedSpacing = 1; break }
          testSize = Math.round((testSize - 0.5) * 10) / 10
        }
        if (!fitted) {
          testSize = minSize
          let trySpacing = 1.2
          while (trySpacing >= 1.0) {
            const result = await checkSize(testSize, trySpacing)
            if (result.pageCount === 1) { fitted = true; fittedSpacing = trySpacing; break }
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
      const templateForApi = selectedTemplate.charAt(0).toUpperCase() + selectedTemplate.slice(1)
      const { data: { session: dlSession } } = await supabase.auth.getSession()
      const result = await fetchJSON('/api/generate-cover-letter-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${dlSession.access_token}` },
        body: JSON.stringify({
          coverLetterData: coverLetter.cover_letter_data,
          templateName: templateForApi,
          fontSize: selectedSize,
          font: selectedFont,
          spacing: selectedSpacing,
          action: 'download',
          userId: user.id
        })
      })
      const pdfResponse = await fetch(result.pdfUrl)
      if (!pdfResponse.ok) {
        throw new Error("We couldn't download your cover letter. Please try again.")
      }
      const contentType = pdfResponse.headers.get('content-type') || ''
      if (!contentType.includes('application/pdf')) {
        throw new Error("We couldn't download your cover letter. Please try again.")
      }
      const blob = await pdfResponse.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      const name = coverLetter.cover_letter_data?.candidateName || 'Cover_Letter'
      const jobTitle = coverLetter.job_title || 'Application'
      a.download = `${name.replace(/\s+/g, '_')}_Cover_Letter_${jobTitle.replace(/\s+/g, '_')}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(blobUrl)
    } catch (error) {
      setErrorToast(error.message)
    } finally {
      setIsDownloading(false)
    }
  }

  const handlePreview = async () => {
    setIsLoadingPreview(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const templateForApi = selectedTemplate.charAt(0).toUpperCase() + selectedTemplate.slice(1)
      const { data: { session: prevSession } } = await supabase.auth.getSession()
      const response = await fetch('/api/generate-cover-letter-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${prevSession.access_token}` },
        body: JSON.stringify({
          coverLetterData: coverLetter.cover_letter_data,
          templateName: templateForApi,
          fontSize: selectedSize,
          font: selectedFont,
          spacing: selectedSpacing,
          action: 'preview',
          userId: user.id
        })
      })
      if (!response.ok) {
        throw new Error("We couldn't load the preview. Please try again.")
      }
      const contentType = response.headers.get('content-type') || ''
      if (!contentType.includes('application/pdf')) {
        throw new Error("We couldn't load the preview. Please try again.")
      }
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      setPreviewUrl(url)
      setShowPreview(true)
    } catch (e) {
      console.error('Preview error:', e)
      setErrorToast(e.message)
    } finally {
      setIsLoadingPreview(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

 if (!coverLetter) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-gray-600">We couldn't load your cover letter.</p>
        <div className="flex gap-2">
          <button
            onClick={() => { setLoading(true); loadCoverLetter() }}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-white hover:opacity-90 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
          >
            Try again
          </button>
          <button
            onClick={() => router.push('/resume-coach')}
            className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
          >
            Back to Resume Coach
          </button>
        </div>
      </div>
    )
  }

  const clData = coverLetter.cover_letter_data || {}

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <MainNav
        currentPage="resume-coach"
        userProfile={userProfile}
        onBeforeNavigate={(path) => { if (hasUnsavedChanges) { setUnsavedNavTarget(path); return true } return false }}
      />
      <Breadcrumb items={[
        { label: 'Resume Coach', path: '/resume-coach' },
        {
          label: coverLetterLabel(coverLetter),
          options: siblingCoverLetters
            .filter(cl => cl.id !== coverLetter.id)
            .map(cl => ({ label: coverLetterLabel(cl), path: `/cover-letter/${cl.id}` }))
        },
        {
          label: 'Cover Letter',
          options: coverLetter.linked_resume_id
            ? [{ label: 'Resume', path: `/resume/${coverLetter.linked_resume_id}` }]
            : []
        }
      ]} />

      {/* Mobile Toolbar */}
      <div className="md:hidden bg-white border-b border-gray-200 flex-shrink-0">
        {/* Instruction banner */}
        {showEditorTip && (
          <div className="bg-purple-50 border-b border-purple-100 px-3 py-1.5 flex items-center justify-between">
            <p className="text-xs text-purple-700 text-center">
              {(userProfile?.subscription_tier || 'free') !== 'free'
                ? '✏️ Tap any section to edit · 📄 Fonts & Templates · ⚙️ Undo, Save & Download · ⚡ Add or Change · ▲▼ Reorder'
                : '✏️ Tap any section to edit · 📄 Format for templates and fonts · ⚙️ Actions to save or undo'
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
          {/* Improve — Pro users only */}
          {(userProfile?.subscription_tier || 'free') !== 'free' && (
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
          {/* Download */}
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="flex-1 py-1 rounded text-xs font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
          >
            {isDownloading ? <div className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div> : '⬇️Download'}
          </button>
        </div>

        {/* bulletSelectMode banner */}
        {bulletSelectMode && (
          <div className="bg-purple-100 border-b border-purple-200 px-3 py-2 flex items-center justify-between">
            <p className="text-xs text-purple-800 font-medium">⚡ Tap the sentence you want to change</p>
            <button onClick={() => setBulletSelectMode(null)} className="text-purple-500 hover:text-purple-700 text-sm font-medium">Cancel</button>
          </div>
        )}

        {/* Format panel */}
        {mobileToolbar === 'format' && (
          <div className="px-4 pb-3 grid grid-cols-2 gap-2 pt-2">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-gray-500 uppercase tracking-wide">Template</label>
              <select
                value={selectedTemplate}
                onChange={(e) => {
                  const t = e.target.value
                  setSelectedTemplate(t)
                  setSelectedFont(templateFonts[t] || 'Lato')
                  setHasUnsavedChanges(true)
                }}
                className="border border-gray-300 rounded px-2 py-1.5 text-xs bg-white"
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
              <label className="text-[10px] text-gray-500 uppercase tracking-wide">Font</label>
              <select
                value={selectedFont}
                onChange={(e) => { setSelectedFont(e.target.value); setHasUnsavedChanges(true) }}
                className="border border-gray-300 rounded px-2 py-1.5 text-xs bg-white"
              >
                <option value="EB Garamond">EB Garamond</option>
                <option value="Lato">Lato</option>
                <option value="Open Sans">Open Sans</option>
                <option value="Source Serif 4">Source Serif 4</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-gray-500 uppercase tracking-wide">Size</label>
              <select
                value={selectedSize}
                onChange={(e) => { setSelectedSize(Number(e.target.value)); setHasUnsavedChanges(true) }}
                className="border border-gray-300 rounded px-2 py-1.5 text-xs bg-white"
              >
                {[10, 11, 12].map(s => <option key={s} value={s}>{s}pt</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-gray-500 uppercase tracking-wide">Accent</label>
              <div className="flex items-center gap-1 flex-wrap">
                {['#5b4fcf','#1e3a5f','#7a1e3a','#1e6b6b','#1e5f3a','#8b3a1e','#2d2d2d','#2d4a6b'].map(c => (
                  <button
                    key={c}
                    onClick={() => setAccentColor(c)}
                    style={{
                      width: '20px', height: '20px', borderRadius: '4px', background: c,
                      border: accentColor === c ? '2px solid #1a1a1a' : '2px solid #e5e7eb',
                      flexShrink: 0
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="col-span-2">
              <button
                onClick={handleAutoFit}
                disabled={isAutoFitting}
                className={`w-full py-1.5 border rounded text-xs font-medium transition-colors ${
                  isAutoFitting ? 'opacity-50 cursor-not-allowed border-gray-300' :
                  resumeExceedsPage ? 'border-amber-400 bg-amber-50 text-amber-700' :
                  'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {isAutoFitting ? 'Fitting...' : '⚡ Auto-fit'}
              </button>
            </div>
          </div>
        )}

        {/* Actions panel */}
        {mobileToolbar === 'actions' && (
          <div className="px-4 pt-2 pb-3">
            <div className="grid grid-cols-3 gap-1.5">
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
                onClick={handlePreview}
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

        {/* Improve panel */}
        {mobileToolbar === 'improve' && (
          <div className="px-4 pt-2 pb-3">
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => { setBulletSelectMode(true); setMobileToolbar(null) }}
                className="py-1.5 border border-purple-300 rounded text-[12px] font-semibold text-purple-600 bg-white hover:bg-purple-50"
              >
                ✏️ Reword or Fix
              </button>
              <button
                onClick={() => { setReviseModalState({ mode: 'add' }); setMobileToolbar(null) }}
                className="py-1.5 border border-purple-300 rounded text-[12px] font-semibold text-purple-600 bg-white hover:bg-purple-50"
              >
                ✨ Add More
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="hidden md:block bg-white border-b border-gray-200 sticky top-[80px] z-30 overflow-visible">
        <div className="px-6 pt-4 pb-2 max-w-7xl mx-auto w-full overflow-visible">
          <div className="flex items-center gap-2 text-xs overflow-visible flex-nowrap">

            {/* Template */}
            <div className="flex items-center gap-1 border border-gray-300 px-2 py-1 rounded hover:bg-gray-50">
              <span>📄</span>
              <select
                value={userChangedTemplate ? selectedTemplate : ''}
                onChange={(e) => {
                  const t = e.target.value
                  setSelectedTemplate(t)
                  setUserChangedTemplate(true)
                  setSelectedFont(templateFonts[t] || 'Lato')
                  setHasUnsavedChanges(true)
                }}
                className="bg-transparent border-none text-xs focus:outline-none cursor-pointer max-w-[90px]"
              >
                <option value="" disabled>Template</option>
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
                value={userChangedFont ? selectedFont : ''}
                onChange={(e) => { setSelectedFont(e.target.value); setUserChangedFont(true); setHasUnsavedChanges(true) }}
                className="bg-transparent border-none text-xs focus:outline-none cursor-pointer max-w-[70px]"
              >
                <option value="" disabled>Font</option>
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
                {[10, 11, 12].map(size => <option key={size} value={size}>{size}pt</option>)}
              </select>
            </div>

            {/* Zoom */}
            <div className="relative group/zoom">
              <button className="px-2 py-1 border border-gray-300 rounded text-xs hover:bg-gray-50 flex items-center gap-1">
                🔍 <span>{zoom}%</span>
              </button>
              <div className="absolute left-0 top-full mt-1 z-50 hidden group-hover/zoom:block bg-white border border-gray-200 rounded shadow-lg py-1 min-w-[80px]">
                {[75, 100, 125, 150].map(z => (
                  <button key={z} onClick={() => setZoom(z)} className={`w-full text-left px-3 py-1 text-xs hover:bg-purple-50 ${zoom === z ? 'text-purple-600 font-semibold' : 'text-gray-700'}`}>{z}%</button>
                ))}
              </div>
            </div>

            {/* Color picker */}
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
                        onClick={() => setAccentColor(c)}
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
                {isAutoFitting && <div className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>}
                {isAutoFitting ? 'Fitting...' : '⚡ Auto-fit'}
              </button>
              <div className="absolute left-0 top-full mt-1 z-50 hidden group-hover/autofit:block w-56 bg-gray-800 text-white text-xs rounded px-2 py-1.5 shadow-lg pointer-events-none">
                Automatically adjusts font size and spacing to best fill one page.
              </div>
            </div>

            {/* Preview */}
            <div className="relative group/preview">
              <button
                onClick={handlePreview}
                disabled={isLoadingPreview}
                className={`px-3 py-1 border border-gray-300 rounded text-xs flex items-center justify-center gap-1 w-20 ${isLoadingPreview ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
              >
                {isLoadingPreview && <div className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>}
                {isLoadingPreview ? 'Loading...' : 'Preview'}
              </button>
            </div>

            {/* Undo */}
            <button
              onClick={undo}
              disabled={historyIndex <= 0}
              className="px-3 py-1 border border-gray-300 rounded text-xs hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ↶ Undo
            </button>

            {/* Save */}
            <button
              onClick={save}
              className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                saveSuccess ? 'bg-green-600 text-white'
                : hasUnsavedChanges ? `bg-purple-600 text-white hover:bg-purple-700 ${saveToastCount >= 3 ? 'animate-pulse' : ''}`
                : 'bg-gray-300 text-gray-600'
              }`}
            >
              {saveSuccess ? '✓ Saved!' : hasUnsavedChanges ? '💾 Save' : 'No Changes'}
            </button>

            {/* Download */}
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className={`px-3 py-1 rounded text-xs font-medium flex items-center justify-center gap-1 w-20 ${
                isDownloading ? 'bg-gray-400 cursor-not-allowed text-white' : 'bg-purple-600 hover:bg-purple-700 text-white'
              }`}
            >
              {isDownloading && <div className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>}
              {isDownloading ? 'Generating...' : 'Download'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden" style={{ height: 'calc(100vh - 160px)' }}>
        <div className="flex-1 flex gap-6 p-0 md:p-6 max-w-7xl mx-auto w-full">

          {/* Cover Letter Display */}
          <div ref={clPanelRef} className="flex-[3] bg-gray-100 md:bg-white md:rounded-lg md:shadow-sm md:border md:border-gray-200 overflow-y-auto relative">
            <div
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
              <CoverLetterContent
                clData={clData}
                onUpdate={updateCoverLetterData}
                selectedTemplate={selectedTemplate}
                selectedFont={selectedFont}
                selectedSize={selectedSize}
                onBulletAction={(userProfile?.subscription_tier || 'free') !== 'free'
                  ? (text, location) => { setBulletSelectMode(null); setReviseModalState({ mode: 'choose', text, location }) }
                  : null}
                bulletSelectMode={bulletSelectMode}
              />
            </div>
          </div>

          {/* Right Panel - desktop only */}
          <div className="hidden md:flex flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-y-auto flex-col px-6 pb-6 pt-6">
            <h3 className="font-semibold text-sm text-gray-900 mb-3">
              Cover Letter
            </h3>
            <p className="text-xs text-gray-500 mb-2">
              {coverLetter.job_title}{coverLetter.job_company ? ` at ${coverLetter.job_company}` : ''}
            </p>

            <div className="space-y-2">
              <div className="bg-purple-50 border-l-4 border-purple-600 p-3 rounded-r">
                <p className="text-[10px] font-bold text-purple-600 uppercase tracking-wide mb-1">How to edit</p>
                <ul className="space-y-1">
                  {[
                    { icon: '✏️', label: 'Click any section to edit text directly' },
                    { icon: '⚡', label: 'Click for help rewording or fixing any sentence' },
                    { icon: '▲▼', label: 'Use arrows to reorder bullets' },
                    { icon: '🗑️', label: 'Click the trash icon to delete content' },
                    { icon: '💾', label: 'Use the save button to save your changes' },
                  ].map(({ icon, label }) => (
                    <li key={icon} className="flex items-center gap-2 text-xs text-gray-700">
                      <span className="font-semibold text-purple-600 flex-shrink-0 w-5 text-center">{icon}</span>
                      <span>{label}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Tips</p>
                <ul className="space-y-1">
                  {[
                    'Keep the opening focused on what you bring to them, not what you want from them.',
                    'Run Auto-fit to fit your letter on one pages.',
                    'Match the template to your resume for a cohesive application package.',
                  ].map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                      <span className="text-purple-400 flex-shrink-0 mt-0.5">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-2 border-t border-gray-100">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-2">When you're done</p>
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2 items-stretch">
                    {(userProfile?.subscription_tier || 'free') !== 'free' && (
                      <button
                        onClick={() => setReviseModalState({ mode: 'add' })}
                        className="flex-shrink-0 bg-white text-purple-600 border border-purple-300 rounded-lg py-2 px-3 text-xs font-semibold hover:bg-purple-50 transition-colors whitespace-nowrap"
                      >
                        ⚡ Add More
                      </button>
                    )}
                    <button
                      onClick={handleDownload}
                      disabled={isDownloading}
                      className="flex-1 text-white rounded-lg py-2 px-4 text-xs font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                      style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
                    >
                      {isDownloading && <div className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>}
                      {isDownloading ? 'Generating...' : 'Download PDF'}
                    </button>
                  </div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mt-3 mb-1">Next Steps</p>
                 <div className="flex gap-2">
                    <button
                      onClick={() => safeNavigate('/resume-coach')}
                      className="flex-1 bg-white text-purple-600 border border-purple-300 rounded-lg py-2 px-3 text-xs font-semibold hover:bg-purple-50 transition-colors"
                    >
                      ← Resume Coach
                    </button>
                    <button
                      onClick={() => safeNavigate('/job-tracker')}
                      className="flex-1 bg-white text-purple-600 border border-purple-300 rounded-lg py-2 px-3 text-xs font-semibold hover:bg-purple-50 transition-colors"
                    >
                      Job Tracker →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 md:p-8" style={{ backgroundColor: 'rgba(255,255,255,0.85)' }}>
          <div
            className="relative rounded-lg shadow-2xl overflow-hidden bg-white"
            style={{ height: '90vh', width: 'calc(90vh * 8.5 / 11)', maxWidth: '95vw' }}
          >
            <button
              onClick={() => { setShowPreview(false); if (previewUrl) window.URL.revokeObjectURL(previewUrl); setPreviewUrl(null) }}
              className="absolute top-2 right-2 z-10 w-7 h-7 flex items-center justify-center rounded-full text-gray-600 hover:text-gray-900 text-xl leading-none font-light"
              style={{ background: 'rgba(255,255,255,0.9)', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }}
            >×</button>
            {previewUrl && <PDFViewer url={previewUrl} />}
          </div>
        </div>
      )}

      <ErrorToast message={errorToast} onClose={() => setErrorToast(null)} />
      <SuccessToast message={saveToast} onClose={() => setSaveToast(null)} />

      {reviseModalState && (
        <CoachReviseModal
          state={reviseModalState}
          onClose={() => { setReviseModalState(null); setBulletSelectMode(null) }}
          resumeData={coverLetter.cover_letter_data}
          coachingMessages={[]}
          careerContext={null}
          supabase={supabase}
          resumeId={params.id}
          setResume={() => {}}
          onUpdate={updateCoverLetterData}
          documentLabel="Cover Letter"
          isCoverLetter={true}
          onApplyChange={(newText, location) => {
            const newData = { ...(coverLetter.cover_letter_data || {}) }
            if (location.type === 'bullet') {
              const bullets = [...(newData.bullets || [])]
              bullets[location.bulletIndex] = newText
              newData.bullets = bullets
            } else if (location.type === 'opening') {
              newData.opening = newText
            } else if (location.type === 'closing') {
              newData.closing = newText
            }
            updateCoverLetterData(newData)
            supabase.from('cover_letters').update({ cover_letter_data: newData, updated_at: new Date().toISOString() }).eq('id', params.id)
          }}
          onApplyAdd={(result) => {
            const newData = { ...(coverLetter.cover_letter_data || {}) }
            const content = result.content
            if (content) {
              if (result.section === 'opening') {
                newData.opening = content
              } else if (result.section === 'closing') {
                newData.closing = content
              } else {
                newData.bullets = [...(newData.bullets || []), content]
              }
            }
            updateCoverLetterData(newData)
            supabase.from('cover_letters').update({ cover_letter_data: newData, updated_at: new Date().toISOString() }).eq('id', params.id)
          }}
          onShowUpgrade={() => setShowUpgradeModal(true)}
        />
      )}

      {/* Too Long Modal */}
      {showTooLongModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowTooLongModal(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-xl shadow-2xl overflow-hidden"
            style={{ width: '364px' }}
          >
            <div className="px-6 py-6 relative" style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)' }}>
              <button onClick={() => setShowTooLongModal(false)} className="absolute top-3 right-4 text-white hover:opacity-70 text-2xl leading-none font-light">×</button>
              <div className="flex flex-col items-center text-center gap-2">
                <img src="/images/Hire_Power_icon.png" alt="Hire Power" className="h-16 w-auto mb-1" />
                <h2 className="text-xl font-bold text-white leading-tight">Cover Letter Too Long</h2>
                <p className="text-purple-100" style={{ fontSize: '14px' }}>Auto-fit couldn't fit everything onto one page.</p>
              </div>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-gray-700 mb-3 leading-snug">Your resume has more content than can fit on one page, even at the smallest font size.</p>
              <div className="bg-purple-50 border-l-4 border-purple-600 p-2.5 rounded-r mb-4">
                <p className="text-sm text-gray-800 leading-snug">Try removing older jobs, trimming bullets to your most impactful ones, or shortening your summary.</p>
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

      {/* Unsaved changes navigation warning */}
      {unsavedNavTarget && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-xl shadow-2xl overflow-hidden" style={{ width: '364px' }}>
            <div className="px-6 py-4" style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}>
              <h2 className="text-base font-bold text-white">Unsaved Changes</h2>
              <p className="text-purple-100 text-xs mt-0.5">You have edits that haven't been saved yet.</p>
            </div>
            <div className="px-6 py-5 flex flex-row gap-3">
              <button
                onClick={() => { setPendingNavigation(unsavedNavTarget); setUnsavedNavTarget(null); save() }}
                className="flex-1 py-2.5 rounded-lg text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
              >
                Save and Leave
              </button>
              <button
                onClick={() => { confirmedLeaveRef.current = true; window.location.href = unsavedNavTarget; setUnsavedNavTarget(null) }}
                className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors"
              >
                Leave Without Saving
              </button>
            </div>
          </div>
        </div>
      )}

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
      />
    </div>
  )
}