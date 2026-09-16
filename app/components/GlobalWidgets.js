'use client'

import { usePathname } from 'next/navigation'

import FeedbackButton from './FeedbackButton'
import HelpPanel from './HelpPanel'

// ============================================================================
// THE APP'S OWN FURNITURE
//
// The feedback button and the help panel belong to Hire Power, and they are
// shown to the person whose account this is on every screen they work in.
//
// A published Career Profile is not one of those screens. It is a page the
// owner hands to a recruiter, and a recruiter has nothing to give feedback
// about and no product to be helped with - the widgets would be the only two
// things on it belonging to somebody other than the candidate.
//
// Route-based rather than prop-drilled, because these are mounted once at the
// root and there is no chain of props from there to here. Next nests layouts
// rather than replacing them, so a layout under /p could not remove what the
// root layout had already rendered; asking the pathname is what actually
// works without moving every other route into a group of its own.
// ============================================================================

const PROFILE_ROUTE = '/p/'

// The owner's editor renders the same document, on the same dark ground, and
// the widgets sit on top of it as two light-mode controls belonging to a
// different visual system. The editor has its own chrome for the same jobs.
const EDITOR_ROUTE = '/career-profile'

export default function GlobalWidgets() {
  const pathname = usePathname()

  // Only the public profile itself. /profile and /profile-anything are the
  // owner's own screens and keep both widgets, which is why this tests for the
  // trailing slash rather than for the prefix alone.
  if (pathname === '/p' || pathname?.startsWith(PROFILE_ROUTE)) return null
  if (pathname === EDITOR_ROUTE || pathname?.startsWith(`${EDITOR_ROUTE}/`)) return null

  return (
    <>
      <FeedbackButton />
      <HelpPanel />
    </>
  )
}
