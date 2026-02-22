'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import Header from '../components/Header'

export default function ResumeUploadPage() {
  const [uploading, setUploading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [message, setMessage] = useState('')
  const [checkingLimit, setCheckingLimit] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  // Check resume limit on mount
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

      // Block Vault users - they can't create new resumes
      if (tier === 'vault') {
        router.push('/pricing')
        return
      }

      // Check resume limit for free users
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

      // Step 1: Upload to Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('resumes')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      setMessage('✅ Resume uploaded! Extracting text...')

      // Step 2: Parse PDF/DOCX
      const parseResponse = await fetch('/api/parse-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: fileName })
      })

      const parseResult = await parseResponse.json()
      if (!parseResponse.ok) throw new Error(parseResult.error)

      setMessage('✅ Text extracted! Structuring your resume...')
      setUploading(false)
      setExtracting(true)

      // Step 3: Extract Structure with AI
      const extractResponse = await fetch('/api/extract-resume-structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parsedText: parseResult.text })
      })

      const extractResult = await extractResponse.json()
      if (!extractResponse.ok) throw new Error(extractResult.error)

      setMessage('✅ Resume structured! Saving...')

      // Step 4: Save to Database with BOTH parsed_text AND resume_data
      const { data: resumeData, error: dbError } = await supabase
        .from('resumes')
        .insert({
          user_id: user.id,
          parsed_text: parseResult.text,
          resume_data: extractResult.data,
          file_path: fileName,
          created_via: 'upload',
          journey_step: 'review',  // Start at review step
          display_name: 'Core Resume'
        })
        .select()
        .single()

      if (dbError) throw dbError

      // Step 5: Navigate to Resume Detail Page
      router.push(`/resume/${resumeData.id}`)
      
    } catch (error) {
      console.error('Upload error:', error)
      setMessage('❌ Error: ' + (error?.message || 'Unknown error'))
      setUploading(false)
      setExtracting(false)
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
              message.includes('❌') 
                ? 'bg-red-50 text-red-700'
                : 'bg-green-50 text-green-700'
            }`}>
              {message}
            </div>
          )}

          {/* Loading State */}
          {(uploading || extracting) && (
            <div className="border-2 border-purple-200 bg-purple-50 rounded-lg p-12 text-center mb-6">
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
              </div>
              
              <p className="text-lg font-semibold text-gray-900 mb-2">
                {uploading && '📤 Uploading and parsing your resume...'}
                {extracting && '🤖 AI is structuring your resume...'}
              </p>
              <p className="text-sm text-gray-600">
                This takes about 10-15 seconds
              </p>
            </div>
          )}

          {/* Upload Button */}
          {!uploading && !extracting && (
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
                Accepts: PDF or DOCX (up to 10MB)
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}