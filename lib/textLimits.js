// ============================================================================
// HOW LONG THE WRITTEN FIELDS MAY BE
//
// One place, because three parties have to agree about it and they are in
// different processes: the textarea that will not accept a 2,001st character,
// the generator that must not produce one, and the save route behind both.
// When those numbers lived in the components the generator did not know them,
// and a Regenerate could hand the owner a bio their own field would refuse to
// save.
//
// THE CLAMP IS A LAST RESORT, NOT A STRATEGY
// The right way to get a bio under two thousand characters is to ask for one
// and to refuse the ones that come back too long, which is what the generate
// route does. This is what happens when that has already been tried and the
// model is still over: a cut at the last sentence that fits, so the owner is
// handed something that ends rather than something that stops.
// ============================================================================

export const LIMITS = {
  headline: 120,
  bio: 2000,
  imow: 2000
}

// Cut at the last sentence that finishes inside `max`.
//
// A headline usually contains no sentence at all, which is why the fallback
// matters as much as the rule: the last whole word inside the limit, never a
// severed one. The hard slice at the end is unreachable for any real sentence
// and exists so the function always returns something inside the limit.
export function clampToLimit(text, max) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean

  let best = 0
  const ends = /[.!?]["'’”)\]]*(?=\s|$)/g
  let m
  while ((m = ends.exec(clean)) !== null) {
    const stop = m.index + m[0].length
    if (stop <= max) best = stop
    else break
  }
  if (best > 0) return clean.slice(0, best).trim()

  const word = clean.slice(0, max).replace(/\s+\S*$/, '').trim()
  return word.length > 0 ? word : clean.slice(0, max).trim()
}

// Said to the owner when what is already stored is longer than what may now be
// saved. Legacy copy predates the limit and is not touched for it; this is the
// line that explains why Save is not available until they act.
//
// It takes the limit rather than naming one, because two fields have ceilings
// and a headline told it is over two thousand characters is being told
// something untrue about itself.
export function overLimitNote(max) {
  return 'This version is over the ' + max.toLocaleString('en-US') +
    '-character limit. Edit it or ask us for another version before saving.'
}
