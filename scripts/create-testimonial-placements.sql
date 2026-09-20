-- ============================================================================
-- TESTIMONIALS — where each direction places them, and what "hidden" means
--
-- Run once in the Supabase SQL editor. Idempotent: safe to re-run, and safe to
-- re-run after a partial run, because every constraint, index, policy, trigger
-- and backfill is guarded rather than assumed.
--
-- This is create-evidence-placements.sql applied to the other collection, plus
-- the one thing that file did not have: a way to take an item off a direction
-- without losing where it sat in it.
--
-- WHY TESTIMONIALS NEEDED A TABLE AND NOT A COLUMN
-- profile_testimonials has no ordering column of any kind - not per direction,
-- not global - and lens_ids is a json array, which can say which directions an
-- item belongs to but cannot say where in each one. A column would have bought
-- one global order. This buys the same thing evidence already has.
--
-- WHAT `hidden` IS FOR, ON BOTH TABLES
-- Taking an item off a direction used to mean deleting its placement, which
-- threw away its position and its lead status with it; putting it back landed
-- it at the end. `hidden` is the row staying exactly where it is and not being
-- rendered. Nothing is deleted, nothing is renumbered, and restoring is one
-- boolean rather than a guess at where the thing used to be.
--
-- WHAT THIS DOES NOT TOUCH
-- lens_ids. Not read, not written, not cleared. An earlier draft of this file
-- seeded the placements from it, which would have been a real change to what
-- published profiles show: nothing reads lens_ids for display today, so every
-- published testimonial appears on every direction, and honouring the array
-- would have narrowed several of them the moment this ran. Whether that
-- categorisation should ever reach a reader is a product decision and not a
-- migration's to make.
--
-- RUNNING THIS CHANGES NOTHING ANYBODY CAN SEE
-- Every testimonial is backfilled into the shared layer, which is where they
-- all effectively are now. The shared layer deliberately does not order the
-- page: the reader still gets the collective-impact synthesis's own ranking
-- for the direction they are on, exactly as before. A direction only stops
-- following that ranking when its owner hides or reorders something in it,
-- which is the first moment a per-direction list exists at all.
--
-- So the sort_order written below is not what anybody reads. It is the
-- substrate the first per-direction edit copies from, and the route that
-- copies it re-sorts by that direction's generated ranking as it goes, so
-- even that first edit does not reshuffle the page.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Hiding, on the placements that already exist
--
-- Default false, so every row already there keeps being shown and nothing
-- about the current page changes when this runs.
-- ---------------------------------------------------------------------------

alter table public.profile_evidence_placements
  add column if not exists hidden boolean not null default false;

-- The read path asks for one direction's visible placements in order; hidden
-- belongs in that index rather than being filtered after the fact.
create index if not exists profile_evidence_placements_visible_idx
  on public.profile_evidence_placements (profile_id, lens_id, sort_order)
  where not hidden;


-- ---------------------------------------------------------------------------
-- 2. The parent needs a key a composite foreign key can point at
--
-- Both columns are already unique by primary key; this states the pair in the
-- form the placement table can reference, which is what stops one profile's
-- testimonial being attached to another profile's direction.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_constraint
                 where conname = 'profile_testimonials_id_profile_id_key'
                   and conrelid = 'public.profile_testimonials'::regclass) then
    alter table public.profile_testimonials
      add constraint profile_testimonials_id_profile_id_key unique (id, profile_id);
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- 3. Where each direction places a testimonial
--
-- References only. The words, the referee and the consent live once, on
-- profile_testimonials. A row with a null lens_id is the shared default layer
-- a direction with no curation of its own falls back to.
--
-- No `featured` column. Evidence has a lead item per direction; a collection
-- of quotations does not, and a column nothing writes is a column somebody
-- later mistakes for a feature.
-- ---------------------------------------------------------------------------

create table if not exists public.profile_testimonial_placements (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.career_profiles(id) on delete cascade,
  testimonial_id uuid not null,
  lens_id uuid,
  sort_order integer not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Added separately rather than inline, so a table created by an earlier
-- partial run still gains them on a re-run.
do $$
begin
  if not exists (select 1 from pg_constraint
                 where conname = 'profile_testimonial_placements_testimonial_fk'
                   and conrelid = 'public.profile_testimonial_placements'::regclass) then
    alter table public.profile_testimonial_placements
      add constraint profile_testimonial_placements_testimonial_fk
      foreign key (testimonial_id, profile_id)
      references public.profile_testimonials (id, profile_id) on delete cascade;
  end if;

  -- MATCH SIMPLE, which is what makes the shared layer work: with lens_id null
  -- the constraint does not apply, so a shared placement needs no lens at all.
  if not exists (select 1 from pg_constraint
                 where conname = 'profile_testimonial_placements_lens_fk'
                   and conrelid = 'public.profile_testimonial_placements'::regclass) then
    alter table public.profile_testimonial_placements
      add constraint profile_testimonial_placements_lens_fk
      foreign key (lens_id, profile_id)
      references public.profile_lenses (id, profile_id) on delete cascade;
  end if;
end $$;

-- Uniqueness, written twice because null is not equal to null. A plain unique
-- constraint on (testimonial_id, lens_id) would let the same item be placed in
-- the shared layer any number of times, because every one of those rows
-- carries a distinct null.
create unique index if not exists profile_testimonial_placements_lens_key
  on public.profile_testimonial_placements (testimonial_id, lens_id)
  where lens_id is not null;

create unique index if not exists profile_testimonial_placements_shared_key
  on public.profile_testimonial_placements (testimonial_id)
  where lens_id is null;

create index if not exists profile_testimonial_placements_read_idx
  on public.profile_testimonial_placements (profile_id, lens_id, sort_order);

create index if not exists profile_testimonial_placements_visible_idx
  on public.profile_testimonial_placements (profile_id, lens_id, sort_order)
  where not hidden;

create index if not exists profile_testimonial_placements_testimonial_idx
  on public.profile_testimonial_placements (testimonial_id);


-- ---------------------------------------------------------------------------
-- 4. Seed the shared layer
--
-- Every testimonial, once, with no direction. That is what they all are today
-- - the public page serves the lot on every direction - so this writes down
-- the arrangement that already exists rather than imposing a new one.
--
-- lens_ids is deliberately not consulted. See the note at the top.
--
-- ORDER. Newest first, matching the order the owner's own management list has
-- always shown them in. Nothing reads it yet: the public page orders by the
-- synthesis's ranking, and this only becomes a starting point if a direction
-- is later curated - at which point the route that materialises the list
-- re-sorts it into that direction's ranking anyway.
--
-- Guarded by NOT EXISTS rather than ON CONFLICT alone, so a re-run after a
-- partial run neither duplicates a row nor renumbers one that is already
-- there and may since have been moved.
-- ---------------------------------------------------------------------------

with unplaced as (
  select t.profile_id, t.id as testimonial_id,
         row_number() over (partition by t.profile_id order by t.created_at desc) - 1 as rank
  from public.profile_testimonials t
  where not exists (
    select 1 from public.profile_testimonial_placements p
    where p.testimonial_id = t.id
  )
)
insert into public.profile_testimonial_placements
  (profile_id, testimonial_id, lens_id, sort_order, hidden)
select profile_id, testimonial_id, null, rank, false
from unplaced
on conflict do nothing;


-- ---------------------------------------------------------------------------
-- 5. updated_at, maintained rather than merely defaulted
--
-- A default only fires on insert. Reuses whichever trigger function this
-- database already has, the same way the evidence file does, and creates the
-- smallest possible one only if there is none.
-- ---------------------------------------------------------------------------

do $$
declare
  fn text;
begin
  select n.nspname || '.' || p.proname into fn
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where p.prorettype = 'pg_catalog.trigger'::regtype
    and p.pronargs = 0
    and p.proname in ('hp_set_updated_at', 'set_updated_at', 'handle_updated_at',
                      'update_updated_at_column', 'trigger_set_timestamp')
  order by case when n.nspname = 'public' then 0 else 1 end, p.proname
  limit 1;

  if fn is null then
    execute $fn$
      create or replace function public.hp_set_updated_at() returns trigger
      language plpgsql
      as $body$
      begin
        new.updated_at = now();
        return new;
      end;
      $body$;
    $fn$;
    fn := 'public.hp_set_updated_at';
    raise notice 'created %', fn;
  else
    raise notice 'reusing existing trigger function %', fn;
  end if;

  execute 'drop trigger if exists profile_testimonial_placements_set_updated_at on public.profile_testimonial_placements';
  execute format(
    'create trigger profile_testimonial_placements_set_updated_at
     before update on public.profile_testimonial_placements
     for each row execute function %s()', fn);
end $$;


-- ---------------------------------------------------------------------------
-- 6. Row level security
--
-- The same shape profile_evidence_placements uses: nothing for anonymous
-- callers, everything for the owner of the profile the row belongs to, and the
-- public Career Profile keeps reading through its service-role API route
-- rather than through a public policy.
-- ---------------------------------------------------------------------------

alter table public.profile_testimonial_placements enable row level security;

drop policy if exists profile_testimonial_placements_owner_select on public.profile_testimonial_placements;
drop policy if exists profile_testimonial_placements_owner_insert on public.profile_testimonial_placements;
drop policy if exists profile_testimonial_placements_owner_update on public.profile_testimonial_placements;
drop policy if exists profile_testimonial_placements_owner_delete on public.profile_testimonial_placements;

create policy profile_testimonial_placements_owner_select
  on public.profile_testimonial_placements for select to authenticated
  using (exists (
    select 1 from public.career_profiles cp
    where cp.id = profile_testimonial_placements.profile_id and cp.user_id = auth.uid()
  ));

create policy profile_testimonial_placements_owner_insert
  on public.profile_testimonial_placements for insert to authenticated
  with check (exists (
    select 1 from public.career_profiles cp
    where cp.id = profile_testimonial_placements.profile_id and cp.user_id = auth.uid()
  ));

create policy profile_testimonial_placements_owner_update
  on public.profile_testimonial_placements for update to authenticated
  using (exists (
    select 1 from public.career_profiles cp
    where cp.id = profile_testimonial_placements.profile_id and cp.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.career_profiles cp
    where cp.id = profile_testimonial_placements.profile_id and cp.user_id = auth.uid()
  ));

create policy profile_testimonial_placements_owner_delete
  on public.profile_testimonial_placements for delete to authenticated
  using (exists (
    select 1 from public.career_profiles cp
    where cp.id = profile_testimonial_placements.profile_id and cp.user_id = auth.uid()
  ));


-- ---------------------------------------------------------------------------
-- 7. What the columns mean
-- ---------------------------------------------------------------------------

comment on table public.profile_testimonial_placements is
  'Which testimonials a direction shows and in what order. References only: never a copy of anybody''s words. A null lens_id is the shared default layer a direction with no curation of its own falls back to.';

comment on column public.profile_testimonial_placements.hidden is
  'Taken off this direction without being taken out of it. The row keeps its sort_order, so restoring puts the testimonial back where it was rather than at the end. Never means deleted: the testimonial, the referee and the consent are untouched, and its placements in other directions are untouched.';

comment on column public.profile_testimonial_placements.sort_order is
  'Position within one direction, dense from 0. The shared layer''s order is a substrate rather than something anybody reads: the public page orders by the collective-impact synthesis until a direction has a list of its own, and the route that creates that list sorts it by the same ranking as it copies.';

comment on column public.profile_evidence_placements.hidden is
  'Taken off this direction without being taken out of it. The row keeps its sort_order and its featured flag, so restoring puts the item back where it was. Never means deleted: the record, the file and the placements in other directions are untouched.';

comment on column public.profile_testimonials.lens_ids is
  'Legacy, and untouched by the placement migration - which deliberately did not read it, because nothing reads it for display and honouring it would have narrowed what published profiles show. profile_testimonial_placements is where a direction says which testimonials it shows and in what order.';
