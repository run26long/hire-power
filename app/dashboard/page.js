'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Header from '../components/Header'
import { TIERS } from '@/lib/subscription'

export default function Dashboard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [resumes, setResumes] = useState([])
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      const { data: resumes } = await supabase
        .from('resumes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

     setProfile(profile)
      setResumes(resumes || [])
      setLoading(false)

      // Check if user just upgraded
      if (searchParams.get('upgraded') === 'true') {
        setShowUpgradeModal(true)
      }
    } catch (error) {
      console.error('Error loading dashboard:', error)
      setLoading(false)
    }
  }

  const handleUpgrade = async (tier) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('profiles')
        .update({
          subscription_tier: tier,
          subscription_start_date: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) throw error

      await loadDashboard()
    } catch (error) {
      console.error('Upgrade error:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  const currentTier = profile?.subscription_tier || TIERS.FREE
  const hasResume = resumes.length > 0

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-6xl mx-auto px-4 py-12">
<div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {hasResume ? `Welcome back, ${profile?.display_name || 'there'}!` : `Welcome, ${profile?.display_name || 'there'}!`}
          </h1>
          <p className="text-xl text-gray-600">
            {hasResume 
              ? "Pick up where you left off—customize your resume, practice interviews, or add new achievements to your archive."
              : "Let's build your professional resume and get you interview-ready."}
          </p>
        </div>

        {/* FREE TIER - 2 Upgrade Cards */}
        {currentTier === TIERS.FREE && (
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            
            {/* Resume Coach - Free */}
            <div className="bg-white rounded-xl shadow-lg p-8 border-2 border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="text-4xl">📄</div>
                <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-xs font-bold">
                  FREE
                </span>
              </div>
              <h2 className="text-2xl font-bold mb-4">Resume Coach</h2>
              <p className="text-sm text-gray-600 mb-4">Free tier includes:</p>
              <ul className="text-sm text-gray-700 space-y-2 mb-6">
                <li>• 1 resume with AI analysis</li>
                <li>• Resume editor with basic templates</li>
                <li>• Job match scores (view only)</li>
                <li>• Unlimited downloads</li>
              </ul>
              <button
  onClick={() => router.push(hasResume ? '/my-resumes' : '/resume-start')}
  className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 font-medium mb-4 transition-colors"
>
  {hasResume ? 'View My Resume' : 'Create My Resume'}
</button>
            <button
                onClick={() => router.push('/pricing')}
                className="w-full text-purple-600 text-sm hover:underline font-medium"
              >
                Upgrade to Pro for full coaching →
              </button>
            </div>

            {/* Interview Coach - Free */}
            <div className="bg-white rounded-xl shadow-lg p-8 border-2 border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="text-4xl">🎤</div>
                <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-xs font-bold">
                  FREE
                </span>
              </div>
              <h2 className="text-2xl font-bold mb-4">Interview Coach</h2>
              <p className="text-sm text-gray-600 mb-4">Free tier includes:</p>
              <ul className="text-sm text-gray-700 space-y-2 mb-6">
                <li>• Basic interview questions</li>
                <li>• Self-guided practice</li>
                <li>• Text-based feedback</li>
                <li>• Record practice sessions</li>
              </ul>
              <button
                onClick={() => router.push('/interview-practice')}
                className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 font-medium mb-4 transition-colors"
              >
                Start Interview Practice
              </button>
              <button
                onClick={() => router.push('/pricing')}
                className="w-full text-purple-600 text-sm hover:underline font-medium"
              >
                Upgrade to Pro for AI coaching →
              </button>
            </div>
          </div>
        )}

        {/* PRO TIER - 2 Full Access Cards */}
        {currentTier === TIERS.PRO && (
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            
            {/* Resume Coach - Full Access */}
            <div className="bg-white rounded-xl shadow-lg p-8 border-2 border-green-300">
              <div className="flex items-center justify-between mb-4">
                <div className="text-4xl">📄</div>
                <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold">
                  Full Access
                </span>
              </div>
              <h2 className="text-2xl font-bold mb-4">Resume Coach</h2>
              <p className="text-sm text-gray-600 mb-4">You have full access to:</p>
              <ul className="text-sm text-gray-700 space-y-2 mb-6">
                <li>• Professional coaching conversations</li>
                <li>• Unlimited job customization</li>
                <li>• ATS optimization & match scoring</li>
                <li>• Premium templates</li>
                <li>• Unlimited re-analysis</li>
              </ul>
              <button
                onClick={() => router.push(hasResume ? '/my-resumes' : '/resume-start')}
                className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 font-medium transition-colors"
              >
                {hasResume ? 'View My Resumes' : 'Create My First Resume'}
              </button>
            </div>

            {/* Interview Coach - Full Access */}
            <div className="bg-white rounded-xl shadow-lg p-8 border-2 border-purple-300">
              <div className="flex items-center justify-between mb-4">
                <div className="text-4xl">🎤</div>
                <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-xs font-bold">
                  Full Access
                </span>
              </div>
              <h2 className="text-2xl font-bold mb-4">Interview Coach</h2>
              <p className="text-sm text-gray-600 mb-4">You have full access to:</p>
              <ul className="text-sm text-gray-700 space-y-2 mb-6">
                <li>• AI-spoken personalized questions</li>
                <li>• Power Skill Analysis</li>
                <li>• Company research integration</li>
                <li>• Video recording & feedback</li>
                <li>• Gamified progression</li>
              </ul>
              <button
                onClick={() => router.push('/interview-practice')}
                className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 font-medium transition-colors"
              >
                Start Interview Practice
              </button>
            </div>
          </div>
        )}

        {/* VAULT TIER - Career Archive Active + Upgrade Card */}
        {currentTier === TIERS.VAULT && (
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            
            {/* Career Archive - Active Feature */}
            <div className="bg-white rounded-xl shadow-lg p-8 border-2 border-blue-300">
              <div className="flex items-center justify-between mb-4">
                <div className="text-4xl">🗂️</div>
                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-bold">
                  Full Access
                </span>
              </div>
              <h2 className="text-2xl font-bold mb-4">Career Archive</h2>
              <p className="text-sm text-gray-600 mb-4">Track your wins as they happen:</p>
              <ul className="text-sm text-gray-700 space-y-2 mb-6">
                <li>• Add new achievements anytime</li>
                <li>• View complete career history</li>
                <li>• Download existing resumes</li>
                <li>• Access premium templates</li>
              </ul>
              <button
                onClick={() => router.push('/career-archive')}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-medium mb-3 transition-colors"
              >
                View Career Archive
              </button>
              <button
                onClick={() => router.push('/my-resumes')}
                className="w-full bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 font-medium text-sm transition-colors"
              >
                Download Existing Resumes
              </button>
            </div>

            {/* Upgrade to Pro */}
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl shadow-lg p-8 border-2 border-purple-200">
              <div className="text-4xl mb-4">⭐</div>
              <h2 className="text-2xl font-bold mb-4 text-gray-900">Ready to Job Search?</h2>
              <p className="text-gray-700 mb-4">
                Upgrade to Pro to unlock:
              </p>
              <ul className="text-sm text-gray-700 space-y-2 mb-6">
                <li>• Resume coaching & customization</li>
                <li>• AI interview practice</li>
                <li>• Company-specific prep</li>
                <li>• Power Skill Analysis</li>
                <li>• Generate new resumes</li>
              </ul>
              <button
                onClick={() => handleUpgrade(TIERS.PRO)}
                className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 font-medium transition-colors"
              >
                Upgrade to Pro ($29.99/mo)
              </button>
              <p className="text-xs text-gray-500 mt-4 text-center">
                Your achievements are safe. Upgrade anytime you're ready.
              </p>
            </div>
          </div>
        )}

      {/* Footer Messages by Tier */}
        <div className="text-center mt-8">
          {profile?.subscription_tier === TIERS.FREE && (
            <p className="text-gray-600">
  Ready to build your career?{' '}
 <button onClick={() => router.push('/pricing')} className="text-purple-600 hover:underline font-medium">    Go Pro
  </button>
  {' '}for coaching, customization, and lifelong career tracking 
</p>
          )}
          
          {currentTier === TIERS.PRO && (
            <p className="text-gray-600">
              Between job searches?{' '}
              <button onClick={() => router.push('/profile')} className="text-blue-600 hover:underline font-medium">
                Switch to Vault
              </button>
              {' '}to keep your work safe ($4.99/month)
            </p>
          )}
          
          {currentTier === TIERS.VAULT && (
            <p className="text-gray-600">
              You're on Vault - keeping your career archive safe.{' '}
              <button onClick={() => handleUpgrade(TIERS.PRO)} className="text-purple-600 hover:underline font-medium">
                Upgrade to Pro
              </button>
              {' '}when you're ready to job search.
            </p>
          )}
     </div>
      </div>

      {/* Upgrade Onboarding Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-white bg-opacity-80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-8 max-w-md w-full shadow-2xl border-2 border-purple-300">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">🎉 Welcome to Pro!</h3>
            
            {hasResume ? (
              <>
                <p className="text-gray-700 mb-6">
                  You're all set! Let's improve your resume with professional AI coaching.
                </p>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => {
                      setShowUpgradeModal(false)
                      router.push('/resume-coaching')
                    }}
                    className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 font-semibold transition-colors"
                  >
                    Start Coaching Session →
                  </button>
                  <button
                    onClick={() => setShowUpgradeModal(false)}
                    className="w-full bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 font-medium transition-colors"
                  >
                    I'll Do This Later
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-gray-700 mb-6">
                  Ready to build your professional resume? You can start from scratch or upload an existing one.
                </p>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => {
                      setShowUpgradeModal(false)
                      router.push('/resume-builder')
                    }}
                    className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 font-semibold transition-colors"
                  >
                    Build My First Resume →
                  </button>
                  <button
                    onClick={() => {
                      setShowUpgradeModal(false)
                      router.push('/upload')
                    }}
                    className="w-full bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 font-medium transition-colors"
                  >
                    Upload Existing Resume
                  </button>
                  <button
                    onClick={() => setShowUpgradeModal(false)}
                    className="w-full text-gray-600 hover:text-gray-800 text-sm underline"
                  >
                    I'll Do This Later
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
 )}
    </div>
  )
}