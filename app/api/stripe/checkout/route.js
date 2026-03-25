import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(req) {
  try {
    const { priceId, userId, email, couponCode, resumeId } = await req.json();

    // Build checkout session params
    const sessionParams = {
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      client_reference_id: userId,
      success_url: resumeId
        ? `${process.env.NEXT_PUBLIC_SITE_URL}/resume/${resumeId}?upgraded=true`
        : `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard?upgraded=true`,
      cancel_url: resumeId
        ? `${process.env.NEXT_PUBLIC_SITE_URL}/resume/${resumeId}`
        : `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`,
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