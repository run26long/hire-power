'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function ChoosePlanPage() {
  const [selectedTier, setSelectedTier] = useState(null)
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

    // Check if they already chose a tier
    const { data: profile } = await supabase
      .from('profiles')
      .select('tier_selected')
      .eq('id', user.id)
      .single()

    if (profile?.tier_selected) {
      // Already chose, send to dashboard
      router.push('/dashboard')
    }
  }

  const handleTierSelection = async (tier, interviewAccess = false) => {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()

    // Update profile with selected tier
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

    // For paid tiers, we'll add Stripe later
    // For now, just set the tier and continue
    if (tier === 'full') {
      // TODO: Add Stripe checkout in Phase 5
      console.log('Mock payment: Would charge $19.99 or $29.99 here')
    }

    // Go to dashboard
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white flex items-center justify-center px-4 py-12">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-purple-600 mb-3">⚡ Welcome to Hire Power!</h1>
          <p className="text-xl text-gray-700">Choose your plan to get started</p>
        </div>

        <div className="space-y-8">
          {/* RESUME OPTIONS */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Resume</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {/* Free Resume */}
              <button
                onClick={() => handleTierSelection('free')}
                disabled={loading}
                className="bg-white border-2 border-gray-300 rounded-lg p-6 text-left hover:border-purple-500 hover:shadow-lg transition-all disabled:opacity-50"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Free Resume</h3>
                    <p className="text-gray-600 text-sm mt-1">Start with DIY and upgrade at any time for help</p>
                  </div>
                  <span className="text-2xl font-bold text-gray-900">$0</span>
                </div>
                <ul className="space-y-2 text-sm text-gray-600 mb-4">
                  <li>• Build 1 resume</li>
                  <li>• Unlimited downloads</li>
                  <li>• Basic templates</li>
                  <li>• DIY setup</li>
                </ul>
                <div className="text-purple-600 font-semibold">Get Started Free →</div>
              </button>

              {/* Full Resume */}
              <button
                onClick={() => handleTierSelection('full')}
                disabled={loading}
                className="bg-purple-50 border-2 border-purple-500 rounded-lg p-6 text-left hover:shadow-xl transition-all disabled:opacity-50 relative"
              >
                <div className="absolute top-3 right-3 bg-purple-600 text-white text-xs px-2 py-1 rounded-full font-semibold">
                  POPULAR
                </div>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Full Resume</h3>
                    <p className="text-gray-700 text-sm mt-1">Upgrade today to power up your career search and have it all done in minutes</p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-bold text-purple-600">$19.99</span>
                    <p className="text-xs text-gray-600">/month</p>
                  </div>
                </div>
                <ul className="space-y-2 text-sm text-gray-700 mb-4">
                  <li>• <strong>Professional coaching</strong></li>
                  <li>• Unlimited resumes</li>
                  <li>• Job customization (83% higher success)</li>
                  <li>• ATS match scoring</li>
                  <li>• Premium templates</li>
                </ul>
                <div className="text-purple-600 font-bold">Upgrade Now →</div>
              </button>
            </div>
          </div>

          {/* INTERVIEW OPTIONS (Disabled) */}
          <div className="opacity-50">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Interview</h2>
              <span className="bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full font-semibold">
                Coming Soon
              </span>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {/* Free Interview */}
              <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-6 cursor-not-allowed">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-xl font-bold text-gray-600">Free Interview</h3>
                    <p className="text-gray-500 text-sm mt-1">Basic practice tools</p>
                  </div>
                  <span className="text-2xl font-bold text-gray-600">$0</span>
                </div>
                <ul className="space-y-2 text-sm text-gray-500 mb-4">
                  <li>• Basic interview questions</li>
                  <li>• Self-guided practice</li>
                </ul>
              </div>

              {/* Full Interview */}
              <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-6 cursor-not-allowed">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-xl font-bold text-gray-600">Full Interview</h3>
                    <p className="text-gray-500 text-sm mt-1">AI-powered coaching</p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-bold text-gray-600">$19.99</span>
                    <p className="text-xs text-gray-500">/month</p>
                  </div>
                </div>
                <ul className="space-y-2 text-sm text-gray-500 mb-4">
                  <li>• Voice-based practice</li>
                  <li>• Company research</li>
                  <li>• Resume-integrated prep</li>
                </ul>
              </div>
            </div>
          </div>

          {/* BUNDLE (Disabled) */}
          <div className="opacity-50">
            <button
              disabled
              className="w-full bg-gradient-to-r from-purple-100 to-purple-50 border-2 border-purple-300 rounded-lg p-6 cursor-not-allowed"
            >
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">⭐</span>
                    <h3 className="text-2xl font-bold text-gray-600">Best Value: Resume + Interview Bundle</h3>
                  </div>
                  <p className="text-gray-500">Everything included • Save $10/month</p>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-bold text-gray-600">$29.99</span>
                  <p className="text-sm text-gray-500">/month</p>
                </div>
              </div>
            </button>
          </div>
        </div>

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