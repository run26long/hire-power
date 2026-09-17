import { createClient } from '@supabase/supabase-js'

// ============================================================================
// GET /api/career-profile/[slug]/imow-video
//
// A signed link to the In My Own Words video, for anybody reading a published
// profile. No authentication: the slug is the key, exactly as it is for the
// page the video sits on.
//
// WHY THIS IS NOT IN THE PROFILE PAYLOAD
// A signed URL has a life, and the payload the page holds does not. Putting
// one in /api/career-profile/[slug] would mean a reader who left the tab open
// came back to a dead link, and it would put a credential into a response that
// currently carries none and is safe to cache. So it is asked for separately,
// when the video is about to be played, the same way evidence is.
//
// WHY THE LIFE IS TWO HOURS AND NOT TEN MINUTES
// Evidence signing serves a click-to-open file: ten minutes is generous. A
// video is streamed, and a browser issues ranged requests across the whole of
// playback - so a reader who pauses, reads the rest of the page, and comes
// back to scrub would find the URL dead mid-seek, with no error a person could
// act on. Two hours covers any real visit, and the page re-signs once if the
// element errors anyway, so the ceiling is not load-bearing.
//
// FAIL CLOSED, THE SAME AS EVERYTHING ELSE HERE
// Unpublished, missing, or a profile whose type does not say video: 404. The
// path comes from the row and never from the request, and the response carries
// the URL and nothing else - no storage path, no user id, no profile id.
// ============================================================================

const BUCKET = 'profile-media'
const SIGNED_URL_TTL_SECONDS = 2 * 60 * 60

const notFound = () => Response.json({ error: 'NOT_FOUND' }, { status: 404 })

export async function GET(request, { params }) {
  try {
    const { slug } = await params
    if (!slug) return notFound()

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data: profile, error } = await supabase
      .from('career_profiles')
      .select('id, user_id, is_published, imow_type, imow_video_path')
      .eq('slug', slug)
      .maybeSingle()

    if (error) {
      console.error('[imow-video] Profile lookup failed:', error)
      return Response.json({ error: 'LOOKUP_FAILED' }, { status: 500 })
    }
    if (!profile) return notFound()

    // The owner sees their own draft, the same exception the profile route
    // makes, so the editor's preview works before anything is published.
    let isOwner = false
    const authHeader = request.headers.get('authorization')
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
      isOwner = Boolean(user && user.id === profile.user_id)
    }

    // `!== true` rather than `=== false`: anything that is not an explicit yes
    // is a no, which is the direction this should fail in.
    if (profile.is_published !== true && !isOwner) return notFound()

    // Both, not either. The type column takes any string - it accepts 'banana'
    // - and nothing guarantees that a profile claiming video has a file. A row
    // that says one and not the other is not a video.
    if (profile.imow_type !== 'video' || !profile.imow_video_path) return notFound()

    const { data: signed, error: signError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(profile.imow_video_path, SIGNED_URL_TTL_SECONDS)

    if (signError || !signed?.signedUrl) {
      // A column pointing at an object that has gone is not something a reader
      // needs explained. The section falls back to text.
      return notFound()
    }

    return Response.json(
      { url: signed.signedUrl, expires_in: SIGNED_URL_TTL_SECONDS },
      {
        // Never in a shared cache, and never outliving the signature it
        // carries: a cached copy would hand one reader's signed URL to the
        // next, and a stale one would be a link that no longer works.
        headers: { 'Cache-Control': 'private, no-store' }
      }
    )
  } catch (error) {
    console.error('[imow-video] Signing failed:', error?.message)
    return Response.json({ error: 'LOOKUP_FAILED' }, { status: 500 })
  }
}
