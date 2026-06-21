'use client'
import { useState } from 'react'

export default function CoachReviseModal({ state, onClose, resumeData, coachingMessages, careerContext, supabase, resumeId, setResume, onUpdate, onReviewChangeUpdate }) {
  const [loading, setLoading] = useState(false)
  const [alternatives, setAlternatives] = useState([])
  const [revised, setRevised] = useState(null)
  const [addResult, setAddResult] = useState(null)
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

  // Split into sentences for summary types with multiple sentences
  const isSummaryType = location.type === 'summary' || location.type === 'jobSummary'
  const sentences = isSummaryType ? rawText.match(/[^.!?]+[.!?]+/g)?.map(s => s.trim()).filter(s => s.length > 0) || [rawText] : [rawText]
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
          textType: location.type === 'summary' ? 'summary' : location.type === 'jobSummary' ? 'job summary' : 'bullet',
          resumeData: resumeData,
          coachingTranscript: coachingMessages || [],
          careerContext: careerContext || null
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

  async function handleAddSubmit() {
    if (!userInput.trim()) return
    const result = await callApi('add', userInput)
    if (result) {
      setAddResult(result)
    }
  }

  function applyBulletChange(newText) {
    if (location.type === 'reviewChange' && onReviewChangeUpdate) {
      onReviewChangeUpdate(location.changeIndex, newText)
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
    const newData = JSON.parse(JSON.stringify(resumeData))
    if (result.type === 'bullet') {
      const job = newData.experience[result.jobIndex]
      if (!job.bullets) job.bullets = []
      if (result.position === 'end') {
        job.bullets.push(result.content)
      } else {
        job.bullets.splice(result.position, 0, result.content)
      }
    } else if (result.type === 'summary') {
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

  const textLabel = location.type === 'summary' ? 'Summary' : location.type === 'jobSummary' ? 'Job Summary' : 'Bullet'

  // ── ACTION CHOOSER ──
  if (state.mode === 'choose' && !mode) {
    // Sentence picker for summaries with multiple sentences
    if (hasMultipleSentences && selectedSentence === null) {
      return (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(15, 10, 30, 0.75)' }}
          onClick={onClose}
        >
          <div
            className="bg-white shadow-2xl flex flex-col"
            style={{ borderRadius: '8px', border: '1px solid #e5e7eb', width: '364px' }}
            onClick={e => e.stopPropagation()}
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
        onClick={onClose}
      >
        <div
          className="bg-white shadow-2xl flex flex-col"
          style={{ borderRadius: '8px', border: '1px solid #e5e7eb', width: '364px' }}
          onClick={e => e.stopPropagation()}
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
          onClick={onClose}
        >
          <div
            className="bg-white shadow-2xl flex flex-col"
            style={{ borderRadius: '8px', border: '1px solid #e5e7eb', width: '364px' }}
            onClick={e => e.stopPropagation()}
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
          onClick={onClose}
        >
          <div
            className="bg-white shadow-2xl w-full max-w-2xl border border-gray-200 flex flex-col h-[85vh] md:h-[480px]"
            style={{ borderRadius: '8px' }}
            onClick={e => e.stopPropagation()}
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
              onClick={() => setEditingReword(false)}
            >
              <div
                className="bg-white shadow-2xl flex flex-col"
                style={{ borderRadius: '8px', border: '1px solid #e5e7eb', width: '400px' }}
                onClick={e => e.stopPropagation()}
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
        onClick={onClose}
      >
        <div
          className="bg-white shadow-2xl flex flex-col"
          style={{ borderRadius: '8px', border: '1px solid #e5e7eb', width: '364px' }}
          onClick={e => e.stopPropagation()}
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
            onClick={onClose}
          >
            <div
              className="bg-white shadow-2xl w-full max-w-lg border border-gray-200 flex flex-col"
              style={{ borderRadius: '8px', height: '380px' }}
              onClick={e => e.stopPropagation()}
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
        onClick={onClose}
      >
        <div
          className="bg-white shadow-2xl flex flex-col"
          style={{ borderRadius: '8px', border: '1px solid #e5e7eb', width: '364px' }}
          onClick={e => e.stopPropagation()}
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
            ) : (
              <div className="p-1">
                <p className="text-xs text-gray-500 mb-2 text-center">Close this to review your addition.</p>
              </div>
            )}
          </div>
        </div>

        {addResult && addResult.type !== 'clarification' && (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center p-6"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.85)' }}
            onClick={onClose}
          >
            <div
              className="bg-white shadow-2xl w-full max-w-lg border border-gray-200 flex flex-col"
              style={{ borderRadius: '8px', height: '380px' }}
              onClick={e => e.stopPropagation()}
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
                      {addResult.type === 'bullet' ? resumeData.experience?.[addResult.jobIndex]?.company || 'Your role' :
                       addResult.type === 'summary' ? 'Professional Summary' :
                       addResult.type === 'skill' ? addResult.category : 'Resume'}
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
                      <textarea
                        className="w-full flex-1 text-xs text-gray-800 leading-snug bg-green-50 border border-green-200 rounded-lg p-2.5 outline-none resize-none"
                        value={editedAddText}
                        onChange={e => setEditedAddText(e.target.value)}
                        autoFocus
                      />
                    ) : (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-2.5 overflow-y-auto flex-1">
                        <p className="text-xs text-gray-800 leading-snug font-medium">
                          {addResult.type === 'skill' ? addResult.skills?.join(', ') : addResult.content}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col min-h-0">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Where This Goes</p>
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-2.5 flex-1">
                      <p className="text-xs text-gray-700 leading-snug mb-2">
                        {addResult.type === 'bullet' ? `${resumeData.experience?.[addResult.jobIndex]?.title || 'Role'} at ${resumeData.experience?.[addResult.jobIndex]?.company || 'this company'}` :
                         addResult.type === 'summary' ? 'Professional Summary' :
                         addResult.type === 'skill' ? `${addResult.category} skills` : 'Your resume'}
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
                      onClick={() => { setEditingAdd(true); setEditedAddText(addResult.type === 'skill' ? addResult.skills?.join(', ') : addResult.content) }}
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
                      if (editingAdd) {
                        const edited = { ...addResult, content: editedAddText }
                        applyAddResult(edited)
                      } else {
                        applyAddResult(addResult)
                      }
                    }}
                    className="px-4 py-2 text-white rounded-lg text-xs font-semibold transition-opacity hover:opacity-90"
                    style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
                  >
                    ✓ Add to Resume
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