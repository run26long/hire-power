import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const { email, userId, subscriptionTier, firstName, lastName } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    const response = await fetch('https://app.loops.so/api/v1/contacts/update', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${process.env.LOOPS_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        userId,
        subscriptionTier,
        firstName,
        lastName
      })
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