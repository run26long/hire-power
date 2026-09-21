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
//   hide     - stop a direction showing a testimonial, without moving it
//   reorder  - move a testimonial up or down within a direction
//
// THERE IS NO DELETE AND NO ASSIGN-OFF
// A testimonial is somebody else's words about this person, given once, on
// request. Nothing in this product removes one, and this route is not the
// exception: the only way a testimonial leaves a direction is `hidden`, which
// leaves the row, the position, the words, the referee and the consent
// exactly where they are.
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

// What the page has been showing this direction, so materialising it does not
// reshuffle the section.
//
// Until a direction has a list of its own, the reader sees every testimonial
// in the order the collective-impact synthesis ranked them for that
// direction. The shared layer's own order is newest-first and nobody has ever
// read it. Copying that in would reorder the page the first time somebody hid
// one thing, which is the opposite of what hiding one thing should do.
//
// A direction with no synthesis of its own falls back to the profile's shared
// one, the same way the page does. No synthesis at all returns null, and the
// shared layer's order stands - there is nothing better to know.
async function synthesisOrder(supabase, profileId, lensId) {
  const { data, error } = await supabase
    .from('profile_collective_impacts')
    .select('lens_id, testimonial_order')
    .eq('profile_id', profileId)

  if (error) {
    console.error('[career-profile] Synthesis order lookup failed (non-fatal):', error)
    return null
  }

  const rows = data || []
  const own = lensId === null ? null : rows.find(r => r.lens_id === lensId)
  const shared = rows.find(r => r.lens_id === null)
  const order = (own || shared)?.testimonial_order
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
    // `lens_id` absent and `lens_id: null` both mean the shared layer, and are
    // the same thing rather than two different silences.
    const lensId = body?.lens_id === undefined ? null : body.lens_id
    const testimonialId = body?.testimonial_id === undefined ? null : body.testimonial_id

    const wrong = await belongsHere(supabase, profile, testimonialId, lensId)
    if (wrong) return Response.json({ error: wrong }, { status: 404 })

    // ---- HIDE ----
    if (op === 'hide') {
      if (!testimonialId) return Response.json({ error: 'Not found.' }, { status: 404 })
      if (typeof body?.hidden !== 'boolean') {
        return Response.json({ error: 'Invalid request.', code: 'INVALID' }, { status: 400 })
      }

      const rows = await testimonialPlacements.materialise(
        supabase, profile.id, lensId, await synthesisOrder(supabase, profile.id, lensId)
      )
      const existing = rows.find(r => r.testimonial_id === testimonialId)
      // Nothing to hide is not an error the owner can act on: it is already
      // not in this direction, which is what they asked for.
      if (!existing) return Response.json({ placements: rows })
      if (existing.hidden === body.hidden) {
        return Response.json({ placements: rows, unchanged: true })
      }

      const { error } = await supabase
        .from('profile_testimonial_placements')
        .update({ hidden: body.hidden, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
      if (error) throw error

      return Response.json({
        placements: await testimonialPlacements.listFor(supabase, profile.id, lensId)
      })
    }

    // ---- REORDER ----
    if (op === 'reorder') {
      if (!testimonialId) return Response.json({ error: 'Not found.' }, { status: 404 })
      const by = body?.by
      if (by !== -1 && by !== 1) {
        return Response.json({ error: 'Invalid request.', code: 'INVALID' }, { status: 400 })
      }

      const rows = await testimonialPlacements.materialise(
        supabase, profile.id, lensId, await synthesisOrder(supabase, profile.id, lensId)
      )
      const from = rows.findIndex(r => r.testimonial_id === testimonialId)
      if (from === -1) return Response.json({ error: 'Not found.' }, { status: 404 })

      const to = from + by
      // Already at the end is not an error. The button is disabled there, and
      // a keyboard or a retry reaching it anyway should do nothing rather
      // than fail.
      if (to >= 0 && to < rows.length) {
        const moved = [...rows]
        ;[moved[from], moved[to]] = [moved[to], moved[from]]
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
