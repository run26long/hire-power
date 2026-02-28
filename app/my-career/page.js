'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import MainNav from '../components/MainNav';
import Breadcrumb from '../components/Breadcrumb';

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

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUser(user);

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      setUserProfile(profile);

   const { data: context } = await supabase
        .from('career_context')
        .select('*')
        .eq('user_id', user.id)
        .single();

      setCareerContext(context);
      
      // Check if user has any resumes (uploaded or built)
      const { data: resumes } = await supabase
        .from('resumes')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1);
      
      if (resumes && resumes.length > 0) {
        setExistingResume(resumes[0]);
      }
      
     // Only show returning view if they have actual career context
      // Having a resume alone should show new user screen with resume detection
      if (context) {
        setCareerContext(context);
      }
      
      setLoading(false);
    }
    loadData();
  }, [supabase, router]);

  // Handle file upload
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);

    try {
      // 1. Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('resumes')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Parse the file (extract text)
      const parseResponse = await fetch('/api/parse-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath })
      });

      if (!parseResponse.ok) {
        throw new Error('Failed to parse resume');
      }

      const { text } = await parseResponse.json();

      // 3. Extract structured data
      const extractResponse = await fetch('/api/extract-resume-structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parsedText: text })
      });

      if (!extractResponse.ok) {
        throw new Error('Failed to extract resume structure');
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

      if (saveError) throw saveError;

      // 5. Redirect to Career Detail with resume ID
      router.push(`/my-career/detail?resumeId=${savedResume.id}`);

    } catch (error) {
      console.error('Upload error:', error);
      setUploadError(error.message || 'Failed to upload resume. Please try again.');
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-purple-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

const breadcrumbItems = [
    { label: 'My Career' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <MainNav currentPage="my-career" userProfile={userProfile} />
      <Breadcrumb items={breadcrumbItems} />

      <div className="max-w-7xl mx-auto px-6 py-6">
        {!careerContext ? (
          // NEW USER - Enhanced Welcome
          <div className="max-w-3xl mx-auto">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              {/* Header Section - FREE BADGE ON RIGHT */}
              <div className="bg-gradient-to-r from-purple-50 to-purple-100 px-8 py-4 border-b border-purple-200">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-2xl">💼</span>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 leading-tight">Welcome to Career Coach</h2>
                      <p className="text-sm text-gray-600 leading-tight">Your first step to a stronger career strategy</p>
                    </div>
                  </div>
                  {/* FREE BADGE - RIGHT SIDE */}
                  <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center gap-2 flex-shrink-0">
                    <span className="text-green-600 text-lg">✨</span>
                    <div>
                      <p className="font-semibold text-green-900 text-xs leading-tight">Free for Everyone</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Content - COMPACT */}
              <div className="px-8 py-5">
                <p className="text-gray-700 mb-5">
                  Before we build your resume, let's have a quick 5-minute conversation about your career direction. This helps us tailor everything to your specific goals.
                </p>

                {/* What We'll Cover Checklist - NARROWER */}
                <div className="max-w-lg mx-auto bg-purple-50 border border-purple-200 rounded-lg p-4 mb-5">
                  <h3 className="font-semibold text-gray-900 mb-2.5 flex items-center gap-2">
                    <span className="text-purple-600">📋</span>
                    What We'll Cover:
                  </h3>
                  <div className="space-y-1.5">
                    <div className="flex items-start gap-2.5">
                      <span className="text-purple-600 text-lg flex-shrink-0">✓</span>
                      <span className="text-sm text-gray-700"><strong>Current Background:</strong> Your experience and role</span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="text-purple-600 text-lg flex-shrink-0">✓</span>
                      <span className="text-sm text-gray-700"><strong>Career Direction:</strong> Where you want to go next</span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="text-purple-600 text-lg flex-shrink-0">✓</span>
                      <span className="text-sm text-gray-700"><strong>Target Roles:</strong> Specific positions you're interested in</span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="text-purple-600 text-lg flex-shrink-0">✓</span>
                      <span className="text-sm text-gray-700"><strong>Timeline:</strong> When you're planning to make a move</span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="text-purple-600 text-lg flex-shrink-0">✓</span>
                      <span className="text-sm text-gray-700"><strong>Hidden Skills:</strong> Strengths you might not have on your resume</span>
                    </div>
                  </div>
                </div>

{/* Existing Resume Detected */}
                {existingResume && !careerContext && (
                  <div className="flex items-center gap-4 mb-4">
                    {/* Left: Green message box */}
                    <div className="flex-1 bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                      <p className="text-sm font-semibold text-green-800 mb-1">✓ Resume Found!</p>
                      <p className="text-sm text-green-800">
                        We'll use your {existingResume.display_name || 'Core Resume'} for our career conversation.
                      </p>
                    </div>
                    
                    {/* Right: Button and link stack */}
                    <div className="flex flex-col items-center space-y-2">
                      <button
                        onClick={() => router.push(`/my-career/detail?resumeId=${existingResume.id}`)}
                        className="bg-purple-600 text-white px-6 py-2.5 rounded-lg hover:bg-purple-700 transition-all font-semibold whitespace-nowrap"
                      >
                        Continue with Existing Resume →
                      </button>
                      <p className="text-xs text-gray-500 text-center">
                        Need to use a different resume?{' '}
                        <button
                          onClick={() => setExistingResume(null)}
                          className="text-purple-600 hover:text-purple-700 font-medium hover:underline"
                        >
                          Upload here
                        </button>
                      </p>
                    </div>
                  </div>
                )}
                {/* Upload Section - Only show if no existing resume */}
                {!existingResume && (
                  <div className="flex flex-col items-center space-y-3">
                  <label className="block">
                    <input
                      type="file"
                      accept=".pdf,.docx"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="resume-upload"
                      disabled={uploading}
                    />
                    <div className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-all font-semibold shadow-sm hover:shadow-md cursor-pointer whitespace-nowrap flex items-center gap-2">
                      {uploading && (
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                      )}
                      {uploading ? 'Uploading...' : 'Upload Resume to Get Started'}
                    </div>
                  </label>

                  <p className="text-xs text-gray-500">
                    No resume?{' '}
                    <button
                      onClick={() => router.push('/my-career/build')}
                      className="text-purple-600 hover:text-purple-700 font-medium hover:underline"
                    >
                      Create one from scratch →
                    </button>
                 </p>
                </div>
                )}

                {/* Error Display */}
                {uploadError && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">{uploadError}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          // RETURNING USER - Enhanced Profile View
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Career Profile Card */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-green-50 to-green-100 px-8 py-5 border-b border-green-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center">
                      <span className="text-2xl">✓</span>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">Career Profile Complete</h2>
                      <p className="text-sm text-gray-600">Your career direction is set and ready to guide your resume</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-8 py-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Current Position */}
                  {careerContext.current_role && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Current Position</h4>
                      <p className="text-gray-900 font-medium">
                        {careerContext.current_role}
                        {careerContext.current_company && (
                          <span className="text-gray-600 font-normal"> at {careerContext.current_company}</span>
                        )}
                      </p>
                      {careerContext.years_experience && (
                        <p className="text-sm text-gray-600 mt-1">{careerContext.years_experience} years experience</p>
                      )}
                    </div>
                  )}

                  {/* Target Roles */}
                  {careerContext.target_roles && careerContext.target_roles.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Target Roles</h4>
                      <p className="text-gray-900 font-medium">{careerContext.target_roles.join(', ')}</p>
                      {careerContext.target_industries && careerContext.target_industries.length > 0 && (
                        <p className="text-sm text-gray-600 mt-1">in {careerContext.target_industries.join(', ')}</p>
                      )}
                    </div>
                  )}

                  {/* Career Path Type */}
                  {careerContext.is_career_changer && (
                    <div className="md:col-span-2">
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <div className="flex items-center gap-2">
                          <span className="text-purple-600 text-xl">🔄</span>
                          <div>
                            <p className="font-semibold text-purple-900 text-sm">Career Transition</p>
                            <p className="text-sm text-purple-700">
                              {careerContext.previous_field} → {careerContext.target_industries?.[0] || 'New Field'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Update Button */}
                <div className="mt-6 pt-6 border-t border-gray-200">
               <button
                    onClick={async () => {
                      const { data: resume } = await supabase
                        .from('resumes')
                        .select('id')
                        .eq('user_id', user.id)
                        .limit(1)
                        .single();
                      
                      if (resume?.id) {
                        router.push(`/my-career/detail?resumeId=${resume.id}`);
                      }
                    }}
                    className="w-full bg-white text-purple-600 border-2 border-purple-600 px-4 py-2.5 rounded-lg hover:bg-purple-50 transition-all text-sm font-semibold"
                  >
                    Update Career Goals
                  </button>
                </div>
              </div>
            </div>

            {/* Career Assessments */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-8 py-5 border-b border-gray-200">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <span className="text-xl">📊</span>
                  Career Assessments
                </h3>
                <p className="text-sm text-gray-600 mt-1">Additional tools to guide your career development</p>
              </div>
              
              <div className="px-8 py-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-gray-400 p-3 bg-gray-50 rounded-lg">
                    <span className="text-xl">⭕</span>
                    <div>
                      <p className="font-medium text-sm">DISC Assessment</p>
                      <p className="text-xs">Understand your work style and communication preferences</p>
                    </div>
                    <span className="ml-auto text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">Coming Soon</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-400 p-3 bg-gray-50 rounded-lg">
                    <span className="text-xl">⭕</span>
                    <div>
                      <p className="font-medium text-sm">Career Path Exploration</p>
                      <p className="text-xs">Discover roles that align with your skills and interests</p>
                    </div>
                    <span className="ml-auto text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">Coming Soon</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-400 p-3 bg-gray-50 rounded-lg">
                    <span className="text-xl">⭕</span>
                    <div>
                      <p className="font-medium text-sm">Skills Inventory</p>
                      <p className="text-xs">Map your complete skillset including hidden strengths</p>
                    </div>
                    <span className="ml-auto text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">Coming Soon</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-8 py-5 border-b border-gray-200">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <span className="text-xl">⚡</span>
                  Quick Actions
                </h3>
                <p className="text-sm text-gray-600 mt-1">Ready to move forward with your career preparation</p>
              </div>
              
              <div className="px-8 py-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={() => router.push('/my-resumes')}
                    className="bg-purple-600 text-white px-6 py-4 rounded-lg hover:bg-purple-700 transition-all font-semibold shadow-sm hover:shadow-md flex items-center justify-between group"
                  >
                    <span>Build Your Resume</span>
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </button>
                  <button
                    disabled
                    className="bg-gray-100 text-gray-400 px-6 py-4 rounded-lg cursor-not-allowed font-semibold flex items-center justify-between"
                  >
                    <span>Practice Interviews</span>
                    <span className="text-xs bg-gray-200 px-2 py-1 rounded">Coming Soon</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}