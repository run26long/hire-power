'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function ResumeUploadPage() {
  const [uploading, setUploading] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()
  const supabase = createClient()

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
      const { error: dbError } = await supabase
        .from('resumes')
        .insert({
          user_id: user.id,
          parsed_text: parseResult.text,
          file_path: fileName,
          created_via: 'upload'
        })

      if (dbError) throw dbError

      setMessage('✅ Resume uploaded and saved!')
      
      // Navigate to pre-coaching confirmation
      setTimeout(() => {
        router.push('/pre-coaching-confirmation')
      }, 1500)
      
    } catch (error) {
  console.error('=== UPLOAD ERROR ===')
  console.error('Error type:', typeof error)
  console.error('Error message:', error?.message)
  console.error('Error details:', error?.details)
  console.error('Full error:', JSON.stringify(error, null, 2))
  setMessage('❌ Error: ' + (error?.message || 'Unknown error'))
} finally {
  setUploading(false)
  setParsing(false)
}
  }

  return (
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

        <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
          <input
            type="file"
            accept=".pdf,.docx"
            onChange={handleFileUpload}
            disabled={uploading || parsing}
            className="hidden"
            id="resume-upload"
          />
          <label
            htmlFor="resume-upload"
            className={`cursor-pointer inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 ${
              (uploading || parsing) ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {uploading ? '📤 Uploading...' : parsing ? '⚙️ Processing...' : '📄 Choose File'}
          </label>
          <p className="mt-4 text-sm text-gray-500">
            PDF or DOCX files up to 10MB
          </p>
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/resume-start')}
            className="text-gray-500 hover:text-gray-700 text-sm"
          >
            ← Back to options
          </button>
        </div>
      </div>
    </div>
  )
}