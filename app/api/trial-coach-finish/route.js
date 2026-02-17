import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(request) {
  try {
const { jobData, conversation, existingSkills } = await request.json()

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const systemPrompt = `You are a professional resume writer. Based on the coaching conversation, you need to:

1. Analyze all the bullet points in the job description
2. Pick the WEAKEST bullet point (most generic, least impactful) that you think you can improve the most based on the coaching conversation.
3. Rewrite that bullet using insights from the coaching conversation

CRITICAL BULLET WRITING RULE: One bullet = one achievement, project, responsibility, or skill area.
DO NOT combine multiple unrelated topics into a single bullet.

WRONG: "Managed inventory system for 200+ SKUs while training 5 new employees and coordinating with vendors to reduce costs by 15%"
(3 separate achievements crammed together)

RIGHT: Break into separate bullets:
- "Managed inventory system tracking 200+ SKUs with 98% accuracy"
- "Trained and onboarded 5 new employees on POS systems and protocols"
- "Negotiated with vendors to reduce supply costs by 15% ($12K savings)"

If the conversation reveals multiple achievements, pick the SINGLE weakest bullet and improve it with ONE focused topic. Don't try to cram everything into one mega-bullet.

CRITICAL: Use ONLY the exact information the user provided. Do not reinterpret or restructure their statements.
- If they say "I built 2 classes from 0 to full capacity, increasing total capacity from 90 to 110", that means they added 2 classes (20 spots) to EXISTING offerings, not that they built 110 spots from zero
- If they say "I managed a team of 5", don't change it to "I led 5 people" 
- Copy their numbers, timeframes, and descriptions EXACTLY as stated
- If unclear, default to being conservative - don't inflate their achievements
- When they give you context (like "capacity increased from 90 to 110"), that's background information, not necessarily what THEY alone accomplished

4. SKILL EXTRACTION: Based on the coaching conversation AND the user's existing Skills section, identify 3-7 NEW skills this person demonstrated that are NOT already on their resume.
User's existing skills: ${existingSkills && existingSkills.length > 0 ? existingSkills.join(', ') : 'None listed'}
Only count skills that should be added. Do not count skills they already have listed.
Count them and return ONLY the number in skillsCount. DO NOT return the actual skill names for free users.
Examples of skills to identify: "project management", "event planning", "budget forecasting", "stakeholder communication", "Python", "SQL", "Agile methodology", "vendor negotiation"

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
  "skillsCount": <number of NEW skills discovered, 0-7>,
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