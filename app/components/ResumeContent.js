'use client';

import { useState } from 'react';

export default function ResumeContent({ resumeData, onUpdate, isUndoingRef, formatDate, readOnly = false }) {
  const [confirmingDelete, setConfirmingDelete] = useState(null);
  
  function addExperienceSummary(jobIndex) {
    if (readOnly) return;
    const newData = JSON.parse(JSON.stringify(resumeData));
    if (!newData.experience[jobIndex]) return;
    newData.experience[jobIndex].summary = ' ';
    onUpdate(newData);
  }

  function removeExperienceSummary(jobIndex) {
    if (readOnly) return;
    const newData = JSON.parse(JSON.stringify(resumeData));
    delete newData.experience[jobIndex].summary;
    onUpdate(newData);
  }

  function addExperienceBullet(jobIndex) {
    if (readOnly) return;
    const newData = JSON.parse(JSON.stringify(resumeData));
    if (!newData.experience[jobIndex].bullets) {
      newData.experience[jobIndex].bullets = [];
    }
    newData.experience[jobIndex].bullets.push('New bullet point');
    onUpdate(newData);
  }

  function deleteExperienceBullet(jobIndex, bulletIndex) {
    if (readOnly) return;
    const newData = JSON.parse(JSON.stringify(resumeData));
    newData.experience[jobIndex].bullets.splice(bulletIndex, 1);
    onUpdate(newData);
  }

  function moveExperienceBulletUp(jobIndex, bulletIndex) {
    if (readOnly || bulletIndex === 0) return;
    const newData = JSON.parse(JSON.stringify(resumeData));
    const bullets = newData.experience[jobIndex].bullets;
    const temp = bullets[bulletIndex];
    bullets[bulletIndex] = bullets[bulletIndex - 1];
    bullets[bulletIndex - 1] = temp;
    onUpdate(newData);
  }

  function moveExperienceBulletDown(jobIndex, bulletIndex) {
    if (readOnly) return;
    const newData = JSON.parse(JSON.stringify(resumeData));
    const bullets = newData.experience[jobIndex].bullets;
    if (bulletIndex === bullets.length - 1) return;
    const temp = bullets[bulletIndex];
    bullets[bulletIndex] = bullets[bulletIndex + 1];
    bullets[bulletIndex + 1] = temp;
    onUpdate(newData);
  }

  function addEducationLine(eduIndex) {
    if (readOnly) return;
    const newData = JSON.parse(JSON.stringify(resumeData));
    if (!newData.education[eduIndex].lines) {
      newData.education[eduIndex].lines = [];
    }
    newData.education[eduIndex].lines.push('New line');
    onUpdate(newData);
  }

  function deleteEducationLine(eduIndex, lineIndex) {
    if (readOnly) return;
    const newData = JSON.parse(JSON.stringify(resumeData));
    newData.education[eduIndex].lines.splice(lineIndex, 1);
    onUpdate(newData);
  }

  function addSkill(category) {
    if (readOnly) return;
    const newData = JSON.parse(JSON.stringify(resumeData));
    if (!newData.skillsCategories) {
      newData.skillsCategories = {};
    }
    if (!newData.skillsCategories[category]) {
      newData.skillsCategories[category] = [];
    }
    newData.skillsCategories[category].push('New Skill');
    onUpdate(newData);
  }

  function deleteSkill(category, index) {
    if (readOnly) return;
    const newData = JSON.parse(JSON.stringify(resumeData));
    newData.skillsCategories[category].splice(index, 1);
    onUpdate(newData);
  }

  function renameSkillCategory(oldName, newName) {
    if (readOnly || !newName.trim() || oldName === newName) return;
    const newData = JSON.parse(JSON.stringify(resumeData));
    newData.skillsCategories[newName] = newData.skillsCategories[oldName];
    delete newData.skillsCategories[oldName];
    onUpdate(newData);
  }

  function deleteSkillCategory(category) {
    if (readOnly) return;
    const newData = JSON.parse(JSON.stringify(resumeData));
    const skillsToMerge = newData.skillsCategories[category];
    const categories = Object.keys(newData.skillsCategories);
    
    if (categories.length === 1) return;
    
    const targetCategory = categories.find(cat => cat !== category);
    newData.skillsCategories[targetCategory] = [
      ...newData.skillsCategories[targetCategory], 
      ...skillsToMerge
    ];
    
    delete newData.skillsCategories[category];
    onUpdate(newData);
  }

  function addSkillCategory() {
    if (readOnly) return;
    const newData = JSON.parse(JSON.stringify(resumeData));
    if (!newData.skillsCategories) {
      newData.skillsCategories = {};
    }
    newData.skillsCategories['New Category'] = [];
    onUpdate(newData);
  }

  function flattenSkills() {
    if (readOnly) return;
    const newData = JSON.parse(JSON.stringify(resumeData));
    const allSkills = [];
    Object.values(newData.skillsCategories).forEach(skills => {
      allSkills.push(...skills);
    });
    newData.skillsCategories = { "Skills": allSkills };
    onUpdate(newData);
  }

  function addProject() {
    if (readOnly) return;
    const newData = JSON.parse(JSON.stringify(resumeData));
    if (!newData.projects) {
      newData.projects = [];
    }
    newData.projects.push({
      name: 'New Project',
      description: 'Project description',
      link: ''
    });
    onUpdate(newData);
  }

  function deleteProject(projectIndex) {
    if (readOnly) return;
    const newData = JSON.parse(JSON.stringify(resumeData));
    newData.projects.splice(projectIndex, 1);
    onUpdate(newData);
  }

  function addCertification() {
    if (readOnly) return;
    const newData = JSON.parse(JSON.stringify(resumeData));
    if (!newData.certifications) {
      newData.certifications = [];
    }
    newData.certifications.push({
      name: 'New Certification',
      details: 'Issuing organization | Date'
    });
    onUpdate(newData);
  }

  function deleteCertification(certIndex) {
    if (readOnly) return;
    const newData = JSON.parse(JSON.stringify(resumeData));
    newData.certifications.splice(certIndex, 1);
    onUpdate(newData);
  }

  function addVolunteer() {
    if (readOnly) return;
    const newData = JSON.parse(JSON.stringify(resumeData));
    if (!newData.volunteer) {
      newData.volunteer = [];
    }
    newData.volunteer.push({
      organization: 'Organization Name',
      description: 'Role and responsibilities'
    });
    onUpdate(newData);
  }

  function deleteVolunteer(volIndex) {
    if (readOnly) return;
    const newData = JSON.parse(JSON.stringify(resumeData));
    newData.volunteer.splice(volIndex, 1);
    onUpdate(newData);
  }

  function addLanguage() {
    if (readOnly) return;
    const newData = JSON.parse(JSON.stringify(resumeData));
    if (!newData.languages) {
      newData.languages = [];
    }
    newData.languages.push({
      language: 'Language',
      proficiency: 'Professional'
    });
    onUpdate(newData);
  }

  function deleteLanguage(langIndex) {
    if (readOnly) return;
    const newData = JSON.parse(JSON.stringify(resumeData));
    newData.languages.splice(langIndex, 1);
    onUpdate(newData);
  }

  function updateField(field, value) {
    if (readOnly || isUndoingRef?.current) return;
    const newData = { ...resumeData, [field]: value };
    onUpdate(newData);
  }

  function toggleSummary() {
    if (readOnly) return;
    const newData = JSON.parse(JSON.stringify(resumeData));
    newData.hideSummary = !newData.hideSummary;
    onUpdate(newData);
  }

  function moveSectionUp(sectionName) {
    if (readOnly) return;
    const newData = JSON.parse(JSON.stringify(resumeData));
    const order = newData.sectionOrder || [];
    const index = order.indexOf(sectionName);
    if (index <= 0) return;
    
    const temp = order[index];
    order[index] = order[index - 1];
    order[index - 1] = temp;
    
    newData.sectionOrder = order;
    onUpdate(newData);
  }

  function moveSectionDown(sectionName) {
    if (readOnly) return;
    const newData = JSON.parse(JSON.stringify(resumeData));
    const order = newData.sectionOrder || [];
    const index = order.indexOf(sectionName);
    if (index < 0 || index >= order.length - 1) return;
    
    const temp = order[index];
    order[index] = order[index + 1];
    order[index + 1] = temp;
    
    newData.sectionOrder = order;
    onUpdate(newData);
  }

  function updateNestedField(path, value) {
    if (readOnly || isUndoingRef?.current) return;
    
    const newData = JSON.parse(JSON.stringify(resumeData));
    const keys = path.split('.');
    let current = newData;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      const arrayMatch = key.match(/(\w+)\[(\d+)\]/);
      
      if (arrayMatch) {
        const [, arrayName, index] = arrayMatch;
        current = current[arrayName][parseInt(index)];
      } else {
        current = current[key];
      }
    }
    
    const lastKey = keys[keys.length - 1];
    current[lastKey] = value;
    onUpdate(newData);
  }

  return (
    <>
      {/* Contact */}
      <div className="text-center mb-6 p-2 rounded">
        <h1 
          className={`text-3xl font-bold text-center mb-1 ${!readOnly && 'cursor-text hover:bg-purple-100 px-2 rounded'}`}
          contentEditable={!readOnly}
          suppressContentEditableWarning
          onBlur={(e) => updateField('fullName', e.currentTarget.textContent)}
        >
          {resumeData.fullName || 'Your Name'}
        </h1>
        <p 
          className={`text-sm text-gray-600 mt-1 ${!readOnly && 'cursor-text hover:bg-purple-50 p-1 rounded'}`}
          contentEditable={!readOnly}
          suppressContentEditableWarning
          onBlur={(e) => {
            if (readOnly || isUndoingRef?.current) return;
            const parts = e.currentTarget.textContent.split('|').map(p => p.trim());
            const newData = {
              ...resumeData,
              location: parts[0] || '',
              phone: parts[1] || '',
              email: parts[2] || '',
              linkedin: parts[3] || ''
            };
            onUpdate(newData);
          }}
        >
          {[resumeData.location, resumeData.phone, resumeData.email, resumeData.linkedin].filter(Boolean).join(' | ') || 'Contact Info'}
        </p>
      </div>

      {/* Summary */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-2 uppercase tracking-wide">Summary</h2>
        {resumeData.summary && !resumeData.hideSummary ? (
          <div className={`${!readOnly && 'p-2 rounded group hover:bg-purple-50'}`}>
            <p 
              className={`text-sm text-gray-700 leading-relaxed ${!readOnly && 'cursor-text'}`}
              contentEditable={!readOnly}
              suppressContentEditableWarning
              onBlur={(e) => updateField('summary', e.currentTarget.textContent)}
            >
              {resumeData.summary}
            </p>
            {!readOnly && (
              <button
                onClick={toggleSummary}
                className="text-gray-400 hover:text-gray-600 text-xs mt-2 opacity-0 group-hover:opacity-100"
              >
                Hide Summary Section
              </button>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500 italic">No summary added yet</p>
        )}
        {!readOnly && resumeData.summary && resumeData.hideSummary && (
          <button
            onClick={toggleSummary}
            className="text-purple-600 text-sm opacity-50 hover:opacity-100 mt-2"
          >
            👁️ Show Summary Section
          </button>
        )}
      </div>

      {/* Experience */}
      {resumeData.experience && resumeData.experience.length > 0 && (
        <div className="mb-6 group">
          <h2 className="text-lg font-semibold border-b border-gray-300 pb-1 mb-3">
            EXPERIENCE
            {!readOnly && (
              <span className="opacity-30 group-hover:opacity-100 ml-2">
                <button
                  onClick={() => moveSectionUp('experience')}
                  disabled={resumeData.sectionOrder?.[0] === 'experience'}
                  className="text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-30 disabled:cursor-not-allowed text-sm"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveSectionDown('experience')}
                  disabled={resumeData.sectionOrder?.[resumeData.sectionOrder.length - 1] === 'experience'}
                  className="text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-30 disabled:cursor-not-allowed text-sm"
                >
                  ↓
                </button>
              </span>
            )}
          </h2>
          {resumeData.experience.map((job, jobIndex) => (
            <div key={jobIndex} className={`mb-4 p-2 rounded ${!readOnly && 'group hover:bg-purple-50'}`}>
              <div className="flex justify-between items-start mb-1">
                <h3 
                  className={`font-semibold ${!readOnly && 'cursor-text'}`}
                  contentEditable={!readOnly}
                  suppressContentEditableWarning
                  onBlur={(e) => updateNestedField(`experience[${jobIndex}].title`, e.currentTarget.textContent)}
                >
                  {job.title || 'Job Title'}
                </h3>
                <span className="text-sm text-gray-600">
                  {formatDate(job.startDate)} - {job.current ? 'Present' : formatDate(job.endDate)}
                </span>
              </div>
              <p 
                className={`text-sm font-medium text-gray-700 mb-2 ${!readOnly && 'cursor-text'}`}
                contentEditable={!readOnly}
                suppressContentEditableWarning
                onBlur={(e) => updateNestedField(`experience[${jobIndex}].company`, e.currentTarget.textContent)}
              >
                {job.company}
              </p>
              
              {/* Summary paragraph */}
              {job.summary ? (
                <div className="mb-2">
                  <p 
                    className={`text-sm text-gray-700 italic ${!readOnly && 'cursor-text'}`}
                    contentEditable={!readOnly}
                    suppressContentEditableWarning
                    onBlur={(e) => updateNestedField(`experience[${jobIndex}].summary`, e.currentTarget.textContent)}
                  >
                    {job.summary}
                  </p>
                  {!readOnly && (
                    <button
                      onClick={() => removeExperienceSummary(jobIndex)}
                      className="text-red-500 text-xs mt-1 opacity-50 hover:opacity-100"
                    >
                      × Remove Summary
                    </button>
                  )}
                </div>
              ) : !readOnly && job.summaryDismissed !== true && (
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={() => addExperienceSummary(jobIndex)}
                    className="text-purple-600 text-xs opacity-50 hover:opacity-100"
                  >
                    + Add Summary Paragraph (1-2 sentences)
                  </button>
                  <button
                    onClick={() => {
                      const newData = JSON.parse(JSON.stringify(resumeData));
                      newData.experience[jobIndex].summaryDismissed = true;
                      onUpdate(newData);
                    }}
                    className="text-gray-400 text-xs hover:text-gray-600"
                  >
                    × Hide this field
                  </button>
                </div>
              )}

              {/* Bullets */}
              {job.bullets && job.bullets.length > 0 && job.bullets.map((bullet, bulletIndex) => (
                <div key={bulletIndex} className="flex items-start gap-2 mb-1 group/bullet">
                  <span className="text-sm">•</span>
                  <p 
                    className={`text-sm flex-1 ${!readOnly && 'cursor-text'}`}
                    contentEditable={!readOnly}
                    suppressContentEditableWarning
                    onBlur={(e) => updateNestedField(`experience[${jobIndex}].bullets[${bulletIndex}]`, e.currentTarget.textContent)}
                  >
                    {bullet}
                  </p>
                  {!readOnly && (
                    <div className="flex items-center gap-1 opacity-30 group-hover/bullet:opacity-100">
                      <button
                        onClick={() => moveExperienceBulletUp(jobIndex, bulletIndex)}
                        disabled={bulletIndex === 0}
                        className="text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveExperienceBulletDown(jobIndex, bulletIndex)}
                        disabled={bulletIndex === job.bullets.length - 1}
                        className="text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        ↓
                      </button>
                      {confirmingDelete === `experience-${jobIndex}-${bulletIndex}` ? (
                        <div className="flex items-center gap-1 text-xs">
                          <span className="text-gray-600">Delete?</span>
                          <button
                            onClick={() => {
                              deleteExperienceBullet(jobIndex, bulletIndex);
                              setConfirmingDelete(null);
                            }}
                            className="text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setConfirmingDelete(null)}
                            className="text-gray-600 hover:bg-gray-100 px-2 py-0.5 rounded"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmingDelete(`experience-${jobIndex}-${bulletIndex}`)}
                          className="text-red-500 hover:bg-red-50 px-1 rounded"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {!readOnly && (
                <button
                  onClick={() => addExperienceBullet(jobIndex)}
                  className="text-purple-600 text-xs mt-2 opacity-0 group-hover:opacity-100"
                >
                  + Add Bullet
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Education */}
      {resumeData.education && resumeData.education.length > 0 && (
        <div className="mb-6 group">
          <h2 className="text-lg font-semibold border-b border-gray-300 pb-1 mb-3">
            EDUCATION
            {!readOnly && (
              <span className="opacity-30 group-hover:opacity-100 ml-2">
                <button
                  onClick={() => moveSectionUp('education')}
                  disabled={resumeData.sectionOrder?.[0] === 'education'}
                  className="text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-30 disabled:cursor-not-allowed text-sm"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveSectionDown('education')}
                  disabled={resumeData.sectionOrder?.[resumeData.sectionOrder.length - 1] === 'education'}
                  className="text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-30 disabled:cursor-not-allowed text-sm"
                >
                  ↓
                </button>
              </span>
            )}
          </h2>
          {resumeData.education.map((edu, eduIndex) => (
            <div key={eduIndex} className={`mb-3 p-2 rounded ${!readOnly && 'group hover:bg-purple-50'}`}>
              <h3 
                className={`font-semibold mb-1 ${!readOnly && 'cursor-text'}`}
                contentEditable={!readOnly}
                suppressContentEditableWarning
                onBlur={(e) => updateNestedField(`education[${eduIndex}].school`, e.currentTarget.textContent)}
              >
                {edu.school}
              </h3>
              
              {edu.lines && edu.lines.map((line, lineIndex) => (
                <div key={lineIndex} className="flex items-start gap-2 group/line">
                  <p 
                    className={`text-sm font-medium text-gray-700 flex-1 ${!readOnly && 'cursor-text'}`}
                    contentEditable={!readOnly}
                    suppressContentEditableWarning
                    onBlur={(e) => updateNestedField(`education[${eduIndex}].lines[${lineIndex}]`, e.currentTarget.textContent)}
                  >
                    {line}
                  </p>
                  {!readOnly && (
                    <button
                      onClick={() => deleteEducationLine(eduIndex, lineIndex)}
                      className="text-red-500 opacity-0 group-hover/line:opacity-100 text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}

              {!readOnly && (
                <button
                  onClick={() => addEducationLine(eduIndex)}
                  className="text-purple-600 text-xs mt-1 opacity-0 group-hover:opacity-100"
                >
                  + Add Line
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Skills */}
      {resumeData.skillsCategories && Object.keys(resumeData.skillsCategories).length > 0 && (
        <div className={`mb-6 p-2 rounded ${!readOnly && 'group hover:bg-purple-50'}`}>
          <h2 className="text-lg font-semibold border-b border-gray-300 pb-1 mb-2">
            SKILLS
            {!readOnly && (
              <span className="opacity-30 group-hover:opacity-100 ml-2">
                <button
                  onClick={() => moveSectionUp('skills')}
                  disabled={resumeData.sectionOrder?.[0] === 'skills'}
                  className="text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-30 disabled:cursor-not-allowed text-sm"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveSectionDown('skills')}
                  disabled={resumeData.sectionOrder?.[resumeData.sectionOrder.length - 1] === 'skills'}
                  className="text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-30 disabled:cursor-not-allowed text-sm"
                >
                  ↓
                </button>
                {Object.keys(resumeData.skillsCategories).length > 1 && (
                  <button
                    onClick={flattenSkills}
                    className="text-purple-600 hover:bg-purple-100 px-2 py-1 rounded text-xs ml-2 font-medium"
                  >
                    Combine All Skills Into One List
                  </button>
                )}
              </span>
            )}
          </h2>
          
          {Object.entries(resumeData.skillsCategories).map(([category, skills]) => {
            const isSingleSkillsCategory = Object.keys(resumeData.skillsCategories).length === 1 && category === 'Skills';
            
            return (
              <div key={category} className="mb-3 group/category">
                {!isSingleSkillsCategory && (
                  <div className="flex items-center gap-2 mb-1">
                    <p 
                      className={`text-sm font-semibold ${!readOnly && 'cursor-text hover:bg-purple-100 px-1 rounded'}`}
                      contentEditable={!readOnly}
                      suppressContentEditableWarning
                      onBlur={(e) => {
                        if (readOnly || isUndoingRef?.current) return;
                        const newName = e.currentTarget.textContent.trim();
                        if (newName && newName !== category) {
                          renameSkillCategory(category, newName);
                        }
                      }}
                    >
                      {category}
                    </p>
                    {!readOnly && (
                      <>
                        {confirmingDelete === `category-${category}` ? (
                          <div className="flex items-center gap-1 text-xs">
                            <span className="text-gray-600">Delete?</span>
                            <button
                              onClick={() => {
                                deleteSkillCategory(category);
                                setConfirmingDelete(null);
                              }}
                              className="text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setConfirmingDelete(null)}
                              className="text-gray-600 hover:bg-gray-100 px-2 py-0.5 rounded"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmingDelete(`category-${category}`)}
                            className="text-red-500 opacity-0 group-hover/category:opacity-100 text-xs px-1 hover:bg-red-50 rounded"
                          >
                            🗑️
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
                <p 
                  className={`text-sm ${!readOnly && 'cursor-text hover:bg-purple-100 px-1 rounded'}`}
                  contentEditable={!readOnly}
                  suppressContentEditableWarning
                  onBlur={(e) => {
                    if (readOnly || isUndoingRef?.current) return;
                    const newData = JSON.parse(JSON.stringify(resumeData));
                    const skillText = e.currentTarget.textContent.trim();
                    newData.skillsCategories[category] = skillText
                      .split(/[,•]/)
                      .map(s => s.trim())
                      .filter(s => s.length > 0);
                    onUpdate(newData);
                  }}
                >
                  {Array.isArray(skills) ? skills.join(', ') : skills}
                </p>
              </div>
            );
          })}
          
          {!readOnly && (
            <button
              onClick={addSkillCategory}
              className="text-purple-600 text-xs mt-2 opacity-0 group-hover:opacity-100"
            >
              + Add Category
            </button>
          )}
        </div>
      )}

      {/* Projects */}
      {resumeData.projects && resumeData.projects.length > 0 && (
        <div className="mb-6 group">
          <h2 className="text-lg font-semibold border-b border-gray-300 pb-1 mb-3">
            PROJECTS
            {!readOnly && (
              <span className="opacity-30 group-hover:opacity-100 ml-2">
                <button
                  onClick={() => moveSectionUp('projects')}
                  disabled={resumeData.sectionOrder?.[0] === 'projects'}
                  className="text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-30 disabled:cursor-not-allowed text-sm"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveSectionDown('projects')}
                  disabled={resumeData.sectionOrder?.[resumeData.sectionOrder.length - 1] === 'projects'}
                  className="text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-30 disabled:cursor-not-allowed text-sm"
                >
                  ↓
                </button>
              </span>
            )}
          </h2>
          {resumeData.projects.map((project, projectIndex) => (
            <div key={projectIndex} className={`mb-3 p-2 rounded ${!readOnly && 'group/project hover:bg-purple-50'}`}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <h3 
                  className={`font-semibold flex-1 ${!readOnly && 'cursor-text'}`}
                  contentEditable={!readOnly}
                  suppressContentEditableWarning
                  onBlur={(e) => updateNestedField(`projects[${projectIndex}].name`, e.currentTarget.textContent)}
                >
                  {project.name}
                </h3>
                {!readOnly && (
                  <>
                    {confirmingDelete === `projects-${projectIndex}` ? (
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-gray-600">Delete?</span>
                        <button
                          onClick={() => {
                            deleteProject(projectIndex);
                            setConfirmingDelete(null);
                          }}
                          className="text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setConfirmingDelete(null)}
                          className="text-gray-600 hover:bg-gray-100 px-2 py-0.5 rounded"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmingDelete(`projects-${projectIndex}`)}
                        className="text-red-500 hover:bg-red-50 px-1 rounded opacity-0 group-hover/project:opacity-100"
                      >
                        🗑️
                      </button>
                    )}
                  </>
                )}
              </div>
              <p 
                className={`text-sm text-gray-700 mb-1 ${!readOnly && 'cursor-text'}`}
                contentEditable={!readOnly}
                suppressContentEditableWarning
                onBlur={(e) => updateNestedField(`projects[${projectIndex}].description`, e.currentTarget.textContent)}
              >
                {project.description}
              </p>
              {project.link && (
                <p 
                  className={`text-sm text-purple-600 ${!readOnly && 'cursor-text'}`}
                  contentEditable={!readOnly}
                  suppressContentEditableWarning
                  onBlur={(e) => updateNestedField(`projects[${projectIndex}].link`, e.currentTarget.textContent)}
                >
                  {project.link}
                </p>
              )}
            </div>
          ))}
          {!readOnly && (
            <button
              onClick={addProject}
              className="text-purple-600 text-xs opacity-0 group-hover:opacity-100"
            >
              + Add Project
            </button>
          )}
        </div>
      )}

      {/* Certifications */}
      {resumeData.certifications && resumeData.certifications.length > 0 && (
        <div className="mb-6 group">
          <h2 className="text-lg font-semibold border-b border-gray-300 pb-1 mb-3">
            CERTIFICATIONS
            {!readOnly && (
              <span className="opacity-30 group-hover:opacity-100 ml-2">
                <button
                  onClick={() => moveSectionUp('certifications')}
                  disabled={resumeData.sectionOrder?.[0] === 'certifications'}
                  className="text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-30 disabled:cursor-not-allowed text-sm"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveSectionDown('certifications')}
                  disabled={resumeData.sectionOrder?.[resumeData.sectionOrder.length - 1] === 'certifications'}
                  className="text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-30 disabled:cursor-not-allowed text-sm"
                >
                  ↓
                </button>
              </span>
            )}
          </h2>
          {resumeData.certifications.map((cert, certIndex) => (
            <div key={certIndex} className={`mb-3 p-2 rounded ${!readOnly && 'group/cert hover:bg-purple-50'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <h3 
                    className={`font-semibold ${!readOnly && 'cursor-text'}`}
                    contentEditable={!readOnly}
                    suppressContentEditableWarning
                    onBlur={(e) => updateNestedField(`certifications[${certIndex}].name`, e.currentTarget.textContent)}
                  >
                    {cert.name}
                  </h3>
                  <p 
                    className={`text-sm text-gray-600 ${!readOnly && 'cursor-text'}`}
                    contentEditable={!readOnly}
                    suppressContentEditableWarning
                    onBlur={(e) => updateNestedField(`certifications[${certIndex}].details`, e.currentTarget.textContent)}
                  >
                    {cert.details}
                  </p>
                </div>
                {!readOnly && (
                  <>
                    {confirmingDelete === `certifications-${certIndex}` ? (
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-gray-600">Delete?</span>
                        <button
                          onClick={() => {
                            deleteCertification(certIndex);
                            setConfirmingDelete(null);
                          }}
                          className="text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setConfirmingDelete(null)}
                          className="text-gray-600 hover:bg-gray-100 px-2 py-0.5 rounded"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmingDelete(`certifications-${certIndex}`)}
                        className="text-red-500 hover:bg-red-50 px-1 rounded opacity-0 group-hover/cert:opacity-100"
                      >
                        🗑️
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
          {!readOnly && (
            <button
              onClick={addCertification}
              className="text-purple-600 text-xs opacity-0 group-hover:opacity-100"
            >
              + Add Certification
            </button>
          )}
        </div>
      )}

      {/* Volunteer */}
      {resumeData.volunteer && resumeData.volunteer.length > 0 && (
        <div className="mb-6 group">
          <h2 className="text-lg font-semibold border-b border-gray-300 pb-1 mb-3">
            VOLUNTEER
            {!readOnly && (
              <span className="opacity-30 group-hover:opacity-100 ml-2">
                <button
                  onClick={() => moveSectionUp('volunteer')}
                  disabled={resumeData.sectionOrder?.[0] === 'volunteer'}
                  className="text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-30 disabled:cursor-not-allowed text-sm"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveSectionDown('volunteer')}
                  disabled={resumeData.sectionOrder?.[resumeData.sectionOrder.length - 1] === 'volunteer'}
                  className="text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-30 disabled:cursor-not-allowed text-sm"
                >
                  ↓
                </button>
              </span>
            )}
          </h2>
          {resumeData.volunteer.map((vol, volIndex) => (
            <div key={volIndex} className={`mb-3 p-2 rounded ${!readOnly && 'group/vol hover:bg-purple-50'}`}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <h3 
                  className={`font-semibold flex-1 ${!readOnly && 'cursor-text'}`}
                  contentEditable={!readOnly}
                  suppressContentEditableWarning
                  onBlur={(e) => updateNestedField(`volunteer[${volIndex}].organization`, e.currentTarget.textContent)}
                >
                  {vol.organization}
                </h3>
                {!readOnly && (
                  <>
                    {confirmingDelete === `volunteer-${volIndex}` ? (
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-gray-600">Delete?</span>
                        <button
                          onClick={() => {
                            deleteVolunteer(volIndex);
                            setConfirmingDelete(null);
                          }}
                          className="text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setConfirmingDelete(null)}
                          className="text-gray-600 hover:bg-gray-100 px-2 py-0.5 rounded"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmingDelete(`volunteer-${volIndex}`)}
                        className="text-red-500 hover:bg-red-50 px-1 rounded opacity-0 group-hover/vol:opacity-100"
                      >
                        🗑️
                      </button>
                    )}
                  </>
                )}
              </div>
              <p 
                className={`text-sm text-gray-700 ${!readOnly && 'cursor-text'}`}
                contentEditable={!readOnly}
                suppressContentEditableWarning
                onBlur={(e) => updateNestedField(`volunteer[${volIndex}].description`, e.currentTarget.textContent)}
              >
                {vol.description}
              </p>
            </div>
          ))}
          {!readOnly && (
            <button
              onClick={addVolunteer}
              className="text-purple-600 text-xs opacity-0 group-hover:opacity-100"
            >
              + Add Volunteer Experience
            </button>
          )}
        </div>
      )}

      {/* Languages */}
      {resumeData.languages && resumeData.languages.length > 0 && (
        <div className="mb-6 group">
          <h2 className="text-lg font-semibold border-b border-gray-300 pb-1 mb-3">
            LANGUAGES
            {!readOnly && (
              <span className="opacity-30 group-hover:opacity-100 ml-2">
                <button
                  onClick={() => moveSectionUp('languages')}
                  disabled={resumeData.sectionOrder?.[0] === 'languages'}
                  className="text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-30 disabled:cursor-not-allowed text-sm"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveSectionDown('languages')}
                  disabled={resumeData.sectionOrder?.[resumeData.sectionOrder.length - 1] === 'languages'}
                  className="text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-30 disabled:cursor-not-allowed text-sm"
                >
                  ↓
                </button>
              </span>
            )}
          </h2>
          {resumeData.languages.map((lang, langIndex) => (
            <div key={langIndex} className={`mb-2 p-2 rounded flex items-center justify-between ${!readOnly && 'group/lang hover:bg-purple-50'}`}>
              <div className="flex items-center gap-3 flex-1">
                <span 
                  className={`font-semibold ${!readOnly && 'cursor-text'}`}
                  contentEditable={!readOnly}
                  suppressContentEditableWarning
                  onBlur={(e) => updateNestedField(`languages[${langIndex}].language`, e.currentTarget.textContent)}
                >
                  {lang.language}
                </span>
                <span className="text-gray-400">—</span>
                {readOnly ? (
                  <span className="text-sm text-gray-600">{lang.proficiency || 'Professional'}</span>
                ) : (
                  <select
                    value={lang.proficiency || 'Professional'}
                    onChange={(e) => updateNestedField(`languages[${langIndex}].proficiency`, e.target.value)}
                    className="text-sm text-gray-600 bg-transparent border-none focus:outline-none cursor-pointer"
                  >
                    <option value="Native">Native</option>
                    <option value="Fluent">Fluent</option>
                    <option value="Professional">Professional</option>
                    <option value="Conversational">Conversational</option>
                    <option value="Basic">Basic</option>
                  </select>
                )}
              </div>
              {!readOnly && (
                <>
                  {confirmingDelete === `languages-${langIndex}` ? (
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-gray-600">Delete?</span>
                      <button
                        onClick={() => {
                          deleteLanguage(langIndex);
                          setConfirmingDelete(null);
                        }}
                        className="text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setConfirmingDelete(null)}
                        className="text-gray-600 hover:bg-gray-100 px-2 py-0.5 rounded"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmingDelete(`languages-${langIndex}`)}
                      className="text-red-500 hover:bg-red-50 px-1 rounded opacity-0 group-hover/lang:opacity-100"
                    >
                      🗑️
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
          {!readOnly && (
            <button
              onClick={addLanguage}
              className="text-purple-600 text-xs opacity-0 group-hover:opacity-100"
            >
              + Add Language
            </button>
          )}
        </div>
      )}

      {(!resumeData.experience || resumeData.experience.length === 0) && (
        <div className="text-center text-gray-400 py-12">
          <p>Resume content will appear here</p>
          {!readOnly && <p className="text-sm mt-2">Click to edit</p>}
        </div>
      )}
    </>
  );
}