import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { apiError } from '@/lib/apiError'
import { normalizeSkillCategories } from '@/lib/resumeText'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Structured extraction from material that already exists, not open writing, so
// Haiku carries it. A little temperature because the bio is prose.
const MODEL = 'claude-haiku-4-5-20251001'
const TEMPERATURE = 0.4
const PROOF_POINT_COUNT = 3

// Few enough that emphasising them still means something. A direction that
// leads with a dozen skills is not leading with anything.
const SKILL_EMPHASIS_MIN = 3
const SKILL_EMPHASIS_MAX = 5

// ============================================================================
// POST /api/career-profile/generate
// Generates the Career Profile content for ONE lens: headline, bio, three proof
// points, a forward-looking line, and target tags. Everything is written from
// the user's knowledge base and resume, never invented.
//
// Pro, or a free account with only its one entitled direction.
// Request body: { lensId: string }
// ============================================================================

// The resume reaches the prompt as text rather than JSON so the model reads it
// the way a person would, and so the shape of resume_data never leaks into the
// writing.
function convertResumeToText(data) {
  if (!data) return ''
  let text = ''

  if (data.summary && !data.hideSummary) {
    text += `SUMMARY\n${data.summary}\n\n`
  }

  if (data.experience?.length) {
    text += 'EXPERIENCE\n\n'
    data.experience.forEach(job => {
      text += `${job.title || 'Position'} | ${job.company || 'Company'}\n`
      const start = job.startDate || ''
      const end = job.current ? 'Present' : (job.endDate || '')
      if (start || end) text += `${start} - ${end}\n`
      if (job.summary) text += `${job.summary}\n`
      if (job.bullets?.length) job.bullets.forEach(b => { text += `- ${b}\n` })
      text += '\n'
    })
  }

  if (data.education?.length) {
    text += 'EDUCATION\n\n'
    data.education.forEach(edu => {
      text += `${edu.school || 'Institution'}\n`
      const line = [edu.degree, edu.field].filter(Boolean).join(', ')
      if (line) text += `${line}${edu.graduationDate ? ` | ${edu.graduationDate}` : ''}\n`
      if (edu.lines?.length) edu.lines.forEach(l => { text += `${l}\n` })
      text += '\n'
    })
  }

  const skillGroups = normalizeSkillCategories(data)
  if (skillGroups.length > 0) {
    text += 'SKILLS\n\n'
    skillGroups.forEach(({ name, skills }) => {
      text += `${name}: ${skills.join(', ')}\n`
    })
    text += '\n'
  }

  return text.trim()
}

// The prompt forbids them, but a generated em dash would reach the profile page
// verbatim, so the rule is enforced here as well as asked for.
function stripEmDashes(value) {
  return typeof value === 'string' ? value.replace(/—/g, ', ').replace(/\s*,\s*,/g, ',') : value
}

function buildProfilePrompt({
  lensName,
  evidenceSummary,
  knowledge,
  careerContext,
  coreResumeText,
  lensResumeText,
  otherLenses
}) {
  const knowledgeBlock = knowledge.length
    ? knowledge.map(k => {
        const source = [k.source_job_title, k.source_job_company].filter(Boolean).join(' at ')
        const kind = [k.knowledge_type, k.confidence].filter(Boolean).join(', ')
        const words = k.raw_phrasing ? `\n  their words: "${k.raw_phrasing}"` : ''
        return `- [${kind}] ${k.content}${source ? ` (from ${source})` : ''}${words}`
      }).join('\n')
    : '(nothing on file)'

  const contextBlock = [
    careerContext?.current_lens_name ? `Current direction: ${careerContext.current_lens_name}` : null,
    careerContext?.target_roles?.length ? `Target roles: ${careerContext.target_roles.join(', ')}` : null,
    careerContext?.experience_level ? `Experience level: ${careerContext.experience_level}` : null,
    careerContext?.career_goal ? `Career goal: ${careerContext.career_goal}` : null
  ].filter(Boolean).join('\n') || '(not established)'

  const otherBlock = otherLenses.length
    ? otherLenses.map(l => {
        const parts = [`- ${l.name}`]
        if (l.headline) parts.push(`  headline: ${l.headline}`)
        if (l.bio) parts.push(`  bio: ${l.bio}`)
        return parts.join('\n')
      }).join('\n')
    : '(this is their only direction so far)'

  const resumeBlock = [
    lensResumeText ? `RESUME WRITTEN FOR THIS DIRECTION:\n${lensResumeText}` : null,
    coreResumeText ? `MAIN CORE RESUME:\n${coreResumeText}` : null
  ].filter(Boolean).join('\n\n') || '(no resume on file)'

  return `You are writing one section of a career profile. The section covers a single professional direction: ${lensName}.

This person has one career and several directions they could take it. You are writing the ${lensName} view of that career. Everything you write must come from the material below. You are selecting and framing what is already there, never adding to it.

THE DIRECTION: ${lensName}
${evidenceSummary ? `Why this direction was identified: ${evidenceSummary}` : ''}

CAREER CONTEXT:
${contextBlock}

CAREER KNOWLEDGE BASE:
${knowledgeBlock}

${resumeBlock}

THEIR OTHER DIRECTIONS, ALREADY WRITTEN:
${otherBlock}

Return this exact structure:
{
  "headline": "A professional headline for this direction, 8 to 15 words, as a pronoun-free professional fragment",
  "bio": "A polished professional summary, pronoun-free. Maximum 4 sentences. Concise, specific, no filler. Lead with the discipline and the span of experience, follow with the strongest proof, close with the differentiator. No em dashes.",
  "proof_points": [
    {"num": "$10M+", "label": "Boeing engagement value"},
    {"num": "35%", "label": "defect rate reduction"},
    {"num": "90%+", "label": "account renewal rate"}
  ],
  "ready_for_next": "1 to 2 sentences on what comes next in this direction, pronoun-free, opening on a construction like \"Ready to\"",
  "ready_tags": ["VP Operations", "Manufacturing", "Process improvement"],
  "skill_emphasis": ["Lean Manufacturing", "WIP Reporting", "P&L Management"]
}

RULES:
- VOICE, and this one governs everything else. Every field you return here is written WITHOUT PRONOUNS, in the register of a strong professional summary. Two things are therefore banned, not one. No first person: no "I", "me", "my" or "mine". And no outside narration: no "he", no "she", no singular "they", never their name as a narrator, and never "this executive", "this professional" or "the candidate". Write "Manufacturing operations leader with 30 years of experience turning underperforming production floors into accountable organizations. Achieved 100% on-time delivery within 50 days of joining Disruptor Manufacturing." That is the voice: complete sentences that simply do not need a subject pronoun, never truncated telegram style and never a sentence with the pronoun deleted out of it. The profile has exactly one section written in deliberate first person, In My Own Words, and you are not writing it. Nothing another person said is ever restated in this voice.
- proof_points: exactly ${PROOF_POINT_COUNT}. Each must be a real, verifiable number from the knowledge base or the resume. Never invent a statistic. "num" is short: a number, a percentage, or a dollar figure. "label" says what it measures in under 8 words.
- If the material does not support a numeric proof point for this direction, use qualitative proof instead, in the same shape: {"num": "10+ years", "label": "leading manufacturing teams"}. A true qualitative point always beats an invented metric.
- bio: at most 4 sentences, pronoun-free, in professional summary voice. Concise and specific, no filler. Lead with the discipline and the span of experience, follow with the strongest proof, close with the differentiator. No bullet points, no lists. It tells this career through the ${lensName} lens.
- bio: must not overlap significantly with the bios of their other directions above. Same person, different emphasis. Choose different evidence and a different through line.
- headline: must differ from the headlines of their other directions above.
- ready_for_next: forward looking, about what comes next, not a summary of what has already been done. Pronoun-free like the rest: "Ready to take full operational ownership of a multi-department site", never "I am ready to" and never "they are ready to".
- ready_tags: 3 to 5 short tags naming target roles, industries, or capabilities for this direction.
- skill_emphasis: ${SKILL_EMPHASIS_MIN} to ${SKILL_EMPHASIS_MAX} skills this direction leads with, chosen from the SKILLS section of the resume above. Copy each one exactly as it is written there, character for character, including punctuation and capitalisation. Do not reword one, do not shorten one, and do not name a skill that is not in that section. Choose the ones a person hiring for ${lensName} would look for first, not simply the most impressive ones.
- Everything must be traceable to the knowledge base or the resume. If you cannot support a claim from that material, leave it out.
- Do not use em dashes anywhere. Use commas, periods, or semicolons instead.

Respond with ONLY valid JSON, no markdown, no explanation.`
}

function parseGenerated(rawText) {
  let json = String(rawText || '').trim()
  if (json.startsWith('```')) {
    json = json.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  }
  return JSON.parse(json)
}

// A shape the profile page can render without guarding every field. A partial
// generation is worse than a failed one: it would half fill the profile and
// look finished.
function validateGenerated(parsed, allowedSkills) {
  const headline = typeof parsed?.headline === 'string' ? parsed.headline.trim() : ''
  const bio = typeof parsed?.bio === 'string' ? parsed.bio.trim() : ''
  const readyForNext = typeof parsed?.ready_for_next === 'string' ? parsed.ready_for_next.trim() : ''
  if (!headline || !bio || !readyForNext) return null

  const points = Array.isArray(parsed?.proof_points) ? parsed.proof_points : []
  if (points.length !== PROOF_POINT_COUNT) return null
  const proofPoints = []
  for (const point of points) {
    const num = typeof point?.num === 'string' ? point.num.trim() : ''
    const label = typeof point?.label === 'string' ? point.label.trim() : ''
    if (!num || !label) return null
    proofPoints.push({ num: stripEmDashes(num), label: stripEmDashes(label) })
  }

  const tags = Array.isArray(parsed?.ready_tags) ? parsed.ready_tags : []
  const readyTags = tags
    .filter(t => typeof t === 'string' && t.trim())
    .map(t => stripEmDashes(t.trim()))
  if (readyTags.length === 0) return null

  // Emphasis only ever points at a skill the resume already lists, so what is
  // stored is the resume's own string rather than the model's echo of it. That
  // is what lets the profile match a tile without guessing. Matching is
  // case-insensitive but otherwise exact: "P&L" is not "P&L Management", and
  // emphasising the wrong tile is worse than emphasising none.
  //
  // Unlike the fields above, this does not fail the generation. A direction
  // with no emphasis renders every skill evenly, which is where the profile
  // started; a direction with no headline would render as a gap.
  const emphasis = Array.isArray(parsed?.skill_emphasis) ? parsed.skill_emphasis : []
  const skillEmphasis = []
  for (const raw of emphasis) {
    const name = typeof raw === 'string' ? raw.trim() : ''
    if (!name) continue
    const stored = allowedSkills.get(name.toLowerCase())
    if (stored && !skillEmphasis.includes(stored)) skillEmphasis.push(stored)
    if (skillEmphasis.length === SKILL_EMPHASIS_MAX) break
  }

  return {
    headline: stripEmDashes(headline),
    bio: stripEmDashes(bio),
    proof_points: proofPoints,
    ready_for_next: stripEmDashes(readyForNext),
    ready_tags: readyTags,
    skill_emphasis: skillEmphasis
  }
}

// Every skill the profile could render for this direction, keyed for matching
// and valued with the exact string the resume stores. The direction's own
// resume is preferred over the core for the same reason the profile prefers it:
// it is the one whose skills will actually be on screen.
function skillLookup(lensResumeData, coreResumeData) {
  const source = normalizeSkillCategories(lensResumeData).length > 0 ? lensResumeData : coreResumeData
  const lookup = new Map()
  for (const group of normalizeSkillCategories(source)) {
    for (const skill of group.skills) {
      const text = typeof skill === 'string' ? skill.trim() : ''
      if (text) lookup.set(text.toLowerCase(), text)
    }
  }
  return lookup
}

// PostgREST reports an unknown key in the payload as PGRST204; Postgres uses
// 42703. Worth naming, because these five columns are newer than the rest of
// the table and a missing one otherwise fails as an opaque write error.
function isMissingColumnError(error) {
  if (!error) return false
  return error.code === 'PGRST204' || error.code === '42703'
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

    // The profile this writes to comes from the token, never from the body. The
    // service role sees every row, so this is the only thing standing between a
    // lens id and whoever guessed it.
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = user.id

    const { lensId } = await request.json()
    if (!lensId) return Response.json({ error: 'lensId is required' }, { status: 400 })

    // ---- TIER ----
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .maybeSingle()

    if (profileError) {
      console.error('[career-profile] Profile lookup failed:', profileError)
      return Response.json({ error: 'GENERATION_FAILED' }, { status: 500 })
    }
    // A free account is entitled to one direction, so it can generate a profile
    // for that one. The moment there is more than one, choosing between them is
    // the Pro feature, and generating for any of them is gated.
    if (profile?.subscription_tier !== 'pro') {
      const { count, error: lensCountError } = await supabase
        .from('profile_lenses')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('status', ['active', 'suggested'])

      if (lensCountError) {
        console.error('[career-profile] Lens count failed:', lensCountError)
        return Response.json({ error: 'GENERATION_FAILED' }, { status: 500 })
      }
      if ((count || 0) > 1) {
        return Response.json({ error: 'PRO_REQUIRED' }, { status: 403 })
      }
    }

    // ---- THE LENS ----
    const { data: lens, error: lensError } = await supabase
      .from('profile_lenses')
      .select('id, profile_id, name, slug, evidence_summary, status, core_resume_id')
      .eq('id', lensId)
      .eq('user_id', userId)
      .maybeSingle()

    if (lensError) {
      console.error('[career-profile] Lens lookup failed:', lensError)
      return Response.json({ error: 'GENERATION_FAILED' }, { status: 500 })
    }
    if (!lens) return Response.json({ error: 'LENS_NOT_FOUND' }, { status: 404 })

    // ---- EVERYTHING THE PROMPT READS ----
    // Independent of each other, so they go together rather than in sequence.
    const [careerProfileRes, contextRes, knowledgeRes, coreRes, lensResumeRes] = await Promise.all([
      supabase
        .from('career_profiles')
        .select('id, slug')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('career_context')
        .select('target_roles, current_lens_name, experience_level, career_goal')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('career_knowledge')
        .select('knowledge_type, content, confidence, raw_phrasing, source_job_title, source_job_company')
        .eq('user_id', userId)
        .is('superseded_by', null)
        .order('knowledge_type', { ascending: true })
        .order('created_at', { ascending: true }),
      // The flagged priority core when there is one, the newest core when there
      // is not. A strict is_priority_core filter would return nothing for an
      // account that predates the column and lose the resume grounding entirely.
      supabase
        .from('resumes')
        .select('ai_analysis, resume_data')
        .eq('user_id', userId)
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
            .eq('user_id', userId)
            .eq('is_active', true)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null })
    ])

    if (knowledgeRes.error) {
      console.error('[career-profile] Knowledge base lookup failed:', knowledgeRes.error)
      return Response.json({ error: 'GENERATION_FAILED' }, { status: 500 })
    }

    // lens.profile_id is the authority. The career_profiles row is the fallback
    // for a lens written before the column was populated.
    const profileId = lens.profile_id || careerProfileRes.data?.id || null

    // Their other directions, so this one can be written to sit beside them
    // rather than repeat them. Scoped by profile when there is one, by user
    // otherwise, and never leaving this account either way.
    const siblingQuery = supabase
      .from('profile_lenses')
      .select('name, headline, bio')
      .eq('user_id', userId)
      .neq('id', lensId)

    const { data: others, error: othersError } = profileId
      ? await siblingQuery.eq('profile_id', profileId)
      : await siblingQuery

    if (othersError) {
      // Losing this costs de-duplication against the other directions, not the
      // generation itself.
      console.error('[career-profile] Sibling lens lookup failed (non-fatal):', othersError)
    }
    const otherLenses = others || []

    const coreResume = (coreRes.data || [])[0] || null

    // The names emphasis is allowed to point at, taken from the same resume the
    // prompt is written from and the profile will render.
    const allowedSkills = skillLookup(lensResumeRes.data?.resume_data, coreResume?.resume_data)

    const prompt = buildProfilePrompt({
      lensName: lens.name,
      evidenceSummary: lens.evidence_summary,
      knowledge: knowledgeRes.data || [],
      careerContext: contextRes.data || null,
      coreResumeText: convertResumeToText(coreResume?.resume_data),
      lensResumeText: convertResumeToText(lensResumeRes.data?.resume_data),
      otherLenses
    })

    // ---- GENERATE ----
    let generated = null
    let lastFailure = null

    for (let attempt = 0; attempt < 2; attempt++) {
      // The retry says the one thing that went wrong, appended rather than
      // rebuilt, so the second call is the same request with a stricter close.
      const content = attempt === 0
        ? prompt
        : `${prompt}\n\nYour previous response could not be parsed. Respond only in valid JSON matching the structure above. No markdown, no code fences, no commentary.`

      let message
      try {
        message = await anthropic.messages.create({
          model: MODEL,
          max_tokens: 2000,
          temperature: TEMPERATURE,
          messages: [{ role: 'user', content }]
        })
      } catch (e) {
        console.error('[career-profile] Model call failed:', e)
        return Response.json({ error: 'GENERATION_FAILED' }, { status: 500 })
      }

      try {
        const validated = validateGenerated(parseGenerated(message.content[0].text), allowedSkills)
        if (validated) {
          generated = validated
          break
        }
        lastFailure = 'Generated content did not match the expected shape'
      } catch (e) {
        lastFailure = e
      }
    }

    if (!generated) {
      console.error('[career-profile] Generation unusable after retry:', lastFailure)
      return Response.json({ error: 'GENERATION_FAILED' }, { status: 500 })
    }

    // ---- STORE ----
    const { data: updated, error: updateError } = await supabase
      .from('profile_lenses')
      .update({
        headline: generated.headline,
        bio: generated.bio,
        proof_points: generated.proof_points,
        ready_for_next: generated.ready_for_next,
        ready_tags: generated.ready_tags,
        skill_emphasis: generated.skill_emphasis,
        updated_at: new Date().toISOString()
      })
      .eq('id', lens.id)
      .eq('user_id', userId)
      .select('*')
      .single()

    if (updateError || !updated) {
      if (isMissingColumnError(updateError)) {
        console.error('[career-profile] profile_lenses is missing a profile column:', updateError)
      } else {
        console.error('[career-profile] Lens update failed:', updateError)
      }
      return Response.json({ error: 'GENERATION_FAILED' }, { status: 500 })
    }

    return Response.json({ lens: updated })

  } catch (error) {
    return apiError(error, "We couldn't build this career profile. Please try again.")
  }
}
