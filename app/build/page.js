'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import MainNav from '../components/MainNav';
import Breadcrumb from '../components/Breadcrumb';
import ResumeContent from '../components/ResumeContent';

export default function BuildPage() {
  const router = useRouter();
  const supabase = createClient();
  
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [fromPage, setFromPage] = useState('my-career');
  const [resumeId, setResumeId] = useState(null);
  
  // Resume data
  const [resumeData, setResumeData] = useState({
    fullName: "",
    email: "",
    phone: "",
    location: "",
    linkedin: "",
    portfolio: "",
    summary: "",
    hideSummary: false,
    experience: [],
    education: [],
    skills: [],
    skillsCategories: {},
    projects: [],
    certifications: [],
    volunteer: [],
    languages: [],
    sectionOrder: ["experience", "education", "skills"]
  });

  // Format date function (REQUIRED for ResumeContent)
  function formatDate(dateString, format = 'short') {
    if (!dateString) return '';
    
    const [year, month] = dateString.split('-');
    if (!year || !month) return dateString;
    
    const monthNum = parseInt(month);
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
    
    switch(format) {
      case 'short':
        return `${monthNum}/${year}`;
      case 'full':
        return `${monthNames[monthNum - 1]} ${year}`;
      case 'year':
        return year;
      default:
        return `${monthNum}/${year}`;
    }
  }

  // Steps configuration
  const steps = [
    { id: 'contact', title: 'Contact Information', required: true },
    { id: 'summary', title: 'Professional Summary', required: false },
    { id: 'experience', title: 'Work Experience', required: true },
    { id: 'education', title: 'Education', required: true },
    { id: 'skills', title: 'Skills', required: true },
    { id: 'projects', title: 'Projects', required: false, askFirst: true },
    { id: 'certifications', title: 'Certifications', required: false, askFirst: true },
    { id: 'volunteer', title: 'Volunteer Experience', required: false, askFirst: true },
    { id: 'languages', title: 'Languages', required: false, askFirst: true },
    { id: 'complete', title: 'Complete', required: true }
  ];

 useEffect(() => {
  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/dashboard');
      return;
    }
    setUser(user);

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    setUserProfile(profile);

    // Get URL params
    const params = new URLSearchParams(window.location.search);
    setFromPage(params.get('from') || 'my-career');
    setResumeId(params.get('resumeId'));

    setLoading(false);
  }
  loadData();
}, [supabase, router]);

// Auto-scroll right panel to top when step changes
useEffect(() => {
  const rightPanel = document.querySelector('.overflow-y-auto.px-6');
  if (rightPanel) {
    rightPanel.scrollTop = 0;
  }
}, [currentStep]);

  const handleNext = () => {
    setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleSkip = () => {
    setCurrentStep(currentStep + 1);
  };

  const handleComplete = async () => {
    try {
      const { data: savedResume, error } = await supabase
        .from('resumes')
        .insert({
          user_id: user.id,
          resume_data: resumeData,
          resume_type: 'core',
          display_name: 'Core Resume',
          journey_step: 'review'
        })
        .select()
        .single();

      if (error) throw error;

      if (fromPage === 'my-career') {
        router.push(`/my-career/detail?resumeId=${savedResume.id}`);
      } else if (fromPage === 'my-resumes') {
       router.push(`/resume/${savedResume.id}`);
      } else {
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Error saving resume:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-purple-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const breadcrumbItems = [
    { label: fromPage === 'my-career' ? 'My Career' : 'My Resumes', path: `/${fromPage}` },
    { label: 'Build Resume' }
  ];

  const currentStepConfig = steps[currentStep];

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <MainNav currentPage={fromPage} userProfile={userProfile} />
      <Breadcrumb items={breadcrumbItems} />

      <div className="flex-1 flex overflow-hidden" style={{ height: 'calc(100vh - 160px)' }}>
        <div className="flex-1 flex gap-6 p-6 max-w-7xl mx-auto w-full">
          
          {/* Left Column - Resume Preview (70-75% width) */}
          <div className="flex-[3] bg-white rounded-lg shadow-sm border border-gray-200 overflow-y-auto">
            <div className="p-8">
              <ResumeContent 
                resumeData={resumeData}
                onUpdate={setResumeData}
                formatDate={formatDate}
                readOnly={false}
              />
            </div>
          </div>

          {/* Right Column - Builder Guide (25-30% width) */}
          <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-y-auto px-6 pb-6">

            {/* Progress Bar - Sticky */}
            <div className="sticky top-0 bg-white -mx-6 px-6 pt-6 mb-6 pb-4 border-b border-gray-200 z-10">
              <h3 className="text-center font-semibold text-sm mb-3">
                Resume Build Progress
              </h3>
              
              <div className="text-right text-xs font-bold text-gray-700 mb-2">
                {['Contact', 'Summary', 'Experience', 'Education', 'Skills', 'Projects', 'Certifications', 'Volunteer', 'Languages'][currentStep]} (step {currentStep + 1} of 9)
              </div>
              
              <div className="relative">
                <div className="absolute top-2.5 left-0 right-0 h-0.5 bg-gray-300">
                  <div 
                    className="h-full bg-purple-600 transition-all duration-300"
                    style={{ width: `${currentStep >= 0 ? (currentStep / 8) * 100 : 0}%` }}
                  />
                </div>
                
                <div className="relative flex justify-between">
                  {Array.from({ length: 9 }).map((_, index) => (
                    <div key={index} className="flex flex-col items-center">
                      <div className={`
                        w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold z-10
                        ${index < currentStep ? 'bg-purple-600 text-white' : 
                          index === currentStep ? 'bg-purple-600 text-white' : 
                          'bg-white border-2 border-gray-300 text-gray-400'}
                      `}>
                        {index < currentStep ? '✓' : index === currentStep ? '●' : '○'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Step Content Header */}
            <h3 className="font-semibold text-lg mb-3">📝 {currentStepConfig.title}</h3>

            <p className="text-xs text-gray-700 mb-4">
              {currentStep === 0 && "Let's start with your contact information. This appears at the top of your resume."}
              {currentStep === 1 && "A professional summary is a 2-3 sentence overview of your background and goals. It's optional but recommended."}
              {currentStep === 2 && "Add your work experience. Start with your most recent position."}
              {currentStep === 3 && "Add your education. Use the 'lines' field for GPA, honors, or relevant coursework."}
              {currentStep === 4 && "Add your key skills. You can organize them into categories (Technical Skills, Professional Skills, etc.) by selecting the Add Category option under your skills list."}
              {currentStep >= 5 && "Add any additional sections like projects, certifications, volunteer work, or languages."}
            </p>

            {/* Step Content */}
            <div className="space-y-4">
              {currentStep === 0 && <ContactStep resumeData={resumeData} setResumeData={setResumeData} onNext={handleNext} />}
              {currentStep === 1 && <SummaryStep resumeData={resumeData} setResumeData={setResumeData} onNext={handleNext} onBack={handleBack} onSkip={handleSkip} />}
              {currentStep === 2 && <ExperienceStep resumeData={resumeData} setResumeData={setResumeData} onNext={handleNext} onBack={handleBack} />}
              {currentStep === 3 && <EducationStep resumeData={resumeData} setResumeData={setResumeData} onNext={handleNext} onBack={handleBack} />}
              {currentStep === 4 && <SkillsStep resumeData={resumeData} setResumeData={setResumeData} onNext={handleNext} onBack={handleBack} />}
              {currentStep === 5 && <ProjectsStep resumeData={resumeData} setResumeData={setResumeData} onNext={handleNext} onBack={handleBack} onSkip={handleSkip} />}
              {currentStep === 6 && <CertificationsStep resumeData={resumeData} setResumeData={setResumeData} onNext={handleNext} onBack={handleBack} onSkip={handleSkip} />}
              {currentStep === 7 && <VolunteerStep resumeData={resumeData} setResumeData={setResumeData} onNext={handleNext} onBack={handleBack} onSkip={handleSkip} />}
              {currentStep === 8 && <LanguagesStep resumeData={resumeData} setResumeData={setResumeData} onNext={handleNext} onBack={handleBack} onSkip={handleSkip} />}
              {currentStep === 9 && <CompleteStep onComplete={handleComplete} onBack={handleBack} />}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// Contact Step Component
function ContactStep({ resumeData, setResumeData, onNext }) {
  const handleChange = (field, value) => {
    setResumeData({ ...resumeData, [field]: value });
  };

  const isValid = resumeData.fullName && resumeData.email && resumeData.phone;

  return (
    <>
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Full Name *
          </label>
          <input
            type="text"
            value={resumeData.fullName}
            onChange={(e) => handleChange('fullName', e.target.value)}
            placeholder="Jane Doe"
            className="w-full border border-gray-300 rounded-lg p-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email *
          </label>
          <input
            type="email"
            value={resumeData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            placeholder="jane@example.com"
            className="w-full border border-gray-300 rounded-lg p-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone *
          </label>
          <input
            type="tel"
            value={resumeData.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            placeholder="(555) 123-4567"
            className="w-full border border-gray-300 rounded-lg p-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Location
          </label>
          <input
            type="text"
            value={resumeData.location}
            onChange={(e) => handleChange('location', e.target.value)}
            placeholder="City, State"
            className="w-full border border-gray-300 rounded-lg p-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            LinkedIn
          </label>
          <input
            type="text"
            value={resumeData.linkedin}
            onChange={(e) => handleChange('linkedin', e.target.value)}
            placeholder="linkedin.com/in/janedoe"
            className="w-full border border-gray-300 rounded-lg p-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Portfolio/Website
          </label>
          <input
            type="text"
            value={resumeData.portfolio}
            onChange={(e) => handleChange('portfolio', e.target.value)}
            placeholder="janedoe.com"
            className="w-full border border-gray-300 rounded-lg p-2 text-sm"
          />
        </div>
      </div>

      <button
        onClick={onNext}
        disabled={!isValid}
        className="w-full mt-6 bg-purple-600 text-white px-4 py-1.5 rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-xs font-semibold shadow-sm"
      >
        Next Step →
      </button>
    </>
  );
}

// Summary Step Component
function SummaryStep({ resumeData, setResumeData, onNext, onBack, onSkip }) {
  return (
    <>
      <textarea
        value={resumeData.summary}
        onChange={(e) => setResumeData({ ...resumeData, summary: e.target.value })}
        placeholder="Example: Marketing professional with 5+ years of experience in digital campaigns and brand strategy. Proven track record of increasing engagement 40% through data-driven content optimization. Seeking to leverage expertise in a senior marketing role."
        rows="4"
        className="w-full border border-gray-300 rounded-lg p-3 text-sm resize-none"
      />

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="px-4 py-1.5 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors text-xs"
        >
          ← Back
        </button>
        <button
          onClick={onSkip}
          className="px-4 py-1.5 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors text-xs"
        >
          Skip
        </button>
        <button
          onClick={onNext}
          className="flex-1 bg-purple-600 text-white px-4 py-1.5 rounded-lg hover:bg-purple-700 transition-colors text-xs font-semibold shadow-sm"
        >
          Next Step →
        </button>
      </div>
    </>
  );
}

// Experience Step Component  
function ExperienceStep({ resumeData, setResumeData, onNext, onBack }) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 50 }, (_, i) => currentYear - i);
  const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const [currentJob, setCurrentJob] = useState({
    title: "",
    company: "",
    location: "",
    startDate: "",
    endDate: "",
    current: false,
    summary: "",
    summaryDismissed: false,
    bullets: [""]
  });

  const [startMonth, setStartMonth] = useState('');
  const [startYear, setStartYear] = useState('');
  const [endMonth, setEndMonth] = useState('');
  const [endYear, setEndYear] = useState('');
  const [showForm, setShowForm] = useState(resumeData.experience.length === 0);

  const addJob = (andContinue = false) => {
    if (currentJob.title && currentJob.company && startMonth && startYear) {
      const jobToAdd = {
        ...currentJob,
        startDate: `${startYear}-${startMonth}`,
        endDate: currentJob.current ? "" : (endMonth && endYear ? `${endYear}-${endMonth}` : ""),
        bullets: currentJob.bullets.filter(b => b.trim())
      };
      
      setResumeData({
        ...resumeData,
        experience: [...resumeData.experience, jobToAdd]
      });
      
      // Reset form
      setCurrentJob({
        title: "",
        company: "",
        location: "",
        startDate: "",
        endDate: "",
        current: false,
        summary: "",
        summaryDismissed: false,
        bullets: [""]
      });
      setStartMonth('');
      setStartYear('');
      setEndMonth('');
      setEndYear('');
      
      if (andContinue) {
        onNext();
      } else {
        setShowForm(false);
      }
    }
  };

  const updateBullet = (index, value) => {
    const newBullets = [...currentJob.bullets];
    newBullets[index] = value;
    setCurrentJob({ ...currentJob, bullets: newBullets });
  };

  const addBullet = () => {
    setCurrentJob({ ...currentJob, bullets: [...currentJob.bullets, ""] });
  };

  const removeBullet = (index) => {
    const newBullets = currentJob.bullets.filter((_, i) => i !== index);
    setCurrentJob({ ...currentJob, bullets: newBullets.length > 0 ? newBullets : [""] });
  };

  return (
    <>
      {/* Added Jobs List */}
      {resumeData.experience.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-700 mb-2">
            Jobs Added: {resumeData.experience.length}
          </p>
          <div className="space-y-1">
            {resumeData.experience.map((job, index) => (
              <div key={index} className="text-xs text-gray-600 bg-green-50 p-2 rounded">
                ✓ {job.title} at {job.company}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Show form or "Add Another" button */}
      {!showForm && resumeData.experience.length > 0 ? (
        <div className="space-y-3">
          <button
            onClick={() => setShowForm(true)}
            className="w-full bg-white border-2 border-dashed border-purple-300 text-purple-600 px-4 py-3 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors text-xs font-semibold"
          >
            + Add Another Job
          </button>
          
          <div className="flex gap-2">
            <button
              onClick={onBack}
              className="px-4 py-1.5 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors text-xs"
            >
              ← Back
            </button>
            <button
              onClick={onNext}
              className="flex-1 bg-purple-600 text-white px-4 py-1.5 rounded-lg hover:bg-purple-700 transition-colors text-xs font-semibold shadow-sm"
            >
              Continue to Education →
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Job Entry Form */}
          <div className="space-y-3 mb-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Job Title *
              </label>
              <input
                type="text"
                value={currentJob.title}
                onChange={(e) => setCurrentJob({ ...currentJob, title: e.target.value })}
                placeholder="Event Coordinator"
                className="w-full border border-gray-300 rounded p-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Company *
              </label>
              <input
                type="text"
                value={currentJob.company}
                onChange={(e) => setCurrentJob({ ...currentJob, company: e.target.value })}
                placeholder="Antigravity Orlando"
                className="w-full border border-gray-300 rounded p-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Location
              </label>
              <input
                type="text"
                value={currentJob.location}
                onChange={(e) => setCurrentJob({ ...currentJob, location: e.target.value })}
                placeholder="Orlando, FL"
                className="w-full border border-gray-300 rounded p-2 text-sm"
              />
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Start Date *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={startMonth}
                    onChange={(e) => setStartMonth(e.target.value)}
                    className="border border-gray-300 rounded p-2 text-sm w-full"
                  >
                    <option value="">Select Month</option>
                    {months.map((m, i) => (
                      <option key={m} value={m}>{monthNames[i]}</option>
                    ))}
                  </select>
                  <select
                    value={startYear}
                    onChange={(e) => setStartYear(e.target.value)}
                    className="border border-gray-300 rounded p-2 text-sm w-full"
                  >
                    <option value="">Select Year</option>
                    {years.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={endMonth}
                    onChange={(e) => {
                      setEndMonth(e.target.value);
                      setCurrentJob({ ...currentJob, current: false });
                    }}
                    disabled={currentJob.current}
                    className="border border-gray-300 rounded p-2 text-sm w-full disabled:bg-gray-100"
                  >
                    <option value="">Select Month</option>
                    {months.map((m, i) => (
                      <option key={m} value={m}>{monthNames[i]}</option>
                    ))}
                  </select>
                  <select
                    value={endYear}
                    onChange={(e) => {
                      setEndYear(e.target.value);
                      setCurrentJob({ ...currentJob, current: false });
                    }}
                    disabled={currentJob.current}
                    className="border border-gray-300 rounded p-2 text-sm w-full disabled:bg-gray-100"
                  >
                    <option value="">Select Year</option>
                    {years.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={currentJob.current}
                onChange={(e) => {
                  setCurrentJob({ ...currentJob, current: e.target.checked });
                  if (e.target.checked) {
                    setEndMonth('');
                    setEndYear('');
                  }
                }}
                className="rounded"
              />
              <span className="text-gray-700">I currently work here</span>
            </label>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Job Summary (1-2 sentences, optional)
              </label>
              <textarea
                value={currentJob.summary}
                onChange={(e) => setCurrentJob({ ...currentJob, summary: e.target.value })}
                placeholder="Brief overview of your role and responsibilities..."
                rows="2"
                className="w-full border border-gray-300 rounded p-2 text-sm resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Achievements (bullets)
              </label>
              {currentJob.bullets.map((bullet, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={bullet}
                    onChange={(e) => updateBullet(index, e.target.value)}
                    placeholder="Coordinated 60+ annual events..."
                    className="flex-1 border border-gray-300 rounded p-2 text-sm"
                  />
                  {currentJob.bullets.length > 1 && (
                    <button
                      onClick={() => removeBullet(index)}
                      className="text-red-600 hover:text-red-700 px-2 text-sm"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={addBullet}
                className="text-purple-600 hover:text-purple-700 text-xs font-medium"
              >
                + Add Another Achievement
              </button>
            </div>

            {/* Two-button layout - stacked */}
            <div className="space-y-2 pt-2">
              <button
                onClick={() => addJob(false)}
                disabled={!currentJob.title || !currentJob.company || !startMonth || !startYear}
                className="w-full bg-white border-2 border-purple-600 text-purple-600 px-4 py-1.5 rounded-lg hover:bg-purple-50 disabled:border-gray-300 disabled:text-gray-400 disabled:bg-gray-50 transition-colors text-xs font-semibold"
              >
                Save Job & Add Another
              </button>
              <button
                onClick={() => addJob(true)}
                disabled={!currentJob.title || !currentJob.company || !startMonth || !startYear}
                className="w-full bg-purple-600 text-white px-4 py-1.5 rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-xs font-semibold shadow-sm"
              >
                Save Job & Continue to Education
              </button>
            </div>
          </div>

          {resumeData.experience.length > 0 && (
            <button
              onClick={() => setShowForm(false)}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          )}
        </>
      )}

      {/* Navigation - only show if no jobs added yet */}
      {resumeData.experience.length === 0 && (
        <div className="flex gap-2">
          <button
            onClick={onBack}
            className="px-4 py-1.5 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors text-xs"
          >
            ← Back
          </button>
        </div>
      )}
    </>
  );
}

// Education Step Component
function EducationStep({ resumeData, setResumeData, onNext, onBack }) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 50 }, (_, i) => currentYear - i);
  const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const [currentEdu, setCurrentEdu] = useState({
    school: "",
    degree: "",
    field: "",
    graduationDate: "",
    location: "",
    lines: []
  });

  const [gradMonth, setGradMonth] = useState('');
  const [gradYear, setGradYear] = useState('');
  const [currentLine, setCurrentLine] = useState('');
  const [showForm, setShowForm] = useState(resumeData.education.length === 0);

  const addLine = () => {
    if (currentLine.trim()) {
      setCurrentEdu({
        ...currentEdu,
        lines: [...currentEdu.lines, currentLine.trim()]
      });
      setCurrentLine('');
    }
  };

  const removeLine = (index) => {
    setCurrentEdu({
      ...currentEdu,
      lines: currentEdu.lines.filter((_, i) => i !== index)
    });
  };

  const addEducation = (andContinue = false) => {
    if (currentEdu.school) {
      const eduToAdd = {
        ...currentEdu,
        graduationDate: gradMonth && gradYear ? `${gradYear}-${gradMonth}` : ""
      };
      
      setResumeData({
        ...resumeData,
        education: [...resumeData.education, eduToAdd]
      });
      
      // Reset form
      setCurrentEdu({
        school: "",
        degree: "",
        field: "",
        graduationDate: "",
        location: "",
        lines: []
      });
      setGradMonth('');
      setGradYear('');
      setCurrentLine('');
      
      if (andContinue) {
        onNext();
      } else {
        setShowForm(false);
      }
    }
  };

  return (
    <>
      {/* Added Education List */}
      {resumeData.education.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-700 mb-2">
            Education Added: {resumeData.education.length}
          </p>
          <div className="space-y-1">
            {resumeData.education.map((edu, index) => (
              <div key={index} className="text-xs text-gray-600 bg-green-50 p-2 rounded">
                ✓ {edu.school}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Show form or "Add Another" button */}
      {!showForm && resumeData.education.length > 0 ? (
        <div className="space-y-3">
          <button
            onClick={() => setShowForm(true)}
            className="w-full bg-white border-2 border-dashed border-purple-300 text-purple-600 px-4 py-3 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors text-xs font-semibold"
          >
            + Add Another Education
          </button>
          
          <div className="flex gap-2">
            <button
              onClick={onBack}
              className="px-4 py-1.5 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors text-xs"
            >
              ← Back
            </button>
            <button
              onClick={onNext}
              className="flex-1 bg-purple-600 text-white px-4 py-1.5 rounded-lg hover:bg-purple-700 transition-colors text-xs font-semibold shadow-sm"
            >
              Continue to Skills →
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Education Entry Form */}
          <div className="space-y-3 mb-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                School/University *
              </label>
              <input
                type="text"
                value={currentEdu.school}
                onChange={(e) => setCurrentEdu({ ...currentEdu, school: e.target.value })}
                placeholder="University of Central Florida"
                className="w-full border border-gray-300 rounded p-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Degree
              </label>
              <input
                type="text"
                value={currentEdu.degree}
                onChange={(e) => setCurrentEdu({ ...currentEdu, degree: e.target.value })}
                placeholder="Bachelor of Science"
                className="w-full border border-gray-300 rounded p-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Field of Study
              </label>
              <input
                type="text"
                value={currentEdu.field}
                onChange={(e) => setCurrentEdu({ ...currentEdu, field: e.target.value })}
                placeholder="Entertainment Management"
                className="w-full border border-gray-300 rounded p-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Graduation Date
              </label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={gradMonth}
                  onChange={(e) => setGradMonth(e.target.value)}
                  className="border border-gray-300 rounded p-2 text-sm"
                >
                  <option value="">Month</option>
                  {months.map((m, i) => (
                    <option key={m} value={m}>{monthNames[i]}</option>
                  ))}
                </select>
                <select
                  value={gradYear}
                  onChange={(e) => setGradYear(e.target.value)}
                  className="border border-gray-300 rounded p-2 text-sm"
                >
                  <option value="">Year</option>
                  {years.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Location
              </label>
              <input
                type="text"
                value={currentEdu.location}
                onChange={(e) => setCurrentEdu({ ...currentEdu, location: e.target.value })}
                placeholder="Orlando, FL"
                className="w-full border border-gray-300 rounded p-2 text-sm"
              />
            </div>

            {/* Lines (GPA, honors, etc.) */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Additional Details (GPA, honors, coursework)
              </label>
              {currentEdu.lines.map((line, index) => (
                <div key={index} className="flex gap-2 mb-2 items-center">
                  <span className="text-xs text-gray-600 flex-1 bg-white p-2 rounded border">
                    {line}
                  </span>
                  <button
                    onClick={() => removeLine(index)}
                    className="text-red-600 hover:text-red-700 px-2"
                  >
                    ×
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={currentLine}
                  onChange={(e) => setCurrentLine(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addLine();
                    }
                  }}
                  placeholder="e.g., GPA: 3.8/4.0"
                  className="flex-1 border border-gray-300 rounded p-2 text-sm"
                />
                <button
                  onClick={addLine}
                  className="bg-purple-100 text-purple-700 px-3 py-1 rounded text-xs hover:bg-purple-200"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Two-button layout - stacked */}
            <div className="space-y-2 pt-2">
              <button
                onClick={() => addEducation(false)}
                disabled={!currentEdu.school}
                className="w-full bg-white border-2 border-purple-600 text-purple-600 px-4 py-1.5 rounded-lg hover:bg-purple-50 disabled:border-gray-300 disabled:text-gray-400 disabled:bg-gray-50 transition-colors text-xs font-semibold"
              >
                Save Education & Add Another
              </button>
              <button
                onClick={() => addEducation(true)}
                disabled={!currentEdu.school}
                className="w-full bg-purple-600 text-white px-4 py-1.5 rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-xs font-semibold shadow-sm"
              >
                Save Education & Continue to Skills
              </button>
            </div>
          </div>

          {resumeData.education.length > 0 && (
            <button
              onClick={() => setShowForm(false)}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          )}
        </>
      )}

      {/* Navigation - only show if no education added yet */}
      {resumeData.education.length === 0 && (
        <div className="flex gap-2">
          <button
            onClick={onBack}
            className="px-4 py-1.5 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors text-xs"
          >
            ← Back
          </button>
        </div>
      )}
    </>
  );
}

// Skills Step Component
function SkillsStep({ resumeData, setResumeData, onNext, onBack }) {
  const [skillInput, setSkillInput] = useState("");
  const [categoryName, setCategoryName] = useState("Skills");

  const addSkill = () => {
    if (skillInput.trim()) {
      const newCategories = { ...resumeData.skillsCategories };
      if (!newCategories[categoryName]) {
        newCategories[categoryName] = [];
      }
      newCategories[categoryName].push(skillInput.trim());
      
      setResumeData({
        ...resumeData,
        skillsCategories: newCategories,
        skills: []
      });
      setSkillInput("");
    }
  };

  const removeSkill = (category, index) => {
    const newCategories = { ...resumeData.skillsCategories };
    newCategories[category].splice(index, 1);
    if (newCategories[category].length === 0) {
      delete newCategories[category];
    }
    setResumeData({
      ...resumeData,
      skillsCategories: newCategories
    });
  };

  const totalSkills = Object.values(resumeData.skillsCategories).reduce((sum, skills) => sum + skills.length, 0);
  const isValid = totalSkills > 0;

  return (
    <>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Category Name
          </label>
          <input
            type="text"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            placeholder="Skills, Technical, Soft Skills, etc."
            className="w-full border border-gray-300 rounded-lg p-2 text-sm"
          />
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addSkill();
              }
            }}
            placeholder="e.g., Project Management"
            className="flex-1 border border-gray-300 rounded-lg p-2 text-sm"
          />
          <button
            onClick={addSkill}
            className="bg-purple-600 text-white px-4 py-1.5 rounded-lg hover:bg-purple-700 transition-colors text-xs font-semibold shadow-sm"
          >
            Add
          </button>
        </div>

        {Object.keys(resumeData.skillsCategories).length > 0 && (
          <div className="space-y-3 mt-4">
            {Object.entries(resumeData.skillsCategories).map(([category, skills]) => (
              <div key={category}>
                <p className="text-xs font-semibold text-gray-700 mb-1">{category}:</p>
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill, index) => (
                    <div key={index} className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs flex items-center gap-2">
                      {skill}
                      <button
                        onClick={() => removeSkill(category, index)}
                        className="text-purple-500 hover:text-purple-700"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2 mt-6">
        <button
          onClick={onBack}
          className="px-4 py-1.5 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors text-xs"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          disabled={!isValid}
          className="flex-1 bg-purple-600 text-white px-4 py-1.5 rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-xs font-semibold shadow-sm"
        >
          Next Step →
        </button>
      </div>
    </>
  );
}

// Projects Step Component
function ProjectsStep({ resumeData, setResumeData, onNext, onBack, onSkip }) {
  const [showFields, setShowFields] = useState(false);
  const [currentProject, setCurrentProject] = useState({
    name: "",
    description: "",
    link: ""
  });

  const addProject = () => {
    if (currentProject.name && currentProject.description) {
      setResumeData({
        ...resumeData,
        projects: [...resumeData.projects, currentProject]
      });
      setCurrentProject({ name: "", description: "", link: "" });
    }
  };

  if (!showFields) {
    return (
      <>
        <p className="text-sm text-gray-600 mb-4">
          Do you have any notable projects to showcase?
        </p>
        <p className="text-xs text-gray-500 mb-6">
          Projects can include personal projects, open-source contributions, or significant work projects.
        </p>

        <div className="flex gap-2">
          <button
            onClick={onBack}
            className="px-4 py-1.5 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors text-xs"
          >
            ← Back
          </button>
          <button
            onClick={onSkip}
            className="flex-1 border border-gray-300 text-gray-700 px-4 py-1.5 rounded hover:bg-gray-50 transition-colors text-xs"
          >
            No, Skip
          </button>
          <button
            onClick={() => setShowFields(true)}
            className="flex-1 bg-purple-600 text-white px-4 py-1.5 rounded-lg hover:bg-purple-700 transition-colors text-xs font-semibold shadow-sm"
          >
            Yes, Add
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="space-y-3 mb-4 p-4 bg-gray-50 rounded-lg">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Project Name *
          </label>
          <input
            type="text"
            value={currentProject.name}
            onChange={(e) => setCurrentProject({ ...currentProject, name: e.target.value })}
            placeholder="Portfolio Website"
            className="w-full border border-gray-300 rounded p-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Description *
          </label>
          <textarea
            value={currentProject.description}
            onChange={(e) => setCurrentProject({ ...currentProject, description: e.target.value })}
            placeholder="Built responsive portfolio site using React and Tailwind..."
            rows="2"
            className="w-full border border-gray-300 rounded p-2 text-sm resize-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Link (optional)
          </label>
          <input
            type="text"
            value={currentProject.link}
            onChange={(e) => setCurrentProject({ ...currentProject, link: e.target.value })}
            placeholder="github.com/username/project"
            className="w-full border border-gray-300 rounded p-2 text-sm"
          />
        </div>

        <button
          onClick={addProject}
          disabled={!currentProject.name || !currentProject.description}
          className="w-full bg-purple-600 text-white px-4 py-1.5 rounded-lg hover:bg-purple-700 disabled:bg-gray-300 transition-colors text-xs font-semibold shadow-sm"
        >
          Add This Project
        </button>
      </div>

      {resumeData.projects.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-700 mb-2">
            Projects Added: {resumeData.projects.length}
          </p>
          <div className="space-y-1">
            {resumeData.projects.map((project, index) => (
              <div key={index} className="text-xs text-gray-600 bg-green-50 p-2 rounded">
                ✓ {project.name}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onBack}
          className="px-4 py-1.5 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors text-xs"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          className="flex-1 bg-purple-600 text-white px-4 py-1.5 rounded-lg hover:bg-purple-700 transition-colors text-xs font-semibold shadow-sm"
        >
          Next Step →
        </button>
      </div>
    </>
  );
}

// Certifications Step Component
function CertificationsStep({ resumeData, setResumeData, onNext, onBack, onSkip }) {
  const [showFields, setShowFields] = useState(false);
  const [currentCert, setCurrentCert] = useState({
    name: "",
    details: ""
  });

  const addCertification = () => {
    if (currentCert.name && currentCert.details) {
      setResumeData({
        ...resumeData,
        certifications: [...resumeData.certifications, currentCert]
      });
      setCurrentCert({ name: "", details: "" });
    }
  };

  if (!showFields) {
    return (
      <>
        <p className="text-sm text-gray-600 mb-4">
          Do you have any professional certifications?
        </p>
        <p className="text-xs text-gray-500 mb-6">
          Include relevant certifications, licenses, or credentials.
        </p>

        <div className="flex gap-2">
          <button
            onClick={onBack}
            className="px-4 py-1.5 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors text-xs"
          >
            ← Back
          </button>
          <button
            onClick={onSkip}
            className="flex-1 border border-gray-300 text-gray-700 px-4 py-1.5 rounded hover:bg-gray-50 transition-colors text-xs"
          >
            No, Skip
          </button>
          <button
            onClick={() => setShowFields(true)}
            className="flex-1 bg-purple-600 text-white px-4 py-1.5 rounded-lg hover:bg-purple-700 transition-colors text-xs font-semibold shadow-sm"
          >
            Yes, Add
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="space-y-3 mb-4 p-4 bg-gray-50 rounded-lg">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Certification Name *
          </label>
          <input
            type="text"
            value={currentCert.name}
            onChange={(e) => setCurrentCert({ ...currentCert, name: e.target.value })}
            placeholder="Project Management Professional (PMP)"
            className="w-full border border-gray-300 rounded p-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Details (Issuing org, date) *
          </label>
          <input
            type="text"
            value={currentCert.details}
            onChange={(e) => setCurrentCert({ ...currentCert, details: e.target.value })}
            placeholder="Project Management Institute | 2023"
            className="w-full border border-gray-300 rounded p-2 text-sm"
          />
        </div>

        <button
          onClick={addCertification}
          disabled={!currentCert.name || !currentCert.details}
          className="w-full bg-purple-600 text-white px-4 py-1.5 rounded-lg hover:bg-purple-700 disabled:bg-gray-300 transition-colors text-xs font-semibold shadow-sm"
        >
          Add This Certification
        </button>
      </div>

      {resumeData.certifications.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-700 mb-2">
            Certifications Added: {resumeData.certifications.length}
          </p>
          <div className="space-y-1">
            {resumeData.certifications.map((cert, index) => (
              <div key={index} className="text-xs text-gray-600 bg-green-50 p-2 rounded">
                ✓ {cert.name}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onBack}
          className="px-4 py-1.5 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors text-xs"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          className="flex-1 bg-purple-600 text-white px-4 py-1.5 rounded-lg hover:bg-purple-700 transition-colors text-xs font-semibold shadow-sm"
        >
          Next Step →
        </button>
      </div>
    </>
  );
}

// Volunteer Step Component
function VolunteerStep({ resumeData, setResumeData, onNext, onBack, onSkip }) {
  const [showFields, setShowFields] = useState(false);
  const [currentVol, setCurrentVol] = useState({
    organization: "",
    description: ""
  });

  const addVolunteer = () => {
    if (currentVol.organization && currentVol.description) {
      setResumeData({
        ...resumeData,
        volunteer: [...resumeData.volunteer, currentVol]
      });
      setCurrentVol({ organization: "", description: "" });
    }
  };

  if (!showFields) {
    return (
      <>
        <p className="text-sm text-gray-600 mb-4">
          Do you have volunteer or community involvement?
        </p>
        <p className="text-xs text-gray-500 mb-6">
          Volunteer work can demonstrate leadership and commitment.
        </p>

        <div className="flex gap-2">
          <button
            onClick={onBack}
            className="px-4 py-1.5 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors text-xs"
          >
            ← Back
          </button>
          <button
            onClick={onSkip}
            className="flex-1 border border-gray-300 text-gray-700 px-4 py-1.5 rounded hover:bg-gray-50 transition-colors text-xs"
          >
            No, Skip
          </button>
          <button
            onClick={() => setShowFields(true)}
            className="flex-1 bg-purple-600 text-white px-4 py-1.5 rounded-lg hover:bg-purple-700 transition-colors text-xs font-semibold shadow-sm"
          >
            Yes, Add
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="space-y-3 mb-4 p-4 bg-gray-50 rounded-lg">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Organization *
          </label>
          <input
            type="text"
            value={currentVol.organization}
            onChange={(e) => setCurrentVol({ ...currentVol, organization: e.target.value })}
            placeholder="Habitat for Humanity"
            className="w-full border border-gray-300 rounded p-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Role & Description *
          </label>
          <textarea
            value={currentVol.description}
            onChange={(e) => setCurrentVol({ ...currentVol, description: e.target.value })}
            placeholder="Team leader coordinating volunteer construction projects..."
            rows="2"
            className="w-full border border-gray-300 rounded p-2 text-sm resize-none"
          />
        </div>

        <button
          onClick={addVolunteer}
          disabled={!currentVol.organization || !currentVol.description}
          className="w-full bg-purple-600 text-white px-4 py-1.5 rounded-lg hover:bg-purple-700 disabled:bg-gray-300 transition-colors text-xs font-semibold shadow-sm"
        >
          Add This Experience
        </button>
      </div>

      {resumeData.volunteer.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-700 mb-2">
            Volunteer Experience Added: {resumeData.volunteer.length}
          </p>
          <div className="space-y-1">
            {resumeData.volunteer.map((vol, index) => (
              <div key={index} className="text-xs text-gray-600 bg-green-50 p-2 rounded">
                ✓ {vol.organization}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onBack}
          className="px-4 py-1.5 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors text-xs"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          className="flex-1 bg-purple-600 text-white px-4 py-1.5 rounded-lg hover:bg-purple-700 transition-colors text-xs font-semibold shadow-sm"
        >
          Next Step →
        </button>
      </div>
    </>
  );
}

// Languages Step Component
function LanguagesStep({ resumeData, setResumeData, onNext, onBack, onSkip }) {
  const [showFields, setShowFields] = useState(false);
  const [currentLang, setCurrentLang] = useState({
    language: "",
    proficiency: "Professional"
  });

  const addLanguage = () => {
    if (currentLang.language) {
      setResumeData({
        ...resumeData,
        languages: [...resumeData.languages, currentLang]
      });
      setCurrentLang({ language: "", proficiency: "Professional" });
    }
  };

  if (!showFields) {
    return (
      <>
        <p className="text-sm text-gray-600 mb-4">
          Do you speak any languages besides English?
        </p>
        <p className="text-xs text-gray-500 mb-6">
          List languages and your proficiency level.
        </p>

        <div className="flex gap-2">
          <button
            onClick={onBack}
            className="px-4 py-1.5 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors text-xs"
          >
            ← Back
          </button>
          <button
            onClick={onSkip}
            className="flex-1 border border-gray-300 text-gray-700 px-4 py-1.5 rounded hover:bg-gray-50 transition-colors text-xs"
          >
            No, Skip
          </button>
          <button
            onClick={() => setShowFields(true)}
            className="flex-1 bg-purple-600 text-white px-4 py-1.5 rounded-lg hover:bg-purple-700 transition-colors text-xs font-semibold shadow-sm"
          >
            Yes, Add
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="space-y-3 mb-4 p-4 bg-gray-50 rounded-lg">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Language *
          </label>
          <input
            type="text"
            value={currentLang.language}
            onChange={(e) => setCurrentLang({ ...currentLang, language: e.target.value })}
            placeholder="Spanish"
            className="w-full border border-gray-300 rounded p-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Proficiency *
          </label>
          <select
            value={currentLang.proficiency}
            onChange={(e) => setCurrentLang({ ...currentLang, proficiency: e.target.value })}
            className="w-full border border-gray-300 rounded p-2 text-sm"
          >
            <option value="Native">Native</option>
            <option value="Fluent">Fluent</option>
            <option value="Professional">Professional</option>
            <option value="Conversational">Conversational</option>
            <option value="Basic">Basic</option>
          </select>
        </div>

        <button
          onClick={addLanguage}
          disabled={!currentLang.language}
          className="w-full bg-purple-600 text-white px-4 py-1.5 rounded-lg hover:bg-purple-700 disabled:bg-gray-300 transition-colors text-xs font-semibold shadow-sm"
        >
          Add This Language
        </button>
      </div>

      {resumeData.languages.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-700 mb-2">
            Languages Added: {resumeData.languages.length}
          </p>
          <div className="space-y-1">
            {resumeData.languages.map((lang, index) => (
              <div key={index} className="text-xs text-gray-600 bg-green-50 p-2 rounded">
                ✓ {lang.language} ({lang.proficiency})
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onBack}
          className="px-4 py-1.5 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors text-xs"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          className="flex-1 bg-purple-600 text-white px-4 py-1.5 rounded-lg hover:bg-purple-700 transition-colors text-xs font-semibold shadow-sm"
        >
          Next Step →
        </button>
      </div>
    </>
  );
}

// Complete Step Component
function CompleteStep({ onComplete, onBack }) {
  return (
    <>
      <p className="text-lg font-semibold text-gray-900 mb-4">
        ✅ Resume Complete!
      </p>
      <p className="text-sm text-gray-600 mb-6">
        Great work! Your resume is ready. Click below to save and continue to the next step.
      </p>

      <div className="flex gap-2">
        <button
          onClick={onBack}
          className="px-4 py-1.5 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors text-xs"
        >
          ← Back
        </button>
        <button
          onClick={onComplete}
          className="flex-1 bg-green-600 text-white px-4 py-1.5 rounded-lg hover:bg-green-700 transition-colors text-xs font-semibold shadow-sm"
        >
          Save & Continue →
        </button>
      </div>
    </>
  );
}