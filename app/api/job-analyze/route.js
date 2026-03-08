import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { resumeData, jobDescription, jobTitle, jobCompany, userId } = await request.json();

    // Get user tier
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .single();

    const userTier = profile?.subscription_tier || 'free';

    const resumeText = convertResumeToText(resumeData);

    const prompt = `You are an expert career coach and ATS analyst. Compare this resume against the job description and return a JSON analysis.

RESUME:
${resumeText}

JOB DESCRIPTION:
${jobDescription}

SCORING RUBRIC (must follow exactly for consistency):
- Keyword Coverage (50pts): How many specific skills/requirements from the JD appear on the resume (directly or through clear equivalents)
- Experience Relevance (30pts): How closely the candidate's actual work history matches the role's responsibilities
- Education Match (20pts): Degree field, level, and any GPA/certification requirements

Score ranges:
- 90-100: Exceptional match, candidate exceeds requirements
- 80-89: Strong match, well-qualified candidate
- 70-79: Good candidate, some gaps but strong transferable skills
- 60-69: Partial match, notable gaps but worth considering
- Below 60: Significant gaps, major upskilling needed

Return ONLY valid JSON in this exact format:
{
  "matchScore": <number 0-100 calculated using rubric above>,
  "matchedKeywords": [<specific skills and qualifications from JD that appear on resume — no generic words like "team member" or "meetings", only meaningful skill terms>],
  "missingKeywords": [<specific skills/tools/qualifications from JD the candidate genuinely lacks evidence of>],
  "hiddenPower": [<skills on resume that indirectly map to JD requirements, format: "Resume skill → JD requirement", e.g. "Class scheduling → Production scheduling">],
  "coreStrengths": [<3-5 strongest direct matches between resume and JD>],
  "summary": [<3 coaching bullets starting with "✓ " highlighting strongest fit points, then 1-2 bullets starting with "○ " gently noting what to strengthen — phrase as opportunities, not deficiencies>]
}

Rules:
- matchScore: apply the rubric consistently — same resume + same JD should always produce the same score
- matchedKeywords: specific and meaningful only, no filler words
- hiddenPower: look hard for indirect mappings — be generous here
- missingKeywords: only genuine gaps, not things covered by hiddenPower
- summary ○ bullets: coach tone, e.g. "○ Worth adding your GPA to confirm the 2.8+ requirement" not "Missing GPA"
- Return ONLY the JSON object, no markdown, no extra text`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    });

    const rawText = response.content[0].text.trim();
    const cleanText = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const analysis = JSON.parse(cleanText);

    // Free tier: counts only
    if (userTier === 'free') {
      return Response.json({
        matchScore: analysis.matchScore,
        matchedCount: analysis.matchedKeywords.length,
        missingCount: analysis.missingKeywords.length,
        summary: analysis.summary,
        tier: 'free'
      });
    }

    // Pro tier: full analysis
    return Response.json({
      matchScore: analysis.matchScore,
      matchedKeywords: analysis.matchedKeywords,
      missingKeywords: analysis.missingKeywords,
      hiddenPower: analysis.hiddenPower,
      coreStrengths: analysis.coreStrengths,
      summary: analysis.summary,
      tier: 'pro'
    });

  } catch (error) {
    console.error('job-analyze error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

function convertResumeToText(data) {
  if (!data) return '';
  let text = '';

  if (data.fullName) text += `${data.fullName}\n`;
  if (data.summary) text += `\nSUMMARY\n${data.summary}\n`;

  if (data.experience?.length) {
    text += '\nEXPERIENCE\n';
    data.experience.forEach(job => {
      text += `${job.title} at ${job.company}\n`;
      if (job.summary) text += `${job.summary}\n`;
      if (job.bullets?.length) job.bullets.forEach(b => text += `• ${b}\n`);
    });
  }

  if (data.education?.length) {
    text += '\nEDUCATION\n';
   data.education.forEach(e => {
  text += `${e.degree} ${e.field} - ${e.school}\n`;
  if (e.lines?.length) e.lines.forEach(l => text += `${l}\n`);
});
  }

  if (data.skillsCategories) {
    text += '\nSKILLS\n';
    Object.entries(data.skillsCategories).forEach(([cat, skills]) => {
      text += `${cat}: ${skills.join(', ')}\n`;
    });
  } else if (data.skills?.length) {
    text += `\nSKILLS\n${data.skills.join(', ')}\n`;
  }

  if (data.certifications?.length) {
    text += '\nCERTIFICATIONS\n';
    data.certifications.forEach(c => text += `${c.name}\n`);
  }

  return text;
}