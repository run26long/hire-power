// ============================================================================
// WHAT A SLUG MAY BE
//
// This value is a URL path segment. `/p/<slug>` is the whole public address of
// somebody's Career Profile, so what is allowed here is not a matter of taste:
// a slug with a slash in it addresses a different route, one with a space has
// to be encoded everywhere it is printed, and an empty one resolves to `/p/`,
// which is not a profile at all.
//
// WHAT THE DATABASE ACTUALLY ENFORCES
// Unique, and not null. That is all. Every other shape below - empty strings,
// spaces, slashes, uppercase, two hundred characters - is accepted by the
// column today. I checked by writing each one and rolling it back rather than
// by reading the migration, because a constraint in a file is not a constraint
// in a database.
//
// So this module is the enforcement, not a convenience. It lives in _lib
// because two routes need to agree about it exactly: the one that checks
// whether a slug is free and the one that saves it. Two places that both know
// what a valid slug is are two places that can come to disagree, and the
// disagreement would show up as a check that says yes followed by a save that
// says no.
//
// scripts/add-slug-shape-to-career-profiles.sql adds the same rules as a CHECK
// constraint. That is the second lock: it stops a row written by something
// other than this route, and it is not a substitute for validating here, where
// a rejection can be a sentence somebody can act on rather than a 500.
// ============================================================================

export const SLUG_MIN = 3
export const SLUG_MAX = 60

// Lowercase letters, digits and single hyphens, beginning and ending on an
// alphanumeric. No leading, trailing or doubled hyphens: they are invisible in
// a link and make two different addresses look like the same one.
const SHAPE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// Words that must not become somebody's public address. Nothing here can
// collide with an app route - the profile lives under /p/ and these would be
// path segments beneath it - but each one makes a link that reads as an error
// or as the system talking rather than as a person.
const RESERVED = new Set([
  'p', 'api', 'new', 'edit', 'admin', 'null', 'undefined', 'none',
  'true', 'false', 'test', 'profile', 'settings', 'login', 'logout',
  'signin', 'signup', 'dashboard', 'preview', 'draft'
])

// What somebody typed, turned into what it would have to be. Trimming and
// lowercasing are done for them rather than refused: a trailing space and a
// capital letter are typing, not intent. Anything beyond that is left alone,
// so `validateSlug` can explain what is wrong instead of silently producing
// something the person did not ask for.
export function normalizeSlug(input) {
  if (typeof input !== 'string') return ''
  return input.trim().toLowerCase()
}

// Returns null when the slug is usable, or a sentence saying what is wrong.
// The sentences are meant to be shown, so they name the rule rather than the
// pattern - somebody who has just typed their name is not helped by a regex.
export function validateSlug(slug) {
  if (!slug) return 'Choose a link for your profile.'
  if (slug.length < SLUG_MIN) return `Links need at least ${SLUG_MIN} characters.`
  if (slug.length > SLUG_MAX) return `Links can be at most ${SLUG_MAX} characters.`
  if (!SHAPE.test(slug)) {
    return 'Use lowercase letters, numbers and hyphens, starting and ending with a letter or number.'
  }
  if (RESERVED.has(slug)) return 'That one is reserved. Try another.'
  return null
}
