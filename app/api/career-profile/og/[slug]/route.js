import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { ImageResponse } from 'next/og'

import { SITES } from '@/lib/siteMetadata'
import { profileCardFor } from '@/app/p/[slug]/profileMetadata'

// ============================================================================
// GET /api/career-profile/og/[slug]?d=<direction>
//
// THE PICTURE ON A SHARED CAREER PROFILE LINK
//
// The title and the description on a profile link became the person's a while
// back; the picture stayed the Hire Power house card, so every profile ever
// posted anywhere showed the same tagline about career coaching next to
// somebody's name. This draws the card for the person instead.
//
// IT IS THE HOUSE CARD WITH THE MIDDLE REPLACED
// Same near-black, same two glows, same gradient mark and HIRE POWER at the
// top left, same gradient rule along the bottom, same hirepowerai.com at the
// bottom right. Every colour in here was sampled out of
// public/og/hirepower-opengraph-image.png rather than guessed, so the two sit
// beside each other in a timeline without one looking like a near miss of the
// other. What changes is the middle: the tagline becomes the name, and the
// line under it becomes the direction's headline.
//
// The house card's own strapline along the bottom left is gone with the
// tagline it belonged to. This card is about one person, and a sentence about
// what the product does, under their name, reads as a caption on them.
//
// WHY IT IS A ROUTE HANDLER RATHER THAN app/p/[slug]/opengraph-image.js
// The direction. Next's opengraph-image convention compiles a file into
// `GET(_, ctx) { return handler({ params: ctx.params }) }` - the Request is
// thrown away before the module is reached, so nothing in such a file can ever
// see a query string, and `?d=` is a query string. The words on the card do
// follow it, because generateMetadata is handed searchParams; a picture that
// could not would have meant a link to one direction captioned with that
// direction's headline and illustrated with another's.
//
// So the renderer lives at an address we control and the page names it in
// openGraph.images with the direction attached. Everything else about it is
// unchanged - same ImageResponse, same card, same rules.
//
// WHAT IT WILL AND WILL NOT DRAW
// profileCardFor decides, and it is the same function the title and the
// description already come from - called here with the same direction - so the
// picture cannot say something the words do not. Unpublished, no display name,
// no such profile, or any error at all: this draws nothing and hands back the
// house card. A draft must not have a picture of itself, for the reason
// profileMetadata gives at length: a preview card is read by machines that
// never load the page.
//
// NO AUTHENTICATION, AND NOTHING TO AUTHENTICATE
// The slug is the whole key, the same as the document route, and the published
// gate is inside profileCardFor rather than here. It reads a name and one
// headline. Anybody who can see this image could have read both off the page.
//
// THE FONT COMES OFF DISK
// Satori needs real font data, and fetching it at render time would put a
// network call on every scrape. Lato is the application's own typeface and is
// already in public/fonts; next.config.mjs names these two files in this
// route's trace so they are present in production as well as locally.
// ============================================================================

const SIZE = { width: 1200, height: 630 }

// Sampled from public/og/hirepower-opengraph-image.png.
const INK = '#0d0a1c'
const WHITE = '#f4f3fb'
const PERIWINKLE = '#8b93f0'
const LILAC = '#a28fe8'
const DOMAIN = '#c9cdfb'
const BRAND_FROM = '#667eea'
const BRAND_TO = '#764ba2'

// 1200 wide less the 80 of padding on each side.
const COLUMN = 1040

// A ceiling and a floor around one piece of arithmetic. Lato Bold averages
// close to half an em across mixed-case text, so characters x 0.53 x size is
// roughly how wide a line will be, and solving it for the column width gives
// the size that fills one line. The ceiling keeps a short name from turning
// into a poster; the floor stops a long one shrinking to nothing and lets it
// wrap onto a second line instead, which is what a long name should do.
const NAME_FILL = Math.round(COLUMN / 0.53)
const NAME_MAX = 72
const NAME_MIN = 34
const NAME_CHARS = 80

// Three steps rather than arithmetic: a headline is a sentence, it is allowed
// to run to three lines, and the only thing being avoided is a long one set so
// large it crowds the name above it. 200 characters is the stored ceiling, and
// 200 at 24px is under three lines of this column.
const HEADLINE_CHARS = 200
const headlineSize = (length) => (length <= 70 ? 32 : length <= 140 ? 28 : 24)

// Cut at the last word boundary inside the budget, so a headline that has to
// be shortened ends on a word rather than mid-syllable. A run with no space in
// it at all - which is the only way a stored headline reaches the ceiling -
// has no boundary to find, so it is cut where it lands.
const clampText = (value, limit) => {
  const text = String(value || '').trim()
  if (text.length <= limit) return text
  const cut = text.slice(0, limit - 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > limit * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`
}

// The house card's lightning mark, white on the gradient tile.
const BOLT = 'M13 2 L3 14 h7 l-1 8 l10 -12 h-7 l1 -8 z'

// A redirect rather than a copy of the file: the PNG is already served by both
// domains, and every scraper that reads an og:image follows one.
//
// The caller's own origin first, so this answers on localhost and on a preview
// deployment as itself rather than sending a developer's scraper to
// production. In the case this actually exists for - a scraper following the
// og:image tag the page printed - that origin is hirepowerai.com, because that
// is what the tag said.
function houseCard(request) {
  let origin = process.env.NEXT_PUBLIC_SITE_URL || SITES.hirePower.origin
  try {
    origin = new URL(request.url).origin
  } catch {
    // Keep the configured one. A request with no parsable URL is not a thing
    // that should cost somebody their share card.
  }
  return Response.redirect(`${origin.replace(/\/+$/, '')}${SITES.hirePower.image}`, 302)
}

// The card itself, out here rather than inline in the handler below, so the
// handler's try/catch is not wrapped around a JSX expression. Satori renders
// this synchronously inside the ImageResponse constructor, so a failure in it
// still lands in that catch - but the lint rule that watches for JSX inside a
// try is right about React components in general, and arguing with it in every
// future reader's head costs more than one function does.
function profileCard({ name, headline, nameSize }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        padding: '72px 80px 80px',
        background: INK,
        fontFamily: 'Lato'
      }}
    >
      {/* The two glows, as their own elements rather than as layers on one
          background, so each is positioned where it was sampled. Both are
          far bigger than the area they light: the house card's glows have
          a flat plateau and a long falloff, and a small circle with a
          steep one reads as a disc rather than as light. The numbers were
          fitted against the sampled values rather than eyeballed - the
          top right peaks at rgb(28,30,64) over rgb(13,10,28), and this
          lands within a unit or two of that. */}
      <div
        style={{
          position: 'absolute',
          top: -365,
          left: 360,
          width: 1300,
          height: 1000,
          backgroundImage:
            `radial-gradient(circle at center, rgba(88,110,208,0.22) 0%, rgba(13,10,28,0) 85%)`
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -150,
          left: -180,
          width: 680,
          height: 540,
          backgroundImage:
            `radial-gradient(circle at center, rgba(118,75,162,0.16) 0%, rgba(13,10,28,0) 70%)`
        }}
      />

      {/* Masthead */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 13,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundImage: `linear-gradient(135deg, ${BRAND_FROM} 0%, ${BRAND_TO} 100%)`
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="#ffffff">
            <path d={BOLT} />
          </svg>
        </div>
        <div
          style={{
            display: 'flex',
            marginLeft: 18,
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: 1.4
          }}
        >
          <span style={{ color: WHITE }}>HIRE</span>
          <span style={{ color: PERIWINKLE, marginLeft: 11 }}>POWER</span>
        </div>
      </div>

      {/* The person. flexGrow takes the whole middle, so a one-line name
          and a three-line headline both sit in the same optical place. */}
      <div
        style={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: nameSize,
            fontWeight: 700,
            lineHeight: 1.06,
            letterSpacing: -1,
            color: WHITE,
            // A display name is whatever somebody typed, and a single
            // unbroken 80-character token has no space to wrap at. This
            // is what stops it running off the right edge instead.
            wordBreak: 'break-word'
          }}
        >
          {name}
        </div>
        {headline ? (
          <div
            style={{
              display: 'flex',
              marginTop: 20,
              fontSize: headlineSize(headline.length),
              fontWeight: 400,
              lineHeight: 1.3,
              color: LILAC,
              wordBreak: 'break-word'
            }}
          >
            {headline}
          </div>
        ) : null}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, color: DOMAIN }}>
          hirepowerai.com
        </div>
      </div>

      {/* The rule along the very bottom, 6px, the brand gradient. */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 6,
          backgroundImage: `linear-gradient(90deg, ${BRAND_FROM} 0%, ${BRAND_TO} 100%)`
        }}
      />
    </div>
  )
}

export async function GET(request, { params }) {
  try {
    const { slug } = await params

    // The direction the link opens on, spelled the way the page spells it.
    // Whatever is here was put here by the page's own generateMetadata, which
    // passed the same value to profileCardFor for the title and description -
    // so the two readings cannot disagree. A direction this profile does not
    // show, or none at all, resolves to the primary inside profileCardFor, the
    // same as it does for the words.
    const asked = new URL(request.url).searchParams.get('d')

    const card = await profileCardFor(slug, asked)
    if (!card) return houseCard(request)

    const [bold, regular] = await Promise.all([
      readFile(join(process.cwd(), 'public/fonts/Lato-Bold.ttf')),
      readFile(join(process.cwd(), 'public/fonts/Lato-Regular.ttf'))
    ])

    const name = clampText(card.title, NAME_CHARS)
    const headline = clampText(card.description, HEADLINE_CHARS)
    const nameSize = Math.max(NAME_MIN, Math.min(NAME_MAX, Math.round(NAME_FILL / (name.length || 1))))

    return new ImageResponse(profileCard({ name, headline, nameSize }), {
      ...SIZE,
      fonts: [
        { name: 'Lato', data: bold, weight: 700, style: 'normal' },
        { name: 'Lato', data: regular, weight: 400, style: 'normal' }
      ]
    })
  } catch (error) {
    // A missing font file, a database that will not answer, anything at all.
    // The card a link shows is decoration on a page that works either way, and
    // the house card is a correct answer rather than a degraded one.
    console.error('[career-profile] Profile share image failed (non-fatal):', error)
    return houseCard(request)
  }
}
