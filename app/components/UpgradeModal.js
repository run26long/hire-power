'use client'
import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'

export default function UpgradeModal({ isOpen, onClose, resumeId, currentTier }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleUpgrade = async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', user.id)
        .single()

      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID,
          userId: user.id,
          email: profile?.email || user.email,
          resumeId: resumeId || null,
        })
      })

      const data = await response.json()
      if (data.error) throw new Error(data.error)

      window.location.href = data.url

    } catch (err) {
      console.error('Upgrade error:', err)
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{backgroundColor:'rgba(0,0,0,0.6)'}}
      onClick={onClose}
    >
      <div
        className="bg-white shadow-2xl w-full overflow-hidden"
        style={{maxWidth:'480px',borderRadius:'12px'}}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{background:'linear-gradient(to bottom right, #667eea, #764ba2)'}}
          className="px-6 py-5 relative"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:text-gray-200 text-3xl leading-none font-light"
          >×</button>
          <div className="flex items-center gap-3">
            <img src="/images/Hire_Power_icon.png" alt="Hire Power" className="h-8 w-auto flex-shrink-0" />
            <div>
              <h2 className="text-xl font-bold text-white">Unlock the full coaching experience</h2>
              <p className="text-purple-100 text-xs">Everything Free has, plus the parts that do the work for you.</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm mb-4">
              {error}
            </div>
          )}

          <div className="space-y-3 mb-5">
            {[
              { icon: '💬', title: 'Coaching conversation', desc: 'We interview you like a professional resume writer would, uncovering achievements you forgot to include and skills that never made the page.' },
              { icon: '⚡', title: 'Improvements applied automatically', desc: 'No guessing how to strengthen your summary and rewrite your bullets. Pro does it for you in under 2 minutes.' },
              { icon: '🎯', title: 'Tailored for every job', desc: 'Unlimited job-specific resumes, each coached and optimized for the role with a custom cover letter to match.' },
              { icon: '🎤', title: 'Interview Coach included', desc: 'Pre-interview coaching + AI-spoken practice built from your actual resume and target role - so you walk in knowing exactly how to tell your story.' },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0">{item.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-l-4 border-purple-600 p-3 mb-5">
            <p className="text-sm text-gray-800 font-medium">
              Free tells you what to fix. Pro fixes it for you.
            </p>
          </div>

          <button
            onClick={handleUpgrade}
            disabled={loading}
           className="block mx-auto py-2 px-6 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-opacity mb-3"
            style={{background:'linear-gradient(to right, #667eea, #764ba2)'}}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"/>
                Redirecting to checkout...
              </span>
            ) : 'Upgrade to Pro — $29.99/mo'}
          </button>

          <button
            onClick={onClose}
            className="block mx-auto text-center text-xs text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer"
          >
            {currentTier === 'vault' ? 'Stay on Vault' : 'Continue with Free'}
          </button>
        </div>
      </div>
    </div>
  )
}