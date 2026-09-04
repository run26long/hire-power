import { createClient } from '@supabase/supabase-js';
import { apiError } from '@/lib/apiError';

// Buffer and multipart assembly both want the Node runtime, not Edge.
export const runtime = 'nodejs';

const OPENAI_STT_URL = 'https://api.openai.com/v1/audio/transcriptions';
const STT_MODEL = 'gpt-4o-mini-transcribe';

// OpenAI's upload ceiling. Rejected here so a long recording fails fast
// instead of after a full upload to them.
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

// Opus in a webm container runs about 32 kbps from a browser recorder, so
// roughly 4000 bytes per second. Only ever an estimate: gpt-4o-mini-transcribe
// returns plain JSON with no duration field, so there is nothing exact to log.
const BYTES_PER_SECOND_ESTIMATE = 4000;

// ~$0.003 per minute of audio.
const USD_PER_SECOND = 0.003 / 60;

// OpenAI reads the format off the filename, so the extension has to match what
// the browser actually recorded.
const EXTENSION_BY_TYPE = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'mp4',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav'
};

function extensionFor(mimeType) {
  const base = (mimeType || '').split(';')[0].trim().toLowerCase();
  return EXTENSION_BY_TYPE[base] || 'webm';
}

// ============================================================================
// COST LOGGING
// Non-blocking: a logging failure must never cost the caller their transcript.
// audio_seconds is an estimate from the byte count, not a measured duration.
// status is CHECK-constrained to 'success', 'failure', 'refusal', 'rate_limit'.
// ============================================================================

async function logApiCall(supabase, { userId, sessionId, seconds, status }) {
  try {
    const { error } = await supabase.from('api_call_log').insert({
      user_id: userId,
      session_id: sessionId,
      feature: 'stt',
      provider: 'openai',
      model: STT_MODEL,
      call_type: 'stt',
      input_tokens: 0,
      cached_input_tokens: 0,
      output_tokens: 0,
      audio_seconds: seconds,
      estimated_cost_usd: status === 'success' && seconds ? seconds * USD_PER_SECOND : 0,
      status
    });
    if (error) console.error('api_call_log insert failed (non-blocking):', error);
  } catch (logErr) {
    console.error('api_call_log insert failed (non-blocking):', logErr);
  }
}

// ============================================================================
// POST /api/interview/stt
// Transcribes one spoken answer and hands back the text. The candidate edits
// that text and submits it the same way a typed answer is submitted, so this
// route stands alone: it scores nothing and writes nothing to the session.
//
// PATTERN A — IN MEMORY ONLY.
// The recording exists as a Buffer for the length of this request, is forwarded
// straight to OpenAI, and is collected when the response returns. It is never
// written to disk: no fs calls, no temp files, no /tmp, no storage bucket, and
// the bytes are never persisted to the database. This is a privacy commitment
// made in the privacy policy, not an implementation detail. Anything that would
// give the audio a filesystem path breaks the promise.
//
// Request body: multipart/form-data with
//   audio: Blob        // the recording, typically audio/webm
//   session_id: string
//
// The bearer token comes from the Authorization header, never from the form:
// a form field is attacker-shaped input and the header is not.
//
// Returns: { transcript: string }
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
    let form;
    try {
      form = await request.formData();
    } catch (formErr) {
      console.error('STT form parse error:', formErr);
      return Response.json({ error: 'AUDIO_EMPTY' }, { status: 400 });
    }

    const sessionId = form.get('session_id');
    if (!sessionId || typeof sessionId !== 'string') {
      return Response.json({ error: 'session_id is required' }, { status: 400 });
    }

    const audioField = form.get('audio');
    if (!audioField || typeof audioField === 'string') {
      return Response.json({ error: 'AUDIO_EMPTY' }, { status: 400 });
    }

    // ---- SESSION ----
    // Checked before the audio is read, so a request against someone else's
    // session never gets as far as holding their recording in memory.
    const { data: session, error: sessionError } = await supabase
      .from('interview_sessions')
      .select('id, status')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .maybeSingle();

    if (sessionError) {
      console.error('STT session lookup error:', sessionError);
      return Response.json({ error: 'STT_LOOKUP_FAILED' }, { status: 500 });
    }
    if (!session) {
      return Response.json({ error: 'SESSION_NOT_FOUND' }, { status: 404 });
    }
    if (session.status !== 'in_progress') {
      return Response.json({ error: 'SESSION_NOT_ACTIVE' }, { status: 400 });
    }

    // ---- READ THE AUDIO (MEMORY ONLY) ----
    const audioBuffer = Buffer.from(await audioField.arrayBuffer());

    if (!audioBuffer.length) {
      return Response.json({ error: 'AUDIO_EMPTY' }, { status: 400 });
    }
    if (audioBuffer.length > MAX_AUDIO_BYTES) {
      return Response.json({ error: 'AUDIO_TOO_LARGE' }, { status: 400 });
    }

    const estimatedSeconds = Math.max(1, Math.round(audioBuffer.length / BYTES_PER_SECOND_ESTIMATE));
    const mimeType = audioField.type || 'audio/webm';

    // ---- TRANSCRIBE ----
    // Raw multipart via fetch rather than the OpenAI SDK, which is not a
    // dependency here. Content-Type is deliberately unset: fetch writes it
    // along with the multipart boundary, and setting it by hand breaks the
    // body OpenAI receives.
    const openaiForm = new FormData();
    openaiForm.append(
      'file',
      new Blob([audioBuffer], { type: mimeType }),
      `answer.${extensionFor(mimeType)}`
    );
    openaiForm.append('model', STT_MODEL);
    openaiForm.append('response_format', 'json');

    let openaiResponse;
    try {
      openaiResponse = await fetch(OPENAI_STT_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: openaiForm
      });
    } catch (fetchErr) {
      console.error('STT request failed:', fetchErr);
      await logApiCall(supabase, {
        userId,
        sessionId,
        seconds: estimatedSeconds,
        status: 'failure'
      });
      return Response.json({ error: 'STT_FAILED' }, { status: 500 });
    }

    if (!openaiResponse.ok) {
      // Server log only: the error body can name the account or the key.
      const detail = await openaiResponse.text().catch(() => '');
      console.error(`STT API error ${openaiResponse.status}:`, detail.slice(0, 500));
      await logApiCall(supabase, {
        userId,
        sessionId,
        seconds: estimatedSeconds,
        status: openaiResponse.status === 429 ? 'rate_limit' : 'failure'
      });
      return Response.json({ error: 'STT_FAILED' }, { status: 500 });
    }

    let parsed;
    try {
      parsed = await openaiResponse.json();
    } catch (parseErr) {
      console.error('STT response parse error:', parseErr);
      await logApiCall(supabase, {
        userId,
        sessionId,
        seconds: estimatedSeconds,
        status: 'failure'
      });
      return Response.json({ error: 'STT_FAILED' }, { status: 500 });
    }

    const transcript = typeof parsed.text === 'string' ? parsed.text.trim() : '';

    // ---- LOG ----
    // Silence is a successful call: it was billed, and an empty transcript is
    // an answer the candidate can see and redo, not an error.
    await logApiCall(supabase, {
      userId,
      sessionId,
      seconds: estimatedSeconds,
      status: 'success'
    });

    // ---- RETURN ----
    return Response.json({ transcript });

  } catch (error) {
    return apiError(error, "We couldn't transcribe that recording. You can type your answer instead.");
  }
}
