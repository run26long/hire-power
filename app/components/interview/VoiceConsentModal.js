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
const MODE_COPY = {
  mode_2: {
    title: 'Voice Interview',
    what: 'Your answers will be captured by your microphone and sent to our transcription service for processing. The audio is processed in memory only and is never stored. Only the text transcript is saved.',
    kept: 'We keep the transcript of each answer and your delivery scores, until you delete them or your account. We never keep the audio.',
    checkbox: 'I understand and agree'
  },
  // Deliberately blunter than mode_2. This is the one mode that keeps a
  // recording of someone's voice, so the screen says so in as many words
  // rather than leaving it to be inferred from "playback".
  mode_1: {
    title: 'Voice Interview + Playback',
    what: 'Your answers will be captured by your microphone, transcribed, and saved as audio recordings on our servers. A recording of your voice is stored for every answer you give, so that you can replay it afterwards.',
    kept: 'We keep your recordings, transcripts, and delivery scores until you delete them or your account. You can play back or delete any recording at any time in Settings.',
    checkbox: 'I understand my audio will be recorded and stored'
  }
};

// ============================================================================
// VOICE CONSENT MODAL
// Shown once per mode, before the microphone is ever opened. Owns no database
// access of its own: it collects the acknowledgment and hands the record up to
// the caller, which is the piece that knows who the user is.
//
// Declining is not a dead end. Cancel, Escape and a click outside all mean the
// same thing, and all of them land the candidate back in text mode with the
// interview still available to them.
// ============================================================================

export default function VoiceConsentModal({ onConsent, onCancel }) {
  // Off is the recommendation. The mode that keeps nothing is the one someone
  // lands on without choosing, so opting into a recording is a deliberate act
  // rather than a default they have to notice and undo.
  const [wantsRecording, setWantsRecording] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);

  // Derived rather than stored alongside the checkbox: two pieces of state
  // saying the same thing is two pieces of state that can disagree.
  const selectedMode = wantsRecording ? 'mode_1' : 'mode_2';

  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const copy = MODE_COPY[selectedMode];
  if (!copy) return null;

  // Changing the recording choice clears the tick. The two statements are not
  // the same statement, and agreeing to the milder one is not agreeing to the
  // other.
  const toggleRecording = (checked) => {
    setWantsRecording(checked);
    setAgreed(false);
  };

  const handleContinue = async () => {
    if (!agreed || saving) return;
    setSaving(true);
    try {
      await onConsent({
        mode_selected: selectedMode,
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
          {/* What happens, before anything is asked of them. All three
              sections move with the recording checkbox below. */}
          <div>
            <p className="text-xs font-bold text-purple-700 uppercase tracking-wide mb-0.5">{copy.title}</p>
            <p className="text-sm md:text-xs text-gray-800 leading-snug">{copy.what}</p>
          </div>

          {/* Retention and the right to decline. Not decoration: the privacy
              policy commits to both appearing on this screen. */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-0.5">How long we keep it</p>
            <p className="text-sm md:text-xs text-gray-800 leading-snug">{copy.kept}</p>
          </div>

          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-0.5">Your right to decline</p>
            <p className="text-sm md:text-xs text-gray-800 leading-snug">
              You are never required to use voice. Every part of interview practice works in text mode,
              and declining changes nothing else about your account.
            </p>
          </div>

          {/* The opt-in comes first because the affirmation beneath it is
              worded by what this one says. */}
          <label className="flex items-start gap-2 cursor-pointer pt-0.5">
            <input
              type="checkbox"
              checked={wantsRecording}
              onChange={e => toggleRecording(e.target.checked)}
              className="sr-only"
            />
            <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-colors mt-0.5 ${
              wantsRecording ? 'bg-purple-600 border-purple-600' : 'border-gray-300 bg-white'
            }`}>
              {wantsRecording && (
                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className="text-sm md:text-xs text-gray-800">Record and save my answers for playback</span>
          </label>

          <label className="flex items-start gap-2 cursor-pointer">
            {/* The real input carries the semantics and keyboard behaviour; the
                div beside it is what's actually seen. */}
            <input
              type="checkbox"
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              className="sr-only"
            />
            <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-colors mt-0.5 ${
              agreed ? 'bg-purple-600 border-purple-600' : 'border-gray-300 bg-white'
            }`}>
              {agreed && (
                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className="text-sm md:text-xs text-gray-800 font-semibold">{copy.checkbox}</span>
          </label>

          <div className="space-y-1.5 pt-1">
            <button
              onClick={handleContinue}
              disabled={!agreed || saving}
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
