'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import Reveal from './Reveal'
import StrokeIcon, { ICON_MEDIA } from './StrokeIcon'
import PortfolioLightbox from './PortfolioLightbox'
import AddEvidence from './AddEvidence'
import { EditGrip, EditEmpty, useEditSlot } from './EditAffordance'
import { useCanShowEmpty } from '../_lib/editContext'
import { PORTFOLIO_PREVIEW_DESKTOP, formatDuration } from '@/lib/portfolio'

// ============================================================================
// PORTFOLIO
//
// The visual work, shown as work rather than as a list of files. Evidence
// answers "what backs this up"; this answers "what does it look like", and the
// two are the same table read through different questions - the split is one
// rule in lib/portfolio, so an item can never be in both or in neither.
//
// SQUARE MATS, CONTAINED PICTURES
// The grid is square because a grid of mixed aspect ratios is a ransom note.
// The pictures inside are not: `object-fit: contain` puts a portrait photo and
// a landscape still on the same mat without cropping either, and a crop is an
// edit nobody asked this page to make to somebody's work.
//
// THE THUMBNAIL IS ASKED FOR, NEVER CARRIED
// The payload says a preview exists; it never says where. Each mat asks the
// evidence media route for a signed thumbnail by id, and that route checks
// this direction may show this item before it signs anything. A signed URL
// lives ten minutes, so one that expires under a reader who left the page open
// is re-signed once on error rather than left as a broken square.
//
// THE SECTION IS THE SELECTION
// Six on the page and the rest one step away, for the reason the Evidence
// preview gives: a wall that grows with the collection turns a profile into a
// filing cabinet. Which six is the direction's own placement order, so the
// same portfolio can lead with different work under different directions.
// ============================================================================

export default function PortfolioSection({ items, slug, lensId, animate, directionKey }) {
  const [open, setOpen] = useState(null)   // { index } | null
  const [visit, setVisit] = useState(0)
  const [showAll, setShowAll] = useState(false)

  // A direction change replaces the collection. Anything open belonged to the
  // direction that is leaving, and so did the decision to show everything.
  const [shownFor, setShownFor] = useState(directionKey)
  if (shownFor !== directionKey) {
    setShownFor(directionKey)
    if (open) setOpen(null)
    if (showAll) setShowAll(false)
  }

  const canShowEmpty = useCanShowEmpty()
  const slot = useEditSlot()

  // Placement order, with whatever this direction marked pulled to the front.
  // Decided here and never written back: a default is not a choice the owner
  // made, which is the same rule the Evidence lead follows.
  const ordered = useMemo(() => {
    if (!items || items.length === 0) return []
    const featured = items.filter(one => one.featured)
    return featured.length > 0
      ? [...featured, ...items.filter(one => !one.featured)]
      : items
  }, [items])

  const openAt = useCallback((index) => {
    setVisit(n => n + 1)
    setOpen({ index })
  }, [])
  const close = useCallback(() => setOpen(null), [])

  // Empty, this section is not on the public page at all - the same rule every
  // other section follows. The owner still sees it, because an absence they
  // cannot see is an absence they cannot fill.
  if (ordered.length === 0 && !canShowEmpty) return null

  const shown = showAll ? ordered : ordered.slice(0, PORTFOLIO_PREVIEW_DESKTOP)
  const hidden = ordered.length - shown.length

  return (
    <section className="hp-section hp-pf-section">
      <div className="hp-wrap">
        <Reveal enabled={animate} className="hp-pf-intro">
          <span className="hp-label">Portfolio</span>
          <h2 className="hp-pf-headline">The work, as it looks.</h2>
        </Reveal>

        {ordered.length === 0 ? (
          <EditEmpty
            title="Add your visual work"
            note="Photographs and video of what you have built or run. They appear as a gallery a reader can open, and each one can sit under any of your directions."
          />
        ) : (
          <Reveal enabled={animate}>
            <ul className="hp-pf-grid" data-count={String(shown.length)}>
              {shown.map((item, index) => (
                <li className="hp-pf-cell" key={item.id}>
                  <PortfolioMat
                    item={item}
                    slug={slug}
                    lensId={lensId}
                    slot={slot}
                    onOpen={() => openAt(index)}
                  />
                </li>
              ))}
            </ul>

            {hidden > 0 && (
              <div className="hp-pf-more">
                <button type="button" className="hp-pf-all" onClick={() => setShowAll(true)}>
                  View full gallery ({ordered.length})
                  <span className="hp-pf-all-arrow" aria-hidden="true">→</span>
                </button>
              </div>
            )}
          </Reveal>
        )}

        <AddEvidence only="visual" />
      </div>

      <PortfolioLightbox
        key={`${directionKey}:${visit}`}
        items={ordered}
        startIndex={open?.index ?? 0}
        active={open !== null}
        slug={slug}
        lensId={lensId}
        onClose={close}
      />
    </section>
  )
}

// ---------------------------------------------------------------------------
// One mat.
//
// Its own component so each tile owns the state of its own picture: one
// thumbnail failing to sign is one mat falling back to its mark, not a section
// that decides it has no pictures.
// ---------------------------------------------------------------------------
function PortfolioMat({ item, slug, lensId, slot, onOpen }) {
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
    fetch(
      `/api/career-profile/${encodeURIComponent(slug)}/evidence/`
      + `${encodeURIComponent(item.id)}?variant=thumbnail${suffix}`
    )
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then(body => { if (live) setUrl(body.url || null) })
      .catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [wanted, slug, lensId, item?.id, attempt])

  const duration = item?.media_class === 'video' ? formatDuration(item.duration_seconds) : null
  const showPicture = wanted && url && !failed

  return (
    <button
      type="button"
      className={`hp-pf-mat${slot}`}
      data-media={item.media_class}
      onClick={onOpen}
      aria-haspopup="dialog"
    >
      <EditGrip />

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
