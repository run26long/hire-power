import puppeteer from 'puppeteer'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    const { resumeData, templateName, fontSize, action, versionId, isJobVersion, userId } = await request.json()

    // Check download limits for free users (only for actual downloads, not previews)
    if (action === 'download' && userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier, pdf_downloads_remaining')
        .eq('id', userId)
        .single()

      // Free users have download limits
      if (profile?.subscription_tier === 'free') {
        if (profile.pdf_downloads_remaining <= 0) {
          return Response.json({
            error: 'Download limit reached',
            message: 'You have used all 3 free downloads. Upgrade to Full Access for unlimited downloads.',
            requiresUpgrade: true
          }, { status: 403 })
        }

        // Decrement download counter
        await supabase
          .from('profiles')
          .update({ 
            pdf_downloads_remaining: profile.pdf_downloads_remaining - 1 
          })
          .eq('id', userId)
      }
    }
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
    const htmlContent = renderToString(TemplateComponent({ resume: resumeData, fontSize }))    
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
    
    await browser.close()

    // If action is 'download', save to Supabase Storage
    if (action === 'download') {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const fileName = `${userId}/${versionId || 'core'}/${templateName}-${timestamp}.pdf`
      
      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('resume-pdfs')
        .upload(fileName, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: false
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('resume-pdfs')
        .getPublicUrl(fileName)

      // Update formatted_versions in database
      const tableName = isJobVersion ? 'resume_versions' : 'resumes'
      const recordId = versionId || resumeData.id

      // Get current formatted_versions
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

      // Update database
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
    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename=resume-preview.pdf'
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