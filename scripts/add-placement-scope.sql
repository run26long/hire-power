-- ============================================================================
-- PLACEMENT SCOPE: "all directions" becomes something an item can say
--
-- Run once in the Supabase SQL editor. Idempotent: safe to re-run, and safe to
-- re-run after a partial run, because every statement is guarded rather than
-- assumed.
--
-- WHAT WAS WRONG WITH THE SHARED LAYER
-- A placement with a null lens_id meant "use this when a direction has none of
-- its own" - a fallback. The product rule is "this item is on every direction",
-- which is membership. The two are different claims, and the difference shows
-- up the moment both kinds have to appear together: a fallback is by definition
-- what a direction uses INSTEAD of its own list, so an item on all directions
-- and an item picked for one could never combine. Readers resolved
-- `byLens[lensId] ?? shared`, never a union, and no amount of care in the
-- readers could fix that - the data had nowhere to put the distinction.
--
-- So membership moves onto the item, where it is one fact in one column, and
-- the placement rows go back to being what they are good at: where a direction
-- puts something, in what order, whether it leads, and whether it is currently
-- shown.
--
--   placement_scope = 'all'       on every direction that is not dismissed
--   placement_scope = 'selected'  on exactly the directions it has rows for
--
-- An item is on direction L when:
--
--   (scope = 'all' OR a row for L exists) AND NOT (row for L exists AND hidden)
--
-- which makes `hidden` do a second useful job: it is how an 'all' item comes
-- off one direction without ceasing to be an 'all' item.
--
-- WHY 'all' IS A FLAG AND NOT A ROW PER DIRECTION
-- Because "including directions created later" has to keep being true. Rows
-- would make it a snapshot kept correct by a trigger, and directions are
-- inserted from three different places today - build-core, ensurePrimaryLens
-- and create-custom - so anything that missed one would drop the item silently.
-- A flag cannot drift.
--
-- NOTHING ANY PUBLISHED PROFILE SHOWS CHANGES
-- Every case is converted to the arrangement it is already rendering:
--
--   evidence with direction rows    -> 'selected', rows untouched
--   evidence with no rows at all    -> 'selected' with none, still invisible
--   evidence with only shared rows  -> 'all'   (none exist today)
--   testimonials with direction rows-> 'selected', rows untouched
--   testimonials shared-only or none-> 'all', which is where they already are
--
-- The last line is the one that matters most. Nothing reads lens_ids for
-- display, so every published testimonial appears on every direction today;
-- 'all' is that arrangement written down rather than a new one imposed.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. The column
--
-- Default 'all', because that is the new item's answer and because it is also
-- the right answer for every row this migration does not explicitly change.
-- ---------------------------------------------------------------------------

alter table public.profile_evidence
  add column if not exists placement_scope text not null default 'all';

alter table public.profile_testimonials
  add column if not exists placement_scope text not null default 'all';

do $$
begin
  if not exists (select 1 from pg_constraint
                 where conname = 'profile_evidence_placement_scope_check'
                   and conrelid = 'public.profile_evidence'::regclass) then
    alter table public.profile_evidence
      add constraint profile_evidence_placement_scope_check
      check (placement_scope in ('all', 'selected'));
  end if;

  if not exists (select 1 from pg_constraint
                 where conname = 'profile_testimonials_placement_scope_check'
                   and conrelid = 'public.profile_testimonials'::regclass) then
    alter table public.profile_testimonials
      add constraint profile_testimonials_placement_scope_check
      check (placement_scope in ('all', 'selected'));
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- 2. Write down what each item is already doing
--
-- Before the shared rows are deleted, because two of these tests read them.
-- Every update is idempotent: re-running sets the same rows to the same value.
-- ---------------------------------------------------------------------------

-- Evidence holding a direction row is showing on exactly those directions.
update public.profile_evidence e
   set placement_scope = 'selected'
 where exists (
   select 1 from public.profile_evidence_placements p
    where p.evidence_id = e.id and p.lens_id is not null
 );

-- Evidence with no placement of any kind is on no direction and is invisible
-- on the public page today. 'selected' with no rows is that same state, said
-- in the new vocabulary - and it is exactly where a direction deletion leaves
-- an orphan, so the two agree.
--
-- This is deliberately NOT 'all'. Reading an unplaced item as "show it
-- everywhere" would put things on published profiles that are not on them now.
update public.profile_evidence e
   set placement_scope = 'selected'
 where not exists (
   select 1 from public.profile_evidence_placements p
    where p.evidence_id = e.id
 );

-- Testimonials holding a direction row are curated to those directions.
-- Everything else keeps the 'all' default: a testimonial with only shared rows
-- and a testimonial with no rows at all both render on every direction today.
update public.profile_testimonials t
   set placement_scope = 'selected'
 where exists (
   select 1 from public.profile_testimonial_placements p
    where p.testimonial_id = t.id and p.lens_id is not null
 );


-- ---------------------------------------------------------------------------
-- 3. Retire the shared layer
--
-- Its meaning now lives in placement_scope, and leaving the rows behind would
-- leave two answers to the same question. Deleting them changes nothing that
-- renders: step 2 has already recorded what each one was saying.
-- ---------------------------------------------------------------------------

delete from public.profile_evidence_placements    where lens_id is null;
delete from public.profile_testimonial_placements where lens_id is null;


-- ---------------------------------------------------------------------------
-- 4. A placement is now always about a direction
--
-- With the null layer gone the column can say so, which is what removes the
-- `is not distinct from` handling from every query that touches it.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public'
                and table_name = 'profile_evidence_placements'
                and column_name = 'lens_id'
                and is_nullable = 'YES') then
    alter table public.profile_evidence_placements alter column lens_id set not null;
  end if;

  if exists (select 1 from information_schema.columns
              where table_schema = 'public'
                and table_name = 'profile_testimonial_placements'
                and column_name = 'lens_id'
                and is_nullable = 'YES') then
    alter table public.profile_testimonial_placements alter column lens_id set not null;
  end if;
end $$;

-- The three partial indexes that existed only to constrain the null layer.
-- Their `where lens_id is null` can never match again.
drop index if exists public.profile_evidence_placements_shared_key;
drop index if exists public.profile_evidence_placements_featured_shared_key;
drop index if exists public.profile_testimonial_placements_shared_key;

-- The two that remain are now unconditional in effect, since lens_id cannot be
-- null, but they are left partial rather than rebuilt: the predicate is simply
-- always true, and rebuilding a unique index on a live table buys nothing.


-- ---------------------------------------------------------------------------
-- 5. The dead columns
--
-- profile_evidence.lens_ids was read exactly once, by
-- create-evidence-placements.sql, to seed the placement table.
-- profile_testimonials.lens_ids was never read at all - that file says so in
-- its own header, and declined to honour it on the grounds that doing so would
-- have narrowed live profiles.
--
-- Nothing in the application writes either column. The only code that still
-- names the testimonial one is a select list in /api/career-profile/manage,
-- which sends it to the owner's browser where nothing reads it.
-- ---------------------------------------------------------------------------

alter table public.profile_evidence     drop column if exists lens_ids;
alter table public.profile_testimonials drop column if exists lens_ids;


-- ---------------------------------------------------------------------------
-- 6. Documentation on the columns themselves
-- ---------------------------------------------------------------------------

comment on column public.profile_evidence.placement_scope is
  'Which directions this item is on. ''all'' means every direction that is not dismissed, including ones created later, and needs no placement rows to say so. ''selected'' means exactly the directions it holds a placement row for; with no rows it is on none, which is where a deleted direction leaves an item that was only on it. A placement row still carries order, lead and hidden in both cases.';

comment on column public.profile_testimonials.placement_scope is
  'Which directions this testimonial is on. ''all'' means every direction that is not dismissed, including ones created later. ''selected'' means exactly the directions it holds a placement row for; with no rows it is on none. The person who wrote the testimonial never sees directions - the owner sets this when reviewing it.';


-- ---------------------------------------------------------------------------
-- 7. set_featured_placement, under the new model
--
-- Two things change and nothing else does.
--
-- THE SHARED LAYER IS GONE, so p_lens_id is required and every
-- `is not distinct from` becomes `=`. Passing null now means the caller has
-- lost track of which direction it is starring in, which is a bug rather than
-- a layer, and is refused.
--
-- AN 'all' ITEM MAY HAVE NO ROW YET. The old guard refused to star anything
-- without a placement, on the principle that featuring is not a way to place
-- something. That principle still holds exactly - what has changed is what
-- "placed" means. An item with scope 'all' IS on this direction; it simply has
-- no row recording where it sits. So the guard now asks the membership
-- question, and creates the row when the answer is yes.
--
-- An item with scope 'selected' and no row for this direction is still not on
-- it, and is still refused. Starring still cannot place anything.
-- ---------------------------------------------------------------------------

create or replace function public.set_featured_placement(
  p_user_id     uuid,
  p_lens_id     uuid,
  p_evidence_id uuid
)
returns table (
  evidence_id uuid,
  lens_id     uuid,
  featured    boolean,
  sort_order  integer
)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_profile_id uuid;
  v_scope      text;
  v_next       integer;
begin
  select cp.id into v_profile_id
    from public.career_profiles cp
   where cp.user_id = p_user_id;

  if v_profile_id is null then
    raise exception 'NO_PROFILE' using errcode = '42501';
  end if;

  -- There is no shared layer to star in any more.
  if p_lens_id is null then
    raise exception 'LENS_NOT_FOUND' using errcode = '42501';
  end if;

  -- A direction from another account is not a direction this user may star in.
  if not exists (
    select 1 from public.profile_lenses pl
     where pl.id = p_lens_id and pl.profile_id = v_profile_id
  ) then
    raise exception 'LENS_NOT_FOUND' using errcode = '42501';
  end if;

  if p_evidence_id is not null then
    select e.placement_scope into v_scope
      from public.profile_evidence e
     where e.id = p_evidence_id and e.profile_id = v_profile_id;

    if v_scope is null then
      raise exception 'PLACEMENT_NOT_FOUND' using errcode = '42501';
    end if;

    -- On this direction by a row, or on it by being an 'all' item. Anything
    -- else is not here and cannot lead.
    if not exists (
      select 1 from public.profile_evidence_placements pep
       where pep.profile_id  = v_profile_id
         and pep.evidence_id = p_evidence_id
         and pep.lens_id     = p_lens_id
    ) then
      if v_scope <> 'all' then
        raise exception 'PLACEMENT_NOT_FOUND' using errcode = '42501';
      end if;

      -- An 'all' item leading a direction that has never been arranged. The
      -- row is created at the end, which is where it was already rendering.
      select coalesce(max(pep.sort_order) + 1, 0) into v_next
        from public.profile_evidence_placements pep
       where pep.profile_id = v_profile_id
         and pep.lens_id    = p_lens_id;

      insert into public.profile_evidence_placements
        (profile_id, evidence_id, lens_id, sort_order, featured, hidden)
      values
        (v_profile_id, p_evidence_id, p_lens_id, v_next, false, false)
      on conflict do nothing;
    end if;
  end if;

  -- Clear first, or the unique index refuses the second write. The target is
  -- excluded, so re-starring the item that already leads is a no-op rather
  -- than a clear followed by a set.
  update public.profile_evidence_placements pep
     set featured = false,
         updated_at = now()
   where pep.profile_id = v_profile_id
     and pep.lens_id    = p_lens_id
     and pep.featured
     and (p_evidence_id is null or pep.evidence_id <> p_evidence_id);

  if p_evidence_id is not null then
    update public.profile_evidence_placements pep
       set featured = true,
           updated_at = now()
     where pep.profile_id  = v_profile_id
       and pep.lens_id     = p_lens_id
       and pep.evidence_id = p_evidence_id;
  end if;

  return query
    select pep.evidence_id, pep.lens_id, pep.featured, pep.sort_order
      from public.profile_evidence_placements pep
     where pep.profile_id = v_profile_id
       and pep.lens_id    = p_lens_id
     order by pep.sort_order asc, pep.created_at asc;
end;
$$;

comment on function public.set_featured_placement(uuid, uuid, uuid) is
  'Moves the featured flag within one direction in a single transaction, because one-featured-per-direction is enforced by a unique index and a two-statement swap can leave a direction with none. An item with placement_scope ''all'' is on the direction without holding a row, so the row is created before it can lead; an item that is not on the direction is refused. Derives the profile from p_user_id and refuses any lens or evidence id belonging to another account. Callable only by the service role; the route supplies p_user_id from a verified token.';

revoke all on function public.set_featured_placement(uuid, uuid, uuid) from public;
revoke all on function public.set_featured_placement(uuid, uuid, uuid) from anon;
revoke all on function public.set_featured_placement(uuid, uuid, uuid) from authenticated;
grant execute on function public.set_featured_placement(uuid, uuid, uuid) to service_role;


-- ---------------------------------------------------------------------------
-- Checking it took
--
--   select placement_scope, count(*) from public.profile_evidence     group by 1;
--   select placement_scope, count(*) from public.profile_testimonials group by 1;
--
--   -- expect zero rows from both
--   select count(*) from public.profile_evidence_placements    where lens_id is null;
--   select count(*) from public.profile_testimonial_placements where lens_id is null;
--
--   -- expect neither column to be listed
--   select table_name, column_name from information_schema.columns
--    where table_schema = 'public' and column_name = 'lens_ids';
-- ---------------------------------------------------------------------------
