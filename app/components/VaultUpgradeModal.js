'use client';

import { useRouter } from 'next/navigation';
import { UPGRADE_HREF, UPGRADE_LABEL } from '@/lib/tiers';

// ============================================================================
// THE VAULT PROMPT
//
// What a free account sees when it reaches something Vault pays for: logging
// a win, reading a past interview back, opening a resume it built while it
// was on Pro.
//
// WHY NOT UpgradeModal
// That one sells Pro, and it sells it with the Pro feature list. Half the
// things gated in this app are not Pro features - they are the things Vault
// exists to keep - and offering somebody a $29.99 plan when the $4.99 one
// would do is both wrong and annoying. This points at /profile?plan=vault,
// which the plan page already handles as a deep link.
//
// The sentence is passed in rather than written here. "Upgrade to keep your
// work" under a locked resume says nothing; "Your other core resumes are part
// of Vault and Pro" says what the money buys.
// ============================================================================

// ---- BOTH WAYS UP, WHERE BOTH ARE OFFERED ----
//
// `onChoosePro` is optional and the modal is unchanged without it: the same
// single Vault button, the same eyebrow, for the callers that only ever meant
// Vault. Pass it and the gate says what it actually is - part of two plans -
// and offers each. It is a callback rather than an href because there is no
// ?plan=pro deep link to point at; Pro checkout is the UpgradeModal the
// calling page already mounts, and one Pro checkout is enough.
export default function VaultUpgradeModal({ isOpen, onClose, title, message, onChoosePro }) {
  const router = useRouter();
  if (!isOpen) return null;
  const bothPaths = typeof onChoosePro === 'function';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(23,16,48,0.45)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md p-6"
        style={{ boxShadow: '0 24px 60px -20px rgba(23,16,48,0.45)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#7c3aed' }}>
          {bothPaths ? 'Part of Vault and Pro' : 'Part of Vault'}
        </p>
        <h2 style={{ marginTop: 10, fontSize: 21, fontWeight: 650, letterSpacing: '-0.02em', color: '#17132a' }}>
          {title || 'Keep what you have built.'}
        </h2>
        <p style={{ marginTop: 8, fontSize: 14, lineHeight: 1.55, color: '#5f5a72' }}>
          {message}
        </p>
        {bothPaths ? (
          /* Two plans, stacked so neither is a footnote of the other, and
             Vault first because it is the cheaper answer to everything this
             modal gates. Pro sits under it for somebody who is going back to
             searching rather than to keeping. */
          <div style={{ marginTop: 20 }}>
            <button
              onClick={() => router.push(UPGRADE_HREF)}
              className="w-full text-white rounded-lg py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
              style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
            >
              {UPGRADE_LABEL} — $4.99/mo
            </button>
            <button
              onClick={onChoosePro}
              className="w-full rounded-lg py-2.5 text-sm font-semibold transition-colors"
              style={{ marginTop: 8, color: '#5b21b6', background: '#f5f3ff', border: '1px solid #ddd6fe' }}
            >
              Upgrade to Pro — $29.99/mo
            </button>
            <button
              onClick={onClose}
              className="w-full py-2 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors"
              style={{ marginTop: 10 }}
            >
              Not now
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2" style={{ marginTop: 20 }}>
            <button
              onClick={() => router.push(UPGRADE_HREF)}
              className="flex-1 text-white rounded-lg py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
              style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
            >
              {UPGRADE_LABEL} — $4.99/mo
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              Not now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
