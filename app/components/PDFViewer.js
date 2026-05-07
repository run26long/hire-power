'use client'

import { useEffect, useRef, useState } from 'react'

// ─────────────────────────────────────────────
// PDF VIEWER
// Renders a PDF onto canvas elements using PDF.js.
// Used in the preview modal so PDFs display reliably regardless of
// the user's browser PDF settings (Chrome's "Download PDFs" preference,
// iOS Safari blob URL limitations, etc).
//
// Lazy-loads pdfjs-dist on mount so the library bytes only ship to
// users who actually open a preview.
// ─────────────────────────────────────────────
export default function PDFViewer({ url }) {
  const containerRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!url) return

    let cancelled = false

    async function render() {
      setLoading(true)
      setError(null)

      try {
        // Lazy-load PDF.js only when the modal opens.
        const pdfjsLib = await import('pdfjs-dist/build/pdf.mjs')

        // PDF.js needs a "worker" script to parse PDFs without freezing the page.
        // We serve it from /public so the version always matches pdfjs-dist
        // and we don't depend on an external CDN.
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

        // Fetch the PDF bytes and hand them to PDF.js.
        const loadingTask = pdfjsLib.getDocument(url)
        const pdf = await loadingTask.promise

        if (cancelled) return

        // Clear any previously rendered pages (e.g. on URL change).
        const container = containerRef.current
        if (!container) return
        container.innerHTML = ''

        // Render each page onto its own canvas, stacked vertically.
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          if (cancelled) return

          const page = await pdf.getPage(pageNum)

          // Render at 2x resolution for sharpness on high-DPI screens.
          const scale = 2
          const viewport = page.getViewport({ scale })

          const canvas = document.createElement('canvas')
          canvas.width = viewport.width
          canvas.height = viewport.height
          // Display size: fill the container width, height proportional.
          canvas.style.width = '100%'
          canvas.style.height = 'auto'
          canvas.style.display = 'block'
          if (pageNum > 1) canvas.style.marginTop = '12px'

          const context = canvas.getContext('2d')
          await page.render({ canvasContext: context, viewport }).promise

          if (cancelled) return
          container.appendChild(canvas)
        }

        setLoading(false)
      } catch (err) {
        if (cancelled) return
        console.error('PDFViewer render error:', err)
        setError('Could not load preview. Please try again.')
        setLoading(false)
      }
    }

    render()

    return () => { cancelled = true }
  }, [url])

  return (
    <div className="w-full h-full overflow-y-auto bg-white">
      {loading && (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
      )}
      {error && (
        <div className="flex items-center justify-center h-full p-4">
          <p className="text-sm text-gray-600">{error}</p>
        </div>
      )}
      <div ref={containerRef} />
    </div>
  )
}