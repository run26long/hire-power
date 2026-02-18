'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import Header from '../components/Header'
import { TIERS } from '@/lib/subscription'

export default function PricingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [upgrading, setUpgrading] = useState(false)
  const [error, setError] = useState(null)
  const [currentTier, setCurrentTier] = useState(null)

  useEffect(() => {
    loadCurrentTier()
  }, [])

  async function loadCurrentTier() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .single()

    setCurrentTier(profile?.subscription_tier || TIERS.FREE)
  }

  const handleUpgrade = async (tier) => {
    setUpgrading(true)
    setError(null)
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          subscription_tier: tier,
          subscription_start_date: new Date().toISOString()
        })
        .eq('id', user.id)

      if (updateError) throw updateError

      router.push('/dashboard?upgraded=true')
      
    } catch (err) {
      console.error('Upgrade error:', err)
      setError('Upgrade failed. Please try again or contact support.')
    } finally {
      setUpgrading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-6xl mx-auto px-4 py-16">

        {error && (
          <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-lg p-4 max-w-2xl mx-auto">
            <p className="text-red-800 text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Pro Plan - Featured */}
        <div className="max-w-3xl mx-auto mb-12">
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-2xl p-8 text-white relative">
            <div className="absolute top-4 right-4 bg-yellow-400 text-indigo-900 px-3 py-1 rounded-full text-xs font-bold">
              BEST VALUE
            </div>
            
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold mb-2">Hire Power Pro</h2>
              <div className="text-5xl font-bold mb-2">$29.99</div>
              <div className="text-indigo-100">per month</div>
            </div>
            
            <p className="text-center text-indigo-100 mb-8 text-lg">
              Your complete career operating system - resume coaching, interview practice, and lifetime achievement tracking in one integrated platform.
            </p>
            
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div>
                <p className="font-bold mb-3 text-lg">Resume Features:</p>
                <ul className="space-y-2 text-sm">
                  <li>✓ Professional coaching conversations</li>
                  <li>✓ Unlimited job customization</li>
                  <li>✓ ATS optimization & match scoring</li>
                  <li>✓ Premium templates</li>
                  <li>✓ Unlimited re-analysis</li>
                </ul>
              </div>
              
              <div>
                <p className="font-bold mb-3 text-lg">Interview Features:</p>
                <ul className="space-y-2 text-sm">
                  <li>✓ AI-spoken personalized questions</li>
                  <li>✓ Power Skill Analysis</li>
                  <li>✓ Company research integration</li>
                  <li>✓ Video recording & feedback</li>
                  <li>✓ Gamified progression</li>
                </ul>
              </div>
            </div>

            <div className="bg-white/10 rounded-lg p-4 mb-6">
              <p className="text-sm text-center">
                <strong>True Integration:</strong> One achievement database feeds both resume customization AND interview prep. No competitor offers this.
              </p>
            </div>
            
            <button
              onClick={() => handleUpgrade(TIERS.PRO)}
              disabled={upgrading || currentTier === TIERS.PRO}
              className="w-full bg-white text-indigo-600 py-4 rounded-lg hover:bg-indigo-50 font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {upgrading && (
                <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>
              )}
              {currentTier === TIERS.PRO ? 'Current Plan' : upgrading ? 'Processing...' : 'Upgrade to Pro →'}
            </button>
          </div>
        </div>

        {/* Vault Plan */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="bg-white rounded-xl shadow-lg p-8 border-2 border-blue-200">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold mb-2">Hire Power Vault</h2>
              <div className="text-4xl font-bold text-blue-600 mb-2">$4.99</div>
              <div className="text-gray-600">per month</div>
            </div>
            
            <p className="text-center text-gray-700 mb-6">
              Between job searches? Keep your career archive safe and track achievements as they happen.
            </p>
            
            <div className="space-y-3 mb-6">
              <div className="flex items-start gap-2">
                <span className="text-green-600">✓</span>
                <span className="text-gray-700">Track achievements in real-time</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-600">✓</span>
                <span className="text-gray-700">View complete career archive</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-600">✓</span>
                <span className="text-gray-700">Unlimited downloads</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-600">✓</span>
                <span className="text-gray-700">Premium templates</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-gray-400">✗</span>
                <span className="text-gray-500">No new resume generation</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-gray-400">✗</span>
                <span className="text-gray-500">No interview coaching</span>
              </div>
            </div>

            <button
              onClick={() => handleUpgrade(TIERS.VAULT)}
              disabled={upgrading || currentTier === TIERS.VAULT}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {currentTier === TIERS.VAULT ? 'Current Plan' : 'Select Vault'}
            </button>
            
            <p className="text-xs text-gray-500 mt-4 text-center">
              Perfect for staying interview-ready between job searches
            </p>
          </div>
        </div>

        {/* Free Plan Info */}
        <div className="max-w-2xl mx-auto">
          <div className="bg-gray-100 rounded-lg p-6 border border-gray-300">
            <h3 className="font-bold text-gray-900 mb-3">Free Plan</h3>
            <p className="text-sm text-gray-700 mb-3">
              Try Hire Power with limited features:
            </p>
            <ul className="text-sm text-gray-600 space-y-1 mb-4">
              <li>• 1 resume with AI analysis</li>
              <li>• Resume editor with basic templates</li>
              <li>• Job match scores</li>
              <li>• Basic interview practice</li>
            </ul>
            <p className="text-xs text-gray-500">
              Already have an account? {' '}
              <button onClick={() => router.push('/login')} className="text-purple-600 hover:underline">
                Sign in
              </button>
            </p>
          </div>
        </div>

        <div className="text-center mt-12">
          <button
            onClick={() => router.back()}
            disabled={upgrading}
            className="text-gray-600 hover:text-gray-900 underline disabled:opacity-50"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  )
}