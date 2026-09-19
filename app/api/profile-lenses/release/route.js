import { createClient } from '@supabase/supabase-js'
import { apiError } from '@/lib/apiError'

// ============================================================================
// POST /api/profile-lenses/release
// Lets go of a deleted core resume. Any direction of theirs pointing at it
// stops pointing at anything; its status is left exactly as it was.
//
// Request body: { resumeId: string }
//
// WHY THIS EXISTS
// A core resume and a direction are one decision made on two pages. Building
// the resume ties them together - the lens takes the resume's id and the
// direction locks on to the Career Profile, where it cannot be turned off
// while the resume exists. Deleting the resume is the release, and until now
// nothing performed it: the hub archived the row and left the id sitting on
// the lens.
//
// What that left behind was a direction locked to a resume that no longer
// existed. It could not be turned off on the Career Profile, because the lens
// still claimed a core; it could not be unlocked from the Resume Writer,
// because the page lists live resumes and this one was archived; and it showed
// no tile at all, because the hub sorts directions by whether their core can
// be switched to and this one's could not. Locked on one page, absent from the
// other, with the control that would free it on neither.
//
// STATUS IS NOT TOUCHED
// Deleting a resume says something about the resume. It does not say the
// direction is over, and a direction that quietly left somebody's public page
// because they tidied up a draft would be the page changing itself. The
// direction stays where it was and simply becomes theirs to move again.
//
// SAFE TO CALL FOR ANYTHING
// Job-specific resumes and old versions are deleted through the same handler.
// No lens points at those, so this matches nothing and reports zero, which
// saves the caller having to know which kind of row it just archived.
// ============================================================================

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const token = authHeader.replace('Bearer ', '')

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // The rows this releases belong to the token holder, never to a user id the
    // caller supplies. The service role sees every row, so this is the only
    // thing standing between a resume id and whoever guessed it.
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { resumeId } = await request.json()
    if (!resumeId || !UUID.test(resumeId)) {
      return Response.json({ error: 'resumeId is required' }, { status: 400 })
    }

    // Ownership rides on the update, the way it does in ./dismiss and
    // ./restore. A resume id belonging to somebody else matches no lens of
    // theirs and releases nothing.
    const { data: released, error: releaseError } = await supabase
      .from('profile_lenses')
      .update({ core_resume_id: null, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('core_resume_id', resumeId)
      .select('id, name, status')

    if (releaseError) {
      console.error('Lens release failed:', releaseError)
      return Response.json({ error: 'RELEASE_FAILED' }, { status: 500 })
    }

    return Response.json({ success: true, released: released || [] })

  } catch (error) {
    return apiError(error, "We couldn't update your directions. Please try again.")
  }
}
