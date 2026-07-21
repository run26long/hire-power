'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import helpContent from '../data/helpContent'

export default function HelpPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCategories, setExpandedCategories] = useState({})
  const [expandedQuestions, setExpandedQuestions] = useState({})
  const panelRef = useRef(null)
  const searchRef = useRef(null)

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handleEscape = (e) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen])

  // Focus search on open
  useEffect(() => {
    if (isOpen && searchRef.current) {
      setTimeout(() => searchRef.current.focus(), 300)
    }
  }, [isOpen])

  // Lock body scroll when open on mobile
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  const toggleCategory = useCallback((idx) => {
    setExpandedCategories(prev => ({ ...prev, [idx]: !prev[idx] }))
  }, [])

  const toggleQuestion = useCallback((catIdx, qIdx) => {
    const key = `${catIdx}-${qIdx}`
    setExpandedQuestions(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const handleOpen = () => {
    setIsOpen(true)
    setSearchQuery('')
    setExpandedCategories({})
    setExpandedQuestions({})
  }

  // Filter content based on search
  const filteredContent = searchQuery.trim()
    ? helpContent
        .map((category, catIdx) => {
          const matchingQuestions = category.questions.filter(
            (q) =>
              q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
              q.answer.toLowerCase().includes(searchQuery.toLowerCase())
          )
          return matchingQuestions.length > 0
            ? { ...category, questions: matchingQuestions, originalIndex: catIdx }
            : null
        })
        .filter(Boolean)
    : helpContent.map((cat, idx) => ({ ...cat, originalIndex: idx }))

  // When searching, auto-expand all matching categories and questions
  const isCategoryExpanded = (catIdx) => {
    if (searchQuery.trim()) return true
    return !!expandedCategories[catIdx]
  }

  const isQuestionExpanded = (catIdx, qIdx) => {
    if (searchQuery.trim()) return true
    return !!expandedQuestions[`${catIdx}-${qIdx}`]
  }

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={handleOpen}
        className="fixed bottom-5 right-5 md:right-14 z-40 w-11 h-11 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
        style={{ backgroundColor: '#7c3aed' }}
        aria-label="Help"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 0C4.477 0 0 4.477 0 10s4.477 10 10 10 10-4.477 10-10S15.523 0 10 0zm.75 16.5h-1.5v-1.5h1.5v1.5zm1.572-6.93l-.675.69C10.97 10.94 10.75 11.5 10.75 12.5h-1.5c0-1.41.525-2.1 1.275-2.85l.93-.95C11.8 8.36 12 7.94 12 7.5c0-1.1-.9-2-2-2s-2 .9-2 2H6.5c0-1.93 1.57-3.5 3.5-3.5s3.5 1.57 3.5 3.5c0 .88-.36 1.68-.928 2.25l-.25.32z" fill="white"/>
        </svg>
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 transition-opacity duration-300"
          aria-hidden="true"
        />
      )}

      {/* Panel */}
      <div
        ref={panelRef}
        className={`fixed top-0 right-0 h-full z-50 bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ width: 'min(400px, 100vw)' }}
        role="dialog"
        aria-label="Help Center"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Help Center</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Close help panel"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 1l12 12M13 1L1 13" stroke="#6B7280" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7 12A5 5 0 107 2a5 5 0 000 10zM14 14l-3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search help topics..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="Clear search"
              >
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {filteredContent.length === 0 ? (
            <div className="px-5 py-12 text-center text-gray-500">
              <p className="text-sm">No results found for &ldquo;{searchQuery}&rdquo;</p>
            </div>
          ) : (
            <div className="py-2">
              {filteredContent.map((category, catDisplayIdx) => {
                const catIdx = category.originalIndex
                return (
                  <div key={catIdx} className="border-b border-gray-100 last:border-b-0">
                    {/* Category Header */}
                    <button
                      onClick={() => toggleCategory(catIdx)}
                      className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-gray-50 transition-colors"
                    >
                      <span className="text-sm font-semibold text-gray-900">
                        {category.title}
                      </span>
                      <svg
                        className={`w-4 h-4 text-gray-400 transition-transform duration-200 flex-shrink-0 ml-2 ${
                          isCategoryExpanded(catIdx) ? 'rotate-180' : ''
                        }`}
                        viewBox="0 0 16 16"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>

                    {/* Questions */}
                    {isCategoryExpanded(catIdx) && (
                      <div className="pb-1">
                        {category.questions.map((q, qIdx) => {
                          const qKey = `${catIdx}-${qIdx}`
                          return (
                            <div key={qKey} className="mx-3">
                              {/* Question */}
                              <button
                                onClick={() => toggleQuestion(catIdx, qIdx)}
                                className="w-full flex items-start gap-2 px-3 py-2.5 text-left rounded-lg hover:bg-purple-50 transition-colors"
                              >
                                <svg
                                  className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 transition-transform duration-200 ${
                                    isQuestionExpanded(catIdx, qIdx) ? 'rotate-90 text-purple-600' : 'text-gray-400'
                                  }`}
                                  viewBox="0 0 16 16"
                                  fill="none"
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                <span className="text-sm text-gray-700">
                                  {q.question}
                                </span>
                              </button>

                              {/* Answer */}
                              {isQuestionExpanded(catIdx, qIdx) && (
                                <div className="pl-8 pr-3 pb-3">
                                  <p className="text-sm text-gray-600 leading-relaxed">
                                    {q.answer}
                                  </p>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}