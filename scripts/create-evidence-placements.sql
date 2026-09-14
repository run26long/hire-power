-- ============================================================================
-- EVIDENCE — canonical records, and where each direction places them
--
-- Run once in the Supabase SQL editor. Idempotent: safe to re-run, and safe to
-- re-run after a partial run, because every constraint, index, policy, trigger
-- and backfill is guarded rather than assumed.
--
-- profile_evidence already exists and already holds real rows. It is the
-- canonical record and stays that way: this file gives it the fields the
-- approved Evidence model needs, the constraints it never had, and a separate
-- table to say where each direction puts it.
--
-- Nothing is deleted and nothing is rewritten in meaning. `kind` keeps its
-- existing free text; `evidence_type` is seeded from it rather than replacing
-- it. `lens_ids` keeps its values and is read exactly once, to seed the
-- placement table; after that it is legacy and nothing reads it.
--
-- Two things this file deliberately refuses to guess. It does not infer a
-- family from `kind` - "Podcast interview" could be Work or Recognition and the
-- column has no way to know - so every existing row is filed as 'work' and left
-- to be reclassified by hand. And it does not invent a rendering for a media
-- class the viewer has no way to show: such a row becomes 'other' and goes back
-- to draft with its own words untouched, rather than being quietly reclassified
-- into something it is not.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. The canonical record gains what the model needs
-- ---------------------------------------------------------------------------

alter table public.profile_evidence
  add column if not exists family text,
  add column if not exists evidence_type text,
  add column if not exists organization text,
  add column if not exists date_label text,
  add column if not exists source_type text,
  add column if not exists mime_type text,
  add column if not exists file_size bigint,
  add column if not exists provider text,
  add column if not exists embed_url text,
  add column if not exists status text,
  add column if not exists deleted_at timestamptz,
  add column if not exists updated_at timestamptz;


-- ---------------------------------------------------------------------------
-- 2. Make the existing rows legal before any constraint is added
--
-- Order matters. Every statement that finds a problem writes 'draft' itself
-- rather than leaving status null for a later backfill to decide, so the file
-- behaves the same whether status was already set or not. Nothing here ever
-- promotes a row: an unknown privacy becomes 'private', never 'public'.
-- ---------------------------------------------------------------------------

-- Every existing row is filed as Work. Deliberately not inferred from `kind`.
update public.profile_evidence set family = 'work' where family is null;

-- The specific type is seeded from the label already there, unchanged in
-- meaning. `kind` itself is left exactly as it is.
update public.profile_evidence set evidence_type = kind where evidence_type is null;

-- An unknown privacy is not a public one.
update public.profile_evidence
  set privacy = 'private'
  where privacy is null or privacy not in ('public', 'private');

-- Where a row came from: an uploaded object if it has a path, an external link
-- if it has a URL, and otherwise unknown - which is a row still being written.
update public.profile_evidence
  set source_type = case
    when storage_path is not null then 'upload'
    when url is not null then 'link'
    else null
  end
  where source_type is null;

-- Only http and https may be stored. An unsafe scheme is cleared rather than
-- deleted, and the row goes back to draft in the same statement: the evidence
-- is still the person's, it just has nothing safe to point at until they fix
-- it. Written unconditionally so a row that already carried a status cannot
-- stay published on a URL that has just been taken away from it.
update public.profile_evidence
  set url = null,
      source_type = case when storage_path is not null then 'upload' else null end,
      status = 'draft'
  where url is not null
    and url !~* '^https?://';

-- Same principle for an embed: an item must never remain publicly eligible as
-- an embed on a URL that was not safe to keep.
update public.profile_evidence
  set embed_url = null,
      provider = null,
      status = 'draft'
  where embed_url is not null
    and embed_url !~* '^https?://';

-- A media class the viewer has no way to render becomes the neutral one, and
-- the row goes back to draft so nobody is shown a tile that cannot open. The
-- original `kind` and `evidence_type` are untouched, so what the thing actually
-- is survives and the owner can refile it. Audio is a supported class, so an
-- audio item keeps its class and its readiness.
update public.profile_evidence
  set media_class = 'other',
      status = 'draft'
  where media_class is null
     or media_class not in ('image', 'video', 'audio', 'document', 'link', 'embed', 'other');

-- Whatever is left carries its current readiness forward, but only where it
-- actually has the source its type requires. A row with neither a URL nor an
-- object is incomplete, and incomplete is draft.
update public.profile_evidence
  set status = case
    when (source_type = 'link' and url is not null)
      or (source_type = 'upload' and storage_path is not null)
    then 'published'
    else 'draft'
  end
  where status is null;

update public.profile_evidence set updated_at = coalesce(updated_at, created_at, now());


-- ---------------------------------------------------------------------------
-- 3. The constraints the table never had
-- ---------------------------------------------------------------------------

alter table public.profile_evidence
  alter column family set not null,
  alter column family set default 'work',
  alter column status set not null,
  alter column status set default 'draft',
  alter column updated_at set not null,
  alter column updated_at set default now(),
  alter column privacy set not null,
  alter column privacy set default 'private';

do $$
begin
  -- Families are a closed set. Types inside a family are not: the type is a
  -- label the owner writes, and constraining it would mean a migration every
  -- time somebody has a kind of evidence nobody anticipated.
  if not exists (select 1 from pg_constraint
                 where conname = 'profile_evidence_family_check'
                   and conrelid = 'public.profile_evidence'::regclass) then
    alter table public.profile_evidence
      add constraint profile_evidence_family_check
      check (family in ('work', 'credentials', 'recognition'));
  end if;

  if not exists (select 1 from pg_constraint
                 where conname = 'profile_evidence_privacy_check'
                   and conrelid = 'public.profile_evidence'::regclass) then
    alter table public.profile_evidence
      add constraint profile_evidence_privacy_check
      check (privacy in ('public', 'private'));
  end if;

  if not exists (select 1 from pg_constraint
                 where conname = 'profile_evidence_status_check'
                   and conrelid = 'public.profile_evidence'::regclass) then
    alter table public.profile_evidence
      add constraint profile_evidence_status_check
      check (status in ('draft', 'published'));
  end if;

  if not exists (select 1 from pg_constraint
                 where conname = 'profile_evidence_source_type_check'
                   and conrelid = 'public.profile_evidence'::regclass) then
    alter table public.profile_evidence
      add constraint profile_evidence_source_type_check
      check (source_type is null or source_type in ('upload', 'link'));
  end if;

  -- Closed, because every one of these is something the viewer knows how to
  -- put on screen. 'other' is the honest answer for anything else.
  if not exists (select 1 from pg_constraint
                 where conname = 'profile_evidence_media_class_check'
                   and conrelid = 'public.profile_evidence'::regclass) then
    alter table public.profile_evidence
      add constraint profile_evidence_media_class_check
      check (media_class in ('image', 'video', 'audio', 'document', 'link', 'embed', 'other'));
  end if;

  -- Only ever http or https, whatever else a form might send. This is what
  -- makes a javascript: URL unstorable rather than merely unrendered.
  if not exists (select 1 from pg_constraint
                 where conname = 'profile_evidence_url_scheme_check'
                   and conrelid = 'public.profile_evidence'::regclass) then
    alter table public.profile_evidence
      add constraint profile_evidence_url_scheme_check
      check (url is null or url ~* '^https?://');
  end if;

  if not exists (select 1 from pg_constraint
                 where conname = 'profile_evidence_embed_url_scheme_check'
                   and conrelid = 'public.profile_evidence'::regclass) then
    alter table public.profile_evidence
      add constraint profile_evidence_embed_url_scheme_check
      check (embed_url is null or embed_url ~* '^https?://');
  end if;

  if not exists (select 1 from pg_constraint
                 where conname = 'profile_evidence_file_size_check'
                   and conrelid = 'public.profile_evidence'::regclass) then
    alter table public.profile_evidence
      add constraint profile_evidence_file_size_check
      check (file_size is null or file_size >= 0);
  end if;

  -- A draft may be as incomplete as the person writing it needs. A published
  -- one has to have the source its own type promises, so nothing half-written
  -- can become publicly eligible.
  if not exists (select 1 from pg_constraint
                 where conname = 'profile_evidence_published_source_check'
                   and conrelid = 'public.profile_evidence'::regclass) then
    alter table public.profile_evidence
      add constraint profile_evidence_published_source_check
      check (
        status <> 'published'
        or (source_type = 'link' and url is not null)
        or (source_type = 'upload' and storage_path is not null)
      );
  end if;

  -- Placements point at (evidence_id, profile_id) together, which needs the
  -- pair to be unique on each parent. Both are already unique by primary key;
  -- this states it in the form a composite foreign key can reference.
  if not exists (select 1 from pg_constraint
                 where conname = 'profile_evidence_id_profile_id_key'
                   and conrelid = 'public.profile_evidence'::regclass) then
    alter table public.profile_evidence
      add constraint profile_evidence_id_profile_id_key unique (id, profile_id);
  end if;

  if not exists (select 1 from pg_constraint
                 where conname = 'profile_lenses_id_profile_id_key'
                   and conrelid = 'public.profile_lenses'::regclass) then
    alter table public.profile_lenses
      add constraint profile_lenses_id_profile_id_key unique (id, profile_id);
  end if;
end $$;

-- What the public reader asks for: this profile's eligible evidence, in order.
create index if not exists profile_evidence_public_idx
  on public.profile_evidence (profile_id, sort_order)
  where deleted_at is null and status = 'published' and privacy = 'public';

create index if not exists profile_evidence_profile_idx
  on public.profile_evidence (profile_id)
  where deleted_at is null;


-- ---------------------------------------------------------------------------
-- 4. Where each direction places a piece of evidence
--
-- References only. An item's file, link, title and description live once, on
-- profile_evidence; a direction may say which items it shows, in what order,
-- and which one leads. A row with a null lens_id is the shared default layer.
-- ---------------------------------------------------------------------------

create table if not exists public.profile_evidence_placements (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.career_profiles(id) on delete cascade,
  evidence_id uuid not null,
  lens_id uuid,
  sort_order integer not null default 0,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Added separately rather than inline, so a table created by an earlier partial
-- run still gains them on a re-run.
do $$
begin
  -- Both parents are reached through the profile, so an evidence item and a
  -- lens can only be placed together if they belong to the same profile. One
  -- profile's evidence cannot be attached to another profile's direction, and
  -- the database says so rather than the route that writes it.
  if not exists (select 1 from pg_constraint
                 where conname = 'profile_evidence_placements_evidence_fk'
                   and conrelid = 'public.profile_evidence_placements'::regclass) then
    alter table public.profile_evidence_placements
      add constraint profile_evidence_placements_evidence_fk
      foreign key (evidence_id, profile_id)
      references public.profile_evidence (id, profile_id) on delete cascade;
  end if;

  -- MATCH SIMPLE, which is what makes the shared layer work: with lens_id null
  -- the constraint does not apply, so a shared placement needs no lens at all.
  if not exists (select 1 from pg_constraint
                 where conname = 'profile_evidence_placements_lens_fk'
                   and conrelid = 'public.profile_evidence_placements'::regclass) then
    alter table public.profile_evidence_placements
      add constraint profile_evidence_placements_lens_fk
      foreign key (lens_id, profile_id)
      references public.profile_lenses (id, profile_id) on delete cascade;
  end if;
end $$;

-- Uniqueness, written twice because null is not equal to null. A plain unique
-- constraint on (evidence_id, lens_id) would let the same item be placed in the
-- shared layer any number of times, because every one of those rows carries a
-- distinct null.
create unique index if not exists profile_evidence_placements_lens_key
  on public.profile_evidence_placements (evidence_id, lens_id)
  where lens_id is not null;

create unique index if not exists profile_evidence_placements_shared_key
  on public.profile_evidence_placements (evidence_id)
  where lens_id is null;

-- One lead per direction, and one lead in the shared layer per profile. The
-- second index is keyed on profile rather than lens for the same reason: every
-- shared row's lens_id is a distinct null, so an index on lens_id alone would
-- not constrain them at all.
create unique index if not exists profile_evidence_placements_featured_lens_key
  on public.profile_evidence_placements (lens_id)
  where featured and lens_id is not null;

create unique index if not exists profile_evidence_placements_featured_shared_key
  on public.profile_evidence_placements (profile_id)
  where featured and lens_id is null;

create index if not exists profile_evidence_placements_read_idx
  on public.profile_evidence_placements (profile_id, lens_id, sort_order);

create index if not exists profile_evidence_placements_evidence_idx
  on public.profile_evidence_placements (evidence_id);


-- ---------------------------------------------------------------------------
-- 5. Seed the placements from the curation that already exists
--
-- lens_ids is read once, here, and the real column type decides how. udt_name
-- is what distinguishes jsonb from uuid[] from text[]; data_type reports
-- 'ARRAY' for both array forms and cannot tell them apart. Anything else raises
-- a notice and falls through to the shared placements below, rather than
-- attempting an unnest that would not compile against it.
--
-- Where the values are text, they are proved to be UUIDs before being cast, in
-- a materialised CTE so the filter cannot be reordered after the cast. One
-- malformed string in one array must not abort a migration.
--
-- An id naming a lens that is gone, or a lens belonging to another profile, is
-- simply not joined - the composite foreign key would refuse it anyway, and a
-- migration that dies on somebody's stale array is worse than one that ignores
-- it. Deleted evidence is skipped entirely.
-- ---------------------------------------------------------------------------

do $$
declare
  udt text;
  uuid_re constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
begin
  select c.udt_name into udt
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'profile_evidence'
    and c.column_name = 'lens_ids';

  if udt is null then
    raise notice 'profile_evidence.lens_ids is not present; every item will take a shared placement';

  elsif udt in ('jsonb', 'json') then
    execute format($sql$
      with candidate as materialized (
        select e.id as evidence_id, e.profile_id, coalesce(e.sort_order, 0) as sort_order, v.value as txt
        from public.profile_evidence e
        cross join lateral jsonb_array_elements_text(
          case when jsonb_typeof(e.lens_ids::jsonb) = 'array' then e.lens_ids::jsonb else '[]'::jsonb end
        ) as v(value)
        where e.deleted_at is null
          and e.lens_ids is not null
          and v.value ~ %L
      )
      insert into public.profile_evidence_placements (profile_id, evidence_id, lens_id, sort_order, featured)
      select c.profile_id, c.evidence_id, l.id, c.sort_order, false
      from candidate c
      join public.profile_lenses l on l.id = c.txt::uuid and l.profile_id = c.profile_id
      on conflict do nothing
    $sql$, uuid_re);

  elsif udt = '_uuid' then
    -- Already uuids; nothing to validate and nothing to cast.
    execute $sql$
      insert into public.profile_evidence_placements (profile_id, evidence_id, lens_id, sort_order, featured)
      select e.profile_id, e.id, l.id, coalesce(e.sort_order, 0), false
      from public.profile_evidence e
      cross join lateral unnest(coalesce(e.lens_ids, '{}'::uuid[])) as v(value)
      join public.profile_lenses l on l.id = v.value and l.profile_id = e.profile_id
      where e.deleted_at is null
      on conflict do nothing
    $sql$;

  elsif udt in ('_text', '_varchar') then
    execute format($sql$
      with candidate as materialized (
        select e.id as evidence_id, e.profile_id, coalesce(e.sort_order, 0) as sort_order, v.value as txt
        from public.profile_evidence e
        cross join lateral unnest(coalesce(e.lens_ids, '{}'::text[])) as v(value)
        where e.deleted_at is null
          and v.value ~ %L
      )
      insert into public.profile_evidence_placements (profile_id, evidence_id, lens_id, sort_order, featured)
      select c.profile_id, c.evidence_id, l.id, c.sort_order, false
      from candidate c
      join public.profile_lenses l on l.id = c.txt::uuid and l.profile_id = c.profile_id
      on conflict do nothing
    $sql$, uuid_re);

  else
    raise notice 'profile_evidence.lens_ids has unsupported type %; every item will take a shared placement', udt;
  end if;
end $$;

-- Anything left without a placement of any kind gets the shared one, so it
-- keeps whatever reach it has today. An item that did get direction placements
-- gets no shared row: explicit curation is not quietly widened.
insert into public.profile_evidence_placements (profile_id, evidence_id, lens_id, sort_order, featured)
select e.profile_id, e.id, null, coalesce(e.sort_order, 0), false
from public.profile_evidence e
where e.deleted_at is null
  and not exists (
    select 1 from public.profile_evidence_placements p where p.evidence_id = e.id
  )
on conflict do nothing;


-- ---------------------------------------------------------------------------
-- 6. updated_at, maintained rather than merely defaulted
--
-- A default only fires on insert. If this database already has a trigger
-- function for this, it is reused; otherwise the smallest possible one is
-- created. Either way both tables get a trigger, dropped and recreated so a
-- re-run leaves exactly one.
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
    and p.proname in ('set_updated_at', 'handle_updated_at', 'update_updated_at_column', 'trigger_set_timestamp')
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

  execute 'drop trigger if exists profile_evidence_set_updated_at on public.profile_evidence';
  execute format(
    'create trigger profile_evidence_set_updated_at before update on public.profile_evidence
     for each row execute function %s()', fn);

  execute 'drop trigger if exists profile_evidence_placements_set_updated_at on public.profile_evidence_placements';
  execute format(
    'create trigger profile_evidence_placements_set_updated_at before update on public.profile_evidence_placements
     for each row execute function %s()', fn);
end $$;


-- ---------------------------------------------------------------------------
-- 7. Row level security
--
-- The same shape the other profile tables use: nothing for anonymous callers,
-- everything for the owner of the profile the row belongs to, and the public
-- Career Profile keeps reading through its service-role API route rather than
-- through a public policy.
-- ---------------------------------------------------------------------------

alter table public.profile_evidence_placements enable row level security;

drop policy if exists profile_evidence_placements_owner_select on public.profile_evidence_placements;
drop policy if exists profile_evidence_placements_owner_insert on public.profile_evidence_placements;
drop policy if exists profile_evidence_placements_owner_update on public.profile_evidence_placements;
drop policy if exists profile_evidence_placements_owner_delete on public.profile_evidence_placements;

create policy profile_evidence_placements_owner_select
  on public.profile_evidence_placements for select to authenticated
  using (exists (
    select 1 from public.career_profiles cp
    where cp.id = profile_evidence_placements.profile_id and cp.user_id = auth.uid()
  ));

create policy profile_evidence_placements_owner_insert
  on public.profile_evidence_placements for insert to authenticated
  with check (exists (
    select 1 from public.career_profiles cp
    where cp.id = profile_evidence_placements.profile_id and cp.user_id = auth.uid()
  ));

create policy profile_evidence_placements_owner_update
  on public.profile_evidence_placements for update to authenticated
  using (exists (
    select 1 from public.career_profiles cp
    where cp.id = profile_evidence_placements.profile_id and cp.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.career_profiles cp
    where cp.id = profile_evidence_placements.profile_id and cp.user_id = auth.uid()
  ));

create policy profile_evidence_placements_owner_delete
  on public.profile_evidence_placements for delete to authenticated
  using (exists (
    select 1 from public.career_profiles cp
    where cp.id = profile_evidence_placements.profile_id and cp.user_id = auth.uid()
  ));


-- ---------------------------------------------------------------------------
-- 8. The bucket that is already there
--
-- profile-media exists, is private, is capped at 50MB, and its object policies
-- already scope a user to their own id prefix. None of that is touched. What it
-- has never had is a list of what may be put in it, so this adds one covering
-- exactly the classes the viewer can render: images, PDFs, video and audio. The
-- guard means an allowlist somebody has already set by hand is left alone.
-- ---------------------------------------------------------------------------

update storage.buckets
set allowed_mime_types = array[
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
  'application/pdf',
  'video/mp4', 'video/webm', 'video/quicktime',
  'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/webm', 'audio/ogg'
]
where id = 'profile-media'
  and (allowed_mime_types is null or allowed_mime_types = '{}');


-- ---------------------------------------------------------------------------
-- 9. What the columns mean
-- ---------------------------------------------------------------------------

comment on column public.profile_evidence.family is
  'Which of the three families this item belongs to: work, credentials or recognition. Existing rows were filed as work by the migration without inferring from kind, and are expected to be reclassified by hand.';

comment on column public.profile_evidence.evidence_type is
  'The specific kind of thing this is, as a label rather than a closed set. Seeded from the legacy free-text kind column, which is retained unchanged.';

comment on column public.profile_evidence.media_class is
  'How the viewer renders this item: image, video, audio, document, link, embed, or other. Closed, because each one is something the viewer knows how to put on screen. A row normalised to other was a class the viewer cannot render; its kind and evidence_type still say what it really is.';

comment on column public.profile_evidence.source_type is
  'upload when the item is an object in profile-media, link when it is an external http(s) URL. Null only while a draft is still being written; a published item must have the source its type promises.';

comment on column public.profile_evidence.status is
  'draft or published. Publication readiness, separate from privacy. Public eligibility is privacy = public and status = published and deleted_at is null, plus a placement resolved for the direction being viewed.';

comment on column public.profile_evidence.deleted_at is
  'Soft deletion. A deleted item is never served and never resolves a placement, but its row and its object survive.';

comment on column public.profile_evidence.lens_ids is
  'Legacy. Read once by the placement migration and not read since. profile_evidence_placements is where a direction says which items it shows, in what order, and which one leads.';

comment on table public.profile_evidence_placements is
  'Which evidence a direction shows, in what order, and which one leads. References only: never a copy of an item''s file, link or text. A null lens_id is the shared default layer a direction with no curation of its own falls back to.';
