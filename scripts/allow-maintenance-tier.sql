-- ============================================================================
-- ALLOW THE 'maintenance' TIER TO BE STORED
--
-- The app has three places that already know what 'maintenance' means:
--   app/components/MainNav.js   renders it with a VAULT badge
--   lib/profileTier.js          lets it customise a Career Profile
--   lib/tiers.js                groups it with Vault for every other gate
--
-- The database cannot store it. profiles_subscription_tier_check allows
-- 'free', 'pro' and 'vault' and nothing else, so an attempt to write
-- 'maintenance' is rejected and the row keeps whatever it had. Every one of
-- those three code paths is unreachable today.
--
-- That is a real gap rather than dead code: 'maintenance' is what a Vault
-- subscription is called during a change of plan, and an account caught
-- mid-transition currently has to be stored as something it is not. This
-- widens the constraint so the tier the code already understands can exist.
--
-- Nothing is migrated. No existing row changes. The only effect is that
-- 'maintenance' stops being rejected.
--
-- Run once, in the Supabase SQL editor.
-- ============================================================================

alter table public.profiles
  drop constraint if exists profiles_subscription_tier_check;

alter table public.profiles
  add constraint profiles_subscription_tier_check
  check (subscription_tier in ('free', 'pro', 'vault', 'maintenance'));

-- Verification: this should list the four tiers.
--
--   select pg_get_constraintdef(oid)
--   from pg_constraint
--   where conname = 'profiles_subscription_tier_check';
