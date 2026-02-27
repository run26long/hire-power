'use client';

import { useState, useEffect } from 'react';

/**
 * BuilderGuide Component
 * 
 * Step-by-step guidance for building a resume from scratch
 * Covers ALL sections from RESUME_DATA_STRUCTURE_REFERENCE.md
 * 
 * Mandatory sections: Contact, Experience, Education, Skills
 * Recommended: Summary (can be hidden)
 * Optional: Projects, Certifications, Volunteer, Languages
 * 
 * Used in both Career Detail and Resume Detail
 */

export default function BuilderGuide({
  resumeData,        // Current state of resume being built
  onComplete,        // Callback when builder is done
  showSkipOption = false  // Allow skipping builder entirely (Career Detail only)
}) {
  const [currentStep, setCurrentStep] = useState(1);

  // Define all builder steps
  const steps = [
    { 
      id: 1, 
      name: 'Contact', 
      section: 'contact',
      mandatory: true,
      validate: () => resumeData.fullName && resumeData.email && resumeData.phone && resumeData.location
    },
    { 
      id: 2, 
      name: 'Summary', 
      section: 'summary',
      mandatory: false,  // Recommended but not required
      validate: () => resumeData.summary || resumeData.hideSummary
    },
    { 
      id: 3, 
      name: 'Experience', 
      section: 'experience',
      mandatory: true,
      validate: () => resumeData.experience && resumeData.experience.length > 0
    },
    { 
      id: 4, 
      name: 'Education', 
      section: 'education',
      mandatory: true,
      validate: () => resumeData.education && resumeData.education.length > 0
    },
    { 
      id: 5, 
      name: 'Skills', 
      section: 'skills',
      mandatory: true,
      validate: () => {
        const hasCategories = resumeData.skillsCategories && Object.keys(resumeData.skillsCategories).length > 0;
        const hasSkills = resumeData.skills && resumeData.skills.length > 0;
        return hasCategories || hasSkills;
      }
    },
    { 
      id: 6, 
      name: 'Projects', 
      section: 'projects',
      mandatory: false,
      validate: () => true  // Optional - always valid
    },
    { 
      id: 7, 
      name: 'Certifications', 
      section: 'certifications',
      mandatory: false,
      validate: () => true  // Optional - always valid
    },
    { 
      id: 8, 
      name: 'Volunteer', 
      section: 'volunteer',
      mandatory: false,
      validate: () => true  // Optional - always valid
    },
    { 
      id: 9, 
      name: 'Languages', 
      section: 'languages',
      mandatory: false,
      validate: () => true  // Optional - always valid
    }
  ];

  const currentStepData = steps[currentStep - 1];
  const isStepComplete = currentStepData.validate();
  const isLastStep = currentStep === steps.length;

  // Check if all mandatory steps are complete
  const allMandatoryComplete = () => {
    return steps
      .filter(step => step.mandatory)
      .every(step => step.validate());
  };

  const handleNext = () => {
    if (isLastStep) {
      // Complete builder
      onComplete();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleSkipOptional = () => {
    // Skip to next step or complete if last
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Render step-specific guidance
  const renderStepGuidance = () => {
    switch (currentStepData.section) {
      case 'contact':
        return (
          <div>
            <h3 className="font-bold text-gray-900 mb-2">Step 1: Contact Information</h3>
            <p className="text-sm text-gray-700 mb-3">
              Fill in your basic contact details on the left. This appears at the top of your resume.
            </p>
            <div className="bg-purple-50 border border-purple-200 rounded p-3 text-xs text-gray-700">
              <p className="font-semibold mb-1">Required:</p>
              <ul className="space-y-0.5 ml-4">
                <li>• Full Name</li>
                <li>• Email Address</li>
                <li>• Phone Number</li>
                <li>• Location (City, State)</li>
              </ul>
              <p className="font-semibold mt-2 mb-1">Optional:</p>
              <ul className="space-y-0.5 ml-4">
                <li>• LinkedIn Profile</li>
                <li>• Portfolio Website</li>
              </ul>
            </div>
          </div>
        );

      case 'summary':
        return (
          <div>
            <h3 className="font-bold text-gray-900 mb-2">Step 2: Professional Summary</h3>
            <p className="text-sm text-gray-700 mb-3">
              A 2-4 sentence summary of your background and career goals. This is highly recommended but optional.
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-xs text-gray-700">
              <p className="font-semibold mb-1">Good summary includes:</p>
              <ul className="space-y-0.5 ml-4">
                <li>• Years of experience</li>
                <li>• Your field/specialty</li>
                <li>• Key strengths</li>
                <li>• Career goal or direction</li>
              </ul>
              <p className="mt-2 text-gray-600 italic">You can skip this and add it later during coaching.</p>
            </div>
          </div>
        );

      case 'experience':
        return (
          <div>
            <h3 className="font-bold text-gray-900 mb-2">Step 3: Work Experience</h3>
            <p className="text-sm text-gray-700 mb-3">
              Add your current and previous jobs. Start with your most recent role.
            </p>
            <div className="bg-purple-50 border border-purple-200 rounded p-3 text-xs text-gray-700">
              <p className="font-semibold mb-1">For each job, include:</p>
              <ul className="space-y-0.5 ml-4">
                <li>• Job Title</li>
                <li>• Company Name</li>
                <li>• Dates (Start and End)</li>
                <li>• 2-5 bullet points about what you did</li>
              </ul>
              <p className="mt-2 text-gray-600 italic">
                Don't worry about making bullets perfect - we'll improve them with coaching later.
              </p>
            </div>
          </div>
        );

      case 'education':
        return (
          <div>
            <h3 className="font-bold text-gray-900 mb-2">Step 4: Education</h3>
            <p className="text-sm text-gray-700 mb-3">
              Add your degree(s), certifications, or relevant training.
            </p>
            <div className="bg-purple-50 border border-purple-200 rounded p-3 text-xs text-gray-700">
              <p className="font-semibold mb-1">Include:</p>
              <ul className="space-y-0.5 ml-4">
                <li>• School/Institution Name</li>
                <li>• Degree/Certification</li>
                <li>• Field of Study</li>
                <li>• Graduation Date (or expected date)</li>
              </ul>
              <p className="mt-2 text-gray-600 italic">
                Add GPA, honors, or relevant coursework if applicable.
              </p>
            </div>
          </div>
        );

      case 'skills':
        return (
          <div>
            <h3 className="font-bold text-gray-900 mb-2">Step 5: Skills</h3>
            <p className="text-sm text-gray-700 mb-3">
              List your technical and professional skills. You can organize them by category if you'd like.
            </p>
            <div className="bg-purple-50 border border-purple-200 rounded p-3 text-xs text-gray-700">
              <p className="font-semibold mb-1">Consider including:</p>
              <ul className="space-y-0.5 ml-4">
                <li>• Technical skills (software, tools, languages)</li>
                <li>• Industry-specific skills</li>
                <li>• Soft skills (leadership, communication)</li>
                <li>• Certifications or specialized training</li>
              </ul>
            </div>
          </div>
        );

      case 'projects':
        return (
          <div>
            <h3 className="font-bold text-gray-900 mb-2">Step 6: Projects (Optional)</h3>
            <p className="text-sm text-gray-700 mb-3">
              Have you worked on any notable projects, personal or professional? Add them here if they strengthen your resume.
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded p-3 text-xs text-gray-700">
              <p className="font-semibold mb-1">Good projects to include:</p>
              <ul className="space-y-0.5 ml-4">
                <li>• Side projects or freelance work</li>
                <li>• School capstone projects</li>
                <li>• Open source contributions</li>
                <li>• Major work projects you led</li>
              </ul>
              <p className="mt-2 text-purple-600 font-medium">
                This section is optional - skip if you don't have projects to add.
              </p>
            </div>
          </div>
        );

      case 'certifications':
        return (
          <div>
            <h3 className="font-bold text-gray-900 mb-2">Step 7: Certifications (Optional)</h3>
            <p className="text-sm text-gray-700 mb-3">
              List any professional certifications, licenses, or credentials you've earned.
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded p-3 text-xs text-gray-700">
              <p className="font-semibold mb-1">Examples:</p>
              <ul className="space-y-0.5 ml-4">
                <li>• Industry certifications (PMP, CPA, etc.)</li>
                <li>• Technical certifications (AWS, Google Cloud, etc.)</li>
                <li>• Professional licenses</li>
                <li>• Specialized training programs</li>
              </ul>
              <p className="mt-2 text-purple-600 font-medium">
                Skip this if you don't have certifications.
              </p>
            </div>
          </div>
        );

      case 'volunteer':
        return (
          <div>
            <h3 className="font-bold text-gray-900 mb-2">Step 8: Volunteer Experience (Optional)</h3>
            <p className="text-sm text-gray-700 mb-3">
              Volunteer work can demonstrate skills and values. Add it if it's relevant to your career goals.
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded p-3 text-xs text-gray-700">
              <p className="font-semibold mb-1">Include:</p>
              <ul className="space-y-0.5 ml-4">
                <li>• Organization name</li>
                <li>• Your role and contributions</li>
                <li>• Skills demonstrated</li>
              </ul>
              <p className="mt-2 text-purple-600 font-medium">
                Skip if not applicable.
              </p>
            </div>
          </div>
        );

      case 'languages':
        return (
          <div>
            <h3 className="font-bold text-gray-900 mb-2">Step 9: Languages (Optional)</h3>
            <p className="text-sm text-gray-700 mb-3">
              List languages you speak and your proficiency level.
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded p-3 text-xs text-gray-700">
              <p className="font-semibold mb-1">Proficiency levels:</p>
              <ul className="space-y-0.5 ml-4">
                <li>• Native or Bilingual</li>
                <li>• Fluent</li>
                <li>• Professional Working Proficiency</li>
                <li>• Conversational</li>
                <li>• Basic</li>
              </ul>
              <p className="mt-2 text-purple-600 font-medium">
                Skip if you only speak one language.
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Progress Header */}
      <div className="mb-4 pb-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-gray-900">Build Your Resume</h2>
          <span className="text-sm text-gray-600">Step {currentStep} of {steps.length}</span>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-purple-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(currentStep / steps.length) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Step Content */}
      <div className="flex-1 overflow-y-auto mb-4">
        {renderStepGuidance()}
      </div>

      {/* Navigation Buttons */}
      <div className="pt-4 border-t border-gray-200 space-y-2">
        {/* Validation Message */}
        {currentStepData.mandatory && !isStepComplete && (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-xs text-yellow-800">
            ⚠️ Please complete this section to continue (it's required for your resume)
          </div>
        )}

        {/* Next/Complete Button */}
        <button
          onClick={handleNext}
          disabled={currentStepData.mandatory && !isStepComplete}
          className="w-full bg-purple-600 text-white px-4 py-2.5 rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all font-semibold text-sm"
        >
          {isLastStep ? '✓ Complete Resume Skeleton' : `Continue to ${steps[currentStep]?.name} →`}
        </button>

        {/* Skip Button (for optional sections) */}
        {!currentStepData.mandatory && (
          <button
            onClick={handleSkipOptional}
            className="w-full bg-white text-gray-600 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-all text-sm"
          >
            Skip {currentStepData.name}
          </button>
        )}

        {/* Back Button */}
        {currentStep > 1 && (
          <button
            onClick={handleBack}
            className="w-full bg-white text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-50 transition-all text-sm"
          >
            ← Back to {steps[currentStep - 2]?.name}
          </button>
        )}

        {/* Skip Builder Option (Career Detail only) */}
        {showSkipOption && currentStep === 1 && (
          <div className="text-center pt-2">
            <button className="text-xs text-gray-500 hover:text-gray-700 underline">
              Skip builder - I'll upload my resume instead
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
