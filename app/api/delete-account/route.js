import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { apiError } from '@/lib/apiError';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const token = authHeader.replace('Bearer ', '');

    const { data: { user }, error: authError } = await adminSupabase.auth.getUser(token);
    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = user.id;

    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('stripe_subscription_id')
      .eq('id', userId)
      .maybeSingle();

    if (profile?.stripe_subscription_id) {
      try {
        await stripe.subscriptions.cancel(profile.stripe_subscription_id);
      } catch (stripeErr) {
        console.error('Stripe cancel during account delete failed (non-blocking):', stripeErr.message);
      }
    }

    try {
      const { data: files } = await adminSupabase.storage
        .from('profile-photos')
        .list('', { search: userId });
      if (files && files.length > 0) {
        const filenames = files
          .filter(f => f.name.startsWith(`${userId}-`))
          .map(f => f.name);
        if (filenames.length > 0) {
          await adminSupabase.storage.from('profile-photos').remove(filenames);
        }
      }
    } catch (storageErr) {
      console.error('Profile photo delete failed (non-blocking):', storageErr);
    }

    // Interview recordings live two levels down, one folder per session, so
    // the user's folder has to be walked rather than listed. Non-blocking like
    // the photos above: a storage failure must not leave the account itself
    // half deleted.
    try {
      const { data: sessionFolders } = await adminSupabase.storage
        .from('interview-audio')
        .list(userId);

      const audioPaths = [];
      for (const folder of sessionFolders || []) {
        const { data: recordings } = await adminSupabase.storage
          .from('interview-audio')
          .list(`${userId}/${folder.name}`);
        (recordings || []).forEach(file => {
          audioPaths.push(`${userId}/${folder.name}/${file.name}`);
        });
      }

      if (audioPaths.length > 0) {
        await adminSupabase.storage.from('interview-audio').remove(audioPaths);
      }
    } catch (audioErr) {
      console.error('Interview audio delete failed (non-blocking):', audioErr);
    }

    const { error: profileDeleteError } = await adminSupabase
      .from('profiles')
      .delete()
      .eq('id', userId);
    if (profileDeleteError) {
      return apiError(
        profileDeleteError,
        "We couldn't delete your account. Please email hired@hirepowerai.com so we can finish this for you.",
        500
      );
    }

    const { error: deleteUserError } = await adminSupabase.auth.admin.deleteUser(userId);
    if (deleteUserError) {
      return apiError(
        deleteUserError,
        "We couldn't fully delete your account. Please email hired@hirepowerai.com so we can finish this for you.",
        500
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    return apiError(
      error,
      "We couldn't delete your account. Please try again, or email hired@hirepowerai.com if it keeps failing."
    );
  }
}