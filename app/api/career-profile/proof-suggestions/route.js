import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

import { apiError } from '@/lib/apiError'
import { convertResumeToText } from '../_lib/generateLens'
import { MODEL, noEmDash } from '../_lib/recruiterContext'
import { requireCustomise } from '../_lib/requireCustomise'

// ============================================================================
// POST /api/career-profile/proof-suggestions
//
// Proof points this direction could be using, drawn from the owner's own
// career knowledge and their resume. Read only: nothing here writes, and
// nothing it returns is stored until the owner presses Save in the Manage
// panel, which goes to the lens PATCH route like every other hand edit.
//
// Body: { lensId, exclude?: [{ num, label }] }
// Returns: { suggestions: [{ num, label }] }
//
// WHOSE DIRECTION THIS READS
// The token's. The lens id is matched together with the caller's user id, so a
// guessed id belonging to somebody else reads as not found. The service role
// sees every row and that pairing is the only thing standing between a uuid
// and another person's career.
//
// THE SAME GATE AS THE PENCIL
// requireCustomise. The panel this feeds is the pencil's neighbour and writes
// the same column through the same route, so it cannot be a way around the
// plan the pencil is behind.
//
// ---------------------------------------------------------------------------
// EVERY NUMBER HAS TO ALREADY EXIST
//
// This is the whole of the risk in the feature. A proof point is a claim a
// recruiter reads as fact, and a model asked for impressive figures will round
// one up, carry a percentage from one role to another, or invent a plausible
// dollar amount - and the owner, reading a suggestion that looks like their own
// work, is the least likely person to catch it.
//
// So the prompt asks, and then the answer is checked. Every numeral in a
// suggestion, in the figure and in the label both, must appear in the material
// the model was given. Not approximately: 34.7 does not license 35, and 350
// does not license 35, because the check is on whole values rather than on
// substrings. A suggestion with one unsupported numeral in it is dropped
// entirely rather than repaired, since a figure that was adjusted is exactly
// the kind of thing the owner would not notice.
//
// WHAT THE CHECK CANNOT DO, said plainly because it matters: it verifies
// numbers, not sentences. A label can still frame a real figure as something
// it was not, and no mechanical rule catches that. What limits it is that the
// model is given only this person's own material, the suggestion is shown to
// them with the figure in it before anything is written, and Save is theirs.
// ---------------------------------------------------------------------------

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// The same model the lens generator uses, for the same job on a smaller scale:
// structured extraction out of material that already exists.
const TEMPERATURE = 0.4

// Enough to choose from without the panel becoming a list to read. Six is two
// screens of the suggestions block and twice what a direction can hold.
const SUGGESTION_COUNT = 6

// The ceilings the lens route enforces on the column, restated so a suggestion
// cannot arrive in the panel already too long to save. Kept as literals rather
// than imported: the route that owns them is a route, and importing a route
// handler to borrow two numbers would pull the whole thing in.
const NUM_MAX = 24
const LABEL_MAX = 120

// Stops a single enormous resume from becoming the prompt. Far above anything
// real: the longest core resumes in the data render to a few thousand
// characters.
const SOURCE_MAX = 24000

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// A run of digits, with thousands separators and a decimal part if it has
// them. Currency marks, percent signs and the "+" on "90%+" are deliberately
// not part of the match: what is being compared is the quantity, and "$10M"
// in a suggestion is supported by "10 million" in the source.
const NUMERAL = /\d[\d,]*(?:\.\d+)?/g

// One value, written one way. Commas go because a source may write 1,200 where
// a label writes 1200, and a trailing run of zeros after the point goes because
// 35.0 and 35 are the same claim. Nothing else is touched, so 34.7 and 35 stay
// different numbers, which is the point.
const normaliseNumeral = (raw) =>
  raw.replace(/,/g, '').replace(/\.0+$/, '').replace(/\.$/, '')

function numeralsIn(text) {
  const out = new Set()
  for (const match of String(text || '').matchAll(NUMERAL)) {
    out.add(normaliseNumeral(match[0]))
  }
  return out
}

// One line, trimmed, with the em dashes taken out the way every other field
// the owner can see has them taken out. The lens route cleans again on save;
// this is so the panel never shows something it would then refuse.
function oneLine(value, max) {
  if (typeof value !== 'string') return null
  const text = noEmDash(value.replace(/\s+/g, ' ').trim())
  if (!text || text.length > max) return null
  return text
}

const keyOf = (point) =>
  `${String(point?.num || '').trim().toLowerCase()}|${String(point?.label || '').trim().toLowerCase()}`

function buildPrompt({ lensName, evidenceSummary, targetRoles, source, excluded }) {
  const excludedBlock = excluded.length
    ? excluded.map(one => `- ${one.num} ${one.label}`).join('\n')
    : '(none yet)'

  return `You are choosing proof points for one direction of a person's career profile. The direction is: ${lensName}.

A proof point is one measured result, set as a short figure and a short label. On the profile it is read by a recruiter in about a second, so it carries a number and the thing the number measures, and nothing else.

${evidenceSummary ? `WHY THIS DIRECTION WAS IDENTIFIED: ${evidenceSummary}\n` : ''}${targetRoles ? `TARGET ROLES: ${targetRoles}\n` : ''}
THEIR MATERIAL, which is the only thing you may draw on:
${source}

ALREADY USED OR ALREADY OFFERED, do not return any of these or a restatement of one:
${excludedBlock}

Return up to ${SUGGESTION_COUNT} proof points, best first, as JSON and nothing else:

{"suggestions": [{"num": "35%", "label": "defect rate reduction"}, {"num": "$10M+", "label": "Boeing engagement value"}]}

RULES
1. EVERY NUMBER MUST APPEAR IN THEIR MATERIAL ABOVE, EXACTLY. Copy it, never recalculate it, never round it, never round it up, never combine two figures into a third. If the material says 34.7%, the figure is 34.7%, not 35%. A suggestion containing a number that is not in the material above will be discarded, so returning one costs you a slot and gains nothing.
2. Relevant to ${lensName}. A real result from an unrelated part of the career is worth less here than a smaller one that belongs to this direction.
3. "num" is short: a number, a percentage, a dollar figure, a count. At most ${NUM_MAX} characters.
4. "label" says what the figure measures, in under 8 words and at most ${LABEL_MAX} characters. Lower case unless it is a proper noun.
5. Pronoun-free. No "I", no "my", no "he", no "she", no "they", no "the candidate". The label is a noun phrase: "on-time delivery within 50 days", never "I delivered on time".
6. Where the material genuinely supports no further numeric result, a true qualitative point in the same shape is better than an invented metric: {"num": "10+ years", "label": "leading manufacturing teams"}. The number in it still has to be in the material.
7. No em dashes anywhere. Use a comma or a second clause.
8. If their material supports fewer than ${SUGGESTION_COUNT}, return fewer. An empty list is a correct answer.

Respond with ONLY valid JSON, no markdown, no explanation.`
}

function parseJson(text) {
  let json = String(text || '').trim()
  if (json.startsWith('```')) {
    json = json.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  }
  try {
    return JSON.parse(json)
  } catch {
    const start = json.indexOf('{')
    const end = json.lastIndexOf('}')
    if (start < 0 || end <= start) return null
    try {
      return JSON.parse(json.slice(start, end + 1))
    } catch {
      return null
    }
  }
}

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data: { user }, error: authError } =
      await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const gate = await requireCustomise(user.id, supabase)
    if (gate) return gate

    let body
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'Invalid request.' }, { status: 400 })
    }

    const lensId = body?.lensId
    if (!lensId || typeof lensId !== 'string' || !UUID.test(lensId)) {
      return Response.json({ error: 'Not found.' }, { status: 404 })
    }

    // ---- THE DIRECTION, AND THAT IT IS THEIRS ----
    const { data: lens, error: lensError } = await supabase
      .from('profile_lenses')
      .select('id, name, evidence_summary, core_resume_id, proof_points')
      .eq('id', lensId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (lensError) {
      console.error('[career-profile] Proof suggestion lens lookup failed:', lensError)
      return Response.json({ error: "We couldn't read that Career Direction." }, { status: 500 })
    }
    if (!lens) return Response.json({ error: 'Not found.' }, { status: 404 })

    // ---- THE MATERIAL ----
    // The same three sources the lens generator reads for the same reason: the
    // knowledge base is where the results live, the resume is where the
    // numbers behind them are written down, and the context says what this
    // person is aiming at.
    const [contextRes, knowledgeRes, coreRes, lensResumeRes] = await Promise.all([
      supabase
        .from('career_context')
        .select('target_roles')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('career_knowledge')
        .select('knowledge_type, content, raw_phrasing, source_job_title, source_job_company')
        .eq('user_id', user.id)
        .is('superseded_by', null)
        .order('created_at', { ascending: true }),
      supabase
        .from('resumes')
        .select('resume_data')
        .eq('user_id', user.id)
        .eq('resume_type', 'core')
        .eq('is_active', true)
        .order('is_priority_core', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1),
      lens.core_resume_id
        ? supabase
            .from('resumes')
            .select('resume_data')
            .eq('id', lens.core_resume_id)
            .eq('user_id', user.id)
            .eq('is_active', true)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null })
    ])

    if (knowledgeRes.error) {
      console.error('[career-profile] Knowledge lookup failed:', knowledgeRes.error)
      return Response.json({ error: "We couldn't read your career data." }, { status: 500 })
    }

    const knowledgeBlock = (knowledgeRes.data || []).map(row => {
      const where = [row.source_job_title, row.source_job_company].filter(Boolean).join(' at ')
      const words = row.raw_phrasing ? `\n  their words: "${row.raw_phrasing}"` : ''
      return `- [${row.knowledge_type || 'note'}] ${row.content}${where ? ` (from ${where})` : ''}${words}`
    }).join('\n')

    const lensResumeText = convertResumeToText(lensResumeRes.data?.resume_data)
    const coreResumeText = convertResumeToText((coreRes.data || [])[0]?.resume_data)

    // One block, used for two jobs that must not disagree: it is what the model
    // is shown, and it is what every figure that comes back is checked against.
    const source = [
      knowledgeBlock ? `CAREER KNOWLEDGE BASE:\n${knowledgeBlock}` : null,
      lensResumeText ? `RESUME WRITTEN FOR THIS DIRECTION:\n${lensResumeText}` : null,
      coreResumeText ? `MAIN CORE RESUME:\n${coreResumeText}` : null
    ].filter(Boolean).join('\n\n').slice(0, SOURCE_MAX)

    // Nothing recorded means nothing to suggest from, and that is worth saying
    // rather than spending a model call to be told the same thing.
    if (!source) return Response.json({ suggestions: [] })

    // What not to offer: whatever this direction already carries, plus whatever
    // the panel says it has already been shown. The stored column is read here
    // rather than trusted from the body, so a stale panel cannot talk this into
    // repeating a point that is on the profile right now.
    const excluded = []
    const excludedKeys = new Set()
    const addExcluded = (point) => {
      const num = typeof point?.num === 'string' ? point.num.trim() : ''
      const label = typeof point?.label === 'string' ? point.label.trim() : ''
      if (!num && !label) return
      const key = keyOf({ num, label })
      if (excludedKeys.has(key)) return
      excludedKeys.add(key)
      excluded.push({ num, label })
    }
    for (const point of Array.isArray(lens.proof_points) ? lens.proof_points : []) addExcluded(point)
    for (const point of Array.isArray(body?.exclude) ? body.exclude.slice(0, 60) : []) addExcluded(point)

    // ---- ASK ----
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1200,
      temperature: TEMPERATURE,
      messages: [{
        role: 'user',
        content: buildPrompt({
          lensName: lens.name || 'this direction',
          evidenceSummary: lens.evidence_summary || null,
          targetRoles: (contextRes.data?.target_roles || []).join(', ') || null,
          source,
          excluded
        })
      }]
    })

    // A reply cut off at the ceiling is half a JSON document, not a short list.
    if (message.stop_reason === 'max_tokens') {
      console.error('[career-profile] Proof suggestions truncated at the token ceiling')
      return Response.json({ suggestions: [] })
    }

    const parsed = parseJson(message.content?.[0]?.text)
    const raw = Array.isArray(parsed?.suggestions) ? parsed.suggestions : []

    // ---- CHECK EVERY FIGURE ----
    const allowed = numeralsIn(source)
    const suggestions = []
    const seen = new Set(excludedKeys)
    let unsupported = 0

    for (const item of raw) {
      const num = oneLine(item?.num, NUM_MAX)
      const label = oneLine(item?.label, LABEL_MAX)
      if (!num || !label) continue

      const key = keyOf({ num, label })
      if (seen.has(key)) continue

      // The rule this route exists for. Every numeral in the figure and in the
      // label, checked as a whole value against the material above.
      const used = numeralsIn(`${num} ${label}`)
      let grounded = true
      for (const value of used) {
        if (!allowed.has(value)) { grounded = false; break }
      }
      if (!grounded) { unsupported++; continue }

      seen.add(key)
      suggestions.push({ num, label })
      if (suggestions.length >= SUGGESTION_COUNT) break
    }

    // Worth a line in the logs rather than a field in the response: a run that
    // drops most of what it was given is a prompt that has started drifting,
    // and the owner has no use for the number.
    if (unsupported > 0) {
      console.warn(
        `[career-profile] Dropped ${unsupported} proof suggestion(s) carrying a figure not in the source material.`
      )
    }

    return Response.json({ suggestions })
  } catch (error) {
    return apiError(error, "We couldn't suggest anything just now. Please try again.")
  }
}
