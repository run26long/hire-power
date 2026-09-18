'use client'

import { useEffect, useRef, useState } from 'react'
import { useFieldEditor } from '../_lib/editContext'

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
// The row under every editor: what it can do, what went wrong, and the way out.
// ---------------------------------------------------------------------------
function EditorShell({ editor, label, onSave, canSave, children, onRegenerate }) {
  return (
    <div className="hp-ed-editor" role="group" aria-label={`Editing ${label}`}>
      {children}

      <div className="hp-ed-editor-bar">
        <button
          type="button"
          className="hp-ed-action"
          data-primary="true"
          onClick={onSave}
          disabled={!canSave || editor.busy}
        >
          {editor.busy ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          className="hp-ed-action"
          onClick={editor.close}
          disabled={editor.busy}
        >
          Cancel
        </button>

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
            onClick={onRegenerate}
            disabled={editor.busy}
            title="Rewrite this from your coaching sessions"
          >
            {editor.busy ? <span className="hp-ed-spin" aria-hidden="true" /> : null}
            {editor.busy ? 'Rewriting…' : 'Regenerate'}
          </button>
        ) : null}

        <span className="hp-ed-editor-gap" />
      </div>

      {editor.error ? <p className="hp-ed-editor-error">{editor.error}</p> : null}
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
export function ProseEditor({ field, label, value, size = 'body', rows = 3 }) {
  const editor = useFieldEditor(field)
  // Initialised at mount, not synchronised by an effect. Each of these is
  // rendered only while its field is open, so opening one IS the mount and
  // closing it is the unmount - the stored value is therefore the starting
  // point every time, and a cancelled edit cannot come back on the next open.
  const [draft, setDraft] = useState(value || '')
  const ref = useRef(null)

  const isOpen = editor?.isOpen === true

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
    if (typeof next === 'string') setDraft(next)
  }

  const trimmed = draft.trim()

  return (
    <EditorShell
      editor={editor}
      label={label}
      canSave={Boolean(trimmed) && trimmed !== (value || '').trim()}
      onSave={() => editor.save({ [field]: trimmed })}
      onRegenerate={regenerate}
    >
      <textarea
        ref={ref}
        className="hp-ed-textarea"
        data-size={size}
        rows={rows}
        value={draft}
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
  const [tags, setTags] = useState(() => (Array.isArray(value) ? value : []))
  const [entry, setEntry] = useState('')
  const ref = useRef(null)

  const isOpen = editor?.isOpen === true


  useEffect(() => { if (isOpen) ref.current?.focus() }, [isOpen])
  useEscape(isOpen, editor?.close)

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

// ---------------------------------------------------------------------------
// The three proof points.
//
// One panel for the set rather than three editors in place. The three figures
// sit in three separate cells of the cover's grid, and reordering them means
// seeing all three at once - which an editor anchored to one cell cannot do.
//
// There are exactly three, and none can be added or removed. That is not a
// preference: the cover's stylesheet places a lead and two supporting figures
// and has no fourth cell, so a fourth point would be positioned by the grid
// wherever it happened to fall.
// ---------------------------------------------------------------------------
const PROOF_POINT_COUNT = 3

export function ProofPointsEditor({ field = 'proof_points', label = 'proof points', value }) {
  const editor = useFieldEditor(field)
  // Always three rows, so a direction that has none is still editable and one
  // that somehow has more is trimmed to what the layout can place.
  const [points, setPoints] = useState(() => {
    const stored = Array.isArray(value) ? value : []
    return Array.from({ length: PROOF_POINT_COUNT }, (_, i) => ({
      num: typeof stored[i]?.num === 'string' ? stored[i].num : '',
      label: typeof stored[i]?.label === 'string' ? stored[i].label : ''
    }))
  })
  const ref = useRef(null)

  const isOpen = editor?.isOpen === true

  useEffect(() => { if (isOpen) ref.current?.focus() }, [isOpen])
  useEscape(isOpen, editor?.close)

  if (!editor || !isOpen) return null

  function set(index, key, next) {
    setPoints(points.map((p, i) => (i === index ? { ...p, [key]: next } : p)))
  }

  function move(index, by) {
    const target = index + by
    if (target < 0 || target >= points.length) return
    const next = [...points]
    ;[next[index], next[target]] = [next[target], next[index]]
    setPoints(next)
  }

  const complete = points.every(p => p.num.trim() && p.label.trim())
  const changed = JSON.stringify(points.map(p => ({ num: p.num.trim(), label: p.label.trim() })))
    !== JSON.stringify((Array.isArray(value) ? value : []).map(p => ({ num: String(p?.num || ''), label: String(p?.label || '') })))

  // Into the editor, not into the record. See ProseEditor. Padded back to
  // three rows the same way the initial state is, because the layout has three
  // cells whatever the generator returns.
  async function regenerate() {
    const next = await editor.regenerate()
    if (!Array.isArray(next)) return
    setPoints(Array.from({ length: PROOF_POINT_COUNT }, (_, i) => ({
      num: typeof next[i]?.num === 'string' ? next[i].num : '',
      label: typeof next[i]?.label === 'string' ? next[i].label : ''
    })))
  }

  return (
    <EditorShell
      editor={editor}
      label={label}
      canSave={complete && changed}
      onSave={() => editor.save({
        [field]: points.map(p => ({ num: p.num.trim(), label: p.label.trim() }))
      })}
      onRegenerate={regenerate}
    >
      <ol className="hp-ed-proofs">
        {points.map((point, index) => (
          <li className="hp-ed-proof" key={index}>
            <span className="hp-ed-proof-rank" aria-hidden="true">
              {index === 0 ? 'Lead' : index + 1}
            </span>

            <input
              ref={index === 0 ? ref : undefined}
              className="hp-ed-input hp-ed-proof-num"
              type="text"
              value={point.num}
              placeholder="100%"
              onChange={e => set(index, 'num', e.target.value)}
              aria-label={`Proof point ${index + 1} figure`}
            />
            <input
              className="hp-ed-input hp-ed-proof-label"
              type="text"
              value={point.label}
              placeholder="on-time delivery within 50 days"
              onChange={e => set(index, 'label', e.target.value)}
              aria-label={`Proof point ${index + 1} label`}
            />

            <span className="hp-ed-proof-moves">
              <button
                type="button"
                className="hp-ed-tag-move"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label={`Move proof point ${index + 1} up`}
              >
                ↑
              </button>
              <button
                type="button"
                className="hp-ed-tag-move"
                onClick={() => move(index, 1)}
                disabled={index === points.length - 1}
                aria-label={`Move proof point ${index + 1} down`}
              >
                ↓
              </button>
            </span>
          </li>
        ))}
      </ol>
      <p className="hp-ed-proof-note">
        The first figure leads the cover. All three are required.
      </p>
    </EditorShell>
  )
}
