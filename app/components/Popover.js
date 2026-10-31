'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// ============================================================================
// A SMALL EXPLANATION, ON CLICK
//
// For the thing beside a number that answers "why does this say three when I
// can only see one". Click to open; the X, a click anywhere else, or Escape
// closes it - the same gestures the breadcrumb switcher and the Career
// Profile's skill tiles already use, because they are the ones everybody
// already knows.
//
// WHY CLICK AND NOT HOVER
// There is no hover on a phone, and this is the kind of sentence somebody
// wants to read twice. A tooltip that vanishes when the pointer drifts is a
// sentence you have to earn twice.
//
// WHY IT IS PORTALLED TO THE BODY
//
// It was absolutely positioned inside the panel, and the panel carries
// `overflow-hidden` - it is a flex column that has to clip its own list, so
// that class is not going anywhere. An absolutely positioned child of a
// clipping ancestor is clipped by it, whatever its z-index, so the right-hand
// panel cut the card off at its own edge every time.
//
// Moving the panel's overflow would be fixing the wrong thing: a popover is
// not part of the panel's content, it is a layer over the page. So it renders
// into the body with `position: fixed`, which no ancestor can clip, and its
// coordinates are measured from the trigger each time it opens. The same
// reason the evidence viewer on the Career Profile is mounted on the body
// rather than inside .hp-profile.
//
// WHY THE POSITION IS WRITTEN RATHER THAN HELD IN STATE
// The measurement is of the card that has just been laid out, so turning it
// into a render would be a second pass to reach the same pixels, and a state
// the nudge fed back into would be a loop waiting to happen. The same approach
// TourReplayButton's tip takes.
// ============================================================================

// One fixed width for every popover, so two of them on one screen are the
// same object. It is never narrowed to fit: narrowing would make the one with
// the longer sentence a different shape from the one beside it, which is the
// thing the fixed width is for. When there is no room it moves instead - see
// the clamp in the effect below.
const PANEL_WIDTH = 248;
const GAP = 8;
const MARGIN = 8;

/**
 * @param {string}    label     what the trigger is for, read by screen readers
 * @param {ReactNode} children  the sentence inside the panel
 * @param {'top'|'bottom'} placement  preferred side; flips when there is no room
 */
export default function Popover({ label = 'More information', children, placement = 'top' }) {
  const [open, setOpen] = useState(false);
  // The portal can only be built once there is a document to put it in.
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => setMounted(true), []);

  // Anywhere outside closes it, Escape closes it and puts focus back. The
  // trigger and the panel are in different parts of the tree now, so both are
  // tested rather than one shared wrapper.
  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (triggerRef.current?.contains(event.target)) return;
      if (panelRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // Which side has the room, and where the card sits. Clamped into the
  // viewport on both axes, so the right-hand column cannot push it off screen
  // and a short window cannot put it under the fold.
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;

    const rect = trigger.getBoundingClientRect();
    const height = panel.offsetHeight;
    const width = panel.offsetWidth || PANEL_WIDTH;

    const above = rect.top >= height + GAP + MARGIN;
    const below = window.innerHeight - rect.bottom >= height + GAP + MARGIN;
    const side = placement === 'bottom'
      ? (below || !above ? 'bottom' : 'top')
      : (above || !below ? 'top' : 'bottom');

    const clamp = (v, min, max) => Math.max(min, Math.min(v, Math.max(min, max)));
    const left = clamp(rect.left + rect.width / 2 - width / 2, MARGIN, window.innerWidth - width - MARGIN);
    const top = side === 'top'
      ? clamp(rect.top - GAP - height, MARGIN, window.innerHeight - height - MARGIN)
      : clamp(rect.bottom + GAP, MARGIN, window.innerHeight - height - MARGIN);

    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(top)}px`;
    panel.style.visibility = 'visible';
  }, [open, placement]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
        className="w-4 h-4 rounded-full border border-gray-300 bg-white text-gray-400 text-[10px] font-bold leading-none flex items-center justify-center hover:border-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
      >
        ?
      </button>

      {open && mounted && createPortal(
        <div
          ref={panelRef}
          role="tooltip"
          onClick={(e) => e.stopPropagation()}
          // Hidden until the effect above has placed it, so it never paints
          // once in the wrong place and then jumps.
          style={{ position: 'fixed', width: PANEL_WIDTH, visibility: 'hidden', zIndex: 10001 }}
          className="bg-white border border-gray-200 rounded-lg shadow-lg pl-3 pr-8 py-2.5 text-xs text-gray-600 leading-snug text-left font-normal normal-case tracking-normal"
        >
          {/* The app's close control on a light ground, the same one the resume
              and cover letter editors' tip cards use. */}
          <button
            type="button"
            onClick={() => { setOpen(false); triggerRef.current?.focus(); }}
            aria-label="Close"
            className="absolute top-2 right-2 z-10 w-7 h-7 flex items-center justify-center rounded-full text-gray-600 hover:text-gray-900 text-xl leading-none font-light"
          >
            ×
          </button>
          {children}
        </div>,
        document.body
      )}
    </>
  );
}
