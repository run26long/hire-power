import { createClient } from '@supabase/supabase-js'
import { apiError } from '@/lib/apiError'

// The same ceiling create-custom uses, and the same one both inputs that
// reach this route already enforce with maxLength. It was 40 here, which no
// other part of the system agreed with: a name of 41 to 60 characters could
// be typed, could be refused as a duplicate, and could then fail the rename
// that refusal offered. Raising a maximum accepts more and rejects nothing
// that used to pass.
const MAX_NAME_LENGTH = 60

// Same shape as the slug built when a lens is first suggested, so a renamed lens
// and a freshly suggested one can never disagree about how a name becomes a slug.
function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

// ============================================================================
// POST /api/profile-lenses/rename
//
// Request body: { lensId: string, newName: string, intent?: string }
//
// TWO CALLERS, TWO SETS OF RULES
//
// 'suggestion' (the default, and what every existing caller sends by sending
// nothing) renames one SUGGESTED lens the coaching extraction wrote. A lens
// the user has adopted or edited is not that caller's to touch. A slug
// collision takes the next free suffix, which is how a slug is chosen when a
// lens is first written.
//
// 'resolve-duplicate' is the answer to a refusal. Creating a direction can
// come back saying the account already has it under another name, and the
// offer made there is to rename the one they have. That can be any direction
// they own - the one it collided with is whichever one it collided with, and
// its status and source are not this question's business.
//
// Its collision rule is the opposite one, and deliberately. Suffixing is
// right when somebody is naming a suggestion and a near-miss is tolerable;
// it is wrong here, because this caller is resolving a name conflict and
// silently producing a second direction with the same display name and a
// -2 slug would resolve nothing. So it refuses, in the same shape the
// creation refusal uses, and the surface shows the same note again.
//
// ONLY name, slug AND previous_slugs CHANGE, under either intent. The id,
// status, sort_order, source, core_resume_id and every generated field are
// untouched, which is what makes this a rename rather than a replacement.
//
// THE OLD ADDRESS IS KEPT
// A slug is the ?d= parameter on a shared link, so renaming silently breaks
// every link already sent - and breaks it quietly, by opening the profile on
// the primary direction instead of the one that was named. The old slug goes
// into previous_slugs so the page can still resolve it. Nothing here consults
// that column for uniqueness: a slug is unique among current slugs, before
// and after.
//
// WHAT THIS ROUTE DOES NOT DO
// Regenerate. The generator writes a direction's prose for a particular name,
// so renaming leaves content aimed at the old one - but the app records
// nothing about who wrote those fields, and the hand-edit route and the
// generator write the same columns. Rewriting here would silently replace
// whatever the owner had typed. So this reports whether there is content to
// rewrite and lets the surface offer it.
// ============================================================================

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const token = authHeader.replace('Bearer ', '')

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // The row this renames belongs to the token holder, never to a user id the
    // caller supplies. The service role sees every row, so this is the only
    // thing standing between a lens id and whoever guessed it.
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = user.id

    const { lensId, newName, intent } = await request.json()
    if (!lensId) return Response.json({ error: 'lensId is required' }, { status: 400 })

    const resolving = intent === 'resolve-duplicate'

    const name = typeof newName === 'string' ? newName.trim() : ''
    if (!name) return Response.json({ error: 'NAME_REQUIRED' }, { status: 400 })
    if (name.length > MAX_NAME_LENGTH) {
      return Response.json({ error: 'NAME_TOO_LONG' }, { status: 400 })
    }

    // A name of nothing but punctuation trims to a real string but slugs to an
    // empty one, and an empty slug would collide with every other empty slug.
    const baseSlug = slugify(name)
    if (!baseSlug) return Response.json({ error: 'NAME_REQUIRED' }, { status: 400 })

    // Ownership and eligibility in one read. Resolving a duplicate asks only
    // for ownership: the direction that was matched is whichever one matched,
    // and narrowing by status or source here would refuse to rename exactly
    // the direction the refusal just pointed at.
    let lookup = supabase
      .from('profile_lenses')
      .select('id, name, slug, previous_slugs, headline, bio, proof_points')
      .eq('id', lensId)
      .eq('user_id', userId)
    if (!resolving) {
      lookup = lookup.eq('status', 'suggested').eq('source', 'coaching_extraction')
    }
    const { data: lens, error: lookupError } = await lookup.maybeSingle()

    if (lookupError) {
      console.error('Lens rename lookup failed:', lookupError)
      return Response.json({ error: 'RENAME_FAILED' }, { status: 500 })
    }
    if (!lens) return Response.json({ error: 'LENS_NOT_FOUND' }, { status: 404 })

    // The address it is about to stop answering to. Only recorded when it
    // actually changes: a rename that reshapes the words but slugs to the
    // same thing has broken no link and has nothing to remember.
    const history = Array.isArray(lens.previous_slugs) ? lens.previous_slugs : []
    const keepOldSlug = (nextSlug) =>
      lens.slug && lens.slug !== nextSlug && !history.includes(lens.slug)
        ? [...history, lens.slug]
        : history

    // Whether there is anything for the surface to offer to rewrite. A
    // suggestion nobody has opened has no prose aimed at anything, so renaming
    // it raises no question.
    const hasContent = Boolean(
      String(lens.headline || '').trim() ||
      String(lens.bio || '').trim() ||
      (Array.isArray(lens.proof_points) && lens.proof_points.length > 0)
    )

    // ---- RESOLVING A DUPLICATE: THE SLUG IS TAKEN OR IT IS NOT ----
    //
    // Checked before the write and enforced again by the unique index below,
    // because a check on its own is a window rather than a rule.
    if (resolving) {
      const { data: taken } = await supabase
        .from('profile_lenses')
        .select('id, name')
        .eq('user_id', userId)
        .eq('slug', baseSlug)
        .neq('id', lens.id)
        .maybeSingle()

      if (taken) {
        return Response.json({
          ok: false,
          code: 'DUPLICATE',
          overlapsWith: taken.name,
          overlapsLensId: taken.id
        })
      }

      const { data: renamed, error: renameError } = await supabase
        .from('profile_lenses')
        .update({
          name,
          slug: baseSlug,
          previous_slugs: keepOldSlug(baseSlug),
          updated_at: new Date().toISOString()
        })
        .eq('id', lens.id)
        .eq('user_id', userId)
        .select('id, name, slug, status, source, sort_order, core_resume_id')
        .single()

      if (renameError) {
        // The index caught what the read above could not: somebody took the
        // slug in between. The same answer, from the authority rather than
        // from the guess.
        if (renameError.code === '23505') {
          return Response.json({ ok: false, code: 'DUPLICATE', overlapsWith: name })
        }
        console.error('Lens rename failed:', renameError)
        return Response.json({ error: 'RENAME_FAILED' }, { status: 500 })
      }

      return Response.json({
        ok: true,
        lens: renamed,
        previousName: lens.name,
        hasContent
      })
    }

    // UNIQUE(profile_id, slug): a name colliding with another lens on the same
    // profile takes the next free suffix rather than failing the rename, which
    // is how the slug is chosen when a lens is first written.
    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`

      const { data: updated, error: updateError } = await supabase
        .from('profile_lenses')
        .update({
          name,
          slug,
          previous_slugs: keepOldSlug(slug),
          updated_at: new Date().toISOString()
        })
        .eq('id', lens.id)
        .eq('user_id', userId)
        .select('id, name, slug, evidence_summary')
        .single()

      if (updated) {
        return Response.json({ lens: updated, previousName: lens.name, hasContent })
      }

      if (updateError?.code !== '23505') {
        console.error('Lens rename failed:', updateError)
        return Response.json({ error: 'RENAME_FAILED' }, { status: 500 })
      }
    }

    return Response.json({ error: 'SLUG_UNAVAILABLE' }, { status: 409 })

  } catch (error) {
    return apiError(error, "We couldn't rename this lens. Please try again.")
  }
}
