import { createClient } from '@supabase/supabase-js';
import { apiError } from '@/lib/apiError';

const OPENAI_TTS_URL = 'https://api.openai.com/v1/audio/speech';
const TTS_MODEL = 'tts-1';

// Neutral and professional. Interchangeable with any of OpenAI's voices later;
// nothing downstream depends on which one this is.
const TTS_VOICE = 'nova';

// tts-1 rejects anything longer. Caught here so the candidate gets a real
// error code instead of an opaque 400 relayed from OpenAI.
const MAX_INPUT_CHARS = 4096;

// $15.00 per 1M characters.
const USD_PER_CHARACTER = 15.0 / 1_000_000;

// ============================================================================
// COST LOGGING
// Non-blocking, same as the text routes: a logging failure must never cost the
// caller their audio. Runs on the failure path too, though a failed TTS call
// bills nothing, so it records the attempt rather than the spend.
// status is CHECK-constrained to 'success', 'failure', 'refusal', 'rate_limit'.
// ============================================================================

async function logApiCall(supabase, { userId, sessionId, characters, status }) {
  try {
    const { error } = await supabase.from('api_call_log').insert({
      user_id: userId,
      session_id: sessionId,
      feature: 'tts',
      provider: 'openai',
      model: TTS_MODEL,
      call_type: 'tts',
      input_tokens: 0,
      cached_input_tokens: 0,
      output_tokens: 0,
      audio_characters: characters,
      estimated_cost_usd: status === 'success' ? characters * USD_PER_CHARACTER : 0,
      status
    });
    if (error) console.error('api_call_log insert failed (non-blocking):', error);
  } catch (logErr) {
    console.error('api_call_log insert failed (non-blocking):', logErr);
  }
}

// ============================================================================
// POST /api/interview/tts
// Speaks one question aloud. Takes the text rather than a question_id: the
// caller already has the question on screen, and the same endpoint can voice
// an intro line or a follow-up that was never stored as a row.
//
// The audio is streamed straight back and never written anywhere. Nothing
// about the utterance is stored beyond the character count in the cost log.
//
// Request body: {
//   session_id: string,
//   text: string
// }
//
// Returns: audio/mpeg
// ============================================================================

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
    const userId = user.id;

    // ---- INPUT ----
    const { session_id, text } = await request.json();

    if (!session_id) {
      return Response.json({ error: 'session_id is required' }, { status: 400 });
    }

    const speechText = typeof text === 'string' ? text.trim() : '';
    if (!speechText) {
      return Response.json({ error: 'TEXT_EMPTY' }, { status: 400 });
    }
    if (speechText.length > MAX_INPUT_CHARS) {
      return Response.json({ error: 'TEXT_TOO_LONG' }, { status: 400 });
    }

    // ---- SESSION ----
    // Ownership, not just existence: the session id is the only thing tying
    // this spend to a user, and an unchecked id would let one account bill
    // audio against another's.
    const { data: session, error: sessionError } = await supabase
      .from('interview_sessions')
      .select('id, status')
      .eq('id', session_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (sessionError) {
      console.error('TTS session lookup error:', sessionError);
      return Response.json({ error: 'TTS_LOOKUP_FAILED' }, { status: 500 });
    }
    if (!session) {
      return Response.json({ error: 'SESSION_NOT_FOUND' }, { status: 404 });
    }
    if (session.status !== 'in_progress') {
      return Response.json({ error: 'SESSION_NOT_ACTIVE' }, { status: 400 });
    }

    // ---- SPEAK ----
    // Raw fetch rather than the OpenAI SDK, which is not a dependency here.
    let openaiResponse;
    try {
      openaiResponse = await fetch(OPENAI_TTS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: TTS_MODEL,
          voice: TTS_VOICE,
          input: speechText,
          response_format: 'mp3'
        })
      });
    } catch (fetchErr) {
      console.error('TTS request failed:', fetchErr);
      await logApiCall(supabase, {
        userId,
        sessionId: session_id,
        characters: speechText.length,
        status: 'failure'
      });
      return Response.json({ error: 'TTS_FAILED' }, { status: 500 });
    }

    if (!openaiResponse.ok) {
      // Body is JSON on an error even though a success is binary. Read it for
      // the server log only: it can name the account or the key, so it never
      // reaches the client.
      const detail = await openaiResponse.text().catch(() => '');
      console.error(`TTS API error ${openaiResponse.status}:`, detail.slice(0, 500));
      await logApiCall(supabase, {
        userId,
        sessionId: session_id,
        characters: speechText.length,
        status: openaiResponse.status === 429 ? 'rate_limit' : 'failure'
      });
      return Response.json({ error: 'TTS_FAILED' }, { status: 500 });
    }

    const audio = await openaiResponse.arrayBuffer();

    if (!audio.byteLength) {
      console.error('TTS returned an empty body');
      await logApiCall(supabase, {
        userId,
        sessionId: session_id,
        characters: speechText.length,
        status: 'failure'
      });
      return Response.json({ error: 'TTS_FAILED' }, { status: 500 });
    }

    // ---- LOG ----
    await logApiCall(supabase, {
      userId,
      sessionId: session_id,
      characters: speechText.length,
      status: 'success'
    });

    // ---- RETURN ----
    return new Response(audio, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audio.byteLength),
        // Interview audio is personal. Keep it out of every cache between
        // here and the browser.
        'Cache-Control': 'no-store'
      }
    });

  } catch (error) {
    return apiError(error, "We couldn't read that question aloud. You can still read it on screen.");
  }
}
