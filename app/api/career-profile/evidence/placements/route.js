import { createClient } from '@supabase/supabase-js'
import { evidencePlacements } from '../../_lib/placements'
import { requireCustomise } from '../../_lib/requireCustomise'

// ============================================================================
// POST /api/career-profile/evidence/placements
//
// Where a piece of evidence appears, in what order, and which one leads.
//
//   move     - put an item where another one sits, within a direction
//
// One operation. There was a second, `hide`, which stopped a direction
// rendering an item without moving or losing it. Nothing offered it: the
// control it was built for was never drawn, and the client plumbing that
// could have called it has been taken out. The `hidden` column stays, and
// move still carries hidden rows along rather than renumbering around them,
// so a row written by an older build keeps its place and its state.
//
// WHAT LEADS A DIRECTION IS NOT ONE OF THESE EITHER
// It used to be: a `feature` op set a per-direction flag and the section
// pulled that item to the front. Two things then decided what came first, and
// the Manage list only showed one of them - so the list could read top to
// bottom in an order the public page did not use, and reordering the real
// first item changed nothing anyone could see. The lead is now simply the
// first item in the direction's order, which is the thing the owner is
// already arranging. The column and set_featured_placement are still in the
// database; nothing here reads or writes either.
//
// WHICH DIRECTIONS AN ITEM IS ON IS NOT ONE OF THESE
// That is the item's own placement_scope, and it is set through
// PUT /api/career-profile/evidence/[evidenceId]/directions, which writes the
// scope and the rows together. There used to be an `assign` op here that
// added or removed a single row; it had no UI, and it could not express
// "all directions" at all, so it is gone rather than left as a second way to
// say a thing that now has one.
//
// EDITING A DIRECTION THAT HAS NO ROWS OF ITS OWN
// An unarranged direction has no rows, because the items on it are there by
// scope. There is nothing for a per-direction edit to change, so move writes
// rows for everything then on it first - see the note in _lib/placements.
//
// WHY MOVE TAKES TWO IDS AND NOT A DIRECTION AND A DISTANCE
// It used to be `reorder`, taking `by: 1 | -1`, and a drag sent one call per
// row it had crossed on screen. That only works if the list on screen is the
// list being written, and it is not: Portfolio and Evidence are two filtered
// views of ONE placement list per direction, so a step in the panel is not a
// step in the table. Dragging past a row the panel does not show moved the
// item behind something invisible and the panel came back looking identical -
// the drag appeared to do nothing, while the database had in fact changed.
// Measured on a real profile, two of fourteen single-row drags in the
// portfolio panel were silent no-ops and a drag to the top landed four places
// short.
//
// So the client now says where the item should end up, by naming the item
// already sitting there, and the position is resolved here against the whole
// list - the only place the whole list is known. The moved row takes the
// target's index and everything between it shifts by one, which is what a
// drop onto a row means.
//
// WHOSE PLACEMENTS THESE ARE
// The token's. Every id in the body is checked against the profile the token
// resolves to before anything is written. The composite foreign key would
// refuse a foreign lens anyway, but it would refuse it as a 500 after the
// other half of the work had already happened.
//
// WHY MOVE RENUMBERS EVERYTHING
// Writing only the rows between the two positions is fewer writes and leaves
// the sequence full of holes and ties over time, and a tie means two items
// whose order depends on whatever the database felt like returning.
// Renumbering the direction 0..n-1 on every move keeps the sequence something
// the next move can reason about.
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
// here. `lensId` may be null, which means the shared layer, which is a real
// place an item can sit.
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
    // This edit is about one direction. There is no layer left for a missing
    // lens_id to mean.
    const lensId = body?.lens_id
    if (!isUuid(lensId)) {
      return Response.json({ error: 'Invalid request.', code: 'INVALID' }, { status: 400 })
    }
    const evidenceId = body?.evidence_id === undefined ? null : body.evidence_id

    const wrong = await belongsHere(supabase, profile, evidenceId, lensId)
    if (wrong) return Response.json({ error: wrong }, { status: 404 })

    // ---- MOVE ----
    if (op === 'move') {
      if (!evidenceId) return Response.json({ error: 'Not found.' }, { status: 404 })
      const targetId = body?.target_id
      if (!isUuid(targetId)) {
        return Response.json({ error: 'Invalid request.', code: 'INVALID' }, { status: 400 })
      }

      const wrongTarget = await belongsHere(supabase, profile, targetId, null)
      if (wrongTarget) return Response.json({ error: wrongTarget }, { status: 404 })

      // A direction with no list of its own gets one before it is reordered,
      // or there is nothing here to move and the control does nothing.
      const rows = await evidencePlacements.materialise(supabase, profile.id, lensId)
      const from = rows.findIndex(r => r.evidence_id === evidenceId)
      const to = rows.findIndex(r => r.evidence_id === targetId)
      if (from === -1 || to === -1) return Response.json({ error: 'Not found.' }, { status: 404 })

      // Dropped onto itself is not an error. It is the gesture a reader makes
      // when they change their mind mid-drag, and the answer is the list
      // unchanged.
      if (from !== to) {
        const moved = [...rows]
        const [row] = moved.splice(from, 1)
        moved.splice(to, 0, row)
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
