// ============================================================================
// A TITLE OUT OF A FILE NAME, WHERE THERE IS ONE TO BE HAD
//
// A filename is the best guess at a title anybody has, and for a file somebody
// named it is a good one: "Q3 revenue deck.pdf" wants to be called Q3 revenue
// deck. For a file nobody named it is worse than nothing. A camera calls its
// output IMG_4312; a phone calls it PXL_20240518_091322845; a browser download
// of something generated server-side arrives as a uuid. Prefilling those put
// the owner in front of a form whose first field was already wrong, and
// deleting a wrong answer is more work than typing into an empty box - so the
// box is left empty and the placeholder does its job.
//
// WHICH WAY THIS LEANS
// Towards prefilling. Leaving a usable title unfilled costs a few seconds of
// typing; prefilling a uuid costs a deletion AND the suspicion that the form
// has filled something else in wrong. But a false positive is still a small
// loss, so every test below is for a shape a person would not choose, not for
// the absence of one they would.
//
// THE RULE, IN FULL
// After the extension is removed and the name is trimmed, the title is left
// empty when the name:
//
//   1. is empty;
//   2. contains no letters at all          20240101_123456, 1712345678901
//   3. is a uuid, hyphens or not           f81d4fae-7dec-11d0-a765-00a0c91e6bf6
//   4. is one run of 16+ hex characters    9f86d081884c7d659a2feaa0c55ad015
//   5. is longer than 8 characters and
//      holds no run of 3+ letters with a
//      vowel in it                        a1b2c3d4e5f6, kjhgfdszxcvb
//   6. starts with a known capture or
//      placeholder word, with nothing
//      after it but digits, separators
//      and filler                         IMG_1234, DSC01234, Screenshot
//                                         2024-01-01 at 12.00.00, untitled,
//                                         download (3), P1010001, GOPR0042
//   7. has 8 or more digits and 4 or
//      fewer letters                      a camera prefix this list has
//                                         never heard of
//
// Anything else prefills, with the extension removed, exactly as before.
//
// WHY 8 CHARACTERS GUARDS RULE 5
// Because a short name with no vowel is an acronym somebody chose - CV, P&L,
// Q3, KPI - and a long one is a hash. The cutoff is where those two stop
// overlapping.
//
// WHY RULE 6 LOOKS AT WHAT IS LEFT RATHER THAN AT A PATTERN
// "Screenshot 2024-01-01 at 12.00.00" is machine-named and "Screenshot of the
// dashboard" is not, and the prefix is identical. So the prefix is stripped and
// what remains is asked whether it contains a real word: the date, the time,
// the "at" and the brackets do not count, and "of the dashboard" does. That
// also means somebody who renamed half of a camera name keeps their half.
// ============================================================================

// Hyphens optional, because both spellings of a uuid turn up in storage paths
// and in downloads.
const UUID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i

// One unbroken hex run. 16 rather than 32, because truncated digests are as
// common as whole ones, and a sixteen-character hex word is not a title.
const LONG_HEX = /^[0-9a-f]{16,}$/i

// A run of three or more letters carrying a vowel: the smallest thing that
// reads as a word. `y` counts, because "rhythm" and "myth" are words and
// "qwrtzxcvb" is not.
const WORDLIKE = /[a-z]*[aeiouy][a-z]*/i
const LETTER_RUNS = /[a-z]+/gi

// What a camera, a phone, a screen capture or a browser calls a file it named
// itself. Longest alternatives first, because the alternation takes the first
// match and `p` would otherwise swallow the start of `pxl` and `pano`.
//
// The lookahead is what makes a bare `p` safe: it has to be followed by
// something that is not a letter, so `P1010001` matches and `pdf report` does
// not. `photo` matches in "photo of the team" and the test below then finds a
// real word after it, so that name still prefills.
const CAPTURE = new RegExp(
  '^(?:' + [
    'screen[\\s_-]?recording', 'screen[\\s_-]?shot', 'screenshot',
    'whatsapp[\\s_-]+(?:image|video|audio)',
    'scanned[\\s_-]+document',
    'mvimg', 'pano', 'burst', 'gopr', 'gh\\d{2}', 'dscn', 'dscf', 'dsc',
    'untitled', 'unnamed', 'download', 'export', 'capture', 'picture',
    'photos', 'photo', 'images', 'image', 'videos', 'video', 'movie', 'clip',
    'document', 'scan', 'file', 'copy', 'temp', 'tmp',
    'img', '_mg', 'pxl', 'vid', 'dji', 'sam', 'doc', 'pic',
    // Panasonic and Olympus, which name a file P then a counter and nothing
    // else. The digits are part of the prefix on purpose: a bare `p` matched
    // "P&L" and emptied the title of a spreadsheet somebody had named.
    'p\\d{6,}'
  ].join('|') + ')(?=$|[^a-z])',
  'i'
)

// Words that are still not a title when they are all that is left of one.
// `v2` and `final` are what people append to a machine name rather than what
// they would call the thing.
const FILLER = /^(?:at|on|am|pm|copy|final|new|v\d+|\d+)$/i

// Deliberately through .match rather than .test: LETTER_RUNS carries the `g`
// flag, and a global regex's test() advances its own lastIndex, so the same
// pattern would answer differently on every other call.
const isWord = (run) => run.length >= 3 && WORDLIKE.test(run)
const hasWord = (text) => (String(text || '').match(LETTER_RUNS) || []).some(isWord)

/**
 * Whether a file's name, extension already removed, is one its owner chose.
 *
 * Exported for its own sake as well as for titleFromFileName: a caller that
 * wants to say something about the name rather than use it should not have to
 * infer the answer from an empty string.
 */
export function looksMachineNamed(stem) {
  const name = String(stem || '').trim()

  // 1. Nothing to go on.
  if (!name) return true

  // 2. No letters at all: a timestamp, a counter, a date.
  if (!/[a-z]/i.test(name)) return true

  // 3 and 4. A uuid, or a hex digest.
  const solid = name.replace(/[\s_]+/g, '')
  if (UUID.test(solid)) return true
  if (LONG_HEX.test(name)) return true

  // 5. Long, and with nothing in it that reads as a word. Short names are
  //    left alone: see the note on the cutoff.
  if (name.length > 8 && !hasWord(name)) return true

  // 7. Mostly digits. Asked before the prefix test, because a camera name this
  //    list has never heard of is still a camera name.
  const digits = (name.match(/\d/g) || []).length
  const letters = (name.match(/[a-z]/gi) || []).length
  if (digits >= 8 && letters <= 4) return true

  // 6. A known prefix with nothing of the owner's after it. The prefix goes,
  //    and what is left is asked whether any of it is a word.
  const prefix = name.match(CAPTURE)
  if (prefix) {
    const rest = name.slice(prefix[0].length)
    // Split on anything that is not a letter, so a digit can never join a
    // letter and pass as a word: "IMG_E4312" splits to E and 4312 rather than
    // to "E4312", which has a vowel in it and would have read as English.
    const words = rest
      .split(/[^a-z]+/i)
      .filter(one => one !== '' && !FILLER.test(one))
    if (!words.some(isWord)) return true
  }

  return false
}

/**
 * The title to start a form with, given a file name, or '' where the name says
 * nothing about the file.
 *
 * One helper, because the rule is a judgement about names rather than about
 * evidence or portfolio pieces, and two copies of a judgement drift.
 */
export function titleFromFileName(name) {
  // Only a real extension - a dot, then two to five characters that are not
  // dots. Trimming at the last dot took the tail off "Report v1.2 final" and
  // off "acme.com case study".
  const stem = String(name || '').replace(/\.[^.\s]{1,5}$/, '').trim()
  return looksMachineNamed(stem) ? '' : stem
}
