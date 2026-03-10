'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import MainNav from '../components/MainNav';

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [careerContext, setCareerContext] = useState(null);
  const [coreResume, setCoreResume] = useState(null);
  const [jobResumes, setJobResumes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      setUser(user);

      const { data: profile } = await supabase
        .from('profiles').select('*').eq('id', user.id).single();
      setUserProfile(profile);

      const { data: context } = await supabase
        .from('career_context').select('*').eq('user_id', user.id).maybeSingle();
      setCareerContext(context);

      const { data: resumes } = await supabase
        .from('resumes').select('*').eq('user_id', user.id)
        .eq('resume_type', 'core')
        .order('updated_at', { ascending: false }).limit(1);
      if (resumes && resumes.length > 0) setCoreResume(resumes[0]);

      const { data: jsResumes } = await supabase
        .from('resumes').select('*').eq('user_id', user.id)
        .eq('resume_type', 'job_specific')
        .order('updated_at', { ascending: false }).limit(3);
      if (jsResumes) setJobResumes(jsResumes);

      setLoading(false);
    }
    loadData();
  }, []);

  const journeyStep = coreResume?.journey_step || null;
  const hasCareer = !!careerContext;
  const hasResume = !!coreResume;
  const isPro = false;

  function StatusPill({ status }) {
    const map = {
      'Start Here':  { bg: '#f3f4f6', border: '#d1d5db', color: '#6b7280' },
      'Not Started': { bg: '#f3f4f6', border: '#d1d5db', color: '#6b7280' },
      'In Progress': { bg: '#fffbeb', border: '#fcd34d', color: '#92400e' },
      'Completed':   { bg: '#f0fdf4', border: '#86efac', color: '#166534' },
    };
    const s = map[status] || map['Not Started'];
    return (
      <span style={{
        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
        background: s.bg, border: `1.5px solid ${s.border}`, color: s.color,
        letterSpacing: '0.02em',
      }}>
        {status}
      </span>
    );
  }

  const careerStatus = hasCareer ? 'Completed' : 'Start Here';
  const resumeStatus = !hasResume ? 'Not Started' : coreResume?.completed_at ? 'Completed' : 'In Progress';
  const interviewStatus = 'Not Started';
  const vaultStatus = 'Not Started';

  function getCareerAdaptiveCopy() {
    if (!careerContext) return null;
    if (careerContext.is_career_changer) {
      const from = careerContext.previous_field || 'your background';
      const to = careerContext.target_roles?.length > 0 ? careerContext.target_roles[0] : 'your target role';
      return `We'll reframe your ${from} experience to speak directly to ${to} opportunities.`;
    }
    return "We'll position you to move up — not just move on.";
  }

  function getResumeNextStep() {
    if (!hasResume) return { title: 'Start here.', body: 'Upload your resume to get your baseline Power Score and see exactly what needs to improve.' };
    if (coreResume?.completed_at) return { title: 'Ready to interview.', body: 'Your resume is done. Head to Interview Coach — it already knows your resume, your strengths, and your gaps.' };
    const map = {
      review:  { title: 'First things first.', body: "Give it a quick review to make sure everything parsed correctly — then we'll get your baseline score." },
      assess:  { title: 'Get your baseline.', body: "Your Resume Power Score tells you exactly what's working and what's not — specific to your experience." },
      coach:   { title: 'Keep going.', body: isPro ? "Let's surface the achievements, numbers, and skills that are missing." : "Get a taste of what coaching can do. One job, one real conversation — then you decide." },
      improve: { title: 'Review your wins.', body: isPro ? "Review each improvement your coach made, then keep, edit, or reject each one." : "Review the suggestions and make your edits directly on the resume." },
      polish:  { title: 'Almost there.', body: "Make any final edits before locking it in." },
      save:    { title: 'Final step.', body: isPro ? "Download it, then build job-specific versions on top of this foundation." : "Download it now — and when you're ready, upload a job description to see how well it matches." },
    };
    return map[journeyStep] || { title: 'Keep going.', body: 'Pick up where you left off.' };
  }

  const resumeNext = getResumeNextStep();

  const sidebarSteps = [
    { num: '01', label: 'Career Coach',    sub: 'Clarify your direction — same field, new field, or somewhere in between.', path: '/my-career'     },
    { num: '02', label: 'Résumé Coach',    sub: 'Uncover the achievements and skills that never made it to the page.',      path: '/my-resumes'    },
    { num: '03', label: 'Interview Coach', sub: 'Learn how to explain your experience with confidence.',                     path: '/my-interviews' },
    { num: '04', label: 'Career Vault',    sub: 'Capture your wins as they happen — never start from scratch again!',       path: null             },
  ];

  const labelStyle = { fontSize: 11, fontWeight: 900, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' };
  const valueStyle = { fontSize: 12, fontWeight: 500, color: '#1a1a2e', lineHeight: 1.3, marginTop: 2 };
  const labelStyleMuted = { fontSize: 11, fontWeight: 900, color: '#d1d5db', textTransform: 'uppercase', letterSpacing: '0.08em' };
  const valueStyleMuted = { fontSize: 12, fontWeight: 500, color: '#d1d5db', lineHeight: 1.3, marginTop: 2 };
  const numStyle = { fontSize: 13, fontWeight: 900, color: '#a78bfa', marginRight: 6 };

  const nextStepStyle = {
    background: 'linear-gradient(150deg,#f5f3ff 0%,#ede9fe 100%)',
    border: '1px solid #ddd6fe',
    borderRadius: 12,
    padding: '14px 16px',
    display: 'flex', flexDirection: 'column', flex: 1,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-purple-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex">

      {/* SIDEBAR */}
      <div
        className="w-64 text-white flex flex-col fixed left-0 top-0 shadow-lg z-40"
        style={{ background: 'linear-gradient(180deg, #667eea 0%, #764ba2 100%)', height: '100vh', overflowY: 'hidden' }}
      >
        <div className="px-6 pt-6 pb-4 flex-shrink-0">
          <h1 className="text-[28px] font-bold mb-1.5 whitespace-nowrap tracking-tight">Dashboard</h1>
          <p className="text-[13px] text-white text-opacity-95 leading-tight tracking-tight mb-0.5">Job hunting is small talk.</p>
          <p className="text-[13px] text-white text-opacity-95 leading-tight tracking-tight">Your career deserves a conversation.</p>
          <div className="mt-4 border-b border-gray-400 border-opacity-10"></div>
        </div>

        <div className="flex-1 px-6 pt-3 pb-6 flex flex-col justify-between">
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#fff', lineHeight: 1.3, marginBottom: 6, marginTop: -4 }}>
              AI-powered coaching for people who want more than their next job.
            </p>
            <p style={{ fontSize: 12, fontWeight: 400, color: 'rgba(255,255,255,0.8)', lineHeight: 1.3, marginBottom: 12 }}>
              Building your career, one conversation at a time.
            </p>
            <div className="mb-4">
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
                {sidebarSteps.map((item) => (
                  <li key={item.num} onClick={() => item.path && router.push(item.path)}
                    style={{ cursor: item.path ? 'pointer' : 'default', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ width: 18, height: 22, borderRadius: 5, background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 900, color: '#fff', flexShrink: 0, marginTop: 1 }}>
                      {item.num}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>{item.label}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', lineHeight: 1.3, marginTop: 1 }}>{item.sub}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-4 mb-2 border-b border-gray-400 border-opacity-10"></div>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginBottom: 4 }}>Hire Power isn't just for this job search.</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)', lineHeight: 1.4 }}>
              It's the operating system for your career — tracking your growth and capturing your wins so you're always ready when your next opportunity appears.
            </p>
          </div>
          <div className="mt-auto">
            <div className="mb-3 border-b border-gray-400 border-opacity-10"></div>
            <div className="flex items-center gap-2.5 text-white">
              <img src="/images/Hire_Power_icon.png" alt="Lightning" className="h-5 w-auto flex-shrink-0" />
              <p className="text-sm font-medium leading-tight">Your lifelong career coach</p>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="ml-64 flex-1 flex flex-col h-screen overflow-hidden">
        <MainNav currentPage="dashboard" userProfile={userProfile} />

        <div className="flex-1 overflow-y-auto">
          <div className="px-8 py-3 max-w-[1400px] mx-auto w-full">

            {/* ROW 1 */}
            <div className="grid gap-2.5 mb-2.5" style={{ gridTemplateColumns: '1fr 2.2fr' }}>

              {/* ① CAREER COACH */}
              <div
                className="bg-white border border-gray-300 rounded-2xl overflow-hidden flex flex-col shadow-sm hover:border-purple-300 hover:shadow-md transition-all cursor-pointer"
                onClick={() => router.push('/my-career')}
              >
                <div className="p-3 pb-2 flex flex-col flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <div className="text-xl font-bold text-gray-900 tracking-tight">
                      <span style={numStyle}>01</span>Career Coach
                    </div>
                    <span className="ml-auto"><StatusPill status={careerStatus} /></span>
                  </div>
                  <div className="text-[13px] font-normal text-purple-600 mb-2">Point your job search in the right direction.</div>

                  {hasCareer ? (
                    <>
                      <div className="rounded-xl p-2.5 mb-2" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.06), rgba(99,102,241,0.06))', border: '1.5px solid rgba(124,58,237,0.18)' }}>
                        <div className="flex items-center gap-1.5 mb-2">
                          <div className="w-4 h-4 rounded-full bg-purple-600 flex items-center justify-center text-[9px] text-white font-bold flex-shrink-0">✓</div>
                          <span className="text-[13px] font-bold text-purple-700">Direction set</span>
                          {careerContext?.is_career_changer && (
                            <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#ede9fe', color: '#6d28d9' }}>Career Change</span>
                          )}
                        </div>
                        {careerContext?.target_roles?.length > 0 && (
                          <div className="mb-2">
                            <div style={labelStyle}>Targeting</div>
                            <div style={valueStyle}>{careerContext.target_roles.slice(0, 2).join(' · ')}</div>
                          </div>
                        )}
                        {careerContext?.timeline && (
                          <div className="mb-0">
                            <div style={labelStyle}>Timeline</div>
                            <div style={valueStyle} className="capitalize">{careerContext.timeline.replace(/_/g, ' ')}</div>
                          </div>
                        )}
                      </div>
                      {getCareerAdaptiveCopy() && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 10 }}>
                          <img src="/images/Hire_Power_icon_2.png" alt="" style={{ height: 22, width: 'auto', flexShrink: 0 }} />
                          <p style={{ fontSize: 11, fontWeight: 500, color: '#7c3aed', lineHeight: 1.35, marginBottom: 0 }}>
                            {getCareerAdaptiveCopy()}
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="rounded-xl p-2.5 mb-1.5" style={{ background: 'rgba(147,51,234,0.02)', border: '1.5px solid rgba(147,51,234,0.08)' }}>
                        <div className="flex items-center gap-1.5 mb-2">
                          <div className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center text-[9px] text-gray-400 font-bold flex-shrink-0">✓</div>
                          <span className="text-[13px] font-bold text-gray-300">Direction set</span>
                        </div>
                        <div className="mb-2">
                          <div style={labelStyleMuted}>Targeting</div>
                          <div style={valueStyleMuted}>—</div>
                        </div>
                        <div>
                          <div style={labelStyleMuted}>Timeline</div>
                          <div style={valueStyleMuted}>—</div>
                        </div>
                      </div>
                      <div className="mt-auto pt-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); router.push('/my-career'); }}
                          className="w-full text-white text-xs font-bold py-2 px-4 rounded-lg hover:opacity-90 transition-opacity"
                          style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
                        >
                          Start the Conversation →
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* ② RESUME COACH — two columns: value prop + next step */}
              <div
                className="bg-white border border-gray-300 rounded-2xl overflow-hidden flex flex-col shadow-sm hover:border-purple-300 hover:shadow-md transition-all cursor-pointer"
                onClick={() => router.push('/my-resumes')}
              >
                <div className="p-3 flex flex-col flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <div className="text-xl font-bold text-gray-900 tracking-tight">
                      <span style={numStyle}>02</span>Resume Coach
                    </div>
                    <span className="ml-auto"><StatusPill status={resumeStatus} /></span>
                  </div>
                  <div className="text-[13px] font-normal text-purple-600 mb-3">
                    Uncover the achievements and skills that never made it to the page.
                  </div>

                  <div className="grid grid-cols-2 gap-3 flex-1">
                    {/* Left: what it does */}
                    <div style={{ background: '#faf9ff', border: '1px solid #ede9fe', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {[
                        { label: 'Not a form.', body: 'A conversation. The same questions a $500 resume writer would ask — powered by AI.' },
                        { label: 'Not generation.', body: 'Extraction. We surface your real achievements, then help you say them right.' },
                        { label: 'Not one-time.', body: 'Coach it once, customize forever. Every job version builds on this foundation.' },
                      ].map(({ label, body }) => (
                        <div key={label}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: '#5b21b6', marginBottom: 2 }}>{label}</div>
                          <div style={{ fontSize: 11, fontWeight: 400, color: '#6b7280', lineHeight: 1.4 }}>{body}</div>
                        </div>
                      ))}
                    </div>

                    {/* Right: next step */}
                    <div style={nextStepStyle}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Next Step</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#5b21b6', marginBottom: 6, lineHeight: 1.25 }}>
                        {resumeNext.title}
                      </div>
                      <div style={{ fontSize: 12, color: '#4c1d95', lineHeight: 1.45, fontWeight: 400 }}>
                        {resumeNext.body}
                      </div>
                      {hasResume && !coreResume?.completed_at && journeyStep && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 'auto', paddingTop: 12 }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#7c3aed', flexShrink: 0, animation: 'hp-pulse 1.8s ease-in-out infinite' }} />
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#5b21b6' }}>{journeyStep} step</span>
                        </div>
                      )}
                      {coreResume?.completed_at && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 'auto', paddingTop: 12, padding: '4px 10px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #86efac', alignSelf: 'flex-start' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#166534' }}>✓ Complete</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <style>{`@keyframes hp-pulse { 0%,100%{opacity:1} 50%{opacity:.3} }`}</style>
              </div>
            </div>

            {/* ROW 2 */}
            <div className="grid gap-2.5" style={{ gridTemplateColumns: '2.2fr 1fr' }}>

              {/* ③ INTERVIEW COACH — two columns: power concepts + next step */}
              <div
                className="bg-white border border-gray-300 rounded-2xl overflow-hidden flex flex-col shadow-sm hover:border-purple-300 hover:shadow-md transition-all cursor-pointer"
                onClick={() => router.push('/my-interviews')}
              >
                <div className="p-3 flex flex-col flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <div className="text-xl font-bold text-gray-900 tracking-tight">
                      <span style={numStyle}>03</span>Interview Coach
                    </div>
                    <span className="ml-auto"><StatusPill status={interviewStatus} /></span>
                  </div>
                  <div className="text-[13px] font-normal text-purple-600 mb-3">
                    The first time you answer an interview question shouldn't be in the interview.
                  </div>

                  <div className="grid grid-cols-2 gap-3 flex-1">
                    {/* Left: power analysis concepts */}
                    <div style={{ background: '#faf9ff', border: '1px solid #ede9fe', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {[
                        { label: 'Core Power.', color: '#15803d', body: 'The strengths you already have that directly match the job.' },
                        { label: 'Hidden Power.', color: '#92400e', body: 'Transferable skills you didn\'t know you had — until we ask the right questions.' },
                        { label: 'Power Gaps.', color: '#b91c1c', body: 'What\'s missing — and exactly how to address it without apologizing.' },
                      ].map(({ label, color, body }) => (
                        <div key={label}>
                          <div style={{ fontSize: 11, fontWeight: 800, color, marginBottom: 2 }}>{label}</div>
                          <div style={{ fontSize: 11, fontWeight: 400, color: '#6b7280', lineHeight: 1.4 }}>{body}</div>
                        </div>
                      ))}
                    </div>

                    {/* Right: next step */}
                    <div style={nextStepStyle}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Next Step</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#5b21b6', marginBottom: 6, lineHeight: 1.25 }}>
                        Practice before it counts.
                      </div>
                      <div style={{ fontSize: 12, color: '#4c1d95', lineHeight: 1.45, fontWeight: 400 }}>
                        {coreResume?.completed_at
                          ? "Upload a job description and start a real practice session — AI-spoken questions built from the role and your actual experience."
                          : "Finish your resume first — your Interview Coach uses it to build questions specific to your experience and the job you're targeting."}
                      </div>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 'auto', paddingTop: 12 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#d1d5db', flexShrink: 0 }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af' }}>Not started</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ④ CAREER VAULT */}
              <div className="bg-white border border-gray-300 rounded-2xl overflow-hidden flex flex-col shadow-sm hover:border-purple-300 hover:shadow-md transition-all">
                <div className="p-3 flex flex-col flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <div className="text-xl font-bold text-gray-900 tracking-tight">
                      <span style={numStyle}>04</span>Career Vault
                    </div>
                    <span className="ml-auto"><StatusPill status={vaultStatus} /></span>
                  </div>
                  <div className="text-[13px] font-normal text-purple-600 mb-2">Track your wins before you forget them.</div>

                  <div className="rounded-xl p-2.5 mb-2" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.04), rgba(99,102,241,0.04))', border: '1.5px solid rgba(124,58,237,0.12)' }}>
                    <p className="text-[12px] font-bold italic text-gray-900 leading-snug mb-1" style={{ letterSpacing: '-0.03em' }}>
                      "Three years from now, you won't remember what you accomplished today."
                    </p>
                    <p className="text-[11px] text-gray-500 leading-tight" style={{ letterSpacing: '-0.02em' }}>
                      Keep building your career archive between job searches. When opportunity knocks, you'll be ready.
                    </p>
                  </div>

                  <div className="flex flex-col gap-0.5 mb-1.5">
                    {['Led Q3 launch across 3 teams', 'Promoted to Senior in 18 months', 'Cut onboarding from 3 weeks to 5 days'].map((win, i) => (
                      <div key={i} className="flex items-center gap-1.5 px-2 py-0.5 bg-gray-50 border border-gray-200 rounded-lg" style={{ opacity: 0.4 }}>
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-600 flex-shrink-0"></div>
                        <span className="text-[11px] text-gray-500">{win}</span>
                      </div>
                    ))}
                  </div>

                  <p className="text-[12px] text-gray-500 leading-tight" style={{ letterSpacing: '-0.01em' }}>
                    Job search complete? Activate Vault so your next resume builds itself while you live your career.
                  </p>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}