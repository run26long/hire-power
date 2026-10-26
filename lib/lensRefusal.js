// ============================================================================
// WHAT TO SAY WHEN A CAREER DIRECTION IS REFUSED
//
// Two surfaces ask the same route to create a direction - the Career Profile
// settings drawer and the Resume Writer hub's "Create your own" - and both
// have to explain the same two answers. They had drifted: the drawer composed
// its own sentence and the hub rendered the route's `message`, so the same
// refusal read one way on one page and another way on the other, and only one
// of them had been updated when the copy changed.
//
// So the words live here, once, and both surfaces call this. A copy change is
// a change to one function rather than a change to one page and a note to
// remember the other.
//
// WHY THE ROUTE'S OWN `message` IS NOT THE SOURCE
// It names the account's strongest directions in prose - "your knowledge base
// is strongest in A, B and C" - which was written before those directions were
// on screen. They are now listed above the box in both places, so the sentence
// repeated a list the reader could already see, and repeated it from a second
// Claude call that could disagree with the one that drew the list. Pointing at
// them is shorter and cannot fall out of step.
//
// THREE ANSWERS, NOT TWO
// A direction can be refused because the account has barely any career data at
// all, because this particular direction is not in the data it does have, or
// because the account already holds it. They need different words: the first
// is about the whole profile and is answered by using Hire Power more, the
// second is about one name and is answered by picking another, and the third
// is answered by looking at what is already on screen.
//
// The first two share a title on purpose. From the reader's side both are
// "there is not enough here yet"; what differs is what to do about it, which
// is what the body says.
//
// The route now sends a code and nothing else. There is no `message` to fall
// back to, because there is no longer a sentence on the server that anybody
// renders.
// ============================================================================

export const REFUSAL_TITLES = {
  DUPLICATE: 'You already have this direction',
  UNSUPPORTED: 'Not enough career data yet',
  NOT_ENOUGH_DATA: 'Not enough career data yet',
}

/**
 * The note to show under the box, as { title, body }.
 *
 * @param {object}  refusal               the route's payload for ok:false
 * @param {string}  refusal.code          'DUPLICATE', 'NOT_ENOUGH_DATA', or
 *                                        anything else, which is NOT_SUPPORTED
 * @param {string}  refusal.overlapsWith  the existing direction it repeats
 * @param {string}  name                  what the person typed
 */
export function renameOfferLabel(existingName, typedName) {
  return `Rename ${existingName} to ${typedName}`
}

// ---------------------------------------------------------------------------
// AFTER A RENAME, WHEN THERE IS CONTENT UNDER THE OLD NAME
//
// The generator writes a direction's headline, bio and proof points for a
// particular name - the prompt says "you are writing the {name} view of that
// career" - so a renamed direction keeps prose aimed at the name it used to
// have. Accurate sentences under the wrong heading.
//
// Offered, not done. The app records nothing about who wrote these fields:
// the hand-edit route and the generator write the same columns with no
// provenance, so rewriting automatically would silently replace anything the
// owner had typed there, with no undo and nothing to say it had happened.
// Asking costs one click and cannot destroy anything.
//
// It names both the old and the new name, because the reader has just typed
// one of them and may not remember the other was ever different.
// ---------------------------------------------------------------------------
export const REWRITE_OFFER = {
  title: 'Rewrite for the new name?',
  confirmLabel: 'Rewrite',
  dismissLabel: 'Keep as is',
}

export function rewriteOfferNote({ newName, oldName, lensId }) {
  return {
    title: REWRITE_OFFER.title,
    body: `${newName} still has content written for ${oldName}. Rewrite it for the new name? This replaces the current headline, bio, and proof points.`,
    rename: null,
    // What the buttons act on. Named apart from `rename` so a surface can tell
    // the two notes apart without reading the title.
    rewrite: { lensId, newName, oldName },
  }
}

export function lensRefusalNote(refusal, name) {
  if (refusal?.code === 'DUPLICATE' && refusal?.overlapsWith) {
    const wanted = String(name || '').trim()
    return {
      title: REFUSAL_TITLES.DUPLICATE,
      body: `This overlaps with ${refusal.overlapsWith}.`,
      // The way out, where there is one. Somebody who typed a better name for
      // a direction they already have does not want a second direction - they
      // want this one called that. Offered rather than done, because it is
      // their existing direction being changed and the refusal is the first
      // they have heard of it.
      //
      // Absent without an id to act on, so the surfaces render no button
      // rather than one that cannot work.
      rename: refusal.overlapsLensId && wanted
        ? { lensId: refusal.overlapsLensId, label: renameOfferLabel(refusal.overlapsWith, wanted) }
        : null,
      rewrite: null,
    }
  }

  // Not about the name they typed at all: there is barely a knowledge base to
  // ask the question of. Naming their direction back to them here would
  // suggest that a different name might work, which is the one thing that is
  // certainly not true. So this says what would actually change the answer.
  if (refusal?.code === 'NOT_ENOUGH_DATA') {
    return {
      title: REFUSAL_TITLES.NOT_ENOUGH_DATA,
      body: 'We need more of your career history before we can add new directions. Keep coaching and practicing, and suggested directions will appear here as your career data grows.',
      rename: null,
      rewrite: null,
    }
  }

  // "Suggested above" is true on both surfaces: the drawer lists them over the
  // input, and the hub's menu lists them over "Create your own".
  const typed = String(name || '').trim()
  return {
    title: REFUSAL_TITLES.UNSUPPORTED,
    body: typed
      ? `We don’t have enough evidence in your career data to support “${typed}.” Your strongest supported directions are suggested above.`
      : "There isn't enough career data to support that direction yet.",
    // Every branch answers the same shape, so a surface reading note.rename
    // gets null here rather than undefined on one path and null on another.
    rename: null,
    rewrite: null,
  }
}
