import { createClient } from '@supabase/supabase-js'
import { apiError } from '@/lib/apiError'
import { evidencePlacements, isUuid } from '../../../_lib/placements'
import { requireCustomise } from '../../../_lib/requireCustomise'

// ============================================================================
// PUT /api/career-profile/evidence/[evidenceId]/directions
//
// Which directions one piece of evidence appears on.
//
// Body: { scope: 'all' | 'selected', lens_ids?: string[] }
//
// WHY THIS IS ONE ROUTE AND NOT A TOGGLE PER DIRECTION
// There used to be an `assign` op that added or removed a single placement
// row. It was never wired to anything, and it could not have expressed this
// question anyway: "on every direction, including the ones that do not exist
// yet" is not a set of rows, and a per-row toggle has no way to say it.
//
// It also had no safe intermediate state. Narrowing from three directions to
// one, as three separate calls, passes through "on nothing" - and if the
// third call never arrives the item is left somewhere the owner never chose.
// Scope and rows are one decision, so they are one request.
//
// WHOSE EVIDENCE THIS IS
// The token's. The id in the path is matched together with the caller's
// profile, so a guessed id belonging to somebody else is a 404 and not a
// write. The service role sees every row; this pairing is the only thing
// standing between a uuid and another person's profile.
// ============================================================================

export async function PUT(request, { params }) {
  try {
    const { evidenceId } = await params
    if (!isUuid(evidenceId)) return Response.json({ error: 'Not found.' }, { status: 404 })

    const authHeader = request.headers.get('authorization')
    if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const token = authHeader.replace('Bearer ', '')

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    // Deciding where owner-authored content appears is customising the
    // profile, the same as every other write route here.
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
      .from('profile_evidence')
      .select('id')
      .eq('id', evidenceId)
      .eq('profile_id', profile.id)
      .is('deleted_at', null)
      .maybeSingle()
    if (!item) return Response.json({ error: 'Not found.' }, { status: 404 })

    // Only read for 'selected'. An item on all directions is on them by
    // saying so, and a list alongside that would be a second answer.
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

    // The rows first. A scope written before them would, for the moment
    // between the two writes, describe an arrangement that is not there yet;
    // this order leaves the item on more directions than it should be for
    // that moment rather than fewer, which is the harmless half of the race.
    await evidencePlacements.setDirections(supabase, profile.id, evidenceId, scope, lensIds)

    const { error: scopeError } = await supabase
      .from('profile_evidence')
      .update({ placement_scope: scope, updated_at: new Date().toISOString() })
      .eq('id', evidenceId)
      .eq('profile_id', profile.id)

    if (scopeError) {
      console.error('[evidence/directions] Scope write failed:', scopeError)
      return Response.json({ error: 'SAVE_FAILED' }, { status: 500 })
    }

    return Response.json({ ok: true, placement_scope: scope, lens_ids: lensIds })

  } catch (error) {
    return apiError(error, "We couldn't save where that appears. Please try again.")
  }
}
