import { createClient } from '@supabase/supabase-js';
import { apiError } from '@/lib/apiError';

const AUDIO_BUCKET = 'interview-audio';

// ============================================================================
// POST /api/interview/delete-session
// Destroys one practice session and everything filed under it.
//
// Server side with the service role rather than a client delete, because a
// client delete under RLS removes nothing and says nothing when the policy is
// missing. A destructive action that can quietly do nothing is worse than one
// that fails loudly, and this one has to be able to report the truth.
//
// Order matters: questions, then the session, then the audio. A failure
// partway leaves an empty session row rather than question rows pointing at a
// session that no longer exists.
//
// Request body: { session_id: string }
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
    const { session_id } = await request.json();
    if (!session_id) {
      return Response.json({ error: 'session_id is required' }, { status: 400 });
    }

    // ---- OWNERSHIP ----
    // The service role sees every row, so this check is the only thing
    // standing between a session id and whoever guessed it.
    const { data: session, error: sessionError } = await supabase
      .from('interview_sessions')
      .select('id')
      .eq('id', session_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (sessionError) {
      console.error('Delete session lookup error:', sessionError);
      return Response.json({ error: 'SESSION_DELETE_FAILED' }, { status: 500 });
    }
    if (!session) {
      return Response.json({ error: 'SESSION_NOT_FOUND' }, { status: 404 });
    }

    // ---- QUESTIONS ----
    const { error: questionsError } = await supabase
      .from('interview_questions')
      .delete()
      .eq('session_id', session_id)
      .eq('user_id', userId);

    if (questionsError) {
      console.error('Delete session questions error:', questionsError);
      return Response.json({ error: 'SESSION_DELETE_FAILED' }, { status: 500 });
    }

    // ---- SESSION ----
    const { error: deleteError } = await supabase
      .from('interview_sessions')
      .delete()
      .eq('id', session_id)
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Delete session error:', deleteError);
      return Response.json({ error: 'SESSION_DELETE_FAILED' }, { status: 500 });
    }

    // ---- AUDIO ----
    // Best effort, and last. The scores and feedback are what the candidate
    // asked to be rid of; a recording left behind is a cleanup job, not a
    // reason to tell them the deletion failed after it already happened.
    try {
      const { data: recordings } = await supabase.storage
        .from(AUDIO_BUCKET)
        .list(`${userId}/${session_id}`);

      const paths = (recordings || []).map(file => `${userId}/${session_id}/${file.name}`);
      if (paths.length > 0) {
        await supabase.storage.from(AUDIO_BUCKET).remove(paths);
      }
    } catch (audioErr) {
      console.error('Delete session audio failed (non-blocking):', audioErr);
    }

    return Response.json({ deleted: true });

  } catch (error) {
    return apiError(error, "We couldn't delete this session. Try again.");
  }
}
