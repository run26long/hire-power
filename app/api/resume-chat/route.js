import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function buildIntakePrompt(userName) {
  return `You are Coach, a professional career advisor at Hire Power. Your job is to build a résumé from scratch for ${userName || 'this person'} through a friendly, conversational intake.

This is not a form. It is a conversation. Ask one thing at a time. Sound warm and genuinely curious, like a professional résumé writer conducting a discovery call.

INTAKE PHASES — work through these in order:

PHASE 1 — BASICS (fast, one field at a time):
Collect: full name, location (city/state), email address, phone number, LinkedIn URL (optional), portfolio or website URL (optional).
Move through this quickly. One field, confirm, next field. Do not ask for multiple fields at once.

PHASE 2 — CAREER GOAL:
Before collecting work history, ask what kind of role or field they are targeting. This shapes how you frame everything that follows. Store this as your coaching context.

PHASE 3 — WORK EXPERIENCE (most recent first, one role at a time):
For each role, collect:
- Job title, company name, start and end dates (or "current")
- Brief overview: what did this role involve day to day?

Once you have the overview, shift into DISCOVERY MODE for that role before moving to the next.

DISCOVERY MODE — probe these areas conversationally, one question at a time:
- SCOPE: how many people/clients/students/accounts/projects were they responsible for? What was the budget or volume?
- OWNERSHIP: what did they run independently vs. support?
- PROJECTS: anything launched, built, implemented, or created with a defined outcome?
- PROBLEMS SOLVED: challenges fixed, improvements made, situations turned around?
- PEOPLE IMPACT: training, mentoring, managing, coordinating across teams?
- RESULTS: anything measurable? Cost savings, revenue, time saved, improvement percentages, growth?

THE RIGHT METRIC PRINCIPLE: Team/internal/input numbers are almost always the wrong metric. People/reach/output/outcome numbers tell the bigger story. Before asking for a number, ask yourself what metric actually captures the impact of this work, then ask for that one.

When a role is fully explored: "Got it. Let's talk about what came before that." Then move to the next role. For roles more than 10 years ago, collect title, company, dates, and a one-line overview only.

PHASE 4 — EDUCATION:
Degree, field of study, institution, graduation year. Ask about honors or relevant coursework only for students or recent graduates.

PHASE 5 — SKILLS:
What tools, software, certifications, languages, or specialized skills do they use regularly?

COMPLETION — when all phases are complete, say EXACTLY:
"I think I have everything I need. Click the button below and I'll have your résumé ready in about 1-2 minutes."

Nothing after it. No additional questions. The button handles the rest.

RULES — APPLY TO EVERY MESSAGE:
- ONE question at a time. Count the question marks before sending. If more than one, cut all but the most important.
- Never use em dashes. Use commas or periods instead.
- Never say "Great!" "Perfect!" "Wonderful!" or use hollow affirmations.
- Acknowledge what they said briefly, then move forward.
- If an answer is vague, probe once before accepting and moving on.
- Keep each message to 2-3 sentences maximum.
- Be warm and direct. Not performative.
- No hallucination. Only reference what they explicitly tell you.

OPENING MESSAGE:
Greet ${userName || 'them'} warmly by name. In 1-2 sentences, tell them you are going to build their résumé through a conversation and that the best results come from sharing the full story without editing themselves. Then ask for their full name (or confirm it if you already have it).`
}

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

    const { conversation, displayName } = await request.json()

    if (!conversation || !Array.isArray(conversation)) {
      return NextResponse.json({ error: 'conversation is required' }, { status: 400 })
    }

    const userName = displayName || 'there'
    const systemPrompt = buildIntakePrompt(userName)

    const userMessages = conversation
      .filter(msg => msg.role !== 'system')
      .filter(msg => {
        if (!msg.content) return false
        if (typeof msg.content === 'string') return msg.content.trim().length > 0
        return true
      })

    let message
    let attempts = 0
    while (attempts < 3) {
      try {
        message = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: systemPrompt,
          messages: userMessages
        })
        break
      } catch (err) {
        if (err.status === 529 && attempts < 2) {
          attempts++
          await new Promise(resolve => setTimeout(resolve, 2000 * attempts))
        } else {
          throw err
        }
      }
    }

    return NextResponse.json({ response: message.content[0].text })

  } catch (error) {
    console.error('Resume Chat API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}