'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

// ============================================================================
// THE PARTS EVERY MANAGE PANEL SHARES
//
// There is no single dialog component behind these panels, which is the first
// thing to know about this file. Proof points and Testimonials open on
// ProfileModal, Evidence opens inside EvidenceOverlay, Portfolio inside
// PortfolioLightbox, and the testimonial review has a portal of its own. Four
// shells, each with its own head, its own close button and its own Escape.
//
// What they genuinely share is the body: `.hp-manage`. So that is where the
// two things here live, and that is how "once, for every panel" is actually
// achieved - the footer is pinned by rules on `.hp-manage` in sections.css,
// and the question below is asked by one component that any of them can
// render. Nothing is implemented per panel and nothing is styled per panel.
//
// ---------------------------------------------------------------------------
// WHY A BAR AND NOT A SECOND DIALOG
//
// The thing being protected is a panel full of unsaved work. A second modal
// over the first would cover it, which means answering "do you want to keep
// these changes" without being able to see them - and on a phone it would
// cover it entirely. The bar sits inside the panel it belongs to, in the
// footer's own place, so the work is still on screen while the question is
// being answered.
//
// It is not window.confirm either. That blocks the whole tab, cannot be
// styled, reads as a browser warning rather than as part of this product, and
// on some platforms puts the destructive choice where the safe one usually
// goes.
//
// IT TAKES THE FOOTER'S PLACE RATHER THAN STACKING ABOVE IT
// Sitting above the footer meant two rows of buttons at once, with Save in one
// and Discard in the other and no order between them - five controls for a
// question with three answers. So the footer gives way to it: the panel has
// one row of buttons at any moment, and while the question is up that row is
// the answer to it.
//
// THE THIRD ANSWER
// "Keep editing" and "Discard" are the two the owner is being offered, but
// neither is what most people actually want at this point: they pressed the X
// because they were finished, and they have changes worth keeping. So the way
// out WITH the work is on the bar too, carrying the primary treatment, and the
// two that cost something stand to its left in the order they cost - Discard
// furthest from the thumb heading for the corner.
// ---------------------------------------------------------------------------

/**
 * Standing between a panel's close and the panel actually closing.
 *
 * `dirty` is the panel's own answer to "is there anything here that the owner
 * would be sorry to lose". A panel that writes each change as it happens -
 * Evidence, Portfolio and Testimonials all do - passes false and this becomes
 * a pass-through, which is exactly what it should be: there is nothing to ask
 * about, and a panel that asked anyway would be lying about its own state.
 *
 * `requestClose` is what every way out should be wired to: the shell's X, its
 * Escape, its backdrop, and the panel's own Cancel. One function, so the four
 * of them cannot come to disagree about which is guarded.
 *
 * NOT EVERY WAY OUT GOES TO THE SAME PLACE
 * In a Manage panel they do: the X, Escape, the backdrop and Cancel all close
 * the dialog, so `onClose` is the whole answer. In an edit pane they do not -
 * Cancel goes back to the list the pane was opened from and the X closes the
 * dialog around both - and a Discard that always did the one thing would send
 * somebody who pressed Cancel out of the dialog entirely.
 *
 * So `requestClose` takes the exit that asked, and Discard runs that one. It
 * is also used directly as an onClick handler, where React hands it an event:
 * anything that is not a function falls back to `onClose`, which is what a
 * shell's own X passes anyway (nothing).
 *
 * `onSave` is the panel's own Save, unchanged and unwrapped - the same
 * function its footer calls. Save and close is not a second save path with its
 * own idea of what valid means; it is that one, which is why a panel that
 * refuses to save for a reason of its own refuses this too.
 */
export function useUnsavedGuard({ dirty, onClose, onSave }) {
  const [asking, setAsking] = useState(false)
  // Which way out is waiting on an answer. A ref rather than state: nothing
  // renders differently for one exit or the other, and it is only ever read in
  // a handler.
  const exitRef = useRef(null)

  const requestClose = useCallback((exit) => {
    const leave = typeof exit === 'function' ? exit : onClose
    if (!dirty) { setAsking(false); leave?.(); return }
    exitRef.current = leave
    setAsking(true)
  }, [dirty, onClose])

  const keepEditing = useCallback(() => setAsking(false), [])

  const discard = useCallback(() => {
    const leave = exitRef.current || onClose
    exitRef.current = null
    setAsking(false)
    leave?.()
  }, [onClose])

  // The bar stands down first, then the panel's own Save runs. Both outcomes
  // want it gone: a save that works closes the panel, and a save that is
  // refused has something to say about a field somewhere above - which is the
  // panel's normal state, with its normal footer and its own error on screen,
  // not a question about leaving.
  const saveAndClose = useCallback(async () => {
    const leave = exitRef.current
    exitRef.current = null
    setAsking(false)
    const ok = await onSave?.()
    // A panel's save closes the panel itself when it lands. A pane's save goes
    // back to the list it was opened from, which is not necessarily where the
    // owner was heading - they may have pressed the X. So where an exit was
    // waiting and the save reported success, it is run as well. Panels pass no
    // exit and return nothing, so for them this is the no-op it always was.
    if (leave && ok === true) leave()
  }, [onSave])

  // For the panel's own open: a question left standing from last time is not a
  // question about this time.
  const reset = useCallback(() => setAsking(false), [])

  return {
    // Guarded against the panel's own state as well as its own: a save that
    // lands while this is up takes the question away with the changes.
    asking: asking && dirty,
    requestClose,
    keepEditing,
    discard,
    saveAndClose,
    reset
  }
}

// ---------------------------------------------------------------------------
// THE SAME QUESTION, ACROSS A MODAL BOUNDARY
//
// The Manage panels hold their own unsaved work, so the guard and the bar live
// in one component. The edit panes do not: the pane is the body of a modal
// whose X, Escape and backdrop belong to the section that opened it, several
// components up. Guarding them means the section has to know whether the form
// inside is dirty and how to save it, and the form is the only thing that
// knows either.
//
// So the pair below. The section holds the guard - usePaneGuard - and hands
// the pane one stable object; the pane reports what it has and what to do
// about it - usePaneReport - and renders the bar from the same guard. One
// guard, one bar, no second idea of what dirty means.
//
// WHY THE REPORT IS AN EFFECT
// Because a child cannot set a parent's state during render. The effect runs
// after the keystroke that changed the answer, which is a frame later than the
// change and well before any press on a way out.
// ---------------------------------------------------------------------------

/**
 * The host half: the guard, plus the `bind` to hand the pane.
 *
 * `dirty` starts false and stays false until a pane says otherwise, so a
 * section with no pane open - or a pane with nothing typed into it - closes
 * immediately, exactly as before.
 */
export function usePaneGuard({ onClose }) {
  const [dirty, setDirty] = useState(false)
  const saveRef = useRef(null)

  const runSave = useCallback(() => saveRef.current?.(), [])
  const guard = useUnsavedGuard({ dirty, onClose, onSave: runSave })

  // Stable for the life of the host, so the pane's reporting effect does not
  // re-run on every render of the section around it.
  const bind = useMemo(() => ({
    report: (isDirty, save) => {
      setDirty(isDirty === true)
      saveRef.current = typeof save === 'function' ? save : null
    }
  }), [])

  return { ...guard, bind }
}

/**
 * The pane half. Reports whether there is unsaved work and how to save it.
 *
 * `save` must resolve to true when it worked, because that is what decides
 * whether Save and close goes on to leave. The panes' own `run` helper returns
 * exactly that.
 *
 * The cleanup matters as much as the report: a pane that unmounts has nothing
 * unsaved any more, so going back to the list clears the question rather than
 * leaving the section thinking a form it no longer shows is dirty.
 */
export function usePaneReport(bind, dirty, save) {
  const saveRef = useRef(save)
  useEffect(() => { saveRef.current = save })

  useEffect(() => {
    if (!bind) return undefined
    bind.report(dirty, () => saveRef.current?.())
    return () => bind.report(false, null)
  }, [bind, dirty])
}

/**
 * The question itself. Rendered INSTEAD OF a panel's footer, in the same place
 * that footer stands - which is what `.hp-manage-unsaved` is positioned for -
 * so a panel swaps one for the other and nothing else.
 *
 * `onSave` is optional. Without it the bar is the two answers it has always
 * carried; a panel that can save from here passes its Save and gets the third.
 */
export function UnsavedBar({ onKeep, onDiscard, onSave, saveLabel = 'Save and close' }) {
  return (
    <div className="hp-manage-unsaved" role="alertdialog" aria-label="Unsaved changes">
      <p className="hp-manage-unsaved-text">You have unsaved changes.</p>
      <div className="hp-manage-unsaved-acts">
        <button type="button" className="hp-manage-secondary" onClick={onDiscard}>
          Discard
        </button>
        <button type="button" className="hp-manage-secondary" onClick={onKeep}>
          Keep editing
        </button>
        {onSave ? (
          <button type="button" className="hp-manage-done" onClick={onSave}>
            {saveLabel}
          </button>
        ) : null}
      </div>
    </div>
  )
}
