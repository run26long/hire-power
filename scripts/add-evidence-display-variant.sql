-- ============================================================================
-- A DISPLAY-SIZE PICTURE, BETWEEN THE THUMBNAIL AND THE ORIGINAL
--
-- Run once in the Supabase SQL editor, BEFORE deploying the code that writes
-- and reads this column. Nothing in the app touches it until then, and it is
-- nullable with no default, so running it early changes nothing.
--
-- WHY
-- profile_evidence already holds two objects per upload: storage_path, the
-- file the owner gave us, and thumbnail_path, an 800px webp this server makes
-- for the grid. The viewer and the lightbox had nothing in between, so
-- opening a picture meant downloading the original - a phone photograph at
-- several megabytes, every time, to fill a box that is never more than about
-- two thousand pixels across.
--
-- display_path is that middle object: the same webp pipeline the thumbnail
-- already uses, at a size a screen can actually show.
--
-- WHAT IT DOES NOT CHANGE
-- The original is still the original. storage_path is untouched, nothing
-- overwrites it, and every path that hands over the file itself still hands
-- over that one. This is a derived copy for display, the way the thumbnail
-- is, and the row keeps the source alongside it.
--
-- NULL IS A NORMAL VALUE
-- Three kinds of row will never have one and are not waiting for anything:
--
--   a video      sharp does not open video containers; the poster frame a
--                browser captured is already the thumbnail, and the video
--                element streams the file itself
--   a PDF        it is not missing a picture, it has the picture it is
--                supposed to have
--   anything     generation is deliberately never fatal. A file sharp will
--   sharp        not decode is still a file the owner uploaded, and the item
--   refuses      still opens - from the original, which is what null means
--
-- So the media route treats a null display_path as "serve the original"
-- rather than as a missing file. That is the opposite of how it treats a
-- missing thumbnail, and deliberately so: a thumbnail request is a request
-- for a small object and must not be answered with a large one, while a
-- display request is a request for this picture at a convenient size and the
-- original is the same picture.
--
-- Every row is null after this runs, including rows that will get one. The
-- backfill script fills those in; nothing breaks in the meantime because null
-- already has a meaning.
--
-- Safe to re-run.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- THE COLUMN
--
-- Nullable, no default, no constraint. The same shape thumbnail_path has, and
-- for the same reason: the path is written by the server that made the object
-- and is never accepted from a caller.
-- ---------------------------------------------------------------------------

alter table public.profile_evidence
  add column if not exists display_path text;

comment on column public.profile_evidence.display_path is
  'A webp this server made from storage_path, longest edge about 2000px, for '
  'the lightbox and the evidence viewer. Null where there is none - a video, '
  'a PDF, or an image sharp could not decode - and null means serve the '
  'original, never means missing. Never accepted from a caller.';


-- ---------------------------------------------------------------------------
-- AFTERWARDS — WHAT IS THERE. Read-only, and it needs the column above, so
-- it runs second. The third number is how many objects the backfill will make.
-- ---------------------------------------------------------------------------

select 'evidence rows' as what, count(*) as rows
  from public.profile_evidence

union all
select 'uploaded images, live', count(*)
  from public.profile_evidence
 where media_class = 'image'
   and source_type = 'upload'
   and storage_path is not null
   and deleted_at is null

union all
select 'uploaded images with no display variant yet', count(*)
  from public.profile_evidence
 where media_class = 'image'
   and source_type = 'upload'
   and storage_path is not null
   and deleted_at is null
   and display_path is null;
