-- ===========================================================================
-- career_knowledge.source_type: allow 'interview_practice'
--
-- Knowledge now arrives from a third place. Coaching writes 'conversation',
-- an uploaded resume writes 'uploaded_resume', and a completed interview
-- practice session writes 'interview_practice'. Keeping them apart is the
-- point: a fact the candidate said out loud under interview pressure is
-- differently sourced from one they typed into a coaching answer, and the
-- profile and IMOW writers should be able to tell.
--
-- WHY THIS FILE HAS TO RUN BEFORE THE CODE SHIPS
--
-- career_knowledge_source_type_check currently permits exactly two values.
-- An insert carrying 'interview_practice' fails with 23514, and the write
-- path that carries it is deliberately non-fatal - it logs and returns so a
-- finished practice session is never lost over a background extraction. So
-- without this migration the feature does not error anywhere a user can see.
-- It silently writes nothing, forever.
--
-- The existing constraint is not in this repo; it was applied directly. The
-- two permitted values were confirmed against the live table before this was
-- written, so the list below is the old one plus the new value, not a guess.
--
-- Safe to run more than once. Nothing is rewritten and no row is touched:
-- every stored value already satisfies the new constraint, because the new
-- list is a superset of the old.
-- ===========================================================================

begin;

alter table public.career_knowledge
  drop constraint if exists career_knowledge_source_type_check;

alter table public.career_knowledge
  add constraint career_knowledge_source_type_check
  check (source_type in ('conversation', 'uploaded_resume', 'interview_practice'));

commit;

-- Verify:
--
--   select source_type, count(*)
--   from public.career_knowledge
--   group by source_type
--   order by 2 desc;
--
-- and confirm the constraint now lists three values:
--
--   select pg_get_constraintdef(oid)
--   from pg_constraint
--   where conname = 'career_knowledge_source_type_check';
