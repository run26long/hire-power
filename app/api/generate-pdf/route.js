import React from 'react'
import { renderToBuffer, Font } from '@react-pdf/renderer'
import { createClient } from '@supabase/supabase-js'
import path from 'path'
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

      const tableName = isJobVersion ? 'resume_versions' : 'resumes'
      const recordId = versionId || resumeId

      const { data: currentRecord } = await supabase
        .from(tableName)
        .select('formatted_versions')
        .eq('id', recordId)
        .single()

      const formattedVersions = currentRecord?.formatted_versions || {}
      formattedVersions[templateName] = {
        created_at: new Date().toISOString(),
        pdf_url: publicUrl,
        file_path: fileName
      }

      await supabase
        .from(tableName)
        .update({ formatted_versions: formattedVersions })
        .eq('id', recordId)

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
    console.error('PDF generation error:', error)
    return Response.json(
      { error: 'Failed to generate PDF', details: error.message },
      { status: 500 }
    )
  }
}