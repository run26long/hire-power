import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { apiError } from '@/lib/apiError';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function nextRenewalFromAnchor(anchorTimestamp, interval) {
  const now = new Date();
  const next = new Date(anchorTimestamp * 1000);
  if (interval === 'year') {
    while (next <= now) next.setFullYear(next.getFullYear() + 1);
  } else {
    while (next <= now) next.setMonth(next.getMonth() + 1);
  }
  return next.toISOString();
}

export async function GET(req) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const token = authHeader.replace('Bearer ', '')

    const { createClient: createAuthClient } = await import('@supabase/supabase-js')
    const authSupabase = createAuthClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    const { data: { user }, error: authError } = await authSupabase.auth.getUser(token)
    if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_subscription_id, stripe_customer_id')
      .eq('id', user.id)
      .single()

    let subscriptionId = profile?.stripe_subscription_id
    if (!subscriptionId && profile?.stripe_customer_id) {
      const list = await stripe.subscriptions.list({
        customer: profile.stripe_customer_id,
        status: 'active',
        limit: 1,
      })
      subscriptionId = list.data[0]?.id || null
    }

    if (!subscriptionId) {
      return Response.json({ current_period_end: null, price_id: null })
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    const anchor = subscription.billing_cycle_anchor
    const interval = subscription.items.data[0]?.price?.recurring?.interval || 'month'
    const price_id = subscription.items.data[0]?.price?.id || null

    return Response.json({
      current_period_end: anchor ? nextRenewalFromAnchor(anchor, interval) : null,
      price_id,
    })

  } catch (error) {
    return apiError(error, "We couldn't fetch your subscription details.")
  }
}
