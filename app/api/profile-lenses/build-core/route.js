import { createClient } from '@supabase/supabase-js'
import { apiError } from '@/lib/apiError'

// ============================================================================
// POST /api/profile-lenses/build-core
// Turns a suggested lens into a real core resume: clones the user's priority
// core, opens the clone at the coaching step, and marks the lens active.
//
// Pro only. A free account has one core by design, and this makes a second.
//
// Request body: { lensId: string }
// ============================================================================

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const token = authHeader.replace('Bearer ', '')

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // The account this builds for comes from the token, never from the body.
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = user.id

    const { lensId } = await request.json()
    if (!lensId) return Response.json({ error: 'lensId is required' }, { status: 400 })

    // ---- TIER ----
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .maybeSingle()

    if (profileError) {
      console.error('Build core profile lookup failed:', profileError)
      return Response.json({ error: 'BUILD_FAILED' }, { status: 500 })
    }
    if (profile?.subscription_tier !== 'pro') {
      return Response.json({ error: 'PRO_REQUIRED' }, { status: 403 })
    }

    // ---- LENS ----
    // Only a suggestion this account owns, and only one still unbuilt.
    const { data: lens, error: lensError } = await supabase
      .from('profile_lenses')
      .select('id, name')
      .eq('id', lensId)
      .eq('user_id', userId)
      .eq('status', 'suggested')
      .maybeSingle()

    if (lensError) {
      console.error('Build core lens lookup failed:', lensError)
      return Response.json({ error: 'BUILD_FAILED' }, { status: 500 })
    }
    if (!lens) return Response.json({ error: 'LENS_NOT_FOUND' }, { status: 404 })

    // ---- SOURCE CORE ----
    // The priority core is the one this reframes. Same preference the hub reads
    // with, so the resume they see is the resume this clones.
    const { data: sourceCores, error: sourceError } = await supabase
      .from('resumes')
      .select('*')
      .eq('user_id', userId)
      .eq('resume_type', 'core')
      .eq('is_active', true)
      .order('is_priority_core', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)

    if (sourceError) {
      console.error('Build core source lookup failed:', sourceError)
      return Response.json({ error: 'BUILD_FAILED' }, { status: 500 })
    }
    const source = (sourceCores || [])[0]
    if (!source) return Response.json({ error: 'NO_SOURCE_CORE' }, { status: 400 })

    // ---- CLONE ----
    // Content and formatting carry over. Everything the first core earned —
    // scores, analysis, the coaching that produced it — does not: this resume
    // has not been coached yet, and journey_step opens it where that starts.
    const { data: newResume, error: insertError } = await supabase
      .from('resumes')
      .insert({
        user_id: userId,
        resume_type: 'core',
        display_name: lens.name,
        resume_data: source.resume_data,
        template_id: source.template_id,
        font_family: source.font_family,
        font_size: source.font_size,
        accent_color: source.accent_color,
        date_format: source.date_format,
        spacing: source.spacing,
        created_via: 'lens_core',
        is_priority_core: false,
        journey_step: 'coach'
      })
      .select('id')
      .single()

    if (insertError || !newResume) {
      console.error('Build core insert failed:', insertError)
      return Response.json({ error: 'BUILD_FAILED' }, { status: 500 })
    }

    // ---- CLAIM THE LENS ----
    // Non-blocking: the resume exists and is the thing the user is waiting for.
    // A lens left on 'suggested' shows one stale tile, which is recoverable;
    // failing the request after creating the resume is not.
    const { error: lensUpdateError } = await supabase
      .from('profile_lenses')
      .update({
        status: 'active',
        core_resume_id: newResume.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', lens.id)
      .eq('user_id', userId)

    if (lensUpdateError) {
      console.error('Lens status update failed (non-blocking):', lensUpdateError)
    }

    return Response.json({ resumeId: newResume.id })

  } catch (error) {
    return apiError(error, "We couldn't start this core resume. Please try again.")
  }
}
