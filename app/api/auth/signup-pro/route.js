import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export async function POST(request) {
  try {
    const { email, password, source } = await request.json()

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

    if (!userData?.user?.id) {
      console.error('signup-pro: createUser returned no user object')
      return NextResponse.json({ error: 'We couldn\'t create your account. Please try again.' }, { status: 500 })
    }

    // Stamp signup source on profiles row (created automatically by trigger).
    // Non-blocking: a failure here shouldn't kill the signup flow.
    if (source) {
      const { error: sourceError } = await supabase
        .from('profiles')
        .update({ signup_source: source })
        .eq('id', userData.user.id)
      if (sourceError) {
        console.error('signup-pro: failed to write signup_source for user', userData.user.id, sourceError)
      }
    }

    // Create Stripe checkout session. If this fails, delete the Supabase user
    // we just created so they can cleanly retry signup instead of being stranded
    // with an account that says "already exists" but has no Stripe subscription.
    let session
    try {
      session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'subscription',
        customer_email: email,
        line_items: [{ price: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID, quantity: 1 }],
        success_url: source === 'brb'
          ? `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/post-stripe-brb?session_id={CHECKOUT_SESSION_ID}`
          : `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard?upgraded=true`,
        cancel_url: source === 'brb'
          ? `${process.env.NEXT_PUBLIC_SITE_URL}/brb-landing?cancelled=true`
          : `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`,
        metadata: { userId: userData.user.id, source: source || 'hp' }
      })
    } catch (stripeError) {
      console.error('signup-pro: Stripe session failed, rolling back user creation:', stripeError)
      const { error: deleteError } = await supabase.auth.admin.deleteUser(userData.user.id)
      if (deleteError) {
        // Log loudly so we can manually clean up if rollback ever fails.
        console.error('signup-pro: ROLLBACK FAILED for orphaned user', userData.user.id, deleteError)
      }
      return NextResponse.json({ error: "We couldn't start checkout. Please try again in a moment." }, { status: 500 })
    }

    return NextResponse.json({ checkoutUrl: session.url })

  } catch (error) {
    console.error('signup-pro error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}