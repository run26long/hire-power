'use client'

import { useCallback, useMemo, useState } from 'react'

import Reveal from './Reveal'
import PortfolioLightbox from './PortfolioLightbox'
import PortfolioMat from './PortfolioMat'
import AddEvidence from './AddEvidence'
import { EditEmpty, UpgradeNote, useEditSlot } from './EditAffordance'
import { useCanShowEmpty, useCanEdit } from '../_lib/editContext'
import { PORTFOLIO_PREVIEW_DESKTOP } from '@/lib/portfolio'

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
  // null | { mode: 'grid' } | { mode: 'item', index, fromGrid }
  const [overlay, setOverlay] = useState(null)
  const [visit, setVisit] = useState(0)

  // A direction change replaces the collection. Anything open belonged to the
  // direction that is leaving.
  const [shownFor, setShownFor] = useState(directionKey)
  if (shownFor !== directionKey) {
    setShownFor(directionKey)
    if (overlay) setOverlay(null)
  }

  const canShowEmpty = useCanShowEmpty()
  const canEdit = useCanEdit()
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

  // The two ways in each start a visit, so the overlay mounts fresh. Moving
  // between the grid and one item inside a single visit keeps the key, and
  // therefore the scroll position the grid was left at.
  const openAt = useCallback((index) => {
    setVisit(n => n + 1)
    setOverlay({ mode: 'item', index, fromGrid: false })
  }, [])
  const openGrid = useCallback(() => {
    setVisit(n => n + 1)
    setOverlay({ mode: 'grid' })
  }, [])

  // ...and these two move around inside one.
  const fromGrid = useCallback((index) => setOverlay({ mode: 'item', index, fromGrid: true }), [])
  const backToGrid = useCallback(() => setOverlay({ mode: 'grid' }), [])
  const close = useCallback(() => setOverlay(null), [])

  // Empty, this section is not on the public page at all - the same rule every
  // other section follows. The owner still sees it, because an absence they
  // cannot see is an absence they cannot fill.
  if (ordered.length === 0 && !canShowEmpty) return null

  // Always the selection, never the archive: six, in the order the owner put
  // them in, with whatever this direction featured pulled to the front above.
  const shown = ordered.slice(0, PORTFOLIO_PREVIEW_DESKTOP)
  const hidden = ordered.length - shown.length

  return (
    <div className="hp-practice-part hp-pf-section">
        <Reveal enabled={animate} className="hp-pf-intro">
          <h3 className="hp-practice-sub">Portfolio</h3>
          <p className="hp-practice-line">The work, in frame and in motion.</p>
        </Reveal>

        {ordered.length === 0 ? (
          <EditEmpty
            feature="portfolio"
            shape="grid"
            title="Add your visual work"
            note="Photographs and video of what you have built or run. Six sit here as a gallery a reader can open, and each one can appear under any of your directions."
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

            {/* Offered only when there is something the six did not show.
                Six or fewer and the grid is the whole portfolio, so an action
                promising more would open a gallery the reader has already
                read. */}
            {hidden > 0 && (
              <div className="hp-pf-more">
                <button
                  type="button"
                  className="hp-pf-all"
                  onClick={openGrid}
                  aria-haspopup="dialog"
                >
                  View full portfolio
                  <span className="hp-pf-all-arrow" aria-hidden="true">→</span>
                </button>
              </div>
            )}
          </Reveal>
        )}

        {canEdit
          ? <AddEvidence only="visual" />
          : ordered.length > 0 ? <UpgradeNote feature="portfolio" /> : null}

      <PortfolioLightbox
        key={`${directionKey}:${visit}`}
        mode={overlay?.mode || null}
        items={ordered}
        startIndex={overlay?.index ?? 0}
        slug={slug}
        lensId={lensId}
        onOpenItem={fromGrid}
        onBack={overlay?.fromGrid ? backToGrid : null}
        onClose={close}
      />
    </div>
  )
}
