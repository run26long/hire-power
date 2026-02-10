import puppeteer from 'puppeteer'
import { createClient } from '@/utils/supabase/server'

export async function POST(request) {
  try {
    const { resumeId, template, fontSize } = await request.json()
    
    // Get user and verify authentication
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return new Response('Unauthorized', { status: 401 })
    }

    // Get resume data
    const { data: resume, error } = await supabase
      .from('resumes')
      .select('*')
      .eq('id', resumeId)
      .eq('user_id', user.id)
      .single()

    if (error || !resume) {
      return new Response('Resume not found', { status: 404 })
    }

    // Launch Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    const page = await browser.newPage()
    
    // Set viewport to letter size
    await page.setViewport({ width: 816, height: 1056 }) // 8.5x11 at 96 DPI

    // Generate HTML for the template
    const html = generateTemplateHTML(resume.resume_data, template, fontSize)
    
    await page.setContent(html, { waitUntil: 'networkidle0' })

    // Generate PDF
    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    })

    await browser.close()

    // Return PDF
    return new Response(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${resume.resume_data.contact.fullName.replace(/\s+/g, '_')}_Resume.pdf"`
      }
    })

  } catch (error) {
    console.error('PDF generation error:', error)
    return new Response('PDF generation failed', { status: 500 })
  }
}

function generateTemplateHTML(resumeData, template, fontSize) {
  // This function will render the template as static HTML
  // For now, we'll create a simple version - we'll enhance this next
  
  const baseSizes = {
    small: { name: 16, contact: 8, sectionHeader: 9, jobTitle: 9, body: 9, micro: 8 },
    medium: { name: 18, contact: 9, sectionHeader: 10, jobTitle: 10, body: 10, micro: 9 },
    large: { name: 20, contact: 10, sectionHeader: 11, jobTitle: 11, body: 11, micro: 10 }
  }
  
  const sizes = baseSizes[fontSize] || baseSizes.medium

  if (template === 'Jessica') {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; }
          @page { size: letter; margin: 0; }
        </style>
      </head>
      <body>
        <div style="width: 8.5in; height: 11in; padding: 0.6in 0.5in; display: flex;">
          <!-- Left column -->
          <div style="flex: 1; padding-right: 0.3in; border-right: 1px solid #ddd;">
            <div style="margin-bottom: 0.2in;">
              <h1 style="font-size: ${sizes.name}px; font-weight: bold; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 1px;">
                ${resumeData.contact.fullName}
              </h1>
              <p style="font-size: ${sizes.body + 3}px; margin: 0 0 12px 0; color: #333;">
                ${resumeData.contact.title || 'Professional'}
              </p>
            </div>
            
            ${resumeData.summary ? `
              <div style="margin-bottom: 0.2in;">
                <p style="font-size: ${sizes.body}px; line-height: 1.4; text-align: justify;">
                  ${resumeData.summary}
                </p>
              </div>
            ` : ''}
            
            ${resumeData.experience ? `
              <div>
                <h3 style="font-size: ${sizes.sectionHeader}px; font-weight: bold; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">
                  Professional Experience
                </h3>
                ${resumeData.experience.map(job => `
                  <div style="margin-bottom: 0.15in;">
                    <p style="font-size: ${sizes.body}px; font-weight: bold; margin: 0 0 2px 0;">
                      ${job.title} | ${job.company} | ${job.startDate} - ${job.endDate}
                    </p>
                    ${job.summary ? `
                      <p style="font-size: ${sizes.micro}px; font-style: italic; margin: 0 0 6px 0; line-height: 1.3;">
                        ${job.summary}
                      </p>
                    ` : ''}
                    ${job.achievements && job.achievements.length > 0 ? `
                      <ul style="margin: 0; padding-left: 14px; list-style-type: disc;">
                        ${job.achievements.map(achievement => `
                          <li style="font-size: ${sizes.micro}px; margin-bottom: 3px; line-height: 1.3;">
                            ${achievement}
                          </li>
                        `).join('')}
                      </ul>
                    ` : ''}
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
          
          <!-- Right sidebar -->
          <div style="width: 2.75in; padding-left: 0.3in;">
            ${resumeData.skills && resumeData.skills.length > 0 ? `
              <div style="margin-bottom: 0.25in;">
                <h3 style="font-size: ${sizes.sectionHeader}px; font-weight: bold; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
                  Core Competencies:
                </h3>
                <ul style="margin: 0; padding-left: 14px; list-style-type: disc;">
                  ${resumeData.skills.slice(0, 16).map(skill => `
                    <li style="font-size: ${sizes.micro}px; margin-bottom: 3px; line-height: 1.3;">
                      ${skill}
                    </li>
                  `).join('')}
                </ul>
              </div>
            ` : ''}
            
            ${resumeData.education && resumeData.education.length > 0 ? `
              <div style="margin-bottom: 0.25in;">
                <h3 style="font-size: ${sizes.sectionHeader}px; font-weight: bold; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
                  Education:
                </h3>
                ${resumeData.education.map(edu => `
                  <div style="font-size: ${sizes.micro}px; margin-bottom: 8px; line-height: 1.3;">
                    <p style="font-weight: bold; margin: 0;">${edu.school}</p>
                    <p style="margin: 0;">${edu.degree}</p>
                    ${edu.graduationDate ? `<p style="margin: 0;">${edu.graduationDate}</p>` : ''}
                    ${edu.gpa ? `<p style="margin: 0;">GPA: ${edu.gpa}</p>` : ''}
                  </div>
                `).join('')}
              </div>
            ` : ''}
            
            ${resumeData.contact ? `
              <div>
                <h3 style="font-size: ${sizes.sectionHeader}px; font-weight: bold; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
                  Contact:
                </h3>
                <div style="font-size: ${sizes.micro}px; line-height: 1.4;">
                  <p style="margin: 0 0 3px 0;">${resumeData.contact.phone}</p>
                  <p style="margin: 0 0 3px 0; word-break: break-word;">${resumeData.contact.email}</p>
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      </body>
      </html>
    `
  }
  
  // Add Jim template HTML here later
  return '<html><body><h1>Template not found</h1></body></html>'
}