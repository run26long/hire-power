import { requireCustomise } from '../_lib/requireCustomise'
import { createClient } from '@supabase/supabase-js'
import { noEmDash } from '../_lib/recruiterContext'

// ============================================================================
// PATCH /api/career-profile/imow
//
// The one section of the profile written in the first person, saved.
//
// WHOSE PROFILE THIS WRITES TO
// The token's. No profile id and no user id is read from the body; the row is
// found from the authenticated user, the same as every other write here.
//
// THIS IS THE ONLY VALIDATION THERE IS
// The database enforces nothing on either column. I checked by writing each of
// these and rolling it back: imow_type accepted 'text', 'video', 'audio',
// 'banana' and null; imow_text accepted fifty thousand characters, an empty
// string, and a JSON object. So the length, the type, and what imow_type may
// say are decided here.
//
// EM DASHES ARE STRIPPED, NOT REFUSED
// Through the same noEmDash every generated field on this profile already goes
// through, so hand-typed prose and generated prose read the same. Refusing the
// save would punish somebody for pasting out of Word, and the correction is
// one they would make by hand anyway.
//
// BLANK IS A 400, NOT A CLEAR
// Selecting everything and pressing delete is how a person starts rewriting,
// not how they ask for the section to disappear. An empty save would remove
// the section from the profile as a side effect of an edit that had not been
// finished. Removing it will be its own action, said out loud, when there is
// one.
//
// imow_type IS SET TO 'text' HERE
// Because this route only ever writes text, and a profile whose type says
// video while its text is what renders would be a profile describing itself
// wrongly. Nothing else on this route touches it.
// ============================================================================

const MIN = 1
const MAX = 2000

// Built from escapes rather than written literally, so the file never contains
// the characters it is removing.
const CONTROL = new RegExp(
  '[' +
  "\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F" +
  "\\u200B-\\u200F\\u2028\\u2029\\uFEFF" +
  ']', 'g'
)

export async function PATCH(request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    const { data: { user }, error: authError } =
      await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    // In My Own Words is owner-authored text, so it is behind the same gate
    // as the rest of it. Clearing the field is not: see requireCustomise.
    const gate = await requireCustomise(user.id, supabase)
    if (gate) return gate

    let body
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'Invalid request.' }, { status: 400 })
    }

    if (typeof body?.imow_text !== 'string') {
      return Response.json(
        { error: 'Write something first.', code: 'INVALID', field: 'imow_text' },
        { status: 400 }
      )
    }

    // Paragraphs survive; runs of blank lines and stray spaces do not, so the
    // stored string cannot carry vertical space the page never agreed to.
    const text = noEmDash(
      body.imow_text
        .replace(CONTROL, '')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    )

    if (text.length < MIN) {
      return Response.json(
        { error: 'Write something first.', code: 'INVALID', field: 'imow_text' },
        { status: 400 }
      )
    }
    if (text.length > MAX) {
      return Response.json(
        { error: `That is too long (max ${MAX} characters).`, code: 'INVALID', field: 'imow_text' },
        { status: 400 }
      )
    }

    const { data: updated, error: updateError } = await supabase
      .from('career_profiles')
      .update({ imow_text: text, imow_type: 'text' })
      .eq('user_id', user.id)
      .select('imow_text, imow_type')
      .maybeSingle()

    if (updateError) {
      console.error('[career-profile] IMOW update failed:', updateError)
      return Response.json({ error: "We couldn't save that. Please try again." }, { status: 500 })
    }
    if (!updated) return Response.json({ error: 'No profile to update.' }, { status: 404 })

    return Response.json({ imow_text: updated.imow_text, imow_type: updated.imow_type })
  } catch (error) {
    console.error('[career-profile] IMOW route failed:', error)
    return Response.json({ error: "We couldn't save that. Please try again." }, { status: 500 })
  }
}
