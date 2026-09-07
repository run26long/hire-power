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

// The page shows three directions at most, the same ceiling the hub selector
// card uses.
const LENS_DISPLAY_LIMIT = 3

const PROFILE_BASE = 'id, user_id, slug'
const PROFILE_FULL = `${PROFILE_BASE}, template, color_mode, accent, imow_text, imow_type`

const LENS_BASE = 'id, name, slug, sort_order, status, evidence_summary, core_resume_id, created_at'
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
    const [lensRes, personRes, contextRes, coreRes, testimonialRes, evidenceRes] = await Promise.all([
      supabase
        .from('profile_lenses')
        .select(LENS_FULL)
        .eq('profile_id', profile.id)
        .in('status', ['active', 'suggested'])
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
        .select('id, display_name, resume_data, current_score')
        .eq('user_id', profile.user_id)
        .eq('resume_type', 'core')
        .eq('is_active', true)
        .order('is_priority_core', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1),
      // Published testimonials only. recipient_email, raw_text and
      // request_token are deliberately not named: a draft testimonial, the
      // referee's address and the token that lets someone write one are not
      // things a link holder gets.
      supabase
        .from('profile_testimonials')
        .select('id, polished_text, recipient_name, recipient_title, relationship')
        .eq('profile_id', profile.id)
        .eq('status', 'published')
        .order('created_at', { ascending: true }),
      // Public evidence only. storage_path, thumbnail_path and user_id are
      // left out for the same reason; url is the one link meant to be shared.
      supabase
        .from('profile_evidence')
        .select('id, kind, media_class, title, description, url, sort_order')
        .eq('profile_id', profile.id)
        .eq('privacy', 'public')
        .order('sort_order', { ascending: true })
    ])

    let lenses = lensRes.data
    if (isMissingColumnError(lensRes.error)) {
      console.warn('[career-profile] profile_lenses is missing its profile columns, reading without them')
      const { data: baseLenses } = await supabase
        .from('profile_lenses')
        .select(LENS_BASE)
        .eq('profile_id', profile.id)
        .in('status', ['active', 'suggested'])
        .order('sort_order', { ascending: true })
      lenses = baseLenses
    } else if (lensRes.error) {
      console.error('[career-profile] Lens lookup failed:', lensRes.error)
      return Response.json({ error: 'PROFILE_LOAD_FAILED' }, { status: 500 })
    }

    // A built core outranks a suggestion, because it is a direction the person
    // has actually committed to. Within a status the profile keeps the order the
    // hub gave it. Anything past the third is not shown.
    const orderRank = (lens) => (lens?.status === 'active' ? 0 : 1)
    const sortWeight = (lens) => (Number.isFinite(lens?.sort_order) ? lens.sort_order : Number.MAX_SAFE_INTEGER)

    const visibleLenses = (lenses || [])
      .slice()
      .sort((a, b) => {
        const byStatus = orderRank(a) - orderRank(b)
        if (byStatus !== 0) return byStatus
        const byOrder = sortWeight(a) - sortWeight(b)
        if (byOrder !== 0) return byOrder
        return String(a.created_at || '').localeCompare(String(b.created_at || ''))
      })
      .slice(0, LENS_DISPLAY_LIMIT)

    // ---- LENS RESUMES ----
    // One query for all of them rather than one per lens.
    const lensResumeIds = [...new Set(visibleLenses.map(l => l.core_resume_id).filter(Boolean))]
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

    // Neither of these is worth failing the page over. A profile with no
    // testimonials and no evidence is a normal profile; it renders fewer
    // sections, which is exactly what an empty section is supposed to do.
    if (testimonialRes.error) {
      console.error('[career-profile] Testimonial lookup failed (non-fatal):', testimonialRes.error)
    }
    if (evidenceRes.error) {
      console.error('[career-profile] Evidence lookup failed (non-fatal):', evidenceRes.error)
    }
    const testimonials = testimonialRes.error ? [] : (testimonialRes.data || [])
    const evidence = evidenceRes.error ? [] : (evidenceRes.data || [])

    const coreResume = (coreRes.data || [])[0] || null

    // Experience, certifications and education follow the rule the rest of the
    // page follows: the lens's own resume once it has been built, the priority
    // core until then. Resolved here so the page reads one shape rather than
    // repeating the lookup per section.
    const sectionsFrom = (resumeData) => ({
      experience: Array.isArray(resumeData?.experience) ? resumeData.experience : [],
      certifications: Array.isArray(resumeData?.certifications) ? resumeData.certifications : [],
      education: Array.isArray(resumeData?.education) ? resumeData.education : []
    })
    const resumeSections = {
      byLens: Object.fromEntries(
        visibleLenses
          .filter(lens => lens.core_resume_id && lensResumes[lens.core_resume_id])
          .map(lens => [lens.id, sectionsFrom(lensResumes[lens.core_resume_id].resume_data)])
      ),
      fallback: sectionsFrom(coreResume?.resume_data)
    }

    // A profile with no lenses is still a profile. The priority core stands in
    // as the default view so the page has a name, a line about the person, and a
    // score rather than rendering empty.
    const fallback = visibleLenses.length === 0 && coreResume
      ? {
          name: coreResume.display_name || null,
          headline: coreResume.resume_data?.summary || null,
          score: coreResume.current_score ?? null
        }
      : null

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
      lenses: visibleLenses,
      fallback,
      coreResume,
      lensResumes,
      resumeSections,
      testimonials,
      evidence
    })

  } catch (error) {
    return apiError(error, "We couldn't load this profile. Please try again.")
  }
}
