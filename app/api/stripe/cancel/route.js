import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const { userId, feedback } = await req.json();
    if (!userId) return Response.json({ error: 'Missing userId' }, { status: 400 });

    // Get stripe subscription ID from profiles
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_subscription_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile?.stripe_subscription_id) {
      // No Stripe subscription — just let the Supabase update handle it
      return Response.json({ success: true });
    }

    // Cancel at end of current billing period (not immediately)
    await stripe.subscriptions.update(profile.stripe_subscription_id, {
      cancel_at_period_end: true,
    });

    return Response.json({ success: true });

  } catch (error) {
    console.error('Stripe cancel error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}