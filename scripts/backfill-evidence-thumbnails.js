#!/usr/bin/env node
/**
 * One-time: give every link and every PDF a thumbnail.
 *
 *   node scripts/backfill-evidence-thumbnails.js              (dry run)
 *   node scripts/backfill-evidence-thumbnails.js --dry-run    (the same)
 *   node scripts/backfill-evidence-thumbnails.js --apply
 *   node scripts/backfill-evidence-thumbnails.js --profile=jane-doe --apply
 *   node scripts/backfill-evidence-thumbnails.js --apply --limit=10
 *
 * WHY
 * profile_evidence.thumbnail_path used to be filled for images and videos
 * only, so a link and a PDF both drew the same grey icon. Both now get a real
 * picture as they arrive - the page's own og:image, the document's first page
 * - and the rows already in the table have none. This makes the missing ones.
 *
 * WHAT IT TOUCHES
 * Live link rows with a url, and live uploaded PDFs, where thumbnail_path is
 * null. Nothing else: images make their own, a video's is the frame the
 * browser captured, and a Word document has no page anything here can read,
 * so none of them is waiting for this. A soft-deleted row is skipped too - it
 * can be restored, and if it is, nothing is lost by it having no picture.
 *
 * The source is never touched. This reads url or storage_path, writes a new
 * object in the bucket, and sets one column.
 *
 * IT MAKES THEM THE WAY THE APP MAKES THEM
 * By importing the app's own module rather than by copying it. The
 * backfill-display-variants script next door deliberately re-states its three
 * constants instead, on the grounds that a script importing a route handler
 * would pull half the app in with it - and that is still true of a route. It
 * is not true of _lib/evidenceThumbnail, which imports node builtins, sharp
 * and unpdf and nothing else. The alternative here was a second copy of the
 * SSRF guard in _lib/safeFetch, and a second copy of that is exactly the kind
 * of thing that is correct on the day it is written and wrong a year later.
 *
 * Node prints a MODULE_TYPELESS_PACKAGE_JSON warning when it loads those
 * files, because the package has no "type" and they are ES modules in .js
 * files that Next compiles rather than Node. It is a warning about a reparse,
 * not about anything being wrong. Node 20.19 or newer.
 *
 * IT FETCHES PAGES ON SOMEBODY ELSE'S BEHALF
 * Every link row means one outbound request to a site this project does not
 * control, and then a second to whatever that site named as its image. They go
 * through the same _lib/safeFetch the app uses, so the scheme, the port, every
 * resolved address and every redirect are checked the same way. There is a
 * pause between rows all the same: a backfill is the one time this would hit
 * a few hundred sites in a few seconds, which is rude even when it is safe.
 *
 * SAFE TO RE-RUN
 * Three ways over. The query only selects rows where thumbnail_path is null,
 * so a second run finds nothing it already did. The upload is an upsert on a
 * path derived from the source, so a half-finished row that wrote an object
 * but not its column overwrites that object rather than leaving a duplicate.
 * And a row whose picture cannot be made is left exactly as it was, with
 * thumbnail_path still null - which already means "draw the icon" - so a
 * permanent failure is a row this retries cheaply, never a broken one.
 *
 * A FAILURE IS ONE ROW
 * Nothing is transactional and nothing needs to be. Each row is read, made,
 * uploaded and written on its own; one that throws is counted, logged with its
 * id, and the run carries on. Stopping because one site is down would leave
 * the other two hundred undone.
 *
 * IT CREATES NO SESSIONS
 * The service role key, straight from .env.local, the way every script here
 * does it. Nothing signs in and nothing is signed in as.
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

// Dry by default, and the default is the whole point. A script that writes
// unless told not to is a script somebody runs once to see what it does.
//
// --dry-run is accepted and is what you already get; given alongside --apply
// it wins, because the only way to type both is to have meant the careful one.
const APPLY = process.argv.includes('--apply') && !process.argv.includes('--dry-run')

const slugArg = process.argv.find(one => one.startsWith('--profile='))
const SLUG = slugArg ? slugArg.split('=').slice(1).join('=').trim() : null

const limitArg = process.argv.find(one => one.startsWith('--limit='))
const LIMIT = limitArg ? Number(limitArg.split('=')[1]) : null

// Between rows, on apply. Nothing in the product needs this; the sites on the
// other end of a few hundred links do.
const PAUSE_MS = 400

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const PDF = 'application/pdf'
const isPdf = (row) =>
  row.source_type === 'upload'
  && Boolean(row.storage_path)
  && String(row.mime_type || '').split(';')[0].trim().toLowerCase() === PDF

const isLink = (row) => row.source_type === 'link' && Boolean(row.url)

// What this row would become, said in one line, for the dry run.
const describe = (row) => (
  isPdf(row)
    ? `PDF page one   ${row.storage_path}`
    : `page image of  ${String(row.url).slice(0, 80)}`
)

async function profileIdForSlug(slug) {
  const { data, error } = await supabase
    .from('career_profiles')
    .select('id, slug')
    .eq('slug', slug)
    .maybeSingle()
  if (error) {
    console.error('Profile lookup failed:', error.message)
    process.exit(1)
  }
  if (!data) {
    console.error(`No profile with slug "${slug}".`)
    process.exit(1)
  }
  return data.id
}

async function main() {
  // The app's own maker, so a row filled in here is indistinguishable from one
  // filled in by the route that would have made it at save time.
  const { makeEvidenceThumbnail } = await import(
    '../app/api/career-profile/_lib/evidenceThumbnail.js'
  )

  let query = supabase
    .from('profile_evidence')
    .select('id, profile_id, title, source_type, url, mime_type, storage_path')
    .is('thumbnail_path', null)
    .is('deleted_at', null)
    // Everything that could have a picture, in one read. The two kinds are
    // separated in JS below rather than in two queries, because "a PDF" is a
    // mime type on an upload and PostgREST has no tidy way to say "this
    // source type with that mime, or that other source type with a url".
    .in('source_type', ['link', 'upload'])
    .order('created_at', { ascending: true })

  if (SLUG) query = query.eq('profile_id', await profileIdForSlug(SLUG))
  if (LIMIT) query = query.limit(LIMIT)

  const { data: rows, error } = await query
  if (error) {
    console.error('Lookup failed:', error.message)
    process.exit(1)
  }

  const todo = (rows || []).filter(row => isPdf(row) || isLink(row))
  const links = todo.filter(isLink).length
  const pdfs = todo.length - links

  console.log(
    `${todo.length} item${todo.length === 1 ? '' : 's'} with no thumbnail`
    + ` (${links} link${links === 1 ? '' : 's'}, ${pdfs} PDF${pdfs === 1 ? '' : 's'})`
    + (SLUG ? ` on ${SLUG}.` : '.')
  )

  if (!APPLY) {
    console.log('\nDry run. Nothing was fetched, written or changed.')
    for (const row of todo) {
      console.log(`  would make  ${row.id}  ${describe(row)}`)
    }
    console.log('\nRe-run with --apply to make them.')
    return
  }

  let made = 0
  let skipped = 0

  for (const row of todo) {
    try {
      // Returns null for everything that is not a picture in the end: a page
      // with no og:image, an image that will not decode, a PDF pdfjs cannot
      // parse. None of those is an error - the row keeps its icon, which is
      // what it has now.
      const thumbnailPath = await makeEvidenceThumbnail(supabase, row)
      if (!thumbnailPath) {
        skipped++
        console.log(`  none      ${row.id}  nothing to make a picture from`)
        continue
      }

      const { error: writeError } = await supabase
        .from('profile_evidence')
        .update({ thumbnail_path: thumbnailPath, updated_at: new Date().toISOString() })
        .eq('id', row.id)

      if (writeError) {
        // The object is there and nothing points at it. The next run will
        // overwrite it and try the column again, which is why the upload is
        // an upsert.
        throw new Error(`column write failed: ${writeError.message}`)
      }

      made++
      console.log(`  made      ${row.id}  ${row.title || 'Untitled'}`)
    } catch (err) {
      skipped++
      // Named, so a row that fails every run can be looked at rather than
      // guessed at. It keeps thumbnail_path null, which already means "draw
      // the icon", so the item still reads correctly.
      console.error(`  skipped   ${row.id}  ${err?.message || err}`)
    }

    await sleep(PAUSE_MS)
  }

  console.log(`\n${made} made, ${skipped} without one.`)
  if (skipped > 0) {
    console.log('Those kept thumbnail_path null and still draw their icon.')
    console.log('Re-running will try them again; a page that publishes no image never will.')
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
