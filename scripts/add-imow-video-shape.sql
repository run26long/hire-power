-- ============================================================================
-- IN MY OWN WORDS — the video's shape, and its poster
--
-- Run once in the Supabase SQL editor. Idempotent: safe to re-run.
--
-- WHY THIS EXISTS
-- The In My Own Words video used to be landscape or nothing: the editor read
-- videoWidth and videoHeight out of a <video> element before uploading and
-- refused anything narrower than 1.2:1, because the public frame is a fixed
-- 16/9 box and a portrait file inside it is two black bands and a stripe.
-- Most people record on a phone, in portrait, so the check was refusing the
-- normal case.
--
-- The frame can take the video's own shape instead, but only if it knows the
-- shape before the file loads - otherwise the card resizes under the reader a
-- second after the page settles. The server cannot work it out: there is no
-- ffprobe here and sharp does not open video containers. The browser that is
-- about to upload the file is the only thing in the system that knows, so it
-- sends the two numbers and they are kept here.
--
-- THE POSTER IS THE SAME ARGUMENT
-- There was never one. The page rendered <video preload="metadata"> and let
-- the browser show whatever first frame it decoded, which is very often black.
-- A still is now captured in the browser at upload - the same VideoFramePicker
-- the evidence gallery has used for its video thumbnails - uploaded as its own
-- object, and re-encoded server side through the same sharp pipeline every
-- other picture on this profile goes through. This column holds where that
-- re-encoded still lives.
--
-- It does two jobs on the page: it is the video's poster attribute, and for a
-- portrait video in a wider card it is blurred and darkened to fill the space
-- either side, so the card is never two black bars around a stripe.
--
-- WHAT IS NOT HERE, AND WHY
-- A column for the written-or-video choice. imow_type already is that column:
-- it holds 'text' or 'video' or null, every write path already sets it, and
-- the public payload already reads it. What changed around it is behaviour,
-- not storage - saving text no longer forces the choice back to 'text' when
-- the owner has chosen the video - and behaviour does not need a migration.
--
-- WHAT THIS DOES NOT DO
-- It does not make anything appear. Every reader of these three columns is
-- written to tolerate their absence, so the application works identically
-- before and after this script: a profile with no stored shape renders the
-- 16/9 frame it has always rendered, and one with no poster shows the
-- browser's own first frame. Running this only lets new uploads start
-- recording what they already know.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. The columns
--
-- Two integers rather than one ratio. A ratio is the thing the page wants, but
-- it is derived, and storing a derived value means storing a rounding decision
-- taken once by whichever client happened to upload. The pixels are what the
-- browser actually read; the page divides them itself.
--
-- Nullable with no default, for the reason every column on this table is: a
-- migration should not assert anything about a video it has never seen. NULL
-- means "this file predates the column" and the page falls back to 16/9, which
-- is what every video already in the bucket is, because nothing else was ever
-- allowed in.
-- ---------------------------------------------------------------------------
alter table public.career_profiles
  add column if not exists imow_video_width integer;

alter table public.career_profiles
  add column if not exists imow_video_height integer;

alter table public.career_profiles
  add column if not exists imow_poster_path text;

comment on column public.career_profiles.imow_video_width is
  'Pixel width of the In My Own Words video, read by the browser at upload. NULL for a file uploaded before this column existed; the page then falls back to a 16/9 frame.';

comment on column public.career_profiles.imow_video_height is
  'Pixel height of the In My Own Words video, read by the browser at upload. Paired with imow_video_width; the page divides the two to shape the frame.';

comment on column public.career_profiles.imow_poster_path is
  'Object path in the private profile-media bucket for the still shown before the In My Own Words video plays, captured in the browser and re-encoded server side. Also the source of the blurred fill beside a portrait video. NULL means no poster and the browser shows its own first frame.';


-- ---------------------------------------------------------------------------
-- 2. What counts as a shape
--
-- Both numbers or neither, and both positive. A width with no height is not a
-- shape, and a page dividing by a null or a zero is a page with no layout.
-- The upper bound is a sanity rail rather than a product limit: 16384 is past
-- 8K on either axis, and anything beyond it is a number that did not come from
-- a decoder.
--
-- No aspect ratio is policed. Landscape, portrait and square are all accepted
-- now, which is the whole point of the change, and a shape this table refused
-- would be a video the owner had already uploaded.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.career_profiles'::regclass
      and conname = 'career_profiles_imow_video_shape'
  ) then
    alter table public.career_profiles
      add constraint career_profiles_imow_video_shape
      check (
        (imow_video_width is null and imow_video_height is null)
        or (
          imow_video_width between 1 and 16384
          and imow_video_height between 1 and 16384
        )
      );
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- 3. Row level security
--
-- Nothing to add, and that is the point.
--
-- career_profiles already has its policies: the owner reads and writes their
-- own row, and the public Career Profile is read through the service role in
-- the profile API rather than as the visitor. Three new columns on an existing
-- table inherit that.
--
-- imow_poster_path in particular is a location in a private bucket and is
-- never sent to a browser. The public payload carries whether a poster exists
-- and the signing route hands out a short-lived URL, exactly as the video
-- itself already works.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- 4. Checking it took
--
-- select column_name, data_type, is_nullable, column_default
--   from information_schema.columns
--  where table_schema = 'public'
--    and table_name = 'career_profiles'
--    and column_name in ('imow_video_width', 'imow_video_height', 'imow_poster_path')
--  order by column_name;
--
-- Expect three rows: two integer, one text, all YES, none with a default.
--
-- These should be rejected by the constraint:
--   update public.career_profiles set imow_video_width = 1080, imow_video_height = null where slug = '<a slug>';
--   update public.career_profiles set imow_video_width = 0,    imow_video_height = 0    where slug = '<a slug>';
--
-- These should be accepted:
--   update public.career_profiles set imow_video_width = 1080, imow_video_height = 1920 where slug = '<a slug>';
--   update public.career_profiles set imow_video_width = null, imow_video_height = null where slug = '<a slug>';
-- ---------------------------------------------------------------------------
