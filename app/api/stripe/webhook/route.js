import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { apiError } from '@/lib/apiError';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Map Stripe price IDs to subscription tiers
function getTierForPriceId(priceId) {
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID) return 'pro';
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_VAULT_PRICE_ID) return 'vault';
  return null;
}

// Sync tier change to Loops (non-blocking — failure shouldn't break webhook)
async function syncTierToLoops(userId, tier) {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('email, first_name, last_name')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      console.error('syncTierToLoops: could not load profile for user', userId, error);
      return;
    }

    const response = await fetch('https://app.loops.so/api/v1/contacts/update', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${process.env.LOOPS_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: profile.email,
        userId,
        subscriptionTier: tier,
        firstName: profile.first_name || '',
        lastName: profile.last_name || ''
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('syncTierToLoops failed:', response.status, errText, { userId, tier });
    }
  } catch (err) {
    console.error('syncTierToLoops error:', err, { userId, tier });
  }
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
      const tier = getTierForPriceId(priceId);

      // If we can't resolve the tier, log loudly and return 500 so Stripe
      // retries — this should never happen with priceId allowlist in checkout.
      if (!tier) {
        console.error('CRITICAL: checkout.session.completed with unknown priceId', {
          userId,
          priceId,
          customerId: obj.customer,
          sessionId: obj.id,
        });
        return Response.json({ error: 'Unknown priceId' }, { status: 500 });
      }

      const { error: updateError } = await supabase
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

      if (updateError) {
        console.error('CRITICAL: checkout.session.completed update failed — user paid but profile not updated', {
          userId,
          customerId: obj.customer,
          subscriptionId: obj.subscription,
          tier,
          error: updateError,
        });
        // Return 500 so Stripe retries the webhook
        return Response.json({ error: 'DB update failed' }, { status: 500 });
      }

      await syncTierToLoops(userId, tier);

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
        const { data: updated, error: updateError } = await supabase
          .from('profiles')
          .update({
            subscription_tier: newTier,
            pending_change_type: null,
            pending_change_date: null,
          })
          .eq('stripe_customer_id', customerId)
          .select('id')
          .single();

        if (updateError) {
          console.error('CRITICAL: customer.subscription.updated tier transition failed', {
            customerId,
            previousTier: existing.subscription_tier,
            newTier,
            error: updateError,
          });
          return Response.json({ error: 'DB update failed' }, { status: 500 });
        }

        if (updated?.id) await syncTierToLoops(updated.id, newTier);
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

          const { error: vaultUpdateError } = await supabase
            .from('profiles')
            .update({
              subscription_tier: 'vault',
              stripe_subscription_id: vaultSub.id,
              pending_change_type: null,
              pending_change_date: null,
            })
            .eq('stripe_customer_id', customerId);

          if (vaultUpdateError) {
            console.error('CRITICAL: Vault sub created in Stripe but profile update failed', {
              customerId,
              vaultSubId: vaultSub.id,
              error: vaultUpdateError,
            });
            return Response.json({ error: 'DB update failed' }, { status: 500 });
          }

          if (existingProfile?.id) await syncTierToLoops(existingProfile.id, 'vault');
        } catch (vaultError) {
          // Vault subscription failed (e.g. card declined). Drop to free
          // and clear pending state so user can re-subscribe from profile.
          console.error('CRITICAL: Vault subscription creation failed during downgrade — user dropped to free', {
            customerId,
            error: vaultError,
          });
          const { error: dropToFreeError } = await supabase
            .from('profiles')
            .update({
              subscription_tier: 'free',
              stripe_subscription_id: null,
              cancelled_at: new Date().toISOString(),
              pending_change_type: null,
              pending_change_date: null,
            })
            .eq('stripe_customer_id', customerId);

          if (dropToFreeError) {
            console.error('CRITICAL: Drop-to-free fallback also failed — user is in inconsistent state', {
              customerId,
              error: dropToFreeError,
            });
            return Response.json({ error: 'DB update failed' }, { status: 500 });
          }

          if (existingProfile?.id) await syncTierToLoops(existingProfile.id, 'free');
        }
      } else {
        // Normal cancel — drop to free
        const { data: cancelledProfile, error: cancelUpdateError } = await supabase
          .from('profiles')
          .update({
            subscription_tier: 'free',
            stripe_subscription_id: null,
            cancelled_at: new Date().toISOString(),
            pending_change_type: null,
            pending_change_date: null,
          })
          .eq('stripe_customer_id', customerId)
          .select('id')
          .single();

        if (cancelUpdateError) {
          console.error('CRITICAL: Subscription cancellation update failed', {
            customerId,
            error: cancelUpdateError,
          });
          return Response.json({ error: 'DB update failed' }, { status: 500 });
        }

        if (cancelledProfile?.id) await syncTierToLoops(cancelledProfile.id, 'free');
      }

      break;
    }
  }

  return Response.json({ received: true });
}