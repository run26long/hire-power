'use client';

import { useState } from 'react';

/**
 * ResumeContent Component
 * 
 * Reusable resume display and editing component
 * Used in Resume Detail (editable) and Career Detail (view-only after building)
 * 
 * Props:
 * - resumeData: Object following RESUME_DATA_STRUCTURE_REFERENCE.md
 * - onUpdate: Function(updatedResumeData) - called when data changes
 * - readOnly: Boolean - if true, disable all editing (view-only mode)
 */

export default function ResumeContent({ 
  resumeData, 
  onUpdate, 
  readOnly = false 
}) {
  const [editingSection, setEditingSection] = useState(null);
  const [editData, setEditData] = useState(null);

  // Helper: Update resume data
  const updateResume = (updates) => {
    const updated = { ...resumeData, ...updates };
    onUpdate(updated);
  };

  // Open edit modal
  const openEdit = (section, data = null) => {
    if (readOnly) return;
    setEditingSection(section);
    setEditData(data);
  };

  // Close edit modal
  const closeEdit = () => {
    setEditingSection(null);
    setEditData(null);
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const [year, month] = dateString.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parseInt(month) - 1]} ${year}`;
  };

  return (
    <div className="p-8">
      {/* Contact Information */}
      <div 
        className={`text-center mb-6 pb-6 border-b border-gray-300 ${!readOnly ? 'cursor-pointer hover:bg-gray-50 rounded-lg p-2 transition-colors' : ''}`}
        onClick={() => openEdit('contact')}
      >
        {!readOnly && <span className="text-gray-400 text-sm float-right">✏️</span>}
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{resumeData.fullName || 'Your Name'}</h1>
        <div className="text-sm text-gray-600 space-x-2">
          {resumeData.location && <span>{resumeData.location}</span>}
          {resumeData.location && resumeData.phone && <span>|</span>}
          {resumeData.phone && <span>{resumeData.phone}</span>}
          {resumeData.phone && resumeData.email && <span>|</span>}
          {resumeData.email && <span>{resumeData.email}</span>}
        </div>
        {resumeData.linkedin && (
          <div className="text-sm text-gray-600 mt-1">{resumeData.linkedin}</div>
        )}
        {resumeData.portfolio && (
          <div className="text-sm text-gray-600">{resumeData.portfolio}</div>
        )}
      </div>

      {/* Summary */}
      {resumeData.summary && !resumeData.hideSummary && (
        <div 
          className={`mb-6 ${!readOnly ? 'cursor-pointer hover:bg-gray-50 rounded-lg p-2 transition-colors' : ''}`}
          onClick={() => openEdit('summary')}
        >
          {!readOnly && <span className="text-gray-400 text-sm float-right">✏️</span>}
          <h2 className="text-lg font-bold text-gray-900 mb-2 uppercase tracking-wide">Summary</h2>
          <p className="text-sm text-gray-700 leading-relaxed">{resumeData.summary}</p>
        </div>
      )}

      {/* Experience Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wide">Experience</h2>
          {!readOnly && (
            <button 
              onClick={() => openEdit('experience', null)}
              className="text-purple-600 hover:text-purple-700 text-sm font-medium"
            >
              + Add Experience
            </button>
          )}
        </div>
        
        {resumeData.experience && resumeData.experience.length > 0 ? (
          <div className="space-y-4">
            {resumeData.experience.map((job, index) => (
              <div 
                key={index}
                className={`${!readOnly ? 'cursor-pointer hover:bg-gray-50 rounded-lg p-2 transition-colors' : ''}`}
                onClick={() => !readOnly && openEdit('experience', { ...job, index })}
              >
                {!readOnly && <span className="text-gray-400 text-sm float-right">✏️</span>}
                <div className="mb-1">
                  <h3 className="font-bold text-gray-900">{job.title}</h3>
                  <div className="text-sm text-gray-700">
                    <span className="font-medium">{job.company}</span>
                    {job.location && <span> | {job.location}</span>}
                    <span> | {formatDate(job.startDate)} - {job.current ? 'Present' : formatDate(job.endDate)}</span>
                  </div>
                </div>
                {job.summary && (
                  <p className="text-sm text-gray-700 mb-2 italic">{job.summary}</p>
                )}
                {job.bullets && job.bullets.length > 0 && (
                  <ul className="list-disc ml-5 space-y-1">
                    {job.bullets.map((bullet, bIndex) => (
                      <li key={bIndex} className="text-sm text-gray-700">{bullet}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 italic">No experience added yet</p>
        )}
      </div>

      {/* Education Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wide">Education</h2>
          {!readOnly && (
            <button 
              onClick={() => openEdit('education', null)}
              className="text-purple-600 hover:text-purple-700 text-sm font-medium"
            >
              + Add Education
            </button>
          )}
        </div>
        
        {resumeData.education && resumeData.education.length > 0 ? (
          <div className="space-y-3">
            {resumeData.education.map((edu, index) => (
              <div 
                key={index}
                className={`${!readOnly ? 'cursor-pointer hover:bg-gray-50 rounded-lg p-2 transition-colors' : ''}`}
                onClick={() => !readOnly && openEdit('education', { ...edu, index })}
              >
                {!readOnly && <span className="text-gray-400 text-sm float-right">✏️</span>}
                <div>
                  <h3 className="font-bold text-gray-900">{edu.school}</h3>
                  {edu.degree && (
                    <div className="text-sm text-gray-700">
                      {edu.degree}{edu.field && ` in ${edu.field}`}
                      {edu.graduationDate && ` | ${formatDate(edu.graduationDate)}`}
                    </div>
                  )}
                  {edu.lines && edu.lines.length > 0 && (
                    <ul className="text-sm text-gray-700 mt-1">
                      {edu.lines.map((line, lIndex) => (
                        <li key={lIndex}>{line}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 italic">No education added yet</p>
        )}
      </div>

      {/* Skills Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wide">Skills</h2>
          {!readOnly && (
            <button 
              onClick={() => openEdit('skills')}
              className="text-purple-600 hover:text-purple-700 text-sm font-medium"
            >
              ✏️ Edit Skills
            </button>
          )}
        </div>
        
        {resumeData.skillsCategories && Object.keys(resumeData.skillsCategories).length > 0 ? (
          <div className="space-y-2">
            {Object.entries(resumeData.skillsCategories).map(([category, skills]) => (
              <div key={category}>
                <span className="font-semibold text-sm text-gray-900">{category}: </span>
                <span className="text-sm text-gray-700">{skills.join(' • ')}</span>
              </div>
            ))}
          </div>
        ) : resumeData.skills && resumeData.skills.length > 0 ? (
          <p className="text-sm text-gray-700">{resumeData.skills.join(' • ')}</p>
        ) : (
          <p className="text-sm text-gray-500 italic">No skills added yet</p>
        )}
      </div>

      {/* Optional Sections */}
      {resumeData.projects && resumeData.projects.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-2 uppercase tracking-wide">Projects</h2>
          <div className="space-y-2">
            {resumeData.projects.map((project, index) => (
              <div key={index}>
                <h3 className="font-bold text-gray-900">{project.name}</h3>
                <p className="text-sm text-gray-700">{project.description}</p>
                {project.link && <p className="text-sm text-purple-600">{project.link}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {resumeData.certifications && resumeData.certifications.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-2 uppercase tracking-wide">Certifications</h2>
          <div className="space-y-1">
            {resumeData.certifications.map((cert, index) => (
              <div key={index}>
                <span className="font-bold text-gray-900">{cert.name}</span>
                <span className="text-sm text-gray-700"> | {cert.details}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {resumeData.volunteer && resumeData.volunteer.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-2 uppercase tracking-wide">Volunteer Experience</h2>
          <div className="space-y-2">
            {resumeData.volunteer.map((vol, index) => (
              <div key={index}>
                <h3 className="font-bold text-gray-900">{vol.organization}</h3>
                <p className="text-sm text-gray-700">{vol.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {resumeData.languages && resumeData.languages.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-2 uppercase tracking-wide">Languages</h2>
          <p className="text-sm text-gray-700">
            {resumeData.languages.map(lang => `${lang.language} (${lang.proficiency})`).join(' • ')}
          </p>
        </div>
      )}

      {/* Edit Modals - TO BE IMPLEMENTED */}
      {/* These would be the same modals from Resume Detail */}
      {/* For now, placeholder showing what section is being edited */}
      {editingSection && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
            <h3 className="text-xl font-bold mb-4">Edit {editingSection}</h3>
            <p className="text-gray-600 mb-4">Edit modal for {editingSection} - to be implemented with full modals from Resume Detail</p>
            <button 
              onClick={closeEdit}
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
