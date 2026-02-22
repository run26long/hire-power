import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request) {
  try {
    const { parsedText } = await request.json()

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: `Extract structured resume data from this text. Return ONLY valid JSON with no markdown formatting, no preamble, no explanation.

Resume text:
${parsedText}

Return this exact JSON structure (use empty arrays/strings/null if sections don't exist):
{
  "fullName": "",
  "email": "",
  "phone": "",
  "location": "",
  "linkedin": "",
  "summary": null,
  "experience": [
    {
      "title": "",
      "company": "",
      "location": null,
      "startDate": "",
      "endDate": null,
      "current": false,
      "summary": null,
      "bullets": ["achievement 1", "achievement 2"]
    }
  ],
  "education": [
    {
      "school": "",
      "lines": ["Bachelor of Science in Major", "GPA: 3.8 | May 2027"]
    }
  ],
  "skillsCategories": {
    "Technical Skills": ["skill1", "skill2"],
    "Professional Skills": ["skill3", "skill4"]
  }
}

CRITICAL INSTRUCTIONS:
- experience.bullets: Break job descriptions into array of achievement bullets (NOT a text paragraph)
- experience.summary: Optional paragraph before bullets (only if resume has one)
- education.lines: Flexible array of lines (degree on line 1, dates/GPA on line 2, honors on line 3, etc.)
- skillsCategories: Group skills by category if possible, otherwise use "Skills" as single category
- Dates: Use YYYY-MM format (e.g., "2023-09" for September 2023)
- current: Set true if job description says "Present" or "Current"
- If resume has a professional summary paragraph at top, put it in summary field
- Each bullet should be a complete sentence about an achievement or responsibility`
      }]
    })

    const responseText = message.content[0].text

    // Clean up any markdown formatting
    let cleanedResponse = responseText.trim()
    if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()
    }

    const extractedData = JSON.parse(cleanedResponse)

    return Response.json({ data: extractedData })
  } catch (error) {
    console.error('Extraction error:', error)
    return Response.json(
      { error: error.message || 'Failed to extract resume structure' },
      { status: 500 }
    )
  }
}