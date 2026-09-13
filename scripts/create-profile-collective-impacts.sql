-- ============================================================================
-- COLLECTIVE IMPACT — stored synthesis of a profile's published testimonials
--
-- Run once in the Supabase SQL editor. Idempotent: safe to re-run.
--
-- One current result per profile, which is what the unique constraint on
-- profile_id enforces. Regeneration overwrites rather than accumulating, so the
-- public profile never has to choose between versions.
--
-- source_hash is taken from the eligible testimonial ids and their exact stored
-- text. It is not used to decide anything today; it is stored so that a later
-- testimonial write path can compare it and know the synthesis has gone stale.
-- ============================================================================

create table if not exists public.profile_collective_impacts (
  id uuid primary key default gen_random_uuid(),

  profile_id uuid not null references public.career_profiles (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,

  -- The generated result.
  summary text not null,
  themes jsonb not null default '[]'::jsonb,

  -- The testimonials this was synthesised from, and a fingerprint of their
  -- exact text at the time.
  testimonial_ids uuid[] not null default '{}'::uuid[],
  source_hash text not null,

  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One current result per profile.
create unique index if not exists profile_collective_impacts_profile_key
  on public.profile_collective_impacts (profile_id);

create index if not exists profile_collective_impacts_user_idx
  on public.profile_collective_impacts (user_id);

-- ---------------------------------------------------------------------------
-- Row level security.
--
-- The owner is the only role that can see or change their own row. The public
-- Career Profile does not read this table as the visitor: it is read by the
-- service role in the profile API, exactly as the lenses, evidence and
-- testimonials already are, so there is no public policy here and no public
-- write path of any kind.
-- ---------------------------------------------------------------------------
alter table public.profile_collective_impacts enable row level security;

drop policy if exists "Owners read their collective impact"
  on public.profile_collective_impacts;
create policy "Owners read their collective impact"
  on public.profile_collective_impacts
  for select
  using (auth.uid() = user_id);

drop policy if exists "Owners insert their collective impact"
  on public.profile_collective_impacts;
create policy "Owners insert their collective impact"
  on public.profile_collective_impacts
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Owners update their collective impact"
  on public.profile_collective_impacts;
create policy "Owners update their collective impact"
  on public.profile_collective_impacts
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Owners delete their collective impact"
  on public.profile_collective_impacts;
create policy "Owners delete their collective impact"
  on public.profile_collective_impacts
  for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- themes shape, for reference. Validated in the generator before it writes, so
-- this is documentation rather than a constraint:
--
-- [
--   {
--     "label": "2 to 5 word theme",
--     "statement": "A concise 10 to 20 word explanation.",
--     "testimonial_ids": ["uuid", "uuid"]
--   }
-- ]
-- ---------------------------------------------------------------------------
