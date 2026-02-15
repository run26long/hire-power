'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import Header from '../components/Header'

export default function ResumeUploadPage() {
  const [uploading, setUploading] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [message, setMessage] = useState('')
  const [checkingLimit, setCheckingLimit] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  // === INSERT THIS ENTIRE BLOCK ===
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
  // === END INSERT ===

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setUploading(true)
    setMessage('')

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        setMessage('Please log in to upload')
        setUploading(false)
        return
      }

      // Create unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/${Date.now()}.${fileExt}`

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('resumes')
        .upload(fileName, file)

      if (error) throw error

      setMessage('✅ Resume uploaded! Extracting text...')
      setParsing(true)

      // Parse the PDF
      const response = await fetch('/api/parse-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: fileName })
      })

      const parseResult = await response.json()

      if (!response.ok) throw new Error(parseResult.error)

     // Save to database
      const { data: resumeData, error: dbError } = await supabase
        .from('resumes')
        .insert({
          user_id: user.id,
          parsed_text: parseResult.text,
          file_path: fileName,
          created_via: 'upload'
        })
        .select()
        .single()

      if (dbError) throw dbError

 // Navigate immediately to structure page
      router.push(`/structure-resume/${resumeData.id}`)
      
    } catch (error) {
  console.error('=== UPLOAD ERROR ===')
  console.error('Error type:', typeof error)
  console.error('Error message:', error?.message)
  console.error('Error details:', error?.details)
  console.error('Full error:', JSON.stringify(error, null, 2))
  setMessage('❌ Error: ' + (error?.message || 'Unknown error'))
} finally {
      setUploading(false)
      // Don't clear parsing here - let it stay visible during navigation
      // setParsing(false) - removed so spinner stays until next page loads
    }
  }
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
return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="max-w-2xl w-full bg-white rounded-lg shadow p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            📤 Upload Your Resume
          </h2>
          <p className="text-gray-600 mb-8">
            Upload your existing resume and we'll extract the content to start coaching
          </p>

          {message && (
            <div className={`mb-6 p-4 rounded ${
              message.includes('✅') 
                ? 'bg-green-50 text-green-700' 
                : 'bg-red-50 text-red-700'
            }`}>
              {message}
            </div>
          )}

          {/* LOADING STATE - Show when uploading or parsing */}
          {(uploading || parsing) && (
            <div className="border-2 border-purple-200 bg-purple-50 rounded-lg p-12 text-center mb-6">
              {/* Animated spinner */}
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
              </div>
              
              <p className="text-lg font-semibold text-gray-900 mb-2">
                {uploading && !parsing && '📤 Uploading your resume...'}
                {parsing && '⚙️ Extracting text from your resume...'}
              </p>
              <p className="text-sm text-gray-600">
                {uploading && !parsing && 'This will just take a moment'}
                {parsing && 'Analyzing your document...'}
              </p>
            </div>
          )}

          {/* UPLOAD BUTTON - Show when NOT loading */}
          {!uploading && !parsing && (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-purple-400 transition-colors">
              <input
                type="file"
                accept=".pdf,.docx"
                onChange={handleFileUpload}
                className="hidden"
                id="resume-upload"
              />
              <label
                htmlFor="resume-upload"
                className="cursor-pointer inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700"
              >
                📄 Choose File
              </label>
              <p className="mt-4 text-sm font-medium text-gray-700">
                Accepts: PDF or DOCX files (up to 10MB)
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}