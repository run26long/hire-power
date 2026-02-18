'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { TIERS, hasFeatureAccess, FEATURES } from '@/lib/subscription'
import Header from '../../components/Header'
import BatteryScore from '../../components/BatteryScore'

export default function ResumeAnalysis() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const resumeId = params.id

  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(true)
  const [analysis, setAnalysis] = useState(null)
  const [resumeData, setResumeData] = useState(null)
  const [userTier, setUserTier] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [forceReanalyze, setForceReanalyze] = useState(false)
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)
  const [reportSubmitted, setReportSubmitted] = useState(false)
  const [showFlagModal, setShowFlagModal] = useState(false)
  const [flagComment, setFlagComment] = useState('')
  const [flagSubmitting, setFlagSubmitting] = useState(false)
  const [score, setScore] = useState(null)

  useEffect(() => {
    loadResumeAndAnalyze()
  }, [resumeId, forceReanalyze])

  const loadResumeAndAnalyze = async () => {
    try {
      setLoading(true)
      setAnalyzing(true)

      // Get user and their tier
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Get user profile with tier
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', user.id)
        .single()

      setUserTier(profile?.subscription_tier || TIERS.FREE)

      // Load resume
      const { data: resume, error: resumeError } = await supabase
        .from('resumes')
        .select('*')
        .eq('id', resumeId)
        .eq('user_id', user.id)
        .single()

      if (resumeError) throw resumeError

     setResumeData(resume)

      // Check if analysis already exists and if we're forcing reanalysis
      const shouldRunNewAnalysis = !resume.ai_analysis || forceReanalyze
      
      if (!shouldRunNewAnalysis) {
        console.log('Using existing AI analysis from database')
        setAnalysis(resume.ai_analysis)
        setScore(resume.resume_power_score || 0) // Load existing score
        setAnalyzing(false)
      } else {
        console.log(forceReanalyze ? 'Running forced re-analysis' : 'No existing analysis, running new analysis')
        // Analyze with AI
       const result = await analyzeResume(resume.parsed_text)
        setAnalysis(result.analysis)
        const resumeScore = result.score
        
        // SAVE ANALYSIS TO DATABASE for editor to use later
       const updateData = { 
          ai_analysis: result.analysis,
          ai_analysis_date: new Date().toISOString(),
          resume_power_score: resumeScore
        }
        
        // If no initial score exists, set it (first time only)
        if (!resume.initial_resume_power_score) {
          updateData.initial_resume_power_score = resumeScore
        }
        
        const { error: saveError } = await supabase
          .from('resumes')
          .update(updateData)
          .eq('id', resumeId)
        
        if (saveError) {
          console.error('Failed to save AI analysis:', saveError)
          // Still continue - user can still see analysis on screen
        } else {
          console.log('AI analysis saved successfully!')
        }
        
        setAnalyzing(false)
        setForceReanalyze(false) // Reset flag
      }

    } catch (err) {
      console.error('Error loading resume:', err)
      setError('Failed to load resume. Please try again.')
    } finally {
      setLoading(false)
    }
  }

 const analyzeResume = async (resumeText) => {
    try {
      const response = await fetch('/api/analyze-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeText })
      })

      if (!response.ok) throw new Error('Analysis failed')

      const data = await response.json()
      setScore(data.score)
      return { analysis: data.analysis, score: data.score } // Return both
    } catch (err) {
      console.error('Analysis error:', err)
      throw err
    }
  }

  const handleContinue = () => {
    if (userTier === TIERS.FREE) {
      // Route to basic editor
      router.push(`/resume-editor/${resumeId}`)
    } else {
      // Route to coaching conversation
      router.push(`/resume-coaching?resumeId=${resumeId}`)
    }
  }

  const handleSaveProgress = async () => {
    setSaving(true)
    // Progress is already auto-saved, just route back
    setTimeout(() => {
      router.push('/dashboard')
    }, 300)
  }

  const handleFeedback = async (feedbackType) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { error } = await supabase
        .from('ai_feedback')
        .insert({
          user_id: user.id,
          resume_id: resumeId,
          feedback_type: feedbackType,
          feedback_context: 'ai_analysis'
        })
      
      if (error) throw error
      
      setFeedbackSubmitted(true)
    } catch (err) {
      console.error('Error submitting feedback:', err)
    }
  }

  const handleFlag = async () => {
    if (!flagComment.trim()) {
      alert('Please describe what\'s wrong')
      return
    }

    setFlagSubmitting(true)
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { error } = await supabase
        .from('flagged_content')
        .insert({
          user_id: user.id,
          resume_id: resumeId,
          content_type: 'ai_analysis',
          flagged_content: analysis,
          user_comment: flagComment
        })
      
      if (error) throw error
      
      setShowFlagModal(false)
      setFlagComment('')
      setReportSubmitted(true)
    } catch (err) {
      console.error('Error flagging content:', err)
      alert('Failed to submit. Please try again.')
    } finally {
      setFlagSubmitting(false)
    }
  }

  if (loading || analyzing) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900">
              {analyzing ? 'Analyzing your resume...' : 'Loading...'}
            </h2>
            <p className="text-gray-600 mt-2">This will take just a moment</p>
          </div>
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow p-6 text-center">
            <div className="text-red-500 text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-3xl font-bold text-gray-900">Resume Power Score</h1>
              {userTier !== TIERS.FREE && resumeData?.ai_analysis && (
                <button
                  onClick={() => {
                    setForceReanalyze(true)
                    loadResumeAndAnalyze()
                  }}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 font-medium text-sm flex items-center gap-2"
                >
                  🔄 Re-analyze
                </button>
              )}
            </div>
            
            {/* Score Display */}
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <BatteryScore score={score || 0} size="large" />
                  {resumeData?.initial_resume_power_score && score > resumeData.initial_resume_power_score && (
                    <p className="text-green-700 font-semibold mt-3 text-lg">
                      🎉 You raised your Resume Power Score from {resumeData.initial_resume_power_score} → {score} with Hire Power!
                    </p>
                  )}
                </div>
                <div className="flex-1 pl-8">
                  <p className="text-sm text-gray-700 leading-relaxed">
                    Your Resume Power Score reflects what <strong>ATS systems and recruiters</strong> look for: strong action verbs, quantifiable achievements, professional language, and clear skills. This score helps you understand your resume's competitive strength before you apply.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Analysis Results */}
          <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
            {/* Strengths */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-green-700 mb-4 flex items-center gap-2">
                ✅ Strengths
              </h2>
              <ul className="space-y-2">
                {analysis.strengths.map((strength, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <span className="text-green-600 mt-1">•</span>
                    <span className="text-gray-700">{strength}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Areas to Improve */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-orange-700 mb-4 flex items-center gap-2">
                ⚠️ Areas to Improve
              </h2>
              <ul className="space-y-2">
                {analysis.weaknesses.map((weakness, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <span className="text-orange-600 mt-1">•</span>
                    <span className="text-gray-700">{weakness}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Suggestions */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-blue-700 mb-4 flex items-center gap-2">
                💡 Suggestions
              </h2>
              <ul className="space-y-2">
                {analysis.suggestions.map((suggestion, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <span className="text-blue-600 mt-1">•</span>
                    <span className="text-gray-700">{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>

        {/* Feedback Section */}
           <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                {feedbackSubmitted ? (
                  <p className="text-sm text-green-600">✓ Thanks for your feedback!</p>
                ) : (
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-medium text-gray-700">Was this helpful?</p>
                    <button
                      onClick={() => handleFeedback('helpful')}
                      className="px-3 py-1 bg-green-50 hover:bg-green-100 text-green-700 rounded text-sm font-medium transition-colors"
                    >
                      👍 Helpful
                    </button>
                    <button
                      onClick={() => handleFeedback('okay')}
                      className="px-3 py-1 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded text-sm font-medium transition-colors"
                    >
                      😐 Okay
                    </button>
                    <button
                      onClick={() => handleFeedback('not_useful')}
                      className="px-3 py-1 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded text-sm font-medium transition-colors"
                    >
                      👎 Not useful
                    </button>
                  </div>
                )}
                {reportSubmitted ? (
                  <p className="text-sm text-green-600">✓ Report submitted. We'll review this analysis.</p>
                ) : (
                  <button
                    onClick={() => setShowFlagModal(true)}
                    className="text-sm text-red-600 hover:text-red-700 underline"
                  >
                    ⚠️ Report a Problem
                  </button>
                )}
              </div>
            </div>
          </div>

         {/* Flag Modal */}
          {showFlagModal && (
            <div className="fixed inset-0 bg-white bg-opacity-80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-8 max-w-md w-full shadow-2xl border-2 border-purple-300">                <h3 className="text-2xl font-bold text-gray-900 mb-3">Report an Issue</h3>
                <p className="text-sm text-gray-700 mb-4">
                  Please describe what's wrong with this analysis. We'll review it and improve our AI.
                </p>
                <textarea
                  value={flagComment}
                  onChange={(e) => setFlagComment(e.target.value)}
                  placeholder="What's inaccurate or unhelpful?"
                  className="w-full border border-gray-300 rounded-lg p-3 h-32 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-4"
                  autoFocus
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowFlagModal(false)
                      setFlagComment('')
                    }}
                    disabled={flagSubmitting}
                    className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleFlag}
                    disabled={flagSubmitting || !flagComment.trim()}
                    className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {flagSubmitting && (
                      <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>
                    )}
                    {flagSubmitting ? 'Submitting...' : 'Submit Report'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Next Steps - Different for Free vs Paid */}
          {userTier === TIERS.FREE ? (
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                📝 Ready to implement these improvements?
              </h3>
              <p className="text-gray-700 mb-4">
                You can edit your resume directly and apply these suggestions yourself. 
                Or upgrade to get professional coaching that extracts achievements you didn't even know you had.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={handleContinue}
                  className="flex-1 bg-white border-2 border-purple-600 text-purple-600 px-6 py-3 rounded-lg hover:bg-purple-50 font-medium"
                >
                  Open Editor
                </button>
                <button
                  onClick={() => router.push('/pricing')}
                  className="flex-1 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 font-medium"
                >
                  Upgrade to Full Coaching
                </button>
              </div>
              <div className="mt-4 text-center flex gap-4 justify-center">
                <button
                  onClick={() => router.push('/my-resumes')}
                  className="text-sm text-gray-600 hover:text-gray-900 underline"
                >
                  Return to My Resumes
                </button>
                <span className="text-gray-400">•</span>
                <button
                  onClick={handleSaveProgress}
                  disabled={saving}
                  className="text-sm text-gray-500 hover:text-gray-700 underline"
                >
                  {saving ? 'Saving...' : 'Save & Continue Later'}
                </button>
              </div>
            </div>
         ) : resumeData?.coaching_complete ? (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                ✅ Coaching Complete!
              </h3>
              <p className="text-gray-700 mb-4">
                Your resume has been professionally coached. You can view your improved resume, edit it, or select a template to download.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => router.push(`/resume-review/${resumeId}`)}
                  className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 font-medium"
                >
                  View Improved Resume
                </button>
                <button
                  onClick={() => router.push(`/resume-editor/${resumeId}?splitView=true`)}
                  className="flex-1 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 font-medium"
                >
                  Edit Resume
                </button>
              </div>
              <div className="mt-4 text-center">
                <button
                  onClick={() => router.push('/my-resumes')}
                  className="text-sm text-gray-600 hover:text-gray-900 underline"
                >
                  Return to My Resumes
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                ⚡ Let's bulletproof your resume
              </h3>
              <p className="text-gray-700 mb-4">
                Your membership includes professional resume coaching that transforms generic job descriptions into compelling stories with measurable impact. In just 15-20 minutes, we'll walk through each role together and extract quantifiable results you might not even recognize. The difference? Coached resumes get 40% more interviews. Ready to get started?
              </p>
              <div className="text-center">
                <button
                  onClick={handleContinue}
                  className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 font-medium"
                >
                  Start Professional Coaching →
                </button>
              </div>
              <div className="mt-4 text-center flex gap-4 justify-center">
                <button
                  onClick={() => router.push('/my-resumes')}
                  className="text-sm text-gray-600 hover:text-gray-900 underline"
                >
                  Return to My Resumes
                </button>
                <span className="text-gray-400">•</span>
                <button
                  onClick={handleSaveProgress}
                  disabled={saving}
                  className="text-sm text-gray-500 hover:text-gray-700 underline"
                >
                  {saving ? 'Saving...' : 'Save & Continue Later'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}