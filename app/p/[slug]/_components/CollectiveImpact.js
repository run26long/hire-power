'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Reveal from './Reveal'
import { GhostText, SectionHiddenChip, Lock, useEditSlot } from './EditAffordance'
import ProfileModal from './ProfileModal'
import ManageList from './ManageList'
import { usePaneGuard } from './ManageShell'
import { TestimonialEditPane, TestimonialRequestPane, useTestimonialDelete } from './ManagePanes'
import TestimonialReview from './TestimonialReview'
import TestimonialsAll from './TestimonialsAll'
import { useCanShowEmpty, useCanEdit, useShowUpgradeModal, useProfileEdit } from '../_lib/editContext'
import { directionsByItem, rowsForDirection, selectForDirection } from '../_lib/profileData'
import { PICKABLE } from './DirectionPicker'

// ============================================================================
// COLLECTIVE IMPACT + FIRSTHAND ACCOUNTS
//
// Experience has just shown the work. This act asks whether the people around
// it felt the difference, and answers it twice: once as the synthesis across
// everything they wrote, and once in their own words.
//
// The synthesis is read, never made here. It is generated and stored by its own
// authenticated route; the public page only ever displays what is already in
// the table. Nothing on this page can start a generation.
//
// The accounts are a scroll region rather than a wheel. Every published one is
// in the list, in the order this direction ranked them, and the browser does
// the scrolling: there is no offset to hold, no window to compute, and the
// wheel, the trackpad, touch and the keyboard all work without anything being
// written for them.
//
// Every testimonial is rendered exactly as stored. Collapsing a long one is a
// display cap and nothing else: the full text is always in the DOM, and the
// control only appears when the text is genuinely taller than the cap.
// ============================================================================

const pad = (n) => String(n).padStart(2, '0')

// What the column has room to say well. Three accounts beside a synthesis is
// a column somebody reads; every account a profile has ever collected, in a
// box that scrolls, is a filing cabinet standing where a section should be.
// The rest are one press away and all of them are there.
const VOICES_PREVIEW = 3

export default function CollectiveImpact({
  impact,
  testimonials,
  animate = true,
  reducedMotion = false,
  directionKey
}) {
  const canShowEmpty = useCanShowEmpty()
  // Both controls below show on every plan and both of them write, so a
  // gated press opens the Pro modal instead of a panel whose routes would
  // refuse it. Same split as Evidence and Portfolio.
  const canEdit = useCanEdit()
  const showUpgrade = useShowUpgradeModal()
  const slot = useEditSlot()
  const [expanded, setExpanded] = useState(() => new Set())
  // Every account, on request. Its own state rather than a pane of the
  // manage modal: this one is for readers, and the public page has it too.
  const [allOpen, setAllOpen] = useState(false)
  const [overflowing, setOverflowing] = useState(() => new Set())
  const [shownFor, setShownFor] = useState(directionKey)
  // The management list opens on request, from the heading control or from the
  // invitation in the first quote position.
  const [manageOpen, setManageOpen] = useState(false)
  // Which row has a write in flight, so one switch can go quiet without
  // freezing the list around it.
  const [busyId, setBusyId] = useState(null)
  // What has taken the modal over: null is the list, an id is that
  // testimonial's own controls, 'request' is the form that asks for a new one.
  const [pane, setPane] = useState(null)
  // Who the last request went to, so the list can confirm it by name. Cleared
  // when the modal closes: it is a receipt for the thing that just happened,
  // not a standing banner.
  const [sentTo, setSentTo] = useState(null)

  // Every testimonial row the owner has, at any status, which is what there is
  // to manage. The published ones are a subset and are what the column shows.
  const edit = useProfileEdit()
  // The direction being read, from the context rather than a prop: this
  // section is handed an impact and some quotations, never a lens.
  const lensId = edit?.lensId || null

  // ---- MANAGING WHAT THIS DIRECTION SHOWS ----
  //
  // This direction's placements, shown and hidden together. There is no Add
  // here and no delete anywhere: a testimonial arrives because somebody was
  // asked for one and wrote it, which is the Request flow, and it never
  // leaves. Hiding is the whole of what this list can do to one.
  const closeManage = useCallback(() => { setManageOpen(false); setPane(null); setSentTo(null) }, [])

  // ---- THE EDIT PANE'S UNSAVED WORK, HELD HERE ----
  //
  // The pane is the body of a modal whose X, Escape and backdrop belong to
  // this component, so this is where the guard has to live: the pane reports
  // what it has typed and how to save it, and the pane renders the bar from
  // the same guard. See usePaneGuard in ./ManageShell.
  //
  // It is false until a pane says otherwise, so with no pane open - or nothing
  // typed into one - every way out closes immediately, exactly as before.
  const paneGuard = usePaneGuard({ onClose: closeManage })

  // Resolved from the record rather than held in state, so publishing or
  // categorising is reflected in the pane that did it.
  const paneItem = useMemo(
    () => (pane && pane !== 'request'
      ? (edit?.testimonials || []).find(one => one.id === pane) || null
      : null),
    [pane, edit?.testimonials]
  )

  // ---- EVERY TESTIMONIAL, NOT EVERY PLACEMENT ----
  //
  // This list used to be built from the direction's placements, and a
  // testimonial only gets a placement once it is published. So a request
  // nobody had answered yet, and an answer the owner had not approved yet,
  // were both invisible here - which also made the approve control
  // unreachable, because the only way to it is this list. The thing the owner
  // most needed to see after sending a request was the one thing the list
  // could not show.
  //
  // So it is built from the testimonials themselves and the placements are
  // merged in where they exist. Placed ones keep their placement order and
  // their switch; the rest sit above, newest first, carrying the state they
  // are actually in.
  // The arrangement as the owner just left it, held until the reload brings
  // the real order back. The drop moves the row and the write follows it; a
  // failure puts the row back and says why. Same bargain as the Career
  // Directions reorder in the Settings drawer.
  const [draftOrder, setDraftOrder] = useState(null)

  // A column for each direction that is on the profile, and no more.
  const columns = useMemo(
    () => (edit?.allLenses || [])
      .filter(one => one?.status === 'active')
      .map(one => ({ id: one.id, name: one.name })),
    [edit?.allLenses]
  )

  // Wider than the columns. The picker offers hidden directions too, and a
  // switch writes the whole membership back, so a direction with no column
  // still has to be in the set or the write would take the item off it.
  const pickable = useMemo(
    () => new Set(
      (edit?.allLenses || []).filter(one => PICKABLE.has(one?.status)).map(one => one.id)
    ),
    [edit?.allLenses]
  )

  const manageItems = useMemo(() => {
    const all = edit?.testimonials || []
    const rows = rowsForDirection(edit?.allTestimonialPlacements, lensId, 'testimonial_id')
    const on = directionsByItem(all, edit?.allTestimonialPlacements, 'testimonial_id', pickable)

    // The order this direction reads them in, which is the same call the
    // public page makes: the rows where there are rows, the synthesis's own
    // ranking for everything here without one. A testimonial on all
    // directions holds no row and is still in this list, so its position has
    // to come from the same place the page would put it.
    //
    // includeHidden, because a testimonial turned off here still has a row in
    // the owner's list - that is where the switch to turn it back on lives.
    const here = selectForDirection(
      all.filter(item => item.status === 'published'),
      rows,
      { order: impact?.testimonialOrder, includeHidden: true }
    )
    // The draft speaks for the order while it is held, which is what makes
    // the drop immediate. Stable, so a testimonial it does not name keeps the
    // position it had.
    const shown = draftOrder
      ? (() => {
          const rank = new Map(draftOrder.map((id, at) => [id, at]))
          return [...here].sort(
            (a, b) =>
              (rank.has(a.id) ? rank.get(a.id) : Infinity) -
              (rank.has(b.id) ? rank.get(b.id) : Infinity)
          )
        })()
      : here
    const rankOf = new Map(shown.map((item, at) => [item.id, at]))

    // ---- THE FOUR STATES ----
    //
    // Requested       nobody has written anything yet
    // Ready to review they have, and the owner has not put it on the profile
    // Published       it is on the profile
    // Hidden          it is on the profile's list but turned off here
    //
    // The first two are told apart by whether there is any text on the row, and
    // by nothing else. Reading the status alone is what produced "No response
    // yet" over a paragraph somebody had already written and sent.
    const rowFor = (item) => {
      const published = item.status === 'published'
      const answered = Boolean(item.polished_text || item.raw_text)
      const hidden = rows.get(item.id)?.hidden === true

      // Published and on nothing: pinned to directions that have all since
      // been deleted. Worth its own word, because "Published" over a
      // testimonial nobody can see would be the page lying.
      const unplaced = published && item.placement_scope === 'selected' && !rankOf.has(item.id)

      const state = !answered ? 'Requested'
        : !published ? 'Ready to review'
        : unplaced ? 'Not shown on any Career Direction'
        : hidden ? 'Hidden'
        : 'Published'

      return {
        id: item.id,
        title: item.recipient_name || 'A referee',
        meta: [item.recipient_title, item.relationship].filter(Boolean).join(' · '),
        // Switches only where there is something to place. A testimonial
        // nobody has written, or one the owner has not reviewed, is not on
        // the profile at all - so there is no direction to put it on, and the
        // row says which of the two it is waiting on instead.
        on: published ? (on.get(item.id) || []) : undefined,
        // Placed means this direction has something to order. A question
        // about membership rather than about a row: a testimonial on all
        // directions is on this one and can be ordered here, whether or not
        // anybody has arranged it yet.
        placed: rankOf.has(item.id),
        status: state,
        statusTone: state === 'Published' ? 'live' : state === 'Ready to review' ? 'review' : 'wait',
        // Only what is on the profile takes part in the profile's order.
        rank: rankOf.has(item.id) ? rankOf.get(item.id) : -1,
        at: item.created_at || '',
        // Whether anybody has written yet. The trash asks a different
        // question of an answer than it does of a request nobody has
        // answered, and this is what tells the two apart.
        answered,
        // Nobody has decided on this one, so its row offers Review rather
        // than Edit and the panel opens on it.
        review: answered && !published,
        // What the badge on the section's control counts.
        toReview: answered && !published
      }
    }

    // Three groups. What is waiting on somebody comes first - an answer the
    // owner has not decided on, then a request nobody has answered - because
    // those are the rows that want doing, and burying them under an order
    // they have no place in is how the approve control became unreachable
    // once before. Neither is on any direction, so neither can be dragged.
    //
    // Then the open direction's own order, which is what the drag in this
    // panel rearranges, and below the divider everything that direction does
    // not hold, newest first - the order this collection has when nothing has
    // arranged it.
    const listed = all.map(rowFor)
    const byNewest = (a, b) => String(b.at).localeCompare(String(a.at))

    const waiting = listed.filter(row => row.toReview).sort(byNewest)
    const asked = listed.filter(row => !row.toReview && row.status === 'Requested').sort(byNewest)
    const seen = new Set([...waiting, ...asked].map(row => row.id))
    const placed = listed
      .filter(row => !seen.has(row.id) && row.rank !== -1)
      .sort((a, b) => a.rank - b.rank)
    const rest = listed
      .filter(row => !seen.has(row.id) && row.rank === -1)
      .sort(byNewest)

    return [...waiting, ...asked, ...placed, ...rest]
  }, [edit?.testimonials, edit?.allTestimonialPlacements, lensId, impact, draftOrder, pickable])

  // How many are waiting on the owner rather than on the person who was asked.
  // A request nobody has answered is not work for them and is deliberately not
  // counted: a badge that never cleared until somebody else acted would be a
  // number they could do nothing about.
  const toReviewCount = manageItems.filter(row => row.toReview).length

  // ---- WHAT IS WAITING ON THE OWNER ----
  //
  // In the order the list shows them, newest first, which is the order the
  // panel walks through them in.
  const waiting = useMemo(
    () => manageItems.filter(row => row.review).map(row => row.id),
    [manageItems]
  )

  // Which one the Review panel is on, or null. Its own state rather than a
  // value of `pane`: reviewing is a panel in its own right, not a pane inside
  // Manage, and it can be open with Manage shut.
  const [reviewId, setReviewId] = useState(null)
  // Dismissed for this visit. In memory and nowhere else: closing the panel
  // means "not now", not "never", so the next visit asks again.
  const [reviewDone, setReviewDone] = useState(false)

  const reviewItem = useMemo(
    () => (reviewId ? (edit?.testimonials || []).find(one => one.id === reviewId) || null : null),
    [reviewId, edit?.testimonials]
  )

  const openReview = useCallback((id) => {
    setManageOpen(false)
    setPane(null)
    setReviewId(id)
  }, [])

  const closeReview = useCallback(() => {
    setReviewId(null)
    setReviewDone(true)
  }, [])

  // Decided. The next one in the queue takes its place, and when there is no
  // next one the panel closes - read before the refresh lands, because after
  // it the one just decided on is no longer in the queue to count from.
  const afterReview = useCallback((id) => {
    const at = waiting.indexOf(id)
    const next = at === -1 ? null : waiting[at + 1] || null
    if (next) setReviewId(next)
    else closeReview()
  }, [waiting, closeReview])

  // ---- OPENING IT WITHOUT BEING ASKED ----
  //
  // Two of the three ways in land here. The notification email's "review it
  // here" carries the id, so that one opens on the testimonial it is about;
  // any other visit opens on the first thing waiting. Either way it is the
  // owner's own editor, never Preview and never the public page.
  //
  // Read from the address rather than from a router hook, because this
  // component is the same component on the public page and has no business
  // subscribing to search params there.
  useEffect(() => {
    if (!canShowEmpty || reviewDone || reviewId || waiting.length === 0) return
    let asked = null
    try {
      asked = new URLSearchParams(window.location.search).get('review')
    } catch {
      asked = null
    }
    setReviewId(waiting.includes(asked) ? asked : waiting[0])
  }, [canShowEmpty, reviewDone, reviewId, waiting])

  const run = useCallback(async (id, work) => {
    if (busyId) return
    setBusyId(id)
    try {
      await work()
    } catch (err) {
      edit?.notify?.({ type: 'error', message: err?.message || "We couldn't save that. Please try again." })
    } finally {
      setBusyId(null)
    }
  }, [busyId, edit])

  // Withdrawing one, from a row in the list. Same hook, same dialog and same
  // call as the Delete in the pane, so the two cannot drift - and the dialog
  // says whether it is deleting an answer or withdrawing a request.
  const del = useTestimonialDelete()

  // One switch moves one direction, but the route takes the whole set: scope
  // and rows are one decision, and sending them apart has an intermediate
  // state where the testimonial is on nothing. The same call the direction
  // picker in the review pane makes.
  const setDirection = useCallback(
    (row, directionId, next) => {
      const now = new Set(row.on || [])
      if (next) now.add(directionId)
      else now.delete(directionId)
      return run(row.id, () => edit?.onSetTestimonialDirections?.(row.id, 'selected', [...now]))
    },
    [run, edit]
  )
  // A drop says where the testimonial goes, by naming the row it was dropped
  // on, and the route resolves the position. Only the placed rows have an
  // order at all - the pending ones sit above them and are not draggable - so
  // a drop onto one of those is refused here rather than sent as a target the
  // route has no row for.
  const dropItem = useCallback((fromId, toId) => {
    if (!fromId || !toId || fromId === toId) return
    const ids = manageItems.filter(one => one.placed).map(one => one.id)
    const from = ids.indexOf(fromId)
    const to = ids.indexOf(toId)
    if (from === -1 || to === -1) return

    // The same splice the route performs, so what the owner sees the instant
    // they let go is what the table will hold a moment later.
    const next = ids.slice()
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)

    const previous = draftOrder
    setDraftOrder(next)
    return run(fromId, async () => {
      try {
        await edit?.onMoveTestimonial?.(fromId, lensId, toId)
        setDraftOrder(null)
      } catch (err) {
        setDraftOrder(previous)
        throw err
      }
    })
  }, [manageItems, run, edit, lensId, draftOrder])

  const bodyRefs = useRef(new Map())

  const quotes = (Array.isArray(testimonials) ? testimonials : []).filter(
    (t) => String(t?.polished_text || '').trim()
  )
  const summary = String(impact?.summary || '').trim()
  const themes = Array.isArray(impact?.themes) ? impact.themes.filter((t) => t?.label && t?.statement) : []

  const hasImpact = Boolean(summary)
  const hasQuotes = quotes.length > 0
  const shownQuotes = quotes.slice(0, VOICES_PREVIEW)

  // A new direction starts the act again. Adjusted during render rather than
  // from an effect, which is the supported way to reset state when a prop
  // changes: it settles before paint.
  if (shownFor !== directionKey) {
    setShownFor(directionKey)
    setExpanded(new Set())
  }

  // The scroll position used to be put back by hand here, because the column
  // was a scroll region and each direction ranks these accounts for itself:
  // the reader had to arrive at the top of that ranking rather than wherever
  // the previous direction was left. The column shows three now and does not
  // scroll, so there is no position to put back.
  // Which quotes are actually taller than the cap. Measured rather than
  // guessed from a character count, so the control never appears on a quote
  // that already fits.
  useEffect(() => {
    const measure = () => {
      const tall = new Set()
      for (const [id, node] of bodyRefs.current) {
        if (!node) continue
        // Only meaningful while the cap is on; an expanded one is not clamped.
        if (node.dataset.expanded === 'true') {
          if (overflowing.has(id)) tall.add(id)
          continue
        }
        if (node.scrollHeight > node.clientHeight + 1) tall.add(id)
      }
      setOverflowing(tall)
    }

    measure()
    if (typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(measure)
    for (const node of bodyRefs.current.values()) if (node) observer.observe(node)
    return () => observer.disconnect()
    // `overflowing` is deliberately not a dependency: it is what this writes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownQuotes.length, expanded, directionKey])

  const toggle = (id) => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Collective Impact is drawn from every published testimonial on the
  // profile, not from the ones this direction happens to show, so the
  // synthesis stands on this direction even where the column beside it is
  // empty: the evidence is on the profile, one direction along. The act
  // goes only when there is neither a synthesis nor an account to show -
  // which is a profile whose testimony has all been withdrawn, unpublished
  // or emptied, and then there is nothing left for a conclusion to rest on.
  // Nothing is deleted by this; the row is still there for the day new
  // testimony arrives. `quotes` is the collection the page was handed,
  // already filtered to what may be served publicly.
  // Empty on the public page means gone. For the owner it means a section
  // with a way to ask somebody for the first one.
  if (!hasQuotes && !hasImpact && !canShowEmpty) return null

  return (
    <section className="hp-impact">
      <div className="hp-wrap">
        {/* One heading over both columns, because the synthesis on the left and
            the accounts on the right are two readings of the same thing. What
            each column is then says so inside the column itself. */}
        <Reveal enabled={animate} className={`hp-impact-intro${slot}`}>
          <h2 className="hp-impact-headline">What others see.<SectionHiddenChip /></h2>
        </Reveal>

        {/* One control for the whole section, at the top right, the same one
            the other two sections carry. Asking somebody for a testimonial is
            inside it, so the empty column below no longer carries buttons of
            its own. */}
        {/* One control, always the same words, and everything it opens is
            finished inside it - asking, reviewing, and deciding what shows.
            The badge is the only thing that changes, and it counts what is
            waiting on the owner. */}
        {canShowEmpty ? (
          <div className="hp-ed-manage-row">
            {/* Beside Manage rather than under it, and only once the column
                has something in it: while it is empty the invitation stands
                in the first quote position and asks there, and a second
                control saying the same thing would be the owner asked the
                same question twice. The row renders for an owner in Edit mode
                on every plan, and a gated press opens the Pro modal. */}
            {hasQuotes ? (
              <button
                type="button"
                className="hp-ed-action"
                data-primary="true"
                onClick={canEdit ? () => { setPane('request'); setManageOpen(true) } : showUpgrade}
              >
                {canEdit ? null : <Lock />}+ Request a testimonial
              </button>
            ) : null}

            <button
              type="button"
              className="hp-ed-manage"
              aria-haspopup="dialog"
              onClick={canEdit ? () => { setPane(null); setManageOpen(true) } : showUpgrade}
            >
              {canEdit ? null : <Lock />}Manage testimonials
              {toReviewCount > 0 ? (
                <span
                  className="hp-ed-manage-count"
                  aria-label={`${toReviewCount} ready to review`}
                >
                  {toReviewCount}
                </span>
              ) : null}
            </button>
          </div>
        ) : null}

        {/* Which sides are actually there, so one missing side widens the
            other rather than leaving an empty column beside it. */}
        <div
          className="hp-impact-flow"
          data-synthesis={hasImpact || canShowEmpty ? 'true' : 'false'}
          data-voices={hasQuotes || canShowEmpty ? 'true' : 'false'}
        >
          {hasImpact && (
            <Reveal enabled={animate} className="hp-impact-synthesis">
              {/* Names the card, the way Firsthand Accounts names the column
                  opposite. It sits inside the surface rather than above it, so
                  the display heading keeps the whole section and this keeps
                  only the card. */}
              <span className="hp-label hp-impact-eyebrow">Collective Impact</span>
              <p className="hp-impact-summary">{summary}</p>

              {/* The stored `label` is internal. It stays in the row so the
                  schema does not have to change and a future editor has
                  something to key on, but it is not shown: the numeral and the
                  statement are the whole of what a reader gets. */}
              {themes.length > 0 && (
                <ol className="hp-themes">
                  {themes.map((theme, i) => (
                    <li className="hp-theme" key={theme.label || i}>
                      <span className="hp-theme-index" aria-hidden="true">{pad(i + 1)}</span>
                      <span className="hp-theme-statement">{theme.statement}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Reveal>
          )}

          {/* The synthesis panel, empty, so the act keeps both its columns
              while it is being filled. This one is written by Hire Power from
              published testimonials rather than by hand, so the panel says what
              will produce it and offers no action: an "add" here would promise
              a control that does not exist. The 01/02/03 theme rows stay
              underneath as the real composition waiting. */}
          {!hasImpact && canShowEmpty && (
            <div className="hp-impact-synthesis hp-ed-ghost-panel">
              <span className="hp-label hp-impact-eyebrow">Collective Impact</span>

              <p className="hp-impact-summary hp-ed-guide-prose">
                Publish 2 testimonials and Hire Power will find the patterns
                across them.
              </p>

              <ol className="hp-themes" aria-hidden="true">
                {['01', '02', '03'].map(n => (
                  <li className="hp-theme hp-ed-ghost-theme" key={n}>
                    <span className="hp-theme-index">{n}</span>
                    <span className="hp-theme-statement">
                      <span className="hp-ed-ghost-text">
                        <span className="hp-ed-ghost-line" style={{ width: '100%' }} />
                        <span className="hp-ed-ghost-line" style={{ width: '72%' }} />
                        <span className="hp-ed-ghost-line" style={{ width: '48%' }} />
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* The public Firsthand Accounts column. Same class, so it takes the
              same half of the same two column flow at the same width; same
              head, same rows. The explanation and the two actions sit under the
              heading at full width, and the rows below carry no words, because
              inventing a testimonial would be inventing a person. */}
          {!hasQuotes && canShowEmpty && (
            <div className="hp-impact-voices hp-ed-voices-empty hp-ed-incomplete">
              {/* The pill has its own row at the top right, with the heading
                  under it. Kept in flow rather than positioned, so the copy
                  below still runs the column's full width without anything
                  sitting on its first line. */}
              <div className="hp-voices-head">
                <h3 className="hp-voices-title">Firsthand Accounts</h3>
              </div>

              <p className="hp-ed-voices-say">
                You can say you’re great at what you do. It means more when
                someone else says it. Invite people who have seen your work up
                close to share a few sentences. They review the polished version,
                and you decide whether it appears here.
              </p>

              <div className="hp-voices-scroll hp-ed-ghost-voices">
                <ul className="hp-voices">
                  {[0, 1].map(i => (
                    <li className="hp-voice-item" key={i} aria-hidden="true">
                      <blockquote className="hp-voice-quote" data-expanded="false">
                        <GhostText lines={3} />
                      </blockquote>
                      <div className="hp-voice-foot">
                        <p className="hp-voice-face">
                          <span className="hp-voice-name"><GhostText width="92px" /></span>
                          <span className="hp-voice-role"><GhostText width="140px" /></span>
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {hasQuotes && (
            <Reveal enabled={animate} delay={110} className="hp-impact-voices">
              <div className="hp-voices-head">
                <h3 className="hp-voices-title">Firsthand Accounts</h3>
                <p className="hp-voices-note">In the words of people who saw the work up close.</p>
              </div>

              {/* Three, and no scroller. This was a scroll region holding
                  every account the direction carried, which is a filing
                  cabinet standing where a section should be - and a box the
                  keyboard had to be given a way into and out of. The rest are
                  one press away, all of them, in the panel below. */}
              <div className="hp-voices-scroll">
                <ul className="hp-voices">
                  {shownQuotes.map((quote, i) => {
                    const id = quote.id || `quote-${i}`
                    const isOpen = expanded.has(id)
                    const canExpand = overflowing.has(id)

                    return (
                      <li className="hp-voice-item" key={id}>
                        <blockquote
                          className="hp-voice-quote"
                          data-expanded={isOpen ? 'true' : 'false'}
                          ref={(el) => {
                            if (el) bodyRefs.current.set(id, el)
                            else bodyRefs.current.delete(id)
                          }}
                        >
                          {quote.polished_text}
                        </blockquote>

                        {/* The footer: who said it, and - quietly, off to the
                            right - the way back into the whole of it. Name,
                            title and company always. The relationship is the
                            one line that waits: it is the detail that can be
                            read once the quote it belongs to is open. */}
                        <div className="hp-voice-foot">
                          <p className="hp-voice-face">
                            <span className="hp-voice-name">{quote.recipient_name}</span>
                            {quote.recipient_title && (
                              <span className="hp-voice-role">{quote.recipient_title}</span>
                            )}
                            {quote.relationship && isOpen && (
                              <span className="hp-voice-rel">{quote.relationship}</span>
                            )}
                          </p>

                          {canExpand && (
                            <button
                              type="button"
                              className="hp-voice-more"
                              aria-expanded={isOpen}
                              onClick={() => toggle(id)}
                            >
                              {isOpen ? 'Show less' : 'Read full quote'}
                            </button>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>

                {/* Only where there is more than the column is showing. The
                    count is the whole of it, not the remainder: it is what
                    the reader will find on the other side of the press. */}
                {quotes.length > VOICES_PREVIEW && (
                  <button
                    type="button"
                    className="hp-voices-all"
                    onClick={() => setAllOpen(true)}
                    aria-haspopup="dialog"
                  >
                    See all ({quotes.length})
                  </button>
                )}
              </div>
            </Reveal>
          )}

          {/* Asking, and deciding. Under the accounts rather than over them:
              the section is what people said, and managing it comes after.

              Last in the flow, and it has to be. Grid auto-placement is sparse:
              the cursor moves forward and never goes back, so a full-width item
              placed before the accounts pushed them into a row of their own
              below it. That row had no height to give, and `min-height: 100%`
              against it resolved to nothing, so the whole Firsthand Accounts
              column silently collapsed to zero in edit mode while preview,
              which does not render this, was fine.

              On request now, not by default. It used to stand open under every
              visit to this act, which meant the owner met a management table
              instead of the section they had come to read. */}
          {canShowEmpty && manageOpen ? (
            <ProfileModal
              open
              eyebrow="Testimonials"
              title="Manage testimonials"
              titleId="hp-manage-testimonials"
              portalClass="hp-ed-portal"
              // Guarded, so a half-typed request or a changed relationship is
              // never lost to the X, Escape or a press on the backdrop.
              onClose={paneGuard.requestClose}
            >
              {pane === 'request' ? (
                <TestimonialRequestPane
                  guard={paneGuard}
                  onBack={() => setPane(null)}
                  // Back to the list, and the list now has the new request in
                  // it. The name comes back so the confirmation can say who was
                  // asked rather than that something happened.
                  onSent={(name) => { setPane(null); setSentTo(name) }}
                />
              ) : paneItem ? (
                <TestimonialEditPane item={paneItem} onBack={() => setPane(null)} guard={paneGuard} />
              ) : (
                <ManageList
                  items={manageItems}
                  busyId={busyId}
                  onDrop={dropItem}
                  onEdit={(id) => {
                    const row = manageItems.find(one => one.id === id)
                    if (row?.review) openReview(id)
                    else setPane(id)
                  }}
                  onDelete={del.available ? del.ask : undefined}
                  deletingId={del.deletingId}
                  directions={columns}
                  activeLensId={lensId}
                  onSetDirection={setDirection}
                  onAdd={() => setPane('request')}
                  addLabel="Request a testimonial"
                  secondaryLabel="Download reference sheet"
                  onSecondary={() => edit?.onDownloadReferenceSheet?.()}
                  onDone={closeManage}
                  emptyNote="Nobody has been asked yet. Request a testimonial to start."
                  notice={sentTo ? `Request sent to ${sentTo}. It is in the list below, waiting on them.` : null}
                  note="Drag any item in the current Career Direction to reorder. Use the toggles to choose which Career Direction(s) each item appears in."
                />
              )}
            </ProfileModal>
          ) : null}

          {/* Every account, when the column is showing three of more. Readers
              get this one, so it is not gated on being the owner. */}
          {allOpen ? (
            <TestimonialsAll
              items={quotes}
              onClose={() => setAllOpen(false)}
              // The same gate the section's own Manage control stands behind,
              // so this list can never offer a way into a panel this account
              // does not get. Absent outside Edit mode, which is how Preview
              // and the public page end up with no button at all.
              //
              // One closes as the other opens, in that order, so there is
              // never a moment with two of these on screen.
              onManage={canShowEmpty
                ? (canEdit ? () => { setAllOpen(false); setPane(null); setManageOpen(true) } : showUpgrade)
                : undefined}
            />
          ) : null}

          {/* The decision nobody has taken yet, in its own panel. It portals
              onto the body, so it stands over whatever is open behind it. */}
          {canShowEmpty && reviewItem ? (
            <TestimonialReview
              item={reviewItem}
              position={Math.max(1, waiting.indexOf(reviewItem.id) + 1)}
              total={waiting.length}
              onClose={closeReview}
              onDone={afterReview}
            />
          ) : null}

          {/* The same question the pane's Delete asks, asked by the same
              hook. It portals onto the body, so it stands over the panel the
              row was pressed in. */}
          {del.modal}
        </div>
      </div>
    </section>
  )
}
