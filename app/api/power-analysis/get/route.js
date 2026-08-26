import { createClient } from '@supabase/supabase-js';
import { apiError } from '@/lib/apiError';

// ============================================================================
// GET /api/power-analysis/get?jobCardId=<uuid>
// Returns existing Power Analysis for a job card, or null if none exists.
// Also returns the linked resume's metadata for staleness detection.
// ============================================================================

export async function GET(request) {
  try {
    // ---- AUTH ----
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const token = authHeader.replace('Bearer ', '');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    let userId;
    if (token === process.env.INTERNAL_API_SECRET) {
      // Internal call: userId must be in query string
      const { searchParams } = new URL(request.url);
      userId = searchParams.get('userId');
      if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    } else {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      userId = user.id;
    }

    // ---- INPUT ----
    const { searchParams } = new URL(request.url);
    const jobCardId = searchParams.get('jobCardId');
    if (!jobCardId) {
      return Response.json({ error: 'jobCardId required' }, { status: 400 });
    }

    // ---- LOAD JOB CARD ----
    const { data: jobCard, error: jobCardError } = await supabase
      .from('applications')
      .select('id, title, company, description, resume_id, match_score, interview_level, interview_readiness_score, interview_sessions_count, interview_last_practiced_at, interview_step, interview_active_story_id')
      .eq('id', jobCardId)
      .eq('user_id', userId)
      .single();

    if (jobCardError || !jobCard) {
      return Response.json({ error: 'JOB_CARD_NOT_FOUND' }, { status: 404 });
    }

    // ---- LOAD POWER ANALYSIS ----
    // Oldest row wins. limit(1) keeps this working if duplicates ever exist —
    // maybeSingle() alone errors on multiple rows, which used to 500 the page
    // and, worse, made the caller think no analysis existed.
    const { data: powerAnalysis, error: paError } = await supabase
      .from('power_analysis')
      .select('*')
      .eq('job_card_id', jobCardId)
      .eq('user_id', userId)
      .order('generated_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (paError) {
      console.error('Power Analysis fetch error:', paError);
      return Response.json({ error: 'FETCH_FAILED' }, { status: 500 });
    }

    // ---- LOAD LINKED RESUME (for staleness detection) ----
    let resume = null;
    const resumeIdToLoad = powerAnalysis?.resume_id || jobCard.resume_id;
    if (resumeIdToLoad) {
      const { data: resumeRow } = await supabase
        .from('resumes')
        .select('id, display_name, resume_type, updated_at, current_score, is_active')
        .eq('id', resumeIdToLoad)
        .eq('user_id', userId)
        .single();
      resume = resumeRow;
    }

    // ---- STALENESS CHECK ----
    // Power Analysis is stale if the resume was updated after PA was generated.
    let isStale = false;
    if (powerAnalysis && resume && resume.updated_at && powerAnalysis.resume_snapshot_at) {
      const resumeUpdated = new Date(resume.updated_at).getTime();
      const paSnapshot = new Date(powerAnalysis.resume_snapshot_at).getTime();
      isStale = resumeUpdated > paSnapshot;
    }

    // ---- RETURN ----
    return Response.json({
      jobCard: {
        id: jobCard.id,
        title: jobCard.title,
        company: jobCard.company,
        description: jobCard.description,
        resume_id: jobCard.resume_id,
        match_score: jobCard.match_score,
        interview_level: jobCard.interview_level ?? 0,
        interview_readiness_score: jobCard.interview_readiness_score ?? 0,
        interview_sessions_count: jobCard.interview_sessions_count ?? 0,
        interview_last_practiced_at: jobCard.interview_last_practiced_at,
        interview_step: jobCard.interview_step ?? null,
        interview_active_story_id: jobCard.interview_active_story_id ?? null
      },
      resume: resume ? {
        id: resume.id,
        display_name: resume.display_name,
        resume_type: resume.resume_type,
        updated_at: resume.updated_at,
        current_score: resume.current_score,
        is_active: resume.is_active
      } : null,
      powerAnalysis: powerAnalysis ? {
        id: powerAnalysis.id,
        core_power: powerAnalysis.core_power ?? [],
        hidden_power: powerAnalysis.hidden_power ?? [],
        power_gaps: powerAnalysis.power_gaps ?? [],
        generated_at: powerAnalysis.generated_at,
        resume_snapshot_at: powerAnalysis.resume_snapshot_at,
        refresh_count: powerAnalysis.refresh_count ?? 0,
        last_refreshed_at: powerAnalysis.last_refreshed_at,
        status: powerAnalysis.status,
        // Where the candidate is in the flow, and whether they finished or
        // skipped coaching. The hub reads the same two columns.
        coaching_status: powerAnalysis.coaching_status,
        current_step: powerAnalysis.current_step,
        isStale
      } : null
    });

  } catch (error) {
    return apiError(error, "We couldn't load this analysis. Try again in a moment.");
  }
}