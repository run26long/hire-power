import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(request) {
  try {
    const { jobData, conversation } = await request.json()
    
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const systemPrompt = `You are a professional resume writer. Based on the coaching conversation, you need to:

1. Analyze all the bullet points in the job description
2. Pick the WEAKEST bullet point (most generic, least impactful)
3. Rewrite that bullet using insights from the coaching conversation

JOB DATA:
Title: ${jobData.title}
Company: ${jobData.company}
Current Description/Bullets:
${jobData.description}

COACHING CONVERSATION:
${conversation.map(msg => `${msg.role === 'user' ? 'User' : 'Coach'}: ${msg.content}`).join('\n\n')}

Return ONLY a JSON object with this structure (no markdown, no explanation):
{
  "originalBullet": "the exact text of the weakest bullet from the description",
  "improvedBullet": "the professionally rewritten version using coaching insights",
  "reasoning": "1-2 sentence explanation of why you chose this bullet and what you improved"
}`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        { role: 'user', content: 'Please analyze the job and provide the improved bullet.' }
      ]
    })
    
    const responseText = message.content[0].text
    // Remove markdown code blocks if present
    const cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const result = JSON.parse(cleanedText)
    
    return NextResponse.json(result)
    
  } catch (error) {
    console.error('Trial coach finish API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}