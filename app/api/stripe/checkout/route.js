import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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

    const { priceId, userId, email, couponCode, resumeId } = await req.json();

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    // Build checkout session params
    const sessionParams = {
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      client_reference_id: userId,
      success_url: resumeId
        ? `${baseUrl}/resume/${resumeId}?upgraded=true`
        : `${baseUrl}/dashboard?upgraded=true`,
      cancel_url: resumeId
        ? `${baseUrl}/resume/${resumeId}`
        : `${baseUrl}/dashboard`,
      allow_promotion_codes: true,
      payment_method_collection: 'if_required',
      metadata: { userId, priceId },
    };

    // Apply coupon if provided
    if (couponCode) {
      // Look up coupon in Stripe
      try {
        const coupon = await stripe.coupons.retrieve(couponCode);
        if (coupon) {
          sessionParams.discounts = [{ coupon: couponCode }];
        }
      } catch (e) {
        // Invalid coupon — proceed without discount
        console.log('Invalid coupon code:', couponCode);
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return Response.json({ url: session.url });

  } catch (error) {
    console.error('Stripe checkout error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}