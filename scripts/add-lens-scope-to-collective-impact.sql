-- ============================================================================
-- DIRECTION-SPECIFIC COLLECTIVE IMPACT
--
-- Run once in the Supabase SQL editor. Idempotent: safe to re-run.
--
-- `profile_collective_impacts` already holds exactly what a direction needs —
-- one synthesis paragraph and an ordered array of three themes — but it holds
-- one row per profile, so every direction shows the same reading of the same
-- testimonials. This gives the table a direction, following the scope pattern
-- `profile_skill_proofs` already established: a nullable lens_id, and partial
-- uniqueness so a profile can carry one row per direction.
--
-- The row that is already there keeps lens_id null. That is deliberate: it
-- stays the shared synthesis, and it is what a direction that has not been
-- regenerated yet falls back to. Nothing is copied into the new rows to make
-- the profile look finished, and no existing row is rewritten by this file.
--
-- testimonial_order is references only — an ordered array of
-- profile_testimonials ids and nothing else. The testimonials remain the single
-- canonical shared records; a direction may say which of them to read first,
-- never what any of them says. An id in here is a claim to be checked at read
-- time, not a promise: the reader validates every one against that profile's
-- own published testimonials, so an id that has since been deleted, unpublished
-- or made private resolves to nothing, and a testimonial added after this order
-- was written simply follows the ranked ones in its existing stable order.
-- ============================================================================

alter table public.profile_collective_impacts
  add column if not exists lens_id uuid references public.profile_lenses(id) on delete cascade;

alter table public.profile_collective_impacts
  add column if not exists testimonial_order jsonb not null default '[]'::jsonb;

-- The table's old uniqueness was profile_id alone, which is exactly what now
-- has to give: one row per profile becomes one row per profile per direction,
-- plus at most one profile-wide row. Whatever that constraint or index was
-- named, it is found by shape rather than by a name guessed here.
do $$
declare
  target record;
  profile_attnum smallint;
  table_oid oid;
begin
  select rel.oid into table_oid
  from pg_class rel
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public' and rel.relname = 'profile_collective_impacts';

  if table_oid is null then
    raise exception 'profile_collective_impacts does not exist';
  end if;

  select attnum into profile_attnum
  from pg_attribute
  where attrelid = table_oid and attname = 'profile_id' and not attisdropped;

  -- Unique constraints on (profile_id). contype 'u' only, so a primary key is
  -- never in scope here.
  for target in
    select conname
    from pg_constraint
    where conrelid = table_oid
      and contype = 'u'
      and conkey = array[profile_attnum]
  loop
    execute format('alter table public.profile_collective_impacts drop constraint %I', target.conname);
  end loop;

  -- Standalone unique indexes on (profile_id) with no predicate. Anything that
  -- backs a constraint is excluded: those were just dropped above, and a
  -- constraint's index cannot be dropped on its own.
  for target in
    select cls.relname as idxname
    from pg_index idx
    join pg_class cls on cls.oid = idx.indexrelid
    where idx.indrelid = table_oid
      and idx.indisunique
      and idx.indpred is null
      and idx.indnatts = 1
      and idx.indkey[0] = profile_attnum
      and not exists (select 1 from pg_constraint where conindid = cls.oid)
  loop
    execute format('drop index if exists public.%I', target.idxname);
  end loop;
end $$;

-- One shared synthesis per profile: the fallback, and what every profile that
-- predates this file already has.
create unique index if not exists profile_collective_impacts_shared_key
  on public.profile_collective_impacts (profile_id)
  where lens_id is null;

-- One synthesis per direction. Partial, because a partial index is the only
-- way to say "unique among the rows that have a direction" — and it is why the
-- writer for these rows deletes the direction's row and inserts, rather than
-- using ON CONFLICT, which cannot infer a partial index.
create unique index if not exists profile_collective_impacts_lens_key
  on public.profile_collective_impacts (profile_id, lens_id)
  where lens_id is not null;

create index if not exists profile_collective_impacts_lens_idx
  on public.profile_collective_impacts (lens_id)
  where lens_id is not null;

comment on column public.profile_collective_impacts.lens_id is
  'The direction this synthesis was written for. Null means the shared, profile-wide synthesis, which is what a direction with no row of its own falls back to.';

comment on column public.profile_collective_impacts.testimonial_order is
  'Ordered array of profile_testimonials ids, most relevant to this direction first. References only — never testimonial content. Ids are validated against the profile''s own published testimonials at read time; unknown, withdrawn or unpublished ids are ignored, and any published testimonial not listed follows the ranked ones in its existing order. Empty array means no reordering, which reads in the shared stable order.';
