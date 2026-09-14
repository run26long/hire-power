import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

// ============================================================================
// THE RECRUITER TOOLS' SHARED GROUND
//
// Ask My Career and Evaluate For A Role answer different questions from the
// same material, under the same conditions. Both live here so the two cannot
// drift: one gate, one loader, one way of naming a source, one limiter.
//
// THE RULE THESE TOOLS EXIST UNDER
// Everything either tool says about a candidate has to come from something the
// candidate actually wrote or was told. Not inferred, not rounded, not filled
// in from what usually goes with the rest. That is enforced twice: the prompt
// says it, and then the answer is checked against the material it claimed to
// come from before anybody sees it. A model that cites something it was not
// given loses the citation; an answer left with none loses the answer.
// ============================================================================

const ASK_LIMIT = 5
const EVALUATE_LIMIT = 3

export const LIMITS = { ask: ASK_LIMIT, evaluate: EVALUATE_LIMIT }

// Pro only. Vault is a separate tier rather than a larger one, so it is not
// swept in here by accident - if it should have these tools, that is a product
// decision and it belongs in this list explicitly.
const ENTITLED_TIERS = new Set(['pro'])

export const service = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// ---------------------------------------------------------------------------
// Who is asking
//
// Only ever a digest. The address is salted with the profile being read and a
// server secret, so the stored value cannot be matched back to a visitor
// without the secret, and the same visitor on two profiles produces two
// unrelated digests.
//
// The leftmost entry of x-forwarded-for is the client; everything after it is
// the proxies it came through. Where there is no header at all the digest is
// still well formed - it just groups every such caller together, which fails
// toward limiting more rather than less.
// ---------------------------------------------------------------------------
export function viewerHash(request, profileId) {
  const forwarded = request.headers.get('x-forwarded-for') || ''
  const ip = forwarded.split(',')[0].trim()
    || request.headers.get('x-real-ip')
    || 'unknown'

  // Falls back to the service key so a missing env var cannot silently turn
  // the salt into an empty string, which would make the digests guessable.
  const secret = process.env.RECRUITER_HASH_SECRET
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || 'hire-power'

  return crypto.createHash('sha256').update(`${ip}:${profileId}:${secret}`).digest('hex')
}

// ---------------------------------------------------------------------------
// The gate
//
// Published, and owned by somebody on Pro. Both are the candidate's state, not
// the recruiter's: these are public tools, and the thing being paid for is
// having them on your profile rather than using them.
//
// A profile that does not exist and one that is not published come back the
// same way. Which of the two it was is not a visitor's business, and saying
// would confirm that a slug is taken.
// ---------------------------------------------------------------------------
export async function openGate(supabase, slug) {
  if (!slug || typeof slug !== 'string') {
    return { ok: false, status: 404, code: 'NOT_FOUND' }
  }

  const { data: profile, error } = await supabase
    .from('career_profiles')
    .select('id, user_id, is_published')
    .eq('slug', slug)
    .maybeSingle()

  if (error) {
    console.error('[recruiter] Profile lookup failed:', error)
    return { ok: false, status: 500, code: 'LOOKUP_FAILED' }
  }
  if (!profile || profile.is_published !== true) {
    return { ok: false, status: 404, code: 'NOT_FOUND' }
  }

  const { data: owner, error: ownerError } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', profile.user_id)
    .maybeSingle()

  if (ownerError) {
    console.error('[recruiter] Tier lookup failed:', ownerError)
    return { ok: false, status: 500, code: 'LOOKUP_FAILED' }
  }
  if (!owner || !ENTITLED_TIERS.has(owner.subscription_tier)) {
    return { ok: false, status: 403, code: 'TIER_REQUIRED' }
  }

  return { ok: true, profile }
}

// ---------------------------------------------------------------------------
// The limit
//
// One database call that both decides and takes. The check and the increment
// are a single statement inside claim_recruiter_use, so two requests arriving
// together cannot both be granted the same last slot.
//
// A failure to reach the limiter refuses the call. A rate limiter that opens
// when it breaks is not a rate limiter.
// ---------------------------------------------------------------------------
export async function claimUse(supabase, { profileId, hash, feature }) {
  const { data, error } = await supabase.rpc('claim_recruiter_use', {
    p_profile_id: profileId,
    p_viewer_hash: hash,
    p_feature: feature,
    p_limit: LIMITS[feature]
  })

  if (error) {
    console.error('[recruiter] Rate limit check failed:', error)
    return { allowed: false, remaining: 0, broken: true }
  }

  const row = Array.isArray(data) ? data[0] : data
  return { allowed: row?.allowed === true, remaining: row?.remaining ?? 0, broken: false }
}

// ---------------------------------------------------------------------------
// The material
//
// Everything either tool is allowed to speak from, loaded once and labelled so
// that every statement can be traced to the thing it came from.
//
// The same publication filters the public profile applies: a draft testimonial
// and a private piece of evidence are no more available to a recruiter tool
// than they are to somebody reading the page.
// ---------------------------------------------------------------------------
export async function loadCandidate(supabase, profile) {
  const [knowledgeRes, resumeRes, lensRes, testimonialRes, evidenceRes, personRes] = await Promise.all([
    supabase
      .from('career_knowledge')
      .select('knowledge_type, content, raw_phrasing, confidence, source_job_title, source_job_company')
      .eq('user_id', profile.user_id)
      .is('superseded_by', null)
      .order('knowledge_type', { ascending: true })
      .order('created_at', { ascending: true }),
    // The flagged priority core when there is one, the newest core when there
    // is not - the same fallback the public route uses, for the same reason: a
    // strict is_priority_core filter returns nothing for an older account.
    supabase
      .from('resumes')
      .select('resume_data')
      .eq('user_id', profile.user_id)
      .eq('resume_type', 'core')
      .eq('is_active', true)
      .order('is_priority_core', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1),
    supabase
      .from('profile_lenses')
      .select('id, name, headline, bio, proof_points')
      .eq('profile_id', profile.id)
      .in('status', ['active', 'suggested'])
      .order('sort_order', { ascending: true }),
    supabase
      .from('profile_testimonials')
      .select('id, polished_text, recipient_name, recipient_title, relationship')
      .eq('profile_id', profile.id)
      .eq('status', 'published')
      .order('created_at', { ascending: true }),
    supabase
      .from('profile_evidence')
      .select('id, title, description, family, evidence_type, organization, date_label')
      .eq('profile_id', profile.id)
      .eq('privacy', 'public')
      .eq('status', 'published')
      .is('deleted_at', null)
      .order('sort_order', { ascending: true }),
    supabase
      .from('profiles')
      .select('display_name')
      .eq('id', profile.user_id)
      .maybeSingle()
  ])

  const resumeData = resumeRes.data?.[0]?.resume_data || null

  return {
    name: personRes.data?.display_name || 'the candidate',
    knowledge: knowledgeRes.error ? [] : (knowledgeRes.data || []),
    resumeData,
    experience: Array.isArray(resumeData?.experience) ? resumeData.experience : [],
    summary: typeof resumeData?.summary === 'string' ? resumeData.summary : '',
    lenses: lensRes.error ? [] : (lensRes.data || []),
    testimonials: testimonialRes.error ? [] : (testimonialRes.data || []),
    evidence: evidenceRes.error ? [] : (evidenceRes.data || [])
  }
}

// ---------------------------------------------------------------------------
// Naming the sources
//
// Every fact gets an id before the model sees it, and the model may only cite
// ids from this list. That is what makes a citation checkable: an id either
// appears here or it was invented, and there is no third possibility.
//
// Returns both the text to send and a map to validate the reply against.
// ---------------------------------------------------------------------------
export function buildSources(candidate) {
  const sources = new Map()
  const blocks = []

  const add = (id, kind, label, snippet) => {
    sources.set(id, { id, kind, label, snippet })
    return id
  }

  if (candidate.summary) {
    add('profile:summary', 'profile', 'Resume summary', candidate.summary)
    blocks.push(`[profile:summary] Resume summary\n${candidate.summary}`)
  }

  candidate.experience.forEach((role, i) => {
    const title = role?.title || role?.jobTitle || 'Role'
    const company = role?.company || role?.employer || 'Company'
    const dates = [role?.startDate, role?.endDate].filter(Boolean).join(' – ')
    const bullets = (Array.isArray(role?.bullets) ? role.bullets
      : Array.isArray(role?.achievements) ? role.achievements
      : Array.isArray(role?.responsibilities) ? role.responsibilities
      : []).filter(b => typeof b === 'string' && b.trim())

    const id = `experience:${i}`
    const label = `${title}, ${company}${dates ? ` (${dates})` : ''}`
    add(id, 'experience', label, bullets.join(' | '))
    blocks.push(`[${id}] ${label}\n${bullets.map(b => `- ${b}`).join('\n') || '- (no bullets recorded)'}`)
  })

  candidate.knowledge.forEach((row, i) => {
    const id = `knowledge:${i}`
    const where = [row.source_job_title, row.source_job_company].filter(Boolean).join(', ')
    const label = `Career knowledge (${row.knowledge_type})${where ? ` — ${where}` : ''}`
    add(id, 'knowledge', label, row.content)
    blocks.push(`[${id}] ${label}\n${row.content}`)
  })

  candidate.lenses.forEach((lens, i) => {
    const id = `direction:${i}`
    const label = `Career direction: ${lens.name}`
    const parts = [lens.headline, lens.bio].filter(Boolean)
    const points = Array.isArray(lens.proof_points)
      ? lens.proof_points.filter(Boolean).map(p => `${p?.num ?? ''} ${p?.label ?? ''}`.trim()).filter(Boolean)
      : []
    add(id, 'direction', label, parts.join(' ').slice(0, 400))
    blocks.push(`[${id}] ${label}\n${parts.join('\n')}${points.length ? `\nProof points: ${points.join('; ')}` : ''}`)
  })

  candidate.testimonials.forEach((quote, i) => {
    const id = `testimonial:${i}`
    const who = [quote.recipient_name, quote.recipient_title].filter(Boolean).join(', ')
    const label = who || 'Testimonial'
    add(id, 'testimonial', label, quote.polished_text)
    // The row id travels so a reply naming this quote can be matched back to a
    // real record rather than to a position in a list.
    sources.get(id).recordId = quote.id
    blocks.push(`[${id}] Testimonial from ${label}${quote.relationship ? ` (${quote.relationship})` : ''}\n"${quote.polished_text}"`)
  })

  candidate.evidence.forEach((item, i) => {
    const id = `evidence:${i}`
    const label = item.title || 'Evidence'
    const meta = [item.evidence_type, item.organization, item.date_label].filter(Boolean).join(' · ')
    add(id, 'evidence', label, item.description || '')
    sources.get(id).recordId = item.id
    blocks.push(`[${id}] ${label}${meta ? ` (${meta})` : ''}\n${item.description || '(no description)'}`)
  })

  return { sources, text: blocks.join('\n\n') }
}

// A citation list the model returned, reduced to the ones that name something
// it was actually given. Anything else was invented and is dropped.
export function keepRealCitations(claimed, sources) {
  if (!Array.isArray(claimed)) return []
  const seen = new Set()
  const kept = []
  for (const raw of claimed) {
    const id = typeof raw === 'string' ? raw.trim() : ''
    if (!id || seen.has(id) || !sources.has(id)) continue
    seen.add(id)
    const s = sources.get(id)
    kept.push({ id: s.id, kind: s.kind, label: s.label, snippet: (s.snippet || '').slice(0, 240) })
  }
  return kept
}

// The model is asked for JSON and nothing else, but a fenced block is the one
// thing it still occasionally wraps around it.
export function parseJson(text) {
  if (typeof text !== 'string') return null
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = (fenced ? fenced[1] : text).trim()
  try {
    return JSON.parse(body)
  } catch {
    const start = body.indexOf('{')
    const end = body.lastIndexOf('}')
    if (start < 0 || end <= start) return null
    try {
      return JSON.parse(body.slice(start, end + 1))
    } catch {
      return null
    }
  }
}

// ---------------------------------------------------------------------------
// Cost logging
//
// Non-blocking, exactly as the interview routes do it: a logging failure must
// never cost a recruiter their answer. status is CHECK-constrained upstream to
// success / failure / refusal / rate_limit.
// ---------------------------------------------------------------------------
export async function logCall(supabase, { userId, feature, status, usage, ms }) {
  try {
    await supabase.from('api_call_log').insert({
      user_id: userId,
      feature,
      provider: 'anthropic',
      model: MODEL,
      call_type: 'completion',
      input_tokens: usage?.input_tokens || 0,
      cached_input_tokens: usage?.cache_read_input_tokens || 0,
      output_tokens: usage?.output_tokens || 0,
      estimated_cost_usd: estimateCost(usage),
      status,
      duration_ms: ms ?? null
    })
  } catch (error) {
    console.error('[recruiter] Cost logging failed (non-fatal):', error)
  }
}

export const MODEL = 'claude-haiku-4-5-20251001'

// Haiku 4.5 list pricing, per million tokens.
const USD_PER_INPUT = 1 / 1_000_000
const USD_PER_OUTPUT = 5 / 1_000_000

function estimateCost(usage) {
  if (!usage) return 0
  const input = (usage.input_tokens || 0) * USD_PER_INPUT
  const output = (usage.output_tokens || 0) * USD_PER_OUTPUT
  return Number((input + output).toFixed(6))
}

// The untrusted half of every request. A question and a job description are
// both written by somebody who is neither the candidate nor us, so they are
// fenced and labelled as material to work on rather than as instructions.
//
// The closing tag is stripped from the text itself: without that, a caller can
// write the tag by hand and everything after it reads as though it came from us
// rather than from them. A real mitigation, not a complete one - the
// instructions around the fence say plainly that nothing inside it changes the
// rules, and the reply is checked against the sources afterwards, which is what
// actually contains the damage a clever paste could do.
export function fence(label, text) {
  const closing = new RegExp(`</?${label}>`, 'gi')
  const clean = String(text)
    .replace(closing, '')
    // Control characters. They serve no purpose in a typed question or a pasted
    // job description, and are a cheap way to confuse something downstream.
    .replace(/[ --]/g, '')
  return `<${label}>
${clean}
</${label}>`
}
