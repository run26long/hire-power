import { createClient } from '@supabase/supabase-js'
import { isEntitledTier } from '../_lib/recruiterContext'

// ============================================================================
// GET /api/career-profile/manage
//
// Everything the owner needs to see their own Career Profile in one request:
// the profile row, every direction, every piece of evidence including the
// drafts and the private ones, where each is placed, and the state of every
// testimonial they have asked for.
//
// WHOSE PROFILE THIS READS
// The token's. This takes no slug, no profile id and no user id: the service
// role sees every row, and an identifier from the browser would be the only
// thing between one person's session and another person's draft. The row is
// found from the authenticated user, the same way the contact route writes it.
//
// WHY IT IS NOT THE PUBLIC ROUTE WITH A FLAG
// The two answer opposite questions. `[slug]` decides what a stranger holding
// a link may see, and its whole job is to withhold: unpublished profiles,
// private evidence, draft testimonials, anything withdrawn. This one is the
// owner looking at their own material, so the drafts and the private items are
// exactly what it must return - they are the things that need managing. Making
// one route do both would mean one set of filters with an `if` through the
// middle of it, which is how a flag that defaults wrong publishes a draft.
//
// WHAT IT STILL WITHHOLDS, EVEN FROM THE OWNER
// Storage paths, in either table. The bucket is private and stays that way:
// when the management page needs to show an uploaded file it asks for a signed
// URL by id, the same as the public page already does, rather than holding a
// path it could hand to anything. What the owner actually needs to know is
// whether an item has a file at all, so that is what is sent - a boolean.
//
// Testimonial request tokens, too. A token is the capability that lets a
// stranger write against this profile. Nothing renders it, so nothing is sent
// it; when the owner needs to re-send a request, that will be a route that
// mails it, not a string in a JSON body.
//
// Read-only. There is no write in this file and there should not be one: each
// thing the page can change gets its own route, with its own validation, so a
// bug in one cannot reach the others.
// ============================================================================

// Named columns, never `select('*')`. The service role bypasses RLS, so a
// wildcard here would hand the browser whatever gets added to these tables
// next - including the two kinds of thing named above.
const PROFILE_COLS =
  'id, slug, is_published, template, color_mode, accent, ' +
  'imow_type, imow_text, imow_video_path, contact_email, created_at, updated_at'

const LENS_COLS =
  'id, name, slug, status, sort_order, source, core_resume_id, ' +
  'headline, bio, proof_points, ready_for_next, ready_tags, ' +
  'skill_emphasis, evidence_summary, created_at'

const EVIDENCE_COLS =
  'id, family, evidence_type, kind, media_class, title, description, ' +
  'organization, date_label, source_type, url, provider, embed_url, ' +
  'mime_type, file_size, privacy, status, sort_order, storage_path, ' +
  'thumbnail_path, created_at, updated_at'

const PLACEMENT_COLS = 'id, evidence_id, lens_id, sort_order, featured'

const TESTIMONIAL_COLS =
  'id, recipient_name, recipient_email, recipient_title, relationship, ' +
  'status, polished_text, lens_ids, created_at'

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const token = authHeader.replace('Bearer ', '')

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    // The account, for the nav and for what the page is allowed to offer.
    const { data: person } = await supabase
      .from('profiles')
      .select('display_name, photo_url, subscription_tier, search_status')
      .eq('id', user.id)
      .maybeSingle()

    const userProfile = {
      display_name: person?.display_name ?? null,
      photo_url: person?.photo_url ?? null,
      subscription_tier: person?.subscription_tier ?? null,
      search_status: person?.search_status ?? null
    }

    // ---- THE PROFILE ----
    const { data: profile, error: profileError } = await supabase
      .from('career_profiles')
      .select(PROFILE_COLS)
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError) {
      console.error('[career-profile/manage] Profile lookup failed:', profileError)
      return Response.json({ error: 'LOAD_FAILED' }, { status: 500 })
    }

    // Not an error. An account that has never generated a Career Profile has
    // no row, and the page has an empty state for exactly that - it is the
    // first thing a new owner sees rather than a failure they have to read.
    if (!profile) {
      return Response.json({
        userProfile,
        isPro: isEntitledTier(userProfile.subscription_tier),
        profile: null,
        lenses: [],
        evidence: [],
        placements: [],
        testimonials: []
      })
    }

    // ---- EVERYTHING UNDER IT ----
    // Every direction, not only the ones the public page shows: a suggested
    // direction the owner has not built yet is a thing to manage, and an
    // archived one is a thing to notice is archived.
    //
    // Every piece of evidence except the deleted ones. `deleted_at` is a soft
    // delete and means the owner removed it; bringing those back into the
    // manager would undo that decision on their behalf.
    const [lensRes, evidenceRes, placementRes, testimonialRes] = await Promise.all([
      supabase
        .from('profile_lenses')
        .select(LENS_COLS)
        .eq('profile_id', profile.id)
        .order('sort_order', { ascending: true }),
      supabase
        .from('profile_evidence')
        .select(EVIDENCE_COLS)
        .eq('profile_id', profile.id)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true }),
      supabase
        .from('profile_evidence_placements')
        .select(PLACEMENT_COLS)
        .eq('profile_id', profile.id)
        .order('sort_order', { ascending: true }),
      supabase
        .from('profile_testimonials')
        .select(TESTIMONIAL_COLS)
        .eq('profile_id', profile.id)
        .order('created_at', { ascending: false })
    ])

    const failed = [lensRes, evidenceRes, placementRes, testimonialRes].find(r => r.error)
    if (failed) {
      console.error('[career-profile/manage] Section load failed:', failed.error)
      return Response.json({ error: 'LOAD_FAILED' }, { status: 500 })
    }

    // The two paths are dropped here, at the edge, so nothing downstream has
    // to remember to. What survives is the one fact the page renders from
    // them: whether there is a file behind this item.
    const evidence = (evidenceRes.data || []).map(item => {
      const { storage_path, thumbnail_path, ...rest } = item
      return {
        ...rest,
        has_file: Boolean(storage_path),
        has_thumbnail: Boolean(thumbnail_path)
      }
    })

    const { imow_video_path, ...profileRest } = profile

    return Response.json({
      userProfile,
      isPro: isEntitledTier(userProfile.subscription_tier),
      profile: { ...profileRest, imow_has_video: Boolean(imow_video_path) },
      lenses: lensRes.data || [],
      evidence,
      placements: placementRes.data || [],
      testimonials: testimonialRes.data || []
    })
  } catch (error) {
    console.error('[career-profile/manage] Route failed:', error)
    return Response.json({ error: 'LOAD_FAILED' }, { status: 500 })
  }
}
