import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export async function POST(request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Create user with email pre-confirmed
    const { data: userData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })

    if (createError) {
      if (createError.message.toLowerCase().includes('already registered')) {
        return NextResponse.json({ error: 'ACCOUNT_EXISTS' }, { status: 400 })
      }
      return NextResponse.json({ error: createError.message }, { status: 400 })
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: email,
      line_items: [{ price: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard?upgraded=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`,
      metadata: { userId: userData.user.id }
    })

    return NextResponse.json({ checkoutUrl: session.url })

  } catch (error) {
    console.error('signup-pro error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}