'use client'
import { useState, useEffect } from 'react'
import { groupExperience } from '../utils/groupExperience'
import { groupEducation } from '../utils/groupEducation'

export default function ResumeContent({ resumeData, onUpdate, isUndoingRef, formatDate, readOnly = false, templateStyles = {}, selectedTemplate = 'crisp', combineBannerDismissed = false, setCombineBannerDismissed = () => {}, onBulletAction = null, bulletSelectMode = null }) {
  const [confirmingDelete, setConfirmingDelete] = useState(null)
  const [editingSection, setEditingSection] = useState(null)
  const [focusedBullet, setFocusedBullet] = useState(null)
  const [focusedSection, setFocusedSection] = useState(null)

  useEffect(() => {
    if (!focusedBullet && !focusedSection) return
    const handler = (e) => {
      if (focusedBullet && !e.target.closest('[data-bullet-group]')) {
        setFocusedBullet(null)
      }
      if (focusedSection && !e.target.closest('[data-section-group]')) {
        setFocusedSection(null)
      }
    }
    document.addEventListener('click', handler, true)
    return () => document.removeEventListener('click', handler, true)
  }, [focusedBullet, focusedSection])

  const ts = templateStyles
  const sectionClass = selectedTemplate === 'current' ? 'mb-0 group' : 'mb-6 group'

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

  function addExperience() {
    const newData = JSON.parse(JSON.stringify(resumeData))
    if (!newData.experience) newData.experience = []
    newData.experience.push({
      title: '',
      company: '',
      location: '',
      startDate: '',
      endDate: '',
      current: false,
      summary: '',
      bullets: ['']
    })
    onUpdate(newData)
  }

  function addEducation() {
    const newData = JSON.parse(JSON.stringify(resumeData))
    if (!newData.education) newData.education = []
    newData.education.push({
      school: '',
      degree: '',
      field: '',
      graduationDate: '',
      location: '',
      lines: []
    })
    onUpdate(newData)
  }

  function addExperienceBullet(jobIndex) {
    const newData = JSON.parse(JSON.stringify(resumeData))
    if (!newData.experience[jobIndex].bullets) newData.experience[jobIndex].bullets = []
    newData.experience[jobIndex].bullets.push('')
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
    // Sync current DOM text for all bullets in this job before moving
    document.querySelectorAll(`[data-bullet^="${jobIndex}-"]`).forEach(el => {
      const idx = parseInt(el.getAttribute('data-bullet').split('-')[1])
      if (!isNaN(idx) && newData.experience[jobIndex].bullets[idx] !== undefined) {
        newData.experience[jobIndex].bullets[idx] = el.textContent
      }
    })
    const bullets = newData.experience[jobIndex].bullets
    const temp = bullets[bulletIndex]
    bullets[bulletIndex] = bullets[bulletIndex - 1]
    bullets[bulletIndex - 1] = temp
    onUpdate(newData)
  }

  function moveExperienceBulletDown(jobIndex, bulletIndex) {
    const newData = JSON.parse(JSON.stringify(resumeData))
    // Sync current DOM text for all bullets in this job before moving
    document.querySelectorAll(`[data-bullet^="${jobIndex}-"]`).forEach(el => {
      const idx = parseInt(el.getAttribute('data-bullet').split('-')[1])
      if (!isNaN(idx) && newData.experience[jobIndex].bullets[idx] !== undefined) {
        newData.experience[jobIndex].bullets[idx] = el.textContent
      }
    })
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

  function moveSkillCategoryUp(category) {
    const newData = JSON.parse(JSON.stringify(resumeData))
    const keys = Object.keys(newData.skillsCategories)
    const index = keys.indexOf(category)
    if (index <= 0) return
    const reordered = {}
    keys.forEach((k, i) => {
      if (i === index - 1) reordered[category] = newData.skillsCategories[category]
      else if (i === index) reordered[keys[index - 1]] = newData.skillsCategories[keys[index - 1]]
      else reordered[k] = newData.skillsCategories[k]
    })
    newData.skillsCategories = reordered
    onUpdate(newData)
  }

  function moveSkillCategoryDown(category) {
    const newData = JSON.parse(JSON.stringify(resumeData))
    const keys = Object.keys(newData.skillsCategories)
    const index = keys.indexOf(category)
    if (index >= keys.length - 1) return
    const reordered = {}
    keys.forEach((k, i) => {
      if (i === index) reordered[keys[index + 1]] = newData.skillsCategories[keys[index + 1]]
      else if (i === index + 1) reordered[category] = newData.skillsCategories[category]
      else reordered[k] = newData.skillsCategories[k]
    })
    newData.skillsCategories = reordered
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
    newData.projects.push({ name: '', description: '', link: '' })
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
    newData.certifications.push({ name: '', details: '' })
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
    newData.volunteer.push({ organization: '', description: '' })
    onUpdate(newData)
  }

  function deleteVolunteer(volIndex) {
    const newData = JSON.parse(JSON.stringify(resumeData))
    newData.volunteer.splice(volIndex, 1)
    onUpdate(newData)
  }

  function addReference() {
    const newData = JSON.parse(JSON.stringify(resumeData))
    if (!newData.references) newData.references = []
    newData.references.push({ name: '', title: '', company: '', phone: '', email: '', relationship: '' })
    onUpdate(newData)
  }

  function deleteReference(refIndex) {
    const newData = JSON.parse(JSON.stringify(resumeData))
    newData.references.splice(refIndex, 1)
    onUpdate(newData)
  }

  function addLanguage() {
    const newData = JSON.parse(JSON.stringify(resumeData))
    if (!newData.languages) newData.languages = []
    newData.languages.push({ language: '', proficiency: 'Professional' })
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
    references: 'REFERENCES',
  }

  function getSectionTitle(key) {
    return resumeData.sectionTitles?.[key] || defaultSectionTitles[key]
  }

  const edgeSectionOrder = ['experience', 'education', 'skills', 'projects', 'certifications', 'volunteer', 'languages', 'additionalInfo', 'references']
  const defaultSectionOrder = selectedTemplate === 'edge' ? edgeSectionOrder : ['experience', 'education', 'skills', 'projects', 'certifications', 'volunteer', 'languages', 'additionalInfo', 'references']

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
    const lastArrayMatch = lastKey.match(/(\w+)\[(\d+)\]/)
    if (lastArrayMatch) {
      const [, arrayName, index] = lastArrayMatch
      if (!current[arrayName]) current[arrayName] = []
      current[arrayName][parseInt(index)] = value
    } else {
      current[lastKey] = value
    }
    onUpdate(newData)
  }

  function parseDateInput(text) {
    if (!text || !text.trim()) return null
    const t = text.trim()
    // "2024" → "2024"
    if (/^\d{4}$/.test(t)) return t
    // "1/2024" or "01/2024" → "2024-01"
    const slashMatch = t.match(/^(\d{1,2})\/(\d{4})$/)
    if (slashMatch) return `${slashMatch[2]}-${slashMatch[1].padStart(2, '0')}`
    // "January 2024" or "Jan 2024" → "2024-01"
    const months = { january:'01', february:'02', march:'03', april:'04', may:'05', june:'06', july:'07', august:'08', september:'09', october:'10', november:'11', december:'12', jan:'01', feb:'02', mar:'03', apr:'04', jun:'06', jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12' }
    const wordMatch = t.match(/^([a-zA-Z]+)\s+(\d{4})$/)
    if (wordMatch && months[wordMatch[1].toLowerCase()]) return `${wordMatch[2]}-${months[wordMatch[1].toLowerCase()]}`
    // "2024-01" already correct
    if (/^\d{4}-\d{2}$/.test(t)) return t
    return null
  }

  const activeSectionOrder = (selectedTemplate === 'edge'
    ? edgeSectionOrder
    : (resumeData.sectionOrder?.length ? resumeData.sectionOrder : defaultSectionOrder))
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
    if (sectionKey === 'references') newData.references = []
    if (newData.sectionOrder) {
      newData.sectionOrder = newData.sectionOrder.filter(s => s !== sectionKey)
    }
    onUpdate(newData)
    setConfirmingDelete(null)
  }

  const deletableSections = ['projects', 'certifications', 'volunteer', 'languages', 'additionalInfo', 'references']

  // Section header with title editing + section move arrows + optional delete
  const sectionHeader = (sectionKey, extraContent = null) => (
    <>
      {ts.sectionDivider && <div style={ts.sectionDivider} />}
      {ts.vibeSectionDivider ? (
        <>
        <div style={ts.vibeSectionDivider}>
          <div style={ts.vibeSectionLine} />
          <div data-section-group={sectionKey} onClick={() => { if (window.innerWidth < 768) setFocusedSection(sectionKey) }} style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <h2 style={{ ...ts.sectionHeader, marginTop: '0', marginBottom: '0' }}>
              {!readOnly && editingSection === sectionKey ? (
                <input
                  autoFocus
                  defaultValue={getSectionTitle(sectionKey)}
                  className="font-semibold bg-purple-50 border border-purple-300 rounded px-1 outline-none"
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
            </h2>
            {!readOnly && (
              <span className={`absolute right-0 flex items-center gap-1 bg-white px-1.5 py-0.5 rounded shadow-md border border-purple-200 ${focusedSection === sectionKey ? 'opacity-100 md:opacity-0' : 'opacity-0 md:group-hover:opacity-100'}`}>
                <button onClick={(e) => { e.stopPropagation(); moveSectionUp(sectionKey) }} disabled={activeSectionOrder[0] === sectionKey} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-20 disabled:cursor-not-allowed text-xs" title="Move section up">▲</button>
                <button onClick={(e) => { e.stopPropagation(); moveSectionDown(sectionKey) }} disabled={activeSectionOrder[activeSectionOrder.length - 1] === sectionKey} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-20 disabled:cursor-not-allowed text-xs" title="Move section down">▼</button>
                {deletableSections.includes(sectionKey) && (
                  confirmingDelete === `section-${sectionKey}` ? (
                    <span className="flex items-center gap-1 text-xs font-normal">
                      <span className="text-gray-600">Remove section?</span>
                      <button onClick={(e) => { e.stopPropagation(); deleteSection(sectionKey) }} className="text-white bg-[#e57373] hover:bg-[#c62828] px-2 py-0.5 rounded">Yes</button>
                      <button onClick={(e) => { e.stopPropagation(); setConfirmingDelete(null) }} className="text-gray-600 hover:bg-gray-100 px-2 py-0.5 rounded">No</button>
                    </span>
                  ) : (
                    <button onClick={(e) => { e.stopPropagation(); setConfirmingDelete(`section-${sectionKey}`) }} className="text-red-400 hover:text-red-600 hover:bg-red-50 px-1 rounded text-xs font-normal" title="Remove this section">🗑️</button>
                  )
                )}
              </span>
            )}
            </div>
          <div style={ts.vibeSectionLine} />
        </div>
        {extraContent && <div className="flex justify-center mt-1">{extraContent}</div>}
        </>
      ) : selectedTemplate === 'edge' ? (
        <div className="mb-2 w-full">
          <div style={ts.sectionHeader || {}} className="w-full">
          <div data-section-group={sectionKey} onClick={() => { if (window.innerWidth < 768) setFocusedSection(sectionKey) }} style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <h2 style={{ ...ts.sectionHeader, marginTop: '0', marginBottom: '0', background: 'transparent' }}>
              {!readOnly && editingSection === sectionKey ? (
                <input
                  autoFocus
                  defaultValue={getSectionTitle(sectionKey)}
                  className="font-semibold bg-purple-50 border border-purple-300 rounded px-1 outline-none text-center"
                  style={{ ...ts.sectionHeader, marginTop: '0', marginBottom: '0' }}
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
                >
                  {getSectionTitle(sectionKey)}
                </span>
              )}
            </h2>
            {!readOnly && (
              <span className={`absolute right-0 flex items-center gap-1 bg-white px-1.5 py-0.5 rounded shadow-md border border-purple-200 ${focusedSection === sectionKey ? 'opacity-100 md:opacity-0' : 'opacity-0 md:group-hover:opacity-100'}`}>
                <button onClick={(e) => { e.stopPropagation(); moveSectionUp(sectionKey) }} disabled={activeSectionOrder[0] === sectionKey} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-20 disabled:cursor-not-allowed text-xs" title="Move section up">▲</button>
                <button onClick={(e) => { e.stopPropagation(); moveSectionDown(sectionKey) }} disabled={activeSectionOrder[activeSectionOrder.length - 1] === sectionKey} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-20 disabled:cursor-not-allowed text-xs" title="Move section down">▼</button>
                {deletableSections.includes(sectionKey) && (
                  confirmingDelete === `section-${sectionKey}` ? (
                    <span className="flex items-center gap-1 text-xs font-normal">
                      <span className="text-gray-600">Remove section?</span>
                      <button onClick={(e) => { e.stopPropagation(); deleteSection(sectionKey) }} className="text-white bg-[#e57373] hover:bg-[#c62828] px-2 py-0.5 rounded">Yes</button>
                      <button onClick={(e) => { e.stopPropagation(); setConfirmingDelete(null) }} className="text-gray-600 hover:bg-gray-100 px-2 py-0.5 rounded">No</button>
                    </span>
                  ) : (
                    <button onClick={(e) => { e.stopPropagation(); setConfirmingDelete(`section-${sectionKey}`) }} className="text-red-400 hover:text-red-600 hover:bg-red-50 px-1 rounded text-xs font-normal" title="Remove this section">🗑️</button>
                  )
                )}
              </span>
            )}
          </div>
          </div>
          {extraContent && <div className="flex justify-center mt-1">{extraContent}</div>}
        </div>
      ) : selectedTemplate === 'signature' ? (
        <div className="mb-2 w-full">
          <div style={ts.sectionHeader || {}} className="w-full">
          <div data-section-group={sectionKey} onClick={() => { if (window.innerWidth < 768) setFocusedSection(sectionKey) }} style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <h2 style={{ ...ts.sectionHeader, marginTop: '0', marginBottom: '0', background: 'transparent' }}>
              {!readOnly && editingSection === sectionKey ? (
                <input
                  autoFocus
                  defaultValue={getSectionTitle(sectionKey)}
                  className="font-semibold bg-purple-50 border border-purple-300 rounded px-1 outline-none text-center"
                  style={{ ...ts.sectionHeader, marginTop: '0', marginBottom: '0' }}
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
                >
                  {getSectionTitle(sectionKey)}
                </span>
              )}
            </h2>
            {!readOnly && (
              <span className={`absolute right-0 flex items-center gap-1 bg-white px-1.5 py-0.5 rounded shadow-md border border-purple-200 ${focusedSection === sectionKey ? 'opacity-100 md:opacity-0' : 'opacity-0 md:group-hover:opacity-100'}`}>
                <button onClick={(e) => { e.stopPropagation(); moveSectionUp(sectionKey) }} disabled={activeSectionOrder[0] === sectionKey} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-20 disabled:cursor-not-allowed text-xs" title="Move section up">▲</button>
                <button onClick={(e) => { e.stopPropagation(); moveSectionDown(sectionKey) }} disabled={activeSectionOrder[activeSectionOrder.length - 1] === sectionKey} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-20 disabled:cursor-not-allowed text-xs" title="Move section down">▼</button>
                {deletableSections.includes(sectionKey) && (
                  confirmingDelete === `section-${sectionKey}` ? (
                    <span className="flex items-center gap-1 text-xs font-normal">
                      <span className="text-gray-600">Remove section?</span>
                      <button onClick={(e) => { e.stopPropagation(); deleteSection(sectionKey) }} className="text-white bg-[#e57373] hover:bg-[#c62828] px-2 py-0.5 rounded">Yes</button>
                      <button onClick={(e) => { e.stopPropagation(); setConfirmingDelete(null) }} className="text-gray-600 hover:bg-gray-100 px-2 py-0.5 rounded">No</button>
                    </span>
                  ) : (
                    <button onClick={(e) => { e.stopPropagation(); setConfirmingDelete(`section-${sectionKey}`) }} className="text-red-400 hover:text-red-600 hover:bg-red-50 px-1 rounded text-xs font-normal" title="Remove this section">🗑️</button>
                  )
                )}
              </span>
            )}
          </div>
          </div>
          {extraContent && <div className="flex justify-center mt-1">{extraContent}</div>}
        </div>
      ) : (
      <h2 data-section-group={sectionKey} onClick={() => { if (window.innerWidth < 768) setFocusedSection(sectionKey) }} className="text-lg font-semibold border-b border-gray-300 pb-1 mb-3 flex items-center gap-1" style={ts.sectionHeader || {}}>
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
        <span className={`ml-1 flex items-center gap-1 bg-white px-1.5 py-0.5 rounded shadow-md border border-purple-200 ${focusedSection === sectionKey ? 'opacity-100 md:opacity-0' : 'opacity-0 md:group-hover:opacity-100'}`}>
          <button
            onClick={(e) => { e.stopPropagation(); moveSectionUp(sectionKey) }}
            disabled={activeSectionOrder[0] === sectionKey}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-20 disabled:cursor-not-allowed text-xs"
            title="Move section up"
          >▲</button>
          <button
            onClick={(e) => { e.stopPropagation(); moveSectionDown(sectionKey) }}
            disabled={activeSectionOrder[activeSectionOrder.length - 1] === sectionKey}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-20 disabled:cursor-not-allowed text-xs"
            title="Move section down"
          >▼</button>
          {deletableSections.includes(sectionKey) && (
            confirmingDelete === `section-${sectionKey}` ? (
              <span className="flex items-center gap-1 text-xs font-normal">
                <span className="text-gray-600">Remove section?</span>
                <button onClick={(e) => { e.stopPropagation(); deleteSection(sectionKey) }} className="text-white bg-[#e57373] hover:bg-[#c62828] px-2 py-0.5 rounded">Yes</button>
                <button onClick={(e) => { e.stopPropagation(); setConfirmingDelete(null) }} className="text-gray-600 hover:bg-gray-100 px-2 py-0.5 rounded">No</button>
              </span>
            ) : (
              <button onClick={(e) => { e.stopPropagation(); setConfirmingDelete(`section-${sectionKey}`) }} className="text-red-400 hover:text-red-600 hover:bg-red-50 px-1 rounded text-xs font-normal" title="Remove this section">🗑️</button>
            )
          )}
        </span>
      )}
      {extraContent}
    </h2>
    )}
    </>
  )

  const sections = {
    experience: resumeData.experience?.length > 0 ? (() => {
      const expGroups = groupExperience(resumeData.experience)

      const renderRoleBody = (job, jobIndex) => (
        <>
          {job.summary ? (
            <div className="mb-2 relative group/jobsummary">
              <p className={`text-sm text-gray-700 italic ${!readOnly && !bulletSelectMode && 'cursor-text'}`} style={ts.body || {}} contentEditable={!readOnly && !bulletSelectMode} suppressContentEditableWarning onBlur={(e) => updateNestedField(`experience[${jobIndex}].summary`, e.currentTarget.textContent)}>{job.summary}</p>
              {!readOnly && !onBulletAction && <button onClick={() => removeExperienceSummary(jobIndex)} className="text-[#e57373] text-xs mt-1 opacity-50 hover:opacity-100">× Remove Summary</button>}
              {onBulletAction && !bulletSelectMode && (
                <button
                  onClick={() => onBulletAction(job.summary, { type: 'jobSummary', jobIndex })}
                  className="absolute right-0 top-0 text-purple-400 hover:text-purple-600 hover:bg-purple-50 px-1 rounded hidden md:block md:opacity-0 md:group-hover/jobsummary:opacity-100"
                  title="Click to reword or fix this"
                >⚡</button>
              )}
              {bulletSelectMode && (
                <button
                  onClick={() => onBulletAction(job.summary, { type: 'jobSummary', jobIndex })}
                  className="absolute inset-0 z-10 cursor-pointer rounded hover:bg-purple-50 hover:ring-1 hover:ring-purple-300"
                />
              )}
            </div>
          ) : !readOnly && job.summaryDismissed !== true && (
            <div className="flex items-center gap-2 mb-2">
              <button onClick={() => addExperienceSummary(jobIndex)} className="text-purple-600 text-xs opacity-50 hover:opacity-100">+ Add Summary Paragraph (1-2 sentences)</button>
              <button onClick={() => { const newData = JSON.parse(JSON.stringify(resumeData)); newData.experience[jobIndex].summaryDismissed = true; onUpdate(newData) }} className="text-gray-400 text-xs hover:text-gray-600">× Hide this field</button>
            </div>
          )}
          {job.bullets?.length > 0 && job.bullets.map((bullet, bulletIndex) => (
           <div key={bulletIndex} data-bullet-group={`${jobIndex}-${bulletIndex}`} className="relative flex items-start gap-1 mb-1 group/bullet" onClick={() => { if (window.innerWidth < 768) setFocusedBullet(`${jobIndex}-${bulletIndex}`) }}>
              <span className="text-sm shrink-0" style={ts.bullet || {}}>•</span>
              <p data-bullet={`${jobIndex}-${bulletIndex}`} className={`text-sm flex-1 ${!readOnly && !bulletSelectMode && 'cursor-text'}`} style={{ ...(ts.body || {}), ...(bullet ? {} : { color: '#9ca3af', fontStyle: 'italic' }) }} contentEditable={!readOnly && !bulletSelectMode} suppressContentEditableWarning onFocus={(e) => { if (!bullet) { const range = document.createRange(); range.selectNodeContents(e.currentTarget); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range) } }} onBlur={(e) => { const t = e.currentTarget.textContent; updateNestedField(`experience[${jobIndex}].bullets[${bulletIndex}]`, t === 'Describe what you did and the impact you made' ? '' : t) }}>{bullet || (!readOnly && 'Describe what you did and the impact you made')}</p>
              {!readOnly && (
                <div className={`absolute right-0 top-0 flex items-center gap-1 bg-white px-1.5 py-0.5 rounded shadow-md border border-purple-200 ${focusedBullet === `${jobIndex}-${bulletIndex}` ? 'opacity-100 md:opacity-0' : 'opacity-0 group-hover/bullet:opacity-100'}`}>
                  <button
                    onMouseDown={(e) => { e.preventDefault(); const el = document.querySelector(`[data-bullet="${jobIndex}-${bulletIndex}"]`); if (el) updateNestedField(`experience[${jobIndex}].bullets[${bulletIndex}]`, el.textContent); }}
                    onClick={(e) => { e.stopPropagation(); moveExperienceBulletUp(jobIndex, bulletIndex); if (bulletIndex > 0) { setFocusedBullet(`${jobIndex}-${bulletIndex - 1}`); setTimeout(() => { if (window.innerWidth < 768) { const el = document.querySelector(`[data-bullet="${jobIndex}-${bulletIndex - 1}"]`); if (el) el.focus() } }, 50) } }} disabled={bulletIndex === 0} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-20 disabled:cursor-not-allowed text-xs" title="Move up">▲</button>
                  <button
                    onMouseDown={(e) => { e.preventDefault(); const el = document.querySelector(`[data-bullet="${jobIndex}-${bulletIndex}"]`); if (el) updateNestedField(`experience[${jobIndex}].bullets[${bulletIndex}]`, el.textContent); }}
                    onClick={(e) => { e.stopPropagation(); moveExperienceBulletDown(jobIndex, bulletIndex); if (bulletIndex < job.bullets.length - 1) { setFocusedBullet(`${jobIndex}-${bulletIndex + 1}`); setTimeout(() => { if (window.innerWidth < 768) { const el = document.querySelector(`[data-bullet="${jobIndex}-${bulletIndex + 1}"]`); if (el) el.focus() } }, 50) } }} disabled={bulletIndex === job.bullets.length - 1} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-20 disabled:cursor-not-allowed text-xs" title="Move down">▼</button>
                  {confirmingDelete === `experience-${jobIndex}-${bulletIndex}` ? (
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-gray-600">Delete?</span>
                      <button onClick={() => { deleteExperienceBullet(jobIndex, bulletIndex); setConfirmingDelete(null) }} className="text-white bg-[#e57373] hover:bg-[#c62828] px-2 py-0.5 rounded">Yes</button>
                      <button onClick={() => setConfirmingDelete(null)} className="text-gray-600 hover:bg-gray-100 px-2 py-0.5 rounded">No</button>
                    </div>
                  ) : (
                    <button onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); setConfirmingDelete(`experience-${jobIndex}-${bulletIndex}`) }} className="text-[#e57373] hover:bg-red-50 px-1 rounded" title="Delete bullet">🗑️</button>
                  )}
                  {onBulletAction && (
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => { e.stopPropagation(); onBulletAction(bullet, { type: 'bullet', jobIndex, bulletIndex }) }}
                      className="text-purple-400 hover:text-purple-600 hover:bg-purple-50 px-1 rounded text-xs"
                      title="Reword or Fix"
                    >⚡</button>
                  )}
                </div>
              )}
              {bulletSelectMode && (
                <button
                  onClick={() => onBulletAction(bullet, { type: 'bullet', jobIndex, bulletIndex })}
                  className="absolute inset-0 z-10 cursor-pointer rounded hover:bg-purple-50 hover:ring-1 hover:ring-purple-300"
                />
              )}
            </div>
          ))}
          {!readOnly && <button onClick={() => addExperienceBullet(jobIndex)} className="text-purple-600 text-xs mt-2 opacity-0 group-hover/entry:opacity-100">+ Add Bullet</button>}
        </>
      )

      return (
        <div className={sectionClass} key="experience">
          {sectionHeader('experience')}
          {expGroups.map((group, groupIndex) => {
            // Single-role group: company on top (caps non-bold) + location (mixed case), pipe-separated; title underneath (bold).
            if (group.roles.length === 1) {
              const job = group.roles[0]
              const jobIndex = job._originalIndex
              return (
                <div key={`group-${groupIndex}`} className={`mb-4 p-2 rounded group/entry ${!readOnly && 'hover:bg-purple-50'}`}>
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center gap-1 flex-1">
                      {selectedTemplate === 'sharp' || selectedTemplate === 'edge' ? (
                        <p className="text-sm text-gray-800 flex-1" style={ts.company || {}}>
                          <span style={{ textTransform: 'uppercase' }}>{job.company || 'Company'}</span>
                          {job.location && <span> | {job.location}</span>}
                        </p>
                      ) : (
                        <p
                          className={`text-sm text-gray-800 flex-1 ${!readOnly && 'cursor-text'}`}
                          style={ts.company || {}}
                        >
                          <span
                            style={{ textTransform: 'uppercase', color: job.company ? 'inherit' : '#9ca3af', fontStyle: job.company ? 'normal' : 'italic', minWidth: '80px', display: 'inline-block' }}
                            contentEditable={!readOnly}
                            suppressContentEditableWarning
                            onFocus={(e) => { if (!job.company) { e.currentTarget.textContent = '' } }}
                            onBlur={(e) => {
                              if (isUndoingRef.current) return
                              const val = e.currentTarget.textContent.trim()
                              if (!val) e.currentTarget.textContent = 'Company'
                              updateNestedField(`experience[${jobIndex}].company`, val)
                            }}
                          >{job.company || 'Company'}</span>
                          {(job.location || !readOnly) && (
                            <>
                              <span> | </span>
                              <span
                                style={{ color: job.location ? 'inherit' : '#9ca3af', fontStyle: job.location ? 'normal' : 'italic', minWidth: '60px', display: 'inline-block' }}
                                contentEditable={!readOnly}
                                suppressContentEditableWarning
                                onFocus={(e) => { if (!job.location) { e.currentTarget.textContent = '' } }}
                                onBlur={(e) => {
                                  if (isUndoingRef.current) return
                                  const val = e.currentTarget.textContent.trim()
                                  if (!val) e.currentTarget.textContent = 'Location'
                                  updateNestedField(`experience[${jobIndex}].location`, val)
                                }}
                              >{job.location || 'Location'}</span>
                            </>
                          )}
                        </p>
                      )}
                    </div>
                    {(
                      <span className="text-sm text-gray-600 ml-2 shrink-0" style={ts.date || {}}>
                        {!readOnly ? (
                          <>
                            <span
                              className="cursor-text hover:bg-purple-100 px-0.5 rounded"
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={(e) => {
                                const parsed = parseDateInput(e.currentTarget.textContent)
                                if (parsed) updateNestedField(`experience[${jobIndex}].startDate`, parsed)
                                else e.currentTarget.textContent = formatDate(job.startDate)
                              }}
                            >{formatDate(job.startDate)}</span>
                            {' - '}
                            <span
                              className="cursor-text hover:bg-purple-100 px-0.5 rounded"
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={(e) => {
                                const text = e.currentTarget.textContent.trim()
                                if (text.toLowerCase() === 'present') {
                                  updateNestedField(`experience[${jobIndex}].current`, true)
                                  updateNestedField(`experience[${jobIndex}].endDate`, null)
                                } else {
                                  const parsed = parseDateInput(text)
                                  if (parsed) {
                                    updateNestedField(`experience[${jobIndex}].current`, false)
                                    updateNestedField(`experience[${jobIndex}].endDate`, parsed)
                                  } else {
                                    e.currentTarget.textContent = job.current ? 'Present' : formatDate(job.endDate)
                                  }
                                }
                              }}
                            >{job.current ? 'Present' : formatDate(job.endDate)}</span>
                          </>
                        ) : (
                          <>{formatDate(job.startDate)} - {job.current ? 'Present' : formatDate(job.endDate)}</>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-1 flex-1">
                      <h3 className={`font-bold ${!readOnly && 'cursor-text'}`} style={{ ...(ts.jobTitle || {}), ...(job.title ? {} : { color: '#9ca3af', fontStyle: 'italic' }), minWidth: '80px' }} contentEditable={!readOnly} suppressContentEditableWarning onFocus={(e) => { if (!job.title) { e.currentTarget.textContent = '' } }} onBlur={(e) => { const val = e.currentTarget.textContent.trim(); if (!val) e.currentTarget.textContent = 'Job Title'; updateNestedField(`experience[${jobIndex}].title`, val) }}>{job.title || 'Job Title'}</h3>
                      {entryArrows('experience', jobIndex, resumeData.experience.length)}
                      {!readOnly && (confirmingDelete === `experience-entry-${jobIndex}` ? (
                        <div className="flex items-center gap-1 text-xs opacity-0 group-hover/entry:opacity-100">
                          <span className="text-gray-600">Delete job?</span>
                          <button onClick={() => {
                            const newData = JSON.parse(JSON.stringify(resumeData))
                            newData.experience.splice(jobIndex, 1)
                            onUpdate(newData)
                            setConfirmingDelete(null)
                          }} className="text-white bg-[#e57373] hover:bg-[#c62828] px-2 py-0.5 rounded">Yes</button>
                          <button onClick={() => setConfirmingDelete(null)} className="text-gray-600 hover:bg-gray-100 px-2 py-0.5 rounded">No</button>
                        </div>
                      ) : <button onClick={() => setConfirmingDelete(`experience-entry-${jobIndex}`)} className="text-red-400 hover:text-red-600 hover:bg-red-50 px-1 rounded opacity-0 group-hover/entry:opacity-100 text-xs" title="Delete job">🗑️</button>)}
                    </div>
                  </div>
                  {renderRoleBody(job, jobIndex)}
                </div>
              )
            }

            // Multi-role group: shared company header on top (caps non-bold) + location (mixed case), roles indented (title bold).
            const headerRole = group.roles[0] // most recent — used for shared location editing
            const headerJobIndex = headerRole._originalIndex
            const groupRangeText = `${formatDate(group.startDate)} - ${group.current ? 'Present' : formatDate(group.endDate)}`
            return (
              <div key={`group-${groupIndex}`} className={`mb-4 p-2 rounded ${!readOnly && 'hover:bg-purple-50/50'}`}>
                {/* Shared company header */}
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <p
                      className={`text-sm text-gray-800 ${!readOnly && 'cursor-text'}`}
                      style={ts.company || {}}
                    >
                      <span
                        style={{ textTransform: 'uppercase', color: group.company ? 'inherit' : '#9ca3af', fontStyle: group.company ? 'normal' : 'italic', minWidth: '80px', display: 'inline-block' }}
                        contentEditable={!readOnly}
                        suppressContentEditableWarning
                        onFocus={(e) => { if (!group.company) { e.currentTarget.textContent = '' } }}
                        onBlur={(e) => {
                          if (isUndoingRef.current) return
                          const newName = e.currentTarget.textContent.trim()
                          if (!newName) e.currentTarget.textContent = 'Company'
                          const newData = JSON.parse(JSON.stringify(resumeData))
                          group.roles.forEach(r => {
                            newData.experience[r._originalIndex].company = newName
                          })
                          onUpdate(newData)
                        }}
                      >{group.company || 'Company'}</span>
                      {(group.location || !readOnly) && (
                        <>
                          <span> | </span>
                          <span
                            style={{ color: group.location ? 'inherit' : '#9ca3af', fontStyle: group.location ? 'normal' : 'italic', minWidth: '60px', display: 'inline-block' }}
                            contentEditable={!readOnly}
                            suppressContentEditableWarning
                            onFocus={(e) => { if (!group.location) { e.currentTarget.textContent = '' } }}
                            onBlur={(e) => {
                              if (isUndoingRef.current) return
                              const val = e.currentTarget.textContent.trim()
                              if (!val) e.currentTarget.textContent = 'Location'
                              updateNestedField(`experience[${headerJobIndex}].location`, val)
                            }}
                          >{group.location || 'Location'}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <span className="text-sm text-gray-600 ml-2 shrink-0" style={ts.date || {}}>{groupRangeText}</span>
                </div>
                {/* Roles within the group, indented */}
                <div className="pl-4 border-l-2 border-purple-100">
                  {group.roles.map((job, roleIdx) => {
                    const jobIndex = job._originalIndex
                    const roleDateText = `${formatDate(job.startDate)} - ${job.current ? 'Present' : formatDate(job.endDate)}`
                    return (
                      <div key={`role-${jobIndex}`} className={`mb-3 p-2 rounded group/entry ${!readOnly && 'hover:bg-purple-50'}`}>
                        <div className="flex justify-between items-start mb-1">
                          <div className="flex items-center gap-1 flex-1 flex-wrap">
                           <h4 className={`font-bold ${!readOnly && 'cursor-text'}`} style={{ ...(ts.jobTitle || {}), ...(job.title ? {} : { color: '#9ca3af', fontStyle: 'italic' }), minWidth: '80px' }} contentEditable={!readOnly} suppressContentEditableWarning onFocus={(e) => { if (!job.title) { e.currentTarget.textContent = '' } }} onBlur={(e) => { const val = e.currentTarget.textContent.trim(); if (!val) e.currentTarget.textContent = 'Job Title'; updateNestedField(`experience[${jobIndex}].title`, val) }}>{job.title || 'Job Title'}</h4>
                            <span className="text-sm text-gray-600 font-normal" style={ts.date || {}}>
                              ({!readOnly ? (
                                <>
                                  <span
                                    className="cursor-text hover:bg-purple-100 px-0.5 rounded"
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(e) => {
                                      const parsed = parseDateInput(e.currentTarget.textContent)
                                      if (parsed) updateNestedField(`experience[${jobIndex}].startDate`, parsed)
                                      else e.currentTarget.textContent = formatDate(job.startDate)
                                    }}
                                  >{formatDate(job.startDate)}</span>
                                  {' - '}
                                  <span
                                    className="cursor-text hover:bg-purple-100 px-0.5 rounded"
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(e) => {
                                      const text = e.currentTarget.textContent.trim()
                                      if (text.toLowerCase() === 'present') {
                                        updateNestedField(`experience[${jobIndex}].current`, true)
                                        updateNestedField(`experience[${jobIndex}].endDate`, null)
                                      } else {
                                        const parsed = parseDateInput(text)
                                        if (parsed) {
                                          updateNestedField(`experience[${jobIndex}].current`, false)
                                          updateNestedField(`experience[${jobIndex}].endDate`, parsed)
                                        } else {
                                          e.currentTarget.textContent = job.current ? 'Present' : formatDate(job.endDate)
                                        }
                                      }
                                    }}
                                  >{job.current ? 'Present' : formatDate(job.endDate)}</span>
                                </>
                              ) : (
                                <>{roleDateText}</>
                              )})
                            </span>
                            {!readOnly && (confirmingDelete === `experience-entry-${jobIndex}` ? (
                              <div className="flex items-center gap-1 text-xs opacity-0 group-hover/entry:opacity-100">
                                <span className="text-gray-600">Delete role?</span>
                                <button onClick={() => {
                                  const newData = JSON.parse(JSON.stringify(resumeData))
                                  newData.experience.splice(jobIndex, 1)
                                  onUpdate(newData)
                                  setConfirmingDelete(null)
                                }} className="text-white bg-[#e57373] hover:bg-[#c62828] px-2 py-0.5 rounded">Yes</button>
                                <button onClick={() => setConfirmingDelete(null)} className="text-gray-600 hover:bg-gray-100 px-2 py-0.5 rounded">No</button>
                              </div>
                            ) : <button onClick={() => setConfirmingDelete(`experience-entry-${jobIndex}`)} className="text-red-400 hover:text-red-600 hover:bg-red-50 px-1 rounded opacity-0 group-hover/entry:opacity-100 text-xs" title="Delete role">🗑️</button>)}
                          </div>
                        </div>
                        {renderRoleBody(job, jobIndex)}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
          {!readOnly && <button onClick={addExperience} className="text-purple-600 text-xs opacity-0 group-hover:opacity-100">+ Add Job</button>}
        </div>
      )
    })() : null,

    education: resumeData.education?.length > 0 ? (() => {
      const eduGroups = groupEducation(resumeData.education)

      const renderDegreeBody = (edu, eduIndex) => {
        const linesNonEmpty = (edu.lines || []).filter(l => l && l.trim() !== '')
        return (
          <>
            {(!readOnly || edu.degree || edu.field || edu.graduationDate || edu.degreeDisplay) && (() => {
              const degreeText = edu.degreeDisplay || [edu.degree, edu.field].filter(Boolean).join(', ')
              const dateText = edu.graduationDate ? formatDate(edu.graduationDate) : ''
              return (
                <p className={`text-sm mb-1`} style={ts.jobTitle || {}}>
                  <span
                    className={`font-bold ${!readOnly && 'cursor-text'}`}
                    style={{ color: degreeText ? 'inherit' : '#9ca3af', fontStyle: degreeText ? 'normal' : 'italic', minWidth: '80px', display: 'inline-block' }}
                    contentEditable={!readOnly}
                    suppressContentEditableWarning
                    onFocus={(e) => { if (!degreeText) e.currentTarget.textContent = '' }}
                    onBlur={(e) => {
                      if (isUndoingRef.current) return
                      const val = e.currentTarget.textContent.trim()
                      if (!val) e.currentTarget.textContent = 'Degree'
                      const newData = JSON.parse(JSON.stringify(resumeData))
                      newData.education[eduIndex].degreeDisplay = val
                      onUpdate(newData)
                    }}
                  >{degreeText || 'Degree'}</span>
                  {(dateText || !readOnly) && (
                    <>
                      <span className="font-normal"> | </span>
                      <span
                        className={`font-normal ${!readOnly && 'cursor-text'}`}
                        style={{ color: dateText ? 'inherit' : '#9ca3af', fontStyle: dateText ? 'normal' : 'italic', minWidth: '60px', display: 'inline-block' }}
                        contentEditable={!readOnly}
                        suppressContentEditableWarning
                        onFocus={(e) => { if (!dateText) e.currentTarget.textContent = '' }}
                        onBlur={(e) => {
                          if (isUndoingRef.current) return
                          const val = e.currentTarget.textContent.trim()
                          if (!val) e.currentTarget.textContent = 'Graduation Date'
                          updateNestedField(`education[${eduIndex}].graduationDate`, val || null)
                        }}
                      >{dateText || 'Graduation Date'}</span>
                    </>
                  )}
                </p>
              )
            })()}
            {linesNonEmpty.length > 0 && (
              <p
                className={`text-sm ${!readOnly && 'cursor-text'}`}
                style={ts.body || {}}
                contentEditable={!readOnly}
                suppressContentEditableWarning
                onBlur={(e) => {
                  if (isUndoingRef.current) return
                  const newLines = e.currentTarget.textContent.split('|').map(s => s.trim()).filter(Boolean)
                  const newData = JSON.parse(JSON.stringify(resumeData))
                  newData.education[eduIndex].lines = newLines
                  onUpdate(newData)
                }}
              >{linesNonEmpty.join(' | ')}</p>
            )}
            {!readOnly && linesNonEmpty.length === 0 && (
              <button onClick={() => addEducationLine(eduIndex)} className="text-purple-600 text-xs mt-1 opacity-50 hover:opacity-100">+ Add Line</button>
            )}
          </>
        )
      }

      return (
        <div className="mb-6 group" key="education">
          {sectionHeader('education')}
          {eduGroups.map((group, groupIndex) => {
            // Single-degree group: school on top (all-caps, non-bold), degree underneath (bold).
            if (group.degrees.length === 1) {
              const edu = group.degrees[0]
              const eduIndex = edu._originalIndex
              return (
                <div key={`edu-group-${groupIndex}`} className={`mb-3 p-2 rounded group/entry ${!readOnly && 'hover:bg-purple-50'}`}>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <p
                      className={`text-sm uppercase flex-1 ${!readOnly && 'cursor-text'}`}
                      style={{ ...(ts.company || {}), ...(edu.school ? {} : { color: '#9ca3af', fontStyle: 'italic' }), minWidth: '100px' }}
                      contentEditable={!readOnly}
                      suppressContentEditableWarning
                      onFocus={(e) => { if (!edu.school) e.currentTarget.textContent = '' }}
                      onBlur={(e) => {
                        if (isUndoingRef.current) return
                        const val = e.currentTarget.textContent.trim()
                        if (!val) e.currentTarget.textContent = 'School Name'
                        updateNestedField(`education[${eduIndex}].school`, val)
                      }}
                    >{edu.school || 'School Name'}</p>
                    {entryArrows('education', eduIndex, resumeData.education.length)}
                    {!readOnly && (confirmingDelete === `education-${eduIndex}` ? (
                      <div className="flex items-center gap-1 text-xs opacity-0 group-hover/entry:opacity-100">
                        <span className="text-gray-600">Delete?</span>
                        <button onClick={() => {
                          const newData = JSON.parse(JSON.stringify(resumeData))
                          newData.education.splice(eduIndex, 1)
                          onUpdate(newData)
                          setConfirmingDelete(null)
                        }} className="text-white bg-[#e57373] hover:bg-[#c62828] px-2 py-0.5 rounded">Yes</button>
                        <button onClick={() => setConfirmingDelete(null)} className="text-gray-600 hover:bg-gray-100 px-2 py-0.5 rounded">No</button>
                      </div>
                    ) : <button onClick={() => setConfirmingDelete(`education-${eduIndex}`)} className="text-[#e57373] hover:bg-red-50 px-1 rounded opacity-0 group-hover/entry:opacity-100" title="Delete education">🗑️</button>)}
                  </div>
                  {renderDegreeBody(edu, eduIndex)}
                </div>
              )
            }

            // Multi-degree group: shared school header (all-caps, non-bold) on top, degrees indented (degree text bold inside body).
            return (
              <div key={`edu-group-${groupIndex}`} className={`mb-3 p-2 rounded ${!readOnly && 'hover:bg-purple-50/50'}`}>
                <p
                  className={`text-sm uppercase mb-2 ${!readOnly && 'cursor-text'}`}
                  style={{ ...(ts.company || {}), ...(group.school ? {} : { color: '#9ca3af', fontStyle: 'italic' }), minWidth: '100px' }}
                  contentEditable={!readOnly}
                  suppressContentEditableWarning
                  onFocus={(e) => { if (!group.school) e.currentTarget.textContent = '' }}
                  onBlur={(e) => {
                    if (isUndoingRef.current) return
                    const newName = e.currentTarget.textContent.trim()
                    if (!newName) e.currentTarget.textContent = 'School Name'
                    const newData = JSON.parse(JSON.stringify(resumeData))
                    group.degrees.forEach(d => {
                      newData.education[d._originalIndex].school = newName
                    })
                    onUpdate(newData)
                  }}
                >{group.school || 'School Name'}</p>
                <div className="pl-4 border-l-2 border-purple-100">
                  {group.degrees.map((edu) => {
                    const eduIndex = edu._originalIndex
                    return (
                      <div key={`edu-${eduIndex}`} className={`mb-2 p-2 rounded group/entry ${!readOnly && 'hover:bg-purple-50'}`}>
                        <div className="flex items-center justify-end mb-1">
                          {!readOnly && (confirmingDelete === `education-${eduIndex}` ? (
                            <div className="flex items-center gap-1 text-xs opacity-0 group-hover/entry:opacity-100">
                              <span className="text-gray-600">Delete?</span>
                              <button onClick={() => {
                                const newData = JSON.parse(JSON.stringify(resumeData))
                                newData.education.splice(eduIndex, 1)
                                onUpdate(newData)
                                setConfirmingDelete(null)
                              }} className="text-white bg-[#e57373] hover:bg-[#c62828] px-2 py-0.5 rounded">Yes</button>
                              <button onClick={() => setConfirmingDelete(null)} className="text-gray-600 hover:bg-gray-100 px-2 py-0.5 rounded">No</button>
                            </div>
                          ) : <button onClick={() => setConfirmingDelete(`education-${eduIndex}`)} className="text-[#e57373] hover:bg-red-50 px-1 rounded opacity-0 group-hover/entry:opacity-100 text-xs" title="Delete degree">🗑️</button>)}
                        </div>
                        {renderDegreeBody(edu, eduIndex)}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
          {!readOnly && <button onClick={addEducation} className="text-purple-600 text-xs opacity-0 group-hover:opacity-100">+ Add Education</button>}
        </div>
      )
    })() : null,

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
                  {!readOnly && (
                    <div className="flex items-center gap-1 opacity-0 group-hover/category:opacity-100">
                      <button onClick={() => moveSkillCategoryUp(category)} disabled={Object.keys(resumeData.skillsCategories)[0] === category} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-20 disabled:cursor-not-allowed text-xs">▲</button>
                      <button onClick={() => moveSkillCategoryDown(category)} disabled={Object.keys(resumeData.skillsCategories)[Object.keys(resumeData.skillsCategories).length - 1] === category} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-20 disabled:cursor-not-allowed text-xs">▼</button>
                    </div>
                  )}
                  {!readOnly && (confirmingDelete === `category-${category}` ? (
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-gray-600">Delete?</span>
                      <button onClick={() => { deleteSkillCategory(category); setConfirmingDelete(null) }} className="text-white bg-[#e57373] hover:bg-[#c62828] px-2 py-0.5 rounded">Yes</button>
                      <button onClick={() => setConfirmingDelete(null)} className="text-gray-600 hover:bg-gray-100 px-2 py-0.5 rounded">No</button>
                    </div>
                  ) : <button onClick={() => setConfirmingDelete(`category-${category}`)} className="text-[#e57373] opacity-0 group-hover/category:opacity-100 text-xs px-1 hover:bg-red-50 rounded">🗑️</button>)}
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
            <div className="mb-1">
              <h3 className={`font-semibold flex-1 ${!readOnly && 'cursor-text'}`} style={{ ...(ts.jobTitle || {}), ...(project.name ? {} : { color: '#9ca3af', fontStyle: 'italic' }), minWidth: '80px' }} contentEditable={!readOnly} suppressContentEditableWarning onFocus={(e) => { if (!project.name) e.currentTarget.textContent = '' }} onBlur={(e) => { const val = e.currentTarget.textContent.trim(); if (!val) e.currentTarget.textContent = 'Project Name'; updateNestedField(`projects[${projectIndex}].name`, val) }}>{project.name || 'Project Name'}</h3>
            </div>
            <div data-bullet-group={`proj-${projectIndex}`} className="relative flex items-start gap-1 mb-1 group/projectdesc" onClick={() => { if (window.innerWidth < 768) setFocusedBullet(`proj-${projectIndex}`) }}>
              <p className={`text-sm flex-1 ${!readOnly && !bulletSelectMode && 'cursor-text'}`} style={{ ...(ts.body || {}), ...(project.description ? { color: '#374151' } : { color: '#9ca3af', fontStyle: 'italic' }) }} contentEditable={!readOnly && !bulletSelectMode} suppressContentEditableWarning onFocus={(e) => { if (!project.description) e.currentTarget.textContent = '' }} onBlur={(e) => { const val = e.currentTarget.textContent.trim(); if (!val) e.currentTarget.textContent = 'Project description'; updateNestedField(`projects[${projectIndex}].description`, val) }}>{project.description || 'Project description'}</p>
              {!readOnly && (
                <div className={`absolute right-0 top-0 flex items-center gap-1 bg-white px-1.5 py-0.5 rounded shadow-md border border-purple-200 ${focusedBullet === `proj-${projectIndex}` ? 'opacity-100 md:opacity-0' : 'opacity-0 group-hover/projectdesc:opacity-100'}`}>
                  <button onClick={(e) => { e.stopPropagation(); moveEntryUp('projects', projectIndex) }} disabled={projectIndex === 0} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-20 disabled:cursor-not-allowed text-xs" title="Move up">▲</button>
                  <button onClick={(e) => { e.stopPropagation(); moveEntryDown('projects', projectIndex) }} disabled={projectIndex === resumeData.projects.length - 1} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-20 disabled:cursor-not-allowed text-xs" title="Move down">▼</button>
                  {confirmingDelete === `projects-${projectIndex}` ? (
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-gray-600">Delete?</span>
                      <button onClick={(e) => { e.stopPropagation(); deleteProject(projectIndex); setConfirmingDelete(null) }} className="text-white bg-[#e57373] hover:bg-[#c62828] px-2 py-0.5 rounded">Yes</button>
                      <button onClick={(e) => { e.stopPropagation(); setConfirmingDelete(null) }} className="text-gray-600 hover:bg-gray-100 px-2 py-0.5 rounded">No</button>
                    </div>
                  ) : (
                    <button onClick={(e) => { e.stopPropagation(); setConfirmingDelete(`projects-${projectIndex}`) }} className="text-[#e57373] hover:bg-red-50 px-1 rounded" title="Delete project">🗑️</button>
                  )}
                  {onBulletAction && (
                    <button onClick={(e) => { e.stopPropagation(); onBulletAction(project.description, { type: 'projectDescription', projectIndex }) }} className="text-purple-400 hover:text-purple-600 hover:bg-purple-50 px-1 rounded hidden md:block" title="Click to reword or fix this">⚡</button>
                  )}
                </div>
              )}
              {bulletSelectMode && (
                <button onClick={() => onBulletAction(project.description, { type: 'projectDescription', projectIndex })} className="absolute inset-0 z-10 cursor-pointer rounded hover:bg-purple-50 hover:ring-1 hover:ring-purple-300" />
              )}
            </div>
            {(project.link || !readOnly) && <p className={`text-sm break-all ${!readOnly && 'cursor-text'}`} style={{ ...(ts.body || {}), ...(project.link ? { color: '#7c3aed' } : { color: '#9ca3af', fontStyle: 'italic' }) }} contentEditable={!readOnly} suppressContentEditableWarning onFocus={(e) => { if (!project.link) e.currentTarget.textContent = '' }} onBlur={(e) => { const val = e.currentTarget.textContent.trim(); if (!val) e.currentTarget.textContent = 'https://link (optional)'; updateNestedField(`projects[${projectIndex}].link`, val) }}>{project.link || 'https://link (optional)'}</p>}
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
                  <h3 className={`font-semibold flex-1 ${!readOnly && 'cursor-text'}`} style={{ ...(ts.jobTitle || {}), ...(cert.name ? {} : { color: '#9ca3af', fontStyle: 'italic' }), minWidth: '80px' }} contentEditable={!readOnly} suppressContentEditableWarning onFocus={(e) => { if (!cert.name) e.currentTarget.textContent = '' }} onBlur={(e) => { const val = e.currentTarget.textContent.trim(); if (!val) e.currentTarget.textContent = 'Certification Name'; updateNestedField(`certifications[${certIndex}].name`, val) }}>{cert.name || 'Certification Name'}</h3>
                  {entryArrows('certifications', certIndex, resumeData.certifications.length)}
                </div>
                <p className={`text-sm ${!readOnly && 'cursor-text'}`} style={{ ...(ts.body || {}), ...(cert.details ? {} : { color: '#9ca3af', fontStyle: 'italic' }) }} contentEditable={!readOnly} suppressContentEditableWarning onFocus={(e) => { if (!cert.details) e.currentTarget.textContent = '' }} onBlur={(e) => { const val = e.currentTarget.textContent.trim(); if (!val) e.currentTarget.textContent = 'Issuing organization | Date'; updateNestedField(`certifications[${certIndex}].details`, val) }}>{cert.details || 'Issuing organization | Date'}</p>
              </div>
              {!readOnly && (confirmingDelete === `certifications-${certIndex}` ? (
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-gray-600">Delete?</span>
                  <button onClick={() => { deleteCertification(certIndex); setConfirmingDelete(null) }} className="text-white bg-[#e57373] hover:bg-[#c62828] px-2 py-0.5 rounded">Yes</button>
                  <button onClick={() => setConfirmingDelete(null)} className="text-gray-600 hover:bg-gray-100 px-2 py-0.5 rounded">No</button>
                </div>
              ) : <button onClick={() => setConfirmingDelete(`certifications-${certIndex}`)} className="text-[#e57373] hover:bg-red-50 px-1 rounded opacity-0 group-hover/entry:opacity-100" title="Delete certification">🗑️</button>)}
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
            <div className="mb-1">
              <h3 className={`font-semibold flex-1 ${!readOnly && 'cursor-text'}`} style={{ ...(ts.jobTitle || {}), ...(vol.organization ? {} : { color: '#9ca3af', fontStyle: 'italic' }), minWidth: '80px' }} contentEditable={!readOnly} suppressContentEditableWarning onFocus={(e) => { if (!vol.organization) e.currentTarget.textContent = '' }} onBlur={(e) => { const val = e.currentTarget.textContent.trim(); if (!val) e.currentTarget.textContent = 'Organization Name'; updateNestedField(`volunteer[${volIndex}].organization`, val) }}>{vol.organization || 'Organization Name'}</h3>
            </div>
            <div data-bullet-group={`vol-${volIndex}`} className="relative flex items-start gap-1 group/voldesc" onClick={() => { if (window.innerWidth < 768) setFocusedBullet(`vol-${volIndex}`) }}>
              <p className={`text-sm flex-1 ${!readOnly && !bulletSelectMode && 'cursor-text'}`} style={{ ...(ts.body || {}), ...(vol.description ? { color: '#374151' } : { color: '#9ca3af', fontStyle: 'italic' }) }} contentEditable={!readOnly && !bulletSelectMode} suppressContentEditableWarning onFocus={(e) => { if (!vol.description) e.currentTarget.textContent = '' }} onBlur={(e) => { const val = e.currentTarget.textContent.trim(); if (!val) e.currentTarget.textContent = 'Role and responsibilities'; updateNestedField(`volunteer[${volIndex}].description`, val) }}>{vol.description || 'Role and responsibilities'}</p>
              {!readOnly && (
                <div className={`absolute right-0 top-0 flex items-center gap-1 bg-white px-1.5 py-0.5 rounded shadow-md border border-purple-200 ${focusedBullet === `vol-${volIndex}` ? 'opacity-100 md:opacity-0' : 'opacity-0 group-hover/voldesc:opacity-100'}`}>
                  <button onClick={(e) => { e.stopPropagation(); moveEntryUp('volunteer', volIndex) }} disabled={volIndex === 0} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-20 disabled:cursor-not-allowed text-xs" title="Move up">▲</button>
                  <button onClick={(e) => { e.stopPropagation(); moveEntryDown('volunteer', volIndex) }} disabled={volIndex === resumeData.volunteer.length - 1} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-20 disabled:cursor-not-allowed text-xs" title="Move down">▼</button>
                  {confirmingDelete === `volunteer-${volIndex}` ? (
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-gray-600">Delete?</span>
                      <button onClick={(e) => { e.stopPropagation(); deleteVolunteer(volIndex); setConfirmingDelete(null) }} className="text-white bg-[#e57373] hover:bg-[#c62828] px-2 py-0.5 rounded">Yes</button>
                      <button onClick={(e) => { e.stopPropagation(); setConfirmingDelete(null) }} className="text-gray-600 hover:bg-gray-100 px-2 py-0.5 rounded">No</button>
                    </div>
                  ) : (
                    <button onClick={(e) => { e.stopPropagation(); setConfirmingDelete(`volunteer-${volIndex}`) }} className="text-[#e57373] hover:bg-red-50 px-1 rounded" title="Delete volunteer">🗑️</button>
                  )}
                  {onBulletAction && (
                    <button onClick={(e) => { e.stopPropagation(); onBulletAction(vol.description, { type: 'volunteerDescription', volIndex }) }} className="text-purple-400 hover:text-purple-600 hover:bg-purple-50 px-1 rounded hidden md:block" title="Click to reword or fix this">⚡</button>
                  )}
                </div>
              )}
              {bulletSelectMode && (
                <button onClick={() => onBulletAction(vol.description, { type: 'volunteerDescription', volIndex })} className="absolute inset-0 z-10 cursor-pointer rounded hover:bg-purple-50 hover:ring-1 hover:ring-purple-300" />
              )}
            </div>
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
              <span className={`font-semibold ${!readOnly && 'cursor-text'}`} style={{ color: lang.language ? 'inherit' : '#9ca3af', fontStyle: lang.language ? 'normal' : 'italic', minWidth: '60px', display: 'inline-block' }} contentEditable={!readOnly} suppressContentEditableWarning onFocus={(e) => { if (!lang.language) e.currentTarget.textContent = '' }} onBlur={(e) => { const val = e.currentTarget.textContent.trim(); if (!val) e.currentTarget.textContent = 'Language'; updateNestedField(`languages[${langIndex}].language`, val) }}>{lang.language || 'Language'}</span>
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
                <button onClick={() => { deleteLanguage(langIndex); setConfirmingDelete(null) }} className="text-white bg-[#e57373] hover:bg-[#c62828] px-2 py-0.5 rounded">Yes</button>
                <button onClick={() => setConfirmingDelete(null)} className="text-gray-600 hover:bg-gray-100 px-2 py-0.5 rounded">No</button>
              </div>
            ) : <button onClick={() => setConfirmingDelete(`languages-${langIndex}`)} className="text-[#e57373] hover:bg-red-50 px-1 rounded opacity-0 group-hover/entry:opacity-100" title="Delete language">🗑️</button>)}
          </div>
        ))}
        {!readOnly && <button onClick={addLanguage} className="text-purple-600 text-xs opacity-0 group-hover:opacity-100">+ Add Language</button>}
      </div>
    ) : null,

    additionalInfo: resumeData.additionalInfo?.length > 0 ? (
      <div className="mb-6 group" key="additionalInfo">
        {sectionHeader('additionalInfo')}
        {resumeData.additionalInfo.map((item, itemIndex) => (
         <div key={itemIndex} data-bullet-group={`info-${itemIndex}`} className={`relative py-0.5 px-1 rounded group/entry ${!readOnly && 'hover:bg-purple-50'}`} onClick={() => { if (window.innerWidth < 768) setFocusedBullet(`info-${itemIndex}`) }}>
            <div className={`flex-1 ${item.detail && item.detail.length > 80 ? '' : 'flex items-center gap-2'}`}>
              <div className="flex items-center gap-2">
                <span
                  className={`font-semibold text-sm ${!readOnly && 'cursor-text'}`}
                  style={{ ...(ts.jobTitle || {}), ...(item.label ? {} : { color: '#9ca3af', fontStyle: 'italic' }), minWidth: '60px', display: 'inline-block' }}
                  contentEditable={!readOnly}
                  suppressContentEditableWarning
                  onFocus={(e) => { if (!item.label) e.currentTarget.textContent = '' }}
                  onBlur={(e) => { const val = e.currentTarget.textContent.trim(); if (!val) e.currentTarget.textContent = 'Item Name'; updateNestedField(`additionalInfo[${itemIndex}].label`, val) }}
                >{item.label || 'Item Name'}</span>
                {(item.detail || !readOnly) && item.detail && item.detail.length <= 80 && <span className="text-gray-400 text-sm shrink-0">|</span>}
                {item.detail && item.detail.length <= 80 && (
                  <span className="relative group/additionaldetail flex-1">
                    <span
                      className={`text-sm ${!readOnly && !bulletSelectMode && 'cursor-text'}`}
                      style={{ ...(ts.body || {}), ...(item.detail ? { color: '#4b5563' } : { color: '#9ca3af', fontStyle: 'italic' }) }}
                      contentEditable={!readOnly && !bulletSelectMode}
                      suppressContentEditableWarning
                      onFocus={(e) => { if (!item.detail) e.currentTarget.textContent = '' }}
                      onBlur={(e) => { const val = e.currentTarget.textContent.trim(); if (!val) e.currentTarget.textContent = 'Additional detail'; updateNestedField(`additionalInfo[${itemIndex}].detail`, val) }}
                    >{item.detail || 'Additional detail'}</span>
                    {bulletSelectMode && (
                      <button
                        onClick={() => onBulletAction(item.detail, { type: 'additionalDetail', itemIndex })}
                        className="absolute inset-0 z-10 cursor-pointer rounded hover:bg-purple-50 hover:ring-1 hover:ring-purple-300"
                      />
                    )}
                  </span>
                )}
              </div>
              {item.detail && item.detail.length > 80 && (
                <div data-bullet-group={`info-${itemIndex}`} className="mt-1 relative group/additionaldetail" onClick={() => { if (window.innerWidth < 768) setFocusedBullet(`info-${itemIndex}`) }}>
                  <span
                    className={`text-sm block ${!readOnly && !bulletSelectMode && 'cursor-text'}`}
                    style={{ ...(ts.body || {}), ...(item.detail ? { color: '#4b5563' } : { color: '#9ca3af', fontStyle: 'italic' }) }}
                    contentEditable={!readOnly && !bulletSelectMode}
                    suppressContentEditableWarning
                    onFocus={(e) => { if (!item.detail) e.currentTarget.textContent = '' }}
                    onBlur={(e) => { const val = e.currentTarget.textContent.trim(); if (!val) e.currentTarget.textContent = 'Additional detail'; updateNestedField(`additionalInfo[${itemIndex}].detail`, val) }}
                  >{item.detail || 'Additional detail'}</span>
                  {!readOnly && (
                    <div className={`absolute right-0 top-0 flex items-center gap-1 bg-white px-1.5 py-0.5 rounded shadow-md border border-purple-200 ${focusedBullet === `info-${itemIndex}` ? 'opacity-100 md:opacity-0' : 'opacity-0 group-hover/additionaldetail:opacity-100'}`}>
                      <button onClick={(e) => { e.stopPropagation(); moveEntryUp('additionalInfo', itemIndex) }} disabled={itemIndex === 0} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-20 disabled:cursor-not-allowed text-xs" title="Move up">▲</button>
                      <button onClick={(e) => { e.stopPropagation(); moveEntryDown('additionalInfo', itemIndex) }} disabled={itemIndex === resumeData.additionalInfo.length - 1} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-20 disabled:cursor-not-allowed text-xs" title="Move down">▼</button>
                      {confirmingDelete === `additionalInfo-${itemIndex}` ? (
                        <div className="flex items-center gap-1 text-xs">
                          <span className="text-gray-600">Delete?</span>
                          <button onClick={(e) => { e.stopPropagation(); const newData = JSON.parse(JSON.stringify(resumeData)); newData.additionalInfo.splice(itemIndex, 1); onUpdate(newData); setConfirmingDelete(null) }} className="text-white bg-[#e57373] hover:bg-[#c62828] px-2 py-0.5 rounded">Yes</button>
                          <button onClick={(e) => { e.stopPropagation(); setConfirmingDelete(null) }} className="text-gray-600 hover:bg-gray-100 px-2 py-0.5 rounded">No</button>
                        </div>
                      ) : (
                        <button onClick={(e) => { e.stopPropagation(); setConfirmingDelete(`additionalInfo-${itemIndex}`) }} className="text-[#e57373] hover:bg-red-50 px-1 rounded" title="Delete item">🗑️</button>
                      )}
                      {onBulletAction && (
                        <button onClick={(e) => { e.stopPropagation(); onBulletAction(item.detail, { type: 'additionalDetail', itemIndex }) }} className="text-purple-400 hover:text-purple-600 hover:bg-purple-50 px-1 rounded hidden md:block" title="Click to reword or fix this">⚡</button>
                      )}
                    </div>
                  )}
                  {bulletSelectMode && (
                    <button
                      onClick={() => onBulletAction(item.detail, { type: 'additionalDetail', itemIndex })}
                      className="absolute inset-0 z-10 cursor-pointer rounded hover:bg-purple-50 hover:ring-1 hover:ring-purple-300"
                    />
                  )}
                </div>
              )}
            </div>
            {!readOnly && (!item.detail || item.detail.length <= 80) && (
              <span className={`absolute right-0 top-0 flex items-center gap-1 bg-white px-1.5 py-0.5 rounded shadow-md border border-purple-200 ${focusedBullet === `info-${itemIndex}` ? 'opacity-100 md:opacity-0' : 'opacity-0 group-hover/entry:opacity-100'}`}>
                <button onClick={(e) => { e.stopPropagation(); moveEntryUp('additionalInfo', itemIndex) }} disabled={itemIndex === 0} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-20 disabled:cursor-not-allowed text-xs" title="Move up">▲</button>
                <button onClick={(e) => { e.stopPropagation(); moveEntryDown('additionalInfo', itemIndex) }} disabled={itemIndex === resumeData.additionalInfo.length - 1} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 px-1 rounded disabled:opacity-20 disabled:cursor-not-allowed text-xs" title="Move down">▼</button>
                {confirmingDelete === `additionalInfo-${itemIndex}` ? (
                  <span className="flex items-center gap-1 text-xs">
                    <span className="text-gray-600">Delete?</span>
                    <button onClick={(e) => { e.stopPropagation(); const newData = JSON.parse(JSON.stringify(resumeData)); newData.additionalInfo.splice(itemIndex, 1); onUpdate(newData); setConfirmingDelete(null) }} className="text-white bg-[#e57373] hover:bg-[#c62828] px-2 py-0.5 rounded">Yes</button>
                    <button onClick={(e) => { e.stopPropagation(); setConfirmingDelete(null) }} className="text-gray-600 hover:bg-gray-100 px-2 py-0.5 rounded">No</button>
                  </span>
                ) : (
                  <button onClick={(e) => { e.stopPropagation(); setConfirmingDelete(`additionalInfo-${itemIndex}`) }} className="text-[#e57373] hover:bg-red-50 px-1 rounded" title="Delete item">🗑️</button>
                )}
                {onBulletAction && (
                  <button onClick={(e) => { e.stopPropagation(); onBulletAction(item.detail, { type: 'additionalDetail', itemIndex }) }} className="text-purple-400 hover:text-purple-600 hover:bg-purple-50 px-1 rounded hidden md:block" title="Click to reword or fix this">⚡</button>
                )}
              </span>
            )}
          </div>
        ))}
        {!readOnly && (
          <button
            onClick={() => {
              const newData = JSON.parse(JSON.stringify(resumeData))
              if (!newData.additionalInfo) newData.additionalInfo = []
              newData.additionalInfo.push({ label: '', detail: '' })
              onUpdate(newData)
            }}
            className="text-purple-600 text-xs opacity-0 group-hover:opacity-100"
          >+ Add Item</button>
        )}
      </div>
    ) : null,

    references: resumeData.references?.length > 0 ? (
      <div className="mb-6 group" key="references">
        {sectionHeader('references')}
        {resumeData.references.map((ref, refIndex) => (
          <div key={refIndex} className={`mb-3 p-2 rounded group/entry ${!readOnly && 'hover:bg-purple-50'}`}>
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex items-center gap-1 flex-1">
                <h3 className={`font-bold flex-1 ${!readOnly && 'cursor-text'}`} style={{ ...(ts.jobTitle || {}), ...(ref.name ? {} : { color: '#9ca3af', fontStyle: 'italic' }), minWidth: '80px' }} contentEditable={!readOnly} suppressContentEditableWarning onFocus={(e) => { if (!ref.name) e.currentTarget.textContent = '' }} onBlur={(e) => { const val = e.currentTarget.textContent.trim(); if (!val) e.currentTarget.textContent = 'Reference Name'; updateNestedField(`references[${refIndex}].name`, val) }}>{ref.name || 'Reference Name'}</h3>
                {entryArrows('references', refIndex, resumeData.references.length)}
              </div>
              {!readOnly && (confirmingDelete === `references-${refIndex}` ? (
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-gray-600">Delete?</span>
                  <button onClick={() => { deleteReference(refIndex); setConfirmingDelete(null) }} className="text-white bg-[#e57373] hover:bg-[#c62828] px-2 py-0.5 rounded">Yes</button>
                  <button onClick={() => setConfirmingDelete(null)} className="text-gray-600 hover:bg-gray-100 px-2 py-0.5 rounded">No</button>
                </div>
              ) : <button onClick={() => setConfirmingDelete(`references-${refIndex}`)} className="text-[#e57373] hover:bg-red-50 px-1 rounded opacity-0 group-hover/entry:opacity-100" title="Delete reference">🗑️</button>)}
            </div>
            <p className={`text-sm text-gray-700 ${!readOnly && 'cursor-text'}`} style={ts.body || {}}>
              <span style={{ color: ref.title ? 'inherit' : '#9ca3af', fontStyle: ref.title ? 'normal' : 'italic', minWidth: '60px', display: 'inline-block' }} contentEditable={!readOnly} suppressContentEditableWarning onFocus={(e) => { if (!ref.title) e.currentTarget.textContent = '' }} onBlur={(e) => { const val = e.currentTarget.textContent.trim(); if (!val) e.currentTarget.textContent = 'Job Title'; updateNestedField(`references[${refIndex}].title`, val) }}>{ref.title || 'Job Title'}</span>
              {' at '}
              <span style={{ color: ref.company ? 'inherit' : '#9ca3af', fontStyle: ref.company ? 'normal' : 'italic', minWidth: '60px', display: 'inline-block' }} contentEditable={!readOnly} suppressContentEditableWarning onFocus={(e) => { if (!ref.company) e.currentTarget.textContent = '' }} onBlur={(e) => { const val = e.currentTarget.textContent.trim(); if (!val) e.currentTarget.textContent = 'Company'; updateNestedField(`references[${refIndex}].company`, val) }}>{ref.company || 'Company'}</span>
              {' · '}
              <span style={{ color: ref.phone ? 'inherit' : '#9ca3af', fontStyle: ref.phone ? 'normal' : 'italic', minWidth: '80px', display: 'inline-block' }} contentEditable={!readOnly} suppressContentEditableWarning onFocus={(e) => { if (!ref.phone) e.currentTarget.textContent = '' }} onBlur={(e) => { const val = e.currentTarget.textContent.trim(); if (!val) e.currentTarget.textContent = '(555) 555-5555'; updateNestedField(`references[${refIndex}].phone`, val) }}>{ref.phone || '(555) 555-5555'}</span>
              {' | '}
              <span style={{ color: ref.email ? 'inherit' : '#9ca3af', fontStyle: ref.email ? 'normal' : 'italic', minWidth: '100px', display: 'inline-block' }} contentEditable={!readOnly} suppressContentEditableWarning onFocus={(e) => { if (!ref.email) e.currentTarget.textContent = '' }} onBlur={(e) => { const val = e.currentTarget.textContent.trim(); if (!val) e.currentTarget.textContent = 'email@example.com'; updateNestedField(`references[${refIndex}].email`, val) }}>{ref.email || 'email@example.com'}</span>
              {' · '}
              <span className="italic" style={{ color: ref.relationship ? '#6b7280' : '#9ca3af', minWidth: '80px', display: 'inline-block' }} contentEditable={!readOnly} suppressContentEditableWarning onFocus={(e) => { if (!ref.relationship) e.currentTarget.textContent = '' }} onBlur={(e) => { const val = e.currentTarget.textContent.trim(); if (!val) e.currentTarget.textContent = 'Professional colleague'; updateNestedField(`references[${refIndex}].relationship`, val) }}>{ref.relationship || 'Professional colleague'}</span>
            </p>
          </div>
        ))}
        {!readOnly && <button onClick={addReference} className="text-purple-600 text-xs opacity-0 group-hover:opacity-100">+ Add Reference</button>}
      </div>
    ) : null,
  }

  return (
    <div style={ts.page || {}}>
      {/* Header */}
      <div className="mb-6 rounded" style={ts.headerArea || {}}>
        {selectedTemplate === 'vibe' ? (
          <>
            <div style={{ flex: 1 }}>
              <h1
                className={`${!readOnly && 'cursor-text hover:bg-purple-100 px-1 -mx-1 rounded'}`}
                style={ts.name || {}}
                contentEditable={!readOnly}
                suppressContentEditableWarning
                onBlur={(e) => updateField('fullName', e.currentTarget.textContent)}
              >{resumeData.fullName || 'Your Name'}</h1>
              {showProfessionalTitle && (
                <p
                  className={`${!readOnly && 'cursor-text hover:bg-purple-50 px-1 rounded'}`}
                  style={ts.professionalTitle || { fontStyle: 'italic', color: '#666' }}
                  contentEditable={!readOnly}
                  suppressContentEditableWarning
                  onBlur={(e) => updateField('professionalTitle', e.currentTarget.textContent)}
                >{professionalTitleDisplay || (!readOnly ? 'Add a professional title' : '')}</p>
              )}
            </div>
            <div style={{ textAlign: 'right', fontSize: '10pt', color: '#555', lineHeight: '1.4' }}>
              {resumeData.email && resumeData.phone && resumeData.location
                ? <>
                    <div>{resumeData.email}</div>
                    <div>{resumeData.phone} | {resumeData.location}</div>
                    {resumeData.linkedin && <div>{resumeData.linkedin}</div>}
                    {resumeData.portfolio && <div>{resumeData.portfolio}</div>}
                  </>
                : [resumeData.email, resumeData.phone, resumeData.location, resumeData.linkedin, resumeData.portfolio]
                    .filter(Boolean).map((p, i) => <div key={i}>{p}</div>)
              }
            </div>
          </>
        ) : selectedTemplate === 'sharp' ? (
          <>
            <h1
              className={`font-bold ${!readOnly && 'cursor-text hover:bg-purple-100 px-1 -mx-1'}`}
              style={ts.name || {}}
              contentEditable={!readOnly}
              suppressContentEditableWarning
              onBlur={(e) => updateField('fullName', e.currentTarget.textContent)}
            >{resumeData.fullName || 'Your Name'}</h1>
            <div style={{ borderBottom: '1.5px solid #111', marginBottom: '8px' }} />
            <div style={ts.contactBand || {}}>
              <p
                className={`text-sm ${!readOnly && 'cursor-text hover:bg-purple-50 px-1 -mx-1 rounded'}`}
                style={ts.contact || {}}
                contentEditable={!readOnly}
                suppressContentEditableWarning
                onBlur={(e) => {
                  if (isUndoingRef.current) return
                  const parts = e.currentTarget.textContent.split('|').map(p => p.trim())
                  const newData = { ...resumeData, location: parts[0] || '', phone: parts[1] || '', email: parts[2] || '', linkedin: parts[3] || '' }
                  onUpdate(newData)
                }}
              >{[resumeData.location, resumeData.phone, resumeData.email, resumeData.linkedin, resumeData.portfolio].filter(Boolean).join(' | ') || 'Contact Info'}</p>
            </div>
          </>
        ) : (
          <>
            <h1
              className={`text-3xl font-bold text-center ${!readOnly && 'cursor-text hover:bg-purple-100 px-2 -mx-2 rounded'}`}
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
                className={`text-sm text-gray-600 mt-1 text-center ${!readOnly && 'cursor-text hover:bg-purple-50 px-1 -mx-1 rounded'}`}
                style={ts.contact || {}}
                contentEditable={!readOnly}
                suppressContentEditableWarning
                onBlur={(e) => {
                  if (isUndoingRef.current) return
                  const parts = e.currentTarget.textContent.split('|').map(p => p.trim())
                  const newData = { ...resumeData, location: parts[0] || '', phone: parts[1] || '', email: parts[2] || '', linkedin: parts[3] || '' }
                  onUpdate(newData)
                }}
              >{[resumeData.location, resumeData.phone, resumeData.email, resumeData.linkedin, resumeData.portfolio].filter(Boolean).join(' | ') || 'Contact Info'}</p>
            </div>
          </>
        )}
      </div>

      {/* Summary */}
      {resumeData.summary && !resumeData.hideSummary && (
        <div style={selectedTemplate === 'edge' ? { paddingLeft: '18px', paddingRight: '18px' } : {}} className={`${selectedTemplate === 'current' ? 'mb-0' : selectedTemplate === 'vibe' ? 'mb-0' : selectedTemplate === 'edge' ? 'mb-6' : 'mb-6 p-2'} rounded group ${!readOnly && 'hover:bg-purple-50'}`}>
          {ts.vibeSectionDivider ? (
            <div style={{ ...ts.vibeSectionDivider, marginTop: '0' }}>
              <div style={ts.vibeSectionLine} />
              <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <h2 style={{ ...ts.sectionHeader, marginTop: '0', marginBottom: '0' }}>
                  <span className={!readOnly ? 'cursor-pointer hover:text-purple-600' : ''} onClick={() => !readOnly && setEditingSection('summary')}>
                    {resumeData.sectionTitles?.summary || (selectedTemplate === 'signature' ? 'PROFESSIONAL SUMMARY' : 'SUMMARY')}
                  </span>
                </h2>
                {!readOnly && (
                  <button onClick={toggleSummary} className="absolute right-0 text-gray-400 hover:text-gray-600 text-xs opacity-0 group-hover:opacity-100 font-normal" title="Hide this section">Hide</button>
                )}
              </div>
              <div style={ts.vibeSectionLine} />
            </div>
          ) : (
          <h2 className={`text-lg font-semibold flex items-center gap-1 ${selectedTemplate === 'edge' || selectedTemplate === 'signature' ? 'mb-2 justify-center' : 'border-b border-gray-300 pb-1 mb-2'}`} style={ts.sectionHeader || {}}>
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
                {resumeData.sectionTitles?.summary || (selectedTemplate === 'signature' ? 'PROFESSIONAL SUMMARY' : 'SUMMARY')}
              </span>
            )}
            {!readOnly && (
              <button onClick={toggleSummary} className="text-gray-400 hover:text-gray-600 text-xs ml-2 opacity-0 group-hover:opacity-100 font-normal" title="Hide this section">Hide</button>
            )}
          </h2>
          )}
          <div className="relative group/summary">
            <p
              className={`text-sm ${!readOnly && !bulletSelectMode && 'cursor-text hover:bg-purple-50 p-1 rounded'}`}
              style={ts.body || {}}
              contentEditable={!readOnly && !bulletSelectMode}
              suppressContentEditableWarning
              onBlur={(e) => updateField('summary', e.currentTarget.textContent)}
            >{resumeData.summary}</p>
            {onBulletAction && !bulletSelectMode && (
              <button
                onClick={() => onBulletAction(resumeData.summary, { type: 'summary' })}
                className="absolute right-0 top-0 text-purple-400 hover:text-purple-600 hover:bg-purple-50 px-1 rounded hidden md:block md:opacity-0 md:group-hover/summary:opacity-100"
                title="Click to reword or fix this"
              >⚡</button>
            )}
            {bulletSelectMode && (
              <button
                onClick={() => onBulletAction(resumeData.summary, { type: 'summary' })}
                className="absolute inset-0 z-10 cursor-pointer rounded hover:bg-purple-50 hover:ring-1 hover:ring-purple-300"
              />
            )}
          </div>
        </div>
      )}

      {!readOnly && resumeData.summary && resumeData.hideSummary && (
        <button onClick={toggleSummary} className="mb-4 text-purple-600 text-sm opacity-50 hover:opacity-100">
          👁️ Show Summary Section
        </button>
      )}

      {selectedTemplate === 'edge'
        ? <div style={{ paddingLeft: '10px', paddingRight: '10px' }}>{activeSectionOrder.map(sectionName => sections[sectionName] || null)}</div>
        : activeSectionOrder.map(sectionName => sections[sectionName] || null)
      }

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
          { key: 'references', label: 'References', check: () => !resumeData.references?.length },
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
                    if (s.key === 'projects') newData.projects = [{ name: '', description: '', link: '' }]
                    if (s.key === 'certifications') newData.certifications = [{ name: '', details: '' }]
                    if (s.key === 'volunteer') newData.volunteer = [{ organization: '', description: '' }]
                    if (s.key === 'languages') newData.languages = [{ language: '', proficiency: 'Professional' }]
                    if (s.key === 'additionalInfo') newData.additionalInfo = [{ label: '', detail: '' }]
                    if (s.key === 'references') newData.references = [{ name: '', title: '', company: '', phone: '', email: '', relationship: '' }]
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