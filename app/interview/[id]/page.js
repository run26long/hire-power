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

const VALID_STEPS = ['analyze', 'coach', 'research', 'prepare', 'practice'];

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
  const [stories, setStories] = useState([]);

  const [generating, setGenerating] = useState(false);
  const [paError, setPaError] = useState(null);

  // Step navigation: 'analyze' | 'coach' | 'practice'
  const [currentStep, setCurrentStep] = useState('analyze');

  // Coaching active state
  const [activeStory, setActiveStory] = useState(null);
  const [coachingMessages, setCoachingMessages] = useState([]);
  const [coachInput, setCoachInput] = useState('');
  const [coachSending, setCoachSending] = useState(false);
  const [coachStarting, setCoachStarting] = useState(false);
  const [coachError, setCoachError] = useState(null);

  // Batch mode state
  const [batchQueue, setBatchQueue] = useState([]);
  const [batchPosition, setBatchPosition] = useState(0);
  const [batchChecks, setBatchChecks] = useState({});
  const [batchJustCompleted, setBatchJustCompleted] = useState(null);

  // Story viewing modal state
  const [viewingStory, setViewingStory] = useState(null);

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
  const [reviewSessionId, setReviewSessionId] = useState(null);
  const [interviewerQuestions, setInterviewerQuestions] = useState([]);
  const [experienceLevel, setExperienceLevel] = useState('mid');

 const [errorToast, setErrorToast] = useState(null);
  const [successToast, setSuccessToast] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [interviewEvents, setInterviewEvents] = useState([]);

  const messagesEndRef = useRef(null);
  const coachInputRef = useRef(null);
  // The jump is a one-shot. Without this, any later change to powerAnalysis
  // would re-run the effect and yank the view back to the requested step.
  const jumpAppliedRef = useRef(false);

  // Step completion derived from real data, not cursor position
  const analyzeComplete = !!powerAnalysis;
  // Coaching is done once they leave it, whether they coached or skipped.
  // Falls back to "any story coached" for rows written before the column
  // existed, so history doesn't suddenly read as unfinished.
  const coachComplete =
    powerAnalysis?.coaching_status === 'completed' ||
    powerAnalysis?.coaching_status === 'skipped' ||
    stories.some(s => s.coachingComplete);

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

      let loadedStories = [];
      if (data.powerAnalysis) {
        const storiesRes = await fetch(`/api/story-coach/get?jobCardId=${params.id}`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        if (storiesRes.ok) {
          const storiesData = await storiesRes.json();
          loadedStories = storiesData.stories || [];
          setStories(loadedStories);
        }
      } else {
        setStories([]);
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

      const savedStoryId = data.jobCard?.interview_active_story_id;
      if (savedStoryId) {
        const savedStory = loadedStories.find(s => s.id === savedStoryId && !s.coachingComplete);
        if (savedStory) {
          openCoachingForItem(savedStory.itemType, savedStory.itemIndex, savedStory.itemSkill);
        }
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
      // Completed sessions for the history list.
      const { data: sessions, error: sessionsError } = await supabase
        .from('interview_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('job_card_id', params.id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false });
      if (!cancelled) {
        if (sessionsError) console.error('Past practice sessions load failed:', sessionsError);
        else setPastPracticeSessions(sessions || []);
      }

      // The candidate's own questions, for the closer.
      if (powerAnalysis?.id) {
        const { data: questions, error: questionsError } = await supabase
          .from('interviewer_questions_selected')
          .select('*')
          .eq('power_analysis_id', powerAnalysis.id)
          .eq('user_id', user.id)
          .order('order_index', { ascending: true });
        if (!cancelled) {
          if (questionsError) console.error('Interviewer questions load failed:', questionsError);
          else setInterviewerQuestions(questions || []);
        }
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
  }, [currentStep, user?.id, powerAnalysis?.id, params.id]);

  // Auto-generate Power Analysis on first landing if none exists
  useEffect(() => {
    if (!loading && jobCard && !powerAnalysis && !paError && !generating) {
      handleGeneratePA();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, powerAnalysis]);

  // Apply the hub's jump once the load has settled. View state only: this is a
  // backward jump to revisit a finished step, so it must not write current_step
  // or highest_step_reached. The saved position stays whatever it was.
  useEffect(() => {
    if (loading || !hasPA || !jumpStep || jumpAppliedRef.current) return;
    jumpAppliedRef.current = true;
    setCurrentStep(jumpStep);
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

  useEffect(() => {
    if (currentStep === 'coach' && activeStory && coachingMessages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [coachingMessages, currentStep, activeStory]);

  useEffect(() => {
    if (currentStep === 'coach' && activeStory && !coachSending && !coachStarting) {
      coachInputRef.current?.focus({ preventScroll: true });
    }
  }, [currentStep, activeStory, coachSending, coachStarting]);

  // Auto-switch mobile panel when navigating to coach or practice
  useEffect(() => {
    if (currentStep === 'coach' || currentStep === 'practice') {
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

  // Persist the active story to applications.interview_active_story_id.
  // Writes null when the conversation is closed. Fire-and-forget.
  useEffect(() => {
    if (loading) return;
    supabase
      .from('applications')
      .update({ interview_active_story_id: activeStory?.id ?? null })
      .eq('id', params.id)
      .then(({ error }) => {
        if (error) console.error('Persist interview_active_story_id failed:', error);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStory?.id, loading, params.id]);

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
  // COACHING: START / RESUME
  // ============================================================================

  const openCoachingForItem = async (itemType, itemIndex, itemSkill) => {
    setCoachStarting(true);
    setCoachError(null);
    setActiveStory(null);
    setCoachingMessages([]);
    setBatchJustCompleted(null);
    setCurrentStep('coach');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch('/api/story-coach/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ jobCardId: params.id, itemType, itemIndex })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data.error === 'STORY_ALREADY_COMPLETE') {
          setCoachError("This story is already saved. Tap the card to view it.");
          return;
        }
        throw new Error(data.message || "We couldn't start coaching.");
      }

      setActiveStory({
        id: data.storyId,
        itemType: data.itemType,
        itemIndex: data.itemIndex,
        itemSkill: data.itemSkill
      });

      const messagesForUI = [];
      const dialogue = data.dialogue || [];
      dialogue.forEach((msg, i) => {
        if (i === 0 && msg.role === 'user') return; // skip hidden context message
        messagesForUI.push(msg);
      });
      setCoachingMessages(messagesForUI);

    } catch (err) {
      console.error('Start coaching error:', err);
      setCoachError(err.message || "We couldn't start coaching. Try again.");
    } finally {
      setCoachStarting(false);
    }
  };

  const handleSendCoachMessage = async () => {
    const text = coachInput.trim();
    if (!text || !activeStory) return;

    setCoachSending(true);
    setCoachError(null);

    const optimisticMessages = [...coachingMessages, { role: 'user', content: text }];
    setCoachingMessages(optimisticMessages);
    setCoachInput('');
    if (coachInputRef.current) coachInputRef.current.style.height = 'auto';

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch('/api/story-coach/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ storyId: activeStory.id, userMessage: text })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || "We couldn't send your message.");
      }

      setCoachingMessages([...optimisticMessages, { role: 'assistant', content: data.response }]);

      if (data.isComplete && data.story) {
        setStories(prevStories => {
          const filtered = prevStories.filter(s => s.id !== data.story.id);
          return [...filtered, {
            id: data.story.id,
            itemType: data.story.itemType,
            itemIndex: data.story.itemIndex,
            itemSkill: data.story.itemSkill,
            coachingComplete: true,
            starSituation: data.story.star_situation,
            starTask: data.story.star_task,
            starAction: data.story.star_action,
            starResult: data.story.star_result,
            polishedStory: data.story.polished_story
          }];
        });

        setSuccessToast('Story saved to your card.');

        if (batchQueue.length > 0) {
          setBatchJustCompleted({
            itemType: data.story.itemType,
            itemIndex: data.story.itemIndex,
            itemSkill: data.story.itemSkill,
            polishedStory: data.story.polished_story
          });
        } else {
          setBatchJustCompleted({
            itemType: data.story.itemType,
            itemIndex: data.story.itemIndex,
            itemSkill: data.story.itemSkill,
            polishedStory: data.story.polished_story,
            single: true
          });
        }
      } else if (data.isComplete && data.finalizeFailed) {
        setCoachError(data.message || "We couldn't save your story. Send one more message and the coach will wrap up again.");
      }

    } catch (err) {
      console.error('Send coach message error:', err);
      setCoachError(err.message || "We couldn't send your message. Try again.");
      setCoachingMessages(coachingMessages);
      setCoachInput(text);
    } finally {
      setCoachSending(false);
    }
  };

  const handleOpenCoachStep = () => {
    setBatchChecks({});
    setBatchQueue([]);
    setBatchPosition(0);
    setActiveStory(null);
    setCoachingMessages([]);
    setCurrentStep('coach');
  };

  const handleStartBatch = () => {
    if (!powerAnalysis) return;

    // Nothing ticked reads as "just coach my stories", so the whole uncoached
    // set is queued rather than the click doing nothing. Ticking items is a way
    // to narrow the run, not a precondition for starting one.
    const nothingChecked = !Object.values(batchChecks).some(Boolean);
    const wanted = (key) => nothingChecked || !!batchChecks[key];

    const queue = [];

    powerAnalysis.core_power.forEach((item, i) => {
      if (wanted(`core_power:${i}`) && !isItemCoached('core_power', i)) {
        queue.push({ itemType: 'core_power', itemIndex: i, itemSkill: item.skill });
      }
    });
    powerAnalysis.hidden_power.forEach((item, i) => {
      if (wanted(`hidden_power:${i}`) && !isItemCoached('hidden_power', i)) {
        queue.push({ itemType: 'hidden_power', itemIndex: i, itemSkill: item.skill });
      }
    });
    powerAnalysis.power_gaps.forEach((item, i) => {
      if (wanted(`power_gap:${i}`) && !isItemCoached('power_gap', i)) {
        queue.push({ itemType: 'power_gap', itemIndex: i, itemSkill: item.gap });
      }
    });

    // Only reachable when every item already has a story.
    if (queue.length === 0) {
      setSuccessToast('Every item already has a coached story.');
      return;
    }

    setBatchQueue(queue);
    setBatchPosition(0);
    const first = queue[0];
    openCoachingForItem(first.itemType, first.itemIndex, first.itemSkill);
  };

  const handleAdvanceBatch = () => {
    const nextPos = batchPosition + 1;
    if (nextPos >= batchQueue.length) {
      setBatchQueue([]);
      setBatchPosition(0);
      setBatchJustCompleted(null);
      setActiveStory(null);
      setBatchChecks({});
      return;
    }
    setBatchPosition(nextPos);
    setBatchJustCompleted(null);
    const next = batchQueue[nextPos];
    openCoachingForItem(next.itemType, next.itemIndex, next.itemSkill);
  };

  const handleEndCoaching = () => {
    setActiveStory(null);
    setCoachingMessages([]);
    setCoachInput('');
    setBatchQueue([]);
    setBatchPosition(0);
    setBatchJustCompleted(null);
    setBatchChecks({});
  };

  const handleGoToPractice = () => {
    handleEndCoaching();
    goToStep('practice');
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

  // Leaving coaching is what decides whether it counts as done. Nothing coached
  // means they chose to move on, which is 'skipped' rather than a failure.
  const goToResearchFromCoach = () => {
    const coachedCount = stories.filter(s => s.coachingComplete).length;
    setCurrentStep('research');
    persistPowerAnalysis(buildStepPatch('research', {
      coaching_status: coachedCount > 0 ? 'completed' : 'skipped'
    }));
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

  function isItemCoached(itemType, itemIndex) {
    return stories.some(s => s.itemType === itemType && s.itemIndex === itemIndex && s.coachingComplete);
  }

  function getStoryForItem(itemType, itemIndex) {
    return stories.find(s => s.itemType === itemType && s.itemIndex === itemIndex && s.coachingComplete);
  }

  function handleItemClick(itemType, itemIndex, itemSkill) {
    if (isItemCoached(itemType, itemIndex)) {
      const story = getStoryForItem(itemType, itemIndex);
      if (story) {
        setViewingStory({ ...story, itemSkill: itemSkill || story.itemSkill });
      }
    } else {
      openCoachingForItem(itemType, itemIndex, itemSkill);
    }
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
  const reachedIndex = VALID_STEPS.indexOf(powerAnalysis?.highest_step_reached || 'analyze');
  const completeByKey = {
    analyze: analyzeComplete,
    coach: coachComplete,
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
            <div className={`flex flex-col overflow-y-auto bg-gray-100 ${
              flatStep
                ? 'gap-3 md:my-6 px-4 pb-4 md:px-6 md:pb-6 md:bg-gray-50'
                : 'gap-4 md:m-6 p-4 md:p-6 md:bg-white md:rounded-lg md:shadow-sm md:border md:border-gray-200'
            }`}>

              {/* INTERVIEW HEADER STRIP — title + instructions + date + coaching progress */}
              {hasPA && (
                <InterviewHeaderStrip
                  storiesCoached={stories.filter(s => s.coachingComplete).length}
                  totalStoryItems={powerAnalysis.core_power.length + powerAnalysis.hidden_power.length + powerAnalysis.power_gaps.length}
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
                  <button
                    onClick={() => {
                      if (window.confirm("Refreshing creates a new analysis. Your existing coached stories may not match the new items. Continue?")) {
                        handleGeneratePA();
                      }
                    }}
                    disabled={generating}
                    className="text-xs font-semibold text-amber-900 hover:text-amber-700 underline whitespace-nowrap disabled:opacity-50 flex-shrink-0"
                  >
                    {generating ? 'Refreshing...' : 'Refresh →'}
                  </button>
                </div>
              )}

              {/* AUTO-GENERATING PA */}
              {!hasPA && generating && !paError && (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <div className="animate-spin h-8 w-8 border-4 border-purple-600 border-t-transparent rounded-full"></div>
                  <p className="text-sm md:text-xs text-gray-600">Building your Power Analysis...</p>
                </div>
              )}

              {paError && (
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

              {/* PREPARE — like research, takes over the working surface. */}
              {currentStep === 'prepare' && (
                <PrepareStepContent
                  jobCard={jobCard}
                  powerAnalysisId={powerAnalysis?.id}
                  candidateName={userProfile?.display_name}
                  stories={stories}
                />
              )}

              {/* PRACTICE — session history and live progress. */}
              {currentStep === 'practice' && (
                <PracticeLeftPanel
                  sessionState={practiceShape.state}
                  sessionData={practiceShape}
                  completionData={practiceShape.completion}
                  pastSessions={pastPracticeSessions}
                  jobTitle={jobCard.title}
                  jobCompany={jobCard.company}
                  onSelectSession={(s) => setReviewSessionId(s.id)}
                  onStartNew={() => {
                    setReviewSessionId(null);
                    setPracticeShape({ state: 'idle', session: null, questions: [], currentIndex: 0, completion: null });
                  }}
                />
              )}

              {/* BUCKETS */}
              {hasPA && currentStep !== 'research' && currentStep !== 'prepare' && currentStep !== 'practice' && (() => {
                // 'practice' falls through to 'normal' — the buckets stay
                // browsable there, they just aren't driving the step. 'research'
                // and 'prepare' never reach this, since they render instead of
                // the buckets.
                const leftColMode = currentStep === 'analyze' ? 'readonly'
                  : (currentStep === 'coach' && !activeStory) ? 'coach'
                  : 'normal';
                return (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-3">
                    <BucketColumn
                      title="Core Power"
                      icon="✅"
                      colorClass="green"
                      items={powerAnalysis.core_power}
                      itemType="core_power"
                      emptyText="No core matches surfaced. Consider tailoring your resume."
                      getTextField={(item) => item.evidence}
                      getNameField={(item) => item.skill}
                      isItemCoached={isItemCoached}
                      onItemClick={handleItemClick}
                      mode={leftColMode}
                      batchChecks={batchChecks}
                      setBatchChecks={setBatchChecks}
                    />

                    <BucketColumn
                      title="Hidden Power"
                      icon="💡"
                      colorClass="yellow"
                      items={powerAnalysis.hidden_power}
                      itemType="hidden_power"
                      emptyText="No hidden transferable skills surfaced."
                      getTextField={(item) => item.evidence_reframe}
                      getNameField={(item) => item.skill}
                      getSourceField={(item) => item.source}
                      isItemCoached={isItemCoached}
                      onItemClick={handleItemClick}
                      mode={leftColMode}
                      batchChecks={batchChecks}
                      setBatchChecks={setBatchChecks}
                    />

                    <BucketColumn
                      title="Power Gaps"
                      icon="⚠️"
                      colorClass="red"
                      items={powerAnalysis.power_gaps}
                      itemType="power_gap"
                      emptyText="No major gaps. You're well positioned for this role."
                      getTextField={(item) => item.bridge_strategy}
                      getNameField={(item) => item.gap}
                      getSeverityField={(item) => item.severity}
                      isItemCoached={isItemCoached}
                      onItemClick={handleItemClick}
                      mode={leftColMode}
                      batchChecks={batchChecks}
                      setBatchChecks={setBatchChecks}
                    />
                  </div>
                );
              })()}
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
                    width: `${(Object.values(completeByKey).filter(Boolean).length / 4) * 100}%`,
                    background: 'linear-gradient(to right, #667eea, #764ba2)'
                  }}></div>
                </div>
                <div className="relative flex justify-between">
                  {[
                    { label: 'Analyze', key: 'analyze' },
                    { label: 'Coach', key: 'coach' },
                    { label: 'Research', key: 'research' },
                    { label: 'Prepare', key: 'prepare' },
                    { label: 'Practice', key: 'practice' }
                  ].map(({ label, key }, i) => {
                    const complete = completeByKey[key];
                    const current = key === currentStep;
                    // Only finished steps are clickable, and only to go back to
                    // them. A grey dot is a step they haven't reached, so it
                    // does nothing: the first pass runs on the panel buttons.
                    const clickable = complete && !current;
                    const onStepClick = () => {
                      if (!clickable) return;
                      if (key === 'coach') handleOpenCoachStep();
                      goToStep(key);
                    };
                    return (
                      <div
                        key={key}
                        className={`flex flex-col items-center ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
                        onClick={onStepClick}
                      >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold z-10 ${
                          complete || current ? 'text-white' : 'bg-white border-2 border-gray-200 text-gray-300'
                        }`} style={(complete || current) ? { background: 'linear-gradient(to bottom right, #667eea, #764ba2)' } : {}}>
                          {complete ? '✓' : current ? '●' : i + 1}
                        </div>
                        <span className={`text-xs md:text-[10px] mt-1 ${
                          current ? 'text-purple-600 font-semibold' :
                          complete ? 'text-purple-600' : 'text-gray-400'
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
                  onGoToCoach={handleOpenCoachStep}
                />
              )}

              {currentStep === 'coach' && !activeStory && !coachStarting && hasPA && (
                <CoachIdlePanel
                  storiesCoached={stories.filter(s => s.coachingComplete).length}
                  onStart={handleStartBatch}
                  onGoToResearch={goToResearchFromCoach}
                  onBack={() => goToStep('analyze')}
                />
              )}

              {currentStep === 'coach' && !activeStory && !hasPA && (
                <AnalyzeStepContent stepHeader="✨ Craft Your Answers" onGoToCoach={handleOpenCoachStep} />
              )}

              {currentStep === 'coach' && (activeStory || coachStarting) && (
                <CoachingView
                  activeStory={activeStory}
                  coachingMessages={coachingMessages}
                  completedStoryCount={stories.filter(s => s.coachingComplete).length}
                  coachInput={coachInput}
                  setCoachInput={setCoachInput}
                  coachSending={coachSending}
                  coachStarting={coachStarting}
                  coachError={coachError}
                  batchQueue={batchQueue}
                  batchPosition={batchPosition}
                  batchJustCompleted={batchJustCompleted}
                  onSend={handleSendCoachMessage}
                  onEnd={handleEndCoaching}
                  onGoToPractice={handleGoToPractice}
                  onAdvanceBatch={handleAdvanceBatch}
                  messagesEndRef={messagesEndRef}
                  coachInputRef={coachInputRef}
                />
              )}

              {currentStep === 'research' && (
                <ResearchIdlePanel
                  onGoToPrepare={() => goToStep('prepare')}
                  onBack={() => goToStep('coach')}
                />
              )}

              {currentStep === 'prepare' && (
                <PrepareIdlePanel
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
                  interviewerQuestions={interviewerQuestions}
                  reviewSessionId={reviewSessionId}
                  onBack={() => goToStep('prepare')}
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
      <StoryModal story={viewingStory} onClose={() => setViewingStory(null)} />
    </div>
  );
}

// ============================================================================
// LABEL HELPERS
// ============================================================================

function bucketLabel(itemType) {
  if (itemType === 'core_power') return 'Core Power';
  if (itemType === 'hidden_power') return 'Hidden Power';
  return 'Power Gap';
}

function itemLabel(itemType, itemIndex, skillName) {
  return `${bucketLabel(itemType)} #${itemIndex + 1}: ${skillName}`;
}

// ============================================================================
// BUCKET COLUMN
// ============================================================================

function BucketColumn({
  title, icon, colorClass, items, itemType, emptyText,
  getTextField, getNameField, getSourceField, getSeverityField,
  isItemCoached, onItemClick,
  mode = 'normal', batchChecks = {}, setBatchChecks = () => {}
}) {
  const colors = {
    green: { border: 'border-green-200', bg: 'bg-green-50', titleText: 'text-green-800', countText: 'text-green-700', emptyText: 'text-green-700' },
    yellow: { border: 'border-yellow-200', bg: 'bg-yellow-50', titleText: 'text-yellow-800', countText: 'text-yellow-700', emptyText: 'text-yellow-800' },
    red: { border: 'border-red-200', bg: 'bg-red-50', titleText: 'text-red-800', countText: 'text-red-700', emptyText: 'text-red-800' }
  };
  const c = colors[colorClass];

  const uncoachedKeys = items
    .map((_, i) => `${itemType}:${i}`)
    .filter((_, i) => !isItemCoached(itemType, i));
  const allUncoachedSelected = uncoachedKeys.length > 0 && uncoachedKeys.every(k => batchChecks[k]);

  function handleBucketToggleAll() {
    const updates = {};
    uncoachedKeys.forEach(k => { updates[k] = !allUncoachedSelected; });
    setBatchChecks(prev => ({ ...prev, ...updates }));
  }

  return (
    <div className={`border ${c.border} rounded-lg p-3 ${c.bg}`}>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-base">{icon}</span>
        <h4 className={`text-sm md:text-xs font-bold ${c.titleText}`}>{title}</h4>
        <div className="ml-auto flex items-center gap-2">
          <span className={`text-xs md:text-[10px] ${c.countText} font-semibold`}>{items.length}</span>
          {mode === 'coach' && uncoachedKeys.length > 0 && (
            <button
              onClick={handleBucketToggleAll}
              className="text-xs md:text-[10px] text-purple-600 hover:text-purple-700 font-semibold"
            >
              {allUncoachedSelected ? 'Deselect all' : 'Select all'}
            </button>
          )}
        </div>
      </div>
      {items.length === 0 ? (
        <p className={`text-sm md:text-xs ${c.emptyText} italic`}>{emptyText}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item, i) => {
            const coached = isItemCoached(itemType, i);
            const itemName = getNameField(item);
            const checkKey = `${itemType}:${i}`;
            const checked = !!batchChecks[checkKey];

            if (mode === 'readonly') {
              return (
                <li key={i}>
                  <div
                    className="w-full text-left bg-white rounded p-2 border block"
                    style={{ borderColor: coached ? '#bbf7d0' : '#e5e7eb', cursor: 'default' }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm md:text-xs font-bold text-gray-900 flex-1">#{i + 1}: {itemName}</p>
                      {coached && (
                        <span className="text-xs md:text-[9px] bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded uppercase tracking-wide flex-shrink-0 whitespace-nowrap">
                          ✓ Story
                        </span>
                      )}
                    </div>
                    {getTextField(item) && (
                      <p className="text-sm md:text-xs text-gray-700 leading-snug">{getTextField(item)}</p>
                    )}
                    {getSourceField && getSourceField(item) && (
                      <p className="text-xs md:text-[9px] text-gray-400 mt-1 italic">{getSourceField(item)}</p>
                    )}
                  </div>
                </li>
              );
            }

            if (mode === 'coach') {
              if (coached) {
                return (
                  <li key={i}>
                    <button
                      onClick={() => onItemClick(itemType, i, itemName)}
                      className="w-full text-left bg-white rounded p-2 border hover:border-purple-300 hover:shadow-sm transition-all cursor-pointer block"
                      style={{ borderColor: '#bbf7d0' }}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-sm md:text-xs font-bold text-gray-900 flex-1">#{i + 1}: {itemName}</p>
                        <span className="text-xs md:text-[9px] bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded uppercase tracking-wide flex-shrink-0 whitespace-nowrap">
                          ✓ Story
                        </span>
                      </div>
                      {getTextField(item) && (
                        <p className="text-sm md:text-xs text-gray-700 leading-snug">{getTextField(item)}</p>
                      )}
                      {getSourceField && getSourceField(item) && (
                        <p className="text-xs md:text-[9px] text-gray-400 mt-1 italic">{getSourceField(item)}</p>
                      )}
                    </button>
                  </li>
                );
              }
              return (
                <li key={i}>
                  <button
                    onClick={() => setBatchChecks(prev => ({ ...prev, [checkKey]: !prev[checkKey] }))}
                    className="w-full text-left bg-white rounded p-2 border hover:border-purple-300 hover:shadow-sm transition-all cursor-pointer block"
                    style={{ borderColor: checked ? '#a78bfa' : '#ffffff' }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm md:text-xs font-bold text-gray-900 flex-1">#{i + 1}: {itemName}</p>
                      <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${
                        checked ? 'bg-purple-600 border-purple-600' : 'border-gray-300 bg-white'
                      }`}>
                        {checked && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                    {getTextField(item) && (
                      <p className="text-sm md:text-xs text-gray-700 leading-snug">{getTextField(item)}</p>
                    )}
                    {getSourceField && getSourceField(item) && (
                      <p className="text-xs md:text-[9px] text-gray-400 mt-1 italic">{getSourceField(item)}</p>
                    )}
                  </button>
                </li>
              );
            }

            // mode === 'normal'
            return (
              <li key={i}>
                <button
                  onClick={() => onItemClick(itemType, i, itemName)}
                  className="w-full text-left bg-white rounded p-2 border hover:border-purple-300 hover:shadow-sm transition-all cursor-pointer block"
                  style={{ borderColor: coached ? '#bbf7d0' : '#ffffff' }}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm md:text-xs font-bold text-gray-900 flex-1">#{i + 1}: {itemName}</p>
                    {coached && (
                      <span className="text-xs md:text-[9px] bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded uppercase tracking-wide flex-shrink-0 whitespace-nowrap">
                        ✓ Story
                      </span>
                    )}
                  </div>
                  {getTextField(item) && (
                    <p className="text-sm md:text-xs text-gray-700 leading-snug">{getTextField(item)}</p>
                  )}
                  {getSourceField && getSourceField(item) && (
                    <p className="text-xs md:text-[9px] text-gray-400 mt-1 italic">{getSourceField(item)}</p>
                  )}
                </button>
              </li>
            );
          })}
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
const STEP_SECONDARY_CLASS = `${STEP_BUTTON_BASE} bg-white border border-purple-300 text-purple-600 transition-colors hover:bg-purple-50`;

function BackLink({ onClick }) {
  return (
    <div className="text-center">
      <button onClick={onClick} className="text-sm md:text-xs text-gray-400 hover:text-gray-600">
        ← Back
      </button>
    </div>
  );
}

function AnalyzeStepContent({ onGoToCoach, stepHeader }) {
  return (
    <div className="px-5 py-4 space-y-3 flex-1 flex flex-col">
      <h3 className="font-semibold text-lg -mt-3">{stepHeader}</h3>
      <p className="text-sm md:text-xs text-gray-600 leading-relaxed">
        Your Power Analysis identifies three categories to help you prepare for this interview:
      </p>
      <ul className="space-y-2">
        <li className="flex items-start gap-2">
          <span className="text-sm flex-shrink-0 leading-none mt-0.5">✅</span>
          <p className="text-sm md:text-xs text-gray-600 leading-relaxed">
            <span className="font-bold text-green-800">Core Power:</span> items to lead with
          </p>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-sm flex-shrink-0 leading-none mt-0.5">💡</span>
          <p className="text-sm md:text-xs text-gray-600 leading-relaxed">
            <span className="font-bold text-yellow-800">Hidden Power:</span> items to reframe
          </p>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-sm flex-shrink-0 leading-none mt-0.5">⚠️</span>
          <p className="text-sm md:text-xs text-gray-600 leading-relaxed">
            <span className="font-bold text-red-800">Power Gaps:</span> items to address proactively
          </p>
        </li>
      </ul>
      <p className="text-sm md:text-xs text-gray-600 leading-relaxed">
        For each item, you can build a polished <span className="font-bold text-gray-800">STAR story</span> (Situation, Task, Action, Result) through a quick coaching conversation so you walk into your interview with a strong answer ready when the question comes up.
      </p>
      <p className="text-sm md:text-xs text-gray-500 leading-relaxed">
        Click below to build your STAR stories.
      </p>
      {/* First step, so no back link. Completion lives in the strip's purple
          check; a second green badge saying the same thing only competed with
          it. */}
      <button
        onClick={onGoToCoach}
        className={`mx-auto ${STEP_PRIMARY_CLASS}`}
        style={STEP_PRIMARY_STYLE}
      >
        Go to Coaching
      </button>
    </div>
  );
}

// ============================================================================
// BATCH CHECKLIST
// ============================================================================

function CoachIdlePanel({ storiesCoached, onStart, onGoToResearch, onBack }) {
  const hasCoachedStories = storiesCoached > 0;

  return (
    <div className="px-5 py-4 space-y-3 flex-1 flex flex-col">
      <h3 className="font-semibold text-lg -mt-3">✨ Prepare Your Answers</h3>
      <p className="text-sm md:text-xs text-gray-600">
        Building your STAR stories means walking into your interview with real, specific answers prepared and ready to go.
      </p>
      <ul className="space-y-2">
        <li className="flex items-start gap-2">
          <span className="text-sm flex-shrink-0 leading-none mt-0.5">💬</span>
          <p className="text-sm md:text-xs text-gray-600 leading-snug">Coach just 1-2 stories, or develop them all.</p>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-sm flex-shrink-0 leading-none mt-0.5">⏱️</span>
          <p className="text-sm md:text-xs text-gray-600 leading-snug">Coaching runs 4-5 minutes per story.</p>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-sm flex-shrink-0 leading-none mt-0.5">📄</span>
          <p className="text-sm md:text-xs text-gray-600 leading-snug">Download stories as a PDF to help in your practice interviews (and the real one!)</p>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-sm flex-shrink-0 leading-none mt-0.5">⏭️</span>
          <p className="text-sm md:text-xs text-gray-600 leading-snug">Don't want coaching? Skip to interview practice at any time.</p>
        </li>
      </ul>
      <p className="text-sm md:text-xs text-gray-600">
        Pick individual items to coach, or select all to coach everything one at a time.
      </p>
      {/* Whichever action is the sensible next one is the primary. With nothing
          coached that's coaching; once a story exists, moving on is. Both stay
          visible either way — the choice is the candidate's. */}
      {/* Follows the copy on the parent's space-y-3, the way Analyze does,
          rather than mt-auto pushing it to the bottom of a short panel. */}
      {/* Coach Stories stays on the left and Go to Research on the right, so
          the pair doesn't reorder under the cursor. Only the styling swaps:
          whichever is the sensible next move wears the gradient. */}
      <div className="space-y-2">
        <div className="flex gap-2 justify-center">
          <button
            onClick={onStart}
            className={hasCoachedStories ? STEP_SECONDARY_CLASS : STEP_PRIMARY_CLASS}
            style={hasCoachedStories ? undefined : STEP_PRIMARY_STYLE}
          >
            Coach Stories
          </button>

          <button
            onClick={onGoToResearch}
            className={hasCoachedStories ? STEP_PRIMARY_CLASS : STEP_SECONDARY_CLASS}
            style={hasCoachedStories ? STEP_PRIMARY_STYLE : undefined}
          >
            Go to Research
          </button>
        </div>

        <BackLink onClick={onBack} />
      </div>
    </div>
  );
}

function ChecklistGroup({ title, itemType, items, getNameField, batchChecks, isItemCoached, onToggle, onSelectAll }) {
  if (items.length === 0) return null;
  const allCoached = items.every((_, i) => isItemCoached(itemType, i));
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs md:text-[10px] font-bold text-gray-700 uppercase tracking-wide">{title}</p>
        {!allCoached && (
          <button onClick={onSelectAll} className="text-xs md:text-[10px] text-purple-600 hover:text-purple-700 font-semibold">
            Select all
          </button>
        )}
      </div>
      <div className="space-y-1">
        {items.map((item, i) => {
          const coached = isItemCoached(itemType, i);
          const key = `${itemType}:${i}`;
          const checked = !!batchChecks[key];
          return (
            <button
              key={i}
              onClick={() => !coached && onToggle(itemType, i)}
              disabled={coached}
              className={`w-full text-left flex items-start gap-2 p-1.5 rounded transition-colors ${
                coached ? 'opacity-50 cursor-not-allowed' : 'hover:bg-purple-50 cursor-pointer'
              }`}
            >
              <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border mt-0.5 transition-colors ${
                coached ? 'bg-green-100 border-green-300' :
                checked ? 'bg-purple-600 border-purple-600' :
                'border-gray-300 bg-white'
              }`}>
                {coached && <svg className="w-2.5 h-2.5 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                {checked && !coached && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
              </div>
              <span className="text-sm md:text-xs text-gray-700 leading-tight">{itemLabel(itemType, i, getNameField(item))}{coached && <span className="text-[9px] text-green-600 ml-1">(coached)</span>}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// RESEARCH STEP CONTENT
// Pulls a company brief from /api/interview/company-research. Research is
// generated once per company and cached server-side, so there's no refresh
// control here — the step just reads whatever the brief says.
// ============================================================================

// Platform status colors, same triad the Job Tracker score rings use.
const DOT_GREEN = '#81c784';
const DOT_AMBER = '#ffc870';
const DOT_PURPLE = '#9333ea';
// Headings on the tinted overview card — purple on purple loses contrast.
const HEADING_DARK = '#111827';

// Culture values and question types read as the same kind of thing, so they
// share one definition rather than two that can drift apart.
const TAG_GREY = 'text-sm md:text-xs bg-gray-100 text-gray-600';

const TAG_VARIANTS = {
  culture: TAG_GREY,
  question: TAG_GREY,
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
// No border — the shadow against the gray page is what makes it a card.
function ResearchCard({ title, color, isEmpty, emptyText = 'No information available.', headerRight, children }) {
  return (
    <div className="bg-white shadow-sm rounded-lg p-4">
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

  // Left rule matches the callout treatment in the right-hand panel.
  return (
    <div className="border-l-4 border-purple-500 pl-3">
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
// The research step and the prepare step both need the brief, and the research
// step unmounts on the way to prepare, taking its state with it. Rather than
// lift the state to the page, both call this: the route serves the second call
// from its cache, so there is no second search and no second bill.
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
          of an undisclosed client. Your Power Analysis and coaching are based on the job
          description, so you&apos;re still well prepared.
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
          {/* Bold headline then one sentence, in the same label-dash-body shape
              the right-hand panel uses. The date is dropped: headlines almost
              always carry the timeframe already. */}
          <ResearchCard title="📰 Recent News" color={DOT_PURPLE} isEmpty={news.length === 0}>
            <ul className="space-y-2">
              {news.map((item, i) => (
                <li key={i} className="text-sm md:text-xs text-gray-700 leading-snug flex items-start gap-2">
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5"
                    style={{ backgroundColor: DOT_PURPLE }}
                  />
                  <span>
                    <strong className="text-gray-900">{item.headline}</strong>
                    {item.summary && <> — {item.summary}</>}
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

function ResearchIdlePanel({ onGoToPrepare, onBack }) {
  return (
    <div className="px-5 py-4 flex-1 flex flex-col">
      <div className="space-y-2">
        <h3 className="font-semibold text-lg -mt-3">🔍 Company Research</h3>

        <p className="text-sm md:text-xs text-gray-700">
          Get to know the company before your interview so that you can ask thoughtful questions.
        </p>

        <div className="bg-purple-50 border-l-4 border-purple-500 p-3 rounded">
          <div className="text-sm md:text-xs text-purple-900 space-y-2">
            <div><strong>🏢 Company overview</strong></div>
            <div><strong>📰 Recent news</strong></div>
            <div><strong>🧭 Culture and values</strong></div>
            <div><strong>✅ What people like</strong></div>
            <div><strong>⚠️ Common complaints</strong></div>
            <div><strong>🎯 Interview format</strong></div>
            <div><strong>💬 Question types</strong></div>
          </div>
        </div>
      </div>

      {/* CTA */}
      {/* Explicit margins rather than space-y, so the gap under the button can
          be tightened without also tightening the one above it. */}
      <div className="mt-auto pt-3 border-t border-gray-300">
        <div className="text-center mb-3">
          <h4 className="font-semibold text-gray-900 mb-1 text-base md:text-sm">
            You’re ready.
          </h4>
          <p className="text-sm md:text-xs text-gray-600 leading-snug">
            Keep what you learned in mind as you practice.
          </p>
        </div>
        <button onClick={onGoToPrepare} className={`mx-auto ${STEP_PRIMARY_CLASS}`} style={STEP_PRIMARY_STYLE}>
          Go to Prepare
        </button>
        <div className="mt-1.5">
          <BackLink onClick={onBack} />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PREPARE STEP CONTENT
// The last stop before practice: everything the candidate carries into the
// room. Kit on top, questions in the middle, a glance-able review underneath.
// ============================================================================

// Long prose fields are written as paragraphs. The highlights list wants one
// line each, so take the opening sentence and leave the rest.
function firstSentence(text) {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^.*?[.!?](\s|$)/);
  return (match ? match[0] : trimmed).trim();
}

// A story has no title of its own, so the opening line of the polished story
// stands in for one. Falls back through the raw STAR fields, then to the skill.
function storyTitle(story) {
  return (
    firstSentence(story.polishedStory) ||
    firstSentence(story.starSituation) ||
    story.itemSkill ||
    'Untitled story'
  );
}

// The kit checklist. Order is the order they print in.
const KIT_ITEMS = [
  { key: 'jobDescription', label: 'Job Description' },
  { key: 'questions', label: 'Questions for Interviewer' },
  { key: 'stories', label: 'STAR Stories' },
  { key: 'highlights', label: 'Company Highlights' }
];

function KitCheckbox({ checked, onChange, label, labelClass }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={onChange} className="accent-purple-600" />
      <span className={labelClass}>{label}</span>
    </label>
  );
}

function PrepareStepContent({ jobCard, powerAnalysisId, candidateName, stories }) {
  const supabase = createClient();
  const { research, researchSettled } = useCompanyResearch(jobCard);
  const [questions, setQuestions] = useState([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionsError, setQuestionsError] = useState(null);
  const [selected, setSelected] = useState({});
  const [buildingPdf, setBuildingPdf] = useState(false);
  const [pdfError, setPdfError] = useState(null);

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

    // Waits on research so the brief rides along in the same request. Settling
    // covers not-found and recruiter too, so a company we know nothing about
    // still gets questions.
    if (!researchSettled || !powerAnalysisId || !jobCard?.id) return;

    loadQuestions();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [researchSettled, powerAnalysisId, jobCard?.id]);

  const coachedStories = stories.filter(s => s.coachingComplete);

  const highlights = [
    firstSentence(research?.what_they_do),
    research?.size_and_location,
    firstSentence(research?.hiring_context),
    research?.culture_signals?.values?.[0]
  ].filter(Boolean).slice(0, 4);

  const checkedCount = KIT_ITEMS.filter(item => selected[item.key]).length;
  const allChecked = checkedCount === KIT_ITEMS.length;

  const toggleAll = () => {
    // Partial selections resolve to all-on, so the box is never a dead click.
    const next = !allChecked;
    setSelected(Object.fromEntries(KIT_ITEMS.map(item => [item.key, next])));
  };

  const toggleItem = (key) => {
    setSelected(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // @react-pdf/renderer and the template are imported on click, not at module
  // load: the renderer is well over a megabyte and nobody who never prints
  // should pay for it in the page bundle.
  const downloadKit = async () => {
    setBuildingPdf(true);
    try {
      const [{ pdf }, { default: InterviewKitPDF }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('../../templates/pdf/InterviewKitPDF')
      ]);

      const blob = await pdf(
        <InterviewKitPDF
          selected={selected}
          jobCard={jobCard}
          candidateName={candidateName}
          storyTitleFor={storyTitle}
          coachedStories={coachedStories}
          highlights={highlights}
          questions={questions}
          generatedOn={new Date().toLocaleDateString(undefined, {
            month: 'long', day: 'numeric', year: 'numeric'
          })}
        />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Interview Kit - ${jobCard?.title || 'Role'} at ${jobCard?.company || 'Company'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      // Revoking immediately can cancel the download in Safari, so give the
      // click a beat to start.
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      console.error('Interview kit PDF failed:', err);
      setPdfError("Couldn't build your interview kit PDF. Please try again.");
    } finally {
      setBuildingPdf(false);
    }
  };

  // No padding of its own — the left column already pads and gaps its children.
  return (
    <div className="space-y-3">

      {/* SECTION 1 — QUESTIONS TO ASK */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
        <CardHeading color={DOT_PURPLE}>💡 Questions To Ask Your Interviewer</CardHeading>

        <p className="text-sm md:text-xs text-gray-600 leading-snug mb-2">
          Most candidates don&apos;t ask anything memorable. These are tailored to this role and
          this company to help you stand out.
        </p>

        {(questionsLoading || !researchSettled) && (
          <div className="flex items-center gap-2 text-sm md:text-xs text-gray-500">
            <div className="animate-spin h-3.5 w-3.5 border-2 border-purple-600 border-t-transparent rounded-full"></div>
            <span>Picking your questions...</span>
          </div>
        )}

        {/* No retry: the questions are a nice-to-have on a step the candidate
            can finish without them. */}
        {!questionsLoading && researchSettled && questionsError && (
          <p className="text-sm md:text-xs text-gray-600">{questionsError}</p>
        )}

        {!questionsLoading && researchSettled && !questionsError && questions.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {questions.map((q, i) => (
              <div key={q.id || i} className="bg-white border border-purple-100 rounded-lg p-2.5">
                <p className="text-xs font-semibold text-gray-900 leading-snug">{q.tailored_text}</p>
                {q.rationale && (
                  <p className="text-xs text-gray-500 italic leading-snug mt-1">{q.rationale}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {!questionsLoading && researchSettled && !questionsError && questions.length === 0 && (
          <p className="text-sm md:text-xs text-gray-400">No questions available.</p>
        )}
      </div>

      {/* SECTION 2 — INTERVIEW TOOLKIT */}
      <div className="bg-white shadow-sm rounded-lg p-3">
        <CardHeading color={DOT_PURPLE}>📋 Interview Toolkit</CardHeading>

        <p className="text-sm md:text-xs text-gray-600 leading-snug mb-2">
          Everything you&apos;ve worked on, ready to go. Check any or all to print as a reference
          for your practice.
        </p>

        {/* One row, wrapping on narrow screens. Select All is rules off from
            the items rather than stacked above them. */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="border-r border-gray-200 pr-3 mr-1">
            <KitCheckbox
              checked={allChecked}
              onChange={toggleAll}
              label="Select All"
              labelClass="text-sm md:text-xs font-semibold text-gray-900"
            />
          </div>

          {KIT_ITEMS.map(item => (
            <KitCheckbox
              key={item.key}
              checked={!!selected[item.key]}
              onChange={() => toggleItem(item.key)}
              label={item.label}
              labelClass="text-sm md:text-xs text-gray-700 whitespace-nowrap"
            />
          ))}

          {/* Last item in the same row rather than a line of its own, sitting
              directly after the final checkbox instead of being pushed to the
              far edge. */}
          <button
            type="button"
            onClick={downloadKit}
            disabled={checkedCount === 0 || buildingPdf}
            className={`text-white rounded-lg py-1.5 px-5 text-sm md:text-xs font-semibold flex items-center gap-2 ${
              checkedCount === 0 || buildingPdf ? 'opacity-50 cursor-not-allowed' : 'transition-opacity hover:opacity-90'
            }`}
            style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
          >
            {buildingPdf && (
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-r-transparent"></div>
            )}
            {buildingPdf ? 'Building...' : 'Print'}
          </button>
        </div>

        {pdfError && (
          <p className="text-sm md:text-xs text-gray-600 mt-2">{pdfError}</p>
        )}
      </div>

    </div>
  );
}

// ============================================================================
// PREPARE IDLE PANEL
// Right-column step driver for the prepare step.
// ============================================================================

function PrepareIdlePanel({ onGoToPractice, onBack }) {
  return (
    <div className="px-5 py-4 flex-1 flex flex-col">
      <div className="space-y-2">
        <h3 className="font-semibold text-lg -mt-3">🎤 You&apos;re Almost Ready</h3>

        <p className="text-sm md:text-xs text-gray-700">
          Everything you need for your interview is here. Review your questions, grab your
          documents, and walk in prepared.
        </p>

        <div className="bg-purple-50 border-l-4 border-purple-500 p-3 rounded">
          <div className="text-sm md:text-xs text-purple-900 space-y-2">
            <div><strong>📋 Interview Kit</strong>: Your resume, job description, and questions in one place.</div>
            <div><strong>🎤 Your Questions</strong>: Pick 2 or 3 that feel natural. Practice saying them out loud.</div>
            <div><strong>⭐ Quick Review</strong>: Your coached stories and company highlights at a glance.</div>
          </div>
        </div>
      </div>

      {/* CTA. Sits under the copy rather than at the bottom of the column:
          this panel is short, and mt-auto left a lane of empty space. */}
      <div className="mt-3 pt-3 border-t border-gray-300">
        <button onClick={onGoToPractice} className={`mx-auto ${STEP_PRIMARY_CLASS}`} style={STEP_PRIMARY_STYLE}>
          Go to Practice
        </button>
        <div className="mt-1.5">
          <BackLink onClick={onBack} />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// COACHING VIEW
// ============================================================================

function CoachingView({
  activeStory, coachingMessages, completedStoryCount, coachInput, setCoachInput,
  coachSending, coachStarting, coachError,
  batchQueue, batchPosition, batchJustCompleted,
  onSend, onEnd, onGoToPractice, onAdvanceBatch, messagesEndRef, coachInputRef
}) {
  const isBatch = batchQueue.length > 0;
  const practiceIsPrimary = completedStoryCount >= 5;
  const primaryClass = "flex-1 whitespace-nowrap text-white rounded-lg py-2 px-2 font-semibold text-sm md:text-xs transition-opacity hover:opacity-90";
  const primaryStyle = { background: 'linear-gradient(to right, #667eea, #764ba2)' };
  const secondaryClass = "flex-1 whitespace-nowrap bg-white border border-purple-300 text-purple-600 rounded-lg py-2 px-2 font-semibold text-sm md:text-xs hover:bg-purple-50 transition-colors";

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 768);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="px-4 pt-3 pb-2 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex-1">
            {isBatch && (
              <p className="text-xs md:text-[10px] text-purple-600 font-bold uppercase tracking-wide">
                Coaching {batchPosition + 1} of {batchQueue.length}
              </p>
            )}
            <p className="text-sm md:text-xs font-bold text-gray-900">
              {activeStory ? itemLabel(activeStory.itemType, activeStory.itemIndex, activeStory.itemSkill) : 'Loading...'}
            </p>
          </div>
          
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {coachStarting && (
          <div className="flex justify-center py-6">
            <div className="animate-spin h-6 w-6 border-2 border-purple-600 border-t-transparent rounded-full"></div>
          </div>
        )}

        {!coachStarting && (
          <div className="space-y-3">
            {coachingMessages.map((msg, i) => (
              <div key={i}>
                {msg.role === 'assistant' ? (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base">🎤</span>
                      <p className="text-xs md:text-[10px] font-semibold text-gray-600">Coach</p>
                    </div>
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                      <p className="text-sm md:text-xs text-gray-800 leading-snug whitespace-pre-line">{msg.content}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-end">
                    <div className="bg-gray-100 border border-gray-200 rounded-lg p-3 max-w-[85%]">
                      <p className="text-sm md:text-xs text-gray-800 leading-snug whitespace-pre-line">{msg.content}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {coachSending && (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">🎤</span>
                  <p className="text-xs md:text-[10px] font-semibold text-gray-600">Coach</p>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <div className="flex gap-1.5 items-center">
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}

        {coachError && (
          <div className="bg-red-50 border border-red-200 rounded p-2 mt-3">
            <p className="text-xs md:text-[10px] text-red-700">{coachError}</p>
          </div>
        )}
      </div>

      <div className="flex-shrink-0 border-t border-gray-100 p-3">
        {batchJustCompleted ? (
          <div className="space-y-2">
            {isBatch && batchPosition + 1 < batchQueue.length ? (
              <>
                <button
                  onClick={onAdvanceBatch}
                  className="w-full flex items-center justify-center gap-2 text-white rounded-lg py-2 px-4 font-semibold text-sm md:text-xs transition-opacity hover:opacity-90"
                  style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
                >
                  Coach Next: {itemLabel(batchQueue[batchPosition + 1].itemType, batchQueue[batchPosition + 1].itemIndex, batchQueue[batchPosition + 1].itemSkill)} →
                </button>
                <button onClick={onEnd} className="w-full text-xs md:text-[11px] text-gray-500 hover:text-gray-700">
                  Done for now
                </button>
              </>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={onEnd}
                  className={practiceIsPrimary ? secondaryClass : primaryClass}
                  style={practiceIsPrimary ? undefined : primaryStyle}
                >
                  Coach More
                </button>
                <button
                  onClick={onGoToPractice}
                  className={practiceIsPrimary ? primaryClass : secondaryClass}
                  style={practiceIsPrimary ? primaryStyle : undefined}
                >
                  Practice Interview →
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
          <div className="flex gap-2 items-end">
            <textarea
              ref={coachInputRef}
              value={coachInput}
              onChange={e => setCoachInput(e.target.value)}
              onInput={e => {
                if (isMobile) return;
                e.target.style.height = 'auto';
                const maxHeight = window.innerHeight - 310;
                const target = Math.min(e.target.scrollHeight, maxHeight);
                e.target.style.height = target + 'px';
                e.target.style.overflowY = e.target.scrollHeight > target ? 'auto' : 'hidden';
                e.target.scrollIntoView({ block: 'end', behavior: 'instant' });
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
              placeholder="Type your response..."
              disabled={coachSending || coachStarting}
              rows={2}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-base md:text-xs focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              style={
                isMobile
                  ? { height: '4.5rem', overflowY: 'auto' }
                  : { overflowY: 'hidden', maxHeight: 'calc(100vh - 310px)' }
              }
            />
            <button
              onClick={onSend}
              disabled={!coachInput.trim() || coachSending || coachStarting}
              className="flex-shrink-0 flex items-center justify-center rounded-lg transition-colors disabled:opacity-30"
              style={{
                width: '32px',
                background: coachInput.trim() && !coachSending ? 'linear-gradient(to right, #667eea, #764ba2)' : '#d1d5db',
                alignSelf: 'stretch'
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-4 h-4">
                <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
              </svg>
            </button>
          </div>
          <p className="text-[11px] text-gray-400 mt-1 text-center font-bold italic">Enter to send. Shift+Enter for a new line.</p>
          </>
        )}
        <p className="text-center text-[11px] text-gray-400 py-1 flex-shrink-0">Your coaching progress is saved automatically.</p>
      </div>
    </div>
  );
}

// ============================================================================
// STORY MODAL
// ============================================================================

function StoryModal({ story, onClose }) {
  useEffect(() => {
    if (!story) return;
    const handleKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [story, onClose]);

  if (!story) return null;

  const hasStarBreakdown = story.starSituation || story.starTask || story.starAction || story.starResult;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col"
        style={{ maxHeight: '80vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 flex-shrink-0" style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)' }}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="h-8 w-8 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-lg">📖</span>
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold text-white truncate">{itemLabel(story.itemType, story.itemIndex, story.itemSkill)}</h2>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:opacity-70 text-2xl leading-none font-light flex-shrink-0"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-4" style={{ WebkitOverflowScrolling: 'touch' }}>
          {story.polishedStory && (
            <p className="text-sm md:text-xs text-gray-800 leading-snug">{story.polishedStory}</p>
          )}
          {hasStarBreakdown && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Full STAR Breakdown</p>
              {story.starSituation && (
                <div>
                  <p className="text-xs font-bold text-purple-700 uppercase tracking-wide mb-1">Situation</p>
                  <p className="text-sm md:text-xs text-gray-800 leading-snug">{story.starSituation}</p>
                </div>
              )}
              {story.starTask && (
                <div>
                  <p className="text-xs font-bold text-purple-700 uppercase tracking-wide mb-1">Task</p>
                  <p className="text-sm md:text-xs text-gray-800 leading-snug">{story.starTask}</p>
                </div>
              )}
              {story.starAction && (
                <div>
                  <p className="text-xs font-bold text-purple-700 uppercase tracking-wide mb-1">Action</p>
                  <p className="text-sm md:text-xs text-gray-800 leading-snug">{story.starAction}</p>
                </div>
              )}
              {story.starResult && (
                <div>
                  <p className="text-xs font-bold text-purple-700 uppercase tracking-wide mb-1">Result</p>
                  <p className="text-sm md:text-xs text-gray-800 leading-snug">{story.starResult}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// INTERVIEW HEADER STRIP
// Title + instructions + interview date + coaching progress, in one row.
// Responsive: stacks vertically on mobile with date+progress side-by-side below title.
// ============================================================================

function InterviewHeaderStrip({
  storiesCoached, totalStoryItems,
  interviewDate, countdown, interviewDateIsPast, currentStep, titleOnly, company
}) {
  const hasDate = !!interviewDate;
  const dateObj = hasDate ? new Date(interviewDate) : null;
  const month = dateObj ? dateObj.toLocaleDateString(undefined, { month: 'short' }) : '';
  const day = dateObj ? dateObj.getDate() : '';
  const weekday = dateObj ? dateObj.toLocaleDateString(undefined, { weekday: 'long' }) : '';
  const shortDate = dateObj ? dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
  const progressPct = totalStoryItems > 0 ? Math.round((storiesCoached / totalStoryItems) * 100) : 0;

  const title = (
    <div className="flex-1 min-w-0">
      <h2 className="text-base md:text-lg font-bold text-gray-900 mb-1">
        {currentStep === 'analyze' && 'Power Analysis'}
        {currentStep === 'coach'   && 'STAR Story Coaching'}
        {currentStep === 'research' && (
          company
            ? <>Company Research: <span style={{ color: DOT_PURPLE }}>{company}</span></>
            : 'Company Research'
        )}
        {currentStep === 'prepare' && 'Prepare for Your Interview'}
        {currentStep === 'practice' && 'Interview Practice'}
      </h2>
      <p className="text-xs text-gray-400 leading-snug">
        {currentStep === 'analyze' && 'Interview Coach: Step 1 of 5'}
        {currentStep === 'coach'   && 'Interview Coach: Step 2 of 5'}
        {currentStep === 'research' && 'Interview Coach: Step 3 of 5'}
        {currentStep === 'prepare' && 'Interview Coach: Step 4 of 5'}
        {currentStep === 'practice' && 'Interview Coach: Step 5 of 5'}
      </p>
    </div>
  );

  // The flat steps keep the step title but drop the card, the date widget and
  // the progress bar. The coached count rides along only on the coach step,
  // where it's the number being worked on; elsewhere it's just noise beside a
  // heading about something else.
  if (titleOnly) {
    return (
      <div className="flex items-start justify-between gap-3">
        {title}
        {currentStep === 'coach' && totalStoryItems > 0 && (
          <span className="flex-shrink-0 mt-1 text-xs md:text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 rounded-full px-3 py-1 whitespace-nowrap">
            {storiesCoached} of {totalStoryItems} stories coached
          </span>
        )}
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

        {/* STORIES READY */}
        <div className="flex flex-col gap-1.5 md:items-end md:border-l md:border-gray-200 md:pl-6">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Stories Ready</p>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-gray-900" style={{ lineHeight: 1 }}>{storiesCoached}</span>
          </div>
        </div>

      </div>
    </div>
  );

  const [value, setValue] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (currentValue) {
      const d = new Date(currentValue);
      const pad = (n) => String(n).padStart(2, '0');
      setValue(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
    } else {
      setValue('');
    }
  }, [isOpen, currentValue]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={() => { if (!saving) onClose(); }}
    >
      <div
        className="bg-white rounded-xl shadow-2xl overflow-hidden"
        style={{ width: '364px' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4" style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)' }}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="h-8 w-8 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-lg">📅</span>
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold text-white">Set Interview Date</h2>
                <p className="text-purple-100 text-xs">When are you meeting them?</p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={saving}
              className="text-white hover:opacity-70 text-2xl leading-none font-light flex-shrink-0 disabled:opacity-50"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Date and time</label>
            <input
              type="datetime-local"
              value={value}
              onChange={e => setValue(e.target.value)}
              disabled={saving}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
            />
            <p className="text-[11px] text-gray-400 mt-1.5">Approximate time is fine.</p>
          </div>

          <div className="flex items-center justify-center gap-3 pt-1">
            <button
              onClick={onClose}
              disabled={saving}
              className="text-sm text-gray-500 hover:text-gray-700 font-medium px-4 py-2 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => value && onSave(value)}
              disabled={!value || saving}
              className="rounded-lg py-2 px-6 font-semibold text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
            >
              {saving && <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-r-transparent"></div>}
              {saving ? 'Saving...' : 'Save Date'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
