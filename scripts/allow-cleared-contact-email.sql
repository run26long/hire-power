-- ===========================================================================
-- career_profiles.contact_email: allow the empty string
--
-- WHY
-- The Contact button now shows by default, using the account address when the
-- owner has never set one of their own. That needs three states on this column
-- rather than two:
--
--   null        never set. The public route falls back to the account address.
--   ''          cleared on purpose. No button.
--   an address  the owner's own choice.
--
-- The original shape constraint allowed only null or a well-formed address, so
-- there was nowhere to record "cleared". Without this change a cleared field
-- fails the CHECK and the save returns an error.
--
-- This only widens what the column accepts. Every value it already holds still
-- satisfies the new constraint, so nothing has to be migrated and the script is
-- safe to run more than once.
--
-- Run in the Supabase SQL editor.
-- ===========================================================================

alter table public.career_profiles
  drop constraint if exists career_profiles_contact_email_shape;

alter table public.career_profiles
  add constraint career_profiles_contact_email_shape
  check (
    contact_email is null
    or contact_email = ''
    or (
      length(contact_email) between 3 and 254
      and contact_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    )
  );

comment on column public.career_profiles.contact_email is
  'The address the public Contact button opens. NULL means never set, and the account address stands in. The empty string means the owner cleared it and no button is rendered. Any other value is the owner''s own choice.';

-- Verify:
--   select conname, pg_get_constraintdef(oid)
--     from pg_constraint
--    where conrelid = 'public.career_profiles'::regclass
--      and conname = 'career_profiles_contact_email_shape';
