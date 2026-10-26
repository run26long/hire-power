import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { canCreateResumes, MAX_LENSES } from '@/lib/tiers'
import { requireCustomise } from '../../career-profile/_lib/requireCustomise'
import {
  slugify,
  ensureCareerProfile,
  detectLensesFromKnowledge,
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
// the same entries, and the detected list is used for the one thing it is
// genuinely good for: telling somebody what their data does support when the
// answer is no.
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

function buildSupportPrompt({ name, knowledge }) {
  const entries = knowledge.map((k, i) => {
    const source = [k.source_job_title, k.source_job_company].filter(Boolean).join(' at ')
    return `${i + 1}. [${k.knowledge_type || 'entry'}] ${k.content}${source ? ` (from ${source})` : ''}`
  }).join('\n')

  return `A person wants to present themselves for this career direction: "${name}"

Below is their complete career knowledge base. Decide whether it genuinely supports that direction.

CAREER KNOWLEDGE BASE:
${entries}

RULES:
- Count only entries that are real evidence for this direction: work actually done in it, skills genuinely used for it, results that belong to it. A passing mention is not evidence. An adjacent skill is not evidence.
- A direction is a career path someone applies for jobs under, not a skill or a task. "Business Development" is a direction. "Proposal Writing" is a skill used within one. If the name they typed is a skill, a tool or a task rather than a direction, say so.
- Judge the career, not the words. If their evidence is in the same career under a different name, that counts: someone asking for "AI Engineering" whose evidence is machine learning work has the evidence.
- supporting_count is how many entries you actually counted, by their numbers.
- reason is one plain sentence for the person themselves, naming what is missing. No jargon, no apology.

Respond with ONLY valid JSON, no markdown, no explanation:
{"is_direction": true|false, "supporting_count": 0, "supporting_entries": [1,2], "reason": "..."}`
}

async function assessSupport({ name, knowledge }) {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    temperature: 0,
    messages: [{ role: 'user', content: buildSupportPrompt({ name, knowledge }) }]
  })

  let json = message.content?.[0]?.text?.trim() || ''
  if (json.startsWith('```')) json = json.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const parsed = JSON.parse(json)

  return {
    isDirection: parsed?.is_direction !== false,
    count: Number.isFinite(Number(parsed?.supporting_count)) ? Number(parsed.supporting_count) : 0,
    reason: typeof parsed?.reason === 'string' ? parsed.reason.trim() : ''
  }
}

// What the knowledge base is strongest in, for a refusal to point at. Best
// effort: if detection fails the refusal still stands, it just cannot offer
// anywhere else to go.
async function strongestDirections({ userId, supabase }) {
  try {
    const { ok, lenses } = await detectLensesFromKnowledge({ userId, supabase })
    if (!ok || !Array.isArray(lenses)) return []
    return lenses.map(l => l?.name).filter(Boolean).slice(0, 3)
  } catch (e) {
    console.error('[create-custom] Strongest-direction lookup failed (non-fatal):', e)
    return []
  }
}

function refusalMessage({ name, alternatives, reason }) {
  const head = `We don't have enough career data to support ${name}.`
  if (alternatives.length) {
    const list = alternatives.length === 1
      ? alternatives[0]
      : `${alternatives.slice(0, -1).join(', ')} and ${alternatives[alternatives.length - 1]}`
    return `${head} Your knowledge base is strongest in ${list}.`
  }
  return reason ? `${head} ${reason}` : head
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

    const clash = (existing || []).find(l => l.slug === slug)
    if (clash) {
      return Response.json(
        {
          error: `You already have a direction called ${clash.name}.`,
          code: 'DUPLICATE'
        },
        { status: 409 }
      )
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
      return Response.json({
        ok: false,
        code: 'NOT_ENOUGH_DATA',
        message: `We don't have enough career data to support ${name} yet. Keep using Hire Power - every conversation, résumé and practice session adds to what it knows about you.`
      })
    }

    let support
    try {
      support = await assessSupport({ name, knowledge: entries })
    } catch (e) {
      console.error('[create-custom] Support check failed:', e)
      return Response.json({ error: "We couldn't check that direction just now. Please try again." }, { status: 500 })
    }

    if (!support.isDirection || support.count < MIN_SUPPORTING_ENTRIES) {
      const alternatives = await strongestDirections({ userId, supabase })
      return Response.json({
        ok: false,
        code: 'NOT_SUPPORTED',
        message: refusalMessage({ name, alternatives, reason: support.reason }),
        alternatives
      })
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
      // 23505 is the slug already being taken between the check above and here.
      if (insertError.code === '23505') {
        return Response.json({ error: `You already have a direction called ${name}.`, code: 'DUPLICATE' }, { status: 409 })
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
