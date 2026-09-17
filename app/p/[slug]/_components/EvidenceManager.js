'use client'

import { useState } from 'react'
import { useProfileEdit, useNotify } from '../_lib/editContext'
import { EVIDENCE_TYPES, FAMILY_LABELS, familyForType } from '@/lib/evidenceTypes'

// ============================================================================
// MANAGING WHAT IS ALREADY THERE
//
// A list, under the composition, rather than controls on the tiles.
//
// WHY NOT ON THE TILES
// Two reasons, and the second is the one that decides it. The section shows a
// handful of pieces and the collection can be dozens, so tile controls would
// reach only the few things that happen to be in the preview - and the items
// most in need of managing are exactly the ones that are not. And a tile is a
// single <button>: putting a star and two arrows inside it would be a button
// inside a button, which no keyboard and no screen reader can resolve.
//
// THE ORDER IS THIS DIRECTION'S ORDER
// What is placed here comes first, in the sequence the profile reads it, with
// the controls that only mean anything inside a direction - the star and the
// arrows. Everything else follows, as things that exist and are not shown
// here, with the same way of putting them in.
//
// PRIVATE ITEMS ARE IN THIS LIST AND NOWHERE ELSE
// The public payload cannot carry them, so the list is built from the
// management record. That is also why a private item has no tile above: the
// document is rendering what a recruiter would see, and a private item is not
// part of it.
// ============================================================================

const GROUPED = Object.entries(
  EVIDENCE_TYPES.reduce((acc, item) => {
    ;(acc[item.family] ||= []).push(item.type)
    return acc
  }, {})
)

function Badge({ children, tone }) {
  return <span className="hp-ed-mrow-badge" data-tone={tone}>{children}</span>
}

export default function EvidenceManager() {
  const edit = useProfileEdit()
  const notify = useNotify()

  const [openId, setOpenId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [busy, setBusy] = useState(null)

  if (!edit?.editing) return null

  const items = edit.allEvidence || []
  const placements = edit.allPlacements || []
  const lenses = edit.lenses || []
  const lensId = edit.lensId || null
  if (items.length === 0) return null

  const here = placements
    .filter(p => p.lens_id === lensId)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const hereIds = here.map(p => p.evidence_id)

  const byId = new Map(items.map(i => [i.id, i]))
  const placed = hereIds.map(id => byId.get(id)).filter(Boolean)
  const elsewhere = items.filter(i => !hereIds.includes(i.id))
  const featuredId = here.find(p => p.featured)?.evidence_id || null

  async function run(key, work) {
    if (busy) return
    setBusy(key)
    try {
      await work()
    } catch (err) {
      notify({ type: 'error', message: err?.message || "We couldn't save that. Please try again." })
    } finally {
      setBusy(null)
    }
  }

  function startEdit(item) {
    setOpenId(item.id)
    setDraft({
      title: item.title || '',
      description: item.description || '',
      evidence_type: item.evidence_type || '',
      organization: item.organization || '',
      date_label: item.date_label || ''
    })
  }

  function row(item, index, isPlaced) {
    const isOpen = openId === item.id
    const isFeatured = featuredId === item.id
    const isPrivate = item.privacy === 'private'
    const family = familyForType(draft?.evidence_type)

    return (
      <li className="hp-ed-mrow" key={item.id} data-open={isOpen ? 'true' : undefined}>
        <div className="hp-ed-mrow-head">
          {isPlaced ? (
            <span className="hp-ed-proof-moves">
              <button
                type="button" className="hp-ed-tag-move"
                disabled={index === 0 || Boolean(busy)}
                aria-label={`Move ${item.title} earlier`}
                onClick={() => run(`up:${item.id}`, () => edit.onReorderEvidence(item.id, lensId, -1))}
              >↑</button>
              <button
                type="button" className="hp-ed-tag-move"
                disabled={index === placed.length - 1 || Boolean(busy)}
                aria-label={`Move ${item.title} later`}
                onClick={() => run(`down:${item.id}`, () => edit.onReorderEvidence(item.id, lensId, 1))}
              >↓</button>
            </span>
          ) : <span className="hp-ed-proof-moves" aria-hidden="true" />}

          {/* The star is a switch, not a button: it has two states and one of
              them is already true for something else in this direction. */}
          {isPlaced ? (
            <button
              type="button"
              className="hp-ed-star"
              role="switch"
              aria-checked={isFeatured}
              aria-label={`Feature ${item.title} in this direction`}
              disabled={Boolean(busy)}
              data-on={isFeatured ? 'true' : 'false'}
              onClick={() => run(`star:${item.id}`,
                () => edit.onFeatureEvidence(isFeatured ? null : item.id, lensId))}
            >★</button>
          ) : <span className="hp-ed-star-gap" aria-hidden="true" />}

          <span className="hp-ed-mrow-title">{item.title}</span>

          <span className="hp-ed-mrow-badges">
            {item.family ? <Badge>{FAMILY_LABELS[item.family] || item.family}</Badge> : null}
            {item.evidence_type ? <Badge>{item.evidence_type}</Badge> : null}
            {isPrivate ? <Badge tone="warn">Private</Badge> : null}
            {item.source_type === 'upload' ? <Badge tone="quiet">File</Badge> : null}
          </span>
        </div>

        {/* Which chapters carry it. Highlighted where it already sits, and one
            click either way. */}
        <div className="hp-ed-mrow-lenses">
          {lenses.map(lens => {
            const on = placements.some(p => p.lens_id === lens.id && p.evidence_id === item.id)
            return (
              <button
                key={lens.id}
                type="button"
                className="hp-ed-lens-chip"
                aria-pressed={on}
                disabled={Boolean(busy)}
                onClick={() => run(`assign:${item.id}:${lens.id}`,
                  () => edit.onAssignEvidence(item.id, lens.id, !on))}
              >
                {lens.name}
              </button>
            )
          })}
        </div>

        <div className="hp-ed-mrow-actions">
          <button
            type="button" className="hp-ed-action"
            disabled={Boolean(busy)}
            onClick={() => (isOpen ? setOpenId(null) : startEdit(item))}
          >
            {isOpen ? 'Close' : 'Edit'}
          </button>

          {/* Offered where it can be used. A free account cannot make an item
              private, and a button that always answered PRO_REQUIRED would be
              worse than no button - but an already-private item keeps the way
              back, so a lapsed account is never stuck. */}
          {edit.isPro || isPrivate ? (
            <button
              type="button" className="hp-ed-action"
              disabled={Boolean(busy)}
              onClick={() => run(`privacy:${item.id}`,
                () => edit.onEditEvidence(item.id, { privacy: isPrivate ? 'public' : 'private' }))}
            >
              {isPrivate ? 'Make public' : 'Make private'}
            </button>
          ) : null}

          <button
            type="button" className="hp-ed-action hp-ed-danger"
            disabled={Boolean(busy)}
            onClick={() => {
              const ok = window.confirm(
                `Remove "${item.title}" from your profile?\n\n` +
                'It will be taken out of every direction it appears in.'
              )
              if (ok) run(`delete:${item.id}`, () => edit.onDeleteEvidence(item.id))
            }}
          >
            Remove
          </button>
        </div>

        {isOpen && draft ? (
          <div className="hp-ed-mrow-edit">
            <label className="hp-ed-field-label" htmlFor={`t-${item.id}`}>Title</label>
            <input
              id={`t-${item.id}`} className="hp-ed-input hp-ed-block" type="text"
              value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
            />

            <label className="hp-ed-field-label" htmlFor={`d-${item.id}`}>Description</label>
            <textarea
              id={`d-${item.id}`} className="hp-ed-textarea" data-size="body" rows={3}
              value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
            />

            <div className="hp-ed-add-grid">
              <div>
                <label className="hp-ed-field-label" htmlFor={`y-${item.id}`}>Type</label>
                <select
                  id={`y-${item.id}`} className="hp-ed-input hp-ed-block"
                  value={draft.evidence_type}
                  onChange={e => setDraft(d => ({ ...d, evidence_type: e.target.value }))}
                >
                  <option value="">Choose one…</option>
                  {/* Evidence written before this list existed carries types
                      that are not on it - "Process walkthrough", "Project
                      image" and others, nine of the sixteen in use. Dropping
                      that value on the floor would mean the type had to be
                      re-chosen before a title could be corrected, so it stays
                      here as what the item currently says. */}
                  {item.evidence_type && !familyForType(item.evidence_type) ? (
                    <optgroup label="Currently">
                      <option value={item.evidence_type}>{item.evidence_type}</option>
                    </optgroup>
                  ) : null}
                  {GROUPED.map(([familyKey, types]) => (
                    <optgroup key={familyKey} label={FAMILY_LABELS[familyKey]}>
                      {types.map(t => <option key={t} value={t}>{t}</option>)}
                    </optgroup>
                  ))}
                </select>
                <p className="hp-ed-proof-note">
                  {family
                    ? `Filed under ${FAMILY_LABELS[family]}.`
                    : draft.evidence_type
                      ? `Kept as "${draft.evidence_type}". Choosing from the list refiles it.`
                      : 'Choose a type to file this.'}
                </p>
              </div>
              <div>
                <label className="hp-ed-field-label" htmlFor={`o-${item.id}`}>Organisation</label>
                <input
                  id={`o-${item.id}`} className="hp-ed-input hp-ed-block" type="text"
                  value={draft.organization} placeholder="Optional"
                  onChange={e => setDraft(d => ({ ...d, organization: e.target.value }))}
                />
              </div>
              <div>
                <label className="hp-ed-field-label" htmlFor={`a-${item.id}`}>Date</label>
                <input
                  id={`a-${item.id}`} className="hp-ed-input hp-ed-block" type="text"
                  value={draft.date_label} placeholder="Optional"
                  onChange={e => setDraft(d => ({ ...d, date_label: e.target.value }))}
                />
              </div>
            </div>

            {/* The source is not here on purpose. A link's address and an
                upload's file are what the item is; changing either under an
                existing title would leave a tile that describes one thing and
                opens another. */}
            <p className="hp-ed-proof-note">
              {item.source_type === 'upload'
                ? 'The file itself cannot be swapped. Add the new one and remove this.'
                : 'The link cannot be changed here. Add the new one and remove this.'}
            </p>

            <div className="hp-ed-editor-bar">
              <button
                type="button" className="hp-ed-action" data-primary="true"
                disabled={
                  !draft.title.trim() || Boolean(busy) ||
                  // An off-list type is fine as long as it is the one already
                  // stored. Choosing a new one means choosing from the list.
                  (draft.evidence_type !== item.evidence_type && !familyForType(draft.evidence_type))
                }
                onClick={() => run(`save:${item.id}`, async () => {
                  const values = {
                    title: draft.title.trim(),
                    description: draft.description.trim() || null,
                    organization: draft.organization.trim() || null,
                    date_label: draft.date_label.trim() || null
                  }
                  // Sent only when it changed. The route refiles the family
                  // from whatever type it is given, and it only accepts the
                  // list - so re-sending an unchanged off-list type would turn
                  // an edit to the title into a rejection.
                  if (draft.evidence_type !== item.evidence_type) {
                    values.evidence_type = draft.evidence_type
                  }
                  await edit.onEditEvidence(item.id, values)
                  setOpenId(null)
                })}
              >
                {busy === `save:${item.id}` ? 'Saving…' : 'Save'}
              </button>
              <button type="button" className="hp-ed-action" onClick={() => setOpenId(null)} disabled={Boolean(busy)}>
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </li>
    )
  }

  return (
    <div className="hp-ed-manager">
      <p className="hp-ed-add-title">
        Your evidence ({items.length})
      </p>

      {placed.length > 0 ? (
        <>
          <p className="hp-ed-manager-group">In this direction, in this order</p>
          <ul className="hp-ed-mrows">{placed.map((item, i) => row(item, i, true))}</ul>
        </>
      ) : (
        <p className="hp-ed-proof-note">Nothing is shown in this direction yet.</p>
      )}

      {elsewhere.length > 0 ? (
        <>
          <p className="hp-ed-manager-group">Not shown in this direction</p>
          <ul className="hp-ed-mrows">{elsewhere.map(item => row(item, -1, false))}</ul>
        </>
      ) : null}
    </div>
  )
}
