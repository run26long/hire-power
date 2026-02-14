'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Header from '../components/Header'

export default function ResumeStart() {
  const router = useRouter()

  // Check for in-progress builder and auto-redirect
  useEffect(() => {
    const saved = localStorage.getItem('resumeBuilderProgress')
    if (saved) {
      try {
        const { formData } = JSON.parse(saved)
        // Check if there's actual data (not just empty fields)
        const hasData = formData.fullName || formData.email || 
                       formData.experience.length > 0 || 
                       formData.education.length > 0
        if (hasData) {
          router.push('/resume-builder')
          return
        }
      } catch (error) {
        // Continue to show choices if localStorage is corrupted
      }
    }
  }, [router])

  return (
    <>
      <Header />
      <div className="max-w-2xl mx-auto p-8 min-h-screen flex flex-col justify-center">
        <h1 className="text-3xl font-bold mb-2">Let's build your career-ready resume</h1>
        <p className="text-gray-600 mb-8">How would you like to start?</p>

        {/* Upload Option */}
        <div 
          onClick={() => router.push('/resume-upload')}
          className="border-2 border-gray-200 rounded-lg p-6 mb-4 cursor-pointer hover:border-purple-500 transition-colors"
        >
          <div className="flex items-center mb-2">
            <span className="text-2xl mr-3">📤</span>
            <h3 className="text-xl font-semibold">Upload Existing Resume</h3>
          </div>
          <p className="text-gray-600 ml-11">I have a resume ready (PDF, DOCX)</p>
        </div>

        {/* Build from Scratch Option */}
        <div 
          onClick={() => router.push('/resume-builder')}
          className="border-2 border-gray-200 rounded-lg p-6 cursor-pointer hover:border-purple-500 transition-colors"
        >
          <div className="flex items-center mb-2">
            <span className="text-2xl mr-3">✏️</span>
            <h3 className="text-xl font-semibold">Build from Scratch</h3>
          </div>
          <p className="text-gray-600 ml-11">I need to create a resume from the ground up</p>
        </div>
      </div>
    </>
  )
}