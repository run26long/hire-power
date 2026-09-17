import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { issueTicket, ticketValid } from '../../_lib/uploadTicket'

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
// SIXTEEN BY NINE IS CHECKED IN THE BROWSER AND NOWHERE ELSE
// There is no ffprobe here and sharp does not read video containers, so the
// server cannot know a file's dimensions without parsing MP4 boxes by hand.
// The editor checks before uploading and says so plainly. The public frame is
// aspect-ratio 16/9 with object-fit contain, so a video that gets past that
// check letterboxes inside the frame rather than breaking the column: the
// failure is an ugly video, not a broken page.
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

  const { data: profile } = await supabase
    .from('career_profiles')
    .select('id, imow_text, imow_type, imow_video_path')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!profile) return { error: Response.json({ error: 'No profile.' }, { status: 404 }) }

  return { supabase, user, profile }
}

// Pro only, the same question the rest of the product asks. Video is the one
// half of this section that is gated; the text half never has been.
async function isPro(supabase, userId) {
  const { data } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', userId)
    .maybeSingle()
  return data?.subscription_tier === 'pro'
}

export async function POST(request) {
  try {
    const ctx = await owner(request)
    if (ctx.error) return ctx.error
    const { supabase, user } = ctx

    if (!await isPro(supabase, user.id)) {
      return Response.json({ error: 'Video is a Pro feature.', code: 'PRO_REQUIRED' }, { status: 403 })
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

    return Response.json({
      path,
      ticket: issueTicket(path, user.id),
      signed_url: data.signedUrl,
      content_type: kind.mime
    })
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

    if (!await isPro(supabase, user.id)) {
      return Response.json({ error: 'Video is a Pro feature.', code: 'PRO_REQUIRED' }, { status: 403 })
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

    const { data: updated, error: updateError } = await supabase
      .from('career_profiles')
      .update({ imow_video_path: path, imow_type: 'video' })
      .eq('user_id', user.id)
      .select('imow_type, imow_text')
      .maybeSingle()

    if (updateError || !updated) {
      console.error('[career-profile] IMOW video update failed:', updateError)
      await supabase.storage.from(BUCKET).remove([path])
      return Response.json({ error: "We couldn't save that. Please try again." }, { status: 500 })
    }

    // After the column has been repointed, never before: deleting first and
    // then failing would leave a profile pointing at a file that is gone.
    if (previous && previous !== path) {
      await supabase.storage.from(BUCKET).remove([previous])
    }

    // The path itself is not returned. The editor asks the signing route for a
    // URL the same way a reader does.
    return Response.json({
      imow_type: updated.imow_type,
      imow_has_video: true,
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
    if (!previous) return Response.json({ imow_type: profile.imow_type, imow_has_video: false })

    // Where the section goes when the video leaves. Text if there is text,
    // and nothing at all if there is not - a profile whose type says video
    // with no file would render an empty frame.
    const nextType = profile.imow_text ? 'text' : null

    const { data: updated, error: updateError } = await supabase
      .from('career_profiles')
      .update({ imow_video_path: null, imow_type: nextType })
      .eq('user_id', user.id)
      .select('imow_type, imow_text')
      .maybeSingle()

    if (updateError || !updated) {
      console.error('[career-profile] IMOW video removal failed:', updateError)
      return Response.json({ error: "We couldn't remove that. Please try again." }, { status: 500 })
    }

    // The column is clear, so nothing can reach this object. Removed after the
    // update for the same reason it is on the way in.
    await supabase.storage.from(BUCKET).remove([previous])

    return Response.json({ imow_type: updated.imow_type, imow_has_video: false })
  } catch (error) {
    console.error('[career-profile] IMOW video delete failed:', error)
    return Response.json({ error: "We couldn't remove that. Please try again." }, { status: 500 })
  }
}
