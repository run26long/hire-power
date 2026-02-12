'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [accountExists, setAccountExists] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkIfLoggedIn()
  }, [])

  const checkIfLoggedIn = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      router.push('/dashboard')
    }
  }

  const handleSignup = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess(false)
    setAccountExists(false)

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    })

    // Log what Supabase returns
    console.log('🟢 Signup response - data:', data)
    console.log('🔴 Signup response - error:', signUpError)
    console.log('👤 User object:', data?.user)
    console.log('📧 User email:', data?.user?.email)

    setLoading(false)

    console.log('🔍 Checking for errors...')
    console.log('❓ signUpError exists?:', !!signUpError)
    console.log('❓ data.user exists?:', !!data?.user)

if (signUpError) {
      console.log('🔴 Supabase signup error:', signUpError)
      console.log('📝 Error message:', signUpError.message)
      
      const errorMsg = signUpError.message.toLowerCase()
      if (errorMsg.includes('already registered') || 
          errorMsg.includes('already exists') ||
          errorMsg.includes('user already registered')) {
        setAccountExists(true)
        setTimeout(() => {
          router.push('/login?existing=true')
        }, 2000)
      } else {
        setError(signUpError.message)
      }
      return
    }

    // Check if account already exists (Supabase returns empty identities array)
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      console.log('🔵 Account already exists (empty identities)')
      setAccountExists(true)
      setTimeout(() => {
        router.push('/login?existing=true')
      }, 2000)
      return
    }

    if (data.user) {
      setSuccess(true)
      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div>
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-purple-600 mb-2">⚡ Hire Power</h1>
            <p className="text-xl font-semibold text-gray-900 mb-1">Your lifelong career coach</p>
            <p className="text-gray-600 mb-6">Get started free, upgrade anytime</p>
          </div>

          {/* Quick Tier Comparison */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-semibold text-gray-900 mb-2">✓ Free Forever</p>
                <ul className="text-gray-600 space-y-1 text-xs">
                  <li>• Resume builder</li>
                  <li>• AI analysis</li>
                  <li>• Basic editor</li>
                </ul>
              </div>
              <div className="border-l-2 border-purple-300 pl-4">
                <p className="font-semibold text-purple-700 mb-2">⚡ Full Access</p>
                <ul className="text-gray-700 space-y-1 text-xs">
                  <li>• <strong>Professional coaching</strong></li>
                  <li>• <strong>True integration</strong></li>
                  <li>• Interview prep</li>
                  <li>• Unlimited customization</li>
                </ul>
              </div>
            </div>
            <p className="text-xs text-center text-gray-600 mt-3">
              Start free • Upgrade anytime • Cancel anytime
            </p>
          </div>
        </div>

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
            ✓ Account created! Redirecting to dashboard...
          </div>
        )}

        {accountExists && (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded">
            👋 Account already exists! Redirecting to login...
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSignup}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
              placeholder="Min. 6 characters"
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center gap-2 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
          >
            {loading && (
              <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>
            )}
            {loading ? 'Creating account...' : 'Sign up'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link href="/login" className="text-purple-600 hover:text-purple-700 font-medium">
            Welcome back
          </Link>
        </p>
      </div>
    </div>
  )
}