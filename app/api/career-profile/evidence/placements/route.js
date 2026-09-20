import { createClient } from '@supabase/supabase-js'
import { evidencePlacements } from '../../_lib/placements'

// ============================================================================
// POST /api/career-profile/evidence/placements
//
// Where a piece of evidence appears, in what order, and which one leads.
//
// Three operations on one route because they are three edits to one table and
// they constrain each other: unassigning the item that leads a direction has
// to take the star with it, and reordering has to leave a sequence the next
// reorder can still read.
//
//   assign   - put an item in a direction, or take it out
//   hide     - stop a direction showing an item, without moving or losing it
//   feature  - decide which item leads a direction, or that none does
//   reorder  - move an item up or down within a direction
//
// HIDE IS NOT ASSIGN-OFF
// assign-off deletes the placement: the item leaves the direction, its
// position is renumbered away and its lead status goes with it. That is the
// right write for "this does not belong here" and the wrong one for "not on
// this direction just now", which is what the management modal asks for. hide
// leaves the row where it is and stops it rendering, so restoring puts the
// item back in its old place rather than at the end.
//
// EDITING A DIRECTION THAT HAS NO LIST OF ITS OWN
// A direction with no placements falls back to the shared layer, so there is
// no row for a per-direction edit to change. hide and reorder therefore copy
// the shared list into the direction first - see the note in _lib/placements.
//
// WHOSE PLACEMENTS THESE ARE
// The token's. Every id in the body is checked against the profile the token
// resolves to before anything is written. The composite foreign key would
// refuse a foreign lens anyway, but it would refuse it as a 500 after the
// other half of the work had already happened.
//
// WHY FEATURE GOES THROUGH A DATABASE FUNCTION
// One featured item per direction is a unique index, not a flag - I confirmed
// it by inserting the second one and being refused. So moving the star is
// "clear the old, set the new", and as two PostgREST calls those are two
// transactions: a failure between them leaves a direction with no featured
// item at all. set_featured_placement does both inside one, so it is both or
// neither.
//
// WHY REORDER RENUMBERS EVERYTHING
// Swapping two rows is fewer writes and leaves the sequence full of holes and
// ties over time, and a tie means two items whose order depends on whatever
// the database felt like returning. Renumbering the direction 0..n-1 on every
// move keeps the sequence something the next move can reason about.
// ============================================================================

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const isUuid = (value) => typeof value === 'string' && UUID.test(value)

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

// An evidence id and a lens id are only usable once they are known to belong
// here. `lensId` may be null, which means the shared layer - a real place an
// item can sit, with its own featured index.
async function belongsHere(supabase, profile, evidenceId, lensId) {
  if (evidenceId !== null) {
    if (!isUuid(evidenceId)) return 'Not found.'
    const { data: item } = await supabase
      .from('profile_evidence')
      .select('id')
      .eq('id', evidenceId)
      .eq('profile_id', profile.id)
      .is('deleted_at', null)
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

// Every placement in one direction, in the order the profile reads them.
// Hidden rows included: they hold positions, and anything renumbering or
// moving within a direction has to see them.
const placementsFor = (supabase, profileId, lensId) =>
  evidencePlacements.listFor(supabase, profileId, lensId)

// 0..n-1, and only the rows whose number actually changed are written.
async function renumber(supabase, rows) {
  const writes = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row, index }) => row.sort_order !== index)
    .map(({ row, index }) => supabase
      .from('profile_evidence_placements')
      .update({ sort_order: index, updated_at: new Date().toISOString() })
      .eq('id', row.id))

  const results = await Promise.all(writes)
  const failed = results.find(r => r.error)
  if (failed) throw failed.error
}

export async function POST(request) {
  try {
    const ctx = await context(request)
    if (ctx.error) return ctx.error
    const { supabase, user, profile } = ctx

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
    const evidenceId = body?.evidence_id === undefined ? null : body.evidence_id

    const wrong = await belongsHere(supabase, profile, evidenceId, lensId)
    if (wrong) return Response.json({ error: wrong }, { status: 404 })

    // ---- ASSIGN ----
    if (op === 'assign') {
      if (!evidenceId) return Response.json({ error: 'Not found.' }, { status: 404 })
      if (typeof body?.on !== 'boolean') {
        return Response.json({ error: 'Invalid request.', code: 'INVALID' }, { status: 400 })
      }

      // Materialised for the same reason: adding one item to a direction that
      // was following the shared layer would otherwise give it a list of one
      // and silently drop everything else it had been showing.
      const rows = await evidencePlacements.materialise(supabase, profile.id, lensId)
      const existing = rows.find(r => r.evidence_id === evidenceId)

      if (body.on) {
        // Already there is success, not a duplicate-key error: the button says
        // "shown here", and it already is.
        if (!existing) {
          const { error } = await supabase
            .from('profile_evidence_placements')
            .insert({
              profile_id: profile.id,
              evidence_id: evidenceId,
              lens_id: lensId,
              sort_order: rows.length,
              featured: false
            })
          if (error) throw error
        }
      } else if (existing) {
        const { error } = await supabase
          .from('profile_evidence_placements')
          .delete()
          .eq('id', existing.id)
        if (error) throw error
        // The star goes with it. A direction whose lead has been taken out
        // does not keep pointing at something that is no longer in it.
        await renumber(supabase, rows.filter(r => r.id !== existing.id))
      }

      return Response.json({ placements: await placementsFor(supabase, profile.id, lensId) })
    }

    // ---- HIDE ----
    //
    // The row stays. Its sort_order stays, its featured flag stays, the
    // evidence record and its file and its placements in every other
    // direction stay. All that changes is whether this direction renders it.
    if (op === 'hide') {
      if (!evidenceId) return Response.json({ error: 'Not found.' }, { status: 404 })
      if (typeof body?.hidden !== 'boolean') {
        return Response.json({ error: 'Invalid request.', code: 'INVALID' }, { status: 400 })
      }

      const rows = await evidencePlacements.materialise(supabase, profile.id, lensId)
      const existing = rows.find(r => r.evidence_id === evidenceId)
      // Nothing to hide is not an error the owner can act on: the item is
      // already not in this direction, which is what they asked for.
      if (!existing) {
        return Response.json({ placements: rows })
      }
      if (existing.hidden === body.hidden) {
        return Response.json({ placements: rows, unchanged: true })
      }

      const { error } = await supabase
        .from('profile_evidence_placements')
        .update({ hidden: body.hidden, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
      if (error) throw error

      return Response.json({ placements: await placementsFor(supabase, profile.id, lensId) })
    }

    // ---- FEATURE ----
    if (op === 'feature') {
      // Null is a real argument here: it means this direction has no lead.
      const { error } = await supabase.rpc('set_featured_placement', {
        p_user_id: user.id,
        p_lens_id: lensId,
        p_evidence_id: evidenceId
      })
      if (error) {
        // The function raises for a lens or a placement that is not this
        // user's. Those are the same answer as anything else not found.
        const message = String(error.message || '')
        if (/LENS_NOT_FOUND|PLACEMENT_NOT_FOUND|NO_PROFILE/.test(message)) {
          return Response.json({ error: 'Not found.' }, { status: 404 })
        }
        throw error
      }
      return Response.json({ placements: await placementsFor(supabase, profile.id, lensId) })
    }

    // ---- REORDER ----
    if (op === 'reorder') {
      if (!evidenceId) return Response.json({ error: 'Not found.' }, { status: 404 })
      const by = body?.by
      if (by !== -1 && by !== 1) {
        return Response.json({ error: 'Invalid request.', code: 'INVALID' }, { status: 400 })
      }

      // A direction with no list of its own gets one before it is reordered,
      // or there is nothing here to move and the control does nothing.
      const rows = await evidencePlacements.materialise(supabase, profile.id, lensId)
      const from = rows.findIndex(r => r.evidence_id === evidenceId)
      if (from === -1) return Response.json({ error: 'Not found.' }, { status: 404 })

      const to = from + by
      // Already at the end is not an error. The button is disabled there, and
      // a keyboard or a retry reaching it anyway should do nothing rather than
      // fail.
      if (to >= 0 && to < rows.length) {
        const moved = [...rows]
        ;[moved[from], moved[to]] = [moved[to], moved[from]]
        await renumber(supabase, moved)
      }

      return Response.json({ placements: await placementsFor(supabase, profile.id, lensId) })
    }

    return Response.json({ error: 'Invalid request.', code: 'BAD_OP' }, { status: 400 })
  } catch (error) {
    console.error('[career-profile] Placements route failed:', error)
    return Response.json({ error: "We couldn't save that. Please try again." }, { status: 500 })
  }
}
