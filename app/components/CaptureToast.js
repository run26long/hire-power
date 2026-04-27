'use client'

import { useEffect, useState } from 'react'

// Transient toast displayed top-right of the resume panel when an achievement is captured.
// message: short text describing the win
// onClose: called when toast finishes its lifecycle

export default function CaptureToast({ message, onClose }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!message) {
      setVisible(false)
      return
    }

    // New message arrived: briefly hide, then slide in fresh.
    // This creates a clean visual transition when one achievement replaces another.
    setVisible(false)
    const enterTimer = setTimeout(() => setVisible(true), 50)

    return () => {
      clearTimeout(enterTimer)
    }
  }, [message])

  if (!message) return null

  return (
    <div
      className="absolute z-30 rounded-lg shadow-lg px-3 py-2 max-w-[280px] transition-all duration-400"
      style={{
        top: '12px',
        right: '12px',
        background: 'linear-gradient(to bottom right, #f5f3ff, #ede9fe)',
        border: '1px solid rgba(124, 58, 237, 0.25)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(20px)',
      }}
    >
      <div className="flex items-start gap-2">
        <span
          className="flex-shrink-0 mt-0.5 font-bold text-sm leading-none"
          style={{ color: '#7c3aed' }}
        >
          ✓
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: '#7c3aed' }}>
            Coach noted
          </p>
          <p className="text-xs text-gray-800 leading-snug">
            {message}
          </p>
        </div>
      </div>
    </div>
  )
}