import { createClient } from '@supabase/supabase-js'
import { apiError } from '@/lib/apiError'

const MAX_NAME_LENGTH = 40

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
// Renames one suggested lens. Only a suggestion this account owns, and only one
// the coaching extraction wrote — a lens the user has adopted or edited is not
// this endpoint's to touch.
//
// Request body: { lensId: string, newName: string }
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

    const { lensId, newName } = await request.json()
    if (!lensId) return Response.json({ error: 'lensId is required' }, { status: 400 })

    const name = typeof newName === 'string' ? newName.trim() : ''
    if (!name) return Response.json({ error: 'NAME_REQUIRED' }, { status: 400 })
    if (name.length > MAX_NAME_LENGTH) {
      return Response.json({ error: 'NAME_TOO_LONG' }, { status: 400 })
    }

    // A name of nothing but punctuation trims to a real string but slugs to an
    // empty one, and an empty slug would collide with every other empty slug.
    const baseSlug = slugify(name)
    if (!baseSlug) return Response.json({ error: 'NAME_REQUIRED' }, { status: 400 })

    // Ownership and eligibility in one read.
    const { data: lens, error: lookupError } = await supabase
      .from('profile_lenses')
      .select('id')
      .eq('id', lensId)
      .eq('user_id', userId)
      .eq('status', 'suggested')
      .eq('source', 'coaching_extraction')
      .maybeSingle()

    if (lookupError) {
      console.error('Lens rename lookup failed:', lookupError)
      return Response.json({ error: 'RENAME_FAILED' }, { status: 500 })
    }
    if (!lens) return Response.json({ error: 'LENS_NOT_FOUND' }, { status: 404 })

    // UNIQUE(profile_id, slug): a name colliding with another lens on the same
    // profile takes the next free suffix rather than failing the rename, which
    // is how the slug is chosen when a lens is first written.
    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`

      const { data: updated, error: updateError } = await supabase
        .from('profile_lenses')
        .update({ name, slug, updated_at: new Date().toISOString() })
        .eq('id', lens.id)
        .eq('user_id', userId)
        .select('id, name, slug, evidence_summary')
        .single()

      if (updated) return Response.json({ lens: updated })

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
