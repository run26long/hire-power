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
// THE CARD IS THE SITE'S, WITH TWO LINES REPLACED
// The image, the type, the site name and twitter's card shape all come from
// lib/siteMetadata, the same Hire Power card every other page carries. What a
// profile changes is the title and the description, and it changes them in
// all three places at once - the document title, og, and twitter - so a
// reader, a scraper and a timeline are never told three different things.
//
// A profile that is not published, or has no display name, returns nothing
// here and inherits the root layout's card untouched. See ./profileMetadata
// for why a draft must not describe itself.
// ============================================================================

export async function generateMetadata({ params, searchParams }) {
  const { slug } = await params
  const query = await searchParams

  // 'd' is the direction parameter, spelled the way ProfileDocument spells
  // it. Repeated rather than imported because that constant lives inside a
  // client component, and the array form a repeated parameter produces is not
  // a direction either way.
  const asked = query?.d
  const card = await profileCardFor(slug, typeof asked === 'string' ? asked : null)

  const site = SITES.hirePower
  const base = shareCardFor(site)
  if (!card) return base

  const description = card.description || site.description

  return {
    ...base,
    title: card.title,
    description,
    openGraph: { ...base.openGraph, title: card.title, description },
    twitter: { ...base.twitter, title: card.title, description }
  }
}

export default function CareerProfilePage() {
  return <CareerProfileView />
}
