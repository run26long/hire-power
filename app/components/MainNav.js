'use client';

import { useRouter } from 'next/navigation';

export default function MainNav({ currentPage, userProfile }) {
  const router = useRouter();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', path: '/dashboard' },
    { id: 'career-coach', label: 'Career Coach', path: '/career-coach' },
    { id: 'resume-coach', label: 'Resume Coach', path: '/resume-coach' },
    { id: 'interview-coach', label: 'Interview Coach', path: '/interview-coach', disabled: true }
  ];

  return (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="px-6 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2"
          >
            <img 
              src="/images/HirePower_logo.png" 
              alt="Hire Power" 
              className="h-8 w-auto"
            />
          </button>
          <span className="text-xs text-gray-500 border-l border-gray-300 pl-3">
            AI-powered career coaching for people seeking more than their next job
          </span>
        </div>

        <div className="flex items-center gap-6">
          <nav className="flex items-center gap-6">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => !item.disabled && router.push(item.path)}
                className={`text-sm ${
                  currentPage === item.id
                    ? 'text-purple-600 font-semibold border-b-2 border-purple-600 pb-1'
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

          <button
            onClick={() => router.push('/profile')}
            className="flex items-center gap-2 text-gray-700 hover:text-purple-600"
          >
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
        </div>
      </div>
    </div>
  );
}