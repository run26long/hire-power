import { createClient } from '@supabase/supabase-js'
import { apiError } from '@/lib/apiError'

const MEDIA_BUCKET = 'profile-media'

// Long enough to open a document and read it, short enough that a copied link
// is not a lasting one. The same reasoning the interview recordings use.
const SIGNED_URL_TTL_SECONDS = 600

// ============================================================================
// GET /api/career-profile/[slug]/evidence/[evidenceId]?variant=file|thumbnail
//
// Hands back a temporary link to one uploaded piece of evidence.
//
// profile-media is private and stays private. Nothing on the public profile
// ever holds a storage path, and this route will not take one: the caller says
// which profile and which evidence id, and the path is read from the row here.
// A browser cannot ask for an arbitrary object in the bucket because it has no
// way to name one.
//
// Eligibility is decided again, from scratch, on every call. The page having
// decided an item was showable is not evidence of anything - this route is
// reachable directly, so it re-asks every question the payload asked:
//
//   the profile is published, and this is the profile that owns the row
//   the row is public, published and not deleted
//   the named direction belongs to this profile and is publicly visible
//   the row is in THAT direction's effective set
//
// The last one is the point. "Placed somewhere on this profile" is not an
// answer to "may this direction show it": a reader looking at Business
// Development must not be able to sign a file that only Manufacturing was
// given, and an id is trivially guessable from the payload of any direction
// that does carry it. So the direction comes in with the request and the
// effective set is worked out here:
//
//   a direction that has any placements of its own is exactly those
//   a direction with none of its own is the shared layer
//
// They are never merged. A direction that has made its own selection has said
// what it shows, and the shared layer is a fallback for directions that have
// not - treating it as an addition would quietly widen every curated set.
//
// Anything missing, private, draft, deleted, belonging to another profile, or
// outside the named direction's set is reported as not found. Which of those it
// was is not the caller's business, and saying would confirm that an id exists.
// ============================================================================

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// The directions a reader is allowed to be looking through. The same two the
// profile payload treats as visible; named once so the two cannot drift.
const VISIBLE_LENS_STATUS = ['active', 'suggested']

const notFound = () => Response.json({ error: 'NOT_FOUND' }, { status: 404 })

export async function GET(request, { params }) {
  try {
    const { slug, evidenceId } = await params
    if (!slug || !evidenceId) return notFound()

    // A malformed id is answered before the database is asked anything.
    if (!UUID.test(evidenceId)) return notFound()

    const query = new URL(request.url).searchParams
    const variant = query.get('variant') === 'thumbnail' ? 'thumbnail' : 'file'

    // The direction the reader is looking through. Malformed is refused here
    // rather than looked up; absent is decided below, once it is known whether
    // this profile has any directions to be looking through at all.
    const lensId = query.get('lens')
    if (lensId !== null && !UUID.test(lensId)) return notFound()

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data: profile, error: profileError } = await supabase
      .from('career_profiles')
      .select('id, is_published')
      .eq('slug', slug)
      .maybeSingle()

    if (profileError) {
      console.error('[evidence-media] Profile lookup failed:', profileError)
      return Response.json({ error: 'LOOKUP_FAILED' }, { status: 500 })
    }
    // `!== true`, not `=== false`: a flag that is null or absent read as
    // published here, which was the one place in the profile's routes where
    // anything but an explicit no let a caller through.
    if (!profile || profile.is_published !== true) return notFound()

    // Scoped to this profile in the query itself, so another profile's evidence
    // is not something this route can be talked into reading.
    const { data: item, error: itemError } = await supabase
      .from('profile_evidence')
      .select('id, media_class, mime_type, storage_path, thumbnail_path, source_type')
      .eq('id', evidenceId)
      .eq('profile_id', profile.id)
      .eq('privacy', 'public')
      .eq('status', 'published')
      .is('deleted_at', null)
      .maybeSingle()

    if (itemError) {
      console.error('[evidence-media] Evidence lookup failed:', itemError)
      return Response.json({ error: 'LOOKUP_FAILED' }, { status: 500 })
    }
    if (!item) return notFound()

    // ---- The direction, and what it is allowed to show ----
    //
    // The lens is checked against this profile in the query, so a real lens id
    // belonging to somebody else's profile is simply not found, and so is one
    // this profile keeps hidden.
    const { data: visibleLenses, error: lensError } = await supabase
      .from('profile_lenses')
      .select('id')
      .eq('profile_id', profile.id)
      .in('status', VISIBLE_LENS_STATUS)

    if (lensError) {
      console.error('[evidence-media] Lens lookup failed:', lensError)
      return Response.json({ error: 'LOOKUP_FAILED' }, { status: 500 })
    }

    const shownLensIds = new Set((visibleLenses || []).map(lens => lens.id))

    // A profile with directions has to be read through one of them. The only
    // request without a lens that means anything is one to a profile that has
    // no visible directions at all, which is the case the page itself renders
    // straight from the shared layer.
    if (lensId === null) {
      if (shownLensIds.size > 0) return notFound()
    } else if (!shownLensIds.has(lensId)) {
      return notFound()
    }

    // The direction's own placements, and the shared layer, read separately -
    // because which of the two applies depends on whether the first has any
    // rows at all, and that question cannot be answered by a query filtered to
    // one evidence id.
    const [own, shared] = await Promise.all([
      lensId === null
        ? Promise.resolve({ data: [], error: null })
        : supabase
            .from('profile_evidence_placements')
            .select('evidence_id')
            .eq('profile_id', profile.id)
            .eq('lens_id', lensId),
      supabase
        .from('profile_evidence_placements')
        .select('evidence_id')
        .eq('profile_id', profile.id)
        .is('lens_id', null)
    ])

    if (own.error || shared.error) {
      console.error('[evidence-media] Placement lookup failed:', own.error || shared.error)
      return Response.json({ error: 'LOOKUP_FAILED' }, { status: 500 })
    }

    // One set or the other, never both.
    const effective = (own.data || []).length > 0 ? own.data : (shared.data || [])
    if (!effective.some(row => row.evidence_id === item.id)) return notFound()

    // The path comes from the row, never from the request. A thumbnail is only
    // signed where the row actually carries one; there is no falling back to
    // the source file, because a thumbnail request is not permission to hand
    // over the original.
    const path = variant === 'thumbnail' ? item.thumbnail_path : item.storage_path
    if (!path) return notFound()

    const { data: signed, error: signError } = await supabase.storage
      .from(MEDIA_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)

    if (signError || !signed?.signedUrl) {
      // An item whose object has gone is not an error the reader needs
      // explaining. The tile stays, the viewer shows what it knows.
      return notFound()
    }

    return Response.json(
      {
        url: signed.signedUrl,
        expires_in: SIGNED_URL_TTL_SECONDS,
        media_class: item.media_class,
        mime_type: item.mime_type || null
      },
      {
        // Private, and never cached past the life of the link it carries. A
        // shared cache holding this would be handing one reader's signed URL to
        // the next, and a stale one outliving its signature would be worse.
        headers: { 'Cache-Control': 'private, no-store' }
      }
    )
  } catch (error) {
    return apiError(error, "We couldn't open that piece of evidence right now.")
  }
}
