import { createClient } from '@supabase/supabase-js'
import { requireCustomise } from '../../../_lib/requireCustomise'

// ============================================================================
// PATCH /api/career-profile/lens/[lensId]/visibility
//
// Which of somebody's directions their public profile shows. Its own route
// rather than another field on the lens PATCH beside it, because this is not
// the same kind of write: that one saves words the owner typed into a field,
// this one publishes and unpublishes a section of a page other people read.
//
// Body: { visible: boolean }
//
//   visible: true   'suggested' or 'hidden'  ->  'active'
//   visible: false  'active'                 ->  'hidden'
//
// HIDING KEEPS EVERYTHING
// 'hidden' takes the direction off the profile and changes nothing else. The
// headline, the bio, the proof points, the skill emphasis and the proof rows
// underneath them all stay exactly as they were, so putting it back is one
// toggle and not a regeneration. Deleting a direction is a different act with a
// different control, and this is not it.
//
// THE PRIMARY CANNOT BE HIDDEN
// A profile with no direction is not a profile. The primary is the one the
// whole page is written around, so it is refused here rather than merely
// un-offered in the interface - the interface hides the toggle, and hiding a
// control stops somebody clicking it and stops nobody at all from sending what
// the control would have sent.
//
// WHY SHOWING IS GATED AND HIDING IS NOT
// requireCustomise's own rule, followed here rather than restated: a lapsed
// account can always take something down, what it cannot do is put something
// new up. Gating the way out would leave a direction published on somebody's
// page behind a paywall, which is the one outcome the gate exists to prevent.
// So activation asks the gate and hiding does not.
// ============================================================================

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// What the profile reads, and what it does not. Kept next to the two writes
// below so the three cannot drift apart.
const VISIBLE = 'active'
const HIDDEN = 'hidden'

// source 'user' with sort_order 0 is the pair ensurePrimaryLens uses as the
// primary's identity, so this asks the same question the writer answers.
function isPrimary(lens) {
  return lens?.source === 'user' && lens?.sort_order === 0
}

const RETURNED = 'id, name, slug, status, sort_order, source, core_resume_id, updated_at'

export async function PATCH(request, { params }) {
  try {
    const { lensId } = await params
    if (!lensId || !UUID.test(lensId)) return Response.json({ error: 'Not found.' }, { status: 404 })

    const authHeader = request.headers.get('authorization')
    if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data: { user }, error: authError } =
      await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    let body
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'Invalid request.' }, { status: 400 })
    }
    if (typeof body?.visible !== 'boolean') {
      return Response.json({ error: 'Invalid request.', code: 'INVALID' }, { status: 400 })
    }
    const visible = body.visible

    // The id and the owner together. Either alone would be wrong: the id alone
    // writes to whoever's lens was named, and the owner alone has no lens.
    const { data: lens, error: lensError } = await supabase
      .from('profile_lenses')
      .select('id, name, status, source, sort_order')
      .eq('id', lensId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (lensError) {
      console.error('[career-profile] Lens visibility lookup failed:', lensError)
      return Response.json({ error: "We couldn't save that. Please try again." }, { status: 500 })
    }
    // A lens that is not theirs answers the way one that does not exist does.
    if (!lens) return Response.json({ error: 'Not found.' }, { status: 404 })

    if (!visible && isPrimary(lens)) {
      return Response.json(
        {
          error: 'Your main direction stays on your profile. Choose a different one first.',
          code: 'PRIMARY_LENS'
        },
        { status: 400 }
      )
    }

    // A direction the owner dismissed is not hidden, it is put away, and
    // turning it back on is a different decision than un-hiding one. Refused
    // rather than quietly promoted, so nothing reappears that somebody
    // deliberately got rid of.
    if (lens.status === 'dismissed') {
      return Response.json(
        { error: 'That direction was dismissed. Restore it from your suggestions first.', code: 'DISMISSED' },
        { status: 400 }
      )
    }

    if (visible) {
      const gate = await requireCustomise(user.id, supabase)
      if (gate) return gate
    }

    const next = visible ? VISIBLE : HIDDEN
    if (lens.status === next) {
      // Already where it was asked to be. Not an error: two clicks in quick
      // succession, or two tabs, should settle rather than fail.
      return Response.json({ lens: { ...lens, status: next }, unchanged: true })
    }

    const { data: updated, error: updateError } = await supabase
      .from('profile_lenses')
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq('id', lens.id)
      .eq('user_id', user.id)
      .select(RETURNED)
      .single()

    if (updateError || !updated) {
      // 23514 here means scripts/add-hidden-lens-status.sql has not been run:
      // the column still refuses 'hidden'. Named in the log because the owner's
      // message cannot say it and the symptom is otherwise a toggle that will
      // not stay down.
      if (updateError?.code === '23514') {
        console.error(
          '[career-profile] profile_lenses.status refused a value. ' +
          'Has scripts/add-hidden-lens-status.sql been run?', updateError
        )
      } else {
        console.error('[career-profile] Lens visibility write failed:', updateError)
      }
      return Response.json({ error: "We couldn't save that. Please try again." }, { status: 500 })
    }

    return Response.json({ lens: updated })
  } catch (error) {
    console.error('[career-profile] Lens visibility failed:', error)
    return Response.json({ error: "We couldn't save that. Please try again." }, { status: 500 })
  }
}
