'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import Header from '../components/Header'
import { TIERS } from '@/lib/subscription'

export default function Profile() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [displayName, setDisplayName] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const supabase = createClient()
  const [showDowngradeModal, setShowDowngradeModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelFeedback, setCancelFeedback] = useState('')
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      setUser(user)

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading profile:', error)
      }

      if (profile) {
        setProfile(profile)
        setDisplayName(profile.display_name || user.email.split('@')[0])
        setPhotoUrl(profile.photo_url || '')
      } else {
        setDisplayName(user.email.split('@')[0])
      }

      setLoading(false)
    } catch (error) {
      console.error('Unexpected error loading profile:', error)
      setLoading(false)
    }
  }

  async function uploadPhoto(event) {
    try {
      setUploading(true)

      const file = event.target.files[0]
      if (!file) return

      if (!file.type.startsWith('image/')) {
        return
      }

      if (file.size > 2 * 1024 * 1024) {
        return
      }

      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}-${Date.now()}.${fileExt}`
      const filePath = `${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(filePath)

      setPhotoUrl(data.publicUrl)

    } catch (error) {
      console.error('Error uploading photo:', error)
    } finally {
      setUploading(false)
    }
  }

  async function saveProfile() {
    try {
      setSaving(true)

      const updates = {
        id: user.id,
        display_name: displayName,
        photo_url: photoUrl,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from('profiles')
        .upsert(updates)
        .select()

      if (error) throw error

      await loadProfile()
      
    } catch (error) {
      console.error('Error saving profile:', error)
    } finally {
      setSaving(false)
    }
  }

  async function handleDowngradeToVault() {
    try {
      setProcessing(true)
      
      const { error } = await supabase
        .from('profiles')
        .update({
          subscription_tier: TIERS.VAULT,
          downgrade_scheduled_date: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) throw error

      setShowDowngradeModal(false)
      await loadProfile()
      
    } catch (error) {
      console.error('Downgrade error:', error)
    } finally {
      setProcessing(false)
    }
  }

  async function handleCancel() {
    try {
      setProcessing(true)
      
      const { error } = await supabase
        .from('profiles')
        .update({
          subscription_tier: TIERS.FREE,
          cancelled_at: new Date().toISOString(),
          cancellation_feedback: cancelFeedback
        })
        .eq('id', user.id)

      if (error) throw error

      setShowCancelModal(false)
      setCancelFeedback('')
      await loadProfile()
      
    } catch (error) {
      console.error('Cancel error:', error)
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-2xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold mb-6">Profile Settings</h1>

          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Profile Photo
            </label>
            <div className="flex items-center gap-6">
              {photoUrl ? (
                <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-purple-200">
                  <img
                    src={photoUrl}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-24 h-24 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-3xl font-bold">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              
              <div>
                <label className="cursor-pointer bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors inline-block">
                  {uploading ? 'Uploading...' : photoUrl ? 'Change Photo' : 'Upload Photo'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={uploadPhoto}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
                <p className="text-xs text-gray-500 mt-2">JPG, PNG or GIF. Max 2MB.</p>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
              placeholder="Your name"
            />
            <p className="text-xs text-gray-500 mt-1">This is how we'll address you in coaching</p>
          </div>

          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
            />
            <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
          </div>

          {/* Subscription Management */}
          <div className="mb-8 border-t pt-8">
            <h2 className="text-xl font-semibold mb-4">Subscription</h2>
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">
                    {profile?.subscription_tier === TIERS.FREE && 'Free Plan'}
                    {profile?.subscription_tier === TIERS.PRO && 'Hire Power Pro'}
                    {profile?.subscription_tier === TIERS.VAULT && 'Hire Power Vault'}
                  </p>
                  <p className="text-sm text-gray-600">
                    {profile?.subscription_tier === TIERS.FREE && 'Limited features - Upgrade for full access'}
                    {profile?.subscription_tier === TIERS.PRO && '$29.99/month - All features unlocked'}
                    {profile?.subscription_tier === TIERS.VAULT && '$4.99/month - Career archive access'}
                  </p>
                  {profile?.subscription_start_date && (
                    <p className="text-xs text-gray-500 mt-1">
                      Subscribed since {new Date(profile.subscription_start_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
                {profile?.subscription_tier === TIERS.FREE && (
                  <button
                    onClick={() => router.push('/pricing')}
                    className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 font-medium"
                  >
                    Upgrade
                  </button>
                )}
              </div>
            </div>

            {/* Pro tier options */}
            {profile?.subscription_tier === TIERS.PRO && (
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDowngradeModal(true)}
                  className="flex-1 border-2 border-blue-300 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-50 font-medium"
                >
                  Downgrade to Vault ($4.99)
                </button>
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="flex-1 border-2 border-red-300 text-red-700 px-4 py-2 rounded-lg hover:bg-red-50 font-medium"
                >
                  Cancel Subscription
                </button>
              </div>
            )}

            {/* Vault tier options */}
            {profile?.subscription_tier === TIERS.VAULT && (
              <div className="space-y-2">
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="w-full border-2 border-red-300 text-red-700 px-4 py-2 rounded-lg hover:bg-red-50 font-medium"
                >
                  Cancel Subscription
                </button>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              onClick={saveProfile}
              disabled={saving}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                saving
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              }`}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Downgrade to Vault Modal */}
        {showDowngradeModal && (
          <div className="fixed inset-0 bg-white bg-opacity-80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-8 max-w-md w-full shadow-2xl border-2 border-purple-300">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Downgrade to Vault?</h3>
              <p className="text-gray-700 mb-4">You'll lose access to:</p>
              <ul className="text-sm text-gray-600 space-y-2 mb-6">
                <li>• Resume coaching & customization</li>
                <li>• Interview practice & AI feedback</li>
                <li>• New resume generation</li>
              </ul>
              <p className="text-sm text-gray-600 mb-6">
                You'll keep: Career archive, achievement tracking, downloads, and premium templates.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDowngradeModal(false)}
                  disabled={processing}
                  className="flex-1 bg-gray-200 text-gray-700 px-4 py-3 rounded-lg hover:bg-gray-300 font-medium disabled:opacity-50"
                >
                  Keep Pro
                </button>
                <button
                  onClick={handleDowngradeToVault}
                  disabled={processing}
                  className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
                >
                  {processing ? 'Processing...' : 'Switch to Vault'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cancel Modal */}
        {showCancelModal && (
          <div className="fixed inset-0 bg-white bg-opacity-80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-8 max-w-md w-full shadow-2xl border-2 border-purple-300">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Cancel Subscription?</h3>
              
              {profile?.subscription_tier === TIERS.PRO && (
                <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-blue-900 mb-2">
                    💡 Consider Vault instead ($4.99/month)
                  </p>
                  <p className="text-xs text-blue-800">
                    Keep your work safe and track achievements between job searches. Upgrade back to Pro anytime.
                  </p>
                </div>
              )}
              
              <p className="text-gray-700 mb-4">
                Help us improve by telling us why you're cancelling.
              </p>
              <textarea
                value={cancelFeedback}
                onChange={(e) => setCancelFeedback(e.target.value)}
                placeholder="What could we have done better? (optional)"
                className="w-full border border-gray-300 rounded-lg p-3 h-24 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-4"
              />
              <p className="text-sm text-red-600 mb-6">
                Your subscription will be cancelled immediately and you'll revert to the Free plan.
              </p>
              <div className="flex flex-col gap-3">
                {profile?.subscription_tier === TIERS.PRO && (
                  <button
                    onClick={() => {
                      setShowCancelModal(false)
                      setShowDowngradeModal(true)
                    }}
                    disabled={processing}
                    className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
                  >
                    Switch to Vault Instead ($4.99)
                  </button>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowCancelModal(false)
                      setCancelFeedback('')
                    }}
                    disabled={processing}
                    className="flex-1 bg-gray-200 text-gray-700 px-4 py-3 rounded-lg hover:bg-gray-300 font-medium disabled:opacity-50"
                  >
                    Keep Subscription
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={processing}
                    className="flex-1 bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {processing && (
                      <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>
                    )}
                    {processing ? 'Cancelling...' : 'Cancel to Free'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}