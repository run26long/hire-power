'use client';

import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import MainNav from '../components/MainNav';
import AppShell from '../components/AppShell';
import UpgradeModal from '../components/UpgradeModal';
import Tour, { tourSeen, TourReplayButton } from '../components/Tour';
import VaultUpgradeModal from '../components/VaultUpgradeModal';
import ErrorToast from '../components/ErrorToast';
import { getJobSources } from '../utils/getJobSources';
import { track } from '../utils/analytics';
import { TIERS } from '@/lib/subscription';
import { canAccessBuiltWork, canCreateResumes, UPGRADE_HREF } from '@/lib/tiers';
import { LOCK_COPY } from '@/lib/resumeAccess';
import { hasRealCore, ONE_CORE_MESSAGE, CORE_COACHING_USED_MESSAGE } from '@/lib/coreResumes';
import MiniProfileCard, { BOLT } from '../components/MiniProfileCard';
import Popover from '../components/Popover';
import { ALLOWANCE_LIMIT } from '@/lib/allowance';
import ResumeContent from '../components/ResumeContent';
import Breadcrumb from '../components/Breadcrumb';
import { fetchJSON } from '@/lib/fetchJSON';

// The two usage limits the server enforces. Both come back as the bare code in
// the error body, so they are matched on the message rather than on err.code.
const LIMIT_MESSAGES = {
  JMS_LIMIT_REACHED: "You've used all 3 free Job Match Scores.",
  CL_LIMIT_REACHED: "You've used all 3 free cover letters."
};

async function fireT8IfFirst(supabase) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase
      .from('profiles')
      .select('t8_sent_at')
      .eq('id', user.id)
      .maybeSingle()
    if (!profile || profile.t8_sent_at) return
    const now = new Date().toISOString()
    await supabase.from('profiles').update({ t8_sent_at: now }).eq('id', user.id)
    await fetch('/api/loops/sync-contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: user.email,
        userId: user.id,
        firstCoverLetterAt: now
      })
    })
  } catch (e) {
    console.error('T8 trigger failed (non-blocking):', e)
  }
}

async function fireT5IfFirst(supabase) {  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase
      .from('profiles')
      .select('t5_sent_at')
      .eq('id', user.id)
      .maybeSingle()
    if (!profile || profile.t5_sent_at) return
    const now = new Date().toISOString()
    await supabase.from('profiles').update({ t5_sent_at: now }).eq('id', user.id)
    await fetch('/api/loops/sync-contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: user.email,
        userId: user.id,
        firstJMSCalculatedAt: now
      })
    })
  } catch (e) {
    console.error('T5 trigger failed (non-blocking):', e)
  }
}

async function fireB2IfThird(supabase) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase
      .from('profiles')
      .select('b2_sent_at, jms_count, subscription_tier')
      .eq('id', user.id)
      .maybeSingle()
    if (!profile || profile.b2_sent_at) return
    if (profile.subscription_tier !== 'free') return
    if ((profile.jms_count ?? 0) < 3) return
    const now = new Date().toISOString()
    await supabase.from('profiles').update({ b2_sent_at: now }).eq('id', user.id)
    await fetch('/api/loops/sync-contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: user.email,
        userId: user.id,
        thirdJMSReached: now
      })
    })
  } catch (e) {
    console.error('B2 trigger failed (non-blocking):', e)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// THE GO PRO LINK UNDER A PANEL
//
// It was a fourth dashed card under the three slots, which made the panel look
// like it held four things and left the three slots reading as four. The offer
// is not one of the three; it is what to do when they run out. So it is a link
// under them rather than a row among them, and the panel always shows exactly
// three cards.
//
// The chip is the house mark in the brand gradient - the one thing on the page
// that is Hire Power's rather than the account's - at the size a line of text
// can carry. Same bolt path the Career Profile miniature draws.
// ─────────────────────────────────────────────────────────────────────────────
function GoProLink({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-center group"
      style={{ marginTop: 12, gap: 8 }}
    >
      <span
        aria-hidden="true"
        className="flex items-center justify-center flex-shrink-0"
        style={{
          width: 20,
          height: 20,
          borderRadius: 6,
          background: 'linear-gradient(135deg, #667eea, #764ba2)',
          boxShadow: '0 2px 6px rgba(118,75,162,.35)'
        }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="#ffffff">
          <path d={BOLT} />
        </svg>
      </span>
      <span className="text-sm text-purple-600 hover:text-purple-700 font-medium transition-colors cursor-pointer">
        {children}
        {/* The arrow is the same purple and not bold, so the words carry the
            weight and it reads as a direction rather than a fifth word. */}
        <span className="font-normal"> →</span>
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// THREE SLOTS, AND WHAT IS IN THEM
//
// Free and Vault get three job match scores and three cover letters for life.
// The panel has always shown three slots; what it could not show was the
// difference between a slot nobody has used and a slot that was used and then
// deleted. Those looked identical - an empty dashed box - which is how an
// account comes to read "1 of 3 remaining" above three empty-looking rows.
//
// So the counter and the live rows are laid out together:
//
//   live    something they made and still have
//   used    the counter says it was spent and there is no row for it. Almost
//           always a delete; nothing else removes one.
//   create  the first slot they can still use, as a button
//   empty   the rest, numbered, exactly as before
//
// CLAMPED AT ZERO
// live items can outnumber the counter - an account whose Vault job match
// scores were never counted, before the counter learned to count them. The
// subtraction would go negative and render a negative number of rows, so it
// is floored, and such an account simply sees its live items and no used
// slots. It is also capped at what is left, so the three never becomes four.
// ─────────────────────────────────────────────────────────────────────────────
const ALLOWANCE_SLOTS = ALLOWANCE_LIMIT;

function allowanceSlots(live, counter) {
  const items = (live || []).slice(0, ALLOWANCE_SLOTS);
  const spent = Math.max(0, (counter ?? 0) - items.length);
  const usedCount = Math.min(spent, ALLOWANCE_SLOTS - items.length);

  const slots = items.map(item => ({ kind: 'live', item }));
  for (let i = 0; i < usedCount; i++) slots.push({ kind: 'used' });
  while (slots.length < ALLOWANCE_SLOTS) {
    slots.push({ kind: slots.some(s => s.kind === 'create') ? 'empty' : 'create' });
  }
  return slots;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hub spotlight tour
// Desktop only. Runs once, the first time a user lands on the hub with a core
// resume already in hand. Each stop dims the page, cuts a hole around a real
// element, and parks a tooltip beside it.
// ─────────────────────────────────────────────────────────────────────────────
const HUB_TOUR_KEY = 'hp_hub_tour_complete';

// ─────────────────────────────────────────────────────────────────────────────
// THE SAMPLE PROFILE IN THE CARD'S DRAWING
//
// What the miniature shows when the account's own profile cannot fill it: on
// the notice, where there is no profile yet, and on the invitation where the
// profile is missing its name, its headline or three proof points.
//
// Real values, copied from the daniel-mercer-test Career Profile, rather than
// invented ones. A drawing of a page is a claim about what the page looks like,
// and lorem numbers in it would be a claim nobody could check. These came off
// that profile's leading direction in its public order, which is the same cut
// the live version takes.
//
// Hardcoded on purpose. It is one fixed illustration, shown to accounts that
// have no profile of their own, so reading it at runtime would be a query
// every hub load makes to draw a constant - and it would break the day that
// test account is edited.
// ─────────────────────────────────────────────────────────────────────────────
const SAMPLE_PROFILE = {
  name: 'Daniel Mercer',
  directions: ['Business Development', 'Executive Leadership'],
  headline: 'Business development leader scaling revenue through structured pipeline and consultative account management',
  proofPoints: [
    { num: '$5M+', label: 'annual recurring revenue added at Trident' },
    { num: '$2M-$3M', label: 'projected revenue from three accounts in four weeks' },
    { num: '$6M to $20M', label: 'revenue scaling at Trident Industrial' }
  ]
};

const HUB_TOUR_STEPS = [
  {
    id: 'core-actions',
    targets: ['core-actions'],
    placement: 'right',
    title: 'Core resume quick actions',
    body: 'Open and edit your resume, create a version for a specific job, download your PDF, or delete and start over. Everything starts here.',
    // Creating a job-specific version and deleting are both Pro: the delete
    // button in this very cluster is wrapped in isPro, and the job-specific
    // flow answers with the upgrade modal. So the Free version names what Free
    // can do and says where the rest is.
    freeBody: 'Open and edit your resume or download your PDF. With Pro, you can also create a version for a specific job. Everything starts here.'
  },
  {
    id: 'score',
    targets: ['score'],
    placement: 'left',
    title: 'Your Resume Power Score',
    body: "This is how well your resume communicates your value. The breakdown shows exactly where you're strong and where there's room to grow: Impact, Clarity, and Keywords."
  },
  {
    id: 'progress',
    // Two elements, one spotlight — the progress bar and the panel under it.
    targets: ['progress', 'progress-meaning'],
    placement: 'bottom',
    title: 'Where you are and what’s next',
    body: 'The progress bar tracks every stage of your resume. The section below it always tells you what to do next.'
  },
  {
    id: 'job-specific',
    targets: ['job-specific'],
    placement: 'left',
    title: 'Tailor for every application',
    body: "Employers expect a resume that matches their posting. Paste any job description and we'll customize your resume to fit. Each version lives here with its own match score.",
    // Free tier sees the Job Match Scores card in this slot, not job-specific resumes.
    freeTitle: 'See how you match up',
    freeBody: "Paste any job description and we'll score how well your resume matches. Your plan includes 3 job match scores to help you target your strongest opportunities."
  },
  {
    id: 'cover-letters',
    targets: ['cover-letters'],
    placement: 'left',
    title: 'Cover letters that connect the dots',
    body: "Paste a job posting and we'll write a cover letter that ties your experience to what they're looking for. Works with or without a tailored resume for that job.",
    freeBody: "Paste a job posting and we'll write a cover letter that ties your experience to what they're looking for. Your plan includes 3 cover letters."
  },
  {
    id: 'job-tracker',
    targets: ['job-tracker'],
    placement: 'bottom',
    title: 'Everything for every job, one place',
    body: 'When you create a resume or cover letter for a specific job, a job card is automatically created in your Job Tracker. It keeps the job description, your tailored resume, and your cover letter together so nothing gets lost.',
    freeBody: 'When you score a job or write a cover letter for a specific job, a job card is automatically created in your Job Tracker. It keeps the job description and your cover letter together, so nothing gets lost.'
  },
  // Last, because it is the one stop that is not about this page. It is also
  // the one stop that is not always here: both states of the Career Profile
  // slot carry the data-tour, but the slot itself is empty for an account
  // that has finished coaching and has no profile row. Tour drops any stop
  // whose target is missing, so that account gets six steps, a counter that
  // reads "of 6", and "Got it ✓" on the Job Tracker stop - all without this
  // list knowing anything about it.
  //
  // Two sets of words for the two states, resolved where the tour is mounted.
  // The invitation describes a page that exists; the notice cannot, so it
  // offers the reason to finish instead. Same split as the card's own copy,
  // and keyed off the same flag, so the stop and the thing it is pointing at
  // can never say different things.
  {
    id: 'career-profile',
    targets: ['career-profile'],
    placement: 'top',
    title: 'Your Career Profile',
    body: 'We built it from your resume coaching. A resume is one snapshot of your career. Your Career Profile brings the whole gallery into view, in one link you can share.',
    adTitle: 'Your Career Profile is next',
    adBody: "Your career deserves more than one page. Finish your core resume, and we'll build your Career Profile from it."
  }
];

// Sidebar content for the Resume Coach shell. It is entirely static, so it
// lives at module scope and is shared by the error shell and the loaded one
// rather than being written out twice.
const resumeCoachSidebar = (
  <>
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex-shrink-0">
          <h1 className="text-[28px] font-bold mb-1.5 whitespace-nowrap tracking-tight">Resume Writer</h1>
          <p className="text-sm text-white text-opacity-95 leading-tight tracking-tight mb-0.5">
            Job hunting is small talk.
          </p>
          <p className="text-sm text-white text-opacity-95 leading-tight tracking-tight">
            Your career deserves a conversation.
          </p>
          <div className="mt-4 border-b border-gray-400 border-opacity-10"></div>
        </div>
        
        {/* Main Content */}
        <div className="px-6 pt-0 pb-6 flex-1 flex flex-col">

          {/* Steps */}
          <div style={{ marginBottom: 16 }}>
                     {[
              { 
                num: '1', 
                title: 'Add Your Resume', 
                desc: 'Upload or build from scratch' 
              },
              { 
                num: '2', 
                title: 'Build Your Core Resume',
                desc: 'Review → Assess → Coach → Improve → Format → Save. Your core resume is the foundation for every application.'
              },
              { 
                num: '3', 
                title: 'Job Match Score', 
                desc: 'See how well your experience matches any job posting.',
                tag: 'Free: 3 matches · Pro: Unlimited matches'
              },
              { 
                num: '4', 
                title: 'Job-Specific Resumes', 
                desc: 'Employers expect a tailored resume for every application. Hire Power lets you create one in minutes!',
                tag: 'Pro only'
              },
              { 
                num: '5', 
                title: 'Cover Letters', 
                desc: 'Written for each job, not every job.',
                tag: 'Free: 3 letters ·  Pro: Unlimited letters'
              },
            ].map(({ num, title, desc, tag }) => (
              <div key={num} style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                <div style={{ 
                  width: 20, height: 20, borderRadius: '50%', 
                  border: '1.5px solid rgba(255,255,255,0.4)', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.7)',
                  flexShrink: 0, marginTop: 1
                }}>
                  {num}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#fff', lineHeight: 1.3, marginBottom: 2 }}>
                    {title}
                  </p>
                  <p style={{ fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,0.7)', lineHeight: 1.35, marginBottom: 0 }}>
                    {desc}
                  </p>
                  {tag && (
                    <span style={{ fontSize: 9, fontWeight: 700, fontStyle: 'italic', color: 'rgba(255,255,255,0.45)', letterSpacing: '0.02em', display: 'block', marginTop: 0 }}>
                      {tag}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Bottom section */}
          <div className="mt-auto mb-4">
            <div className="border-b border-gray-400 border-opacity-10" style={{ marginBottom: 14 }}></div>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#fff', lineHeight: 1.3, marginBottom: 4 }}>
              Ready to apply?
            </p>
            <p style={{ fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4, marginBottom: 0 }}>
              Job cards are created automatically for each job-specific resume or cover letter. Visit your Job Tracker board to track that application through the entire process.
            </p>
          </div>

        </div>
  </>
);

export default function MyResumesPage() {
  const router = useRouter();
  const supabase = createClient();

 const getBreakdownLabel = (score, max) => {
  const pct = (score / max) * 100
  if (pct >= 85) return { label: 'Excellent', color: '#9333ea', text: 'text-purple-600' }
  if (pct >= 75) return { label: 'Strong', color: '#81c784', text: 'text-green-600' }
  if (pct >= 60) return { label: 'Developing', color: '#ffc870', text: 'text-yellow-600' }
  return { label: 'Needs Work', color: '#e57373', text: 'text-red-600' }
}
  
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [retryCount, setRetryCount] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadingResumeId, setDownloadingResumeId] = useState(null);
  const [downloadError, setDownloadError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

 // Job-specific modal state
  const [showJobModal, setShowJobModal] = useState(false);
  const [jobModalSourceId, setJobModalSourceId] = useState(null);
  const [jobTitle, setJobTitle] = useState('');
  const [jobTitleError, setJobTitleError] = useState(null);
  const [jobCompany, setJobCompany] = useState('');
  const [jobCompanyError, setJobCompanyError] = useState(null);
  const [jobDescription, setJobDescription] = useState('');
  const [jobSources, setJobSources] = useState([]);
  const [selectedJobSourceId, setSelectedJobSourceId] = useState('');
  const [creatingJob, setCreatingJob] = useState(false);
  const [jobCreateError, setJobCreateError] = useState(null);

  // Cover letter state
  const [showCLModal, setShowCLModal] = useState(false);
  const [clSourceType, setClSourceType] = useState(null); // null | 'js_resume' | 'scratch'
  const [clSelectedJSId, setClSelectedJSId] = useState('');
  const [clJobTitle, setClJobTitle] = useState('');
  const [clJobTitleError, setClJobTitleError] = useState(null);
  const [clCompany, setClCompany] = useState('');
  const [clCompanyError, setClCompanyError] = useState(null);
  const [clJobDescription, setClJobDescription] = useState('');
  const [positioningStatement, setPositioningStatement] = useState('');
  const [clAdditionalContext, setClAdditionalContext] = useState('');
  const [creatingCL, setCreatingCL] = useState(false);
  const [clCreateError, setClCreateError] = useState(null);
  const [confirmDeleteCLId, setConfirmDeleteCLId] = useState(null);
  const [deletingCLId, setDeletingCLId] = useState(null);

  // Overflow modals
  const [showOlderJSModal, setShowOlderJSModal] = useState(false);
  const [showOlderCLModal, setShowOlderCLModal] = useState(false);

const [careerContext, setCareerContext] = useState(null);

useEffect(() => {
  const fetchCareerContext = async () => {
    const { data } = await supabase
      .from('career_context')
      .select('completed_at')
      .eq('user_id', user.id)
      .maybeSingle();
    setCareerContext(data);
  };
  if (user?.id) fetchCareerContext();
}, [user?.id]);

const careerCoachComplete = careerContext && careerContext.completed_at !== null;

  // Tour modal state
  const [showTourModal, setShowTourModal] = useState(false);
  const [tourScreen, setTourScreen] = useState(1);
  const [hasSeenTour, setHasSeenTour] = useState(false);
  const [creatingChat, setCreatingChat] = useState(false);

  // Hub spotlight tour state
  const [showHubTour, setShowHubTour] = useState(false);
  const [hubTourStepId, setHubTourStepId] = useState(null);
  const closeHubTour = useCallback(() => {
    setShowHubTour(false);
    setHubTourStepId(null);
  }, []);

 useEffect(() => {
    loadData();
    const params = new URLSearchParams(window.location.search);

    // Check for job-specific creation trigger from SaveStep or JobCardModal
    if (params.get('action') === 'new-job-specific') {
      const fromId = params.get('from');
      const applicationId = params.get('applicationId') || '';
      setJobModalSourceId(fromId);
      if (applicationId) {
        // Arriving from a job card: the card owns the title, company, and JD,
        // so read them from the record rather than from the URL.
        supabase
          .from('applications')
          .select('title, company, description')
          .eq('id', applicationId)
          .single()
          .then(({ data, error }) => {
            if (error) {
              console.error('Load job card for tailored resume failed:', error);
            } else if (data) {
              setJobTitle(data.title || '');
              setJobCompany(data.company || '');
              setJobDescription(data.description || '');
            }
            setShowJobModal(true);
          });
      } else {
        setShowJobModal(true);
      }
      window.history.replaceState({}, '', '/resume-coach');
    }

    // Check for cover letter creation trigger from JobCardModal
    if (params.get('action') === 'new-cover-letter') {
      const jobTitle = params.get('jobTitle') || '';
      const jobCompany = params.get('jobCompany') || '';
      const resumeId = params.get('resumeId') || '';
      const applicationId = params.get('applicationId') || '';
      setClJobTitle(jobTitle);
      setClCompany(jobCompany);
      setClSelectedJSId(resumeId);
      if (applicationId) {
        supabase.from('applications').select('description').eq('id', applicationId).single().then(({ data }) => {
          if (data?.description) setClJobDescription(data.description);
        });
      }
      setShowCLModal(true);
      window.history.replaceState({}, '', '/resume-coach');
    }
  }, []);

  async function loadData() {
    try {
      setLoadError(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/dashboard');
        return;
      }
      setUser(user);

      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;
      
      if (!session) {
        router.push('/dashboard');
        return;
      }

      const resData = await fetchJSON('/api/resume-coach/data', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      setData(resData);
      setUserProfile(resData.userProfile);

      // Load job sources for the job specific Resume + CL modal dropdowns
      const sources = await getJobSources(supabase, user.id);
      setJobSources(sources);

      setRetryCount(0);
      // Reset retry count on success

      // Show the tour on every visit until a core resume exists. Dismissing it lasts
      // for the current page load only, so a returning user who still has no resume
      // is asked again rather than landing on a hub with nothing to work from.
      if (!resData.coreResume) {
        setTimeout(() => {
          setShowTourModal(true);
        }, 300); // 300ms delay
      } else if (window.innerWidth >= 768 && !tourSeen(HUB_TOUR_KEY)) {
        // Core resume in hand: walk them through the hub once. Desktop only —
        // the spotlight targets are laid out for the two-column desktop view.
        setTimeout(() => {
          setShowHubTour(true);
        }, 300); // 300ms delay
      }

    } catch (error) {
      console.error('Error loading data:', error);

      // Auto-retry once with a 1-second delay, then give up
      const MAX_RETRIES = 1;
      if (retryCount < MAX_RETRIES) {
        setRetryCount(retryCount + 1);
        setTimeout(() => loadData(), 1000);
      } else {
        setLoadError(error.message || "We couldn't load your resumes. Please refresh the page.");
      }
    } finally {
      setLoading(false);
    }
  }

  function getScoreColor(score) {
    if (!score) return 'text-gray-400';
    if (score >= 85) return 'text-purple-600';
    if (score >= 75) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  }

  function getScoreTier(score) {
    if (!score) return 'Not Assessed';
    if (score >= 85) return 'Excellent';
    if (score >= 75) return 'Strong';
    if (score >= 60) return 'Developing';
    return 'Needs Work';
  }

  function getCircleColor(score) {
    if (score >= 85) return '#9333ea';
    if (score >= 75) return '#81c784';
    if (score >= 60) return '#ffc870';
    return '#e57373';
  }

  function formatDate(dateString) {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // AP-style title case — detects deliberate casing vs mobile auto-cap artifacts
  // Protects "iOS Developer", "SaaS Engineer" (caps mid-word = deliberate)
  // Normalizes "Mall at millennia" from mobile auto-cap (caps only at word starts)
  function toTitleCaseOnBlur(value) {
    if (!value) return value;
    const trimmed = value.trim();
    if (!trimmed) return trimmed;
    // Check if any uppercase letter appears in a non-first position of any word.
    // If yes, user made deliberate casing choices (iOS, SaaS, PhD) — leave alone.
    // If no, it's either all lowercase, all uppercase, or mobile auto-cap —
    // all safe to run through title case.
    const words = trimmed.split(/\s+/);
    const hasMidWordCap = words.some(w => {
      for (let i = 1; i < w.length; i++) {
        if (w[i] >= 'A' && w[i] <= 'Z') return true;
      }
      return false;
    });
    if (hasMidWordCap) return trimmed;
    const smallWords = new Set(['a','an','and','as','at','but','by','for','if','in','nor','of','on','or','so','the','to','up','yet']);
    const acronyms = new Set(['hr','it','pr','qa','ui','ux','vp','ceo','cfo','coo','cto','cmo','seo','ai','ml']);
    const tokens = trimmed.toLowerCase().split(/(\s+)/); // preserve whitespace tokens
    const wordIndices = [];
    tokens.forEach((tok, i) => { if (tok.trim() !== '') wordIndices.push(i); });
    const firstIdx = wordIndices[0];
    const lastIdx = wordIndices[wordIndices.length - 1];
    return tokens.map((tok, i) => {
      if (tok.trim() === '') return tok;
      // Strip punctuation for acronym lookup but preserve it in output
      const cleanTok = tok.replace(/[^a-z]/g, '');
      if (acronyms.has(cleanTok)) return tok.toUpperCase();
      const isFirst = i === firstIdx;
      const isLast = i === lastIdx;
      if (!isFirst && !isLast && smallWords.has(tok)) return tok;
      return tok.charAt(0).toUpperCase() + tok.slice(1);
    }).join('');
  }

  // Modal state and handlers
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  // The Vault prompt, which is a different offer from the Pro one above:
  // opening a resume you already built is $4.99, not $29.99.
  const [vaultPrompt, setVaultPrompt] = useState(null);
  const [errorToast, setErrorToast] = useState(null);

  // Tour handlers
  const handleNextTourScreen = () => {
    setTourScreen(tourScreen + 1);
  };

  const handleSkipTour = () => {
    setShowTourModal(false);
  };

  const handleCompleteTour = () => {
    setShowTourModal(false);
  };

  const handleStartResumeChat = async () => {
    setCreatingChat(true);
    try {
      const { data: { user: chatUser } } = await supabase.auth.getUser();
      if (!chatUser) {
        setCreatingChat(false);
        return;
      }
      // ---- ONE CORE RESUME ----
      // This only renders from the empty state, and the empty state asks
      // whether there is a real core - so an account holding nothing but
      // abandoned chat rows reaches it and would write another one. Asked
      // again here, against the database rather than against the payload the
      // page loaded, which is also what stops a second tab doing it.
      if (await hasRealCore(supabase, chatUser.id)) {
        setErrorToast(ONE_CORE_MESSAGE);
        setCreatingChat(false);
        await loadData();
        return;
      }
      const { data: newResume, error } = await supabase
        .from('resumes')
        .insert({
          user_id: chatUser.id,
          resume_type: 'core',
          display_name: 'Core Resume',
          resume_data: {},
          journey_step: 'chat',
          created_via: 'resume_chat'
        })
        .select()
        .single();
      if (error || !newResume) {
        console.error('Failed to create resume chat record:', error);
        setCreatingChat(false);
        return;
      }
      try { await fetch('/api/loops/mark-has-resume', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: chatUser.id }) }) } catch (e) { console.error('Loops hasResume update failed (non-blocking):', e) }
      // Don't close the modal before navigating — it unmounts when navigation
      // completes, which avoids a flash of the empty state on the way out.
      router.push(`/resume/${newResume.id}`);
    } catch (err) {
      console.error('Resume chat start error:', err);
      setCreatingChat(false);
    }
  };

  // Handle file upload (from empty state)
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Clear previous errors
    setUploadError(null);
    setUploading(true);

    try {
      // ---- ONE CORE RESUME ----
      // Before the file is uploaded and parsed, not after: the two API calls
      // below cost real time and money, and there is no point spending either
      // on a resume this will refuse to save. See handleStartResumeChat for
      // why the empty state is not a sufficient guard on its own.
      if (await hasRealCore(supabase, user.id)) {
        setUploadError(ONE_CORE_MESSAGE);
        setUploading(false);
        await loadData();
        return;
      }

      // Validate file type
      const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error('INVALID_TYPE');
      }

      // Validate file size (10MB max)
      const maxSize = 10 * 1024 * 1024; // 10MB in bytes
      if (file.size > maxSize) {
        throw new Error('FILE_TOO_LARGE');
      }

      // 1. Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('resumes')
        .upload(filePath, file);

      if (uploadError) throw new Error('UPLOAD_FAILED');

      // 2. Parse the file (extract text)
     const { data: { session: uploadSession } } = await supabase.auth.getSession()
      const parseResponse = await fetch('/api/parse-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${uploadSession.access_token}` },
        body: JSON.stringify({ filePath })
      })

      if (!parseResponse.ok) {
        throw new Error('PARSE_FAILED');
      }

      const { text } = await parseResponse.json();

      // 3. Extract structured data
      const extractResponse = await fetch('/api/extract-resume-structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${uploadSession.access_token}` },
        body: JSON.stringify({ parsedText: text })
      });

      if (!extractResponse.ok) {
        throw new Error('EXTRACT_FAILED');
      }

      const { data: resumeData } = await extractResponse.json();

      // 4. Save to database (resumes table)
      const { data: savedResume, error: saveError } = await supabase
        .from('resumes')
        .insert({
          user_id: user.id,
          resume_type: 'core',
          display_name: 'Core Resume',
          resume_data: resumeData,
          journey_step: 'review',
          file_path: filePath
        })
        .select()
        .single();

      if (saveError) throw new Error('SAVE_FAILED');

      // 5. Redirect to resume detail page
      track('resume_uploaded', { method: 'upload' })
      try { await fetch('/api/loops/mark-has-resume', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) }) } catch (e) { console.error('Loops hasResume update failed (non-blocking):', e) }
      router.push(`/resume/${savedResume.id}`);

    } catch (error) {
      console.error('Upload error:', error);
      
      // Set specific error messages
      let errorMessage = 'Upload failed. Please try again.';
      
      if (error.message === 'INVALID_TYPE') {
        errorMessage = 'Please upload a PDF or DOCX file.';
      } else if (error.message === 'FILE_TOO_LARGE') {
        errorMessage = 'File is too large. Maximum size is 10MB.';
      } else if (error.message === 'PARSE_FAILED') {
        errorMessage = 'Couldn\'t read file. Try a different format.';
      } else if (error.message === 'UPLOAD_FAILED' || error.message === 'EXTRACT_FAILED' || error.message === 'SAVE_FAILED') {
        errorMessage = 'Upload failed. Please try again.';
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorMessage = 'Connection lost. Check your internet.';
      }
      
      setUploadError(errorMessage);
      setUploading(false);
    }
  };

  // Button handlers
  // Both of these are reached from six places between them - the card, the
  // mobile row, the thumbnail, the menu - so the gate lives here rather than
  // on each button. The buttons show the lock; this refuses the action.
  // True when the account may not have this resume, and shows the offer as a
  // side effect. Returns a boolean so a handler reads `if (lockedResume(id))
  // return` and cannot fall through to the thing it was guarding.
  const lockedResume = (resumeId) => {
    if (canAccessBuiltWork(data?.userTier)) return false;
    const keptCore = data?.accessibleCoreId ?? data?.coreResume?.id ?? null;
    if (resumeId === keptCore) return false;
    const isVersion = (data?.resumeVersions || []).some(v => v.id === resumeId);
    setVaultPrompt({
      title: isVersion ? 'Your job-specific resumes are still here.' : 'Your other core resumes are still here.',
      message: isVersion ? LOCK_COPY.job_specific : LOCK_COPY.extra_core,
    });
    return true;
  };

  const handleOpenResume = (resumeId) => {
    if (lockedResume(resumeId)) return;
    router.push(`/resume/${resumeId}`);
  };

  const handleDownloadResume = async (resumeId) => {
    if (lockedResume(resumeId)) return;
    try {
      setDownloadingResumeId(resumeId); // Mark this resume as downloading
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      // Fetch the resume DIRECTLY from Supabase (same as resume detail page)
      // This ensures we get the complete resume_data field
      const { data: resume, error } = await supabase
        .from('resumes')
        .select('*')
        .eq('id', resumeId)
        .eq('user_id', user.id)
        .single();

      if (error || !resume) {
        throw new Error('Resume not found');
      }

      // Now resume has resume_data just like in the detail page!
      // Convert font size to API format
      let fontSizeForApi = 'medium';
      const resumeFontSize = resume.font_size || 11;
      if (resumeFontSize <= 10) fontSizeForApi = 'small';
      else if (resumeFontSize === 11) fontSizeForApi = 'medium';
      else if (resumeFontSize >= 12) fontSizeForApi = 'large';
      
      // Capitalize template name
      const templateName = resume.template_id || 'modern';
      const templateForApi = templateName.charAt(0).toUpperCase() + templateName.slice(1);

      // Call PDF generation API
      const { data: { session: dlSession } } = await supabase.auth.getSession()
      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${dlSession.access_token}`
        },
        body: JSON.stringify({
            resumeData: resume.resume_data,
            resumeId: resumeId,
            templateName: templateForApi,
            fontSize: resume.font_size || 11,
            font: resume.font_family || 'Lato',
            accentColor: resume.accent_color || '#5b4fcf',
            spacing: resume.spacing || 1,
            action: 'download',
            versionId: null,
            isJobVersion: false,
            userId: user.id
          })
      });

      if (!response.ok) {
        throw new Error("We couldn't generate your PDF. Please try again.");
      }

      const result = await response.json();

      // Fetch PDF as blob
      const pdfResponse = await fetch(result.pdfUrl);
      if (!pdfResponse.ok) {
        throw new Error("We couldn't download your PDF. Please try again.");
      }
      const contentType = pdfResponse.headers.get('content-type') || '';
      if (!contentType.includes('application/pdf')) {
        throw new Error("We couldn't download your PDF. Please try again.");
      }
      const blob = await pdfResponse.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      // Download with proper filename - EXACT same logic as resume detail page
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${(resume.resume_data?.fullName || 'Resume').replace(/\s+/g, '_')}_Resume.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);

    } catch (error) {
      setErrorToast(error.message);
    } finally {
      setDownloadingResumeId(null); // Clear downloading state
    }
  };

  const handleDeleteResume = async (resumeId) => {
    // Outside Pro a job-specific resume cannot be taken off the panel: the
    // allowance is for life and nothing hands a slot back, so removing one
    // would cost the work and keep the cost.
    //
    // THIS IS THE ENFORCEMENT, NOT A SECOND LAYER
    // There is no database trigger behind it. One was written and deliberately
    // not installed: these rows are removed by cascade when an account is
    // deleted, and a BEFORE DELETE trigger that reads profiles cannot survive
    // that - the profiles row is already gone by then, so it would refuse the
    // cascade and break account deletion on every plan. So the button is
    // hidden on these plans and this is the check. Anyone holding the account's
    // own key can still do it directly.
    //
    // The core resume is not in that rule - archiving it is how somebody
    // starts again - so it is excluded by id rather than by tier.
    if (!mayCreate && resumeId !== coreResume?.id) {
      setConfirmDeleteId(null);
      setErrorToast("Job-specific resumes can't be deleted on your plan. Each one counts toward your 3 for life.");
      return;
    }
    try {
      setDeletingId(resumeId);
      const now = new Date().toISOString();

      // Archive the resume itself. JS resumes parented to this one stay active —
      // they're standalone artifacts tied to their own job cards.
      const { error } = await supabase
        .from('resumes')
        .update({ is_active: false, updated_at: now })
        .eq('id', resumeId)
        .eq('user_id', user.id);
      if (error) throw error;

      // Nothing to release. A Career Direction used to take the id of the core
      // built for it, so archiving one left a direction pointing at a resume
      // that no longer existed and had to be told to let go. No direction owns
      // a resume now - every one of them reads the account's single core - so
      // archiving a core says nothing about any direction.

      setConfirmDeleteId(null);
      await loadData();
      setErrorToast("Job-specific resume deleted. Restart it anytime from your Job Tracker.");
    } catch (error) {
      console.error('Archive error:', error?.message || error?.code || JSON.stringify(error));
      setErrorToast('Could not archive resume. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleCopyToJobSpecific = (resumeId) => {
    const isProUser = data?.userTier === TIERS.PRO;
    if (isProUser) {
      setJobModalSourceId(resumeId);
      setShowJobModal(true);
    } else {
      track('upgrade_clicked', { source: 'resume_coach' })
      setShowUpgradeModal(true);
    }
  };

  async function handleCreateJobSpecific() {
    if (!jobTitle.trim() || !jobDescription.trim()) {
      setJobCreateError('Please fill in the job title and job description.');
      return;
    }
    setCreatingJob(true);
    setJobCreateError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("You're signed out. Please refresh and sign in again.");

      // Get source resume data
      const sourceId = jobModalSourceId || data?.coreResume?.id;
      const { data: sourceResume, error: fetchError } = await supabase
        .from('resumes')
        .select('*')
        .eq('id', sourceId)
        .single();
      if (fetchError) throw fetchError;

      // Run job analysis FIRST so we don't create an orphaned resume record
      // if analysis fails. (Previously the insert ran before the analysis,
      // and a failed analysis left a half-empty record in the database.)
      const { data: { session: jobSession } } = await supabase.auth.getSession()
      const analysis = await fetchJSON('/api/job-analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jobSession.access_token}`
        },
        body: JSON.stringify({
          resumeData: sourceResume.resume_data,
          jobDescription,
          jobTitle,
          jobCompany,
          userId: user.id
        })
      });

      // Now create the job-specific resume record with the analysis baked in
      const { data: newResume, error: insertError } = await supabase
        .from('resumes')
        .insert({
          user_id: user.id,
          resume_type: 'job_specific',
          parent_resume_id: sourceId,
          display_name: jobCompany.trim() ? `${jobTitle} at ${jobCompany}` : jobTitle,
          resume_data: sourceResume.resume_data,
          job_title: jobTitle,
          job_company: jobCompany,
          job_description: jobDescription,
          journey_step: 'assess',
          template_id: sourceResume.template_id || 'modern',
          font_family: sourceResume.font_family || 'Lato',
          font_size: sourceResume.font_size || 11,
          current_score: analysis.matchScore,
          ai_analysis: analysis,
          last_assessed_at: new Date().toISOString()
        })
        .select()
        .single();
      if (insertError) throw insertError;

      fireT5IfFirst(supabase)
      fireB2IfThird(supabase)

      // Navigate to new resume
      router.push(`/resume/${newResume.id}`);
    } catch (err) {
      const limitMessage = LIMIT_MESSAGES[err.message];
      setJobCreateError(limitMessage || err.message);
      if (limitMessage) setShowUpgradeModal(true);
    } finally {
      setCreatingJob(false);
    }
  }

  async function handleCreateCoverLetter() {
    if (!clJobTitle.trim() || !clJobDescription.trim()) {
      setClCreateError('Please fill in the job title and job description.');
      return;
    }
    setCreatingCL(true);
    setClCreateError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("You're signed out. Please refresh and sign in again.");

      const jobTitle = clJobTitle;
      const jobCompany = clCompany;
      const jobDescription = clJobDescription;
      let resolvedSourceId = clSelectedJSId;
      if (!resolvedSourceId && jobTitle) {
        let matchQuery = supabase
          .from('applications')
          .select('resume_id')
          .eq('user_id', user.id)
          .ilike('title', jobTitle.trim())
          .not('resume_id', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1);
        if (jobCompany) matchQuery = matchQuery.ilike('company', jobCompany.trim());
        const { data: matchingCard } = await matchQuery.maybeSingle();
        resolvedSourceId = matchingCard?.resume_id || null;
      }
      const linkedResumeId = resolvedSourceId || data.coreResume.id;
      const sourceResumeId = resolvedSourceId || data.coreResume.id;
      const { data: sourceResume } = await supabase
        .from('resumes')
        .select('resume_data, template_id, font_family, ai_analysis')
        .eq('id', sourceResumeId)
        .single();

      const { data: { session: clSession } } = await supabase.auth.getSession()

      // ── CAREER KNOWLEDGE (relevance-matched to this job) ──
      // Send only the confirmed experience that closes a gap in THIS job
      // description rather than the candidate's whole history. Purely additive:
      // every failure path leaves the list empty and the letter is written from
      // the resume alone, so a knowledge lookup can never block a cover letter.
      let knowledgeMatches = [];
      try {
        // A job-specific source resume was already analyzed against this role,
        // so reuse its keywords rather than paying for a second analysis. Only
        // a core-resume source (which stores a quality analysis with no
        // missingKeywords) falls through to the live call.
        // A free account's job match scores are a separate, smaller allowance, and
        // this call would spend one of them on a cover letter. Keywords only enrich
        // the letter, so a free account takes the resume-alone path instead.
        const isProUser = data?.userTier === TIERS.PRO;
        let missingKeywords = Array.isArray(sourceResume?.ai_analysis?.missingKeywords)
          ? sourceResume.ai_analysis.missingKeywords
          : [];
        if (isProUser && missingKeywords.length === 0) {
          const clAnalysis = await fetchJSON('/api/job-analyze', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${clSession.access_token}`
            },
            body: JSON.stringify({
              resumeData: sourceResume?.resume_data,
              jobDescription,
              jobTitle,
              jobCompany,
              userId: user?.id
            })
          });
          missingKeywords = Array.isArray(clAnalysis?.missingKeywords) ? clAnalysis.missingKeywords : [];
        }

        // match returns nothing without keywords, so skip the round trip.
        if (missingKeywords.length > 0) {
          const knowledgeData = await fetchJSON('/api/career-knowledge', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${clSession.access_token}`
            },
            body: JSON.stringify({
              action: 'match',
              missingKeywords,
              jobTitle,
              jobCompany
            })
          });
          knowledgeMatches = Array.isArray(knowledgeData?.matches) ? knowledgeData.matches : [];
        }
      } catch (knowledgeErr) {
        console.error('Career knowledge match for cover letter failed (non-blocking):', knowledgeErr);
      }

      let generateData;
      try {
        generateData = await fetchJSON('/api/cover-letter-finish', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${clSession.access_token}`
          },
          body: JSON.stringify({
            resumeData: sourceResume?.resume_data,
            jobTitle,
            jobCompany,
            jobDescription,
            positioningStatement: positioningStatement.trim() || null,
            additionalContext: clAdditionalContext,
            userId: user?.id,
            knowledgeMatches: knowledgeMatches || []
          })
        });
      } catch (fetchErr) {
        // Special handling for RESUME_JD_MISMATCH — keep modal open
        // so the user can adjust their inputs without losing them.
        if (fetchErr.code === 'RESUME_JD_MISMATCH') {
          setClCreateError("The resume and job description don't appear to match closely enough to write a cover letter. Try a different job description or resume.");
          setCreatingCL(false);
          return;
        }
        throw fetchErr;
      }

      const { coverLetterData } = generateData;

      const { data: newCL, error: insertError } = await supabase
        .from('cover_letters')
        .insert({
          user_id: user.id,
          linked_resume_id: linkedResumeId,
          job_title: jobTitle,
          job_company: jobCompany,
          job_description: jobDescription,
          cover_letter_data: coverLetterData,
          template_id: sourceResume?.template_id || 'modern',
          font_family: sourceResume?.font_family || 'Lato',
          status: 'draft'
        })
        .select()
        .single();

      if (insertError) throw insertError;

      fireT8IfFirst(supabase)

      router.push(`/cover-letter/${newCL.id}`);
    } catch (err) {
      const limitMessage = LIMIT_MESSAGES[err.message];
      setClCreateError(limitMessage || err.message);
      if (limitMessage) setShowUpgradeModal(true);
    } finally {
      setCreatingCL(false);
    }
  }

  const handleDeleteCoverLetter = async (clId) => {
    // Outside Pro the allowance is for life and nothing hands a slot back,
    // so deleting would cost the work and keep the cost. See
    // handleDeleteResume above.
    if (!mayCreate) {
      setConfirmDeleteCLId(null);
      setErrorToast("Cover letters can't be deleted on your plan. Each one counts toward your 3 for life.");
      return;
    }
    try {
      setDeletingCLId(clId);
      const { error } = await supabase
        .from('cover_letters')
        .delete()
        .eq('id', clId)
        .eq('user_id', user.id);
      if (error) throw error;
      setConfirmDeleteCLId(null);
      await loadData();
      setErrorToast("Cover letter deleted. Restart it anytime from your Job Tracker.");
    } catch (error) {
      console.error('Delete CL error:', error);
      setErrorToast('Could not delete cover letter. Please try again.');
    } finally {
      setDeletingCLId(null);
    }
  };

  const handleCreateNew = () => {
    const isProUser = data?.userTier === TIERS.PRO;
    if (isProUser) {
      setJobModalSourceId(data?.coreResume?.id || null);
      setShowJobModal(true);
    } else {
      setShowUpgradeModal(true);
    }
  };

  const handleStartCoaching = async () => {
    if (!coreResume) return;
    
    const journeyStep = coreResume.journey_step || 'review';
    const resumeId = coreResume.id;
    
    // Special case: If journey is "save", trigger download instead of navigating
    if (journeyStep === 'save') {
      setIsDownloading(true);
      await handleDownloadResume(resumeId);
      setIsDownloading(false);
      return;
    }
    
    // Navigate to appropriate step for all other journey steps
   const nextSteps = isPro ? {
      review: `/resume/${resumeId}?step=assess`,
      assess: `/resume/${resumeId}?step=coach`,
      coach: `/resume/${resumeId}?step=improve`,
      improve: `/resume/${resumeId}?step=format`,
      format: `/resume/${resumeId}?step=save`
    } : {
      review: `/resume/${resumeId}?step=assess`,
      assess: `/resume/${resumeId}?step=coach`,
      coach: `/resume/${resumeId}?step=improve`,
      improve: `/resume/${resumeId}?step=format`,
      format: `/resume/${resumeId}?step=save`
    };

    const destination = nextSteps[journeyStep] || `/resume/${resumeId}`;

    // ---- ONE FULL COACHING SESSION, EVER ----
    //
    // Outside Pro the core gets coached once per account, archived cores
    // counted. /api/coach refuses a second start; this is so the refusal is
    // an offer here rather than a dead session two pages in.
    //
    // Only when this step is the one that starts a session, and only when
    // this resume has no conversation to go back to - a core already being
    // coached, or already coached and reopened, is continuing rather than
    // starting, which is what the route allows too.
    //
    // Either heading into the coach step from Assess, or already standing on
    // it. The second case is the one the panel is showing the spent-session
    // sentence for, and its button has to answer the same way - from that step
    // the button navigates on to Improve, so without it the button would walk
    // past the lock rather than into it.
    //
    // coachingLockShowing is the shared flag: the panel's sentence and the
    // button's label read it too.
    if (coachingLockShowing && (destination.includes('step=coach') || journeyStep === 'coach')) {
      setShowUpgradeModal(true);
      return;
    }

    router.push(destination);
  };

  // Journey step messages (tier-specific)
  const getJourneyMessage = (step) => {
    const isFree = !isPro; // Free tier check
    
    const messages = {
      review: "Your resume is in! Now make sure everything landed in the right place - AI parsing is good, not perfect. Give it a quick review, then we'll assess.",
      assess: "Time to assess what you’re working with. Get your Resume Power Score and a breakdown of what's working and what's not - specific to your experience, not generic advice.",
      // Outside Pro there is one full session, ever. Before it is spent, this
      // says what it is and that there is one of it; after, it says so and
      // points at the plan that lifts it - the same sentence the lock itself
      // uses, from lib/coreResumes, so the hub and the resume page cannot word
      // one refusal two ways.
      coach: isFree
        ? (coachingLockShowing
            ? CORE_COACHING_USED_MESSAGE
            : "Your career deserves a conversation. We'll talk through your experience and surface the achievements your resume is leaving out. Your plan includes one full coaching session.")
        : "Chat your way to a better resume. Through conversation, we'll uncover quantifiable achievements, transferable skills, and results you forgot were impressive.",
     improve: isFree 
        ? "Review the suggestions from your assessment and make changes directly to your resume. When you're done, you can format, save, and download your improved resume."
        : "The big reveal! See your updated Resume Power Score, review each improvement your coach made, then keep, reject, or edit each change.",
      format: "Content is locked in. Run Auto-fit to get the perfect page fit, try different templates, and preview the end result before downloading.",
      save: isFree
        ? "Your core resume is complete! Download it for immediate use, and when you're ready, upload a job description to create a cover letter or see how well your resume matches that role."
        : "Your core resume is bulletproof. Download it for immediate use, or create job-specific versions with cover letters to match."
    };
    return messages[step] || messages.review;
  };

  // Get button text based on journey step
  const getButtonText = (step) => {
    const buttonText = {
      review: "Start Review",
      assess: "Start Assessment",
      coach: "Start Coaching",
      improve: "Improve Resume",
      format: "Format Resume",
      save: "Download Resume"
    };
    return buttonText[step] || "Continue";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-purple-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // Show error state if loading failed
  if (loadError) {
    return (
      <AppShell sidebar={<>
        {/* Left Sidebar */}
        
          {resumeCoachSidebar}
        </>}>

        {/* Main Content */}
        <AppShell.Main>
          <MainNav currentPage="resume-coach" userProfile={userProfile} onUpgradeClick={() => setShowUpgradeModal(true)} />

          <div className="flex-1 overflow-y-auto">
            <div className="px-8 py-4 max-w-[1400px] mx-auto w-full">
              {/* Error State - Centered */}
              <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 200px)' }}>
                <div className="bg-white rounded-lg shadow-sm border-2 border-amber-200 p-8 max-w-md text-center">
                  <svg className="w-16 h-16 text-amber-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load Resumes</h2>
                  <p className="text-sm text-gray-600 mb-6">{loadError}</p>
                  <button
                    onClick={() => {
                      setLoadError(null);
                      setRetryCount(0);
                      setLoading(true);
                      loadData();
                    }}
                    className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors font-medium"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            </div>
          </div>
        </AppShell.Main>
      </AppShell>
    );
  }

  const activeChatResume = data?.activeChatResume || null;
  // The one core resume this account has. There used to be up to three, one
  // per Career Direction, and this read a selected id out of a list the tile
  // strip below switched between. There is one, so the card reads it.
  const coreResume = data?.coreResume || null;
  const isPro = data?.userTier === TIERS.PRO;
  // ---- TWO QUESTIONS, NOT ONE ----
  // mayCreate is "may this account build something new" and is Pro. mayAccess
  // is "may this account use what it already built" and includes Vault, which
  // is the whole point of the plan. This card used to ask isPro for both, so a
  // Vault subscriber was shown the free account's Job Match Scores panel and
  // had no route at all to the job-specific resumes it had paid to keep.
  const mayCreate = canCreateResumes(data?.userTier);
  const mayAccess = canAccessBuiltWork(data?.userTier);
  // Which core a free account keeps is still read, by `lockedResume` above,
  // because a lapsed Pro account may hold archived extras it can restore. The
  // tile row that used to read it here - and grey out the cores this account
  // may not open - is gone with the rest of the multi-core surface.
  const clLimitReached = !isPro && (data?.userProfile?.cl_count ?? 0) >= 3;
  const jmsLimitReached = !isPro && (data?.userProfile?.jms_count ?? 0) >= 3;

  // ---- THE CAREER PROFILE SLOT ----
  //
  // One slot under the resume card, and two things that can fill it.
  //
  // The invitation, once there is something to open: a coached core resume,
  // which is what the profile is written out of, and a Career Profile row to
  // send them to. Either one missing and the card would point at an empty
  // page.
  //
  // The notice, while the core resume is still being coached - which is the
  // moment the profile is worth telling somebody about, because it is the
  // reason to finish.
  //
  // Coached with no profile row falls between the two and gets neither. That
  // is a state the account should not be in for long (coaching creates the
  // row), and the honest thing to show for it is nothing rather than an offer
  // that would 404 or a promise that has already come due.
  const coachingDone = Boolean(coreResume?.coaching_complete);
  const showCareerProfileCard = coachingDone && data?.hasCareerProfile === true;
  const showCareerProfileAd = Boolean(coreResume) && !coachingDone;
  // Whether the slot is filled at all. The resume card above tightens its
  // padding and drops its subtitle to make room, and it has to do that for
  // either card rather than for one of them - otherwise the page spaces
  // itself differently depending on which is showing.
  const careerProfileSlotFilled = showCareerProfileCard || showCareerProfileAd;

  // ---- THE ONE COACHING SESSION, SPENT ----
  // One flag for the three things that have to agree about it: the sentence in
  // "What This Means", the label on the button beside it, and what the button
  // does. It was three separate conditions, which is how the panel came to
  // announce the lock while the button still offered to start a session.
  const coachingLockShowing = !isPro
    && data?.coreCoachingUsed === true
    && !coreResume?.has_coaching_conversation;
  // The owner's own profile in the drawing where the route could fill it, the
  // fixed sample otherwise. The route returns null rather than a part-filled
  // object, so this is the whole decision - see careerProfilePreview there.
  const miniProfileData = data?.careerProfilePreview || SAMPLE_PROFILE;

  // What to call a job-specific resume in a list. The job title, which is what
  // every one of these is made from and named after - except the ones that are
  // not. A resume converted out of the old per-direction core carries a name
  // and no job, because it was never made for a posting, and showing the title
  // alone left those rows blank with a score beside them. The stored name is
  // the next best answer and is always there.
  const versionTitle = (version) =>
    version?.job_title || version?.version_name || 'Untitled Resume';
  const score = coreResume?.current_score || null;
  const journeyStep = coreResume?.journey_step || 'review';
  const displayStep = (journeyStep === 'assess' && score) ? 'coach' : journeyStep;

  // Show placeholder scores in review OR assess steps (before assessment runs) OR when no score exists
  const showPlaceholder = (journeyStep === 'review' || journeyStep === 'assess') && !score;

  // Journey steps for progress bar (tier-specific)
 const steps = isPro 
    ? ['review', 'assess', 'coach', 'improve', 'format', 'save']
    : ['review', 'assess', 'coach', 'improve', 'format', 'save'];
  const currentIndex = displayStep ? steps.indexOf(displayStep) : -1;
  const totalSteps = steps.length;

  return (
    <AppShell sidebar={<>
      
      {/* Left Sidebar */}
      
        {resumeCoachSidebar}
      </>}>

      {/* Main Content Area */}
      <AppShell.Main>
        <MainNav currentPage="resume-coach" userProfile={userProfile} />

        <div className="flex-1 overflow-y-auto md:flex md:flex-col">
          <div className="px-4 md:px-8 py-2 md:py-4 max-w-[1400px] mx-auto w-full md:flex-1 md:flex md:flex-col md:min-h-0">
            
            {/* Clean 2-Column Layout - NO OLD BANNER */}
            {data?.coreResume && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:flex-1 md:min-h-0 md:grid-rows-1">
                
                {/* Core Resume Card (8 cols) */}
                <div className="col-span-1 md:col-span-8 md:flex md:flex-col md:min-h-0">
                  <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-3 md:px-5 ${careerProfileSlotFilled ? "md:py-3" : "md:py-4"}`}>
                   <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <h2 className="text-lg font-semibold text-gray-900 truncate">{coreResume?.display_name || 'Core Resume'}</h2>
                        <TourReplayButton
                          storageKey={HUB_TOUR_KEY}
                          onReplay={() => setShowHubTour(true)}
                        />
                      </div>
                      <span className="md:hidden text-sm font-semibold px-3 py-1 rounded-md" style={{ backgroundColor: 'rgba(147, 51, 234, 0.08)', color: '#7e22ce' }}>Resume Writer</span>
                    </div>
                    {!careerProfileSlotFilled && (
                      <p className="text-sm text-gray-500 mb-3">Complete resume you can use for any job in your field</p>
                    )}
                    
                    {/* Mobile: 3 action buttons */}
                    <div className="flex md:hidden gap-2 mb-4">
                      <button
                        onClick={() => router.push(`/resume/${coreResume.id}`)}
                        className="flex-1 py-2 px-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 transition-colors"
                      >
                        View Resume
                      </button>
                      <button
                        onClick={() => handleDownloadResume(coreResume.id)}
                        disabled={downloadingResumeId === coreResume.id}
                        className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                      >
                        {downloadingResumeId === coreResume.id ? '...' : '⬇️ Download'}
                      </button>
                      {isPro && (
                      <button
                        onClick={() => setConfirmDeleteId(coreResume.id)}
                        className="flex-1 py-2 border border-red-200 rounded-lg text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
                      >
                        🗑 Delete
                      </button>
                      )}
                    </div>

                    {/* Thumbnail LEFT | Score RIGHT */}
                    <div className={"grid grid-cols-12 gap-4 mb-4"}>
                      
                      {/* Left: Thumbnail (35%) — desktop only */}
                      <div className={"hidden md:block md:col-span-4"}>
                        <div className="relative">
                          <div
                            onClick={() => router.push(`/resume/${coreResume.id}`)}
                            className="w-full group cursor-pointer"
                          >
                            <div className="relative bg-white rounded-lg overflow-hidden shadow-sm border border-gray-200" style={{ aspectRatio: '8.5/11' }}>
                              {coreResume.resume_data ? (
                                <div style={{ transform: 'scale(0.22)', transformOrigin: 'top left', width: '816px', pointerEvents: 'none', position: 'absolute', top: 0, left: 0 }}>
                                  <ResumeContent
                                    resumeData={coreResume.resume_data}
                                    onUpdate={() => {}}
                                    isUndoingRef={{ current: false }}
                                    formatDate={(d) => d || ''}
                                    readOnly={true}
                                  />
                                </div>
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gray-50">
                                  <div className="text-center">
                                    <div className="text-3xl mb-1">📄</div>
                                    <div className="text-sm text-gray-500">Resume</div>
                                  </div>
                                </div>
                              )}
                              
                              {/* Hover Overlay */}
                              <div
                                data-tour="core-actions"
                                className="absolute inset-0 bg-gray-900 bg-opacity-60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2"
                                style={hubTourStepId === 'core-actions' ? { opacity: 1 } : undefined}
                              >
                                {/* Gear/Settings - Opens resume */}
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenResume(coreResume.id);
                                  }}
                                  className="w-9 h-9 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center text-white transition-colors"
                                  title="Open resume"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                </button>
                                {/* Copy - Create job-specific */}
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopyToJobSpecific(coreResume.id);
                                  }}
                                  className="w-9 h-9 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center text-white transition-colors"
                                  title="Create job-specific resume"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                </button>
                                {/* Download */}
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownloadResume(coreResume.id);
                                  }}
                                  disabled={downloadingResumeId === coreResume.id}
                                  className="w-9 h-9 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Download PDF"
                                >
                                  {downloadingResumeId === coreResume.id ? (
                                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                  ) : (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                  )}
                                </button>
                                {/* Delete */}
                                {isPro && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmDeleteId(coreResume.id);
                                  }}
                                  className="w-9 h-9 rounded-full bg-[#e57373] hover:bg-[#c62828] flex items-center justify-center text-white transition-colors"
                                  title="Delete resume"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Single-line footer - subtle */}
                          <div className="mt-2 text-center text-xs text-gray-500">
                            {coreResume.resume_data?.fullName || 'Resume'} • Edited {formatDate(coreResume.updated_at).split(',')[0]}
                          </div>
                        </div>
                      </div>
                      
                      {/* Right: Score Section (65%) */}
                      <div data-tour="score" className={"col-span-12 flex flex-col justify-between py-3 md:col-span-8"}>
                        {/* Giant Score */}
                        <div className="text-center">
                          <div className="mb-3">
                            {!showPlaceholder ? (
                              <>
                                <span className={`text-7xl font-bold text-gray-900`}>{score}</span>
                                <span className="text-3xl text-gray-400">/100</span>
                              </>
                            ) : (
                              <>
                                <span className={`text-7xl font-bold text-gray-300`}>--</span>
                                <span className="text-3xl text-gray-300">/100</span>
                              </>
                            )}
                          </div>
                          <div className={"text-sm md:text-xs text-gray-500 uppercase tracking-wide mb-3"}>
                            {!showPlaceholder ? 'Resume Power Score' : 'Not Yet Assessed'}
                          </div>
                          
                          {/* Score Bar - Improved */}
                          <div className="max-w-md mx-auto">
                            <div className={"h-3 bg-gray-200 rounded-full overflow-hidden shadow-inner mb-3"}>
                              <div 
                                className="h-full transition-all duration-500"
                                style={{ 
                                  width: !showPlaceholder ? `${score}%` : '0%',
                                  background: !showPlaceholder ? (score >= 85 ? '#9333ea' : score >= 75 ? '#81c784' : score >= 60 ? '#ffc870' : '#e57373') : '#d1d5db'
                                }}
                              />
                            </div>
                            
                            {/* Simple text labels with dots */}
                          <div className="flex items-center justify-center gap-3 md:gap-10 text-xs md:text-xs text-gray-600 flex-wrap">
  {[
    { color: '#e57373', label: 'Needs Work' },
    { color: '#ffc870', label: 'Developing' },
    { color: '#81c784', label: 'Strong' },
    { color: '#9333ea', label: 'Excellent' },
  ].map(({ color, label }) => (
    <div key={label} className="flex items-center gap-1">
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }}></div>
      <span>{label}</span>
    </div>
  ))}
</div>
                          </div>
                        </div>
                        
                   {/* Breakdown Grid - Bigger Text */}
                        <div className="grid grid-cols-3 gap-1.5">
                          <div className="text-center p-1.5 bg-gray-50 rounded-lg">
                            <div className={"text-2xl font-bold mb-0.5"}>
                              {!showPlaceholder ? (
                                <>
                                  <span className="text-gray-900">{coreResume.score_breakdown?.impact ?? '--'}</span>
                                  <span className="text-sm text-gray-400">/50</span>
                                </>
                              ) : (
                                <>
                                  <span className="text-gray-300">--</span>
                                  <span className="text-sm text-gray-300">/50</span>
                                </>
                              )}
                            </div>
                            <div>
                           <div className={"text-xs md:text-[10px] text-gray-600 uppercase tracking-wide mb-0.5"}>Impact</div>
                            {!showPlaceholder ? (
                              <div className="flex items-center justify-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: getBreakdownLabel(coreResume.score_breakdown?.impact ?? 0, 50).color }}></span>
                                <span className={`text-xs md:text-[10px] font-medium ${getBreakdownLabel(coreResume.score_breakdown?.impact ?? 0, 50).text}`}>
                                  {getBreakdownLabel(coreResume.score_breakdown?.impact ?? 0, 50).label}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                <span className="text-xs md:text-[10px] text-gray-400">—</span>
                              </div>
                            )}
                            </div>
                          </div>
                          
                          <div className="text-center p-1.5 bg-gray-50 rounded-lg">
                            <div className={"text-2xl font-bold mb-0.5"}>
                              {!showPlaceholder ? (
                                <>
                                  <span className="text-gray-900">{coreResume.score_breakdown?.clarity ?? '--'}</span>
                                  <span className="text-sm text-gray-400">/30</span>
                                </>
                              ) : (
                                <>
                                  <span className="text-gray-300">--</span>
                                  <span className="text-sm text-gray-300">/30</span>
                                </>
                              )}
                            </div>
                            <div>
                            <div className={"text-xs md:text-[10px] text-gray-600 uppercase tracking-wide mb-0.5"}>Clarity</div>
                            {!showPlaceholder ? (
                              <div className="flex items-center justify-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: getBreakdownLabel(coreResume.score_breakdown?.clarity ?? 0, 30).color }}></span>
                                <span className={`text-xs md:text-[10px] font-medium ${getBreakdownLabel(coreResume.score_breakdown?.clarity ?? 0, 30).text}`}>
                                  {getBreakdownLabel(coreResume.score_breakdown?.clarity ?? 0, 30).label}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                <span className="text-xs md:text-[10px] text-gray-400">—</span>
                              </div>
                            )}
                            </div>
                          </div>
                          
                          <div className="text-center p-1.5 bg-gray-50 rounded-lg">
                            <div className={"text-2xl font-bold mb-0.5"}>
                              {!showPlaceholder ? (
                                <>
                                  <span className="text-gray-900">{coreResume.score_breakdown?.keywords ?? '--'}</span>
                                  <span className="text-sm text-gray-400">/20</span>
                                </>
                              ) : (
                                <>
                                  <span className="text-gray-300">--</span>
                                  <span className="text-sm text-gray-300">/20</span>
                                </>
                              )}
                            </div>
                            <div>
                            <div className={"text-xs md:text-[10px] text-gray-600 uppercase tracking-wide mb-0.5"}>Keywords</div>
                            {!showPlaceholder ? (
                              <div className="flex items-center justify-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: getBreakdownLabel(coreResume.score_breakdown?.keywords ?? 0, 20).color }}></span>
                                <span className={`text-xs md:text-[10px] font-medium ${getBreakdownLabel(coreResume.score_breakdown?.keywords ?? 0, 20).text}`}>
                                  {getBreakdownLabel(coreResume.score_breakdown?.keywords ?? 0, 20).label}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                <span className="text-xs md:text-[10px] text-gray-400">—</span>
                              </div>
                            )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div data-tour="progress" className="mb-4">
                      <div className={"text-sm md:text-xs font-semibold text-gray-400 uppercase tracking-wide text-center mb-2"}>Progress</div>
                      <div className="relative max-w-2xl mx-auto">
                        <div className="absolute top-2.5 left-0 right-0 h-px bg-gray-200">
                          <div 
                            className="h-full bg-purple-600 transition-all" 
                            style={{ width: `${currentIndex >= 0 ? ((currentIndex + 1) / totalSteps) * 100 : 33}%` }}
                          />
                        </div>
                        <div className="relative flex justify-between">
                          {(isPro 
                            ? ['Review', 'Assess', 'Coach', 'Improve', 'Format', 'Save']
                            : ['Review', 'Assess', 'Coach', 'Improve', 'Format', 'Save']
                          ).map((step, index) => {
                            const isPast = currentIndex > index;
                            const isActive = currentIndex === index || (currentIndex < 0 && index <= 1);
                            
                            return (
                              <div key={step} className="flex flex-col items-center">
                               <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold z-10 ${
                  isPast ? 'text-white' : 
                  isActive ? 'text-white' : 
                  'bg-white border border-gray-300 text-gray-400'
                }`}
                style={(isPast || isActive) ? { background: 'linear-gradient(to bottom right, #667eea, #764ba2)' } : {}}>
                                  {isPast ? '✓' : isActive ? '●' : '○'}
                                </div>
                                <span className={`text-sm mt-1 ${
                                  isActive ? 'text-purple-600 font-semibold' :
                                  isPast ? 'text-purple-600' :
                                  'text-gray-400'
                                }`}>
                                  {step}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    
                    {/* What This Means */}
                    <div data-tour="progress-meaning" className="bg-purple-50 border-l-4 border-purple-600 p-3 rounded-r flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                      <div className="flex-1">
                       <div className="text-xs md:text-[10px] font-bold text-purple-600 uppercase tracking-wide mb-1">What This Means</div>
                        <p className="text-sm text-gray-700 leading-snug">
                          {getJourneyMessage(displayStep)}
                        </p>
                      </div>
                      <button 
                        onClick={handleStartCoaching}
                        disabled={isDownloading && (coreResume.journey_step === 'save')}
                        className={`text-white px-4 py-2 rounded-lg transition-opacity font-medium text-sm whitespace-nowrap flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${(coreResume.journey_step || 'review') === 'review' ? 'animate-pulse hover:animate-none' : ''}`}
                        style={{background:'linear-gradient(to right, #667eea, #764ba2)'}}
                      >
                        {isDownloading && (coreResume.journey_step === 'save') ? (
                          <>
                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Downloading...
                          </>
                        ) : (
                          <>
                            {coachingLockShowing && displayStep === 'coach'
                              ? 'Upgrade to Pro →'
                              : <>{displayStep === 'coach' && coreResume?.has_coaching_conversation ? 'Continue Coaching' : getButtonText(displayStep)} {displayStep !== 'save' && '→'}</>}
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* ---- THE CAREER PROFILE SLOT ----
                      Where the core-resume selector used to be: three tiles,
                      one per Career Direction, each either a core to switch to
                      or a core to build. There is one core resume now and
                      directions live on the Career Profile, so this slot is
                      the way across rather than a second place to manage them.

                      ONE CARD, TWO STATES
                      The invitation once there is a profile to open, the
                      notice before then, and they never both show. Same
                      container, same type, same drawing - only the words, the
                      link and the drawing's data change, so the slot does not
                      change shape when one becomes the other.

                      THE SAME BOX AS EVERY OTHER CARD ON THE HUB
                      White, with the same padding, radius and type scale.
                      There was a lavender wash and a violet glow here, on the
                      reasoning that the dark miniature reads as a hole in flat
                      white; the card is one of several in a column and being
                      the only coloured one was the louder problem. The lift
                      comes from the shadow instead, which is violet-tinted
                      rather than grey and is the only thing marking this card
                      out.

                      IT TAKES THE REST OF THE COLUMN
                      md:flex-1, so its bottom lands level with the right
                      column's whatever the boxes above it contain - it used
                      to size to its copy and leave a gap under itself. The
                      inner row carries md:h-full and the card does the
                      centring, so the graphic column's self-stretch has the
                      card's whole height to fill rather than just the copy's.

                      AND IT STILL CANNOT CLIP
                      flex-1 can shrink an item below its content, and this
                      card hides its overflow - but it carries no min-h-0, so
                      its automatic minimum size is its content and it refuses
                      to shrink past it. On a window too short for both cards
                      the scroller above takes it instead.

                      THE LINK IS A LINK
                      Download Resume is the hub's one filled button. This was
                      an outline button beside the text and is now the last few
                      words of it, in the same purple as every other "view all"
                      on the page. The whole card carries the click; the link
                      is what says so. */}
                  {careerProfileSlotFilled && (
                    <div
                      data-tour="career-profile"
                      className={`relative overflow-hidden rounded-lg bg-white p-3 md:px-5 md:py-3 mt-2 md:flex-1 md:flex md:flex-col ${showCareerProfileCard ? 'cursor-pointer' : ''}`}
                      style={{
                        border: '1px solid #ede9fe',
                        boxShadow: '0 4px 16px rgba(124,58,237,.10)'
                      }}
                      {...(showCareerProfileCard
                        ? {
                            role: 'link',
                            tabIndex: 0,
                            onClick: () => router.push('/career-profile'),
                            onKeyDown: (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                router.push('/career-profile');
                              }
                            }
                          }
                        : {})}
                    >
                      <div className="relative flex items-center w-full md:h-full" style={{ gap: 20, zIndex: 2 }}>
                        <div className="flex-1 min-w-0">
                          <h2 className="text-base font-semibold text-gray-900">
                            {showCareerProfileCard
                              ? 'Your Career Profile is ready.'
                              : 'Your career deserves more than one page.'}
                          </h2>
                          {/* The same type as the sentence in "What This
                              Means" below the progress bar: both are a short
                              paragraph explaining the card they sit in, and
                              two different greys for that job on one screen
                              was two answers to one question. */}
                          <p className="text-sm text-gray-700 leading-snug">
                            {showCareerProfileCard
                              ? 'A resume is one snapshot of your career. Your Career Profile brings the whole gallery into view.'
                              : 'As soon as your core resume is complete, we build your Career Profile. A resume is one snapshot. Your Career Profile is the whole gallery.'}
                            {/* Last words of the paragraph rather than a
                                control beside it. The card is the click
                                target; a nested button would be a second one
                                inside it. */}
                            {showCareerProfileCard && (
                              <span className="text-sm text-purple-600 hover:text-purple-700 font-medium transition-colors cursor-pointer whitespace-nowrap ml-1.5">
                                View your Career Profile →
                              </span>
                            )}
                          </p>
                        </div>

                        {/* ---- THE GRAPHIC COLUMN ----
                            A fixed-width window cut into the card's right
                            edge. The negative margins cancel the card's own
                            padding on three sides so the drawing can reach
                            those edges and be clipped by them; self-stretch
                            makes the window as tall as the row, whatever the
                            copy decided that was.

                            Hidden on a phone, where the card is barely wider
                            than the drawing and the copy needs all of it. */}
                        <div
                          aria-hidden="true"
                          className="hidden md:block relative self-stretch overflow-hidden flex-shrink-0"
                          style={{ width: 220, margin: '-0.75rem -1.25rem -0.75rem 0', pointerEvents: 'none' }}
                        >
                          <MiniProfileCard {...miniProfileData} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column: job specific Resumes + Cover Letters */}
                <div className="col-span-1 md:col-span-4 flex flex-col self-stretch">

                  {/* Card 1: job specific Resumes (Pro) / Job Match Scores (Free) */}
                  <div data-tour="job-specific" className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 flex flex-col overflow-hidden md:flex-1" style={{ marginBottom: '16px' }}>
                    {/* ---- WHICH PANEL THIS IS ----
                        mayCreate, not mayAccess. The list-everything panel
                        belongs to the plan with no ceiling; Free and Vault
                        share one allowance of three and both get the three
                        slots, the counter and the spent-slot explanation.
                        Vault reaches its Pro-made work through the link
                        under the slots, and opens it there, which is what
                        keeping what you built means. */}
                    {mayCreate ? (
                      <>
                        <h2 className="text-base font-semibold text-gray-900">Job-Specific Resumes</h2>
                        <p className="text-sm text-gray-500 mb-2">Tailored versions for specific applications</p>
                      <div>
                        <div className="space-y-2">
                          {/* Vault reaches this panel to use what is in it.
                              Making another one is Pro. */}
                          {mayCreate && (
                          <button
                            onClick={handleCreateNew}
                            className="w-full border-2 border-dashed border-gray-300 rounded-lg p-2.5 hover:border-purple-400 hover:bg-purple-50 transition-all flex items-center justify-center gap-2"
                          >
                            <div className="w-4 h-4 rounded-full bg-purple-100 flex items-center justify-center">
                              <svg className="w-2.5 h-2.5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                            </div>
                            <div className="text-sm font-semibold text-gray-900">Create New</div>
                          </button>
                          )}

                          {data.resumeVersions && data.resumeVersions.length > 0 ? (
                            <>
                              {data.resumeVersions.slice(0, 2).map((version) => (
                                <div
                                  key={version.id}
                                  className="group bg-white border border-gray-300 rounded-lg p-2 hover:border-purple-400 hover:shadow-sm transition-all cursor-pointer"
                                  onClick={() => router.push(`/resume/${version.id}`)}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm md:text-xs font-semibold text-gray-900 truncate">{versionTitle(version)}</div>
                                      <div className="text-xs md:text-[10px] text-gray-500 truncate">{version.job_company}</div>
                                    </div>
                                    <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                                      {isPro && <button
                                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(version.id); }}
                                        className="md:opacity-0 md:group-hover:opacity-100 w-5 h-5 rounded-full bg-[#fdecea] hover:bg-[#e57373] flex items-center justify-center text-[#e57373] hover:text-white transition-all"
                                        title="Delete"
                                      >
                                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      </button>}
                                      <div className="relative w-9 h-9">
                                        <svg className="w-9 h-9 transform -rotate-90">
                                          <circle cx="18" cy="18" r="14" stroke="#e5e7eb" strokeWidth="2.5" fill="none" />
                                          <circle
                                            cx="18" cy="18" r="14"
                                            stroke={getCircleColor(version.match_score)}
                                            strokeWidth="2.5" fill="none"
                                            strokeDasharray={`${2 * Math.PI * 14}`}
                                            strokeDashoffset={`${2 * Math.PI * 14 * (1 - version.match_score / 100)}`}
                                            strokeLinecap="round"
                                          />
                                        </svg>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                          <div className="text-[10px] font-bold" style={{ color: getCircleColor(version.match_score) }}>
                                            {version.match_score}%
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                              {data.resumeVersions.length > 2 && (
                               <button
                                    onClick={() => setShowOlderJSModal(true)}
                                    className="w-full text-center py-1.5 text-sm text-purple-600 hover:text-purple-700 font-medium transition-colors cursor-pointer"
                                  >
                                    View all job-specific resumes →
                                  </button>
                              )}
                            </>
                          ) : (
                            <div className="text-center py-4 text-gray-500">
                              <div className="text-2xl mb-1">🎯</div>
                              <p className="text-sm">No job-specific resumes yet.<br />Click "Create New" when you're ready.</p>
                            </div>
                          )}
                        </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-0.5">
                          <h2 className="text-base font-semibold text-gray-900">Job Match Scores</h2>
                          <span className={`text-xs md:text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            jmsLimitReached ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {Math.max(0, 3 - (data?.userProfile?.jms_count ?? 0))} of 3 remaining
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mb-2">Upload a job description to see how well your experience matches the role.</p>
                        <div className="space-y-1.5">
                          {allowanceSlots(data.resumeVersions, data?.userProfile?.jms_count).map((slot, slotIndex) => {
                            if (slot.kind === 'live') {
                              const version = slot.item
                              return (
                                <div
                                  key={version.id}
                                  className="group bg-white border border-gray-200 rounded-lg px-3 hover:border-purple-400 hover:shadow-sm transition-all cursor-pointer flex items-center"
                                  style={{ height: '44px' }}
                                  onClick={() => router.push(`/resume/${version.id}`)}
                                >
                                  <div className="flex items-center justify-between w-full">
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm md:text-xs font-semibold text-gray-900 truncate">{versionTitle(version)}</div>
                                      <div className="text-xs md:text-[10px] text-gray-500 truncate">{version.job_company}</div>
                                    </div>
                                    <div className="flex items-center gap-1 ml-2 flex-shrink-0 ml-auto">
                                      {/* No delete outside Pro. The slot is spent
                                          either way, so deleting would take the
                                          work and leave the cost. */}
                                      <div className="relative w-8 h-8">
                                        <svg className="w-8 h-8 transform -rotate-90">
                                          <circle cx="16" cy="16" r="12" stroke="#e5e7eb" strokeWidth="2.5" fill="none" />
                                          <circle
                                            cx="16" cy="16" r="12"
                                            stroke={getCircleColor(version.match_score)}
                                            strokeWidth="2.5" fill="none"
                                            strokeDasharray={`${2 * Math.PI * 12}`}
                                            strokeDashoffset={`${2 * Math.PI * 12 * (1 - version.match_score / 100)}`}
                                            strokeLinecap="round"
                                          />
                                        </svg>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                          <div className="text-[9px] font-bold" style={{ color: getCircleColor(version.match_score) }}>
                                            {version.match_score}%
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )
                            }

                            if (slot.kind === 'used') {
                              return (
                                <div
                                  key={`used-${slotIndex}`}
                                  className="w-full border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center gap-1.5 bg-gray-50 cursor-default"
                                  style={{ height: '44px' }}
                                >
                                  <div className="text-xs md:text-[10px] text-gray-400 font-semibold tracking-wide uppercase">
                                    Job Match Score {slotIndex + 1} · Used
                                  </div>
                                  <Popover label="Why does this slot say used?">
                                    Your plan includes 3 job match scores for life. This one has already been used, so it counts toward your 3.
                                  </Popover>
                                </div>
                              )
                            }

                            if (slot.kind === 'create') {
                              return (
                                <button
                                  key={`upload-${slotIndex}`}
                                  onClick={() => { setJobModalSourceId(data?.coreResume?.id || null); setShowJobModal(true); }}
                                  className="w-full border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center gap-2 hover:border-purple-400 hover:bg-purple-50 transition-all"
                                  style={{ height: '44px' }}
                                >
                                  <div className="w-4 h-4 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                                    <svg className="w-2.5 h-2.5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                  </div>
                                  <div className="text-sm font-semibold text-gray-700">Click to upload a job description</div>
                                </button>
                              )
                            }

                            return (
                              <div
                                key={`empty-${slotIndex}`}
                                className="w-full border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center bg-gray-50"
                                style={{ height: '44px' }}
                              >
                                <div className="text-xs md:text-[10px] text-gray-400 font-semibold tracking-wide uppercase">Job Match Score {slotIndex + 1}</div>
                              </div>
                            )
                          })}

                          <GoProLink onClick={() => setShowUpgradeModal(true)}>
                            Go Pro to tailor your resume to each job
                          </GoProLink>

                          {/* ---- THE WORK THEY MADE ON PRO ----
                              Not in the slots above: it was never one of the
                              three, so counting it would leave them a score
                              short. But it is still theirs, and an account
                              that cannot find it will assume it was deleted.
                              So the panel says where it went.

                              Only when there is some. The link is built from
                              proResumeVersions, which the route fills only for
                              a non-Pro account - on Pro they are all in the
                              list above and there is nothing to look for.

                              Under the Go Pro link and behind a rule, because
                              it is a different kind of offer: that one sells a
                              plan, this one points at work they already have.
                              pb-1 keeps it off the panel's bottom edge. */}
                          {(data?.proResumeVersions?.length ?? 0) > 0 && (
                            <div className="border-t border-gray-100 mt-3 pb-1">
                              <button
                                onClick={() => setShowOlderJSModal(true)}
                                className="w-full text-center py-1.5 text-xs text-purple-600 hover:text-purple-700 font-medium transition-colors cursor-pointer"
                              >
                                Looking for your job-specific resumes?
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                 {/* Card 2: Cover Letters */}
                  <div data-tour="cover-letters" className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 flex flex-col overflow-hidden md:flex-1">
                    {/* ---- WHICH PANEL THIS IS ----
                        mayCreate, not mayAccess. The list-everything panel
                        belongs to the plan with no ceiling; Free and Vault
                        share one allowance of three and both get the three
                        slots, the counter and the spent-slot explanation.
                        Vault reaches its Pro-made work through the link
                        under the slots, and opens it there, which is what
                        keeping what you built means. */}
                    {mayCreate ? (
                      <>
                        <h2 className="text-base font-semibold text-gray-900">Cover Letters</h2>
                        <p className="text-sm text-gray-500 mb-2">Written for this job, not every job.</p>
                        <div>
                          <div className="space-y-2">
                            {/* Vault reaches this card because the letters in
                                it are its own, and it keeps the same three-letter
                                allowance a free account has. Past the third, the
                                button offers the plan that lifts the ceiling
                                rather than opening a flow the route will refuse. */}
                            <button
                              onClick={() => clLimitReached ? setShowUpgradeModal(true) : setShowCLModal(true)}
                              className={`w-full border-2 border-dashed rounded-lg p-2.5 transition-all flex items-center justify-center gap-2 ${
                                clLimitReached
                                  ? 'border-purple-200 hover:border-purple-400 hover:bg-purple-50'
                                  : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50'
                              }`}
                            >
                              <div className="w-4 h-4 rounded-full bg-purple-100 flex items-center justify-center">
                                {clLimitReached ? (
                                  <span className="text-[10px]">🔒</span>
                                ) : (
                                  <svg className="w-2.5 h-2.5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                )}
                              </div>
                              <div className={`text-sm font-semibold ${clLimitReached ? 'text-purple-600' : 'text-gray-900'}`}>
                                Create New
                              </div>
                            </button>

                            {data.coverLetters && data.coverLetters.length > 0 ? (
                              <>
                                {data.coverLetters.slice(0, 2).map((cl) => (
                                  <div
                                    key={cl.id}
                                    className="group bg-white border border-gray-300 rounded-lg p-2 hover:border-purple-400 hover:shadow-sm transition-all cursor-pointer"
                                    style={{ minHeight: '52px' }}
                                    onClick={() => router.push(`/cover-letter/${cl.id}`)}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <div className="w-6 h-6 rounded bg-purple-50 flex items-center justify-center flex-shrink-0">
                                          <svg className="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                          </svg>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="text-sm md:text-xs font-semibold text-gray-900 truncate">{cl.job_title}</div>
                                          <div className="text-xs md:text-[10px] text-gray-500 truncate">{cl.job_company}</div>
                                        </div>
                                      </div>
                                     <button
                                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteCLId(cl.id); }}
                                        className="md:opacity-0 md:group-hover:opacity-100 w-5 h-5 rounded-full bg-[#fdecea] hover:bg-[#e57373] flex items-center justify-center text-[#e57373] hover:text-white transition-all flex-shrink-0"
                                        title="Delete"
                                      >
                                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>
                                ))}
                                {data.coverLetters.length > 2 && (
                                  <button
                                      onClick={() => setShowOlderCLModal(true)}
                                      className="w-full text-center py-1.5 text-sm text-purple-600 hover:text-purple-700 font-medium transition-colors cursor-pointer"
                                    >
                                      View all cover letters →
                                    </button>
                                )}
                              </>
                            ) : (
                              <div className="text-center py-4 text-gray-500">
                                <div className="text-2xl mb-1">✉️</div>
                                <p className="text-sm">No cover letters yet.<br />Click "Create New" when you're ready.</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-0.5">
                          <h2 className="text-base font-semibold text-gray-900">Cover Letters</h2>
                          <span className={`text-xs md:text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            clLimitReached ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {Math.max(0, 3 - (data?.userProfile?.cl_count ?? 0))} of 3 remaining
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mb-2">Written for this job, not every job.</p>
                        <div className="space-y-1.5">
                          {allowanceSlots(data.coverLetters, data?.userProfile?.cl_count).map((slot, slotIndex) => {
                            if (slot.kind === 'live') {
                              const cl = slot.item
                              return (
                                <div
                                  key={cl.id}
                                  className="group bg-white border border-gray-200 rounded-lg px-3 hover:border-purple-400 hover:shadow-sm transition-all cursor-pointer flex items-center"
                                  style={{ height: '44px' }}
                                  onClick={() => router.push(`/cover-letter/${cl.id}`)}
                                >
                                  <div className="flex items-center gap-2 w-full">
                                    <div className="w-6 h-6 rounded bg-purple-50 flex items-center justify-center flex-shrink-0">
                                      <svg className="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm md:text-xs font-semibold text-gray-900 truncate">{cl.job_title}</div>
                                      <div className="text-xs md:text-[10px] text-gray-500 truncate">{cl.job_company}</div>
                                    </div>
                                  </div>
                                </div>
                              )
                            }

                            if (slot.kind === 'used') {
                              return (
                                <div
                                  key={`cl-used-${slotIndex}`}
                                  className="w-full border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center gap-1.5 bg-gray-50 cursor-default"
                                  style={{ height: '44px' }}
                                >
                                  <div className="text-xs md:text-[10px] text-gray-400 font-semibold tracking-wide uppercase">
                                    Cover Letter {slotIndex + 1} · Used
                                  </div>
                                  <Popover label="Why does this slot say used?">
                                    Your plan includes 3 cover letters for life. This one has already been used, so it counts toward your 3.
                                  </Popover>
                                </div>
                              )
                            }

                            if (slot.kind === 'create') {
                              return (
                                <button
                                  key={`cl-upload-${slotIndex}`}
                                  onClick={() => setShowCLModal(true)}
                                  className="w-full border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center gap-2 hover:border-purple-400 hover:bg-purple-50 transition-all"
                                  style={{ height: '44px' }}
                                >
                                  <div className="w-4 h-4 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                                    <svg className="w-2.5 h-2.5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                  </div>
                                  <div className="text-sm font-semibold text-gray-700">Click to create a cover letter</div>
                                </button>
                              )
                            }

                            return (
                              <div
                                key={`cl-empty-${slotIndex}`}
                                className="w-full border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center bg-gray-50"
                                style={{ height: '44px' }}
                              >
                                <div className="text-xs md:text-[10px] text-gray-400 font-semibold tracking-wide uppercase">Cover Letter {slotIndex + 1}</div>
                              </div>
                            )
                          })}

                          <GoProLink onClick={() => setShowUpgradeModal(true)}>
                            Go Pro for unlimited cover letters
                          </GoProLink>

                          {/* The letters they wrote on Pro. Same reasoning and
                              the same arrangement as the job-specific link
                              above. */}
                          {(data?.proCoverLetters?.length ?? 0) > 0 && (
                            <div className="border-t border-gray-100 mt-3 pb-1">
                              <button
                                onClick={() => setShowOlderCLModal(true)}
                                className="w-full text-center py-1.5 text-xs text-purple-600 hover:text-purple-700 font-medium transition-colors cursor-pointer"
                              >
                                Looking for your cover letters?
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                </div>
              </div>
            )}

            {/* Empty State - EXACT Same Layout, Just Empty */}
            {!data?.coreResume && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:flex-1 md:min-h-0 md:grid-rows-1">
                {/* Core Resume Card (8 cols) */}
                <div className="col-span-1 md:col-span-8 md:flex md:flex-col md:min-h-0">
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                    <h2 className="text-lg font-semibold text-gray-900">Core Resume</h2>
                    <p className="text-sm text-gray-500 mb-3">Complete resume you can use for any job in your field</p>
                    
                    {/* Thumbnail LEFT | Score RIGHT - EXACT same grid */}
                    <div className="grid grid-cols-12 gap-4 mb-4">
                      
                      {/* Left: Empty Thumbnail (Upload Box) - col-span-4 */}
                      <div className="hidden md:block md:col-span-4">
                        <label className="block cursor-pointer" onClick={(e) => { e.preventDefault(); setShowTourModal(true); setTourScreen(3); }}>
                          <input
                            type="file"
                            accept=".pdf,.docx"
                            className="hidden"
                            disabled
                          />
                          <div className={`relative bg-gray-50 rounded-lg overflow-hidden shadow-sm border-2 border-dashed transition-all flex items-center justify-center ${
                            uploadError 
                              ? 'border-amber-400 bg-amber-50' 
                              : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50'
                          }`} style={{ aspectRatio: '8.5/11' }}>
                            {uploading ? (
                              <div className="flex flex-col items-center gap-2">
                                <div className="animate-spin h-6 w-6 border-3 border-purple-600 border-t-transparent rounded-full"></div>
                                <p className="text-sm font-medium text-gray-700">Uploading...</p>
                              </div>
                            ) : uploadError ? (
                              <div className="flex flex-col items-center gap-2 px-4">
                                <svg className="w-10 h-10 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <div className="text-center">
                                  <p className="text-sm font-semibold text-amber-900">Upload Failed</p>
                                  <p className="text-xs md:text-[10px] text-amber-700 mt-1">{uploadError}</p>
                                  <button
                                    onClick={() => setUploadError(null)}
                                    className="text-xs md:text-[10px] text-purple-600 hover:text-purple-700 font-medium mt-2"
                                  >
                                    Try Again
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-2 px-4">
                                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                                <div className="text-center">
                                  <p className="text-sm font-semibold text-gray-900">Upload or build your</p>
                                  <p className="text-sm font-semibold text-gray-900">resume to begin.</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </label>
                      </div>
                      
                      {/* Right: Empty Score Section - col-span-8 */}
                      <div className="col-span-12 md:col-span-8 flex flex-col justify-between py-3">
                        {/* Mobile-only Get Started button */}
                        <div className="md:hidden mb-4 flex justify-center">
                          <button
                            onClick={() => { setShowTourModal(true); setTourScreen(3); }}
                            className="text-white px-6 py-2 rounded-lg transition-opacity hover:opacity-90 font-medium text-sm"
                            style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
                          >
                            Start Your Resume
                          </button>
                        </div>
                        {/* Giant Score */}
                        <div className="text-center">
                          <div className="mb-3">
                            <span className="text-7xl font-bold text-gray-300">--</span>
                            <span className="text-3xl text-gray-300">/100</span>
                          </div>
                          <div className="text-sm md:text-xs text-gray-500 uppercase tracking-wide mb-3">
                            Not Yet Assessed
                          </div>
                          
                          {/* Empty Score Bar */}
                          <div className="max-w-md mx-auto">
                            <div className="h-3 bg-gray-200 rounded-full overflow-hidden mb-3 shadow-inner">
                              <div className="h-full w-0 bg-gray-300" />
                            </div>
                            
                            {/* Simple text labels with dots */}
                            <div className="flex items-center justify-center gap-6 text-sm text-gray-600">
  {[
    { color: '#e57373', label: 'Needs Work' },
    { color: '#ffc870', label: 'Developing' },
    { color: '#81c784', label: 'Strong' },
    { color: '#9333ea', label: 'Excellent' },
  ].map(({ color, label }) => (
    <div key={label} className="flex items-center gap-1">
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }}></div>
      <span>{label}</span>
    </div>
  ))}
</div>
                          </div>
                        </div>
                        
                        {/* Empty Breakdown Grid */}
                        <div className="grid grid-cols-3 gap-1.5">
                          <div className="text-center p-1.5 bg-gray-50 rounded-lg">
                            <div className="text-2xl font-bold mb-0.5">
                              <span className="text-gray-300">--</span>
                              <span className="text-sm text-gray-300">/50</span>
</div>
<div className="text-xs md:text-[10px] text-gray-600 uppercase tracking-wide mb-0.5">Impact</div>
                            <div className="flex items-center justify-center gap-1">
                              <span className="text-xs md:text-[10px] text-gray-400">—</span>
                            </div>
                          </div>
                          
                          <div className="text-center p-1.5 bg-gray-50 rounded-lg">
                            <div className="text-2xl font-bold mb-0.5">
                              <span className="text-gray-300">--</span>
                              <span className="text-sm text-gray-300">/30</span>
</div>
<div className="text-xs md:text-[10px] text-gray-600 uppercase tracking-wide mb-0.5">Clarity</div>
                            <div className="flex items-center justify-center gap-1">
                              <span className="text-xs md:text-[10px] text-gray-400">—</span>
                            </div>
                          </div>
                          
                          <div className="text-center p-1.5 bg-gray-50 rounded-lg">
                            <div className="text-2xl font-bold mb-0.5">
                              <span className="text-gray-300">--</span>
                              <span className="text-sm text-gray-300">/20</span>
                            </div>
                            <div className="text-xs md:text-[10px] text-gray-600 uppercase tracking-wide mb-0.5">Keywords</div>
                            <div className="flex items-center justify-center gap-1">
                              <span className="text-[10px] text-gray-400">—</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Journey Progress - All Gray */}
                    <div className="mb-4">
                      <div className="text-sm md:text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Journey Progress</div>
                      <div className="relative max-w-2xl mx-auto">
                        <div className="absolute top-2.5 left-0 right-0 h-px bg-gray-200"></div>
                        <div className="relative flex justify-between">
                         {['Review', 'Assess', 'Coach', 'Improve', 'Format', 'Save'].map((step) => (
                            <div key={step} className="flex flex-col items-center">
                              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold z-10 bg-white border border-gray-300 text-gray-400">
                                ○
                              </div>
                              <span className="text-sm mt-1 text-gray-400">
                                {step}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    {/* What This Means - WITH Upload Button */}
                    <div className="bg-purple-50 border-l-4 border-purple-600 p-3 rounded-r flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <div className="text-xs md:text-[10px] font-bold text-purple-600 uppercase tracking-wide mb-1">What This Means</div>
                        <p className="text-sm text-gray-700 leading-snug">
                          You haven't started yet. Click "Get Started" to upload or build your resume.
                        </p>
                      </div>
                      <button
                        onClick={() => { setShowTourModal(true); setTourScreen(3); }}
                        className="text-white px-4 py-2 rounded-lg transition-opacity hover:opacity-90 font-medium text-sm whitespace-nowrap flex items-center gap-2 flex-shrink-0"
                        style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
                      >
                        Get Started
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Column: job specific Resumes + Cover Letters (empty state) */}
                <div className="col-span-1 md:col-span-4 flex flex-col">
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:flex-1" style={{ marginBottom: '16px' }}>
                    {mayAccess ? (
                      <>
                        <h2 className="text-base font-semibold text-gray-900">Job-Specific Resumes</h2>
                        <p className="text-sm text-gray-500 mb-4">Tailored versions for specific applications</p>
                      </>
                    ) : (
                      <>
                        <h2 className="text-base font-semibold text-gray-900">Job Match Scores</h2>
                        <p className="text-sm text-gray-500 mb-4">Upload a job description to see how well you match</p>
                      </>
                    )}
                    <div className="text-center py-6 text-gray-400">
                      <div className="text-3xl mb-2">{isPro ? '📋' : '🎯'}</div>
                      <p className="text-sm">Complete your core resume first</p>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:flex-1">
                    <h2 className="text-base font-semibold text-gray-900">Cover Letters</h2>
                    <p className="text-sm text-gray-500 mb-4">Stand out by showing how your skills align</p>
                    <div className="text-center py-6 text-gray-400">
                      <div className="text-3xl mb-2">✉️</div>
                      <p className="text-sm">Complete your core resume first</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </AppShell.Main>

     {/* Job-Specific Resume Modal */}
      {showJobModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden"
          >
            <div className="px-6 py-4" style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-lg">🎯</span>
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">{isPro ? 'Tailor for a Specific Job' : 'Check Your Job Match Score'}</h2>
                    <p className="text-purple-100 text-sm">{isPro ? "We'll analyze the match and coach your resume for this role." : "We'll analyze how closely your resume aligns with this role."}</p>
                  </div>
                </div>
                <button
                  onClick={() => { setShowJobModal(false); setJobCreateError(null); }}
                  className="text-white hover:opacity-70 text-2xl leading-none font-light"
                >
                  ×
                </button>
              </div>
            </div>

           <div className="p-6 space-y-4">
              {jobSources.filter(s => !s.has_resume).length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Use details from existing job</label>
                  <p className="text-[10px] text-gray-400 mb-1">Select an existing job to auto-fill the details below, or fill them in manually.</p>
                  <select
                    value={selectedJobSourceId}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '') {
                        setSelectedJobSourceId('');
                        setJobTitle('');
                        setJobCompany('');
                        setJobDescription('');
                      } else {
                        const selected = jobSources.find(s => s.id === val);
                        setSelectedJobSourceId(val);
                        setJobTitle(selected?.title || '');
                        setJobCompany(selected?.company || '');
                        setJobDescription(selected?.description || '');
                      }
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base md:text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                  >
                    <option value="">None selected</option>
                    {jobSources.filter(s => !s.has_resume).map(s => (
                      <option key={s.id} value={s.id}>{s.displayLabel}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Job Title *</label>
                <input
                  type="text"
                  value={jobTitle}
                  onChange={e => { setJobTitle(e.target.value); if (e.target.value.length <= 100) setJobTitleError(null); }}
                  onBlur={e => {
                    const v = toTitleCaseOnBlur(e.target.value);
                    setJobTitle(v);
                    setJobTitleError(v.length > 100 ? 'Please enter just the job title (max 100 characters).' : null);
                  }}
                  placeholder="e.g. Marketing Coordinator"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                {jobTitleError && <p className="text-sm text-red-600 mt-1">{jobTitleError}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Company</label>
                <input
                  type="text"
                  value={jobCompany}
                  onChange={e => { setJobCompany(e.target.value); if (e.target.value.length <= 100) setJobCompanyError(null); }}
                  onBlur={e => {
                    const v = toTitleCaseOnBlur(e.target.value);
                    setJobCompany(v);
                    setJobCompanyError(v.length > 100 ? 'Please enter just the company name (max 100 characters).' : null);
                  }}
                  placeholder="e.g. Disney"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                {jobCompanyError && <p className="text-sm text-red-600 mt-1">{jobCompanyError}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Job Description *</label>
                <textarea
                  value={jobDescription}
                  onChange={e => setJobDescription(e.target.value)}
                  placeholder="Paste the full job description here..."
                  rows={6}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
              </div>

              {jobCreateError && (
                <p className="text-sm text-red-600">{jobCreateError}</p>
              )}

              <button
                onClick={handleCreateJobSpecific}
                disabled={creatingJob || !!jobTitleError || !!jobCompanyError}
                className="block mx-auto rounded-lg py-2 px-8 font-semibold text-sm flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(to right, #667eea, #764ba2)', color: 'white', opacity: (creatingJob || !!jobTitleError || !!jobCompanyError) ? 0.5 : 1 }}
              >
                <span key={creatingJob ? 'loading' : 'idle'} className="flex items-center gap-2">
                  {creatingJob && <div className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>}
                  {creatingJob ? 'Analyzing Match...' : 'Analyze Match →'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tour Modal */}
      {showTourModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)' }}
          onMouseDown={(e) => { e.currentTarget.dataset.downTarget = e.target === e.currentTarget ? 'backdrop' : 'inside'; }}
          onMouseUp={(e) => {
            if (e.target === e.currentTarget && e.currentTarget.dataset.downTarget === 'backdrop') {
              handleSkipTour();
            }
          }}
        >
          <div 
            className="bg-white shadow-2xl max-w-lg w-full overflow-hidden border border-gray-200"
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              borderRadius: '8px',
            }}
          >
            {/* Purple header */}
            <div 
             style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)' }} 
              className="px-6 py-5 relative"
            >
              <button
                onClick={handleSkipTour}
                className="absolute top-4 right-4 text-white hover:text-gray-200 text-3xl leading-none font-light"
              >
                ×
              </button>

              <div className="flex items-center gap-3">
                <img src="/images/Hire_Power_icon.png" alt="Hire Power" className="h-8 w-auto flex-shrink-0" />
                <div>
                  <h2 className="text-xl font-bold text-white">Let's Get Started</h2>
                  <p className="text-purple-100 text-xs">Your resume is the starting point.</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-5">
              <div className="flex flex-col py-2">

                {/* Option 1 — Upload */}
                <div className="flex items-center gap-4 py-4">
                  <span className="text-6xl font-black text-gray-200 leading-none flex-shrink-0 w-10" style={{ fontFamily: 'Fraunces, serif' }}>1</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 leading-snug">Already have a resume?</p>
                    <p className="text-xs text-gray-500 leading-snug mt-0.5">Upload it here, and we'll coach it into something stronger.</p>
                  </div>
                  <label className="block cursor-pointer flex-shrink-0">
                    <input
                      type="file"
                      accept=".pdf,.docx"
                      onChange={(e) => {
                        handleFileUpload(e);
                        handleCompleteTour();
                      }}
                      className="hidden"
                      disabled={uploading}
                    />
                    <div
                      className="text-white px-4 py-2 rounded-lg transition-opacity hover:opacity-90 font-semibold text-xs cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                      style={{ background: 'linear-gradient(to right, #667eea, #764ba2)', minWidth: '140px', justifyContent: 'center' }}
                    >
                      {uploading ? (
                        <>
                          <div className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full"></div>
                          Uploading...
                        </>
                      ) : (
                        <>Upload Resume</>
                      )}
                    </div>
                  </label>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-100 mx-2" />

                {/* Option 2 — Build with Coach */}
                <div className="flex items-center gap-4 py-4">
                  <span className="text-6xl font-black text-gray-200 leading-none flex-shrink-0 w-10" style={{ fontFamily: 'Fraunces, serif' }}>2</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 leading-snug">No resume? No problem!</p>
                    <p className="text-xs text-gray-500 leading-snug mt-0.5">Meet brb — best resume builder. Writes your resume from one conversation. Mobile friendly, desktop optional. Type your answers, or use talk-to-text on your mobile device.</p>
                  </div>
                  <div className="flex-shrink-0 text-center">
                    <button
                      onClick={handleStartResumeChat}
                      disabled={creatingChat}
                      className="px-4 py-2 rounded-lg font-semibold text-xs inline-flex items-center gap-1.5 text-white transition-opacity hover:opacity-90 whitespace-nowrap disabled:opacity-85"
                      style={{ background: 'linear-gradient(to right, #667eea, #764ba2)', minWidth: '140px', justifyContent: 'center' }}
                    >
                      {creatingChat ? (
                        <>
                          <div className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full"></div>
                          Starting...
                        </>
                      ) : (
                        <>brb</>
                      )}
                    </button>
                  </div>
                </div>

                {/* Builder link — desktop only */}
                <div className="hidden md:block text-center mt-2" style={{ lineHeight: '1' }}>
                  <span className="block text-xs text-gray-400">Not feeling chatty?</span>
                  <button
                    onClick={() => {
                      handleCompleteTour();
                      router.push('/build?from=resume-coach');
                    }}
                    className="text-xs text-purple-400 hover:text-purple-700 font-medium hover:underline"
                  >
                    Build it yourself with our form-based resume builder.
                  </button>
                </div>

                {/* Mobile note */}
                <p className="md:hidden text-xs text-gray-400 text-center mt-2">
                  Not feeling chatty? <br/> Use our form-based resume builder from your computer.
                </p>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={() => setConfirmDeleteId(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-gray-900 mb-2">Delete this resume?</h3>
            <p className="text-sm text-gray-600 mb-5">Deletes this resume from Resume Writer. Job-specific resumes remain stored on the corresponding job card.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteResume(confirmDeleteId)}
                disabled={deletingId === confirmDeleteId}
                className="flex-1 px-4 py-2 bg-[#e57373] text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deletingId === confirmDeleteId ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Deleting...
                  </>
                ) : (
                  'Yes, Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cover Letter Creation Modal */}
      {showCLModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden"
          >
            <div className="px-6 py-4" style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">Create Cover Letter</h2>
                    <p className="text-purple-100 text-sm">Stand out by showing how your skills align. Edit and download when ready.</p>
                  </div>
                </div>
                <button
                  onClick={() => { setShowCLModal(false); setClSourceType(null); setClCreateError(null); }}
                  className="text-white hover:opacity-70 text-2xl leading-none font-light"
                >
                  ×
                </button>
              </div>
            </div>

           <div className="p-4 space-y-3">
              {jobSources.filter(s => !s.has_cover_letter).length > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Use details from existing job</label>
                  <select
                    value={selectedJobSourceId}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '') {
                        setSelectedJobSourceId('');
                        setClSelectedJSId('');
                        setClJobTitle('');
                        setClCompany('');
                        setClJobDescription('');
                      } else {
                        const selected = jobSources.find(s => s.id === val);
                        setSelectedJobSourceId(val);
                        setClSelectedJSId(selected?.resume_id || '');
                        setClJobTitle(selected?.title || '');
                        setClCompany(selected?.company || '');
                        setClJobDescription(selected?.description || '');
                      }
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                  >
                    <option value="">None selected</option>
                    {jobSources.filter(s => !s.has_cover_letter).map(s => (
                      <option key={s.id} value={s.id}>{s.displayLabel}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Job Title *</label>
                <input
                  type="text"
                  value={clJobTitle}
                  onChange={e => { setClJobTitle(e.target.value); if (e.target.value.length <= 100) setClJobTitleError(null); }}
                  onBlur={e => {
                    const v = toTitleCaseOnBlur(e.target.value);
                    setClJobTitle(v);
                    setClJobTitleError(v.length > 100 ? 'Please enter just the job title (max 100 characters).' : null);
                  }}
                  placeholder="e.g. Marketing Coordinator"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                {clJobTitleError && <p className="text-sm text-red-600 mt-1">{clJobTitleError}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Company</label>
                <input
                  type="text"
                  value={clCompany}
                  onChange={e => { setClCompany(e.target.value); if (e.target.value.length <= 100) setClCompanyError(null); }}
                  onBlur={e => {
                    const v = toTitleCaseOnBlur(e.target.value);
                    setClCompany(v);
                    setClCompanyError(v.length > 100 ? 'Please enter just the company name (max 100 characters).' : null);
                  }}
                  placeholder="e.g. Disney"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                {clCompanyError && <p className="text-sm text-red-600 mt-1">{clCompanyError}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Job Description *</label>
                <textarea
                  value={clJobDescription}
                  onChange={e => setClJobDescription(e.target.value)}
                  placeholder="Paste the full job description here..."
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Your positioning statement (optional)</label>
                <textarea
                  value={positioningStatement}
                  onChange={e => setPositioningStatement(e.target.value)}
                  placeholder="Share your angle — why you're the right fit, what makes you unique, or what you want the letter to lead with."
                  rows={1}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Additional context (optional)</label>
                <textarea
                  value={clAdditionalContext}
                  onChange={e => setClAdditionalContext(e.target.value)}
                  placeholder="Anything else worth mentioning? Referrals, availability, willingness to relocate, etc."
                  rows={1}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
              </div>
              {clCreateError && <p className="text-sm text-red-600">{clCreateError}</p>}
              <button
                onClick={handleCreateCoverLetter}
                disabled={creatingCL || !!clJobTitleError || !!clCompanyError}
                className="rounded-lg py-2 px-8 font-semibold text-sm flex items-center justify-center gap-2"
                style={{background:'linear-gradient(to right, #667eea, #764ba2)', color: 'white', width: 'fit-content', margin: '0 auto', opacity: (creatingCL || !!clJobTitleError || !!clCompanyError) ? 0.5 : 1}}
              >
                <span key={creatingCL ? 'loading' : 'idle'} className="flex items-center gap-2">
                  {creatingCL && <div className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>}
                  {creatingCL ? 'Creating...' : 'Create Cover Letter →'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- JOB-SPECIFIC RESUMES, TWO WAYS ----
          On Pro this is the overflow of the panel beside it: all of them, each
          one deletable. Outside Pro it is the other list - the ones made on
          Pro, which the panel deliberately leaves out - and it is where
          "Looking for your job-specific resumes?" lands.

          Vault opens and downloads them, because keeping what was built is
          the whole plan. Free sees that they are still there and is offered
          both ways to reach them, which is what VaultUpgradeModal does when
          it is handed onChoosePro. */}
      {showOlderJSModal && (() => {
        const fromPro = !mayCreate;
        const rows = (fromPro ? data?.proResumeVersions : data?.resumeVersions) || [];
        const locked = !mayAccess;
        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4" style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Job-Specific Resumes</h2>
                  <p className="text-purple-100 text-xs">
                    {rows.length} {rows.length === 1 ? 'resume' : 'resumes'}
                    {fromPro ? ' built on Pro' : ''}
                  </p>
                </div>
                <button onClick={() => setShowOlderJSModal(false)} className="text-white text-2xl leading-none font-light hover:opacity-70">×</button>
              </div>
            </div>
            <div className="px-6 py-4 overflow-y-auto" style={{ maxHeight: '60vh' }}>
              {locked && (
                <p className="text-sm text-gray-500 leading-snug mb-3">
                  We're keeping your job-specific resumes safe in your Career Vault. Upgrade to Vault or Pro to open them again.
                </p>
              )}
              <div className="space-y-2">
                {rows.map((version) => (
                  <div
                    key={version.id}
                    className={`group flex items-center justify-between p-3 rounded-lg border transition-all ${locked ? 'bg-gray-50 border-gray-200 cursor-pointer' : 'bg-gray-50 border-gray-200 hover:border-purple-400 hover:bg-white cursor-pointer'}`}
                    onClick={() => {
                      if (locked) {
                        setShowOlderJSModal(false);
                        setVaultPrompt({
                          title: 'Your job-specific resumes are still here.',
                          message: LOCK_COPY.job_specific
                        });
                        return;
                      }
                      setShowOlderJSModal(false);
                      router.push(`/resume/${version.id}`);
                    }}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {locked && <span className="text-xs flex-shrink-0" aria-hidden="true">🔒</span>}
                      <div className="min-w-0">
                        <p className={`text-sm font-bold truncate ${locked ? 'text-gray-500' : 'text-gray-900'}`}>{versionTitle(version)}</p>
                        <p className="text-xs text-gray-500 truncate">{version.job_company}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                      {/* Pro only. Outside it, a job-specific resume cannot be
                          deleted at all: the slot it spent does not come back,
                          so deleting would cost the work and keep the cost. */}
                      {mayCreate && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(version.id); setShowOlderJSModal(false); }}
                          className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-full bg-[#fdecea] hover:bg-[#e57373] flex items-center justify-center text-[#e57373] hover:text-white transition-all"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                      <div className="relative w-10 h-10 flex-shrink-0">
                        <svg className="w-10 h-10 transform -rotate-90">
                          <circle cx="20" cy="20" r="16" stroke="#e5e7eb" strokeWidth="2.5" fill="none" />
                          <circle cx="20" cy="20" r="16" stroke={getCircleColor(version.match_score)} strokeWidth="2.5" fill="none" strokeDasharray={`${2 * Math.PI * 16}`} strokeDashoffset={`${2 * Math.PI * 16 * (1 - version.match_score / 100)}`} strokeLinecap="round" />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-[11px] font-bold" style={{ color: getCircleColor(version.match_score) }}>{version.match_score}%</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
              {locked && (
                <div className="flex items-center justify-end gap-2 px-6 pb-5 pt-1">
                  <button
                    onClick={() => router.push(UPGRADE_HREF)}
                    className="rounded-lg py-2.5 px-4 text-sm font-semibold transition-colors"
                    style={{ color: '#5b21b6', background: '#f5f3ff', border: '1px solid #ddd6fe' }}
                  >
                    Upgrade to Vault
                  </button>
                  <button
                    onClick={() => { setShowOlderJSModal(false); setShowUpgradeModal(true); }}
                    className="text-white rounded-lg py-2.5 px-4 text-sm font-semibold hover:opacity-90 transition-opacity"
                    style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
                  >
                    Upgrade to Pro
                  </button>
                </div>
              )}
            </div>
        </div>
        );
      })()}

      {/* The same two modes, for cover letters. See the note above. */}
      {showOlderCLModal && (() => {
        const fromPro = !mayCreate;
        const rows = (fromPro ? data?.proCoverLetters : data?.coverLetters) || [];
        const locked = !mayAccess;
        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4" style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Cover Letters</h2>
                  <p className="text-purple-100 text-xs">
                    {rows.length} {rows.length === 1 ? 'cover letter' : 'cover letters'}
                    {fromPro ? ' written on Pro' : ''}
                  </p>
                </div>
                <button onClick={() => setShowOlderCLModal(false)} className="text-white text-2xl leading-none font-light hover:opacity-70">×</button>
              </div>
            </div>
            <div className="px-6 py-4 overflow-y-auto" style={{ maxHeight: '60vh' }}>
              {locked && (
                <p className="text-sm text-gray-500 leading-snug mb-3">
                  We're keeping your cover letters safe in your Career Vault. Upgrade to Vault or Pro to open them again.
                </p>
              )}
              <div className="space-y-2">
                {rows.map((cl) => (
                  <div
                    key={cl.id}
                    className="group flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-purple-400 hover:bg-white cursor-pointer transition-all"
                    onClick={() => {
                      if (locked) {
                        setShowOlderCLModal(false);
                        setVaultPrompt({
                          title: 'Your cover letters are still here.',
                          message: LOCK_COPY.job_specific
                        });
                        return;
                      }
                      setShowOlderCLModal(false);
                      router.push(`/cover-letter/${cl.id}`);
                    }}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {locked
                        ? <span className="text-xs flex-shrink-0" aria-hidden="true">🔒</span>
                        : (
                          <div className="w-8 h-8 rounded bg-purple-50 flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                        )}
                      <div className="min-w-0">
                        <p className={`text-sm font-bold truncate ${locked ? 'text-gray-500' : 'text-gray-900'}`}>{cl.job_title}</p>
                        <p className="text-xs text-gray-500 truncate">{cl.job_company}</p>
                      </div>
                    </div>
                    {/* Pro only, for the reason the job-specific delete is. */}
                    {mayCreate && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteCLId(cl.id); setShowOlderCLModal(false); }}
                        className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-full bg-[#fdecea] hover:bg-[#e57373] flex items-center justify-center text-[#e57373] hover:text-white transition-all ml-2 flex-shrink-0"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
              {locked && (
                <div className="flex items-center justify-end gap-2 px-6 pb-5 pt-1">
                  <button
                    onClick={() => router.push(UPGRADE_HREF)}
                    className="rounded-lg py-2.5 px-4 text-sm font-semibold transition-colors"
                    style={{ color: '#5b21b6', background: '#f5f3ff', border: '1px solid #ddd6fe' }}
                  >
                    Upgrade to Vault
                  </button>
                  <button
                    onClick={() => { setShowOlderCLModal(false); setShowUpgradeModal(true); }}
                    className="text-white rounded-lg py-2.5 px-4 text-sm font-semibold hover:opacity-90 transition-opacity"
                    style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
                  >
                    Upgrade to Pro
                  </button>
                </div>
              )}
            </div>
        </div>
        );
      })()}

      {/* Cover Letter Delete Confirmation */}
      {confirmDeleteCLId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={() => setConfirmDeleteCLId(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-gray-900 mb-2">Delete this cover letter?</h3>
            <p className="text-sm text-gray-600 mb-5">Deletes this cover letter from Resume Writer. Cover letters remain stored on the corresponding job card.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteCLId(null)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
                Cancel
              </button>
              <button
                onClick={() => handleDeleteCoverLetter(confirmDeleteCLId)}
                disabled={deletingCLId === confirmDeleteCLId}
                className="flex-1 px-4 py-2 bg-[#e57373] text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deletingCLId === confirmDeleteCLId ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Deleting...
                  </>
                ) : (
                  'Yes, Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showHubTour && (
        <Tour
          steps={HUB_TOUR_STEPS.map(step => {
            // The Career Profile stop before the profile exists. Resolved
            // here for the same reason the free copy is: which words a stop
            // uses is a question about this page's state, and a tour engine
            // that knew about Career Profiles would be carrying vocabulary
            // from a part of the product it has no other business with.
            const resolved = showCareerProfileAd && step.adTitle
              ? { ...step, title: step.adTitle, body: step.adBody }
              : step;
            return isPro
              ? resolved
              : { ...resolved, title: resolved.freeTitle || resolved.title, body: resolved.freeBody || resolved.body };
          })}
          storageKey={HUB_TOUR_KEY}
          onStepChange={setHubTourStepId}
          onClose={closeHubTour}
        />
      )}

      <ErrorToast message={errorToast} onClose={() => setErrorToast(null)} />

      {/* Both plans open a locked resume, so both are offered. Without
          onChoosePro this modal sells Vault alone, which is the cheaper answer
          to this gate but not the only one. */}
      <VaultUpgradeModal
        isOpen={Boolean(vaultPrompt)}
        onClose={() => setVaultPrompt(null)}
        title={vaultPrompt?.title}
        message={vaultPrompt?.message}
        onChoosePro={() => { setVaultPrompt(null); setShowUpgradeModal(true); }}
      />

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
      />
    </AppShell>
  );
}