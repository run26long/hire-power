import puppeteer from 'puppeteer'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    const { resumeData, resumeId, templateName, fontSize, action, versionId, isJobVersion, userId } = await request.json()
    
    // Transform builder format to template format
    function transformResumeData(builderData) {
      return {
        contact: {
          fullName: builderData.fullName || '',
          phone: builderData.phone || '',
          email: builderData.email || '',
          location: builderData.location || '',
          linkedin: builderData.linkedin || ''
        },
        summary: builderData.summary || null,
        experience: (builderData.experience || []).map(job => {
          const descriptionLines = (job.description || '').split('\n')
          const achievements = descriptionLines
            .filter(line => line.trim().startsWith('•'))
            .map(line => line.trim().substring(1).trim())
          
          if (achievements.length === 0 && job.description) {
            achievements.push(job.description.trim())
          }
          
          return {
            title: job.title || '',
            company: job.company || '',
            startDate: job.startDate || '',
            endDate: job.endDate || (job.current ? 'Present' : ''),
            summary: null,
            achievements: achievements
          }
        }),
        education: (builderData.education || []).map(edu => ({
          school: edu.school || '',
          degree: edu.degree || '',
          major: edu.major || '',
          minor: edu.minor || '',
          graduationDate: edu.graduationDate || '',
          gpa: edu.gpa || '',
          activities: edu.activities || '',
          honors: edu.honors || ''
        })),
        skills: Array.isArray(builderData.skills) ? builderData.skills : [],
        certifications: builderData.certifications || [],
        volunteer: builderData.volunteer || [],
        projects: builderData.projects || [],
        languages: builderData.languages || []
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
    const transformedData = transformResumeData(resumeData)
    const htmlContent = renderToString(TemplateComponent({ resume: transformedData, fontSize }))    
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
      
      // Create ATS-friendly filename
      const fullName = transformedData.contact?.fullName || 'Resume'
      const nameParts = fullName.split(' ')
      const firstName = nameParts[0] || 'Resume'
      const lastName = nameParts[nameParts.length - 1] || ''
      const atsName = lastName ? `${firstName}_${lastName}` : firstName
      
      const fileName = `${userId}/${versionId || 'core'}/${atsName}_Resume_${templateName}_${timestamp}.pdf`
      
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
      const recordId = versionId || resumeId

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
    const fullName = transformedData.contact?.fullName || 'Resume'
    const nameParts = fullName.split(' ')
    const firstName = nameParts[0] || 'Resume'
    const lastName = nameParts[nameParts.length - 1] || ''
    const atsName = lastName ? `${firstName}_${lastName}` : firstName
    
    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename=${atsName}_Resume_Preview.pdf`
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