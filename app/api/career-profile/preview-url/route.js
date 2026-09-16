import { createClient } from '@supabase/supabase-js'
import { fetchPageSafely } from '../_lib/safeFetch'

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
// THE IMAGE URL IS RETURNED AND NOT FETCHED
// og:image is handed back as a string and nothing is done with it. Fetching it
// would be a second request to a URL chosen by that page - the same shape this
// route spends its whole length defending against, with none of the reasons.
// Storing it as a remote src would put a hotlink to a stranger's server on a
// public profile, where it can be swapped for anything after the fact. When
// images do appear, they will be fetched once, checked, and stored in our own
// bucket, which is the upload path and is Part B.
//
// WHY IT IS AUTHENTICATED
// A URL fetcher open to the internet is a URL fetcher other people will use.
// The safeguards in _lib/safeFetch are what make it safe to point anywhere;
// the session is what keeps it from becoming a service.
// ============================================================================

// Per user, in this process, and counted in two tiers.
//
// A URL refused for its scheme, its port or its address never opens a socket.
// Charging those against the same budget as a real fetch means somebody who
// mistypes a few links is locked out of the feature for a minute, and it means
// the expensive thing and the free thing cost the same. So calls are capped
// generously and outbound requests tightly, and only the ones that actually
// reached the network count against the tighter cap.
const WINDOW_MS = 60_000
const CALL_LIMIT = 60
const FETCH_LIMIT = 20

const calls = new Map()
const fetches = new Map()

function recent(store, userId) {
  const now = Date.now()
  const times = (store.get(userId) || []).filter(t => now - t < WINDOW_MS)
  store.set(userId, times)
  if (store.size > 5000) {
    for (const [key, list] of store) {
      if (!list.some(t => now - t < WINDOW_MS)) store.delete(key)
    }
  }
  return times
}

function record(store, userId) {
  const times = recent(store, userId)
  times.push(Date.now())
  store.set(userId, times)
  return times.length
}

// The few entities that actually turn up inside a meta tag. Not a general
// HTML decoder: this text is rendered by React, which escapes it, so the job
// here is legibility rather than safety.
const ENTITIES = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
  '&#39;': "'", '&apos;': "'", '&nbsp;': ' ', '&#x27;': "'"
}

function decode(text) {
  return String(text)
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp|#39|#x27);/gi, m => ENTITIES[m.toLowerCase()] ?? m)
    .replace(/&#(\d{1,6});/g, (_, code) => {
      const n = Number(code)
      return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ''
    })
    .replace(/\s+/g, ' ')
    .trim()
}

// Meta tags, read with a regex rather than a parser.
//
// That is a deliberate limit and not a shortcut: the alternative is adding an
// HTML parser to the dependency tree to read four strings out of a document we
// have already decided not to trust. The regex is attribute-order agnostic and
// quote-agnostic, which covers what real pages emit; where it fails it returns
// nothing, and the owner types the title themselves.
function metaContent(html, attr, name) {
  const pattern = new RegExp(
    '<meta[^>]*?' + attr + '\\s*=\\s*["\']' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
    '["\'][^>]*?>',
    'i'
  )
  const tag = html.match(pattern)?.[0]
  if (!tag) return null
  const content = tag.match(/content\s*=\s*"([^"]*)"/i) || tag.match(/content\s*=\s*'([^']*)'/i)
  return content ? decode(content[1]) : null
}

function firstOf(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

// Only what the head can hold. Cutting here keeps the patterns off a megabyte
// of body text that cannot contain a meta tag anyway.
function headOf(html) {
  const end = html.search(/<\/head\s*>/i)
  return end === -1 ? html.slice(0, 120_000) : html.slice(0, end)
}

const MAX_TITLE = 200
const MAX_DESCRIPTION = 600

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

    if (record(calls, user.id) > CALL_LIMIT) {
      return Response.json({ error: 'Too many previews. Wait a moment.' }, { status: 429 })
    }
    if (recent(fetches, user.id).length >= FETCH_LIMIT) {
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
    if (result.attempted) record(fetches, user.id)

    // A page that refuses to be read is not an error the owner has to solve -
    // they can still type the details themselves - so this answers 200 with
    // nothing found rather than a failure, and says why.
    if (result.error) {
      return Response.json({ ok: false, reason: result.error, preview: null })
    }

    const head = headOf(result.html || '')

    const ogTitle = metaContent(head, 'property', 'og:title') || metaContent(head, 'name', 'og:title')
    const ogDescription =
      metaContent(head, 'property', 'og:description') || metaContent(head, 'name', 'og:description')
    const ogImage = metaContent(head, 'property', 'og:image') || metaContent(head, 'name', 'og:image')
    const twitterTitle = metaContent(head, 'name', 'twitter:title')
    const twitterDescription = metaContent(head, 'name', 'twitter:description')
    const htmlTitle = decode(head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '')
    const metaDescription = metaContent(head, 'name', 'description')

    // The image is only offered if it is itself an ordinary web URL. Nothing
    // fetches it; this is so a data: or javascript: string never travels as
    // something that looks like an image address.
    let image = null
    if (ogImage) {
      try {
        const resolved = new URL(ogImage, result.finalUrl)
        if (resolved.protocol === 'http:' || resolved.protocol === 'https:') {
          image = resolved.toString()
        }
      } catch {
        image = null
      }
    }

    const title = firstOf(ogTitle, twitterTitle, htmlTitle)
    const description = firstOf(ogDescription, twitterDescription, metaDescription)

    return Response.json({
      ok: true,
      preview: {
        url: result.finalUrl,
        title: title ? title.slice(0, MAX_TITLE) : null,
        description: description ? description.slice(0, MAX_DESCRIPTION) : null,
        image
      }
    })
  } catch (error) {
    console.error('[career-profile] Link preview failed:', error)
    return Response.json({ ok: false, reason: "We couldn't read that page.", preview: null })
  }
}
