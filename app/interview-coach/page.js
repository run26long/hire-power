'use client';

import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import MainNav from '../components/MainNav';
import ErrorToast from '../components/ErrorToast';
import UpgradeModal from '../components/UpgradeModal';
import { getJobSources } from '../utils/getJobSources';

const QUESTIONS_OF_THE_DAY = [
  "Tell me about a time you had to deliver results under a tight deadline. What did you do?",
  "Describe a situation where you had to work with a difficult colleague. How did you handle it?",
  "Walk me through a project you're proud of. What was your role and what was the outcome?",
  "Tell me about a time you made a mistake at work. What happened and what did you learn?",
  "Describe a time you had to persuade someone to see things your way. How did you approach it?",
  "Tell me about a time you identified a problem before it became serious. What did you do?",
  "Describe a situation where you had to learn something new quickly. How did you manage it?",
];

// Match score ring color, matching Resume Coach's getCircleColor.
function getCircleColor(score) {
  if (score >= 85) return '#9333ea';
  if (score >= 75) return '#81c784';
  if (score >= 60) return '#ffc870';
  return '#e57373';
}

// AP-style title case helper (matches resume-coach pattern)
function toTitleCaseOnBlur(value) {
  if (!value) return value;
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
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
  const tokens = trimmed.toLowerCase().split(/(\s+)/);
  const wordIndices = [];
  tokens.forEach((tok, i) => { if (tok.trim() !== '') wordIndices.push(i); });
  const firstIdx = wordIndices[0];
  const lastIdx = wordIndices[wordIndices.length - 1];
  return tokens.map((tok, i) => {
    if (tok.trim() === '') return tok;
    const cleanTok = tok.replace(/[^a-z]/g, '');
    if (acronyms.has(cleanTok)) return tok.toUpperCase();
    const isFirst = i === firstIdx;
    const isLast = i === lastIdx;
    if (!isFirst && !isLast && smallWords.has(tok)) return tok;
    return tok.charAt(0).toUpperCase() + tok.slice(1);
  }).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// Hub spotlight tour
// Desktop only. Runs once, the first time a user lands on the hub with at least
// one practice card in hand. Each stop dims the page, cuts a hole around a real
// element, and parks a tooltip beside it.
// ─────────────────────────────────────────────────────────────────────────────
const HUB_TOUR_KEY = 'hp_ic_hub_tour_complete';
const HUB_TIP_WIDTH = 320;
const HUB_SPOT_PAD = 8;
const HUB_TIP_GAP = 16;
const HUB_VIEWPORT_MARGIN = 16;

const HUB_TOUR_STEPS = [
  {
    id: 'interview-prep',
    targets: ['interview-prep'],
    placement: 'right',
    title: 'Your interview prep hub',
    body: 'Start a new practice for any job, or pick up where you left off. Each card shows four ways to prepare for your interview: Analysis, Research, Prep, and Practice. Do them in order or skip to what you need.'
  },
  {
    id: 'practice-stats',
    targets: ['practice-stats'],
    placement: 'left',
    title: 'Track your progress',
    body: 'Your training at a glance. Sessions, level, and total jobs update as you practice.'
  },
  {
    id: 'question-of-the-day',
    targets: ['question-of-the-day'],
    placement: 'right',
    title: 'Question of the Day',
    body: 'A new question every day. Think through your STAR answer. No scoring, no pressure.'
  },
  {
    id: 'interview-readiness',
    targets: ['interview-readiness'],
    placement: 'left',
    title: 'Interview Readiness',
    body: 'A quick checklist before any real interview. Run through it to make sure you are fully prepared.'
  },
  {
    id: 'job-tracker',
    targets: ['job-tracker'],
    placement: 'bottom',
    title: 'Linked to your Job Tracker',
    body: "Each job's practice session is linked to its job card in your Job Tracker. Start interview prep from here or from the job card itself."
  }
];

function hubTourAlreadySeen() {
  try {
    return !!window.localStorage.getItem(HUB_TOUR_KEY);
  } catch (e) {
    // Storage blocked (private mode) — treat it as unseen rather than crashing.
    return false;
  }
}

function markHubTourComplete() {
  try {
    window.localStorage.setItem(HUB_TOUR_KEY, 'true');
  } catch (e) {
    console.error('Could not persist hub tour completion (non-blocking):', e);
  }
}

// Park the tooltip beside the spotlight, preferring the side the step asks for
// and falling back through the others until one fits without overflowing.
function computeHubTipPosition(rect, tipW, tipH, preferred) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const M = HUB_VIEWPORT_MARGIN;
  const GAP = HUB_TIP_GAP;
  const clamp = (v, min, max) => Math.max(min, Math.min(v, Math.max(min, max)));

  if (!rect) {
    // No measurable target — centre the card and skip the spotlight/arrow.
    return { top: clamp(vh / 2 - tipH / 2, M, vh - tipH - M), left: clamp(vw / 2 - tipW / 2, M, vw - tipW - M), placement: 'none', arrow: 0 };
  }

  const top = rect.top - HUB_SPOT_PAD;
  const left = rect.left - HUB_SPOT_PAD;
  const bottom = rect.top + rect.height + HUB_SPOT_PAD;
  const right = rect.left + rect.width + HUB_SPOT_PAD;
  const cx = (left + right) / 2;
  const cy = (top + bottom) / 2;

  const isVertical = preferred === 'top' || preferred === 'bottom';
  const order = isVertical
    ? [preferred, preferred === 'bottom' ? 'top' : 'bottom', 'right', 'left']
    : [preferred, preferred === 'left' ? 'right' : 'left', 'bottom', 'top'];

  for (const p of order) {
    if (p === 'bottom' && bottom + GAP + tipH <= vh - M) {
      const l = clamp(cx - tipW / 2, M, vw - tipW - M);
      return { top: bottom + GAP, left: l, placement: 'bottom', arrow: clamp(cx - l, 18, tipW - 18) };
    }
    if (p === 'top' && top - GAP - tipH >= M) {
      const l = clamp(cx - tipW / 2, M, vw - tipW - M);
      return { top: top - GAP - tipH, left: l, placement: 'top', arrow: clamp(cx - l, 18, tipW - 18) };
    }
    if (p === 'right' && right + GAP + tipW <= vw - M) {
      const t = clamp(cy - tipH / 2, M, vh - tipH - M);
      return { top: t, left: right + GAP, placement: 'right', arrow: clamp(cy - t, 18, tipH - 18) };
    }
    if (p === 'left' && left - GAP - tipW >= M) {
      const t = clamp(cy - tipH / 2, M, vh - tipH - M);
      return { top: t, left: left - GAP - tipW, placement: 'left', arrow: clamp(cy - t, 18, tipH - 18) };
    }
  }

  // Nothing fits cleanly — sit below the target and clamp into the viewport.
  const l = clamp(cx - tipW / 2, M, vw - tipW - M);
  const t = clamp(bottom + GAP, M, vh - tipH - M);
  return { top: t, left: l, placement: 'bottom', arrow: clamp(cx - l, 18, tipW - 18) };
}

// CSS-triangle arrow, drawn twice so it picks up the card's 1px grey edge.
function hubArrowStyles(placement, offset) {
  const S = 8;
  const O = S + 1;
  if (placement === 'bottom') {
    return {
      outer: { top: -O, left: offset - O, borderLeft: `${O}px solid transparent`, borderRight: `${O}px solid transparent`, borderBottom: `${O}px solid #e5e7eb` },
      inner: { top: -S, left: offset - S, borderLeft: `${S}px solid transparent`, borderRight: `${S}px solid transparent`, borderBottom: `${S}px solid #ffffff` }
    };
  }
  if (placement === 'top') {
    return {
      outer: { bottom: -O, left: offset - O, borderLeft: `${O}px solid transparent`, borderRight: `${O}px solid transparent`, borderTop: `${O}px solid #e5e7eb` },
      inner: { bottom: -S, left: offset - S, borderLeft: `${S}px solid transparent`, borderRight: `${S}px solid transparent`, borderTop: `${S}px solid #ffffff` }
    };
  }
  if (placement === 'right') {
    return {
      outer: { left: -O, top: offset - O, borderTop: `${O}px solid transparent`, borderBottom: `${O}px solid transparent`, borderRight: `${O}px solid #e5e7eb` },
      inner: { left: -S, top: offset - S, borderTop: `${S}px solid transparent`, borderBottom: `${S}px solid transparent`, borderRight: `${S}px solid #ffffff` }
    };
  }
  if (placement === 'left') {
    return {
      outer: { right: -O, top: offset - O, borderTop: `${O}px solid transparent`, borderBottom: `${O}px solid transparent`, borderLeft: `${O}px solid #e5e7eb` },
      inner: { right: -S, top: offset - S, borderTop: `${S}px solid transparent`, borderBottom: `${S}px solid transparent`, borderLeft: `${S}px solid #ffffff` }
    };
  }
  return null;
}

function HubTour({ isPro, onStepChange, onClose }) {
  // Lock the stop list at mount so the dots match what's actually on screen —
  // a Vault-tier user has no Job Tracker link, for instance. Copy is resolved
  // here too: the tour only mounts once data has loaded, so the tier is settled.
  const [steps] = useState(() =>
    HUB_TOUR_STEPS
      .filter(s => document.querySelector(`[data-tour="${s.targets[0]}"]`))
      .map(s => (isPro ? s : { ...s, title: s.freeTitle || s.title, body: s.freeBody || s.body }))
  );
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const [tip, setTip] = useState(null);
  const tipRef = useRef(null);

  const step = steps[index] || null;
  const isLast = index === steps.length - 1;

  const finish = useCallback(() => {
    markHubTourComplete();
    onClose();
  }, [onClose]);

  const measure = useCallback(() => {
    if (!step) return;
    const rects = step.targets
      .map(t => document.querySelector(`[data-tour="${t}"]`))
      .filter(Boolean)
      .map(el => el.getBoundingClientRect())
      .filter(r => r.width > 0 && r.height > 0);
    if (!rects.length) {
      setRect(null);
      return;
    }
    const top = Math.min(...rects.map(r => r.top));
    const left = Math.min(...rects.map(r => r.left));
    const height = Math.max(...rects.map(r => r.bottom)) - top;
    const width = Math.max(...rects.map(r => r.right)) - left;
    setRect(prev => {
      if (prev && Math.abs(prev.top - top) < 0.5 && Math.abs(prev.left - left) < 0.5
        && Math.abs(prev.width - width) < 0.5 && Math.abs(prev.height - height) < 0.5) return prev;
      return { top, left, width, height };
    });
  }, [step]);

  // Nothing to point at — don't strand the user behind a backdrop.
  useEffect(() => {
    if (!steps.length) finish();
  }, [steps.length, finish]);

  useLayoutEffect(() => {
    if (!step) return;
    const el = document.querySelector(`[data-tour="${step.targets[0]}"]`);
    if (el) el.scrollIntoView({ block: 'center', inline: 'nearest' });
    measure();
  }, [step, measure]);

  useEffect(() => {
    onStepChange?.(step ? step.id : null);
  }, [step, onStepChange]);

  useEffect(() => {
    const onChange = () => measure();
    window.addEventListener('resize', onChange);
    window.addEventListener('scroll', onChange, true);
    return () => {
      window.removeEventListener('resize', onChange);
      window.removeEventListener('scroll', onChange, true);
    };
  }, [measure]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') finish(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [finish]);

  // Position once the card has rendered so we can use its real height.
  useLayoutEffect(() => {
    const h = tipRef.current?.offsetHeight || 180;
    setTip(computeHubTipPosition(rect, HUB_TIP_WIDTH, h, step?.placement));
  }, [rect, step]);

  if (!step) return null;

  const arrow = tip ? hubArrowStyles(tip.placement, tip.arrow) : null;

  return (
    <>
      {/* Click blocker — the tour only closes via Skip, Got it, or Escape. */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} />

      {rect ? (
        <div
          style={{
            position: 'fixed',
            boxSizing: 'border-box',
            top: rect.top - HUB_SPOT_PAD,
            left: rect.left - HUB_SPOT_PAD,
            width: rect.width + HUB_SPOT_PAD * 2,
            height: rect.height + HUB_SPOT_PAD * 2,
            borderRadius: 12,
            border: '2px solid rgba(102, 126, 234, 0.4)',
            boxShadow: '0 0 0 4px rgba(102, 126, 234, 0.1), 0 0 30px rgba(102, 126, 234, 0.15), 0 0 0 9999px rgba(0, 0, 0, 0.5)',
            pointerEvents: 'none',
            zIndex: 9999,
            transition: 'top 0.3s ease, left 0.3s ease, width 0.3s ease, height 0.3s ease'
          }}
        />
      ) : (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', pointerEvents: 'none', zIndex: 9999 }} />
      )}

      <div
        ref={tipRef}
        role="dialog"
        aria-label={step.title}
        style={{
          position: 'fixed',
          top: tip ? tip.top : -9999,
          left: tip ? tip.left : -9999,
          width: HUB_TIP_WIDTH,
          zIndex: 10000,
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15), 0 4px 16px rgba(0, 0, 0, 0.08)',
          opacity: tip ? 1 : 0,
          transition: 'top 0.3s ease, left 0.3s ease, opacity 0.2s ease'
        }}
      >
        {/* Brand gradient edge */}
        <div
          style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
            background: 'linear-gradient(to bottom, #667eea, #764ba2)',
            borderTopLeftRadius: 12, borderBottomLeftRadius: 12
          }}
        />

        {arrow && (
          <>
            <div style={{ position: 'absolute', width: 0, height: 0, ...arrow.outer }} />
            <div style={{ position: 'absolute', width: 0, height: 0, ...arrow.inner }} />
          </>
        )}

        <div style={{ padding: '16px 18px 14px 20px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#667eea', marginBottom: 6 }}>
            Step {index + 1} of {steps.length}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a', marginBottom: 6 }}>
            {step.title}
          </div>
          <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
            {step.body}
          </div>
        </div>

        <div
          style={{
            borderTop: '1px solid #f3f4f6',
            padding: '10px 18px 12px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            {steps.map((s, i) => (
              <span
                key={s.id}
                style={{
                  width: 7, height: 7, borderRadius: '50%', display: 'block',
                  background: i === index
                    ? 'linear-gradient(to bottom right, #667eea, #764ba2)'
                    : i < index ? '#667eea' : '#e5e7eb'
                }}
              />
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={finish}
              style={{ fontSize: 12, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              Skip tour
            </button>
            <button
              onClick={() => { if (isLast) finish(); else setIndex(index + 1); }}
              style={{
                fontSize: 13, fontWeight: 600, color: '#ffffff',
                background: 'linear-gradient(to right, #667eea, #764ba2)',
                border: 'none', borderRadius: 6, padding: '8px 20px', cursor: 'pointer', whiteSpace: 'nowrap'
              }}
            >
              {isLast ? 'Got it ✓' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function MyInterviewsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPro, setIsPro] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Practice cards
  const [practiceCards, setPracticeCards] = useState([]);
  const [showOlderModal, setShowOlderModal] = useState(false);

  // New Practice Modal state
  const [showPracticeModal, setShowPracticeModal] = useState(false);
  const [jobSources, setJobSources] = useState([]);
  const [selectedJobSourceId, setSelectedJobSourceId] = useState('');
  const [practiceJobTitle, setPracticeJobTitle] = useState('');
  const [practiceJobCompany, setPracticeJobCompany] = useState('');
  const [practiceJobDescription, setPracticeJobDescription] = useState('');
  const [creatingPractice, setCreatingPractice] = useState(false);
  const [practiceCreateError, setPracticeCreateError] = useState(null);

  // Error toast
  const [errorToast, setErrorToast] = useState(null);

  // Delete confirmation
  const [confirmDeletePracticeId, setConfirmDeletePracticeId] = useState(null);
  const [deletingPracticeId, setDeletingPracticeId] = useState(null);

  // Hub spotlight tour state
  const [showHubTour, setShowHubTour] = useState(false);
  const [hubTourStepId, setHubTourStepId] = useState(null);
  const closeHubTour = useCallback(() => {
    setShowHubTour(false);
    setHubTourStepId(null);
  }, []);

  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const questionOfTheDay = QUESTIONS_OF_THE_DAY[dayOfYear % QUESTIONS_OF_THE_DAY.length];

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/dashboard'); return; }
      setUser(user);

      const { data: profile } = await supabase
        .from('profiles').select('*').eq('id', user.id).maybeSingle();
      setUserProfile(profile);
      setIsPro(profile?.subscription_tier === 'pro');

      const sources = await getJobSources(supabase, user.id);
      setJobSources(sources);

      // Load practice cards: any job card that has a Power Analysis row
      const { data: paRows } = await supabase
        .from('power_analysis')
        .select(`
          id,
          job_card_id,
          generated_at,
          last_refreshed_at,
          core_power,
          hidden_power,
          power_gaps,
          current_step,
          highest_step_reached,
          applications:job_card_id (
            id,
            title,
            company,
            interview_date,
            interview_level,
            interview_sessions_count,
            match_score,
            application_status
          )
        `)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('last_refreshed_at', { ascending: false, nullsFirst: false });

      const cards = (paRows || [])
        .filter(row => row.applications && row.applications.application_status !== 'archived')
        .map(row => {
          return {
            paId: row.id,
            jobCardId: row.job_card_id,
            generatedAt: row.last_refreshed_at || row.generated_at,
            title: row.applications.title,
            company: row.applications.company,
            interviewDate: row.applications.interview_date,
            level: row.applications.interview_level || 0,
            sessionsCount: row.applications.interview_sessions_count || 0,
            matchScore: row.applications.match_score,
            currentStep: row.current_step,
            highestStepReached: row.highest_step_reached
          };
        });

      setPracticeCards(cards);
      setLoading(false);

      // A practice card in hand: walk them through the hub once. Desktop only —
      // the spotlight targets are laid out for the two-column desktop view.
      if (cards.length > 0 && window.innerWidth >= 768 && !hubTourAlreadySeen()) {
        setTimeout(() => {
          setShowHubTour(true);
        }, 300); // 300ms delay
      }
    }
    loadData();
  }, [supabase, router]);

  // The counters the gate reads are written by the routes behind the detail
  // page, so a copy of the profile taken on mount goes out of date the moment
  // someone leaves. Re-read when the tab comes back rather than on a timer:
  // that is when it matters, and it is one row. A client navigation back to
  // the hub remounts the page and reloads everything anyway; this covers the
  // rest — another tab, another window, an upgrade bought elsewhere.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    const refreshProfile = async () => {
      if (document.visibilityState === 'hidden') return;
      const { data: profile } = await supabase
        .from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (cancelled || !profile) return;
      setUserProfile(profile);
      setIsPro(profile.subscription_tier === 'pro');
    };

    window.addEventListener('focus', refreshProfile);
    document.addEventListener('visibilitychange', refreshProfile);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', refreshProfile);
      document.removeEventListener('visibilitychange', refreshProfile);
    };
  }, [user?.id, supabase]);

  function handleOpenPracticeModal() {
    setSelectedJobSourceId('');
    setPracticeJobTitle('');
    setPracticeJobCompany('');
    setPracticeJobDescription('');
    setPracticeCreateError(null);
    setShowPracticeModal(true);
  }

  async function handleStartPractice() {
    if (selectedJobSourceId) {
      setShowPracticeModal(false);
      router.push(`/interview/${selectedJobSourceId}`);
      return;
    }

    if (!practiceJobTitle.trim() || !practiceJobDescription.trim()) {
      setPracticeCreateError('Please fill in the job title and job description.');
      return;
    }

    setCreatingPractice(true);
    setPracticeCreateError(null);

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error("You're signed out. Please refresh and sign in again.");

      const { data: newCard, error: insertError } = await supabase
        .from('applications')
        .insert({
          user_id: authUser.id,
          title: practiceJobTitle.trim(),
          company: practiceJobCompany.trim() || 'Company Name',
          description: practiceJobDescription.trim(),
          application_status: 'prepping'
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setShowPracticeModal(false);
      router.push(`/interview/${newCard.id}`);
    } catch (err) {
      console.error('Create practice job error:', err);
      setPracticeCreateError(err.message || "We couldn't create this practice. Please try again.");
    } finally {
      setCreatingPractice(false);
    }
  }

  async function handleDeletePractice(jobCardId) {
    try {
      setDeletingPracticeId(jobCardId);

      // Archive the Power Analysis. Coached stories stay put — they're the
      // user's own words and survive a removed practice.
      const { error: paError } = await supabase
        .from('power_analysis')
        .update({ is_active: false })
        .eq('job_card_id', jobCardId)
        .eq('user_id', user.id);
      if (paError) throw paError;

      setConfirmDeletePracticeId(null);
      setPracticeCards(prev => prev.filter(c => c.jobCardId !== jobCardId));
      setErrorToast("Interview practice removed. Restart it anytime from your Job Tracker.");
    } catch (error) {
      console.error('Archive practice error:', error);
      setErrorToast('Could not remove interview practice. Please try again.');
    } finally {
      setDeletingPracticeId(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-purple-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // Practice Stats totals. Sessions accumulate across every job; level is the
  // furthest the user has reached on any single one, not a sum.
  const totalSessions = practiceCards.reduce((sum, c) => sum + (c.sessionsCount || 0), 0);
  const maxLevel = practiceCards.reduce((max, c) => Math.max(max, c.level || 0), 0);

  // A job that already has a practice card is left out of the New Interview
  // Practice picker: its card is already on the hub above, and a second one for
  // the same job would only be a duplicate to explain. Derived rather than
  // filtered on load, so throwing a practice away puts its job back in the list.
  const availableJobSources = jobSources.filter(
    source => !practiceCards.some(card => card.jobCardId === source.id)
  );

  // One job, prepared for properly, is the whole free tier. Read from the
  // counter the routes enforce rather than from the cards on screen: a card
  // can be deleted, and the analysis behind it still counted.
  const practiceLocked = !isPro && (userProfile?.interview_samples_used ?? 0) >= 1;

  return (
    <div className="h-screen bg-gray-50 flex">

      {/* Left Sidebar */}
      <div
        className="hidden md:flex w-64 text-white flex-col fixed left-0 top-0 shadow-lg z-40"
        style={{
          background: 'linear-gradient(180deg, #667eea 0%, #764ba2 100%)',
          height: '100vh',
          overflowY: 'hidden'
        }}
      >
        <div className="px-6 pt-6 pb-4 flex-shrink-0">
          <h1 className="text-[28px] font-bold mb-1.5 whitespace-nowrap tracking-tight">Interview Coach</h1>
          <p className="text-[13px] text-white text-opacity-95 leading-tight tracking-tight mb-0.5">
            Job hunting is small talk.
          </p>
          <p className="text-[13px] text-white text-opacity-95 leading-tight tracking-tight">
            Your career deserves a conversation.
          </p>
          <div className="mt-4 border-b border-gray-400 border-opacity-10"></div>
        </div>

        <div className="px-6 pt-0 pb-6">

          {/* Steps */}
          <div style={{ marginBottom: 16 }}>
            {[
              { 
                num: '1', 
                title: 'Power Analysis', 
                desc: 'We analyze your resume against the job description and show you what to highlight in each interview.',
          
              },
              {
                num: '2',
                title: 'Company Research',
                desc: 'Learn about the company to align your experience with business goals.'
              },
              {
                num: '3',
                title: 'Interview Prep',
                desc: 'Get questions to ask your interviewer and print a toolkit to take with you.'
              },
              {
                num: '4',
                title: 'Interview Practice',
                desc: 'Practice with customized questions based on your skills and experience and the job requirements.',
                tag: 'Free: 1 session · Pro: Unlimited'
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
          <div>
            <div className="border-b border-gray-400 border-opacity-10" style={{ marginBottom: 14 }}></div>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#fff', lineHeight: 1.3, marginBottom: 4 }}>
              You already have the experience. We help you tell it.
            </p>
          </div>

        </div>
      </div>

      {/* Main Content */}
      <div className="ml-0 md:ml-64 flex-1 flex flex-col h-screen overflow-hidden">
        <MainNav currentPage="interview-coach" userProfile={userProfile} />

        <div className="flex-1 overflow-y-auto">
          <div className="px-4 md:px-6 py-2 md:py-3 max-w-[1400px] mx-auto w-full">

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">

              {/* LEFT: Practice History (8 cols) */}
              <div className="col-span-1 md:col-span-8 space-y-2">

                {/* Practice History Card */}
                <div data-tour="interview-prep" className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 md:px-5 md:py-3 flex flex-col overflow-hidden md:h-[384px]">
                  <div className="flex items-center justify-between mb-1">
                    <h2 className="text-lg font-semibold text-gray-900">Interview Prep</h2>
                    <span className="md:hidden text-sm font-semibold px-3 py-1 rounded-md" style={{ backgroundColor: 'rgba(147, 51, 234, 0.08)', color: '#7e22ce' }}>Interview Coach</span>
                  </div>
                  <p className="text-sm md:text-xs text-gray-500 mb-2">
                    Prep for any interview with <span className="whitespace-nowrap font-semibold text-gray-700">Power Analysis</span>, <span className="whitespace-nowrap font-semibold text-gray-700">Company Research</span>, <span className="whitespace-nowrap font-semibold text-gray-700">Interview Prep</span>, or <span className="whitespace-nowrap font-semibold text-gray-700">Interview Practice</span>. Do all or just what you need.
                  </p>

                      <div>
                        <div className="space-y-2">
                          {practiceLocked ? (
                            /* The free job is spent, so the way in is closed and
                               what stands in its place says why. The card below
                               still opens: what they prepared is still theirs. */
                            <div className="border border-purple-200 bg-purple-50 rounded-lg p-3 flex items-center gap-3">
                              <span className="text-base flex-shrink-0 leading-none">🔒</span>
                              <p className="flex-1 text-sm md:text-xs text-purple-900 leading-snug">
                                You&apos;ve used your free interview prep. Go Pro to practice for every job you pursue.
                              </p>
                              <button
                                onClick={() => setShowUpgradeModal(true)}
                                className="flex-shrink-0 rounded-md py-1.5 px-4 font-semibold text-white text-sm md:text-xs transition-opacity hover:opacity-90"
                                style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
                              >
                                Go Pro
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={handleOpenPracticeModal}
                              className="w-full border-2 border-dashed border-gray-300 rounded-lg p-2.5 hover:border-purple-400 hover:bg-purple-50 transition-all flex items-center justify-center gap-2"
                              style={{ height: '44px' }}
                            >
                              <div className="w-4 h-4 rounded-full bg-purple-100 flex items-center justify-center">
                                <svg className="w-2.5 h-2.5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                              </div>
                              <div className="text-sm md:text-xs font-semibold text-gray-900">New Interview Practice</div>
                            </button>
                          )}

                          {practiceCards && practiceCards.length > 0 ? (
                            <>
                              {practiceCards.slice(0, 3).map((card) => (
                                <PracticeCard
                                  key={card.jobCardId}
                                  card={card}
                                  canDelete={isPro}
                                  onClick={() => router.push(`/interview/${card.jobCardId}`)}
                                  onDeleteRequest={() => setConfirmDeletePracticeId(card.jobCardId)}
                                />
                              ))}
                              {practiceCards.length > 3 && (
                               <button
                                    onClick={() => setShowOlderModal(true)}
                                    className="w-full text-center py-1.5 text-sm md:text-xs text-purple-600 hover:text-purple-700 font-medium transition-colors"
                                  >
                                    View all interview practices →
                                  </button>
                              )}
                            </>
                          ) : (
                            <div className="text-center py-4 text-gray-500">
                              <div className="text-2xl mb-1">🎯</div>
                              <p className="text-sm md:text-xs">No interview practices yet.<br />Click "New Interview Practice" when you're ready.</p>
                            </div>
                          )}
                        </div>
                        </div>
                </div>

                {/* Question of the Day */}
                <div data-tour="question-of-the-day" className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-base font-semibold text-gray-900">Question of the Day</h2>
                    <span className="text-xs md:text-[10px] text-gray-400">Think it through, no pressure</span>
                  </div>
                  <div className="bg-purple-50 border-l-4 border-purple-600 p-4 rounded-r mt-3">
                    <p className="text-base md:text-sm text-gray-800 font-medium leading-relaxed">{questionOfTheDay}</p>
                  </div>
                  <div className="mt-3 flex flex-col md:flex-row md:items-center md:justify-between gap-1.5">
                    <p className="text-sm md:text-xs text-gray-500">Use the STAR method: Situation, Task, Action, Result</p>
                  </div>
                </div>

              </div>

              {/* RIGHT: Stats + Readiness (4 cols) */}
              <div className="col-span-1 md:col-span-4 space-y-2 flex flex-col self-stretch">

                {/* Practice Stats */}
                <div data-tour="practice-stats" className={`bg-white rounded-lg shadow-sm border border-gray-200 p-3 md:h-[213px] ${isPro ? 'flex flex-col' : ''}`}>
                  <h2 className="text-base font-semibold text-gray-900 mb-1">Practice Stats</h2>
                  <p className="text-sm md:text-xs text-gray-500 mb-3.5">Your interview training at a glance</p>

                  {isPro ? (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="grid grid-cols-3 gap-2 w-full">
                        {[
                          { label: 'Sessions', sub: 'Across all jobs', val: String(totalSessions), tone: 'purple' },
                          { label: 'Level', sub: 'Per job', val: String(maxLevel), tone: 'purple' },
                          { label: 'Total Jobs', sub: 'Unique targets', val: String(practiceCards.length), tone: 'gray' },
                        ].map((stat) => {
                          // Zero stays muted; a real value takes the tone for its stat.
                          const isZero = (Number(stat.val) || 0) === 0;
                          const valueClass = isZero
                            ? 'text-gray-300'
                            : stat.tone === 'purple'
                              ? 'text-purple-600'
                              : 'text-gray-700';
                          return (
                            <div key={stat.label} className="flex flex-col items-center justify-center text-center p-3 bg-gray-50 rounded-lg">
                              <span className={`text-2xl font-bold ${valueClass}`}>{stat.val}</span>
                              <p className="text-sm md:text-xs font-medium text-gray-700 whitespace-nowrap">{stat.label}</p>
                              <p className="text-xs md:text-[10px] text-gray-400">{stat.sub}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex flex-col items-center justify-center text-center p-2 bg-gray-50 rounded-lg">
                        <span className="text-2xl font-bold text-gray-300">0</span>
                        <p className="text-sm md:text-xs font-medium text-gray-700">Total Sessions</p>
                        <p className="text-xs md:text-[10px] text-gray-400">Across all jobs</p>
                      </div>
                      <div className="flex items-center justify-between p-2.5 bg-purple-50 border border-purple-200 rounded-lg gap-3">
                        <p className="text-sm md:text-xs text-purple-800 leading-snug">Unlock Power Analysis, coaching, and job-specific practice sessions.</p>
                        <button
                          onClick={() => router.push('/pricing')}
                          className="text-white rounded-md py-1.5 px-3 text-xs md:text-[11px] font-semibold flex-shrink-0 transition-opacity hover:opacity-90"
                          style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
                        >
                          Go Pro
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Only useful before there's anything to show. */}
                  {totalSessions === 0 && (
                    <p className={`text-xs md:text-[10px] text-gray-400 text-center ${isPro ? 'mt-auto pt-2' : 'mt-2'}`}>Start practicing to see your stats here</p>
                  )}
                </div>

                {/* Practice out loud callout */}
                <div className="bg-purple-50 border-l-4 border-purple-600 p-3 rounded-r md:h-[74px] overflow-hidden">
                  <p className="text-sm md:text-xs text-gray-700 leading-snug">
                    Candidates who practice out loud, not just in their head, are significantly more confident and articulate in real interviews.
                  </p>
                </div>

                {/* Interview Readiness Checklist */}
                <div data-tour="interview-readiness" className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 md:h-[250px] overflow-hidden">
                  <h2 className="text-base font-semibold text-gray-900 mb-1">Interview Readiness</h2>
                  <p className="text-sm md:text-xs text-gray-500 mb-4">Quick prep before any interview</p>

                  <div className="space-y-1.5">
                    {[
                      { label: 'Tailored & reviewed resume', key: 'resume' },
                       { label: 'Prepared 3 STAR stories', key: 'stories' },
                        { label: 'Completed company research', key: 'research' },
                      { label: 'Thought of questions for interviewer', key: 'question' },
                      { label: 'Practiced out loud at least once', key: 'practiced' },
                    ].map((item) => (
                      <ChecklistItem key={item.key} label={item.label} />
                    ))}
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>

      {/* New Interview Practice Modal */}
      {showPracticeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => { setShowPracticeModal(false); setPracticeCreateError(null); }}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4" style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-lg">🎤</span>
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">New Interview Practice</h2>
                    <p className="text-purple-100 text-sm md:text-xs">Pick a job from your tracker, or start a new one.</p>
                  </div>
                </div>
                <button
                  onClick={() => { setShowPracticeModal(false); setPracticeCreateError(null); }}
                  className="text-white hover:opacity-70 text-2xl leading-none font-light"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {availableJobSources.length > 0 && (
                <div>
                  <label className="block text-xs md:text-[10px] font-semibold text-gray-700 mb-1">Use details from existing job</label>
                  <p className="text-[10px] text-gray-400 mb-1">Select an existing job to auto-fill the details below, or fill them in manually.</p>
                  <select
                    value={selectedJobSourceId}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '') {
                        setSelectedJobSourceId('');
                        setPracticeJobTitle('');
                        setPracticeJobCompany('');
                        setPracticeJobDescription('');
                      } else {
                        const selected = availableJobSources.find(s => s.id === val);
                        setSelectedJobSourceId(val);
                        setPracticeJobTitle(selected?.title || '');
                        setPracticeJobCompany(selected?.company || '');
                        setPracticeJobDescription(selected?.description || '');
                      }
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base md:text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                  >
                    <option value="">None selected</option>
                    {availableJobSources.map(s => (
                      <option key={s.id} value={s.id}>{s.displayLabel}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm md:text-xs font-semibold text-gray-700 mb-1">Job Title *</label>
                <input
                  type="text"
                  value={practiceJobTitle}
                  onChange={e => setPracticeJobTitle(e.target.value)}
                  onBlur={e => setPracticeJobTitle(toTitleCaseOnBlur(e.target.value))}
                  placeholder="e.g. Marketing Coordinator"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm md:text-xs font-semibold text-gray-700 mb-1">Company</label>
                <input
                  type="text"
                  value={practiceJobCompany}
                  onChange={e => setPracticeJobCompany(e.target.value)}
                  onBlur={e => setPracticeJobCompany(toTitleCaseOnBlur(e.target.value))}
                  placeholder="e.g. Disney"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm md:text-xs font-semibold text-gray-700 mb-1">Job Description *</label>
                <textarea
                  value={practiceJobDescription}
                  onChange={e => setPracticeJobDescription(e.target.value)}
                  placeholder="Paste the full job description here..."
                  rows={6}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
              </div>

              {practiceCreateError && (
                <p className="text-sm md:text-xs text-red-600">{practiceCreateError}</p>
              )}

              <button
                onClick={handleStartPractice}
                disabled={creatingPractice}
                className="block mx-auto rounded-lg py-2 px-8 font-semibold text-sm md:text-xs flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(to right, #667eea, #764ba2)', color: 'white', opacity: creatingPractice ? 0.85 : 1 }}
              >
                <span key={creatingPractice ? 'loading' : 'idle'} className="flex items-center gap-2">
                  {creatingPractice && <div className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>}
                  {creatingPractice ? 'Starting...' : 'Start Practice →'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* All Interview Practices Modal */}
      {showOlderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4" style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Interview Practices</h2>
                  <p className="text-purple-100 text-xs">{practiceCards?.length} practices</p>
                </div>
                <button onClick={() => setShowOlderModal(false)} className="text-white text-2xl leading-none font-light hover:opacity-70">×</button>
              </div>
            </div>
            <div className="px-6 py-4 overflow-y-auto" style={{ maxHeight: '60vh' }}>
              <div className="space-y-2">
                {practiceCards?.map((card) => (
                  <PracticeCard
                    key={card.jobCardId}
                    card={card}
                    compact
                    canDelete={isPro}
                    onClick={() => { setShowOlderModal(false); router.push(`/interview/${card.jobCardId}`); }}
                    onDeleteRequest={() => setConfirmDeletePracticeId(card.jobCardId)}
                  />
                ))}
              </div>
            </div>
            </div>
        </div>
      )}

      {/* Interview Practice Delete Confirmation */}
      {confirmDeletePracticeId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={() => setConfirmDeletePracticeId(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-gray-900 mb-2">Delete this interview practice?</h3>
            <p className="text-sm md:text-xs text-gray-600 mb-5">This removes the Power Analysis and coached stories. The job card stays in your Job Tracker and you can restart practice anytime.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeletePracticeId(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm md:text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeletePractice(confirmDeletePracticeId)}
                disabled={deletingPracticeId === confirmDeletePracticeId}
                className="flex-1 px-4 py-2 bg-[#e57373] text-white rounded-lg hover:opacity-90 transition-opacity text-sm md:text-xs font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deletingPracticeId === confirmDeletePracticeId ? (
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
        <HubTour isPro={isPro} onStepChange={setHubTourStepId} onClose={closeHubTour} />
      )}

      <ErrorToast message={errorToast} onClose={() => setErrorToast(null)} />
      <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
    </div>
  );
}

// ============================================================================
// Practice Card Component
// One primary button for the recommended next step, plus an "Other Steps"
// dropdown for jumping anywhere else in the flow.
// ============================================================================
// `compact` tightens the row so the card fits the narrower max-w-lg modal.
// The hub renders without it and is unaffected.

// Feedback isn't built yet. Flip this on once the step exists so it can become
// the recommended next step after practice.
const FEEDBACK_STEP_BUILT = false;

// The detail page names its steps differently from the card's dropdown keys,
// so current_step is translated on the way in rather than renaming either side.
const STEP_FROM_DETAIL = {
  analyze: 'analysis',
  research: 'research',
  prepare: 'prepare',
  practice: 'practice',
};

// The detail page's order, and the dropdown key each position maps to. Used to
// decide how far down the flow a card has been.
const DETAIL_STEP_ORDER = ['analyze', 'research', 'prepare', 'practice'];
const STEP_TO_DETAIL = {
  analysis: 'analyze',
  research: 'research',
  prepare: 'prepare',
  practice: 'practice',
};

const STEP_DISPLAY_NAMES = {
  analysis: 'Analysis',
  research: 'Research',
  prepare: 'Prep',
  practice: 'Practice',
  feedback: 'Feedback',
};

// `canDelete` is off for free accounts: the analysis behind a card is counted
// whether or not the card is still there, so throwing one away would only cost
// them the work and give nothing back.
function PracticeCard({ card, onClick, onDeleteRequest, canDelete = true, compact = false }) {
  const router = useRouter();
  const [navigatingTo, setNavigatingTo] = useState(null);

  const hasAnalyzed = true; // card only appears if PA exists

  const interviewIsUpcoming = card.interviewDate && new Date(card.interviewDate).getTime() > Date.now();
  const interviewIsPast = card.interviewDate && new Date(card.interviewDate).getTime() < Date.now();

  // The high-water mark is what decides the next step, not current_step: a
  // card whose owner clicked back to an earlier step should still be pointed
  // forward. A mark we don't recognise reads as the first step.
  //
  // 'coach' is a mark from before that step came out of the flow, where it was
  // the last one: a card that reached it reached the end, which leaves Practice
  // — the repeatable step — as the one to go back to.
  const markIndex = card.highestStepReached === 'coach'
    ? DETAIL_STEP_ORDER.length - 1
    : DETAIL_STEP_ORDER.indexOf(card.highestStepReached || 'analyze');
  const reachedIndex = markIndex === -1 ? 0 : markIndex;

  // One past the mark, capped at the last step. Practice is the repeatable
  // one, so a card that has reached it keeps being sent back to it.
  const primaryStep = STEP_FROM_DETAIL[
    DETAIL_STEP_ORDER[Math.min(reachedIndex + 1, DETAIL_STEP_ORDER.length - 1)]
  ];

  const primaryLabel = `Go to ${STEP_DISPLAY_NAMES[primaryStep] || 'Analysis'}`;

  // The dropdown is for going back, not skipping ahead, so it stops at the
  // furthest step they've actually reached. Bare names: everything listed has
  // been reached, so a tick against each one said nothing the filter hadn't
  // already said.
  const otherSteps = [
    { key: 'analysis', label: 'Analysis' },
    { key: 'research', label: 'Research' },
    { key: 'prepare', label: 'Prep' },
    { key: 'practice', label: 'Practice' },
  ]
    .filter(step => {
      const index = DETAIL_STEP_ORDER.indexOf(STEP_TO_DETAIL[step.key]);
      // Feedback isn't in the flow yet, so it has no position to compare.
      return index !== -1 && index <= reachedIndex;
    })
    .filter(step => step.key !== primaryStep);

  // A query param rather than a fragment: the App Router keeps search params
  // across a push and exposes them synchronously, where a hash had to be read
  // from window after mount and raced the detail page's own load.
  const goToDetail = (e, stepKey) => {
    if (e) e.stopPropagation();
    const step = STEP_TO_DETAIL[stepKey];
    const url = step
      ? `/interview/${card.jobCardId}?step=${step}`
      : `/interview/${card.jobCardId}`;
    router.push(url);
  };

  return (
    <div
      className="group border border-gray-200 rounded-lg px-3 py-2.5 hover:border-purple-300 hover:shadow-sm transition-all cursor-pointer overflow-hidden flex items-center"
      style={{ height: '66px' }}
      onClick={onClick}
    >
      {/* Single row: title + score + step buttons + delete */}
      <div className={`flex items-center w-full ${compact ? 'gap-2' : 'gap-3'}`}>
        <div className={`min-w-0 md:flex-shrink-0 ${compact ? 'md:w-24' : 'md:w-36'}`}>
          <div className="text-base md:text-sm font-semibold text-gray-900 truncate">
            {card.title}
            {interviewIsUpcoming && (
              <span className="ml-2 text-xs md:text-[9px] bg-purple-100 text-purple-700 font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">
                Upcoming
              </span>
            )}
            {interviewIsPast && (
              <span className="ml-2 text-xs md:text-[9px] bg-gray-100 text-gray-500 font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">
                Past
              </span>
            )}
          </div>
          <div className="text-sm md:text-xs text-gray-500 truncate">{card.company}</div>
        </div>

        {card.matchScore && (
          <div className="relative w-8 h-8 flex-shrink-0">
            <svg className="w-8 h-8 transform -rotate-90">
              <circle cx="16" cy="16" r="12" stroke="#e5e7eb" strokeWidth="2.5" fill="none" />
              <circle
                cx="16" cy="16" r="12"
                stroke={getCircleColor(card.matchScore)}
                strokeWidth="2.5" fill="none"
                strokeDasharray={`${2 * Math.PI * 12}`}
                strokeDashoffset={`${2 * Math.PI * 12 * (1 - card.matchScore / 100)}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-[9px] font-bold" style={{ color: getCircleColor(card.matchScore) }}>
                {card.matchScore}%
              </div>
            </div>
          </div>
        )}

        {/* Label + primary step + jump menu, one row. ml-auto floats the group
            right, up against the delete button; title and score stay left. */}
        <div className={`ml-auto min-w-0 flex items-center ${compact ? 'gap-1.5' : 'gap-2'}`}>
          <span className={`flex-shrink-0 self-center flex flex-col items-center justify-center text-center text-gray-400 uppercase tracking-wide leading-tight ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
            <span>Current</span>
            <span>Step</span>
          </span>

          <button
            onClick={(e) => { setNavigatingTo(primaryStep); goToDetail(e, primaryStep); }}
            disabled={!!navigatingTo}
            className={`flex-shrink-0 rounded-md py-1.5 font-semibold text-white whitespace-nowrap flex items-center justify-center gap-1.5 transition-opacity hover:opacity-90 disabled:opacity-50 ${
              compact ? 'min-w-[125px] px-4 text-xs md:text-[11px]' : 'min-w-[150px] px-6 text-sm md:text-xs'
            }`}
            style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
          >
            {navigatingTo === primaryStep && (
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-r-transparent border-white"></div>
            )}
            <span>{primaryLabel}</span>
          </button>

          {/* Value stays '' so the disabled placeholder keeps showing as the
              label — this is a jump menu, not a stored selection. Always
              rendered, so every card keeps the same shape; with nowhere to
              jump yet it explains itself rather than opening empty. */}
          <select
            value=""
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              const key = e.target.value;
              if (!key) return;
              setNavigatingTo(key);
              goToDetail(e, key);
            }}
            disabled={!!navigatingTo}
            className={`flex-shrink-0 border border-gray-300 bg-white rounded-md py-1.5 text-gray-600 cursor-pointer hover:bg-gray-100 focus:outline-none disabled:opacity-50 ${
              compact ? 'w-[110px] px-1.5 text-xs md:text-[11px]' : 'w-[130px] px-2 text-sm md:text-xs'
            }`}
          >
            <option value="" disabled>Other Steps</option>
            {otherSteps.length > 0 ? (
              otherSteps.map(({ key, label }) => (
                <option key={key} value={key}>{label}</option>
              ))
            ) : (
              <option value="" disabled>
                Complete {STEP_DISPLAY_NAMES[primaryStep] || 'Analysis'} first
              </option>
            )}
          </select>
        </div>

        {/* Delete */}
        {canDelete && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteRequest(); }}
              className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-full bg-[#fdecea] hover:bg-[#e57373] flex items-center justify-center text-[#e57373] hover:text-white transition-all flex-shrink-0"
              title="Delete practice"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        )}
      </div>

    </div>
  );
}

function ChecklistItem({ label }) {
  const [checked, setChecked] = useState(false);
  return (
    <button
      onClick={() => setChecked(!checked)}
      className="w-full flex items-center gap-3 p-1.5 rounded-lg hover:bg-gray-50 transition-colors text-left"
    >
      <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${
        checked ? 'bg-purple-600 border-purple-600' : 'border-gray-300 bg-white'
      }`}>
        {checked && (
          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <span className={`text-sm md:text-xs transition-colors ${checked ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
        {label}
      </span>
    </button>
  );
}
