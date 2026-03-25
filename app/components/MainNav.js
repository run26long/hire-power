'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { useState } from 'react';
import UpgradeModal from '@/app/components/UpgradeModal';

export default function MainNav({ currentPage, userProfile }) {
  const router = useRouter();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', path: '/dashboard' },
    { id: 'my-career', label: 'Career Coach', path: '/my-career' },
    { id: 'my-resumes', label: 'Resume Coach', path: '/my-resumes' },
    { id: 'my-interviews', label: 'Interview Coach', path: '/my-interviews' },
  ];

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/landing');
  };

  return (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="px-6 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(userProfile ? '/dashboard' : '/landing')}
            className="flex items-center gap-2"
          >
            <img
              src="/images/HirePower_logo.png"
              alt="Hire Power"
              className="h-8 w-auto"
            />
          </button>
          <span className="text-sm text-gray-500 border-l border-gray-300 pl-3">
            The operating system for your career
          </span>
        </div>

        <div className="flex items-center gap-6">
          {userProfile && (
            <nav className="flex items-center gap-6">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => !item.disabled && router.push(item.path)}
                  style={currentPage === item.id ? { backgroundColor: 'rgba(147, 51, 234, 0.08)' } : {}}
                  className={`text-xs ${
                    currentPage === item.id
                      ? 'text-purple-700 font-semibold rounded-md px-3 py-1'
                      : item.disabled
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-gray-600 hover:text-purple-600'
                  }`}
                  disabled={item.disabled}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          )}

          {userProfile ? (
            <button
              onClick={() => router.push('/profile')}
              className="flex items-center gap-2 text-gray-700 hover:text-purple-600"
            >
             {userProfile?.subscription_tier === 'pro' && (
                <span className="text-[10px] font-bold text-white bg-purple-600 px-2 py-0.5 rounded-full">PRO</span>
              )}
              {userProfile?.subscription_tier === 'maintenance' && (
                <span className="text-[10px] font-bold text-white bg-gray-500 px-2 py-0.5 rounded-full">MAINTENANCE</span>
              )}
              {(!userProfile?.subscription_tier || userProfile?.subscription_tier === 'free') && (
                <span
                  onClick={(e) => { e.stopPropagation(); setShowUpgradeModal(true); }}
                  className="text-[10px] font-bold text-purple-600 bg-white border border-purple-200 px-2 py-0.5 rounded-full cursor-pointer hover:border-purple-400 hover:shadow-sm transition-all"
                >
                  Go Pro
                </span>
              )}
              {userProfile?.photo_url ? (
                <img
                  src={userProfile.photo_url}
                  alt="Profile"
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-sm">
                  {userProfile?.display_name?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
            </button>
          ) : (
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="text-xs text-gray-600 hover:text-purple-600"
              >
                Log in
              </button>
            </div>
          )}
          </div>
      </div>
     <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
     </div>
  );
}