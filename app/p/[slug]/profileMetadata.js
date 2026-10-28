import { createClient } from '@supabase/supabase-js'

import { lensesShownBy } from '@/app/api/career-profile/_lib/directions'

// ============================================================================
// WHAT A SHARED CAREER PROFILE LINK SAYS ABOUT ITSELF
//
// A profile link posted anywhere previewed as "Hire Power - Your Lifelong
// Career Coach" and the site's own description: the card said what this
// product is, when the thing being shared is a person. So the title becomes
// their name and the description becomes the headline of the direction the
// link opens on.
//
// ONLY FOR A PUBLISHED PROFILE
// A draft keeps the generic card, and that is the whole of the privacy
// argument here. An unpublished profile serves nothing to a link holder, and
// a preview card is read by machines that never load the page - a scraper, a
// chat client, a link unfurler - so a card built from a draft's contents
// would be the one thing on an unpublished profile that a stranger could
// read. `is_published === true` and nothing looser: a flag that is null or
// absent is not a publication.
//
// WHICH DIRECTION'S HEADLINE
// The one the link opens on. `?d=<slug>` names a direction, and with no
// parameter - or one that names a direction this profile does not show - the
// primary stands, which is exactly what the page itself does with it.
//
// Which directions are shown is `lensesShownBy`, imported rather than
// reimplemented. It is the same function the document route cuts its payload
// with, so a free profile - which renders its primary direction and nothing
// else - cannot have a second direction's headline on its card. A card is
// read by more people than the page, so a card describing a direction the
// page will not render is worse than a generic one.
//
// WHAT IT READS, AND WHAT IT DELIBERATELY DOES NOT
// Four columns across three tables: the profile's id, owner and published
// flag; the owner's display name and tier; and the directions' order, slugs
// and headlines. No resume_data. The page's own payload falls back to the
// core resume's fullName for a missing display name, and this does not - a
// card is not worth opening a resume for, and a profile with no display name
// simply keeps the generic one.
// ============================================================================

// Enough to order the directions the way _lib/directions does, name them, and
// read the one headline this is for. previous_slugs rides along because the
// page resolves old addresses with it and a card has to agree with the page.
const LENS_COLS = 'id, slug, status, sort_order, created_at, headline, previous_slugs'

const clean = (value) => {
  if (typeof value !== 'string') return null
  const text = value.replace(/\s+/g, ' ').trim()
  return text || null
}

/**
 * The direction a link opens on, from the ones this profile shows.
 *
 * Current addresses first and only then the ones a direction used to answer
 * to - the order is the rule, and it is the page's: a slug that is somebody's
 * current address always means that direction, even if another direction used
 * to have it. Reusing a name you abandoned must not hijack links to it.
 *
 * Anything unresolved falls to the first of the shown directions, which is
 * the primary, which is where an address with no parameter opens.
 */
function lensForLink(shown, wanted) {
  if (!shown.length) return null
  if (!wanted) return shown[0]

  const current = shown.find(lens => lens?.slug === wanted)
  if (current) return current

  const former = shown.find(lens =>
    Array.isArray(lens?.previous_slugs) && lens.previous_slugs.includes(wanted)
  )
  return former || shown[0]
}

/**
 * { title, description } for one profile, or null for every case that should
 * keep the site's generic card: no slug, no such profile, not published, no
 * display name, or a lookup that failed.
 *
 * Never throws. A card is decoration on a page that works either way, and a
 * database hiccup must not be what stops the page rendering.
 */
export async function profileCardFor(slug, directionSlug = null) {
  if (!slug) return null

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data: profile, error } = await supabase
      .from('career_profiles')
      .select('id, user_id, is_published')
      .eq('slug', slug)
      .maybeSingle()

    if (error || !profile) return null
    // The gate. Everything below this line is somebody's published page.
    if (profile.is_published !== true) return null

    const { data: person } = await supabase
      .from('profiles')
      .select('display_name, subscription_tier')
      .eq('id', profile.user_id)
      .maybeSingle()

    const name = clean(person?.display_name)
    // No name, no card worth having: "Hire Power" is a better answer than a
    // headline over a blank title.
    if (!name) return null

    // The headline is the only thing left to find, and the card is already
    // worth sending without one - so this failing costs the description and
    // nothing else.
    const { data: lenses } = await supabase
      .from('profile_lenses')
      .select(LENS_COLS)
      .eq('profile_id', profile.id)
      .eq('status', 'active')

    const shown = lensesShownBy(lenses || [], person?.subscription_tier)
    const headline = clean(lensForLink(shown, clean(directionSlug))?.headline)

    return { title: name, description: headline }
  } catch (err) {
    console.error('[career-profile] Profile card lookup failed (non-fatal):', err)
    return null
  }
}
