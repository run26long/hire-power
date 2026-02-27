'use client';

import { useState, useRef, useEffect } from 'react';

/**
 * ConversationPanel Component
 * 
 * Reusable conversation interface for all coaches (Career, Resume, Interview)
 * Handles message display, input, and conversation state
 */

export default function ConversationPanel({
  messages = [],           // Array of {role: 'assistant'|'user', content: string}
  onSendMessage,          // Function to handle sending messages
  placeholder = "Type your response...",
  isLoading = false,      // Show loading state while AI responds
  disabled = false,       // Disable input
  headerContent = null,   // Optional content above messages (instructions, progress, etc.)
  footerContent = null    // Optional content below input (tips, buttons, etc.)
}) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

 // Auto-scroll to bottom when messages change (but not on initial load)
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]); // Only trigger when length changes, not initial render

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading || disabled) return;
    
    onSendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Optional Header Content */}
      {headerContent && (
        <div className="mb-4 pb-4 border-b border-gray-200">
          {headerContent}
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto mb-4 space-y-4">
        {messages.map((message, index) => (
          <div key={index} className={`${message.role === 'assistant' ? '' : 'ml-4'}`}>
            <div className={`rounded-lg p-3 ${
              message.role === 'assistant' 
                ? 'bg-purple-50 border border-purple-100' 
                : 'bg-gray-50 border border-gray-200'
            }`}>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}
        
        {/* Loading Indicator */}
        {isLoading && (
          <div className="rounded-lg p-3 bg-purple-50 border border-purple-100">
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
              <span className="text-sm text-gray-600">Thinking...</span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Optional Footer Content */}
      {footerContent && (
        <div className="mb-4 pt-4 border-t border-gray-200">
          {footerContent}
        </div>
      )}

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed text-sm"
        />
        <button
          type="submit"
          disabled={!input.trim() || disabled || isLoading}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all font-medium text-sm"
        >
          Send
        </button>
      </form>
    </div>
  );
}
