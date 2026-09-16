-- ============================================================================
-- SET_FEATURED_PLACEMENT — moving the star without dropping it
--
-- Run once in the Supabase SQL editor. Idempotent: safe to re-run.
--
-- WHY A FUNCTION AND NOT TWO UPDATES
-- "Featured" is not a flag on this table, it is a unique index. I confirmed by
-- inserting the violating rows and rolling them back; there are three indexes
-- in play and it is worth naming them, because the behaviour below follows
-- from them rather than from taste:
--
--   profile_evidence_placements_lens_key
--     one placement per (evidence_id, lens_id) - an item cannot be placed in
--     the same direction twice
--
--   profile_evidence_placements_featured_lens_key
--     one FEATURED placement per direction
--
--   profile_evidence_placements_featured_shared_key
--     one FEATURED placement in the shared layer, where lens_id is null
--
-- So moving the star is "clear the old one, then set the new one". As two
-- PostgREST calls those are two transactions, and a failure between them
-- leaves that direction with no featured item at all - a silent regression in
-- the profile, caused by a successful first half. Inside one function they are
-- one transaction: both, or neither.
--
-- WHOSE PLACEMENTS THIS TOUCHES
-- The user id passed in, and only theirs. The profile is looked up FROM that
-- user rather than passed alongside it, and every id in the arguments is
-- checked to belong to the profile that lookup found. A lens or an evidence
-- item from another account raises rather than writing.
--
-- That argument is not a permission. It is derived server-side from a verified
-- bearer token by the route that calls this, which is the same rule every
-- other write in this product follows, and the grant at the bottom is what
-- keeps anyone else from calling it with somebody else's id.
--
-- SECURITY INVOKER, DELIBERATELY
-- Not DEFINER. The only caller is the service role, which already bypasses
-- RLS, so DEFINER would buy nothing and would turn this into a way to write
-- past RLS if the grant were ever widened by accident. The ownership checks
-- inside are the real boundary.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. The indexes this relies on
--
-- Run first. Expect all three to be present. If any is missing, this function
-- still behaves correctly - it just stops being the only thing preventing two
-- featured items in one direction.
-- ---------------------------------------------------------------------------
select indexname, indexdef
  from pg_indexes
 where schemaname = 'public'
   and tablename = 'profile_evidence_placements'
 order by indexname;


-- ---------------------------------------------------------------------------
-- 2. The function
--
-- p_lens_id     null means the shared layer, which has its own featured index.
--               `is not distinct from` rather than `=` throughout, because
--               `lens_id = null` is never true and would quietly match nothing.
--
-- p_evidence_id null means "this direction should have no featured item", so
--               the star can be taken off without putting it somewhere else.
--
-- Returns the direction's placements as they now stand, so the caller can
-- render from what was actually stored rather than from what it hoped.
-- ---------------------------------------------------------------------------
create or replace function public.set_featured_placement(
  p_user_id     uuid,
  p_lens_id     uuid,
  p_evidence_id uuid
)
returns table (
  evidence_id uuid,
  lens_id     uuid,
  featured    boolean,
  sort_order  integer
)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_profile_id uuid;
begin
  select cp.id into v_profile_id
    from public.career_profiles cp
   where cp.user_id = p_user_id;

  if v_profile_id is null then
    raise exception 'NO_PROFILE' using errcode = '42501';
  end if;

  -- A direction from another account is not a direction this user may star in.
  if p_lens_id is not null then
    if not exists (
      select 1 from public.profile_lenses pl
       where pl.id = p_lens_id and pl.profile_id = v_profile_id
    ) then
      raise exception 'LENS_NOT_FOUND' using errcode = '42501';
    end if;
  end if;

  -- An item can only lead a direction it is already placed in. Featuring is
  -- not a way to place something, so this refuses rather than inserting.
  if p_evidence_id is not null then
    if not exists (
      select 1 from public.profile_evidence_placements pep
       where pep.profile_id  = v_profile_id
         and pep.evidence_id = p_evidence_id
         and pep.lens_id is not distinct from p_lens_id
    ) then
      raise exception 'PLACEMENT_NOT_FOUND' using errcode = '42501';
    end if;
  end if;

  -- Clear first, or the unique index refuses the second write. The target is
  -- excluded, so re-starring the item that already leads is a no-op rather
  -- than a clear followed by a set.
  update public.profile_evidence_placements pep
     set featured = false,
         updated_at = now()
   where pep.profile_id = v_profile_id
     and pep.lens_id is not distinct from p_lens_id
     and pep.featured
     and (p_evidence_id is null or pep.evidence_id <> p_evidence_id);

  if p_evidence_id is not null then
    update public.profile_evidence_placements pep
       set featured = true,
           updated_at = now()
     where pep.profile_id  = v_profile_id
       and pep.lens_id is not distinct from p_lens_id
       and pep.evidence_id = p_evidence_id;
  end if;

  return query
    select pep.evidence_id, pep.lens_id, pep.featured, pep.sort_order
      from public.profile_evidence_placements pep
     where pep.profile_id = v_profile_id
       and pep.lens_id is not distinct from p_lens_id
     order by pep.sort_order asc, pep.created_at asc;
end;
$$;

comment on function public.set_featured_placement(uuid, uuid, uuid) is
  'Moves the featured flag within one direction (or the shared layer, lens_id null) in a single transaction, because one-featured-per-direction is enforced by a unique index and a two-statement swap can leave a direction with none. Derives the profile from p_user_id and refuses any lens or evidence id belonging to another account. Callable only by the service role; the route supplies p_user_id from a verified token.';


-- ---------------------------------------------------------------------------
-- 3. Who may call it
--
-- Nobody but the server. The route that calls this derives p_user_id from a
-- bearer token it has verified; a browser able to call it directly could pass
-- any user id it liked, and the argument would become the vulnerability.
-- ---------------------------------------------------------------------------
revoke all on function public.set_featured_placement(uuid, uuid, uuid) from public;
revoke all on function public.set_featured_placement(uuid, uuid, uuid) from anon;
revoke all on function public.set_featured_placement(uuid, uuid, uuid) from authenticated;
grant execute on function public.set_featured_placement(uuid, uuid, uuid) to service_role;


-- ---------------------------------------------------------------------------
-- 4. Checking it took
--
-- select p.proname, pg_get_function_identity_arguments(p.oid) as args,
--        p.prosecdef as is_security_definer
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public' and p.proname = 'set_featured_placement';
--
-- Expect one row, args "uuid, uuid, uuid", is_security_definer false.
--
-- And who holds execute - expect service_role only:
--
-- select grantee, privilege_type
--   from information_schema.role_routine_grants
--  where routine_name = 'set_featured_placement';
--
-- A live check, against a profile you own. Replace the ids:
--
--   select * from public.set_featured_placement(
--     '<your auth user id>'::uuid,
--     '<a lens id on that profile>'::uuid,
--     '<an evidence id already placed in that lens>'::uuid
--   );
--
-- Expect the direction's placements back, exactly one with featured = true.
-- Calling it again with the same evidence id changes nothing. Passing null as
-- the third argument clears the star for that direction. Passing a lens id
-- from another account raises LENS_NOT_FOUND.
-- ---------------------------------------------------------------------------
