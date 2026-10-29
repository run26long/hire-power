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
// imow_type IS THE CHOICE, AND THIS ROUTE NO LONGER DECIDES IT ALONE
//
// It used to set 'text' on every save, which was right while a profile could
// only have one of the two: writing was the act of choosing to write. Both can
// exist now - the text column and the video path have always been separate and
// no write path has ever cleared the other - so forcing 'text' here meant that
// correcting a typo in the written version silently took somebody's video off
// their profile.
//
// So the choice travels with the save. The editor sends which half it is
// showing and this validates it rather than trusting it: 'video' is accepted
// only where there is actually a file to show, because imow_type takes any
// string and a profile claiming video with nothing behind it renders an empty
// frame. A save that names nothing keeps whatever the profile already chose,
// falling back to 'text' - which is what a profile with no video has always
// been and is the only honest answer for one that has just been written into.
//
// Neither half is ever deleted by the other. This route writes imow_text and
// imow_type and touches nothing else, exactly as before.
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

    // Either, or both. A profile that has recorded a video and never written
    // anything still has a choice to make, and the switch that makes it cannot
    // send text it does not have. What stays refused is an empty string, which
    // is somebody halfway through a rewrite rather than an instruction.
    const hasText = Object.prototype.hasOwnProperty.call(body, 'imow_text')
    const hasChoice = body?.imow_type === 'text' || body?.imow_type === 'video'

    if (!hasText && !hasChoice) {
      return Response.json(
        { error: 'Write something first.', code: 'INVALID', field: 'imow_text' },
        { status: 400 }
      )
    }

    if (hasText && typeof body.imow_text !== 'string') {
      return Response.json(
        { error: 'Write something first.', code: 'INVALID', field: 'imow_text' },
        { status: 400 }
      )
    }

    // Paragraphs survive; runs of blank lines and stray spaces do not, so the
    // stored string cannot carry vertical space the page never agreed to.
    const text = hasText
      ? noEmDash(
        body.imow_text
          .replace(CONTROL, '')
          .replace(/[ \t]+/g, ' ')
          .replace(/\n{3,}/g, '\n\n')
          .trim()
      )
      : null

    if (hasText && text.length < MIN) {
      return Response.json(
        { error: 'Write something first.', code: 'INVALID', field: 'imow_text' },
        { status: 400 }
      )
    }
    if (hasText && text.length > MAX) {
      return Response.json(
        { error: `That is too long (max ${MAX} characters).`, code: 'INVALID', field: 'imow_text' },
        { status: 400 }
      )
    }

    // What this profile has, which is what decides what it may choose. Read
    // here rather than taken from the body for the same reason the user id is.
    const { data: current } = await supabase
      .from('career_profiles')
      .select('imow_type, imow_video_path')
      .eq('user_id', user.id)
      .maybeSingle()

    const hasVideo = Boolean(current?.imow_video_path)
    const asked = hasChoice ? body.imow_type : null

    // 'video' only where there is one. Anything else, including a body that
    // names nothing, falls to what the profile already chose and then to
    // 'text', which is the only thing a profile with no video can be.
    // Whether there will be anything written once this save lands, which is
    // what decides whether 'text' is a thing this profile can be showing.
    const willHaveText = hasText ? text.length > 0 : Boolean(current?.imow_text)

    const nextType =
      asked === 'video' && hasVideo ? 'video'
        : asked === 'text' && willHaveText ? 'text'
          : (current?.imow_type === 'video' && hasVideo ? 'video'
            : willHaveText ? 'text' : (hasVideo ? 'video' : null))

    const { data: updated, error: updateError } = await supabase
      .from('career_profiles')
      .update({ ...(hasText ? { imow_text: text } : {}), imow_type: nextType })
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
