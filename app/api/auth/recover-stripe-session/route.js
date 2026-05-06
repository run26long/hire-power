import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('session_id')

  if (!sessionId) {
    return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    const userId = session.metadata?.userId
    const email = session.customer_email

    if (!userId || !email) {
      return NextResponse.json({ error: 'Session missing user data' }, { status: 400 })
    }

    return NextResponse.json({ userId, email })
  } catch (error) {
    console.error('recover-stripe-session error:', error)
    return NextResponse.json({ error: 'Could not retrieve session' }, { status: 500 })
  }
}