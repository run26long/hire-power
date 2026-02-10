'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import ModernTemplate from '@/app/templates/ModernTemplate'
import ClassicTemplate from '@/app/templates/ClassicTemplate'
import ProfessionalTemplate from '@/app/templates/ProfessionalTemplate'
import JessicaTemplate from '@/app/templates/JessicaTemplate'
import JimTemplate from '@/app/templates/JimTemplate'
import Header from '../components/Header'

export default function ChooseTemplate() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [resumeData, setResumeData] = useState(null)
  const [resumeId, setResumeId] = useState(null)
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [fontSize, setFontSize] = useState('medium') // small=9pt, medium=10pt, large=11pt
  const [pageCount, setPageCount] = useState(1)
  const [downloading, setDownloading] = useState(false)
  const templateRef = useRef(null)
  const supabase = createClient()

  const [versionId, setVersionId] = useState(null)
  const [isJobVersion, setIsJobVersion] = useState(false)

  useEffect(() => {
    // Get versionId from URL query params
    const params = new URLSearchParams(window.location.search)
    const vId = params.get('versionId')
    if (vId) {
      setVersionId(vId)
      setIsJobVersion(true)
    }
    loadResume(vId)
  }, [])

  useEffect(() => {
    if (templateRef.current && selectedTemplate) {
      setTimeout(() => {
        const pages = templateRef.current.querySelectorAll('[data-page]')
        setPageCount(pages.length)
      }, 100)
    }
  }, [selectedTemplate, fontSize])

  async function loadResume(vId) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      if (vId) {
        // Load job-specific version
        const { data, error } = await supabase
          .from('resume_versions')
          .select('*')
          .eq('id', vId)
          .eq('user_id', user.id)
          .single()

        if (error) throw error

        setResumeData(data.customized_resume_data)
        setResumeId(data.resume_id)
        setVersionId(vId)
        setIsJobVersion(true)
      } else {
        // Load core resume
        const { data, error } = await supabase
          .from('resumes')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (error) throw error

        setResumeData(data.resume_data)
        setResumeId(data.id)
        setIsJobVersion(false)
      }

      setLoading(false)
    } catch (error) {
      console.error('Error loading resume:', error)
      setLoading(false)
    }
  }

 async function downloadPDF() {
    if (!selectedTemplate) return

    setDownloading(true)
    
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resumeData,
          templateName: selectedTemplate,
          fontSize,
          action: 'download',
          versionId: isJobVersion ? versionId : null,
          isJobVersion,
          userId: user.id
        })
      })

      if (!response.ok) {
        throw new Error('PDF generation failed')
      }

      const result = await response.json()
      
     // Trigger download only (no new tab)
      const a = document.createElement('a')
      a.href = result.pdfUrl
      a.download = `${resumeData.contact.fullName.replace(/\s+/g, '_')}_Resume.pdf`
      a.target = '_blank'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)

      // Small delay then redirect
      setTimeout(() => {
        router.push('/my-resumes')
      }, 500)

    } catch (error) {
      console.error('Error downloading PDF:', error)
      alert('Failed to generate PDF. Please try again.')
    } finally {
      setDownloading(false)
    }
  }
  const templates = [
    {
      name: 'Modern',
      component: ModernTemplate,
      description: 'Purple accent, creative layout - perfect for tech and creative fields',
      preview: '🎨'
    },
    {
      name: 'Classic',
      component: ClassicTemplate,
      description: 'Ultra-clean, traditional - maximum ATS compatibility',
      preview: '📄'
    },
    {
      name: 'Professional',
      component: ProfessionalTemplate,
      description: 'Two-column, elegant border - great for established professionals',
      preview: '💼'
    },
    {
      name: 'Jessica',
      component: JessicaTemplate,
      description: 'Clean two-column, professional - perfect for technical and corporate roles',
      preview: '📋'
    },
    {
      name: 'Jim',
      component: JimTemplate,
      description: 'Traditional single-column, multi-page - perfect for experienced professionals',
      preview: '📑'
    }
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  if (!resumeData) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <h1 className="text-3xl font-bold mb-4">Choose Template</h1>
        <p className="text-gray-600">Complete coaching first to choose a template.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <Header />

      <div className="max-w-7xl mx-auto p-8">
        {!selectedTemplate ? (
          <>
            {/* Template Selection */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2">Choose Your Template</h1>
              <p className="text-gray-600">Select a design that matches your industry and style</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {templates.map((template, index) => (
                <div
                  key={index}
                  onClick={() => setSelectedTemplate(template.name)}
                  className="bg-white rounded-lg shadow-lg p-6 cursor-pointer hover:shadow-xl transition-shadow border-2 border-transparent hover:border-purple-600"
                >
                  <div className="text-6xl text-center mb-4">{template.preview}</div>
                  <h3 className="text-xl font-bold mb-2 text-center">{template.name}</h3>
                  <p className="text-sm text-gray-600 text-center mb-4">{template.description}</p>
                  <button className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition-colors font-medium">
                    Preview & Download
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Template Preview */}
            <div className="mb-6 flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold mb-2">{selectedTemplate} Template</h1>
                <p className="text-gray-600">Preview your resume and download when ready</p>
              </div>
              <button
                onClick={() => setSelectedTemplate(null)}
                className="border-2 border-purple-600 text-purple-600 px-4 py-2 rounded-lg hover:bg-purple-50 font-medium"
              >
                ← Choose Different Template
              </button>
            </div>

            {/* Controls */}
            <div className="mb-6 bg-white rounded-lg shadow-sm p-5 border border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-gray-700">Font Size:</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setFontSize('small')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        fontSize === 'small'
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                      }`}
                    >
                      Compact (9pt)
                    </button>
                    <button
                      onClick={() => setFontSize('medium')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        fontSize === 'medium'
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                      }`}
                    >
                      Standard (10pt)
                    </button>
                    <button
                      onClick={() => setFontSize('large')}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        fontSize === 'large'
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                      }`}
                    >
                      Readable (11pt)
                    </button>
                  </div>
                </div>
                <div className={`px-4 py-2 rounded-lg font-medium text-sm ${
                  pageCount > 1 ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-green-50 text-green-700 border border-green-200'
                }`}>
                  {pageCount} {pageCount === 1 ? 'page' : 'pages'}
                </div>
              </div>
            </div>

            {/* Page Length Tip */}
            {pageCount > 1 && (
              <div className="mb-6 bg-gradient-to-r from-purple-50 to-purple-100 border-l-4 border-purple-600 rounded-lg p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-lg">💡</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-purple-900 text-sm mb-1">Multi-Page Resume</h3>
                    <p className="text-xs text-purple-700 leading-relaxed">
                      Your resume is currently {pageCount} pages. Try "Compact" font size to condense content, or keep it as-is if you prefer more readable spacing.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Template Container */}
            <div ref={templateRef} className="mb-6 flex justify-center flex-col items-center gap-6">
              {selectedTemplate === 'Modern' && <ModernTemplate resume={resumeData} fontSize={fontSize} />}
              {selectedTemplate === 'Classic' && <ClassicTemplate resume={resumeData} fontSize={fontSize} />}
              {selectedTemplate === 'Professional' && <ProfessionalTemplate resume={resumeData} fontSize={fontSize} />}
              {selectedTemplate === 'Jessica' && <JessicaTemplate resume={resumeData} fontSize={fontSize} />}
              {selectedTemplate === 'Jim' && <JimTemplate resume={resumeData} fontSize={fontSize} />}
            </div>

            <div className="flex justify-center">
              <button
                onClick={downloadPDF}
                disabled={downloading}
                className={`px-8 py-3 rounded-lg font-medium text-lg shadow-md hover:shadow-lg transition-all ${
                  downloading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {downloading ? '⏳ Generating PDF...' : '📥 Download as PDF'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}