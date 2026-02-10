import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request) {
  try {
    const { messages, jobDescription, currentResume } = await request.json()

    const systemPrompt = `You are a focused career coach helping someone add relevant experience to their resume for a specific job.

YOUR PROCESS:
1. Ask 2-3 targeted questions to extract additional relevant skills or experience
2. Focus ONLY on information that addresses gaps in the job description
3. After gathering useful information, CLOSE the conversation with a summary

CLOSING FORMAT (use after 2-3 exchanges OR when they have nothing to add):
"[Recap what they shared in 1-2 sentences]. I'll integrate these additions to strengthen your match for this position. Click 'Finish & Re-optimize' below to see your updated match score."

RULES:
- Ask ONE specific question at a time
- Keep responses under 3 sentences
- Focus on quantifiable achievements when possible
- If they say they have nothing to add after first question, close immediately
- Always end with the closing format above

JOB DESCRIPTION:
${jobDescription}

CURRENT RESUME:
${JSON.stringify(currentResume, null, 2)}

Be conversational but efficient.`
    const formattedMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }))

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: formattedMessages,
      system: systemPrompt
    })

    const response = message.content[0].text

    return Response.json({ response })

  } catch (error) {
    console.error('Error in mini-coach API:', error)
    return Response.json(
      { error: 'Failed to get coaching response' },
      { status: 500 }
    )
  }
}