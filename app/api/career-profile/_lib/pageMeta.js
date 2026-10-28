// ============================================================================
// WHAT A PAGE SAYS ABOUT ITSELF
//
// The title, the description and the image a page advertises in its head.
//
// WHY THIS IS ITS OWN MODULE
// Two things now read the same four strings out of the same document. The
// preview route reads them so the owner does not have to retype what the link
// already says; the evidence route reads the image again when somebody turns
// a thumbnail back on, because the row stores the picture and never the
// address it came from. Two copies of this parser would be two answers to
// "which image is this page's own", and the second one would be found the day
// they disagreed.
//
// NOTHING HERE FETCHES ANYTHING
// It is handed html that _lib/safeFetch already decided it was willing to
// read, and it hands back strings. Where the strings go is the caller's
// business, and none of them is trustworthy: this is the content of somebody
// else's page.
// ============================================================================

// The few entities that actually turn up inside a meta tag. Not a general
// HTML decoder: this text is rendered by React, which escapes it, so the job
// here is legibility rather than safety.
const ENTITIES = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
  '&#39;': "'", '&apos;': "'", '&nbsp;': ' ', '&#x27;': "'"
}

export function decode(text) {
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
export function metaContent(html, attr, name) {
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
export function headOf(html) {
  const end = html.search(/<\/head\s*>/i)
  return end === -1 ? html.slice(0, 120_000) : html.slice(0, end)
}

export const MAX_TITLE = 200
export const MAX_DESCRIPTION = 600

// The image a page claims as its own, as an ordinary web address or not at
// all.
//
// Resolved against the URL the fetch actually ended on, so a relative path
// works and an absolute one wins. Refused unless it is http or https: a data:
// or javascript: string must never travel on as something that looks like an
// image address, whatever the next caller intends to do with it.
export function ogImageUrl(head, finalUrl) {
  const raw = metaContent(head, 'property', 'og:image') || metaContent(head, 'name', 'og:image')
  if (!raw) return null
  try {
    const resolved = new URL(raw, finalUrl)
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return null
    return resolved.toString()
  } catch {
    return null
  }
}

/**
 * The three strings, from a document safeFetch read.
 *
 * Every one of them is a suggestion written by somebody else's server. The
 * title and the description reach the owner as form fields they can change;
 * the image is an address and nothing more until something decides to fetch
 * it.
 */
export function readPageMeta(html, finalUrl) {
  const head = headOf(html || '')

  const title = firstOf(
    metaContent(head, 'property', 'og:title') || metaContent(head, 'name', 'og:title'),
    metaContent(head, 'name', 'twitter:title'),
    decode(head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '')
  )
  const description = firstOf(
    metaContent(head, 'property', 'og:description') || metaContent(head, 'name', 'og:description'),
    metaContent(head, 'name', 'twitter:description'),
    metaContent(head, 'name', 'description')
  )

  return {
    title: title ? title.slice(0, MAX_TITLE) : null,
    description: description ? description.slice(0, MAX_DESCRIPTION) : null,
    image: ogImageUrl(head, finalUrl)
  }
}
