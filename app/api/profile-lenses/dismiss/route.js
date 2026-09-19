import { createClient } from '@supabase/supabase-js'
import { apiError } from '@/lib/apiError'

// ============================================================================
// POST /api/profile-lenses/dismiss
// Retires one suggested lens. Only a suggestion this account owns, and only one
// the coaching extraction wrote: a direction the user built or named themselves
// is not this endpoint's to remove.
//
// Dismissed rather than deleted, so the evaluation that suggested it can see it
// was already offered and not offer it again.
//
// Request body: { lensId: string }
// ============================================================================

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const token = authHeader.replace('Bearer ', '')

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // The row this dismisses belongs to the token holder, never to a user id the
    // caller supplies. The service role sees every row, so this is the only thing
    // standing between a lens id and whoever guessed it.
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = user.id

    const { lensId } = await request.json()
    if (!lensId) return Response.json({ error: 'lensId is required' }, { status: 400 })

    // Ownership and eligibility ride on the update itself: an active lens or a
    // user-created one matches nothing here and comes back as not found.
    //
    // Hidden counts as well as suggested. A hidden direction is one taken off
    // the profile and kept, and it still shows on the resume hub as a core that
    // could be built - so the hub offers to retire it, and this is the route
    // that has to accept it. Without it the control could only fail.
    //
    // The source test does not move with it. A direction the user built or
    // named themselves is still not this endpoint's to remove, whatever its
    // status, and hiding one does not make it so.
    const { data: updated, error: updateError } = await supabase
      .from('profile_lenses')
      .update({ status: 'dismissed', updated_at: new Date().toISOString() })
      .eq('id', lensId)
      .eq('user_id', userId)
      .in('status', ['suggested', 'hidden'])
      .eq('source', 'coaching_extraction')
      .select('id')
      .maybeSingle()

    if (updateError) {
      console.error('Lens dismiss failed:', updateError)
      return Response.json({ error: 'DISMISS_FAILED' }, { status: 500 })
    }
    if (!updated) return Response.json({ error: 'LENS_NOT_FOUND' }, { status: 404 })

    return Response.json({ success: true, lensId: updated.id })

  } catch (error) {
    return apiError(error, "We couldn't remove this suggestion. Please try again.")
  }
}
