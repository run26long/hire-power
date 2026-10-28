import { createClient } from '@supabase/supabase-js'
import { apiError } from '@/lib/apiError'
import { MIN_TESTIMONIALS, synthesiseProfile } from '../_lib/collectiveImpact'

// ============================================================================
// POST /api/career-profile/collective-impact
// No body.
//
// Synthesises the profile's published testimonials into one short editorial
// summary and three supporting statements, and stores the result.
//
// The model is given the testimonials and nothing else: no resume, no bio, no
// experience, no proof points. What it returns therefore cannot be grounded in
// anything the referees did not actually say, which is the point of the
// section.
//
// One synthesis per profile. Every published testimonial goes in whatever
// Career Direction it is shown on, and every direction displays the same
// reading. The work itself is in ../_lib/collectiveImpact, shared with the
// backfill script; this route is only the part that establishes who is asking
// and which profile is theirs.
//
// The testimonials are never written to. This route reads them and writes one
// row of its own.
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

    // The profile this writes to comes from the token, never from a body. The
    // service role sees every row, so this is the only thing standing between
    // a profile id and whoever guessed it.
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = user.id

    const [profileRes, ownerRes] = await Promise.all([
      supabase.from('career_profiles').select('id, user_id').eq('user_id', userId).maybeSingle(),
      // Only so the name can be kept out of the copy it is about.
      supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle()
    ])

    if (profileRes.error) {
      console.error('[collective-impact] Profile lookup failed:', profileRes.error)
      return Response.json({ error: 'GENERATION_FAILED' }, { status: 500 })
    }
    const profile = profileRes.data
    if (!profile) return Response.json({ error: 'PROFILE_NOT_FOUND' }, { status: 404 })

    const result = await synthesiseProfile(supabase, {
      profileId: profile.id,
      userId,
      ownerName: ownerRes.data?.display_name || ''
    })

    // Under the minimum is a state a profile is legitimately in, not a fault
    // the editor should surface. It is still a 422 so a caller can tell it
    // apart from a write.
    if (result.status === 'not_enough') {
      return Response.json(
        { error: 'NOT_ENOUGH_TESTIMONIALS', eligible: result.eligible, minimum: MIN_TESTIMONIALS },
        { status: 422 }
      )
    }

    if (result.status === 'unchanged') {
      return Response.json({ ok: true, unchanged: true, eligible: result.eligible })
    }

    return Response.json({ collectiveImpact: result.impact })
  } catch (error) {
    return apiError(error, "We couldn't build the collective impact right now. Please try again.")
  }
}
