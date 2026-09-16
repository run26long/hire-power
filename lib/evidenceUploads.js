// ============================================================================
// WHAT MAY BE UPLOADED
//
// One list, read by the route that issues the upload URL, the route that
// finalises it, and the file picker in the form. Three copies of this would be
// three chances for the picker to offer something the route refuses.
//
// WHY THE BUCKET IS NOT THE ONLY ANSWER
// profile-media has its own allowed_mime_types and enforces them before any
// route gets a say, which is the real floor. But the bucket's list is wider
// than this one - it also permits avif, quicktime and five audio types - and
// what the product offers is a narrower product decision. A type that is not
// here gets a sentence somebody can act on; a type that is here but not in the
// bucket would get an opaque storage error, so the two must not drift.
//
// EXTENSIONS ARE CHOSEN HERE, NOT TAKEN FROM THE FILENAME
// The stored path is built by the server from the declared type, so a file
// called "cv.pdf.exe" is stored as a .pdf and a file called "x" is stored with
// a real extension. Nothing downstream parses a name the browser supplied.
// ============================================================================

// media_class is constrained by the database to image, video, audio, document,
// link, embed or other, so these values are not free text.
export const UPLOAD_TYPES = {
  'image/jpeg': { ext: 'jpg', media_class: 'image', label: 'JPEG image' },
  'image/png': { ext: 'png', media_class: 'image', label: 'PNG image' },
  'image/gif': { ext: 'gif', media_class: 'image', label: 'GIF image' },
  'image/webp': { ext: 'webp', media_class: 'image', label: 'WebP image' },
  'application/pdf': { ext: 'pdf', media_class: 'document', label: 'PDF' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    ext: 'docx', media_class: 'document', label: 'Word document'
  },
  'video/mp4': { ext: 'mp4', media_class: 'video', label: 'MP4 video' },
  'video/webm': { ext: 'webm', media_class: 'video', label: 'WebM video' }
}

// What the bucket itself will hold. 50MB, set on profile-media rather than
// here, and repeated only so the form can refuse a file before spending the
// upload rather than after.
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

export const ACCEPT_ATTRIBUTE = Object.keys(UPLOAD_TYPES).join(',')

export function uploadTypeFor(contentType) {
  if (typeof contentType !== 'string') return null
  // A browser sends "text/html; charset=utf-8" shaped values for some types;
  // only the type itself is ever matched.
  const bare = contentType.split(';')[0].trim().toLowerCase()
  return UPLOAD_TYPES[bare] ? { ...UPLOAD_TYPES[bare], mime: bare } : null
}

export function humanSize(bytes) {
  const n = Number(bytes)
  if (!Number.isFinite(n) || n <= 0) return null
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}
