'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

// items: [{ label, path?, options?: [{ label, path, current? }] }]
// An item with options renders a ▾ toggle that opens a dropdown of sibling
// destinations. Callers either leave the current page out of its own options
// or mark it with current: true, which shows it checked and unclickable.
export default function Breadcrumb({ items }) {
  const router = useRouter();
  const [openIndex, setOpenIndex] = useState(null);
  // Tracks the open crumb's trigger and menu, not the whole bar. Scoping this
  // to the bar would count the empty width beside the crumbs as "inside" and
  // leave the menu open when you click there to dismiss it.
  const openItemRef = useRef(null);

  // A dropdown left hanging open would float over the page while the user is
  // working somewhere else, so close it on any click outside and on Escape.
  useEffect(() => {
    if (openIndex === null) return;

    const handlePointerDown = (event) => {
      if (openItemRef.current && !openItemRef.current.contains(event.target)) {
        setOpenIndex(null);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpenIndex(null);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openIndex]);

  return (
    <div className="bg-white border-b border-gray-200 sticky top-[57px] z-40">
      <div className="max-w-7xl mx-auto px-6 py-1.5 flex items-center text-xs">
        {items.map((item, index) => {
          const options = Array.isArray(item.options) ? item.options : [];
          const hasDropdown = options.length > 0;
          // Only a menu that flags its current entry gets the check column. Menus
          // that do not (job-specific resumes, cover letters) render as before.
          const marksCurrent = options.some((option) => option.current);
          // The last crumb is the page you are on, so it keeps the purple pill.
          const isCurrent = index === items.length - 1;
          const isOpen = openIndex === index;

          const toggle = () => setOpenIndex(isOpen ? null : index);

          const triggerClass = isCurrent
            ? 'text-purple-700 font-semibold rounded-md px-3 py-1 inline-flex items-center gap-1'
            : 'text-gray-600 hover:text-purple-600 inline-flex items-center gap-1';
          const triggerStyle = isCurrent ? { backgroundColor: 'rgba(147, 51, 234, 0.08)' } : undefined;

          const arrow = (
            <span
              aria-hidden="true"
              className={`text-sm text-purple-500 leading-none transition-transform ${isOpen ? 'rotate-180' : ''}`}
            >
              ▾
            </span>
          );

          return (
            <span key={index} className="flex items-center">
              {index > 0 && <span className="mx-2 text-gray-400">|</span>}

              {hasDropdown ? (
                <span className="relative" ref={isOpen ? openItemRef : null}>
                  {item.path ? (
                    // Both a destination and a menu: the label still navigates,
                    // the arrow alone opens the dropdown.
                    <span className={triggerClass} style={triggerStyle}>
                      <button
                        type="button"
                        onClick={() => router.push(item.path)}
                        className="hover:text-purple-600"
                      >
                        {item.label}
                      </button>
                      <button
                        type="button"
                        onClick={toggle}
                        aria-haspopup="true"
                        aria-expanded={isOpen}
                        aria-label={`More destinations for ${item.label}`}
                        className="hover:text-purple-600"
                      >
                        {arrow}
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={toggle}
                      aria-haspopup="true"
                      aria-expanded={isOpen}
                      className={triggerClass}
                      style={triggerStyle}
                    >
                      {item.label}
                      {arrow}
                    </button>
                  )}

                  {isOpen && (
                    <div className="absolute left-0 top-full mt-1 z-50 min-w-[11rem] max-w-[18rem] bg-white border border-gray-200 rounded-md shadow-lg py-1">
                      {options.map((option, optionIndex) => (
                        <button
                          key={option.path || optionIndex}
                          type="button"
                          onClick={() => {
                            setOpenIndex(null);
                            // The current entry is in the list so it can be seen, not
                            // so it can be navigated to.
                            if (!option.current) router.push(option.path);
                          }}
                          aria-current={option.current ? 'page' : undefined}
                          className={
                            marksCurrent
                              ? `flex w-full items-center gap-1.5 text-left px-3 py-1.5 text-xs ${option.current ? 'text-purple-700 font-semibold' : 'text-gray-700 hover:bg-gray-50 hover:text-purple-600'}`
                              : "block w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 hover:text-purple-600 truncate"
                          }
                        >
                          {marksCurrent && (
                            <span aria-hidden="true" className={option.current ? 'text-purple-600' : 'invisible'}>✓</span>
                          )}
                          {marksCurrent ? <span className="truncate">{option.label}</span> : option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </span>
              ) : item.path ? (
                <button
                  onClick={() => router.push(item.path)}
                  className="text-gray-600 hover:text-purple-600"
                >
                  {item.label}
                </button>
              ) : isCurrent ? (
                <span
                  className="text-purple-700 font-semibold rounded-md px-3 py-1"
                  style={{ backgroundColor: 'rgba(147, 51, 234, 0.08)' }}
                >
                  {item.label}
                </span>
              ) : (
                <span className="text-gray-600">{item.label}</span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
