'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

export default function ResumeCoaching() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [resumeData, setResumeData] = useState(null)
  const [messages, setMessages] = useState([])
  const [userInput, setUserInput] = useState('')
  const [sending, setSending] = useState(false)
  const supabase = createClient()
 
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const isCoachingComplete = messages.some(msg => 
    msg.role === 'assistant' && 
    msg.content.toLowerCase().includes('ready to finalize your improved resume')
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
      
      const response = await fetch('/api/extract-achievements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeText: resumeData.parsed_text,
          conversation: messages
        })
      })
      
      const data = await response.json()
      
      if (!data.achievements) {
        throw new Error('Failed to extract achievements')
      }
      
      const { error } = await supabase
        .from('resumes')
        .update({ 
          coaching_conversation: messages,
          resume_data: data.achievements,
          coaching_complete: true
        })
        .eq('id', resumeData.id)

      if (error) throw error

      router.push('/dashboard?coaching-complete=true')
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

    try {
      const response = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeText: resumeData.parsed_text,
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
    <div className="h-screen flex flex-col max-w-5xl mx-auto px-8 py-3">
      {/* Compact Header */}
      <div className="flex-shrink-0 mb-3 bg-white rounded-lg shadow-sm p-3">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-purple-600">Hire Power</h1>
            <span className="text-gray-400 text-sm">|</span>
            <p className="text-gray-600 text-xs">Resume Coaching Session</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <p className="font-medium text-gray-700 text-xs">
                {(() => {
                  if (resumeData.resume_data?.fullName) {
                    return `${resumeData.resume_data.fullName.split(' ')[0]}'s Resume`
                  }
                  const firstLine = resumeData.parsed_text?.split('\n').slice(0, 5).join(' ').trim()
                  const nameMatch = firstLine?.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/)?.[1]
                  return nameMatch ? `${nameMatch.split(' ')[0]}'s Resume` : 'Your Resume'
                })()}
              </p>
              <span className="text-gray-400 text-xs">|</span>
              <p className="text-xs text-gray-500">In Progress</p>
            </div>
            {/* Save button in header */}
            <button
              onClick={saveConversation}
              className="text-xs bg-purple-100 text-purple-700 hover:bg-purple-600 hover:text-white px-3 py-1.5 rounded transition-colors font-medium"
            >
              💾 Save
            </button>
          </div>
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
            className={`p-3 rounded-lg ${
              msg.role === 'assistant'
                ? 'bg-purple-50 border border-purple-200'
                : 'bg-gray-50 border border-gray-200 ml-12'
            }`}
          >
            <div className="flex items-start">
              <span className="text-xl mr-2">
                {msg.role === 'assistant' ? '🎓' : '👤'}
              </span>
              <div className="flex-1">
                <p className="text-xs font-semibold text-gray-700 mb-1">
                  {msg.role === 'assistant' ? 'Coach' : 'You'}
                </p>
                <div className="text-gray-800 whitespace-pre-line text-sm">
                  {msg.content}
                </div>
              </div>
            </div>
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
          <button
            onClick={sendMessage}
            disabled={!userInput.trim() || sending}
            className="bg-purple-600 text-white px-5 py-2 rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium text-sm"
          >
            Send
          </button>
        </div>
        
        {/* Only Finalize button (when ready) */}
        {isCoachingComplete && (
          <div className="mb-4 flex justify-center">
            <button
              onClick={finishCoaching}
              className="bg-green-600 text-white px-6 py-2.5 rounded-lg hover:bg-green-700 transition-colors font-medium text-sm"
            >
              ✅ Finish Coaching
            </button>
          </div>
        )}
        {!isCoachingComplete && (
          <div className="mb-4 flex justify-center">
            <p className="text-xs text-gray-500 italic">Finalize button will appear when coaching is complete</p>
          </div>
        )}
      </div>
    </div>
  )
}