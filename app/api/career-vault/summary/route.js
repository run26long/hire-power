import { createClient } from '@supabase/supabase-js'
import { isPortfolioItem } from '@/lib/portfolio'

// ============================================================================
// GET /api/career-vault/summary
//
// Everything the account knows about itself, counted. One read, so the Vault
// can draw a scorecard of the career knowledge base without the page running
// eight queries of its own and inventing eight ways to fail.
//
// WHOSE VAULT THIS IS
// The token's. No user id is read from the query or the body: the service
// role sees every row, and an identifier from the browser would be the only
// thing standing between one person's session and another person's career.
// Every query below is filtered on the authenticated user.
//
// COUNTS, NOT CONTENT
// Nothing here returns a fact, an answer or a paragraph. It returns how many
// of each there are, plus the job titles and companies the knowledge came
// from, which is the one list the scorecard shows as text. A summary endpoint
// that also carried the content would be a second way to read the knowledge
// base, with its own bugs.
//
// NOTHING HERE FAILS THE WHOLE ANSWER
// A profile with no testimonials is a normal profile, and so is one whose
// interview table has never been written to. Each block resolves on its own
// and an error in one returns zeros for that block with the rest intact -
// a scorecard missing a line is worth more than a page that will not load.
// The exception is authentication, which is the only real failure here.
// ============================================================================

// The eight the extractor is allowed to write. Named here so a type that has
// never been used still appears as a zero rather than going missing, which is
// the difference between "no tools recorded" and "tools are not a thing".
const KNOWLEDGE_TYPES = [
  'skill', 'experience', 'achievement', 'relationship',
  'credential', 'tool', 'industry', 'methodology'
]

// Where a row came from, in the extractor's own words.
const SOURCE_TYPES = ['conversation', 'uploaded_resume', 'interview_practice']

const TESTIMONIAL_STATUSES = ['requested', 'submitted', 'polished', 'published']

const zeroed = keys => Object.fromEntries(keys.map(k => [k, 0]))

// A count of one thing, as its own promise, so one failure cannot take the
// others with it.
async function countOf(supabase, table, apply) {
  try {
    let q = supabase.from(table).select('id', { count: 'exact', head: true })
    q = apply ? apply(q) : q
    const { count, error } = await q
    if (error) {
      console.error(`[career-vault] Count failed on ${table} (non-fatal):`, error)
      return 0
    }
    return count || 0
  } catch (e) {
    console.error(`[career-vault] Count threw on ${table} (non-fatal):`, e)
    return 0
  }
}

async function rowsOf(supabase, table, columns, apply) {
  try {
    let q = supabase.from(table).select(columns)
    q = apply ? apply(q) : q
    const { data, error } = await q
    if (error) {
      console.error(`[career-vault] Read failed on ${table} (non-fatal):`, error)
      return []
    }
    return data || []
  } catch (e) {
    console.error(`[career-vault] Read threw on ${table} (non-fatal):`, e)
    return []
  }
}

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data: { user }, error: authError } =
      await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const mine = q => q.eq('user_id', user.id)

    const [
      profile,
      knowledgeRows,
      coreResumes,
      jobResumes,
      interviewRows,
      evidenceRows,
      testimonialRows,
    ] = await Promise.all([
      // The badge's number, so the scorecard can say what is new without a
      // second round trip.
      rowsOf(supabase, 'profiles', 'unseen_vault_count', q => q.eq('id', user.id)),

      // Type, source and provenance in one read. The alternative is three
      // grouped counts, and Postgres has no group-by through this client, so
      // one narrow read and a tally here is both fewer queries and less code.
      rowsOf(supabase, 'career_knowledge',
        'knowledge_type, source_type, source_job_title, source_job_company, created_at', mine),

      // Coaching is recorded on the resume it produced: coaching_complete is
      // the flag the rest of the app reads to mean "that conversation
      // finished". There is no sessions table to count instead.
      rowsOf(supabase, 'resumes', 'id, coaching_complete',
        q => mine(q).eq('resume_type', 'core').eq('is_active', true)),
      rowsOf(supabase, 'resumes', 'id, coaching_complete',
        q => mine(q).eq('resume_type', 'job_specific').eq('is_active', true)),

      rowsOf(supabase, 'interview_sessions', 'id, readiness_score_after',
        q => mine(q).eq('status', 'completed')),

      // Evidence and portfolio are the same table; what separates them is the
      // rule in lib/portfolio, which is imported rather than restated so the
      // scorecard and the profile cannot disagree about what a portfolio is.
      // Every row the account owns. Removing a piece of evidence deletes the
      // row, so there is no archived state to filter out, and a status filter
      // here would quietly drop rows whose status is null.
      rowsOf(supabase, 'profile_evidence', 'id, media_class, source_type', mine),

      rowsOf(supabase, 'profile_testimonials', 'id, status, reference_consent', mine),
    ])

    // ---- KNOWLEDGE ----
    const byType = zeroed(KNOWLEDGE_TYPES)
    const bySource = zeroed(SOURCE_TYPES)
    const history = new Map()

    for (const row of knowledgeRows) {
      if (row.knowledge_type) {
        byType[row.knowledge_type] = (byType[row.knowledge_type] || 0) + 1
      }
      if (row.source_type) {
        bySource[row.source_type] = (bySource[row.source_type] || 0) + 1
      }
      // A role is a title and a company together: the same title at two
      // employers is two jobs, and the same employer twice over a career is
      // two entries in a history somebody reads top to bottom.
      const title = (row.source_job_title || '').trim()
      const company = (row.source_job_company || '').trim()
      if (!title && !company) continue
      const key = `${title.toLowerCase()}|${company.toLowerCase()}`
      const seen = history.get(key)
      if (seen) {
        seen.entries += 1
        if (row.created_at && (!seen.lastAddedAt || row.created_at > seen.lastAddedAt)) {
          seen.lastAddedAt = row.created_at
        }
      } else {
        history.set(key, {
          title: title || null,
          company: company || null,
          entries: 1,
          lastAddedAt: row.created_at || null,
        })
      }
    }

    const careerHistory = [...history.values()]
      .sort((a, b) => (b.lastAddedAt || '').localeCompare(a.lastAddedAt || '') || b.entries - a.entries)

    // ---- INTERVIEWS ----
    const scored = interviewRows
      .map(r => Number(r.readiness_score_after))
      .filter(n => Number.isFinite(n))
    const averageScore = scored.length
      ? Math.round(scored.reduce((sum, n) => sum + n, 0) / scored.length)
      : null

    // ---- EVIDENCE ----
    const portfolio = evidenceRows.filter(isPortfolioItem).length

    // ---- TESTIMONIALS ----
    const byStatus = zeroed(TESTIMONIAL_STATUSES)
    let referenceConsenting = 0
    for (const row of testimonialRows) {
      if (row.status) byStatus[row.status] = (byStatus[row.status] || 0) + 1
      if (row.reference_consent === true) referenceConsenting += 1
    }

    const coachingCore = coreResumes.filter(r => r.coaching_complete === true).length
    const coachingJob = jobResumes.filter(r => r.coaching_complete === true).length

    return Response.json({
      knowledge: {
        total: knowledgeRows.length,
        byType,
        bySource,
        sinceLastVisit: Number(profile?.[0]?.unseen_vault_count) || 0,
      },
      coaching: {
        core: coachingCore,
        jobSpecific: coachingJob,
        total: coachingCore + coachingJob,
      },
      interviews: {
        completed: interviewRows.length,
        averageScore,
      },
      resumes: {
        core: coreResumes.length,
        jobSpecific: jobResumes.length,
        total: coreResumes.length + jobResumes.length,
      },
      evidence: {
        evidence: evidenceRows.length - portfolio,
        portfolio,
        total: evidenceRows.length,
      },
      testimonials: {
        byStatus,
        total: testimonialRows.length,
        referenceConsenting,
      },
      careerHistory,
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[career-vault] Summary failed:', error)
    return Response.json(
      { error: "We couldn't load your Career Vault summary. Please try again." },
      { status: 500 }
    )
  }
}
