import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { noEmDash } from '@/app/api/career-profile/_lib/recruiterContext'
import { sendTransactional, TRANSACTIONAL } from '@/lib/loops/sendTransactional'

// ============================================================================
// GET  /api/testimonial/[token]   - what the referee is being asked
// POST /api/testimonial/[token]   - their words, polished, and two emails
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
// POLISHING FAILS SOFT
// If the model call fails, the submission still stands at `submitted` with the
// referee's own words saved. Losing somebody's writing because a third party
// was down would be the worse failure by a distance.
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

// Everything the referee page is allowed to know.
function publicShape(row, candidateName) {
  return {
    candidate_name: candidateName,
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
    .select('display_name')
    .eq('id', row.user_id)
    .maybeSingle()

  return { row, candidateName: account?.display_name || 'a Hire Power member' }
}

export async function GET(request, { params }) {
  try {
    const { token } = await params
    if (!token || !TOKEN_SHAPE.test(token)) return notFound()

    const supabase = service()
    const found = await load(supabase, token)
    if (!found) return notFound()

    return Response.json(publicShape(found.row, found.candidateName))
  } catch (error) {
    // No token in the message. A credential in a log is a credential.
    console.error('[testimonial] Read failed:', error?.message)
    return Response.json({ error: 'LOOKUP_FAILED' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// Two or three sentences, in the third person, from what they actually wrote.
// ---------------------------------------------------------------------------
function buildPolishPrompt({ raw, candidateName, refereeName }) {
  return `${refereeName} has written a testimonial about ${candidateName}. Tidy it into two or three sentences for a professional profile.

WHAT YOU ARE DOING
Editing, not writing. Everything in your version must be something they said. Keep their judgement, their emphasis and their specifics; fix the grammar, cut the throat-clearing, and make it read as a finished quotation.

WHO THE SENTENCES ARE ABOUT
${candidateName}, always. This becomes a quotation printed on ${candidateName}'s profile with "${refereeName}" already shown underneath it as the person who said it, so naming ${refereeName} in the text itself makes it read as a third party describing the wrong person. Never write "${refereeName}" and never write "they" meaning ${refereeName}. "Worked with him for three years" becomes a statement about ${candidateName}, not about ${refereeName}.

RULES
- Two or three sentences. No more.
- Third person, about ${candidateName}. Never "I", never "${refereeName}", never address the reader.
- Never invent a fact, a number, a role, a company or a period of time. If they were vague, stay vague.
- Do not add praise they did not give. If they were measured, stay measured.
- No em dashes. Use a comma or a full stop.
- Do not open with "${candidateName} is".
- No quotation marks around the result.

WHAT THEY WROTE
${raw}

Return ONLY the polished testimonial. No preamble, no explanation.`
}

function validatePolished(text, candidateName, refereeName) {
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
  if (/(^|\.\s+)I\b/.test(cleaned)) return { reason: 'first person' }

  // And one that names the referee reads as a third party describing the wrong
  // person, because the page already prints "Marcus Feld" underneath it. The
  // first version of this prompt produced exactly that - "Marcus Feld worked
  // with James... Feld would work with him again" - which is a correct
  // sentence about the wrong subject.
  //
  // Checked on every name part of two characters or more, so a surname on its
  // own is caught as well as the full name.
  const parts = String(refereeName || '')
    .split(/\s+/)
    .map(p => p.replace(/[^\p{L}\p{N}'-]/gu, ''))
    .filter(p => p.length > 1)
  for (const part of parts) {
    const named = new RegExp(`\\b${part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    if (named.test(cleaned)) return { reason: `names the referee: "${part}"` }
  }

  void candidateName
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

    const { row, candidateName } = found
    rowId = row.id

    let body
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'Invalid request.' }, { status: 400 })
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

    // ---- SAVED BEFORE POLISHING ----
    // Their words are the thing that matters and the thing that cannot be
    // reproduced. They go in first, and the count goes up with them, so a
    // model call that hangs cannot be used to get a fourth attempt.
    const { error: saveError } = await supabase
      .from('profile_testimonials')
      .update({
        raw_text: raw,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
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
    let polished = null
    try {
      const message = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 500,
        temperature: TEMPERATURE,
        messages: [{
          role: 'user',
          content: buildPolishPrompt({ raw, candidateName, refereeName: row.recipient_name })
        }]
      })
      const checked = validatePolished(message?.content?.[0]?.text, candidateName, row.recipient_name)
      if (checked.text) polished = checked.text
      else console.error('[testimonial] Polish refused for row', row.id, checked.reason)
    } catch (error) {
      console.error('[testimonial] Polish errored for row', row.id, error?.message)
    }

    if (polished) {
      const { error: polishError } = await supabase
        .from('profile_testimonials')
        .update({ polished_text: polished, status: 'polished', updated_at: new Date().toISOString() })
        .eq('id', row.id)
      if (polishError) {
        console.error('[testimonial] Polish save failed for row', row.id, polishError.message)
        polished = null
      }
    }

    // ---- THE TWO EMAILS ----
    // Both are told, neither is allowed to fail the request. The testimonial
    // is already saved; an email that did not send is a nuisance, and undoing
    // somebody's writing over it would be a catastrophe.
    const site = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '')

    if (polished) {
      void sendTransactional({
        transactionalId: TRANSACTIONAL.TESTIMONIAL_CONFIRMATION,
        email: row.recipient_email,
        dataVariables: {
          candidateName,
          refereeName: row.recipient_name,
          polishedText: polished,
          testimonialUrl: `${site}/testimonial/${token}`
        }
      })
    }

    const { data: candidate } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', row.user_id)
      .maybeSingle()
    const { data: authUser } = await supabase.auth.admin.getUserById(row.user_id)
    if (authUser?.user?.email) {
      void sendTransactional({
        transactionalId: TRANSACTIONAL.TESTIMONIAL_NOTIFICATION,
        email: authUser.user.email,
        dataVariables: {
          candidateName: candidate?.display_name || candidateName,
          refereeName: row.recipient_name,
          profileUrl: `${site}/career-profile`
        }
      })
    }

    const { data: fresh } = await supabase
      .from('profile_testimonials')
      .select('id, recipient_name, status, raw_text, polished_text, reference_consent, ' +
              'reference_phone, daily_submissions, daily_submissions_on')
      .eq('id', row.id)
      .maybeSingle()

    return Response.json(publicShape(fresh || row, candidateName))
  } catch (error) {
    console.error('[testimonial] Submit failed for row', rowId, error?.message)
    return Response.json({ error: "We couldn't save that. Please try again." }, { status: 500 })
  }
}
