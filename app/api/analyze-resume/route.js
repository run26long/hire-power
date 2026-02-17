import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request) {
  try {
    console.log('=== ANALYZE RESUME API CALLED ===')
    const { resumeText } = await request.json()
    console.log('Resume text length:', resumeText.length)

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `You are a professional resume analyst. Analyze this resume and provide:

1. RESUME POWER SCORE (0-100): Rate the overall quality based on what ATS systems and recruiters look for
   
   Scoring criteria:
   - Action Verbs: Strong, varied action verbs at start of bullets (15 points)
   - Quantifiable Achievements: Numbers, percentages, metrics showing impact (25 points)
   - Professional Language: No weak words like "helped", "responsible for" (15 points)
   - Grammar & Spelling: Error-free writing (10 points)
   - Skills Clarity: Clear, relevant skills listed (10 points)
   - Education & Credentials: Appropriate credentials shown (10 points)
   - Completeness: All key sections present and well-developed (15 points)

2. STRENGTHS (3-5 specific things they're doing well)

3. WEAKNESSES (3-5 specific areas that need improvement)

4. SUGGESTIONS (3-5 actionable recommendations to improve their score)

Be specific and constructive. Focus on content quality, NOT formatting (they haven't formatted yet).

Resume to analyze:
${resumeText}

CRITICAL: Respond with ONLY a JSON object, no markdown formatting, no code blocks, no preamble. Just the raw JSON.

{
  "score": <number 0-100>,
  "strengths": ["strength 1", "strength 2", ...],
  "weaknesses": ["weakness 1", "weakness 2", ...],
  "suggestions": ["suggestion 1", "suggestion 2", ...]
}`
      }]
    })

    console.log('Claude response received')
    const responseText = message.content[0].text
    console.log('Raw response:', responseText)

    // Clean up response - remove markdown code blocks if present
    let cleanedResponse = responseText.trim()
    if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    }
    
    console.log('Cleaned response:', cleanedResponse)

    const analysis = JSON.parse(cleanedResponse)
    console.log('Analysis parsed successfully, score:', analysis.score)

    return Response.json({ 
      analysis: {
        strengths: analysis.strengths,
        weaknesses: analysis.weaknesses,
        suggestions: analysis.suggestions
      },
      score: analysis.score 
    })
    
  } catch (error) {
    console.error('=== ANALYSIS ERROR ===')
    console.error('Error type:', error.constructor.name)
    console.error('Error message:', error.message)
    console.error('Full error:', error)
    
    return Response.json(
      { error: `Failed to analyze resume: ${error.message}` },
      { status: 500 }
    )
  }
}