import { createClient } from '@supabase/supabase-js'
import { requireCustomise } from '../../_lib/requireCustomise'

// ============================================================================
// PATCH /api/career-profile/lens/reorder
//
// The order the owner's directions are read in. The first one is the primary:
// it is what a visitor lands on, and it is the one this route will not let
// them take off the page.
//
// Body: { order: [lensId, ...] }  - every active direction, in the new order.
//
// WHOSE DIRECTIONS THESE ARE
// The token's. Every id in the body is checked against the profile the token
// resolves to before anything is written, the same way the placements route
// checks a lens id. An id that is not theirs is a 404 for the whole request
// rather than a row quietly skipped.
//
// WHY THE WHOLE ORDER AND NOT A MOVE
// A drag is a new arrangement, not an increment, and sending the arrangement
// is the only version of this that is idempotent. Two drags racing each other
// then settle on whichever arrived last instead of composing into an order
// neither person chose.
//
// WHAT PRIMARY IS, AND WHY THIS ROUTE HAS TO KNOW
// `source: 'user'` at `sort_order: 0`. Eight places read that pair - the
// visibility route, the Resume Writer hub, resumeLabel, ensurePrimaryLens and
// three maintenance scripts - and one of them is dangerous if it is broken:
// ensurePrimaryLens looks the primary up by exactly that pair and INSERTS a
// new one when it finds nothing. A reorder that left no row matching both
// would grow a duplicate primary on the account's next coaching run.
//
// So the invariant this route maintains is: exactly one row at sort_order 0,
// and that row carries source 'user'. The new first direction is granted
// 'user'; the direction it displaced keeps whatever it had. Nothing is ever
// revoked, because the pair is a conjunction - a demoted row with source
// 'user' and sort_order 3 is not the primary and does not read as one.
//
// The one consequence worth knowing: `source` is also how the dismiss and
// rename routes decide what they may touch, and both require
// 'coaching_extraction'. A direction that has been primary can no longer be
// dismissed or renamed from the hub. That is the right answer for a direction
// somebody chose to lead with, and it is a real change to those two routes'
// reach, so it is written down here rather than discovered.
//
// ONE ORDER, TWO PAGES
// sort_order is also the Resume Writer hub's tile ranking. Dragging here
// reorders the tiles there, deliberately: the two pages are showing the same
// directions and disagreeing about their order would be the bug.
// ============================================================================

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// What the public page renders, and so the most this can ever be asked to
// arrange. The same number the visibility route enforces.
const MAX_ACTIVE = 3
const VISIBLE = 'active'

const RETURNED = 'id, name, slug, status, sort_order, source, core_resume_id, updated_at'

export async function PATCH(request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data: { user }, error: authError } =
      await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    // Which direction a visitor lands on is a decision about the profile.
    // lens/[lensId]/visibility has always asked this; reordering did not.
    const gate = await requireCustomise(user.id)
    if (gate) return gate

    let body
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'Invalid request.' }, { status: 400 })
    }

    const order = body?.order
    if (!Array.isArray(order) || order.length === 0 || order.length > MAX_ACTIVE) {
      return Response.json({ error: 'Invalid request.', code: 'INVALID' }, { status: 400 })
    }
    if (!order.every(id => typeof id === 'string' && UUID.test(id))) {
      return Response.json({ error: 'Invalid request.', code: 'INVALID' }, { status: 400 })
    }
    if (new Set(order).size !== order.length) {
      return Response.json({ error: 'Invalid request.', code: 'INVALID' }, { status: 400 })
    }

    // Every direction they have, so the arrangement can be checked against
    // what is actually on the page and the rows that are not moving can keep
    // their ranks out of the way of the ones that are.
    const { data: lenses, error: lensError } = await supabase
      .from('profile_lenses')
      .select('id, status, source, sort_order')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })

    if (lensError) {
      console.error('[career-profile] Lens reorder lookup failed:', lensError)
      return Response.json({ error: "We couldn't save that. Please try again." }, { status: 500 })
    }

    const mine = new Map((lenses || []).map(l => [l.id, l]))
    if (!order.every(id => mine.has(id))) {
      // A direction that is not theirs answers the way one that does not
      // exist does.
      return Response.json({ error: 'Not found.' }, { status: 404 })
    }

    // The arrangement has to be of the active directions, all of them. A
    // partial order would leave the rows it omitted holding ranks that
    // collide with the ones it set, and the page would settle on an order
    // nobody asked for.
    const active = (lenses || []).filter(l => l.status === VISIBLE).map(l => l.id)
    const sameSet =
      active.length === order.length && active.every(id => order.includes(id))
    if (!sameSet) {
      return Response.json(
        {
          error: 'Your career directions changed while you were arranging them. Reopen settings and try again.',
          code: 'STALE_ORDER'
        },
        { status: 409 }
      )
    }

    const now = new Date().toISOString()

    // The active ones take 0..n-1 in the order given. Everything else is
    // pushed out behind them, keeping the order it already had, so no
    // inactive row is left sitting on a rank an active one now needs.
    const rest = (lenses || [])
      .filter(l => l.status !== VISIBLE)
      .map(l => l.id)

    const writes = [
      ...order.map((id, index) => ({ id, sort_order: index })),
      ...rest.map((id, index) => ({ id, sort_order: order.length + index })),
    ]

    for (const { id, sort_order } of writes) {
      const current = mine.get(id)
      // The first direction is the primary and carries the marker. Granted,
      // never revoked: see the note at the top.
      const wantsUser = sort_order === 0
      const patch = { sort_order, updated_at: now }
      if (wantsUser && current.source !== 'user') patch.source = 'user'
      if (current.sort_order === sort_order && !patch.source) continue

      const { error: writeError } = await supabase
        .from('profile_lenses')
        .update(patch)
        .eq('id', id)
        .eq('user_id', user.id)

      if (writeError) {
        // Partway through is survivable and self-correcting: the ranks that
        // did land are still a valid order, the page reloads from the table,
        // and the next drag rewrites all of them.
        console.error('[career-profile] Lens reorder write failed:', writeError)
        return Response.json(
          { error: "We couldn't save that order. Please try again." },
          { status: 500 }
        )
      }
    }

    const { data: updated, error: readError } = await supabase
      .from('profile_lenses')
      .select(RETURNED)
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })

    if (readError) {
      console.error('[career-profile] Lens reorder read-back failed:', readError)
      return Response.json({ error: "We couldn't save that. Please try again." }, { status: 500 })
    }

    return Response.json({ lenses: updated || [] })
  } catch (error) {
    console.error('[career-profile] Lens reorder failed:', error)
    return Response.json({ error: "We couldn't save that. Please try again." }, { status: 500 })
  }
}
