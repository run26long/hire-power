import puppeteer from 'puppeteer'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    const { resumeData, resumeId, templateName, fontSize, font, spacing, action, versionId, isJobVersion, userId } = await request.json()
    
    // Generate the PDF using Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    const page = await browser.newPage()
    
    // Import the template component and render it
    const templateModule = await import(`../../templates/${templateName}Template.js`)
    const TemplateComponent = templateModule.default
    
    // Render template to HTML string
    const { renderToString } = await import('react-dom/server')
    const htmlContent = renderToString(TemplateComponent({ resumeData, font, fontSize, spacing: spacing || 1 }))
    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; }
            @page { margin: 0; }
          </style>
        </head>
        <body>${htmlContent}</body>
      </html>
    `
    
    await page.setContent(fullHtml, { waitUntil: 'networkidle0' })
    
    const pdfBuffer = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    })
    
    // If action is 'check', just return page count without saving
    if (action === 'check') {
      const pageCount = await page.evaluate(() => {
        return Math.ceil(document.body.scrollHeight / (11 * 96))
      })
      await browser.close()
      return Response.json({ pageCount })
    }

    await browser.close()

    // If action is 'download', save to Supabase Storage
    if (action === 'download') {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      
      const fullName = resumeData?.fullName || 'Resume'
      const nameParts = fullName.split(' ')
      const firstName = nameParts[0] || 'Resume'
      const lastName = nameParts[nameParts.length - 1] || ''
      const atsName = lastName ? `${firstName}_${lastName}` : firstName
      
      const fileName = `${userId}/${versionId || 'core'}/${atsName}_Resume_${templateName}_${timestamp}.pdf`
      
      const { data: uploadData, error: uploadError } = await supabase.storage
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

    // If action is 'preview', return PDF directly
    const fullName = resumeData?.fullName || 'Resume'
    const nameParts = fullName.split(' ')
    const firstName = nameParts[0] || 'Resume'
    const lastName = nameParts[nameParts.length - 1] || ''
    const atsName = lastName ? `${firstName}_${lastName}` : firstName
    
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
    console.error('Error generating PDF:', error)
    return Response.json(
      { error: 'Failed to generate PDF', details: error.message },
      { status: 500 }
    )
  }
}