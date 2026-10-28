// ============================================================================
// QUOTE MARKS A REFEREE DID NOT MEAN TO SEND
//
// People paste. What arrives is often the sentence they wrote somewhere else
// with the marks that held it there still attached: the whole thing wrapped
// in quotes, or a lone closing curly quote at the end where the opening one
// was left behind in the other document.
//
// The page then prints the testimonial inside its own quotation marks, so a
// wrapped one comes out doubly quoted and a stray one comes out looking like
// a typo somebody else made.
//
// WHAT THIS REMOVES
//   a matching pair around the whole text          "like this"  “or this”
//   a lone double quote at one end with no partner  this ”
//
// WHAT IT LEAVES ALONE, DELIBERATELY
// Everything inside. A properly paired quotation in the middle of a sentence
// is something they wrote on purpose and is none of this function's business.
//
// And every single quote at an edge. A trailing ' or ’ is far more often a
// possessive than a stray - "the engineers’" is a word, not an unclosed
// quotation - and an apostrophe eaten off the end of somebody's sentence is
// a worse outcome than a stray mark left on it. Single quotes are only ever
// removed as a matching pair around the whole text, where what they are is
// not in doubt.
//
// BALANCE IS COUNTED, NOT ASSUMED
// `"he said "yes" and left"` is not a wrapped quotation; it is a sentence
// with a quotation in it and a mark at each end by coincidence. Stripping
// the outer two would leave `he said "yes" and left` - which is right - but
// the same naive rule applied to `"a" and "b"` would produce `a" and "b`,
// which is worse than what it started with. So the outer pair comes off only
// when what is left between them is balanced.
// ============================================================================

const PAIRS = [
  ['"', '"'],
  ['“', '”'],   // “ ”
  ["'", "'"],
  ['‘', '’']    // ‘ ’
]

// The ones that can be removed on their own, at one end, with no partner.
// Doubles only: see the note above about apostrophes.
const LONE_OPENERS = ['"', '“']
const LONE_CLOSERS = ['"', '”']

const countOf = (text, mark) => text.split(mark).length - 1

export function stripWrappingQuotes(value) {
  let text = String(value == null ? '' : value).trim()
  if (!text) return text

  // One pair at a time, outermost first, because a paste can carry more than
  // one layer. Bounded, so a string of nothing but quote marks cannot spin.
  for (let layer = 0; layer < 4; layer += 1) {
    if (text.length < 2) break

    const pair = PAIRS.find(([open, close]) => text.startsWith(open) && text.endsWith(close))
    if (!pair) break

    const inner = text.slice(1, -1).trim()
    if (!inner) break

    // The two marks are only a wrapper if what they enclose does not need
    // them.
    //
    // A curly pair has a distinct opener and closer, so each opener inside
    // having its closer is proof enough that the outer two belong together.
    //
    // A straight pair cannot be told apart that way. In the text
    //     "a" and "b"
    // the first and last characters are quotes and the two between them are
    // balanced, but the outer two are not a pair, and removing them would
    // give
    //     a" and "b
    // which is worse than what arrived. An even count is not evidence, so
    // the test for a straight pair is that there is nothing of the kind
    // inside at all. That leaves a genuinely wrapped sentence with its own
    // quotation in it untouched, which is the safe half of the trade.
    const [open, close] = pair
    const balanced = open === close
      ? countOf(inner, open) === 0
      : countOf(inner, open) === countOf(inner, close)
    if (!balanced) break

    text = inner
  }

  // A lone mark at one end, with nothing anywhere else that could be its
  // partner. Anything less certain than that is left where it is.
  for (const mark of LONE_CLOSERS) {
    if (!text.endsWith(mark)) continue
    const body = text.slice(0, -1)
    const partners = mark === '"' ? ['"'] : ['“']
    if (partners.some(one => body.includes(one))) continue
    text = body.trim()
    break
  }

  for (const mark of LONE_OPENERS) {
    if (!text.startsWith(mark)) continue
    const body = text.slice(1)
    const partners = mark === '"' ? ['"'] : ['”']
    if (partners.some(one => body.includes(one))) continue
    text = body.trim()
    break
  }

  return text
}
