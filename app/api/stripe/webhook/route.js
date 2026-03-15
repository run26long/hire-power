import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

  const session = event.data.object;

  switch (event.type) {
    case 'checkout.session.completed': {
      const userId = session.client_reference_id;
      const priceId = session.metadata?.priceId;

      const tier = priceId === process.env.STRIPE_PRO_PRICE_ID ? 'pro' : 'maintenance';

      await supabase
        .from('profiles')
        .update({
          subscription_tier: tier,
          subscription_start_date: new Date().toISOString(),
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
        })
        .eq('id', userId);

      break;
    }

    case 'customer.subscription.deleted': {
      const customerId = session.customer;

      await supabase
        .from('profiles')
        .update({
          subscription_tier: 'free',
          cancelled_at: new Date().toISOString(),
        })
        .eq('stripe_customer_id', customerId);

      break;
    }
  }

  return Response.json({ received: true });
}