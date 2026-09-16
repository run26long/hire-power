import { createClient } from '@supabase/supabase-js'

// ============================================================================
// POST /api/career-profile/publish
//
// The switch that decides whether anybody but the owner can read the profile.
//
// This is the most consequential write in the product: on one side of it a
// page is private, and on the other it can be read by anyone holding a link.
// So it is its own route, with one field, rather than a key in a settings
// object where a stray spread could flip it.
//
// WHOSE PROFILE THIS WRITES TO
// The token's. No profile id from the browser.
//
// STRICTLY BOOLEAN
// The column accepts anything Postgres can coerce - I checked, and the string
// 'yes' is written happily. So the body is required to be a real `true` or
// `false` and anything else is a 400. A publish that happened because a
// truthy string arrived would be a publish nobody asked for.
//
// WHAT IT DOES NOT DO
// It does not decide whether a profile is ready. There is no completeness gate
// here, and there should not be one: whether a profile is worth showing is the
// owner's judgement, and a system that refuses to publish until it approves of
// the contents would be making that call for them.
//
// It also does not touch the slug. Unpublishing leaves the address alone, so
// republishing later restores the same link rather than issuing a new one.
// ============================================================================

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data: { user }, error: authError } =
      await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    let body
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'Invalid request.' }, { status: 400 })
    }

    // Not `Boolean(body?.is_published)`. An absent field, a string, a number
    // and a null would all become a decision, and the decision this makes is
    // whether somebody's career is readable by strangers.
    const next = body?.is_published
    if (next !== true && next !== false) {
      return Response.json({ error: 'Invalid request.', code: 'BAD_STATE' }, { status: 400 })
    }

    const { data: updated, error: updateError } = await supabase
      .from('career_profiles')
      .update({ is_published: next })
      .eq('user_id', user.id)
      .select('slug, is_published')
      .maybeSingle()

    if (updateError) {
      console.error('[career-profile] Publish update failed:', updateError)
      return Response.json({ error: "We couldn't save that. Please try again." }, { status: 500 })
    }
    if (!updated) return Response.json({ error: 'No profile to update.' }, { status: 404 })

    return Response.json({ slug: updated.slug, is_published: updated.is_published === true })
  } catch (error) {
    console.error('[career-profile] Publish route failed:', error)
    return Response.json({ error: "We couldn't save that. Please try again." }, { status: 500 })
  }
}
