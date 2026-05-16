import Anthropic from '@anthropic-ai/sdk'
import { apiError } from '@/lib/apiError'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const token = authHeader.replace('Bearer ', '')
    if (token !== process.env.INTERNAL_API_SECRET) {
      const { createClient } = await import('@supabase/supabase-js')
      const authSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
      const { data: { user }, error: authError } = await authSupabase.auth.getUser(token)
      if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { parsedText } = await request.json()

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
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
      "degree": "Bachelor of Science",
      "field": "Major Name",
      "graduationDate": "YYYY-MM",
      "location": null,
      "lines": ["GPA: 3.8", "Dean's List", "Relevant Coursework: Course 1, Course 2"]
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
- education.degree: The degree name only (e.g., "Bachelor of Science", "Master of Arts", "Associate Degree"). Empty string if not present.
- education.field: The field of study only (e.g., "Computer Science", "Business Administration", "Entertainment Management"). Empty string if not present.
- education.graduationDate: Graduation or expected graduation date in YYYY-MM format. Null if not present.
- education.lines: Supplementary info ONLY — GPA, honors, relevant coursework, honor societies. Do NOT put degree name or field of study in lines[]. Those go in degree and field above. Do NOT put any version of the graduation date in lines[] — not the numeric date, not a written-out date (e.g., "December 2027"), not an "expected" phrase (e.g., "expected December 2027" or "graduating May 2024"). The graduationDate field captures the date; do not duplicate it.
- skillsCategories: ALWAYS categorize skills into "Technical Skills" and "Professional Skills". Technical = programming languages, software, tools, technical abilities. Professional = soft skills, leadership, communication, management. If you can't categorize, use "Skills" as single category.
- projects: Extract any personal projects, side projects, or portfolio work. Include project name, brief description, and link if available.
- certifications: Extract professional certifications, licenses, or credentials. Format as "name" and "details" (organization | date).
- volunteer: Extract volunteer work or community service. Include organization name and description of role/activities.
- languages: Extract spoken/written languages. Proficiency options: "Native", "Fluent", "Professional", "Conversational", "Basic"
- sectionOrder: Only include sections that have actual data in this resume (e.g., if no certifications, don't include "certifications" in array)
- NON-STANDARD SECTIONS: If the resume contains sections that don't map to the standard fields above (such as "Performance Experience," "Publications," "Awards," "Competitions," "Exhibitions," "Portfolio," or any other custom section), DO NOT drop them. Map them to the closest available field: performance credits, competitions, and portfolio work → projects array (use the event/show/achievement as "name" and the details as "description"). Awards and honors → certifications array. Community involvement → volunteer array. Never silently discard content that appears in the resume.
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

    // Strip date duplicates from education.lines[] — safety net for when the model
    // ignores the prompt rule and drops a duplicate date string into lines[].
    if (Array.isArray(extractedData.education)) {
      extractedData.education = extractedData.education.map(edu => {
        if (!Array.isArray(edu.lines) || edu.lines.length === 0) return edu
        if (!edu.graduationDate) return edu

        const gradDate = edu.graduationDate
        const [yearStr, monthStr] = gradDate.split('-')
        const year = yearStr
        const monthNum = parseInt(monthStr, 10)
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
        const monthName = (monthNum >= 1 && monthNum <= 12) ? monthNames[monthNum - 1] : null

        const filteredLines = edu.lines.filter(line => {
          if (typeof line !== 'string') return true
          const lower = line.toLowerCase()

          // Match "12/2027", "2027", "12-2027", "2027-12"
          if (lower.includes(year)) {
            // Catch "expected May 2024", "graduating December 2027", "anticipated 2025", etc.
            if (/\b(expected|anticipated|graduating|graduation|projected)\b/.test(lower)) {
              return false
            }
            // Catch bare "December 2027" or "12/2027"
            if (monthName && lower.includes(monthName.toLowerCase())) {
              return false
            }
            // Catch lines that are essentially just the date
            const stripped = line.replace(/[^a-z0-9]/gi, '')
            if (stripped.length < 12 && stripped.includes(year)) {
              return false
            }
          }

          return true
        })

        return { ...edu, lines: filteredLines }
      })
    }

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
    return apiError(error, "We couldn't read your resume. Try uploading it again, or use a different file.")
  }
}