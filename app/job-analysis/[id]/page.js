'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import Header from '@/app/components/Header'

export default function JobAnalysis() {
  const router = useRouter()
  const params = useParams()
  const versionId = params.id
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [versionData, setVersionData] = useState(null)
  const [showCoaching, setShowCoaching] = useState(false)
  const [coachingMessages, setCoachingMessages] = useState([])
  const [userInput, setUserInput] = useState('')
  const [sending, setSending] = useState(false)
  const [coachingComplete, setCoachingComplete] = useState(false)
  const [optimizing, setOptimizing] = useState(false)
  const [optimizationCount, setOptimizationCount] = useState(0)
  const [updateCoreResume, setUpdateCoreResume] = useState(false)
  const [optimizationComplete, setOptimizationComplete] = useState(false)
  const [userTier, setUserTier] = useState(null)
  const chatEndRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    loadVersion()
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [coachingMessages])

  useEffect(() => {
    if (!sending && showCoaching && !coachingComplete) {
      textareaRef.current?.focus()
    }
  }, [sending, coachingMessages, showCoaching, coachingComplete])

  async function loadVersion() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      const { data, error } = await supabase
        .from('resume_versions')
        .select('*')
        .eq('id', versionId)
        .eq('user_id', user.id)
        .single()

      if (error) throw error

      setVersionData(data)
      
      // Load user tier
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', user.id)
        .single()
      
      setUserTier(profile?.subscription_tier)
      setOptimizationCount(data.optimization_count || 0)
      setOptimizationComplete(data.optimization_count > 0)
      setLoading(false)
    } catch (error) {
      console.error('Error loading version:', error)
      router.push('/my-resumes')
    }
  }

  async function startCoaching() {
    setShowCoaching(true)
    setCoachingComplete(false)
    setOptimizationComplete(false)
    
    const missingSkills = versionData.analysis?.keywordCoverage?.missing || []
    const gaps = versionData.analysis?.gaps || []
    
    let gapsText = ''
    if (missingSkills.length > 0 || gaps.length > 0) {
      gapsText = '\n\nTo optimize your match score, focus on these areas:\n'
      if (missingSkills.length > 0) {
        gapsText += `\nMissing keywords: ${missingSkills.slice(0, 5).join(', ')}`
      }
      if (gaps.length > 0) {
        gapsText += `\nGaps: ${gaps.slice(0, 3).join('; ')}`
      }
    }
    
    setCoachingMessages([{
      role: 'assistant',
      content: `I can help strengthen your match for the ${versionData.job_title} position at ${versionData.job_company}.${gapsText}\n\nDo you have experience or skills in any of these areas that aren't currently on your resume?`
    }])
  }

  async function handleSendMessage() {
    if (!userInput.trim() || sending) return

    const newMessages = [
      ...coachingMessages,
      { role: 'user', content: userInput }
    ]
    setCoachingMessages(newMessages)
    setUserInput('')
    setSending(true)

    try {
      const response = await fetch('/api/mini-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          jobDescription: versionData.job_description,
          currentResume: versionData.customized_resume_data
        })
      })

      if (!response.ok) throw new Error('Coaching failed')

      const data = await response.json()
      const assistantMessage = { role: 'assistant', content: data.response }
      const updatedMessages = [...newMessages, assistantMessage]
      setCoachingMessages(updatedMessages)
      
      // Check if Claude explicitly closes the conversation
      const lowerResponse = data.response.toLowerCase()
      
      if (
        (lowerResponse.includes('click') && lowerResponse.includes('finish')) ||
        lowerResponse.includes('ready to see your updated') ||
        (lowerResponse.includes('click') && lowerResponse.includes('re-optimize'))
      ) {
        setCoachingComplete(true)
      }
      
      setSending(false)
    } catch (error) {
      console.error('Error in coaching:', error)
      alert('Failed to get response. Please try again.')
      setSending(false)
    }
  }

  async function handleFinishCoaching() {
    if (optimizationCount >= 3) {
      alert('You\'ve reached the maximum optimization rounds. Your resume is strong - consider applying!')
      return
    }

    setOptimizing(true)

    try {
      // Extract new info from coaching conversation
      const response = await fetch('/api/extract-coaching', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation: coachingMessages,
          currentResume: versionData.customized_resume_data
        })
      })

      if (!response.ok) throw new Error('Extraction failed')

      const { updatedResume } = await response.json()

      // Re-tailor with updated resume
      const tailorResponse = await fetch('/api/tailor-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeData: updatedResume,
          jobTitle: versionData.job_title,
          company: versionData.job_company,
          jobDescription: versionData.job_description
        })
      })

      if (!tailorResponse.ok) throw new Error('Re-tailoring failed')

      const tailorResult = await tailorResponse.json()

      // Update job-specific version in database
      const { error } = await supabase
        .from('resume_versions')
        .update({
          customized_resume_data: tailorResult.customizedResume,
          match_score: tailorResult.matchScore,
          analysis: tailorResult.analysis,
          optimization_count: optimizationCount + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', versionId)

      if (error) throw error

      // If checkbox was checked, also update core resume
      if (updateCoreResume) {
        const { error: coreError } = await supabase
          .from('resumes')
          .update({
            resume_data: updatedResume,
            updated_at: new Date().toISOString()
          })
          .eq('id', versionData.resume_id)

        if (coreError) throw coreError
      }

      // Reload the page to show new results
      window.location.reload()

    } catch (error) {
      console.error('Error re-optimizing:', error)
      alert('Failed to re-optimize. Please try again.')
      setOptimizing(false)
    }
  }

 async function handleFormatAndDownload() {
    router.push(`/choose-template?versionId=${versionId}`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  const analysis = versionData.analysis
  const matchScore = versionData.match_score
  const showOptimizationPrompt = matchScore < 85 && optimizationCount < 2

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-4xl mx-auto p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Job Match Analysis</h1>
          <p className="text-gray-600">{versionData.job_title} at {versionData.job_company}</p>
        </div>

        {/* Match Score Card */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <div className="text-center mb-6">
            <div className="inline-block">
              <div className={`text-6xl font-bold ${matchScore >= 85 ? 'text-green-600' : matchScore >= 70 ? 'text-yellow-600' : 'text-orange-600'}`}>
                {matchScore}%
              </div>
              <p className="text-gray-600 mt-2">Match Score</p>
            </div>
          </div>

         {/* FREE TIER - Limited View */}
          {userTier === 'free' && (
            <>
              {/* Keyword Coverage Teaser */}
              {analysis.keywordCoverage && (
                <div className="mb-8">
                  <h3 className="font-bold text-lg mb-3">Keyword Coverage</h3>
                  <p className="text-gray-700 mb-3">
                    Keywords Matched: <span className="font-semibold">{analysis.keywordCoverage.present?.length || 0} of {(analysis.keywordCoverage.present?.length || 0) + (analysis.keywordCoverage.missing?.length || 0)}</span>
                  </p>
                  <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                    <div 
                      className="h-3 rounded-full bg-purple-600 transition-all"
                      style={{ width: `${((analysis.keywordCoverage.present?.length || 0) / ((analysis.keywordCoverage.present?.length || 0) + (analysis.keywordCoverage.missing?.length || 0))) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}

             <div className="flex gap-3">
                        <button
                          onClick={() => router.push('/my-resumes')}
                          className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 font-semibold transition-all"
                        >
                          Return to My Resumes
                        </button>
                        <button
                          onClick={() => router.push('/pricing')}
                          className="flex-1 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 font-semibold transition-all shadow-md"
                        >
                          Upgrade to Customize →
                        </button>
                      </div>
            </>
          )}

          {/* PAID TIER - Full View */}
          {userTier !== 'free' && (
            <>
              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-3 mb-8">
                <div 
                  className={`h-3 rounded-full transition-all ${matchScore >= 85 ? 'bg-green-600' : matchScore >= 70 ? 'bg-yellow-600' : 'bg-orange-600'}`}
                  style={{ width: `${matchScore}%` }}
                ></div>
              </div>

              {/* Strengths */}
              {analysis.strengths && analysis.strengths.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-bold text-lg mb-3 text-green-600">✓ Strengths</h3>
                  <ul className="space-y-2">
                    {analysis.strengths.map((strength, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-green-600 mt-1">•</span>
                        <span className="text-gray-700">{strength}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Gaps */}
              {analysis.gaps && analysis.gaps.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-bold text-lg mb-3 text-orange-600">⚠ Gaps</h3>
                  <ul className="space-y-2">
                    {analysis.gaps.map((gap, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-orange-600 mt-1">•</span>
                        <span className="text-gray-700">{gap}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Keyword Coverage */}
              {analysis.keywordCoverage && (
                <div className="border-t pt-6">
                  <h3 className="font-bold text-lg mb-3">Keyword Coverage</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-semibold text-green-600 mb-2">Present ({analysis.keywordCoverage.present?.length || 0})</p>
                      <div className="flex flex-wrap gap-2">
                        {analysis.keywordCoverage.present?.map((keyword, i) => (
                          <span key={i} className="bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs">
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-orange-600 mb-2">Missing ({analysis.keywordCoverage.missing?.length || 0})</p>
                      <div className="flex flex-wrap gap-2">
                        {analysis.keywordCoverage.missing?.map((keyword, i) => (
                          <span key={i} className="bg-orange-50 text-orange-700 px-3 py-1 rounded-full text-xs">
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Strong Match Message - Both Tiers */}
        {matchScore >= 85 && (
          <div className="bg-green-50 border-l-4 border-green-600 rounded-lg p-5 mb-6">
            <p className="text-green-800 font-medium">
              Your resume is strong for this position - consider applying!
            </p>
          </div>
        )}

        {/* Paid Tier - Coaching Prompt */}
        {userTier !== 'free' && showOptimizationPrompt && !showCoaching && !optimizationComplete && (
          <div className="bg-purple-50 border-l-4 border-purple-600 rounded-lg p-5 mb-6">
            <h3 className="font-semibold text-purple-900 mb-2">Want to strengthen your match?</h3>
            <p className="text-purple-700 text-sm mb-4">
              If you have additional relevant experience or skills not on your resume, we can add them and re-optimize.
            </p>
            <button
              onClick={startCoaching}
              className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 font-medium transition-colors"
            >
              Add More Information
            </button>
          </div>
        )}
        {/* Coaching Interface */}
        {showCoaching && !optimizing && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h3 className="font-bold text-lg mb-4">Add Information</h3>
            <div className="bg-gray-50 rounded-lg p-4 mb-4 max-h-96 overflow-y-auto">
              {coachingMessages.map((msg, i) => (
                <div key={i} className={`mb-4 ${msg.role === 'user' ? 'text-right' : ''}`}>
                  <div className={`inline-block max-w-[80%] p-3 rounded-lg ${
                    msg.role === 'user' 
                      ? 'bg-purple-600 text-white' 
                      : 'bg-white border border-gray-200'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            
            {!coachingComplete && (
              <>
                <textarea
                  ref={textareaRef}
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                  className="w-full border border-gray-300 rounded-lg p-3 mb-3 focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  placeholder="Describe your additional experience or skills..."
                  rows="3"
                  disabled={sending}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={sending || !userInput.trim()}
                  className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 font-medium transition-colors"
                >
                  {sending ? 'Sending...' : 'Send'}
                </button>
              </>
            )}

            {coachingComplete && (
              <div className="mt-6 pt-6 border-t">
                <label className="flex items-start gap-3 mb-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={updateCoreResume}
                    onChange={(e) => setUpdateCoreResume(e.target.checked)}
                    className="mt-1 w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-600"
                  />
                  <span className="text-sm text-gray-700">
                    Also update my core resume with this information (recommended - keeps your base resume current)
                  </span>
                </label>
                <button
                  onClick={handleFinishCoaching}
                  className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 font-medium shadow-md transition-all"
                >
                  Finish & Re-optimize Resume
                </button>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Optimization rounds: {optimizationCount}/3
                </p>
              </div>
            )}
          </div>
        )}

        {/* Optimizing Loading State */}
        {optimizing && (
          <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
              <p className="text-gray-700 font-medium">Re-optimizing your resume...</p>
              <p className="text-sm text-gray-500">Analyzing job requirements and updating content</p>
            </div>
          </div>
        )}

        {/* Action Buttons - Show when not in active coaching/optimizing */}
        {!showCoaching && !optimizing && userTier !== 'free' && (
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={handleFormatAndDownload}
              className="bg-purple-600 text-white px-8 py-3 rounded-lg hover:bg-purple-700 font-medium shadow-md transition-all"
            >
              Format & Download
            </button>
            
            {/* Subtle "Add More" option if they haven't maxed out */}
            {optimizationCount < 3 && optimizationComplete && (
              <button
                onClick={startCoaching}
                className="text-sm text-purple-600 hover:text-purple-700 font-medium"
              >
                Add more information
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}