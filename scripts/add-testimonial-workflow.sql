-- ============================================================================
-- TESTIMONIALS — the workflow columns and the three things the table does not
-- currently enforce
--
-- Run once in the Supabase SQL editor. Idempotent: safe to re-run.
--
-- WHAT THIS IS FOR
-- A referee is emailed a link, writes about the candidate on a public page,
-- sees a polished version straight away, and can ask for changes on the spot.
-- The candidate is notified, reviews it on their management page, and publishes
-- or does not. Nothing reaches the public profile without them.
--
--   requested  a request exists and has been emailed; nobody has written yet
--   submitted  the referee's own words are in raw_text
--   polished   polished_text is ready and the referee has seen it
--   published  the candidate put it on their profile
--
-- Unpublishing returns a row to `polished`. There is no separate approval
-- state: the referee approves by seeing the polish and not asking for changes,
-- and asking for changes simply reopens the form.
--
-- BEFORE YOU RUN IT
-- Section 1 lists any row that would block the constraints. At the time of
-- writing there are five rows, statuses `requested` and `published`, all with
-- distinct tokens, so all three constraints apply cleanly.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Anything that would block the constraints
--
-- Expect zero rows from each.
-- ---------------------------------------------------------------------------
select 'bad status' as problem, id, status
  from public.profile_testimonials
 where status is null
    or status not in ('requested', 'submitted', 'polished', 'published');

select 'duplicate token' as problem, request_token, count(*)
  from public.profile_testimonials
 where request_token is not null
 group by request_token
having count(*) > 1;


-- ---------------------------------------------------------------------------
-- 2. relationship_type — the category, beside the prose
--
-- WHY A NEW COLUMN AND NOT THE EXISTING ONE
-- `relationship` already holds prose, and the public profile prints it
-- verbatim under each quote: "Reported to James at Disruptor Manufacturing",
-- "Worked alongside James for nine years". That sentence is the attribution a
-- reader sees, and it is worth more than a category would be.
--
-- It is also useless for counting. Every existing value is distinct, so a
-- profile with four testimonials from four colleagues would look like four
-- different kinds of relationship. EARNED 360 asks how many KINDS of person
-- vouched for somebody, and that question needs a small fixed set.
--
-- So the prose stays where it is and the category goes beside it. Existing
-- rows are null and simply do not count toward the tag until somebody says
-- what they were.
--
-- WHY THIS LIST IS IN THE DATABASE WHEN THE EVIDENCE TYPES ARE NOT
-- A deliberate difference. Evidence types are labels on a tile; getting one
-- wrong is cosmetic, and the list will grow, so it lives in the route where it
-- is easy to change. This list is the denominator of a claim the profile
-- makes about itself. If "Manager" and "manager" and "Line manager" can all be
-- stored, three testimonials from one boss earn a tag that says three kinds of
-- people vouched for this person. Adding a category here should be an ALTER
-- somebody thought about, because it changes what the tag means.
-- ---------------------------------------------------------------------------
alter table public.profile_testimonials
  add column if not exists relationship_type text;

comment on column public.profile_testimonials.relationship_type is
  'The kind of working relationship, from a fixed set, used to count how many kinds of people have vouched for this profile. Separate from `relationship`, which is the prose attribution the public profile prints. Null on rows created before this column existed.';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profile_testimonials'::regclass
      and conname = 'profile_testimonials_relationship_type'
  ) then
    alter table public.profile_testimonials
      add constraint profile_testimonials_relationship_type
      check (
        relationship_type is null
        or relationship_type in ('Manager', 'Colleague', 'Direct Report', 'Client', 'Mentor')
      );
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- 3. request_token — unique
--
-- THIS ONE IS A BUG, NOT AN IMPROVEMENT
-- The token is the whole address of the referee's page: /testimonial/<token>
-- is looked up by it, with no session and nothing else to go on. I confirmed
-- the column is not unique by writing one row's token over another's, and the
-- database accepted it. Two rows sharing a token makes that lookup ambiguous -
-- the route either errors or picks one, and "picks one" means a referee could
-- be shown, and could write into, somebody else's request.
--
-- Nulls are left alone. A unique index in Postgres permits any number of them,
-- which is correct here: a row with no token is a row nobody has been sent.
-- ---------------------------------------------------------------------------
create unique index if not exists profile_testimonials_request_token_key
  on public.profile_testimonials (request_token)
  where request_token is not null;


-- ---------------------------------------------------------------------------
-- 4. status — the four states, and only those
--
-- The column is NOT NULL and otherwise unconstrained; it accepts 'banana'. I
-- checked. Everything downstream branches on this value, and the public
-- profile selects on status = 'published', so a typo in a route is the
-- difference between a testimonial being live and being invisible.
--
-- Adding a state means altering this constraint on purpose, which is the
-- point.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profile_testimonials'::regclass
      and conname = 'profile_testimonials_status'
  ) then
    alter table public.profile_testimonials
      add constraint profile_testimonials_status
      check (status in ('requested', 'submitted', 'polished', 'published'));
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- 5. The rate limit, which has to be durable
--
-- Three submissions per token per day. Every other rate limit in this product
-- is a Map in the route's process, which is fine for a signed-in caller doing
-- something cheap: it resets on deploy and does not carry across instances,
-- and the worst case is somebody gets a few more previews than intended.
--
-- This one is different. The surface is public, unauthenticated, addressed
-- only by a token, and the expensive part is a model call. An in-memory limit
-- there resets every deploy and is not shared between serverless instances, so
-- it is not a limit. It lives on the row.
--
-- Two columns rather than a rolling window: the count and the day it belongs
-- to. A submission on a new day resets the count, which is what "per day"
-- means to the person reading the message.
--
-- submitted_at is the most recent submission and is for the owner's list -
-- "revised yesterday" is worth showing.
-- ---------------------------------------------------------------------------
alter table public.profile_testimonials
  add column if not exists submitted_at timestamptz;

alter table public.profile_testimonials
  add column if not exists daily_submissions integer not null default 0;

alter table public.profile_testimonials
  add column if not exists daily_submissions_on date;

comment on column public.profile_testimonials.daily_submissions is
  'Submissions counted against the current daily limit for this token. Reset when daily_submissions_on is not today. On the row rather than in process memory because the surface it guards is public and unauthenticated.';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profile_testimonials'::regclass
      and conname = 'profile_testimonials_daily_submissions'
  ) then
    alter table public.profile_testimonials
      add constraint profile_testimonials_daily_submissions
      check (daily_submissions >= 0);
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- 6. Row level security
--
-- Nothing to add, and it matters here more than usual.
--
-- The referee's page is public and unauthenticated. It does NOT read this
-- table as the visitor: there is no anon policy on profile_testimonials and
-- none is added here. The page asks a route, the route uses the service role,
-- looks the row up by token, and returns only the candidate's display name and
-- the text belonging to that one row. A public read policy would turn the
-- whole table into something anyone could enumerate.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- 7. Checking it took
--
-- select column_name, data_type, is_nullable, column_default
--   from information_schema.columns
--  where table_schema = 'public' and table_name = 'profile_testimonials'
--    and column_name in ('relationship_type','submitted_at','daily_submissions','daily_submissions_on')
--  order by column_name;
--
-- Expect four rows.
--
-- select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--  where conrelid = 'public.profile_testimonials'::regclass
--    and conname like 'profile_testimonials_%';
--
-- select indexname from pg_indexes
--  where tablename = 'profile_testimonials'
--    and indexname = 'profile_testimonials_request_token_key';
--
-- These should now be rejected:
--   update public.profile_testimonials set status = 'banana' where id = '<an id>';
--   update public.profile_testimonials set relationship_type = 'Boss' where id = '<an id>';
--   update public.profile_testimonials set daily_submissions = -1 where id = '<an id>';
--   -- and setting two rows to the same request_token
--
-- These should be accepted:
--   update public.profile_testimonials set relationship_type = 'Manager' where id = '<an id>';
--   update public.profile_testimonials set status = 'polished' where id = '<an id>';
-- ---------------------------------------------------------------------------
