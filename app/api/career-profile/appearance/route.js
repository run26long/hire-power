import { createClient } from '@supabase/supabase-js'
import { COLOR_MODES } from '@/lib/profileAppearance'

// ============================================================================
// PATCH /api/career-profile/appearance
//
// How the owner's Career Profile is painted. One field so far - color_mode -
// and the route is named for the group rather than for the field because
// template and accent are the other two columns on the same row and will be
// written here when they become settable.
//
// Body: { color_mode: 'system' | 'light' | 'dark' }
//
// WHOSE PROFILE THIS WRITES TO
// The token's, never the body's. This takes no slug and no profile id: the
// service role sees every row, and an identifier from the browser would be
// the only thing standing between somebody's session and somebody else's
// page. The row is found from the authenticated user, the same way the
// contact and slug routes do it.
//
// WHAT IT WILL NOT WRITE
// `template` and `accent`. They travel in the same group in the interface and
// they are read-only there; a route that quietly accepted them would be a
// way to set, from the browser, two things no control can yet set.
//
// NOT GATED ON TIER
// Choosing light or dark is not customisation in the sense the paywall means.
// It changes how the same page is painted, adds nothing to it, and taking a
// published page from light to dark is not an upgrade anybody should have to
// buy. requireCustomise is deliberately not called here.
//
// NULL IS NOT A VALUE THIS ACCEPTS
// It is a value the column already holds, for every profile written before
// this setting existed, and it resolves to dark in the reader. But there is
// no control that produces it and no reason to offer a way back to it: an
// owner who wants dark picks Dark, which stores 'dark' and reads the same.
// ============================================================================

const RETURNED = 'slug, color_mode, template, accent'

export async function PATCH(request) {
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

    let body
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'Invalid request.' }, { status: 400 })
    }

    const colorMode = body?.color_mode
    if (!COLOR_MODES.includes(colorMode)) {
      return Response.json(
        { error: "We couldn't save that appearance setting.", code: 'INVALID' },
        { status: 400 }
      )
    }

    const { data: updated, error: updateError } = await supabase
      .from('career_profiles')
      .update({ color_mode: colorMode, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .select(RETURNED)
      .maybeSingle()

    if (updateError) {
      // 23514 here means the column carries a CHECK that does not know these
      // three values yet. Named in the log because the owner's message cannot
      // say it and the symptom is otherwise a control that will not stay put.
      if (updateError.code === '23514') {
        console.error(
          '[career-profile] career_profiles.color_mode refused a value. ' +
          'Does its CHECK allow system/light/dark?', updateError
        )
      } else {
        console.error('[career-profile] Appearance write failed:', updateError)
      }
      return Response.json({ error: "We couldn't save that. Please try again." }, { status: 500 })
    }

    // An account with no profile row has nothing to paint. Answered the way a
    // missing thing is answered rather than as a failure to save.
    if (!updated) return Response.json({ error: 'No profile to update.' }, { status: 404 })

    return Response.json({ profile: updated })
  } catch (error) {
    console.error('[career-profile] Appearance route failed:', error)
    return Response.json({ error: "We couldn't save that. Please try again." }, { status: 500 })
  }
}
