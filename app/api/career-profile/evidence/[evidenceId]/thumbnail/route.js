import { createClient } from '@supabase/supabase-js'
import { apiError } from '@/lib/apiError'
import { isUuid } from '../../../_lib/placements'

const MEDIA_BUCKET = 'profile-media'

// The public media route's number, because this is the same object signed for
// the same length of time. If it changes there, change it here.
const SIGNED_URL_TTL_SECONDS = 600

// ============================================================================
// GET /api/career-profile/evidence/[evidenceId]/thumbnail
//
// A signed link to one item's thumbnail, for the owner looking at their own
// Manage panel.
//
// WHY THIS EXISTS AND THE PUBLIC ROUTE WAS NOT WIDENED
// [slug]/evidence/[evidenceId] answers a different question: may a stranger
// holding this link, reading through this Career Direction, be served this
// file. Everything it does is in service of saying no - the profile has to be
// published, the row has to be public and published, the direction has to be
// one the plan shows, and the item has to be in that direction's effective
// set.
//
// The Manage panel asks none of that. It is the owner, looking at everything
// they have: the private items, and the ones no direction is showing, which
// are precisely the rows the public route is built to refuse. Those rows were
// drawing their icon and spending a 404 to find out.
//
// Relaxing the public route to let them through would mean putting an "unless
// the caller is the owner" branch through the middle of the one route whose
// whole job is withholding - which is how a flag that defaults wrong publishes
// a draft. So this is a second route that asks one question instead, and the
// public one is untouched.
//
// WHOSE THUMBNAIL THIS IS
// The token's. The id in the path is matched together with the caller's user
// id, so an id belonging to somebody else is a 404 and not a signature - the
// same pairing the PATCH and DELETE beside this file use, and for the same
// reason: the service role sees every row, and this is the only thing between
// a uuid and another person's material.
//
// THUMBNAILS ONLY, AND NO FALLING BACK TO THE FILE
// A thumbnail request is a request for a small object and must not be
// answered with a large one. A row with no thumbnail is a 404 here, which is
// what the public route does and what the component expects - it draws the
// item's mark instead.
//
// This signs no other variant. The owner's management surface shows small
// squares; opening a file in full is the viewer's job, and the viewer runs on
// the public payload through the route that checks publication.
//
// NO TIER GATE
// Reading your own material is not the paid half. Putting new content on a
// profile is, and every route that does that gates on requireCustomise. This
// one reads.
// ============================================================================

const notFound = () => Response.json({ error: 'NOT_FOUND' }, { status: 404 })

export async function GET(request, { params }) {
  try {
    const { evidenceId } = await params
    // A malformed id is answered before the database is asked anything.
    if (!isUuid(evidenceId)) return notFound()

    const authHeader = request.headers.get('authorization')
    if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data: { user }, error: authError } =
      await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    // Id and owner together. Either alone is wrong: the id alone signs
    // whoever's item was named, the owner alone has no item.
    //
    // Deleted rows are excluded, the way every other owner route excludes
    // them. A soft-deleted item is gone from the Manage panel, so nothing
    // asks - and if something did, it is not a row to be handing links to.
    const { data: item } = await supabase
      .from('profile_evidence')
      .select('id, media_class, mime_type, thumbnail_path')
      .eq('id', evidenceId)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle()

    if (!item?.thumbnail_path) return notFound()

    const { data: signed, error: signError } = await supabase.storage
      .from(MEDIA_BUCKET)
      .createSignedUrl(item.thumbnail_path, SIGNED_URL_TTL_SECONDS)

    if (signError || !signed?.signedUrl) {
      // An item whose object has gone is not an error the owner needs
      // explaining. The square keeps its mark.
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
        // shared cache holding this would be handing one owner's signed URL
        // to the next, and a stale one outliving its signature would be
        // worse.
        headers: { 'Cache-Control': 'private, no-store' }
      }
    )
  } catch (error) {
    return apiError(error, "We couldn't open that thumbnail right now.")
  }
}
