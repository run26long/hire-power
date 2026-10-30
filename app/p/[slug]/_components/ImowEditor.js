'use client'

import { useEffect, useRef, useState } from 'react'
import { useProfileEdit, useFieldEditor, useCanEditField } from '../_lib/editContext'
import { LockIcon, UpgradeNote } from './EditAffordance'
import { FieldEditorBar } from './EditFields'
import { ImowVideoBody, ImowVideoChoose, VIDEO_HELP, useImowVideo } from './ImowVideoField'
import { UnsavedBar, useUnsavedGuard } from './ManageShell'
import ProfileModal from './ProfileModal'
import { LIMITS } from '@/lib/textLimits'

// ============================================================================
// IN MY OWN WORDS, EDITED
//
// The one section of the profile written in the first person, and the only one
// that belongs to the person rather than to a direction: there is one of these
// per profile, and it does not change when the reader changes chapter.
//
// TWO TABS, BECAUSE THEY ARE TWO ALTERNATIVES
// Written and Video used to be stacked in one scroll, with a switch at the top
// naming which of them the profile showed. That put three things on screen at
// once - a box of text, an upload, and a control about both - and the second
// of them was below the fold on a laptop. They are not two fields of one form.
// They are two answers to the same question, only one of which is ever on the
// profile, so they are two pages of one dialog and the owner is on exactly one
// of them at a time.
//
// THIS DIALOG DOES NOT DECIDE WHICH HALF IS ON THE PROFILE
// It did, briefly, and that was the wrong room for the question. Choosing what
// a visitor sees is a decision about the page, so it is made on the page: the
// switch above the card in Edit mode. Here there is no marker saying which
// half is live and no control for changing it - the owner opens this to write
// something or to upload something, and the tabs are two forms rather than two
// candidates.
//
// What the live half still decides is which tab opens, because that is the
// half they are most likely to have come to change.
//
// Neither half ever deletes the other. Both are stored, in their own columns,
// and every write path leaves the other alone. Saving a paragraph cannot take
// a video off the profile and uploading a replacement cannot take a paragraph
// off it; only the switch on the page moves the line.
//
// EVERY PLAN CAN WRITE THIS; NOT EVERY PLAN CAN HAVE IT WRITTEN
// This is the one section of the profile a free account may put its own words
// into, and the reason is what the section is: everything else here arrives
// written by the coaching and is refined, while this arrives empty because it
// is the only part only the person can supply. A free profile without it is
// not a profile with a feature locked, it is a profile missing the paragraph a
// recruiter would have read in their voice. See useCanEditField.
//
// What free does not get is the writing done for it. The one AI control is
// locked with the house lock and an upgrade line, and ./generate and
// ./strengthen both refuse free outright - so the lock is explained here and
// enforced there, which is the rule for every gate on this page. Video is Pro
// and Vault, as it was, and its tab says so.
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
// two side by side and waits: both stay editable and Save takes whichever is
// on screen. What is stored is untouched by either until Save.
//
// ONE FRAME, TWO FORMS
// The title, the two sentences and the tabs are in the same place on both
// tabs, and so is the shape of the footer. What a tab changes is the middle of
// the dialog and the one line under it:
//
//   Written   the box of text          the character count
//   Video     the upload area, or      the specs
//             the film once there is
//             one, at the same width
//
// EVERY STATE HAS ITS OWN PINNED FOOTER
// Four of them, one per thing the owner could be in the middle of: writing,
// looking at a video they have, choosing a frame for one they have not
// uploaded yet, or having no video at all. Each is the house row - the way out
// at the far left, the optional control next, the primary furthest right - and
// each is in the dialog's own footer rather than in its body, so it is on
// screen at every height. The row itself is FieldEditorBar, which every field
// editor on this profile shares.
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

const PLACEHOLDER =
  'What should an employer know about you that your résumé can’t show? ' +
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
  generate: 'Generating…',
  polish: 'Polishing…',
  again: 'Creating another version…'
}

const AI_TITLE = {
  generate: 'Write a first draft from your coaching sessions',
  polish: 'Tighten what you have written without changing what it says',
  again: 'Try this again and see a different version'
}

// What the box is before the stylesheet reaches it, and nothing more: the
// middle has one height in CSS and the box fills it. This used to grow with
// what was typed, which is right for a field in a document and wrong for one
// side of a frame that must be the same size as the other side.
const ROWS = 5

const TABS = ['text', 'video']
const TAB_LABEL = { text: 'Written', video: 'Video' }

export default function ImowEditor({ value }) {
  const edit = useProfileEdit()
  const editor = useFieldEditor('imow')
  // Per field rather than per profile: writing this section is not gated.
  const canEdit = useCanEditField('imow')

  // The owner's own text, which is not always what the page is showing. The
  // document payload now sends only the chosen half, so a profile leading with
  // its video carries no paragraph - and opening this box empty on somebody
  // who has written one would invite them to overwrite it with nothing. The
  // workspace reads both off the management record and hands them down here;
  // `value` is the fallback, and it is what Preview and the public page would
  // have, neither of which renders this editor at all.
  const stored = typeof edit?.imowText === 'string' ? edit.imowText : (value || '')

  const isOpen = editor?.isOpen === true

  // Everything the video half does, with nothing rendered: its controls are
  // this dialog's footer and its question is the profile's own delete dialog.
  // It is told whether the dialog is open, because it signs a URL when it is.
  const video = useImowVideo({ active: isOpen })

  // Which half the profile is showing. Read only to decide which tab opens;
  // nothing in this dialog changes it or says what it is.
  const live = edit?.imowType === 'video' ? 'video' : 'text'

  const [tab, setTab] = useState(live)
  const [draft, setDraft] = useState(stored)
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

  const trimmed = draft.trim()
  const busy = Boolean(editor?.busy || running || video.busy)

  // ---- WHAT THERE IS TO LOSE BY LEAVING ----
  //
  // Typed words that have not been saved, and a file that has been chosen but
  // not uploaded. Those are the only two things this dialog holds: which half
  // is live is decided on the page and written there, so it is never among the
  // things leaving could lose.
  const textChanged = trimmed !== stored.trim()
  // Save has never stored nothing: an emptied box is a change with nothing
  // savable in it, which is why this is not simply `textChanged`.
  const canSaveText = Boolean(trimmed) && textChanged
  const dirty = textChanged || video.pending

  // Save exactly as the footer's own Save does, then close. Either half may be
  // the thing waiting: a chosen file is uploaded, typed words are saved, and
  // both happen in that order where both are waiting, because the upload is
  // the one that can fail on the network.
  async function saveAndClose() {
    if (video.pending) {
      const ok = await video.upload()
      // A failed upload is a reason to stay. The toast says what happened and
      // the file is still chosen.
      if (!ok) return
    }
    if (canSaveText) {
      // The field editor's own save: it closes the dialog when it lands and
      // leaves it open with the text still in it when it does not.
      await editor.save({ imow_text: trimmed })
      return
    }
    editor.close()
  }

  const guard = useUnsavedGuard({ dirty, onClose: editor?.close, onSave: saveAndClose })

  // Opening reads the record again, and opens on the half that is live: the
  // dialog should start where the profile is rather than where it was left.
  useEffect(() => {
    if (!isOpen) return
    setDraft(stored)
    setTab(edit?.imowType === 'video' ? 'video' : 'text')
    // A question left standing from the last visit is not a question about
    // this one.
    guard.reset()
    // Deliberately keyed on the open alone. A save landing underneath this
    // must not reach in and replace what is being typed, and guard.reset is
    // stable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || tab !== 'text') return
    const node = ref.current
    if (!node) return
    // preventScroll, because this runs after every AI action and none of them
    // is a reason to move the page. The editor is already where the owner is
    // looking.
    node.focus({ preventScroll: true })
    node.setSelectionRange(node.value.length, node.value.length)
  }, [isOpen, tab])

  // Nothing on a locked plan can open this, because the pencil and the
  // empty state are both gone. Guarded here too, so the editor cannot be
  // reached by any future path that forgets.
  if (!editor || !isOpen || !canEdit) return null

  // Two readings exist, so the toggle is up. Nothing is disabled by it: Save
  // takes whatever is on screen, and asking for another version is still
  // allowed.
  const comparing = Boolean(polished && mine !== null)

  // What the one AI control is for at this moment. Derived rather than held,
  // so it cannot fall out of step with the text it describes.
  const intent = !trimmed ? 'generate' : (origin ? 'again' : 'polish')

  // ---- WHO MAY HAVE IT WRITTEN FOR THEM ----
  //
  // Both routes, and an account entitled to use them. Either route missing and
  // the control would be able to reach a state it cannot carry out.
  //
  // canUseProfileTools, NOT editor.canRegenerate
  // That one is the field editors' shared answer and says yes to a free
  // account with a single direction, which is right for the headline and the
  // bio - a free account may ask for another version of what the coaching
  // already wrote them. It is wrong here, and was the one place it leaked: the
  // two routes behind this control refuse free outright, so the button could
  // reach a 403 it had no way to explain. The gate is the plan, and it is the
  // same plan the video tab is behind.
  const aiAllowed = edit.canUseProfileTools === true
  const aiWired = Boolean(edit.onGenerateImow && edit.onStrengthenImow)
  const aiOffered = aiWired && aiAllowed

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

  // The way out, in every footer, and on the X, Escape and the backdrop.
  // Guarded, so a half-written paragraph or a chosen file is never lost to one
  // press - and Done on the video tab goes through it too, because leaving by
  // the primary loses just as much as leaving by Cancel.
  //
  // While the delete question is up it answers that instead. ProfileModal's
  // Escape is a capture listener on the document and stops the key before the
  // confirmation's own handler ever sees it, so without this Escape would
  // close the editor out from under a question still on screen.
  function leave() {
    if (video.asking) { video.cancelDelete(); return }
    guard.requestClose()
  }

  const cancelButton = (
    <button type="button" className="hp-manage-secondary" onClick={leave} disabled={busy}>
      Cancel
    </button>
  )

  // ---- A FOOTER PER STATE ----
  //
  // One row of buttons at any moment, in the dialog's own pinned footer. The
  // question about unsaved work takes the whole footer when it is up rather
  // than stacking over it, which is how it behaves in the Manage panels.
  let foot
  if (guard.asking) {
    foot = (
      <UnsavedBar
        onKeep={guard.keepEditing}
        onDiscard={guard.discard}
        onSave={guard.saveAndClose}
      />
    )
  } else if (tab === 'text') {
    foot = (
      <FieldEditorBar
        cancel={cancelButton}
        middle={aiOffered ? (
          <button
            type="button"
            className="hp-manage-secondary"
            onClick={runAi}
            disabled={busy}
            data-working={running ? 'true' : undefined}
            title={AI_TITLE[intent]}
          >
            {running ? <span className="hp-ed-spin" aria-hidden="true" /> : null}
            {running ? AI_BUSY[running] : AI_LABEL[intent]}
          </button>
        ) : aiWired ? (
          /* Shown and locked rather than absent. A control that vanishes never
             tells anybody there is something to upgrade for, and the line
             under the middle says what it would do. The lock mark is the
             profile's own, the one every other gate on this page wears. */
          <button
            type="button"
            className="hp-manage-secondary"
            data-locked="true"
            disabled
            title={AI_TITLE[intent]}
          >
            <span className="hp-ed-locked-mark"><LockIcon /></span>
            {AI_LABEL[intent]}
          </button>
        ) : null}
        save={
          <button
            type="button"
            className="hp-manage-done"
            onClick={() => editor.save({ imow_text: trimmed })}
            disabled={!canSaveText || busy}
          >
            {editor.saving ? 'Saving…' : 'Save'}
          </button>
        }
      />
    )
  } else if (!edit.canUseProfileTools) {
    // Nothing to do on this tab but leave: the body says what the upgrade is
    // for and there is no control to offer behind it.
    foot = <FieldEditorBar cancel={cancelButton} />
  } else if (video.pending) {
    // A file chosen and a frame taken, neither uploaded. Use this frame
    // belongs to the picker in the body; this row is about the file.
    foot = (
      <FieldEditorBar
        cancel={cancelButton}
        middle={
          <button
            type="button"
            className="hp-manage-secondary"
            onClick={video.cancelPending}
            disabled={busy}
          >
            Choose another
          </button>
        }
        save={
          <button
            type="button"
            className="hp-manage-done"
            onClick={video.upload}
            disabled={busy}
          >
            {video.busy === 'upload' ? `Uploading… ${video.progress}%` : 'Use this video'}
          </button>
        }
      />
    )
  } else if (video.hasVideo) {
    // Delete is the destructive one and stands furthest from the primary, in
    // the position Cancel holds everywhere else on this bar. It asks the
    // profile's own confirmation rather than the browser's.
    foot = (
      <FieldEditorBar
        cancel={video.canDelete ? (
          <button
            type="button"
            className="hp-manage-secondary hp-ed-danger"
            onClick={video.askDelete}
            disabled={busy}
          >
            {video.busy === 'delete' ? 'Deleting…' : 'Delete'}
          </button>
        ) : cancelButton}
        middle={<ImowVideoChoose video={video} label="Replace video" />}
        save={
          <button type="button" className="hp-manage-done" onClick={leave} disabled={busy}>
            Done
          </button>
        }
      />
    )
  } else {
    foot = (
      <FieldEditorBar
        cancel={cancelButton}
        save={<ImowVideoChoose video={video} label="Upload a video" primary />}
      />
    )
  }

  return (
    <ProfileModal
      open
      size="fit"
      title="Tell your story"
      titleId="hp-ed-modal-imow"
      portalClass="hp-ed-portal"
      // The X, Escape and the backdrop all arrive here, so all three are
      // guarded by guarding this one.
      onClose={leave}
      foot={foot}
    >
      {/* Two ways to do the same thing, and until this line was here they read
          as two unrelated fields stacked on one another. They are
          alternatives, and the tabs below say so again. */}
      <p className="hp-ed-editor-lede">
        Some things are better said in your own voice. Write a short
        note about what sets you apart, or upload a video and speak to potential employers
        directly.
      </p>

      {/* The proof points panel's Career Direction tabs, lent to the two
          halves of this one: the same classes, the same sliding underline, no
          second set of values. `role="group"` with `aria-current` rather than
          a tablist, which is a promise of arrow-key navigation that neither of
          these implements. */}
      <div className="hp-ed-imow-tabs" role="group" aria-label="In My Own Words">
        {TABS.map(which => (
          <button
            key={which}
            type="button"
            className="hp-bar-item"
            data-active={which === tab ? 'true' : 'false'}
            aria-current={which === tab ? 'true' : undefined}
            disabled={busy}
            onClick={() => setTab(which)}
          >
            <span className="hp-bar-label" data-label={TAB_LABEL[which]}>
              {TAB_LABEL[which]}
            </span>
            <span className="hp-bar-mark" aria-hidden="true" />
          </button>
        ))}
      </div>

      {/* ---- THE MIDDLE, AND THE ONE LINE UNDER IT ----
          The only part of the dialog a tab changes. Everything above is in the
          same place on both, and so is the shape of the footer below. */}
      {tab === 'text' ? (
        <>
          {/* Which reading is in the box. Only up when there are two, and it
              names them rather than asking a question: nothing here is being
              chosen, one of them is simply showing, and either can be edited
              and saved. */}
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
            className="hp-ed-textarea hp-ed-imow-middle"
            data-size="body"
            rows={ROWS}
            value={draft}
            maxLength={MAX}
            onChange={e => onType(e.target.value)}
            aria-label={comparing && view === 'mine' ? 'In My Own Words, your words' : 'In My Own Words'}
            placeholder={PLACEHOLDER}
            spellCheck="true"
          />

          {/* What the section is for comes first, because somebody looking at
              an empty box needs the reason before the ceiling. The count is
              last and is the only part of the line that moves. */}
          <p className="hp-ed-proof-note">
            Give employers the part of the story only you can tell.
            {' '}{trimmed.length.toLocaleString('en-US')} of {MAX.toLocaleString('en-US')} characters.
          </p>

          {/* Renders only on a plan that cannot use the locked control above,
              and only in Edit mode - UpgradeNote decides both. It points at
              Pro, like every gate on this profile. */}
          {aiWired && !aiAllowed ? <UpgradeNote feature="imow" /> : null}

          {note ? <p className="hp-ed-add-note" data-tone="done">{note}</p> : null}
          {editor.error ? <p className="hp-ed-editor-error">{editor.error}</p> : null}
        </>
      ) : edit.canUseProfileTools ? (
        <>
          <ImowVideoBody video={video} />

          {/* Under the middle, where the written tab puts its count. Both are
              one line about the frame above. */}
          <p className="hp-ed-proof-note">{VIDEO_HELP}</p>
        </>
      ) : (
        <>
          {/* Free accounts see the half disabled with the reason rather than
              not at all: a control that vanishes never tells anybody there is
              something to upgrade for. It stands in the middle's own space, so
              moving to this tab does not resize the dialog either. */}
          <button
            type="button"
            className="hp-ed-add-choice hp-ed-imow-middle hp-ed-imow-drop"
            disabled
            title="Video is part of Pro"
          >
            <span className="hp-ed-add-choice-title">
              Record or upload video
              {/* Pro, not Vault. Both plans do have the video; the only
                  account that reads this tag is a free one, and every upgrade
                  prompt on this profile offers Pro - naming Vault here would
                  make this the one place that offers the other plan. */}
              <span className="hp-ed-pro-tag">Pro</span>
            </span>
            <span className="hp-ed-add-choice-note">
              Prefer to speak directly to an employer? Upload a short video and let them
              hear what sets you apart.
            </span>
          </button>

          <p className="hp-ed-proof-note">{VIDEO_HELP}</p>
          <UpgradeNote feature="imow_video" />
        </>
      )}

      {/* The profile's own delete confirmation, portalled into the layer that
          clears this dialog. Nothing is asked until the owner asks for it. */}
      {video.deleteModal}
    </ProfileModal>
  )
}
