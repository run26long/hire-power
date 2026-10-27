'use client'

import { useEffect, useState } from 'react'

import StrokeIcon, { ICON_MEDIA } from './StrokeIcon'
import { EditGrip } from './EditAffordance'
import { useViewerAuthHeaders } from '../_lib/viewerAuth'
import { formatDuration } from '@/lib/portfolio'

// ============================================================================
// ONE MAT
//
// Its own module because two grids draw it: the six on the page, and all of
// them in the full portfolio overlay. It was a private function inside the
// section until the overlay needed the same square, and a second copy of a
// tile that signs its own thumbnail is a second thing to keep true.
//
// SQUARE MAT, CONTAINED PICTURE
// The grid is square because a grid of mixed aspect ratios is a ransom note.
// The picture inside is not: `object-fit: contain` puts a portrait photo and a
// landscape still on the same mat without cropping either, and a crop is an
// edit nobody asked this page to make to somebody's work. The source file is
// never touched; this is presentation and only presentation.
//
// THE THUMBNAIL IS ASKED FOR, NEVER CARRIED
// The payload says a preview exists; it never says where. Each mat asks the
// evidence media route for a signed thumbnail by id, and that route checks
// this direction may show this item before it signs anything.
//
// Each mat owns the state of its own picture, so one thumbnail failing to sign
// is one mat falling back to its mark rather than a section that decides it
// has no pictures.
//
// AND IT ASKS AS WHOEVER IS LOOKING
// A draft profile serves its media to nobody but the owner, and the route
// works that out from the bearer token. The mat sent none, so on an
// unpublished profile the owner saw a grid of empty marks and an item that
// opened perfectly once clicked. The tile and the thing the tile opens have
// to ask the same question the same way, or the grid reports a problem the
// viewer cannot reproduce. See _lib/viewerAuth for where the token comes from
// and why it is not the edit context.
// ============================================================================

export default function PortfolioMat({ item, slug, lensId, slot = '', onOpen, matRef, gripProps }) {
  const viewerHeaders = useViewerAuthHeaders()
  const [url, setUrl] = useState(null)
  const [failed, setFailed] = useState(false)

  // Counts the attempts rather than storing a flag, so the one retry after an
  // expired signature is a dependency change the effect below already reacts
  // to instead of a second effect watching the first.
  const [attempt, setAttempt] = useState(0)

  const wanted = item?.has_thumbnail === true

  useEffect(() => {
    if (!wanted || !item?.id) return
    const suffix = lensId ? `&lens=${encodeURIComponent(lensId)}` : ''
    let live = true
    const ask = async () => {
      // The viewer's own session, where there is one. The route reads the
      // token and decides whether this caller owns the profile; a draft serves
      // its files to nobody else, and on a published profile the header
      // changes nothing. Asked of the session rather than the edit context
      // because Preview mode and the /p/<slug> link have no edit context, and
      // both of them are how an owner looks at their own unpublished page.
      const headers = await viewerHeaders()
      const res = await fetch(
        `/api/career-profile/${encodeURIComponent(slug)}/evidence/`
        + `${encodeURIComponent(item.id)}?variant=thumbnail${suffix}`,
        { headers }
      )
      if (!res.ok) throw new Error(String(res.status))
      return res.json()
    }
    ask()
      .then(body => { if (live) setUrl(body.url || null) })
      .catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [wanted, slug, lensId, item?.id, attempt, viewerHeaders])

  const duration = item?.media_class === 'video' ? formatDuration(item.duration_seconds) : null
  const showPicture = wanted && url && !failed

  return (
    <button
      type="button"
      className={`hp-pf-mat${slot}`}
      data-media={item.media_class}
      data-portfolio-id={item.id}
      ref={matRef}
      onClick={onOpen}
      aria-haspopup="dialog"
    >
      <EditGrip {...(gripProps || {})} />

      <span className="hp-pf-mat-frame">
        {showPicture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="hp-pf-mat-img"
            src={url}
            alt={item.title || ''}
            loading="lazy"
            decoding="async"
            // A signed URL lives ten minutes. One that expires under a reader
            // who left the page open is asked for again, once - a second
            // failure is a real one and the mat keeps its mark.
            onError={() => (attempt === 0 ? setAttempt(1) : setFailed(true))}
          />
        ) : (
          <span className="hp-pf-mat-mark" aria-hidden="true">
            <StrokeIcon paths={ICON_MEDIA[item.media_class] || ICON_MEDIA.default} size={26} strokeWidth={1.2} />
          </span>
        )}

        {/* On the picture rather than beside it: a play mark under a still is
            a caption, and a reader has to be told this one moves. */}
        {item.media_class === 'video' && (
          <span className="hp-pf-play" aria-hidden="true">
            <span className="hp-pf-play-tri" />
          </span>
        )}

        {duration && <span className="hp-pf-time">{duration}</span>}
      </span>

      <span className="hp-pf-mat-title">{item.title}</span>
    </button>
  )
}
