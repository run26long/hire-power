import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { apiError } from '@/lib/apiError';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ============================================================================
// INTERVIEWER QUESTIONS — SYSTEM PROMPT
// Cached on every call.
// ============================================================================

const QUESTIONS_SYSTEM_PROMPT = `You are an interview coach for Hire Power. The candidate is preparing questions to ask their interviewer. You have a bank of strong questions. Your job is to pick the 3-4 most relevant ones for this specific role and company, then tailor each one to sound natural for this position.

RULES:
- Pick 3-4 questions. Always include exactly one from the 'closer' category.
- Skip questions that don't fit the company size, team structure, or role type. Use the context hints.
- Lightly customize each question to reference the company name, role, or industry where it sounds natural. Don't force it.
- Write a 1-2 sentence rationale for each explaining why this question is smart to ask at this specific company.
- No em dashes anywhere.
- Return valid JSON only, no markdown, no preamble.

OUTPUT FORMAT:
[
  {
    "bank_question_id": "uuid from the bank",
    "tailored_text": "The customized question",
    "rationale": "Why this question is smart to ask here"
  }
]`;

// ============================================================================
// RESPONSE PARSING
// The bank is passed in the user turn, so the model sometimes writes a line of
// preamble before the array. Slice by brackets rather than trusting the whole
// body to parse.
// ============================================================================

function extractJsonText(content) {
  const joined = (content || [])
    .filter(b => b.type === 'text' && b.text?.trim())
    .map(b => b.text)
    .join('');
  if (!joined.trim()) return null;

  const start = joined.indexOf('[');
  const end = joined.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return null;
  return joined.slice(start, end + 1);
}

// Same guard the company research route uses: cite markup would otherwise
// render as literal text in a question the candidate reads out loud.
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
// RESEARCH SUMMARY
// Only the three fields that describe the company itself. News and culture
// don't change which questions fit, and the prompt is cached, so keeping the
// variable half small is worth more than completeness here.
// ============================================================================

function summarizeResearch(companyResearch) {
  if (!companyResearch) return 'No company research available';

  const lines = [
    companyResearch.what_they_do && `What they do: ${companyResearch.what_they_do}`,
    companyResearch.hiring_context && `Hiring context: ${companyResearch.hiring_context}`,
    companyResearch.size_and_location && `Size and location: ${companyResearch.size_and_location}`
  ].filter(Boolean);

  return lines.length ? lines.join('\n') : 'No company research available';
}

// ============================================================================
// SELECTION
// ============================================================================

async function selectQuestions({ companyName, jobTitle, jobDescription, companyResearch, bank }) {
  const userMessage = `Company: ${companyName}
Job Title: ${jobTitle || 'Not specified'}
Job Description: ${(jobDescription || '').slice(0, 1500)}

Company Research:
${summarizeResearch(companyResearch)}

Question Bank:
${JSON.stringify(
  bank.map(q => ({
    id: q.id,
    question_text: q.question_text,
    category: q.category,
    context_hint: q.context_hint
  })),
  null,
  2
)}`;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    system: [
      {
        type: 'text',
        text: QUESTIONS_SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' }
      }
    ],
    messages: [{ role: 'user', content: userMessage }]
  });

  const usage = {
    input: response.usage?.input_tokens ?? 0,
    cached: response.usage?.cache_read_input_tokens ?? 0,
    output: response.usage?.output_tokens ?? 0
  };

  const cleanText = extractJsonText(response.content);
  if (!cleanText) throw new Error('Interviewer questions returned no JSON array');

  let parsed;
  try {
    parsed = JSON.parse(cleanText);
  } catch (parseErr) {
    console.error('Interviewer questions JSON parse error:', parseErr.message);
    console.error('Interviewer questions sliced JSON:', cleanText.slice(0, 2000));
    throw new Error('Interviewer questions returned unparseable JSON');
  }

  if (!Array.isArray(parsed)) throw new Error('Interviewer questions did not return an array');

  // The model picks ids out of the bank it was handed, so an id that isn't in
  // the bank is a hallucination. Drop those rather than write a dangling
  // foreign key. tailored_text is the only field the UI can't do without.
  const bankIds = new Set(bank.map(q => q.id));
  const clean = stripCitations(parsed)
    .filter(q => q && typeof q.tailored_text === 'string' && q.tailored_text.trim())
    .map(q => ({
      bank_question_id: bankIds.has(q.bank_question_id) ? q.bank_question_id : null,
      tailored_text: q.tailored_text.trim(),
      rationale: typeof q.rationale === 'string' ? q.rationale.trim() : null
    }))
    .slice(0, 4);

  return { questions: clean, usage };
}

// ============================================================================
// COST LOGGING
// Non-blocking: a logging failure must never cost the caller their questions.
// Service role rather than the caller's token, the way every other route writes
// this table. Spend tracking is platform bookkeeping, not the user's data, and
// an insert policy for authenticated users is not worth adding for it.
// ============================================================================

async function logApiCall({ userId, sessionId, usage }) {
  try {
    // input_tokens is already the uncached remainder — cache reads are
    // reported separately, so subtracting them double-counts.
    const estimatedCost =
      (usage.input * 1.0 / 1_000_000) +
      (usage.cached * 0.10 / 1_000_000) +
      (usage.output * 5.0 / 1_000_000);

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { error } = await admin.from('api_call_log').insert({
      user_id: userId,
      session_id: sessionId,
      feature: 'interviewer_questions',
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
      call_type: 'completion',
      input_tokens: usage.input,
      cached_input_tokens: usage.cached,
      output_tokens: usage.output,
      estimated_cost_usd: estimatedCost,
      status: 'success'
    });
    if (error) console.error('api_call_log insert failed (non-blocking):', error);
  } catch (logErr) {
    console.error('api_call_log insert failed (non-blocking):', logErr);
  }
}

// ============================================================================
// POST /api/interview/interviewer-questions
// Returns the questions already chosen for this Power Analysis, or picks a set
// and stores it. Selection happens once: these are the candidate's questions
// for this interview, so they must not change between visits to the step.
//
// Request body: {
//   powerAnalysisId: string,
//   jobCardId: string,
//   companyName: string,
//   jobTitle: string,
//   jobDescription: string,
//   companyResearch: object | null
// }
// ============================================================================

export async function POST(request) {
  console.log('Interviewer questions route hit');
  try {
    // ---- AUTH ----
    // Anon key carrying the caller's token, so every query below runs as that
    // user and RLS does the scoping. The bank is readable by any authenticated
    // user; a selection set is readable only by the user who owns it.
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      console.error('Interviewer questions: no authorization header');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false }
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error('Interviewer questions: auth check failed', authError);
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = user.id;

    // ---- INPUT ----
    const {
      powerAnalysisId,
      jobCardId,
      companyName,
      jobTitle,
      jobDescription,
      companyResearch
    } = await request.json();

    if (!powerAnalysisId || !jobCardId) {
      return Response.json({ error: 'powerAnalysisId and jobCardId required' }, { status: 400 });
    }

    // ---- EXISTING SELECTION ----
    // RLS already limits this to the caller's rows; the user_id filter is
    // belt and braces, and keeps the query correct if the policy ever loosens.
    const { data: existing, error: existingError } = await supabase
      .from('interviewer_questions_selected')
      .select('*')
      .eq('power_analysis_id', powerAnalysisId)
      .eq('user_id', userId)
      .order('order_index', { ascending: true });

    if (existingError) {
      console.error('Interviewer questions lookup error:', existingError);
      return Response.json(
        { error: "Couldn't load your interviewer questions right now." },
        { status: 500 }
      );
    }

    if (existing?.length) {
      return Response.json({ questions: existing, cached: true });
    }

    // ---- QUESTION BANK ----
    // Every row is live. The bank has no enabled/disabled flag: retiring a
    // question means deleting it.
    const { data: bank, error: bankError } = await supabase
      .from('interviewer_questions_bank')
      .select('id, question_text, category, context_hint');

    if (bankError) {
      console.error('Interviewer questions bank error:', bankError);
      return Response.json(
        { error: "Couldn't load your interviewer questions right now." },
        { status: 500 }
      );
    }

    if (!bank?.length) {
      console.error('Interviewer questions bank is empty');
      return Response.json(
        { error: "Couldn't load your interviewer questions right now." },
        { status: 500 }
      );
    }

    // ---- SELECT ----
    const { questions, usage } = await selectQuestions({
      companyName,
      jobTitle,
      jobDescription,
      companyResearch,
      bank
    });

    if (!questions.length) {
      console.error('Interviewer questions: model returned no usable questions for', companyName);
      return Response.json(
        { error: "Couldn't load your interviewer questions right now." },
        { status: 500 }
      );
    }

    const { data: saved, error: insertError } = await supabase
      .from('interviewer_questions_selected')
      .insert(
        // No job_card_id: a Power Analysis belongs to exactly one job card, so
        // power_analysis_id already says which job these belong to.
        questions.map((q, i) => ({
          user_id: userId,
          power_analysis_id: powerAnalysisId,
          bank_question_id: q.bank_question_id,
          tailored_text: q.tailored_text,
          rationale: q.rationale,
          order_index: i
        }))
      )
      .select()
      .order('order_index', { ascending: true });

    if (insertError) {
      console.error('Interviewer questions insert error:', insertError);
      return Response.json(
        { error: "Couldn't load your interviewer questions right now." },
        { status: 500 }
      );
    }

    await logApiCall({ userId, sessionId: powerAnalysisId, usage });

    return Response.json({ questions: saved, cached: false });

  } catch (error) {
    return apiError(error, "Couldn't load your interviewer questions right now.");
  }
}
