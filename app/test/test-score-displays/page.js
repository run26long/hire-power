'use client'

export default function TestScoreDisplays() {
  const score = 78
  const breakdown = {
    impact: 32,
    clarity: 31,
    keywords: 15
  }
  
  const strengths = [
    "Strong quantification throughout - specific numbers show scope and impact",
    "Action verbs demonstrate ownership and leadership",
    "Professional formatting and clear structure",
    "Skills section includes relevant technical and soft skills"
  ]
  
  const weaknesses = [
    "Three experience bullets lack quantifiable metrics",
    "Vague language: 'managed team' doesn't specify team size or budget",
    "Generic 'improved efficiency' claim needs percentage or timeframe",
    "Missing keywords from target job description in technical skills",
    "Education section could include relevant coursework or honors",
    "No indication of scope in 'coordinated events' - how many? what budget?"
  ]
  
  const suggestions = [
    "Add team size (e.g., 'Led team of 8') and budget amounts to management descriptions",
    "Quantify efficiency improvement: '30% faster turnaround' or 'saved 10 hours weekly'",
    "Include 2-3 technical skills from job description (e.g., Salesforce, Tableau, Asana)",
    "Add specific event metrics: '60+ annual events with 200-500 attendees, $50K average budget'",
    "Strengthen education: include GPA if above 3.5, relevant coursework, or academic honors",
    "Replace weak verbs like 'helped' and 'responsible for' with action verbs showing impact"
  ]

  return (
    <div className="min-h-screen bg-gray-50 p-12">
      <h1 className="text-3xl font-bold mb-12 text-center">Resume Power Score - Final Design</h1>
      
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
        
     {/* Compact Header - Centered with text centered */}
        <div className="mb-6 flex items-center justify-center gap-6">
          <div className="text-center">
            <div className="text-sm text-gray-600 leading-tight">Assessment Complete</div>
            <div className="text-base text-gray-900 font-semibold leading-tight">Resume Power Score:</div>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-5xl font-bold text-gray-900">{score}</span>
            <span className="text-lg text-gray-600">/100</span>
          </div>
        </div>
        
        {/* Progress Bar with Zones */}
        <div className="mb-6">
          {/* Main Progress Bar */}
          <div className="relative mb-4">
            <div className="h-12 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${
                  score >= 85 ? 'bg-gradient-to-r from-green-400 to-green-500' :
                  score >= 70 ? 'bg-gradient-to-r from-yellow-400 to-yellow-500' :
                  'bg-gradient-to-r from-red-400 to-red-500'
                }`}
                style={{ width: `${score}%` }}
              />
            </div>
          </div>
          
          {/* Zone Visualization */}
          <div className="relative h-12 mb-2">
            {/* Colored zone line */}
            <div className="flex h-2">
              <div className="bg-[#e57373] rounded-l-full" style={{ width: '70%' }}></div>
              <div className="bg-yellow-500" style={{ width: '14%' }}></div>
              <div className="bg-green-500 rounded-r-full" style={{ width: '16%' }}></div>
            </div>
            
            {/* Zone markers - PERFECTLY CENTERED */}
            <div className="absolute top-0 left-[70%] -translate-x-1/2 -translate-y-px">
              <div className="w-3 h-3 rounded-full bg-white border-2 border-[#e57373]"></div>
            </div>
            <div className="absolute top-0 left-[84%] -translate-x-1/2 -translate-y-px">
              <div className="w-3 h-3 rounded-full bg-white border-2 border-yellow-500"></div>
            </div>
            
            {/* Zone labels - CENTERED */}
            <div className="flex mt-2">
              <div className="text-center text-xs text-gray-700" style={{ width: '70%' }}>
                <div className="font-medium">Needs Improvement</div>
                <div className="text-gray-500">(0-70)</div>
              </div>
              <div className="text-center text-xs text-gray-700" style={{ width: '14%' }}>
                <div className="font-medium">Strong</div>
                <div className="text-gray-500">(71-84)</div>
              </div>
              <div className="text-center text-xs text-gray-700" style={{ width: '16%' }}>
                <div className="font-medium">Excellent</div>
                <div className="text-gray-500">(85-100)</div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Breakdown Scores */}
        <div className="mb-4 pb-4 bg-gray-50 rounded-lg p-4">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-1.5">Breakdown</h3>
          
          <div className="space-y-3">
            {/* Impact */}
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <div>
                  <span className="font-semibold text-gray-900">Impact</span>
                  <span className="text-xs text-gray-500 ml-2">Quantified achievements, results, scope</span>
                </div>
                <span className="text-gray-700 font-medium">{breakdown.impact}/40</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${breakdown.impact/40 >= 0.8 ? 'bg-green-500' : breakdown.impact/40 >= 0.6 ? 'bg-yellow-500' : 'bg-[#e57373]'}`}
                  style={{ width: `${(breakdown.impact/40)*100}%` }}
                ></div>
              </div>
            </div>
            
            {/* Clarity */}
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <div>
                  <span className="font-semibold text-gray-900">Clarity</span>
                  <span className="text-xs text-gray-500 ml-2">Strong verbs, grammar, professional language</span>
                </div>
                <span className="text-gray-700 font-medium">{breakdown.clarity}/40</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${breakdown.clarity/40 >= 0.8 ? 'bg-green-500' : breakdown.clarity/40 >= 0.6 ? 'bg-yellow-500' : 'bg-[#e57373]'}`}
                  style={{ width: `${(breakdown.clarity/40)*100}%` }}
                ></div>
              </div>
            </div>
            
            {/* Keywords */}
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <div>
                  <span className="font-semibold text-gray-900">Keywords</span>
                  <span className="text-xs text-gray-500 ml-2">Industry terms, relevant skills</span>
                </div>
                <span className="text-gray-700 font-medium">{breakdown.keywords}/20</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${breakdown.keywords/20 >= 0.8 ? 'bg-green-500' : breakdown.keywords/20 >= 0.6 ? 'bg-yellow-500' : 'bg-[#e57373]'}`}
                  style={{ width: `${(breakdown.keywords/20)*100}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Strengths */}
        <div className="mb-3 pb-3 border-b border-gray-200">
          <h3 className="text-sm font-bold text-green-700 uppercase tracking-wide mb-1.5">
            Strengths
          </h3>
          <ul className="space-y-1">
            {strengths.map((strength, i) => (
              <li key={i} className="text-sm text-gray-700 flex gap-2 leading-snug">
                <span className="text-green-600 flex-shrink-0">•</span>
                <span>{strength}</span>
              </li>
            ))}
          </ul>
        </div>
        
        {/* Weaknesses */}
        <div className="mb-3 pb-3 border-b border-gray-200">
          <h3 className="text-sm font-bold text-red-700 uppercase tracking-wide mb-1.5">
            Needs Work
          </h3>
          <ul className="space-y-1">
            {weaknesses.map((weakness, i) => (
              <li key={i} className="text-sm text-gray-700 flex gap-2 leading-snug">
                <span className="text-red-600 flex-shrink-0">•</span>
                <span>{weakness}</span>
              </li>
            ))}
          </ul>
        </div>
        
        {/* Suggestions */}
        <div className="mb-4 pb-3 border-b border-gray-200">
          <h3 className="text-sm font-bold text-yellow-700 uppercase tracking-wide mb-1.5">
            To Improve
          </h3>
          <ul className="space-y-1">
            {suggestions.map((suggestion, i) => (
              <li key={i} className="text-sm text-gray-700 flex gap-2 leading-snug">
                <span className="text-yellow-600 flex-shrink-0">•</span>
                <span>{suggestion}</span>
              </li>
            ))}
          </ul>
        </div>
        
        {/* CTA */}
        <div>
          <button className="w-full bg-purple-600 text-white rounded-lg py-3 font-semibold hover:bg-purple-700 transition-colors">
            Start Coaching →
          </button>
          <p className="text-xs text-gray-500 text-center mt-3">Baseline: {score}/100</p>
        </div>
      </div>
    </div>
  )
}