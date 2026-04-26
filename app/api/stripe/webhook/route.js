import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Map Stripe price IDs to subscription tiers
function getTierForPriceId(priceId) {
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return 'pro';
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_VAULT_PRICE_ID) return 'vault';
  return null;
}

export async function POST(req) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return Response.json({ error: 'Webhook error' }, { status: 400 });
  }

  const obj = event.data.object;

  switch (event.type) {
    case 'checkout.session.completed': {
      const userId = obj.client_reference_id;
      const priceId = obj.metadata?.priceId;
      const tier = priceId === process.env.STRIPE_PRO_PRICE_ID ? 'pro' : 'vault';

      await supabase
        .from('profiles')
        .update({
          subscription_tier: tier,
          subscription_start_date: new Date().toISOString(),
          stripe_customer_id: obj.customer,
          stripe_subscription_id: obj.subscription,
          pending_change_type: null,
          pending_change_date: null,
        })
        .eq('id', userId);

      break;
    }

    case 'customer.subscription.updated': {
      // Fires when a subscription's phase advances (e.g., Pro→Vault transition)
      // or any other update. We detect price-based tier changes.
      const customerId = obj.customer;
      const currentPriceId = obj.items?.data?.[0]?.price?.id;
      const newTier = getTierForPriceId(currentPriceId);

      if (!newTier) break;

      // Check if tier actually changed in our DB before clearing pending state
      const { data: existing } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('stripe_customer_id', customerId)
        .single();

      if (existing && existing.subscription_tier !== newTier) {
        // Tier transition detected — update and clear pending change
        await supabase
          .from('profiles')
          .update({
            subscription_tier: newTier,
            pending_change_type: null,
            pending_change_date: null,
          })
          .eq('stripe_customer_id', customerId);
      }

      break;
    }

    case 'customer.subscription.deleted': {
      const customerId = obj.customer;

      // Check if this deletion was scheduled as a downgrade to Vault
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, pending_change_type')
        .eq('stripe_customer_id', customerId)
        .single();

      if (existingProfile?.pending_change_type === 'downgrade') {
        // Create new Vault subscription on the existing customer
        try {
          const vaultSub = await stripe.subscriptions.create({
            customer: customerId,
            items: [{ price: process.env.NEXT_PUBLIC_STRIPE_VAULT_PRICE_ID }],
          });

          await supabase
            .from('profiles')
            .update({
              subscription_tier: 'vault',
              stripe_subscription_id: vaultSub.id,
              pending_change_type: null,
              pending_change_date: null,
            })
            .eq('stripe_customer_id', customerId);
        } catch (vaultError) {
          // Vault subscription failed (e.g. card declined). Drop to free
          // and clear pending state so user can re-subscribe from profile.
          console.error('Vault subscription creation failed during downgrade:', vaultError);
          await supabase
            .from('profiles')
            .update({
              subscription_tier: 'free',
              stripe_subscription_id: null,
              cancelled_at: new Date().toISOString(),
              pending_change_type: null,
              pending_change_date: null,
            })
            .eq('stripe_customer_id', customerId);
        }
      } else {
        // Normal cancel — drop to free
        await supabase
          .from('profiles')
          .update({
            subscription_tier: 'free',
            stripe_subscription_id: null,
            cancelled_at: new Date().toISOString(),
            pending_change_type: null,
            pending_change_date: null,
          })
          .eq('stripe_customer_id', customerId);
      }

      break;
    }
  }

  return Response.json({ received: true });
}