'use client'

import { useEffect, useRef, useState } from 'react'
import { useProfileEdit, useFieldEditor } from '../_lib/editContext'

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
// ============================================================================

const MAX = 2000

// Long enough to hold five sentences without the textarea becoming the page.
const ROWS = 9

export default function ImowEditor({ value }) {
  const edit = useProfileEdit()
  const editor = useFieldEditor('imow')

  const [draft, setDraft] = useState(value || '')
  const [generating, setGenerating] = useState(false)
  const [note, setNote] = useState(null)
  const ref = useRef(null)

  const isOpen = editor?.isOpen === true

  useEffect(() => {
    if (!isOpen) return
    const node = ref.current
    if (!node) return
    node.focus()
    node.setSelectionRange(node.value.length, node.value.length)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    function onKey(event) {
      if (event.key === 'Escape') { event.stopPropagation(); editor.close() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, editor])

  if (!editor || !isOpen) return null

  const trimmed = draft.trim()
  const busy = editor.busy || generating

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
      setNote(err?.message || "We couldn't write a draft just now. Please try again.")
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="hp-ed-editor" role="group" aria-label="Editing In My Own Words">
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
          disabled={!trimmed || trimmed === (value || '').trim() || busy}
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
            disabled={busy}
            title="Write a first draft from your coaching sessions"
          >
            {generating ? 'Writing…' : 'Generate draft'}
          </button>
        ) : null}

        <span className="hp-ed-editor-gap" />
        <span className="hp-ed-editor-esc">Esc to cancel</span>
      </div>

      {editor.error ? <p className="hp-ed-editor-error">{editor.error}</p> : null}

      {/* The other half of this section, which does not exist yet.
          Disabled and saying which of the two reasons applies, because a
          control that vanishes for a free account does not tell them there is
          something to upgrade for, and one that is present and silent for a
          Pro account does not tell them it is not ready. */}
      <div className="hp-ed-imow-video">
        <button
          type="button"
          className="hp-ed-add-choice"
          disabled
          title={edit.isPro ? 'Video is coming soon' : 'Video is a Pro feature'}
        >
          <span className="hp-ed-add-choice-title">
            Record or upload video
            {edit.isPro
              ? <span className="hp-ed-soon-tag">Coming soon</span>
              : <span className="hp-ed-pro-tag">Pro</span>}
          </span>
          <span className="hp-ed-add-choice-note">
            Say it to camera instead. Sixteen by nine, on the same page, in place of the text.
          </span>
        </button>
      </div>
    </div>
  )
}
