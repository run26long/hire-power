'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import MainNav from '../components/MainNav'
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
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [cancelFeedback, setCancelFeedback] = useState('')
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [processing, setProcessing] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => { loadProfile() }, [])

  async function loadProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (p) {
        setProfile(p)
        setDisplayName(p.display_name || user.email.split('@')[0])
        setPhotoUrl(p.photo_url || '')
      } else {
        setDisplayName(user.email.split('@')[0])
      }
      setLoading(false)
    } catch (e) { console.error(e); setLoading(false) }
  }

  async function uploadPhoto(event) {
    try {
      setUploading(true)
      const file = event.target.files[0]
      if (!file || !file.type.startsWith('image/') || file.size > 2 * 1024 * 1024) return
      const fileName = `${user.id}-${Date.now()}.${file.name.split('.').pop()}`
      const { error } = await supabase.storage.from('profile-photos').upload(fileName, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from('profile-photos').getPublicUrl(fileName)
      setPhotoUrl(data.publicUrl)
    } catch (e) { console.error(e) } finally { setUploading(false) }
  }

  async function saveProfile() {
    try {
      setSaving(true)
      const { error } = await supabase.from('profiles')
        .upsert({ id: user.id, display_name: displayName, photo_url: photoUrl, updated_at: new Date().toISOString() })
      if (error) throw error
      await loadProfile()
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2500)
    } catch (e) { console.error(e) } finally { setSaving(false) }
  }

  async function handleDowngrade() {
    try {
      setProcessing(true)
      const { error } = await supabase.from('profiles')
        .update({ subscription_tier: TIERS.VAULT, downgrade_scheduled_date: new Date().toISOString() })
        .eq('id', user.id)
      if (error) throw error
      setShowDowngradeModal(false)
      await loadProfile()
    } catch (e) { console.error(e) } finally { setProcessing(false) }
  }

  async function handleCancel() {
    try {
      setProcessing(true)
      const { error } = await supabase.from('profiles')
        .update({ subscription_tier: TIERS.FREE, cancelled_at: new Date().toISOString(), cancellation_feedback: cancelFeedback })
        .eq('id', user.id)
      if (error) throw error
      setShowCancelModal(false); setCancelFeedback('')
      await loadProfile()
    } catch (e) { console.error(e) } finally { setProcessing(false) }
  }

  async function handleExportData() {
    try {
      setExportLoading(true)
      const [resumesRes, profileRes, careerRes] = await Promise.all([
        supabase.from('resumes').select('*').eq('user_id', user.id),
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('career_context').select('*').eq('user_id', user.id).maybeSingle(),
      ])
      const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), profile: profileRes.data, career_context: careerRes.data, resumes: resumesRes.data }, null, 2)], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `hire-power-data-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      setShowExportModal(false)
    } catch (e) { console.error(e) } finally { setExportLoading(false) }
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText !== 'DELETE') return
    try {
      setProcessing(true)
      const { error } = await supabase.from('profiles')
        .update({ deletion_requested_at: new Date().toISOString(), subscription_tier: TIERS.FREE, cancelled_at: new Date().toISOString() })
        .eq('id', user.id)
      if (error) throw error
      await supabase.auth.signOut()
      router.push('/login?deleted=true')
    } catch (e) { console.error(e) } finally { setProcessing(false) }
  }

  const tierLabel = { [TIERS.FREE]: 'Free', [TIERS.PRO]: 'Pro', [TIERS.VAULT]: 'Maintenance' }
  const tierColor = { [TIERS.FREE]: '#6b7280', [TIERS.PRO]: '#7c3aed', [TIERS.VAULT]: '#0369a1' }
  const tierBg    = { [TIERS.FREE]: '#f3f4f6', [TIERS.PRO]: '#faf5ff', [TIERS.VAULT]: '#f0f9ff' }
  const tierBorder = { [TIERS.FREE]: '#e5e7eb', [TIERS.PRO]: '#e9d5ff', [TIERS.VAULT]: '#bae6fd' }

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
  const btnRed     = { background: '#fff', color: '#dc2626', border: '1.5px solid #fca5a5', borderRadius: 7, padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }
  const btnRedSolid= { background: '#dc2626', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }
  const btnOrange  = { background: '#fff', color: '#c2410c', border: '1.5px solid #fed7aa', borderRadius: 7, padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }

  const modalOverlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }
  const modalBox     = { background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420, boxShadow: '0 25px 50px rgba(0,0,0,0.2)', overflow: 'hidden' }
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

  return (
    <div className="h-screen bg-gray-50 flex">

      {/* ── SIDEBAR ── */}
      <div
        className="w-64 text-white flex flex-col fixed left-0 top-0 shadow-lg z-40"
        style={{ background: 'linear-gradient(180deg, #667eea 0%, #764ba2 100%)', height: '100vh', overflowY: 'hidden' }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex-shrink-0">
          <h1 className="text-[28px] font-bold mb-1.5 tracking-tight">Profile</h1>
          <p className="text-[13px] text-white leading-tight tracking-tight mb-0.5" style={{ opacity: 0.95 }}>Your account.</p>
          <p className="text-[13px] text-white leading-tight tracking-tight" style={{ opacity: 0.95 }}>Your data. Your career.</p>
          <div className="mt-4 border-b border-white border-opacity-10"></div>
        </div>

        {/* Avatar + plan badge */}
        <div className="px-6 pt-4 pb-2 flex-shrink-0">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '16px 0' }}>
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
            </div>
          </div>
          <div className="border-b border-white border-opacity-10 mt-2"></div>
        </div>

        {/* Body copy */}
        <div className="px-6 pt-4 pb-6 flex flex-col justify-between flex-1">
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#fff', lineHeight: 1.35, marginBottom: 8 }}>
              Everything in one place.
            </p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.78)', lineHeight: 1.5, marginBottom: 16 }}>
              Manage your name, photo, plan, and account settings — then get back to building your career.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
              {[
                { dot: '·', label: 'Personal info and photo' },
                { dot: '·', label: 'Career context snapshot' },
                { dot: '·', label: 'Plan and billing' },
                { dot: '·', label: 'Account settings' },
                { dot: '·', label: 'Data export and privacy' },
              ].map(item => (
                <li key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1, flexShrink: 0 }}>·</span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.85)', lineHeight: 1.3 }}>{item.label}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="border-b border-white border-opacity-10 mb-3"></div>
            <div className="flex items-center gap-2.5">
              <img src="/images/Hire_Power_icon.png" alt="Lightning" className="h-5 w-auto flex-shrink-0" />
              <p className="text-sm font-medium leading-tight text-white">Your lifelong career coach</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN ── */}
      <div className="ml-64 flex-1 flex flex-col h-screen overflow-hidden">
        <MainNav currentPage="profile" userProfile={profile} />

        <div className="flex-1 overflow-hidden">
          <div style={{ padding: '16px 24px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* ROW 1: Personal Info + Plan */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 12, flex: '0 0 auto' }}>

              {/* PERSONAL INFO */}
              <div style={cardBase}>
                <div style={cardHeader()}>
                  <span style={cardTitle}>Personal Information</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {saveSuccess && <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a' }}>Saved!</span>}
                    <button onClick={saveProfile} disabled={saving} style={{ ...btnPurple, opacity: saving ? 0.6 : 1 }}>
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
                <div style={{ ...cardBody, display: 'flex', gap: 16, alignItems: 'center' }}>
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
                  <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={labelSm}>Display Name</label>
                      <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={inputSm} placeholder="Your name" />
                      <p style={{ fontSize: 10, color: '#9ca3af', marginTop: 3 }}>How we'll address you in coaching</p>
                    </div>
                    <div>
                      <label style={labelSm}>Email</label>
                      <input type="email" value={user?.email || ''} disabled style={inputDis} />
                      <p style={{ fontSize: 10, color: '#9ca3af', marginTop: 3 }}>Cannot be changed</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* PLAN */}
              <div style={cardBase}>
                <div style={cardHeader()}>
                  <span style={cardTitle}>Plan</span>
                  {tier === TIERS.FREE && (
                    <button onClick={() => router.push('/pricing')} style={btnPurple}>Upgrade to Pro</button>
                  )}
                </div>
                <div style={cardBody}>
                  {/* Tier badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: tierBg[tier], border: `1px solid ${tierBorder[tier]}`, borderRadius: 10, marginBottom: 12 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: tierColor[tier], flexShrink: 0 }}></div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 800, color: tierColor[tier] }}>Hire Power {tierLabel[tier]}</p>
                      <p style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>
                        {tier === TIERS.FREE && 'Limited features'}
                        {tier === TIERS.PRO && '$29.99/month · All features unlocked'}
                        {tier === TIERS.VAULT && '$4.99/month · Archive access'}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  {tier === TIERS.PRO && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <p style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.4, marginBottom: 4 }}>Between job searches? Keep your work safe for $4.99/month.</p>
                      <button onClick={() => setShowDowngradeModal(true)} style={btnOutline}>Downgrade to Maintenance</button>
                      <button onClick={() => setShowCancelModal(true)} style={btnRed}>Cancel Subscription</button>
                    </div>
                  )}
                  {tier === TIERS.VAULT && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <p style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.4, marginBottom: 4 }}>Ready for your next search? Unlock full coaching.</p>
                      <button onClick={() => router.push('/pricing')} style={btnPurple}>Upgrade to Pro</button>
                      <button onClick={() => setShowCancelModal(true)} style={btnRed}>Cancel Subscription</button>
                    </div>
                  )}
                  {tier === TIERS.FREE && (
                    <p style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.5 }}>Upgrade to Pro for unlimited coaching, job-specific resumes, and Interview Coach.</p>
                  )}
                </div>
              </div>
            </div>

            {/* ROW 2: Career Context + Account + Danger Zone */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 12, flex: '0 0 auto' }}>

              {/* CAREER CONTEXT */}
              <div style={cardBase}>
                <div style={cardHeader()}>
                  <span style={cardTitle}>Career Context</span>
                  <button onClick={() => router.push('/my-career')} style={btnOutline}>Update in Career Coach</button>
                </div>
                <div style={{ ...cardBody, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
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
              </div>

              {/* ACCOUNT + DANGER stacked */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                {/* ACCOUNT */}
                <div style={cardBase}>
                  <div style={cardHeader()}>
                    <span style={cardTitle}>Account</span>
                  </div>
                  <div style={{ ...cardBody, display: 'flex', gap: 8 }}>
                    <button
                      onClick={async () => {
                        await supabase.auth.resetPasswordForEmail(user.email, { redirectTo: `${window.location.origin}/reset-password` })
                        alert('Password reset email sent!')
                      }}
                      style={{ ...btnOutline, flex: 1, textAlign: 'center' }}
                    >
                      Reset Password
                    </button>
                    <button
                      onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
                      style={{ ...btnGhost, flex: 1, textAlign: 'center' }}
                    >
                      Sign Out
                    </button>
                  </div>
                </div>

                {/* DANGER ZONE */}
                <div style={{ ...cardBase, border: '1px solid #fecaca' }}>
                  <div style={cardHeader('linear-gradient(135deg,#fff5f5,#fee2e2)')}>
                    <span style={{ ...cardTitle, color: '#dc2626' }}>Danger Zone</span>
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
            </div>

          </div>
        </div>
      </div>

      {/* ── DOWNGRADE MODAL ── */}
      {showDowngradeModal && (
        <div style={modalOverlay}>
          <div style={modalBox}>
            <div style={modalHead()}>
              <p style={modalTitle}>Downgrade to Maintenance?</p>
              <p style={modalSub}>$4.99/month between job searches</p>
            </div>
            <div style={modalBody}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>You'll lose:</p>
              <ul style={{ fontSize: 12, color: '#6b7280', paddingLeft: 14, marginBottom: 12, lineHeight: 1.8 }}>
                <li>Resume coaching and job customization</li>
                <li>Interview practice and AI feedback</li>
                <li>New resume generation</li>
              </ul>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>You'll keep:</p>
              <ul style={{ fontSize: 12, color: '#6b7280', paddingLeft: 14, marginBottom: 18, lineHeight: 1.8 }}>
                <li>All resumes and coaching conversations</li>
                <li>Career Vault achievement tracking</li>
                <li>Unlimited downloads and premium templates</li>
              </ul>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowDowngradeModal(false)} disabled={processing} style={{ ...btnGhost, flex: 1 }}>Keep Pro</button>
                <button onClick={handleDowngrade} disabled={processing} style={{ ...btnPurple, flex: 1, opacity: processing ? 0.6 : 1 }}>
                  {processing ? 'Processing...' : 'Switch to Maintenance'}
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
              <p style={modalSub}>You'll move to the Free plan immediately.</p>
            </div>
            <div style={modalBody}>
              {tier === TIERS.PRO && (
                <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#6b21a8', marginBottom: 3 }}>Consider Maintenance instead ($4.99/month)</p>
                  <p style={{ fontSize: 11, color: '#7c3aed', lineHeight: 1.4 }}>Keep your work safe between searches. Upgrade back to Pro anytime.</p>
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
                    Switch to Maintenance Instead
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

      {/* ── EXPORT MODAL ── */}
      {showExportModal && (
        <div style={modalOverlay}>
          <div style={modalBox}>
            <div style={modalHead('linear-gradient(135deg,#c2410c,#9a3412)')}>
              <p style={modalTitle}>Export Your Data</p>
              <p style={modalSub}>Download everything we have on file.</p>
            </div>
            <div style={modalBody}>
              <ul style={{ fontSize: 12, color: '#6b7280', paddingLeft: 14, marginBottom: 16, lineHeight: 1.9 }}>
                <li>Profile and account information</li>
                <li>Career context and coaching history</li>
                <li>All resumes and resume data</li>
              </ul>
              <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 16 }}>File downloads as JSON. Your data — take it anywhere.</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowExportModal(false)} style={{ ...btnGhost, flex: 1 }}>Cancel</button>
                <button onClick={handleExportData} disabled={exportLoading} style={{ ...btnPurple, flex: 1, opacity: exportLoading ? 0.6 : 1 }}>
                  {exportLoading ? 'Exporting...' : 'Download My Data'}
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
            <div style={modalHead('linear-gradient(135deg,#dc2626,#991b1b)')}>
              <p style={modalTitle}>Delete Your Account</p>
              <p style={modalSub}>30-day recovery window applies.</p>
            </div>
            <div style={modalBody}>
              <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.6, marginBottom: 12 }}>
                This will cancel your subscription and begin a 30-day grace period. Contact support within 30 days to recover. After that, everything is gone permanently.
              </p>
              <p style={{ fontSize: 12, color: '#374151', fontWeight: 700, marginBottom: 6 }}>Permanently removes:</p>
              <ul style={{ fontSize: 12, color: '#6b7280', paddingLeft: 14, marginBottom: 16, lineHeight: 1.8 }}>
                <li>All resumes and coaching conversations</li>
                <li>Career archive and achievements</li>
                <li>Your account and profile data</li>
              </ul>
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

    </div>
  )
}