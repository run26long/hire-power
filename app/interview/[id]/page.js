'use client';

import { useState, useEffect, useCallback } from 'react';
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

  // Detail page data
  const [jobCard, setJobCard] = useState(null);
  const [resume, setResume] = useState(null);
  const [powerAnalysis, setPowerAnalysis] = useState(null);

  // Power Analysis generation state
  const [generating, setGenerating] = useState(false);
  const [paError, setPaError] = useState(null);

  // Live countdown (ticks every minute)
  const [now, setNow] = useState(Date.now());

  // Misc
  const [errorToast, setErrorToast] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

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

  // Tick countdown every minute (only if interview date exists and is in future)
  useEffect(() => {
    if (!jobCard?.interview_date) return;
    const target = new Date(jobCard.interview_date).getTime();
    if (target <= Date.now()) return;
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, [jobCard?.interview_date]);

  // ============================================================================
  // GENERATE POWER ANALYSIS
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
          setPaError({
            type: 'mismatch',
            message: data.message || "This resume and this job description don't appear to match closely enough for an interview analysis."
          });
          return;
        }
        if (data.error === 'NO_RESUME_AVAILABLE') {
          setPaError({
            type: 'no_resume',
            message: "You need a resume on file before we can analyze this job. Head to Resume Coach to upload or build one."
          });
          return;
        }
        if (data.error === 'JOB_CARD_INCOMPLETE') {
          setPaError({
            type: 'incomplete',
            message: "This job card is missing a title or job description. Add those in Job Tracker first."
          });
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
  // COUNTDOWN HELPER
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

    if (days >= 1) {
      return `${days} day${days === 1 ? '' : 's'}, ${hours} hour${hours === 1 ? '' : 's'}`;
    }
    if (hours >= 1) {
      return `${hours} hour${hours === 1 ? '' : 's'}, ${minutes} min`;
    }
    return `${minutes} min`;
  }

  // ============================================================================
  // RENDER STATES
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
              onClick={() => {
                setLoadError(null);
                setRetryCount(0);
                setLoading(true);
                loadData();
              }}
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
  const countdown = formatCountdown(jobCard.interview_date);
  const interviewDateIsPast = jobCard.interview_date && new Date(jobCard.interview_date).getTime() < now;

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <MainNav currentPage="my-interviews" userProfile={userProfile} />
      <Breadcrumb items={breadcrumbItems} />

      <div className="flex-1 flex overflow-hidden" style={{ height: 'calc(100vh - 160px)' }}>
        <div className="flex-1 flex flex-col md:flex-row gap-3 md:gap-6 p-3 md:p-6 max-w-7xl mx-auto w-full overflow-y-auto">

          {/* ====================================================== */}
          {/* LEFT COLUMN (70-75%) */}
          {/* ====================================================== */}
          <div className="flex-[3] bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col">
            <div className="p-4 md:p-6 flex flex-col gap-4 overflow-y-auto">

              {/* JOB HEADER */}
              <div className="pb-3 border-b border-gray-100 flex items-center gap-3">
                <span className="text-2xl flex-shrink-0">🎯</span>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base md:text-lg font-bold text-gray-900 truncate">{jobCard.title}</h2>
                  {jobCard.company && <p className="text-sm md:text-xs text-gray-500 truncate">{jobCard.company}</p>}
                </div>
                {resume && (
                  <span className="hidden md:inline-block text-xs md:text-[10px] text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    {resume.resume_type === 'job_specific' ? 'Tailored resume' : 'Core resume'}
                  </span>
                )}
              </div>

              {/* ====================================================== */}
              {/* TOP ROW: Practice Sessions + Countdown/Stats Card */}
              {/* ====================================================== */}
              <div className="flex flex-col md:flex-row gap-3">

                {/* Left: Practice Sessions (5 levels in one line) */}
                <div className="flex-[7] border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-sm md:text-xs font-bold text-gray-700 uppercase tracking-wide">Practice Sessions</h3>
                    <span className="text-xs md:text-[9px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">Coming Soon</span>
                  </div>
                  <div className="flex items-center justify-between gap-1 md:gap-2">
                    {[1, 2, 3, 4, 5].map((level) => {
                      const isComplete = level <= currentLevel;
                      const isCurrent = level === currentLevel + 1;
                      return (
                        <div key={level} className="flex-1 flex flex-col items-center gap-1">
                          <div className={`w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center text-xs md:text-sm font-bold border-2 ${
                            isComplete ? 'border-purple-600 text-white' :
                            isCurrent ? 'border-purple-300 bg-purple-50 text-purple-500' :
                            'border-dashed border-gray-300 bg-white text-gray-300'
                          }`}
                          style={isComplete ? { background: 'linear-gradient(to bottom right, #667eea, #764ba2)' } : {}}>
                            {isComplete ? '✓' : level}
                          </div>
                          <span className="text-xs md:text-[9px] text-gray-500 font-medium">
                            {level === 5 ? 'Mastery' : `L${level}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right: Countdown OR Stats Card */}
                <div className="flex-[3] border border-gray-200 rounded-lg p-3 bg-gray-50 flex flex-col justify-center">
                  {countdown ? (
                    <>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-sm">🗓️</span>
                        <h3 className="text-sm md:text-xs font-bold text-gray-700 uppercase tracking-wide">Interview In</h3>
                      </div>
                      <p className="text-base md:text-sm font-bold text-purple-700 leading-tight">{countdown}</p>
                      <p className="text-xs md:text-[10px] text-gray-500 mt-0.5">
                        {new Date(jobCard.interview_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </>
                  ) : interviewDateIsPast ? (
                    <>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-sm">🗓️</span>
                        <h3 className="text-sm md:text-xs font-bold text-gray-700 uppercase tracking-wide">Interview</h3>
                      </div>
                      <p className="text-sm md:text-xs text-gray-600 leading-tight">
                        {new Date(jobCard.interview_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </p>
                      <p className="text-xs md:text-[10px] text-gray-400 mt-0.5">How did it go?</p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5 mb-1">
                        <h3 className="text-sm md:text-xs font-bold text-gray-700 uppercase tracking-wide">Practices</h3>
                      </div>
                      <p className="text-2xl md:text-xl font-bold text-gray-700 leading-tight">{sessionsCount}</p>
                      <button
                        onClick={() => router.push('/job-tracker')}
                        className="text-xs md:text-[10px] text-purple-600 hover:text-purple-700 font-semibold mt-1 text-left"
                      >
                        Set interview date →
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* ====================================================== */}
              {/* POWER ANALYSIS */}
              {/* ====================================================== */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm md:text-xs font-bold text-gray-700 uppercase tracking-wide">Power Analysis</h3>
                  {hasPA && (
                    <button
                      onClick={handleGeneratePA}
                      disabled={generating}
                      className="text-sm md:text-xs text-purple-600 hover:text-purple-700 font-semibold disabled:opacity-50"
                    >
                      {generating ? 'Refreshing...' : 'Refresh'}
                    </button>
                  )}
                </div>

                {/* Staleness notice */}
                {hasPA && powerAnalysis.isStale && (
                  <div className="bg-amber-50 border-l-4 border-amber-400 p-3 rounded-r mb-3">
                    <p className="text-sm md:text-xs text-amber-800">
                      <strong>Your resume was updated since this analysis.</strong> Refresh to see the latest insights.
                    </p>
                  </div>
                )}

                {/* No PA yet - show generate CTA */}
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
                      ) : (
                        <>Generate Power Analysis</>
                      )}
                    </button>
                  </div>
                )}

                {/* Inline error display */}
                {paError && (
                  <div className="border border-red-200 rounded-lg p-4 bg-red-50 mb-3">
                    <div className="flex items-start gap-2">
                      <span className="text-base flex-shrink-0">⚠️</span>
                      <div className="flex-1">
                        <p className="text-sm md:text-xs text-red-800 leading-relaxed mb-3">{paError.message}</p>
                        <div className="flex flex-wrap gap-2">
                          {paError.type === 'mismatch' && (
                            <button
                              onClick={() => router.push('/resume-coach')}
                              className="text-sm md:text-xs text-purple-600 hover:text-purple-700 font-semibold"
                            >
                              Go to Resume Coach →
                            </button>
                          )}
                          {paError.type === 'no_resume' && (
                            <button
                              onClick={() => router.push('/resume-coach')}
                              className="text-sm md:text-xs text-purple-600 hover:text-purple-700 font-semibold"
                            >
                              Build a Resume →
                            </button>
                          )}
                          {paError.type === 'incomplete' && (
                            <button
                              onClick={() => router.push('/job-tracker')}
                              className="text-sm md:text-xs text-purple-600 hover:text-purple-700 font-semibold"
                            >
                              Edit in Job Tracker →
                            </button>
                          )}
                          <button
                            onClick={() => setPaError(null)}
                            className="text-sm md:text-xs text-gray-500 hover:text-gray-700"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* PA exists - show the three buckets */}
                {hasPA && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-3">

                    {/* Core Power */}
                    <div className="border border-green-200 rounded-lg p-3 bg-green-50">
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-base">✅</span>
                        <h4 className="text-sm md:text-xs font-bold text-green-800">Core Power</h4>
                        <span className="text-xs md:text-[10px] text-green-700 font-semibold ml-auto">{powerAnalysis.core_power.length}</span>
                      </div>
                      {powerAnalysis.core_power.length === 0 ? (
                        <p className="text-sm md:text-xs text-green-700 italic">No core matches surfaced. Consider tailoring your resume.</p>
                      ) : (
                        <ul className="space-y-2">
                          {powerAnalysis.core_power.map((item, i) => (
                            <li key={i} className="bg-white rounded p-2 border border-green-100">
                              <p className="text-sm md:text-xs font-bold text-gray-900 mb-1">{item.skill}</p>
                              {item.evidence && (
                                <p className="text-sm md:text-xs text-gray-700 leading-snug">{item.evidence}</p>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Hidden Power */}
                    <div className="border border-yellow-200 rounded-lg p-3 bg-yellow-50">
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-base">💡</span>
                        <h4 className="text-sm md:text-xs font-bold text-yellow-800">Hidden Power</h4>
                        <span className="text-xs md:text-[10px] text-yellow-700 font-semibold ml-auto">{powerAnalysis.hidden_power.length}</span>
                      </div>
                      {powerAnalysis.hidden_power.length === 0 ? (
                        <p className="text-sm md:text-xs text-yellow-800 italic">No hidden transferable skills surfaced.</p>
                      ) : (
                        <ul className="space-y-2">
                          {powerAnalysis.hidden_power.map((item, i) => (
                            <li key={i} className="bg-white rounded p-2 border border-yellow-100">
                              <p className="text-sm md:text-xs font-bold text-gray-900 mb-1">{item.skill}</p>
                              {item.evidence_reframe && (
                                <p className="text-sm md:text-xs text-gray-700 leading-snug">{item.evidence_reframe}</p>
                              )}
                              {item.source && (
                                <p className="text-xs md:text-[9px] text-gray-400 mt-1 italic">{item.source}</p>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Power Gaps */}
                    <div className="border border-red-200 rounded-lg p-3 bg-red-50">
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-base">⚠️</span>
                        <h4 className="text-sm md:text-xs font-bold text-red-800">Power Gaps</h4>
                        <span className="text-xs md:text-[10px] text-red-700 font-semibold ml-auto">{powerAnalysis.power_gaps.length}</span>
                      </div>
                      {powerAnalysis.power_gaps.length === 0 ? (
                        <p className="text-sm md:text-xs text-red-800 italic">No major gaps. You're well positioned for this role.</p>
                      ) : (
                        <ul className="space-y-2">
                          {powerAnalysis.power_gaps.map((item, i) => (
                            <li key={i} className="bg-white rounded p-2 border border-red-100">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <p className="text-sm md:text-xs font-bold text-gray-900 flex-1">{item.gap}</p>
                                {item.severity && (
                                  <span className={`text-xs md:text-[9px] font-bold px-1.5 py-0.5 rounded uppercase flex-shrink-0 ${
                                    item.severity === 'high' ? 'bg-red-200 text-red-800' :
                                    item.severity === 'medium' ? 'bg-amber-200 text-amber-800' :
                                    'bg-gray-200 text-gray-700'
                                  }`}>
                                    {item.severity}
                                  </span>
                                )}
                              </div>
                              {item.bridge_strategy && (
                                <p className="text-sm md:text-xs text-gray-700 leading-snug">{item.bridge_strategy}</p>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                  </div>
                )}
              </div>

            </div>
          </div>

          {/* ====================================================== */}
          {/* RIGHT COLUMN (25-30%) — Interview Preparation Flow */}
          {/* ====================================================== */}
          <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-y-auto">
            <div className="sticky top-0 bg-white z-10 p-4 pb-3 border-b border-gray-200">
              <h3 className="text-center font-semibold text-sm md:text-xs mb-3">Interview Preparation</h3>
              <div className="relative">
                <div className="absolute top-3 left-0 right-0 h-0.5 bg-gray-200"></div>
                <div className="relative flex justify-between">
                  {['Analyze', 'Coach', 'Practice', 'Feedback'].map((step, i) => {
                    const isAnalyzeComplete = hasPA;
                    const isCurrent = !isAnalyzeComplete && i === 0;
                    const isComplete = i === 0 && isAnalyzeComplete;
                    return (
                      <div key={step} className="flex flex-col items-center">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold z-10 ${
                          isComplete ? 'text-white' :
                          isCurrent ? 'text-white' :
                          'bg-white border-2 border-gray-200 text-gray-300'
                        }`}
                        style={(isComplete || isCurrent) ? { background: 'linear-gradient(to bottom right, #667eea, #764ba2)' } : {}}>
                          {isComplete ? '✓' : isCurrent ? '●' : '○'}
                        </div>
                        <span className={`text-xs md:text-[10px] mt-1 ${
                          isCurrent ? 'text-purple-600 font-semibold' :
                          isComplete ? 'text-purple-600' :
                          'text-gray-400'
                        }`}>{step}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="px-5 pb-5 pt-3 space-y-3">
              {!hasPA ? (
                <div className="bg-purple-50 border-l-4 border-purple-600 p-3 rounded-r">
                  <p className="text-sm md:text-xs text-gray-700 leading-snug font-medium mb-1">Start with your Power Analysis.</p>
                  <p className="text-sm md:text-xs text-gray-600 leading-snug">
                    We'll surface what to highlight in this interview based on your resume.
                  </p>
                </div>
              ) : (
                <>
                  <div className="bg-purple-50 border-l-4 border-purple-600 p-3 rounded-r">
                    <p className="text-sm md:text-xs text-gray-700 leading-snug font-medium mb-1">Your Power Analysis is ready.</p>
                    <p className="text-sm md:text-xs text-gray-600 leading-snug">
                      {isPro
                        ? "Coach through every gap before practice, or jump straight in."
                        : "Pro users coach through gaps and get unlimited practice. Free users practice once."}
                    </p>
                  </div>

                  {/* Coach Me Through This (Pro) / Upgrade (Free) */}
                  {isPro ? (
                    <button
                      disabled
                      className="w-full text-white rounded-lg py-2 px-4 font-semibold text-sm transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
                      style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
                      title="Coaching launches in the next phase"
                    >
                      Coach Me Through This
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowUpgradeModal(true)}
                      className="w-full text-white rounded-lg py-2 px-4 font-semibold text-sm transition-opacity hover:opacity-90"
                      style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
                    >
                      Unlock Coaching with Pro
                    </button>
                  )}

                  {/* Skip to Practice (Pro only, also disabled in Phase 2) */}
                  {isPro && (
                    <button
                      disabled
                      className="w-full border border-purple-200 text-purple-600 rounded-lg py-2 px-4 font-semibold text-sm transition-opacity disabled:opacity-60 disabled:cursor-not-allowed bg-white"
                      title="Practice launches in the next phase"
                    >
                      Skip to Practice
                    </button>
                  )}

                  <p className="text-xs md:text-[10px] text-gray-400 text-center italic pt-1">
                    Coaching and practice launch in the next update
                  </p>
                </>
              )}

              <div className="pt-2">
                <button
                  onClick={() => router.push('/interview-coach')}
                  className="block mx-auto border border-gray-300 text-gray-500 rounded-lg py-1.5 px-6 text-xs md:text-[11px] font-medium hover:bg-gray-50 transition-colors"
                >
                  ← Back to Interview Coach
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

      <ErrorToast message={errorToast} onClose={() => setErrorToast(null)} />
      <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
    </div>
  );
}