'use client'

import { useEffect, useRef, useState } from 'react'
import { useProfileEdit, useFieldEditor, useCanEdit } from '../_lib/editContext'
import useAutoGrow from '../_lib/useAutoGrow'
import ImowVideoField from './ImowVideoField'
import ProfileModal from './ProfileModal'
import { LIMITS } from '@/lib/textLimits'

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
// ONE AI CONTROL, THREE THINGS TO OFFER
// There were two buttons here and they were the wrong shape for the decision.
// Whether you want a draft written or your own words tightened is not a choice
// anybody makes - it follows entirely from whether there is anything in the
// box, and from where what is in it came from. So there is one button, and it
// says which of the three it currently is:
//
//   nothing written yet     Generate a draft
//   the owner's own words   Polish my words
//   words we just wrote     Show me another version
//
// The third is not a fourth behaviour. It repeats whichever of the first two
// produced the standing text: another draft after a draft, another polish
// after a polish - and a second polish goes back to what the owner actually
// wrote rather than polishing our polish, which would drift a little further
// from them every time it was pressed.
//
// TYPING TAKES IT BACK
// The moment the owner edits an AI version it stops being ours and becomes
// theirs: the button returns to Polish my words, and their edited text is what
// the next polish starts from. Nothing here should claim authorship of a
// sentence somebody has been through by hand.
//
// POLISH SHOWS ITS WORK, GENERATE REPLACES
// A generated draft has nothing to compare against, so it goes straight into
// the textarea. A polish has the original sitting right there, so it puts the
// two side by side and waits: Keep what I wrote is a real button, not a
// cancel. What is stored is untouched by either until Save.
// THE WRITING CONTROLS BELONG TO THE WRITING
// They were in the dialog's pinned footer, which said something untrue about
// them: pinned to the whole surface, they read as the dialog's actions, and
// the dialog holds two alternatives. Polish my words has nothing to do with
// the video, and a Save sitting under the upload looks like it saves the
// upload. They sit inside Write it now, under its own count, above the rule
// that separates the two halves - and they scroll with it, so a long passage
// can never push them over the video option or hide it behind them.
//
// ON ITS OWN SURFACE, NOT IN THE MIDDLE OF THE PAGE
// This is the longest editing session on the profile - a paragraph, two AI
// routes, a comparison and a video upload - and it used to open inline, which
// made the page several hundred pixels taller the moment a pencil was pressed
// and pushed the whole of the rest of the profile down. Somebody asking to
// write two sentences should not move the document. It opens on the shared
// dialog instead, and the page behind it does not move at all.
// ============================================================================

const MAX = LIMITS.imow

// The box grows with what is in it and then scrolls, like the headline and the
// bio - but this one is in a dialog that has to fit on the screen whole, and
// it shares that screen with the video option below it. So it is shorter than
// the bio, and it is the part of the dialog that gives way: everything else
// here is a line or a control and cannot usefully be smaller, while a box of
// text can lose a couple of rows and scroll instead.
const MIN_ROWS = 5
const MAX_ROWS = 9

const PLACEHOLDER =
  'What should an employer know about you that your r\u00e9sum\u00e9 can\u2019t show? ' +
  'What sets you apart when the work gets real?'

// One control, three jobs. Keyed by intent for the resting label and by the
// job actually running for the working one, because "again" runs two different
// things and both should say so.
const AI_LABEL = {
  generate: 'Generate a draft',
  polish: 'Polish my words',
  again: 'Show me another version'
}

const AI_BUSY = {
  generate: 'Generating\u2026',
  polish: 'Polishing\u2026',
  again: 'Creating another version\u2026'
}

const AI_TITLE = {
  generate: 'Write a first draft from your coaching sessions',
  polish: 'Tighten what you have written without changing what it says',
  again: 'Try this again and see a different version'
}

// The height before the box has measured itself. useAutoGrow replaces it in
// the same frame; this is only what the first paint gets.
const ROWS = MIN_ROWS

export default function ImowEditor({ value }) {
  const edit = useProfileEdit()
  const editor = useFieldEditor('imow')
  const canEdit = useCanEdit()

  const [draft, setDraft] = useState(value || '')
  // Which AI job is in flight, or null. One at a time by construction: the
  // button that starts them is the same button for all three.
  const [running, setRunning] = useState(null)
  // Where the standing text came from. null means the owner's own - typed,
  // pasted, stored, or an AI version they have since edited by hand.
  const [origin, setOrigin] = useState(null)
  // What a polish was made from, kept so that asking for another one goes back
  // to the owner's words rather than polishing the last polish.
  const [polishSource, setPolishSource] = useState(null)

  // ---- THE TWO READINGS ----
  //
  // A polish used to stand the textarea down and put the two versions side by
  // side, each with its own button. That made choosing a separate act from
  // editing: you picked a side, and only then could you change a word in it.
  //
  // They are now two buffers behind one editable area, with a toggle above it
  // saying which is in there. Both stay editable, both keep whatever was typed
  // into them, and Save takes whichever is on screen. Nothing is chosen; one is
  // simply showing.
  //
  // mine is null until a polish exists, and that is still what says whether
  // there is anything to toggle between.
  const [mine, setMine] = useState(null)
  const [polished, setPolished] = useState(null)
  const [view, setView] = useState('polished')
  const [note, setNote] = useState(null)
  const ref = useRef(null)

  const isOpen = editor?.isOpen === true

  useAutoGrow(ref, draft, MIN_ROWS, MAX_ROWS, isOpen, true)

  // Also the way back from the compare view: the textarea is unmounted while
  // the two versions are up, so nothing can focus it until React has put it
  // back, and calling focus() from the button handler would reach a ref that
  // is still null.
  useEffect(() => {
    if (!isOpen) return
    const node = ref.current
    if (!node) return
    // preventScroll, because this runs after every AI action and none of them
    // is a reason to move the page. The editor is already where the owner is
    // looking.
    node.focus({ preventScroll: true })
    node.setSelectionRange(node.value.length, node.value.length)
  }, [isOpen])

  // Nothing on a locked plan can open this, because the pencil and the
  // empty state are both gone. Guarded here too, so the editor cannot be
  // reached by any future path that forgets.
  if (!editor || !isOpen || !canEdit) return null

  const trimmed = draft.trim()
  const busy = Boolean(editor.busy || running)
  // Two readings exist, so the toggle is up. Nothing is disabled by it: Save
  // takes whatever is on screen, and asking for another version is still
  // allowed.
  const comparing = Boolean(polished && mine !== null)

  // Something has been written for them since this opened, generated or
  // polished. What Save leads from.
  const written = Boolean(origin) || comparing

  // What the one AI control is for at this moment. Derived rather than held,
  // so it cannot fall out of step with the text it describes.
  const intent = !trimmed ? 'generate' : (origin ? 'again' : 'polish')

  // Both routes, and an account entitled to use them. Either one missing and
  // the control would be able to reach a state it cannot carry out.
  const aiOffered = Boolean(edit.onGenerateImow && edit.onStrengthenImow && editor.canRegenerate)

  // The page's toast rather than the note under the textarea. That note is
  // where this editor says what just happened to the draft; a failure is not
  // that, and every other failure on this page is already a toast.
  function notifyFailure(message) {
    if (edit?.notify) edit.notify({ type: 'error', message })
    else setNote(message)
  }

  // Typing makes it theirs again. Which is not only a label change: the next
  // polish starts from what they have just written rather than from whatever
  // we handed them before they changed it.
  // Typing makes it theirs again. Which is not only a label change: the next
  // polish starts from what they have just written rather than from whatever
  // we handed them before they changed it.
  //
  // While two readings are up the edit also lands in whichever buffer is
  // showing, so switching away and back does not lose it. Origin is left alone
  // there: the toggle is still naming two things, and a typo fixed in the
  // polished one does not make it stop being the polished one.
  function onType(next) {
    setDraft(next)
    if (comparing) {
      if (view === 'polished') setPolished(next)
      else setMine(next)
      setNote(null)
      return
    }
    if (origin) { setOrigin(null); setPolishSource(null) }
    setNote(null)
  }

  // Store what is on screen, then show the other one. Nothing is discarded and
  // nothing is chosen: this only changes which of the two is in the box.
  function show(next) {
    if (next === view) return
    if (view === 'polished') setPolished(draft)
    else setMine(draft)
    setView(next)
    setDraft(next === 'polished' ? polished : mine)
    setNote(null)
  }

  async function generate(as) {
    setRunning(as)
    setNote(null)
    try {
      const result = await edit.onGenerateImow()
      const next = result?.imow_text || ''
      if (!next) { notifyFailure("We couldn't write a draft just now. Please try again."); return }
      setDraft(next)
      setOrigin('generated')
      setPolishSource(null)
      setNote('A draft, written from your coaching sessions. Read it, change anything, then save.')
    } catch (err) {
      notifyFailure(err?.message || "We couldn't write a draft just now. Please try again.")
    } finally {
      setRunning(null)
    }
  }

  // `source` is what gets polished, and it is not always what is on screen:
  // asking for another version of a polish goes back to the owner's own words.
  async function polish(source, as) {
    const from = String(source || '').trim()
    if (!from) return
    setRunning(as)
    setNote(null)
    try {
      const result = await edit.onStrengthenImow(from)
      const next = result?.imow_text || ''
      // A polish that comes back identical is a real answer - the passage was
      // already tight - and two identical columns would be a worse way of
      // saying so than a sentence.
      if (!next || next === from) {
        setNote('This already reads well. Nothing worth changing.')
        return
      }
      // Both readings, and the polished one showing. Their words are kept in
      // full rather than as a source string, because the toggle makes them
      // editable again and Save may well take them.
      setPolishSource(from)
      setMine(from)
      setPolished(next)
      setView('polished')
      setDraft(next)
      setOrigin('polished')
      setNote('Two readings of the same thing. Switch between them, change either, then save.')
    } catch (err) {
      notifyFailure(err?.message || "We couldn't do that just now. Please try again.")
    } finally {
      setRunning(null)
    }
  }

  // One handler, because there is one button. Which of the three it is doing
  // is `intent`, and "again" repeats whichever of the other two produced the
  // words now on screen.
  function runAi() {
    if (busy) return
    if (intent === 'generate') return generate('generate')
    if (intent === 'polish') return polish(trimmed, 'polish')
    if (origin === 'generated') return generate('again')
    // Another reading is made from their words, never from the last polish,
    // whichever of the two happens to be on screen when the button is pressed.
    return polish(polishSource || mine || trimmed, 'again')
  }

  // Unchanged in order and in treatment. Only where it lives has changed.
  const writeActions = (
    <div className="hp-ed-editor-bar hp-ed-write-bar">
      {/* One control, leading the bar and carrying the page's primary
          treatment: it is the only thing here that does any work, and Save
          and Cancel are found by people already looking for them. */}
      {/* Which of the two leads. Before anything has been written the AI
          control is the only thing on this bar that does any work. Once there
          is a draft on screen the decision has moved: what is left to do is
          keep it, so Save takes the primary treatment and asking for another
          version steps back. */}
      {aiOffered ? (
        <button
          type="button"
          className="hp-ed-action"
          data-primary={written ? undefined : 'true'}
          onClick={runAi}
          disabled={busy}
          data-working={running ? 'true' : undefined}
          title={AI_TITLE[intent]}
        >
          {running ? <span className="hp-ed-spin" aria-hidden="true" /> : null}
          {running ? AI_BUSY[running] : AI_LABEL[intent]}
        </button>
      ) : null}

      <button
        type="button"
        className="hp-ed-action"
        data-primary={written ? 'true' : undefined}
        onClick={() => editor.save({ imow_text: trimmed })}
        disabled={!trimmed || trimmed === (value || '').trim() || busy}
      >
        {editor.saving ? 'Saving…' : 'Save'}
      </button>

      <button type="button" className="hp-ed-action" onClick={editor.close} disabled={busy}>
        Cancel
      </button>
    </div>
  )

  return (
    <ProfileModal
      open
      size="fit"
      title="Tell your story"
      titleId="hp-ed-modal-imow"
      portalClass="hp-ed-portal"
      onClose={editor.close}
    >
      {/* Two ways to do the same thing, and until this line was here they read
          as two unrelated fields stacked on one another: a box to fill in, and
          an upload underneath it. They are alternatives. The labels on each
          half say so again at the moment somebody is looking at that half. */}
      <p className="hp-ed-editor-lede">
        Some things are better said in your own voice. Write a short
        note about what sets you apart, or upload a video and speak to potential employers
        directly.
      </p>

      <p className="hp-ed-field-label" data-accent="true">Write it</p>

      {/* Which reading is in the box. Only up when there are two, and it names
          them rather than asking a question: nothing here is being chosen, one
          of them is simply showing, and either can be edited and saved. */}
      {comparing ? (
        <div className="hp-ed-versions" role="group" aria-label="Which version to show">
          <button
            type="button"
            className="hp-ed-version"
            data-on={view === 'mine' ? 'true' : 'false'}
            aria-pressed={view === 'mine'}
            onClick={() => show('mine')}
          >
            Your words
          </button>
          <button
            type="button"
            className="hp-ed-version"
            data-on={view === 'polished' ? 'true' : 'false'}
            aria-pressed={view === 'polished'}
            onClick={() => show('polished')}
          >
            Polished version
          </button>
        </div>
      ) : null}

      <textarea
        ref={ref}
        className="hp-ed-textarea"
        data-size="body"
        rows={ROWS}
        value={draft}
        maxLength={MAX}
        onChange={e => onType(e.target.value)}
        aria-label={comparing && view === 'mine' ? 'In My Own Words, your words' : 'In My Own Words'}
        placeholder={PLACEHOLDER}
        spellCheck="true"
      />

      {/* What the section is for comes first, because somebody looking at an
          empty box needs the reason before the ceiling. The count is last and
          is the only part of the line that moves. */}
      <p className="hp-ed-proof-note">
        Give employers the part of the story only you can tell.
        {' '}{trimmed.length.toLocaleString('en-US')} of {MAX.toLocaleString('en-US')} characters.
      </p>

      {writeActions}

      {/* Under the controls rather than over them, so the row stays where the
          count puts it and a message arriving does not move it. */}
      {note ? <p className="hp-ed-add-note" data-tone="done">{note}</p> : null}

      {editor.error ? <p className="hp-ed-editor-error">{editor.error}</p> : null}

      {/* The other half of this section. Free accounts see it disabled with the
          reason rather than not at all: a control that vanishes never tells
          anybody there is something to upgrade for. */}
      <div className="hp-ed-imow-video">
        <p className="hp-ed-field-label" data-accent="true">Or record it</p>

        {edit.canUseProfileTools ? <ImowVideoField /> : (
          <button type="button" className="hp-ed-add-choice" disabled title="Video is part of Vault and Pro">
            <span className="hp-ed-add-choice-title">
              Record or upload video
              <span className="hp-ed-pro-tag">Vault</span>
            </span>
            <span className="hp-ed-add-choice-note">
              Prefer to speak directly to an employer? Upload a short video and let them
              hear what sets you apart. MP4 or WebM, landscape 16:9, up to 50MB.
            </span>
          </button>
        )}
      </div>
    </ProfileModal>
  )
}
