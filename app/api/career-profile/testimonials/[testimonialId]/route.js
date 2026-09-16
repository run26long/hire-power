import { createClient } from '@supabase/supabase-js'

// ============================================================================
// PATCH  /api/career-profile/testimonials/[testimonialId]  - publish, or not
// DELETE /api/career-profile/testimonials/[testimonialId]  - withdraw it
//
// The candidate's decision, and the only thing that puts a testimonial on a
// public profile.
//
// TWO STATES, BOTH REVERSIBLE
// `polished` means it exists and nobody but the candidate can see it.
// `published` means it is on the profile. Unpublishing goes back to `polished`
// rather than to anything terminal, because taking something down for a week
// is a normal thing to want and should not cost the testimonial.
//
// WHAT CANNOT BE CHANGED HERE
// The words. Not the referee's, not the polished version. Somebody else wrote
// them about the candidate, and a profile where the subject can edit their own
// references is a profile whose references mean nothing. The candidate's
// choices are publish, do not publish, and remove.
//
// The one exception is `relationship`, the prose line printed under the quote,
// which is the candidate's account of how they worked together rather than
// part of what the referee said. relationship_type is not editable: it is what
// EARNED 360 counts, and a profile that could retype its own denominator could
// award itself the tag.
// ============================================================================

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const RELATIONSHIP_MAX = 200

async function owned(request, testimonialId) {
  if (!testimonialId || !UUID.test(testimonialId)) {
    return { error: Response.json({ error: 'Not found.' }, { status: 404 }) }
  }

  const authHeader = request.headers.get('authorization')
  if (!authHeader) return { error: Response.json({ error: 'Unauthorized' }, { status: 401 }) }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
  const { data: { user }, error } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (error || !user) return { error: Response.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { data: row } = await supabase
    .from('profile_testimonials')
    .select('id, status, polished_text')
    .eq('id', testimonialId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!row) return { error: Response.json({ error: 'Not found.' }, { status: 404 }) }

  return { supabase, user, row }
}

const RETURNED =
  'id, recipient_name, recipient_title, relationship, relationship_type, ' +
  'status, polished_text, submitted_at, reference_consent, created_at'

export async function PATCH(request, { params }) {
  try {
    const { testimonialId } = await params
    const ctx = await owned(request, testimonialId)
    if (ctx.error) return ctx.error
    const { supabase, user, row } = ctx

    let body
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'Invalid request.' }, { status: 400 })
    }

    const patch = {}

    if (Object.prototype.hasOwnProperty.call(body, 'status')) {
      if (body.status !== 'published' && body.status !== 'polished') {
        return Response.json({ error: 'Invalid request.', code: 'INVALID', field: 'status' }, { status: 400 })
      }
      // There has to be something to publish. A row still at `requested` or
      // `submitted` has no polished text, and publishing it would put either
      // nothing or a stranger's unedited paragraph on a public page.
      if (body.status === 'published' && !row.polished_text) {
        return Response.json(
          { error: 'There is nothing to publish yet.', code: 'NOT_READY' },
          { status: 409 }
        )
      }
      patch.status = body.status
    }

    if (Object.prototype.hasOwnProperty.call(body, 'relationship')) {
      if (body.relationship !== null && typeof body.relationship !== 'string') {
        return Response.json({ error: 'Invalid request.', code: 'INVALID', field: 'relationship' }, { status: 400 })
      }
      const text = String(body.relationship ?? '').replace(/\s+/g, ' ').trim()
      if (text.length > RELATIONSHIP_MAX) {
        return Response.json(
          { error: `That is too long (max ${RELATIONSHIP_MAX} characters).`, code: 'INVALID', field: 'relationship' },
          { status: 400 }
        )
      }
      patch.relationship = text || null
    }

    if (Object.keys(patch).length === 0) {
      return Response.json({ error: 'Nothing to save.', code: 'EMPTY' }, { status: 400 })
    }

    patch.updated_at = new Date().toISOString()

    const { data: updated, error: updateError } = await supabase
      .from('profile_testimonials')
      .update(patch)
      .eq('id', row.id)
      .eq('user_id', user.id)
      .select(RETURNED)
      .maybeSingle()

    if (updateError) {
      console.error('[career-profile] Testimonial update failed:', updateError)
      return Response.json({ error: "We couldn't save that. Please try again." }, { status: 500 })
    }
    if (!updated) return Response.json({ error: 'Not found.' }, { status: 404 })

    return Response.json({ testimonial: updated })
  } catch (error) {
    console.error('[career-profile] Testimonial PATCH failed:', error)
    return Response.json({ error: "We couldn't save that. Please try again." }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    const { testimonialId } = await params
    const ctx = await owned(request, testimonialId)
    if (ctx.error) return ctx.error
    const { supabase, user, row } = ctx

    // A real delete, unlike evidence. There is no soft-delete column on this
    // table, and more to the point the token stays live while the row does:
    // leaving a withdrawn testimonial in place would leave its referee a
    // working link to a request the candidate has already refused.
    const { error: deleteError } = await supabase
      .from('profile_testimonials')
      .delete()
      .eq('id', row.id)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('[career-profile] Testimonial delete failed:', deleteError)
      return Response.json({ error: "We couldn't remove that. Please try again." }, { status: 500 })
    }

    return Response.json({ deleted: row.id })
  } catch (error) {
    console.error('[career-profile] Testimonial DELETE failed:', error)
    return Response.json({ error: "We couldn't remove that. Please try again." }, { status: 500 })
  }
}
