import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { apiError } from '@/lib/apiError';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Research goes stale. Ninety days keeps a brief useful across a normal job
// search without re-searching the web for every candidate at the same company.
const CACHE_DAYS = 90;

// ============================================================================
// COMPANY RESEARCH — SYSTEM PROMPT
// Cached on every call.
// ============================================================================

const RESEARCH_SYSTEM_PROMPT = `═══════════════════════════════════════════════
You are a company research assistant for Hire Power, a career coaching platform. A candidate is preparing for a job interview. Your job is to produce a concise, scannable company brief they can read in under 2 minutes.

You have access to web search. Use it to find current, accurate information about the company.

OUTPUT FORMAT — return valid JSON only, no markdown, no preamble:

{
  "what_they_do": "2-3 sentence plain-English description of what the company does and who their customers are.",
  "size_and_location": "One line. Employee count and headquarters city/state. Example: ~3,400 employees, Austin TX.",
  "hiring_context": "One sentence describing what the role suggests about where the company is growing or investing right now.",
  "recent_news": [
    {
      "headline": "Short headline",
      "date": "Month Year",
      "summary": "One sentence summary."
    }
  ],
  "culture": {
    "mission": "One sentence or null if not found.",
    "values": ["value 1", "value 2"],
    "themes_positive": ["theme 1"],
    "themes_negative": ["theme 2"]
  },
  "interview_style": {
    "likely_format": "One sentence describing typical interview process if known.",
    "known_question_types": ["behavioral", "case study"],
    "difficulty": "easy | medium | hard | unknown"
  }
}

RULES:
- Return only what you can verify. Do not fabricate.
- If a section has no reliable data, use null or an empty array.
- recent_news: 2-3 items maximum. Only include news from the last 12 months.
- Keep every field brief. This is a quick brief, not a research report.
- No em dashes anywhere in your output.
- Write every field as plain prose. Do NOT include citation markup of any kind: no <cite> tags, no index attributes, no bracketed source numbers. The candidate reads these fields directly, so anything that is not plain text shows up as broken output.
- Job title and description are provided for context only — use them to write hiring_context.
═══════════════════════════════════════════════`;

// ============================================================================
// RESPONSE PARSING
// With web search on, the response interleaves server_tool_use,
// web_search_tool_result, and text blocks, and how the answer splits across
// text blocks varies run to run. So concatenate every text block and slice out
// the JSON by braces rather than trusting block position or a fence: the model
// reliably writes a sentence of preamble before the object.
// ============================================================================

function extractJsonText(content) {
  const joined = (content || [])
    .filter(b => b.type === 'text' && b.text?.trim())
    .map(b => b.text)
    .join('');
  if (!joined.trim()) return null;

  const start = joined.indexOf('{');
  const end = joined.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return joined.slice(start, end + 1);
}

// Web search makes the model wrap quoted facts in <cite index="..."> tags, which
// would otherwise render as literal markup in the brief. The system prompt asks
// for clean text; this strips whatever slips through.
function stripCitations(value) {
  if (typeof value === 'string') {
    return value
      .replace(/<\/?cite\b[^>]*>/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
  if (Array.isArray(value)) return value.map(stripCitations);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, stripCitations(v)]));
  }
  return value;
}

// ============================================================================
// EMPTINESS CHECK
// A brief where every field came back null means there was nothing reliable to
// find — common for staffing agencies and small private firms, where the
// posting describes a client rather than the employer. That is a legitimate
// outcome, not a failure, so it is reported as notFound and never written:
// caching it would serve an empty brief for the full 90 days.
// ============================================================================

function isBlank(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0 || value.every(isBlank);
  if (typeof value === 'object') return Object.values(value).every(isBlank);
  return false;
}

// 'culture' is the model's key for what we store as culture_signals.
const RESEARCH_FIELDS = [
  'what_they_do',
  'size_and_location',
  'hiring_context',
  'recent_news',
  'culture',
  'interview_style'
];

function hasNoUsableContent(parsed) {
  return RESEARCH_FIELDS.every(field => isBlank(parsed?.[field]));
}

// ============================================================================
// GENERATION
// Haiku + web search. Bounded continuation: the server-side search loop can
// stop with pause_turn before finishing, which is a resumable state, not an
// error. Re-sending the assistant turn picks up where it left off.
// ============================================================================

async function generateResearch({ companyName, jobTitle, jobDescription }) {
  const userMessage = `Company: ${companyName}
Job Title: ${jobTitle || 'Not specified'}
Job Description: ${(jobDescription || '').slice(0, 1500)}`;

  const messages = [{ role: 'user', content: userMessage }];
  let response;
  let usage = { input: 0, cached: 0, output: 0 };

  for (let attempt = 0; attempt < 3; attempt++) {
    response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8000,
      system: [
        {
          type: 'text',
          text: RESEARCH_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' }
        }
      ],
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 6 }],
      messages
    });

    usage.input += response.usage?.input_tokens ?? 0;
    usage.cached += response.usage?.cache_read_input_tokens ?? 0;
    usage.output += response.usage?.output_tokens ?? 0;

    if (response.stop_reason !== 'pause_turn') break;

    // Resume: append the paused turn and re-send. No extra user message —
    // the API sees the trailing server tool use and continues on its own.
    messages.push({ role: 'assistant', content: response.content });
  }

  const rawText = (response.content || [])
    .filter(b => b.type === 'text' && b.text?.trim())
    .map(b => b.text)
    .join('');
  const cleanText = extractJsonText(response.content);

  // No JSON object at all. In practice this is the model writing prose to say
  // it found nothing, so it is a not-found rather than a malfunction. A broken
  // object that fails JSON.parse below is a genuine error and still throws.
  if (!cleanText) {
    console.warn('Company research: no JSON object returned. Raw text:', rawText.slice(0, 1000));
    return { parsed: null, usage, noJson: true };
  }

  let parsed;
  try {
    parsed = JSON.parse(cleanText);
  } catch (parseErr) {
    console.error('Company research JSON parse error:', parseErr.message);
    console.error('Company research raw text:', rawText.slice(0, 2000));
    console.error('Company research sliced JSON:', cleanText.slice(0, 2000));
    throw new Error('Company research returned unparseable JSON');
  }

  return { parsed: stripCitations(parsed), usage };
}

// ============================================================================
// POST /api/interview/company-research
// Returns a cached brief when one exists and is unexpired; otherwise generates
// a fresh one and writes it. Research is keyed by normalized company name, so
// one candidate's lookup warms the cache for everyone else at that company.
//
// Request body: {
//   jobCardId: string,
//   companyName: string,
//   jobTitle: string,
//   jobDescription: string
// }
// ============================================================================

export async function POST(request) {
  try {
    // ---- AUTH ----
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const token = authHeader.replace('Bearer ', '');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    let userId;
    if (token === process.env.INTERNAL_API_SECRET) {
      const bodyForAuth = await request.clone().json();
      userId = bodyForAuth.userId;
      if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    } else {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      userId = user.id;
    }

    // ---- INPUT ----
    const { jobCardId, companyName, jobTitle, jobDescription } = await request.json();
    if (!jobCardId || !companyName?.trim()) {
      return Response.json({ error: 'jobCardId and companyName required' }, { status: 400 });
    }

    const normalized = companyName.toLowerCase().trim();

    // ---- CACHE LOOKUP ----
    // Oldest row wins, ordered + limited so a duplicate row never errors the
    // lookup and makes the caller think no research exists.
    const { data: existing, error: lookupError } = await supabase
      .from('company_research')
      .select('*')
      .eq('company_name_normalized', normalized)
      .order('generated_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (lookupError) {
      console.error('Company research lookup error:', lookupError);
      return Response.json(
        { error: "Couldn't pull company info right now. You can still practice without it." },
        { status: 500 }
      );
    }

    const isFresh = existing?.expires_at && new Date(existing.expires_at).getTime() > Date.now();
    if (existing && isFresh) {
      return Response.json({ research: existing, cached: true });
    }

    // ---- GENERATE ----
    const { parsed, usage, noJson } = await generateResearch({ companyName, jobTitle, jobDescription });

    // Nothing usable came back — either no JSON at all, or a brief where every
    // field is null. Report a clean not-found rather than an error, since there
    // is nothing for the user to retry, and skip the write.
    if (noJson || hasNoUsableContent(parsed)) {
      console.warn('Company research found no usable content for:', companyName);
      return Response.json({ research: null, notFound: true });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + CACHE_DAYS * 24 * 60 * 60 * 1000);

    const row = {
      company_name_normalized: normalized,
      company_name_display: companyName.trim(),
      what_they_do: parsed.what_they_do ?? null,
      size_and_location: parsed.size_and_location ?? null,
      hiring_context: parsed.hiring_context ?? null,
      recent_news: parsed.recent_news ?? [],
      culture_signals: parsed.culture ?? null,
      interview_style: parsed.interview_style ?? null,
      // Web search doesn't hand back URLs we can reliably attribute per claim,
      // so we store an empty list rather than invent citations.
      source_urls: [],
      generated_at: now.toISOString(),
      expires_at: expiresAt.toISOString()
    };

    let saved;
    if (existing) {
      // Expired — refresh in place so the row keeps its refresh history.
      const { data: updated, error: updateError } = await supabase
        .from('company_research')
        .update({ ...row, refresh_count: (existing.refresh_count ?? 0) + 1 })
        .eq('id', existing.id)
        .select()
        .single();
      if (updateError) {
        console.error('Company research update error:', updateError);
        return Response.json(
          { error: "Couldn't pull company info right now. You can still practice without it." },
          { status: 500 }
        );
      }
      saved = updated;
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('company_research')
        .insert(row)
        .select()
        .single();
      if (insertError) {
        console.error('Company research insert error:', insertError);
        return Response.json(
          { error: "Couldn't pull company info right now. You can still practice without it." },
          { status: 500 }
        );
      }
      saved = inserted;
    }

    // ---- LOG API CALL ----
    try {
      const estimatedCost =
        ((usage.input - usage.cached) * 1.0 / 1_000_000) +
        (usage.cached * 0.10 / 1_000_000) +
        (usage.output * 5.0 / 1_000_000);

      await supabase.from('api_call_log').insert({
        user_id: userId,
        session_id: saved.id,
        feature: 'company_research',
        provider: 'anthropic',
        model: 'claude-haiku-4-5-20251001',
        call_type: 'completion',
        input_tokens: usage.input,
        cached_input_tokens: usage.cached,
        output_tokens: usage.output,
        estimated_cost_usd: estimatedCost,
        status: 'success'
      });
    } catch (logErr) {
      console.error('api_call_log insert failed (non-blocking):', logErr);
    }

    return Response.json({ research: saved, cached: false });

  } catch (error) {
    return apiError(error, "Couldn't pull company info right now. You can still practice without it.");
  }
}
