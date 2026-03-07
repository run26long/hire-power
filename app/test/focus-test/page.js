'use client'
import { useState, useRef, useEffect } from 'react'

export default function TestFocus() {
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const inputRef = useRef(null)

  useState(() => {
    setTimeout(() => setLoading(false), 1500)
  })

  // Focus whenever sending becomes false and textarea is enabled
  useEffect(() => {
    if (!sending && !loading) {
      inputRef.current?.focus({ preventScroll: true })
      inputRef.current?.select()
    }
  }, [sending, loading])

  async function send() {
    if (!input.trim()) return
    setInput('')
    setSending(true)
    setMessages(prev => [...prev, { role: 'user', content: input }])
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Coach response.' }])
      setSending(false)
    }, 1000)
  }

  if (loading) return <div>Loading...</div>

  return (
    <div style={{ padding: 20 }}>
      <h1>Focus Test</h1>
      {messages.map((m, i) => <p key={i}><strong>{m.role}:</strong> {m.content}</p>)}
      <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} disabled={sending} rows={2} style={{ width: '100%', border: '1px solid #ccc', caretColor: 'black' }} />
      <button onClick={send} disabled={sending}>Send</button>
    </div>
  )
}