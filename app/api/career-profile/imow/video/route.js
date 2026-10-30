import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { issueTicket, ticketValid } from '../../_lib/uploadTicket'
import { storeImage } from '../../_lib/evidenceThumbnail'
import { canUseProTools } from '@/lib/tiers'

// ============================================================================
// POST   /api/career-profile/imow/video  - somewhere to put it
// PUT    /api/career-profile/imow/video  - it is there; point the profile at it
// DELETE /api/career-profile/imow/video  - take it down and remove the file
//
// The same three-step shape as the evidence upload, for the same reason: the
// browser sends the bytes straight to storage, so a 50MB video never enters a
// request body here. What differs is where it lands - one column on the
// profile rather than a row in a collection, so there is exactly one of these
// and replacing it means deleting what was there.
//
// THE PATH NAMES NOBODY
// Two random uuids and an extension. The signed URL that serves this video to
// an anonymous reader embeds the object path, so anything in the path is
// published to anyone who watches. Ownership is carried by the ticket instead.
//
// THE OLD FILE IS REMOVED WHEN A NEW ONE LANDS
// A replaced video is not evidence of anything and nobody can reach it: the
// column holds one path, and the previous object would sit in the bucket with
// nothing pointing at it and no way to find it again. So it goes, after the
// column has been repointed rather than before - a failed update that had
// already deleted the old file would leave a profile pointing at nothing.
//
// ANY ORIENTATION, AND THE SHAPE IS TOLD TO US
// This used to take landscape only, enforced in the browser, because the page
// drew a fixed 16/9 frame. It takes portrait and square now, which means the
// page has to know the shape before the file loads or the card resizes under
// the reader a second after the page settles.
//
// There is still no ffprobe here and sharp still does not open video
// containers, so the server cannot work the shape out. The browser that is
// about to upload the file already knows - it read videoWidth and videoHeight
// off a <video> element to show a preview - so it says, and that claim is
// bounded here rather than trusted: two integers inside a sane range or
// nothing at all. The worst a lie achieves is a frame of the wrong shape on
// the liar's own profile.
//
// THE POSTER IS A PICTURE THIS SERVER MADE
// Captured in the browser by the same VideoFramePicker the evidence gallery
// uses, uploaded as its own object, and then read, re-encoded and re-written
// here through storeImage - the one shared encoder, which proves the bytes
// are an image before anything is kept. The raw canvas export is removed
// either way, so the bucket never holds something a browser sent.
//
// None of it is ever fatal. A video with no poster is the video the owner
// uploaded with the browser's own first frame on it, which is what every one
// of these had until now.
// ============================================================================

const BUCKET = 'profile-media'

// What the bucket will hold and what a browser will play back reliably.
// video/quicktime is in the bucket and deliberately not here: .mov from a
// phone is frequently HEVC, which Chrome will not decode, so accepting it
// would mean uploads that succeed and then will not play.
const VIDEO_TYPES = {
  'video/mp4': 'mp4',
  'video/webm': 'webm'
}

const MAX_BYTES = 50 * 1024 * 1024

// What a browser may hand over as a captured frame. Narrow on purpose, and the
// same list the evidence upload uses: this is not a file somebody chose, it is
// a canvas export, so there is no reason to accept anything but what a canvas
// produces.
const POSTER_TYPES = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' }

// A still of something already capped at 50MB. Well above any real canvas
// export, and low enough that the poster slot cannot be used to park a large
// file that never becomes anything.
const MAX_POSTER_BYTES = 8 * 1024 * 1024

// Past 8K on either axis. A rail against a number that did not come from a
// decoder, not a product limit - the shape itself is not policed at all.
const MAX_EDGE = 16384

// PostgREST reports an unknown column in a payload as PGRST204 and Postgres
// uses 42703. These three columns are newer than the table, so every write
// that names them is tried once and retried without them rather than failing
// a 50MB upload over a migration nobody has run yet.
function isMissingColumnError(error) {
  if (!error) return false
  return error.code === 'PGRST204' || error.code === '42703'
}

// Two integers or nothing. A width with no height is not a shape, and a page
// dividing by a null is a page with no layout.
function videoShape(body) {
  const width = Number(body?.width)
  const height = Number(body?.height)
  const ok = (n) => Number.isInteger(n) && n > 0 && n <= MAX_EDGE
  if (!ok(width) || !ok(height)) return null
  return { imow_video_width: width, imow_video_height: height }
}

const service = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

function videoType(contentType) {
  if (typeof contentType !== 'string') return null
  const bare = contentType.split(';')[0].trim().toLowerCase()
  return VIDEO_TYPES[bare] ? { mime: bare, ext: VIDEO_TYPES[bare] } : null
}

async function owner(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return { error: Response.json({ error: 'Unauthorized' }, { status: 401 }) }

  const supabase = service()
  const { data: { user }, error } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (error || !user) return { error: Response.json({ error: 'Unauthorized' }, { status: 401 }) }

  // The poster column rides in the optional half: a database that has not had
  // scripts/add-imow-video-shape.sql run returns 42703 for it, and the retry
  // reads everything else. Nothing here needs the poster to do its job; it is
  // read so a replaced or deleted video can take its still with it.
  const BASE = 'id, imow_text, imow_type, imow_video_path'
  let { data: profile, error: profileError } = await supabase
    .from('career_profiles')
    .select(`${BASE}, imow_poster_path`)
    .eq('user_id', user.id)
    .maybeSingle()

  if (isMissingColumnError(profileError)) {
    ;({ data: profile } = await supabase
      .from('career_profiles')
      .select(BASE)
      .eq('user_id', user.id)
      .maybeSingle())
  }

  if (!profile) return { error: Response.json({ error: 'No profile.' }, { status: 404 }) }

  return { supabase, user, profile }
}

// The Career Profile's own question, asked through the one predicate that
// answers it, rather than by naming a plan here. Video is the one half of this
// section that is gated; the text half never has been.
async function mayRecord(supabase, userId) {
  const { data } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', userId)
    .maybeSingle()
  return canUseProTools(data?.subscription_tier)
}

// ---------------------------------------------------------------------------
// The frame a browser chose, turned into a still this server made.
//
// The same shape as the evidence upload's posterThumbnail, and deliberately
// so: the ticket gate, the check against what storage actually holds rather
// than what was claimed, the re-encode, and the removal of the raw export
// whether any of it worked or not. What it does NOT do is keep a second copy
// of the encoder - storeImage in _lib/evidenceThumbnail is the one place on
// this profile that turns bytes into a stored picture, and it is what proves
// the bytes are an image at all.
//
// Never fatal. A video with no poster is the video the owner uploaded with
// the browser's own first frame on it, and refusing a 50MB upload over a
// still would be the wrong trade by a wide margin.
//
// The re-encoded object is named for the video, so the pair is removed
// together when the video is replaced or taken down.
// ---------------------------------------------------------------------------
async function storePoster(supabase, body, userId, videoPath) {
  const rawPath = typeof body?.poster_path === 'string' ? body.poster_path : ''
  if (!rawPath) return null

  // The same gate the video itself passes. Without it, a caller could name any
  // object in the bucket and have its pixels published as their poster.
  if (!ticketValid(body?.poster_ticket, rawPath, userId)) {
    console.error('[career-profile] IMOW poster ticket rejected')
    return null
  }

  try {
    const { data: info } = await supabase.storage.from(BUCKET).info(rawPath)
    // What storage holds, not what was claimed: an image, and small enough to
    // be a still rather than a second payload.
    const type = String(info?.contentType || '').split(';')[0].trim().toLowerCase()
    if (!info || !POSTER_TYPES[type] || Number(info.size) > MAX_POSTER_BYTES) return null

    const { data: blob, error } = await supabase.storage.from(BUCKET).download(rawPath)
    if (error || !blob) return null

    const posterPath = `${videoPath.replace(/\.[^.]+$/, '')}-poster.webp`
    return await storeImage(supabase, Buffer.from(await blob.arrayBuffer()), posterPath)
  } catch (error) {
    console.error('[career-profile] IMOW poster handling failed (non-fatal):', error)
    return null
  } finally {
    // The canvas export itself is never kept, on any path through this.
    await supabase.storage.from(BUCKET).remove([rawPath]).catch(() => {})
  }
}

export async function POST(request) {
  try {
    const ctx = await owner(request)
    if (ctx.error) return ctx.error
    const { supabase, user } = ctx

    if (!await mayRecord(supabase, user.id)) {
      return Response.json({ error: 'Video is part of Vault and Pro.', code: 'PRO_REQUIRED' }, { status: 403 })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'Invalid request.' }, { status: 400 })
    }

    const kind = videoType(body?.content_type)
    if (!kind) {
      return Response.json(
        { error: 'Upload an MP4 or WebM video.', code: 'BAD_TYPE' },
        { status: 400 }
      )
    }

    // Advisory only: the real size is read off the stored object below, and
    // the bucket enforces its own cap regardless of what is claimed here.
    const declared = Number(body?.size)
    if (Number.isFinite(declared) && declared > MAX_BYTES) {
      return Response.json({ error: 'That video is larger than 50MB.', code: 'TOO_LARGE' }, { status: 400 })
    }

    const path = `${crypto.randomUUID()}/${crypto.randomUUID()}.${kind.ext}`

    const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path)
    if (error || !data) {
      console.error('[career-profile] IMOW video upload URL failed:', error)
      return Response.json({ error: "We couldn't start that upload." }, { status: 500 })
    }

    const response = {
      path,
      ticket: issueTicket(path, user.id),
      signed_url: data.signedUrl,
      content_type: kind.mime
    }

    // Somewhere for the captured frame, asked for alongside the video so both
    // objects exist before either is finalised and the row is written once.
    // Never fatal: a video with no poster is the video with the browser's own
    // first frame on it, which is what all of these had before.
    const posterExt = POSTER_TYPES[String(body?.poster_content_type || '').toLowerCase()]
    if (posterExt) {
      const posterPath = `${path.replace(/\.[^.]+$/, '')}-frame.${posterExt}`
      const { data: posterUpload, error: posterError } = await supabase.storage
        .from(BUCKET)
        .createSignedUploadUrl(posterPath)
      if (posterError || !posterUpload) {
        console.error('[career-profile] IMOW poster upload URL failed (non-fatal):', posterError)
      } else {
        response.poster_path = posterPath
        response.poster_ticket = issueTicket(posterPath, user.id)
        response.poster_signed_url = posterUpload.signedUrl
        response.poster_content_type = Object.keys(POSTER_TYPES)
          .find(mime => POSTER_TYPES[mime] === posterExt)
      }
    }

    return Response.json(response)
  } catch (error) {
    console.error('[career-profile] IMOW video start failed:', error)
    return Response.json({ error: "We couldn't start that upload." }, { status: 500 })
  }
}

export async function PUT(request) {
  try {
    const ctx = await owner(request)
    if (ctx.error) return ctx.error
    const { supabase, user, profile } = ctx

    if (!await mayRecord(supabase, user.id)) {
      return Response.json({ error: 'Video is part of Vault and Pro.', code: 'PRO_REQUIRED' }, { status: 403 })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'Invalid request.' }, { status: 400 })
    }

    const path = typeof body?.path === 'string' ? body.path : ''
    if (!path || !ticketValid(body?.ticket, path, user.id)) {
      return Response.json({ error: 'Not found.' }, { status: 404 })
    }

    // What storage holds, not what the browser says it put there.
    const { data: info, error: infoError } = await supabase.storage.from(BUCKET).info(path)
    if (infoError || !info) {
      return Response.json(
        { error: "That upload didn't finish. Please try again.", code: 'NO_OBJECT' },
        { status: 404 }
      )
    }

    const kind = videoType(info.contentType)
    if (!kind) {
      await supabase.storage.from(BUCKET).remove([path])
      return Response.json({ error: 'Upload an MP4 or WebM video.', code: 'BAD_TYPE' }, { status: 400 })
    }

    const size = Number(info.size)
    if (Number.isFinite(size) && size > MAX_BYTES) {
      await supabase.storage.from(BUCKET).remove([path])
      return Response.json({ error: 'That video is larger than 50MB.', code: 'TOO_LARGE' }, { status: 400 })
    }

    const previous = profile.imow_video_path
    const previousPoster = profile.imow_poster_path || null

    // The frame the browser captured, proved and re-encoded by this server.
    // Before the column write, so the path is either real or absent by the
    // time the row is touched.
    const posterPath = await storePoster(supabase, body, user.id, path)

    // A FIRST video is choosing it. A REPLACEMENT is not.
    //
    // This used to set imow_type to 'video' on every upload, which meant an
    // owner whose profile was showing their paragraph could swap the file
    // behind their video - a file nobody was being shown - and find the
    // paragraph had come off the profile. Only the owner's own "Show this on
    // my profile" is supposed to move that line.
    //
    // So a replacement keeps whatever was live, with one correction: a stored
    // choice of 'text' with no text behind it cannot be honoured, and the
    // video is the only half left to show.
    //
    // The written text is untouched either way - the two live in their own
    // columns and neither write path has ever cleared the other.
    const keepType = profile.imow_type === 'text' && profile.imow_text ? 'text' : 'video'
    const core = { imow_video_path: path, imow_type: previous ? keepType : 'video' }
    const extra = {
      ...(videoShape(body) || {}),
      ...(posterPath ? { imow_poster_path: posterPath } : {})
    }

    let { data: updated, error: updateError } = await supabase
      .from('career_profiles')
      .update({ ...core, ...extra })
      .eq('user_id', user.id)
      .select('imow_type, imow_text')
      .maybeSingle()

    // The three shape columns are newer than the table. A database without
    // them takes the video and loses only the shape and the poster, which is
    // exactly how this behaved before they existed.
    if (isMissingColumnError(updateError)) {
      console.warn('[career-profile] No imow video shape columns. Has scripts/add-imow-video-shape.sql been run?')
      ;({ data: updated, error: updateError } = await supabase
        .from('career_profiles')
        .update(core)
        .eq('user_id', user.id)
        .select('imow_type, imow_text')
        .maybeSingle())
      if (posterPath) await supabase.storage.from(BUCKET).remove([posterPath]).catch(() => {})
    }

    if (updateError || !updated) {
      console.error('[career-profile] IMOW video update failed:', updateError)
      await supabase.storage.from(BUCKET).remove([path])
      if (posterPath) await supabase.storage.from(BUCKET).remove([posterPath]).catch(() => {})
      return Response.json({ error: "We couldn't save that. Please try again." }, { status: 500 })
    }

    // After the column has been repointed, never before: deleting first and
    // then failing would leave a profile pointing at a file that is gone.
    if (previous && previous !== path) {
      await supabase.storage.from(BUCKET).remove([previous])
    }
    // And the still that belonged to it. Named for the video it was taken
    // from, so a replacement never leaves the old face behind the new film.
    if (previousPoster && previousPoster !== posterPath) {
      await supabase.storage.from(BUCKET).remove([previousPoster]).catch(() => {})
    }

    // Neither path is returned. The editor asks the signing route for URLs the
    // same way a reader does.
    return Response.json({
      imow_type: updated.imow_type,
      imow_has_video: true,
      has_poster: Boolean(posterPath),
      file_size: Number.isFinite(size) ? size : null
    })
  } catch (error) {
    console.error('[career-profile] IMOW video finalise failed:', error)
    return Response.json({ error: "We couldn't save that. Please try again." }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const ctx = await owner(request)
    if (ctx.error) return ctx.error
    const { supabase, user, profile } = ctx

    // Deliberately not Pro-gated. An account that lapses must still be able to
    // take its own video down; gating removal would leave somebody's face on a
    // public page behind a paywall.
    const previous = profile.imow_video_path
    const previousPoster = profile.imow_poster_path || null
    if (!previous) return Response.json({ imow_type: profile.imow_type, imow_has_video: false })

    // Where the section goes when the video leaves. Text if there is text,
    // and nothing at all if there is not - a profile whose type says video
    // with no file would render an empty frame.
    const nextType = profile.imow_text ? 'text' : null

    const core = { imow_video_path: null, imow_type: nextType }

    let { data: updated, error: updateError } = await supabase
      .from('career_profiles')
      .update({ ...core, imow_poster_path: null, imow_video_width: null, imow_video_height: null })
      .eq('user_id', user.id)
      .select('imow_type, imow_text')
      .maybeSingle()

    if (isMissingColumnError(updateError)) {
      ;({ data: updated, error: updateError } = await supabase
        .from('career_profiles')
        .update(core)
        .eq('user_id', user.id)
        .select('imow_type, imow_text')
        .maybeSingle())
    }

    if (updateError || !updated) {
      console.error('[career-profile] IMOW video removal failed:', updateError)
      return Response.json({ error: "We couldn't remove that. Please try again." }, { status: 500 })
    }

    // The columns are clear, so nothing can reach either object. Removed after
    // the update for the same reason they are on the way in.
    await supabase.storage.from(BUCKET).remove([previous])
    if (previousPoster) await supabase.storage.from(BUCKET).remove([previousPoster]).catch(() => {})

    return Response.json({ imow_type: updated.imow_type, imow_has_video: false })
  } catch (error) {
    console.error('[career-profile] IMOW video delete failed:', error)
    return Response.json({ error: "We couldn't remove that. Please try again." }, { status: 500 })
  }
}
