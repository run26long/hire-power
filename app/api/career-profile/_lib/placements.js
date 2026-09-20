// ============================================================================
// PLACEMENTS — the two tables that say where a direction puts something
//
// profile_evidence_placements and profile_testimonial_placements are the same
// table twice, over different collections: a profile, an item, a direction, a
// position in that direction, and whether the direction is currently showing
// it. Evidence additionally has a lead item; testimonials do not. Everything
// else about them is identical, so the three operations that are easy to get
// subtly wrong live here once rather than in two routes that drift.
//
// THE SHARED LAYER, AND WHY IT HAS TO BE MATERIALISED
// A placement with a null lens_id is the shared default. The public route
// FALLS BACK to it - `byLens[lensId] ?? shared` - rather than merging, so a
// direction with no placements of its own shows the shared list entire.
//
// That makes a per-direction edit impossible to express until the direction
// has a list of its own. Hiding one item from a direction that is following
// the shared layer used to write nothing at all: there was no row to hide, the
// fallback kept rendering, and the control silently did nothing. Reordering
// had the same hole.
//
// So the first edit in such a direction copies the shared list into it, and
// the edit is applied to the copy. The direction stops following the shared
// layer at that moment - which is exactly what the owner just asked for by
// editing it - and every item keeps the position it was already showing in.
//
// HIDING IS NOT DELETING, AND THAT IS THE POINT OF THE COLUMN
// Taking an item off a direction used to mean deleting its placement, which
// threw away its position and its lead status; putting it back landed it at
// the end of the list. `hidden` leaves the row exactly where it is and stops
// it rendering. Restoring is one boolean rather than a guess.
// ============================================================================

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (value) => typeof value === 'string' && UUID.test(value)

/**
 * @param {object} spec
 * @param {string} spec.table        the placement table
 * @param {string} spec.itemColumn   'evidence_id' or 'testimonial_id'
 * @param {boolean} spec.featured    whether the table carries a lead flag
 */
export function placementStore({ table, itemColumn, featured = false }) {
  const columns = ['id', itemColumn, 'lens_id', 'sort_order', 'hidden']
    .concat(featured ? ['featured'] : [])
    .join(', ')

  // Every placement in one direction, in the order the profile reads them.
  // Hidden rows are included: they hold positions, and a caller renumbering
  // or moving within a direction has to see them or it will write ranks that
  // collide with rows it did not know were there.
  async function listFor(supabase, profileId, lensId) {
    const query = supabase
      .from(table)
      .select(columns)
      .eq('profile_id', profileId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    const { data, error } = lensId === null
      ? await query.is('lens_id', null)
      : await query.eq('lens_id', lensId)

    if (error) throw error
    return data || []
  }

  // 0..n-1, and only the rows whose number actually changed are written.
  async function renumber(supabase, rows) {
    const writes = rows
      .map((row, index) => ({ row, index }))
      .filter(({ row, index }) => row.sort_order !== index)
      .map(({ row, index }) => supabase
        .from(table)
        .update({ sort_order: index, updated_at: new Date().toISOString() })
        .eq('id', row.id))

    const results = await Promise.all(writes)
    const failed = results.find(r => r.error)
    if (failed) throw failed.error
  }

  /**
   * Give a direction a list of its own before it is edited, if it does not
   * have one. Returns that direction's placements either way, so a caller can
   * use the return value and never has to ask twice.
   *
   * A no-op for the shared layer itself, which is the thing being copied, and
   * a no-op for a direction that already has placements - including one whose
   * only placements are hidden, which is a direction that has been curated
   * down to nothing rather than one that has never been curated.
   *
   * `orderHint` is a list of item ids to copy in, for the case where the
   * shared layer's own order is not what the direction has been showing.
   * Testimonials are exactly that case: every one of them sits in the shared
   * layer, but the page orders them by the collective-impact synthesis's
   * ranking for the direction being read. Copying in shared order would
   * reshuffle the section the first time somebody hid anything. Anything the
   * hint does not mention keeps its relative order behind what it does.
   */
  async function materialise(supabase, profileId, lensId, orderHint = null) {
    if (lensId === null) return listFor(supabase, profileId, null)

    const own = await listFor(supabase, profileId, lensId)
    if (own.length > 0) return own

    const shared = await listFor(supabase, profileId, null)
    if (shared.length === 0) return own

    const ranking = Array.isArray(orderHint) ? orderHint : []
    let source = shared
    if (ranking.length) {
      const byItem = new Map(shared.map(row => [row[itemColumn], row]))
      const ranked = []
      const placed = new Set()
      for (const id of ranking) {
        if (placed.has(id)) continue
        const row = byItem.get(id)
        if (!row) continue
        ranked.push(row)
        placed.add(id)
      }
      source = [...ranked, ...shared.filter(row => !placed.has(row[itemColumn]))]
    }

    // Positions and lead status carry over, so the direction opens showing
    // exactly what it was showing a moment ago. `featured` does too: the
    // shared layer's lead was this direction's lead until now.
    const rows = source.map((row, index) => ({
      profile_id: profileId,
      [itemColumn]: row[itemColumn],
      lens_id: lensId,
      sort_order: index,
      hidden: row.hidden === true,
      ...(featured ? { featured: row.featured === true } : {}),
    }))

    const { error } = await supabase.from(table).insert(rows)
    // A concurrent first edit in the same direction can take the slot between
    // the read and the insert. The rows we wanted exist either way.
    if (error && error.code !== '23505') throw error

    return listFor(supabase, profileId, lensId)
  }

  return { table, itemColumn, columns, listFor, renumber, materialise }
}

export const evidencePlacements = placementStore({
  table: 'profile_evidence_placements',
  itemColumn: 'evidence_id',
  featured: true,
})

export const testimonialPlacements = placementStore({
  table: 'profile_testimonial_placements',
  itemColumn: 'testimonial_id',
  featured: false,
})
