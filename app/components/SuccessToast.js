'use client';

import { useEffect } from 'react';

export default function SuccessToast({ message, onClose }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose();
    }, 4000);
    return () => clearTimeout(timer);
  }, [message]);

  if (!message) return null;
  return (
    <div
      className="fixed bottom-6 left-1/2 z-[70] flex items-center gap-4 px-5 py-3.5 shadow-2xl"
      style={{
        transform: 'translateX(-50%)',
        borderRadius: '12px',
        background: '#1a1033',
        border: '1px solid rgba(129,199,132,0.3)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        minWidth: '340px',
        maxWidth: '480px',
      }}
    >
      <div
        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
        style={{ background: 'rgba(129,199,132,0.15)' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#81c784" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <p className="text-xs text-white flex-1" style={{ opacity: 0.85, lineHeight: 1.4 }}>{message}</p>
      <button
        onClick={onClose}
        className="flex-shrink-0 text-white hover:opacity-60 transition-opacity text-lg leading-none font-light ml-1"
      >×</button>
    </div>
  );
}