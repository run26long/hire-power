import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const token = authHeader.replace('Bearer ', '')
    if (token !== process.env.INTERNAL_API_SECRET) {
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
      const { data: { user }, error: authError } = await supabase.auth.getUser(token)
      if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userMessage, assistantResponse, isJobSpecific } = await request.json()

    if (!userMessage || !assistantResponse) {
      return NextResponse.json({ captures: [] })
    }

    const systemPrompt = `You analyze a single conversation turn from a resume-coaching session and extract structured captures.

Output ONLY valid JSON. No preamble. No markdown fences. No explanation.
The format is: { "captures": [ { "type": "...", "payload": "..." } ] }
If nothing qualifies, return: { "captures": [] }

Four capture types:

1. job. Fire when the candidate confirms a job's basic facts (title + company + dates).
   payload format: "Company · Title · Dates"
   Example input: "I worked at Acme Corp as a Senior Manager from 2022 to 2024"
   Output: { "type": "job", "payload": "Acme Corp · Senior Manager · 2022-2024" }
   Do NOT fire if any of (title, company, dates) is missing.
   Do NOT fire if the candidate is mentioning a job in passing without confirming it as their own.

2. education. Fire when the candidate confirms a school + degree/field + year.
   payload format: "School · Degree · Year"
   Example: "I got my Bachelor's in Business from UCF in 2020"
   Output: { "type": "education", "payload": "UCF · Bachelor's in Business · 2020" }
   Do NOT fire if any of (school, degree, year) is missing.

3. skill. Fire when the candidate names a specific tool, software, system, methodology, or named professional competency.
   payload format: just the skill name as named.
   Multiple skills in one message means multiple separate captures, one per skill.
   Examples that qualify: "Salesforce", "Python", "Agile", "QuickBooks", "AutoCAD", "Microsoft Excel", "Tableau"
   Do NOT fire for vague soft skills like "communication", "leadership", "teamwork", "problem-solving". Only concrete, listable, nameable things.

4. achievement. Fire when the candidate shares a specific quantified or qualitatively notable accomplishment that would make a strong resume bullet.
   payload format: brief description, max 60 characters.
   Examples that qualify:
   - "We grew revenue 40% in my second year" gives { "type": "achievement", "payload": "Grew revenue 40% in second year" }
   - "I trained 8 new hires" gives { "type": "achievement", "payload": "Trained 8 new hires" }
   - "I served 4,500 attendees across the run" gives { "type": "achievement", "payload": "Served 4,500 attendees across the run" }
   Do NOT fire for routine task descriptions ("I make coffee for clients" is not an achievement).
   Do NOT fire for vague claims without specifics ("I was good at my job" is not an achievement).
   Fire ONLY when the detail is bullet-worthy.

CRITICAL RULES:
- Look only at the USER MESSAGE for what to extract. The ASSISTANT RESPONSE is provided as context only.
- Be conservative. If unsure whether something qualifies, do not fire.
- Output ONLY valid JSON. Nothing else.

JOB-SPECIFIC MODE: ${isJobSpecific ? "ON. Only fire skill and achievement captures. Never fire job or education." : "OFF. All four types are valid."}`

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `USER MESSAGE:\n${userMessage}\n\nASSISTANT RESPONSE (context only):\n${assistantResponse}\n\nReturn JSON now.`
      }]
    })

    const responseText = message.content?.[0]?.text?.trim()
    if (!responseText) {
      console.error('Extract captures: no content in API response')
      return NextResponse.json({ captures: [], error: 'extraction_failed' }, { status: 500 })
    }
    const cleaned = responseText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()

    let parsed
    try {
      parsed = JSON.parse(cleaned)
    } catch (e) {
      console.error('Capture extraction parse error:', e, 'Response:', responseText)
      return NextResponse.json({ captures: [], error: 'extraction_failed' }, { status: 500 })
    }

    const captures = Array.isArray(parsed.captures) ? parsed.captures : []
    return NextResponse.json({ captures })

  } catch (error) {
    console.error('Extract captures error:', error)
    return NextResponse.json({ captures: [], error: 'extraction_failed' }, { status: 500 })
  }
}