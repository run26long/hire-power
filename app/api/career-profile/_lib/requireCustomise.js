import { createClient } from '@supabase/supabase-js'
import { canCustomiseProfile } from '@/lib/profileTier'

// ============================================================================
// THE GATE, SERVER SIDE
//
// The management page hides the controls a free account cannot use. That is
// where the gate is *explained*; this is where it is *enforced*. Hiding a
// button stops somebody clicking it and stops nobody at all from sending the
// request the button would have sent, so every route that writes owner-authored
// content asks this before it writes.
//
// Reading is never gated here. A free account keeps everything its coaching
// sessions produced and everything anybody has already given it: the profile
// renders, the manage record loads, testimonials that exist stay readable.
//
// Nor is removal. The same argument the IMOW video delete makes: gating the way
// out would leave somebody's words or face on a public page behind a paywall.
// A lapsed account can always take something down; what it cannot do is put
// something new up.
// ============================================================================

const service = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export const UPGRADE_REQUIRED = {
  error: 'Customising your profile is part of Vault and Pro.',
  code: 'UPGRADE_REQUIRED'
}

// Returns null when the account may write, and a ready Response when it may
// not. Shaped that way so a route reads `if (gate) return gate` and cannot
// accidentally continue past a refusal.
export async function requireCustomise(userId, supabase = service()) {
  const { data, error } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', userId)
    .maybeSingle()

  // A tier that could not be read is not permission. The alternative is that a
  // database blip opens every paid feature to every account.
  if (error) {
    console.error('[career-profile] Tier lookup failed:', error)
    return Response.json({ error: "We couldn't check your plan just now." }, { status: 500 })
  }

  if (!canCustomiseProfile(data?.subscription_tier)) {
    return Response.json(UPGRADE_REQUIRED, { status: 403 })
  }

  return null
}
