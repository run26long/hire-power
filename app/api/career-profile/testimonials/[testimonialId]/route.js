import { createClient } from '@supabase/supabase-js'
import { RELATIONSHIP_TYPES } from '@/lib/testimonialTypes'
import { bumpVaultCount } from '@/lib/vaultCount'
import { requireCustomise } from '../../_lib/requireCustomise'

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
// The exceptions are the two relationship fields, which are the candidate's
// account of how they worked together rather than part of what the referee
// said: `relationship`, the prose line printed under the quote, and
// `relationship_type`, the category EARNED 360 counts.
//
// I refused the category here first, on the reasoning that a profile able to
// retype its own denominator could award itself the tag. That was wrong in a
// way worth naming. The owner already chooses the category when they send the
// request, so refusing it afterwards did not withhold anything - it only meant
// the four testimonials that predate the column could never count toward the
// tag at all, with no way to say what they were. And the CHECK constraint
// limits the value to five categories, so the worst somebody can do is call a
// colleague a client, which is a lie about their own references rather than a
// hole in the system.
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

    // Publishing a testimonial, or editing its text, puts words on the
    // profile. Taking one down is the DELETE below and is never gated.
    const gate = await requireCustomise(user.id)
    if (gate) return gate

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

    if (Object.prototype.hasOwnProperty.call(body, 'relationship_type')) {
      // Null clears it, which is a real choice: "I do not want to say" should
      // be reachable, and an uncategorised row simply does not count.
      if (body.relationship_type === null || body.relationship_type === '') {
        patch.relationship_type = null
      } else {
        // Matched case-insensitively against the list and stored in its
        // canonical spelling, so "manager" and "Manager" cannot become two
        // kinds of relationship in a count that only means anything if they
        // are one.
        const matched = typeof body.relationship_type === 'string'
          ? RELATIONSHIP_TYPES.find(t => t.toLowerCase() === body.relationship_type.trim().toLowerCase())
          : null
        if (!matched) {
          return Response.json(
            { error: 'Choose how you worked together.', code: 'INVALID', field: 'relationship_type' },
            { status: 400 }
          )
        }
        patch.relationship_type = matched
      }
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

    // Somebody's words arriving on the profile is a thing in the Vault. Only
    // the crossing counts: publishing a row that was already published, or
    // renaming how you worked together, adds nothing.
    if (patch.status === 'published' && row.status !== 'published') {
      await bumpVaultCount(supabase, user.id, 1)
    }

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
