# Implementation status

Updated: 21 October 2026. Current branch: `feat/healthcare-ui-redesign`.
Foundation and first redesign pass are committed. See the UI redesign section below for the current continuation and verification.

## Completed planning deliverables
- [x] Original flowchart added to repository.
- [x] Technical blueprint prepared.
- [x] Native Figma design prototype created with 23 screens.
- [x] Codex handoff, design map and repository instructions prepared.

## Current milestone

Runnable foundation and account verification/review milestone implemented. The complete starter roadmap and MVP remain
**partial**, not ready for real patient use. Nothing has been deployed and no live
database migration has been applied.

## Implemented

- Next.js 16.4.2 / React 19.3.1 / strict TypeScript / Tailwind setup, lockfile,
  local DM Sans fonts, lint, typecheck, build, unit, SQL and browser test commands.
- Responsive public landing and seven-service catalog, shared cards/buttons/
  badges, patient and staff shells, error/loading/not-found/setup states.
- Read actual Figma context and screenshots for nodes `3:601`, `3:653`, `3:696`,
  `3:743`, `3:766`, `3:872`, `3:968`; rendered original PDF website pages 1–4.
- Separate labelled synthetic patient/staff/queue previews; no demo authorization
  or workflow bypasses.
- Supabase SSR clients, cookie refresh proxy, verified-user/protected-role checks;
  signup/sign-in/reset/callback/logout adapters.
- Profile form with separate names, five barangays plus Others, mobile contact
  normalization and account status display.
- shadcn/ui configuration and themed Button, Input, Label, Textarea and
  AlertDialog components; adopted in auth, profile, upload and account review.
- Private server uploads with size/type/signature checks, actor-derived paths,
  retry reconciliation and versioned rejected-account resubmission.
- Staff account-review list, expiring private document links, confirmation
  dialogs, required rejection instructions and SQL-backed decisions.
- Operator-only audited staff provisioning script (dry run by default) and
  role-aware sign-in routing. No staff account provisioned by the agent.
- Additional Figma verification and appointment-review nodes `3:791` and
  `3:1019` inspected. Account review adapts shared tokens; the latter reference
  depicts appointment review, not a dedicated account-review screen.
- Authenticated service/session/review booking form and pending receipt adapter;
  own appointment history, inquiry creation and RLS-filtered message display.
- Staff page provides an authorized read-only pending-request list.
- SQL schema, RLS, protected roles, event/audit records, narrow mutations, draft
  catalog seeds and private bucket configuration.
- Transactional request/decision/cancellation/reschedule/check-in/queue functions,
  retry receipts, capacity locks and queue-session serialization.
- SQL profile/review/schedule/service operations, inquiry drafts/replies,
  notifications and transactional email-outbox enqueueing.

## Pending implementation

1. Live authenticated account acceptance checks and private orphan-object
   reconciliation/retention automation. File signature checks are not malware
   scanning or complete document parsing.
2. Staff decisions, scheduling/service management, queue console, and patient
   cancellation/rescheduling controls. SQL alone is not an integrated journey.
3. Live patient queue, authorized Realtime, reconnect and 15-second polling
   fallback. Publication configuration is prepared, not integrated.
4. Inquiry draft editing/publishing/follow-up UI, notifications, email worker
   with claims/retries/provider integration. Outbox rows do not send email.
5. Reports, audit interface, operational guide, downtime procedure and pilot
   acceptance.
6. Generated database types and relation mappings from local Supabase.

## External setup
- Hosted Supabase: user connected environment configuration. Read-only probes
  confirmed services REST access and a private verification bucket with the
  expected 5 MB limit and JPEG/PNG/PDF types. Server secret is configured.
  No live migrations, users, uploads or application-data changes were made.
- Local runtime: initial Podman inspection failed
  on a local configuration-directory error; runtime configuration was not changed.
  PGlite was used for isolated SQL tests.
- Email provider and production sender: not configured.
- Figma: access succeeded; nine reference screens inspected.
- Live center operational policies: confirm the open decisions in the blueprint.

## Verification log
Commands ran on the working tree on 20 October 2026:

| Check | Result / boundary |
| --- | --- |
| `npm run lint` | Passed, zero warnings |
| `npm run typecheck` | Passed |
| `npm test` | 15 passed |
| `npm run test:db` | 13 passed against PGlite with minimal Auth/Storage stubs |
| `npm run build` | Passed |
| `npm run test:e2e` | 12 passed at 360px, 768px, 1440px |
| `node --check scripts/provision-staff.mjs` | Passed; actual provisioning not executed |
| `npm audit --omit=dev` | Zero production dependency vulnerabilities |
| `npm audit` | 5 high findings in lint chain through braces 3.0.3; no newer braces version available |

SQL tests apply migrations 001–004 across two suites: duplicate replay, pending capacity, ownership,
denied role/review/outbox access, disabled staff, full-target reschedule rollback,
retry-safe check-in, busy desk refusal, skip/requeue, synchronized completion and
inquiry draft visibility. Account tests cover submission privileges, frozen
profiles, owner/other-patient/staff private-object policy access, rejection reasons,
version conflicts, resubmission, duplicate decisions and disabled staff.
Sequential embedded SQL tests do **not** prove concurrent
operations across connections.

Browser checks cover public navigation, disconnected authentication feedback,
setup guards, protected document-route denial, synthetic previews and horizontal overflow. Existing local Chromium
`chromium-1243` was selected with `PLAYWRIGHT_CHROMIUM_EXECUTABLE`.
Desktop/mobile landing screenshots were visually inspected against Figma;
artifacts are in ignored `test-results/`. Full visual fidelity, keyboard journeys
and accessibility audits remain pending. The authenticated upload/review screens
have not been exercised end-to-end in a browser.

Browser testing initially encountered the existing development-server lock, then
cold compilation timeouts with ten workers. A separate `.next-e2e` output directory,
two workers and explicit development-server timeouts resolved these failures;
the existing development server was not stopped.

Initial Vitest API, lint, ambiguous browser selector and unconfigured child-page
loading issues were fixed before passing checks. Next.js dev added its own
documentation-guidance block to AGENTS.md; project instructions were preserved.

Still required: live Supabase Auth and Storage HTTP/private-file isolation,
Realtime, full authenticated E2E, multi-connection capacity-1 and
50-request booking tests, simultaneous reschedule/check-in/cancel/call-next,
deadlock/rollback checks, and operational policy approval.

See README.md for setup and staff provisioning. Staff appointment operations
and authenticated acceptance checks are the next milestone; the full booking
journey is not yet complete.

## UI redesign — 21 October 2026

Branch: `feat/healthcare-ui-redesign`. The first theme/landing pass was committed
as `c36669a`; the continuation is uncommitted. This section supersedes the earlier
visual implementation description; backend milestones above retain their status.

Implemented:
- Central semantic shadcn-compatible theme, locally hosted DM Sans, mint/blue
  ambient background, solid form surfaces, inset glass navigation with opaque
  fallback, Lucide icons, visible focus and reduced-motion support.
- Composed AppHeader and mobile Sheet, active patient navigation, staff sidebar,
  ServiceCard, AppointmentCard/AppointmentStatusBadge, BookingStepper, SlotPicker,
  InquiryThread and AdminRequestPanel. Existing shadcn Button/Input/Label/Textarea
  and AlertDialog remain the controls; Sheet uses the installed Radix Dialog.
- Redesigned landing with illustrative visit preview, distinct services,
  three-step booking explanation and explicitly unconfirmed center information.
- Patient dashboard prioritizes own active visits (in-service/check-in first,
  then earliest session); appointment history uses the same card and status UI.
- Booking uses a native accessible date/calendar input and labelled session
  radios, full/unavailable states, persistent desktop summary, compact mobile
  summary, review/back navigation and retry-safe submission feedback. Date and
  selected session survive returning from review. Server snapshot marks started
  sessions; the existing database remains authoritative at submission time.
- Sign-in/registration share a two-column authentication shell; profile adds
  verification progress. Private upload and rejected/resubmission behavior and
  the existing secure server actions are preserved.
- Staff pending-request search and read-only detail Sheet; account-review rows
  open the existing live review controls in a Sheet, retaining confirmation and
  required rejection instructions. Narrow tables become stacked rows.
- Inquiry threads, empty/error/setup pages and secondary forms share the theme.
- Explicit `/preview/booking` journey through a synthetic pending receipt;
  `/preview/queue` waiting/called/in-service/completed/disconnected states; staff
  preview demonstrates local call/start/complete states. These never mutate data.

Validation and boundaries:
- `npm run lint`: passed after replacing an impure render-time clock with the
  server-provided availability snapshot.
- `npm run typecheck`: passed.
- `npm test`: 15 passed. `npm run test:db`: 13 passed. These embedded SQL tests
  retain their existing limitations; they do not prove multi-connection races.
- `npm run build`: passed after final UI changes.
- Browser coverage expanded to 32 cases across 360, 390, 768 and 1440px, covering
  public/setup guards, full-slot disabling, selection persistence, pending-only
  sample receipt, table filtering, Sheet focus restoration, mobile navigation,
  queue states and overflow. Final rerun results recorded below.
- Captured desktop/mobile screenshots in ignored `test-results/`; inspected
  landing, booking, patient/staff previews, authentication and review panels.
  Visual inspection caught internal mobile table clipping; stacked rows fix it.
- The initial browser run passed all 32 cases but sandbox process cleanup hung.
  Only that run's verified server process tree was terminated; final browser
  verification runs outside that process restriction.
- Figma access in this redesign was blocked by the Starter-plan MCP call limit.
  Used repository documentation; no Figma edits or fresh visual inspection of
  Figma are claimed. The new visual direction intentionally supersedes its style.

Still pending: authenticated browser acceptance for dashboard data, profile,
private upload and nested review/confirmation panels; live queue and Realtime;
appointment decisions/cancellation/rescheduling UI; schedules, notifications,
reports and staff inquiry management. Those absent screens were not fabricated.
No live database changes or deployment. Center policies remain unconfirmed.

Final redesign verification (21 October 2026): all **32 Playwright tests passed**
in 39.6 seconds and exited successfully after the mobile table and booking-date
persistence refinements. Lint, typecheck, 15 unit tests, 13 embedded SQL tests and
production build passed. Screenshots include landing, services, sign-in,
registration, patient/staff/queue previews, selected booking sessions and the
request detail Sheet. Actual signed-in flows remain unverified in a browser.

## Appointment join and loading fix — 21 October 2026
- Both patient appointment queries now explicitly use `appointments_slot_id_fkey`
  for the current slot; original/suggested slot foreign keys caused PGRST201.
- Role and profile reads run in parallel after identity verification. Request-local
  React cache and all disabled-role/ownership/RLS checks remain intact. No shared
  caching of private records or removal of authentication checks.
- Replaced the warning-style loading notice with a reusable neutral skeleton,
  reduced-motion support, and patient/admin loading boundaries so their existing
  navigation can remain visible during page transitions.
- Reported 2.5s request included 332ms Next.js work, 242ms proxy and 1955ms app
  work. Serial remote requests and development overhead contribute; no production
  speed claim or benchmark is implied by this change.
- Focused verification only; no full build, browser or database test suite rerun.
- Verification: targeted ESLint and `tsc --noEmit` passed. A public-key zero-row
  probe reached Supabase but returned 401/42501 (appointments require an authorized
  actor); signed-in query success and latency remain unverified. No privileged
  key or patient records were used for the probe.

## Session-aware navigation — 21 October 2026
- One shared header now derives guest/patient/staff navigation from the existing
  server-verified actor. Signed-in users see Sign out and account links on desktop
  and mobile, including public pages. Login reload and logout cookie invalidation
  refresh the server-rendered header.
- Removed the duplicate patient navigation row and staff sidebar logout control.
  Staff sidebar retains its task-specific navigation.
- Header uses Suspense with a neutral account placeholder while resolving identity;
  it shares the request-local actor cache rather than adding a second actor lookup.
- Focused TypeScript and changed-file lint checks passed. No full test/build run;
  signed-in browser acceptance remains pending.

## Staff header correction — 21 October 2026
- Moved Appointment requests and Account reviews into the single shared header
  for staff on desktop/mobile. Removed the staff sidebar and patient Services/
  My account links from staff navigation; brand returns staff to `/admin`.
- Pending identity resolution shows no patient navigation flash. Protected admin
  layout still verifies the staff role. Focused ESLint and TypeScript passed;
  no full suite/build or authenticated browser run.

## Staff appointment decisions — 21 October 2026
- Connected `/admin` request detail panels to the existing `change_appointment`
  RPC for approval/rejection. Shows patient name, service, date and session using
  explicit current-slot and patient foreign-key joins.
- Server action verifies the active staff role; validates UUIDs, exact optimistic
  concurrency timestamp and decision; requires a nonblank rejection reason.
  Uses the actor's authenticated Supabase client, preserving database authorization,
  locks, events, notification creation and operation receipts.
- Confirmation dialogs explain Scheduled versus check-in. Buttons prevent duplicate
  clicks; unchanged retry payloads reuse the same idempotency key. Conflicts and
  interrupted responses show actionable feedback and a refresh control.
- Successful changes refresh pending requests and invalidate patient appointment
  views. Synthetic preview panels remain read-only and never call the decision action.
- Passed: TypeScript, changed-file ESLint, 4 decision-validation tests and 7 existing
  embedded PostgreSQL workflow tests (including patient/disabled-staff denial).
- Not verified: authenticated browser approval/rejection or hosted RPC execution.
  Embedded tests do not establish multi-connection concurrency safety. No migrations,
  live writes, deployment, full suite or production build were run for this slice.
- Next: patient cancellation/rescheduling controls, staff check-in and live queue
  operations, schedules, notifications and inquiry management. The app remains partial.

## Preview duplicate navigation correction — 21 October 2026
- The reported screenshot was the synthetic booking preview, whose separate preview
  navigation survived the authenticated-layout fix. Removed that second navigation.
- Preview links now occupy the main header on desktop/mobile. `/preview/admin`
  displays Staff preview branding and staff overview/request/account-review links,
  rather than the signed-in patient's navigation. This is presentation only;
  secure staff links continue to require server authorization.
- Focused ESLint and TypeScript passed; no browser/full-suite run.

## Appointment, queue and inquiry continuation — 21 October 2026
Implemented locally against existing RPC contracts (no migration/deployment):
- Patient manage-appointment panels: cancellation reason and confirmation;
  reschedule sessions loaded on demand from the owned appointment's service.
  New slots return to pending approval; full-slot failures preserve the original
  reservation in the existing transaction. Unchanged retries reuse keys and exact
  database timestamps protect against stale edits.
- `/admin/queue`: today's Manila scheduled arrivals, staff-confirmed check-in,
  optional documented arrival override, per-service call-next/start/complete/
  skip/requeue/close controls. Server actions verify active staff; database functions
  remain authoritative for transition, capacity, service date and busy-desk checks.
- Patient own-ticket endpoint uses `my_queue` and private/no-store responses.
  Appointment cards poll every 15 seconds while visible, refresh on visibility/
  reconnect, and show stale/error feedback. No full queue is sent to patients.
  Realtime subscriptions are NOT implemented yet; this is polling integration.
- `/admin/inquiries`: latest 50 threads, private draft visibility, reply publishing
  and follow-up/resolved statuses; patients can reply to their own threads, reopening
  them. Draft saves append versions; editing/deleting existing draft rows is pending.
- Staff header includes arrivals/queue and inquiries. Existing auth/RLS and
  synthetic preview separation preserved.
Verification: TypeScript and changed-file ESLint passed; all 7 existing embedded
SQL workflow tests passed, covering capacity, ownership, staff denial, reschedule
rollback, check-in replay, queue transitions and inquiry draft isolation.
Not run: full build/suites, authenticated browser acceptance or hosted mutations.
Remaining to finish the MVP: schedule/service management UI, notification inbox,
email outbox worker/provider, Realtime subscription/reconnect acceptance, history/
reports/audit UI, pagination beyond bounded staff lists, no-show controls,
operational policy approval, multi-connection race tests and complete authenticated
end-to-end acceptance. The application is still partial, not pilot-ready.

## Operations, notifications and delivery continuation — 21 October 2026
- Added staff services/schedules management: publish/bookable controls, requirements,
  arrival rules, session creation, capacity/open edits, confirmation, retry keys,
  exact version timestamps and upcoming-session pagination using existing RPCs.
- Added paginated own-account notification inbox and read acknowledgements.
  Patient layouts subscribe to RLS-protected own notifications, refresh on reconnect
  and visibility, and poll every minute. Own queue polling remains every 15 seconds.
  Queue initial loading now uses a minimal skeleton. Header includes the new pages
  and switches to its menu earlier to avoid overflowing navigation.
- Added staff reports with exact status counts, explicit cohort dates/denominators
  and limited audit activity. Duration statistics and export remain pending.
- Added bounded Resend outbox worker: read-only default, explicit send mode,
  atomic claims/leases, stable provider idempotency key, bounded retry window,
  recipient eligibility, generic private-account links and sanitized error codes.
  Provider acceptance is recorded separately from actual inbox delivery; no email
  was sent, scheduler installed or hosted database modified.
- Added local-only authenticated Playwright configuration and a synthetic
  sign-in/authorization/inquiry/notification journey. It does not apply migrations.
- Passed: TypeScript, targeted ESLint, 9 embedded PostgreSQL workflow tests,
  including new capacity/stale-session/idempotency and notification-isolation checks.
- Blocked: authenticated Playwright configuration refuses execution because
  E2E_SUPABASE_URL/local synthetic accounts are not configured. No local Supabase
  CLI or Docker command was found. Current app configuration points to hosted
  Supabase; TEST_DATABASE_URL, EMAIL_DATABASE_URL and RESEND_API_KEY are absent.
- Not verified: new page browser behavior, actual Realtime events/reconnect,
  provider delivery, email worker crash/concurrency behavior, or full production
  build. No full suite was rerun. Figma fidelity for these added screens is unverified;
  they extend existing shared UI and documented design tokens.
- See OPERATIONS.md for setup and limits. Remaining acceptance includes booking/
  approval/check-in E2E, private uploads/review, multi-connection races, email failure/
  recovery and deliverability. Other unfinished UI includes no-show controls,
  pagination of older staff lists, editing existing inquiry drafts and expanded
  reporting. The app is not yet pilot-ready.

## Staff workflow completion — 21 October 2026
- Added `/admin/history`: paginated visits, status/exact-reference filters,
  staff cancellation and no-show controls with required patient-visible reasons,
  confirmation, optimistic timestamps and retry-safe existing RPC calls.
- Staff can suggest an available alternative when declining; patients see the
  suggestion with an explicit reminder that it is not reserved.
- Added `/admin/book`: approved-patient lookup, published-service session selection,
  staff booking with reason, eligibility/capacity/duplicate checks and audit record.
  Staff-created requests remain pending until explicitly approved.
- Added draft service creation and name/identifier/description editing; new services
  remain unpublished. Existing inquiry drafts can be edited or published in place.
  Both use staff-only, optimistic, retry-safe database functions.
- Added configured review-overdue counts (`APPOINTMENT_REVIEW_HOURS`, disabled
  until an approved deadline is supplied), plus pagination for requests, reviews,
  inquiries and patient appointments. Patient appointments support status filtering.
- Added staff Realtime subscriptions with visible-page polling fallback, and
  aggregate decision/wait/service durations with explicit cohorts and exclusions.
- New local migration: `20261021064654_staff_management.sql`. It has NOT been
  applied to hosted Supabase. Staff booking, service-definition editing, draft
  editing, duration metrics and staff table publications depend on this migration.
- Verification: 13 embedded PostgreSQL workflow tests passed, including staff-only
  service creation/replay, private draft edits/publication, staff booking capacity,
  no-show transitions and bounded staff-only duration reporting. TypeScript passed.
  Targeted lint initially found an impure render-time clock call; moved the overdue
  query into a server helper. Final targeted ESLint and TypeScript checks passed.
- Still pending: authenticated browser journeys, provider delivery/recovery,
  Realtime reconnect/concurrency acceptance, multi-connection races and production
  build. Report exports and deeper audit-event browsing remain enhancements;
  center policies, SMTP/provider setup and pilot acceptance are not completed.

## Report export and audit browsing — 21 October 2026
- Added staff-only CSV export of exact request-status counts for a validated,
  inclusive Manila date range (maximum 93 days). Exports contain aggregate counts,
  cohort labels and dates, not patient identifiers. Responses are private/no-store;
  unauthenticated and non-staff requests are rejected by the route itself.
- Added `/admin/audit` with exact-action filtering and pagination, linked from
  Reports. Sensitive audit metadata and record identifiers are not displayed.
- Added focused report-range tests for Manila boundaries, impossible dates,
  reversed/oversized ranges and invalid input. No live database changes required.
- Passed: TypeScript, targeted ESLint and both report-range tests. Authenticated
  export downloads and audit browsing have not yet been browser-verified.
- Email provider setup remains deferred until a verified sending domain exists.
  Authenticated browser, Realtime and multi-connection acceptance remain pending.

## Production build and delivery recovery — 21 October 2026
- Extracted the email delivery loop into an injectable worker module while keeping
  the CLI read-only by default. Added `npm run test:email` for offline provider
  recovery checks; no database connection or real email is used by these tests.
- Verified stable idempotency keys after ambiguous provider failure, permanent
  failure handling, retry exhaustion, and suppression of ineligible recipients.
  Ineligible recipients now receive a specific sanitized failure code.
- Updated authenticated acceptance coverage for patient export denial, staff CSV
  download/invalid dates, new staff pages and editing/publishing an existing draft.
  Fixed the test selector ambiguity introduced by inline draft editors.
- Passed: production `npm run build` (all routes), targeted ESLint, all 19 embedded
  PostgreSQL tests and 3 offline email-worker recovery tests.
- Authenticated Playwright configuration still refuses execution: E2E_SUPABASE_URL
  is absent. Docker/local Supabase is unavailable on this machine. Browser journeys,
  real concurrent connections, actual Realtime reconnects and provider delivery
  therefore remain unverified. Mock provider tests do not prove inbox delivery or
  database worker leasing under concurrency. No hosted migration or email was sent.

## Compact workspace layouts — 21 October 2026
- Patient appointments now use compact responsive rows with date, reference, status
  and management actions. Filtering and booking sit together above the list.
  Alternative-session notices and active queue details remain available.
- Patient and staff inquiries use summary rows and accessible conversation modals
  with existing reply/draft controls. Published patient messages are ordered by
  creation time; private drafts remain excluded from patient content.
- Profile details and private verification upload sit side by side above 800px;
  narrower screens stack the sections. Existing visual tokens are retained.
- Passed: typecheck, 21 unit tests and production build. An initial build found
  a source encoding error introduced during editing; corrected before the passing build.
- Authenticated browser checks are blocked by missing E2E_SUPABASE_URL for an
  isolated local instance. These layouts and modal interactions have not been
  browser-verified. Figma visual fidelity has not been verified for this change.
- Full ESLint check also passed.

## Staff workspace density and feedback — 21 October 2026
- Added Sessions / Services tabs with keyboard navigation and preserved form state
  when switching tabs. Session creation and upcoming sessions use desktop columns;
  service definition and availability settings sit side by side. Operational fields
  use two columns and checkboxes have bounded 18px controls with clickable labels.
- Reports now have horizontal date filters, side-by-side outcome/duration cards
  and a compact metric grid. History uses summary rows with visit-detail dialogs.
  Arrivals and queues sit side by side; requests include patient/service/session
  columns. Layouts collapse for smaller screens.
- Conversation messages show sender names where available, patient/staff labels,
  Manila timestamps and explicit private-draft labels. Sender names are loaded
  using the existing staff-authorized profile query; patient views do not fetch
  staff profiles. Existing draft isolation and server authorization remain intact.
- Added shared bottom-left Radix snackbars with a seven-second timeout, manual
  dismissal and built-in hover/focus pause. Auth, inquiry sends/replies, schedule
  settings, appointment decisions, history actions and queue actions use them.
  Generic sign-in/password-update feedback survives the full-page redirect.
- Passed: full lint, TypeScript, 21 unit tests, final production build, diff check,
  and 12 selected browser checks across 360/390/768/1440px. Browser checks cover
  public/preview overflow, request-panel keyboard behavior, snackbar positioning,
  automatic dismissal and manual close. Used installed Chrome after bundled
  Playwright Chromium was missing. Screenshot capture emitted caret-style hydration
  warnings during the run; all selected checks passed.
- Updated authenticated inquiry tests for modal access, sender labels and private
  draft editing. Execution remains blocked by missing E2E_SUPABASE_URL for an
  isolated local instance. Private staff layouts, sender queries and successful
  authenticated action feedback still need browser acceptance. Figma fidelity
  remains unverified. No migration or live database mutation was performed.
