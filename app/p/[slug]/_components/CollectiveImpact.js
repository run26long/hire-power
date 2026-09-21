'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Reveal from './Reveal'
import { GhostText, useEditSlot } from './EditAffordance'
import ProfileModal from './ProfileModal'
import ManageList from './ManageList'
import { TestimonialEditPane, TestimonialRequestPane } from './ManagePanes'
import { useCanShowEmpty, useProfileEdit } from '../_lib/editContext'
import { directionPlacements } from '../_lib/profileData'

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

export default function CollectiveImpact({
  impact,
  testimonials,
  animate = true,
  reducedMotion = false,
  directionKey
}) {
  const canShowEmpty = useCanShowEmpty()
  const slot = useEditSlot()
  const [expanded, setExpanded] = useState(() => new Set())
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
  const manageItems = useMemo(() => {
    const all = edit?.testimonials || []
    const places = directionPlacements(edit?.allTestimonialPlacements, lensId)
    const placeOf = new Map(places.map((place, at) => [place.testimonial_id, { place, at }]))

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
      const found = placeOf.get(item.id)
      const published = item.status === 'published'
      const answered = Boolean(item.polished_text || item.raw_text)
      const hidden = found ? found.place.hidden === true : false

      const state = !answered ? 'Requested'
        : !published ? 'Ready to review'
        : hidden ? 'Hidden'
        : 'Published'

      return {
        id: item.id,
        title: item.recipient_name || 'A referee',
        meta: [item.recipient_title, item.relationship].filter(Boolean).join(' · '),
        hidden,
        // Placed means there is something on this direction to order and to
        // show or hide, which only what is on the profile has. A placement row
        // can exist for an unpublished one - the direction materialises them in
        // a batch - and it still has no place in the profile's order.
        placed: published && Boolean(found),
        status: state,
        statusTone: state === 'Published' ? 'live' : state === 'Ready to review' ? 'review' : 'wait',
        // Only what is on the profile takes part in the profile's order.
        rank: published && found ? found.at : -1,
        at: item.created_at || '',
        // What the badge on the section's control counts.
        toReview: answered && !published
      }
    }

    const rows = all.map(rowFor)
    const pending = rows.filter(row => row.rank === -1).sort((a, b) => String(b.at).localeCompare(String(a.at)))
    const placed = rows.filter(row => row.rank !== -1).sort((a, b) => a.rank - b.rank)
    return [...pending, ...placed]
  }, [edit?.testimonials, edit?.allTestimonialPlacements, lensId])

  // How many are waiting on the owner rather than on the person who was asked.
  // A request nobody has answered is not work for them and is deliberately not
  // counted: a badge that never cleared until somebody else acted would be a
  // number they could do nothing about.
  const toReviewCount = manageItems.filter(row => row.toReview).length

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

  const toggleItem = useCallback(
    (id, nextHidden) => run(id, () => edit?.onHideTestimonial?.(id, lensId, nextHidden)),
    [run, edit, lensId]
  )
  const dropItem = useCallback((fromId, toId) => {
    // Only the placed rows have an order to change. The pending ones sit above
    // them and are not draggable, and counting them here would offset every
    // step the reorder walks.
    const ids = manageItems.filter(one => one.placed).map(one => one.id)
    const from = ids.indexOf(fromId)
    const to = ids.indexOf(toId)
    if (from === -1 || to === -1 || from === to) return
    const by = to > from ? 1 : -1
    return run(fromId, async () => {
      for (let at = from; at !== to; at += by) {
        await edit?.onReorderTestimonial?.(fromId, lensId, by)
      }
    })
  }, [manageItems, run, edit, lensId])

  const bodyRefs = useRef(new Map())
  const scrollRef = useRef(null)

  const quotes = (Array.isArray(testimonials) ? testimonials : []).filter(
    (t) => String(t?.polished_text || '').trim()
  )
  const summary = String(impact?.summary || '').trim()
  const themes = Array.isArray(impact?.themes) ? impact.themes.filter((t) => t?.label && t?.statement) : []

  const hasImpact = Boolean(summary)
  const hasQuotes = quotes.length > 0

  // A new direction starts the act again. Adjusted during render rather than
  // from an effect, which is the supported way to reset state when a prop
  // changes: it settles before paint.
  if (shownFor !== directionKey) {
    setShownFor(directionKey)
    setExpanded(new Set())
  }

  // The scroll position belongs to the browser rather than to React, so it is
  // put back by hand. Each direction ranks these accounts for itself, and the
  // reader has to arrive at the top of that ranking rather than wherever the
  // previous direction happened to be left.
  useEffect(() => {
    const node = scrollRef.current
    if (node) node.scrollTop = 0
  }, [directionKey])

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
  }, [quotes.length, expanded, directionKey])

  const toggle = (id) => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Collective Impact is drawn from these accounts and from nothing else, so
  // a stored synthesis must not outlive them: if every account has been
  // withdrawn, unpublished or emptied, the whole act goes rather than a
  // conclusion standing on evidence a reader can no longer see. Nothing is
  // deleted by this - the row is still there for the day new testimony
  // arrives. `quotes` is the collection the page was handed, already filtered
  // to what may be served publicly.
  // Empty on the public page means gone. For the owner it means a section
  // with a way to ask somebody for the first one.
  if (!hasQuotes && !canShowEmpty) return null

  return (
    <section className="hp-impact">
      <div className="hp-wrap">
        {/* One heading over both columns, because the synthesis on the left and
            the accounts on the right are two readings of the same thing. What
            each column is then says so inside the column itself. */}
        <Reveal enabled={animate} className={`hp-impact-intro${slot}`}>
          <h2 className="hp-impact-headline">What others see.</h2>
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
            <button
              type="button"
              className="hp-ed-manage"
              aria-haspopup="dialog"
              onClick={() => { setPane(null); setManageOpen(true) }}
            >
              Manage testimonials
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
                Once you publish enough testimonials, Hire Power will find the
                patterns across them and turn those patterns into a clear view of
                your impact.
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

              {/* The scroll region. Focusable so the keyboard can reach it and
                  move it, and labelled so what is being scrolled is announced.
                  A single account fits inside it and simply never scrolls. */}
              <div
                className="hp-voices-scroll"
                ref={scrollRef}
                tabIndex={0}
                role="region"
                aria-label="Firsthand accounts"
              >
                <ul className="hp-voices">
                  {quotes.map((quote, i) => {
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
              onClose={closeManage}
            >
              {pane === 'request' ? (
                <TestimonialRequestPane
                  onBack={() => setPane(null)}
                  // Back to the list, and the list now has the new request in
                  // it. The name comes back so the confirmation can say who was
                  // asked rather than that something happened.
                  onSent={(name) => { setPane(null); setSentTo(name) }}
                />
              ) : paneItem ? (
                <TestimonialEditPane item={paneItem} onBack={() => setPane(null)} />
              ) : (
                <ManageList
                  items={manageItems}
                  busyId={busyId}
                  onToggle={toggleItem}
                  onDrop={dropItem}
                  onEdit={setPane}
                  onAdd={() => setPane('request')}
                  addLabel="Request a testimonial"
                  secondaryLabel="Download reference sheet"
                  onSecondary={() => edit?.onDownloadReferenceSheet?.()}
                  onDone={closeManage}
                  emptyNote="Nobody has been asked yet. Request a testimonial to start."
                  notice={sentTo ? `Request sent to ${sentTo}. It is in the list below, waiting on them.` : null}
                  note="Manage requests, review what people have shared, and choose what appears on your profile. You can show, hide, or re-order testimonials anytime."
                />
              )}
            </ProfileModal>
          ) : null}
        </div>
      </div>
    </section>
  )
}
