'use client'

import { useEffect, useRef, useState } from 'react'
import { useFieldEditor } from '../_lib/editContext'
import useAutoGrow from '../_lib/useAutoGrow'
import ProfileModal from './ProfileModal'
import { LIMITS, clampToLimit, overLimitNote } from '@/lib/textLimits'

// ============================================================================
// THE FIELD EDITORS
//
// What a pencil opens. Each renders in the place the content it is editing
// normally occupies, so the owner is typing where the words will actually be
// rather than into a form that describes them.
//
// Every one of these returns null outside an editor, because useFieldEditor
// does. A section can mount them unconditionally and the public page renders
// exactly what it rendered before.
//
// REORDERING IS BUTTONS, NOT DRAG
// I planned drag and built arrows. Native HTML5 drag does not work on touch at
// all and is not reachable from a keyboard without building a parallel
// mechanism anyway, so the drag version would have needed these buttons beside
// it regardless. Three proof points and a handful of tags is not a list long
// enough for dragging to be the faster way.
// ============================================================================

// ---------------------------------------------------------------------------
// TAKE THE SAVED VALUE AGAIN, EVERY TIME THE EDITOR OPENS
//
// Closing a field does not unmount its editor. The component returns null and
// React keeps the instance, so a useState initialiser runs ONCE in the life of
// the page - with whichever direction happened to be on screen the first time
// the section rendered. Every later open showed that, or whatever was last
// typed, rather than the direction now selected.
//
// Switching direction closes the open field (ProfileDocument does it when the
// content swaps, for this exact reason), so an editor can never be open across
// a direction change. The open edge is therefore the only moment that matters,
// and loading there is enough.
//
// Only on the closed -> open edge, never on a later change to `value`: while
// somebody is typing, the stored value is the thing they are replacing, and
// reloading it would delete what they had written.
// ---------------------------------------------------------------------------
function useLoadOnOpen(isOpen, load) {
  // Held in a ref so the effect below does not have to list `load` - a fresh
  // closure every render would re-run it and wipe the draft mid-edit.
  const loadRef = useRef(load)
  useEffect(() => { loadRef.current = load })

  const wasOpen = useRef(false)
  useEffect(() => {
    if (isOpen && !wasOpen.current) loadRef.current()
    wasOpen.current = isOpen
  }, [isOpen])
}

// ---------------------------------------------------------------------------
// The row under every editor: what it can do, what went wrong, and the way out.
// ---------------------------------------------------------------------------
// `hint` and `count` are the row under the field. It sits under rather than
// over because both halves are about text that already exists: what you may do
// with it, and how much of the room it is using. Above the field they were
// answering a question nobody had asked yet, and they pushed the words the
// editor exists to show further down the screen.
//
// The order of the bar is the order of the decision. Asking for another
// version is the thing most people will want first and is the only control
// here that does any work, so it leads and carries the page's primary
// treatment; Save and Cancel follow in the outlined treatment, because by the
// time somebody is pressing either of those they are looking for them.
// `modalTitle` is what turns this from a panel in the document into a dialog
// over it. Some of these fields are a line of text and belong where the line
// is; others are a whole editing session, and one of those opening inline made
// the page taller by several hundred pixels and pushed everything below it
// down - the owner pressed a pencil and the profile moved.
//
// The dialog is the shared one, so the overlay, the focus trap, Escape, the
// scroll lock, the returning focus and the internal scrolling are decided in a
// single place and not restated here. The bar becomes its pinned footer, in
// the same order it has inline.
function EditorShell({
  editor, label, onSave, canSave, children, onRegenerate, hint, count, note, modalTitle,
  // Which of the two carries the primary treatment. Before a version has been
  // written the generator is the only thing on the bar that does any work, so
  // it leads. Once there is a draft on screen the decision has moved: the thing
  // to do next is keep it, and Save leads instead.
  savePrimary = false
}) {
  const bar = (
    <>
        {/* Offered only where it exists. A free account with more than one
            direction cannot generate at all, and a button that always
            answered PRO_REQUIRED would be worse than no button.

            It takes several seconds and says so while it does. Without the
            mark the only sign anything was happening was the button going
            flat, which reads as a control that refused rather than one that
            is working. */}
        {editor.canRegenerate && onRegenerate ? (
          <button
            type="button"
            className="hp-ed-action"
            data-primary={savePrimary ? undefined : 'true'}
            data-working={editor.working ? 'true' : undefined}
            onClick={onRegenerate}
            disabled={editor.busy}
            title="Write this again from your coaching sessions"
          >
            {editor.working ? <span className="hp-ed-spin" aria-hidden="true" /> : null}
            {editor.working ? 'Creating another version…' : 'Show me another version'}
          </button>
        ) : null}

        {/* `saving`, not `busy`. This button is disabled while a new version is
            being written, and a disabled control is not a reason to claim a
            database write is under way. It says Saving… when it is saving. */}
        <button
          type="button"
          className="hp-ed-action"
          data-primary={savePrimary ? 'true' : undefined}
          onClick={onSave}
          disabled={!canSave || editor.busy}
        >
          {editor.saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          className="hp-ed-action"
          onClick={editor.close}
          disabled={editor.busy}
        >
          Cancel
        </button>

      <span className="hp-ed-editor-gap" />
    </>
  )

  const body = (
    <>
      {children}

      {hint || count ? (
        <div className="hp-ed-editor-helper">
          {hint ? <p className="hp-ed-editor-hint">{hint}</p> : <span />}
          {count ? <p className="hp-ed-editor-count" data-over={count.over ? 'true' : undefined}>{count.text}</p> : null}
        </div>
      ) : null}

      {note ? <p className="hp-ed-editor-note">{note}</p> : null}
      {editor.error ? <p className="hp-ed-editor-error">{editor.error}</p> : null}
    </>
  )

  if (modalTitle) {
    return (
      <ProfileModal
        open
        title={modalTitle}
        titleId={`hp-ed-modal-${label.replace(/\s+/g, '-').toLowerCase()}`}
        portalClass="hp-ed-portal"
        onClose={editor.close}
        foot={<span className="hp-ed-foot-left">{bar}</span>}
      >
        {body}
      </ProfileModal>
    )
  }

  return (
    <div className="hp-ed-editor" role="group" aria-label={`Editing ${label}`}>
      {body}
      <div className="hp-ed-editor-bar">{bar}</div>
    </div>
  )
}

// Escape closes, from anywhere inside the editor. Bound per editor rather than
// globally so an editor that is not open cannot swallow the key.
function useEscape(active, close) {
  useEffect(() => {
    if (!active) return
    function onKey(event) {
      if (event.key === 'Escape') { event.stopPropagation(); close() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, close])
}

// ---------------------------------------------------------------------------
// One passage of prose: the headline, or the bio.
//
// `size` picks the type the textarea is set in, so the headline is edited at
// headline size and the bio at reading size. Somebody writing a headline needs
// to see it break the way it will break.
// ---------------------------------------------------------------------------
// Said under the headline and the bio, which are the two fields that arrive
// already written. It is withheld where there is no second version to ask for,
// because half of it would then be an offer nobody can take.
const HINT = 'Edit our suggestion directly, or ask us for another version.'

// How tall each box may grow before it stops growing and starts scrolling. The
// headline is a line of display type on the cover and stays close to one; the
// bio is a paragraph. The character ceilings themselves are in lib/textLimits,
// because the generator has to know them too.
const SHAPES = {
  headline: { minRows: 2, maxRows: 5 },
  bio: { minRows: 6, maxRows: 14 }
}
const DEFAULT_SHAPE = { minRows: 4, maxRows: 12 }

export function ProseEditor({ field, label, value, size = 'body', rows = 3 }) {
  const editor = useFieldEditor(field)
  // The starting point, reloaded on every open by useLoadOnOpen below. This
  // initialiser only covers the first one: the editor is mounted for the life
  // of the section and merely returns null while closed, so it runs once.
  const [draft, setDraft] = useState(value || '')
  // Whether a version has been written since this opened. Both versions here
  // are generated, so there is nothing to compare against and nothing to
  // choose between: the new wording simply replaces what was in the field, and
  // the only thing left to decide is whether to keep it. Save leads from then
  // on. Cancel still restores the saved version, because the draft has never
  // been anywhere near the record.
  const [regenerated, setRegenerated] = useState(false)
  const ref = useRef(null)

  const isOpen = editor?.isOpen === true
  const shape = SHAPES[field] || DEFAULT_SHAPE
  const max = LIMITS[field] || LIMITS.bio

  useAutoGrow(ref, draft, shape.minRows, shape.maxRows, isOpen)

  // This direction's saved words, not the last direction's. `regenerated` goes
  // with them: it says a version has been written since this opened, and on a
  // fresh open nothing has.
  useLoadOnOpen(isOpen, () => {
    setDraft(value || '')
    setRegenerated(false)
  })

  useEffect(() => {
    if (!isOpen) return
    const node = ref.current
    if (!node) return
    node.focus()
    node.setSelectionRange(node.value.length, node.value.length)
  }, [isOpen])

  useEscape(isOpen, editor?.close)

  if (!editor || !isOpen) return null

  // Regenerate hands its result to the draft rather than to the database. The
  // editor stays where it is with the new wording in it, unsaved and dirty, so
  // it can be read, changed, or abandoned with Cancel - which is what a button
  // offering an alternative should do. Nothing is lost by pressing it.
  async function regenerate() {
    const next = await editor.regenerate()
    // Held to the same ceiling a typed one is, and cut at a sentence rather
    // than at a character. A field that will not save what its own button just
    // put in it is worse than a slightly shorter answer.
    // The generator is told the limit and its answers are refused server-side
    // for breaking it, so this should never have anything to do. It stays as
    // the last line of defence: a field that will not save what its own button
    // just put in it is worse than a slightly shorter answer.
    if (typeof next === 'string') {
      setDraft(clampToLimit(next, max))
      setRegenerated(true)
    }
  }

  const trimmed = draft.trim()

  // Copy written before the limit existed is longer than the limit, and it is
  // not this editor's business to quietly shorten somebody's profile to open
  // it. So it is shown in full, counted honestly, and Save waits until the
  // owner has either cut it or taken a version that fits.
  const over = draft.length > max

  return (
    <EditorShell
      editor={editor}
      label={label}
      hint={editor.canRegenerate ? HINT : null}
      count={{
        over,
        text: `${draft.length.toLocaleString('en-US')} of ${max.toLocaleString('en-US')} characters`
      }}
      note={over ? overLimitNote(max) : null}
      canSave={Boolean(trimmed) && trimmed !== (value || '').trim() && !over}
      onSave={() => editor.save({ [field]: trimmed })}
      onRegenerate={regenerate}
      savePrimary={regenerated}
    >
      <textarea
        ref={ref}
        className="hp-ed-textarea"
        data-size={size}
        data-grow="true"
        rows={rows}
        value={draft}
        maxLength={max}
        onChange={e => setDraft(e.target.value)}
        aria-label={label}
        spellCheck="true"
      />
    </EditorShell>
  )
}

// ---------------------------------------------------------------------------
// Open To.
//
// A tag is a short phrase, so it is added by typing and pressing Enter rather
// than by opening a row. Removal is on the tag itself. Order matters because
// the footer reads left to right and the first tag is the one a recruiter
// reads first.
// ---------------------------------------------------------------------------
export function TagsEditor({ field = 'ready_tags', label = 'Open To tags', value }) {
  const editor = useFieldEditor(field)
  // Reloaded on every open by useLoadOnOpen below; this initialiser only
  // covers the first one. See the note on the hook.
  const [tags, setTags] = useState(() => (Array.isArray(value) ? value : []))
  const [entry, setEntry] = useState('')
  const ref = useRef(null)

  const isOpen = editor?.isOpen === true

  // This direction's tags, and an empty box to add to them - a half-typed tag
  // left behind from a previous open belongs to whatever was being edited
  // then.
  useLoadOnOpen(isOpen, () => {
    setTags(Array.isArray(value) ? value : [])
    setEntry('')
  })

  // No useEscape here: the dialog owns the key, and two handlers on one press
  // is one of them closing something the other has already closed.
  useEffect(() => {
    if (!isOpen) return
    const t = window.setTimeout(() => ref.current?.focus(), 60)
    return () => window.clearTimeout(t)
  }, [isOpen])

  if (!editor || !isOpen) return null

  function add() {
    const text = entry.trim().replace(/\s+/g, ' ')
    if (!text) return
    // Case-insensitively, because "VP Operations" and "vp operations" are one
    // tag with two spellings and the route would drop the second anyway.
    if (tags.some(t => t.toLowerCase() === text.toLowerCase())) { setEntry(''); return }
    setTags([...tags, text])
    setEntry('')
  }

  function move(index, by) {
    const next = [...tags]
    const target = index + by
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setTags(next)
  }

  const changed = JSON.stringify(tags) !== JSON.stringify(Array.isArray(value) ? value : [])

  // Into the editor, not into the record. See ProseEditor.
  async function regenerate() {
    const next = await editor.regenerate()
    if (Array.isArray(next)) setTags(next.filter(t => typeof t === 'string'))
  }

  return (
    <EditorShell
      editor={editor}
      label={label}
      modalTitle="Edit career focus"
      canSave={tags.length > 0 && changed}
      onSave={() => editor.save({ [field]: tags })}
      onRegenerate={regenerate}
    >
      <ul className="hp-ed-tags">
        {tags.map((tag, index) => (
          <li className="hp-ed-tag" key={`${tag}-${index}`}>
            <button
              type="button"
              className="hp-ed-tag-move"
              onClick={() => move(index, -1)}
              disabled={index === 0}
              aria-label={`Move ${tag} earlier`}
            >
              ‹
            </button>
            <span className="hp-ed-tag-text">{tag}</span>
            <button
              type="button"
              className="hp-ed-tag-move"
              onClick={() => move(index, 1)}
              disabled={index === tags.length - 1}
              aria-label={`Move ${tag} later`}
            >
              ›
            </button>
            <button
              type="button"
              className="hp-ed-tag-drop"
              onClick={() => setTags(tags.filter((_, i) => i !== index))}
              aria-label={`Remove ${tag}`}
            >
              ×
            </button>
          </li>
        ))}
        {tags.length === 0 ? <li className="hp-ed-tags-none">No tags yet.</li> : null}
      </ul>

      <div className="hp-ed-tag-add">
        <input
          ref={ref}
          className="hp-ed-input"
          type="text"
          value={entry}
          placeholder="Add a role or focus, then press Enter"
          onChange={e => setEntry(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); add() }
          }}
          aria-label="Add a tag"
        />
        <button type="button" className="hp-ed-action" onClick={add} disabled={!entry.trim()}>
          Add
        </button>
      </div>
    </EditorShell>
  )
}

