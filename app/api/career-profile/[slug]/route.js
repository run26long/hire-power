import { createClient } from '@supabase/supabase-js'
import { apiError } from '@/lib/apiError'
import { isEntitledTier } from '../_lib/recruiterContext'

// ============================================================================
// GET /api/career-profile/[slug]
// Public read for the Career Profile page. No authentication: the slug is the
// only key, which is the point, and it is also the whole authorization boundary.
//
// The service role bypasses RLS, so every select here names its columns. A
// `select('*')` on any of these tables would publish whatever gets added to it
// next, to anyone holding a link.
//
// An Authorization header is optional. When one is present and it belongs to
// the profile's owner, the response says so, and the page shows owner controls.
// The owner's user id itself is never returned.
// ============================================================================

// PostgREST reports an unknown column as 42703 on a select. Several columns
// here are newer than their tables, so a select is tried in full and retried
// with the columns that have always existed rather than failing the page.
function isMissingColumnError(error) {
  if (!error) return false
  return error.code === '42703' || error.code === 'PGRST204'
}

// The page shows three directions at most, the same ceiling the hub selector
// card uses.
const LENS_DISPLAY_LIMIT = 3

const PROFILE_BASE = 'id, user_id, slug, is_published'
const PROFILE_FULL = `${PROFILE_BASE}, template, color_mode, accent, imow_text, imow_type, imow_video_path, contact_email`

const LENS_BASE = 'id, name, slug, sort_order, status, evidence_summary, core_resume_id, created_at'
const LENS_FULL = `${LENS_BASE}, headline, bio, proof_points, ready_for_next, ready_tags, skill_emphasis`

// The only schemes that may reach a browser from this route. The column is
// constrained to the same thing, so this is the second lock rather than the
// first: a row written before that constraint existed still cannot get out.
const SAFE_URL = /^https?:\/\//i

export async function GET(request, { params }) {
  try {
    const { slug } = await params
    if (!slug) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // ---- THE PROFILE ----
    let { data: profile, error: profileError } = await supabase
      .from('career_profiles')
      .select(PROFILE_FULL)
      .eq('slug', slug)
      .maybeSingle()

    if (isMissingColumnError(profileError)) {
      console.warn('[career-profile] career_profiles is missing its styling columns, reading without them')
      ;({ data: profile, error: profileError } = await supabase
        .from('career_profiles')
        .select(PROFILE_BASE)
        .eq('slug', slug)
        .maybeSingle())
    }

    if (profileError) {
      console.error('[career-profile] Profile lookup failed:', profileError)
      return Response.json({ error: 'PROFILE_LOAD_FAILED' }, { status: 500 })
    }
    if (!profile) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

    // ---- OWNER? ----
    // Optional. A viewer with no session is the normal case and gets the page
    // exactly as a recruiter would see it.
    let isOwner = false
    const authHeader = request.headers.get('authorization')
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user } } = await supabase.auth.getUser(token)
      isOwner = Boolean(user && user.id === profile.user_id)
    }

    // ---- PUBLISHED? ----
    // The slug is the whole authorization boundary for a reader, and until now
    // that boundary had a hole in it: a profile that had never been published
    // answered anybody who guessed or was given its slug, in full.
    //
    // `!== true` rather than `=== false`, so a row whose flag is null or
    // missing reads as unpublished. Anything that is not an explicit yes is a
    // no, which is the direction this should fail in.
    //
    // The owner is the exception, and has to be: this is where they see their
    // own draft, and the controls for writing a direction and setting the
    // contact address are on the page itself. Everyone else gets the same
    // answer they would get for a slug that does not exist, so this cannot be
    // used to find out which slugs are taken.
    if (profile.is_published !== true && !isOwner) {
      return Response.json({ error: 'NOT_FOUND' }, { status: 404 })
    }

    // ---- EVERYTHING THE PAGE RENDERS ----
    const [
      lensRes, personRes, contextRes, coreRes, testimonialRes,
      evidenceRes, placementRes, testimonialPlacementRes, impactRes, skillProofRes
    ] = await Promise.all([
      // Active only. This used to read suggestions too, which meant a profile
      // published directions its owner had never chosen: Coach proposes a
      // direction in the background, and it appeared on the page beside the one
      // they actually wrote. A direction reaches this page because somebody
      // turned it on, and comes off it the moment they turn it off.
      supabase
        .from('profile_lenses')
        .select(LENS_FULL)
        .eq('profile_id', profile.id)
        .eq('status', 'active')
        .order('sort_order', { ascending: true }),
      // The tier travels only as far as the boolean below. It is selected here
      // because this query is already being made, and it is read once and
      // dropped - what the profile is worth to its owner is between them and
      // their billing, and is nobody else's business on a public page.
      supabase
        .from('profiles')
        .select('display_name, subscription_tier, email')
        .eq('id', profile.user_id)
        .maybeSingle(),
      supabase
        .from('career_context')
        .select('target_roles, current_lens_name')
        .eq('user_id', profile.user_id)
        .maybeSingle(),
      // The flagged priority core when there is one, the newest core when there
      // is not. A strict is_priority_core filter returns nothing for an account
      // that predates the column, which would empty the page.
      supabase
        .from('resumes')
        .select('id, display_name, resume_data, current_score')
        .eq('user_id', profile.user_id)
        .eq('resume_type', 'core')
        .eq('is_active', true)
        .order('is_priority_core', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1),
      // Published testimonials only. recipient_email, raw_text and
      // request_token are deliberately not named: a draft testimonial, the
      // referee's address and the token that lets someone write one are not
      // things a link holder gets.
      supabase
        .from('profile_testimonials')
        .select('id, polished_text, recipient_name, recipient_title, relationship')
        .eq('profile_id', profile.id)
        .eq('status', 'published')
        .order('created_at', { ascending: true }),
      // Publicly eligible evidence only: public, published, not deleted. The
      // three conditions are asked for together because any one of them alone
      // is not eligibility - a published item can still be private, and a
      // public one can still be a draft or withdrawn.
      //
      // storage_path, thumbnail_path and user_id are deliberately not named.
      // A path into a private bucket is not a link holder's business: the
      // viewer asks for a signed URL by evidence id instead, and the route
      // that signs it checks eligibility again before it does.
      supabase
        .from('profile_evidence')
        .select(
          'id, family, evidence_type, kind, media_class, title, description, ' +
          'organization, date_label, source_type, url, provider, embed_url, sort_order, ' +
          // Read to be turned into a boolean below, never to be sent. The
          // Portfolio needs to know a preview exists so it can ask for one; it
          // has no business knowing where it is.
          'thumbnail_path, duration_seconds'
        )
        .eq('profile_id', profile.id)
        .eq('privacy', 'public')
        .eq('status', 'published')
        .is('deleted_at', null)
        .order('sort_order', { ascending: true }),
      // Where each direction puts them. References only - an id, a position
      // and whether it leads - so nothing about an item travels twice.
      supabase
        .from('profile_evidence_placements')
        .select('evidence_id, lens_id, sort_order, featured, hidden')
        .eq('profile_id', profile.id)
        .order('sort_order', { ascending: true }),
      // Which testimonials each direction shows, and in what order. A row
      // with a null lens_id is the shared default a direction without its own
      // falls back to, the same as evidence.
      supabase
        .from('profile_testimonial_placements')
        .select('testimonial_id, lens_id, sort_order, hidden')
        .eq('profile_id', profile.id)
        .order('sort_order', { ascending: true }),
      // The stored syntheses. Read only: this page never generates one, and a
      // profile that has never generated any simply has no rows, which is a
      // normal profile rather than a failure. user_id and source_hash are
      // deliberately not named; neither is a link holder's business.
      //
      // One row per direction, plus at most one with no direction, which is
      // the shared synthesis a direction without its own falls back to.
      // testimonial_order carries ids and nothing else; the testimonials
      // themselves are served once, below, as the shared collection they are.
      supabase
        .from('profile_collective_impacts')
        .select('lens_id, summary, themes, testimonial_order, generated_at')
        .eq('profile_id', profile.id),
      // What backs a skill up, per direction. References only: they are
      // resolved on the page against the evidence and testimonials above, so
      // anything withdrawn since they were written is simply not there to
      // resolve. A row with no lens_id predates the direction scope and is
      // deliberately not selected: proof belongs to one direction or to none.
      supabase
        .from('profile_skill_proofs')
        .select('lens_id, skill_label, proofs')
        .eq('profile_id', profile.id)
        .not('lens_id', 'is', null)
    ])

    let lenses = lensRes.data
    if (isMissingColumnError(lensRes.error)) {
      console.warn('[career-profile] profile_lenses is missing its profile columns, reading without them')
      const { data: baseLenses } = await supabase
        .from('profile_lenses')
        .select(LENS_BASE)
        .eq('profile_id', profile.id)
        .eq('status', 'active')
        .order('sort_order', { ascending: true })
      lenses = baseLenses
    } else if (lensRes.error) {
      console.error('[career-profile] Lens lookup failed:', lensRes.error)
      return Response.json({ error: 'PROFILE_LOAD_FAILED' }, { status: 500 })
    }

    // Everything reaching here is active now, so this ranks nothing in practice
    // and is kept as a floor: a row arriving in some other state through a path
    // this route does not know about sorts last rather than first. The order
    // that does the work is sort_order, which is the one the hub gave them.
    // Anything past the third is not shown.
    const orderRank = (lens) => (lens?.status === 'active' ? 0 : 1)
    const sortWeight = (lens) => (Number.isFinite(lens?.sort_order) ? lens.sort_order : Number.MAX_SAFE_INTEGER)

    const visibleLenses = (lenses || [])
      .slice()
      .sort((a, b) => {
        const byStatus = orderRank(a) - orderRank(b)
        if (byStatus !== 0) return byStatus
        const byOrder = sortWeight(a) - sortWeight(b)
        if (byOrder !== 0) return byOrder
        return String(a.created_at || '').localeCompare(String(b.created_at || ''))
      })
      .slice(0, LENS_DISPLAY_LIMIT)

    // ---- LENS RESUMES ----
    // One query for all of them rather than one per lens.
    const lensResumeIds = [...new Set(visibleLenses.map(l => l.core_resume_id).filter(Boolean))]
    let lensResumes = {}
    if (lensResumeIds.length > 0) {
      const { data: rows, error: lensResumeError } = await supabase
        .from('resumes')
        .select('id, display_name, resume_data')
        .in('id', lensResumeIds)
        .eq('user_id', profile.user_id)
        .eq('is_active', true)

      if (lensResumeError) {
        // The page falls back to the core resume for these lenses, which is the
        // right content, just not the lens-specific cut of it.
        console.error('[career-profile] Lens resume lookup failed (non-fatal):', lensResumeError)
      } else {
        lensResumes = Object.fromEntries((rows || []).map(r => [r.id, r]))
      }
    }

    // Neither of these is worth failing the page over. A profile with no
    // testimonials and no evidence is a normal profile; it renders fewer
    // sections, which is exactly what an empty section is supposed to do.
    if (testimonialRes.error) {
      console.error('[career-profile] Testimonial lookup failed (non-fatal):', testimonialRes.error)
    }
    if (evidenceRes.error) {
      console.error('[career-profile] Evidence lookup failed (non-fatal):', evidenceRes.error)
    }
    const testimonials = testimonialRes.error ? [] : (testimonialRes.data || [])

    // The canonical items, sent once. An item that needs a file carries no
    // path, only the fact that there is one to ask for.
    //
    // Eligible, at this point, means only that the row itself is fit to be
    // shown. Whether anything on this profile actually shows it is settled
    // below, and an item nothing shows does not go in the payload.
    const eligibleEvidence = (evidenceRes.error ? [] : (evidenceRes.data || [])).map(item => ({
      id: item.id,
      family: item.family,
      evidence_type: item.evidence_type || item.kind || null,
      media_class: item.media_class,
      title: item.title,
      description: item.description,
      organization: item.organization,
      date_label: item.date_label,
      source_type: item.source_type,
      // Only ever a safe external address. The column is constrained, and this
      // is the second gate: a row written before that constraint existed is
      // not going to be handed to a browser here.
      url: SAFE_URL.test(String(item.url || '')) ? item.url : null,
      provider: item.provider,
      embed_url: SAFE_URL.test(String(item.embed_url || '')) ? item.embed_url : null,
      has_file: item.source_type === 'upload',
      // The same shape as the file itself: the fact of it, never the path.
      // The Portfolio asks the evidence media route for a signed thumbnail by
      // id, and that route decides for itself whether this direction may show
      // it before it signs anything.
      has_thumbnail: Boolean(item.thumbnail_path),
      // Written by the browser at upload and stored as a whole number of
      // seconds. Only ever used to label a video mat; a row without one gets
      // no badge rather than a badge reading zero.
      duration_seconds: Number.isFinite(item.duration_seconds) ? item.duration_seconds : null,
      sort_order: item.sort_order
    }))

    // A placement is only worth sending if it resolves: the item has to be one
    // of the eligible ones above, and the direction has to be one this profile
    // actually shows. Anything else is dropped rather than served and filtered
    // on the page.
    if (placementRes?.error && placementRes.error.code !== '42P01') {
      console.error('[career-profile] Evidence placement lookup failed (non-fatal):', placementRes.error)
    }
    // ---- PLACEMENTS, BEFORE AND AFTER THE MIGRATION ----
    //
    // `hidden` arrives with scripts/create-testimonial-placements.sql. Until
    // that has been run the column is not there and the select above fails,
    // which would take every piece of evidence off the page with it - the
    // eligibility rule below drops anything with no placement. So the query
    // is asked again without the column, and a database that has not caught
    // up renders exactly what it rendered before.
    let placementRows = placementRes.error ? [] : (placementRes.data || [])
    if (isMissingColumnError(placementRes.error)) {
      console.warn(
        '[career-profile] profile_evidence_placements has no hidden column, reading without it. ' +
        'Has scripts/create-testimonial-placements.sql been run?'
      )
      const { data: base } = await supabase
        .from('profile_evidence_placements')
        .select('evidence_id, lens_id, sort_order, featured')
        .eq('profile_id', profile.id)
        .order('sort_order', { ascending: true })
      placementRows = base || []
    } else if (placementRes.error) {
      console.error('[career-profile] Placement lookup failed (non-fatal):', placementRes.error)
    }

    const byOrderT = (a, b) => a.sort_order - b.sort_order
    const evidencePlacements = {}
    const evidenceShared = []
    {
      const eligibleIds = new Set(eligibleEvidence.map(item => item.id))
      const shownLensIds = new Set(visibleLenses.map(lens => lens.id))
      const rows = placementRows
      for (const row of rows) {
        if (!eligibleIds.has(row.evidence_id)) continue
        // Hidden is the owner having taken this off this direction. It is not
        // a deletion and the row is still here, but nothing about it belongs
        // in a payload a reader gets.
        if (row.hidden === true) continue
        const place = {
          evidence_id: row.evidence_id,
          sort_order: row.sort_order ?? 0,
          featured: row.featured === true
        }
        if (row.lens_id === null) { evidenceShared.push(place); continue }
        if (!shownLensIds.has(row.lens_id)) continue
        if (!evidencePlacements[row.lens_id]) evidencePlacements[row.lens_id] = []
        evidencePlacements[row.lens_id].push(place)
      }
      const byOrder = (a, b) => a.sort_order - b.sort_order
      evidenceShared.sort(byOrder)
      for (const list of Object.values(evidencePlacements)) list.sort(byOrder)
    }

    // ---- WHICH TESTIMONIALS EACH DIRECTION SHOWS ----
    //
    // The same fallback shape as evidence: a direction's own list if it has
    // one, the shared layer if it does not. Ids and positions only - the
    // words themselves travel once, in `testimonials` below.
    //
    // A profile whose database has not had the placement migration run yet
    // gets empty objects here, and the page falls back to the behaviour it
    // has always had: every published testimonial on every direction, in
    // whatever order the synthesis suggested.
    const testimonialPlacements = {}
    // Ids the shared layer has been told to hide. A filter and nothing more:
    // the shared layer never orders the page.
    const testimonialHidden = []
    {
      if (testimonialPlacementRes?.error) {
        console.error(
          '[career-profile] Testimonial placement lookup failed (non-fatal). ' +
          'Has scripts/create-testimonial-placements.sql been run?',
          testimonialPlacementRes.error
        )
      }
      const shownLensIds = new Set(visibleLenses.map(lens => lens.id))
      const rows = testimonialPlacementRes?.error ? [] : (testimonialPlacementRes?.data || [])
      for (const row of rows) {
        // THE SHARED LAYER DOES NOT ORDER THE PAGE.
        //
        // Every testimonial sits in it - that is what the backfill wrote, and
        // it is what they all effectively were before there was a table. If
        // it were read as a running order it would replace the synthesis's
        // ranking the moment the migration ran, and the whole point of that
        // backfill was that running it changes nothing anybody can see.
        //
        // So only a direction's own list is an arrangement. The shared layer
        // contributes one thing: an item hidden there is hidden everywhere,
        // which is a filter and never a position.
        if (row.lens_id === null) {
          if (row.hidden === true) testimonialHidden.push(row.testimonial_id)
          continue
        }
        // Hidden is the owner having taken this off this direction. The row
        // survives so it can be put back where it was; nothing about it
        // belongs in a payload a reader gets.
        if (row.hidden === true) continue
        if (!shownLensIds.has(row.lens_id)) continue
        if (!testimonialPlacements[row.lens_id]) testimonialPlacements[row.lens_id] = []
        testimonialPlacements[row.lens_id].push({
          testimonial_id: row.testimonial_id,
          sort_order: row.sort_order ?? 0
        })
      }
      for (const list of Object.values(testimonialPlacements)) list.sort(byOrderT)
    }

    // Only what something on this profile actually shows. An item that is
    // public, published and undeleted but placed in no visible direction and
    // not in the shared layer is a row the owner has not put anywhere - its
    // title, its description and the fact that it exists are all still private,
    // and none of it has any business in a payload anyone can read.
    const placedEvidenceIds = new Set([
      ...evidenceShared.map(place => place.evidence_id),
      ...Object.values(evidencePlacements).flatMap(list => list.map(place => place.evidence_id))
    ])
    const evidence = eligibleEvidence.filter(item => placedEvidenceIds.has(item.id))

    // A missing table (42P01) reads the same as no row: the section is simply
    // not there yet. Worth naming, because this table is newer than the rest
    // and a deployment that has not run its migration still serves the page.
    if (impactRes.error && impactRes.error.code !== '42P01') {
      console.error('[career-profile] Collective impact lookup failed (non-fatal):', impactRes.error)
    }

    // Grouped by direction, the way skill proof is, so the page can only ever
    // hand one direction's reading to the section. A row for a direction this
    // profile does not show is dropped rather than shipped.
    //
    // The row with no direction stays separate as `collectiveImpact`: it is
    // the shared synthesis, it is what every profile that predates the
    // direction scope already has, and it is the first fallback for a
    // direction that has not been regenerated yet.
    const impactRows = impactRes.error ? [] : (impactRes.data || [])
    const shape = (row) => row && ({
      summary: row.summary,
      themes: row.themes,
      testimonialOrder: Array.isArray(row.testimonial_order) ? row.testimonial_order : [],
      generated_at: row.generated_at
    })

    const collectiveImpact = shape(impactRows.find(row => !row.lens_id)) || null
    const collectiveImpacts = {}
    {
      const shownLensIds = new Set(visibleLenses.map(lens => lens.id))
      for (const row of impactRows) {
        if (!row.lens_id || !shownLensIds.has(row.lens_id)) continue
        collectiveImpacts[row.lens_id] = shape(row)
      }
    }

    // A profile that predates the table renders without proof, which is a
    // normal profile rather than a failure.
    if (skillProofRes.error && skillProofRes.error.code !== '42P01') {
      console.error('[career-profile] Skill proof lookup failed (non-fatal):', skillProofRes.error)
    }
    // Grouped by direction, so the page can only ever hand one direction's
    // proof to the section. Nothing merges across directions and there is no
    // fallback to another direction's rows: a direction with no proof gets an
    // empty list, which renders every skill plain.
    const skillProofs = {}
    if (!skillProofRes.error) {
      // Only the directions this profile actually shows. A lens the page will
      // never render has no business shipping its proof to the visitor.
      const visibleLensIds = new Set(visibleLenses.map(lens => lens.id))
      for (const row of skillProofRes.data || []) {
        if (!visibleLensIds.has(row.lens_id)) continue
        if (!skillProofs[row.lens_id]) skillProofs[row.lens_id] = []
        skillProofs[row.lens_id].push({ skill_label: row.skill_label, proofs: row.proofs })
      }
    }

    const coreResume = (coreRes.data || [])[0] || null

    // Experience, certifications and education follow the rule the rest of the
    // page follows: the lens's own resume once it has been built, the priority
    // core until then. Resolved here so the page reads one shape rather than
    // repeating the lookup per section.
    const sectionsFrom = (resumeData) => ({
      experience: Array.isArray(resumeData?.experience) ? resumeData.experience : [],
      certifications: Array.isArray(resumeData?.certifications) ? resumeData.certifications : [],
      education: Array.isArray(resumeData?.education) ? resumeData.education : []
    })
    const resumeSections = {
      byLens: Object.fromEntries(
        visibleLenses
          .filter(lens => lens.core_resume_id && lensResumes[lens.core_resume_id])
          .map(lens => [lens.id, sectionsFrom(lensResumes[lens.core_resume_id].resume_data)])
      ),
      fallback: sectionsFrom(coreResume?.resume_data)
    }

    // A profile with no lenses is still a profile. The priority core stands in
    // as the default view so the page has a name, a line about the person, and a
    // score rather than rendering empty.
    const fallback = visibleLenses.length === 0 && coreResume
      ? {
          name: coreResume.display_name || null,
          headline: coreResume.resume_data?.summary || null,
          score: coreResume.current_score ?? null
        }
      : null

    // Whether this profile offers the recruiter tools. A boolean and nothing
    // more: no tier name, no billing state, and in particular no "free" - a
    // public page should not tell a visitor what its owner declined to buy.
    const recruiterToolsEnabled = isEntitledTier(personRes.data?.subscription_tier)

    // ---- WHICH ADDRESS THE CONTACT BUTTON OPENS ----
    //
    // Three states on one column, and the difference between two of them is
    // the whole behaviour:
    //
    //   null        never set. The account address stands in, so a profile
    //               somebody has just published can be answered without their
    //               having found a settings drawer first.
    //   ''          cleared on purpose. No button. This is the only way to
    //               switch it off, and it is something the owner has to do.
    //   an address  the owner's own choice, which wins over both.
    //
    // A missing column is a fourth case and is not one of the three: it means
    // the reduced select above ran and this column was never read, so there is
    // nothing to fall back from and the button is withheld. Testing for null
    // rather than for falsiness is what keeps that apart from a cleared field.
    const storedContact = profile.contact_email
    const contactEmail = storedContact === null
      ? (personRes.data?.email || null)
      : (storedContact || null)

    return Response.json({
      isOwner,
      recruiterToolsEnabled,
      profile: {
        slug: profile.slug,
        template: profile.template ?? null,
        color_mode: profile.color_mode ?? null,
        accent: profile.accent ?? null,
        imow_text: profile.imow_text ?? null,
        imow_type: profile.imow_type ?? null,
        // Whether there is a video, never where it is. The path is a location
        // in a private bucket and is not a link holder's business; the player
        // asks the signing route for a URL by slug, and that route checks
        // publication again before it signs anything.
        imow_has_video: Boolean(profile.imow_video_path),
        // The one field on this table that is somebody's address rather than a
        // styling choice, so it is the one field with a condition on it. Sent
        // only for a published profile, and only to its owner otherwise: a
        // draft profile shared by link is not a decision to publish an email.
        // On the reduced select above the column is absent, which reads as
        // undefined and withholds it, which is the right way for this to fail.
        contact_email:
          (profile.is_published === true || isOwner) ? contactEmail : null
      },
      person: {
        displayName: personRes.data?.display_name || coreResume?.resume_data?.fullName || null
      },
      careerContext: {
        target_roles: contextRes.data?.target_roles || [],
        current_lens_name: contextRes.data?.current_lens_name || null
      },
      lenses: visibleLenses,
      fallback,
      coreResume,
      lensResumes,
      resumeSections,
      testimonials,
      evidence,
      evidencePlacements,
      testimonialPlacements,
      testimonialHidden,
      evidenceShared,
      collectiveImpact,
      collectiveImpacts,
      skillProofs
    })

  } catch (error) {
    return apiError(error, "We couldn't load this profile. Please try again.")
  }
}
