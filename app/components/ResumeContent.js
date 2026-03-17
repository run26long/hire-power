'use client'
import { useState } from 'react'

export default function ResumeContent({ resumeData, onUpdate, isUndoingRef, formatDate, readOnly = false, templateStyles = {}, selectedTemplate = 'crisp', combineBannerDismissed = false, setCombineBannerDismissed = () => {} }) {
  const [confirmingDelete, setConfirmingDelete] = useState(null)
  const [editingSection, setEditingSection] = useState(null)
  const ts = templateStyles

  function addExperienceSummary(jobIndex) {
    const newData = JSON.parse(JSON.stringify(resumeData))
    if (!newData.experience[jobIndex]) return
    newData.experience[jobIndex].summary = ' '
    onUpdate(newData)
  }

  function removeExperienceSummary(jobIndex) {
    const newData = JSON.parse(JSON.stringify(resumeData))
    delete newData.experience[jobIndex].summary
    onUpdate(newData)
  }

  function addExperienceBullet(jobIndex) {
    const newData = JSON.parse(JSON.stringify(resumeData))
    if (!newData.experience[jobIndex].bullets) newData.experience[jobIndex].bullets = []
    newData.experience[jobIndex].bullets.push('New bullet point')
    onUpdate(newData)
  }

  function deleteExperienceBullet(jobIndex, bulletIndex) {
    const newData = JSON.parse(JSON.stringify(resumeData))
    newData.experience[jobIndex].bullets.splice(bulletIndex, 1)
    onUpdate(newData)
  }

  function moveExperienceBulletUp(jobIndex, bulletIndex) {
    if (bulletIndex === 0) return
    const newData = JSON.parse(JSON.stringify(resumeData))
    const bullets = newData.experience[jobIndex].bullets
    const temp = bullets[bulletIndex]
    bullets[bulletIndex] = bullets[bulletIndex - 1]
    bullets[bulletIndex - 1] = temp
    onUpdate(newData)
  }

  function moveExperienceBulletDown(jobIndex, bulletIndex) {
    const newData = JSON.parse(JSON.stringify(resumeData))
    const bullets = newData.experience[jobIndex].bullets
    if (bulletIndex === bullets.length - 1) return
    const temp = bullets[bulletIndex]
    bullets[bulletIndex] = bullets[bulletIndex + 1]
    bullets[bulletIndex + 1] = temp
    onUpdate(newData)
  }

  // Generic entry move function for any array field
  function moveEntryUp(field, index) {
    if (index === 0) return
    const newData = JSON.parse(JSON.stringify(resumeData))
    const arr = newData[field]
    const temp = arr[index]
    arr[index] = arr[index - 1]
    arr[index - 1] = temp
    onUpdate(newData)
  }

  function moveEntryDown(field, index) {
    const newData = JSON.parse(JSON.stringify(resumeData))
    const arr = newData[field]
    if (index === arr.length - 1) return
    const temp = arr[index]
    arr[index] = arr[index + 1]
    arr[index + 1] = temp
    onUpdate(newData)
  }

  function addEducationLine(eduIndex) {
    const newData = JSON.parse(JSON.stringify(resumeData))
    if (!newData.education[eduIndex].lines) newData.education[eduIndex].lines = []
    newData.education[eduIndex].lines.push('New line')
    onUpdate(newData)
  }

  function deleteEducationLine(eduIndex, lineIndex) {
    const newData = JSON.parse(JSON.stringify(resumeData))
    newData.education[eduIndex].lines.splice(lineIndex, 1)
    onUpdate(newData)
  }

  function renameSkillCategory(oldName, newName) {
    if (!newName.trim() || oldName === newName) return
    const newData = JSON.parse(JSON.stringify(resumeData))
    newData.skillsCategories[newName] = newData.skillsCategories[oldName]
    delete newData.skillsCategories[oldName]
    onUpdate(newData)
  }

  function deleteSkillCategory(category) {
    const newData = JSON.parse(JSON.stringify(resumeData))
    const skillsToMerge = newData.skillsCategories[category]
    const categories = Object.keys(newData.skillsCategories)
    if (categories.length === 1) return
    const targetCategory = categories.find(cat => cat !== category)
    newData.skillsCategories[targetCategory] = [...newData.skillsCategories[targetCategory], ...skillsToMerge]
    delete newData.skillsCategories[category]
    onUpdate(newData)
  }

  function addSkillCategory() {
    const newData = JSON.parse(JSON.stringify(resumeData))
    if (!newData.skillsCategories) newData.skillsCategories = {}
    newData.skillsCategories['New Category'] = []
    onUpdate(newData)
  }

  function flattenSkills() {
    const newData = JSON.parse(JSON.stringify(resumeData))
    const allSkills = []
    Object.values(newData.skillsCategories).forEach(skills => allSkills.push(...skills))
    newData.skillsCategories = { "Skills": allSkills }
    onUpdate(newData)
  }

  function addProject() {
    const newData = JSON.parse(JSON.stringify(resumeData))
    if (!newData.projects) newData.projects = []
    newData.projects.push({ name: 'New Project', description: 'Project description', link: '' })
    onUpdate(newData)
  }

  function deleteProject(projectIndex) {
    const newData = JSON.parse(JSON.stringify(resumeData))
    newData.projects.splice(projectIndex, 1)
    onUpdate(newData)
  }

  function addCertification() {
    const newData = JSON.parse(JSON.stringify(resumeData))
    if (!newData.certifications) newData.certifications = []
    newData.certifications.push({ name: 'New Certification', details: 'Issuing organization | Date' })
    onUpdate(newData)
  }

  function deleteCertification(certIndex) {
    const newData = JSON.parse(JSON.stringify(resumeData))
    newData.certifications.splice(certIndex, 1)
    onUpdate(newData)
  }

  function addVolunteer() {
    const newData = JSON.parse(JSON.stringify(resumeData))
    if (!newData.volunteer) newData.volunteer = []
    newData.volunteer.push({ organization: 'Organization Name', description: 'Role and responsibilities' })
    onUpdate(newData)
  }

  function deleteVolunteer(volIndex) {
    const newData = JSON.parse(JSON.stringify(resumeData))
    newData.volunteer.splice(volIndex, 1)
    onUpdate(newData)
  }

  function addLanguage() {
    const newData = JSON.parse(JSON.stringify(resumeData))
    if (!newData.languages) newData.languages = []
    newData.languages.push({ language: 'Language', proficiency: 'Professional' })
    onUpdate(newData)
  }

  function deleteLanguage(langIndex) {
    const newData = JSON.parse(JSON.stringify(resumeData))
    newData.languages.splice(langIndex, 1)
    onUpdate(newData)
  }

  function updateField(field, value) {
    if (isUndoingRef.current) return
    const newData = { ...resumeData, [field]: value }
    onUpdate(newData)
  }

  function toggleSummary() {
    const newData = JSON.parse(JSON.stringify(resumeData))
    newData.hideSummary = !newData.hideSummary
    onUpdate(newData)
  }

  function updateSectionTitle(sectionKey, newTitle) {
    const newData = JSON.parse(JSON.stringify(resumeData))
    if (!newData.sectionTitles) newData.sectionTitles = {}
    newData.sectionTitles[sectionKey] = newTitle
    onUpdate(newData)
    setEditingSection(null)
  }

  const defaultSectionTitles = {
    experience: 'EXPERIENCE',
    education: 'EDUCATION',
    skills: 'SKILLS',
    projects: 'PROJECTS',
    certifications: 'CERTIFICATIONS',
    volunteer: 'VOLUNTEER',
    languages: 'LANGUAGES',
    additionalInfo: 'ADDITIONAL INFORMATION',
  }

  function getSectionTitle(key) {
    return resumeData.sectionTitles?.[key] || defaultSectionTitles[key]
  }

  const defaultSectionOrder = ['experience', 'education', 'skills', 'projects', 'certifications', 'volunteer', 'languages', 'additionalInfo']

  function moveSectionUp(sectionName) {
    const newData = JSON.parse(JSON.stringify(resumeData))
    const order = [...(newData.sectionOrder?.length ? newData.sectionOrder : defaultSectionOrder)]
    const index = order.indexOf(sectionName)
    if (index <= 0) return
    const temp = order[index]
    order[index] = order[index - 1]
    order[index - 1] = temp
    newData.sectionOrder = order
    onUpdate(newData)
  }

  function moveSectionDown(sectionName) {
    const newData = JSON.parse(JSON.stringify(resumeData))
    const order = [...(newData.sectionOrder?.length ? newData.sectionOrder : defaultSectionOrder)]
    const index = order.indexOf(sectionName)
    if (index < 0 || index >= order.length - 1) return
    const temp = order[index]
    order[index] = order[index + 1]
    order[index + 1] = temp
    newData.sectionOrder = order
    onUpdate(newData)
  }

  function updateNestedField(path, value) {
    if (isUndoingRef.current) return
    const newData = JSON.parse(JSON.stringify(resumeData))
    const keys = path.split('.')
    let current = newData
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i]
      const arrayMatch = key.match(/(\w+)\[(\d+)\]/)
      if (arrayMatch) {
        const [, arrayName, index] = arrayMatch
        current = current[arrayName][parseInt(index)]
      } else {
        current = current[key]
      }
    }
    const lastKey = keys[keys.length - 1]
    current[lastKey] = value
    onUpdate(newData)
  }

  const activeSectionOrder = (resumeData.sectionOrder?.length ? resumeData.sectionOrder : defaultSectionOrder)
    .filter(s => defaultSectionOrder.includes(s))

  const titleTemplates = ['prestige', 'signature', 'current', 'vibe', 'edge']
  const showProfessionalTitle = titleTemplates.includes(selectedTemplate)
  const professionalTitleDisplay = resumeData.professionalTitle || resumeData.experience?.[0]?.title || ''

  // Entry move arrows — shown on hover for each entry within a section
  const entryArrows = (field, index, length) => !readOnly && (
    <div className="flex items-center gap-1 opacity-0 group-hover/entry:opacity-100">
      <button
        onClick={() => moveEntryUp(field, index)}
        disabled={index === 0}
        className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-20 disabled:cursor-not-allowed text-xs"
        title="Move up"
      >▲</button>
      <button
        onClick={() => moveEntryDown(field, index)}
        disabled={index === length - 1}
        className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-20 disabled:cursor-not-allowed text-xs"
        title="Move down"
      >▼</button>
    </div>
  )

  function deleteSection(sectionKey) {
    const newData = JSON.parse(JSON.stringify(resumeData))
    if (sectionKey === 'projects') newData.projects = []
    if (sectionKey === 'certifications') newData.certifications = []
    if (sectionKey === 'volunteer') newData.volunteer = []
    if (sectionKey === 'languages') newData.languages = []
    if (sectionKey === 'additionalInfo') newData.additionalInfo = []
    if (newData.sectionOrder) {
      newData.sectionOrder = newData.sectionOrder.filter(s => s !== sectionKey)
    }
    onUpdate(newData)
    setConfirmingDelete(null)
  }

  const deletableSections = ['projects', 'certifications', 'volunteer', 'languages', 'additionalInfo']

  // Section header with title editing + section move arrows + optional delete
  const sectionHeader = (sectionKey, extraContent = null) => (
    <h2 className="text-lg font-semibold border-b border-gray-300 pb-1 mb-3 flex items-center gap-1" style={ts.sectionHeader || {}}>
      {!readOnly && editingSection === sectionKey ? (
        <input
          autoFocus
          defaultValue={getSectionTitle(sectionKey)}
          className="text-lg font-semibold bg-purple-50 border border-purple-300 rounded px-1 outline-none"
          style={ts.sectionHeader || {}}
          onBlur={(e) => updateSectionTitle(sectionKey, e.target.value.trim() || defaultSectionTitles[sectionKey])}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.target.blur()
            if (e.key === 'Escape') setEditingSection(null)
          }}
        />
      ) : (
        <span
          className={!readOnly ? 'cursor-pointer hover:text-purple-600' : ''}
          onClick={() => !readOnly && setEditingSection(sectionKey)}
          title={!readOnly ? 'Click to rename' : ''}
        >
          {getSectionTitle(sectionKey)}
        </span>
      )}
      {!readOnly && (
        <span className="opacity-0 group-hover:opacity-100 ml-1 flex items-center gap-1">
          <button
            onClick={() => moveSectionUp(sectionKey)}
            disabled={activeSectionOrder[0] === sectionKey}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-20 disabled:cursor-not-allowed text-xs"
            title="Move section up"
          >▲</button>
          <button
            onClick={() => moveSectionDown(sectionKey)}
            disabled={activeSectionOrder[activeSectionOrder.length - 1] === sectionKey}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-20 disabled:cursor-not-allowed text-xs"
            title="Move section down"
          >▼</button>
          {deletableSections.includes(sectionKey) && (
            confirmingDelete === `section-${sectionKey}` ? (
              <span className="flex items-center gap-1 text-xs font-normal">
                <span className="text-gray-600">Remove section?</span>
                <button onClick={() => deleteSection(sectionKey)} className="text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded">Yes</button>
                <button onClick={() => setConfirmingDelete(null)} className="text-gray-600 hover:bg-gray-100 px-2 py-0.5 rounded">No</button>
              </span>
            ) : (
              <button onClick={() => setConfirmingDelete(`section-${sectionKey}`)} className="text-red-400 hover:text-red-600 hover:bg-red-50 px-1 rounded text-xs font-normal" title="Remove this section">🗑️</button>
            )
          )}
        </span>
      )}
      {extraContent}
    </h2>
  )

  const sections = {
    experience: resumeData.experience?.length > 0 ? (
      <div className="mb-6 group" key="experience">
        {sectionHeader('experience')}
        {resumeData.experience.map((job, jobIndex) => (
          <div key={jobIndex} className={`mb-4 p-2 rounded group/entry ${!readOnly && 'hover:bg-purple-50'}`}>
            <div className="flex justify-between items-start mb-1">
              <div className="flex items-center gap-1 flex-1">
                <h3 className={`font-semibold ${!readOnly && 'cursor-text'}`} style={ts.jobTitle || {}} contentEditable={!readOnly} suppressContentEditableWarning onBlur={(e) => updateNestedField(`experience[${jobIndex}].title`, e.currentTarget.textContent)}>{job.title || 'Job Title'}</h3>
                {entryArrows('experience', jobIndex, resumeData.experience.length)}
                {!readOnly && (confirmingDelete === `experience-entry-${jobIndex}` ? (
                  <div className="flex items-center gap-1 text-xs opacity-0 group-hover/entry:opacity-100">
                    <span className="text-gray-600">Delete job?</span>
                    <button onClick={() => {
                      const newData = JSON.parse(JSON.stringify(resumeData))
                      newData.experience.splice(jobIndex, 1)
                      onUpdate(newData)
                      setConfirmingDelete(null)
                    }} className="text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded">Yes</button>
                    <button onClick={() => setConfirmingDelete(null)} className="text-gray-600 hover:bg-gray-100 px-2 py-0.5 rounded">No</button>
                  </div>
                ) : <button onClick={() => setConfirmingDelete(`experience-entry-${jobIndex}`)} className="text-red-400 hover:text-red-600 hover:bg-red-50 px-1 rounded opacity-0 group-hover/entry:opacity-100 text-xs" title="Delete job">🗑️</button>)}
              </div>
              {selectedTemplate !== 'sharp' && (
                <span className="text-sm text-gray-600 ml-2 shrink-0" style={ts.date || {}}>{formatDate(job.startDate)} - {job.current ? 'Present' : formatDate(job.endDate)}</span>
              )}
            </div>
            {selectedTemplate === 'sharp' ? (
              <p className={`text-sm text-gray-600 mb-2`} style={ts.company || {}}>
                {[job.company, job.location, `${formatDate(job.startDate)} - ${job.current ? 'Present' : formatDate(job.endDate)}`].filter(Boolean).join(' | ')}
              </p>
            ) : (
              <p className={`text-sm font-medium text-gray-700 mb-2 ${!readOnly && 'cursor-text'}`} style={ts.company || {}} contentEditable={!readOnly} suppressContentEditableWarning onBlur={(e) => updateNestedField(`experience[${jobIndex}].company`, e.currentTarget.textContent)}>{job.company}</p>
            )}
            {job.summary ? (
              <div className="mb-2">
                <p className={`text-sm text-gray-700 italic ${!readOnly && 'cursor-text'}`} style={ts.body || {}} contentEditable={!readOnly} suppressContentEditableWarning onBlur={(e) => updateNestedField(`experience[${jobIndex}].summary`, e.currentTarget.textContent)}>{job.summary}</p>
                {!readOnly && <button onClick={() => removeExperienceSummary(jobIndex)} className="text-red-500 text-xs mt-1 opacity-50 hover:opacity-100">× Remove Summary</button>}
              </div>
            ) : !readOnly && job.summaryDismissed !== true && (
              <div className="flex items-center gap-2 mb-2">
                <button onClick={() => addExperienceSummary(jobIndex)} className="text-purple-600 text-xs opacity-50 hover:opacity-100">+ Add Summary Paragraph (1-2 sentences)</button>
                <button onClick={() => { const newData = JSON.parse(JSON.stringify(resumeData)); newData.experience[jobIndex].summaryDismissed = true; onUpdate(newData) }} className="text-gray-400 text-xs hover:text-gray-600">× Hide this field</button>
              </div>
            )}
            {job.bullets?.length > 0 && job.bullets.map((bullet, bulletIndex) => (
              <div key={bulletIndex} className="flex items-start gap-2 mb-1 group/bullet">
                <span className="text-sm" style={ts.bullet || {}}>•</span>
                <p className={`text-sm flex-1 ${!readOnly && 'cursor-text'}`} style={ts.body || {}} contentEditable={!readOnly} suppressContentEditableWarning onBlur={(e) => updateNestedField(`experience[${jobIndex}].bullets[${bulletIndex}]`, e.currentTarget.textContent)}>{bullet}</p>
                {!readOnly && (
                  <div className="flex items-center gap-1 opacity-0 group-hover/bullet:opacity-100">
                    <button onClick={() => moveExperienceBulletUp(jobIndex, bulletIndex)} disabled={bulletIndex === 0} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-20 disabled:cursor-not-allowed text-xs" title="Move up">▲</button>
                    <button onClick={() => moveExperienceBulletDown(jobIndex, bulletIndex)} disabled={bulletIndex === job.bullets.length - 1} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-20 disabled:cursor-not-allowed text-xs" title="Move down">▼</button>
                    {confirmingDelete === `experience-${jobIndex}-${bulletIndex}` ? (
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-gray-600">Delete?</span>
                        <button onClick={() => { deleteExperienceBullet(jobIndex, bulletIndex); setConfirmingDelete(null) }} className="text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded">Yes</button>
                        <button onClick={() => setConfirmingDelete(null)} className="text-gray-600 hover:bg-gray-100 px-2 py-0.5 rounded">No</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmingDelete(`experience-${jobIndex}-${bulletIndex}`)} className="text-red-500 hover:bg-red-50 px-1 rounded" title="Delete bullet">🗑️</button>
                    )}
                  </div>
                )}
              </div>
            ))}
            {!readOnly && <button onClick={() => addExperienceBullet(jobIndex)} className="text-purple-600 text-xs mt-2 opacity-0 group-hover/entry:opacity-100">+ Add Bullet</button>}
          </div>
        ))}
      </div>
    ) : null,

    education: resumeData.education?.length > 0 ? (
      <div className="mb-6 group" key="education">
        {sectionHeader('education')}
        {resumeData.education.map((edu, eduIndex) => (
          <div key={eduIndex} className={`mb-3 p-2 rounded group/entry ${!readOnly && 'hover:bg-purple-50'}`}>
            <div className="flex items-center gap-1 mb-1">
              <h3 className={`font-semibold ${!readOnly && 'cursor-text'}`} style={ts.jobTitle || {}} contentEditable={!readOnly} suppressContentEditableWarning onBlur={(e) => updateNestedField(`education[${eduIndex}].school`, e.currentTarget.textContent)}>{edu.school}</h3>
              {entryArrows('education', eduIndex, resumeData.education.length)}
              {!readOnly && (confirmingDelete === `education-${eduIndex}` ? (
                <div className="flex items-center gap-1 text-xs opacity-0 group-hover/entry:opacity-100">
                  <span className="text-gray-600">Delete?</span>
                  <button onClick={() => {
                    const newData = JSON.parse(JSON.stringify(resumeData))
                    newData.education.splice(eduIndex, 1)
                    onUpdate(newData)
                    setConfirmingDelete(null)
                  }} className="text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded">Yes</button>
                  <button onClick={() => setConfirmingDelete(null)} className="text-gray-600 hover:bg-gray-100 px-2 py-0.5 rounded">No</button>
                </div>
              ) : <button onClick={() => setConfirmingDelete(`education-${eduIndex}`)} className="text-red-500 hover:bg-red-50 px-1 rounded opacity-0 group-hover/entry:opacity-100" title="Delete education">🗑️</button>)}
            </div>
            {edu.lines?.map((line, lineIndex) => (
              <div key={lineIndex} className="flex items-start gap-2 group/line">
                <p className={`text-sm flex-1 ${!readOnly && 'cursor-text'}`} style={ts.body || {}} contentEditable={!readOnly} suppressContentEditableWarning onBlur={(e) => updateNestedField(`education[${eduIndex}].lines[${lineIndex}]`, e.currentTarget.textContent)}>{line}</p>
                {!readOnly && (
                  <div className="flex items-center gap-1 opacity-0 group-hover/line:opacity-100">
                    <button onClick={() => {
                      if (lineIndex === 0) return
                      const newData = JSON.parse(JSON.stringify(resumeData))
                      const lines = newData.education[eduIndex].lines
                      const temp = lines[lineIndex]; lines[lineIndex] = lines[lineIndex-1]; lines[lineIndex-1] = temp
                      onUpdate(newData)
                    }} disabled={lineIndex === 0} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-20 disabled:cursor-not-allowed text-xs">▲</button>
                    <button onClick={() => {
                      const newData = JSON.parse(JSON.stringify(resumeData))
                      const lines = newData.education[eduIndex].lines
                      if (lineIndex === lines.length - 1) return
                      const temp = lines[lineIndex]; lines[lineIndex] = lines[lineIndex+1]; lines[lineIndex+1] = temp
                      onUpdate(newData)
                    }} disabled={lineIndex === edu.lines.length - 1} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-20 disabled:cursor-not-allowed text-xs">▼</button>
                    {confirmingDelete === `eduline-${eduIndex}-${lineIndex}` ? (
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-gray-600">Delete?</span>
                        <button onClick={() => { deleteEducationLine(eduIndex, lineIndex); setConfirmingDelete(null) }} className="text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded">Yes</button>
                        <button onClick={() => setConfirmingDelete(null)} className="text-gray-600 hover:bg-gray-100 px-2 py-0.5 rounded">No</button>
                      </div>
                    ) : <button onClick={() => setConfirmingDelete(`eduline-${eduIndex}-${lineIndex}`)} className="text-red-500 hover:bg-red-50 px-1 rounded" title="Delete line">🗑️</button>}
                  </div>
                )}
              </div>
            ))}
            {!readOnly && <button onClick={() => addEducationLine(eduIndex)} className="text-purple-600 text-xs mt-1 opacity-0 group-hover/entry:opacity-100">+ Add Line</button>}
          </div>
        ))}
      </div>
    ) : null,

    skills: resumeData.skillsCategories && Object.keys(resumeData.skillsCategories).length > 0 ? (
      <div className={`mb-6 p-2 rounded group ${!readOnly && 'hover:bg-purple-50'}`} key="skills">
        {sectionHeader('skills',
          !readOnly && Object.keys(resumeData.skillsCategories).length > 1 ? (
            <button onClick={flattenSkills} className="text-purple-600 hover:bg-purple-100 px-2 py-1 rounded text-xs ml-2 font-medium opacity-0 group-hover:opacity-100">Combine All Skills Into One List</button>
          ) : null
        )}
        {Object.entries(resumeData.skillsCategories).map(([category, skills]) => {
          const isSingleSkillsCategory = Object.keys(resumeData.skillsCategories).length === 1 && category === 'Skills'
          return (
            <div key={category} className="mb-3 group/category">
              {!isSingleSkillsCategory && (
                <div className="flex items-center gap-2 mb-1">
                  <p className={`text-sm font-semibold ${!readOnly && 'cursor-text hover:bg-purple-100 px-1 rounded'}`} style={ts.body || {}} contentEditable={!readOnly} suppressContentEditableWarning onBlur={(e) => { if (isUndoingRef.current) return; const newName = e.currentTarget.textContent.trim(); if (newName && newName !== category) renameSkillCategory(category, newName) }}>{category}</p>
                  {!readOnly && (confirmingDelete === `category-${category}` ? (
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-gray-600">Delete?</span>
                      <button onClick={() => { deleteSkillCategory(category); setConfirmingDelete(null) }} className="text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded">Yes</button>
                      <button onClick={() => setConfirmingDelete(null)} className="text-gray-600 hover:bg-gray-100 px-2 py-0.5 rounded">No</button>
                    </div>
                  ) : <button onClick={() => setConfirmingDelete(`category-${category}`)} className="text-red-500 opacity-0 group-hover/category:opacity-100 text-xs px-1 hover:bg-red-50 rounded">🗑️</button>)}
                </div>
              )}
              <p className={`text-sm ${!readOnly && 'cursor-text hover:bg-purple-100 px-1 rounded'}`} style={ts.body || {}} contentEditable={!readOnly} suppressContentEditableWarning onBlur={(e) => { if (isUndoingRef.current) return; const newData = JSON.parse(JSON.stringify(resumeData)); newData.skillsCategories[category] = e.currentTarget.textContent.trim().split(/[,•]/).map(s => s.trim()).filter(s => s.length > 0); onUpdate(newData) }}>{Array.isArray(skills) ? skills.join(' • ') : skills}</p>
            </div>
          )
        })}
        {!readOnly && <button onClick={addSkillCategory} className="text-purple-600 text-xs mt-2 opacity-0 group-hover:opacity-100">+ Add Category</button>}
      </div>
    ) : null,

    projects: resumeData.projects?.length > 0 ? (
      <div className="mb-6 group" key="projects">
        {sectionHeader('projects')}
        {resumeData.projects.map((project, projectIndex) => (
          <div key={projectIndex} className={`mb-3 p-2 rounded group/entry ${!readOnly && 'hover:bg-purple-50'}`}>
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex items-center gap-1 flex-1">
                <h3 className={`font-semibold flex-1 ${!readOnly && 'cursor-text'}`} style={ts.jobTitle || {}} contentEditable={!readOnly} suppressContentEditableWarning onBlur={(e) => updateNestedField(`projects[${projectIndex}].name`, e.currentTarget.textContent)}>{project.name}</h3>
                {entryArrows('projects', projectIndex, resumeData.projects.length)}
              </div>
              {!readOnly && (confirmingDelete === `projects-${projectIndex}` ? (
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-gray-600">Delete?</span>
                  <button onClick={() => { deleteProject(projectIndex); setConfirmingDelete(null) }} className="text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded">Yes</button>
                  <button onClick={() => setConfirmingDelete(null)} className="text-gray-600 hover:bg-gray-100 px-2 py-0.5 rounded">No</button>
                </div>
              ) : <button onClick={() => setConfirmingDelete(`projects-${projectIndex}`)} className="text-red-500 hover:bg-red-50 px-1 rounded opacity-0 group-hover/entry:opacity-100" title="Delete project">🗑️</button>)}
            </div>
            <p className={`text-sm text-gray-700 mb-1 ${!readOnly && 'cursor-text'}`} style={ts.body || {}} contentEditable={!readOnly} suppressContentEditableWarning onBlur={(e) => updateNestedField(`projects[${projectIndex}].description`, e.currentTarget.textContent)}>{project.description}</p>
            {project.link && <p className={`text-sm text-purple-600 ${!readOnly && 'cursor-text'}`} style={ts.body || {}} contentEditable={!readOnly} suppressContentEditableWarning onBlur={(e) => updateNestedField(`projects[${projectIndex}].link`, e.currentTarget.textContent)}>{project.link}</p>}
          </div>
        ))}
        {!readOnly && <button onClick={addProject} className="text-purple-600 text-xs opacity-0 group-hover:opacity-100">+ Add Project</button>}
      </div>
    ) : null,

    certifications: resumeData.certifications?.length > 0 ? (
      <div className="mb-6 group" key="certifications">
        {sectionHeader('certifications')}
        {resumeData.certifications.map((cert, certIndex) => (
          <div key={certIndex} className={`mb-3 p-2 rounded group/entry ${!readOnly && 'hover:bg-purple-50'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-1">
                  <h3 className={`font-semibold flex-1 ${!readOnly && 'cursor-text'}`} style={ts.jobTitle || {}} contentEditable={!readOnly} suppressContentEditableWarning onBlur={(e) => updateNestedField(`certifications[${certIndex}].name`, e.currentTarget.textContent)}>{cert.name}</h3>
                  {entryArrows('certifications', certIndex, resumeData.certifications.length)}
                </div>
                <p className={`text-sm ${!readOnly && 'cursor-text'}`} style={ts.body || {}} contentEditable={!readOnly} suppressContentEditableWarning onBlur={(e) => updateNestedField(`certifications[${certIndex}].details`, e.currentTarget.textContent)}>{cert.details}</p>
              </div>
              {!readOnly && (confirmingDelete === `certifications-${certIndex}` ? (
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-gray-600">Delete?</span>
                  <button onClick={() => { deleteCertification(certIndex); setConfirmingDelete(null) }} className="text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded">Yes</button>
                  <button onClick={() => setConfirmingDelete(null)} className="text-gray-600 hover:bg-gray-100 px-2 py-0.5 rounded">No</button>
                </div>
              ) : <button onClick={() => setConfirmingDelete(`certifications-${certIndex}`)} className="text-red-500 hover:bg-red-50 px-1 rounded opacity-0 group-hover/entry:opacity-100" title="Delete certification">🗑️</button>)}
            </div>
          </div>
        ))}
        {!readOnly && <button onClick={addCertification} className="text-purple-600 text-xs opacity-0 group-hover:opacity-100">+ Add Certification</button>}
      </div>
    ) : null,

    volunteer: resumeData.volunteer?.length > 0 ? (
      <div className="mb-6 group" key="volunteer">
        {sectionHeader('volunteer')}
        {resumeData.volunteer.map((vol, volIndex) => (
          <div key={volIndex} className={`mb-3 p-2 rounded group/entry ${!readOnly && 'hover:bg-purple-50'}`}>
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex items-center gap-1 flex-1">
                <h3 className={`font-semibold flex-1 ${!readOnly && 'cursor-text'}`} style={ts.jobTitle || {}} contentEditable={!readOnly} suppressContentEditableWarning onBlur={(e) => updateNestedField(`volunteer[${volIndex}].organization`, e.currentTarget.textContent)}>{vol.organization}</h3>
                {entryArrows('volunteer', volIndex, resumeData.volunteer.length)}
              </div>
              {!readOnly && (confirmingDelete === `volunteer-${volIndex}` ? (
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-gray-600">Delete?</span>
                  <button onClick={() => { deleteVolunteer(volIndex); setConfirmingDelete(null) }} className="text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded">Yes</button>
                  <button onClick={() => setConfirmingDelete(null)} className="text-gray-600 hover:bg-gray-100 px-2 py-0.5 rounded">No</button>
                </div>
              ) : <button onClick={() => setConfirmingDelete(`volunteer-${volIndex}`)} className="text-red-500 hover:bg-red-50 px-1 rounded opacity-0 group-hover/entry:opacity-100" title="Delete volunteer">🗑️</button>)}
            </div>
            <p className={`text-sm text-gray-700 ${!readOnly && 'cursor-text'}`} style={ts.body || {}} contentEditable={!readOnly} suppressContentEditableWarning onBlur={(e) => updateNestedField(`volunteer[${volIndex}].description`, e.currentTarget.textContent)}>{vol.description}</p>
          </div>
        ))}
        {!readOnly && <button onClick={addVolunteer} className="text-purple-600 text-xs opacity-0 group-hover:opacity-100">+ Add Volunteer Experience</button>}
      </div>
    ) : null,

    languages: resumeData.languages?.length > 0 ? (
      <div className="mb-6 group" key="languages">
        {sectionHeader('languages')}
        {resumeData.languages.map((lang, langIndex) => (
          <div key={langIndex} className={`mb-2 p-2 rounded group/entry flex items-center justify-between ${!readOnly && 'hover:bg-purple-50'}`}>
            <div className="flex items-center gap-3 flex-1">
              <span className={`font-semibold ${!readOnly && 'cursor-text'}`} contentEditable={!readOnly} suppressContentEditableWarning onBlur={(e) => updateNestedField(`languages[${langIndex}].language`, e.currentTarget.textContent)}>{lang.language}</span>
              <span className="text-gray-400">|</span>
              {readOnly ? (
                <span className="text-sm text-gray-600">{lang.proficiency || 'Professional'}</span>
              ) : (
                <select value={lang.proficiency || 'Professional'} onChange={(e) => updateNestedField(`languages[${langIndex}].proficiency`, e.target.value)} className="text-sm text-gray-600 bg-transparent border-none focus:outline-none cursor-pointer">
                  <option value="Native">Native</option>
                  <option value="Fluent">Fluent</option>
                  <option value="Professional">Professional</option>
                  <option value="Conversational">Conversational</option>
                  <option value="Basic">Basic</option>
                </select>
              )}
              {entryArrows('languages', langIndex, resumeData.languages.length)}
            </div>
            {!readOnly && (confirmingDelete === `languages-${langIndex}` ? (
              <div className="flex items-center gap-1 text-xs">
                <span className="text-gray-600">Delete?</span>
                <button onClick={() => { deleteLanguage(langIndex); setConfirmingDelete(null) }} className="text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded">Yes</button>
                <button onClick={() => setConfirmingDelete(null)} className="text-gray-600 hover:bg-gray-100 px-2 py-0.5 rounded">No</button>
              </div>
            ) : <button onClick={() => setConfirmingDelete(`languages-${langIndex}`)} className="text-red-500 hover:bg-red-50 px-1 rounded opacity-0 group-hover/entry:opacity-100" title="Delete language">🗑️</button>)}
          </div>
        ))}
        {!readOnly && <button onClick={addLanguage} className="text-purple-600 text-xs opacity-0 group-hover:opacity-100">+ Add Language</button>}
      </div>
    ) : null,

    additionalInfo: resumeData.additionalInfo?.length > 0 ? (
      <div className="mb-6 group" key="additionalInfo">
        {sectionHeader('additionalInfo')}
        {resumeData.additionalInfo.map((item, itemIndex) => (
         <div key={itemIndex} className={`py-0.5 px-1 rounded group/entry ${!readOnly && 'hover:bg-purple-50'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 flex-1">
                <span
                  className={`font-semibold text-sm ${!readOnly && 'cursor-text'}`}
                  style={ts.jobTitle || {}}
                  contentEditable={!readOnly}
                  suppressContentEditableWarning
                  onBlur={(e) => updateNestedField(`additionalInfo[${itemIndex}].label`, e.currentTarget.textContent)}
                >{item.label}</span>
                {item.detail && <span className="text-gray-400 text-sm shrink-0">|</span>}
                <span
                  className={`text-sm text-gray-600 flex-1 ${!readOnly && 'cursor-text'}`}
                  style={ts.body || {}}
                  contentEditable={!readOnly}
                  suppressContentEditableWarning
                  onBlur={(e) => updateNestedField(`additionalInfo[${itemIndex}].detail`, e.currentTarget.textContent)}
                >{item.detail}</span>
                {entryArrows('additionalInfo', itemIndex, resumeData.additionalInfo.length)}
              </div>
              {!readOnly && (confirmingDelete === `additionalInfo-${itemIndex}` ? (
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-gray-600">Delete?</span>
                  <button onClick={() => {
                    const newData = JSON.parse(JSON.stringify(resumeData))
                    newData.additionalInfo.splice(itemIndex, 1)
                    onUpdate(newData)
                    setConfirmingDelete(null)
                  }} className="text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded">Yes</button>
                  <button onClick={() => setConfirmingDelete(null)} className="text-gray-600 hover:bg-gray-100 px-2 py-0.5 rounded">No</button>
                </div>
              ) : <button onClick={() => setConfirmingDelete(`additionalInfo-${itemIndex}`)} className="text-red-500 hover:bg-red-50 px-1 rounded opacity-0 group-hover/entry:opacity-100" title="Delete item">🗑️</button>)}
            </div>
          </div>
        ))}
        {!readOnly && (
          <button
            onClick={() => {
              const newData = JSON.parse(JSON.stringify(resumeData))
              if (!newData.additionalInfo) newData.additionalInfo = []
              newData.additionalInfo.push({ label: 'Item Name', detail: 'Additional detail' })
              onUpdate(newData)
            }}
            className="text-purple-600 text-xs opacity-0 group-hover:opacity-100"
          >+ Add Item</button>
        )}
      </div>
    ) : null,
  }

  return (
    <div style={ts.page || {}}>
      {/* Header */}
      <div className="mb-6 p-2 rounded" style={ts.headerArea || {}}>
        <h1
          className={`text-3xl font-bold text-center mb-1 ${!readOnly && 'cursor-text hover:bg-purple-100 px-2 rounded'}`}
          style={ts.name || {}}
          contentEditable={!readOnly}
          suppressContentEditableWarning
          onBlur={(e) => updateField('fullName', e.currentTarget.textContent)}
        >{resumeData.fullName || 'Your Name'}</h1>
        {showProfessionalTitle && (
          <p
            className={`text-sm text-center mb-1 ${!readOnly && 'cursor-text hover:bg-purple-50 px-2 rounded'}`}
            style={ts.professionalTitle || { fontStyle: 'italic', color: '#666' }}
            contentEditable={!readOnly}
            suppressContentEditableWarning
            onBlur={(e) => updateField('professionalTitle', e.currentTarget.textContent)}
          >{professionalTitleDisplay || (!readOnly ? 'Add a professional title' : '')}</p>
        )}
        <div style={ts.contactBand || {}}>
          <p
            className={`text-sm text-gray-600 mt-1 text-center ${!readOnly && 'cursor-text hover:bg-purple-50 p-1 rounded'}`}
            style={ts.contact || {}}
            contentEditable={!readOnly}
            suppressContentEditableWarning
            onBlur={(e) => {
              if (isUndoingRef.current) return
              const parts = e.currentTarget.textContent.split('|').map(p => p.trim())
              const newData = { ...resumeData, location: parts[0] || '', phone: parts[1] || '', email: parts[2] || '', linkedin: parts[3] || '' }
              onUpdate(newData)
            }}
          >{[resumeData.location, resumeData.phone, resumeData.email, resumeData.linkedin].filter(Boolean).join(' | ') || 'Contact Info'}</p>
        </div>
      </div>

      {/* Summary */}
      {resumeData.summary && !resumeData.hideSummary && (
        <div className={`mb-6 p-2 rounded group ${!readOnly && 'hover:bg-purple-50'}`}>
          <h2 className="text-lg font-semibold border-b border-gray-300 pb-1 mb-2 flex items-center gap-1" style={ts.sectionHeader || {}}>
            {!readOnly && editingSection === 'summary' ? (
              <input
                autoFocus
                defaultValue={resumeData.sectionTitles?.summary || 'SUMMARY'}
                className="text-lg font-semibold bg-purple-50 border border-purple-300 rounded px-1 outline-none"
                onBlur={(e) => updateSectionTitle('summary', e.target.value.trim() || 'SUMMARY')}
                onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditingSection(null) }}
              />
            ) : (
              <span className={!readOnly ? 'cursor-pointer hover:text-purple-600' : ''} onClick={() => !readOnly && setEditingSection('summary')}>
                {resumeData.sectionTitles?.summary || 'SUMMARY'}
              </span>
            )}
            {!readOnly && (
              <button onClick={toggleSummary} className="text-gray-400 hover:text-gray-600 text-xs ml-2 opacity-0 group-hover:opacity-100 font-normal" title="Hide this section">Hide</button>
            )}
          </h2>
          <p
            className={`text-sm ${!readOnly && 'cursor-text hover:bg-purple-50 p-1 rounded'}`}
            style={ts.body || {}}
            contentEditable={!readOnly}
            suppressContentEditableWarning
            onBlur={(e) => updateField('summary', e.currentTarget.textContent)}
          >{resumeData.summary}</p>
        </div>
      )}

      {!readOnly && resumeData.summary && resumeData.hideSummary && (
        <button onClick={toggleSummary} className="mb-4 text-purple-600 text-sm opacity-50 hover:opacity-100">
          👁️ Show Summary Section
        </button>
      )}

      {activeSectionOrder.map(sectionName => sections[sectionName] || null)}

      {(!resumeData.experience || resumeData.experience.length === 0) && (
        <div className="text-center text-gray-400 py-12">
          <p>Resume content will appear here</p>
          <p className="text-sm mt-2">Click to edit</p>
        </div>
      )}

      {/* Combine Sections Banner */}
      {!readOnly && !resumeData._combineDismissed && (() => {
        const smallSections = [
          { key: 'certifications', items: resumeData.certifications },
          { key: 'languages', items: resumeData.languages },
          { key: 'volunteer', items: resumeData.volunteer },
          { key: 'projects', items: resumeData.projects },
        ].filter(s => s.items?.length > 0 && s.items.length <= 2)

        if (smallSections.length < 2) return null

        return (
          <div className="mt-4 mb-2 border border-purple-200 bg-purple-50 rounded-lg p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="text-sm font-semibold text-purple-800 mb-1">
                  💡 Combine into Additional Information?
                </p>
                <p className="text-xs text-purple-700">
                  You have {smallSections.length} sections with only 1-2 items each. Combining them into a single Additional Information section is cleaner and more professional.
                </p>
              </div>
              <button
                onClick={() => onUpdate({ ...resumeData, _combineDismissed: true })}
                className="text-purple-400 hover:text-purple-600 text-lg leading-none shrink-0"
              >×</button>
            </div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => {
                  const newData = JSON.parse(JSON.stringify(resumeData))
                  if (!newData.additionalInfo) newData.additionalInfo = []
                  smallSections.forEach(s => {
                    s.items.forEach(item => {
                      if (s.key === 'certifications') {
                        newData.additionalInfo.push({ label: item.name, detail: item.details || '' })
                      } else if (s.key === 'languages') {
                        newData.additionalInfo.push({ label: item.language, detail: item.proficiency || '' })
                      } else if (s.key === 'volunteer') {
                        newData.additionalInfo.push({ label: item.organization, detail: item.description || '' })
                      } else if (s.key === 'projects') {
                        newData.additionalInfo.push({ label: item.name, detail: item.description || '' })
                      }
                    })
                    newData[s.key] = []
                    if (newData.sectionOrder) {
                      newData.sectionOrder = newData.sectionOrder.filter(k => k !== s.key)
                    }
                  })
                  if (!newData.sectionOrder) newData.sectionOrder = [...defaultSectionOrder]
                  if (!newData.sectionOrder.includes('additionalInfo')) newData.sectionOrder.push('additionalInfo')
                  onUpdate(newData)
                }}
                className="bg-purple-600 text-white text-xs font-semibold px-3 py-1.5 rounded hover:bg-purple-700"
              >
                Yes, combine them
              </button>
              <button
                onClick={() => onUpdate({ ...resumeData, _combineDismissed: true })}
                className="text-xs text-purple-600 px-3 py-1.5 rounded hover:bg-purple-100"
              >
                No thanks
              </button>
            </div>
          </div>
        )
      })()}

      {/* Add Section */}
      {!readOnly && (() => {
        const allOptional = [
          { key: 'projects', label: 'Projects', check: () => !resumeData.projects?.length },
          { key: 'certifications', label: 'Certifications', check: () => !resumeData.certifications?.length },
          { key: 'volunteer', label: 'Volunteer Experience', check: () => !resumeData.volunteer?.length },
          { key: 'languages', label: 'Languages', check: () => !resumeData.languages?.length },
          { key: 'additionalInfo', label: 'Additional Information', check: () => !resumeData.additionalInfo?.length },
        ]
        const missing = allOptional.filter(s => s.check())
        if (missing.length === 0) return null

        return (
          <div className="relative group/addsection mt-4">
            <button className="text-purple-600 text-sm opacity-50 hover:opacity-100 flex items-center gap-1">
              + Add Section
            </button>
           <div className="absolute left-0 bottom-full pb-1 z-50 hidden group-hover/addsection:block bg-white border border-gray-200 rounded shadow-lg py-1 min-w-[180px]">
              {missing.map(s => (
                <button
                  key={s.key}
                  onClick={() => {
                    const newData = JSON.parse(JSON.stringify(resumeData))
                    if (s.key === 'projects') newData.projects = [{ name: 'Project Name', description: 'Project description', link: '' }]
                    if (s.key === 'certifications') newData.certifications = [{ name: 'Certification Name', details: 'Issuing organization | Date' }]
                    if (s.key === 'volunteer') newData.volunteer = [{ organization: 'Organization Name', description: 'Role and responsibilities' }]
                    if (s.key === 'languages') newData.languages = [{ language: 'Language', proficiency: 'Professional' }]
                    if (s.key === 'additionalInfo') newData.additionalInfo = [{ type: 'certification', label: 'Item Label', detail: 'Detail or description' }]
                    if (!newData.sectionOrder) newData.sectionOrder = [...defaultSectionOrder]
                    if (!newData.sectionOrder.includes(s.key)) newData.sectionOrder.push(s.key)
                    newData._combineDismissed = false
                    onUpdate(newData)
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-600"
                >
                  + {s.label}
                </button>
              ))}
            </div>
          </div>
        )
      })()}
    </div>
  )
}