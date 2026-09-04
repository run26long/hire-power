'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import MainNav from '../../components/MainNav';
import Breadcrumb from '../../components/Breadcrumb';
import ErrorToast from '../../components/ErrorToast';
import SuccessToast from '../../components/SuccessToast';
import UpgradeModal from '../../components/UpgradeModal';
import PracticeView from '../../components/interview/PracticeView';
import PracticeLeftPanel from '../../components/interview/PracticeLeftPanel';

// Order matters: every position, counter and high-water mark in this file is
// derived from this array's indexes rather than written out again.
const VALID_STEPS = ['analyze', 'research', 'prepare', 'practice'];

// What a free account gets, mirrored from the routes that enforce it: one
// Power Analysis and three practice sessions, both for the life of the account
// rather than per job. Read here only to show the gate before a request is
// made — the server is what actually refuses.
const FREE_PA_LIMIT = 1;
const FREE_SESSION_LIMIT = 3;

const FREE_PA_LIMIT_MESSAGE =
  "You've used your free Power Analysis. Go Pro to analyze every job you pursue.";

// highest_step_reached can still read 'coach' on rows written before that step
// came out of the flow. It was the last step then, so a row that reached it
// reached the end: without this it indexes to -1 and every step looks locked.
function reachedIndexFor(mark) {
  if (mark === 'coach') return VALID_STEPS.length - 1;
  return VALID_STEPS.indexOf(mark || 'analyze');
}

export default function InterviewDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const supabase = createClient();

  // ?step= from the hub. Available on the first render, so nothing has to race
  // the load to read it. Ignored unless it names a real step.
  const requestedStep = searchParams.get('step');
  const jumpStep = VALID_STEPS.includes(requestedStep) ? requestedStep : null;

  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isPro, setIsPro] = useState(false);

  const [jobCard, setJobCard] = useState(null);
  const [siblingJobs, setSiblingJobs] = useState([]);
  const [resume, setResume] = useState(null);
  const [powerAnalysis, setPowerAnalysis] = useState(null);

  const [generating, setGenerating] = useState(false);
  const [paError, setPaError] = useState(null);

  // Step navigation: 'analyze' | 'research' | 'prepare' | 'practice'
  const [currentStep, setCurrentStep] = useState('analyze');

  // Mobile panel toggle: 'analysis' | 'coaching'
  const [mobilePanel, setMobilePanel] = useState('analysis');

  // Live countdown tick
  const [now, setNow] = useState(Date.now());

  // Practice step. The session itself lives inside PracticeView; this mirrors
  // its shape so the left panel can render alongside without a second copy.
  const [practiceShape, setPracticeShape] = useState({
    state: 'idle', session: null, questions: [], currentIndex: 0, completion: null
  });
  const [pastPracticeSessions, setPastPracticeSessions] = useState([]);
  // Whether an interview is still open on this job card. Only the research
  // step's button reads it, to say Resume rather than Go to. Kept apart from
  // pastPracticeSessions, which is the completed history the left panel lists.
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [reviewSessionId, setReviewSessionId] = useState(null);
  // A paused session clicked in the history, to be picked back up rather than
  // read back. Separate from reviewSessionId because they end in different
  // states: one resumes the interview, the other opens its results.
  const [resumeSessionId, setResumeSessionId] = useState(null);
  // Bumped whenever the history list needs re-reading, which the practice
  // step's own effect has no other reason to do.
  const [practiceDataSignal, setPracticeDataSignal] = useState(0);
  // Bumped to ask PracticeView for a fresh start. A counter rather than a
  // boolean so pressing Practice Again twice in a row still registers twice.
  const [practiceResetSignal, setPracticeResetSignal] = useState(0);
  const [experienceLevel, setExperienceLevel] = useState('mid');

 const [errorToast, setErrorToast] = useState(null);
  const [successToast, setSuccessToast] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [interviewEvents, setInterviewEvents] = useState([]);

  // The jump is a one-shot. Without this, any later change to powerAnalysis
  // would re-run the effect and yank the view back to the requested step.
  const jumpAppliedRef = useRef(false);

  // Step completion derived from real data, not cursor position
  const analyzeComplete = !!powerAnalysis;

  // ============================================================================
  // DATA LOAD
  // ============================================================================

  const loadData = useCallback(async () => {
    try {
      setLoadError(null);

      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        router.push('/dashboard');
        return;
      }
      setUser(authUser);

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();
      setUserProfile(profile);
      setIsPro(profile?.subscription_tier === 'pro');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/dashboard');
        return;
      }

      const res = await fetch(`/api/power-analysis/get?jobCardId=${params.id}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        if (errBody.error === 'JOB_CARD_NOT_FOUND') {
          router.push('/interview-coach');
          return;
        }
        throw new Error(errBody.message || "We couldn't load this interview.");
      }

      const data = await res.json();
      setJobCard(data.jobCard);
      setResume(data.resume);
      setPowerAnalysis(data.powerAnalysis);

      // Sibling practices for the breadcrumb job switcher. Mirrors the hub's
      // card query: a job is practiceable when it has an active Power Analysis
      // and its application isn't archived.
      try {
        const { data: siblingRows, error: siblingError } = await supabase
          .from('power_analysis')
          .select('job_card_id, applications:job_card_id ( id, title, company, application_status )')
          .eq('user_id', authUser.id)
          .eq('is_active', true)
          .neq('job_card_id', params.id)
          .order('last_refreshed_at', { ascending: false, nullsFirst: false });
        if (siblingError) throw siblingError;

        setSiblingJobs(
          (siblingRows || [])
            .map(row => row.applications)
            .filter(app => app && app.application_status !== 'archived')
        );
      } catch (err) {
        // This only feeds breadcrumb navigation. Losing it costs a shortcut,
        // not the ability to practice, so log it rather than failing the load.
        console.warn('Breadcrumb job list failed to load:', err);
      }

      // Load interview events from application_events (source of truth)
      const { data: eventsData, error: eventsError } = await supabase
        .from('application_events')
        .select('*')
        .eq('application_id', params.id)
        .eq('status', 'interview_scheduled')
        .order('event_date', { ascending: true });
      if (eventsError) {
        console.error('Load interview events failed:', eventsError);
        setInterviewEvents([]);
      } else {
        setInterviewEvents(eventsData || []);
      }

      // Restore saved position. Runs before setLoading(false) so the persist
      // effects don't fire with defaults and clobber what was saved.
      // current_step on the Power Analysis wins: it's the column the hub reads,
      // so the two stay in agreement. interview_step is the older fallback.
      //
      // Skipped entirely when the hub asked for a specific step: restoring here
      // and correcting it afterwards left the outcome to whichever render won,
      // which is the race that made jumps land on the saved step instead of the
      // chosen one.
      const savedStep = data.powerAnalysis?.current_step || data.jobCard?.interview_step;
      if (!jumpStep && VALID_STEPS.includes(savedStep)) {
        setCurrentStep(savedStep);
      }

      setRetryCount(0);

    } catch (err) {
      console.error('Detail page load error:', err);
      if (retryCount < 1) {
        setRetryCount(retryCount + 1);
        setTimeout(() => loadData(), 1000);
      } else {
        setLoadError(err.message || "We couldn't load this interview. Please refresh the page.");
      }
    } finally {
      setLoading(false);
    }
  }, [params.id, retryCount, router, supabase, jumpStep]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================================================
  // PRACTICE STEP DATA
  // Loaded when the step is first opened rather than on every page load: none
  // of it is needed until the candidate is actually practicing.
  // ============================================================================
  useEffect(() => {
    if (currentStep !== 'practice' || !user?.id) return;
    let cancelled = false;

    async function loadPracticeData() {
      // The history list. Paused sessions belong in it too: the card is how
      // someone picks one back up. Ordered by created_at rather than
      // completed_at, which is null on everything still open.
      const { data: sessions, error: sessionsError } = await supabase
        .from('interview_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('job_card_id', params.id)
        .in('status', ['completed', 'in_progress'])
        .order('created_at', { ascending: false });
      if (!cancelled) {
        if (sessionsError) console.error('Past practice sessions load failed:', sessionsError);
        else setPastPracticeSessions(sessions || []);
      }

      // Display only. The route re-derives the level server side.
      const { data: context } = await supabase
        .from('career_context')
        .select('experience_level')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!cancelled && context?.experience_level) setExperienceLevel(context.experience_level);
    }

    loadPracticeData();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, user?.id, params.id, practiceDataSignal]);

  // ============================================================================
  // OPEN SESSION CHECK
  // Not part of the practice step load above: the research step needs the
  // answer before the candidate reaches practice, which is the whole point of
  // labelling the button Resume. Existence only, so it selects one column.
  // ============================================================================
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    async function checkForOpenSession() {
      const { data, error } = await supabase
        .from('interview_sessions')
        .select('id')
        .eq('user_id', user.id)
        .eq('job_card_id', params.id)
        .eq('status', 'in_progress')
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        // A label is not worth failing a page over. Falls back to the wording
        // that is right for someone with no session open.
        console.error('Open practice session check failed:', error);
        return;
      }
      setHasActiveSession(!!data);
    }

    checkForOpenSession();
    return () => { cancelled = true; };
    // currentStep is in here so the answer is re-asked on every step change.
    // A session started during practice, then paused, is invisible to a check
    // that only ran on mount: the row did not exist yet when it ran.
  }, [user?.id, params.id, supabase, currentStep]);

  // Auto-generate Power Analysis on first landing if none exists
  useEffect(() => {
    if (!loading && jobCard && !powerAnalysis && !paError && !generating) {
      // A free account that has already had its one analysis is shown the gate
      // here rather than sent to the route to be refused. The answer is the
      // same either way, and landing on a spinner first only delays it.
      if (!isPro && (userProfile?.interview_samples_used ?? 0) >= FREE_PA_LIMIT) {
        setPaError({ type: 'free_limit', message: FREE_PA_LIMIT_MESSAGE });
        return;
      }
      handleGeneratePA();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, powerAnalysis]);

  // Apply the hub's jump once the load has settled. A jump back to a step
  // already reached is view state only: it must not write current_step or
  // highest_step_reached, and the saved position stays whatever it was.
  useEffect(() => {
    if (loading || !hasPA || !jumpStep || jumpAppliedRef.current) return;
    jumpAppliedRef.current = true;

    const reached = reachedIndexFor(powerAnalysis?.highest_step_reached);
    const requested = VALID_STEPS.indexOf(jumpStep);

    if (requested === reached + 1) {
      // The step just past the mark is the one the hub's own button offers, and
      // pressing it is the user choosing to proceed — the same move as the
      // forward button on the step before it, so it is recorded the same way.
      // Without this the lock reads it as a jump ahead and hands it straight
      // back to the step they were already on.
      goToStep(jumpStep);
    } else if (requested > reached) {
      // Further ahead than that was never offered to anyone, so it lands on the
      // furthest step actually reached rather than unlocking the rest.
      setCurrentStep(VALID_STEPS[Math.max(reached, 0)]);
    } else {
      setCurrentStep(jumpStep);
    }
    // Drop the param so a refresh lands on the saved step instead of jumping
    // again. replaceState rather than router.replace: this is tidying the URL,
    // not a navigation, and it shouldn't re-render the tree.
    window.history.replaceState(null, '', window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, powerAnalysis, jumpStep]);

  // Find next upcoming interview event, or fall back to most recent past event
  const nextInterviewEvent = (() => {
    if (interviewEvents.length === 0) return null;
    const upcoming = interviewEvents.find(e => new Date(e.event_date).getTime() >= Date.now());
    if (upcoming) return upcoming;
    return interviewEvents[interviewEvents.length - 1];
  })();
  const nextInterviewDate = nextInterviewEvent?.event_date || null;

  useEffect(() => {
    if (!nextInterviewDate) return;
    const target = new Date(nextInterviewDate).getTime();
    if (target <= Date.now()) return;
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, [nextInterviewDate]);

  // A finished session belongs to the visit that finished it. Leaving the step
  // clears what was on screen, so coming back opens on the mode selector with
  // the session waiting in the history on the left, rather than dropping the
  // candidate straight back into results they already read.
  //
  // reviewSessionId especially: it survives the unmount, and PracticeView
  // reloads whatever it names on the way back in.
  useEffect(() => {
    if (currentStep === 'practice') return;
    setReviewSessionId(null);
    setResumeSessionId(null);
    setPracticeShape({ state: 'idle', session: null, questions: [], currentIndex: 0, completion: null });
  }, [currentStep]);

  // Auto-switch mobile panel when navigating to prepare or practice
  useEffect(() => {
    if (currentStep === 'prepare' || currentStep === 'practice') {
      setMobilePanel('coaching');
    }
  }, [currentStep]);

  // Persist current step to applications.interview_step. Fire-and-forget:
  // the UI never waits on this, and a failure is logged and otherwise ignored.
  useEffect(() => {
    if (loading) return;
    supabase
      .from('applications')
      .update({ interview_step: currentStep })
      .eq('id', params.id)
      .then(({ error }) => {
        if (error) console.error('Persist interview_step failed:', error);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, loading, params.id]);

  // One handler for both places a session can be destroyed: the trash icon on
  // a history card, and "Delete and start over" on a paused one. A delete
  // should look the same whichever of the two triggered it.
  const handleSessionDeleted = (deletedId) => {
    setPastPracticeSessions(prev => prev.filter(s => s.id !== deletedId));
    // A session open for review that no longer exists would otherwise keep the
    // right column on results loaded from a row that is gone.
    setReviewSessionId(prev => (prev === deletedId ? null : prev));
    setResumeSessionId(prev => (prev === deletedId ? null : prev));
    // Re-read rather than trust the local filter alone: the paused-session
    // block is driven off this list, and it has to stop showing one.
    setPracticeDataSignal(n => n + 1);
    setSuccessToast('Practice session deleted.');
  };

  // ============================================================================
  // POWER ANALYSIS GENERATION
  // ============================================================================

  const handleGeneratePA = async () => {
    setGenerating(true);
    setPaError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/dashboard');
        return;
      }

      const res = await fetch('/api/power-analysis/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ jobCardId: params.id })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data.error === 'RESUME_JD_MISMATCH') {
          setPaError({ type: 'mismatch', message: data.message || "This resume and this job description don't appear to match closely enough for an interview analysis." });
          return;
        }
        if (data.error === 'NO_RESUME_AVAILABLE') {
          setPaError({ type: 'no_resume', message: "You need a resume on file before we can analyze this job. Head to Resume Coach to upload or build one." });
          return;
        }
        if (data.error === 'JOB_CARD_INCOMPLETE') {
          setPaError({ type: 'incomplete', message: "This job card is missing a title or job description. Add those in Job Tracker first." });
          return;
        }
        if (data.error === 'FREE_PA_LIMIT_REACHED') {
          setPaError({ type: 'free_limit', message: FREE_PA_LIMIT_MESSAGE });
          return;
        }
        setPaError({ type: 'generic', message: "We couldn't analyze this job right now. Try again in a moment." });
        return;
      }

      await loadData();

    } catch (err) {
      console.error('Generate PA error:', err);
      setPaError({ type: 'generic', message: "We couldn't analyze this job right now. Try again in a moment." });
    } finally {
      setGenerating(false);
    }
  };


  // ============================================================================
  // STEP NAVIGATION
  // current_step on the Power Analysis row is what the hub reads to say where
  // someone is, so every forward move writes it. The write is optimistic and
  // non-blocking: navigation is the user's, and a failed update should cost
  // them a hub position, not the click.
  // ============================================================================

  const persistPowerAnalysis = async (patch) => {
    if (!powerAnalysis?.id) return;
    setPowerAnalysis(prev => (prev ? { ...prev, ...patch } : prev));
    const { error } = await supabase
      .from('power_analysis')
      .update(patch)
      .eq('id', powerAnalysis.id);
    if (error) console.error('Power Analysis step update failed:', error);
  };

  // highest_step_reached is a high-water mark, not a position: it only ever
  // moves forward. current_step alone can't carry completion, because stepping
  // back to analyze would then un-tick every step past it.
  const buildStepPatch = (step, extra = {}) => {
    const patch = { current_step: step, ...extra };
    const reached = VALID_STEPS.indexOf(powerAnalysis?.highest_step_reached || 'analyze');
    if (VALID_STEPS.indexOf(step) > reached) {
      patch.highest_step_reached = step;
    }
    return patch;
  };

  const goToStep = (step) => {
    setCurrentStep(step);
    persistPowerAnalysis(buildStepPatch(step));
  };

  // ============================================================================
  // HELPERS
  // ============================================================================

  function formatCountdown(interviewDateString) {
    if (!interviewDateString) return null;
    const target = new Date(interviewDateString).getTime();
    const diffMs = target - now;
    if (diffMs <= 0) return null;
    const totalMinutes = Math.floor(diffMs / 60_000);
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;
    if (days >= 2) return `${days} days away`;
    if (days === 1) return 'Tomorrow';
    if (hours >= 2) return `${hours} hours away`;
    if (hours === 1) return '1 hour away';
    return `${minutes} min away`;
  }

  // ============================================================================
  // RENDER GUARDS
  // ============================================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-purple-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
        <MainNav currentPage="my-interviews" userProfile={userProfile} />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="bg-white rounded-lg shadow-sm border-2 border-amber-200 p-8 max-w-md text-center">
            <svg className="w-16 h-16 text-amber-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load Interview</h2>
            <p className="text-sm text-gray-600 mb-6">{loadError}</p>
            <button
              onClick={() => { setLoadError(null); setRetryCount(0); setLoading(true); loadData(); }}
              className="text-white px-6 py-2 rounded-lg transition-opacity hover:opacity-90 font-medium text-sm md:text-xs"
              style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!jobCard) return null;

  const jobLabel = (job) => (job.company ? `${job.title} at ${job.company}` : job.title);

  const breadcrumbItems = [
    { label: 'Interview Coach', path: '/interview-coach' },
    {
      label: jobLabel(jobCard),
      options: siblingJobs
        .filter(j => j.id !== jobCard.id)
        .map(j => ({ label: jobLabel(j), path: `/interview/${j.id}` }))
    }
  ];

  const hasPA = !!powerAnalysis;
  const currentLevel = jobCard.interview_level || 0;
  const sessionsCount = jobCard.interview_sessions_count || 0;
  const countdown = formatCountdown(nextInterviewDate);
  const interviewDateIsPast = nextInterviewDate && new Date(nextInterviewDate).getTime() < now;

  // Every step shares one chrome: title and step counter only, content flush to
  // the breadcrumb, no white card wrapping the working surface. Practice used to
  // keep the full header card for the interview date and coaching progress, but
  // now that the step carries its own session panel the card only competed with it.
  const flatStep = true;

  // Research and Prepare have nothing to finish, so reaching them is what
  // counts. Measured against the high-water mark rather than the current step,
  // so walking back through the strip doesn't strip their checks.
  const reachedIndex = reachedIndexFor(powerAnalysis?.highest_step_reached);
  const completeByKey = {
    analyze: analyzeComplete,
    research: reachedIndex >= VALID_STEPS.indexOf('research'),
    prepare: reachedIndex >= VALID_STEPS.indexOf('prepare'),
    practice: sessionsCount > 0
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div className="bg-gray-50 flex flex-col overflow-hidden" style={{ height: '100vh', height: '100dvh' }}>
      <MainNav currentPage="my-interviews" userProfile={userProfile} />
      <div className="hidden md:block flex-shrink-0">
        <Breadcrumb items={breadcrumbItems} />
      </div>

      {/* Mobile toggle */}
      <div className="md:hidden flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-200 flex-shrink-0">
        <button
          onClick={() => setMobilePanel('analysis')}
          className="flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors"
          style={{
            color: mobilePanel === 'analysis' ? '#7c3aed' : '#6b7280',
            backgroundColor: mobilePanel === 'analysis' ? 'rgba(147, 51, 234, 0.08)' : 'transparent'
          }}
        >
          Power Analysis
        </button>
        <button
          onClick={() => setMobilePanel('coaching')}
          className="flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors"
          style={{
            color: mobilePanel === 'coaching' ? '#7c3aed' : '#6b7280',
            backgroundColor: mobilePanel === 'coaching' ? 'rgba(147, 51, 234, 0.08)' : 'transparent'
          }}
        >
          Coach
        </button>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0 md:max-w-7xl md:mx-auto md:w-full">

          {/* LEFT COLUMN — Power Analysis */}
          <div className={`flex flex-col overflow-hidden min-h-0 md:flex-[3] ${mobilePanel === 'analysis' ? 'flex' : 'hidden'} md:flex`}>
            {/* The flat steps drop this wrapper's own white-card treatment.
                Their buckets and cards are the cards, and white-on-white would
                hide the shadow that separates them.

                They also drop the horizontal margin and rely on px-6 alone, so
                headings and cards line up with the breadcrumb above (max-w-7xl
                px-6). Margin plus padding would inset them a second 24px and
                narrow the column for no reason. */}
            {/* Practice alone stretches this to the full column height. Its
                interviewer questions card sizes off the space left over, and a
                flex item defaults to flex-grow 0, so without this the container
                is only as tall as its content and there is no leftover to
                claim. Scoped to the one step rather than applied to all, since
                the others size to their content on purpose.

                Practice also runs tighter margins than the steps that size to
                their content: every pixel of surround here is a pixel the
                questions card doesn't get, and it is the one card on any step
                that wants all the height it can reach. Scrolling stays on
                everywhere — clipping cut the shadow off the bottom card. */}
            <div className={`flex flex-col overflow-y-auto bg-gray-100 ${
              currentStep === 'practice' ? 'flex-1 min-h-0' : ''
            } ${
              flatStep
                ? `gap-3 px-4 pb-4 md:px-6 md:bg-gray-50 ${
                    currentStep === 'practice' ? 'md:my-3 md:pb-3' : 'md:my-6 md:pb-6'
                  }`
                : 'gap-4 md:m-6 p-4 md:p-6 md:bg-white md:rounded-lg md:shadow-sm md:border md:border-gray-200'
            }`}>

              {/* INTERVIEW HEADER STRIP — title + instructions + date + coaching progress */}
              {hasPA && (
                <InterviewHeaderStrip
                  interviewDate={nextInterviewDate}
                  countdown={countdown}
                  interviewDateIsPast={interviewDateIsPast}
                  currentStep={currentStep}
                  titleOnly={flatStep}
                  company={jobCard.company}
                />
              )}

              {/* STALE PA WARNING — only when resume changed since analysis */}
              {hasPA && powerAnalysis.isStale && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2.5">
                  <span className="text-base flex-shrink-0 leading-none mt-0.5">⚠️</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-amber-900 leading-snug">
                      <strong>Your resume was updated since this analysis.</strong> This analysis reflects the previous version of your resume.
                    </p>
                  </div>
                  {/* A refresh is a whole analysis, and a free account has
                      only ever had one. The warning still stands — there is
                      just nothing to offer under it. */}
                  {isPro && (
                    <button
                      onClick={() => {
                        if (window.confirm("Refreshing creates a new analysis. Continue?")) {
                          handleGeneratePA();
                        }
                      }}
                      disabled={generating}
                      className="text-xs font-semibold text-amber-900 hover:text-amber-700 underline whitespace-nowrap disabled:opacity-50 flex-shrink-0"
                    >
                      {generating ? 'Refreshing...' : 'Refresh →'}
                    </button>
                  )}
                </div>
              )}

              {/* AUTO-GENERATING PA */}
              {!hasPA && generating && !paError && (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <div className="animate-spin h-8 w-8 border-4 border-purple-600 border-t-transparent rounded-full"></div>
                  <p className="text-sm md:text-xs text-gray-600">Building your Power Analysis...</p>
                </div>
              )}

              {/* FREE TIER — the one analysis is spent. Purple rather than the
                  red the errors below use: nothing has gone wrong, there is
                  simply nothing more to give away. */}
              {paError?.type === 'free_limit' && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <span className="text-base flex-shrink-0">🔒</span>
                    <div className="flex-1">
                      <p className="text-sm md:text-xs text-purple-900 leading-snug mb-3">{paError.message}</p>
                      <button
                        onClick={() => setShowUpgradeModal(true)}
                        className={STEP_PRIMARY_CLASS}
                        style={STEP_PRIMARY_STYLE}
                      >
                        Go Pro
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {paError && paError.type !== 'free_limit' && (
                <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                  <div className="flex items-start gap-2">
                    <span className="text-base flex-shrink-0">⚠️</span>
                    <div className="flex-1">
                      <p className="text-sm md:text-xs text-red-800 leading-snug mb-3">{paError.message}</p>
                      <div className="flex flex-wrap gap-2">
                        {paError.type === 'mismatch' && (
                          <button onClick={() => router.push('/resume-coach')} className="text-sm md:text-xs text-purple-600 hover:text-purple-700 font-semibold">Go to Resume Coach →</button>
                        )}
                        {paError.type === 'no_resume' && (
                          <button onClick={() => router.push('/resume-coach')} className="text-sm md:text-xs text-purple-600 hover:text-purple-700 font-semibold">Build a Resume →</button>
                        )}
                        {paError.type === 'incomplete' && (
                          <button onClick={() => router.push('/job-tracker')} className="text-sm md:text-xs text-purple-600 hover:text-purple-700 font-semibold">Edit in Job Tracker →</button>
                        )}
                        {paError.type === 'generic' && (
                          <button onClick={() => { setPaError(null); handleGeneratePA(); }} className="text-sm md:text-xs text-purple-600 hover:text-purple-700 font-semibold">Try Again</button>
                        )}
                        <button onClick={() => setPaError(null)} className="text-sm md:text-xs text-gray-500 hover:text-gray-700">Dismiss</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* RESEARCH — takes over the working surface on its own step.
                  The buckets are Power Analysis material and have nothing to do
                  with company research, so they step aside rather than stack. */}
              {currentStep === 'research' && <ResearchStepContent jobCard={jobCard} />}

              {/* PREPARE — like research, takes over the working surface. The
                  questions and the kit are what the candidate carries into the
                  room, and the buckets have nothing to do with either. */}
              {currentStep === 'prepare' && (
                <PrepareLeftColumn
                  jobCard={jobCard}
                  powerAnalysisId={powerAnalysis?.id}
                  candidateName={userProfile?.display_name}
                />
              )}

              {/* PRACTICE — session history and live progress. */}
              {currentStep === 'practice' && (
                <PracticeLeftPanel
                  userId={user?.id}
                  sessionState={practiceShape.state}
                  sessionData={practiceShape}
                  completionData={practiceShape.completion}
                  pastSessions={pastPracticeSessions}
                  onSelectSession={(s) => {
                    // A finished session is read back; an open one is picked
                    // back up. Same click, two different destinations.
                    if (s.status === 'in_progress') {
                      setReviewSessionId(null);
                      setResumeSessionId(s.id);
                    } else {
                      setResumeSessionId(null);
                      setReviewSessionId(s.id);
                    }
                  }}
                  onStartNew={() => {
                    setReviewSessionId(null);
                    setPracticeShape({ state: 'idle', session: null, questions: [], currentIndex: 0, completion: null });
                    // The panel above is only a mirror. Without this the right
                    // column stays on the results and reports itself completed
                    // again on its next render, pulling the mirror back with it.
                    setPracticeResetSignal(n => n + 1);
                  }}
                  onSessionDeleted={handleSessionDeleted}
                  onSuccess={setSuccessToast}
                  onError={setErrorToast}
                />
              )}

              {/* BUCKETS — read-only everywhere now. Nothing is coached from
                  them any more, so there is nothing to click into. */}
              {hasPA && currentStep !== 'research' && currentStep !== 'prepare' && currentStep !== 'practice' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-3">
                  <BucketColumn
                    title="Core Power"
                    icon="✅"
                    colorClass="green"
                    items={powerAnalysis.core_power}
                    emptyText="No core matches surfaced. Consider tailoring your resume."
                    getTextField={(item) => item.evidence}
                    getNameField={(item) => item.skill}
                  />

                  <BucketColumn
                    title="Hidden Power"
                    icon="💡"
                    colorClass="yellow"
                    items={powerAnalysis.hidden_power}
                    emptyText="No hidden transferable skills surfaced."
                    getTextField={(item) => item.evidence_reframe}
                    getNameField={(item) => item.skill}
                    getSourceField={(item) => item.source}
                  />

                  <BucketColumn
                    title="Power Gaps"
                    icon="⚠️"
                    colorClass="red"
                    items={powerAnalysis.power_gaps}
                    emptyText="No major gaps. You're well positioned for this role."
                    getTextField={(item) => item.bridge_strategy}
                    getNameField={(item) => item.gap}
                    getSeverityField={(item) => item.severity}
                  />
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN — Interview Preparation */}
          <div className={`flex-1 bg-white md:border-l md:border-gray-200 md:shadow-sm overflow-hidden flex flex-col md:px-6 md:pt-2 ${mobilePanel === 'coaching' ? 'flex' : 'hidden'} md:flex`}>
            <div className="sticky top-0 bg-white px-4 z-10 flex-shrink-0 pt-3 md:pt-4 pb-2 md:pb-3 border-b border-gray-100">
              <div className="mb-3 text-center">
                <h3 className="font-bold text-base md:text-sm text-gray-900 leading-tight">{jobCard.title}</h3>
                <div className="mt-3">
                  <p className="text-xs md:text-[10px] text-purple-600 font-semibold uppercase tracking-wide">Interview Preparation</p>
                </div>
              </div>
              <div className="relative">
                <div className="absolute top-3 left-0 right-0 h-0.5 bg-gray-300">
                  <div className="h-full transition-all duration-300" style={{
                    width: `${(Object.values(completeByKey).filter(Boolean).length / VALID_STEPS.length) * 100}%`,
                    background: 'linear-gradient(to right, #667eea, #764ba2)'
                  }}></div>
                </div>
                <div className="relative flex justify-between">
                  {[
                    { label: 'Analyze', key: 'analyze' },
                    { label: 'Research', key: 'research' },
                    { label: 'Prep', key: 'prepare' },
                    { label: 'Practice', key: 'practice' }
                  ].map(({ label, key }) => {
                    const current = key === currentStep;
                    // Unlocked by the high-water mark rather than by
                    // completion: a step they have already opened is one they
                    // can go back to, finished or not. Everything past the mark
                    // is locked — grey, dimmed and inert — so the only way
                    // forward is the panel button that also records the move.
                    const unlocked = current || VALID_STEPS.indexOf(key) <= reachedIndex;
                    const clickable = unlocked && !current;
                    const onStepClick = () => {
                      if (!clickable) return;
                      goToStep(key);
                    };
                    return (
                      <div
                        key={key}
                        className="flex flex-col items-center"
                        onClick={onStepClick}
                      >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold z-10 ${
                          current ? 'text-white' :
                          unlocked ? 'text-white cursor-pointer transition-colors' :
                          'bg-white border-2 border-gray-300 text-gray-400'
                        }`} style={unlocked ? { background: 'linear-gradient(to bottom right, #667eea, #764ba2)' } : {}}>
                          {current ? '●' : unlocked ? '✓' : '○'}
                        </div>
                        <span className={`text-sm md:text-xs mt-1 ${
                          current ? 'text-purple-600 font-semibold' :
                          unlocked ? 'text-purple-600 cursor-pointer hover:underline' :
                          'text-gray-400'
                        }`}>{label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col">

              {currentStep === 'analyze' && (
                <AnalyzeStepContent
                  stepHeader="📊 Your Power Analysis"
                  onGoToResearch={() => goToStep('research')}
                />
              )}

              {currentStep === 'research' && (
                <ResearchIdlePanel
                  onGoToPrepare={() => goToStep('prepare')}
                  onBack={() => goToStep('analyze')}
                />
              )}

              {currentStep === 'prepare' && (
                <PrepareStepContent
                  hasActiveSession={hasActiveSession}
                  onGoToPractice={() => goToStep('practice')}
                  onBack={() => goToStep('research')}
                />
              )}

              {currentStep === 'practice' && (
                <PracticeView
                  jobCardId={params.id}
                  powerAnalysisId={powerAnalysis?.id}
                  userId={user?.id}
                  isPro={isPro}
                  experienceLevel={experienceLevel}
                  jobTitle={jobCard.title}
                  jobCompany={jobCard.company}
                  // Shown before the mode selector rather than after a refused
                  // request. The route is still what enforces it.
                  practiceLocked={!isPro && (userProfile?.interview_sessions_used ?? 0) >= FREE_SESSION_LIMIT}
                  onUpgradeClick={() => setShowUpgradeModal(true)}
                  reviewSessionId={reviewSessionId}
                  resumeSessionId={resumeSessionId}
                  // The open session, if there is one. Read from the same list
                  // the history renders, so the card and the button can never
                  // disagree about whether one exists.
                  pausedSession={pastPracticeSessions.find(s => s.status === 'in_progress') || null}
                  onResumePaused={(id) => { setReviewSessionId(null); setResumeSessionId(id); }}
                  onSessionDeleted={handleSessionDeleted}
                  resetSignal={practiceResetSignal}
                  onBack={() => goToStep('prepare')}
                  onSessionPaused={() => {
                    setResumeSessionId(null);
                    setReviewSessionId(null);
                    // Re-read the history so the paused card is there waiting.
                    setPracticeDataSignal(n => n + 1);
                  }}
                  onSessionChange={setPracticeShape}
                  onError={setErrorToast}
                />
              )}

            </div>
          </div>

      </div>

      <ErrorToast message={errorToast} onClose={() => setErrorToast(null)} />
      <SuccessToast message={successToast} onClose={() => setSuccessToast(null)} />
      <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
    </div>
  );
}

// ============================================================================
// BUCKET COLUMN
// ============================================================================

function BucketColumn({
  title, icon, colorClass, items, emptyText,
  getTextField, getNameField, getSourceField
}) {
  const colors = {
    green: { border: 'border-green-200', bg: 'bg-green-50', titleText: 'text-green-800', countText: 'text-green-700', emptyText: 'text-green-700' },
    yellow: { border: 'border-yellow-200', bg: 'bg-yellow-50', titleText: 'text-yellow-800', countText: 'text-yellow-700', emptyText: 'text-yellow-800' },
    red: { border: 'border-red-200', bg: 'bg-red-50', titleText: 'text-red-800', countText: 'text-red-700', emptyText: 'text-red-800' }
  };
  const c = colors[colorClass];

  return (
    <div className={`border ${c.border} rounded-lg p-3 ${c.bg}`}>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-base">{icon}</span>
        <h4 className={`text-sm md:text-xs font-bold ${c.titleText}`}>{title}</h4>
        <div className="ml-auto flex items-center gap-2">
          <span className={`text-xs md:text-[10px] ${c.countText} font-semibold`}>{items.length}</span>
        </div>
      </div>
      {items.length === 0 ? (
        <p className={`text-sm md:text-xs ${c.emptyText} italic`}>{emptyText}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li key={i}>
              <div
                className="w-full text-left bg-white rounded p-2 border block"
                style={{ borderColor: '#e5e7eb', cursor: 'default' }}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm md:text-xs font-bold text-gray-900 flex-1">#{i + 1}: {getNameField(item)}</p>
                </div>
                {getTextField(item) && (
                  <p className="text-sm md:text-xs text-gray-700 leading-snug">{getTextField(item)}</p>
                )}
                {getSourceField && getSourceField(item) && (
                  <p className="text-xs md:text-[9px] text-gray-400 mt-1 italic">{getSourceField(item)}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ============================================================================
// ANALYZE STEP CONTENT
// ============================================================================

// ============================================================================
// STEP BUTTONS
// One forward button and one back link on every step, so the pair reads the
// same wherever you are. Secondary matches the outline button CoachingView
// already uses.
// ============================================================================

// Auto width, sized by their label, the way buttons read everywhere else in
// the app. Standalone ones add mx-auto; the coach pair sits in a centered row.
const STEP_BUTTON_BASE =
  'flex items-center justify-center gap-2 rounded-lg py-2 px-6 font-semibold text-sm md:text-xs whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed';
const STEP_PRIMARY_CLASS = `${STEP_BUTTON_BASE} text-white transition-opacity hover:opacity-90`;
const STEP_PRIMARY_STYLE = { background: 'linear-gradient(to right, #667eea, #764ba2)' };

function BackLink({ onClick, label = '← Back' }) {
  return (
    <div className="text-center">
      <button onClick={onClick} className="text-sm md:text-xs text-gray-400 hover:text-gray-600">
        {label}
      </button>
    </div>
  );
}

function AnalyzeStepContent({ onGoToResearch, stepHeader }) {
  return (
    <div className="px-5 py-4 space-y-3 flex-1 flex flex-col">
      <h3 className="font-semibold text-lg -mt-3">{stepHeader}</h3>
      <p className="text-sm md:text-xs text-gray-600 leading-relaxed">
        Your Power Analysis shows you where to focus so you can walk into your interview ready.
      </p>
      <ul className="space-y-2">
        <li className="flex items-start gap-2">
          <span className="text-sm w-5 text-center flex-shrink-0 leading-none mt-0.5">✅</span>
          <p className="text-sm md:text-xs text-gray-600 leading-relaxed">
            <span className="font-bold text-green-800">Core Power:</span> Your strongest matches for this role. These are the skills and experiences to include in your answers.
          </p>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-sm w-5 text-center flex-shrink-0 leading-none mt-0.5">💡</span>
          <p className="text-sm md:text-xs text-gray-600 leading-relaxed">
            <span className="font-bold text-yellow-800">Hidden Power:</span> Strengths you already have, even if they don’t look like an obvious match. We’ll show you how to connect the dots and make them work for you.
          </p>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-sm w-5 text-center flex-shrink-0 leading-none mt-0.5">⚠️</span>
          <p className="text-sm md:text-xs text-gray-600 leading-relaxed">
            <span className="font-bold text-red-800">Power Gaps:</span> Skills the job calls for that you may not have yet. Don&apos;t panic. We’ll help you prepare in case they come up.
          </p>
        </li>
      </ul>
      <p className="text-sm md:text-xs text-gray-500 leading-relaxed">
        Next step? We&apos;ll help you research the company.
      </p>
      {/* First step, so no back link. Completion lives in the strip's purple
          check; a second green badge saying the same thing only competed with
          it. */}
      <button
        onClick={onGoToResearch}
        className={`mx-auto ${STEP_PRIMARY_CLASS}`}
        style={STEP_PRIMARY_STYLE}
      >
        Go to Research
      </button>
    </div>
  );
}

// Platform status colors, same triad the Job Tracker score rings use.
const DOT_GREEN = '#81c784';
const DOT_AMBER = '#ffc870';
const DOT_PURPLE = '#9333ea';
// Headings on the tinted overview card — purple on purple loses contrast.
const HEADING_DARK = '#111827';

// Culture values and question types read as the same kind of thing, so they
// share one definition rather than two that can drift apart.
const TAG_SOFT = 'text-sm md:text-xs bg-purple-50 text-gray-600 border border-purple-100';

const TAG_VARIANTS = {
  culture: TAG_SOFT,
  question: TAG_SOFT,
  default: 'text-[11px] md:text-[10px] bg-purple-50 text-purple-700'
};

function Tag({ children, variant }) {
  const variantClass = TAG_VARIANTS[variant] || TAG_VARIANTS.default;
  return (
    <span className={`inline-block ${variantClass} rounded px-2 py-0.5`}>
      {children}
    </span>
  );
}

// Section heading in the Resume Coach panel idiom: uppercase micro-caps carrying
// a semantic color, so the eye sorts sections by meaning before reading a word.
function CardHeading({ children, color }) {
  return (
    <h4 className="text-sm font-bold uppercase tracking-wide mb-1.5" style={{ color }}>
      {children}
    </h4>
  );
}

// Every card renders whether or not it has data, so the grid keeps its shape.
// An empty card says so rather than collapsing and reflowing its neighbours.
// The shadow against the gray page is what makes it a card; the left rule is
// what marks it as a section of the brief.
function ResearchCard({ title, color, isEmpty, emptyText = 'No information available.', headerRight, children }) {
  return (
    <div className="bg-white shadow-sm rounded-lg p-4 border-l-4 border-purple-300">
      {headerRight ? (
        <div className="flex items-start justify-between gap-2">
          <CardHeading color={color}>{title}</CardHeading>
          {headerRight}
        </div>
      ) : (
        <CardHeading color={color}>{title}</CardHeading>
      )}
      {isEmpty ? <p className="text-sm md:text-xs text-gray-400">{emptyText}</p> : children}
    </div>
  );
}

function DotList({ items, color }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="text-sm md:text-xs text-gray-700 leading-snug flex items-start gap-2">
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5"
            style={{ backgroundColor: color }}
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

// Card-wrapped empty state. The hub versions sit inside an existing white card
// and need no wrapper; this one stands on the research step's grey backdrop, so
// it brings its own.
function ResearchEmptyState({ emoji, heading, children }) {
  return (
    <div className="bg-white shadow-sm rounded-lg p-8 text-center">
      <div className="text-3xl mb-2">{emoji}</div>
      <p className="text-base font-semibold text-gray-900 mb-1">{heading}</p>
      <p className="text-sm md:text-xs text-gray-500">{children}</p>
    </div>
  );
}

// `bullets` splits a comma-joined value ("~232 employees, Chicago IL") into
// separate points. Only safe for values that are lists; prose with commas in it
// must stay a single paragraph.
function Stat({ label, value, bullets, color = DOT_PURPLE }) {
  if (!value) return null;

  const parts = bullets
    ? String(value).split(',').map(p => p.trim()).filter(Boolean)
    : null;

  // Left rule at the same weight as the section cards, so nothing shouts.
  return (
    <div className="border-l-4 border-purple-300 pl-3">
      <CardHeading color={color}>{label}</CardHeading>
      {parts ? (
        <DotList items={parts} color={DOT_PURPLE} />
      ) : (
        <p className="text-sm md:text-xs text-gray-700 leading-snug">{value}</p>
      )}
    </div>
  );
}

const DIFFICULTY_STYLES = {
  easy: 'bg-green-50 text-green-700',
  medium: 'bg-amber-50 text-amber-700',
  hard: 'bg-red-50 text-red-700',
  unknown: 'bg-gray-100 text-gray-500'
};

// ============================================================================
// COMPANY RESEARCH HOOK
// Fetches the company brief for the research step. The route caches per company,
// so a remount serves from the cache rather than running a second search.
// ============================================================================

function useCompanyResearch(jobCard) {
  const supabase = createClient();
  const [research, setResearch] = useState(null);
  const [researchLoading, setResearchLoading] = useState(false);
  const [researchError, setResearchError] = useState(null);
  const [researchNotFound, setResearchNotFound] = useState(false);
  const [isRecruiter, setIsRecruiter] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadResearch() {
      setResearchLoading(true);
      setResearchError(null);
      setResearchNotFound(false);
      setIsRecruiter(false);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('No session');

        const res = await fetch('/api/interview/company-research', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            jobCardId: jobCard.id,
            companyName: jobCard.company,
            jobTitle: jobCard.title,
            jobDescription: jobCard.description
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Research failed');
        if (cancelled) return;
        // Neither of these is an error — there is nothing to retry, so say so
        // plainly instead of offering a button.
        if (data.isRecruiter) setIsRecruiter(true);
        else if (data.notFound) setResearchNotFound(true);
        else setResearch(data.research);
      } catch (err) {
        console.error('Company research load failed:', err);
        if (!cancelled) {
          setResearchError("Couldn't pull company info right now. You can still practice without it.");
        }
      } finally {
        if (!cancelled) setResearchLoading(false);
      }
    }

    // No company name means nothing to research, and no amount of retrying
    // changes that — same soft treatment as a company we can't find.
    if (!jobCard?.company) {
      setResearchNotFound(true);
      return;
    }

    loadResearch();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobCard?.id, jobCard?.company, attempt]);

  // Settled means the fetch is done and said something definite, whether that
  // was a brief, a recruiter, or nothing findable.
  const researchSettled =
    !researchLoading && !researchError && (!!research || researchNotFound || isRecruiter);

  return {
    research,
    researchLoading,
    researchError,
    researchNotFound,
    isRecruiter,
    researchSettled,
    retryResearch: () => setAttempt(a => a + 1)
  };
}

function ResearchStepContent({ jobCard }) {
  const {
    research, researchLoading, researchError, researchNotFound, isRecruiter, retryResearch
  } = useCompanyResearch(jobCard);

  const culture = research?.culture_signals;
  const style = research?.interview_style;
  const news = Array.isArray(research?.recent_news) ? research.recent_news : [];
  const difficulty = style?.difficulty || 'unknown';

  // No padding of its own — the left column already pads and gaps its children.
  return (
    <div className="space-y-3">
      {researchLoading && (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <div className="animate-spin h-8 w-8 border-4 border-purple-600 border-t-transparent rounded-full"></div>
          <p className="text-sm md:text-xs text-gray-600">
            Researching {jobCard?.company || 'this company'}...
          </p>
        </div>
      )}

      {!researchLoading && isRecruiter && (
        <ResearchEmptyState emoji="🏢" heading="Recruiting firm detected">
          {jobCard?.company || 'This company'} appears to be a recruiting firm hiring on behalf
          of an undisclosed client. Your Power Analysis is based on the job description, so
          you&apos;re still well prepared.
        </ResearchEmptyState>
      )}

      {!researchLoading && !isRecruiter && researchNotFound && (
        <ResearchEmptyState emoji="🔍" heading="No public information found">
          We couldn&apos;t find reliable public information about{' '}
          {jobCard?.company || 'this company'}. You can still practice without it.
        </ResearchEmptyState>
      )}

      {!researchLoading && researchError && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 space-y-2">
          <p className="text-xs text-gray-700 leading-snug">{researchError}</p>
          <button
            onClick={retryResearch}
            className="text-xs text-purple-600 hover:text-purple-700 font-semibold"
          >
            Try Again
          </button>
        </div>
      )}

      {!researchLoading && !researchError && !researchNotFound && !isRecruiter && research && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

          {/* ROW 1 — COMPANY OVERVIEW (full width). Tinted rather than white so
              it reads as the anchor of the grid, with dark headings for contrast
              against the purple. */}
          <div className="md:col-span-2 bg-purple-50 border border-purple-200 rounded-lg p-4">
            <CardHeading color={HEADING_DARK}>🏢 Company Overview</CardHeading>
            {research.what_they_do ? (
              <p className="text-sm md:text-xs text-gray-600 leading-relaxed">{research.what_they_do}</p>
            ) : (
              <p className="text-sm md:text-xs text-gray-400">No information available.</p>
            )}
            {(research.size_and_location || research.hiring_context) && (
              <div className="mt-3 pt-3 border-t border-purple-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Stat label="Size and location" value={research.size_and_location} bullets color={HEADING_DARK} />
                <Stat label="What they're hiring for" value={research.hiring_context} color={HEADING_DARK} />
              </div>
            )}
          </div>

          {/* ROW 2 — RECENT NEWS | CULTURE AND VALUES */}
          {/* Bold headline on its own line, the sentence beneath it — two long
              strings joined on one line read as a run-on. The date is dropped:
              headlines almost always carry the timeframe already. */}
          <ResearchCard title="📰 Recent News" color={DOT_PURPLE} isEmpty={news.length === 0}>
            <ul className="space-y-2">
              {news.map((item, i) => (
                <li key={i} className="text-sm md:text-xs text-gray-700 leading-snug flex items-start gap-2">
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5"
                    style={{ backgroundColor: DOT_PURPLE }}
                  />
                  <span>
                    <strong className="block text-gray-900">{item.headline}</strong>
                    {item.summary && <span className="text-gray-600">{item.summary}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </ResearchCard>

          <ResearchCard
            title="🧭 Culture & Values"
            color={DOT_PURPLE}
            isEmpty={!culture?.mission && !culture?.values?.length}
          >
            {culture?.mission && (
              <p className="text-sm md:text-xs text-gray-600 leading-relaxed mb-3">{culture.mission}</p>
            )}
            {Array.isArray(culture?.values) && culture.values.length > 0 && (
              <div className="flex flex-col items-start gap-1">
                {culture.values.map((v, i) => <Tag key={i} variant="culture">{v}</Tag>)}
              </div>
            )}
          </ResearchCard>

          {/* ROW 3 — WHAT PEOPLE LIKE | COMMON COMPLAINTS */}
          <ResearchCard
            title="✅ What People Like"
            color={DOT_PURPLE}
            isEmpty={!culture?.themes_positive?.length}
          >
            <DotList items={culture?.themes_positive || []} color={DOT_GREEN} />
          </ResearchCard>

          <ResearchCard
            title="⚠️ Common Complaints"
            color={DOT_PURPLE}
            isEmpty={!culture?.themes_negative?.length}
          >
            <DotList items={culture?.themes_negative || []} color={DOT_AMBER} />
          </ResearchCard>

          {/* ROW 4 — INTERVIEW FORMAT | QUESTION TYPES */}
          <ResearchCard
            title="🎯 Interview Format"
            color={DOT_PURPLE}
            isEmpty={!style?.likely_format}
            headerRight={
              <span className={`flex-shrink-0 inline-block text-[11px] font-semibold rounded px-2 py-0.5 capitalize ${
                DIFFICULTY_STYLES[difficulty] || DIFFICULTY_STYLES.unknown
              }`}>
                {difficulty}
              </span>
            }
          >
            <p className="text-sm md:text-xs text-gray-600 leading-relaxed">{style?.likely_format}</p>
          </ResearchCard>

          <ResearchCard
            title="💬 Question Types"
            color={DOT_PURPLE}
            isEmpty={!style?.known_question_types?.length}
          >
            <div className="flex flex-wrap gap-1">
              {(style?.known_question_types || []).map((q, i) => <Tag key={i} variant="question">{q}</Tag>)}
            </div>
          </ResearchCard>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// RESEARCH IDLE PANEL
// Right-column step driver for the research step. The reading happens on the
// left; this side just moves the user forward.
// ============================================================================

// What the brief on the left covers, in the order it covers it. Uniform, so a
// list rather than seven copies of the same markup.
const RESEARCH_TOPICS = [
  { icon: '🏢', label: 'Company overview' },
  { icon: '📰', label: 'Recent news' },
  { icon: '🧭', label: 'Culture and values' },
  { icon: '✅', label: 'What people like' },
  { icon: '⚠️', label: 'Common complaints' },
  { icon: '🎯', label: 'Interview format' },
  { icon: '💬', label: 'Question types' }
];

function ResearchIdlePanel({ onGoToPrepare, onBack }) {
  return (
    <div className="px-5 py-4 space-y-3 flex-1 flex flex-col">
      <h3 className="font-semibold text-lg -mt-3">🔍 Company Research</h3>
      <p className="text-sm md:text-xs text-gray-600 leading-relaxed">
        Get to know the company before your interview so that you can ask thoughtful questions. We&apos;ve gotten you started with the following info:
      </p>
      <ul className="space-y-1.5 pl-3">
        {RESEARCH_TOPICS.map(({ icon, label }) => (
          <li key={label} className="flex items-start gap-2">
            <span className="text-sm w-5 text-center flex-shrink-0 leading-none mt-0.5">{icon}</span>
            <p className="text-sm md:text-xs text-gray-600 leading-relaxed">{label}</p>
          </li>
        ))}
      </ul>
      <p className="text-sm md:text-xs text-gray-500 leading-relaxed">
        Next step? Print your interview toolkit.
      </p>
      {/* One flex item, so the row gap above the button doesn't also open
         between the button and the link under it. */}
      <div className="flex flex-col items-center gap-1">
        <button onClick={onGoToPrepare} className={STEP_PRIMARY_CLASS} style={STEP_PRIMARY_STYLE}>
          Go to Prep
        </button>
        <BackLink onClick={onBack} />
      </div>
    </div>
  );
}

// ============================================================================
// PREPARE STEP
// The last stop before practice: the questions the candidate asks, and the kit
// they print and carry in. Selection happens once per Power Analysis on the
// server, so arriving here is what fixes the list — the same questions are
// waiting on every later visit.
// ============================================================================

function PrepareLeftColumn({ jobCard, powerAnalysisId, candidateName }) {
  const supabase = createClient();
  const { research, researchSettled, researchError } = useCompanyResearch(jobCard);
  const [questions, setQuestions] = useState([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionsError, setQuestionsError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadQuestions() {
      setQuestionsLoading(true);
      setQuestionsError(null);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('No session');

        const res = await fetch('/api/interview/interviewer-questions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            powerAnalysisId,
            jobCardId: jobCard.id,
            companyName: jobCard.company,
            jobTitle: jobCard.title,
            jobDescription: jobCard.description,
            companyResearch: research || null
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Questions failed');
        if (cancelled) return;
        setQuestions(Array.isArray(data.questions) ? data.questions : []);
      } catch (err) {
        console.error('Interviewer questions load failed:', err);
        if (!cancelled) {
          setQuestionsError("Couldn't load your interviewer questions right now.");
        }
      } finally {
        if (!cancelled) setQuestionsLoading(false);
      }
    }

    if (!powerAnalysisId || !jobCard?.id) return;
    // Waits on the brief so it rides along in the same request and the
    // questions can name something real about the company. Settling covers
    // not-found and recruiter too. A brief that failed outright goes ahead
    // anyway, on the job description alone: the questions matter more than the
    // tailoring, and there may never be a retry.
    if (!researchSettled && !researchError) return;

    loadQuestions();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [researchSettled, researchError, powerAnalysisId, jobCard?.id]);

  // Still working means the brief hasn't settled yet or the questions are in
  // flight. One spinner covers both: from here it is the same wait.
  const stillWorking = questionsLoading || (!researchSettled && !researchError);

  // No padding of its own — the left column already pads and gaps its children.
  return (
    <div className="space-y-3">

      {/* QUESTIONS FOR YOUR INTERVIEWER */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-5">
        <CardHeading color={DOT_PURPLE}>Questions For Your Interviewer</CardHeading>

        {stillWorking ? (
          <div className="flex justify-center py-3">
            <div className="h-4 w-4 animate-spin border-2 border-purple-600 border-t-transparent rounded-full"></div>
          </div>
        ) : questionsError ? (
          <p className="text-sm md:text-xs text-gray-600">{questionsError}</p>
        ) : questions.length > 0 ? (
          <div className="space-y-4">
            {questions.map((q, i) => (
              <div key={q.id || i} className={i === 0 ? '' : 'border-t border-purple-200 pt-4'}>
                <div className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0 mt-1.5"></span>
                  <div className="min-w-0">
                    <p className="text-sm md:text-xs font-semibold text-gray-900 leading-snug">
                      {q.tailored_text || q.original_text}
                    </p>
                    {q.rationale && (
                      <p className="text-sm md:text-xs text-gray-600 leading-snug mt-0.5">
                        {q.rationale}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm md:text-xs text-gray-400">No questions available.</p>
        )}
      </div>

      {/* PRINTABLE INTERVIEW TOOLKIT */}
      <InterviewToolkit
        jobCardId={jobCard?.id}
        powerAnalysisId={powerAnalysisId}
        candidateName={candidateName}
        company={jobCard?.company}
      />
    </div>
  );
}

// ============================================================================
// PREPARE STEP PANEL
// Right-column step driver for the prepare step. The questions and the kit are
// on the left; this side says what they are for and moves the user on.
// ============================================================================

function PrepareStepContent({ hasActiveSession = false, onGoToPractice, onBack }) {
  return (
    <div className="px-5 py-4 space-y-2 flex-1 flex flex-col">
      <h3 className="font-semibold text-lg -mt-3">📋 Interview Prep</h3>
      <p className="text-sm md:text-xs text-gray-600 leading-relaxed">
        Of course you&apos;re thinking about what they&apos;re going to ask you. But have you thought about what you want to ask them?
            
      </p>
      <p className="text-sm md:text-xs text-gray-600 leading-relaxed">
        Great questions show that you&apos;re prepared, engaged, and seriously considering whether the role is right for you, too. We&apos;ve put together a few ideas to get you started - plus an Interview Toolkit you can print as a reference. It includes:
      </p>
      <ul className="space-y-1 pl-3">
        <li className="flex items-start gap-2">
          <span className="text-sm w-5 text-center flex-shrink-0 leading-none mt-0.5">📊</span>
          <p className="text-sm md:text-xs text-gray-600 leading-relaxed">Your Power Analysis</p>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-sm w-5 text-center flex-shrink-0 leading-none mt-0.5">💡</span>
          <p className="text-sm md:text-xs text-gray-600 leading-relaxed">Questions for your interviewer</p>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-sm w-5 text-center flex-shrink-0 leading-none mt-0.5">🏢</span>
          <p className="text-sm md:text-xs text-gray-600 leading-relaxed">Company highlights</p>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-sm w-5 text-center flex-shrink-0 leading-none mt-0.5">📄</span>
          <p className="text-sm md:text-xs text-gray-600 leading-relaxed">The job description</p>
        </li>
      </ul>
      <p className="text-sm md:text-xs text-gray-500 leading-relaxed">
        Ready to practice? Your mock interview is ready!
      </p>
      {/* One flex item, so the row gap above the button doesn't also open
         between the button and the link under it. */}
      <div className="flex flex-col items-center gap-1">
        <button onClick={onGoToPractice} className={STEP_PRIMARY_CLASS} style={STEP_PRIMARY_STYLE}>
          {hasActiveSession ? 'Resume Practice' : 'Go to Practice'}
        </button>
        <BackLink onClick={onBack} />
      </div>
    </div>
  );
}

// The kit checklist. Keys are what the PDF template gates each section on, and
// the order here is the order the sections print in, so ticking down the list
// reads the same way the printout does.
const KIT_ITEMS = [
  { key: 'powerAnalysis', label: 'Power Analysis' },
  { key: 'highlights', label: 'Company Highlights' },
  { key: 'questions', label: 'Interviewer Questions' },
  { key: 'jobDescription', label: 'Job Description' }
];

function KitCheckbox({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-1.5 cursor-pointer">
      {/* The real input carries the semantics and keyboard behaviour; the div
          beside it is what's actually seen. */}
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
      <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${
        checked ? 'bg-purple-600 border-purple-600' : 'border-gray-300 bg-white'
      }`}>
        {checked && (
          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <span className="text-xs text-gray-700 whitespace-nowrap">{label}</span>
    </label>
  );
}

// The kit the candidate prints and carries in. One row of tick boxes and a
// button: it is a thing you reach for once, not a surface to work on.
function InterviewToolkit({ jobCardId, powerAnalysisId, candidateName, company }) {
  const supabase = createClient();
  const [selected, setSelected] = useState({});
  const [buildingPdf, setBuildingPdf] = useState(false);
  const [pdfError, setPdfError] = useState(null);

  // Read fresh rather than captured at mount. An interview can outrun a
  // Supabase JWT, and getSession refreshes one that's close to expiring.
  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  const checkedCount = KIT_ITEMS.filter(item => selected[item.key]).length;
  const allChecked = checkedCount === KIT_ITEMS.length;

  const toggleAll = () => {
    // Partial selections resolve to all-on, so the link is never a dead click.
    const next = !allChecked;
    setSelected(Object.fromEntries(KIT_ITEMS.map(item => [item.key, next])));
  };

  const toggleItem = (key) => {
    setSelected(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Rendered server side rather than in the browser: @react-pdf/renderer is
  // well over a megabyte, and the practice step shouldn't carry it for a
  // button most candidates press once.
  const downloadKit = async () => {
    setBuildingPdf(true);
    setPdfError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('No session');

      const res = await fetch('/api/interview/interview-kit-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ jobCardId, powerAnalysisId, selected })
      });

      if (!res.ok) throw new Error('Kit PDF request failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      // Underscored the way the resume and cover letter downloads name theirs,
      // so a candidate's downloads folder sorts them together. Either part can
      // be missing, so the name is built from whatever is actually there
      // rather than leaving an empty segment behind.
      link.download = `${[
        'Interview_Kit',
        candidateName?.trim().replace(/\s+/g, '_'),
        company?.trim().replace(/\s+/g, '_')
      ].filter(Boolean).join('_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      // Revoking immediately can cancel the download in Safari, so give the
      // click a beat to start.
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      console.error('Interview kit PDF failed:', err);
      setPdfError("Couldn't build your kit. Please try again.");
    } finally {
      setBuildingPdf(false);
    }
  };

  const disabled = checkedCount === 0 || buildingPdf || !jobCardId;

  return (
    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
      <CardHeading color={DOT_PURPLE}>📋 Printable Interview Toolkit</CardHeading>
      <p className="text-sm md:text-xs text-gray-600 leading-relaxed mb-2">
        Select what you want to include and print it to take with you.
      </p>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleAll}
          className="text-xs text-gray-900 font-semibold cursor-pointer hover:text-gray-600 whitespace-nowrap border-r border-gray-200 pr-3 mr-1"
        >
          {allChecked ? 'Deselect All' : 'Select All'}
        </button>

        {KIT_ITEMS.map(item => (
          <KitCheckbox
            key={item.key}
            checked={!!selected[item.key]}
            onChange={() => toggleItem(item.key)}
            label={item.label}
          />
        ))}

        <button
          type="button"
          onClick={downloadKit}
          disabled={disabled}
          className={`text-white rounded py-1 px-3 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap ${
            disabled ? 'opacity-50 cursor-not-allowed' : 'transition-opacity hover:opacity-90'
          }`}
          style={STEP_PRIMARY_STYLE}
        >
          {buildingPdf && (
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-r-transparent"></div>
          )}
          {buildingPdf ? 'Building...' : 'Print'}
        </button>
      </div>

      {/* Only ever a second line, and only on failure — the controls above
          stay on one row. */}
      {pdfError && (
        <p className="text-xs text-gray-500 mt-1 text-right">{pdfError}</p>
      )}
    </div>
  );
}

function InterviewHeaderStrip({
  interviewDate, countdown, interviewDateIsPast, currentStep, titleOnly, company
}) {
  const hasDate = !!interviewDate;
  const dateObj = hasDate ? new Date(interviewDate) : null;
  const month = dateObj ? dateObj.toLocaleDateString(undefined, { month: 'short' }) : '';
  const day = dateObj ? dateObj.getDate() : '';
  const weekday = dateObj ? dateObj.toLocaleDateString(undefined, { weekday: 'long' }) : '';
  const shortDate = dateObj ? dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';

  const title = (
    <div className="flex-1 min-w-0">
      <h2 className="text-base md:text-lg font-bold text-gray-900 mb-1">
        {currentStep === 'analyze' && 'Power Analysis'}
        {currentStep === 'research' && (
          company
            ? <>Company Research: <span style={{ color: DOT_PURPLE }}>{company}</span></>
            : 'Company Research'
        )}
        {currentStep === 'prepare' && 'Interview Prep'}
        {currentStep === 'practice' && 'Interview Practice'}
      </h2>
      <p className="text-xs text-gray-400 leading-snug">
        {currentStep === 'analyze' && 'Interview Coach: Step 1 of 4'}
        {currentStep === 'research' && 'Interview Coach: Step 2 of 4'}
        {currentStep === 'prepare' && 'Interview Coach: Step 3 of 4'}
        {currentStep === 'practice' && 'Interview Coach: Step 4 of 4'}
      </p>
    </div>
  );

  // The flat steps keep the step title but drop the card, the date widget and
  // the progress bar.
  if (titleOnly) {
    return (
      <div className="flex items-start justify-between gap-3">
        {title}
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 md:p-4">
      <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">

        {/* TITLE + INSTRUCTIONS */}
        {title}

        {/* DATE */}
        <div className="flex items-center gap-3 md:border-l md:border-gray-200 md:pl-6">
          <div
            className="w-12 h-12 rounded-md overflow-hidden flex flex-col flex-shrink-0"
            style={{
              border: hasDate ? '1px solid #e5e7eb' : '1.5px dashed #c4b5fd',
              background: hasDate ? '#ffffff' : 'rgba(199, 184, 246, 0.06)'
            }}
          >
            <div
              className="text-center font-bold uppercase text-[9px] tracking-wider py-1"
              style={{
                background: hasDate ? (interviewDateIsPast ? '#d1d5db' : '#667eea') : 'transparent',
                color: hasDate ? '#ffffff' : '#a78bfa',
                lineHeight: 1
              }}
            >
              {hasDate ? month : '—'}
            </div>
            <div
              className="text-center text-xl font-bold pt-1.5"
              style={{
                color: hasDate ? (interviewDateIsPast ? '#9ca3af' : '#111827') : '#c4b5fd',
                lineHeight: 1
              }}
            >
              {hasDate ? day : '·'}
            </div>
          </div>

          <div className="flex flex-col gap-0.5 min-w-0">
            {hasDate && !interviewDateIsPast ? (
              <>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{weekday}</p>
                <p className="text-sm font-bold whitespace-nowrap" style={{ color: '#764ba2' }}>{countdown}</p>
              </>
            ) : interviewDateIsPast ? (
              <>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{weekday}</p>
                <p className="text-xs text-gray-400 whitespace-nowrap">Past · {shortDate}</p>
              </>
            ) : (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#a78bfa' }}>Not scheduled</p>
                <p className="text-xs text-gray-400 leading-tight">Set in Job Tracker</p>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
