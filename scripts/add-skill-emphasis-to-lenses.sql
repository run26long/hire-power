-- ============================================================================
-- SKILL EMPHASIS — the few skills a direction leads with
--
-- Run once in the Supabase SQL editor. Idempotent: safe to re-run.
--
-- A profile_lenses row already carries how one direction is written: its
-- headline, its bio, its proof points. This adds how that direction's skills
-- are weighted, which is the one part of the profile that was still identical
-- across every direction a person has.
--
-- The skills themselves are not stored here. They live on the resume, in
-- resume_data.skillsCategories, and the Career Profile renders them from there:
-- the direction's own resume where one has been built, the priority core until
-- then. This column only names which of those skills that direction leads with,
-- so the same skill set can read differently depending on which direction the
-- visitor is looking through.
--
-- Names are stored, not ids, because a skill has no id — it is a string inside
-- the resume's jsonb. The generator copies the resume's exact string rather
-- than the model's echo of it, so the profile can match a tile without
-- guessing. A name that no longer appears on the resume simply matches nothing
-- and that skill is shown unemphasised, which is the right failure: the section
-- still renders every skill, it just stops pointing at one.
-- ============================================================================

alter table public.profile_lenses
  add column if not exists skill_emphasis jsonb not null default '[]'::jsonb;

comment on column public.profile_lenses.skill_emphasis is
  'Ordered array of skill name strings this direction leads with, copied verbatim from the resume''s skillsCategories. Typically 3 to 5. Empty array means no emphasis, which renders every skill evenly.';

-- ---------------------------------------------------------------------------
-- Row level security.
--
-- Nothing to add. profile_lenses already has its policies, and a new column on
-- an existing table inherits them: the owner reads and writes their own rows,
-- and the public Career Profile reads lenses through the service role in the
-- profile API rather than as the visitor. This column is published to a link
-- holder the same way headline and bio already are, and carries nothing that is
-- not already on the public page.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- skill_emphasis shape, for reference. Validated in the generator before it
-- writes — every name is checked against the skills actually on the resume —
-- so this is documentation rather than a constraint:
--
-- ["Lean Manufacturing", "WIP Reporting", "P&L Management"]
-- ---------------------------------------------------------------------------
