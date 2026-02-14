'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function ChoosePlanPage() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkIfAlreadySelected()
  }, [])

  const checkIfAlreadySelected = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('tier_selected')
      .eq('id', user.id)
      .single()

    if (profile?.tier_selected) {
      router.push('/dashboard')
    }
  }

  const handleTierSelection = async (tier, interviewAccess) => {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase
      .from('profiles')
      .update({
        subscription_tier: tier,
        tier_selected: true,
        interview_access: interviewAccess
      })
      .eq('id', user.id)

    if (error) {
      console.error('Error updating tier:', error)
      alert('Something went wrong. Please try again.')
      setLoading(false)
      return
    }

    // Mock payment for paid tiers (Stripe in Phase 5)
    if (tier === 'full' || interviewAccess === true) {
      console.log('Mock payment: Would charge here')
    }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white flex items-center justify-center px-4 py-12">
      <div className="max-w-5xl w-full">
        
        {/* Hero */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Welcome to Hire Power!
          </h1>
          <p className="text-lg text-gray-600">
            Choose your plan to start your career conversation
          </p>
        </div>

        {/* Three Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          
          {/* FULL RESUME */}
          <button
            onClick={() => handleTierSelection('full', false)}
            disabled={loading}
            className="bg-white border-2 border-purple-300 rounded-lg p-6 text-left hover:shadow-xl hover:border-purple-400 transition-all disabled:opacity-50"
          >
            <div className="text-3xl mb-3">📄</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Full Resume</h3>
            
            <div className="mb-4">
              <span className="text-3xl font-bold text-purple-600">$19.99</span>
              <span className="text-gray-600">/month</span>
            </div>

            <ul className="text-sm text-gray-600 space-y-2 mb-6">
              <li>• Professional coaching conversation</li>
              <li>• Unlimited job customization</li>
              <li>• ATS match scoring</li>
              <li>• Premium templates</li>
              <li>• Unlimited downloads</li>
            </ul>

            <div className="text-purple-600 font-bold">
              Select Full Resume →
            </div>
          </button>

          {/* FULL INTERVIEW */}
          <button
            onClick={() => handleTierSelection('free', true)}
            disabled={loading}
            className="bg-white border-2 border-purple-300 rounded-lg p-6 text-left hover:shadow-xl hover:border-purple-400 transition-all disabled:opacity-50"
          >
            <div className="text-3xl mb-3">🎤</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Full Interview</h3>
            
            <div className="mb-4">
              <span className="text-3xl font-bold text-purple-600">$19.99</span>
              <span className="text-gray-600">/month</span>
            </div>

            <ul className="text-sm text-gray-600 space-y-2 mb-6">
              <li>• Voice-based practice sessions</li>
              <li>• Resume-integrated questions</li>
              <li>• Company-specific prep</li>
              <li>• Real-time AI feedback</li>
              <li>• Performance tracking</li>
            </ul>

            <div className="text-purple-600 font-bold">
              Select Full Interview →
            </div>
          </button>

          {/* FULL BUNDLE */}
          <button
            onClick={() => handleTierSelection('full', true)}
            disabled={loading}
            className="bg-gradient-to-br from-purple-100 to-purple-200 border-2 border-purple-400 rounded-lg p-6 text-left hover:shadow-xl transition-all disabled:opacity-50 relative"
          >
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-purple-600 text-white text-xs px-4 py-1 rounded-full font-bold">
              BEST VALUE
            </div>

            <div className="text-center mb-3">
              <div className="text-3xl mb-2">⭐</div>
              <h3 className="text-xl font-bold text-gray-900 mb-1">Full Bundle</h3>
              <p className="text-sm text-purple-800 font-semibold">Save $10/month</p>
            </div>
            
            <div className="text-center mb-4">
              <span className="text-3xl font-bold text-purple-700">$29.99</span>
              <span className="text-gray-700">/month</span>
              <p className="text-xs text-gray-600 mt-1">vs $39.98 separate</p>
            </div>

            <ul className="text-sm text-gray-700 space-y-2 mb-6">
              <li>• Everything in Full Resume</li>
              <li>• Everything in Full Interview</li>
              <li>• Career archive for life</li>
              <li>• True integration - one database</li>
            </ul>

            <div className="text-purple-700 font-bold text-center">
              Select Full Bundle →
            </div>
          </button>
        </div>

        {/* Free Option */}
        <div className="text-center">
          <p className="text-gray-600 mb-2">Want to try before you buy?</p>
          <button
            onClick={() => handleTierSelection('free', false)}
            disabled={loading}
            className="text-purple-600 font-semibold hover:underline disabled:opacity-50"
          >
            Start with our free version
          </button>
          <p className="text-sm text-gray-500 mt-2 max-w-2xl mx-auto">
            Free version includes AI-powered resume builder + interview practice. 
            Get instant insights and feedback—upgrade anytime for full coaching.
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center mt-8">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-600 border-r-transparent"></div>
            <p className="text-gray-600 mt-2">Setting up your account...</p>
          </div>
        )}
      </div>
    </div>
  )
}