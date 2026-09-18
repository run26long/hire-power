'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ============================================================================
// A PDF, RENDERED RATHER THAN HANDED TO THE BROWSER
//
// This used to be an <object>, which asks the browser to show the file and
// accepts whatever answer it gives. That answer is not ours to control: Chrome
// has a "Download PDFs instead of automatically opening them" preference that
// turns the element into nothing, iOS Safari will not render a PDF from a
// short-lived signed URL inside a frame at all, and an extension can take the
// plugin out from under it. The reader then meets an empty rectangle inside a
// modal that is otherwise working perfectly, and there is nothing on screen to
// say why.
//
// So the pages are drawn here instead, onto canvases, by pdfjs. The only thing
// the browser has to be able to do is paint a canvas.
//
// WHY THIS AND NOT app/components/PDFViewer.js
// That component exists and does the same job for the resume preview, but it
// carries its own scroll container, its own grey field and Tailwind classes,
// none of which belong on this surface. The Evidence modal already has a
// scroller - .hp-ev-stage, with the thin accent scrollbar the rest of the
// dialog uses - and a second one inside it would put two bars side by side and
// trap the wheel in the inner one. This renders pages and nothing else, and
// lets the stage scroll them.
//
// FIT TO THE MODAL, NOT TO THE PAGE
// Each page is scaled so its width matches the container's, so a US Letter
// certificate and an A4 case study both fill the same measure instead of one
// of them sitting in a column of dead space. The backing store is multiplied
// by the device pixel ratio on top of that, because a canvas laid out at CSS
// width and rendered at CSS width is soft on every retina screen.
//
// A resize re-renders at the new width rather than stretching the old bitmap,
// which is the difference between a re-scaled page and a blurred one.
//
// WHAT HAPPENS WHEN IT REALLY CANNOT
// Only then is there a way out to the file itself. It is a fallback, not the
// feature: an "open in a new tab" button offered up front is an admission that
// the viewer does not work, and this one does.
// ============================================================================

// Served from /public so the version always matches the pdfjs-dist in
// package.json. Same file app/components/PDFViewer.js already relies on.
const WORKER_SRC = '/pdf.worker.min.mjs'

// Beyond this a page is being rendered for a screen nobody has. Retina at a
// wide modal is 2; the cap only stops a pathological devicePixelRatio turning
// one page into a 100MB backing store.
const MAX_PIXEL_RATIO = 2

// Below this the container has not been laid out yet and any scale computed
// from it would be wrong.
const MIN_USABLE_WIDTH = 80

export default function EvidencePdf({ url, title, fallbackUrl }) {
  const hostRef = useRef(null)
  const [state, setState] = useState('loading')   // loading | ready | failed
  const [pageCount, setPageCount] = useState(0)

  // Bumped by the resize observer. Re-renders at the new measure.
  const [width, setWidth] = useState(0)

  // Every render task in flight, so a cancelled pass stops drawing rather than
  // racing the one that replaced it.
  const tasksRef = useRef([])

  const measure = useCallback(() => {
    const host = hostRef.current
    if (!host) return
    const next = Math.round(host.clientWidth)
    if (next >= MIN_USABLE_WIDTH) setWidth(prev => (Math.abs(prev - next) > 1 ? next : prev))
  }, [])

  useEffect(() => {
    measure()
    const host = hostRef.current
    if (!host || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(host)
    return () => observer.disconnect()
  }, [measure])

  useEffect(() => {
    if (!url || width < MIN_USABLE_WIDTH) return

    let cancelled = false
    const cancelAll = () => {
      for (const task of tasksRef.current) { try { task.cancel() } catch { /* already done */ } }
      tasksRef.current = []
    }

    async function draw() {
      setState('loading')
      let pdf
      try {
        const pdfjs = await import('pdfjs-dist/build/pdf.mjs')
        pdfjs.GlobalWorkerOptions.workerSrc = WORKER_SRC
        pdf = await pdfjs.getDocument(url).promise
        if (cancelled) { try { pdf.destroy() } catch { /* nothing to destroy */ } return }
      } catch (error) {
        if (!cancelled) {
          console.error('[evidence] PDF could not be opened:', error)
          setState('failed')
        }
        return
      }

      const host = hostRef.current
      if (!host) return

      // Built detached and swapped in at the end, so the reader never watches
      // pages appear one at a time over a half-empty field.
      const stack = document.createElement('div')
      stack.className = 'hp-ev-pdf-stack'

      const ratio = Math.min(MAX_PIXEL_RATIO, Math.max(1, window.devicePixelRatio || 1))

      try {
        setPageCount(pdf.numPages)

        for (let n = 1; n <= pdf.numPages; n++) {
          if (cancelled) break

          const page = await pdf.getPage(n)
          if (cancelled) break

          // The page at its own size, then the factor that makes it exactly as
          // wide as the space it has to sit in.
          const natural = page.getViewport({ scale: 1 })
          const viewport = page.getViewport({ scale: (width / natural.width) * ratio })

          const sheet = document.createElement('div')
          sheet.className = 'hp-ev-pdf-page'

          const canvas = document.createElement('canvas')
          canvas.className = 'hp-ev-pdf-canvas'
          canvas.width = Math.floor(viewport.width)
          canvas.height = Math.floor(viewport.height)
          // Laid out at CSS width; drawn at ratio times that.
          canvas.style.aspectRatio = `${viewport.width} / ${viewport.height}`
          canvas.setAttribute('role', 'img')
          canvas.setAttribute(
            'aria-label',
            pdf.numPages > 1 ? `${title || 'Document'}, page ${n} of ${pdf.numPages}` : (title || 'Document')
          )

          const task = page.render({ canvasContext: canvas.getContext('2d'), viewport })
          tasksRef.current.push(task)
          await task.promise
          if (cancelled) break

          sheet.appendChild(canvas)

          if (pdf.numPages > 1) {
            const badge = document.createElement('span')
            badge.className = 'hp-ev-pdf-badge'
            badge.textContent = `${n} / ${pdf.numPages}`
            badge.setAttribute('aria-hidden', 'true')
            sheet.appendChild(badge)
          }

          stack.appendChild(sheet)
        }

        if (cancelled) return

        host.replaceChildren(stack)
        setState('ready')
      } catch (error) {
        // A cancelled render is the expected result of a resize or a close, not
        // a failure worth showing anybody.
        if (cancelled || error?.name === 'RenderingCancelledException') return
        console.error('[evidence] PDF could not be drawn:', error)
        setState('failed')
      } finally {
        try { pdf.destroy() } catch { /* already gone */ }
      }
    }

    draw()

    return () => {
      cancelled = true
      cancelAll()
    }
  }, [url, width, title])

  return (
    <div className="hp-ev-pdf" data-state={state} data-pages={pageCount || undefined}>
      <div className="hp-ev-pdf-host" ref={hostRef} />

      {state === 'loading' && <p className="hp-ev-note hp-ev-pdf-status">Rendering document…</p>}

      {state === 'failed' && (
        <div className="hp-ev-pdf-status">
          <p className="hp-ev-note">This document could not be rendered here.</p>
          {fallbackUrl && (
            <a className="hp-ev-out" href={fallbackUrl} target="_blank" rel="noopener noreferrer">
              Open in a new tab
            </a>
          )}
        </div>
      )}
    </div>
  )
}
