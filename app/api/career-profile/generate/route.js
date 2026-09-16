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
// SKILL PROOF
//
// After a direction knows which skills it leads with, this works out what backs
// each of them up, from the material already on the public profile: the public
// evidence, the published testimonials, and the bullets of the resume the
// profile renders for this direction.
//
// What gets stored is references, never copies. A snippet copied into the table
// outlives the thing it came from: the user edits a case study and the profile
// keeps the old wording, or makes one private and the copy keeps publishing it.
// Ids are resolved at render against the payload, which is already filtered to
// public rows, so anything withdrawn simply stops appearing.
//
// Bullets have no id, only a position, and positions move when a resume is
// recoached. A bullet reference therefore carries its path and its exact text,
// and the page shows it only while the two still agree.
//
// This runs after the profile has been written and never fails it. A direction
// with no proof renders exactly as it did before proof existed.
// ============================================================================

const PROOF_PER_SKILL_MAX = 3

// The bullets of one resume, each with the path that locates it and the text
// that proves the path still points at the same sentence.
function bulletPool(resumeData) {
  const experience = Array.isArray(resumeData?.experience) ? resumeData.experience : []
  const out = []
  experience.forEach((role, roleIndex) => {
    const bullets = Array.isArray(role?.bullets) ? role.bullets : []
    bullets.forEach((bullet, bulletIndex) => {
      const text = typeof bullet === 'string' ? bullet.trim() : ''
      if (!text) return
      out.push({
        path: `experience[${roleIndex}].bullets[${bulletIndex}]`,
        text,
        company: typeof role?.company === 'string' ? role.company : ''
      })
    })
  })
  return out
}

function buildProofPrompt({ lensName, skills, evidence, testimonials, bullets }) {
  const evidenceBlock = evidence.length
    ? evidence.map(e => `[evidence:${e.id}] ${e.title}${e.description ? ` · ${e.description}` : ''}`).join('\n')
    : '(none)'

  const testimonialBlock = testimonials.length
    ? testimonials.map(t => `[testimonial:${t.id}] ${t.polished_text}`).join('\n')
    : '(none)'

  const bulletBlock = bullets.length
    ? bullets.map(b => `[bullet:${b.path}] ${b.text}`).join('\n')
    : '(none)'

  return `You are connecting a person's skills to the proof of those skills that is already published on their career profile.

THE DIRECTION: ${lensName}

THE SKILLS, each of which needs its proof found:
${skills.map(s => `- ${s}`).join('\n')}

THE ONLY MATERIAL YOU MAY POINT AT. Every reference you return must be one of these, by its exact tag:

PUBLISHED EVIDENCE:
${evidenceBlock}

PUBLISHED TESTIMONIALS:
${testimonialBlock}

RESUME BULLETS:
${bulletBlock}

Return this exact structure:
{
  "proofs": [
    {
      "skill": "the skill, copied exactly from the list above",
      "refs": ["evidence:<id>", "testimonial:<id>", "bullet:experience[0].bullets[1]"]
    }
  ]
}

RULES:
- A reference is proof only if the material actually demonstrates the skill being used or its result. A passing mention of the same words is not proof. A case study about building a sole source procurement document proves sole source procurement; a bullet that merely contains the word "procurement" does not.
- Judge by what the material describes, not by whether it repeats the skill's wording. "Sole Source Procurement Framework" proves "Sole Source Procurement Strategy". A bullet about rebuilding a production floor can prove "Lean Manufacturing" without using the phrase.
- At most ${PROOF_PER_SKILL_MAX} references per skill, strongest first. Fewer is correct and normal.
- A skill with nothing that genuinely demonstrates it is left out of the array entirely. Returning weak proof is worse than returning none: the reader clicks expecting evidence and finds a coincidence.
- Copy every tag exactly as written above, including the id or the path. Never invent one, never adjust one, and never point at material that is not listed.
- Do not explain the connection. Return references only.

Respond with ONLY valid JSON, no markdown, no explanation.`
}

// Every returned reference is checked against the material actually supplied,
// so a tag the model invented or altered can never reach the table. A bullet is
// checked twice over: the path must exist, and the text at it must still be the
// text that was offered.
function validateProof(parsed, { skills, evidence, testimonials, bullets }) {
  const allowedSkills = new Map(skills.map(s => [s.toLowerCase(), s]))
  const evidenceIds = new Set(evidence.map(e => e.id))
  const testimonialIds = new Set(testimonials.map(t => t.id))
  const bulletsByPath = new Map(bullets.map(b => [b.path, b.text]))

  const rows = []
  const entries = Array.isArray(parsed?.proofs) ? parsed.proofs : []

  for (const entry of entries) {
    const rawSkill = typeof entry?.skill === 'string' ? entry.skill.trim() : ''
    const label = allowedSkills.get(rawSkill.toLowerCase())
    if (!label) continue

    const refs = Array.isArray(entry?.refs) ? entry.refs : []
    const proofs = []

    for (const raw of refs) {
      if (typeof raw !== 'string') continue
      const divider = raw.indexOf(':')
      if (divider === -1) continue
      const source = raw.slice(0, divider).trim()
      const rest = raw.slice(divider + 1).trim()
      if (!rest) continue

      if (source === 'evidence' && evidenceIds.has(rest)) {
        proofs.push({ source: 'evidence', id: rest })
      } else if (source === 'testimonial' && testimonialIds.has(rest)) {
        proofs.push({ source: 'testimonial', id: rest })
      } else if (source === 'bullet' && bulletsByPath.has(rest)) {
        proofs.push({ source: 'bullet', path: rest, text: bulletsByPath.get(rest) })
      }

      if (proofs.length === PROOF_PER_SKILL_MAX) break
    }

    if (proofs.length > 0) rows.push({ skill_label: label, proofs })
  }

  return rows
}

// Finds the proof for one direction's emphasised skills and stores it.
//
// Scoped to the direction, not just the skill. The same skill can be led with
// under two directions and be best demonstrated by different material in each,
// so the conflict target carries the lens: regenerating one direction touches
// only its own rows and can never overwrite another direction's choice.
async function storeSkillProof({ supabase, profileId, lensId, userId, lensName, skills, resumeData, evidence, testimonials }) {
  if (!profileId || !lensId || !Array.isArray(skills) || skills.length === 0) return

  const bullets = bulletPool(resumeData)
  if (evidence.length === 0 && testimonials.length === 0 && bullets.length === 0) return

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1500,
    temperature: 0,
    messages: [{
      role: 'user',
      content: buildProofPrompt({ lensName, skills, evidence, testimonials, bullets })
    }]
  })

  const rows = validateProof(
    parseGenerated(message.content?.[0]?.text),
    { skills, evidence, testimonials, bullets }
  )
  // A skill this direction no longer leads with, or no longer has proof for,
  // must not keep the row it had last time. Clearing this direction's rows
  // first is what makes a regeneration a replacement rather than a merge, and
  // it is scoped to the lens so no other direction is touched.
  const { error: clearError } = await supabase
    .from('profile_skill_proofs')
    .delete()
    .eq('profile_id', profileId)
    .eq('lens_id', lensId)
  if (clearError) throw clearError

  if (rows.length === 0) return

  const now = new Date().toISOString()
  // A plain insert, not an upsert. The delete above already made this a
  // replacement, and the uniqueness constraint is a partial index. Postgres
  // cannot infer a partial index for ON CONFLICT without its predicate, which
  // PostgREST has no way to send. Clearing the direction first is both simpler
  // and the behaviour that is actually wanted: a skill this direction has
  // stopped grounding does not linger.
  const { error } = await supabase
    .from('profile_skill_proofs')
    .insert(
      rows.map(row => ({
        profile_id: profileId,
        lens_id: lensId,
        user_id: userId,
        skill_label: row.skill_label,
        proofs: row.proofs,
        generated_at: now,
        updated_at: now
      }))
    )

  if (error) throw error
}

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

    // What the profile actually publishes, which is the only material proof is
    // allowed to point at. Filtered here exactly as the public profile API
    // filters it, so proof can never reference something a visitor cannot see.
    const [evidenceRes, testimonialRes] = await Promise.all([
      profileId
        ? supabase
            .from('profile_evidence')
            .select('id, title, description')
            .eq('profile_id', profileId)
            .eq('privacy', 'public')
        : Promise.resolve({ data: [], error: null }),
      profileId
        ? supabase
            .from('profile_testimonials')
            .select('id, polished_text')
            .eq('profile_id', profileId)
            .eq('status', 'published')
        : Promise.resolve({ data: [], error: null })
    ])

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

    // ---- SKILL PROOF ----
    // Everything above is the profile. This is the layer underneath it, and it
    // is deliberately allowed to fail on its own: a direction with no proof
    // renders exactly as it did before proof existed, where a direction with no
    // headline would render as a gap.
    try {
      await storeSkillProof({
        supabase,
        profileId,
        lensId: lens.id,
        userId,
        lensName: lens.name,
        skills: generated.skill_emphasis,
        resumeData: lensResumeRes.data?.resume_data || coreResume?.resume_data,
        evidence: evidenceRes.error ? [] : (evidenceRes.data || []),
        testimonials: testimonialRes.error ? [] : (testimonialRes.data || [])
      })
    } catch (proofError) {
      console.error('[career-profile] Skill proof failed (non-fatal):', proofError)
    }

    return Response.json({ lens: updated })

  } catch (error) {
    return apiError(error, "We couldn't build this career profile. Please try again.")
  }
}
