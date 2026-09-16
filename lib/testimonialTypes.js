// ============================================================================
// HOW SOMEBODY WORKED WITH YOU
//
// The five kinds of working relationship, read by the request form, the route
// that stores one, and the count behind EARNED 360.
//
// WHY THIS LIST IS ALSO IN THE DATABASE
// It is, as a CHECK constraint, which is a deliberate difference from the
// evidence types - those live only in a route because a wrong label on a tile
// is cosmetic. This list is the denominator of a claim the profile makes about
// itself. If "Manager", "manager" and "Line manager" can all be stored, three
// testimonials from one boss earn a tag saying three kinds of people vouched
// for this person. Adding a category should be an ALTER somebody thought
// about, and this file exists so the form and the route agree with it.
//
// THE PROSE IS SOMEWHERE ELSE
// profile_testimonials.relationship holds the sentence the public profile
// prints under a quote: "Reported to James at Disruptor Manufacturing". That
// is worth more to a reader than a category, and it is useless for counting,
// which is why there are two columns.
// ============================================================================

export const RELATIONSHIP_TYPES = [
  'Manager',
  'Colleague',
  'Direct Report',
  'Client',
  'Mentor'
]

// How many kinds of person have to vouch for somebody before the profile says
// so. Three, because two is a pair of references and four is most of a career;
// three different vantage points is the first number that means the view is
// not from one place.
export const EARNED_360_THRESHOLD = 3

// Derived, never stored. A stored count is a count that can be wrong, and this
// one is one query away from being right - so the profile cannot end up
// claiming a tag it no longer qualifies for because an unpublish did not
// remember to decrement something.
export function earned360({ testimonials }) {
  const kinds = new Set(
    (testimonials || [])
      .filter(t => t?.status === 'published' && typeof t.relationship_type === 'string' && t.relationship_type)
      .map(t => t.relationship_type)
  )
  return {
    kinds: [...kinds],
    count: kinds.size,
    earned: kinds.size >= EARNED_360_THRESHOLD,
    needed: Math.max(0, EARNED_360_THRESHOLD - kinds.size)
  }
}
