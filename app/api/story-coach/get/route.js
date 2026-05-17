import { createClient } from '@supabase/supabase-js';
import { apiError } from '@/lib/apiError';

// ============================================================================
// GET /api/story-coach/get?jobCardId=<uuid>
//        [&itemType=core_power|hidden_power|power_gap&itemIndex=<int>]
//
// Returns either:
//   - All stories for a job card (when only jobCardId is provided)
//   - A single story (when itemType + itemIndex are also provided)
//
// Used by:
//   - Detail page on load: fetch all stories to know which items are coached
//   - Coach this click: fetch single story to check if mid-session (resume) or
//     already complete (show story)
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
    const itemType = searchParams.get('itemType');
    const itemIndexParam = searchParams.get('itemIndex');

    if (!jobCardId) {
      return Response.json({ error: 'jobCardId required' }, { status: 400 });
    }

    // ---- SINGLE STORY MODE ----
    if (itemType && itemIndexParam !== null && itemIndexParam !== '') {
      const itemIndex = parseInt(itemIndexParam, 10);
      if (Number.isNaN(itemIndex)) {
        return Response.json({ error: 'itemIndex must be a number' }, { status: 400 });
      }
      if (!['core_power', 'hidden_power', 'power_gap'].includes(itemType)) {
        return Response.json({ error: 'Invalid itemType' }, { status: 400 });
      }

      const { data: story, error: storyError } = await supabase
        .from('interview_stories')
        .select('*')
        .eq('job_card_id', jobCardId)
        .eq('user_id', userId)
        .eq('item_type', itemType)
        .eq('item_index', itemIndex)
        .maybeSingle();

      if (storyError) {
        console.error('Story fetch error:', storyError);
        return Response.json({ error: 'FETCH_FAILED' }, { status: 500 });
      }

      // Null is a valid response (no story yet for this item)
      return Response.json({
        story: story ? shapeStory(story) : null
      });
    }

    // ---- ALL STORIES MODE ----
    const { data: rows, error: listError } = await supabase
      .from('interview_stories')
      .select('*')
      .eq('job_card_id', jobCardId)
      .eq('user_id', userId)
      .order('item_type', { ascending: true })
      .order('item_index', { ascending: true });

    if (listError) {
      console.error('Stories list error:', listError);
      return Response.json({ error: 'FETCH_FAILED' }, { status: 500 });
    }

    const stories = (rows || []).map(shapeStory);

    // Convenience grouping for the UI
    const byType = {
      core_power: stories.filter(s => s.itemType === 'core_power'),
      hidden_power: stories.filter(s => s.itemType === 'hidden_power'),
      power_gap: stories.filter(s => s.itemType === 'power_gap')
    };

    const completedCount = stories.filter(s => s.coachingComplete).length;
    const inProgressCount = stories.filter(s => !s.coachingComplete).length;

    return Response.json({
      stories,
      byType,
      completedCount,
      inProgressCount
    });

  } catch (error) {
    return apiError(error, "We couldn't load coaching stories. Try again in a moment.");
  }
}

// ============================================================================
// Shape helper — converts DB row to API-friendly shape
// Strips internal fields (user_id, power_analysis_id) and the dialogue payload
// (which we don't return for in-progress sessions via this endpoint, since
// the /start and /message endpoints handle live dialogue state).
// ============================================================================
function shapeStory(row) {
  return {
    id: row.id,
    jobCardId: row.job_card_id,
    itemType: row.item_type,
    itemIndex: row.item_index,
    itemSkill: row.item_skill,
    coachingComplete: row.coaching_complete,
    starSituation: row.star_situation,
    starTask: row.star_task,
    starAction: row.star_action,
    starResult: row.star_result,
    polishedStory: row.polished_story,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    hasDialogue: Array.isArray(row.coaching_dialogue) && row.coaching_dialogue.length > 0,
    dialogue: row.coaching_dialogue || []
  };
}