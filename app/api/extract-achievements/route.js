import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(request) {
  try {
    const { resumeText, conversation } = await request.json()
    
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
    
    // Build prompt to extract achievements
    const extractionPrompt = `Based on this resume coaching conversation, extract all the achievements and improvements discussed.

Original Resume:
${resumeText}

Coaching Conversation:
${conversation.map(msg => `${msg.role}: ${msg.content}`).join('\n\n')}

Extract and structure the following in JSON format:
{
  "experience": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "startDate": "YYYY-MM",
      "endDate": "YYYY-MM or Present",
      "achievements": [
        "Quantifiable achievement with metrics",
        "Another achievement with numbers"
      ]
    }
  ],
  "skills": ["skill1", "skill2"],
  "education": [
    {
      "degree": "Degree Name",
      "school": "School Name",
      "graduationDate": "YYYY-MM",
      "gpa": "3.94",
      "activities": "Activities text",
      "honors": "Honors text"
    }
  ],
  "contact": {
    "fullName": "Name",
    "email": "email",
    "phone": "phone"
  }
}

CRITICAL: Return ONLY the JSON object, no markdown, no explanation, no backticks. Just valid JSON.`

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