-- ============================================================================
-- profile_lenses.source gains 'user_created'
--
-- A direction the owner typed themselves is neither of the two sources the
-- table has carried so far. 'coaching_extraction' is what the model proposed
-- from the knowledge base; 'user' is the primary, written when a core is
-- coached and meaning "the direction this account is actually targeting".
-- Neither describes a direction somebody asked for by name, and reusing either
-- would make the row lie about where it came from: 'user' is also half of the
-- primary's idempotency key (source 'user' with sort_order 0), so a custom
-- direction that happened to land at rank 0 would start being treated as the
-- primary by ensurePrimaryLens.
--
-- WHY THIS IS SHAPED THE WAY IT IS
-- Whether a CHECK on source exists at all could not be established from
-- outside the database: information_schema is not exposed through PostgREST,
-- and the only other way to find out is to attempt a write. So this does not
-- assume. It looks for the constraint, and recreates it with the third value
-- only if one is already there. On a database with no such constraint it does
-- nothing at all and says so - it does not introduce a constraint that was
-- never there, because adding one is a different decision from widening one,
-- and it would be made here by accident.
--
-- The precedent is scripts/add-hidden-lens-status.sql, which widened
-- profile_lenses_status_check the same way when 'hidden' was added.
--
-- SAFE TO RUN TWICE. The check is rebuilt from scratch each time, and running
-- it on an already-migrated database produces the same constraint.
--
-- NOTHING ELSE CHANGES. No rows are written. Existing 'user' and
-- 'coaching_extraction' rows keep their source.
-- ============================================================================

do $$
declare
  conname_found text;
  condef text;
begin
  select c.conname, pg_get_constraintdef(c.oid)
    into conname_found, condef
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where t.relname = 'profile_lenses'
    and n.nspname = 'public'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) ilike '%source%'
  limit 1;

  if conname_found is null then
    raise notice 'No CHECK constraint on profile_lenses.source. Nothing to widen - user_created was already allowed.';
  elsif condef ilike '%user_created%' then
    raise notice 'Constraint % already permits user_created. Nothing to do.', conname_found;
  else
    raise notice 'Widening % (was: %)', conname_found, condef;
    execute format('alter table public.profile_lenses drop constraint %I', conname_found);
    alter table public.profile_lenses
      add constraint profile_lenses_source_check
      check (source in ('user', 'coaching_extraction', 'user_created'));
    raise notice 'Done. profile_lenses.source now permits user, coaching_extraction, user_created.';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- To confirm afterwards:
--
--   select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--   where conrelid = 'public.profile_lenses'::regclass
--     and contype = 'c';
--
-- Expect either no source constraint listed, or one permitting all three.
-- ----------------------------------------------------------------------------
