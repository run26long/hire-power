'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// ---------------------------------------------------------------------------
// ABOVE EVERYTHING, AND PORTALLED THERE
//
// A message about something that just failed has to be readable on top of
// whatever the person was doing when it failed. This rendered in place at
// z-index 70, which put it underneath the Career Profile's manage panels and
// lightbox (120), the recruiter backdrop (140), the select menu (200) and the
// tour (up to 10001). An error raised by a control inside any of those was
// painted behind it, so the action read as having quietly done nothing.
//
// Two things are needed together. The portal lifts the toast out of whatever
// stacking context the page that rendered it happens to sit in, so its number
// is compared against the top-level layers rather than its neighbours'. The
// number itself is above every layer the product defines. Nothing else about
// the toast changes.
// ---------------------------------------------------------------------------
const TOAST_LAYER = 10050;

export default function ErrorToast({ message, onClose }) {
  // document is not there to portal into until the browser has it.
  const [host, setHost] = useState(null);
  useEffect(() => { setHost(document.body); }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, [message]);

  if (!message || !host) return null;
  return createPortal(
    <div
      className="fixed bottom-6 left-1/2 flex items-center gap-4 px-5 py-3.5 shadow-2xl"
      style={{
        zIndex: TOAST_LAYER,
        transform: 'translateX(-50%)',
        borderRadius: '12px',
        background: '#1a1033',
        border: '1px solid rgba(229,115,115,0.3)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        minWidth: '340px',
        maxWidth: '480px',
      }}
    >
      <div
        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
        style={{ background: 'rgba(229,115,115,0.15)' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e57373" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <p className="text-xs text-white flex-1" style={{ opacity: 0.85, lineHeight: 1.4 }}>{message}</p>
      <button
        onClick={onClose}
        className="flex-shrink-0 text-white hover:opacity-60 transition-opacity text-lg leading-none font-light ml-1"
      >×</button>
    </div>,
    host
  );
}