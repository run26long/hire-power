import { createClient } from '@supabase/supabase-js'
import { apiError } from '@/lib/apiError'
import { generateLensContent, WRITABLE_FIELDS } from '../_lib/generateLens'

// ============================================================================
// POST /api/career-profile/generate
// Generates the Career Profile content for ONE lens: headline, bio, three proof
// points, a forward-looking line, and target tags. Everything is written from
// the user's knowledge base and resume, never invented.
//
// Pro, or a free account with only its one entitled direction.
//
// Request body: { lensId: string, fields?: string[], preview?: boolean }
//
// The generation itself lives in ../_lib/generateLens.js, so the same engine
// can be run from a script with no request to carry a token. What stays here is
// what only a route can do: read the caller's token, decide whether this
// account is entitled to generate at all, and turn the result into a response.
//
// WHAT `fields` DOES, AND WHAT IT DELIBERATELY DOES NOT
// It narrows what is WRITTEN, never what is generated. See the note above
// generateLensContent. Without it, a Regenerate button beside the bio would
// also overwrite the headline, the proof points and the tags somebody had just
// typed by hand. Omit it and everything is written, which is what the button on
// the profile has always done.
//
// WRITE, OR JUST SHOW
//
// Regenerate used to be a write. The owner pressed it, this route replaced
// the column, and the editor closed on text nobody had read yet - the old
// wording was already gone and there was no Cancel that could bring it
// back. That is the wrong shape for a button whose whole purpose is to
// offer an alternative.
//
// In preview the generation runs exactly as it does otherwise and nothing
// is stored: the text goes back to the open editor as a draft, and the
// owner's Save is still the only thing in this feature that writes.
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

    // The profile this writes to comes from the token, never from the body. The
    // service role sees every row, so this is the only thing standing between a
    // lens id and whoever guessed it.
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = user.id

    const body = await request.json()
    const lensId = body?.lensId
    if (!lensId) return Response.json({ error: 'lensId is required' }, { status: 400 })

    // Unknown names are dropped rather than refused, and an empty or absent
    // list means all of them - so an older caller that sends no fields keeps
    // the behaviour it has always had.
    const requested = Array.isArray(body?.fields)
      ? body.fields.filter(f => WRITABLE_FIELDS.has(f))
      : []
    const fields = requested.length > 0 ? new Set(requested) : new Set(WRITABLE_FIELDS)

    const preview = body?.preview === true

    // ---- TIER ----
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .maybeSingle()

    if (profileError) {
      console.error('[career-profile] Profile lookup failed:', profileError)
      return Response.json({ error: 'GENERATION_FAILED' }, { status: 500 })
    }
    // A free account is entitled to one direction, so it can generate a profile
    // for that one. The moment there is more than one, choosing between them is
    // the Pro feature, and generating for any of them is gated.
    if (profile?.subscription_tier !== 'pro') {
      const { count, error: lensCountError } = await supabase
        .from('profile_lenses')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('status', ['active', 'suggested'])

      if (lensCountError) {
        console.error('[career-profile] Lens count failed:', lensCountError)
        return Response.json({ error: 'GENERATION_FAILED' }, { status: 500 })
      }
      if ((count || 0) > 1) {
        return Response.json({ error: 'PRO_REQUIRED' }, { status: 403 })
      }
    }

    // ---- GENERATE ----
    const result = await generateLensContent({ supabase, userId, lensId, fields, preview })

    if (!result.ok) {
      return Response.json(
        { error: result.error },
        { status: result.error === 'LENS_NOT_FOUND' ? 404 : 500 }
      )
    }

    // The same two shapes this route has always returned: a draft when nothing
    // was stored, the stored row otherwise.
    return Response.json(result.draft ? { draft: result.draft } : { lens: result.lens })

  } catch (error) {
    return apiError(error, "We couldn't build this career profile. Please try again.")
  }
}
