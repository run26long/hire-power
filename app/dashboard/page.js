'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import MainNav from '../components/MainNav';

// ── Helpers ───────────────────────────────────────────────────────────────────
function scoreColor(s) { return !s ? '#9ca3af' : s >= 85 ? '#10b981' : s >= 71 ? '#f59e0b' : '#ef4444'; }
function scoreBg(s)    { return !s ? '#f3f4f6' : s >= 85 ? '#ecfdf5' : s >= 71 ? '#fffbeb' : '#fef2f2'; }
function scoreLabel(s) { return !s ? 'Not assessed' : s >= 85 ? 'Excellent' : s >= 71 ? 'Strong' : 'Needs work'; }

const STEPS_PRO  = ['review','assess','coach','improve','polish','save'];
const STEPS_FREE = ['review','assess','coach','improve','save'];
const STEP_LABEL = { review:'Review', assess:'Assess', coach:'Coach', improve:'Improve', polish:'Polish', save:'Save', complete:'Complete' };
const STEP_BTN   = { review:'Start Review', assess:'Assess Resume', coach:'Start Coaching', improve:'Improve Resume', polish:'Polish Resume', save:'Download', complete:'Open Resume' };

function stepPct(step, isPro) {
  const steps = isPro ? STEPS_PRO : STEPS_FREE;
  const i = steps.indexOf(step);
  return i < 0 ? (step === 'complete' ? 100 : 0) : Math.round(((i+1)/steps.length)*100);
}

const GRAD  = 'linear-gradient(135deg,#667eea,#764ba2)';
const GRAD2 = 'linear-gradient(135deg,#764ba2,#667eea)';

// ── Resume skeleton (zero black) ──────────────────────────────────────────────
function ResumeSkeleton() {
  return (
    <div style={{ padding:'12px 10px 10px', background:'#fff', height:'100%' }}>
      {/* Name — purple, not black */}
      <div style={{ height:8, background:'#667eea', width:'55%', borderRadius:2, marginBottom:3 }}/>
      <div style={{ height:4, background:'#c4b5fd', width:'75%', borderRadius:2, marginBottom:8 }}/>
      {/* Rule */}
      <div style={{ height:1.5, background:GRAD, width:'100%', marginBottom:6 }}/>
      {/* Section labels */}
      {[['30%','30px'],['22%','22px']].map(([w,mt],si) => (
        <div key={si} style={{ marginTop:si===0?0:8 }}>
          <div style={{ height:5, background:'#764ba2', width:w, borderRadius:1.5, marginBottom:5 }}/>
          {[88,94,76,si===0?82:65,si===0?70:55].map((bw,i)=>(
            <div key={i} style={{ height:3.5, background:'#ede9fe', width:`${bw}%`, borderRadius:1.5, marginBottom:3 }}/>
          ))}
        </div>
      ))}
      <div style={{ marginTop:8 }}>
        <div style={{ height:5, background:'#764ba2', width:'18%', borderRadius:1.5, marginBottom:5 }}/>
        {[70,85].map((bw,i)=>(
          <div key={i} style={{ height:3.5, background:'#ede9fe', width:`${bw}%`, borderRadius:1.5, marginBottom:3 }}/>
        ))}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router  = useRouter();
  const supabase = createClient();
  const [userProfile, setUserProfile] = useState(null);
  const [careerCtx,   setCareerCtx]   = useState(null);
  const [resumes,     setResumes]      = useState([]);
  const [loading,     setLoading]      = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const [p, r, c] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('resumes').select('*').eq('user_id', user.id).eq('is_active', true).order('updated_at', { ascending: false }),
        supabase.from('career_context').select('*').eq('user_id', user.id).maybeSingle(),
      ]);
      setUserProfile(p.data);
      setResumes(r.data || []);
      setCareerCtx(c.data);
      setLoading(false);
    })();
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin h-8 w-8 border-4 border-purple-600 border-t-transparent rounded-full"/>
    </div>
  );

  const isPro     = userProfile?.subscription_tier === 'pro';
  const isVault   = userProfile?.subscription_tier === 'vault';
  const hasCareer = !!careerCtx?.completed_at;
  const core      = resumes.find(r => r.resume_type === 'core');
  const jobRes    = resumes.filter(r => r.resume_type === 'job_specific');
  const coreStep  = core?.journey_step || 'review';
  const corePct   = core ? stepPct(coreStep, isPro) : 0;
  const coreScore = core?.current_score;

  return (
    <div className="h-screen bg-gray-50 flex">

      {/* ── SIDEBAR ── */}
      <div className="w-64 text-white flex flex-col fixed left-0 top-0 shadow-lg z-40"
        style={{ background:'linear-gradient(180deg,#667eea 0%,#764ba2 100%)', height:'100vh', overflowY:'hidden' }}>
        <div className="px-6 pt-6 pb-4 flex-shrink-0">
          <h1 className="text-[28px] font-bold mb-1.5 whitespace-nowrap tracking-tight">Dashboard</h1>
          <p className="text-[13px] leading-tight tracking-tight mb-0.5">Job hunting is small talk.</p>
          <p className="text-[13px] leading-tight tracking-tight">Your career deserves a conversation.</p>
          <div className="mt-4 border-b border-white border-opacity-10"/>
        </div>
        <div className="flex-1 px-6 pt-3 pb-6 flex flex-col justify-between overflow-hidden">
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider opacity-50 mb-3">What Hire Power Does</h4>
            <ul className="space-y-3">
              {[
                { l:'Bulletproof your resume',  s:"We find achievements you didn't know you had." },
                { l:'Level up your interviews', s:'AI questions built from your actual resume.' },
                { l:'Build your career',        s:'Log wins as they happen. Stay ready for life.' },
              ].map(item => (
                <li key={item.l} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 opacity-40">•</span>
                  <div>
                    <p className="font-semibold leading-tight">{item.l}</p>
                    <p className="text-[11px] opacity-60 leading-tight mt-0.5">{item.s}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="my-4 border-b border-white border-opacity-10"/>
            <div className="bg-white bg-opacity-10 rounded-lg p-3">
              <p className="text-[10px] opacity-60 mb-1.5 uppercase tracking-wide font-bold">Not AI generation. Coaching.</p>
              <p className="text-[11px] opacity-70 italic mb-2">Other tools: "Tell us your job" → AI rewrites it</p>
              <p className="text-[11px] leading-snug">We ask: "How many students did you teach?" → your real achievements, extracted through conversation</p>
            </div>
          </div>
          <div>
            <div className="mb-3 border-b border-white border-opacity-10"/>
            <p className="text-[11px] opacity-60 italic leading-relaxed mb-3">"Most tools help you find a job. Ours helps you build a career."</p>
            <div className="flex items-center gap-2">
              <img src="/images/Hire_Power_icon.png" alt="Hire Power" className="h-5 w-auto flex-shrink-0"/>
              <p className="text-sm font-medium">Your lifelong career coach</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN ── */}
      <div className="ml-64 flex-1 flex flex-col h-screen overflow-hidden">
        <MainNav currentPage="dashboard" userProfile={userProfile}/>
        <div className="flex-1 overflow-y-auto bg-gray-50">
          <div className="px-8 py-5 max-w-[1400px] mx-auto w-full space-y-4">

            {/* ══════════════ TOP ROW ══════════════ */}
            <div className="grid grid-cols-12 gap-4">

              {/* ── CAREER COACH col-4 ── */}
              <div className="col-span-4">
                <div className="bg-white rounded-xl border border-gray-100 h-full flex flex-col overflow-hidden"
                  style={{ boxShadow:'0 1px 4px rgba(0,0,0,0.05)' }}>

                  {/* Gradient accent header */}
                  <div className="px-5 pt-5 pb-4 relative overflow-hidden"
                    style={{ background:'linear-gradient(135deg,rgba(102,126,234,0.07),rgba(118,75,162,0.04))' }}>
                    {/* Decorative chat bubbles — illustrative, not cheesy */}
                    <div className="absolute right-4 top-3 opacity-10">
                      <svg width="64" height="44" viewBox="0 0 64 44" fill="none">
                        <rect x="0" y="12" width="38" height="20" rx="10" fill="#667eea"/>
                        <rect x="22" y="0" width="42" height="20" rx="10" fill="#764ba2"/>
                        <rect x="8" y="26" width="30" height="16" rx="8" fill="#667eea"/>
                      </svg>
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ color: hasCareer ? '#059669':'#7c3aed', background: hasCareer ? '#ecfdf5':'#ede9fe' }}>
                        {hasCareer ? '✓ Complete' : 'Start here — free'}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-gray-900 leading-tight mb-0.5">Career Coach</h3>
                    <p className="text-xs font-semibold text-purple-600">A better resume starts with a conversation.</p>
                  </div>

                  <div className="px-5 pb-5 flex-1 flex flex-col justify-between">
                    {hasCareer ? (
                      <>
                        <div className="pt-3 space-y-1.5 mb-4">
                          <p className="text-[11px] text-gray-400 mb-2.5 leading-relaxed">
                            Your goals are locked in. Every coaching session now points toward where you want to go.
                          </p>
                          {careerCtx?.current_role && (
                            <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide w-10 flex-shrink-0">Now</span>
                              <p className="text-xs font-medium text-gray-700 leading-tight truncate">
                                {careerCtx.current_role}{careerCtx.current_company && <span className="text-gray-400"> · {careerCtx.current_company}</span>}
                              </p>
                            </div>
                          )}
                          {careerCtx?.target_roles?.length > 0 && (
                            <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide w-10 flex-shrink-0">Goal</span>
                              <p className="text-xs font-medium text-gray-700 leading-tight truncate">{careerCtx.target_roles.slice(0,2).join(', ')}</p>
                            </div>
                          )}
                          {careerCtx?.is_career_changer && (
                            <span className="inline-block text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full mt-1">Career Transition</span>
                          )}
                        </div>
                        <button onClick={() => router.push('/my-career')}
                          className="text-xs font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1 transition-colors">
                          Update goals →
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-gray-500 leading-relaxed pt-3 mb-4">
                          5 minutes before your resume. We learn where you're headed — career change, same field, or figuring it out. Everything we do after will be smarter for it.
                        </p>
                        <button onClick={() => router.push('/my-career')}
                          className="w-full text-xs font-semibold text-white py-2.5 rounded-lg transition-colors"
                          style={{ background: GRAD }}>
                          Start the Conversation →
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* ── RESUME COACH col-8 ── */}
              <div className="col-span-8">
                <div className="bg-white rounded-xl border border-gray-100 h-full flex flex-col overflow-hidden"
                  style={{ boxShadow:'0 1px 4px rgba(0,0,0,0.05)' }}>

                  {/* Gradient accent header */}
                  <div className="px-5 pt-5 pb-4 relative overflow-hidden"
                    style={{ background:'linear-gradient(135deg,rgba(102,126,234,0.07),rgba(118,75,162,0.04))' }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-bold text-gray-900 leading-tight mb-0.5">Resume Coach</h3>
                        <p className="text-xs font-semibold text-purple-600">Bulletproof your resume.</p>
                      </div>
                      <button onClick={() => router.push('/my-resumes')}
                        className="text-[11px] font-semibold text-purple-600 hover:text-purple-700 transition-colors flex-shrink-0">
                        View all →
                      </button>
                    </div>
                  </div>

                  <div className="px-5 pb-5 pt-4 flex-1 flex flex-col min-h-0">

                    {!core ? (
                      /* Empty */
                      <div className="flex-1 flex flex-col">
                        <p className="text-xs text-gray-500 leading-relaxed mb-4">
                          Not just a formatter. We have a conversation that uncovers quantifiable achievements you forgot were impressive — then we rebuild your bullets from there.
                        </p>
                        <div onClick={() => router.push('/my-resumes')}
                          className="flex-1 rounded-xl border-2 border-dashed border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-colors cursor-pointer flex flex-col items-center justify-center gap-2 py-6">
                          <div className="w-9 h-11 rounded border border-gray-200 flex items-center justify-center" style={{ background:'#f9fafb' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c4b5fd" strokeWidth="1.5"><path d="M12 4v16m8-8H4" strokeLinecap="round"/></svg>
                          </div>
                          <p className="text-sm font-medium text-gray-400">Upload your resume to begin</p>
                          <p className="text-[11px] text-gray-300">PDF or DOCX</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col gap-4 min-h-0">

                        {/* ── Core resume: real thumbnail LEFT, details RIGHT ── */}
                        <div className="flex gap-4" style={{ minHeight: 170 }}>

                          {/* Thumbnail — full-height document */}
                          <div onClick={() => router.push(`/resume/${core.id}`)}
                            className="flex-shrink-0 cursor-pointer group relative"
                            style={{ width: 120 }}>
                            <div className="w-full h-full overflow-hidden rounded-lg border border-gray-200 group-hover:border-purple-300 transition-colors"
                              style={{ aspectRatio:'8.5/11', boxShadow:'0 2px 10px rgba(102,126,234,0.12)' }}>
                              {core.thumbnail_url ? (
                                <img src={core.thumbnail_url} alt="Resume" className="w-full h-full object-cover object-top"/>
                              ) : (
                                <ResumeSkeleton/>
                              )}
                            </div>
                            {/* Hover overlay */}
                            <div className="absolute inset-0 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              style={{ background:'rgba(102,126,234,0.25)' }}>
                              <span className="text-white text-[11px] font-bold drop-shadow">Open →</span>
                            </div>
                          </div>

                          {/* Details */}
                          <div className="flex-1 flex flex-col justify-between min-w-0">
                            <div>
                              <p className="text-sm font-semibold text-gray-800 leading-tight mb-0.5 truncate">{core.display_name || 'Core Resume'}</p>
                              <p className="text-[11px] text-gray-400 mb-3">
                                {coreStep === 'complete' ? 'Complete' : `Up next: ${STEP_LABEL[coreStep]}`}
                              </p>

                              {/* Score */}
                              {coreScore ? (
                                <div className="flex items-center gap-2 mb-4">
                                  <span className="text-4xl font-bold tabular-nums" style={{ color: scoreColor(coreScore) }}>{coreScore}</span>
                                  <div>
                                    <p className="text-xs font-bold leading-tight" style={{ color: scoreColor(coreScore) }}>{scoreLabel(coreScore)}</p>
                                    <p className="text-[10px] text-gray-400">Resume Power Score</p>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 mb-4">
                                  <span className="text-3xl font-bold text-gray-200">--</span>
                                  <p className="text-[11px] text-gray-400">Not yet assessed</p>
                                </div>
                              )}
                            </div>

                            {/* Progress + CTA */}
                            <div>
                              <div className="flex items-center gap-2 mb-1.5">
                                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background:'#ede9fe' }}>
                                  <div className="h-full rounded-full transition-all duration-500"
                                    style={{ width:`${corePct}%`, background: coreStep==='complete' ? '#10b981' : GRAD }}/>
                                </div>
                                <span className="text-[10px] text-gray-400 w-7 text-right">{corePct}%</span>
                              </div>
                              {/* Step pills */}
                              <div className="flex gap-0.5 mb-3">
                                {(isPro ? STEPS_PRO : STEPS_FREE).map((s,i) => {
                                  const idx = (isPro ? STEPS_PRO : STEPS_FREE).indexOf(coreStep);
                                  return <div key={s} className="h-1 flex-1 rounded-full" style={{ background: i<=idx ? '#667eea':'#ede9fe' }}/>;
                                })}
                              </div>
                              <button onClick={() => router.push(`/resume/${core.id}`)}
                                className="text-[11px] font-semibold text-white px-4 py-2 rounded-lg transition-colors"
                                style={{ background: GRAD }}>
                                {STEP_BTN[coreStep]} →
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* ── Job-specific: clean pill cards ── */}
                        {(jobRes.length > 0 || coreStep === 'complete') && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Job-Specific Resumes</p>
                              {!isPro && <span className="text-[10px] font-semibold text-purple-500 bg-purple-50 px-2 py-0.5 rounded-full">Pro</span>}
                            </div>
                            <div className="flex gap-2 flex-wrap">
                              {jobRes.slice(0,4).map(r => (
                                <div key={r.id}
                                  onClick={() => router.push(`/resume/${r.id}`)}
                                  className="cursor-pointer rounded-lg border border-gray-100 hover:border-purple-200 hover:shadow-sm transition-all px-3 py-2.5 flex items-center gap-2.5 bg-gray-50 hover:bg-white"
                                  style={{ minWidth:130 }}>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-semibold text-gray-800 truncate leading-tight">{r.job_title || r.display_name}</p>
                                    {r.job_company && <p className="text-[10px] text-gray-400 truncate">{r.job_company}</p>}
                                  </div>
                                  {r.current_score && (
                                    <span className="text-[11px] font-bold flex-shrink-0 px-1.5 py-0.5 rounded-md"
                                      style={{ color: scoreColor(r.current_score), background: scoreBg(r.current_score) }}>
                                      {r.current_score}
                                    </span>
                                  )}
                                </div>
                              ))}
                              <div onClick={() => router.push('/my-resumes')}
                                className="cursor-pointer rounded-lg border border-dashed border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-all px-3 py-2.5 flex items-center gap-1.5 bg-gray-50"
                                style={{ minWidth:72 }}>
                                <span className="text-purple-300 text-base font-light">+</span>
                                <span className="text-[11px] text-gray-400">New</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ══════════════ BOTTOM ROW ══════════════ */}
            <div className="grid grid-cols-12 gap-4">

              {/* ── INTERVIEW COACH col-8 ── */}
              <div className="col-span-8">
                <div className="bg-white rounded-xl border border-gray-100 h-full flex flex-col overflow-hidden"
                  style={{ boxShadow:'0 1px 4px rgba(0,0,0,0.05)' }}>

                  <div className="px-5 pt-5 pb-4 relative overflow-hidden"
                    style={{ background:'linear-gradient(135deg,rgba(102,126,234,0.07),rgba(118,75,162,0.04))' }}>
                    {/* Decorative mic icon */}
                    <div className="absolute right-5 top-3 opacity-8">
                      <svg width="52" height="52" viewBox="0 0 24 24" fill="none" opacity="0.09">
                        <rect x="8" y="2" width="8" height="13" rx="4" fill="#667eea"/>
                        <path d="M5 10a7 7 0 0014 0" stroke="#764ba2" strokeWidth="2" strokeLinecap="round"/>
                        <path d="M12 17v4M9 21h6" stroke="#667eea" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-base font-bold text-gray-900 leading-tight">Interview Coach</h3>
                          {!isPro && <span className="text-[10px] font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">Pro</span>}
                        </div>
                        <p className="text-xs font-semibold text-purple-600">Level up your interviews.</p>
                      </div>
                    </div>
                  </div>

                  <div className="px-5 pb-5 pt-4 flex-1 flex flex-col">
                    <p className="text-xs text-gray-500 leading-relaxed mb-4">
                      Most people walk into interviews having practiced generic questions with generic answers. You'll walk in having practiced with an AI that knows your resume, your strengths, your gaps — and exactly what to say about each one.
                    </p>

                    {/* Power analysis cards — the visual anchor */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      {[
                        { label:'Core Power',  desc:'Your obvious strengths with the evidence to back them up',          color:'#059669', bg:'#ecfdf5', border:'#a7f3d0' },
                        { label:'Hidden Power', desc:"Skills you actually have but don't know how to talk about",         color:'#d97706', bg:'#fffbeb', border:'#fde68a' },
                        { label:'Power Gaps',   desc:"What's missing — and exactly how to address it without apologizing", color:'#dc2626', bg:'#fef2f2', border:'#fecaca' },
                      ].map(p => (
                        <div key={p.label} className="rounded-xl p-4 relative overflow-hidden"
                          style={{ background:p.bg, border:`1px solid ${p.border}` }}>
                          {!isPro && (
                            <div className="absolute inset-0 bg-white bg-opacity-55 backdrop-blur-[1.5px] flex items-center justify-center rounded-xl z-10">
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Pro</span>
                            </div>
                          )}
                          <div className="w-5 h-5 rounded-full mb-2.5 flex items-center justify-center" style={{ background:p.color }}>
                            <div className="w-1.5 h-1.5 rounded-full bg-white"/>
                          </div>
                          <p className="text-[11px] font-bold mb-1" style={{ color:p.color }}>{p.label}</p>
                          <p className="text-[11px] text-gray-600 leading-tight">{p.desc}</p>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-3 mt-auto">
                      <button onClick={() => router.push(isPro ? '/interview-practice' : '/pricing')}
                        className="text-xs font-semibold text-white px-5 py-2.5 rounded-lg transition-colors flex-shrink-0"
                        style={{ background: GRAD }}>
                        {isPro ? 'Start Interview Prep →' : 'Upgrade to Pro →'}
                      </button>
                      {!isPro && (
                        <p className="text-[11px] text-gray-400 leading-snug">
                          Stop practicing into a mirror. Your first real session shouldn't be the actual interview.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── CAREER VAULT col-4 ── */}
              <div className="col-span-4">
                <div className="bg-white rounded-xl border border-gray-100 h-full flex flex-col overflow-hidden"
                  style={{ boxShadow:'0 1px 4px rgba(0,0,0,0.05)' }}>

                  <div className="px-5 pt-5 pb-4 relative overflow-hidden"
                    style={{ background:'linear-gradient(135deg,rgba(102,126,234,0.07),rgba(118,75,162,0.04))' }}>
                    {/* Decorative lock */}
                    <div className="absolute right-4 top-2 opacity-8">
                      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" opacity="0.1">
                        <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" stroke="#667eea" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-bold text-gray-900 leading-tight mb-0.5">Career Vault</h3>
                        <p className="text-xs font-semibold text-purple-600">Track your wins. Stay ready for life.</p>
                      </div>
                      {!isVault && !isPro && (
                        <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full flex-shrink-0">$4.99/mo</span>
                      )}
                    </div>
                  </div>

                  <div className="px-5 pb-5 pt-4 flex-1 flex flex-col justify-between">
                    <div>
                      {/* Quote callout */}
                      <div className="rounded-lg p-3 mb-3" style={{ background:'rgba(102,126,234,0.06)', borderLeft:'3px solid #667eea' }}>
                        <p className="text-xs text-gray-600 leading-relaxed italic">
                          "Three years from now, you'll sit down to update your resume — and you won't remember half of what you accomplished."
                        </p>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed mb-3">
                        Log a win in 30 seconds. A raise, a project, a compliment from your boss. When you need a resume — for a raise, a pivot, your next role — everything is already waiting.
                      </p>
                      {/* Sample logged wins — illustrative if no data */}
                      <div className="space-y-1.5">
                        {[
                          { label:'Led Q3 product launch across 3 teams' },
                          { label:'Promoted to Senior in 18 months' },
                          { label:'Cut onboarding time from 3 weeks to 5 days' },
                        ].map((win, i) => (
                          <div key={i} className="flex items-center gap-2 rounded-lg px-3 py-2"
                            style={{ background: (isVault || isPro) ? '#f9fafb' : 'rgba(102,126,234,0.04)', opacity: (isVault || isPro) ? 1 : 0.5 }}>
                            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background:'#667eea' }}/>
                            <p className="text-[11px] text-gray-600 truncate">{win.label}</p>
                          </div>
                        ))}
                        {(!isVault && !isPro) && (
                          <p className="text-[10px] text-gray-400 text-center pt-0.5">Your wins will live here.</p>
                        )}
                      </div>
                    </div>

                    <div className="mt-4">
                      {isVault || isPro ? (
                        <button onClick={() => router.push('/career-archive')}
                          className="w-full text-xs font-semibold text-white py-2.5 rounded-lg transition-colors"
                          style={{ background: GRAD }}>
                          Open Career Archive →
                        </button>
                      ) : (
                        <div>
                          <button onClick={() => router.push('/pricing')}
                            className="w-full text-xs font-semibold text-white py-2.5 rounded-lg transition-colors mb-1.5"
                            style={{ background: GRAD }}>
                            Get Vault — $4.99/mo →
                          </button>
                          <p className="text-[10px] text-gray-400 text-center">No scrambling. No forgetting. Just wins on demand.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}