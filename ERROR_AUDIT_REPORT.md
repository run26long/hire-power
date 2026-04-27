# Error Handling Audit Report

**Generated:** 2026-04-27  
**Files scanned:** 55 source files across 15+ directories  
**Auditor note:** Line numbers for large files (coach/route.js, coach-finish/route.js) are approximate; all other line numbers are exact or within ±3 lines. PDF template files were not audited individually — they are passive React components; errors in them are covered under the PDF generation routes that call `renderToBuffer`.

---

## Summary

- **P0 findings:** 22
- **P1 findings:** 41
- **P2 findings:** 10

---

## P0 — Critical (fix before beta)

### Finding 1: DEBUG line visible to all users in ResumeUploadModal
**File:** `app/components/ResumeUploadModal.js:150`  
**What fails:** A hardcoded red debug paragraph renders inside the modal body on every open.  
**What user sees:** A bright red line reading "DEBUG: component body rendering" every time they try to upload a resume.  
**Recommended fix:** Remove line 150 entirely.

---

### Finding 2: No React Error Boundary exists anywhere in the codebase
**File:** App-wide architectural gap — `app/layout.js` has no boundary; no `ErrorBoundary` component exists  
**What fails:** Any unhandled JavaScript error during rendering (a null dereference, a missing property on API data, a broken import) causes React to unmount the entire tree.  
**What user sees:** White screen with no recovery path, no message, no way to navigate away except refreshing.  
**Recommended fix:** Create a class-based `ErrorBoundary` component implementing `getDerivedStateFromError` and `componentDidCatch`, wrap the children in `app/layout.js` with it, and add a fallback UI that lets users navigate to the dashboard.

---

### Finding 3: Supabase console logs in production expose environment details
**File:** `utils/supabase/client.js:7-9`  
**What fails:** Three `console.log` calls fire on every Supabase client instantiation, which happens on nearly every page load and fetch.  
**What user sees:** Browser console shows the Supabase project URL, whether the anon key exists, and its character length — visible to any user who opens DevTools.  
**Recommended fix:** Remove lines 7-9.

---

### Finding 4: UpgradeModal — `window.location.href` set to `undefined` on silent API error
**File:** `app/components/UpgradeModal.js:38-41`  
**What fails:** `response.ok` is never checked before `response.json()`. If `/api/stripe/checkout` returns a non-JSON 500 (e.g., a Vercel edge error page), `response.json()` throws and is caught — but if the API returns a JSON body without an `error` key and without a `url` key, `data.error` is falsy, the `throw` on line 39 is skipped, and `window.location.href = undefined` executes, navigating the user to the literal URL `undefined`.  
**What user sees:** Page navigates to `/undefined` — a 404 with no explanation and no way back.  
**Recommended fix:** Check `if (!response.ok) throw new Error('Checkout unavailable')` before `.json()`, and validate `data.url` exists before setting `window.location.href`.

---

### Finding 5: `app/page.js` — home page loading state never resolves on Supabase error
**File:** `app/page.js:14-21` (approximate — `checkUser` async function)  
**What fails:** `supabase.auth.getUser()` is awaited without any error handling. If Supabase is unreachable (network failure, service outage), the call throws an unhandled exception.  
**What user sees:** Home page stuck in loading state indefinitely — the spinner or blank page never resolves. Users cannot reach the app at all.  
**Recommended fix:** Wrap in try/catch; on error, redirect to `/dashboard` or render the unauthenticated landing state.

---

### Finding 6: `JobCardModal` — notes save button stuck loading forever
**File:** `app/components/JobCardModal.js:385-389`  
**What fails:** `onSaveNotes?.()` is awaited with no try/catch and no `finally` block. If the callback throws, `setNotesSaving(false)` never runs.  
**What user sees:** "Saving…" button stays disabled indefinitely. The modal must be closed and reopened to recover.  
**Recommended fix:** Wrap in `try { await onSaveNotes?.(card.id, notesValue) } finally { setNotesSaving(false) }`.

---

### Finding 7: `JobCardModal` — interview schedule button stuck loading forever
**File:** `app/components/JobCardModal.js:495-512`  
**What fails:** Same pattern as Finding 6. `onScheduleInterview?.()` awaited without try/finally. `setScheduleSaving(false)` never runs on error.  
**What user sees:** "Scheduling…" button frozen. User must close and reopen modal.  
**Recommended fix:** Same pattern — `try/finally` block guaranteeing `setScheduleSaving(false)`.

---

### Finding 8: `stripe/webhook` — Vault subscription creation failure returns 200, user charged but downgraded
**File:** `app/api/stripe/webhook/route.js:111-125` (approximate)  
**What fails:** If the Supabase insert to create the vault subscription record fails, the error is logged but the webhook still returns HTTP 200. Stripe considers the event processed. The user's card was charged but their account record wasn't updated.  
**What user sees:** Subscription shows as active in Stripe billing but the app treats them as free tier.  
**Recommended fix:** On vault insert failure, return HTTP 500 so Stripe retries the webhook, and log the `stripe_customer_id` for manual remediation.

---

### Finding 9: `stripe/webhook` — multiple profile update operations fail silently
**File:** `app/api/stripe/webhook/route.js:38-48, 63-78, 102-124, 128-137` (approximate)  
**What fails:** Several Supabase `update` calls inside webhook event handlers have no error checking. If any fails (RLS issue, schema mismatch, network blip), the webhook returns 200 and Stripe marks the event processed.  
**What user sees:** Subscription state in the app is out of sync with Stripe — user may see wrong tier, wrong renewal date, or wrong feature access.  
**Recommended fix:** Check the `error` field after each Supabase operation; log failures with the Stripe customer ID; return 500 on critical failures so Stripe retries.

---

### Finding 10: `stripe/cancel` — Supabase update silently skipped, returns success
**File:** `app/api/stripe/cancel/route.js:45-52`  
**What fails:** The Supabase `update` to record the cancellation has no error check. If it fails, the function returns `{ success: true }` with HTTP 200.  
**What user sees:** "Subscription cancelled" confirmation, but their profile still shows an active subscription. On next login, they retain Pro access they believed they'd cancelled.  
**Recommended fix:** Destructure `{ error: updateError }`, check it, and return 500 if it fails.

---

### Finding 11: `stripe/downgrade` — Stripe subscription retrieval not wrapped in try/catch
**File:** `app/api/stripe/downgrade/route.js:36`  
**What fails:** `stripe.subscriptions.retrieve(subscriptionId)` is called outside a try/catch. An invalid subscription ID (stale data, test vs live mode mismatch) causes an unhandled rejection.  
**What user sees:** Raw Stripe SDK error message returned to client via the outer catch at line ~69.  
**Recommended fix:** Add a specific try/catch around the retrieval and return a 404 with a generic message if the subscription isn't found.

---

### Finding 12: `stripe/downgrade` — Supabase update not checked, returns success on failure
**File:** `app/api/stripe/downgrade/route.js:54-60`  
**What fails:** Same pattern as Finding 10 — Supabase update with no error check followed by a success response.  
**What user sees:** "Downgraded successfully" but profile still shows the old tier.  
**Recommended fix:** Check `updateError` before returning success.

---

### Finding 13: `signup-pro` — user account created but Stripe session fails, user stranded
**File:** `app/api/auth/signup-pro/route.js:21-43`  
**What fails:** Supabase creates the user (line ~21-25) before the Stripe checkout session is created. If Stripe fails (invalid price ID, env var missing, Stripe outage), the user has an account but no checkout URL and can't upgrade. The error is returned to the client.  
**What user sees:** Sign-up appeared to fail, but an account was created. Re-attempting shows "User already exists." They can't complete the upgrade they intended.  
**Recommended fix:** Create the Stripe session first; only create the Supabase user if Stripe succeeds, or implement a post-signup Stripe session creation flow.

---

### Finding 14: `signup-pro` — `userData.user.id` access without null check
**File:** `app/api/auth/signup-pro/route.js:42`  
**What fails:** If `supabase.auth.admin.createUser()` returns a truthy `data` object but a null `user` field (valid in edge cases — email already confirmed, race condition), accessing `data.user.id` throws a TypeError.  
**What user sees:** 500 error with raw error message.  
**Recommended fix:** Add `if (!userData.user) throw new Error('User creation failed')` before accessing `.id`.

---

### Finding 15: All three PDF generation routes — `renderToBuffer` not isolated from data errors
**Files:**  
- `app/api/generate-pdf/route.js:146`  
- `app/api/generate-cover-letter-pdf/route.js:118`  
- `app/api/generate-review-prep-pdf/route.js:28`  

**What fails:** `renderToBuffer(element)` is called with no validation of the data being passed to the React PDF template component. If the resume/cover letter data is missing required fields, ReactPDF throws a render error that bubbles to the outer catch, which then returns `details: error.message` to the client.  
**What user sees:** "Download" button spins, then fails with a raw ReactPDF error message (e.g., "Cannot read properties of undefined (reading 'map')").  
**Recommended fix:** Validate required fields on the incoming data before calling `renderToBuffer`; wrap the `renderToBuffer` call in its own try/catch to distinguish render failures from storage failures.

---

### Finding 16: `extract-resume-structure` — `message.content[0].text` accessed without guard
**File:** `app/api/extract-resume-structure/route.js:115`  
**What fails:** `message.content[0].text` is accessed directly. If the Anthropic API returns an empty `content` array (overload, content filter, truncation), this throws `TypeError: Cannot read properties of undefined`.  
**What user sees:** Resume upload flow fails at the extraction step with a 500 error — the resume was uploaded to storage but the structure was never extracted. User is left with a broken half-uploaded state.  
**Recommended fix:** Add `if (!message.content?.[0]?.text) throw new Error('No content in API response')` before accessing the text.

---

### Finding 17: `job-analyze` — `response.content[0].text` accessed without guard
**File:** `app/api/job-analyze/route.js:264`  
**What fails:** Same pattern as Finding 16. `response.content[0].text` accessed without a null check.  
**What user sees:** Job match analysis crashes with a raw TypeError returned as `{ error: error.message }`.  
**Recommended fix:** Guard with optional chaining before access.

---

### Finding 18: `review-prep` — `message.content[0].text` accessed without guard
**File:** `app/api/review-prep/route.js:161`  
**What fails:** Same pattern as Findings 16-17.  
**What user sees:** Review prep generation fails with a raw TypeError; `details: error.message` returned in response.  
**Recommended fix:** Guard with optional chaining; remove `details` field from error response.

---

### Finding 19: `career-coach/detail` — AI fetch has no error handling, loading spinner frozen
**File:** `app/career-coach/detail/page.js:225-243`  
**What fails:** The `handleSendMessage` fetch to `/api/career-coach` has no try/catch and no `response.ok` check. If the API returns a non-200 or the fetch itself fails (network error), `isAIThinking` is never set back to `false`.  
**What user sees:** The AI thinking spinner runs forever. The textarea is disabled. The only recovery is a page refresh, which loses the conversation.  
**Recommended fix:** Wrap the entire fetch block in try/catch; set `setIsAIThinking(false)` in the catch and finally.

---

### Finding 20: `dashboard/page.js` — auth and data loads have no error handling
**File:** `app/dashboard/page.js:111-140`  
**What fails:** `supabase.auth.getUser()`, `profiles.select()`, and `resumes.select()` are called without error handling. A network error, RLS denial, or Supabase outage causes an unhandled exception.  
**What user sees:** Dashboard stuck in loading state indefinitely, or a white screen crash.  
**Recommended fix:** Add try/catch around the entire `loadData` function; set `setLoading(false)` in the catch block and render an error state.

---

### Finding 21: `career-vault/page.js` — `loadData` has no error handling
**File:** `app/career-vault/page.js:217-247`  
**What fails:** Multiple Supabase queries with no error handling. Same pattern as Finding 20.  
**What user sees:** Career Vault page stuck in loading state indefinitely on any Supabase failure.  
**Recommended fix:** Same as Finding 20 — try/catch on `loadData`, set loading false in catch.

---

### Finding 22: `job-tracker/page.js` — `loadData` has no error handling
**File:** `app/job-tracker/page.js:74-107`  
**What fails:** Five Supabase queries in `loadData` with no error handling.  
**What user sees:** Job Tracker board stuck loading indefinitely.  
**Recommended fix:** Same as Findings 20-21.

---

## P1 — Bad UX (should fix before beta)

### Finding 23: Systemic — 17 API routes return raw `error.message` to client
**Files and lines:**
- `app/api/coach/route.js` ~1286: `return NextResponse.json({ error: error.message }, { status: 500 })`
- `app/api/coach-finish/route.js` ~2284: `return NextResponse.json({ error: error.message }, { status: 500 })`
- `app/api/trial-coach-finish/route.js` ~285: `return NextResponse.json({ error: error.message }, { status: 500 })`
- `app/api/resume-chat/route.js` ~409: `return NextResponse.json({ error: error.message }, { status: 500 })`
- `app/api/analyze-resume/route.js` ~604: `return Response.json({ error: \`Failed to analyze resume: ${error.message}\` }, { status: 500 })`
- `app/api/generate-pdf/route.js:234`: `details: error.message`
- `app/api/generate-cover-letter-pdf/route.js:162`: `details: error.message`
- `app/api/generate-review-prep-pdf/route.js:50`: `details: error.message`
- `app/api/cover-letter-finish/route.js` ~595: `error: error.message`
- `app/api/job-analyze/route.js:290`: `return Response.json({ error: error.message }, { status: 500 })`
- `app/api/extract-resume-structure/route.js:150`: `error: error.message || 'Failed...'`
- `app/api/review-prep/route.js:177-179`: `details: error.message`
- `app/api/stripe/checkout/route.js` ~59: `error: error.message`
- `app/api/stripe/cancel/route.js` ~61: `error: error.message`
- `app/api/stripe/downgrade/route.js` ~69: `error: error.message`
- `app/api/parse-pdf/route.js` ~69: `error: error.message`
- `app/api/auth/signup-pro/route.js` ~49: `error: error.message`

**What fails:** Raw JavaScript error messages are sent to the client. These can include Anthropic SDK internals ("rate_limit_error on model claude-opus-4-7"), Supabase internals ("new row violates row-level security policy for table "profiles""), file system paths, and stack trace fragments.  
**What user sees:** Technical jargon in error toasts or console-visible responses.  
**Recommended fix:** In every catch block, log `error` server-side (already done in most) and return a generic, route-specific message instead of `error.message`. See Patterns section for a systemic fix.

---

### Finding 24: `extract-captures` — any error returns `{captures: []}` indistinguishably from empty result
**File:** `app/api/extract-captures/route.js:92-95`  
**What fails:** The outer catch returns `NextResponse.json({ captures: [] })` with HTTP 200 — the same response as a legitimate "no captures found." Every error type (auth failure, Anthropic API down, network error) is silently mapped to an empty success response.  
**What user sees:** No coaching captures appear after a session, no error shown. User thinks the session produced nothing.  
**Recommended fix:** Return `{ error: 'extraction_failed', captures: [] }` with HTTP 500, or at minimum a flag that distinguishes failure from empty result.

---

### Finding 25: `extract-captures` — JSON parse failure returns empty captures with HTTP 200
**File:** `app/api/extract-captures/route.js:84-86`  
**What fails:** The inner `catch(e)` block for JSON parse failure returns `{ captures: [] }` with HTTP 200.  
**What user sees:** Same as Finding 24 — silent failure.  
**Recommended fix:** Return a 4xx/5xx with an error flag to let callers distinguish parse failure from empty result.

---

### Finding 26: `stripe/checkout` — invalid coupon silently dropped
**File:** `app/api/stripe/checkout/route.js:40-50`  
**What fails:** If the user's coupon code is invalid, the Stripe API throws, the error is caught and logged, and checkout proceeds without the discount.  
**What user sees:** Checkout continues normally. The user is charged full price without any indication their coupon was rejected.  
**Recommended fix:** Return a 400 with a client-safe message indicating the coupon was invalid, or validate the coupon separately before creating the session.

---

### Finding 27: `stripe/checkout` — `priceId` not validated server-side
**File:** `app/api/stripe/checkout/route.js:25`  
**What fails:** The `priceId` from the request body is passed directly to Stripe without being checked against a server-side allowlist of valid price IDs. A tampered request with an arbitrary price ID (e.g., a $0 test price) would be passed to Stripe as-is.  
**What user sees:** If an invalid price is passed, Stripe throws and the raw error is returned (see Finding 23).  
**Recommended fix:** Validate `priceId` against a server-side list of allowed price IDs before passing to Stripe.

---

### Finding 28: `stripe/webhook` — `.single()` throws on unknown Stripe customer
**File:** `app/api/stripe/webhook/route.js` ~66  
**What fails:** `supabase.from('profiles').select().eq('stripe_customer_id', ...).single()` throws a PostgrestError if no matching profile exists. This unhandled exception crashes the webhook handler and returns a 500 to Stripe, which retries the webhook repeatedly.  
**What user sees:** Indirect — Stripe retries may cause duplicate processing; support queue gets flooded.  
**Recommended fix:** Handle the `.single()` error explicitly; log unknown customers and return 200 to stop Stripe retrying for legitimately unknown customers.

---

### Finding 29: `cover-letter-finish` — retry loop ignores HTTP 429 (rate limit)
**File:** `app/api/cover-letter-finish/route.js:536-554`  
**What fails:** The retry logic only retries on Anthropic status 529 (overloaded). HTTP 429 (rate limit exceeded) causes an immediate failure with no retry.  
**What user sees:** Cover letter generation fails immediately on any rate limit, with the raw error message returned.  
**Recommended fix:** Expand retry conditions to include 429 and 503 with appropriate backoff.

---

### Finding 30: `cover-letter-finish` — profile Supabase query error not checked
**File:** `app/api/cover-letter-finish/route.js:523-527`  
**What fails:** `supabase.from('profiles').select(...).single()` is called but only `!profile` is checked, not the `error` field. A query failure (network, RLS) returns `{ data: null, error: {...} }` — `!profile` is true but the error is silently ignored and the function falls through.  
**What user sees:** Cover letter generation may proceed as if the user is on the free tier (wrong quota enforcement), or downstream code crashes on null `profile`.  
**Recommended fix:** Destructure both `data` and `error`; check `if (error || !profile)` and return early.

---

### Finding 31: `parse-pdf` — no server-side file size limit
**File:** `app/api/parse-pdf/route.js:21-27`  
**What fails:** The client enforces a 10MB limit in `ResumeUploadModal`, but the API route has no server-side validation. A direct API call with a 100MB+ file would be downloaded from storage and parsed, potentially exhausting Vercel's serverless memory limit.  
**What user sees:** Indirect — Vercel function timeout or out-of-memory kill, which returns a 504 or 502 with no user-friendly message.  
**Recommended fix:** Add a file size check after retrieving the file's metadata, before downloading the full contents.

---

### Finding 32: `parse-pdf` — mammoth and extractText errors not isolated
**File:** `app/api/parse-pdf/route.js:39, 42-46, 60`  
**What fails:** `mammoth.extractRawText()`, `mammoth.convertToHtml()`, and `extractText()` are called outside isolated try/catch blocks. A corrupted DOCX or PDF causes these to throw; the outer catch returns raw `error.message`.  
**What user sees:** Upload fails with a raw library error message (e.g., "Unexpected token '<' in XML at position 0").  
**Recommended fix:** Wrap each library call in its own try/catch; return a generic "Couldn't read this file" message.

---

### Finding 33: `job-tracker` — schedule interview insert has no error handling
**File:** `app/job-tracker/page.js:258-270`  
**What fails:** `supabase.from('application_events').insert()` is called with no error check.  
**What user sees:** "Schedule Interview" button appears to succeed (no error shown) but the event is never saved.  
**Recommended fix:** Destructure `{ error }`, check it, and show an error toast on failure.

---

### Finding 34: `job-tracker` — link resume has no error handling
**File:** `app/job-tracker/page.js:272-282`  
**What fails:** `supabase.from('applications').update()` called with no error check.  
**What user sees:** Silent failure — no confirmation or error toast.  
**Recommended fix:** Same as Finding 33.

---

### Finding 35: `job-tracker` — archive card has no error handling
**File:** `app/job-tracker/page.js:294-303`  
**What fails:** Archive update with no error check.  
**What user sees:** Card visually moves to archive but may not be saved.  
**Recommended fix:** Same pattern.

---

### Finding 36: `job-tracker` — hired status update trio not checked
**File:** `app/job-tracker/page.js:189-211`  
**What fails:** Three Supabase calls run sequentially when a card is moved to "Hired" — none have error checks. The card moves visually regardless.  
**What user sees:** Card shows "Hired" in the UI but profile's `search_status` may not update, affecting downstream features.  
**Recommended fix:** Check each update's error field; revert the card move if a critical update fails.

---

### Finding 37: `job-tracker` — hired modal Stripe checkout fetch not fully guarded
**File:** `app/job-tracker/page.js` ~959  
**What fails:** `fetch('/api/stripe/checkout')` response is not checked for `response.ok` before `.json()`. If the API returns a non-JSON 500, `.json()` throws; the catch may leave the button in a loading state.  
**What user sees:** "Upgrade" button frozen.  
**Recommended fix:** Add `if (!response.ok) throw new Error(...)` before `.json()`, and ensure catch block resets loading state.

---

### Finding 38: `career-vault` — multiple CRUD operations have no error handling
**File:** `app/career-vault/page.js`  
Specific lines:
- Line ~431-445: `setCurrentJob` insert and update — no error checks  
- Line ~470-477: `handleRestoreCore` update — no error check  
- Line ~495-529: `handleArchiveResume` first update — no error check  
- Line ~537, 541: `handleHardDelete` two deletes — no error checks  

**What fails:** All these mutations can fail silently. State is updated optimistically in the UI but the database operation may not have succeeded.  
**What user sees:** Action appears to succeed (modal closes, item disappears) but the underlying data is unchanged.  
**Recommended fix:** Check `error` after each Supabase call; show an error toast and revert optimistic state on failure.

---

### Finding 39: `career-vault` — PDF download doesn't check `response.ok`
**File:** `app/career-vault/page.js` ~1525-1552  
**What fails:** `fetch('/api/generate-review-prep-pdf')` result is not checked for `response.ok` before parsing the response.  
**What user sees:** Download button loading state clears but no file downloads and no error message is shown.  
**Recommended fix:** Add `if (!response.ok) throw new Error(...)` before parsing.

---

### Finding 40: `resume-coach/page.js` — PDF download fetches blob without checking `response.ok`
**File:** `app/resume-coach/page.js:477-478`  
**What fails:** `fetch(result.pdfUrl)` followed immediately by `response.blob()` with no status check. If the presigned URL has expired or S3 returns a 403/404, `blob()` returns the error HTML page as a blob.  
**What user sees:** A file downloads but it contains HTML instead of a PDF. The filename is correct, giving no indication something went wrong.  
**Recommended fix:** Add `if (!pdfResponse.ok) throw new Error('PDF download failed')` before `.blob()`.

---

### Finding 41: `cover-letter/[id]/page.js` — PDF download fetches blob without checking `response.ok`
**File:** `app/cover-letter/[id]/page.js:347`  
**What fails:** Same pattern as Finding 40 — `fetch(result.pdfUrl)` with no status check before `.blob()`.  
**What user sees:** Same — HTML error page downloaded as a file named like a PDF.  
**Recommended fix:** Same as Finding 40.

---

### Finding 42: `cover-letter/[id]/page.js` — auto-fit loop can crash mid-process
**File:** `app/cover-letter/[id]/page.js:259`  
**What fails:** Inside `handleAutoFit()`, the `checkSize()` inner function calls `response.json()` after checking `response.ok`, but if the error response is not JSON (Vercel 500 HTML), `.json()` throws and is not caught by the auto-fit loop's outer handler.  
**What user sees:** Auto-fit button stuck in loading state with no error message.  
**Recommended fix:** Add Content-Type validation before calling `.json()`, or wrap in try/catch.

---

### Finding 43: `cover-letter/[id]/page.js` — preview blob not type-checked
**File:** `app/cover-letter/[id]/page.js:386-391`  
**What fails:** After `response.ok` is confirmed, the response body is converted to a blob and used as a PDF URL without checking if the content type is `application/pdf`.  
**What user sees:** Preview panel shows a blank or broken PDF iframe if the API returned a partial or malformed response.  
**Recommended fix:** Check `response.headers.get('content-type')` before creating blob URL.

---

### Finding 44: `career-coach/page.js` — upload loading state not cleaned up in `finally`
**File:** `app/career-coach/page.js:102-106`  
**What fails:** `setUploading(false)` is only in the `catch` block. If the success path throws (e.g., the callback after upload errors), `setUploading(false)` is never called.  
**What user sees:** "Uploading…" button stuck active even after the operation completed.  
**Recommended fix:** Move `setUploading(false)` to a `finally` block.

---

### Finding 45: `profile/page.js` — downgrade and cancel fetches don't check `response.ok`
**Files:**  
- `app/profile/page.js` ~83-100: downgrade fetch  
- `app/profile/page.js` ~106-124: cancel fetch  

**What fails:** Both `fetch('/api/stripe/downgrade')` and `fetch('/api/stripe/cancel')` parse `.json()` without checking `response.ok`. A non-JSON Vercel 500 error causes `.json()` to throw; the catch block may or may not reset the loading state depending on timing.  
**What user sees:** Button stuck in loading state or crashes silently.  
**Recommended fix:** Add `if (!response.ok) throw new Error(...)` before `.json()` in both handlers.

---

### Finding 46: `profile/page.js` — sign-out has no error handling
**File:** `app/profile/page.js:463`  
**What fails:** `supabase.auth.signOut()` is called with no `.catch()` or try/catch.  
**What user sees:** Sign-out button click does nothing on failure; user remains logged in with no feedback.  
**Recommended fix:** Wrap in try/catch; show an error toast if sign-out fails.

---

### Finding 47: `profile/page.js` — export data has no error feedback
**File:** `app/profile/page.js:126-141`  
**What fails:** Three Supabase queries with no error checks; if any fail, the data export silently produces an incomplete file. The error is caught and logged but not shown to the user.  
**What user sees:** A file downloads but may be empty or partial, with no indication anything went wrong.  
**Recommended fix:** Show an error toast in the catch block.

---

### Finding 48: `landing/page.js` — `session.access_token` accessed without null check
**File:** `app/landing/page.js:428`  
**What fails:** The signup flow fetches the session and immediately accesses `session.access_token`. If the Supabase sign-up succeeded but the subsequent `getSession()` call returns null (network retry, auth delay), this throws `TypeError: Cannot read properties of null`.  
**What user sees:** Sign-up appears to fail with a generic error, even though the account was created. Re-attempting sign-up shows "User already exists" (see also Finding 13-equivalent for landing).  
**Recommended fix:** Add `if (!session) throw new Error('Session unavailable after signup')` before accessing `.access_token`.

---

### Finding 49: `analyze-resume` — JSON.parse of Claude response has no inner try/catch
**File:** `app/api/analyze-resume/route.js:579` (approximate)  
**What fails:** `JSON.parse(cleanedResponse)` is called on the Claude API response. If Claude returns malformed JSON (token limit truncation, model hallucination of extra braces), this throws a SyntaxError that propagates to the outer catch, which returns `error.message` containing the raw parse error.  
**What user sees:** Resume analysis fails with a message like "Unexpected token '}' at position 1234."  
**Recommended fix:** Wrap in a specific inner try/catch; on parse failure, log the raw response and return a generic "Analysis failed" message.

---

### Finding 50: `job-analyze` — same JSON.parse vulnerability
**File:** `app/api/job-analyze/route.js:266`  
**What fails:** `JSON.parse(cleanText)` on Claude's response with no inner try/catch. Parse error becomes the response body via `error.message`.  
**What user sees:** Raw SyntaxError in the job analysis result.  
**Recommended fix:** Inner try/catch around JSON.parse; generic error message to client.

---

### Finding 51: `extract-resume-structure` — same JSON.parse vulnerability
**File:** `app/api/extract-resume-structure/route.js:126`  
**What fails:** `JSON.parse(cleanedResponse)` with no inner guard.  
**What user sees:** Upload flow fails at extraction with raw parse error. Resume storage upload completed but the record was never saved.  
**Recommended fix:** Inner try/catch; if parse fails, return 422 with generic message.

---

### Finding 52: `resume-coach/page.js` — job-specific resume creation: partial DB record on API failure
**File:** `app/resume-coach/page.js:596`  
**What fails:** `analysisRes.ok` is checked, but the subsequent `analysisRes.json()` can still throw (non-JSON body). When it does, the resume record may already have been inserted, leaving an orphaned database record.  
**What user sees:** "Creation failed" error toast, but a partial resume record exists in the database. On refresh, they may see a broken empty resume.  
**Recommended fix:** Wrap `json()` calls in try/catch; ensure the database insert happens only after successful API response parsing.

---

### Finding 53: `career-coach/page.js` — parse API response `.json()` called without response.ok check
**File:** `app/career-coach/page.js:77-78`  
**What fails:** After the `parseRes.ok` check, `.json()` is called — but if `parseRes.ok` is true and the body is unexpectedly not JSON, `.json()` throws and is caught generically.  
**What user sees:** Generic "Upload failed" with no indication whether the issue was the file format or a server error.  
**Recommended fix:** Wrap `.json()` in try/catch; distinguish parse error from server error.

---

### Finding 54: `ResumeUploadModal` — success callback fires with potentially null `savedResume`
**File:** `app/components/ResumeUploadModal.js:81-94`  
**What fails:** `saveErr` is checked (line 90 throws on error), so the success path is correct. However, if `supabase.insert().select().single()` returns `{ data: null, error: null }` (an edge case with some Supabase versions when the insert is deferred), `onUploadSuccess(savedResume.id)` is called with `savedResume = null`, throwing `TypeError: Cannot read properties of null`.  
**What user sees:** Upload appears to succeed (no error modal) but the app navigates to `undefined` or crashes.  
**Recommended fix:** Add `if (!savedResume) throw new Error('SAVE_FAILED')` after the null check.

---

### Finding 55: `career-coach/page.js` — Supabase profile/context loads have no error handling
**File:** `app/career-coach/page.js:29-34`  
**What fails:** `supabase.auth.getUser()` and `supabase.from('profiles').select()` are awaited without error handling. On failure, state is never set and the component renders with undefined data.  
**What user sees:** Blank profile fields with no error state — looks like a new user rather than a load failure.  
**Recommended fix:** Add try/catch around the data loading block; set an error state and render an error message.

---

### Finding 56: `resume-coach/page.js` — cover letter generation modal closes abruptly on `RESUME_JD_MISMATCH`
**File:** `app/resume-coach/page.js:660-672`  
**What fails:** On this specific error, `setShowCLModal(false)` is called and the modal closes, but the error toast appears simultaneously. The abrupt close without explanation can confuse users.  
**What user sees:** The "Create Cover Letter" modal instantly disappears, replaced by a toast. The user doesn't know which resume or job caused the mismatch.  
**Recommended fix:** Keep the modal open and display the error inline rather than closing it and relying on a toast.

---

### Finding 57: `profile/page.js` — profile Supabase queries have no error state set
**File:** `app/profile/page.js:37-51`  
**What fails:** `supabase.auth.getUser()` and the profile query at lines 39, 42 are called without checking the error field; the `catch` block at line 51 only calls `setLoading(false)` but doesn't set any error UI state.  
**What user sees:** Loading resolves but the profile page renders blank with no indication of failure.  
**Recommended fix:** Set an error state in the catch block and render an error message.

---

### Finding 58: `build/page.js` — generic error message on resume insert failure
**File:** `app/build/page.js:130-158`  
**What fails:** The catch block calls `setErrorToast(true)` but the error toast shown is generic ("Something went wrong") regardless of what actually failed. A Supabase quota error and a network error produce identical user-facing messages.  
**What user sees:** "Something went wrong" with no actionable guidance.  
**Recommended fix:** At minimum distinguish between auth failure, network failure, and database failure to suggest the appropriate recovery action.

---

### Finding 59: `dashboard/page.js` — password reset email success shown regardless of error
**File:** `app/dashboard/page.js:157`  
**What fails:** The return value of `resetPasswordForEmail()` is not fully checked before `setResetSuccess(true)` is called.  
**What user sees:** "Password reset email sent" confirmation even if the underlying call failed.  
**Recommended fix:** Verify `error` is null from the Supabase response before showing success; otherwise show the error.

---

### Finding 60: `JobCardModal` — wins load silently drops error
**File:** `app/components/JobCardModal.js:46-60`  
**What fails:** `supabase.from('achievements').select()` is called but only `if (data)` is checked — the `error` field is not. On RLS denial or network failure, `data` is null and `error` is set; the wins section silently renders empty.  
**What user sees:** The "Wins" section in the job card appears empty even when wins exist in the database, with no feedback.  
**Recommended fix:** Destructure `{ data, error }` and log/surface the error if present.

---

### Finding 61: `UpgradeModal` — profile query error silently ignored
**File:** `app/components/UpgradeModal.js:17-21`  
**What fails:** `supabase.from('profiles').select('email').eq(...).single()` — the `error` field is not checked. If the query fails, `profile` is null, and the checkout session is created with `user.email` as fallback. The Stripe session proceeds but the profile email may be wrong, creating a mismatched customer record.  
**What user sees:** Nothing immediately wrong, but Stripe customer data may be incorrect.  
**Recommended fix:** Check `error` and log a warning before falling back to `user.email`.

---

### Finding 62: `cover-letter-finish` — retry loop only retries on 529 (overloaded), ignores 429
**File:** `app/api/cover-letter-finish/route.js:536-554`  
Already noted in Finding 29 (duplicate removed — see Finding 29).

---

### Finding 63: `resume-chat/route.js` — level detection error swallowed without logging
**File:** `app/api/resume-chat/route.js` ~358-372  
**What fails:** An inner `catch(e)` around the level detection Anthropic call silently swallows the error with no log, defaulting to `'entry'` level.  
**What user sees:** Nothing — but the resume chat may be incorrectly calibrated if the detection consistently fails (e.g., API overload), and there's no signal to investigate it.  
**Recommended fix:** Add `console.warn('Level detection failed, defaulting to entry:', e)` before the fallback.

---

## P2 — Polish (nice to fix)

### Finding 64: `review-prep/route.js` — `details: error.message` in response
**File:** `app/api/review-prep/route.js:177-179`  
The response object includes a `details` field with raw `error.message` in addition to the generic `error` message. The `details` field is unnecessary and leaks internals. Remove the `details` field.

---

### Finding 65: `career-coach/detail/page.js` — silent redirect on missing resume
**File:** `app/career-coach/detail/page.js:141-151`  
When a resume isn't found (invalid or expired URL), the page silently redirects to `/career-coach` with no explanation. Add a brief message or toast before redirecting.

---

### Finding 66: `resume-coach/page.js` — retry logic has no maximum retry count
**File:** `app/resume-coach/page.js:134-142`  
`setTimeout(() => loadData(), 1000)` is called when `retryCount === 0`, setting `retryCount` to 1. No cap prevents infinite retries if the API remains down. Enforce a maximum of 2-3 retries.

---

### Finding 67: `CoverLetterContent.js` — `onBlur` handlers have no error handling
**File:** `app/components/CoverLetterContent.js:40-54, 199-276`  
Every `onBlur` edit handler calls `onUpdate()` with no try/catch. Silent edit failures mean users think their cover letter changes were saved when they weren't. Add try/catch and show an error toast.

---

### Finding 68: `ResumeContent.js` — `onUpdate`/`updateField` calls have no error handling
**File:** `app/components/ResumeContent.js` (throughout — lines 517, 541, 545, 557 and many more)  
Every inline edit field calls `onUpdate()` or `updateField()` with no error handling. Resume edits can fail silently. Add try/catch and show error feedback.

---

### Finding 69: `cover-letter/[id]/page.js` — page count check errors silently swallowed
**File:** `app/cover-letter/[id]/page.js:214-231`  
The background page-count check inside `triggerPageCheck()` has a catch block that does nothing. If it consistently fails, the user never gets a warning that their cover letter may exceed one page. Add a console warn or set a fallback state.

---

### Finding 70: `career-coach/page.js` — upload `.json()` called after `parseRes.ok` check but not in its own try/catch
**File:** `app/career-coach/page.js:77-78`  
After `parseRes.ok` confirms success, `.json()` is called but could still throw if the body is not valid JSON. Wrap in a try/catch and differentiate the error message.

---

### Finding 71: `resume-coach/page.js` — loading state set before validation in cover letter modal
**File:** `app/resume-coach/page.js:626-630`  
`setCreatingCL(true)` is set before input validation runs, causing a brief loading flash even when the user will immediately see a validation error. Move validation before setting loading state.

---

### Finding 72: `profile/page.js` — photo upload and profile save errors not shown to user
**Files:** `app/profile/page.js:54-65` (photo upload) and `:67-77` (profile save)  
Errors are caught and logged but no error toast is shown. Users don't know if their photo or profile changes failed. Show an error toast in each catch block.

---

### Finding 73: `generate-pdf/route.js` — `getPublicUrl` result not validated
**File:** `app/api/generate-pdf/route.js:172-174`  
`supabase.storage.from(...).getPublicUrl(path)` does not return an `error` field (it's synchronous) but can return a null/empty URL if the path doesn't exist. The returned `publicUrl` is used without checking if it's truthy. If null, a subsequent `update` stores a null PDF URL silently. Add a check: `if (!publicUrl) throw new Error('Failed to get PDF URL')`.

---

## Patterns observed

### Pattern A: `error.message` returned directly to clients (17 routes)
Every API route's outer catch block uses `{ error: error.message }` or `{ error: \`...: ${error.message}\` }`. This is a single one-line change per route but applies to 17 files. Consider a shared `apiError(message, status)` helper that takes a safe user-facing message and logs the original error, then replace all 17 catch returns.

### Pattern B: No `response.ok` check before `.json()` (8 locations)
`fetch(url).then(r => r.json())` without a status check appears in `UpgradeModal`, `profile/page.js` (x2), `job-tracker/page.js`, `career-vault/page.js`, `resume-coach/page.js`, `career-coach/detail/page.js`, and `cover-letter/[id]/page.js`. A short utility `async function fetchJSON(url, options)` that throws on non-ok responses would fix all 8 at once.

### Pattern C: Loading state not cleaned up on error (6 locations)
`setLoading(true)` / `setSaving(true)` / `setUploading(true)` set at the start of async handlers but only reset on the success path. Appears in `JobCardModal` (x2), `career-coach/page.js`, `cover-letter/[id]/page.js`, `dashboard/page.js`, and `job-tracker/page.js`. Using `try/finally` as a pattern eliminates all cases.

### Pattern D: Supabase mutations without error checks (12+ locations)
`await supabase.from(...).update(...)` or `.insert(...)` called without destructuring `{ error }`. Appears across `job-tracker/page.js` (x4), `career-vault/page.js` (x5), `stripe/cancel`, `stripe/downgrade`, `stripe/webhook`. A lint rule or code review checklist would catch this pattern systematically.

### Pattern E: No React Error Boundary (app-wide)
No class-based or library-based Error Boundary wraps any part of the app. A single boundary in `app/layout.js` with a fallback UI would prevent all render errors from producing white screens. This is a one-file fix covering the entire codebase.

### Pattern F: `message.content[0].text` without null guard (4 routes)
Direct property access on Anthropic API response content without optional chaining or presence check. Appears in `extract-resume-structure`, `job-analyze`, `review-prep`, and (conditionally) `analyze-resume`. The correct pattern is `message.content?.[0]?.text ?? ''` with an explicit error if the result is falsy.

### Pattern G: Stripe ↔ Supabase state divergence risk (3 routes)
`stripe/cancel`, `stripe/downgrade`, and `signup-pro` all update Stripe and Supabase in sequence without any rollback or idempotency mechanism. If the second operation fails, the two systems are out of sync with no automated recovery. For beta, at minimum log these failures with customer IDs and create an ops runbook; for post-beta, consider a transactional outbox pattern.

---

## Files audited

### API Routes
- `app/api/analyze-resume/route.js`
- `app/api/auth/signup-pro/route.js`
- `app/api/career-coach/route.js`
- `app/api/coach/route.js`
- `app/api/coach-finish/route.js`
- `app/api/cover-letter-finish/route.js`
- `app/api/extract-captures/route.js`
- `app/api/extract-resume-structure/route.js`
- `app/api/generate-cover-letter-pdf/route.js`
- `app/api/generate-pdf/route.js`
- `app/api/generate-review-prep-pdf/route.js`
- `app/api/job-analyze/route.js`
- `app/api/parse-pdf/route.js`
- `app/api/resume-chat/route.js`
- `app/api/resume-coach/data/route.js`
- `app/api/review-prep/route.js`
- `app/api/stripe/cancel/route.js`
- `app/api/stripe/checkout/route.js`
- `app/api/stripe/downgrade/route.js`
- `app/api/stripe/webhook/route.js`
- `app/api/trial-coach-finish/route.js`

### Pages
- `app/page.js`
- `app/build/page.js`
- `app/career-coach/page.js`
- `app/career-coach/detail/page.js`
- `app/career-vault/page.js`
- `app/cover-letter/[id]/page.js`
- `app/dashboard/page.js`
- `app/job-tracker/page.js`
- `app/landing/page.js`
- `app/layout.js`
- `app/profile/page.js`
- `app/resume-coach/page.js`

### Components
- `app/components/CoachLayout.js`
- `app/components/ConversationPanel.js`
- `app/components/CoverLetterContent.js`
- `app/components/ErrorToast.js`
- `app/components/JobCardModal.js`
- `app/components/Modal.js`
- `app/components/ResumeContent.js`
- `app/components/ResumeUploadModal.js`
- `app/components/StandardModal.js`
- `app/components/SuccessToast.js`
- `app/components/UpgradeModal.js`

### Library / Utilities
- `app/dashboard/lib/supabase.js`
- `lib/subscription.js`
- `utils/supabase/client.js`
- `utils/supabase/server.js`

### Not audited (per scope)
- `app/interview-coach/` — excluded per instructions
- `app/interviews/` — excluded (interview coach feature)
- `app/templates/pdf/` — passive render components; errors covered under PDF generation routes
- `app/test/` — test pages, not user-facing
- All dark-mode related code
