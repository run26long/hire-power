'use client'

import { useEffect, useRef, useState } from 'react'
import { useProfileEdit, useFieldEditor, useCanEdit } from '../_lib/editContext'
import ImowVideoField from './ImowVideoField'

// ============================================================================
// IN MY OWN WORDS, EDITED
//
// The one section of the profile written in the first person, and the only one
// that belongs to the person rather than to a direction: there is one of these
// per profile, and it does not change when the reader changes chapter.
//
// THE DRAFT IS NEVER SAVED BY THE THING THAT WROTE IT
// Generate puts words in the textarea and stops. The route it calls has no
// write in it at all - not a flag, not a branch, nothing to get backwards -
// and the existing Save is the only thing that stores anything. A section
// whose whole purpose is sounding like the person should never have reached
// their profile without them reading it first.
//
// WHICH IS ALSO WHY REPLACING ASKS
// A draft overwrites whatever is in the editor. What is stored is untouched
// either way, and the question says so, because "will this destroy my saved
// text" is the thing somebody is actually worried about when they click it.
//
// STRENGTHEN DOES NOT ASK, BECAUSE IT DOES NOT REPLACE
// It puts the two versions side by side and waits. Generate writes from the
// coaching sessions and has to overwrite to do anything at all; this takes
// what is already in the editor and offers a tighter reading of it, and the
// only sensible way to offer that is with the original still on screen to
// compare it against. Keep what I wrote is a real button, not a cancel.
// ============================================================================

const MAX = 2000

// Long enough to hold five sentences without the textarea becoming the page.
const ROWS = 9

export default function ImowEditor({ value }) {
  const edit = useProfileEdit()
  const editor = useFieldEditor('imow')
  const canEdit = useCanEdit()

  const [draft, setDraft] = useState(value || '')
  const [generating, setGenerating] = useState(false)
  const [strengthening, setStrengthening] = useState(false)
  // The polished version, held beside the draft rather than over it. Non-null
  // is the whole compare state: the textarea stands down and the two readings
  // are shown until one of them is chosen.
  const [polished, setPolished] = useState(null)
  const [note, setNote] = useState(null)
  const ref = useRef(null)

  const isOpen = editor?.isOpen === true

  // Also the way back from the compare view: the textarea is unmounted while
  // the two versions are up, so nothing can focus it until React has put it
  // back, and calling focus() from the button handler would reach a ref that
  // is still null.
  useEffect(() => {
    if (!isOpen || polished) return
    const node = ref.current
    if (!node) return
    node.focus()
    node.setSelectionRange(node.value.length, node.value.length)
  }, [isOpen, polished])

  useEffect(() => {
    if (!isOpen) return
    function onKey(event) {
      if (event.key === 'Escape') { event.stopPropagation(); editor.close() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, editor])

  // Nothing on a locked plan can open this, because the pencil and the
  // empty state are both gone. Guarded here too, so the editor cannot be
  // reached by any future path that forgets.
  if (!editor || !isOpen || !canEdit) return null

  const trimmed = draft.trim()
  const busy = editor.busy || generating || strengthening
  // A decision is on screen and has not been made. Nothing that would change
  // the draft underneath it should be reachable while it is.
  const choosing = Boolean(polished)

  async function generate() {
    if (busy) return
    // Asked only when there is something to lose, and worded so the answer to
    // "does this touch what I saved" is in the question.
    if (trimmed) {
      const ok = window.confirm(
        'Replace what is in the editor with a new draft?\n\n' +
        'Your saved version is not affected until you press Save.'
      )
      if (!ok) return
    }
    setGenerating(true)
    setNote(null)
    try {
      const result = await edit.onGenerateImow()
      setDraft(result?.imow_text || '')
      setNote('A draft, written from your coaching sessions. Read it, change anything, then save.')
      ref.current?.focus()
    } catch (err) {
      notifyFailure(err?.message || "We couldn't write a draft just now. Please try again.")
    } finally {
      setGenerating(false)
    }
  }

  // The page's toast rather than the note under the textarea. That note is
  // where this editor says what just happened to the draft; a failure is not
  // that, and every other failure on this page is already a toast.
  function notifyFailure(message) {
    if (edit?.notify) edit.notify({ type: 'error', message })
    else setNote(message)
  }

  async function strengthen() {
    if (busy || !trimmed) return
    setStrengthening(true)
    setNote(null)
    try {
      const result = await edit.onStrengthenImow(trimmed)
      const next = result?.imow_text || ''
      // A polish that comes back identical is a real answer - the passage was
      // already tight - and two identical columns would be a worse way of
      // saying so than a sentence.
      if (!next || next === trimmed) {
        setNote('This already reads well. Nothing worth changing.')
        return
      }
      setPolished(next)
    } catch (err) {
      notifyFailure(err?.message || "We couldn't do that just now. Please try again.")
    } finally {
      setStrengthening(false)
    }
  }

  function keepPolished() {
    setDraft(polished)
    setPolished(null)
    setNote('Using the tightened version. Change anything, then save.')
  }

  function keepOriginal() {
    setPolished(null)
  }

  return (
    <div className="hp-ed-editor" role="group" aria-label="Editing In My Own Words">
      {polished ? (
        <div className="hp-ed-compare">
          <p className="hp-ed-compare-lede">
            The same thing you wrote, read back tighter. Nothing has been added, and
            nothing is saved until you choose.
          </p>

          <div className="hp-ed-compare-pair">
            <section className="hp-ed-compare-side">
              <h4 className="hp-ed-compare-title">What you wrote</h4>
              <p className="hp-ed-compare-text">{draft}</p>
              <button type="button" className="hp-ed-action" onClick={keepOriginal}>
                Keep what I wrote
              </button>
            </section>

            <section className="hp-ed-compare-side" data-suggested="true">
              <h4 className="hp-ed-compare-title">Tightened</h4>
              <p className="hp-ed-compare-text">{polished}</p>
              <button
                type="button"
                className="hp-ed-action"
                data-primary="true"
                onClick={keepPolished}
              >
                Use this
              </button>
            </section>
          </div>
        </div>
      ) : (
        <textarea
          ref={ref}
          className="hp-ed-textarea"
          data-size="body"
          rows={ROWS}
          value={draft}
          maxLength={MAX}
          onChange={e => setDraft(e.target.value)}
          aria-label="In My Own Words"
          placeholder="What drives you, what you believe about the work, and what the numbers do not show."
          spellCheck="true"
        />
      )}

      <p className="hp-ed-proof-note">
        {trimmed.length} of {MAX} characters.
        {' '}This is the one part of the profile in your own voice.
      </p>

      {note ? <p className="hp-ed-add-note">{note}</p> : null}

      <div className="hp-ed-editor-bar">
        <button
          type="button"
          className="hp-ed-action"
          data-primary="true"
          onClick={() => editor.save({ imow_text: trimmed })}
          disabled={!trimmed || trimmed === (value || '').trim() || busy || choosing}
        >
          {editor.busy ? 'Saving…' : 'Save'}
        </button>

        <button type="button" className="hp-ed-action" onClick={editor.close} disabled={busy}>
          Cancel
        </button>

        {edit.onGenerateImow && editor.canRegenerate ? (
          <button
            type="button"
            className="hp-ed-action"
            onClick={generate}
            disabled={busy || choosing}
            title="Write a first draft from your coaching sessions"
          >
            {generating ? <span className="hp-ed-spin" aria-hidden="true" /> : null}
            {generating ? 'Writing…' : 'Generate draft'}
          </button>
        ) : null}

        {/* Only once there is something to strengthen. On an empty editor
            there is nothing for it to act on, and Generate draft is the
            button that belongs there instead. */}
        {edit.onStrengthenImow && editor.canRegenerate && trimmed ? (
          <button
            type="button"
            className="hp-ed-action"
            onClick={strengthen}
            disabled={busy || choosing}
            title="Tighten what you have written without changing what it says"
          >
            {strengthening ? <span className="hp-ed-spin" aria-hidden="true" /> : null}
            {strengthening ? 'Reading…' : 'Strengthen my draft'}
          </button>
        ) : null}

        <span className="hp-ed-editor-gap" />
      </div>

      {editor.error ? <p className="hp-ed-editor-error">{editor.error}</p> : null}

      {/* The other half of this section. Free accounts see it disabled with the
          reason rather than not at all: a control that vanishes never tells
          anybody there is something to upgrade for. */}
      <div className="hp-ed-imow-video">
        {edit.isPro ? <ImowVideoField /> : (
          <button type="button" className="hp-ed-add-choice" disabled title="Video is a Pro feature">
            <span className="hp-ed-add-choice-title">
              Record or upload video
              <span className="hp-ed-pro-tag">Pro</span>
            </span>
            <span className="hp-ed-add-choice-note">
              Say it to camera instead. Sixteen by nine, up to 50MB, on the same page as the text.
            </span>
          </button>
        )}
      </div>
    </div>
  )
}
