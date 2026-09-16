import { createClient } from '@supabase/supabase-js'
import { noEmDash, isEntitledTier } from '../../_lib/recruiterContext'
import { canonicalType, familyForType } from '@/lib/evidenceTypes'

// ============================================================================
// PATCH  /api/career-profile/evidence/[evidenceId]  - change what it says
// DELETE /api/career-profile/evidence/[evidenceId]  - take it off the profile
//
// WHOSE EVIDENCE THIS TOUCHES
// The token's. The id in the path is matched together with the caller's user
// id, so an id belonging to somebody else is a 404 and not a write - the same
// pairing the lens route uses, and for the same reason.
//
// WHAT CANNOT BE CHANGED HERE
// The source. A link's url and an upload's file are what the item IS, and
// swapping either under an existing title would leave a tile that describes
// one thing and opens another. Changing the source means adding the new thing
// and removing the old one, which is two visible actions rather than one
// invisible one.
//
// PRIVACY IS PRO
// Not because hiding a file is expensive, but because a profile that can keep
// some evidence back is a different product from one that shows everything,
// and that is the line the tier draws. A free account's items stay public,
// which is what they already are.
//
// DELETE IS SOFT, AND THE FILE STAYS
// deleted_at is set and the placements go. The row remains, and so does
// anything uploaded with it, because a delete somebody regrets ten seconds
// later is common and an object nobody can point at is not costing anyone
// anything. The manage route already filters on deleted_at, so a deleted item
// is gone from every surface either way.
// ============================================================================

const LIMITS = { title: 200, description: 1000, organization: 120, date_label: 40 }

const CONTROL = new RegExp(
  '[' +
  "\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F" +
  "\\u200B-\\u200F\\u2028\\u2029\\uFEFF" +
  ']', 'g'
)
const clean = (value) => noEmDash(String(value).replace(CONTROL, '').replace(/\s+/g, ' ').trim())

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function text(value, max, label, { required = false } = {}) {
  if (value === null || value === '') return required ? { error: `${label} is required.` } : { value: null }
  if (typeof value !== 'string') return { error: `${label} must be text.` }
  const trimmed = clean(value)
  if (!trimmed) return required ? { error: `${label} is required.` } : { value: null }
  if (trimmed.length > max) return { error: `${label} is too long (max ${max} characters).` }
  return { value: trimmed }
}

const RETURNED =
  'id, family, evidence_type, kind, media_class, title, description, ' +
  'organization, date_label, source_type, url, provider, embed_url, ' +
  'mime_type, file_size, privacy, status, sort_order, updated_at'

async function owned(request, evidenceId) {
  if (!evidenceId || !UUID.test(evidenceId)) {
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

  // Id and owner together. Either alone is wrong: the id alone writes to
  // whoever's item was named, the owner alone has no item.
  const { data: item } = await supabase
    .from('profile_evidence')
    .select('id, profile_id, privacy, status')
    .eq('id', evidenceId)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (!item) return { error: Response.json({ error: 'Not found.' }, { status: 404 }) }

  return { supabase, user, item }
}

export async function PATCH(request, { params }) {
  try {
    const { evidenceId } = await params
    const ctx = await owned(request, evidenceId)
    if (ctx.error) return ctx.error
    const { supabase, user, item } = ctx

    let body
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'Invalid request.' }, { status: 400 })
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return Response.json({ error: 'Invalid request.' }, { status: 400 })
    }

    const patch = {}

    if (Object.prototype.hasOwnProperty.call(body, 'title')) {
      const r = text(body.title, LIMITS.title, 'A title', { required: true })
      if (r.error) return Response.json({ error: r.error, code: 'INVALID', field: 'title' }, { status: 400 })
      patch.title = r.value
    }
    for (const [key, label, max] of [
      ['description', 'The description', LIMITS.description],
      ['organization', 'The organisation', LIMITS.organization],
      ['date_label', 'The date', LIMITS.date_label]
    ]) {
      if (!Object.prototype.hasOwnProperty.call(body, key)) continue
      const r = text(body[key], max, label)
      if (r.error) return Response.json({ error: r.error, code: 'INVALID', field: key }, { status: 400 })
      patch[key] = r.value
    }

    // The type and the family move together or not at all, because the family
    // is derived from the type and a stored pair that disagrees would file the
    // item under something nobody chose.
    if (Object.prototype.hasOwnProperty.call(body, 'evidence_type')) {
      const type = canonicalType(body.evidence_type)
      const family = familyForType(body.evidence_type)
      if (!type || !family) {
        return Response.json(
          { error: 'Choose what kind of evidence this is.', code: 'INVALID', field: 'evidence_type' },
          { status: 400 }
        )
      }
      patch.evidence_type = type
      patch.family = family
      patch.kind = family
    }

    if (Object.prototype.hasOwnProperty.call(body, 'privacy')) {
      if (body.privacy !== 'public' && body.privacy !== 'private') {
        return Response.json({ error: 'Invalid request.', code: 'INVALID', field: 'privacy' }, { status: 400 })
      }
      const { data: account } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', user.id)
        .maybeSingle()

      // Going private is the Pro half. Going back to public is always allowed,
      // so an account that lapses is never left with evidence it cannot
      // un-hide.
      if (body.privacy === 'private' && !isEntitledTier(account?.subscription_tier)) {
        return Response.json(
          { error: 'Keeping evidence private is a Pro feature.', code: 'PRO_REQUIRED' },
          { status: 403 }
        )
      }
      patch.privacy = body.privacy
    }

    if (Object.keys(patch).length === 0) {
      return Response.json({ error: 'Nothing to save.', code: 'EMPTY' }, { status: 400 })
    }

    patch.updated_at = new Date().toISOString()

    const { data: updated, error: updateError } = await supabase
      .from('profile_evidence')
      .update(patch)
      .eq('id', item.id)
      .eq('user_id', user.id)
      .select(RETURNED)
      .maybeSingle()

    if (updateError) {
      console.error('[career-profile] Evidence update failed:', updateError)
      return Response.json({ error: "We couldn't save that. Please try again." }, { status: 500 })
    }
    if (!updated) return Response.json({ error: 'Not found.' }, { status: 404 })

    return Response.json({ evidence: updated })
  } catch (error) {
    console.error('[career-profile] Evidence PATCH failed:', error)
    return Response.json({ error: "We couldn't save that. Please try again." }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    const { evidenceId } = await params
    const ctx = await owned(request, evidenceId)
    if (ctx.error) return ctx.error
    const { supabase, user, item } = ctx

    // The placements go first and go for real. They are the thing that puts an
    // item on the page, and a soft-deleted row with live placements would be
    // an item that is gone from the manager and still on the profile.
    const { error: placementError } = await supabase
      .from('profile_evidence_placements')
      .delete()
      .eq('evidence_id', item.id)
      .eq('profile_id', item.profile_id)

    if (placementError) {
      console.error('[career-profile] Placement delete failed:', placementError)
      return Response.json({ error: "We couldn't remove that. Please try again." }, { status: 500 })
    }

    const { data: removed, error: deleteError } = await supabase
      .from('profile_evidence')
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', item.id)
      .eq('user_id', user.id)
      .select('id')
      .maybeSingle()

    if (deleteError) {
      console.error('[career-profile] Evidence delete failed:', deleteError)
      return Response.json({ error: "We couldn't remove that. Please try again." }, { status: 500 })
    }
    if (!removed) return Response.json({ error: 'Not found.' }, { status: 404 })

    return Response.json({ deleted: removed.id })
  } catch (error) {
    console.error('[career-profile] Evidence DELETE failed:', error)
    return Response.json({ error: "We couldn't remove that. Please try again." }, { status: 500 })
  }
}
