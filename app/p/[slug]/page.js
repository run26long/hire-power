import { SITES, shareCardFor } from '@/lib/siteMetadata'

import CareerProfileView from './_components/CareerProfileView'
import { profileCardFor } from './profileMetadata'

// ============================================================================
// /p/[slug]: the public Career Profile.
//
// A server component with nothing in it but the card a shared link shows. The
// page itself is CareerProfileView, which is the client component this file
// used to be - it fetches the profile, holds the load states and renders the
// document, and none of that changed in moving.
//
// WHY IT HAD TO SPLIT
// `generateMetadata` cannot live in a client component, and a layout does not
// receive searchParams - and the direction a link opens on is a search
// parameter, `?d=<slug>`. So the metadata belongs to a server page, and the
// page it describes is its child.
//
// THE CARD IS THE SITE'S, WITH THE MIDDLE REPLACED
// The type, the site name and twitter's card shape all come from
// lib/siteMetadata, the same Hire Power card every other page carries. What a
// profile changes is the title, the description and the picture, and it
// changes the words in all three places at once - the document title, og, and
// twitter - so a reader, a scraper and a timeline are never told three
// different things.
//
// THE PICTURE CARRIES THE DIRECTION TOO
// It is /api/career-profile/og/[slug], named here rather than left to Next's
// opengraph-image file convention, and the whole reason is the `?d=` this
// function is holding. A convention file is compiled into a handler that is
// called without the Request, so nothing inside one can read a query string;
// naming the address ourselves is what lets the direction travel with it. The
// picture is then drawn from the same profileCardFor call this makes, with the
// same direction, so the image and the words are two renderings of one answer
// rather than two answers.
//
// Absolute, for the reason lib/siteMetadata gives about the house images: a
// preview fetcher does not always have a page origin to resolve against, and
// this is always the Hire Power card, so it is always the Hire Power origin.
//
// A profile that is not published, or has no display name, returns nothing
// here and inherits the root layout's card - house PNG and all - untouched.
// See ./profileMetadata for why a draft must not describe itself.
// ============================================================================

export async function generateMetadata({ params, searchParams }) {
  const { slug } = await params
  const query = await searchParams

  // 'd' is the direction parameter, spelled the way ProfileDocument spells
  // it. Repeated rather than imported because that constant lives inside a
  // client component, and the array form a repeated parameter produces is not
  // a direction either way.
  const asked = query?.d
  const direction = typeof asked === 'string' ? asked : null
  const card = await profileCardFor(slug, direction)

  const site = SITES.hirePower
  const base = shareCardFor(site)
  if (!card) return base

  const description = card.description || site.description

  // The same direction the card above was built from, so the renderer is
  // answering the question this already answered. Encoded rather than
  // interpolated raw: a display slug is a stored string, and a stored string
  // going into a URL gets encoded whether or not today's validation would
  // have let anything odd into it.
  const image = `${site.origin}/api/career-profile/og/${encodeURIComponent(slug)}`
    + (direction ? `?d=${encodeURIComponent(direction)}` : '')

  return {
    ...base,
    title: card.title,
    description,
    openGraph: {
      ...base.openGraph,
      title: card.title,
      description,
      // Not site.imageAlt, which describes the house PNG. This picture is a
      // person's card, and the alt it carried as a convention file said so.
      images: [{ url: image, width: 1200, height: 630, alt: 'Career Profile on Hire Power' }]
    },
    twitter: { ...base.twitter, title: card.title, description, images: [image] }
  }
}

export default function CareerProfilePage() {
  return <CareerProfileView />
}
