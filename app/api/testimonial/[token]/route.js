import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { noEmDash } from '@/app/api/career-profile/_lib/recruiterContext'
import { stripWrappingQuotes } from '@/lib/stripQuotes'
import { sendTransactional, TRANSACTIONAL } from '@/lib/loops/sendTransactional'
import { firstNameOf, firstWordOf } from '@/lib/firstName'

// ============================================================================
// GET  /api/testimonial/[token]                      - what is being asked
// POST /api/testimonial/[token]                      - write, and polish
// POST /api/testimonial/[token] { action: approve }  - submit, and tell people
//
// THE ONLY UNAUTHENTICATED WRITE IN THIS PRODUCT
//
// No session, no account, addressed by a token in a URL, and it stores prose
// from a stranger against somebody's profile. So the rules it works under are
// tighter than anywhere else, and each one is here for a reason:
//
// WHAT IT GIVES OUT
// The candidate's display name, the referee's own name, and the text of this
// one row. Nothing else. No profile id, no user id, no slug, no email address,
// no other testimonial, no indication of how many there are. Somebody holding
// a token learns that they were asked and by whom, which they already knew
// from the email that brought them.
//
// WHAT IT NEVER LOGS
// The token. It is a credential, and a credential in a log file is a
// credential. Failures are logged by row id where one is known, and by nothing
// at all where it is not.
//
// THE RATE LIMIT IS ON THE ROW
// Three submissions per token per day, counted in the database rather than in
// process memory. Every other limit here guards a signed-in caller doing
// something cheap and resets on deploy without consequence. This one guards a
// public surface whose expensive half is a model call, and an in-memory count
// is not shared between serverless instances - it would not be a limit at all.
//
// TOKENS ARE REUSABLE AND DO NOT EXPIRE
// Which was decided deliberately: the referee is meant to be able to come back
// and change what they wrote, including from the confirmation email, possibly
// weeks later. The daily limit is what stops that being a way to burn model
// calls, and the candidate's publish step is what stops it being a way to put
// anything on a profile.
//
// WRITING IS NOT SUBMITTING
// Two requests, and the order matters. The first stores what the referee wrote
// and asks the model for a version of it; the row stays `requested` and nobody
// is told anything. The second is the referee saying yes to what came back,
// and it is the only one that moves the status and sends the emails.
//
// It used to be one request that saved as `submitted` and notified the
// candidate whatever happened, including when polishing had failed. A referee
// whose draft never arrived was shown their own words back under "your
// testimonial", told it had been saved and the candidate informed, and given a
// "try again" for something that had already happened. Try again has to come
// before saved, so now it does.
//
// POLISHING FAILS LOUD
// If the model call fails or its answer is refused, nothing is submitted and
// nobody is told. The referee's own words stay on the row untouched, so the
// retry starts from what they wrote, and the response says plainly that the
// step did not work. Losing somebody's writing would still be the worse
// failure; quietly publishing a draft they never saw is the one that was
// actually happening.
// ============================================================================

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MODEL = 'claude-haiku-4-5-20251001'
const TEMPERATURE = 0

const RAW_MIN = 40
const RAW_MAX = 4000
const POLISHED_MIN = 60
const POLISHED_MAX = 700

const DAILY_LIMIT = 3
const PHONE_MAX = 40

const EM_DASH = String.fromCharCode(0x2014)

const CONTROL = new RegExp(
  '[' +
  "\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F" +
  "\\u200B-\\u200F\\u2028\\u2029\\uFEFF" +
  ']', 'g'
)

// A token is opaque and this is the only thing said about its shape: it must
// look like something this server could have issued. Refusing early keeps a
// malformed value from reaching a query at all.
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{20,200}$/

const service = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const notFound = () => Response.json({ error: 'NOT_FOUND' }, { status: 404 })

// What the row is re-read as after a write, so the response always describes
// what is stored rather than what was sent.
const RETURNED = 'id, recipient_name, status, raw_text, polished_text, reference_consent, ' +
                 'reference_phone, daily_submissions, daily_submissions_on'

// Everything the referee page is allowed to know.
function publicShape(row, candidateName, candidateFirstName) {
  return {
    candidate_name: candidateName,
    candidate_first_name: candidateFirstName || candidateName,
    referee_name: row.recipient_name,
    status: row.status,
    raw_text: row.raw_text || null,
    polished_text: row.polished_text || null,
    reference_consent: row.reference_consent === true,
    reference_phone: row.reference_phone || null,
    submissions_left: submissionsLeft(row)
  }
}

function submissionsLeft(row) {
  const today = new Date().toISOString().slice(0, 10)
  const used = row.daily_submissions_on === today ? (row.daily_submissions || 0) : 0
  return Math.max(0, DAILY_LIMIT - used)
}

// The row, the profile it belongs to, and the candidate's name. Read with the
// service role because there is no session here and no public read policy on
// this table - the route is the boundary, not RLS.
async function load(supabase, token) {
  const { data: row } = await supabase
    .from('profile_testimonials')
    .select('id, profile_id, user_id, recipient_name, recipient_email, status, raw_text, ' +
            'polished_text, reference_consent, reference_phone, daily_submissions, daily_submissions_on')
    .eq('request_token', token)
    .maybeSingle()
  if (!row) return null

  const { data: account } = await supabase
    .from('profiles')
    .select('display_name, first_name')
    .eq('id', row.user_id)
    .maybeSingle()

  const candidateName = account?.display_name || 'a Hire Power member'
  return { row, candidateName, candidateFirstName: firstNameOf(account, candidateName) }
}

export async function GET(request, { params }) {
  try {
    const { token } = await params
    if (!token || !TOKEN_SHAPE.test(token)) return notFound()

    const supabase = service()
    const found = await load(supabase, token)
    if (!found) return notFound()

    return Response.json(publicShape(found.row, found.candidateName, found.candidateFirstName))
  } catch (error) {
    // No token in the message. A credential in a log is a credential.
    console.error('[testimonial] Read failed:', error?.message)
    return Response.json({ error: 'LOOKUP_FAILED' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// A light edit of what they actually wrote, in their own voice.
//
// This used to rewrite. It asked for two or three sentences in the third
// person about the candidate, told the model to lead with the strongest point
// and to cut anything said twice, and forbade the word "I" anywhere in the
// result. Every one of those is a licence to reorder, drop and recast, and
// together they produced the thing a referee least expects: somebody else's
// sentences over their name.
//
// The case that showed it: "Jessica helped me reconnect the decisions I made"
// came back as a third-person sentence about the referee, with a gender
// invented for them, the opening sentence gone and the scope of the claim
// moved. Nothing there was a bug in the model. It was the prompt being
// obeyed.
//
// A testimonial is a quotation. The referee writing "helped me" is the normal
// voice of one, and the name printed underneath is what tells a reader whose
// "me" it is. So the job here is proofreading, not editing: grammar,
// spelling, punctuation and genuinely awkward phrasing, and nothing else.
// ---------------------------------------------------------------------------
function buildPolishPrompt({ raw, candidateName, candidateFirst, refereeName }) {
  return `${refereeName} has written a testimonial about ${candidateName}. Proofread it.

WHAT YOU ARE DOING
Correcting it, not improving it. This is a quotation that will be printed on a profile with ${refereeName}'s name underneath it, so the words have to stay theirs. You are the pass a careful person makes before sending something: typos, grammar, punctuation, and the occasional sentence that genuinely does not parse. Nothing beyond that.

If the original is already well written, return it with the few corrections it needs, or unchanged. Returning it almost exactly as it arrived is the correct answer far more often than not, and it is never a failure.

WHAT YOU MAY CHANGE
- Spelling and typos.
- Grammar: agreement, tense, a missing or doubled word, a run-on that needs a full stop.
- Punctuation and capitalisation.
- Phrasing that is genuinely awkward or unreadable, repaired with the smallest change that makes it read. Awkward means a reader has to go back over it. It does not mean plain, casual, repetitive or shorter than you would have written.

WHAT YOU MAY NOT CHANGE
- The point of view. If they wrote "I", "me", "my", "we" or "our", those stay exactly as they are. Never convert their sentence into one about themselves in the third person, and never remove them from their own sentence. "${candidateFirst} helped me see it" stays "helped me see it".
- The order. Sentences stay in the order they wrote them. Never lead with the strongest point, never move a sentence, never merge two sentences that were separate or split one that was whole.
- The content. Never drop a sentence, a point, a detail or a qualifier, however slight or repetitive it looks. Never add a claim, a result, a number, a person, a group, a quality or an implication. Never widen or narrow what they said: if they named customers, it is customers and not also colleagues.
- Pronouns and gender. Use only the pronouns they used, for everyone. If they never said whether somebody is he or she, your version does not say either. Where they used a name, keep that name; where they used no pronoun, add none.
- Their register. Warm and casual stays warm and casual. Formal stays formal. Contractions they used are theirs. Their qualifiers are part of what they said: "somewhat", "generally" and "mostly" stay.
- The length. Roughly what they gave you. Nothing added to round it out, nothing cut to tighten it.

NUMBERS
A figure appears exactly as they wrote it or not at all. Never calculate, convert, round or restate one, and never say a figure was reduced, cut or improved unless they said what it became.

NAMES
Leave every name as they wrote it, including the one they use for ${candidateName}. If they call him "Jim" throughout, he stays "Jim". Do not standardise it to "${candidateFirst}" and do not add a surname.

FORMAT
- No em dashes. Use a comma or a full stop.
- No quotation marks around the result.
- No preamble and no explanation.

WHAT THEY WROTE
${raw}

CHECK YOUR ANSWER BEFORE YOU GIVE IT
Read your version beside theirs, sentence by sentence, in order. There should be the same number of sentences, saying the same things, in the same order, from the same point of view, with the same names and pronouns and numbers. Every difference between the two should be a correction you can name: a spelling, a tense, a comma, a sentence that did not parse. If you cannot name what a difference corrects, put their version back.

Return ONLY the proofread testimonial.`
}


// ---------------------------------------------------------------------------
// THE VERIFICATION PASS
//
// The prompt asks for a proofread. This checks that it got one, by comparing
// the answer to what the referee wrote, and it is the half that does not
// depend on the model having behaved. Where it finds a rewrite rather than a
// correction, the referee's own words are used instead: a light touch that
// did not happen is no loss, and their words are never wrong.
//
// Deterministic on purpose. A second model call to grade the first would be
// another thing that can hallucinate, and every rule here is a counting
// question that code answers exactly.
//
// WHAT IT CHECKS, AND WHY EACH ONE
//   point of view   they wrote "I" and the answer does not, or the other way
//                   round. This is the failure that started all of this.
//   pronouns        a he, she, they, him, her or their in the answer that is
//                   not in what they wrote. This is how a gender gets
//                   invented for somebody who never stated one.
//   sentence count  a sentence dropped or added.
//   order           sentence by sentence, each one still has most of its
//                   words in common with the one in the same position. A
//                   reordering, a merge, a split or a swapped-out sentence
//                   all fail here.
//   numbers         every figure they wrote, the same ones, no others.
//   new names       a capitalised word in the answer that they never used,
//                   which is a person, a company or a product arriving.
// ---------------------------------------------------------------------------
const FIRST_PERSON = /\b(i|me|my|mine|myself|we|us|our|ours)\b/gi
const PRONOUNS = /\b(he|him|his|she|her|hers|they|them|their|theirs)\b/gi

const sentencesOf = (text) => String(text || '')
  .replace(/\s+/g, ' ')
  .trim()
  .split(/(?<=[.!?])\s+/)
  .map(one => one.trim())
  .filter(Boolean)

const wordsOf = (text) => new Set(
  String(text || '').toLowerCase().match(/[\p{L}\p{N}']{3,}/gu) || []
)

const matched = (value, re) => {
  const found = String(value || '').match(re) || []
  return new Set(found.map(one => one.toLowerCase()))
}

const figuresOf = (text) => (String(text || '').match(/\d[\d,.]*/g) || [])
  .map(one => one.replace(/[.,]$/, ''))
  .sort()

const capsOf = (text) => new Set(
  (String(text || '').match(/\b\p{Lu}[\p{L}'-]+/gu) || []).map(one => one.toLowerCase())
)

const openersOf = (list) => new Set(
  list.map(one => (one.match(/^[\p{L}']+/u) || [''])[0].toLowerCase())
)

function verifyLightTouch(polished, raw) {
  const theirs = String(raw || '').trim()
  if (!theirs) return { ok: true }

  // Point of view. Either direction is a change of who is speaking.
  const mineThere = FIRST_PERSON.test(theirs); FIRST_PERSON.lastIndex = 0
  const mineHere = FIRST_PERSON.test(polished); FIRST_PERSON.lastIndex = 0
  if (mineThere !== mineHere) {
    return { reason: mineThere ? 'point of view dropped' : 'point of view added' }
  }

  // A pronoun nobody used. Gender arrives this way and cannot be taken back
  // once it is printed under somebody's name.
  const theirPronouns = matched(theirs, PRONOUNS)
  for (const word of matched(polished, PRONOUNS)) {
    if (!theirPronouns.has(word)) return { reason: `pronoun introduced: "${word}"` }
  }

  // A sentence dropped or added.
  const a = sentencesOf(theirs)
  const b = sentencesOf(polished)
  if (a.length !== b.length) {
    return { reason: `sentence count changed (${a.length} to ${b.length})` }
  }

  // Still in their order. Each sentence keeps most of the words it had, so a
  // correction passes and a move, a merge or a substitution does not. Scored
  // against the shorter of the two, so trimming a filler word is not a
  // failure and replacing the sentence is.
  for (let at = 0; at < a.length; at++) {
    const mine = wordsOf(a[at])
    const back = wordsOf(b[at])
    if (mine.size === 0) continue

    // Most of their words are still in it. A spelling or a tense keeps them
    // all; a move, a merge or a substituted sentence does not.
    let shared = 0
    for (const word of mine) if (back.has(word)) shared++
    if (shared < Math.max(1, Math.ceil(mine.size * 0.6))) {
      return { reason: `sentence ${at + 1} rewritten or reordered` }
    }

    // And it has not grown a clause. Keeping every word they wrote and
    // adding a few is the one way a claim arrives that the checks above do
    // not see: no pronoun, no figure, no name, just a consequence tacked on
    // the end. A couple of words is a repair; a handful is a sentence they
    // did not write.
    let extra = 0
    for (const word of back) if (!mine.has(word)) extra++
    if (extra > Math.max(2, Math.ceil(mine.size * 0.25))) {
      return { reason: `sentence ${at + 1} gained content` }
    }
  }

  // Every figure they gave, the same ones, and no figure they did not.
  if (figuresOf(theirs).join('|') !== figuresOf(polished).join('|')) {
    return { reason: 'numbers changed' }
  }

  // A capitalised word they never wrote: a person, a company or a product
  // arriving in somebody else's quotation. The first word of a sentence is
  // capitalised by grammar rather than by choice, so it is not evidence.
  const theirCaps = capsOf(theirs)
  const openers = openersOf(b)
  for (const word of capsOf(polished)) {
    if (theirCaps.has(word) || openers.has(word)) continue
    return { reason: `name introduced: "${word}"` }
  }

  return { ok: true }
}

function validatePolished(text, candidateName, refereeName, raw) {
  // The quote stripping used to be `^["'\s]+|["'\s]+$`, which took every
  // mark off both ends whatever it was doing there. That is right for a model
  // wrapping its answer in quotes and wrong for a sentence that ends on a
  // possessive. stripWrappingQuotes knows the difference.
  const cleaned = noEmDash(
    stripWrappingQuotes(
      String(text || '')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{2,}/g, ' ')
        .trim()
    )
  )
  if (cleaned.length < POLISHED_MIN) return { reason: `too short (${cleaned.length})` }
  if (cleaned.length > POLISHED_MAX) return { reason: `too long (${cleaned.length})` }
  if (cleaned.includes(EM_DASH)) return { reason: 'em dash survived' }
  // First person is no longer refused. It used to be, on the reading that a
  // referee's "I" would be mistaken for the candidate speaking - but the name
  // printed under the quotation is what says whose "I" it is, and refusing it
  // is what forced "helped me" to be rewritten as a sentence about the
  // referee, with a gender invented for them along the way. Their point of
  // view is theirs, and the verification pass below is what keeps it.

  // And one that names the referee reads as a third party describing the wrong
  // person, because the page already prints "Marcus Feld" underneath it. The
  // first version of this prompt produced exactly that - "Marcus Feld worked
  // with James... Feld would work with him again" - which is a correct
  // sentence about the wrong subject.
  //
  // Checked on every name part of two characters or more, so a surname on its
  // own is caught as well as the full name.
  //
  // EXCEPT A NAME THE CANDIDATE ALSO HAS
  // The polished text is required to name the candidate, so a name part they
  // share cannot be evidence of anything. Jessica Long writing about James Long
  // produced a correct rewrite that this check refused for containing "Long",
  // and it refused every retry: the prompt asks for the candidate's name, the
  // check forbids it, and at temperature zero that is a permanent deadlock for
  // anybody who shares a name with the person they are writing about. Family
  // members, married colleagues and common surnames are not rare.
  //
  // Subtracted rather than skipped: "Jessica" is still refused, because only
  // the overlapping part is ambiguous.
  const nameParts = (value) => String(value || '')
    .split(/\s+/)
    .map(p => p.replace(/[^\p{L}\p{N}'-]/gu, ''))
    .filter(p => p.length > 1)

  const candidateParts = new Set(nameParts(candidateName).map(p => p.toLowerCase()))
  const parts = nameParts(refereeName).filter(p => !candidateParts.has(p.toLowerCase()))

  for (const part of parts) {
    const named = new RegExp(`\\b${part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    if (named.test(cleaned)) return { reason: `names the referee: "${part}"` }
  }

  // Unchanged is no longer refused either. Under a proofreading brief it is
  // the right answer for anything already well written, and refusing it was
  // what pushed the model to go looking for something to change.

  return { text: cleaned }
}

export async function POST(request, { params }) {
  let rowId = null
  try {
    const { token } = await params
    if (!token || !TOKEN_SHAPE.test(token)) return notFound()

    const supabase = service()
    const found = await load(supabase, token)
    if (!found) return notFound()

    const { row, candidateName, candidateFirstName } = found
    rowId = row.id

    let body
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'Invalid request.' }, { status: 400 })
    }

    // ---- APPROVAL ----
    // The only thing that makes a testimonial real, and the only thing that
    // tells the candidate. It comes before the rate limit on purpose: approving
    // a draft that already exists costs nothing and asks no model anything, and
    // somebody who used their three rewrites getting locked out of accepting
    // the third one would be the limit working against its own point.
    if (body?.action === 'approve') {
      // Nothing to approve is not an error the referee caused, but it is not
      // an approval either. Refusing here is what stops an empty row being
      // announced to the candidate.
      if (!row.polished_text) {
        return Response.json(
          { error: 'There is nothing to approve yet.', code: 'NOT_READY' },
          { status: 409 }
        )
      }

      // WHICH VERSION THEY CHOSE
      // The review screen offers the rewrite or the words they typed, and
      // whichever was on screen when they pressed send is the one that goes
      // out. `polished_text` is what the profile prints and what the emails
      // carry, so choosing the original copies it there; `raw_text` is never
      // written to, so the original survives either way and the choice can be
      // changed later without having lost anything.
      const keepOriginal = body?.version === 'original'
      if (keepOriginal && !row.raw_text) {
        return Response.json(
          { error: 'There is nothing to approve yet.', code: 'NOT_READY' },
          { status: 409 }
        )
      }
      const chosen = keepOriginal ? row.raw_text : row.polished_text

      const { error: approveError } = await supabase
        .from('profile_testimonials')
        .update({
          polished_text: chosen,
          status: 'polished',
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', row.id)

      if (approveError) {
        console.error('[testimonial] Approve failed for row', row.id, approveError.message)
        return Response.json({ error: "We couldn't send that. Please try again." }, { status: 500 })
      }

      // ---- THE TWO EMAILS ----
      // Only now, and neither is allowed to fail the request. The testimonial
      // is approved and stored; an email that did not send is a nuisance, and
      // undoing somebody's decision over it would be worse.
      const site = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '')

      void sendTransactional({
        transactionalId: TRANSACTIONAL.TESTIMONIAL_CONFIRMATION,
        email: row.recipient_email,
        dataVariables: {
          candidateName,
          candidateFirstName,
          refereeName: row.recipient_name,
          // No account behind a referee, so there is no stored first name to
          // prefer: the first word of what the candidate typed is all there is.
          refereeFirstName: firstWordOf(row.recipient_name),
          // The version they chose, not whatever the model happened to write.
          polishedText: chosen,
          testimonialUrl: `${site}/testimonial/${token}`
        }
      })

      const { data: candidate } = await supabase
        .from('profiles')
        .select('display_name, first_name')
        .eq('id', row.user_id)
        .maybeSingle()
      const { data: authUser } = await supabase.auth.admin.getUserById(row.user_id)
      if (authUser?.user?.email) {
        const notifyName = candidate?.display_name || candidateName
        void sendTransactional({
          transactionalId: TRANSACTIONAL.TESTIMONIAL_NOTIFICATION,
          email: authUser.user.email,
          dataVariables: {
            candidateName: notifyName,
            // Derived from the name this payload actually carries, so the two
            // cannot describe different people if the re-read returns
            // something the earlier lookup did not.
            candidateFirstName: firstNameOf(candidate, notifyName),
            refereeName: row.recipient_name,
            refereeFirstName: firstWordOf(row.recipient_name),
            // The link in this email is "review it here", so it says which
            // one. The editor opens its Review panel on the testimonial
            // named here while that one is still waiting on a decision, and
            // on whatever else is waiting when it is not - a link followed
            // twice, or followed after the owner has already decided, lands
            // somewhere sensible rather than on an empty panel.
            profileUrl: `${site}/career-profile?review=${row.id}`
          }
        })
      }

      const { data: sent } = await supabase
        .from('profile_testimonials')
        .select(RETURNED)
        .eq('id', row.id)
        .maybeSingle()

      return Response.json({ ...publicShape(sent || row, candidateName, candidateFirstName), approved: true })
    }

    // ---- THE LIMIT, BEFORE ANY WORK ----
    const today = new Date().toISOString().slice(0, 10)
    const usedToday = row.daily_submissions_on === today ? (row.daily_submissions || 0) : 0
    if (usedToday >= DAILY_LIMIT) {
      return Response.json(
        {
          error: `That is ${DAILY_LIMIT} versions today. You can come back tomorrow and change it again.`,
          code: 'RATE_LIMITED'
        },
        { status: 429 }
      )
    }

    // ---- WHAT THEY WROTE ----
    if (typeof body?.raw_text !== 'string') {
      return Response.json({ error: 'Write something first.', code: 'INVALID' }, { status: 400 })
    }
    const raw = String(body.raw_text)
      .replace(CONTROL, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    if (raw.length < RAW_MIN) {
      return Response.json(
        { error: 'A sentence or two more would help.', code: 'TOO_SHORT' },
        { status: 400 }
      )
    }
    if (raw.length > RAW_MAX) {
      return Response.json(
        { error: 'That is longer than we can use. Please shorten it.', code: 'TOO_LONG' },
        { status: 400 }
      )
    }

    // ---- WILLING TO BE A REFERENCE ----
    const consent = body?.reference_consent === true
    let phone = null
    if (consent && typeof body?.reference_phone === 'string') {
      const trimmed = body.reference_phone.replace(CONTROL, '').replace(/\s+/g, ' ').trim()
      if (trimmed.length > PHONE_MAX) {
        return Response.json({ error: 'That phone number is too long.', code: 'INVALID' }, { status: 400 })
      }
      phone = trimmed || null
    }

    // ---- SAVED, BUT NOT SUBMITTED ----
    // Their words are the thing that matters and the thing that cannot be
    // reproduced. They go in first, and the count goes up with them, so a
    // model call that hangs cannot be used to get a fourth attempt.
    //
    // The status stays `requested`. Writing is not submitting: the referee has
    // not seen what their words became, and nothing is final until they say so
    // in the approve branch above. `submitted_at` is set there too, for the
    // same reason - it is the moment they agreed, not the moment they typed.
    const { error: saveError } = await supabase
      .from('profile_testimonials')
      .update({
        // Without the marks that held it somewhere else. People paste, and
        // what arrives is often the sentence wrapped in quotes, or trailing a
        // closing one whose opener stayed behind in the other document. The
        // profile prints a testimonial inside its own quotation marks, so
        // either reads as a mistake somebody else made.
        raw_text: stripWrappingQuotes(raw),
        reference_consent: consent,
        reference_phone: consent ? phone : null,
        daily_submissions: usedToday + 1,
        daily_submissions_on: today,
        updated_at: new Date().toISOString()
      })
      .eq('id', row.id)

    if (saveError) {
      console.error('[testimonial] Save failed for row', row.id, saveError.message)
      return Response.json({ error: "We couldn't save that. Please try again." }, { status: 500 })
    }

    // ---- POLISH ----
    //
    // Three attempts, the way ./career-profile/imow/generate makes three, and
    // for the reason that route gives: one call at temperature 0 means a
    // refusal is permanent. The same prompt asked twice returns the same draft,
    // so a first-person sentence or a length miss ended the referee's visit at
    // "We could not prepare your draft" with no way past it - and they had done
    // nothing wrong. The retry names what was refused, so the second call is
    // the same request with one correction on the end rather than the same
    // question asked again.
    const prompt = buildPolishPrompt({
      raw,
      candidateName,
      candidateFirst: candidateFirstName,
      refereeName: row.recipient_name
    })

    let polished = null
    const refusals = []
    for (let attempt = 0; attempt < 3 && !polished; attempt++) {
      try {
        const content = attempt === 0
          ? prompt
          : `${prompt}

Your previous version was rejected: ${refusals[refusals.length - 1]}. Write it again, fixing only that and leaving everything else exactly as they wrote it.

It must still be their words, in their order, from their point of view: the same sentences, the same count, the same names, the same pronouns and the same numbers.`

        const message = await anthropic.messages.create({
          model: MODEL,
          max_tokens: 500,
          temperature: TEMPERATURE,
          messages: [{ role: 'user', content }]
        })
        const checked = validatePolished(message?.content?.[0]?.text, candidateName, row.recipient_name, raw)
        if (checked.text) {
          // The shape is right. Whether it is still their testimonial is a
          // separate question, and the one this step exists to answer.
          const faithful = verifyLightTouch(checked.text, raw)
          if (faithful.ok) polished = checked.text
          else {
            refusals.push(faithful.reason)
            console.error('[testimonial] Polish not a light touch for row', row.id, `attempt ${attempt + 1}:`, faithful.reason)
          }
        } else {
          refusals.push(checked.reason)
          console.error('[testimonial] Polish refused for row', row.id, `attempt ${attempt + 1}:`, checked.reason)
        }
      } catch (error) {
        // A transport failure is not a refusal and there is nothing to correct,
        // so the next attempt repeats the request as it stands.
        refusals.push('the request did not complete')
        console.error('[testimonial] Polish errored for row', row.id, `attempt ${attempt + 1}:`, error?.message)
      }
    }

    // ---- WHAT THEY WROTE, WHERE THE POLISH DID NOT EARN ITS PLACE ----
    //
    // Three attempts that each failed the comparison means the model will not
    // leave this one alone, so it is left alone instead. Their own words are
    // a correct answer to "what should this testimonial say" - they are the
    // testimonial - and showing them is better than showing a rewrite that
    // changed who was speaking, or than telling the referee their visit
    // failed over a step that is cosmetic.
    if (!polished && String(raw || '').trim()) {
      console.error('[testimonial] Polish fell back to the original for row', row.id, refusals.join('; '))
      polished = String(raw).trim()
    }

    // The draft is stored so a referee who closes the tab comes back to it, and
    // the status still does not move: a draft nobody has approved is not a
    // testimonial. The candidate is told nothing at this point.
    if (polished) {
      const { error: polishError } = await supabase
        .from('profile_testimonials')
        .update({ polished_text: polished, updated_at: new Date().toISOString() })
        .eq('id', row.id)
      if (polishError) {
        console.error('[testimonial] Polish save failed for row', row.id, polishError.message)
        polished = null
      }
    }

    // ---- NOTHING WAS PRODUCED ----
    // No draft means nothing to approve, so the row stays where it was and the
    // referee is told plainly that the step failed. Their words are safe on the
    // row and come back in the response, so the retry starts from what they
    // wrote rather than from an empty box.
    if (!polished) {
      const { data: kept } = await supabase
        .from('profile_testimonials')
        .select(RETURNED)
        .eq('id', row.id)
        .maybeSingle()
      return Response.json(
        { ...publicShape(kept || row, candidateName, candidateFirstName), polish_failed: true },
        { status: 200 }
      )
    }

    // A draft, waiting to be approved. No emails: nobody has agreed to
    // anything yet, and telling the candidate now is what made "Saved" appear
    // before "Try again".
    const { data: drafted } = await supabase
      .from('profile_testimonials')
      .select(RETURNED)
      .eq('id', row.id)
      .maybeSingle()

    return Response.json(publicShape(drafted || row, candidateName, candidateFirstName))
  } catch (error) {
    console.error('[testimonial] Submit failed for row', rowId, error?.message)
    return Response.json({ error: "We couldn't save that. Please try again." }, { status: 500 })
  }
}
