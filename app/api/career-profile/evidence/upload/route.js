import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { noEmDash, isEntitledTier } from '../../_lib/recruiterContext'
import { canonicalType, familyForType } from '@/lib/evidenceTypes'
import { MAX_UPLOAD_BYTES, uploadTypeFor } from '@/lib/evidenceUploads'
import { FREE_VISUAL_UPLOADS } from '@/lib/portfolio'

// ============================================================================
// POST /api/career-profile/evidence/upload   - ask for somewhere to put a file
// PUT  /api/career-profile/evidence/upload   - the file is there; make the row
//
// Two steps, because the browser uploads straight to storage. The file never
// passes through this server on the way in, which is what keeps a 50MB video
// out of a serverless request body.
//
// THE PATH IS THE SERVER'S, ALWAYS - AND CARRIES NO IDENTIFIERS
// The browser says what type of file it has; it never says where the file
// goes. The path is two random uuids and an extension chosen from the declared
// type, so a file named "cv.pdf.exe" is stored as a .pdf and a file named
// "../../other" has no effect on where it lands.
//
// It deliberately contains no user id and no profile id. A Supabase signed URL
// embeds the object path, and that URL is handed to anonymous readers by the
// evidence media route - so anything in the path is published to anyone who
// opens a piece of evidence. A path beginning with the owner's auth user id
// would put their account identity in front of every recruiter who clicked a
// document. I built it that way first and caught it reading a real signed URL.
//
// OWNERSHIP IS CARRIED BY A TICKET, NOT BY THE PATH
// Because the path no longer names its owner, the finalise step cannot check
// ownership by looking at it. Instead the first step returns a short-lived
// HMAC over the path and the user, and the second step will not write a row
// without it. A path cannot be guessed, and a guessed one cannot be claimed.
//
// AND THE FINALISE STEP DOES NOT TRUST THE FIRST ONE EITHER
// The row is written from what storage actually holds, not from what the
// browser said it uploaded. The object is inspected server-side for its real
// size and content type. A caller that uploads a 2KB text file and then claims
// a 40MB video gets a row describing a 2KB file - or, since the bucket refuses
// the type outright, no file at all.
//
// WHY A THUMBNAIL AND NOT A TRANSFORM URL
// The bucket is private. Every read is a signed URL from the evidence route,
// which already serves `variant=thumbnail` and already refuses to fall back to
// the source file when a thumbnail is missing. So a thumbnail is a second
// object, made once, rather than a query parameter on a public URL that would
// have to exist for anyone holding it.
//
// Images make their own. A video cannot: there is no ffmpeg here and sharp
// does not open video containers, so the only thing that can read a frame out
// of an MP4 is a browser that is already decoding it. So the browser picks the
// frame and uploads it as a second object, and this route treats that object
// as untrusted input - it is re-encoded through the same sharp pipeline an
// uploaded photograph goes through, then thrown away. What lands in
// thumbnail_path is a webp this server made, whatever the browser sent.
//
// Everything else keeps its icon. A PDF is not missing a picture; it has the
// picture it is supposed to have.
// ============================================================================

const service = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const BUCKET = 'profile-media'

// Wide enough to stand as the lead card on a desktop profile, small enough
// that a grid of them is not a download. WebP because every browser that can
// reach this page reads it.
const THUMB_WIDTH = 800
const THUMB_QUALITY = 78

// A guard against decompression bombs: a 3KB PNG can declare dimensions that
// cost gigabytes to decode. Well above any real photograph.
const MAX_DECODED_PIXELS = 80_000_000

const LIMITS = { title: 200, description: 1000, organization: 120, date_label: 40 }

// What a browser may hand over as a captured video frame. Narrow on purpose:
// this is not a file somebody chose, it is a canvas export, so there is no
// reason to accept anything but the two things a canvas produces.
const POSTER_TYPES = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' }

// A frame is a still of something already capped at 50MB. Well above any real
// canvas export, and low enough that the poster slot cannot be used to park a
// large file that never becomes a row.
const MAX_POSTER_BYTES = 8 * 1024 * 1024

// Longer than any plausible piece of evidence, and the point is only to refuse
// a number that is obviously not a duration.
const MAX_DURATION_SECONDS = 24 * 60 * 60

// ---------------------------------------------------------------------------
// The visual quota
//
// The first upload limit in the product. Counted here and nowhere else: the
// form reports what it was told, and a form cannot be the thing that enforces
// a limit. Only visual uploads count toward it and only a visual upload is
// refused by it, so a free account's documents and links are unaffected.
// ---------------------------------------------------------------------------
async function isEntitled(supabase, userId) {
  const { data } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', userId)
    .maybeSingle()
  return isEntitledTier(data?.subscription_tier)
}

async function visualUploadCount(supabase, profileId) {
  const { count, error } = await supabase
    .from('profile_evidence')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', profileId)
    .eq('source_type', 'upload')
    .in('media_class', ['image', 'video'])
    .is('deleted_at', null)
  // A count that could not be read is not a licence to skip the limit.
  if (error) throw new Error('COUNT_FAILED')
  return count ?? 0
}

const overQuota = () => Response.json(
  {
    error: `A free account can show ${FREE_VISUAL_UPLOADS} pieces of visual work. `
      + 'Upgrade to add more, or remove one to make room.',
    code: 'PRO_REQUIRED'
  },
  { status: 403 }
)

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

const RETURNED =
  'id, family, evidence_type, kind, media_class, title, description, ' +
  'organization, date_label, source_type, url, provider, embed_url, ' +
  'mime_type, file_size, duration_seconds, privacy, status, sort_order, created_at, updated_at'

// ---------------------------------------------------------------------------
// The upload ticket.
//
// Says: this server issued this path, to this user, recently. It is what the
// path itself used to say before the identifiers came out of it.
//
// Signed rather than stored, because the alternative is a table of pending
// uploads that needs rows written, read, and swept up after the ones nobody
// finishes. The TTL is short - an upload happens in the minutes after it is
// started or it does not happen - and an expired ticket is simply not
// accepted, leaving an orphan object and no row, which is the same state a
// closed tab produces.
// ---------------------------------------------------------------------------
const TICKET_TTL_MS = 60 * 60 * 1000

const ticketKey = () =>
  process.env.RECRUITER_BRIEF_SECRET
  || process.env.RECRUITER_HASH_SECRET
  || process.env.SUPABASE_SERVICE_ROLE_KEY
  || 'hire-power'

const b64url = (buf) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

function signTicket(body) {
  return b64url(crypto.createHmac('sha256', ticketKey()).update(body).digest())
}

function issueTicket(path, userId) {
  const body = b64url(JSON.stringify({ p: path, u: userId, iat: Date.now() }))
  return `${body}.${signTicket(body)}`
}

// True only for a ticket this server signed, for this exact path, for this
// user, within the window. Compared in constant time, so a near-miss and a
// wild guess take the same time to refuse.
function ticketValid(ticket, path, userId) {
  if (typeof ticket !== 'string' || ticket.length > 4096) return false
  const dot = ticket.lastIndexOf('.')
  if (dot <= 0) return false

  const body = ticket.slice(0, dot)
  const given = Buffer.from(ticket.slice(dot + 1))
  const wanted = Buffer.from(signTicket(body))
  if (given.length !== wanted.length || !crypto.timingSafeEqual(given, wanted)) return false

  let payload
  try {
    payload = JSON.parse(Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString())
  } catch {
    return false
  }
  if (payload?.p !== path || payload?.u !== userId) return false
  return Number.isFinite(payload.iat) && Date.now() - payload.iat < TICKET_TTL_MS
}

async function owner(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return { error: Response.json({ error: 'Unauthorized' }, { status: 401 }) }

  const supabase = service()
  const { data: { user }, error } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (error || !user) return { error: Response.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { data: profile } = await supabase
    .from('career_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!profile) return { error: Response.json({ error: 'No profile to add to.' }, { status: 404 }) }

  return { supabase, user, profile }
}

// ---------------------------------------------------------------------------
// POST - somewhere to put it
// ---------------------------------------------------------------------------
export async function POST(request) {
  try {
    const ctx = await owner(request)
    if (ctx.error) return ctx.error
    const { supabase, user, profile } = ctx

    let body
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'Invalid request.' }, { status: 400 })
    }

    const kind = uploadTypeFor(body?.content_type)
    if (!kind) {
      return Response.json(
        { error: 'That kind of file cannot be added yet.', code: 'BAD_TYPE' },
        { status: 400 }
      )
    }

    // Advisory: the browser's number, used only to refuse an obviously
    // oversized file before spending an upload. The real size is read off the
    // stored object in the finalise step, and the bucket enforces its own cap
    // regardless of what is claimed here.
    const declared = Number(body?.size)
    if (Number.isFinite(declared) && declared > MAX_UPLOAD_BYTES) {
      return Response.json(
        { error: 'That file is larger than 50MB.', code: 'TOO_LARGE' },
        { status: 400 }
      )
    }

    // Refused here as well as at the finish, so a free account that is already
    // full does not spend an upload to be told. The finish is the one that
    // decides; this only saves the bytes.
    const isVisual = kind.media_class === 'image' || kind.media_class === 'video'
    if (isVisual && !(await isEntitled(supabase, user.id))) {
      let used
      try {
        used = await visualUploadCount(supabase, profile.id)
      } catch {
        return Response.json({ error: "We couldn't start that upload." }, { status: 500 })
      }
      if (used >= FREE_VISUAL_UPLOADS) return overQuota()
    }

    // Two random segments and nothing else. This string ends up inside every
    // signed URL a reader is given, so it must say nothing about whose file it
    // is.
    const path = `${crypto.randomUUID()}/${crypto.randomUUID()}.${kind.ext}`

    const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path)
    if (error || !data) {
      console.error('[career-profile] Signed upload URL failed:', error)
      return Response.json({ error: "We couldn't start that upload." }, { status: 500 })
    }

    const response = {
      path,
      ticket: issueTicket(path, user.id),
      token: data.token,
      signed_url: data.signedUrl,
      content_type: kind.mime
    }

    // A video gets somewhere to put the frame the owner chose. Its own object
    // with its own ticket, beside the video rather than inside its path, so
    // neither one can be finalised by anybody who did not start it.
    const posterType = POSTER_TYPES[String(body?.poster_content_type || '').toLowerCase()]
    if (kind.media_class === 'video' && posterType) {
      const posterPath = `${path.replace(/\.[^.]+$/, '')}-frame.${posterType}`
      const { data: posterUpload, error: posterError } = await supabase.storage
        .from(BUCKET)
        .createSignedUploadUrl(posterPath)
      // Never fatal. A video with no poster is a video with the play mark on a
      // plain mat, which is what every video had before this existed.
      if (posterError || !posterUpload) {
        console.error('[career-profile] Poster upload URL failed (non-fatal):', posterError)
      } else {
        response.poster_path = posterPath
        response.poster_ticket = issueTicket(posterPath, user.id)
        response.poster_signed_url = posterUpload.signedUrl
        response.poster_content_type = Object.keys(POSTER_TYPES)
          .find(mime => POSTER_TYPES[mime] === posterType)
      }
    }

    return Response.json(response)
  } catch (error) {
    console.error('[career-profile] Upload start failed:', error)
    return Response.json({ error: "We couldn't start that upload." }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// A thumbnail, or nothing.
//
// Deliberately never fatal. A file that sharp will not decode is still a file
// the owner uploaded and still renders with its media icon; refusing the whole
// item because its preview failed would throw away the upload to fix the
// picture of it.
// ---------------------------------------------------------------------------
// `source` is the object to read pixels from and `namedFor` is the object the
// thumbnail belongs to. For a photograph they are the same file. For a video
// they are not: the pixels come from the frame the browser captured, and the
// thumbnail is named after the video so the two live together and are removed
// together.
async function makeThumbnail(supabase, source, namedFor = source) {
  try {
    const { data: blob, error } = await supabase.storage.from(BUCKET).download(source)
    if (error || !blob) return null

    const input = Buffer.from(await blob.arrayBuffer())

    // Imported here rather than at module scope: sharp is a native binary, and
    // the routes that never make a thumbnail should not pay to load it.
    const { default: sharp } = await import('sharp')

    const output = await sharp(input, {
      limitInputPixels: MAX_DECODED_PIXELS,
      sequentialRead: true,
      // An animated image becomes one frame. A thumbnail that plays is not a
      // thumbnail, and decoding every frame is work nobody asked for.
      animated: false
    })
      .rotate()              // honour EXIF orientation, then drop it
      .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
      .webp({ quality: THUMB_QUALITY })
      .toBuffer()

    const thumbPath = `${namedFor.replace(/\.[^.]+$/, '')}-thumb.webp`
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(thumbPath, output, { contentType: 'image/webp', upsert: true })
    if (upErr) {
      console.error('[career-profile] Thumbnail upload failed:', upErr)
      return null
    }
    return thumbPath
  } catch (error) {
    console.error('[career-profile] Thumbnail generation failed (non-fatal):', error)
    return null
  }
}

// ---------------------------------------------------------------------------
// The frame a browser chose, turned into a thumbnail this server made.
//
// Never fatal, for the same reason image thumbnails are not: a video with no
// preview is still the video the owner uploaded, and refusing the whole item
// because its poster failed would throw away a 50MB upload to fix a picture.
//
// The poster object is temporary in every case. It is read once, re-encoded,
// and removed - whether that worked or not - so the bucket never accumulates
// raw canvas exports, and nothing but the server's own webp is ever signed.
// ---------------------------------------------------------------------------
async function posterThumbnail(supabase, body, userId, videoPath) {
  const posterPath = typeof body?.poster_path === 'string' ? body.poster_path : ''
  if (!posterPath) return null

  // The same gate the video itself passes. Without it, a caller could name any
  // object in the bucket and have its pixels published as their thumbnail.
  if (!ticketValid(body?.poster_ticket, posterPath, userId)) {
    console.error('[career-profile] Poster ticket rejected')
    return null
  }

  try {
    const { data: info } = await supabase.storage.from(BUCKET).info(posterPath)
    // What storage holds, not what was claimed: it has to be an image, and it
    // has to be small enough to be a still rather than a second payload.
    const type = String(info?.contentType || '').split(';')[0].trim().toLowerCase()
    if (!info || !POSTER_TYPES[type] || Number(info.size) > MAX_POSTER_BYTES) {
      await supabase.storage.from(BUCKET).remove([posterPath])
      return null
    }
    // Named for the video, so the pair is removed together when the item is.
    return await makeThumbnail(supabase, posterPath, videoPath)
  } catch (error) {
    console.error('[career-profile] Poster handling failed (non-fatal):', error)
    return null
  } finally {
    // The export itself is never kept. makeThumbnail has already read it.
    await supabase.storage.from(BUCKET).remove([posterPath]).catch(() => {})
  }
}

// ---------------------------------------------------------------------------
// PUT - the file is there, so make the record
// ---------------------------------------------------------------------------
export async function PUT(request) {
  try {
    const ctx = await owner(request)
    if (ctx.error) return ctx.error
    const { supabase, user, profile } = ctx

    let body
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'Invalid request.' }, { status: 400 })
    }

    const path = typeof body?.path === 'string' ? body.path : ''

    // The check that makes the path safe to act on. The path itself names
    // nobody, so it proves nothing on its own; the ticket is what says this
    // server handed this path to this user. Without it, a caller who learned
    // any path could attach it to their own profile.
    if (!path || !ticketValid(body?.ticket, path, user.id)) {
      return Response.json({ error: 'Not found.' }, { status: 404 })
    }

    // One object, one record. A ticket is valid for its whole hour, so sending
    // the same one twice would make a second row pointing at the same file -
    // and then deleting either one would take the file out from under the
    // other. Refused rather than deduplicated, because the second request is a
    // mistake and answering it with the first row's id would hide that.
    const { data: already } = await supabase
      .from('profile_evidence')
      .select('id')
      .eq('storage_path', path)
      .is('deleted_at', null)
      .maybeSingle()
    if (already) {
      return Response.json(
        { error: 'That file has already been added.', code: 'ALREADY_ADDED' },
        { status: 409 }
      )
    }

    // What storage actually holds, rather than what the browser says it put
    // there. This is the size and the type that reach the row.
    const { data: info, error: infoError } = await supabase.storage.from(BUCKET).info(path)
    if (infoError || !info) {
      return Response.json(
        { error: "That upload didn't finish. Please try again.", code: 'NO_OBJECT' },
        { status: 404 }
      )
    }

    const kind = uploadTypeFor(info.contentType)
    if (!kind) {
      // The bucket should have refused this on the way in. If it is here
      // anyway, it does not get a row, and it does not stay.
      await supabase.storage.from(BUCKET).remove([path])
      return Response.json(
        { error: 'That kind of file cannot be added yet.', code: 'BAD_TYPE' },
        { status: 400 }
      )
    }

    const size = Number(info.size)
    if (Number.isFinite(size) && size > MAX_UPLOAD_BYTES) {
      await supabase.storage.from(BUCKET).remove([path])
      return Response.json({ error: 'That file is larger than 50MB.', code: 'TOO_LARGE' }, { status: 400 })
    }

    // ---- THE FIELDS, same rules as a link ----
    const type = canonicalType(body?.evidence_type)
    const family = familyForType(body?.evidence_type)
    if (!type || !family) {
      return Response.json(
        { error: 'Choose what kind of evidence this is.', code: 'INVALID', field: 'evidence_type' },
        { status: 400 }
      )
    }

    const fields = {
      title: text(body?.title, LIMITS.title, 'A title', { required: true }),
      description: text(body?.description, LIMITS.description, 'The description'),
      organization: text(body?.organization, LIMITS.organization, 'The organisation'),
      date_label: text(body?.date_label, LIMITS.date_label, 'The date')
    }
    for (const [key, result] of Object.entries(fields)) {
      if (result.error) {
        return Response.json({ error: result.error, code: 'INVALID', field: key }, { status: 400 })
      }
    }

    if (body?.lens_ids !== undefined && !Array.isArray(body.lens_ids)) {
      return Response.json(
        { error: 'Choose which directions to show it in.', code: 'INVALID', field: 'lens_ids' },
        { status: 400 }
      )
    }
    const requested = Array.isArray(body?.lens_ids)
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
          { error: 'One of those directions is not on your profile.', code: 'BAD_LENS' },
          { status: 400 }
        )
      }
    }

    // ---- THE QUOTA, decided here ----
    // The POST refused early to save the bytes; this is the one that counts.
    // A caller who skipped the first step, or who filled the last slot from
    // another tab in between, is refused now - and the object goes with the
    // refusal, because a file with no row is a file nothing can ever find.
    const isVisual = kind.media_class === 'image' || kind.media_class === 'video'
    if (isVisual && !(await isEntitled(supabase, user.id))) {
      let used
      try {
        used = await visualUploadCount(supabase, profile.id)
      } catch {
        await supabase.storage.from(BUCKET).remove([path])
        return Response.json({ error: "We couldn't save that. Please try again." }, { status: 500 })
      }
      if (used >= FREE_VISUAL_UPLOADS) {
        await supabase.storage.from(BUCKET).remove([path])
        return overQuota()
      }
    }

    // ---- HOW LONG IT RUNS ----
    // The browser's reading, because nothing here can open a video container.
    // Taken only for a video, bounded, and rounded to whole seconds: it labels
    // a mat and nothing depends on it, so a value that is not a plausible
    // duration is dropped rather than argued with.
    let durationSeconds = null
    if (kind.media_class === 'video') {
      const given = Number(body?.duration_seconds)
      if (Number.isFinite(given) && given > 0 && given <= MAX_DURATION_SECONDS) {
        durationSeconds = Math.round(given)
      }
    }

    // ---- THE PREVIEW ----
    // A photograph is its own preview. A video's preview is the frame the
    // owner picked, which arrived as a second object and is re-encoded through
    // the same pipeline before anything points at it.
    let thumbnailPath = null
    if (kind.media_class === 'image') {
      thumbnailPath = await makeThumbnail(supabase, path)
    } else if (kind.media_class === 'video') {
      thumbnailPath = await posterThumbnail(supabase, body, user.id, path)
    }

    // ---- THE ROW ----
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
        kind: family,
        media_class: kind.media_class,
        title: fields.title.value,
        description: fields.description.value,
        organization: fields.organization.value,
        date_label: fields.date_label.value,
        source_type: 'upload',
        storage_path: path,
        thumbnail_path: thumbnailPath,
        mime_type: kind.mime,
        file_size: Number.isFinite(size) ? size : null,
        duration_seconds: durationSeconds,
        privacy: 'public',
        status: 'published',
        sort_order: (lastItem?.sort_order ?? -1) + 1
      })
      .select(RETURNED)
      .maybeSingle()

    if (insertError || !created) {
      console.error('[career-profile] Upload row insert failed:', insertError)
      // The file has no record pointing at it, so it is not evidence and not
      // anything else. Leaving it would be leaving somebody's document in a
      // bucket with nothing to ever find or delete it by.
      await supabase.storage.from(BUCKET).remove(thumbnailPath ? [path, thumbnailPath] : [path])
      return Response.json({ error: "We couldn't save that. Please try again." }, { status: 500 })
    }

    let placements = []
    if (lensIds.length > 0) {
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
          sort_order: nextFor.get(lensId),
          featured: false
        })))
        .select('id, evidence_id, lens_id, sort_order, featured')

      if (placementError) {
        console.error('[career-profile] Placement insert failed:', placementError)
        return Response.json({
          evidence: created,
          placements: [],
          warning: "Saved, but we couldn't place it in those directions. You can assign it below."
        })
      }
      placements = madePlacements || []
    }

    // storage_path and thumbnail_path are not in RETURNED, so what goes back
    // says an upload exists without saying where it is.
    return Response.json({
      evidence: { ...created, has_file: true, has_thumbnail: Boolean(thumbnailPath) },
      placements
    })
  } catch (error) {
    console.error('[career-profile] Upload finalise failed:', error)
    return Response.json({ error: "We couldn't save that. Please try again." }, { status: 500 })
  }
}
