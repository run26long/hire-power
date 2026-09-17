// ============================================================================
// FIRST NAMES, FOR SPEAKING TO SOMEBODY
//
// The name a colleague would use, for copy that addresses a person directly:
// the referee page, and the three testimonial emails. Everything to do with
// identity - who a row belongs to, what the validator checks a draft against,
// what a profile prints at the top of the page - still uses the full name.
//
// NOTHING HERE IS EVER STORED
// These values are derived on the way out and written back nowhere. The
// accounts table owns `first_name` and `display_name`, and neither is touched
// by anything that calls this.
//
// WHY A FALLBACK AT ALL
// `profiles.first_name` is real and populated for most accounts, but it is
// null on older ones, and referees have no account and therefore no stored
// first name of any kind. So a fallback is not a nicety: without it the
// referee half could not be done at all.
//
// The fallback is the first whitespace-separated word and nothing cleverer. A
// name is not parseable in general, and every rule beyond "the first word"
// gets somebody's name wrong in a way that is worse than not trying: "Christian
// Ivan Blanca" yields "Christian", which is right often enough and wrong in a
// way that reads as informality rather than as a bug.
// ============================================================================

// The first word of a full name, or an empty string when there is nothing to
// take one from.
export function firstWordOf(fullName) {
  return String(fullName || '').trim().split(/\s+/)[0] || ''
}

// The stored first name where an account has one, the first word of the
// display name otherwise, and the full name itself if even that is empty.
export function firstNameOf(account, fullName) {
  const stored = firstWordOf(account?.first_name)
  if (stored) return stored
  return firstWordOf(fullName) || String(fullName || '')
}
