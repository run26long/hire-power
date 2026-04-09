'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import MainNav from '../../components/MainNav';
import Breadcrumb from '../../components/Breadcrumb';
import CoachLayout from '../../components/CoachLayout';
import ResumeContent from '../../components/ResumeContent';
import BuilderGuide from '../../components/BuilderGuide';
import ConversationPanel from '../../components/ConversationPanel';

// Format date function (REQUIRED for ResumeContent)
function formatDate(dateString, format = 'short') {
  if (!dateString) return '';
  
  const [year, month] = dateString.split('-');
  if (!year || !month) return dateString;
  
  const monthNum = parseInt(month);
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December'];
  
  switch(format) {
    case 'short':
      return `${monthNum}/${year}`;
    case 'full':
      return `${monthNames[monthNum - 1]} ${year}`;
    case 'year':
      return year;
    default:
      return `${monthNum}/${year}`;
  }
}
export default function CareerDetailPage() {
  const router = useRouter();
  const supabase = createClient();
  
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  
 // Flow state
  const [resumeId, setResumeId] = useState(null);
  
  // Resume data (following RESUME_DATA_STRUCTURE_REFERENCE.md)
  const [resumeData, setResumeData] = useState({
    fullName: "",
    email: "",
    phone: "",
    location: "",
    linkedin: "",
    portfolio: "",
    summary: "",
    hideSummary: false,
    experience: [],
    education: [],
    skills: [],
    skillsCategories: {},
    projects: [],
    certifications: [],
    volunteer: [],
    languages: [],
    sectionOrder: ["experience", "education", "skills"]
  });
  
const handleResumeUpdate = async (updatedData) => {
  // Update local state immediately
  setResumeData(updatedData);
  
  // Save to database
  if (resume?.id) {
    try {
      const { error } = await supabase
        .from('resumes')
        .update({ 
          resume_data: updatedData,
          updated_at: new Date().toISOString()
        })
        .eq('id', resume.id);
      
      if (error) {
        console.error('Error saving resume:', error);
      }
    } catch (err) {
      console.error('Error updating resume:', err);
    }
  }
};

// Career conversation state
  const [messages, setMessages] = useState([]);
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [userInput, setUserInput] = useState('');
  
 // Refs for auto-scroll and auto-focus
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const previousMessageCount = useRef(0);
  
  // Initial focus on mount (without scrolling)
  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);
  
  // Auto-scroll only after user sends first message
  useEffect(() => {
    const hasUserMessage = messages.some(m => m.role === 'user');
    if (hasUserMessage && messages.length > previousMessageCount.current && previousMessageCount.current > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      // Re-focus after scroll
      setTimeout(() => {
        inputRef.current?.focus({ preventScroll: true });
      }, 100);
    }
    previousMessageCount.current = messages.length;
  }, [messages]);

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/dashboard');
        return;
      }
      setUser(user);

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      setUserProfile(profile);

      // Check for resumeId in URL
      const params = new URLSearchParams(window.location.search);
      const urlResumeId = params.get('resumeId');
      
    if (urlResumeId) {
        // Load resume from database
        const { data: resume } = await supabase
          .from('resumes')
          .select('*')
          .eq('id', urlResumeId)
          .single();
        
  if (resume) {
          setResumeId(urlResumeId);
          setResumeData(resume.resume_data);
          startCareerConversation(resume.resume_data);
        }
      } else {
        // No resume ID - redirect back to My Career
        router.push('/career-coach');
        return;
      }

      setLoading(false);
    }
    loadData();
  }, [supabase, router]);

  // Handle file upload
  const handleUpload = async (file) => {
    // TODO: Call parse API
    // For now, set mode to conversation (skip to career questions)
    console.log('Upload file:', file.name);
    
    // Placeholder: Would parse PDF/DOCX here
    // const parsed = await parseResume(file);
    // setResumeData(parsed);
    
    setMode('conversation');
    startCareerConversation();
  };

  // Handle build from scratch
  const handleStartBuild = () => {
    setMode('build');
  };

// Handle builder completion
  const handleBuilderComplete = () => {
    console.log('Builder complete, moving to career conversation');
    setMode('conversation');
    startCareerConversation();
  };

// Start career conversation
  const startCareerConversation = (data = resumeData) => {
    // Extract current role from resume
    const experience = data?.experience || [];
    const currentJob = experience[0];
    const currentRole = currentJob?.title;
    const currentCompany = currentJob?.company;
    
// Get user's first name if available
    const firstName = userProfile?.display_name?.split(' ')[0] || data?.fullName?.split(' ')[0] || 'there';
    
    let openingMessage = `Hi ${firstName}! Let's talk about your career goals! This conversation helps me create a resume targeted to where you want to go - not just where you've been. The more specific you can be, the stronger your resume becomes.\n\n`;
    
    if (currentRole && currentCompany) {
      openingMessage += `I can see you're currently ${currentRole} at ${currentCompany}. `;
    }
    
    openingMessage += `Are you looking to advance in this field, or are you interested in exploring a different direction?`;    
    setMessages([
      {
        role: 'assistant',
        content: openingMessage
      }
    ]);
  };
 // Handle conversation message
 const [isConversationComplete, setIsConversationComplete] = useState(false);
  const [mobilePanel, setMobilePanel] = useState('conversation');

  const handleSendMessage = async (message) => {
    // Add user message
    const newMessages = [...messages, { role: 'user', content: message }];
    setMessages(newMessages);
    setIsAIThinking(true);

    try {
      const response = await fetch('/api/career-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: newMessages, 
          resumeData: resumeData,
          userId: user?.id 
        })
      });
      
      const data = await response.json();
      
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: data.response
        }
      ]);
      
      // Check if conversation is complete
      if (data.isComplete) {
        setIsConversationComplete(true);
      }
      
      setIsAIThinking(false);
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: "Something went wrong. Please try sending your message again." }]);
      setIsAIThinking(false);
    }
  };
  // Handle career conversation completion
 const handleConversationComplete = async () => {
    // Career context already saved by API
    // Redirect to My Resumes
    router.push('/resume-coach');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-purple-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const breadcrumbItems = [
    { label: 'Career Coach', path: '/career-coach' },
    { label: 'Career Conversation' }
  ];

 return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <MainNav currentPage="career-coach" userProfile={userProfile} />
      <div className="hidden md:block">
        <Breadcrumb items={breadcrumbItems} />
      </div>

      {/* Mobile toggle */}
      <div className="md:hidden flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-200 flex-shrink-0">
        <button
          onClick={() => setMobilePanel('conversation')}
          className="flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors"
          style={{
            color: mobilePanel === 'conversation' ? '#7c3aed' : '#6b7280',
            backgroundColor: mobilePanel === 'conversation' ? 'rgba(147, 51, 234, 0.08)' : 'transparent'
          }}
        >
          Conversation
        </button>
        <button
          onClick={() => setMobilePanel('resume')}
          className="flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors"
          style={{
            color: mobilePanel === 'resume' ? '#7c3aed' : '#6b7280',
            backgroundColor: mobilePanel === 'resume' ? 'rgba(147, 51, 234, 0.08)' : 'transparent'
          }}
        >
          Resume
        </button>
      </div>

{/* Conversation Mode */}
      {resumeId && (
        <div className="flex-1 flex overflow-hidden" style={{ height: 'calc(100vh - 160px)' }}>
          <div className="flex-1 flex gap-6 p-0 md:p-6 max-w-7xl mx-auto w-full">
            {/* Left Column - Resume (70-75% width) */}
            <div className={`flex-[3] bg-gray-100 md:bg-transparent md:rounded-lg md:shadow-sm md:border md:border-gray-200 overflow-y-auto ${mobilePanel === 'resume' ? 'block' : 'hidden'} md:block`}>
              <div className="mx-3 my-3 bg-white shadow-sm rounded md:mx-0 md:my-0 md:shadow-none md:rounded-none md:p-8 p-4">
                <ResumeContent 
                 resumeData={resumeData}
  onUpdate={handleResumeUpdate}
  formatDate={formatDate}
  readOnly={false}
                />
              </div>
            </div>

{/* Right Column - Conversation (25-30% width) */}
            <div className={`flex-1 bg-white md:rounded-lg md:shadow-sm md:border md:border-gray-200 flex flex-col overflow-hidden ${mobilePanel === 'conversation' ? 'flex' : 'hidden'} md:flex`}>
            {/* Progress Section - STICKY */}
              <div className="sticky top-0 bg-white z-10 p-4 md:p-6 pb-4 mb-4 border-b border-gray-200">
                <h3 className="text-center font-semibold text-sm mb-3">
                  {userProfile?.display_name ? `${userProfile.display_name.split(' ')[0]}'s ` : ''}Career Conversation
                </h3>                
                <div className="relative">
                  {/* Progress line */}
                  <div className="absolute top-3 left-0 right-0 h-0.5 bg-gray-300">
                    <div 
                      className="h-full bg-purple-600 transition-all duration-300"
                      style={{ width: `${Math.min((messages.length / 20) * 100, 95)}%` }}
                    />
                  </div>
                  
                  {/* Steps */}
                  <div className="relative flex justify-between">
                    {['Background', 'Goals', 'Timeline', 'Skills'].map((step, index) => {
                      const isComplete = messages.length >= (index + 1) * 5;
                      const isCurrent = messages.length >= index * 5 && messages.length < (index + 1) * 5;
                      
                      return (
                        <div key={step} className="flex flex-col items-center">
                          <div className={`
                            w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold z-10
                            ${isComplete ? 'bg-purple-600 text-white' : 
                              isCurrent ? 'bg-purple-600 text-white' : 
                              'bg-white border-2 border-gray-300 text-gray-400'}
                          `}>
                            {isComplete ? '✓' : isCurrent ? '●' : '○'}
                          </div>
                          <span className={`text-xs mt-1 ${
                            isCurrent ? 'text-purple-600 font-semibold' :
                            isComplete ? 'text-purple-600' :
                            'text-gray-400'
                          }`}>
                            {step}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

                     {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 md:px-6"><div className="space-y-3 mb-1">
              {messages.map((msg, index) => (
                  <div key={index}>
                    {msg.role === 'assistant' ? (
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xl">🎓</span>
                          <p className="text-xs font-semibold text-gray-700">Career Coach</p>
                        </div>
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-3">
                          <div className="text-gray-800 whitespace-pre-line text-xs">
                            {msg.content}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-3 justify-end mb-3">
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 max-w-[75%]">
                          <p className="text-xs font-semibold text-gray-700 mb-1">
                            {userProfile?.display_name || 'You'}
                          </p>
                          <div className="text-gray-800 whitespace-pre-line text-xs">
                            {msg.content}
                          </div>
                        </div>
                    
                 {userProfile?.photo_url ? (
                          <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-purple-200 flex-shrink-0">
                            <img
                              src={userProfile.photo_url}
                              alt="You"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-sm font-bold flex-shrink-0">
                            {userProfile?.display_name?.charAt(0).toUpperCase() || 'U'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                
             {isAIThinking && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">🎓</span>
                      <p className="text-xs font-semibold text-gray-700">Career Coach</p>
                    </div>
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-3">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                      </div>
                    </div>
                  </div>
              )}
                {messages.some(m => m.role === 'user') && <div ref={messagesEndRef} />}
              </div></div>
              {/* Input & Button */}
            {isConversationComplete ? (
                <div className="flex justify-center border-t pt-4 pb-4">
                  <button
                    onClick={handleConversationComplete}
                    className="text-white py-2 px-8 rounded-lg transition-opacity hover:opacity-90 font-semibold text-xs"
                    style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
                  >
                    Continue to Resume Coach →
                  </button>
                </div>
              ) : (
              <div className="sticky bottom-0 bg-white border-t pt-3 pb-4 px-4 md:px-6">
                  <div className="flex gap-2 items-center">
                    <textarea
                      ref={inputRef}
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(userInput);
                          setUserInput('');
                        }
                      }}
                      placeholder="Type your response..."
                      disabled={isAIThinking}
                      rows={2}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                    />
                    <button
                      onClick={() => {
                        handleSendMessage(userInput);
                        setUserInput('');
                      }}
                      disabled={!userInput.trim() || isAIThinking}
                      className="bg-purple-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors self-center flex-shrink-0"
                    >
                      Send
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
