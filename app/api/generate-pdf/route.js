import React from 'react'
import { renderToBuffer, Font } from '@react-pdf/renderer'
import { createClient } from '@supabase/supabase-js'
import path from 'path'
import { apiError } from '@/lib/apiError'
import ResumePDFCurrent from '../../templates/pdf/ResumePDF-Current'
import ResumePDFCommand from '../../templates/pdf/ResumePDF-Command'
import ResumePDFCrisp from '../../templates/pdf/ResumePDF-Crisp'
import ResumePDFEdge from '../../templates/pdf/ResumePDF-Edge'
import ResumePDFPrestige from '../../templates/pdf/ResumePDF-Prestige'
import ResumePDFSharp from '../../templates/pdf/ResumePDF-Sharp'
import ResumePDFSignature from '../../templates/pdf/ResumePDF-Signature'
import ResumePDFVibe from '../../templates/pdf/ResumePDF-Vibe'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ─────────────────────────────────────────────
// FONT REGISTRATION
// Loads from local TTF files in public/fonts/
// Registered once at module load — no network calls, no runtime failures
// ─────────────────────────────────────────────
const fontsDir = path.join(process.cwd(), 'public', 'fonts')

Font.register({
  family: 'Lato',
  fonts: [
    { src: path.join(fontsDir, 'Lato-Regular.ttf'), fontWeight: 400, fontStyle: 'normal' },
    { src: path.join(fontsDir, 'Lato-Bold.ttf'), fontWeight: 700, fontStyle: 'normal' },
    { src: path.join(fontsDir, 'Lato-Italic.ttf'), fontWeight: 400, fontStyle: 'italic' },
    { src: path.join(fontsDir, 'Lato-BoldItalic.ttf'), fontWeight: 700, fontStyle: 'italic' },
  ]
})

Font.register({
  family: 'EB Garamond',
  fonts: [
    { src: path.join(fontsDir, 'EBGaramond-Regular.ttf'), fontWeight: 400, fontStyle: 'normal' },
    { src: path.join(fontsDir, 'EBGaramond-Bold.ttf'), fontWeight: 700, fontStyle: 'normal' },
    { src: path.join(fontsDir, 'EBGaramond-Italic.ttf'), fontWeight: 400, fontStyle: 'italic' },
    { src: path.join(fontsDir, 'EBGaramond-BoldItalic.ttf'), fontWeight: 700, fontStyle: 'italic' },
  ]
})

Font.register({
  family: 'Open Sans',
  fonts: [
    { src: path.join(fontsDir, 'OpenSans-Regular.ttf'), fontWeight: 400, fontStyle: 'normal' },
    { src: path.join(fontsDir, 'OpenSans-Bold.ttf'), fontWeight: 700, fontStyle: 'normal' },
    { src: path.join(fontsDir, 'OpenSans-Italic.ttf'), fontWeight: 400, fontStyle: 'italic' },
    { src: path.join(fontsDir, 'OpenSans-BoldItalic.ttf'), fontWeight: 700, fontStyle: 'italic' },
  ]
})

Font.register({
  family: 'Source Serif 4',
  fonts: [
    { src: path.join(fontsDir, 'SourceSerif4-Regular.ttf'), fontWeight: 400, fontStyle: 'normal' },
    { src: path.join(fontsDir, 'SourceSerif4-Bold.ttf'), fontWeight: 700, fontStyle: 'normal' },
    { src: path.join(fontsDir, 'SourceSerif4-Italic.ttf'), fontWeight: 400, fontStyle: 'italic' },
    { src: path.join(fontsDir, 'SourceSerif4-BoldItalic.ttf'), fontWeight: 700, fontStyle: 'italic' },
  ]
})

// Disable hyphenation globally — never acceptable in a resume
Font.registerHyphenationCallback((word) => [word])

// ─────────────────────────────────────────────
// PAGE COUNT
// ─────────────────────────────────────────────
function countPDFPages(buffer) {
  const str = buffer.toString('binary')
  const matches = str.match(/\/Type\s*\/Page[^s]/g)
  return matches ? matches.length : 1
}

// ─────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────
export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const token = authHeader.replace('Bearer ', '')
    if (token !== process.env.INTERNAL_API_SECRET) {
      const { createClient: createAuthClient } = await import('@supabase/supabase-js')
      const authSupabase = createAuthClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
      const { data: { user }, error: authError } = await authSupabase.auth.getUser(token)
      if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const {
      resumeData,
      resumeId,
      templateName,
      fontSize,
      font,
      spacing,
      accentColor,
      action,
      versionId,
      isJobVersion,
      userId
    } = await request.json()

    const fontMap = {
      'Lato': 'Lato',
      'EB Garamond': 'EB Garamond',
      'Open Sans': 'Open Sans',
      'Source Serif 4': 'Source Serif 4',
      'Helvetica': 'Helvetica',
    }
    const fontToUse = fontMap[font] || 'Lato'

    const templateComponents = {
      Current: ResumePDFCurrent,
      Command: ResumePDFCommand,
      Crisp: ResumePDFCrisp,
      Edge: ResumePDFEdge,
      Prestige: ResumePDFPrestige,
      Sharp: ResumePDFSharp,
      Signature: ResumePDFSignature,
      Vibe: ResumePDFVibe,
    }
    const TemplateComponent = templateComponents[templateName] || ResumePDFCurrent

    const sanitizedData = JSON.parse(JSON.stringify(resumeData))
    if (sanitizedData.summary) sanitizedData.summary = sanitizedData.summary.trim()
    if (sanitizedData.experience) {
      sanitizedData.experience = sanitizedData.experience.map(job => ({
        ...job,
        summary: job.summary ? job.summary.trim() : job.summary,
        bullets: job.bullets ? job.bullets.map(b => (b || '').trim()).filter(b => b.length > 0) : job.bullets
      }))
    }

    const element = React.createElement(TemplateComponent, {
      resumeData: sanitizedData,
      font: fontToUse,
      fontSize: fontSize || 11,
      spacing: spacing || 1,
      accentColor: accentColor || '#5b4fcf'
    })

    const pdfBuffer = await renderToBuffer(element)

    if (action === 'check') {
      const pageCount = countPDFPages(pdfBuffer)
      return Response.json({ pageCount })
    }

    if (action === 'download') {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const fullName = resumeData?.fullName || 'Resume'
      const nameParts = fullName.split(' ')
      const sanitize = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]/g, '')
      const firstName = sanitize(nameParts[0]) || 'Resume'
      const lastName = sanitize(nameParts[nameParts.length - 1]) || ''
      const atsName = lastName ? `${firstName}_${lastName}` : firstName
      const fileName = `${userId}/${versionId || 'core'}/${atsName}_Resume_${templateName}_${timestamp}.pdf`

      const { error: uploadError } = await supabase.storage
        .from('resume-pdfs')
        .upload(fileName, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: false
        })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('resume-pdfs')
        .getPublicUrl(fileName)

      if (!publicUrl) {
        return apiError(
          new Error(`getPublicUrl returned empty for ${fileName}`),
          "We couldn't save your PDF. Please try again."
        )
      }

      const tableName = isJobVersion ? 'resume_versions' : 'resumes'
      const recordId = versionId || resumeId

      const { data: currentRecord, error: selectError } = await supabase
        .from(tableName)
        .select('formatted_versions')
        .eq('id', recordId)
        .single()

      if (selectError) {
        console.error('generate-pdf: failed to read formatted_versions:', selectError)
        return apiError(selectError, "We couldn't save your PDF. Please try again.")
      }

      const formattedVersions = currentRecord?.formatted_versions || {}
      formattedVersions[templateName] = {
        created_at: new Date().toISOString(),
        pdf_url: publicUrl,
        file_path: fileName
      }

      const { error: updateError } = await supabase
        .from(tableName)
        .update({ formatted_versions: formattedVersions })
        .eq('id', recordId)

      if (updateError) {
        console.error('generate-pdf: failed to update formatted_versions:', updateError)
        return apiError(updateError, "We couldn't save your PDF. Please try again.")
      }

      // ─────────────────────────────────────────────
      // T3 TRIGGER — first resume download for this user
      // Fires firstResumeDownload event to Loops
      // Gated by profiles.t3_sent_at and resumes.first_downloaded_at (both single-fire)
      // Wrapped in try/catch so any failure here never blocks the download
      // ─────────────────────────────────────────────
      if (userId) {
        try {
          const { data: profileRow } = await supabase
            .from('profiles')
            .select('email, first_name, subscription_tier, t3_sent_at')
            .eq('id', userId)
            .single()

          // Only proceed if user hasn't received T3 yet
          if (profileRow && !profileRow.t3_sent_at) {
            // Stamp first_downloaded_at on the resume (the actual resumes table, not resume_versions)
            // We only stamp + check this on the parent resume, since T3 fires once per user regardless of resume type
            const resumeIdForStamp = isJobVersion ? resumeId : recordId

            if (resumeIdForStamp) {
              const { data: resumeRow } = await supabase
                .from('resumes')
                .select('first_downloaded_at')
                .eq('id', resumeIdForStamp)
                .single()

              if (resumeRow && !resumeRow.first_downloaded_at) {
                const now = new Date().toISOString()

                // Stamp both timestamps first (defensive: prevents double-fire if user clicks download twice quickly)
                await supabase
                  .from('resumes')
                  .update({ first_downloaded_at: now })
                  .eq('id', resumeIdForStamp)

                await supabase
                  .from('profiles')
                  .update({ t3_sent_at: now })
                  .eq('id', userId)

                // Fire Loops event — update contact first so branch filter sees correct tier
                if (process.env.LOOPS_API_KEY && profileRow.email) {
                  // Step 1: Sync contact properties before firing event
                  await fetch('https://app.loops.so/api/v1/contacts/update', {
                    method: 'PUT',
                    headers: {
                      'Authorization': `Bearer ${process.env.LOOPS_API_KEY}`,
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      email: profileRow.email,
                      subscriptionTier: profileRow.subscription_tier || 'free',
                      firstName: profileRow.first_name || ''
                    })
                  })

                  // Step 2: Fire event — contact now has correct tier for branch evaluation
                  const loopsResponse = await fetch('https://app.loops.so/api/v1/events/send', {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${process.env.LOOPS_API_KEY}`,
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      email: profileRow.email,
                      userId: userId,
                      eventName: 'firstResumeDownload',
                      contactProperties: {
                        firstName: profileRow.first_name || '',
                        subscriptionTier: profileRow.subscription_tier || 'free'
                      }
                    })
                  })

                  if (!loopsResponse.ok) {
                    const errText = await loopsResponse.text()
                    console.error('T3 Loops event failed:', loopsResponse.status, errText)
                  }
                } else {
                  console.warn('T3 trigger skipped: LOOPS_API_KEY missing or profile email empty')
                }
              }
            }
          }
        } catch (t3Error) {
          // T3 failure must never block the download
          console.error('T3 trigger error (non-blocking):', t3Error)
        }
      }

      return Response.json({
        success: true,
        pdfUrl: publicUrl,
        action: 'download'
      })
    }

    if (action === 'preview-url') {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const fileName = `${userId}/preview/resume_preview_${timestamp}.pdf`
      const { error: uploadError } = await supabase.storage
        .from('resume-pdfs')
        .upload(fileName, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: true
        })
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage
        .from('resume-pdfs')
        .getPublicUrl(fileName)
      if (!publicUrl) {
        return apiError(
          new Error(`getPublicUrl returned empty for ${fileName}`),
          "We couldn't load the preview. Please try again."
        )
      }
      return Response.json({ previewUrl: publicUrl })
    }

    const downloadName = resumeData?.fullName
      ? `${resumeData.fullName.replace(/\s+/g, '_')}_Resume_Preview.pdf`
      : 'Resume_Preview.pdf'

    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${downloadName}"`
      }
    })

  } catch (error) {
    return apiError(error, "We couldn't generate your PDF. Please try again.")
  }
}