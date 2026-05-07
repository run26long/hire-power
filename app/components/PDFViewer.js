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

        // Render each page as a Letter-sized white "page" on a gray background.
        // Each page gets its own canvas wrapped in a div with a drop shadow and
        // a page number, mimicking what a desktop PDF reader shows. Gives the
        // user a true visual of how the resume fills a Letter page (8.5" x 11"),
        // including blank space at the bottom for short resumes and clear
        // separation between pages for multi-page resumes.
        const totalPages = pdf.numPages
        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
          if (cancelled) return

          const page = await pdf.getPage(pageNum)
          const scale = 2
          const viewport = page.getViewport({ scale })

          const pageWrapper = document.createElement('div')
          pageWrapper.style.position = 'relative'
          pageWrapper.style.width = '100%'
          pageWrapper.style.background = 'white'
          pageWrapper.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'
          pageWrapper.style.marginBottom = '16px'

          const canvas = document.createElement('canvas')
          canvas.width = viewport.width
          canvas.height = viewport.height
          canvas.style.width = '100%'
          canvas.style.height = 'auto'
          canvas.style.display = 'block'

          const context = canvas.getContext('2d')
          await page.render({ canvasContext: context, viewport }).promise

          if (cancelled) return

          pageWrapper.appendChild(canvas)

          // Page indicator badge (only shown when 2+ pages exist)
          if (totalPages > 1) {
            const badge = document.createElement('div')
            badge.textContent = `Page ${pageNum} of ${totalPages}`
            badge.style.position = 'absolute'
            badge.style.bottom = '8px'
            badge.style.right = '8px'
            badge.style.background = 'rgba(0,0,0,0.6)'
            badge.style.color = 'white'
            badge.style.fontSize = '10px'
            badge.style.fontWeight = '600'
            badge.style.padding = '3px 8px'
            badge.style.borderRadius = '10px'
            badge.style.pointerEvents = 'none'
            pageWrapper.appendChild(badge)
          }

          container.appendChild(pageWrapper)
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
    <div className="w-full h-full overflow-y-auto" style={{ background: '#9ca3af' }}>
      {loading && (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
      )}
      {error && (
        <div className="flex items-center justify-center h-full p-4">
          <p className="text-sm text-white">{error}</p>
        </div>
      )}
      <div ref={containerRef} style={{ padding: '16px' }} />
    </div>
  )
}