-- ============================================================================
-- profile_lenses.previous_slugs: a renamed direction keeps its old addresses
--
-- Run once in the Supabase SQL editor. Idempotent: safe to re-run.
--
-- WHAT BREAKS WITHOUT IT
-- A direction's slug is its address. The public page reads ?d=<slug> to open
-- on one direction, and it writes that parameter into the address bar as the
-- reader moves around, so every link anybody copies from a profile carries
-- one. Renaming a direction rewrites the slug, and every link already sent
-- stops naming anything.
--
-- It does not fail loudly, which is the worst part: an unknown slug resolves
-- to nothing and the page opens on the primary direction. Somebody who sent a
-- recruiter a link to their Technical Writing chapter, then renamed it, has no
-- way of knowing the recruiter is looking at a different one.
--
-- WHY A COLUMN ON THE ROW AND NOT A TABLE OF REDIRECTS
-- Because the only question ever asked of it is "does this old address belong
-- to this direction", and the direction is already being read. A separate
-- table would be a second query on the public page's hot path to answer
-- something the row can carry itself. Renames are rare and the array stays
-- short.
--
-- WHAT IT IS NOT FOR
-- Uniqueness. A slug is unique among CURRENT slugs, and nothing here changes
-- that: creating and renaming both still check `slug` alone. An old address
-- can collide with a current one, and when it does the current one wins -
-- that is a resolution rule on the page, not a constraint here. Enforcing
-- uniqueness across history would mean a name could never be reused, which is
-- a strange thing to tell somebody who has changed their mind twice.
-- ============================================================================

alter table public.profile_lenses
  add column if not exists previous_slugs text[] not null default '{}';

comment on column public.profile_lenses.previous_slugs is
  'Slugs this direction used to answer to, oldest first, so a ?d= link shared before a rename still opens the direction it named. Appended by /api/profile-lenses/rename; never consulted for uniqueness, which is always against the current slug alone. A current slug always wins over an entry here.';

-- The public page resolves a deep link by reading the directions it is already
-- showing, so this is not on a query path today. It is here because the array
-- is the kind of column something will eventually want to search, and a GIN
-- index on a short text[] costs almost nothing.
create index if not exists profile_lenses_previous_slugs_idx
  on public.profile_lenses using gin (previous_slugs);


-- ---------------------------------------------------------------------------
-- Checking it took
--
--   select column_name, data_type, is_nullable, column_default
--     from information_schema.columns
--    where table_schema = 'public'
--      and table_name = 'profile_lenses'
--      and column_name = 'previous_slugs';
--
--   -- expect every existing row to hold an empty array, never null
--   select count(*) from public.profile_lenses where previous_slugs is null;
-- ---------------------------------------------------------------------------
