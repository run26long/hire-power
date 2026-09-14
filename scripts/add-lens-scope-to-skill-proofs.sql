-- ============================================================================
-- SKILL PROOF, SCOPED TO A DIRECTION
--
-- Run once in the Supabase SQL editor. Idempotent: safe to re-run.
--
-- profile_skill_proofs was keyed (profile_id, skill_key), which assumed proof
-- for a skill is the same wherever it appears. It is not. A person can lead
-- with "Lean Manufacturing" under two directions and the evidence that best
-- demonstrates it differs: one direction wants the production floor case study,
-- the other wants the P&L outcome. Under the old key the second direction to
-- generate simply overwrote the first, and the profile then showed one
-- direction's proof under both.
--
-- The identity of a proof record is therefore profile + direction + skill. The
-- direction is profile_lenses.id, which is the identifier the rest of the
-- Career Profile already uses: skill_emphasis hangs off it, core_resume_id
-- hangs off it, and the page selects by it. No second notion of a direction is
-- introduced here.
--
-- EXISTING ROWS.
--
-- Nothing is deleted and nothing is guessed. A row's originating direction can
-- be established only when exactly one of the profile's directions names that
-- skill in its skill_emphasis, because only that direction could have written
-- it. Those rows are migrated. A row named by two directions cannot be
-- attributed from the data — the value stored is whichever direction generated
-- last, and that order is not recorded anywhere — so it is left with a null
-- lens_id, which no reader selects. It becomes inert rather than wrong, and
-- regenerating either direction writes the correct scoped row alongside it.
--
-- lens_id is nullable for exactly that reason. The uniqueness constraint is a
-- partial index over the rows that have one, so an unattributed legacy row can
-- never collide with a correctly scoped one.
-- ============================================================================

alter table public.profile_skill_proofs
  add column if not exists lens_id uuid references public.profile_lenses (id) on delete cascade;

-- ---------------------------------------------------------------------------
-- Backfill, only where the data settles it.
--
-- "Exactly one direction names this skill" is the whole test, and it is written
-- so that nothing can pick between directions even by accident. `claim` lists
-- every direction that names a given proof row's skill; `unambiguous` keeps
-- only the proof rows that appear in it exactly once. The update then joins
-- back to `claim`, which for those rows can contain one direction and no other.
--
-- No aggregate is ever applied to a lens id. There is deliberately no min(), no
-- distinct on, no order by with a limit, and no other construct that would
-- resolve two candidates into one: a row with two claims is not a row to be
-- decided, it is a row to be left alone and reported.
-- ---------------------------------------------------------------------------
with claim as (
  select
    proof.id as proof_id,
    lens.id as lens_id
  from public.profile_skill_proofs proof
  join public.profile_lenses lens
    on lens.profile_id = proof.profile_id
   and exists (
     select 1
     from jsonb_array_elements_text(coalesce(lens.skill_emphasis, '[]'::jsonb)) as emphasised(name)
     where lower(btrim(emphasised.name)) = proof.skill_key
   )
  where proof.lens_id is null
),
unambiguous as (
  select proof_id
  from claim
  group by proof_id
  having count(*) = 1
)
update public.profile_skill_proofs p
set lens_id = claim.lens_id
from claim
join unambiguous on unambiguous.proof_id = claim.proof_id
where p.id = claim.proof_id;

-- ---------------------------------------------------------------------------
-- The new identity. The old one has to go first: it would still forbid a second
-- direction from holding the same skill, which is the entire point of this
-- change.
-- ---------------------------------------------------------------------------
drop index if exists public.profile_skill_proofs_profile_skill_key;

create unique index if not exists profile_skill_proofs_profile_lens_skill_key
  on public.profile_skill_proofs (profile_id, lens_id, skill_key)
  where lens_id is not null;

create index if not exists profile_skill_proofs_lens_idx
  on public.profile_skill_proofs (lens_id);

comment on column public.profile_skill_proofs.lens_id is
  'The direction this proof was chosen for, profile_lenses.id. Proof is direction-specific: the same skill under another direction is a separate row with its own sources. Null only on legacy rows whose originating direction could not be established from the data; those are never served.';

-- ---------------------------------------------------------------------------
-- What is left unattributed, for the record. Run this after the migration to
-- see anything that needs a human decision:
--
--   select id, skill_label
--   from public.profile_skill_proofs
--   where lens_id is null;
--
-- Each such row is a skill named by more than one direction. Regenerating those
-- directions produces correctly scoped rows; the null row can then be deleted
-- deliberately rather than as part of a migration.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Row level security is unchanged. The table already has owner-only policies
-- and no public policy, because the public Career Profile reads it through the
-- service role in the profile API rather than as the visitor. Adding a column
-- does not change that, and no public read policy is added here.
-- ---------------------------------------------------------------------------
