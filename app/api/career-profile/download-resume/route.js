import React from 'react'
import path from 'path'
import { renderToBuffer, Font } from '@react-pdf/renderer'
import { createClient } from '@supabase/supabase-js'

import ResumePDFCurrent from '../../../templates/pdf/ResumePDF-Current'
import ResumePDFCommand from '../../../templates/pdf/ResumePDF-Command'
import ResumePDFCrisp from '../../../templates/pdf/ResumePDF-Crisp'
import ResumePDFEdge from '../../../templates/pdf/ResumePDF-Edge'
import ResumePDFPrestige from '../../../templates/pdf/ResumePDF-Prestige'
import ResumePDFSharp from '../../../templates/pdf/ResumePDF-Sharp'
import ResumePDFSignature from '../../../templates/pdf/ResumePDF-Signature'
import ResumePDFVibe from '../../../templates/pdf/ResumePDF-Vibe'

// ============================================================================
// POST /api/career-profile/download-resume
//
// The Download Resume button on a public Career Profile.
//
// No auth, by design. The profile is a page anybody holding the link can read,
// and the resume is the thing it exists to hand over; asking a recruiter to
// sign in to Hire Power to read it would be asking them to join a product to
// look at a candidate. What replaces auth is that nothing here is chosen by
// the caller.
//
// WHAT THE CALLER MAY ASK FOR
// A slug, and optionally which direction they are reading. That is all. The
// resume is resolved from those on this side: the direction's own core where
// it has one, the priority core otherwise. A resume id is never accepted,
// because the service role can read every resume in the database and an id
// from the browser would be the only thing standing between a stranger and
// somebody else's.
//
// PUBLISHED ONLY, TIER-BLIND
// This checks is_published and stops there. It deliberately does not use
// openGate, which additionally requires Pro: that gate belongs to the
// recruiter tools, which are a paid feature. Downloading the resume is not -
// it is what the page is for, on every published profile.
//
// EXCEPT FOR THE OWNER
// The one caller allowed past an unpublished profile is the person it belongs
// to, and only when they send their own token. The editor renders the same
// document component the public page does, so an owner pressing Download on a
// draft was reaching this route as a stranger and being told their own profile
// did not exist. An Authorization header is therefore read if one is sent and
// ignored if it is not: the anonymous path is unchanged, still published-only,
// and an unpublished slug is still indistinguishable from one nobody has taken.
// ============================================================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ---------------------------------------------------------------------------
// Fonts
//
// The same four families the resume editor's own PDF route registers, loaded
// from local files at module load so a render never waits on the network. The
// registration is repeated here rather than shared because extracting it would
// mean editing the route the whole app already downloads through, and this
// change has no business touching that.
// ---------------------------------------------------------------------------
const fontsDir = path.join(process.cwd(), 'public', 'fonts')

Font.register({
  family: 'Lato',
  fonts: [
    { src: path.join(fontsDir, 'Lato-Regular.ttf'), fontWeight: 400, fontStyle: 'normal' },
    { src: path.join(fontsDir, 'Lato-Bold.ttf'), fontWeight: 700, fontStyle: 'normal' },
    { src: path.join(fontsDir, 'Lato-Italic.ttf'), fontWeight: 400, fontStyle: 'italic' },
    { src: path.join(fontsDir, 'Lato-BoldItalic.ttf'), fontWeight: 700, fontStyle: 'italic' }
  ]
})

Font.register({
  family: 'EB Garamond',
  fonts: [
    { src: path.join(fontsDir, 'EBGaramond-Regular.ttf'), fontWeight: 400, fontStyle: 'normal' },
    { src: path.join(fontsDir, 'EBGaramond-Bold.ttf'), fontWeight: 700, fontStyle: 'normal' },
    { src: path.join(fontsDir, 'EBGaramond-Italic.ttf'), fontWeight: 400, fontStyle: 'italic' },
    { src: path.join(fontsDir, 'EBGaramond-BoldItalic.ttf'), fontWeight: 700, fontStyle: 'italic' }
  ]
})

Font.register({
  family: 'Open Sans',
  fonts: [
    { src: path.join(fontsDir, 'OpenSans-Regular.ttf'), fontWeight: 400, fontStyle: 'normal' },
    { src: path.join(fontsDir, 'OpenSans-Bold.ttf'), fontWeight: 700, fontStyle: 'normal' },
    { src: path.join(fontsDir, 'OpenSans-Italic.ttf'), fontWeight: 400, fontStyle: 'italic' },
    { src: path.join(fontsDir, 'OpenSans-BoldItalic.ttf'), fontWeight: 700, fontStyle: 'italic' }
  ]
})

Font.register({
  family: 'Source Serif 4',
  fonts: [
    { src: path.join(fontsDir, 'SourceSerif4-Regular.ttf'), fontWeight: 400, fontStyle: 'normal' },
    { src: path.join(fontsDir, 'SourceSerif4-Bold.ttf'), fontWeight: 700, fontStyle: 'normal' },
    { src: path.join(fontsDir, 'SourceSerif4-Italic.ttf'), fontWeight: 400, fontStyle: 'italic' },
    { src: path.join(fontsDir, 'SourceSerif4-BoldItalic.ttf'), fontWeight: 700, fontStyle: 'italic' }
  ]
})

// Never acceptable in a resume, here for the same reason as everywhere else.
Font.registerHyphenationCallback((word) => [word])

// ---------------------------------------------------------------------------
// Template and type
//
// Mirrored from the resume editor rather than reinvented, so the file a
// recruiter downloads is the file the owner sees. The editor reads
// `template_id || 'current'`, capitalises it for the renderer, and falls back
// to Lato for any font it does not recognise; both of those fallbacks are load
// bearing today, because core resumes store no template_id at all and the
// stored font_family is often a name the renderer has never had.
// ---------------------------------------------------------------------------
const TEMPLATES = {
  Current: ResumePDFCurrent,
  Command: ResumePDFCommand,
  Crisp: ResumePDFCrisp,
  Edge: ResumePDFEdge,
  Prestige: ResumePDFPrestige,
  Sharp: ResumePDFSharp,
  Signature: ResumePDFSignature,
  Vibe: ResumePDFVibe
}

const TEMPLATE_FONTS = {
  crisp: 'Source Serif 4',
  sharp: 'Open Sans',
  current: 'Lato',
  command: 'Lato',
  prestige: 'EB Garamond',
  signature: 'EB Garamond',
  vibe: 'Lato',
  edge: 'Open Sans'
}

const RENDERABLE_FONTS = new Set(['Lato', 'EB Garamond', 'Open Sans', 'Source Serif 4', 'Helvetica'])

// The same shape the Hiring Brief's filename takes, for the same reasons: a
// name out of somebody's resume goes into a Content-Disposition header, so it
// is reduced to letters, digits and hyphens before it gets there.
const NAME_CAP = 60

function safeName(text, fallback) {
  const slug = String(text || '')
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, NAME_CAP)
    .replace(/-+$/g, '')
  return slug || fallback
}

export async function POST(request) {
  try {
    let body
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'Invalid request.', code: 'BAD_REQUEST' }, { status: 400 })
    }

    const slug = typeof body?.slug === 'string' ? body.slug : null
    const lensId = typeof body?.lens_id === 'string' ? body.lens_id : null
    if (!slug) {
      return Response.json({ error: 'Profile not found.', code: 'NOT_FOUND' }, { status: 404 })
    }

    // ---- The gate: published, or the owner ----
    const { data: profile, error: profileError } = await supabase
      .from('career_profiles')
      .select('id, user_id, is_published')
      .eq('slug', slug)
      .maybeSingle()

    if (profileError) {
      console.error('[download-resume] Profile lookup failed:', profileError)
      return Response.json({ error: 'Something went wrong.', code: 'LOOKUP_FAILED' }, { status: 500 })
    }

    // Asked only when a token was sent, and only to widen what that one caller
    // may read. A bad token is not an error here - it leaves isOwner false and
    // the published-only rule applies, exactly as it does to somebody who sent
    // nothing at all.
    let isOwner = false
    const authHeader = request.headers.get('authorization')
    if (profile && authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user } } = await supabase.auth.getUser(token)
      isOwner = Boolean(user && user.id === profile.user_id)
    }

    // An unpublished profile is indistinguishable from one that does not
    // exist, which is what stops this being a way to test whether a slug is
    // taken.
    if (!profile || (profile.is_published !== true && !isOwner)) {
      return Response.json({ error: 'Profile not found.', code: 'NOT_FOUND' }, { status: 404 })
    }

    // ---- Which resume ----
    // The direction's own core first, if the caller named a direction that
    // belongs to this profile and that direction has built one. Ownership is
    // checked on both hops: the lens must be this profile's, and the resume
    // must be this profile owner's.
    let resume = null

    if (lensId) {
      const { data: lens } = await supabase
        .from('profile_lenses')
        .select('id, core_resume_id')
        .eq('id', lensId)
        .eq('profile_id', profile.id)
        .maybeSingle()

      if (lens?.core_resume_id) {
        const { data: lensResume } = await supabase
          .from('resumes')
          .select('id, resume_data, template_id, font_family, font_size, spacing, accent_color, date_format')
          .eq('id', lens.core_resume_id)
          .eq('user_id', profile.user_id)
          .eq('is_active', true)
          .maybeSingle()
        resume = lensResume || null
      }
    }

    // The priority core otherwise, resolved exactly the way the profile page
    // resolves it: the flagged one when there is one, the newest when there is
    // not, because a strict flag filter returns nothing for an account that
    // predates the column.
    if (!resume) {
      const { data: cores, error: coreError } = await supabase
        .from('resumes')
        .select('id, resume_data, template_id, font_family, font_size, spacing, accent_color, date_format')
        .eq('user_id', profile.user_id)
        .eq('resume_type', 'core')
        .eq('is_active', true)
        .order('is_priority_core', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)

      if (coreError) {
        console.error('[download-resume] Resume lookup failed:', coreError)
        return Response.json({ error: 'Something went wrong.', code: 'LOOKUP_FAILED' }, { status: 500 })
      }
      resume = cores?.[0] || null
    }

    if (!resume?.resume_data) {
      return Response.json(
        { error: 'This profile has no resume to download yet.', code: 'NO_RESUME' },
        { status: 404 }
      )
    }

    // ---- Render ----
    const templateKey = resume.template_id || 'current'
    const templateName = templateKey.charAt(0).toUpperCase() + templateKey.slice(1)
    const Template = TEMPLATES[templateName] || ResumePDFCurrent

    const storedFont = resume.font_family || TEMPLATE_FONTS[templateKey] || 'Lato'
    const font = RENDERABLE_FONTS.has(storedFont) ? storedFont : 'Lato'

    const pdf = await renderToBuffer(
      React.createElement(Template, {
        resumeData: resume.resume_data,
        font,
        fontSize: resume.font_size || 11,
        spacing: resume.spacing || 1,
        accentColor: resume.accent_color || '#5b4fcf',
        dateFormat: resume.date_format || 'short'
      })
    )

    const fileName = `${safeName(resume.resume_data?.fullName, 'Resume')}-Resume.pdf`

    return new Response(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition':
          `attachment; filename="Resume.pdf"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        // Somebody's resume, built per request. No shared cache should hold it.
        'Cache-Control': 'private, no-store'
      }
    })
  } catch (error) {
    console.error('[download-resume] Render failed:', error)
    return Response.json(
      { error: "We couldn't build that PDF. Please try again.", code: 'RENDER_FAILED' },
      { status: 500 }
    )
  }
}
