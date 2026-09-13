-- ============================================================================
-- SKILL PROOF — what backs a skill up, for the Career Profile
--
-- Run once in the Supabase SQL editor. Idempotent: safe to re-run.
--
-- A skill on the profile is a string on a resume and nothing more. This table
-- is what lets one be clicked: it names, per skill, the evidence and the work
-- already on the profile that demonstrates it.
--
-- Keyed by profile rather than by lens, deliberately. Which skills a direction
-- LEADS WITH is a property of that direction and lives on profile_lenses as
-- skill_emphasis. What BACKS A SKILL UP is a property of the person: the case
-- study that demonstrates lean manufacturing demonstrates it whichever
-- direction the visitor is reading through. Stored per lens it would be written
-- once per direction, go stale in two of them the moment one was regenerated,
-- and disagree with itself. Stored here it is written once and serves them all.
--
-- WHAT IS STORED IS REFERENCES, NOT COPIES.
--
-- A snippet copied into this table outlives the thing it was copied from. The
-- user edits a case study and the profile keeps showing the old wording; worse,
-- the user makes one private and the copy keeps publishing it. So evidence and
-- testimonials are referenced by id and resolved at render against what the
-- public profile API already returns — which is filtered to public rows. An
-- item deleted or made private is simply not in that payload, and the proof
-- silently drops out. That is the failure this shape is chosen for.
--
-- Resume bullets are the exception. A bullet has no id, only a position, and
-- positions move when a resume is recoached. So a bullet reference carries both
-- its path and its exact text, and the page shows it only while the text still
-- matches what sits at that path. A moved bullet drops out rather than pointing
-- confidently at the wrong sentence.
--
-- There is no source_hash here, unlike profile_collective_impacts. That table
-- stores generated prose and needs to know when its inputs moved underneath it.
-- This one stores pointers that are re-resolved on every render, so staleness
-- corrects itself rather than needing to be detected.
-- ============================================================================

create table if not exists public.profile_skill_proofs (
  id uuid primary key default gen_random_uuid(),

  profile_id uuid not null references public.career_profiles (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,

  -- The skill exactly as the resume stores it. This is what the profile matches
  -- a tile against, so it is kept verbatim rather than tidied.
  skill_label text not null,

  -- Derived, never written by the application. A key the app computes itself
  -- could drift from the label it is supposed to represent; one Postgres
  -- computes cannot. It exists to make "one row per skill per profile"
  -- enforceable, not to be read.
  skill_key text generated always as (lower(btrim(skill_label))) stored,

  -- The references. Shape documented at the bottom of this file and validated
  -- in the generator before it writes.
  proofs jsonb not null default '[]'::jsonb,

  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per skill per profile, which is what regeneration upserts onto.
create unique index if not exists profile_skill_proofs_profile_skill_key
  on public.profile_skill_proofs (profile_id, skill_key);

create index if not exists profile_skill_proofs_user_idx
  on public.profile_skill_proofs (user_id);

-- ---------------------------------------------------------------------------
-- Row level security.
--
-- The owner is the only role that can see or change their own rows. The public
-- Career Profile does not read this table as the visitor: it is read by the
-- service role in the profile API, exactly as the lenses, evidence and
-- testimonials already are, so there is no public policy here and no public
-- write path of any kind.
-- ---------------------------------------------------------------------------
alter table public.profile_skill_proofs enable row level security;

drop policy if exists "Owners read their skill proofs"
  on public.profile_skill_proofs;
create policy "Owners read their skill proofs"
  on public.profile_skill_proofs
  for select
  using (auth.uid() = user_id);

drop policy if exists "Owners insert their skill proofs"
  on public.profile_skill_proofs;
create policy "Owners insert their skill proofs"
  on public.profile_skill_proofs
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Owners update their skill proofs"
  on public.profile_skill_proofs;
create policy "Owners update their skill proofs"
  on public.profile_skill_proofs
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Owners delete their skill proofs"
  on public.profile_skill_proofs;
create policy "Owners delete their skill proofs"
  on public.profile_skill_proofs
  for delete
  using (auth.uid() = user_id);

comment on column public.profile_skill_proofs.skill_label is
  'The skill exactly as resume_data.skillsCategories stores it. Matched against a rendered tile.';

comment on column public.profile_skill_proofs.proofs is
  'Ordered array of references to proof already on the public profile. References, never copies: see the shape at the foot of scripts/create-profile-skill-proofs.sql.';

-- ---------------------------------------------------------------------------
-- proofs shape, for reference. Validated in the generator before it writes —
-- every id must exist among the profile's public evidence or published
-- testimonials, and every bullet path must still hold the text quoted — so this
-- is documentation rather than a constraint:
--
-- [
--   { "source": "evidence",    "id": "uuid of a public profile_evidence row" },
--   { "source": "testimonial", "id": "uuid of a published profile_testimonials row" },
--   {
--     "source": "bullet",
--     "path": "experience[1].bullets[2]",
--     "text": "The bullet exactly as the resume stores it, so a moved bullet can be detected and dropped rather than mistaken for another."
--   }
-- ]
--
-- "why" is deliberately absent. A generated sentence explaining the connection
-- would be prose about someone's career stored outside the one place the
-- profile keeps such prose, and it would go stale the same way a snippet does.
-- The evidence speaks for itself; the proof panel shows it and says where it
-- came from.
-- ---------------------------------------------------------------------------
