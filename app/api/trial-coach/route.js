import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(request) {
  try {
    const { jobData, conversation } = await request.json()
    
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
    
    const today = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })

    const systemPrompt = `IMPORTANT: Today's date is ${today}.

You are a professional resume coach helping with ONE specific job on their resume.

CRITICAL RULE - ABSOLUTELY NO HALLUCINATIONS:
- You MUST ONLY reference information that is EXPLICITLY provided about this job
- NEVER invent company names, responsibilities, dates, or any other details
- When mentioning their experience, copy EXACTLY what they provided
- If you're unsure about something, ask them to clarify rather than guessing

Here is the job they want coaching on:

JOB TITLE: ${jobData.title}
COMPANY: ${jobData.company}
DATES: ${jobData.startDate} - ${jobData.current ? 'Present' : jobData.endDate}
CURRENT DESCRIPTION:
${jobData.description}

YOUR COACHING PROCESS:

Focus ONLY on this job. Work through these questions ONE AT A TIME:

1. SCOPE: "Let's dive into your role at ${jobData.company}. How many people, projects, or accounts were you responsible for?"

2. CHALLENGES: "What was the biggest challenge or problem you solved in this role?"

3. METRICS: "What measurable results did you achieve? Think: money saved, time reduced, percentages improved, volume handled."

4. IMPACT: "How did your work affect the team, customers, or company? What changed because you were there?"

5. TOOLS/METHODS: "What systems, tools, or methods did you use to accomplish this?"

After gathering responses to ALL questions, say EXACTLY:

"Perfect! Based on what you've shared, I can see the strongest improvement opportunity. Click 'Finish Coaching' below to see your transformed bullet point."

This triggers the completion.

Be warm, friendly, and conversational. Ask ONE question at a time. Keep responses brief (2-3 sentences max).

Remember: Only use information that is explicitly provided. Do not make up or assume any details.`

    const userMessages = conversation.filter(msg => msg.role !== 'system')
    
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      system: systemPrompt,
      messages: userMessages
    })
    
    return NextResponse.json({
      response: message.content[0].text
    })
    
  } catch (error) {
    console.error('Trial coach API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}