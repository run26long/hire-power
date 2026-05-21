'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import MainNav from '../../components/MainNav';
import Breadcrumb from '../../components/Breadcrumb';
import ErrorToast from '../../components/ErrorToast';
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
  const [resume, setResume] = useState(null);
  const [powerAnalysis, setPowerAnalysis] = useState(null);
  const [stories, setStories] = useState([]);

  const [generating, setGenerating] = useState(false);
  const [paError, setPaError] = useState(null);

  // Right column state machine: 'idle' | 'checklist' | 'coaching'
  const [rightColMode, setRightColMode] = useState('idle');

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
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [interviewEvents, setInterviewEvents] = useState([]);

  const messagesEndRef = useRef(null);
  const coachInputRef = useRef(null);

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

      if (data.powerAnalysis) {
        const storiesRes = await fetch(`/api/story-coach/get?jobCardId=${params.id}`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        if (storiesRes.ok) {
          const storiesData = await storiesRes.json();
          setStories(storiesData.stories || []);
        }
      } else {
        setStories([]);
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

  // Handle Jump to navigation from hub: read URL hash and route to the right phase
  useEffect(() => {
    if (loading || !hasPA) return;
    const hash = typeof window !== 'undefined' ? window.location.hash.replace('#', '') : '';
    if (!hash) return;
    if (hash === 'coaching') {
      handleOpenBatchChecklist();
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
    if (rightColMode === 'coaching' && coachingMessages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [coachingMessages, rightColMode]);

  useEffect(() => {
    if (rightColMode === 'coaching' && !coachSending && !coachStarting) {
      coachInputRef.current?.focus({ preventScroll: true });
    }
  }, [rightColMode, coachSending, coachStarting]);

  // Auto-switch mobile panel when coaching starts
  useEffect(() => {
    if (rightColMode === 'coaching' || rightColMode === 'checklist') {
      setMobilePanel('coaching');
    }
  }, [rightColMode]);

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
        setErrorToast("We couldn't analyze this job right now. Try again in a moment.");
        return;
      }

      await loadData();

    } catch (err) {
      console.error('Generate PA error:', err);
      setErrorToast("We couldn't analyze this job right now. Try again in a moment.");
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
    setRightColMode('coaching');

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
          setRightColMode('idle');
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

  const handleOpenBatchChecklist = () => {
    setBatchChecks({});
    setBatchQueue([]);
    setBatchPosition(0);
    setRightColMode('checklist');
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
      setRightColMode('idle');
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
      setRightColMode('idle');
      return;
    }
    setBatchPosition(nextPos);
    setBatchJustCompleted(null);
    const next = batchQueue[nextPos];
    openCoachingForItem(next.itemType, next.itemIndex, next.itemSkill);
  };

  const handleEndCoaching = () => {
    setRightColMode('idle');
    setActiveStory(null);
    setCoachingMessages([]);
    setCoachInput('');
    setBatchQueue([]);
    setBatchPosition(0);
    setBatchJustCompleted(null);
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
              className="text-white px-6 py-2 rounded-lg transition-opacity hover:opacity-90 font-medium"
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

  const breadcrumbItems = [
    { label: 'Interview Coach', path: '/interview-coach' },
    { label: jobCard.company ? `${jobCard.title} at ${jobCard.company}` : jobCard.title }
  ];

  const hasPA = !!powerAnalysis;
  const currentLevel = jobCard.interview_level || 0;
  const sessionsCount = jobCard.interview_sessions_count || 0;
  const countdown = formatCountdown(nextInterviewDate);
  const interviewDateIsPast = nextInterviewDate && new Date(nextInterviewDate).getTime() < now;

  let uncoachedCount = 0;
  if (powerAnalysis) {
    powerAnalysis.core_power.forEach((_, i) => { if (!isItemCoached('core_power', i)) uncoachedCount++; });
    powerAnalysis.hidden_power.forEach((_, i) => { if (!isItemCoached('hidden_power', i)) uncoachedCount++; });
    powerAnalysis.power_gaps.forEach((_, i) => { if (!isItemCoached('power_gap', i)) uncoachedCount++; });
  }

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <MainNav currentPage="my-interviews" userProfile={userProfile} />
      <div className="hidden md:block">
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

      <div className="flex-1 flex overflow-hidden" style={{ height: 'calc(100vh - 160px)' }}>
        <div className="flex-1 flex gap-3 md:gap-6 p-3 md:p-6 max-w-7xl mx-auto w-full overflow-hidden">

          {/* LEFT COLUMN — Power Analysis */}
          <div className={`flex-[3] bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col ${mobilePanel === 'analysis' ? 'flex' : 'hidden'} md:flex`}>
            <div className="p-4 md:p-6 flex flex-col gap-4 overflow-y-auto">

              {/* INTERVIEW HEADER STRIP — title + instructions + date + coaching progress */}
              {hasPA && (
                <InterviewHeaderStrip
                  storiesCoached={stories.filter(s => s.coachingComplete).length}
                  totalStoryItems={powerAnalysis.core_power.length + powerAnalysis.hidden_power.length + powerAnalysis.power_gaps.length}
                  interviewDate={nextInterviewDate}
                  countdown={countdown}
                  interviewDateIsPast={interviewDateIsPast}
                />
              )}

              {/* STALE PA WARNING — only when resume changed since analysis */}
              {hasPA && powerAnalysis.isStale && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2.5">
                  <span className="text-base flex-shrink-0 leading-none mt-0.5">⚠️</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-amber-900 leading-relaxed">
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

              {/* PA EMPTY STATE */}
              {!hasPA && !paError && (
                <div className="border border-dashed border-purple-300 rounded-lg p-4 md:p-6 bg-purple-50">
                  <p className="text-sm md:text-xs text-gray-700 mb-3 leading-relaxed">
                    Power Analysis shows you exactly what to highlight, what to reframe, and what to address in this specific interview.
                  </p>
                  <p className="text-sm md:text-xs text-gray-500 mb-4">
                    We'll analyze {resume?.resume_type === 'job_specific' ? 'your tailored resume' : 'your core resume'} against this job description in about 20 seconds.
                  </p>
                  <button
                    onClick={handleGeneratePA}
                    disabled={generating}
                    className="text-white rounded-lg py-2 px-6 font-semibold text-sm transition-opacity hover:opacity-90 disabled:opacity-70 flex items-center justify-center gap-2 mx-auto"
                    style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
                  >
                    {generating ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                        Analyzing...
                      </>
                    ) : 'Generate Power Analysis'}
                  </button>
                </div>
              )}

              {paError && (
                <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                  <div className="flex items-start gap-2">
                    <span className="text-base flex-shrink-0">⚠️</span>
                    <div className="flex-1">
                      <p className="text-sm md:text-xs text-red-800 leading-relaxed mb-3">{paError.message}</p>
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
                        <button onClick={() => setPaError(null)} className="text-sm md:text-xs text-gray-500 hover:text-gray-700">Dismiss</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* BUCKETS */}
              {hasPA && (
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
                  />
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN — Interview Preparation + Coaching */}
          <div className={`flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex-col ${mobilePanel === 'coaching' ? 'flex' : 'hidden'} md:flex`}>
            <div className="sticky top-0 bg-white z-10 p-4 pb-3 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-center font-semibold text-sm md:text-xs mb-3">Interview Preparation</h3>
              <div className="relative">
                <div className="absolute top-3 left-0 right-0 h-0.5 bg-gray-200"></div>
                <div className="relative flex justify-between">
                  {['Analyze', 'Coach', 'Practice', 'Feedback'].map((step, i) => {
                    const coachedAny = stories.some(s => s.coachingComplete);
                    const stepStates = [
                      { complete: hasPA, current: !hasPA },
                      { complete: coachedAny, current: hasPA && !coachedAny },
                      { complete: false, current: false },
                      { complete: false, current: false }
                    ];
                    const { complete, current } = stepStates[i];
                    return (
                      <div key={step} className="flex flex-col items-center">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold z-10 ${
                          complete ? 'text-white' :
                          current ? 'text-white' :
                          'bg-white border-2 border-gray-200 text-gray-300'
                        }`}
                        style={(complete || current) ? { background: 'linear-gradient(to bottom right, #667eea, #764ba2)' } : {}}>
                          {complete ? '✓' : current ? '●' : '○'}
                        </div>
                        <span className={`text-xs md:text-[10px] mt-1 ${
                          current ? 'text-purple-600 font-semibold' :
                          complete ? 'text-purple-600' :
                          'text-gray-400'
                        }`}>{step}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col">

              {rightColMode === 'idle' && (
                <IdleRightColumn
                  hasPA={hasPA}
                  isPro={isPro}
                  uncoachedCount={uncoachedCount}
                  storiesCount={stories.filter(s => s.coachingComplete).length}
                  onOpenBatch={handleOpenBatchChecklist}
                  onUpgrade={() => setShowUpgradeModal(true)}
                  onBack={() => router.push('/interview-coach')}
                />
              )}

              {rightColMode === 'checklist' && hasPA && (
                <BatchChecklist
                  powerAnalysis={powerAnalysis}
                  isItemCoached={isItemCoached}
                  batchChecks={batchChecks}
                  setBatchChecks={setBatchChecks}
                  onStart={handleStartBatch}
                  onCancel={() => setRightColMode('idle')}
                />
              )}

              {rightColMode === 'coaching' && (
                <CoachingView
                  activeStory={activeStory}
                  coachingMessages={coachingMessages}
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
                  onAdvanceBatch={handleAdvanceBatch}
                  messagesEndRef={messagesEndRef}
                  coachInputRef={coachInputRef}
                />
              )}

            </div>
          </div>

        </div>
      </div>

      <ErrorToast message={errorToast} onClose={() => setErrorToast(null)} />
      <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
      <StoryModal story={viewingStory} onClose={() => setViewingStory(null)} />
    </div>
  );
}

// ============================================================================
// BUCKET COLUMN
// ============================================================================

function BucketColumn({
  title, icon, colorClass, items, itemType, emptyText,
  getTextField, getNameField, getSourceField, getSeverityField,
  isItemCoached, onItemClick
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
        <span className={`text-xs md:text-[10px] ${c.countText} font-semibold ml-auto`}>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className={`text-sm md:text-xs ${c.emptyText} italic`}>{emptyText}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item, i) => {
            const coached = isItemCoached(itemType, i);
            const itemName = getNameField(item);

            return (
              <li key={i}>
                <button
                  onClick={() => onItemClick(itemType, i, itemName)}
                  className="w-full text-left bg-white rounded p-2 border hover:border-purple-300 hover:shadow-sm transition-all cursor-pointer block"
                  style={{ borderColor: coached ? '#bbf7d0' : '#ffffff' }}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm md:text-xs font-bold text-gray-900 flex-1">{itemName}</p>
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
// IDLE RIGHT COLUMN
// ============================================================================

function IdleRightColumn({ hasPA, isPro, uncoachedCount, storiesCount, onOpenBatch, onUpgrade, onBack }) {
  return (
    <div className="px-5 pb-5 pt-3 space-y-3 flex-1 flex flex-col">
      {!hasPA ? (
        <div className="bg-purple-50 border-l-4 border-purple-600 p-3 rounded-r">
          <p className="text-sm md:text-xs text-gray-700 leading-snug font-medium mb-1">Start with your Power Analysis.</p>
          <p className="text-sm md:text-xs text-gray-600 leading-snug">We'll surface what to highlight in this interview based on your resume.</p>
        </div>
      ) : (
        <>
          <div className="bg-purple-50 border-l-4 border-purple-600 p-3 rounded-r">
            <p className="text-sm md:text-xs text-gray-700 leading-snug font-medium mb-1">
              {storiesCount === 0
                ? "Your Power Analysis is ready."
                : `${storiesCount} ${storiesCount === 1 ? 'story' : 'stories'} saved.`}
            </p>
            <p className="text-sm md:text-xs text-gray-600 leading-snug">
              {isPro
                ? "Coach a story for each item one at a time, or use the button below to walk through several at once."
                : "Pro users coach stories and get unlimited practice. Free users practice once."}
            </p>
          </div>

          {isPro ? (
            <>
              <button
                onClick={onOpenBatch}
                disabled={uncoachedCount === 0}
                className="w-full text-white rounded-lg py-2 px-4 font-semibold text-sm transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
              >
                {uncoachedCount === 0 ? 'All Items Coached' : 'Coach Me Through This'}
              </button>
              <button
                disabled
                className="w-full border border-purple-200 text-purple-600 rounded-lg py-2 px-4 font-semibold text-sm transition-opacity disabled:opacity-60 disabled:cursor-not-allowed bg-white"
                title="Interview practice launches in the next phase"
              >
                Start Interview Practice
              </button>
            </>
          ) : (
            <button
              onClick={onUpgrade}
              className="w-full text-white rounded-lg py-2 px-4 font-semibold text-sm transition-opacity hover:opacity-90"
              style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
            >
              Unlock Coaching with Pro
            </button>
          )}

          <p className="text-xs md:text-[10px] text-gray-400 text-center italic pt-1">
            Practice launches in the next update
          </p>
        </>
      )}

      <div className="pt-2 mt-auto">
        <button
          onClick={onBack}
          className="block mx-auto border border-gray-300 text-gray-500 rounded-lg py-1.5 px-6 text-xs md:text-[11px] font-medium hover:bg-gray-50 transition-colors"
        >
          ← Back to Interview Coach
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// BATCH CHECKLIST
// ============================================================================

function BatchChecklist({ powerAnalysis, isItemCoached, batchChecks, setBatchChecks, onStart, onCancel }) {
  function toggle(itemType, itemIndex) {
    const key = `${itemType}:${itemIndex}`;
    setBatchChecks(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function selectAll(itemType, items) {
    const updates = {};
    items.forEach((_, i) => {
      if (!isItemCoached(itemType, i)) {
        updates[`${itemType}:${i}`] = true;
      }
    });
    setBatchChecks(prev => ({ ...prev, ...updates }));
  }

  const selectedCount = Object.values(batchChecks).filter(Boolean).length;

  return (
    <div className="px-4 pt-3 pb-5 flex-1 flex flex-col overflow-hidden">
      <div className="mb-3 flex-shrink-0">
        <p className="text-sm md:text-xs font-bold text-gray-800 mb-1">Coach Me Through This</p>
        <p className="text-xs md:text-[10px] text-gray-500 leading-snug">Pick the items you want to coach. We'll walk through them one at a time.</p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 mb-3">
        <ChecklistGroup
          title="Core Power"
          itemType="core_power"
          items={powerAnalysis.core_power}
          getNameField={(item) => item.skill}
          batchChecks={batchChecks}
          isItemCoached={isItemCoached}
          onToggle={toggle}
          onSelectAll={() => selectAll('core_power', powerAnalysis.core_power)}
        />
        <ChecklistGroup
          title="Hidden Power"
          itemType="hidden_power"
          items={powerAnalysis.hidden_power}
          getNameField={(item) => item.skill}
          batchChecks={batchChecks}
          isItemCoached={isItemCoached}
          onToggle={toggle}
          onSelectAll={() => selectAll('hidden_power', powerAnalysis.hidden_power)}
        />
        <ChecklistGroup
          title="Power Gaps"
          itemType="power_gap"
          items={powerAnalysis.power_gaps}
          getNameField={(item) => item.gap}
          batchChecks={batchChecks}
          isItemCoached={isItemCoached}
          onToggle={toggle}
          onSelectAll={() => selectAll('power_gap', powerAnalysis.power_gaps)}
        />
      </div>

      <div className="flex-shrink-0 space-y-2">
        <button
          onClick={onStart}
          disabled={selectedCount === 0}
          className="w-full text-white rounded-lg py-2 px-4 font-semibold text-sm transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
        >
          Start Coaching ({selectedCount})
        </button>
        <button
          onClick={onCancel}
          className="w-full text-xs md:text-[11px] text-gray-500 hover:text-gray-700"
        >
          Cancel
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
              <span className="text-sm md:text-xs text-gray-700 leading-tight">{getNameField(item)}{coached && <span className="text-[9px] text-green-600 ml-1">(coached)</span>}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// COACHING VIEW
// ============================================================================

function CoachingView({
  activeStory, coachingMessages, coachInput, setCoachInput,
  coachSending, coachStarting, coachError,
  batchQueue, batchPosition, batchJustCompleted,
  onSend, onEnd, onAdvanceBatch, messagesEndRef, coachInputRef
}) {
  const isBatch = batchQueue.length > 0;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="px-4 pt-3 pb-2 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex-1 min-w-0">
            {isBatch && (
              <p className="text-xs md:text-[10px] text-purple-600 font-bold uppercase tracking-wide">
                Coaching {batchPosition + 1} of {batchQueue.length}
              </p>
            )}
            <p className="text-sm md:text-xs font-bold text-gray-900 truncate">
              {activeStory?.itemSkill || 'Loading...'}
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
                      <p className="text-sm md:text-xs text-gray-800 leading-relaxed whitespace-pre-line">{msg.content}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-end">
                    <div className="bg-gray-100 border border-gray-200 rounded-lg p-3 max-w-[85%]">
                      <p className="text-sm md:text-xs text-gray-800 leading-relaxed whitespace-pre-line">{msg.content}</p>
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
                  className="w-full text-white rounded-lg py-2 px-4 font-semibold text-sm transition-opacity hover:opacity-90"
                  style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
                >
                  Save and Continue →
                </button>
                <button onClick={onEnd} className="w-full text-xs md:text-[11px] text-gray-500 hover:text-gray-700">
                  Done for now
                </button>
              </>
            ) : (
              <button
                onClick={onEnd}
                className="w-full text-white rounded-lg py-2 px-4 font-semibold text-sm transition-opacity hover:opacity-90"
                style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
              >
                Save My Story →
              </button>
            )}
          </div>
        ) : (
          <div className="flex gap-2 items-stretch">
            <textarea
              ref={coachInputRef}
              value={coachInput}
              onChange={e => setCoachInput(e.target.value)}
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
                <h2 className="text-base font-bold text-white">Your STAR Story</h2>
                <p className="text-purple-100 text-sm md:text-xs truncate">{story.itemSkill || ''}</p>
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

        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          {story.starSituation && (
            <div>
              <p className="text-xs font-bold text-purple-700 uppercase tracking-wide mb-1">Situation</p>
              <p className="text-sm text-gray-800 leading-relaxed">{story.starSituation}</p>
            </div>
          )}
          {story.starTask && (
            <div>
              <p className="text-xs font-bold text-purple-700 uppercase tracking-wide mb-1">Task</p>
              <p className="text-sm text-gray-800 leading-relaxed">{story.starTask}</p>
            </div>
          )}
          {story.starAction && (
            <div>
              <p className="text-xs font-bold text-purple-700 uppercase tracking-wide mb-1">Action</p>
              <p className="text-sm text-gray-800 leading-relaxed">{story.starAction}</p>
            </div>
          )}
          {story.starResult && (
            <div>
              <p className="text-xs font-bold text-purple-700 uppercase tracking-wide mb-1">Result</p>
              <p className="text-sm text-gray-800 leading-relaxed">{story.starResult}</p>
            </div>
          )}
        </div>

        <div className="px-6 pb-5 pt-2 flex-shrink-0">
          <button
            onClick={onClose}
            className="block mx-auto rounded-lg py-2 px-8 font-semibold text-sm text-white transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
          >
            Done
          </button>
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
  interviewDate, countdown, interviewDateIsPast
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
          <h2 className="text-base md:text-lg font-bold text-gray-900 mb-1">Power Analysis</h2>
          <p className="text-xs text-gray-500 leading-snug">
            Tap any item to coach a STAR story, or use <span className="font-semibold text-purple-600">Coach Me Through This</span> for multiple at once.
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

        {/* PROGRESS */}
        <div className="flex flex-col gap-1.5 md:items-end md:border-l md:border-gray-200 md:pl-6">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Coaching Progress</p>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-gray-900" style={{ lineHeight: 1 }}>{storiesCoached}</span>
            <span className="text-sm font-medium text-gray-400">/ {totalStoryItems}</span>
          </div>
          <div className="w-32 h-1 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progressPct}%`, background: 'linear-gradient(to right, #667eea, #764ba2)' }}></div>
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