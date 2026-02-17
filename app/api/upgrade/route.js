import { createClient } from '@/utils/supabase/server'

export async function POST(request) {
  try {
    const { tier } = await request.json()
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // TODO Phase 5: Integrate Stripe payment here
    // For now, just update the tier (mock payment)
    
    const { error } = await supabase
      .from('profiles')
      .update({
        subscription_tier: tier,
        subscription_start_date: new Date().toISOString()
      })
      .eq('id', user.id)

    if (error) throw error

    return Response.json({ success: true })
    
  } catch (error) {
    console.error('Upgrade error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}