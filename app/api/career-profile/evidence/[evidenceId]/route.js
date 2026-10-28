import { createClient } from '@supabase/supabase-js'
import { noEmDash } from '../../_lib/recruiterContext'
import { canUseProTools } from '@/lib/tiers'
import { canonicalType, familyForType } from '@/lib/evidenceTypes'
import { canHaveThumbnail, isLinkRow, makeEvidenceThumbnail, removeThumbnail } from '../../_lib/evidenceThumbnail'
import { chargeOutbound, outboundExhausted } from '../../_lib/outboundLimit'

// Everything here is a field edit that lands in milliseconds, except turning
// a thumbnail on: a link fetches the page and then the image it names, each
// bounded by safeFetch at five seconds, and a PDF loads a native renderer and
// draws its first page. Sixty is clear of both and is the ceiling on Vercel's
// Hobby plan, so it is a value every plan accepts - Pro and Enterprise allow
// more and do not need it here.
export const maxDuration = 60

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
// WHAT CAN BE CHANGED HERE THAT IS NOT A FIELD
// Whether the item carries a picture. `use_thumbnail` is a switch over a
// derived object, not over the item's source, which is why it belongs here
// while the source does not: turning it off removes a file this server made
// and nothing the owner gave us, and turning it on makes that file again from
// the same place it came from the first time - a link's page is asked for its
// og:image again, a PDF's first page is drawn again.
//
// Off always succeeds. On can fail for every reason the internet fails, and
// says so with a sentence rather than quietly leaving the switch where it was:
// the row is untouched, the item keeps its icon, and the owner can try again.
//
// Turning one on for a link is an outbound request to a site this server does
// not control, so it is held to the same per-account allowance the preview
// route is - the same counters, not a second set. Over it, nothing is written
// and the pane says so in the toast it already uses for every other failure.
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

const LIMITS = { title: 200, description: 1000, organization: 120, date_label: 40, url: 2048 }

const CONTROL = new RegExp(
  '[' +
  "\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F" +
  "\\u200B-\\u200F\\u2028\\u2029\\uFEFF" +
  ']', 'g'
)
const clean = (value) => noEmDash(String(value).replace(CONTROL, '').replace(/\s+/g, ' ').trim())

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// The second lock on the scheme. The column refuses anything but http and
// https, so this is here to answer with a sentence rather than a 500 - and to
// refuse a URL that is merely unparseable, which the column would accept.
//
// Copied from the link creation route rather than imported, for the reason
// given there: the three routes that accept a web address must agree about
// what one is, and the way they agree is by being the same twenty lines.
function webUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return { error: 'A link is required.' }
  const raw = value.trim()
  if (raw.length > LIMITS.url) return { error: 'That link is too long.' }
  let parsed
  try {
    parsed = new URL(raw)
  } catch {
    return { error: "That doesn't look like a web address." }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { error: 'Only http and https links can be added.' }
  }
  return { value: parsed.toString() }
}

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
    .select(
      'id, profile_id, privacy, status, source_type, url, ' +
      // What the thumbnail switch reads: what kind of thing this is, where
      // its page or its file is, and whether it already has a picture.
      'mime_type, storage_path, thumbnail_path'
    )
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
      ['organization', 'The organization', LIMITS.organization],
      ['date_label', 'The date', LIMITS.date_label]
    ]) {
      if (!Object.prototype.hasOwnProperty.call(body, key)) continue
      const r = text(body[key], max, label)
      if (r.error) return Response.json({ error: r.error, code: 'INVALID', field: key }, { status: 400 })
      patch[key] = r.value
    }

    // ---- THE LINK ----
    //
    // An uploaded item may gain one, change it, or lose it: the file is its
    // source and the link is an extra. A link item may change its address but
    // not clear it, because the address is the only thing it has - an item
    // with no file and no link is a title with nothing behind it, and the
    // column would be the only record that it ever pointed anywhere.
    if (Object.prototype.hasOwnProperty.call(body, 'url')) {
      const raw = typeof body.url === 'string' ? body.url.trim() : ''
      if (!raw) {
        if (item.source_type !== 'upload') {
          return Response.json(
            { error: 'A link item needs its link. Add a file instead, or delete the item.', code: 'INVALID', field: 'url' },
            { status: 400 }
          )
        }
        patch.url = null
      } else {
        const checked = webUrl(raw)
        if (checked.error) {
          return Response.json({ error: checked.error, code: 'INVALID', field: 'url' }, { status: 400 })
        }
        patch.url = checked.value
      }
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

      // Going private is the paid half. Going back to public is always
      // allowed, so an account that lapses is never left with evidence it
      // cannot un-hide.
      if (body.privacy === 'private' && !canUseProTools(account?.subscription_tier)) {
        return Response.json(
          { error: 'Keeping evidence private is part of Vault and Pro.', code: 'PRO_REQUIRED' },
          { status: 403 }
        )
      }
      patch.privacy = body.privacy
    }

    // ---- THE PICTURE ----
    //
    // Done before the write rather than after it, because what it produces is
    // one of the columns the write carries. The old object goes afterwards,
    // never before: if the update fails, the row still points at a file that
    // is there.
    let sweep = null
    if (Object.prototype.hasOwnProperty.call(body, 'use_thumbnail')) {
      if (typeof body.use_thumbnail !== 'boolean') {
        return Response.json(
          { error: 'Invalid request.', code: 'INVALID', field: 'use_thumbnail' },
          { status: 400 }
        )
      }
      // Only the two kinds that have somewhere to get a picture from. An
      // image and a video already have one and it is not this switch's; a
      // Word document has no page anything here can read.
      if (!canHaveThumbnail(item)) {
        return Response.json(
          { error: 'This kind of evidence has no page picture to use.', code: 'NO_THUMBNAIL_SOURCE' },
          { status: 400 }
        )
      }

      if (body.use_thumbnail === false) {
        sweep = item.thumbnail_path
        patch.thumbnail_path = null
      } else {
        // The preview route's outbound allowance, shared through
        // _lib/outboundLimit, and asked before anything opens a socket.
        //
        // A link turn-on fetches the page and then the image it names, so it
        // is the one that costs. A PDF is drawn from our own bucket and makes
        // no outbound request at all, so it is not charged and not refused -
        // charging it would spend somebody's link allowance on a file they
        // had already given us.
        if (isLinkRow(item) && outboundExhausted(user.id)) {
          return Response.json(
            {
              error: 'Too many link lookups in the last minute. Wait a moment and try again.',
              code: 'RATE_LIMITED'
            },
            { status: 429 }
          )
        }

        const made = await makeEvidenceThumbnail(supabase, item, {
          onOutbound: () => chargeOutbound(user.id)
        })
        if (!made) {
          // Nothing is written. The switch stays off, the item keeps its
          // icon, and the sentence is the one the pane puts in a toast.
          return Response.json(
            {
              error: item.source_type === 'link'
                ? "We couldn't get a picture from that page. It may not publish one."
                : "We couldn't draw the first page of that document.",
              code: 'THUMBNAIL_FAILED'
            },
            { status: 422 }
          )
        }
        // The one being replaced, where there was one. Not the one just made,
        // which a PDF's naming would hand back as the same path.
        if (item.thumbnail_path && item.thumbnail_path !== made) sweep = item.thumbnail_path
        patch.thumbnail_path = made
      }
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

    if (updateError || !updated) {
      // A picture made a moment ago that no row will ever name. Taken back
      // out before answering, for the reason the add path does it: an object
      // nothing points at is one nothing can ever find or delete by.
      if (patch.thumbnail_path && patch.thumbnail_path !== item.thumbnail_path) {
        await removeThumbnail(supabase, patch.thumbnail_path)
      }
      if (!updateError) return Response.json({ error: 'Not found.' }, { status: 404 })
      console.error('[career-profile] Evidence update failed:', updateError)
      return Response.json({ error: "We couldn't save that. Please try again." }, { status: 500 })
    }

    // Unreferenced the moment the update lands, so this is the first point at
    // which removing it is safe.
    if (sweep) await removeThumbnail(supabase, sweep)

    return Response.json({
      evidence: {
        ...updated,
        // Not in RETURNED, and deliberately: the page is told a picture exists
        // and never where it is.
        has_thumbnail: Object.prototype.hasOwnProperty.call(patch, 'thumbnail_path')
          ? Boolean(patch.thumbnail_path)
          : Boolean(item.thumbnail_path)
      }
    })
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
