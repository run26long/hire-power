import { createClient } from '@supabase/supabase-js'
import { canUseProTools } from '@/lib/tiers'

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
// the URLs and nothing else - no storage path, no user id, no profile id.
//
// THE POSTER COMES BACK WITH IT
// One request rather than two, because they are needed at the same moment and
// by the same element: the poster is what the frame shows until somebody
// presses play, and for a portrait video it is also the blurred fill either
// side of it. It is signed for the same two hours; a dead poster costs a
// still, not a video.
//
// A profile whose database has not had scripts/add-imow-video-shape.sql run
// has no poster column to read. The select is tried with it and retried
// without, and the answer is simply a video with no poster - which is what
// every one of these was until the column existed.
// ============================================================================

const BUCKET = 'profile-media'
const SIGNED_URL_TTL_SECONDS = 2 * 60 * 60

// PostgREST reports an unknown column as 42703 on a select. imow_poster_path
// is newer than this table, so the select is tried in full and retried with
// the columns that have always existed rather than failing the video.
function isMissingColumnError(error) {
  if (!error) return false
  return error.code === '42703' || error.code === 'PGRST204'
}

const notFound = () => Response.json({ error: 'NOT_FOUND' }, { status: 404 })

export async function GET(request, { params }) {
  try {
    const { slug } = await params
    if (!slug) return notFound()

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const BASE = 'id, user_id, is_published, imow_type, imow_video_path'
    let { data: profile, error } = await supabase
      .from('career_profiles')
      .select(`${BASE}, imow_poster_path`)
      .eq('slug', slug)
      .maybeSingle()

    if (isMissingColumnError(error)) {
      ;({ data: profile, error } = await supabase
        .from('career_profiles')
        .select(BASE)
        .eq('slug', slug)
        .maybeSingle())
    }

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

    // ---- AND THE PLAN, FOR EVERYBODY BUT THE OWNER ----
    //
    // The document route stopped sending the video on a free profile, and
    // this is the other way to the same object: it is addressed by slug and
    // signs on its own, so a reader who kept the URL - or simply called it -
    // would still be handed the file the page had stopped offering. The two
    // have to agree, so this asks the same question.
    //
    // The owner is excepted on purpose, and unlike in the document route it
    // matters here: In My Own Words keeps both halves, the editor shows the
    // owner the video they uploaded whatever their plan is, and the only way
    // it can play it is for this to sign it. imow_type is untouched by the
    // plan, so a lapsed account still reads as the video half here.
    if (!isOwner) {
      const { data: account } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', profile.user_id)
        .maybeSingle()
      if (!canUseProTools(account?.subscription_tier)) return notFound()
    }

    const { data: signed, error: signError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(profile.imow_video_path, SIGNED_URL_TTL_SECONDS)

    if (signError || !signed?.signedUrl) {
      // A column pointing at an object that has gone is not something a reader
      // needs explained. The section falls back to text.
      return notFound()
    }

    // Signed separately and never required. A poster that will not sign is a
    // frame the browser fills itself, which is what it did before there were
    // any posters at all.
    let posterUrl = null
    if (profile.imow_poster_path) {
      const { data: signedPoster } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(profile.imow_poster_path, SIGNED_URL_TTL_SECONDS)
      posterUrl = signedPoster?.signedUrl || null
    }

    return Response.json(
      { url: signed.signedUrl, poster_url: posterUrl, expires_in: SIGNED_URL_TTL_SECONDS },
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
