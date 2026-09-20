// ============================================================================
// WHAT IS WAITING IN THE VAULT
//
// One number on the profile row: how many things have landed in the career
// knowledge base since the owner last opened the Career Vault. The nav draws a
// badge from it, the Vault page announces it once and clears it.
//
// WHY EVERY WRITER GOES THROUGH HERE
// Four of them can arrive at the same moment - coaching extraction and
// interview extraction both run as background work after a session ends, and
// a testimonial publish or an evidence upload can land in the same second.
// Read-then-write from four places loses counts, so the addition happens in
// one statement inside the database and this is the only way to reach it.
//
// IT NEVER THROWS
// Nothing here is worth failing a save over. A coaching session that finished,
// a testimonial that published and an upload that landed are all done; the
// badge being one short is not a reason to tell somebody their work failed.
// ============================================================================

export async function bumpVaultCount(supabase, userId, by = 1) {
  if (!supabase || !userId || !Number.isFinite(by) || by <= 0) return null
  try {
    const { data, error } = await supabase.rpc('bump_unseen_vault_count', {
      p_user_id: userId,
      p_by: by
    })
    if (error) {
      console.error('[vault-count] Bump failed (non-fatal):', error)
      return null
    }
    return data
  } catch (e) {
    console.error('[vault-count] Bump threw (non-fatal):', e)
    return null
  }
}
