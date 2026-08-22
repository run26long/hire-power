import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { apiError } from '@/lib/apiError';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Prices an existing subscription may be swapped onto. Same tier only —
// this route changes billing interval, not what the customer is paying for.
const ALLOWED_PRICE_IDS = [
  process.env.NEXT_PUBLIC_STRIPE_VAULT_PRICE_ID,
  process.env.NEXT_PUBLIC_STRIPE_VAULT_ANNUAL_PRICE_ID,
].filter(Boolean);

export async function POST(req) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const token = authHeader.replace('Bearer ', '')

    const body = await req.json();
    const { priceId } = body;

    // Take the target user from the token so a signed-in user can only change
    // their own billing. Internal callers pass userId explicitly.
    let userId = body.userId
    if (token !== process.env.INTERNAL_API_SECRET) {
      const { createClient: createAuthClient } = await import('@supabase/supabase-js')
      const authSupabase = createAuthClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
      const { data: { user }, error: authError } = await authSupabase.auth.getUser(token)
      if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
      userId = user.id
    }
    if (!userId) return Response.json({ error: 'Missing userId' }, { status: 400 });

    if (!ALLOWED_PRICE_IDS.includes(priceId)) {
      return apiError(
        new Error(`Invalid priceId attempted: ${priceId}`),
        "We couldn't update your billing. Please refresh and try again.",
        400,
        'INVALID_PRICE'
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_subscription_id, stripe_customer_id')
      .eq('id', userId)
      .single();

    if (profileError) {
      return apiError(profileError, "We couldn't load your subscription. Please try again.", 400);
    }

    // Fall back to the customer's active subscription if we never stored the id.
    let subscriptionId = profile?.stripe_subscription_id
    if (!subscriptionId && profile?.stripe_customer_id) {
      const list = await stripe.subscriptions.list({
        customer: profile.stripe_customer_id,
        status: 'active',
        limit: 1,
      });
      subscriptionId = list.data[0]?.id || null
    }

    if (!subscriptionId) {
      return Response.json({ error: 'No active subscription found' }, { status: 400 });
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const item = subscription.items.data[0];

    if (!item) {
      return Response.json({ error: 'No active subscription found' }, { status: 400 });
    }

    // Already on the requested price — nothing to do.
    if (item.price?.id === priceId) {
      return Response.json({ success: true, unchanged: true, price_id: priceId });
    }

    // Swap the price on the existing subscription so the customer never ends up
    // with two. Prorated, so they're credited for the unused part of the old plan.
    const updated = await stripe.subscriptions.update(subscriptionId, {
      items: [{ id: item.id, price: priceId }],
      proration_behavior: 'create_prorations',
    });

    return Response.json({
      success: true,
      price_id: updated.items.data[0]?.price?.id || null,
      interval: updated.items.data[0]?.price?.recurring?.interval || null,
    });

  } catch (error) {
    return apiError(error, "We couldn't update your billing. Please try again, or email hired@hirepowerai.com if it keeps failing.");
  }
}
