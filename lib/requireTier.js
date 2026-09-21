import { createClient } from '@supabase/supabase-js'
import { UPGRADE_REQUIRED, PRO_REQUIRED } from './tiers'

// ============================================================================
// THE GATE, SERVER SIDE
//
// Hiding a button stops somebody clicking it and stops nobody at all from
// sending the request the button would have sent. So every route that creates
// something, or hands back something a plan is supposed to have paid for,
// asks here first.
//
// This is the same shape career-profile/_lib/requireCustomise.js has had, and
// for the same reasons; it is generalised to take the predicate so that the
// rest of the platform stops writing `tier === 'pro'` inline. That route
// keeps its own wrapper, because six routes already import it and its refusal
// names the profile specifically.
//
// Returns null when the account may proceed, and a ready Response when it may
// not. Shaped that way so a route reads `if (gate) return gate` and cannot
// accidentally continue past a refusal.
//
// A tier that could not be read is never permission. The alternative is a
// database blip opening every paid feature to every account.
// ============================================================================

const service = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export async function readTier(userId, supabase = service()) {
  const { data, error } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.error('[tier] Lookup failed:', error)
    return { error }
  }
  return { tier: data?.subscription_tier || 'free' }
}

export async function requireTier(userId, predicate, { pro = false, supabase = service() } = {}) {
  const { tier, error } = await readTier(userId, supabase)

  if (error) {
    return Response.json({ error: "We couldn't check your plan just now." }, { status: 500 })
  }

  if (!predicate(tier)) {
    return Response.json(pro ? PRO_REQUIRED : UPGRADE_REQUIRED, { status: 403 })
  }

  return null
}
