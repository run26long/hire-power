'use client'

import { useEffect, useRef, useState } from 'react'

// Thin strip displayed above the resume showing running capture counts.
// counts: { jobs, education, skills, wins }
// bumpKey: optional string that changes when a count was just incremented
//   (used to flash the relevant number)

export default function CaptureCounter({ counts, bumpKey }) {
  const [bumped, setBumped] = useState(null)
  const lastBumpKeyRef = useRef(null)

  useEffect(() => {
    if (!bumpKey || bumpKey === lastBumpKeyRef.current) return
    lastBumpKeyRef.current = bumpKey

    // bumpKey is formatted as "category:timestamp" — extract category
    const category = bumpKey.split(':')[0]
    setBumped(category)

    const timer = setTimeout(() => setBumped(null), 600)
    return () => clearTimeout(timer)
  }, [bumpKey])

  const total = (counts?.jobs || 0) + (counts?.education || 0) + (counts?.skills || 0) + (counts?.wins || 0)

  // Hide entirely until first capture
  if (total === 0) return null

  const items = [
    { key: 'jobs', label: 'jobs', value: counts?.jobs || 0 },
    { key: 'education', label: counts?.education === 1 ? 'school' : 'schools', value: counts?.education || 0 },
    { key: 'skills', label: 'skills', value: counts?.skills || 0 },
    { key: 'wins', label: counts?.wins === 1 ? 'win' : 'wins', value: counts?.wins || 0 },
  ].filter(item => item.value > 0)

  return (
    <div
      className="px-4 py-1.5 border-b flex items-center justify-center gap-1 text-xs"
      style={{
        background: 'linear-gradient(to right, rgba(102,126,234,0.06), rgba(118,75,162,0.06))',
        borderColor: 'rgba(102,126,234,0.15)',
        color: '#5b4fcf'
      }}
    >
      <span className="font-semibold mr-1">✓</span>
      {items.map((item, i) => (
        <span key={item.key} className="flex items-center">
          <span
            className="font-bold transition-all duration-300"
            style={{
              transform: bumped === item.key ? 'scale(1.4)' : 'scale(1)',
              color: bumped === item.key ? '#7c3aed' : '#5b4fcf',
              display: 'inline-block'
            }}
          >
            {item.value}
          </span>
          <span className="ml-1 text-gray-600">{item.label}</span>
          {i < items.length - 1 && <span className="mx-1.5 text-gray-400">·</span>}
        </span>
      ))}
    </div>
  )
}