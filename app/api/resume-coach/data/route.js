import { createClient } from '@supabase/supabase-js';
import puppeteer from 'puppeteer';
import { normalizeSkillCategories } from '@/lib/resumeText'
import { isRealCore, hasUsedCoreCoaching } from '@/lib/coreResumes'
import { canAccessBuiltWork, canCreateResumes } from '@/lib/tiers'
import { freeCoreId } from '@/lib/resumeAccess'
// Which plans share the three-item allowance, and so which rows belong in the
// Job Match Scores and Cover Letters panels. One definition, because the hub,
// this route and the cover letter page all have to agree.
import { madeOnAllowance, ALLOWANCE_LIMIT } from '@/lib/allowance'
// The public Career Profile's own rule for which Career Directions it shows,
// imported rather than restated: see the note beside careerProfilePreview.
import { lensesShownBy } from '../../career-profile/_lib/directions'

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
  const skillGroups = normalizeSkillCategories(resumeData);
  if (skillGroups.length > 0) {
    skillsHTML = skillGroups.map(({ name, skills: items }) => `
      <div style="margin-bottom: 4px;">
        <strong>${name}:</strong> ${items.join(' • ')}
      </div>
    `).join('');
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
    
    // Get the core resume. One per account; the flagged priority core wins,
    // and without one the newest does, because a strict is_priority_core
    // filter returns nothing for an account that predates the column.
    const { data: coreResumes, error: resumeError } = await supabase
      .from('resumes')
      .select('*')
      .eq('user_id', user.id)
      .eq('resume_type', 'core')
      .eq('is_active', true)
      .order('is_priority_core', { ascending: false })
      .order('created_at', { ascending: false });
    
    if (resumeError) {
      console.error('Resume error:', resumeError);
      return Response.json({ error: 'Failed to load resumes' }, { status: 500 });
    }
    
    const allCore = coreResumes || [];
    const activeChatResume = allCore.find(r => r.created_via === 'resume_chat' && !r.coaching_complete) || null;
    // Not computed from allCore: that query is filtered to is_active, and the
    // one coaching session an account gets is spent whether or not the resume
    // it was spent on is still in play.
    const coreCoachingUsed = await hasUsedCoreCoaching(supabase, user.id);
    // isRealCore is the test every core gate shares, in lib so the hub and the
    // routes that refuse a second core cannot disagree about what counts as
    // having one.
    const coreResume = allCore.find(isRealCore) || null;
    
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
      .select('id, job_title, job_company, linked_resume_id, created_at, created_tier')
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

    // Whether this account has a Career Profile at all, which is the other
    // half of the question the hub's Career Profile card asks. Coaching
    // creates the row, so a coached account nearly always has one - but
    // "nearly always" is not a thing to render a card on, and a card pointing
    // at a page that was never built is worse than no card.
    const { data: careerProfileRow, error: careerProfileError } = await supabase
      .from('career_profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (careerProfileError) {
      // Costs the card, nothing else. The rest of the hub is unaffected, and
      // a missing invitation is better than one that leads nowhere.
      console.error('Career profile lookup failed (non-fatal):', careerProfileError);
    }

    // ---- WHAT THE MINIATURE ON THAT CARD DRAWS ----
    //
    // The hub's Career Profile card carries a small picture of the public
    // page, and the picture has the owner's own name, directions and numbers
    // in it. Those four fields and nothing else: it is a drawing, not a second
    // copy of the profile.
    //
    // THE SAME DIRECTIONS THE PUBLIC PAGE SHOWS
    // Through lensesShownBy, imported from the route that renders that page
    // rather than restated here - it is the function that applies the display
    // limit and the free plan's one-direction rule, and a second answer to
    // "which directions show" is how the picture would end up disagreeing with
    // the page it is a picture of. Fed rows filtered to status 'active' and
    // ordered by sort_order, which is exactly what the public route feeds it.
    //
    // The leading direction is the one the public page opens on, so its
    // headline and its proof points are what a reader would see first.
    //
    // ALL OF IT OR NONE OF IT
    // A drawing missing its headline, or with one number in three slots, is an
    // advertisement for an unfinished page. So this is returned only when the
    // profile can fill it, and the card falls back to a fixed sample when it
    // cannot - which covers a profile whose directions have not been generated
    // yet as well as one that has none.
    let careerProfilePreview = null;
    if (careerProfileRow?.id) {
      const { data: previewLenses, error: previewLensError } = await supabase
        .from('profile_lenses')
        .select('id, name, status, sort_order, created_at, headline, proof_points')
        .eq('profile_id', careerProfileRow.id)
        .eq('status', 'active')
        .order('sort_order', { ascending: true });

      if (previewLensError) {
        // Costs the owner's own data in the drawing, which falls back to the
        // sample. The card itself is unaffected.
        console.error('Career profile preview lookup failed (non-fatal):', previewLensError);
      } else {
        const visible = lensesShownBy(previewLenses || [], userTier);
        const leading = visible[0] || null;
        // The same name the public route publishes as person.displayName: the
        // account's display name, and the core resume's own name behind it.
        const displayName = profile?.display_name || coreResume?.resume_data?.fullName || null;
        const proofPoints = Array.isArray(leading?.proof_points) ? leading.proof_points : [];
        const headline = typeof leading?.headline === 'string' ? leading.headline.trim() : '';

        if (displayName && headline && proofPoints.length >= 3) {
          careerProfilePreview = {
            name: displayName,
            directions: visible.slice(0, 2).map(lens => lens.name).filter(Boolean),
            headline,
            proofPoints: proofPoints.slice(0, 3)
          };
        }
      }
    }

    // Every Career Direction this account has used to be read here, twice: once
    // to name the cores and once to feed the hub's tile row, which offered a
    // core to build for each direction without one. Directions live on the
    // Career Profile now and the hub neither names a resume after one nor
    // builds anything for one, so neither query has a reader.

    // The card shape for the one core resume. The thumbnail is passed in
    // because generating one is paid for above rather than here.
    const projectCore = (core, generatedThumbnail) => ({
      id: core.id,
      // One core resume per account, and it is called "Core Resume". It used
      // to be named after the Career Direction a lens bound it to; nothing
      // binds one now, and a resume that covers a whole career should not be
      // filed under one slice of it.
      display_name: 'Core Resume',
      resume_data: core.resume_data,
      current_score: core.current_score,
      initial_score: core.initial_resume_power_score,
      score_improvement: core.current_score && core.initial_resume_power_score
        ? core.current_score - core.initial_resume_power_score
        : 0,
      journey_step: core.journey_step || 'review',
      updated_at: core.updated_at,
      thumbnail_url: generatedThumbnail ?? core.thumbnail_url,
      score_breakdown: core.score_breakdown,
      has_coaching_conversation: !!(core.coaching_conversation?.length > 0),
      // Whether the coaching conversation finished, which is what the Career
      // Profile card waits for: the profile is written out of that
      // conversation, so offering it before there has been one would point at
      // a page with nothing on it.
      coaching_complete: core.coaching_complete === true
    });

    // Format core resume data
    const coreResumeData = coreResume ? projectCore(coreResume, thumbnailUrl) : null;

    // ---- WHAT A NON-PRO PANEL MAY LIST ----
    //
    // Free and Vault share one lifetime allowance of three job match scores
    // and three cover letters. Only the things they made on that allowance
    // belong in those panels: a job-specific resume made on Pro was never one
    // of the three, so listing it there would show a spent slot that never
    // spent anything, and leave the owner one short.
    //
    // created_tier is the column that answers it, stamped on insert by a
    // trigger rather than by any of the fourteen insert sites - see
    // scripts/add-created-tier-and-subscription-events.sql.
    //
    // Pro sees everything, as it always has: it has no allowance for anything
    // to count against, so there is nothing to separate.
    const splitForPanel = (rows) => {
      const all = rows || [];
      if (canCreateResumes(userTier)) return { own: all, fromPro: [] };
      return {
        // Three at most, newest first. The query is already ordered by
        // created_at desc, so this is the three most recent. An account over
        // the three is one whose allowance was counted differently at the
        // time; the panel shows the newest three rather than growing a fourth
        // row it has no slot for.
        own: all.filter(madeOnAllowance).slice(0, ALLOWANCE_LIMIT),
        fromPro: all.filter(row => !madeOnAllowance(row))
      };
    };

    const splitVersions = splitForPanel(versions);
    const splitLetters = splitForPanel(coverLetters);

    const projectVersion = (v) => ({
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
      // Vault keeps what it built, so the payload keeps it too. This read
      // 'pro' and nothing else, which is why a Vault account's job-specific
      // resumes came back as empty shells it could not preview or open.
      //
      // It is also what locks a Pro-made resume for a free account in the
      // "Looking for your job-specific resumes?" list: the title travels so
      // they can see it is still theirs, the content does not.
      customized_resume_data: canAccessBuiltWork(userTier) ? v.resume_data : null,
      analysis: v.ai_analysis
    });

    const resumeVersionsData = splitVersions.own.map(projectVersion);
    const proResumeVersionsData = splitVersions.fromPro.map(projectVersion);
    
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
      // Which core a free account keeps. One per account now, so this is
      // almost always that one - but an account that was on Pro and lapsed may
      // still hold archived extras it can restore, and the hub, the editor,
      // the Vault and the PDF route have to agree about which single resume is
      // open. Computed here from the full set of rows, so they do.
      accessibleCoreId: freeCoreId(allCore),
      resumeVersions: resumeVersionsData,
      coverLetters: splitLetters.own,
      // Made on Pro, and so not in the panels above. The two "Looking for
      // your..." links are shown on the strength of these being non-empty,
      // and the modals they open list them.
      proResumeVersions: proResumeVersionsData,
      proCoverLetters: splitLetters.fromPro,
      // Whether there is a Career Profile to send somebody to.
      hasCareerProfile: Boolean(careerProfileRow?.id),
      // What the miniature on that card draws, or null when the profile
      // cannot fill it and the card should use its sample instead.
      careerProfilePreview,
      // Whether the one non-Pro core coaching session has been used. Asked of
      // every core row the account has ever had, archived ones included, so
      // the hub offers the upgrade rather than a session the route refuses.
      coreCoachingUsed,
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
