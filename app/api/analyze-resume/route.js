import Anthropic from '@anthropic-ai/sdk'

// Convert structured resume data to plain text for analysis
function convertStructuredToText(data) {
  let text = ''
  
  // Contact
  if (data.contact) {
    text += `${data.contact.fullName}\n`
    text += `${data.contact.email}`
    if (data.contact.phone) text += ` | ${data.contact.phone}`
    if (data.contact.location) text += ` | ${data.contact.location}`
    text += '\n\n'
  } else if (data.fullName) {
    text += `${data.fullName}\n`
    text += `${data.email}`
    if (data.phone) text += ` | ${data.phone}`
    if (data.location) text += ` | ${data.location}`
    text += '\n\n'
  }
  
  // Summary
  if (data.summary) {
    text += `PROFESSIONAL SUMMARY\n${data.summary}\n\n`
  }
  
  // Experience
  if (data.experience && data.experience.length > 0) {
    text += 'EXPERIENCE\n\n'
    data.experience.forEach(job => {
      text += `${job.title} | ${job.company}\n`
      text += `${job.startDate} - ${job.endDate || job.current ? 'Present' : job.endDate}\n`
      
      // Handle both summary + achievements format AND description format
      if (job.summary) text += `${job.summary}\n`
      
      if (job.achievements && job.achievements.length > 0) {
        job.achievements.forEach(achievement => {
          text += `• ${achievement}\n`
        })
      } else if (job.description) {
        // Already has description format
        text += `${job.description}\n`
      }
      
      text += '\n'
    })
  }
  
  // Education
  if (data.education && data.education.length > 0) {
    text += 'EDUCATION\n\n'
    data.education.forEach(edu => {
      text += `${edu.degree} | ${edu.school}`
      if (edu.graduationDate) text += ` | ${edu.graduationDate}`
      text += '\n'
      if (edu.gpa) text += `GPA: ${edu.gpa}\n`
      if (edu.honors) text += `${edu.honors}\n`
      if (edu.activities) text += `${edu.activities}\n`
      text += '\n'
    })
  }
  
  // Skills
  if (data.skills && data.skills.length > 0) {
    text += `SKILLS\n${data.skills.join(', ')}\n\n`
  }
  
  return text
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request) {
  try {
    console.log('=== ANALYZE RESUME API CALLED ===')
    const { resumeText, resumeData } = await request.json()
    
    // Handle both formats: plain text OR structured data
    let textToAnalyze = resumeText
    
    if (!textToAnalyze && resumeData) {
      // Convert structured data to text
      textToAnalyze = convertStructuredToText(resumeData)
      console.log('Converted structured data to text')
    }
    
    console.log('Resume text length:', textToAnalyze?.length || 0)
    
    if (!textToAnalyze) {
      throw new Error('No resume data provided')
    }

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
${textToAnalyze}

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