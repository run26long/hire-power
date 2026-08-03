import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Static prefix. Never varies, so it stays cacheable across every call.
const EXTRACTION_INSTRUCTIONS = `Extract every discrete career fact, skill, experience, achievement, client relationship, tool proficiency, certification, or methodology mentioned by the candidate in this coaching conversation.

You will be given the candidate's EXISTING KNOWLEDGE BASE, the resume data already on file, and the coaching conversation transcript.

For every fact the candidate mentions, first check whether it already appears in the EXISTING KNOWLEDGE BASE. Judge by meaning, not by wording. The same experience described in different words is a match, not a new item.

If it is a match, return it under "matches" with the id of the existing item, the candidate's new phrasing, and the confidence level of this mention.

For "improved_content": if the existing content statement could be worded more clearly, return the improved version. Otherwise return null.

An improvement may ONLY change wording. It may not add information, remove information, broaden the fact, or narrow the fact. The improved version must state exactly the same fact as the original, no more and no less. If the new mention contains information the existing item does not, that is NOT an improvement. It is a conflict.

If a fact overlaps an existing item but states something materially different, contradictory scope, different numbers, different dates, or additional detail that changes the fact, return it under "conflicts" with the id of the existing item and a short conflict_reason.

If a fact does not appear in the knowledge base at all, return it under "new".

Continue to exclude anything already present in the resume data provided. Only extract information the candidate surfaced during the conversation.

Do not extract the coach's own statements, suggestions, or rewrites. Only extract facts the candidate provided about their own background.

FIELD DEFINITIONS
- knowledge_type: one of skill, experience, achievement, relationship, credential, tool, industry, methodology
- content: a structured, factual, self-contained statement of the knowledge item. Written in third person without pronouns. Example: "Managed GSA Schedule 70 contracts for federal IT procurement"
- raw_phrasing: the candidate's own words describing this, verbatim or near verbatim, pulled directly from the transcript
- confidence: "explicit" if the candidate directly stated the fact, "inferred" if you interpreted it from context, implication, or indirect reference
- id: the id shown in the EXISTING KNOWLEDGE BASE for the item being matched or conflicted. Copy it exactly. Never invent an id.
- improved_content: a wording-only rewrite of the existing content statement, or null
- conflict_reason: one short sentence naming exactly what differs

Do not extract plans, intentions, or future goals. Only extract things the candidate has actually done, built, used, or experienced. If the candidate says they plan to, are going to, hope to, or haven't done something yet, do not extract it.

OUTPUT SHAPE
Return exactly this JSON object:

{
  "new": [ { "knowledge_type": "...", "content": "...", "raw_phrasing": "...", "confidence": "..." } ],
  "matches": [ { "id": "...", "raw_phrasing": "...", "confidence": "...", "improved_content": null } ],
  "conflicts": [ { "id": "...", "knowledge_type": "...", "content": "...", "raw_phrasing": "...", "confidence": "...", "conflict_reason": "..." } ]
}

All three keys must be present. Use an empty array for any category with no items.

Return ONLY the JSON object. No preamble, no markdown code fences, no explanation.`

// Static prefix for the match action. The missing-keyword list is the only part
// that varies per call, so it is sent last and everything above it stays cacheable.
const MATCH_INSTRUCTIONS = `You are matching a candidate's existing career knowledge against gaps identified in a job match analysis.

For each knowledge item, determine whether it meaningfully addresses one or more of the missing keywords. A match means this knowledge, if added to the resume, would credibly close that gap.

Be strict. Only return items that directly and specifically address a missing keyword. If an item is generally relevant to the candidate's background but does not close a specific gap named in the missing keywords list, do not include it. Aim for the 3-5 most directly relevant items. Return no more than 8.

Return ONLY a JSON array of matched ids, in order of relevance. No preamble, no fences.
["id1", "id2", ...]

If nothing matches, return [].`

const VALID_TYPES = ['skill', 'experience', 'achievement', 'relationship', 'credential', 'tool', 'industry', 'methodology']

// Lowercase, strip everything but alphanumerics and spaces, collapse runs of
// spaces, trim. Matches the unique index on (user_id, content_key).
function buildContentKey(content) {
  return String(content)
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeTranscript(transcript) {
  if (!transcript) return ''
  if (typeof transcript === 'string') return transcript
  if (Array.isArray(transcript)) {
    return transcript
      .map(m => {
        if (typeof m === 'string') return m
        const role = m?.role === 'assistant' ? 'COACH' : 'CANDIDATE'
        return `${role}: ${m?.content ?? ''}`
      })
      .join('\n\n')
  }
  return ''
}

// Rendered in created_at order so the block only ever grows at the tail, which
// keeps the cached prefix valid for as long as no new rows land.
function buildKnowledgeBaseBlock(rows) {
  if (!rows.length) {
    return 'EXISTING KNOWLEDGE BASE\n\n(empty — nothing stored for this candidate yet, so every fact is new)'
  }
  const list = rows.map((r, i) => `${i + 1}. id: ${r.id} | ${r.content}`).join('\n')
  return `EXISTING KNOWLEDGE BASE\n\n${list}`
}

function buildMatchKnowledgeBlock(rows) {
  const list = rows.map((r, i) => `${i + 1}. id: ${r.id} | ${r.content}`).join('\n')
  return `CANDIDATE KNOWLEDGE BASE:\n\n${list}`
}

// Returns the subset of the candidate's confirmed knowledge that closes one of the
// gaps this job analysis surfaced. Every failure path returns an empty match list —
// the caller uses this to decorate coaching, never to gate it.
async function handleMatch(supabase, user, { missingKeywords, jobTitle, jobCompany }) {
  const empty = { matches: [] }

  const keywords = (Array.isArray(missingKeywords) ? missingKeywords : [])
    .map(k => (typeof k === 'string' ? k.trim() : ''))
    .filter(Boolean)

  if (keywords.length === 0) {
    console.log('[career-knowledge] match — no missing keywords supplied, nothing to match')
    return NextResponse.json(empty)
  }

  const { data: rows, error: kbError } = await supabase
    .from('career_knowledge')
    .select('id, knowledge_type, content, raw_phrasing, confidence, mention_count, last_referenced_at')
    .eq('user_id', user.id)
    .is('superseded_by', null)
    .eq('confidence', 'explicit')
    .order('mention_count', { ascending: false })
    .order('last_referenced_at', { ascending: false })

  if (kbError) {
    console.error('[career-knowledge] match — knowledge base fetch failed:', kbError)
    return NextResponse.json(empty)
  }

  const knowledgeBase = rows || []
  console.log(
    '[career-knowledge] match — job:', jobTitle || '(none)', 'at', jobCompany || '(none)',
    '| explicit items:', knowledgeBase.length,
    '| missing keywords:', keywords.length
  )

  if (knowledgeBase.length === 0) return NextResponse.json(empty)

  // Cheap lexical pre-filter so the model only reads plausibly relevant items.
  // Words of three characters or fewer carry no signal, so they are ignored.
  const meaningfulWords = text => new Set(
    String(text ?? '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 3)
  )

  const keywordWords = meaningfulWords(keywords.join(' '))
  const prefiltered = knowledgeBase.filter(row => {
    for (const word of meaningfulWords(row.content)) {
      if (keywordWords.has(word)) return true
    }
    return false
  })

  // No overlap means the word test was too crude, not that nothing matches —
  // fall through to the full list rather than short-circuiting to empty.
  const candidates = prefiltered.length > 0 ? prefiltered : knowledgeBase
  console.log(
    '[career-knowledge] match — pre-filter kept', prefiltered.length, 'of', knowledgeBase.length, 'items',
    prefiltered.length === 0 ? '(no overlap, falling back to the full list)' : ''
  )

  let responseText
  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [
          // Same two-breakpoint pattern as extract: fixed instructions, then the
          // knowledge base, then the only per-call variable content.
          { type: 'text', text: MATCH_INSTRUCTIONS, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: buildMatchKnowledgeBlock(candidates), cache_control: { type: 'ephemeral' } },
          {
            type: 'text',
            text: `MISSING KEYWORDS FROM JOB ANALYSIS:
${keywords.map(k => `- ${k}`).join('\n')}

Return the JSON array now.`
          }
        ]
      }]
    })
    responseText = message.content?.[0]?.text?.trim()
  } catch (apiErr) {
    console.error('[career-knowledge] match — Claude API error:', apiErr)
    return NextResponse.json(empty)
  }

  if (!responseText) {
    console.error('[career-knowledge] match — no content in API response')
    return NextResponse.json(empty)
  }

  const arrayMatch = responseText.match(/\[[\s\S]*\]/)
  const cleaned = arrayMatch ? arrayMatch[0] : responseText

  let parsed
  try {
    parsed = JSON.parse(cleaned)
  } catch (e) {
    console.error('[career-knowledge] match — parse error:', e, '| first 500 chars:', responseText.slice(0, 500))
    return NextResponse.json(empty)
  }

  if (!Array.isArray(parsed)) {
    console.error('[career-knowledge] match — expected an array, received:', typeof parsed)
    return NextResponse.json(empty)
  }

  const byId = new Map(knowledgeBase.map(r => [String(r.id), r]))
  const seen = new Set()
  const matches = []
  for (const rawId of parsed) {
    const id = rawId == null ? '' : String(rawId)
    if (seen.has(id)) continue
    const row = byId.get(id)
    if (!row) {
      console.log('[career-knowledge] match — SKIPPED unknown id:', JSON.stringify(rawId))
      continue
    }
    seen.add(id)
    matches.push({
      id: row.id,
      knowledge_type: row.knowledge_type,
      content: row.content,
      // The candidate's own wording. Carried through so downstream writing
      // prompts can use it as a voice reference; the modal ignores it.
      raw_phrasing: row.raw_phrasing,
      mention_count: row.mention_count
    })
  }

  // Second pass. The id match tells the modal which items to show; this tells the
  // caller which gaps those items actually close, in the caller's own keyword
  // strings. Judged semantically, since a fact rarely repeats a keyword verbatim.
  // Non-blocking: any failure leaves coveredKeywords empty and nothing is filtered.
  let coveredKeywords = []
  if (candidates.length > 0) {
    try {
      const coverageMessage = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `A candidate has confirmed career knowledge from previous sessions. Review their knowledge against a list of missing keywords from a job match analysis and identify which keywords are covered.

CONFIRMED KNOWLEDGE:
${candidates.map((c, i) => `${i + 1}. ${c.content}`).join('\n')}

MISSING KEYWORDS:
${keywords.join('\n')}

For each missing keyword, determine whether any item in the confirmed knowledge meaningfully covers it. Judge by meaning, not wording. A keyword is covered if the candidate's confirmed experience would satisfy that requirement to a hiring manager reading their resume.

Return ONLY a JSON array of the keywords that are covered, using the exact keyword strings from the MISSING KEYWORDS list. No preamble, no markdown fences.

["keyword1", "keyword2"]

If nothing is covered, return [].`
        }]
      })

      const coverageText = coverageMessage.content?.[0]?.text?.trim()
      if (!coverageText) {
        console.error('[career-knowledge] match — coverage pass returned no content')
      } else {
        const coverageArrayMatch = coverageText.match(/\[[\s\S]*\]/)
        const coverageParsed = JSON.parse(coverageArrayMatch ? coverageArrayMatch[0] : coverageText)
        if (!Array.isArray(coverageParsed)) {
          console.error('[career-knowledge] match — coverage expected an array, received:', typeof coverageParsed)
        } else {
          coveredKeywords = coverageParsed
            .filter(k => typeof k === 'string' && k.trim())
            .map(k => k.trim())
        }
      }
    } catch (coverageErr) {
      console.error('[career-knowledge] match — coverage pass failed (non-blocking):', coverageErr)
    }
  }

  console.log(
    '[career-knowledge] match — returning', matches.length, 'matched items',
    '| covered keywords:', coveredKeywords.length, 'of', keywords.length
  )
  return NextResponse.json({ matches, coveredKeywords })
}

// Shared by "new" and "conflicts" — both carry a full item payload and both are
// written as rows, so both need the same per-row validation.
function validateItem(item, label) {
  const content = typeof item?.content === 'string' ? item.content.trim() : ''
  if (!content) {
    console.log(`[career-knowledge] SKIPPED (${label}) — missing or empty content. Item:`, JSON.stringify(item))
    return null
  }
  const contentKey = buildContentKey(content)
  if (!contentKey) {
    console.log(`[career-knowledge] SKIPPED (${label}) — content_key computed to empty string. Content:`, content)
    return null
  }
  // knowledge_type violates a DB check constraint if it is not one of the
  // eight allowed values, so drop rather than coerce.
  if (!VALID_TYPES.includes(item?.knowledge_type)) {
    console.log(`[career-knowledge] SKIPPED (${label}) — invalid knowledge_type:`, JSON.stringify(item?.knowledge_type ?? null), '| Content:', content)
    return null
  }
  const confidence = (item?.confidence === 'explicit' || item?.confidence === 'inferred') ? item.confidence : 'inferred'
  if (confidence !== item?.confidence) {
    console.log(`[career-knowledge] Defaulted invalid confidence to inferred. Received:`, JSON.stringify(item?.confidence ?? null), '| Content:', content)
  }
  return {
    content_key: contentKey,
    content,
    knowledge_type: item.knowledge_type,
    raw_phrasing: typeof item?.raw_phrasing === 'string' ? item.raw_phrasing : null,
    confidence
  }
}

export async function POST(request) {
  // Zero-count payload returned on every non-auth failure path so this endpoint
  // can never break the caller.
  const noop = { success: true, extracted: 0, matched: 0, improved: 0, conflicts: 0 }

  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const token = authHeader.replace('Bearer ', '')
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { action, resumeId, transcript, resumeData, jobTitle, jobCompany, missingKeywords, ids } = await request.json()

    if (action === 'match') {
      // Own try/catch so an unexpected failure returns the match-shaped payload
      // rather than the extract-shaped noop below.
      try {
        return await handleMatch(supabase, user, { missingKeywords, jobTitle, jobCompany })
      } catch (matchError) {
        console.error('[career-knowledge] match — unexpected error:', matchError)
        return NextResponse.json({ matches: [] })
      }
    }

    if (action !== 'extract') {
      console.error('[career-knowledge] Unknown action:', action)
      return NextResponse.json(noop)
    }

    const transcriptText = normalizeTranscript(transcript)
    if (!transcriptText.trim()) {
      console.error('[career-knowledge] No transcript provided, nothing to extract')
      return NextResponse.json(noop)
    }

    // ---- LOAD EXISTING KNOWLEDGE BASE ----
    // A fetch failure is non-fatal: extraction still runs, every fact just
    // looks new.
    let knowledgeBase = []
    const { data: kbRows, error: kbError } = await supabase
      .from('career_knowledge')
      .select('id, content, knowledge_type, confidence, mention_count')
      .eq('user_id', user.id)
      .is('superseded_by', null)
      .order('created_at', { ascending: true })

    if (kbError) {
      console.error('[career-knowledge] Knowledge base fetch failed, continuing with an empty base:', kbError)
    } else {
      knowledgeBase = kbRows || []
    }
    console.log('[career-knowledge] Knowledge base loaded. Active items:', knowledgeBase.length)

    const existingById = new Map(knowledgeBase.map(r => [String(r.id), r]))
    const existingByContentKey = new Map(knowledgeBase.map(r => [buildContentKey(r.content), r]))

    // ---- EXTRACT ----
    let responseText
    try {
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: [
            // Two cache breakpoints: the instructions never change, and the
            // knowledge base only changes when rows are added, so a session
            // that adds nothing new replays both prefixes from cache.
            { type: 'text', text: EXTRACTION_INSTRUCTIONS, cache_control: { type: 'ephemeral' } },
            { type: 'text', text: buildKnowledgeBaseBlock(knowledgeBase), cache_control: { type: 'ephemeral' } },
            {
              type: 'text',
              text: `RESUME DATA ALREADY ON FILE (do not extract anything already represented here):
${JSON.stringify(resumeData ?? null)}

COACHING CONVERSATION TRANSCRIPT:
${transcriptText}

Return the JSON object now.`
            }
          ]
        }]
      })
      responseText = message.content?.[0]?.text?.trim()
      console.log('[career-knowledge] Raw model response received. Length:', responseText?.length ?? 0)
    } catch (apiErr) {
      console.error('[career-knowledge] Claude API error:', apiErr)
      return NextResponse.json(noop)
    }

    if (!responseText) {
      console.error('[career-knowledge] No content in API response')
      return NextResponse.json(noop)
    }

    const cleaned = responseText.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim()

    let parsed
    try {
      parsed = JSON.parse(cleaned)
    } catch (e) {
      console.error('[career-knowledge] Parse error:', e, 'Response:', responseText)
      console.log('[career-knowledge] Parse failed. First 500 chars of raw response:', responseText.slice(0, 500))
      return NextResponse.json(noop)
    }

    const newRaw = Array.isArray(parsed?.new) ? parsed.new : []
    const matchesRaw = Array.isArray(parsed?.matches) ? parsed.matches : []
    const conflictsRaw = Array.isArray(parsed?.conflicts) ? parsed.conflicts : []
    console.log(
      '[career-knowledge] Parse succeeded. Items parsed — new:', newRaw.length,
      '| matches:', matchesRaw.length,
      '| conflicts:', conflictsRaw.length
    )

    if (newRaw.length === 0 && matchesRaw.length === 0 && conflictsRaw.length === 0) {
      return NextResponse.json(noop)
    }

    // ---- VALIDATE NEW ----
    // Collapse duplicate keys within this batch: the unique index rejects the
    // same content_key twice in one write.
    const byKey = new Map()
    const promotedToMatches = []
    for (const item of newRaw) {
      const validated = validateItem(item, 'new')
      if (!validated) continue
      // Safety net under the semantic pass: an exact key collision would be
      // swallowed by ignoreDuplicates and lose the mention bump.
      const collision = existingByContentKey.get(validated.content_key)
      if (collision) {
        console.log('[career-knowledge] Model returned an existing item as new; treating it as a match. id:', collision.id, '| content_key:', validated.content_key)
        promotedToMatches.push({
          id: collision.id,
          raw_phrasing: validated.raw_phrasing,
          confidence: validated.confidence,
          improved_content: null
        })
        continue
      }
      byKey.set(validated.content_key, validated)
    }

    // ---- VALIDATE CONFLICTS ----
    const conflictItems = []
    for (const item of conflictsRaw) {
      const id = item?.id == null ? '' : String(item.id)
      const existing = existingById.get(id)
      if (!existing) {
        console.log('[career-knowledge] SKIPPED (conflict) — unknown id:', JSON.stringify(item?.id ?? null))
        continue
      }
      const validated = validateItem(item, 'conflict')
      if (!validated) continue
      const reason = typeof item?.conflict_reason === 'string' ? item.conflict_reason : null
      console.log(
        '[career-knowledge] Conflict against id:', existing.id,
        '| reason:', reason ?? '(none given)',
        '| existing:', existing.content,
        '| incoming:', validated.content
      )
      // The conflict row is written separately, so drop any identical key from
      // the new-item batch to avoid two writes racing the same unique index.
      if (byKey.has(validated.content_key)) {
        console.log('[career-knowledge] Dropping new item duplicated by a conflict row. content_key:', validated.content_key)
        byKey.delete(validated.content_key)
      }
      conflictItems.push({ existing, item: validated, reason })
    }

    const items = Array.from(byKey.values())

    // ---- INSERT NEW ----
    let extracted = 0
    if (items.length > 0) {
      const rows = items.map(i => ({
        user_id: user.id,
        resume_id: resumeId || null,
        knowledge_type: i.knowledge_type,
        content: i.content,
        content_key: i.content_key,
        raw_phrasing: i.raw_phrasing,
        confidence: i.confidence,
        source_job_title: jobTitle || null,
        source_job_company: jobCompany || null
      }))

      console.log('[career-knowledge] Inserting', rows.length, 'rows. knowledge_type values:', JSON.stringify(rows.map(r => r.knowledge_type)))

      const { data: inserted, error: insertError } = await supabase
        .from('career_knowledge')
        .upsert(rows, { onConflict: 'user_id,content_key', ignoreDuplicates: true })
        .select('id')

      if (insertError) {
        console.error('[career-knowledge] Insert failed:', insertError)
        console.error(
          '[career-knowledge] Insert error detail — message:', insertError.message,
          '| code:', insertError.code,
          '| details:', insertError.details,
          '| hint:', insertError.hint
        )

        // One bad row fails the whole batch, so retry individually.
        console.log('[career-knowledge] Falling back to row-by-row insert for', rows.length, 'rows')
        for (const row of rows) {
          const { data: singleInserted, error: singleError } = await supabase
            .from('career_knowledge')
            .upsert(row, { onConflict: 'user_id,content_key', ignoreDuplicates: true })
            .select('id')

          if (singleError) {
            console.error(
              '[career-knowledge] Row insert failed. content_key:', row.content_key,
              '| knowledge_type:', row.knowledge_type,
              '| message:', singleError.message,
              '| code:', singleError.code,
              '| details:', singleError.details,
              '| hint:', singleError.hint
            )
          } else {
            extracted += (singleInserted || []).length
          }
        }
        console.log('[career-knowledge] Row-by-row insert complete. Rows inserted:', extracted)
      } else {
        extracted = (inserted || []).length
        console.log('[career-knowledge] Batch insert succeeded. Rows inserted:', extracted)
      }
    }

    // ---- BUMP MATCHES ----
    // Keyed by id so the same row is never patched twice in one pass.
    const matchById = new Map()
    for (const item of [...matchesRaw, ...promotedToMatches]) {
      const id = item?.id == null ? '' : String(item.id)
      const existing = existingById.get(id)
      if (!existing) {
        console.log('[career-knowledge] SKIPPED (match) — unknown id:', JSON.stringify(item?.id ?? null))
        continue
      }
      const confidence = (item?.confidence === 'explicit' || item?.confidence === 'inferred') ? item.confidence : 'inferred'

      let improvedContent = typeof item?.improved_content === 'string' ? item.improved_content.trim() : ''
      if (improvedContent && improvedContent === existing.content) improvedContent = ''
      if (improvedContent && !buildContentKey(improvedContent)) {
        console.log('[career-knowledge] SKIPPED improvement — improved_content has an empty content_key. id:', existing.id)
        improvedContent = ''
      }

      matchById.set(id, {
        existing,
        raw_phrasing: typeof item?.raw_phrasing === 'string' ? item.raw_phrasing : null,
        confidence,
        improved_content: improvedContent || null
      })
    }

    let matched = 0
    let improved = 0
    for (const entry of matchById.values()) {
      const row = entry.existing
      const patch = {
        last_referenced_at: new Date().toISOString(),
        mention_count: (row.mention_count || 0) + 1,
        raw_phrasing: entry.raw_phrasing
      }
      // Upgrade only. Never downgrade an explicit fact to inferred.
      if (entry.confidence === 'explicit' && row.confidence === 'inferred') {
        patch.confidence = 'explicit'
      }

      const applyingImprovement = Boolean(entry.improved_content)
      if (applyingImprovement) {
        patch.previous_content = row.content
        patch.content = entry.improved_content
        patch.content_key = buildContentKey(entry.improved_content)
      }

      let { error: updateError } = await supabase
        .from('career_knowledge')
        .update(patch)
        .eq('id', row.id)
        .eq('user_id', user.id)

      // A reworded content_key can collide with another row's key. Don't let a
      // cosmetic rewrite cost the mention bump — retry without the rewrite.
      if (updateError && applyingImprovement) {
        console.error('[career-knowledge] Match update with improvement failed for', row.id, updateError, '— retrying as a bump only')
        delete patch.previous_content
        delete patch.content
        delete patch.content_key
        ;({ error: updateError } = await supabase
          .from('career_knowledge')
          .update(patch)
          .eq('id', row.id)
          .eq('user_id', user.id))
      } else if (!updateError && applyingImprovement) {
        improved += 1
        console.log('[career-knowledge] Improved wording for', row.id, '| before:', row.content, '| after:', entry.improved_content)
      }

      if (updateError) {
        console.error('[career-knowledge] Bump failed for', row.id, updateError)
      } else {
        matched += 1
      }
    }
    console.log('[career-knowledge] Match loop complete. Rows matched:', matched, '| rows improved:', improved)

    // ---- RECORD CONFLICTS ----
    // The new fact lands as its own flagged row and the old row points at it,
    // so nothing is overwritten and the disagreement stays reviewable.
    let conflicts = 0
    for (const entry of conflictItems) {
      const row = {
        user_id: user.id,
        resume_id: resumeId || null,
        knowledge_type: entry.item.knowledge_type,
        content: entry.item.content,
        content_key: entry.item.content_key,
        raw_phrasing: entry.item.raw_phrasing,
        confidence: entry.item.confidence,
        conflict_flag: true,
        source_job_title: jobTitle || null,
        source_job_company: jobCompany || null
      }

      const { data: insertedConflict, error: conflictInsertError } = await supabase
        .from('career_knowledge')
        .insert(row)
        .select('id')
        .single()

      if (conflictInsertError || !insertedConflict) {
        console.error(
          '[career-knowledge] Conflict insert failed. content_key:', row.content_key,
          '| against id:', entry.existing.id,
          '| message:', conflictInsertError?.message,
          '| code:', conflictInsertError?.code,
          '| details:', conflictInsertError?.details,
          '| hint:', conflictInsertError?.hint
        )
        continue
      }

      conflicts += 1

      const { error: supersedeError } = await supabase
        .from('career_knowledge')
        .update({ superseded_by: insertedConflict.id })
        .eq('id', entry.existing.id)
        .eq('user_id', user.id)

      if (supersedeError) {
        console.error('[career-knowledge] Supersede failed. Row', insertedConflict.id, 'inserted but', entry.existing.id, 'not superseded:', supersedeError)
      } else {
        console.log('[career-knowledge] Conflict recorded. New row:', insertedConflict.id, '| supersedes:', entry.existing.id, '| reason:', entry.reason ?? '(none given)')
      }
    }
    console.log('[career-knowledge] Conflict loop complete. Rows flagged:', conflicts)

    console.log(
      '[career-knowledge] Returning — extracted:', extracted,
      '| matched:', matched,
      '| improved:', improved,
      '| conflicts:', conflicts
    )
    return NextResponse.json({ success: true, extracted, matched, improved, conflicts })

  } catch (error) {
    console.error('[career-knowledge] Unexpected error:', error)
    return NextResponse.json({ success: true, extracted: 0, matched: 0, improved: 0, conflicts: 0 })
  }
}
