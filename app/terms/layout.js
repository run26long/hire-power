import { headers } from 'next/headers'

import { shareCardForHost } from '@/lib/siteMetadata'

// Served under both domains, so it answers as whichever one asked. See
// app/landing/layout.js for why this is a per-page layout and what reading the
// Host header costs.
export async function generateMetadata() {
  return shareCardForHost((await headers()).get('host'))
}

export default function TermsLayout({ children }) {
  return <>{children}</>
}
