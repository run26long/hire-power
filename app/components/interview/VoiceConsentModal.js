'use client';

import { useEffect, useState } from 'react';

// Same gradient the interview modals use. Inline, like every other one:
// Tailwind classes here carry tints only.
const GRADIENT = { background: 'linear-gradient(to bottom right, #667eea, #764ba2)' };

// The version of these terms, stored on the consent row. Bump it whenever the
// copy below changes in a way a candidate would want to have been asked about
// again, and existing rows stop counting as consent to the new wording.
export const CONSENT_VERSION = '1.0';

// mode_3 never reaches this modal: the microphone is never opened, so there is
// nothing to consent to.
//
// Each option carries its own wording because the two are not variants of one
// statement. Consenting to transcription is not consenting to a stored
// recording, and the checkbox has to say which one is being agreed to.
const CONSENT_OPTIONS = [
  {
    key: 'mode_2',
    title: 'Voice only',
    description: 'Your audio is sent for transcription and then discarded. We never store the recording. Only your written transcript is saved.',
    checkbox: 'I consent to microphone access for voice transcription'
  },
  {
    key: 'mode_1',
    title: 'Voice with playback',
    description: 'Your audio is recorded and saved so you can listen back to your answers. Recordings are kept until you delete them in Settings.',
    checkbox: 'I consent to my audio being recorded and stored'
  }
];

// ============================================================================
// VOICE CONSENT MODAL
// Shown before the microphone is ever opened, and the place the voice mode is
// actually chosen. Owns no database access of its own: it collects the choice
// and hands the record up to the caller, which is the piece that knows who the
// user is.
//
// Declining is not a dead end. Cancel, Escape and a click outside all mean the
// same thing, and all of them land the candidate back in text mode with the
// interview still available to them.
// ============================================================================

export default function VoiceConsentModal({ onConsent, onCancel }) {
  // Nothing is chosen until they choose it. Neither option is a default,
  // because consenting to a microphone is not something to arrive at by not
  // noticing a box.
  const [consentMode, setConsentMode] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  // Mutually exclusive: the two are different consents, not two halves of one.
  // Ticking the active box again clears it, so there is a way back to having
  // agreed to neither.
  const chooseConsent = (modeKey) => {
    setConsentMode(prev => (prev === modeKey ? null : modeKey));
  };

  const handleContinue = async () => {
    if (!consentMode || saving) return;
    setSaving(true);
    try {
      await onConsent({
        mode_selected: consentMode,
        consent_version: CONSENT_VERSION,
        consented_at: new Date().toISOString(),
        ip_address: 'client',
        user_agent: typeof navigator === 'undefined' ? null : navigator.userAgent
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col"
        style={{ maxHeight: '80vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 flex-shrink-0" style={GRADIENT}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="h-8 w-8 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-lg">🎤</span>
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold text-white truncate">Voice Interview Mode</h2>
              </div>
            </div>
            <button
              onClick={onCancel}
              className="text-white hover:opacity-70 text-2xl leading-none font-light flex-shrink-0"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-5 flex-1 overflow-y-auto space-y-3" style={{ WebkitOverflowScrolling: 'touch' }}>
          <p className="text-sm md:text-xs text-gray-800 leading-snug">
            Voice mode uses your microphone so you can speak your answers out loud. Choose how you&apos;d like your audio handled:
          </p>

          {/* Title and description sit outside the label on purpose: only the
              checkbox is a target. aria-describedby keeps the description tied
              to the box for anyone who cannot see the two are one block. */}
          {CONSENT_OPTIONS.map(option => {
            const checked = consentMode === option.key;
            const descriptionId = `voice-consent-${option.key}`;
            return (
              <div key={option.key}>
                <p className="text-sm md:text-xs font-bold text-gray-900">{option.title}</p>
                <p id={descriptionId} className="text-sm md:text-xs text-gray-600 leading-snug mb-1.5">
                  {option.description}
                </p>
                <label className="flex items-start gap-2 cursor-pointer">
                  {/* The real input carries the semantics and keyboard
                      behaviour; the div beside it is what's actually seen. */}
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => chooseConsent(option.key)}
                    aria-describedby={descriptionId}
                    className="sr-only"
                  />
                  <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-colors mt-0.5 ${
                    checked ? 'bg-purple-600 border-purple-600' : 'border-gray-300 bg-white'
                  }`}>
                    {checked && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm md:text-xs text-gray-800 font-semibold">{option.checkbox}</span>
                </label>
              </div>
            );
          })}

          {/* The right to decline, which the privacy policy commits to this
              screen carrying. */}
          <p className="text-xs text-gray-400 leading-snug">
            You are never required to use voice. Text mode has every feature.
          </p>

          <div className="space-y-1.5 pt-1">
            <button
              onClick={handleContinue}
              disabled={!consentMode || saving}
              className="w-full text-white rounded-lg py-2.5 px-6 font-semibold text-sm md:text-xs transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              style={GRADIENT}
            >
              {saving && <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-r-transparent"></div>}
              {saving ? 'Saving...' : 'Continue'}
            </button>
            <button
              onClick={onCancel}
              disabled={saving}
              className="w-full text-sm md:text-xs text-gray-400 hover:text-gray-600 py-1 disabled:opacity-50"
            >
              Use Text Instead
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
