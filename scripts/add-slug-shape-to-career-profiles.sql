-- ============================================================================
-- SLUG SHAPE — the second lock on the public address
--
-- Run once in the Supabase SQL editor. Idempotent: safe to re-run.
--
-- NOT REQUIRED for the settings panel to work. /api/career-profile/slug
-- validates every candidate before it writes, and that route is the only thing
-- in the product that sets this column. This is the lock behind that one.
--
-- WHY IT IS WORTH ADDING ANYWAY
-- career_profiles.slug is a URL path segment. `/p/<slug>` is the entire public
-- address of somebody's Career Profile. Today the column enforces exactly two
-- things: unique, and not null. I checked by writing each of the following and
-- rolling it back, rather than by reading a migration file:
--
--   ''                       accepted   -> resolves to /p/, which is not a profile
--   'Ava-Long'               accepted   -> two addresses that look like one
--   'ava long'               accepted   -> has to be encoded everywhere it is printed
--   'ava/long'               accepted   -> addresses a different route entirely
--   '-ava'                   accepted   -> a hyphen nobody can see in a link
--   200 characters           accepted
--
-- A constraint here means a row written by a migration, by a script, by the
-- SQL editor, or by a future route that forgets, still cannot produce an
-- address the site cannot serve.
--
-- WHY THE RULES ARE NOT STRICTER
-- No reserved-word list lives here. The route holds that one, because it is a
-- product judgement that will change, and a CHECK constraint is the wrong
-- place for a list somebody will want to edit. This enforces only what is
-- structurally true of a URL segment.
--
-- BEFORE YOU RUN IT
-- Existing rows are checked when the constraint is added, so a profile whose
-- slug does not fit will block it. Section 1 below lists any such rows; fix
-- them first. At the time of writing all five profiles pass.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Anything that would block the constraint
--
-- Expect zero rows. If there are any, rename them first - and remember that
-- renaming a slug breaks every link already handed out for that profile.
-- ---------------------------------------------------------------------------
select id, slug, is_published
  from public.career_profiles
 where slug is null
    or length(slug) < 3
    or length(slug) > 60
    or slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$';


-- ---------------------------------------------------------------------------
-- 2. The constraint
--
-- Lowercase letters, digits, and single hyphens between them. Must begin and
-- end on an alphanumeric, so no leading, trailing or doubled hyphens: those
-- are invisible in a link and make two different addresses look identical.
--
-- 3 is short enough for initials. 60 is longer than any name needs and short
-- enough to stay readable when somebody pastes the link into a message.
--
-- The same rules, character for character, as validateSlug in
-- app/api/career-profile/_lib/slug.js. If one changes, change both.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.career_profiles'::regclass
      and conname = 'career_profiles_slug_shape'
  ) then
    alter table public.career_profiles
      add constraint career_profiles_slug_shape
      check (
        length(slug) between 3 and 60
        and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
      );
  end if;
end $$;

comment on column public.career_profiles.slug is
  'The profile''s public address: the <slug> in /p/<slug>. Unique, not null, and constrained to a lowercase URL-safe shape. Written only by /api/career-profile/slug. Changing it breaks every link already shared for this profile; there is no redirect from the old one.';


-- ---------------------------------------------------------------------------
-- 3. Row level security
--
-- Nothing to add. career_profiles already has its policies, and this column
-- has always been on it - the constraint changes what may be written, not who
-- may write it. The owner reads and writes their own row; the public profile
-- is read through the service role in the profile API rather than as the
-- visitor; and the two routes that set this column derive the row from the
-- caller's token rather than from anything in the request body.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- 4. Checking it took
--
-- select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--  where conrelid = 'public.career_profiles'::regclass
--    and conname = 'career_profiles_slug_shape';
--
-- These should now be rejected:
--   update public.career_profiles set slug = ''         where slug = '<a slug>';
--   update public.career_profiles set slug = 'Ava-Long' where slug = '<a slug>';
--   update public.career_profiles set slug = 'ava long' where slug = '<a slug>';
--   update public.career_profiles set slug = 'ava/long' where slug = '<a slug>';
--   update public.career_profiles set slug = '-ava'     where slug = '<a slug>';
--   update public.career_profiles set slug = 'a-'       where slug = '<a slug>';
--   update public.career_profiles set slug = 'a--b'     where slug = '<a slug>';
--
-- These should still be accepted:
--   update public.career_profiles set slug = 'ava-long-2' where slug = '<a slug>';
--   update public.career_profiles set slug = 'jl'         -- no: under 3 characters
-- ---------------------------------------------------------------------------
