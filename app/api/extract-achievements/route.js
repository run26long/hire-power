import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(request) {
  try {
    const { resumeText, conversation } = await request.json()
    
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
    
    // Build prompt to extract achievements
    const extractionPrompt = `You are enhancing an existing resume by integrating quantifiable achievements from a coaching conversation.

CRITICAL APPROACH:
1. START with the original resume content as your foundation
2. PRESERVE all strong existing bullets and content
3. ADD the quantifiable achievements discussed in coaching
4. ENHANCE weak/generic bullets by replacing them with coached achievements
5. If the original resume already has strong, specific content - KEEP IT and ADD metrics where discussed
6. DO NOT discard good existing content just because new achievements were discussed

RESUME WRITING STANDARDS:
- Achievement bullets: [Action Verb] + [What You Did] + [Measurable Result]
- Professional Summary: 2-3 sentences highlighting strongest qualifications with metrics
- Strong action verbs (Led, Increased, Developed, Managed)
- Include specific metrics and numbers
- Keep bullets concise (1-2 lines)
- Present tense for current roles, past tense for previous
- Job Summaries: One sentence describing the role's scope and focus

INTEGRATION STRATEGY:
- If original bullet is strong and specific → KEEP it, add metrics if discussed
- If original bullet is weak/generic → REPLACE with coached achievement
- If new achievement was discussed → ADD it to that role
- Combine the best of both: original structure + coached quantification

Original Resume:
${resumeText}

Coaching Conversation:
${conversation.map(msg => `${msg.role}: ${msg.content}`).join('\n\n')}

Create an ENHANCED resume in this JSON format:
{
  "contact": {
    "fullName": "Full Name",
    "email": "email@example.com",
    "phone": "(555) 555-5555"
  },
  "summary": "Compelling 2-3 sentence professional summary with key achievements and metrics from coaching",
  "experience": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "startDate": "YYYY-MM",
      "endDate": "YYYY-MM or Present",
      "summary": "One sentence describing the role's primary focus and scope",
      "achievements": [
        "Keep strong original bullets AND add coached achievements",
        "Each bullet: action verb + accomplishment + measurable result",
        "Blend original content with coached metrics for best result"
      ]
    }
  ],
  "education": [
    {
      "degree": "Degree Name",
      "school": "School Name",
      "graduationDate": "YYYY-MM",
      "gpa": "3.94",
      "activities": "Activities if discussed",
      "honors": "Honors if discussed"
    }
  ],
  "skills": ["Combine original skills with any new ones discussed"]
}

CRITICAL: Return ONLY valid JSON. No markdown, no explanation, no backticks. Just the JSON object.`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        { role: 'user', content: extractionPrompt }
      ]
    })
    
    const responseText = message.content[0].text.trim()
    
    // Parse the JSON response
    const achievements = JSON.parse(responseText)
    
    return NextResponse.json({ achievements })
    
  } catch (error) {
    console.error('Achievement extraction error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}