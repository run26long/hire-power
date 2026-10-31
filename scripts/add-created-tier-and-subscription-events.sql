-- ============================================================================
-- PLAN ORIGIN — what plan each thing was made on
--
-- Run once in the Supabase SQL editor. Idempotent: safe to re-run.
--
-- RUN THIS BEFORE DEPLOYING THE CODE. The columns and the trigger are additive
-- and the running app neither reads nor writes them, so the old build is
-- unaffected by them existing. The new build reads created_tier on every hub
-- load, so if the code goes first every Free account briefly sees an empty Job
-- Match Scores panel - the column would be there but null on every row, and
-- null is not 'free'. The one exception is the backfill at the bottom, which is
-- safe in either order.
--
-- WHY THIS EXISTS
--
-- Free and Vault share one lifetime allowance: three job match scores and
-- three cover letters, which never resets. Anything made on Pro must not count
-- against it, and must not appear in those panels. Until now nothing recorded
-- which plan anything was made on: there is no subscription history table, and
-- resumes.coaching_tier_at_save is the only tier stamp in the schema - written
-- only when a coaching session is saved, null on anything never coached, and
-- about coaching rather than creation. So origin could not be asked, only
-- guessed.
--
-- WHY A TRIGGER AND NOT THE INSERT SITES
--
-- Fourteen places insert into these four tables and ten of them run in the
-- browser with the user's own key. A created_tier written there is a value the
-- client chose, and the one thing it controls is whether the row counts against
-- a paid allowance - which makes it exactly the field not to take the client's
-- word on. The trigger reads profiles.subscription_tier server-side and
-- overwrites whatever arrived, so no insert site has to be trusted, none has to
-- be changed, and a new one cannot forget.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. THE COLUMN
--
-- Nullable, with no default. A default would quietly make every future insert
-- claim a plan rather than letting the trigger decide, and a null is an honest
-- "nothing wrote this" that the backfill below can find.
-- ---------------------------------------------------------------------------
alter table public.resumes             add column if not exists created_tier text;
alter table public.cover_letters       add column if not exists created_tier text;
alter table public.interview_sessions  add column if not exists created_tier text;
alter table public.power_analysis      add column if not exists created_tier text;

comment on column public.resumes.created_tier is
  'The account''s plan when this row was inserted. Written by set_created_tier(), never by the application. Decides whether the row counts against the Free/Vault lifetime allowance.';
comment on column public.cover_letters.created_tier is
  'The account''s plan when this row was inserted. Written by set_created_tier(), never by the application.';
comment on column public.interview_sessions.created_tier is
  'The account''s plan when this row was inserted. Written by set_created_tier(), never by the application.';
comment on column public.power_analysis.created_tier is
  'The account''s plan when this row was inserted. Written by set_created_tier(), never by the application.';

-- The panels filter on this column on every hub load, per user.
create index if not exists resumes_user_created_tier_idx
  on public.resumes (user_id, created_tier);
create index if not exists cover_letters_user_created_tier_idx
  on public.cover_letters (user_id, created_tier);


-- ---------------------------------------------------------------------------
-- 2. THE TRIGGER
--
-- One function for all four tables. They have user_id and created_tier in
-- common and nothing else matters here.
--
-- SECURITY DEFINER because it reads public.profiles, and the caller is usually
-- the row's owner holding their own key: RLS on profiles lets them read their
-- own row, but this must work the same way for a service-role insert and for a
-- row inserted on somebody's behalf, and it must not depend on a profiles
-- policy staying as it is. search_path is pinned for the usual reason - a
-- definer function that resolves names through the caller's search_path is a
-- way to get it to call something else.
--
-- NEW.created_tier is overwritten unconditionally. Not coalesced: a client that
-- sends 'pro' is exactly the case this is here to ignore.
--
-- An account with no profiles row, or one with a null tier, lands on 'free'.
-- That is the same default every tier predicate in lib/tiers.js applies to an
-- unrecognised plan, and it is the strict direction: the failure mode is a row
-- counting against an allowance it should not, which is visible and fixable,
-- rather than a paid-plan row silently never counting.
-- ---------------------------------------------------------------------------
create or replace function public.set_created_tier()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  select coalesce(p.subscription_tier, 'free')
    into new.created_tier
    from public.profiles p
   where p.id = new.user_id;

  if new.created_tier is null then
    new.created_tier := 'free';
  end if;

  return new;
end;
$$;

comment on function public.set_created_tier() is
  'Stamps created_tier from profiles.subscription_tier on insert, overriding any value the client sent. See add-created-tier-and-subscription-events.sql.';

drop trigger if exists set_created_tier on public.resumes;
create trigger set_created_tier
  before insert on public.resumes
  for each row execute function public.set_created_tier();

drop trigger if exists set_created_tier on public.cover_letters;
create trigger set_created_tier
  before insert on public.cover_letters
  for each row execute function public.set_created_tier();

drop trigger if exists set_created_tier on public.interview_sessions;
create trigger set_created_tier
  before insert on public.interview_sessions
  for each row execute function public.set_created_tier();

drop trigger if exists set_created_tier on public.power_analysis;
create trigger set_created_tier
  before insert on public.power_analysis
  for each row execute function public.set_created_tier();


-- ---------------------------------------------------------------------------
-- 3. SUBSCRIPTION EVENTS
--
-- Append-only. Every tier change, as the Stripe webhook sees it, so that the
-- next question like this one can be answered from the data rather than
-- inferred from a single cancelled_at that the following cancellation
-- overwrites.
--
-- Nothing reads it yet. It is here now because the only way to have a history
-- later is to start keeping one now, and because the webhook already has every
-- transition in hand and currently throws them away.
--
-- stripe_event_id is unique where present, so a webhook Stripe delivers twice
-- writes one row. Nullable, for a change made by hand or by a script.
-- ---------------------------------------------------------------------------
create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- Both nullable: the first event for an account has nothing before it, and a
  -- deletion has nothing after it.
  from_tier text,
  to_tier text,

  stripe_event_id text unique,
  created_at timestamptz not null default now()
);

create index if not exists subscription_events_user_created_idx
  on public.subscription_events (user_id, created_at desc);

alter table public.subscription_events enable row level security;

-- Read-only to owners, and that is the whole policy set on purpose. The
-- webhook writes with the service role, which bypasses RLS; giving anybody an
-- insert, update or delete policy on an append-only billing log would be
-- handing out the ability to rewrite it.
drop policy if exists "Owners read their subscription events" on public.subscription_events;
create policy "Owners read their subscription events"
  on public.subscription_events
  for select
  using (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
-- 4. THE BACKFILL
--
-- Existing rows have no origin recorded and Stripe is not being read, so the
-- origin is inferred from the one boundary the data does hold:
-- profiles.cancelled_at.
--
--   Pro today                      every row is 'pro'. They are on the plan
--                                  now; nothing they hold counts against an
--                                  allowance they do not have.
--
--   not Pro, cancelled_at null     never had Pro, so every row was made on the
--                                  plan they are on. This is the case option B
--                                  would have got wrong: stamping a never-paid
--                                  account's own job match scores 'pro' would
--                                  hide them from their own panel and put an
--                                  upgrade prompt over their own work.
--
--   not Pro, cancelled_at set      lapsed. Rows created before the
--                                  cancellation were made on Pro; rows created
--                                  on or after it were made on the plan they
--                                  are on now.
--
-- WHAT IT IS WRONG ABOUT, SAID OUT LOUD
--
-- cancelled_at is the most recent cancellation, so an account that subscribed,
-- lapsed, resubscribed and lapsed again has one boundary where it needs two,
-- and its first paid spell reads as Free. It also says nothing about Vault: a
-- row made on Vault after a Pro cancellation is stamped with the current tier,
-- which is right when they are still on Vault and wrong if they have since
-- dropped to Free. Both err toward counting a row against the allowance rather
-- than hiding it behind an upgrade prompt, which is the direction to be wrong
-- in: a visible item that eats a slot can be reported, an invisible one cannot.
--
-- Only null rows are written, so this cannot overwrite a tier the trigger has
-- since stamped, and re-running it is a no-op.
-- ---------------------------------------------------------------------------
update public.resumes r
   set created_tier = case
         when coalesce(p.subscription_tier, 'free') = 'pro' then 'pro'
         when p.cancelled_at is not null and r.created_at < p.cancelled_at then 'pro'
         else coalesce(p.subscription_tier, 'free')
       end
  from public.profiles p
 where p.id = r.user_id
   and r.created_tier is null;

update public.cover_letters c
   set created_tier = case
         when coalesce(p.subscription_tier, 'free') = 'pro' then 'pro'
         when p.cancelled_at is not null and c.created_at < p.cancelled_at then 'pro'
         else coalesce(p.subscription_tier, 'free')
       end
  from public.profiles p
 where p.id = c.user_id
   and c.created_tier is null;

update public.interview_sessions s
   set created_tier = case
         when coalesce(p.subscription_tier, 'free') = 'pro' then 'pro'
         when p.cancelled_at is not null and s.created_at < p.cancelled_at then 'pro'
         else coalesce(p.subscription_tier, 'free')
       end
  from public.profiles p
 where p.id = s.user_id
   and s.created_tier is null;

update public.power_analysis a
   set created_tier = case
         when coalesce(p.subscription_tier, 'free') = 'pro' then 'pro'
         when p.cancelled_at is not null and a.created_at < p.cancelled_at then 'pro'
         else coalesce(p.subscription_tier, 'free')
       end
  from public.profiles p
 where p.id = a.user_id
   and a.created_tier is null;

-- A row whose owner has no profiles row at all is matched by none of the joins
-- above. There should be none; this catches them rather than leaving a null the
-- panels would read as "not free".
update public.resumes            set created_tier = 'free' where created_tier is null;
update public.cover_letters      set created_tier = 'free' where created_tier is null;
update public.interview_sessions set created_tier = 'free' where created_tier is null;
update public.power_analysis     set created_tier = 'free' where created_tier is null;


-- ---------------------------------------------------------------------------
-- 5. WHAT IT DID
--
-- Read the output of these before you deploy. The first should show no nulls.
-- ---------------------------------------------------------------------------
select 'resumes' as source, created_tier, count(*) from public.resumes group by 1, 2
union all
select 'cover_letters', created_tier, count(*) from public.cover_letters group by 1, 2
union all
select 'interview_sessions', created_tier, count(*) from public.interview_sessions group by 1, 2
union all
select 'power_analysis', created_tier, count(*) from public.power_analysis group by 1, 2
order by 1, 2;

-- Every non-Pro account holding live Free/Vault-origin items, against the
-- counter that is supposed to have counted them. live > counter means the
-- panel will show more live items than the allowance recorded; the hub clamps
-- the used-slot count at zero so it renders the live items and no used slots.
select c.slug,
       p.subscription_tier,
       p.cancelled_at,
       p.jms_count,
       (select count(*) from public.resumes r
         where r.user_id = p.id and r.resume_type = 'job_specific'
           and r.is_active and r.created_tier in ('free', 'vault', 'maintenance')) as live_job_specific,
       p.cl_count,
       (select count(*) from public.cover_letters cl
         where cl.user_id = p.id and cl.is_active
           and cl.created_tier in ('free', 'vault', 'maintenance')) as live_cover_letters
  from public.profiles p
  left join public.career_profiles c on c.user_id = p.id
 where coalesce(p.subscription_tier, 'free') <> 'pro'
 order by 1;
