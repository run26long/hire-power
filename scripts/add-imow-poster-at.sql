-- ============================================================================
-- WHERE IN THE FILM THE THUMBNAIL CAME FROM
--
-- RUN THIS BEFORE DEPLOYING THE CODE THAT READS IT. Safe to run first: nothing
-- in the running app reads or writes the column, so the old build is unaffected
-- by it existing. Safe to run second too, as it happens - every read is
-- `?? null` and every write is dropped on a missing-column error, so the code
-- degrades to exactly today's behaviour rather than failing. First is still the
-- right order, because second means the feature is quietly dead until it runs.
--
-- WHY IT IS NEEDED
--
-- The In My Own Words video has a poster: a still the owner picks by scrubbing
-- to a moment and pressing "Use this frame". The still itself is stored, at
-- career_profiles.imow_poster_path. WHERE IN THE VIDEO it was taken from is
-- not stored anywhere, and never has been - the frame picker holds the offset
-- in component state and hands back only the image.
--
-- So reopening the editor put the player back at zero. It had nothing else to
-- go on: the poster is a picture, and a picture does not say what second it is.
-- The owner saw the first frame of their film under a control that had just
-- told them a different frame was their thumbnail.
--
-- This is that second, so the picker can open where the owner left it.
--
-- WHY A COLUMN RATHER THAN THE PATH
--
-- The offset could have been smuggled into the poster's filename, which needs
-- no migration: the path is already on the row and already read by the editor.
-- It is rejected on purpose. A filename is a location, not a record; parsing
-- data back out of one couples the schema to a naming convention that two
-- different flows generate, and the first person to rename a poster breaks a
-- feature with no visible connection to what they changed.
--
-- WHAT IT HOLDS
--
-- Seconds from the start, as a fraction - a frame at 14.28 seconds is 14.28,
-- not 14. The picker seeks to exactly what it captured, and rounding would
-- open on a neighbouring frame of a 30fps video.
--
-- Nullable, with no default. Null means "not recorded", which is the honest
-- answer for every video uploaded before this existed and for the poster the
-- picker takes automatically during an upload - that flow is deliberately
-- untouched here. The picker treats null the way it behaves today: it opens at
-- the start and waits to be told otherwise.
-- ============================================================================

-- ---- 1. The column ---------------------------------------------------------
--
-- double precision rather than numeric: this is a media timestamp being handed
-- straight to a video element's currentTime, which is a float either way, and
-- there is nothing here that wants exact decimal arithmetic.
--
-- The CHECK is a sanity bound, not a validation of any particular video: zero
-- or more, and under a day. A negative offset is not a moment, and the upload
-- cap is 50MB, which no 24-hour video fits inside.

alter table public.career_profiles
  add column if not exists imow_poster_at double precision;

alter table public.career_profiles
  drop constraint if exists career_profiles_imow_poster_at_range;

alter table public.career_profiles
  add constraint career_profiles_imow_poster_at_range
  check (imow_poster_at is null or (imow_poster_at >= 0 and imow_poster_at < 86400));

comment on column public.career_profiles.imow_poster_at is
  'Seconds into imow_video_path that imow_poster_path was captured from, so the frame picker can reopen on the frame the owner chose. Null means not recorded. See scripts/add-imow-poster-at.sql.';


-- ---- 2. No backfill, and why ----------------------------------------------
--
-- There is nothing to backfill from. The offset was never recorded, and it
-- cannot be recovered from the stored still without decoding the video and
-- comparing frames - which is not something to do to somebody's account on the
-- strength of a guess.
--
-- Every existing row therefore reads null, and the picker opens those at the
-- start exactly as it does today. The first time an owner picks a frame, the
-- offset is recorded and it opens there from then on.


-- ---- 3. What it looks like afterwards -------------------------------------
--
-- Writes nothing. Run it to see the state of the column.

select
  slug,
  imow_type,
  (imow_video_path is not null) as has_video,
  (imow_poster_path is not null) as has_poster,
  imow_poster_at,
  case
    when imow_video_path is null then 'no video'
    when imow_poster_at is not null then 'opens on the chosen frame'
    else 'opens at the start (offset not recorded)'
  end as picker_opens
from public.career_profiles
order by has_video desc, slug;
