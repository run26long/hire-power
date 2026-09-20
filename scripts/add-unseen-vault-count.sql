-- ============================================================================
-- profiles.unseen_vault_count
--
-- How many things have landed in somebody's career knowledge base since they
-- last opened the Career Vault. The nav reads it to draw a badge, the Vault
-- page announces it once and sets it back to zero.
--
-- WHY A FUNCTION AND NOT count = count + 1 FROM THE ROUTE
-- Four writers can arrive at once: coaching extraction and interview practice
-- extraction both run as background work after their session ends, and a
-- testimonial publish or an evidence upload can land in the same second. Four
-- read-then-writes from JavaScript lose counts. One statement in the database
-- does not.
--
-- WHO MAY CALL IT
-- The service role only. Every writer is a route handler holding that key, and
-- nothing about this number should be settable from a browser. Clearing it is
-- a different operation: a plain update of the owner's own row, which the
-- existing row-level policy already allows.
-- ============================================================================

alter table public.profiles
  add column if not exists unseen_vault_count integer not null default 0;

create or replace function public.bump_unseen_vault_count(p_user_id uuid, p_by integer default 1)
returns integer
language sql
security definer
set search_path = public
as $$
  update public.profiles
     set unseen_vault_count = greatest(0, unseen_vault_count + p_by)
   where id = p_user_id
  returning unseen_vault_count;
$$;

revoke all on function public.bump_unseen_vault_count(uuid, integer) from public, anon, authenticated;
grant execute on function public.bump_unseen_vault_count(uuid, integer) to service_role;
