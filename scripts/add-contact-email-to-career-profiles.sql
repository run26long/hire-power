-- ============================================================================
-- CONTACT EMAIL — the one way a reader can answer the profile
--
-- Run once in the Supabase SQL editor. Idempotent: safe to re-run.
--
-- The public Career Profile has had a Contact button since it was built, and
-- it has never had anywhere to point. career_profiles carries how the page
-- looks and whether it is published, and nothing at all about how to reach the
-- person it is about. This is that column.
--
-- WHAT IT IS
-- One address, chosen by the owner, opened by the button as a mailto: link.
-- No form, no relay, no inbox in this product: a recruiter's mail client is
-- already the right tool and it leaves the reply in the candidate's own inbox
-- rather than in a table here.
--
-- WHY IT IS NULLABLE AND HAS NO DEFAULT
-- Because this is somebody's email address on a page anyone holding the link
-- can read, and nobody's address should arrive there as a side effect of a
-- migration. NULL is the state every existing profile stays in until its owner
-- puts something here deliberately. The page is built to match: where there is
-- no address the Contact button does not render at all - no disabled control,
-- no "coming soon", nothing that advertises an absence.
--
-- WHAT THIS DOES NOT DO
-- It does not publish anything by itself. The profile API selects this column
-- service-side and emits it only for a profile whose is_published is true, the
-- same gate every other public field passes. An unpublished profile with an
-- address set sends nothing to the browser.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. The column
-- ---------------------------------------------------------------------------
alter table public.career_profiles
  add column if not exists contact_email text;

comment on column public.career_profiles.contact_email is
  'Optional public contact address for the Career Profile''s Contact button, opened as a mailto: link. NULL means the owner has set none and the button is not rendered. Emitted to the public profile API only when is_published is true.';


-- ---------------------------------------------------------------------------
-- 2. What counts as an address
--
-- Deliberately permissive about what an address may contain and strict about
-- the two things that actually matter here. The value is interpolated into a
-- mailto: URL on a public page, so it must not carry whitespace, and it must
-- not be an empty string pretending to be an address - an empty string is a
-- value, and a value makes the button render with nowhere to go. NULL is the
-- way to say "none"; '' is not.
--
-- No attempt is made to decide whether an address is deliverable. That is not
-- something a CHECK constraint can know, and rejecting a valid but unusual
-- address would be the worse failure.
--
-- 254 is the longest an address may be, per RFC 5321.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.career_profiles'::regclass
      and conname = 'career_profiles_contact_email_shape'
  ) then
    alter table public.career_profiles
      add constraint career_profiles_contact_email_shape
      check (
        contact_email is null
        or (
          length(contact_email) between 3 and 254
          and contact_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
        )
      );
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- 3. Row level security
--
-- Nothing to add, and that is the point.
--
-- career_profiles already has its policies: the owner reads and writes their
-- own row, and the public Career Profile is read through the service role in
-- the profile API rather than as the visitor. A new column on an existing
-- table inherits that, so this address is reachable by its owner and by the
-- server, and by nobody else.
--
-- No public read policy is added here on purpose. The route decides what a
-- link holder sees, which is how every other field on this table already
-- works, and it is what keeps an unpublished profile's address unreadable
-- rather than merely unrendered.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- 4. Checking it took
--
-- select column_name, data_type, is_nullable, column_default
--   from information_schema.columns
--  where table_schema = 'public'
--    and table_name = 'career_profiles'
--    and column_name = 'contact_email';
--
-- Expect one row: text, YES, and no default.
--
-- These should be rejected by the constraint:
--   update public.career_profiles set contact_email = ''            where slug = '<a slug>';
--   update public.career_profiles set contact_email = 'not-an-email' where slug = '<a slug>';
--   update public.career_profiles set contact_email = 'a b@c.com'    where slug = '<a slug>';
--
-- These should be accepted:
--   update public.career_profiles set contact_email = 'someone@example.com' where slug = '<a slug>';
--   update public.career_profiles set contact_email = null                  where slug = '<a slug>';
-- ---------------------------------------------------------------------------
