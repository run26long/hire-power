'use client';

/**
 * CoachLayout Component
 * 
 * Reusable layout for all coach detail pages (Career, Resume, Interview)
 * Creates the 70/30 split: content left, coaching panel right
 * Matches exact structure from Resume Detail page
 */

export default function CoachLayout({ 
  leftContent,    // Main content (resume, builder, etc.)
  rightContent,   // Coaching panel, conversation, feedback
  leftClassName = "",  // Additional classes for left column
  rightClassName = ""  // Additional classes for right column
}) {
 return (
    <div className="flex gap-6 p-6 max-w-7xl mx-auto" style={{ height: 'calc(100vh - 160px)' }}>
      {/* Left Column - 70-75% width */}
      <div className={`flex-[3] bg-white rounded-lg shadow-sm border border-gray-200 overflow-y-auto ${leftClassName}`}>
        {leftContent}
      </div>

      {/* Right Column - 25-30% width */}
      <div className={`flex-1 bg-white rounded-lg shadow-sm border border-gray-200 p-6 overflow-y-auto ${rightClassName}`}>
        {rightContent}
      </div>
    </div>
  );
}
