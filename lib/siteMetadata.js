// ============================================================================
// TWO DOMAINS, TWO CARDS, AND THE ONE THING THAT TELLS THEM APART
//
// hirepowerai.com and brbresume.com are the same deployment. The only thing
// in the whole codebase that distinguishes them is a rewrite in
// next.config.mjs, and it is one path deep:
//
//   source: '/', has host brbresume.com  ->  /brb-landing
//
// Nothing else. There is no middleware. Every other path on brbresume.com
// serves the identical route it serves on hirepowerai.com, which means "which
// site is this page on" is not a question the routing can answer - it is a
// question about the request, and the only thing that holds the answer is the
// Host header.
//
// WHY THAT MATTERS HERE RATHER THAN BEING AN IMPLEMENTATION DETAIL
// Reading a header in generateMetadata opts that route out of static
// rendering. So host-awareness is not free, and it is applied exactly where a
// link is actually shared from - the public pages - while everything behind a
// login keeps the static default and stays prerendered. A signed-in dashboard
// is not a link anybody posts.
//
// THE IMAGES ARE ABSOLUTE AND BELONG TO THEIR OWN ORIGIN
// A scraper fetching an og:image does not have the page's origin to resolve a
// relative path against in every case, and more to the point a card for
// brbresume.com must not send the reader's preview fetcher to hirepowerai.com
// for the picture. Each site names its own origin, and metadataBase is set to
// the same origin so anything else that resolves relatively lands there too.
//
// BOTH FILES LIVE IN public/og AND ARE SERVED BY EITHER DOMAIN
// That is fine and is not the thing being guarded. What is guarded is which
// URL goes in the tag, because that URL is what a reader sees.
// ============================================================================

export const SITES = {
  hirePower: {
    key: 'hire-power',
    origin: 'https://hirepowerai.com',
    hosts: ['hirepowerai.com', 'www.hirepowerai.com'],
    siteName: 'Hire Power',
    title: 'Hire Power — Your Lifelong Career Coach',
    description:
      'AI-powered career coaching for people who want more than their next job.',
    image: '/og/hirepower-opengraph-image.png',
    imageAlt: 'Hire Power — your lifelong career coach'
  },

  brb: {
    key: 'brb',
    origin: 'https://brbresume.com',
    hosts: ['brbresume.com', 'www.brbresume.com'],
    siteName: 'brb',
    title: 'brb · best resume builder',
    description:
      'Chat with a resume coach. No forms, no blank page - a real resume in about 30 minutes.',
    image: '/og/brb-opengraph-image.png',
    imageAlt: 'brb · best resume builder'
  }
}

/**
 * Which site a request is for.
 *
 * Hire Power is the default and the fallback for everything: a preview
 * deployment, localhost, a bare IP, a missing header. Guessing brb from
 * anything but its own two hostnames is how the wrong card ends up on the
 * wrong domain, and defaulting the other way would put the brb image on every
 * Vercel preview URL.
 *
 * The port is dropped because `localhost:3000` is a host and `localhost` is
 * the hostname, and neither is on either list anyway.
 */
export function siteForHost(host) {
  const hostname = String(host || '').toLowerCase().split(':')[0].trim()
  return SITES.brb.hosts.includes(hostname) ? SITES.brb : SITES.hirePower
}

/**
 * The share card for one site, as a Next metadata object.
 *
 * Returned as a fragment rather than a whole metadata export: `title` is
 * deliberately absent, so a page that sets its own document title keeps it and
 * the root layout's stands everywhere else. What this decides is only what a
 * link to the page looks like when somebody posts it.
 */
export function shareCardFor(site) {
  const image = `${site.origin}${site.image}`

  return {
    metadataBase: new URL(site.origin),
    openGraph: {
      type: 'website',
      siteName: site.siteName,
      title: site.title,
      description: site.description,
      images: [{ url: image, width: 1200, height: 630, alt: site.imageAlt }]
    },
    twitter: {
      // The wide card. Both files are 1200x630, which is the shape this card
      // crops to; `summary` would show the same picture as a small square and
      // throw away most of it.
      card: 'summary_large_image',
      title: site.title,
      description: site.description,
      images: [image]
    }
  }
}

/**
 * The share card for whoever is asking.
 *
 * For the public pages, which are served under both domains and have to
 * answer as whichever one was asked. Call it from generateMetadata with the
 * request's Host header.
 */
export const shareCardForHost = (host) => shareCardFor(siteForHost(host))
