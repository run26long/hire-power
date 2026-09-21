import { createClient } from '@supabase/supabase-js'
import { requireTier } from '@/lib/requireTier'
import { canLogWins } from '@/lib/tiers'

// ============================================================================
// POST /api/career-vault/win
//
// Logging a win. A free account can see everything already in its Vault and
// cannot add to it; adding is what the plan is for.
//
// WHY THIS ROUTE EXISTS AT ALL
// It did not, until now. The Vault page inserted into `achievements` straight
// from the browser with the user's own Supabase client, which meant there was
// no server in the path and therefore nowhere to ask what plan the account
// was on. A gate in the page would have been a disabled button and nothing
// else: the insert it guards is three lines of JavaScript anybody can send
// from a console.
//
// So the write moves here. The page keeps the same modal and the same
// optimistic update; what it no longer does is talk to the table directly.
//
// WHAT IS NOT CHECKED HERE
// Deleting a win. Taking something down is never gated - the same rule
// requireCustomise states for the Career Profile, for the same reason. A
// lapsed account that cannot remove its own entries would be worse off than
// one that never wrote them.
// ============================================================================

const MAX_DESCRIPTION = 2000

const service = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = service()
    const { data: { user }, error: authError } =
      await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const gate = await requireTier(user.id, canLogWins, { supabase })
    if (gate) return gate

    let body
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'Invalid request.' }, { status: 400 })
    }

    const description = typeof body?.description === 'string' ? body.description.trim() : ''
    if (!description) {
      return Response.json({ error: 'Tell us what happened.', code: 'EMPTY' }, { status: 400 })
    }
    if (description.length > MAX_DESCRIPTION) {
      return Response.json({ error: 'That is longer than we can store.', code: 'TOO_LONG' }, { status: 400 })
    }

    // The job card a win belongs to, when one was named. Checked against the
    // caller rather than trusted: an application id is a uuid like any other,
    // and attaching a win to somebody else's role should not be possible.
    let applicationId = null
    if (body?.applicationId) {
      const { data: card, error: cardError } = await supabase
        .from('applications')
        .select('id')
        .eq('id', body.applicationId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (cardError) {
        console.error('[career-vault/win] Application lookup failed:', cardError)
        return Response.json({ error: "We couldn't save that just now." }, { status: 500 })
      }
      if (!card) return Response.json({ error: 'Not found.' }, { status: 404 })
      applicationId = card.id
    }

    // A date the owner typed, or now. An unparseable one falls back rather
    // than failing: the win matters more than when they say it happened.
    let createdAt = new Date().toISOString()
    if (body?.occurredAt) {
      const when = new Date(body.occurredAt)
      if (!Number.isNaN(when.getTime())) createdAt = when.toISOString()
    }

    const { data, error } = await supabase
      .from('achievements')
      .insert({
        user_id: user.id,
        source: 'career_archive',
        raw_description: description,
        status: 'approved',
        application_id: applicationId,
        created_at: createdAt
      })
      .select()
      .single()

    if (error) {
      console.error('[career-vault/win] Insert failed:', error)
      return Response.json({ error: "We couldn't save that just now." }, { status: 500 })
    }

    return Response.json({ achievement: data })
  } catch (error) {
    console.error('[career-vault/win] Unexpected:', error)
    return Response.json({ error: "We couldn't save that just now." }, { status: 500 })
  }
}
