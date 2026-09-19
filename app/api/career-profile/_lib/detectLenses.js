// ============================================================================
// LENS DETECTION
//
// Which professional directions a person's career could support, and the rows
// that hold them. Lifted out of /api/coach-finish so the same detection can be
// run outside a request - by scripts/detect-lenses-existing-users.js, for people
// who finished coaching before this existed.
//
// Nothing here is new. The prompt, the threshold, the dedupe rules and the
// non-fatal error handling are the ones coach-finish has always run; only their
// address changed.
//
// WHY THE IMPORTS ARE RELATIVE
//
// The rest of the app writes `@/lib/...`, which Next's bundler resolves. This
// module is also loaded by a plain Node script with no bundler, where `@/`
// resolves to nothing. It also deliberately imports neither `next/server` nor
// `@/lib/apiError`: those pull in Next internals that plain Node cannot load,
// and nothing here needs them, because none of this ever answers a request.
// Please do not "fix" either of those back - both would compile and both would
// break the backfill.
//
// EVERY FAILURE IS NON-FATAL
//
// This runs in the background at the end of coaching. A person who has just
// finished their resume must not see an error because a suggestion could not be
// written, so every path here logs and returns rather than throwing.
// ============================================================================

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

// A lens needs a profile to hang off, and core coaching is the first thing that
// ever needs one. The slug here is a placeholder the user renames later in the
// profile builder, so an existing row is never renamed and never reused for a
// different name.
export async function ensureCareerProfile(supabaseWrite, userId, displayName) {
  const { data: existing } = await supabaseWrite
    .from('career_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()
  if (existing) return existing.id

  const base = slugify(displayName) || `u-${String(userId).slice(0, 8)}`

  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`
    const { data: created, error } = await supabaseWrite
      .from('career_profiles')
      .insert({ user_id: userId, slug })
      .select('id')
      .single()

    if (created) return created.id

    // 23505 is a unique violation, and it means one of two things: the slug is
    // taken by someone else, or a concurrent run already made this user's
    // profile. Check for theirs before trying the next slug.
    if (error?.code !== '23505') {
      console.error('Career profile create failed (non-fatal):', error)
      return null
    }
    const { data: raced } = await supabaseWrite
      .from('career_profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()
    if (raced) return raced.id
  }

  console.error('Career profile create failed (non-fatal): could not find a free slug')
  return null
}

// Deduped by slug against every status, so a lens the user has already accepted
// or dismissed is never re-suggested. A row the user owns is never touched, and
// neither is one they have built: only a still-suggested row this evaluation
// wrote gets its evidence refreshed, and only its evidence.
export async function saveSuggestedLenses(supabaseWrite, { userId, profileId, coreResumeId, lenses }) {
  if (!profileId || !Array.isArray(lenses) || lenses.length === 0) return

  for (const lens of lenses) {
    const name = typeof lens?.name === 'string' ? lens.name.trim() : ''
    const slug = slugify(name)
    if (!name || !slug) continue
    const evidence = typeof lens?.evidence_summary === 'string' ? lens.evidence_summary.trim() : null

    try {
      const { data: existing } = await supabaseWrite
        .from('profile_lenses')
        .select('id, source, status')
        .eq('profile_id', profileId)
        .eq('slug', slug)
        .maybeSingle()

      if (existing) {
        if (existing.source === 'coaching_extraction' && existing.status === 'suggested' && evidence) {
          const { error: updateError } = await supabaseWrite
            .from('profile_lenses')
            .update({ evidence_summary: evidence, updated_at: new Date().toISOString() })
            .eq('id', existing.id)
          if (updateError) console.error('Lens evidence update failed (non-fatal):', updateError)
        }
        continue
      }

      const { error: insertError } = await supabaseWrite
        .from('profile_lenses')
        .insert({
          profile_id: profileId,
          user_id: userId,
          name,
          slug,
          evidence_summary: evidence,
          status: 'suggested',
          source: 'coaching_extraction',
          core_resume_id: coreResumeId || null
        })

      // A concurrent run can take the slug between the check above and this
      // insert. The row we wanted exists either way, so this is not a failure.
      if (insertError && insertError.code !== '23505') {
        console.error('Lens insert failed (non-fatal):', insertError)
      }
    } catch (e) {
      console.error('Lens write failed (non-fatal):', e)
    }
  }
}


// The direction the person is actually targeting is a lens like any other, and
// the public profile has nothing to show without it. Coaching a core is the
// moment it becomes knowable, so it is written here rather than waiting for the
// user to name it themselves.
//
// source 'user' and sort_order 0 mark it as the primary. That pair is also the
// idempotency key: a re-coach updates the row it finds rather than adding a
// second one, and a renamed direction renames the lens with it.
export async function ensurePrimaryLens({ userId, displayName, supabase, nameOverride }) {
  if (!userId) return

  try {
    const supabaseWrite = supabase || serviceClient()

    const profileId = await ensureCareerProfile(supabaseWrite, userId, displayName)
    if (!profileId) return

    const [contextRes, coreRes, existingRes] = await Promise.all([
      supabaseWrite
        .from('career_context')
        .select('current_lens_name, target_roles')
        .eq('user_id', userId)
        .maybeSingle(),
      // Ordering rather than a strict is_priority_core filter: the column
      // defaults false, so an account that predates it would match nothing.
      //
      // Every active core, not just the first. The first is still the one a
      // primary lens is pointed at, but knowing the whole set is what lets the
      // binding below tell "not pointed anywhere yet" from "pointed at a resume
      // that has since been archived", and heal the second as well as the first.
      supabaseWrite
        .from('resumes')
        .select('id')
        .eq('user_id', userId)
        .eq('resume_type', 'core')
        .eq('is_active', true)
        .order('is_priority_core', { ascending: false })
        .order('created_at', { ascending: false }),
      supabaseWrite
        .from('profile_lenses')
        .select('id, name, core_resume_id')
        .eq('profile_id', profileId)
        .eq('source', 'user')
        .eq('sort_order', 0)
        .maybeSingle()
    ])

    // The direction they said they were heading, then the first role they said
    // they were targeting, then the placeholder.
    //
    // current_lens_name is written by the same coaching run that creates this
    // lens, so during coaching it is nearly always there. It is empty for people
    // coached before that column existed, and for them "Core" would be an
    // internal default sitting on a page an employer reads. target_roles carries
    // the same intent and was captured at the same time, so it stands in.
    // nameOverride wins over all of it, and nothing in the app passes one: it is
    // for the backfill, which has the whole knowledge base in hand and can tell a
    // direction from a competency before naming anything. Coaching does not need
    // it, because the run that calls this has just written current_lens_name.
    const contextName = (contextRes.data?.current_lens_name || '').trim()
    const targetRoles = Array.isArray(contextRes.data?.target_roles) ? contextRes.data.target_roles : []
    const firstTarget = targetRoles.map(role => String(role || '').trim()).find(Boolean) || ''
    const override = typeof nameOverride === 'string' ? nameOverride.trim() : ''
    const name = override || contextName || firstTarget || 'Core'
    const slug = slugify(name) || 'core'
    const coreResumeId = (coreRes.data || [])[0]?.id || null
    const existing = existingRes.data

    if (existing) {
      const patch = {}
      if (existing.name !== name) { patch.name = name; patch.slug = slug }

      // Bound when it points at nothing, and re-bound when what it points at is
      // no longer one of this account's active cores - a core that was archived
      // or deleted leaves a pointer behind, and a lens pointing at a resume that
      // is gone names nothing and reads as a lens with no core.
      //
      // A pointer at a different but still active core is left alone. That is
      // somebody's own arrangement, not a fault to correct.
      const activeCoreIds = new Set((coreRes.data || []).map(row => row.id))
      const boundToLiveCore = existing.core_resume_id && activeCoreIds.has(existing.core_resume_id)
      if (!boundToLiveCore && coreResumeId) patch.core_resume_id = coreResumeId

      if (Object.keys(patch).length === 0) return

      patch.updated_at = new Date().toISOString()
      const { error: updateError } = await supabaseWrite
        .from('profile_lenses')
        .update(patch)
        .eq('id', existing.id)
        .eq('user_id', userId)

      // 23505 means the new slug is taken by one of their other lenses. The
      // primary keeps the name it had rather than colliding.
      if (updateError && updateError.code !== '23505') {
        console.error('Primary lens update failed (non-fatal):', updateError)
      }
      return
    }

    // UNIQUE(profile_id, slug): a suggestion may already hold this slug, so the
    // primary takes the next free one rather than failing to exist.
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = attempt === 0 ? slug : `${slug}-${attempt + 1}`
      const { error: insertError } = await supabaseWrite
        .from('profile_lenses')
        .insert({
          profile_id: profileId,
          user_id: userId,
          name,
          slug: candidate,
          status: 'active',
          source: 'user',
          sort_order: 0,
          core_resume_id: coreResumeId
        })

      if (!insertError) return
      if (insertError.code !== '23505') {
        console.error('Primary lens insert failed (non-fatal):', insertError)
        return
      }
    }
  } catch (e) {
    console.error('Primary lens write failed (non-fatal):', e)
  }
}

// Below this there is not enough of a career on file to tell a direction from a
// passing mention, and anything suggested would be noise.
export const MIN_KNOWLEDGE_FOR_LENSES = 5

function buildLensEvaluationPrompt({ knowledge, targetRoles, currentLensName, existingLensNames }) {
  const entries = knowledge.map(k => {
    const source = [k.source_job_title, k.source_job_company].filter(Boolean).join(' at ')
    const kind = [k.knowledge_type, k.confidence].filter(Boolean).join(', ')
    return `- [${kind}] ${k.content}${source ? ` (from ${source})` : ''}`
  }).join('\n')

  const targeting = [
    currentLensName ? `Current direction: ${currentLensName}` : null,
    targetRoles?.length ? `Target roles: ${targetRoles.join(', ')}` : null
  ].filter(Boolean).join('\n') || 'Not yet established.'

  const already = existingLensNames.length ? existingLensNames.join(', ') : 'None yet.'

  return `Given this person's complete career knowledge base, what distinct professional directions could each support a separate core resume?

CAREER KNOWLEDGE BASE:
${entries}

ALREADY TARGETING:
${targeting}

DIRECTIONS ALREADY ON THEIR LIST:
${already}

RULES:
- Each direction must have substantial evidence across multiple knowledge entries, not just a passing mention.
- Do not suggest the direction they are currently targeting, named above.
- Do not suggest any direction that already exists in their list above.
- Name each direction at the level of a career direction, not a specific craft or task. Prefer the broader professional frame when the evidence supports it: "Performance" rather than "Choreography" if the evidence shows performing that includes choreography, "Operations" rather than "Scheduling". Use a narrow name only when the evidence is genuinely confined to that specialty.
- One or two words per name.
- Each direction must represent a distinct job search. If someone would use the same resume for two directions, they are not separate directions. Merge them.
- A direction is a career path someone applies for jobs under, not a skill or competency. "Business Development" is a direction. "Proposal Management" is a skill used within Business Development. "Strategic Planning" is a capability, not a job search. Only suggest directions that would appear as a job title or department.
- Consolidate related directions. "Government Sales" and "Defense Contracting" serving the same markets should be one direction, not two. "Technical Sales" and "Business Development" using the same skills should be one.
- Aim for 3 to 5 high-confidence directions. More than 5 almost always means some should be merged. Fewer is better than more, and an empty array is the right answer when nothing clears the bar.
- evidence_summary is one sentence naming what in the knowledge base supports the direction.

Respond with ONLY valid JSON, no markdown, no explanation:
{"suggested_lenses":[{"name":"...","evidence_summary":"..."}]}`
}

// The reading and the asking, with nothing written.
//
// Split out of evaluateLensesFromKnowledge so a caller can see what would be
// suggested without creating anything - which is what a dry run needs, and what
// the version of this that lived inside the route could not offer, because
// detecting and writing were one function.
//
// Returns { ok, reason, lenses }. `ok: false` is an ordinary outcome here, not
// an error: too little knowledge on file is the commonest answer.
export async function detectLensesFromKnowledge({ userId, supabase }) {
  if (!userId) return { ok: false, reason: 'no user', lenses: [] }

  const client = supabase || serviceClient()

  const [knowledgeRes, contextRes, lensRes] = await Promise.all([
    client
      .from('career_knowledge')
      .select('knowledge_type, content, confidence, source_job_title, source_job_company')
      .eq('user_id', userId)
      .is('superseded_by', null),
    client
      .from('career_context')
      .select('target_roles, current_lens_name')
      .eq('user_id', userId)
      .maybeSingle(),
    client
      .from('profile_lenses')
      .select('name, slug, status')
      .eq('user_id', userId)
  ])

  if (knowledgeRes.error) {
    console.error('[lens-eval] Knowledge lookup failed (non-fatal):', knowledgeRes.error)
    return { ok: false, reason: `knowledge lookup failed: ${knowledgeRes.error.message}`, lenses: [] }
  }

  const knowledge = knowledgeRes.data || []
  if (knowledge.length < MIN_KNOWLEDGE_FOR_LENSES) {
    return {
      ok: false,
      reason: `only ${knowledge.length} knowledge entries, needs ${MIN_KNOWLEDGE_FOR_LENSES}`,
      lenses: [],
      knowledgeCount: knowledge.length
    }
  }

  // Every status counts as taken. A direction the user dismissed or already built
  // is not a suggestion, and naming them keeps the model from proposing one back.
  // The slug check inside saveSuggestedLenses is what actually enforces it.
  const existingLensNames = (lensRes.data || []).map(l => l.name).filter(Boolean)

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1000,
    temperature: 0,
    messages: [{
      role: 'user',
      content: buildLensEvaluationPrompt({
        knowledge,
        targetRoles: contextRes.data?.target_roles || [],
        currentLensName: contextRes.data?.current_lens_name || null,
        existingLensNames
      })
    }]
  })

  let json = message.content[0].text.trim()
  if (json.startsWith('```')) {
    json = json.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  }
  const parsed = JSON.parse(json)
  const lenses = Array.isArray(parsed?.suggested_lenses) ? parsed.suggested_lenses : []

  return { ok: true, reason: null, lenses, knowledgeCount: knowledge.length, existingLensNames }
}

export async function evaluateLensesFromKnowledge({ userId, supabase, displayName }) {
  if (!userId) return

  try {
    const client = supabase || serviceClient()

    const { ok, lenses } = await detectLensesFromKnowledge({ userId, supabase: client })
    if (!ok || lenses.length === 0) return

    const profileId = await ensureCareerProfile(client, userId, displayName)
    await saveSuggestedLenses(client, {
      userId,
      profileId,
      // A suggestion is not tied to a resume. build-core sets core_resume_id when
      // the user turns one into an actual core.
      coreResumeId: null,
      lenses
    })
  } catch (e) {
    console.error('[lens-eval] Lens evaluation failed (non-fatal):', e)
  }
}
