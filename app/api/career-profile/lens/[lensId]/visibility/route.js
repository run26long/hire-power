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
//
// A DIRECTION WITH A RESUME BEHIND IT CANNOT BE HIDDEN
// Building a core resume for a direction is the strongest statement anybody
// makes about it, and it is made on the other page. The two pages share this
// table, so a direction with a core stays on the profile until the core is
// deleted from the Resume Writer - that deletion is the control, and this
// route is not it.
//
// The pointer alone is not enough to lock a row. A core that has been archived
// still leaves its id on the lens, and trusting the id would lock a direction
// to a resume that no longer exists, with the only way out on a page that no
// longer lists it. So the resume is read, and only a live one locks.
//
// THREE AT A TIME
// The page renders three directions and the public route already slices to
// three. Without a limit here a fourth could be turned on, be written into the
// payload, and then simply not appear - a switch that goes on and does
// nothing. Refused with a reason instead.
// ============================================================================

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// What the profile reads, and what it does not. Kept next to the two writes
// below so the three cannot drift apart.
const VISIBLE = 'active'
const HIDDEN = 'hidden'

// What the public page renders, and so what this will let anybody turn on.
// The same number the public route slices to; they are the same rule read
// from two ends.
const MAX_ACTIVE = 3

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
      .select('id, name, status, source, sort_order, core_resume_id')
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

    // A direction somebody built a resume for. Read rather than inferred from
    // the pointer: a lens whose core was archived keeps the id, and locking on
    // the id alone would strand the row - the resume it names is no longer on
    // the Resume Writer page, so the one control that could unlock it is gone.
    // Deleting a core releases the lens, and a pointer that outlives its
    // resume is a bug to be survived here rather than obeyed.
    if (!visible && lens.core_resume_id) {
      const { data: core, error: coreError } = await supabase
        .from('resumes')
        .select('id')
        .eq('id', lens.core_resume_id)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()

      if (coreError) {
        console.error('[career-profile] Lens core lookup failed:', coreError)
        return Response.json({ error: "We couldn't save that. Please try again." }, { status: 500 })
      }
      if (core) {
        return Response.json(
          {
            error: 'This direction has a core resume. Delete it from your Resume Writer to take the direction off your Career Profile.',
            code: 'LOCKED_CORE'
          },
          { status: 400 }
        )
      }
    }

    // Counted excluding this one, so re-activating something already active
    // cannot refuse itself, and so the count is of what would be on the page
    // afterwards rather than before.
    if (visible && lens.status !== VISIBLE) {
      const { count, error: countError } = await supabase
        .from('profile_lenses')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', VISIBLE)
        .neq('id', lens.id)

      if (countError) {
        console.error('[career-profile] Active lens count failed:', countError)
        return Response.json({ error: "We couldn't save that. Please try again." }, { status: 500 })
      }
      if ((count ?? 0) >= MAX_ACTIVE) {
        return Response.json(
          {
            error: `Your Career Profile shows ${MAX_ACTIVE} directions at a time. Turn one off to add this one.`,
            code: 'LENS_LIMIT'
          },
          { status: 400 }
        )
      }
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
