import { createClient } from '@supabase/supabase-js'
import { fetchPageSafely } from '../_lib/safeFetch'
import { readPageMeta } from '../_lib/pageMeta'
import { chargeOutbound, outboundExhausted, overCallLimit } from '../_lib/outboundLimit'

// ============================================================================
// POST /api/career-profile/preview-url
//
// Reads the title, description and image a page advertises about itself, so an
// owner pasting a link does not have to retype what the link already says.
//
// EVERYTHING IT RETURNS IS A SUGGESTION
// Nothing here is stored. The values go into a form the owner sees and can
// change, and only what they then submit reaches the database through the
// evidence route, which validates it again. That is deliberate: the content of
// somebody else's page is not a fact about this person's career, and a preview
// that wrote itself in would be letting a stranger's server author a line on
// somebody's profile.
//
// THE IMAGE URL IS RETURNED, AND NOT FETCHED HERE
// og:image is handed back as a string and this route does nothing with it.
// Nothing on a profile ever points at it either: a remote src would be a
// hotlink to a stranger's server, where it can be swapped for anything after
// the fact. If the owner keeps it, the evidence route fetches it once through
// the same guard, decodes it to prove it is a picture, re-encodes it and
// stores it in our own bucket - so what a reader is served is always an object
// this server made.
//
// WHY IT IS AUTHENTICATED
// A URL fetcher open to the internet is a URL fetcher other people will use.
// The safeguards in _lib/safeFetch are what make it safe to point anywhere;
// the session is what keeps it from becoming a service.
// ============================================================================

// The outbound budget is shared with the two evidence routes that also
// fetch a URL somebody else chose, so an account has one allowance rather
// than one per door. See _lib/outboundLimit.

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

    if (overCallLimit(user.id)) {
      return Response.json({ error: 'Too many previews. Wait a moment.' }, { status: 429 })
    }
    if (outboundExhausted(user.id)) {
      return Response.json({ error: 'Too many previews. Wait a moment.' }, { status: 429 })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'Invalid request.' }, { status: 400 })
    }

    const raw = typeof body?.url === 'string' ? body.url.trim() : ''
    if (!raw) return Response.json({ error: 'Paste a link first.' }, { status: 400 })

    const result = await fetchPageSafely(raw)
    if (result.attempted) chargeOutbound(user.id)

    // A page that refuses to be read is not an error the owner has to solve -
    // they can still type the details themselves - so this answers 200 with
    // nothing found rather than a failure, and says why.
    if (result.error) {
      return Response.json({ ok: false, reason: result.error, preview: null })
    }

    // The same reader the evidence route uses when it has to find this page's
    // image again, so the picture somebody approved here is the picture that
    // comes back when they switch the thumbnail on later.
    const meta = readPageMeta(result.html, result.finalUrl)

    return Response.json({
      ok: true,
      preview: { url: result.finalUrl, ...meta }
    })
  } catch (error) {
    console.error('[career-profile] Link preview failed:', error)
    return Response.json({ ok: false, reason: "We couldn't read that page.", preview: null })
  }
}
