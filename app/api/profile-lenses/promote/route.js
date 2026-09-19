import { createClient } from '@supabase/supabase-js'
import { apiError } from '@/lib/apiError'

// ============================================================================
// POST /api/profile-lenses/promote
// Brings one direction out of the hub's "Additional suggestions" menu and into
// a tile.
//
// Request body: { lensId: string, displacedLensId?: string }
//
// WHY THIS REPLACED ./restore
// The menu holds two kinds of direction that look identical in it and are not
// identical underneath: ones the user dismissed, and ones that simply did not
// make the top three. ./restore could only handle the first. It moved a lens
// from 'dismissed' back to 'suggested', which is the right write for a
// dismissed direction and a no-op for an overflowing one - and even for the
// dismissed one it only made the direction eligible for a tile, without
// putting it in one. With three slots full, un-dismissing something changes
// nothing anybody can see.
//
// So the menu needs a single action that means "show me this one", and this is
// it: it un-dismisses if there is anything to un-dismiss, and it moves the rank
// if a slot has to be taken.
//
// HOW A SLOT IS TAKEN
// The hub gives tiles to the highest-ranked directions and lists the rest in
// the menu. Swapping two ranks therefore swaps two places in the row: the
// chosen direction takes the tile, and the one it displaced drops into the
// menu, still 'suggested', still everything it was. Nothing is dismissed to
// make room, so the displacement costs the displaced direction nothing.
//
// The caller names the direction being displaced because the caller is the
// thing drawing the tiles and already knows which one sits last. What it may
// name is checked here and not taken on trust: a direction of theirs, with no
// core resume, that is not the primary. Sending a locked tile or somebody
// else's row moves nothing.
//
// WHEN NOTHING IS DISPLACED
// A free slot needs no swap - un-dismissing is enough, and the direction
// appears where its existing rank puts it. The caller omits displacedLensId
// and this does the smaller thing.
// ============================================================================

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const isPrimary = (lens) => lens?.source === 'user' && lens?.sort_order === 0

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const token = authHeader.replace('Bearer ', '')

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // The rows this moves belong to the token holder, never to a user id the
    // caller supplies. The service role sees every row, so this is the only
    // thing standing between a lens id and whoever guessed it.
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = user.id

    const { lensId, displacedLensId } = await request.json()
    if (!lensId || !UUID.test(lensId)) {
      return Response.json({ error: 'lensId is required' }, { status: 400 })
    }
    if (displacedLensId && !UUID.test(displacedLensId)) {
      return Response.json({ error: 'Invalid request.' }, { status: 400 })
    }
    if (displacedLensId && displacedLensId === lensId) {
      return Response.json({ error: 'Invalid request.' }, { status: 400 })
    }

    // Both rows in one read, so two round trips do not become three.
    const ids = displacedLensId ? [lensId, displacedLensId] : [lensId]
    const { data: rows, error: readError } = await supabase
      .from('profile_lenses')
      .select('id, name, status, source, sort_order, core_resume_id')
      .eq('user_id', userId)
      .in('id', ids)

    if (readError) {
      console.error('Lens promote lookup failed:', readError)
      return Response.json({ error: 'PROMOTE_FAILED' }, { status: 500 })
    }

    const lens = (rows || []).find(r => r.id === lensId)
    if (!lens) return Response.json({ error: 'LENS_NOT_FOUND' }, { status: 404 })

    // A direction with a resume behind it already has a tile. There is nothing
    // to promote it out of, and moving its rank would only shuffle the row.
    if (lens.core_resume_id) {
      return Response.json(
        { error: 'That direction already has a core resume.', code: 'HAS_CORE' },
        { status: 400 }
      )
    }

    const displaced = displacedLensId
      ? (rows || []).find(r => r.id === displacedLensId)
      : null

    if (displacedLensId) {
      // Refused rather than ignored. Silently skipping the swap would answer
      // 200 to a request that did not happen, and the menu would look like it
      // had done nothing.
      if (!displaced) return Response.json({ error: 'LENS_NOT_FOUND' }, { status: 404 })
      if (displaced.core_resume_id) {
        return Response.json(
          { error: 'A direction with a core resume cannot be moved off the row.', code: 'DISPLACED_HAS_CORE' },
          { status: 400 }
        )
      }
      if (isPrimary(displaced)) {
        return Response.json(
          { error: 'Your main direction stays on the row.', code: 'DISPLACED_PRIMARY' },
          { status: 400 }
        )
      }
    }

    const now = new Date().toISOString()

    // The chosen direction takes the displaced one's rank and stops being
    // dismissed. Both halves are needed: a dismissed direction with a good rank
    // is still dismissed, and an un-dismissed one with a rank past the third
    // slot is still in the menu.
    const { error: promoteError } = await supabase
      .from('profile_lenses')
      .update({
        status: lens.status === 'dismissed' ? 'suggested' : lens.status,
        ...(displaced ? { sort_order: displaced.sort_order } : {}),
        updated_at: now
      })
      .eq('id', lens.id)
      .eq('user_id', userId)

    if (promoteError) {
      console.error('Lens promote failed:', promoteError)
      return Response.json({ error: 'PROMOTE_FAILED' }, { status: 500 })
    }

    // Second half of the swap. If this fails the two rows share a rank, which
    // the hub breaks on created_at and renders without complaint - one of them
    // is in the menu either way. Logged rather than rolled back, because
    // undoing the first write would put the user back where they started with
    // no explanation of why their click did nothing.
    if (displaced) {
      const { error: displaceError } = await supabase
        .from('profile_lenses')
        .update({ sort_order: lens.sort_order, updated_at: now })
        .eq('id', displaced.id)
        .eq('user_id', userId)

      if (displaceError) {
        console.error('Lens displace failed (non-blocking):', displaceError)
      }
    }

    return Response.json({
      success: true,
      promoted: { id: lens.id, name: lens.name },
      displaced: displaced ? { id: displaced.id, name: displaced.name } : null
    })

  } catch (error) {
    return apiError(error, "We couldn't show that direction. Please try again.")
  }
}
