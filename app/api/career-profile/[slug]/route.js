import { createClient } from '@supabase/supabase-js'
import { apiError } from '@/lib/apiError'
import { canUseProTools } from '@/lib/tiers'
import { lensesShownBy } from '../_lib/directions'
import { onDirection, rowsForDirection } from '@/app/p/[slug]/_lib/profileData'
import { createHash } from 'crypto'

// ============================================================================
// GET /api/career-profile/[slug]
// Public read for the Career Profile page. No authentication: the slug is the
// only key, which is the point, and it is also the whole authorization boundary.
//
// The service role bypasses RLS, so every select here names its columns. A
// `select('*')` on any of these tables would publish whatever gets added to it
// next, to anyone holding a link.
//
// Naming a column is not enough for resume_data, which is one jsonb blob
// holding the contact block, the referees and the builder's own working notes.
// That one is rebuilt field by field on the way out - see publicResume and
// publicRole below - so the payload is the page's needs rather than the
// record's contents. Everything else that leaves this route goes through the
// same kind of constructor: publicLens for a direction, the eligibleEvidence
// map for an item, and the explicit object in the response for the profile.
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

const PROFILE_BASE = 'id, user_id, slug, is_published'
const PROFILE_FULL = `${PROFILE_BASE}, template, color_mode, accent, imow_text, imow_type, imow_video_path, contact_email`
// A third rung, and the reason it is its own rung rather than three more
// columns on PROFILE_FULL: the retry below drops everything PROFILE_FULL adds,
// so folding these in would mean a database without the video shape migration
// losing the template, the accent and In My Own Words along with it. Tried
// first, then PROFILE_FULL, then PROFILE_BASE, so each missing generation of
// columns costs only itself.
const PROFILE_SHAPE = `${PROFILE_FULL}, imow_video_width, imow_video_height, imow_poster_path, contact_enabled`

// sort_order and created_at are read to order the directions and are not sent;
// see publicLens below. evidence_summary and ready_for_next are not read at
// all - the first is a note the direction detector writes to itself, and the
// second is generated prose the Profile deliberately never renders - so
// neither is selected either.
const LENS_BASE = 'id, name, slug, sort_order, status, core_resume_id, created_at'
// previous_slugs rides with LENS_FULL rather than LENS_BASE on purpose.
// LENS_BASE is the retry for a database that has not caught up, and putting a
// newer column in it would make the fallback fail for the same reason the
// first attempt did.
const LENS_FULL = `${LENS_BASE}, headline, bio, proof_points, ready_tags, skill_emphasis, previous_slugs`

// The only schemes that may reach a browser from this route. The column is
// constrained to the same thing, so this is the second lock rather than the
// first: a row written before that constraint existed still cannot get out.
const SAFE_URL = /^https?:\/\//i

// ---------------------------------------------------------------------------
// WHAT A RESUME IS ALLOWED TO BECOME ON ITS WAY TO A BROWSER
//
// resume_data is one jsonb blob and it is the private half of this product.
// Alongside the work history it holds the contact block - email, phone,
// linkedin, portfolio - the referees, and the coaching artefacts the builder
// leaves behind it: _originalTranscript, _rewrittenResume, _analysisResults,
// _remainingGaps. The Profile renders none of that, and until now the whole
// blob travelled anyway, twice: once as coreResume and again per direction in
// lensResumes. Anyone holding a published link could read all of it in the
// network tab without the page ever drawing a pixel of it.
//
// So nothing is passed through. Each of these builds a new object out of the
// fields the page actually reads, and a field added to resume_data next year
// is absent from the payload until somebody adds it here on purpose. That is
// the whole point of writing it as a constructor rather than as a deny-list:
// a deny-list is correct only until the next migration.
// ---------------------------------------------------------------------------

// Strings and numbers pass; everything else becomes null. Dates are stored as
// either, and a date that arrives as an object is not a date this renders.
const scalar = (value) =>
  (typeof value === 'string' || typeof value === 'number') ? value : null

const text = (value) => (typeof value === 'string' ? value : null)

// One role, as Selected experience and the skill-proof resolver read it.
//
// Bullets are mapped rather than filtered. A stored skill proof points at
// `experience[i].bullets[j]`, so dropping a malformed entry would slide every
// bullet after it one place and quietly re-point somebody's proof at the
// wrong sentence. An unusable entry becomes an empty string, which the
// renderer already drops and the proof check already fails to match.
const publicRole = (role) => ({
  title: text(role?.title),
  company: text(role?.company),
  summary: text(role?.summary),
  bullets: (Array.isArray(role?.bullets)
    ? role.bullets
    : Array.isArray(role?.achievements) ? role.achievements : []
  ).map(one => (typeof one === 'string' ? one : '')),
  // Both spellings collapse to one, because dateRangeFor reads both and the
  // browser has no reason to know which one this row happens to use.
  startDate: scalar(role?.startDate ?? role?.start_date),
  endDate: scalar(role?.endDate ?? role?.end_date),
  current: role?.current === true || role?.is_current === true,
  // The single combined string some older rows carry instead of two dates.
  dates: text(role?.dates ?? role?.date ?? role?.period)
})

const publicRoles = (list) => (Array.isArray(list) ? list : []).map(publicRole)

// Skill labels, in whichever of the two stored shapes they arrived in.
//
// The shape is preserved rather than normalised: groupSkills re-sorts an
// object by size and leaves an array in its written order, so turning one
// into the other here would silently reorder the clusters on the page.
const publicSkillCategories = (categories) => {
  const labels = (value) =>
    (Array.isArray(value) ? value : [value]).filter(one => typeof one === 'string')

  if (Array.isArray(categories)) {
    return categories.map(group => ({ name: text(group?.name), skills: labels(group?.skills) }))
  }
  if (categories && typeof categories === 'object') {
    return Object.fromEntries(
      Object.entries(categories).map(([name, value]) => [name, labels(value)])
    )
  }
  return null
}

// What the page reads out of a resume once the experience has been resolved
// separately: the skills it clusters, and the one line of the contact block it
// prints. Nothing else, and in particular no name, no email and no phone - the
// name on the page comes from the account's display name, which is already
// sent, and the rest is how somebody is reached, which is the contact button's
// job and is gated separately.
const publicResume = (row) => row && ({
  resume_data: {
    location: text(row.resume_data?.location),
    skills: (Array.isArray(row.resume_data?.skills) ? row.resume_data.skills : [])
      .filter(one => typeof one === 'string'),
    skillsCategories: publicSkillCategories(row.resume_data?.skillsCategories)
  }
})

// One direction, as the page renders it. sort_order and created_at did the
// ordering above and stay here; evidence_summary and ready_for_next are not
// selected at all.
const publicLens = (lens) => ({
  id: lens.id,
  name: lens.name,
  slug: lens.slug,
  status: lens.status,
  core_resume_id: lens.core_resume_id,
  headline: lens.headline ?? null,
  bio: lens.bio ?? null,
  proof_points: lens.proof_points ?? null,
  ready_tags: lens.ready_tags ?? null,
  skill_emphasis: lens.skill_emphasis ?? null,
  previous_slugs: lens.previous_slugs ?? null
})

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
      .select(PROFILE_SHAPE)
      .eq('slug', slug)
      .maybeSingle()

    if (isMissingColumnError(profileError)) {
      console.warn('[career-profile] career_profiles has no In My Own Words video shape columns; has scripts/add-imow-video-shape.sql been run?')
      ;({ data: profile, error: profileError } = await supabase
        .from('career_profiles')
        .select(PROFILE_FULL)
        .eq('slug', slug)
        .maybeSingle())
    }

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
        // display_name stands in as the page's name for a profile with no
        // directions; resume_data is cut down by publicResume before it is
        // sent. The id and the score used to come too and no longer do -
        // nothing on the page read either.
        .select('display_name, resume_data')
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
        .select('id, polished_text, recipient_name, recipient_title, relationship, placement_scope')
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
          'thumbnail_path, duration_seconds, placement_scope'
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
        .select('evidence_id, lens_id, sort_order, hidden')
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

    // ---- WHICH OF THEM THIS PAGE SHOWS ----
    //
    // The order, the ceiling and the plan, from _lib/directions - the same
    // function the resume download and the evidence media route ask, so a
    // direction this page has stopped showing cannot still be handing over
    // its resume and its files to a caller who kept the id.
    //
    // Free shows the primary direction and nothing else. Asked here, of the
    // tier, every time the page is read - not written onto the account when a
    // plan changes - so a profile is correct the moment the tier moves and
    // there is nothing to run at a downgrade and nothing to undo at an
    // upgrade. A tier edited by hand in the database behaves the same as one
    // Stripe moved, because neither of them is what this reads.
    //
    // This is the cut every other part of the payload is measured from:
    // everything below reads visibleLenses, so a direction dropped here takes
    // its resume, its evidence, its testimonials, its skill proof and its
    // headline out of the response with it. None of it reaches the browser.
    const visibleLenses = lensesShownBy(lenses, personRes.data?.subscription_tier)

    // ---- AND WHICH SECTIONS THIS PLAN PUTS ON THE PAGE ----
    //
    // The same shape as the cut above, one level up: evidence, the
    // portfolio, the testimonials and the Collective Impact synthesis are
    // part of Pro and Vault, so on a free profile they are not in this
    // response at all. Not hidden on the page - absent from it, the way a
    // direction lensesShownBy drops is absent.
    //
    // Asked of the tier on every read, for the same reason that one is:
    // nothing is written onto the account when a plan moves, so a profile
    // is correct the moment the tier changes and there is nothing to run
    // at a downgrade or undo at an upgrade. Nothing is deleted either -
    // every row stays where it is and comes back with the plan.
    //
    // ...EXCEPT FOR THE OWNER, AND ONLY FOR THEM
    // This endpoint is also what the management page reads, with the
    // owner's token, because the owner has to be shown everything they
    // hold in order to add to it. Preview is the same read, so Preview
    // cannot be told apart here and does its hiding on the page - see
    // hideProOnly in /career-profile. A link holder is never the owner,
    // so the public page is decided entirely here.
    const showsProSections = canUseProTools(personRes.data?.subscription_tier)
    const sendsProSections = showsProSections || isOwner

    // ---- LENS RESUMES ----
    // One query for all of them rather than one per lens.
    const lensResumeIds = [...new Set(visibleLenses.map(l => l.core_resume_id).filter(Boolean))]
    let lensResumes = {}
    if (lensResumeIds.length > 0) {
      const { data: rows, error: lensResumeError } = await supabase
        .from('resumes')
        // id is the key these are filed under, not something that is sent:
        // publicResume builds a new object and the key stays in the map.
        // display_name is not read for a lens resume and is not asked for.
        .select('id, resume_data')
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
      sort_order: item.sort_order,
      // Which directions this is on, before any row is consulted. 'all' means
      // every direction the profile shows; 'selected' means the ones it holds
      // a row for, and with no rows, none.
      placement_scope: item.placement_scope === 'selected' ? 'selected' : 'all'
    }))

    // A placement is only worth sending if it resolves: the item has to be one
    // of the eligible ones above, and the direction has to be one this profile
    // actually shows. Anything else is dropped rather than served and filtered
    // on the page.
    if (placementRes?.error && placementRes.error.code !== '42P01') {
      console.error('[career-profile] Evidence placement lookup failed (non-fatal):', placementRes.error)
    }
    if (placementRes?.error) {
      console.error('[career-profile] Placement lookup failed (non-fatal):', placementRes.error)
    }
    const placementRows = placementRes?.error ? [] : (placementRes?.data || [])

    const byOrderT = (a, b) => a.sort_order - b.sort_order

    // ---- WHERE EACH DIRECTION PUTS EACH ITEM ----
    //
    // A flat list rather than a map per direction, because the page no longer
    // looks a direction's list up and render it - it asks, item by item,
    // whether this direction shows that item, and the answer needs the rows
    // and the item's own scope together.
    //
    // HIDDEN ROWS TRAVEL NOW, which they did not before. They used to be
    // dropped on the way out, and that was safe while absence meant absence.
    // It is not safe any more: an item that says 'all' is on a direction
    // unless a row there says otherwise, so dropping the row that says
    // otherwise would put the item back on the page. What keeps a hidden item
    // out of a reader's payload is the eligibility rule below, which drops
    // anything no visible direction shows.
    const evidencePlacements = []
    {
      const eligibleIds = new Set(eligibleEvidence.map(item => item.id))
      const shownLensIds = new Set(visibleLenses.map(lens => lens.id))
      for (const row of placementRows) {
        if (!eligibleIds.has(row.evidence_id)) continue
        if (!row.lens_id || !shownLensIds.has(row.lens_id)) continue
        evidencePlacements.push({
          evidence_id: row.evidence_id,
          lens_id: row.lens_id,
          sort_order: row.sort_order ?? 0,
          hidden: row.hidden === true
        })
      }
      evidencePlacements.sort(byOrderT)
    }

    // ---- WHERE EACH DIRECTION PUTS EACH TESTIMONIAL ----
    //
    // The same shape as evidence, and for the same reason. There is no shared
    // layer to fall back to any more: a testimonial that says 'all' is on
    // every direction because it says so, not because nothing else was found.
    //
    // A direction with no rows still reads in the synthesis's own ranking.
    // That used to be the fallback branch; it is now simply the order an
    // unarranged direction has, which is the same thing said without a
    // fallback.
    const testimonialPlacements = []
    {
      if (testimonialPlacementRes?.error) {
        console.error(
          '[career-profile] Testimonial placement lookup failed (non-fatal):',
          testimonialPlacementRes.error
        )
      }
      const shownLensIds = new Set(visibleLenses.map(lens => lens.id))
      const rows = testimonialPlacementRes?.error ? [] : (testimonialPlacementRes?.data || [])
      for (const row of rows) {
        if (!row.lens_id || !shownLensIds.has(row.lens_id)) continue
        testimonialPlacements.push({
          testimonial_id: row.testimonial_id,
          lens_id: row.lens_id,
          sort_order: row.sort_order ?? 0,
          hidden: row.hidden === true
        })
      }
      testimonialPlacements.sort(byOrderT)
    }

    // Only what something on this profile actually shows. An item that is
    // public, published and undeleted but placed in no visible direction and
    // not in the shared layer is a row the owner has not put anywhere - its
    // title, its description and the fact that it exists are all still private,
    // and none of it has any business in a payload anyone can read.
    //
    // Asked through the same rule the page renders with, so an item in the
    // payload is exactly an item something on this profile shows. An 'all'
    // item holds no rows and is still shown; an 'all' item hidden on every
    // visible direction is shown by none of them and does not travel.
    // A profile with no visible direction still has a page, and it reads as
    // one direction nobody has arranged: no rows, so scope alone decides.
    // Without this an account that has turned every direction off would lose
    // its evidence section rather than show the items that are on all of them.
    const evidenceRowsByLens = visibleLenses.length
      ? visibleLenses.map(lens => rowsForDirection(evidencePlacements, lens.id, 'evidence_id'))
      : [new Map()]
    const evidence = eligibleEvidence.filter(item =>
      evidenceRowsByLens.some(rows => onDirection(item, rows))
    )

    // A missing table (42P01) reads the same as no row: the section is simply
    // not there yet. Worth naming, because this table is newer than the rest
    // and a deployment that has not run its migration still serves the page.
    if (impactRes.error && impactRes.error.code !== '42P01') {
      console.error('[career-profile] Collective impact lookup failed (non-fatal):', impactRes.error)
    }

    // One reading for the profile, which is the row with no direction on it.
    // There was briefly a row per direction and a map of them shipped
    // alongside this; the synthesis is written from every published
    // testimonial now, so the same paragraph is the true one on every
    // direction and there is nothing to group.
    const impactRows = impactRes.error ? [] : (impactRes.data || [])
    const shape = (row) => row && ({
      summary: row.summary,
      themes: row.themes,
      testimonialOrder: Array.isArray(row.testimonial_order) ? row.testimonial_order : [],
      generated_at: row.generated_at
    })

    const collectiveImpact = shape(impactRows.find(row => !row.lens_id)) || null

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

    // Experience follows the rule the rest of the page follows: the lens's own
    // resume once it has been built, the priority core until then. Resolved
    // here so the page reads one shape rather than repeating the lookup per
    // section, and shaped on the way out by publicRole.
    //
    // Certifications and education used to ride along here and no longer do.
    // Nothing renders them - a credential reaches the public profile as
    // curated evidence or not at all - so they were two lists of somebody's
    // record being published to make no difference to the page.
    const sectionsFrom = (resumeData) => ({ experience: publicRoles(resumeData?.experience) })
    const resumeSections = {
      byLens: Object.fromEntries(
        visibleLenses
          .filter(lens => lens.core_resume_id && lensResumes[lens.core_resume_id])
          .map(lens => [lens.id, sectionsFrom(lensResumes[lens.core_resume_id].resume_data)])
      ),
      fallback: sectionsFrom(coreResume?.resume_data)
    }

    // A profile with no lenses is still a profile. The priority core stands in
    // so the page has a name rather than rendering empty.
    //
    // The resume's own summary and its score used to come with it. Neither is
    // rendered: the headline falls back to the career context's target roles,
    // and nothing on a public profile has ever shown a score.
    const fallback = visibleLenses.length === 0 && coreResume
      ? { name: coreResume.display_name || null }
      : null

    // ---- WHICH HALF OF IN MY OWN WORDS THIS PROFILE SHOWS ----
    //
    // Read once, here, because four fields below depend on agreeing about it.
    // Asked of both columns rather than of the type alone: imow_type accepts
    // any string, so a row that says video without a file is a row that says
    // nothing.
    //
    // AND THE PLAN IS THE THIRD GUARD
    // The video is part of Pro and Vault. A free profile serves the
    // written version whatever imow_type says, and serves nothing at all
    // where nothing was ever written - which is what the two expressions
    // below already do for a profile that holds no video. The file stays
    // where it is and comes back with the plan.
    //
    // showsProSections, not sendsProSections: the owner is not excepted
    // here the way they are for the sections above, because the editor
    // reads In My Own Words off the management record rather than out of
    // this response. There is nothing for an exception to give them.
    const showsVideo = profile.imow_type === 'video'
      && Boolean(profile.imow_video_path)
      && showsProSections

    // A stored pixel count, or null. Bounded rather than trusted: the numbers
    // A stable, opaque token for whichever poster object is current. Twelve
    // hex characters is far more than enough to tell one path from the next,
    // and it is one-way, so publishing it publishes nothing.
    const posterVersion = (path) =>
      createHash('sha256').update(String(path)).digest('hex').slice(0, 12)

    // were read by a browser and the column may not exist at all yet.
    const shapeOf = (value) => {
      const n = Number(value)
      return Number.isInteger(n) && n > 0 && n <= 16384 ? n : null
    }

    // Whether this profile offers the recruiter tools. A boolean and nothing
    // more: no tier name, no billing state, and in particular no "free" - a
    // public page should not tell a visitor what its owner declined to buy.
    const recruiterToolsEnabled = canUseProTools(personRes.data?.subscription_tier)

    // ---- WHETHER THE CONTACT BUTTON IS THERE, AND WHICH ADDRESS IT OPENS
    //
    // Two columns, one question each, which is what they were split into:
    // contact_enabled says whether the owner wants the button at all, and
    // contact_email says which address it opens - their own, or empty for
    // the account address the page falls back to.
    //
    // They were one column with three states and the middle one meant both
    // things at once, so an owner could not switch the button off without
    // throwing away the address they had typed.
    //
    // `!== false`, not `=== true`: on a deployment whose column is not there
    // yet the field reads undefined, and the right answer then is the
    // behaviour every profile already had. A button that quietly disappears
    // is the worse way for this to fail.
    const contactOn = profile.contact_enabled !== false

    // Trimmed to nothing is nothing. The write route stores it trimmed, so
    // this is for rows that predate it.
    const ownAddress = String(profile.contact_email || '').trim()
    const contactEmail = contactOn
      ? (ownAddress || personRes.data?.email || null)
      : null

    return Response.json({
      isOwner,
      recruiterToolsEnabled,
      profile: {
        slug: profile.slug,
        template: profile.template ?? null,
        color_mode: profile.color_mode ?? null,
        accent: profile.accent ?? null,
        // ---- IN MY OWN WORDS: THE CHOSEN HALF, AND ONLY IT ----
        //
        // The section has two forms and the owner picks one. Both are stored
        // and neither write path ever clears the other, so a profile showing
        // the video still holds the words that were typed before it - and
        // those words are not this payload's business. A visitor is sent what
        // the page renders, which is one of the two.
        //
        // imow_type is the choice. It decides here rather than on the page,
        // so the half that is not showing is not in the response at all: a
        // recruiter opening the network tab on a profile that leads with a
        // video finds no paragraph, and one reading the paragraph finds no
        // evidence a video exists.
        //
        // Both guards are "and", never "or". The type column takes any string
        // and nothing guarantees a profile claiming video has a file, so
        // video means the type says so AND a path is there; text means the
        // type does not say video AND something was written.
        imow_text: showsVideo ? null : (profile.imow_text ?? null),
        imow_type: showsVideo ? 'video' : (profile.imow_text ? 'text' : null),
        // Whether there is a video, never where it is. The path is a location
        // in a private bucket and is not a link holder's business; the player
        // asks the signing route for a URL by slug, and that route checks
        // publication again before it signs anything.
        imow_has_video: showsVideo,
        // The shape it was recorded in, so the frame is the right size before
        // the file has loaded rather than a 16/9 box that resizes under the
        // reader. Null for a video uploaded before the column existed, and the
        // page falls back to 16/9 - which is what every one of those is.
        imow_video_width: showsVideo ? (shapeOf(profile.imow_video_width) ?? null) : null,
        imow_video_height: showsVideo ? (shapeOf(profile.imow_video_height) ?? null) : null,
        // The fact of a poster, never its path. Same rule as the video.
        imow_has_poster: showsVideo && Boolean(profile.imow_poster_path),
        // ---- WHICH POSTER, WITHOUT SAYING WHERE IT IS ----
        //
        // The card signs its own poster URL and had nothing to tell it when
        // that poster was replaced: slug, width and height do not move, and
        // imow_has_poster was already true. So it signed once on mount and
        // kept the old still until the page was reloaded.
        //
        // This is the thing that changes. A short digest of the path rather
        // than the path, because the rule two fields up holds - a link holder
        // is told whether there is a poster, never where it is - and a hash is
        // not a location. It is derived rather than counted so it needs no
        // column of its own and cannot drift from what is actually stored.
        imow_poster_version: showsVideo && profile.imow_poster_path
          ? posterVersion(profile.imow_poster_path)
          : null,
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
      lenses: visibleLenses.map(publicLens),
      fallback,
      // Both shaped, both for the same two readings: the skills the page
      // clusters, and whether a resume exists at all - which is what the
      // download button and its per-direction menu are asking. The id each of
      // these used to carry went with them; the one thing that needed it was
      // the owner's "Edit in Resume Writer" link, which now reads
      // primaryCoreResumeId off the management record instead.
      coreResume: publicResume(coreResume),
      lensResumes: Object.fromEntries(
        Object.entries(lensResumes).map(([id, row]) => [id, publicResume(row)])
      ),
      resumeSections,
      // The five that the plan decides. Emptied rather than omitted: the
      // page reads all five and an absent key and an empty one are the
      // same thing to it, while a shape that changes with the plan is one
      // more thing for a reader of this route to hold in their head.
      testimonials: sendsProSections ? testimonials : [],
      evidence: sendsProSections ? evidence : [],
      evidencePlacements: sendsProSections ? evidencePlacements : [],
      testimonialPlacements: sendsProSections ? testimonialPlacements : [],
      collectiveImpact: sendsProSections ? collectiveImpact : null,
      skillProofs
    })

  } catch (error) {
    return apiError(error, "We couldn't load this profile. Please try again.")
  }
}
