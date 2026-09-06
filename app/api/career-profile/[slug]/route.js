import { createClient } from '@supabase/supabase-js'
import { apiError } from '@/lib/apiError'

// ============================================================================
// GET /api/career-profile/[slug]
// Public read for the Career Profile page. No authentication: the slug is the
// only key, which is the point, and it is also the whole authorization boundary.
//
// The service role bypasses RLS, so every select here names its columns. A
// `select('*')` on any of these tables would publish whatever gets added to it
// next, to anyone holding a link.
//
// An Authorization header is optional. When one is present and it belongs to
// the profile's owner, the response says so, and the page shows owner controls.
// The owner's user id itself is never returned.
// ============================================================================

// PostgREST reports an unknown column as 42703 on a select. Several columns
// here are newer than their tables, so a select is tried in full and retried
// with the columns that have always existed rather than failing the page.
function isMissingColumnError(error) {
  if (!error) return false
  return error.code === '42703' || error.code === 'PGRST204'
}

const PROFILE_BASE = 'id, user_id, slug'
const PROFILE_FULL = `${PROFILE_BASE}, template, color_mode, accent, imow_text, imow_type`

const LENS_BASE = 'id, name, slug, sort_order, status, evidence_summary, core_resume_id'
const LENS_FULL = `${LENS_BASE}, headline, bio, proof_points, ready_for_next, ready_tags`

export async function GET(request, { params }) {
  try {
    const { slug } = await params
    if (!slug) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // ---- THE PROFILE ----
    let { data: profile, error: profileError } = await supabase
      .from('career_profiles')
      .select(PROFILE_FULL)
      .eq('slug', slug)
      .maybeSingle()

    if (isMissingColumnError(profileError)) {
      console.warn('[career-profile] career_profiles is missing its styling columns, reading without them')
      ;({ data: profile, error: profileError } = await supabase
        .from('career_profiles')
        .select(PROFILE_BASE)
        .eq('slug', slug)
        .maybeSingle())
    }

    if (profileError) {
      console.error('[career-profile] Profile lookup failed:', profileError)
      return Response.json({ error: 'PROFILE_LOAD_FAILED' }, { status: 500 })
    }
    if (!profile) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

    // ---- OWNER? ----
    // Optional. A viewer with no session is the normal case and gets the page
    // exactly as a recruiter would see it.
    let isOwner = false
    const authHeader = request.headers.get('authorization')
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user } } = await supabase.auth.getUser(token)
      isOwner = Boolean(user && user.id === profile.user_id)
    }

    // ---- EVERYTHING THE PAGE RENDERS ----
    const [lensRes, personRes, contextRes, coreRes] = await Promise.all([
      supabase
        .from('profile_lenses')
        .select(LENS_FULL)
        .eq('profile_id', profile.id)
        .eq('status', 'active')
        .order('sort_order', { ascending: true }),
      supabase
        .from('profiles')
        .select('display_name')
        .eq('id', profile.user_id)
        .maybeSingle(),
      supabase
        .from('career_context')
        .select('target_roles, current_lens_name')
        .eq('user_id', profile.user_id)
        .maybeSingle(),
      // The flagged priority core when there is one, the newest core when there
      // is not. A strict is_priority_core filter returns nothing for an account
      // that predates the column, which would empty the page.
      supabase
        .from('resumes')
        .select('id, display_name, resume_data')
        .eq('user_id', profile.user_id)
        .eq('resume_type', 'core')
        .eq('is_active', true)
        .order('is_priority_core', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
    ])

    let lenses = lensRes.data
    if (isMissingColumnError(lensRes.error)) {
      console.warn('[career-profile] profile_lenses is missing its profile columns, reading without them')
      const { data: baseLenses } = await supabase
        .from('profile_lenses')
        .select(LENS_BASE)
        .eq('profile_id', profile.id)
        .eq('status', 'active')
        .order('sort_order', { ascending: true })
      lenses = baseLenses
    } else if (lensRes.error) {
      console.error('[career-profile] Lens lookup failed:', lensRes.error)
      return Response.json({ error: 'PROFILE_LOAD_FAILED' }, { status: 500 })
    }

    const activeLenses = lenses || []

    // ---- LENS RESUMES ----
    // One query for all of them rather than one per lens.
    const lensResumeIds = [...new Set(activeLenses.map(l => l.core_resume_id).filter(Boolean))]
    let lensResumes = {}
    if (lensResumeIds.length > 0) {
      const { data: rows, error: lensResumeError } = await supabase
        .from('resumes')
        .select('id, display_name, resume_data')
        .in('id', lensResumeIds)
        .eq('user_id', profile.user_id)
        .eq('is_active', true)

      if (lensResumeError) {
        // The page falls back to the core resume for these lenses, which is the
        // right content, just not the lens-specific cut of it.
        console.error('[career-profile] Lens resume lookup failed (non-fatal):', lensResumeError)
      } else {
        lensResumes = Object.fromEntries((rows || []).map(r => [r.id, r]))
      }
    }

    const coreResume = (coreRes.data || [])[0] || null

    return Response.json({
      isOwner,
      profile: {
        slug: profile.slug,
        template: profile.template ?? null,
        color_mode: profile.color_mode ?? null,
        accent: profile.accent ?? null,
        imow_text: profile.imow_text ?? null,
        imow_type: profile.imow_type ?? null
      },
      person: {
        displayName: personRes.data?.display_name || coreResume?.resume_data?.fullName || null
      },
      careerContext: {
        target_roles: contextRes.data?.target_roles || [],
        current_lens_name: contextRes.data?.current_lens_name || null
      },
      lenses: activeLenses,
      coreResume,
      lensResumes
    })

  } catch (error) {
    return apiError(error, "We couldn't load this profile. Please try again.")
  }
}
