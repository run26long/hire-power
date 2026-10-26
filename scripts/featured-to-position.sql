-- ===========================================================================
-- THE LEAD ITEM BECOMES A POSITION
--
-- A direction's Portfolio and Evidence sections used to put the row flagged
-- `featured` first, whatever its sort_order was. So two things decided what
-- came first, and the Manage list only ever showed one of them: the list could
-- read top to bottom in an order the public page did not use, and dragging the
-- genuine first item changed nothing a reader would see.
--
-- The app no longer reads or writes `featured`. The lead is simply sort_order
-- 0. This moves each direction's flagged row to the front of its own list, so
-- every published page keeps the lead it has today.
--
-- WHAT IT TOUCHES
-- profile_evidence_placements.sort_order, and nothing else. The `featured`
-- column stays, with every value it currently holds, and so does
-- set_featured_placement() - this is reversible by hand for as long as both
-- are there.
--
-- WHY IT IS SAFE TO RUN TWICE
-- A direction whose flagged row is already at 0 is renumbered to exactly the
-- order it already had, so a second run writes nothing.
--
-- WHY THE WHOLE DIRECTION IS RENUMBERED AND NOT JUST THE TWO ROWS
-- Pulling one row to 0 and leaving the rest would give two rows the same
-- number, and a tie means an order that depends on whatever the database felt
-- like returning. Each direction comes out 0..n-1 with no holes and no ties,
-- which is the shape the move op expects to find.
--
-- HIDDEN ROWS MOVE TOO
-- A hidden row still holds a position - that is the whole point of hiding
-- rather than removing - so it is numbered along with the rest. Leaving it out
-- would renumber around it and change where it comes back to.
--
-- RUN THIS BEFORE OR WITH THE DEPLOY. Until it runs, any direction whose
-- flagged row is not already first will show a different lead item than it
-- shows today. Nothing breaks; the wrong thing is simply first.
-- ===========================================================================

begin;

-- What is about to change, for the record. Each row here is a direction whose
-- public lead moves if this is not run.
create temporary table featured_not_first on commit drop as
select
  p.profile_id,
  p.lens_id,
  p.evidence_id as featured_evidence_id,
  p.sort_order  as featured_sort_order
from profile_evidence_placements p
where p.featured is true
  and p.lens_id is not null
  and p.sort_order <> 0;

select
  count(*) as directions_whose_lead_moves
from featured_not_first;

-- The new numbering: flagged row first, then everything else in the order it
-- already had. created_at breaks a tie on sort_order the same way every reader
-- of this table already does, so the result is not left to chance.
with renumbered as (
  select
    id,
    row_number() over (
      partition by profile_id, lens_id
      order by
        (featured is true) desc,
        sort_order asc,
        created_at asc
    ) - 1 as new_sort_order
  from profile_evidence_placements
  where lens_id is not null
)
update profile_evidence_placements as p
set
  sort_order = r.new_sort_order,
  updated_at = now()
from renumbered as r
where p.id = r.id
  and p.sort_order <> r.new_sort_order;

-- The shared layer (lens_id is null) is left alone. It is a fallback for
-- directions that have never been arranged, it has no featured row that any
-- section reads, and renumbering it would change the starting order those
-- directions inherit when somebody first edits one.

-- Every direction is now 0..n-1, exactly once each. This returns no rows; if
-- it returns any, roll back.
select
  profile_id,
  lens_id,
  count(*)                                   as rows_in_direction,
  min(sort_order)                            as lowest,
  max(sort_order)                            as highest,
  count(distinct sort_order)                 as distinct_positions
from profile_evidence_placements
where lens_id is not null
group by profile_id, lens_id
having min(sort_order) <> 0
    or max(sort_order) <> count(*) - 1
    or count(distinct sort_order) <> count(*);

-- And every direction that had a flagged row now has it first. This returns
-- no rows; if it returns any, roll back.
select p.profile_id, p.lens_id, p.evidence_id, p.sort_order
from profile_evidence_placements p
where p.featured is true
  and p.lens_id is not null
  and p.sort_order <> 0;

commit;
