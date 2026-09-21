import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { noEmDash } from '@/app/api/career-profile/_lib/recruiterContext'
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
// Two or three sentences, in the third person, from what they actually wrote.
// ---------------------------------------------------------------------------
function buildPolishPrompt({ raw, candidateName, candidateFirst, refereeName }) {
  return `${refereeName} has written a testimonial about ${candidateName}. Edit it into two or three sentences for a professional profile.

WHAT YOU ARE DOING
Making this read as well as ${refereeName} would have written it with an hour and a good editor, and no better than that. It is going on a profile a recruiter will read, so it has to sound considered rather than dashed off. It is also a quotation attributed to a real person, so it has to still sound like them.

WHERE TO ACTUALLY IMPROVE IT
- Clarity. Turn spoken shorthand into written prose. Resolve vague pronouns and dangling references so each sentence stands on its own.
- Specificity. Their concrete details are the most valuable thing in the text and are usually buried. Bring them forward and state them plainly. Specificity means surfacing what they wrote, never supplying what they did not.
- Flow. Lead with the strongest point rather than whatever came out first. Join the fragments into sentences that carry weight. Cut the throat-clearing, the hedging and anything said twice.
- Presentation. Repetition, filler and false starts go. Their voice does not. This should read as a better version of the person who wrote it, not as a corporate rewrite of them: somebody who wrote warmly and casually still sounds warm and casual, somebody who wrote formally stays formal, and contractions they used are theirs to keep. Their judgement stays exactly as strong or as qualified as they made it, and their qualifiers go with it: "somewhat", "generally" and "mostly" are part of what they said, not hedging to be tidied away.

HOW FAR TO GO
As far as the original allows and no further. Rambling, colloquial writing can change a great deal, because there is a great deal in the way of what they meant. Writing that is already clear and professional should come back close to untouched, and returning it nearly unchanged is the right answer in that case. Never restructure a sentence that was already working, never reach for a grander word than the one they chose, and never make a change whose only purpose is to look like you did something.

HOW LONG IT SHOULD BE
Proportional to what they gave you. A short response tightens into a couple of strong sentences and does not acquire a third in order to look substantial. A detailed response keeps its substance and loses its filler. The edited version should rarely be longer than the original and must never be padded: no scene-setting, no summarising sentence at the end, nothing added to reach a length. Shorter than what they wrote is a perfectly good outcome.

THE LINE YOU DO NOT CROSS
Their meaning, their facts and their judgement are not yours to adjust. Do not add a claim, a number, a scope or a result they did not give. Do not warm up a measured assessment or sharpen a mild one. If they were vague about something, the edited version is vague about it too.

Nothing may appear that they did not put there, and that covers far more than facts and figures. Do not add people, audiences, relationships, results, qualities or implications they did not state. Widening is the form this usually takes, because it reads as a natural completion rather than as an invention. If they wrote "customers trust him", the edited version says "customers trust him", not "customers and colleagues trust him". They named customers. Colleagues are a group nobody mentioned, and adding them puts a claim on somebody's profile that no referee ever made. The same trap catches a stated quality that acquires a second one beside it, a described situation that acquires a consequence, and one named person who quietly becomes a team.

NUMBERS ARE COPIED, NEVER COMPUTED
A figure appears exactly as they wrote it or it does not appear. Do not calculate, invert, convert, round or restate one. "We were throwing away 60 percent before he set up the nesting" becomes a sentence containing "60 percent", not one containing any other number. Working out what a figure implies is inventing a fact, and it is the easiest way to put a number on somebody's profile that nobody ever said.

A BEFORE IS NOT AN AFTER
The same trap without the arithmetic. "We were throwing away 60 percent of the sheet metal before he set up the nesting software" says what the waste was beforehand and says nothing whatever about what it became. It does not become "cut waste to nearly nothing", "reduced waste dramatically" or any other ending, because they did not give one. Where they described a problem and an action but not a result, the edited version describes the problem and the action and stops there. Keep the figure while you do it: it is the most concrete thing they said and dropping it to stay safe loses the reader the one detail worth having. State it as the before that it was.

No verb of change either. "reduced waste from 60 percent", "brought the scrap rate down from 60 percent" and "improved on 60 percent" each assert that the number moved, which is the invented ending again with the figure left in to make it look sourced. The word "before" in what they wrote marks when the figure was true. It is not a claim that anything came after it.

So, given "we were throwing away 60 percent of the sheet metal before he set up the nesting software":

Wrong: "set up nesting software that brought sheet metal waste down from 60 percent" - invents the result.
Wrong: "set up nesting software that addressed the sheet metal waste problem" - throws away the figure, which was the best thing in the sentence.
Right: "the shop was throwing away 60 percent of its sheet metal when he set up the nesting software" - the figure, the action, no ending.

WHAT TO DO WITH THE SENTENCES ABOUT THEMSELVES
Referees write things like "I would work with him again" and "I did not see him handle a crisis". Those are about ${refereeName}, and this text carries ${refereeName}'s name underneath it already. Turn such a sentence into what it says about the candidate, or leave it out. Never name ${refereeName} and never replace "I" with ${refereeName} or with any description of them. The result must not contain the word "${refereeName}" or any part of it.

The word "I" must not survive anywhere in your answer, including in the middle of a sentence. "I would work with him again" does not become "he is someone I would work with again", which is the same first-person sentence with a clause in front of it. It becomes a statement about the candidate or it is dropped.

WHO THE SENTENCES ARE ABOUT
The candidate, always. This becomes a quotation printed on their profile with "${refereeName}" already shown underneath it as the person who said it, so naming ${refereeName} in the text itself makes it read as a third party describing the wrong person. Never write "${refereeName}" and never write "they" meaning ${refereeName}. "Worked with him for three years" becomes a statement about the candidate, not about ${refereeName}.

WHAT TO CALL THEM
The name ${refereeName} uses, whenever they use one name consistently and it is plausibly his. Colleagues call people different things, and which name somebody reaches for is part of how they talk about them. "Jim" all the way through stays "Jim". "Jamie" all the way through stays "Jamie". Neither gets standardised to "${candidateFirst}", because which one he prefers is not yours to decide.

Fall back to "${candidateFirst}" only where there is no such name:
- They never named him.
- More than one name is used for the person being described. Do not settle on whichever came first and quietly drop the rest: if he is "Jim" in one sentence and "Rob", "Jimmy" or "Dave" in another, the naming is unreliable and "${candidateFirst}" is the only safe name to print.
- What they used is not a name at all, such as "Pickleball".
- The name is unrelated to his own and reads as a mistake rather than a preference.
- The name they use for him is also ${refereeName}'s own, which a reader cannot tell apart from the signature under the quotation.

Whichever name you land on, write that name and nothing more. Never a surname, and never a first and last name together. The only exception is a surname ${refereeName} wrote themselves in a sentence that genuinely needs it, which is rare. The page already prints his full name above the quotation.

Use the name once, where a sentence needs one, then pronouns. Do not repeat it in every sentence.

RULES
- Two or three sentences. No more.
- Third person, about the candidate, under the name chosen in WHAT TO CALL THEM. Never "I", never "${refereeName}", never address the reader.
- Never invent a fact, a number, a role, a company or a period of time. If they were vague, stay vague.
- Never add a person, a group, a relationship, a quality or an outcome they did not state.
- Never say a figure was reduced, cut or improved unless they said what it became.
- Do not add praise they did not give. If they were measured, stay measured.
- Sound like them. Warm and casual stays warm and casual, formal stays formal.
- No em dashes. Use a comma or a full stop.
- Do not open with the name followed by "is", whichever name you settled on.
- No quotation marks around the result.

WHAT THEY WROTE
${raw}

CHECK YOUR ANSWER BEFORE YOU GIVE IT
Read what you have written back against what they wrote above, one claim at a time. For every person, group, relationship, quality, fact, figure and outcome in your version, find the specific phrase in their text that it came from. Anything you cannot trace to a phrase they actually wrote comes out, even where it is plausible, flattering and almost certainly true. Correct it, then answer with the corrected version.

Trace the words themselves and not the impression they leave. These are the ones that get through most often, so check each by name:

1. A word swapped for a nearby one. It is a different claim. "never late" is about timekeeping and does not become "never missed a shift", which is about attendance. "helped with" does not become "led". "asked his advice" does not become "relied on him". Where their word was narrower, keep their word.
2. A result they did not give. Never say an action reduced, cut, fixed, improved or solved anything unless they said it did. "set up the nesting software" is an action. "set up nesting software that reduced waste" is an action and a result, and the result is yours, not theirs. Say what they did and stop. Where a figure was attached to it, the figure stays: take out the result, never the number. A comparison they set up is not an outcome either: "fixed the press when the vendor said two weeks" says what the vendor said and says nothing about how long it actually took, so "fixed it in days" is a duration nobody gave.
3. A qualifier moved. "generally reliable" and "mostly hit his deadlines" are two claims qualified two ways. They do not become "generally hit his deadlines". Each qualifier stays on the claim they put it on.
4. A sentence whose subject is the writer, including one with the subject dropped. "Ran the night shift with him" is their sentence with the "I" left off, and so is "Worked alongside him for years". Make it a statement about the candidate or leave it out.
5. A person, group or audience they did not name, or a second quality standing next to the one they gave.
6. The name. If they used one plausible name for him all the way through, your version uses that exact name: swapping their "Jim" or "Jamie" for "${candidateFirst}" rewrites what this person calls him, and it is the one substitution that looks like tidying and is not. If instead more than one name appeared, or what they used was not plausibly his name, your version says "${candidateFirst}". Either way it is one first name on its own, with no surname attached to it.
7. The figure. If they gave a number, it is in your version. Dropping it to avoid claiming a result is the wrong repair: keep the number and drop the result.

Return ONLY the polished testimonial. No preamble, no explanation.`
}

function validatePolished(text, candidateName, refereeName, raw) {
  const cleaned = noEmDash(
    String(text || '')
      .replace(/^["'\s]+|["'\s]+$/g, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{2,}/g, ' ')
      .trim()
  )
  if (cleaned.length < POLISHED_MIN) return { reason: `too short (${cleaned.length})` }
  if (cleaned.length > POLISHED_MAX) return { reason: `too long (${cleaned.length})` }
  if (cleaned.includes(EM_DASH)) return { reason: 'em dash survived' }
  // A testimonial written as the referee speaking in the first person reads as
  // the candidate talking about themselves once it is on the page.
  //
  // Anywhere, not only at the start of a sentence. The check used to look for
  // "I" after a full stop, which let "he is someone I would work with again"
  // through: the same first-person sentence with a clause bolted on the front.
  // A lone "I" in a third-person quotation is wrong wherever it sits, and a
  // refusal here is visible and retryable while a shipped one is permanent.
  if (/\bI\b/.test(cleaned)) return { reason: 'first person' }

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

  // A rewrite that came back as the thing it was given is not a rewrite. It is
  // the one failure that looks like a success on the page, because the referee
  // sees their own words in the place the polished version belongs and has no
  // way to tell the difference.
  if (cleaned.toLowerCase() === String(raw || '').trim().toLowerCase()) {
    return { reason: 'unchanged from the original' }
  }

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
            profileUrl: `${site}/career-profile`
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
        raw_text: raw,
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

Your previous version was rejected: ${refusals[refusals.length - 1]}. Write it again, fixing only that and keeping everything else.

It must still be third person throughout, written as ${row.recipient_name} describing ${candidateName}: never "I", never "my", and never ${row.recipient_name}'s own name inside the quotation.`

        const message = await anthropic.messages.create({
          model: MODEL,
          max_tokens: 500,
          temperature: TEMPERATURE,
          messages: [{ role: 'user', content }]
        })
        const checked = validatePolished(message?.content?.[0]?.text, candidateName, row.recipient_name, raw)
        if (checked.text) polished = checked.text
        else {
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
