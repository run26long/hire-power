'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { useState, useEffect } from 'react';
import UpgradeModal from '@/app/components/UpgradeModal';

export default function MainNav({ currentPage, userProfile, onBeforeNavigate }) {
  const router = useRouter();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showUpgradedBanner, setShowUpgradedBanner] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('upgraded') === 'true') {
      setShowUpgradedBanner(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const navigate = (path) => {
    if (onBeforeNavigate?.(path)) return
    router.push(path)
  };

 const tier = userProfile?.subscription_tier;
  const isVaultTier = tier === 'vault' || tier === 'maintenance' || (tier === 'pro' && userProfile?.search_status === 'hired');

  const pendingChangeType = userProfile?.pending_change_type;
  const pendingChangeDate = userProfile?.pending_change_date;
  let tierTooltip = undefined;
  if (pendingChangeType && pendingChangeDate) {
    const dateStr = new Date(pendingChangeDate).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric'
    });
    if (pendingChangeType === 'downgrade') tierTooltip = `Switching to Vault on ${dateStr}`;
    else if (pendingChangeType === 'cancel') tierTooltip = `Cancelling on ${dateStr}`;
  }

  const navItems = [
    { id: 'dashboard',       label: 'Dashboard',       path: '/dashboard' },
    // { id: 'career-coach',    label: 'Career Coach',    path: '/career-coach' },  // HIDDEN — restore to re-enable
    { id: 'resume-coach',    label: 'Resume Coach',    path: '/resume-coach' },
    { id: 'interview-coach', label: 'Interview Coach', path: '/interview-coach' },
    isVaultTier
      ? { id: 'career-vault', label: 'Career Vault', path: '/career-vault' }
      : { id: 'job-tracker',  label: 'Job Tracker',  path: '/job-tracker' },
  ];

  const handleNavClick = (path) => {
    setMenuOpen(false);
    navigate(path);
  };

  return (
    <>
      {showUpgradedBanner && (
        <div className="fixed top-0 left-0 right-0 z-[60] bg-purple-600 text-white text-sm font-semibold flex items-center justify-center gap-3 py-3 px-6 shadow-lg">
          <span>🎉 Welcome to Pro! Your full coaching session is ready.</span>
          <button
            onClick={() => setShowUpgradedBanner(false)}
            className="text-white hover:text-purple-200 text-lg leading-none font-light"
          >×</button>
        </div>
      )}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="px-4 md:px-6 py-2 flex items-center justify-between">

          {/* Logo + tagline */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(userProfile ? '/dashboard' : '/landing')}
              className="flex items-center gap-2"
            >
              <img
                src="/images/HirePower_logo.png"
                alt="Hire Power"
                className="h-8 w-auto"
              />
            </button>
            <span className="hidden md:block text-sm text-gray-500 border-l border-gray-300 pl-3">
              The operating system for your career
            </span>
          </div>

          <div className="hidden md:flex items-center gap-6">
            {userProfile && (
              <nav className="flex items-center gap-6">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    data-tour={item.id === 'job-tracker' ? 'job-tracker' : undefined}
                    onClick={() => !item.disabled && navigate(item.path)}
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
                onClick={() => navigate('/profile')}
                className="flex items-center gap-2 text-gray-700 hover:text-purple-600"
              >
                {tier === 'pro' && (
                  <span title={tierTooltip} className="text-[10px] font-bold text-white bg-purple-600 px-2 py-0.5 rounded-full">PRO</span>
                )}
                {tier === 'vault' && (
                  <span title={tierTooltip} className="text-[10px] font-bold text-white bg-purple-600 px-2 py-0.5 rounded-full">VAULT</span>
                )}
                {tier === 'maintenance' && (
                  <span title={tierTooltip} className="text-[10px] font-bold text-white bg-gray-500 px-2 py-0.5 rounded-full">VAULT</span>
                )}
                {(!tier || tier === 'free') && (
                  <span
                    onClick={(e) => { e.stopPropagation(); setShowUpgradeModal(true); }}
                    className="text-[10px] font-bold text-purple-600 bg-white border border-purple-200 px-2 py-0.5 rounded-full cursor-pointer hover:border-purple-400 hover:shadow-sm transition-all"
                  >
                    Go Pro
                  </span>
                )}
                {userProfile?.photo_url ? (
                  <img src={userProfile.photo_url} alt="Profile" className="w-8 h-8 rounded-full" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-sm">
                    {userProfile?.display_name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
              </button>
            ) : (
              <button
                onClick={() => router.push('/dashboard')}
                className="text-xs text-gray-600 hover:text-purple-600"
              >
                Log in
              </button>
            )}
          </div>

          {/* Mobile: profile initial + hamburger */}
          <div className="flex md:hidden items-center gap-3">
            {userProfile && (
              <>
                {(!tier || tier === 'free') && (
                  <span
                    onClick={() => setShowUpgradeModal(true)}
                    className="text-[10px] font-bold text-purple-600 bg-white border border-purple-200 px-2 py-0.5 rounded-full cursor-pointer"
                  >
                    Go Pro
                  </span>
                )}
                {(tier === 'pro') && (
                  <span title={tierTooltip} className="text-[10px] font-bold text-white bg-purple-600 px-2 py-0.5 rounded-full">PRO</span>
                )}
                {(tier === 'vault' || tier === 'maintenance') && (
                  <span title={tierTooltip} className="text-[10px] font-bold text-white bg-purple-600 px-2 py-0.5 rounded-full">VAULT</span>
                )}
              </>
            )}

            {/* Hamburger button — only for logged-in users (logged-out users see login modal only) */}
            {userProfile && <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex flex-col justify-center items-center w-8 h-8 gap-1.5"
              aria-label="Toggle menu"
            >
              <span
                style={{
                  display: 'block', width: 20, height: 2, borderRadius: 2,
                  background: menuOpen ? '#667eea' : '#374151',
                  transform: menuOpen ? 'rotate(45deg) translate(3px, 3px)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              />
              <span
                style={{
                  display: 'block', width: 20, height: 2, borderRadius: 2,
                  background: menuOpen ? 'transparent' : '#374151',
                  transition: 'all 0.2s ease'
                }}
              />
              <span
                style={{
                  display: 'block', width: 20, height: 2, borderRadius: 2,
                  background: menuOpen ? '#667eea' : '#374151',
                  transform: menuOpen ? 'rotate(-45deg) translate(3px, -3px)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              />
            </button>}
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.path)}
                className="w-full flex items-center justify-between px-5 py-3.5 border-b border-gray-100 text-left"
                style={{ background: currentPage === item.id ? 'rgba(147,51,234,0.05)' : 'transparent' }}
              >
                <span
                  className="text-sm font-medium"
                  style={{ color: currentPage === item.id ? '#7c3aed' : '#1a1a1a' }}
                >
                  {item.label}
                </span>
                {currentPage === item.id && (
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#7c3aed' }} />
                )}
              </button>
            ))}
            {userProfile && (
              <>
                <button
                  onClick={() => handleNavClick('/profile')}
                  className="w-full flex items-center justify-between px-5 py-3.5 border-b border-gray-100 text-left"
                >
                  <span className="text-sm font-medium text-gray-600">My Profile</span>
                  {userProfile?.display_name && (
                    <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-xs">
                      {userProfile.display_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </button>
                <button
                  onClick={async () => {
                    setMenuOpen(false);
                    const supabase = createClient();
                    await supabase.auth.signOut();
                    window.location.href = '/dashboard';
                  }}
                  className="w-full flex items-center justify-between px-5 py-3.5 text-left"
                >
                  <span className="text-sm font-medium text-gray-600">Sign Out</span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
    </>
  );
}