'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { TIERS } from '@/lib/subscription'

export default function UpgradeModal({ isOpen, onClose, currentTier }) {
  const router = useRouter()
  const supabase = createClient()
  const [upgrading, setUpgrading] = useState(false)
  const [error, setError] = useState(null)

  const handleUpgrade = async () => {
    setUpgrading(true)
    setError(null)
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          subscription_tier: TIERS.PRO,
          subscription_start_date: new Date().toISOString()
        })
        .eq('id', user.id)

      if (updateError) throw updateError

      onClose()
      router.push('/dashboard?upgraded=true')
      
    } catch (err) {
      console.error('Upgrade error:', err)
      setError('Upgrade failed. Please try again or contact support.')
    } finally {
      setUpgrading(false)
    }
  }

  if (!isOpen) return null

  return (
   <div className="fixed inset-0 bg-gray-200 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl border-2 border-purple-300 max-w-3xl w-full max-h-[85vh] overflow-y-auto">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-8 py-6 rounded-t-xl flex justify-between items-center">
          <h2 className="text-3xl font-bold">Upgrade to Pro</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 text-3xl leading-none font-light"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-8">
          
          {error && (
            <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-lg p-4">
              <p className="text-red-800 text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Pricing */}
          <div className="text-center mb-6">
            <div className="text-5xl font-bold text-purple-600 mb-2">$29.99</div>
            <div className="text-gray-600">per month</div>
          </div>
          
          <p className="text-center text-gray-700 mb-8 text-lg">
            Your complete career operating system - resume coaching, interview practice, and lifetime achievement tracking in one integrated platform.
          </p>
          
          {/* Features Grid */}
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div>
              <p className="font-bold mb-4 text-lg text-gray-900">Resume Features:</p>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Professional coaching conversations</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Unlimited job customization</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600">✓</span>
                  <span>ATS optimization & match scoring</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Premium templates</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Unlimited re-analysis</span>
                </li>
              </ul>
            </div>
            
            <div>
              <p className="font-bold mb-4 text-lg text-gray-900">Interview Features:</p>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-green-600">✓</span>
                  <span>AI-spoken personalized questions</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Power Skill Analysis</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Company research integration</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Video recording & feedback</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Gamified progression</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Integration Callout */}
          <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-center text-purple-900">
              <strong>True Integration:</strong> One achievement database feeds both resume customization AND interview prep. No competitor offers this.
            </p>
          </div>
          
          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            <button
              onClick={handleUpgrade}
              disabled={upgrading || currentTier === TIERS.PRO}
              className="w-full bg-purple-600 text-white py-4 rounded-lg hover:bg-purple-700 font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {upgrading && (
                <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>
              )}
              {currentTier === TIERS.PRO ? 'Already on Pro' : upgrading ? 'Processing...' : 'Upgrade to Pro →'}
            </button>
            
            <button
              onClick={onClose}
              className="w-full bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 font-medium transition-colors"
            >
              Maybe Later
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}