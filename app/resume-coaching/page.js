'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import Header from '../components/Header'
import { TIERS } from '@/lib/subscription'

export default function ResumeCoaching() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [resumeData, setResumeData] = useState(null)
  const [messages, setMessages] = useState([])
  const [userProfile, setUserProfile] = useState(null)
  const [userInput, setUserInput] = useState('')
  const [sending, setSending] = useState(false)
  const supabase = createClient()
 
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const isCoachingComplete = messages.some(msg => 
  msg.role === 'assistant' && 
  msg.content.toLowerCase().includes('click the finish coaching button below')
)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }
  useEffect(() => {
    scrollToBottom()
    inputRef.current?.focus()
  }, [messages])

  async function saveConversation() {
    try {
      const { error } = await supabase
        .from('resumes')
        .update({ 
          coaching_conversation: messages 
        })
        .eq('id', resumeData.id)

      if (error) throw error

      router.push('/dashboard?saved=true')
    } catch (error) {
      console.error('Error saving conversation:', error)
      alert('Failed to save. Please try again.')
    }
  }

 async function finishCoaching() {
    try {
      setSending(true)
      
      // Extract achievements from conversation
      const extractResponse = await fetch('/api/extract-achievements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeText: resumeData.parsed_text,
          conversation: messages
        })
      })
      
      const extractData = await extractResponse.json()
      
      if (!extractData.achievements) {
        throw new Error('Failed to extract achievements')
      }
      
      // Update resume with extracted achievements
      await supabase
        .from('resumes')
        .update({ 
          coaching_conversation: messages,
          resume_data: extractData.achievements,
          coaching_complete: true
        })
        .eq('id', resumeData.id)
      
   // Recalculate resume power score with new achievements
      const scoreResponse = await fetch('/api/analyze-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeData: extractData.achievements  // Pass structured data
        })
      })
      
      const scoreData = await scoreResponse.json()
      
      // Save new score
      await supabase
        .from('resumes')
        .update({ 
          resume_power_score: scoreData.score,
          ai_analysis: scoreData.analysis
        })
        .eq('id', resumeData.id)

      // Route to resume review page
      router.push(`/resume-review/${resumeData.id}`)
    } catch (error) {
      console.error('Error finishing coaching:', error)
      alert('Failed to finalize coaching. Please try again.')
    } finally {
      setSending(false)
    }
  }

  useEffect(() => {
    loadResumeAndStartCoaching()
  }, [])

  async function loadResumeAndStartCoaching() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }
// Load user profile and check subscription
const { data: profile } = await supabase
  .from('profiles')
  .select('photo_url, display_name, subscription_tier')
  .eq('id', user.id)
  .single()

if (profile) {
  setUserProfile(profile)
  
  // Block free users from professional coaching
if (profile.subscription_tier === TIERS.FREE || profile.subscription_tier === TIERS.VAULT) {
  router.push('/pricing')
  return
}
}
      const { data, error } = await supabase
        .from('resumes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error) throw error

      setResumeData(data)
      await startCoaching(data)
      setLoading(false)
    } catch (error) {
      console.error('Error loading resume:', error)
      setLoading(false)
    }
  }

 async function startCoaching(resumeData) {
    if (resumeData.coaching_conversation && resumeData.coaching_conversation.length > 0) {
      setMessages(resumeData.coaching_conversation)
      return
    }

    // Save initial score before coaching starts (if not already saved)
    if (!resumeData.initial_resume_power_score && resumeData.resume_power_score) {
      await supabase
        .from('resumes')
        .update({ initial_resume_power_score: resumeData.resume_power_score })
        .eq('id', resumeData.id)
    }

    try {
      const response = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeText: resumeData.parsed_text,
          displayName: userProfile?.display_name,
          resumeFullName: resumeData.resume_data?.fullName,
          conversation: [
            { role: 'user', content: 'Hi! I\'m ready to work on my resume.' }
          ]
        })
      })
      
      const data = await response.json()
      
      setMessages([
        { role: 'assistant', content: data.response }
      ])
    } catch (error) {
      console.error('Error starting coaching:', error)
    }
  }

  async function sendMessage() {
    if (!userInput.trim() || sending) return

    const newUserMessage = { role: 'user', content: userInput }
    const updatedMessages = [...messages, newUserMessage]
    setMessages(updatedMessages)
    setUserInput('')
    setSending(true)

    try {
     const response = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeText: resumeData.parsed_text,
          displayName: userProfile?.display_name,
          resumeFullName: resumeData.resume_data?.fullName,
          conversation: updatedMessages
        })
      })
      
      const data = await response.json()
      
      setMessages([
        ...updatedMessages,
        { role: 'assistant', content: data.response }
      ])
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your coaching session...</p>
        </div>
      </div>
    )
  }

  return (
  <div className="h-screen flex flex-col">
    <Header />
    <div className="flex-1 flex flex-col max-w-5xl mx-auto px-8 py-3 overflow-hidden">
      {/* Session Status Bar */}
<div className="flex-shrink-0 mb-3 bg-white rounded-lg shadow-sm p-3">
  <div className="flex justify-between items-center mb-2">
    <div className="flex items-center gap-3">
      <p className="text-gray-600 text-sm font-medium">Resume Coaching Session</p>
      <span className="text-gray-400 text-xs">•</span>
      <p className="text-xs text-gray-500">In Progress</p>
    </div>
    <button
      onClick={saveConversation}
      className="text-xs bg-purple-100 text-purple-700 hover:bg-purple-600 hover:text-white px-3 py-1.5 rounded transition-colors font-medium"
    >
      💾 Save
    </button>
  </div>
        
        {/* Thinner Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-1">
          <div 
            className="bg-purple-600 h-1 rounded-full transition-all duration-500"
            style={{ width: `${Math.min((messages.length / 40) * 100, 95)}%` }}
          ></div>
        </div>
      </div>

     {/* Messages - More Space */}
<div className="flex-1 overflow-y-auto space-y-3 mb-3">
  {messages.map((msg, index) => (
    <div
      key={index}
      className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}
    >
      {msg.role === 'assistant' && (
        <span className="text-2xl flex-shrink-0">🎓</span>
      )}
      
      <div
        className={`p-3 rounded-lg ${
          msg.role === 'assistant'
            ? 'bg-purple-50 border border-purple-200 flex-1'
            : 'bg-gray-50 border border-gray-200 max-w-md'
        }`}
      >
        <p className="text-xs font-semibold text-gray-700 mb-1">
  {msg.role === 'assistant' ? 'Coach' : userProfile?.display_name || 'You'}
</p>
        <div className="text-gray-800 whitespace-pre-line text-sm">
          {msg.content}
        </div>
      </div>
      
      {msg.role === 'user' && userProfile?.photo_url && (
        <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-purple-200 flex-shrink-0">
          <img
            src={userProfile.photo_url}
            alt="You"
            className="w-full h-full object-cover"
          />
        </div>
      )}
      {msg.role === 'user' && !userProfile?.photo_url && (
        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-sm font-bold flex-shrink-0">
          {userProfile?.display_name?.charAt(0).toUpperCase() || 'U'}
        </div>
      )}
    </div>
  ))}
        
        {sending && (
          <div className="p-3 rounded-lg bg-purple-50 border border-purple-200">
            <div className="flex items-center">
              <span className="text-xl mr-2">🎓</span>
              <div className="flex-1">
                <p className="text-xs font-semibold text-gray-700 mb-1">Coach</p>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Compact Input Footer */}
      <div className="flex-shrink-0 bg-white border-t pt-3">
        <div className="flex gap-2 items-end mb-2">
          {!isCoachingComplete && (
            <textarea
              ref={inputRef}
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              placeholder="Type your response..."
              disabled={sending}
              rows="2"
              className="flex-1 border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
            />
          )}
         {!isCoachingComplete && (
            <button
              onClick={sendMessage}
              disabled={!userInput.trim() || sending}
              className="bg-purple-600 text-white px-5 py-2 rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium text-sm"
            >
              Send
            </button>
          )}
        </div>
        
        {/* Finalize or Continue Coaching button */}
<div className="mb-4 flex justify-center">
  {resumeData?.coaching_complete ? (
  <button
    onClick={async () => {
      try {
        setSending(true)
        
        // Get Claude's "welcome back" message
        const response = await fetch('/api/coach', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resumeText: resumeData.parsed_text,
            conversation: [
              ...messages,
              { role: 'user', content: 'I want to add more to my resume.' }
            ]
          })
        })
        
        const data = await response.json()
        
        // Update with new message and reopen
        const updatedMessages = [
          ...messages,
          { role: 'user', content: 'I want to add more to my resume.' },
          { role: 'assistant', content: data.response }
        ]
        
        const { error } = await supabase
          .from('resumes')
          .update({ 
            coaching_complete: false,
            coaching_conversation: updatedMessages
          })
          .eq('id', resumeData.id)
        
        if (error) throw error
        
        // Refresh page
        window.location.reload()
      } catch (error) {
        console.error('Error continuing coaching:', error)
        alert('Failed to reopen coaching. Please try again.')
        setSending(false)
      }
    }}
    disabled={sending}
    className="border-2 border-purple-600 text-purple-600 px-6 py-2.5 rounded-lg hover:bg-purple-50 transition-colors font-medium text-sm disabled:opacity-50"
  >
    {sending ? '⏳ Reopening...' : '💬 Continue Coaching'}
  </button>
  ) : isCoachingComplete ? (
    <button
      onClick={finishCoaching}
      disabled={sending}
      className={`px-6 py-2.5 rounded-lg transition-colors font-medium text-sm flex items-center justify-center gap-2 ${
        sending 
          ? 'bg-gray-400 cursor-not-allowed' 
          : 'bg-green-600 hover:bg-green-700'
      } text-white`}
    >
      {sending && (
        <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>
      )}
      {sending ? 'Processing...' : '✅ Finish Coaching'}
    </button>
  ) : (
    <p className="text-xs text-gray-500 italic">Finalize button will appear when coaching is complete</p>
  )}
</div>
      </div>
    </div>
    </div>
  )
}