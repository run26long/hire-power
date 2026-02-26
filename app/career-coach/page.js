'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import MainNav from '../../components/MainNav';
import Breadcrumb from '../../components/Breadcrumb';

export default function MyCareerPage() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [careerContext, setCareerContext] = useState(null);
  const [loading, setLoading] = useState(true);

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
      setLoading(false);
    }
    loadData();
  }, [supabase, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-purple-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'My Career' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <MainNav currentPage="career-coach" userProfile={userProfile} />
      <Breadcrumb items={breadcrumbItems} />

      <div className="max-w-7xl mx-auto px-6 py-8">
        {!careerContext ? (
          // NEW USER - Enhanced Welcome
          <div className="max-w-3xl mx-auto">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              {/* Header Section */}
              <div className="bg-gradient-to-r from-purple-50 to-purple-100 px-8 py-6 border-b border-purple-200">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">💼</span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Welcome to Career Coach</h2>
                    <p className="text-sm text-gray-600">Your first step to a stronger career strategy</p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="px-8 py-6">
                <p className="text-gray-700 mb-6">
                  Before we build your resume, let's have a quick 5-minute conversation about your career direction. This helps us tailor everything to your specific goals.
                </p>

                {/* What We'll Cover Checklist */}
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-5 mb-6">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <span className="text-purple-600">📋</span>
                    What We'll Cover:
                  </h3>
                  <div className="space-y-2.5">
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

                {/* Free Badge */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center gap-2">
                    <span className="text-green-600 text-xl">✨</span>
                    <div>
                      <p className="font-semibold text-green-900 text-sm">Free for Everyone</p>
                      <p className="text-xs text-green-700">This conversation is completely free and helps everything work better.</p>
                    </div>
                  </div>
                </div>

                {/* CTA */}
                <button
                  onClick={() => router.push('/career-coach/detail')}
                  className="w-full bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-all font-semibold shadow-sm hover:shadow-md"
                >
                  Start Career Conversation →
                </button>

                {/* Skip Option */}
                <div className="mt-6 pt-6 border-t border-gray-200 text-center">
                  <p className="text-xs text-gray-500 mb-3">Want to skip this for now?</p>
                  <button
                    onClick={() => router.push('/resume-coach')}
                    className="text-sm text-purple-600 hover:text-purple-700 font-medium hover:underline"
                  >
                    Go directly to Resume Coach →
                  </button>
                  <p className="text-xs text-gray-500 mt-2">
                    (You can always come back to complete Career Coach later)
                  </p>
                </div>
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
                    onClick={() => router.push('/career-coach/detail')}
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
                    onClick={() => router.push('/resume-coach')}
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