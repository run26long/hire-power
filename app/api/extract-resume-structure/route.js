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
  "hideSummary": false,
  "sectionOrder": ["experience", "education", "skills", "projects", "certifications", "volunteer", "languages"],
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
  },
  "projects": [
    {
      "name": "",
      "description": "",
      "link": ""
    }
  ],
  "certifications": [
    {
      "name": "",
      "details": "Issuing organization | Date"
    }
  ],
  "volunteer": [
    {
      "organization": "",
      "description": ""
    }
  ],
  "languages": [
    {
      "language": "",
      "proficiency": "Professional"
    }
  ]
}

CRITICAL INSTRUCTIONS:
- experience.bullets: Break job descriptions into array of achievement bullets (NOT a text paragraph)
- experience.summary: Optional paragraph before bullets (only if resume has one)
- education.lines: Flexible array of lines (degree on line 1, dates/GPA on line 2, honors on line 3, etc.)
- skillsCategories: ALWAYS categorize skills into "Technical Skills" and "Professional Skills". Technical = programming languages, software, tools, technical abilities. Professional = soft skills, leadership, communication, management. If you can't categorize, use "Skills" as single category.
- projects: Extract any personal projects, side projects, or portfolio work. Include project name, brief description, and link if available.
- certifications: Extract professional certifications, licenses, or credentials. Format as "name" and "details" (organization | date).
- volunteer: Extract volunteer work or community service. Include organization name and description of role/activities.
- languages: Extract spoken/written languages. Proficiency options: "Native", "Fluent", "Professional", "Conversational", "Basic"
- sectionOrder: Only include sections that have actual data in this resume (e.g., if no certifications, don't include "certifications" in array)
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
    
    // Ensure section order exists (backwards compatibility)
    if (!extractedData.sectionOrder) {
      const sections = []
      if (extractedData.experience?.length) sections.push('experience')
      if (extractedData.education?.length) sections.push('education')
      if (extractedData.skillsCategories && Object.keys(extractedData.skillsCategories).length) sections.push('skills')
      if (extractedData.projects?.length) sections.push('projects')
      if (extractedData.certifications?.length) sections.push('certifications')
      if (extractedData.volunteer?.length) sections.push('volunteer')
      if (extractedData.languages?.length) sections.push('languages')
      extractedData.sectionOrder = sections
    }
    
    // Ensure hideSummary exists
    if (extractedData.hideSummary === undefined) {
      extractedData.hideSummary = false
    }

    return Response.json({ data: extractedData })
  } catch (error) {
    console.error('Extraction error:', error)
    return Response.json(
      { error: error.message || 'Failed to extract resume structure' },
      { status: 500 }
    )
  }
}