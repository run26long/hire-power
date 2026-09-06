import { createClient } from '@supabase/supabase-js';
import puppeteer from 'puppeteer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helper function to generate resume thumbnail
async function generateThumbnail(resumeData, resumeId) {
  try {
    // Launch headless browser
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Set viewport for consistent rendering
    await page.setViewport({ width: 850, height: 1100 });
    
    // Generate HTML from resume data
    const html = generateResumeHTML(resumeData);
    
    // Set content and wait for fonts/styles
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    // Take screenshot
    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: false,
      clip: { x: 0, y: 0, width: 850, height: 1100 }
    });
    
    await browser.close();
    
    // Upload to Supabase Storage
    const fileName = `${resumeId}-${Date.now()}.png`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('resume-thumbnails')
      .upload(fileName, screenshot, {
        contentType: 'image/png',
        upsert: true
      });
    
    if (uploadError) {
      console.error('Upload error:', uploadError);
      return null;
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('resume-thumbnails')
      .getPublicUrl(fileName);
    
    return publicUrl;
    
  } catch (error) {
    console.error('Thumbnail generation error:', error);
    return null;
  }
}

// Helper function to generate resume HTML for thumbnail
function generateResumeHTML(resumeData) {
  const { fullName, email, phone, location, summary, experience, education, skillsCategories, skills } = resumeData;
  
  // Format skills (handle both old and new format)
  let skillsHTML = '';
  if (skillsCategories && Object.keys(skillsCategories).length > 0) {
    skillsHTML = Object.entries(skillsCategories).map(([category, items]) => `
      <div style="margin-bottom: 4px;">
        <strong>${category}:</strong> ${items.join(' • ')}
      </div>
    `).join('');
  } else if (skills && skills.length > 0) {
    skillsHTML = `<div>${skills.join(' • ')}</div>`;
  }
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          font-size: 11px;
          line-height: 1.4;
          color: #1a1a1a;
          padding: 40px;
          background: white;
        }
        .header {
          text-align: center;
          margin-bottom: 20px;
          border-bottom: 2px solid #667eea;
          padding-bottom: 12px;
        }
        .name {
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 6px;
          color: #1a1a1a;
        }
        .contact {
          font-size: 10px;
          color: #4a5568;
        }
        .section {
          margin-bottom: 16px;
        }
        .section-title {
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          color: #667eea;
          margin-bottom: 8px;
          letter-spacing: 0.5px;
        }
        .job {
          margin-bottom: 12px;
        }
        .job-header {
          margin-bottom: 4px;
        }
        .job-title {
          font-weight: 600;
          font-size: 12px;
        }
        .job-meta {
          font-size: 10px;
          color: #4a5568;
          margin-top: 2px;
        }
        .job-summary {
          font-size: 10px;
          color: #2d3748;
          margin: 4px 0;
          font-style: italic;
        }
        ul {
          margin-left: 16px;
          margin-top: 4px;
        }
        li {
          margin-bottom: 3px;
          font-size: 10px;
        }
        .summary {
          font-size: 10px;
          line-height: 1.5;
          color: #2d3748;
        }
        .education-item {
          margin-bottom: 8px;
        }
        .school {
          font-weight: 600;
          font-size: 11px;
        }
        .degree {
          font-size: 10px;
          color: #4a5568;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="name">${fullName || 'Your Name'}</div>
        <div class="contact">
          ${email || ''} ${phone ? ' • ' + phone : ''} ${location ? ' • ' + location : ''}
        </div>
      </div>
      
      ${summary && !resumeData.hideSummary ? `
        <div class="section">
          <div class="summary">${summary}</div>
        </div>
      ` : ''}
      
      ${experience && experience.length > 0 ? `
        <div class="section">
          <div class="section-title">Experience</div>
          ${experience.map(job => `
            <div class="job">
              <div class="job-header">
                <div class="job-title">${job.title || ''}</div>
                <div class="job-meta">
                  ${job.company || ''} ${job.location ? '| ' + job.location : ''} 
                  ${job.startDate ? '| ' + formatDateShort(job.startDate) : ''} - 
                  ${job.current ? 'Present' : (job.endDate ? formatDateShort(job.endDate) : '')}
                </div>
              </div>
              ${job.summary ? `<div class="job-summary">${job.summary}</div>` : ''}
              ${job.bullets && job.bullets.length > 0 ? `
                <ul>
                  ${job.bullets.map(bullet => `<li>${bullet}</li>`).join('')}
                </ul>
              ` : ''}
            </div>
          `).join('')}
        </div>
      ` : ''}
      
      ${education && education.length > 0 ? `
        <div class="section">
          <div class="section-title">Education</div>
          ${education.map(edu => `
            <div class="education-item">
              <div class="school">${edu.school || ''}</div>
              ${edu.degree || edu.field ? `
                <div class="degree">
                  ${edu.degree || ''} ${edu.field ? 'in ' + edu.field : ''}
                  ${edu.graduationDate ? ' | ' + formatDateShort(edu.graduationDate) : ''}
                </div>
              ` : ''}
              ${edu.lines && edu.lines.length > 0 ? `
                <div class="degree">${edu.lines.join(' • ')}</div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      ` : ''}
      
      ${skillsHTML ? `
        <div class="section">
          <div class="section-title">Skills</div>
          ${skillsHTML}
        </div>
      ` : ''}
    </body>
    </html>
  `;
}

// Helper to format dates for thumbnail
function formatDateShort(dateString) {
  if (!dateString) return '';
  const [year, month] = dateString.split('-');
  if (!year) return dateString;
  if (!month) return year;
  return `${month}/${year}`;
}

export async function GET(req) {
  try {
    // Get authenticated user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get user profile with subscription tier
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('subscription_tier, display_name, photo_url, search_status, cl_count, jms_count')
      .eq('id', user.id)
      .maybeSingle();
    
    if (profileError) {
      console.error('Profile error:', profileError);
      return Response.json({ error: 'Failed to load profile' }, { status: 500 });
    }
    
    const userTier = profile?.subscription_tier || 'free';
    
    // Get core resume
    const { data: coreResumes, error: resumeError } = await supabase
      .from('resumes')
      .select('*')
      .eq('user_id', user.id)
      .eq('resume_type', 'core')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    
    if (resumeError) {
      console.error('Resume error:', resumeError);
      return Response.json({ error: 'Failed to load resumes' }, { status: 500 });
    }
    
    const allCore = coreResumes || [];
    const activeChatResume = allCore.find(r => r.created_via === 'resume_chat' && !r.coaching_complete) || null;
    const coreResume = allCore.find(r => r.created_via !== 'resume_chat' || r.coaching_complete) || null;
    
    // Generate thumbnail if core resume exists and doesn't have one
    let thumbnailUrl = coreResume?.thumbnail_url;
    if (coreResume && !thumbnailUrl) {
      thumbnailUrl = await generateThumbnail(coreResume.resume_data, coreResume.id);
      
      // Update resume with thumbnail URL
      if (thumbnailUrl) {
        await supabase
          .from('resumes')
          .update({ thumbnail_url: thumbnailUrl })
          .eq('id', coreResume.id);
      }
    }
    
   // Get archived card resume/CL IDs so we can hide them from resume-coach
    const { data: archivedCards } = await supabase
      .from('applications')
      .select('resume_id, cover_letter_id')
      .eq('user_id', user.id)
      .eq('application_status', 'archived');

    const archivedResumeIds = (archivedCards || []).map(c => c.resume_id).filter(Boolean);
    const archivedCLIds = (archivedCards || []).map(c => c.cover_letter_id).filter(Boolean);

    // Get job-specific resumes (excluding those belonging to archived cards)
    let versionsQuery = supabase
      .from('resumes')
      .select('*')
      .eq('user_id', user.id)
      .eq('resume_type', 'job_specific')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (userTier === 'pro' && archivedResumeIds.length > 0) {
      versionsQuery = versionsQuery.not('id', 'in', `(${archivedResumeIds.join(',')})`);
    }

    const { data: versions, error: versionsError } = await versionsQuery;

    if (versionsError) {
      console.error('Versions error:', versionsError);
    }

    // Get cover letters (excluding those belonging to archived cards)
    let clQuery = supabase
      .from('cover_letters')
      .select('id, job_title, job_company, linked_resume_id, created_at')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (userTier === 'pro' && archivedCLIds.length > 0) {
      clQuery = clQuery.not('id', 'in', `(${archivedCLIds.join(',')})`);
    }

    const { data: coverLetters, error: coverLettersError } = await clQuery;

    if (coverLettersError) {
      console.error('Cover letters error:', coverLettersError);
    }

    // Check if user has completed Career Coach
    // current_lens_name is newer than this query. If the column is not there yet
    // the whole select fails and completed_at would read as absent, which would
    // wrongly report Career Coach as unfinished, so the old select is the fallback.
    let { data: careerContext, error: careerContextError } = await supabase
      .from('career_context')
      .select('completed_at, current_lens_name')
      .eq('user_id', user.id)
      .maybeSingle();

    if (careerContextError) {
      ({ data: careerContext } = await supabase
        .from('career_context')
        .select('completed_at')
        .eq('user_id', user.id)
        .maybeSingle());
    }

    // Directions Coach found in the background that the user has not acted on yet.
    // Service role, so this is not subject to RLS on profile_lenses.
    const { data: suggestedLenses, error: lensesError } = await supabase
      .from('profile_lenses')
      .select('id, name, slug, evidence_summary')
      .eq('user_id', user.id)
      .eq('status', 'suggested')
      .eq('source', 'coaching_extraction')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (lensesError) {
      console.error('Suggested lenses error:', lensesError);
    }
    
    // Format core resume data
    const coreResumeData = coreResume ? {
      id: coreResume.id,
      display_name: coreResume.display_name || 'Core Resume',
      resume_data: coreResume.resume_data,
      current_score: coreResume.current_score,
      initial_score: coreResume.initial_resume_power_score,
      score_improvement: coreResume.current_score && coreResume.initial_resume_power_score 
        ? coreResume.current_score - coreResume.initial_resume_power_score 
        : 0,
      journey_step: coreResume.journey_step || 'review',
      updated_at: coreResume.updated_at,
      thumbnail_url: thumbnailUrl,
      score_breakdown: coreResume.score_breakdown,
      has_coaching_conversation: !!(coreResume.coaching_conversation?.length > 0)
    } : null;
    
    // Format resume versions data (tier-specific)
    const resumeVersionsData = versions?.map(v => ({
      id: v.id,
      version_name: v.display_name,
      job_title: v.job_title,
      job_company: v.job_company,
      job_description: v.job_description,
      match_score: v.current_score,
      updated_at: v.updated_at,
      journey_step: v.journey_step,
      current_score: v.current_score,
      thumbnail_url: v.thumbnail_url,
      customized_resume_data: userTier === 'pro' ? v.resume_data : null,
      analysis: v.ai_analysis
    })) || [];
    
    // Return structured data
    return Response.json({
      userTier,
      activeChatResume: activeChatResume ? { id: activeChatResume.id, display_name: activeChatResume.display_name } : null,
      userProfile: {
        display_name: profile.display_name,
        photo_url: profile.photo_url,
        subscription_tier: profile.subscription_tier,
        search_status: profile.search_status,
        cl_count: profile.cl_count ?? 0,
        jms_count: profile.jms_count ?? 0
      },
      coreResume: coreResumeData,
      resumeVersions: resumeVersionsData,
      coverLetters: coverLetters || [],
      suggestedLenses: suggestedLenses || [],
      currentLensName: careerContext?.current_lens_name || null,
      stats: {
        hasCoreResume: !!coreResume,
        hasCareerContext: !!careerContext?.completed_at,
        versionCount: versions?.length || 0
      }
    });
    
  } catch (error) {
    console.error('API error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
