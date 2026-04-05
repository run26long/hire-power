'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import MainNav from '@/app/components/MainNav'
import Breadcrumb from '@/app/components/Breadcrumb'
import CoverLetterContent from '@/app/components/CoverLetterContent'

export default function CoverLetterPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()

  const [coverLetter, setCoverLetter] = useState(null)
  const [loading, setLoading] = useState(true)
  const [userProfile, setUserProfile] = useState(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
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
  const [selectedSize, setSelectedSize] = useState(11)
  const [selectedSpacing, setSelectedSpacing] = useState(1)
  const [zoom, setZoom] = useState(100)
  const [accentColor, setAccentColor] = useState('#5b4fcf')
  const [resumeExceedsPage, setResumeExceedsPage] = useState(false)

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
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Check if any card (including archived) already has this cover letter linked
    const { data: existingCards } = await supabase
      .from('applications')
      .select('id')
      .eq('cover_letter_id', coverLetter.id)
      .eq('user_id', user.id)
      .limit(1)

    if (existingCards?.[0]) return // already linked, nothing to do

    // Check if a card exists for the linked JS resume (only if it's job-specific)
    if (coverLetter.linked_resume_id) {
      const { data: linkedResume } = await supabase
        .from('resumes')
        .select('id, resume_type')
        .eq('id', coverLetter.linked_resume_id)
        .single()

      const isJobSpecific = linkedResume?.resume_type === 'job_specific'

      if (isJobSpecific) {
        const { data: resumeCards } = await supabase
          .from('applications')
          .select('id')
          .eq('resume_id', coverLetter.linked_resume_id)
          .eq('user_id', user.id)
          .limit(1)

        const resumeCard = resumeCards?.[0] || null

        if (resumeCard) {
          await supabase
            .from('applications')
            .update({ cover_letter_id: coverLetter.id })
            .eq('id', resumeCard.id)
          return
        }
      }
    }

    // No existing card — create one (never link a core resume to a job card)
    await supabase
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
  }

  async function loadCoverLetter() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/resume-coach'); return }

    const { data, error } = await supabase
      .from('cover_letters')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (error) { router.push('/resume-coach'); return }

    setCoverLetter(data)
    const loadedTemplate = data.template_id || 'current'
    setSelectedTemplate(loadedTemplate)
    setSelectedFont(data.font_family || templateFonts[loadedTemplate] || 'Lato')
    setSelectedSize(data.font_size || 11)
    setSelectedSpacing(data.spacing || 1)
    setLoading(false)
  }

  async function loadUserProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setUserProfile(data)
  }

  function updateCoverLetterData(newData) {
    setCoverLetter(prev => ({ ...prev, cover_letter_data: newData }))
    setHasUnsavedChanges(true)
  }

  async function save(overrides = {}) {
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

    if (error) { console.error('Save error:', error); return }
    setHasUnsavedChanges(false)
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 2000)
  }

  const triggerPageCheck = () => {
    if (pageCheckTimerRef.current) clearTimeout(pageCheckTimerRef.current)
    pageCheckTimerRef.current = setTimeout(async () => {
      if (isAutoFitJustRanRef.current) { isAutoFitJustRanRef.current = false; return }
      try {
        const { data: { user } } = await supabase.auth.getUser()
        const templateForApi = selectedTemplate.charAt(0).toUpperCase() + selectedTemplate.slice(1)
        const response = await fetch('/api/generate-cover-letter-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
      } catch (e) { /* silent */ }
    }, 1500)
  }

  const handleAutoFit = async () => {
    setIsAutoFitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const templateForApi = selectedTemplate.charAt(0).toUpperCase() + selectedTemplate.slice(1)
      const minSize = 10
      const maxSize = 12
      let testSize = selectedSize

      const checkSize = async (size, spacing = 1) => {
        const response = await fetch('/api/generate-cover-letter-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
        if (!response.ok) throw new Error('Auto-fit check failed')
        return await response.json()
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
      alert('Auto-fit failed. Please try again.')
    } finally {
      setIsAutoFitting(false)
    }
  }

  const handleDownload = async () => {
    setIsDownloading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const templateForApi = selectedTemplate.charAt(0).toUpperCase() + selectedTemplate.slice(1)
      const response = await fetch('/api/generate-cover-letter-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      if (!response.ok) throw new Error('PDF generation failed')
      const result = await response.json()
      const pdfResponse = await fetch(result.pdfUrl)
      const blob = await pdfResponse.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      const name = coverLetter.cover_letter_data?.candidateName || 'Cover_Letter'
      const company = coverLetter.job_company || 'Application'
      a.download = `${name.replace(/\s+/g, '_')}_Cover_Letter_${company.replace(/\s+/g, '_')}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(blobUrl)
    } catch (error) {
      console.error('Download error:', error)
      alert('Failed to generate PDF. Please try again.')
    } finally {
      setIsDownloading(false)
    }
  }

  const handlePreview = async () => {
    setIsLoadingPreview(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const templateForApi = selectedTemplate.charAt(0).toUpperCase() + selectedTemplate.slice(1)
      const response = await fetch('/api/generate-cover-letter-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Cover letter not found</p>
      </div>
    )
  }

  const clData = coverLetter.cover_letter_data || {}

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <MainNav currentPage="resume-coach" userProfile={userProfile} />
      <Breadcrumb items={[
        { label: 'Resume Coach', path: '/resume-coach' },
        { label: `Cover Letter — ${coverLetter.job_title || 'Draft'}` }
      ]} />

      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 sticky top-[80px] z-30 overflow-visible">
        <div className="px-6 pt-4 pb-2 max-w-7xl mx-auto w-full overflow-visible">
          <div className="flex items-center gap-2 text-xs overflow-visible flex-nowrap">

            {/* Template */}
            <div className="flex items-center gap-1 border border-gray-300 px-2 py-1 rounded hover:bg-gray-50">
              <span>📄</span>
              <select
                value={selectedTemplate}
                onChange={(e) => {
                  const t = e.target.value
                  setSelectedTemplate(t)
                  setSelectedFont(templateFonts[t] || 'Lato')
                  setHasUnsavedChanges(true)
                }}
                className="bg-transparent border-none text-xs focus:outline-none cursor-pointer max-w-[90px]"
              >
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

            {/* Save */}
            <button
              onClick={save}
              className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                saveSuccess ? 'bg-green-600 text-white'
                : hasUnsavedChanges ? 'bg-purple-600 text-white hover:bg-purple-700'
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
        <div className="flex-1 flex gap-6 p-6 max-w-7xl mx-auto w-full">

          {/* Cover Letter Display */}
          <div className="flex-[3] bg-white rounded-lg shadow-sm border border-gray-200 overflow-y-auto relative">
            <div
              style={{
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'top left',
                width: '816px',
                position: 'relative',
                fontFamily: selectedFont,
                fontSize: `${selectedSize}pt`,
              }}
            >
              <CoverLetterContent
                clData={clData}
                onUpdate={updateCoverLetterData}
                selectedTemplate={selectedTemplate}
                selectedFont={selectedFont}
                selectedSize={selectedSize}
              />
            </div>
          </div>

          {/* Right Panel */}
          <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-y-auto px-6 pb-6 pt-6">
            <h3 className="font-semibold text-sm text-gray-900 mb-3">
              Cover Letter
            </h3>
            <p className="text-xs text-gray-500 mb-2">
              {coverLetter.job_title}{coverLetter.job_company ? ` at ${coverLetter.job_company}` : ''}
            </p>

            <div className="space-y-2">
              <div className="bg-purple-50 border-l-4 border-purple-600 p-3 rounded-r">
                <p className="text-[10px] font-bold text-purple-600 uppercase tracking-wide mb-1">How to edit</p>
                <p className="text-xs text-gray-700 leading-snug">Click any section to edit directly. Your changes save automatically when you click Save.</p>
              </div>

              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Tips</p>
                <ul className="space-y-1">
                  {[
                    'Keep the opening focused on what you bring to them, not what you want from them.',
                    'Each bullet should lead with a result or specific proof, not a category label.',
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
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-2 text-center">When you're done</p>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className="block mx-auto text-white rounded-lg py-2 px-8 text-xs font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                    style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
                  >
                    {isDownloading && <div className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>}
                    {isDownloading ? 'Generating...' : 'Download PDF'}
                  </button>
                 <div className="flex gap-2">
                    <button
                      onClick={() => router.push('/resume-coach')}
                      className="flex-1 bg-white text-purple-600 border border-purple-300 rounded-lg py-2 px-3 text-xs font-semibold hover:bg-purple-50 transition-colors"
                    >
                      ← Resume Coach
                    </button>
                    <button
                      onClick={() => router.push('/job-tracker')}
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
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-8">
          <div className="bg-white rounded-lg w-full max-w-4xl h-full max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Cover Letter Preview</h3>
              <button
                onClick={() => { setShowPreview(false); if (previewUrl) window.URL.revokeObjectURL(previewUrl); setPreviewUrl(null) }}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >×</button>
            </div>
            <div className="flex-1 overflow-hidden">
              {previewUrl && <iframe src={`${previewUrl}#toolbar=0`} className="w-full h-full" title="Cover Letter Preview" />}
            </div>
          </div>
        </div>
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
    </div>
  )
}