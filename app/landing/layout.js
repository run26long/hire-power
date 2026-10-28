import { headers } from 'next/headers'

import { shareCardForHost } from '@/lib/siteMetadata'

// ============================================================================
// WHICH DOMAIN IS THIS PAGE BEING READ ON
//
// hirepowerai.com and brbresume.com are one deployment, and the routing tells
// them apart for exactly one path - the rewrite of `/` to /brb-landing in
// next.config.mjs. This page is not that path, so it is served, identically,
// under both. The Host header is the only thing that says which.
//
// Reading it opts this route out of static rendering, which is the whole
// reason this is a layout on a handful of public pages rather than something
// in the root layout: there it would opt the entire app out, including twenty
// prerendered pages nobody ever shares a link to.
//
// Only the card changes. The document title stays the root layout's, because
// this is about what a posted link looks like and not about what the tab says.
// ============================================================================

export async function generateMetadata() {
  return shareCardForHost((await headers()).get('host'))
}

export default function LandingLayout({ children }) {
  return <>{children}</>
}
