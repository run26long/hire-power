import { headers } from 'next/headers'

import { shareCardForHost } from '@/lib/siteMetadata'

// ============================================================================
// THE ONE ROUTE BOTH DOMAINS LAND ON FOR DIFFERENT REASONS
//
// brbresume.com/ is rewritten here by next.config.mjs, so this layout's
// metadata is what brbresume.com's homepage carries - which is why the brb
// card has to be decided here and not anywhere else.
//
// But hirepowerai.com/brb-landing reaches the same route, and that is a page
// on Hire Power's domain. A card is a claim about which site the reader is
// being sent to, so it follows the Host rather than the route: brbresume.com
// gets the brb image, hirepowerai.com gets the Hire Power one, and neither
// domain ever shows the other's.
//
// The title and the icon are the page's own and do not move. They say what
// this page IS, and it is the brb landing page on either domain. They are
// inside generateMetadata only because a route may export that or `metadata`
// and never both - the values are exactly the ones that used to stand here.
// ============================================================================
const TITLE = 'brb · best resume builder'

const ICONS = {
  icon: [
    {
      url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:%23667eea"/><stop offset="100%" style="stop-color:%23764ba2"/></linearGradient></defs><rect width="64" height="64" rx="12" fill="url(%23g)"/><text x="32" y="48" font-family="Georgia,serif" font-size="48" font-weight="700" fill="white" text-anchor="middle" letter-spacing="-2">b</text></svg>',
      type: 'image/svg+xml',
    },
  ],
}

export async function generateMetadata() {
  return {
    title: TITLE,
    icons: ICONS,
    ...shareCardForHost((await headers()).get('host')),
  }
}

export default function BrbLandingLayout({ children }) {
  return <>{children}</>
}