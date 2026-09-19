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
    //
    // Neither is one with a core resume behind it, whatever its status. The
    // status test used to cover this by accident - building a core sets the
    // lens active, and active never matched here - but only by accident: a row
    // that acquired a core without acquiring the status, which the backfills
    // produced, could be dismissed out of both pages while its resume went on
    // existing. The pointer is the thing that matters, so the pointer is what
    // is asked. Deleting the core releases the lens and this accepts it again.
    // ---- WHERE IT LANDS ----
    // Last. The hub decides which directions get tiles by rank and offers the
    // rest from the "Additional suggestions" menu, so moving a direction to the
    // end of the rank is what takes it off the row - the status says it is put
    // away, the rank says where it now sits among everything else put away.
    //
    // Read before the write rather than folded into it, because this has to
    // know the largest rank the account is using and no update can ask that of
    // itself.
    const { data: ranks, error: rankError } = await supabase
      .from('profile_lenses')
      .select('sort_order')
      .eq('user_id', userId)
      .order('sort_order', { ascending: false })
      .limit(1)

    if (rankError) {
      console.error('Lens rank lookup failed:', rankError)
      return Response.json({ error: 'DISMISS_FAILED' }, { status: 500 })
    }
    const lastRank = (ranks?.[0]?.sort_order ?? 0) + 1

    // 'active' is accepted as well now. A direction turned on from the Career
    // Profile that has no resume yet still holds a tile on the hub, and a tile
    // that offers to be dismissed has to have a route that will take it. What
    // it costs is the thing the status already said: the direction comes off
    // the public page. It is not lost - it is in the menu, and picking it there
    // brings it back.
    const { data: updated, error: updateError } = await supabase
      .from('profile_lenses')
      .update({
        status: 'dismissed',
        sort_order: lastRank,
        updated_at: new Date().toISOString()
      })
      .eq('id', lensId)
      .eq('user_id', userId)
      .in('status', ['suggested', 'hidden', 'active'])
      .is('core_resume_id', null)
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
