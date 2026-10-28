import { createClient } from '@supabase/supabase-js'
import { apiError } from '@/lib/apiError'

// ============================================================================
// POST /api/profile-lenses/relink
// Puts a restored core resume back with the direction it was standing for.
//
// Request body: { resumeId: string }
//
// WHY THIS EXISTS
// ./release is the other half. Archiving a core writes the direction's id
// onto the resume and then lets the direction go, so that the pair survives
// as one fact on the half that is still there. Restoring the resume without
// this route brings back a core that remembers its direction while the
// direction has forgotten the core: the hub offers to build one it already
// has, and the resume sits in the list standing for nothing.
//
// WHEN IT DECLINES
// Three ways, all of them "somebody has moved on since":
//
//   the direction is gone        the resume keeps its memory of a row that no
//                                longer exists, and nothing is written. The
//                                foreign key is ON DELETE SET NULL, so this
//                                is usually a null lens_id by the time we get
//                                here rather than a dangling one.
//   the direction is dismissed   it was thrown away after the resume was
//                                archived, and quietly reviving it because an
//                                old resume came back would be the page
//                                changing itself.
//   the direction has a core     something else was built for it in the
//                                meantime. That one is current and this one
//                                is not, and overwriting it would take a
//                                resume off a direction nobody asked about.
//
// Declining is not an error. The resume is restored either way; it is simply
// restored unlinked, which is a state the hub already renders.
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

    // The rows this writes belong to the token holder, never to a user id the
    // caller supplies. The service role sees every row, so this is the only
    // thing standing between a resume id and whoever guessed it.
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { resumeId } = await request.json()
    if (!resumeId || !UUID.test(resumeId)) {
      return Response.json({ error: 'resumeId is required' }, { status: 400 })
    }

    const { data: resume, error: resumeError } = await supabase
      .from('resumes')
      .select('id, lens_id, resume_type, is_active')
      .eq('id', resumeId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (resumeError) {
      console.error('Relink resume lookup failed:', resumeError)
      return Response.json({ error: 'RELINK_FAILED' }, { status: 500 })
    }
    if (!resume) return Response.json({ error: 'RESUME_NOT_FOUND' }, { status: 404 })

    // Nothing to put back. A resume archived before ./release started
    // stamping, or one that never stood for a direction, both land here.
    if (!resume.lens_id || resume.resume_type !== 'core' || resume.is_active !== true) {
      return Response.json({ success: true, relinked: null })
    }

    // Every reason to decline rides on the update itself, so there is no
    // window between deciding and writing. A direction that has since been
    // dismissed, or has taken another core, matches nothing here.
    const { data: relinked, error: linkError } = await supabase
      .from('profile_lenses')
      .update({ core_resume_id: resumeId, updated_at: new Date().toISOString() })
      .eq('id', resume.lens_id)
      .eq('user_id', user.id)
      .neq('status', 'dismissed')
      .is('core_resume_id', null)
      .select('id, name, status')
      .maybeSingle()

    if (linkError) {
      console.error('Relink failed:', linkError)
      return Response.json({ error: 'RELINK_FAILED' }, { status: 500 })
    }

    return Response.json({ success: true, relinked: relinked || null })

  } catch (error) {
    return apiError(error, "We couldn't reconnect that resume to its Career Direction.")
  }
}
