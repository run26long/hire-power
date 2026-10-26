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
// WHY A DIRECTION STILL HAS TO BE MATERIALISED
// An item carries its own membership now: placement_scope 'all' puts it on
// every direction without a row to say so. So a direction that nobody has
// arranged has no rows at all, and renders its items in the collection's
// default order.
//
// That makes a per-direction edit impossible to express until the direction
// has rows. Hiding one item from such a direction would write nothing at all:
// there is no row to hide, the item is still on by scope, and the control
// would silently do nothing. Reordering has the same hole.
//
// So the first edit in such a direction writes a row for everything then on
// it, and the edit is applied to those. The direction stops following the
// default order at that moment - which is exactly what the owner just asked
// for by editing it - and every item keeps the position it was already in.
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
 * @param {string} spec.itemTable    where the items themselves live
 * @param {string} spec.itemColumn   'evidence_id' or 'testimonial_id'
 * @param {boolean} spec.featured    whether the table carries a lead flag
 * @param {function} spec.defaultOrder  applies the collection's own ordering
 * @param {function} spec.liveOnly      narrows to the rows that can be placed
 */
export function placementStore({
  table,
  itemTable,
  itemColumn,
  featured = false,
  defaultOrder = (q) => q,
  liveOnly = (q) => q,
}) {
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

    const { data, error } = await query.eq('lens_id', lensId)
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
   * Give a direction rows of its own before it is edited, if it has none.
   * Returns that direction's placements either way, so a caller can use the
   * return value and never has to ask twice.
   *
   * A no-op for a direction that already has rows - including one whose rows
   * are all hidden, which is a direction curated down to nothing rather than
   * one that has never been curated.
   *
   * What gets written is everything on this direction by scope, in the order
   * the direction is currently reading them. That is the whole point: the
   * owner's first edit must not reshuffle the section underneath them.
   *
   * `orderHint` is a list of item ids giving that order where the collection's
   * own column is not it. Testimonials are exactly that case: the page orders
   * them by the collective-impact synthesis's ranking for the direction being
   * read, so copying in created_at order would reshuffle the section the first
   * time somebody hid anything. Anything the hint does not mention keeps its
   * relative order behind what it does.
   */
  async function materialise(supabase, profileId, lensId, orderHint = null) {
    if (!lensId) return []

    const own = await listFor(supabase, profileId, lensId)
    if (own.length > 0) return own

    // On this direction by scope, since nothing is here by row yet. An item
    // scoped to particular directions and not placed in this one is not here
    // and is not written in.
    const { data: items, error: itemError } = await defaultOrder(
      liveOnly(
        supabase
          .from(itemTable)
          .select('id')
          .eq('profile_id', profileId)
          .eq('placement_scope', 'all')
      )
    )
    if (itemError) throw itemError

    const source = (items || []).map(row => row.id)
    if (source.length === 0) return own

    const ranking = Array.isArray(orderHint) ? orderHint : []
    let ordered = source
    if (ranking.length) {
      const known = new Set(source)
      const ranked = []
      const placed = new Set()
      for (const id of ranking) {
        if (placed.has(id) || !known.has(id)) continue
        ranked.push(id)
        placed.add(id)
      }
      ordered = [...ranked, ...source.filter(id => !placed.has(id))]
    }

    // Nothing is hidden and nothing leads: a direction that has never been
    // arranged has made neither decision, and writing one down here would
    // invent it.
    const rows = ordered.map((id, index) => ({
      profile_id: profileId,
      [itemColumn]: id,
      lens_id: lensId,
      sort_order: index,
      hidden: false,
      ...(featured ? { featured: false } : {}),
    }))

    const { error } = await supabase.from(table).insert(rows)
    // A concurrent first edit in the same direction can take the slot between
    // the read and the insert. The rows we wanted exist either way.
    if (error && error.code !== '23505') throw error

    return listFor(supabase, profileId, lensId)
  }

  /**
   * Set which directions one item is on, scope and rows together.
   *
   * 'all' LEAVES THE ROWS ALONE. They no longer say the item is here - the
   * scope does - so what they still carry is where it sits in the directions
   * somebody has arranged, and which one it leads. Deleting them to "clean
   * up" would throw away an arrangement the owner made and silently move
   * things on pages they were happy with.
   *
   * 'selected' DELETES THE ROWS IT NO LONGER NAMES, because for a selected
   * item a row is the membership, and leaving one behind would leave the item
   * on a direction the owner just took it off.
   *
   * A direction gaining its first row gets the rest of its items written in
   * first, for the same reason every other first edit does: rows sort ahead
   * of items that are here only by scope, so a single new row would otherwise
   * jump to the front of a section nobody asked to reorder.
   */
  async function setDirections(supabase, profileId, itemId, scope, lensIds) {
    const { data: existing, error } = await supabase
      .from(table)
      .select(`id, lens_id`)
      .eq('profile_id', profileId)
      .eq(itemColumn, itemId)
    if (error) throw error

    if (scope === 'all') return

    const keep = new Set(Array.isArray(lensIds) ? lensIds : [])
    const stale = (existing || []).filter(row => !keep.has(row.lens_id)).map(row => row.id)
    if (stale.length > 0) {
      const { error: dropError } = await supabase.from(table).delete().in('id', stale)
      if (dropError) throw dropError
    }

    const held = new Set((existing || []).filter(row => keep.has(row.lens_id)).map(row => row.lens_id))
    for (const lensId of keep) {
      if (held.has(lensId)) continue
      const here = await materialise(supabase, profileId, lensId)
      // materialise may have just written this item in, if it was on the
      // direction by scope a moment ago and is being pinned to it now.
      if (here.some(row => row[itemColumn] === itemId)) continue
      const { error: addError } = await supabase.from(table).insert({
        profile_id: profileId,
        [itemColumn]: itemId,
        lens_id: lensId,
        sort_order: here.length,
        hidden: false,
        ...(featured ? { featured: false } : {}),
      })
      if (addError && addError.code !== '23505') throw addError
    }
  }

  return { table, itemTable, itemColumn, featured, columns, listFor, renumber, materialise, setDirections }
}

export const evidencePlacements = placementStore({
  table: 'profile_evidence_placements',
  itemTable: 'profile_evidence',
  itemColumn: 'evidence_id',
  featured: true,
  // The collection's own running order, which is what an unarranged direction
  // is already showing.
  defaultOrder: (q) => q.order('sort_order', { ascending: true }),
  // A deleted item is not on any direction and must not be written into one.
  liveOnly: (q) => q.is('deleted_at', null),
})

export const testimonialPlacements = placementStore({
  table: 'profile_testimonial_placements',
  itemTable: 'profile_testimonials',
  itemColumn: 'testimonial_id',
  featured: false,
  // Testimonials have no ordering column of their own, so this is only the
  // floor under the ranking the caller passes as orderHint.
  defaultOrder: (q) => q.order('created_at', { ascending: false }),
  // Only what is on the profile takes part in the profile's order.
  liveOnly: (q) => q.eq('status', 'published'),
})
