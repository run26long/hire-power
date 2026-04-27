import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { apiError } from '@/lib/apiError'

const anthropic = new Anthropic()

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const token = authHeader.replace('Bearer ', '')

    const { createClient: createAuthClient } = await import('@supabase/supabase-js')
    const authSupabase = createAuthClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    const { data: { user }, error: authError } = await authSupabase.auth.getUser(token)
    if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { name, title, company, reviewDate, dateRange, focus, accomplishments } = await request.json()

    // Filter accomplishments by date range
    const now = new Date()
    const startDate = new Date()
    if (dateRange === '3months') startDate.setMonth(now.getMonth() - 3)
    else if (dateRange === '6months') startDate.setMonth(now.getMonth() - 6)
    else startDate.setFullYear(now.getFullYear() - 1) // 12months default

    const filteredWins = (accomplishments || []).filter(a => {
      if (!a.created_at) return true
      return new Date(a.created_at) >= startDate
    })

    // Gap detection — find stretches of 60+ days with no wins
    let hasGap = false
    let gapText = null

    if (filteredWins.length > 0) {
      const sorted = [...filteredWins].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      let maxGapDays = 0
      let gapStartStr = ''
      let gapEndStr = ''

      // Check gap from startDate to first win
      const firstWin = new Date(sorted[0].created_at)
      const initialGap = Math.floor((firstWin - startDate) / (1000 * 60 * 60 * 24))
      if (initialGap > maxGapDays) {
        maxGapDays = initialGap
        gapStartStr = startDate.toLocaleDateString('en-US', { month: 'long' })
        gapEndStr = firstWin.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      }

      // Check gaps between wins
      for (let i = 0; i < sorted.length - 1; i++) {
        const gap = Math.floor(
          (new Date(sorted[i + 1].created_at) - new Date(sorted[i].created_at)) / (1000 * 60 * 60 * 24)
        )
        if (gap > maxGapDays) {
          maxGapDays = gap
          gapStartStr = new Date(sorted[i].created_at).toLocaleDateString('en-US', { month: 'long' })
          gapEndStr = new Date(sorted[i + 1].created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        }
      }

      if (maxGapDays >= 60 && gapStartStr) {
        hasGap = true
        gapText = `Your log is light between ${gapStartStr} and ${gapEndStr}. If anything significant happened during that stretch — a project completed, a problem solved, a responsibility absorbed — consider adding it before your review. The document will regenerate automatically.`
      }
    }

    if (filteredWins.length === 0) {
      return Response.json({
        success: false,
        error: 'no_wins',
        message: 'No wins logged for this period.'
      })
    }

    const focusLabels = {
      standard: 'standard annual review',
      raise: 'raise or compensation discussion',
      promotion: 'promotion consideration',
      pip: 'performance improvement plan',
      other: 'general review'
    }

    const winsText = filteredWins.map((a, i) =>
      `Win ${i + 1} (${a.created_at ? new Date(a.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'date not specified'}): ${a.raw_description}`
    ).join('\n')

    const rangeLabel = dateRange === '3months' ? 'past 3 months'
      : dateRange === '6months' ? 'past 6 months'
      : 'past 12 months'

    const prompt = `You are a professional career writer helping ${name} prepare a self-authored performance review document.

USER DETAILS:
Name: ${name}
Title: ${title}
Company: ${company}
Review Date: ${reviewDate}
Review Period: ${rangeLabel}
Review Focus: ${focusLabels[focus] || 'standard annual review'}

LOGGED WINS (${filteredWins.length} total):
${winsText}

WRITING RULES — follow every one of these without exception:
- Write entirely in ${name}'s voice. First person throughout.
- Never invent metrics, scope, or context not present in the wins above.
- Never use hollow language: results-driven, team player, passionate, dedicated, detail-oriented, hard-working, go-getter.
- Never use em dashes.
- Past tense, active voice throughout.
- No markdown formatting of any kind. No asterisks, no pound signs.
- Use hyphens (-) for bullets, indented two spaces.
- The document must read as if the user wrote it after careful reflection — not AI-generated.
- Be specific. If a win mentions a number or a named project, use it. If not, don't invent one.

DOCUMENT STRUCTURE:

Write the following sections in order. Use the exact section header text shown, in ALL CAPS, followed by a blank line.

YEAR AT A GLANCE

Write 2-3 sentences summarizing the period as a whole. Pull themes from the wins without listing individual items. Sets the tone. Should feel like an executive summary the user is comfortable saying aloud.

WINS BY THEME

Group the wins into relevant themes. Only include a theme if at least one win clearly fits it. Available themes:

Impact — measurable outcomes, results, cost savings, efficiency improvements
Leadership — managing or mentoring people, cross-functional coordination, decision ownership
Growth — new skills, certifications, expanded scope, first-time responsibilities
Process & Systems — improvements to how work gets done, tools adopted, workflows built or improved

For each theme that applies:
- Write one sentence framing what that theme represents for this person this year
- List the wins as clean, specific bullets
- Improve the raw language into professional phrasing — but add no details that aren't there

${focus === 'raise' ? `THE CASE FOR MY COMPENSATION

2-3 sentences. A direct, confident business case for why ${name}'s compensation should reflect their contribution this year. Ground every claim in the wins above. Not apologetic, not aggressive — a business argument.` : ''}

${focus === 'promotion' ? `THE CASE FOR THE NEXT LEVEL

2-3 sentences. A direct, confident case for why ${name} is ready for increased responsibility. Ground every claim in the wins above. Forward-looking and specific.` : ''}

${focus === 'pip' ? `PROGRESS AND COMMITMENT

2-3 sentences. Focused on progress demonstrated during the period, obstacles addressed, and commitment to continued growth. Constructive and specific.` : ''}

Output the document text only. No preamble, no explanation, no notes about what you did.`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    })

    const bodyText = message.content?.[0]?.text?.trim()
    if (!bodyText) {
      return apiError(
        new Error('Empty content from Anthropic in review-prep'),
        "We couldn't generate your review prep. Please try again."
      )
    }

    // Build header — plain text, no branding
    const header = `${name}\n${title} — ${company}\nPerformance Review | ${reviewDate}`
    const fullDocument = `${header}\n\n${bodyText}`

    return Response.json({
      success: true,
      document: fullDocument,
      hasGap,
      gapText,
      winsUsed: filteredWins.length
    })

  } catch (error) {
    return apiError(error, "We couldn't generate your review prep. Please try again.")
  }
}