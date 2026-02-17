'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import Header from '../components/Header'
import { TIERS } from '@/lib/subscription'

export default function Dashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [resumes, setResumes] = useState([])
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

      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome back, {profile?.display_name || 'there'}!
          </h1>
          <p className="text-xl text-gray-600">
            Pick up where you left off—customize your resume, practice interviews, or add new achievements to your archive.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          
          {/* CARD 1: RESUME COACH */}
          {currentTier === TIERS.FREE && (
            <div className="bg-white rounded-xl shadow-lg p-8 border-2 border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="text-4xl">📄</div>
                <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-xs font-bold">
                  UPGRADE
                </span>
              </div>
              <h2 className="text-2xl font-bold mb-4">Resume Coach</h2>
              <p className="text-sm text-gray-600 mb-6">
                Free tier includes: 1 resume, AI analysis, basic templates, unlimited downloads
              </p>
              <button
                onClick={() => router.push(hasResume ? '/my-resumes' : '/resume-builder')}
                className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 font-medium mb-4"
              >
                {hasResume ? 'View My Resume' : 'Build My First Resume'}
              </button>
              <button
                onClick={() => router.push('/pricing')}
                className="w-full text-purple-600 text-sm hover:underline"
              >
                Upgrade to Full Resume ($19.99/mo) →
              </button>
            </div>
          )}

          {currentTier === TIERS.MAINTENANCE && (
            <div className="bg-white rounded-xl shadow-lg p-8 border-2 border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="text-4xl">📄</div>
                <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-xs font-bold">
                  UPGRADE TO GENERATE
                </span>
              </div>
              <h2 className="text-2xl font-bold mb-4">Resume Coach</h2>
              <p className="text-sm text-gray-600 mb-6">
                View your archived achievements. Upgrade to generate new resumes.
              </p>
              <button
                onClick={() => router.push('/my-resumes')}
                className="w-full bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 font-medium mb-4"
              >
                View Career Archive
              </button>
              <button
                onClick={() => router.push('/pricing')}
                className="w-full text-purple-600 text-sm hover:underline"
              >
                Upgrade to Full Resume ($19.99/mo) →
              </button>
            </div>
          )}

          {currentTier === TIERS.FULL_RESUME && (
            <div className="bg-white rounded-xl shadow-lg p-8 border-2 border-green-300">
              <div className="flex items-center justify-between mb-4">
                <div className="text-4xl">📄</div>
                <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold">
                  Full Access
                </span>
              </div>
              <h2 className="text-2xl font-bold mb-4">Resume Coach</h2>
              <p className="text-sm text-gray-600 mb-4">Full access includes:</p>
              <ul className="text-sm text-gray-700 space-y-2 mb-6">
                <li>• Professional coaching conversation</li>
                <li>• Unlimited job customization</li>
                <li>• ATS match scoring</li>
                <li>• Unlimited downloads</li>
                <li>• Premium templates</li>
              </ul>
              <button
                onClick={() => router.push('/my-resumes')}
                className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 font-medium"
              >
                View My Resume
              </button>
            </div>
          )}

          {currentTier === TIERS.FULL_INTERVIEW && (
            <div className="bg-white rounded-xl shadow-lg p-8 border-2 border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="text-4xl">📄</div>
                <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-xs font-bold">
                  Free Access
                </span>
              </div>
              <h2 className="text-2xl font-bold mb-4">Resume Coach</h2>
              <p className="text-sm text-gray-600 mb-4">Free tier includes:</p>
              <ul className="text-sm text-gray-700 space-y-2 mb-4">
                <li>• Basic interview questions</li>
                <li>• Self-guided practice</li>
                <li>• Text-based feedback</li>
                <li>• Record practice sessions</li>
              </ul>
              <button
                onClick={() => router.push(hasResume ? '/my-resumes' : '/resume-builder')}
                className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 font-medium mb-4"
              >
                {hasResume ? 'View My Resume' : 'Build My First Resume'}
              </button>
              <div className="border-t pt-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  Upgrade to Full Resume ($19.99/mo):
                </p>
                <ul className="text-xs text-gray-600 space-y-1 mb-3">
                  <li>• Voice-based practice sessions</li>
                  <li>• Resume-integrated questions</li>
                  <li>• Company-specific prep</li>
                  <li>• Real-time AI feedback</li>
                </ul>
                <button
                  onClick={() => handleUpgrade(TIERS.FULL_INTEGRATED)}
                  className="w-full text-purple-600 text-sm hover:underline font-medium"
                >
                  Upgrade to Full Resume →
                </button>
              </div>
            </div>
          )}

          {currentTier === TIERS.FULL_INTEGRATED && (
            <div className="bg-white rounded-xl shadow-lg p-8 border-2 border-green-300">
              <div className="flex items-center justify-between mb-4">
                <div className="text-4xl">📄</div>
                <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold">
                  Full Access
                </span>
              </div>
              <h2 className="text-2xl font-bold mb-4">Resume Coach</h2>
              <p className="text-sm text-gray-600 mb-4">Full access includes:</p>
              <ul className="text-sm text-gray-700 space-y-2 mb-6">
                <li>• Professional coaching conversation</li>
                <li>• Unlimited job customization</li>
                <li>• ATS match scoring</li>
                <li>• Unlimited downloads</li>
                <li>• Premium templates</li>
              </ul>
              <button
                onClick={() => router.push('/my-resumes')}
                className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 font-medium"
              >
                View My Resume
              </button>
            </div>
          )}

          {/* CARD 2: INTERVIEW COACH */}
          {currentTier === TIERS.FREE && (
            <div className="bg-white rounded-xl shadow-lg p-8 border-2 border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="text-4xl">🎤</div>
                <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-xs font-bold">
                  UPGRADE
                </span>
              </div>
              <h2 className="text-2xl font-bold mb-4">Interview Coach</h2>
              <p className="text-sm text-gray-600 mb-6">
                Free tier includes: Basic interview questions, self-guided practice, text-based feedback
              </p>
              <button
                onClick={() => router.push('/interview-practice')}
                className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 font-medium mb-4"
              >
                Start Interview Practice
              </button>
              <button
                onClick={() => router.push('/pricing')}
                className="w-full text-purple-600 text-sm hover:underline"
              >
                Upgrade to Full Interview ($19.99/mo) →
              </button>
            </div>
          )}

          {currentTier === TIERS.MAINTENANCE && (
            <div className="bg-white rounded-xl shadow-lg p-8 border-2 border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="text-4xl">🎤</div>
                <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-xs font-bold">
                  UPGRADE
                </span>
              </div>
              <h2 className="text-2xl font-bold mb-4">Interview Coach</h2>
              <p className="text-sm text-gray-600 mb-6">
                Upgrade to practice with AI-spoken questions and personalized feedback.
              </p>
              <button
                onClick={() => router.push('/pricing')}
                className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 font-medium"
              >
                Upgrade to Full Interview ($19.99/mo)
              </button>
            </div>
          )}

          {currentTier === TIERS.FULL_RESUME && (
            <div className="bg-white rounded-xl shadow-lg p-8 border-2 border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="text-4xl">🎤</div>
                <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-xs font-bold">
                  Free Access
                </span>
              </div>
              <h2 className="text-2xl font-bold mb-4">Interview Coach</h2>
              <p className="text-sm text-gray-600 mb-4">Free tier includes:</p>
              <ul className="text-sm text-gray-700 space-y-2 mb-4">
                <li>• Basic interview questions</li>
                <li>• Self-guided practice</li>
                <li>• Text-based feedback</li>
                <li>• Record practice sessions</li>
              </ul>
              <button
                onClick={() => router.push('/interview-practice')}
                className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 font-medium mb-4"
              >
                Start Interview Practice
              </button>
              <div className="border-t pt-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  Upgrade to Full Interview ($19.99/mo):
                </p>
                <ul className="text-xs text-gray-600 space-y-1 mb-3">
                  <li>• Voice-based practice sessions</li>
                  <li>• Resume-integrated questions</li>
                  <li>• Company-specific prep</li>
                  <li>• Real-time AI feedback</li>
                </ul>
                <button
                  onClick={() => handleUpgrade(TIERS.FULL_INTEGRATED)}
                  className="w-full text-purple-600 text-sm hover:underline font-medium"
                >
                  Upgrade to Full Interview →
                </button>
              </div>
            </div>
          )}

          {currentTier === TIERS.FULL_INTERVIEW && (
            <div className="bg-white rounded-xl shadow-lg p-8 border-2 border-purple-300">
              <div className="flex items-center justify-between mb-4">
                <div className="text-4xl">🎤</div>
                <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-xs font-bold">
                  Full Access
                </span>
              </div>
              <h2 className="text-2xl font-bold mb-4">Interview Coach</h2>
              <p className="text-sm text-gray-600 mb-4">Full access includes:</p>
              <ul className="text-sm text-gray-700 space-y-2 mb-6">
                <li>• AI-spoken personalized questions</li>
                <li>• Power Skill Analysis</li>
                <li>• Company research integration</li>
                <li>• Video recording & feedback</li>
                <li>• Gamified progression</li>
              </ul>
              <button
                onClick={() => router.push('/interview-practice')}
                className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 font-medium"
              >
                Start Interview Practice
              </button>
            </div>
          )}

          {currentTier === TIERS.FULL_INTEGRATED && (
            <div className="bg-white rounded-xl shadow-lg p-8 border-2 border-purple-300">
              <div className="flex items-center justify-between mb-4">
                <div className="text-4xl">🎤</div>
                <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-xs font-bold">
                  Full Access
                </span>
              </div>
              <h2 className="text-2xl font-bold mb-4">Interview Coach</h2>
              <p className="text-sm text-gray-600 mb-4">Full access includes:</p>
              <ul className="text-sm text-gray-700 space-y-2 mb-6">
                <li>• AI-spoken personalized questions</li>
                <li>• Power Skill Analysis</li>
                <li>• Company research integration</li>
                <li>• Video recording & feedback</li>
                <li>• Gamified progression</li>
              </ul>
              <button
                onClick={() => router.push('/interview-practice')}
                className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 font-medium"
              >
                Start Interview Practice
              </button>
            </div>
          )}

          {/* CARD 3: BUNDLE OR MAINTENANCE */}
          {(currentTier === TIERS.FREE || currentTier === TIERS.MAINTENANCE) && (
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-2xl p-8 text-white relative">
              <div className="absolute top-4 right-4 bg-yellow-400 text-indigo-900 px-3 py-1 rounded-full text-xs font-bold">
                BEST VALUE
              </div>
              <div className="text-4xl mb-4">⭐</div>
              <h2 className="text-2xl font-bold mb-2">Integrated Career Coach</h2>
              <p className="text-lg font-bold text-indigo-100 mb-4">Save $10/month</p>
              <p className="text-sm text-indigo-100 mb-6">
                One achievement database feeds both resume customization AND interview prep. True integration no competitor offers.
              </p>
              <p className="text-sm text-indigo-100 mb-4">Bundle includes:</p>
              <ul className="text-sm space-y-1 mb-6">
                <li>• Resume coaching + unlimited customization</li>
                <li>• Interview practice with AI</li>
                <li>• Career archive for life</li>
                <li>• All premium features</li>
              </ul>
              <div className="text-4xl font-bold mb-2">$29.99/mo</div>
              <p className="text-sm text-indigo-100 mb-6">vs $39.98 separate</p>
              <button
                onClick={() => handleUpgrade(TIERS.FULL_INTEGRATED)}
                className="w-full bg-white text-indigo-600 py-3 rounded-lg hover:bg-indigo-50 font-bold"
              >
                Upgrade to Bundle →
              </button>
              <p className="text-xs text-indigo-100 mt-4 text-center">
                Add Interview access for just $10 more
              </p>
            </div>
          )}

          {(currentTier === TIERS.FULL_RESUME || currentTier === TIERS.FULL_INTERVIEW) && (
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-2xl p-8 text-white relative">
              <div className="absolute top-4 right-4 bg-yellow-400 text-indigo-900 px-3 py-1 rounded-full text-xs font-bold">
                BEST VALUE
              </div>
              <div className="text-4xl mb-4">⭐</div>
              <h2 className="text-2xl font-bold mb-2">Integrated Career Coach</h2>
              <p className="text-lg font-bold text-indigo-100 mb-4">Save $10/month</p>
              <p className="text-sm text-indigo-100 mb-6">
                One achievement database feeds both resume customization AND interview prep. True integration no competitor offers.
              </p>
              <p className="text-sm text-indigo-100 mb-4">Bundle includes:</p>
              <ul className="text-sm space-y-1 mb-6">
                <li>• Resume coaching + unlimited customization</li>
                <li>• Interview practice with AI</li>
                <li>• Career archive for life</li>
                <li>• All premium features</li>
              </ul>
              <div className="text-4xl font-bold mb-2">$29.99/mo</div>
              <p className="text-sm text-indigo-100 mb-6">vs $39.98 separate</p>
              <button
                onClick={() => handleUpgrade(TIERS.FULL_INTEGRATED)}
                className="w-full bg-white text-indigo-600 py-3 rounded-lg hover:bg-indigo-50 font-bold"
              >
                Upgrade to Bundle →
              </button>
              <p className="text-xs text-indigo-100 mt-4 text-center">
                Add {currentTier === TIERS.FULL_RESUME ? 'Interview' : 'Resume'} access for just $10 more
              </p>
            </div>
          )}

          {currentTier === TIERS.FULL_INTEGRATED && (
            <div className="bg-blue-50 rounded-xl shadow-lg p-8 border-2 border-blue-200">
              <div className="text-4xl mb-4">💼</div>
              <h2 className="text-2xl font-bold mb-4 text-gray-900">Maintenance Mode</h2>
              <p className="text-sm text-gray-700 mb-4">
                Between job searches? Switch to Maintenance to keep your work safe for just $4.99/month.
              </p>
              <p className="text-sm text-gray-700 mb-4">You'll keep:</p>
              <ul className="text-sm text-gray-700 space-y-2 mb-4">
                <li>✓ Career archive access</li>
                <li>✓ Track new achievements</li>
                <li>✓ Unlimited downloads</li>
                <li>✓ Premium templates</li>
              </ul>
              <p className="text-sm text-gray-600 mb-6">
                You'll lose coaching and new resume generation, but all your work stays safe.
              </p>
              <button
                onClick={() => router.push('/profile')}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-medium"
              >
                Learn More About Maintenance →
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}