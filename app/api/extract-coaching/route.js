import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request) {
  try {
    const { conversation, currentResume } = await request.json()

    const systemPrompt = `You are a resume integration specialist. Your job is to extract new information from a coaching conversation and integrate it into an existing resume.

INSTRUCTIONS:
1. Read the coaching conversation carefully
2. Identify NEW skills, experience, accomplishments, or qualifications mentioned
3. Integrate this new information into the appropriate sections of the existing resume. If it related to a specific job or educational experience, work it into the existing job summary or an existing bullet point if possible. If can get its own bullet point only if it warrants it. If it doesn't fit in existing experience, work high importance items into the Professional Summary and low importance items into the skills section.
4. Maintain professional resume writing standards
5. DO NOT remove or replace existing content - only ADD new information
6. Keep the same structure and format as the original resume

Return the updated resume in the SAME JSON structure as the input, with new information integrated.

CURRENT RESUME:
${JSON.stringify(currentResume, null, 2)}

COACHING CONVERSATION:
${conversation.map(msg => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n\n')}

---

Return ONLY the updated resume JSON. No markdown, no explanation.`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: systemPrompt
        }
      ]
    })

    const responseText = message.content[0].text
    
    // Parse JSON response
    let updatedResume
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      updatedResume = JSON.parse(jsonMatch ? jsonMatch[0] : responseText)
    } catch (parseError) {
      console.error('Failed to parse Claude response:', responseText)
      throw new Error('Invalid response format from AI')
    }

    return Response.json({ updatedResume })

  } catch (error) {
    console.error('Error in extract-coaching API:', error)
    return Response.json(
      { error: 'Failed to extract coaching information' },
      { status: 500 }
    )
  }
}