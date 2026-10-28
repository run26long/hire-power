#!/usr/bin/env node
/**
 * One-time: give every uploaded image a display-size variant.
 *
 *   node scripts/backfill-display-variants.js --dry-run
 *   node scripts/backfill-display-variants.js --apply
 *
 * WHY
 * profile_evidence.display_path is new. Uploads made from now on get one as
 * they arrive; the images already in the bucket have none, so the viewer and
 * the lightbox still fall back to downloading the original for them. This
 * makes the missing ones.
 *
 * WHAT IT TOUCHES
 * Live uploaded images with no display variant yet, and nothing else. Videos
 * and PDFs are skipped by the query, not by a check inside the loop: sharp
 * does not open a video container and a PDF is not missing a picture, so
 * neither is waiting for anything. A soft-deleted row is skipped too - it can
 * be restored, and if it is, the upload path will make one.
 *
 * The original is never touched. This reads storage_path, writes a second
 * object beside it, and sets one column.
 *
 * SAFE TO RE-RUN
 * Three ways over. The query only selects rows where display_path is null, so
 * a second run finds nothing left to do. The upload is an upsert on a path
 * derived from the source, so a half-finished run that wrote an object but
 * not its column overwrites that object rather than leaving a duplicate. And
 * a row whose image sharp cannot decode is left exactly as it was, with
 * display_path still null, which already means "serve the original" - so a
 * permanent failure is a row this keeps retrying cheaply, never a broken one.
 *
 * A FAILURE IS ONE ROW
 * Nothing is transactional and nothing needs to be. Each row is read,
 * converted, uploaded and written on its own; one that throws is counted,
 * logged with its id, and the run carries on. Stopping the batch because one
 * photograph is corrupt would leave the other twenty-four undone.
 */

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local')
  if (!fs.existsSync(envPath)) {
    console.error(`Could not find ${envPath}`)
    process.exit(1)
  }
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const match = trimmed.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/)
    if (!match) continue
    const key = match[1]
    let value = match[2].trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

loadEnvLocal()

const APPLY = process.argv.includes('--apply')
const limitArg = process.argv.find(one => one.startsWith('--limit='))
const LIMIT = limitArg ? Number(limitArg.split('=')[1]) : null

// The same three values the upload route uses. Kept in step by hand, because
// a script importing a Next route handler would pull half the app in with it.
// If DISPLAY_EDGE or DISPLAY_QUALITY changes there, change it here.
const BUCKET = 'profile-media'
const DISPLAY_EDGE = 2000
const DISPLAY_QUALITY = 80
const MAX_DECODED_PIXELS = 80_000_000

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function makeDisplay(sharp, source) {
  const { data: blob, error } = await supabase.storage.from(BUCKET).download(source)
  if (error || !blob) throw new Error(`download failed: ${error?.message || 'no object'}`)

  const input = Buffer.from(await blob.arrayBuffer())
  const output = await sharp(input, {
    limitInputPixels: MAX_DECODED_PIXELS,
    sequentialRead: true,
    animated: false
  })
    .rotate()
    .resize({ width: DISPLAY_EDGE, height: DISPLAY_EDGE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: DISPLAY_QUALITY })
    .toBuffer()

  const displayPath = `${source.replace(/\.[^.]+$/, '')}-display.webp`
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(displayPath, output, { contentType: 'image/webp', upsert: true })
  if (upErr) throw new Error(`upload failed: ${upErr.message}`)

  return { displayPath, bytesIn: input.length, bytesOut: output.length }
}

async function main() {
  const { default: sharp } = await import('sharp')

  let query = supabase
    .from('profile_evidence')
    .select('id, storage_path, file_size')
    .eq('media_class', 'image')
    .eq('source_type', 'upload')
    .not('storage_path', 'is', null)
    .is('deleted_at', null)
    .is('display_path', null)
    .order('created_at', { ascending: true })

  if (LIMIT) query = query.limit(LIMIT)

  const { data: rows, error } = await query
  if (error) {
    console.error('Lookup failed:', error.message)
    process.exit(1)
  }

  const todo = rows || []
  console.log(`${todo.length} uploaded image${todo.length === 1 ? '' : 's'} with no display variant.`)
  if (!APPLY) {
    console.log('\nDry run. Nothing was read, written or changed.')
    for (const row of todo) console.log(`  would convert  ${row.id}  ${row.storage_path}`)
    console.log('\nRe-run with --apply to make them.')
    return
  }

  let made = 0
  let failed = 0
  let savedBytes = 0

  for (const row of todo) {
    try {
      const { displayPath, bytesIn, bytesOut } = await makeDisplay(sharp, row.storage_path)

      const { error: writeError } = await supabase
        .from('profile_evidence')
        .update({ display_path: displayPath, updated_at: new Date().toISOString() })
        .eq('id', row.id)

      if (writeError) {
        // The object is there and nothing points at it. The next run will
        // overwrite it and try the column again, which is why the upload is
        // an upsert.
        throw new Error(`column write failed: ${writeError.message}`)
      }

      made++
      savedBytes += Math.max(0, bytesIn - bytesOut)
      const kb = (n) => `${Math.round(n / 1024)}KB`
      console.log(`  made  ${row.id}  ${kb(bytesIn)} -> ${kb(bytesOut)}`)
    } catch (err) {
      failed++
      // Named, so a row that fails every run can be looked at rather than
      // guessed at. It keeps display_path null, which already means "serve
      // the original", so the item still opens.
      console.error(`  skipped  ${row.id}  ${err?.message || err}`)
    }
  }

  console.log(`\n${made} made, ${failed} skipped.`)
  if (made > 0) console.log(`About ${Math.round(savedBytes / 1024 / 1024)}MB less to download per full pass.`)
  if (failed > 0) console.log('Skipped rows kept display_path null and still open from the original.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
