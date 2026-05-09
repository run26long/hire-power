import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const body = await request.json()
    const { email, isInitialSync } = body

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    const { isInitialSync: _drop, ...payload } = body

    if (isInitialSync) {
      payload.hasResume = false
    }

    const response = await fetch('https://app.loops.so/api/v1/contacts/update', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${process.env.LOOPS_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('Loops sync-contact failed:', response.status, errText)
      return NextResponse.json({ error: 'Loops sync failed' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('sync-contact error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}