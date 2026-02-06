'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function DashboardPage() {
  const [uploading, setUploading] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [message, setMessage] = useState('')
  const [extractedText, setExtractedText] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setUploading(true)
    setMessage('')
    setExtractedText('')

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

      setExtractedText(parseResult.text)
      setMessage('✅ Resume uploaded and parsed successfully!')
      console.log('Extracted text:', parseResult.text)
      
    } catch (error) {
      setMessage('❌ Error: ' + error.message)
      console.error('Error:', error)
    } finally {
      setUploading(false)
      setParsing(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-xl font-bold text-purple-600">Hire Power</h1>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Log out
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Welcome to Your Dashboard
          </h2>
          <p className="text-gray-600 mb-8">
            Upload your resume to get started with AI-powered coaching
          </p>

          {message && (
            <div className={`mb-4 p-4 rounded ${
              message.includes('✅') 
                ? 'bg-green-50 text-green-700' 
                : 'bg-red-50 text-red-700'
            }`}>
              {message}
            </div>
          )}

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center mb-6">
            <input
              type="file"
              accept=".pdf"
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
              {uploading ? '📤 Uploading...' : parsing ? '⚙️ Extracting text...' : '📄 Upload Resume (PDF)'}
            </label>
            <p className="mt-2 text-sm text-gray-500">
              PDF files up to 10MB
            </p>
          </div>

          {extractedText && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Extracted Resume Text:
              </h3>
              <div className="bg-gray-50 border border-gray-200 rounded p-4 max-h-96 overflow-y-auto">
                <pre className="whitespace-pre-wrap text-sm text-gray-700">
                  {extractedText}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}