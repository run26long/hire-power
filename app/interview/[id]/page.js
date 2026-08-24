'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import MainNav from '../../components/MainNav';
import Breadcrumb from '../../components/Breadcrumb';
import ErrorToast from '../../components/ErrorToast';
import SuccessToast from '../../components/SuccessToast';
import UpgradeModal from '../../components/UpgradeModal';

export default function InterviewDetailPage() {
  const router = useRouter();
  const params = useParams();
  const supabase = createClient();

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

 const [errorToast, setErrorToast] = useState(null);
  const [successToast, setSuccessToast] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [interviewEvents, setInterviewEvents] = useState([]);

  const messagesEndRef = useRef(null);
  const coachInputRef = useRef(null);

  // Step completion derived from real data, not cursor position
  const analyzeComplete = !!powerAnalysis;
  const coachComplete = stories.some(s => s.coachingComplete);

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
      const savedStep = data.jobCard?.interview_step;
      if (savedStep === 'analyze' || savedStep === 'coach' || savedStep === 'research' || savedStep === 'practice') {
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
  }, [params.id, retryCount, router, supabase]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-generate Power Analysis on first landing if none exists
  useEffect(() => {
    if (!loading && jobCard && !powerAnalysis && !paError && !generating) {
      handleGeneratePA();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, powerAnalysis]);

  // Handle Jump to navigation from hub: read URL hash and route to the right phase
  useEffect(() => {
    if (loading || !hasPA) return;
    const hash = typeof window !== 'undefined' ? window.location.hash.replace('#', '') : '';
    if (!hash) return;
    if (hash === 'coaching') {
      setCurrentStep('coach');
    }
    // 'power-analysis' is the default view, no action needed
    // 'practice' is Phase 4 territory, no-op for now
    // Clear the hash so it doesn't re-trigger on re-renders
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, powerAnalysis]);

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
    const queue = [];

    powerAnalysis.core_power.forEach((item, i) => {
      const key = `core_power:${i}`;
      if (batchChecks[key] && !isItemCoached('core_power', i)) {
        queue.push({ itemType: 'core_power', itemIndex: i, itemSkill: item.skill });
      }
    });
    powerAnalysis.hidden_power.forEach((item, i) => {
      const key = `hidden_power:${i}`;
      if (batchChecks[key] && !isItemCoached('hidden_power', i)) {
        queue.push({ itemType: 'hidden_power', itemIndex: i, itemSkill: item.skill });
      }
    });
    powerAnalysis.power_gaps.forEach((item, i) => {
      const key = `power_gap:${i}`;
      if (batchChecks[key] && !isItemCoached('power_gap', i)) {
        queue.push({ itemType: 'power_gap', itemIndex: i, itemSkill: item.gap });
      }
    });

    if (queue.length === 0) {
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
    setCurrentStep('practice');
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
            {/* On the research step this drops its own white-card treatment.
                The research cards are the cards, and white-on-white would hide
                the shadow that separates them. */}
            <div className={`md:m-6 p-4 md:p-6 flex flex-col gap-4 overflow-y-auto bg-gray-100 ${
              currentStep === 'research'
                ? 'md:bg-gray-50'
                : 'md:bg-white md:rounded-lg md:shadow-sm md:border md:border-gray-200'
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

              {/* BUCKETS */}
              {hasPA && currentStep !== 'research' && (() => {
                // 'practice' falls through to 'normal' — the buckets stay
                // browsable there, they just aren't driving the step. 'research'
                // never reaches this, since it renders instead of the buckets.
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
                    width: `${(((analyzeComplete ? 1 : 0) + (coachComplete ? 1 : 0)) / 3) * 100}%`,
                    background: 'linear-gradient(to right, #667eea, #764ba2)'
                  }}></div>
                </div>
                <div className="relative flex justify-between">
                  {[
                    { label: 'Analyze', key: 'analyze' },
                    { label: 'Coach', key: 'coach' },
                    { label: 'Research', key: 'research' },
                    { label: 'Practice', key: 'practice' }
                  ].map(({ label, key }, i) => {
                    const completeByKey = { analyze: analyzeComplete, coach: coachComplete, research: false, practice: false };
                    const complete = completeByKey[key];
                    const current = key === currentStep;
                    return (
                      <div
                        key={key}
                        className="flex flex-col items-center cursor-pointer"
                        onClick={() => key === 'coach' ? handleOpenCoachStep() : setCurrentStep(key)}
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
                  analyzeComplete={analyzeComplete}
                  coachComplete={coachComplete}
                  onGoToCoach={handleOpenCoachStep}
                  onSkipToPractice={() => setCurrentStep('practice')}
                />
              )}

              {currentStep === 'coach' && !activeStory && !coachStarting && hasPA && (
                <CoachIdlePanel
                  batchChecks={batchChecks}
                  coachStarting={coachStarting}
                  coachComplete={coachComplete}
                  onStart={handleStartBatch}
                  onSkipToPractice={() => setCurrentStep('practice')}
                />
              )}

              {currentStep === 'coach' && !activeStory && !hasPA && (
                <AnalyzeStepContent stepHeader="✨ Craft Your Answers" onGoToCoach={handleOpenCoachStep} onSkipToPractice={() => setCurrentStep('practice')} />
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
                  onGoToPractice={() => setCurrentStep('practice')}
                  onGoToCoach={() => setCurrentStep('coach')}
                />
              )}

              {currentStep === 'practice' && (
                <PracticeStepContent
                  storiesCoached={stories.filter(s => s.coachingComplete).length}
                  onGoToCoach={handleOpenCoachStep}
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

function AnalyzeStepContent({ onGoToCoach, onSkipToPractice, stepHeader, analyzeComplete, coachComplete }) {
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
      {analyzeComplete && coachComplete && (
        <div className="mt-6 pt-4 border-t border-gray-100 flex justify-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full text-xs font-medium text-green-700">
            <span>✅</span>
            <span>Analysis Complete</span>
          </div>
        </div>
      )}
      <button
        onClick={onGoToCoach}
        className="w-full text-white rounded-lg py-2 px-4 font-semibold text-sm md:text-xs transition-opacity hover:opacity-90"
        style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
      >
        Coach My Stories →
      </button>
      <button
        onClick={onSkipToPractice}
        className="w-full text-xs md:text-[11px] text-gray-500 hover:text-gray-700 text-center transition-colors"
      >
        Skip to Interview Practice →
      </button>
    </div>
  );
}

// ============================================================================
// BATCH CHECKLIST
// ============================================================================

function CoachIdlePanel({ batchChecks, coachStarting, coachComplete, onStart, onSkipToPractice }) {
  const selectedCount = Object.values(batchChecks).filter(Boolean).length;

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
      <div className="mt-auto space-y-2">
        {coachComplete && (
          <div className="mt-6 pt-4 border-t border-gray-100 flex justify-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full text-xs font-medium text-green-700">
              <span>✅</span>
              <span>Coaching Complete</span>
            </div>
          </div>
        )}
        <button onClick={onStart} disabled={selectedCount === 0 || coachStarting}
          className="w-full flex items-center justify-center gap-2 text-white rounded-lg py-2 px-4 font-semibold text-sm md:text-xs transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}>
          Start Coaching ({selectedCount})
        </button>
        <button onClick={onSkipToPractice}
          className="w-full text-xs md:text-[11px] text-gray-500 hover:text-gray-700 text-center transition-colors">
          Skip to Interview Practice →
        </button>
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
// PRACTICE STEP CONTENT
// ============================================================================

function PracticeStepContent({ storiesCoached, onGoToCoach }) {
  return (
    <div className="px-5 py-4 space-y-3 flex-1 flex flex-col">
      <h3 className="font-semibold text-lg -mt-3">🎤 Practice Your Interview</h3>
      <p className="text-sm md:text-xs text-gray-600 leading-relaxed">
        Interview practice is coming soon. You'll be able to run a mock interview using your coached stories.
      </p>
      {storiesCoached > 0 ? (
        <div className="bg-green-50 border-l-4 border-green-500 p-3 rounded-r">
          <p className="text-xs text-green-800 font-medium leading-snug">
            {storiesCoached} {storiesCoached === 1 ? 'story' : 'stories'} ready for practice.
          </p>
        </div>
      ) : (
        <div className="bg-purple-50 border-l-4 border-purple-600 p-3 rounded-r">
          <p className="text-xs text-gray-700 leading-snug">Coach at least one story to prepare your answers before practice.</p>
        </div>
      )}
      <button
        onClick={onGoToCoach}
        className="border border-purple-200 text-purple-600 rounded-lg py-2 px-4 font-semibold text-sm hover:bg-purple-50 transition-colors"
      >
        ← Back to Coach
      </button>
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

function Tag({ children }) {
  return (
    <span className="inline-block text-[11px] md:text-[10px] bg-purple-50 text-purple-700 rounded px-2 py-0.5">
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
function ResearchCard({ title, color, isEmpty, emptyText = 'Nothing surfaced.', children }) {
  return (
    <div className="bg-white shadow-sm rounded-lg p-4">
      <CardHeading color={color}>{title}</CardHeading>
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

function Stat({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm md:text-xs text-gray-700 leading-snug">{value}</p>
    </div>
  );
}

const DIFFICULTY_STYLES = {
  easy: 'bg-green-50 text-green-700',
  medium: 'bg-amber-50 text-amber-700',
  hard: 'bg-red-50 text-red-700',
  unknown: 'bg-gray-100 text-gray-500'
};

function ResearchStepContent({ jobCard }) {
  const supabase = createClient();
  const [research, setResearch] = useState(null);
  const [researchLoading, setResearchLoading] = useState(false);
  const [researchError, setResearchError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadResearch() {
      setResearchLoading(true);
      setResearchError(null);
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
        if (!cancelled) setResearch(data.research);
      } catch (err) {
        console.error('Company research load failed:', err);
        if (!cancelled) {
          setResearchError("Couldn't pull company info right now. You can still practice without it.");
        }
      } finally {
        if (!cancelled) setResearchLoading(false);
      }
    }

    // No company name means nothing to research. Say so rather than firing a
    // request the route would reject.
    if (!jobCard?.company) {
      setResearchError("Couldn't pull company info right now. You can still practice without it.");
      return;
    }

    loadResearch();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobCard?.id, jobCard?.company, attempt]);

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

      {!researchLoading && researchError && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 space-y-2">
          <p className="text-xs text-gray-700 leading-snug">{researchError}</p>
          <button
            onClick={() => setAttempt(a => a + 1)}
            className="text-xs text-purple-600 hover:text-purple-700 font-semibold"
          >
            Try Again
          </button>
        </div>
      )}

      {!researchLoading && !researchError && research && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

          {/* ROW 1 — WHAT THEY DO (full width, no section heading — the copy
              is the card) */}
          <div className="md:col-span-2 bg-white shadow-sm rounded-lg p-4">
            {research.what_they_do ? (
              <p className="text-sm md:text-xs text-gray-600 leading-relaxed">{research.what_they_do}</p>
            ) : (
              <p className="text-sm md:text-xs text-gray-400">Nothing surfaced.</p>
            )}
            {(research.size_and_location || research.hiring_context) && (
              <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Stat label="Size and location" value={research.size_and_location} />
                <Stat label="What they're hiring for" value={research.hiring_context} />
              </div>
            )}
          </div>

          {/* ROW 2 — RECENT NEWS | CULTURE AND VALUES */}
          <ResearchCard title="📰 Recent News" color={DOT_PURPLE} isEmpty={news.length === 0}>
            <ul>
              {news.map((item, i) => (
                <li key={i} className={i > 0 ? 'border-t border-gray-100 pt-2 mt-2' : ''}>
                  <p className="text-sm font-semibold text-gray-900 leading-snug">{item.headline}</p>
                  {item.date && <p className="text-[10px] text-gray-400 mt-0.5">{item.date}</p>}
                  {item.summary && (
                    <p className="text-sm md:text-xs text-gray-600 leading-snug mt-1">{item.summary}</p>
                  )}
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
              <div className="flex flex-wrap gap-1">
                {culture.values.map((v, i) => <Tag key={i}>{v}</Tag>)}
              </div>
            )}
          </ResearchCard>

          {/* ROW 3 — WHAT PEOPLE LIKE | COMMON COMPLAINTS */}
          <ResearchCard
            title="✅ What People Like"
            color={DOT_GREEN}
            isEmpty={!culture?.themes_positive?.length}
          >
            <DotList items={culture?.themes_positive || []} color={DOT_GREEN} />
          </ResearchCard>

          <ResearchCard
            title="⚠️ Common Complaints"
            color={DOT_AMBER}
            isEmpty={!culture?.themes_negative?.length}
          >
            <DotList items={culture?.themes_negative || []} color={DOT_AMBER} />
          </ResearchCard>

          {/* ROW 4 — INTERVIEW FORMAT | QUESTION TYPES */}
          <ResearchCard title="🎯 Interview Format" color={DOT_AMBER} isEmpty={!style?.likely_format}>
            <div className="mb-2">
              <span className={`inline-block text-[11px] font-semibold rounded px-2 py-0.5 capitalize ${
                DIFFICULTY_STYLES[difficulty] || DIFFICULTY_STYLES.unknown
              }`}>
                {difficulty}
              </span>
            </div>
            <p className="text-sm md:text-xs text-gray-600 leading-relaxed">{style?.likely_format}</p>
          </ResearchCard>

          <ResearchCard
            title="💬 Question Types"
            color={DOT_PURPLE}
            isEmpty={!style?.known_question_types?.length}
          >
            <div className="flex flex-wrap gap-1">
              {(style?.known_question_types || []).map((q, i) => <Tag key={i}>{q}</Tag>)}
            </div>
          </ResearchCard>

          {/* ROW 5 — QUESTIONS TO ASK (full width). Tinted callout, same
              treatment Resume Coach uses for its upgrade panel. */}
          <div className="md:col-span-2 bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-purple-800 mb-2">
              Questions to ask your interviewer
            </p>
            <p className="text-sm md:text-xs text-gray-600">Interviewer questions coming soon.</p>
          </div>
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

function ResearchIdlePanel({ onGoToPractice, onGoToCoach }) {
  return (
    <div className="px-5 py-4 flex-1 flex flex-col">

      {/* What the research gave them. Eyebrow + purple dots: this is a
          navigation panel, so the color reads as brand, not as a score. */}
      <div>
        <p className="text-xs md:text-[10px] text-purple-600 font-semibold uppercase tracking-wide mb-2">
          Research Complete
        </p>
        <ul className="space-y-1">
          <li className="text-sm md:text-xs text-gray-700 flex gap-2 leading-snug">
            <span className="flex-shrink-0" style={{ color: DOT_PURPLE }}>•</span>
            <span>What the company does, how big it is, and where it sits.</span>
          </li>
          <li className="text-sm md:text-xs text-gray-700 flex gap-2 leading-snug">
            <span className="flex-shrink-0" style={{ color: DOT_PURPLE }}>•</span>
            <span>Recent news you can reference to show you did the reading.</span>
          </li>
          <li className="text-sm md:text-xs text-gray-700 flex gap-2 leading-snug">
            <span className="flex-shrink-0" style={{ color: DOT_PURPLE }}>•</span>
            <span>What their culture rewards, and what people complain about.</span>
          </li>
          <li className="text-sm md:text-xs text-gray-700 flex gap-2 leading-snug">
            <span className="flex-shrink-0" style={{ color: DOT_PURPLE }}>•</span>
            <span>The interview format and the question types to expect.</span>
          </li>
        </ul>
      </div>

      {/* CTA */}
      <div className="mt-auto pt-3 border-t border-gray-300 space-y-3">
        <div className="text-center">
          <h4 className="font-semibold text-gray-900 mb-1 text-base md:text-sm">
            You&apos;re ready to practice.
          </h4>
          <p className="text-sm md:text-xs text-gray-600 leading-snug">
            You have your research. Now put it to work. Practice answers based on what you just
            learned about this company.
          </p>
        </div>
        <button
          onClick={onGoToPractice}
          className="block mx-auto text-white rounded-lg py-2 px-8 text-sm md:text-xs font-semibold transition-opacity hover:opacity-90"
          style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
        >
          Go to Practice →
        </button>
        <div className="text-center">
          <button
            onClick={onGoToCoach}
            className="text-sm md:text-xs text-gray-400 hover:text-gray-600"
          >
            ← Back to Coach
          </button>
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
  interviewDate, countdown, interviewDateIsPast, currentStep
}) {
  const hasDate = !!interviewDate;
  const dateObj = hasDate ? new Date(interviewDate) : null;
  const month = dateObj ? dateObj.toLocaleDateString(undefined, { month: 'short' }) : '';
  const day = dateObj ? dateObj.getDate() : '';
  const weekday = dateObj ? dateObj.toLocaleDateString(undefined, { weekday: 'long' }) : '';
  const shortDate = dateObj ? dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
  const progressPct = totalStoryItems > 0 ? Math.round((storiesCoached / totalStoryItems) * 100) : 0;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 md:p-4">
      <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">

        {/* TITLE + INSTRUCTIONS */}
        <div className="flex-1 min-w-0">
          <h2 className="text-base md:text-lg font-bold text-gray-900 mb-1">
            {currentStep === 'analyze' && 'Power Analysis'}
            {currentStep === 'coach'   && 'STAR Story Coaching'}
            {currentStep === 'research' && 'Company Research'}
            {currentStep === 'practice' && 'Interview Practice'}
          </h2>
          <p className="text-xs text-gray-400 leading-snug">
            {currentStep === 'analyze' && 'Interview Coach: Step 1 of 4'}
            {currentStep === 'coach'   && 'Interview Coach: Step 2 of 4'}
            {currentStep === 'research' && 'Interview Coach: Step 3 of 4'}
            {currentStep === 'practice' && 'Interview Coach: Step 4 of 4'}
          </p>
        </div>

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