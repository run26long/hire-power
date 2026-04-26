import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const token = authHeader.replace('Bearer ', '')
    if (token !== process.env.INTERNAL_API_SECRET) {
      const { createClient: createAuthClient } = await import('@supabase/supabase-js')
      const authSupabase = createAuthClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
      const { data: { user }, error: authError } = await authSupabase.auth.getUser(token)
      if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
    const updated = await stripe.subscriptions.update(profile.stripe_subscription_id, {
      cancel_at_period_end: true,
    });

    const periodEnd = updated.cancel_at || updated.current_period_end;

    // Save pending change in profile so UI can display it
    await supabase
      .from('profiles')
      .update({
        pending_change_type: 'cancel',
        pending_change_date: new Date(periodEnd * 1000).toISOString(),
        cancellation_feedback: feedback || null,
      })
      .eq('id', userId);

    return Response.json({
      success: true,
      scheduled_date: new Date(periodEnd * 1000).toISOString(),
    });

  } catch (error) {
    console.error('Stripe cancel error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}