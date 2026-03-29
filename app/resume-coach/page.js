'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import MainNav from '../components/MainNav';
import UpgradeModal from '../components/UpgradeModal';
import { TIERS } from '@/lib/subscription';

export default function MyResumesPage() {
  const router = useRouter();
  const supabase = createClient();

 const getBreakdownLabel = (score, max) => {
  const pct = (score / max) * 100
  if (pct >= 85) return { label: 'Excellent', color: '#9333ea', text: 'text-purple-600' }
  if (pct >= 75) return { label: 'Strong', color: '#81c784', text: 'text-green-600' }
  if (pct >= 60) return { label: 'Developing', color: '#ffc870', text: 'text-yellow-600' }
  return { label: 'Needs Work', color: '#e57373', text: 'text-red-600' }
}
  
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [retryCount, setRetryCount] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadingResumeId, setDownloadingResumeId] = useState(null);
  const [downloadError, setDownloadError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  
 // Job-specific modal state
  const [showJobModal, setShowJobModal] = useState(false);
  const [jobModalSourceId, setJobModalSourceId] = useState(null);
  const [jobTitle, setJobTitle] = useState('');
  const [jobCompany, setJobCompany] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [creatingJob, setCreatingJob] = useState(false);
  const [jobCreateError, setJobCreateError] = useState(null);

  // Cover letter state
  const [showCLModal, setShowCLModal] = useState(false);
  const [clSourceType, setClSourceType] = useState(null); // null | 'js_resume' | 'scratch'
  const [clSelectedJSId, setClSelectedJSId] = useState('');
  const [clJobTitle, setClJobTitle] = useState('');
  const [clCompany, setClCompany] = useState('');
  const [clJobDescription, setClJobDescription] = useState('');
  const [creatingCL, setCreatingCL] = useState(false);
  const [clCreateError, setClCreateError] = useState(null);
  const [confirmDeleteCLId, setConfirmDeleteCLId] = useState(null);
  const [deletingCLId, setDeletingCLId] = useState(null);

  // Overflow modals
  const [showOlderJSModal, setShowOlderJSModal] = useState(false);
  const [showOlderCLModal, setShowOlderCLModal] = useState(false);

const [careerContext, setCareerContext] = useState(null);

useEffect(() => {
  const fetchCareerContext = async () => {
    const { data } = await supabase
      .from('career_context')
      .select('completed_at')
      .eq('user_id', user.id)
      .single();
    setCareerContext(data);
  };
  if (user?.id) fetchCareerContext();
}, [user?.id]);

const careerCoachComplete = careerContext && careerContext.completed_at !== null;

  // Tour modal state
  const [showTourModal, setShowTourModal] = useState(false);
  const [tourScreen, setTourScreen] = useState(1);
  const [hasSeenTour, setHasSeenTour] = useState(false);

 useEffect(() => {
    loadData();
    // Check for job-specific creation trigger from SaveStep
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'new-job-specific') {
      const fromId = params.get('from');
      setJobModalSourceId(fromId);
      setShowJobModal(true);
      // Clean URL without reload
      window.history.replaceState({}, '', '/resume-coach');
    }
  }, []);

  async function loadData() {
    try {
      setLoadError(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/dashboard');
        return;
      }
      setUser(user);

      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;
      
      if (!session) {
        router.push('/dashboard');
        return;
      }

      const response = await fetch('/api/resume-coach/data', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to load data');
      }
      
      const resData = await response.json();
      setData(resData);
      setUserProfile(resData.userProfile);
      setRetryCount(0); // Reset retry count on success
      
      // Check if we should show tour (only if no resume)
      // Small delay to let page render before showing modal
      if (!resData.coreResume) {
        setTimeout(() => {
          const tourSeen = localStorage.getItem('hp_tour_seen');
          if (!tourSeen) {
            setHasSeenTour(false);
            setShowTourModal(true);
            setTourScreen(1);
          } else {
            setHasSeenTour(true);
            setShowTourModal(true);
            setTourScreen(3);
          }
        }, 300); // 300ms delay
      }
      
    } catch (error) {
      console.error('Error loading data:', error);
      
      // Auto-retry once
      if (retryCount === 0) {
        setRetryCount(1);
        setTimeout(() => loadData(), 1000); // Retry after 1 second
      } else {
        // Show error after retry fails
        setLoadError('Couldn\'t load your resumes. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  function getScoreColor(score) {
    if (!score) return 'text-gray-400';
    if (score >= 85) return 'text-purple-600';
    if (score >= 75) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  }

  function getScoreTier(score) {
    if (!score) return 'Not Assessed';
    if (score >= 85) return 'Excellent';
    if (score >= 75) return 'Strong';
    if (score >= 60) return 'Developing';
    return 'Needs Work';
  }

  function getCircleColor(score) {
    if (score >= 85) return '#9333ea';
    if (score >= 75) return '#81c784';
    if (score >= 60) return '#ffc870';
    return '#e57373';
  }

  function formatDate(dateString) {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // Modal state and handlers
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Tour handlers
  const handleNextTourScreen = () => {
    setTourScreen(tourScreen + 1);
  };

  const handleSkipTour = () => {
    localStorage.setItem('hp_tour_seen', 'true');
    setShowTourModal(false);
  };

  const handleCompleteTour = () => {
    localStorage.setItem('hp_tour_seen', 'true');
    setShowTourModal(false);
  };

  // Handle file upload (from empty state)
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Clear previous errors
    setUploadError(null);
    setUploading(true);

    try {
      // Validate file type
      const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error('INVALID_TYPE');
      }

      // Validate file size (10MB max)
      const maxSize = 10 * 1024 * 1024; // 10MB in bytes
      if (file.size > maxSize) {
        throw new Error('FILE_TOO_LARGE');
      }

      // 1. Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('resumes')
        .upload(filePath, file);

      if (uploadError) throw new Error('UPLOAD_FAILED');

      // 2. Parse the file (extract text)
      const parseResponse = await fetch('/api/parse-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath })
      });

      if (!parseResponse.ok) {
        throw new Error('PARSE_FAILED');
      }

      const { text } = await parseResponse.json();

      // 3. Extract structured data
      const extractResponse = await fetch('/api/extract-resume-structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parsedText: text })
      });

      if (!extractResponse.ok) {
        throw new Error('EXTRACT_FAILED');
      }

      const { data: resumeData } = await extractResponse.json();

      // 4. Save to database (resumes table)
      const { data: savedResume, error: saveError } = await supabase
        .from('resumes')
        .insert({
          user_id: user.id,
          resume_type: 'core',
          display_name: 'Core Resume',
          resume_data: resumeData,
          journey_step: 'review',
          file_path: filePath
        })
        .select()
        .single();

      if (saveError) throw new Error('SAVE_FAILED');

      // 5. Redirect to resume detail page
      router.push(`/resume/${savedResume.id}`);

    } catch (error) {
      console.error('Upload error:', error);
      
      // Set specific error messages
      let errorMessage = 'Upload failed. Please try again.';
      
      if (error.message === 'INVALID_TYPE') {
        errorMessage = 'Please upload a PDF or DOCX file.';
      } else if (error.message === 'FILE_TOO_LARGE') {
        errorMessage = 'File is too large. Maximum size is 10MB.';
      } else if (error.message === 'PARSE_FAILED') {
        errorMessage = 'Couldn\'t read file. Try a different format.';
      } else if (error.message === 'UPLOAD_FAILED' || error.message === 'EXTRACT_FAILED' || error.message === 'SAVE_FAILED') {
        errorMessage = 'Upload failed. Please try again.';
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorMessage = 'Connection lost. Check your internet.';
      }
      
      setUploadError(errorMessage);
      setUploading(false);
    }
  };

  // Button handlers
  const handleOpenResume = (resumeId) => {
    router.push(`/resume/${resumeId}`);
  };

  const handleDownloadResume = async (resumeId) => {
    try {
      setDownloadingResumeId(resumeId); // Mark this resume as downloading
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      // Fetch the resume DIRECTLY from Supabase (same as resume detail page)
      // This ensures we get the complete resume_data field
      const { data: resume, error } = await supabase
        .from('resumes')
        .select('*')
        .eq('id', resumeId)
        .eq('user_id', user.id)
        .single();

      if (error || !resume) {
        throw new Error('Resume not found');
      }

      // Now resume has resume_data just like in the detail page!
      // Convert font size to API format
      let fontSizeForApi = 'medium';
      const resumeFontSize = resume.font_size || 11;
      if (resumeFontSize <= 10) fontSizeForApi = 'small';
      else if (resumeFontSize === 11) fontSizeForApi = 'medium';
      else if (resumeFontSize >= 12) fontSizeForApi = 'large';
      
      // Capitalize template name
      const templateName = resume.template_id || 'modern';
      const templateForApi = templateName.charAt(0).toUpperCase() + templateName.slice(1);

      // Call PDF generation API
      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resumeData: resume,
          templateName: templateForApi,
          fontSize: fontSizeForApi,
          action: 'download',
          versionId: null,
          isJobVersion: false,
          userId: user.id
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API Error:', errorData);
        throw new Error('PDF generation failed');
      }

      const result = await response.json();
      
      // Fetch PDF as blob
      const pdfResponse = await fetch(result.pdfUrl);
      const blob = await pdfResponse.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      // Download with proper filename - EXACT same logic as resume detail page
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${(resume.resume_data?.fullName || 'Resume').replace(/\s+/g, '_')}_Resume.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
      
    } catch (error) {
      console.error('Error downloading resume:', error);
      alert('There was a problem downloading your resume. Please try again.');
    } finally {
      setDownloadingResumeId(null); // Clear downloading state
    }
  };

  const handleDeleteResume = async (resumeId) => {
    try {
      setDeletingId(resumeId);
      const { error: childError } = await supabase
        .from('resumes')
        .delete()
        .eq('parent_resume_id', resumeId)
        .eq('user_id', user.id);
      if (childError) throw childError;

      const { error } = await supabase
        .from('resumes')
        .delete()
        .eq('id', resumeId)
        .eq('user_id', user.id);
      if (error) throw error;
      setConfirmDeleteId(null);
      await loadData();
    } catch (error) {
      console.error('Delete error:', error?.message || error?.code || JSON.stringify(error));
      alert('Could not delete resume. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleCopyToJobSpecific = (resumeId) => {
    const isProUser = data?.userTier === TIERS.PRO;
    if (isProUser) {
      setJobModalSourceId(resumeId);
      setShowJobModal(true);
    } else {
      setShowUpgradeModal(true);
    }
  };

  async function handleCreateJobSpecific() {
    if (!jobTitle.trim() || !jobCompany.trim() || !jobDescription.trim()) {
      setJobCreateError('Please fill in all three fields.');
      return;
    }
    setCreatingJob(true);
    setJobCreateError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get source resume data
      const sourceId = jobModalSourceId || data?.coreResume?.id;
      const { data: sourceResume, error: fetchError } = await supabase
        .from('resumes')
        .select('*')
        .eq('id', sourceId)
        .single();
      if (fetchError) throw fetchError;

      // Create job-specific resume record
      const { data: newResume, error: insertError } = await supabase
        .from('resumes')
        .insert({
          user_id: user.id,
          resume_type: 'job_specific',
          parent_resume_id: sourceId,
          display_name: `${jobTitle} at ${jobCompany}`,
          resume_data: sourceResume.resume_data,
          job_title: jobTitle,
          job_company: jobCompany,
          job_description: jobDescription,
          journey_step: 'assess',
          template_id: sourceResume.template_id || 'modern',
          font_family: sourceResume.font_family || 'Lato',
          font_size: sourceResume.font_size || 11,
        })
        .select()
        .single();
      if (insertError) throw insertError;

      // Run job analysis
      const analysisRes = await fetch('/api/job-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeData: sourceResume.resume_data,
          jobDescription,
          jobTitle,
          jobCompany,
          userId: user.id
        })
      });
      const analysis = await analysisRes.json();

      // Save analysis to new resume
      await supabase
        .from('resumes')
        .update({
          current_score: analysis.matchScore,
          ai_analysis: analysis,
          last_assessed_at: new Date().toISOString()
        })
        .eq('id', newResume.id);

      // Navigate to new resume
      router.push(`/resume/${newResume.id}`);
    } catch (err) {
      console.error('Error creating job-specific resume:', err);
      setJobCreateError('Something went wrong. Please try again.');
    } finally {
      setCreatingJob(false);
    }
  }

  async function handleCreateCoverLetter() {
    setCreatingCL(true);
    setClCreateError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (!clJobTitle.trim() || !clCompany.trim() || !clJobDescription.trim()) {
        setClCreateError('Please fill in all fields.');
        setCreatingCL(false);
        return;
      }

      const jobTitle = clJobTitle;
      const jobCompany = clCompany;
      const jobDescription = clJobDescription;
      const linkedResumeId = clSelectedJSId || data.coreResume.id;
      const sourceResumeId = clSelectedJSId || data.coreResume.id;
      const { data: sourceResume } = await supabase
        .from('resumes')
        .select('resume_data, template_id, font_family')
        .eq('id', sourceResumeId)
        .single();

      const generateRes = await fetch('/api/cover-letter-finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeData: sourceResume?.resume_data,
          jobTitle,
          jobCompany,
          jobDescription
        })
      });

      if (!generateRes.ok) throw new Error('Cover letter generation failed');
      const { coverLetterData } = await generateRes.json();

      const { data: newCL, error: insertError } = await supabase
        .from('cover_letters')
        .insert({
          user_id: user.id,
          linked_resume_id: linkedResumeId,
          job_title: jobTitle,
          job_company: jobCompany,
          job_description: jobDescription,
          cover_letter_data: coverLetterData,
          template_id: sourceResume?.template_id || 'modern',
          font_family: sourceResume?.font_family || 'Lato',
          status: 'draft'
        })
        .select()
        .single();

      if (insertError) throw insertError;

      router.push(`/cover-letter/${newCL.id}`);
    } catch (err) {
      console.error('Error creating cover letter:', err);
      setClCreateError('Something went wrong. Please try again.');
    } finally {
      setCreatingCL(false);
    }
  }

  const handleDeleteCoverLetter = async (clId) => {
    try {
      setDeletingCLId(clId);
      const { error } = await supabase
        .from('cover_letters')
        .delete()
        .eq('id', clId)
        .eq('user_id', user.id);
      if (error) throw error;
      setConfirmDeleteCLId(null);
      await loadData();
    } catch (error) {
      console.error('Delete CL error:', error);
      alert('Could not delete cover letter. Please try again.');
    } finally {
      setDeletingCLId(null);
    }
  };

  const handleCreateNew = () => {
    const isProUser = data?.userTier === TIERS.PRO;
    if (isProUser) {
      setJobModalSourceId(data?.coreResume?.id || null);
      setShowJobModal(true);
    } else {
      setShowUpgradeModal(true);
    }
  };

  const handleStartCoaching = async () => {
    if (!data?.coreResume) return;
    
    const journeyStep = data.coreResume.journey_step || 'review';
    const resumeId = data.coreResume.id;
    
    // Special case: If journey is "save", trigger download instead of navigating
    if (journeyStep === 'save') {
      setIsDownloading(true);
      await handleDownloadResume(resumeId);
      setIsDownloading(false);
      return;
    }
    
    // Navigate to appropriate step for all other journey steps
   const nextSteps = isPro ? {
      review: `/resume/${resumeId}?step=assess`,
      assess: `/resume/${resumeId}?step=coach`,
      coach: `/resume/${resumeId}?step=improve`,
      improve: `/resume/${resumeId}?step=format`,
      format: `/resume/${resumeId}?step=save`
    } : {
      review: `/resume/${resumeId}?step=assess`,
      assess: `/resume/${resumeId}?step=coach`,
      coach: `/resume/${resumeId}?step=improve`,
      improve: `/resume/${resumeId}?step=format`,
      format: `/resume/${resumeId}?step=save`
    };
    
    router.push(nextSteps[journeyStep] || `/resume/${resumeId}`);
  };

  // Journey step messages (tier-specific)
  const getJourneyMessage = (step) => {
    const isFree = !isPro; // Free tier check
    
    const messages = {
      review: "Your resume is in! Now make sure everything landed in the right place - AI parsing is good, not perfect. Give it a quick review, then we'll assess.",
      assess: "Time for your baseline. Get your Resume Power Score and a breakdown of what's working and what's not - specific to your experience, not generic advice.",
      coach: isFree
        ? "Get a taste of what coaching can do. We'll have a real conversation about one of your jobs and surface an achievement worth adding — then you decide if you want the full session."
        : "Your coach can't improve what's not on the page. Through conversation, we'll uncover quantifiable achievements, transferable skills, and results you forgot were impressive.",
     improve: isFree 
        ? "Review the suggestions from your assessment and make changes directly to your resume. When you're done, save and download."
        : "The big reveal! See your updated Resume Power Score, review each improvement your coach made, then keep, edit, or reject each change.",
      format: "Content is locked in. Run Auto-fit to get the perfect page fit, try different templates, and preview before downloading.",
      save: isFree
        ? "Your core resume is complete! Download it for immediate use, and when you're ready, upload a job description to see how well your resume matches that role."
        : "Your core resume is bulletproof. Download it for immediate use, and when you're ready, create a job-specific version that builds on this foundation."
    };
    return messages[step] || messages.review;
  };

  // Get button text based on journey step
  const getButtonText = (step) => {
    const buttonText = {
      review: "Start Review",
      assess: "Start Assessment",
      coach: "Start Coaching",
      improve: "Improve Resume",
      format: "Format Resume",
      save: "Download Resume"
    };
    return buttonText[step] || "Continue";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-purple-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // Show error state if loading failed
  if (loadError) {
    return (
      <div className="h-screen bg-gray-50 flex">
        {/* Left Sidebar */}
        <div className="w-64 bg-gradient-to-br from-purple-600 to-blue-600 text-white p-6 flex flex-col h-screen overflow-hidden flex-shrink-0">
          <h1 className="text-2xl font-bold mb-8">HIRE POWER</h1>
        </div>

        {/* Main Content */}
        <div className="ml-64 flex-1 flex flex-col h-screen overflow-hidden">
          <MainNav currentPage="resume-coach" userProfile={userProfile} onUpgradeClick={() => setShowUpgradeModal(true)} />

          <div className="flex-1 overflow-y-auto">
            <div className="px-8 py-4 max-w-[1400px] mx-auto w-full">
              {/* Error State - Centered */}
              <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 200px)' }}>
                <div className="bg-white rounded-lg shadow-sm border-2 border-amber-200 p-8 max-w-md text-center">
                  <svg className="w-16 h-16 text-amber-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load Resumes</h2>
                  <p className="text-sm text-gray-600 mb-6">{loadError}</p>
                  <button
                    onClick={() => {
                      setLoadError(null);
                      setRetryCount(0);
                      setLoading(true);
                      loadData();
                    }}
                    className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors font-medium"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isPro = data?.userTier === TIERS.PRO;
  const score = data?.coreResume?.current_score || null;
  const journeyStep = data?.coreResume?.journey_step || 'review';
  
  // Show placeholder scores in review OR assess steps (before assessment runs) OR when no score exists
  const showPlaceholder = journeyStep === 'review' || journeyStep === 'assess' || !score;

  // Journey steps for progress bar (tier-specific)
 const steps = isPro 
    ? ['review', 'assess', 'coach', 'improve', 'format', 'save']
    : ['review', 'assess', 'coach', 'improve', 'format', 'save'];
  const currentIndex = data?.coreResume?.journey_step ? steps.indexOf(data.coreResume.journey_step) : -1;
  const totalSteps = steps.length;

  return (
    <div className="h-screen bg-gray-50 flex">
      
      {/* Left Sidebar */}
      <div 
        className="w-64 text-white flex flex-col fixed left-0 top-0 shadow-lg z-40"
        style={{ 
          background: 'linear-gradient(180deg, #667eea 0%, #764ba2 100%)',
          height: '100vh',
          overflowY: 'hidden'
        }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex-shrink-0">
          <h1 className="text-[28px] font-bold mb-1.5 whitespace-nowrap tracking-tight">Resume Coach</h1>
          <p className="text-[13px] text-white text-opacity-95 leading-tight tracking-tight mb-0.5">
            Job hunting is small talk.
          </p>
          <p className="text-[13px] text-white text-opacity-95 leading-tight tracking-tight">
            Your career deserves a conversation.
          </p>
          <div className="mt-4 border-b border-gray-400 border-opacity-10"></div>
        </div>
        
        {/* Main Content */}
        <div className="px-6 pt-3 pb-6">

          {/* Intro copy */}
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#fff', lineHeight: 1.35, marginBottom: 9 }}>
              AI knows how to write a great résumé. The problem is, it doesn't know you.
            </p>
            <p style={{ fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,0.8)', lineHeight: 1.4, marginBottom: 0 }}>
              Most AI tools can only work with what's on the page. Resume Coach asks what's missing — just like a professional résumé writer would.
            </p>
          </div>

          {/* Feature List */}
          <div style={{ marginBottom: 16 }}>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
              {[
                { label: 'AI Assessment' },
                { label: 'Resume Power Score' },
                { label: 'Detailed Action Plan' },
                { label: 'Coaching Conversation', pro: true },
                { label: 'Achievement Discovery', pro: true },
                { label: 'Skill Identification', pro: true },
                { label: 'Auto Improvements', pro: true },
                { label: 'Match Score' },
                { label: 'Job-Specific Resumes', pro: true },
              ].map(({ label, pro }) => (
                <li key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', flexShrink: 0 }}>•</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)', lineHeight: 1.2 }}>
                    {label}{pro && <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.55)', marginLeft: 3 }}>(Pro)</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>

        {/* Bottom section */}
          <div style={{ marginTop: 16 }}>
            <div className="border-b border-gray-400 border-opacity-10" style={{ marginBottom: 14 }}></div>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#fff', lineHeight: 1.35, marginBottom: 30 }}>
              The AI that interviews you like a professional résumé writer would.
            </p>
            <div className="flex items-center gap-2.5 text-white">
              <img 
                src="/images/Hire_Power_icon.png" 
                alt="Lightning" 
                className="h-5 w-auto flex-shrink-0"
              />
              <p className="text-sm font-medium leading-tight">
                Let's start your conversation.
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* Main Content Area */}
      <div className="ml-64 flex-1 flex flex-col h-screen overflow-hidden">
        <MainNav currentPage="resume-coach" userProfile={userProfile} />

        <div className="flex-1 overflow-y-auto">
          <div className="px-8 py-4 max-w-[1400px] mx-auto w-full">
            
            {/* Clean 2-Column Layout - NO OLD BANNER */}
            {data?.coreResume && (
              <div className="grid grid-cols-12 gap-6">
                
                {/* Core Resume Card (8 cols) */}
                <div className="col-span-8">
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                    <h2 className="text-lg font-semibold text-gray-900">Core Resume</h2>
                    <p className="text-xs text-gray-500 mb-3">Complete resume you can use for any job in your field</p>
                    
                    {/* Thumbnail LEFT | Score RIGHT */}
                    <div className="grid grid-cols-12 gap-4 mb-4">
                      
                      {/* Left: Thumbnail (35%) */}
                      <div className="col-span-4">
                        <div className="relative">
                          <div
                            onClick={() => router.push(`/resume/${data.coreResume.id}`)}
                            className="w-full group cursor-pointer"
                          >
                            <div className="relative bg-white rounded-lg overflow-hidden shadow-sm border border-gray-200" style={{ aspectRatio: '8.5/11' }}>
                              {data.coreResume.thumbnail_url ? (
                                <img 
                                  src={data.coreResume.thumbnail_url} 
                                  alt="Resume preview"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gray-50">
                                  <div className="text-center">
                                    <div className="text-3xl mb-1">📄</div>
                                    <div className="text-sm text-gray-500">Ava Long</div>
                                  </div>
                                </div>
                              )}
                              
                              {/* Hover Overlay */}
                              <div className="absolute inset-0 bg-gray-900 bg-opacity-60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                {/* Gear/Settings - Opens resume */}
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenResume(data.coreResume.id);
                                  }}
                                  className="w-9 h-9 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center text-white transition-colors"
                                  title="Open resume"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                </button>
                                {/* Copy - Create job-specific */}
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopyToJobSpecific(data.coreResume.id);
                                  }}
                                  className="w-9 h-9 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center text-white transition-colors"
                                  title="Create job-specific resume"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                </button>
                                {/* Download */}
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownloadResume(data.coreResume.id);
                                  }}
                                  disabled={downloadingResumeId === data.coreResume.id}
                                  className="w-9 h-9 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Download PDF"
                                >
                                  {downloadingResumeId === data.coreResume.id ? (
                                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                  ) : (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                  )}
                                </button>
                                {/* Delete */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmDeleteId(data.coreResume.id);
                                  }}
                                  className="w-9 h-9 rounded-full bg-[#e57373] hover:bg-[#c62828] flex items-center justify-center text-white transition-colors"
                                  title="Delete resume"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                          
                          {/* Single-line footer - subtle */}
                          <div className="mt-2 text-center text-xs text-gray-500">
                            Ava Long • Edited {formatDate(data.coreResume.updated_at).split(',')[0]}
                          </div>
                        </div>
                      </div>
                      
                      {/* Right: Score Section (65%) */}
                      <div className="col-span-8 flex flex-col justify-between py-3">
                        {/* Giant Score */}
                        <div className="text-center">
                          <div className="mb-3">
                            {!showPlaceholder ? (
                              <>
                                <span className="text-7xl font-bold text-gray-900">{score}</span>
                                <span className="text-3xl text-gray-400">/100</span>
                              </>
                            ) : (
                              <>
                                <span className="text-7xl font-bold text-gray-300">--</span>
                                <span className="text-3xl text-gray-300">/100</span>
                              </>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 uppercase tracking-wide mb-3">
                            {!showPlaceholder ? 'Resume Power Score' : 'Not Yet Assessed'}
                          </div>
                          
                          {/* Score Bar - Improved */}
                          <div className="max-w-md mx-auto">
                            <div className="h-3 bg-gray-200 rounded-full overflow-hidden mb-3 shadow-inner">
                              <div 
                                className="h-full transition-all duration-500"
                                style={{ 
                                  width: !showPlaceholder ? `${score}%` : '0%',
                                  background: !showPlaceholder ? (score >= 85 ? '#9333ea' : score >= 75 ? '#81c784' : score >= 60 ? '#ffc870' : '#e57373') : '#d1d5db'
                                }}
                              />
                            </div>
                            
                            {/* Simple text labels with dots */}
                            <div className="flex items-center justify-center gap-10 text-xs text-gray-600">
  {[
    { color: '#e57373', label: 'Needs Work' },
    { color: '#ffc870', label: 'Developing' },
    { color: '#81c784', label: 'Strong' },
    { color: '#9333ea', label: 'Excellent' },
  ].map(({ color, label }) => (
    <div key={label} className="flex items-center gap-1">
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }}></div>
      <span>{label}</span>
    </div>
  ))}
</div>
                          </div>
                        </div>
                        
                   {/* Breakdown Grid - Bigger Text */}
                        <div className="grid grid-cols-3 gap-1.5">
                          <div className="text-center p-1.5 bg-gray-50 rounded-lg">
                            <div className="text-2xl font-bold mb-0.5">
                              {!showPlaceholder ? (
                                <>
                                  <span className="text-gray-900">{data.coreResume.score_breakdown?.impact ?? '--'}</span>
                                  <span className="text-sm text-gray-400">/50</span>
                                </>
                              ) : (
                                <>
                                  <span className="text-gray-300">--</span>
                                  <span className="text-sm text-gray-300">/50</span>
                                </>
                              )}
                            </div>
                            <div className="text-[10px] text-gray-600 uppercase tracking-wide mb-0.5">Impact</div>
                            {!showPlaceholder ? (
                              <div className="flex items-center justify-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: getBreakdownLabel(data.coreResume.score_breakdown?.impact ?? 0, 50).color }}></span>
                                <span className={`text-[10px] font-medium ${getBreakdownLabel(data.coreResume.score_breakdown?.impact ?? 0, 50).text}`}>
                                  {getBreakdownLabel(data.coreResume.score_breakdown?.impact ?? 0, 50).label}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                <span className="text-[10px] text-gray-400">—</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="text-center p-1.5 bg-gray-50 rounded-lg">
                            <div className="text-2xl font-bold mb-0.5">
                              {!showPlaceholder ? (
                                <>
                                  <span className="text-gray-900">{data.coreResume.score_breakdown?.clarity ?? '--'}</span>
                                  <span className="text-sm text-gray-400">/30</span>
                                </>
                              ) : (
                                <>
                                  <span className="text-gray-300">--</span>
                                  <span className="text-sm text-gray-300">/30</span>
                                </>
                              )}
                            </div>
                            <div className="text-[10px] text-gray-600 uppercase tracking-wide mb-0.5">Clarity</div>
                            {!showPlaceholder ? (
                              <div className="flex items-center justify-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: getBreakdownLabel(data.coreResume.score_breakdown?.clarity ?? 0, 30).color }}></span>
                                <span className={`text-[10px] font-medium ${getBreakdownLabel(data.coreResume.score_breakdown?.clarity ?? 0, 30).text}`}>
                                  {getBreakdownLabel(data.coreResume.score_breakdown?.clarity ?? 0, 30).label}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                <span className="text-[10px] text-gray-400">—</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="text-center p-1.5 bg-gray-50 rounded-lg">
                            <div className="text-2xl font-bold mb-0.5">
                              {!showPlaceholder ? (
                                <>
                                  <span className="text-gray-900">{data.coreResume.score_breakdown?.keywords ?? '--'}</span>
                                  <span className="text-sm text-gray-400">/20</span>
                                </>
                              ) : (
                                <>
                                  <span className="text-gray-300">--</span>
                                  <span className="text-sm text-gray-300">/20</span>
                                </>
                              )}
                            </div>
                            <div className="text-[10px] text-gray-600 uppercase tracking-wide mb-0.5">Keywords</div>
                            {!showPlaceholder ? (
                              <div className="flex items-center justify-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: getBreakdownLabel(data.coreResume.score_breakdown?.keywords ?? 0, 20).color }}></span>
                                <span className={`text-[10px] font-medium ${getBreakdownLabel(data.coreResume.score_breakdown?.keywords ?? 0, 20).text}`}>
                                  {getBreakdownLabel(data.coreResume.score_breakdown?.keywords ?? 0, 20).label}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                <span className="text-[10px] text-gray-400">—</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div className="mb-4">
                      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-center mb-2">Progress</div>
                      <div className="relative max-w-2xl mx-auto">
                        <div className="absolute top-2.5 left-0 right-0 h-px bg-gray-200">
                          <div 
                            className="h-full bg-purple-600 transition-all" 
                            style={{ width: `${currentIndex >= 0 ? ((currentIndex + 1) / totalSteps) * 100 : 33}%` }}
                          />
                        </div>
                        <div className="relative flex justify-between">
                          {(isPro 
                            ? ['Review', 'Assess', 'Coach', 'Improve', 'Format', 'Save']
                            : ['Review', 'Assess', 'Coach', 'Improve', 'Format', 'Save']
                          ).map((step, index) => {
                            const isPast = currentIndex > index;
                            const isActive = currentIndex === index || (currentIndex < 0 && index <= 1);
                            
                            return (
                              <div key={step} className="flex flex-col items-center">
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold z-10 ${
                                  isPast ? 'bg-purple-600 text-white' : 
                                  isActive ? 'bg-purple-600 text-white' : 
                                  'bg-white border border-gray-300 text-gray-400'
                                }`}>
                                  {isPast ? '✓' : isActive ? '●' : '○'}
                                </div>
                                <span className={`text-xs mt-1 ${
                                  isActive ? 'text-purple-600 font-semibold' :
                                  isPast ? 'text-purple-600' :
                                  'text-gray-400'
                                }`}>
                                  {step}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    
                    {/* What This Means */}
                    <div className="bg-purple-50 border-l-4 border-purple-600 p-3 rounded-r flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <div className="text-[10px] font-bold text-purple-600 uppercase tracking-wide mb-1">What This Means</div>
                        <p className="text-xs text-gray-700 leading-snug">
                          {getJourneyMessage(data.coreResume.journey_step || 'review')}
                        </p>
                      </div>
                      <button 
                        onClick={handleStartCoaching}
                        disabled={isDownloading && (data.coreResume.journey_step === 'save')}
                        className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm whitespace-nowrap flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {isDownloading && (data.coreResume.journey_step === 'save') ? (
                          <>
                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Downloading...
                          </>
                        ) : (
                          <>
                            {getButtonText(data.coreResume.journey_step || 'review')} {(data.coreResume.journey_step || 'review') !== 'save' && '→'}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Column: JS Resumes + Cover Letters */}
                <div className="col-span-4 flex flex-col self-stretch">

                  {/* Card 1: JS Resumes (Pro) / Job Match Scores (Free) */}
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 flex flex-col overflow-hidden" style={{ flex: '1 1 0', marginBottom: '16px' }}>
                    {isPro ? (
                      <>
                        <h2 className="text-base font-semibold text-gray-900">Job-Specific Resumes</h2>
                        <p className="text-xs text-gray-500 mb-2">Tailored versions optimized for specific applications</p>
                       <div className="flex-1 overflow-y-auto min-h-0">
                        <div className="space-y-2">
                          <button
                            onClick={handleCreateNew}
                            className="w-full border-2 border-dashed border-gray-300 rounded-lg p-2.5 hover:border-purple-400 hover:bg-purple-50 transition-all flex items-center justify-center gap-2"
                          >
                            <div className="w-4 h-4 rounded-full bg-purple-100 flex items-center justify-center">
                              <svg className="w-2.5 h-2.5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                            </div>
                            <div className="text-xs font-semibold text-gray-900">Create New</div>
                          </button>

                          {data.resumeVersions && data.resumeVersions.length > 0 ? (
                            <>
                              {data.resumeVersions.slice(0, 2).map((version) => (
                                <div
                                  key={version.id}
                                  className="group bg-white border border-gray-300 rounded-lg p-2 hover:border-purple-400 hover:shadow-sm transition-all cursor-pointer"
                                  onClick={() => router.push(`/resume/${version.id}`)}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                      <div className="text-xs font-semibold text-gray-900 truncate">{version.job_title}</div>
                                      <div className="text-[10px] text-gray-500 truncate">{version.job_company}</div>
                                    </div>
                                    <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(version.id); }}
                                        className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded-full bg-[#fdecea] hover:bg-[#e57373] flex items-center justify-center text-[#e57373] hover:text-white transition-all"
                                        title="Delete"
                                      >
                                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      </button>
                                      <div className="relative w-9 h-9">
                                        <svg className="w-9 h-9 transform -rotate-90">
                                          <circle cx="18" cy="18" r="14" stroke="#e5e7eb" strokeWidth="2.5" fill="none" />
                                          <circle
                                            cx="18" cy="18" r="14"
                                            stroke={getCircleColor(version.match_score)}
                                            strokeWidth="2.5" fill="none"
                                            strokeDasharray={`${2 * Math.PI * 14}`}
                                            strokeDashoffset={`${2 * Math.PI * 14 * (1 - version.match_score / 100)}`}
                                            strokeLinecap="round"
                                          />
                                        </svg>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                          <div className="text-[10px] font-bold" style={{ color: getCircleColor(version.match_score) }}>
                                            {version.match_score}%
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                              {data.resumeVersions.length > 2 && (
                                <button
                                  onClick={() => setShowOlderJSModal(true)}
                                  className="w-full text-center py-1 text-xs text-purple-600 hover:text-purple-700 font-medium hover:bg-purple-50 rounded-lg transition-colors"
                                >
                                  See {data.resumeVersions.length - 2} older version{data.resumeVersions.length - 2 > 1 ? 's' : ''} →
                                </button>
                              )}
                            </>
                          ) : (
                            <div className="text-center py-4 text-gray-500">
                              <div className="text-2xl mb-1">🎯</div>
                              <p className="text-xs">No job-specific resumes yet.<br />Click "Create New" when you're ready.</p>
                            </div>
                          )}
                        </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <h2 className="text-base font-semibold text-gray-900">Job Match Scores</h2>
                        <p className="text-xs text-gray-500 mb-2">Upload a job description to see how well you match</p>
                        <div className="space-y-2">
                          <button
                            onClick={() => { setJobModalSourceId(data?.coreResume?.id || null); setShowJobModal(true); }}
                            className="w-full border-2 border-dashed border-gray-300 rounded-lg p-2.5 hover:border-purple-400 hover:bg-purple-50 transition-all flex items-center justify-center gap-2"
                          >
                            <div className="w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center">
                              <svg className="w-3 h-3 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                            </div>
                            <div className="text-sm font-semibold text-gray-900">Upload Job Description</div>
                          </button>

                          {data.resumeVersions && data.resumeVersions.length > 0 && (
                            <>
                              {data.resumeVersions.slice(0, 2).map((version) => (
                                <div
                                  key={version.id}
                                  className="group bg-white border border-gray-200 rounded-lg p-2.5 hover:border-purple-400 hover:shadow-sm transition-all cursor-pointer"
                                  onClick={() => router.push(`/resume/${version.id}`)}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                      <div className="text-xs font-semibold text-gray-900 truncate">{version.job_title}</div>
                                      <div className="text-[11px] text-gray-500 truncate">{version.job_company}</div>
                                    </div>
                                    <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(version.id); }}
                                        className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-full bg-[#fdecea] hover:bg-[#e57373] flex items-center justify-center text-[#e57373] hover:text-white transition-all"
                                        title="Delete"
                                      >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      </button>
                                      <div className="relative w-10 h-10">
                                        <svg className="w-10 h-10 transform -rotate-90">
                                          <circle cx="20" cy="20" r="16" stroke="#e5e7eb" strokeWidth="2.5" fill="none" />
                                          <circle
                                            cx="20" cy="20" r="16"
                                            stroke={getCircleColor(version.match_score)}
                                            strokeWidth="2.5" fill="none"
                                            strokeDasharray={`${2 * Math.PI * 16}`}
                                            strokeDashoffset={`${2 * Math.PI * 16 * (1 - version.match_score / 100)}`}
                                            strokeLinecap="round"
                                          />
                                        </svg>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                          <div className="text-[11px] font-bold" style={{ color: getCircleColor(version.match_score) }}>
                                            {version.match_score}%
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </>
                          )}

                          {data.coreResume.journey_step === 'improve' && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-1">
                              <div className="text-xs font-semibold text-gray-900 mb-1">Pro users don't type - they talk. AI does the rest.</div>
                              <p className="text-[11px] text-gray-600 mb-2">Try coaching free on 1 job →</p>
                              <button
                                onClick={() => showStubMessage("Free Coaching Trial", "Free coaching trial coming soon!")}
                                className="w-full bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors font-medium text-xs"
                              >
                                Try Free Coaching
                              </button>
                            </div>
                          )}

                          {data.coreResume.journey_step !== 'improve' && (
                            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mt-1">
                              <div className="text-xs font-semibold text-gray-900 mb-1">Stop matching. Start customizing.</div>
                              <p className="text-[11px] text-gray-600 mb-2">Pro users create unlimited job-specific resumes optimized for each role.</p>
                              <button
                                onClick={() => setShowUpgradeModal(true)}
                                className="w-full bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 transition-colors font-medium text-xs"
                              >
                                Upgrade to Pro
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                 {/* Card 2: Cover Letters */}
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 flex flex-col overflow-hidden" style={{ flex: '1 1 0' }}>
                    <h2 className="text-base font-semibold text-gray-900">Cover Letters</h2>
                    <p className="text-xs text-gray-500 mb-2">AI-written and matched to the role</p>
                    <div className="space-y-2">
                      <button
                        onClick={() => setShowCLModal(true)}
                        className="w-full border-2 border-dashed border-gray-300 rounded-lg p-2.5 hover:border-purple-400 hover:bg-purple-50 transition-all flex items-center justify-center gap-2"
                      >
                        <div className="w-4 h-4 rounded-full bg-purple-100 flex items-center justify-center">
                          <svg className="w-2.5 h-2.5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </div>
                        <div className="text-xs font-semibold text-gray-900">Create New</div>
                      </button>

                      {data.coverLetters && data.coverLetters.length > 0 ? (
                        <>
                          {data.coverLetters.slice(0, 2).map((cl) => (
                            <div
                              key={cl.id}
                              className="group bg-white border border-gray-300 rounded-lg p-2 hover:border-purple-400 hover:shadow-sm transition-all cursor-pointer"
                              onClick={() => router.push(`/cover-letter/${cl.id}`)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <div className="w-6 h-6 rounded bg-purple-50 flex items-center justify-center flex-shrink-0">
                                    <svg className="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-xs font-semibold text-gray-900 truncate">{cl.job_title}</div>
                                    <div className="text-[10px] text-gray-500 truncate">{cl.job_company}</div>
                                  </div>
                                </div>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteCLId(cl.id); }}
                                  className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded-full bg-[#fdecea] hover:bg-[#e57373] flex items-center justify-center text-[#e57373] hover:text-white transition-all ml-2 flex-shrink-0"
                                  title="Delete"
                                >
                                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          ))}
                          {data.coverLetters.length > 2 && (
                            <button
                              onClick={() => setShowOlderCLModal(true)}
                              className="w-full text-center py-1 text-xs text-purple-600 hover:text-purple-700 font-medium hover:bg-purple-50 rounded-lg transition-colors"
                            >
                              See {data.coverLetters.length - 2} older {data.coverLetters.length - 2 > 1 ? 'letters' : 'letter'} →
                            </button>
                          )}
                        </>
                      ) : (
                        <div className="text-center py-4 text-gray-400">
                          <p className="text-xs">No cover letters yet.</p>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* Empty State - EXACT Same Layout, Just Empty */}
            {!data?.coreResume && (
              <div className="grid grid-cols-12 gap-6">
                {/* Core Resume Card (8 cols) */}
                <div className="col-span-8">
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                    <h2 className="text-lg font-semibold text-gray-900">Core Resume</h2>
                    <p className="text-xs text-gray-500 mb-3">Complete resume you can use for any job in your field</p>
                    
                    {/* Thumbnail LEFT | Score RIGHT - EXACT same grid */}
                    <div className="grid grid-cols-12 gap-4 mb-4">
                      
                      {/* Left: Empty Thumbnail (Upload Box) - col-span-4 */}
                      <div className="col-span-4">
                        <label className="block cursor-pointer">
                          <input
                            type="file"
                            accept=".pdf,.docx"
                            onChange={handleFileUpload}
                            className="hidden"
                            disabled={uploading}
                          />
                          <div className={`relative bg-gray-50 rounded-lg overflow-hidden shadow-sm border-2 border-dashed transition-all flex items-center justify-center ${
                            uploadError 
                              ? 'border-amber-400 bg-amber-50' 
                              : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50'
                          }`} style={{ aspectRatio: '8.5/11' }}>
                            {uploading ? (
                              <div className="flex flex-col items-center gap-2">
                                <div className="animate-spin h-6 w-6 border-3 border-purple-600 border-t-transparent rounded-full"></div>
                                <p className="text-xs font-medium text-gray-700">Uploading...</p>
                              </div>
                            ) : uploadError ? (
                              <div className="flex flex-col items-center gap-2 px-4">
                                <svg className="w-10 h-10 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <div className="text-center">
                                  <p className="text-xs font-semibold text-amber-900">Upload Failed</p>
                                  <p className="text-[10px] text-amber-700 mt-1">{uploadError}</p>
                                  <button
                                    onClick={() => setUploadError(null)}
                                    className="text-[10px] text-purple-600 hover:text-purple-700 font-medium mt-2"
                                  >
                                    Try Again
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-2 px-4">
                                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                                <div className="text-center">
                                  <p className="text-xs font-semibold text-gray-900">Upload Resume</p>
                                  <p className="text-[10px] text-gray-500 mt-0.5">PDF or DOCX</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </label>
                        <p className="text-[10px] text-gray-500 text-center mt-1.5">
                          No resume?{' '}
                          <button
                            onClick={() => router.push('/build?from=resume-coach')}
                            className="text-purple-600 hover:text-purple-700 font-medium hover:underline"
                          >
                            Build from scratch →
                          </button>
                        </p>
                      </div>
                      
                      {/* Right: Empty Score Section - col-span-8 */}
                      <div className="col-span-8 flex flex-col justify-between py-3">
                        {/* Giant Score */}
                        <div className="text-center">
                          <div className="mb-3">
                            <span className="text-7xl font-bold text-gray-300">--</span>
                            <span className="text-3xl text-gray-300">/100</span>
                          </div>
                          <div className="text-xs text-gray-500 uppercase tracking-wide mb-3">
                            Not Yet Assessed
                          </div>
                          
                          {/* Empty Score Bar */}
                          <div className="max-w-md mx-auto">
                            <div className="h-3 bg-gray-200 rounded-full overflow-hidden mb-3 shadow-inner">
                              <div className="h-full w-0 bg-gray-300" />
                            </div>
                            
                            {/* Simple text labels with dots */}
                            <div className="flex items-center justify-center gap-6 text-xs text-gray-600">
  {[
    { color: '#e57373', label: 'Needs Work' },
    { color: '#ffc870', label: 'Developing' },
    { color: '#81c784', label: 'Strong' },
    { color: '#9333ea', label: 'Excellent' },
  ].map(({ color, label }) => (
    <div key={label} className="flex items-center gap-1">
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }}></div>
      <span>{label}</span>
    </div>
  ))}
</div>
                          </div>
                        </div>
                        
                        {/* Empty Breakdown Grid */}
                        <div className="grid grid-cols-3 gap-1.5">
                          <div className="text-center p-1.5 bg-gray-50 rounded-lg">
                            <div className="text-2xl font-bold mb-0.5">
                              <span className="text-gray-300">--</span>
                              <span className="text-sm text-gray-300">/50</span>
</div>
<div className="text-[10px] text-gray-600 uppercase tracking-wide mb-0.5">Impact</div>
                            <div className="flex items-center justify-center gap-1">
                              <span className="text-[10px] text-gray-400">—</span>
                            </div>
                          </div>
                          
                          <div className="text-center p-1.5 bg-gray-50 rounded-lg">
                            <div className="text-2xl font-bold mb-0.5">
                              <span className="text-gray-300">--</span>
                              <span className="text-sm text-gray-300">/30</span>
</div>
<div className="text-[10px] text-gray-600 uppercase tracking-wide mb-0.5">Clarity</div>
                            <div className="flex items-center justify-center gap-1">
                              <span className="text-[10px] text-gray-400">—</span>
                            </div>
                          </div>
                          
                          <div className="text-center p-1.5 bg-gray-50 rounded-lg">
                            <div className="text-2xl font-bold mb-0.5">
                              <span className="text-gray-300">--</span>
                              <span className="text-sm text-gray-300">/20</span>
                            </div>
                            <div className="text-[10px] text-gray-600 uppercase tracking-wide mb-0.5">Keywords</div>
                            <div className="flex items-center justify-center gap-1">
                              <span className="text-[10px] text-gray-400">—</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Journey Progress - All Gray */}
                    <div className="mb-4">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Journey Progress</div>
                      <div className="relative max-w-2xl mx-auto">
                        <div className="absolute top-2.5 left-0 right-0 h-px bg-gray-200"></div>
                        <div className="relative flex justify-between">
                         {['Review', 'Assess', 'Coach', 'Improve', 'Format', 'Save'].map((step) => (
                            <div key={step} className="flex flex-col items-center">
                              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold z-10 bg-white border border-gray-300 text-gray-400">
                                ○
                              </div>
                              <span className="text-xs mt-1 text-gray-400">
                                {step}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    {/* What This Means - WITH Upload Button */}
                    <div className="bg-purple-50 border-l-4 border-purple-600 p-3 rounded-r flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <div className="text-[10px] font-bold text-purple-600 uppercase tracking-wide mb-1">What This Means</div>
                        <p className="text-xs text-gray-700 leading-snug">
                          You haven't started yet. Upload your resume to begin.
                        </p>
                      </div>
                      <label className="flex-shrink-0 cursor-pointer">
                        <input
                          type="file"
                          accept=".pdf,.docx"
                          onChange={handleFileUpload}
                          className="hidden"
                          disabled={uploading}
                        />
                        <button
                          className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm whitespace-nowrap flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={uploading}
                          onClick={(e) => {
                            if (!uploading) {
                              e.currentTarget.previousElementSibling.click();
                            }
                          }}
                        >
                          {uploading ? (
                            <>
                              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                              Uploading...
                            </>
                          ) : (
                            'Upload Resume'
                          )}
                        </button>
                      </label>
                    </div>
                    <p className="text-xs text-gray-500 text-center mt-2">
                      Don't have a resume yet?{' '}
                      <button
                        onClick={() => router.push('/build?from=resume-coach')}
                        className="text-purple-600 hover:text-purple-700 font-medium hover:underline"
                      >
                        Click here to build one
                      </button>
                    </p>
                  </div>
                </div>

                {/* Right Column: JS Resumes + Cover Letters (empty state) */}
                <div className="col-span-4 flex flex-col" style={{ height: '100%' }}>
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4" style={{ flex: '0 0 50%', marginBottom: '12px' }}>
                    {isPro ? (
                      <>
                        <h2 className="text-base font-semibold text-gray-900">Job-Specific Resumes</h2>
                        <p className="text-xs text-gray-500 mb-4">Tailored versions optimized for specific applications</p>
                      </>
                    ) : (
                      <>
                        <h2 className="text-base font-semibold text-gray-900">Job Match Scores</h2>
                        <p className="text-xs text-gray-500 mb-4">Upload a job description to see how well you match</p>
                      </>
                    )}
                    <div className="text-center py-6 text-gray-400">
                      <div className="text-3xl mb-2">{isPro ? '📋' : '🎯'}</div>
                      <p className="text-xs">Complete your core resume first</p>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4" style={{ flex: '0 0 calc(50% - 12px)' }}>
                    <h2 className="text-base font-semibold text-gray-900">Cover Letters</h2>
                    <p className="text-xs text-gray-500 mb-4">AI-written and matched to the role</p>
                    <div className="text-center py-6 text-gray-400">
                      <div className="text-3xl mb-2">✉️</div>
                      <p className="text-xs">Complete your core resume first</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

     {/* Job-Specific Resume Modal */}
      {showJobModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => { setShowJobModal(false); setJobCreateError(null); }}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4" style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-lg">🎯</span>
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">Tailor for a Specific Job</h2>
                    <p className="text-purple-100 text-xs">{isPro ? "We'll analyze the match and coach your resume for this role." : "We'll analyze the match and see how closely your resume aligns with this role."}</p>
                  </div>
                </div>
                <button
                  onClick={() => { setShowJobModal(false); setJobCreateError(null); }}
                  className="text-white hover:opacity-70 text-2xl leading-none font-light"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Job Title</label>
                <input
                  type="text"
                  value={jobTitle}
                  onChange={e => setJobTitle(e.target.value)}
                  placeholder="e.g. Marketing Coordinator"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Company</label>
                <input
                  type="text"
                  value={jobCompany}
                  onChange={e => setJobCompany(e.target.value)}
                  placeholder="e.g. Disney"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Job Description</label>
                <textarea
                  value={jobDescription}
                  onChange={e => setJobDescription(e.target.value)}
                  placeholder="Paste the full job description here..."
                  rows={6}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
              </div>

              {jobCreateError && (
                <p className="text-xs text-red-600">{jobCreateError}</p>
              )}

              <button
                onClick={handleCreateJobSpecific}
                disabled={creatingJob}
                className="w-full rounded-lg py-2.5 font-semibold text-sm flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
                style={{ background: 'linear-gradient(to right, #667eea, #764ba2)', color: 'white' }}
              >
                {creatingJob && <div className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>}
                {creatingJob ? 'Analyzing Match...' : 'Analyze Match →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tour Modal */}
      {showTourModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)' }}
          onClick={handleSkipTour}
        >
          <div 
            className="bg-white shadow-2xl max-w-lg w-full overflow-hidden border border-gray-200"
            onClick={(e) => e.stopPropagation()}
            style={{
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              borderRadius: '8px',
              height: '520px',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Purple header - EXACT sidebar gradient */}
            <div 
              style={{ background: 'linear-gradient(to bottom right, rgb(147 51 234), rgb(37 99 235))' }} 
              className="px-6 py-5 relative flex-shrink-0"
            >
              {tourScreen < 3 && (
                <button
                  onClick={handleSkipTour}
                  className="absolute top-4 right-4 text-white hover:text-gray-200 text-3xl leading-none font-light"
                >
                  ×
                </button>
              )}
             
              {tourScreen === 1 && (
                <div className="flex items-center gap-3">
                  <img src="/images/Hire_Power_icon.png" alt="Hire Power" className="h-8 w-auto flex-shrink-0" />
                  <div>
                    <h2 className="text-xl font-bold text-white">Welcome to Resume Coach</h2>
                    <p className="text-purple-100 text-xs">The AI that asks the right questions.</p>
                  </div>
                </div>
              )}
              
              {tourScreen === 2 && (
                <div className="flex items-center gap-3">
                  <img src="/images/Hire_Power_icon.png" alt="Hire Power" className="h-8 w-auto flex-shrink-0" />
                  <div>
                    <h2 className="text-xl font-bold text-white">A Clear Path to a Stronger Resume</h2>
                    <p className="text-purple-100 text-xs">No guesswork—just a clear process so you always know what to do next.</p>
                  </div>
                </div>
              )}
              
              {tourScreen === 3 && (
                <div className="flex items-center gap-3">
                  <img src="/images/Hire_Power_icon.png" alt="Hire Power" className="h-8 w-auto flex-shrink-0" />
                  <div>
                    <h2 className="text-xl font-bold text-white">Let's Get Started</h2>
                    <p className="text-purple-100 text-xs">Your resume is the starting point.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="px-6 py-5 flex-1 flex flex-col" style={{ minHeight: '320px', maxHeight: '320px' }}>
            
              {/* Screen 1 */}
              {tourScreen === 1 && (
                <div className="flex flex-col h-full">
                  <div className="flex-1 space-y-4">
                    <div>
                      <p className="font-bold text-gray-900 mb-3 text-base">The problem with most AI resume tools:</p>
                      <div className="space-y-2 text-gray-700 text-sm">
                        <p><span className="font-bold text-purple-600">→</span> You may not know what makes a resume strong.</p>
                        <p><span className="font-bold text-purple-600">→</span> And AI can only work with what’s already on the page.</p>
                         <p>That’s why most tools give generic tips or rewrite what’s already there.</p>  </div>
                    </div>
                    
                    <div>
                      <p className="font-bold text-gray-900 mb-2 text-base">Resume Coach works differently.</p>
                      <p className="text-gray-700 leading-relaxed text-sm mb-2">
                        We guide you through the same questions a professional resume writer would ask - uncovering achievements, metrics, and impact you might not think to include. </p>
                       <p className="text-gray-700 leading-relaxed text-sm">So your resume gets stronger without AI making things up.
                      </p>
                    </div>
                    
                    <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-l-4 border-purple-600 p-3">
                      <p className="text-sm text-gray-800 font-medium">
                        No generic tips. No AI fiction. Just your real achievements, turned into a resume that gets interviews.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex justify-center mt-5">
                    <button
                      onClick={handleNextTourScreen}
                      className="bg-purple-600 text-white px-10 py-2.5 rounded-md hover:bg-purple-700 transition-colors font-semibold shadow-sm text-sm"
                    >
                      Continue
                    </button>
                  </div>
                </div>
              )}

  {/* Screen 2 */}
              {tourScreen === 2 && (
                <div className="flex flex-col h-full">
                  <div className="flex-1">
                    <p className="font-bold text-sm text-gray-700 mb-2">
                      Most resume tools leave you guessing.
                    </p>

                    <p className="text-sm text-gray-700 mb-2">
                      Resume Coach walks you through a structured process that professional resume writers use to uncover stronger experience.
                    </p>
                    <p className="text-sm text-gray-700 mb-3">
                      One clear step at a time.
                    </p>
                    
                    {/* Vertical Progress Bar */}
                    <div className="flex gap-3 mb-3">
                      {/* Left: Vertical line with circles */}
                      <div className="relative flex-shrink-0" style={{ width: '16px' }}>
                        <div className="absolute left-2 top-0 bottom-0 w-px bg-gray-200">
                          <div 
                            className="w-full bg-gray-200 transition-all" 
                            style={{ height: '100%' }}
                          />
                        </div>
                        
                        {/* Circles - w-4 h-4 with empty circle character */}
                        <div className="relative flex flex-col justify-between" style={{ height: '160px', marginTop: '-2px' }}>
                          {['Review', 'Assess', 'Coach', 'Improve', 'Format', 'Save'].map((step, index) => (
                            <div key={step} className="flex items-center justify-center" style={{ height: '16px' }}>
                              <div className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold z-10 bg-white border border-gray-300 text-gray-400">
                                ○
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* Right: Step labels - aligned with dot centers */}
                      <div className="flex-1 flex flex-col justify-between" style={{ height: '160px' }}>
                        {[
                          { title: 'Review', desc: 'Upload or build your resume' },
                          { title: 'Assess', desc: 'See your Resume Power Score' },
                          { title: 'Coach', desc: 'Conversation reveals missing achievements', pro: true },
                          { title: 'Improve', desc: 'Accept targeted improvements' },
                          { title: 'Format', desc: 'Auto-fit and final formatting' },
                          { title: 'Save', desc: 'Download your stronger resume' }
                        ].map((step, i) => (
                          <div key={i} style={{ height: '16px', display: 'flex', alignItems: 'center' }}>
                            <p className="text-sm text-gray-900 leading-none">
                              <span className="font-bold">{step.title}</span> 
                              {step.pro && <sup className="text-purple-600" style={{ fontSize: '7px' }}>PRO</sup>} — {step.desc}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-l-4 border-purple-600 p-3 mt-4">
                      <p className="text-sm text-gray-800 font-medium">
                        No guessing what comes next. No getting confused by endless tips. Just clear next steps toward an interview-winning resume.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex justify-center mt-3">
                    <button
                      onClick={handleNextTourScreen}
                      className="bg-purple-600 text-white px-10 py-2.5 rounded-md hover:bg-purple-700 transition-colors font-semibold shadow-sm text-sm"
                    >
                      Continue
                    </button>
                  </div>
                </div>
              )}

           {/* Screen 3 */}
              {tourScreen === 3 && (
                <div className="flex flex-col py-3">
                  <div className="space-y-2">
                    <p className="text-gray-800 text-sm leading-relaxed font-semibold text-center">
                      Your resume shows the past. We focus on what's next.
                    </p>
                    <div className="text-gray-700 text-sm leading-relaxed text-center">
                      <p className="mt-1">Upload your resume and we'll use it as the starting point for coaching that discoversS what you've actually accomplished.</p>
                    </div>

                    <div className="flex flex-col items-center mt-6">
                      <label className="block cursor-pointer mb-3">
                        <input
                          type="file"
                          accept=".pdf,.docx"
                          onChange={(e) => {
                            handleFileUpload(e);
                            handleCompleteTour();
                          }}
                          className="hidden"
                          disabled={uploading}
                        />
                        <div className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors font-semibold text-xs cursor-pointer flex items-center justify-center gap-2">
                          {uploading ? (
                            <>
                              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                              Uploading...
                            </>
                          ) : (
                            'Upload Resume'
                          )}
                        </div>
                      </label>

                      <p className="text-sm text-gray-600 text-center">
                        Don't have one yet?{' '}
                        <button
                          onClick={() => {
                            handleCompleteTour();
                            router.push('/build?from=resume-coach');
                          }}
                          className="text-purple-600 hover:text-purple-700 font-semibold hover:underline"
                        >
                          Build from scratch
                        </button>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={() => setConfirmDeleteId(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-gray-900 mb-2">Delete this resume?</h3>
            <p className="text-sm text-gray-600 mb-5">This can't be undone. {isPro ? 'All coaching history and improvements will be permanently removed.' : 'Your resume and all assessment history will be permanently removed.'}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteResume(confirmDeleteId)}
                disabled={deletingId === confirmDeleteId}
                className="flex-1 px-4 py-2 bg-[#e57373] text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deletingId === confirmDeleteId ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Deleting...
                  </>
                ) : (
                  'Yes, Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cover Letter Creation Modal */}
      {showCLModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => { setShowCLModal(false); setClSourceType(null); setClCreateError(null); }}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4" style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">Create Cover Letter</h2>
                    <p className="text-purple-100 text-xs">AI-written and matched to the role. Edit and download when ready.</p>
                  </div>
                </div>
                <button
                  onClick={() => { setShowCLModal(false); setClSourceType(null); setClCreateError(null); }}
                  className="text-white hover:opacity-70 text-2xl leading-none font-light"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {isPro && data?.resumeVersions && data.resumeVersions.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Select a job-specific resume if you created one for this job. If not, add the details below.</label>
                  <select
                    value={clSelectedJSId || ''}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '') {
                        setClSelectedJSId('');
                        setClJobTitle('');
                        setClCompany('');
                        setClJobDescription('');
                      } else {
                        const selected = data.resumeVersions.find(v => v.id === val);
                        setClSelectedJSId(val);
                        setClJobTitle(selected?.job_title || '');
                        setClCompany(selected?.job_company || '');
                        setClJobDescription(selected?.job_description || '');
                      }
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                  >
                    <option value="">Start fresh</option>
                    {data.resumeVersions.map(v => (
                      <option key={v.id} value={v.id}>{v.job_title} at {v.job_company}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Job Title</label>
                <input
                  type="text"
                  value={clJobTitle}
                  onChange={e => setClJobTitle(e.target.value)}
                  placeholder="e.g. Marketing Coordinator"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Company</label>
                <input
                  type="text"
                  value={clCompany}
                  onChange={e => setClCompany(e.target.value)}
                  placeholder="e.g. Disney"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Job Description</label>
                <textarea
                  value={clJobDescription}
                  onChange={e => setClJobDescription(e.target.value)}
                  placeholder="Paste the full job description here..."
                  rows={5}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
              </div>
              {clCreateError && <p className="text-xs text-red-600">{clCreateError}</p>}
              <button
                onClick={handleCreateCoverLetter}
                disabled={creatingCL}
                className="w-full rounded-lg py-2.5 font-semibold text-sm flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
                style={{ background: 'linear-gradient(to right, #667eea, #764ba2)', color: 'white' }}
              >
                {creatingCL && <div className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>}
                {creatingCL ? 'Creating...' : 'Create Cover Letter →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Older JS Resumes Modal */}
      {showOlderJSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4" style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Job-Specific Resumes</h2>
                  <p className="text-purple-100 text-xs">{data?.resumeVersions?.length} versions</p>
                </div>
                <button onClick={() => setShowOlderJSModal(false)} className="text-white text-2xl leading-none font-light hover:opacity-70">×</button>
              </div>
            </div>
            <div className="px-6 py-4 overflow-y-auto" style={{ maxHeight: '60vh' }}>
              <div className="space-y-2">
                {data?.resumeVersions?.map((version) => (
                  <div
                    key={version.id}
                    className="group flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-purple-400 hover:bg-white cursor-pointer transition-all"
                    onClick={() => { setShowOlderJSModal(false); router.push(`/resume/${version.id}`); }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{version.job_title}</p>
                      <p className="text-xs text-gray-500 truncate">{version.job_company}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(version.id); setShowOlderJSModal(false); }}
                        className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-full bg-[#fdecea] hover:bg-[#e57373] flex items-center justify-center text-[#e57373] hover:text-white transition-all"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                      <div className="relative w-10 h-10 flex-shrink-0">
                        <svg className="w-10 h-10 transform -rotate-90">
                          <circle cx="20" cy="20" r="16" stroke="#e5e7eb" strokeWidth="2.5" fill="none" />
                          <circle cx="20" cy="20" r="16" stroke={getCircleColor(version.match_score)} strokeWidth="2.5" fill="none" strokeDasharray={`${2 * Math.PI * 16}`} strokeDashoffset={`${2 * Math.PI * 16 * (1 - version.match_score / 100)}`} strokeLinecap="round" />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-[11px] font-bold" style={{ color: getCircleColor(version.match_score) }}>{version.match_score}%</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            </div>
        </div>
      )}

      {/* Older Cover Letters Modal */}
      {showOlderCLModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4" style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Cover Letters</h2>
                  <p className="text-purple-100 text-xs">{data?.coverLetters?.length} letters</p>
                </div>
                <button onClick={() => setShowOlderCLModal(false)} className="text-white text-2xl leading-none font-light hover:opacity-70">×</button>
              </div>
            </div>
            <div className="px-6 py-4 overflow-y-auto" style={{ maxHeight: '60vh' }}>
              <div className="space-y-2">
                {data?.coverLetters?.map((cl) => (
                  <div
                    key={cl.id}
                    className="group flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-purple-400 hover:bg-white cursor-pointer transition-all"
                    onClick={() => { setShowOlderCLModal(false); router.push(`/cover-letter/${cl.id}`); }}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded bg-purple-50 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{cl.job_title}</p>
                        <p className="text-xs text-gray-500 truncate">{cl.job_company}</p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteCLId(cl.id); setShowOlderCLModal(false); }}
                      className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-full bg-[#fdecea] hover:bg-[#e57373] flex items-center justify-center text-[#e57373] hover:text-white transition-all ml-2 flex-shrink-0"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
            </div>
        </div>
      )}

      {/* Cover Letter Delete Confirmation */}
      {confirmDeleteCLId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={() => setConfirmDeleteCLId(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-gray-900 mb-2">Delete this cover letter?</h3>
            <p className="text-sm text-gray-600 mb-5">This removes it from Resume Coach. It will remain accessible from its job card if one exists.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteCLId(null)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
                Cancel
              </button>
              <button
                onClick={() => handleDeleteCoverLetter(confirmDeleteCLId)}
                disabled={deletingCLId === confirmDeleteCLId}
                className="flex-1 px-4 py-2 bg-[#e57373] text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deletingCLId === confirmDeleteCLId ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Deleting...
                  </>
                ) : (
                  'Yes, Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
      />
    </div>
  );
}