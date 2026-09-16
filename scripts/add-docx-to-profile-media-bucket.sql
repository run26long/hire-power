-- ============================================================================
-- PROFILE-MEDIA — allow DOCX
--
-- Run once in the Supabase SQL editor. Idempotent: safe to re-run.
--
-- WHY THIS IS NEEDED BEFORE THE UPLOAD ROUTE EXISTS
-- The bucket, not the application, decides what may be stored. profile-media
-- is configured with an allowed_mime_types list, and Supabase Storage rejects
-- anything outside it before a route gets a say. Today that list is:
--
--   image/jpeg  image/png  image/webp  image/gif  image/avif
--   application/pdf
--   video/mp4  video/webm  video/quicktime
--   audio/mpeg  audio/mp4  audio/x-m4a  audio/wav  audio/webm  audio/ogg
--
-- Word documents are not on it. So a DOCX upload fails at the storage layer
-- with an error the owner cannot act on, no matter what the form allows. This
-- adds the one type.
--
-- WHY ONLY DOCX, AND NOT .doc, .pptx, .xlsx AND THE REST
-- Because those are not being built. The evidence form offers Case study,
-- Report, Presentation and the rest as *descriptions of the work*, and the
-- file behind any of them is a PDF or a Word document in practice. Widening
-- the bucket to every Office format would be widening what the product accepts
-- on the strength of a guess, and each format is one more thing that has to
-- render an icon, carry a size, and be worth keeping.
--
-- Legacy .doc is deliberately excluded: it is a binary format from 1997 with a
-- long history of parser vulnerabilities, and nothing here needs to parse it.
--
-- WHAT THIS DOES NOT CHANGE
-- The bucket stays private. It stays at its 50MB limit. No RLS policy is added
-- or altered. The only thing that changes is which Content-Type the storage
-- layer will accept on a write.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. What the bucket allows today
--
-- Run this first. Expect one row, public = false, file_size_limit = 52428800,
-- and a mime list without any Word type in it.
-- ---------------------------------------------------------------------------
select id, name, public, file_size_limit, allowed_mime_types
  from storage.buckets
 where id = 'profile-media';


-- ---------------------------------------------------------------------------
-- 2. Add the type
--
-- Appended rather than replaced, so a type added to this bucket by anything
-- else since this file was written is not silently dropped by running it. The
-- guard makes a second run a no-op instead of producing a duplicate entry.
-- ---------------------------------------------------------------------------
update storage.buckets
   set allowed_mime_types =
       allowed_mime_types
       || array['application/vnd.openxmlformats-officedocument.wordprocessingml.document']
 where id = 'profile-media'
   and not (
     'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
     = any(allowed_mime_types)
   );


-- ---------------------------------------------------------------------------
-- 3. Checking it took
--
-- Expect true.
-- ---------------------------------------------------------------------------
select
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    = any(allowed_mime_types) as docx_allowed,
  public                                   as still_private_if_false,
  file_size_limit                          as still_52428800,
  array_length(allowed_mime_types, 1)      as type_count
from storage.buckets
where id = 'profile-media';


-- ---------------------------------------------------------------------------
-- 4. If you ever need to undo it
--
-- update storage.buckets
--    set allowed_mime_types = array_remove(
--          allowed_mime_types,
--          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
--        )
--  where id = 'profile-media';
--
-- Note that removing a type does not delete objects already stored under it.
-- ---------------------------------------------------------------------------
