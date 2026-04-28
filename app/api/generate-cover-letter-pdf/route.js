import React from 'react'
import { renderToBuffer, Font } from '@react-pdf/renderer'
import { createClient } from '@supabase/supabase-js'
import path from 'path'
import { apiError } from '@/lib/apiError'
import CoverLetterPDFCommand from '../../templates/cover-letter-pdf/cover-letter-PDF-Command'
import CoverLetterPDFCrisp from '../../templates/cover-letter-pdf/cover-letter-PDF-Crisp'
import CoverLetterPDFCurrent from '../../templates/cover-letter-pdf/cover-letter-PDF-Current'
import CoverLetterPDFEdge from '../../templates/cover-letter-pdf/cover-letter-PDF-Edge'
import CoverLetterPDFPrestige from '../../templates/cover-letter-pdf/cover-letter-PDF-Prestige'
import CoverLetterPDFSharp from '../../templates/cover-letter-pdf/cover-letter-PDF-Sharp'
import CoverLetterPDFSignature from '../../templates/cover-letter-pdf/cover-letter-PDF-Signature'
import CoverLetterPDFVibe from '../../templates/cover-letter-pdf/cover-letter-PDF-Vibe'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

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

Font.registerHyphenationCallback((word) => [word])

function countPDFPages(buffer) {
  const str = buffer.toString('binary')
  const matches = str.match(/\/Type\s*\/Page[^s]/g)
  return matches ? matches.length : 1
}

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
      coverLetterData,
      templateName,
      fontSize,
      font,
      spacing,
      action,
      userId
    } = await request.json()

    const fontMap = {
      'Lato': 'Lato',
      'EB Garamond': 'EB Garamond',
      'Open Sans': 'Open Sans',
      'Source Serif 4': 'Source Serif 4',
    }
    const fontToUse = fontMap[font] || 'Lato'

    const templateComponents = {
      Command: CoverLetterPDFCommand,
      Crisp: CoverLetterPDFCrisp,
      Current: CoverLetterPDFCurrent,
      Edge: CoverLetterPDFEdge,
      Prestige: CoverLetterPDFPrestige,
      Sharp: CoverLetterPDFSharp,
      Signature: CoverLetterPDFSignature,
      Vibe: CoverLetterPDFVibe,
    }
    const TemplateComponent = templateComponents[templateName] || CoverLetterPDFCurrent

    const element = React.createElement(TemplateComponent, {
      coverLetterData,
      font: fontToUse,
      fontSize: fontSize || 11,
      spacing: spacing || 1,
    })

    const pdfBuffer = await renderToBuffer(element)

    if (action === 'check') {
      const pageCount = countPDFPages(pdfBuffer)
      return Response.json({ pageCount })
    }

    if (action === 'preview') {
      return new Response(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'inline',
        }
      })
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const candidateName = coverLetterData?.candidateName || 'Cover_Letter'
    const nameParts = candidateName.split(' ')
    const sanitize = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]/g, '')
    const firstName = sanitize(nameParts[0]) || 'Cover_Letter'
    const lastName = sanitize(nameParts[nameParts.length - 1]) || ''
    const atsName = nameParts.length > 1 && lastName
      ? `${firstName}_${lastName}`
      : firstName
    const fileName = `${userId}/cover-letters/${atsName}_Cover_Letter_${timestamp}.pdf`

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
        "We couldn't save your cover letter. Please try again."
      )
    }

    return Response.json({ success: true, pdfUrl: publicUrl })

  } catch (error) {
    return apiError(error, "We couldn't generate your cover letter PDF. Please try again.")
  }
}