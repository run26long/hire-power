import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { createClient } from '@supabase/supabase-js';
import InterviewKitPDF from '../../../templates/pdf/InterviewKitPDF';
import { apiError } from '@/lib/apiError';

// ============================================================================
// POST /api/interview/interview-kit-pdf
// Body: { jobCardId, powerAnalysisId }
//
// Assembles everything the candidate carries into the room — their Power
// Analysis, the job description, company highlights, and the questions they
// picked for the interviewer — and returns it as a PDF.
//
// Rendered server-side rather than in the browser: @react-pdf/renderer is well
// over a megabyte, and the practice step shouldn't carry it in its bundle for
// a button most candidates press once.
// ============================================================================

// Long prose fields are written as paragraphs. The highlights list wants one
// line each, so take the opening sentence and leave the rest.
function firstSentence(text) {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^.*?[.!?](\s|$)/);
  return (match ? match[0] : trimmed).trim();
}

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

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // ---- INPUT ----
    const { jobCardId, powerAnalysisId, selected } = await request.json();
    if (!jobCardId) {
      return Response.json({ error: 'jobCardId required' }, { status: 400 });
    }

    // Which sections the candidate ticked. An older caller that sends nothing
    // gets the whole kit, which is what the checkboxes default to anyway.
    const sections = selected && typeof selected === 'object'
      ? {
          powerAnalysis: !!selected.powerAnalysis,
          highlights: !!selected.highlights,
          questions: !!selected.questions,
          jobDescription: !!selected.jobDescription
        }
      : {
          powerAnalysis: true, highlights: true,
          questions: true, jobDescription: true
        };

    // ---- JOB CARD ----
    // Scoped to the caller: the service role key bypasses RLS, so ownership is
    // checked here rather than assumed.
    const { data: jobCard, error: jobCardError } = await supabase
      .from('applications')
      .select('id, title, company, description')
      .eq('id', jobCardId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (jobCardError) throw jobCardError;
    if (!jobCard) return Response.json({ error: 'JOB_CARD_NOT_FOUND' }, { status: 404 });

    // ---- CANDIDATE NAME ----
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .maybeSingle();

    // ---- POWER ANALYSIS ----
    let powerAnalysis = null;
    if (sections.powerAnalysis && powerAnalysisId) {
      const { data: paRow } = await supabase
        .from('power_analysis')
        .select('core_power, hidden_power, power_gaps')
        .eq('id', powerAnalysisId)
        .eq('user_id', user.id)
        .maybeSingle();
      powerAnalysis = paRow || null;
    }

    // ---- INTERVIEWER QUESTIONS ----
    // powerAnalysisId is optional: without it the kit simply prints without
    // the questions section rather than failing the whole download.
    let questions = [];
    if (sections.questions && powerAnalysisId) {
      const { data: questionRows } = await supabase
        .from('interviewer_questions_selected')
        .select('*')
        .eq('power_analysis_id', powerAnalysisId)
        .eq('user_id', user.id)
        .order('order_index', { ascending: true });
      questions = questionRows || [];
    }

    // ---- COMPANY HIGHLIGHTS ----
    // Read from the cache only. This route never triggers a research run: a
    // print button should not cost a web search.
    let research = null;
    if (sections.highlights && jobCard.company) {
      const { data: researchRow } = await supabase
        .from('company_research')
        .select('what_they_do, size_and_location, hiring_context, culture_signals')
        .eq('company_name_normalized', jobCard.company.toLowerCase().trim())
        .order('generated_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      research = researchRow || null;
    }

    const highlights = [
      firstSentence(research?.what_they_do),
      research?.size_and_location,
      firstSentence(research?.hiring_context),
      research?.culture_signals?.values?.[0]
    ].filter(Boolean).slice(0, 4);

    // ---- RENDER ----
    // A ticked section with no data behind it still renders nothing: the
    // template gates on both the flag and the content.
    const element = React.createElement(InterviewKitPDF, {
      selected: sections,
      jobCard,
      powerAnalysis,
      candidateName: profile?.display_name || null,
      highlights,
      questions,
      generatedOn: new Date().toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric'
      })
    });

    const pdfBuffer = await renderToBuffer(element);

    const fileName = `Interview Kit - ${jobCard.title || 'Role'} at ${jobCard.company || 'Company'}.pdf`;

    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        // The filename can carry commas and quotes from a job title, so it
        // goes out percent-encoded rather than raw inside the header.
        'Content-Disposition': `attachment; filename="interview-kit.pdf"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        'Cache-Control': 'no-store'
      }
    });

  } catch (error) {
    return apiError(error, "We couldn't build your interview kit PDF. Please try again.");
  }
}
