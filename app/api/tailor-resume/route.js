import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request) {
  try {
    const { resumeData, jobTitle, company, jobDescription } = await request.json()

    const systemPrompt = `You are an expert resume optimization specialist and ATS (Applicant Tracking System) analyst. Your job is to:

1. ANALYZE the job description and extract:
   - Required skills and qualifications
   - Preferred/nice-to-have skills
   - Key responsibilities
   - Important keywords and phrases
   - Industry-specific terminology

2. MATCH ANALYSIS - Compare the resume against job requirements:
   - Calculate match score (0-100%) based on keyword coverage and qualification alignment
   - Identify gaps (what's missing from resume)
   - Identify strengths (what matches well)
   - Note transferable skills that apply

3. OPTIMIZE the resume for THIS specific job:
   - Reorder experience to highlight most relevant roles first
   - Adjust professional summary to emphasize relevant skills
   - Reorder achievements within each job to prioritize relevant ones
   - Emphasize keywords from job description naturally
   - DO NOT add fake experience or skills
   - DO NOT remove anything - only reorder and re-emphasize
   - Keep all original content intact, just reorganize for maximum relevance

4. RETURN your analysis in this EXACT JSON structure:
{
  "matchScore": 75,
  "analysis": {
    "strengths": ["Leadership experience matches senior role requirements", "Project management skills align with responsibilities"],
    "gaps": ["No mention of Salesforce CRM", "Limited data analysis experience"],
    "keywordCoverage": {
      "present": ["Python", "team leadership", "agile"],
      "missing": ["Salesforce", "SQL", "data visualization"]
    },
    "recommendations": ["Highlight Python projects more prominently", "Reorder experience to lead with most relevant role"]
  },
  "customizedResume": {
    "contact": { ... },
    "summary": "Rewritten to emphasize job-relevant skills and experience",
    "experience": [ ... reordered and re-emphasized ... ],
    "education": [ ... ],
    "skills": [ ... reordered by relevance ... ]
  }
}

CRITICAL RULES:
- Match score calculation: (matching requirements / total requirements) * 100, rounded to nearest integer
- Be honest about gaps - don't inflate scores
- Only reorder/emphasize, never fabricate content
- Maintain professional resume writing standards
- Use exact structure from original resume
- Return ONLY valid JSON, no markdown or explanation`

    const userPrompt = `JOB POSTING:
Title: ${jobTitle}
Company: ${company}

Description:
${jobDescription}

---

CURRENT RESUME DATA:
${JSON.stringify(resumeData, null, 2)}

---

Analyze this job posting, calculate the match score, and optimize the resume for maximum ATS compatibility and relevance. Return ONLY the JSON structure specified in the system prompt.`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      messages: [
        {
          role: 'user',
          content: userPrompt
        }
      ],
      system: systemPrompt
    })

    const responseText = message.content[0].text
    
    // Parse JSON response (remove markdown if present)
    let result
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      result = JSON.parse(jsonMatch ? jsonMatch[0] : responseText)
    } catch (parseError) {
      console.error('Failed to parse Claude response:', responseText)
      throw new Error('Invalid response format from AI')
    }

    return Response.json(result)

  } catch (error) {
    console.error('Error in tailor-resume API:', error)
    return Response.json(
      { error: 'Failed to tailor resume' },
      { status: 500 }
    )
  }
}