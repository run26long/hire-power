import { createClient } from '@supabase/supabase-js'
import { normalizeSlug, validateSlug } from '../_lib/slug'

// ============================================================================
// POST   /api/career-profile/slug   - save a new public address
// PATCH  /api/career-profile/slug   - ask whether one is free
//
// WHOSE PROFILE THIS WRITES TO
// The token's. No slug, no profile id and no user id is taken from the body
// except the candidate itself. The service role sees every row, and an
// identifier from the browser would be the only thing between one session and
// another person's public address.
//
// WHY THE CHECK IS A PATCH ON THE SAME ROUTE
// Because it has to answer with exactly the rules the save uses. Put the two
// in separate files and they drift, and the drift shows up as a check that
// says a link is free followed by a save that refuses it. Same module, same
// validator, same uniqueness query.
//
// WHAT THE CHECK DELIBERATELY DOES NOT SAY
// Only whether the exact string asked about is free. Never who holds it, never
// whether the profile behind it is published, never anything about it at all.
// The public route answers 404 for an unpublished profile precisely so a link
// holder cannot learn which slugs exist; this must not undo that, so a taken
// slug and a taken-but-unpublished slug give the same one-word answer.
//
// It is also authenticated and rate limited. A signed-in owner can still probe
// one slug at a time, which is true of every product with chosen handles, but
// it cannot be walked at speed and it cannot be walked at all by a stranger.
//
// CHANGING A SLUG BREAKS LINKS
// Every link already handed out stops working, and nothing here mitigates
// that: there is no redirect table, and inventing one silently would be worse
// than the breakage. The editor says so plainly before saving.
// ============================================================================

const service = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Per user, in this process. Enough to stop a loop; it is not a security
// boundary and is not pretending to be one - the boundary is that you have to
// be signed in to ask at all.
const CHECK_WINDOW_MS = 60_000
const CHECK_LIMIT = 40
const checks = new Map()

function overCheckLimit(userId) {
  const now = Date.now()
  const hits = (checks.get(userId) || []).filter(t => now - t < CHECK_WINDOW_MS)
  hits.push(now)
  checks.set(userId, hits)
  // The map would otherwise grow for the life of the process.
  if (checks.size > 5000) {
    for (const [key, times] of checks) {
      if (!times.some(t => now - t < CHECK_WINDOW_MS)) checks.delete(key)
    }
  }
  return hits.length > CHECK_LIMIT
}

async function owner(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return { error: Response.json({ error: 'Unauthorized' }, { status: 401 }) }

  const supabase = service()
  const { data: { user }, error } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (error || !user) return { error: Response.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { data: profile } = await supabase
    .from('career_profiles')
    .select('id, slug')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!profile) return { error: Response.json({ error: 'No profile to update.' }, { status: 404 }) }
  return { supabase, user, profile }
}

async function readCandidate(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return { error: Response.json({ error: 'Invalid request.' }, { status: 400 }) }
  }
  return { slug: normalizeSlug(body?.slug) }
}

// Is this slug held by somebody other than this profile? `maybeSingle` on an
// exact match rather than a count, so a row that exists but belongs to the
// caller is recognised as theirs rather than reported as taken.
async function takenByAnother(supabase, slug, profileId) {
  const { data, error } = await supabase
    .from('career_profiles')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  return Boolean(data && data.id !== profileId)
}

export async function PATCH(request) {
  try {
    const ctx = await owner(request)
    if (ctx.error) return ctx.error
    const { supabase, user, profile } = ctx

    if (overCheckLimit(user.id)) {
      return Response.json({ error: 'Too many checks. Wait a moment.' }, { status: 429 })
    }

    const parsed = await readCandidate(request)
    if (parsed.error) return parsed.error
    const { slug } = parsed

    // Their own slug is available to them, which is what keeps the editor from
    // telling somebody their current link is taken the moment they focus it.
    if (slug === profile.slug) {
      return Response.json({ slug, available: true, current: true })
    }

    const problem = validateSlug(slug)
    if (problem) return Response.json({ slug, available: false, reason: problem })

    const taken = await takenByAnother(supabase, slug, profile.id)
    return Response.json({
      slug,
      available: !taken,
      reason: taken ? 'That link is already taken.' : null
    })
  } catch (error) {
    console.error('[career-profile] Slug check failed:', error)
    return Response.json({ error: "We couldn't check that just now." }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const ctx = await owner(request)
    if (ctx.error) return ctx.error
    const { supabase, profile } = ctx

    const parsed = await readCandidate(request)
    if (parsed.error) return parsed.error
    const { slug } = parsed

    if (slug === profile.slug) return Response.json({ slug, unchanged: true })

    const problem = validateSlug(slug)
    if (problem) return Response.json({ error: problem, code: 'BAD_SLUG' }, { status: 400 })

    if (await takenByAnother(supabase, slug, profile.id)) {
      return Response.json({ error: 'That link is already taken.', code: 'SLUG_TAKEN' }, { status: 409 })
    }

    const { data: updated, error: updateError } = await supabase
      .from('career_profiles')
      .update({ slug })
      .eq('id', profile.id)
      .select('slug')
      .maybeSingle()

    if (updateError) {
      // Two people can pass the check above and race to the same slug. The
      // unique index is what actually decides, and the loser is told the same
      // thing they would have been told a moment earlier.
      if (updateError.code === '23505') {
        return Response.json({ error: 'That link was just taken.', code: 'SLUG_TAKEN' }, { status: 409 })
      }
      console.error('[career-profile] Slug update failed:', updateError)
      return Response.json({ error: "We couldn't save that. Please try again." }, { status: 500 })
    }

    return Response.json({ slug: updated?.slug ?? slug })
  } catch (error) {
    console.error('[career-profile] Slug route failed:', error)
    return Response.json({ error: "We couldn't save that. Please try again." }, { status: 500 })
  }
}
