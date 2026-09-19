-- ===========================================================================
-- profile_lenses.status: allow 'hidden'
--
-- A direction can now be taken off the public profile without being thrown
-- away. 'hidden' means exactly that: the lens, its headline, bio, proof points
-- and skill emphasis all stay on the row, and the owner can put it back with
-- one toggle. Nothing about it is deleted and nothing has to be regenerated.
--
-- WHY IT IS NOT 'dismissed'
--
-- 'dismissed' already exists and already keeps a lens off the profile, so it
-- would have worked without this migration. It means something else, though:
-- a suggestion the owner looked at and did not want. Hiding is the opposite
-- posture - a direction they have written, kept, and simply are not publishing
-- today. Folding the two together would make them indistinguishable afterwards,
-- and the first thing anybody would want to know is which of the two happened.
--
-- WHY THIS FILE HAS TO RUN BEFORE THE CODE SHIPS
--
-- profile_lenses_status_check currently permits exactly active, suggested and
-- dismissed. Confirmed against the live table before this was written, by
-- setting a dismissed lens to each candidate value and restoring it: every one
-- of 'hidden', 'archived' and 'inactive' came back 23514. Until this runs, the
-- visibility route's write fails and the toggle reports an error the owner can
-- do nothing about.
--
-- Safe to run more than once, and it rewrites no rows: the new list is the old
-- list plus one value, so everything already stored still satisfies it.
-- ===========================================================================

begin;

alter table public.profile_lenses
  drop constraint if exists profile_lenses_status_check;

alter table public.profile_lenses
  add constraint profile_lenses_status_check
  check (status in ('active', 'suggested', 'dismissed', 'hidden'));

commit;

-- Verify:
--
--   select status, count(*)
--   from public.profile_lenses
--   group by status
--   order by 2 desc;
--
-- and confirm the constraint now lists four values:
--
--   select pg_get_constraintdef(oid)
--   from pg_constraint
--   where conname = 'profile_lenses_status_check';
