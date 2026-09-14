'use client'

import { useEffect, useState } from 'react'

import StrokeIcon, { ICON_MEDIA } from './StrokeIcon'

// ============================================================================
// THE EVIDENCE DETAIL
//
// One piece of evidence, shown in full. This is the content only - the surface
// it sits on, and everything that makes that surface a dialog, belongs to
// EvidenceOverlay, because the same surface also holds the gallery and a reader
// moves between the two without a second layer ever opening over the first.
//
// An uploaded file is never addressed by path. The viewer asks this profile's
// evidence route for a signed link by id, with the direction the reader is
// looking through, and that route decides for itself whether this direction may
// show this item before it signs anything.
//
// A general external page is never framed. Somebody else's site is shown as the
// preview its owner wrote and a deliberate way out, not embedded - an iframe of
// an arbitrary origin is somebody else's code running inside this page.
// ============================================================================

const SAFE_URL = /^https?:\/\//i

// Only these are ever put in a frame, and only on the stored embed address.
const EMBEDDABLE = new Set(['youtube', 'vimeo'])

// The glyph the stage falls back to when there is nothing to render inline.
// It says what the thing is rather than standing in as a blank shape, which is
// the whole difference between a preview and a missing image.
const ICON_FOR = { embed: 'video', other: 'default' }
export const glyphFor = (mediaClass) =>
  ICON_MEDIA[ICON_FOR[mediaClass] || mediaClass] || ICON_MEDIA.default

export const externalUrl = (item) =>
  SAFE_URL.test(String(item?.url || '')) ? item.url : null

export const metaLine = (item) =>
  [item?.evidence_type, item?.organization, item?.date_label].filter(Boolean).join(' · ')

const isEmbeddable = (item) =>
  item?.media_class === 'embed'
  && EMBEDDABLE.has(String(item.provider || '').toLowerCase())
  && SAFE_URL.test(String(item.embed_url || ''))

// ---------------------------------------------------------------------------
// The stage: whatever this thing actually is, on screen.
// ---------------------------------------------------------------------------
export function EvidenceStage({ item, slug, lensId }) {
  const [media, setMedia] = useState({ id: null, state: 'idle', url: null, mime: null })

  const needsFile = Boolean(item?.has_file)

  // The direction goes with the request, and the answer is stamped with the
  // direction and the id it answers for, so a reply arriving late can never be
  // read against a different item or a direction the reader has since left.
  // Nothing is cached: a new opening asks again, because a link that outlives
  // its signature is worse than no link at all.
  const stamp = `${lensId || ''}:${item?.id || ''}`

  useEffect(() => {
    if (!needsFile || !item?.id) return
    const key = `${lensId || ''}:${item.id}`
    const suffix = lensId ? `?lens=${encodeURIComponent(lensId)}` : ''

    let live = true
    fetch(`/api/career-profile/${encodeURIComponent(slug)}/evidence/${encodeURIComponent(item.id)}${suffix}`)
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then(body => { if (live) setMedia({ id: key, state: 'ready', url: body.url, mime: body.mime_type || null }) })
      .catch(() => { if (live) setMedia({ id: key, state: 'failed', url: null, mime: null }) })
    return () => { live = false }
  }, [needsFile, slug, lensId, item?.id])

  if (!item) return null

  const file = !needsFile
    ? { state: 'idle', url: null, mime: null }
    : media.id === stamp
      ? media
      : { state: 'loading', url: null, mime: null }

  if (needsFile && file.state === 'loading') {
    return <p className="hp-ev-note">Opening…</p>
  }
  if (needsFile && file.state === 'failed') {
    return <p className="hp-ev-note">This file could not be opened right now.</p>
  }

  if (item.media_class === 'image' && file.url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="hp-ev-image" src={file.url} alt={item.title} />
  }
  if (item.media_class === 'video' && file.url) {
    return <video className="hp-ev-video" src={file.url} controls playsInline preload="metadata" />
  }
  if (item.media_class === 'audio' && file.url) {
    // A bare player floating on a surface reads as a broken page. The mark
    // gives the recording something to sit on and something to be.
    return (
      <div className="hp-ev-audio">
        <span className="hp-ev-audio-mark" aria-hidden="true">
          <StrokeIcon paths={ICON_MEDIA.audio} size={34} strokeWidth={1.2} />
        </span>
        <audio className="hp-ev-audio-player" src={file.url} controls preload="metadata" />
      </div>
    )
  }
  if (item.media_class === 'document' && file.url) {
    return (
      <div className="hp-ev-doc">
        <object className="hp-ev-object" data={file.url} type={file.mime || 'application/pdf'}>
          <p className="hp-ev-note">This document cannot be shown inside the page on this browser.</p>
        </object>
      </div>
    )
  }
  if (isEmbeddable(item)) {
    return (
      <div className="hp-ev-frame">
        <iframe
          className="hp-ev-iframe"
          src={item.embed_url}
          title={item.title}
          loading="lazy"
          allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
    )
  }

  // Everything else, and every ordinary external page: what the owner wrote
  // about it, and a way out that the reader has to choose.
  const external = externalUrl(item)
  return (
    <div className="hp-ev-preview">
      <span className="hp-ev-preview-mark" aria-hidden="true" data-media={item.media_class}>
        <StrokeIcon paths={glyphFor(item.media_class)} size={34} strokeWidth={1.2} />
      </span>
      <p className="hp-ev-preview-note">
        {external
          ? 'This lives on another site. It opens in a new tab.'
          : 'There is nothing to open for this item yet.'}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// The foot: what the owner said about it, and the way out to the original.
// ---------------------------------------------------------------------------
export function EvidenceFoot({ item }) {
  const external = externalUrl(item)
  if (!item?.description && !external) return null

  return (
    <div className="hp-ev-foot">
      {item.description && <p className="hp-ev-description">{item.description}</p>}
      {external && (
        <a className="hp-ev-out" href={external} target="_blank" rel="noopener noreferrer">
          Visit original
        </a>
      )}
    </div>
  )
}
