import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('session_id')

  // No session_id at all — somebody hit this URL directly. Send them home.
  if (!sessionId) {
    console.error('post-stripe-brb: no session_id in query')
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`)
  }

  try {
    // 1. Verify the Stripe session is real and paid.
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    if (session.payment_status !== 'paid') {
      console.error('post-stripe-brb: session not paid', sessionId, session.payment_status)
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`)
    }

    // 2. Pull userId out of metadata (we set this in signup-pro).
    const userId = session.metadata?.userId
    if (!userId) {
      console.error('post-stripe-brb: no userId in session metadata', sessionId)
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`)
    }

    // 3. Create the resume row with the same fields handleStartResumeChat uses.
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data: newResume, error: insertError } = await supabase
      .from('resumes')
      .insert({
        user_id: userId,
        resume_type: 'core',
        display_name: 'Core Resume',
        resume_data: {},
        journey_step: 'chat',
        created_via: 'resume_chat'
      })
      .select()
      .single()

    if (insertError || !newResume) {
      console.error('post-stripe-brb: failed to create resume row', userId, insertError)
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`)
    }

    // 4. Send them straight into their new resume chat.
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/resume/${newResume.id}`)

  } catch (error) {
    console.error('post-stripe-brb error:', error)
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`)
  }
}