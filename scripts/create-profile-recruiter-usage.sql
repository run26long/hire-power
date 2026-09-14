-- ===========================================================================
-- Recruiter tool usage: the per-viewer, per-profile, per-day counter behind
-- Ask My Career and Evaluate For A Role.
--
-- WHAT THIS IS FOR
-- Both tools are public: no sign-in, no account, anyone holding the link. That
-- is the point of them, and it is also why they need a limit that does not
-- depend on knowing who the caller is. This table is that limit.
--
-- WHAT IT DELIBERATELY DOES NOT STORE
-- No IP address. `viewer_hash` is a digest the route computes from the caller's
-- address, the profile being read and a server-side secret, and only the digest
-- is sent here. The rows therefore cannot be turned back into a list of who
-- visited a profile, even by someone holding the whole table: without the
-- secret there is nothing to compare a candidate IP against, and the profile
-- salt means the same visitor reading two profiles produces two unrelated
-- digests. The question this table can answer is "has this viewer used this
-- tool on this profile today", which is the only question a rate limiter needs
-- to ask.
--
-- No question text, no job description, no answer. Those are the recruiter's
-- and the candidate's, and a counter has no business holding them.
--
-- SAFE TO RUN MORE THAN ONCE
-- Every statement is guarded. Re-running changes nothing and drops no rows.
--
-- WHAT THIS DOES NOT DO
-- It does not grant the features to anybody. Tier and publication are checked
-- in the route, against profiles.subscription_tier and
-- career_profiles.is_published, and this table is asked only after both pass.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. The table
--
-- One row per (profile, viewer, feature, day). The day is a date rather than a
-- timestamp because the limit is "per day" and a date is what that means: the
-- row for today either exists or it does not, and yesterday's row is simply a
-- different row. It is stored in UTC, so the window turns over at the same
-- moment for every viewer rather than at a local midnight the server cannot
-- know.
-- ---------------------------------------------------------------------------

create table if not exists public.profile_recruiter_usage (
  id uuid primary key default gen_random_uuid(),

  -- Whose profile was being read. Cascades: deleting a profile takes its
  -- counters with it, because a counter for a profile that no longer exists is
  -- not a record of anything.
  profile_id uuid not null
    references public.career_profiles(id) on delete cascade,

  -- The salted digest described above. Fixed length because it is always a
  -- SHA-256 rendered as hex; the CHECK is what stops a raw address ever being
  -- written into this column by mistake.
  viewer_hash text not null,

  -- Which tool. Open as text rather than an enum so a third recruiter tool
  -- does not need a migration to start counting, but constrained to the two
  -- that exist so a typo in a route cannot quietly open an uncounted lane.
  feature text not null,

  -- UTC date. Not a timestamp: see above.
  usage_day date not null default (now() at time zone 'utc')::date,

  -- How many times, today. Never decremented.
  call_count integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profile_recruiter_usage is
  'Per-viewer, per-profile, per-day call counts for the public recruiter tools. Holds a salted digest of the caller, never an address, and none of the text they sent.';
comment on column public.profile_recruiter_usage.viewer_hash is
  'SHA-256 hex of (caller address + profile id + server secret), computed in the route. Not reversible to an IP without the secret, and salted per profile so one viewer produces unrelated digests on different profiles.';
comment on column public.profile_recruiter_usage.usage_day is
  'UTC date. The limit window turns over at UTC midnight for every viewer, rather than at a local midnight the server has no way to know.';


-- ---------------------------------------------------------------------------
-- 2. Constraints
--
-- Added separately and guarded, so a table that already exists from an earlier
-- run of this file still ends up with all of them.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_constraint
                 where conname = 'profile_recruiter_usage_feature_check'
                   and conrelid = 'public.profile_recruiter_usage'::regclass) then
    alter table public.profile_recruiter_usage
      add constraint profile_recruiter_usage_feature_check
      check (feature in ('ask', 'evaluate'));
  end if;

  -- A digest, not an address. 64 lowercase hex characters and nothing else.
  if not exists (select 1 from pg_constraint
                 where conname = 'profile_recruiter_usage_hash_check'
                   and conrelid = 'public.profile_recruiter_usage'::regclass) then
    alter table public.profile_recruiter_usage
      add constraint profile_recruiter_usage_hash_check
      check (viewer_hash ~ '^[0-9a-f]{64}$');
  end if;

  if not exists (select 1 from pg_constraint
                 where conname = 'profile_recruiter_usage_count_check'
                   and conrelid = 'public.profile_recruiter_usage'::regclass) then
    alter table public.profile_recruiter_usage
      add constraint profile_recruiter_usage_count_check
      check (call_count >= 0);
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- 3. The uniqueness the counter depends on
--
-- This is the one that matters. Without it two requests arriving together both
-- read a count of 4, both decide there is room, and both write a fifth - which
-- is how a limit of five serves six. With it, the second insert collides and
-- the upsert in the function below turns into an update of the row the first
-- one made, so the two are counted in sequence whatever order they arrive in.
--
-- No partial predicate: every column in the key is NOT NULL, so a plain unique
-- index constrains every row and ON CONFLICT can infer it.
-- ---------------------------------------------------------------------------

create unique index if not exists profile_recruiter_usage_key
  on public.profile_recruiter_usage (profile_id, viewer_hash, feature, usage_day);

-- For the sweep in section 7, which walks by date.
create index if not exists profile_recruiter_usage_day_idx
  on public.profile_recruiter_usage (usage_day);


-- ---------------------------------------------------------------------------
-- 4. updated_at
--
-- Reuses whichever trigger function this database already has rather than
-- adding another one beside it. Same detection the evidence migration used.
-- ---------------------------------------------------------------------------

do $$
declare
  fn text;
begin
  select n.nspname || '.' || p.proname into fn
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where p.prorettype = 'pg_catalog.trigger'::regtype
    and p.pronargs = 0
    and p.proname in ('set_updated_at', 'handle_updated_at', 'update_updated_at_column', 'trigger_set_timestamp', 'hp_set_updated_at')
  order by case when n.nspname = 'public' then 0 else 1 end, p.proname
  limit 1;

  if fn is null then
    execute $fn$
      create or replace function public.hp_set_updated_at() returns trigger
      language plpgsql
      as $body$
      begin
        new.updated_at = now();
        return new;
      end;
      $body$;
    $fn$;
    fn := 'public.hp_set_updated_at';
    raise notice 'created %', fn;
  else
    raise notice 'reusing existing trigger function %', fn;
  end if;

  execute 'drop trigger if exists profile_recruiter_usage_set_updated_at on public.profile_recruiter_usage';
  execute format(
    'create trigger profile_recruiter_usage_set_updated_at before update on public.profile_recruiter_usage
     for each row execute function %s()', fn);
end $$;


-- ---------------------------------------------------------------------------
-- 5. Row level security
--
-- Nothing for anybody. No select, no insert, no update, no delete, for anon or
-- for any signed-in user: these rows are not the profile owner's to read and
-- certainly not a visitor's. The routes reach them through the service role,
-- which bypasses RLS, and through the function below rather than directly.
--
-- RLS enabled with no policies is a deliberate deny-all, not an oversight.
-- ---------------------------------------------------------------------------

alter table public.profile_recruiter_usage enable row level security;

do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'profile_recruiter_usage'
  loop
    execute format('drop policy %I on public.profile_recruiter_usage', pol.policyname);
    raise notice 'dropped stray policy %', pol.policyname;
  end loop;
end $$;


-- ---------------------------------------------------------------------------
-- 6. The counter
--
-- Claim one use, or refuse. Both the check and the increment happen inside a
-- single statement, so there is no window between deciding there is room and
-- taking it - which is the whole reason this is a function and not two queries
-- in the route.
--
-- How it works: the insert always attempts a row with call_count 1. If today's
-- row already exists the unique index above sends it to the update, and the
-- update carries a WHERE that only fires while the stored count is still below
-- the limit. A caller at the limit therefore updates no row, RETURNING gives
-- nothing back, and the function reports the refusal without having changed
-- anything.
--
-- Returns one row: whether the call was allowed, and how many the viewer has
-- left after it. `allowed = false` means nothing was written.
--
-- SECURITY DEFINER so the routes can call it without a policy that would also
-- let them read the table; search_path is pinned, which is what stops a
-- definer function from being redirected at a shadowed table.
-- ---------------------------------------------------------------------------

create or replace function public.claim_recruiter_use(
  p_profile_id uuid,
  p_viewer_hash text,
  p_feature text,
  p_limit integer
)
returns table (allowed boolean, remaining integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
  v_day date := (now() at time zone 'utc')::date;
begin
  if p_limit is null or p_limit < 1 then
    raise exception 'claim_recruiter_use: p_limit must be a positive integer';
  end if;

  -- Aliased, because the existing row has to be named in the DO UPDATE and in
  -- RETURNING, and an alias on the insert target is the spelling that is
  -- unambiguously valid in all three places.
  insert into public.profile_recruiter_usage as u
    (profile_id, viewer_hash, feature, usage_day, call_count)
  values (p_profile_id, p_viewer_hash, p_feature, v_day, 1)
  on conflict (profile_id, viewer_hash, feature, usage_day)
  do update set call_count = u.call_count + 1
  where u.call_count < p_limit
  returning u.call_count into v_count;

  if v_count is null then
    -- Nothing was written: today's row is already at the limit.
    return query select false, 0;
  else
    return query select true, greatest(p_limit - v_count, 0);
  end if;
end $$;

comment on function public.claim_recruiter_use(uuid, text, text, integer) is
  'Claims one recruiter-tool use for a viewer on a profile today, or refuses. Checks and increments in one statement, so concurrent callers cannot both pass the same remaining slot. Returns (allowed, remaining); allowed=false means nothing was written.';

revoke all on function public.claim_recruiter_use(uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.claim_recruiter_use(uuid, text, text, integer) to service_role;


-- ---------------------------------------------------------------------------
-- 7. Housekeeping
--
-- Yesterday's counters answer no question. This is here so the table stays a
-- working set rather than a growing log of who read what; it is a plain
-- function rather than a schedule, because whether to run it, and how often,
-- is an operational decision and not this file's to make.
-- ---------------------------------------------------------------------------

create or replace function public.prune_recruiter_usage(p_keep_days integer default 7)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  removed integer;
begin
  delete from public.profile_recruiter_usage
  where usage_day < ((now() at time zone 'utc')::date - p_keep_days);
  get diagnostics removed = row_count;
  return removed;
end $$;

comment on function public.prune_recruiter_usage(integer) is
  'Deletes recruiter usage rows older than p_keep_days. Nothing depends on old rows; run it on whatever schedule suits.';

revoke all on function public.prune_recruiter_usage(integer) from public, anon, authenticated;
grant execute on function public.prune_recruiter_usage(integer) to service_role;


-- ---------------------------------------------------------------------------
-- 8. What landed
-- ---------------------------------------------------------------------------

do $$
declare
  cols integer;
  idx integer;
  pols integer;
  fns integer;
begin
  select count(*) into cols from information_schema.columns
    where table_schema = 'public' and table_name = 'profile_recruiter_usage';
  select count(*) into idx from pg_indexes
    where schemaname = 'public' and tablename = 'profile_recruiter_usage';
  select count(*) into pols from pg_policies
    where schemaname = 'public' and tablename = 'profile_recruiter_usage';
  select count(*) into fns from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('claim_recruiter_use', 'prune_recruiter_usage');

  raise notice 'profile_recruiter_usage: % columns, % indexes, % policies (0 is correct), % functions', cols, idx, pols, fns;
end $$;
