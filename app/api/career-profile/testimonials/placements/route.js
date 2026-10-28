import { createClient } from '@supabase/supabase-js'
import { isUuid, testimonialPlacements } from '../../_lib/placements'
import { requireCustomise } from '../../_lib/requireCustomise'

// ============================================================================
// POST /api/career-profile/testimonials/placements
//
// Which testimonials a direction shows, and in what order.
//
// The evidence placements route with the lead taken out. A collection of
// quotations has no item that leads it, so there is no feature operation here
// and no featured column behind one.
//
//   move     - put a testimonial where another one sits, within a direction
//
// One operation. There was a second, `hide`, which stopped a direction
// showing a testimonial without moving it. Nothing offered it and nothing
// calls it any more. The `hidden` column stays and is still read, so a row
// written by an older build keeps its state.
//
// THERE IS NO DELETE AND NO ASSIGN-OFF
// A testimonial is somebody else's words about this person, given once, on
// request. Nothing in this product removes one, and this route is not the
// exception.
//
// WHOSE TESTIMONIALS THESE ARE
// The token's. Every id in the body is checked against the profile the token
// resolves to before anything is written. The composite foreign key would
// refuse a foreign direction anyway, but it would refuse it as a 500 after
// the other half of the work had already happened.
//
// EDITING A DIRECTION THAT HAS NO LIST OF ITS OWN
// A direction with no placements falls back to the shared layer, so there is
// no row for a per-direction edit to change. Both operations copy the shared
// list into the direction first - see the note in _lib/placements.
//
// WHAT THIS ORDER MEANS NEXT TO THE GENERATED ONE
// profile_collective_impacts.testimonial_order is a ranking the model writes
// when it synthesises a direction's collective impact. It is a suggestion
// about relevance, made without being asked. An order written here is the
// owner saying what they want read first, and the public route prefers it:
// generated order is the fallback for a direction nobody has arranged.
// ============================================================================

async function context(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return { error: Response.json({ error: 'Unauthorized' }, { status: 401 }) }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
  const { data: { user }, error } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (error || !user) return { error: Response.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { data: profile } = await supabase
    .from('career_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!profile) return { error: Response.json({ error: 'Not found.' }, { status: 404 }) }

  return { supabase, user, profile }
}

// A testimonial id and a lens id are only usable once they are known to
// belong here. `lensId` may be null, which means the shared layer.
async function belongsHere(supabase, profile, testimonialId, lensId) {
  if (testimonialId !== null) {
    if (!isUuid(testimonialId)) return 'Not found.'
    const { data: item } = await supabase
      .from('profile_testimonials')
      .select('id')
      .eq('id', testimonialId)
      .eq('profile_id', profile.id)
      .maybeSingle()
    if (!item) return 'Not found.'
  }

  if (lensId !== null && lensId !== undefined) {
    if (!isUuid(lensId)) return 'Not found.'
    const { data: lens } = await supabase
      .from('profile_lenses')
      .select('id')
      .eq('id', lensId)
      .eq('profile_id', profile.id)
      .maybeSingle()
    if (!lens) return 'Not found.'
  }

  return null
}

// What the page has been showing, so materialising a direction's list does
// not reshuffle the section.
//
// Until a direction has a list of its own, the reader sees every testimonial
// in the order the collective-impact synthesis ranked them. There is one
// synthesis - the profile-wide row, with no direction on it - and it is what
// every direction renders, so it is the only order worth copying in. Rows per
// direction were written for a while and are no longer; asking for one would
// be reading a leftover.
//
// No synthesis at all returns null, and the shared layer's own newest-first
// order stands - there is nothing better to know.
async function synthesisOrder(supabase, profileId) {
  const { data, error } = await supabase
    .from('profile_collective_impacts')
    .select('testimonial_order')
    .eq('profile_id', profileId)
    .is('lens_id', null)
    .maybeSingle()

  if (error) {
    console.error('[career-profile] Synthesis order lookup failed (non-fatal):', error)
    return null
  }

  const order = data?.testimonial_order
  return Array.isArray(order) && order.length ? order : null
}

export async function POST(request) {
  try {
    const ctx = await context(request)
    if (ctx.error) return ctx.error
    const { supabase, user, profile } = ctx

    // Putting owner-authored content on the profile is customising it, and
    // the rule is the same one every other write route here follows.
    const gate = await requireCustomise(user.id)
    if (gate) return gate

    let body
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'Invalid request.' }, { status: 400 })
    }

    const op = body?.op
    // This edit is about one direction. There is no shared layer left for a
    // missing lens_id to mean.
    const lensId = body?.lens_id
    if (!isUuid(lensId)) {
      return Response.json({ error: 'Invalid request.', code: 'INVALID' }, { status: 400 })
    }
    const testimonialId = body?.testimonial_id === undefined ? null : body.testimonial_id

    const wrong = await belongsHere(supabase, profile, testimonialId, lensId)
    if (wrong) return Response.json({ error: wrong }, { status: 404 })

    // ---- MOVE ----
    if (op === 'move') {
      if (!testimonialId) return Response.json({ error: 'Not found.' }, { status: 404 })
      const targetId = body?.target_id
      if (!isUuid(targetId)) {
        return Response.json({ error: 'Invalid request.', code: 'INVALID' }, { status: 400 })
      }

      const wrongTarget = await belongsHere(supabase, profile, targetId, null)
      if (wrongTarget) return Response.json({ error: wrongTarget }, { status: 404 })

      const rows = await testimonialPlacements.materialise(
        supabase, profile.id, lensId, await synthesisOrder(supabase, profile.id)
      )
      const from = rows.findIndex(r => r.testimonial_id === testimonialId)
      const to = rows.findIndex(r => r.testimonial_id === targetId)
      if (from === -1 || to === -1) return Response.json({ error: 'Not found.' }, { status: 404 })

      // Dropped onto itself is not an error. It is the gesture a reader makes
      // when they change their mind mid-drag, and the answer is the list
      // unchanged.
      if (from !== to) {
        const moved = [...rows]
        const [row] = moved.splice(from, 1)
        moved.splice(to, 0, row)
        await testimonialPlacements.renumber(supabase, moved)
      }

      return Response.json({
        placements: await testimonialPlacements.listFor(supabase, profile.id, lensId)
      })
    }

    return Response.json({ error: 'Invalid request.', code: 'BAD_OP' }, { status: 400 })
  } catch (error) {
    console.error('[career-profile] Testimonial placement write failed:', error)
    return Response.json({ error: "We couldn't save that. Please try again." }, { status: 500 })
  }
}
