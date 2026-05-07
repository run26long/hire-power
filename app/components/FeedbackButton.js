'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function FeedbackButton() {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState('feedback')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async () => {
    if (!message.trim()) return
    setSubmitting(true)

    const { data: { session } } = await supabase.auth.getSession()

    await supabase.from('feedback').insert({
      user_id: session?.user?.id || null,
      type,
      message: message.trim(),
      page_url: window.location.pathname
    })

    setSubmitting(false)
    setSubmitted(true)
    setTimeout(() => {
      setOpen(false)
      setSubmitted(false)
      setMessage('')
      setType('feedback')
    }, 2000)
  }

  const handleClose = () => {
    setOpen(false)
    setMessage('')
    setType('feedback')
    setSubmitted(false)
  }

  return (
    <>
      {/* Side tab trigger */}
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed',
          right: '-1px',
          bottom: '80px',
          zIndex: 999,
          background: 'linear-gradient(to bottom, #667eea, #764ba2)',
          color: '#fff',
          border: 'none',
         borderRadius: '0 8px 8px 0',
          padding: '12px 6px',
          cursor: 'pointer',
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
          transform: 'rotate(180deg)',
          fontSize: '12px',
          fontWeight: 600,
          letterSpacing: '0.05em',
          opacity: 0.7,
          transition: 'opacity 0.2s ease',
          boxShadow: '-2px 0 8px rgba(0,0,0,0.1)'
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = '1'}
        onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
      >
        Feedback
      </button>

      {/* Modal */}
      {open && (
        <div
          onMouseDown={(e) => { e.currentTarget.dataset.downTarget = e.target === e.currentTarget ? 'backdrop' : 'inside'; }}
          onMouseUp={(e) => {
            if (e.target === e.currentTarget && e.currentTarget.dataset.downTarget === 'backdrop') {
              handleClose();
            }
          }}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.3)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
            padding: '24px'
          }}
        >
          <div
            onMouseDown={e => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: '16px',
              width: '320px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
              overflow: 'hidden'
            }}
          >
            {/* Branded header */}
            <div style={{
              background: 'linear-gradient(to bottom right, #667eea, #764ba2)',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img
                  src="/images/Hire_Power_icon.png"
                  alt="Hire Power"
                  style={{ width: '28px', height: '28px', borderRadius: '6px', display: 'block', objectFit: 'contain' }}
                />
                <span style={{ color: '#fff', fontWeight: 700, fontSize: '15px' }}>
                  {submitted ? 'Thanks!' : type === 'bug' ? 'Report a Bug' : 'Share Feedback'}
                </span>
              </div>
              <button
                onClick={handleClose}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'rgba(255,255,255,0.8)', lineHeight: 1 }}
              >×</button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px' }}>
            {submitted ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>✅</div>
                <p style={{ margin: 0, fontWeight: 600, color: '#1a1a1a' }}>We got it. Thank you.</p>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: '16px' }} />

                {/* Type toggle */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  {[
                    { value: 'feedback', label: '💬 Feedback' },
                    { value: 'bug', label: '🐛 Bug' }
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setType(opt.value)}
                      style={{
                        flex: 1,
                        padding: '8px',
                        borderRadius: '8px',
                        border: '1.5px solid',
                        borderColor: type === opt.value ? '#667eea' : '#e5e7eb',
                        background: type === opt.value ? 'linear-gradient(to right, #667eea, #764ba2)' : '#fff',
                        color: type === opt.value ? '#fff' : '#6b7280',
                        fontWeight: 600,
                        fontSize: '13px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder={type === 'bug' ? 'What happened? What were you trying to do?' : 'What\'s on your mind?'}
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid #e5e7eb',
                    fontSize: '14px',
                    color: '#1a1a1a',
                    resize: 'none',
                    outline: 'none',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                    marginBottom: '12px'
                  }}
                  onFocus={e => e.target.style.borderColor = '#667eea'}
                  onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                />

                <button
                  onClick={handleSubmit}
                  disabled={!message.trim() || submitting}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: 'none',
                    background: message.trim() ? 'linear-gradient(to right, #667eea, #764ba2)' : '#e5e7eb',
                    color: message.trim() ? '#fff' : '#9ca3af',
                    fontWeight: 600,
                    fontSize: '14px',
                    cursor: message.trim() ? 'pointer' : 'not-allowed',
                    transition: 'opacity 0.2s'
                  }}
                >
                  {submitting ? 'Sending...' : 'Send'}
                </button>
              </>
            )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}