import { createClient } from '@supabase/supabase-js';
import { apiError } from '@/lib/apiError';

const VALID_CONSENT_MODES = ['mode_1', 'mode_2'];

// ============================================================================
// POST /api/interview/consent
// Records one voice consent.
//
// Server side because of one field: the browser cannot see its own public IP,
// and the privacy policy says the address used to give consent is part of the
// record. Taking it from the request headers is the only way that promise is
// kept, and it also means the two fields that make the record evidence,
// user_id and ip_address, come from the request rather than from its body.
//
// Request body: {
//   mode_selected: 'mode_1' | 'mode_2',
//   consent_version: string,
//   consented_at: string,
//   user_agent: string | null
// }
// ============================================================================

// x-forwarded-for is a chain: client, then each proxy that added itself. Only
// the first entry is the candidate. Trustworthy behind a proxy that sets it,
// which is the only place this runs in production.
function clientIpFrom(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip') || 'unknown';
}

export async function POST(request) {
  try {
    // ---- AUTH ----
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const token = authHeader.replace('Bearer ', '');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // ---- INPUT ----
    const { mode_selected, consent_version, consented_at, user_agent } = await request.json();

    // A consent row for text mode would be a record of agreeing to nothing:
    // the microphone is never opened there.
    if (!VALID_CONSENT_MODES.includes(mode_selected)) {
      return Response.json({ error: 'INVALID_CONSENT_MODE' }, { status: 400 });
    }
    if (!consent_version) {
      return Response.json({ error: 'consent_version is required' }, { status: 400 });
    }

    // ---- WRITE ----
    const { data: record, error: insertError } = await supabase
      .from('user_voice_consent')
      .insert({
        // From the verified token and the request itself, not the body. A
        // consent record nobody can vouch for is not worth keeping.
        user_id: user.id,
        ip_address: clientIpFrom(request),
        mode_selected,
        consent_version,
        consented_at: consented_at || new Date().toISOString(),
        user_agent: user_agent || null
      })
      .select()
      .single();

    if (insertError) {
      console.error('Voice consent write failed:', insertError);
      return Response.json({ error: 'CONSENT_WRITE_FAILED' }, { status: 500 });
    }

    return Response.json({ consent: record });

  } catch (error) {
    return apiError(error, "We couldn't record your consent right now. Try again in a moment.");
  }
}
