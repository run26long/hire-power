-- ============================================================================
-- QUOTE MARKS NOBODY MEANT TO SEND
--
-- Run once in the Supabase SQL editor. This cleans rows already in the table;
-- the app strips these on save from now on, in lib/stripQuotes.js.
--
-- WHY
-- Referees paste. What arrives is often the sentence they wrote somewhere
-- else with the marks that held it there still attached: the whole thing
-- wrapped in quotes, or a lone closing curly quote at the end where the
-- opening one stayed behind in the other document. The profile then prints
-- the testimonial inside its own quotation marks, so a wrapped one comes out
-- doubly quoted and a stray one looks like a typo somebody else made.
--
-- WHAT IT CHANGES, AND NOTHING ELSE
--   "the whole thing"      a straight pair around all of it
--   “the whole thing”      a curly pair around all of it
--   “the whole thing       a curly opener with no closer anywhere
--   the whole thing”       a curly closer with no opener anywhere
--
-- Both raw_text and polished_text, because the owner can publish either.
--
-- EVERY CASE IS ANCHORED AT BOTH ENDS
-- That is what makes it safe. Each pattern describes the entire value, so a
-- quotation inside a sentence cannot match part of one and be half removed.
-- A value the four patterns do not describe is left exactly as it is.
--
-- THIS IS NARROWER THAN THE APP, DELIBERATELY
-- The app counts marks, so it can tell a wrapped sentence with its own
-- quotation inside it from two separate quotations that happen to begin and
-- end the text. Expressing that here would take a function, a loop and
-- several ways to be subtly wrong on somebody's words. So this does only the
-- cases that are certain, and leaves the rest as the referee sent them -
-- which is the right failure.
--
-- SINGLE QUOTES ARE NOT TOUCHED AT ALL
-- A trailing ' or ’ is far more often a possessive than a stray: "the
-- engineers’" is a word. Eating an apostrophe off the end of somebody's
-- sentence is worse than leaving a mark on it.
--
-- Safe to re-run. A second pass finds nothing the patterns still match.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- STEP 0 — WHAT WOULD CHANGE. Read-only. Run this on its own first: every row
-- is shown before and after, so the change can be read rather than trusted.
-- No rows means there is nothing to do.
-- ---------------------------------------------------------------------------

with tidied as (
  select
    id,
    recipient_name,
    raw_text,
    polished_text,
    case
      when btrim(coalesce(raw_text, '')) ~ '^"[^"]*"$'
        then btrim(substring(btrim(raw_text) from 2 for length(btrim(raw_text)) - 2))
      when btrim(coalesce(raw_text, '')) ~ '^“[^“”]*”$'
        then btrim(substring(btrim(raw_text) from 2 for length(btrim(raw_text)) - 2))
      when btrim(coalesce(raw_text, '')) ~ '^“[^“”]*$'
        then btrim(substring(btrim(raw_text) from 2))
      when btrim(coalesce(raw_text, '')) ~ '^[^“”]*”$'
        then btrim(substring(btrim(raw_text) from 1 for length(btrim(raw_text)) - 1))
      else raw_text
    end as raw_after,
    case
      when btrim(coalesce(polished_text, '')) ~ '^"[^"]*"$'
        then btrim(substring(btrim(polished_text) from 2 for length(btrim(polished_text)) - 2))
      when btrim(coalesce(polished_text, '')) ~ '^“[^“”]*”$'
        then btrim(substring(btrim(polished_text) from 2 for length(btrim(polished_text)) - 2))
      when btrim(coalesce(polished_text, '')) ~ '^“[^“”]*$'
        then btrim(substring(btrim(polished_text) from 2))
      when btrim(coalesce(polished_text, '')) ~ '^[^“”]*”$'
        then btrim(substring(btrim(polished_text) from 1 for length(btrim(polished_text)) - 1))
      else polished_text
    end as polished_after
  from public.profile_testimonials
)
select
  id,
  recipient_name,
  raw_text      as raw_before,
  raw_after,
  polished_text as polished_before,
  polished_after
  from tidied
 where raw_after is distinct from raw_text
    or polished_after is distinct from polished_text
 order by recipient_name;


-- ---------------------------------------------------------------------------
-- THE CHANGE. The same four cases, written back. One statement, and only the
-- rows a case actually describes: the else branch returns the column
-- unchanged, so everything else is written as it already was.
-- ---------------------------------------------------------------------------

update public.profile_testimonials
   set raw_text = case
         when btrim(coalesce(raw_text, '')) ~ '^"[^"]*"$'
           then btrim(substring(btrim(raw_text) from 2 for length(btrim(raw_text)) - 2))
         when btrim(coalesce(raw_text, '')) ~ '^“[^“”]*”$'
           then btrim(substring(btrim(raw_text) from 2 for length(btrim(raw_text)) - 2))
         when btrim(coalesce(raw_text, '')) ~ '^“[^“”]*$'
           then btrim(substring(btrim(raw_text) from 2))
         when btrim(coalesce(raw_text, '')) ~ '^[^“”]*”$'
           then btrim(substring(btrim(raw_text) from 1 for length(btrim(raw_text)) - 1))
         else raw_text
       end,
       polished_text = case
         when btrim(coalesce(polished_text, '')) ~ '^"[^"]*"$'
           then btrim(substring(btrim(polished_text) from 2 for length(btrim(polished_text)) - 2))
         when btrim(coalesce(polished_text, '')) ~ '^“[^“”]*”$'
           then btrim(substring(btrim(polished_text) from 2 for length(btrim(polished_text)) - 2))
         when btrim(coalesce(polished_text, '')) ~ '^“[^“”]*$'
           then btrim(substring(btrim(polished_text) from 2))
         when btrim(coalesce(polished_text, '')) ~ '^[^“”]*”$'
           then btrim(substring(btrim(polished_text) from 1 for length(btrim(polished_text)) - 1))
         else polished_text
       end,
       updated_at = now()
 where btrim(coalesce(raw_text, ''))      ~ '^"[^"]*"$|^“[^“”]*”$|^“[^“”]*$|^[^“”]*”$'
    or btrim(coalesce(polished_text, '')) ~ '^"[^"]*"$|^“[^“”]*”$|^“[^“”]*$|^[^“”]*”$';


-- ---------------------------------------------------------------------------
-- AFTERWARDS. Should be 0.
-- ---------------------------------------------------------------------------

select count(*) as "rows still wrapped or trailing a lone mark"
  from public.profile_testimonials
 where btrim(coalesce(raw_text, ''))      ~ '^"[^"]*"$|^“[^“”]*”$|^“[^“”]*$|^[^“”]*”$'
    or btrim(coalesce(polished_text, '')) ~ '^"[^"]*"$|^“[^“”]*”$|^“[^“”]*$|^[^“”]*”$';
