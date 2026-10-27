-- ============================================================================
-- HIDDEN PLACEMENTS — retired, without changing what anybody sees
--
-- Run once in the Supabase SQL editor, BEFORE deploying the change that makes
-- the manage panels' per-direction toggles write through the directions route.
--
-- WHY THIS EXISTS
-- Two mechanisms grew up saying the same thing. A placement row's `hidden`
-- flag means "this direction has this item but is not showing it". Deleting
-- the row means "this direction does not have this item". Until now the row
-- switch in the manage panels used the first and the direction picker used
-- the second, so "off" meant two different things depending on which control
-- you reached for.
--
-- From here both controls use the directions route, which keeps rows for the
-- directions an item is on and deletes the rest, and sets hidden = false on
-- every row it keeps. That makes `hidden = true` unreachable going forward -
-- but the rows already carrying it would be stranded: the route would see a
-- row, count the item as placed, and never clear the flag. The toggle would
-- read off, accept a press, report success, and change nothing.
--
-- WHAT THIS DOES, AND WHY IT IS NOT JUST `set hidden = false`
-- Clearing the flag would turn every hidden item back on, which is the one
-- outcome nobody asked for. The page has to look exactly the same after this
-- runs as it does before it. So a hidden row is deleted instead: off by not
-- being there, which is what off now means.
--
-- Deleting is only half of it. An item with placement_scope = 'all' is on
-- every direction WITHOUT a row to say so, and a hidden row is how one
-- direction took such an item off. Delete that row on its own and the item
-- goes straight back to being on everything, including the direction it was
-- hidden from. So an item in that position is pinned down first:
--
--   1. a row is written for every direction it is currently on and has no row
--      for, at the end of that direction's order, which is exactly where
--      `materialise` in app/api/career-profile/_lib/placements.js would put it
--   2. its scope becomes 'selected', so those rows are now the whole answer
--      and `materialise` will not re-create the ones about to be deleted
--   3. the hidden rows are deleted
--
-- Items already on 'selected' need only step 3: their remaining rows are
-- already the whole answer.
--
-- WHICH DIRECTIONS GET A ROW IN STEP 1
-- Those with status 'active' or 'hidden' - the same set the direction picker
-- offers, so what this writes is exactly what the picker will show ticked. A
-- 'suggested' direction is a proposal nobody has adopted and a 'dismissed'
-- one is in the bin; pinning an item to either would write rows no control on
-- the profile can see or undo.
--
-- WHAT IS LOST
-- A hidden row's position in its direction, and its `featured` flag if it
-- somehow carried one. Both are already unreachable: a direction cannot lead
-- with an item it is not showing, and the position only mattered for putting
-- the item back where it was, which is the behaviour being retired.
--
-- Soft-deleted evidence is left out of steps 1 and 2 - a deleted item must
-- not be written into a direction - but its hidden rows are deleted with the
-- rest in step 3, where they are inert either way.
--
-- THE COLUMN STAYS
-- `hidden` is not dropped. Nothing writes true to it after this, and the read
-- path still honours it, so a row that somehow acquires the flag behaves the
-- way it always did rather than meeting a column that is no longer there.
--
-- Safe to re-run: afterwards there are no hidden rows, so every statement
-- matches nothing.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- STEP 0 — WHAT THIS WILL CHANGE. Run this on its own first. It writes
-- nothing. If every count is 0 there is nothing to do and the rest of the
-- file is a no-op.
-- ---------------------------------------------------------------------------

select 'evidence: hidden rows to delete' as change, count(*) as rows
  from public.profile_evidence_placements
 where hidden = true

union all
select 'evidence: items moving from scope all to selected', count(distinct p.evidence_id)
  from public.profile_evidence_placements p
  join public.profile_evidence e
    on e.id = p.evidence_id and e.deleted_at is null
 where p.hidden = true and e.placement_scope = 'all'

union all
select 'evidence: placement rows to write so nothing disappears', count(*)
  from (
    select a.evidence_id, l.id as lens_id
      from (
        select distinct p.evidence_id, p.profile_id
          from public.profile_evidence_placements p
          join public.profile_evidence e
            on e.id = p.evidence_id and e.deleted_at is null
         where p.hidden = true and e.placement_scope = 'all'
      ) a
      join public.profile_lenses l
        on l.profile_id = a.profile_id and l.status in ('active', 'hidden')
     where not exists (
       select 1 from public.profile_evidence_placements p
        where p.evidence_id = a.evidence_id and p.lens_id = l.id
     )
  ) gaps

union all
select 'testimonials: hidden rows to delete', count(*)
  from public.profile_testimonial_placements
 where hidden = true

union all
select 'testimonials: items moving from scope all to selected', count(distinct p.testimonial_id)
  from public.profile_testimonial_placements p
  join public.profile_testimonials t on t.id = p.testimonial_id
 where p.hidden = true and t.placement_scope = 'all'

union all
select 'testimonials: placement rows to write so nothing disappears', count(*)
  from (
    select a.testimonial_id, l.id as lens_id
      from (
        select distinct p.testimonial_id, p.profile_id
          from public.profile_testimonial_placements p
          join public.profile_testimonials t on t.id = p.testimonial_id
         where p.hidden = true and t.placement_scope = 'all'
      ) a
      join public.profile_lenses l
        on l.profile_id = a.profile_id and l.status in ('active', 'hidden')
     where not exists (
       select 1 from public.profile_testimonial_placements p
        where p.testimonial_id = a.testimonial_id and p.lens_id = l.id
     )
  ) gaps;


-- ---------------------------------------------------------------------------
-- THE CHANGE. All of it or none of it: the three steps only make sense
-- together, and a run that stopped between them would leave items on fewer
-- directions than they are on now.
-- ---------------------------------------------------------------------------

begin;


-- ---- 1. EVIDENCE: pin down what 'all' was covering -----------------------
--
-- Only items that are on every direction by scope AND have been hidden from
-- one of them. A row is written for each direction they are on and have no
-- row for, after the rows already in that direction, in the order that
-- direction is already reading them - which for evidence is the collection's
-- own sort_order. Nothing that already holds a row is touched or renumbered.

with affected as (
  select distinct p.evidence_id, p.profile_id
    from public.profile_evidence_placements p
    join public.profile_evidence e
      on e.id = p.evidence_id and e.deleted_at is null
   where p.hidden = true and e.placement_scope = 'all'
),
gaps as (
  select a.profile_id, a.evidence_id, l.id as lens_id
    from affected a
    join public.profile_lenses l
      on l.profile_id = a.profile_id and l.status in ('active', 'hidden')
   where not exists (
     select 1 from public.profile_evidence_placements p
      where p.evidence_id = a.evidence_id and p.lens_id = l.id
   )
),
numbered as (
  select
    g.profile_id,
    g.evidence_id,
    g.lens_id,
    coalesce(
      (select max(p.sort_order) + 1
         from public.profile_evidence_placements p
        where p.lens_id = g.lens_id and p.profile_id = g.profile_id),
      0
    ) + (row_number() over (
          partition by g.lens_id
          order by e.sort_order nulls last, e.created_at
        ) - 1) as sort_order
    from gaps g
    join public.profile_evidence e on e.id = g.evidence_id
)
insert into public.profile_evidence_placements
  (profile_id, evidence_id, lens_id, sort_order, hidden)
select profile_id, evidence_id, lens_id, sort_order, false
  from numbered
    on conflict (evidence_id, lens_id) where lens_id is not null do nothing;


-- ---- 2. EVIDENCE: the rows are now the whole answer -----------------------
--
-- Read from the hidden rows again rather than from step 1, because an item
-- can reach here with no gaps to fill: one already holding a row for every
-- direction still has to stop saying 'all', or materialise writes the deleted
-- row straight back.

update public.profile_evidence e
   set placement_scope = 'selected',
       updated_at = now()
 where e.placement_scope = 'all'
   and e.deleted_at is null
   and exists (
     select 1 from public.profile_evidence_placements p
      where p.evidence_id = e.id and p.hidden = true
   );


-- ---- 3. TESTIMONIALS: the same two steps ---------------------------------
--
-- The collection has no ordering column of its own, so the order a direction
-- reads them in falls back to newest first, which is what the placement store
-- uses as its own floor.

with affected as (
  select distinct p.testimonial_id, p.profile_id
    from public.profile_testimonial_placements p
    join public.profile_testimonials t on t.id = p.testimonial_id
   where p.hidden = true and t.placement_scope = 'all'
),
gaps as (
  select a.profile_id, a.testimonial_id, l.id as lens_id
    from affected a
    join public.profile_lenses l
      on l.profile_id = a.profile_id and l.status in ('active', 'hidden')
   where not exists (
     select 1 from public.profile_testimonial_placements p
      where p.testimonial_id = a.testimonial_id and p.lens_id = l.id
   )
),
numbered as (
  select
    g.profile_id,
    g.testimonial_id,
    g.lens_id,
    coalesce(
      (select max(p.sort_order) + 1
         from public.profile_testimonial_placements p
        where p.lens_id = g.lens_id and p.profile_id = g.profile_id),
      0
    ) + (row_number() over (
          partition by g.lens_id
          order by t.created_at desc
        ) - 1) as sort_order
    from gaps g
    join public.profile_testimonials t on t.id = g.testimonial_id
)
insert into public.profile_testimonial_placements
  (profile_id, testimonial_id, lens_id, sort_order, hidden)
select profile_id, testimonial_id, lens_id, sort_order, false
  from numbered
    on conflict (testimonial_id, lens_id) where lens_id is not null do nothing;


update public.profile_testimonials t
   set placement_scope = 'selected',
       updated_at = now()
 where t.placement_scope = 'all'
   and exists (
     select 1 from public.profile_testimonial_placements p
      where p.testimonial_id = t.id and p.hidden = true
   );


-- ---- 4. THE HIDDEN ROWS GO -----------------------------------------------
--
-- Every one of them, including those belonging to soft-deleted evidence,
-- which steps 1 to 3 deliberately left alone. Off is now expressed by the
-- absence of a row, and these are the rows.

delete from public.profile_evidence_placements where hidden = true;
delete from public.profile_testimonial_placements where hidden = true;


commit;


-- ---------------------------------------------------------------------------
-- AFTERWARDS. All three counts should be 0. The third is the one worth
-- reading: an item on 'selected' with no rows at all is on no direction, and
-- if this migration produced any, something in step 1 did not land.
-- ---------------------------------------------------------------------------

select 'evidence: hidden rows remaining' as check, count(*) as rows
  from public.profile_evidence_placements where hidden = true

union all
select 'testimonials: hidden rows remaining', count(*)
  from public.profile_testimonial_placements where hidden = true

union all
select 'evidence: scope selected, on no direction', count(*)
  from public.profile_evidence e
 where e.placement_scope = 'selected'
   and e.deleted_at is null
   and not exists (
     select 1 from public.profile_evidence_placements p where p.evidence_id = e.id
   );
