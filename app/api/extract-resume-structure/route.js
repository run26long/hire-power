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

Return this exact JSON structure (use empty arrays/strings if sections don't exist):
{
  "fullName": "",
  "email": "",
  "phone": "",
  "location": "",
  "linkedin": "",
  "portfolio": "",
  "summary": "",
  "experience": [
    {
      "title": "",
      "company": "",
      "startDate": "",
      "endDate": "",
      "current": false,
      "description": ""
    }
  ],
  "education": [
    {
      "degree": "",
      "school": "",
      "graduationDate": "",
      "major": "",
      "minor": "",
      "gpa": "",
      "activities": "",
      "honors": ""
    }
  ],
  "certifications": [
    {
      "name": "",
      "organization": "",
      "dateObtained": "",
      "expirationDate": "",
      "expires": false
    }
  ],
  "volunteer": [
    {
      "organization": "",
      "role": "",
      "dates": "",
      "description": ""
    }
  ],
  "projects": [
    {
      "title": "",
      "dates": "",
      "description": ""
    }
  ],
  "skills": [],
  "languages": []
}`
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