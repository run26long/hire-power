'use client'
import { useState } from 'react'

const isText = v => typeof v === 'string' && v.trim().length > 0

const looksLikeJobEntry = v =>
  v && typeof v === 'object' && !Array.isArray(v) &&
  ('company' in v || 'title' in v || 'startDate' in v || 'bullets' in v)

// "1994" or "1994-06" to a padded YYYY-MM. A bare year takes the caller's default month
// so a start date lands at the top of the year and an end date at the bottom of it.
function normalizeMonth(value, fallbackMonth) {
  const m = String(value || '').match(/(\d{4})(?:[-/](\d{1,2}))?/)
  if (!m) return ''
  const month = m[2] ? String(Math.min(12, Math.max(1, Number(m[2])))).padStart(2, '0') : fallbackMonth
  return `${m[1]}-${month}`
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatAddedJobDates(job) {
  const label = value => {
    const m = String(value || '').match(/(\d{4})-(\d{2})/)
    return m ? `${MONTH_LABELS[Number(m[2]) - 1] || ''} ${m[1]}`.trim() : ''
  }
  const start = label(job?.startDate)
  const end = job?.current ? 'Present' : label(job?.endDate)
  return end ? `${start} to ${end}` : start
}

function startSortKey(job) {
  const m = String(job?.startDate || '').match(/(\d{4})(?:[-/](\d{1,2}))?/)
  if (!m) return null
  return Number(m[1]) * 12 + (m[2] ? Number(m[2]) - 1 : 0)
}

// Experience runs reverse-chronologically, so a new role belongs immediately before the
// first role that started earlier than it. A role with an unreadable date goes last
// rather than displacing dated entries, and undated existing entries are skipped over
// so they never decide the position.
function insertIndexByStartDate(experience, newJob) {
  const key = startSortKey(newJob)
  if (key === null) return experience.length
  for (let i = 0; i < experience.length; i++) {
    const existing = startSortKey(experience[i])
    if (existing !== null && existing < key) return i
  }
  return experience.length
}

// Company + title is the identity the rest of the app uses for a role, so it is the
// identity used to decide whether a job is already on the resume.
function normalizeRoleField(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function findDuplicateRole(experience, job) {
  const company = normalizeRoleField(job?.company)
  const title = normalizeRoleField(job?.title)
  if (!company || !title) return null
  return (Array.isArray(experience) ? experience : []).find(
    e => normalizeRoleField(e?.company) === company && normalizeRoleField(e?.title) === title
  ) || null
}

// The add endpoint answers with one of a fixed set of shapes. When the candidate
// describes something the schema has no case for, the model improvises, and an object
// where a string belongs both crashes the render and gets written to the database.
// Anything off-shape is downgraded here, at the single point every consumer flows through.
function normalizeAddResult(result) {
  if (!result || typeof result !== 'object') return { type: 'unsupported' }

  if (result.type === 'clarification' && isText(result.question)) return result

  // A new job is never created on the first pass — the candidate is asked first, and
  // their answer is what puts the role on the resume.
  if (result.type === 'confirmJob') {
    return {
      type: 'confirmJob',
      question: isText(result.question)
        ? result.question
        : 'Would you like me to add that as a new job in your experience section?',
      jobLabel: isText(result.jobLabel) ? result.jobLabel.trim() : ''
    }
  }

  if (result.type === 'unsupported') {
    return { type: 'unsupported', reason: isText(result.reason) ? result.reason : undefined }
  }

  if (result.type === 'experience') {
    // `job` is the documented field, but a model that reaches for `content` out of habit
    // is the exact improvisation that crashed this modal before — read either.
    const job = result.job || result.content
    if (!job || typeof job !== 'object' || Array.isArray(job)) return { type: 'unsupported' }
    if (!isText(job.title) || !isText(job.company)) return { type: 'unsupported', reason: 'newJob' }

    // Dates are required before the entry can be created. Asking beats writing a role
    // with a blank date range onto the resume and leaving the user to discover it.
    const startDate = normalizeMonth(job.startDate, '01')
    const isCurrent = job.current === true
    const endDate = isCurrent ? null : normalizeMonth(job.endDate, '12')
    if (!startDate || (!endDate && !isCurrent)) {
      return {
        type: 'clarification',
        question: `What were your start and end dates at ${job.company.trim()}? Years alone are fine, or tell me if you are still there.`
      }
    }

    return {
      ...result,
      job: {
        title: job.title.trim(),
        company: job.company.trim(),
        location: isText(job.location) ? job.location.trim() : '',
        startDate,
        endDate,
        current: isCurrent,
        summary: isText(job.summary) ? job.summary.trim() : '',
        bullets: Array.isArray(job.bullets) ? job.bullets.filter(isText).map(b => b.trim()) : []
      }
    }
  }

  if (result.type === 'skill') {
    const skills = Array.isArray(result.skills) ? result.skills.filter(isText) : []
    return skills.length ? { ...result, skills } : { type: 'unsupported' }
  }

  // Cover letter results carry `section` instead of `type`, but both route their text
  // through `content`, so one check covers every remaining shape.
  if (!isText(result.content)) {
    return { type: 'unsupported', reason: looksLikeJobEntry(result.content) ? 'newJob' : undefined }
  }

  return result
}

export default function CoachReviseModal({ state, onClose, resumeData, coachingMessages, careerContext, supabase, resumeId, setResume, onUpdate, onReviewChangeUpdate, onApplyChange, onApplyAdd, documentLabel = 'Resume', isCoverLetter = false }) {
  const [loading, setLoading] = useState(false)
  const [alternatives, setAlternatives] = useState([])
  const [revised, setRevised] = useState(null)
  const [addResult, setAddResult] = useState(null)
  const [addTurns, setAddTurns] = useState([])
  const [userInput, setUserInput] = useState('')
  const [error, setError] = useState(null)
  const [mode, setMode] = useState(state.mode === 'choose' ? null : state.mode) // null = choosing, 'reword', 'fix', 'add'
  const [editingAdd, setEditingAdd] = useState(false)
  const [editedAddText, setEditedAddText] = useState('')
  const [editingFix, setEditingFix] = useState(false)
  const [editedFixText, setEditedFixText] = useState('')
  const [selectedSentence, setSelectedSentence] = useState(null)
  const [fullText, setFullText] = useState(null)
  const [rewordSelected, setRewordSelected] = useState(null)
  const [editingReword, setEditingReword] = useState(false)
  const [editedRewordText, setEditedRewordText] = useState('')

  if (!state) return null

  const rawText = state.text || ''
  const location = state.location || {}

  // Split into sentences for summary types with multiple sentences.
  // Only treat a period as a sentence boundary when followed by whitespace then
  // an uppercase letter (or at end of text) — avoids splitting on emails,
  // phone numbers like 407.221.3381, URLs, etc.
  function splitSentences(text) {
    const result = []
    let current = ''
    for (let i = 0; i < text.length; i++) {
      current += text[i]
      const ch = text[i]
      if (ch === '!' || ch === '?') {
        result.push(current.trim())
        current = ''
      } else if (ch === '.') {
        const rest = text.slice(i + 1)
        const nextNonSpaceIdx = rest.search(/\S/)
        if (nextNonSpaceIdx === -1) {
          // Period at end of text (only trailing spaces remain)
          result.push(current.trim())
          current = ''
        } else if (nextNonSpaceIdx > 0 && /[A-Z]/.test(rest[nextNonSpaceIdx])) {
          // Period followed by at least one space then a capital letter = sentence end
          result.push(current.trim())
          current = ''
        }
        // Otherwise: period inside email, URL, phone number, abbreviation — not a boundary
      }
    }
    if (current.trim()) result.push(current.trim())
    return result.filter(s => s.length > 0)
  }

  const isSummaryType = location.type === 'summary' || location.type === 'jobSummary' || location.type === 'opening' || location.type === 'closing'
  const sentences = isSummaryType ? splitSentences(rawText) : [rawText]
  if (isSummaryType && sentences.length === 0) sentences.push(rawText)
  const hasMultipleSentences = sentences.length > 1
  const currentText = selectedSentence !== null ? sentences[selectedSentence] : rawText

  async function callApi(apiMode, input) {
    setLoading(true)
    setError(null)
    try {
      const token = (await supabase.auth.getSession())?.data?.session?.access_token
      const res = await fetch('/api/coach-revise', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          mode: apiMode,
          currentText: currentText,
          userInput: input || undefined,
          textType: location.type === 'summary' ? 'summary' : location.type === 'jobSummary' ? 'job summary' : location.type === 'opening' ? 'opening paragraph' : location.type === 'closing' ? 'closing paragraph' : 'bullet',
          resumeData: resumeData,
          coachingTranscript: coachingMessages || [],
          careerContext: careerContext || null,
          isCoverLetter: isCoverLetter || false
        })
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Something went wrong')
      }

      const data = await res.json()
      return data.result
    } catch (err) {
      console.error('Coach revise error:', err)
      setError(err.message || 'Something went wrong. Please try again.')
      return null
    } finally {
      setLoading(false)
    }
  }

  async function handleReword() {
    setMode('reword')
    const result = await callApi('reword')
    if (result?.alternatives) {
      setAlternatives(result.alternatives)
    }
  }

  async function handleFixSubmit() {
    if (!userInput.trim()) return
    const result = await callApi('fix', userInput)
    if (result?.revised) {
      setRevised(result.revised)
    }
  }

  async function submitAdd(turnText) {
    const text = String(turnText || '').trim()
    if (!text) return
    // Every turn is resent, not just the latest one. Answering a follow-up with "1994 to
    // 2000" is meaningless on its own, and the endpoint is stateless.
    const turns = [...addTurns, text]
    const description = turns.length === 1
      ? turns[0]
      : turns.map((t, i) => i === 0
          ? `What they want to add: ${t}`
          : `Their reply to your follow-up: ${t}`
        ).join('\n\n')

    const result = await callApi('add', description)
    if (result) {
      const normalized = normalizeAddResult(result)
      setAddTurns(turns)
      // Hard guard: the same job can never be added twice, whichever path put the first
      // copy there — an earlier coaching pass or an earlier trip through this modal.
      setAddResult(
        normalized.type === 'experience' && findDuplicateRole(resumeData?.experience, normalized.job)
          ? { type: 'duplicateJob', job: normalized.job }
          : normalized
      )
      setUserInput('')
    }
  }

  function handleAddSubmit() {
    return submitAdd(userInput)
  }

  function resetAddFlow() {
    setAddResult(null)
    setAddTurns([])
    setUserInput('')
  }

  function applyBulletChange(newText) {
    if (location.type === 'reviewChange' && onReviewChangeUpdate) {
      onReviewChangeUpdate(location.changeIndex, newText)
      onClose()
      return
    }
    if (onApplyChange) {
      onApplyChange(newText, location)
      onClose()
      return
    }
    const newData = JSON.parse(JSON.stringify(resumeData))
    if (location.type === 'bullet') {
      newData.experience[location.jobIndex].bullets[location.bulletIndex] = newText
    } else if (location.type === 'jobSummary') {
      if (selectedSentence !== null && hasMultipleSentences) {
        const updated = [...sentences]
        updated[selectedSentence] = newText.replace(/\.\s*$/, '') + '.'
        newData.experience[location.jobIndex].summary = updated.join(' ')
      } else {
        newData.experience[location.jobIndex].summary = newText
      }
    } else if (location.type === 'summary') {
      if (selectedSentence !== null && hasMultipleSentences) {
        const updated = [...sentences]
        updated[selectedSentence] = newText.replace(/\.\s*$/, '') + '.'
        newData.summary = updated.join(' ')
      } else {
        newData.summary = newText
      }
    }
    onUpdate(newData)
    saveToDb(newData)
    onClose()
  }

  function applyAddResult(result) {
    // Nothing off-shape reaches the resume data: a non-string bullet or summary would
    // crash every later render of this resume, and it would be saved that way.
    if (!result || result.type === 'unsupported') { onClose(); return }
    const newData = JSON.parse(JSON.stringify(resumeData))
    if (result.type === 'bullet') {
      const job = newData.experience?.[result.jobIndex]
      if (!job || !isText(result.content)) { onClose(); return }
      if (!job.bullets) job.bullets = []
      if (result.position === 'end') {
        job.bullets.push(result.content)
      } else {
        job.bullets.splice(result.position, 0, result.content)
      }
    } else if (result.type === 'experience') {
      if (!result.job) { onClose(); return }
      if (!Array.isArray(newData.experience)) newData.experience = []
      if (findDuplicateRole(newData.experience, result.job)) { onClose(); return }
      newData.experience.splice(insertIndexByStartDate(newData.experience, result.job), 0, result.job)
    } else if (result.type === 'summary') {
      if (!isText(result.content)) { onClose(); return }
      newData.summary = result.content
    } else if (result.type === 'skill') {
      if (!newData.skillsCategories) newData.skillsCategories = {}
      const cat = result.category || 'Skills'
      if (!newData.skillsCategories[cat]) newData.skillsCategories[cat] = []
      newData.skillsCategories[cat] = [...newData.skillsCategories[cat], ...result.skills]
    }
    onUpdate(newData)
    saveToDb(newData)
    onClose()
  }

  async function saveToDb(newData) {
    try {
      await supabase
        .from('resumes')
        .update({ resume_data: newData, updated_at: new Date().toISOString() })
        .eq('id', resumeId)
      setResume(prev => ({ ...prev, resume_data: newData }))
    } catch (err) {
      console.error('Error saving revise changes:', err)
    }
  }

  const textLabel = location.type === 'summary' ? 'Summary' : location.type === 'jobSummary' ? 'Job Summary' : location.type === 'opening' ? 'Opening Paragraph' : location.type === 'closing' ? 'Closing Paragraph' : 'Bullet'

  // ── ACTION CHOOSER ──
  if (state.mode === 'choose' && !mode) {
    // Sentence picker for summaries with multiple sentences
    if (hasMultipleSentences && selectedSentence === null) {
      return (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(15, 10, 30, 0.75)' }}
          onMouseDown={(e) => { e.currentTarget.dataset.downTarget = e.target === e.currentTarget ? 'backdrop' : 'inside'; }}
          onMouseUp={(e) => { if (e.target === e.currentTarget && e.currentTarget.dataset.downTarget === 'backdrop') { onClose(); } }}
        >
          <div
            className="bg-white shadow-2xl flex flex-col"
            style={{ borderRadius: '8px', border: '1px solid #e5e7eb', width: '364px' }}
            onMouseDown={e => e.stopPropagation()}
          >
            <div
              style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)', borderRadius: '8px 8px 0 0' }}
              className="px-5 py-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">⚡</span>
                <h2 className="text-base font-bold text-white">Sentence Selection</h2>
              </div>
              <button onClick={onClose} className="text-white hover:text-gray-200 text-2xl leading-none font-light">×</button>
            </div>

            <div className="p-5">
              <p className="text-xs text-gray-500 mb-3">Tap the sentence you want to change.</p>
              <div className="flex flex-col gap-2">
                {sentences.map((sentence, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedSentence(i)}
                    className="w-full text-left bg-white border border-gray-200 rounded-lg p-3 hover:bg-purple-50 hover:border-purple-300 transition-colors"
                  >
                    <p className="text-xs text-gray-800 leading-relaxed">{sentence}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center p-4"
        style={{ backgroundColor: 'rgba(15, 10, 30, 0.75)' }}
        onMouseDown={(e) => { e.currentTarget.dataset.downTarget = e.target === e.currentTarget ? 'backdrop' : 'inside'; }}
        onMouseUp={(e) => { if (e.target === e.currentTarget && e.currentTarget.dataset.downTarget === 'backdrop') { onClose(); } }}
      >
        <div
          className="bg-white shadow-2xl flex flex-col"
          style={{ borderRadius: '8px', border: '1px solid #e5e7eb', width: '364px' }}
          onMouseDown={e => e.stopPropagation()}
        >
          <div
            style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)', borderRadius: '8px 8px 0 0' }}
            className="px-5 py-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">⚡</span>
              <h2 className="text-base font-bold text-white">Reword or Fix a Sentence</h2>
            </div>
            <button onClick={onClose} className="text-white hover:text-gray-200 text-2xl leading-none font-light">×</button>
          </div>

          <div className="p-5">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">{textLabel}{selectedSentence !== null && ' · Sentence ' + (selectedSentence + 1)}</p>
              <p className="text-xs text-gray-700 leading-relaxed">{currentText.length > 200 ? currentText.substring(0, 200) + '...' : currentText}</p>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={handleReword}
                className="w-full text-left bg-white border border-purple-200 rounded-lg p-3 hover:bg-purple-50 hover:border-purple-300 transition-colors"
              >
                <p className="text-sm font-semibold text-gray-900">Reword this sentence</p>
                <p className="text-xs text-gray-500 mt-0.5">The information is correct, but the wording isn't quite right. See other options.</p>
              </button>
              <button
                onClick={() => setMode('fix')}
                className="w-full text-left bg-white border border-purple-200 rounded-lg p-3 hover:bg-purple-50 hover:border-purple-300 transition-colors"
              >
                <p className="text-sm font-semibold text-gray-900">Fix this sentence</p>
                <p className="text-xs text-gray-500 mt-0.5">There is some missing or incorrect information. Add some details, and Coach will rewrite it.</p>
              </button>
            </div>

            {selectedSentence !== null && (
              <button
                onClick={() => setSelectedSentence(null)}
                className="text-xs text-gray-500 hover:text-gray-700 mt-3 text-center w-full"
              >
                ← Pick a different sentence
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── REWORD MODAL ──
  if (mode === 'reword') {
    // Loading/error state in narrow modal
    if (loading || (error && alternatives.length === 0)) {
      return (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(15, 10, 30, 0.75)' }}
          onMouseDown={(e) => { e.currentTarget.dataset.downTarget = e.target === e.currentTarget ? 'backdrop' : 'inside'; }}
          onMouseUp={(e) => { if (e.target === e.currentTarget && e.currentTarget.dataset.downTarget === 'backdrop') { onClose(); } }}
        >
          <div
            className="bg-white shadow-2xl flex flex-col"
            style={{ borderRadius: '8px', border: '1px solid #e5e7eb', width: '364px' }}
            onMouseDown={e => e.stopPropagation()}
          >
            <div
              style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)', borderRadius: '8px 8px 0 0' }}
              className="px-5 py-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">⚡</span>
                <h2 className="text-base font-bold text-white">Reword this Sentence</h2>
              </div>
              <button onClick={onClose} className="text-white hover:text-gray-200 text-2xl leading-none font-light">×</button>
            </div>
            <div className="p-5">
              {loading && (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
                  <span className="ml-3 text-sm text-gray-500">Generating alternatives...</span>
                </div>
              )}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )
    }

    // Results in wide modal
    if (alternatives.length > 0) {
      const selectedAlt = rewordSelected !== null ? alternatives[rewordSelected] : null
      return (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-6"
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.85)' }}
          onMouseDown={(e) => { e.currentTarget.dataset.downTarget = e.target === e.currentTarget ? 'backdrop' : 'inside'; }}
          onMouseUp={(e) => { if (e.target === e.currentTarget && e.currentTarget.dataset.downTarget === 'backdrop') { onClose(); } }}
        >
          <div
            className="bg-white shadow-2xl w-full max-w-2xl border border-gray-200 flex flex-col h-[85vh] md:h-[480px]"
            style={{ borderRadius: '8px' }}
            onMouseDown={e => e.stopPropagation()}
          >
            <div
              style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)', borderRadius: '8px 8px 0 0' }}
              className="px-6 py-4 flex items-center justify-between flex-shrink-0"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 bg-white rounded flex items-center justify-center flex-shrink-0">
                  <span className="text-purple-600 font-bold text-lg">⚡</span>
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Reword this Sentence</h2>
                  <p className="text-purple-100 text-xs">{textLabel}{selectedSentence !== null && ` · Sentence ${selectedSentence + 1}`}</p>
                </div>
              </div>
              <button onClick={onClose} className="text-white hover:text-gray-200 text-4xl leading-none font-light w-8 h-8 flex items-center justify-center">×</button>
            </div>

            <div className="flex flex-col flex-1 p-4 min-h-0">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-2.5 mb-3 flex-shrink-0">
                <p className="text-[10px] font-bold text-purple-600 uppercase tracking-wide mb-1">Current</p>
                <p className="text-xs text-gray-700 leading-relaxed">{currentText}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3 flex-1 min-h-0 overflow-y-auto">
                {alternatives.map((alt, i) => (
                  <button
                    key={i}
                    onClick={() => setRewordSelected(i)}
                    className={`text-left rounded-lg p-2.5 overflow-y-auto transition-colors ${
                      rewordSelected === i
                        ? 'bg-green-50 border-2 border-green-400'
                        : 'bg-white border border-gray-200 hover:bg-purple-50 hover:border-purple-300'
                    }`}
                  >
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Option {i + 1}</p>
                    <p className="text-xs text-gray-800 leading-relaxed">{alt}</p>
                  </button>
                ))}
              </div>

              <div className="flex justify-end gap-2 flex-shrink-0">
                <button
                  onClick={onClose}
                  className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-[11px] md:text-xs font-medium hover:bg-gray-200 transition-colors"
                >
                  ✗ Keep Original
                </button>
                {selectedAlt && !editingReword ? (
                  <button
                    onClick={() => { setEditingReword(true); setEditedRewordText(selectedAlt) }}
                    className="px-3 py-2 bg-white text-purple-600 border border-purple-300 rounded-lg text-[11px] md:text-xs font-medium hover:bg-purple-50 transition-colors"
                  >
                    ✏️ Edit Change
                  </button>
                ) : editingReword ? (
                  <button
                    onClick={() => setEditingReword(false)}
                    className="px-4 py-2 bg-white text-gray-600 border border-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel Edit
                  </button>
                ) : null}
                <button
                  onClick={() => {
                    if (editingReword) {
                      applyBulletChange(editedRewordText)
                    } else if (selectedAlt) {
                      applyBulletChange(selectedAlt)
                    }
                  }}
                  disabled={rewordSelected === null}
                  className="px-3 py-2 text-white rounded-lg text-[11px] md:text-xs font-semibold transition-opacity hover:opacity-90 disabled:opacity-40"
                  style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
                >
                  ✓ Apply Change
                </button>
              </div>
            </div>
          </div>

          {editingReword && (
            <div
              className="fixed inset-0 z-[80] flex items-center justify-center p-4"
              style={{ backgroundColor: 'rgba(15, 10, 30, 0.75)' }}
              onMouseDown={(e) => { e.currentTarget.dataset.downTarget = e.target === e.currentTarget ? 'backdrop' : 'inside'; }}
              onMouseUp={(e) => { if (e.target === e.currentTarget && e.currentTarget.dataset.downTarget === 'backdrop') { setEditingReword(false); } }}
            >
              <div
                className="bg-white shadow-2xl flex flex-col"
                style={{ borderRadius: '8px', border: '1px solid #e5e7eb', width: '400px' }}
                onMouseDown={e => e.stopPropagation()}
              >
                <div
                  style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)', borderRadius: '8px 8px 0 0' }}
                  className="px-5 py-3 flex items-center justify-between"
                >
                  <h2 className="text-sm font-bold text-white">✏️ Edit Change</h2>
                  <button onClick={() => setEditingReword(false)} className="text-white hover:text-gray-200 text-2xl leading-none font-light">×</button>
                </div>
                <div className="p-4">
                  <textarea
                    className="w-full border border-gray-300 rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
                    rows={4}
                    value={editedRewordText}
                    onChange={e => setEditedRewordText(e.target.value)}
                    autoFocus
                  />
                  <div className="flex justify-end gap-2 mt-3">
                    <button onClick={() => setEditingReword(false)} className="text-xs text-gray-500 hover:text-gray-700 px-3 py-2">Cancel</button>
                    <button
                      onClick={() => applyBulletChange(editedRewordText)}
                      className="text-white rounded-lg px-4 py-2 text-xs font-semibold transition-opacity hover:opacity-90"
                      style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
                    >
                      ✓ Apply Change
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )
    }

    return null
  }

  // ── FIX MODAL ──
  if (mode === 'fix') {
    return (
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center p-4"
        style={{ backgroundColor: 'rgba(15, 10, 30, 0.75)' }}
        onMouseDown={(e) => { e.currentTarget.dataset.downTarget = e.target === e.currentTarget ? 'backdrop' : 'inside'; }}
        onMouseUp={(e) => { if (e.target === e.currentTarget && e.currentTarget.dataset.downTarget === 'backdrop') { onClose(); } }}
      >
        <div
          className="bg-white shadow-2xl flex flex-col"
          style={{ borderRadius: '8px', border: '1px solid #e5e7eb', width: '364px' }}
          onMouseDown={e => e.stopPropagation()}
        >
          <div
            style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)', borderRadius: '8px 8px 0 0' }}
            className="px-5 py-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">⚡</span>
              <h2 className="text-base font-bold text-white">Fix this Sentence</h2>
            </div>
            <button onClick={onClose} className="text-white hover:text-gray-200 text-2xl leading-none font-light">×</button>
          </div>

          <div className="p-5">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Current</p>
              <p className="text-xs text-gray-700 leading-relaxed">{currentText}</p>
            </div>

            {!revised ? (
              <>
                <textarea
                  value={userInput}
                  onChange={e => setUserInput(e.target.value)}
                  placeholder="Tell us what's wrong or what needs to change..."
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
                  rows={3}
                  disabled={loading}
                />
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-2">
                    <p className="text-xs text-red-700">{error}</p>
                  </div>
                )}
                <div className="flex justify-end gap-2 mt-3">
                  <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-700 px-3 py-2">Cancel</button>
                  <button
                    onClick={handleFixSubmit}
                    disabled={loading || !userInput.trim()}
                    className="text-white rounded-lg px-4 py-2 text-xs font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                        Fixing...
                      </span>
                    ) : 'Fix It'}
                  </button>
                </div>
              </>
            ) : (
              <div className="p-1">
                <p className="text-xs text-gray-500 mb-2 text-center">Close this to review your fix.</p>
              </div>
            )}
          </div>
        </div>

        {revised && (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center p-6"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.85)' }}
            onMouseDown={(e) => { e.currentTarget.dataset.downTarget = e.target === e.currentTarget ? 'backdrop' : 'inside'; }}
            onMouseUp={(e) => { if (e.target === e.currentTarget && e.currentTarget.dataset.downTarget === 'backdrop') { onClose(); } }}
          >
            <div
              className="bg-white shadow-2xl w-full max-w-lg border border-gray-200 flex flex-col"
              style={{ borderRadius: '8px', height: '380px' }}
              onMouseDown={e => e.stopPropagation()}
            >
              <div
                style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)', borderRadius: '8px 8px 0 0' }}
                className="px-6 py-4 flex items-center justify-between flex-shrink-0"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-white rounded flex items-center justify-center flex-shrink-0">
                    <span className="text-purple-600 font-bold text-lg">⚡</span>
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">✏️ Fix Applied</h2>
                    <p className="text-purple-100 text-xs">{textLabel}</p>
                  </div>
                </div>
                <button onClick={onClose} className="text-white hover:text-gray-200 text-4xl leading-none font-light w-8 h-8 flex items-center justify-center">×</button>
              </div>

              <div className="flex flex-col flex-1 p-4 min-h-0">
                <div className="grid grid-cols-2 gap-3 mb-3" style={{ flex: 1, minHeight: 0 }}>
                  <div className="flex flex-col min-h-0">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Before</p>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 overflow-y-auto flex-1">
                      <p className="text-xs text-gray-600 leading-snug line-through decoration-red-400">{currentText}</p>
                    </div>
                  </div>

                  <div className="flex flex-col min-h-0">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">After</p>
                    {editingFix ? (
                      <textarea
                        className="w-full flex-1 text-xs text-gray-800 leading-snug bg-green-50 border border-green-200 rounded-lg p-2.5 outline-none resize-none"
                        value={editedFixText}
                        onChange={e => setEditedFixText(e.target.value)}
                        autoFocus
                      />
                    ) : (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-2.5 overflow-y-auto flex-1">
                        <p className="text-xs text-gray-800 leading-snug font-medium">{revised}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-2 flex-shrink-0">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors"
                  >
                    ✗ Keep Original
                  </button>
                  {!editingFix ? (
                    <button
                      onClick={() => { setEditingFix(true); setEditedFixText(revised) }}
                      className="px-4 py-2 bg-white text-purple-600 border border-purple-300 rounded-lg text-xs font-medium hover:bg-purple-50 transition-colors"
                    >
                      ✏️ Edit Change
                    </button>
                  ) : (
                    <button
                      onClick={() => setEditingFix(false)}
                      className="px-4 py-2 bg-white text-gray-600 border border-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors"
                    >
                      Cancel Edit
                    </button>
                  )}
                  <button
                    onClick={() => applyBulletChange(editingFix ? editedFixText : revised)}
                    className="px-4 py-2 text-white rounded-lg text-xs font-semibold transition-opacity hover:opacity-90"
                    style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
                  >
                    ✓ Apply Fix
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── ADD MODAL ──
  if (mode === 'add' || state.mode === 'add') {
    return (
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center p-4"
        style={{ backgroundColor: 'rgba(15, 10, 30, 0.75)' }}
        onMouseDown={(e) => { e.currentTarget.dataset.downTarget = e.target === e.currentTarget ? 'backdrop' : 'inside'; }}
        onMouseUp={(e) => { if (e.target === e.currentTarget && e.currentTarget.dataset.downTarget === 'backdrop') { onClose(); } }}
      >
        <div
          className="bg-white shadow-2xl flex flex-col"
          style={{ borderRadius: '8px', border: '1px solid #e5e7eb', width: '364px' }}
          onMouseDown={e => e.stopPropagation()}
        >
          <div
            style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)', borderRadius: '8px 8px 0 0' }}
            className="px-5 py-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">⚡</span>
              <h2 className="text-base font-bold text-white">More to Add?</h2>
            </div>
            <button onClick={onClose} className="text-white hover:text-gray-200 text-2xl leading-none font-light">×</button>
          </div>

          <div className="p-5">
            {!addResult ? (
              <>
                <p className="text-sm text-gray-700 mb-3">
                  Left something out? It happens. Drop it here and we'll add it in. 
                </p>
                <textarea
                  value={userInput}
                  onChange={e => setUserInput(e.target.value)}
                  placeholder="I forgot to mention that I also managed the team's budget of $50K..."
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
                  rows={4}
                  disabled={loading}
                />
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-2">
                    <p className="text-xs text-red-700">{error}</p>
                  </div>
                )}
                <div className="flex justify-end gap-2 mt-3">
                  <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-700 px-3 py-2">Cancel</button>
                  <button
                    onClick={handleAddSubmit}
                    disabled={loading || !userInput.trim()}
                    className="text-white rounded-lg px-4 py-2 text-xs font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                        Working...
                      </span>
                    ) : 'Add It'}
                  </button>
                </div>
              </>
            ) : addResult.type === 'clarification' ? (
              <>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-3">
                  <p className="text-[10px] font-bold text-purple-600 uppercase tracking-wide mb-1">Coach needs a little more</p>
                  <p className="text-xs text-gray-700 leading-relaxed">{addResult.question}</p>
                </div>
                <textarea
                  value={userInput}
                  onChange={e => setUserInput(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
                  rows={3}
                  disabled={loading}
                />
                <div className="flex justify-end gap-2 mt-3">
                  <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-700 px-3 py-2">Cancel</button>
                  <button
                    onClick={() => { setAddResult(null); handleAddSubmit() }}
                    disabled={loading || !userInput.trim()}
                    className="text-white rounded-lg px-4 py-2 text-xs font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
                  >
                    {loading ? 'Working...' : 'Submit'}
                  </button>
                </div>
              </>
            ) : addResult.type === 'confirmJob' ? (
              <>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-3">
                  <p className="text-[10px] font-bold text-purple-600 uppercase tracking-wide mb-1">New job</p>
                  <p className="text-xs text-gray-700 leading-relaxed">{addResult.question}</p>
                  {addResult.jobLabel && (
                    <p className="text-xs text-gray-900 font-semibold leading-snug mt-2">{addResult.jobLabel}</p>
                  )}
                </div>
                <div className="flex justify-end gap-2 mt-3">
                  <button
                    onClick={resetAddFlow}
                    disabled={loading}
                    className="text-xs text-gray-500 hover:text-gray-700 px-3 py-2 disabled:opacity-50"
                  >
                    No, don't add it
                  </button>
                  <button
                    onClick={() => submitAdd('Yes, please add that as a new job in my experience section.')}
                    disabled={loading}
                    className="text-white rounded-lg px-4 py-2 text-xs font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
                  >
                    {loading ? 'Working...' : 'Yes, add it'}
                  </button>
                </div>
              </>
            ) : addResult.type === 'duplicateJob' ? (
              <>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                  <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide mb-1">Already on your resume</p>
                  <p className="text-xs text-gray-700 leading-relaxed">
                    {addResult.job.title} at {addResult.job.company} is already in your experience section, so it wasn't added again. To change what's there, close this and edit that role directly.
                  </p>
                </div>
                <div className="flex justify-end gap-2 mt-3">
                  <button onClick={resetAddFlow} className="text-xs text-gray-500 hover:text-gray-700 px-3 py-2">Add Something Else</button>
                  <button
                    onClick={onClose}
                    className="text-white rounded-lg px-4 py-2 text-xs font-semibold transition-opacity hover:opacity-90"
                    style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
                  >
                    Got It
                  </button>
                </div>
              </>
            ) : addResult.type === 'unsupported' ? (
              <>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                  <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide mb-1">
                    {addResult.reason === 'newJob' && documentLabel === 'Resume' ? 'Need the title and employer' : "Coach couldn't place this"}
                  </p>
                  <p className="text-xs text-gray-700 leading-relaxed">
                    {addResult.reason === 'newJob' && documentLabel === 'Resume'
                      ? `To add a job that isn't on your resume yet, Coach needs the job title you held and the name of the employer. Try again with both, along with the years you were there.`
                      : `Coach couldn't tell where this belongs. Try describing it as an addition to something already on your ${documentLabel.toLowerCase()}, or add it directly in the editor.`}
                  </p>
                </div>
                <div className="flex justify-end gap-2 mt-3">
                  <button
                    onClick={resetAddFlow}
                    className="text-xs text-gray-500 hover:text-gray-700 px-3 py-2"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={onClose}
                    className="text-white rounded-lg px-4 py-2 text-xs font-semibold transition-opacity hover:opacity-90"
                    style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
                  >
                    Got It
                  </button>
                </div>
              </>
            ) : (
              <div className="p-1">
                <p className="text-xs text-gray-500 mb-2 text-center">Close this to review your addition.</p>
              </div>
            )}
          </div>
        </div>

        {addResult && !['clarification', 'unsupported', 'confirmJob', 'duplicateJob'].includes(addResult.type) && (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center p-6"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.85)' }}
            onMouseDown={(e) => { e.currentTarget.dataset.downTarget = e.target === e.currentTarget ? 'backdrop' : 'inside'; }}
            onMouseUp={(e) => { if (e.target === e.currentTarget && e.currentTarget.dataset.downTarget === 'backdrop') { onClose(); } }}
          >
            <div
              className="bg-white shadow-2xl w-full max-w-lg border border-gray-200 flex flex-col"
              style={{ borderRadius: '8px', height: '380px' }}
              onMouseDown={e => e.stopPropagation()}
            >
              <div
                style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)', borderRadius: '8px 8px 0 0' }}
                className="px-6 py-4 flex items-center justify-between flex-shrink-0"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-white rounded flex items-center justify-center flex-shrink-0">
                    <span className="text-purple-600 font-bold text-lg">⚡</span>
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">✨ Adding New Information</h2>
                    <p className="text-purple-100 text-xs">
                      {documentLabel !== 'Resume'
                        ? addResult.section === 'opening' ? 'Opening section'
                          : addResult.section === 'closing' ? 'Closing section'
                          : 'Bullets section'
                        : addResult.type === 'bullet' ? resumeData.experience?.[addResult.jobIndex]?.company || 'Your role'
                        : addResult.type === 'experience' ? addResult.job.company
                        : addResult.type === 'summary' ? 'Professional Summary'
                        : addResult.type === 'skill' ? addResult.category : 'Resume'}
                    </p>
                  </div>
                </div>
                <button onClick={onClose} className="text-white hover:text-gray-200 text-4xl leading-none font-light w-8 h-8 flex items-center justify-center">×</button>
              </div>

              <div className="flex flex-col flex-1 p-4 min-h-0">
                <div className="grid grid-cols-2 gap-3 mb-3" style={{ flex: 1, minHeight: 0 }}>
                  <div className="flex flex-col min-h-0">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">New Content</p>
                    {editingAdd ? (
                      <>
                        {addResult.type === 'experience' && (
                          <p className="text-[10px] text-gray-500 mb-1 leading-snug">
                            One bullet per line. Title, company, dates, and the job summary are editable on the resume once added.
                          </p>
                        )}
                        <textarea
                          className="w-full flex-1 text-xs text-gray-800 leading-snug bg-green-50 border border-green-200 rounded-lg p-2.5 outline-none resize-none"
                          value={editedAddText}
                          onChange={e => setEditedAddText(e.target.value)}
                          autoFocus
                        />
                      </>
                    ) : (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-2.5 overflow-y-auto flex-1">
                        {addResult.type === 'experience' ? (
                          <>
                            <p className="text-xs text-gray-900 leading-snug font-bold">{addResult.job.title}</p>
                            <p className="text-xs text-gray-700 leading-snug">
                              {addResult.job.company}{addResult.job.location ? `, ${addResult.job.location}` : ''}
                            </p>
                            <p className="text-[10px] text-gray-500 leading-snug mb-1.5">
                              {formatAddedJobDates(addResult.job)}
                            </p>
                            {addResult.job.summary && (
                              <p className="text-xs text-gray-700 italic leading-snug mb-2">{addResult.job.summary}</p>
                            )}
                            {addResult.job.bullets.length > 0 ? addResult.job.bullets.map((b, i) => (
                              <p key={i} className="text-xs text-gray-800 leading-snug font-medium mb-1">• {b}</p>
                            )) : (
                              <p className="text-[10px] text-gray-500 italic leading-snug">No bullets yet. Add them on the resume.</p>
                            )}
                          </>
                        ) : (
                          <p className="text-xs text-gray-800 leading-snug font-medium">
                            {addResult.type === 'skill' ? addResult.skills?.join(', ') : addResult.content}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col min-h-0">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Where This Goes</p>
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-2.5 flex-1">
                      <p className="text-xs text-gray-700 leading-snug mb-2">
                        {documentLabel !== 'Resume'
                          ? `${documentLabel} — ${addResult.section === 'opening' ? 'Opening section' : addResult.section === 'closing' ? 'Closing section' : 'Bullets section'}`
                          : addResult.type === 'bullet' ? `${resumeData.experience?.[addResult.jobIndex]?.title || 'Role'} at ${resumeData.experience?.[addResult.jobIndex]?.company || 'this company'}`
                          : addResult.type === 'experience' ? `New role in your Experience section, placed by date`
                          : addResult.type === 'summary' ? 'Professional Summary'
                          : addResult.type === 'skill' ? `${addResult.category} skills` : 'Your resume'}
                      </p>
                      {addResult.explanation && (
                        <p className="text-xs text-gray-500 leading-snug italic">
                          {addResult.explanation}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 flex-shrink-0">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors"
                  >
                    ✗ Skip
                  </button>
                  {!editingAdd ? (
                    <button
                      onClick={() => {
                        setEditingAdd(true)
                        setEditedAddText(
                          addResult.type === 'skill' ? addResult.skills?.join(', ')
                          : addResult.type === 'experience' ? addResult.job.bullets.join('\n')
                          : addResult.content
                        )
                      }}
                      className="px-4 py-2 bg-white text-purple-600 border border-purple-300 rounded-lg text-xs font-medium hover:bg-purple-50 transition-colors"
                    >
                      ✏️ Edit Change
                    </button>
                  ) : (
                    <button
                      onClick={() => setEditingAdd(false)}
                      className="px-4 py-2 bg-white text-gray-600 border border-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors"
                    >
                      Cancel Edit
                    </button>
                  )}
                  <button
                    onClick={() => {
                      // A job entry's edit box holds its bullets, one per line — everything
                      // else edits a single string in `content`.
                      const finalResult = !editingAdd
                        ? addResult
                        : addResult.type === 'experience'
                          ? { ...addResult, job: { ...addResult.job, bullets: editedAddText.split('\n').map(b => b.trim()).filter(Boolean) } }
                          : { ...addResult, content: editedAddText }
                      if (onApplyAdd) {
                        onApplyAdd(finalResult)
                        onClose()
                      } else {
                        applyAddResult(finalResult)
                      }
                    }}
                    className="px-4 py-2 text-white rounded-lg text-xs font-semibold transition-opacity hover:opacity-90"
                    style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
                  >
                    ✓ Add to {documentLabel}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return null
}