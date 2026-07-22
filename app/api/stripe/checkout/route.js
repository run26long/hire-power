import Stripe from 'stripe';
import { apiError } from '@/lib/apiError';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const ALLOWED_PRICE_IDS = [
  process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID,
  process.env.NEXT_PUBLIC_STRIPE_VAULT_PRICE_ID,
  process.env.NEXT_PUBLIC_STRIPE_VAULT_ANNUAL_PRICE_ID,
].filter(Boolean);

export async function POST(req) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const token = authHeader.replace('Bearer ', '')
    if (token !== process.env.INTERNAL_API_SECRET) {
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
      const { data: { user }, error: authError } = await supabase.auth.getUser(token)
      if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { priceId, userId, email, couponCode, resumeId, source } = await req.json();

    // Validate priceId against allowlist (prevents tampered requests)
    if (!ALLOWED_PRICE_IDS.includes(priceId)) {
      return apiError(
        new Error(`Invalid priceId attempted: ${priceId}`),
        "We couldn't process that subscription. Please refresh and try again.",
        400,
        'INVALID_PRICE'
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    // Build checkout session params
    const sessionParams = {
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      client_reference_id: userId,
      success_url: source === 'brb'
        ? `${baseUrl}/api/auth/post-stripe-brb?session_id={CHECKOUT_SESSION_ID}`
        : resumeId
          ? `${baseUrl}/resume/${resumeId}?upgraded=true`
          : `${baseUrl}/dashboard?upgraded=true`,
      cancel_url: source === 'brb'
        ? `${baseUrl}/brb-landing?cancelled=true`
        : resumeId
          ? `${baseUrl}/resume/${resumeId}`
          : `${baseUrl}/dashboard`,
      allow_promotion_codes: true,
      payment_method_collection: 'if_required',
      metadata: { userId, priceId },
    };

    // Apply coupon if provided — validate first, fail loudly if invalid
    if (couponCode) {
      try {
        await stripe.coupons.retrieve(couponCode);
        sessionParams.discounts = [{ coupon: couponCode }];
      } catch (e) {
        return apiError(
          e,
          "That coupon code isn't valid. Double-check it and try again.",
          400,
          'INVALID_COUPON'
        );
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return Response.json({ url: session.url });

  } catch (error) {
    return apiError(error, "We couldn't start checkout. Please try again in a moment.");
  }
}