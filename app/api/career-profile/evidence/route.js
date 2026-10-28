import { requireCustomise } from '../_lib/requireCustomise'
import { bumpVaultCount } from '@/lib/vaultCount'
import { createClient } from '@supabase/supabase-js'
import { noEmDash } from '../_lib/recruiterContext'
import { canonicalType, familyForType, providerForUrl } from '@/lib/evidenceTypes'
import { thumbnailFromImageUrl } from '../_lib/evidenceThumbnail'
import { chargeOutbound, outboundExhausted } from '../_lib/outboundLimit'

// The row is written in milliseconds; the picture that follows it is one
// fetch to a site this server does not control, bounded by safeFetch at five
// seconds, plus a sharp re-encode and two storage round trips. Sixty is well
// clear of all of that and is the ceiling on Vercel's Hobby plan, so it is a
// value every plan accepts - Pro and Enterprise allow more and do not need it
// here. The route returns as soon as the work is done; this is the cap, not a
// budget it spends.
export const maxDuration = 60

// ============================================================================
// POST /api/career-profile/evidence
//
// Adding one piece of evidence, and placing it in the directions it belongs to.
//
// WHOSE PROFILE THIS WRITES TO
// The token's. No profile id and no user id is read from the body. The lens
// ids are, and every one of them is checked against the directions that
// profile actually has before a placement is written - the composite foreign
// key would refuse a foreign lens anyway, but it would refuse it as a 500
// after the evidence row already existed.
//
// WHAT THE DATABASE ALREADY ENFORCES, AND WHAT IT DOES NOT
// This table is defended, unusually so for this schema. I confirmed by writing
// the violating rows and rolling them back: family, privacy, status,
// media_class and source_type are constrained to their enums; url and
// embed_url must be http or https; file_size cannot be negative; kind,
// media_class and title are NOT NULL; and a published row must be a link with
// a url or an upload with a storage path.
//
// It does not constrain evidence_type at all, and it does not limit the length
// of a title or an organisation. So this route owns the type list - through
// lib/evidenceTypes, the same module the form reads - and the lengths.
//
// LINKS ONLY, FOR NOW
// source_type is fixed to 'link' here. Uploads need a file in the bucket
// before a row can exist at all, which is a different order of operations and
// a different route; nothing in this one should be reachable by an upload half
// way through.
//
// PUBLISHED, AND PUBLIC BY DEFAULT
// Somebody adding evidence to their profile means it to appear there. A draft
// default would mean every item needed a second action nobody was told about,
// and the first symptom would be a profile that looks like it lost the thing
// that was just added.
//
// THE PICTURE, AND WHY IT IS THE LAST THING THAT HAPPENS
// The owner saw the page's own image in the form and left the switch on, so
// `thumbnail_url` is the address they were shown. It is fetched here through
// _lib/safeFetch, decoded to prove it is a picture, re-encoded and stored in
// our bucket - the address itself is never kept and nothing on a profile ever
// points at somebody else's server.
//
// It happens after the row exists, and the row is never rolled back for it.
// A page with no image, an image that will not decode, a server that will not
// answer, an account that has spent its outbound allowance for the minute -
// none of those is a reason to refuse somebody's work. The item saves with no
// thumbnail and draws its icon, which is what every link did before this
// existed, and the switch in the edit pane can try again later.
//
// THE OUTBOUND ALLOWANCE IS THE PREVIEW ROUTE'S
// Literally: the same counters, in _lib/outboundLimit, so twenty fetches a
// minute is twenty across every route that opens a socket rather than twenty
// per route. Saving a link is a second door onto the same thing the preview
// route does, and a second door with its own budget is not a budget.
// ============================================================================

const LIMITS = {
  title: 200,
  description: 1000,
  organization: 120,
  date_label: 40,
  url: 2048
}

// The same set the lens route strips, and for the same reason: these arrive by
// paste, and a zero-width character in a title is invisible here and visible
// in a search result.
const CONTROL = new RegExp(
  '[' +
  "\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F" +
  "\\u200B-\\u200F\\u2028\\u2029\\uFEFF" +
  ']', 'g'
)

const clean = (value) => noEmDash(String(value).replace(CONTROL, '').replace(/\s+/g, ' ').trim())

function text(value, max, label, { required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    return required ? { error: `${label} is required.` } : { value: null }
  }
  if (typeof value !== 'string') return { error: `${label} must be text.` }
  const trimmed = clean(value)
  if (!trimmed) return required ? { error: `${label} is required.` } : { value: null }
  if (trimmed.length > max) return { error: `${label} is too long (max ${max} characters).` }
  return { value: trimmed }
}

// The second lock on the scheme. The column refuses anything but http and
// https, so this is here to answer with a sentence rather than a 500 - and to
// refuse a URL that is merely unparseable, which the column would accept.
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

const RETURNED =
  'id, family, evidence_type, kind, media_class, title, description, ' +
  'organization, date_label, source_type, url, provider, embed_url, ' +
  'mime_type, file_size, privacy, status, sort_order, created_at, updated_at'

export async function POST(request) {
  try {
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
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return Response.json({ error: 'Invalid request.' }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from('career_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!profile) return Response.json({ error: 'No profile to add to.' }, { status: 404 })

    // Putting new content on a profile is the paid half. Reading it, and
    // taking something down, are not.
    const gate = await requireCustomise(user.id, supabase)
    if (gate) return gate

    // ---- THE FIELDS ----
    const url = webUrl(body.url)
    if (url.error) return Response.json({ error: url.error, code: 'INVALID', field: 'url' }, { status: 400 })

    const type = canonicalType(body.evidence_type)
    const family = familyForType(body.evidence_type)
    if (!type || !family) {
      return Response.json(
        { error: 'Choose what kind of evidence this is.', code: 'INVALID', field: 'evidence_type' },
        { status: 400 }
      )
    }

    const fields = {
      title: text(body.title, LIMITS.title, 'A title', { required: true }),
      description: text(body.description, LIMITS.description, 'The description'),
      organization: text(body.organization, LIMITS.organization, 'The organization'),
      date_label: text(body.date_label, LIMITS.date_label, 'The date')
    }
    for (const [key, result] of Object.entries(fields)) {
      if (result.error) {
        return Response.json({ error: result.error, code: 'INVALID', field: key }, { status: 400 })
      }
    }

    // ---- WHERE IT GOES ----
    // Ids from the browser, so every one is checked against this profile's own
    // directions rather than trusted. Duplicates collapse: asking for the same
    // direction twice is one placement, not a unique-violation.
    // ---- WHICH DIRECTIONS ----
    //
    // The default is every direction, which is also what an older caller that
    // sends nothing gets. Absent used to mean "none", and none meant the item
    // was saved and shown nowhere: a quiet invisibility nobody picked on
    // purpose. The picker now states the answer instead of making somebody
    // tick their way to it.
    const scope = body?.placement_scope === 'selected' ? 'selected' : 'all'

    if (body?.lens_ids !== undefined && !Array.isArray(body.lens_ids)) {
      return Response.json(
        { error: 'Choose which Career Directions to show it in.', code: 'INVALID', field: 'lens_ids' },
        { status: 400 }
      )
    }
    // Only consulted for 'selected'. An item on all directions is on them by
    // saying so, and a list sent alongside that would be a second answer to a
    // question that already has one.
    const requested = scope === 'selected' && Array.isArray(body.lens_ids)
      ? [...new Set(body.lens_ids.filter(id => typeof id === 'string' && id))]
      : []
    let lensIds = []
    if (requested.length > 0) {
      const { data: owned } = await supabase
        .from('profile_lenses')
        .select('id')
        .eq('profile_id', profile.id)
        .in('id', requested)
      lensIds = (owned || []).map(l => l.id)
      if (lensIds.length !== requested.length) {
        return Response.json(
          { error: 'One of those Career Directions is not on your profile.', code: 'BAD_LENS' },
          { status: 400 }
        )
      }
    }

    // ---- THE ROW ----
    const provider = providerForUrl(url.value)

    // Where it lands in the collection. Read rather than counted from the
    // client, and last - a new item goes at the end of what is already there.
    const { data: lastItem } = await supabase
      .from('profile_evidence')
      .select('sort_order')
      .eq('profile_id', profile.id)
      .is('deleted_at', null)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data: created, error: insertError } = await supabase
      .from('profile_evidence')
      .insert({
        profile_id: profile.id,
        user_id: user.id,
        family,
        evidence_type: type,
        // `kind` predates family/evidence_type and is NOT NULL. It is set from
        // the family so the column stays meaningful rather than being filled
        // with a placeholder nobody can interpret later.
        kind: family,
        media_class: provider ? 'embed' : 'link',
        title: fields.title.value,
        description: fields.description.value,
        organization: fields.organization.value,
        date_label: fields.date_label.value,
        source_type: 'link',
        url: url.value,
        provider,
        embed_url: provider ? url.value : null,
        privacy: 'public',
        status: 'published',
        placement_scope: scope,
        sort_order: (lastItem?.sort_order ?? -1) + 1
      })
      .select(RETURNED)
      .maybeSingle()

    if (insertError || !created) {
      console.error('[career-profile] Evidence insert failed:', insertError)
      return Response.json({ error: "We couldn't save that. Please try again." }, { status: 500 })
    }

    // ---- THE PLACEMENTS ----
    // After the row, because a placement without its evidence is refused by
    // the foreign key. It goes on the end of each direction it is placed on:
    // the lead is whatever sits first, and a new item has not earned that.
    //
    // An item on all directions gets no rows at all. Its scope already says
    // where it is, and writing a row per direction would be the same claim
    // made twice, in a form that stops being true the next time somebody adds
    // a direction.
    let placements = []
    if (scope === 'selected' && lensIds.length > 0) {
      const { data: existing } = await supabase
        .from('profile_evidence_placements')
        .select('lens_id, sort_order')
        .eq('profile_id', profile.id)
        .in('lens_id', lensIds)

      const nextFor = new Map()
      for (const lensId of lensIds) {
        const used = (existing || []).filter(p => p.lens_id === lensId).map(p => p.sort_order ?? 0)
        nextFor.set(lensId, used.length ? Math.max(...used) + 1 : 0)
      }

      const { data: madePlacements, error: placementError } = await supabase
        .from('profile_evidence_placements')
        .insert(lensIds.map(lensId => ({
          profile_id: profile.id,
          evidence_id: created.id,
          lens_id: lensId,
          sort_order: nextFor.get(lensId)
        })))
        .select('id, evidence_id, lens_id, sort_order')

      if (placementError) {
        // The item exists but is in no direction, which is a state the manager
        // shows plainly as "Not placed in any direction". Rolling the row back
        // would throw away something the owner just typed to fix a problem
        // they can fix in one click.
        console.error('[career-profile] Placement insert failed:', placementError)
        return Response.json({
          evidence: created,
          placements: [],
          warning: "Saved, but we couldn't place it in those Career Directions. You can assign it below."
        })
      }
      placements = madePlacements || []
    }

    // A new piece of proof is a new thing in the Vault, whether or not it
    // reached a career direction.
    await bumpVaultCount(supabase, user.id, 1)

    // ---- THE PICTURE ----
    //
    // Asked for by the switch under the preview, and only then: an owner who
    // turned it off, or a page that advertised no image, sends nothing and
    // nothing is fetched. The column is written in a second statement rather
    // than in the insert because the fetch can take a second and must not sit
    // between the owner pressing Save and the item existing.
    let thumbnailPath = null
    let thumbnailWarning = null
    if (body.use_thumbnail === true && typeof body.thumbnail_url === 'string') {
      // Asked before anything opens a socket. Over the allowance, the picture
      // is simply not fetched: the item is already saved and the switch in
      // its edit pane will make one later, which is a better answer than
      // refusing to save work over a thumbnail.
      if (outboundExhausted(user.id)) {
        thumbnailWarning =
          "Saved, but we didn't fetch the page's image just yet - too many link lookups in the "
          + 'last minute. Turn the thumbnail on from this item to try again.'
      } else {
        thumbnailPath = await thumbnailFromImageUrl(
          supabase,
          body.thumbnail_url,
          null,
          { onOutbound: () => chargeOutbound(user.id) }
        )
      }
      if (thumbnailPath) {
        const { error: thumbError } = await supabase
          .from('profile_evidence')
          .update({ thumbnail_path: thumbnailPath, updated_at: new Date().toISOString() })
          .eq('id', created.id)
          .eq('user_id', user.id)
        if (thumbError) {
          // The object has nothing pointing at it, so it is not this item's
          // picture and never will be. Taken back out rather than left for
          // nobody to find.
          console.error('[career-profile] Thumbnail column write failed (non-fatal):', thumbError)
          await supabase.storage.from('profile-media').remove([thumbnailPath]).catch(() => {})
          thumbnailPath = null
        }
      }
    }

    return Response.json({
      evidence: { ...created, has_thumbnail: Boolean(thumbnailPath) },
      placements,
      // The add dialog already shows a warning on its "Added." step, which is
      // where the placement failure above reports. A thumbnail that was not
      // fetched reports in the same place rather than inventing a second one.
      ...(thumbnailWarning ? { warning: thumbnailWarning } : {})
    })
  } catch (error) {
    console.error('[career-profile] Evidence route failed:', error)
    return Response.json({ error: "We couldn't save that. Please try again." }, { status: 500 })
  }
}
