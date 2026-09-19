import { createClient } from '@supabase/supabase-js'
import { apiError } from '@/lib/apiError'

// ============================================================================
// POST /api/profile-lenses/restore
// Puts one dismissed lens back among the suggestions. The inverse of ./dismiss,
// and deliberately its mirror image: same ownership, same eligibility, the two
// status values swapped.
//
// Dismissing never deleted anything - the row stayed so the evaluation could
// see the direction had already been offered - which is the whole reason this
// can exist at all. Nothing is rebuilt here. The name, the evidence summary and
// anything else written for it are still on the row and come back with it.
//
// WHY IT IS NOT THE VISIBILITY ROUTE
// /api/career-profile/lens/[lensId]/visibility refuses a dismissed lens on
// purpose, and says so: putting back something somebody threw away is a
// different decision from un-hiding something they kept. This route is that
// different decision, and afterwards the lens is a suggestion again - not on
// the profile, offered.
//
// NOT GATED
// A free account may restore. It changes a status back and puts an offer on the
// hub; building the core behind it is what costs, and that gate is on the build
// route where it belongs. ./dismiss is ungated for the same reason.
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

    // The row this restores belongs to the token holder, never to a user id the
    // caller supplies. The service role sees every row, so this is the only thing
    // standing between a lens id and whoever guessed it.
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = user.id

    const { lensId } = await request.json()
    if (!lensId) return Response.json({ error: 'lensId is required' }, { status: 400 })

    // Ownership and eligibility ride on the update itself: anything that is not
    // a dismissed suggestion of theirs matches nothing and comes back as not
    // found. The source test is the one ./dismiss applies, so a direction this
    // endpoint can restore is exactly one that endpoint could have retired.
    const { data: updated, error: updateError } = await supabase
      .from('profile_lenses')
      .update({ status: 'suggested', updated_at: new Date().toISOString() })
      .eq('id', lensId)
      .eq('user_id', userId)
      .eq('status', 'dismissed')
      .eq('source', 'coaching_extraction')
      .select('id, name, slug, status, core_resume_id')
      .maybeSingle()

    if (updateError) {
      console.error('Lens restore failed:', updateError)
      return Response.json({ error: 'RESTORE_FAILED' }, { status: 500 })
    }
    if (!updated) return Response.json({ error: 'LENS_NOT_FOUND' }, { status: 404 })

    return Response.json({ success: true, lens: updated })

  } catch (error) {
    return apiError(error, "We couldn't bring that suggestion back. Please try again.")
  }
}
