-- ============================================================================
-- THE CONTACT BUTTON'S OWN SWITCH
--
-- RUN THIS BEFORE DEPLOYING THE CODE THAT READS IT.
--
-- It is safe to run first and wrong to run second. Running it first leaves the
-- old code unaffected: nothing reads contact_enabled yet, every row keeps the
-- contact_email it had, and the three states that column encodes today keep
-- meaning exactly what they meant. Running it second means the new code asks
-- for a column that is not there - the select fails, the drawer cannot read
-- the switch, and a write to it errors.
--
-- WHY A SECOND COLUMN AT ALL
--
-- contact_email carries three states today and the middle one is doing two
-- jobs at once:
--
--   NULL        never touched. The account address stands in, so a profile
--               somebody has just published can be answered straight away.
--   ''          cleared on purpose. No Contact button. This is the only way
--               to switch it off.
--   an address  the owner's own choice, which wins over both.
--
-- So "off" and "no custom address" are the same value, and there is nowhere to
-- record "switch the button off but keep the address I typed". Somebody who
-- turns the button off loses their address, and turning it back on means
-- typing it again - which is the thing the switch exists to avoid.
--
-- Split in two, each column answering one question:
--
--   contact_enabled   is the button on the profile?
--   contact_email     which address does it open, or empty for the account's
--
-- The three-state reading of contact_email collapses to two, and nothing is
-- lost: the rows that meant "off" are exactly the rows this backfills to
-- false.
--
-- WHAT THE BACKFILL HAS TO GET RIGHT
--
-- Only the empty string is off. NULL is "never touched", which has always
-- meant the button is on with the account address behind it, and it has to
-- stay that way or every profile that never visited the setting would lose
-- its Contact button the moment this ran. Testing for '' and not for falsiness
-- is the whole of it.
-- ============================================================================

-- ---- 1. The column -------------------------------------------------------
--
-- NOT NULL with a default of true, so the question is always answered and the
-- answer for a row nobody has touched is the behaviour that row already had.
-- A new profile gets its Contact button without anything having to switch it
-- on.

ALTER TABLE public.career_profiles
  ADD COLUMN IF NOT EXISTS contact_enabled boolean NOT NULL DEFAULT true;


-- ---- 2. The backfill -----------------------------------------------------
--
-- The rows that had switched the button off. After this, contact_email means
-- only "which address", so the '' those rows carry reads as "the account's"
-- and the switch is what keeps them off.
--
-- Deliberately not clearing or rewriting contact_email: a row that is off and
-- holds an address is now a legal, meaningful state, and it is the one the
-- switch was added for.

UPDATE public.career_profiles
   SET contact_enabled = false
 WHERE contact_email = '';


-- ---- 3. What it looks like afterwards ------------------------------------
--
-- Four readings, all of them legal. Run this to see them; it writes nothing.

SELECT
  slug,
  is_published,
  contact_enabled,
  CASE
    WHEN contact_email IS NULL THEN 'never set'
    WHEN contact_email = ''    THEN 'the account address'
    ELSE 'a custom address'
  END AS address,
  CASE
    WHEN contact_enabled THEN 'button shows'
    ELSE 'no button'
  END AS button
FROM public.career_profiles
ORDER BY contact_enabled DESC, slug;
