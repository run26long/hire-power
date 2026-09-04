import { createClient } from '@supabase/supabase-js';
import { apiError } from '@/lib/apiError';

const AUDIO_BUCKET = 'interview-audio';

// Long enough to sit with a set of results and replay several answers, short
// enough that a copied link is not a lasting one.
const SIGNED_URL_TTL_SECONDS = 3600;

// ============================================================================
// POST /api/interview/audio-url
// Hands back a temporary link to one stored answer recording.
//
// The path is rebuilt from the question row rather than stored anywhere, so
// this route and the uploader have to agree on its shape:
//   {user_id}/{session_id}/{question_id}-answer.webm
//
// Ownership comes from the question row itself, which carries user_id. A
// question belonging to someone else is reported as missing rather than
// forbidden: whether a given id exists is not this caller's business.
//
// Request body: { question_id: string }
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
    const { question_id } = await request.json();
    if (!question_id) {
      return Response.json({ error: 'question_id is required' }, { status: 400 });
    }

    // ---- QUESTION ----
    // user_id on the row is the whole ownership check: a question is only ever
    // written for the candidate who was asked it.
    const { data: question, error: questionError } = await supabase
      .from('interview_questions')
      .select('id, session_id')
      .eq('id', question_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (questionError) {
      console.error('Audio URL question lookup error:', questionError);
      return Response.json({ error: 'AUDIO_LOOKUP_FAILED' }, { status: 500 });
    }
    if (!question) {
      return Response.json({ error: 'QUESTION_NOT_FOUND' }, { status: 404 });
    }

    // ---- SESSION ----
    // Only mode_1 ever wrote a recording. Signing a path for the other modes
    // would hand back a link to nothing.
    const { data: session, error: sessionError } = await supabase
      .from('interview_sessions')
      .select('id, voice_mode')
      .eq('id', question.session_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (sessionError) {
      console.error('Audio URL session lookup error:', sessionError);
      return Response.json({ error: 'AUDIO_LOOKUP_FAILED' }, { status: 500 });
    }
    if (!session) {
      return Response.json({ error: 'SESSION_NOT_FOUND' }, { status: 404 });
    }
    if (session.voice_mode !== 'mode_1') {
      return Response.json({ error: 'AUDIO_NOT_RECORDED' }, { status: 400 });
    }

    // ---- SIGN ----
    const path = `${userId}/${question.session_id}/${question.id}-answer.webm`;

    const { data: signed, error: signError } = await supabase.storage
      .from(AUDIO_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

    // An upload that failed during the interview lands here. Not an error the
    // candidate needs explaining: the answer and its scores are all intact,
    // and only the playback is missing.
    if (signError || !signed?.signedUrl) {
      return Response.json({ error: 'AUDIO_NOT_FOUND' }, { status: 404 });
    }

    return Response.json({ url: signed.signedUrl, expires_in: SIGNED_URL_TTL_SECONDS });

  } catch (error) {
    return apiError(error, "We couldn't load that recording right now.");
  }
}
