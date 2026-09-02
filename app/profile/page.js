'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import MainNav from '../components/MainNav'
import { TIERS } from '@/lib/subscription'
import UpgradeModal from '../components/UpgradeModal'
import SuccessToast from '../components/SuccessToast'
import ErrorToast from '../components/ErrorToast'
import { fetchJSON } from '@/lib/fetchJSON'

export default function Profile() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [displayName, setDisplayName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const supabase = createClient()

  const [showDowngradeModal, setShowDowngradeModal] = useState(false)
  const [showAnnualModal, setShowAnnualModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [cancelFeedback, setCancelFeedback] = useState('')
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [processing, setProcessing] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [toastSuccess, setToastSuccess] = useState('')
  const [toastError, setToastError] = useState('')
  const [subscriptionDetails, setSubscriptionDetails] = useState(null)

  // Voice and privacy. voiceMode is the mode of their most recent practice
  // session, which is what "last used" means to someone reading this card.
  const [voiceMode, setVoiceMode] = useState(null)
  const [consentRecords, setConsentRecords] = useState([])
  const [showDeleteVoiceModal, setShowDeleteVoiceModal] = useState(false)
  const [voiceDeleting, setVoiceDeleting] = useState(false)

  // What each mode did with their audio, said from the outside. mode_3 is
  // here because "last used" can honestly be the mode that records nothing.
  const VOICE_MODE_LABELS = {
    mode_1: 'Voice with playback. Answers recorded and stored',
    mode_2: 'Voice only. Audio never stored',
    mode_3: 'Text only. Microphone never used'
  }

  const formatConsentDate = (iso) => {
    if (!iso) return ''
    try {
      return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    } catch {
      return ''
    }
  }

  // Recordings sit two levels down, one folder per session, so the user's
  // folder holds prefixes rather than files. Listing it once and removing what
  // comes back would delete nothing and report success.
  const deleteAllVoiceData = async () => {
    if (!user?.id || voiceDeleting) return
    setVoiceDeleting(true)
    try {
      const { data: sessionFolders, error: listError } = await supabase.storage
        .from('interview-audio')
        .list(user.id)
      if (listError) throw listError

      const paths = []
      for (const folder of sessionFolders || []) {
        const { data: recordings, error: filesError } = await supabase.storage
          .from('interview-audio')
          .list(`${user.id}/${folder.name}`)
        if (filesError) throw filesError
        ;(recordings || []).forEach(file => {
          paths.push(`${user.id}/${folder.name}/${file.name}`)
        })
      }

      if (paths.length > 0) {
        const { error: removeError } = await supabase.storage
          .from('interview-audio')
          .remove(paths)
        if (removeError) throw removeError
      }

      // Nothing stored is the same outcome they asked for, so an empty folder
      // reports success rather than an error about a request that was already
      // satisfied.
      setShowDeleteVoiceModal(false)
      setToastSuccess('Voice data deleted.')
    } catch (err) {
      console.error('Voice data delete failed:', err)
      setShowDeleteVoiceModal(false)
      setToastError("We couldn't delete your voice data. Try again, or contact support.")
    } finally {
      setVoiceDeleting(false)
    }
  }

  // Password strength: returns { score: 0-3, label, color, width }
  const getPasswordStrength = (password) => {
    if (!password) return null;
    const len = password.length;
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSymbol = /[^a-zA-Z0-9]/.test(password);
    const variety = [hasLetter, hasNumber, hasSymbol].filter(Boolean).length;
    if (len < 8) return { score: 0, label: 'Too short', color: '#ef4444', width: '25%' };
    if (len >= 12 || (len >= 10 && variety >= 2)) return { score: 3, label: 'Strong', color: '#10b981', width: '100%' };
    if (len >= 10 || (len >= 8 && variety >= 2)) return { score: 2, label: 'Good', color: '#f59e0b', width: '66%' };
    return { score: 1, label: 'Weak', color: '#f59e0b', width: '40%' };
  };

  // Change Password modal
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [changePasswordLoading, setChangePasswordLoading] = useState(false)
  const [changePasswordError, setChangePasswordError] = useState('')

  const [editingEmail, setEditingEmail] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [vaultBillingInterval, setVaultBillingInterval] = useState('monthly')
  // Holds 'monthly' | 'annual' while we confirm a ?plan=vault deep link.
  const [vaultCheckoutPrompt, setVaultCheckoutPrompt] = useState(null)

  useEffect(() => { loadProfile() }, [])

  // Voice and privacy data. Read-only, and a failure costs the card rather
  // than the page: someone here to change their password should not be
  // stopped by a consent list that would not load.
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false

    async function loadVoiceData() {
      const { data: lastSession, error: sessionError } = await supabase
        .from('interview_sessions')
        .select('voice_mode')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!cancelled) {
        if (sessionError) console.error('Voice mode load failed:', sessionError)
        else setVoiceMode(lastSession?.voice_mode ?? null)
      }

      const { data: consents, error: consentError } = await supabase
        .from('user_voice_consent')
        .select('id, mode_selected, consented_at')
        .eq('user_id', user.id)
        .order('consented_at', { ascending: false })
      if (!cancelled) {
        if (consentError) console.error('Voice consent history load failed:', consentError)
        else setConsentRecords(consents || [])
      }
    }

    loadVoiceData()
    return () => { cancelled = true }
  }, [user?.id, supabase])

  // Detect email change confirmation redirect from Supabase
  useEffect(() => {
    if (typeof window === 'undefined') return

    // PKCE flow: Supabase lands on /profile?code=xxx
    const searchParams = new URLSearchParams(window.location.search)
    const code = searchParams.get('code')
    if (code) {
      window.history.replaceState({}, '', '/profile')
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (!error) {
          setToastSuccess('Your email has been updated successfully.')
          loadProfile()
        }
      })
      return
    }

    // Implicit flow: Supabase lands on /profile#type=email_change&access_token=...
    const hash = window.location.hash
    if (hash) {
      const hashParams = new URLSearchParams(hash.substring(1))
      if (hashParams.get('type') === 'email_change') {
        window.history.replaceState({}, '', '/profile')
        setToastSuccess('Your email has been updated successfully.')
        loadProfile()
      }
    }
  }, [])

  // Auto-open upgrade modal when arriving from email link (?upgrade=true)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('upgrade') === 'true') {
      setShowUpgradeModal(true)
      // Strip the param so a refresh doesn't re-trigger
      params.delete('upgrade')
      const newUrl = window.location.pathname + (params.toString() ? `?${params.toString()}` : '')
      window.history.replaceState({}, '', newUrl)
    }
  }, [])

  // Offer Vault checkout when arriving from an email link (?plan=vault).
  // Waits for the profile to load so we can check the tier first: an existing
  // Vault subscriber doesn't need a second one, and a Pro user would end up
  // paying for two subscriptions since checkout opens a new one rather than
  // converting the existing plan. Everyone else gets a confirmation prompt —
  // a link click should never put someone straight into Stripe.
  useEffect(() => {
    if (typeof window === 'undefined' || loading || !user) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('plan') !== 'vault') return
    const interval = params.get('interval') === 'annual' ? 'annual' : 'monthly'
    // Strip the params so a refresh doesn't re-trigger
    params.delete('plan')
    params.delete('interval')
    const newUrl = window.location.pathname + (params.toString() ? `?${params.toString()}` : '')
    window.history.replaceState({}, '', newUrl)

    const currentTier = profile?.subscription_tier || TIERS.FREE
    if (currentTier === TIERS.VAULT) {
      setToastSuccess("You're already subscribed to Career Vault.")
      return
    }
    if (currentTier === TIERS.PRO) {
      setToastSuccess('Your Pro plan already includes Career Vault.')
      return
    }
    setVaultCheckoutPrompt(interval)
  }, [loading, user, profile])

  // Send the user to Stripe checkout for Vault at the requested billing interval.
  async function startVaultCheckout(interval = 'monthly') {
    try {
      setProcessing(true)
      const { data: { session } } = await supabase.auth.getSession()
      const { data: prof } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', user.id)
        .maybeSingle()
      const data = await fetchJSON('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          priceId: interval === 'annual'
            ? process.env.NEXT_PUBLIC_STRIPE_VAULT_ANNUAL_PRICE_ID
            : process.env.NEXT_PUBLIC_STRIPE_VAULT_PRICE_ID,
          userId: user.id,
          email: prof?.email || user.email,
        })
      })
      if (!data.url) {
        throw new Error("We couldn't start checkout. Please try again in a moment.")
      }
      window.location.href = data.url
      // Deliberately leaves `processing` set — the redirect is in flight and the
      // confirm button should stay disabled until the browser navigates away.
    } catch (err) {
      setVaultCheckoutPrompt(null)
      setProcessing(false)
      setToastError(err.message)
    }
  }

  async function loadProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/dashboard'); return }
      setUser(user)
      const { data: p, error: pError } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
      if (pError) {
        console.error('Profile load failed:', pError)
        setToastError("We couldn't load your profile. Please refresh the page.")
      }
      if (p) {
        setProfile(p)
        setFirstName(p.first_name || '')
        setLastName(p.last_name || '')
        setDisplayName(p.display_name || user.email.split('@')[0])
        setPhotoUrl(p.photo_url || '')
        if (p.subscription_tier && p.subscription_tier !== 'free') {
          try {
            const { data: { session } } = await supabase.auth.getSession()
            if (session?.access_token) {
              const subData = await fetchJSON('/api/stripe/subscription-details', {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
              })
              setSubscriptionDetails(subData)
            }
          } catch (e) {
            console.error('Subscription details fetch failed:', e)
          }
        }
      } else {
        setDisplayName(user.email.split('@')[0])
      }
      setLoading(false)
    } catch (e) {
      console.error(e)
      setToastError("We couldn't load your profile. Please refresh the page.")
      setLoading(false)
    }
  }

  async function uploadPhoto(event) {
    try {
      setUploading(true)
      const file = event.target.files[0]
      if (!file) return
      if (!file.type.startsWith('image/')) {
        setToastError("That file isn't an image. Please choose a JPG or PNG.")
        return
      }
      if (file.size > 2 * 1024 * 1024) {
        setToastError("That image is too large. Please choose one under 2 MB.")
        return
      }
      const fileName = `${user.id}-${Date.now()}.${file.name.split('.').pop()}`
      const { error } = await supabase.storage.from('profile-photos').upload(fileName, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from('profile-photos').getPublicUrl(fileName)
      setPhotoUrl(data.publicUrl)
    } catch (e) {
      console.error(e)
      setToastError("We couldn't upload your photo. Please try again.")
    } finally {
      setUploading(false)
    }
  }

  async function saveProfile() {
    try {
      setSaving(true)
      if (editingEmail && newEmail && newEmail !== user?.email) {
        const { error } = await supabase.auth.updateUser(
          { email: newEmail },
          { emailRedirectTo: window.location.origin + '/profile' }
        )
        if (error) {
          setToastError(error.message)
        } else {
          setToastSuccess('A confirmation link has been sent to your new email address. Please check your inbox to complete the change.')
        }
      }
      setEditingEmail(false)
      setNewEmail('')
      const computedDisplayName = `${firstName.trim()} ${lastName.trim()}`.trim() || displayName
      const { error } = await supabase.from('profiles')
        .upsert({ id: user.id, first_name: firstName.trim(), last_name: lastName.trim(), display_name: computedDisplayName, photo_url: photoUrl, updated_at: new Date().toISOString() })
      if (error) throw error
      await loadProfile()
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2500)
    } catch (e) {
      console.error(e)
      setToastError("We couldn't save your changes. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDowngrade() {
    try {
      setProcessing(true)
      const vaultPriceId = vaultBillingInterval === 'annual'
        ? process.env.NEXT_PUBLIC_STRIPE_VAULT_ANNUAL_PRICE_ID
        : process.env.NEXT_PUBLIC_STRIPE_VAULT_PRICE_ID
      const { data: { session: downgradeSession } } = await supabase.auth.getSession()
      const data = await fetchJSON('/api/stripe/downgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${downgradeSession.access_token}` },
        body: JSON.stringify({ userId: user.id, vaultPriceId })
      })
      setShowDowngradeModal(false)
      setVaultBillingInterval('monthly')
      await loadProfile()
      const dateStr = data.scheduled_date
        ? new Date(data.scheduled_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        : 'the end of your billing period'
      setToastSuccess(`Switch to Vault (${vaultBillingInterval}) confirmed. Pro access continues through ${dateStr}.`)
    } catch (e) {
      setToastError(e.message)
    } finally {
      setProcessing(false)
    }
  }

  // Swap the existing Vault subscription onto the annual price. Deliberately not
  // a new checkout session — that would leave the user paying for two.
  async function handleSwitchToAnnual() {
    try {
      setProcessing(true)
      const { data: { session } } = await supabase.auth.getSession()
      await fetchJSON('/api/stripe/update-billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ userId: user.id, priceId: process.env.NEXT_PUBLIC_STRIPE_VAULT_ANNUAL_PRICE_ID })
      })
      setShowAnnualModal(false)
      await loadProfile()
      setToastSuccess("You're on annual Vault — $49.99/year. We've prorated the change.")
    } catch (e) {
      setToastError(e.message)
    } finally {
      setProcessing(false)
    }
  }

  async function handleCancel() {
    try {
      setProcessing(true)
      const { data: { session: cancelSession } } = await supabase.auth.getSession()
      const data = await fetchJSON('/api/stripe/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cancelSession.access_token}` },
        body: JSON.stringify({ userId: user.id, feedback: cancelFeedback })
      })
      setShowCancelModal(false)
      setCancelFeedback('')
      await loadProfile()
      const dateStr = data.scheduled_date
        ? new Date(data.scheduled_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        : 'the end of your billing period'
      setToastSuccess(`Cancellation confirmed. Your current plan continues through ${dateStr}.`)
    } catch (e) {
      setToastError(e.message)
    } finally {
      setProcessing(false)
    }
  }

  async function handleExportData() {
    try {
      setExportLoading(true)
      const [resumesRes, profileRes, careerRes] = await Promise.all([
        supabase.from('resumes').select('*').eq('user_id', user.id),
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('career_context').select('*').eq('user_id', user.id).maybeSingle(),
      ])
      if (resumesRes.error || profileRes.error || careerRes.error) {
        console.error('Export query errors:', { resumesRes: resumesRes.error, profileRes: profileRes.error, careerRes: careerRes.error })
        setToastError("We couldn't export some of your data. Please try again.")
        return
      }
      const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), profile: profileRes.data, career_context: careerRes.data, resumes: resumesRes.data }, null, 2)], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `hire-power-data-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      setShowExportModal(false)
    } catch (e) {
      console.error(e)
      setToastError("We couldn't export your data. Please try again.")
    } finally {
      setExportLoading(false)
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText !== 'DELETE') return
    try {
      setProcessing(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setToastError("Your session expired. Please sign in again.")
        return
      }
      await fetchJSON('/api/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      })
      await supabase.auth.signOut()
      router.push('/landing')
    } catch (e) {
      console.error(e)
      setToastError("We couldn't delete your account. Please try again, or email hired@hirepowerai.com if it keeps failing.")
    } finally {
      setProcessing(false)
    }
  }

  const tierLabel = { [TIERS.FREE]: 'Free', [TIERS.PRO]: 'Pro', [TIERS.VAULT]: 'Vault' }
  const tierColor = { [TIERS.FREE]: '#6b7280', [TIERS.PRO]: '#7c3aed', [TIERS.VAULT]: '#7c3aed' }
  const tierBg    = { [TIERS.FREE]: '#f3f4f6', [TIERS.PRO]: '#faf5ff', [TIERS.VAULT]: '#faf5ff' }
  const tierBorder = { [TIERS.FREE]: '#e5e7eb', [TIERS.PRO]: '#e9d5ff', [TIERS.VAULT]: '#e9d5ff' }

  const cardBase = {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 18,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  }

  const cardHeader = (gradient) => ({
    background: gradient || 'linear-gradient(135deg,#f5f3ff,#ede9fe)',
    borderBottom: '1px solid #ede9fe',
    padding: '10px 16px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  })

  const cardTitle = { fontSize: 11, fontWeight: 900, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.07em' }
  const cardBody  = { padding: '14px 16px', flex: 1 }
  const labelSm   = { fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3, display: 'block' }
  const valueSm   = { fontSize: 13, fontWeight: 600, color: '#111827' }
  const inputSm   = { width: '100%', padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, color: '#111827', outline: 'none', background: '#fff', boxSizing: 'border-box' }
  const inputDis  = { ...inputSm, background: '#f9fafb', color: '#9ca3af', cursor: 'not-allowed' }

  const btnPurple  = { background: 'linear-gradient(135deg,#9333ea,#6b21a8)', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }
  const btnOutline = { background: '#fff', color: '#7c3aed', border: '1.5px solid #c4b5fd', borderRadius: 7, padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }
  const btnGhost   = { background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 7, padding: '6px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }
 const btnRed     = { background: '#fff', color: '#e57373', border: '1.5px solid #e57373', borderRadius: 7, padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }
  const btnRedSolid= { background: '#e57373', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }
  const btnOrange  = { background: '#fff', color: '#6b7280', border: '1.5px solid #e5e7eb', borderRadius: 7, padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }

  const modalOverlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }
  const modalBox     = { background: '#fff', borderRadius: 12, width: '100%', maxWidth: 420, boxShadow: '0 25px 50px rgba(0,0,0,0.2)', overflow: 'hidden' }
  const modalHead    = (grad) => ({ background: grad || 'linear-gradient(135deg,#9333ea,#6b21a8)', padding: '18px 22px' })
  const modalBody    = { padding: '20px 22px' }
  const modalTitle   = { fontSize: 16, fontWeight: 800, color: '#fff', margin: 0 }
  const modalSub     = { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 3 }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600"></div>
    </div>
  )

  const tier = profile?.subscription_tier || TIERS.FREE
  const initials = displayName.charAt(0).toUpperCase()

  // Only offer the annual switch to someone we can confirm is on the monthly Vault price.
  const isMonthlyVault = tier === TIERS.VAULT &&
    subscriptionDetails?.price_id === process.env.NEXT_PUBLIC_STRIPE_VAULT_PRICE_ID

  return (
    <div className="h-screen bg-gray-50 flex">

      {/* ── SIDEBAR ── */}
      <div
        className="hp-profile-sidebar w-64 text-white flex flex-col fixed left-0 top-0 shadow-lg z-40"
        style={{ background: 'linear-gradient(180deg, #667eea 0%, #764ba2 100%)', height: '100vh', overflowY: 'hidden' }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex-shrink-0">
          <h1 className="text-[28px] font-bold mb-1.5 tracking-tight">Profile</h1>
          <div className="mt-4 border-b border-gray-400 border-opacity-10"></div>
        </div>

        {/* Avatar + plan badge */}
        <div className="px-6 pt-3 pb-2 flex-shrink-0">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '12px 0' }}>
            {photoUrl ? (
              <img src={photoUrl} alt="Profile" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(255,255,255,0.4)' }} />
            ) : (
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', border: '3px solid rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 800, color: '#fff' }}>
                {initials}
              </div>
            )}
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 4 }}>{displayName}</p>
              <span style={{
                display: 'inline-block',
                fontSize: 10, fontWeight: 800,
                padding: '3px 10px', borderRadius: 20,
                background: tierBg[tier], color: tierColor[tier],
                border: `1.5px solid ${tierBorder[tier]}`,
                letterSpacing: '0.04em', textTransform: 'uppercase'
              }}>
                {tierLabel[tier]}
              </span>
              {profile?.pending_change_type && profile?.pending_change_date && (
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 6, lineHeight: 1.3 }}>
                  {profile.pending_change_type === 'downgrade' ? 'Switching to Vault' : 'Cancelling'} on {new Date(profile.pending_change_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              )}
            </div>
          </div>
          <div className="border-b border-gray-400 border-opacity-10 mt-2"></div>
        </div>

        {/* Body */}
        <div className="flex-1 px-6 pt-3 pb-6 flex flex-col justify-between">
          <div>
            <div className="mb-5">
              <h4 className="text-sm font-bold uppercase tracking-wider text-white mb-2">YOUR ACCOUNT</h4>
              <ul className="space-y-1.5 text-sm">
                <li className="flex items-start"><span className="mr-2">•</span><span>Personal info and photo</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Career context snapshot</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Plan and billing</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Account settings</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Voice and privacy</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Data export and privacy</span></li>
              </ul>
            </div>
          </div>

          <div className="mt-auto">
            <div className="mb-3 border-b border-gray-400 border-opacity-10"></div>
            <div className="flex items-center gap-2.5 text-white">
              <img src="/images/Hire_Power_icon.png" alt="Lightning" className="h-5 w-auto flex-shrink-0" />
              <p className="text-sm font-medium leading-tight">Your lifelong career coach</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN ── */}
      <div className="hp-profile-main ml-64 flex-1 flex flex-col h-screen overflow-hidden">
        <MainNav currentPage="profile" userProfile={profile} />
        {/* Mobile top bar */}
        <div className="hp-mobile-top" style={{ padding: '14px 20px 12px', borderBottom: '1px solid rgba(0,0,0,0.06)', background: 'white' }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0D0D0D', letterSpacing: '-0.5px', marginBottom: 2 }}>Profile</h1>
          <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.4 }}>Update your account settings, personal info, and billing.</p>
        </div>

        <div className="hp-profile-scroll flex-1 overflow-hidden">
          <div className="hp-profile-inner" style={{ padding: '16px 24px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* SINGLE ROW: Left stack | Right stack */}
            <div className="hp-row" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 12, flex: '0 0 auto', alignItems: 'stretch' }}>

              {/* LEFT STACK: Personal Info + Career Context + Your Career Your Info + Voice & Privacy */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>

                {/* PERSONAL INFO */}
                <div style={cardBase}>
                  <div style={cardHeader()}>
                    <span style={cardTitle}>Personal Information</span>
                  </div>
                  <div style={{ ...cardBody, display: 'flex', flexDirection: 'column', gap: 29, paddingTop: 14, paddingBottom: 24 }}>
                    <div className="hp-photo-fields-row" style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                      {/* Photo */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        {photoUrl ? (
                          <img src={photoUrl} alt="Profile" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '2px solid #e9d5ff' }} />
                        ) : (
                          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg,#9333ea,#6b21a8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: '#fff' }}>
                            {initials}
                          </div>
                        )}
                        <label style={{ ...btnOutline, fontSize: 10, padding: '4px 8px', cursor: 'pointer' }}>
                          {uploading ? '...' : 'Photo'}
                          <input type="file" accept="image/*" onChange={uploadPhoto} disabled={uploading} style={{ display: 'none' }} />
                        </label>
                      </div>
                      {/* Fields */}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div className="hp-name-email-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <div>
                            <label style={labelSm}>First Name</label>
                            <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={inputSm} placeholder="First" />
                            <p style={{ fontSize: 10, color: '#9ca3af', marginTop: 3 }}>What Coach will call you</p>
                          </div>
                          <div>
                            <label style={labelSm}>Last Name</label>
                            <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} style={inputSm} placeholder="Last" />
                            <p style={{ fontSize: 10, color: '#9ca3af', marginTop: 3 }}>&nbsp;</p>
                          </div>
                        </div>
                        <div className="hp-email-desktop">
                          <label style={labelSm}>Email</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {editingEmail ? (
                              <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} style={{ ...inputSm, flex: 1 }} placeholder="New email address" autoFocus />
                            ) : (
                              <input type="email" value={user?.email || ''} disabled style={{ ...inputDis, flex: 1 }} />
                            )}
                            <button
                              onClick={editingEmail ? () => { setEditingEmail(false); setNewEmail(''); } : () => { setNewEmail(user?.email || ''); setEditingEmail(true); }}
                              style={{ ...btnOutline, fontSize: 10, padding: '4px 8px', whiteSpace: 'nowrap' }}
                            >
                              {editingEmail ? 'Cancel' : 'Edit'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="hp-email-mobile" style={{ display: 'none' }}>
                      <label style={labelSm}>Email</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {editingEmail ? (
                          <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} style={{ ...inputSm, flex: 1 }} placeholder="New email address" />
                        ) : (
                          <input type="email" value={user?.email || ''} disabled style={{ ...inputDis, flex: 1 }} />
                        )}
                        <button
                          onClick={editingEmail ? () => { setEditingEmail(false); setNewEmail(''); } : () => { setNewEmail(user?.email || ''); setEditingEmail(true); }}
                          style={{ ...btnOutline, fontSize: 10, padding: '4px 8px', whiteSpace: 'nowrap' }}
                        >
                          {editingEmail ? 'Cancel' : 'Edit'}
                        </button>
                      </div>
                    </div>
                    <div className="hp-save-row" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
                      {saveSuccess && <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a' }}>Saved!</span>}
                      <button onClick={saveProfile} disabled={saving} style={{ ...btnPurple, opacity: saving ? 0.6 : 1 }}>
                        {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                </div>

                {false && (
                /* CAREER CONTEXT */
                <div style={cardBase}>
                  <div style={cardHeader()}>
                    <span style={cardTitle}>Career Context</span>
                  </div>
                  <div style={{ ...cardBody, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div className="hp-career-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={labelSm}>Current Role</label>
                        <p style={{ ...valueSm, color: profile?.current_role ? '#111827' : '#d1d5db' }}>
                          {profile?.current_role || 'Set in Career Coach'}
                        </p>
                      </div>
                      <div>
                        <label style={labelSm}>Experience Level</label>
                        <p style={{ ...valueSm, color: profile?.experience_level ? '#111827' : '#d1d5db' }}>
                          {profile?.experience_level
                            ? profile.experience_level.charAt(0).toUpperCase() + profile.experience_level.slice(1)
                            : 'Auto-detected'}
                        </p>
                      </div>
                      <div>
                        <label style={labelSm}>Target Roles</label>
                        <p style={{ ...valueSm, color: profile?.target_roles?.length ? '#111827' : '#d1d5db', fontSize: 12 }}>
                          {Array.isArray(profile?.target_roles) && profile.target_roles.length
                            ? profile.target_roles.slice(0, 2).join(', ')
                            : 'Set in Career Coach'}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button onClick={() => router.push('/career-coach')} style={btnOutline}>Update in Career Coach</button>
                    </div>
                  </div>
                </div>
                )}

                {/* YOUR CAREER YOUR INFO */}
                <div style={{ ...cardBase, flex: 1 }}>
                  <div style={cardHeader()}>
                    <span style={cardTitle}>Your career. Your info.</span>
                  </div>
                  <div style={{ ...cardBody, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <p style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.5 }}>
                      We believe in transparency, so you'll never have to dig for these. 
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ ...btnOutline, flex: 1, textAlign: 'center', textDecoration: 'none' }}>
                        Privacy Policy
                      </a>
                      <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ ...btnOutline, flex: 1, textAlign: 'center', textDecoration: 'none' }}>
                        Terms of Service
                      </a>
                    </div>
                  </div>
                </div>

                {/* VOICE & PRIVACY */}
                <div style={cardBase}>
                  <div style={cardHeader()}>
                    <span style={cardTitle}>Voice &amp; Privacy</span>
                  </div>
                  <div style={cardBody}>
                    <p style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.4, marginBottom: 14 }}>
                      <span style={{ fontWeight: 700, color: '#374151' }}>Last interview mode:</span>{' '}
                      {VOICE_MODE_LABELS[voiceMode] || "You haven't practiced an interview yet."}
                    </p>

                    {/* One record reads as a sentence, so the label leads it.
                        Several need the label to stand over them instead. */}
                    {consentRecords.length === 1 && (
                      <p style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.4, marginBottom: 14 }}>
                        <span style={{ fontWeight: 700, color: '#374151' }}>Consent history:</span>{' '}
                        {VOICE_MODE_LABELS[consentRecords[0].mode_selected] || consentRecords[0].mode_selected}
                        {' - '}
                        {formatConsentDate(consentRecords[0].consented_at)}
                      </p>
                    )}

                    {consentRecords.length > 1 && (
                      <div style={{ marginBottom: 14 }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#374151', lineHeight: 1.4 }}>
                          Consent history:
                        </p>
                        {consentRecords.map(record => (
                          <p key={record.id} style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.4 }}>
                            {VOICE_MODE_LABELS[record.mode_selected] || record.mode_selected}
                            {' - '}
                            {formatConsentDate(record.consented_at)}
                          </p>
                        ))}
                      </div>
                    )}

                    <p style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.4, marginBottom: 8 }}>
                      Deleting your recordings does not affect your transcripts, scores, or feedback.
                    </p>
                    <button
                      onClick={() => setShowDeleteVoiceModal(true)}
                      style={btnRed}
                    >
                      Delete All Voice Data
                    </button>
                  </div>
                </div>

              </div>
              {/* END LEFT STACK */}

              {/* RIGHT STACK: Plan + Account + Danger Zone */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                {/* PLAN */}
                <div style={cardBase}>
                  <div style={cardHeader()}>
                    <span style={cardTitle}>Plan</span>
                  </div>
                  <div style={cardBody}>
                    {/* Tier badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: tierBg[tier], border: `1px solid ${tierBorder[tier]}`, borderRadius: 10, marginBottom: 12 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: tierColor[tier], flexShrink: 0 }}></div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, fontWeight: 800, color: tierColor[tier] }}>
                          {tier === TIERS.VAULT ? 'Career Vault' : `Hire Power ${tierLabel[tier]}`}
                        </p>
                        <p style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>
                          {tier === TIERS.FREE && 'Always free. Limited features'}
                          {tier === TIERS.PRO && '$29.99/month · All features unlocked'}
                          {tier === TIERS.VAULT && (
                            subscriptionDetails?.price_id === process.env.NEXT_PUBLIC_STRIPE_VAULT_ANNUAL_PRICE_ID
                              ? '$49.99/year · Career Vault access'
                              : '$4.99/month · Career Vault access'
                          )}
                        </p>
                        {subscriptionDetails?.current_period_end && !profile?.pending_change_type && (
                          <p style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                            Renews on {new Date(subscriptionDetails.current_period_end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                          </p>
                        )}
                      </div>
                      {tier === TIERS.FREE && (
                        <button onClick={() => setShowUpgradeModal(true)} style={btnPurple}>Upgrade to Pro</button>
                      )}
                    </div>

                    {/* Pending change banner */}
                    {profile?.pending_change_type && profile?.pending_change_date && (
                      <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: '#92400e', marginBottom: 2 }}>
                          {profile.pending_change_type === 'downgrade' ? 'Switching to Vault' : 'Cancellation scheduled'}
                        </p>
                        <p style={{ fontSize: 11, color: '#78350f', lineHeight: 1.4 }}>
                          {profile.pending_change_type === 'downgrade'
                            ? `Your Pro plan continues through ${new Date(profile.pending_change_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. After that, you'll switch to Vault for $4.99/month.`
                            : `Your Pro plan continues through ${new Date(profile.pending_change_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. After that, your account will be downgraded to Free.`
                          }
                        </p>
                      </div>
                    )}

                    {/* Actions */}
                    {tier === TIERS.PRO && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <p style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.4, marginBottom: 4 }}>Between job searches? Store your career history in Vault for $4.99/month. We'll build your next resume while you're building your career.</p>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => setShowDowngradeModal(true)} style={{ ...btnOutline, flex: 1 }}>Switch to Vault</button>
                          <button onClick={() => setShowCancelModal(true)} style={{ ...btnRed, flex: 1, color: '#e57373', borderColor: '#e57373' }}>Cancel Subscription</button>
                        </div>
                      </div>
                    )}
                    {tier === TIERS.VAULT && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {isMonthlyVault && (
                          <button
                            onClick={() => setShowAnnualModal(true)}
                            disabled={processing}
                            style={{ ...btnPurple, width: '100%', background: 'linear-gradient(135deg,#667eea,#764ba2)', opacity: processing ? 0.6 : 1 }}
                          >
                            {processing ? 'Switching...' : 'Switch to Annual — $49.99/yr'}
                          </button>
                        )}
                        <p style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.4, marginBottom: 4 }}>Ready for your next search? Unlock full coaching.</p>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => setShowUpgradeModal(true)} style={{ ...btnPurple, flex: 1 }}>Upgrade to Pro</button>
                          <button onClick={() => setShowCancelModal(true)} style={{ ...btnRed, flex: 1 }}>Cancel Subscription</button>
                        </div>
                      </div>
                    )}
                    
                  </div>
                </div>

                {/* ACCOUNT */}
                <div style={cardBase}>
                  <div style={cardHeader()}>
                    <span style={cardTitle}>Account</span>
                  </div>
                  <div style={{ ...cardBody, display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => setShowChangePasswordModal(true)}
                      style={{ ...btnOutline, flex: 1, textAlign: 'center' }}
                    >
                      Change Password
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          const { error } = await supabase.auth.signOut()
                          if (error) throw error
                          router.push('/dashboard')
                        } catch (e) {
                          console.error('Sign out failed:', e)
                          setToastError("We couldn't sign you out. Please try again.")
                        }
                      }}
                      style={{ ...btnGhost, flex: 1, textAlign: 'center' }}
                    >
                      Sign Out
                    </button>
                  </div>
                </div>

                {/* DANGER ZONE */}
                <div style={{ ...cardBase, border: '1px solid #fecaca' }}>
                  <div style={cardHeader('linear-gradient(135deg,#fff5f5,#fee2e2)')}>
                    <span style={{ ...cardTitle, color: '#e57373' }}>Danger Zone</span>
                  </div>
                  <div style={{ ...cardBody, display: 'flex', gap: 8 }}>
                    <button onClick={() => setShowExportModal(true)} style={{ ...btnOrange, flex: 1, textAlign: 'center' }}>
                      Export Data
                    </button>
                    <button onClick={() => setShowDeleteModal(true)} style={{ ...btnRedSolid, flex: 1, textAlign: 'center' }}>
                      Delete Account
                    </button>
                  </div>
                </div>

              </div>
              {/* END RIGHT STACK */}

            </div>

          </div>
        </div>
        
      </div>

      <style>{`
        @media (max-width: 768px) {
          .hp-profile-sidebar { display: none !important; }
          .hp-profile-main { margin-left: 0 !important; height: auto !important; overflow: auto !important; flex-direction: column !important; }
          .hp-profile-scroll { overflow: visible !important; height: auto !important; }
          .hp-profile-inner { height: auto !important; overflow: visible !important; }
          .hp-row { grid-template-columns: 1fr !important; }
          .hp-career-grid { grid-template-columns: 1fr !important; }
          .hp-name-email-grid { grid-template-columns: 1fr !important; }
          .hp-mobile-top { display: block !important; }
          .hp-photo-fields-row { align-items: flex-start !important; }
          .hp-save-row { justify-content: center !important; }
          .hp-email-desktop { display: none !important; }
          .hp-email-mobile { display: block !important; }

          /* Mobile font-size bumps — desktop unaffected (rules only apply <=768px) */
          .hp-mobile-top p { font-size: 16px !important; }
          .hp-profile-inner span[style*="text-transform: uppercase"][style*="letter-spacing"] { font-size: 12px !important; }
          .hp-profile-inner label { font-size: 12px !important; }
          .hp-profile-inner p[style*="font-size: 10px"],
          .hp-profile-inner p[style*="fontSize: 10"] { font-size: 12px !important; }
          .hp-profile-inner p[style*="font-size: 11px"],
          .hp-profile-inner p[style*="fontSize: 11"] { font-size: 13px !important; }
          .hp-profile-inner p[style*="font-size: 13px"],
          .hp-profile-inner p[style*="fontSize: 13"] { font-size: 16px !important; }
          .hp-profile-inner input[type="text"],
          .hp-profile-inner input[type="email"] { font-size: 16px !important; }
          .hp-profile-inner button { font-size: 13px !important; }
          .hp-profile-inner span[style*="color: rgb(22, 163, 74)"],
          .hp-profile-inner span[style*="#16a34a"] { font-size: 13px !important; }
        }
        @media (min-width: 769px) {
          .hp-mobile-top { display: none !important; }
          .hp-mobile-bottom { display: none !important; }
        }
      `}</style>

      {/* ── VAULT CHECKOUT CONFIRMATION (?plan=vault deep link) ── */}
      {vaultCheckoutPrompt && (
        <div style={modalOverlay}>
          <div style={modalBox}>
            <div style={modalHead()}>
              <p style={modalTitle}>Subscribe to Career Vault?</p>
              <p style={modalSub}>{vaultCheckoutPrompt === 'annual' ? '$49.99/year · Save 2 months' : '$4.99/month between job searches'}</p>
            </div>
            <div style={modalBody}>
              <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.5, marginBottom: 18 }}>
                You&apos;re about to subscribe to Career Vault at {vaultCheckoutPrompt === 'annual' ? '$49.99/year' : '$4.99/month'}. Continue?
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setVaultCheckoutPrompt(null)}
                  disabled={processing}
                  style={{ ...btnGhost, flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => startVaultCheckout(vaultCheckoutPrompt)}
                  disabled={processing}
                  style={{ ...btnPurple, flex: 1, background: 'linear-gradient(135deg,#667eea,#764ba2)', opacity: processing ? 0.6 : 1 }}
                >
                  {processing ? 'Starting checkout...' : 'Yes, subscribe'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SWITCH TO ANNUAL MODAL ── */}
      {showAnnualModal && (
        <div style={modalOverlay}>
          <div style={modalBox}>
            <div style={modalHead()}>
              <p style={modalTitle}>Switch to annual billing?</p>
              <p style={modalSub}>$49.99/year · Save 2 months</p>
            </div>
            <div style={modalBody}>
              <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.5, marginBottom: 18 }}>
                Switch to annual billing at $49.99/yr? Your current plan will be prorated.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowAnnualModal(false)} disabled={processing} style={{ ...btnGhost, flex: 1 }}>Cancel</button>
                <button
                  onClick={handleSwitchToAnnual}
                  disabled={processing}
                  style={{ ...btnPurple, flex: 1, background: 'linear-gradient(135deg,#667eea,#764ba2)', opacity: processing ? 0.6 : 1 }}
                >
                  {processing ? 'Switching...' : 'Yes, switch'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DOWNGRADE MODAL ── */}
      {showDowngradeModal && (
        <div style={modalOverlay}>
          <div style={modalBox}>
            <div style={modalHead()}>
              <p style={modalTitle}>Switch to Vault</p>
              <p style={modalSub}>{vaultBillingInterval === 'annual' ? '$49.99/year · Save 2 months' : '$4.99/month between job searches'}</p>
            </div>
           <div style={modalBody}>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#6b21a8', marginBottom: 14 }}>Three years from now, you won't remember today's achievements. But Hire Power will.</p>

              {/* Billing interval selector */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <button
                  onClick={() => setVaultBillingInterval('monthly')}
                  style={{ flex: 1, padding: '10px 8px', borderRadius: 8, border: vaultBillingInterval === 'monthly' ? '2px solid #7c3aed' : '1.5px solid #e5e7eb', background: vaultBillingInterval === 'monthly' ? '#f5f3ff' : '#fff', cursor: 'pointer', textAlign: 'center' }}
                >
                  <p style={{ fontSize: 13, fontWeight: 700, color: vaultBillingInterval === 'monthly' ? '#6b21a8' : '#374151', marginBottom: 2 }}>Monthly</p>
                  <p style={{ fontSize: 12, color: '#6b7280' }}>$4.99/month</p>
                </button>
                <button
                  onClick={() => setVaultBillingInterval('annual')}
                  style={{ flex: 1, padding: '10px 8px', borderRadius: 8, border: vaultBillingInterval === 'annual' ? '2px solid #7c3aed' : '1.5px solid #e5e7eb', background: vaultBillingInterval === 'annual' ? '#f5f3ff' : '#fff', cursor: 'pointer', textAlign: 'center' }}
                >
                  <p style={{ fontSize: 13, fontWeight: 700, color: vaultBillingInterval === 'annual' ? '#6b21a8' : '#374151', marginBottom: 2 }}>Annual</p>
                  <p style={{ fontSize: 12, color: '#6b7280' }}>$49.99/year</p>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#10b981', marginTop: 2 }}>Save 2 months</p>
                </button>
              </div>

              <p style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Switching to Vault, you'll keep:</p>
              <ul style={{ fontSize: 12, color: '#6b7280', paddingLeft: 14, marginBottom: 10, lineHeight: 1.8 }}>
                <li>All resumes and coaching conversations</li>
                <li>Career Vault achievement tracking</li>
                <li>Unlimited downloads and premium templates</li>
              </ul>

              <p style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>You just won't have access to:</p>
              <ul style={{ fontSize: 12, color: '#6b7280', paddingLeft: 14, marginBottom: 12, lineHeight: 1.8 }}>
                <li>Resume coaching and job customization</li>
                <li>Interview practice and AI feedback</li>
                <li>New resume generation</li>
              </ul>

              <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 8, padding: '10px 12px', marginBottom: 18 }}>
                <p style={{ fontSize: 11, color: '#7c3aed', lineHeight: 1.5 }}>Vault builds your next resume while you build your career. Getting back to Pro takes one click whenever you are job searching again.</p>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowDowngradeModal(false)} disabled={processing} style={{ ...btnGhost, flex: 1 }}>Keep Pro</button>
                <button onClick={handleDowngrade} disabled={processing} style={{ ...btnPurple, flex: 1, opacity: processing ? 0.6 : 1 }}>
                  {processing ? 'Processing...' : 'Switch to Vault'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CANCEL MODAL ── */}
      {showCancelModal && (
        <div style={modalOverlay}>
          <div style={modalBox}>
            <div style={modalHead()}>
              <p style={modalTitle}>Cancel Subscription?</p>
              <p style={modalSub}>You'll keep Pro access until the end of your billing period.</p>
            </div>
            <div style={modalBody}>
              {tier === TIERS.PRO && (
                <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#6b21a8', marginBottom: 3 }}>Consider Vault instead ($4.99/month)</p>
                 <p style={{ fontSize: 11, color: '#7c3aed', lineHeight: 1.4 }}>For less than a latte, never start from scratch again! Vault keeps your career history safe and lets you track wins in real time. This means while you're out building your career, we're already building your next resume.</p>
                </div>
              )}
              <p style={{ fontSize: 12, color: '#374151', marginBottom: 8 }}>Why are you cancelling? (optional)</p>
              <textarea
                value={cancelFeedback}
                onChange={(e) => setCancelFeedback(e.target.value)}
                placeholder="Help us improve..."
                style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 12, height: 70, resize: 'none', outline: 'none', marginBottom: 14, boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tier === TIERS.PRO && (
                  <button onClick={() => { setShowCancelModal(false); setShowDowngradeModal(true) }} style={{ ...btnPurple, width: '100%' }}>
                    Switch to Vault & Never Start from Scratch Again
                  </button>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { setShowCancelModal(false); setCancelFeedback('') }} disabled={processing} style={{ ...btnGhost, flex: 1 }}>Keep Subscription</button>
                  <button onClick={handleCancel} disabled={processing} style={{ ...btnRedSolid, flex: 1, opacity: processing ? 0.6 : 1 }}>
                    {processing ? 'Cancelling...' : 'Cancel to Free'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CHANGE PASSWORD MODAL ── */}
      {showChangePasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white shadow-2xl w-full overflow-hidden" style={{ maxWidth: 420, borderRadius: 12 }}>
            <div style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)' }} className="px-6 py-5 relative">
              <button
                onClick={() => {
                  setShowChangePasswordModal(false)
                  setCurrentPassword('')
                  setNewPassword('')
                  setConfirmPassword('')
                  setChangePasswordError('')
                }}
                className="absolute top-4 right-4 text-white hover:text-gray-200 text-3xl leading-none font-light"
              >×</button>
              <div className="flex items-center gap-3">
                <img src="/images/Hire_Power_icon.png" alt="Hire Power" className="h-8 w-auto flex-shrink-0" />
                <div>
                  <h2 className="text-xl font-bold text-white">Change your password</h2>
                  <p className="text-purple-100 text-xs">Make it something you'll remember.</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-5">
              {changePasswordError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm mb-4">{changePasswordError}</div>
              )}
              <form onSubmit={async (e) => {
                e.preventDefault()
                setChangePasswordError('')
                if (newPassword !== confirmPassword) { setChangePasswordError('New passwords do not match.'); return }
                if (newPassword.length < 8) { setChangePasswordError('Password must be at least 8 characters.'); return }
                if (newPassword === currentPassword) { setChangePasswordError('New password must be different from current password.'); return }
                setChangePasswordLoading(true)
                try {
                  // Verify current password by re-authenticating
                  const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword })
                  if (signInError) { setChangePasswordError('Current password is incorrect.'); setChangePasswordLoading(false); return }
                  // Update to new password
                  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
                  if (updateError) throw updateError
                  setShowChangePasswordModal(false)
                  setCurrentPassword('')
                  setNewPassword('')
                  setConfirmPassword('')
                  setToastSuccess('Password updated successfully.')
                } catch (err) {
                  console.error(err)
                  setChangePasswordError('Could not update password. Please try again.')
                } finally {
                  setChangePasswordLoading(false)
                }
              }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current password</label>
                  <div className="relative">
                    <input type={showCurrentPassword ? "text" : "password"} required value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 pr-10"
                      placeholder="Your current password" autoFocus />
                    <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showCurrentPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
                  <div className="relative">
                   <input type={showNewPassword ? "text" : "password"} required value={newPassword} onChange={e => setNewPassword(e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 pr-10"
                      placeholder="Min. 8 characters" />
                    <button type="button" onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showNewPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {newPassword && (() => {
                    const s = getPasswordStrength(newPassword);
                    return (
                      <div className="mt-1.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full transition-all duration-200" style={{ width: s.width, background: s.color }} />
                          </div>
                          <span className="text-[10px] font-medium" style={{ color: s.color }}>{s.label}</span>
                        </div>
                      </div>
                    );
                  })()}
                  <p className="text-xs text-gray-400 mt-1">Must include at least 1 uppercase, 1 lowercase, 1 number & 1 symbol</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
                  <div className="relative">
                    <input type={showConfirmPassword ? "text" : "password"} required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 pr-10"
                      placeholder="Same password again" />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showConfirmPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Must include at least 1 uppercase, 1 lowercase, 1 number & 1 symbol</p>
                </div>
                <button type="submit" disabled={changePasswordLoading}
                  className="block mx-auto py-2 px-8 rounded-md text-sm font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
                  style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}>
                  {changePasswordLoading ? 'Updating...' : 'Update password'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── EXPORT MODAL ── */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white shadow-2xl w-full overflow-hidden" style={{ maxWidth: 420, borderRadius: 12 }}>
            <div style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)' }} className="px-6 py-5 relative">
              <button
                onClick={() => setShowExportModal(false)}
                className="absolute top-4 right-4 text-white hover:text-gray-200 text-3xl leading-none font-light"
              >×</button>
              <div className="flex items-center gap-3">
                <img src="/images/Hire_Power_icon.png" alt="Hire Power" className="h-8 w-auto flex-shrink-0" />
                <div>
                  <h2 className="text-xl font-bold text-white">Export your data</h2>
                  <p className="text-purple-100 text-xs">Download everything we have on file.</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-5">
              <ul className="text-sm text-gray-600 pl-5 mb-4 space-y-1.5 list-disc">
                <li>Profile and account information</li>
                <li>Career context and coaching history</li>
                <li>All resumes and resume data</li>
              </ul>
              <p className="text-xs text-gray-400 mb-5">File downloads as JSON. Your data, take it anywhere.</p>
              <button
                onClick={handleExportData}
                disabled={exportLoading}
                className="block mx-auto py-2 px-8 rounded-md text-sm font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
                style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
              >
                {exportLoading ? 'Exporting...' : 'Download My Data'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE VOICE DATA MODAL ── */}
      {showDeleteVoiceModal && (
        <div style={modalOverlay}>
          <div style={{ ...modalBox, maxWidth: 440 }}>
            <div style={{ ...modalHead('linear-gradient(135deg,#dc2626,#991b1b)'), position: 'relative' }}>
              <button
                onClick={() => setShowDeleteVoiceModal(false)}
                disabled={voiceDeleting}
                style={{ position: 'absolute', top: 12, right: 14, background: 'transparent', border: 'none', color: 'white', fontSize: 24, lineHeight: 1, cursor: 'pointer', padding: 0, fontWeight: 300 }}
                aria-label="Close"
              >
                ×
              </button>
              <p style={modalTitle}>Delete All Voice Data</p>
              <p style={modalSub}>This cannot be undone.</p>
            </div>
            <div style={modalBody}>
              <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.6, marginBottom: 14 }}>
                Every recording from every practice interview will be permanently deleted. Your transcripts, scores, and coaching notes stay exactly as they are, so nothing you have practiced is lost.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setShowDeleteVoiceModal(false)}
                  disabled={voiceDeleting}
                  style={{ ...btnGhost, flex: 1, textAlign: 'center' }}
                >
                  Cancel
                </button>
                <button
                  onClick={deleteAllVoiceData}
                  disabled={voiceDeleting}
                  style={{ ...btnRedSolid, flex: 1, textAlign: 'center', opacity: voiceDeleting ? 0.6 : 1 }}
                >
                  {voiceDeleting ? 'Deleting...' : 'Delete Voice Data'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE MODAL ── */}
      {showDeleteModal && (
        <div style={modalOverlay}>
          <div style={{ ...modalBox, maxWidth: 440 }}>
            <div style={{ ...modalHead('linear-gradient(135deg,#dc2626,#991b1b)'), position: 'relative' }}>
              <button
                onClick={() => { setShowDeleteModal(false); setDeleteConfirmText('') }}
                style={{ position: 'absolute', top: 12, right: 14, background: 'transparent', border: 'none', color: 'white', fontSize: 24, lineHeight: 1, cursor: 'pointer', padding: 0, fontWeight: 300 }}
                aria-label="Close"
              >
                ×
              </button>
              <p style={modalTitle}>Delete Your Account</p>
              <p style={modalSub}>This action is immediate and cannot be undone.</p>
            </div>
            <div style={modalBody}>
              <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.6, marginBottom: 14 }}>
                When you click Delete My Account, we'll permanently remove all your data right away. No grace period, no recovery. We honor your request immediately to respect your privacy.
              </p>

              {(tier === TIERS.PRO || tier === TIERS.VAULT) && (
                <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                    Just trying to stop paying?
                  </p>
                  <p style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.4, marginBottom: 8 }}>
                    You don't have to delete your account. Keep your data and stop paying:
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {tier === TIERS.PRO && (
                      <button
                        onClick={() => { setShowDeleteModal(false); setDeleteConfirmText(''); setShowDowngradeModal(true); }}
                        style={{ background: '#fff', color: '#374151', border: '1.5px solid #d1d5db', borderRadius: 7, padding: '6px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flex: 1 }}
                      >
                        Switch to Vault
                      </button>
                    )}
                    <button
                      onClick={() => { setShowDeleteModal(false); setDeleteConfirmText(''); setShowCancelModal(true); }}
                      style={{ background: '#fff', color: '#374151', border: '1.5px solid #d1d5db', borderRadius: 7, padding: '6px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flex: 1 }}
                    >
                      Cancel to Free
                    </button>
                  </div>
                </div>
              )}

              <p style={{ fontSize: 12, color: '#374151', fontWeight: 700, marginBottom: 6 }}>Permanently removes:</p>
              <ul style={{ fontSize: 12, color: '#6b7280', paddingLeft: 14, marginBottom: 16, lineHeight: 1.8 }}>
                <li>All resumes and coaching conversations</li>
                <li>Career Vault and achievements</li>
                <li>Cover letters and job tracking history</li>
                <li>Your account and profile data</li>
              </ul>

              {tier === TIERS.FREE && (
                <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4 }}>
                    Your account stays free, forever.
                  </p>
                  <p style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.4 }}>
                    You don't have to delete to stop using Hire Power. Walk away anytime, come back anytime. Your data stays safe.
                  </p>
                </div>
              )}
              <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>Type <strong>DELETE</strong> to confirm:</p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE here"
                style={{ ...inputSm, marginBottom: 16, borderColor: deleteConfirmText === 'DELETE' ? '#dc2626' : '#e5e7eb' }}
              />
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => { setShowDeleteModal(false); setDeleteConfirmText('') }} disabled={processing} style={{ ...btnGhost, flex: 1 }}>Keep My Account</button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={processing || deleteConfirmText !== 'DELETE'}
                  style={{ ...btnRedSolid, flex: 1, opacity: (processing || deleteConfirmText !== 'DELETE') ? 0.35 : 1 }}
                >
                  {processing ? 'Deleting...' : 'Delete My Account'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

  {showUpgradeModal && (
        <UpgradeModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          currentTier={tier}
        />
      )}

      <SuccessToast message={toastSuccess} onClose={() => setToastSuccess('')} />
      <ErrorToast message={toastError} onClose={() => setToastError('')} />
    </div>
  )
}