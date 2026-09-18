# Fictionalising the test Career Profile

One Career Profile in this database was built from a real person's resume. It
carried their name, their three real employers, their home town and their phone
number, which made it unusable for a screenshot, a demo, or anything else that
leaves the machine it is running on.

These scripts replace all of that with an invented equivalent, and then fill the
profile with enough evidence and portfolio work that the sections which only
misbehave when full can actually be seen.

The profile is now **Daniel Mercer**, at **`/p/daniel-mercer-test`**.

| Was | Is |
| --- | --- |
| James Long, Lake Mary FL | Daniel Mercer, Charlotte NC |
| Disruptor Manufacturing (Sanford, FL) | Apex Manufacturing (Concord, NC) |
| MBF Industries (Sanford, FL) | Trident Industrial (Concord, NC) |
| Madstad Engineering (Brooksville, FL) | Keystone Systems (Hickory, NC) |
| Oshkosh / Oshkosh AeroTech | Vanguard Vehicle Group / Vanguard AeroTech |

## Running them

Every script is **dry run by default** and prints exactly what it would change.
Nothing is written without `--apply`. They are ordered, and each is idempotent:
running one twice is a no-op the second time, because the thing it looks for is
already gone.

```bash
node scripts/fictionalize/01-rename.js              # dry run
node scripts/fictionalize/01-rename.js --apply

node scripts/fictionalize/02-lenses.js --apply      # the three directions + slug
node scripts/fictionalize/03-portfolio-images.js --apply
node scripts/fictionalize/04-evidence.js --apply
node scripts/fictionalize/05-placements.js --apply
node scripts/fictionalize/06-verify.js              # read-only, exits non-zero on failure
```

Credentials come from `.env.local`. The service-role key is used because there
is no request context here to carry a user JWT and the writes span tables whose
RLS policies are all written around `auth.uid()`, which is the same choice
`scripts/backfill-career-knowledge.js` already makes.

## What each one does

**`01-rename.js`** sweeps ten tables. `RULES` is ordered, and the ordering is
load-bearing: a generic `Florida -> North Carolina` rule on its own produces
"University of South North Carolina", so the named institutions come first.

**`02-lenses.js`** rewrites the three directions and changes the slug. This is a
rewrite rather than a substitution because substitution left the copy accurate
but repetitive, and the figures that would have shown the three-turnaround claim
were sitting unused in `career_knowledge`. Every number in the new copy already
exists in this account's data.

**`03-portfolio-images.js`** renders eight SVG diagrams through `sharp` and
uploads each with an 800px WebP thumbnail, mirroring what the upload route's
finalise step does: a path of two random UUIDs carrying no identifiers, and
`file_size` and `mime_type` read back off the stored object rather than trusted.

**`04-evidence.js`** generates four PDFs with `@react-pdf/renderer` and adds two
external links.

**`05-placements.js`** decides which direction shows what, in what order, and
which item leads.

**`06-verify.js`** proves both halves: that no real-world identity survives, and
that the profile actually renders.

## Things worth knowing before editing these

**The five inactive resumes on this account are a different test persona.**
"Marcus Rivera", Tampa FL. Nothing on the profile reads them, and an early
version of the sweep quietly rewrote his university. `resumes` is scoped to
`is_active` for that reason.

**The tailored resume hides the identity in six columns beyond `resume_data`** —
`coaching_conversation`, `ai_analysis`, `rewritten_resume`, `resume_changes`,
`job_company` and `job_description`. The verify script reads whole rows rather
than only the swept columns, because the columns that got missed were exactly
the ones nobody thought to list.

**The coaching transcript is lowercase.** The owner typed "at mbf and madstad".
Lowercase rules exist and deliberately produce lowercase output, so a transcript
still reads like something a person wrote.

**`career_knowledge.content_key` is derived, not text.** It backs the unique
index `(user_id, content_key)`, so it is regenerated with the app's own
`buildContentKey` rather than substituted. Those two must not drift.

**Emails are deliberately untouched.** `profiles.email` mirrors `auth.users`, and
rewriting it would break sign-in on an account somebody actually uses.

**`output/rename-backup.json` is gitignored and must stay that way.** It is a
verbatim copy of every row before the sweep.

**The certificates name invented awarding bodies and carry a SPECIMEN line.** The
person is fictional, so their credentials should be issued by fictional bodies
too; and a realistic certificate bearing a real awarding organisation's name is
a forgeable document whether or not it was made for a test database.

## Why eight portfolio items and not three

`lib/portfolio.js` draws the line between Portfolio and Evidence: an item is a
portfolio item when its `media_class` is visual **and** we hold the file. Every
image on this profile was previously a link to `example.com`, so the Portfolio
section was empty. `PORTFOLIO_PREVIEW_DESKTOP` is 6, so eight is the smallest
number that puts the section, its preview limit and its overflow all on screen
at once.
