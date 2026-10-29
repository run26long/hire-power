import crypto from 'node:crypto'

// Spelled with their extensions, unlike most imports in this tree. Next
// resolves either form, and these two have to resolve under plain Node as
// well: scripts/backfill-evidence-thumbnails.js loads this module directly so
// that a backfill and a live save make a thumbnail the same way, and Node's
// ESM resolver does not guess at extensions.
import { fetchImageSafely, fetchPageSafely } from './safeFetch.js'
import { headOf, ogImageUrl } from './pageMeta.js'

// ============================================================================
// A PICTURE FOR A PIECE OF EVIDENCE THAT DOES NOT CARRY ONE
//
// An uploaded photograph is its own preview and a video's is the frame the
// browser captured. The two kinds left are a link, which has no file at all,
// and a PDF, which has a file nothing could read a picture out of. Both ended
// up as the same grey icon, which tells a reader the item is a document and
// nothing else about it.
//
// So: a link's thumbnail is the image that page advertises as its own, and a
// PDF's is its first page. Both end up in the same place by the same route -
// re-encoded by sharp into a webp this server made, written to the evidence
// bucket, and named in thumbnail_path - which is exactly what the upload route
// already does with a video's poster frame. Nothing new is served and nothing
// new is signed; the media route already hands out thumbnail_path for any row
// that has one.
//
// NOTHING HERE IS EVER FATAL
// Every function in this file returns null instead of throwing. A page with no
// og:image, an image that will not decode, a PDF sharp or pdfjs chokes on - in
// all of them the item is still the item the owner added and still renders
// with its icon, which is what every item did before this existed. Losing a
// link because the picture on the far end of it is broken would be absurd.
//
// WHAT COMES BACK FROM THE INTERNET IS NOT AN IMAGE UNTIL IT DECODES
// The content type on the response is a header a stranger wrote. safeFetch
// checks it against an allowlist, which stops the obvious cases cheaply, and
// then sharp is asked for the metadata before anything is stored. Bytes that
// do not describe themselves as a raster image of a known format, with real
// dimensions, never reach the bucket. The re-encode is the second half of the
// same argument: what is stored is a webp this process produced, so whatever
// else arrived did not survive the trip.
//
// AND A THUMBNAIL IS NEVER A PORTFOLIO ITEM
// Nothing in here touches media_class or source_type. A link stays a link and
// a PDF stays a document, which is the whole of why lib/portfolio keeps
// ignoring both - see the note there.
//
// WHO COUNTS THE OUTBOUND REQUESTS
// Not this file. `onOutbound` is called once for every fetch that actually
// opened a socket, and the route decides what that costs the account - the
// same bargain preview-url already had with safeFetch, which reports it as
// `attempted`. It is here rather than in the route because the route cannot
// see it: a refusal for a bad scheme and a real request both come back as
// "no picture", and charging the first would charge somebody for a link that
// never left the building.
//
// A link costs up to two: the page, and then the image the page named. A PDF
// costs none - the bytes come from our own bucket - so nothing calls the
// callback on that path and nothing should start to.
// ============================================================================

const BUCKET = 'profile-media'

// The upload route's numbers, because this is the same object at the same size
// doing the same job in the same grid. If they change there, change them here.
const THUMB_WIDTH = 800
const THUMB_QUALITY = 78
const MAX_DECODED_PIXELS = 80_000_000

// What sharp must agree it is looking at. The same four safeFetch will accept
// over the wire, plus the formats a PDF page is rendered into before it gets
// here. Anything else - an svg, a pdf renamed, a tiff, a zip - is refused with
// the bytes still in memory and nothing written.
const DECODABLE = new Set(['jpeg', 'png', 'webp', 'gif'])

// A page's own picture is sometimes a tracking pixel or a 1x1 spacer, and a
// thumbnail that is four grey pixels blown up to fill a tile is worse than the
// icon it replaced. Low enough to pass anything a page means as a preview.
const MIN_EDGE = 64

// How long a PDF may take to say what its first page looks like. A document
// whose first page is a full-bleed scan is slow and fine; one that takes
// longer than this is one nobody is waiting for.
const PDF_TIMEOUT_MS = 20_000

// Page one, at twice its own size before sharp brings it down to the thumbnail
// width. Rendering at 1 and enlarging would be a blurry tile; rendering at 2
// and reducing is the same path a retina screenshot takes.
const PDF_SCALE = 2

// ---------------------------------------------------------------------------
// WHERE PDF.JS GETS A CANVAS, AND THE TWO WAYS IT DOES NOT
//
// unpdf ships its own bundle of pdf.js, and in that bundle pdf.js's internal
// NodeCanvasFactory has been replaced by the bundler with a stub that throws
// "@napi-rs/canvas is not available in this environment". unpdf's answer is a
// NodeCanvasFactory of its own, built from the `canvasImport` function you
// hand it. So there are two factories, and which one gets used decides whether
// a document renders.
//
// THE FIRST TRAP: renderPageAsImage only wires its factory to the DOCUMENT
// when it creates the document itself. Its first lines are, in effect:
//
//     const CanvasFactory = await createIsomorphicCanvasFactory(canvasImport)
//     const pdf = isPDFDocumentProxy(data) ? data : await getDocumentProxy(data, { CanvasFactory })
//
// Pass it bytes and the working factory reaches the document. Pass it a
// document you opened yourself - which is the only way to read numPages
// first - and `{ CanvasFactory }` is skipped entirely and the document keeps
// the stub.
//
// The page still draws, because renderPageAsImage makes the one canvas it
// needs itself and passes it into page.render. What breaks is every canvas
// pdf.js makes on its own account, through the factory on the document:
// shading patterns, inline images, transparency groups, soft masks. So a
// plain text page renders and a page with a gradient on it throws - which is
// exactly the shape of a backfill that made one thumbnail and failed eight.
//
// So the factory is handed to getDocumentProxy here, where it is not skipped.
//
// THE SECOND TRAP: importing unpdf/pdfjs installs `globalThis.DOMMatrix =
// class {}` if nothing has defined one, and unpdf's injector only fills in
// globals that are still undefined. Whichever runs first wins for the life of
// the process. Resolve the canvas first and pdf.js leaves the real DOMMatrix
// alone; let pdf.js load first - which another route calling extractText in
// the same process will do - and the real one can never be installed, leaving
// shading patterns doing matrix arithmetic on an empty class.
//
// Both are handled below: the factory is resolved before the document is
// opened, and the globals are checked rather than assumed, because "has
// anything else in this process already loaded pdf.js" is not a question this
// file can answer.
// ---------------------------------------------------------------------------
const canvasImport = () => import('@napi-rs/canvas')

// Replace pdf.js's placeholder DOMMatrix with the real one.
//
// Identified by behaviour rather than by order: the placeholder is an empty
// class, so its prototype has none of the methods pdf.js then calls on it.
// Anything that does have them is either the real thing or a platform global
// that works, and neither should be overwritten.
function installCanvasGlobals(canvas) {
  try {
    const stubbed = typeof globalThis.DOMMatrix !== 'function'
      || typeof globalThis.DOMMatrix.prototype?.multiplySelf !== 'function'
    if (stubbed && canvas?.DOMMatrix) globalThis.DOMMatrix = canvas.DOMMatrix
    // Node defines neither of these, and pdf.js does not stub them, so
    // unpdf's own injector handles them. Set here as well so this function is
    // the whole answer rather than half of it.
    if (typeof globalThis.ImageData === 'undefined' && canvas?.ImageData) {
      globalThis.ImageData = canvas.ImageData
    }
    if (typeof globalThis.Path2D === 'undefined' && canvas?.Path2D) {
      globalThis.Path2D = canvas.Path2D
    }
  } catch (error) {
    // A frozen global is not a reason to abandon the render; the factory is
    // what matters most and it is passed explicitly.
    console.error('[career-profile] Canvas globals not installed (non-fatal):', error)
  }
}

/**
 * Where a thumbnail lives.
 *
 * Beside the file it belongs to where there is one, so the pair is swept
 * together when the item is replaced - the same naming the video poster uses.
 * A link has no file, so it gets two random segments of its own, for the
 * reason the upload route gives at length: this string ends up inside a signed
 * URL handed to anonymous readers, and it must say nothing about whose it is.
 */
export const thumbnailPathFor = (storagePath) => (
  storagePath
    ? `${storagePath.replace(/\.[^.]+$/, '')}-thumb.webp`
    : `${crypto.randomUUID()}/${crypto.randomUUID()}-thumb.webp`
)

// ---------------------------------------------------------------------------
// Bytes in, an object in the bucket out, or null.
//
// The one place anything in this file writes. Everything above it is about
// getting hold of some pixels; this is the part that proves they are pixels
// and turns them into the object a reader is eventually served.
//
// Exported as storeImage because it is now the only picture encoder on the
// Career Profile that is shared. In My Own Words captures a poster frame in
// the browser the way the evidence gallery does, and that frame has to go
// through exactly this: the decode check that makes the declared content type
// irrelevant, the EXIF rotate, the 800px cap, the webp, and the verify that
// deletes an object it could not read back. A second copy of that over in the
// video route is five rules that would quietly stop matching.
// ---------------------------------------------------------------------------
export async function storeImage(supabase, input, thumbPath) {
  return store(supabase, input, thumbPath)
}

async function store(supabase, input, thumbPath) {
  let output
  try {
    const { default: sharp } = await import('sharp')

    // The decode check, before anything is written. `metadata()` is what makes
    // the content-type header irrelevant: it reports what the bytes actually
    // are, and a format off the list or a size that is not a picture ends the
    // attempt here.
    const image = sharp(input, {
      limitInputPixels: MAX_DECODED_PIXELS,
      sequentialRead: true,
      animated: false
    })
    const meta = await image.metadata()
    if (!DECODABLE.has(String(meta?.format || '').toLowerCase())) return null
    if (!(meta.width >= MIN_EDGE) || !(meta.height >= MIN_EDGE)) return null

    output = await image
      .rotate()              // honour EXIF orientation, then drop it
      .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
      .webp({ quality: THUMB_QUALITY })
      .toBuffer()
  } catch (error) {
    console.error('[career-profile] Thumbnail encode failed (non-fatal):', error)
    return null
  }

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(thumbPath, output, { contentType: 'image/webp', upsert: true })
  if (upErr) {
    console.error('[career-profile] Thumbnail upload failed:', upErr)
    return null
  }

  // What storage holds, not what was sent to it. A verify that fails takes the
  // object with it, because a path in thumbnail_path that signs to nothing is
  // a tile that loads a broken picture rather than drawing its icon.
  const { data: info } = await supabase.storage.from(BUCKET).info(thumbPath)
  if (!info || !Number(info.size)) {
    await supabase.storage.from(BUCKET).remove([thumbPath]).catch(() => {})
    return null
  }

  return thumbPath
}

/**
 * The address of the image a page advertises as its own, or null.
 *
 * Fetches the page again rather than storing the address on the row. The row
 * keeps the picture, never where it came from - which means turning a
 * thumbnail back on months later asks the page what its image is now, rather
 * than re-fetching an address that may have stopped meaning anything.
 */
export async function pageImageUrl(pageUrl, { onOutbound } = {}) {
  try {
    const result = await fetchPageSafely(pageUrl)
    // Whether a socket was opened, which is the only thing worth charging for.
    if (result.attempted) onOutbound?.()
    if (result.error || !result.html) return null
    return ogImageUrl(headOf(result.html), result.finalUrl)
  } catch (error) {
    console.error('[career-profile] og:image lookup failed (non-fatal):', error)
    return null
  }
}

/**
 * Fetch one image somebody else is serving and store our own copy of it.
 *
 * `imageUrl` is an address the owner has seen - the one the preview showed
 * them - and it is fetched through the same guard the preview went through.
 * Resolves to a path, or null for every way this can fail to be a picture.
 */
export async function thumbnailFromImageUrl(supabase, imageUrl, storagePath = null, { onOutbound } = {}) {
  if (typeof imageUrl !== 'string' || !imageUrl.trim()) return null
  // The same ceiling the url column is held to. A string longer than this is
  // not an address somebody's page published, and refusing it here means the
  // parser is never handed one.
  if (imageUrl.length > 2048) return null
  try {
    const result = await fetchImageSafely(imageUrl.trim())
    if (result.attempted) onOutbound?.()
    if (result.error || !result.bytes?.length) return null
    return await store(supabase, result.bytes, thumbnailPathFor(storagePath))
  } catch (error) {
    console.error('[career-profile] Link thumbnail failed (non-fatal):', error)
    return null
  }
}

/**
 * The first page of a stored PDF, as a thumbnail beside it.
 *
 * The render is pdfjs with a real canvas behind it, which is the only thing
 * that can turn a page description into pixels. sharp does the rest, so a PDF
 * arrives at the same webp by the same path a photograph does.
 *
 * Resolves to a path, or null - a PDF that is encrypted, damaged, built from
 * something pdfjs will not parse, or simply slow, keeps its icon.
 */
export async function thumbnailFromPdf(supabase, storagePath) {
  if (!storagePath) return null

  let doc = null
  try {
    const { data: blob, error } = await supabase.storage.from(BUCKET).download(storagePath)
    if (error || !blob) return null

    // Imported here rather than at module scope, the way sharp is: this is a
    // native binary behind a wasm-free pdfjs build, and the routes that never
    // render a page should not pay to load either.
    const { createIsomorphicCanvasFactory, getDocumentProxy, renderPageAsImage } =
      await import('unpdf')

    // First, before a line of pdf.js is loaded. This resolves @napi-rs/canvas
    // and is what makes the two traps above survivable - see the note there.
    const CanvasFactory = await createIsomorphicCanvasFactory(canvasImport)
    installCanvasGlobals(await canvasImport())

    // `CanvasFactory` on the document, not only on the render call. Every
    // canvas pdf.js makes for itself - a shading pattern, an inline image, a
    // transparency group - comes from this one.
    doc = await getDocumentProxy(new Uint8Array(await blob.arrayBuffer()), { CanvasFactory })
    if (!doc?.numPages) return null

    const png = await Promise.race([
      // The same import function, so the one canvas renderPageAsImage makes
      // for the page itself comes from the module already resolved above
      // rather than from a second resolution of it.
      renderPageAsImage(doc, 1, { scale: PDF_SCALE, canvasImport }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('PDF_RENDER_TIMEOUT')), PDF_TIMEOUT_MS).unref?.()
      )
    ])

    return await store(supabase, Buffer.from(png), thumbnailPathFor(storagePath))
  } catch (error) {
    console.error('[career-profile] PDF thumbnail failed (non-fatal):', error)
    return null
  } finally {
    // pdfjs holds a worker and a parsed document open until it is told not to.
    // In a serverless handler that outlives the request as retained memory.
    await Promise.resolve(doc?.destroy?.()).catch(() => {})
  }
}

/**
 * The right kind of thumbnail for whatever this row is, or null.
 *
 * One place that answers "what would this item's picture be made from", so the
 * add, the edit and the backfill cannot come to different conclusions about
 * the same row.
 */
export async function makeEvidenceThumbnail(supabase, row, { onOutbound } = {}) {
  if (!row) return null
  // Nothing outbound. The PDF is already ours, in our own bucket.
  if (isPdfRow(row)) return thumbnailFromPdf(supabase, row.storage_path)
  if (isLinkRow(row)) {
    const imageUrl = await pageImageUrl(row.url, { onOutbound })
    return imageUrl ? thumbnailFromImageUrl(supabase, imageUrl, null, { onOutbound }) : null
  }
  return null
}

/**
 * Take the object away. Never fatal either: a file that would not delete is a
 * file nothing points at any more, which costs storage and nothing else, and
 * the column has to be cleared regardless or the switch lies.
 */
export async function removeThumbnail(supabase, thumbnailPath) {
  if (!thumbnailPath) return
  const { error } = await supabase.storage.from(BUCKET).remove([thumbnailPath])
  if (error) console.error('[career-profile] Thumbnail not removed (non-fatal):', error)
}

// Which rows this file has anything to say about. A link item, and an upload
// that is a PDF. An image makes its own, a video's is the captured frame, and
// a Word document has no page this can read.
export const isPdfRow = (row) =>
  row?.source_type === 'upload'
  && Boolean(row?.storage_path)
  && String(row?.mime_type || '').split(';')[0].trim().toLowerCase() === 'application/pdf'

export const isLinkRow = (row) => row?.source_type === 'link' && Boolean(row?.url)

export const canHaveThumbnail = (row) => isPdfRow(row) || isLinkRow(row)
