'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import MainNav from '../components/MainNav';
import Breadcrumb from '../components/Breadcrumb';
import { track } from '../utils/analytics';

export default function MyCareerPage() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [careerContext, setCareerContext] = useState(null);
  const [existingResume, setExistingResume] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalScreen, setModalScreen] = useState(1);

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/dashboard'); return; }
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
      if (resumes && resumes.length > 0) setExistingResume(resumes[0]);

      setLoading(false);

      // Show modal if no career context yet
      if (!context) {
        setTimeout(() => {
          const seen = localStorage.getItem('hp_career_modal_seen');
          if (!seen) {
            setShowModal(true);
            setModalScreen(1);
          }
        }, 300);
      }
    }
    loadData();
  }, [supabase, router]);

  const handleDismissModal = () => {
    localStorage.setItem('hp_career_modal_seen', 'true');
    setShowModal(false);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadErr } = await supabase.storage
        .from('resumes').upload(filePath, file);
      if (uploadErr) throw uploadErr;

      const parseRes = await fetch('/api/parse-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath })
      });
      if (!parseRes.ok) throw new Error('Parse failed');
      const { text } = await parseRes.json();

      const extractRes = await fetch('/api/extract-resume-structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parsedText: text })
      });
      if (!extractRes.ok) throw new Error('Extract failed');
      const { data: resumeData } = await extractRes.json();

      const { data: savedResume, error: saveErr } = await supabase
        .from('resumes').insert({
          user_id: user.id,
          resume_type: 'core',
          display_name: 'Core Resume',
          resume_data: resumeData,
          journey_step: 'review',
          file_path: filePath
        }).select().single();
      if (saveErr) throw saveErr;

      track('resume_uploaded', { method: 'upload', source: 'career_coach' })
      localStorage.setItem('hp_career_modal_seen', 'true');
      router.push(`/career-coach/detail?resumeId=${savedResume.id}`);
    } catch (err) {
      console.error('Upload error:', err);
      setUploadError('Upload failed. Please try again.');
      setUploading(false);
    }
  };

  const handleContinueWithExisting = () => {
    localStorage.setItem('hp_career_modal_seen', 'true');
    router.push(`/career-coach/detail?resumeId=${existingResume.id}`);
  };

  const handleStartConversation = async () => {
    // Find most recent resume to use
    const { data: resumes } = await supabase
      .from('resumes').select('id').eq('user_id', user.id)
      .eq('resume_type', 'core')
      .order('updated_at', { ascending: false }).limit(1);
    if (resumes && resumes.length > 0) {
      router.push(`/career-coach/detail?resumeId=${resumes[0].id}`);
    } else {
      // No resume yet — show modal
      setShowModal(true);
      setModalScreen(1);
    }
  };

  function formatDate(dateString) {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-purple-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const hasContext = !!careerContext;
  const firstName = userProfile?.first_name || careerContext?.current_role?.split(' ')[0] || '';

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
          <h1 className="text-[28px] font-bold mb-1.5 whitespace-nowrap tracking-tight">Career Coach</h1>
          <p className="text-[13px] text-white text-opacity-95 leading-tight tracking-tight mb-0.5">
            Job hunting is small talk.
          </p>
          <p className="text-[13px] text-white text-opacity-95 leading-tight tracking-tight">
            Your career deserves a conversation.
          </p>
          <div className="mt-4 border-b border-gray-400 border-opacity-10"></div>
          <p className="text-[15px] font-bold text-white leading-tight tracking-tight mt-3">
            The best 5-minute investment you can make in your career.
          </p>
        </div>

        <div className="flex-1 px-6 pt-3 pb-6 flex flex-col justify-between">
          <div>
            {/* Career Conversation */}
            <div className="mb-5">
              <h4 className="text-sm font-bold uppercase tracking-wider text-white mb-2">YOUR CONVERSATION</h4>
              <ul className="space-y-1.5 text-sm">
                <li className="flex items-start"><span className="mr-2">•</span><span>Current Background</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Career Direction</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Target Roles &amp; Industries</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Job Search Timeline</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Hidden Skills &amp; Experience</span></li>
              </ul>
            </div>

            {/* Coming Soon */}
            <div className="mb-4">
              <h4 className="text-sm font-bold uppercase tracking-wider text-white mb-2">COMING SOON</h4>
              <ul className="space-y-1.5 text-sm">
                <li className="flex items-start"><span className="mr-2">•</span><span>Aptitude Assessment</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Career Path Exploration</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Skills Inventory</span></li>
              </ul>
            </div>
          </div>

          <div className="mt-auto">
            <div className="mb-3 border-b border-gray-400 border-opacity-10"></div>
            <div>
              <p className="text-xs text-white text-opacity-90 leading-relaxed mb-3">
                The more we know about your goals, the better your resume becomes.
              </p>
              <div className="flex items-center gap-2.5 text-white">
                <img
                  src="/images/Hire_Power_icon.png"
                  alt="Lightning"
                  className="h-5 w-auto flex-shrink-0"
                />
                <p className="text-sm font-medium leading-tight">
                  Tell us where you want to go
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="ml-0 md:ml-64 flex-1 flex flex-col h-screen overflow-hidden">
        <MainNav currentPage="career-coach" userProfile={userProfile} />

        <div className="flex-1 overflow-y-auto">
          <div className="px-4 md:px-8 py-2 md:py-4 max-w-[1400px] mx-auto w-full">

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

              {/* Career Profile Card - 8 cols */}
             <div className="col-span-1 md:col-span-8">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 md:px-5 md:py-3">
                  <div className="flex items-center justify-between mb-1">
                    <h2 className="text-lg font-semibold text-gray-900">Career Profile</h2>
                    <span className="md:hidden text-xs font-semibold px-3 py-1 rounded-md" style={{ backgroundColor: 'rgba(147, 51, 234, 0.08)', color: '#7e22ce' }}>Career Coach</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-4">The context that makes your resume and interviews sharper.</p>

                  {/* Profile Grid */}
                  <div className="grid grid-cols-2 gap-3 mb-3">

                    {/* Current Role */}
                    <div className="bg-gray-50 rounded-lg p-2">
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Current Role</div>
                      {hasContext && careerContext.current_role ? (
                        <p className="text-sm font-semibold text-gray-900">
                          {careerContext.current_role}
                          {careerContext.current_company && (
                            <span className="text-gray-500 font-normal"> at {careerContext.current_company}</span>
                          )}
                        </p>
                      ) : (
                        <p className="text-xl font-bold text-gray-200">--</p>
                      )}
                      {hasContext && careerContext.years_experience && (
                        <p className="text-xs text-gray-500 mt-0.5">{careerContext.years_experience} years experience</p>
                      )}
                    </div>

                    {/* Career Direction */}
                    <div className="bg-gray-50 rounded-lg p-2">
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Career Direction</div>
                      {hasContext ? (
                        <div>
                          {careerContext.is_career_changer ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-purple-600">🔄</span>
                              <p className="text-sm font-semibold text-gray-900">Career Transition</p>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="text-green-600">↑</span>
                              <p className="text-sm font-semibold text-gray-900">Same Field</p>
                            </div>
                          )}
                          {careerContext.is_career_changer && careerContext.previous_field && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {careerContext.previous_field} → {careerContext.target_industries?.[0] || 'New Field'}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xl font-bold text-gray-200">--</p>
                      )}
                    </div>

                    {/* Target Roles */}
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Target Roles</div>
                      {hasContext && careerContext.target_roles?.length > 0 ? (
                        <p className="text-sm font-semibold text-gray-900">{careerContext.target_roles.join(', ')}</p>
                      ) : (
                        <p className="text-xl font-bold text-gray-200">--</p>
                      )}
                      {hasContext && careerContext.target_industries?.length > 0 && (
                        <p className="text-xs text-gray-500 mt-0.5">in {careerContext.target_industries.join(', ')}</p>
                      )}
                    </div>

                   {/* Timeline */}
                    <div className="bg-gray-50 rounded-lg p-2">
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Search Timeline</div>
                      {hasContext && careerContext.timeline ? (
                        <p className="text-sm font-semibold text-gray-900 capitalize">
                          {careerContext.timeline.replace(/_/g, ' ')}
                        </p>
                      ) : (
                        <p className="text-xl font-bold text-gray-200">--</p>
                      )}
                    </div>
                  </div>

                  {/* Hidden Skills */}
                  <div className="bg-gray-50 rounded-lg p-2 mb-3">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Hidden Skills Identified</div>
                    {hasContext && careerContext.skills_not_on_resume?.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {careerContext.skills_not_on_resume.map((skill, i) => (
                          <span key={i} className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full font-medium">
                            {skill}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-300 font-semibold">--</p>
                    )}
                  </div>

                  {/* CTA Bar */}
                 <div className="bg-purple-50 border-l-4 border-purple-600 p-3 rounded-r flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="text-[10px] font-bold text-purple-600 uppercase tracking-wide mb-1">
                        {hasContext ? 'Career Profile Complete' : 'Get Started'}
                      </div>
                      <p className="text-xs text-gray-700 leading-snug">
                        {hasContext
                          ? 'Your career direction is set. Resume Coach and Interview Coach will use this to tailor everything to your goals.'
                          : "Tell us where you're headed and we'll tailor everything to get you there. Five minutes here saves hours everywhere else."
                        }
                      </p>
                    </div>
                    <button
                      onClick={handleStartConversation}
                      className="text-white px-4 py-2 rounded-lg transition-opacity hover:opacity-90 font-medium text-sm whitespace-nowrap flex-shrink-0"
                      style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
                    >
                      {hasContext ? 'Update Goals →' : 'Start Conversation →'}
                    </button>
                  </div>

                  {hasContext && careerContext.completed_at && (
                    <p className="text-[10px] text-gray-400 text-right mt-2">
                      Last updated {formatDate(careerContext.updated_at || careerContext.completed_at)}
                    </p>
                  )}

                  {/* How Your Profile Is Used */}
                  <div className="mt-5 pt-5 border-t border-gray-100">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-3">How Your Profile Is Used</div>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)' }}>
                          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-900">Resume Coach</p>
                          <p className="text-xs text-gray-500 leading-snug">Your target roles and career direction shape which achievements we extract and how we frame your experience.</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)' }}>
                          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-900">Interview Coach</p>
                          <p className="text-xs text-gray-500 leading-snug">Your goals and hidden skills inform your Power Analysis and the gaps we help you address before you walk in.</p>
                        </div>
                      </div>
                      
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - 4 cols */}
              <div className="col-span-1 md:col-span-4 space-y-4">

                {/* Status Card */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                  <h2 className="text-lg font-semibold text-gray-900">Career Readiness</h2>
                  <p className="text-xs text-gray-500 mb-4">How prepared is your career profile?</p>

                  <div className="space-y-3">
                    {/* Career Conversation */}
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                        hasContext ? 'bg-purple-600 text-white' : 'bg-white border border-gray-300 text-gray-400'
                      }`}>
                        {hasContext ? '✓' : '○'}
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${hasContext ? 'text-gray-900' : 'text-gray-400'}`}>
                          Career Conversation
                        </p>
                        <p className="text-xs text-gray-400">Goals, direction, target roles</p>
                      </div>
                    </div>

                    {/* Resume */}
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                        existingResume ? 'bg-purple-600 text-white' : 'bg-white border border-gray-300 text-gray-400'
                      }`}>
                        {existingResume ? '✓' : '○'}
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${existingResume ? 'text-gray-900' : 'text-gray-400'}`}>
                          Resume on File
                        </p>
                        <p className="text-xs text-gray-400">Core resume uploaded or built</p>
                      </div>
                    </div>

                    {/* Interview Ready */}
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 bg-white border border-gray-300 text-gray-400">
                        ○
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-400">Interview Ready</p>
                        <p className="text-xs text-gray-400">Interview Coach prep complete</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Coming Soon Assessments */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
                  <h2 className="text-base font-semibold text-gray-900 mb-1">Career Assessments</h2>
                  <p className="text-xs text-gray-500 mb-4">Additional tools to guide your career development</p>

                  <div className="space-y-2">
                    <div className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg">
                      <span className="text-lg">⭕</span>
                      <div className="flex-1">
                        <p className="text-xs font-medium text-gray-500">Aptitude Assessment</p>
                        <p className="text-[10px] text-gray-400">Discover roles that match your strengths</p>
                      </div>
                      <span className="text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded whitespace-nowrap">Coming Soon</span>
                    </div>
                    <div className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg">
                      <span className="text-lg">⭕</span>
                      <div className="flex-1">
                        <p className="text-xs font-medium text-gray-500">Career Exploration</p>
                        <p className="text-[10px] text-gray-400">Map paths from your current experience</p>
                      </div>
                      <span className="text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded whitespace-nowrap">Coming Soon</span>
                    </div>
                    <div className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg">
                      <span className="text-lg">⭕</span>
                      <div className="flex-1">
                        <p className="text-xs font-medium text-gray-500">Skills Inventory</p>
                        <p className="text-[10px] text-gray-400">Map your complete skillset including hidden strengths</p>
                      </div>
                      <span className="text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded whitespace-nowrap">Coming Soon</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

     {/* Onboarding Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)' }}
          onClick={handleDismissModal}
        >
          <div
            className="bg-white shadow-2xl max-w-lg w-full overflow-hidden border border-gray-200"
            onClick={(e) => e.stopPropagation()}
            style={{
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              borderRadius: '8px',
              height: '520px',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Modal Header */}
            <div
              style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)', borderRadius: '8px 8px 0 0' }}
              className="px-6 py-4 relative flex-shrink-0"
            >
              <button
                onClick={handleDismissModal}
                className="absolute top-4 right-4 text-white hover:text-gray-200 text-3xl leading-none font-light"
              >
                ×
              </button>
              <div className="flex items-center gap-3">
                <img src="/images/Hire_Power_icon.png" alt="Hire Power" className="h-8 w-auto flex-shrink-0" />
                <div>
                  {modalScreen === 1 ? (
                    <>
                      <h2 className="text-xl font-bold text-white">Welcome to Career Coach</h2>
                      <p className="text-purple-100 text-xs">The most valuable 5 minutes of your job search</p>
                    </>
                  ) : (
                    <>
                      <h2 className="text-xl font-bold text-white">Let's Get Started</h2>
                      <p className="text-purple-100 text-xs">Your resume is the starting point.</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div className="px-6 py-4 flex-1 flex flex-col">

              {/* Screen 1 */}
              {modalScreen === 1 && (
                <div className="flex flex-col h-full">
                  <div className="space-y-3">
                    <p className="font-bold text-gray-900 text-base">Why start with Career Coach?</p>

                    <p className="text-sm text-gray-700">
                      Most resume tools optimize for where you've been, not where you're trying to go. If you’re targeting a new role, changing industries, or applying to something your current title doesn’t reflect, a resume tool that doesn’t know this can’t help you get there.
                    </p>
                    <p className="text-sm text-gray-700">
                       That's why Career Coach starts by understanding where you want to go.
                    </p>
                    <p className="text-sm text-gray-700">
                      In a quick conversation, we learn about your goals, direction, and the skills you have that aren’t obvious on paper. Everything we learn here powers your resume, your interviews, your entire job search.
                    </p>

                    <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-l-4 border-purple-600 p-3">
                      <p className="text-sm text-gray-800 font-medium">
                        A few answers here unlock a stronger resume, sharper interviews, and a smarter job search.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-center mt-3">
                    <button
                      onClick={() => setModalScreen(2)}
                      className="text-white px-4 py-2 rounded-lg transition-opacity hover:opacity-90 font-semibold text-xs"
                      style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
                    >
                      Start the Conversation
                    </button>
                  </div>
                </div>
              )}

          {/* Screen 2 — matches Resume modal screen 3 exactly */}
              {modalScreen === 2 && (
                <div className="flex flex-col py-2">

                  {/* Existing Core Resume */}
                  {existingResume && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-2 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-green-800">✓ Resume Found</p>
                        <p className="text-xs text-green-700">Core Resume on file</p>
                      </div>
                      <button
                        onClick={handleContinueWithExisting}
                        className="text-white px-4 py-2 rounded-lg transition-opacity hover:opacity-90 font-semibold text-xs whitespace-nowrap"
                        style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
                      >
                        Use This Resume →
                      </button>
                    </div>
                  )}

                  {/* Option 1 — Upload */}
                  <div className="flex items-center gap-4 py-4">
                    <span className="text-6xl font-black text-gray-200 leading-none flex-shrink-0 w-10" style={{ fontFamily: 'Fraunces, serif' }}>1</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 leading-snug">Already have a resume?</p>
                      <p className="text-xs text-gray-500 leading-snug mt-0.5">Upload it and we'll coach it into something stronger.</p>
                    </div>
                    <label className="block cursor-pointer flex-shrink-0">
                      <input
                        type="file"
                        accept=".pdf,.docx"
                        onChange={handleFileUpload}
                        className="hidden"
                        disabled={uploading}
                      />
                      <div
                        className="text-white px-4 py-2 rounded-lg transition-opacity hover:opacity-90 font-semibold text-xs cursor-pointer flex items-center gap-2 whitespace-nowrap"
                        style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
                      >
                        {uploading ? (
                          <>
                            <div className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full"></div>
                            Uploading...
                          </>
                        ) : existingResume ? (
                          'Upload a Different Resume'
                        ) : (
                          'Upload Resume'
                        )}
                      </div>
                    </label>
                  </div>

                  {uploadError && (
                    <p className="text-xs text-red-600 mb-2 text-center">{uploadError}</p>
                  )}

                  {/* Divider */}
                  <div className="border-t border-gray-100 mx-2" />

                  {/* Option 2 — Resume Chat */}
                  <div className="flex items-center gap-4 py-4">
                    <span className="text-6xl font-black text-gray-200 leading-none flex-shrink-0 w-10" style={{ fontFamily: 'Fraunces, serif' }}>2</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 leading-snug">Starting from scratch?</p>
                      <p className="text-xs text-gray-500 leading-snug mt-0.5">Just chat with Coach and we'll build your résumé from the conversation. Mobile friendly, no typing needed.</p>
                    </div>
                    <div className="flex-shrink-0 text-center">
                      <button
                        disabled
                        className="px-4 py-2 rounded-lg font-semibold text-xs inline-flex items-center gap-1.5 border-2 border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed whitespace-nowrap"
                      >
                        💬 Resume Chat
                      </button>
                      <p className="text-[10px] text-gray-400 mt-1">Coming Soon</p>
                    </div>
                  </div>

                  {/* Builder link — desktop only */}
                  <div className="hidden md:block text-center mt-2" style={{ lineHeight: '1' }}>
                    <span className="block text-xs text-gray-400">Not feeling chatty?</span>
                    <button
                      onClick={() => {
                        localStorage.setItem('hp_career_modal_seen', 'true');
                        router.push('/career-coach/build');
                      }}
                      className="text-xs text-purple-400 hover:text-purple-700 font-medium hover:underline"
                    >
                      Use our form-based resume builder.
                    </button>
                  </div>

                  {/* Mobile note */}
                  <p className="md:hidden text-xs text-gray-400 text-center mt-2">
                    Not feeling chatty? <br/> Use our form-based resume builder from your computer.
                  </p>

                </div>
              )}
            </div>
          </div>
        </div>
      )}
        
    </div>
  );
}