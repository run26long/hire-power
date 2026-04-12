'use client';

import { useState, useEffect } from 'react';
import { track } from '../utils/analytics';

export default function ResumeUploadModal({
  isOpen,
  onClose,
  onUploadSuccess,   // callback(resumeId) — caller handles routing
  existingResume,    // optional — Career Coach passes this
  userTier,          // 'pro' | 'free'
  builderPath,       // e.g. '/career-coach/build' or '/build?from=resume-coach'
  supabase,          // passed from parent
  router,            // passed from parent
  headerTitle = "Let's Get Started",
  headerSubtitle = "Your resume is the starting point.",
  bodyText = "Upload your resume and we'll use it as the starting point for coaching that discovers what you've actually accomplished.",
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  const isPro = userTier === 'pro';

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);

    try {
      const allowedTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];
      if (!allowedTypes.includes(file.type)) throw new Error('INVALID_TYPE');
      if (file.size > 10 * 1024 * 1024) throw new Error('FILE_TOO_LARGE');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('NOT_AUTHENTICATED');

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadErr } = await supabase.storage
        .from('resumes').upload(filePath, file);
      if (uploadErr) throw new Error('UPLOAD_FAILED');

      const { data: { session } } = await supabase.auth.getSession();

      const parseRes = await fetch('/api/parse-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ filePath })
      });
      if (!parseRes.ok) throw new Error('PARSE_FAILED');
      const { text } = await parseRes.json();

      const extractRes = await fetch('/api/extract-resume-structure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ parsedText: text })
      });
      if (!extractRes.ok) throw new Error('EXTRACT_FAILED');
      const { data: resumeData } = await extractRes.json();

      const { data: savedResume, error: saveErr } = await supabase
        .from('resumes').insert({
          user_id: user.id,
          resume_type: 'core',
          display_name: 'Core Resume',
          resume_data: resumeData,
          journey_step: 'review',
          file_path: filePath
        }).select().single();
      if (saveErr) throw new Error('SAVE_FAILED');

      track('resume_uploaded', { method: 'upload' });
      onClose();
      onUploadSuccess(savedResume.id);

    } catch (err) {
      console.error('Upload error:', err);
      const messages = {
        INVALID_TYPE: 'Please upload a PDF or DOCX file.',
        FILE_TOO_LARGE: 'File is too large. Maximum size is 10MB.',
        PARSE_FAILED: "Couldn't read file. Try a different format.",
        NOT_AUTHENTICATED: 'Session expired. Please refresh and try again.',
        UPLOAD_FAILED: 'Upload failed. Please try again.',
        EXTRACT_FAILED: 'Upload failed. Please try again.',
        SAVE_FAILED: 'Upload failed. Please try again.',
      };
      setUploadError(messages[err.message] || 'Upload failed. Please try again.');
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)' }}
      onClick={onClose}
    >
      <div
        className="bg-white shadow-2xl max-w-lg w-full overflow-hidden border border-gray-200"
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Modal Header */}
        <div
          style={{ background: 'linear-gradient(to bottom right, #9333ea, #6b21a8)', borderRadius: '8px 8px 0 0' }}
          className="px-6 py-5 relative flex-shrink-0"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:text-gray-200 text-3xl leading-none font-light"
          >×</button>
          <div className="flex items-center gap-3">
            <img src="/images/Hire_Power_icon.png" alt="Hire Power" className="h-8 w-auto flex-shrink-0" />
            <div>
              <h2 className="text-xl font-bold text-white">{headerTitle}</h2>
              <p className="text-purple-100 text-xs">{headerSubtitle}</p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="px-6 py-6 flex flex-col gap-4">
          <p style={{color: 'red'}}>DEBUG: component body rendering</p>

          <p className="text-sm text-gray-700 text-center leading-relaxed">{bodyText}</p>

          {/* Existing resume banner — Career Coach only */}
          {existingResume && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-green-800">✓ Resume Found</p>
                <p className="text-xs text-green-700">Core Resume on file</p>
              </div>
              <button
                onClick={() => { onClose(); onUploadSuccess(existingResume.id); }}
                className="text-white px-4 py-2 rounded-lg hover:opacity-90 font-semibold text-xs whitespace-nowrap"
                style={{ background: 'linear-gradient(to right, #9333ea, #6b21a8)' }}
              >
                Use This Resume →
              </button>
            </div>
          )}

          {/* Primary action buttons */}
          <div className="flex flex-col items-center gap-3">

            {/* Upload button — always shown */}
            <label className="block cursor-pointer w-full max-w-xs">
              <input
                type="file"
                accept=".pdf,.docx"
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploading}
              />
              <div
                className="text-white px-4 py-2.5 rounded-lg hover:opacity-90 font-semibold text-sm cursor-pointer flex items-center justify-center gap-2 w-full"
                style={{ background: 'linear-gradient(to right, #9333ea, #6b21a8)' }}
              >
                {uploading ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                    Uploading...
                  </>
                ) : existingResume ? 'Upload a Different Resume' : 'Upload Resume'}
              </div>
            </label>

            {uploadError && (
              <p className="text-xs text-red-600 text-center">{uploadError}</p>
            )}

            {/* Build with Chat — Pro only, desktop only, Coming Soon */}
            {isPro && !isMobile && (
              <button
                disabled
                className="w-full max-w-xs px-4 py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 border-2 border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed"
              >
                💬 Build with Chat
                <span className="text-[10px] font-bold bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded ml-1">
                  Coming Soon
                </span>
              </button>
            )}

            {/* Mobile note for Pro — Build with Chat coming */}
            {isPro && isMobile && (
              <p className="text-xs text-gray-400 text-center">
                Build with Chat coming soon — available on desktop for Pro members.
              </p>
            )}

            {/* Builder text link — desktop only for free, hidden on mobile */}
            {!isMobile && (
              <button
                onClick={() => { onClose(); router.push(builderPath); }}
                className="text-xs text-purple-600 hover:text-purple-700 font-medium hover:underline"
              >
                No resume yet? Build from scratch →
              </button>
            )}

            {/* Mobile note for free users */}
            {!isPro && isMobile && (
              <p className="text-xs text-gray-400 text-center">
                Need to build a resume?{' '}
                <span className="font-medium">Use a desktop browser</span>
                {' '}or{' '}
                <button
                  onClick={() => { onClose(); router.push('/upgrade'); }}
                  className="text-purple-600 font-medium hover:underline"
                >
                  upgrade to Pro
                </button>
                {' '}to Build with Chat on mobile.
              </p>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}