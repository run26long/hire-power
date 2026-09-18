// ============================================================================
// STEP 4 - SIX EVIDENCE ITEMS
//
// Four generated PDFs uploaded as documents, and two external links. Together
// with the eight uploads from step 3 that gives the profile enough material for
// both sections to be seen full rather than sparse.
//
// Documents get no thumbnail, deliberately and for the same reason the upload
// route gives them none: a PDF is not missing a picture, it has the picture it
// is supposed to have, and the evidence route refuses to fall back to the
// source file when a thumbnail is absent.
//
// A link is classified exactly as lib/evidenceTypes.js classifies one: 'embed'
// only for a provider the viewer can actually render in an iframe, and 'link'
// for everything else. Neither of these two is YouTube or Vimeo, so both are
// links, which is what stops a tile promising a player it cannot produce.
// ============================================================================

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { sb, PROFILE_ID, USER_ID, BUCKET, APPLY, assertNoEmDash, OUT_DIR } = require('./_env')
const { DOCUMENTS, LINKS, render } = require('./_pdfs')
const { familyForType, canonicalType } = require('./_types')

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

// The viewer renders an iframe for these two and nothing else.
const EMBED_HOSTS = {
  youtube: ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'],
  vimeo: ['vimeo.com', 'www.vimeo.com', 'player.vimeo.com']
}
function providerForUrl(url) {
  let host
  try { host = new URL(url).hostname.toLowerCase() } catch { return null }
  return Object.keys(EMBED_HOSTS).find(p => EMBED_HOSTS[p].includes(host)) ?? null
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

  const { data: existing, error: exErr } = await sb
    .from('profile_evidence').select('id, title').eq('profile_id', PROFILE_ID).is('deleted_at', null)
  if (exErr) throw exErr
  const have = new Set((existing || []).map(e => e.title))

  const { data: last } = await sb
    .from('profile_evidence').select('sort_order').eq('profile_id', PROFILE_ID)
    .is('deleted_at', null).order('sort_order', { ascending: false }).limit(1).maybeSingle()
  let sortOrder = (last?.sort_order ?? -1) + 1

  let made = 0

  // ---- the four PDFs ----
  for (const item of DOCUMENTS) {
    assertNoEmDash(item.title, item.key + '.title')
    assertNoEmDash(item.description, item.key + '.description')
    const family = familyForType(item.evidence_type)
    const type = canonicalType(item.evidence_type)
    if (!family || !type) throw new Error(item.key + ': unknown evidence_type ' + item.evidence_type)

    if (have.has(item.title)) { console.log('skip (already present): ' + item.title); continue }

    const pdf = await render(item.doc)
    if (pdf.length > MAX_UPLOAD_BYTES) throw new Error(item.key + ' exceeds the 50MB bucket cap')
    fs.writeFileSync(path.join(OUT_DIR, item.key + '.pdf'), pdf)
    console.log(item.key.padEnd(34) + (Math.round(pdf.length / 1024) + ' KB').padEnd(10) + type)

    if (!APPLY) continue

    const objectPath = crypto.randomUUID() + '/' + crypto.randomUUID() + '.pdf'
    const up = await sb.storage.from(BUCKET).upload(objectPath, pdf, { contentType: 'application/pdf', upsert: false })
    if (up.error) throw new Error('upload failed for ' + item.key + ': ' + up.error.message)

    const { data: info } = await sb.storage.from(BUCKET).info(objectPath)

    const { data: row, error } = await sb.from('profile_evidence').insert({
      profile_id: PROFILE_ID,
      user_id: USER_ID,
      family,
      evidence_type: type,
      kind: family,
      media_class: 'document',
      title: item.title,
      description: item.description,
      organization: item.organization,
      date_label: item.date_label,
      source_type: 'upload',
      storage_path: objectPath,
      thumbnail_path: null,
      mime_type: 'application/pdf',
      file_size: Number(info?.size) || pdf.length,
      privacy: 'public',
      status: 'published',
      sort_order: sortOrder++
    }).select('id').maybeSingle()

    if (error) {
      await sb.storage.from(BUCKET).remove([objectPath])
      throw new Error('insert failed for ' + item.key + ': ' + error.message)
    }
    console.log('  -> ' + row.id)
    made++
  }

  // ---- the two links ----
  for (const item of LINKS) {
    assertNoEmDash(item.title, item.key + '.title')
    assertNoEmDash(item.description, item.key + '.description')
    const family = familyForType(item.evidence_type)
    const type = canonicalType(item.evidence_type)
    if (!family || !type) throw new Error(item.key + ': unknown evidence_type ' + item.evidence_type)
    // The database refuses anything but http(s); this fails loudly instead.
    if (!/^https?:\/\//i.test(item.url)) throw new Error(item.key + ': url must be http(s)')

    if (have.has(item.title)) { console.log('skip (already present): ' + item.title); continue }

    const provider = providerForUrl(item.url)
    console.log(item.key.padEnd(34) + (provider ? 'embed/' + provider : 'link').padEnd(10) + type)

    if (!APPLY) continue

    const { data: row, error } = await sb.from('profile_evidence').insert({
      profile_id: PROFILE_ID,
      user_id: USER_ID,
      family,
      evidence_type: type,
      kind: family,
      media_class: provider ? 'embed' : 'link',
      title: item.title,
      description: item.description,
      organization: item.organization,
      date_label: item.date_label,
      source_type: 'link',
      url: item.url,
      provider,
      embed_url: null,
      privacy: 'public',
      status: 'published',
      sort_order: sortOrder++
    }).select('id').maybeSingle()

    if (error) throw new Error('insert failed for ' + item.key + ': ' + error.message)
    console.log('  -> ' + row.id)
    made++
  }

  console.log('\n' + (APPLY ? made + ' evidence items created' : 'DRY RUN - PDFs written to ' + OUT_DIR + ', nothing uploaded'))
}

main().catch(e => { console.error('ERR', e.message); process.exit(1) })
