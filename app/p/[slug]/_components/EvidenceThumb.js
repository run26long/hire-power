'use client'

import { useEffect, useState } from 'react'

import StrokeIcon from './StrokeIcon'
import { glyphFor } from './EvidenceViewer'
import { forgetMediaUrl, mediaUrl } from '../_lib/mediaUrl'

// ============================================================================
// THE PICTURE ON A PIECE OF EVIDENCE, OR ITS MARK
//
// Its own module because four surfaces draw it: the lead card, the supporting
// tiles beside it, the cards in the All evidence gallery, and the rows in the
// Manage panel. It is the same square asking the same route the same question,
// and four copies of that would be four things to keep true.
//
// IT IS PORTFOLIOMAT'S PICTURE, UNDER OTHER NAMES
// The behaviour here is that component's, moved rather than reinvented: the
// same shared link cache, the same single retry on an expired signature, the
// same loading and decoding hints, the same `object-fit: contain` so nothing
// is cropped to fit a shape this page chose. Where the two differ is only what
// surrounds the picture - a mat is square and a tile has a band or a badge -
// and that is the stylesheet's business, not this file's.
//
// THE THUMBNAIL IS ASKED FOR, NEVER CARRIED
// The payload says a preview exists; it never says where. Each thumb asks the
// evidence media route for a signed URL by id, and that route checks this
// direction may show this item before it signs anything.
//
// AND IT ASKS AS WHOEVER IS LOOKING
// A draft profile serves its media to nobody but the owner, and the route
// works that out from the bearer token. See _lib/viewerAuth for where the
// token comes from and why it is not the edit context.
//
// AND THE OWNER ASKS A DIFFERENT ROUTE
// The Manage panel is the owner looking at everything they have, which
// deliberately includes the private items and the ones no direction is
// showing. Those are exactly the rows the public media route is built to
// refuse, so asking it for them was a 404 per row and a square that fell back
// to its mark for no reason the owner could see.
//
// `owner` asks the owner's own thumbnail route instead, which checks one
// thing: that the row belongs to the caller. The public route is untouched
// and still refuses everything it refused before. See _lib/mediaUrl for how
// one cache holds both kinds of answer.
//
// WHAT FALLS BACK TO THE MARK
// Everything that is not a picture: an item with no thumbnail, a signature
// that will not come, a file that has gone. On the public page, also anything
// this direction may not show - which is correct there, because the tile
// beside it is not showing it either.
// ============================================================================

export default function EvidenceThumb({
  item,
  slug,
  lensId,
  // The element that holds it. Each surface passes its own, because the slot
  // a picture stands in is that surface's composition - a band across the top
  // of a card, a square where a badge was - and this component decides what
  // goes inside the slot rather than what the slot is.
  className,
  markSize = 18,
  headers,
  // True on the owner's management surfaces, where the question is "is this
  // yours" rather than "may this direction show it".
  owner = false
}) {
  const [url, setUrl] = useState(null)
  const [failed, setFailed] = useState(false)

  // Counts the attempts rather than storing a flag, so the one retry after an
  // expired signature is a dependency change the effect below already reacts
  // to instead of a second effect watching the first.
  const [attempt, setAttempt] = useState(0)

  const wanted = item?.has_thumbnail === true

  // Which link is wanted, said once. The ask and the forget that follows a
  // failure have to name the same cache entry, and two spellings of it is one
  // of them drifting the day a field is added.
  const spec = { slug, id: item?.id, variant: 'thumbnail', lensId, owner }

  useEffect(() => {
    if (!wanted || !item?.id) return
    let live = true
    mediaUrl({ slug, id: item.id, variant: 'thumbnail', lensId, owner, headers })
      .then(body => { if (live) setUrl(body.url || null) })
      .catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [wanted, slug, lensId, owner, item?.id, attempt, headers])

  const showPicture = wanted && url && !failed

  return (
    <span className={className} data-thumb={showPicture ? 'true' : undefined} aria-hidden="true">
      {showPicture ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="hp-ev-thumb-img"
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          // A signed URL lives ten minutes. One that expires under a reader
          // who left the page open is asked for again, once - a second
          // failure is a real one and the slot keeps its mark.
          onError={() => {
            // The held link is the one that just failed, so it goes before
            // the retry asks again - otherwise the retry is handed the same
            // dead signature out of the cache and fails for the same reason.
            forgetMediaUrl(spec)
            if (attempt === 0) setAttempt(1)
            else setFailed(true)
          }}
        />
      ) : (
        <StrokeIcon paths={glyphFor(item?.media_class)} size={markSize} />
      )}
    </span>
  )
}
