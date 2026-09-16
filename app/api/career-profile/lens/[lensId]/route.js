import { createClient } from '@supabase/supabase-js'
import { noEmDash } from '../../_lib/recruiterContext'

// ============================================================================
// PATCH /api/career-profile/lens/[lensId]
//
// The owner writing a direction by hand: the headline, the bio, the three
// proof points, and what they are open to.
//
// WHOSE LENS THIS WRITES TO
// The token's. The id in the path is matched together with the caller's user
// id, so a guessed or copied lens id belonging to somebody else is a 404 and
// not a write. The service role sees every row; this pairing is the only thing
// standing between a uuid and another person's profile.
//
// PARTIAL BY DESIGN
// Only the keys actually present in the body are written. A pencil on the
// headline sends a headline and nothing else, so nothing else can be cleared
// by an editor that happened to be mounted at the time. An empty body is a
// 400 rather than a no-op, because a save that saved nothing should say so.
//
// THIS IS THE ONLY VALIDATION THERE IS
// Not a convenience over a stricter database - the database enforces nothing
// at all here. I checked by writing each of these to a real lens and rolling
// it back: headline '' and 5,000 characters, bio at 100,000, proof_points as
// the string 'hello', as {}, as [], as nine items, as [{nope:1}], ready_tags
// as 'hello', as [], as sixty entries, and as [{a:1}]. Every one was accepted.
//
// One of those is a live crash and not a matter of taste. ProfileResolution
// renders each tag straight into JSX, so a ready_tags entry that is an object
// throws "Objects are not valid as a React child" and takes down the public
// page for everyone holding the link. Today that is unreachable because the
// generator is the only writer and it filters to strings. This route is the
// second writer, so the filter has to exist here too.
//
// PROOF POINTS ARE EXACTLY THREE
// Not a preference. profile.css places data-sub="0" and data-sub="1" and
// nothing else, so the layout has room for one lead and two supporting figures
// and no fourth cell. A fourth point would be placed by the grid wherever it
// happened to fall, which is a silent overlap rather than a visible error.
// Every generated lens in the database carries exactly three.
//
// READY_FOR_NEXT
// Accepted, validated and stored, and nothing on the profile renders it - the
// page says so explicitly and deliberately. It is here because it is a real
// column that the generator writes and an owner may want to correct, not
// because anything is about to show it.
// ============================================================================

// Sized from what the generator actually produces, with room above it. Real
// headlines run 68 to 137 characters and real bios 668 to 2,618, so these are
// ceilings against abuse rather than editorial limits.
const LIMITS = {
  headline: 200,
  bio: 4000,
  ready_for_next: 400,
  proof_num: 24,
  proof_label: 120,
  tag: 60
}

const PROOF_POINT_COUNT = 3
const TAG_MIN = 1
const TAG_MAX = 8

// Anything that is not a printable character or a newline. These arrive by
// paste far more often than by typing, and a zero-width or directional mark in
// a headline is invisible here and visible in somebody's search results.
// Built from escapes rather than written literally, so the file itself never
// contains the characters it is removing.
const CONTROL = new RegExp(
  '[' +
  "\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F" +
  "\\u200B-\\u200F\\u2028\\u2029\\uFEFF" +
  ']', 'g'
)

function clean(value) {
  return noEmDash(String(value).replace(CONTROL, '').trim())
}

// One line of prose. Newlines collapse to spaces: these fields are set as a
// single run of type, and a line break in them is a line break the layout
// never agreed to.
function oneLine(value, max, label) {
  if (typeof value !== 'string') return { error: `${label} must be text.` }
  const text = clean(value.replace(/\s+/g, ' '))
  if (!text) return { error: `${label} cannot be empty.` }
  if (text.length > max) return { error: `${label} is too long (max ${max} characters).` }
  return { value: text }
}

// Prose that may have paragraphs. Runs of blank lines collapse to one, so the
// stored string cannot carry vertical space the page did not ask for.
function manyLines(value, max, label) {
  if (typeof value !== 'string') return { error: `${label} must be text.` }
  const text = clean(value).replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n')
  if (!text) return { error: `${label} cannot be empty.` }
  if (text.length > max) return { error: `${label} is too long (max ${max} characters).` }
  return { value: text }
}

function validateProofPoints(value) {
  if (!Array.isArray(value)) return { error: 'Proof points must be a list.' }
  if (value.length !== PROOF_POINT_COUNT) {
    return { error: `A direction carries exactly ${PROOF_POINT_COUNT} proof points.` }
  }
  const points = []
  for (const raw of value) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { error: 'Each proof point needs a figure and a label.' }
    }
    const num = oneLine(raw.num, LIMITS.proof_num, 'A proof point figure')
    if (num.error) return { error: num.error }
    const label = oneLine(raw.label, LIMITS.proof_label, 'A proof point label')
    if (label.error) return { error: label.error }
    points.push({ num: num.value, label: label.value })
  }
  return { value: points }
}

function validateTags(value) {
  if (!Array.isArray(value)) return { error: 'Open To must be a list of tags.' }

  const tags = []
  const seen = new Set()
  for (const raw of value) {
    // Strings only. This is the rule that keeps an object out of the public
    // page's JSX; everything else in this function is about tidiness.
    if (typeof raw !== 'string') return { error: 'Each tag must be text.' }
    const text = clean(raw.replace(/\s+/g, ' '))
    if (!text) continue
    if (text.length > LIMITS.tag) {
      return { error: `A tag is too long (max ${LIMITS.tag} characters).` }
    }
    const key = text.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    tags.push(text)
  }

  if (tags.length < TAG_MIN) return { error: 'Add at least one tag, or leave the existing ones.' }
  if (tags.length > TAG_MAX) return { error: `That is more than ${TAG_MAX} tags.` }
  return { value: tags }
}

const FIELDS = {
  headline: v => oneLine(v, LIMITS.headline, 'The headline'),
  bio: v => manyLines(v, LIMITS.bio, 'The bio'),
  ready_for_next: v => oneLine(v, LIMITS.ready_for_next, 'Ready for next'),
  proof_points: validateProofPoints,
  ready_tags: validateTags
}

// Named, so a column added to profile_lenses later is not returned to the
// browser by a route that never knew about it. user_id is deliberately absent.
const RETURNED =
  'id, name, slug, status, sort_order, headline, bio, proof_points, ' +
  'ready_for_next, ready_tags, skill_emphasis, updated_at'

// Checked here so a malformed id answers the way a wrong one does. Postgres
// refuses a non-uuid as a type error, which would surface as a 500 - noise in
// the logs, and a different answer for "not a uuid" than for "not yours",
// which is a difference worth not publishing.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function PATCH(request, { params }) {
  try {
    const { lensId } = await params
    if (!lensId || !UUID.test(lensId)) return Response.json({ error: 'Not found.' }, { status: 404 })

    const authHeader = request.headers.get('authorization')
    if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data: { user }, error: authError } =
      await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    let body
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'Invalid request.' }, { status: 400 })
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return Response.json({ error: 'Invalid request.' }, { status: 400 })
    }

    // Only what was sent, and only what this route knows how to check. A key
    // that is not a field here is ignored rather than refused: the body is
    // built by the editor, and a stray key is a bug on this side, not an
    // attempt at anything.
    const patch = {}
    for (const [key, validate] of Object.entries(FIELDS)) {
      if (!Object.prototype.hasOwnProperty.call(body, key)) continue
      const result = validate(body[key])
      if (result.error) {
        return Response.json({ error: result.error, code: 'INVALID', field: key }, { status: 400 })
      }
      patch[key] = result.value
    }

    if (Object.keys(patch).length === 0) {
      return Response.json({ error: 'Nothing to save.', code: 'EMPTY' }, { status: 400 })
    }

    patch.updated_at = new Date().toISOString()

    // The id and the owner together. Either alone would be wrong: the id alone
    // writes to whoever's lens was named, and the owner alone has no lens.
    const { data: updated, error: updateError } = await supabase
      .from('profile_lenses')
      .update(patch)
      .eq('id', lensId)
      .eq('user_id', user.id)
      .select(RETURNED)
      .maybeSingle()

    if (updateError) {
      console.error('[career-profile] Lens update failed:', updateError)
      return Response.json({ error: "We couldn't save that. Please try again." }, { status: 500 })
    }

    // No row matched. Either the lens does not exist or it is not theirs, and
    // the answer is the same for both so this cannot be used to find out which.
    if (!updated) return Response.json({ error: 'Not found.' }, { status: 404 })

    return Response.json({ lens: updated })
  } catch (error) {
    console.error('[career-profile] Lens route failed:', error)
    return Response.json({ error: "We couldn't save that. Please try again." }, { status: 500 })
  }
}
