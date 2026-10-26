import { createClient } from '@supabase/supabase-js'
import { apiError } from '@/lib/apiError'

// ============================================================================
// /api/profile-lenses/delete
//
// GET  ?lensId=...   what deleting it would leave behind
// POST { lensId }    delete it
//
// Removes one career direction the owner named themselves. Not a suggestion,
// not the primary, not one with a resume behind it, and not one that is
// currently on the profile.
//
// WHY THIS IS A DELETE AND ./dismiss IS NOT
// A suggestion is something the model proposed, and dismissing it has to be
// remembered or the next evaluation proposes it again. There is nothing to
// remember about a direction somebody typed and then changed their mind
// about: nothing will ever suggest it back, so there is nothing for a
// tombstone to prevent. ./dismiss refuses user_created rows for exactly this
// reason, and this route is the other half of that sentence.
//
// WHAT IT TAKES WITH IT
// The direction's own written content, and by foreign key the rows that say
// where it placed things: skill proofs, collective impacts, and the evidence
// and testimonial placements. The evidence and the testimonials themselves
// are not its to delete and are not touched - they are the owner's library,
// and an item that was only ever on this direction stays in it, on nothing,
// until they put it somewhere. GET is what tells them that is about to
// happen, by name, before they agree to it.
//
// EVERY RULE IS A FILTER
// Not a read followed by a decision followed by a write. The filters are the
// enforcement, so there is no window between checking and doing, and a row
// that fails any of them is simply not found.
// ============================================================================

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function caller(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return { error: Response.json({ error: 'Unauthorized' }, { status: 401 }) }
  const token = authHeader.replace('Bearer ', '')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  // The row this touches belongs to the token holder, never to a user id the
  // caller supplies. The service role sees every row, so this is the only
  // thing standing between a lens id and whoever guessed it.
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return { error: Response.json({ error: 'Unauthorized' }, { status: 401 }) }

  return { supabase, userId: user.id }
}

// Everything that would be left on no direction at all. An item on all
// directions is on the others too and is never listed; an item pinned to this
// one and to another keeps the other. What is named here is only what has
// nowhere else to go.
async function orphansOf(supabase, profileId, lensId) {
  const [evidenceRows, testimonialRows] = await Promise.all([
    supabase
      .from('profile_evidence_placements')
      .select('evidence_id, lens_id')
      .eq('profile_id', profileId),
    supabase
      .from('profile_testimonial_placements')
      .select('testimonial_id, lens_id')
      .eq('profile_id', profileId)
  ])

  const onlyHere = (rows, key) => {
    const elsewhere = new Set()
    const here = new Set()
    for (const row of rows || []) {
      if (row.lens_id === lensId) here.add(row[key])
      else elsewhere.add(row[key])
    }
    return [...here].filter(id => !elsewhere.has(id))
  }

  const evidenceIds = onlyHere(evidenceRows.data, 'evidence_id')
  const testimonialIds = onlyHere(testimonialRows.data, 'testimonial_id')

  const [evidence, testimonials] = await Promise.all([
    evidenceIds.length
      ? supabase
          .from('profile_evidence')
          .select('id, title')
          .eq('profile_id', profileId)
          .eq('placement_scope', 'selected')
          .is('deleted_at', null)
          .in('id', evidenceIds)
      : Promise.resolve({ data: [] }),
    testimonialIds.length
      ? supabase
          .from('profile_testimonials')
          .select('id, recipient_name')
          .eq('profile_id', profileId)
          .eq('placement_scope', 'selected')
          .in('id', testimonialIds)
      : Promise.resolve({ data: [] })
  ])

  return {
    evidence: (evidence.data || []).map(row => row.title || 'Untitled'),
    testimonials: (testimonials.data || []).map(row => row.recipient_name || 'A referee')
  }
}

// The same eligibility the delete enforces, asked as a read. A direction the
// owner may not delete has nothing to preview.
async function eligible(supabase, userId, lensId) {
  const { data } = await supabase
    .from('profile_lenses')
    .select('id, name, profile_id')
    .eq('id', lensId)
    .eq('user_id', userId)
    .eq('source', 'user_created')
    .eq('status', 'hidden')
    .is('core_resume_id', null)
    .neq('sort_order', 0)
    .maybeSingle()
  return data || null
}

// A resume standing for this direction is a reason to stop, whatever its
// state. The foreign key is ON DELETE SET NULL, so deleting the direction
// would quietly detach the resume rather than refuse - which is the worse
// outcome of the two, because nothing would say it had happened.
async function heldByResume(supabase, userId, lensId) {
  const { data } = await supabase
    .from('resumes')
    .select('id')
    .eq('user_id', userId)
    .eq('lens_id', lensId)
    .eq('is_active', true)
    .limit(1)
  return (data || []).length > 0
}

export async function GET(request) {
  try {
    const ctx = await caller(request)
    if (ctx.error) return ctx.error
    const { supabase, userId } = ctx

    const lensId = new URL(request.url).searchParams.get('lensId')
    if (!lensId || !UUID.test(lensId)) {
      return Response.json({ error: 'lensId is required' }, { status: 400 })
    }

    const lens = await eligible(supabase, userId, lensId)
    if (!lens) return Response.json({ error: 'LENS_NOT_FOUND' }, { status: 404 })

    const orphans = await orphansOf(supabase, lens.profile_id, lensId)
    return Response.json({ name: lens.name, ...orphans })

  } catch (error) {
    return apiError(error, "We couldn't check that career direction. Please try again.")
  }
}

export async function POST(request) {
  try {
    const ctx = await caller(request)
    if (ctx.error) return ctx.error
    const { supabase, userId } = ctx

    const { lensId } = await request.json()
    if (!lensId || !UUID.test(lensId)) {
      return Response.json({ error: 'lensId is required' }, { status: 400 })
    }

    if (await heldByResume(supabase, userId, lensId)) {
      return Response.json({ error: 'LENS_IN_USE', code: 'LENS_IN_USE' }, { status: 409 })
    }

    // Ownership and every rule ride on the delete itself. A suggestion, the
    // primary, a direction still on the profile, or one with a core behind it
    // matches nothing here and comes back as not found.
    //
    // Placement rows, skill proofs and collective impacts go with it through
    // their own foreign keys, which already cascade. Nothing is deleted by
    // hand here: a second delete that the database is already doing is a
    // second thing to get wrong.
    const { data: deleted, error: deleteError } = await supabase
      .from('profile_lenses')
      .delete()
      .eq('id', lensId)
      .eq('user_id', userId)
      .eq('source', 'user_created')
      .eq('status', 'hidden')
      .is('core_resume_id', null)
      .neq('sort_order', 0)
      .select('id, name')
      .maybeSingle()

    if (deleteError) {
      console.error('Lens delete failed:', deleteError)
      return Response.json({ error: 'DELETE_FAILED' }, { status: 500 })
    }
    if (!deleted) return Response.json({ error: 'LENS_NOT_FOUND' }, { status: 404 })

    return Response.json({ success: true, lensId: deleted.id, name: deleted.name })

  } catch (error) {
    return apiError(error, "We couldn't delete this career direction. Please try again.")
  }
}
