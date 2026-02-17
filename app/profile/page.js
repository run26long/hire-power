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
  const [showDowngradeModal, setShowDowngradeModal] = useState(null) // null or tier name
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

  async function handleDowngrade(targetTier) {
    try {
      setProcessing(true)
      
      const { error } = await supabase
        .from('profiles')
        .update({
          subscription_tier: targetTier,
          downgrade_scheduled_date: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) throw error

      setShowDowngradeModal(null)
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
                    {profile?.subscription_tier === TIERS.MAINTENANCE && 'Maintenance'}
                    {profile?.subscription_tier === TIERS.FULL_RESUME && 'Full Resume'}
                    {profile?.subscription_tier === TIERS.FULL_INTERVIEW && 'Full Interview'}
                    {profile?.subscription_tier === TIERS.FULL_INTEGRATED && 'Full Platform'}
                  </p>
                  <p className="text-sm text-gray-600">
                    {profile?.subscription_tier === TIERS.FREE && 'Limited features - Upgrade for full access'}
                    {profile?.subscription_tier === TIERS.MAINTENANCE && '$4.99/month - Career archive access'}
                    {profile?.subscription_tier === TIERS.FULL_RESUME && '$19.99/month - Resume features + basic interview'}
                    {profile?.subscription_tier === TIERS.FULL_INTERVIEW && '$19.99/month - Interview features + basic resume'}
                    {profile?.subscription_tier === TIERS.FULL_INTEGRATED && '$29.99/month - All features unlocked'}
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

            {/* Downgrade Options by Tier */}
            {profile?.subscription_tier === TIERS.FULL_INTEGRATED && (
              <div className="space-y-2">
                <p className="text-sm text-gray-600 mb-3">Downgrade to:</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setShowDowngradeModal(TIERS.FULL_RESUME)}
                    className="border-2 border-green-300 text-green-700 px-4 py-2 rounded-lg hover:bg-green-50 font-medium text-sm"
                  >
                    Full Resume ($19.99)
                  </button>
                  <button
                    onClick={() => setShowDowngradeModal(TIERS.FULL_INTERVIEW)}
                    className="border-2 border-purple-300 text-purple-700 px-4 py-2 rounded-lg hover:bg-purple-50 font-medium text-sm"
                  >
                    Full Interview ($19.99)
                  </button>
                  <button
                    onClick={() => setShowDowngradeModal(TIERS.MAINTENANCE)}
                    className="border-2 border-blue-300 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-50 font-medium text-sm"
                  >
                    Maintenance ($4.99)
                  </button>
                  <button
                    onClick={() => setShowCancelModal(true)}
                    className="border-2 border-red-300 text-red-700 px-4 py-2 rounded-lg hover:bg-red-50 font-medium text-sm"
                  >
                    Free Plan
                  </button>
                </div>
              </div>
            )}

            {profile?.subscription_tier === TIERS.FULL_RESUME && (
              <div className="space-y-2">
                <p className="text-sm text-gray-600 mb-3">Downgrade to:</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setShowDowngradeModal(TIERS.MAINTENANCE)}
                    className="border-2 border-blue-300 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-50 font-medium text-sm"
                  >
                    Maintenance ($4.99)
                  </button>
                  <button
                    onClick={() => setShowDowngradeModal('free_warning')}
                    className="border-2 border-red-300 text-red-700 px-4 py-2 rounded-lg hover:bg-red-50 font-medium text-sm"
                  >
                    Free Plan
                  </button>
                </div>
              </div>
            )}

            {profile?.subscription_tier === TIERS.FULL_INTERVIEW && (
              <div className="space-y-2">
                <p className="text-sm text-gray-600 mb-3">Downgrade to:</p>
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="w-full border-2 border-red-300 text-red-700 px-4 py-2 rounded-lg hover:bg-red-50 font-medium text-sm"
                >
                  Free Plan
                </button>
              </div>
            )}

            {profile?.subscription_tier === TIERS.MAINTENANCE && (
              <div className="space-y-2">
                <p className="text-sm text-gray-600 mb-3">Downgrade to:</p>
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="w-full border-2 border-red-300 text-red-700 px-4 py-2 rounded-lg hover:bg-red-50 font-medium text-sm"
                >
                  Free Plan
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

        {/* Downgrade to Full Resume Modal */}
        {showDowngradeModal === TIERS.FULL_RESUME && (
          <div className="fixed inset-0 bg-white bg-opacity-80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-8 max-w-md w-full shadow-2xl border-2 border-purple-300">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Downgrade to Full Resume?</h3>
              <p className="text-gray-700 mb-4">You'll lose:</p>
              <ul className="text-sm text-gray-600 space-y-2 mb-6">
                <li>• AI-spoken interview practice</li>
                <li>• Power Skill Analysis</li>
                <li>• Company research integration</li>
              </ul>
              <p className="text-sm text-gray-600 mb-6">
                You'll keep all resume features and get basic interview practice.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDowngradeModal(null)}
                  disabled={processing}
                  className="flex-1 bg-gray-200 text-gray-700 px-4 py-3 rounded-lg hover:bg-gray-300 font-medium disabled:opacity-50"
                >
                  Keep Full Platform
                </button>
                <button
                  onClick={() => handleDowngrade(TIERS.FULL_RESUME)}
                  disabled={processing}
                  className="flex-1 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
                >
                  {processing ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Downgrade to Full Interview Modal */}
        {showDowngradeModal === TIERS.FULL_INTERVIEW && (
          <div className="fixed inset-0 bg-white bg-opacity-80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-8 max-w-md w-full shadow-2xl border-2 border-purple-300">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Downgrade to Full Interview?</h3>
              <p className="text-gray-700 mb-4">You'll lose:</p>
              <ul className="text-sm text-gray-600 space-y-2 mb-6">
                <li>• Resume coaching</li>
                <li>• Job customization</li>
                <li>• Premium templates</li>
              </ul>
              <p className="text-sm text-gray-600 mb-6">
                You'll keep all interview features and get basic resume access.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDowngradeModal(null)}
                  disabled={processing}
                  className="flex-1 bg-gray-200 text-gray-700 px-4 py-3 rounded-lg hover:bg-gray-300 font-medium disabled:opacity-50"
                >
                  Keep Full Platform
                </button>
                <button
                  onClick={() => handleDowngrade(TIERS.FULL_INTERVIEW)}
                  disabled={processing}
                  className="flex-1 bg-purple-600 text-white px-4 py-3 rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50"
                >
                  {processing ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Downgrade to Maintenance Modal */}
        {showDowngradeModal === TIERS.MAINTENANCE && (
          <div className="fixed inset-0 bg-white bg-opacity-80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-8 max-w-md w-full shadow-2xl border-2 border-purple-300">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Switch to Maintenance Mode?</h3>
              <p className="text-gray-700 mb-4">You'll lose:</p>
              <ul className="text-sm text-gray-600 space-y-2 mb-6">
                <li>• Resume coaching</li>
                <li>• Interview practice</li>
                <li>• New resume generation</li>
              </ul>
              <p className="text-sm text-gray-600 mb-6">
                You'll keep: Career archive, downloads, and premium templates. Perfect for between job searches.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDowngradeModal(null)}
                  disabled={processing}
                  className="flex-1 bg-gray-200 text-gray-700 px-4 py-3 rounded-lg hover:bg-gray-300 font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDowngrade(TIERS.MAINTENANCE)}
                  disabled={processing}
                  className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
                >
                  {processing ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Downgrade from Full Resume to Free (WARNING) */}
        {showDowngradeModal === 'free_warning' && (
          <div className="fixed inset-0 bg-white bg-opacity-80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-8 max-w-md w-full shadow-2xl border-2 border-red-400">
              <h3 className="text-2xl font-bold text-red-900 mb-4">⚠️ Warning: You'll Lose Your Work</h3>
              <p className="text-gray-700 mb-4 font-semibold">
                You'll lose ALL job-specific resumes. Only your core resume will be saved.
              </p>
              <p className="text-sm text-gray-600 mb-4">
                Consider <strong>Maintenance Mode ($4.99/month)</strong> instead—it keeps all your customized resumes safe.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => setShowDowngradeModal(TIERS.MAINTENANCE)}
                  className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 font-medium"
                >
                  Switch to Maintenance ($4.99) - Recommended
                </button>
                <button
                  onClick={() => handleDowngrade(TIERS.FREE)}
                  disabled={processing}
                  className="w-full bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 font-medium disabled:opacity-50"
                >
                  {processing ? 'Processing...' : 'I Understand - Downgrade to Free'}
                </button>
                <button
                  onClick={() => setShowDowngradeModal(null)}
                  disabled={processing}
                  className="w-full bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 font-medium disabled:opacity-50"
                >
                  Cancel
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
              <p className="text-gray-700 mb-4">
                We're sorry to see you go! Help us improve by telling us why you're cancelling.
              </p>
              <textarea
                value={cancelFeedback}
                onChange={(e) => setCancelFeedback(e.target.value)}
                placeholder="What could we have done better? (optional)"
                className="w-full border border-gray-300 rounded-lg p-3 h-24 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-4"
              />
              <p className="text-sm text-red-600 mb-6">
                Your subscription will be cancelled immediately and you'll lose access to paid features.
              </p>
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
                  {processing ? 'Cancelling...' : 'Cancel Subscription'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}