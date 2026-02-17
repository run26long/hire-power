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
      
      <div className="max-w-7xl mx-auto px-4 py-16">
        
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
          <p className="text-xl text-gray-600">
            Professional career coaching that grows with you
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-lg p-4 max-w-2xl mx-auto">
            <p className="text-red-800 text-sm font-medium">{error}</p>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-8 mb-8">
          
          {/* Maintenance */}
          <div className="bg-white rounded-xl shadow-lg p-8 border-2 border-gray-200">
            <h3 className="text-2xl font-bold mb-2">Maintenance</h3>
            <div className="text-4xl font-bold text-blue-600 mb-2">$4.99</div>
            <div className="text-gray-600 mb-6">per month</div>
            
            <div className="space-y-3 mb-8 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-green-600">✓</span>
                <span>Track achievements as they happen</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-600">✓</span>
                <span>View complete career archive</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-600">✓</span>
                <span>Unlimited downloads</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-600">✓</span>
                <span>Premium templates</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-red-600">✗</span>
                <span className="text-gray-500">No new resume generation</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-red-600">✗</span>
                <span className="text-gray-500">No interview coaching</span>
              </div>
            </div>

            <button
              onClick={() => handleUpgrade(TIERS.MAINTENANCE)}
              disabled={upgrading || currentTier === TIERS.MAINTENANCE}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {currentTier === TIERS.MAINTENANCE ? 'Current Plan' : 'Select Plan'}
            </button>
            
            <p className="text-xs text-gray-500 mt-4 text-center">
              Perfect between job searches
            </p>
          </div>

          {/* Full Resume */}
          <div className="bg-white rounded-xl shadow-lg p-8 border-2 border-green-300">
            <h3 className="text-2xl font-bold mb-2">Full Resume</h3>
            <div className="text-4xl font-bold text-green-600 mb-2">$19.99</div>
            <div className="text-gray-600 mb-6">per month</div>
            
            <div className="space-y-3 mb-8 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-green-600">✓</span>
                <span><strong>Interactive achievement extraction</strong></span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-600">✓</span>
                <span><strong>Unlimited job customization</strong></span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-600">✓</span>
                <span><strong>ATS optimization</strong></span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-600">✓</span>
                <span>Premium templates</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-600">✓</span>
                <span>Unlimited re-analysis</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-600">+</span>
                <span className="text-blue-600"><em>Free basic interview practice</em></span>
              </div>
            </div>

            <button
              onClick={() => handleUpgrade(TIERS.FULL_RESUME)}
              disabled={upgrading || currentTier === TIERS.FULL_RESUME}
              className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {currentTier === TIERS.FULL_RESUME ? 'Current Plan' : 'Select Plan'}
            </button>
            
            <p className="text-xs text-gray-500 mt-4 text-center">
              Bulletproof your resume
            </p>
          </div>

          {/* Full Interview */}
          <div className="bg-white rounded-xl shadow-lg p-8 border-2 border-purple-300">
            <h3 className="text-2xl font-bold mb-2">Full Interview</h3>
            <div className="text-4xl font-bold text-purple-600 mb-2">$19.99</div>
            <div className="text-gray-600 mb-6">per month</div>
            
            <div className="space-y-3 mb-8 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-green-600">✓</span>
                <span><strong>AI-spoken personalized questions</strong></span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-600">✓</span>
                <span><strong>Power Skill Analysis</strong></span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-600">✓</span>
                <span><strong>Company research integration</strong></span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-600">✓</span>
                <span>Video recording & feedback</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-600">✓</span>
                <span>Gamified progression</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-blue-600">+</span>
                <span className="text-blue-600"><em>Free basic resume builder</em></span>
              </div>
            </div>

            <button
              onClick={() => handleUpgrade(TIERS.FULL_INTERVIEW)}
              disabled={upgrading || currentTier === TIERS.FULL_INTERVIEW}
              className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {currentTier === TIERS.FULL_INTERVIEW ? 'Current Plan' : 'Select Plan'}
            </button>
            
            <p className="text-xs text-gray-500 mt-4 text-center">
              Level up your interviews
            </p>
          </div>
        </div>

        {/* Full Integrated - Featured */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-2xl p-8 text-white relative overflow-hidden">
            <div className="absolute top-4 right-4 bg-yellow-400 text-indigo-900 px-3 py-1 rounded-full text-xs font-bold">
              BEST VALUE - SAVE $10/mo
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-3xl font-bold mb-2">Full Platform</h3>
                <div className="text-5xl font-bold mb-2">$29.99</div>
                <div className="text-indigo-100 mb-6">per month</div>
                
                <p className="text-indigo-100 mb-4">
                  Get everything in Resume + Interview for less than buying separately
                </p>
                
                <button
                  onClick={() => handleUpgrade(TIERS.FULL_INTEGRATED)}
                  disabled={upgrading || currentTier === TIERS.FULL_INTEGRATED}
                  className="bg-white text-indigo-600 px-8 py-4 rounded-lg hover:bg-indigo-50 font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {upgrading && (
                    <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>
                  )}
                  {currentTier === TIERS.FULL_INTEGRATED ? 'Current Plan' : upgrading ? 'Processing...' : 'Get Full Platform →'}
                </button>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <span>✓</span>
                  <span>Professional resume coaching</span>
                </div>
                <div className="flex items-start gap-2">
                  <span>✓</span>
                  <span>Unlimited job customization</span>
                </div>
                <div className="flex items-start gap-2">
                  <span>✓</span>
                  <span>AI-spoken interview practice</span>
                </div>
                <div className="flex items-start gap-2">
                  <span>✓</span>
                  <span>Power Skill Analysis (Core/Hidden/Gap)</span>
                </div>
                <div className="flex items-start gap-2">
                  <span>✓</span>
                  <span>Company research integration</span>
                </div>
                <div className="flex items-start gap-2">
                  <span>✓</span>
                  <span>Premium templates</span>
                </div>
                <div className="flex items-start gap-2">
                  <span>✓</span>
                  <span>Career archive (lifetime tracking)</span>
                </div>
                <div className="flex items-start gap-2">
                  <span>✓</span>
                  <span><strong>True integration - single achievement database</strong></span>
                </div>
              </div>
            </div>
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