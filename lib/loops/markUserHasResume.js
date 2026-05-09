// Marks a user's Loops contact with hasResume: true.
// Called after a resume row is inserted (any path).
// Wrapped in try/catch by the caller — failures must never block resume creation.

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function markUserHasResume(userId) {
  if (!userId) return

  if (!process.env.LOOPS_API_KEY) {
    console.warn('markUserHasResume skipped: LOOPS_API_KEY missing')
    return
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .single()

  if (!profile?.email) {
    console.warn('markUserHasResume skipped: no email for user', userId)
    return
  }

  const response = await fetch('https://app.loops.so/api/v1/contacts/update', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${process.env.LOOPS_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: profile.email,
      userId,
      hasResume: true
    })
  })

  if (!response.ok) {
    const errText = await response.text()
    console.error('markUserHasResume failed:', response.status, errText)
  }
}