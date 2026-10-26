import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { canCreateResumes, MAX_LENSES } from '@/lib/tiers'
import { requireCustomise } from '../../career-profile/_lib/requireCustomise'
import {
  slugify,
  ensureCareerProfile,
  MIN_KNOWLEDGE_FOR_LENSES
} from '../../career-profile/_lib/detectLenses'
import { generateLensContent, WRITABLE_FIELDS } from '../../career-profile/_lib/generateLens'

// ============================================================================
// POST /api/profile-lenses/create-custom
//
// A career direction the owner names themselves, rather than one the model
// found for them. Everything downstream of the name is the pipeline that
// already exists: the same knowledge base, the same generator, the same skill
// proof. What is new is the asking, and the one question that has to be
// answered before anything is written - whether this person's career actually
// supports the direction they typed.
//
// Body: { name: string }
// Returns: { lens } on success, or a refusal with a code.
//
// WHY THE CHECK IS A SECOND CALL AND NOT A MATCH
// detectLensesFromKnowledge answers "what directions does this knowledge base
// support", which is the question the suggestions list is built from. It is
// not the question here. Matching a typed name against that list would turn
// every synonym into a refusal - "AI Engineering" against a list that says
// "Machine Learning" is the same career and a different string - and it would
// accept anything the list happened to contain however loosely the typed name
// related to it. So the model is asked the narrow question directly, against
// the same entries.
//
// This route no longer runs that detection at all. It used to, on a refusal,
// to name the account's strongest directions in the message - but both
// surfaces list those directions above the box already, so it was a second
// model call spent restating something on screen, from a source that could
// disagree with the one that drew it.
//
// WHAT A REFUSAL IS
// Not enough material is an ordinary outcome, not an error. It comes back 200
// with { ok: false }, because the interface shows it as information under the
// input rather than as a failure - the request succeeded, the answer was no.
// The gates above it are different: those are 401, 403 and 400, because being
// on the wrong plan or already holding three directions is a refusal to act.
//
// NOTHING HALF-MADE SURVIVES
// The row has to exist before it can be generated into, because the generator
// works on a lens id. If generation then fails, the row is deleted rather than
// left behind: a direction with a name and no content is worse than no
// direction, and this is the one place such a row could reach a public page.
// ============================================================================

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Long enough to be a career direction, short enough to be one. The upper
// bound is the slug's, so a name that cannot be addressed cannot be stored.
const NAME_MIN = 2
const NAME_MAX = 60

// Below this there is not enough pointing at the direction to write a profile
// around it. The brief asked for three to five; three is the floor because
// four entries that genuinely describe a direction is a real career and two is
// a mention.
const MIN_SUPPORTING_ENTRIES = 3

// Everything the generator can write, taken from the generator's own list so a
// field added there is picked up here rather than quietly skipped. A Set, not
// an array: generateLensContent asks it with .has(). This is also what makes
// the skill proof run - storeSkillProof is triggered by skill_emphasis being
// among the fields, which is why a new direction gets its proof rows without
// a second call.
const generatedFields = () => new Set(WRITABLE_FIELDS)

// Title case, but only where title case is right. Words somebody capitalised
// themselves are left alone, so "AI Engineering" and "SaaS Sales" survive a
// normalisation that would otherwise hand back "Ai Engineering".
function normaliseName(raw) {
  const cleaned = String(raw || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_MAX)
  if (!cleaned) return ''
  return cleaned
    .split(' ')
    .map(word => {
      if (!word) return word
      // Already carrying capitals past the first letter: an initialism or a
      // deliberate spelling, either way not ours to restyle.
      if (/[A-Z]/.test(word.slice(1))) return word
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(' ')
}

function buildSupportPrompt({ name, knowledge, existingNames }) {
  const entries = knowledge.map((k, i) => {
    const source = [k.source_job_title, k.source_job_company].filter(Boolean).join(' at ')
    return `${i + 1}. [${k.knowledge_type || 'entry'}] ${k.content}${source ? ` (from ${source})` : ''}`
  }).join('\n')

  const already = (existingNames || []).length
    ? existingNames.map(one => `- ${one}`).join('\n')
    : 'None yet.'

  return `A person wants to present themselves for this career direction: "${name}"

Below is their complete career knowledge base. Decide whether it genuinely supports that direction.

CAREER KNOWLEDGE BASE:
${entries}

CAREER DIRECTIONS THEY ALREADY HAVE:
${already}

RULES:
- Count only entries that are real evidence for this direction: work actually done in it, skills genuinely used for it, results that belong to it. A passing mention is not evidence. An adjacent skill is not evidence.
- A direction is a career path someone applies for jobs under, not a skill or a task. "Business Development" is a direction. "Proposal Writing" is a skill used within one. If the name they typed is a skill, a tool or a task rather than a direction, say so.
- Judge the career, not the words. If their EVIDENCE is in the same career under a different name, that counts: someone asking for "AI Engineering" whose evidence is machine learning work has the evidence.
- The opposite test, on the other side. If the direction they typed is THE SAME JOB as one they ALREADY HAVE, listed above, written differently, it is a duplicate and must be rejected. Set overlaps_with to the existing name, copied exactly as it is written above.
- Same job written differently means exactly these: a different word form of the same thing ("Technical Writer" and "Technical Writing" are duplicates), a synonym ("Software Engineering" and "Software Development"), an abbreviation or its expansion ("QA" and "Quality Assurance"), or a seniority or title variant of the same function ("Marketing Lead", "Marketing Manager" and "Marketing Specialist" are all the same direction).
- Two different specialties in the same field are NOT duplicates, however close they sound. "AI Engineering" and "AI Systems Design" are distinct directions. "Product Management" and "Product Marketing" are distinct directions. Sharing a field, a vocabulary, or most of a skill set does not make two jobs one job. Ask whether somebody would apply for both with the same resume and the same title in mind; if they would not, set overlaps_with to null.
- A narrower or broader version of something they already have is NOT a duplicate either, and this holds in both directions: typing the specialism when they hold the wider field, or the wider field when they hold the specialism, is two directions in both cases. "AI Systems Design" when they already have "AI Engineering" is not a duplicate, and neither is the reverse. Only identical wording of the same job counts, never containment.
- These two rules do not conflict. The first is about their evidence matching the request under another name, which is support. The second is about an existing direction being the request under another name, which is a repeat. A direction can be fully supported and still be a duplicate, and when it is, overlaps_with is the answer that matters.
- When in doubt, set overlaps_with to null. Refusing a direction that is genuinely new costs more than letting a near neighbour through.
- supporting_count is how many entries you actually counted, by their numbers.
- reason is one plain sentence for the person themselves, naming what is missing. No jargon, no apology.

Respond with ONLY valid JSON, no markdown, no explanation:
{"is_direction": true|false, "supporting_count": 0, "supporting_entries": [1,2], "reason": "...", "overlaps_with": null}`
}

async function assessSupport({ name, knowledge, existingNames }) {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    temperature: 0,
    messages: [{ role: 'user', content: buildSupportPrompt({ name, knowledge, existingNames }) }]
  })

  let json = message.content?.[0]?.text?.trim() || ''
  if (json.startsWith('```')) json = json.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const parsed = JSON.parse(json)

  // Only a name the model was actually shown. A duplicate message naming a
  // direction they do not have would be worse than no message: it would be
  // the page telling them about something that is not there.
  const claimed = typeof parsed?.overlaps_with === 'string' ? parsed.overlaps_with.trim() : ''
  const overlapsWith = (existingNames || []).find(
    one => one.toLowerCase() === claimed.toLowerCase()
  ) || null

  return {
    isDirection: parsed?.is_direction !== false,
    count: Number.isFinite(Number(parsed?.supporting_count)) ? Number(parsed.supporting_count) : 0,
    reason: typeof parsed?.reason === 'string' ? parsed.reason.trim() : '',
    overlapsWith
  }
}

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const token = authHeader.replace('Bearer ', '')

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // The row this creates belongs to the token holder, never to a user id the
    // caller supplies.
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = user.id

    const body = await request.json().catch(() => ({}))
    const name = normaliseName(body?.name)
    if (!name || name.length < NAME_MIN) {
      return Response.json({ error: 'Give your career direction a name.', code: 'NAME_REQUIRED' }, { status: 400 })
    }
    const slug = slugify(name)
    if (!slug) {
      return Response.json({ error: 'That name cannot be used. Try words rather than symbols.', code: 'NAME_INVALID' }, { status: 400 })
    }

    // ---- THE GATES ----
    // requireCustomise first, which is the lapsed-account question, then the
    // plan. Adding a direction that has never existed is building, and that is
    // Pro - the same line the visibility route draws when a suggested
    // direction is switched on for the first time.
    const gate = await requireCustomise(userId, supabase)
    if (gate) return gate

    const { data: account, error: tierError } = await supabase
      .from('profiles')
      .select('subscription_tier, display_name')
      .eq('id', userId)
      .maybeSingle()

    if (tierError) {
      console.error('[create-custom] Tier lookup failed:', tierError)
      return Response.json({ error: "We couldn't check your plan just now." }, { status: 500 })
    }
    if (!canCreateResumes(account?.subscription_tier)) {
      return Response.json(
        {
          error: 'Creating a career direction is part of Pro. The directions already on your profile stay yours.',
          code: 'PRO_REQUIRED'
        },
        { status: 403 }
      )
    }

    // ---- WHAT THEY ALREADY HAVE ----
    const { data: existing, error: existingError } = await supabase
      .from('profile_lenses')
      .select('id, slug, name, status')
      .eq('user_id', userId)

    if (existingError) {
      console.error('[create-custom] Lens lookup failed:', existingError)
      return Response.json({ error: "We couldn't check your directions just now." }, { status: 500 })
    }

    // ---- ALREADY HAVE IT, BY THE LETTER ----
    //
    // 200 with ok:false, not 409. A duplicate is an ordinary answer to an
    // ordinary question, and the same answer the model gives a moment later
    // for a name that matches a direction rather than a slug. Two transports
    // for one outcome meant the interface showed it two different ways
    // depending on which check caught it first.
    const clash = (existing || []).find(l => l.slug === slug)
    if (clash) {
      return Response.json({
        ok: false,
        code: 'DUPLICATE',
        overlapsWith: clash.name,
        overlapsLensId: clash.id
      })
    }

    // Counted on active, because that is what the limit is about: what the
    // profile shows at once. A new direction is created active, so it counts.
    const activeCount = (existing || []).filter(l => l.status === 'active').length
    if (activeCount >= MAX_LENSES) {
      return Response.json(
        {
          error: `Your Career Profile shows ${MAX_LENSES} career directions at a time. Turn one off to add this one.`,
          code: 'LENS_LIMIT'
        },
        { status: 400 }
      )
    }

    // ---- DOES THEIR CAREER SUPPORT IT ----
    const { data: knowledge, error: knowledgeError } = await supabase
      .from('career_knowledge')
      .select('knowledge_type, content, confidence, source_job_title, source_job_company')
      .eq('user_id', userId)
      .is('superseded_by', null)

    if (knowledgeError) {
      console.error('[create-custom] Knowledge lookup failed:', knowledgeError)
      return Response.json({ error: "We couldn't read your career data just now." }, { status: 500 })
    }

    const entries = knowledge || []
    if (entries.length < MIN_KNOWLEDGE_FOR_LENSES) {
      return Response.json({ ok: false, code: 'NOT_ENOUGH_DATA' })
    }

    let support
    try {
      support = await assessSupport({
        name,
        knowledge: entries,
        // Every direction they hold, whatever its status. A hidden or
        // dismissed one is still one they have: offering to build a second
        // copy of something sitting in their own list would be the worst kind
        // of duplicate, because the first one is invisible to them.
        existingNames: (existing || []).map(l => l.name).filter(Boolean)
      })
    } catch (e) {
      console.error('[create-custom] Support check failed:', e)
      return Response.json({ error: "We couldn't check that direction just now. Please try again." }, { status: 500 })
    }

    // ---- ALREADY HAVE IT, BY THE CAREER ----
    //
    // Before the support refusal, because it is the more useful answer when
    // both are true. A name that duplicates an existing direction is usually
    // well supported - it describes a career they are already presenting -
    // so the support test would pass it, and the one that caught it is the
    // one worth reporting.
    if (support.overlapsWith) {
      // assessSupport only ever returns a name it was shown, so this finds the
      // row it came from. Matched the same way it was matched there.
      const held = (existing || []).find(
        l => String(l.name || '').toLowerCase() === support.overlapsWith.toLowerCase()
      )
      return Response.json({
        ok: false,
        code: 'DUPLICATE',
        overlapsWith: support.overlapsWith,
        overlapsLensId: held?.id || null
      })
    }

    // ---- THE CODE IS THE WHOLE ANSWER ----
    //
    // No prose and no alternatives. This used to name the account's strongest
    // directions in a sentence, from a second model call made only to compose
    // it - but both surfaces already list those directions above the box, so
    // the sentence repeated a list the reader could see, from a source that
    // could disagree with the one that drew it. The words now come from
    // lib/lensRefusal, which both surfaces share, and they point at that list
    // rather than restating it.
    if (!support.isDirection || support.count < MIN_SUPPORTING_ENTRIES) {
      return Response.json({ ok: false, code: 'NOT_SUPPORTED' })
    }

    // ---- CREATE IT ----
    const profileId = await ensureCareerProfile(supabase, userId, account?.display_name)
    if (!profileId) {
      console.error('[create-custom] No career profile for user')
      return Response.json({ error: "We couldn't reach your Career Profile just now." }, { status: 500 })
    }

    // After everything they already have, whatever its status: the row lands at
    // the end of the list rather than in the middle of an order somebody has
    // arranged.
    const { data: lastRow } = await supabase
      .from('profile_lenses')
      .select('sort_order')
      .eq('user_id', userId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()
    const sortOrder = Number.isFinite(Number(lastRow?.sort_order)) ? Number(lastRow.sort_order) + 1 : 1

    const { data: lens, error: insertError } = await supabase
      .from('profile_lenses')
      .insert({
        profile_id: profileId,
        user_id: userId,
        name,
        slug,
        status: 'active',
        source: 'user_created',
        sort_order: sortOrder,
        evidence_summary: support.reason || null
      })
      .select('id, name, slug, status, source, sort_order')
      .single()

    if (insertError) {
      // 23505 is the slug already being taken between the check above and
      // here. The same shape as both checks above, so a duplicate looks
      // identical however it was caught - including by losing a race.
      if (insertError.code === '23505') {
        const { data: taken } = await supabase
          .from('profile_lenses')
          .select('id, name')
          .eq('user_id', userId)
          .eq('slug', slug)
          .maybeSingle()
        return Response.json({
          ok: false,
          code: 'DUPLICATE',
          overlapsWith: taken?.name || name,
          overlapsLensId: taken?.id || null
        })
      }
      console.error('[create-custom] Lens insert failed:', insertError)
      return Response.json({ error: "We couldn't create that direction. Please try again." }, { status: 500 })
    }

    // ---- WRITE IT ----
    let generated
    try {
      generated = await generateLensContent({
        supabase,
        userId,
        lensId: lens.id,
        fields: generatedFields()
      })
    } catch (e) {
      console.error('[create-custom] Generation threw:', e)
      generated = { ok: false, error: 'GENERATION_FAILED' }
    }

    if (!generated?.ok) {
      // Nothing half-made survives. The row only existed so the generator had
      // something to write into; with nothing written it is a name on a public
      // page with no profile behind it.
      const { error: cleanupError } = await supabase.from('profile_lenses').delete().eq('id', lens.id)
      if (cleanupError) console.error('[create-custom] Cleanup after failed generation failed:', cleanupError)
      return Response.json(
        { error: "We created the direction but couldn't write it. Nothing was saved - please try again." },
        { status: 500 }
      )
    }

    return Response.json({ ok: true, lens: generated.lens || lens })

  } catch (error) {
    console.error('[create-custom] Failed:', error)
    return Response.json({ error: "We couldn't create that direction. Please try again." }, { status: 500 })
  }
}
