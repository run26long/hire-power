import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const { userId } = await req.json();
    if (!userId) return Response.json({ error: 'Missing userId' }, { status: 400 });

    // Get stripe subscription ID from profiles
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_subscription_id, stripe_customer_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile?.stripe_subscription_id) {
      return Response.json({ error: 'No active subscription found' }, { status: 400 });
    }

    // Get current subscription
    const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
    const currentItemId = subscription.items.data[0].id;

    // Update subscription to Vault price
    await stripe.subscriptions.update(profile.stripe_subscription_id, {
      items: [{
        id: currentItemId,
        price: process.env.NEXT_PUBLIC_STRIPE_VAULT_PRICE_ID,
      }],
      proration_behavior: 'always_invoice',
    });

    return Response.json({ success: true });

  } catch (error) {
    console.error('Stripe downgrade error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}