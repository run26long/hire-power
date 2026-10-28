import { createClient } from '@supabase/supabase-js'
import { apiError } from '@/lib/apiError'
import { testimonialPlacements, isUuid } from '../../../_lib/placements'
import { requireCustomise } from '../../../_lib/requireCustomise'

// ============================================================================
// PUT /api/career-profile/testimonials/[testimonialId]/directions
//
// Which directions one testimonial appears on. The evidence route's twin, and
// deliberately the same shape: they are the same question over two
// collections, and two different answers to it is how the two halves of this
// feature drifted apart last time.
//
// Body: { scope: 'all' | 'selected', lens_ids?: string[] }
//
// THE PERSON WHO WROTE IT NEVER SEES THIS
// A referee writes into a request they were sent; they are not shown the
// profile, they are not shown its directions, and nothing they submit reaches
// this route. The owner decides where it appears when they review it, and can
// change that afterwards.
// ============================================================================

export async function PUT(request, { params }) {
  try {
    const { testimonialId } = await params
    if (!isUuid(testimonialId)) return Response.json({ error: 'Not found.' }, { status: 404 })

    const authHeader = request.headers.get('authorization')
    if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const token = authHeader.replace('Bearer ', '')

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const gate = await requireCustomise(user.id)
    if (gate) return gate

    const { data: profile } = await supabase
      .from('career_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!profile) return Response.json({ error: 'Not found.' }, { status: 404 })

    let body
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'Invalid request.' }, { status: 400 })
    }

    const scope = body?.scope === 'selected' ? 'selected' : body?.scope === 'all' ? 'all' : null
    if (!scope) {
      return Response.json({ error: 'Invalid request.', code: 'INVALID' }, { status: 400 })
    }

    const { data: item } = await supabase
      .from('profile_testimonials')
      .select('id')
      .eq('id', testimonialId)
      .eq('profile_id', profile.id)
      .maybeSingle()
    if (!item) return Response.json({ error: 'Not found.' }, { status: 404 })

    let lensIds = []
    if (scope === 'selected') {
      if (body?.lens_ids !== undefined && !Array.isArray(body.lens_ids)) {
        return Response.json({ error: 'Invalid request.', code: 'INVALID' }, { status: 400 })
      }
      const requested = [...new Set((body?.lens_ids || []).filter(isUuid))]
      if (requested.length > 0) {
        const { data: owned } = await supabase
          .from('profile_lenses')
          .select('id')
          .eq('profile_id', profile.id)
          .in('id', requested)
        lensIds = (owned || []).map(lens => lens.id)
        if (lensIds.length !== requested.length) {
          return Response.json(
            { error: 'One of those Career Directions is not on your profile.', code: 'BAD_LENS' },
            { status: 400 }
          )
        }
      }
    }

    await testimonialPlacements.setDirections(supabase, profile.id, testimonialId, scope, lensIds)

    const { error: scopeError } = await supabase
      .from('profile_testimonials')
      .update({ placement_scope: scope })
      .eq('id', testimonialId)
      .eq('profile_id', profile.id)

    if (scopeError) {
      console.error('[testimonials/directions] Scope write failed:', scopeError)
      return Response.json({ error: 'SAVE_FAILED' }, { status: 500 })
    }

    return Response.json({ ok: true, placement_scope: scope, lens_ids: lensIds })

  } catch (error) {
    return apiError(error, "We couldn't save where that appears. Please try again.")
  }
}
