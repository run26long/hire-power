// ============================================================================
// STEP 3 - EIGHT PORTFOLIO ITEMS
//
// lib/portfolio.js draws the line between Portfolio and Evidence: an item is a
// portfolio item when its media_class is visual AND we hold the file. A linked
// image stays in Evidence, because the viewer refuses to render remote media
// inline and a square mat with nothing in it is not a portfolio tile.
//
// Every existing image on this profile is a link to example.com, so the
// Portfolio is currently empty. These eight are real uploads, which is what
// puts the section on screen at all - and eight against a preview of six is
// what puts its overflow on screen too.
//
// WHAT THIS DELIBERATELY MIRRORS
// The upload route's finalise step, because these rows have to be
// indistinguishable from ones a person made through the form:
//   - path is two random uuids and a real extension, carrying no identifiers,
//     because the path ends up inside every signed URL a reader is handed
//   - the thumbnail is a second object at <path>-thumb.webp, 800px wide, made
//     through the same sharp pipeline
//   - file_size and mime_type are read back off the stored object rather than
//     taken from what we think we uploaded
//   - kind is set to the family, as the route sets it
//
// Idempotent by key: an image whose title is already on the profile is skipped
// rather than uploaded twice.
// ============================================================================

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { sb, PROFILE_ID, USER_ID, BUCKET, APPLY, assertNoEmDash, OUT_DIR } = require('./_env')
const { IMAGES } = require('./_artwork')
const { familyForType, canonicalType } = require('./_types')

// Same numbers the upload route uses, for the same reasons.
const THUMB_WIDTH = 800
const THUMB_QUALITY = 78
const MAX_DECODED_PIXELS = 80_000_000

async function render(sharp, image) {
  const svg = image.svg()
  const png = await sharp(Buffer.from(svg), { limitInputPixels: MAX_DECODED_PIXELS })
    .png({ compressionLevel: 9 })
    .toBuffer()
  const thumb = await sharp(png, { limitInputPixels: MAX_DECODED_PIXELS, sequentialRead: true, animated: false })
    .rotate()
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .webp({ quality: THUMB_QUALITY })
    .toBuffer()
  return { png, thumb }
}

async function main() {
  const { default: sharp } = await import('sharp')
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

  const { data: existing, error: exErr } = await sb
    .from('profile_evidence')
    .select('id, title')
    .eq('profile_id', PROFILE_ID)
    .is('deleted_at', null)
  if (exErr) throw exErr
  const have = new Set((existing || []).map(e => e.title))

  const { data: last } = await sb
    .from('profile_evidence')
    .select('sort_order')
    .eq('profile_id', PROFILE_ID)
    .is('deleted_at', null)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  let sortOrder = (last?.sort_order ?? -1) + 1

  const made = []
  for (const image of IMAGES) {
    assertNoEmDash(image.title, image.key + '.title')
    assertNoEmDash(image.description, image.key + '.description')

    const family = familyForType(image.evidence_type)
    const type = canonicalType(image.evidence_type)
    if (!family || !type) throw new Error(image.key + ': unknown evidence_type ' + image.evidence_type)

    if (have.has(image.title)) { console.log('skip (already present): ' + image.title); continue }

    const { png, thumb } = await render(sharp, image)
    // Written out so the artwork can be eyeballed without opening the bucket.
    fs.writeFileSync(path.join(OUT_DIR, image.key + '.png'), png)

    const meta = await sharp(png).metadata()
    console.log(
      image.key.padEnd(30)
      + (meta.width + 'x' + meta.height).padEnd(12)
      + (Math.round(png.length / 1024) + ' KB').padEnd(10)
      + 'thumb ' + Math.round(thumb.length / 1024) + ' KB'
    )

    if (!APPLY) continue

    // Two random segments and nothing else: no user id, no profile id, because
    // this string is published inside every signed URL a reader receives.
    const objectPath = crypto.randomUUID() + '/' + crypto.randomUUID() + '.png'
    const thumbPath = objectPath.replace(/\.[^.]+$/, '') + '-thumb.webp'

    const up = await sb.storage.from(BUCKET).upload(objectPath, png, { contentType: 'image/png', upsert: false })
    if (up.error) throw new Error('upload failed for ' + image.key + ': ' + up.error.message)

    const upThumb = await sb.storage.from(BUCKET).upload(thumbPath, thumb, { contentType: 'image/webp', upsert: true })
    if (upThumb.error) {
      // Never fatal in the route either: an item with no preview still renders.
      console.log('  thumbnail upload failed (non-fatal): ' + upThumb.error.message)
    }

    // What storage actually holds, not what we believe we sent.
    const { data: info } = await sb.storage.from(BUCKET).info(objectPath)

    const { data: row, error } = await sb.from('profile_evidence').insert({
      profile_id: PROFILE_ID,
      user_id: USER_ID,
      family,
      evidence_type: type,
      kind: family,
      media_class: 'image',
      title: image.title,
      description: image.description,
      organization: image.organization,
      date_label: image.date_label,
      source_type: 'upload',
      storage_path: objectPath,
      thumbnail_path: upThumb.error ? null : thumbPath,
      mime_type: 'image/png',
      file_size: Number(info?.size) || png.length,
      privacy: 'public',
      status: 'published',
      sort_order: sortOrder++
    }).select('id, title').maybeSingle()

    if (error) {
      // A file with no row is a file nothing can ever find or delete.
      await sb.storage.from(BUCKET).remove([objectPath, thumbPath])
      throw new Error('insert failed for ' + image.key + ': ' + error.message)
    }
    console.log('  -> ' + row.id)
    made.push({ key: image.key, id: row.id })
  }

  console.log('\n' + (APPLY ? made.length + ' portfolio items created' : 'DRY RUN - rendered to ' + OUT_DIR + ', nothing uploaded'))
}

main().catch(e => { console.error('ERR', e.message); process.exit(1) })
