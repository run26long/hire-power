'use client'

export default function TestRightPanelAssess() {
  const score = 78
  const breakdown = {
    impact: 32,
    clarity: 31,
    keywords: 15
  }
  
  const strengths = [
    "Strong quantification throughout with specific numbers demonstrating scope and impact.",
    "Action verbs consistently demonstrate ownership and leadership.",
    "Professional formatting maintains clear, readable structure.",
    "Skills section includes relevant technical and soft skills."
  ]
  
  const weaknesses = [
    "Three experience bullets lack quantifiable metrics or measurable outcomes.",
    "Vague language such as 'managed team' without specifying team size or budget.",
    "Generic claim of 'improved efficiency' requires percentage or specific timeframe.",
    "Missing keywords from target job description in technical skills section.",
    "Education section could benefit from relevant coursework or academic honors.",
    "Event coordination lacks scope indicators such as event count or budget details."
  ]
  
  const suggestions = [
    "Add team size (e.g., 'Led team of 8') and budget amounts to management role descriptions.",
    "Quantify efficiency improvement with specific metrics: '30% faster turnaround' or 'saved 10 hours weekly'.",
    "Include 2-3 technical skills from job description, such as Salesforce, Tableau, or Asana.",
    "Add specific event metrics: '60+ annual events with 200-500 attendees, $50K average budget'.",
    "Strengthen education section: include GPA if above 3.5, relevant coursework, or academic honors.",
    "Replace weak verbs like 'helped' and 'responsible for' with action verbs showing direct impact."
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mock Toolbar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <select className="text-sm border border-gray-300 rounded px-3 py-1.5">
            <option>Template: Modern</option>
          </select>
          <select className="text-sm border border-gray-300 rounded px-3 py-1.5">
            <option>Font: Inter</option>
          </select>
          <select className="text-sm border border-gray-300 rounded px-3 py-1.5">
            <option>Size: 11</option>
          </select>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Score:</span>
            <span className="text-lg font-bold text-gray-900">{score}</span>
          </div>
          <button className="px-4 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">
            Re-assess
          </button>
          <button className="px-4 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">
            Preview
          </button>
          <button className="px-4 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700">
            Download
          </button>
        </div>
      </div>

      {/* Main Layout: Resume Left, Assessment Right */}
      <div className="flex h-[calc(100vh-60px)]">
        
        {/* LEFT: Resume (70-75% width) */}
        <div className="flex-[0.72] bg-white p-8 overflow-y-auto border-r border-gray-200">
          <div className="max-w-[8.5in] mx-auto bg-white" style={{ fontSize: '11pt', fontFamily: 'Inter, sans-serif' }}>
            {/* Mock Resume Content */}
            <div className="space-y-4">
              <div className="text-center border-b border-gray-300 pb-3">
                <h1 className="text-2xl font-bold">AVA LONG</h1>
                <p className="text-sm text-gray-600">Longwood, FL | 407-xxx-xxxx | aerialarva26@gmail.com</p>
              </div>

              <div>
                <h2 className="text-lg font-bold border-b border-gray-300 mb-2">SUMMARY</h2>
                <p className="text-sm text-gray-700">Professional aerial arts instructor and performer with 3+ years of experience teaching diverse student populations. Skilled in curriculum development, safety protocols, and performance choreography.</p>
              </div>

              <div>
                <h2 className="text-lg font-bold border-b border-gray-300 mb-2">EXPERIENCE</h2>
                <div className="mb-4">
                  <div className="flex justify-between items-baseline mb-1">
                    <h3 className="font-semibold">Aerial Arts Instructor & Performer</h3>
                    <span className="text-sm text-gray-600">Sep 2022 - Present</span>
                  </div>
                  <p className="text-sm italic text-gray-600 mb-1">Antigravity Orlando | Orlando, FL</p>
                  <p className="text-sm text-gray-700 mb-2">Teach variety of aerial arts and fitness classes to aspiring artists, emphasizing safety and performance excellence.</p>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    <li>Instructed 60+ students weekly across 8 different aerial disciplines</li>
                    <li>Developed safety curriculum adopted company-wide, reducing injuries 40%</li>
                    <li>Choreographed and performed in 15+ shows with audiences of 200-500</li>
                  </ul>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between items-baseline mb-1">
                    <h3 className="font-semibold">American Ninja Warrior Coach</h3>
                    <span className="text-sm text-gray-600">Apr 2021 - Sep 2022</span>
                  </div>
                  <p className="text-sm italic text-gray-600 mb-1">Obstacle Ninja Academy | Orlando, FL</p>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    <li>Provided sport-specific expertise for athletes of all ages</li>
                    <li>Maintained all equipment and obstacles to ensure safe experience</li>
                    <li>Designed courses to challenge and teach athletes varying abilities</li>
                  </ul>
                </div>
              </div>

              <div>
                <h2 className="text-lg font-bold border-b border-gray-300 mb-2">EDUCATION</h2>
                <div className="flex justify-between items-baseline">
                  <div>
                    <h3 className="font-semibold">University of Central Florida, Rosen College</h3>
                    <p className="text-sm text-gray-700">Bachelor of Science in Entertainment Management</p>
                  </div>
                  <span className="text-sm text-gray-600">May 2027</span>
                </div>
              </div>

              <div>
                <h2 className="text-lg font-bold border-b border-gray-300 mb-2">SKILLS</h2>
                <p className="text-sm text-gray-700">Event Planning • Leadership • Project Management • Safety Training • Curriculum Development • Performance Choreography • Student Assessment • Team Collaboration</p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Assessment Panel (25-30% width) */}
        <div className="flex-[0.28] bg-gray-50 p-6 overflow-y-auto">
          <div className="space-y-5">
            
            {/* Header - UPDATED POSITION */}
            <div className="flex items-center justify-center gap-6 -mt-1">
              <div className="text-center">
                <div className="text-sm text-gray-600 leading-tight">Assessment Complete!</div>
                <div className="text-base text-gray-900 font-semibold leading-tight">Resume Power Score:</div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-bold text-gray-900">{score}</span>
                <span className="text-lg text-gray-600">/100</span>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div>
              <div className="relative mb-4">
                <div className="h-12 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-yellow-400 to-yellow-500 transition-all duration-500"
                    style={{ width: `${score}%` }}
                  />
                </div>
              </div>
              
              <div className="relative h-12 mb-2">
                <div className="flex h-2">
                  <div className="bg-[#e57373] rounded-l-full" style={{ width: '70%' }}></div>
                  <div className="bg-yellow-500" style={{ width: '14%' }}></div>
                  <div className="bg-green-500 rounded-r-full" style={{ width: '16%' }}></div>
                </div>
                
                <div className="absolute top-0 left-[70%] -translate-x-1/2 -translate-y-px">
                  <div className="w-3 h-3 rounded-full bg-white border-2 border-[#e57373]"></div>
                </div>
                <div className="absolute top-0 left-[84%] -translate-x-1/2 -translate-y-px">
                  <div className="w-3 h-3 rounded-full bg-white border-2 border-yellow-500"></div>
                </div>
                
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
            
          {/* Breakdown - DYNAMIC COLORS */}
            <div className="bg-white rounded-lg p-4">
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-1.5">Breakdown</h3>
              
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">Impact</div>
                      <div className="text-[11px] text-gray-500 leading-tight">Quantified achievements, results, scope</div>
                    </div>
                    <span className="text-gray-700 font-medium ml-2">{breakdown.impact}/40</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${
                        breakdown.impact/40 >= 0.8 ? 'bg-green-500' : 
                        breakdown.impact/40 >= 0.6 ? 'bg-yellow-500' : 
                        'bg-[#e57373]'
                      }`}
                      style={{ width: `${(breakdown.impact/40)*100}%` }}
                    ></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">Clarity</div>
                      <div className="text-[11px] text-gray-500 leading-tight">Strong verbs, grammar, professional language</div>
                    </div>
                    <span className="text-gray-700 font-medium ml-2">{breakdown.clarity}/40</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${
                        breakdown.clarity/40 >= 0.8 ? 'bg-green-500' : 
                        breakdown.clarity/40 >= 0.6 ? 'bg-yellow-500' : 
                        'bg-[#e57373]'
                      }`}
                      style={{ width: `${(breakdown.clarity/40)*100}%` }}
                    ></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">Keywords</div>
                      <div className="text-[11px] text-gray-500 leading-tight">Industry terms, relevant skills</div>
                    </div>
                    <span className="text-gray-700 font-medium ml-2">{breakdown.keywords}/20</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${
                        breakdown.keywords/20 >= 0.8 ? 'bg-green-500' : 
                        breakdown.keywords/20 >= 0.6 ? 'bg-yellow-500' : 
                        'bg-[#e57373]'
                      }`}
                      style={{ width: `${(breakdown.keywords/20)*100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Strengths - TIGHTER SPACING */}
            <div className="pt-3 border-t border-gray-300">
              <h3 className="text-sm font-bold text-green-700 uppercase tracking-wide mb-1.5">Strengths</h3>
              <ul className="space-y-1">
                {strengths.map((strength, i) => (
                  <li key={i} className="text-sm text-gray-700 flex gap-2 leading-snug">
                    <span className="text-green-600 flex-shrink-0">•</span>
                    <span>{strength}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            {/* Weaknesses - TIGHTER SPACING */}
            <div className="pt-3 border-t border-gray-300">
              <h3 className="text-sm font-bold text-red-700 uppercase tracking-wide mb-1.5">Needs Work</h3>
              <ul className="space-y-1">
                {weaknesses.map((weakness, i) => (
                  <li key={i} className="text-sm text-gray-700 flex gap-2 leading-snug">
                    <span className="text-red-600 flex-shrink-0">•</span>
                    <span>{weakness}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            {/* Suggestions - TIGHTER SPACING */}
            <div className="pt-3 border-t border-gray-300">
              <h3 className="text-sm font-bold text-yellow-700 uppercase tracking-wide mb-1.5">To Improve</h3>
              <ul className="space-y-1">
                {suggestions.map((suggestion, i) => (
                  <li key={i} className="text-sm text-gray-700 flex gap-2 leading-snug">
                    <span className="text-yellow-600 flex-shrink-0">•</span>
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            {/* CTA - TIGHTER SPACING */}
            <div className="pt-3 border-t border-gray-300">
              <button className="w-full bg-purple-600 text-white rounded-lg py-3 font-semibold hover:bg-purple-700 transition-colors">
                Start Coaching →
              </button>
              <p className="text-xs text-gray-500 text-center mt-3">Baseline: {score}/100</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}